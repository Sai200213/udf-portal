import { httpsCallable } from 'firebase/functions';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    query,
    where,
    onSnapshot,
    onSnapshotsInSync,
    deleteDoc,
    limit,
    startAfter,
    orderBy,
    writeBatch,
    QueryDocumentSnapshot,
    serverTimestamp,
    getCountFromServer,
    deleteField,
    Timestamp,
    increment
} from 'firebase/firestore';
import log from "@/src/utils/logger";
import { db, auth, ensureAuthenticated, functions } from '../firebase/config';
import {
    OnboardingSubmission, FirestoreEmployee, EmploymentStint,
    EmployeeAssignment, SubmissionStatus, FormSection, Site, Role,
    WorkflowConfig, Permission, SubmittedFormData, DashboardAnalytics,
    LeavePolicy, DraftSubmission, TimelineEvent, FieldType, CorrectionRequest,
    ReferralInvite, DuplicateCheckResult, DuplicateMatchItem
} from '../../types';
import { getApplicantName, getApplicantEmail, getApplicantPhone, getApplicantAadhaar, getApplicantPAN, getApplicantUAN } from '../../utils/formDataHelper';
import { checkEmailUniquenessGlobal } from './authService';
import { v4 as uuidv4 } from 'uuid';
import {
    uploadToDrive, moveEmployeeFolder, renameEmployeeFolder,
    permanentDeleteEmployeeFolder, moveEmployeeFolderToRecycleBin,
    restoreEmployeeFolderFromRecycleBin, syncFolderInDrive,
    submitToGoogleForm, createEmployeeFolder, copyFolderContents, copySpecificSubfolders,
    approveEmployeeFolder
} from './driveService';
import { uploadSubmissionDocument, deleteStorageFolder, moveStorageFiles, uploadEmployeeDocument } from './storageService';
import { generateDefaultPassword } from '../utils/bulkImportUtils';
import { logSystemAction } from './auditService';

// Re-export for backward compatibility
export {
    uploadToDrive, moveEmployeeFolder, renameEmployeeFolder,
    createEmployeeFolder, copyFolderContents,
    permanentDeleteEmployeeFolder, moveEmployeeFolderToRecycleBin,
    restoreEmployeeFolderFromRecycleBin, syncFolderInDrive
};

// Collection References
const SUBMISSIONS_COLLECTION = 'onboarding_submissions';
const EMPLOYEES_COLLECTION = 'employees';
const DRAFTS_COLLECTION = 'draft_submissions';
const LEAVE_REQ_COL = 'leave_requests';

// Module-level helper — available to all functions in this file
const chunkArray = <T>(arr: T[], size: number): T[][] =>
    Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

/**
 * Resolves an employee's Firestore DocumentReference, Snapshot and data by checking:
 * 1. Direct document ID in 'employees' (e.g. UDF-202609-XXXX)
 * 2. 'employeeId' field (e.g. HY100123)
 * 3. 'portalId' field
 * 4. 'submissionId' field
 */
export const resolveEmployeeDoc = async (idOrEmployeeId: string): Promise<{ ref: any; snap: any; data: FirestoreEmployee } | null> => {
    if (!idOrEmployeeId) return null;
    const cleanId = String(idOrEmployeeId).trim();
    if (!cleanId) return null;

    // 1. Direct doc ID
    const directRef = doc(db, EMPLOYEES_COLLECTION, cleanId);
    const directSnap = await getDoc(directRef);
    if (directSnap.exists()) {
        return { ref: directRef, snap: directSnap, data: { id: directSnap.id, ...directSnap.data() } as unknown as FirestoreEmployee };
    }

    // 2. Query by employeeId
    const qEmp = query(collection(db, EMPLOYEES_COLLECTION), where('employeeId', '==', cleanId), limit(1));
    const snapEmp = await getDocs(qEmp);
    if (!snapEmp.empty) {
        const doc0 = snapEmp.docs[0];
        return { ref: doc0.ref, snap: doc0, data: { id: doc0.id, ...doc0.data() } as unknown as FirestoreEmployee };
    }

    // 3. Query by portalId
    const qPortal = query(collection(db, EMPLOYEES_COLLECTION), where('portalId', '==', cleanId), limit(1));
    const snapPortal = await getDocs(qPortal);
    if (!snapPortal.empty) {
        const doc0 = snapPortal.docs[0];
        return { ref: doc0.ref, snap: doc0, data: { id: doc0.id, ...doc0.data() } as unknown as FirestoreEmployee };
    }

    // 4. Query by submissionId
    const qSub = query(collection(db, EMPLOYEES_COLLECTION), where('submissionId', '==', cleanId), limit(1));
    const snapSub = await getDocs(qSub);
    if (!snapSub.empty) {
        const doc0 = snapSub.docs[0];
        return { ref: doc0.ref, snap: doc0, data: { id: doc0.id, ...doc0.data() } as unknown as FirestoreEmployee };
    }

    return null;
};

// --- Draft Submissions ---

export const subscribeToDrafts = (onUpdate: (drafts: DraftSubmission[]) => void) => {
    return onSnapshot(collection(db, DRAFTS_COLLECTION), (snapshot) => {
        const drafts = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as DraftSubmission[];
        onUpdate(drafts);
    });
};

export const getFormDraft = async (draftId: string) => {
    const user = await ensureAuthenticated();
    const cleanId = (draftId || '').trim();
    if (!cleanId) return null;

    const draftRef = doc(db, DRAFTS_COLLECTION, cleanId);
    let snap = await getDoc(draftRef);

    // Fallback A: If not found, try uppercase variation (e.g. udf-202609-abcd -> UDF-202609-ABCD)
    if (!snap.exists() && cleanId.toUpperCase() !== cleanId) {
        const upperRef = doc(db, DRAFTS_COLLECTION, cleanId.toUpperCase());
        const upperSnap = await getDoc(upperRef);
        if (upperSnap.exists()) {
            snap = upperSnap;
        }
    }

    // Fallback B: If not found by document ID, cleanId might be a user UID (e.g. Google UID or Anonymous UID)
    if (!snap.exists()) {
        try {
            const draftsRef = collection(db, DRAFTS_COLLECTION);
            const q = query(draftsRef, where("ownerUid", "==", cleanId), limit(5));
            const querySnap = await getDocs(q);
            if (!querySnap.empty) {
                const docs = querySnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
                docs.sort((a, b) => (new Date(b.lastUpdated || 0).getTime()) - (new Date(a.lastUpdated || 0).getTime()));
                return docs[0];
            }
        } catch (queryErr) {
            console.warn("Could not query drafts by ownerUid:", queryErr);
        }

        if (cleanId.includes('@')) {
            try {
                const draftsRef = collection(db, DRAFTS_COLLECTION);
                const qEmail = query(draftsRef, where("ownerEmail", "==", cleanId), limit(5));
                const querySnap = await getDocs(qEmail);
                if (!querySnap.empty) {
                    const docs = querySnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
                    docs.sort((a, b) => (new Date(b.lastUpdated || 0).getTime()) - (new Date(a.lastUpdated || 0).getTime()));
                    return docs[0];
                }
            } catch (queryErr) {
                console.warn("Could not query drafts by ownerEmail:", queryErr);
            }
        }
    }

    if (snap.exists()) {
        const data = snap.data();
        // If retrieved in a guest session and ownership belongs to an old/different session (e.g. new tab or device),
        // adopt ownership so future auto-saves and session-bound deletions align with current auth session.
        if (user?.uid && data.ownerUid !== user.uid && !data.isGoogleDraft) {
            try {
                await updateDoc(doc(db, DRAFTS_COLLECTION, snap.id), {
                    ownerUid: user.uid,
                    lastUpdated: new Date().toISOString()
                });
                data.ownerUid = user.uid;
            } catch (e) {
                console.warn("Could not transfer draft ownership to new guest session:", e);
            }
        }
        return { id: snap.id, ...data };
    }
    return null;
};

export const getDraftByUser = async (uid: string, email?: string | null): Promise<DraftSubmission | null> => {
    if (!uid && !email) return null;
    try {
        await ensureAuthenticated();
        const draftsRef = collection(db, DRAFTS_COLLECTION);
        if (uid) {
            const q = query(draftsRef, where("ownerUid", "==", uid), limit(5));
            const snap = await getDocs(q);
            if (!snap.empty) {
                const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as DraftSubmission));
                docs.sort((a, b) => (new Date(b.lastUpdated || 0).getTime()) - (new Date(a.lastUpdated || 0).getTime()));
                const candidate = docs[0];
                const subCheck = await getDoc(doc(db, SUBMISSIONS_COLLECTION, candidate.id));
                if (subCheck.exists()) {
                    const subData = subCheck.data();
                    if (subData.status !== 'Rejected' && subData.status !== 'Deleted' && !subData.deletedAt) {
                        try { await deleteDoc(doc(db, DRAFTS_COLLECTION, candidate.id)); } catch(e) {}
                        return null;
                    }
                }
                return candidate;
            }
        }
        if (email) {
            const qEmail = query(draftsRef, where("ownerEmail", "==", email), limit(5));
            const snapEmail = await getDocs(qEmail);
            if (!snapEmail.empty) {
                const docs = snapEmail.docs.map(d => ({ id: d.id, ...d.data() } as DraftSubmission));
                docs.sort((a, b) => (new Date(b.lastUpdated || 0).getTime()) - (new Date(a.lastUpdated || 0).getTime()));
                const candidate = docs[0];
                const subCheck = await getDoc(doc(db, SUBMISSIONS_COLLECTION, candidate.id));
                if (subCheck.exists()) {
                    const subData = subCheck.data();
                    if (subData.status !== 'Rejected' && subData.status !== 'Deleted' && !subData.deletedAt) {
                        try { await deleteDoc(doc(db, DRAFTS_COLLECTION, candidate.id)); } catch(e) {}
                        return null;
                    }
                }
                return candidate;
            }
        }
    } catch (e) {
        console.warn("Could not query draft by user:", e);
    }
    return null;
};

/**
 * Safeguard check: Verifies if a draft's owner UID or draft ID belongs to an active employee or approved submission.
 * Used to prevent draft purge routines from wiping live employee verified documents.
 */
export const isOwnerAnActiveEmployee = async (ownerUid?: string, draftId?: string): Promise<boolean> => {
    if (!ownerUid && !draftId) return false;

    try {
        if (draftId) {
            // Check active employees collection
            const empSnap = await getDoc(doc(db, EMPLOYEES_COLLECTION, draftId));
            if (empSnap.exists()) return true;

            // Check onboarding submissions (pending approval, under review, approved)
            const subSnap = await getDoc(doc(db, SUBMISSIONS_COLLECTION, draftId));
            if (subSnap.exists()) {
                const subData = subSnap.data() as any;
                if (subData?.status !== 'Deleted' && !subData?.deletedAt) return true;
            }
        }

        if (ownerUid) {
            // Check active employees collection by ID or linked/auth fields
            const empSnap = await getDoc(doc(db, EMPLOYEES_COLLECTION, ownerUid));
            if (empSnap.exists()) return true;

            const [qUid, qLinked, qPortal] = await Promise.all([
                getDocs(query(collection(db, EMPLOYEES_COLLECTION), where('uid', '==', ownerUid), limit(1))),
                getDocs(query(collection(db, EMPLOYEES_COLLECTION), where('linkedUid', '==', ownerUid), limit(1))),
                getDocs(query(collection(db, EMPLOYEES_COLLECTION), where('portalId', '==', ownerUid), limit(1)))
            ]);

            if (!qUid.empty || !qLinked.empty || !qPortal.empty) return true;

            // Check onboarding submissions (both pending approval and approved)
            const [subQ, subLinkedQ] = await Promise.all([
                getDocs(query(collection(db, SUBMISSIONS_COLLECTION), where('ownerUid', '==', ownerUid), limit(1))),
                getDocs(query(collection(db, SUBMISSIONS_COLLECTION), where('linkedUid', '==', ownerUid), limit(1)))
            ]);

            const liveSubmission = [...subQ.docs, ...subLinkedQ.docs].find(d => {
                const data = d.data() as any;
                return data.status !== 'Deleted' && !data.deletedAt;
            });
            if (liveSubmission) return true;
        }
    } catch (err) {
        console.warn('[STORAGE SAFEGUARD] Error checking active employee status for draft:', err);
        // Fail-safe: if check errors out, assume active to avoid accidental data destruction
        return true;
    }

    return false;
};

export const deleteDraftSubmission = async (draftId: string) => {
    const draftRef = doc(db, DRAFTS_COLLECTION, draftId);
    const draftSnap = await getDoc(draftRef);
    if (draftSnap.exists()) {
        const data = draftSnap.data() as DraftSubmission;
        // Delete Firestore document
        await deleteDoc(draftRef);
        
        // Safeguard check: NEVER delete storage if applicant is in pending submissions or active employees!
        const isLive = await isOwnerAnActiveEmployee(data.ownerUid, draftId);
        if (!isLive) {
            try {
                // Only ever delete the draft-specific folder (never wipe user-level directories)
                await deleteStorageFolder(`onboarding/${draftId}`);
            } catch (err) {
                console.error(`Failed to delete storage for draft ${draftId}:`, err);
            }
        } else {
            console.log(`[STORAGE PURGE SAFEGUARD] Preserved onboarding files for active/pending candidate (Draft: ${draftId}, Owner: ${data.ownerUid})`);
        }
    } else {
        await deleteDoc(draftRef);
    }
};

export const purgeAbandonedDrafts = async (days: number = 30) => {
    const draftsRef = collection(db, DRAFTS_COLLECTION);
    const snap = await getDocs(draftsRef);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    let deletedCount = 0;
    for (const docSnap of snap.docs) {
        const data = docSnap.data() as DraftSubmission;
        const lastUpdated = data.lastUpdated ? new Date(data.lastUpdated) : null;
        
        if (!lastUpdated || isNaN(lastUpdated.getTime()) || lastUpdated < cutoff) {
            await deleteDraftSubmission(docSnap.id);
            deletedCount++;
        }
    }
    return { deletedCount };
};
const ACCOUNT_UPD_COL = 'account_updates';
const RESIGNATION_COL = 'resignations';
const DISCIPLINARY_COL = 'disciplinary_actions';
const NOTIFICATIONS_COL = 'notifications';
const LEAVE_BALANCES_COL = 'leave_balances';

export const getEmployees = async () => {
    const querySnapshot = await getDocs(collection(db, EMPLOYEES_COLLECTION));
    return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
        };
    });
};

export const getGlobalStats = async (
    siteFieldId?: string,
    siteNames?: string[],
    allowedCounts?: { submissions: boolean; employees: boolean; leaves: boolean; updates: boolean; profiles: boolean; resignations?: boolean },
    siteIds?: string[]
) => {
    const submissionsColl = collection(db, SUBMISSIONS_COLLECTION);
    const employeesColl = collection(db, EMPLOYEES_COLLECTION);
    const leaveColl = collection(db, LEAVE_REQ_COL);
    const updatesColl = collection(db, ACCOUNT_UPD_COL);
    const resignationColl = collection(db, 'resignations');

    const runCount = async (q: any) => {
        try {
            const snap = await getCountFromServer(q);
            return snap.data().count;
        } catch (err) {
            log.log("[getGlobalStats] Count query failed/restricted:", err);
            return 0;
        }
    };
    let pendingSub = 0, activeEmp = 0, pendingLeave = 0, pendingUpdates = 0, pendingProfiles = 0, pendingResig = 0;

    if (siteIds !== undefined && siteIds.length === 0) {
        return { pendingSubmissions: 0, activeEmployees: 0, pendingLeaves: 0, pendingUpdates: 0, pendingProfiles: 0, pendingResignations: 0 };
    }

    if (siteIds && siteIds.length > 0) {
        const idChunks = chunkArray(siteIds, 10);
        for (const chunk of idChunks) {
            if (allowedCounts?.employees !== false) {
                activeEmp += await runCount(query(employeesColl, where("isActive", "==", true), where("currentSiteId", "in", chunk)));
            }
            if (allowedCounts?.leaves !== false) pendingLeave += await runCount(query(leaveColl, where("status", "==", "Pending"), where("siteId", "in", chunk)));
            if (allowedCounts?.updates !== false) pendingUpdates += await runCount(query(updatesColl, where("status", "==", "Pending"), where("siteId", "in", chunk)));
            if (allowedCounts?.profiles !== false) pendingProfiles += await runCount(query(employeesColl, where("isActive", "==", true), where("needsProfileCompletion", "==", true), where("currentSiteId", "in", chunk)));
            if (allowedCounts?.resignations !== false) pendingResig += await runCount(query(resignationColl, where("status", "==", "Pending"), where("siteId", "in", chunk)));
        }

        if (allowedCounts?.submissions !== false) {
            // Count pending submissions matching siteId or data[siteFieldId]
            for (const chunk of idChunks) {
                pendingSub += await runCount(query(submissionsColl, where("status", "==", "Pending Review"), where("siteId", "in", chunk)));
            }
            // If top-level siteId didn't match (e.g. stored in formData map with siteFieldId)
            if (pendingSub === 0) {
                const effectiveFieldId = siteFieldId || '52ae217b-2602-4337-a1cd-a1f9bd36a4b0';
                const combinedTerms = Array.from(new Set([...siteIds, ...(siteNames || [])]));
                const termChunks = chunkArray(combinedTerms, 10);
                for (const chunk of termChunks) {
                    const countFormData = await runCount(query(submissionsColl, where("status", "==", "Pending Review"), where(`formData.${effectiveFieldId}`, "in", chunk)));
                    if (countFormData > 0) {
                        pendingSub += countFormData;
                    } else {
                        pendingSub += await runCount(query(submissionsColl, where("status", "==", "Pending Review"), where(`data.${effectiveFieldId}`, "in", chunk)));
                    }
                }
            }
        }
    } else {
        if (allowedCounts?.submissions !== false) {
            pendingSub += await runCount(query(submissionsColl, where("status", "==", "Pending Review")));
        }
        if (allowedCounts?.employees !== false) {
            activeEmp += await runCount(query(employeesColl, where("isActive", "==", true)));
        }
        if (allowedCounts?.leaves !== false) pendingLeave += await runCount(query(leaveColl, where("status", "==", "Pending")));
        if (allowedCounts?.updates !== false) pendingUpdates += await runCount(query(updatesColl, where("status", "==", "Pending")));
        if (allowedCounts?.profiles !== false) pendingProfiles += await runCount(query(employeesColl, where("isActive", "==", true), where("needsProfileCompletion", "==", true)));
        if (allowedCounts?.resignations !== false) pendingResig += await runCount(query(resignationColl, where("status", "==", "Pending")));
    }

    return {
        pendingSubmissions: pendingSub,
        activeEmployees: activeEmp,
        pendingLeaves: pendingLeave,
        pendingUpdates: pendingUpdates,
        pendingProfiles: pendingProfiles,
        pendingResignations: pendingResig
    };
};

export const getEmployeeStatsCounts = async (allowedSiteIds?: string[]) => {
    try {
        const empColl = collection(db, EMPLOYEES_COLLECTION);
        let qTotal = query(empColl, where("isActive", "==", true));
        let qGoogle = query(empColl, where("isActive", "==", true), where("authProvider", "==", "google"));
        let qManual = query(empColl, where("isActive", "==", true), where("authProvider", "==", "manual"));
        let qPending = query(empColl, where("isActive", "==", true), where("needsProfileCompletion", "==", true));

        if (allowedSiteIds && allowedSiteIds.length > 0) {
            const chunks = allowedSiteIds.slice(0, 10);
            qTotal = query(empColl, where("isActive", "==", true), where("currentSiteId", "in", chunks));
            qGoogle = query(empColl, where("isActive", "==", true), where("authProvider", "==", "google"), where("currentSiteId", "in", chunks));
            qManual = query(empColl, where("isActive", "==", true), where("authProvider", "==", "manual"), where("currentSiteId", "in", chunks));
            qPending = query(empColl, where("isActive", "==", true), where("needsProfileCompletion", "==", true), where("currentSiteId", "in", chunks));
        }

        const [totalSnap, googleSnap, manualSnap, pendingSnap] = await Promise.all([
            getCountFromServer(qTotal),
            getCountFromServer(qGoogle),
            getCountFromServer(qManual),
            getCountFromServer(qPending)
        ]);

        return {
            total: totalSnap.data().count,
            googleAuth: googleSnap.data().count,
            manualAuth: manualSnap.data().count,
            pending: pendingSnap.data().count
        };
    } catch (e) {
        log.error("getEmployeeStatsCounts error:", e);
        return { total: 0, googleAuth: 0, manualAuth: 0, pending: 0 };
    }
};

export const getEmployeeById = async (id: string) => {
    if (!id) return null;
    const cleanId = id.trim();
    const idUpper = cleanId.toUpperCase();

    // 1. Direct doc lookup in employees
    let docRef = doc(db, EMPLOYEES_COLLECTION, cleanId);
    let docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
    }

    // 2. Query employees by employeeId == cleanId / idUpper
    try {
        const empQ = query(collection(db, EMPLOYEES_COLLECTION), where("employeeId", "==", idUpper), limit(1));
        const empQSnap = await getDocs(empQ);
        if (!empQSnap.empty) {
            const d = empQSnap.docs[0];
            return { id: d.id, ...d.data() };
        }
    } catch (_) {}

    // 3. Direct doc lookup in onboarding_submissions
    let subRef = doc(db, SUBMISSIONS_COLLECTION, cleanId);
    let subSnap = await getDoc(subRef);
    if (subSnap.exists()) {
        const sData = subSnap.data();
        return { id: subSnap.id, ...sData, employeeId: sData.employeeId || subSnap.id };
    }

    // 4. Query submissions by employeeId == cleanId / idUpper
    try {
        const subQ = query(collection(db, SUBMISSIONS_COLLECTION), where("employeeId", "==", idUpper), limit(1));
        const subQSnap = await getDocs(subQ);
        if (!subQSnap.empty) {
            const d = subQSnap.docs[0];
            const sData = d.data();
            return { id: d.id, ...sData, employeeId: sData.employeeId || d.id };
        }
    } catch (_) {}

    // 5. Query submissions by temporaryId == cleanId
    try {
        const subTempQ = query(collection(db, SUBMISSIONS_COLLECTION), where("temporaryId", "==", cleanId), limit(1));
        const subTempSnap = await getDocs(subTempQ);
        if (!subTempSnap.empty) {
            const d = subTempSnap.docs[0];
            const sData = d.data();
            return { id: d.id, ...sData, employeeId: sData.employeeId || d.id };
        }
    } catch (_) {}

    return null;
};

// (Drive functions extracted to driveService.ts)

// Helper function to generate a unique submission ID starting with UDF-
const getNextSubmissionId = async (): Promise<string> => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    let candidate = '';
    let exists = true;
    let attempts = 0;
    while (exists && attempts < 10) {
        attempts++;
        const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
        candidate = `UDF-${year}${month}-${randomStr}`;
        try {
            const draftSnap = await getDoc(doc(db, DRAFTS_COLLECTION, candidate));
            if (draftSnap.exists()) {
                exists = true;
                continue;
            }
            const snap = await getDoc(doc(db, SUBMISSIONS_COLLECTION, candidate));
            exists = snap.exists();
        } catch (e) {
            // Permission denied is expected for guest candidates checking other submissions
            exists = false;
        }
    }
    return candidate;
};

// Helper function to check if a given ID is a Portal ID (legacy SUB- or modern UDF-)
export const isPortalId = (id: string | undefined | null): boolean => {
    if (!id) return false;
    return id.startsWith('SUB-') || id.startsWith('UDF-');
};

/**
 * Checks if applicant matches an active employee, a relieved ex-employee,
 * or another pending submission across 4 statutory/biometric identifiers:
 * Aadhaar Number, PAN Card, UAN/EPFO Number, and Phone Number.
 */
export const checkApplicantDuplicates = async (identifiers: {
    aadhaar?: string | null;
    pan?: string | null;
    uan?: string | null;
    phone?: string | null;
    currentSubId?: string;
}): Promise<DuplicateCheckResult> => {
    const { aadhaar, pan, uan, phone, currentSubId } = identifiers;

    const checks: { field: 'Aadhaar Number' | 'PAN Card' | 'UAN Number' | 'Phone Number'; value?: string | null; queryField: string }[] = [
        { field: 'Aadhaar Number', value: aadhaar, queryField: 'aadhaarNumber' },
        { field: 'PAN Card', value: pan, queryField: 'panNumber' },
        { field: 'UAN Number', value: uan, queryField: 'uanNumber' },
        { field: 'Phone Number', value: phone, queryField: 'phoneNumber' }
    ];

    const isDummyPlaceholder = (val: string): boolean => {
        const clean = val.trim().toLowerCase();
        if (!clean) return true;
        if (['na', 'n/a', 'none', 'nil', 'null', 'dummy', 'test', 'unknown'].includes(clean)) return true;
        // Repetitive digits e.g. 00000000000, 1111111111
        if (/^(\d)\1+$/.test(clean)) return true;
        if (clean === '1234567890' || clean === '0123456789') return true;
        return false;
    };

    const placeholderChecks = checks.filter(c => c.value && String(c.value).trim().length > 0 && isDummyPlaceholder(String(c.value)));
    const validChecks = checks.filter(c => c.value && String(c.value).trim().length > 0 && !isDummyPlaceholder(String(c.value)));
    if (validChecks.length === 0 && placeholderChecks.length === 0) {
        return { isDuplicate: false };
    }

    const matches: DuplicateMatchItem[] = [];

    // Include placeholder values as non-blocking warning badges
    for (const ph of placeholderChecks) {
        const phVal = String(ph.value).trim();
        matches.push({
            matchType: 'PLACEHOLDER_VALUE',
            matchedField: ph.field,
            matchedValue: phVal,
            details: `${ph.field} contains dummy / placeholder digits ("${phVal}"). Approval is permitted; mark profile as Incomplete to obtain valid records.`
        });
    }

    try {
        // 1. Check Employees collection across all valid identifiers
        for (const check of validChecks) {
            const cleanVal = String(check.value).trim();
            const empQuery = query(
                collection(db, EMPLOYEES_COLLECTION),
                where(check.queryField, '==', cleanVal),
                limit(1)
            );
            const empSnap = await getDocs(empQuery);
            if (!empSnap.empty) {
                const empDoc = empSnap.docs[0];
                const emp = empDoc.data() as FirestoreEmployee;

                if (emp.deletedAt) continue;

                const isRelieved = emp.isRelieved === true || emp.isActive === false;
                const empId = emp.employeeId || emp.portalId || empDoc.id;
                const empName = emp.applicantName || 'Employee';
                const siteName = emp.siteName || emp.currentSiteId || 'N/A';

                if (!isRelieved && emp.isActive !== false) {
                    matches.push({
                        matchType: 'EXISTING_ACTIVE_EMPLOYEE',
                        matchedField: check.field,
                        matchedValue: cleanVal,
                        matchedId: empId,
                        matchedName: empName,
                        matchedSite: siteName,
                        details: `Active employee (${empId} - ${empName}) already exists with this ${check.field}.`
                    });
                } else {
                    matches.push({
                        matchType: 'EX_EMPLOYEE_REHIRE',
                        matchedField: check.field,
                        matchedValue: cleanVal,
                        matchedId: empId,
                        matchedName: empName,
                        matchedSite: siteName,
                        relievingDate: emp.relievingDate || 'N/A',
                        relievingReason: emp.relievingReason || 'N/A',
                        details: `Ex-employee (${empId} - ${empName}) relieved on ${emp.relievingDate || 'N/A'} (Reason: ${emp.relievingReason || 'N/A'}).`
                    });
                }
            }
        }

        // 2. Check Onboarding Submissions for duplicate pending applications across all valid identifiers
        for (const check of validChecks) {
            if (matches.some(m => m.matchedField === check.field && m.matchType === 'EXISTING_ACTIVE_EMPLOYEE')) continue;

            const cleanVal = String(check.value).trim();
            const subQuery = query(
                collection(db, SUBMISSIONS_COLLECTION),
                where(check.queryField, '==', cleanVal),
                limit(5)
            );
            const subSnap = await getDocs(subQuery);
            for (const subDoc of subSnap.docs) {
                if (currentSubId && subDoc.id === currentSubId) continue;
                const sub = subDoc.data() as any;
                if (sub.deletedAt || sub.status === 'Rejected' || sub.status === 'Deleted') continue;

                // Avoid exact duplicate match entry
                if (matches.some(m => m.matchedField === check.field && m.submissionId === subDoc.id)) continue;

                const subSiteName = sub.siteName || sub.data?.['52ae217b-2602-4337-a1cd-a1f9bd36a4b0'] || sub.formData?.['52ae217b-2602-4337-a1cd-a1f9bd36a4b0'] || sub.site || 'N/A';
                const subApplicantName = sub.applicantName || sub.data?.['6c78c857-bcbf-4786-9051-2ebf46401017'] || sub.formData?.['6c78c857-bcbf-4786-9051-2ebf46401017'] || 'Applicant';

                matches.push({
                    matchType: 'DUPLICATE_SUBMISSION',
                    matchedField: check.field,
                    matchedValue: cleanVal,
                    submissionId: subDoc.id,
                    submissionStatus: sub.status || 'Pending',
                    matchedName: subApplicantName,
                    matchedSite: subSiteName,
                    details: `Another submission (${subDoc.id}) exists with status "${sub.status}" matching this ${check.field}.`
                });
            }
        }
    } catch (err: any) {
        // Public candidates submitting forms do not have permissions to query all employees/submissions.
        // This is expected and safe: full duplicate detection runs during Admin Review & Approval Gatekeeper.
        if (err?.code === 'permission-denied' || err?.message?.includes('Missing or insufficient permissions')) {
            log.log("[DUPLICATE_CHECK] Public duplicate scan deferred to Admin Review (candidate has restricted read permissions).");
        } else {
            log.error("Error checking applicant duplicates:", err);
        }
    }

    if (matches.length === 0) {
        return { isDuplicate: false };
    }

    // Sort: ACTIVE_EMPLOYEE > DUPLICATE_SUBMISSION > EX_EMPLOYEE_REHIRE > PLACEHOLDER_VALUE
    const priorityOrder: Record<string, number> = {
        'EXISTING_ACTIVE_EMPLOYEE': 1,
        'DUPLICATE_SUBMISSION': 2,
        'EX_EMPLOYEE_REHIRE': 3,
        'PLACEHOLDER_VALUE': 4
    };
    matches.sort((a, b) => (priorityOrder[a.matchType] || 99) - (priorityOrder[b.matchType] || 99));

    const primary = matches[0];
    const detailsSummary = matches.length === 1
        ? primary.details
        : `${matches.length} Warnings/Conflicts Detected: ` + matches.map(m => m.matchType === 'PLACEHOLDER_VALUE' ? `${m.matchedField} (${m.matchedValue} - Placeholder)` : `${m.matchedField} (${m.matchedValue}) matches ${m.matchedName || m.matchedId}`).join('; ');

    const cleanMatches = matches.map(m => {
        const item: any = {
            matchType: m.matchType,
            matchedField: m.matchedField,
            matchedValue: m.matchedValue,
            details: m.details
        };
        if (m.matchedId !== undefined) item.matchedId = m.matchedId;
        if (m.matchedName !== undefined) item.matchedName = m.matchedName;
        if (m.matchedSite !== undefined) item.matchedSite = m.matchedSite;
        if (m.relievingDate !== undefined) item.relievingDate = m.relievingDate;
        if (m.relievingReason !== undefined) item.relievingReason = m.relievingReason;
        if (m.submissionId !== undefined) item.submissionId = m.submissionId;
        if (m.submissionStatus !== undefined) item.submissionStatus = m.submissionStatus;
        return item;
    });

    const res: DuplicateCheckResult = {
        isDuplicate: true,
        matches: cleanMatches,
        matchType: primary.matchType,
        matchedField: primary.matchedField,
        matchedValue: primary.matchedValue,
        details: detailsSummary
    };

    if (primary.matchedId !== undefined) res.matchedId = primary.matchedId;
    if (primary.matchedName !== undefined) res.matchedName = primary.matchedName;
    if (primary.matchedSite !== undefined) res.matchedSite = primary.matchedSite;
    if (primary.relievingDate !== undefined) res.relievingDate = primary.relievingDate;
    if (primary.relievingReason !== undefined) res.relievingReason = primary.relievingReason;
    if (primary.submissionId !== undefined) res.submissionId = primary.submissionId;
    if (primary.submissionStatus !== undefined) res.submissionStatus = primary.submissionStatus;

    return res;
};

export const submitEmployeeForm = async (
    formData: any,
    originalFormSections: any[],
    linkedUid?: string,
    onProgress?: (fieldId: string, status: 'loading' | 'done' | 'error', percent?: number) => void,
    legacyImportId?: string,
    selectedPasswordHash?: string,
    draftId?: string
) => {
    await ensureAuthenticated();
    try {
        const submissionId = (draftId && isPortalId(draftId)) ? draftId : await getNextSubmissionId();
        const processedFormData = { ...formData };
        const employeeName = getApplicantName(formData, originalFormSections) || 'Unknown Applicant';
        const applicantEmail = getApplicantEmail(formData, originalFormSections);

        // 0. ABSOLUTE GLOBAL EMAIL CHECK (MANDATORY)
        onProgress?.('validation', 'loading');
        if (applicantEmail) {
            const isUnique = await checkEmailUniquenessGlobal(applicantEmail);
            if (!isUnique) {
                onProgress?.('validation', 'error');
                throw new Error("This email address is already registered in our system. Please use a unique email address.");
            }
        }

        // 0.5. LINKED UID CHECK (Prevent duplicate submissions from same Google Account)
        if (linkedUid) {
            const candidateEmail = auth.currentUser?.email || applicantEmail || null;
            const uidConflict = await checkLinkedUidExists(linkedUid, candidateEmail);
            if (uidConflict) {
                onProgress?.('validation', 'error');
                throw new Error(`Google Account Error: ${uidConflict}`);
            }
        }
        onProgress?.('validation', 'done');

        // Extract all file field IDs to initialize progress accurately in the UI
        const fileFieldIds = new Set(
            originalFormSections.flatMap(s => s.fields || [])
                .filter(f => f.type === FieldType.FILE_UPLOAD)
                .map(f => f.id)
        );

        // Pre-initialize progress: mark already uploaded draft files as done so they check green instantly
        for (const fieldId of fileFieldIds) {
            const value = formData[fieldId];
            if (value) {
                const isAlreadyUploaded = (typeof value === 'string' && value.trim() !== '') || 
                    (typeof value === 'object' && value !== null && 'storagePath' in value);
                
                if (isAlreadyUploaded && !(value instanceof File)) {
                    onProgress?.(fieldId, 'done', 100);
                } else {
                    onProgress?.(fieldId, 'loading', 0);
                }
            } else {
                // If it is empty, mark it as done immediately!
                onProgress?.(fieldId, 'done', 100);
            }
        }

        // Helper for inline filename extractor
        const getCleanFileName = (path: string): string => {
            if (!path) return '';
            const parts = path.split('/');
            const lastPart = parts[parts.length - 1];
            const underscoreIdx = lastPart.indexOf('_');
            if (underscoreIdx !== -1) {
                return lastPart.substring(underscoreIdx + 1);
            }
            return lastPart;
        };

        // 1. Firebase Storage (PRIMARY) - Upload in parallel to speed up candidate submission
        const storagePromises: Promise<void>[] = [];
        for (const [key, value] of Object.entries(formData)) {
            if (fileFieldIds.has(key) && value) {
                if (value instanceof File) {
                    onProgress?.(key, 'loading', 0);
                    const uploadPromise = (async () => {
                        try {
                            // Upload to Firebase Storage (takes 0% to 100% progress)
                            const firebaseUrl = await uploadSubmissionDocument(
                                key,
                                value,
                                (percent) => onProgress?.(key, 'loading', Math.round(percent))
                            );
                            log.log(`[STORAGE] ✅ Uploaded ${value.name} to Firebase Storage.`);
                            
                            // Save with empty driveUrl initially (will be backfilled by background task)
                            processedFormData[key] = {
                                storagePath: firebaseUrl,
                                driveUrl: ''
                            };
                            onProgress?.(key, 'done', 100);
                        } catch (uploadErr) {
                            onProgress?.(key, 'error');
                            throw uploadErr;
                        }
                    })();
                    storagePromises.push(uploadPromise);
                } else if (typeof value === 'string' && value.trim() !== '') {
                    // Pre-existing draft file path, leave it as is
                    processedFormData[key] = {
                        storagePath: value,
                        driveUrl: ''
                    };
                    onProgress?.(key, 'done', 100);
                } else if (typeof value === 'object' && value !== null && 'storagePath' in value) {
                    // Already a combined object, keep it
                    processedFormData[key] = value;
                    onProgress?.(key, 'done', 100);
                }
            }
        }
        // Wait for all Firebase Storage uploads to complete
        await Promise.all(storagePromises);

        // Find DOB field for password generation
        const dobField = originalFormSections.flatMap((s: any) => s.fields || []).find((f: any) => f.label?.toLowerCase().includes('birth'));
        const dobValue = dobField ? formData[dobField.id] : undefined;

        onProgress?.('finalizing', 'loading');

        // Check for referral invite token from all sources (formData, draft, session/local storage)
        const referralInviteId = (formData as any)?.__referralInviteId ||
            (formData as any)?.referralInviteId ||
            (typeof window !== 'undefined' ? (sessionStorage.getItem('referralInviteId') || localStorage.getItem('referralInviteId') || null) : null);
        let recruitedBy = null;
        let recruitedByName = null;

        if (referralInviteId) {
            try {
                const inviteRef = doc(db, 'referral_invites', referralInviteId);
                const inviteSnap = await getDoc(inviteRef);
                if (inviteSnap.exists()) {
                    const inviteData = inviteSnap.data();
                    recruitedBy = inviteData.createdBy || null;
                    recruitedByName = inviteData.createdByName || null;
                }
            } catch (e) {
                console.error("Error fetching referral details for submission:", e);
            }
        }

        // 0.6 DUPLICATE APPLICANT & EX-EMPLOYEE REHIRE CHECK
        const aadhaarNumber = getApplicantAadhaar(formData, originalFormSections);
        const panNumber = getApplicantPAN(formData, originalFormSections);
        const uanNumber = getApplicantUAN(formData, originalFormSections);
        const phoneNumber = getApplicantPhone(formData, originalFormSections);

        const duplicateCheckResult = await checkApplicantDuplicates({
            aadhaar: aadhaarNumber,
            pan: panNumber,
            uan: uanNumber,
            phone: phoneNumber,
            currentSubId: submissionId
        });

        if (duplicateCheckResult.isDuplicate) {
            log.warn(`[DUPLICATE_CHECK] Submission ${submissionId} matched duplicate/rehire:`, duplicateCheckResult);
        }

        // Clean up internal tracking metadata from processedFormData
        delete processedFormData.__referralInviteId;
        delete processedFormData.referralInviteId;

        const authProvider = linkedUid ? 'google' : 'manual';
        const siteName = (formData as any).siteName || null;
        const siteId = (formData as any).siteId || null;

        const submission: any = {
            status: 'Pending Review',
            currentLevel: 1,
            formData: processedFormData,
            approvalHistory: [],
            timestamp: new Date().toISOString(),
            originalFormSections: originalFormSections,
            applicantName: employeeName,
            siteName: siteName || null,
            siteId: siteId || null,
            driveFolderName: `${submissionId} - ${employeeName}`,
            driveBackupStatus: 'pending',
            driveBackupAt: null,
            googleFormSyncStatus: 'pending',
            googleFormSyncedAt: null,
            legacyImportId: legacyImportId || null,
            linkedUid: auth.currentUser?.uid || null,
            authProvider: authProvider,
            inviteId: referralInviteId,
            recruitedBy,
            recruitedByName,
            aadhaarNumber: aadhaarNumber || null,
            panNumber: panNumber || null,
            uanNumber: uanNumber || null,
            phoneNumber: phoneNumber || null,
            duplicateCheck: duplicateCheckResult,
        };

        if (authProvider === 'manual') {
            if (selectedPasswordHash) {
                submission.passwordHash = selectedPasswordHash;
                submission.isDefaultPassword = false;
            } else {
                const defaultRawPassword = generateDefaultPassword(employeeName, dobValue) || 'TEMP1234';
                const { hashPassword } = await import('../utils/cryptoUtils');
                submission.passwordHash = await hashPassword(defaultRawPassword);
                submission.isDefaultPassword = true;
            }
        }
        
        // Also capture the actual Google email if available in the current auth context
        if (linkedUid && auth.currentUser?.email) {
            submission.linkedGoogleEmail = auth.currentUser.email;
        }

        // Firestore does not allow `undefined` values. Recursively remove them.
        const cleanUndefined = (obj: any) => {
            Object.keys(obj).forEach(key => {
                if (obj[key] && typeof obj[key] === 'object') {
                    cleanUndefined(obj[key]);
                } else if (obj[key] === undefined) {
                    delete obj[key];
                }
            });
        };
        cleanUndefined(submission);

        const docRef = doc(db, SUBMISSIONS_COLLECTION, submissionId);
        await setDoc(docRef, submission);

        // Clean up draft submission so candidate never remains in draft list once submitted
        try {
            const draftsToDelete = new Set<string>();
            if (draftId) draftsToDelete.add(draftId);
            if (submissionId && submissionId !== draftId) draftsToDelete.add(submissionId);

            // Clean up drafts by linkedUid/ownerUid
            if (linkedUid) {
                const qOwner = query(collection(db, DRAFTS_COLLECTION), where('ownerUid', '==', linkedUid), limit(10));
                const snapOwner = await getDocs(qOwner);
                snapOwner.docs.forEach(d => draftsToDelete.add(d.id));
            }
            if (auth.currentUser?.uid && auth.currentUser.uid !== linkedUid) {
                const qAuth = query(collection(db, DRAFTS_COLLECTION), where('ownerUid', '==', auth.currentUser.uid), limit(10));
                const snapAuth = await getDocs(qAuth);
                snapAuth.docs.forEach(d => draftsToDelete.add(d.id));
            }
            if (applicantEmail) {
                const qEmail = query(collection(db, DRAFTS_COLLECTION), where('ownerEmail', '==', applicantEmail), limit(10));
                const snapEmail = await getDocs(qEmail);
                snapEmail.docs.forEach(d => draftsToDelete.add(d.id));
            }

            for (const dId of draftsToDelete) {
                try {
                    await deleteDoc(doc(db, DRAFTS_COLLECTION, dId));
                    log.log(`[SUBMIT] Successfully removed draft ${dId} from draft_submissions upon final submission.`);
                } catch (delErr) {
                    console.warn(`[SUBMIT] Could not delete draft ${dId}:`, delErr);
                }
            }
        } catch (cleanupErr) {
            console.warn('[SUBMIT] Non-fatal draft cleanup error:', cleanupErr);
        }

        // Mark finalizing step as done immediately (candidate never waits)
        onProgress?.('finalizing', 'done');

        // Detached background pipeline: Auto-sync to Google Drive + Google Form in background
        setTimeout(async () => {
            try {
                log.log(`[BACKGROUND_PIPELINE] Starting background Drive + Google Form sync for ${submissionId}...`);
                await syncDriveFolder(submissionId);
                log.log(`[BACKGROUND_PIPELINE] ✅ Completed background Drive + Google Form sync for ${submissionId}`);
            } catch (syncErr) {
                console.warn(`[BACKGROUND_PIPELINE] Background sync error for ${submissionId}:`, syncErr);
            }
        }, 100);

        return submissionId;
    } catch (error) {
        log.error("Error submitting form:", error);
        throw error;
    }
};

export const syncSubmissionToGoogleForm = async (submissionId: string): Promise<{ success: boolean; error?: string }> => {
    try {
        const subDocRef = doc(db, SUBMISSIONS_COLLECTION, submissionId);
        const snap = await getDoc(subDocRef);
        if (!snap.exists()) {
            throw new Error(`Submission ${submissionId} not found.`);
        }
        const data = snap.data() as any;
        const formData = data.formData || data.data || {};
        const email = data.linkedGoogleEmail || data.email || null;
        const formPayload = {
            ...formData,
            siteName: data.siteName || formData.siteName
        };

        await submitToGoogleForm(formPayload, email);

        await updateDoc(subDocRef, {
            googleFormSyncStatus: 'synced',
            googleFormSyncedAt: new Date().toISOString()
        });

        return { success: true };
    } catch (err: any) {
        console.error("Manual Google Form sync failed:", err);
        try {
            const subDocRef = doc(db, SUBMISSIONS_COLLECTION, submissionId);
            await updateDoc(subDocRef, {
                googleFormSyncStatus: 'failed',
                googleFormSyncError: err.message || 'Manual sync failed'
            });
        } catch (e) {}
        return { success: false, error: err.message };
    }
};

export const getSubmissions = async (status?: string) => {
    let q = query(collection(db, SUBMISSIONS_COLLECTION));

    if (status) {
        q = query(collection(db, SUBMISSIONS_COLLECTION), where("status", "==", status));
    }

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as OnboardingSubmission));
};

export const getPaginatedSubmissions = async (
    status: string,
    pageSize: number = 20,
    lastDoc?: QueryDocumentSnapshot,
    siteFieldId?: string,
    siteValue?: string | string[],
    searchTerm?: string,
    searchField: string = 'applicantName'
) => {
    // If not super-admin ('ALL') and no allowed sites provided, return empty immediately
    if (siteValue !== 'ALL' && (!Array.isArray(siteValue) || siteValue.length === 0)) {
        return { submissions: [], hasMore: false, lastDoc: null };
    }

    // Determine if we need to do in-memory filtering
    const hasSiteFilter = siteFieldId && siteValue && siteValue !== 'ALL';
    const hasSearchFilter = searchTerm && searchTerm.trim() !== '';

    if (hasSiteFilter || hasSearchFilter) {
        // Fetch all documents for this status ordered by timestamp to filter in-memory
        const baseQuery = query(
            collection(db, SUBMISSIONS_COLLECTION),
            where("status", "==", status),
            orderBy("timestamp", "desc")
        );
        const snapshot = await getDocs(baseQuery);
        
        let allSubmissions = snapshot.docs.map(doc => {
            const sub = doc.data() as any;
            return {
                id: doc.id,
                ...sub,
                data: { ...(sub.formData || {}), ...(sub.data || {}) },
                _doc: doc // Keep reference to doc for pagination cursor
            } as any;
        });

        // 1. Apply Site Filter
        if (hasSiteFilter) {
            const allowed = Array.isArray(siteValue) ? siteValue : [siteValue];
            
            // Fetch sites to resolve site ID <-> site Name mapping for backward compatibility
            let sitesList: { id: string; name: string }[] = [];
            try {
                const sitesSnap = await getDoc(doc(db, 'settings', 'sites'));
                if (sitesSnap.exists()) {
                    const rawSites = (sitesSnap.data()?.sites as any[]) || [];
                    sitesList = rawSites.map(s => ({ id: s.id, name: s.name || '' }));
                }
            } catch (e) {
                console.warn("Failed to load sites setting:", e);
            }

            allSubmissions = allSubmissions.filter(sub => {
                const val = sub.data?.[siteFieldId];
                if (!val) return false;
                
                // Case A: The stored value is already a site ID
                if (allowed.includes(val)) return true;
                
                // Case B: The stored value is a site Name (legacy submission)
                // Find if the site with this name is allowed
                const matchedSite = sitesList.find(s => s.name.toLowerCase() === String(val).toLowerCase());
                if (matchedSite && allowed.includes(matchedSite.id)) return true;

                // Case C: Fallback check if the stored value matches any allowed site name directly
                const allowedNames = sitesList.filter(s => allowed.includes(s.id)).map(s => s.name.toLowerCase());
                if (allowedNames.includes(String(val).toLowerCase())) return true;

                return false;
            });
        }

        // 2. Apply Search Filter
        if (hasSearchFilter) {
            const term = searchTerm.trim().toLowerCase();
            allSubmissions = allSubmissions.filter(sub => {
                const targetValue = sub[searchField] || sub.data?.[searchField] || '';
                const recruiter = sub.recruitedByName || '';
                const inviteCode = sub.inviteId || '';
                return String(targetValue).toLowerCase().includes(term) ||
                    recruiter.toLowerCase().includes(term) ||
                    inviteCode.toLowerCase().includes(term);
            });
        }

        // 3. In-Memory Pagination Slicing
        let startIndex = 0;
        if (lastDoc) {
            startIndex = allSubmissions.findIndex(sub => sub.id === lastDoc.id) + 1;
        }

        const slicedSubmissions = allSubmissions.slice(startIndex, startIndex + pageSize);
        const finalSubmissions = slicedSubmissions.map(sub => {
            const { _doc, ...cleanSub } = sub;
            return cleanSub as SubmittedFormData;
        });

        const lastSubDoc = slicedSubmissions[slicedSubmissions.length - 1]?._doc || null;

        return {
            submissions: finalSubmissions,
            lastDoc: lastSubDoc,
            hasMore: startIndex + pageSize < allSubmissions.length
        };
    }

    // Default Case: No filters, use direct Firestore query & pagination
    let q = query(
        collection(db, SUBMISSIONS_COLLECTION),
        where("status", "==", status),
        orderBy("timestamp", "desc"),
        limit(pageSize)
    );

    if (lastDoc) {
        q = query(
            collection(db, SUBMISSIONS_COLLECTION),
            where("status", "==", status),
            orderBy("timestamp", "desc"),
            startAfter(lastDoc),
            limit(pageSize)
        );
    }

    const snapshot = await getDocs(q);
    const submissions = snapshot.docs.map(doc => {
        const sub = doc.data() as any;
        return {
            id: doc.id,
            ...sub,
            data: { ...(sub.formData || {}), ...(sub.data || {}) }
        } as SubmittedFormData;
    });

    return {
        submissions,
        lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
        hasMore: snapshot.docs.length === pageSize
    };
};

export const getPaginatedEmployees = async (
    viewMode: 'ACTIVE' | 'PENDING' | 'RELIEVED' | 'RECYCLE_BIN' | 'BLOCKED',
    pageSize: number = 25,
    lastDoc?: QueryDocumentSnapshot,
    filterField?: string,
    filterValue?: any,
    searchTerm?: string,
    searchField: string = 'applicantName',
    allowedSiteIds?: string[] | 'ALL'
) => {
    // If not super-admin ('ALL') and no allowed sites provided, return empty immediately
    if (allowedSiteIds !== 'ALL' && (!Array.isArray(allowedSiteIds) || allowedSiteIds.length === 0)) {
        return { employees: [], hasMore: false, lastDoc: null };
    }

    let q;

    // Base Constraints based on View Mode
    const constraints: any[] = [];
    const isRestrictedSites = allowedSiteIds && allowedSiteIds !== 'ALL' && Array.isArray(allowedSiteIds) && allowedSiteIds.length > 0;
    const hasSiteFilter = Boolean(filterField && filterValue !== undefined && filterValue !== 'ALL');

    if (viewMode === 'ACTIVE') {
        constraints.push(where("isActive", "==", true));
        // Only use Firestore 'in' if sites are not restricted, to prevent combining 'in' with 'array-contains-any'
        if (!isRestrictedSites && !hasSiteFilter) {
            constraints.push(where("needsProfileCompletion", "in", [false, null]));
        }
    } else if (viewMode === 'PENDING') {
        constraints.push(where("needsProfileCompletion", "==", true));
        constraints.push(where("isActive", "==", true)); // Assuming pending employees are logically "Active" but incomplete
    } else if (viewMode === 'RELIEVED') {
        constraints.push(where("isRelieved", "==", true));
        constraints.push(where("isActive", "==", false));
    } else if (viewMode === 'BLOCKED') {
        constraints.push(where("isBlocked", "==", true));
        constraints.push(where("isActive", "==", true));
    } else if (viewMode === 'RECYCLE_BIN') {
        constraints.push(where("deletedAt", ">=", "0")); // Assumes ISO date string
        constraints.push(orderBy("deletedAt", "desc"));
    }

    // Apply site scoping filter if restricted
    // Note: If a specific site filter is already active and valid, we don't need array-contains-any
    if (isRestrictedSites && !hasSiteFilter) {
        constraints.push(where("assignedSiteIds", "array-contains-any", (allowedSiteIds as string[]).slice(0, 10)));
    }

    // Apply Search or Filter
    const topLevelFields = ['employeeId', 'applicantName', 'joiningDate', 'designation', 'currentSiteId', 'siteName', 'subUnitId', 'subUnitName', 'isActive', 'needsProfileCompletion', 'profileStatus'];
    const getFieldPath = (field: string) => topLevelFields.includes(field) ? field : `data.${field}`;

    if (searchTerm && searchTerm.trim() !== '') {
        const term = searchTerm.trim();
        const searchPath = getFieldPath(searchField);
        q = query(
            collection(db, EMPLOYEES_COLLECTION),
            where(searchPath, ">=", term),
            where(searchPath, "<=", term + '\uf8ff'),
            ...constraints,
            limit(pageSize)
        );
    } else if (filterField && filterValue !== undefined && filterValue !== 'ALL') {
        const fieldPath = getFieldPath(filterField);
        q = query(
            collection(db, EMPLOYEES_COLLECTION),
            where(fieldPath, "==", filterValue),
            ...constraints,
            limit(pageSize)
        );
    } else {
        q = query(
            collection(db, EMPLOYEES_COLLECTION),
            ...constraints,
            limit(pageSize)
        );
    }

    if (lastDoc) {
        if (searchTerm && searchTerm.trim() !== '') {
            const term = searchTerm.trim();
            const searchPath = getFieldPath(searchField);
            q = query(
                collection(db, EMPLOYEES_COLLECTION),
                where(searchPath, ">=", term),
                where(searchPath, "<=", term + '\uf8ff'),
                ...constraints,
                startAfter(lastDoc),
                limit(pageSize)
            );
        } else if (filterField && filterValue !== undefined && filterValue !== 'ALL') {
            const fieldPath = getFieldPath(filterField);
            q = query(
                collection(db, EMPLOYEES_COLLECTION),
                where(fieldPath, "==", filterValue),
                ...constraints,
                startAfter(lastDoc),
                limit(pageSize)
            );
        } else {
            q = query(
                collection(db, EMPLOYEES_COLLECTION),
                ...constraints,
                startAfter(lastDoc),
                limit(pageSize)
            );
        }
    }

    let snapshot;
    try {
        snapshot = await getDocs(q);
    } catch (err: any) {
        // If Firestore rejects a complex compound constraint (e.g. inequality with array-contains-any or in),
        // fallback to running simple range search query and filter site/status constraints in memory
        log.warn("getPaginatedEmployees Firestore compound query error, falling back to memory filtering:", err.message);
        if (searchTerm && searchTerm.trim() !== '') {
            const term = searchTerm.trim();
            const searchPath = getFieldPath(searchField);
            const fallbackQ = query(
                collection(db, EMPLOYEES_COLLECTION),
                where(searchPath, ">=", term),
                where(searchPath, "<=", term + '\uf8ff'),
                limit(pageSize * 3)
            );
            snapshot = await getDocs(fallbackQ);
        } else {
            const fallbackQ = query(
                collection(db, EMPLOYEES_COLLECTION),
                where("isActive", "==", viewMode === 'ACTIVE' || viewMode === 'PENDING' || viewMode === 'BLOCKED'),
                limit(pageSize * 3)
            );
            snapshot = await getDocs(fallbackQ);
        }
    }

    let rawDocs = snapshot.docs;

    // Apply memory filters
    rawDocs = rawDocs.filter(doc => {
        const emp = doc.data() as any;
        if (viewMode === 'ACTIVE' && (emp.isActive === false || emp.needsProfileCompletion)) return false;
        if (viewMode === 'PENDING' && !emp.needsProfileCompletion) return false;
        if (viewMode === 'RELIEVED' && !emp.isRelieved) return false;
        if (viewMode === 'BLOCKED' && !emp.isBlocked) return false;
        if (viewMode === 'RECYCLE_BIN' && !emp.deletedAt) return false;

        if (allowedSiteIds && allowedSiteIds !== 'ALL' && Array.isArray(allowedSiteIds) && allowedSiteIds.length > 0) {
            const assigned = Array.isArray(emp.assignedSiteIds) ? emp.assignedSiteIds : [];
            const matchesSite = assigned.some((s: string) => allowedSiteIds.includes(s)) || allowedSiteIds.includes(emp.currentSiteId);
            if (!matchesSite) return false;
        }

        if (filterField && filterValue !== undefined && filterValue !== 'ALL') {
            const empVal = topLevelFields.includes(filterField) ? emp[filterField] : emp.data?.[filterField];
            if (empVal !== filterValue) return false;
        }

        return true;
    });

    const employees = rawDocs.slice(0, pageSize).map(doc => {
        const emp = doc.data() as FirestoreEmployee;
        return {
            id: doc.id,
            ...emp,
            status: 'Approved', // Ensure status exists for components expecting SubmittedFormData
            data: emp.data || (emp as any).profileData || {} // emp.data for bulk imports, profileData for form approvals
        } as unknown as SubmittedFormData;
    });

    return {
        employees,
        lastDoc: rawDocs[Math.min(rawDocs.length - 1, pageSize - 1)] || null,
        hasMore: rawDocs.length > pageSize
    };
};

export const checkEmployeeIdExists = async (employeeId: string) => {
    const q = query(collection(db, EMPLOYEES_COLLECTION), where("employeeId", "==", employeeId), limit(1));
    const snap = await getDocs(q);
    return !snap.empty;
};

// Check if a Google UID or email is already linked to an existing employee or submission
export const checkLinkedUidExists = async (uid: string, email: string | null): Promise<string | null> => {
    try {
        // 1. Direct document checks for Admin/Staff UID
        try {
            const userDocRef = doc(db, 'users', uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                return 'This account is already registered as an administrator. Please use a candidate email address.';
            }
        } catch (e) {
            // Permission restricted for non-matching UID; safe to continue
        }

        try {
            const staffDocRef = doc(db, 'staff_accounts', uid);
            const staffDocSnap = await getDoc(staffDocRef);
            if (staffDocSnap.exists()) {
                return 'This account is already registered as staff. Please use a candidate email address.';
            }
        } catch (e) {
            // Permission restricted for non-matching UID; safe to continue
        }

        // 2. Direct checks for self UID in employees/submissions
        try {
            const uidQuery = query(collection(db, EMPLOYEES_COLLECTION), where('uid', '==', uid), limit(1));
            const uidSnap = await getDocs(uidQuery);
            const activeEmps = uidSnap.docs.filter(doc => !doc.data().deletedAt);
            if (activeEmps.length > 0) {
                return 'This email address is already registered. Please use a different email address.';
            }
        } catch (e) {
            // Evaluated by server-side Cloud Function below
        }

        try {
            const subQuery = query(collection(db, SUBMISSIONS_COLLECTION), where('linkedUid', '==', uid), limit(1));
            const subSnap = await getDocs(subQuery);
            const activeSubs = subSnap.docs.filter(doc => {
                const data = doc.data();
                return !data.deletedAt && data.status !== 'Rejected' && data.status !== 'Deleted';
            });
            if (activeSubs.length > 0) {
                return 'This email address is already registered. Please use a different email address.';
            }
        } catch (e) {
            // Evaluated by server-side Cloud Function below
        }

        // 3. ABSOLUTE GLOBAL IDENTITY CHECK (Enforced via Cloud Function with Admin privileges)
        const cleanEmail = email ? email.trim() : '';
        if (cleanEmail) {
            const { checkEmailUniquenessGlobal } = await import('./authService');
            const isUnique = await checkEmailUniquenessGlobal(cleanEmail, { excludeAdmin: false, uid });
            if (!isUnique) {
                return 'This email address is already registered. Please use a different email address.';
            }
        }

        return null; // No conflict
    } catch (err: any) {
        log.warn('checkLinkedUidExists non-fatal warning:', err);
        return null; // Do not falsely block candidate on transient client error
    }
};

export const updateSubmissionStatus = async (
    submissionId: string,
    status: 'Pending Review' | 'Approved' | 'Rejected',
    adminComments?: string,
    actorName?: string,
    assignedEmployeeId?: string,
    newLevel?: number,
    actorRole?: string,
    profileCompletionData?: {
        profileCompletionStatus: 'COMPLETE' | 'INCOMPLETE';
        pendingProfileFields?: string[];
        pendingProfileNote?: string;
    },
    customJoiningDate?: string,
    customRecruiter?: { id: string | null; name: string | null }
) => {
    const submissionRef = doc(db, SUBMISSIONS_COLLECTION, submissionId);

    const submissionSnap = await getDoc(submissionRef);
    if (!submissionSnap.exists()) throw new Error("Submission not found");
    const currentData = submissionSnap.data() as OnboardingSubmission;
    const currentHistory = currentData.approvalHistory || [];

    // DUPLICATE ID CHECK
    if (assignedEmployeeId) {
        const exists = await checkEmployeeIdExists(assignedEmployeeId);
        if (exists) {
            throw new Error(`Employee ID "${assignedEmployeeId}" is already taken. Please use a unique ID.`);
        }
        if (currentData.duplicateCheck?.isDuplicate) {
            const dup = currentData.duplicateCheck;
            const curForm = { ...(currentData.formData || {}), ...((currentData as any).data || {}) };
            const checkMatchStillActive = (matchedField?: string, matchedValue?: string): boolean => {
                if (!matchedField || !matchedValue) return true;
                let curVal: string | null | undefined = null;
                if (matchedField === 'PAN Card') {
                    curVal = currentData.panNumber || curForm['da8edb18-4bed-41ca-8233-2280b97dac8d'];
                    return !(curVal && String(curVal).trim().toUpperCase() !== String(matchedValue).trim().toUpperCase());
                }
                if (matchedField === 'Aadhaar Number') {
                    curVal = currentData.aadhaarNumber;
                    return !(curVal && String(curVal).trim() !== String(matchedValue).trim());
                }
                if (matchedField === 'Phone Number') {
                    curVal = currentData.phoneNumber;
                    return !(curVal && String(curVal).trim() !== String(matchedValue).trim());
                }
                if (matchedField === 'UAN Number') {
                    curVal = currentData.uanNumber;
                    return !(curVal && String(curVal).trim() !== String(matchedValue).trim());
                }
                return true;
            };

            const rawMatches = dup.matches && dup.matches.length > 0
                ? dup.matches
                : [{
                    matchType: dup.matchType || 'DUPLICATE_SUBMISSION',
                    matchedField: dup.matchedField || 'PAN Card',
                    matchedValue: dup.matchedValue || '',
                    matchedId: dup.matchedId,
                    matchedName: dup.matchedName,
                    submissionId: dup.submissionId,
                    submissionStatus: dup.submissionStatus
                }];

            const activeMatches = rawMatches.filter(m => checkMatchStillActive(m.matchedField, m.matchedValue));

            if (activeMatches.some(m => m.matchType === 'DUPLICATE_SUBMISSION' || m.matchType === 'EXISTING_ACTIVE_EMPLOYEE')) {
                throw new Error(`Cannot Assign ID: Duplicate record detected (${activeMatches.map(m => `${m.matchedField} [${m.matchedValue}]`).join(', ')}). Resolving or rejecting the duplicate submission is required before assigning an Employee ID.`);
            }
        }
    }

    // Add to approval history
    const historyEntry = {
        level: newLevel ? (newLevel - 1) : (currentData.currentLevel || 1), // Use newLevel if provided, else current level
        status: status,
        actionBy: actorName || 'Admin',
        actionByRole: actorRole || 'Admin',
        comments: adminComments || '',
        timestamp: new Date().toISOString()
    };

    const updates: any = {
        status,
        approvalHistory: [...currentHistory, historyEntry],
        lastUpdated: new Date().toISOString()
    };

    if (assignedEmployeeId) {
        updates.employeeId = assignedEmployeeId.trim();
    }

    if (newLevel) {
        updates.currentLevel = newLevel;
    }

    if (profileCompletionData) {
        updates.profileCompletionStatus = profileCompletionData.profileCompletionStatus;
        updates.pendingProfileFields = profileCompletionData.pendingProfileFields || [];
        updates.pendingProfileNote = profileCompletionData.pendingProfileNote || '';
        updates.needsProfileCompletion = profileCompletionData.profileCompletionStatus === 'INCOMPLETE';
    }

    if (customRecruiter !== undefined) {
        updates.recruitedBy = customRecruiter.id || null;
        updates.recruitedByName = customRecruiter.name || null;
        if (!customRecruiter.id) {
            updates.inviteId = null;
        }
    }

    // Update submission
    // If approved, create employee record and update submission with all fields at once
    if (status === 'Approved') {
        // submissionSnap is already fetched above
        if (submissionSnap.exists()) {
            const data = submissionSnap.data() as OnboardingSubmission;

            // 0. DOCUMENT-LEVEL GATEKEEPER CHECK: Existing document duplicateCheck check
            if (currentData.duplicateCheck?.isDuplicate) {
                if (currentData.duplicateCheck.matchType === 'EXISTING_ACTIVE_EMPLOYEE') {
                    throw new Error(`Cannot Approve: Active employee "${currentData.duplicateCheck.matchedName}" (${currentData.duplicateCheck.matchedId}) already exists with the same ${currentData.duplicateCheck.matchedField} (${currentData.duplicateCheck.matchedValue}). Duplicate employment under multiple IDs is not permitted.`);
                }
                if (currentData.duplicateCheck.matchType === 'DUPLICATE_SUBMISSION') {
                    throw new Error(`Cannot Approve: Duplicate submission detected! Another submission (${currentData.duplicateCheck.submissionId}) exists matching this applicant's ${currentData.duplicateCheck.matchedField} (${currentData.duplicateCheck.matchedValue}) with status "${currentData.duplicateCheck.submissionStatus || 'Pending'}". Assigning Employee ID and final onboarding are strictly blocked for duplicate submissions.`);
                }
            }

            // 0.5. LIVE GATEKEEPER CHECK: Verify no active employee exists with this Aadhaar / PAN / UAN / Phone
            const liveAadhaar = data.aadhaarNumber || getApplicantAadhaar(data.formData, data.originalFormSections);
            const livePan = data.panNumber || getApplicantPAN(data.formData, data.originalFormSections);
            const liveUan = data.uanNumber || getApplicantUAN(data.formData, data.originalFormSections);
            const livePhone = data.phoneNumber || getApplicantPhone(data.formData, data.originalFormSections);

            const liveDuplicateCheck = await checkApplicantDuplicates({
                aadhaar: liveAadhaar,
                pan: livePan,
                uan: liveUan,
                phone: livePhone,
                currentSubId: submissionId
            });

            if (liveDuplicateCheck.isDuplicate) {
                const activeEmpMatch = liveDuplicateCheck.matches?.find(m => m.matchType === 'EXISTING_ACTIVE_EMPLOYEE') || (liveDuplicateCheck.matchType === 'EXISTING_ACTIVE_EMPLOYEE' ? liveDuplicateCheck : null);
                if (activeEmpMatch) {
                    throw new Error(`Cannot Approve: Active employee "${activeEmpMatch.matchedName}" (${activeEmpMatch.matchedId}) already exists with the same ${activeEmpMatch.matchedField} (${activeEmpMatch.matchedValue}). Duplicate employment under multiple IDs is not permitted.`);
                }
                const dupSubMatch = liveDuplicateCheck.matches?.find(m => m.matchType === 'DUPLICATE_SUBMISSION') || (liveDuplicateCheck.matchType === 'DUPLICATE_SUBMISSION' ? liveDuplicateCheck : null);
                if (dupSubMatch) {
                    const matchSummary = liveDuplicateCheck.matches && liveDuplicateCheck.matches.length > 1
                        ? liveDuplicateCheck.matches.map(m => `${m.matchedField} (${m.matchedValue})`).join(', ')
                        : `${dupSubMatch.matchedField} (${dupSubMatch.matchedValue})`;
                    throw new Error(`Cannot Approve: Duplicate submission detected! Conflicts on ${matchSummary}. Assigning Employee ID and final onboarding are strictly blocked for duplicate submissions.`);
                }
            }

            // Require assigned Employee ID for final approval
            if (!assignedEmployeeId || !assignedEmployeeId.trim()) {
                throw new Error("Final Approval Error: A valid Employee ID in the format HY123456 is required. The system will not auto-generate arbitrary employee IDs.");
            }
            const empId = assignedEmployeeId.trim().toUpperCase();
            const employeeName = (data.applicantName || getApplicantName(data.formData, data.originalFormSections) || 'Unknown').trim();
            const newFolderName = `${empId} - ${employeeName}`;

            // ============================================================
            // DRIVE-FIRST: Rename + Move folder BEFORE creating employee
            // If this fails, approval is blocked to prevent orphaned records
            // ============================================================
            const oldFolderName = (data.driveFolderName || `${submissionId} - ${employeeName}`).trim();
            try {
                await approveEmployeeFolder(oldFolderName, newFolderName);
                log.log(`[DRIVE_SYNC] Folder approved: "${oldFolderName}" → "${newFolderName}" (Pending → Active)`);
            } catch (driveErr: any) {
                console.error("[DRIVE_SYNC_ERROR] Folder approve (rename+move) failed:", driveErr);
                throw new Error(`Drive folder sync failed. The folder "${oldFolderName}" could not be moved to Active Employees. Please check Google Drive and try again. (${driveErr.message})`);
            }

            // ============================================================
            // FIRESTORE: Create employee record ONLY after Drive succeeds
            // ============================================================
            const resolvedJoiningDate = customJoiningDate ? new Date(customJoiningDate).toISOString() : new Date().toISOString();
            const initialSiteId = data.formData.siteId || 'Unassigned';
            const initialAssignment: EmployeeAssignment = {
                id: uuidv4(),
                siteId: initialSiteId,
                designation: data.formData.designation || 'Staff',
                type: 'PRIMARY',
                joiningDate: resolvedJoiningDate,
                status: 'Active'
            };

            // Add Sub-Unit if available
            if (data.formData.subUnitId) {
                initialAssignment.subUnitId = data.formData.subUnitId;
            }

            const dobField = data.originalFormSections.flatMap(s => s.fields || []).find(f => f.label?.toLowerCase().includes('birth'));
            const dobValue = dobField ? data.formData[dobField.id] : undefined;
            const dynamicPassword = generateDefaultPassword(employeeName, dobValue);
            // NOTE: Password will be hashed server-side with bcrypt on first login (Cloud Function auto-upgrade)

            // ============================================================
            // STORAGE-APPROVAL: Move files from Onboarding to Employee folder
            // Files are stored under onboarding/{uid}/ (joiner's Firebase Auth UID)
            // Fallback to submissionId for legacy submissions before the rule change
            // ============================================================
            const joinerUid = data.linkedUid || submissionId;
            const oldStoragePath = `onboarding/${joinerUid}`;
            const newStoragePath = `employees/${submissionId}/joining`;
            
            // Logically update the formData with new storage paths
            const updatedProfileData = { ...data.formData };
            Object.keys(updatedProfileData).forEach(key => {
                const val = updatedProfileData[key];
                if (typeof val === 'string' && val.startsWith(oldStoragePath)) {
                    updatedProfileData[key] = val.replace(oldStoragePath, newStoragePath);
                } else if (Array.isArray(val)) {
                    updatedProfileData[key] = val.map(v => {
                        if (typeof v === 'string' && v.startsWith(oldStoragePath)) {
                            return v.replace(oldStoragePath, newStoragePath);
                        } else if (typeof v === 'object' && v !== null && 'storagePath' in v && typeof v.storagePath === 'string' && v.storagePath.startsWith(oldStoragePath)) {
                            return {
                                ...v,
                                storagePath: v.storagePath.replace(oldStoragePath, newStoragePath)
                            };
                        }
                        return v;
                    });
                } else if (typeof val === 'object' && val !== null) {
                    if ('storagePath' in val && typeof val.storagePath === 'string' && val.storagePath.startsWith(oldStoragePath)) {
                        updatedProfileData[key] = {
                            ...val,
                            storagePath: val.storagePath.replace(oldStoragePath, newStoragePath)
                        };
                    }
                }
            });

            // Physical move in Storage bucket
            try {
                await moveStorageFiles(oldStoragePath, newStoragePath);
                log.log(`[STORAGE_SYNC] Folder moved: "${oldStoragePath}" → "${newStoragePath}"`);
            } catch (storageErr: any) {
                console.error("[STORAGE_SYNC_ERROR] Folder move failed:", storageErr);
                // Note: We don't block the approval if Storage move fails (unlike Drive) 
                // because the paths in Firestore are now updated, and the user can re-upload if needed.
                // However, we log it heavily.
            }

            const newEmployee: Partial<FirestoreEmployee> = {
                uid: data.linkedUid || '', // Sync Firebase UID if it exists
                employeeId: empId,
                portalId: submissionId, // Store Portal ID inside the record
                profileData: updatedProfileData,
                data: updatedProfileData, // Also set 'data' field for Master List column display
                currentSiteId: initialSiteId,
                siteName: data.formData.siteName || 'N/A',
                activeAssignments: [initialAssignment],
                assignedSiteIds: [initialSiteId],
                assignmentHistory: [],
                employmentHistory: [],
                originalJoiningDate: resolvedJoiningDate,
                leaveBalance: {
                    casual: 12,
                    sick: 7,
                    privilege: 15
                },
                isActive: true,
                needsProfileCompletion: profileCompletionData?.profileCompletionStatus === 'INCOMPLETE',
                profileStatus: profileCompletionData?.profileCompletionStatus === 'INCOMPLETE' ? 'waiting_for_employee' : 'approved',
                profileCompletionStatus: profileCompletionData?.profileCompletionStatus === 'INCOMPLETE' ? 'INCOMPLETE' : 'COMPLETE',
                pendingProfileFields: profileCompletionData?.profileCompletionStatus === 'INCOMPLETE' ? (profileCompletionData?.pendingProfileFields || []) : [],
                pendingProfileNote: profileCompletionData?.profileCompletionStatus === 'INCOMPLETE' ? (profileCompletionData?.pendingProfileNote || '') : '',
                joiningDate: resolvedJoiningDate,
                applicantName: employeeName,
                driveFolderName: newFolderName,
                authProvider: data.authProvider || 'manual',
                linkedGoogleEmail: data.linkedGoogleEmail || '',
                inviteId: (customRecruiter !== undefined && !customRecruiter.id) ? null : (data.inviteId || null),
                recruitedBy: customRecruiter !== undefined ? (customRecruiter.id || null) : (data.recruitedBy || null),
                recruitedByName: customRecruiter !== undefined ? (customRecruiter.name || null) : (data.recruitedByName || null),
                duplicateCheck: liveDuplicateCheck.isDuplicate ? liveDuplicateCheck : (data.duplicateCheck || null),
                aadhaarNumber: liveAadhaar || null,
                panNumber: livePan || null,
                uanNumber: liveUan || null,
                phoneNumber: livePhone || null,
                previousEmployeeId: (liveDuplicateCheck?.matchType === 'EX_EMPLOYEE_REHIRE' && liveDuplicateCheck.matchedId)
                    ? liveDuplicateCheck.matchedId
                    : (data.duplicateCheck?.matchType === 'EX_EMPLOYEE_REHIRE' && data.duplicateCheck.matchedId)
                        ? data.duplicateCheck.matchedId
                        : null
            };

            if (newEmployee.authProvider === 'manual') {
                if (data.passwordHash) {
                    newEmployee.passwordHash = data.passwordHash;
                    newEmployee.isDefaultPassword = data.isDefaultPassword || false;
                } else {
                    const fallbackRaw = dynamicPassword || 'TEMP1234';
                    const { hashPassword } = await import('../utils/cryptoUtils');
                    newEmployee.passwordHash = await hashPassword(fallbackRaw);
                    newEmployee.isDefaultPassword = true;
                }
            }

            // Strip any undefined fields so Firestore setDoc never rejects
            Object.keys(newEmployee).forEach(key => {
                if ((newEmployee as any)[key] === undefined) {
                    delete (newEmployee as any)[key];
                }
            });

            const approvalBatch = writeBatch(db);
            approvalBatch.set(doc(db, EMPLOYEES_COLLECTION, submissionId), newEmployee);

            // Link rehiredAs on previous employee record if rehire
            const matchedRehireId = (liveDuplicateCheck?.matchType === 'EX_EMPLOYEE_REHIRE' && liveDuplicateCheck.matchedId)
                ? liveDuplicateCheck.matchedId
                : (data.duplicateCheck?.matchType === 'EX_EMPLOYEE_REHIRE' && data.duplicateCheck.matchedId)
                    ? data.duplicateCheck.matchedId
                    : null;

            if (matchedRehireId) {
                try {
                    const oldEmpRef = doc(db, EMPLOYEES_COLLECTION, matchedRehireId);
                    const oldSnap = await getDoc(oldEmpRef);
                    if (oldSnap.exists()) {
                        approvalBatch.update(oldEmpRef, { rehiredAs: empId });
                        log.log(`[REHIRE_LINK] Linked old employee ${matchedRehireId} rehiredAs -> ${empId}`);
                    }
                } catch (linkErr) {
                    console.warn("Could not link rehiredAs on previous employee record:", linkErr);
                }
            }

            // Increment joined count on referral invite atomically
            if (data.inviteId) {
                try {
                    const inviteRef = doc(db, 'referral_invites', data.inviteId);
                    approvalBatch.update(inviteRef, { joined: increment(1) });
                } catch (e) {
                    console.error("Failed to increment joined count on referral invite:", e);
                }
            }

            // IMPORTANT: Add employeeId to the updates object BEFORE we write to Firestore
            // This ensures the submission has these fields set atomically with the status
            updates.employeeId = empId;
            // Plaintext mockPassword removed for database security
            updates.driveFolderName = newFolderName;
            updates.applicantName = employeeName;
            updates.joiningDate = resolvedJoiningDate;

            // ============================================================
            // LEGACY HOOK: Finalize transition if this was a legacy claim
            // ============================================================
            if (data.legacyImportId) {
                try {
                    const legacyRef = doc(db, 'legacy_employee_imports', data.legacyImportId);
                    const legacySnap = await getDoc(legacyRef);
                    if (legacySnap.exists()) {
                        approvalBatch.update(legacyRef, { 
                            status: 'Finalized',
                            finalEmployeeId: empId,
                            linkedUid: data.linkedUid || '',
                            finalizedAt: new Date().toISOString()
                        });
                        log.log(`[LEGACY_HOOK] Finalized legacy record ${data.legacyImportId} for employee ${empId}`);
                    }
                } catch (legacyErr) {
                    console.error("[LEGACY_HOOK_ERROR] Failed to finalize legacy record:", legacyErr);
                    // We don't block the whole approval if this fails, but it's a serious sync issue
                }
            }

            // Atomically update submission alongside employee creation
            approvalBatch.update(submissionRef, updates);
            await approvalBatch.commit();
        } else {
            // Non-approval status updates
            await updateDoc(submissionRef, updates);
        }
    } else {
        await updateDoc(submissionRef, updates);
    }
};

export const markEmployeeProfileComplete = async (employeeId: string): Promise<void> => {
    // Look up employee document by employeeId or doc id
    let targetDocRef = doc(db, EMPLOYEES_COLLECTION, employeeId);
    const directSnap = await getDoc(targetDocRef);
    if (!directSnap.exists()) {
        const q = query(collection(db, EMPLOYEES_COLLECTION), where("employeeId", "==", employeeId));
        const querySnap = await getDocs(q);
        if (!querySnap.empty) {
            targetDocRef = querySnap.docs[0].ref;
        } else {
            throw new Error(`Employee record with ID ${employeeId} not found.`);
        }
    }

    await updateDoc(targetDocRef, {
        profileCompletionStatus: 'COMPLETE',
        needsProfileCompletion: false,
        profileStatus: 'approved',
        pendingProfileFields: [],
        pendingProfileNote: ''
    });
};

export const subscribeToSubmissions = (callback: (submissions: OnboardingSubmission[]) => void, status?: string, siteIds?: string[]) => {
    // If siteIds is an empty array, the user has no assigned sites — return nothing immediately.
    if (siteIds !== undefined && siteIds.length === 0) {
        callback([]);
        return () => {};
    }

    let q = query(collection(db, SUBMISSIONS_COLLECTION), limit(500));
    if (status) {
        q = query(collection(db, SUBMISSIONS_COLLECTION), where("status", "==", status), limit(500));
    }
    // Filter by allowed sites if provided (non-super-admin with assigned sites)
    if (siteIds && siteIds.length > 0) {
        const chunks = chunkArray(siteIds, 10);
        let allResults: OnboardingSubmission[] = [];
        const unsubs: (() => void)[] = [];
        chunks.forEach(chunk => {
            const chunkQuery = query(collection(db, SUBMISSIONS_COLLECTION), where("siteId", "in", chunk), limit(500));
            const unsub = onSnapshot(chunkQuery, (snap) => {
                const chunkData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as OnboardingSubmission));
                // Merge results from all chunks
                allResults = [...allResults.filter(r => !chunk.includes(r.siteId || '')), ...chunkData];
                callback(allResults);
            }, (error) => console.error("Error subscribing to submissions by site:", error));
            unsubs.push(unsub);
        });
        return () => unsubs.forEach(u => u());
    }

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const submissions = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as OnboardingSubmission));
        callback(submissions);
    }, (error) => {
        console.error("Error subscribing to submissions:", error);
    });

    return unsubscribe;
};

export const subscribeToSubmissionsByUid = (uid: string, callback: (submissions: OnboardingSubmission[]) => void) => {
    const qByEmpId = query(collection(db, SUBMISSIONS_COLLECTION), where("employeeId", "==", uid));
    const qByUid = query(collection(db, SUBMISSIONS_COLLECTION), where("uid", "==", uid));
    const qByLinkedUid = query(collection(db, SUBMISSIONS_COLLECTION), where("linkedUid", "==", uid));
    const docRef = doc(db, SUBMISSIONS_COLLECTION, uid);

    let empDocs: OnboardingSubmission[] = [];
    let uidDocs: OnboardingSubmission[] = [];
    let linkedUidDocs: OnboardingSubmission[] = [];
    let docDocs: OnboardingSubmission[] = [];

    let hasEmpReturned = false;
    let hasUidReturned = false;
    let hasLinkedUidReturned = false;
    let hasDocReturned = false;

    const emit = () => {
        if (!hasEmpReturned || !hasUidReturned || !hasLinkedUidReturned || !hasDocReturned) return;
        
        // Merge and deduplicate by ID
        const all = [...empDocs, ...uidDocs, ...linkedUidDocs, ...docDocs];
        const unique = Array.from(new Map(all.map(item => [item.id, item])).values());
        
        callback(unique);
    };

    const unsubEmpId = onSnapshot(qByEmpId, (snap) => {
        empDocs = snap.docs.map(d => ({ id: d.id, ...d.data() } as OnboardingSubmission));
        hasEmpReturned = true;
        emit();
    }, (error) => console.log('subscribeToSubmissionsByUid EmpId Error:', error));
    
    const unsubUid = onSnapshot(qByUid, (snap) => {
        uidDocs = snap.docs.map(d => ({ id: d.id, ...d.data() } as OnboardingSubmission));
        hasUidReturned = true;
        emit();
    }, (error) => console.log('subscribeToSubmissionsByUid Uid Error:', error));

    const unsubLinkedUid = onSnapshot(qByLinkedUid, (snap) => {
        linkedUidDocs = snap.docs.map(d => ({ id: d.id, ...d.data() } as OnboardingSubmission));
        hasLinkedUidReturned = true;
        emit();
    }, (error) => console.log('subscribeToSubmissionsByUid LinkedUid Error:', error));

    const unsubDoc = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            docDocs = [{ id: docSnap.id, ...docSnap.data() } as OnboardingSubmission];
        } else {
            docDocs = [];
        }
        hasDocReturned = true;
        emit();
    }, (error) => console.log('subscribeToSubmissionsByUid Doc Error:', error));

    return () => {
        unsubEmpId();
        unsubUid();
        unsubLinkedUid();
        unsubDoc();
    };
};

export const subscribeToEmployees = (callback: (employees: FirestoreEmployee[]) => void) => {
    const q = query(collection(db, EMPLOYEES_COLLECTION));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const employees = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as unknown as FirestoreEmployee));
        callback(employees);
    }, (error) => {
        console.error("Error subscribing to employees:", error);
    });
    return unsubscribe;
};

export const subscribeToEmployeeById = (uid: string, callback: (employee: FirestoreEmployee | null) => void) => {
    const docRef = doc(db, EMPLOYEES_COLLECTION, uid);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            callback({
                id: docSnap.id,
                ...docSnap.data()
            } as unknown as FirestoreEmployee);
        } else {
            callback(null);
        }
    });
    return unsubscribe;
};

export const subscribeToEmployeeByUid = (uid: string, callback: (employee: FirestoreEmployee | null) => void) => {
    log.log(`[employeeService] Subscribing to employee by UID field/Doc ID: ${uid}`);
    
    const docRef = doc(db, EMPLOYEES_COLLECTION, uid);
    const qByUid = query(collection(db, EMPLOYEES_COLLECTION), where("uid", "==", uid));
    const qByEmail = query(collection(db, EMPLOYEES_COLLECTION), where("linkedGoogleEmail", "==", auth.currentUser?.email || ""));

    let docEmp: FirestoreEmployee | null = null;
    let uidEmp: FirestoreEmployee | null = null;
    let emailEmp: FirestoreEmployee | null = null;

    let hasDocReturned = false;
    let hasUidReturned = false;
    let hasEmailReturned = false;

    const emit = () => {
        if (!hasDocReturned || !hasUidReturned || !hasEmailReturned) return;
        const candidate = docEmp || uidEmp || emailEmp;
        callback(candidate);
    };

    const unsubDoc = onSnapshot(docRef, (snap) => {
        if (snap.exists()) {
            docEmp = { id: snap.id, ...snap.data() } as unknown as FirestoreEmployee;
        } else {
            docEmp = null;
        }
        hasDocReturned = true;
        emit();
    }, (error) => {
        console.error("subscribeToEmployeeByUid Doc Error:", error);
        hasDocReturned = true;
        emit();
    });

    const unsubUid = onSnapshot(qByUid, (snap) => {
        if (!snap.empty) {
            uidEmp = { id: snap.docs[0].id, ...snap.docs[0].data() } as unknown as FirestoreEmployee;
            // Auto-update UID field if missing/mismatched on the found doc to link it permanently
            const docRefTarget = snap.docs[0].ref;
            if (snap.docs[0].data().uid !== uid) {
                updateDoc(docRefTarget, { uid }).catch(e => console.warn("Failed to auto-update employee uid field:", e));
            }
        } else {
            uidEmp = null;
        }
        hasUidReturned = true;
        emit();
    }, (error) => {
        console.error("subscribeToEmployeeByUid Uid Error:", error);
        hasUidReturned = true;
        emit();
    });

    const unsubEmail = onSnapshot(qByEmail, (snap) => {
        if (!snap.empty) {
            emailEmp = { id: snap.docs[0].id, ...snap.docs[0].data() } as unknown as FirestoreEmployee;
            // Auto-update UID field if missing/mismatched to link it permanently
            const docRefTarget = snap.docs[0].ref;
            if (snap.docs[0].data().uid !== uid) {
                updateDoc(docRefTarget, { uid }).catch(() => {});
            }
        } else {
            emailEmp = null;
        }
        hasEmailReturned = true;
        emit();
    }, (error) => {
        console.error("subscribeToEmployeeByUid Email Error:", error);
        hasEmailReturned = true;
        emit();
    });

    return () => {
        unsubDoc();
        unsubUid();
        unsubEmail();
    };
};

export const updateEmployeeLeaveBalance = async (employeeId: string, leaveType: string, daysToDeduct: number) => {
    let empRef = doc(db, EMPLOYEES_COLLECTION, employeeId);
    let empSnap = await getDoc(empRef);

    if (!empSnap.exists()) {
        const q = query(collection(db, EMPLOYEES_COLLECTION), where("employeeId", "==", employeeId), limit(1));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
            empRef = qSnap.docs[0].ref;
            empSnap = qSnap.docs[0] as any;
        }
    }

    if (empSnap.exists()) {
        const data = empSnap.data() as FirestoreEmployee;
        const keyMap: Record<string, string> = {
            'Casual Leave': 'casual',
            'Sick Leave': 'sick',
            'Earned Leave': 'earned',
            'Privilege Leave': 'privilege'
        };
        const balanceKey = keyMap[leaveType] || leaveType.toLowerCase();

        await updateDoc(empRef, {
            [`leaveBalance.${balanceKey}`]: increment(-daysToDeduct)
        });
    } else {
        console.warn(`Employee ${employeeId} not found for balance update.`);
    }
};

export const updateSubmissionEmployeeId = async (submissionId: string, oldId: string, newId: string) => {
    // 1. Check if new ID is already taken
    const exists = await checkEmployeeIdExists(newId);
    if (exists) {
        throw new Error(`Employee ID "${newId}" is already taken.`);
    }

    // 2. Update Submission
    const subRef = doc(db, SUBMISSIONS_COLLECTION, submissionId);
    await updateDoc(subRef, { employeeId: newId });

    // 3. Update Employee Document
    const empRef = doc(db, EMPLOYEES_COLLECTION, submissionId);
    const empSnap = await getDoc(empRef);
    if (empSnap.exists()) {
        await updateDoc(empRef, { employeeId: newId });
    }
};

export const revertSubmissionWorkflow = async (
    submissionId: string, 
    targetLevel: number,
    revertComments?: string,
    actorName?: string,
    actorRole?: string
) => {
    const subRef = doc(db, SUBMISSIONS_COLLECTION, submissionId);
    const subSnap = await getDoc(subRef);
    if (!subSnap.exists()) throw new Error("Submission not found");

    const data = subSnap.data() as OnboardingSubmission;
    const currentLevel = data.currentLevel || 1;

    // Usually, revert means "back to review", so if it was finalized, we should probably delete the employee stub.
    if (data.status === 'Approved' && data.employeeId) {
        const empId = data.employeeId;
        await deleteDoc(doc(db, EMPLOYEES_COLLECTION, submissionId));

        // Move files back in Storage and rename/restore in Drive (Asynchronous background)
        (async () => {
            try {
                const joinerUid = data.linkedUid || submissionId;
                const currentStoragePath = `employees/${submissionId}/joining`;
                const targetStoragePath = `onboarding/${joinerUid}`;
                
                log.log(`[REVERT_CLEANUP] Reverting Firebase Storage from: "${currentStoragePath}" to "${targetStoragePath}"`);
                await moveStorageFiles(currentStoragePath, targetStoragePath);

                const employeeName = data.applicantName || getApplicantName(data.formData, data.originalFormSections) || 'Unknown';
                const currentFolderName = `${empId} - ${employeeName}`;
                const targetFolderName = `${submissionId} - ${employeeName}`;
                
                log.log(`[REVERT_CLEANUP] Renaming Google Drive folder from: "${currentFolderName}" to "${targetFolderName}"`);
                await renameEmployeeFolder(currentFolderName, targetFolderName);
            } catch (err) {
                console.error("[REVERT_CLEANUP] Failed to revert folder/files in background:", err);
            }
        })();
    }

    // Retain ALL previous history entries so no comments or past steps are ever lost
    const currentHistory = data.approvalHistory || [];

    const revertEntry = {
        level: currentLevel,
        actionBy: actorName || 'Admin',
        actionByRole: actorRole || 'Admin',
        status: 'Reverted',
        comments: revertComments && revertComments.trim() 
            ? `[Reverted to Level ${targetLevel}]: ${revertComments.trim()}`
            : `Reverted from Level ${currentLevel} to Level ${targetLevel}`,
        timestamp: new Date().toISOString()
    };

    await updateDoc(subRef, {
        status: 'Pending Review',
        currentLevel: targetLevel,
        employeeId: '', // Clear assigned ID
        approvalHistory: [...currentHistory, revertEntry],
        lastUpdated: new Date().toISOString()
    });
};

export const softDeleteSubmission = async (submissionId: string) => {
    const subRef = doc(db, SUBMISSIONS_COLLECTION, submissionId);
    const subSnap = await getDoc(subRef);

    // Update submission with deletedAt
    await updateDoc(subRef, {
        deletedAt: new Date().toISOString(),
        status: 'Deleted'
    });

    if (subSnap.exists()) {
        const data = subSnap.data() as OnboardingSubmission;
        const applicantName = data.applicantName || getApplicantName(data.formData, data.originalFormSections) || 'Unknown';

        // 1. Move the submission-specific Drive folder (if any)
        // If it's not approved yet, it's still naming with SUB-ID
        const currentUniqueId = data.employeeId && !isPortalId(data.employeeId)
            ? data.employeeId
            : submissionId;

        const folderName = data.driveFolderName;
        log.log(`Moving Drive folder(${currentUniqueId} - ${applicantName}) to Recycle Bin...`);
        await moveEmployeeFolderToRecycleBin(applicantName, currentUniqueId, folderName);

        // 2. If it's an approved employee, soft delete the employee record too
        const empRef = doc(db, EMPLOYEES_COLLECTION, submissionId);
        const empSnap = await getDoc(empRef);
        if (empSnap.exists()) {
            await updateDoc(empRef, {
                deletedAt: new Date().toISOString(),
                isActive: false
            });
        }
    }
};

export const findSubmissionIdByEmployeeId = async (employeeId: string) => {
    const q = query(collection(db, SUBMISSIONS_COLLECTION), where("employeeId", "==", employeeId));
    const snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0].id;
    return null;
};

export const softDeleteEmployee = async (identifier: string) => {
    // 1. Locate employee document by direct doc ID or employeeId
    let empDocRef = doc(db, EMPLOYEES_COLLECTION, identifier);
    let empSnap = await getDoc(empDocRef);

    if (!empSnap.exists()) {
        const q = query(collection(db, EMPLOYEES_COLLECTION), where("employeeId", "==", identifier));
        const querySnap = await getDocs(q);
        if (!querySnap.empty) {
            empDocRef = querySnap.docs[0].ref;
            empSnap = querySnap.docs[0];
        }
    }

    const nowIso = new Date().toISOString();

    if (empSnap.exists()) {
        const empData = empSnap.data() as FirestoreEmployee;
        const docId = empSnap.id;
        const empId = empData.employeeId || docId;
        const name = empData.applicantName || 'Unknown';

        // Update employee document
        await updateDoc(empDocRef, {
            deletedAt: nowIso,
            isActive: false
        });

        // Sync associated submission
        let subDocRef = doc(db, SUBMISSIONS_COLLECTION, docId);
        let subSnap = await getDoc(subDocRef);
        if (!subSnap.exists() && empId) {
            const subId = await findSubmissionIdByEmployeeId(empId);
            if (subId) {
                subDocRef = doc(db, SUBMISSIONS_COLLECTION, subId);
                subSnap = await getDoc(subDocRef);
            }
        }

        if (subSnap.exists()) {
            await updateDoc(subDocRef, {
                deletedAt: nowIso,
                status: 'Deleted'
            });
        }

        // Move Drive folder to Recycle Bin
        try {
            await moveEmployeeFolderToRecycleBin(name, empId, empData.driveFolderName);
        } catch (driveErr) {
            console.warn("[DRIVE_WARN] Could not move Drive folder to Recycle Bin:", driveErr);
        }
    } else {
        // Fallback: Check if it is a pending submission
        const subRef = doc(db, SUBMISSIONS_COLLECTION, identifier);
        const subSnap = await getDoc(subRef);
        if (subSnap.exists()) {
            await softDeleteSubmission(identifier);
            return;
        }
        throw new Error(`Employee record "${identifier}" not found.`);
    }
};

export const restoreEmployee = async (targetId: string) => {
    // 1. Locate employee document by doc ID or employeeId
    let empDocRef = doc(db, EMPLOYEES_COLLECTION, targetId);
    let empSnap = await getDoc(empDocRef);

    if (!empSnap.exists()) {
        const q = query(collection(db, EMPLOYEES_COLLECTION), where("employeeId", "==", targetId));
        const querySnap = await getDocs(q);
        if (!querySnap.empty) {
            empDocRef = querySnap.docs[0].ref;
            empSnap = querySnap.docs[0];
        }
    }

    const docId = empSnap.exists() ? empSnap.id : targetId;
    const empData = empSnap.exists() ? empSnap.data() as FirestoreEmployee : null;
    const empId = empData?.employeeId || targetId;

    // 2. Restore employee document
    if (empSnap.exists()) {
        await updateDoc(empDocRef, {
            deletedAt: deleteField(),
            isActive: true,
            isBlocked: false,
            isRelieved: false
        });
    }

    // 3. Restore associated submission
    let subDocRef = doc(db, SUBMISSIONS_COLLECTION, docId);
    let subSnap = await getDoc(subDocRef);
    if (!subSnap.exists() && empId) {
        const subQuery = query(collection(db, SUBMISSIONS_COLLECTION), where('employeeId', '==', empId));
        const subQuerySnap = await getDocs(subQuery);
        if (!subQuerySnap.empty) {
            subDocRef = subQuerySnap.docs[0].ref;
            subSnap = subQuerySnap.docs[0];
        }
    }

    if (subSnap.exists()) {
        const subData = subSnap.data() as OnboardingSubmission;
        await updateDoc(subDocRef, {
            deletedAt: deleteField(),
            status: subData.employeeId ? SubmissionStatus.APPROVED : 'Pending Review'
        });

        // 4. Restore Drive folder
        const applicantName = subData.applicantName || getApplicantName(subData.formData, subData.originalFormSections) || 'Unknown';
        const driveUniqueId = empId || subData.employeeId || targetId;
        try {
            await restoreEmployeeFolderFromRecycleBin(applicantName, driveUniqueId, subData.driveFolderName);
        } catch (driveErr) {
            console.warn("[DRIVE_WARN] Could not restore Drive folder from Recycle Bin:", driveErr);
        }
    }
};

// NEW: Relieve Employee (when they leave the company)
export const relieveEmployee = async (
    employeeId: string,
    relievingDate: string,
    relievingReason: 'Resignation' | 'Termination' | 'Absconding' | 'ContractEnded' | 'Other'
) => {
    let empRef = doc(db, EMPLOYEES_COLLECTION, employeeId);
    let empSnap = await getDoc(empRef);

    // Fallback: If employeeId is not the document ID (e.g. self-onboarded doc ID is submissionId), query by field
    if (!empSnap.exists()) {
        const q = query(collection(db, EMPLOYEES_COLLECTION), where("employeeId", "==", employeeId), limit(1));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
            empRef = qSnap.docs[0].ref;
            empSnap = qSnap.docs[0] as any;
        }
    }

    const empData = empSnap.exists() ? empSnap.data() as FirestoreEmployee : null;

    if (!empSnap.exists()) {
        throw new Error(`Employee record with ID ${employeeId} was not found in the database.`);
    }

    const batch = writeBatch(db);
    batch.update(empRef, {
        isActive: false,
        status: 'Relieved',
        isRelieved: true,
        relievingDate: relievingDate,
        relievingReason: relievingReason
    });

    // Sync to Submission doc
    const subQuery = query(collection(db, SUBMISSIONS_COLLECTION), where("employeeId", "==", employeeId));
    const subSnap = await getDocs(subQuery);
    if (!subSnap.empty) {
        batch.update(subSnap.docs[0].ref, {
            isActive: false,
            status: 'Relieved',
            isRelieved: true,
            relievingDate: relievingDate,
            relievingReason: relievingReason
        });
    }

    await batch.commit();

    const folderName = empData?.driveFolderName;
    const applicantName = empData?.applicantName ||
        (empData?.profileData?.personalDetails?.fullName) ||
        'Unknown';

    log.log(`Relieving employee ${employeeId} (${applicantName}) on ${relievingDate}. Reason: ${relievingReason}`);
    // Move to a "Relieved" folder in Drive (uses block_employee action which moves to BLOCKED/RELIEVED folder)
    await moveEmployeeFolder(applicantName, employeeId, 'block_employee', folderName);
};

// Set Employee Notice Period on Approved Future Resignation
export const setEmployeeNoticePeriod = async (
    employeeId: string,
    relievingDate: string,
    reason: string = 'Resignation'
): Promise<void> => {
    let empRef = doc(db, EMPLOYEES_COLLECTION, employeeId);
    let empSnap = await getDoc(empRef);

    if (!empSnap.exists()) {
        const q = query(collection(db, EMPLOYEES_COLLECTION), where("employeeId", "==", employeeId), limit(1));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
            empRef = qSnap.docs[0].ref;
            empSnap = qSnap.docs[0] as any;
        }
    }

    if (!empSnap.exists()) return;

    const batch = writeBatch(db);
    batch.update(empRef, {
        resignationStatus: 'Notice Period',
        pendingRelievingDate: relievingDate,
        relievingDate: relievingDate,
        relievingReason: reason
    });

    const subQuery = query(collection(db, SUBMISSIONS_COLLECTION), where("employeeId", "==", employeeId));
    const subSnap = await getDocs(subQuery);
    if (!subSnap.empty) {
        batch.update(subSnap.docs[0].ref, {
            resignationStatus: 'Notice Period',
            pendingRelievingDate: relievingDate,
            relievingDate: relievingDate,
            relievingReason: reason
        });
    }

    await batch.commit();
    log.log(`[Notice Period] Set notice period for employee ${employeeId} until ${relievingDate}`);
};

// Enhanced: Rejoin Employee with full details (date, site, designation)
export const rejoinEmployee = async (
    employeeId: string,
    rejoinDate: string,
    siteId: string,
    siteName: string,
    subUnitId: string | undefined,
    subUnitName: string | undefined,
    designation: string,
    newEmployeeId?: string, // Optional for re-hiring (creating a new record)
    foldersToCopy: string[] = [] // New: Array of folder names to copy
): Promise<void> => {
    let empRef = doc(db, EMPLOYEES_COLLECTION, employeeId);
    let empSnap = await getDoc(empRef);

    // Fallback: If employeeId is not the document ID (e.g. self-onboarded doc ID is submissionId), query by field
    if (!empSnap.exists()) {
        const q = query(collection(db, EMPLOYEES_COLLECTION), where("employeeId", "==", employeeId), limit(1));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
            empRef = qSnap.docs[0].ref;
            empSnap = qSnap.docs[0] as any;
        }
    }

    const empData = empSnap.exists() ? empSnap.data() as FirestoreEmployee : null;

    if (!empData) throw new Error("Employee record not found");

    // NEW LOGIC: Re-hire with a new Employee ID
    if (newEmployeeId) {
        // check if new ID already exists across both collections
        const exists = await checkEmployeeIdExists(newEmployeeId);
        if (exists) {
            throw new Error(`Employee ID ${newEmployeeId} is already taken.`);
        }
        const newEmpRef = doc(db, EMPLOYEES_COLLECTION, newEmployeeId);

        const applicantName = empData.applicantName || 'Unknown';
        const newFolderName = `${newEmployeeId} - ${applicantName}`;

        const initialAssignment: EmployeeAssignment = {
            id: uuidv4(),
            siteId,
            subUnitId: subUnitId || null,
            designation,
            type: 'PRIMARY',
            joiningDate: rejoinDate,
            status: 'Active'
        };

        // Decision: Pending or Active?
        // If "Joining Documents" is in foldersToCopy -> Active (Approved)
        // Otherwise -> Pending (Waiting for upload)
        const hasJoiningDocs = foldersToCopy.includes("Joining Documents");
        const profileStatus = hasJoiningDocs ? 'approved' : 'waiting_for_employee';
        const needsCompletion = !hasJoiningDocs;

        // Create new employee data object
        // Use casting to avoid strict type checks on potentially missing fields in types.ts
        const newEmployeeData: any = {
            ...empData,
            uid: '', // Reset UID as this is a new record
            employeeId: newEmployeeId,
            isActive: true,
            isRelieved: false,
            isBlocked: false,
            joiningDate: rejoinDate,
            originalJoiningDate: rejoinDate, // Reset tenure for new record
            currentSiteId: siteId,
            siteName: siteName,
            subUnitId: subUnitId || null,
            subUnitName: subUnitName || null,
            designation: designation,
            activeAssignments: [initialAssignment],
            assignedSiteIds: [siteId],
            assignmentHistory: [],
            employmentHistory: [],
            driveFolderName: newFolderName,
            // Status based on keepDocuments choice
            needsProfileCompletion: needsCompletion,
            profileStatus: profileStatus,
            importedVia: 'rejoin',
            // Link to old record
            previousEmployeeId: employeeId
        };


        // Remove fields that shouldn't exist on a new record
        delete newEmployeeData.relievingDate;
        delete newEmployeeData.relievingReason;
        delete newEmployeeData.deletedAt;
        delete newEmployeeData.rehiredAs;

        // Remove ID from object if it was copied
        if (newEmployeeData.id) delete newEmployeeData.id;

        const batch = writeBatch(db);
        batch.set(newEmpRef, newEmployeeData);
        batch.update(empRef, {
            rehiredAs: newEmployeeId
        } as any);
        await batch.commit();

        // CREATE NEW DRIVE FOLDER FOR NEW ID (Asynchronous)
        (async () => {
            try {
                await createEmployeeFolder(applicantName, newEmployeeId);
                log.log(`Created Drive folder for ${newEmployeeId}`);

                // COPY SELECTED FOLDERS
                if (foldersToCopy.length > 0 && empData.driveFolderName) {
                    log.log("Copying selected documents from old folder...", foldersToCopy);
                    // Old folder name is in empData.driveFolderName
                    await copySpecificSubfolders(empData.driveFolderName, newFolderName, foldersToCopy);
                    log.log("Documents copied successfully.");
                }
            } catch (driveErr) {
                console.error("Failed to create/copy Drive folder for new ID:", driveErr);
            }
        })();

        log.log(`Re-hired employee ${employeeId} as ${newEmployeeId}. Created new record.`);
        return;
    }

    // EXISTING LOGIC: Standard Rejoin (reactivate old record)

    // 1. Prepare history entry from the stint that just ended
    const historyEntry: EmploymentStint = {
        joiningDate: empData.joiningDate,
        relievingDate: empData.relievingDate || new Date().toISOString(),
        relievingReason: empData.relievingReason || 'Other'
    };

    // 2. Create new assignment for the rejoin
    const newAssignment = {
        id: uuidv4(),
        siteId,
        subUnitId: subUnitId || null,
        designation,
        type: 'PRIMARY' as const,
        joiningDate: rejoinDate,
        status: 'Active' as const
    };

    const updates: any = {
        isActive: true,
        isRelieved: false,
        isBlocked: false,
        relievingDate: deleteField(),
        relievingReason: deleteField(),
        deletedAt: null,
        joiningDate: rejoinDate,
        currentSiteId: siteId,
        siteName: siteName,
        subUnitId: subUnitId || null,
        subUnitName: subUnitName || null,
        designation: designation,
        employmentHistory: [...(empData.employmentHistory || []), historyEntry],
        activeAssignments: [newAssignment],
        assignmentHistory: [...(empData.assignmentHistory || []), newAssignment],
        assignedSiteIds: [siteId]
    };

    // 3. Set original joining date if it's the first time rejoining
    if (!empData.originalJoiningDate) {
        updates.originalJoiningDate = empData.joiningDate;
    }

    await updateDoc(empRef, updates);

    // Sync to Submission doc
    const subQuery = query(collection(db, SUBMISSIONS_COLLECTION), where("employeeId", "==", employeeId));
    const subSnap = await getDocs(subQuery);
    if (!subSnap.empty) {
        await updateDoc(subSnap.docs[0].ref, {
            isRelieved: false,
            relievingDate: deleteField(),
            relievingReason: deleteField()
        });
    }

    const folderName = empData?.driveFolderName;
    const applicantName = empData?.applicantName ||
        (empData?.profileData?.personalDetails?.fullName) ||
        'Unknown';

    log.log(`Rejoining employee ${employeeId} (${applicantName}) on ${rejoinDate}. New site: ${siteName}, Designation: ${designation}`);
    // Only move folder if standard rejoin
    await moveEmployeeFolder(applicantName, employeeId, 'restore_employee', folderName);
};

// --- Multi-Site & Per-Site Lifecycle ---

export const assignToSite = async (
    employeeId: string,
    assignment: Omit<EmployeeAssignment, 'id' | 'status'>
) => {
    const resolved = await resolveEmployeeDoc(employeeId);
    if (!resolved) throw new Error("Employee not found");
    const { ref: empRef, data: empData } = resolved;

    const newAssignment: EmployeeAssignment = {
        ...assignment,
        id: uuidv4(),
        status: 'Active'
    };

    const newAssignments = [...(empData.activeAssignments || []), newAssignment];
    const updates: any = {
        activeAssignments: newAssignments,
        assignedSiteIds: Array.from(new Set(newAssignments.map(a => a.siteId)))
    };

    // If this is the FIRST assignment ever, or if it's marked primary, sync legacy fields
    if (!empData.activeAssignments || empData.activeAssignments.length === 0 || assignment.type === 'PRIMARY') {
        updates.currentSiteId = assignment.siteId;
        try {
            const sitesSnap = await getDoc(doc(db, 'settings', 'sites'));
            if (sitesSnap.exists()) {
                const siteList = (sitesSnap.data()?.sites as any[]) || [];
                const found = siteList.find(s => s.id === assignment.siteId);
                if (found) updates.siteName = found.name;
            }
        } catch (e) {
            console.warn("Could not resolve site name for assignment:", e);
        }

        // Ensure joiningDate is set if not present
        if (!empData.joiningDate) updates.joiningDate = assignment.joiningDate;
    }

    await updateDoc(empRef, updates);
    await logSystemAction('CREATE', 'EMPLOYEES', `Assigned employee ${empData.applicantName || (empData as any).employeeName || employeeId} (${employeeId}) to site ${updates.siteName || assignment.siteId} as ${assignment.type}`);
};

export const relieveFromSite = async (
    employeeId: string,
    assignmentId: string,
    relievingDate: string,
    relievingReason: string
) => {
    const resolved = await resolveEmployeeDoc(employeeId);
    if (!resolved) throw new Error("Employee not found");
    const { ref: empRef, data: empData } = resolved;

    const active = empData.activeAssignments || [];
    const assignmentToRelieve = active.find(a => a.id === assignmentId);
    if (!assignmentToRelieve) throw new Error("Assignment not found");

    const finishedStint: EmployeeAssignment = {
        ...assignmentToRelieve,
        relievingDate,
        relievingReason,
        status: 'Relieved'
    };

    const newActive = active.filter(a => a.id !== assignmentId);
    const newHistory = [...(empData.assignmentHistory || []), finishedStint];

    const updates: any = {
        activeAssignments: newActive,
        assignmentHistory: newHistory,
        assignedSiteIds: newActive.map(a => a.siteId)
    };

    // If we relieved the PRIMARY assignment, and there are others, maybe promote one?
    // For now, if no active left, set isActive = false
    // If we relieved the PRIMARY assignment, and there are others, promote one to primary
    if (assignmentToRelieve.type === 'PRIMARY' && newActive.length > 0) {
        const nextPrimary = newActive.find(a => a.type === 'PRIMARY') || newActive[0];
        updates.currentSiteId = nextPrimary.siteId;
        try {
            const sitesSnap = await getDoc(doc(db, 'settings', 'sites'));
            if (sitesSnap.exists()) {
                const siteList = (sitesSnap.data()?.sites as any[]) || [];
                const found = siteList.find(s => s.id === nextPrimary.siteId);
                if (found) updates.siteName = found.name;
            }
        } catch (e) {
            console.warn("Could not resolve site name for reassignment:", e);
        }

        if (nextPrimary.type !== 'PRIMARY') {
            updates.activeAssignments = newActive.map(a =>
                a.id === nextPrimary.id ? { ...a, type: 'PRIMARY' } : a
            );
        }
    }

    if (newActive.length === 0) {
        updates.isActive = false;
        updates.isRelieved = true;
        updates.relievingDate = relievingDate;
        updates.relievingReason = relievingReason;
        updates.currentSiteId = "";
        updates.siteName = "N/A";
    }

    await updateDoc(empRef, updates);
    await logSystemAction('UPDATE', 'EMPLOYEES', `Relieved employee ${empData.applicantName || (empData as any).employeeName || employeeId} (${employeeId}) from assignment ${assignmentId} (Reason: ${relievingReason})`);
};

export const updateEmployeeClientIds = async (
    employeeId: string,
    clientIds: Record<string, string>
) => {
    const resolved = await resolveEmployeeDoc(employeeId);
    if (!resolved) throw new Error("Employee not found");
    await updateDoc(resolved.ref, { clientIds });
    await logSystemAction('UPDATE', 'EMPLOYEES', `Updated client IDs / site badges for employee ${employeeId}`);
};

export const updateEmployeeJoiningDate = async (
    employeeId: string,
    newJoiningDate: string,
    updateOriginal: boolean = false
) => {
    let empRef = doc(db, EMPLOYEES_COLLECTION, employeeId);
    let empSnap = await getDoc(empRef);

    if (!empSnap.exists()) {
        const q = query(collection(db, EMPLOYEES_COLLECTION), where("employeeId", "==", employeeId));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
            empRef = qSnap.docs[0].ref;
            empSnap = qSnap.docs[0];
        } else {
            throw new Error(`Employee record "${employeeId}" not found.`);
        }
    }

    const empData = empSnap.data() as FirestoreEmployee;
    const isoDate = new Date(newJoiningDate).toISOString();

    const updates: any = {
        joiningDate: isoDate,
        updatedAt: serverTimestamp()
    };

    if (updateOriginal || !empData.originalJoiningDate) {
        updates.originalJoiningDate = isoDate;
    }

    if (empData.data) {
        updates.data = { ...empData.data, joiningDate: isoDate };
    }
    if (empData.profileData) {
        updates.profileData = { ...empData.profileData, joiningDate: isoDate };
    }

    if (empData.activeAssignments && empData.activeAssignments.length > 0) {
        updates.activeAssignments = empData.activeAssignments.map(asgn => {
            if (asgn.type === 'PRIMARY') {
                return { ...asgn, joiningDate: isoDate };
            }
            return asgn;
        });
    }

    await updateDoc(empRef, updates);
    await logSystemAction('UPDATE', 'EMPLOYEES', `Updated joining date for employee ${empData.applicantName || (empData as any).employeeName || employeeId} (${employeeId}) to ${isoDate}`);

    // Also sync onboarding_submissions if linked
    try {
        const portalId = empData.portalId || empSnap.id;
        const subRef = doc(db, SUBMISSIONS_COLLECTION, portalId);
        const subSnap = await getDoc(subRef);
        if (subSnap.exists()) {
            await updateDoc(subRef, { joiningDate: isoDate });
        } else {
            const subQ = query(collection(db, SUBMISSIONS_COLLECTION), where("employeeId", "==", empData.employeeId || employeeId));
            const subQSnap = await getDocs(subQ);
            if (!subQSnap.empty) {
                await updateDoc(subQSnap.docs[0].ref, { joiningDate: isoDate });
            }
        }
    } catch (e) {
        console.warn("Could not sync joiningDate to onboarding_submissions:", e);
    }
};

export const updateSubmissionRecruiter = async (
    submissionId: string,
    recruiter: { id: string | null; name: string | null }
) => {
    const subRef = doc(db, SUBMISSIONS_COLLECTION, submissionId);
    const subSnap = await getDoc(subRef);
    if (!subSnap.exists()) throw new Error(`Submission "${submissionId}" not found.`);

    const updates: any = {
        recruitedBy: recruiter.id || null,
        recruitedByName: recruiter.name || null,
        lastUpdated: new Date().toISOString()
    };
    if (!recruiter.id) {
        updates.inviteId = null;
    }

    await updateDoc(subRef, updates);
    await logSystemAction('UPDATE', 'SUBMISSION', `Updated recruiter attribution for submission ${submissionId} to ${recruiter.name || 'None'}`);
};

export const updateEmployeeRecruiter = async (
    employeeId: string,
    recruiter: { id: string | null; name: string | null }
) => {
    let empRef = doc(db, EMPLOYEES_COLLECTION, employeeId);
    let empSnap = await getDoc(empRef);

    if (!empSnap.exists()) {
        const q = query(collection(db, EMPLOYEES_COLLECTION), where("employeeId", "==", employeeId));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
            empRef = qSnap.docs[0].ref;
            empSnap = qSnap.docs[0];
        } else {
            throw new Error(`Employee record "${employeeId}" not found.`);
        }
    }

    const empData = empSnap.data() as FirestoreEmployee;

    const updates: any = {
        recruitedBy: recruiter.id || null,
        recruitedByName: recruiter.name || null,
        lastUpdated: new Date().toISOString()
    };
    if (!recruiter.id) {
        updates.inviteId = null;
    }

    await updateDoc(empRef, updates);
    await logSystemAction('UPDATE', 'EMPLOYEES', `Updated recruiter attribution for employee ${empData.applicantName || (empData as any).employeeName || employeeId} (${employeeId}) to ${recruiter.name || 'None'}`);

    // Also sync to onboarding_submissions if linked
    try {
        const portalId = (empData as any).portalId || empSnap.id;
        const subRef = doc(db, SUBMISSIONS_COLLECTION, portalId);
        const subSnap = await getDoc(subRef);
        if (subSnap.exists()) {
            await updateDoc(subRef, updates);
        } else {
            const subQ = query(collection(db, SUBMISSIONS_COLLECTION), where("employeeId", "==", empData.employeeId || employeeId));
            const subQSnap = await getDocs(subQ);
            if (!subQSnap.empty) {
                await updateDoc(subQSnap.docs[0].ref, updates);
            }
        }
    } catch (e) {
        console.warn("Could not sync recruiter update to onboarding_submissions:", e);
    }
};

export const syncDriveFolder = async (recordId: string) => {
    let targetDocRef = doc(db, EMPLOYEES_COLLECTION, recordId);
    let targetSnap = await getDoc(targetDocRef);
    let isEmployee = true;

    if (!targetSnap.exists()) {
        targetDocRef = doc(db, SUBMISSIONS_COLLECTION, recordId);
        targetSnap = await getDoc(targetDocRef);
        isEmployee = false;
        if (!targetSnap.exists()) {
            throw new Error(`Record ${recordId} not found in Employees or Submissions.`);
        }
    }

    const recordData = targetSnap.data() as any;
    const applicantName = recordData.applicantName || recordData.name || (recordData.profileData?.personalDetails?.fullName) || 'Unknown';
    const folderId = recordData.employeeId || recordData.portalId || recordId;
    const formData = recordData.formData || recordData.profileData || recordData.data || {};

    log.log(`[DRIVE_BACKUP] Starting Drive backup for ${applicantName} (${folderId})...`);

    // Collect all Storage paths from form data
    const storagePaths: { field: string; path: string }[] = [];
    const extractPaths = (obj: any, prefix = '') => {
        if (!obj || typeof obj !== 'object') return;
        for (const key of Object.keys(obj)) {
            const val = obj[key];
            if (typeof val === 'string' && (val.startsWith('onboarding/') || val.startsWith('employees/'))) {
                storagePaths.push({ field: prefix ? `${prefix}.${key}` : key, path: val });
            } else if (typeof val === 'object' && val !== null) {
                if ('storagePath' in val && typeof val.storagePath === 'string') {
                    storagePaths.push({ field: prefix ? `${prefix}.${key}` : key, path: val.storagePath });
                } else {
                    extractPaths(val, prefix ? `${prefix}.${key}` : key);
                }
            }
        }
    };
    extractPaths(formData);

    const { getBlob, ref } = await import('firebase/storage');
    const { storage } = await import('../firebase/config');
    const { uploadToDrive, submitToGoogleForm } = await import('./driveService');

    const updatedFormData = { ...formData };
    let uploadedCount = 0;
    for (const item of storagePaths) {
        try {
            const storageRef = ref(storage, item.path);
            const blob = await getBlob(storageRef);
            const fileName = item.path.split('/').pop() || 'document.pdf';
            const fileObj = new File([blob], fileName, { type: blob.type });
            const driveUrl = await uploadToDrive(fileObj, applicantName, "Joining Documents", folderId);
            uploadedCount++;

            // Save Drive URL in form data
            if (updatedFormData[item.field] && typeof updatedFormData[item.field] === 'object') {
                updatedFormData[item.field] = {
                    ...updatedFormData[item.field],
                    driveUrl: driveUrl || ''
                };
            } else {
                updatedFormData[item.field] = {
                    storagePath: item.path,
                    driveUrl: driveUrl || ''
                };
            }
            log.log(`[DRIVE_BACKUP] ✅ Uploaded ${fileName} to Drive for ${applicantName} (${driveUrl})`);
        } catch (fileErr) {
            console.warn(`[DRIVE_BACKUP] Warning uploading ${item.path} to Drive:`, fileErr);
        }
    }

    const updatePayload: any = {
        driveBackupStatus: 'completed',
        driveBackupAt: new Date().toISOString()
    };
    if (isEmployee) {
        updatePayload.data = updatedFormData;
    } else {
        updatePayload.formData = updatedFormData;
    }
    await updateDoc(targetDocRef, updatePayload);

    log.log(`[DRIVE_BACKUP] Backup completed (${uploadedCount}/${storagePaths.length} files backed up to Google Drive).`);

    // Chained step: Now that Drive URLs exist, sync to Google Form / Sheet with Drive URLs & Site Name
    try {
        const email = recordData.linkedGoogleEmail || recordData.email || null;
        const formPayload = {
            ...updatedFormData,
            siteName: recordData.siteName || updatedFormData.siteName
        };
        await submitToGoogleForm(formPayload, email);
        await updateDoc(targetDocRef, {
            googleFormSyncStatus: 'synced',
            googleFormSyncedAt: new Date().toISOString()
        });
        log.log(`[GOOGLE_FORM] ✅ Synced Google Form with Drive URLs for ${applicantName}`);
    } catch (formErr) {
        console.warn(`[GOOGLE_FORM] Google Form sync error after Drive backup:`, formErr);
    }

    return { success: true, count: uploadedCount };
};

export interface EmployeeFullContext {
    employeeId: string;
    docId?: string;
    submissionId?: string;
    uid?: string;
    portalId?: string;
    email?: string;
    applicantName: string;
    driveFolderName?: string;
    allIds: string[];
}

export const resolveEmployeeFullContext = async (identifier: string): Promise<EmployeeFullContext> => {
    const cleanId = (identifier || '').trim();
    const allIdsSet = new Set<string>();
    if (cleanId) allIdsSet.add(cleanId);

    let docId: string | undefined = undefined;
    let employeeId = cleanId;
    let submissionId: string | undefined = undefined;
    let uid: string | undefined = undefined;
    let portalId: string | undefined = undefined;
    let email: string | undefined = undefined;
    let applicantName: string | undefined = undefined;
    let driveFolderName: string | undefined = undefined;

    // 1. Try finding in employees collection directly by Doc ID
    try {
        const empDocRef = doc(db, EMPLOYEES_COLLECTION, cleanId);
        const empSnap = await getDoc(empDocRef);
        if (empSnap.exists()) {
            docId = empSnap.id;
            const data = empSnap.data() as FirestoreEmployee;
            employeeId = data.employeeId || cleanId;
            uid = data.uid || (data as any).linkedUid;
            portalId = (data as any).portalId;
            submissionId = (data as any).submissionId;
            email = (data as any).email || (data as any).linkedGoogleEmail;
            applicantName = data.applicantName || (data as any).name;
            driveFolderName = data.driveFolderName;
        }
    } catch (e) {
        log.warn("[resolveEmployeeFullContext] Error checking emp doc by ID:", e);
    }

    // 2. If not found by Doc ID, try querying by employeeId field
    if (!docId) {
        try {
            const q = query(collection(db, EMPLOYEES_COLLECTION), where("employeeId", "==", cleanId), limit(1));
            const snap = await getDocs(q);
            if (!snap.empty) {
                const empDoc = snap.docs[0];
                docId = empDoc.id;
                const data = empDoc.data() as FirestoreEmployee;
                employeeId = data.employeeId || cleanId;
                uid = data.uid || (data as any).linkedUid;
                portalId = (data as any).portalId;
                submissionId = (data as any).submissionId;
                email = (data as any).email || (data as any).linkedGoogleEmail;
                applicantName = data.applicantName || (data as any).name;
                driveFolderName = data.driveFolderName;
            }
        } catch (e) {
            log.warn("[resolveEmployeeFullContext] Error querying emp by employeeId field:", e);
        }
    }

    // 3. If still not found, try querying by uid or portalId in employees
    if (!docId) {
        try {
            const qUid = query(collection(db, EMPLOYEES_COLLECTION), where("uid", "==", cleanId), limit(1));
            const snapUid = await getDocs(qUid);
            if (!snapUid.empty) {
                const empDoc = snapUid.docs[0];
                docId = empDoc.id;
                const data = empDoc.data() as FirestoreEmployee;
                employeeId = data.employeeId || docId;
                uid = data.uid || cleanId;
                portalId = (data as any).portalId;
                submissionId = (data as any).submissionId;
                email = (data as any).email || (data as any).linkedGoogleEmail;
                applicantName = data.applicantName || (data as any).name;
                driveFolderName = data.driveFolderName;
            }
        } catch (e) {
            log.warn("[resolveEmployeeFullContext] Error querying emp by uid:", e);
        }
    }

    // 4. Try finding submission (in onboarding_submissions)
    try {
        const subIdToTry = submissionId || (isPortalId(cleanId) ? cleanId : null);
        let subFound = false;

        if (subIdToTry) {
            const subRef = doc(db, SUBMISSIONS_COLLECTION, subIdToTry);
            const subSnap = await getDoc(subRef);
            if (subSnap.exists()) {
                subFound = true;
                submissionId = subSnap.id;
                const subData = subSnap.data() as OnboardingSubmission;
                if (!applicantName) {
                    applicantName = getApplicantName(subData.formData, subData.originalFormSections) || (subData as any).applicantName;
                }
                if (!driveFolderName) driveFolderName = subData.driveFolderName;
                if (!uid) uid = subData.linkedUid || (subData as any).uid;
                if (!email) email = subData.linkedGoogleEmail || (subData as any).email;
                if (subData.employeeId && (!employeeId || employeeId === cleanId)) {
                    employeeId = subData.employeeId;
                }
            }
        }

        if (!subFound && employeeId && !isPortalId(employeeId)) {
            const qSub = query(collection(db, SUBMISSIONS_COLLECTION), where("employeeId", "==", employeeId), limit(1));
            const snapSub = await getDocs(qSub);
            if (!snapSub.empty) {
                const subDoc = snapSub.docs[0];
                submissionId = subDoc.id;
                const subData = subDoc.data() as OnboardingSubmission;
                if (!applicantName) {
                    applicantName = getApplicantName(subData.formData, subData.originalFormSections) || (subData as any).applicantName;
                }
                if (!driveFolderName) driveFolderName = subData.driveFolderName;
                if (!uid) uid = subData.linkedUid || (subData as any).uid;
                if (!email) email = subData.linkedGoogleEmail || (subData as any).email;
            }
        }
    } catch (e) {
        log.warn("[resolveEmployeeFullContext] Error resolving submission:", e);
    }

    // 5. If docId is still missing, try querying employees by submissionId or employeeId
    if (!docId && submissionId) {
        try {
            const empDocBySubId = doc(db, EMPLOYEES_COLLECTION, submissionId);
            const subEmpSnap = await getDoc(empDocBySubId);
            if (subEmpSnap.exists()) {
                docId = subEmpSnap.id;
                const data = subEmpSnap.data() as FirestoreEmployee;
                if (!applicantName) applicantName = data.applicantName || (data as any).name;
                if (!driveFolderName) driveFolderName = data.driveFolderName;
                if (data.employeeId) employeeId = data.employeeId;
            }
        } catch (e) {
            log.warn("[resolveEmployeeFullContext] Error checking emp by submissionId:", e);
        }
    }

    // Populate allIdsSet
    if (docId) allIdsSet.add(docId);
    if (employeeId) allIdsSet.add(employeeId);
    if (submissionId) allIdsSet.add(submissionId);
    if (uid) allIdsSet.add(uid);
    if (portalId) allIdsSet.add(portalId);

    const allIds = Array.from(allIdsSet).filter(Boolean);

    return {
        employeeId: employeeId || cleanId,
        docId,
        submissionId,
        uid,
        portalId,
        email,
        applicantName: applicantName || employeeId || cleanId || 'Unknown',
        driveFolderName,
        allIds
    };
};

export const deleteAssociatedRecords = async (target: string | EmployeeFullContext) => {
    const ctx = typeof target === 'string' ? await resolveEmployeeFullContext(target) : target;
    const allIds = ctx.allIds;
    log.log(`Cascading Deletion: Cleaning up records for ${ctx.applicantName} (IDs: ${allIds.join(', ')})...`);

    // Helper to delete matching docs across multiple fields and multiple IDs
    const deleteMatchingDocs = async (collectionName: string, fields: string[]) => {
        try {
            const docRefsToDelete = new Map<string, any>();
            for (const f of fields) {
                for (const id of allIds) {
                    const q = query(collection(db, collectionName), where(f, "==", id));
                    const snap = await getDocs(q);
                    snap.docs.forEach(d => docRefsToDelete.set(d.id, d.ref));
                }
            }
            const deletePromises = Array.from(docRefsToDelete.values()).map(ref => deleteDoc(ref));
            await Promise.all(deletePromises);
            if (docRefsToDelete.size > 0) {
                log.log(`- Deleted ${docRefsToDelete.size} record(s) from ${collectionName}`);
            }
        } catch (e) {
            console.error(`[CASCADE_DELETE] Error deleting from ${collectionName}:`, e);
        }
    };

    // 1. Leave Requests
    await deleteMatchingDocs(LEAVE_REQ_COL, ['employeeId', 'uid']);

    // 2. Account Updates
    await deleteMatchingDocs(ACCOUNT_UPD_COL, ['employeeId', 'uid']);

    // 3. Resignations
    await deleteMatchingDocs(RESIGNATION_COL, ['employeeId', 'uid']);

    // 4. Disciplinary Actions
    await deleteMatchingDocs(DISCIPLINARY_COL, ['employeeId', 'targetUserId', 'uid']);

    // 5. Leave Balances
    await deleteMatchingDocs(LEAVE_BALANCES_COL, ['employeeId']);
    for (const id of allIds) {
        await deleteDoc(doc(db, LEAVE_BALANCES_COL, id)).catch(() => {});
    }

    // 6. Attendance
    await deleteMatchingDocs('attendance', ['userId', 'employeeId']);

    // 7. User Engagement & Streaks
    await deleteMatchingDocs('user_engagement', ['userId']);
    for (const id of allIds) {
        await deleteDoc(doc(db, 'user_engagement', id)).catch(() => {});
    }

    // 8. Complaints & Grievances
    await deleteMatchingDocs('complaints', ['userId', 'employeeId']);

    // 9. Reward Redemptions
    await deleteMatchingDocs('reward_redemptions', ['userId', 'employeeId']);

    // 10. Background Checks (BGV)
    await deleteMatchingDocs('bgv_records', ['employeeId', 'targetId']);

    // 11. Correction Requests
    await deleteMatchingDocs('correction_requests', ['targetId', 'submissionId']);

    // 12. Notifications
    await deleteMatchingDocs(NOTIFICATIONS_COL, ['targetUserId']);

    // 13. Application Drafts
    await deleteMatchingDocs(DRAFTS_COLLECTION, ['ownerUid']);
    if (ctx.email) {
        await deleteMatchingDocs(DRAFTS_COLLECTION, ['ownerEmail']);
    }
};

export const getEmployeeRecordCounts = async (target: string | EmployeeFullContext) => {
    const ctx = typeof target === 'string' ? await resolveEmployeeFullContext(target) : target;
    const allIds = ctx.allIds;
    const results: Record<string, number> = {};

    // Helper to query unique doc IDs across multiple fields and multiple IDs
    const countUniqueMatchingDocs = async (collectionName: string, fields: string[]): Promise<number> => {
        const foundDocIds = new Set<string>();
        try {
            for (const f of fields) {
                for (const id of allIds) {
                    const q = query(collection(db, collectionName), where(f, "==", id));
                    const snap = await getDocs(q);
                    snap.docs.forEach(d => foundDocIds.add(d.id));
                }
            }
        } catch (e) {
            log.warn(`[getEmployeeRecordCounts] Error scanning ${collectionName}:`, e);
        }
        return foundDocIds.size;
    };

    // 1. Leave Requests
    results['Leaves'] = await countUniqueMatchingDocs(LEAVE_REQ_COL, ['employeeId', 'uid']);

    // 2. Account Updates
    results['Account Updates'] = await countUniqueMatchingDocs(ACCOUNT_UPD_COL, ['employeeId', 'uid']);

    // 3. Resignations
    results['Resignations'] = await countUniqueMatchingDocs(RESIGNATION_COL, ['employeeId', 'uid']);

    // 4. Disciplinary Actions
    results['Disciplinary'] = await countUniqueMatchingDocs(DISCIPLINARY_COL, ['employeeId', 'targetUserId', 'uid']);

    // 5. Leave Balances
    const balanceDocIds = new Set<string>();
    for (const id of allIds) {
        try {
            const q = query(collection(db, LEAVE_BALANCES_COL), where('employeeId', '==', id));
            const snap = await getDocs(q);
            snap.docs.forEach(d => balanceDocIds.add(d.id));
            const directDoc = await getDoc(doc(db, LEAVE_BALANCES_COL, id));
            if (directDoc.exists()) balanceDocIds.add(directDoc.id);
        } catch {}
    }
    results['Leave Balances'] = balanceDocIds.size;

    // 6. Attendance
    results['Attendance'] = await countUniqueMatchingDocs('attendance', ['userId', 'employeeId']);

    // 7. User Engagement & Streaks
    const engDocIds = new Set<string>();
    for (const id of allIds) {
        try {
            const q = query(collection(db, 'user_engagement'), where('userId', '==', id));
            const snap = await getDocs(q);
            snap.docs.forEach(d => engDocIds.add(d.id));
            const directDoc = await getDoc(doc(db, 'user_engagement', id));
            if (directDoc.exists()) engDocIds.add(directDoc.id);
        } catch {}
    }
    results['Engagement & Streaks'] = engDocIds.size;

    // 8. Complaints & Grievances
    results['Complaints & Grievances'] = await countUniqueMatchingDocs('complaints', ['userId', 'employeeId']);

    // 9. Reward Redemptions
    results['Reward Redemptions'] = await countUniqueMatchingDocs('reward_redemptions', ['userId', 'employeeId']);

    // 10. Background Checks (BGV)
    results['Background Checks (BGV)'] = await countUniqueMatchingDocs('bgv_records', ['employeeId', 'targetId']);

    // 11. Correction Requests
    results['Correction Requests'] = await countUniqueMatchingDocs('correction_requests', ['targetId', 'submissionId']);

    // 12. Notifications
    results['Notifications'] = await countUniqueMatchingDocs(NOTIFICATIONS_COL, ['targetUserId']);

    // 13. Onboarding Submissions
    let subCount = 0;
    if (ctx.submissionId) subCount = 1;
    else {
        subCount = await countUniqueMatchingDocs(SUBMISSIONS_COLLECTION, ['employeeId', 'linkedUid']);
    }
    results['Onboarding Submissions'] = subCount;

    // 14. Application Drafts
    const draftDocIds = new Set<string>();
    for (const id of allIds) {
        try {
            const q = query(collection(db, DRAFTS_COLLECTION), where('ownerUid', '==', id));
            const snap = await getDocs(q);
            snap.docs.forEach(d => draftDocIds.add(d.id));
        } catch {}
    }
    if (ctx.email) {
        try {
            const q = query(collection(db, DRAFTS_COLLECTION), where('ownerEmail', '==', ctx.email));
            const snap = await getDocs(q);
            snap.docs.forEach(d => draftDocIds.add(d.id));
        } catch {}
    }
    results['Application Drafts'] = draftDocIds.size;

    // 15. Google Drive Folder
    results['Google Drive Folder'] = ctx.driveFolderName ? 1 : 0;

    return results;
};

export const permanentDeleteEmployee = async (
    employeeId: string,
    employeeName?: string,
    deep: boolean = true
) => {
    const ctx = await resolveEmployeeFullContext(employeeId);
    const resolvedName = employeeName || ctx.applicantName || 'Unknown';
    const resolvedEmpId = ctx.employeeId || employeeId;

    log.log(`[PERMANENT_DELETE] Deleting employee ${resolvedName} (${resolvedEmpId}), deep=${deep}...`);

    if (deep) {
        // 1. Permanently delete Google Drive folder
        if (ctx.driveFolderName || (resolvedName && resolvedEmpId)) {
            try {
                await permanentDeleteEmployeeFolder(resolvedName, resolvedEmpId, ctx.driveFolderName);
            } catch (err) {
                log.error(`Drive deletion failed for ${resolvedEmpId}:`, err);
            }
        }

        // 2. Wipe Firebase Storage folder independently
        try {
            const storageFolders = new Set<string>();
            if (ctx.employeeId) storageFolders.add(`employees/${ctx.employeeId}`);
            if (ctx.docId && ctx.docId !== ctx.employeeId) storageFolders.add(`employees/${ctx.docId}`);
            if (ctx.submissionId) storageFolders.add(`onboarding/${ctx.submissionId}`);
            if (ctx.uid) storageFolders.add(`onboarding/${ctx.uid}`);

            for (const folder of storageFolders) {
                await deleteStorageFolder(folder).catch(() => {});
            }
        } catch (err) {
            log.error(`Storage deletion failed for ${resolvedEmpId}:`, err);
        }

        // 3. Delete Onboarding Submission Doc if exists
        if (ctx.submissionId) {
            await deleteDoc(doc(db, SUBMISSIONS_COLLECTION, ctx.submissionId)).catch(() => {});
        }
        for (const id of ctx.allIds) {
            if (isPortalId(id)) {
                await deleteDoc(doc(db, SUBMISSIONS_COLLECTION, id)).catch(() => {});
            }
        }
    }

    // 4. Cascading Delete associated request and operational records
    await deleteAssociatedRecords(ctx);

    // 5. Delete Employee Doc(s) in Firestore
    if (ctx.docId) {
        await deleteDoc(doc(db, EMPLOYEES_COLLECTION, ctx.docId)).catch(() => {});
    }
    if (ctx.employeeId && ctx.employeeId !== ctx.docId) {
        await deleteDoc(doc(db, EMPLOYEES_COLLECTION, ctx.employeeId)).catch(() => {});
    }
    for (const id of ctx.allIds) {
        await deleteDoc(doc(db, EMPLOYEES_COLLECTION, id)).catch(() => {});
    }
};

export const deleteSubmission = async (submissionId: string) => {
    await permanentDeleteEmployee(submissionId, undefined, true);
};

// Helper to filter out non-serializable objects (like Files) before saving to Firestore
const filterSerializable = (obj: any): any => {
    if (!obj || typeof obj !== 'object') return obj;
    if (obj instanceof File) return null; // Skip files in drafts

    if (Array.isArray(obj)) {
        return obj.map(item => filterSerializable(item));
    }

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
        result[key] = filterSerializable(value);
    }
    return result;
};

export const saveFormDraft = async (data: any, sectionIndex: number, draftId?: string) => {
    const user = await ensureAuthenticated();
    
    // Always use the draftId (which is the pre-generated Portal ID) if provided.
    // If not provided and user is authenticated (e.g. Google user), reuse their existing cloud draft if one exists.
    let id = draftId;
    if (!id && !user.isAnonymous) {
        try {
            const existingDraft = await getDraftByUser(user.uid, user.email);
            if (existingDraft?.id) {
                id = existingDraft.id;
            }
        } catch (e) {
            console.warn("Could not check existing draft for user:", e);
        }
    }

    if (!id) {
        id = isPortalId(user.uid) ? user.uid : await getNextSubmissionId();
    }

    // CRITICAL GUARD: Check if this ID (or this Google user) is already an active employee or submitted!
    // If they are already active or submitted, we MUST NOT recreate/resurrect a draft.
    if (id) {
        try {
            const empRef = doc(db, EMPLOYEES_COLLECTION, id);
            const empSnap = await getDoc(empRef);
            if (empSnap.exists()) {
                console.warn(`[saveFormDraft] ${id} is already an active employee in company directory. Aborting draft save.`);
                try { await deleteDoc(doc(db, DRAFTS_COLLECTION, id)); } catch(e) {}
                throw new Error(`APPLICATION_ALREADY_SUBMITTED:${id}`);
            }
        } catch (empErr: any) {
            if (empErr?.message?.includes('APPLICATION_ALREADY_SUBMITTED')) {
                throw empErr;
            }
        }

        try {
            const subRef = doc(db, SUBMISSIONS_COLLECTION, id);
            const subSnap = await getDoc(subRef);
            if (subSnap.exists()) {
                const subData = subSnap.data();
                if (subData.status !== 'Rejected' && subData.status !== 'Deleted' && !subData.deletedAt) {
                    console.warn(`[saveFormDraft] Submission ${id} already exists in final submissions. Aborting draft save.`);
                    try { await deleteDoc(doc(db, DRAFTS_COLLECTION, id)); } catch(e) {}
                    throw new Error(`APPLICATION_ALREADY_SUBMITTED:${id}`);
                }
            }
        } catch (subErr: any) {
            if (subErr?.message?.includes('APPLICATION_ALREADY_SUBMITTED')) {
                throw subErr;
            }
            // Guest users cannot read onboarding_submissions; safe to proceed with draft save
        }
    }
    if (!user.isAnonymous) {
        try {
            const qSub = query(collection(db, SUBMISSIONS_COLLECTION), where("linkedUid", "==", user.uid), limit(1));
            const snapSub = await getDocs(qSub);
            if (!snapSub.empty) {
                const existingSubDoc = snapSub.docs[0];
                const existingData = existingSubDoc.data();
                if (existingData.status !== 'Rejected' && existingData.status !== 'Deleted' && !existingData.deletedAt) {
                    console.warn(`[saveFormDraft] User ${user.uid} already has an active submission ${existingSubDoc.id}. Aborting draft save.`);
                    try { await deleteDoc(doc(db, DRAFTS_COLLECTION, existingSubDoc.id)); } catch(e) {}
                    throw new Error(`APPLICATION_ALREADY_SUBMITTED:${existingSubDoc.id}`);
                }
            }
        } catch (qErr: any) {
            if (qErr?.message?.includes('APPLICATION_ALREADY_SUBMITTED')) {
                throw qErr;
            }
            // Safely ignore permission errors on list query
        }
    }
        
    const draftRef = doc(db, DRAFTS_COLLECTION, id);

    // Filter out Files (they can't be saved to Firestore)
    const serializableData = filterSerializable(data);

    // Check for referral invite token in data or session/local storage
    const referralInviteId = (data as any)?.__referralInviteId ||
        (data as any)?.referralInviteId ||
        (typeof window !== 'undefined'
            ? (sessionStorage.getItem('referralInviteId') || localStorage.getItem('referralInviteId') || null)
            : null);

    const draftPayload: any = {
        data: serializableData,
        sectionIndex,
        lastUpdated: new Date().toISOString(),
        id,
        ownerUid: user.uid,
        ownerEmail: user.email || null,
        isGoogleDraft: !user.isAnonymous
    };

    if (referralInviteId) {
        draftPayload.inviteId = referralInviteId;
        if (!draftPayload.data.__referralInviteId) {
            draftPayload.data.__referralInviteId = referralInviteId;
        }
    }

    await setDoc(draftRef, draftPayload, { merge: true });
    return id;
};

export const checkIfSubmissionCompleted = async (
    submissionId?: string,
    linkedUid?: string | null,
    email?: string | null
): Promise<{ isSubmitted: boolean; submissionId?: string }> => {
    if (submissionId) {
        try {
            const subRef = doc(db, SUBMISSIONS_COLLECTION, submissionId);
            const subSnap = await getDoc(subRef);
            if (subSnap.exists()) {
                const data = subSnap.data();
                if (data.status !== 'Rejected' && data.status !== 'Deleted' && !data.deletedAt) {
                    return { isSubmitted: true, submissionId: subSnap.id };
                }
            }
        } catch (e) {
            // Permission denied is expected for unauthenticated candidates checking unsubmitted IDs
        }
    }
    if (linkedUid) {
        try {
            const q = query(
                collection(db, SUBMISSIONS_COLLECTION),
                where("linkedUid", "==", linkedUid),
                limit(1)
            );
            const snap = await getDocs(q);
            if (!snap.empty) {
                const data = snap.docs[0].data();
                if (data.status !== 'Rejected' && data.status !== 'Deleted' && !data.deletedAt) {
                    return { isSubmitted: true, submissionId: snap.docs[0].id };
                }
            }
        } catch (e) {
            // Permission denied on collection query is expected for non-admin users
        }
    }
    if (email) {
        try {
            const normalizedEmail = email.toLowerCase().trim();
            const qEmail = query(
                collection(db, SUBMISSIONS_COLLECTION),
                where("linkedGoogleEmail", "==", normalizedEmail),
                limit(1)
            );
            const snapEmail = await getDocs(qEmail);
            if (!snapEmail.empty) {
                const data = snapEmail.docs[0].data();
                if (data.status !== 'Rejected' && data.status !== 'Deleted' && !data.deletedAt) {
                    return { isSubmitted: true, submissionId: snapEmail.docs[0].id };
                }
            }
        } catch (e) {
            // Permission denied on collection query is expected for non-admin users
        }
    }
    return { isSubmitted: false };
};

export const deleteFormDraft = async (draftId: string) => {
    await deleteDoc(doc(db, DRAFTS_COLLECTION, draftId));
};

export const discardFormDraft = async (draftId: string) => {
    const user = auth.currentUser;
    if (!user) return;
    
    // 1. Delete files in Storage FIRST while the Firestore draft still exists to prove ownership
    try {
        if (draftId && draftId !== user.uid) {
            await deleteStorageFolder(`onboarding/${draftId}`);
        }
        await deleteStorageFolder(`onboarding/${user.uid}`);
    } catch (storageErr) {
        // Non-fatal if storage folder was already empty or not yet created
        console.warn('Non-fatal storage cleanup warning during draft discard:', storageErr);
    }

    // 2. Delete the Firestore document AFTER files have been deleted
    await deleteFormDraft(draftId);
};

export const bulkSoftDeleteSubmissions = async (ids: string[]) => {
    const batch = writeBatch(db);
    const results = { success: 0, errors: [] as string[] };

    // 1. Fetch all submission data in chunks (Firestore 'in' limit is 30)
    const chunks = [];
    for (let i = 0; i < ids.length; i += 30) {
        chunks.push(ids.slice(i, i + 30));
    }

    const submissions: OnboardingSubmission[] = [];
    for (const chunk of chunks) {
        const q = query(collection(db, SUBMISSIONS_COLLECTION), where("__name__", "in", chunk));
        const snap = await getDocs(q);
        submissions.push(...snap.docs.map(d => ({ id: d.id, ...d.data() } as OnboardingSubmission)));
    }

    // 1.5 Fetch existing employee IDs to avoid "No document to update" errors
    const employeeIdsToCheck = [...new Set(submissions
        .map(s => s.employeeId)
        .filter(id => id && !isPortalId(id)))] as string[];

    const existingEmployeeIds = new Set<string>();
    if (employeeIdsToCheck.length > 0) {
        const empChunks = [];
        for (let i = 0; i < employeeIdsToCheck.length; i += 30) {
            empChunks.push(employeeIdsToCheck.slice(i, i + 30));
        }
        for (const chunk of empChunks) {
            const q = query(collection(db, EMPLOYEES_COLLECTION), where("__name__", "in", chunk));
            const snap = await getDocs(q);
            snap.docs.forEach(d => existingEmployeeIds.add(d.id));
        }
    }

    // 2. Process each submission
    for (const sub of submissions) {
        try {
            const subRef = doc(db, SUBMISSIONS_COLLECTION, sub.id);
            batch.update(subRef, {
                deletedAt: new Date().toISOString(),
                status: 'Deleted'
            });

            const applicantName = sub.applicantName || getApplicantName(sub.formData, sub.originalFormSections) || 'Unknown';
            const currentUniqueId = sub.employeeId && !isPortalId(sub.employeeId)
                ? sub.employeeId
                : sub.id;

            // Trigger Drive movement (async, we don't strictly wait to speed up, but a Promise.all would be safer)
            // For bulk, let's fire and forget Drive moves to keep the UI responsive, or use Promise.all.
            // Using Promise.all is better for reliability.
            moveEmployeeFolderToRecycleBin(applicantName, currentUniqueId, sub.driveFolderName).catch(err => {
                log.error(`Bulk Drive Move Error for ${sub.id}: `, err);
            });

            // 3. If it's an approved employee, soft delete the employee record too (only if it exists)
            if (sub.employeeId && sub.employeeId !== sub.id && !isPortalId(sub.employeeId) && existingEmployeeIds.has(sub.employeeId)) {
                const empRef = doc(db, EMPLOYEES_COLLECTION, sub.employeeId);
                batch.update(empRef, {
                    deletedAt: new Date().toISOString(),
                    isActive: false
                });
            }
            results.success++;
        } catch (err: any) {
            results.errors.push(`${sub.id}: ${err.message} `);
        }
    }

    await batch.commit();
    return results;
};

export const bulkPermanentDeleteSubmissions = async (ids: string[]) => {
    const batch = writeBatch(db);
    const results = { success: 0, errors: [] as string[] };

    // 1. Fetch all submission data
    const chunks = [];
    for (let i = 0; i < ids.length; i += 30) {
        chunks.push(ids.slice(i, i + 30));
    }

    const submissions: OnboardingSubmission[] = [];
    for (const chunk of chunks) {
        const q = query(collection(db, SUBMISSIONS_COLLECTION), where("__name__", "in", chunk));
        const snap = await getDocs(q);
        submissions.push(...snap.docs.map(d => ({ id: d.id, ...d.data() } as OnboardingSubmission)));
    }

    // 1.5 Fetch existing employee IDs for safety
    const employeeIdsToCheck = [...new Set(submissions
        .map(s => s.employeeId)
        .filter(id => id && !isPortalId(id)))] as string[];

    const existingEmployeeIds = new Set<string>();
    if (employeeIdsToCheck.length > 0) {
        const empChunks = [];
        for (let i = 0; i < employeeIdsToCheck.length; i += 30) {
            empChunks.push(employeeIdsToCheck.slice(i, i + 30));
        }
        for (const chunk of empChunks) {
            const q = query(collection(db, EMPLOYEES_COLLECTION), where("__name__", "in", chunk));
            const snap = await getDocs(q);
            snap.docs.forEach(d => existingEmployeeIds.add(d.id));
        }
    }

    for (const sub of submissions) {
        try {
            const applicantName = getApplicantName(sub.formData, sub.originalFormSections) || 'Unknown';
            const currentUniqueId = sub.employeeId && !isPortalId(sub.employeeId)
                ? sub.employeeId
                : sub.id;

            // 1. Delete Drive Folder (AWAIT this for reliability in bulk)
            try {
                await permanentDeleteEmployeeFolder(applicantName, currentUniqueId, sub.driveFolderName);
            } catch (err) {
                log.error(`Bulk Drive Permanent Delete Error for ${sub.id}: `, err);
                results.errors.push(`${sub.id}: Drive delete failed, skipping database delete.`);
                continue; // Skip the rest of this item to prevent orphaned files
            }

            // 1.5. Wipe Firebase Storage folder independently
            try {
                await deleteStorageFolder(`onboarding/${sub.id}`);
                if (sub.linkedUid) {
                    await deleteStorageFolder(`onboarding/${sub.linkedUid}`);
                }
                if (sub.employeeId) {
                    await deleteStorageFolder(`employees/${sub.employeeId}`);
                }
            } catch (err) {
                log.error(`Bulk Storage Delete Error for ${sub.id}: `, err);
            }

            // 2. Delete Employee Doc if exists
            if (sub.employeeId && sub.employeeId !== sub.id && !isPortalId(sub.employeeId) && existingEmployeeIds.has(sub.employeeId)) {
                const empRef = doc(db, EMPLOYEES_COLLECTION, sub.employeeId);
                batch.delete(empRef);
                // Cascading delete associated records (Note: this is async and not batchable easily)
                deleteAssociatedRecords(sub.employeeId).catch(err => {
                    log.error(`Bulk Cascade Delete Error for ${sub.employeeId}: `, err);
                });
            }

            // 3. Delete Submission Doc
            batch.delete(doc(db, SUBMISSIONS_COLLECTION, sub.id));

            // Accidental SUB-ID records
            if (isPortalId(sub.id)) {
                deleteAssociatedRecords(sub.id).catch(err => {
                    log.error(`Bulk Cascade Delete Error for ${sub.id}: `, err);
                });
            }

            results.success++;
        } catch (err: any) {
            results.errors.push(`${sub.id}: ${err.message} `);
        }
    }

    await batch.commit();
    return results;
};

export const deleteWorkflowRequest = async (collectionName: string, id: string) => {
    await deleteDoc(doc(db, collectionName, id));
};

export const deleteDisciplinaryAction = async (id: string) => {
    await deleteDoc(doc(db, DISCIPLINARY_COL, id));
};
export const verifyEmployeeLogin = async (employeeId: string, password: string, uid?: string) => {
    try {
        const verifyFn = httpsCallable(functions, 'verifyEmployeePassword');
        const response = await verifyFn({ employeeId, password });
        const result = response.data as any;

        if (result && result.success) {
            // Find the user data to return
            const qSub = query(
                collection(db, SUBMISSIONS_COLLECTION),
                where("employeeId", "==", employeeId),
                where("status", "==", "Approved")
            );
            const snapSub = await getDocs(qSub);
            
            if (!snapSub.empty) {
                const doc = snapSub.docs[0];
                if (uid) await updateDoc(doc.ref, { uid });
                const sub = doc.data() as any;
                return {
                    id: doc.id,
                    ...sub,
                    data: { ...(sub.formData || {}), ...(sub.data || {}) }
                } as SubmittedFormData;
            }

            const qEmp = query(
                collection(db, EMPLOYEES_COLLECTION),
                where("employeeId", "==", employeeId)
            );
            const snapEmp = await getDocs(qEmp);

            if (!snapEmp.empty) {
                const doc = snapEmp.docs[0];
                if (uid) await updateDoc(doc.ref, { uid });
                const emp = doc.data() as any;
                return {
                    id: doc.id,
                    ...emp,
                    status: 'Approved',
                    data: emp.profileData || {}
                } as unknown as SubmittedFormData;
            }
        }
        return null;
    } catch (e) {
        log.error("Login verification failed via Cloud Function:", e);
        return null;
    }
};

export const getSiteHeadcounts = async (sites: Site[], formSections: FormSection[]) => {
    const unitField = formSections
        .flatMap(s => s.fields || [])
        .find(f => f && f.label && (f.label.toLowerCase().includes('unit') || f.label.toLowerCase().includes('facility')));

    if (!unitField) return {};

    const counts: Record<string, number> = {};

    const promises = sites.map(async (site) => {
        try {
            const q = query(
                collection(db, EMPLOYEES_COLLECTION),
                where("isActive", "==", true),
                where(`data.${unitField.id}`, "==", site.name)
            );
            const snapshot = await getCountFromServer(q);
            counts[site.name] = snapshot.data().count;
        } catch (err) {
            log.log("[getSiteHeadcounts] Headcount query failed/restricted for site:", site.name, err);
            counts[site.name] = 0;
        }
    });

    await Promise.all(promises);
    return counts;
};

export const getEmployeeLookupMap = async (formSections: FormSection[], allowedSiteIds?: string[]) => {
    const unitField = formSections
        .flatMap(s => s.fields || [])
        .find(f => f && f.label && (f.label.toLowerCase().includes('unit') || f.label.toLowerCase().includes('facility')));

    // Fallback lookup if unitField is missing
    const unitFieldId = unitField?.id;

    const snapshot = await getDocs(collection(db, EMPLOYEES_COLLECTION));
    const lookup: Record<string, { name: string, siteName: string, id: string }> = {};

    snapshot.docs.forEach(doc => {
        const data = doc.data() as any;
        
        // Scope filter
        if (allowedSiteIds && allowedSiteIds.length > 0) {
            const currentSiteId = data.currentSiteId || '';
            const assignedSiteIds = data.assignedSiteIds || [];
            const hasMatch = allowedSiteIds.includes(currentSiteId) || assignedSiteIds.some((id: string) => allowedSiteIds.includes(id));
            if (!hasMatch) return;
        }

        const empId = data.employeeId || doc.id;
        lookup[empId] = {
            id: doc.id,
            name: data.applicantName || 'Unknown',
            siteName: data.siteName || (unitFieldId ? (data.data?.[unitFieldId] || '') : '')
        };
    });

    return lookup;
};

export const purgeEmployeesCollection = async () => {
    const snap = await getDocs(collection(db, EMPLOYEES_COLLECTION));

    for (const docSnap of snap.docs) {
        const empId = docSnap.id;
        // 1. Cascading sweep for EVERY employee (Wipe traces)
        await deleteAssociatedRecords(empId);

        // 2. Drive Cleanup
        const empData = docSnap.data() as any;
        const employeeName = empData.applicantName || 'Unknown';
        const folderName = empData.driveFolderName;
        permanentDeleteEmployeeFolder(employeeName, empId, folderName).catch(e => log.error("Purge Drive Error:", e));

        // 3. Main Doc Delete
        await deleteDoc(docSnap.ref);
    }

    return snap.size;
};

export const getDashboardAnalytics = async (
    sites: Site[],
    formSections: FormSection[],
    leavePolicy: LeavePolicy | null,
    allowed?: { employees: boolean; leaves: boolean },
    allowedSiteIds?: string[]
): Promise<DashboardAnalytics> => {
    // 1. Headcount by Site
    let headcountBySite: Record<string, number> = {};
    if (allowed?.employees !== false) {
        try {
            let filteredSites = sites;
            if (allowedSiteIds) {
                filteredSites = sites.filter(s => allowedSiteIds.includes(s.id));
            }
            headcountBySite = await getSiteHeadcounts(filteredSites, formSections);
        } catch (e) {
            log.log("[getDashboardAnalytics] Headcount by site query skipped/restricted:", e);
        }
    }

    // 2. Recent Hires (Last 30 Days)
    let recentHires = 0;
    if (allowed?.employees !== false) {
        try {
            if (allowedSiteIds && allowedSiteIds.length === 0) {
                recentHires = 0;
            } else {
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                if (!allowedSiteIds) {
                    const hiresQuery = query(
                        collection(db, EMPLOYEES_COLLECTION),
                        where("joiningDate", ">=", thirtyDaysAgo.toISOString())
                    );
                    const hiresSnap = await getCountFromServer(hiresQuery);
                    recentHires = hiresSnap.data().count;
                } else {
                    const hiresQuery = query(
                        collection(db, EMPLOYEES_COLLECTION),
                        where("joiningDate", ">=", thirtyDaysAgo.toISOString())
                    );
                    const { getDocs } = await import('firebase/firestore');
                    const snap = await getDocs(hiresQuery);
                    recentHires = snap.docs.filter(d => allowedSiteIds.includes(d.data().currentSiteId)).length;
                }
            }
        } catch (e) {
            log.log("[getDashboardAnalytics] Recent hires query skipped/restricted:", e);
        }
    }

    // 3. Leaves by Type (Pending vs Approved)
    const leavesByType: Record<string, { pending: number, approved: number }> = {};
    if (allowed?.leaves !== false && leavePolicy && leavePolicy.leaveTypes) {
        const promises = leavePolicy.leaveTypes.map(async (type) => {
            try {
                if (allowedSiteIds && allowedSiteIds.length === 0) {
                    leavesByType[type.label] = { pending: 0, approved: 0 };
                    return;
                }
                let pendingQ = query(
                    collection(db, LEAVE_REQ_COL),
                    where("leaveType", "==", type.typeId),
                    where("status", "==", "Pending")
                );
                let approvedQ = query(
                    collection(db, LEAVE_REQ_COL),
                    where("leaveType", "==", type.typeId),
                    where("status", "==", "Approved")
                );

                if (allowedSiteIds) {
                    pendingQ = query(pendingQ, where("siteId", "in", allowedSiteIds.slice(0, 10)));
                    approvedQ = query(approvedQ, where("siteId", "in", allowedSiteIds.slice(0, 10)));
                }

                const [pendingSnap, approvedSnap] = await Promise.all([
                    getCountFromServer(pendingQ),
                    getCountFromServer(approvedQ)
                ]);

                leavesByType[type.label] = {
                    pending: pendingSnap.data().count,
                    approved: approvedSnap.data().count
                };
            } catch (err) {
                log.log("[getDashboardAnalytics] Leaves by type query skipped/restricted:", type.label, err);
                leavesByType[type.label] = { pending: 0, approved: 0 };
            }
        });
        await Promise.all(promises);
    }

    return {
        headcountBySite,
        leavesByType,
        recentHires
    };
};

// Helper to safely format ISO strings for timeline
const safeIsoDate = (val: any): string => {
    if (!val) return new Date().toISOString();
    if (typeof val === 'string') {
        const parsed = new Date(val);
        return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
    }
    if (val?.toDate && typeof val.toDate === 'function') {
        try { return val.toDate().toISOString(); } catch (_) {}
    }
    if (val?.seconds) {
        try { return new Date(val.seconds * 1000).toISOString(); } catch (_) {}
    }
    return new Date().toISOString();
};

// --- Timeline ---
export const getEmployeeTimeline = async (employeeId: string): Promise<TimelineEvent[]> => {
    const events: TimelineEvent[] = [];
    if (!employeeId) return events;

    // 1. Deep resolution of employee or submission data
    const empData: any = await getEmployeeById(employeeId);

    // Collect all related IDs (doc ID, employeeId, submissionId, temporaryId, previousEmployeeId)
    const idSet = new Set<string>([employeeId, employeeId.trim(), employeeId.trim().toUpperCase()]);
    if (empData) {
        if (empData.id) idSet.add(empData.id);
        if (empData.employeeId) idSet.add(empData.employeeId);
        if (empData.submissionId) idSet.add(empData.submissionId);
        if (empData.temporaryId) idSet.add(empData.temporaryId);
        if (empData.previousEmployeeId) idSet.add(empData.previousEmployeeId);
    }
    const relatedIds = Array.from(idSet).filter(Boolean);
    const primaryEmpId = empData?.employeeId || employeeId;

    const applicantName = empData?.applicantName 
        || empData?.profileData?.applicantName 
        || empData?.profileData?.['Applicant Name'] 
        || empData?.profileData?.['Full Name'] 
        || empData?.data?.['Applicant Name'] 
        || empData?.data?.['Full Name'] 
        || empData?.name 
        || 'Employee';

    const designation = empData?.designation 
        || empData?.profileData?.designation 
        || empData?.data?.designation 
        || 'Security Guard';

    const siteName = empData?.currentSite || empData?.siteName || empData?.siteId || '';
    const siteText = siteName ? ` at ${siteName}` : '';

    // 2. Add Onboarding Submission Event (checks timestamp, submittedAt, createdAt)
    const subDate = empData?.timestamp || empData?.submittedAt || empData?.createdAt;
    if (subDate) {
        events.push({
            id: `sub-${primaryEmpId}`,
            type: 'SUBMISSION',
            date: safeIsoDate(subDate),
            title: 'Onboarding Application Submitted',
            description: `${applicantName} submitted onboarding application for ${designation}${siteText}.`,
            status: empData?.status || 'Submitted',
            employeeId: primaryEmpId
        });
    }

    // 3. Add Approval & Workflow History Entries
    if (Array.isArray(empData?.approvalHistory)) {
        empData.approvalHistory.forEach((entry: any, idx: number) => {
            if (!entry) return;
            const entryStatus = entry.status || 'Reviewed';
            const isApproval = entryStatus === 'Approved' || entryStatus === 'APPROVED' || entryStatus === SubmissionStatus.APPROVED;
            const isRevert = entryStatus === 'Correction Requested' || entryStatus === 'Reverted';
            
            events.push({
                id: `approval-${idx}-${primaryEmpId}`,
                type: isApproval ? 'JOINED' : isRevert ? 'UPDATE' : 'SUBMISSION',
                date: safeIsoDate(entry.timestamp),
                title: isApproval ? `Approved by ${entry.actionByRole || 'Admin'}` : `Workflow: ${entryStatus}`,
                description: `${entry.actionBy ? `${entry.actionBy} (${entry.actionByRole || 'Admin'})` : (entry.actionByRole || 'Admin')} processed Level ${entry.level || 1}${entry.comments ? `: "${entry.comments}"` : '.'}`,
                status: entryStatus,
                employeeId: primaryEmpId
            });
        });
    }

    // 4. Add Official Joining Event
    const joinDate = empData?.joiningDate || empData?.dateOfJoining;
    if (joinDate) {
        events.push({
            id: `join-${primaryEmpId}`,
            type: 'JOINED',
            date: safeIsoDate(joinDate),
            title: 'Joined the Organization',
            description: `${applicantName} onboarded with Employee ID: ${primaryEmpId} as ${designation}${siteText}.`,
            status: 'Approved',
            employeeId: primaryEmpId
        });
    }

    // 5. Add Previous Stints / Rehire History
    if (Array.isArray(empData?.employmentHistory)) {
        empData.employmentHistory.forEach((stint: any, idx: number) => {
            if (!stint) return;
            if (stint.joiningDate) {
                events.push({
                    id: `stint-join-${idx}`,
                    type: 'JOINED',
                    date: safeIsoDate(stint.joiningDate),
                    title: `Previous Employment Stint (${stint.siteId || 'Site'})`,
                    description: `Worked from ${safeIsoDate(stint.joiningDate).split('T')[0]} to ${stint.relievingDate ? safeIsoDate(stint.relievingDate).split('T')[0] : 'Relieved'}. Reason: ${stint.relievingReason || 'N/A'}`,
                    status: 'Relieved',
                    employeeId: stint.employeeId || primaryEmpId
                });
            }
        });
    }

    // 6. Add Relieving Event
    if (empData?.isRelieved || empData?.relievingDate) {
        events.push({
            id: `relieve-${primaryEmpId}`,
            type: 'RELIEVED',
            date: safeIsoDate(empData?.relievingDate),
            title: 'Relieved from Service',
            description: `Relieved from ${siteName || 'duty'}. Reason: ${empData?.relievingReason || 'Not specified'}.`,
            status: 'Relieved',
            employeeId: primaryEmpId
        });
    }

    // 7. Fetch Leave Requests across all related IDs
    try {
        const leavePromises = relatedIds.map(rid => 
            getDocs(query(collection(db, LEAVE_REQ_COL), where('employeeId', '==', rid))).catch(() => ({ forEach: () => {} } as any))
        );
        const leaveSnaps = await Promise.all(leavePromises);
        const seenLeaveIds = new Set<string>();

        leaveSnaps.forEach(snap => {
            snap.forEach((d: any) => {
                if (seenLeaveIds.has(d.id)) return;
                seenLeaveIds.add(d.id);
                const data = d.data();
                events.push({
                    id: `leave-${d.id}`,
                    type: 'LEAVE',
                    date: safeIsoDate(data.startDate || data.submittedAt || data.createdAt),
                    title: `Leave Request: ${data.leaveType || 'General'}`,
                    description: `${data.startDate || ''} to ${data.endDate || ''} — ${data.reason || 'No reason specified'}`,
                    status: data.status,
                    employeeId: primaryEmpId
                });
            });
        });
    } catch (_) {}

    // 8. Fetch Disciplinary Actions across all related IDs
    try {
        const discPromises = relatedIds.map(rid => 
            getDocs(query(collection(db, 'disciplinary_actions'), where('employeeId', '==', rid))).catch(() => ({ forEach: () => {} } as any))
        );
        const discSnaps = await Promise.all(discPromises);
        const seenDiscIds = new Set<string>();

        discSnaps.forEach(snap => {
            snap.forEach((d: any) => {
                if (seenDiscIds.has(d.id)) return;
                seenDiscIds.add(d.id);
                const data = d.data();
                events.push({
                    id: `disc-${d.id}`,
                    type: 'DISCIPLINE',
                    date: safeIsoDate(data.date || data.createdAt),
                    title: `Disciplinary: ${data.actionType || 'Action'}`,
                    description: data.description || data.reason || 'Disciplinary record logged.',
                    employeeId: primaryEmpId
                });
            });
        });
    } catch (_) {}

    // 9. Fetch Data Correction Requests across all related IDs
    try {
        const corrPromises = relatedIds.map(rid => 
            getDocs(query(collection(db, 'correction_requests'), where('submissionId', '==', rid))).catch(() => ({ forEach: () => {} } as any))
        );
        const corrSnaps = await Promise.all(corrPromises);
        const seenCorrIds = new Set<string>();

        corrSnaps.forEach(snap => {
            snap.forEach((d: any) => {
                if (seenCorrIds.has(d.id)) return;
                seenCorrIds.add(d.id);
                const data = d.data();
                events.push({
                    id: `corr-${d.id}`,
                    type: 'UPDATE',
                    date: safeIsoDate(data.requestedAt || data.createdAt),
                    title: 'Profile Correction Request',
                    description: `Correction link generated for fields: ${(data.targetFieldLabels || []).join(', ') || 'Profile data'}. Status: ${data.status || 'Pending'}`,
                    status: data.status,
                    employeeId: primaryEmpId
                });
            });
        });
    } catch (_) {}

    // 10. Fallback: If empData was found but yielded no specific event, add an active record overview
    if (events.length === 0 && empData) {
        events.push({
            id: `record-${primaryEmpId}`,
            type: empData.isRelieved ? 'RELIEVED' : empData.joiningDate ? 'JOINED' : 'SUBMISSION',
            date: safeIsoDate(empData.timestamp || empData.submittedAt || empData.createdAt || empData.joiningDate),
            title: empData.isRelieved ? 'Relieved Employee Record' : 'Active Employee Record',
            description: `${applicantName} (${primaryEmpId}) is registered in the system as ${designation}${siteText}.`,
            status: empData.status || (empData.isRelieved ? 'Relieved' : 'Active'),
            employeeId: primaryEmpId
        });
    }

    // Sort newest to oldest
    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return events;
};

// --- Search All Employees ---
export const searchAllEmployees = async (searchTerm: string) => {
    const results: any[] = [];
    if (!searchTerm.trim()) return results;

    const rawTerm = searchTerm.trim();
    const termUpper = rawTerm.toUpperCase();
    const termCapitalized = rawTerm.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    const digitsOnly = rawTerm.replace(/\D/g, '');

    const queries: any[] = [];

    // 1. Employees by applicantName (ALL-CAPS and Capitalized)
    queries.push(query(collection(db, EMPLOYEES_COLLECTION), where('applicantName', '>=', termUpper), where('applicantName', '<=', termUpper + '\uf8ff'), limit(20)));
    if (termCapitalized !== termUpper) {
        queries.push(query(collection(db, EMPLOYEES_COLLECTION), where('applicantName', '>=', termCapitalized), where('applicantName', '<=', termCapitalized + '\uf8ff'), limit(20)));
    }

    // 2. Employees by employeeId
    queries.push(query(collection(db, EMPLOYEES_COLLECTION), where('employeeId', '>=', termUpper), where('employeeId', '<=', termUpper + '\uf8ff'), limit(20)));

    // 3. Employees by phoneNumber
    if (digitsOnly.length >= 4) {
        queries.push(query(collection(db, EMPLOYEES_COLLECTION), where('phoneNumber', '>=', digitsOnly), where('phoneNumber', '<=', digitsOnly + '\uf8ff'), limit(20)));
    }

    // 4. Submissions by applicantName (ALL-CAPS and Capitalized)
    queries.push(query(collection(db, SUBMISSIONS_COLLECTION), where('applicantName', '>=', termUpper), where('applicantName', '<=', termUpper + '\uf8ff'), limit(20)));
    if (termCapitalized !== termUpper) {
        queries.push(query(collection(db, SUBMISSIONS_COLLECTION), where('applicantName', '>=', termCapitalized), where('applicantName', '<=', termCapitalized + '\uf8ff'), limit(20)));
    }

    // 5. Submissions by employeeId / temporaryId
    queries.push(query(collection(db, SUBMISSIONS_COLLECTION), where('employeeId', '>=', termUpper), where('employeeId', '<=', termUpper + '\uf8ff'), limit(20)));

    // 6. Submissions by phoneNumber
    if (digitsOnly.length >= 4) {
        queries.push(query(collection(db, SUBMISSIONS_COLLECTION), where('phoneNumber', '>=', digitsOnly), where('phoneNumber', '<=', digitsOnly + '\uf8ff'), limit(20)));
    }

    // Run parallel queries safely
    const snapshots = await Promise.all(
        queries.map(q => getDocs(q).catch(e => {
            console.warn("Search query variant failed:", e);
            return { forEach: () => {} } as any;
        }))
    );

    const addedIds = new Set<string>();

    snapshots.forEach(snap => {
        snap.forEach((docSnap: any) => {
            const data = docSnap.data();
            const id = docSnap.id;
            if (addedIds.has(id)) return;
            addedIds.add(id);

            const isSubmission = docSnap.ref.parent.id === SUBMISSIONS_COLLECTION;

            const extractName = (d: any) => d.applicantName || d.profileData?.applicantName || d.profileData?.['Applicant Name'] || d.profileData?.['Full Name'] || d.data?.['Applicant Name'] || d.data?.['Full Name'] || d.name || 'Unknown';
            const extractDesignation = (d: any) => d.designation || d.profileData?.designation || d.data?.designation || 'Security Guard';
            const extractSite = (d: any) => d.currentSite || d.siteName || d.profileData?.currentSite || d.siteId || 'N/A';

            results.push({
                id: id,
                name: extractName(data),
                employeeId: data.employeeId || id,
                designation: extractDesignation(data),
                status: isSubmission 
                    ? `Submission (${data.status || 'Pending'})` 
                    : (data.isDeleted ? 'Recycle Bin' : data.isRelieved ? 'Relieved' : 'Active'),
                type: isSubmission ? 'SUBMISSION' : 'EMPLOYEE',
                siteName: extractSite(data)
            });
        });
    });

    // Check direct ID match in both collections if not caught
    if (!addedIds.has(termUpper)) {
        try {
            const directEmp = await getDoc(doc(db, EMPLOYEES_COLLECTION, termUpper));
            if (directEmp.exists()) {
                const data = directEmp.data();
                addedIds.add(termUpper);
                const extractName = (d: any) => d.applicantName || d.profileData?.applicantName || d.profileData?.['Applicant Name'] || d.profileData?.['Full Name'] || d.data?.['Applicant Name'] || d.data?.['Full Name'] || d.name || 'Unknown';
                const extractDesignation = (d: any) => d.designation || d.profileData?.designation || d.data?.designation || 'Security Guard';
                const extractSite = (d: any) => d.currentSite || d.siteName || d.profileData?.currentSite || d.siteId || 'N/A';
                results.unshift({
                    id: termUpper,
                    name: extractName(data),
                    employeeId: data.employeeId || termUpper,
                    designation: extractDesignation(data),
                    status: data.isDeleted ? 'Recycle Bin' : data.isRelieved ? 'Relieved' : 'Active',
                    type: 'EMPLOYEE',
                    siteName: extractSite(data)
                });
            }
        } catch (_) {}
    }

    if (!addedIds.has(rawTerm)) {
        try {
            const directSub = await getDoc(doc(db, SUBMISSIONS_COLLECTION, rawTerm));
            if (directSub.exists()) {
                const data = directSub.data();
                addedIds.add(rawTerm);
                const extractName = (d: any) => d.applicantName || d.profileData?.applicantName || d.profileData?.['Applicant Name'] || d.profileData?.['Full Name'] || d.data?.['Applicant Name'] || d.data?.['Full Name'] || d.name || 'Unknown';
                const extractDesignation = (d: any) => d.designation || d.profileData?.designation || d.data?.designation || 'Security Guard';
                const extractSite = (d: any) => d.currentSite || d.siteName || d.profileData?.currentSite || d.siteId || 'N/A';
                results.unshift({
                    id: rawTerm,
                    name: extractName(data),
                    employeeId: data.employeeId || rawTerm,
                    designation: extractDesignation(data),
                    status: `Submission (${data.status || 'Pending'})`,
                    type: 'SUBMISSION',
                    siteName: extractSite(data)
                });
            }
        } catch (_) {}
    }

    return results;
};

// --- Admin Auth Management ---
export const adminUpdateEmployeeEmail = async (employeeId: string, newEmail: string) => {
    const adminControlEmployeeAuth = httpsCallable(functions, 'adminControlEmployeeAuth');
    await adminControlEmployeeAuth({ employeeId, action: 'update_email', payload: { email: newEmail } });
    
    // Also update profile display email in Firestore
    try {
        const empRef = doc(db, EMPLOYEES_COLLECTION, employeeId);
        await updateDoc(empRef, {
            email: newEmail,
            'profileData.personalDetails.email': newEmail,
            'data.email': newEmail
        });
    } catch (e) {
        log.warn("Failed to sync profile card display email in Firestore:", e);
    }
    await logSystemAction('UPDATE', 'AUTH', `Admin updated primary email for employee ${employeeId} to ${newEmail}`);
};

export const adminSetAuthProvider = async (employeeId: string, provider: 'google' | 'manual') => {
    const adminControlEmployeeAuth = httpsCallable(functions, 'adminControlEmployeeAuth');
    await adminControlEmployeeAuth({ employeeId, action: 'set_auth_provider', payload: { provider } });
    await logSystemAction('UPDATE', 'AUTH', `Admin changed authentication method for employee ${employeeId} to ${provider}`);
};

export const adminUnlinkGoogleAccount = async (employeeId: string) => {
    const adminControlEmployeeAuth = httpsCallable(functions, 'adminControlEmployeeAuth');
    await adminControlEmployeeAuth({ employeeId, action: 'unlink_google' });
    await logSystemAction('UPDATE', 'AUTH', `Admin unlinked Google authentication account for employee ${employeeId}`);
};

export const adminLinkGoogleEmail = async (employeeId: string, googleEmail: string) => {
    const adminControlEmployeeAuth = httpsCallable(functions, 'adminControlEmployeeAuth');
    await adminControlEmployeeAuth({ employeeId, action: 'link_google_email', payload: { googleEmail } });
    await logSystemAction('UPDATE', 'AUTH', `Admin linked Google account email "${googleEmail}" for employee ${employeeId}`);
};

export const adminResetEmployeePassword = async (employeeId: string, newPassword: string) => {
    const adminControlEmployeeAuth = httpsCallable(functions, 'adminControlEmployeeAuth');
    await adminControlEmployeeAuth({ employeeId, action: 'reset_password', payload: { newPassword } });
    await logSystemAction('UPDATE', 'AUTH', `Admin manually reset password for employee ${employeeId}`);
};

export const adminResetToDefaultPassword = async (employeeId: string): Promise<string> => {
    const adminControlEmployeeAuth = httpsCallable<any, { success: boolean; generatedPassword: string }>(functions, 'adminControlEmployeeAuth');
    const result = await adminControlEmployeeAuth({ employeeId, action: 'reset_to_default' });
    await logSystemAction('UPDATE', 'AUTH', `Admin reset password for employee ${employeeId} to system default`);
    return result.data.generatedPassword;
};

export const checkEmployeeStatus = async (employeeId: string) => {
    try {
        const checkFn = httpsCallable<{ employeeId: string }, { exists: boolean; isActive: boolean; needsProfileCompletion?: boolean; hasSecurityQuestion?: boolean; securityQuestion?: string }>(functions, 'checkForgotPasswordEmployeeStatus');
        const result = await checkFn({ employeeId });
        return result.data;
    } catch (error: any) {
        log.error("checkEmployeeStatus via Cloud Function failed:", error);
        throw error;
    }
};

/**
 * SELF-SERVICE: Reset password with strict identity verification.
 */
export const resetEmployeePassword = async (employeeId: string, details: any, newPassword: string) => {
    try {
        const verifyAndResetEmployeePassword = httpsCallable(functions, 'verifyAndResetEmployeePassword');
        await verifyAndResetEmployeePassword({ employeeId, verificationDetails: details, newPassword });
        log.log("Password reset successful for employee:", employeeId);
    } catch (error: any) {
        log.error("STRICT RESET REJECTED or failed:", error);
        throw new Error(error.message || "Verification failed. Please ensure details match your record exactly.");
    }
};

// --- Security Settings: Verify Password (Only check, don't change) ---
export const checkEmployeePassword = async (employeeId: string, currentPassword: string): Promise<void> => {
    try {
        const verifyEmployeePassword = httpsCallable(functions, 'verifyEmployeePassword');
        const res = await verifyEmployeePassword({ employeeId, password: currentPassword });
        if (!(res.data as any).success) {
            throw new Error("Incorrect current password.");
        }
    } catch (error: any) {
        log.error("Error verifying password:", error);
        throw new Error(error.message || "Incorrect current password or verification failed.");
    }
};

// --- Security Settings: Change Password ---
export const changePassword = async (employeeId: string, currentPassword: string, newPassword: string): Promise<void> => {
    if (newPassword.length < 6) throw new Error("New password must be at least 6 characters.");

    try {
        const changeEmployeePassword = httpsCallable(functions, 'changeEmployeePassword');
        await changeEmployeePassword({ employeeId, currentPassword, newPassword });
        log.log("Password changed for employee:", employeeId);
    } catch (error: any) {
        log.error("Error changing password:", error);
        throw new Error(error.message || "Incorrect current password or change failed.");
    }
};

// --- Security Settings: Link Google Account ---
export const linkGoogleAccount = async (
    employeeId: string,
    currentPassword: string,
    googleUid: string,
    googleEmail: string
): Promise<void> => {
    try {
        const linkEmployeeGoogleAccount = httpsCallable(functions, 'linkEmployeeGoogleAccount');
        await linkEmployeeGoogleAccount({
            employeeId,
            currentPassword,
            googleUid,
            email: googleEmail
        });
        log.log(`Linked Google Account (${googleEmail}) to employee: ${employeeId} via Cloud Function`);
    } catch (error: any) {
        log.error("Error linking Google account:", error);
        throw new Error(error.message || "Failed to link Google account.");
    }
};

// --- Security Settings: Unlink Google Account (self-service) ---
export const unlinkGoogleAccount = async (employeeId: string, currentPassword: string): Promise<void> => {
    try {
        const unlinkEmployeeGoogleAccount = httpsCallable(functions, 'unlinkEmployeeGoogleAccount');
        await unlinkEmployeeGoogleAccount({ employeeId, currentPassword });
        log.log(`Unlinked Google Account from employee: ${employeeId}`);
    } catch (error: any) {
        log.error("Error unlinking Google account:", error);
        throw new Error(error.message || "Failed to unlink Google account.");
    }
};
// --- Legacy Profile Claim ---
/**
 * Verifies a legacy employee's identity and links their current UID.
 * Returns the legacy data for auto-filling the joining form.
 */
export const claimLegacyProfile = async (employeeId: string, verificationData: Record<string, any>) => {
    // Note: ensureAuthenticated() is implicitly required by the cloud function, 
    // but the caller (UI) should handle the login prompt if they aren't signed in.
    try {
        const claimEmployeeProfile = httpsCallable<{ employeeId: string; verificationData: any }, { success: boolean; submissionId?: string; employeeName: string; legacyData: any; token?: string }>(functions, 'claimEmployeeProfile');
        const result = await claimEmployeeProfile({ employeeId, verificationData });
        return result.data;
    } catch (error: any) {
        log.error("Legacy Claim Failed:", error);
        throw error;
    }
};

// --- Data Correction Requests ---
const CORRECTION_REQUESTS_COLLECTION = 'correction_requests';

export const createCorrectionRequest = async (req: Omit<CorrectionRequest, 'id' | 'status' | 'createdAt'>): Promise<string> => {
    const requestId = uuidv4();
    
    // Resolve exact target document ID so requestDoc always has the exact Firestore document ID
    const targetCollection = req.targetType === 'employee' ? EMPLOYEES_COLLECTION : SUBMISSIONS_COLLECTION;
    let targetRef = doc(db, targetCollection, req.targetId);
    let targetSnap = await getDoc(targetRef);

    if (!targetSnap.exists() && req.targetType === 'employee') {
        const q = query(collection(db, EMPLOYEES_COLLECTION), where("employeeId", "==", req.targetId), limit(1));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
            targetRef = qSnap.docs[0].ref;
            targetSnap = qSnap.docs[0] as any;
        }
    }

    const resolvedTargetId = targetSnap.exists() ? targetRef.id : req.targetId;

    const requestDoc: any = {
        id: requestId,
        ...req,
        targetId: resolvedTargetId,
        expiresAt: Timestamp.fromDate(new Date(req.expiresAt)),
        status: 'pending',
        createdAt: Timestamp.now()
    };
    await setDoc(doc(db, CORRECTION_REQUESTS_COLLECTION, requestId), requestDoc);
    
    if (targetSnap.exists()) {
        await updateDoc(targetRef, { activeCorrectionToken: requestId });
    }
    
    await logSystemAction('CREATE', 'EMPLOYEES', `Issued data correction link for ${req.applicantName} (${req.targetId})`);
    return requestId;
};

export const getCorrectionRequest = async (requestId: string): Promise<CorrectionRequest | null> => {
    const docRef = doc(db, CORRECTION_REQUESTS_COLLECTION, requestId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const rawData = docSnap.data() as any;
        
        // Convert Timestamps to ISO strings for frontend compatibility
        const expiryDate = rawData.expiresAt && typeof rawData.expiresAt.toDate === 'function'
            ? rawData.expiresAt.toDate()
            : new Date(rawData.expiresAt);
            
        const createdDate = rawData.createdAt && typeof rawData.createdAt.toDate === 'function'
            ? rawData.createdAt.toDate()
            : new Date(rawData.createdAt);
            
        const data: CorrectionRequest = {
            ...rawData,
            expiresAt: expiryDate.toISOString(),
            createdAt: createdDate.toISOString()
        };
        
        // Auto-check expiry (computed dynamically to prevent guest write failures)
        const now = new Date();
        if (data.status === 'pending' && now > expiryDate) {
            data.status = 'expired';
        }
        
        return data;
    }
    return null;
};

export const submitCorrectionResponse = async (
    requestId: string,
    updatedData: Record<string, any>,
    onProgress?: (fieldId: string, status: 'loading' | 'done' | 'error', percent?: number) => void
): Promise<void> => {
    const requestRef = doc(db, CORRECTION_REQUESTS_COLLECTION, requestId);
    const requestSnap = await getDoc(requestRef);
    if (!requestSnap.exists()) throw new Error("Correction request not found");
    const req = requestSnap.data() as CorrectionRequest;
    if (req.status !== 'pending') throw new Error("Correction link has already been used or has expired.");
    
    // Check if target exists
    const targetCollection = req.targetType === 'employee' ? EMPLOYEES_COLLECTION : SUBMISSIONS_COLLECTION;
    let targetRef = doc(db, targetCollection, req.targetId);
    let targetSnap = await getDoc(targetRef);

    if (!targetSnap.exists() && req.targetType === 'employee') {
        const q = query(collection(db, EMPLOYEES_COLLECTION), where("employeeId", "==", req.targetId), limit(1));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
            targetRef = qSnap.docs[0].ref;
            targetSnap = qSnap.docs[0] as any;
        }
    }

    if (!targetSnap.exists()) throw new Error(`Target ${req.targetType} record not found`);
    const targetData = targetSnap.data() as any;
    
    const processedData = { ...updatedData };
    const targetName = req.applicantName || 'Employee';
    
    const getCleanFileName = (path: string): string => {
        if (!path) return '';
        const parts = path.split('/');
        const lastPart = parts[parts.length - 1];
        const underscoreIdx = lastPart.indexOf('_');
        if (underscoreIdx !== -1) {
            return lastPart.substring(underscoreIdx + 1);
        }
        return lastPart;
    };

    // 1. Process and upload any new Files (either File objects or background-uploaded string paths)
    for (const [key, value] of Object.entries(updatedData)) {
        if (value && typeof value === 'object' && 'storagePath' in value) {
            // Already resolved combined object, keep as is
            processedData[key] = value;
        } else if (value instanceof File) {
            onProgress?.(key, 'loading', 0);
            try {
                let storagePath = '';
                let driveUrl = '';
                
                // Auto-compress images client-side before upload
                const { autoCompressFile } = await import('./storageService');
                const fileToUpload = await autoCompressFile(value);

                if (req.targetType === 'employee') {
                    log.log(`[STORAGE] Uploading corrected file ${fileToUpload.name} for employee ${req.targetId}...`);
                    storagePath = await uploadEmployeeDocument(req.targetId, fileToUpload, key);
                } else {
                    log.log(`[STORAGE] Uploading corrected file ${fileToUpload.name} for submission ${req.targetId}...`);
                    storagePath = await uploadSubmissionDocument(key, fileToUpload, (percent) => {
                        onProgress?.(key, 'loading', Math.round(percent * 0.7));
                    }, req.targetId);
                }
                
                log.log(`[DRIVE] Uploading corrected file ${fileToUpload.name} to Drive...`);
                driveUrl = await uploadToDrive(fileToUpload, targetName, "Joining Documents", req.targetId);
                
                // Clean up old file if configured
                if (req.deleteOldFiles) {
                    const oldDoc = targetData.formData?.[key] || targetData.profileData?.[key] || targetData.data?.[key];
                    if (oldDoc && typeof oldDoc === 'object' && oldDoc.storagePath) {
                        log.log(`[STORAGE_CLEANUP] Deleting replaced file from Firebase Storage: ${oldDoc.storagePath}`);
                        try {
                            const { ref, deleteObject } = await import('firebase/storage');
                            const { storage } = await import('../firebase/config');
                            await deleteObject(ref(storage, oldDoc.storagePath));
                        } catch (delErr) {
                            log.error(`[STORAGE_CLEANUP] Failed to delete old storage file:`, delErr);
                        }
                    }
                }
                
                processedData[key] = {
                    storagePath,
                    driveUrl
                };
                onProgress?.(key, 'done', 100);
            } catch (err) {
                onProgress?.(key, 'error');
                throw err;
            }
        } else if (typeof value === 'string' && value.trim() !== '') {
            if (value.startsWith('onboarding/') || value.startsWith('employees/')) {
                // Background-uploaded storage path (starts with onboarding/ or employees/)
                onProgress?.(key, 'loading', 10);
                try {
                    log.log(`[DRIVE_BACKUP] Resolving background file: ${value}`);
                    const { getBlob, ref } = await import('firebase/storage');
                    const { storage } = await import('../firebase/config');
                    
                    const blob = await getBlob(ref(storage, value));
                    const cleanName = getCleanFileName(value);
                    const fileObj = new File([blob], cleanName, { type: blob.type });
                    
                    onProgress?.(key, 'loading', 50);
                    log.log(`[DRIVE_BACKUP] Uploading background file to Drive: ${cleanName}`);
                    const driveUrl = await uploadToDrive(fileObj, targetName, "Joining Documents", req.targetId);
                    
                    let finalStoragePath = value;
                    if (req.targetType === 'employee') {
                        // For employees, move it to employees/{empId}/joining/
                        const destPath = `employees/${req.targetId}/joining/${cleanName}`;
                        log.log(`[STORAGE_SYNC] Moving background file to employee path: ${destPath}`);
                        await moveStorageFiles(value, destPath);
                        finalStoragePath = destPath;
                    }
                    
                    // Clean up old file if configured
                    if (req.deleteOldFiles) {
                        const oldDoc = targetData.formData?.[key] || targetData.profileData?.[key] || targetData.data?.[key];
                        if (oldDoc && typeof oldDoc === 'object' && oldDoc.storagePath && oldDoc.storagePath !== finalStoragePath && oldDoc.storagePath !== value) {
                            log.log(`[STORAGE_CLEANUP] Deleting replaced file from Firebase Storage: ${oldDoc.storagePath}`);
                            try {
                                const { deleteObject } = await import('firebase/storage');
                                await deleteObject(ref(storage, oldDoc.storagePath));
                            } catch (delErr) {
                                log.error(`[STORAGE_CLEANUP] Failed to delete old storage file:`, delErr);
                            }
                        }
                    }
                    
                    processedData[key] = {
                        storagePath: finalStoragePath,
                        driveUrl
                    };
                    onProgress?.(key, 'done', 100);
                } catch (err) {
                    onProgress?.(key, 'error');
                    throw err;
                }
            }
        }
    }
    
    // 2. Prepare update payload
    const updates: Record<string, any> = {};
    updates.activeCorrectionToken = null;
    updates.lastUpdated = new Date().toISOString();
    
    if (req.targetType === 'employee') {
        // Update both 'profileData' and 'data' fields for consistency
        for (const [key, value] of Object.entries(processedData)) {
            updates[`profileData.${key}`] = value;
            updates[`data.${key}`] = value;
        }

        const combinedProfile = { ...(targetData.profileData || targetData.data || {}), ...processedData };
        const updatedPAN = getApplicantPAN(combinedProfile, targetData.originalFormSections);
        const updatedAadhaar = getApplicantAadhaar(combinedProfile, targetData.originalFormSections);
        const updatedUAN = getApplicantUAN(combinedProfile, targetData.originalFormSections);
        const updatedPhone = getApplicantPhone(combinedProfile, targetData.originalFormSections);

        if (updatedPAN) updates.panNumber = updatedPAN;
        if (updatedAadhaar) updates.aadhaarNumber = updatedAadhaar;
        if (updatedUAN) updates.uanNumber = updatedUAN;
        if (updatedPhone) updates.phoneNumber = updatedPhone;
    } else {
        // Pending submission updates 'formData' and 'data' (if data exists)
        for (const [key, value] of Object.entries(processedData)) {
            updates[`formData.${key}`] = value;
            if (targetData.data) {
                updates[`data.${key}`] = value;
            }
        }
        
        // Also update applicantName if name field was updated
        const combinedForm = { ...targetData.formData, ...processedData };
        const newName = getApplicantName(combinedForm, targetData.originalFormSections);
        if (newName && newName !== targetData.applicantName) {
            updates.applicantName = newName;
            updates.driveFolderName = `${req.targetId} - ${newName}`;
        }

        // Re-extract updated identifiers
        const updatedPAN = getApplicantPAN(combinedForm, targetData.originalFormSections);
        const updatedAadhaar = getApplicantAadhaar(combinedForm, targetData.originalFormSections);
        const updatedUAN = getApplicantUAN(combinedForm, targetData.originalFormSections);
        const updatedPhone = getApplicantPhone(combinedForm, targetData.originalFormSections);

        updates.panNumber = updatedPAN || null;
        updates.aadhaarNumber = updatedAadhaar || null;
        updates.uanNumber = updatedUAN || null;
        updates.phoneNumber = updatedPhone || null;

        // Re-evaluate duplicates with the updated identifiers safely (must never crash the applicant's submission)
        try {
            const duplicateCheckResult = await checkApplicantDuplicates({
                aadhaar: updatedAadhaar,
                pan: updatedPAN,
                uan: updatedUAN,
                phone: updatedPhone,
                currentSubId: req.targetId
            });
            updates.duplicateCheck = JSON.parse(JSON.stringify(duplicateCheckResult));
        } catch (dupErr) {
            log.warn("Non-fatal error re-checking duplicates on correction submission:", dupErr);
        }
    }
    
    // Perform Firestore update with sanitized payload (Firestore rejects undefined)
    const cleanUpdates = JSON.parse(JSON.stringify(updates));
    await updateDoc(targetRef, cleanUpdates);

    // Cross-sync: Re-evaluate any other pending submissions that previously matched targetId
    try {
        const qPending = query(
            collection(db, SUBMISSIONS_COLLECTION),
            where("status", "==", "Pending Review")
        );
        const pendingSnap = await getDocs(qPending);
        for (const docSnap of pendingSnap.docs) {
            if (docSnap.id === req.targetId) continue;
            const d = docSnap.data() as any;
            const hasTargetRef = d.duplicateCheck?.matches?.some((m: any) => m.submissionId === req.targetId) ||
                                 d.duplicateCheck?.submissionId === req.targetId;
            if (hasTargetRef) {
                const dForm = { ...(d.formData || {}), ...(d.data || {}) };
                const dSections = d.originalFormSections || [];
                const dPan = d.panNumber || getApplicantPAN(dForm, dSections);
                const dAadhaar = d.aadhaarNumber || getApplicantAadhaar(dForm, dSections);
                const dUan = d.uanNumber || getApplicantUAN(dForm, dSections);
                const dPhone = d.phoneNumber || getApplicantPhone(dForm, dSections);
                const freshDup = await checkApplicantDuplicates({
                    aadhaar: dAadhaar,
                    pan: dPan,
                    uan: dUan,
                    phone: dPhone,
                    currentSubId: docSnap.id
                });
                const cleanFreshDup = JSON.parse(JSON.stringify(freshDup));
                await updateDoc(doc(db, SUBMISSIONS_COLLECTION, docSnap.id), { duplicateCheck: cleanFreshDup });
            }
        }
    } catch (crossErr) {
        log.warn("Error cross-updating pending submission duplicates:", crossErr);
    }
    
    // 3. Mark correction request as completed
    await updateDoc(requestRef, {
        status: 'completed',
        completedAt: new Date().toISOString()
    });
};


// --- Manage Correction Requests ---

export const getAllCorrectionRequests = async (): Promise<CorrectionRequest[]> => {
    const q = query(
        collection(db, CORRECTION_REQUESTS_COLLECTION),
        orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    const requests: CorrectionRequest[] = [];
    
    const now = new Date();
    for (const d of snap.docs) {
        const data = d.data() as any;
        const expiryDate = data.expiresAt && typeof data.expiresAt.toDate === 'function'
            ? data.expiresAt.toDate()
            : new Date(data.expiresAt);
            
        const createdDate = data.createdAt && typeof data.createdAt.toDate === 'function'
            ? data.createdAt.toDate()
            : new Date(data.createdAt);
            
        let status = data.status;
        if (status === 'pending' && now > expiryDate) {
            status = 'expired';
        }
        
        requests.push({
            ...data,
            id: d.id,
            status,
            expiresAt: expiryDate.toISOString(),
            createdAt: createdDate.toISOString()
        } as CorrectionRequest);
    }
    return requests;
};

export const revokeCorrectionRequest = async (requestId: string): Promise<void> => {
    const docRef = doc(db, CORRECTION_REQUESTS_COLLECTION, requestId);
    await updateDoc(docRef, { status: 'expired' });
    await logSystemAction('UPDATE', 'EMPLOYEES', `Revoked data correction request link ${requestId}`);
};

export const deleteCorrectionRequest = async (
    requestId: string,
    targetType: 'employee' | 'submission',
    targetId: string
): Promise<void> => {
    // 1. Delete request doc
    const docRef = doc(db, CORRECTION_REQUESTS_COLLECTION, requestId);
    await deleteDoc(docRef);
    
    // 2. Clear activeCorrectionToken on target doc if it matches
    const targetColl = targetType === 'employee' ? EMPLOYEES_COLLECTION : SUBMISSIONS_COLLECTION;
    const targetRef = doc(db, targetColl, targetId);
    try {
        const targetSnap = await getDoc(targetRef);
        if (targetSnap.exists()) {
            const data = targetSnap.data() as any;
            if (data.activeCorrectionToken === requestId) {
                await updateDoc(targetRef, { activeCorrectionToken: null });
            }
        }
    } catch (err) {
        log.error("Failed to clear target activeCorrectionToken on request delete:", err);
    }
    await logSystemAction('DELETE', 'EMPLOYEES', `Deleted data correction request ${requestId} for ${targetType} ${targetId}`);
};

// --- Referral Invite Helpers ---
export const getReferralInvite = async (refId: string): Promise<ReferralInvite | null> => {
    const docRef = doc(db, 'referral_invites', refId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
        return { id: snap.id, ...snap.data() } as ReferralInvite;
    }
    return null;
};

export const incrementReferralClicks = async (refId: string) => {
    if (!refId) return;
    try {
        const docRef = doc(db, 'referral_invites', refId);
        await updateDoc(docRef, { clicks: increment(1) });
    } catch (e) {
        console.error("Failed to increment referral clicks:", e);
    }
};

export const incrementReferralStarts = async (refId: string) => {
    if (!refId) return;
    try {
        const docRef = doc(db, 'referral_invites', refId);
        await updateDoc(docRef, { 
            started: increment(1), 
            starts: increment(1) 
        });
    } catch (e) {
        console.error("Failed to increment referral starts:", e);
    }
};

/**
 * Applies an approved Account Update request to the employee's active record.
 * Updates both profileData and data in employees collection, and syncs
 * to onboarding_submissions if present.
 */
export const applyApprovedAccountUpdate = async (
    employeeId: string,
    fieldId: string,
    requestedValue: any
): Promise<void> => {
    let empRef = doc(db, EMPLOYEES_COLLECTION, employeeId);
    let empSnap = await getDoc(empRef);

    if (!empSnap.exists()) {
        const q = query(collection(db, EMPLOYEES_COLLECTION), where("employeeId", "==", employeeId), limit(1));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
            empRef = qSnap.docs[0].ref;
            empSnap = qSnap.docs[0] as any;
        } else {
            const qPortal = query(collection(db, EMPLOYEES_COLLECTION), where("portalId", "==", employeeId), limit(1));
            const qPortalSnap = await getDocs(qPortal);
            if (!qPortalSnap.empty) {
                empRef = qPortalSnap.docs[0].ref;
                empSnap = qPortalSnap.docs[0] as any;
            }
        }
    }

    if (!empSnap.exists()) {
        console.warn(`[applyApprovedAccountUpdate] Employee record not found for: ${employeeId}`);
        return;
    }

    const updates: Record<string, any> = {
        [`profileData.${fieldId}`]: requestedValue,
        [`data.${fieldId}`]: requestedValue,
        lastUpdated: new Date().toISOString()
    };

    const empData = empSnap.data() as any;
    const combinedProfile = { ...(empData.profileData || empData.data || {}), [fieldId]: requestedValue };
    if (empData.originalFormSections) {
        const updatedPAN = getApplicantPAN(combinedProfile, empData.originalFormSections);
        const updatedAadhaar = getApplicantAadhaar(combinedProfile, empData.originalFormSections);
        const updatedUAN = getApplicantUAN(combinedProfile, empData.originalFormSections);
        const updatedPhone = getApplicantPhone(combinedProfile, empData.originalFormSections);
        if (updatedPAN) updates.panNumber = updatedPAN;
        if (updatedAadhaar) updates.aadhaarNumber = updatedAadhaar;
        if (updatedUAN) updates.uanNumber = updatedUAN;
        if (updatedPhone) updates.phoneNumber = updatedPhone;
    }

    await updateDoc(empRef, updates);
    await logSystemAction('UPDATE', 'EMPLOYEES', `Applied approved account update for field "${fieldId}" on employee ${employeeId}`);

    // Also sync to onboarding_submissions if matching submission exists
    try {
        const subRef = doc(db, SUBMISSIONS_COLLECTION, empSnap.id);
        const subSnap = await getDoc(subRef);
        if (subSnap.exists()) {
            await updateDoc(subRef, {
                [`data.${fieldId}`]: requestedValue,
                [`formData.${fieldId}`]: requestedValue,
                lastUpdated: new Date().toISOString()
            });
        }
    } catch (e) {
        console.warn("[applyApprovedAccountUpdate] Could not sync to submission:", e);
    }
};

import log from "@/src/utils/logger";
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    User as FirebaseUser,
    GoogleAuthProvider,
    signInWithPopup,
    signInAnonymously,
    setPersistence,
    browserSessionPersistence,
    browserLocalPersistence,
    sendPasswordResetEmail
} from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { auth, db, ensureAuthenticated } from '../firebase/config';
import { User, UserType } from '../../types';
import { clearFileSession } from '../utils/fileSessionStore';

/**
 * STRICT SCOPE: Search ONLY the 'employees' and 'submissions' collections.
 */
export const getEmployeeProfile = async (firebaseUser: FirebaseUser): Promise<User | null> => {
    try {
        let empData: any = null;
        let empDocId: string | null = null;
        let finalUid = firebaseUser.uid;
        let collectionSource = 'employees';

        // 1. Check 'employees' collection by document ID (UID as doc ID)
        const employeeDocRef = doc(db, 'employees', firebaseUser.uid);
        const employeeDoc = await getDoc(employeeDocRef);
        
        if (employeeDoc.exists()) {
            empData = employeeDoc.data();
            empDocId = employeeDoc.id;
        }

        // 2. Fallback: Query by 'uid' field (for records stored under Employee ID)
        if (!empData) {
            const uidQuery = query(collection(db, 'employees'), where("uid", "==", firebaseUser.uid), limit(1));
            const uidSnap = await getDocs(uidQuery);
            if (!uidSnap.empty) {
                empData = uidSnap.docs[0].data();
                empDocId = uidSnap.docs[0].id;
            }
        }

        // 3. Fallback: Query by linkedGoogleEmail (for Google Sign-in users)
        if (!empData && firebaseUser.email) {
            try {
                const emailQuery = query(collection(db, 'employees'), where("linkedGoogleEmail", "==", firebaseUser.email), limit(1));
                const emailSnap = await getDocs(emailQuery);
                if (!emailSnap.empty) {
                    empData = emailSnap.docs[0].data();
                    empDocId = emailSnap.docs[0].id;
                    // Update the uid field to the current Firebase UID for future lookups
                    try {
                        const { updateDoc: fbUpdateDoc } = await import('firebase/firestore');
                        await fbUpdateDoc(emailSnap.docs[0].ref, { uid: firebaseUser.uid });
                        log.log(`[authService] Updated uid field for employee ${empDocId} to match current login`);
                    } catch (e) {
                        log.warn('[authService] Could not update uid field:', e);
                    }
                }
            } catch (err) {
                // Silently swallow permission denied errors for public guest users
                log.debug('[authService] Google email lookup skipped or unauthorized:', err);
            }
        }

        // 4. Fallback: Check 'onboarding_submissions' (for approved users)
        if (!empData) {
            const subRef = doc(db, 'onboarding_submissions', firebaseUser.uid);
            let subSnap = await getDoc(subRef);
            
            if (!subSnap.exists()) {
                try {
                    const { query: fbQuery, collection: fbCollection, where: fbWhere, getDocs: fbGetDocs, limit: fbLimit } = await import('firebase/firestore');
                    const qSub = fbQuery(fbCollection(db, 'onboarding_submissions'), fbWhere("linkedUid", "==", firebaseUser.uid), fbLimit(1));
                    const snapSub = await fbGetDocs(qSub);
                    if (!snapSub.empty) {
                        subSnap = snapSub.docs[0];
                    }
                } catch (err) {
                    log.debug('[authService] Onboarding linkedUid lookup skipped:', err);
                }
            }
            
            if (subSnap.exists() && subSnap.data().status === 'Approved' && subSnap.data().isRelieved !== true && subSnap.data().isActive !== false) {
                empData = subSnap.data();
                empDocId = subSnap.id;
                collectionSource = 'onboarding_submissions';
            }
        }

        if (empData) {
            if (empData.isDisabled === true || empData.isActive === false || empData.isRelieved === true || empData.status === 'Relieved' || empData.status === 'Terminated') {
                await auth.signOut();
                throw new Error("This account does not exist or has been deactivated. Please contact the administrator.");
            }

            // Determine name safely across schemas
            const name = empData.applicantName || empData.name || empData?.profileData?.personalDetails?.fullName || empData?.data?.personalDetails?.fullName || 'User';

            // Resolve global Portal ID (onboarding submission ID)
            let portalId = finalUid;
            if (collectionSource === 'onboarding_submissions') {
                portalId = empDocId || finalUid;
            } else if (collectionSource === 'employees') {
                try {
                    const { query: fbQuery, collection: fbCollection, where: fbWhere, getDocs: fbGetDocs, limit: fbLimit } = await import('firebase/firestore');
                    const subQuery = fbQuery(fbCollection(db, 'onboarding_submissions'), fbWhere("employeeId", "==", empData.employeeId || empDocId), fbLimit(1));
                    const subSnap = await fbGetDocs(subQuery);
                    if (!subSnap.empty) {
                        portalId = subSnap.docs[0].id;
                    } else {
                        portalId = empData.employeeId || empDocId || finalUid;
                    }
                } catch (e) {
                    log.warn('[authService] Could not resolve portalId for employee:', e);
                    portalId = empData.employeeId || empDocId || finalUid;
                }
            }

            return {
                type: UserType.EMPLOYEE,
                id: finalUid,
                employeeId: empData.employeeId || finalUid,
                portalId: portalId,
                name: name,
                isDefaultPassword: empData.isDefaultPassword || false,
                authProvider: empData.authProvider || 'manual',
                linkedGoogleEmail: empData.linkedGoogleEmail || null,
                status: empData.status || 'Approved',
                collection: collectionSource
            } as any;
        }

        return null;
    } catch (error) {
        log.error("Error fetching employee profile:", error);
        throw error;
    }
};

/**
 * STRICT SCOPE: Search 'staff_accounts' AND 'staff' (due to legacy naming split).
 */
export const getStaffProfile = async (firebaseUser: FirebaseUser): Promise<User | null> => {
    const collNames = ['staff_accounts'];
    
    try {
        for (const collName of collNames) {
            // 1. Try by UID
            const staffRef = doc(db, collName, firebaseUser.uid);
            const snap = await getDoc(staffRef);

            if (snap.exists()) {
                const data = snap.data();
                if (data.isDisabled === true || data.isActive === false) {
                    await auth.signOut();
                    throw new Error("This account does not exist or has been disabled. Please contact the administrator.");
                }
                return {
                    type: UserType.ADMIN,
                    id: data.id || firebaseUser.uid,
                    name: data.name || 'Staff',
                    email: data.email || firebaseUser.email || '',
                    roleId: data.roleId,
                    sitesManaged: data.sitesManaged || [],
                    permissionOverrides: data.permissionOverrides || {}
                };
            }

            // 2. Try by Email
            if (firebaseUser.email) {
                const q = query(collection(db, collName), where("email", "==", firebaseUser.email), limit(1));
                const qSnap = await getDocs(q);
                if (!qSnap.empty) {
                    const data = qSnap.docs[0].data();
                    if (data.isDisabled === true || data.isActive === false) {
                        await auth.signOut();
                        throw new Error("This account does not exist or has been disabled. Please contact the administrator.");
                    }

                    // Key fix for Finding 10: If logging in via Google and doc ID does not match firebaseUser.uid,
                    // sync the record so doc(db, 'staff_accounts', firebaseUser.uid) exists for Firestore security rules!
                    if (qSnap.docs[0].id !== firebaseUser.uid) {
                        try {
                            const { httpsCallable } = await import('firebase/functions');
                            const { functions } = await import('../firebase/config');
                            const syncFn = httpsCallable(functions, 'syncStaffGoogleLogin');
                            await syncFn({});
                            log.log(`[authService] Synced Google UID ${firebaseUser.uid} to staff_accounts.`);
                        } catch (syncErr) {
                            log.warn("[authService] Failed to auto-sync staff Google UID:", syncErr);
                        }
                    }

                    return {
                        type: UserType.ADMIN,
                        id: firebaseUser.uid,
                        name: data.name || 'Staff',
                        email: data.email || firebaseUser.email || '',
                        roleId: data.roleId,
                        sitesManaged: data.sitesManaged || [],
                        permissionOverrides: data.permissionOverrides || {}
                    };
                }
            }
        }
        return null;
    } catch (e) {
        log.error("getStaffProfile Error:", e);
        throw e;
    }
};

/**
 * STRICT SCOPE: Search ONLY 'users'.
 */
export const getAdminProfile = async (firebaseUser: FirebaseUser): Promise<User | null> => {
    try {
        const adminRef = doc(db, 'users', firebaseUser.uid);
        const snap = await getDoc(adminRef);

        if (snap.exists()) {
            const data = snap.data();
            if (data.isDisabled === true || data.isActive === false) {
                await auth.signOut();
                throw new Error("This account does not exist or has been disabled. Please contact the administrator.");
            }
            return {
                type: UserType.ADMIN,
                id: data.username || firebaseUser.uid,
                name: data.name || data.displayName || 'Admin',
                roleId: data.roleId,
                permissionOverrides: data.permissionOverrides || {}
            };
        }

        if (firebaseUser.email) {
            const q = query(collection(db, 'users'), where("email", "==", firebaseUser.email), limit(1));
            const qSnap = await getDocs(q);
            if (!qSnap.empty) {
                const data = qSnap.docs[0].data();
                if (data.isDisabled === true || data.isActive === false) {
                    await auth.signOut();
                    throw new Error("This account does not exist or has been disabled. Please contact the administrator.");
                }
                return {
                    type: UserType.ADMIN,
                    id: data.username || qSnap.docs[0].id,
                    name: data.name || 'Admin',
                    roleId: data.roleId,
                    permissionOverrides: data.permissionOverrides || {}
                };
            }
        }
        return null;
    } catch (e) {
        log.error("getAdminProfile Error:", e);
        throw e;
    }
};

/**
 * NEW JOINING SEARCH: Searches the ENTIRE database for email conflicts using Cloud Function.
 */
export const checkEmailUniquenessGlobal = async (email: string, options: { excludeAdmin?: boolean; uid?: string } = {}): Promise<boolean> => {
    const cleanEmail = email ? email.trim() : '';
    if (!cleanEmail && !options.uid) return true;
    try {
        const { getFunctions, httpsCallable } = await import('firebase/functions');
        const functions = getFunctions();
        const checkFn = httpsCallable<{ email?: string; uid?: string; options?: { excludeAdmin?: boolean } }, { unique: boolean, conflict: string | null }>(functions, 'checkGlobalUniqueness');

        const result = await checkFn({ email: cleanEmail || undefined, uid: options.uid, options: { excludeAdmin: options.excludeAdmin } });
        const { unique, conflict } = result.data;

        if (conflict) {
            log.warn(`Identity collision detected for ${cleanEmail || options.uid}: ${conflict}`);
        }

        return unique;
    } catch (e) {
        log.warn("Global email uniqueness check service error:", e);
        // SAFETY: If the uniqueness check fails due to function error, network issue, or missing field,
        // we MUST NOT falsely claim the user's email is already registered and block submission.
        // Fail open and allow submission to proceed.
        return true;
    }
};

export const loginUser = async (userInput: string, password: string): Promise<User | null> => {
    try {
        let loginEmail = userInput;
        if (!userInput.includes('@')) {
            const portalType = localStorage.getItem('portalType') || 'management';
            let foundEmail: string | null = null;

            try {
                const { getFunctions, httpsCallable } = await import('firebase/functions');
                const functions = getFunctions();
                const resolveFn = httpsCallable<{ username: string; portalType: string }, { email: string | null }>(functions, 'resolveUsernameToEmail');
                const result = await resolveFn({ username: userInput, portalType });
                foundEmail = result.data.email;
            } catch (err: any) {
                log.warn('[loginUser] Cloud Function resolveUsernameToEmail failed, falling back to direct email auth.', err?.message || err);
            }

            if (foundEmail) {
                loginEmail = foundEmail;
            }
        }

        const userCredential = await signInWithEmailAndPassword(auth, loginEmail, password);
        return {
            type: UserType.EMPLOYEE,
            id: userCredential.user.uid,
            name: userCredential.user.displayName || 'User'
        };
    } catch (error) {
        log.error("Login error:", error);
        throw error;
    }
};

export const loginWithGoogle = async (): Promise<FirebaseUser | null> => {
    try {
        await setPersistence(auth, browserLocalPersistence);
        const { googleSignIn } = await import('../utils/googleAuthHelper');
        const result = await googleSignIn();
        return result.user;
    } catch (error: any) {
        log.error("Google login error:", error);
        throw error;
    }
};

export const loginWithGoogleForOnboarding = async () => {
    try {
        const { googleSignInForOnboarding } = await import('../utils/googleAuthHelper');
        return await googleSignInForOnboarding();
    } catch (error: any) {
        log.error("Google onboarding login error:", error);
        throw error;
    }
};

export const loginAnonymously = async () => {
    try {
        await setPersistence(auth, browserSessionPersistence);
        const result = await signInAnonymously(auth);
        return result.user;
    } catch (error: any) {
        log.error("Anonymous login error:", error);
        throw error;
    }
};

export const logoutUser = async () => {
    localStorage.removeItem('portalType');
    try {
        await clearFileSession();
    } catch (e) {
        log.warn("[authService] Failed to clear file session during logout:", e);
    }
    await signOut(auth);
};

export const getCurrentUser = (timeoutMs: number = 5000): Promise<User | null> => {
    return new Promise((resolve) => {
        let resolved = false;
        const timeout = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                resolve(null);
            }
        }, timeoutMs);

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (resolved) { unsubscribe(); return; }
            if (firebaseUser) {
                try {
                    // ABSOLUTE ISOLATION: Use portalType hint to scope profile extraction
                    const portalType = localStorage.getItem('portalType');

                    if (portalType === 'onboarding') {
                        // IDENTITY CHECK ONLY: Do not resolve profile to avoid global state leakage
                        // returning null ensures AuthContext.user stays null
                        resolve(null);
                        resolved = true;
                        unsubscribe();
                        clearTimeout(timeout);
                        return;
                    }

                    if (portalType === 'employee') {
                        const employee = await getEmployeeProfile(firebaseUser);
                        if (employee) { resolve(employee); resolved = true; unsubscribe(); clearTimeout(timeout); return; }
                    } else if (portalType === 'management') {
                        const admin = await getAdminProfile(firebaseUser);
                        if (admin) { resolve(admin); resolved = true; unsubscribe(); clearTimeout(timeout); return; }

                        const staff = await getStaffProfile(firebaseUser);
                        if (staff) { resolve(staff); resolved = true; unsubscribe(); clearTimeout(timeout); return; }
                    } else {
                        // FALLBACK: If no hint, check all but favor Admin/Staff for web portal
                        const admin = await getAdminProfile(firebaseUser);
                        if (admin) { resolve(admin); resolved = true; unsubscribe(); clearTimeout(timeout); return; }

                        const staff = await getStaffProfile(firebaseUser);
                        if (staff) { resolve(staff); resolved = true; unsubscribe(); clearTimeout(timeout); return; }

                        const employee = await getEmployeeProfile(firebaseUser);
                        if (employee) { resolve(employee); resolved = true; unsubscribe(); clearTimeout(timeout); return; }
                    }
                } catch (e) {
                    log.error("Auth state check error", e);
                }
            }
            resolved = true;
            clearTimeout(timeout);
            unsubscribe();
            resolve(null);
        });
    });
};

export const sendPasswordReset = async (email: string): Promise<void> => {
    try {
        await sendPasswordResetEmail(auth, email);
        log.log(`Password reset email sent to ${email}`);
    } catch (error) {
        log.error("Password reset error:", error);
        throw error;
    }
};


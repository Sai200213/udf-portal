import { db, auth } from '../firebase/config';
import {
    collection,
    doc,
    setDoc,
    query,
    orderBy,
    onSnapshot,
    limit,
    serverTimestamp,
    Timestamp,
    deleteDoc,
    updateDoc
} from 'firebase/firestore';
import { AuditLogEntry } from '../../types';

const AUDIT_LOGS_COLLECTION = 'audit_logs';

/** Generate a unique ID to avoid Firestore SDK retry collisions with addDoc */
const generateUniqueId = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const timestamp = Date.now().toString(36);
    let result = timestamp + '_';
    for (let i = 0; i < 12; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

export const logSystemAction = async (
    actionType: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE' | 'APPROVAL' | 'REJECTION' | 'LOGIN' | 'LOGOUT' | 'SUBMIT' | 'EXPORT',
    targetModule: 'SITES' | 'STAFF' | 'ROLES' | 'LEAVES' | 'EMPLOYEES' | 'SYSTEM' | 'AUTH' | 'SUBMISSION' | 'BGV' | 'INVITES' | 'DISCIPLINARY' | 'SETTINGS',
    details: string,
    actorOverride?: { id: string; name: string }
) => {
    try {
        const currentUser = auth.currentUser;
        // Safeguard: audit_logs is strictly reserved for authenticated staff/admin actions.
        // Public/guest candidate actions are tracked directly in their respective collections
        // (e.g. onboarding_submissions) to prevent unauthorized writes and audit log flooding.
        if (!currentUser || currentUser.isAnonymous || actorOverride?.id === 'guest') {
            return;
        }

        const uniqueId = generateUniqueId();
        const docRef = doc(db, AUDIT_LOGS_COLLECTION, uniqueId);
        const actorId = actorOverride?.id || currentUser.uid;
        const actorName = actorOverride?.name || currentUser.displayName || currentUser.email || 'System';

        await setDoc(docRef, {
            action: actionType,
            actionType,
            targetModule,
            details,
            actorId,
            actorName,
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error("Failed to write audit log:", error);
    }
};

export const subscribeToAuditLogs = (callback: (logs: AuditLogEntry[]) => void, limitCount = 100, filter?: { actorId?: string }) => {
    let q = query(
        collection(db, AUDIT_LOGS_COLLECTION),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
    );

    return onSnapshot(q, (snapshot) => {
        let logs = snapshot.docs.map(doc => {
            const data = doc.data();
            const ts = data.timestamp as Timestamp;
            return {
                id: doc.id,
                ...data,
                timestamp: ts ? ts.toDate().toISOString() : new Date().toISOString()
            };
        }) as AuditLogEntry[];

        if (filter?.actorId) {
            logs = logs.filter(log => log.actorId === filter.actorId);
        }

        callback(logs);
    }, (error) => {
        console.error("Audit Log Subscription Error:", error);
    });
};

// ─── Privileged SuperAdmin-only functions ─────────────────────────────────────
// These are NOT exported from the main index and are only used internally
// by the hidden audit management panel. Firestore rules enforce SuperAdmin-only access.

export const _deleteAuditLog = async (logId: string): Promise<void> => {
    const docRef = doc(db, AUDIT_LOGS_COLLECTION, logId);
    await deleteDoc(docRef);
};

export const _updateAuditLogDetails = async (logId: string, newDetails: string): Promise<void> => {
    const docRef = doc(db, AUDIT_LOGS_COLLECTION, logId);
    await updateDoc(docRef, { details: newDetails, _edited: true });
};



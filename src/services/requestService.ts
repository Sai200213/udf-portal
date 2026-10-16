import log from "@/src/utils/logger";
import { db } from '../firebase/config';
import { collection, doc, onSnapshot, setDoc, query, where, getDocs } from 'firebase/firestore';
import { LeaveRequest, AccountUpdateRequest, ResignationRequest, DisciplinaryAction } from '../../types';
import { uploadFile } from './storageService';
import { logSystemAction } from './auditService';

// Collections
const LEAVE_REQ_COL = 'leave_requests';
const ACCOUNT_UPD_COL = 'account_updates';
const RESIGNATION_COL = 'resignations';
const DISCIPLINARY_COL = 'disciplinary_actions';

/**
 * Scans an object for any File instances, uploads them to Firebase Storage,
 * and replaces them with their download URLs. Returns a Firestore-safe copy.
 */
async function uploadFilesInObject(obj: Record<string, any>, storagePath: string): Promise<Record<string, any>> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value instanceof File) {
      try {
        const url = await uploadFile(value, storagePath, value.name);
        result[key] = url;
        log.log(`[Storage] ✅ Uploaded ${key}: ${value.name}`);
      } catch (err) {
        log.error(`[Storage] ❌ Failed to upload ${key}: ${(value as File).name}`, err);
        result[key] = null; // Don't block the save — nullify the failed file
      }
    } else {
      result[key] = value;
    }
  }
  return result;
}


// Fetch leave requests by status (one-time query, not a subscription)
export const fetchLeaveRequestsByStatus = async (status: string, allowedSiteIds?: string[], limitCount?: number): Promise<LeaveRequest[]> => {
    const q = query(collection(db, LEAVE_REQ_COL), where('status', '==', status));
    const snap = await getDocs(q);
    let results = snap.docs.map(d => ({ ...d.data(), id: d.id } as LeaveRequest));

    // Client-side filter by allowed site IDs if provided
    if (allowedSiteIds && allowedSiteIds.length > 0) {
        results = results.filter(r => allowedSiteIds.includes((r as any).siteId || ''));
    }

    // Apply limit if provided
    if (limitCount && limitCount > 0) {
        results = results.slice(0, limitCount);
    }

    return results;
};

// --- Leave Requests ---
export const subscribeToLeaveRequests = (callback: (reqs: LeaveRequest[]) => void) => {
    return onSnapshot(collection(db, LEAVE_REQ_COL), (snap) => {
        const reqs = snap.docs.map(d => ({ ...d.data(), id: d.id } as LeaveRequest));
        log.log(`Synced ${reqs.length} leave requests`);
        callback(reqs);
    }, (error) => {
        log.error("Error subscribing to leave requests:", error);
    });
};

const buildEmployeeIdQuery = (collPath: string, employeeId: string | string[]) => {
    const ids = (Array.isArray(employeeId) ? employeeId : [employeeId]).filter(Boolean);
    if (ids.length === 0) {
        return query(collection(db, collPath), where("employeeId", "==", "___dummy_nonexistent_id___"));
    }
    if (ids.length === 1) {
        return query(collection(db, collPath), where("employeeId", "==", ids[0]));
    }
    return query(collection(db, collPath), where("employeeId", "in", ids));
};

export const subscribeToMyLeaveRequests = (employeeId: string | string[], callback: (reqs: LeaveRequest[]) => void) => {
    const q = buildEmployeeIdQuery(LEAVE_REQ_COL, employeeId);
    return onSnapshot(q, (snap) => {
        const reqs = snap.docs.map(d => ({ ...d.data(), id: d.id } as LeaveRequest));
        callback(reqs);
    }, (error) => {
        log.error("Error subscribing to my leave requests:", error);
    });
};

export const submitLeaveRequest = async (request: LeaveRequest) => {
    const folderId = (request as any).portalId || request.employeeId;
    const safe = await uploadFilesInObject(
        request as unknown as Record<string, any>,
        `employees/${folderId}/requests/leave/${request.id}`
    );
    await setDoc(doc(db, LEAVE_REQ_COL, request.id), safe);
    await logSystemAction('CREATE', 'LEAVES', `Submitted leave request for ${request.employeeName} (${request.employeeId}) [${request.leaveType}: ${request.startDate} to ${request.endDate}]`);
};

export const updateLeaveRequest = async (request: LeaveRequest) => {
    await setDoc(doc(db, LEAVE_REQ_COL, request.id), request, { merge: true });
    const action = request.status === 'Approved' ? 'APPROVAL' : request.status === 'Rejected' ? 'REJECTION' : 'STATUS_CHANGE';
    await logSystemAction(action, 'LEAVES', `Leave request for ${request.employeeName} (${request.employeeId}) updated to ${request.status} (level ${request.currentLevel})`);
};

// --- Account Update Requests ---
export const subscribeToAccountUpdates = (callback: (reqs: AccountUpdateRequest[]) => void) => {
    return onSnapshot(collection(db, ACCOUNT_UPD_COL), (snap) => {
        const reqs = snap.docs.map(d => ({ ...d.data(), id: d.id } as AccountUpdateRequest));
        log.log(`Synced ${reqs.length} account updates`);
        callback(reqs);
    }, (error) => {
        log.error("Error subscribing to account updates:", error);
    });
};

export const subscribeToMyAccountUpdates = (employeeId: string | string[], callback: (reqs: AccountUpdateRequest[]) => void) => {
    const q = buildEmployeeIdQuery(ACCOUNT_UPD_COL, employeeId);
    return onSnapshot(q, (snap) => {
        const reqs = snap.docs.map(d => ({ ...d.data(), id: d.id } as AccountUpdateRequest));
        callback(reqs);
    }, (error) => {
        log.error("Error subscribing to my account updates:", error);
    });
};

export const submitAccountUpdateRequest = async (request: AccountUpdateRequest) => {
    const folderId = (request as any).portalId || request.employeeId;
    const safe = await uploadFilesInObject(
        request as unknown as Record<string, any>,
        `employees/${folderId}/requests/account_updates/${request.id}`
    );
    await setDoc(doc(db, ACCOUNT_UPD_COL, request.id), safe);
    await logSystemAction('CREATE', 'EMPLOYEES', `Submitted profile update request for ${request.employeeName} (${request.employeeId}): ${request.fieldLabel}`);
};

export const updateAccountUpdateRequest = async (request: AccountUpdateRequest) => {
    await setDoc(doc(db, ACCOUNT_UPD_COL, request.id), request, { merge: true });
    const action = request.status === 'Approved' ? 'APPROVAL' : request.status === 'Rejected' ? 'REJECTION' : 'STATUS_CHANGE';
    await logSystemAction(action, 'EMPLOYEES', `Account update request for ${request.employeeName} (${request.employeeId}) [${request.fieldLabel}] updated to ${request.status}`);
};

// --- Resignation Requests ---
export const subscribeToResignationRequests = (callback: (reqs: ResignationRequest[]) => void) => {
    return onSnapshot(collection(db, RESIGNATION_COL), (snap) => {
        const reqs = snap.docs.map(d => ({ ...d.data(), id: d.id } as ResignationRequest));
        log.log(`Synced ${reqs.length} resignations`);
        callback(reqs);
    }, (error) => {
        log.error("Error subscribing to resignation requests:", error);
    });
};

export const subscribeToMyResignations = (employeeId: string | string[], callback: (reqs: ResignationRequest[]) => void) => {
    const q = buildEmployeeIdQuery(RESIGNATION_COL, employeeId);
    return onSnapshot(q, (snap) => {
        const reqs = snap.docs.map(d => ({ ...d.data(), id: d.id } as ResignationRequest));
        callback(reqs);
    }, (error) => {
        log.error("Error subscribing to my resignation requests:", error);
    });
};

export const submitResignationRequest = async (request: ResignationRequest) => {
    const folderId = (request as any).portalId || request.employeeId;
    const safe = await uploadFilesInObject(
        request as unknown as Record<string, any>,
        `employees/${folderId}/requests/resignations/${request.id}`
    );
    await setDoc(doc(db, RESIGNATION_COL, request.id), safe);
    await logSystemAction('CREATE', 'EMPLOYEES', `Submitted resignation request for ${request.employeeName} (${request.employeeId}), relieving date: ${request.relievingDate}`);
};

export const updateResignationRequest = async (request: ResignationRequest) => {
    await setDoc(doc(db, RESIGNATION_COL, request.id), request, { merge: true });
    const action = request.status === 'Approved' ? 'APPROVAL' : request.status === 'Rejected' ? 'REJECTION' : 'STATUS_CHANGE';
    await logSystemAction(action, 'EMPLOYEES', `Resignation request for ${request.employeeName} (${request.employeeId}) updated to ${request.status} (relieving: ${request.relievingDate})`);
};

// Auto-relieve employees whose notice period has concluded
export const processDueResignations = async (requests: ResignationRequest[]): Promise<void> => {
    if (!requests || requests.length === 0) return;
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const { relieveEmployee } = await import('./employeeService');

    for (const req of requests) {
        if (req.status === 'Approved' && !req.isProcessed && req.relievingDate) {
            const relDate = new Date(req.relievingDate);
            if (!isNaN(relDate.getTime()) && relDate <= today) {
                try {
                    await relieveEmployee(req.employeeId, req.relievingDate, 'Resignation');
                    await setDoc(doc(db, RESIGNATION_COL, req.id), { isProcessed: true }, { merge: true });
                    log.log(`[AutoRelieve] Relieved ${req.employeeId} (${req.employeeName}) on relieving date ${req.relievingDate}`);
                } catch (e) {
                    log.error(`[AutoRelieve] Failed to auto-relieve ${req.employeeId}:`, e);
                }
            }
        }
    }
};

// --- Disciplinary Actions ---
export const subscribeToDisciplinaryActions = (callback: (actions: DisciplinaryAction[]) => void) => {
    return onSnapshot(collection(db, DISCIPLINARY_COL), (snap) => {
        const actions = snap.docs.map(d => ({ ...d.data(), id: d.id } as DisciplinaryAction));
        callback(actions);
    });
};

export const subscribeToMyDisciplinaryActions = (employeeId: string | string[], callback: (actions: DisciplinaryAction[]) => void) => {
    const q = buildEmployeeIdQuery(DISCIPLINARY_COL, employeeId);
    return onSnapshot(q, (snap) => {
        const actions = snap.docs.map(d => ({ ...d.data(), id: d.id } as DisciplinaryAction));
        callback(actions);
    }, (error) => {
        log.error("Error subscribing to my disciplinary actions:", error);
    });
};

export const addDisciplinaryAction = async (action: DisciplinaryAction) => {
    const folderId = (action as any).portalId || action.employeeId;
    const safe = await uploadFilesInObject(
        action as unknown as Record<string, any>,
        `employees/${folderId}/requests/disciplinary/${action.id}`
    );
    await setDoc(doc(db, DISCIPLINARY_COL, action.id), safe);
    await logSystemAction('CREATE', 'DISCIPLINARY', `Filed ${action.actionType} for employee ${action.employeeName} (${action.employeeId}) by ${action.filedBy}`);
};

// --- Universal Workflow Revert ---
export const revertWorkflowRequest = async (
    collectionId: 'leave_requests' | 'account_updates' | 'resignations',
    id: string,
    targetLevel: number
) => {
    const docRef = doc(db, collectionId, id);
    await setDoc(docRef, {
        status: 'Pending',
        currentLevel: targetLevel
    }, { merge: true });
    await logSystemAction('STATUS_CHANGE', 'SYSTEM', `Reverted ${collectionId} request ${id} to approval level ${targetLevel}`);
};






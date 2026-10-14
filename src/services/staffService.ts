import { getFunctions, httpsCallable } from 'firebase/functions';
import { logSystemAction } from './auditService';

export interface CreateStaffUserData {
    email: string;
    password: string;
    name: string;
    username: string;
    roleId: string;
}

export interface CreateStaffResult {
    success: boolean;
    uid?: string;
    email?: string;
    message?: string;
}

export interface DeleteStaffResult {
    success: boolean;
    message?: string;
}

/**
 * Calls the Cloud Function `createStaffUser` (requires SuperAdmin).
 * Cloud Functions are IAM-protected and handle Firebase Auth user creation server-side.
 */
export const createStaffUser = async (data: CreateStaffUserData): Promise<CreateStaffResult> => {
    try {
        const functions = getFunctions();
        const createFn = httpsCallable<CreateStaffUserData, CreateStaffResult>(functions, 'createStaffUser');
        const result = await createFn(data);
        if (result.data?.success) {
            await logSystemAction('CREATE', 'STAFF', `Created staff user "${data.name}" (${data.email}, @${data.username}) with role ID: ${data.roleId}`);
        }
        return result.data;
    } catch (error: any) {
        console.error('Error creating staff user via Cloud Function:', error);
        throw new Error(error.message || 'Failed to create user');
    }
};

/**
 * Calls the Cloud Function `deleteStaffUser` (requires SuperAdmin).
 */
export const deleteStaffUser = async (uid: string): Promise<DeleteStaffResult> => {
    try {
        const functions = getFunctions();
        const deleteFn = httpsCallable<{ uid: string }, DeleteStaffResult>(functions, 'deleteStaffUser');
        const result = await deleteFn({ uid });
        if (result.data?.success) {
            await logSystemAction('DELETE', 'STAFF', `Deleted staff user account with UID: ${uid}`);
        }
        return result.data;
    } catch (error: any) {
        console.error('Error deleting staff user via Cloud Function:', error);
        throw new Error(error.message || 'Failed to delete user');
    }
};

export interface SetStaffUserStatusResult {
    success: boolean;
    message?: string;
}

export interface ResetStaffUserPasswordResult {
    success: boolean;
    message?: string;
}

/**
 * Calls the Cloud Function `setStaffUserStatus` (requires SuperAdmin).
 */
export const setStaffUserStatus = async (uid: string, isDisabled: boolean): Promise<SetStaffUserStatusResult> => {
    try {
        const functions = getFunctions();
        const setStatusFn = httpsCallable<{ uid: string; isDisabled: boolean }, SetStaffUserStatusResult>(functions, 'setStaffUserStatus');
        const result = await setStatusFn({ uid, isDisabled });
        if (result.data?.success) {
            await logSystemAction('STATUS_CHANGE', 'STAFF', `${isDisabled ? 'Disabled' : 'Enabled'} staff account (UID: ${uid})`);
        }
        return result.data;
    } catch (error: any) {
        console.error('Error setting staff user status via Cloud Function:', error);
        throw new Error(error.message || 'Failed to update user status');
    }
};

/**
 * Calls the Cloud Function `resetStaffUserPassword` (requires SuperAdmin).
 */
export const resetStaffUserPassword = async (uid: string, password: string): Promise<ResetStaffUserPasswordResult> => {
    try {
        const functions = getFunctions();
        const resetPasswordFn = httpsCallable<{ uid: string; password: string }, ResetStaffUserPasswordResult>(functions, 'resetStaffUserPassword');
        const result = await resetPasswordFn({ uid, password });
        if (result.data?.success) {
            await logSystemAction('UPDATE', 'AUTH', `Reset password for staff user account (UID: ${uid})`);
        }
        return result.data;
    } catch (error: any) {
        console.error('Error resetting staff user password via Cloud Function:', error);
        throw new Error(error.message || 'Failed to reset password');
    }
};


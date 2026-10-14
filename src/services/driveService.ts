// DRIVE_BRIDGE_URL is not used, scriptUrl is pulled from env
import { GOOGLE_FORM_MAPPING } from '../constants/googleFormMapping';
import { auth, ensureAuthenticated } from '../firebase/config';
import log from "@/src/utils/logger";

// ============================================
// CENTRALIZED APPS SCRIPT CALLER
// Auto-injects the `token` field into every payload.
// The Apps Script checks `data.token` for auth.
// ============================================
const callAppsScript = async (payload: Record<string, any>): Promise<any> => {
    const scriptUrl = import.meta.env.VITE_GOOGLE_DRIVE_SCRIPT_URL;
    const user = await ensureAuthenticated();
    const token = await user.getIdToken();

    const response = await fetch(scriptUrl, {
        method: 'POST',
        credentials: 'omit',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ ...payload, token })
    });

    return response.json();
};

// Re-defining the base64 helper
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

// ============================================
// FILE UPLOAD
// ============================================
export const uploadToDrive = async (file: File, employeeName: string, operationName: string, uniqueId?: string): Promise<string> => {
    const base64 = await fileToBase64(file);
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            const result = await callAppsScript({
                filename: file.name,
                base64,
                employeeName,
                operationName,
                uniqueId
            });

            if (result.success) return result.url;
            throw new Error(result.error || "Drive upload failed");
        } catch (e: any) {
            attempt++;
            console.error(`Detailed Drive Upload Error (Attempt ${attempt}):`, e);
            if (attempt >= maxRetries) {
                throw new Error(`Upload Failed for ${file.name} after ${maxRetries} attempts: ${e.message}`);
            }
            // Wait for 1s, then 2s, then 4s, etc. before next retry
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
        }
    }
    throw new Error(`Upload Failed for ${file.name}`);
};

// ============================================
// FOLDER OPERATIONS
// ============================================
export const moveEmployeeFolder = async (employeeName: string, uniqueId: string, action: 'delete_employee' | 'restore_employee' | 'block_employee' | 'unblock_employee', folderName?: string): Promise<void> => {
    log.log(`[DRIVE_BYPASS] Folder move action "${action}" bypassed for employee: ${employeeName}. (Backup-only mode)`);
};

export const moveEmployeeFolderToRecycleBin = async (employeeName: string, uniqueId: string, folderName?: string): Promise<void> => {
    await moveEmployeeFolder(employeeName, uniqueId, 'delete_employee', folderName);
};

export const restoreEmployeeFolderFromRecycleBin = async (employeeName: string, uniqueId: string, folderName?: string): Promise<void> => {
    await moveEmployeeFolder(employeeName, uniqueId, 'restore_employee', folderName);
};

export const permanentDeleteEmployeeFolder = async (employeeName: string, uniqueId: string, folderName?: string): Promise<void> => {
    log.log(`[DRIVE_BYPASS] Permanent delete bypassed for employee: ${employeeName}. (Backup-only mode)`);
};

export const createEmployeeFolder = async (employeeName: string, uniqueId: string): Promise<void> => {
    try {
        const payload = {
            action: 'create_employee_folder',
            employeeName: employeeName.trim(),
            uniqueId: uniqueId.trim()
        };

        console.group("[DRIVE_DEBUG] create_folder");
        log.log("Payload:", payload);

        const result = await callAppsScript(payload);
        log.log("Response:", result);
        console.groupEnd();

        if (!result.success) throw new Error(result.error || "Create folder failed");
    } catch (e: any) {
        console.error("[DRIVE_ERROR] createEmployeeFolder:", e);
        console.groupEnd();
        throw e;
    }
};

export const copyFolderContents = async (sourceFolderName: string, targetFolderName: string): Promise<void> => {
    try {
        const payload = {
            action: 'copy_folder_contents',
            sourceFolderName: sourceFolderName.trim(),
            targetFolderName: targetFolderName.trim()
        };

        console.group("[DRIVE_DEBUG] copy_folder_contents");
        log.log("Payload:", payload);

        const result = await callAppsScript(payload);
        log.log("Response:", result);
        console.groupEnd();

        if (!result.success) throw new Error(result.error || "Copy folder contents failed");
    } catch (e: any) {
        console.error("[DRIVE_ERROR] copyFolderContents:", e);
        console.groupEnd();
        throw e;
    }
};

export const renameEmployeeFolder = async (oldName: string, newName: string): Promise<void> => {
    log.log(`[DRIVE_BYPASS] Rename bypassed for employee folder: ${oldName} -> ${newName}. (Backup-only mode)`);
};

/**
 * Approves an employee: renames the folder AND moves it from Pending Employees to Active Employees.
 */
export const approveEmployeeFolder = async (oldFolderName: string, newFolderName: string): Promise<void> => {
    log.log(`[DRIVE_BYPASS] Approve folder move bypassed: ${oldFolderName} -> ${newFolderName}. (Backup-only mode)`);
};

export const syncFolderInDrive = async (employeeName: string, employeeId: string, currentFolder?: string): Promise<string> => {
    try {
        const result = await callAppsScript({
            action: 'sync_folder',
            employeeName: employeeName,
            uniqueId: employeeId,
            folderName: currentFolder
        });
        return result.folderName || currentFolder;
    } catch (e) {
        console.error("Drive sync error:", e);
        return currentFolder || '';
    }
};

const extractFileIdFromUrl = (url: string): string | null => {
    if (!url) return null;
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    const match2 = url.match(/id=([a-zA-Z0-9_-]+)/);
    if (match2) return match2[1];
    return null;
};


// ============================================
// GOOGLE FORM SUBMISSION
// ============================================
export const submitToGoogleForm = async (formData: any, email?: string | null): Promise<void> => {
    // Build payload with title + value
    const fields: Array<{ title: string, value: string }> = [];
    const fieldLog: string[] = [];

    const SITE_FIELD_ID = '52ae217b-2602-4337-a1cd-a1f9bd36a4b0';

    // Resolve Unit or Facility (Site Name)
    let resolvedSiteName = (formData.siteName && typeof formData.siteName === 'string') ? formData.siteName.trim() : '';
    const rawSiteVal = formData[SITE_FIELD_ID];
    if (!resolvedSiteName && rawSiteVal && typeof rawSiteVal === 'string') {
        try {
            const { doc, getDoc } = await import('firebase/firestore');
            const { db } = await import('../firebase/config');
            const sitesSnap = await getDoc(doc(db, 'settings', 'sites'));
            if (sitesSnap.exists()) {
                const sitesList = sitesSnap.data()?.sites || [];
                const matchedSite = sitesList.find((s: any) => 
                    s.id === rawSiteVal || 
                    (s.name && s.name.trim().toLowerCase() === rawSiteVal.trim().toLowerCase())
                );
                if (matchedSite && matchedSite.name) {
                    resolvedSiteName = matchedSite.name;
                }
            }
        } catch (e) {
            console.warn("[GOOGLE_FORM] Could not resolve site name for Google Form:", e);
        }
    }

    // Text fields
    for (const [portalId, mapping] of Object.entries(GOOGLE_FORM_MAPPING.TEXT_FIELDS)) {
        const { title } = mapping as any;
        let rawValue = formData[portalId];

        // If this is the Site / Unit or Facility field, prioritize readable siteName
        if (portalId === SITE_FIELD_ID) {
            if (resolvedSiteName) {
                rawValue = resolvedSiteName;
            }
        }

        // Defensive: extract string even from objects
        let value: string | null = null;
        if (rawValue !== undefined && rawValue !== null) {
            if (typeof rawValue === 'string') {
                value = rawValue.trim();
            } else if (typeof rawValue === 'object') {
                // Shouldn't happen for text fields, but handle gracefully
                value = rawValue.driveUrl || rawValue.storagePath || JSON.stringify(rawValue);
            } else {
                value = String(rawValue).trim();
            }
        }
        if (value && value !== '') {
            fields.push({ title, value });
            fieldLog.push(`✅ ${title} = "${value.substring(0, 40)}${value.length > 40 ? '...' : ''}"`);
        } else {
            fieldLog.push(`⬜ ${title} (empty)`);
        }
    }

    // File fields (Drive URLs or Firebase Storage URLs)
    for (const [portalId, mapping] of Object.entries(GOOGLE_FORM_MAPPING.FILE_FIELDS)) {
        const { title } = mapping as any;
        const fileData = formData[portalId];
        let url: string | null = null;

        if (typeof fileData === 'string') {
            if (fileData.includes('drive.google.com') || fileData.includes('http')) {
                url = fileData;
            } else if (fileData.trim() !== '') {
                // Convert relative Firebase Storage path to URL
                const bucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || (import.meta.env.VITE_FIREBASE_PROJECT_ID ? `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app` : '');
                url = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(fileData)}?alt=media`;
            }
        } else if (typeof fileData === 'object' && fileData !== null) {
            if (fileData.driveUrl && typeof fileData.driveUrl === 'string' && fileData.driveUrl.trim() !== '') {
                url = fileData.driveUrl;
            } else if (fileData.storagePath) {
                // Convert storagePath to Firebase Storage URL
                const bucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || (import.meta.env.VITE_FIREBASE_PROJECT_ID ? `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app` : '');
                url = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(fileData.storagePath)}?alt=media`;
            }
        }

        if (url) {
            fields.push({ title, value: url });
            fieldLog.push(`✅ ${title} (file)`);
        }
    }

    // Add Email field if present
    if (email) {
        fields.push({ title: 'Email', value: email });
        fieldLog.push(`✅ Email = "${email}"`);
    }

    // Final sanitization: ensure every value is a plain, non-empty string
    const sanitizedFields = fields.filter(f => {
        if (!f.title || typeof f.title !== 'string') return false;
        if (!f.value || typeof f.value !== 'string' || f.value.trim() === '') return false;
        return true;
    }).map(f => ({ title: f.title.trim(), value: f.value.trim() }));

    try {
        console.group("Google Form Sync");
        log.log(`Sending ${sanitizedFields.length} fields (from ${fields.length} total)`);
        log.log("Fields:", fieldLog);

        const payload: any = { 
            action: 'submit_to_form', 
            fields: sanitizedFields,
            email: email || null
        };

        // Log full payload for debugging (redact token)
        log.log("Payload preview:", JSON.stringify({ action: payload.action, fieldCount: sanitizedFields.length }));

        const result = await callAppsScript(payload);

        if (result.success) {
            log.log(`%c✅ Form synced! ${result.filled?.length || 0} fields filled.`, "color: green; font-weight: bold;");
            if (result.failed?.length > 0) {
                console.warn("⚠️ Failed fields:", result.failed);
            }
        } else {
            // Log the exact error and the payload that caused it for debugging
            console.error("❌ Form sync failed:", result.error);
            console.error("Payload that failed (field titles):", sanitizedFields.map(f => f.title));
        }
        console.groupEnd();
    } catch (e) {
        // NEVER let form sync failure block the submission
        console.error("❌ Google Form Submission Failed (non-blocking):", e);
        console.groupEnd();
    }
};

export const copySpecificSubfolders = async (sourceFolderName: string, targetFolderName: string, foldersToCopy: string[]): Promise<void> => {
    try {
        const payload = {
            action: 'copy_specific_subfolders',
            sourceFolderName: sourceFolderName.trim(),
            targetFolderName: targetFolderName.trim(),
            foldersToCopy: foldersToCopy
        };

        console.group("[DRIVE_DEBUG] copy_specific_subfolders");
        log.log("Payload:", payload);

        const result = await callAppsScript(payload);
        log.log("Response:", result);
        console.groupEnd();

        if (!result.success) throw new Error(result.error || "Copy specific subfolders failed");
    } catch (e: any) {
        console.error("[DRIVE_ERROR] copySpecificSubfolders:", e);
        console.groupEnd();
        throw e;
    }
};

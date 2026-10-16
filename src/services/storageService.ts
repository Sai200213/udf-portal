import { ref, uploadBytes, uploadBytesResumable, getDownloadURL, UploadTask, listAll, deleteObject, getMetadata, getBlob } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { storage, functions, auth, ensureAuthenticated } from '../firebase/config';

/**
 * Recursively calculates the total storage consumption of a folder in bytes.
 */
export const getStorageFolderSize = async (folderPath: string): Promise<number> => {
    try {
        const folderRef = ref(storage, folderPath);
        const res = await listAll(folderRef);
        
        let totalSize = 0;
        const metadataPromises = res.items.map(async (itemRef) => {
            try {
                const meta = await getMetadata(itemRef);
                return meta.size;
            } catch (err) {
                console.error("Failed to get file metadata:", err);
                return 0;
            }
        });
        
        const sizes = await Promise.all(metadataPromises);
        totalSize += sizes.reduce((acc, curr) => acc + curr, 0);
        
        const subfolderPromises = res.prefixes.map(prefixRef => getStorageFolderSize(prefixRef.fullPath));
        const subfolderSizes = await Promise.all(subfolderPromises);
        totalSize += subfolderSizes.reduce((acc, curr) => acc + curr, 0);
        
        return totalSize;
    } catch (err: any) {
        if (err.code === 'storage/object-not-found') return 0;
        console.error(`Failed to calculate storage size for ${folderPath}:`, err);
        return 0;
    }
};


export interface FileCompressionOptions {
    skipCompression?: boolean;
    password?: string;
}

export const autoCompressFile = async (file: File, options?: FileCompressionOptions): Promise<File> => {
    if (options?.skipCompression) return file;

    if (file.type.startsWith('image/') && file.type !== 'image/gif') {
        try {
            // Document scans need high resolution but compressed size (1800px max size, 0.82 quality)
            const compressed = await compressImage(file, 1800, 0.82);
            return compressed;
        } catch (e) {
            console.warn("[STORAGE] Image compression failed, uploading original:", e);
            return file;
        }
    }

    // PDF document compression (converts multi-page phone/scanner PDFs to optimized high-res Flate PDFs)
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        try {
            const { compressPdf } = await import('../utils/pdfCompression');
            return await compressPdf(file, { password: options?.password });
        } catch (e) {
            console.warn("[STORAGE] PDF compression failed, uploading original:", e);
            return file;
        }
    }

    return file;
};

/**
 * Basic file upload (no progress tracking).
 */
export const uploadFile = async (
    file: File,
    path: string,
    fileName?: string,
    options?: FileCompressionOptions
): Promise<string> => {
    try {
        const processedFile = await autoCompressFile(file, options);
        const finalName = fileName || `${Date.now()}_${processedFile.name}`;
        const storageRef = ref(storage, `${path}/${finalName}`);

        const snapshot = await uploadBytes(storageRef, processedFile);
        // Instead of returning public download URL, return the full storage path
        return snapshot.ref.fullPath;
    } catch (error) {
        console.error("Error uploading file:", error);
        throw error;
    }
};

/**
 * Resolves a secure storage path by downloading it as a blob and returning a local Object URL.
 */
export const getSecureURL = async (storagePath: string | any): Promise<string> => {
    // Sanitize: extract storagePath from object if accidentally passed as {storagePath: '...'}
    let resolvedPath: string = typeof storagePath === 'object' && storagePath !== null && 'storagePath' in storagePath
        ? storagePath.storagePath
        : (typeof storagePath === 'string' ? storagePath : '');

    // If it's already an http/data/blob URL or empty, return it directly
    if (!resolvedPath || resolvedPath.startsWith('http') || resolvedPath.startsWith('data:') || resolvedPath.startsWith('blob:')) {
        return resolvedPath;
    }

    // Primary: Direct client-side getBlob (Strictly private in browser memory, never public/shareable)
    try {
        await ensureAuthenticated();
        const blob = await getBlob(ref(storage, resolvedPath));
        return URL.createObjectURL(blob);
    } catch (error: any) {
        // If file was not found under employees/ path, try resolving via onboarding/ path
        if (error?.code === 'storage/object-not-found' && resolvedPath.startsWith('employees/')) {
            const parts = resolvedPath.split('/');
            const joiningIdx = parts.indexOf('joining');
            if (joiningIdx !== -1 && joiningIdx < parts.length - 1) {
                const subPath = parts.slice(joiningIdx + 1).join('/');
                try {
                    const fallbackPath = `onboarding/${parts[1]}/${subPath}`;
                    const blobFallback = await getBlob(ref(storage, fallbackPath));
                    return URL.createObjectURL(blobFallback);
                } catch (e2) {
                    // continue to cloud function fallback
                }
            }
        }

        // Secondary Fallback: Use Cloud Function if direct client download was blocked
        try {
            const getSecureDocFn = httpsCallable<{ storagePath: string }, { success: boolean; url: string }>(functions, 'getSecureDocumentURL');
            const result = await getSecureDocFn({ storagePath: resolvedPath });
            if (result.data?.success && result.data?.url) {
                return result.data.url;
            }
        } catch (cfError: any) {
            console.warn("Secure document unavailable at path:", resolvedPath, cfError?.message || cfError);
        }

        return '';
    }
};

/**
 * Safely revokes a client-side Blob URL created by getSecureURL to free browser memory.
 */
export const revokeSecureURL = (url?: string | null): void => {
    if (url && typeof url === 'string' && url.startsWith('blob:')) {
        try {
            URL.revokeObjectURL(url);
        } catch (e) {
            // Ignore if already revoked or invalid
        }
    }
};

/**
 * Upload a document with real-time progress tracking (resumable).
 * Used for joining form file uploads.
 */
export const uploadDocumentWithProgress = async (
    file: File,
    path: string,
    onProgress?: (percent: number) => void,
    options?: FileCompressionOptions
): Promise<string> => {
    const processedFile = await autoCompressFile(file, options);
    return new Promise((resolve, reject) => {
        const storageRef = ref(storage, path);
        const uploadTask: UploadTask = uploadBytesResumable(storageRef, processedFile);

        uploadTask.on('state_changed',
            (snapshot) => {
                const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                onProgress?.(percent);
            },
            (error) => {
                console.error('[STORAGE] Upload error:', error);
                reject(error);
            },
            async () => {
                try {
                    // Return the secure path, not the public download URL
                    resolve(uploadTask.snapshot.ref.fullPath);
                } catch (err) {
                    reject(err);
                }
            }
        );
    });
};

/**
 * Upload a submission document with progress.
 * Path: onboarding/{submissionId}/{fieldId}/{filename}
 */
export const uploadSubmissionDocument = async (
    fieldId: string,
    file: File,
    onProgress?: (percent: number) => void,
    customFolder?: string,
    options?: FileCompressionOptions
): Promise<string> => {
    const safeName = `${Date.now()}_${file.name}`;
    let user = auth.currentUser;
    if (!user) {
        user = await ensureAuthenticated();
    }
    const uid = user?.uid;
    if (!uid) throw new Error('User must be authenticated to upload documents.');
    
    // Read the Portal ID from customFolder or sessionStorage if available
    let folderName = customFolder || uid;
    if (!customFolder) {
        const rawDraftId = sessionStorage.getItem('onboarding_savedDraftId');
        if (rawDraftId) {
            try {
                const parsed = JSON.parse(rawDraftId);
                if (parsed && typeof parsed === 'string' && parsed.trim() !== '') {
                    folderName = parsed;
                }
            } catch (e) {
                // ignore
            }
        }
    }
    
    const path = `onboarding/${folderName}/${fieldId}/${safeName}`;
    return uploadDocumentWithProgress(file, path, onProgress, options);
};

export const uploadEmployeeDocument = async (
    employeeId: string,
    file: File,
    docType: string
) => {
    return uploadFile(file, `employees/${employeeId}/joining`, `${docType}_${file.name}`);
};

export const uploadSubmissionAttachment = async (
    submissionId: string,
    file: File
) => {
    // Use the current user's UID as the folder name to satisfy storage rules
    let user = auth.currentUser;
    if (!user) {
        user = await ensureAuthenticated();
    }
    const uid = user?.uid;
    if (!uid) throw new Error('User must be authenticated to upload documents.');
    return uploadFile(file, `onboarding/${uid}`);
};

/**
 * Upload a profile photo for a user (employee or staff).
 * Compresses the image client-side before uploading.
 */
export const uploadProfilePhoto = async (
    userId: string,
    file: File
): Promise<string> => {
    try {
        const compressed = await compressImage(file, 400, 0.8);
        const ext = file.name.split('.').pop() || 'jpg';
        return uploadFile(compressed, `employees/${userId}/profile`, `avatar.${ext}`);
    } catch (error) {
        console.error("Error uploading profile photo:", error);
        throw error;
    }
};

/**
 * Client-side image compression for fast avatar loading.
 */
function compressImage(file: File, maxSize: number, quality: number): Promise<File> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();
        reader.onload = (e) => {
            img.src = e.target?.result as string;
        };
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let { width, height } = img;
            if (width > height) {
                if (width > maxSize) { height = (height * maxSize) / width; width = maxSize; }
            } else {
                if (height > maxSize) { width = (width * maxSize) / height; height = maxSize; }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('Canvas not supported'));
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob(
                (blob) => {
                    const originalName = file.name;
                    const dotIndex = originalName.lastIndexOf('.');
                    const baseName = dotIndex !== -1 ? originalName.substring(0, dotIndex) : originalName;
                    const newName = `${baseName}.jpg`;
                    resolve(new File([blob], newName, { type: 'image/jpeg' }));
                },
                'image/jpeg',
                quality
            );
        };
        img.onerror = reject;
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Recursively deletes a folder and all its contents in Firebase Storage.
 */
export const deleteStorageFolder = async (folderPath: string): Promise<void> => {
    if (!folderPath) return;
    try {
        const folderRef = ref(storage, folderPath);
        const res = await listAll(folderRef);
        
        const deletePromises = res.items.map(itemRef => deleteObject(itemRef));
        const subfolderPromises = res.prefixes.map(prefixRef => deleteStorageFolder(prefixRef.fullPath));
        
        await Promise.all([...deletePromises, ...subfolderPromises]);
    } catch (err: any) {
        // Ignore "object-not-found" or "unauthorized" errors if the folder was already empty/non-existent
        if (err.code !== 'storage/object-not-found' && err.code !== 'storage/unauthorized') {
            console.error(`Failed to delete storage folder ${folderPath}:`, err);
        }
    }
};

/**
 * Logical move of storage files from onboarding to permanent employee folder.
 */
export const moveStorageFiles = async (sourcePath: string, destinationPath: string): Promise<boolean> => {
    try {
        const moveFn = httpsCallable<{ sourcePath: string, destinationPath: string }, { success: boolean }>(functions, 'moveStorageFolder');
        const result = await moveFn({ sourcePath, destinationPath });
        return result.data.success;
    } catch (err) {
        console.error("Error moving storage files:", err);
        return false;
    }
};

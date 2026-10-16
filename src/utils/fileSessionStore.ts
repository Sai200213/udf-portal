/**
 * fileSessionStore.ts
 * 
 * Persists File objects into IndexedDB so they survive browser reloads.
 * sessionStorage can only store strings, but IndexedDB can store Blobs/Files natively.
 * 
 * SECURITY UPDATE: All files are now encrypted using AES-GCM before writing to IndexedDB.
 * The encryption key is stored in sessionStorage and lost when the tab closes.
 */

const DB_NAME = 'onboarding_files';
const STORE_NAME = 'files';
const DB_VERSION = 1;

// --- Crypto Utils ---
async function getOrGenerateKey(): Promise<CryptoKey> {
  let keyStr = sessionStorage.getItem('__fs_key') || localStorage.getItem('__fs_key');
  let rawKey: Uint8Array;
  
  if (keyStr) {
    try {
      const binString = atob(keyStr);
      rawKey = Uint8Array.from(binString, (m) => m.codePointAt(0)!);
    } catch {
      keyStr = null;
    }
  }
  
  if (!keyStr) {
    rawKey = window.crypto.getRandomValues(new Uint8Array(32));
    const binString = Array.from(rawKey, (byte) => String.fromCodePoint(byte)).join("");
    const encoded = btoa(binString);
    sessionStorage.setItem('__fs_key', encoded);
    localStorage.setItem('__fs_key', encoded);
  }
  
  return await window.crypto.subtle.importKey(
    'raw',
    rawKey.buffer as ArrayBuffer,
    'AES-GCM',
    true,
    ['encrypt', 'decrypt']
  );
}

async function encryptBuffer(buffer: ArrayBuffer): Promise<{ ciphertext: ArrayBuffer, iv: ArrayBuffer }> {
  const key = await getOrGenerateKey();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    buffer
  );
  return { ciphertext, iv: iv.buffer };
}

async function decryptBuffer(ciphertext: ArrayBuffer, iv: ArrayBuffer): Promise<ArrayBuffer> {
  const key = await getOrGenerateKey();
  return await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv) },
    key,
    ciphertext
  );
}
// --------------------

/** Open (or create) the IndexedDB database */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Save a File to IndexedDB under the given fieldId key */
export async function saveFileToSession(fieldId: string, file: File): Promise<void> {
  try {
    const buffer = await file.arrayBuffer();
    const { ciphertext, iv } = await encryptBuffer(buffer);

    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    store.put(
      {
        name: file.name,
        type: file.type,
        size: file.size,
        lastModified: file.lastModified,
        buffer: ciphertext,
        iv: iv,
      },
      fieldId
    );

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    db.close();
  } catch (e) {
    console.warn('[fileSessionStore] Failed to save file:', e);
  }
}

/** Remove a single file from IndexedDB */
export async function removeFileFromSession(fieldId: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(fieldId);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (e) {
    console.warn('[fileSessionStore] Failed to remove file:', e);
  }
}

/** Retrieve a File from IndexedDB by fieldId. Returns null if not found. */
export async function getFileFromSession(fieldId: string): Promise<File | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    const result = await new Promise<any>((resolve, reject) => {
      const req = store.get(fieldId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    db.close();

    if (!result) return null;

    let decryptedBuffer: ArrayBuffer;
    if (result.iv) {
        decryptedBuffer = await decryptBuffer(result.buffer, result.iv);
    } else {
        decryptedBuffer = result.buffer; // Legacy fallback for previously unencrypted files
    }

    // Reconstruct a File from the stored ArrayBuffer + metadata
    return new File([decryptedBuffer], result.name, {
      type: result.type,
      lastModified: result.lastModified,
    });
  } catch (e) {
    console.warn('[fileSessionStore] Failed to get file:', e);
    return null;
  }
}

/** Get ALL stored files as a Record<fieldId, File> */
export async function getAllFilesFromSession(): Promise<Record<string, File>> {
  const files: Record<string, File> = {};
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    const [keys, results] = await new Promise<[IDBValidKey[], any[]]>((resolve, reject) => {
      let kList: IDBValidKey[] = [];
      let rList: any[] = [];
      let doneCount = 0;

      const checkDone = () => {
        doneCount++;
        if (doneCount === 2) resolve([kList, rList]);
      };

      const kReq = store.getAllKeys();
      kReq.onsuccess = () => {
        kList = kReq.result;
        checkDone();
      };
      kReq.onerror = () => reject(kReq.error);

      const rReq = store.getAll();
      rReq.onsuccess = () => {
        rList = rReq.result;
        checkDone();
      };
      rReq.onerror = () => reject(rReq.error);
    });

    db.close();

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const result = results[i];
      if (result) {
        try {
          let decryptedBuffer: ArrayBuffer;
          if (result.iv) {
            decryptedBuffer = await decryptBuffer(result.buffer, result.iv);
          } else {
            decryptedBuffer = result.buffer; // Legacy fallback
          }
          
          files[String(key)] = new File([decryptedBuffer], result.name, {
            type: result.type,
            lastModified: result.lastModified,
          });
        } catch {
          // If decryption fails for an orphaned/stale record, skip it silently
        }
      }
    }
  } catch (e) {
    console.warn('[fileSessionStore] Failed to get all files:', e);
  }
  return files;
}

/** Clear all stored files (call on successful submission or exit) */
export async function clearFileSession(): Promise<void> {
  try {
    sessionStorage.removeItem('__fs_key');
    localStorage.removeItem('__fs_key');
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (e) {
    console.warn('[fileSessionStore] Failed to clear files:', e);
  }
}

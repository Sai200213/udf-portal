import { 
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, 
  updateDoc, query, orderBy, onSnapshot, serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { SETTINGS_COLLECTION } from './adminService';
import { Site } from '../../types';

export type RecycleBinItemType = 'SITE' | 'STAFF' | 'EMPLOYEE' | 'SUBMISSION' | 'INVITE' | 'ROLE' | 'VACANCY' | 'DESIGNATION';

export interface RecycleBinItem {
  id: string;
  itemType: RecycleBinItemType;
  name: string;
  originalId: string;
  originalCollection: string;
  data: any;
  deletedAt: string;
  deletedByUid: string;
  deletedByName: string;
  expiresAt: string; // 30 days retention
  metadata?: Record<string, any>;
}

const RECYCLE_BIN_COLLECTION = 'recycle_bin';
const RETENTION_DAYS = 30;

/**
 * Move any portal item to the universal Recycle Bin.
 */
export async function moveToRecycleBin(params: {
  itemType: RecycleBinItemType;
  name: string;
  originalId: string;
  originalCollection: string;
  data: any;
  deletedByUid: string;
  deletedByName: string;
  metadata?: Record<string, any>;
}): Promise<string> {
  const docRef = doc(collection(db, RECYCLE_BIN_COLLECTION));
  const now = new Date();
  const expires = new Date();
  expires.setDate(now.getDate() + RETENTION_DAYS);

  const binItem: Omit<RecycleBinItem, 'id'> = {
    itemType: params.itemType,
    name: params.name || 'Unnamed Record',
    originalId: params.originalId,
    originalCollection: params.originalCollection,
    data: params.data,
    deletedAt: now.toISOString(),
    deletedByUid: params.deletedByUid || 'system',
    deletedByName: params.deletedByName || 'Admin',
    expiresAt: expires.toISOString(),
    ...(params.metadata ? { metadata: params.metadata } : {})
  };

  await setDoc(docRef, binItem);
  return docRef.id;
}

/**
 * Restore an item from the Recycle Bin back to its original state and collection.
 */
export async function restoreFromRecycleBin(recycleBinItemId: string): Promise<{ success: boolean; message: string }> {
  const binDocRef = doc(db, RECYCLE_BIN_COLLECTION, recycleBinItemId);
  const binSnap = await getDoc(binDocRef);

  if (!binSnap.exists()) {
    throw new Error('Record not found in Recycle Bin or already restored.');
  }

  const binItem = binSnap.data() as RecycleBinItem;
  const { itemType, originalId, data } = binItem;

  try {
    switch (itemType) {
      case 'SITE': {
        // Restore site back to settings/sites and sites collection
        const sitesDocRef = doc(db, SETTINGS_COLLECTION, 'sites');
        const sitesSnap = await getDoc(sitesDocRef);
        let existingSites: Site[] = [];
        if (sitesSnap.exists()) {
          existingSites = sitesSnap.data().sites || [];
        }

        // Avoid duplicate ID if a new site was created with same ID
        const filtered = existingSites.filter(s => s.id !== originalId);
        const restoredSite: Site = {
          ...data,
          id: originalId,
          isActive: true
        };
        const updatedSites = [...filtered, restoredSite];

        await updateDoc(sitesDocRef, { sites: updatedSites });

        // Also restore to standalone sites collection if it exists
        try {
          await setDoc(doc(db, 'sites', originalId), restoredSite, { merge: true });
        } catch (_) {}

        // Restore any linked vacancies that were archived with this site
        if (binItem.metadata?.linkedVacancies && Array.isArray(binItem.metadata.linkedVacancies)) {
          for (const vac of binItem.metadata.linkedVacancies) {
            try {
              if (vac.id) {
                await setDoc(doc(db, 'vacancies', vac.id), {
                  ...vac,
                  status: 'Open',
                  isDeleted: false,
                  restoredAt: new Date().toISOString()
                }, { merge: true });
              }
            } catch (vErr) {
              console.warn('Failed to restore linked vacancy during site restore:', vErr);
            }
          }
        }
        break;
      }

      case 'STAFF': {
        // Restore staff account to staff_accounts collection
        const staffRef = doc(db, 'staff_accounts', originalId);
        await setDoc(staffRef, {
          ...data,
          isDisabled: false,
          isDeleted: false,
          restoredAt: new Date().toISOString()
        }, { merge: true });
        break;
      }

      case 'EMPLOYEE': {
        // Restore employee record
        const empRef = doc(db, 'employees', originalId);
        await updateDoc(empRef, {
          isDeleted: false,
          deletedAt: null,
          status: 'Active',
          restoredAt: new Date().toISOString()
        });
        break;
      }

      case 'SUBMISSION': {
        // Restore onboarding submission
        const subRef = doc(db, 'onboarding_submissions', originalId);
        await setDoc(subRef, {
          ...data,
          isDeleted: false,
          status: data.status || 'Pending Review',
          restoredAt: new Date().toISOString()
        }, { merge: true });
        break;
      }

      case 'INVITE': {
        // Restore referral invite
        const inviteRef = doc(db, 'referral_invites', originalId);
        await setDoc(inviteRef, {
          ...data,
          status: 'Active',
          isDeleted: false,
          restoredAt: new Date().toISOString()
        }, { merge: true });
        break;
      }

      case 'VACANCY': {
        // Restore vacancy
        const vacRef = doc(db, 'vacancies', originalId);
        await setDoc(vacRef, {
          ...data,
          status: 'Open',
          isDeleted: false,
          restoredAt: new Date().toISOString()
        }, { merge: true });
        break;
      }

      case 'DESIGNATION': {
        // Restore designation back to portal_config/global.designations
        const desigName = binItem.name || binItem.originalId;
        const globalDocRef = doc(db, SETTINGS_COLLECTION, 'portal_config');
        const globalSnap = await getDoc(globalDocRef);
        let currentDesignations: string[] = [];
        if (globalSnap.exists()) {
          currentDesignations = globalSnap.data().designations || [];
        }
        if (!currentDesignations.includes(desigName)) {
          const updatedDesignations = [...currentDesignations, desigName];
          await setDoc(globalDocRef, { designations: updatedDesignations }, { merge: true });
        }

        // Restore allowedDesignations to sites that previously authorized it
        const targetSites: string[] = binItem.metadata?.allowedSiteIds || binItem.data?.allowedSiteIds || [];
        if (targetSites.length > 0) {
          const sitesDocRef = doc(db, SETTINGS_COLLECTION, 'sites');
          const sitesSnap = await getDoc(sitesDocRef);
          if (sitesSnap.exists()) {
            const existingSites: Site[] = sitesSnap.data().sites || [];
            let modified = false;
            const updatedSites = existingSites.map(s => {
              if (targetSites.includes(s.id)) {
                const allowed = s.allowedDesignations || [];
                if (!allowed.includes(desigName)) {
                  modified = true;
                  return { ...s, allowedDesignations: [...allowed, desigName] };
                }
              }
              return s;
            });
            if (modified) {
              await updateDoc(sitesDocRef, { sites: updatedSites });
            }
          }
        }
        break;
      }

      default: {
        // Generic restore to originalCollection
        if (binItem.originalCollection && originalId) {
          const targetRef = doc(db, binItem.originalCollection, originalId);
          await setDoc(targetRef, {
            ...data,
            isDeleted: false,
            restoredAt: new Date().toISOString()
          }, { merge: true });
        } else {
          throw new Error(`Unsupported item type: ${itemType}`);
        }
      }
    }

    // Delete item from recycle bin once successfully restored
    await deleteDoc(binDocRef);

    return {
      success: true,
      message: `Successfully restored "${binItem.name}" to its original state!`
    };
  } catch (err: any) {
    console.error('Failed to restore item from recycle bin:', err);
    throw new Error(err.message || 'Failed to restore record');
  }
}

/**
 * Permanently purge an item from the Recycle Bin.
 */
export async function permanentDeleteFromRecycleBin(recycleBinItemId: string): Promise<void> {
  const binDocRef = doc(db, RECYCLE_BIN_COLLECTION, recycleBinItemId);
  await deleteDoc(binDocRef);
}

/**
 * Permanently purge all items currently in the Recycle Bin.
 */
export async function emptyRecycleBin(): Promise<number> {
  const snap = await getDocs(collection(db, RECYCLE_BIN_COLLECTION));
  let count = 0;
  for (const d of snap.docs) {
    await deleteDoc(d.ref);
    count++;
  }
  return count;
}

/**
 * Subscribe to the Recycle Bin in real time.
 */
export function subscribeToRecycleBin(callback: (items: RecycleBinItem[]) => void): () => void {
  const q = query(collection(db, RECYCLE_BIN_COLLECTION), orderBy('deletedAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const items: RecycleBinItem[] = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    } as RecycleBinItem));
    callback(items);
  }, (err) => {
    console.warn('[RecycleBin] Subscription error:', err);
    callback([]);
  });
}

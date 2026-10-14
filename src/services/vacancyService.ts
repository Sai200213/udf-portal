
import { db } from '../firebase/config';
import { collection, doc, addDoc, updateDoc, deleteDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { Vacancy } from '../../types';
import { logSystemAction } from './auditService';

const VACANCIES_COLLECTION = 'vacancies';

/**
 * Fetch vacancies.
 * @param siteId Optional. If provided, filters by siteId.
 */
export const getVacancies = async (siteId?: string): Promise<Vacancy[]> => {
    try {
        let q;
        if (siteId) {
            q = query(collection(db, VACANCIES_COLLECTION), where("siteId", "==", siteId));
        } else {
            q = collection(db, VACANCIES_COLLECTION);
        }

        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...(d.data() as object) } as unknown as Vacancy));
    } catch (error) {
        console.error("Error fetching vacancies:", error);
        return [];
    }
};

export const createVacancy = async (vacancy: Omit<Vacancy, 'id'>): Promise<string> => {
    try {
        const docRef = await addDoc(collection(db, VACANCIES_COLLECTION), vacancy);
        await logSystemAction('CREATE', 'SYSTEM', `Created job vacancy "${vacancy.title}" for site "${vacancy.siteName}" (${vacancy.count} openings)`);
        return docRef.id;
    } catch (error) {
        console.error("Error creating vacancy:", error);
        throw error;
    }
};

export const updateVacancy = async (id: string, updates: Partial<Vacancy>): Promise<void> => {
    try {
        await updateDoc(doc(db, VACANCIES_COLLECTION, id), updates);
        await logSystemAction('UPDATE', 'SYSTEM', `Updated job vacancy ${id}${updates.title ? ` ("${updates.title}")` : ''}`);
    } catch (error) {
        console.error("Error updating vacancy:", error);
        throw error;
    }
};

export const deleteVacancy = async (id: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, VACANCIES_COLLECTION, id));
        await logSystemAction('DELETE', 'SYSTEM', `Deleted job vacancy ${id}`);
    } catch (error) {
        console.error("Error deleting vacancy:", error);
        throw error;
    }
};

/**
 * Public method to get open vacancies for public blog
 */
export const getOpenVacancies = async (): Promise<Vacancy[]> => {
    try {
        const q = query(
            collection(db, VACANCIES_COLLECTION),
            where("status", "==", "Open")
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as unknown as Vacancy));
    } catch (error) {
        console.error("Error fetching public vacancies:", error);
        return [];
    }
}


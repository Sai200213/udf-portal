import log from "@/src/utils/logger";

import { db } from '../firebase/config';
import { doc, getDoc, setDoc, collection, getCountFromServer, query, where } from 'firebase/firestore';

const SETTINGS_COLLECTION = 'settings';
const STATS_DOC_ID = 'public_stats';
const EMPLOYEES_COLLECTION = 'employees';

export interface PublicStats {
    totalEmployees: number;
    lastUpdated: string;
}

export const getPublicStats = async (): Promise<PublicStats> => {
    try {
        const docRef = doc(db, SETTINGS_COLLECTION, STATS_DOC_ID);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            return snap.data() as PublicStats;
        }
        return { totalEmployees: 0, lastUpdated: new Date().toISOString() };
    } catch (error) {
        console.error("Error fetching public stats:", error);
        return { totalEmployees: 0, lastUpdated: new Date().toISOString() };
    }
};

export const updatePublicStats = async (): Promise<void> => {
    try {
        // Calculate Total Active Employees
        const empColl = collection(db, EMPLOYEES_COLLECTION);
        const q = query(empColl, where("isActive", "==", true));
        const snapshot = await getCountFromServer(q);
        const count = snapshot.data().count;

        const stats: PublicStats = {
            totalEmployees: count,
            lastUpdated: new Date().toISOString()
        };

        await setDoc(doc(db, SETTINGS_COLLECTION, STATS_DOC_ID), stats, { merge: true });
        log.log("Public stats updated:", stats);

    } catch (error) {
        console.error("Error updating public stats:", error);
        // Don't throw, just log. This is a background sync.
    }
};






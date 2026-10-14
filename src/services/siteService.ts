import log from "@/src/utils/logger";

import { db } from '../firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Site } from '../../types';
import { logSystemAction } from './auditService';

const SETTINGS_COLLECTION = 'settings';
const SITES_DOC_ID = 'sites';

/**
 * Recursively strips undefined values from an object so Firestore doesn't reject it.
 */
const stripUndefined = (obj: any): any => {
    if (Array.isArray(obj)) return obj.map(stripUndefined);
    if (obj !== null && typeof obj === 'object') {
        return Object.fromEntries(
            Object.entries(obj)
                .filter(([, v]) => v !== undefined)
                .map(([k, v]) => [k, stripUndefined(v)])
        );
    }
    return obj;
};

/**
 * Updates specific details for a single site within the 'sites' setting document.
 */
export const updateSiteDetails = async (
    siteId: string,
    updates: { address?: string; googleMapsLink?: string; contactNumber?: string; allowedDesignations?: string[] }
): Promise<void> => {
    const sitesRef = doc(db, SETTINGS_COLLECTION, SITES_DOC_ID);

    try {
        const snap = await getDoc(sitesRef);
        if (!snap.exists()) throw new Error("Sites configuration not found");

        const currentSites = snap.data().sites as Site[];
        const siteIndex = currentSites.findIndex(s => s.id === siteId);

        if (siteIndex === -1) throw new Error("Site not found");

        const updatedSite = { ...currentSites[siteIndex], ...updates };
        const newSites = [...currentSites];
        newSites[siteIndex] = updatedSite;

        await setDoc(sitesRef, { sites: stripUndefined(newSites) }, { merge: true });
        log.log(`Updated site details for ${siteId}`);
        await logSystemAction('UPDATE', 'SITES', `Updated site details for "${updatedSite.name}" (${siteId})`);

    } catch (error) {
        console.error("Error updating site details:", error);
        throw error;
    }
};

export const saveAllSites = async (sites: Site[]): Promise<void> => {
    const sitesRef = doc(db, SETTINGS_COLLECTION, SITES_DOC_ID);
    await setDoc(sitesRef, { sites: stripUndefined(sites) }, { merge: true });
    await logSystemAction('UPDATE', 'SITES', `Updated sites portfolio configuration (${sites.length} sites total)`);
};

export const getSiteById = async (siteId: string): Promise<Site | undefined> => {
    const sitesRef = doc(db, SETTINGS_COLLECTION, SITES_DOC_ID);
    const snap = await getDoc(sitesRef);
    if (!snap.exists()) return undefined;
    const sites = snap.data().sites as Site[];
    return sites.find(s => s.id === siteId);
}

export const getSites = async (): Promise<Site[]> => {
    const sitesRef = doc(db, SETTINGS_COLLECTION, SITES_DOC_ID);
    const snap = await getDoc(sitesRef);
    if (!snap.exists()) return [];
    return snap.data().sites as Site[];
};

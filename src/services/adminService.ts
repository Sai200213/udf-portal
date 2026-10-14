import log from "@/src/utils/logger";
import { db } from '../firebase/config';
import { doc, onSnapshot, setDoc, getDoc, updateDoc, collection, query, getDocs, writeBatch, deleteDoc, orderBy } from 'firebase/firestore';
import { Role, Site, WorkflowConfig, PortalConfig } from '../../types';
import { logSystemAction } from './auditService';

export const SETTINGS_COLLECTION = 'settings';
const ROLES_DOC_ID = 'roles';
const SITES_DOC_ID = 'sites';
const WORKFLOWS_DOC_ID = 'workflows';
const PORTAL_CONFIG_DOC_ID = 'portal_config';
const LEAVE_POLICY_DOC_ID = 'leave_policy';

const FORM_SECTIONS_DOC_ID = 'form_sections';
const EDITABLE_FIELDS_DOC_ID = 'editable_fields';
const STAFF_COLLECTION_ID = 'staff_accounts';
const ROLES_COLLECTION = 'roles';
function convertToRole(doc: any): Role {
    const data = doc.data();
    return {
        id: data.id || doc.id,
        name: data.name,
        permissions: data.permissions || [],
        isDisabled: data.isDisabled || false,
        visibleMasterListFields: data.visibleMasterListFields || [],
        fieldVisibility: data.fieldVisibility || {},
        onboardingFieldVisibility: data.onboardingFieldVisibility || {},
        allowedPrefillFieldIds: data.allowedPrefillFieldIds || []
    };
}


// ... (existing constants)

// --- Form Sections (Form Builder) ---
export const subscribeToFormSections = (callback: (sections: any[]) => void) => {
    return onSnapshot(doc(db, SETTINGS_COLLECTION, FORM_SECTIONS_DOC_ID), (snap) => {
        if (snap.exists()) {
            let sections = snap.data().sections || [];
            // Ensure Job Details has Unit or Facility (order 1) before Post of Apply (order 2)
            sections = sections.map((s: any) => {
                if ((s.name === 'Job Details' || s.id === 'eb4bf8a6-a8bd-4563-817d-792716e6474c') && Array.isArray(s.fields)) {
                    const unitField = s.fields.find((f: any) => f.id === '52ae217b-2602-4337-a1cd-a1f9bd36a4b0' || f.label === 'Unit or Facility');
                    const postField = s.fields.find((f: any) => f.id === 'db307195-cf54-4a6e-9056-f3974b050c4d' || f.label === 'Post of Apply' || f.label === 'Designation');
                    if (unitField && postField) {
                        unitField.order = 1;
                        postField.order = 2;
                        s.fields.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
                    }
                }
                return s;
            });
            callback(sections);
        } else {
            callback([]);
        }
    }, (error) => {
        console.error("Error subscribing to form sections:", error);
    });
};

export const updateFormSections = async (sections: any[]) => {
    log.log("Saving form sections to Firestore:", sections);
    await setDoc(doc(db, SETTINGS_COLLECTION, FORM_SECTIONS_DOC_ID), { sections });
    await logSystemAction('UPDATE', 'SYSTEM', `Updated onboarding form builder layout (${sections.length} sections)`);
};

// --- Editable Fields (Account Updates Config) ---
export const subscribeToEditableFields = (callback: (ids: string[]) => void) => {
    return onSnapshot(doc(db, SETTINGS_COLLECTION, EDITABLE_FIELDS_DOC_ID), (snap) => {
        if (snap.exists()) {
            callback(snap.data().ids || []);
        } else {
            callback([]);
        }
    }, (error) => {
        console.error("Error subscribing to editable fields:", error);
    });
};

export const updateEditableFields = async (ids: string[]) => {
    await setDoc(doc(db, SETTINGS_COLLECTION, EDITABLE_FIELDS_DOC_ID), { ids });
    await logSystemAction('UPDATE', 'SYSTEM', `Updated employee editable self-service fields (${ids.length} fields)`);
};

// ... (start of existing Roles)
// --- Roles ---

export const subscribeToRoles = (callback: (roles: Role[]) => void) => {
    return onSnapshot(collection(db, ROLES_COLLECTION), (snap) => {
        const roles = snap.docs.map(doc => convertToRole(doc));
        callback(roles);
    }, (error) => {
        console.error("Error subscribing to roles:", error);
    });
};

export const updateRoles = async (roles: Role[]) => {
    log.log("Syncing roles to dedicated 'roles' collection...");
    const batch = writeBatch(db);

    // 1. Get all existing roles in the collection to handle deletions
    const snap = await getDocs(collection(db, ROLES_COLLECTION));
    const existingIds = snap.docs.map(d => d.id);
    const newIds = roles.map(r => r.id);

    // 2. Add or Update roles
    roles.forEach(role => {
        const roleRef = doc(db, ROLES_COLLECTION, role.id);
        batch.set(roleRef, { ...role });
    });

    // 3. Handle Deletions (roles removed from the UI list)
    existingIds.forEach(id => {
        if (!newIds.includes(id)) {
            const roleRef = doc(db, ROLES_COLLECTION, id);
            batch.delete(roleRef);
        }
    });

    await batch.commit();
    log.log("Roles successfully synced.");

    // Optional: Still update the legacy document for one version as backup
    await setDoc(doc(db, SETTINGS_COLLECTION, ROLES_DOC_ID), { roles });
    await logSystemAction('UPDATE', 'ROLES', `Synced roles list (${roles.length} roles total)`);
};

// --- Sites ---
export const subscribeToSites = (callback: (sites: Site[]) => void) => {
    return onSnapshot(doc(db, SETTINGS_COLLECTION, SITES_DOC_ID), (snap) => {
        if (snap.exists()) {
            callback(snap.data().sites || []);
        } else {
            callback([]);
        }
    }, (error) => {
        console.error("Error subscribing to sites:", error);
    });
};

export const updateSites = async (sites: Site[]) => {
    await setDoc(doc(db, SETTINGS_COLLECTION, SITES_DOC_ID), { sites });
    await logSystemAction('UPDATE', 'SITES', `Updated sites roster (${sites.length} sites)`);
};

// --- Workflow Configs ---
export const subscribeToWorkflows = (callback: (configs: WorkflowConfig[]) => void) => {
    return onSnapshot(doc(db, SETTINGS_COLLECTION, WORKFLOWS_DOC_ID), (snap) => {
        if (snap.exists()) {
            callback(snap.data().configs || []);
        } else {
            callback([]);
        }
    }, (error) => {
        console.error("Error subscribing to workflows:", error);
    });
};

export const updateWorkflows = async (configs: WorkflowConfig[]) => {
    await setDoc(doc(db, SETTINGS_COLLECTION, WORKFLOWS_DOC_ID), { configs });
    await logSystemAction('UPDATE', 'SYSTEM', `Updated approval workflow configurations (${configs.length} workflows)`);
};

// --- Portal Config ---
export const subscribeToPortalConfig = (callback: (config: PortalConfig | null) => void) => {
    return onSnapshot(doc(db, SETTINGS_COLLECTION, PORTAL_CONFIG_DOC_ID), (snap) => {
        if (snap.exists()) {
            callback(snap.data() as PortalConfig);
        } else {
            callback(null);
        }
    }, (error) => {
        console.error("Error subscribing to portal config:", error);
    });
};

export const updatePortalConfig = async (config: PortalConfig) => {
    await setDoc(doc(db, SETTINGS_COLLECTION, PORTAL_CONFIG_DOC_ID), config);
    await logSystemAction('UPDATE', 'SETTINGS', `Updated global portal settings and resource limits`);
};

// --- Leave Policy ---
export const subscribeToLeavePolicy = (callback: (policy: any | null) => void) => {
    return onSnapshot(doc(db, SETTINGS_COLLECTION, LEAVE_POLICY_DOC_ID), (snap) => {
        if (snap.exists()) {
            callback(snap.data());
        } else {
            callback(null);
        }
    }, (error) => {
        console.error("Error subscribing to leave policy:", error);
    });
};

export const updateLeavePolicy = async (policy: any) => {
    await setDoc(doc(db, SETTINGS_COLLECTION, LEAVE_POLICY_DOC_ID), policy);
    await logSystemAction('UPDATE', 'LEAVES', `Updated organization leave policy`);
};

// --- Staff Users (Collection-based) ---
export const subscribeToStaffUsers = (callback: (users: any[]) => void) => {
    return onSnapshot(collection(db, STAFF_COLLECTION_ID), (snap) => {
        const users = snap.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        }));
        callback(users);
    }, (error) => {
        console.error("Error subscribing to staff users:", error);
    });
};

export const updateStaffUsers = async (users: any[]) => {
    // Use writeBatch for atomicity and speed (up to 500 ops per batch)
    const BATCH_LIMIT = 490;
    const validUsers = users.filter(u => u.id);

    for (let i = 0; i < validUsers.length; i += BATCH_LIMIT) {
        const batch = writeBatch(db);
        const chunk = validUsers.slice(i, i + BATCH_LIMIT);
        chunk.forEach(user => {
            batch.set(doc(db, STAFF_COLLECTION_ID, user.id), user, { merge: true });
        });
        await batch.commit();
    }
};

// --- Initial Data Seeding ---
// --- Initial Data Seeding ---
export const seedInitialData = async (
    defaultRoles: Role[],
    defaultSites: Site[],
    defaultWorkflows: WorkflowConfig[],
    defaultPortalConfig: PortalConfig,
    defaultLeavePolicy: any,
    defaultStaff: any[],
    defaultSections: any[],
    defaultEditableFields: string[]
) => {
    try {
        const rolesSnap = await getDoc(doc(db, SETTINGS_COLLECTION, ROLES_DOC_ID));
        if (!rolesSnap.exists()) {
            await updateRoles(defaultRoles);
            log.log("Seeded Roles");
        }

        const sitesSnap = await getDoc(doc(db, SETTINGS_COLLECTION, SITES_DOC_ID));
        if (!sitesSnap.exists()) {
            await updateSites(defaultSites);
            log.log("Seeded Sites");
        }

        const workflowsSnap = await getDoc(doc(db, SETTINGS_COLLECTION, WORKFLOWS_DOC_ID));
        if (!workflowsSnap.exists()) {
            await updateWorkflows(defaultWorkflows);
            log.log("Seeded Workflows");
        }

        const configSnap = await getDoc(doc(db, SETTINGS_COLLECTION, PORTAL_CONFIG_DOC_ID));
        if (!configSnap.exists()) {
            await updatePortalConfig(defaultPortalConfig);
            log.log("Seeded Portal Config");
        }

        const policySnap = await getDoc(doc(db, SETTINGS_COLLECTION, LEAVE_POLICY_DOC_ID));
        if (!policySnap.exists()) {
            await updateLeavePolicy(defaultLeavePolicy);
            log.log("Seeded Leave Policy");
        }

        const sectionsSnap = await getDoc(doc(db, SETTINGS_COLLECTION, FORM_SECTIONS_DOC_ID));
        if (!sectionsSnap.exists()) {
            await updateFormSections(defaultSections);
            log.log("Seeded Form Sections");
        }

        const fieldsSnap = await getDoc(doc(db, SETTINGS_COLLECTION, EDITABLE_FIELDS_DOC_ID));
        if (!fieldsSnap.exists()) {
            await updateEditableFields(defaultEditableFields);
            log.log("Seeded Editable Fields");
        }
    } catch (error) {
        log.error("Error seeding initial data:", error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY PROFILE CLAIM — Settings & Imports
// ─────────────────────────────────────────────────────────────────────────────

const LEGACY_CONFIG_DOC_ID = 'legacy_claim_config';
const LEGACY_IMPORTS_COLLECTION = 'legacy_employee_imports';

import { LegacyClaimConfig, LegacyImportedEmployee } from '../../types';

/** Subscribe to Legacy Claim Config */
export const subscribeToLegacyClaimConfig = (callback: (config: LegacyClaimConfig | null) => void) => {
    return onSnapshot(doc(db, SETTINGS_COLLECTION, LEGACY_CONFIG_DOC_ID), (snap) => {
        if (snap.exists()) {
            callback(snap.data() as LegacyClaimConfig);
        } else {
            callback(null);
        }
    }, (error) => {
        console.error("Error subscribing to legacy claim config:", error);
    });
};

/** Update Legacy Claim Config */
export const updateLegacyClaimConfig = async (config: LegacyClaimConfig) => {
    await setDoc(doc(db, SETTINGS_COLLECTION, LEGACY_CONFIG_DOC_ID), config);
};

/** Subscribe to Legacy Imported Employees (unclaimed only by default) */
export const subscribeToLegacyImports = (callback: (imports: LegacyImportedEmployee[]) => void) => {
    const q = query(collection(db, LEGACY_IMPORTS_COLLECTION), orderBy('importedAt', 'desc'));
    return onSnapshot(q, (snap) => {
        const imports = snap.docs.map(d => ({
            ...d.data(),
            id: d.id,
        })) as LegacyImportedEmployee[];
        callback(imports);
    }, (error) => {
        console.error("Error subscribing to legacy imports:", error);
    });
};

/** Bulk upload legacy employees from parsed CSV/Excel */
export const bulkUploadLegacyImports = async (rows: LegacyImportedEmployee[]) => {
    const BATCH_LIMIT = 490;
    for (let i = 0; i < rows.length; i += BATCH_LIMIT) {
        const batch = writeBatch(db);
        const chunk = rows.slice(i, i + BATCH_LIMIT);
        chunk.forEach(row => {
            const ref = row.id ? doc(db, LEGACY_IMPORTS_COLLECTION, row.id) : doc(collection(db, LEGACY_IMPORTS_COLLECTION));
            batch.set(ref, { ...row, id: ref.id });
        });
        await batch.commit();
    }
};

/** Delete a single legacy import */
export const deleteLegacyImport = async (id: string) => {
    await deleteDoc(doc(db, LEGACY_IMPORTS_COLLECTION, id));
};

/** Update a single legacy import record */
export const updateLegacyImport = async (id: string, data: Partial<LegacyImportedEmployee>) => {
    await updateDoc(doc(db, LEGACY_IMPORTS_COLLECTION, id), data);
};

/** Clear all legacy imports */
export const clearAllLegacyImports = async () => {
    const snap = await getDocs(collection(db, LEGACY_IMPORTS_COLLECTION));
    const BATCH_LIMIT = 490;
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
        const batch = writeBatch(db);
        docs.slice(i, i + BATCH_LIMIT).forEach(d => batch.delete(d.ref));
        await batch.commit();
    }
};

import log from "@/src/utils/logger";
/**
 * ONE-TIME MIGRATION: Apply validation rules to all Form Builder fields in Firestore.
 * 
 * This script reads the current sections, applies smart validation rules based on
 * field labels and types, then saves everything back in one write.
 * 
 * Run from the browser console (admin must be logged in):
 *   import('./src/utils/applyValidationRules').then(m => m.runMigration())
 * 
 * Or call from a component/button.
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

const SETTINGS_COLLECTION = 'settings';
const FORM_SECTIONS_DOC_ID = 'form_sections';

// --- Validation Rule Definitions ---
// Maps field labels (lowercase) to their validation properties.

interface ValidationRule {
    allowedPattern?: 'alphabets' | 'numbers' | 'alphanumeric' | 'alphanumeric_special' | 'any';
    minLength?: number;
    maxLength?: number;
    minAge?: number;
    maxFileSizeMB?: number;
}

// Exact label matches (case-insensitive)
const EXACT_RULES: Record<string, ValidationRule> = {
    'full name': { allowedPattern: 'alphabets', minLength: 2, maxLength: 100 },
    'phone number': { allowedPattern: 'numbers', minLength: 10, maxLength: 10 },
    'date of birth': { minAge: 18 },
    'height': { allowedPattern: 'alphanumeric', minLength: 1, maxLength: 10 },
    'identity marks': { allowedPattern: 'alphanumeric_special', minLength: 2, maxLength: 200 },
    'spouse name': { allowedPattern: 'alphabets', minLength: 2, maxLength: 100 },

    // Reference Section
    'reference name': { allowedPattern: 'alphabets', minLength: 2, maxLength: 100 },
    'reference relationship': { allowedPattern: 'alphabets', minLength: 2, maxLength: 50 },
    'reference address': { allowedPattern: 'alphanumeric_special', minLength: 5, maxLength: 300 },
    'reference contact no': { allowedPattern: 'numbers', minLength: 10, maxLength: 10 },

    // Family Details
    "father's name": { allowedPattern: 'alphabets', minLength: 2, maxLength: 100 },
    "mother's name": { allowedPattern: 'alphabets', minLength: 2, maxLength: 100 },
    "father's mobile number": { allowedPattern: 'numbers', minLength: 10, maxLength: 10 },
    "mother's mobile number": { allowedPattern: 'numbers', minLength: 10, maxLength: 10 },

    // Government IDs
    'aadhar card no': { allowedPattern: 'numbers', minLength: 12, maxLength: 12 },
    'pan card no': { allowedPattern: 'alphanumeric', minLength: 10, maxLength: 10 },
    'uan no or epfo': { allowedPattern: 'alphanumeric', minLength: 5, maxLength: 25 },
    'esic no': { allowedPattern: 'alphanumeric', minLength: 5, maxLength: 20 },
    'pvc number (if yes)': { allowedPattern: 'alphanumeric', minLength: 3, maxLength: 30 },

    // Bank Details
    'bank name': { allowedPattern: 'alphabets', minLength: 2, maxLength: 100 },
    'account no': { allowedPattern: 'numbers', minLength: 8, maxLength: 18 },
    'ifsc code': { allowedPattern: 'alphanumeric', minLength: 11, maxLength: 11 },
    'branch name': { allowedPattern: 'alphabets', minLength: 2, maxLength: 100 },

    // Address
    'present address': { allowedPattern: 'alphanumeric_special', minLength: 10, maxLength: 500 },
    'permanent address': { allowedPattern: 'alphanumeric_special', minLength: 10, maxLength: 500 },

    // Job Details (text fields only)
    'previous company & experience': { allowedPattern: 'alphanumeric_special', minLength: 3, maxLength: 300 },
};

// Keyword-based fallback rules (if exact match not found)
function getKeywordRule(label: string): ValidationRule | null {
    const l = label.toLowerCase();

    // Phone/Mobile fields
    if (l.includes('phone') || l.includes('mobile') || l.includes('whatsapp') || l.includes('contact no')) {
        return { allowedPattern: 'numbers', minLength: 10, maxLength: 10 };
    }
    // Name fields
    if ((l.includes('name') && !l.includes('company')) || l.includes("father's") || l.includes("mother's")) {
        return { allowedPattern: 'alphabets', minLength: 2, maxLength: 100 };
    }
    // Address fields
    if (l.includes('address')) {
        return { allowedPattern: 'alphanumeric_special', minLength: 5, maxLength: 500 };
    }
    return null;
}


export async function runMigration() {
    log.log('🚀 Starting validation rules migration...');

    try {
        const docRef = doc(db, SETTINGS_COLLECTION, FORM_SECTIONS_DOC_ID);
        const snap = await getDoc(docRef);

        if (!snap.exists()) {
            console.error('❌ No form_sections document found in Firestore!');
            return { success: false, error: 'No form sections found' };
        }

        const sections = snap.data().sections || [];
        let updatedCount = 0;
        let skippedCount = 0;

        const updatedSections = sections.map((section: any) => {
            const updatedFields = (section.fields || []).map((field: any) => {
                // Skip Section Headers, Checkboxes, Information Text, or fields without a type
                if (!field.type || ['Section Header', 'Checkbox (multiple choices)', 'Information Text', 'Radio Buttons'].includes(field.type)) {
                    skippedCount++;
                    return field;
                }

                const label = (field.label || '').toLowerCase().trim();

                const getValidationRules = (fLabel: string) => {
                    const lbl = (fLabel || '').toLowerCase().trim();
                    let rule = EXACT_RULES[lbl];
                    if (!rule && ['Text Input', 'Text Area'].includes(field.type)) {
                        rule = getKeywordRule(lbl) || null;
                    }
                    return rule || {};
                };

                const rule = getValidationRules(field.label);
                const originalField = { ...field }; // Keep a copy to check if changes were made

                // Apply allowedPattern if not already set
                if (rule.allowedPattern && !field.allowedPattern) {
                    field.allowedPattern = rule.allowedPattern;
                }

                // Apply minLength and maxLength for Text Input and Text Area
                if (['Text Input', 'Text Area'].includes(field.type)) {
                    if (rule.minLength !== undefined && field.minLength === undefined) {
                        field.minLength = rule.minLength;
                    }
                    if (rule.maxLength !== undefined && field.maxLength === undefined) {
                        field.maxLength = rule.maxLength;
                    }
                }

                // Apply minAge for Date Picker
                if (field.type === 'Date Picker' && rule.minAge !== undefined && field.minAge === undefined) {
                    field.minAge = rule.minAge;
                }

                // Apply default maxFileSizeMB for File Upload
                if (field.type === 'File Upload' && field.maxFileSizeMB === undefined) {
                    field.maxFileSizeMB = 5; // Default 5MB for all uploads to prevent runaway storage
                }

                // Check if the field was actually updated
                const hasChanged = JSON.stringify(originalField) !== JSON.stringify(field);
                if (hasChanged) {
                    updatedCount++;
                    log.log(`  ✅ ${field.label} (${field.type}): Updated rules`);
                } else {
                    skippedCount++;
                }
                return field;
            });
            return { ...section, fields: updatedFields };
        });

        // Save back to Firestore
        await setDoc(docRef, { sections: updatedSections });

        log.log(`\n🎉 Migration complete!`);
        log.log(`   Updated: ${updatedCount} fields`);
        log.log(`   Skipped: ${skippedCount} fields (dropdowns, radios, or already configured)`);

        return { success: true, updated: updatedCount, skipped: skippedCount };
    } catch (err: any) {
        console.error('❌ Migration failed:', err);
        return { success: false, error: err.message };
    }
};

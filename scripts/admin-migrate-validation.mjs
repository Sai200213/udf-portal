/**
 * admin-migrate-validation.mjs
 *
 * Admin SDK migration script to apply default validation rules to all
 * "Text Input" and "Dropdown" fields in Firestore form sections.
 *
 * Usage:
 *   node scripts/admin-migrate-validation.mjs
 *
 * Requires FIREBASE_SERVICE_ACCOUNT env variable in .env.local or
 * a local service account JSON file.
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config as dotenvConfig } from 'dotenv';
import { readFileSync } from 'fs';

dotenvConfig({ path: '.env.local' });

// --- Config ---
let serviceAccount;
try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (raw) {
        serviceAccount = JSON.parse(raw);
    } else {
        // Fallback: look for local service account file
        serviceAccount = JSON.parse(readFileSync('./service-account.json', 'utf-8'));
    }
} catch (e) {
    console.error('❌ Could not load service account credentials.', e.message);
    console.error('Set FIREBASE_SERVICE_ACCOUNT env var or place service-account.json in project root.');
    process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// --- Validation Rules to Apply ---
// Maps partial label keywords to validation settings
const LABEL_RULES = [
    {
        match: (label) => /phone|mobile|whatsapp|contact/i.test(label),
        rules: { allowedPattern: 'numbers', minLength: 10, maxLength: 10 }
    },
    {
        match: (label) => /aadhaar|aadhar/i.test(label),
        rules: { allowedPattern: 'numbers', minLength: 12, maxLength: 12 }
    },
    {
        match: (label) => /full name|father.?s name|mother.?s name|spouse/i.test(label),
        rules: { allowedPattern: 'alphabets', minLength: 2, maxLength: 100 }
    },
    {
        match: (label) => /pin code|pincode|postal/i.test(label),
        rules: { allowedPattern: 'numbers', minLength: 6, maxLength: 6 }
    },
];

async function migrateValidations() {
    console.log('🔍 Loading form sections from Firestore...');
    const docRef = db.collection('settings').doc('form_sections');
    const snap = await docRef.get();

    if (!snap.exists) {
        console.error('❌ Document settings/form_sections not found.');
        process.exit(1);
    }

    const sections = snap.data()?.sections || [];
    let updatedCount = 0;

    const updatedSections = sections.map((section) => ({
        ...section,
        fields: (section.fields || []).map((field) => {
            // Only apply to text input and textarea types
            const isTextType = field.type === 'Text Input' || field.type === 'text' || field.type === 'Text Area';
            if (!isTextType) return field;

            const matchedRule = LABEL_RULES.find(rule => rule.match(field.label || ''));
            if (!matchedRule) return field;

            // Don't overwrite if already configured
            if (field.allowedPattern && field.allowedPattern !== 'any') {
                return field;
            }

            updatedCount++;
            console.log(`  ✏️  Updating field: "${field.label}" → pattern: ${matchedRule.rules.allowedPattern}`);
            return { ...field, ...matchedRule.rules };
        })
    }));

    if (updatedCount === 0) {
        console.log('✅ No fields needed updating. All validation rules are already in place.');
        return;
    }

    await docRef.update({ sections: updatedSections });
    console.log(`\n✅ Migration complete! Updated ${updatedCount} field(s) with validation rules.`);
}

migrateValidations().catch((err) => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
});

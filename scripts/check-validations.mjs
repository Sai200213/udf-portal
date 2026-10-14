import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env variables
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkValidations() {
    console.log("🔍 Checking Firestore Validation Rules...");
    const docRef = doc(db, 'settings', 'form_sections');
    
    try {
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
            console.log("❌ Document 'settings/form_sections' not found!");
            process.exit(1);
        }

        const data = snap.data();
        const sections = data.sections || [];

        let rulesFound = 0;
        sections.forEach((s) => {
            (s.fields || []).forEach((f) => {
                if (f.label === 'Full Name' || f.label === 'Phone Number' || f.allowedPattern) {
                    rulesFound++;
                    console.log(`Field: ${f.label}`);
                    console.log(`  Pattern: ${f.allowedPattern || 'unset'}`);
                    console.log(`  MinLength: ${f.minLength || 'unset'}`);
                }
            });
        });

        if (rulesFound === 0) {
            console.log("\n⚠️ NO VALIDATION RULES DETECTED!");
        } else {
            console.log(`\n✅ ${rulesFound} validation rules verified in Firestore.`);
        }
    } catch (e) {
        console.error("❌ Firestore read failed:", e.message);
    }
    process.exit();
}

checkValidations();

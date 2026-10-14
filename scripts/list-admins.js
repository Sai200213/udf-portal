import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

// Simple parser for .env.local
const getEnvVar = (name) => {
    const regex = new RegExp(`^${name}=(.*)$`, 'm');
    const match = envContent.match(regex);
    if (!match) return null;
    let val = match[1].trim();
    if (val.startsWith("'") && val.endsWith("'")) val = val.substring(1, val.length - 1);
    if (val.startsWith('"') && val.endsWith('"')) val = val.substring(1, val.length - 1);
    // Unescape newlines for service account key
    return val.replace(/\\n/g, '\n');
};

const serviceAccountRaw = getEnvVar('FIREBASE_SERVICE_ACCOUNT');
let serviceAccount;
try {
    serviceAccount = JSON.parse(serviceAccountRaw);
} catch (e) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT");
    process.exit(1);
}

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function listAdmins() {
    const collections = ['staff_accounts', 'users', 'staff'];

    for (const collName of collections) {
        console.log(`--- Collection: ${collName} ---`);
        const snapshot = await db.collection(collName).get();

        if (snapshot.empty) {
            console.log(`  (empty)`);
        } else {
            snapshot.forEach(doc => {
                const data = doc.data();
                console.log(`  ID: ${doc.id} | Email: ${data.email || 'N/A'} | Name: ${data.name || data.username || 'N/A'}`);
            });
        }
    }
}

listAdmins()
    .then(() => process.exit(0))
    .catch(err => {
        console.error("List failed:", err);
        process.exit(1);
    });

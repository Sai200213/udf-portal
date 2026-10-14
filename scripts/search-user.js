import admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

let serviceAccount;
try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (raw) {
        serviceAccount = JSON.parse(raw);
    } else {
        // Fallback: look for local service account file
        const saPath = path.resolve(__dirname, '..', 'service-account.json');
        serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf-8'));
    }
} catch (e) {
    console.error('❌ Could not load service account credentials.', e.message);
    process.exit(1);
}

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function searchUser(email) {
    console.log(`Searching for user: ${email}`);

    const collections = ['users', 'staff_accounts', 'staff', 'employees'];

    for (const collName of collections) {
        console.log(`Checking collection: ${collName}`);
        const snapshot = await db.collection(collName).where('email', '==', email).get();

        if (snapshot.empty) {
            console.log(`  No results in ${collName}`);
        } else {
            console.log(`  FOUND in ${collName}:`);
            snapshot.forEach(doc => {
                console.log(`    ID: ${doc.id}`);
                console.log(`    Data:`, JSON.stringify(doc.data(), null, 2));
            });
        }
    }
}

const emailToSearch = process.argv[2];
if (!emailToSearch) {
    console.error("Please provide an email to search.");
    process.exit(1);
}

searchUser(emailToSearch)
    .then(() => process.exit(0))
    .catch(err => {
        console.error("Search failed:", err);
        process.exit(1);
    });

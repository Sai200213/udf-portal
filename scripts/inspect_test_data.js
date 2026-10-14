import admin from '../functions/node_modules/firebase-admin/lib/index.js';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'hr-portal-unique-delta.firebasestorage.app'
  });
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

async function inspect() {
  console.log("==================================================");
  console.log("🔍 SCANNING FIRESTORE COLLECTIONS FOR TEST DATA");
  console.log("==================================================");

  // 1. Onboarding Submissions
  const onbSubSnap = await db.collection('onboarding_submissions').get();
  console.log(`\n📋 'onboarding_submissions': ${onbSubSnap.size} documents found`);
  onbSubSnap.forEach(doc => {
    const d = doc.data();
    console.log(`  - ID: ${doc.id} | Name: ${d.applicantName || 'N/A'} | Status: ${d.status} | EmpID: ${d.employeeId || 'None'} | Date: ${d.timestamp || 'N/A'}`);
  });

  // Legacy submissions collection if any
  const legSubSnap = await db.collection('submissions').get();
  if (legSubSnap.size > 0) {
    console.log(`\n📋 Legacy 'submissions': ${legSubSnap.size} documents found`);
    legSubSnap.forEach(doc => {
      const d = doc.data();
      console.log(`  - ID: ${doc.id} | Name: ${d.applicantName || 'N/A'} | Status: ${d.status}`);
    });
  }

  // 2. Employees collection
  const empSnap = await db.collection('employees').get();
  console.log(`\n👥 'employees': ${empSnap.size} documents found`);
  empSnap.forEach(doc => {
    const d = doc.data();
    console.log(`  - ID: ${doc.id} | EmpID: ${d.employeeId || 'N/A'} | Name: ${d.applicantName || d.name || 'N/A'} | Site: ${d.siteName || d.currentSiteId || 'N/A'} | Status: ${d.profileCompletionStatus || d.profileStatus || 'N/A'}`);
  });

  // 3. Draft submissions
  const draftSnap = await db.collection('draft_submissions').get();
  console.log(`\n📝 'draft_submissions': ${draftSnap.size} documents found`);
  draftSnap.forEach(doc => {
    const d = doc.data();
    console.log(`  - ID: ${doc.id} | Owner: ${d.ownerEmail || d.ownerUid || 'Anonymous'} | Updated: ${d.lastUpdated || 'N/A'}`);
  });

  // 4. Timeline events
  const timelineSnap = await db.collection('timeline_events').get();
  console.log(`\n🕒 'timeline_events': ${timelineSnap.size} documents found`);

  // 5. Correction requests
  const corrSnap = await db.collection('correction_requests').get();
  console.log(`\n🔄 'correction_requests': ${corrSnap.size} documents found`);

  // 6. Firebase Storage
  console.log("\n==================================================");
  console.log("🔍 SCANNING FIREBASE STORAGE FOR UPLOADED FILES");
  console.log("==================================================");

  try {
    const [files] = await bucket.getFiles({ maxResults: 1000 });
    console.log(`Total storage files found: ${files.length}`);
    
    // Group files by top-level folder
    const folderCounts = {};
    files.forEach(file => {
      const prefix = file.name.split('/')[0] || 'root';
      folderCounts[prefix] = (folderCounts[prefix] || 0) + 1;
    });

    console.log("Files by directory:");
    for (const [folder, count] of Object.entries(folderCounts)) {
      console.log(`  📁 ${folder}/: ${count} files`);
    }

    if (files.length > 0 && files.length <= 40) {
      console.log("\nFile list:");
      files.forEach(f => console.log(`  - ${f.name} (${(f.metadata.size / 1024).toFixed(1)} KB)`));
    }
  } catch (err) {
    console.error("Storage scan error:", err.message);
  }

  console.log("\n==================================================");
  console.log("🛡️ PROTECTED COLLECTIONS (WILL NEVER BE TOUCHED):");
  const staffSnap = await db.collection('staff_users').get();
  const rolesSnap = await db.collection('roles').get();
  const sitesSnap = await db.collection('sites').get();
  console.log(`  🔒 'staff_users': ${staffSnap.size} accounts (PRESERVED)`);
  console.log(`  🔒 'roles': ${rolesSnap.size} roles (PRESERVED)`);
  console.log(`  🔒 'sites': ${sitesSnap.size} sites (PRESERVED)`);
  console.log("==================================================");
}

inspect().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});

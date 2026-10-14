import admin from '../functions/node_modules/firebase-admin/lib/index.js';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function check() {
  const email = 'arjosarka56r@gmail.com';
  const uid = 'FgWijMwhsWfMDGpYn5Alpv6tbw02';
  console.log(`Checking email: ${email} and UID: ${uid}`);

  const emps = await db.collection('employees').where('linkedGoogleEmail', '==', email).get();
  console.log(`employees (linkedGoogleEmail): ${emps.size}`);
  emps.forEach(d => console.log('  emp:', d.id, d.data().name || d.data().applicantName, d.data().status));

  const emps2 = await db.collection('employees').where('uid', '==', uid).get();
  console.log(`employees (uid): ${emps2.size}`);
  emps2.forEach(d => console.log('  emp:', d.id, d.data().name || d.data().applicantName, d.data().status));

  const subs = await db.collection('onboarding_submissions').where('linkedGoogleEmail', '==', email).get();
  console.log(`onboarding_submissions (linkedGoogleEmail): ${subs.size}`);
  subs.forEach(d => console.log('  sub:', d.id, d.data().applicantName, d.data().status));

  const subs2 = await db.collection('onboarding_submissions').where('linkedUid', '==', uid).get();
  console.log(`onboarding_submissions (linkedUid): ${subs2.size}`);
  subs2.forEach(d => console.log('  sub:', d.id, d.data().applicantName, d.data().status));

  const users = await db.collection('users').where('email', '==', email).get();
  console.log(`users: ${users.size}`);

  const staff = await db.collection('staff_accounts').where('email', '==', email).get();
  console.log(`staff_accounts: ${staff.size}`);

  const drafts = await db.collection('draft_submissions').where('ownerEmail', '==', email).get();
  console.log(`draft_submissions: ${drafts.size}`);
  drafts.forEach(d => console.log('  draft:', d.id));
}

check().catch(console.error);

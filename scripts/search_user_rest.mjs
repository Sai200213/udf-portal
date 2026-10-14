import https from 'https';

const FIREBASE_PROJECT_ID = 'hr-portal-unique-delta';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

async function fetchFirestore(path_) {
  return new Promise((resolve, reject) => {
    const url = `${FIRESTORE_BASE}/${path_}`;
    https.get(url, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error(`JSON parse error: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

async function run() {
  const email = 'arjosarka56r@gmail.com';
  console.log(`Checking Firestore for email: ${email}`);

  const collections = ['employees', 'onboarding_submissions', 'users', 'staff_accounts'];
  for (const coll of collections) {
    const data = await fetchFirestore(`${coll}?pageSize=50`);
    if (!data.documents) {
      console.log(`Collection ${coll}: 0 documents (or permission denied)`);
      if (data.error) console.log(`  Error:`, data.error.message);
      continue;
    }
    console.log(`Collection ${coll}: ${data.documents.length} docs`);
    for (const d of data.documents) {
      const json = JSON.stringify(d);
      if (json.toLowerCase().includes(email.toLowerCase())) {
        console.log(`  MATCH IN ${coll}:`, d.name);
      }
    }
  }
}

run().catch(console.error);

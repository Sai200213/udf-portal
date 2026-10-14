const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function findEmployee() {
  const snapshot = await db.collection('employees').limit(1).get();
  if (snapshot.empty) {
    console.log('No employees found.');
    return;
  }
  
  const emp = snapshot.docs[0];
  console.log('Employee manually found:');
  console.log('ID:', emp.id);
  console.log('Emp ID:', emp.data().employeeId);
  console.log('Name:', emp.data().profileData?.personalDetails?.fullName);

  // Set the password hash back to 'password' for easy testing
  // The hash for 'password' is:
  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash('password', 10);
  await emp.ref.update({
    passwordHash: hash
  });
  console.log('Password reset to "password".');
  process.exit();
}

findEmployee();

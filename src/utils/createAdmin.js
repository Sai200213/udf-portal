// Quick Admin Setup Script
// Run this file ONCE to create your first admin user
// Usage: node src/utils/createAdmin.js
//
// SECURITY: Email and password MUST be provided as command-line arguments.
// Never hardcode credentials in source files.

import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config.js';

const [,, email, password] = process.argv;

if (!email || !password) {
    console.error('❌ Usage: node src/utils/createAdmin.js <email> <password>');
    console.error('   Example: node src/utils/createAdmin.js admin@yourcompany.com YourSecurePassword123');
    process.exit(1);
}

if (password.length < 8) {
    console.error('❌ Password must be at least 8 characters.');
    process.exit(1);
}

async function createAdminUser() {
    try {
        // Create authentication user
        const userCredential = await createUserWithEmailAndPassword(
            auth,
            email,
            password
        );

        const user = userCredential.user;
        console.log('✅ Firebase Auth user created:', user.uid);

        // Add to 'staff' collection with admin role
        await setDoc(doc(db, 'staff', user.uid), {
            username: email.split('@')[0],
            email: email,
            name: 'Admin User',
            roleId: 'role-hr-manager',
            isDisabled: false
        });

        console.log('✅ Admin user added to Firestore staff collection');
        console.log('\n🎉 Setup complete! You can now login with:');
        console.log(`   Email: ${email}`);
        console.log('   Password: (the password you provided)');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating admin:', error.message);
        process.exit(1);
    }
}

createAdminUser();

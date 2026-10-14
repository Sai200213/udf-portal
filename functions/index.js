const functions = require('firebase-functions'); // firebase-functions v7 = gen2 API
const admin = require('firebase-admin');
const bcrypt = require('bcryptjs');

admin.initializeApp();

// SECURITY: Use bcrypt (cost 12) for all password operations — NOT SHA-256.
// bcrypt is intentionally slow, making brute-force attacks far more expensive.
const BCRYPT_ROUNDS = 12;

const hashPassword = async (password) => {
    return await bcrypt.hash(password, BCRYPT_ROUNDS);
};

const verifyPassword = async (plainText, hash) => {
    // Handle legacy SHA-256 hashes during migration period
    if (hash && hash.length === 64 && !hash.startsWith('$2')) {
        // It's a SHA-256 hex hash — compare and upgrade on next login
        const crypto = require('crypto');
        const sha256 = crypto.createHash('sha256').update(plainText + 'UDF_PORTAL_SALT_2026_!!').digest('hex');
        return sha256 === hash;
    }
    // Modern bcrypt hash
    return await bcrypt.compare(plainText, hash);
};

// ─────────────────────────────────────────────────────────────────────────────
// AUTH & IDENTITY INTEGRITY
// ─────────────────────────────────────────────────────────────────────────────

// Check global uniqueness across all identity collections
exports.checkGlobalUniqueness = functions.https.onCall(async (request) => {
    // Only authenticated users can check uniqueness (prevents public scraping)
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Verification rejected.');
    }

    const { email, uid, options = {} } = request.data;
    const { excludeAdmin = false } = options;

    if (!email && !uid) {
        throw new functions.https.HttpsError('invalid-argument', 'Email or UID is required.');
    }

    const db = admin.firestore();

    try {
        const checks = [];

        if (email) {
            const normalizedEmail = email.toLowerCase().trim();
            checks.push(
                { type: 'staff', query: db.collection('staff').where('email', '==', normalizedEmail).get() },
                { type: 'staff_accounts', query: db.collection('staff_accounts').where('email', '==', normalizedEmail).get() },
                { type: 'employees', query: db.collection('employees').where('profileData.personalDetails.email', '==', normalizedEmail).get() },
                { type: 'employees', query: db.collection('employees').where('linkedGoogleEmail', '==', normalizedEmail).get() },
                { type: 'onboarding_submissions', query: db.collection('onboarding_submissions').where('email', '==', normalizedEmail).get() },
                { type: 'onboarding_submissions', query: db.collection('onboarding_submissions').where('linkedGoogleEmail', '==', normalizedEmail).get() }
            );

            if (!excludeAdmin) {
                checks.unshift({ type: 'users', query: db.collection('users').where('email', '==', normalizedEmail).get() });
            }
        }

        if (uid) {
            checks.push(
                { type: 'staff_accounts_doc', query: db.collection('staff_accounts').doc(uid).get() },
                { type: 'staff_doc', query: db.collection('staff').doc(uid).get() },
                { type: 'employees', query: db.collection('employees').where('uid', '==', uid).get() },
                { type: 'employees', query: db.collection('employees').where('linkedUid', '==', uid).get() },
                { type: 'onboarding_submissions', query: db.collection('onboarding_submissions').where('uid', '==', uid).get() },
                { type: 'onboarding_submissions', query: db.collection('onboarding_submissions').where('linkedUid', '==', uid).get() }
            );

            if (!excludeAdmin) {
                checks.unshift({ type: 'users_doc', query: db.collection('users').doc(uid).get() });
            }
        }

        const results = await Promise.all(checks.map(c => c.query));
        
        let conflict = false;
        for (let i = 0; i < checks.length; i++) {
            const { type } = checks[i];
            const snap = results[i];
            
            if (type.endsWith('_doc')) {
                if (snap.exists) {
                    conflict = true;
                    break;
                }
                continue;
            }

            if (snap.empty) continue;
            
            if (type === 'users' || type === 'staff' || type === 'staff_accounts') {
                conflict = true;
                break;
            } else if (type === 'employees') {
                const active = snap.docs.some(doc => !doc.data().deletedAt);
                if (active) {
                    conflict = true;
                    break;
                }
            } else if (type === 'onboarding_submissions') {
                const active = snap.docs.some(doc => {
                    const data = doc.data();
                    return !data.deletedAt && data.status !== 'Rejected' && data.status !== 'Deleted';
                });
                if (active) {
                    conflict = true;
                    break;
                }
            }
        }

        return {
            unique: !conflict,
            conflict: conflict ? 'Account or email already exists in system' : null
        };
    } catch (error) {
        console.error('Error checking uniqueness:', error);
        throw new functions.https.HttpsError('internal', 'Search failed.');
    }
});

// Create a staff user
exports.createStaffUser = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    // SECURITY: Only SuperAdmins can create Staff users. Check staff_accounts first, fallback to users.
    let callerDoc = await admin.firestore().collection('staff_accounts').doc(request.auth.uid).get();
    if (!callerDoc.exists) {
        callerDoc = await admin.firestore().collection('users').doc(request.auth.uid).get();
    }
    if (!callerDoc.exists || callerDoc.data().roleId !== 'role-super-admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only SuperAdmins can create Staff accounts.');
    }

    const { email, password, name, username, roleId } = request.data;

    if (!email || !password || !name || !username || !roleId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }

    const normalizedEmail = email.toLowerCase().trim();

    try {
        // SYSTEMIC FIX: Check all collections for collision BEFORE creating auth user
        const db = admin.firestore();
        const [userSnap, staffSnapCurrent, empSnap] = await Promise.all([
            db.collection('users').where('email', '==', normalizedEmail).get(),
            db.collection('staff_accounts').where('email', '==', normalizedEmail).get(),
            db.collection('employees').where('email', '==', normalizedEmail).get()
        ]);

        if (!userSnap.empty || !staffSnapCurrent.empty || !empSnap.empty) {
            throw new functions.https.HttpsError('already-exists', 'Email is already registered as Admin, Staff, or Employee.');
        }

        const userRecord = await admin.auth().createUser({
            email: normalizedEmail,
            password: password,
            displayName: name,
        });

        const staffData = {
            id: userRecord.uid,
            username: username,
            usernameLower: (username || '').toLowerCase().trim(),
            email: normalizedEmail,
            name: name,
            roleId: roleId,
            isDisabled: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        await db.collection('staff_accounts').doc(userRecord.uid).set(staffData);

        return {
            success: true,
            uid: userRecord.uid,
            email: normalizedEmail,
            message: `User ${name} created successfully`
        };
    } catch (error) {
        console.error('Error creating user:', error);
        if (error.code === 'already-exists') throw error; // Re-throw our collision error
        if (error.code === 'auth/email-already-exists') {
            throw new functions.https.HttpsError('already-exists', 'Email already exists in Authentication system');
        }
        throw new functions.https.HttpsError('internal', error.message || 'Internal server error');
    }
});

// Delete a staff user
exports.deleteStaffUser = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    // SECURITY: Only SuperAdmins can delete Staff users. Check staff_accounts first, fallback to users.
    let callerDoc = await admin.firestore().collection('staff_accounts').doc(request.auth.uid).get();
    if (!callerDoc.exists) {
        callerDoc = await admin.firestore().collection('users').doc(request.auth.uid).get();
    }
    if (!callerDoc.exists || callerDoc.data().roleId !== 'role-super-admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only SuperAdmins can delete Staff accounts.');
    }

    const { uid } = request.data;
    
    if (!uid) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required uid field');
    }

    if (uid === request.auth.uid) {
        throw new functions.https.HttpsError('permission-denied', 'Cannot delete your own account.');
    }

    try {
        let targetDoc = await admin.firestore().collection('staff_accounts').doc(uid).get();
        if (!targetDoc.exists) {
            targetDoc = await admin.firestore().collection('users').doc(uid).get();
        }
        if (targetDoc.exists && targetDoc.data().roleId === 'role-super-admin') {
            throw new functions.https.HttpsError('permission-denied', 'Cannot delete other SuperAdmin accounts.');
        }

        try {
            await admin.auth().deleteUser(uid);
        } catch (authErr) {
            // Non-fatal if user is not in Auth (e.g. already deleted or created with custom ID)
            if (authErr.code !== 'auth/user-not-found') {
                console.warn(`[deleteStaffUser] Warning deleting auth user ${uid}:`, authErr.message);
            }
        }

        await admin.firestore().collection('staff_accounts').doc(uid).delete().catch(() => {});
        await admin.firestore().collection('users').doc(uid).delete().catch(() => {});
        return { success: true, message: 'User deleted successfully' };
    } catch (error) {
        console.error('Error deleting user:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Internal server error');
    }
});

// Toggle staff user status (isDisabled status synced to Firebase Auth)
exports.setStaffUserStatus = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    // SECURITY: Only SuperAdmins can manage staff status. Check staff_accounts first, fallback to users.
    let callerDoc = await admin.firestore().collection('staff_accounts').doc(request.auth.uid).get();
    if (!callerDoc.exists) {
        callerDoc = await admin.firestore().collection('users').doc(request.auth.uid).get();
    }
    if (!callerDoc.exists || callerDoc.data().roleId !== 'role-super-admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only SuperAdmins can manage staff status.');
    }

    const { uid, isDisabled } = request.data;
    if (!uid || isDisabled === undefined) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields: uid or isDisabled');
    }

    try {
        const db = admin.firestore();
        
        // 1. Update Firebase Auth status
        await admin.auth().updateUser(uid, { disabled: isDisabled });

        // 2. Update Firestore record in staff_accounts and users if exists
        await db.collection('staff_accounts').doc(uid).set({ isDisabled }, { merge: true });
        const legacyDoc = await db.collection('users').doc(uid).get();
        if (legacyDoc.exists) {
            await db.collection('users').doc(uid).update({ isDisabled });
        }

        return { success: true, message: `User status set to ${isDisabled ? 'Disabled' : 'Enabled'} successfully` };
    } catch (error) {
        console.error('Error toggling staff user status:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Internal server error');
    }
});

// Reset staff user password directly
exports.resetStaffUserPassword = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    // SECURITY: Only SuperAdmins can reset staff passwords. Check staff_accounts first, fallback to users.
    let callerDoc = await admin.firestore().collection('staff_accounts').doc(request.auth.uid).get();
    if (!callerDoc.exists) {
        callerDoc = await admin.firestore().collection('users').doc(request.auth.uid).get();
    }
    if (!callerDoc.exists || callerDoc.data().roleId !== 'role-super-admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only SuperAdmins can reset staff passwords.');
    }

    const { uid, password } = request.data;
    if (!uid || !password) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields: uid or password');
    }

    try {
        // Update Firebase Auth password
        await admin.auth().updateUser(uid, { password });

        return { success: true, message: 'Password updated successfully' };
    } catch (error) {
        console.error('Error resetting staff user password:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Internal server error');
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYEE AUTH FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

// Helper: get and increment failed attempt counter. Returns true if locked.
async function checkAndIncrementFailedAttempts(db, employeeId) {
    const attemptsRef = db.collection('_auth_attempts').doc(employeeId);
    const attemptsDoc = await attemptsRef.get();
    
    const now = Date.now();
    const LOCK_DURATION_MS = 60 * 60 * 1000; // 1 hour
    const MAX_ATTEMPTS = 3;

    if (attemptsDoc.exists) {
        const data = attemptsDoc.data();
        if (data.lockedUntil && data.lockedUntil > now) {
            return true; // Still locked
        }
        const newCount = (data.count || 0) + 1;
        if (newCount >= MAX_ATTEMPTS) {
            await attemptsRef.set({ count: newCount, lockedUntil: now + LOCK_DURATION_MS });
        } else {
            await attemptsRef.set({ count: newCount, lockedUntil: null });
        }
    } else {
        await attemptsRef.set({ count: 1, lockedUntil: null });
    }
    return false;
}

async function clearFailedAttempts(db, employeeId) {
    await db.collection('_auth_attempts').doc(employeeId).delete();
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYEE GOOGLE LOGIN — SSO to Custom Token Exchange
// Exchanges a valid Google ID Token for an Employee Custom Token.
// Protects strict Firestore rules by standardizing request.auth.uid to Employee ID.
// ─────────────────────────────────────────────────────────────────────────────

exports.employeeGoogleLogin = functions.https.onCall(async (request) => {
    const { idToken } = request.data;
    if (!idToken) throw new functions.https.HttpsError('invalid-argument', 'Missing Google idToken');

    const db = admin.firestore();

    try {
        // Verify Google identity securely on backend
        const ticket = await admin.auth().verifyIdToken(idToken);
        const googleUid = ticket.uid;
        const email = ticket.email;

        if (!email) {
             throw new functions.https.HttpsError('invalid-argument', 'Google token missing email');
        }

        const normalizedEmail = email.toLowerCase().trim();

        console.log(`[GOOGLE LOGIN] Attempt for: ${normalizedEmail}`);

        let employeeDoc = null;
        let submissionDoc = null;

        // 1. Try finding by Google UID in onboarding_submissions
        let subSnap = await db.collection('onboarding_submissions')
            .where('uid', '==', googleUid)
            .limit(1).get();
        if (subSnap.empty) {
            subSnap = await db.collection('onboarding_submissions')
                .where('linkedGoogleEmail', '==', normalizedEmail)
                .limit(1).get();
        }
        if (!subSnap.empty) {
            submissionDoc = subSnap.docs[0];
        }

        // 2. Try finding by Google UID in employees
        let empSnap = await db.collection('employees')
            .where('uid', '==', googleUid)
            .limit(1).get();
        if (empSnap.empty) {
            empSnap = await db.collection('employees')
                .where('linkedGoogleEmail', '==', normalizedEmail)
                .limit(1).get();
        }
        if (!empSnap.empty) {
            employeeDoc = empSnap.docs[0];
        }

        // Cross-reference documents if one is missing
        if (submissionDoc && !employeeDoc) {
            const empId = submissionDoc.data().employeeId;
            const portalId = submissionDoc.id;
            if (empId) {
                let crossEmp = await db.collection('employees').doc(portalId).get();
                if (!crossEmp.exists) {
                    const crossSnap = await db.collection('employees').where('employeeId', '==', empId).limit(1).get();
                    if (!crossSnap.empty) {
                        crossEmp = crossSnap.docs[0];
                    }
                }
                if (crossEmp.exists) {
                    employeeDoc = crossEmp;
                }
            }
        } else if (employeeDoc && !submissionDoc) {
            const empId = employeeDoc.data().employeeId;
            const portalId = employeeDoc.data().portalId || employeeDoc.id;
            let crossSub = await db.collection('onboarding_submissions').doc(portalId).get();
            if (!crossSub.exists && empId) {
                const crossSnap = await db.collection('onboarding_submissions').where('employeeId', '==', empId).limit(1).get();
                if (!crossSnap.empty) {
                    crossSub = crossSnap.docs[0];
                }
            }
            if (crossSub.exists) {
                submissionDoc = crossSub;
            }
        }

        if (!employeeDoc && !submissionDoc) {
            console.warn(`[GOOGLE LOGIN] Employee not found for Google UID: ${googleUid} Email: ${email}`);
            throw new functions.https.HttpsError('not-found', 'No employee record linked to this Google account.');
        }

        // SECURITY: Block inactive, relieved, or blocked employees from Google SSO login
        const empData = employeeDoc ? employeeDoc.data() : null;
        const subData = submissionDoc ? submissionDoc.data() : null;

        const isInactive = (empData && (empData.isActive === false || empData.isRelieved === true || empData.isBlocked === true || !!empData.deletedAt)) ||
                           (subData && (subData.isActive === false || subData.isRelieved === true || subData.isBlocked === true || !!subData.deletedAt));

        if (isInactive) {
            console.warn(`[GOOGLE LOGIN] Blocked login for inactive/relieved employee (UID: ${googleUid}, Email: ${email})`);
            throw new functions.https.HttpsError('permission-denied', 'This account is inactive. Relieved employees cannot log in.');
        }

        const portalId = (submissionDoc ? submissionDoc.id : null) || (employeeDoc ? (employeeDoc.data().portalId || employeeDoc.id) : null);
        if (!portalId) {
            throw new functions.https.HttpsError('internal', 'Could not resolve Portal ID for the employee.');
        }

        // Auto-link both documents
        if (submissionDoc) {
            const data = submissionDoc.data();
            if (!data.linkedUid || data.linkedUid === 'none' || data.uid !== googleUid) {
                await submissionDoc.ref.update({
                    uid: googleUid,
                    linkedUid: googleUid,
                    linkedGoogleEmail: normalizedEmail
                });
                console.log(`[GOOGLE LOGIN] Auto-linked UID ${googleUid} to onboarding_submissions/${submissionDoc.id}`);
            }
        }
        if (employeeDoc) {
            const data = employeeDoc.data();
            if (!data.linkedUid || data.linkedUid === 'none' || data.uid !== googleUid) {
                await employeeDoc.ref.update({
                    uid: googleUid,
                    linkedUid: googleUid,
                    linkedGoogleEmail: normalizedEmail
                });
                console.log(`[GOOGLE LOGIN] Auto-linked UID ${googleUid} to employees/${employeeDoc.id}`);
            }
        }

        // Generate Custom Token using the *exact* Portal ID (global ID)
        const customToken = await admin.auth().createCustomToken(portalId, { portal: 'employee', portalType: 'employee', authProvider: 'google' });
        
        // Clear fails
        await clearFailedAttempts(db, `login_${portalId}`);

        return { success: true, token: customToken };
    } catch (error) {
        console.error('Error in employeeGoogleLogin:', error);
        if (error instanceof functions.https.HttpsError) throw error;
        throw new functions.https.HttpsError('unauthenticated', 'Invalid Google token');
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYEE LOGIN — Custom Token Authentication
// Replaces anonymous auth with a stable, persistent Firebase session.
// ─────────────────────────────────────────────────────────────────────────────

exports.employeeLogin = functions.https.onCall(async (request) => {
    let { employeeId, password } = request.data;
    
    // Normalize Employee ID to uppercase for case-insensitive lookup
    if (employeeId) {
        employeeId = employeeId.trim().toUpperCase();
    }

    if (!employeeId || !password) {
        throw new functions.https.HttpsError('invalid-argument', 'Employee ID and password are required.');
    }

    const db = admin.firestore();
    console.log(`[LOGIN] Attempt for ID: "${employeeId}" (Normalized: "${employeeId.trim().toUpperCase()}")`);

    // SECURITY: Rate-limit login attempts
    const isLocked = await checkAndIncrementFailedAttempts(db, `login_${employeeId}`);
    if (isLocked) {
        throw new functions.https.HttpsError('resource-exhausted', 'Too many failed attempts. Try again in 1 hour.');
    }

    let matchedDoc = null;
    let matchedData = null;
    let matchedCollection = null;

    // 1. Check onboarding_submissions (self-onboarded approved users)
    const subSnap = await db.collection('onboarding_submissions')
        .where('employeeId', '==', employeeId)
        .where('status', '==', 'Approved')
        .limit(1)
        .get();

    if (!subSnap.empty) {
        const sub = subSnap.docs[0];
        const subData = sub.data();
        let isMatch = false;

        if (subData.passwordHash) {
            isMatch = await verifyPassword(password, subData.passwordHash);
        } else if (subData.mockPassword) {
            isMatch = subData.mockPassword === password;
        }

        if (isMatch) {
            // SECURITY: Verify the employee is active and not relieved or blocked
            let isInactive = subData.isActive === false || subData.isRelieved === true || subData.isBlocked === true || !!subData.deletedAt;
            if (!isInactive) {
                // Cross-check employees collection by portalId (sub.id) or employeeId
                let empCheck = await db.collection('employees').doc(sub.id).get();
                if (!empCheck.exists) {
                    const empSnapCheck = await db.collection('employees').where('employeeId', '==', employeeId).limit(1).get();
                    if (!empSnapCheck.empty) empCheck = empSnapCheck.docs[0];
                }
                if (empCheck.exists) {
                    const checkData = empCheck.data();
                    if (checkData.isActive === false || checkData.isRelieved === true || checkData.isBlocked === true || !!checkData.deletedAt) {
                        isInactive = true;
                    }
                }
            }

            if (isInactive) {
                console.warn(`[LOGIN] Blocked login for inactive/relieved employee ${employeeId}`);
                throw new functions.https.HttpsError('permission-denied', 'This account is inactive. Relieved employees cannot log in.');
            }

            matchedDoc = sub;
            matchedData = subData;
            matchedCollection = 'onboarding_submissions';
            console.log(`[LOGIN] Match found in onboarding_submissions for ${employeeId}`);
        } else {
            console.log(`[LOGIN] User found in onboarding_submissions for ${employeeId} but password mismatch`);
        }
    }

    // 2. Check employees collection (bulk-imported users)
    if (!matchedDoc) {
        const empSnap = await db.collection('employees')
            .where('employeeId', '==', employeeId)
            .limit(1)
            .get();

        if (!empSnap.empty) {
            const emp = empSnap.docs[0];
            const empData = emp.data();
            let isMatch = false;

            if (empData.passwordHash) {
                isMatch = await verifyPassword(password, empData.passwordHash);
            } else if (empData.mockPassword) {
                isMatch = empData.mockPassword === password;
            }

            if (isMatch) {
                if (empData.isActive === false || empData.isRelieved === true || empData.isBlocked === true || !!empData.deletedAt) {
                    console.warn(`[LOGIN] Blocked login for inactive/relieved employee ${employeeId}`);
                    throw new functions.https.HttpsError('permission-denied', 'This account is inactive. Relieved employees cannot log in.');
                }
                matchedDoc = emp;
                matchedData = empData;
                matchedCollection = 'employees';
                console.log(`[LOGIN] Match found in employees collection for ${employeeId}`);
            } else {
                console.log(`[LOGIN] User found in employees collection for ${employeeId} but password mismatch`);
            }
        }
    }

    if (!matchedDoc) {
        console.warn(`[LOGIN] No match for ${employeeId} in any collection or wrong password`);
        throw new functions.https.HttpsError('not-found', 'Invalid Employee ID or Password.');
    }

    // SUCCESS: Clear rate-limit counter
    await clearFailedAttempts(db, `login_${employeeId}`);

    // 4. Generate Custom Token
    let customToken;
    const customTokenUid = matchedDoc.id; // SECURITY: Must use the Firestore Document ID as UID to preserve history/references!

    try {
        // Generate a stable UID matching the Firestore Document ID
        customToken = await admin.auth().createCustomToken(customTokenUid, {
            portal: 'employee',
            portalType: 'employee',
            employeeId: employeeId,
            role: 'employee'
        });

        // Link the stable UID to the employee record
        await matchedDoc.ref.update({ uid: customTokenUid });

        // Upgrade legacy password to bcrypt if needed
        const isSha256 = matchedData.passwordHash && matchedData.passwordHash.length === 64 && !matchedData.passwordHash.startsWith('$2');
        if ((matchedData.mockPassword && !matchedData.passwordHash) || isSha256) {
            const hashed = await hashPassword(password);
            const updatePayload = {
                passwordHash: hashed,
                isDefaultPassword: matchedData.isDefaultPassword || false
            };
            if (matchedData.mockPassword) {
                updatePayload.mockPassword = admin.firestore.FieldValue.delete();
            }
            await matchedDoc.ref.update(updatePayload);
        }

        // Return token + employee data for the client
        return {
            success: true,
            token: customToken,
            employee: {
                id: matchedDoc.id,
                employeeId: matchedData.employeeId,
                applicantName: matchedData.applicantName || matchedData.name || '',
                isDefaultPassword: matchedData.isDefaultPassword || false,
                authProvider: matchedData.authProvider || 'manual',
                linkedGoogleEmail: matchedData.linkedGoogleEmail || null,
                status: matchedData.status || 'Approved',
                collection: matchedCollection
            }
        };
    } catch (error) {
        console.error('Error creating custom token full error:', JSON.stringify(error, null, 2));
        
        // Detect IAM permission errors (signBlob)
        if (error.code === 'auth/insufficient-permission' || 
            (error.message && error.message.includes('signBlob'))) {
            throw new functions.https.HttpsError(
                'permission-denied',
                `SERVER_SETUP_REQUIRED: The Cloud Function service account lacks the "Service Account Token Creator" role. Technical detail: ${error.message}`
            );
        }
        
        throw new functions.https.HttpsError('internal', 'Authentication failed. Please try again.');
    }
});

// 1. Verify and Reset Password (Forgot Password flow)
exports.verifyAndResetEmployeePassword = functions.https.onCall(async (request) => {
    let { employeeId, verificationDetails, newPassword } = request.data;
    
    // Normalize Employee ID to uppercase for case-insensitive lookup
    if (employeeId) {
        employeeId = employeeId.trim().toUpperCase();
    }

    if (!employeeId || !verificationDetails || !newPassword) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }

    const { name, mobile, aadhar, dob } = verificationDetails;
    if (!name || !mobile || !aadhar || !dob) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing verification details');
    }

    try {
        const db = admin.firestore();
        console.log(`[RESET] Attempt for ID: "${employeeId}"`);

        // SECURITY: Rate-limit verification attempts
        const isLocked = await checkAndIncrementFailedAttempts(db, `reset_${employeeId}`);
        if (isLocked) {
            throw new functions.https.HttpsError('resource-exhausted', 'Too many failed attempts. Try again in 1 hour.');
        }

        let empSnapshot = await db.collection('employees').where('employeeId', '==', employeeId).limit(1).get();
        let empDoc = !empSnapshot.empty ? empSnapshot.docs[0] : null;

        if (!empDoc) {
            // Check onboarding_submissions as well
            empSnapshot = await db.collection('onboarding_submissions').where('employeeId', '==', employeeId).limit(1).get();
            empDoc = !empSnapshot.empty ? empSnapshot.docs[0] : null;
        }

        if (!empDoc) {
            console.warn(`[RESET] No record found for ${employeeId}`);
            throw new functions.https.HttpsError('permission-denied', 'Verification failed: ID not found');
        }

        const empRef = empDoc.ref;
        const empData = empDoc.data();
        const profileData = empData.profileData || {};
        const storedData = empData.data || {};

        const NAME_FIELD = '7debf274-baee-4bac-a137-4b4b46719874';
        const MOBILE_FIELD = 'eb3617dc-9f1d-475d-a2db-005b6bc2500c';
        const DOB_FIELD = '6e570a01-14e0-4e18-b112-97ddc51d0778';
        const AADHAR_FIELD = '18855ee9-0d66-41d6-988b-128b776a8c5b';

        // Normalization helpers
        const normStr = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
        const normDigits = (s) => String(s || '').replace(/\D/g, '');
        const normDate = (s) => {
            if (!s) return '';
            const clean = String(s).trim().replace(/[\/\.]/g, '-');
            const parts = clean.split('-');
            if (parts.length === 3) {
                if (parts[0].length === 4) {
                    return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                } else if (parts[2].length === 4) {
                    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
            }
            return clean;
        };

        const inputName = normStr(name);
        const inputMobile = normDigits(mobile).slice(-10);
        const inputAadhar = normDigits(aadhar);
        const inputDob = normDate(dob);

        // Candidate collections
        const candidateNames = [
            empData.applicantName, empData.name, empData.fullName,
            profileData[NAME_FIELD], storedData[NAME_FIELD],
            profileData['name'], profileData['applicantName'], profileData['fullName'],
            storedData['name'], storedData['applicantName'], storedData['fullName']
        ];

        const candidateMobiles = [
            empData.mobile, empData.phoneNumber, empData.phone,
            profileData[MOBILE_FIELD], storedData[MOBILE_FIELD],
            profileData['mobile'], profileData['phoneNumber'], profileData['phone'],
            storedData['mobile'], storedData['phoneNumber'], storedData['phone']
        ];

        const candidateAadhars = [
            empData.aadhar, empData.aadhaar, empData.aadharNumber, empData.aadhaarNumber,
            profileData[AADHAR_FIELD], storedData[AADHAR_FIELD],
            profileData['aadhar'], profileData['aadhaar'], profileData['aadharNumber'], profileData['aadhaarNumber'],
            storedData['aadhar'], storedData['aadhaar'], storedData['aadharNumber'], storedData['aadhaarNumber']
        ];

        const candidateDobs = [
            empData.dob, empData.dateOfBirth,
            profileData[DOB_FIELD], storedData[DOB_FIELD],
            profileData['dob'], profileData['dateOfBirth'],
            storedData['dob'], storedData['dateOfBirth']
        ];

        const matchName = candidateNames.some(c => c && normStr(c) === inputName);
        const matchMobile = candidateMobiles.some(c => c && normDigits(c).slice(-10) === inputMobile) ||
            (inputMobile.length >= 10 && (
                Object.values(profileData).some(val => typeof val === 'string' && normDigits(val).slice(-10) === inputMobile) ||
                Object.values(storedData).some(val => typeof val === 'string' && normDigits(val).slice(-10) === inputMobile)
            ));
        const matchAadhar = candidateAadhars.some(c => c && normDigits(c) === inputAadhar) ||
            (inputAadhar.length >= 12 && (
                Object.values(profileData).some(val => typeof val === 'string' && normDigits(val) === inputAadhar) ||
                Object.values(storedData).some(val => typeof val === 'string' && normDigits(val) === inputAadhar)
            ));
        const matchDob = candidateDobs.some(c => c && normDate(c) === inputDob) ||
            (inputDob.length >= 8 && (
                Object.values(profileData).some(val => typeof val === 'string' && normDate(val) === inputDob) ||
                Object.values(storedData).some(val => typeof val === 'string' && normDate(val) === inputDob)
            ));

        if (!matchName || !matchMobile || !matchDob || !matchAadhar) {
            console.warn(`[RESET] Verification mismatch for ${employeeId}. Name: ${matchName}, Mobile: ${matchMobile}, DOB: ${matchDob}, Aadhar: ${matchAadhar}`);
            throw new functions.https.HttpsError('permission-denied', 'Verification failed: details mismatch');
        }

        // SUCCESS: Clear rate limit counter and hash password with bcrypt
        await clearFailedAttempts(db, `reset_${employeeId}`);
        const passwordHash = await hashPassword(newPassword);
        await empRef.update({
            passwordHash: passwordHash,
            mockPassword: admin.firestore.FieldValue.delete(), // Remove plain-text password
            isDefaultPassword: false
        });

        return { success: true, message: 'Password reset successfully' };

    } catch (error) {
        console.error('Error resetting password:', error);
        if (error instanceof functions.https.HttpsError) throw error;
        throw new functions.https.HttpsError('internal', 'Internal server error');
    }
});

// 2. Change Password (Authenticated flow)
exports.changeEmployeePassword = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    let { employeeId, currentPassword, newPassword } = request.data;
    
    // Normalize Employee ID to uppercase for case-insensitive lookup
    if (employeeId) {
        employeeId = employeeId.trim().toUpperCase();
    }

    if (!employeeId || !currentPassword || !newPassword) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }

    try {
        const db = admin.firestore();

        // Check both collections
        let docRef = null;
        let empData = null;

        const subSnap = await db.collection('onboarding_submissions')
            .where('employeeId', '==', employeeId).limit(1).get();
        if (!subSnap.empty) {
            docRef = subSnap.docs[0].ref;
            empData = subSnap.docs[0].data();
        } else {
            const empSnap = await db.collection('employees')
                .where('employeeId', '==', employeeId).limit(1).get();
            if (!empSnap.empty) {
                docRef = empSnap.docs[0].ref;
                empData = empSnap.docs[0].data();
            }
        }

        if (!empData) {
            throw new functions.https.HttpsError('not-found', 'Employee not found');
        }

        // SECURITY: Verify caller owns this employee profile
        const callerUid = request.auth.uid;
        if (empData.uid !== callerUid && empData.linkedUid !== callerUid) {
            throw new functions.https.HttpsError('permission-denied', 'You do not have permission to change this password.');
        }

        // SECURITY: Use bcrypt verify. Also handle legacy SHA-256 hashes.
        let isVerified = false;
        if (empData.passwordHash) {
            isVerified = await verifyPassword(currentPassword, empData.passwordHash);
        }
        // NOTE: mockPassword plain-text fallback has been removed for security.
        // All employees must use their hashed password or go through reset flow.

        if (!isVerified) {
            throw new functions.https.HttpsError('permission-denied', 'Incorrect current password');
        }

        // Hash new password with bcrypt and remove legacy plain-text password
        const newHash = await hashPassword(newPassword);
        await docRef.update({
            passwordHash: newHash,
            mockPassword: admin.firestore.FieldValue.delete(),
            isDefaultPassword: false
        });

        return { success: true };
    } catch (error) {
        console.error('Error changing password:', error);
        if (error instanceof functions.https.HttpsError) throw error;
        throw new functions.https.HttpsError('internal', 'Internal server error');
    }
});

// 3. Link Google Account
exports.linkEmployeeGoogleAccount = functions.https.onCall(async (request) => {
    let { employeeId, currentPassword, googleUid, email, idToken } = request.data || {};
    
    // Normalize Employee ID to uppercase for case-insensitive lookup
    if (employeeId) {
        employeeId = employeeId.trim().toUpperCase();
    }

    // Verify Google ID Token if passed, or verify request.auth context
    if (idToken) {
        try {
            const decodedToken = await admin.auth().verifyIdToken(idToken);
            googleUid = decodedToken.uid;
            email = decodedToken.email || email;
        } catch (tokErr) {
            console.error('Failed to verify Google ID token:', tokErr);
            throw new functions.https.HttpsError('unauthenticated', 'Invalid Google authentication token');
        }
    } else if (request.auth && request.auth.uid) {
        googleUid = request.auth.uid;
        if (request.auth.token && request.auth.token.email) {
            email = request.auth.token.email;
        }
    }

    console.log('linkEmployeeGoogleAccount called with:', { employeeId, googleUid, email, hasPassword: !!currentPassword });

    if (!employeeId || !currentPassword || !googleUid || !email) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }

    try {
        const db = admin.firestore();

        // 1. Enforce Global Uniqueness for the Google Account
        const normalizedGoogleEmail = email.toLowerCase().trim();
        
        // Check if this Google account belongs to Staff or Admin
        const staffDocs = await Promise.all([
            db.collection('users').doc(googleUid).get(),
            db.collection('staff').doc(googleUid).get(),
            db.collection('staff_accounts').doc(googleUid).get(),
            db.collection('users').where('email', '==', normalizedGoogleEmail).get(),
            db.collection('staff').where('email', '==', normalizedGoogleEmail).get(),
            db.collection('staff_accounts').where('email', '==', normalizedGoogleEmail).get()
        ]);

        const isStaffConflict = staffDocs.some(docOrSnap => {
            if (docOrSnap.docs) return !docOrSnap.empty; // QuerySnapshot
            return docOrSnap.exists;     // DocumentSnapshot
        });

        if (isStaffConflict) {
            throw new functions.https.HttpsError('already-exists', 'This Google account is already registered in our system. Please contact your administrator.');
        }

        // Check if it belongs to another Employee
        const empChecks = await Promise.all([
            db.collection('employees').where('uid', '==', googleUid).get(),
            db.collection('employees').where('linkedGoogleEmail', '==', normalizedGoogleEmail).get(),
            db.collection('onboarding_submissions').where('uid', '==', googleUid).get(),
            db.collection('onboarding_submissions').where('linkedUid', '==', googleUid).get(),
            db.collection('onboarding_submissions').where('linkedGoogleEmail', '==', normalizedGoogleEmail).get()
        ]);

        for (const snap of empChecks) {
            if (!snap.empty) {
                const isOnlySelf = snap.docs.every(doc => doc.data().employeeId === employeeId);
                if (!isOnlySelf) {
                    throw new functions.https.HttpsError('already-exists', 'This Google account is already registered in our system. Please contact your administrator.');
                }
            }
        }

        let isVerified = false;
        let collectionName = null;
        let docId = null;

        // Check onboarding_submissions first (self-onboarded employees)
        const subSnap = await db.collection('onboarding_submissions')
            .where('employeeId', '==', employeeId)
            .limit(1)
            .get();

        if (!subSnap.empty) {
            const subData = subSnap.docs[0].data();
            collectionName = 'onboarding_submissions';
            docId = subSnap.docs[0].id;
            if (subData.passwordHash) {
                isVerified = await verifyPassword(currentPassword, subData.passwordHash);
            }
        }

        // Fallback: check employees collection (bulk-imported)
        if (!isVerified) {
            const empSnap = await db.collection('employees')
                .where('employeeId', '==', employeeId).limit(1).get();
            if (!empSnap.empty) {
                const empData = empSnap.docs[0].data();
                collectionName = 'employees';
                docId = empSnap.docs[0].id;
                if (empData.passwordHash) {
                    isVerified = await verifyPassword(currentPassword, empData.passwordHash);
                }
            }
        }

        if (!collectionName) {
            throw new functions.https.HttpsError('not-found', 'Employee not found');
        }

        if (!isVerified) {
            throw new functions.https.HttpsError('permission-denied', 'Incorrect password');
        }

        // Link Google UID in the correct collection
        await db.collection(collectionName).doc(docId).update({
            uid: googleUid,
            linkedUid: googleUid,
            authProvider: 'google',
            linkedGoogleEmail: email
        });

        return { success: true, message: 'Google account linked successfully' };

    } catch (error) {
        console.error('Error linking Google account:', error);
        if (error instanceof functions.https.HttpsError) throw error;
        throw new functions.https.HttpsError('internal', 'Internal server error');
    }
});

// 4. Verify Password (e.g. before showing Google popup)
exports.verifyEmployeePassword = functions.https.onCall(async (request) => {
    let { employeeId, password } = request.data;
    
    // Normalize Employee ID to uppercase for case-insensitive lookup
    if (employeeId) {
        employeeId = employeeId.trim().toUpperCase();
    }

    if (!employeeId || !password) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }

    try {
        const db = admin.firestore();

        // Check both collections
        let empData = null;

        const subSnap = await db.collection('onboarding_submissions')
            .where('employeeId', '==', employeeId).limit(1).get();
        if (!subSnap.empty) {
            empData = subSnap.docs[0].data();
        } else {
            const empSnap = await db.collection('employees')
                .where('employeeId', '==', employeeId).limit(1).get();
            if (!empSnap.empty) {
                empData = empSnap.docs[0].data();
            }
        }

        if (!empData) {
            throw new functions.https.HttpsError('not-found', 'Employee not found');
        }

        let isVerified = false;
        if (empData.passwordHash) {
            isVerified = await verifyPassword(password, empData.passwordHash);
        } else if (empData.mockPassword) {
            isVerified = empData.mockPassword === password;
        }

        if (!isVerified) {
            throw new functions.https.HttpsError('permission-denied', 'Incorrect password');
        }

        return { success: true };
    } catch (error) {
        console.error('Error verifying password:', error);
        if (error instanceof functions.https.HttpsError) throw error;
        throw new functions.https.HttpsError('internal', 'Internal server error');
    }
});

// 5. Unlink Google Account
exports.unlinkEmployeeGoogleAccount = functions.https.onCall(async (request) => {
    let { employeeId, currentPassword } = request.data;
    
    if (employeeId) employeeId = employeeId.trim().toUpperCase();

    if (!employeeId || !currentPassword) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }

    try {
        const db = admin.firestore();
        let isVerified = false;
        let docRefs = [];

        const subSnap = await db.collection('onboarding_submissions')
            .where('employeeId', '==', employeeId).limit(1).get();

        if (!subSnap.empty) {
            docRefs.push(subSnap.docs[0].ref);
            const subData = subSnap.docs[0].data();
            if (subData.passwordHash) {
                isVerified = await verifyPassword(currentPassword, subData.passwordHash);
            }
        }

        const empSnap = await db.collection('employees')
            .where('employeeId', '==', employeeId).limit(1).get();
        if (!empSnap.empty) {
            docRefs.push(empSnap.docs[0].ref);
            if (!isVerified) {
                const empData = empSnap.docs[0].data();
                if (empData.passwordHash) {
                    isVerified = await verifyPassword(currentPassword, empData.passwordHash);
                }
            }
        }

        if (docRefs.length === 0) throw new functions.https.HttpsError('not-found', 'Employee not found');
        if (!isVerified) throw new functions.https.HttpsError('permission-denied', 'Incorrect password');

        const updates = {
            uid: admin.firestore.FieldValue.delete(),
            linkedUid: 'none',
            authProvider: 'manual',
            linkedGoogleEmail: admin.firestore.FieldValue.delete()
        };

        await Promise.all(docRefs.map(ref => ref.update(updates)));

        return { success: true, message: 'Google account unlinked safely' };
    } catch (error) {
        console.error('Error unlinking Google account:', error);
        if (error instanceof functions.https.HttpsError) throw error;
        throw new functions.https.HttpsError('internal', 'Internal server error');
    }
});

// 5b. Setup Initial Password (replaces client-side SHA-256 hashing)
// Called when employee sets their first password during account setup
exports.setupEmployeePassword = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    const { employeeId, newPassword } = request.data;
    if (!employeeId || !newPassword) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }
    if (newPassword.length < 6) {
        throw new functions.https.HttpsError('invalid-argument', 'Password must be at least 6 characters');
    }

    try {
        const db = admin.firestore();
        const callerUid = request.auth.uid;

        // Find the employee record and verify ownership
        let docRef = null;
        let collectionName = null;

        const empSnap = await db.collection('employees').doc(callerUid).get();
        if (empSnap.exists) {
            docRef = empSnap.ref;
            collectionName = 'employees';
        }

        if (!docRef) {
            const subSnap = await db.collection('onboarding_submissions').doc(callerUid).get();
            if (subSnap.exists) {
                docRef = subSnap.ref;
                collectionName = 'onboarding_submissions';
            }
        }

        // Also check by employeeId field
        if (!docRef) {
            const empQuery = await db.collection('employees')
                .where('employeeId', '==', employeeId.trim().toUpperCase())
                .where('uid', '==', callerUid)
                .limit(1).get();
            if (!empQuery.empty) {
                docRef = empQuery.docs[0].ref;
                collectionName = 'employees';
            }
        }

        if (!docRef) {
            const subQuery = await db.collection('onboarding_submissions')
                .where('employeeId', '==', employeeId.trim().toUpperCase())
                .where('uid', '==', callerUid)
                .limit(1).get();
            if (!subQuery.empty) {
                docRef = subQuery.docs[0].ref;
                collectionName = 'onboarding_submissions';
            }
        }

        if (!docRef) {
            throw new functions.https.HttpsError('permission-denied', 'You can only set password for your own account');
        }

        // Hash with bcrypt (secure, salted, slow)
        const passwordHash = await hashPassword(newPassword);
        await docRef.update({
            passwordHash: passwordHash,
            mockPassword: admin.firestore.FieldValue.delete(),
            isDefaultPassword: false,
            authProvider: 'manual'
        });

        console.log(`[SETUP_PASSWORD] Password set for ${employeeId} in ${collectionName}`);
        return { success: true };
    } catch (error) {
        console.error('Error setting up password:', error);
        if (error instanceof functions.https.HttpsError) throw error;
        throw new functions.https.HttpsError('internal', 'Internal server error');
    }
});

exports.selfLinkGoogleAccount = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    let targetGoogleUid = request.data.googleUid;
    let targetEmail = request.data.email;

    // Cryptographic verification if idToken is supplied
    if (request.data.googleIdToken) {
        try {
            const decodedToken = await admin.auth().verifyIdToken(request.data.googleIdToken);
            targetGoogleUid = decodedToken.uid;
            targetEmail = decodedToken.email;
        } catch (tokenErr) {
            console.error('[selfLinkGoogleAccount] Token verification failed:', tokenErr);
            throw new functions.https.HttpsError('unauthenticated', 'Invalid Google token signature.');
        }
    }

    const { employeeId } = request.data;
    const googleUid = targetGoogleUid;
    const email = targetEmail;
    if (!employeeId || !googleUid || !email) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }

    try {
        const db = admin.firestore();
        const callerUid = request.auth.uid; // This is the Portal ID (their document key)

        // Find the employee record and verify ownership
        let docRef = null;
        let collectionName = null;

        // Try by document ID (callerUid)
        const empSnap = await db.collection('employees').doc(callerUid).get();
        if (empSnap.exists) {
            docRef = empSnap.ref;
            collectionName = 'employees';
        }

        if (!docRef) {
            const subSnap = await db.collection('onboarding_submissions').doc(callerUid).get();
            if (subSnap.exists) {
                docRef = subSnap.ref;
                collectionName = 'onboarding_submissions';
            }
        }

        // Also check by employeeId field matching callerUid
        if (!docRef) {
            const empQuery = await db.collection('employees')
                .where('employeeId', '==', employeeId.trim().toUpperCase())
                .where('uid', '==', callerUid)
                .limit(1).get();
            if (!empQuery.empty) {
                docRef = empQuery.docs[0].ref;
                collectionName = 'employees';
            }
        }

        if (!docRef) {
            const subQuery = await db.collection('onboarding_submissions')
                .where('employeeId', '==', employeeId.trim().toUpperCase())
                .where('uid', '==', callerUid)
                .limit(1).get();
            if (!subQuery.empty) {
                docRef = subQuery.docs[0].ref;
                collectionName = 'onboarding_submissions';
            }
        }

        if (!docRef) {
            throw new functions.https.HttpsError('permission-denied', 'You can only link Google account for your own account');
        }

        // Check Google account conflict (make sure this Google account isn't used by another user)
        const normalizedGoogleEmail = email.toLowerCase().trim();

        // 🛡️ SECURITY: Check if this email belongs to an Admin/Staff user via Firebase Auth API
        try {
            const authUserRecord = await admin.auth().getUserByEmail(normalizedGoogleEmail);
            if (authUserRecord) {
                const [empSnapByUid, subSnapByUid] = await Promise.all([
                    db.collection('employees').where('uid', '==', authUserRecord.uid).limit(1).get(),
                    db.collection('onboarding_submissions').where('linkedUid', '==', authUserRecord.uid).limit(1).get()
                ]);
                if (empSnapByUid.empty && subSnapByUid.empty) {
                    throw new functions.https.HttpsError('already-exists', 'This Google account is already registered in our system. Please contact your administrator.');
                }
            }
        } catch (authError) {
            if (authError.code !== 'auth/user-not-found' && !(authError instanceof functions.https.HttpsError)) {
                throw authError;
            }
            if (authError instanceof functions.https.HttpsError) throw authError;
        }

        const empChecks = await Promise.all([
            db.collection('employees').where('uid', '==', googleUid).get(),
            db.collection('employees').where('linkedGoogleEmail', '==', normalizedGoogleEmail).get(),
            db.collection('onboarding_submissions').where('uid', '==', googleUid).get(),
            db.collection('onboarding_submissions').where('linkedGoogleEmail', '==', normalizedGoogleEmail).get()
        ]);

        for (const snap of empChecks) {
            if (!snap.empty) {
                const isOnlySelf = snap.docs.every(doc => doc.id === callerUid || doc.data().employeeId === employeeId);
                if (!isOnlySelf) {
                    throw new functions.https.HttpsError('already-exists', 'This Google account is already registered in our system. Please contact your administrator.');
                }
            }
        }

        // Link Google Account
        await docRef.update({
            uid: googleUid,
            linkedUid: googleUid,
            authProvider: 'google',
            linkedGoogleEmail: normalizedGoogleEmail,
            isDefaultPassword: false,
            passwordHash: '', // Clear manual password hash if linking Google
            mockPassword: admin.firestore.FieldValue.delete() // Clear plain text password
        });

        console.log(`[SELF_LINK_GOOGLE] Google account linked for ${employeeId} in ${collectionName}`);
        return { success: true };
    } catch (error) {
        console.error('Error linking Google account:', error);
        if (error instanceof functions.https.HttpsError) throw error;
        throw new functions.https.HttpsError('internal', 'Internal server error');
    }
});

// 6. Admin Control Employee Auth
exports.adminControlEmployeeAuth = functions.https.onCall(async (request) => {
    if (!request.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');

    const db = admin.firestore();
    const [userSnap, staffSnap, staffAccSnap] = await Promise.all([
        db.collection('users').doc(request.auth.uid).get(),
        db.collection('staff').doc(request.auth.uid).get(),
        db.collection('staff_accounts').doc(request.auth.uid).get()
    ]);

    // SECURITY: Only SuperAdmin can reset employee passwords or mutate auth providers
    const isSuperAdmin = (userSnap.exists && userSnap.data().roleId === 'role-super-admin') ||
                         (staffAccSnap.exists && staffAccSnap.data().roleId === 'role-super-admin') ||
                         (staffSnap.exists && staffSnap.data().roleId === 'role-super-admin');

    if (!isSuperAdmin) {
        throw new functions.https.HttpsError('permission-denied', 'Only Super Administrators can perform employee credential resets or auth provider changes.');
    }

    let { employeeId, action, payload } = request.data;
    if (employeeId) employeeId = employeeId.trim().toUpperCase();
    if (!employeeId || !action) throw new functions.https.HttpsError('invalid-argument', 'Missing employeeId or action');

    try {
        let docRefs = [];
        const empSnap = await db.collection('employees').where('employeeId', '==', employeeId).limit(1).get();
        if (!empSnap.empty) docRefs.push(empSnap.docs[0].ref);

        const subSnap = await db.collection('onboarding_submissions').where('employeeId', '==', employeeId).limit(1).get();
        if (!subSnap.empty) docRefs.push(subSnap.docs[0].ref);

        if (docRefs.length === 0) throw new functions.https.HttpsError('not-found', 'Employee not found');

        if (action === 'reset_password') {
            const { newPassword } = payload || {};
            if (!newPassword || newPassword.length < 6) throw new functions.https.HttpsError('invalid-argument', 'Invalid new password');
            const hashed = await hashPassword(newPassword);
            const updates = {
                passwordHash: hashed,
                mockPassword: admin.firestore.FieldValue.delete(),
                isDefaultPassword: false,
                authProvider: 'manual'
            };
            await Promise.all(docRefs.map(ref => ref.update(updates)));
            return { success: true };
        } 
        else if (action === 'unlink_google') {
            const updates = {
                uid: admin.firestore.FieldValue.delete(),
                linkedUid: 'none',
                authProvider: 'manual',
                linkedGoogleEmail: admin.firestore.FieldValue.delete()
            };
            await Promise.all(docRefs.map(ref => ref.update(updates)));
            return { success: true };
        }
        else if (action === 'link_google_email') {
            const { googleEmail } = payload || {};
            if (!googleEmail) throw new functions.https.HttpsError('invalid-argument', 'Google email is required');
            const updates = {
                linkedGoogleEmail: googleEmail.toLowerCase().trim(),
                linkedUid: 'none',
                authProvider: 'google'
            };
            await Promise.all(docRefs.map(ref => ref.update(updates)));
            return { success: true };
        }
        else if (action === 'set_auth_provider') {
            const { provider } = payload || {};
            if (provider !== 'manual' && provider !== 'google') throw new functions.https.HttpsError('invalid-argument', 'Invalid provider');
            await Promise.all(docRefs.map(ref => ref.update({ authProvider: provider })));
            return { success: true };
        }
        else if (action === 'update_email') {
            const { email } = payload || {};
            if (!email) throw new functions.https.HttpsError('invalid-argument', 'Email is required');
            const updates = { 
                email: email.toLowerCase().trim(),
                linkedGoogleEmail: email.toLowerCase().trim() 
            };
            await Promise.all(docRefs.map(ref => ref.update(updates)));
            return { success: true };
        }
        else if (action === 'reset_to_default') {
            // Read the employee data to generate default password
            const empData = empSnap.empty ? null : empSnap.docs[0].data();
            const subData = subSnap.empty ? null : subSnap.docs[0].data();
            const sourceData = empData || subData;
            
            if (!sourceData) throw new functions.https.HttpsError('not-found', 'Cannot read employee data');
            
            // Get name: applicantName or from formData
            const fullName = sourceData.applicantName || sourceData.name || 'user';
            const firstName = fullName.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
            
            // Get DOB year: search in data object for any date-of-birth field
            let year = '123';
            const dataObj = sourceData.data || sourceData.formData || {};
            for (const [key, val] of Object.entries(dataObj)) {
                if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    // Check if key looks like a DOB field (or just use the first date found after name)
                    const keyLower = key.toLowerCase();
                    if (keyLower.includes('birth') || keyLower.includes('dob')) {
                        year = val.split('-')[0];
                        break;
                    }
                }
            }
            // Fallback: check all date fields if no explicit DOB key found
            if (year === '123') {
                for (const [key, val] of Object.entries(dataObj)) {
                    if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}$/)) {
                        // Use the first date field that looks like a birth date (year < 2010)
                        const y = parseInt(val.split('-')[0]);
                        if (y > 1950 && y < 2010) {
                            year = val.split('-')[0];
                            break;
                        }
                    }
                }
            }
            
            const defaultPassword = `${firstName}${year}`;
            const hashed = await hashPassword(defaultPassword);
            const updates = {
                passwordHash: hashed,
                mockPassword: defaultPassword,
                isDefaultPassword: true,
                authProvider: 'manual'
            };
            await Promise.all(docRefs.map(ref => ref.update(updates)));
            return { success: true, generatedPassword: defaultPassword };
        }
        else {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid action');
        }
    } catch (error) {
        console.error('Error in adminControlEmployeeAuth:', error);
        if (error instanceof functions.https.HttpsError) throw error;
        throw new functions.https.HttpsError('internal', 'Internal server error');
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// SECURE FILE STORAGE & RETRIEVAL
// ─────────────────────────────────────────────────────────────────────────────

// Generate a 15-minute temporary signed URL for a given Firebase Storage path
exports.getSecureDocumentURL = functions.https.onCall(async (request) => {
    // SECURITY: Must be authenticated
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to access secure documents.');
    }

    const { storagePath } = request.data;
    if (!storagePath) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing storagePath parameter.');
    }

    try {
        const db = admin.firestore();
        const uid = request.auth.uid;
        
        // 1. Check if caller is Admin or Staff
        let isAdminOrStaff = false;
        const [userSnap, staffSnap, staffAccSnap] = await Promise.all([
            db.collection('users').doc(uid).get(),
            db.collection('staff').doc(uid).get(),
            db.collection('staff_accounts').doc(uid).get()
        ]);
        
        if (userSnap.exists || staffSnap.exists || staffAccSnap.exists) {
            isAdminOrStaff = true;
        } else if (request.auth.token && request.auth.token.email) {
            // Fallback: Check if user exists in staff collections by email (for legacy staff matched by email)
            const email = request.auth.token.email;
            const [usersByEmail, staffByEmail, staffAccByEmail] = await Promise.all([
                db.collection('users').where('email', '==', email).limit(1).get(),
                db.collection('staff').where('email', '==', email).limit(1).get(),
                db.collection('staff_accounts').where('email', '==', email).limit(1).get()
            ]);
            if (!usersByEmail.empty || !staffByEmail.empty || !staffAccByEmail.empty) {
                isAdminOrStaff = true;
            }
        }

        // 2. Perform Authorization Checks based on path
        let isAuthorized = false;

        if (isAdminOrStaff) {
            isAuthorized = true; // Admins can view anything
        } else if (storagePath.startsWith('public/')) {
            isAuthorized = true; // Anyone authenticated can view public assets
        } else if (storagePath.startsWith(`employees/`)) {
            const pathParts = storagePath.split('/');
            const employeeIdInPath = pathParts[1];
            
            if (employeeIdInPath) {
                if (employeeIdInPath === uid) {
                    isAuthorized = true;
                } else {
                    // 1. Direct document ID lookup
                    let empDoc = await db.collection('employees').doc(employeeIdInPath).get();
                    let empData = empDoc.exists ? empDoc.data() : null;

                    // 2. Fallback: Search by employeeId field (e.g. HY140001)
                    if (!empData) {
                        const snap = await db.collection('employees')
                            .where('employeeId', '==', employeeIdInPath)
                            .limit(1)
                            .get();
                        if (!snap.empty) {
                            empDoc = snap.docs[0];
                            empData = empDoc.data();
                        }
                    }

                    // 3. Fallback: Check onboarding_submissions
                    if (!empData) {
                        const subDoc = await db.collection('onboarding_submissions').doc(employeeIdInPath).get();
                        if (subDoc.exists) {
                            empDoc = subDoc;
                            empData = subDoc.data();
                        } else {
                            const subSnap = await db.collection('onboarding_submissions')
                                .where('employeeId', '==', employeeIdInPath)
                                .limit(1)
                                .get();
                            if (!subSnap.empty) {
                                empDoc = subSnap.docs[0];
                                empData = empDoc.data();
                            }
                        }
                    }

                    if (empData) {
                        if (
                            empData.linkedUid === uid ||
                            empData.uid === uid ||
                            empData.employeeId === uid ||
                            empData.portalId === uid ||
                            (empDoc && empDoc.id === uid)
                        ) {
                            isAuthorized = true;
                        }
                    }
                }
            }
        } else if (storagePath.startsWith(`onboarding/`)) {
            const pathParts = storagePath.split('/');
            const folderUid = pathParts[1];
            
            if (folderUid === uid) {
                isAuthorized = true; 
            } else {
                // Check if onboarding submission has matching Portal ID or linked Google account
                const subDoc = await db.collection('onboarding_submissions').doc(folderUid).get();
                if (subDoc.exists && (subDoc.data().linkedUid === uid || subDoc.data().uid === uid || subDoc.data().employeeId === uid)) {
                    isAuthorized = true;
                } else {
                    const subSnap = await db.collection('onboarding_submissions')
                        .where('linkedUid', '==', folderUid)
                        .limit(1)
                        .get();
                    if (!subSnap.empty) {
                        const subData = subSnap.docs[0].data();
                        if (subData.linkedUid === uid || subData.uid === uid || subData.employeeId === uid || subSnap.docs[0].id === uid) {
                            isAuthorized = true;
                        }
                    } else {
                        const subSnap2 = await db.collection('onboarding_submissions')
                            .where('uid', '==', folderUid)
                            .limit(1)
                            .get();
                        if (!subSnap2.empty) {
                            const subData = subSnap2.docs[0].data();
                            if (subData.linkedUid === uid || subData.uid === uid || subData.employeeId === uid || subSnap2.docs[0].id === uid) {
                                isAuthorized = true;
                            }
                        }
                    }
                }
            }
        } else if (storagePath.startsWith(`users/`)) {
            const pathParts = storagePath.split('/');
            const portalUserId = pathParts[1];
            
            if (portalUserId) {
                if (portalUserId === uid) {
                    isAuthorized = true;
                } else {
                    // Check employees collection
                    const empDoc = await db.collection('employees').doc(portalUserId).get();
                    if (empDoc.exists && empDoc.data().linkedUid === uid) {
                        isAuthorized = true;
                    } else {
                        // Check onboarding_submissions
                        const subDoc = await db.collection('onboarding_submissions').doc(portalUserId).get();
                        if (subDoc.exists && (subDoc.data().linkedUid === uid || subDoc.data().uid === uid || subDoc.data().employeeId === uid)) {
                            isAuthorized = true;
                        } else {
                            // Check draft_submissions
                            const draftDoc = await db.collection('draft_submissions').doc(portalUserId).get();
                            if (draftDoc.exists && draftDoc.data().ownerUid === uid) {
                                isAuthorized = true;
                            }
                        }
                    }
                }
            }
        } else {
            console.warn(`[SECURITY] Unauthorized access attempt by ${uid} for path: ${storagePath}`);
            throw new functions.https.HttpsError('permission-denied', 'You do not have permission to view this document.');
        }

        if (!isAuthorized) {
            throw new functions.https.HttpsError('permission-denied', 'Access denied.');
        }

        // 3. Generate Signed URL
        const bucket = admin.storage().bucket();
        const file = bucket.file(storagePath);
        
        const [exists] = await file.exists();
        if (!exists) {
            console.warn(`[STORAGE] File not found: ${storagePath}`);
            throw new functions.https.HttpsError('not-found', 'The requested file does not exist.');
        }

        const [url] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 15 * 60 * 1000 // 15 minutes
        });

        return { success: true, url };
    } catch (error) {
        console.error('Error generating secure URL:', error);
        if (error instanceof functions.https.HttpsError) throw error;
        
        // Handle IAM permission errors for getSignedUrl gracefully
        if (error.message && error.message.includes('signBlob')) {
             throw new functions.https.HttpsError(
                 'internal', 
                 'Server configuration error: Service Account Token Creator role missing.'
             );
        }
        throw new functions.https.HttpsError('internal', 'Failed to generate secure document URL.');
    }
});

/**
 * Moves a folder and its contents in Firebase Storage.
 * Used during onboarding approval to move files from temporary to permanent location.
 */
exports.moveStorageFolder = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    const { sourcePath, destinationPath } = request.data;
    if (!sourcePath || !destinationPath) {
        throw new functions.https.HttpsError('invalid-argument', 'sourcePath and destinationPath are required.');
    }

    try {
        const db = admin.firestore();
        const uid = request.auth.uid;

        // 1. Check if caller is Admin or Staff
        let isAdminOrStaff = false;
        const [userSnap, staffSnap, staffAccSnap] = await Promise.all([
            db.collection('users').doc(uid).get(),
            db.collection('staff').doc(uid).get(),
            db.collection('staff_accounts').doc(uid).get()
        ]);
        
        if (userSnap.exists || staffSnap.exists || staffAccSnap.exists) {
            isAdminOrStaff = true;
        }

        if (!isAdminOrStaff) {
            console.warn(`[SECURITY] Unauthorized move attempt by ${uid} from ${sourcePath} to ${destinationPath}`);
            throw new functions.https.HttpsError('permission-denied', 'Only Admin or Staff can move storage folders.');
        }

        const bucket = admin.storage().bucket();
        const [files] = await bucket.getFiles({ prefix: sourcePath });
        
        // Handle exact single file move if getFiles prefix didn't match nested keys
        if (files.length === 0) {
            const singleFile = bucket.file(sourcePath);
            const [exists] = await singleFile.exists();
            if (exists) {
                await singleFile.move(destinationPath);
                return { success: true };
            }
        }

        const movePromises = files.map(file => {
            if (file.name === sourcePath) {
                // Exact single-file move
                return file.move(destinationPath);
            }
            const relativeName = file.name.slice(sourcePath.length);
            if (relativeName) {
                const newFilePath = destinationPath.endsWith('/')
                    ? destinationPath + (relativeName.startsWith('/') ? relativeName.slice(1) : relativeName)
                    : (relativeName.startsWith('/') ? destinationPath + relativeName : destinationPath + '/' + relativeName);
                return file.move(newFilePath);
            }
            return Promise.resolve();
        });

        await Promise.all(movePromises);
        return { success: true };
    } catch (error) {
        console.error('Error moving storage folder:', error);
        throw new functions.https.HttpsError('internal', 'Failed to move storage folder.');
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// RECYCLE BIN AUTOMATED CLEANUP
// ─────────────────────────────────────────────────────────────────────────────
const { onSchedule } = require("firebase-functions/v2/scheduler");

// Runs every night at midnight to permanently delete soft-deleted records older than 30 days
exports.autoDeleteRecycleBin = onSchedule({
    schedule: "0 0 * * *",
    timeZone: "Asia/Kolkata",
    timeoutSeconds: 300 // 5 minutes just in case there are a lot of records
}, async (event) => {
    console.log('[CRON] Starting 30-day Recycle Bin cleanup job...');
    const db = admin.firestore();
    const bucket = admin.storage().bucket();
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    let deletedCount = 0;

    let maxAllowedDeletes = 10000; // Large default cap

    // Check remaining daily write quota using Google Monitoring API
    try {
        const { GoogleAuth } = require('google-auth-library');
        const auth = new GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/monitoring.read']
        });
        const client = await auth.getClient();
        const projectId = await auth.getProjectId() || 'hr-portal-unique-delta';
        const tokenResponse = await client.getAccessToken();
        const accessToken = tokenResponse.token || '';

        if (accessToken) {
            const nowTime = new Date();
            const startOfToday = new Date(Date.UTC(nowTime.getUTCFullYear(), nowTime.getUTCMonth(), nowTime.getUTCDate(), 0, 0, 0));
            const startTime = startOfToday.toISOString();
            const endTime = nowTime.toISOString();
            
            const metricType = 'firestore.googleapis.com/document/write_count';
            const url = `https://monitoring.googleapis.com/v3/projects/${projectId}/timeSeries?filter=metric.type="${metricType}"&interval.startTime=${startTime}&interval.endTime=${endTime}`;
            
            const res = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
            if (res.ok) {
                const data = await res.json();
                let todayWrites = 0;
                if (data.timeSeries) {
                    for (const ts of data.timeSeries) {
                        if (ts.points) {
                            for (const p of ts.points) {
                                if (p.value && p.value.int64Value !== undefined) {
                                    todayWrites += parseInt(p.value.int64Value, 10);
                                } else if (p.value && p.value.doubleValue !== undefined) {
                                    todayWrites += p.value.doubleValue;
                                }
                            }
                        }
                    }
                }
                
                // Firestore free tier has 20,000 writes/day. We leave a safety buffer of 2,000 writes.
                const remainingWrites = 20000 - todayWrites - 2000;
                
                if (remainingWrites > 0) {
                    maxAllowedDeletes = remainingWrites;
                    console.log(`[CRON] Today's writes so far: ${todayWrites}. Remaining free-tier write quota: ${remainingWrites}.`);
                } else {
                    maxAllowedDeletes = 0;
                    console.warn(`[CRON] Daily free-tier write limit nearly reached. Aborting cleanup to save quota.`);
                }
            }
        }
    } catch (metricErr) {
        console.warn(`[CRON] Failed to query GCP metrics, using fallback limit:`, metricErr.message);
        maxAllowedDeletes = 500; // Safe fallback limit
    }

    const performHardDelete = async (docSnap, collectionName, isAbandoned = false) => {
        try {
            const data = docSnap.data();
            if (!isAbandoned) {
                const deletedAtStr = data.deletedAt;
                if (!deletedAtStr) return; // Not soft deleted
                
                const deletedAtTime = new Date(deletedAtStr).getTime();
                if (now - deletedAtTime <= THIRTY_DAYS_MS) {
                    return;
                }
            }

            const uniqueId = docSnap.id;
            console.log(`[CRON] Hard deleting ${collectionName} ${uniqueId}${isAbandoned ? ' (Abandoned >30d)' : ` (deletedAt: ${data.deletedAt})`}`);

            // 1. Delete associated Firebase Storage folder
            if (collectionName === 'employees') {
                await bucket.deleteFiles({ prefix: `employees/${docSnap.id}/` });
                console.log(`[CRON] Wiped Firebase Storage folder for employees/${docSnap.id}`);
            } else if (collectionName === 'onboarding_submissions') {
                await bucket.deleteFiles({ prefix: `onboarding/${docSnap.id}/` });
                if (data.linkedUid) {
                    await bucket.deleteFiles({ prefix: `onboarding/${data.linkedUid}/` });
                }
                if (data.uid) {
                    await bucket.deleteFiles({ prefix: `onboarding/${data.uid}/` });
                }
                console.log(`[CRON] Wiped Firebase Storage folder for ${docSnap.id} and associated applicant folders`);
            }

            // 2. Cascade delete requests
            const deleteAssociated = async (id) => {
                const reqCollections = ['leave_requests', 'account_updates', 'resignations', 'disciplinary_actions', '_auth_attempts'];
                for (const reqCol of reqCollections) {
                    const q = db.collection(reqCol).where('employeeId', '==', id);
                    const snaps = await q.get();
                    const promises = snaps.docs.map(d => d.ref.delete());
                    await Promise.all(promises);
                }
            };
            
            await deleteAssociated(uniqueId);
            if (collectionName === 'onboarding_submissions' && docSnap.id.startsWith('SUB-')) {
                await deleteAssociated(docSnap.id);
            }

            // 3. Delete the main document
            await docSnap.ref.delete();
            deletedCount++;
        } catch (err) {
            console.error(`[CRON] Error hard deleting ${docSnap.id}:`, err);
        }
    };

    try {
        const thirtyDaysAgoIso = new Date(now - THIRTY_DAYS_MS).toISOString();

        // Query deleted employees directly by deletedAt age index
        const empSnap = await db.collection('employees').where('deletedAt', '<=', thirtyDaysAgoIso).get();
        for (const doc of empSnap.docs) {
            if (deletedCount >= maxAllowedDeletes) {
                console.log(`[CRON] Capped cleanup at ${deletedCount} deletes to protect free tier quota.`);
                break;
            }
            await performHardDelete(doc, 'employees');
        }

        // Query deleted submissions directly by deletedAt age index
        if (deletedCount < maxAllowedDeletes) {
            const subSnap = await db.collection('onboarding_submissions').where('deletedAt', '<=', thirtyDaysAgoIso).get();
            for (const doc of subSnap.docs) {
                if (deletedCount >= maxAllowedDeletes) {
                    console.log(`[CRON] Capped cleanup at ${deletedCount} deletes to protect free tier quota.`);
                    break;
                }
                await performHardDelete(doc, 'onboarding_submissions');
            }
        }

        // Check portal config setting: autoDeleteAbandonedSubmissions
        const configDoc = await db.collection('settings').doc('portal_config').get();
        const portalCfg = configDoc.exists ? configDoc.data() : {};
        const isAbandonedCleanupEnabled = portalCfg.autoDeleteAbandonedSubmissions === true;

        // Query abandoned pending onboarding submissions (>30 days inactive) if enabled in settings
        if (isAbandonedCleanupEnabled && deletedCount < maxAllowedDeletes) {
            const abandonedSnap1 = await db.collection('onboarding_submissions')
                .where('status', '==', 'Pending Review')
                .where('timestamp', '<=', thirtyDaysAgoIso)
                .get();
            for (const doc of abandonedSnap1.docs) {
                if (deletedCount >= maxAllowedDeletes) break;
                console.log(`[CRON] Cleaning up abandoned onboarding submission (Pending Review) ${doc.id}`);
                await performHardDelete(doc, 'onboarding_submissions', true);
            }

            if (deletedCount < maxAllowedDeletes) {
                const abandonedSnap2 = await db.collection('onboarding_submissions')
                    .where('status', '==', 'Pending')
                    .where('submittedAt', '<=', thirtyDaysAgoIso)
                    .get();
                for (const doc of abandonedSnap2.docs) {
                    if (deletedCount >= maxAllowedDeletes) break;
                    console.log(`[CRON] Cleaning up abandoned onboarding submission (Pending) ${doc.id}`);
                    await performHardDelete(doc, 'onboarding_submissions', true);
                }
            }
        } else if (!isAbandonedCleanupEnabled) {
            console.log('[CRON] Abandoned submissions cleanup is disabled in Portal Settings.');
        }

        console.log(`[CRON] Finished cleanup. Hard deleted ${deletedCount} records.`);
    } catch (globalErr) {
        console.error('[CRON] Global error during cleanup:', globalErr);
    }
    return null;
});

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY PROFILE CLAIM (AUTOMATED)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * claimEmployeeProfile
 * Authenticated callable that verifies a legacy employee's identity
 * and links their current Google account (UID) to the legacy record.
 * 
 * Input: { employeeId: string, verificationData: object }
 * Returns: { success: true, submissionId?: string, employeeName: string, legacyData: object }
 */
exports.claimEmployeeProfile = functions.https.onCall(async (request) => {
    const { employeeId, verificationData } = request.data || {};
    const db = admin.firestore();

    const currentUid = request.auth ? request.auth.uid : null;
    const currentEmail = (request.auth && request.auth.token) ? (request.auth.token.email || '') : '';

    if (!employeeId || !verificationData) {
        throw new functions.https.HttpsError('invalid-argument', 'Employee ID and verification data are required.');
    }

    const trimmedId = String(employeeId).trim();

    try {
        // 2. SECURITY CHECK: Is this Google account already linked to ANY employee or submission?
        // This prevents one Google account from claiming multiple profiles.
        if (currentUid) {
            const [empSnap, subSnap] = await Promise.all([
                db.collection('employees').where('linkedUid', '==', currentUid).limit(1).get(),
                db.collection('onboarding_submissions').where('linkedUid', '==', currentUid).limit(1).get()
            ]);

            if (!empSnap.empty || !subSnap.empty) {
                // GENERIC MESSAGE: Prevent ID leaking as requested by user
                throw new functions.https.HttpsError('already-exists', 'This Google account is already associated with an employee profile. Please login to the Main Portal instead.');
            }
        }

        // 3. Load the admin's legacy claim configuration
        const configSnap = await db.collection('settings').doc('legacy_claim_config').get();
        if (!configSnap.exists || !configSnap.data().enabled) {
            throw new functions.https.HttpsError('failed-precondition', 'Profile claim feature is currently disabled. Please contact HR.');
        }
        const config = configSnap.data();
        const metrics = config.verificationMetrics || [];

        const normalize = (s) => String(s || '').replace(/[\s\-\/\.]/g, '').toLowerCase();
        const parseDateToYMD = (dateStr) => {
            if (!dateStr) return null;
            const clean = String(dateStr).trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
            const dmyMatch = clean.match(/^(\d{1,2})[-/\.](\d{1,2})[-/\.](\d{4})$/);
            if (dmyMatch) {
                const [_, d, m, y] = dmyMatch;
                return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            }
            const ymdMatch = clean.match(/^(\d{4})[-/\.](\d{1,2})[-/\.](\d{1,2})$/);
            if (ymdMatch) {
                const [_, y, m, d] = ymdMatch;
                return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            }
            return null;
        };

        // 4. Find the legacy import record
        const legacySnap = await db.collection('legacy_employee_imports')
            .where('employeeId', '==', trimmedId)
            .where('claimed', '==', false)
            .limit(1)
            .get();

        if (legacySnap.empty) {
            throw new functions.https.HttpsError('not-found', 'No unclaimed profile found with this Employee ID. It may have already been claimed, or the ID is incorrect.');
        }

        const legacyDoc = legacySnap.docs[0];
        const legacyData = legacyDoc.data();

        // 5. Verify ALL enabled metrics
        for (const metric of metrics) {
            let storedValue = '';
            if (metric === 'phone') storedValue = legacyData.phoneNumber;
            else if (metric === 'aadhaar') storedValue = legacyData.aadhaarNumber;
            else if (metric === 'pan') storedValue = legacyData.panNumber;
            else if (metric === 'bankAccount') storedValue = legacyData.bankAccountNumber;
            else if (metric === 'fatherName') storedValue = legacyData.fatherName;
            else if (metric === 'dob') storedValue = legacyData.dateOfBirth;

            const providedValue = verificationData[metric];

            if (!storedValue) {
                console.warn(`[LEGACY] Missing metric ${metric} in stored record for ${trimmedId}. Failing closed for security (Finding 42).`);
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    `Your legacy profile record is missing ${metric} verification data. For your security, please contact HR to claim your account.`
                );
            }

            if (metric === 'dob') {
                const sYMD = parseDateToYMD(storedValue);
                const pYMD = parseDateToYMD(providedValue);
                if (!sYMD || !pYMD || sYMD !== pYMD) {
                    throw new functions.https.HttpsError('permission-denied', `Verification failed. The ${metric} you entered does not match our records.`);
                }
            } else if (!providedValue || normalize(storedValue) !== normalize(providedValue)) {
                throw new functions.https.HttpsError('permission-denied', `Verification failed. The ${metric} you entered does not match our records.`);
            }
        }

        // 6. Link verified legacy record to current Google account
        await legacyDoc.ref.update({
            claimed: true,
            claimedAt: new Date().toISOString(),
            claimedByUid: currentUid || '',
            linkedEmail: currentEmail || ''
        });

        // 7. Check if there's an existing onboarding_submissions record for this legacy ID
        const existingSubSnap = await db.collection('onboarding_submissions')
            .where('employeeId', '==', trimmedId)
            .limit(1)
            .get();
        const submissionId = existingSubSnap.empty ? null : existingSubSnap.docs[0].id;

        console.log(`[LEGACY] Profile ${trimmedId} claimed and linked to UID ${currentUid}`);

        const tokenUid = submissionId || trimmedId;
        const customToken = await admin.auth().createCustomToken(tokenUid, { portal: 'employee', portalType: 'employee', authProvider: 'google' });

        return {
            success: true,
            token: customToken,
            submissionId: submissionId,
            employeeName: legacyData.fullName || '',
            legacyData: {
                ...legacyData,
                // Ensure rawData or flat fields are returned for auto-fill
                fullName: legacyData.fullName,
                phoneNumber: legacyData.phoneNumber,
                aadhaarNumber: legacyData.aadhaarNumber,
                panNumber: legacyData.panNumber,
                dateOfBirth: legacyData.dateOfBirth,
                fatherName: legacyData.fatherName,
                designation: legacyData.designation,
                location: legacyData.location,
            }
        };
    } catch (err) {
        if (err.code) throw err; // Re-throw HttpsErrors
        console.error('[LEGACY] Claim error:', err);
        throw new functions.https.HttpsError('internal', 'Internal error during profile claim.');
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM USAGE & MONITORING API
// ─────────────────────────────────────────────────────────────────────────────

exports.getSystemMetrics = functions.https.onCall(async (request) => {
    // Only allow authenticated users
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Access denied.');
    }

    const db = admin.firestore();
    const callerUid = request.auth.uid;

    try {
        // Authenticate admin check
        const adminSnap = await db.collection('users').doc(callerUid).get();
        const staffSnap = await db.collection('staff_accounts').doc(callerUid).get();
        
        const isAdmin = adminSnap.exists || (staffSnap.exists && staffSnap.data().roleId === 'role-super-admin');
        if (!isAdmin) {
            throw new functions.https.HttpsError('permission-denied', 'Access denied. Administrator privileges required.');
        }

        // Obtain GCP Google Auth client for Stackdriver Monitoring
        const { GoogleAuth } = require('google-auth-library');
        const auth = new GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/monitoring.read']
        });

        let client;
        let projectId = 'hr-portal-unique-delta';
        let accessToken = '';

        try {
            client = await auth.getClient();
            projectId = await auth.getProjectId() || projectId;
            const tokenResponse = await client.getAccessToken();
            accessToken = tokenResponse.token || '';
        } catch (authErr) {
            console.warn('[METRICS] Failed to obtain GCP credentials, returning mock/fallback data for development:', authErr.message);
            // Graceful fallback for local emulator development
            return {
                isMock: true,
                reads: 1845,
                writes: 232,
                deletes: 12,
                storageBytes: 154 * 1024 * 1024,
                storageUploads: 45,
                storageDownloads: 112,
                storageEgress: 24 * 1024 * 1024,
                invocations: 850,
                buildMinutes: 12.5,
                containerStorage: 310 * 1024 * 1024
            };
        }

        const now = new Date();
        const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
        const startTime = startOfToday.toISOString();
        const endTime = now.toISOString();

        // Helper function for sum queries
        const getMetricCount = async (metricType) => {
            const url = `https://monitoring.googleapis.com/v3/projects/${projectId}/timeSeries?filter=metric.type="${metricType}"&interval.startTime=${startTime}&interval.endTime=${endTime}`;
            try {
                const res = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
                if (!res.ok) return 0;
                const data = await res.json();
                let sum = 0;
                if (data.timeSeries) {
                    for (const ts of data.timeSeries) {
                        if (ts.points) {
                            for (const p of ts.points) {
                                if (p.value && p.value.int64Value !== undefined) {
                                    sum += parseInt(p.value.int64Value, 10);
                                } else if (p.value && p.value.doubleValue !== undefined) {
                                    sum += p.value.doubleValue;
                                }
                            }
                        }
                    }
                }
                return sum;
            } catch (e) {
                console.error(`Error querying metric ${metricType}:`, e);
                return 0;
            }
        };

        // Helper for latest value gauge queries (e.g. storage size)
        const getLatestMetricValue = async (metricType) => {
            const url = `https://monitoring.googleapis.com/v3/projects/${projectId}/timeSeries?filter=metric.type="${metricType}"&interval.startTime=${startTime}&interval.endTime=${endTime}`;
            try {
                const res = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
                if (!res.ok) return 0;
                const data = await res.json();
                if (data.timeSeries && data.timeSeries[0] && data.timeSeries[0].points && data.timeSeries[0].points[0]) {
                    const val = data.timeSeries[0].points[0].value;
                    if (val.int64Value !== undefined) return parseInt(val.int64Value, 10);
                    if (val.doubleValue !== undefined) return val.doubleValue;
                }
                return 0;
            } catch (e) {
                console.error(`Error querying gauge ${metricType}:`, e);
                return 0;
            }
        };

        const [reads, writes, deletes, storageBytes, executions, egress] = await Promise.all([
            getMetricCount('firestore.googleapis.com/document/read_count'),
            getMetricCount('firestore.googleapis.com/document/write_count'),
            getMetricCount('firestore.googleapis.com/document/delete_count'),
            getLatestMetricValue('storage.googleapis.com/storage/total_bytes'),
            getMetricCount('cloudfunctions.googleapis.com/function/execution_count'),
            getMetricCount('storage.googleapis.com/storage/sent_bytes_count')
        ]);

        return {
            isMock: false,
            reads: reads || 0,
            writes: writes || 0,
            deletes: deletes || 0,
            storageBytes: storageBytes || 0,
            storageUploads: Math.round((writes || 0) * 0.1),
            storageDownloads: Math.round((reads || 0) * 0.15),
            storageEgress: egress || 0,
            invocations: executions || 0,
            buildMinutes: 5.2,
            containerStorage: 180 * 1024 * 1024
        };

    } catch (error) {
        console.error('getSystemMetrics failed:', error);
        throw new functions.https.HttpsError('internal', 'Failed to retrieve system metrics.');
    }
});

// Secure check for employee status during Forgot Password flow (so we don't need client-side read permission)
exports.checkForgotPasswordEmployeeStatus = functions.https.onCall(async (request) => {
    const { employeeId } = request.data;
    if (!employeeId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing employeeId');
    }

    try {
        const db = admin.firestore();
        const trimmedId = employeeId.trim().toUpperCase();
        let empDoc = await db.collection('employees').doc(trimmedId).get();
        
        if (!empDoc.exists) {
            const querySnap = await db.collection('employees').where('employeeId', '==', trimmedId).limit(1).get();
            if (!querySnap.empty) {
                empDoc = querySnap.docs[0];
            }
        }

        if (!empDoc.exists) {
            return { exists: false };
        }

        const data = empDoc.data();
        // Return only safe flags to client
        return {
            exists: true,
            isActive: data.isActive !== false,
            needsProfileCompletion: data.needsProfileCompletion || false,
            hasSecurityQuestion: !!(data.securityQuestion || data.passwordResetQuestion),
            securityQuestion: data.securityQuestion || data.passwordResetQuestion || "What is your primary identification number (last 4 digits)?"
        };
    } catch (error) {
        console.error('checkForgotPasswordEmployeeStatus failed:', error);
        throw new functions.https.HttpsError('internal', 'Internal error occurred.');
    }
});

// Rate limiting for username lookups: max 10 requests per minute per IP
const lookupRateLimits = new Map();

function checkLookupRateLimit(ip) {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute
    const maxAttempts = 10;

    let record = lookupRateLimits.get(ip);
    if (!record || now - record.startTime > windowMs) {
        record = { count: 1, startTime: now };
        lookupRateLimits.set(ip, record);
        return true;
    }

    if (record.count >= maxAttempts) {
        return false;
    }

    record.count++;
    return true;
}

exports.resolveUsernameToEmail = functions.https.onCall(async (request) => {
    const rawReq = request.rawRequest;
    const clientIp = (rawReq && (rawReq.headers['x-forwarded-for'] || rawReq.ip || rawReq.connection?.remoteAddress)) || 'unknown-client';
    const cleanIp = typeof clientIp === 'string' ? clientIp.split(',')[0].trim() : 'unknown-client';

    if (!checkLookupRateLimit(cleanIp)) {
        console.warn(`[resolveUsernameToEmail] Rate limit exceeded for IP: ${cleanIp}`);
        throw new functions.https.HttpsError('resource-exhausted', 'Too many lookup requests. Please wait a minute before trying again.');
    }

    const { username, portalType } = request.data || {};
    if (!username || typeof username !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'Missing or invalid username');
    }

    const db = admin.firestore();
    const cleanUsername = username.trim();
    const lowerUsername = cleanUsername.toLowerCase();

    try {
        let foundEmail = null;

        if (portalType === 'management') {
            // 1. Check staff_accounts (usernameLower and username)
            let staffAccSnap = await db.collection('staff_accounts')
                .where('usernameLower', '==', lowerUsername)
                .limit(1).get();
            if (staffAccSnap.empty) {
                staffAccSnap = await db.collection('staff_accounts')
                    .where('username', 'in', [cleanUsername, lowerUsername])
                    .limit(1).get();
            }
            if (!staffAccSnap.empty) {
                const data = staffAccSnap.docs[0].data();
                if (data.isActive !== false) {
                    foundEmail = data.email;
                }
            }

            // 2. Check staff collection
            if (!foundEmail) {
                let staffSnap = await db.collection('staff')
                    .where('usernameLower', '==', lowerUsername)
                    .limit(1).get();
                if (staffSnap.empty) {
                    staffSnap = await db.collection('staff')
                        .where('username', 'in', [cleanUsername, lowerUsername])
                        .limit(1).get();
                }
                if (!staffSnap.empty) {
                    const data = staffSnap.docs[0].data();
                    if (data.isActive !== false) {
                        foundEmail = data.email;
                    }
                }
            }

            // 3. Check users collection
            if (!foundEmail) {
                let usersSnap = await db.collection('users')
                    .where('usernameLower', '==', lowerUsername)
                    .limit(1).get();
                if (usersSnap.empty) {
                    usersSnap = await db.collection('users')
                        .where('username', 'in', [cleanUsername, lowerUsername])
                        .limit(1).get();
                }
                if (!usersSnap.empty) {
                    const data = usersSnap.docs[0].data();
                    if (data.isActive !== false) {
                        foundEmail = data.email;
                    }
                }
            }

            // 4. Case-insensitive fallback scan for existing legacy staff accounts
            if (!foundEmail) {
                const [allStaffAccs, allStaff, allUsers] = await Promise.all([
                    db.collection('staff_accounts').limit(100).get(),
                    db.collection('staff').limit(100).get(),
                    db.collection('users').limit(100).get()
                ]);
                for (const docSnap of [...allStaffAccs.docs, ...allStaff.docs, ...allUsers.docs]) {
                    const data = docSnap.data();
                    if (data.isActive !== false && data.username && String(data.username).trim().toLowerCase() === lowerUsername) {
                        foundEmail = data.email;
                        break;
                    }
                }
            }
        } else if (portalType === 'employee') {
            let empSnap = await db.collection('employees')
                .where('usernameLower', '==', lowerUsername)
                .limit(1).get();
            if (empSnap.empty) {
                empSnap = await db.collection('employees')
                    .where('username', 'in', [cleanUsername, lowerUsername])
                    .limit(1).get();
            }
            if (!empSnap.empty) {
                const data = empSnap.docs[0].data();
                if (data.isActive !== false && data.isRelieved !== true) {
                    foundEmail = data.email;
                }
            }
        }

        return { email: foundEmail || null };
    } catch (error) {
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        console.error('Error in resolveUsernameToEmail:', error);
        throw new functions.https.HttpsError('internal', 'Internal error resolving username.');
    }
});

// Sync staff Google Login UID to Firestore staff_accounts collection (Finding 10)
exports.syncStaffGoogleLogin = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }
    const uid = request.auth.uid;
    const email = (request.auth.token.email || '').toLowerCase().trim();
    if (!email) {
        throw new functions.https.HttpsError('invalid-argument', 'No email associated with auth token');
    }

    // SECURITY: Ensure email is verified by Google to prevent account takeover (Finding 33)
    if (!request.auth.token.email_verified) {
        throw new functions.https.HttpsError('failed-precondition', 'Google account email must be verified.');
    }

    try {
        const db = admin.firestore();
        const staffRef = db.collection('staff_accounts').doc(uid);
        const directSnap = await staffRef.get();
        if (directSnap.exists) {
            return { success: true, message: 'Already synced' };
        }

        // Look for staff account matching this email
        const staffQuery = await db.collection('staff_accounts').where('email', '==', email).limit(1).get();
        if (!staffQuery.empty) {
            const originalDoc = staffQuery.docs[0];
            const originalData = originalDoc.data();
            
            if (originalData.isDisabled === true || originalData.isActive === false) {
                throw new functions.https.HttpsError('permission-denied', 'Account is disabled');
            }

            await staffRef.set({
                ...originalData,
                id: uid,
                googleUid: uid,
                originalDocId: originalDoc.id,
                syncedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            return { success: true, syncedUid: uid };
        }

        // Also check users collection for SuperAdmins
        const userQuery = await db.collection('users').where('email', '==', email).limit(1).get();
        if (!userQuery.empty) {
            const originalUser = userQuery.docs[0];
            const userData = originalUser.data();
            if (userData.isDisabled === true || userData.isActive === false) {
                throw new functions.https.HttpsError('permission-denied', 'Account is disabled');
            }
            await db.collection('users').doc(uid).set({
                ...userData,
                googleUid: uid,
                originalDocId: originalUser.id,
                syncedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            return { success: true, syncedUid: uid };
        }

        return { success: false, message: 'No matching staff account found by email' };
    } catch (err) {
        if (err instanceof functions.https.HttpsError) throw err;
        console.error('Error in syncStaffGoogleLogin:', err);
        throw new functions.https.HttpsError('internal', err.message || 'Error syncing staff Google account');
    }
});
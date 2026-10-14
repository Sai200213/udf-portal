import { execSync } from 'child_process';

const collectionsToPurge = [
  'employees',
  'onboarding_submissions',
  'draft_submissions',
  'correction_requests',
  'referral_invites',
  'staff_referral_invites',
  'leave_requests',
  'leaves',
  'account_updates',
  'resignations',
  'disciplinary_actions',
  'complaints',
  'reward_redemptions',
  'attendance',
  'user_engagement',
  'bgv_records',
  'leave_balances',
  'legacy_employee_imports',
  '_auth_attempts',
  'notifications'
];

console.log('=== Starting Test Data Purge ===');
console.log(`Target collections (${collectionsToPurge.length}):`, collectionsToPurge.join(', '));

for (const col of collectionsToPurge) {
  console.log(`\n--> Purging collection: ${col}...`);
  try {
    execSync(`npx firebase firestore:delete -r -f ${col}`, {
      stdio: 'inherit',
      shell: true
    });
    console.log(`[SUCCESS] Purged ${col}`);
  } catch (err) {
    console.error(`[ERROR] Failed to purge ${col}:`, err.message);
  }
}

console.log('\n=== Purge Completed Successfully! ===');

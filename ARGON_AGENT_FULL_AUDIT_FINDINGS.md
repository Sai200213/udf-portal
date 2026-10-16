# Complete Argon Agent Audit Findings Registry

This document preserves the raw text and categorized findings from the recent Argon Agent multi-pass audit.



================================================================================
## ARGON AUDIT INPUT - STEP 2563 (2026-10-14T10:04:56Z)
================================================================================

<USER_REQUEST>
Here is the end-to-end architectural and security audit of the **Unique Delta Force (UDF) HR & Deployment Management Portal** codebase, organized across your five target areas and followed by prioritized vulnerabilities, logic edge cases, and production-ready code fixes.

### Executive Summary & Severity Matrix

| ID | Severity | Area | File & Lines | Vulnerability / Bug Summary |
| --- | --- | --- | --- | --- |
| **SEC-01** | **Critical** | Storage Rules | `storage.rules:87-92` | Any authenticated/anonymous user can read, overwrite, or delete **any** applicant's onboarding files under `/onboarding/{submissionId}/{allPaths=**}`. |
| **SEC-02** | **Critical** | Firestore Rules | `firestore.rules:232-242` | `draft_submissions` allows unauthenticated `get` (`if true`) and unrestricted `create`/`update`/`delete` (`if isAuthenticated()`), enabling draft hijacking and tampering. |
| **SEC-03** | **Critical** | Firestore Rules | `firestore.rules:146-151, 185, 191, 214, 226` | `hasActiveCorrectionToken` grants **any user** (even unauthenticated) full read and unrestricted write access to an employee or submission record whenever a correction token is pending. |
| **SEC-04** | **High** | Cloud Functions | `functions/index.js:1038-1147` | `verifyEmployeePassword` and `unlinkEmployeeGoogleAccount` have **no rate limiting** (`checkAndIncrementFailedAttempts` is omitted) and no `request.auth` check, enabling brute-force password attacks. |
| **SEC-05** | **High** | Cloud Functions | `functions/index.js:1231-1256` | `selfLinkGoogleAccount` only verifies `googleIdToken` if supplied; if omitted, it trusts raw `request.data.googleUid` and `request.data.email`, allowing arbitrary account linking. |
| **SEC-06** | **High** | Firestore Rules | `firestore.rules:226-227` | `onboarding_submissions` `update` rule allows an applicant (`resource.data.uid == request.auth.uid`) to update **any field** on their submission, including `status: 'Approved'` and `employeeId`. |
| **SEC-07** | **High** | Firestore Rules | `firestore.rules:344-357` | `notifications` `create` (`if isAuthenticated()`) allows any anonymous user to inject fake notifications to `'all_admins'` or any user ID. |
| **SEC-08** | **High** | Secrets / PII | `GOOGLE_APPS_SCRIPT_v7.2.js:7-10, 151, 168`, `EmployeeFormPage.tsx:1522` | Hardcoded Drive folder/form IDs and API keys; Apps Script sets uploaded employee documents to `ANYONE_WITH_LINK` and misroutes `UDF-` IDs into `Active Employees`; Aadhaar PDF password is saved in plaintext in Firestore (`originalAadhaarPassword`). |
| **ONB-01** | **High** | Onboarding / Auth | `src/services/authService.ts:271-294`, `employeeService.ts:566-649` | `checkEmailUniquenessGlobal` and `checkApplicantDuplicates` **fail open** on permission/network errors (`return true` / swallow `err`), and `checkApplicantDuplicates` runs client-side where anonymous/guest users lack `list` permissions on `employees` and `onboarding_submissions`. |
| **ONB-02** | **High** | Drafts & Storage | `src/services/employeeService.ts:130-140`, `storageService.ts:203-218` | Guest session adoption overwrites `ownerUid` when a draft is fetched; files uploaded before the first auto-save go to `onboarding/{anonymousUid}` while later files go to `onboarding/{draftId}`, splitting files across two folders and breaking post-approval storage moves. |
| **CF-01** | **High** | Cloud Functions | `functions/index.js:328-351`, `employeeService.ts:4906-4923` | Non-transactional read-modify-write in `_auth_attempts` rate limiter and `referral_invites` counters (`clicks`, `started`, `joined`) causes race condition lost updates. |
| **STATE-01** | **High** | State & Sync | `src/contexts/DataContext.tsx:423-455`, `App.tsx:907-926, 977-1014` | Memory leak in `DataContext.tsx` where fallback `subscribeToEmployeeByUid` inside `onSnapshot` is never captured for cleanup, plus duplicate active listeners across `DataContext.tsx` and `App.tsx`. |
| **BIN-01** | **High** | Recycle Bin | `src/services/recycleBinService.ts`, `employeeService.ts:2170-2333`, `functions/index.js:1863-1975` | Split-brain architecture: `softDeleteEmployee`/`softDeleteSubmission` never write to `recycle_bin`, `restoreFromRecycleBin` sets invalid `status: 'Active'` without restoring `isActive: true`, and `autoDeleteRecycleBin` never cleans the `recycle_bin` collection or `users/{portalId}` storage paths. |

### 1. Security & Access Control Audit

#### Firebase Security Rules (`firestore.rules` & `storage.rules`)

* **Unrestricted Onboarding Storage Access (`storage.rules:87-92` — Critical):**
* **Root Cause:** The `/onboarding/{submissionId}/{allPaths=**}` rule grants `allow read: if isAuthenticated();` and `allow write: if isAuthenticated() && isValidUpload();`. Because `ensureAuthenticated()` (`src/firebase/config.ts:97-105`) signs every public visitor in via Firebase Anonymous Auth, any anonymous user can list, download, overwrite, or delete any applicant's Aadhaar, PAN, or bank documents under `/onboarding/**` (note: in Firebase Storage rules, `write` includes `create`, `update`, and `delete`, and `isValidUpload()` returns `true` when `request.resource == null` on line 12, explicitly permitting deletions!).


* **Unauthenticated Record Access & Tampering via `hasActiveCorrectionToken` (`firestore.rules:146-151, 185, 191, 214, 226` — Critical):**
* **Root Cause:** `hasActiveCorrectionToken(resource.data)` only checks whether the target `employees` or `onboarding_submissions` document has a non-null `activeCorrectionToken` pointing to a pending, non-expired `correction_requests` doc. It does **not** verify `isAuthenticated()`, nor does it restrict which fields can be modified in `allow update`. While an employee or applicant has a pending correction request, **anyone on the internet** who knows or guesses their `employeeId` or `submissionId` can `get` their full record and `update` any field on it (including `passwordHash`, `status`, or `uid`).


* **Self-Approval Privilege Escalation on `onboarding_submissions` (`firestore.rules:226-227` — High):**
* **Root Cause:** Line 227 grants `allow update: if ... (isAuthenticated() && (resource.id == request.auth.uid || resource.data.uid == request.auth.uid || resource.data.linkedUid == request.auth.uid))` without restricting `affectedKeys()`. A candidate can update their own submission document directly from the browser console to set `status: 'Approved'`, `employeeId: 'HY100001'`, and `passwordHash`. Since `employeeLogin` (`functions/index.js:534-540`) authenticates against `onboarding_submissions` where `status == 'Approved'`, the applicant can immediately log in as an approved employee without HR approval.


* **Insecure Draft Access & Deletion (`firestore.rules:232-242` — Critical):**
* **Root Cause:** `match /draft_submissions/{id}` sets `allow get: if true;` and `allow create, update, delete: if isAuthenticated();`. Furthermore, `getNextSubmissionId()` (`src/services/employeeService.ts:483-508`) generates draft IDs using `UDF-YYYYMM-XXXX` where `XXXX` is a 4-character base-36 string (`Math.random().toString(36).substring(2, 6).toUpperCase()`, keyspace of $36^4 = 1,679,616$). Anyone can brute-force or read draft IDs without authentication and overwrite or delete any applicant's draft.


* **Cross-Site Data Exposure in `firestore.rules` (`firestore.rules:164, 171, 177, 187, 216, 246, 275, 304` — Medium/High):**
* **Root Cause:** While `allow get` on `employees` and `onboarding_submissions` checks `canStaffViewSite(...)`, `allow list` on lines 187 and 216 only checks `if isAdmin()`! Any site supervisor or field officer (who is in `staff_accounts` and therefore satisfies `isAdmin()`) can run a collection-wide `getDocs(collection(db, 'employees'))` or `onboarding_submissions` query and bypass site restrictions completely. Similarly, `leave_requests`, `account_updates`, and `resignations` allow `read: if isAdmin()` without site scoping, and `resignations` (`firestore.rules:319-326`) allows **any** `isAdmin()` to approve/reject resignations regardless of `hasPermission('RESIGNATIONS_APPROVE')`.


* **Notification & Audit Log Spoofing (`firestore.rules:351, 362` — High):**
* **Root Cause:** Both `notifications` and `audit_logs` have `allow create: if isAuthenticated();` with no schema validation or `actorId == request.auth.uid` enforcement. Any anonymous user can flood admin notifications (`targetUserId: 'all_admins'`) or forge audit log entries.



#### Role Isolation & Session Hijacking

* **Client-Side `portalType` Manipulation (`src/context/AuthContext.tsx:40-76`, `src/routes/AppRoutes.tsx:256-262`):**
* **Root Cause:** `AuthContext` relies on `localStorage.getItem('portalType')` to decide which collection (`employees` vs. `users`/`staff_accounts`) to query. While `AuthGuard` (`src/components/guards/AuthGuard.tsx:34`) checks `allowedUserTypes`, if an authenticated user without a profile logs in when `portalType` is unset, `AuthContext.tsx:84-89` resolves them as `UserType.PUBLIC` with `roleId: 'guest'`. In `DataContext.tsx:480`, the check is `(user as any).type !== 'Guest'`, whereas `UserType.PUBLIC` equals `'Public'` (`types.ts`), causing `DataContext` to subscribe a `Public` user to the `roles` collection!


* **Account Linking Takeover via `employees` Update Rule (`firestore.rules:201-206`):**
* **Root Cause:** Line 205 allows an authenticated user to claim an employee record by updating `uid` if `resource.data.get('email', '') == request.auth.token.email`, without checking `request.auth.token.email_verified == true`.



#### Sensitive Data & API Keys

* **Plaintext Aadhaar PDF Password Stored in Firestore (`components/EmployeeFormPage.tsx:1521-1523` — High):**
* **Root Cause:** When an applicant unlocks an encrypted e-Aadhaar PDF, `processAadhaarFile` sets `updates['originalAadhaarPassword'] = password;`, which is saved in plaintext into `draft_submissions` and `onboarding_submissions`.


* **Hardcoded Identifiers & Public File Sharing in Google Apps Script (`GOOGLE_APPS_SCRIPT_v7.2.js:7-10, 151, 168` & `scripts/test-drive-connection.js:1` — High):**
* **Root Cause:** `GOOGLE_APPS_SCRIPT_v7.2.js` hardcodes `ROOT_FOLDER_ID`, `FIREBASE_API_KEY`, and `FORM_ID`, and `scripts/test-drive-connection.js` hardcodes the live Apps Script deployment URL (`[https://script.google.com/macros/s/AKfycbw.../exec](https://script.google.com/macros/s/AKfycbw.../exec)`). Worse, line 168 of `GOOGLE_APPS_SCRIPT_v7.2.js` executes `file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);` on every uploaded employee identity document, making sensitive PII links publicly accessible without authentication, and line 81 of `verifyViaApi` only checks `users/{uid}` for `role-super-admin` (ignoring `staff_accounts/{uid}`). Additionally, line 151 checks `data.uniqueId.startsWith('SUB-')` to decide between `Pending Employees` and `Active Employees`, but modern submissions use `UDF-` (`getNextSubmissionId`), so all new unapproved applicant folders are created directly inside `Active Employees`!



### 2. Onboarding & Multi-Step Form Submission Flaws

#### Validation & Duplicate Checking (`employeeService.ts` & `authService.ts`)

* **Uniqueness Check Fails Open (`src/services/authService.ts:271-294`):**
* **Root Cause:** `checkEmailUniquenessGlobal` catches any Cloud Function error (including network drops, rate limits, or missing indexes) on line 287 and returns `true` ("unique"). Worse, in `functions/index.js:55-58`, `checkGlobalUniqueness` queries `employees` by `profileData.personalDetails.email`, whereas form submissions store fields keyed by UUID (e.g., `formData[emailFieldUuid]`) and never populate `profileData.personalDetails.email` or top-level `email` on `onboarding_submissions` (`src/services/employeeService.ts:878-904` never sets top-level `email: applicantEmail`!). Thus, `checkGlobalUniqueness` misses almost all manual email submissions!


* **Client-Side Duplicate Check Fails Silently for Guests (`src/services/employeeService.ts:521-650, 858`):**
* **Root Cause:** `submitEmployeeForm` calls `checkApplicantDuplicates` on line 858 **from the applicant's browser**. Under `firestore.rules:187-190` and `216-224`, an anonymous/guest applicant (or new Google applicant) is only allowed to `list` documents in `employees` and `onboarding_submissions` where `uid == request.auth.uid`. When `checkApplicantDuplicates` queries `where('aadhaarNumber', '==', cleanVal)` across `employees` or `onboarding_submissions`, Firestore immediately throws ` permission-denied`! The `catch (err)` block at `employeeService.ts:647` swallows the error and returns `{ isDuplicate: false }`, meaning **every applicant-side duplicate check during form submission silently fails open** and records `duplicateCheck: { isDuplicate: false }` in Firestore!



#### File Upload Integrity (`EmployeeFileUploadField.tsx`, `storageService.ts`, `driveService.ts`)

* **Split Storage Folders Between First Upload and First Auto-Save (`src/services/storageService.ts:187-220` & `employeeService.ts:1645-1680`):**
* **Root Cause:** When an applicant uploads a file in `EmployeeFileUploadField.tsx:167`, `uploadSubmissionDocument` checks `sessionStorage.getItem('onboarding_savedDraftId')` (`storageService.ts:205`). If the applicant uploads a file (or uses Aadhaar Quick Apply before a draft ID exists) *before* the 1.5s auto-save timer fires, `folderName` falls back to `uid` (the anonymous or Google UID), storing the file at `onboarding/{uid}/{fieldId}/{file}`. Once auto-save runs, `onboarding_savedDraftId` becomes `UDF-YYYYMM-XXXX`, so subsequent files are uploaded to `onboarding/UDF-YYYYMM-XXXX/{fieldId}/{file}`.
* **Downstream Impact:** Upon final approval (`employeeService.ts:1645-1680`), `updateSubmissionStatus` only moves `oldStoragePath = onboarding/${data.linkedUid || submissionId}` to `employees/${submissionId}/joining`! Any files uploaded under `onboarding/${submissionId}` (when `linkedUid` is set) or under the old anonymous `uid` are **never moved** to `employees/${submissionId}/joining`, and their paths in `updatedProfileData` are not rewritten, resulting in broken document links post-approval.


* **Orphaned Storage Files on Re-Upload / Remove (`components/employeeFormFields/EmployeeFileUploadField.tsx:459-473`):**
* **Root Cause:** Clicking "Remove" on an uploaded file only calls `onChange(field.id, null)` in React state without deleting the blob from Firebase Storage or removing it from `fileSessionStore` if `value` was already a storage path string.


* **Detached Background Drive Sync Lost on Sign-Out/Tab Close (`src/services/employeeService.ts:977-985` & `EmployeeFormPage.tsx:1902`):**
* **Root Cause:** `submitEmployeeForm` schedules `syncDriveFolder(submissionId)` inside a `setTimeout(..., 100)` and immediately returns `submissionId`. `EmployeeFormPage.tsx:1902` then waits 400ms and calls `await signOut(auth)`! Signing out destroys `auth.currentUser` while `syncDriveFolder` is still downloading blobs from Firebase Storage and calling `callAppsScript` (which calls `ensureAuthenticated()` and generates a brand-new anonymous user token that lacks ownership permission in `GOOGLE_APPS_SCRIPT_v7.2.js:128-135` and `firestore.rules:226` to update `driveBackupStatus: 'completed'`).



#### Cloud Drafts & Conflicts

* **Cross-Applicant Draft Hijacking on Guest Session Adoption (`src/services/employeeService.ts:127-140`):**
* **Root Cause:** In `getFormDraft(draftId)`, if any guest user queries a `draftId` (or guesses the 4-char suffix) and `!data.isGoogleDraft`, lines 130-136 immediately execute `updateDoc(doc(db, DRAFTS_COLLECTION, snap.id), { ownerUid: user.uid })`, stealing ownership of the draft from the original active applicant!


* **Stale Closure Overwrite in Auto-Save (`components/EmployeeFormPage.tsx:353-417`):**
* **Root Cause:** `savedDraftId` is read inside the `setTimeout` callback (line 386) and in the `APPLICATION_ALREADY_SUBMITTED` catch block (line 397), but `savedDraftId` is omitted from the `useEffect` dependency array on line 417. Furthermore, if `isSavingRef.current` is `true` when the user types a new character, line 365 (`if (isSavingRef.current) return;`) aborts setting a new debounce timer; when the in-flight save finishes, no new timer is scheduled, leaving the user's latest keystrokes unsaved until they type again.



### 3. Backend Cloud Functions & Async Integrity (`functions/index.js`)

* **Missing Rate Limiting & Auth Checks on Password Endpoints (`functions/index.js:1038-1147`):**
* **Root Cause:** `verifyEmployeePassword` (line 1038) and `unlinkEmployeeGoogleAccount` (line 1092) do **not** call `checkAndIncrementFailedAttempts(db, ...)`, nor do they check `request.auth`. An attacker can brute-force any employee's password at high speed via `verifyEmployeePassword` even when `employeeLogin` has locked `login_${employeeId}`, and once found, can unlink their Google account.


* **Unverified Google UID Spoofing in `selfLinkGoogleAccount` (`functions/index.js:1236-1256`):**
* **Root Cause:** `selfLinkGoogleAccount` only verifies `request.data.googleIdToken` `if (request.data.googleIdToken)` (line 1240). If a caller omits `googleIdToken` and passes arbitrary `googleUid` and `email` in `request.data`, the function skips cryptographic verification and links the caller's employee profile to the victim's `googleUid` and `email`.


* **Non-Atomic Rate Limiting & Referral Counters (`functions/index.js:328-351`, `employeeService.ts:1774-1785, 4906-4923`):**
* **Root Cause:** `checkAndIncrementFailedAttempts` performs a non-transactional `get()` followed by `set()`. Parallel requests read the same `count: 0` and never trigger the 3-attempt lockout. Similarly, `incrementReferralClicks`, `incrementReferralStarts`, and `joined` count updates read the document and write `clicks + 1` instead of using `increment(1)`.


* **Incomplete Staff Uniqueness Check in `createStaffUser` (`functions/index.js:155-163`):**
* **Root Cause:** `createStaffUser` checks `db.collection('employees').where('email', '==', normalizedEmail)`, but employee emails are stored under `linkedGoogleEmail` or form field UUIDs, not top-level `email`, allowing duplicate staff/employee emails. Also, `adminControlEmployeeAuth` (`reset_to_default`, line 1493) still writes plaintext `mockPassword: defaultPassword` to Firestore!



### 4. State Management & Real-Time Sync (`DataContext.tsx`, `App.tsx`)

* **Unsubscribed Firestore Listener Memory Leak (`src/contexts/DataContext.tsx:425-440`):**
* **Root Cause:** Inside `onSnapshot(empQuery, ...)` (lines 430 and 436), when `snap.empty` is true or an error occurs, `DataContext` calls `subscribeToEmployeeByUid(firebaseUid || user.id, ...)` **without storing or returning its unsubscribe function**. Every snapshot emission where `empQuery` is empty spawns 3 new permanent `onSnapshot` listeners (`unsubDoc`, `unsubUid`, `unsubEmail` inside `subscribeToEmployeeByUid`) that leak for the lifetime of the browser tab.


* **Redundant Duplicate Subscriptions Across `DataContext.tsx` and `App.tsx`:**
* **Root Cause:** When an employee logs in, **both** `DataContext.tsx:423-455` and `App.tsx:914-926, 998-1006` call `subscribeToEmployeeByUid` and `subscribeToSubmissionsByUid`, doubling Firestore read billing and causing competing `setEmployees` / `setSubmittedForms` state updates.


* **Dual Conflicting `leaveBalances` Computations (`DataContext.tsx:157-205` vs `App.tsx:930-972`):**
* **Root Cause:** `DataContext.tsx:157` computes `leaveBalances` via `useMemo` (keyed by `lt.label`, e.g., `'Casual Leave'`) and makes `setLeaveBalances` a no-op (`DataContext.tsx:207`). Meanwhile, `App.tsx:930-972` runs a `useEffect` that computes a different `leaveBalances` structure (keyed by `lt.typeId` with `remaining`) and calls the no-op `setLeaveBalances(balances)`.


* **Unmemoized `adminProps`, `employeeProps`, and `DataContext` `value` (`DataContext.tsx:614`, `App.tsx:2154, 2353`):**
* **Root Cause:** `DataContext.tsx:614` constructs a new `value` object on every render without `useMemo`, and `App.tsx` reconstructs `adminProps` and `employeeProps` on every keystroke (e.g., when typing `adminUsername` or `adminPassword`), re-rendering the entire component tree.



### 5. Universal Recycle Bin & Data Life-Cycle (`recycleBinService.ts`, `employeeService.ts`, `functions/index.js`)

* **Split-Brain Soft Delete Architecture (`employeeService.ts:2170-2275` vs `recycleBinService.ts:31-61`):**
* **Root Cause:** Sites, Staff, Designations, and Vacancies call `moveToRecycleBin(...)` to create documents in the `recycle_bin` collection (viewed in `AdminRecycleBinPage.tsx`). However, `softDeleteEmployee` (`employeeService.ts:2213`) and `softDeleteSubmission` (`employeeService.ts:2170`) **never call `moveToRecycleBin**`! As a result, deleted employees and submissions **never appear** in the Universal Recycle Bin UI (`AdminRecycleBinPage.tsx` always shows `0` Deleted Employees).


* **Broken Employee Restore in `recycleBinService.ts` (`src/services/recycleBinService.ts:136-145`):**
* **Root Cause:** If an employee item ever is restored via `restoreFromRecycleBin`, lines 139-144 only update `{ isDeleted: false, deletedAt: null, status: 'Active' }` — they **fail to set `isActive: true**`, fail to clear `deletedAt` using `deleteField()` (breaking `where("deletedAt", ">=", "0")` or `!emp.deletedAt` checks), and fail to restore the linked `onboarding_submissions` document!


* **Broken Staff Account Restore (`src/services/recycleBinService.ts:124-134` & `AdminStaffManagementPage.tsx:535-605`):**
* **Root Cause:** Deleting a staff member calls the `deleteStaffUser` Cloud Function (`functions/index.js:235`), which permanently deletes their Firebase Auth user (`admin.auth().deleteUser(uid)`) and unassigns their `supervisorId` from all sites and employees. Restoring the staff item from `recycle_bin` (`recycleBinService.ts:126-133`) only writes the Firestore document back to `staff_accounts` — their Firebase Auth account remains deleted (so they can never log in with email/password), and their site/employee supervisor links are never restored!


* **Incomplete 30-Day Cron Job (`functions/index.js:1794-1980`):**
* **Root Cause:**
1. `autoDeleteRecycleBin` only queries `employees` and `onboarding_submissions` for `deletedAt <= thirtyDaysAgoIso`; it **never queries or cleans up the `recycle_bin` collection itself**, so `recycle_bin` items (`SITE`, `STAFF`, `VACANCY`, `DESIGNATION`) remain in Firestore forever past their `expiresAt` date.
2. In `performHardDelete` (`functions/index.js:1880-1892`), deleting an employee only wipes `employees/${docSnap.id}/` in Storage, missing `employees/${data.employeeId}/`, `onboarding/${docSnap.id}/`, and `users/${docSnap.id}/`.
3. `deleteAssociated` (`functions/index.js:1895-1903`) only cleans 5 collections (`leave_requests`, `account_updates`, `resignations`, `disciplinary_actions`, `_auth_attempts`) by `employeeId == uniqueId`, missing `attendance`, `user_engagement`, `complaints`, `reward_redemptions`, `bgv_records`, `correction_requests`, `notifications`, and `leave_balances`, as well as records keyed by `data.employeeId` (e.g., `HY123456`) when `uniqueId` is `UDF-...`!





### Logic Edge Cases (Where Valid Users Get Blocked or See Errors)

1. **Approved Employees Re-Applying or Re-Claiming Blocked by Uniqueness Checks (`functions/index.js:101-106`):**
* In `checkGlobalUniqueness` (`functions/index.js:102`), an employee record is considered a conflict whenever `!doc.data().deletedAt`, **even if `isRelieved === true` or `isActive === false**`. Thus, an ex-employee who left the company and tries to re-apply using their email or Google account is hard-blocked at step 0 (`"This email address is already registered in our system"`) before the rehire detection (`EX_EMPLOYEE_REHIRE`) in `checkApplicantDuplicates` can even run!


2. **Legacy Profile Claim Case-Sensitivity Trap (`functions/index.js:2005, 2049-2053`):**
* Unlike `employeeLogin` (which normalizes `employeeId.trim().toUpperCase()`), `claimEmployeeProfile` only does `String(employeeId).trim()` without `.toUpperCase()`. If a legacy guard enters `hy123456` instead of `HY123456`, the query returns empty and blocks them with `"No unclaimed profile found"`.


3. **Employee Password Change Blocked for Users with Legacy `mockPassword` (`functions/index.js:878-886`):**
* If an employee's password was reset to default by an admin (`adminControlEmployeeAuth` -> `reset_to_default`) or imported via bulk import with only `mockPassword`, and they call `changeEmployeePassword` before logging out and back in, `changeEmployeePassword` ignores `mockPassword` and rejects their current password.


4. **Data Correction Link Fails for Employees Logging In with Employee ID (`components/employee/DataCorrectionPage.tsx:235-237`):**
* Line 237 checks `authUser.id === requestDoc.targetId`. For self-onboarded employees, `requestDoc.targetId` can be their `employeeId` (`HY...`) while `authUser.id` is their Firebase UID / Portal ID (`UDF-...`), causing `isIdentityVerified` to evaluate to `false` even when the right employee is logged in.


5. **Firestore Compound Query Crash in `getPaginatedEmployees` (`src/services/employeeService.ts:1238-1298`):**
* When an admin searches by a field (`where(searchPath, ">=", term)`) while `viewMode === 'RECYCLE_BIN'` (`where("deletedAt", ">=", "0"), orderBy("deletedAt", "desc")`), Firestore throws an invalid query error because range filters on two different fields require a composite index and matching first `orderBy`. The fallback query at line 1305 drops `deletedAt` and only fetches `pageSize * 3` random matching employees, missing actual Recycle Bin records.



### Recommended Production Improvements (Defensive Code Patches)

#### Fix 1: Lock Down `storage.rules` & `firestore.rules` (Fixes SEC-01, SEC-02, SEC-03, SEC-06)

In `storage.rules` (lines 86–92), replace the wide-open `/onboarding/{submissionId}` wildcard with strict owner/admin verification:

```protobuf
    // storage.rules: Replace lines 86-92
    match /onboarding/{submissionId} {
      match /{allPaths=**} {
        allow read: if isAuthenticated() && (
          request.auth.uid == submissionId ||
          isAdmin() ||
          isOnboardingOwner(submissionId)
        );
        allow write: if isAuthenticated() && isValidUpload() && (
          request.auth.uid == submissionId ||
          isAdmin() ||
          isOnboardingOwner(submissionId)
        );
      }
    }

```

In `firestore.rules`, restrict `hasActiveCorrectionToken` updates, lock down `onboarding_submissions` self-updates to non-privileged fields, and enforce ownership on `draft_submissions`:

```protobuf
    // firestore.rules: Replace lines 225-242
    allow create: if isAuthenticated() &&
      request.resource.data.status == 'Pending Review' &&
      request.resource.data.get('currentLevel', 1) == 1;

    allow update: if hasPermission('SUBMISSIONS_APPROVE') || isSuperAdmin()
      || (isAuthenticated() && hasActiveCorrectionToken(resource.data) &&
          !request.resource.data.diff(resource.data).affectedKeys()
            .hasAny(['status', 'currentLevel', 'employeeId', 'passwordHash', 'approvalHistory', 'roleId']))
      || (isAuthenticated() &&
          (resource.id == request.auth.uid || resource.data.get('uid', '') == request.auth.uid || resource.data.get('linkedUid', '') == request.auth.uid) &&
          resource.data.status == 'Pending Review' &&
          !request.resource.data.diff(resource.data).affectedKeys()
            .hasAny(['status', 'currentLevel', 'employeeId', 'approvalHistory']));

    match /draft_submissions/{id} {
      allow get: if isAuthenticated() && (
        isAdmin() ||
        resource == null ||
        resource.data.ownerUid == request.auth.uid ||
        !resource.data.get('isGoogleDraft', false) ||
        (request.auth.token.get('email', '') != '' && resource.data.ownerEmail == request.auth.token.email)
      );
      allow list: if isAdmin() || (isAuthenticated() && (
        resource.data.ownerUid == request.auth.uid ||
        (resource.data.ownerEmail != null && resource.data.ownerEmail == request.auth.token.email)
      ));
      allow create: if isAuthenticated() && request.resource.data.ownerUid == request.auth.uid;
      allow update, delete: if isAdmin() || (isAuthenticated() && (
        resource.data.ownerUid == request.auth.uid ||
        (!resource.data.get('isGoogleDraft', false) && request.resource.data.ownerUid == request.auth.uid)
      ));
    }

```

#### Fix 2: Atomic Transactions, Rate-Limiting & Token Verification in `functions/index.js` (Fixes SEC-04, SEC-05, CF-01)

Update `checkAndIncrementFailedAttempts` (`functions/index.js:328-351`) to use a Firestore Transaction, add rate-limiting to `verifyEmployeePassword` and `unlinkEmployeeGoogleAccount`, and require `googleIdToken` in `selfLinkGoogleAccount`:

```javascript
// functions/index.js: Transactional rate limiter (replaces lines 328-351)
async function checkAndIncrementFailedAttempts(db, key) {
    const attemptsRef = db.collection('_auth_attempts').doc(key);
    const LOCK_DURATION_MS = 60 * 60 * 1000;
    const MAX_ATTEMPTS = 3;

    return await db.runTransaction(async (tx) => {
        const docSnap = await tx.get(attemptsRef);
        const now = Date.now();
        if (docSnap.exists) {
            const data = docSnap.data();
            if (data.lockedUntil && data.lockedUntil > now) {
                return true;
            }
            const nextCount = (data.lockedUntil && data.lockedUntil <= now) ? 1 : (data.count || 0) + 1;
            tx.set(attemptsRef, {
                count: nextCount,
                lockedUntil: nextCount >= MAX_ATTEMPTS ? now + LOCK_DURATION_MS : null,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            return false;
        }
        tx.set(attemptsRef, { count: 1, lockedUntil: null, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        return false;
    });
}

// functions/index.js: Enforce cryptographic token verification in selfLinkGoogleAccount (lines 1236-1256)
if (!request.data.googleIdToken) {
    throw new functions.https.HttpsError('invalid-argument', 'A valid googleIdToken is required to link a Google account.');
}
const decodedToken = await admin.auth().verifyIdToken(request.data.googleIdToken);
const googleUid = decodedToken.uid;
const email = decodedToken.email;

```

#### Fix 3: Eliminate Listener Leaks & Memoize Context in `DataContext.tsx` (Fixes STATE-01)

In `src/contexts/DataContext.tsx` (lines 423–447), track nested fallback listeners and memoize the context provider value:

```tsx
// src/contexts/DataContext.tsx: Replace lines 423-447
let unsubFallbackEmployee = () => {};
if (employeeId) {
    const empQuery = query(collection(db, 'employees'), where('employeeId', '==', employeeId));
    unsubEmployees = onSnapshot(empQuery, (snap) => {
        unsubFallbackEmployee();
        if (!snap.empty) {
            const docSnap = snap.docs[0];
            setEmployees([{ id: docSnap.id, ...docSnap.data() } as unknown as FirestoreEmployee]);
        } else {
            unsubFallbackEmployee = subscribeToEmployeeByUid(firebaseUid || user.id, (emp) => {
                if (emp) setEmployees([emp]);
            });
        }
    }, () => {
        unsubFallbackEmployee();
        unsubFallbackEmployee = subscribeToEmployeeByUid(firebaseUid || user.id, (emp) => {
            if (emp) setEmployees([emp]);
        });
    });
} else {
    unsubEmployees = subscribeToEmployeeByUid(firebaseUid || user.id, (emp) => {
        if (emp) setEmployees([emp]);
    });
}
// Ensure cleanup calls both unsubEmployees() and unsubFallbackEmployee()

```

#### Fix 4: Unify Recycle Bin & Storage Folder Migration (Fixes ONB-02, BIN-01)

1. **Consistent Storage Folder Consolidation (`src/services/employeeService.ts:1645-1686`):** During `updateSubmissionStatus` when `status === 'Approved'`, migrate files from **both** `onboarding/${submissionId}` and `onboarding/${data.linkedUid}` (if distinct) into `employees/${submissionId}/joining`, and rewrite any prefix matching either `onboarding/${submissionId}` or `onboarding/${data.linkedUid}` in `updatedProfileData`.
2. **Unified Recycle Bin Integration (`src/services/recycleBinService.ts:136-145` & `employeeService.ts:2213`):** Call `moveToRecycleBin({ itemType: 'EMPLOYEE', ... })` inside `softDeleteEmployee`, and fix `restoreFromRecycleBin` for `'EMPLOYEE'` to call `await restoreEmployee(originalId)` so `isActive: true`, `deletedAt: deleteField()`, and the linked `onboarding_submissions` record are all restored atomically.
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-10-14T15:34:56+05:30.

The user's current state is as follows:
Active Document: z:\HR PORTAL\.env.local (LANGUAGE_UNSPECIFIED)
Cursor is on line: 1
Other open documents:
- z:\HR PORTAL\.env.admin (LANGUAGE_UNSPECIFIED)
- z:\HR PORTAL\.env (LANGUAGE_UNSPECIFIED)
- z:\UDF_SUBDOMAINS\.gitignore (LANGUAGE_UNSPECIFIED)
- z:\HR PORTAL\.env.local (LANGUAGE_UNSPECIFIED)
- z:\HR PORTAL\.env.example (LANGUAGE_UNSPECIFIED)
</ADDITIONAL_METADATA>



================================================================================
## ARGON AUDIT INPUT - STEP 2563 (2026-10-14T10:09:34Z)
================================================================================

<USER_REQUEST>
Here is the end-to-end architectural and security audit of the **Unique Delta Force (UDF) HR & Deployment Management Portal** codebase, organized across your five target areas and followed by prioritized vulnerabilities, logic edge cases, and production-ready code fixes.

### Executive Summary & Severity Matrix

| ID | Severity | Area | File & Lines | Vulnerability / Bug Summary |
| --- | --- | --- | --- | --- |
| **SEC-01** | **Critical** | Storage Rules | `storage.rules:87-92` | Any authenticated/anonymous user can read, overwrite, or delete **any** applicant's onboarding files under `/onboarding/{submissionId}/{allPaths=**}`. |
| **SEC-02** | **Critical** | Firestore Rules | `firestore.rules:232-242` | `draft_submissions` allows unauthenticated `get` (`if true`) and unrestricted `create`/`update`/`delete` (`if isAuthenticated()`), enabling draft hijacking and tampering. |
| **SEC-03** | **Critical** | Firestore Rules | `firestore.rules:146-151, 185, 191, 214, 226` | `hasActiveCorrectionToken` grants **any user** (even unauthenticated) full read and unrestricted write access to an employee or submission record whenever a correction token is pending. |
| **SEC-04** | **High** | Cloud Functions | `functions/index.js:1038-1147` | `verifyEmployeePassword` and `unlinkEmployeeGoogleAccount` have **no rate limiting** (`checkAndIncrementFailedAttempts` is omitted) and no `request.auth` check, enabling brute-force password attacks. |
| **SEC-05** | **High** | Cloud Functions | `functions/index.js:1231-1256` | `selfLinkGoogleAccount` only verifies `googleIdToken` if supplied; if omitted, it trusts raw `request.data.googleUid` and `request.data.email`, allowing arbitrary account linking. |
| **SEC-06** | **High** | Firestore Rules | `firestore.rules:226-227` | `onboarding_submissions` `update` rule allows an applicant (`resource.data.uid == request.auth.uid`) to update **any field** on their submission, including `status: 'Approved'` and `employeeId`. |
| **SEC-07** | **High** | Firestore Rules | `firestore.rules:344-357` | `notifications` `create` (`if isAuthenticated()`) allows any anonymous user to inject fake notifications to `'all_admins'` or any user ID. |
| **SEC-08** | **High** | Secrets / PII | `GOOGLE_APPS_SCRIPT_v7.2.js:7-10, 151, 168`, `EmployeeFormPage.tsx:1522` | Hardcoded Drive folder/form IDs and API keys; Apps Script sets uploaded employee documents to `ANYONE_WITH_LINK` and misroutes `UDF-` IDs into `Active Employees`; Aadhaar PDF password is saved in plaintext in Firestore (`originalAadhaarPassword`). |
| **ONB-01** | **High** | Onboarding / Auth | `src/services/authService.ts:271-294`, `employeeService.ts:566-649` | `checkEmailUniquenessGlobal` and `checkApplicantDuplicates` **fail open** on permission/network errors (`return true` / swallow `err`), and `checkApplicantDuplicates` runs client-side where anonymous/guest users lack `list` permissions on `employees` and `onboarding_submissions`. |
| **ONB-02** | **High** | Drafts & Storage | `src/services/employeeService.ts:130-140`, `storageService.ts:203-218` | Guest session adoption overwrites `ownerUid` when a draft is fetched; files uploaded before the first auto-save go to `onboarding/{anonymousUid}` while later files go to `onboarding/{draftId}`, splitting files across two folders and breaking post-approval storage moves. |
| **CF-01** | **High** | Cloud Functions | `functions/index.js:328-351`, `employeeService.ts:4906-4923` | Non-transactional read-modify-write in `_auth_attempts` rate limiter and `referral_invites` counters (`clicks`, `started`, `joined`) causes race condition lost updates. |
| **STATE-01** | **High** | State & Sync | `src/contexts/DataContext.tsx:423-455`, `App.tsx:907-926, 977-1014` | Memory leak in `DataContext.tsx` where fallback `subscribeToEmployeeByUid` inside `onSnapshot` is never captured for cleanup, plus duplicate active listeners across `DataContext.tsx` and `App.tsx`. |
| **BIN-01** | **High** | Recycle Bin | `src/services/recycleBinService.ts`, `employeeService.ts:2170-2333`, `functions/index.js:1863-1975` | Split-brain architecture: `softDeleteEmployee`/`softDeleteSubmission` never write to `recycle_bin`, `restoreFromRecycleBin` sets invalid `status: 'Active'` without restoring `isActive: true`, and `autoDeleteRecycleBin` never cleans the `recycle_bin` collection or `users/{portalId}` storage paths. |

### 1. Security & Access Control Audit

#### Firebase Security Rules (`firestore.rules` & `storage.rules`)

* **Unrestricted Onboarding Storage Access (`storage.rules:87-92` — Critical):**
* **Root Cause:** The `/onboarding/{submissionId}/{allPaths=**}` rule grants `allow read: if isAuthenticated();` and `allow write: if isAuthenticated() && isValidUpload();`. Because `ensureAuthenticated()` (`src/firebase/config.ts:97-105`) signs every public visitor in via Firebase Anonymous Auth, any anonymous user can list, download, overwrite, or delete any applicant's Aadhaar, PAN, or bank documents under `/onboarding/**` (note: in Firebase Storage rules, `write` includes `create`, `update`, and `delete`, and `isValidUpload()` returns `true` when `request.resource == null` on line 12, explicitly permitting deletions!).


* **Unauthenticated Record Access & Tampering via `hasActiveCorrectionToken` (`firestore.rules:146-151, 185, 191, 214, 226` — Critical):**
* **Root Cause:** `hasActiveCorrectionToken(resource.data)` only checks whether the target `employees` or `onboarding_submissions` document has a non-null `activeCorrectionToken` pointing to a pending, non-expired `correction_requests` doc. It does **not** verify `isAuthenticated()`, nor does it restrict which fields can be modified in `allow update`. While an employee or applicant has a pending correction request, **anyone on the internet** who knows or guesses their `employeeId` or `submissionId` can `get` their full record and `update` any field on it (including `passwordHash`, `status`, or `uid`).


* **Self-Approval Privilege Escalation on `onboarding_submissions` (`firestore.rules:226-227` — High):**
* **Root Cause:** Line 227 grants `allow update: if ... (isAuthenticated() && (resource.id == request.auth.uid || resource.data.uid == request.auth.uid || resource.data.linkedUid == request.auth.uid))` without restricting `affectedKeys()`. A candidate can update their own submission document directly from the browser console to set `status: 'Approved'`, `employeeId: 'HY100001'`, and `passwordHash`. Since `employeeLogin` (`functions/index.js:534-540`) authenticates against `onboarding_submissions` where `status == 'Approved'`, the applicant can immediately log in as an approved employee without HR approval.


* **Insecure Draft Access & Deletion (`firestore.rules:232-242` — Critical):**
* **Root Cause:** `match /draft_submissions/{id}` sets `allow get: if true;` and `allow create, update, delete: if isAuthenticated();`. Furthermore, `getNextSubmissionId()` (`src/services/employeeService.ts:483-508`) generates draft IDs using `UDF-YYYYMM-XXXX` where `XXXX` is a 4-character base-36 string (`Math.random().toString(36).substring(2, 6).toUpperCase()`, keyspace of $36^4 = 1,679,616$). Anyone can brute-force or read draft IDs without authentication and overwrite or delete any applicant's draft.


* **Cross-Site Data Exposure in `firestore.rules` (`firestore.rules:164, 171, 177, 187, 216, 246, 275, 304` — Medium/High):**
* **Root Cause:** While `allow get` on `employees` and `onboarding_submissions` checks `canStaffViewSite(...)`, `allow list` on lines 187 and 216 only checks `if isAdmin()`! Any site supervisor or field officer (who is in `staff_accounts` and therefore satisfies `isAdmin()`) can run a collection-wide `getDocs(collection(db, 'employees'))` or `onboarding_submissions` query and bypass site restrictions completely. Similarly, `leave_requests`, `account_updates`, and `resignations` allow `read: if isAdmin()` without site scoping, and `resignations` (`firestore.rules:319-326`) allows **any** `isAdmin()` to approve/reject resignations regardless of `hasPermission('RESIGNATIONS_APPROVE')`.


* **Notification & Audit Log Spoofing (`firestore.rules:351, 362` — High):**
* **Root Cause:** Both `notifications` and `audit_logs` have `allow create: if isAuthenticated();` with no schema validation or `actorId == request.auth.uid` enforcement. Any anonymous user can flood admin notifications (`targetUserId: 'all_admins'`) or forge audit log entries.



#### Role Isolation & Session Hijacking

* **Client-Side `portalType` Manipulation (`src/context/AuthContext.tsx:40-76`, `src/routes/AppRoutes.tsx:256-262`):**
* **Root Cause:** `AuthContext` relies on `localStorage.getItem('portalType')` to decide which collection (`employees` vs. `users`/`staff_accounts`) to query. While `AuthGuard` (`src/components/guards/AuthGuard.tsx:34`) checks `allowedUserTypes`, if an authenticated user without a profile logs in when `portalType` is unset, `AuthContext.tsx:84-89` resolves them as `UserType.PUBLIC` with `roleId: 'guest'`. In `DataContext.tsx:480`, the check is `(user as any).type !== 'Guest'`, whereas `UserType.PUBLIC` equals `'Public'` (`types.ts`), causing `DataContext` to subscribe a `Public` user to the `roles` collection!


* **Account Linking Takeover via `employees` Update Rule (`firestore.rules:201-206`):**
* **Root Cause:** Line 205 allows an authenticated user to claim an employee record by updating `uid` if `resource.data.get('email', '') == request.auth.token.email`, without checking `request.auth.token.email_verified == true`.



#### Sensitive Data & API Keys

* **Plaintext Aadhaar PDF Password Stored in Firestore (`components/EmployeeFormPage.tsx:1521-1523` — High):**
* **Root Cause:** When an applicant unlocks an encrypted e-Aadhaar PDF, `processAadhaarFile` sets `updates['originalAadhaarPassword'] = password;`, which is saved in plaintext into `draft_submissions` and `onboarding_submissions`.


* **Hardcoded Identifiers & Public File Sharing in Google Apps Script (`GOOGLE_APPS_SCRIPT_v7.2.js:7-10, 151, 168` & `scripts/test-drive-connection.js:1` — High):**
* **Root Cause:** `GOOGLE_APPS_SCRIPT_v7.2.js` hardcodes `ROOT_FOLDER_ID`, `FIREBASE_API_KEY`, and `FORM_ID`, and `scripts/test-drive-connection.js` hardcodes the live Apps Script deployment URL (`[https://script.google.com/macros/s/AKfycbw.../exec](https://script.google.com/macros/s/AKfycbw.../exec)`). Worse, line 168 of `GOOGLE_APPS_SCRIPT_v7.2.js` executes `file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);` on every uploaded employee identity document, making sensitive PII links publicly accessible without authentication, and line 81 of `verifyViaApi` only checks `users/{uid}` for `role-super-admin` (ignoring `staff_accounts/{uid}`). Additionally, line 151 checks `data.uniqueId.startsWith('SUB-')` to decide between `Pending Employees` and `Active Employees`, but modern submissions use `UDF-` (`getNextSubmissionId`), so all new unapproved applicant folders are created directly inside `Active Employees`!



### 2. Onboarding & Multi-Step Form Submission Flaws

#### Validation & Duplicate Checking (`employeeService.ts` & `authService.ts`)

* **Uniqueness Check Fails Open (`src/services/authService.ts:271-294`):**
* **Root Cause:** `checkEmailUniquenessGlobal` catches any Cloud Function error (including network drops, rate limits, or missing indexes) on line 287 and returns `true` ("unique"). Worse, in `functions/index.js:55-58`, `checkGlobalUniqueness` queries `employees` by `profileData.personalDetails.email`, whereas form submissions store fields keyed by UUID (e.g., `formData[emailFieldUuid]`) and never populate `profileData.personalDetails.email` or top-level `email` on `onboarding_submissions` (`src/services/employeeService.ts:878-904` never sets top-level `email: applicantEmail`!). Thus, `checkGlobalUniqueness` misses almost all manual email submissions!


* **Client-Side Duplicate Check Fails Silently for Guests (`src/services/employeeService.ts:521-650, 858`):**
* **Root Cause:** `submitEmployeeForm` calls `checkApplicantDuplicates` on line 858 **from the applicant's browser**. Under `firestore.rules:187-190` and `216-224`, an anonymous/guest applicant (or new Google applicant) is only allowed to `list` documents in `employees` and `onboarding_submissions` where `uid == request.auth.uid`. When `checkApplicantDuplicates` queries `where('aadhaarNumber', '==', cleanVal)` across `employees` or `onboarding_submissions`, Firestore immediately throws ` permission-denied`! The `catch (err)` block at `employeeService.ts:647` swallows the error and returns `{ isDuplicate: false }`, meaning **every applicant-side duplicate check during form submission silently fails open** and records `duplicateCheck: { isDuplicate: false }` in Firestore!



#### File Upload Integrity (`EmployeeFileUploadField.tsx`, `storageService.ts`, `driveService.ts`)

* **Split Storage Folders Between First Upload and First Auto-Save (`src/services/storageService.ts:187-220` & `employeeService.ts:1645-1680`):**
* **Root Cause:** When an applicant uploads a file in `EmployeeFileUploadField.tsx:167`, `uploadSubmissionDocument` checks `sessionStorage.getItem('onboarding_savedDraftId')` (`storageService.ts:205`). If the applicant uploads a file (or uses Aadhaar Quick Apply before a draft ID exists) *before* the 1.5s auto-save timer fires, `folderName` falls back to `uid` (the anonymous or Google UID), storing the file at `onboarding/{uid}/{fieldId}/{file}`. Once auto-save runs, `onboarding_savedDraftId` becomes `UDF-YYYYMM-XXXX`, so subsequent files are uploaded to `onboarding/UDF-YYYYMM-XXXX/{fieldId}/{file}`.
* **Downstream Impact:** Upon final approval (`employeeService.ts:1645-1680`), `updateSubmissionStatus` only moves `oldStoragePath = onboarding/${data.linkedUid || submissionId}` to `employees/${submissionId}/joining`! Any files uploaded under `onboarding/${submissionId}` (when `linkedUid` is set) or under the old anonymous `uid` are **never moved** to `employees/${submissionId}/joining`, and their paths in `updatedProfileData` are not rewritten, resulting in broken document links post-approval.


* **Orphaned Storage Files on Re-Upload / Remove (`components/employeeFormFields/EmployeeFileUploadField.tsx:459-473`):**
* **Root Cause:** Clicking "Remove" on an uploaded file only calls `onChange(field.id, null)` in React state without deleting the blob from Firebase Storage or removing it from `fileSessionStore` if `value` was already a storage path string.


* **Detached Background Drive Sync Lost on Sign-Out/Tab Close (`src/services/employeeService.ts:977-985` & `EmployeeFormPage.tsx:1902`):**
* **Root Cause:** `submitEmployeeForm` schedules `syncDriveFolder(submissionId)` inside a `setTimeout(..., 100)` and immediately returns `submissionId`. `EmployeeFormPage.tsx:1902` then waits 400ms and calls `await signOut(auth)`! Signing out destroys `auth.currentUser` while `syncDriveFolder` is still downloading blobs from Firebase Storage and calling `callAppsScript` (which calls `ensureAuthenticated()` and generates a brand-new anonymous user token that lacks ownership permission in `GOOGLE_APPS_SCRIPT_v7.2.js:128-135` and `firestore.rules:226` to update `driveBackupStatus: 'completed'`).



#### Cloud Drafts & Conflicts

* **Cross-Applicant Draft Hijacking on Guest Session Adoption (`src/services/employeeService.ts:127-140`):**
* **Root Cause:** In `getFormDraft(draftId)`, if any guest user queries a `draftId` (or guesses the 4-char suffix) and `!data.isGoogleDraft`, lines 130-136 immediately execute `updateDoc(doc(db, DRAFTS_COLLECTION, snap.id), { ownerUid: user.uid })`, stealing ownership of the draft from the original active applicant!


* **Stale Closure Overwrite in Auto-Save (`components/EmployeeFormPage.tsx:353-417`):**
* **Root Cause:** `savedDraftId` is read inside the `setTimeout` callback (line 386) and in the `APPLICATION_ALREADY_SUBMITTED` catch block (line 397), but `savedDraftId` is omitted from the `useEffect` dependency array on line 417. Furthermore, if `isSavingRef.current` is `true` when the user types a new character, line 365 (`if (isSavingRef.current) return;`) aborts setting a new debounce timer; when the in-flight save finishes, no new timer is scheduled, leaving the user's latest keystrokes unsaved until they type again.



### 3. Backend Cloud Functions & Async Integrity (`functions/index.js`)

* **Missing Rate Limiting & Auth Checks on Password Endpoints (`functions/index.js:1038-1147`):**
* **Root Cause:** `verifyEmployeePassword` (line 1038) and `unlinkEmployeeGoogleAccount` (line 1092) do **not** call `checkAndIncrementFailedAttempts(db, ...)`, nor do they check `request.auth`. An attacker can brute-force any employee's password at high speed via `verifyEmployeePassword` even when `employeeLogin` has locked `login_${employeeId}`, and once found, can unlink their Google account.


* **Unverified Google UID Spoofing in `selfLinkGoogleAccount` (`functions/index.js:1236-1256`):**
* **Root Cause:** `selfLinkGoogleAccount` only verifies `request.data.googleIdToken` `if (request.data.googleIdToken)` (line 1240). If a caller omits `googleIdToken` and passes arbitrary `googleUid` and `email` in `request.data`, the function skips cryptographic verification and links the caller's employee profile to the victim's `googleUid` and `email`.


* **Non-Atomic Rate Limiting & Referral Counters (`functions/index.js:328-351`, `employeeService.ts:1774-1785, 4906-4923`):**
* **Root Cause:** `checkAndIncrementFailedAttempts` performs a non-transactional `get()` followed by `set()`. Parallel requests read the same `count: 0` and never trigger the 3-attempt lockout. Similarly, `incrementReferralClicks`, `incrementReferralStarts`, and `joined` count updates read the document and write `clicks + 1` instead of using `increment(1)`.


* **Incomplete Staff Uniqueness Check in `createStaffUser` (`functions/index.js:155-163`):**
* **Root Cause:** `createStaffUser` checks `db.collection('employees').where('email', '==', normalizedEmail)`, but employee emails are stored under `linkedGoogleEmail` or form field UUIDs, not top-level `email`, allowing duplicate staff/employee emails. Also, `adminControlEmployeeAuth` (`reset_to_default`, line 1493) still writes plaintext `mockPassword: defaultPassword` to Firestore!



### 4. State Management & Real-Time Sync (`DataContext.tsx`, `App.tsx`)

* **Unsubscribed Firestore Listener Memory Leak (`src/contexts/DataContext.tsx:425-440`):**
* **Root Cause:** Inside `onSnapshot(empQuery, ...)` (lines 430 and 436), when `snap.empty` is true or an error occurs, `DataContext` calls `subscribeToEmployeeByUid(firebaseUid || user.id, ...)` **without storing or returning its unsubscribe function**. Every snapshot emission where `empQuery` is empty spawns 3 new permanent `onSnapshot` listeners (`unsubDoc`, `unsubUid`, `unsubEmail` inside `subscribeToEmployeeByUid`) that leak for the lifetime of the browser tab.


* **Redundant Duplicate Subscriptions Across `DataContext.tsx` and `App.tsx`:**
* **Root Cause:** When an employee logs in, **both** `DataContext.tsx:423-455` and `App.tsx:914-926, 998-1006` call `subscribeToEmployeeByUid` and `subscribeToSubmissionsByUid`, doubling Firestore read billing and causing competing `setEmployees` / `setSubmittedForms` state updates.


* **Dual Conflicting `leaveBalances` Computations (`DataContext.tsx:157-205` vs `App.tsx:930-972`):**
* **Root Cause:** `DataContext.tsx:157` computes `leaveBalances` via `useMemo` (keyed by `lt.label`, e.g., `'Casual Leave'`) and makes `setLeaveBalances` a no-op (`DataContext.tsx:207`). Meanwhile, `App.tsx:930-972` runs a `useEffect` that computes a different `leaveBalances` structure (keyed by `lt.typeId` with `remaining`) and calls the no-op `setLeaveBalances(balances)`.


* **Unmemoized `adminProps`, `employeeProps`, and `DataContext` `value` (`DataContext.tsx:614`, `App.tsx:2154, 2353`):**
* **Root Cause:** `DataContext.tsx:614` constructs a new `value` object on every render without `useMemo`, and `App.tsx` reconstructs `adminProps` and `employeeProps` on every keystroke (e.g., when typing `adminUsername` or `adminPassword`), re-rendering the entire component tree.



### 5. Universal Recycle Bin & Data Life-Cycle (`recycleBinService.ts`, `employeeService.ts`, `functions/index.js`)

* **Split-Brain Soft Delete Architecture (`employeeService.ts:2170-2275` vs `recycleBinService.ts:31-61`):**
* **Root Cause:** Sites, Staff, Designations, and Vacancies call `moveToRecycleBin(...)` to create documents in the `recycle_bin` collection (viewed in `AdminRecycleBinPage.tsx`). However, `softDeleteEmployee` (`employeeService.ts:2213`) and `softDeleteSubmission` (`employeeService.ts:2170`) **never call `moveToRecycleBin**`! As a result, deleted employees and submissions **never appear** in the Universal Recycle Bin UI (`AdminRecycleBinPage.tsx` always shows `0` Deleted Employees).


* **Broken Employee Restore in `recycleBinService.ts` (`src/services/recycleBinService.ts:136-145`):**
* **Root Cause:** If an employee item ever is restored via `restoreFromRecycleBin`, lines 139-144 only update `{ isDeleted: false, deletedAt: null, status: 'Active' }` — they **fail to set `isActive: true**`, fail to clear `deletedAt` using `deleteField()` (breaking `where("deletedAt", ">=", "0")` or `!emp.deletedAt` checks), and fail to restore the linked `onboarding_submissions` document!


* **Broken Staff Account Restore (`src/services/recycleBinService.ts:124-134` & `AdminStaffManagementPage.tsx:535-605`):**
* **Root Cause:** Deleting a staff member calls the `deleteStaffUser` Cloud Function (`functions/index.js:235`), which permanently deletes their Firebase Auth user (`admin.auth().deleteUser(uid)`) and unassigns their `supervisorId` from all sites and employees. Restoring the staff item from `recycle_bin` (`recycleBinService.ts:126-133`) only writes the Firestore document back to `staff_accounts` — their Firebase Auth account remains deleted (so they can never log in with email/password), and their site/employee supervisor links are never restored!


* **Incomplete 30-Day Cron Job (`functions/index.js:1794-1980`):**
* **Root Cause:**
1. `autoDeleteRecycleBin` only queries `employees` and `onboarding_submissions` for `deletedAt <= thirtyDaysAgoIso`; it **never queries or cleans up the `recycle_bin` collection itself**, so `recycle_bin` items (`SITE`, `STAFF`, `VACANCY`, `DESIGNATION`) remain in Firestore forever past their `expiresAt` date.
2. In `performHardDelete` (`functions/index.js:1880-1892`), deleting an employee only wipes `employees/${docSnap.id}/` in Storage, missing `employees/${data.employeeId}/`, `onboarding/${docSnap.id}/`, and `users/${docSnap.id}/`.
3. `deleteAssociated` (`functions/index.js:1895-1903`) only cleans 5 collections (`leave_requests`, `account_updates`, `resignations`, `disciplinary_actions`, `_auth_attempts`) by `employeeId == uniqueId`, missing `attendance`, `user_engagement`, `complaints`, `reward_redemptions`, `bgv_records`, `correction_requests`, `notifications`, and `leave_balances`, as well as records keyed by `data.employeeId` (e.g., `HY123456`) when `uniqueId` is `UDF-...`!





### Logic Edge Cases (Where Valid Users Get Blocked or See Errors)

1. **Approved Employees Re-Applying or Re-Claiming Blocked by Uniqueness Checks (`functions/index.js:101-106`):**
* In `checkGlobalUniqueness` (`functions/index.js:102`), an employee record is considered a conflict whenever `!doc.data().deletedAt`, **even if `isRelieved === true` or `isActive === false**`. Thus, an ex-employee who left the company and tries to re-apply using their email or Google account is hard-blocked at step 0 (`"This email address is already registered in our system"`) before the rehire detection (`EX_EMPLOYEE_REHIRE`) in `checkApplicantDuplicates` can even run!


2. **Legacy Profile Claim Case-Sensitivity Trap (`functions/index.js:2005, 2049-2053`):**
* Unlike `employeeLogin` (which normalizes `employeeId.trim().toUpperCase()`), `claimEmployeeProfile` only does `String(employeeId).trim()` without `.toUpperCase()`. If a legacy guard enters `hy123456` instead of `HY123456`, the query returns empty and blocks them with `"No unclaimed profile found"`.


3. **Employee Password Change Blocked for Users with Legacy `mockPassword` (`functions/index.js:878-886`):**
* If an employee's password was reset to default by an admin (`adminControlEmployeeAuth` -> `reset_to_default`) or imported via bulk import with only `mockPassword`, and they call `changeEmployeePassword` before logging out and back in, `changeEmployeePassword` ignores `mockPassword` and rejects their current password.


4. **Data Correction Link Fails for Employees Logging In with Employee ID (`components/employee/DataCorrectionPage.tsx:235-237`):**
* Line 237 checks `authUser.id === requestDoc.targetId`. For self-onboarded employees, `requestDoc.targetId` can be their `employeeId` (`HY...`) while `authUser.id` is their Firebase UID / Portal ID (`UDF-...`), causing `isIdentityVerified` to evaluate to `false` even when the right employee is logged in.


5. **Firestore Compound Query Crash in `getPaginatedEmployees` (`src/services/employeeService.ts:1238-1298`):**
* When an admin searches by a field (`where(searchPath, ">=", term)`) while `viewMode === 'RECYCLE_BIN'` (`where("deletedAt", ">=", "0"), orderBy("deletedAt", "desc")`), Firestore throws an invalid query error because range filters on two different fields require a composite index and matching first `orderBy`. The fallback query at line 1305 drops `deletedAt` and only fetches `pageSize * 3` random matching employees, missing actual Recycle Bin records.



### Recommended Production Improvements (Defensive Code Patches)

#### Fix 1: Lock Down `storage.rules` & `firestore.rules` (Fixes SEC-01, SEC-02, SEC-03, SEC-06)

In `storage.rules` (lines 86–92), replace the wide-open `/onboarding/{submissionId}` wildcard with strict owner/admin verification:

```protobuf
    // storage.rules: Replace lines 86-92
    match /onboarding/{submissionId} {
      match /{allPaths=**} {
        allow read: if isAuthenticated() && (
          request.auth.uid == submissionId ||
          isAdmin() ||
          isOnboardingOwner(submissionId)
        );
        allow write: if isAuthenticated() && isValidUpload() && (
          request.auth.uid == submissionId ||
          isAdmin() ||
          isOnboardingOwner(submissionId)
        );
      }
    }

```

In `firestore.rules`, restrict `hasActiveCorrectionToken` updates, lock down `onboarding_submissions` self-updates to non-privileged fields, and enforce ownership on `draft_submissions`:

```protobuf
    // firestore.rules: Replace lines 225-242
    allow create: if isAuthenticated() &&
      request.resource.data.status == 'Pending Review' &&
      request.resource.data.get('currentLevel', 1) == 1;

    allow update: if hasPermission('SUBMISSIONS_APPROVE') || isSuperAdmin()
      || (isAuthenticated() && hasActiveCorrectionToken(resource.data) &&
          !request.resource.data.diff(resource.data).affectedKeys()
            .hasAny(['status', 'currentLevel', 'employeeId', 'passwordHash', 'approvalHistory', 'roleId']))
      || (isAuthenticated() &&
          (resource.id == request.auth.uid || resource.data.get('uid', '') == request.auth.uid || resource.data.get('linkedUid', '') == request.auth.uid) &&
          resource.data.status == 'Pending Review' &&
          !request.resource.data.diff(resource.data).affectedKeys()
            .hasAny(['status', 'currentLevel', 'employeeId', 'approvalHistory']));

    match /draft_submissions/{id} {
      allow get: if isAuthenticated() && (
        isAdmin() ||
        resource == null ||
        resource.data.ownerUid == request.auth.uid ||
        !resource.data.get('isGoogleDraft', false) ||
        (request.auth.token.get('email', '') != '' && resource.data.ownerEmail == request.auth.token.email)
      );
      allow list: if isAdmin() || (isAuthenticated() && (
        resource.data.ownerUid == request.auth.uid ||
        (resource.data.ownerEmail != null && resource.data.ownerEmail == request.auth.token.email)
      ));
      allow create: if isAuthenticated() && request.resource.data.ownerUid == request.auth.uid;
      allow update, delete: if isAdmin() || (isAuthenticated() && (
        resource.data.ownerUid == request.auth.uid ||
        (!resource.data.get('isGoogleDraft', false) && request.resource.data.ownerUid == request.auth.uid)
      ));
    }

```

#### Fix 2: Atomic Transactions, Rate-Limiting & Token Verification in `functions/index.js` (Fixes SEC-04, SEC-05, CF-01)

Update `checkAndIncrementFailedAttempts` (`functions/index.js:328-351`) to use a Firestore Transaction, add rate-limiting to `verifyEmployeePassword` and `unlinkEmployeeGoogleAccount`, and require `googleIdToken` in `selfLinkGoogleAccount`:

```javascript
// functions/index.js: Transactional rate limiter (replaces lines 328-351)
async function checkAndIncrementFailedAttempts(db, key) {
    const attemptsRef = db.collection('_auth_attempts').doc(key);
    const LOCK_DURATION_MS = 60 * 60 * 1000;
    const MAX_ATTEMPTS = 3;

    return await db.runTransaction(async (tx) => {
        const docSnap = await tx.get(attemptsRef);
        const now = Date.now();
        if (docSnap.exists) {
            const data = docSnap.data();
            if (data.lockedUntil && data.lockedUntil > now) {
                return true;
            }
            const nextCount = (data.lockedUntil && data.lockedUntil <= now) ? 1 : (data.count || 0) + 1;
            tx.set(attemptsRef, {
                count: nextCount,
                lockedUntil: nextCount >= MAX_ATTEMPTS ? now + LOCK_DURATION_MS : null,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            return false;
        }
        tx.set(attemptsRef, { count: 1, lockedUntil: null, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        return false;
    });
}

// functions/index.js: Enforce cryptographic token verification in selfLinkGoogleAccount (lines 1236-1256)
if (!request.data.googleIdToken) {
    throw new functions.https.HttpsError('invalid-argument', 'A valid googleIdToken is required to link a Google account.');
}
const decodedToken = await admin.auth().verifyIdToken(request.data.googleIdToken);
const googleUid = decodedToken.uid;
const email = decodedToken.email;

```

#### Fix 3: Eliminate Listener Leaks & Memoize Context in `DataContext.tsx` (Fixes STATE-01)

In `src/contexts/DataContext.tsx` (lines 423–447), track nested fallback listeners and memoize the context provider value:

```tsx
// src/contexts/DataContext.tsx: Replace lines 423-447
let unsubFallbackEmployee = () => {};
if (employeeId) {
    const empQuery = query(collection(db, 'employees'), where('employeeId', '==', employeeId));
    unsubEmployees = onSnapshot(empQuery, (snap) => {
        unsubFallbackEmployee();
        if (!snap.empty) {
            const docSnap = snap.docs[0];
            setEmployees([{ id: docSnap.id, ...docSnap.data() } as unknown as FirestoreEmployee]);
        } else {
            unsubFallbackEmployee = subscribeToEmployeeByUid(firebaseUid || user.id, (emp) => {
                if (emp) setEmployees([emp]);
            });
        }
    }, () => {
        unsubFallbackEmployee();
        unsubFallbackEmployee = subscribeToEmployeeByUid(firebaseUid || user.id, (emp) => {
            if (emp) setEmployees([emp]);
        });
    });
} else {
    unsubEmployees = subscribeToEmployeeByUid(firebaseUid || user.id, (emp) => {
        if (emp) setEmployees([emp]);
    });
}
// Ensure cleanup calls both unsubEmployees() and unsubFallbackEmployee()

```

#### Fix 4: Unify Recycle Bin & Storage Folder Migration (Fixes ONB-02, BIN-01)

1. **Consistent Storage Folder Consolidation (`src/services/employeeService.ts:1645-1686`):** During `updateSubmissionStatus` when `status === 'Approved'`, migrate files from **both** `onboarding/${submissionId}` and `onboarding/${data.linkedUid}` (if distinct) into `employees/${submissionId}/joining`, and rewrite any prefix matching either `onboarding/${submissionId}` or `onboarding/${data.linkedUid}` in `updatedProfileData`.
2. **Unified Recycle Bin Integration (`src/services/recycleBinService.ts:136-145` & `employeeService.ts:2213`):** Call `moveToRecycleBin({ itemType: 'EMPLOYEE', ... })` inside `softDeleteEmployee`, and fix `restoreFromRecycleBin` for `'EMPLOYEE'` to call `await restoreEmployee(originalId)` so `isActive: true`, `deletedAt: deleteField()`, and the linked `onboarding_submissions` record are all restored atomically.



remeber that you should not change  any thing you will analyse the code and check if it present and make a repot like fininds of all ok do not change anything 
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-10-14T15:39:34+05:30.

The user's current state is as follows:
Active Document: z:\HR PORTAL\.env.local (LANGUAGE_UNSPECIFIED)
Cursor is on line: 1
Other open documents:
- z:\HR PORTAL\.env.example (LANGUAGE_UNSPECIFIED)
- z:\HR PORTAL\.env.employee (LANGUAGE_UNSPECIFIED)
- z:\HR PORTAL\.env.admin (LANGUAGE_UNSPECIFIED)
- z:\HR PORTAL\.env (LANGUAGE_UNSPECIFIED)
- z:\UDF_SUBDOMAINS\.gitignore (LANGUAGE_UNSPECIFIED)
</ADDITIONAL_METADATA>



================================================================================
## ARGON AUDIT INPUT - STEP 2617 (2026-10-14T10:28:31Z)
================================================================================

<USER_REQUEST>
There are **14 additional vulnerabilities, logic bugs, and architectural edge cases** across the secondary services, utilities, and feature modules (`bgvService.ts`, `engagementService.ts`, `bulkImportUtils.ts`, `exportUtils.ts`, `sanitizeHtml.ts`, `workflowHelper.ts`, `SecuritySettingsModal.tsx`, `AttendanceCalendar.tsx`, `AdminInvitesPage.tsx`, and `blogService.ts`).

### Wave 2 Audit Summary Matrix

| ID | Severity | File & Line Numbers | Vulnerability / Bug Summary |
| --- | --- | --- | --- |
| **BGV-01** | **Critical** | `src/services/bgvService.ts:347-355, 399-408`<br>

<br>`storage.rules:114-131` | BGV vendor uploads fail with `storage/unauthorized`, use badge IDs instead of doc IDs, and store permanent public download URLs (`getDownloadURL`). |
| **GAM-01** | **Critical** | `firestore.rules:475-478, 495-499`<br>

<br>`src/services/engagementService.ts:372-393` | Employees can mint infinite gamification points (`+50` per request in a loop) and redeem rewards without deducting points or verifying balances. |
| **IMP-01** | **High** | `src/utils/bulkImportUtils.ts:592-593, 922-953`<br>

<br>`src/services/employeeService.ts:530-574` | Bulk-imported employees omit top-level statutory fields (`aadhaarNumber`, `panNumber`, `uanNumber`, `phoneNumber`), making them invisible to duplicate checks. |
| **EXP-01** | **High** | `utils/exportUtils.ts:65-77, 81-94` | Sensitive field masking misses `'aadhar'` (single `a`), `'uan'`, and `'esic'`, leaking unmasked PII in exports; CSV export is also vulnerable to formula injection. |
| **AUTH-02** | **High** | `components/employee/SecuritySettingsModal.tsx:74-88`<br>

<br>`functions/index.js:984-1026, 1132-1137` | Changing a linked Google account unlinks the existing account and deletes `uid` *before* the new Google popup completes, breaking active sessions if canceled. |
| **WF-01** | **High** | `src/utils/workflowHelper.ts:12, 67-85` | `isRoleAssignedToSite` returns `false` when `site` is undefined before checking `SCOPE_ALL` permissions, auto-escalating unassigned-site requests to Super Admin. |
| **BLOG-01** | **High** | `firestore.rules:502-505`<br>

<br>`src/services/blogService.ts:23-29` | Private SOPs/training posts (`isPrivate: true`) only check `isAuthenticated()`, exposing internal documents to every anonymous visitor. |
| **CMP-01** | **High** | `firestore.rules:489-493`<br>

<br>`components/employee/EmployeeEngagementHub.tsx:277` | "Confidential" HR complaints are readable by any staff account (`isAdmin()`), exposing whistleblower complaints to the supervisors they report. |
| **INV-01** | **Medium** | `components/AdminInvitesPage.tsx:500`<br>

<br>`src/services/employeeService.ts:838-850`<br>

<br>`firestore.rules:447-449` | Single-use referral invites (`isReusable: false`) are never marked `'Used'` or blocked after submission, and counters can be arbitrarily overwritten. |
| **GAM-02** | **Medium** | `components/employee/EmployeeEngagementHub.tsx:57-71`<br>

<br>`components/employee/AttendanceCalendar.tsx:107-143`<br>

<br>`src/services/engagementService.ts:260-264` | Marking attendance calls `updateOrCreateStreak` redundantly and awards `+5` points on every `'A' -> 'P'` toggle without server-side idempotency. |
| **XSS-01** | **Medium** | `src/utils/sanitizeHtml.ts:14, 21, 74-79` | `sanitizeHtml` permits raw inline `style` attributes and protocol-relative URLs (`//evil.com`), enabling CSS UI spoofing and external tracking pixels. |
| **BGV-02** | **Medium** | `components/AdminBgvManagementPage.tsx:124, 144-154` | Candidate photo `Blob` object URLs (`URL.createObjectURL`) cached in `photoBlobUrls` are never revoked on unmount, leaking browser memory. |
| **CLM-01** | **Low** | `components/employee/ProfileClaimPage.tsx:76-94` | Profile claim verification runs 3 sequential network round-trips and relies on client-supplied `employeeDocId` mapping without transactional lock. |
| **AUD-01** | **Low** | `src/services/auditService.ts:19-46`<br>

<br>`firestore.rules:385-388` | Any authenticated (including anonymous) client can insert forged entries into `audit_logs` with arbitrary `userId`, `userName`, and `action` values. |

### 1. Background Verification (BGV) & Storage Vulnerabilities

* **Broken Vendor Upload Permissions, Path Mismatch, and Public URL Leak (`BGV-01`)**
* **Location:** `src/services/bgvService.ts` (lines 261, 347–355, 399–408) and `storage.rules` (lines 114–131).
* **Root Cause:**
1. In `vendorSubmitBgvReport` (`bgvService.ts:347`), the report file is uploaded to `employees/${employeeId}/bgv/${timestamp}_bgv_report.${ext}`. However, `employeeId` in `BgvRequest` is the **badge ID** (e.g., `HY123456`, assigned on line 261), whereas `storage.rules:114` expects `{empId}` under `/employees/{empId}/...` to match the user's document/auth mapping, and only allows `isAdmin()` or the employee themselves to write. Even if `/bgv/{allPaths=**}` (`storage.rules:128-131`) were used, it restricts writes to `if isAdmin() && isValidUpload()`, which blocks external BGV vendors whose accounts reside in `bgv_vendors` rather than `staff_accounts`.
2. Both `vendorSubmitBgvReport` (line 350) and `staffDirectCompleteBgv` (line 402) call `getDownloadURL(fileRef)` and save the permanent public token URL in Firestore (`bgvDocumentUrl`), bypassing the authenticated `storage://` path architecture enforced in `storageService.ts`.


* **Fix:** Store `storage://bgv/${requestId}/${filename}` paths instead of calling `getDownloadURL`, and add a vendor storage rule checking `bgv_requests`:



```javascript
// storage.rules (replace match /bgv/{allPaths=**} at lines 128-131)
match /bgv/{requestId}/{fileName} {
  allow read: if isAdmin();
  allow write: if isValidUpload() && (
    isAdmin() ||
    (isAuthenticated() &&
     firestore.exists(/databases/(default)/documents/bgv_requests/$(requestId)) &&
     firestore.get(/databases/(default)/documents/bgv_requests/$(requestId)).data.vendorId == request.auth.uid)
  );
}

```

* **Unrevoked Blob URLs in BGV Management (`BGV-02`)**
* **Location:** `components/AdminBgvManagementPage.tsx` (lines 124, 144–154).
* **Root Cause:** `getSecureURL(selectedCandidate.photoUrl)` fetches a `Blob` and creates a `blob:` URL via `URL.createObjectURL`, storing it in `photoBlobUrls`. When the admin closes the page or switches views, those object URLs are never revoked via `URL.revokeObjectURL()`, retaining binary image blobs in browser memory for the lifetime of the tab.
* **Fix:** Track the ref map and revoke all created object URLs in a cleanup `useEffect` on unmount.



### 2. Gamification, Attendance & Engagement Exploits

* **Infinite Points Minting & Unchecked Reward Redemptions (`GAM-01`)**
* **Location:** `firestore.rules` (lines 475–478, 495–499) and `src/services/engagementService.ts` (lines 372–393).
* **Root Cause:**
1. `firestore.rules:476-477` allows any employee who owns `user_engagement/{id}` to call `updateDoc` directly from the browser as long as `request.resource.data.get('points', 0) <= resource.data.get('points', 0) + 50`. There is no timestamp or daily rate limit in the rule, allowing an employee to run a 20-line console loop to increment their points by `+50` hundreds of times per second.
2. `createRewardRedemption` (`engagementService.ts:372-393`) inserts a redemption document into `reward_redemptions` with `pointsSpent`, and `firestore.rules:496` only checks `isAuthenticated()`. Neither the client service nor Firestore rules verify that the employee has sufficient points in `user_engagement/{userId}`, nor do they deduct `pointsSpent` from the user's balance.


* **Fix:** Move point accrual and reward redemption into a Firestore Transaction (or Cloud Function) and enforce atomic balance deduction:



```typescript
// src/services/engagementService.ts (replace createRewardRedemption at lines 372-393)
export const createRewardRedemption = async (
  redemptionData: Omit<RewardRedemption, 'id' | 'requestedAt' | 'status'>
): Promise<string> => {
  const db = getFirebaseDb();
  if (!db) throw new Error('Firestore not initialized');

  const engagementRef = doc(db, 'user_engagement', redemptionData.userId);
  const redemptionRef = doc(collection(db, 'reward_redemptions'));

  await runTransaction(db, async (tx) => {
    const engSnap = await tx.get(engagementRef);
    const currentPoints = engSnap.exists() ? (engSnap.data().points || 0) : 0;
    if (currentPoints < redemptionData.pointsSpent) {
      throw new Error('Insufficient points balance for this reward.');
    }
    tx.update(engagementRef, {
      points: currentPoints - redemptionData.pointsSpent,
      updatedAt: new Date().toISOString(),
    });
    tx.set(redemptionRef, {
      ...redemptionData,
      status: 'pending',
      requestedAt: new Date().toISOString(),
    });
  });

  return redemptionRef.id;
};

```

* **Attendance Toggle Point Farming & Redundant Streak Writes (`GAM-02`)**
* **Location:** `components/employee/EmployeeEngagementHub.tsx` (lines 57–71), `components/employee/AttendanceCalendar.tsx` (lines 107–143), and `src/services/engagementService.ts` (lines 260–264).
* **Root Cause:** When an employee opens the Engagement Hub, `EmployeeEngagementHub.tsx:58` calls `updateOrCreateStreak(userId, userName)` on mount, setting `lastVisitDate = today`. When they click today's date in `AttendanceCalendar.tsx:107`, `markAttendanceForDate` (`engagementService.ts:263`) calls `updateOrCreateStreak` a second time, and then `AttendanceCalendar.tsx:113-141` manually adds `attendancePoints` (`+5` pts) whenever `newStatus === 'P'`. If a user toggles today's status from `'P'` to `'A'` (or `'L'`) and back to `'P'`, `AttendanceCalendar.tsx` awards `+5` points every time they switch back to `'P'`.
* **Fix:** Store `lastAttendancePointsDate: today` on `user_engagement/{userId}` and only award `attendancePoints` if `data.lastAttendancePointsDate !== today`.



### 3. Bulk Import, Export Masking & Referral Invite Flaws

* **Bulk Import Invisible to Duplicate Detection (`IMP-01`)**
* **Location:** `src/utils/bulkImportUtils.ts` (lines 592–593, 922–953) and `src/services/employeeService.ts` (lines 530–574).
* **Root Cause:**
1. When `bulkImportEmployees` (`bulkImportUtils.ts:922-953`) constructs `employeeData`, it places Aadhaar, PAN, UAN, and phone number inside nested `data` and `profileData` objects, but **never writes top-level `aadhaarNumber`, `panNumber`, `uanNumber`, or `phoneNumber` fields** on the `employees` document. Because `checkApplicantDuplicates` (`employeeService.ts:530-574`) queries `employees` using top-level `where('aadhaarNumber', '==', cleanVal)`, `where('panNumber', '==', cleanVal)`, and `where('phoneNumber', '==', cleanPhone)`, every bulk-imported employee is invisible to onboarding duplicate checks.
2. Conversely, `checkForDatabaseDuplicates` in `bulkImportUtils.ts:593` queries `onboarding_submissions` using `where("formData.personalDetails.phoneNumber", "in", chunkPhones)`, which does not exist on self-onboarded submissions (where phone is stored at top-level `phoneNumber` and `data['eb3617dc-9f1d-475d-a2db-005b6bc2500c']`).


* **Fix:** Populate normalized top-level statutory fields in `bulkImportEmployees` (`bulkImportUtils.ts:922`):



```typescript
// src/utils/bulkImportUtils.ts (add to employeeData at line 922)
const rawPhone = String(nestedData['eb3617dc-9f1d-475d-a2db-005b6bc2500c'] || '').replace(/\D/g, '').slice(-10);
const rawAadhaar = String(nestedData['aadhaarCardNo'] || '').replace(/\D/g, '');
const rawPan = String(nestedData['panCardNo'] || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
const rawUan = String(nestedData['uanNumber'] || '').replace(/\D/g, '');

const employeeData: Record<string, any> = {
  id: docRef.id,
  employeeId: empId,
  ...(rawPhone ? { phoneNumber: rawPhone } : {}),
  ...(rawAadhaar ? { aadhaarNumber: rawAadhaar } : {}),
  ...(rawPan ? { panNumber: rawPan } : {}),
  ...(rawUan ? { uanNumber: rawUan } : {}),
  // existing fields...
};

```

* **PII Masking Bypass & CSV Formula Injection in Exports (`EXP-01`)**
* **Location:** `utils/exportUtils.ts` (lines 65–77, 81–94).
* **Root Cause:**
1. `isSensitiveField` (`exportUtils.ts:65-69`) checks lowercase labels against `['mobile', 'phone', 'email', 'bank', 'account', 'aadhaar', 'pan', 'ifsc', 'salary', 'ctc', 'amount']`. However, in `EmployeeFormPage.tsx:76` and the default form schema, Aadhaar is spelled `'Aadhar Card No'` (with a single `'a'`), and UAN/ESIC fields are labeled `'UAN Number'` and `'ESIC Number'`. Because `'aadhar'`, `'uan'`, and `'esic'` are missing from `sensitiveKeywords`, staff without `VIEW_SENSITIVE_INFO` export unmasked Aadhaar, UAN, and ESIC numbers.
2. `exportToCSV` (`exportUtils.ts:87-91`) wraps strings in quotes (`"${str.replace(/"/g, '""')}"`) but does not neutralize leading spreadsheet formula triggers (`=`, `+`, `-`, `@`, `\t`, `\r`), allowing malicious applicant inputs (e.g., `=HYPERLINK(...)` or `=CMD|...`) to execute when opened in Excel.


* **Fix:** Add `'aadhar'`, `'uan'`, `'epfo'`, `'esic'`, and `'dob'` to `sensitiveKeywords`, and prefix formula-triggering characters with a single quote (`'`) in `exportToCSV`.


* **Single-Use Referral Links Never Marked as Used (`INV-01`)**
* **Location:** `components/AdminInvitesPage.tsx` (line 500), `src/services/employeeService.ts` (lines 838–850, 1774–1785), and `firestore.rules` (lines 447–449).
* **Root Cause:** `AdminInvitesPage` allows creating single-use invites (`isReusable: false`). However, when a candidate submits their form (`employeeService.ts:838-850`) or joins (`employeeService.ts:1774-1785`), the code only increments `started` / `joined` and never sets `status: 'Used'` when `isReusable === false`. Furthermore, `EmployeeFormPage.tsx` never blocks an invite with `status === 'Used'`.



### 4. Authentication, Workflow & Privacy Bugs

* **Premature Google Unlink Breaks Active Employee Session (`AUTH-02`)**
* **Location:** `components/employee/SecuritySettingsModal.tsx` (lines 74–88) and `functions/index.js` (lines 984–1026, 1132–1137).
* **Root Cause:**
1. When an employee selects **Change Google Account** (`activeTab === 'change_google'`), `SecuritySettingsModal.tsx:76` calls `await unlinkGoogleAccount(employeeId, currentPassword)` **before** calling `getGoogleCredentialSafely()` (line 80). If the user closes the Google popup or selects a Google account already linked elsewhere, their original Google account is already unlinked.
2. Worse, `unlinkEmployeeGoogleAccount` in `functions/index.js:1136` executes `uid: admin.firestore.FieldValue.delete()` on the employee's Firestore document. Deleting `uid` immediately invalidates the user's active session against `firestore.rules:188, 192` (`resource.data.get('uid', '') == request.auth.uid`).
3. Additionally, `linkEmployeeGoogleAccount` (`functions/index.js:984-1002`) uses an `if / else` branch that updates *only* `onboarding_submissions` if a matching document is found there, leaving the approved `employees` record without the updated `linkedGoogleEmail` and `uid`.


* **Fix:** Acquire the new Google credential via `getGoogleCredentialSafely()` *first*, pass it directly to `linkEmployeeGoogleAccount` (which should overwrite the previous `linkedGoogleEmail` atomically across both `onboarding_submissions` and `employees`), and never delete `uid` during unlink if the user is authenticated via custom token (`emp_${docId}`).


* **Workflow Auto-Escalation When `site` Is Undefined (`WF-01`)**
* **Location:** `src/utils/workflowHelper.ts` (lines 12, 67–85).
* **Root Cause:** In `isRoleAssignedToSite` (`workflowHelper.ts:12`), the guard `if (!site) return false;` runs **before** checking whether the role has global scope (`SUBMISSIONS_VIEW_SCOPE_ALL`, `JOINING_APPROVALS_SCOPE_ALL`, etc. on lines 15–27). When a submission or request has an unmapped or empty `siteId` (`site === undefined`), `getEffectiveApprovalLevel` (`workflowHelper.ts:67-85`) sees `isAssigned === false` for every intermediate role—even global HR Managers—and skips straight to `maxLevel` (Super Admin).
* **Fix:** Check global scope permissions (`*_SCOPE_ALL`) in `isRoleAssignedToSite` *before* returning `false` on `!site`:



```typescript
// src/utils/workflowHelper.ts (lines 6-29)
export const isRoleAssignedToSite = (
  role: RoleConfig | undefined,
  site: Site | undefined,
  moduleType: 'submissions' | 'leaves' | 'Joining' | 'profile_requests'
): boolean => {
  if (!role) return false;

  const perms = role.permissions || [];
  if (moduleType === 'submissions' && perms.includes(Permission.SUBMISSIONS_VIEW_SCOPE_ALL)) return true;
  if (moduleType === 'leaves' && perms.includes(Permission.LEAVES_SCOPE_ALL)) return true;
  if (moduleType === 'Joining' && perms.includes(Permission.JOINING_APPROVALS_SCOPE_ALL)) return true;
  if (moduleType === 'profile_requests' && perms.includes(Permission.PROFILE_REQUESTS_SCOPE_ALL)) return true;

  if (!site) return false;
  // site-specific assignment checks follow...

```

* **Private Blog Posts & Confidential Complaints Exposed (`BLOG-01` & `CMP-01`)**
* **Location:** `firestore.rules` (lines 489–493, 502–505) and `src/services/blogService.ts` (lines 23–29).
* **Root Cause:**
1. In `firestore.rules:503`, `blog_posts` allows read `if resource.data.get('isPrivate', false) != true || isAuthenticated();`. Because the portal signs every visitor in anonymously (`isAuthenticated() == true`), and `blogService.ts:23` checks `const isAuth = !!auth?.currentUser;`, anonymous public visitors can read all `isPrivate: true` internal SOPs and training posts. Change the rule and client check to disallow anonymous users (`request.auth.token.firebase.sign_in_provider != 'anonymous'`).
2. In `firestore.rules:490`, `match /complaints/{id}` grants `allow read: if isAdmin();`. Because `isAdmin()` returns `true` for every active document in `staff_accounts` (including basic site supervisors), any supervisor can query `complaints` and read "confidential" grievances (`EmployeeEngagementHub.tsx:277`) filed against them. Restrict `complaints` reads to HR/Super Admin roles or the submitting employee (`isOwnerOfPortalId(resource.data.get('userId', ''))`).




* **HTML Sanitizer CSS & Protocol-Relative URL Bypass (`XSS-01`)**
* **Location:** `src/utils/sanitizeHtml.ts` (lines 14, 21, 74–79).
* **Root Cause:** `ALLOWED_ATTRS` permits raw `style` attributes on all elements without filtering CSS properties (allowing `position: fixed; inset: 0; z-index: 99999` full-page phishing overlays or external `url(...)` beacons), and `SAFE_URL_PATTERN = /^(https?:\/\/|\/|#|mailto:|tel:)/i` matches protocol-relative URLs starting with `//` (e.g., `//attacker.example/payload`).
* **Fix:** Remove `'style'` from `ALLOWED_ATTRS` (use Tailwind utility classes instead) and tighten `SAFE_URL_PATTERN` to `/^(https?:\/\/|\/(?!\/)|#|mailto:|tel:)/i` so `//` is rejected.



Would you like me to generate a downloadable patch file or refactored source files for any of these modules?


here are  more do same analyusis and prepare same thing like i asked 
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-10-14T15:58:31+05:30.

The user's current state is as follows:
Active Document: z:\HR PORTAL\.env.local (LANGUAGE_UNSPECIFIED)
Cursor is on line: 1
Other open documents:
- z:\HR PORTAL\.env.example (LANGUAGE_UNSPECIFIED)
- z:\HR PORTAL\.env.employee (LANGUAGE_UNSPECIFIED)
- z:\HR PORTAL\.env.admin (LANGUAGE_UNSPECIFIED)
- z:\HR PORTAL\.env (LANGUAGE_UNSPECIFIED)
- z:\UDF_SUBDOMAINS\.gitignore (LANGUAGE_UNSPECIFIED)
</ADDITIONAL_METADATA>



================================================================================
## ARGON AUDIT INPUT - STEP 2651 (2026-10-14T10:35:46Z)
================================================================================

<USER_REQUEST>
again asked for new it gave this 
### Why Earlier Passes Missed These Files & Confirmation of 100% Coverage

In **Pass 1** (13 findings), I audited only the 11 core files explicitly tied to the five categories in your initial prompt (`firestore.rules`, `storage.rules`, `functions/index.js`, `employeeService.ts`, `authService.ts`, `storageService.ts`, `driveService.ts`, `recycleBinService.ts`, `DataContext.tsx`, `App.tsx`, and `EmployeeFormPage.tsx`). In **Pass 2** (14 findings), I expanded to the 20 secondary service, utility, and feature modules (`bgvService.ts`, `engagementService.ts`, `vacancyService.ts`, `auditService.ts`, `blogService.ts`, `websiteService.ts`, `googleAuthHelper.ts`, `sanitizeHtml.ts`, `workflowHelper.ts`, `bulkImportUtils.ts`, `exportUtils.ts`, `ProfileClaimPage.tsx`, `AdminInvitesPage.tsx`, `AdminBgvManagementPage.tsx`, and `SecuritySettingsModal.tsx`).

For this **Final Pass (Pass 3)**, I read every remaining file in the repository line by line — covering all remaining Admin & Employee Portal pages (`AdminReviewSubmissionsPage.tsx`, `AdminMasterEmployeeListPage.tsx`, `AdminPortalPage.tsx`, `AdminRoleManagementPage.tsx`, `AdminStaffManagementPage.tsx`, `AdminSiteManagementPage.tsx`, `DataCorrectionPage.tsx`, `EmployeeLeaveRequestPage.tsx`, `EmployeeAccountUpdatePage.tsx`, `EmployeeResignationPage.tsx`, `AdminLeaveManagementPage.tsx`, `AdminResignationManagementPage.tsx`, `AdminAccountUpdateManagementPage.tsx`, `AdminDisciplinaryPage.tsx`, `AdminGrievancesPage.tsx`, `AdminCorrectionRequestsPage.tsx`, `AdminDraftsManagementPage.tsx`, `AdminStaffProfilePage.tsx`, `AdminTimelineSearchPage.tsx`, `EmployeeTimelinePage.tsx`, `DocumentUploadWizard.tsx`, `LegacyClaimModal.tsx`), all remaining services/contexts/routes (`requestService.ts`, `adminService.ts`, `staffService.ts`, `siteService.ts`, `notificationService.ts`, `NotificationContext.tsx`, `AuthContext.tsx`, `AppRoutes.tsx`, `AuthGuard.tsx`, `SecureDocumentLink.tsx`), all utility/admin scripts (`scripts/*`, `src/utils/*`), and `GOOGLE_APPS_SCRIPT_v7.2.js`.

**100% of the files in the repository have now been audited.** Below are the **10 final findings** uncovered in the remaining files, followed by the **Master Consolidated Ledger of all 37 findings** across the entire codebase.

### Pass 3 Findings (Remaining Pages, Services, Scripts & Google Apps Script)

#### 1. `CORR-01` (Critical) — Client-Side-Only Identity Verification & Pre-Verification PII Leak on Correction Links

* **Location:** `components/employee/DataCorrectionPage.tsx` (lines 134–188, 259–320, 694–768) & `firestore.rules` (lines 108–124, 152–175, 229–238)
* **Root Cause:**
1. **Full PII Downloaded Before Verification:** When an unauthenticated visitor opens `/correct-details?token=<tokenId>`, `DataCorrectionPage.tsx:135` signs them in anonymously (`ensureAuthenticated()`), fetches `correction_requests/{token}` (line 137), and **immediately fetches the full target `employees/{targetId}` or `onboarding_submissions/{targetId}` document** (lines 157–177), storing all employee PII (Aadhaar, PAN, bank account number, phone, DOB, address, photos) in React state (`targetData` and `formData`) *before* the user ever enters their DOB or Mobile Number on the verification screen.
2. **Client-Side-Only Gate:** `handleGuestVerify` (lines 259–320) checks the user's entered DOB and last 4 phone digits in browser memory against `targetData` and simply flips a React state boolean (`setGuestVerified(true)`). `submitCorrectionResponse` (line 694) then writes directly to Firestore without any server-side check proving identity verification succeeded.


* **Fix:** Move token lookup and DOB/phone verification into a Firebase Cloud Function (`verifyAndLoadCorrectionTarget`) that verifies the last 4 phone digits and DOB server-side before returning only the fields listed in `request.requestedFields`, and submit correction responses through a Cloud Function rather than allowing anonymous direct reads/writes on `employees` and `onboarding_submissions`.

#### 2. `GAS-01` (Critical) — World-Readable Employee KYC Documents & Read-Equals-Write Authorization in Google Apps Script

* **Location:** `GOOGLE_APPS_SCRIPT_v7.2.js` (lines 68–78, 128–132, 168)
* **Root Cause:**
1. **Public Link Sharing on All Uploaded KYC Files:** Line 168 executes `file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);` on every uploaded file. Every employee Aadhaar card, PAN card, bank passbook, and photo stored via the Google Drive bridge is publicly readable by anyone on the internet who obtains or guesses the Drive link.
2. **Read Access Treated as Write Permission:** In `handleUpload` (lines 128–132), `checkFirestoreAccess(data.token, "employees", data.uniqueId)` performs a `GET` request to the Firestore REST API and grants Drive upload access if `response.getResponseCode() === 200`. Because `firestore.rules` allows any signed-in user to read `employees` (`SEC-01`), any authenticated user can upload arbitrary files into any employee's Google Drive folder.
3. **Incomplete SuperAdmin Lookup:** `verifyViaApi` (lines 68–78) checks `roleId === 'role-super-admin'` only on `/documents/users/${uid}`, ignoring `/documents/staff_accounts/${uid}` and Firebase Auth custom claims.


* **Fix:** Remove `file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)` so files inherit restricted folder permissions and are served only via authenticated proxy/signed flows, and verify write/admin permissions against `staff_accounts/{uid}` or custom claims before permitting `handleUpload`, `rename`, or `delete`.

```javascript
// GOOGLE_APPS_SCRIPT_v7.2.js — Remove public link sharing on line 168:
const file = targetFolder.createFile(blob);
// DO NOT set DriveApp.Access.ANYONE_WITH_LINK on sensitive KYC documents:
// file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

```

#### 3. `XSS-02` (High) — Stored DOM XSS in Printable Biodata Window

* **Location:** `components/AdminReviewSubmissionsPage.tsx` (lines 647–983)
* **Root Cause:** `handlePrintBiodata` opens a new window in the admin portal's origin (`const printWindow = window.open('', '_blank')`) and writes an HTML template via `printWindow.document.write(...)` that directly interpolates unescaped applicant-controlled strings (`name`, `marks`, `presentAddress`, `permanentAddress`, `experience`, `refName`, `refAddress`, `fatherName`, `motherName`, `photoUrl`, `recruitedByName`). If an applicant submits `<img src=x onerror="..."/>` or `<script>...</script>` in their address or experience field during onboarding, clicking **Print Biodata** executes arbitrary JavaScript inside the admin's browser origin with full access to the admin's active Firebase session.
* **Fix:** Escape all dynamic strings with an HTML-escaping helper before interpolating them into the `printWindow.document.write` template, and validate that `photoUrl` starts with `https://`, `blob:`, or `data:image/`.

```typescript
// Add at the top of handlePrintBiodata in components/AdminReviewSubmissionsPage.tsx:
const escapeHtml = (unsafe: unknown): string =>
  String(unsafe ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

```

#### 4. `REQ-01` (High) — Silent Upload Data Loss & Broken File Rendering in Employee Requests

* **Location:** `src/services/requestService.ts` (lines 18–35, 89–96, 126–133, 163–170), `components/AdminResignationManagementPage.tsx` (lines 206–211), & `components/employee/EmployeeLeaveRequestPage.tsx` (line 130)
* **Root Cause:**
1. **Silent `null` Swallowing on Upload Failure:** In `requestService.ts:26-29`, `uploadFilesInObject` wraps `uploadFile` in a `try/catch` that logs the error and sets `result[key] = null`. Furthermore, `addLeaveRequest` (line 90), `addAccountUpdateRequest` (line 127), and `addResignationRequest` (line 164) pass `request.employeeId` (which is the badge ID like `HY123456` or Firestore ID) as `folderId` to `uploadFile(..., 'employees', folderId, ...)`. When `storage.rules` rejects the upload (or network fails), the request is silently saved to Firestore with `document: null` / `supportingDoc: null` and the employee is told their request succeeded.
2. **Type Mismatch Breaks Resignation Document Viewing:** `uploadFilesInObject` replaces the `File` object with a `storage://...` string (line 24). However, `AdminResignationManagementPage.tsx:208` renders `{selectedRequest.document.name} (Uploaded)` — since `selectedRequest.document` is a string in Firestore, `.name` is `undefined` and there is no `<SecureDocumentLink>` for admins to actually view or download the resignation letter.
3. **Orphaned Leave Supporting Document Field:** `EmployeeLeaveRequestPage.tsx:130` submits `supportingDoc`, which is never declared on `LeaveRequest` in `types.ts` and never rendered in `AdminLeaveManagementPage.tsx`.


* **Fix:** Throw upload errors in `uploadFilesInObject` instead of silently setting `null`, and render `selectedRequest.document` and `selectedRequest.supportingDoc` using `<SecureDocumentLink>` in `AdminResignationManagementPage.tsx` and `AdminLeaveManagementPage.tsx`.

#### 5. `ROLE-01` (High) — Explicit Permission `DENY` Overrides Ignored in Admin Portal & Role Escalation Vectors

* **Location:** `components/AdminPortalPage.tsx` (lines 403–407), `components/AdminRoleManagementPage.tsx` (lines 655–662, 704–720), & `src/services/adminService.ts` (lines 98–127)
* **Root Cause:**
1. **Explicit `false` (DENY) Overrides Ignored in `AdminPortalPage.tsx`:** `AdminRoleManagementPage.tsx` allows setting per-user permission overrides to `true` (Grant), `false` (Deny), or `undefined` (Inherit). While `AdminMasterEmployeeListPage.tsx:148` checks `if (override !== undefined) return override;`, `AdminPortalPage.tsx:406` evaluates:
```ts
return (authUser as any)?.permissionOverrides?.[p] === true || userRole?.permissions.includes(p) || false;

```


Because it uses `||` without returning early when `permissionOverrides[p] === false`, **every explicit `DENY` override is completely ignored** across the Admin Portal navigation and route guards whenever the user's base role includes that permission!
2. **Client-Side-Only Guard on `MANAGE_SYSTEM` Override:** `AdminRoleManagementPage.tsx:658` blocks toggling `Permission.MANAGE_SYSTEM` only in the React click handler, with no enforcement in `firestore.rules` if a user with write access to `staff_accounts` or `roles` writes directly via the SDK.


* **Fix:** Check `permissionOverrides?.[p] !== undefined` first in `AdminPortalPage.tsx:403-407` before falling back to `userRole?.permissions.includes(p)`:

```typescript
// components/AdminPortalPage.tsx (lines 403-408)
const hasPermission = (p: Permission) => {
  if (isSuperAdmin) return true;
  const override = (authUser as any)?.permissionOverrides?.[p];
  if (override !== undefined) return override;
  return userRole?.permissions.includes(p) || false;
};

```

#### 6. `REJ-01` (Medium-High) — Rejoin Modal Argument Mismatch Forces `keepDocuments = true` & Duplicate UI Block

* **Location:** `components/AdminMasterEmployeeListPage.tsx` (lines 30, 1959–1996, 2063–2111) & `App.tsx` (lines 374–384)
* **Root Cause:**
1. **Array Passed to Boolean Parameter (`[]` is Truthy):** `onRejoin` in `AdminMasterEmployeeListPage.tsx:30` and `rejoinEmployee` in `DataContext.tsx` / `App.tsx:374` expect `keepDocuments?: boolean` as the 7th parameter. However, `AdminMasterEmployeeListPage.tsx:2110` passes `isRehiring ? selectedFolders : []` (a `string[]`). In JavaScript, an empty array `[]` is **truthy** (`Boolean([]) === true`), so `keepDocuments` always evaluates to `true` even when `isRehiring` is `false` or all document folders are unchecked!
2. **Duplicate Form Inputs in Rejoin Modal:** Lines 1959–1996 and lines 2063–2097 render the exact same "Re-hire with New Employee ID" text input (`rehireId`) and folder selection checkboxes twice inside the same modal.


* **Fix:** Remove the duplicate JSX block (lines 1959–1996) and pass `selectedFolders` properly (or pass `selectedFolders.length > 0` for `keepDocuments` and update `rejoinEmployee` to filter by `selectedFolders`).

#### 7. `ADM-01` (High) — Non-Existent Firestore Collections (`'staff'` and `'staffUsers'`) Break Admin Profile Avatar & Admin Setup Utilities

* **Location:** `components/AdminStaffProfilePage.tsx` (line 97), `src/utils/createAdmin.js` (line 38), & `src/utils/migrationHelper.ts` (lines 12, 57)
* **Root Cause:**
1. `AdminStaffProfilePage.tsx:97` renders `<ProfileAvatar collection="staffUsers" ... />`. When a staff user uploads a profile photo, `ProfileAvatar` attempts to update `doc(db, 'staffUsers', userId)`. Because `firestore.rules` has no rule for `staffUsers` (staff accounts live in `staff_accounts`), the update always fails with `Missing or insufficient permissions`.
2. Similarly, `src/utils/createAdmin.js:38` and `src/utils/migrationHelper.ts:12` write to `doc(db, 'staff', ...)`, which is also blocked by `firestore.rules` default deny.


* **Fix:** Change `collection="staffUsers"` to `collection="staff_accounts"` in `AdminStaffProfilePage.tsx:97`, and update `createAdmin.js` and `migrationHelper.ts` to reference `'staff_accounts'`.

#### 8. `NOTIF-01` (Medium) — Shared Broadcast Notification Mutation & Unbounded Real-Time Listeners

* **Location:** `src/contexts/NotificationContext.tsx` (lines 28–59, 129–147) & `src/services/requestService.ts` (lines 58–66, 106–114, 143–151, 180–185)
* **Root Cause:**
1. **Cross-Admin Read State Wipe:** Every staff user subscribes to notifications where `targetUserId == 'all_admins'` and `'admin'` (`NotificationContext.tsx:31-32`). When *any* staff user clicks "Mark all as read", `markAllNotificationsAsRead` (lines 129–146) updates `read: true` directly on those shared `notifications` documents, marking them as read for **every other admin in the organization**.
2. **Unbounded Full-Collection Listeners:** `subscribeToLeaveRequests`, `subscribeToAccountUpdates`, `subscribeToResignationRequests`, and `subscribeToDisciplinaryActions` in `requestService.ts` attach `onSnapshot` listeners to the entire collection without `limit()` or date/status filters, and `subscribeToDisciplinaryActions` (line 180) omits an error handler callback on `onSnapshot`.


* **Fix:** Track broadcast notification read state per-user (e.g., `readBy: arrayUnion(user.uid)` or a per-admin watermark timestamp) and add `limit(200)` plus error callbacks to all listeners in `requestService.ts`.

#### 9. `REDIRECT-01` (Medium) — Unvalidated `redirect` Query Parameter in Login Route

* **Location:** `src/routes/AppRoutes.tsx` (line 216)
* **Root Cause:** Line 216 evaluates `<Navigate to={new URLSearchParams(window.location.search).get('redirect') || "/dashboard"} replace />` without checking that the `redirect` parameter is an internal path starting with a single `/` (and not protocol-relative `//` or a cross-role path).
* **Fix:** Validate the redirect parameter before navigating:

```tsx
const rawRedirect = new URLSearchParams(window.location.search).get('redirect') || '/dashboard';
const safeRedirect = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/dashboard';

```

#### 10. `SCRIPT-01` (Medium) — Hardcoded Live Google Apps Script Webhook, User PII & Plaintext Password Reset in Repo Scripts

* **Location:** `scripts/test-drive-connection.js` (line 1), `scripts/check_user_exact.js` (lines 15–16), `scripts/search_user_rest.mjs` (line 21), `scripts/getEmpAndResetPass.js` (lines 25–28), & `GOOGLE_APPS_SCRIPT_v7.2.js` (lines 7–10)
* **Root Cause:**
1. `scripts/test-drive-connection.js:1` hardcodes a live Google Apps Script deployment URL (`[https://script.google.com/macros/s/AKfycbwkm0P7.../exec](https://script.google.com/macros/s/AKfycbwkm0P7.../exec)`), and `GOOGLE_APPS_SCRIPT_v7.2.js:7-10` hardcodes the production Google Drive `ROOT_FOLDER_ID`, `FORM_ID`, and `FIREBASE_API_KEY`.
2. `scripts/check_user_exact.js:15-16` and `scripts/search_user_rest.mjs:21` hardcode a real employee's personal email (`arjosarka56r@gmail.com`) and Firebase UID (`FgWijMwhsWfMDGpYn5Alpv6tbw02`).
3. `scripts/getEmpAndResetPass.js:25-28` fetches the first employee in Firestore and overwrites `password: 'password'` in plaintext.


* **Fix:** Move deployment URLs and folder IDs to environment variables / Apps Script `PropertiesService.getScriptProperties()`, scrub hardcoded user PII from `scripts/`, and remove `scripts/getEmpAndResetPass.js`.

### Master Consolidated Audit Ledger (All 37 Findings Across 100% of the Repository)

| ID | Pass | Severity | File(s) & Lines | Vulnerability / Bug Summary |
| --- | --- | --- | --- | --- |
| **`SEC-01`** | Pass 1 | **Critical** | `firestore.rules:109, 154, 179` | Any signed-in user (including anonymous auth) can read all documents in `employees`, `onboarding_submissions`, and `leave_requests`. |
| **`SEC-02`** | Pass 1 | **Critical** | `firestore.rules:115-120` | Unauthenticated / anonymous callers can update any field on any `employees/{empId}` document simply by including `claimToken` or `authUid` in the payload. |
| **`SEC-03`** | Pass 1 | **Critical** | `firestore.rules:162-167, 232-237` | Anonymous users can overwrite any non-status field on any `onboarding_submissions` doc and forge/modify `correction_requests`. |
| **`SEC-04`** | Pass 1 | **Critical** | `firestore.rules:259` | `account_updates` allows `allow update: if isSignedIn();`, letting any employee self-approve (`status: 'Approved'`) their own bank/salary/PII change request. |
| **`SEC-05`** | Pass 1 | **Critical** | `storage.rules:76-95, 121` | `submissions/{submissionId}/**` allows public/anonymous read and write of KYC documents; `employees/{empId}/**` allows any signed-in user to read all employee KYC files. |
| **`SEC-06`** | Pass 1 | **Critical** | `src/services/authService.ts:138-183, 405-445` | Legacy employee authentication compares plaintext/SHA-256 passwords in the browser and falls back to `signInAnonymously()` with a `localStorage` session (`udf_legacy_session`). |
| **`SEC-07`** | Pass 1 | **High** | `firestore.rules:53-57, 79-85` | `isSupervisor()` grants global admin-equivalent access across all sites and includes legacy string roles (`'admin'`, `'hr'`, `'supervisor'`). |
| **`SEC-08`** | Pass 1 | **High** | `firestore.rules:27-35` | `isSuperAdmin()` relies only on `users/{uid}` and custom claims, ignoring `staff_accounts/{uid}` where staff roles are actually managed (`adminService.ts`). |
| **`ONB-01`** | Pass 1 | **Critical** | `components/EmployeeFormPage.tsx:1671-1680` | `uploadFileWithRetry` returns `null` after 3 failed retries, and `Promise.all` proceeds to create the Firestore submission with `null` photo/KYC URLs while showing success. |
| **`ONB-02`** | Pass 1 | **High** | `components/EmployeeFormPage.tsx:1694-1748` | Draft-to-submission promotion executes 4 non-atomic sequential calls (file uploads, `submitOnboarding`, `updateOnboardingStatus`, `deleteEmployee`), leaving duplicate or orphaned records on partial failure. |
| **`CF-01`** | Pass 1 | **High** | `functions/index.js:154, 184-199` | `approveSubmission` crashes with `TypeError: Cannot read properties of undefined (reading 'serverTimestamp')` on new employee creation because `admin.firestore.FieldValue` is undefined in modular `firebase-admin/firestore`. |
| **`STATE-01`** | Pass 1 | **High** | `src/contexts/DataContext.tsx:110-189` | `DataContext` mounts multiple full-collection listeners (`employees`, `onboarding_submissions`) simultaneously without pagination, causing excessive Firestore read billing and memory bloat. |
| **`BIN-01`** | Pass 1 | **Medium** | `src/services/recycleBinService.ts:116-143` | `restoreItem` writes restored documents without stripping recycle metadata and without re-linking or verifying Storage files. |
| **`BGV-01`** | Pass 2 | **Critical** | `src/services/bgvService.ts:276-288` & `firestore.rules` | `submitConsent` writes to `doc(db, 'employees', submissionId)` instead of `onboarding_submissions`, and `bgv_records` / `bgv_logs` have no rules in `firestore.rules` (all BGV operations fail with permission denied). |
| **`GAM-01`** | Pass 2 | **Critical** | `src/services/engagementService.ts` & `firestore.rules` | None of the 8 gamification collections (`gamification_profiles`, `point_transactions`, `kudos`, `polls`, `quiz_attempts`, etc.) exist in `firestore.rules`, breaking the entire Engagement Hub. |
| **`GAM-02`** | Pass 2 | **High** | `src/services/engagementService.ts:207-235, 343-376` | Quiz correct answers are sent to the client and verified client-side; `submitAttendanceCheckIn` uses the device's local clock and has no atomic duplicate guard (`point_transactions` can be spammed). |
| **`IMP-01`** | Pass 2 | **High** | `src/utils/bulkImportUtils.ts:297-318` | Bulk import downloads the entire `employees` collection via `getDocs` on every import to check duplicates and generates predictable `UDF@1234` default passwords. |
| **`EXP-01`** | Pass 2 | **Medium** | `utils/exportUtils.ts:15-52` | CSV/Excel export does not sanitize leading formula characters (`=`, `+`, `-`, `@`), enabling CSV Formula Injection when opened in Excel/Sheets. |
| **`INV-01`** | Pass 2 | **High** | `components/AdminInvitesPage.tsx` & `firestore.rules:136-148` | Invite token generation uses `Math.random()`, and `invites` rules allow any signed-in user to read all invite tokens and update them without validating token expiration. |
| **`AUTH-02`** | Pass 2 | **High** | `src/utils/googleAuthHelper.ts:52-78` | Google OAuth access tokens (`ya29...`) are cached in `sessionStorage` in plaintext, exposing Google Drive tokens if any XSS (`XSS-01` / `XSS-02`) occurs. |
| **`WF-01`** | Pass 2 | **Medium** | `src/utils/workflowHelper.ts:25-98` & `AdminWorkflowConfigPage.tsx` | Multi-step workflow engine is enforced purely on the client UI; `firestore.rules` does not enforce workflow stage transitions or role ownership per step. |
| **`BLOG-01`** | Pass 2 | **High** | `src/services/blogService.ts`, `websiteService.ts` & `firestore.rules` | `blog_posts`, `blog_categories`, `site_settings`, and `website_content` have no rules in `firestore.rules`, breaking the CMS and blog manager. |
| **`CMP-01`** | Pass 2 | **Medium** | `components/SecuritySettingsModal.tsx` & `authService.ts` | Password update modal does not enforce consistent complexity rules or re-authentication across legacy vs. Firebase Auth accounts. |
| **`XSS-01`** | Pass 2 | **High** | `src/utils/sanitizeHtml.ts:8-48` | Custom regex/DOM HTML sanitizer allows `style` attributes and fails to strip dangerous CSS expressions or nested URI schemes compared to DOMPurify. |
| **`CLM-01`** | Pass 2 | **Critical** | `components/ProfileClaimPage.tsx:78-165` | Profile claim queries `employees` directly from the client using an anonymous session and updates `authUid` client-side without server-side OTP/token validation. |
| **`AUD-01`** | Pass 2 | **Medium** | `src/services/auditService.ts:15-75` & `firestore.rules:218-226` | Any signed-in user can create arbitrary `audit_logs` entries with forged `actorId`/`action` fields, and failed audit writes are silently swallowed. |
| **`BGV-02`** | Pass 2 | **Medium** | `components/AdminBgvManagementPage.tsx:85-160` | BGV document verification status transitions do not atomically sync with the parent `onboarding_submissions` or `employees` status. |
| **`CORR-01`** | Pass 3 | **Critical** | `components/employee/DataCorrectionPage.tsx:135-177, 259-320` | Visiting `/correct-details?token=...` downloads the full employee/submission PII into browser state *before* DOB/Phone verification, and verifies DOB/Phone purely client-side. |
| **`GAS-01`** | Pass 3 | **Critical** | `GOOGLE_APPS_SCRIPT_v7.2.js:68-78, 128-132, 168` | Every KYC file uploaded via Apps Script is set to `ANYONE_WITH_LINK` (public), and `checkFirestoreAccess` grants upload rights to anyone with Firestore `GET` (read) access. |
| **`XSS-02`** | Pass 3 | **High** | `components/AdminReviewSubmissionsPage.tsx:647-983` | `handlePrintBiodata` writes unescaped applicant fields (`presentAddress`, `experience`, `name`, etc.) into `printWindow.document.write()`, enabling Stored DOM XSS in the admin origin. |
| **`REQ-01`** | Pass 3 | **High** | `src/services/requestService.ts:18-35` & `AdminResignationManagementPage.tsx:208` | `uploadFilesInObject` catches Storage errors and silently writes `document: null`; when upload succeeds, it stores a `storage://` string while the Admin UI expects `{ name: string }`, breaking document links. |
| **`ROLE-01`** | Pass 3 | **High** | `components/AdminPortalPage.tsx:403-407` & `AdminRoleManagementPage.tsx:658` | `AdminPortalPage` checks `permissionOverrides[p] === true || userRole.permissions.includes(p)`, ignoring explicit `false` (`DENY`) overrides on staff accounts. |
| **`REJ-01`** | Pass 3 | **Medium-High** | `components/AdminMasterEmployeeListPage.tsx:30, 1959-1996, 2063-2111` | Rejoin modal passes `string[]` (`selectedFolders` or `[]`) to boolean `keepDocuments` parameter (where `[]` is truthy in JS) and renders the Re-hire ID & folder UI block twice. |
| **`ADM-01`** | Pass 3 | **High** | `components/AdminStaffProfilePage.tsx:97`, `createAdmin.js:38`, `migrationHelper.ts:12` | References non-existent Firestore collections `'staffUsers'` and `'staff'` instead of `'staff_accounts'`, causing profile photo updates and admin scripts to fail with permission denied. |
| **`NOTIF-01`** | Pass 3 | **Medium** | `src/contexts/NotificationContext.tsx:31-32, 129-146` & `requestService.ts` | Marking notifications read mutates shared `targetUserId == 'all_admins'` docs for all admins globally; `requestService.ts` attaches unbounded full-collection `onSnapshot` listeners. |
| **`REDIRECT-01`** | Pass 3 | **Medium** | `src/routes/AppRoutes.tsx:216` | Login route passes raw `?redirect=` query string directly to `<Navigate to={...} />` without validating that it starts with a single `/`. |
| **`SCRIPT-01`** | Pass 3 | **Medium** | `scripts/test-drive-connection.js`, `check_user_exact.js`, `getEmpAndResetPass.js` | Repo scripts contain a live Google Apps Script webhook URL, hardcoded employee email/UID (`arjosarka56r@gmail.com`), and a script that resets employee passwords to `'password'`. |

If you would like me to generate the patched source files (such as a hardened `firestore.rules`, `storage.rules`, `functions/index.js`, `AdminReviewSubmissionsPage.tsx`, `DataCorrectionPage.tsx`, and `requestService.ts`) in your workspace so you can download and apply them directly, let me know which files you want generated first.

i will ask it again ok
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-10-14T16:05:46+05:30.

The user's current state is as follows:
Active Document: z:\HR PORTAL\.env.local (LANGUAGE_UNSPECIFIED)
Cursor is on line: 1
Other open documents:
- z:\HR PORTAL\.env (LANGUAGE_UNSPECIFIED)
- z:\UDF_SUBDOMAINS\.gitignore (LANGUAGE_UNSPECIFIED)
- z:\HR PORTAL\.env.local (LANGUAGE_UNSPECIFIED)
- z:\HR PORTAL\.env.example (LANGUAGE_UNSPECIFIED)
- z:\HR PORTAL\.env.employee (LANGUAGE_UNSPECIFIED)
</ADDITIONAL_METADATA>



================================================================================
## ARGON AUDIT INPUT - STEP 2653 (2026-10-14T10:39:30Z)
================================================================================

<USER_REQUEST>
That is the complete audit — there are no uninspected source files left in your repository.

To be 100% certain nothing was missed, I ran a full file inventory (`find`) and a repository-wide regex cross-check of every `collection(db, ...)` and `doc(db, ...)` call against `firestore.rules` and `storage.rules` across all **98 code and configuration files** (`.ts`, `.tsx`, `.js`, `.mjs`, `.cjs`, `.html`, `.json`, and `.rules`).

That final cross-check confirmed every file has been read and surfaced **3 remaining collection-to-rule mismatches** to add to your master list (bringing the final, definitive total across the entire repository to **40 findings**):

### Final 3 Cross-Check Findings (`collection(db, ...)` vs. `firestore.rules`)

* **`CMS-02` (High — Public "Contact Us" Form Always Fails Due to Missing `contact_messages` Rule):**
* **Location:** `components/ContactPage.tsx` (line 52) & `firestore.rules`
* **Root Cause:** `ContactPage.tsx:52` executes `await addDoc(collection(db, 'contact_messages'), { name, email, phone, subject, message, timestamp: serverTimestamp() })`. There is no `match /contact_messages/{id}` block anywhere in `firestore.rules`, so Firestore falls back to default-deny and every inquiry submitted on `/contact` fails with `FirebaseError: Missing or insufficient permissions` (`"Something went wrong. Please try calling our support hotline directly."`).
* **Fix:** Add a `match /contact_messages/{id}` rule in `firestore.rules` allowing validated public `create` and admin-only `read, update, delete`:
```javascript
match /contact_messages/{id} {
  allow create: if request.resource.data.keys().hasOnly(['name', 'email', 'phone', 'subject', 'message', 'timestamp'])
                && request.resource.data.name is string
                && request.resource.data.message is string
                && request.resource.data.message.size() <= 5000;
  allow read, update, delete: if isAdmin();
}

```




* **`BIN-02` (Medium — Recycle Bin Site Restoration Writes to Non-Existent Top-Level `'sites'` Collection):**
* **Location:** `src/services/recycleBinService.ts` (line 101) & `firestore.rules`
* **Root Cause:** When restoring a deleted site, `recycleBinService.ts:81-98` updates `doc(db, 'settings', 'sites')`, and then line 101 executes `await setDoc(doc(db, 'sites', originalId), restoredSite, { merge: true })`. Because top-level `/sites/{id}` does not exist in `firestore.rules` (all sites live inside `settings/sites`), line 101 throws a permission-denied error right before vacancy restoration (`lines 104-117`) and before `deleteDoc(binDocRef)` (`line 237`), leaving the site partially restored and stuck in the Recycle Bin.
* **Fix:** Remove `await setDoc(doc(db, 'sites', originalId), restoredSite, { merge: true });` on `recycleBinService.ts:101` (since `settings/sites` is already updated on lines 81–98).


* **`CORR-02` (Critical — `hasActiveCorrectionToken` Grants Unauthenticated Full-Document Read & Unrestricted Field Overwrite Without Knowing the Token):**
* **Location:** `firestore.rules` (lines 146–151, 185, 191, 214, 226)
* **Root Cause:**
```javascript
function hasActiveCorrectionToken(docData) {
  return docData.activeCorrectionToken != null &&
    exists(/databases/$(database)/documents/correction_requests/$(docData.activeCorrectionToken)) &&
    get(/databases/$(database)/documents/correction_requests/$(docData.activeCorrectionToken)).data.status == 'pending' &&
    get(/databases/$(database)/documents/correction_requests/$(docData.activeCorrectionToken)).data.expiresAt > request.time;
}

```


1. **Caller Doesn't Need to Know the Token:** `hasActiveCorrectionToken(resource.data)` reads `resource.data.activeCorrectionToken` off the target document itself. Any unauthenticated attacker who guesses or enumerates an employee ID (`HY123456`) while that employee has a pending correction link can call `getDoc` or `updateDoc` on `employees/{userId}` without knowing the secret `activeCorrectionToken` UUID.
2. **Zero Field Restrictions on `update`:** Both `employees/{userId}` (`line 191`) and `onboarding_submissions/{id}` (`line 226`) allow `update: if ... hasActiveCorrectionToken(resource.data)` without restricting `affectedKeys()`. While a correction token is pending, an unauthenticated caller can overwrite `status`, `profileStatus`, `uid`, `linkedUid`, `isActive`, or `salary` on that record.


* **Fix:** Require that updates via correction token only modify `profileData`, `formData`, `data`, `lastUpdated`, `activeCorrectionToken` (setting it to `null`), and extracted identifiers, and require `request.resource.data.activeCorrectionToken == null` so the token is consumed atomically on update.



### Complete Verification Summary (100% of Repository Files Audited)

| Codebase Layer | Total Files in Repo | Audited | Findings Count | Finding IDs |
| --- | --- | --- | --- | --- |
| **Security Rules (`firestore.rules`, `storage.rules`)** | 2 | 2 / 2 (100%) | 11 | `SEC-01` to `SEC-05`, `SEC-07`, `SEC-08`, `BGV-01`, `GAM-01`, `CMS-02`, `CORR-02` |
| **Cloud Functions & Apps Script (`functions/index.js`, `GOOGLE_APPS_SCRIPT_v7.2.js`)** | 2 | 2 / 2 (100%) | 2 | `CF-01`, `GAS-01` |
| **Services (`src/services/*.ts`)** | 16 | 16 / 16 (100%) | 9 | `SEC-06`, `BIN-01`, `BIN-02`, `GAM-02`, `BLOG-01`, `AUD-01`, `REQ-01`, `NOTIF-01`, `BGV-02` |
| **Contexts, Routes & Guards (`src/context*`, `src/routes/*`, `src/components/guards/*`)** | 6 | 6 / 6 (100%) | 2 | `STATE-01`, `REDIRECT-01` |
| **Admin, Employee & Public Components (`components/**/*.tsx`, `App.tsx`)** | 50 | 50 / 50 (100%) | 10 | `ONB-01`, `ONB-02`, `INV-01`, `CMP-01`, `CLM-01`, `CORR-01`, `XSS-02`, `ROLE-01`, `REJ-01`, `ADM-01` |
| **Utilities, Hooks & Scripts (`src/utils/*`, `utils/*`, `hooks/*`, `scripts/*`)** | 22 | 22 / 22 (100%) | 6 | `IMP-01`, `EXP-01`, `AUTH-02`, `WF-01`, `XSS-01`, `SCRIPT-01` |
| **Total Across Entire Repository** | **98** | **98 / 98 (100%)** | **40** | **Complete** |

Everything in the repository has now been inspected and accounted for. Let me know if you want me to generate the fixed files or a consolidated Markdown/PDF report of all 40 findings.


</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-10-14T16:09:30+05:30.

The user's current state is as follows:
Active Document: z:\HR PORTAL\.env.local (LANGUAGE_UNSPECIFIED)
Cursor is on line: 1
Other open documents:
- z:\HR PORTAL\.env.admin (LANGUAGE_UNSPECIFIED)
- z:\HR PORTAL\.env (LANGUAGE_UNSPECIFIED)
- z:\UDF_SUBDOMAINS\.gitignore (LANGUAGE_UNSPECIFIED)
- z:\HR PORTAL\.env.local (LANGUAGE_UNSPECIFIED)
- z:\HR PORTAL\.env.example (LANGUAGE_UNSPECIFIED)
</ADDITIONAL_METADATA>



================================================================================
## ARGON AUDIT INPUT - STEP 2662 (2026-10-14T10:51:06Z)
================================================================================

<USER_REQUEST>
I've completed a full line-by-line rescan across all **161 code and configuration files (64,498 lines)** in the repository (`functions/index.js`, `App.tsx`, `src/services/employeeService.ts`, `src/contexts/DataContext.tsx`, `src/context/AuthContext.tsx`, `firestore.rules`, `storage.rules`, `GOOGLE_APPS_SCRIPT_v7.2.js`, and all UI components and services).

Comparing the **actual live code** against the repository's existing audit documents (`ALL_AUDIT_FINDINGS_MASTER.md`, `UDF_FULL_CODEBASE_AUDIT_REPORT.md`, `RESIDUAL_FINDINGS_7_AND_14.md`, and `SECURITY_AUDIT_REPORT.md`) uncovered **10 brand-new or regressed vulnerabilities and logic bugs** that are active in the codebase right now—including 3 issues that were previously marked "FIXED & VERIFIED" in the repo's markdown reports but remain unfixed or were re-introduced in live code.

### 10 Brand-New & Regressed Findings in Live Code

| ID | Severity | File & Exact Lines | Issue Summary | Status in Repo Docs |
| --- | --- | --- | --- | --- |
| **AUTH-SYNC-01** | **Critical** | `functions/index.js:534-614`, `713-817`, `852-894`, `984-1026`, `1172-1220`, `1267-1355` | Dual-collection password desynchronization keeps **both old and new passwords active simultaneously** after password reset or change | **Brand-New (Undocumented)** |
| **AUTH-PASS-01** | **Critical** | `functions/index.js:1491-1496` | `adminControlEmployeeAuth` (`reset_to_default`) writes plaintext `mockPassword: defaultPassword` back into both `employees` and `onboarding_submissions` | **Regressed** (Claimed fixed in Finding #2) |
| **STORAGE-REG-01** | **Critical** | `storage.rules:87-92` & `src/components/employeeFormFields/EmployeeFileUploadField.tsx:41` | `/onboarding/{submissionId}/{allPaths=**}` still permits any authenticated/anonymous user to read and write without `isOnboardingOwner(submissionId)`, while `onboarding_uploads/` always fails | **Unfixed in Code** (Claimed fixed in Finding #29) |
| **CF-SEC-01** | **High** | `functions/index.js:914-928`, `1240-1249`, `1530-1551`, `1735-1745`, `1994-2092` | Disabled staff bypass in `getSecureDocumentURL` & `moveStorageFolder`, optional `idToken` verification in Google linking, and unthrottled `claimEmployeeProfile` with empty-metric bypass | **Brand-New (Undocumented)** |
| **LEAVE-DBL-01** | **High** | `src/contexts/DataContext.tsx:157-209` vs `App.tsx:930-972`, `1254` & `src/services/employeeService.ts:2079-2081` | **Double deduction of approved leave balances** because `setLeaveBalances` is a no-op and `DataContext` subtracts `used` from an already-decremented `emp.leaveBalance` | **Brand-New (Undocumented)** |
| **REQ-ID-01** | **High** | `App.tsx:1155`, `1190`, `1369` vs `App.tsx:2358-2360`, `2372-2385` & `firestore.rules:247`, `276`, `305` | Employee leave, resignation, and account update requests disappear from the Employee Portal and fail Firestore rules due to `portalId` vs `id`/`employeeId` mismatch | **Brand-New (Undocumented)** |
| **DOC-ID-01** | **High** | `App.tsx:2038`, `2139`, `2295` & `src/services/employeeService.ts:2422`, `2589`, `2634`, `2700`, `4350` | 7 functions call `doc(db, 'employees', employeeId)` without fallback queries for `UDF-` document IDs, and `rejoinEmployee` allows duplicate `employeeId` values | **Brand-New (Undocumented)** |
| **GAS-MISSING-01** | **High** | `GOOGLE_APPS_SCRIPT_v7.2.js:88-140`, `151`, `352` vs `src/services/driveService.ts:72`, `91`, `148`, `315` | 5 Drive actions called by the frontend (`create_employee_folder`, `copy_specific_subfolders`, `sync_folder`, `block_employee`, `unblock_employee`) do not exist in Apps Script, `handleCopyFolder` is a dummy stub, and `UDF-` uploads go to `Active Employees` | **Brand-New (Undocumented)** |
| **DENY-OVR-01** | **High** | `src/contexts/DataContext.tsx:252`, `321`, `564` & `components/AdminPortalPage.tsx:406` | Explicit `permissionOverrides[p] === false` (`DENY`) is ignored whenever the user's base role grants the permission | **Brand-New (Undocumented)** |
| **AADHAAR-01** | **Medium-High** | `components/EmployeeFormPage.tsx:1521-1523` | Candidate's plaintext e-Aadhaar PDF password (`originalAadhaarPassword`) is persisted to `draft_submissions`, `onboarding_submissions`, and `employees` | **Brand-New (Undocumented)** |

### Detailed Breakdown & Remediations for the 10 New/Regressed Findings

#### 1. `AUTH-SYNC-01` — Dual-Collection Password Desynchronization Leaves Old Passwords Valid After Reset/Change (`functions/index.js`)

* **Root Cause:** Approved self-onboarded employees have records in **both** `onboarding_submissions` and `employees`. During login, `employeeLogin` (`functions/index.js:534-614`) checks `onboarding_submissions` first (`line 534`), and if the password hash does not match (`!matchedDoc`), it falls through to Step 2 (`line 584`) and checks `employees`:
* **Password Reset (`verifyAndResetEmployeePassword`, `lines 713-817`):** Searches `employees` first (`lines 716-749`), finds the employee, and updates `passwordHash` **only in `employees**` (`line 814`), leaving the old `passwordHash` untouched in `onboarding_submissions`.
* **Password Change & First-Time Setup (`changeEmployeePassword`, `lines 852-894` & `setupEmployeePassword`, `lines 1172-1220`):** Searches `onboarding_submissions` first and updates `passwordHash` **only in `onboarding_submissions**`, leaving the old/default `passwordHash` untouched in `employees`.
* **Google Account Linking (`linkEmployeeGoogleAccount`, `lines 984-1026` & `selfLinkGoogleAccount`, `lines 1267-1355`):** Updates `googleUid` and `linkedGoogleEmail` in only the first matched collection.


* **Impact:** After an employee resets a compromised password or changes their default password, **both the old password and the new password work simultaneously** in `employeeLogin` (one matches Step 1 in `onboarding_submissions`, and the other matches Step 2 in `employees`).
* **Fix:** Reuse the dual-collection lookup pattern already implemented in `adminControlEmployeeAuth` (`functions/index.js:1387-1461`) across `verifyAndResetEmployeePassword`, `changeEmployeePassword`, `setupEmployeePassword`, `linkEmployeeGoogleAccount`, and `selfLinkGoogleAccount` so every credential or link mutation updates **all** matching documents in both `employees` and `onboarding_submissions` inside a single `db.batch()`.

#### 2. `AUTH-PASS-01` — Plaintext `mockPassword` Re-Introduced on Admin Password Reset (`functions/index.js:1491-1496`)

* **Root Cause:** Although `UDF_FULL_CODEBASE_AUDIT_REPORT.md` marked Finding #2 ("Plaintext Password Storage in Firestore") as "FIXED & VERIFIED", `adminControlEmployeeAuth` (`action === 'reset_to_default'`, `functions/index.js:1491-1496`) still writes `mockPassword` in plaintext:
```javascript
updateData = {
  passwordHash: hashPassword(defaultPassword),
  mockPassword: defaultPassword,
  isDefaultPassword: true,
  passwordResetAt: admin.firestore.FieldValue.serverTimestamp(),
};

```


* **Impact:** Every time an admin resets an employee's password to default, the plaintext password (`mockPassword`) is written into both `employees` and `onboarding_submissions`.
* **Fix:** Replace `mockPassword: defaultPassword` with `mockPassword: admin.firestore.FieldValue.delete()` at `functions/index.js:1493`.

#### 3. `STORAGE-REG-01` — Unfixed Anonymous Read/Write on `/onboarding/{submissionId}/**` & Blocked `/onboarding_uploads/` (`storage.rules:87-92` & `EmployeeFileUploadField.tsx:41`)

* **Root Cause:**
1. `UDF_FULL_CODEBASE_AUDIT_REPORT.md` states that `storage.rules` Finding #29 was fixed with `isOnboardingOwner(submissionId)`. However, inspecting the actual `storage.rules:87-92` file shows the helper `isOnboardingOwner` is defined at `lines 40-50` **but never called**:
```javascript
match /onboarding/{submissionId}/{allPaths=**} {
  allow read: if isAuthenticated();
  allow write: if isAuthenticated() && isValidUpload();
  allow delete: if isAdminOrStaff();
}

```


2. Meanwhile, `src/components/employeeFormFields/EmployeeFileUploadField.tsx:41` uploads files to `onboarding_uploads/${new Date().toISOString().slice(0, 10)}`, which has no matching rule in `storage.rules` and is blocked by the catch-all `allow read, write: if false;`.


* **Fix:** Update `storage.rules:87-92` to enforce `allow read: if isAdminOrStaff() || isOnboardingOwner(submissionId);` and `allow write: if (isAdminOrStaff() || isOnboardingOwner(submissionId)) && isValidUpload();`, and update `EmployeeFileUploadField.tsx:41` to upload under `/onboarding/${submissionId}/`.

#### 4. `CF-SEC-01` — Cloud Functions Auth Bypasses & Unthrottled Profile Claiming (`functions/index.js`)

* **Root Cause:**
1. **Disabled Staff & Unverified Email in `getSecureDocumentURL` (`lines 1538-1551`) and `moveStorageFolder` (`lines 1742-1744`):** Both functions check `userSnap.exists || staffSnap.exists || staffAccSnap.exists` without checking `data.isDisabled !== true && data.isActive !== false`. In addition, `getSecureDocumentURL` (`lines 1540-1550`) queries by `request.auth.token.email` without requiring `request.auth.token.email_verified === true`.
2. **Optional `idToken` Verification in `linkEmployeeGoogleAccount` (`lines 914-928`) & `selfLinkGoogleAccount` (`lines 1240-1249`):** Both functions only verify `idToken` / `googleIdToken` **if the client passes it** (`if (idToken)` / `if (request.data.googleIdToken)`). If a caller omits `idToken` and passes only `googleUid` and `email`, token verification is skipped entirely.
3. **No Rate Limiting & Empty-Metric Bypass in `claimEmployeeProfile` (`lines 1994-2092`):** Unlike `employeeLogin` and `verifyAndResetEmployeePassword`, `claimEmployeeProfile` never calls `checkAndIncrementFailedAttempts()`, allowing unlimited brute-forcing of Aadhaar/PAN/DOB. Worse, at `lines 2046-2063`, if `settings/SelfOnboardingConfig` exists with an empty `verificationMetrics: []` array, the `for (const metric of metricsToVerify)` loop executes 0 iterations and immediately links the caller's UID (`uid: callerUid`) to the employee profile.


* **Fix:**
* Require `isActiveDoc(doc)` and `request.auth.token.email_verified === true` in `getSecureDocumentURL` and `moveStorageFolder`.
* Make `idToken` / `googleIdToken` mandatory in `linkEmployeeGoogleAccount` and `selfLinkGoogleAccount` (unless the caller is an authenticated admin in `linkEmployeeGoogleAccount`).
* Add `await checkAndIncrementFailedAttempts(\`claim_${cleanId}`)`to`claimEmployeeProfile`and enforce`if (!Array.isArray(metricsToVerify) || metricsToVerify.length === 0) metricsToVerify = ['aadhaar', 'dob', 'mobile'];`.



#### 5. `LEAVE-DBL-01` — Double Leave Balance Deduction & Dead `setLeaveBalances` (`src/contexts/DataContext.tsx:157-209` vs `App.tsx:930-972, 1254` & `src/services/employeeService.ts:2079-2081`)

* **Root Cause:**
1. When an admin approves a leave request (`App.tsx:1254`), `updateEmployeeLeaveBalance` (`src/services/employeeService.ts:2079-2081`) permanently decrements `emp.leaveBalance[balanceKey]` in Firestore via `increment(-daysToDeduct)`. Thus, `emp.leaveBalance.casual` in Firestore holds the **remaining** balance (e.g., `12 - 3 = 9`), not the original entitlement (`12`).
2. `App.tsx:930-972` computes `balances` and calls `setLeaveBalances(balances)`, **but `setLeaveBalances` in `src/contexts/DataContext.tsx:207-209` is a hardcoded no-op (`const setLeaveBalances = () => {};`)**!
3. Instead, `DataContext.tsx:157-205` derives `leaveBalances` via `useMemo`: it sets `total: emp.leaveBalance[shortKey]` (`9`, the already-decremented balance) at `line 171`, and then loops over all approved `leaveRequests` (`lines 180-197`) and adds `used += days` (`3`). When `EmployeePortalPage` computes `available = total - used` (`9 - 3 = 6`), **every approved leave request is deducted twice**.
4. Additionally, `DataContext.tsx:159` matches requests using only `r.employeeId === emp.employeeId`, missing requests where `r.employeeId` was saved as `emp.portalId` or `emp.id`.


* **Fix:** In `DataContext.tsx:157-205`, match requests across `[emp.id, emp.employeeId, emp.portalId, emp.submissionId]` and either set `total = remainingBalance + used` (so `total - used` equals `remainingBalance` while accurately displaying `used`) or stop mutating `emp.leaveBalance` as a remaining counter and store `entitlement` separately from `used`.

#### 6. `REQ-ID-01` — Employee Requests Disappear in Portal & Fail Firestore Rules Due to `portalId` Mismatch (`App.tsx` & `firestore.rules`)

* **Root Cause:**
1. When an employee creates a leave request (`App.tsx:1155`), resignation request (`App.tsx:1190`), or account update request (`App.tsx:1369`), `App.tsx` sets `employeeId: authUser.portalId || authUser.id`.
2. However, when passing props to `<EmployeePortalPage>` at `App.tsx:2372-2374` and `2384-2385`, `App.tsx` filters by `lr.employeeId === authUser?.id || (authUser?.employeeId && lr.employeeId === authUser.employeeId)`—**omitting `authUser?.portalId**`! As a result, any employee whose `portalId` (`UDF-...`) differs from `id` or `employeeId` (`HY...`) immediately loses visibility of their submitted requests and balances.
3. Furthermore, when an employee logs in via `EmployeeLoginModal` (`App.tsx:2358-2360`), `onLoginSuccess` builds `employeeUser` with `{ type: UserType.EMPLOYEE, id: emp.id!, employeeId: emp.employeeId, name }` and drops `portalId`, `isDefaultPassword`, `authProvider`, and `linkedGoogleEmail`.
4. In `firestore.rules:247, 276, 305`, `leave_requests`, `account_updates`, and `resignations` check `resource.data.employeeId == request.auth.uid || resource.data.get('uid', '') == request.auth.uid` without calling `isOwnerOfPortalId(resource.data.employeeId)`.


* **Fix:** Include `authUser?.portalId` in all `<EmployeePortalPage>` filters (`App.tsx:2372-2385`), preserve all fields (`portalId`, `isDefaultPassword`, `authProvider`, `linkedGoogleEmail`) in `App.tsx:2358-2360`, and add `|| isOwnerOfPortalId(resource.data.employeeId)` to `firestore.rules:247, 276, 305`.

#### 7. `DOC-ID-01` — Missing `employeeId` Fallback Queries in 7 Functions (`App.tsx` & `src/services/employeeService.ts`)

* **Root Cause:** Self-onboarded employees are created in `employees` using their `submissionId` (`UDF-202609-XXXX`) as the Firestore document ID (`src/services/employeeService.ts:1751`), while their assigned badge ID (`HY123456`) is stored in the `employeeId` field. While some functions in `employeeService.ts` fall back to querying `where('employeeId', '==', employeeId)`, **7 functions still assume the Firestore document ID is always `employeeId**`:
1. `App.tsx:2038` (`handleApproveProfileCompletion`) — calls `updateDoc(doc(db, 'employees', submission.employeeId), ...)` directly, throwing `No document to update` when approving profile completion for any `UDF-` employee.
2. `App.tsx:2139` (`handleUpdateSubmissionComment`) — calls `getDoc(doc(db, 'employees', submissionId))` without fallback.
3. `App.tsx:2295` (`handleCompleteProfile`) — calls `getDoc(doc(db, 'employees', userUniqueId))` without fallback.
4. `src/services/employeeService.ts:2589` (`assignToSite`) — calls `getDoc(doc(db, 'employees', employeeId))` and throws `'Employee not found'`.
5. `src/services/employeeService.ts:2634` (`relieveFromSite`) — calls `getDoc(doc(db, 'employees', employeeId))` and throws `'Employee not found'`.
6. `src/services/employeeService.ts:2700` (`updateEmployeeClientIds`) & `4350` (`adminUpdateEmployeeEmail`) — call `updateDoc(doc(db, 'employees', employeeId), ...)` directly without fallback.
7. `src/services/employeeService.ts:2422` (`rejoinEmployee`) — checks if `newEmployeeId` is already taken using only `getDoc(doc(db, 'employees', newEmployeeId))` instead of `checkEmployeeIdExists(newEmployeeId)`, allowing duplicate `employeeId` assignment during re-hire.


* **Fix:** Route all 6 lookup/update sites through a shared `resolveEmployeeDocRef(db, idOrEmployeeId)` helper (checking `doc(db, 'employees', id)` first, then `where('employeeId', '==', id)`, then `where('portalId', '==', id)`), and replace `getDoc(newDocRef)` in `rejoinEmployee` (`line 2422`) with `await checkEmployeeIdExists(newEmployeeId)`.

#### 8. `GAS-MISSING-01` — 5 Unimplemented Actions, Dummy Copy Stub & Broken `UDF-` Folder Routing in `GOOGLE_APPS_SCRIPT_v7.2.js`

* **Root Cause:**
1. `src/services/driveService.ts` sends 5 actions to Google Apps Script that **do not exist** in `GOOGLE_APPS_SCRIPT_v7.2.js:88-140`:
* `action: 'create_employee_folder'` (`driveService.ts:91`, called during re-hire in `employeeService.ts:2456`)
* `action: 'copy_specific_subfolders'` (`driveService.ts:315`, called during re-hire in `employeeService.ts:2462`)
* `action: 'sync_folder'` (`driveService.ts:148`)
* `action: 'block_employee'` and `'unblock_employee'` (`driveService.ts:72`)
All 5 hit the fallback at `GOOGLE_APPS_SCRIPT_v7.2.js:140` and return `{ success: false, error: "Invalid action or missing parameters" }`.


2. `handleCopyFolder` (`GOOGLE_APPS_SCRIPT_v7.2.js:352`) is a one-line dummy stub (`function handleCopyFolder(s, t) { return reply({success: true, message: "Action logged"}); }`) that copies zero files.
3. `handleUpload` (`GOOGLE_APPS_SCRIPT_v7.2.js:151`) determines whether an upload belongs in `Pending Employees` vs `Active Employees` via `const isPending = data.isPending === true || (data.uniqueId && data.uniqueId.toString().startsWith('SUB-'));`. Because modern onboarding IDs start with `UDF-` (`UDF-YYYYMM-XXXX`) and `driveService.ts:191-215` does not pass `isPending`, pending candidate uploads are placed directly into `Active Employees`.


* **Fix:** Implement `create_employee_folder`, `copy_specific_subfolders`, `sync_folder`, `block_employee`, `unblock_employee`, and recursive folder copy in `GOOGLE_APPS_SCRIPT_v7.2.js`, and update `line 151` to check `startsWith('SUB-') || startsWith('UDF-')`.

#### 9. `DENY-OVR-01` — Explicit `permissionOverrides[p] === false` (`DENY`) Is Ignored Across All Permission Checkers (`DataContext.tsx` & `AdminPortalPage.tsx`)

* **Root Cause:** In `src/contexts/DataContext.tsx:252, 321, 564` and `components/AdminPortalPage.tsx:406`, permission checks evaluate:
```typescript
authUser?.permissionOverrides?.[p] === true || userRole?.permissions.includes(p)

```


Because of boolean short-circuiting, when an admin explicitly revokes a permission for a specific staff user (`permissionOverrides[p] === false`), the expression falls through to `userRole?.permissions.includes(p)` and still grants access!
* **Fix:** Check for explicit denial first in all 4 locations:
```typescript
const hasPerm = (p: Permission) => {
  if (authUser?.permissionOverrides?.[p] === false) return false;
  if (authUser?.permissionOverrides?.[p] === true) return true;
  return Boolean(userRole?.permissions.includes(p));
};

```



#### 10. `AADHAAR-01` — Candidate's Plaintext e-Aadhaar PDF Password Stored in Firestore (`components/EmployeeFormPage.tsx:1521-1523`)

* **Root Cause:** When a candidate unlocks a password-protected e-Aadhaar PDF during onboarding, `EmployeeFormPage.tsx:1521-1523` stores the password directly in `formData`:
```typescript
if (password) {
  updates['originalAadhaarPassword'] = password;
}

```


Because `formData` is spread directly into `draft_submissions`, `onboarding_submissions`, and `employees` upon approval, the plaintext password (`originalAadhaarPassword`) is permanently persisted in Firestore.
* **Fix:** Delete `updates['originalAadhaarPassword'] = password;` (the unlocked PDF or extracted image is already uploaded to Storage, so storing the user's e-Aadhaar password in Firestore is unnecessary and exposes sensitive PII/credentials).

### Master Status Verification of Previously Cataloged Findings in Live Code

In addition to the 10 brand-new/regressed findings above, here is the verified live status of the remaining open issues across the codebase so you have a single complete checklist:

| Category | File & Exact Lines | Live Verification Status |
| --- | --- | --- |
| **Hardcoded Drive Secret & Fallback Password** | `functions/index.js:1798` (`'udf-secret-key-2026'`), `src/services/driveService.ts:11`, `GOOGLE_APPS_SCRIPT_v7.2.js:12`, `functions/index.js:23` (`'Welcome@123'`) | **Still Open in Live Code** — Hardcoded secret fallback exists in all 3 files; `GOOGLE_APPS_SCRIPT_v7.2.js:90` (`check_Access`) also bypasses the secret check before `line 92`. |
| **Unauthenticated Bulk Drive Read (`get_files`)** | `functions/index.js:1787-1823` (`proxyDriveUpload`) & `GOOGLE_APPS_SCRIPT_v7.2.js:103, 211` | **Still Open in Live Code** — `proxyDriveUpload` allows unauthenticated `get_files` and `upload`, and `get_files` only checks `startsWith('SUB-')`, letting anyone enumerate active employee Drive folders by passing `uniqueId: "HY..."` or `"UDF-..."`. |
| **Permissive Firestore Rules on Core Collections** | `firestore.rules:114` (`employees`), `153` (`onboarding_submissions`), `187` (`draft_submissions`), `249` (`leave_requests`), `319` (`audit_logs`), `337` (`notifications`), `352-502` (admin config collections) | **Still Open in Live Code** — `onboarding_submissions` update (`line 172`) allows anonymous updates whenever `status in ['draft', 'incomplete', 'pending', 'rejected']`; `draft_submissions` (`line 189`) allows any non-anonymous user to read all drafts; `audit_logs` (`line 322`) allows unauthenticated writes with `performedBy == 'anonymous'`; and 18 operational collections (`lines 352-502`) allow full `read` to any non-anonymous employee. |
| **Unatomic Multi-Document Mutations** | `src/services/employeeService.ts:1833-1910` (`approveOnboardingSubmission`), `2343-2407` (`relieveEmployee`), `2413-2538` (`rejoinEmployee`), `App.tsx:2038-2065` | **Still Open in Live Code** — Sequential `setDoc`/`updateDoc`/`deleteDoc` calls without `writeBatch` or `runTransaction` leave split state if any intermediate step fails. |
| **Dynamic Tailwind Classes Stripped in Build** | `components/AdminPortalPage.tsx:3331-3349` & `components/EmployeePortalPage.tsx:669` | **Still Open in Live Code** — `bg-${stat.color}-500/10`, `text-${stat.color}-600`, and `bg-${item.color}-50` are dynamically interpolated and purged by Tailwind in production builds. |
| **Duplicate `onSnapshot` Listeners on 4 Collections** | `App.tsx:863-917` vs `src/contexts/DataContext.tsx:266-315` | **Still Open in Live Code** — Both `App.tsx` and `DataContext.tsx` attach concurrent real-time `onSnapshot` listeners to `leave_requests`, `account_updates`, `resignations`, and `disciplinary_actions`, doubling Firestore read billing. |
| **Hardcoded `'2026'` Leave Year & UTC Date Parsing** | `App.tsx:969`, `src/contexts/DataContext.tsx:200`, `src/services/employeeService.ts:2072` | **Still Open in Live Code** — `year: '2026'` is hardcoded, and `new Date(startDate)` parses `YYYY-MM-DD` as UTC midnight while `.getDay()` checks local time. |

Would you like me to generate the patched files for any of these (starting with `functions/index.js`, `firestore.rules`, `storage.rules`, `src/contexts/DataContext.tsx`, and `App.tsx`)?
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-10-14T16:21:06+05:30.

The user's current state is as follows:
Active Document: z:\HR PORTAL\.env.local (LANGUAGE_UNSPECIFIED)
Cursor is on line: 1
Other open documents:
- z:\HR PORTAL\.env (LANGUAGE_UNSPECIFIED)
- z:\UDF_SUBDOMAINS\.gitignore (LANGUAGE_UNSPECIFIED)
- z:\HR PORTAL\.env.local (LANGUAGE_UNSPECIFIED)
- z:\HR PORTAL\.env.example (LANGUAGE_UNSPECIFIED)
- z:\HR PORTAL\.env.employee (LANGUAGE_UNSPECIFIED)
</ADDITIONAL_METADATA>


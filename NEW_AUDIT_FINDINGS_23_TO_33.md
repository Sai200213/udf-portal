# UDF Subdomains — Deep Codebase Audit (Findings 23 to 33)

**Document Created:** October 1, 2026  
**Scope:** Exhaustive code-level audit covering `firestore.rules`, `storage.rules`, `functions/index.js`, `GOOGLE_APPS_SCRIPT_v7.2.js`, client services (`src/services/*`), and core components (`components/*`, `App.tsx`).  
**Status:** All findings verified with exact line numbers, failure mechanisms, and remediation steps.

---

## Executive Summary

| Finding | Classification | Component / Location | Severity | Impact |
|---|---|---|---|---|
| **Finding 23** | Authentication Bypass | [src/services/authService.ts:L90-101](file:///z:/UDF_SUBDOMAINS/src/services/authService.ts#L90-L101) | **High** | Relieved employees can still log into the Employee Portal |
| **Finding 24** | Operational Bug / Logic | [components/BlogDashboardPage.tsx:L205-227](file:///z:/UDF_SUBDOMAINS/components/BlogDashboardPage.tsx#L205-L227) | **Medium** | Reward redemption deducts points without creating any order/fulfillment record |
| **Finding 25** | Compliance / Data Loss | [src/services/engagementService.ts:L276-291](file:///z:/UDF_SUBDOMAINS/src/services/engagementService.ts#L276-L291) | **High** | Workplace grievances & POSH complaints have zero admin UI/consumer |
| **Finding 26** | Authentication Failure | [App.tsx:L717-726](file:///z:/UDF_SUBDOMAINS/App.tsx#L717-L726) vs [functions/index.js:L2325-2357](file:///z:/UDF_SUBDOMAINS/functions/index.js#L2325-L2357) | **High** | Uppercase or mixed-case staff usernames permanently fail login |
| **Finding 27** | Permission / Authorization | [firestore.rules:L44-59](file:///z:/UDF_SUBDOMAINS/firestore.rules#L44-L59) vs [firestore.rules:L25-30](file:///z:/UDF_SUBDOMAINS/firestore.rules#L25-L30) | **High** | Legacy `/staff/` users have role `'none'` and fail all granular permissions |
| **Finding 28** | Operational Blocker | [src/services/storageService.ts:L184-185](file:///z:/UDF_SUBDOMAINS/src/services/storageService.ts#L184-L185) | **High** | Non-OCR applicants crash on document upload due to unauthenticated guest state |
| **Finding 29** | Storage Security Failure | [src/services/storageService.ts:L188-204](file:///z:/UDF_SUBDOMAINS/src/services/storageService.ts#L188-L204) vs [storage.rules:L70-76](file:///z:/UDF_SUBDOMAINS/storage.rules#L70-L76) | **High** | Draft attachments saved to `onboarding/{draftId}` are rejected by Storage Rules |
| **Finding 30** | Critical Information Leak | [firestore.rules:L115-120](file:///z:/UDF_SUBDOMAINS/firestore.rules#L115-L120) & [L150-153](file:///z:/UDF_SUBDOMAINS/firestore.rules#L150-L153) | **Critical** | Active correction token exposes entire employee record without requiring the token |
| **Finding 31** | Security Exception | [src/services/employeeService.ts:L4444-4470](file:///z:/UDF_SUBDOMAINS/src/services/employeeService.ts#L4444-L4470) | **Medium** | Candidate correction submission crashes trying to execute admin query on other submissions |
| **Finding 32** | Forgery & Data Exposure | [GOOGLE_APPS_SCRIPT_v7.2.js:L39-96](file:///z:/UDF_SUBDOMAINS/GOOGLE_APPS_SCRIPT_v7.2.js#L39-L96) & [L218](file:///z:/UDF_SUBDOMAINS/GOOGLE_APPS_SCRIPT_v7.2.js#L218) | **Critical** | Apps Script accepts forged JWTs and marks all employee documents public |
| **Finding 33** | Account Takeover | [functions/index.js:L2381-2436](file:///z:/UDF_SUBDOMAINS/functions/index.js#L2381-L2436) | **Critical** | `syncStaffGoogleLogin` links accounts without checking `email_verified`, enabling SuperAdmin takeover |

---

## Detailed Findings Breakdown

### Finding 23: Relieved Employee Authentication Bypass in `authService.ts`
- **Location**:
  - [src/services/authService.ts:L90-101](file:///z:/UDF_SUBDOMAINS/src/services/authService.ts#L90-L101)
  - [src/services/employeeService.ts:L2248-2257](file:///z:/UDF_SUBDOMAINS/src/services/employeeService.ts#L2248-L2257)
- **Root Cause**:
  When relieving an employee, `employeeService.ts:relieveEmployee` updates `onboarding_submissions` with `{ isRelieved: true, relievingDate, relievingReason }`. It does **not** set `isActive: false` or change `status` from `'Approved'` to `'Relieved'`.  
  In `authService.ts:getEmployeeProfile`, when resolving via fallback step 4 (`onboarding_submissions`):
  ```typescript
  if (empData.isDisabled === true || empData.isActive === false || empData.status === 'Relieved' || empData.status === 'Terminated') {
      throw new Error("This account is no longer active. Relieved employees cannot log in.");
  }
  ```
  Because `empData.status` is still `'Approved'`, `empData.isActive` is undefined, and `empData.isRelieved` is **never checked**, relieved self-onboarded employees bypass deactivation and log straight into the Employee Portal.
- **Impact**: Relieved staff and guards retain unauthorized access to internal shift details, company documents, and confidential employee records post-termination.
- **Remediation**:
  1. In `src/services/authService.ts:getEmployeeProfile`, add `empData.isRelieved === true` to the disqualification check.
  2. In `src/services/employeeService.ts:relieveEmployee`, explicitly update `onboarding_submissions` with `isActive: false` and `status: 'Relieved'`.

---

### Finding 24: Unrecorded Reward Redemptions (Client-Only Point Drain with Zero Fulfillment)
- **Location**:
  - [components/BlogDashboardPage.tsx:L205-227](file:///z:/UDF_SUBDOMAINS/components/BlogDashboardPage.tsx#L205-L227)
- **Root Cause**:
  In `BlogDashboardPage.tsx:claimReward`, claiming an item (e.g. jacket, bottle, cap) decrements local `points` and executes a `setDoc` on `user_engagement`. It **never creates an order record**, generates no notification to operations/HR, triggers no audit log, and captures no shipping or site delivery details.
- **Impact**: If points were ever updated, rewards would vanish from the employee's point balance without creating any record for administrators to fulfill or dispatch the prize.
- **Remediation**:
  Create a dedicated `reward_redemptions` collection or a Cloud Function `redeemGamificationReward` that verifies point balance, records the employee ID, item ID, delivery site, and timestamp, and notifies HR operations before deducting points.

---

### Finding 25: Grievances & Complaints Data Black Hole (No Consumer UI in Admin Portal)
- **Location**:
  - [src/services/engagementService.ts:L276-291](file:///z:/UDF_SUBDOMAINS/src/services/engagementService.ts#L276-L291)
  - [firestore.rules:L427-431](file:///z:/UDF_SUBDOMAINS/firestore.rules#L427-L431)
- **Root Cause**:
  Employees submit complaints, POSH/harassment reports, safety hazard disclosures, and wage disputes via `BlogDashboardPage.tsx` and `EmployeeEngagementHub.tsx`, saving documents into `/complaints`. However, across the entire project codebase, there is **zero admin interface, tab, or listener** that queries or displays documents from `/complaints`.
- **Impact**: Critical statutory grievances (e.g. safety hazards, POSH/harassment reports, wage disputes) are permanently lost in Firestore with no administrative visibility or resolution workflow.
- **Remediation**:
  Build an Admin Grievance Management tab in the Admin Portal or dispatch real-time email alerts to the HR/compliance team whenever a document is created in `/complaints`.

---

### Finding 26: Uppercase / Mixed-Case Username Permanent Login Lockout
- **Location**:
  - [App.tsx:L717-726](file:///z:/UDF_SUBDOMAINS/App.tsx#L717-L726)
  - [functions/index.js:L2325-2357](file:///z:/UDF_SUBDOMAINS/functions/index.js#L2325-L2357) (`resolveUsernameToEmail`)
- **Root Cause**:
  `App.tsx` forces username input to lowercase (`adminUsername.trim().toLowerCase()`). When `loginUser` calls `resolveUsernameToEmail`, it executes `.where('username', 'in', [cleanUsername, lowerUsername])`. Because Firestore's `in` queries are strictly case-sensitive, if a staff account was created with a capitalized username (e.g. `AdminUser` or `OpsLead`), the query fails. `loginUser` then treats `"adminuser"` as a raw email string without `@`, causing `signInWithEmailAndPassword` to throw `auth/invalid-email`.
- **Impact**: Any admin or staff member whose username contains uppercase letters is permanently unable to log in via username.
- **Remediation**:
  Store a normalized `usernameLower` field in `staff_accounts` and query against `usernameLower` in `resolveUsernameToEmail`.

---

### Finding 27: Legacy `/staff/` Users Missing Role & Permission Evaluations in `firestore.rules`
- **Location**:
  - [firestore.rules:L44-59](file:///z:/UDF_SUBDOMAINS/firestore.rules#L44-L59)
  - [firestore.rules:L25-30](file:///z:/UDF_SUBDOMAINS/firestore.rules#L25-L30)
- **Root Cause**:
  In `firestore.rules`, `isAdmin()` checks `users`, `staff`, and `staff_accounts`. However, `getUserRoleId()` and `getUserPermissionOverrides()` check **only** `/users/` and `/staff_accounts/`—completely omitting `/staff/$(request.auth.uid)`.
- **Impact**: Legacy staff members residing in `/staff/` receive `roleId = 'none'`. All `hasPermission(...)` evaluations resolve to `false`. They are locked out from approving submissions, managing leaves, and administering sites.
- **Remediation**:
  Update `getUserRoleId()` and `getUserPermissionOverrides()` in `firestore.rules` to include `/staff/$(request.auth.uid)`.

---

### Finding 28: Onboarding File Upload Crash for Non-OCR Applicants
- **Location**:
  - [src/services/storageService.ts:L184-185](file:///z:/UDF_SUBDOMAINS/src/services/storageService.ts#L184-L185)
  - [components/EmployeeFormPage.tsx:L1331-1334](file:///z:/UDF_SUBDOMAINS/components/EmployeeFormPage.tsx#L1331-L1334)
- **Root Cause**:
  In `storageService.ts:uploadSubmissionDocument`:
  ```typescript
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('User must be authenticated to upload documents.');
  ```
  `uploadSubmissionDocument` does **not** call `await ensureAuthenticated()`. In `EmployeeFormPage.tsx`, `ensureAuthenticated()` is only called inside the Aadhaar OCR callback (line 1333). If an applicant opts to manually upload their documents (PAN, marksheet, bank passbook, photo) without triggering the Aadhaar auto-extraction button, `auth.currentUser` is `null`, and the upload immediately aborts with an authentication error.
- **Impact**: Applicants who manually fill the joining form or upload files directly encounter immediate upload failures.
- **Remediation**:
  Call `await ensureAuthenticated()` inside `uploadSubmissionDocument` or upon `EmployeeFormPage.tsx` mount.

---

### Finding 29: Draft File Uploads Silently Blocked by `storage.rules`
- **Location**:
  - [src/services/storageService.ts:L188-204](file:///z:/UDF_SUBDOMAINS/src/services/storageService.ts#L188-L204)
  - [storage.rules:L70-76](file:///z:/UDF_SUBDOMAINS/storage.rules#L70-L76)
- **Root Cause**:
  When an applicant saves a draft, `storageService.ts:uploadSubmissionDocument` routes files to `onboarding/${rawDraftId}/${fieldId}/${safeName}`.  
  However, in `storage.rules`:
  ```
  match /onboarding/{submissionId} {
    allow write: if isAuthenticated() && isValidUpload() && (
      isAdmin() || isOnboardingOwner(submissionId) || request.auth.uid == submissionId
    );
  }
  ```
  `isOnboardingOwner` checks `/employees/$(submissionId)` and `/onboarding_submissions/$(submissionId)`. Since `rawDraftId` exists only in `draft_submissions`, and `request.auth.uid !== rawDraftId`, Firebase Storage rejects the upload with `storage/unauthorized`.
- **Impact**: Draft attachments fail to persist to cloud storage during the onboarding draft phase.
- **Remediation**:
  Update `storage.rules:isOnboardingOwner` to also verify ownership in `draft_submissions`, or store draft uploads under `/onboarding/$(request.auth.uid)/**`.

---

### Finding 30: Active Correction Token Exposes Entire Employee Profile Without Requiring Token Knowledge
- **Location**:
  - [firestore.rules:L115-120](file:///z:/UDF_SUBDOMAINS/firestore.rules#L115-L120)
  - [firestore.rules:L150-153](file:///z:/UDF_SUBDOMAINS/firestore.rules#L150-L153)
  - [components/employee/DataCorrectionPage.tsx:L145-156](file:///z:/UDF_SUBDOMAINS/components/employee/DataCorrectionPage.tsx#L145-L156)
- **Root Cause**:
  `firestore.rules:hasActiveCorrectionToken` checks:
  ```
  function hasActiveCorrectionToken(docData) {
    return docData.activeCorrectionToken != null &&
      exists(/databases/$(database)/documents/correction_requests/$(docData.activeCorrectionToken)) &&
      get(/databases/$(database)/documents/correction_requests/$(docData.activeCorrectionToken)).data.status == 'pending' &&
      get(/databases/$(database)/documents/correction_requests/$(docData.activeCorrectionToken)).data.expiresAt > request.time;
  }
  ```
  This rule **never verifies that the caller actually possesses or submitted the token!**  
  It only checks if the target record has an active token pending. As long as any employee or submission has a pending correction request, **anyone on the web** who executes `getDoc(doc(db, 'employees', empId))` can read their entire unmasked record (PAN, Aadhaar, salary, phone, banking details). Furthermore, `DataCorrectionPage.tsx` loads and displays this data before performing guest verification.
- **Impact**: Critical PII leak; public unauthenticated access to employee records during active correction windows.
- **Remediation**:
  Require token validation on the server side via Cloud Functions, rather than exposing the document directly via client Firestore rules.

---

### Finding 31: Candidate Correction Submission Crashes from Unauthorized Cross-Document Admin Query
- **Location**:
  - [src/services/employeeService.ts:L4444-4470](file:///z:/UDF_SUBDOMAINS/src/services/employeeService.ts#L4444-L4470)
  - [firestore.rules:L179](file:///z:/UDF_SUBDOMAINS/firestore.rules#L179)
- **Root Cause**:
  When a candidate submits their corrected details via [submitCorrectionResponse](file:///z:/UDF_SUBDOMAINS/src/services/employeeService.ts#L4226), client code runs:
  ```typescript
  const qPending = query(
      collection(db, SUBMISSIONS_COLLECTION),
      where("status", "==", "Pending Review")
  );
  const pendingSnap = await getDocs(qPending);
  for (const docSnap of pendingSnap.docs) {
      ...
      await updateDoc(doc(db, SUBMISSIONS_COLLECTION, docSnap.id), { duplicateCheck: cleanFreshDup });
  }
  ```
  In `firestore.rules`, `allow list: if isAdmin();`. Candidates on `/correct-details` are unauthenticated or guest users, causing `getDocs(qPending)` and the subsequent cross-submission `updateDoc` calls to throw `permission-denied`.
- **Impact**: Client code attempts an administrative cross-collection query and cross-user update, generating security permission exceptions on submission.
- **Remediation**:
  Move the duplicate re-indexing logic to a background Cloud Function triggered by Firestore document updates.

---

### Finding 32: Google Apps Script Unverified JWT Forgery & Public Document Sharing Exploit
- **Location**:
  - [GOOGLE_APPS_SCRIPT_v7.2.js:L39-96](file:///z:/UDF_SUBDOMAINS/GOOGLE_APPS_SCRIPT_v7.2.js#L39-L96)
  - [GOOGLE_APPS_SCRIPT_v7.2.js:L165](file:///z:/UDF_SUBDOMAINS/GOOGLE_APPS_SCRIPT_v7.2.js#L165)
  - [GOOGLE_APPS_SCRIPT_v7.2.js:L218](file:///z:/UDF_SUBDOMAINS/GOOGLE_APPS_SCRIPT_v7.2.js#L218)
- **Root Cause**:
  1. `verifyFirebaseToken` parses JWT parts without cryptographic signature verification (splits on `.`, decodes payload base64, and checks `aud === PROJECT_ID`). Any external entity can forge an unsigned token and execute actions like `submit_to_form` to spam Google Forms/Sheets.
  2. Line 218 explicitly marks every uploaded file with:
     ```javascript
     file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
     ```
     This makes all uploaded employee identity documents (Aadhaar cards, PAN cards, bank passbooks) publicly viewable without authentication to anyone with the link.
- **Impact**: Spoofed Google Form submissions and public exposure of sensitive employee identification documents on Google Drive.
- **Remediation**:
  Enforce signature verification using Google Public Keys (`UrlFetchApp.fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com')`) and restrict Google Drive folder permissions to company domain only.

---

### Finding 33: Unverified Email Account Takeover in `syncStaffGoogleLogin`
- **Location**:
  - [functions/index.js:L2381-2436](file:///z:/UDF_SUBDOMAINS/functions/index.js#L2381-L2436)
- **Root Cause**:
  `syncStaffGoogleLogin` associates a logged-in user with existing staff/admin accounts purely based on email:
  ```javascript
  const email = (request.auth.token.email || '').toLowerCase().trim();
  ...
  const userQuery = await db.collection('users').where('email', '==', email).limit(1).get();
  ```
  It **never checks `request.auth.token.email_verified === true`**.  
  An attacker can create a standard Firebase Auth account (or unverified social login) using an admin's email address, invoke `syncStaffGoogleLogin`, and have the Cloud Function duplicate the target SuperAdmin account data under their own UID.
- **Impact**: Critical privilege escalation allowing unauthorized takeover of SuperAdmin or Staff accounts.
- **Remediation**:
  Enforce `if (!request.auth.token.email_verified) throw new functions.https.HttpsError('permission-denied', 'Email must be verified');` at the top of `syncStaffGoogleLogin`.

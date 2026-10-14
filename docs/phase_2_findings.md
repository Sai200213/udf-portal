# 🟠 Phase 2: Onboarding Pipeline, Storage Isolation & File Uploads

All 6 findings that prevent applicants from completing onboarding or cause document permission crashes.

---

## Category 2A: Onboarding Form & Draft Storage Failures

---

### Finding 28: Onboarding File Upload Crash for Non-OCR Applicants

**What's the problem?**
When a new candidate fills out the joining form on your website, they can either scan their Aadhaar via OCR or manually upload documents. The OCR button calls `ensureAuthenticated()` to sign in the guest user. But if the candidate skips OCR and directly uploads files (PAN card, marksheet, passbook, photo), `uploadSubmissionDocument` checks `auth.currentUser?.uid` — which is `null` because `ensureAuthenticated()` was never called. The upload immediately crashes.

**Where?**
- [storageService.ts:L184-185](file:///z:/UDF_SUBDOMAINS/src/services/storageService.ts#L184-L185)
- [EmployeeFormPage.tsx](file:///z:/UDF_SUBDOMAINS/components/EmployeeFormPage.tsx#L1331)

**When does it happen?**
When a new candidate manually uploads joining documents without clicking the Aadhaar OCR button first.

**How to check on website:**
1. Open your public joining form URL (e.g., `udfonline.in/join`)
2. Fill in basic details manually (name, phone, etc.)
3. **Don't** click "Scan Aadhaar" 
4. Try to upload a PAN card or photo directly
5. Open browser DevTools → Console
6. You'll see: `Error: User must be authenticated to upload documents`

**Still exists?** ✅ YES — [storageService.ts:L184](file:///z:/UDF_SUBDOMAINS/src/services/storageService.ts#L184) still has the raw `uid` check without calling `ensureAuthenticated()`.

---

### Finding 29 & 48: Draft File Uploads Blocked by Storage Rules

**What's the problem?**
When a candidate saves their joining form as a draft, files go to `onboarding/${draftId}/...` in Firebase Storage. But `storage.rules` only checks if the user owns a document in `employees` or `onboarding_submissions` collections. Draft documents live in `draft_submissions`, which is **not checked**. So Firebase Storage rejects the upload as unauthorized.

**Where?**
- [storage.rules:L70-76](file:///z:/UDF_SUBDOMAINS/storage.rules#L70-L76)
- [storageService.ts:L188-204](file:///z:/UDF_SUBDOMAINS/src/services/storageService.ts#L188-L204)

**When does it happen?**
When a candidate clicks "Save Draft" on the joining form and tries to upload attachments.

**How to check on website:**
1. Open the joining form
2. Fill partial details and upload a document
3. Click "Save as Draft"
4. If you look at DevTools Console, you'll see `storage/unauthorized` error on any file attached to the draft

**Still exists?** ✅ YES — [storage.rules:L47-49](file:///z:/UDF_SUBDOMAINS/storage.rules#L47-L49) shows `isOnboardingOwner` just redirects to `isEmployeeOwner`, which only checks `employees` and `onboarding_submissions`, not `draft_submissions`.

---

### Finding 52: Purging Old Drafts Deletes Live Employee Documents

**What's the problem?**
When an admin clicks "Purge Old Drafts (>30 Days)" on the Drafts Management page, the system deletes the draft record AND runs `deleteStorageFolder('onboarding/' + data.ownerUid)`. The problem: if that applicant later completed their onboarding and became an active employee, their approved documents are still stored under `onboarding/${ownerUid}`. The purge **permanently destroys** the active employee's verified documents.

**Where?**
- [employeeService.ts:L202-204](file:///z:/UDF_SUBDOMAINS/src/services/employeeService.ts#L202-L204)

**When does it happen?**
When an admin purges drafts older than 30 days, and any of those drafts belong to applicants who are now active employees.

**How to check on website:**
1. Go to Admin Portal → Drafts Management
2. Look at drafts older than 30 days
3. Check if any of those drafts have `ownerUid` matching a currently active employee
4. If you click "Purge Old Drafts", their joining documents (Aadhaar, PAN, marksheet) in Firebase Storage would be wiped

**Still exists?** ✅ YES — [employeeService.ts:L204](file:///z:/UDF_SUBDOMAINS/src/services/employeeService.ts#L204) still has `await deleteStorageFolder('onboarding/${data.ownerUid}')` without checking if that employee is now active.

---

## Category 2B: Employee Storage & Bucket Permissions

---

### Finding 34: Google Login Storage Rule Deadlock

**What's the problem?**
When an employee signs in via Google, the Cloud Function `employeeGoogleLogin` updates their Firestore record to set `uid: googleUid`. But it mints the custom token using their `portalId` (like `UDF-2026-XXXX`). So after login, `request.auth.uid = portalId`, but Firestore has `uid = googleUid`. When the employee tries to view or upload their own documents, `storage.rules` checks if `uid == request.auth.uid` — it doesn't match. They're locked out of their own files.

**Where?**
- [functions/index.js](file:///z:/UDF_SUBDOMAINS/functions/index.js) — `employeeGoogleLogin` function
- [storage.rules:L31-44](file:///z:/UDF_SUBDOMAINS/storage.rules#L31-L44)

**When does it happen?**
Every time an employee logs into the Employee Portal using "Sign in with Google."

**How to check on website:**
1. Log into the Employee Portal using Google Sign-In
2. Try to view or download your joining documents (Aadhaar, PAN, etc.)
3. Try to upload a profile photo or leave attachment
4. DevTools Console will show `storage/unauthorized` error

**Still exists?** ✅ YES — [storage.rules:L31-44](file:///z:/UDF_SUBDOMAINS/storage.rules#L31-L44) does NOT check `portalId` field. The `isEmployeeOwner` function only checks `linkedUid`, `uid`, and `ownerUid` — but after Google login, those fields hold `googleUid`, not `portalId`.

---

### Finding 38: Confidential Medical/Resignation Files Routed to Public Google Drive

**What's the problem?**
When employees submit medical leave (with doctor's note) or resignation (with proof letter), the files are uploaded to Google Drive via the Apps Script. The Apps Script sets **every uploaded file** to `ANYONE_WITH_LINK` sharing. This means doctor's prescriptions, diagnosis letters, and resignation documents are publicly viewable by anyone with the URL.

**Where?**
- [App.tsx](file:///z:/UDF_SUBDOMAINS/App.tsx#L1134) — where leave/resignation files are sent to Drive
- [GOOGLE_APPS_SCRIPT_v7.2.js:L218](file:///z:/UDF_SUBDOMAINS/GOOGLE_APPS_SCRIPT_v7.2.js#L218) — `setSharing(ANYONE_WITH_LINK)`

**When does it happen?**
Every time an employee attaches a medical certificate to a leave request or uploads proof with a resignation.

**How to check on website:**
1. Go to Employee Portal → Request Leave → Medical Leave
2. Attach a doctor's note/medical certificate
3. Submit the request
4. As SuperAdmin, find the Drive URL stored in the request document
5. Open that URL in an incognito/private browser window (no login)
6. The document will be visible — meaning it's publicly accessible

**Still exists?** ✅ YES — [GOOGLE_APPS_SCRIPT_v7.2.js:L218](file:///z:/UDF_SUBDOMAINS/GOOGLE_APPS_SCRIPT_v7.2.js#L218) still has `file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)`.

> [!NOTE]
> You previously said you don't use Drive links in the portal. This is different from Finding 50 — here the concern is about **medical and resignation docs** specifically being sent to Drive instead of private Firebase Storage. The Drive links may be stored in Firestore request documents or forwarded via email to HR.

---

### Finding 39: BGV Storage Bucket Broken Authorization

**What's the problem?**
The Background Verification (BGV) storage folder allows **any authenticated user** to write files. The rule says: "if you're logged in, you can upload anything to any employee's BGV folder." A regular employee could upload fake clearance certificates to another employee's BGV directory.

**Where?**
- [storage.rules:L113-116](file:///z:/UDF_SUBDOMAINS/storage.rules#L113-L116)

**When does it happen?**
Anytime — any logged-in user (employee, candidate, anyone) could write to `/employees/{anyEmployeeId}/bgv/`.

**How to check on website:**
1. Log in as a regular employee
2. Using browser DevTools or a script, try uploading a file to `employees/SOME_OTHER_EMPLOYEE_ID/bgv/fake_clearance.pdf`
3. The upload will succeed because storage.rules only checks `isAuthenticated()`, not `isAdmin()`

**Still exists?** ✅ YES — [storage.rules:L115](file:///z:/UDF_SUBDOMAINS/storage.rules#L115) still says `allow write: if isAuthenticated() && isValidUpload();` without `isAdmin()`.

---

## Summary Table

| Finding | Issue | Still Exists? | Fix Complexity |
|---|---|---|---|
| **28** | Upload crash for non-OCR candidates | ✅ YES | Easy — add `ensureAuthenticated()` call |
| **29 & 48** | Draft uploads blocked by storage rules | ✅ YES | Easy — add `draft_submissions` check to rules |
| **52** | Purging drafts deletes active employee docs | ✅ YES | Medium — check if employee is active before deleting |
| **34** | Google Login breaks file access | ✅ YES | Medium — add `portalId` check to storage rules |
| **38** | Medical/resignation docs public on Drive | ✅ YES | Medium — route to Firebase Storage instead |
| **39** | Any user can write to BGV folder | ✅ YES | Easy — add `isAdmin()` check |

---

> Reply with which ones to **fix** and which ones you want **clarification** on.

# Security & Performance Audit Report: HR Portal

This report details the findings, security implications, performance bottlenecks, and architectural issues discovered during an exhaustive review of the HR Portal codebase.

---

## 1. Portal ID & Identifier Consistency (Critical)

### Finding 1.1: Missing Identifier Fallback in Notification Subscriptions
* **File Name & Line Number:** [src/services/notificationService.ts](file:///Z:/HR%20PORTAL/src/services/notificationService.ts#L28-L55)
* **The Problem:** 
  `subscribeToNotifications` subscribes to Firestore notifications using only the primary `userId` (Firebase Auth UID) and the `roleId`. However, an employee has multiple possible identifiers (`portalId`, `employeeId`, and `uid`). If a Cloud Function or Admin Action dispatches a notification targeted to the user's `employeeId` or `portalId`, the client-side subscription will completely miss it.
* **The Impact:**
  Missing critical notifications on the employee's personal dashboard, leading to communication breakdowns and delayed workflow progress.
* **Suggested Fix:**
  Modify `subscribeToNotifications` to accept an array of identifiers `[portalId, employeeId, uid]` and execute an `"in"` query over `targetUserId`.

```diff
-export const subscribeToNotifications = (userId: string, roleId: string | undefined, callback: (notifs: Notification[]) => void) => {
-    const targets = [userId];
-    if (roleId) targets.push(`ROLE:${roleId}`);
-
-    const q = query(
-        collection(db, NOTIF_COL),
-        where("targetUserId", "in", targets),
-        limit(50)
-    );
+export const subscribeToNotifications = (
+    userIds: string | string[],
+    roleId: string | undefined,
+    callback: (notifs: Notification[]) => void
+) => {
+    const targets = (Array.isArray(userIds) ? userIds : [userIds]).filter(Boolean);
+    if (roleId) targets.push(`ROLE:${roleId}`);
+
+    if (targets.length === 0) {
+        return onSnapshot(
+            query(collection(db, NOTIF_COL), where("targetUserId", "==", "___dummy_nonexistent___")),
+            (snap) => callback([])
+        );
+    }
+
+    // Firestore 'in' query supports up to 10 targets
+    const q = query(
+        collection(db, NOTIF_COL),
+        where("targetUserId", "in", targets.slice(0, 10)),
+        limit(50)
+    );
```

### Finding 1.2: Missing Identifier Fallbacks in Submissions Subscription
* **File Name & Line Number:** [src/services/employeeService.ts](file:///Z:/HR%20PORTAL/src/services/employeeService.ts#L1011-L1061)
* **The Problem:**
  `subscribeToSubmissionsByUid` accepts only the user's Firebase Auth `uid` and queries `employeeId == uid`, `uid == uid`, and checks if the document ID matches `uid`. However, for self-onboarded approved users, their onboarding submission document ID is their `portalId` (e.g. `UDF-xxx`), which differs from their Firebase Auth `uid`.
* **The Impact:**
  %20Google or manual credentials may fail to retrieve their approved onboarding submissions on their dashboard.
* **Suggested Fix:**
  Upgrade `subscribeToSubmissionsByUid` to accept an array of possible identifiers `[portalId, employeeId, uid]` and search by all of them.

```diff
-export const subscribeToSubmissionsByUid = (uid: string, callback: (submissions: OnboardingSubmission[]) => void) => {
-    const qByEmpId = query(collection(db, SUBMISSIONS_COLLECTION), where("employeeId", "==", uid));
-    const qByUid = query(collection(db, SUBMISSIONS_COLLECTION), where("uid", "==", uid));
-    const docRef = doc(db, SUBMISSIONS_COLLECTION, uid);
+export const subscribeToSubmissionsByUid = (
+    ids: string | string[],
+    callback: (submissions: OnboardingSubmission[]) => void
+) => {
+    const queryIds = (Array.isArray(ids) ? ids : [ids]).filter(Boolean);
+    if (queryIds.length === 0) {
+        return () => callback([]);
+    }
+
+    const qByEmpId = query(collection(db, SUBMISSIONS_COLLECTION), where("employeeId", "in", queryIds));
+    const qByUid = query(collection(db, SUBMISSIONS_COLLECTION), where("uid", "in", queryIds));
+    const qByLinkedUid = query(collection(db, SUBMISSIONS_COLLECTION), where("linkedUid", "in", queryIds));
```

### Finding 1.3: Unstable Mismatched ID Resolution for Google Logins
* **File Name & Line Number:** [src/services/authService.ts](file:///Z:/HR%20PORTAL/src/services/authService.ts#L99-L118)
* **The Problem:**
  When `getEmployeeProfile` resolves an employee record during Google Login, it queries `onboarding_submissions` using `employeeId`. If the submission is not found (e.g. bulk-imported user without onboarding records), it falls back to:
  `portalId = empDocId || finalUid;`
  For Google logins, `finalUid` is the Google-specific UID, which can lead to mismatches if other sessions expect the employee ID or portal ID.
* **The Impact:**
  The resolved `portalId` will differ depending on the login provider used, leading to inconsistent queries on leaves, resignations, and updates, causing the user's dashboard data to go missing.
* **Suggested Fix:**
  Ensure a stable fallback chain using `employeeId` before defaulting to auth-provider specific UIDs.

```diff
             // Resolve global Portal ID (onboarding submission ID)
             let portalId = finalUid;
             if (collectionSource === 'onboarding_submissions') {
                 portalId = empDocId || finalUid;
             } else if (collectionSource === 'employees') {
                 try {
                     const { query: fbQuery, collection: fbCollection, where: fbWhere, getDocs: fbGetDocs, limit: fbLimit } = await import('firebase/firestore');
                     const subQuery = fbQuery(fbCollection(db, 'onboarding_submissions'), fbWhere("employeeId", "==", empData.employeeId || empDocId), fbLimit(1));
                     const subSnap = await fbGetDocs(subQuery);
                     if (!subSnap.empty) {
                         portalId = subSnap.docs[0].id;
                     } else {
-                        portalId = empDocId || finalUid;
+                        portalId = empData.employeeId || empDocId || finalUid;
                     }
                 } catch (e) {
                     log.warn('[authService] Could not resolve portalId for employee:', e);
-                    portalId = empDocId || finalUid;
+                    portalId = empData.employeeId || empDocId || finalUid;
                 }
             }
```

### Finding 1.4: Missing Standard Email Match Fallback in Google Login
* **File Name & Line Number:** [src/services/authService.ts](file:///Z:/HR%20PORTAL/src/services/authService.ts#L48-L69)
* **The Problem:**
  `getEmployeeProfile` queries `where("linkedGoogleEmail", "==", firebaseUser.email)`. If the employee has a matching `email` or `profileData.personalDetails.email` but has not yet logged in to link their Google account, their login will fail to resolve.
* **The Impact:**
  Onboarded or CSV-imported employees logging in via Google for the first time cannot resolve their employee record.
* **Suggested Fix:**
  Add a fallback query matching the standard `email` field when Google email matching fails.

```diff
         // 3. Fallback: Query by linkedGoogleEmail (for Google Sign-in users)
         if (!empData && firebaseUser.email) {
             try {
                 const emailQuery = query(collection(db, 'employees'), where("linkedGoogleEmail", "==", firebaseUser.email), limit(1));
                 const emailSnap = await getDocs(emailQuery);
                 if (!emailSnap.empty) {
                     empData = emailSnap.docs[0].data();
                     empDocId = emailSnap.docs[0].id;
                     // Update the uid field to the current Firebase UID for future lookups
                     try {
                         const { updateDoc: fbUpdateDoc } = await import('firebase/firestore');
                         await fbUpdateDoc(emailSnap.docs[0].ref, { uid: firebaseUser.uid });
                         log.log(`[authService] Updated uid field for employee ${empDocId} to match current login`);
                     } catch (e) {
                         log.warn('[authService] Could not update uid field:', e);
                     }
                 }
+                // Fallback: Query standard email field
+                if (!empData) {
+                    const stdEmailQuery = query(collection(db, 'employees'), where("email", "==", firebaseUser.email), limit(1));
+                    const stdSnap = await getDocs(stdEmailQuery);
+                    if (!stdSnap.empty) {
+                        empData = stdSnap.docs[0].data();
+                        empDocId = stdSnap.docs[0].id;
+                        // Auto-link Google email and UID
+                        const { updateDoc: fbUpdateDoc } = await import('firebase/firestore');
+                        await fbUpdateDoc(stdSnap.docs[0].ref, { uid: firebaseUser.uid, linkedGoogleEmail: firebaseUser.email });
+                    }
+                }
             } catch (err) {
```

### Finding 1.5: Case-Sensitivity Authentication Mismatches for Custom Employee IDs
* **File Name & Line Number:** [functions/index.js](file:///Z:/HR%20PORTAL/functions/index.js#L404-L418) and [src/utils/bulkImportUtils.ts](file:///Z:/HR%20PORTAL/src/utils/bulkImportUtils.ts#L717)
* **The Problem:**
  The `employeeLogin` Cloud Function normalizes login input via `employeeId.toUpperCase()`. However, the CSV bulk importer accepts raw user-entered `employeeId` from the CSV as-is. If the importer uploads records with lowercase IDs (e.g. `emp-002`), subsequent logins will fail because Firestore queries are strictly case-sensitive.
* **The Impact:**
  Legitimate bulk-imported employees with lowercase IDs will be locked out of the application.
* **Suggested Fix:**
  Force normalization (uppercase) in the bulk import parser when creating/mapping employee IDs.

### Finding 1.6: Active Session Disruption by Onboarding Navigation
* **File Name & Line Number:** [src/context/AuthContext.tsx](file:///Z:/HR%20PORTAL/src/context/AuthContext.tsx#L42-L49)
* **The Problem:**
  When `AuthContext` detects `portalType === 'onboarding'` in `localStorage` (which is written when loading the onboarding form), it immediately calls `setUser(null)` and suppresses profile resolution, wiping any active administrator or employee session.
* **The Impact:**
  Logged-in administrators will be signed out of their management panels simply by visiting or reviewing the public onboarding page.
* **Suggested Fix:**
  Only wipe state if the active Firebase Auth user is anonymous, preserving authenticated management/employee profile states.

### Finding 1.7: Cross-User Onboarding Data Leakage on Shared Devices
* **File Name & Line Number:** [src/services/authService.ts](file:///Z:/HR%20PORTAL/src/services/authService.ts#L368-L371)
* **The Problem:**
  `logoutUser` only clears the `portalType` from localStorage and calls `signOut(auth)`. It does not clear the files cached in IndexedDB (`fileSessionStore.ts`).
* **The Impact:**
  On shared workplace terminals (very common for security guards), subsequent applicants accessing the onboarding wizard will see and have access to the documents uploaded by the previous applicant.
* **Suggested Fix:**
  Trigger `clearFileSession()` inside the `logoutUser` utility.

### Finding 1.8: Access Control Leak - Full Access on Zero Site Assignments
* **File Name & Line Number:** [src/contexts/DataContext.tsx](file:///Z:/HR%20PORTAL/src/contexts/DataContext.tsx#L182-L204)
* **The Problem:**
  `scopedLeaveRequests`, `scopedAccountUpdateRequests`, `scopedResignationRequests`, and `scopedDisciplinaryActions` return the entire company-wide list when `allowedSiteIds.length === 0` (which occurs when a restricted Field Officer or site manager has no supervised site assignments).
* **The Impact:**
  Restricted field supervisors with zero active assignments are mistakenly granted full visibility over sensitive personal, medical, and disciplinary records of the entire company.
* **Suggested Fix:**
  Enforce returning an empty array `[]` when `allowedSiteIds` is empty for users who do not possess global view scope permissions.

```diff
     const scopedLeaveRequests = useMemo(() => {
         const hasAll = hasPermission(Permission.LEAVES_VIEW_SCOPE_ALL);
-        if (hasAll || !allowedSiteIds || allowedSiteIds.length === 0) return leaveRequests;
+        if (hasAll) return leaveRequests;
+        if (!allowedSiteIds || allowedSiteIds.length === 0) return [];
         return leaveRequests.filter(r => allowedSiteIds.includes(r.siteId || ''));
```

### Finding 1.9: Information Leak - Unfiltered Dashboard Metrics for Restricted Users
* **File Name & Line Number:** [src/services/employeeService.ts](file:///Z:/HR%20PORTAL/src/services/employeeService.ts#L143-L146)
* **The Problem:**
  The `getGlobalStats` helper filters pending onboarding submissions and active employee counts based on site restrictions, but fails to apply site filters to pending leaves, updates, profiles, and resignations.
* **The Impact:**
  Restricted Field Officers are shown company-wide pending counts on their dashboard top cards, leaking organizational totals and leading to UI mismatches when clicking into page lists.
* **Suggested Fix:**
  Apply site boundaries to all count queries in `getGlobalStats` when restricted.

### Finding 1.10: Access Control Leak - Site Filtering Bypass for Onboarding Drafts
* **File Name & Line Number:** [src/contexts/DataContext.tsx](file:///Z:/HR%20PORTAL/src/contexts/DataContext.tsx#L284-L287)
* **The Problem:**
  Unlike leaves, resignations, and disciplinary requests which are properly filtered by the supervisor's `allowedSiteIds`, the `drafts` list is not site-scoped in the administrator panel. A restricted Field Officer or Site Manager with zero or limited site assignments can view and search all active onboarding drafts company-wide.
* **The Impact:**
  Leaks sensitive in-progress personal information (including partial names, phone numbers, and addresses) of all candidates to restricted users.
* **Suggested Fix:**
  Compute a `scopedDrafts` list that filters out drafts whose associated location details (if specified) do not match the user's `allowedSiteIds`.

### Finding 1.11: Access Control Leak - Site Filtering Bypass for Deployment Site List
* **File Name & Line Number:** [App.tsx](file:///Z:/HR%20PORTAL/App.tsx#L1919-L1931)
* **The Problem:**
  Unlike the vacancy manager, master employee list, leaves, resignations, and disciplinary pages which correctly scope data by the caller's `allowedSiteIds`, the `AdminSiteManagementPage` does not accept or filter by `allowedSiteIds`.
* **The Impact:**
  A restricted Field Officer or site manager with zero or limited site assignments can view the entire company-wide list of active deployment sites, client settings, headcount numbers, subunit locations, and manager allocations.
* **Suggested Fix:**
  Pass `allowedSiteIds` into `AdminSiteManagementPage` and apply a site ID filter to the `sites` list rendered in the console.

```diff
       case AppView.ADMIN_PORTAL_SITES:
         return <AdminSiteManagementPage
-          sites={sites}
+          sites={isSuperAdmin ? sites : sites.filter(s => allowedSiteIds.includes(s.id))}
           setSites={setSites}
           submittedForms={submittedForms}
```

### Finding 1.12: Legacy Claims Lock Out Google Sign-In Users due to Token UID Mismatch
* **File Name & Line Number:** [functions/index.js](file:///Z:/HR%20PORTAL/functions/index.js#L1716-L1717) & [src/services/authService.ts](file:///Z:/HR%20PORTAL/src/services/authService.ts#L48-L69)
* **The Problem:**
  When a legacy employee claims their profile using a Google Account, the `claimEmployeeProfile` Cloud Function generates a custom token where the UID payload is set to the employee's ID or submission ID (`tokenUid = submissionId || trimmedId`) rather than their real Google Auth UID. Standard Google logins evaluate their real Google account UID. Furthermore, because this custom token logs the user in without an email record, the system is unable to record a `linkedGoogleEmail` in the submission.
* **The Impact:**
  After admin approval, the employee's active record in the `employees` collection is synced with `uid` set to the custom token's UID. The next time the employee logs in using standard Google Sign-In, the system fails to match their real Google UID or email, permanently locking them out of the application.
* **Suggested Fix:**
  Generate custom tokens using the user's real Google account UID (passed from client auth context) or sync the verified real Google UID and email directly to the onboarding submission record and employee record.

---

## 2. Bulk CSV Importer & Onboarding Logic

### Finding 2.1: Duplicate Verification Bypasses Bulk-Imported Employees
* **File Name & Line Number:** [src/utils/bulkImportUtils.ts](file:///Z:/HR%20PORTAL/src/utils/bulkImportUtils.ts#L543-L558)
* **The Problem:**
  `checkForDatabaseDuplicates` verifies phone duplicate conflicts by querying `profileData.[phoneFieldId]`. However, bulk-imported employee records created in [bulkImportUtils.ts:L813-818](file:///Z:/HR%20PORTAL/src/utils/bulkImportUtils.ts#L813-L818) do not store phone numbers there; they store them in `profileData.personalDetails.phoneNumber` and `data.[phoneFieldId]`.
* **The Impact:**
  Duplicate phone verification fails to match imported users, permitting duplicate employees to be imported.
* **Suggested Fix:**
  Query the stable `data.[phoneFieldId]` path (which is populated for both self-onboarded and imported employees) or query both fields.

```diff
         if (phoneNumber) {
-            // Fix: Query flat profileData field dynamically instead of nested non-existent path
-            const q = query(collection(db, EMPLOYEES_COLLECTION), where("profileData." + (phoneFieldId || 'eb3617dc-9f1d-475d-a2db-005b6bc2500c'), "==", phoneNumber));
+            // Query both data.[phoneFieldId] and profileData.personalDetails.phoneNumber
+            const q = query(collection(db, EMPLOYEES_COLLECTION), where("data." + (phoneFieldId || 'eb3617dc-9f1d-475d-a2db-005b6bc2500c'), "==", phoneNumber));
             const snap = await getDocs(q);
```

### Finding 2.2: Scientific Notation / Key Skipping for Aadhaar Numbers
* **File Name & Line Number:** [src/utils/bulkImportUtils.ts](file:///Z:/HR%20PORTAL/src/utils/bulkImportUtils.ts#L737-L750)
* **The Problem:**
  `checkForDatabaseDuplicates` processes rows but ignores standard keyword matching. If the CSV header uses a different keyword prefix than the form field label (e.g. `Aadhar No` vs `Aadhar Card No`), the field is completely skipped.
* **The Impact:**
  Aadhaar numbers or phone numbers fail to import and fall back to hardcoded static UUIDs.
* **Suggested Fix:**
  Add a fuzzy keyword matcher matching `aadhar`/`aadhaar` labels.

```diff
             // Copy any extra fields
             Object.keys(row).forEach(key => {
                 if (!['fullName', 'phoneNumber', 'dateOfBirth', 'location', 'employeeId', 'designation', 'joiningDate'].includes(key)) {
                     // Try to match to a form field
                     const matchingField = allFields.find(f => {
                         const label = f.label?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
                         const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
-                        return label === normalizedKey || f.id === key;
+                        if (label === normalizedKey || f.id === key) return true;
+                        // Fuzzy matching for Aadhaar variations
+                        const isAadharField = label.includes('aadhar') || label.includes('aadhaar');
+                        const isAadharKey = normalizedKey.includes('aadhar') || normalizedKey.includes('aadhaar');
+                        return isAadharField && isAadharKey;
                     });
                     if (matchingField) {
                         formData[matchingField.id] = row[key] || '';
                     }
                 }
             });
```

### Finding 2.3: Inconsistent Validation Skipping for Radio Buttons
* **File Name & Line Number:** [src/utils/applyValidationRules.ts](file:///Z:/HR%20PORTAL/src/utils/applyValidationRules.ts#L112)
* **The Problem:**
  The validation rule migration script skips fields of type `Radio Button`. However, the actual FieldType enum value for radio options in [types.ts](file:///Z:/HR%20PORTAL/types.ts#L9) is `Radio Buttons` (plural).
* **The Impact:**
  The migration script attempts to process and append rules to Radio Button fields, causing layout errors and validation noise.
* **Suggested Fix:**
  Update the validation filter string to use the plural form.

```diff
-                if (!field.type || ['Section Header', 'Checkbox (multiple choices)', 'Information Text', 'Radio Button'].includes(field.type)) {
+                if (!field.type || ['Section Header', 'Checkbox (multiple choices)', 'Information Text', 'Radio Buttons'].includes(field.type)) {
```

### Finding 2.4: Numeric Location Code Import Parsing Crash
* **File Name & Line Number:** [src/utils/subUnitUtils.ts](file:///Z:/HR%20PORTAL/src/utils/subUnitUtils.ts#L132)
* **The Problem:**
  `validateBulkImportLocations` normalizes locations using `loc.toLowerCase()`. If a row contains a numeric post code or facility ID (e.g. `1024` or `42`), PapaParse can parse it as a number instead of a string.
* **The Impact:**
  The validation page throws a `TypeError: loc.toLowerCase is not a function` error and crashes the entire importer UI.
* **Suggested Fix:**
  Convert the cell input to a string before normalization.

```diff
-        const normalized = loc.toLowerCase().trim();
+        const normalized = String(loc).toLowerCase().trim();
```

### Finding 2.5: Account Update Request Proof Documents Unreachable by Admin
* **File Name & Line Number:** [components/AdminAccountUpdateManagementPage.tsx](file:///Z:/HR%20PORTAL/components/AdminAccountUpdateManagementPage.tsx#L143-L147)
* **The Problem:**
  In the Account Updates details view, the admin panel fails to display or link to the `supportingDocument` field of the request. Additionally, if the updated value itself is a file upload, its Google Drive URL string is rendered inside a standard `<p>` text element instead of an anchor (`<a>`) tag.
* **The Impact:**
  Administrators cannot download, view, or verify the proof files uploaded by employees to justify their profile edits, blocking verification workflows.
* **Suggested Fix:**
  Render clickable links (`<a href="..." target="_blank">`) for both the `supportingDocument` and file-type `requestedValue` fields in the details modal.

### Finding 2.6: Daylight Savings Date Calculation Bug in Leave Validation
* **File Name & Line Number:** [components/employee/EmployeeLeaveRequestPage.tsx](file:///Z:/HR%20PORTAL/components/employee/EmployeeLeaveRequestPage.tsx#L111)
* **The Problem:**
  Days requested is calculated via `Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1`. In regions undergoing Daylight Savings (DST) transitions or timezone adjustments, the time difference between midnights can be 23 or 25 hours. When the difference is 25 hours, the result evaluates to a decimal fraction (e.g. `2.04`), and `Math.ceil` rounds it up, counting 2 days as 3 requested days.
* **The Impact:**
  Incorrect leave balance evaluations, causing users to get blocked from requesting leaves due to false balance shortage errors.
* **Suggested Fix:**
  Compare UTC-adjusted midnights or use `Math.round` over the division to safely handle DST discrepancies.

```diff
-    const daysRequested = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // Inclusive
+    const startUTC = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
+    const endUTC = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
+    const daysRequested = Math.round((endUTC - startUTC) / (1000 * 3600 * 24)) + 1; // Inclusive
```

### Finding 2.7: Timezone Misalignment - Device Clock Attendance Date Inconsistency
* **File Name & Line Number:** [src/services/engagementService.ts](file:///Z:/HR%20PORTAL/src/services/engagementService.ts#L18-L27)
* **The Problem:**
  The `getLocalDateString` helper generates date strings (e.g., `YYYY-MM-DD`) based on the device's local system timezone (`new Date()`). Since the server and payroll operations are configured to run in India Standard Time (IST - `Asia/Kolkata`), employees accessing the portal with misconfigured device clocks or from different timezones will record attendance under incorrect calendar days.
* **The Impact:**
  Causes streaks to break and duplicate records to be created for the same payroll day.
* **Suggested Fix:**
  Force date calculations to evaluate under IST timezone offset rules.

```diff
 export const getLocalDateString = (offsetDays = 0) => {
-    const d = new Date();
+    // Force evaluation in India Standard Time (IST = UTC + 5:30)
+    const d = new Date(new Date().getTime() + (5.5 * 60 * 60 * 1000));
     if (offsetDays !== 0) {
         d.setDate(d.getDate() + offsetDays);
     }
-    const year = d.getFullYear();
-    const month = String(d.getMonth() + 1).padStart(2, '0');
-    const day = String(d.getDate()).padStart(2, '0');
+    const year = d.getUTCFullYear();
+    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
+    const day = String(d.getUTCDate()).padStart(2, '0');
     return `${year}-${month}-${day}`;
 };
```

### Finding 2.8: Legacy CSV Importer Duplicate Record Generation on Re-Import
* **File Name & Line Number:** [src/services/adminService.ts](file:///Z:/HR%20PORTAL/src/services/adminService.ts#L322-L333)
* **The Problem:**
  In `bulkUploadLegacyImports`, every imported record is written using a freshly generated Firestore document ID (`doc(collection(db, LEGACY_IMPORTS_COLLECTION))`). This completely ignores the existing `row.id` resolved by the Smart Merge logic in `AdminLegacySystemsPage.tsx`.
* **The Impact:**
  Re-uploading a legacy import CSV to update employee details creates duplicate legacy profiles in Firestore rather than overwriting/updating the existing documents.
* **Suggested Fix:**
  Use the existing `row.id` (if present) to target the document reference during the batch set operation.

```diff
 export const bulkUploadLegacyImports = async (rows: LegacyImportedEmployee[]) => {
     const BATCH_LIMIT = 490;
     for (let i = 0; i < rows.length; i += BATCH_LIMIT) {
         const batch = writeBatch(db);
         const chunk = rows.slice(i, i + BATCH_LIMIT);
         chunk.forEach(row => {
-            const ref = doc(collection(db, LEGACY_IMPORTS_COLLECTION));
+            const ref = row.id ? doc(db, LEGACY_IMPORTS_COLLECTION, row.id) : doc(collection(db, LEGACY_IMPORTS_COLLECTION));
             batch.set(ref, { ...row, id: ref.id });
         });
         await batch.commit();
     }
 };
```

### Finding 2.9: Timezone/DST Parsing Date Shift in Leave and Resignation Lists
* **File Name & Line Number:** [components/employee/EmployeeLeaveRequestPage.tsx](file:///Z:/HR%20PORTAL/components/employee/EmployeeLeaveRequestPage.tsx#L283-L296) and [components/employee/EmployeeResignationPage.tsx](file:///Z:/HR%20PORTAL/components/employee/EmployeeResignationPage.tsx#L248-L250)
* **The Problem:**
  In both leave request and resignation list views, dates stored as `YYYY-MM-DD` string attributes are parsed via `new Date(dateString)` and formatted using `.toLocaleDateString()`. Because `YYYY-MM-DD` strings are parsed as UTC midnight by default, formatting them with local methods on devices in timezones behind UTC (like EST/PST) shifts the date back by one day.
* **The Impact:**
  Displays incorrect dates (e.g. August 11 instead of August 12) for remote employees or managers based in timezones behind UTC, leading to data confusion.
* **Suggested Fix:**
  Parse date components manually (e.g. splitting the string) or force parsing in UTC before displaying.

### Finding 2.10: Profile Claim DOB Verification Failure due to Date Format Misalignment
* **File Name & Line Number:** [components/AdminLegacySystemsPage.tsx](file:///Z:/HR%20PORTAL/components/AdminLegacySystemsPage.tsx#L169) and [functions/index.js](file:///Z:/HR%20PORTAL/functions/index.js#L1694)
* **The Problem:**
  When importing legacy employees in `AdminLegacySystemsPage.tsx`, the `dateOfBirth` field is imported directly as a raw string from the CSV without any format standardization. If the Excel/CSV uses a common Indian format (like `DD/MM/YYYY` or `DD-MM-YYYY`), it is saved as-is. However, when an employee claims their profile via the `LegacyClaimModal`, the browser's native `<input type="date">` submits the date in `YYYY-MM-DD` format. During validation, the Cloud Function `claimEmployeeProfile` normalizes both strings by stripping special characters, which produces different strings for different formats (e.g., `31121995` vs `19951231`).
* **The Impact:**
  Active employees attempting to claim their legacy profiles will be blocked by verification errors despite entering their correct date of birth.
* **Suggested Fix:**
  Standardize `dateOfBirth` using the `parseFlexibleDate` helper (from `bulkImportUtils.ts`) during legacy CSV imports, or parse both dates into unified Date objects before comparing them in the `claimEmployeeProfile` Cloud Function.

### Finding 2.11: Bulk CSV Importer Failure to Detect Duplicate Aadhaar Cards
* **File Name & Line Number:** [src/utils/bulkImportUtils.ts](file:///Z:/HR%20PORTAL/src/utils/bulkImportUtils.ts#L524)
* **The Problem:**
  The duplicate conflict detection helper `checkForDatabaseDuplicates` tries to extract the Aadhaar card number of a row by checking the keys `aadharCardNo`, `aadhar_card_no`, and `aadharFieldId` (which is a form field UUID like `18855ee9-0d66-41d6-988b-128b776a8c5b`). However, the CSV parser `parseCSVText` only maps standard keys (like `fullName`, `phoneNumber`, `dateOfBirth`) via its hardcoded `fieldMap` and preserves other columns under their raw header names (e.g., `"Aadhar Card No"`).
* **The Impact:**
  The helper evaluates `aadharNo` as `undefined` for all uploaded CSV rows. Consequently, the bulk importer completely fails to detect Aadhaar-based duplicates in the uploaded data, allowing duplicate employee accounts with identical Aadhaar cards to bypass check limits.
* **Suggested Fix:**
  Update the `checkForDatabaseDuplicates` helper to dynamically search `row` keys using fuzzy matching (e.g., searching for keys containing `"aadhar"` or `"aadhaar"`) similar to how the form pre-fill matcher searches keys.

---

## 3. File Uploads & Client-Side Image Compression

### Finding 3.1: File Extension Mismatch during JPEG Conversion
* **File Name & Line Number:** [src/services/storageService.ts](file:///Z:/HR%20PORTAL/src/services/storageService.ts#L206-L239)
* **The Problem:**
  `compressImage` compresses all image files into `image/jpeg` format but preserves the original `file.name` (e.g. `avatar.png`). This leads to a file system inconsistency where a file with a `.png` extension contains JPEG binary data.
* **The Impact:**
  Some browsers, file validators, or proxies may flag the file as corrupt or block it due to MIME sniffing mismatches.
* **Suggested Fix:**
  Sanitize the output filename to guarantee a `.jpg` extension when compressed to JPEG.

```diff
             canvas.toBlob(
                 (blob) => {
                     if (!blob) return reject(new Error('Compression failed'));
-                    resolve(new File([blob], file.name, { type: 'image/jpeg' }));
+                    const originalName = file.name;
+                    let newName = originalName;
+                    const dotIndex = originalName.lastIndexOf('.');
+                    if (dotIndex !== -1) {
+                        newName = originalName.substring(0, dotIndex) + '.jpg';
+                    } else {
+                        newName = originalName + '.jpg';
+                    }
+                    resolve(new File([blob], newName, { type: 'image/jpeg' }));
                 },
                 'image/jpeg',
                 quality
             );
```

### Finding 3.2: Redundant Double Compression of Profile Photos
* **File Name & Line Number:** [src/services/storageService.ts](file:///Z:/HR%20PORTAL/src/services/storageService.ts#L189-L201)
* **The Problem:**
  `uploadProfilePhoto` compresses the image to `400px` (quality `0.8`), then calls `uploadFile`, which invokes `autoCompressFile`, processing it a second time at `1800px` (quality `0.82`).
* **The Impact:**
  Unnecessary CPU processing on the client device and potential loss of image quality due to double-encoding.
* **Suggested Fix:**
  Bypass `autoCompressFile` in `uploadFile` or add a flag to skip compression if the image is already pre-compressed.

### Finding 3.3: Crash when Rasterizing Encrypted PDFs
* **File Name & Line Number:** [src/utils/aadhaarParser.ts](file:///Z:/HR%20PORTAL/src/utils/aadhaarParser.ts#L355-L356)
* **The Problem:**
  When stripping passwords from encrypted PDFs, `removePdfPassword` passes the raw data URL string (`data:image/jpeg;base64,...`) from `canvas.toDataURL()` directly to `newPdfDoc.embedJpg()`. However, `pdf-lib` expects binary data (`Uint8Array` or `ArrayBuffer`) and does not accept data URI strings.
* **The Impact:**
  Uploading a password-locked Aadhaar card PDF will crash with a runtime execution error when attempting to decrypt.
* **Suggested Fix:**
  Convert the Base64 portion of the data URL to a `Uint8Array` before embedding.

```diff
         // Convert canvas to JPEG with high quality
         const imgDataUrl = canvas.toDataURL('image/jpeg', 0.92);
-        const jpgImage = await newPdfDoc.embedJpg(imgDataUrl);
+        const base64Data = imgDataUrl.split(',')[1];
+        const binaryStr = atob(base64Data);
+        const len = binaryStr.length;
+        const bytes = new Uint8Array(len);
+        for (let j = 0; j < len; j++) {
+            bytes[j] = binaryStr.charCodeAt(j);
+        }
+        const jpgImage = await newPdfDoc.embedJpg(bytes);
```

### Finding 3.4: Aadhaar PDF Decryption Bloat / Non-Searchable Rasterization
* **File Name & Line Number:** [src/utils/aadhaarParser.ts](file:///Z:/HR%20PORTAL/src/utils/aadhaarParser.ts#L332-L378)
* **The Problem:**
  The password removal function `removePdfPassword` decrypts locked PDFs by rendering each page to a high-resolution Canvas (scale 2.5) and embedding the result as a JPEG inside a new PDF document. This rasterization process converts vector text into raw images, causing the output PDF to lose all extractable text. Furthermore, it inflates the file size from ~150KB to 3MB–5MB.
* **The Impact:**
  Directly violates storage guidelines to compress files to save space, and wastes critical mobile data bandwidth when guards upload details on site offices. It also destroys text metadata, preventing subsequent text search.
* **Suggested Fix:**
  Check if direct vector extraction is supported by the engine before falling back to heavy canvas-to-JPEG rasterization, or restrict rendering resolution settings.

---

## 4. Firestore & Cloud Storage Security Rules & Functions

### Finding 4.1: Security Rules Block Employee Profile Completion
* **File Name & Line Number:** [firestore.rules](file:///Z:/HR%20PORTAL/firestore.rules#L102-L105)
* **The Problem:**
  The `update` rule for `/employees/{userId}` restricts write access for the owner to only `['profileStatus', 'lastUpdated', 'needsProfileCompletion', 'profilePhotoURL']`. During profile completion, the user is required to write full profile details (phone, bank, emergency contacts) to `profileData` and `data`.
* **The Impact:**
  Employees trying to complete their profile (e.g. from Pending Profile imports) will have their submissions blocked by security rules.
* **Suggested Fix:**
  Relax the write rule during the profile completion phase when `needsProfileCompletion` is active.

### Finding 4.2: Resource Limit Exceeded Vulnerability in Cloud Storage Rules
* **File Name & Line Number:** [storage.rules](file:///Z:/HR%20PORTAL/storage.rules#L18-L28)
* **The Problem:**
  The `isOwner` function executes up to 3 `exists` calls and 3 `get` calls sequentially in a single execution path. In Storage Security Rules, Firestore queries are capped at 3 document reads per request. If all checks run sequentially, the limit is exceeded.
* **The Impact:**
  Uploading or reading files from Storage will crash with a rules evaluation error (`Max firestore resource calls limit exceeded`) for legitimate requests.
* **Suggested Fix:**
  Deconstruct `isOwner` into separate, context-specific functions (`isEmployeeOwner`, `isOnboardingOwner`, `isDraftOwner`) so that each block makes at most 1 query.

### Finding 4.3: Secure URL Auth Failure Due to Non-Existent Fields
* **File Name & Line Number:** [functions/index.js](file:///Z:/HR%20PORTAL/functions/index.js#L1334) and [functions/index.js](file:///Z:/HR%20PORTAL/functions/index.js#L1358)
* **The Problem:**
  The `getSecureDocumentURL` Cloud Function checks ownership of onboarding submissions and drafts by comparing `subDoc.data().userId === uid` and `draftDoc.data().userId === uid`. However, the UID is stored as `uid` / `linkedUid` (submissions) and `ownerUid` (drafts). The `userId` field does not exist.
* **The Impact:**
  Employees will be unauthorized when trying to download their own onboarding documents or drafts, leading to HTTP 403 errors.
* **Suggested Fix:**
  Use the correct schema keys for validation.

### Finding 4.4: Broken Google Login UID Auto-linking Loop
* **File Name & Line Number:** [functions/index.js](file:///Z:/HR%20PORTAL/functions/index.js#L368-L382)
* **The Problem:**
  `employeeGoogleLogin` uses a single variable `employeeDocId` to update both `onboarding_submissions` and `employees`. However, the document ID in `onboarding_submissions` is the Portal ID (e.g. `UDF-xxx`), while in `employees` it is the Employee ID or Auth UID.
* **The Impact:**
  One of the updates always targets a non-existent path. The other collection is never linked, causing future client-side security rules checks to fail.
* **Suggested Fix:**
  Query each collection by `employeeId` to find the correct document reference instead of assuming identical document IDs.

### Finding 4.5: Admin Attachment Uploads Path Leak / Access Denied
* **File Name & Line Number:** [src/services/storageService.ts](file:///Z:/HR%20PORTAL/src/services/storageService.ts#L182) and [storage.rules](file:///Z:/HR%20PORTAL/storage.rules#L40)
* **The Problem:**
  The helper `uploadSubmissionAttachment` uses `auth.currentUser?.uid` (the caller's UID) as the folder path under `onboarding/`. If an administrator uploads an attachment on behalf of an onboarding candidate, the file is saved under `/onboarding/admin-uid/`. Because the candidate has no association with the admin's UID, the candidate is unauthorized under Storage Rules and `getSecureDocumentURL` to view their own uploaded attachment.
* **The Impact:**
  Candidates or applicants see broken images or files in their onboarding checklists and dashboard because they cannot authorize reads against files stored in the admin's personal directory.
* **Suggested Fix:**
  Replace the caller's `uid` with the target `submissionId` as the parent folder path.

```diff
 export const uploadSubmissionAttachment = async (
     submissionId: string,
     file: File
 ) => {
-    // Use the current user's UID as the folder name to satisfy storage rules
-    const uid = auth.currentUser?.uid;
-    if (!uid) throw new Error('User must be authenticated to upload documents.');
-    return uploadFile(file, `onboarding/${uid}`);
+    // Use the target submissionId as the folder name so it belongs to the submission owner
+    return uploadFile(file, `onboarding/${submissionId}`);
 };
```

### Finding 4.6: Google Apps Script JWT Signature Validation Bypass
* **File Name & Line Number:** [GOOGLE_APPS_SCRIPT_v7.2.js](file:///Z:/HR%20PORTAL/GOOGLE_APPS_SCRIPT_v7.2.js#L22-L58)
* **The Problem:**
  The Google Apps Script code decodes the JSON payload of the Firebase ID token (`parts[1]`) and validates that `payload.iss`, `payload.aud` match the expected values and it is not expired. However, it never cryptographically validates the token's signature against Google's public certificates.
* **The Impact:**
  An attacker can bypass verification by fabricating a fake JWT containing the public project ID, allowing them to invoke any administrative Google Drive action.
* **Suggested Fix:**
  Enforce signature verification using Google's public keys API or offload commands to Firestore triggers rather than accepting direct web requests.

### Finding 4.7: Google Apps Script Privilege Escalation - Anonymous Admin Access
* **File Name & Line Number:** [GOOGLE_APPS_SCRIPT_v7.2.js](file:///Z:/HR%20PORTAL/GOOGLE_APPS_SCRIPT_v7.2.js#L79-L108)
* **The Problem:**
  The script performs token project association checks but does not verify the user's role or permissions (e.g. checking custom claims or roles).
* **The Impact:**
  Any authenticated Firebase user (including anonymous guest candidates) can trigger administrative actions like moving employee directories to the Recycle Bin or calling `permanent_delete_employee` to permanently wipe company folders.
* **Suggested Fix:**
  Extract the caller's Firebase UID from the validated token and query the user's role in Firestore or evaluate custom administrator claims before executing commands.

### Finding 4.8: Approved Employees Blocked from Reading Onboarding Documents
* **File Name & Line Number:** [functions/index.js](file:///Z:/HR%20PORTAL/functions/index.js#L1325-L1337)
* **The Problem:**
  In `getSecureDocumentURL`, the ownership check for `onboarding/` files checks if the caller's UID matches the path's `folderUid` (which was the anonymous UID used during onboarding). If they do not match, it attempts to load the submission document from Firestore using the `folderUid` as the document ID. However, onboarding submissions are keyed by `submissionId`/Portal ID (e.g. `UDF-202607-XXXX`), not by anonymous UID. Thus, the document lookup returns empty, and the check fails.
* **The Impact:**
  Approved employees are permanently unauthorized to view or download their own onboarding documents from the portal.
* **Suggested Fix:**
  Query the `onboarding_submissions` collection using the `uid` or `linkedUid` field matching the caller's UID when the direct path checks fail.

### Finding 4.9: Privilege Escalation - Missing Role Verification in Staff Cloud Functions
* **File Name & Line Number:** [functions/index.js](file:///Z:/HR%20PORTAL/functions/index.js#L111) and [functions/index.js](file:///Z:/HR%20PORTAL/functions/index.js#L178)
* **The Problem:**
  The Cloud Functions `createStaffUser`, `deleteStaffUser`, `setStaffUserStatus`, and `resetStaffUserPassword` enforce security checks by querying `admin.firestore().collection('users').doc(request.auth.uid).get()` and verifying that the caller's document exists. However, because both Super Admins and regular restricted Admins (like Field Officers or managers) are stored in the `/users` collection, any administrator can call these endpoints.
* **The Impact:**
  Allows low-privileged administrative users to create new users, delete accounts, suspend credentials, or reset passwords for other staff.
* **Suggested Fix:**
  Modify the authorization checks in the Cloud Functions to verify that the caller's Firestore record contains the `roleId` matching `'role-super-admin'`.

```diff
     // SECURITY: Only SuperAdmins can create Staff users.
     const callerDoc = await admin.firestore().collection('users').doc(request.auth.uid).get();
-    if (!callerDoc.exists) {
+    if (!callerDoc.exists || callerDoc.data().roleId !== 'role-super-admin') {
         throw new functions.https.HttpsError('permission-denied', 'Only SuperAdmins can create Staff accounts.');
     }
```

### Finding 4.10: Privilege Escalation - Missing Permission Check on Vacancies in Security Rules
* **File Name & Line Number:** [firestore.rules](file:///Z:/HR%20PORTAL/firestore.rules#L294-L297)
* **The Problem:**
  In `firestore.rules`, write access to the `/vacancies/{id}` collection is allowed if the caller satisfies the broad `isAdmin()` helper. This helper only verifies that the caller's UID exists in the admin or staff collections, completely ignoring the granular `VACANCIES_MANAGE` permission.
* **The Impact:**
  Any restricted staff user, site manager, or Field Officer who has general system access but lacks specific vacancy management rights can create, alter, or delete job advertisements and salaries on the public Careers page.
* **Suggested Fix:**
  Restrict write access on the `/vacancies/{id}` path to users with the `VACANCIES_MANAGE` permission or Super Admins.

```diff
     match /vacancies/{id} {
       allow read: if true; // Public — displayed on blog/careers page
-      allow write: if isAdmin();
+      allow write: if isSuperAdmin() || hasPermission('VACANCIES_MANAGE');
     }
```

### Finding 4.11: Privilege Escalation - Missing Permission Check on Blog Posts and Safety Quizzes in Security Rules
* **File Name & Line Number:** [firestore.rules](file:///Z:/HR%20PORTAL/firestore.rules#L369-L377)
* **The Problem:**
  In `firestore.rules`, write access to the `/blog_posts/{id}` and `/safety_quizzes/{id}` collections is allowed if the caller satisfies the broad `isAdmin()` helper. This helper only verifies that the caller's UID exists in the admin or staff collections, completely ignoring the granular `MANAGE_SYSTEM` or `GAMIFICATION_MANAGE` permissions.
* **The Impact:**
  Any restricted staff user, site manager, or Field Officer who has general system access but lacks website management rights can create, alter, or delete public blog posts and safety quiz questions.
* **Suggested Fix:**
  Restrict write access on `/blog_posts/{id}` to users with `MANAGE_SYSTEM` permission, and write access on `/safety_quizzes/{id}` to users with `GAMIFICATION_MANAGE` permission (or Super Admins).

```diff
     // ─── Blog Posts ──────────────────────────────────────────────────────────
     match /blog_posts/{id} {
       allow read: if true;
-      allow write: if isAdmin();
+      allow write: if isSuperAdmin() || hasPermission('MANAGE_SYSTEM');
     }
 
     // ─── Safety Quizzes ──────────────────────────────────────────────────────
     match /safety_quizzes/{id} {
       allow read: if true;
-      allow write: if isAdmin();
+      allow write: if isSuperAdmin() || hasPermission('GAMIFICATION_MANAGE');
     }
```

### Finding 4.12: Privilege Escalation - Missing Access Controls on Direct View Navigation
* **File Name & Line Number:** [components/AdminPortalPage.tsx](file:///Z:/HR%20PORTAL/components/AdminPortalPage.tsx#L408-L414)
* **The Problem:**
  In `AdminPortalPage.tsx`, switch-cases for rendering the `ADMIN_PORTAL_WEBSITE_MANAGER`, `ADMIN_PORTAL_PORTAL_MODULES`, `ADMIN_PORTAL_CLIENT_ID_LIBRARY`, `ADMIN_PORTAL_WORKFLOW_CONFIG`, and `ADMIN_VACANCY_MANAGER` views do not check if the user has the required permissions (e.g. checking `hasPermission` before returning the page component).
* **The Impact:**
  A low-privileged staff member can bypass the sidebar navigation links visibility check (which properly filters links based on permissions) by executing a client-side navigation redirect or modifying the component state, loading administrative tools they are not authorized to use.
* **Suggested Fix:**
  Add permission checks inside each corresponding case statement in the `renderAdminContent` router of `AdminPortalPage.tsx` and return an Access Denied message if the check fails.

### Finding 4.13: Profile Completion Document Migration Failure on Approval
* **File Name & Line Number:** [App.tsx](file:///Z:/HR%20PORTAL/App.tsx#L1753)
* **The Problem:**
  When an employee completes their profile (via the `Pending Profile Import` flow), any new documents they upload are placed in the temporary `onboarding/{tempUid}` path. However, when the administrator approves their profile completion in `handleApproveProfileCompletion` (inside `App.tsx`), the system merely toggles status flags (`needsProfileCompletion: false`, `profileStatus: 'approved'`). Unlike the main onboarding submission approval in `updateSubmissionStatus` (which calls `moveStorageFiles` and remaps all file paths from `/onboarding` to `/employees`), `handleApproveProfileCompletion` performs no storage migration.
* **The Impact:**
  Active employee documents remain orphaned in the temporary `/onboarding` directory. If the daily cleanup CRON job runs to purge files from `/onboarding`, the employee's uploaded documents will be permanently lost. Additionally, the database links still point to `/onboarding`, which triggers storage rule access blocks.
* **Suggested Fix:**
  Add storage migration logic to `handleApproveProfileCompletion` to move the files from `onboarding/{tempUid}` to `employees/{employeeId}/joining` and rewrite the file path strings in the employee's `profileData` and `data` objects before updating Firestore, similar to the logic in `updateSubmissionStatus`.

### Finding 4.14: Permanent Resource Leak - Failure to Clean Up Abandoned Onboarding Storage Files
* **File Name & Line Number:** [functions/index.js](file:///Z:/HR%20PORTAL/functions/index.js#L1551)
* **The Problem:**
  In `functions/index.js`, the nightly schedule CRON `autoDeleteRecycleBin` permanently deletes soft-deleted records older than 30 days. When purging an onboarding submission, it calls `bucket.deleteFiles({ prefix: 'onboarding/' + docSnap.id })` to delete the associated files. However, all modern onboarding uploads are stored under the path `onboarding/{linkedUid}` (where `{linkedUid}` is the applicant's temporary Firebase Auth UID) rather than the submission ID (`docSnap.id`).
* **The Impact:**
  The CRON job attempts to delete a non-existent prefix (the submission ID) and silently skips deleting the actual files. As a result, large files (PDFs, high-res images) uploaded by candidates who are rejected or whose submissions are deleted remain in the Storage bucket indefinitely, leading to a permanent storage leak and unnecessary Firebase Storage costs.
* **Suggested Fix:**
  Modify the `onboarding_submissions` case in `performHardDelete` within `functions/index.js` to look up the `linkedUid` or `uid` from the document data (e.g. `data.linkedUid || docSnap.id`) and delete files under both prefixes to ensure complete cleanup.

### Finding 4.15: Broken Authentication Collision Checks - Employee Google Self-Linking Bypasses Admin & Staff Account Verification
* **File Name & Line Number:** [functions/index.js](file:///Z:/HR%20PORTAL/functions/index.js#L1083-L1099)
* **The Problem:**
  In `functions/index.js`, the HTTPS callable function `selfLinkGoogleAccount` allows employees to self-link a Google Account to their profile. During conflict checking, it queries `employees` and `onboarding_submissions` to ensure the Google UID or email is not already in use. However, it completely fails to query the `staff_accounts` or `users` (admin) collections.
* **The Impact:**
  An employee can link their employee profile to any administrator's or supervisor's Google email/UID. If a supervisor subsequently accesses the Employee Portal, their Google credentials will resolve to the hijacked employee profile, leaking employee personal details. It also permits registration overlaps where a single email exists across conflicting user scopes.
* **Suggested Fix:**
  Include verification queries against the `staff_accounts` and `users` collections in the `selfLinkGoogleAccount` Cloud Function and throw a conflict error if the Google credentials belong to an administrator or staff member.

### Finding 4.16: Google Auth UID Collision Bypass in linkEmployeeGoogleAccount
* **File Name & Line Number:** [functions/index.js](file:///Z:/HR%20PORTAL/functions/index.js#L758)
* **The Problem:**
  In `functions/index.js`, the `linkEmployeeGoogleAccount` Cloud Function enforces Google account uniqueness by querying existing records for the same `googleUid`. For the `onboarding_submissions` collection, it queries `where('uid', '==', googleUid)`. However, the submission document stores the candidate's Firebase Auth UID in the `linkedUid` field, not the `uid` field.
* **The Impact:**
  The uniqueness check fails to detect collisions against pending onboarding submissions that are linked to the same Google Account. A legacy employee can link their profile to a Google account already linked to an active onboarding candidate, leading to session hijacked profile resolutions.
* **Suggested Fix:**
  Change the query on `onboarding_submissions` to check `where('linkedUid', '==', googleUid)` instead of `where('uid', '==', googleUid)`.

### Finding 4.17: Critical Access Control Bug - Mismatched Schema Blocks Employees from Accessing Onboarding Documents
* **File Name & Line Number:** [functions/index.js](file:///Z:/HR%20PORTAL/functions/index.js#L1325-L1337)
* **The Problem:**
  In `functions/index.js`, the `getSecureDocumentURL` Cloud Function checks if a user is authorized to read files under `onboarding/{folderUid}/`. If the caller's current Auth UID does not match the `folderUid` (which happens after they claim their profile via Google Sign-In and obtain a new Google UID), the function attempts to retrieve the onboarding submission by looking up the document ID `folderUid` in the `onboarding_submissions` collection and checking the `userId` field.
* **The Impact:**
  This fails on two levels:
  1. Onboarding submission documents are keyed by the `submissionId` (e.g. `UDF-YYYYMM-XXXX`) rather than the temporary `folderUid` (the candidate's anonymous Auth UID). Thus, the document lookup returns `exists = false`.
  2. Even if the lookup succeeded, the submission document stores the candidate's temporary Auth UID in the `linkedUid` field, not `userId`.
  Consequently, employees are permanently blocked from viewing or downloading their own original onboarding documents once they claim their profiles and log in via Google.
* **Suggested Fix:**
  Modify the authorization logic in `getSecureDocumentURL` for `onboarding/` paths to query the `onboarding_submissions` collection by `linkedUid` or `uid` (using `db.collection('onboarding_submissions').where('linkedUid', '==', folderUid).limit(1).get()`) and check if the matching document's `linkedUid`, `employeeId`, or `id` matches the caller's `uid`.

---

## 5. Codebase Subdomain Split Readiness

### Finding 5.1: High Coupling and Unused Props in Route Chunks
* **File Name & Line Number:** [src/routes/AppRoutes.tsx](file:///Z:/HR%20PORTAL/src/routes/AppRoutes.tsx#L10-L11)
* **The Problem:**
  `EmployeeLoginPage` and `AdminLoginPage` are statically imported at the top of the file. Even when building for a specific target subdomain (e.g. `VITE_APP_TARGET=employee`), the unused login portal is bundled. Furthermore, `EmployeeLoginPage` takes `submittedForms` as a prop, coupling the employee bundle directly to admin data fetches.
* **The Impact:**
  Bloated bundle sizes and leaked administrative endpoints on the public/employee subdomains.
* **Suggested Fix:**
  Lazy-load both login pages and remove the unused `submittedForms` prop from `EmployeeLoginPage`.

### Finding 5.2: Hardcoded Subdomain Links and Redirects
* **File Name & Line Number:** [src/routes/AppRoutes.tsx](file:///Z:/HR%20PORTAL/src/routes/AppRoutes.tsx#L187-L191)
* **The Problem:**
  Cross-portal navigation (e.g. "Navigate to Admin Login" from the Employee login page) uses hardcoded React Router routes (e.g. `navigate('/admin/login')`). When split across subdomains (`admin.udfonline.in`, `employee.udfonline.in`), internal navigation will fail because the target route is not hosted on the same subdomain.
* **The Impact:**
  Broken links and routing errors once subdomains are split.
* **Suggested Fix:**
  Define subdomain URLs in environment variables (e.g., `VITE_ADMIN_PORTAL_URL`) and route using absolute URLs for cross-portal actions.

### Finding 5.3: Google Translate UI Disappears on SPA Route Changes
* **File Name & Line Number:** [components/BlogsPage.tsx](file:///Z:/HR%20PORTAL/components/BlogsPage.tsx#L70)
* **The Problem:**
  In `BlogsPage.tsx`, the Google Translate injection checks `if (!document.getElementById('google-translate-script'))` before loading. On subsequent SPA navigations back to the blogs page, the script element already exists in the document, so it is skipped. However, because the React component unmounted and remounted a new `#google_translate_element` container, and the Translate callback `googleTranslateElementInit` is never re-executed, the Google Translate widget is permanently missing from the UI.
* **The Impact:**
  Applicants and visitors who navigate away from the blogs page and return to it lose all translation functionality, breaking localized accessibility.
* **Suggested Fix:**
  Directly invoke `googleTranslateElementInit` (if already defined) inside the effect to reinitialize the widget on the newly mounted DOM node.

### Finding 5.4: HTML Sanitizer Regex-Based XSS Bypasses
* **File Name & Line Number:** [src/utils/sanitizeHtml.ts](file:///Z:/HR%20PORTAL/src/utils/sanitizeHtml.ts#L5-L25)
* **The Problem:**
  The lightweight HTML sanitizer `sanitizeHtml` uses regular expressions to strip script tags, event handlers, and javascript: URIs. Because it is regex-based and non-recursive:
  * Non-recursive replacement allows nested tags (e.g., `<scr<script>ipt>alert(1)</script>`) to bypass filters when stripped once.
  * Unicode or control character encoding inside protocols (e.g., `href="java&#9;script:alert(1)"`) is ignored by the regex but parsed and executed by modern browsers.
  * Interactive HTML tags supporting custom button actions (e.g., `<button formaction="javascript:alert(1)">`) are not stripped, as they do not begin with `on` or match the checked `href`/`src` attribute patterns.
* **The Impact:**
  Attackers can publish blog posts containing malicious payloads that execute arbitrary scripts in the context of the user's portal (Stored XSS).
* **Suggested Fix:**
  Use a library like `DOMPurify` or implement recursive parser-based node parsing.

---

## 6. IndexedDB & Object URL Memory Leaks

### Finding 6.1: Transaction Inactive Bug in Session Key Fetching
* **File Name & Line Number:** [src/utils/fileSessionStore.ts](file:///Z:/HR%20PORTAL/src/utils/fileSessionStore.ts#L125-L130)
* **The Problem:**
  `getAllFilesFromSession` opens a `readonly` IndexedDB transaction, retrieves keys, and then loops through keys to fetch each file by doing `await new Promise(...)` on `store.get(key)`. IndexedDB transactions automatically commit when control is returned to the browser event loop during `await`.
* **The Impact:**
  A `TransactionInactiveError` exception will throw on the second iteration whenever more than 1 file is stored in IndexedDB.
* **Suggested Fix:**
  Query all keys and values concurrently using `store.getAllKeys()` and `store.getAll()` or bundle synchronous requests within the transaction before awaiting.

### Finding 6.2: Progressive Memory Leak via Unrevoked Object URLs in SecureDocumentLink
* **File Name & Line Number:** [src/services/storageService.ts](file:///Z:/HR%20PORTAL/src/services/storageService.ts#L98) and [src/services/storageService.ts](file:///Z:/HR%20PORTAL/src/services/storageService.ts#L107)
* **The Problem:**
  `getSecureURL` resolves files from Storage by downloading them as blobs and returning local browser references via `URL.createObjectURL(blob)`. However, the app never revokes these references.
* **The Impact:**
  Object URLs accumulate in the browser heap for the duration of the Single Page Application (SPA) session, causing a massive memory leak when admins or managers view many employee profiles, documents, or photos.
* **Suggested Fix:**
  Provide an explicit revocation listener, or return the raw signed URL directly and rely on browser caching.

### Finding 6.3: Progressive Memory Leak via Unrevoked Object URLs in SecureImage
* **File Name & Line Number:** [src/components/common/SecureDocumentLink.tsx](file:///Z:/HR%20PORTAL/src/components/common/SecureDocumentLink.tsx#L113-L122)
* **The Problem:**
  The `SecureImage` component resolves Storage paths using `getSecureURL`, which returns a local browser `blob:` Object URL. However, the component's `useEffect` hook never calls `URL.revokeObjectURL` when the path changes or the component unmounts.
* **The Impact:**
  Downloaded profile pictures, document thumbnails, and attachments remain cached in the browser's memory heap indefinitely, leading to progressive performance degradation and browser tab crashes during long admin sessions.
* **Suggested Fix:**
  Ensure the cleanup function returned by `useEffect` inside `SecureImage` revokes the local Object URL reference when unmounting or when the path updates.

```diff
   useEffect(() => {
     let isMounted = true;
+    let resolvedUrl: string | null = null;
 
     if (!path) {
       if (isMounted) setUrl(null);
       return;
     }
     
     if (path.startsWith('http') || path.startsWith('data:')) {
       if (isMounted) setUrl(path);
     } else {
       getSecureURL(path)
         .then(signedUrl => {
-          if (isMounted) setUrl(signedUrl);
+          if (isMounted) {
+            resolvedUrl = signedUrl;
+            setUrl(signedUrl);
+          }
         })
         .catch(err => {
           console.error("Failed to fetch secure image", err);
           if (isMounted) setUrl(null);
         });
     }
-    return () => { isMounted = false; };
+    return () => {
+      isMounted = false;
+      if (resolvedUrl && resolvedUrl.startsWith('blob:')) {
+        URL.revokeObjectURL(resolvedUrl);
+      }
+    };
   }, [path]);
```

---

## 7. Firestore Operations & Concurrency Bottlenecks

### Finding 7.1: Concurrency Conflict and Clobbering in Site Config
* **File Name & Line Number:** [src/services/siteService.ts](file:///Z:/HR%20PORTAL/src/services/siteService.ts#L28-L54)
* **The Problem:**
  `updateSiteDetails` fetches the entire array of sites from the `settings/sites` document, mutates the specific site, and overwrites the document. If multiple administrators perform concurrent operations on different sites, they will silently overwrite and clobber each other's changes.
* **The Impact:**
  Loss of critical site configurations, allocations, and compliance documents in production.
* **Suggested Fix:**
  Transition sites into a dedicated `sites` subcollection, allowing updates, deletions, and additions to be performed on independent document paths.

### Finding 7.2: Data Inconsistency due to Denormalized Site Names and Designations
* **File Name & Line Number:** [types.ts](file:///Z:/HR%20PORTAL/types.ts#L549) and [types.ts](file:///Z:/HR%20PORTAL/types.ts#L648)
* **The Problem:**
  `FirestoreEmployee` records and `Vacancy` postings store `siteName` and `designation` as flat denormalized strings. The codebase lacks cascading update hooks to search and replace these values when a Site name or Designation title is renamed or edited in settings.
* **The Impact:**
  Renamed sites or designations are not reflected in employee profiles or active vacancies, leading to conflicting records and UI inconsistencies.
* **Suggested Fix:**
  Remove denormalized strings and resolve Site/Designation names dynamically in the client-side UI, or implement Firestore Cloud Function triggers to perform cascading updates.

### Finding 7.3: Firestore Write Batch Re-use Crash during Bulk Import
* **File Name & Line Number:** [src/utils/bulkImportUtils.ts](file:///Z:/HR%20PORTAL/src/utils/bulkImportUtils.ts#L688) and [src/utils/bulkImportUtils.ts](file:///Z:/HR%20PORTAL/src/utils/bulkImportUtils.ts#L834-L837)
* **The Problem:**
  In `bulkImportEmployees`, a single `writeBatch` reference is declared as a `const`. When processing row lists and `batchCount` exceeds the Firestore transactional limits, the batch is committed (`await batch.commit()`) and `batchCount` is reset. However, the `batch` instance is never re-assigned.
* **The Impact:**
  Firestore throws a runtime exception (`Batch has already been committed`) on the very next write operation. Bulk imports with more than 200 rows are blocked from completing, leaving the database partially updated.
* **Suggested Fix:**
  Declare `batch` with `let` and re-assign it to a fresh `writeBatch(db)` instance immediately after each commit.

```diff
-    const batch = writeBatch(db);
+    let batch = writeBatch(db);
     let batchCount = 0;
     const MAX_BATCH_SIZE = 400;
...
             if (batchCount >= MAX_BATCH_SIZE) {
                 await batch.commit();
+                batch = writeBatch(db);
                 batchCount = 0;
             }
```

### Finding 7.4: Missing Employee Status Sync upon Resignation Approval
* **File Name & Line Number:** [App.tsx](file:///Z:/HR%20PORTAL/App.tsx#L1197-L1201)
* **The Problem:**
  When a Resignation Request receives final approval in `handleAdminResignationAction` (either by completing the approval levels or through a Super Admin force-approval), the system updates the resignation request status in the `/resignations` collection. However, it fails to update the corresponding employee record in `/employees` to set `isActive: false` or mark them as relieved.
* **The Impact:**
  The resigned employee remains fully active in the master employee list, appearing on supervisor dashboards and site assignments, requiring admins to perform a redundant manual relieving action.
* **Suggested Fix:**
  Modify the final approval block in `handleAdminResignationAction` to trigger a write updating the employee's `isActive: false` and `profileStatus: 'relieved'` status fields in the `/employees` collection.

```diff
       } else {
         updatedRequest.status = RequestStatus.APPROVED;
         await updateResignationRequest(updatedRequest);
+        // Auto-relieve employee in master record
+        const { updateDoc, doc } = await import('firebase/firestore');
+        await updateDoc(doc(db, 'employees', r.employeeId), {
+            isActive: false,
+            isRelieved: true,
+            relievingDate: updatedRequest.relievingDate,
+            relievingReason: 'Resignation'
+        });
         logSystemAction('APPROVAL', 'EMPLOYEES', `Final approval for resignation of ${r.employeeName}.`);
```

### Finding 7.5: Incorrect Client-Side Stats Metrics on Paginated Pages
* **File Name & Line Number:** [components/AdminMasterEmployeeListPage.tsx](file:///Z:/HR%20PORTAL/components/AdminMasterEmployeeListPage.tsx#L408-L415)
* **The Problem:**
  In `AdminMasterEmployeeListPage.tsx`, the employee summary metrics card computes totals (active employees, Google vs manual authentication, pending completions) by filtering the local `employees` state. However, because `employees` is paginated (derived from `paginatedData`), these metrics only reflect the counts of the currently loaded page rather than the company-wide organization totals.
* **The Impact:**
  Shows incorrect organization totals, resulting in mismatched counts when navigating pages.
* **Suggested Fix:**
  Obtain metrics through database counts (`getCountFromServer`) or via a non-paginated statistics endpoint in Firestore.

### Finding 7.6: Database Field Corruption due to Trailing Space in Leave Balance Update Key
* **File Name & Line Number:** [src/services/employeeService.ts](file:///Z:/HR%20PORTAL/src/services/employeeService.ts#L1190)
* **The Problem:**
  In `updateEmployeeLeaveBalance` inside `employeeService.ts`, the Firestore update payload contains a template literal key with a trailing space: ``[`leaveBalance.${balanceKey} `]``.
* **The Impact:**
  When the leave balance is updated after approval, Firestore writes to a field with a trailing space (e.g. `"leaveBalance.casual "`) rather than updating the standard field. This causes subsequent balance reads and limit checks to read stale data, allowing infinite leaves to be requested and corrupting the Firestore schema.
* **Suggested Fix:**
  Remove the trailing space inside the key template literal.

```diff
         await updateDoc(empRef, {
-            [`leaveBalance.${balanceKey} `]: newBalance
+            [`leaveBalance.${balanceKey}`]: newBalance
         });
```

---

## 8. Firebase Authentication Configuration & Claims

### Finding 8.1: Shared Auth Instance Persistence Pollution
* **File Name & Line Number:** [src/utils/googleAuthHelper.ts](file:///Z:/HR%20PORTAL/src/utils/googleAuthHelper.ts#L178)
* **The Problem:**
  `googleSignInForOnboarding` updates the session persistence of the global shared `auth` instance to `browserSessionPersistence` during Google popup login.
* **The Impact:**
  This pollutes the shared auth instance configuration, forcing all subsequent employee or admin manual sign-in sessions to inherit `browserSessionPersistence` (meaning they will no longer survive browser restarts).
* **Suggested Fix:**
  Perform onboarding login on a dedicated, temporary secondary Firebase Auth instance to isolate persistence config changes.

### Finding 8.2: Token Inconsistency between Authentication Providers
* **File Name & Line Number:** [functions/index.js](file:///Z:/HR%20PORTAL/functions/index.js#L386) and [functions/index.js](file:///Z:/HR%20PORTAL/functions/index.js#L504)
* **The Problem:**
  `customTokens` generated by the `employeeGoogleLogin` and `claimEmployeeProfile` Cloud Functions use the claim key `{ portal: 'employee' }`, while the custom token generated by `employeeLogin` uses `{ portalType: 'employee' }`.
* **The Impact:**
  Inconsistent custom claim keys lead to unpredictable client-side validation behavior or routing logic depending on the login mechanism used.
* **Suggested Fix:**
  Standardize on a single custom claim key schema across all token generators.

### Finding 8.3: Client-Server Rule Mismatch for Bypass Accounts
* **File Name & Line Number:** [src/contexts/DataContext.tsx](file:///Z:/HR%20PORTAL/src/contexts/DataContext.tsx#L173) and [firestore.rules](file:///Z:/HR%20PORTAL/firestore.rules#L22)
* **The Problem:**
  The React client-side code grants SuperAdmin capabilities to accounts with user IDs matching `super-admin` or `emergency-admin`. However, `firestore.rules` evaluates super admin access by checking if the user document exists in `/users` collection with `roleId == 'role-super-admin'`.
* **The Impact:**
  Emergency accounts will experience broken UI behaviors: administrative dashboards and toggles will be enabled in the browser, but any saving or updating operations will fail due to database-level permission blocks, leading to runtime crashes.
* **Suggested Fix:**
  Align client-side and server-side rules definitions; register the emergency IDs in the `/users` collection or align `isSuperAdmin` helper in `firestore.rules`.

### Finding 8.4: Incomplete Read-Only Mode Enforcement
* **File Name & Line Number:** [App.tsx](file:///Z:/HR%20PORTAL/App.tsx#L903-L910)
* **The Problem:**
  The portal includes a global "Read-Only Mode" circuit breaker (`portalConfig.manualReadOnly` or `portalConfig.blockWritesOnLimit`). However, the check `checkWritesBlock()` is only enforced during candidate onboarding submission and draft saving. All other write actions—including submitting leaves, resignations, account updates, changing site/workflow settings, and administrator decisions—do not verify this lock, letting users write and modify database records arbitrarily.
* **The Impact:**
  Critical configuration edits and status modifications bypass the database lock, leaving the database vulnerable to updates during key maintenance windows.
* **Suggested Fix:**
  Ensure `checkWritesBlock()` is called at the beginning of all write-performing callback handlers in `App.tsx` and throw a blocking alert/notification.

### Finding 8.5: Disabled/Suspended Role Bypass Vulnerability
* **File Name & Line Number:** [src/contexts/DataContext.tsx](file:///Z:/HR%20PORTAL/src/contexts/DataContext.tsx#L179)
* **The Problem:**
  In the Role Management Page, administrators can suspend or disable active roles by toggling their state (`isDisabled: true`). However, the client-side authorization handler `hasPermission` resolves the permissions from the role object matching the caller's `roleId` without verifying if that role has been disabled. Furthermore, Firestore Security Rules only evaluate the presence of permissions in user documents and lack any checks to verify role status.
* **The Impact:**
  Staff users assigned to suspended/disabled roles retain full access and operational privileges, completely bypassing administrator suspension/lock controls.
* **Suggested Fix:**
  Modify `hasPermission` to check if `userRoleObj?.isDisabled === true` and return `false`, and align database security rules to block read/write operations for users with disabled roles.

### Finding 8.6: Security Rule Vulnerability - Client-Side Gamification Points Spoofing
* **File Name & Line Number:** [firestore.rules](file:///Z:/HR%20PORTAL/firestore.rules#L344-L352)
* **The Problem:**
  Firestore Security Rules for `/user_engagement/{id}` allow unrestricted client-side writes to the owner document (`request.auth.uid == id`). Because points are computed and incremented directly in client-side code (`AttendanceCalendar.tsx`), any authenticated employee can open their developer console or dispatch a raw update request to set their leaderboard `points` to arbitrary values.
* **The Impact:**
  Spoofing of leaderboard positions and gamification points balances by any employee.
* **Suggested Fix:**
  Restructure points tracking so updates are performed using incremental rules inside Firestore security policies, or process rewards exclusively via secured backend triggers.

### Finding 8.7: Authentication Schema Mismatch - Staff Referral Invite CRUD Blocked
* **File Name & Line Number:** [firestore.rules](file:///Z:/HR%20PORTAL/firestore.rules#L340) and [components/AdminInvitesPage.tsx](file:///Z:/HR%20PORTAL/components/AdminInvitesPage.tsx#L377)
* **The Problem:**
  Referral invites are created with `createdBy: authUser.id`. For staff accounts with custom usernames, `authUser.id` resolves to their alphanumeric username (e.g. `"manager_one"`). However, `firestore.rules` validates read, write, and list operations for `/referral_invites/{id}` by checking `resource.data.createdBy == request.auth.uid` (which evaluates against the Firebase Auth UID string).
* **The Impact:**
  Staff members with custom usernames are blocked by database security rules from viewing, creating, or editing their own referral invites, rendering the recruitment tracker unusable.
* **Suggested Fix:**
  Align the security rules to support resolving access by either the username or the Auth UID, or ensure `newInvite.createdBy` is populated strictly with `auth.currentUser.uid`.

```diff
-      createdBy: authUser.id,
+      createdBy: auth.currentUser?.uid || authUser.id,
```

### Finding 8.8: Authentication Schema Mismatch - Attendance & Complaints Creation Blocked
* **File Name & Line Number:** [firestore.rules](file:///Z:/HR%20PORTAL/firestore.rules#L357) and [firestore.rules](file:///Z:/HR%20PORTAL/firestore.rules#L364)
* **The Problem:**
  In `EmployeeEngagementHub.tsx`, attendance checking and grievance submissions are invoked using a `userId` resolved as `authUser.portalId || authUser.id`. This results in records written with a custom employee Portal ID (e.g., `"UDF-xxx"`) or an alphanumeric username (e.g., `"john_doe"`). However, `firestore.rules` validates writes to `/attendance` and `/complaints` by checking if the record's `userId` field exactly matches `request.auth.uid` (the Firebase Auth UID).
* **The Impact:**
  Firestore security rules reject all submissions, rendering the shift attendance calendar and confidential grievance registration entirely non-functional for all active employees.
* **Suggested Fix:**
  Pass the raw Firebase Auth `uid` into attendance marking and complaint creations, or modify Firestore security rules to allow matching the `userId` field against the user's mapped employee document ID/Portal ID.

---

## 9. Referral & Campaign Tracking Logic

### Finding 9.1: Unimplemented Referral Integration
* **File Name & Line Number:** [src/services/employeeService.ts](file:///Z:/HR%20PORTAL/src/services/employeeService.ts#L350)
* **The Problem:**
  `employeeService.ts` attempts to read `referralInviteId` from `sessionStorage` or `localStorage` to associate onboarding submissions with a referral campaign. However, the application never extracts referral tokens from URL parameters (e.g. `?ref=xxx`) or writes them to storage.
* **The Impact:**
  The referral tracking module is completely non-functional in production; users landing on the site via referral links are not credited or tracked.
* **Suggested Fix:**
  Implement a query-string listener in the entry routing components to capture `ref` parameters and write them to `sessionStorage`.

### Finding 9.2: Careers Vacancy Application Prefill Failure
* **File Name & Line Number:** [components/EmployeeFormPage.tsx](file:///Z:/HR%20PORTAL/components/EmployeeFormPage.tsx#L739-L743)
* **The Problem:**
  The public Careers page routes applicants to `/join?siteId={siteId}&role={role}` to allow them to apply directly for a specific job vacancy. However, `EmployeeFormPage` fails to parse or apply the `siteId` and `role` parameters from the URL query parameters.
* **The Impact:**
  The joining form opens blank. Candidates are forced to manually look up and select their site and designation again, increasing dropout rates and potentially mismatching applications with active job postings.
* **Suggested Fix:**
  Extract the `siteId` and `role` query parameters on mount and pre-fill the corresponding fields in the form's local state.

---

## 10. Audit Log Integrity & Security Rules

### Finding 10.1: Falsified Audit Log Creation Vulnerability
* **File Name & Line Number:** [firestore.rules](file:///Z:/HR%20PORTAL/firestore.rules#L246)
* **The Problem:**
  `firestore.rules` allows `create: if isAuthenticated();` for the `audit_logs` collection.
* **The Impact:**
  Any authenticated user (including regular security guards or guests with low-privileged credentials) can write fabricated or fake audit logs directly into the database, forging administrative history.
* **Suggested Fix:**
  Either restrict creation to server-side Cloud Functions or enforce strict validation rules on the creator ID and action properties.

### Finding 10.2: Erasure of System Action History
* **File Name & Line Number:** [firestore.rules](file:///Z:/HR%20PORTAL/firestore.rules#L248) and [src/services/auditService.ts](file:///Z:/HR%20PORTAL/src/services/auditService.ts#L84-L92)
* **The Problem:**
  The rules allow `update, delete` for super admins, and `auditService.ts` implements `_deleteAuditLog` and `_updateAuditLogDetails` to support editing and deleting logs.
* **The Impact:**
  Violates fundamental audit integrity and compliance standards (SOC 2 / ISO 27001) where audit logs must remain completely immutable and read-only. A compromised administrator account could clear traces of malicious actions.
* **Suggested Fix:**
  Disallow updates and deletions on the `audit_logs` path entirely in security rules, and remove the deletion/editing services from the codebase.

---

## 11. Schema Mismatches in Uniqueness checking & Admin Actions

### Finding 11.1: Failed Email Duplicate Detection in checkGlobalUniqueness
* **File Name & Line Number:** [functions/index.js](file:///Z:/HR%20PORTAL/functions/index.js#L53) and [functions/index.js](file:///Z:/HR%20PORTAL/functions/index.js#L55)
* **The Problem:**
  The `checkGlobalUniqueness` Cloud Function queries `where('email', '==', normalizedEmail)` at the root level of the `employees` and `onboarding_submissions` collections. However, in `employees` the email is nested inside `profileData.personalDetails.email`, and in `onboarding_submissions` it is nested inside `formData`.
* **The Impact:**
  Uniqueness checks are silently bypassed for manual signup accounts, allowing users to sign up or submit onboarding applications with duplicate emails without any warnings.
* **Suggested Fix:**
  For `employees`, query `profileData.personalDetails.email`. For `onboarding_submissions`, write the email to the root level of the document during creation and query that field, or query the nested form field path.

### Finding 11.2: Stale Profile Email after Admin Auth Update
* **File Name & Line Number:** [functions/index.js](file:///Z:/HR%20PORTAL/functions/index.js#L1190-L1199)
* **The Problem:**
  When an admin updates an employee's email via the `update_email` action in `adminControlEmployeeAuth`, it updates the root-level `email` field. However, the client application displays the email from `profileData.personalDetails.email`.
* **The Impact:**
  The admin email update does not take effect on the employee's active profile details.
* **Suggested Fix:**
  Modify `update_email` to update the nested `profileData.personalDetails.email` field as well.

### Finding 11.3: Google Unlinking Account Lockout
* **File Name & Line Number:** [functions/index.js](file:///Z:/HR%20PORTAL/functions/index.js#L1163-L1172)
* **The Problem:**
  The `unlink_google` action removes Google mapping fields and switches the auth provider to `manual` without validating if the user has a valid manual password hash set.
* **The Impact:**
  If the employee was originally a Google-only user, unlinking Google leaves them locked out.
* **Suggested Fix:**
  Enforce setting a temporary manual password or verify the presence of a password hash before allowing Google auth unlinking.

---

## 12. Password Reset ID Validation & Rules

### Finding 12.1: Client-side Validation Bypass in EmployeeLoginPage
* **File Name & Line Number:** [components/EmployeeLoginPage.tsx](file:///Z:/HR%20PORTAL/components/EmployeeLoginPage.tsx#L226-L254)
* **The Problem:**
  The forgotten password wizard in `EmployeeLoginPage.tsx` validates the Employee ID in step 1 by importing and calling the client-side helper `checkEmployeeStatus`. If the check succeeds, it advances to step 2 in state (`setStep(2)`). However, there is no server-side validation or cryptographic verification token passed between Step 1, Step 2, and the final reset execution in Step 3.
* **The Impact:**
  A malicious actor can open the console or modify state parameters to bypass Step 1 and Step 2 completely, submitting a password reset request directly for any known Employee ID.
* **Suggested Fix:**
  Move the verification checks to a secured, transactional backend Cloud Function that issues a temporary signed token, or execute the validation checks atomically at the moment the final reset request is processed.

### Finding 12.2: Forgot Password Flow Blocked by Firestore Rules
* **File Name & Line Number:** [src/services/employeeService.ts](file:///Z:/HR%20PORTAL/src/services/employeeService.ts#L2544-L2545) and [firestore.rules](file:///Z:/HR%20PORTAL/firestore.rules#L95)
* **The Problem:**
  Step 1 of the password reset wizard in `EmployeeLoginPage.tsx` executes a client-side document read `getDoc(doc(db, 'employees', employeeId))`. Since the user is logged out (unauthenticated) during password reset, this read is rejected by Firestore security rules, which only permit reads for authenticated owners or users with `EMPLOYEES_VIEW` permission.
* **The Impact:**
  The Forgot Password feature is completely broken in production, crashing immediately in Step 1 with a `Missing or insufficient permissions` error.
* **Suggested Fix:**
  Perform the account verification check via a backend Cloud Function that bypasses client security rules, rather than reading the employee record directly in the client.

### Finding 12.3: Forgot Password & Profile Claim Custom Token Ignition Defect
* **File Name & Line Number:** [functions/index.js](file:///Z:/HR%20PORTAL/functions/index.js#L1717) and [components/LegacyClaimModal.tsx](file:///Z:/HR%20PORTAL/components/LegacyClaimModal.tsx#L73-L84)
* **The Problem:**
  The `claimEmployeeProfile` Cloud Function generates a Firebase Custom Auth Token to authenticate the user under their claimed employee identity (`trimmedId` or `submissionId`) to allow them to access their existing profile draft. However, the React frontend codebase never imports or calls `signInWithCustomToken` to authenticate with this token. As a result, the user remains logged in under their original temporary guest or Google session, causing subsequent draft retrieval requests (`getDoc` on `/onboarding_submissions/{submissionId}`) to be rejected by Firestore Security Rules with a "Missing or insufficient permissions" error.
* **The Impact:**
  Bridges authentication steps incorrectly. Users completing profile claims are blocked from editing or reading their own drafts, breaking Phase 2 (Step 12/13) of the End-to-End Test Plan.
* **Suggested Fix:**
  Call `signInWithCustomToken` on the client auth instance when a token is returned from the profile claiming endpoint.

---

## 13. Client-Side Hashing Bypass

### Finding 13.1: Password Hashing Bypass in Onboarding Claim Profile Flow
* **File Name & Line Number:** [src/services/employeeService.ts](file:///Z:/HR%20PORTAL/src/services/employeeService.ts#L2199) and [src/services/employeeService.ts](file:///Z:/HR%20PORTAL/src/services/employeeService.ts#L2224)
* **The Problem:**
  When checking credentials during the onboarding profile claim flow, the service compares `password` with the unhashed `mockPassword` (e.g. `(sub.mockPassword === password)` and `(emp.mockPassword === password)`) if no `passwordHash` is present in the record. However, `sub.passwordHash` is checked and evaluated using `verifyPassword` (which is a SHA-256 client-side hash from `cryptoUtils.ts`). When an employee signs in manually via credentials later, the backend `employeeLogin` Cloud Function hashes their input using `bcrypt` (cost 12) on the server. Because the client-side `claimEmployeeProfile` updates and saves the plain SHA-256 hash or plain password directly to Firestore, subsequent backend login attempts will fail because they expect a valid bcrypt hash structure.
* **The Impact:**
  Manual credentials set during the onboarding profile claim flow are completely broken for subsequent portal logins. Employees will be permanently locked out until an administrator manually resets their credentials.
* **Suggested Fix:**
  Never perform credential comparisons or hashing client-side. Offload the entire profile claiming credential verification to a secured Cloud Function that handles comparison, migration, and writes bcrypt hashes atomically.

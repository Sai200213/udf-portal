# Persistent Brain: UDF Online Subdomain Architecture, Codebase Knowledge & Audit Registry
**Workspace Root**: `Z:\UDF_SUBDOMAINS`  
**Purpose**: Permanent knowledge base. Once recorded here, **no file needs to be re-scanned or re-read**. All remediation and analysis will draw directly from this Brain.

---

## 1. Master Scanned Files Registry & Line Progress

| # | File Path | Total Lines | Lines Scanned | Status | Core Responsibility |
| :- | :--- | :--- | :--- | :--- | :--- |
| 1 | `firebase.json` | 370 | 1–370 | **Completed** | Multi-target hosting rewrites, headers, functions config |
| 2 | `firestore.rules` | 400 | 1–400 | **Completed** | Security rules, RBAC checks, collection access policies |
| 3 | `storage.rules` | 106 | 1–106 | **Completed** | Cloud Storage file access and admin checks |
| 4 | `.firebaserc` | 21 | 1–21 | **Completed** | Project ID and hosting target mapping |
| 5 | `package.json` | 58 | 1–58 | **Completed** | Dependencies, build scripts (`build:all`, etc.) |
| 6 | `vite.config.ts` | 103 | 1–103 | **Completed** | Multi-page build config, rollup chunk splitting |
| 7 | `tsconfig.json` | 43 | 1–43 | **Completed** | TypeScript compiler options and include paths |
| 8 | `firestore.indexes.json` | 97 | 1–97 | **Completed** | Composite index definitions for Firestore queries |
| 9 | `index.html` | 107 | 1–107 | **Completed** | SPA root, AdSense scripts, Google font links |
| 10 | `index.tsx` | 58 | 1–58 | **Completed** | React DOM root mounting and AdSense hydration |
| 11 | `constants.ts` | 43 | 1–43 | **Completed** | System default constants, fallback roles |
| 12 | `App.tsx` | 2,371 | 1–2,371 | **Completed** | Main app controller, view router, state hydration |
| 13 | `src/routes/AppRoutes.tsx` | 310 | 1–310 | **Completed** | Subdomain route definitions, lazy loaders, redirects |
| 14 | `src/firebase/config.ts` | 105 | 1–105 | **Completed** | Firebase app initialization, auth/db/storage singletons |
| 15 | `src/context/AuthContext.tsx` | 122 | 1–122 | **Completed** | Session management, custom tokens, localStorage fallback |
| 16 | `src/contexts/DataContext.tsx` | 667 | 1–667 | **Completed** | Master data cache (sites, form sections, roles, staff) |
| 17 | `src/contexts/NotificationContext.tsx` | 153 | 1–153 | **Completed** | Real-time notification subscription and unread counts |
| 18 | `functions/index.js` | 2,107 | 1–2,107 | **Completed** | Cloud Functions: auth, passwords, approval, metrics |
| 19 | `functions/package.json` | 23 | 1–23 | **Completed** | Firebase Admin SDK, bcrypt, nodemailer deps |
| 20 | `src/services/employeeService.ts` | 4,277 | 1–4,277 | **Completed** | Primary employee CRUD, submissions, cascades, drafts |
| 21 | `src/services/adminService.ts` | 369 | 1–369 | **Completed** | System settings, roles, legacy claim imports |
| 22 | `src/services/requestService.ts` | 212 | 1–212 | **Completed** | Leave, resignation, and account update requests |
| 23 | `src/services/storageService.ts` | 308 | 1–308 | **Completed** | Firebase Storage upload, folder move, delete helpers |
| 24 | `src/services/driveService.ts` | 311 | 1–311 | **Completed** | Google Drive proxy sync via Cloud Function |
| 25 | `src/services/authService.ts` | 403 | 1–403 | **Completed** | Profile claim, Google auth linking, login helpers |
| 26 | `src/services/engagementService.ts` | 262 | 1–262 | **Completed** | Attendance marking, streaks, complaints |
| 27 | `src/services/auditService.ts` | 94 | 1–94 | **Completed** | Audit log write and query operations |
| 28 | `src/services/notificationService.ts` | 85 | 1–85 | **Completed** | In-app notification creation and snapshot listeners |
| 29 | `src/services/siteService.ts` | 74 | 1–74 | **Completed** | Site lookup, saving, and sub-unit resolution |
| 30 | `src/services/staffService.ts` | 93 | 1–93 | **Completed** | Staff user management Cloud Function calls |
| 31 | `src/services/statsService.ts` | 54 | 1–54 | **Completed** | Public employee headcount statistics |
| 32 | `src/services/vacancyService.ts` | 73 | 1–73 | **Completed** | Job vacancies CRUD for career portal |
| 33 | `src/services/websiteService.ts` | 119 | 1–119 | **Completed** | Public website metadata (about, contact, services) |
| 34 | `src/services/blogService.ts` | 75 | 1–75 | **Completed** | Blog post creation, editing, deletion, storage cleanup |
| 35 | `src/utils/cryptoUtils.ts` | 15 | 1–15 | **Completed** | Web Crypto SHA-256 password hash (dead code) |
| 36 | `src/utils/applyValidationRules.ts` | 181 | 1–181 | **Completed** | Form validation migration utility |
| 37 | `src/utils/workflowHelper.ts` | 91 | 1–91 | **Completed** | Multi-level approval escalation logic |
| 38 | `src/utils/sanitizeHtml.ts` | 50 | 1–50 | **Completed** | Regex-based HTML sanitizer for blogs |
| 39 | `src/utils/aadhaarParser.ts` | 383 | 1–383 | **Completed** | PDF OCR parsing, pdfjs-dist rasterization |
| 40 | `src/utils/subUnitUtils.ts` | 143 | 1–143 | **Completed** | Location matching (sub-unit name, code, site) |
| 41 | `src/utils/bulkImportUtils.ts` | 952 | 1–952 | **Completed** | CSV/Excel parser, batch setDoc, duplicate matching |
| 42 | `src/utils/fileSessionStore.ts` | 232 | 1–232 | **Completed** | IndexedDB encrypted buffer persistence for files |
| 43 | `src/utils/googleAuthHelper.ts` | 199 | 1–199 | **Completed** | Native Capacitor & Web Google Sign-In helper |
| 44 | `src/components/guards/AuthGuard.tsx` | 48 | 1–48 | **Completed** | Route guard by UserType |
| 45 | `src/components/auth/SetupAccountPage.tsx` | 197 | 1–197 | **Completed** | First-time password setup view |
| 46 | `components/EmployeeFormPage.tsx` | 3,145 | 1–3,145 | **Completed** | Multi-step dynamic onboarding form builder view |
| 47 | `components/AdminReviewSubmissionsPage.tsx` | 3,053 | 1–3,053 | **Completed** | Review submissions, multi-level approval, docs |
| 48 | `components/AdminMasterEmployeeListPage.tsx` | 2,276 | 1–2,276 | **Completed** | Master employee table, filters, actions, purge |
| 49 | `components/AdminWebsiteManager.tsx` | 2,017 | 1–2,017 | **Completed** | Content CMS, blog editor, system usage metrics |
| 50 | `components/AdminInvitesPage.tsx` | 1,731 | 1–1,731 | **Completed** | Referral link generator, candidates tracker |
| 51 | `components/AdminRoleManagementPage.tsx` | 1,575 | 1–1,575 | **Completed** | RBAC permission matrix and user overrides |
| 52 | `components/AdminStaffManagementPage.tsx` | 1,564 | 1–1,564 | **Completed** | Staff accounts, site assignments, handovers |
| 53 | `components/AdminSiteManagementPage.tsx` | 1,277 | 1–1,277 | **Completed** | Site CRUD, sub-units, designations, headcounts |
| 54 | `components/AdminPortalPage.tsx` | 1,161 | 1–1,161 | **Completed** | Admin shell, navigation drawer, stats overview |
| 55 | `components/AdminLegacySystemsPage.tsx` | 743 | 1–743 | **Completed** | Legacy employee CSV imports and claim settings |
| 56 | `components/EmployeeDashboardPage.tsx` | 732 | 1–732 | **Completed** | Employee portal home, digital ID, quick actions |
| 57 | `components/EmployeeLoginPage.tsx` | 506 | 1–506 | **Completed** | Custom token login, strict identity reset |
| 58 | `components/AdminWorkflowConfigPage.tsx` | 436 | 1–436 | **Completed** | Workflow level editor per module |
| 59 | `components/AdminLeaveManagementPage.tsx` | 435 | 1–435 | **Completed** | Admin leave review and leave policy editor |
| 60 | `components/AdminCorrectionRequestsPage.tsx` | 388 | 1–388 | **Completed** | Active correction tokens list, link generator |
| 61 | `components/employee/AttendanceCalendar.tsx` | 393 | 1–393 | **Completed** | Monthly attendance grid, daily status mark |
| 62 | `components/employee/EmployeeEngagementHub.tsx` | 295 | 1–295 | **Completed** | Streak tracker, grievance form, reward rules |
| 63 | `components/employee/DataCorrectionPage.tsx` | 1,099 | 1–1,099 | **Completed** | Token-based field correction submission view |
| 64 | `components/employee/EmployeeLeaveRequestPage.tsx` | 310 | 1–310 | **Completed** | Employee leave application form |
| 65 | `components/employee/EmployeeAccountUpdatePage.tsx` | 331 | 1–331 | **Completed** | Profile update request submission |
| 66 | `components/employee/EmployeeResignationPage.tsx` | 296 | 1–296 | **Completed** | Resignation application and notice period popup |
| 67 | `components/employee/ProfileClaimPage.tsx` | 258 | 1–258 | **Completed** | Self-service legacy claim identity verification |
| 68 | `components/employee/SecuritySettingsModal.tsx` | 366 | 1–366 | **Completed** | Password change, Google account linking |
| 69 | `components/employee/EmployeeProfileView.tsx` | 508 | 1–508 | **Completed** | Digital ID card, personal info display |
| 70 | `components/common/DocumentCaptureModal.tsx` | 247 | 1–247 | **Completed** | Camera feed, canvas rotation, image cropping |
| 71 | `components/common/RequestCorrectionModal.tsx` | 474 | 1–474 | **Completed** | Admin modal to request corrections from applicants |
| 72 | `components/BulkImportModal.tsx` | 602 | 1–602 | **Completed** | CSV import modal, mapping wizard, progress bar |
| 73 | `components/FieldEditorModal.tsx` | 414 | 1–414 | **Completed** | Form builder field editor modal |
| 74 | `components/employeeFormFields/EmployeeFileUploadField.tsx` | 498 | 1–498 | **Completed** | File picker, PDF unlock, Aadhaar auto-fill |
| 75 | `types.ts` | 760 | 1–760 | **Completed** | Global TypeScript interfaces, enums, permissions |
| 76 | `utils/exportUtils.ts` | 94 | 1–94 | **Completed** | CSV & Excel export utility |
| 77 | `utils/formDataHelper.ts` | 184 | 1–184 | **Completed** | Form field value extractors (Name, Phone, Aadhaar) |
| 78 | `utils/imageScanner.ts` | 161 | 1–161 | **Completed** | Blur detection and document boundary finder |
| 79 | `hooks/useFormBuilder.ts` | 144 | 1–144 | **Completed** | Form section and field state management hook |
| 80 | `GOOGLE_APPS_SCRIPT_v7.2.js` | 402 | 1–402 | **Completed** | Drive folder creator, sheet appender |
| 81 | `AUTOMATED_FORM_CREATOR.js` | 167 | 1–167 | **Completed** | Google Form generator |
| 82 | `scripts/generateStaticPages.js` | 627 | 1–627 | **Completed** | Prerender static pages for SEO |
| 83 | `public/sw.js` | 14 | 1–14 | **Completed** | Service worker self-destruct killer script |
| 84 | `src/components/common/SEOHead.tsx` | 65 | 1–65 | **Completed** | Dynamic client-side SEO and OpenGraph tag updater |
| 85 | `src/env.d.ts` | 24 | 1–24 | **Completed** | Environment variables TypeScript declarations |
| 86 | `scripts/cleanupStorage.js` | 114 | 1–114 | **Completed** | Storage cleanup script for orphaned files |
| 87 | `scripts/inspect_test_data.js` | 98 | 1–98 | **Completed** | Inspection script scanning Firestore and storage |
| 88 | `scripts/getEmpAndResetPass.js` | 33 | 1–33 | **Completed** | Test script resetting employee password |
| 89 | `scripts/list-admins.js` | 55 | 1–55 | **Completed** | Admin user enumeration utility |
| 90 | `src/components/common/SecureDocumentLink.tsx` | 134 | 1–134 | **Completed** | Secure document link viewer, modal popup, image preview |
| 91 | `src/constants/defaults.ts` | 321 | 1–321 | **Completed** | Default fallback roles, workflows, leave policies |
| 92 | `src/constants/googleFormMapping.ts` | 68 | 1–68 | **Completed** | Hardcoded Google Form field UUID and entry mappings |
| 93 | `src/types/props.ts` | 42 | 1–42 | **Completed** | Shared component prop interface definitions |
| 94 | `src/utils/capacitor-utils.ts` | 49 | 1–49 | **Completed** | Capacitor mobile environment platform detector |
| 95 | `src/utils/createAdmin.js` | 64 | 1–64 | **Completed** | CLI script to seed initial admin user account |
| 96 | `src/utils/logger.ts` | 26 | 1–26 | **Completed** | Logging utility with environment debug level gates |
| 97 | `src/utils/migrationHelper.ts` | 35 | 1–35 | **Completed** | Database migration helpers and initial admin seeds |
| 98 | `scripts/test-drive-connection.js` | 41 | 1–41 | **Completed** | Google Drive script webhook integration test utility |
| 99 | `scripts/search-user.js` | 60 | 1–60 | **Completed** | Cross-collection user email search utility |
| 100 | `scratch/reset_khaled.js` | 55 | 1–55 | **Completed** | Production test data mutator for candidate UDF-202609-1R6W |
| 101 | `scratch/reset_both.cjs` | 62 | 1–62 | **Completed** | Test script clearing candidate submission and employee records |
| 102 | `scratch/inspect_both.cjs` | 48 | 1–48 | **Completed** | Inspection script querying test candidates in Firestore |
| 103 | `scratch/restore_khaled_pan_uan.cjs` | 38 | 1–38 | **Completed** | Script restoring PAN/UAN values on live records |
| 104 | `scripts/check-validations.mjs` | 52 | 1–52 | **Completed** | Form validation rule integrity checker |
| 105 | `scripts/admin-migrate-validation.mjs` | 74 | 1–74 | **Completed** | Migration script updating form section validation rules |
| 106 | `scripts/comprehensive_scanner.cjs` | 135 | 1–135 | **Completed** | Static pattern scanner script for credentials and AST |
| 107 | `scripts/parse_snyk_report.cjs` | 82 | 1–82 | **Completed** | Vulnerability report parser and severity counter |
| 108 | `scripts/backup_current_state.ps1` | 45 | 1–45 | **Completed** | Local state backup automation script |

---

## 2. All 59 Cataloged Findings & Root Causes

1. **Anonymous Auth PII Exfiltration**: `firestore.rules:L8-10` -> Check non-anonymous sign-in provider.
2. **Plaintext Password Storage**: `employeeService.ts:L793, L1511` & `bulkImportUtils.ts:L830` -> Remove `mockPassword`.
3. **Storage Privilege Escalation**: `storage.rules:L17-22` -> Inspect `roleId` in `users/` doc, not mere existence.
4. **Self-Approval Exploit**: `firestore.rules:L150, L173, L196` -> Enforce `status == 'Pending'` and `currentLevel == 1`.
5. **Apps Script Unverified JWT**: `GOOGLE_APPS_SCRIPT_v7.2.js:L46-66` -> Validate signatures before execution.
6. **serviceAccountKey.json Exposed**: Repository root -> Remove and rotate credentials.
7. **Permanent Delete Doc ID Mismatch**: `employeeService.ts:L2734, L2819` -> Query true doc ID by `employeeId`.
8. **Incomplete Cascade Deletion**: `employeeService.ts:L2684` -> Include `attendance` and `user_engagement`.
9. **Compound Query Crash (Invites)**: `AdminInvitesPage.tsx:L309` -> Remove inequality with `in` operator.
10. **Compound Query Crash (Pagination)**: `employeeService.ts:L1045` -> Split `array-contains-any` and `in`.
11. **Redirection Drops Query Parameters**: `AppRoutes.tsx:L57-64` -> Append `window.location.search`.
12. **Correction Modal Crash**: `EmployeeProfileView.tsx:L496` -> Pass `doc.id` instead of `employeeId`.
13. **Attendance Blocked for Employees**: `firestore.rules:L60` -> Support `portalId` in `isOwnerOfPortalId`.
14. **Referral Typo Crash**: `employeeService.ts:L4275` -> Rename `starts` to `started`, use `increment(1)`.
15. **Approval Link Corruption**: `employeeService.ts:L1420` -> Await storage moves before updating doc URLs.
16. **Site Management Blocked**: `firestore.rules:L79` -> Add `MANAGE_SITES` permission to rule.
17. **Notification Subscription Denied**: `notificationService.ts:L44` -> Allow querying notifications by `portalId`.
18. **Duplicate Matcher Rule Shadowing**: `firestore.rules:L393` -> Remove shadowed `allow create: if true`.
19. **Public Admin Bundle Leak**: `vite.config.ts` -> Exclude admin chunks from public web build.
20. **AdSense Multiple Scripts**: `index.html` & `index.tsx` -> Deduplicate and restrict to public marketing routes.
21. **tsconfig.json Include Omission**: `tsconfig.json:L27` -> Add `components/**/*`, `utils/**/*`, `hooks/**/*`.
22. **Regex-Based HTML Sanitizer**: `sanitizeHtml.ts` -> Replace regex with DOMPurify parser.
23. **Disciplinary Records Confidentiality Leak**: `firestore.rules:L218` -> `allow read: if isAuthenticated();` exposes all reprimands and suspensions across the whole company.
24. **Unauthenticated Admin Email Harvesting**: `functions/index.js:L2055` -> `resolveUsernameToEmail` ignores `request.auth`, allowing anyone to enumerate staff emails.
25. **Ghost Top-Level Collection Rules**: `firestore.rules:L247, L253` -> Rules on `/sites/` and `/roles/` are dead code because data is actually in `/settings/sites` and `/settings/roles`.
26. **Signed Document URL 403 Forbidden**: `functions/index.js:L1391` -> `getSecureDocumentURL` checks UID against submissionId, failing for bulk/legacy employees.
27. **Missing Fallback in Permanent Delete**: `employeeService.ts:L2734, L2819` -> `updateEmployeeLeaveBalance:L1832` implemented the query fallback, but deletion routines omitted it.
28. **Catastrophic Document Deletion via Storage Cleanup Script**: `scripts/cleanupStorage.js:L25-28, L75-90` -> Queries legacy `submissions` instead of `onboarding_submissions`. Deletes legitimate applicant documents from Cloud Storage.
29. **Unrestricted Anonymous Read/Write in Storage Rules**: `storage.rules:L66-77` -> `match /onboarding/{submissionId}` and `match /employees/{employeeId}` permit any anonymous guest to read or overwrite KYC and onboarding files.
30. **Non-Admin Correction Uploads Blocked by Storage Rules**: `storage.rules:L73-77` vs `employeeService.ts:L4024` -> `uploadEmployeeDocument` targets `employees/{id}/joining`, which requires `isAdmin()`. Employees submitting corrections get permission denied.
31. **Unauthenticated Public Exposure of Workflows, Sites & Security Config**: `firestore.rules:L75-79` -> `match /settings/{docId}` sets `allow read: if true;`, leaking approval workflow levels, site databases, and legacy claim security parameters.
32. **Granular Role Permission Deadlock on System Settings**: `firestore.rules:L79` vs `adminService.ts:L140` -> Granular permissions `SITES_MANAGE` and `MANAGE_WORKFLOWS` are blocked because `/settings/` strictly mandates `MANAGE_SYSTEM` or `SuperAdmin`.
33. **Brute-Force & Identity Theft in Legacy Profile Claim**: `functions/index.js:L1739-1880` -> Missing authentication requirement, zero rate-limiting, and verification skip on missing fields (`if (!storedValue) continue;`). Emits custom token and full PII to unauthenticated callers while leaving `employees.linkedUid` unlinked.
34. **Broken Logic & Dead Code in Nightly Abandoned Submission Cleanup**: `functions/index.js:L1633, L1710-1718` -> Submissions lack `submittedAt` (they use `timestamp`), and `performHardDelete` immediately exits if `!deletedAtStr`, making the entire cleanup block dead code.
35. **Admin Dashboard Permission Denial for Email-Matched Staff**: `src/services/authService.ts:L165-175` vs `firestore.rules:L11-20` -> Staff matching by email in `staff_accounts` have a Google UID that does not match the Firestore document ID, bricking all database operations with `PERMISSION_DENIED`.
36. **Broken File Move in Correction Approval Leading to Document Deletion**: `functions/index.js:L1538-1545` vs `employeeService.ts:L4081` -> `moveStorageFolder` expects a directory prefix. Passing a full file path results in an empty filename and no move, causing `req.deleteOldFiles` to permanently delete the original document.
37. **Company-Wide Exposure of Private Bank Account Updates and Resignations**: `firestore.rules:L168, L190` -> `match /account_updates/{id}` and `match /resignations/{id}` allow read to all authenticated users, exposing bank accounts, IFSC codes, and resignation letters.
38. **Unauthenticated Draft Overwrite & Mass Deletion**: `firestore.rules:L144-146` -> `match /draft_submissions/{id}` allows create, update, and delete for any authenticated/anonymous session without checking `resource.data.ownerUid`.
39. **High Collision Rate & Blind Overwrite in Submission IDs**: `employeeService.ts:L423-428, L2878` -> `getNextSubmissionId` uses 4 base-36 characters with no existence check, colliding after ~1,500 submissions and silently overwriting other candidates' data.
40. **Hardcoded Field UUIDs Permanently Locking Out Password Resets**: `functions/index.js:L647-670` -> `verifyAndResetEmployeePassword` hardcodes specific form UUIDs and checks nonexistent fields (`empData.mobile`, `empData.aadhar`, `empData.dob`), locking out all bulk-imported employees.
41. **Collision-Prone Employee ID Generation on Approval**: `employeeService.ts:L1374` -> `Date.now().toString().slice(-6)` recycles every 16 minutes and skips uniqueness checks, risking duplicate employee IDs.
42. **Duplicate Referral Invites Rules Creating Permission Bypass**: `firestore.rules:L312-332` vs `L361-365` -> Duplicate match block allows any user who supplies a non-empty `createdBy` to create and delete invites, bypassing `INVITES_CREATE` and `isSuperAdmin()`.
43. **Permanent 403 on Correction Document Viewing via Cloud Function**: `functions/index.js:L1450-1475` -> `getSecureDocumentURL` lacks a path handler for `corrections/`, denying non-admin access to correction files.
44. **Stale Social Preview Metadata on Dynamic Pages**: `src/components/common/SEOHead.tsx` -> Updates standard OpenGraph tags but never updates `<meta name="twitter:*">` tags, causing social sharing previews on X/Twitter/Slack to display generic homepage metadata.
45. **Permanent SSO Login Retention for Terminated/Relieved Employees**: `functions/index.js:L330-415` -> `employeeGoogleLogin` lacks `isActive === false` and `isRelieved === true` checks, allowing terminated employees with linked Google accounts to mint valid Custom Tokens indefinitely.
46. **Onboarding Employees Bypass Inactive/Relieved Account Lockout**: `functions/index.js:L465-495` -> `employeeLogin` matches `onboarding_submissions` first where `isActive === false` is never evaluated, bypassing deactivation locks.
47. **Unverified Plaintext Google Account Linking**: `functions/index.js:L1085-1165` -> `selfLinkGoogleAccount` accepts arbitrary `googleUid` and `email` strings from `request.data` without Google ID token verification via `admin.auth().verifyIdToken()`.
48. **Complete Privilege Escalation in Employee Auth Control**: `functions/index.js:L1200-1235` -> `adminControlEmployeeAuth` grants any user in `staff` or `staff_accounts` unrestricted ability to reset passwords or unlink auth for any employee without checking RBAC permissions.
49. **SuperAdmin Operation Lockout in Staff Management Cloud Functions**: `functions/index.js:L88, L145, L205, L260` -> `createStaffUser`, `deleteStaffUser`, `setStaffUserStatus`, and `resetStaffUserPassword` only check `users/` collection, denying SuperAdmins stored in `staff_accounts`.
50. **Missing Composite Index Causing Attendance Calendar Failure**: `src/services/engagementService.ts:L130-145` vs `firestore.indexes.json` -> Querying `attendance` with equality on `userId` and range on `date` throws a runtime Firestore index error, permanently returning an empty calendar.
51. **Unhandled Crash on Relieving or Rejoining Approved Onboarding Employees**: `src/services/employeeService.ts:L2280-2325, L2325-2365` -> `relieveEmployee` and `rejoinEmployee` call `doc(db, 'employees', employeeId)` directly; for self-onboarded employees whose doc ID is their submission ID, `updateDoc` throws `No document to update` and crashes the workflow.
52. **Ghost Top-Level Collection Read in Site Relieving & Re-hire**: `src/services/employeeService.ts:L2365, L2398` -> `doc(db, 'sites', id)` looks up non-existent top-level collection instead of `/settings/sites` array, always defaulting `siteName` to `"N/A"`.
53. **Phantom Account Updates (Approved Changes Never Committed to Profile)**: `App.tsx:L1313-1325` -> `handleAdminAccountUpdateAction` marks the request `Approved` but omits updating employee profile data (`// For now, let's skip auto-update of fields`), leaving requests approved in name only.
54. **Non-Atomic Leave Balance Deductions & Permanent Quota Loss**: `src/services/employeeService.ts:L1830-1855` & `App.tsx:L1145, L1510-1535` -> Client-side read-modify-write introduces race conditions over leave balances; reverting or deleting approved leaves never refunds deducted days.
55. **Premature Workflow Termination by SuperAdmin Reviews**: `App.tsx:L1125, L1205, L1285` -> Advancing condition `if (nextRawLevel <= maxLevels && !isSuperAdmin)` forces any review by a SuperAdmin directly into final approval, skipping intermediate supervisor levels without a bypass toggle.
56. **Live Production Mutation & PII in Committed Scratch Scripts**: `scratch/reset_khaled.js`, `scratch/reset_both.cjs` -> Hardcoded production candidate names and IDs with service account keys execute direct hard deletes on live Firestore collections.
57. **Admin Setup Scripts Writing to Dead Collection**: `src/utils/createAdmin.js:L36-43`, `src/utils/migrationHelper.ts:L12-18` -> Writes admin users to `/staff` instead of `/users` or `/staff_accounts`, creating accounts that fail `firestore.rules` and cannot access the admin portal.
58. **Reverse Tabnabbing & Dead Sanitizer in Secure Document Link**: `src/components/common/SecureDocumentLink.tsx:L12-42` -> Uninvoked `isSafeUrl()` and missing `rel="noopener noreferrer"` in `window.open()` expose the application to reverse tabnabbing attacks.
59. **Unordered Notification Fetching Breaking Timeliness**: `src/services/employeeService.ts:L3045-3052` -> Omitting `orderBy("createdAt", "desc")` to dodge index creation returns an arbitrary slice of 50 notifications, hiding critical pending approvals and review alerts.


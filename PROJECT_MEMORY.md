# HR Portal Master Project Memory & Roadmap

This is the single source of truth for the HR Portal project. It tracks objectives, architecture decisions, recent achievements, security improvements, and the upcoming roadmap.

---

## 🎯 1. Key Objectives
* **Complete HR Portal**: Provide dynamic form building, multi-level approval workflows, and a master personnel directory.
* **Unified Database**: Use Firebase (Firestore/Auth) for secure employee records, logins, and request management.
* **Smart Google Drive & Form Sync**: Support document storage and legacy Google Form submission workflows seamlessly.
* **Dynamic branding**: Allow HR Admins to customize site titles, logos, and settings without code updates.

---

## ⏳ 2. PENDING DECISIONS (Must Choose)

### 🔴 Decision 1 — Bulk Onboarding: Pending Profiles vs Legacy Claim
**Context:** Two approaches exist for onboarding existing/old employees in bulk:

- **Option A — Pending Profiles (current bulk import):**
  Admin bulk-imports CSV → creates employee records with `needsProfileCompletion=true` → employee must log in to their account → complete their full profile → upload all documents → submit for admin verification.
  - *Problem: Too many steps for the employee. They have to login, find their profile, fill everything, upload docs, and submit. A lot of work.*

- **Option B — Legacy Claim (onboarding form flow):**
  Admin bulk-imports CSV → employee gets pre-filled data in the normal onboarding form → just goes through the standard onboarding process (review pre-filled data, upload missing docs, submit).
  - *Better: Employee goes through the familiar onboarding link flow. Data is pre-filled from CSV. Much less confusing.*

**Action:** Choose Option A or Option B. The other one should be hidden from the UI (keep code but hide).
- If Option B chosen: Hide "Pending Profiles" tab from Master Employee List.
- If Option A chosen: Hide "Legacy Systems" page from sidebar.

---

## 🚧 3. DEFERRED TASKS (Come Back Later)

### 📷 Auto-Crop & Blur Detection
- Fixes were applied: removed `crossOrigin="anonymous"` (was causing canvas taint), raised blur threshold to `50`, added `naturalWidth` guard.
- **Status:** Deferred — needs real-world device testing to calibrate blur score threshold.
- **Files:** `DocumentCaptureModal.tsx`, `imageScanner.ts`

---

## 💡 WISHLIST — Features to Implement Later
*(User asked to remember these across multiple sessions)*

### 🏗️ Architecture & Infrastructure
- [ ] **Subdomain Separation**: Split the app into `admin.company.com`, `employee.company.com`, and `www.company.com` for security and faster loading.
- [ ] **Firestore Scheduled Backup/Export**: Configure automatic daily exports of Firestore collections to a separate backup bucket. *(User said: "ADD THIS TO REMEMBER ABOUT BACKUP")*

### 🔐 Security
- [ ] **Email & Mobile OTP Verification**: Integrate 6-digit email OTP (sent via SMTP/Resend API) and mobile OTP verification (via Firebase SMS Auth or custom gateway) as toggleable security layers on login pages for both Admin/Staff and Employees. *(User said: "make me a remeber thing to add this in further and also mobile verificcation too")*
- [ ] **Admin Privilege Restrictions**: Lock down basic Admin accounts so only Super Admins can access and modify portal config settings.

### 🔗 Auto-Linking & Verification
- [ ] **Finalize Auto-Linking**: Complete the logic in `ProfileClaimPage.tsx` so that when an employee enters PAN/Aadhaar, their Google Account UID is automatically linked to the master record (no manual scripts needed).
- [ ] **Clean Up Old Scripts**: Delete old manual linking scripts like `fix-auth-data.js` once auto-linking is tested and working.

### 📧 Notifications & Communication
- [ ] **Email Notifications System**: Implement automated transactional email alerts (SendGrid or EmailJS) for new form drafts, document approvals, and request status changes.
- [ ] **Toast UI Upgrade for Drive Uploads**: Replace browser `window.alert()` popups during Google Drive uploads with custom animated Toast notification system.

### 📊 Features & Workflows
- [ ] **Form Analytics Dashboard**: Build visual charts on Admin Dashboard showing onboarding/submission trends over time.
- [ ] **Resignation Workflow Completion**: Finalize `EmployeeResignationPage.tsx` and automatic revocation of portal + Drive access when resignation is approved.
- [ ] **Admin "Download Documents" ZIP**: Button on admin employee profile to download combined ZIP of all employee files from Firebase Storage.

### 🧹 Code Quality
- [ ] **Type Safety Improvements**: Resolve TypeScript warnings and `as any` casting in `employeeService.ts` and `driveService.ts`.
- [ ] **Non-Blocking Drive Operations**: Make Google Drive folder operations (move, rename, delete) fire-and-forget so slow Drive services never crash Firestore status changes.
- [ ] **Parallel File Uploads & Non-Blocking Google Form Sync**: Optimize onboarding form submission performance by parallelizing document uploads via `Promise.all` and executing the Google Form Apps Script sync asynchronously (fire-and-forget) to reduce submission times from 60+ seconds to under 10 seconds. *(Postponed: Do not touch until completely shifted to this portal as we are currently dependent on Google Form sync).*

---

## 🛠️ 4. Key Architecture & Technical Decisions
1. **Dynamic Branding & Site Mappings**: Branding assets, site names, and designation-to-unit filters are configurable via database values.
2. **Unified Data Context**: Moved all structural subscriptions (Roles, Sites, Workflows, Form Sections, Leave Policy, Portal Config) into `DataContext.tsx` as a single source of truth.
3. **Google Drive Storage Bridge (Apps Script)**:
   * Google Drive serves as a secondary backup for employee documents.
   * Authentication is enforced at the bridge via cryptographic validation of Firebase ID Tokens (JWT) using the project's Firebase Web API Key.
   * Folder names follow a strict ID-Name convention (e.g., `SUB-123456 - John Doe` during onboarding, which is renamed to `HY123456 - John Doe` upon admin approval).
   * **Smart Fallback Search**: If folder renaming or blocking encounters legacy folders (like `sa`), the script searches in this order: `ID - Name` (Standard) -> `Name` (Legacy) -> `ID` (Ultimate).
4. **Save & Resume System**: Progress on the onboarding form is saved to a `draft_submissions` collection, recoverable via a unique retrieval code.
5. **Soft Delete & Recycle Bin**:
   * Employee records are never deleted directly; they are marked with a `deletedAt` timestamp (Soft Delete).
   * Drive folders are moved to a "Recycle Bin" subfolder in Google Drive when soft-deleted, and moved back when restored.
   * Permanent deletes/purges wipe both Firestore, Storage folders, and the Google Drive folders completely.
6. **Secure Blob Previews**: Replaced public signed URLs (`getDownloadURL`) with secure client-side blob fetches (`getBlob`). PDFs and images are displayed via temporary local Object URLs, restricting access strictly to active Firebase sessions.
7. **Production Telemetry Lockdown**: Global silence for `console.log`, `console.info`, and `console.debug` in production to prevent leaking sensitive system architecture or applicant data.

---

## 🏆 5. Recent Achievements & Improvements

### Security & Audit (Session: June 7-8 2026)
* **Full Security Audit Completed**: 14+ tasks — secret removal, Firestore rules hardening, dependency hardening, Node.js 22 upgrade for all Cloud Functions.
* **SuperAdmin Hidden Audit Override**: SuperAdmin can modify/delete audit logs via hidden `Ctrl+Shift+Alt+Delete` keyboard shortcut (unknown to regular users).
* **Firebase Security Headers**: Deployed `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, `Permissions-Policy` to Firebase Hosting.
* **firebase-functions SDK**: Updated to `7.2.5` for Node.js 22 support.
* **Service Account Key**: Rotated, verified working. File is in `.gitignore`. Project has no git repo (not tracked).

### Bug Fixes (Session: June 8 2026)
* **Stale Rows After Delete (New Joiners page)**: Fixed `AdminReviewSubmissionsPage.tsx` — paginated local state was not syncing with real-time `submittedForms` prop. Added length-watch effect + smarter source selection.
* **Stale Rows After Delete (Master Employee List)**: Same fix applied to `AdminMasterEmployeeListPage.tsx`.
* **Correction Requests NOT Deleted on Employee Purge**: Fixed `deleteAssociatedRecords()` in `employeeService.ts`. Correction requests use `targetId` field (not `employeeId`) — were completely missed by the cascade delete. Now cleaned up automatically on any employee purge.

### Onboarding & Guest UX
* **Visual Review Step**: Added an interactive review section before submission. Users see categorized cards for Personal, Security, Contact, and Files, with navigation buttons to edit sections.
* **Instant Local Previews**: Enabled immediate preview of selected local PDF/image files using `URL.createObjectURL(value)` prior to upload.
* **Auto-Save Empty Guard**: Disabled draft generation and manually saving drafts when the onboarding form is pristine/unfilled.
* **Session Life Cycle Fix**: Fixed the initialization spinner hang by correcting `AuthContext` setup for anonymous onboarding sessions.

### Security Hardening (Earlier)
* **Password Hashing**: Moved away from plain-text mock passwords to secure SHA-256 client-side hashing.
* **Firestore Rule Lockdowns**: Locked down `/employees`, `/resignations`, and `/account_updates` collections, requiring authentication for read/write access.
* **NoSQL Field Guards**: Configured `firestore.rules` using `affectedKeys()` to block applicants from modifying their own approval level or status.
* **Secure Route Guarding**: Prevented logged-in users and admins from accessing `/login` and `/admin/login` screens.

---

## 🔮 6. Future Roadmap & Pending Tasks

### 🔴 High Priority (Technical Debt & UX)
* **Full Portal End-to-End Test**: Test complete flow — Onboarding → Review → Approve → Employee Login → Correction → Leave → Audit Logs.
* **Toast UI Upgrade for Drive Uploads**: Replace the browser `window.alert()` popups during Google Drive uploads with our custom, animated Toast notification system.
* **Type Safety Improvements**: Resolve TypeScript warnings and any `as any` casting inside `employeeService.ts` and `driveService.ts`.
* **Admin Privilege Restrictions**: Lock down basic Admin accounts so only Super Admins can access and modify portal config settings.

### 🟡 Medium Priority (Scalability)
* **Email Notifications System**: Implement automated transactional email alerts (using SendGrid or EmailJS) for new form drafts and request approvals.
* **Resignation Workflow Completion**: Finalize `EmployeeResignationPage.tsx` and the automatic revocation of portal and Drive access once a resignation is approved.
* **Form Analytics Dashboard**: Build visual charts on the Admin Dashboard showing onboarding trends over time.

### 🟢 Low Priority / Long-term Strategy
* **Non-Blocking Drive Operations**: Make all Google Drive folder operations (move, rename, delete) non-blocking (fire-and-forget) so that slow Drive services never crash Firestore status changes.
* **Admin "Download Documents" ZIP**: Add a button on the admin employee profile to download a combined ZIP file of all their files directly from Firebase Storage.
* **Firestore Scheduled Export**: Configure automatic daily exports of Firestore collections to a separate backup Google Cloud Storage bucket.

---

## 📞 7. Project Information
* **Project Owner**: User "muthy"
* **Firebase Project ID**: `hr-portal-unique-delta`
* **Google Drive Upload Folder**: `HR Portal Uploads` (ID: `1XuFLT5v5s1ZSdugKr1XzT0AdYkL-QgBX`)
* **Google Apps Script**: Version 7.2 (Supports precise email sync + cryptographic JWT validation)
* **Backup Folder**: `Z:\HR_PORTAL_BACKUP_2026-06-06_01-21-34`
* **Service Account Key**: `serviceAccountKey.json` — valid, in `.gitignore`, NOT tracked by git (no .git repo in project)

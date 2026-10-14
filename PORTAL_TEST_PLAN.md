# HR Portal - Master Test Plan (Interactive Checklists)

Use this document to manually verify all core capabilities, security controls, and workflow pathways in the HR Portal.

---

## 📋 Stage Checklist Index

| Stage | Name | Target Components | Status |
|:---:|---|---|:---:|
| **Stage 1** | System Connection & Diagnostics | Firestore, Dev Server, Console | [x] Passed |
| **Stage 2** | Portal Authentication & Scope Isolation | Firebase Auth, Login Routing, Session Storage | [x] Passed |
| **Stage 3** | Staff Management & Security Integration | `/staff_accounts`, Auth Sync, Password Resets, Smart Deletes | [x] Passed |
| **Stage 4** | Granular Permissions & Role-based Overrides | Module Cards, Allow/Deny/Inherit Overrides, UI Hiding | [x] Passed |
| **Stage 5** | Organisation Management & Dynamic Designations | Site Configuration, Global Designations Library, Site Mapping | [x] Passed |
| **Stage 6** | Recruitment & Referral Onboarding Links | Link Tracker, Prefill Configuration, Phone Locking, Reusable Toggles, Link Edits, Reactivation, WhatsApp Share | [x] Passed |
| **Stage 7** | Onboarding Drafts & Deletion Security Rules | Recovery Tokens, `firestore.rules` Draft Deletion Checks | [x] Passed |
| **Stage 8** | Onboarding Candidate Wizard & Field Interactions | Wizard Steps, Prefills, Field Rules, Aadhaar Parse, Quotas | [x] Passed |
| **Stage 9** | Onboarding Candidate Form Submission & Auth Transition | Guest/Google Submission, Auth Transition, Sheet Sync, UID Conflicts | [x] Passed |
| **Stage 10** | Onboarding Printable Biodata Sheets | Passport Photos, CSS Print Media, Layout Grid | [x] Passed |
| **Stage 11** | Multi-Level Workflow & Onboarding Review | Assign Staff, Request Correction, Final Approval Promotion | [ ] Pending |
| **Stage 12** | Master Employee Directory & Data Privacy | Tab Filtering, Column Customizer, CSV Exporter, Masking Rules | [ ] Pending |
| **Stage 13** | Active Employee Dashboard Actions | Leave Balance Requests, Emergency Contacts, Profiling | [ ] Pending |
| **Stage 14** | Resignation & Offboarding Lifecycle | Relieve Promotion, Google Drive Archiving, Login Blocking | [ ] Pending |

---

### 🏁 Stage 1: System Connection & Diagnostics
*Goal: Ensure the database connection and local environment are initialized without console warnings or connectivity blocks.*

| Step ID | Test Action | Expected Result | Status | Observation / Comment |
|:---:|---|---|:---:|---|
| **1.1** | Start the local Vite server (`npm run dev`) or access the live URL. | Portal loads successfully. Dev server uses strict port `3000`. | [ ] Pass<br>[ ] Fail | |
| **1.2** | Open browser developer console (F12). Inspect logs on mount. | No red connection warnings. Firebase Firestore set to dev-logging level only. | [ ] Pass<br>[ ] Fail | |
| **1.3** | Trigger slow connections or mock offline status. | Direct database operations show clear "Connection Troubleshooter" banners when blocked. | [ ] Pass<br>[ ] Fail | |
| **1.4** | Check HTML markup structure and meta descriptions. | Meets basic SEO metrics: single `<h1>` structure, meta tags present. | [ ] Pass<br>[ ] Fail | |

---

### 🔑 Stage 2: Portal Authentication & Scope Isolation
*Goal: Verify login routing, session isolation, and access restrictions between employee and management portals.*

| Step ID | Test Action | Expected Result | Status | Observation / Comment |
|:---:|---|---|:---:|---|
| **2.1** | Navigate to `/admin/login` and `/login`. | Correct layouts render. Local storage `portalType` writes `management` and `employee` respectively. | [ ] Pass<br>[ ] Fail | |
| **2.2** | **Negative Test:** Enter an unregistered username or invalid password. | System throws "Invalid credentials" error. Network payload does not leak database schemas. | [ ] Pass<br>[ ] Fail | |
| **2.3** | **Role Login (Admin):** Enter Super Admin login (e.g. `admin@uniquedelta.com`). | Redirected to `/admin/dashboard` showing full navigation options and widgets. | [ ] Pass<br>[ ] Fail | |
| **2.4** | **URL Bypass Protection:** Copy `/admin/dashboard` URL. Log out. Attempt to paste and load URL. | Router intercepts request, redirects user back to `/admin/login` instantly. | [ ] Pass<br>[ ] Fail | |
| **2.5** | **Employee SSO:** Log in using Google Sign-in on Employee Portal. | Successfully maps Google credentials to matching Employee database record. | [ ] Pass<br>[ ] Fail | |

---

### 👥 Stage 3: Staff Management & Security Integration
*Goal: Test deduplicated data writes, direct Firebase Auth status synchronization, Admin-led password reset, and smart record deletions.*

| Step ID | Test Action | Expected Result | Status | Observation / Comment |
|:---:|---|---|:---:|---|
| **3.1** | Create a new Staff Account from the Admin panel. Check Firestore collection writes. | Creates document ONLY in `/staff_accounts` collection. No record created in legacy `/staff`. | [ ] Pass<br>[ ] Fail | |
| **3.2** | **Direct Password Reset:** Open Edit Staff modal. Enter new password in "Reset Password" card, click Reset. | Calls `resetStaffUserPassword` Cloud Function. Password updates instantly in Firebase Auth. Login succeeds with new password. | [ ] Pass<br>[ ] Fail | |
| **3.3** | **Status Sync (Disable):** Click toggle to disable the Staff user. Check Firebase Auth console. | Firestore status updates to `isDisabled: true`. Firebase Auth account is marked `disabled`. User is blocked from logging in. | [ ] Pass<br>[ ] Fail | |
| **3.4** | **Status Sync (Enable):** Re-enable the disabled Staff user. | Auth account status resets. Logins succeed immediately. | [ ] Pass<br>[ ] Fail | |
| **3.5** | **Smart Delete (Clean Links):** Initiate delete on a Staff member linked to sites or onboarding reviews. Select "Clean Links". | Staff account is deleted. Linked records remain, but supervisor/assignee fields are cleared in database. | [ ] Pass<br>[ ] Fail | |
| **3.6** | **Smart Delete (Purge Entire Records):** Initiate delete. Select "Delete Account + Entire Records". | Staff account is deleted, along with all associated locations (sites), employees, and reviews. | [ ] Pass<br>[ ] Fail | |

---

### 🛡️ Stage 4: Granular Permissions & Role-based Overrides
*Goal: Test default role permission mappings, explicit user overrides, inheritance logic, and UI hiding rules.*

| Step ID | Test Action | Expected Result | Status | Observation / Comment |
|:---:|---|---|:---:|---|
| **4.1** | Navigate to **Roles & Permissions**. Edit a default Role module configuration (e.g. HR Manager). | Updates default settings in Firestore. Changes are inherited by all staff assigned to that Role. | [x] Pass<br>[ ] Fail | |
| **4.2** | Navigate to **User Specific Permissions**. Add an explicit override to a Staff user. | Saves override map in Firestore. User overrides take priority over their default Role permissions. | [x] Pass<br>[ ] Fail | |
| **4.3** | Set a sub-option override state to `Inherit` for a staff user. | The option inherits and displays the underlying Role's active configuration state. | [x] Pass<br>[ ] Fail | Verified and added single-click Reset button. |
| **4.4** | **Dynamic UI Hiding:** Disable a module access permission (e.g. "Leave Requests") for a staff user. Log in as that user. | Dashboard leave widget, sidebar tab, and quick shortcuts are completely hidden. No unauthorized Firestore queries run. | [x] Pass<br>[ ] Fail | |
| **4.5** | **Super Admin Lockdown:** Attempt to configure default permissions, status, or overrides for Super Admin roles. | All modifications, toggles, or deletions are strictly locked and hidden to prevent privilege lockouts. | [x] Pass<br>[ ] Fail | Verified Super Admin controls are fully locked down in UI. |

---

### 🏢 Stage 5: Organisation Management & Dynamic Designations
*Goal: Verify site locations setup, global designations library creation, and designation allowed boundaries.*

| Step ID | Test Action | Expected Result | Status | Observation / Comment |
|:---:|---|---|:---:|---|
| **5.1** | Add a new Site Business Location under Site Management. | Location created successfully. Appears in site selection lists. | [ ] Pass<br>[ ] Fail | |
| **5.2** | Open the **Master Designations Library** modal. Add and delete designations. | Master list updates. Unused designations can be deleted; used ones show reference warning. | [ ] Pass<br>[ ] Fail | Note: Used designation deletion lockout verification is deferred to Stage 11 (Onboarding Promotion). |
| **5.3** | Configure **Authorized Designations** checklist inside a Site edit modal. | Restricts this specific site location to only map to selected designations in the database. | [ ] Pass<br>[ ] Fail | |
| **5.4** | Navigate to Form Builder and edit "Designation" field options. | Form Builder displays information banner explaining that options are managed dynamically via Site Management. | [ ] Pass<br>[ ] Fail | |

---

### 🔗 Stage 6: Recruitment & Referral Onboarding Links
*Goal: Test creation of onboarding links, prefill controls, phone verification locking, reusable link toggles, reactivations, link edits, and WhatsApp sharing.*

| Step ID | Test Action | Expected Result | Status | Observation / Comment |
|:---:|---|---|:---:|---|
| **6.1** | Navigate to **Recruitment & Referral Invites**. Generate a link. Select Site and Designation. | Designation dropdown lists only designations authorized for that site location. | [x] Pass<br>[ ] Fail | |
| **6.2** | Configure Prefill customizer and check fields. Toggle "Lock Prefilled Fields". | Link is generated. Selected onboarding form inputs will prefill and lock for the candidate. | [x] Pass<br>[ ] Fail | |
| **6.3** | Enable "Lock Candidate Phone" and input phone number. Generate link. | Generated link is bound to that phone number. Candidate must verify with matching number. | [x] Pass<br>[ ] Fail | |
| **6.4** | Click generated link to start onboarding. Check **Link Tracker** page. | Clicks counter increments. Once candidate completes Auth choice, Starts counter increments. | [x] Pass<br>[ ] Fail | |
| **6.5** | Revoke link or let expiration pass. Try to load link. | Displayed error page informs candidate that invitation link has expired or has been revoked. | [x] Pass<br>[ ] Fail | |
| **6.6** | **Edit Active Invite Link**: In Tracker list, click Edit on an active link. Change site, designation, or prefilled values and save. Open link in incognito. | Changes are updated in Firestore and reflected immediately on tracker. Incognito form pre-fills with updated values. Non-permitted staff cannot see Edit button. | [x] Pass<br>[ ] Fail | |
| **6.7** | **Reusable (Permanent) Links**: Toggle "Reusable Link" on during creation. Verify Phone Lock/Expiry are hidden. Generate and open link in multiple devices/sessions. | Reusable badge shows in Tracker. Multiple submissions can be made from same link. Clicks and Joins counters increment correctly. | [x] Pass<br>[ ] Fail | |
| **6.8** | **Reactivate & Extend Expiry**: Find an expired or revoked link. Click "Extend Expiry / Reactivate". Choose a preset or custom date. | Link status changes back to Active. Expiry date is extended in Firestore. Loading link works again. | [x] Pass<br>[ ] Fail | |
| **6.9** | **Smart WhatsApp Sharing**: Click WhatsApp button. If phone-locked, check routing. If not locked, type a number in popup and check routing. Leave empty and check standard routing. | Phone-locked link routes directly to WhatsApp chat with that number. Non-locked link prompts with styled modal. Typing number starts direct chat. Leaving empty falls back to contact selection. | [x] Pass<br>[ ] Fail | |
| **6.10** | **Granular Role Toggle**: Log in as Admin. Navigate to Roles & Permissions. Create/Edit a role and toggle `Track All Staff Invites` (INVITES_VIEW_ALL), `Edit Active Invites` (INVITES_EDIT), `Reactivate Expired Links` (INVITES_REACTIVATE), and `Revoke/Delete Links` (INVITES_DELETE). | Permissions display with detailed explanations, save correctly to database, and propagate instantly to assigned users. | [x] Pass<br>[ ] Fail | |
| **6.11** | **Track All Staff Invites (INVITES_VIEW_ALL)**: Log in as a staff member with `INVITES_VIEW_ALL` disabled. | Tracker page lists only links generated by this user. Staff filter dropdown is hidden. Enabling `INVITES_VIEW_ALL` shows links from all staff and displays the creator filter. | [x] Pass<br>[ ] Fail | |
| **6.12** | **Edit & Reactivate Guards**: Log in as a staff member without `INVITES_EDIT` and `INVITES_REACTIVATE`. | Edit (pencil) and Reactivate (sync arrow) buttons are hidden in the tracker list. Database updates to these fields are blocked. | [x] Pass<br>[ ] Fail | |
| **6.13** | **Revoke/Delete Link Guard**: Log in as a staff member without `INVITES_DELETE`. | Revoke (trash) button is hidden in the tracker list. Direct database delete/revoke updates are rejected by Firestore Security Rules. | [x] Pass<br>[ ] Fail | |

---

### 📝 Stage 7: Onboarding Drafts & Deletion Security Rules
*Goal: Verify draft submissions recovery, client-side encryption, and administrative deletion rules.*

| Step ID | Test Action | Expected Result | Status | Observation / Comment |
|:---:|---|---|:---:|---|
| **7.1** | As a candidate, fill out details, click "Save Draft". Note recovery code. | Draft data is encrypted and saved to Firestore. Token is generated. | [ ] Pass<br>[ ] Fail | |
| **7.2** | Refresh page/clear cookies. Enter recovery token in wizard. | Draft data recovers and populates all form sections instantly. | [ ] Pass<br>[ ] Fail | |
| **7.3** | **Draft Deletion (Security Rules Check):** As Admin, navigate to Drafts page. Click Delete on a draft record. | **VITAL RULE CHECK:** Draft document and associated files delete successfully. No `FirebaseError: Missing or insufficient permissions` error occurs. | [ ] Pass<br>[ ] Fail | |
| **7.4** | Attempt to delete a draft as an unauthorized standard staff user. | Operation is denied at the Firebase Security Rules level. | [ ] Pass<br>[ ] Fail | |

---

### 📝 Stage 8: Onboarding Candidate Wizard & Field Interactions
*Goal: Test step-by-step navigation, dynamic validation logic, conditional fields, Aadhaar PDF parsing, password decryption, and upload file size constraints.*

| Step ID | Test Action | Expected Result | Status | Observation / Comment |
|:---:|---|---|:---:|---|
| **8.1** | **Welcome Page & Auth Selection**: Navigate to `/join` (or click active invite link). Select Guest onboarding. | Custom-designed welcome landing page renders correctly. Selecting Guest creates anonymous session and forwards to step 1. | [x] Pass<br>[ ] Fail | |
| **8.2** | **Prefill & Lock Verification**: Access form via a phone-locked and locked-field prefilled invite. | Prefilled inputs (e.g. Phone, Site, Designation) are populated and locked (disabled/uneditable). | [x] Pass<br>[ ] Fail | |
| **8.3** | **Personal Details Wizard Step (Step 1)**: Fill out Name (invalid/valid), DOB, Blood Group, Height, and Spouse Name. Toggle Marital Status. | Real-time errors block next step if name has numbers or is empty. Spouse Name field shows only if "Married" is selected. | [x] Pass<br>[ ] Fail | |
| **8.4** | **Job Details Wizard Step (Step 2)**: Select Site. Open Designation dropdown. Toggle Police Case / Previous Exp. | Designation dropdown is restricted to authorized designations for selected Site. Police Case / Previous Exp details textareas show conditionally. | [x] Pass<br>[ ] Fail | |
| **8.5** | **Address Details Wizard Step (Step 3)**: Fill Present Address. Check "Same as Present Address" checkbox. | Permanent Address text is auto-copied from Present Address and the textarea becomes disabled. Unchecking enables and clears it. | [x] Pass<br>[ ] Fail | |
| **8.6** | **Reference Details Wizard Step (Step 4)**: Enter Reference Details. Test invalid relationship/phone. | Phone validation triggers error for non-digit or length != 10 input. | [x] Pass<br>[ ] Fail | |
| **8.7** | **Family Details Wizard Step (Step 5)**: Enter Father and Mother details. Test mobile numbers. | 10-digit mobile number rules are enforced for parents. Wizard blocks advancement on invalid input. | [x] Pass<br>[ ] Fail | |
| **8.8** | **Government IDs & Aadhaar Parsing (Step 6)**: Enter PAN format (invalid vs. valid). Click Aadhaar Autofill. Upload unencrypted/encrypted Aadhaar PDF. | PAN format checks alphanumeric layout (e.g. ABCDE1234F). Unencrypted Aadhaar PDF autofills name, gender, DOB, address. Encrypted PDF triggers custom styled password modal; inputting password decrypts, starts download of unlocked copy, and autofills fields. | [x] Pass<br>[ ] Fail | |
| **8.9** | **Bank Details Wizard Step (Step 7)**: Select Bank Name, input account number and IFSC code. | Account number must be numeric. IFSC Code must match 11-char alphanumeric pattern (e.g., UTIB0000123). | [x] Pass<br>[ ] Fail | |
| **8.10** | **Document Uploads & Storage Check (Step 8)**: Try uploading files. Attempt to upload files > 5MB and > 15MB. | System shows alert warning banner for files > 5MB. Files > 15MB are blocked with error. Storage size calculator updates total folder size in real-time. | [x] Pass<br>[ ] Fail | |
| **8.11** | **Google Link Mid-Form**: Enter Guest Mode, fill details. Click "Link Google Account" in the amber top banner. Run Google Auth. | Google OAuth popup completes. Amber banner and recovery code guest features disappear; session is linked to Google Auth. | [x] Pass<br>[ ] Fail | |

---

### 📝 Stage 9: Onboarding Candidate Form Submission & Auth Transition
*Goal: Test final submission execution, file upload progress meters, Firebase database records cleaning, Google Sheet synchronization, and UID duplication checks.*

| Step ID | Test Action | Expected Result | Status | Observation / Comment |
|:---:|---|---|:---:|---|
| **9.1** | **Successful Submission (Guest Mode)**: Fill all required fields. Click "Submit Application" at the end of Step 8. | Real-time progress bar shows individual file upload percentages (0% -> 100%). On completion, deletes draft recovery token, clears sessionStorage/IndexedDB, and shows success page with Reference ID (`SUB-xxxx`). | [x] Pass<br>[ ] Fail | |
| **9.2** | **Successful Submission (Google Linked)**: Complete the wizard as a Google-authenticated user. Click Submit. | Submits successfully. Firestore cleans draft document, file upload progress reaches 100%, and sessionStorage is cleared. | [x] Pass<br>[ ] Fail | |
| **9.3** | **Google Form Sync Check**: Open the Google Apps Script logs or check the linked Google Spreadsheet. | Best-effort sync triggers successfully. Spreadsheet gains a row mapping the newly submitted candidate. | [x] Pass<br>[ ] Fail | |
| **9.4** | **UID Conflict Prevention**: Attempt to submit using a Google account that is already linked to an existing active employee. | Submission validation catches the duplicate UID. Displays clear error explaining this account is already registered. | [x] Pass<br>[ ] Fail | |

---

### 🖨️ Stage 10: Onboarding Printable Biodata Sheets
*Goal: Verify dynamic passport photo extraction, print media CSS rules, and structured layout formatting.*

| Step ID | Test Action | Expected Result | Status | Observation / Comment |
|:---:|---|---|:---:|---|
| **10.1** | Select a pending review submission. Click **"View/Print Biodata"** (requires `SUBMISSIONS_PRINT_BIODATA` permission). | Modal displays A4 paper formatted biodata preview. | [x] Pass<br>[ ] Fail | |
| **10.2** | Check the candidate photo box in the header block. | Secure image helper resolves Firestore storage path correctly. Renders candidate photo (no `[object Object]` error). | [x] Pass<br>[ ] Fail | |
| **10.3** | Click the **"Print"** button inside the modal. | Opens browser print dialog. Page boundaries align cleanly to A4. | [x] Pass<br>[ ] Fail | |
| **10.4** | Inspect the print preview page. | CSS print-media rules hide navigation menus, sidebar, and page buttons. Header and footer URLs are omitted. Signature boxes align at page bottom. | [x] Pass<br>[ ] Fail | |

---

### ⚖️ Stage 11: Multi-Level Workflow & Onboarding Review
*Goal: Test multi-step review stages, assigned staff allocations, profile correction loops, and promotions to active directory.*

| Step ID | Test Action | Expected Result | Status | Observation / Comment |
|:---:|---|---|:---:|---|
| **11.1** | Check submission detail fields. Cross-check against data privacy rules. | Form fields restricted as `HIDDEN` by current staff permissions are hidden in the review panel. | [x] Pass<br>[ ] Fail | |
| **11.2** | Click **"Request Profile Correction"**. Select field and type reason. | Submission status moves to "Correction Required". Candidate receives notification and is unlocked to edit that field. | [x] Pass<br>[ ] Fail | |
| **11.3** | As Candidate, modify the requested correction field and resubmit. | Review status returns to "Submitted". Field highlights changes made. | [x] Pass<br>[ ] Fail | |
| **11.4** | **Rejection Security:** Attempt to reject the submission as staff user lacking `SUBMISSIONS_REJECT` permission. | Rejection action buttons are disabled or hidden in the UI. | [x] Pass<br>[ ] Fail | |
| **11.5** | Click **"Approve"**. Input permanent Employee ID. | Promoting writes record to `/employees` directory. Increments Joins count on referral tracker. | [x] Pass<br>[ ] Fail | |
| **11.6** | **Staff Scope & Scoped Site Isolation**: Log in as a standard Staff user (e.g. Field Officer with site limitations). Check the Review pipeline list. | The list displays only candidate submissions that belong to the sites assigned to the staff user's scope. Other sites are strictly omitted. | [x] Pass<br>[ ] Fail | |
| **11.7** | **Candidate Correction Designation Sync**: Open correction link. Select a new Site (Unit/Facility). | The Designation dropdown automatically filters to show only allowed designations for the new site. The current designation selection clears if invalid. | [x] Pass<br>[ ] Fail | |
| **11.8** | **Admin Review Designation Warning**: Open Admin Review Modal for a candidate with mismatched site/designation. | Red warning banner "Designation Mismatch Warning" displays in the details preview modal. | [x] Pass<br>[ ] Fail | |
| **11.9** | **Management Modules Site-Scoping**: Log in as Field Officer A. Access Leaves, Account Updates, Resignations, and Disciplinary Management sub-pages. | Banners "Showing Assigned Sites Only" display. Lists are filtered to show only requests belonging to Field Officer A's assigned sites. | [x] Pass<br>[ ] Fail | |
| **11.10** | **Workflow Auto-Escalation (Skip Unassigned)**: Set Level 1 = Field Officer, Level 2 = Manager, Level 3 = HR. Create Site with no Field Officer. Submit request. Log in as Manager. | Request appears in Manager queue as `Level 2: Manager` (Level 1 skipped). | [x] Pass<br>[ ] Fail | |
| **11.11** | **Intermediate Employee ID Assignment**: Log in as HR Manager (with `SUBMISSIONS_ASSIGN_EMPLOYEE_ID` permission). Review Level 2 request. Input ID. Approve. | ID saves to database and propagates forward as pre-filled value for subsequent steps. | [ ] Pass<br>[ ] Fail | |
| **11.12** | **Direct Final Approval (Bypass)**: Log in as Super Admin. Check "Direct Final Approval (Bypass Workflow)", assign ID, and approve. | Request is immediately marked `APPROVED` and candidate promoted to `/employees` bypassing remaining levels. | [ ] Pass<br>[ ] Fail | |
| **11.13** | **Revert to Level Selection**: Log in as Super Admin. Click "Revert" on an intermediate request. | Select from dropdown containing all lower levels (Level 1, Level 2, etc.) and reset request to selected level. | [ ] Pass<br>[ ] Fail | |
| **11.14** | **Same-Role Multi-Level Progress**: Configure HR role at both Level 2 and Level 4. Verify progression. | HR approvals at Level 2 progress to Level 3 Manager, and return to HR at Level 4 for final approval and ID confirmation. | [ ] Pass<br>[ ] Fail | |
| **11.15** | **Granular Submissions Action Checks**: Log in as staff user without `SUBMISSIONS_APPROVE` but with `SUBMISSIONS_REJECT`. | Submissions review panel is accessible, but the "Approve" button is hidden. Only the "Reject" button is visible and active. | [ ] Pass<br>[ ] Fail | |
| **11.16** | **Granular Leave Actions**: Log in as staff user without `LEAVES_APPROVE`, `LEAVES_REJECT`, or `LEAVES_REVERT_DECISION`. | Leaves review modal shows details, but Approve, Reject, and Revert buttons are hidden. Direct database updates are blocked. | [ ] Pass<br>[ ] Fail | |
| **11.17** | **Granular Leave Deletion**: Log in as staff user without `LEAVES_DELETE` vs with `LEAVES_DELETE`. | "Delete Permanent Record" button is hidden if permission is absent, and visible/functional if present. Firestore Rules enforce deletion check. | [ ] Pass<br>[ ] Fail | |
| **11.18** | **Granular Account Update Actions**: Log in as staff user without `ACCOUNT_UPDATES_APPROVE`, `ACCOUNT_UPDATES_REJECT`, or `ACCOUNT_UPDATES_REVERT_DECISION`. | Account updates review modal has Approve, Reject, and Revert buttons hidden. Operations are secured end-to-end. | [ ] Pass<br>[ ] Fail | |
| **11.19** | **Granular Resignation Actions**: Log in as staff user without `RESIGNATIONS_APPROVE`, `RESIGNATIONS_REJECT`, or `RESIGNATIONS_REVERT_DECISION`. | Resignations review modal has Approve, Reject, and Revert buttons hidden. Operations are secured end-to-end. | [ ] Pass<br>[ ] Fail | |
| **11.20** | **Smart Revert Level Suffix Warnings**: Log in as Super Admin. Open a request for a site with no Level 1 Field Officer assigned. Click Revert. | Revert level selector lists `Level 1: Field Officer (No staff assigned)` indicating the step is a dead-end, while active levels show without warning. | [ ] Pass<br>[ ] Fail | |
| **11.21** | **HR Manager Queue Filtering**: Log in as HR Manager (Sai, role: `role-hr-manager`). Check pending submissions list. | Submissions currently at Level 1 or Level 2 (for sites with active Level 1/2 staff assigned) are **hidden** from the HR Manager's list. Only requests that have reached Level 3 (or belong to sites with no Level 1/2 staff) appear in their queue. | [x] Pass<br>[ ] Fail | |
| **11.22** | **Guest Correction Link Verification**: Request profile correction for a Guest onboarding submission. Open the link in incognito. | The page prompts strictly for **Date of Birth** and **Registered Mobile Number** (manual verification). No Google Sign-in prompt is displayed. | [x] Pass<br>[ ] Fail | |
| **11.23** | **Hardened Guest Verification Errors**: Enter incorrect values in the guest verification form. Click verify. | Form displays generic message: `"The Date of Birth or Mobile Number entered does not match our records."` and does not leak which specific field was wrong. | [x] Pass<br>[ ] Fail | |
| **11.24** | **Guest Correction Submission Success**: Enter correct verification details, edit any field (e.g. Full Name), and click Submit. | Submits successfully without any `FirebaseError: Missing or insufficient permissions` errors, and redirects to success. | [x] Pass<br>[ ] Fail | |

---

### 📊 Stage 12: Master Employee Directory & Data Privacy
*Goal: Test Active/Pending/Relieved tabs, column filtering options, export data privacy mappings, and directory masking.*

| Step ID | Test Action | Expected Result | Status | Observation / Comment |
|:---:|---|---|:---:|---|
| **12.1** | Open Master Employee List. Toggle Active, Pending, Relieved, and Recycle Bin tabs. | Tab lists filter database records accurately. Pending tab correctly loads incomplete directories. | [ ] Pass<br>[ ] Fail | |
| **12.2** | **Granular Tab Access:** Disable Relieved and Recycle Bin tabs permissions for a staff user. Log in. | Relieved and Recycle Bin tabs are hidden. Directory defaults to Active tab. | [ ] Pass<br>[ ] Fail | |
| **12.3** | **Column Security:** Log in as staff user lacking `EMPLOYEES_MANAGE_SECURITY` permission. | Google/Manual Auth quick stats card is hidden. Email and security column/filters are omitted from directory list. | [ ] Pass<br>[ ] Fail | |
| **12.4** | Open Column Customizer and toggle columns. Check field visibility rules. | Columns marked `HIDDEN` in role settings are blocked from selection and hidden from the table. | [ ] Pass<br>[ ] Fail | |
| **12.5** | Click **Export CSV** (requires CSV export permission). Open downloaded file. | Columns marked `HIDDEN` in the data privacy settings are excluded from the exported spreadsheet file. | [ ] Pass<br>[ ] Fail | |

---

### 📊 Stage 13: Active Employee Dashboard Actions
*Goal: Verify profile claims, employee self-actions, leave balance requests, and personal details updates.*

| Step ID | Test Action | Expected Result | Status | Observation / Comment |
|:---:|---|---|:---:|---|
| **13.1** | Log in as Employee. Verify dashboard header badge. | Badge shows "Referred by: [Staff Name]" (if employee joined via referral). | [ ] Pass<br>[ ] Fail | |
| **13.2** | **Profile Update Request:** Submit emergency contact update from profile edit panel. | Creates record in `/account_updates` queue. Admin is notified. | [ ] Pass<br>[ ] Fail | |
| **13.3** | **Leave Request Submission:** Submit Sick Leave for 3 days. | Request is queued. Leave balances page displays "Pending: 3 days". | [ ] Pass<br>[ ] Fail | |
| **13.4** | Approve leave request as Admin. Check employee balance. | Employee dashboard leave widget updates. Balance decreases by 3 days. | [ ] Pass<br>[ ] Fail | |
| **13.5** | **Multi-Site Leave Request Routing**: Log in as an Employee assigned to multiple sites. Submit a Leave request. | Dropdown "Select Site for Leave" appears. Selecting secondary site and submitting routes request correctly to secondary supervisor's view only. | [ ] Pass<br>[ ] Fail | |
| **13.6** | **Multi-Site Resignation Routing**: Log in as an Employee assigned to multiple sites. Submit a Resignation. | Dropdown "Select Resigning Site" appears. Selecting secondary site and submitting routes request correctly to secondary supervisor's view only. | [ ] Pass<br>[ ] Fail | |

---

### 🚪 Stage 14: Resignation & Offboarding Lifecycle
*Goal: Verify offboarding resignation submissions, workflow reliefs, Google Drive archives, and auth lockouts.*

| Step ID | Test Action | Expected Result | Status | Observation / Comment |
|:---:|---|---|:---:|---|
| **14.1** | As Employee, navigate to Resignations tab. Submit resignation request. | Status changes to "Resigned". Request enters admin approvals queue. | [ ] Pass<br>[ ] Fail | |
| **14.2** | **Rejection Security:** Attempt to reject resignation request as staff user lacking `RESIGNATIONS_REJECT` permission. | Reject buttons are hidden. Standard staff can only view or approve. | [ ] Pass<br>[ ] Fail | |
| **14.3** | Click **"Approve & Relieve"** as Admin. | Status in employees directory moves to "Relieved". | [ ] Pass<br>[ ] Fail | |
| **14.4** | Check employee Google Drive folder. | Drive folder is moved to "Recycle Bin" (archived/soft-deleted). | [ ] Pass<br>[ ] Fail | |
| **14.5** | Log out of Admin. Attempt to log in to the employee dashboard with the relieved employee account. | Access is denied. Login is blocked at the authentication level. | [ ] Pass<br>[ ] Fail | |

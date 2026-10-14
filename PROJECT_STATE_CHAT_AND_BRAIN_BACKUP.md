# 🧠 Master Project State, Chat History & Brain Backup: UDF Subdomains
**Conversation ID:** `d138370b-485e-4726-8f79-3c6cd1a7ecee`  
**Timestamp:** 2026-10-09  
**Firebase Project:** `hr-portal-unique-delta`  
**Status:** Live Deployed & Synchronized  

---

## 📌 1. Quick Retrieval & System Cheat Sheet

### 🌐 Live Production Subdomains & Hosting Targets
| Subdomain / URL | Target Name | Directory | Primary Purpose |
|---|---|---|---|
| `https://udfonline.in` (`https://hr-portal-unique-delta.web.app`) | `main-site` | `dist-public` | Public landing, Blogs, `/join` onboarding application, `/careers` job vacancies, `/claim-profile` |
| `https://admin.udfonline.in` (`https://hr-portal-unique-delta-admin.web.app`) | `admin-site` | `dist-admin` | Super Admin & Staff Portal (Approvals, Onboarding, Sites, Staff, Form Builder, Recycle Bin) |
| `https://employee.udfonline.in` (`https://hr-portal-unique-delta-employee.web.app`) | `employee-site` | `dist-employee` | Employee self-service (Attendance, Leaves, Documents, Profile, Gamification) |

### 🔑 Master Credentials
- **Super Admin:** `admin@uniquedelta.com` / `admin1234`
- **Default Roles Available:** Super Admin, HR Manager, Field Officer, Site Supervisor, Account Admin

### 🚀 Build & Deploy Commands
```powershell
# Typecheck validation
npx tsc --noEmit

# Build individual targets
npm run build:admin        # Builds admin portal to dist-admin
npm run build:web:public   # Builds public site to dist-public
npm run build:web:employee # Builds employee site to dist-employee

# Deploy Hosting & Firestore Security Rules (Quoting required in PowerShell!)
npx firebase deploy --only "hosting,firestore:rules"
```

---

## ❓ 2. Why Vacancies Were Not Automatically Deleted with Sites (And The Fix)

### The Problem / Root Cause
1. **Architectural Decoupling:** In the portal's Firestore database, Sites are stored in `settings/sites` (as an array of objects inside a single settings document) or standalone `sites` documents, while job vacancies are stored in an independent top-level Firestore collection named `vacancies`.
2. **Missing Cascade Logic:** When a site was deleted in `AdminSiteManagementPage.tsx`, the deletion routine only filtered the site out of the `sites` array in `settings/sites` and cleaned up designation mappings in the Form Builder `optionsMap`. It **never queried or removed documents from the `vacancies` collection**.
3. **The Result:** When a site was deleted, any job openings created under that site remained alive with `status: 'Open'` in Firestore. Consequently, visitors navigating to `https://udfonline.in/careers` or reading blog posts still saw active job openings for sites that no longer existed, creating orphaned job postings.

### The Complete Fix Implemented
1. **Cascade Soft-Delete to Recycle Bin:** When a site is deleted in `AdminSiteManagementPage.tsx`:
   - The system automatically queries all vacancies matching `siteId === siteToDelete.id` or `siteName === siteToDelete.name`.
   - Each matching vacancy is moved to the `recycle_bin` collection (`itemType: 'VACANCY'`).
   - The vacancies are removed from the active `vacancies` collection, preventing ghost job postings on `/careers`.
   - The full vacancy records are stored in the deleted site's Recycle Bin `metadata.linkedVacancies`.
2. **Automatic Restoration on Undo or Super Admin Restore:**
   - If the user clicks **UNDO** on the 10-second toast notification, or if a Super Admin restores the site from `/admin/recycle-bin`, `recycleBinService.ts` automatically restores all linked vacancies back to the active `vacancies` collection with `status: 'Open'`.
3. **Vacancy Manager Upgrade:** Deleting a vacancy directly in `AdminVacancyManager.tsx` now also routes through `moveToRecycleBin` with an interactive 10-second Undo toast.

---

## 🗑️ 3. Universal Undo & Recycle Bin System Architecture

### Security & Access Control
- **Super Admin ONLY:** Access to the Recycle Bin dashboard (`/admin/recycle-bin`) is strictly restricted to Super Admin accounts (`isSuperAdmin`).
- **Staff Accounts Blocked:** Staff accounts cannot view the Recycle Bin tab in the navigation menu, and Firestore security rules enforce:
  ```javascript
  match /recycle_bin/{id} {
    allow read, update, delete: if isSuperAdmin();
    allow create: if isSuperAdmin() || (isStaffAccount() && isActiveStaff());
  }
  ```
- **Staff Deletion Cascade Eliminated:** The previous destructive "Delete Account + Entire Records" option in `AdminStaffManagementPage.tsx` (which previously deleted physical client sites assigned to a supervisor) has been **permanently eliminated**. Deleting a staff account now moves the staff profile to the Recycle Bin and unassigns them from sites without deleting the sites.

### 10-Second Interactive Undo Toast (`showUndoToast`)
- Displays an interactive amber floating toast for 8-10 seconds upon deleting any site, staff, vacancy, employee, or submission.
- Clicking **UNDO** immediately calls `restoreFromRecycleBin(id)` and puts the record back into production state with 0 data loss.
- 30-day retention countdown with automated cleanup calculation.

---

## 💬 4. Chronological Chat History & User Directives

### Turn 1: Fresh Onboarding Test Request
- **User:** *"ok i have delete now lets test onboarding and making them active into master employee list so what ever the options are there during this procees we need to test them all we are testing in emplooyee and staff accounts not from super admin ok so prepare a plan based on this all granualr tests everything ok from filling form to making him active employee ok"*
- **Resolution:** Outlined the workflow for testing candidate onboarding using Field Officer / Staff accounts and Employee accounts without using Super Admin.

### Turn 2: Phased Testing Plan Request
- **User:** *"not like this give it to me in phases and it should be like the first test should be the requrement to next test like this plan it and give me english instrctions step by step to be done in website not local did you deploy website"*
- **Resolution:** Formatted the plan into strict sequential prerequisite phases with click-by-click instructions on the live website. Verified live deployment.

### Turn 3 & 4: Previous Test Plan Consistency & Deployment
- **User:** *"is this how you give me previously check hhow you gave previously"* / *"deploy and find the test plan in project files"*
- **Resolution:** Located `MASTER_MANUAL_TEST_PLAN.md` in the workspace root (333 lines, 17 phases) matching the exact previous format. Compiled all three subdomain targets and deployed to Firebase.

### Turn 5 & 6: Clean Slate & Accidental Site Cascade Deletion
- **User:** *"before testing i want to delete all staff accounts and sites ok"*
- **User:** *"i deleted it from website but when i delete the staff account and when i click delete entire records it deleted sites to why just answeer"*
- **Resolution:** Investigated `AdminStaffManagementPage.tsx`. Discovered that the "Delete Entire Records" option executed `allSites.filter(site => site.supervisorId !== staffToDelete.id)`, purging physical client sites from `settings/sites`. Permanently removed this destructive cascade option.

### Turn 7, 8 & 9: Universal Recycle Bin & Undo System
- **User:** *"this will cereate a huge problem if someone deltes it like this we dont have any retrival opeion or undo we should add the delete entire records or all other linked thins we should make it more secure with adding a password orwe need a idea for this"*
- **User:** *"what about this idea that what ever deleted in portal anyhting can we add a thing to undo that based on recent delets if we undo it it shouled be back to originat state is it possible where ever the detele option is there in poratl even if we delete anything can we undo"*
- **User:** *"please"*
- **User:** *"ok deploy"*
- **Resolution:** Built full Universal Recycle Bin system (`recycleBinService.ts`, `undoToast.tsx`, `AdminRecycleBinPage.tsx`). Soft deletes sites and staff accounts. Added 10s interactive Undo toast. Gated Recycle Bin to Super Admin only. Deployed live to Firebase.

### Turn 10: Vacancy Cascade & Chat/Brain File Backup
- **User:** *"when sites are deleted automatically why not vacancies are not deleted along with them also save this chat as a file and brain files in same file so if i loose this i can retrive it fast"*
- **Resolution:** Explained the decoupled Firestore architecture. Implemented automatic cascade soft-delete of linked vacancies when a site is deleted (and auto-restore). Generated this master `PROJECT_STATE_CHAT_AND_BRAIN_BACKUP.md` file capturing all context, code changes, and brain files.

---

## 🧪 5. Active Testing State & Next Live Steps

### Current Database State
- All test employees and test submissions have been wiped.
- All test staff accounts and test sites were cleared by user.
- **Goal:** Execute manual testing using **Staff** and **Employee** roles strictly on the live website.

### Immediate Step-by-Step Instructions on Live Website

#### Step 1: Create a Test Client Site (Super Admin)
1. Go to `https://admin.udfonline.in/login` and sign in as Super Admin (`admin@uniquedelta.com` / `admin1234`).
2. Navigate to **Sites** (`/admin/sites`).
3. Click **"+ Add New Site"**.
4. Enter:
   - **Site Name:** `Hyderabad Tech Park`
   - **Site Code:** `HTP-01`
   - **Location:** `HITEC City, Hyderabad`
   - **Address:** `Plot 12, Phase 2, HITEC City, Hyderabad, 500081`
5. Click **"Save Site"**. Confirm it appears in the active sites list.

#### Step 2: Create a Staff Account Scoped to That Site
1. Navigate to **Staff Accounts** (`/admin/staff`).
2. Click **"+ Add Staff Member"**.
3. Enter:
   - **Full Name:** `Ramesh Field Officer`
   - **Email:** `ramesh.fo@uniquedelta.com` (or your test email)
   - **Password:** `Staff@1234`
   - **Role:** `Field Officer`
   - **Assigned Sites:** Select `Hyderabad Tech Park` (`HTP-01`).
4. Click **"Create Staff Account"**.
5. Click your user profile in top-right and select **Logout**.

#### Step 3: Log In as Staff and Generate Candidate Invite Link
1. Go to `https://admin.udfonline.in/login`.
2. Sign in with the Staff account: `ramesh.fo@uniquedelta.com` / `Staff@1234`.
3. Notice that the Super Admin-only tabs (**Recycle Bin**, **System Logs**) are hidden.
4. Navigate to **Recruitment Invites** (`/admin/invites`).
5. Click **"Generate Candidate Invite Link"**.
6. Select Site: `Hyderabad Tech Park`. Copy the generated link (e.g., `https://udfonline.in/join?ref=...`).

#### Step 4: Open Public Site and Submit Onboarding Form
1. Open a Private / Incognito window.
2. Paste the invite link into the address bar and press Enter (`https://udfonline.in/join?ref=...`).
3. Verify that `Hyderabad Tech Park` is pre-selected and locked.
4. Fill out the application form:
   - Candidate Name: `Suresh Kumar`
   - Mobile: `9876543210`
   - Aadhaar, PAN, Bank Details, Emergency Contacts.
   - Test the **"Save Draft"** button $\rightarrow$ confirm draft token is given $\rightarrow$ resume draft.
5. Click **"Submit Application"**. Note down the Application Reference Number.

#### Step 5: Review & Approve Submission as Staff
1. Return to the Staff session on `https://admin.udfonline.in`.
2. Navigate to **Onboarding Submissions** (`/admin/submissions`).
3. Open `Suresh Kumar`'s application.
4. Review documents, add verification notes, and click **"Approve & Promote to Active Employee"**.
5. Assign Employee ID (e.g., `UDF-2026-001`).

#### Step 6: Verify Active Directory & Employee Portal Login
1. Navigate to **Employee Directory** (`/admin/employees`).
2. Verify `Suresh Kumar` is listed as **Active**.
3. Open `https://employee.udfonline.in/login` in Incognito.
4. Log in as the new employee and test the self-service dashboard (Profile, Leaves, Attendance).

---

## 🛠️ 6. Brain Scratch Scripts & Internal Tool References

### `check_staff_sites.cjs` (Scratch Tool)
```javascript
// Path: C:/Users/muthy/.gemini/antigravity-ide/brain/d138370b-485e-4726-8f79-3c6cd1a7ecee/scratch/check_staff_sites.cjs
// Used to verify Firestore documents directly via service account:
const admin = require('Z:/UDF_SUBDOMAINS/functions/node_modules/firebase-admin');
const fs = require('fs');
const envContent = fs.readFileSync('z:/UDF_SUBDOMAINS/.env.local', 'utf8');
const match = envContent.match(/^FIREBASE_SERVICE_ACCOUNT=(.*)$/m);
let val = match[1].trim();
if (val.startsWith("'") && val.endsWith("'")) val = val.substring(1, val.length - 1);
const serviceAccount = JSON.parse(val.replace(/\\n/g, '\n'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
// Queries collections: 'sites', 'staff_accounts', 'users'
```

### Background Daemon Task
- **Task ID:** `task-33`
- **Command:** `powershell -ExecutionPolicy Bypass -File "Z:\net-notch\server.ps1" -Port 3000`
- **Status:** Running in background as local helper server.

---

## 🔧 7. Turn 11: Fixes for Staff Deletion, Vacancy Manager & Dashboard Tab Lag (2026-10-09)

### Issue 1: Staff Showing Up When Deleted Before
- **Root Cause:** In `functions/index.js` (`deleteStaffUser`), `admin.auth().deleteUser(uid)` was called before deleting Firestore documents. Test or mock staff accounts (`staff-devender`, `staff-devidas`, `staff-prashanth`) did not exist as real Firebase Auth UIDs, throwing `auth/user-not-found`. This aborted the Cloud Function before `db.collection('staff_accounts').doc(uid).delete()` could execute. On the client, `deleteStaffUser` threw an unhandled error, preventing local state removal.
- **Fix Implemented:** 
  1. Purged the 4 orphaned Firestore documents (`14c6c5b3-57ba-4180-89f4-ae1f698e828f`, `staff-devender`, `staff-devidas`, `staff-prashanth`) from `staff_accounts`. Total staff is now 0.
  2. Wrapped `admin.auth().deleteUser(uid)` in a non-fatal `try/catch` in `functions/index.js` so Firestore documents are ALWAYS deleted.
  3. Added direct Firestore fallback deletion in `AdminStaffManagementPage.tsx` using `deleteDoc` so UI state and Firestore records are always cleared even if Auth operations report missing accounts.

### Issue 2: Vacancy Manager Page Blank
- **Root Cause:** In `AdminVacancyManager.tsx`, the component grouped vacancies by operational sites (`visibleSites.map(...)`). When all sites were deleted earlier, `visibleSites.length === 0`. The component rendered only the header title with a blank grid underneath, lacking an empty state.
- **Fix Implemented:**
  1. Added a polished empty state card in `AdminVacancyManager.tsx` with building icon, explanatory description ("Job openings and recruitment posts are organized by client sites..."), and a prominent "+ Create First Site in Site Management" action button.
  2. Passed `navigateTo={navigateTo}` from `AdminPortalPage.tsx` into `AdminVacancyManager` for 1-click navigation to Site Management.

### Issue 3: Switching to Dashboard Only Shifting on 2nd Click
- **Root Cause:** In `App.tsx`, the route-synchronization `useEffect` had `currentView` in its dependency array. When a user on `/dashboard?tab=staff` clicked "Dashboard", `navigateTo` set `currentView = AppView.ADMIN_DASHBOARD`. This triggered `App.tsx` to re-render while `location.search` was still `?tab=staff`. The effect saw `tabParam = 'staff'`, detected `resolved !== currentView`, and immediately reverted `currentView` back to `ADMIN_PORTAL_STAFF_MANAGEMENT` before the route push completed. Only upon a second click (when `location.search` was finally empty) did it switch.
- **Fix Implemented:**
  1. Removed `currentView` from the route synchronization dependency array in `App.tsx`, preventing internal state changes from triggering route rollback.
  2. Enhanced route resolution in `App.tsx` so that navigation to `/dashboard`, `/admin`, or `/admin/dashboard` without a tab query parameter immediately and reliably resolves to `AppView.ADMIN_DASHBOARD`.
  3. Fixed `Breadcrumb` root path navigation in `AdminPortalPage.tsx` to explicitly navigate to `AppView.ADMIN_DASHBOARD`.

---

## 🛑 8. Turn 12: Permanent Elimination of Staff Auto-Seeding (2026-10-10)

- **The Problem:** Whenever all staff accounts were deleted, `seedInitialData` in `adminService.ts` detected an empty `staff_accounts` collection upon Super Admin login and automatically re-seeded the 4 default staff members (`Sai`, `Devidas`, `Devender`, `Prashanth`) back into Firestore from `settings/staff_users` and `defaultStaff`.
- **Permanent Solution Applied:**
  1. **Removed Auto-Seeding:** Permanently deleted the staff re-seeding block in `src/services/adminService.ts`.
  2. **Emptied Code Fallback Defaults:** Set `defaultStaff = []` in `src/constants/defaults.ts` and initialized `staffUsers` state to `[]` in `src/contexts/DataContext.tsx`.
  3. **Purged Legacy Storage:** Deleted `settings/staff_users` from Firestore.
  4. **Purged Database Collection:** Deleted all 4 resurrected records from `staff_accounts` in Firestore.
  5. **Verified:** Confirmed `staff_accounts` is 0 records in Firestore. Built and deployed live to Firebase Hosting (`admin-portal`).



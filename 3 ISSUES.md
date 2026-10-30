# UDF Portal — Deep Audit of `udf6` (`de3033e`) & 3 Fixes Before Deploying

**Target Project:** UDF Portal (`udfonline.in`, `admin.udfonline.in`, `employee.udfonline.in`)  
**Audited Commit:** `sai200213/udf6` (`de3033eb3e193eeb6fe96afa10f373e5a5bf640c`)  

## 1. What Is Already Fixed & Verified in `udf6`

| Item | Status |
| :--- | :--- |
| **UDF-01:** Cloudflare Orange Cloud Proxy on `admin` and `employee` subdomains | **Resolved** |
| **UDF-02:** Removal of `VITE_GOOGLE_DRIVE_SCRIPT_URL` and client-side Apps Script calls from `driveService.ts`, `employeeService.ts`, and `env.d.ts` | **Resolved** |
| **UDF-03 & UDF-05:** Backend enforcement of `setAdminClaims`, `firestore.rules`, and `localStorage` routing | **Verified Safe** |
| **Staff Permanent Auth Purge (`AdminStaffManagementPage.tsx:537–553`):** Skips `moveToRecycleBin` when `permanentAuthPurge` is checked | **Resolved** |
| **Business Contact Inquiries CRM (`AdminGrievancesPage.tsx`, `engagementService.ts`, `firestore.rules`):** Real-time lead management | **Resolved** |

## 2. Three New Issues Found During Deep Code Inspection of `udf6`

### Issue 1 (High Priority — Fix Before Deploying `firebase.json`): `Content-Security-Policy` Will Block Signed KYC Images & Google Icons

* **Where:** `firebase.json` (`lines 191, 300, 400`) vs. `functions/index.js` (`line 1883`) and `components/EmployeeFormPage.tsx` (`lines 2590, 2825`).
* **Why It Happens:**
  1. When `getSecureDocumentURL` and `getBatchSignedViewUrls` in `functions/index.js` generate V4 signed URLs via `@google-cloud/storage` (`file.getSignedUrl()`), the returned URL hostname is `https://storage.googleapis.com/hr-portal-unique-delta.firebasestorage.app/...`. Because `img-src` in `firebase.json` only lists `https://*.firebasestorage.app` and `https://firebasestorage.googleapis.com` (and NOT `https://storage.googleapis.com` or `https://*.googleapis.com`), **the browser will block every signed employee photo and KYC image preview across the Admin and Employee Portals**.
  2. `components/EmployeeFormPage.tsx` (`lines 2590, 2825`) renders `<img src="https://www.google.com/favicon.ico" />` on the Google Sign-In button, which will be blocked unless `https://www.google.com` and `https://www.gstatic.com` are in `img-src`.
  3. `components/AdminWebsiteManager.tsx` (`line 1768`) and `src/utils/sanitizeHtml.ts` (`line 20`) support YouTube and Vimeo iframe embeds in blog posts, which require `https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com` in `frame-src`.
  4. `functions/package.json` uses `firebase-functions: ^7.2.5` (2nd Gen Cloud Functions on Cloud Run), so `https://*.run.app` and `https://www.google.com` should be included in `connect-src`.
* **Exact Replacement for `Content-Security-Policy` in `firebase.json` (All 3 Targets):**
  ```json
  {
    "key": "Content-Security-Policy",
    "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://apis.google.com https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/ https://recaptchaenterprise.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.cloudfunctions.net https://*.run.app https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.google.com; img-src 'self' data: blob: https://storage.googleapis.com https://*.googleapis.com https://*.firebasestorage.app https://*.googleusercontent.com https://www.google.com https://www.gstatic.com https://udfonline.in https://*.udfonline.in https://www.transparenttextures.com; frame-src 'self' blob: https://*.firebaseapp.com https://accounts.google.com https://www.google.com/recaptcha/ https://recaptchaenterprise.googleapis.com https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com; worker-src 'self' blob:;"
  }
  ```

### Issue 2 (High Priority — Server-Side Drive/Form Sync): `GOOGLE_APPS_SCRIPT_v7.2.js` Rejects `token: 'server_admin'` from `functions/index.js`

* **Where:** `functions/index.js` (`lines 5661, 6023`) vs. `GOOGLE_APPS_SCRIPT_v7.2.js` (`lines 39–47, 179`).
* **Why It Happens:**
  * Now that `udf6` removed the browser-side Google Apps Script fallback from `src/services/employeeService.ts`, 100% of Google Drive and Google Sheet/Form backups run inside `functions/index.js`.
  * When `functions/index.js` falls back to `APPS_SCRIPT_FALLBACK_URL`, it sends `token: 'server_admin'`.
  * However, `GOOGLE_APPS_SCRIPT_v7.2.js` (`lines 39–47`) passes `data.token` to `verifyViaApi()`, which calls Google's `identitytoolkit` API to verify a user login JWT. Because `'server_admin'` is not a Firebase JWT, `GOOGLE_APPS_SCRIPT_v7.2.js` rejects the Cloud Function's request with `"Unauthorized: Invalid or missing Firebase Authentication Token"`.
  * Additionally, line 179 of `GOOGLE_APPS_SCRIPT_v7.2.js` still calls `file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);`.
* **Fix:**
  1. **Native API (Recommended):** Share your Google Drive root folder (`1XuFLT5v5s1ZSdugKr1XzT0AdYkL-QgBX`) and your Google Sheet with your Firebase Service Account (`hr-portal-unique-delta@appspot.gserviceaccount.com`) as **Editor**, and set `googleSpreadsheetId` in Firestore at `settings/portal_config`.
  2. **Apps Script Fallback Fix:** In `GOOGLE_APPS_SCRIPT_v7.2.js`, update `verifyFirebaseToken(idToken)` to accept the server call and remove `setSharing(ANYONE_WITH_LINK)` at line 179:
     ```javascript
     function verifyFirebaseToken(idToken) {
       if (!idToken) return { isValid: false };
       if (idToken === "server_admin") {
         return { isValid: true, uid: "cloud_function_server", isSuperAdmin: true };
       }
       return verifyViaApi(idToken);
     }
     ```

### Issue 3 (Low Priority — UI Permission Consistency): Business Inquiries Tab Default State & Sidebar Visibility

* **Where:** `components/AdminPortalPage.tsx` (`line 385`) and `components/AdminGrievancesPage.tsx` (`lines 76–81`).
* **Why It Happens:**
  * In `AdminGrievancesPage.tsx:76`, `canViewInquiries` is enabled for `isSuperAdmin || hasPermission(Permission.MANAGE_SYSTEM) || hasPermission(Permission.GRIEVANCES_VIEW)`.
  * However, in `AdminPortalPage.tsx:385`, the sidebar link for **Grievances & Inquiries** does not check `hasPermission(Permission.MANAGE_SYSTEM)`, and in `AdminGrievancesPage.tsx:78–81`, the initial `activeTab` state only checks `if (!canViewGrievances && canViewRewards) return 'rewards';` without falling back to `'inquiries'` if a user only has `MANAGE_SYSTEM`.
* **Fix:**
  * In `components/AdminPortalPage.tsx:385`, add `|| hasPermission(Permission.MANAGE_SYSTEM)` to `visible`.
  * In `components/AdminGrievancesPage.tsx:78–81`, update the initial tab state:
    ```tsx
    const [activeTab, setActiveTab] = useState<'grievances' | 'rewards' | 'inquiries'>(() => {
        if (canViewGrievances) return 'grievances';
        if (canViewRewards) return 'rewards';
        if (canViewInquiries) return 'inquiries';
        return 'grievances';
    });
    ```
# UDF Portal — Complete 7-Point Final Audit & Developer Action Sheet (`udf6` / `de3033e`)

**Target Project:** UDF Portal (`udfonline.in`, `admin.udfonline.in`, `employee.udfonline.in`)  
**Audited Repository:** `sai200213/udf6` (Commit `de3033eb3e193eeb6fe96afa10f373e5a5bf640c`)  
**Scope:** Combines the **3 Deep Code Audit Findings** + the **4 Public Interface Audit Findings** into a single 7-item checklist for your developer and Cloudflare/Firebase dashboards.

## Master Summary Table (All 7 Items)

| # | Priority | Category | Target File / Dashboard | Summary of Issue & Fix |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Critical** | Code (`firebase.json`) | `firebase.json` (`lines 191, 300, 400`) | Add `https://storage.googleapis.com` (for V4 signed KYC images), `https://www.google.com` (Google login icon), `https://*.run.app` (2nd-Gen Cloud Functions), and YouTube/Vimeo embed domains to `Content-Security-Policy`. |
| **2** | **Critical** | Code (`firebase.json`) + Cloudflare | `firebase.json` (`lines 32–75, 226–269, 335–369`) & Cloudflare Caching | Move `sw.js`, `sw-v2.js`, `registerSW.js`, and `workbox-*.js` (`no-cache`) **below** `**/*.@(js|css|webp|png|jpg|svg)` (`max-age=31536000`) so the 1-year `.js` cache rule stops overwriting `sw.js`, then purge Cloudflare cache. |
| **3** | **High** | Backend (`GOOGLE_APPS_SCRIPT_v7.2.js`) | `GOOGLE_APPS_SCRIPT_v7.2.js` (`lines 39–47, 179`) & `functions/index.js` (`lines 5661, 6023`) | Allow `token === "server_admin"` in `verifyFirebaseToken()` (or share Drive/Sheet with `hr-portal-unique-delta@appspot.gserviceaccount.com`) now that browser fallback is removed, and remove `ANYONE_WITH_LINK` at line 179. |
| **4** | **High** | Cloudflare DNS | Cloudflare DNS (`udfonline.in`) | Add root `@` `TXT` SPF record (`v=spf1 include:_spf.google.com ~all` or `v=spf1 -all`) to match your `_dmarc` quarantine policy and prevent email spoofing. |
| **5** | **Medium** | Firebase Console | Firebase Console → App Check (`src/firebase/config.ts:41–62`) | ReCAPTCHA Enterprise App Check is already initialized in `config.ts`; verify that **Cloud Firestore** is set to **Enforce** in Firebase Console → App Check → APIs. |
| **6** | **Low** | Code (UI Permissions) | `components/AdminPortalPage.tsx` (`line 385`) & `components/AdminGrievancesPage.tsx` (`lines 78–81`) | Add `hasPermission(Permission.MANAGE_SYSTEM)` to the sidebar `visible` check and update `activeTab` initial state to fall back to `'inquiries'`. |
| **7** | **Low** | Code (Router Hygiene) | `src/routes/AppRoutes.tsx` (`line 271`) | Remove the duplicate route `<Route path="/correct details" ... />` containing a literal space and keep only `/correct-details`. |

## Detailed Instructions for All 7 Items

### Item 1 (Critical — Code): Update `Content-Security-Policy` in `firebase.json` So Signed KYC Images & 2nd-Gen Cloud Functions Are Not Blocked

* **Files Affected:** `firebase.json` (`lines 191, 300, 400` across `main-site`, `admin-portal`, and `employee-portal`).
* **Root Cause:**
  1. When `getSecureDocumentURL` and `getBatchSignedViewUrls` (`functions/index.js:1883`) generate V4 signed URLs via `@google-cloud/storage`, the returned URL hostname is `https://storage.googleapis.com/hr-portal-unique-delta.firebasestorage.app/...`. Because `img-src` in `udf6` only lists `https://*.firebasestorage.app` and `https://firebasestorage.googleapis.com` (and not `https://storage.googleapis.com`), the browser will block all signed employee photos and KYC image previews.
  2. `components/EmployeeFormPage.tsx` (`lines 2590, 2825`) renders `<img src="https://www.google.com/favicon.ico" />` on the Google Sign-In button, requiring `https://www.google.com` and `https://www.gstatic.com` in `img-src`.
  3. `components/AdminWebsiteManager.tsx` (`line 1768`) and `src/utils/sanitizeHtml.ts` (`line 20`) allow YouTube/Vimeo video embeds in blog posts, requiring `https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com` in `frame-src`.
  4. `functions/package.json` uses `firebase-functions: ^7.2.5` (2nd-Gen Cloud Functions on Cloud Run), requiring `https://*.run.app` in `connect-src`.
* **Exact Code Fix (Replace the `Content-Security-Policy` object in all 3 targets in `firebase.json`):**
  ```json
  {
    "key": "Content-Security-Policy",
    "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://apis.google.com https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/ https://recaptchaenterprise.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.cloudfunctions.net https://*.run.app https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.google.com; img-src 'self' data: blob: https://storage.googleapis.com https://*.googleapis.com https://*.firebasestorage.app https://*.googleusercontent.com https://www.google.com https://www.gstatic.com https://udfonline.in https://*.udfonline.in https://www.transparenttextures.com; frame-src 'self' blob: https://*.firebaseapp.com https://accounts.google.com https://www.google.com/recaptcha/ https://recaptchaenterprise.googleapis.com https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com; worker-src 'self' blob:;"
  }
  ```

### Item 2 (Critical — Code + Cloudflare): Fix Service Worker (`sw.js`) 1-Year Cache Overwrite in `firebase.json` & Purge Cloudflare

* **Files Affected:** `firebase.json` (`lines 31–75` in `main-site`, `lines 225–269` in `admin-portal`, `lines 334–369` in `employee-portal`).
* **Root Cause:**
  * In Firebase Hosting, `headers` blocks are evaluated from **top to bottom**, and **later matching rules overwrite earlier rules**.
  * Right now in `firebase.json`, `"source": "sw.js"`, `"source": "registerSW.js"`, and `"source": "workbox-*.js"` (`no-cache`) appear **above** `"source": "**/*.@(js|css|webp|png|jpg|svg)"` (`max-age=31536000`).
  * Because `**/*.@(js|...)` also matches root-level `.js` files, Firebase Hosting overwrites `sw.js`, `sw-v2.js`, `registerSW.js`, and `workbox-*.js` with `Cache-Control: max-age=31536000` (1 year), causing Cloudflare and browsers to cache stale Service Workers.
* **Exact Code Fix in `firebase.json` (In all 3 hosting targets):**
  Move the `sw.js`, `sw-v2.js`, `registerSW.js`, `workbox-*.js`, and `index.html` blocks **below** `"source": "**/*.@(js|css|webp|png|jpg|svg)"`:
  ```json
  {
    "source": "**/*.@(js|css|webp|png|jpg|svg)",
    "headers": [
      {
        "key": "Cache-Control",
        "value": "max-age=31536000"
      }
    ]
  },
  {
    "source": "/(sw.js|sw-v2.js|registerSW.js|workbox-*.js|index.html)",
    "headers": [
      {
        "key": "Cache-Control",
        "value": "no-cache, no-store, must-revalidate"
      }
    ]
  }
  ```
* **Cloudflare Action (After deploying `firebase.json`):**
  Log in to **Cloudflare Dashboard → `udfonline.in` → Caching → Configuration → Purge Cache**, and click **Purge Everything** (or purge `https://udfonline.in/sw.js`, `https://admin.udfonline.in/sw.js`, and `https://employee.udfonline.in/sw.js`).

### Item 3 (High — Backend Sync): Server-Side Drive/Form Sync Authentication (`functions/index.js` vs `GOOGLE_APPS_SCRIPT_v7.2.js`)

* **Files Affected:** `functions/index.js` (`lines 5661, 6023`) and `GOOGLE_APPS_SCRIPT_v7.2.js` (`lines 39–47, 179`).
* **Root Cause:**
  * Now that `udf6` removed the browser-side Apps Script fallback from `src/services/employeeService.ts`, 100% of Google Drive and Sheet backups execute server-side in `functions/index.js`.
  * When `functions/index.js` calls `APPS_SCRIPT_FALLBACK_URL`, it sends `token: 'server_admin'`.
  * However, `GOOGLE_APPS_SCRIPT_v7.2.js` (`lines 39–47`) passes `data.token` to `verifyViaApi()`, which calls Google's `identitytoolkit` API and rejects `'server_admin'` because it is not a Firebase user JWT (`"Unauthorized: Invalid or missing Firebase Authentication Token"`).
  * Additionally, line 179 of `GOOGLE_APPS_SCRIPT_v7.2.js` executes `file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);`.
* **Exact Fix:**
  1. **Native API Setup (Recommended):** Share your Google Drive root folder (`1XuFLT5v5s1ZSdugKr1XzT0AdYkL-QgBX`) and Google Sheet with your Firebase Service Account (`hr-portal-unique-delta@appspot.gserviceaccount.com`) as **Editor**, and set `googleSpreadsheetId` in Firestore at `settings/portal_config`.
  2. **Apps Script Fallback Fix:** In your live Google Apps Script project (`GOOGLE_APPS_SCRIPT_v7.2.js`), update `verifyFirebaseToken(idToken)` to accept `server_admin` and remove `file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)` on line 179:
     ```javascript
     function verifyFirebaseToken(idToken) {
       if (!idToken) return { isValid: false };
       if (idToken === "server_admin") {
         return { isValid: true, uid: "cloud_function_server", isSuperAdmin: true };
       }
       return verifyViaApi(idToken);
     }
     ```

### Item 4 (High — Cloudflare DNS): Add Missing SPF (`v=spf1`) TXT Record on `udfonline.in`

* **Where:** Cloudflare Dashboard → `udfonline.in` → **DNS** → **Records**.
* **Root Cause:** `_dmarc.udfonline.in` enforces `v=DMARC1; p=quarantine; adkim=r; aspf=r;`, but `udfonline.in` has no root SPF (`v=spf1`) `TXT` record. Without an SPF record, bad actors can spoof `@udfonline.in` emails or legitimate emails may be quarantined.
* **Exact Fix in Cloudflare DNS:**
  Click **Add record**:
  * **Type:** `TXT`
  * **Name:** `@`
  * **Content (choose the one that matches your email setup):**
    * If you send emails using Google Workspace: `v=spf1 include:_spf.google.com ~all`
    * If you send emails using GoDaddy / Secureserver: `v=spf1 include:secureserver.net ~all`
    * If you never send emails from `@udfonline.in`: `v=spf1 -all`

### Item 5 (Medium — Firebase Console): Confirm Firebase App Check Enforcement for Anonymous Auth

* **Where:** `src/firebase/config.ts` (`lines 41–62`) & **Firebase Console → App Check → APIs**.
* **Current Code Status:** Your frontend code in `src/firebase/config.ts` (`lines 41–62`) **already initializes Firebase App Check** using `ReCaptchaEnterpriseProvider('6LebggEuAAAAACif4YKDHm_yKgN03R8eTlqSVYXx')` with `isTokenAutoRefreshEnabled: true`. Private Cloud Storage uploads also go through the `getUploadUrl` Cloud Function rather than open client storage rules.
* **Exact Action in Firebase Console:**
  Open **Firebase Console → App Check → APIs** and verify that **Cloud Firestore** is switched to **Enforce** so automated bot scripts calling `signInAnonymously()` outside your web app are blocked from writing to `onboarding_submissions` or `draft_submissions`.

### Item 6 (Low — Code): Business Contact Inquiries Tab Permission Consistency

* **Files Affected:** `components/AdminPortalPage.tsx` (`line 385`) and `components/AdminGrievancesPage.tsx` (`lines 76–81`).
* **Root Cause:** `AdminGrievancesPage.tsx:76` allows staff with `Permission.MANAGE_SYSTEM` to view Business Contact Inquiries (`canViewInquiries`), but `AdminPortalPage.tsx:385` omits `hasPermission(Permission.MANAGE_SYSTEM)` from the sidebar `visible` condition, and `AdminGrievancesPage.tsx:78–81` does not default `activeTab` to `'inquiries'` if a user only has `MANAGE_SYSTEM`.
* **Exact Code Fix:**
  1. In `components/AdminPortalPage.tsx` (`line 385`):
     ```tsx
     { id: AppView.ADMIN_PORTAL_GRIEVANCES, view: AppView.ADMIN_PORTAL_GRIEVANCES, label: 'Grievances & Inquiries', icon: <MessageSquare size={18} />, visible: isSuperAdmin || hasPermission(Permission.GRIEVANCES_VIEW) || hasPermission(Permission.REWARDS_VIEW) || hasPermission(Permission.REWARDS_MANAGE) || hasPermission(Permission.MANAGE_SYSTEM) },
     ```
  2. In `components/AdminGrievancesPage.tsx` (`lines 78–81`):
     ```tsx
     const [activeTab, setActiveTab] = useState<'grievances' | 'rewards' | 'inquiries'>(() => {
         if (canViewGrievances) return 'grievances';
         if (canViewRewards) return 'rewards';
         if (canViewInquiries) return 'inquiries';
         return 'grievances';
     });
     ```

### Item 7 (Low — Code): Remove Duplicate Route Path With Space (`/correct details`)

* **File Affected:** `src/routes/AppRoutes.tsx` (`lines 270–271`).
* **Root Cause:** Line 271 defines `<Route path="/correct details" ... />` with an unencoded space right below `<Route path="/correct-details" ... />`.
* **Exact Code Fix in `src/routes/AppRoutes.tsx` (`lines 270–271`):**
  Delete line 271 and keep only line 270:
  ```tsx
  <Route path="/correct-details" element={<RedirectToExternal url="https://employee.udfonline.in/correct-details" label="Data Correction" />} />
  ```
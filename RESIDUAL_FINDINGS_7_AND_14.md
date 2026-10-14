# Residual Findings & Partially Mitigated Items (The 7 & 14 Checklist)

**Target Codebase**: `Z:\UDF_SUBDOMAINS`  
**Purpose**: Permanent registry of the **7 Core Partially Mitigated Items** and the expanded list of **14 Residual Edge Cases / Architectural Gotchas** identified during the exhaustive codebase audit.

> [!NOTE]
> Out of the 59 total cataloged findings across the project, **52 issues are cleanly resolved and verified**. The items documented below represent the remaining 7 architectural/partial mitigations and the 7 configuration/boundary edge cases that need final hardening.

---

## 1. Quick Reference Tables

### Part A: The Core 7 Partially Mitigated / Architectural Items

| # | Finding ID & Title | Primary File Reference | Current Mitigation Status | Required Permanent Action |
| :- | :--- | :--- | :--- | :--- |
| **1** | **Finding 1: Anonymous Auth Permits Collection Access** | [firestore.rules:L8-10, L121-175](file:///z:/UDF_SUBDOMAINS/firestore.rules#L8) | Sensitive collections (`/employees`, `/staff_accounts`) enforce `isAdmin()`. General collections still check `isAuthenticated()`. | Reject anonymous tokens (`request.auth.token.firebase.sign_in_provider != 'anonymous'`) across all non-public collection rules. |
| **2** | **Finding 3: Storage Privilege Escalation via Document Existence** | [storage.rules:L17-23](file:///z:/UDF_SUBDOMAINS/storage.rules#L17) | `isAdmin()` checks document existence in `/users/$(request.auth.uid)`. Deactivated users still present in the collection pass the check. | Enforce an active user claim or check `request.auth.token.role == 'admin'` rather than mere document existence. |
| **3** | **Finding 5: Unverified JWT Payload in Google Apps Script** | [GOOGLE_APPS_SCRIPT_v7.2.js:L46-66](file:///z:/UDF_SUBDOMAINS/GOOGLE_APPS_SCRIPT_v7.2.js#L46) | Base64 token payload is decoded without cryptographic verification of Google's RSA signature. | Validate incoming JWT signatures against Google's public JWKS endpoint (`https://www.googleapis.com/oauth2/v3/certs`). |
| **4** | **Finding 16 & 32: Granular Role Deadlock on `/settings`** | [firestore.rules:L117](file:///z:/UDF_SUBDOMAINS/firestore.rules#L117) vs [src/services/adminService.ts:L140](file:///z:/UDF_SUBDOMAINS/src/services/adminService.ts#L140) | UI has granular permissions (`SITES_MANAGE`, `MANAGE_WORKFLOWS`), but `/settings/{docId}` rule demands `MANAGE_SYSTEM` or `SuperAdmin`. | Allow `(docId == 'sites' && hasPermission('SITES_MANAGE')) || (docId == 'workflows' && hasPermission('MANAGE_WORKFLOWS'))`. |
| **5** | **Finding 22: Bypassable Regex HTML Sanitizer in Blogs** | [src/utils/sanitizeHtml.ts:L1-50](file:///z:/UDF_SUBDOMAINS/src/utils/sanitizeHtml.ts#L1) | Loop-based regex replacement prevents basic nesting evasion, but is theoretically bypassable via malformed attributes or novel SVG tags. | Replace custom regex engine with an industry-standard DOM sanitizer (e.g., `DOMPurify` or browser `DOMParser` whitelist). |
| **6** | **Finding 47: Unverified Google Account Linking** | [functions/index.js:L1200-1255](file:///z:/UDF_SUBDOMAINS/functions/index.js#L1200) | `selfLinkGoogleAccount` requires user authentication, but trusts the client-provided `googleEmail` string without server-side OAuth token verification. | Validate the Google OAuth `idToken` using `admin.auth().verifyIdToken(idToken)` before linking the Google email to the profile. |
| **7** | **Finding 57: Admin Setup Scripts Writing to Legacy Collection** | [src/utils/createAdmin.js:L36-43](file:///z:/UDF_SUBDOMAINS/src/utils/createAdmin.js#L36), [src/utils/migrationHelper.ts](file:///z:/UDF_SUBDOMAINS/src/utils/migrationHelper.ts) | Scripts write initial accounts to `/staff/`, whereas the modern application uses `/staff_accounts/` and `/users/`. | Update setup CLI scripts to write directly to `/staff_accounts/` and `/users/`. |

---

### Part B: The Expanded 7 Residual Edge Cases (Items 8 through 14)

| # | Finding Area & Title | Primary File Reference | Current Risk & Description | Required Permanent Action |
| :- | :--- | :--- | :--- | :--- |
| **8** | **Public Configuration Leak** | [firestore.rules:L115-118](file:///z:/UDF_SUBDOMAINS/firestore.rules#L115) | `match /settings/{docId} { allow read: if true; }` allows unauthenticated visitors to read site databases and internal approval tiers. | Restrict public read strictly to public setting docs (`website_meta`, `public_stats`), locking down `sites`, `workflows`, and `portal_config`. |
| **9** | **Ghost Rules vs Real `/settings/` Documents** | [firestore.rules:L308-318](file:///z:/UDF_SUBDOMAINS/firestore.rules#L308) | Rules protect non-existent top-level collections `/sites/{siteId}` and `/roles/{roleId}`, while active data resides in `/settings/sites` and `/settings/roles`. | Remove dead top-level rules or migrate `/settings/sites` and `/settings/roles` into real top-level subcollections. |
| **10** | **Staff Google Login Document ID Mismatch** | [firestore.rules:L14-22](file:///z:/UDF_SUBDOMAINS/firestore.rules#L14) vs [src/services/authService.ts](file:///z:/UDF_SUBDOMAINS/src/services/authService.ts) | If a staff member signs in with Google and their Google Auth UID differs from their document ID in `staff_accounts`, rule checks fail with `PERMISSION_DENIED`. | Harmonize document IDs to Google UIDs upon first sign-in or use custom claims to identify staff accounts. |
| **11** | **Notification 50-Item Order Boundary** | [src/services/notificationService.ts:L69-74](file:///z:/UDF_SUBDOMAINS/src/services/notificationService.ts#L69) | Notifications query limit 50 and sort descending in client JavaScript memory. If a user exceeds 50 notifications, latest notifications can be excluded before retrieval. | Add composite index `(targetUserId ASC, createdAt DESC)` to Firestore and query `orderBy('createdAt', 'desc')` directly. |
| **12** | **Committed Scratch Scripts with Production Identifiers** | [scratch/reset_both.cjs](file:///z:/UDF_SUBDOMAINS/scratch/reset_both.cjs), [scratch/restore_khaled_pan_uan.cjs](file:///z:/UDF_SUBDOMAINS/scratch/restore_khaled_pan_uan.cjs) | Scripts contain hardcoded candidate IDs (`UDF-202609-1R6W`) and execute live mutations against production collections. | Move hardcoded IDs to environment variables or remove scratch scripts from version control. |
| **13** | **Unseeded Roles Collection Causing Non-SuperAdmin Lockout** *(Finding 64)* | [src/services/adminService.ts:L234-238](file:///z:/UDF_SUBDOMAINS/src/services/adminService.ts#L234) vs [firestore.rules:L57](file:///z:/UDF_SUBDOMAINS/firestore.rules#L57) | `seedInitialData` skips seeding if `/settings/roles` exists, meaning `/roles/{roleId}` is empty until an admin manually hits "Save" in the UI. | Run an auto-seed migration ensuring `/roles/{roleId}` documents exist for all default system roles. |
| **14** | **Silent Document Upload Failures on Operational Requests** *(Finding 62)* | [src/services/requestService.ts:L27, L89](file:///z:/UDF_SUBDOMAINS/src/services/requestService.ts#L27) vs [storage.rules:L25-39](file:///z:/UDF_SUBDOMAINS/storage.rules#L25) | Upload paths use `employeeId` while `storage.rules` validates based on auth UID (`portalId`), causing uploads to be rejected and silently saved as `null`. | Align storage upload path prefixes with the user's authenticated UID or update `storage.rules` to check employee ID ownership. |

---

## 2. Detailed Technical Deep-Dive

### 1. Anonymous Auth Permits Collection Access (Finding 1)
* **Location**: [firestore.rules:L8-10, L121-175](file:///z:/UDF_SUBDOMAINS/firestore.rules#L8)
* **The Root Cause**: Firebase anonymous authentication is enabled on the public landing page to track guest sessions. The security rules helper `isAuthenticated()` simply tests `request.auth != null`. Because anonymous sessions produce non-null `request.auth`, collections checking `isAuthenticated()` permit anonymous read/write operations.
* **Current Mitigation**: Strict `isAdmin()` checks protect core collections (`/employees`, `/staff_accounts`, `/users`).
* **Remaining Vulnerability**: Auxiliary collections (e.g. `/leaves`, `/account_updates`, `/draft_submissions`) still expose read access to anonymous tokens.
* **Recommended Code Change**:
  ```javascript
  function isRegisteredUser() {
    return request.auth != null && request.auth.token.firebase.sign_in_provider != 'anonymous';
  }
  ```

---

### 2. Storage Privilege Escalation via Document Existence (Finding 3)
* **Location**: [storage.rules:L17-23](file:///z:/UDF_SUBDOMAINS/storage.rules#L17)
* **The Root Cause**: `isAdmin()` in Cloud Storage rules validates admin rights by checking `firestore.exists(/databases/(default)/documents/users/$(request.auth.uid))`.
* **Current Mitigation**: Standard path rules restrict access to document owners or admins.
* **Remaining Vulnerability**: If an employee account is disabled, relieved, or converted to a non-admin role, leaving their UID document inside `/users` grants them administrative Cloud Storage access.
* **Recommended Code Change**:
  Inspect the `roleId` or `isActive` status:
  ```javascript
  function isAdmin() {
    return request.auth != null &&
      firestore.get(/databases/(default)/documents/users/$(request.auth.uid)).data.isActive == true &&
      firestore.get(/databases/(default)/documents/users/$(request.auth.uid)).data.roleId in ['role-super-admin', 'role-admin'];
  }
  ```

---

### 3. Unverified JWT Payload in Google Apps Script (Finding 5)
* **Location**: [GOOGLE_APPS_SCRIPT_v7.2.js:L46-66](file:///z:/UDF_SUBDOMAINS/GOOGLE_APPS_SCRIPT_v7.2.js#L46)
* **The Root Cause**: The standalone Google Apps Script integration accepts an Authorization header, strips `Bearer `, and decodes the JWT payload using Base64: `JSON.parse(Utilities.newBlob(Utilities.base64Decode(parts[1])).getDataAsString())`.
* **Current Mitigation**: The script runs as an isolated webhook and requires pre-configured shared secrets.
* **Remaining Vulnerability**: An attacker who obtains the webhook URL can forge arbitrary claims without possessing a private key.
* **Recommended Code Change**:
  Fetch and cache Google's public certificates from `https://www.googleapis.com/oauth2/v3/certs` and verify the cryptographic signature before executing file and sheet operations.

---

### 4. Granular Role Deadlock on `/settings` (Findings 16 & 32)
* **Location**: [firestore.rules:L117](file:///z:/UDF_SUBDOMAINS/firestore.rules#L117) vs [src/services/adminService.ts:L140](file:///z:/UDF_SUBDOMAINS/src/services/adminService.ts#L140)
* **The Root Cause**: The UI permission system supports fine-grained roles like `SITES_MANAGE` and `MANAGE_WORKFLOWS`. However, `firestore.rules` enforces:
  ```javascript
  match /settings/{docId} {
    allow write: if isSuperAdmin() || hasPermission('MANAGE_SYSTEM');
  }
  ```
* **Current Mitigation**: SuperAdmins can manage all settings without issues.
* **Remaining Vulnerability**: Delegated staff members (e.g. Operations Managers who only need `SITES_MANAGE`) encounter `PERMISSION_DENIED` when saving site updates.
* **Recommended Code Change**:
  ```javascript
  match /settings/{docId} {
    allow read: if isAuthenticated();
    allow write: if isSuperAdmin() || hasPermission('MANAGE_SYSTEM') ||
      (docId == 'sites' && hasPermission('SITES_MANAGE')) ||
      (docId == 'workflows' && hasPermission('MANAGE_WORKFLOWS'));
  }
  ```

---

### 5. Bypassable Regex HTML Sanitizer in Blogs (Finding 22)
* **Location**: [src/utils/sanitizeHtml.ts:L1-50](file:///z:/UDF_SUBDOMAINS/src/utils/sanitizeHtml.ts#L1)
* **The Root Cause**: The custom sanitizer relies on a loop of regular expressions to strip disallowed tags and event handlers.
* **Current Mitigation**: The while-loop regex removes nested evasion vectors (e.g., `<scr<script>ipt>`).
* **Remaining Vulnerability**: Regex-based HTML sanitizers fail against malformed HTML entity encodings, unknown SVG attributes, and browser parsing mutations (mXSS).
* **Recommended Code Change**:
  Integrate `DOMPurify`:
  ```typescript
  import DOMPurify from 'dompurify';
  export const sanitizeHtml = (dirty: string): string => {
    return DOMPurify.sanitize(dirty, { USE_PROFILES: { html: true } });
  };
  ```

---

### 6. Unverified Google Account Linking (Finding 47)
* **Location**: [functions/index.js:L1200-1255](file:///z:/UDF_SUBDOMAINS/functions/index.js#L1200)
* **The Root Cause**: The Cloud Function `selfLinkGoogleAccount` links a Google account to an employee record using raw strings passed in `request.data.googleEmail` and `request.data.googleUid`.
* **Current Mitigation**: The caller must possess a valid authenticated session.
* **Remaining Vulnerability**: A compromised session can link an arbitrary Google account without proving ownership of that Google account.
* **Recommended Code Change**:
  Accept an `idToken` from the frontend and verify it on the backend:
  ```javascript
  const decoded = await admin.auth().verifyIdToken(data.googleIdToken);
  const verifiedEmail = decoded.email;
  const verifiedUid = decoded.uid;
  ```

---

### 7. Admin Setup Scripts Writing to Legacy Collection (Finding 57)
* **Location**: [src/utils/createAdmin.js:L36-43](file:///z:/UDF_SUBDOMAINS/src/utils/createAdmin.js#L36), [src/utils/migrationHelper.ts](file:///z:/UDF_SUBDOMAINS/src/utils/migrationHelper.ts)
* **The Root Cause**: Initial account seeding CLI scripts write documents into the legacy `/staff/` collection.
* **Current Mitigation**: `firestore.rules` includes `/staff/` in `isAdmin()` for backward compatibility.
* **Remaining Vulnerability**: Accounts seeded via CLI do not appear in the modern `/staff_accounts/` UI table, causing administrative confusion.
* **Recommended Code Change**:
  Update CLI scripts to write to `/staff_accounts/` and set the appropriate `roleId`.

---

### 8. Public Configuration Leak (Finding 8)
* **Location**: [firestore.rules:L115-118](file:///z:/UDF_SUBDOMAINS/firestore.rules#L115)
* **The Root Cause**: `match /settings/{docId} { allow read: if true; }` exposes all settings documents.
* **Risk**: Public visitors can read `/settings/sites` (client facility lists, sub-units) and `/settings/workflows` (internal management hierarchies).
* **Recommended Code Change**:
  ```javascript
  match /settings/{docId} {
    allow read: if docId in ['website_meta', 'public_stats'] || isAuthenticated();
    allow write: if isSuperAdmin() || hasPermission('MANAGE_SYSTEM');
  }
  ```

---

### 9. Ghost Rules vs Real `/settings/` Documents (Finding 9)
* **Location**: [firestore.rules:L308-318](file:///z:/UDF_SUBDOMAINS/firestore.rules#L308)
* **The Root Cause**: `firestore.rules` specifies access controls for `/sites/{siteId}` and `/roles/{roleId}`. However, `siteService.ts` and `adminService.ts` write to `/settings/sites` and `/settings/roles`.
* **Risk**: Rules protect empty collections while the actual documents in `/settings/` are governed by general `/settings/{docId}` rules.
* **Recommended Code Change**:
  Consolidate data architecture: either migrate all data to individual sub-documents under `/sites` and `/roles`, or delete the dead top-level rules.

---

### 10. Staff Google Login Document ID Mismatch (Finding 10)
* **Location**: [firestore.rules:L14-22](file:///z:/UDF_SUBDOMAINS/firestore.rules#L14) vs [src/services/authService.ts](file:///z:/UDF_SUBDOMAINS/src/services/authService.ts)
* **The Root Cause**: `firestore.rules` evaluates `exists(/databases/$(database)/documents/staff_accounts/$(request.auth.uid))`. When staff sign in via Google OAuth, Firebase assigns a Google UID (`request.auth.uid`), which does not match the pre-generated doc ID in `staff_accounts`.
* **Risk**: Valid staff members logging in via Google are locked out with `PERMISSION_DENIED`.
* **Recommended Code Change**:
  In `authService.ts`, when a staff member links Google Auth, set or copy their `staff_accounts` document ID to match their Google UID.

---

### 11. Notification 50-Item Order Boundary (Finding 11)
* **Location**: [src/services/notificationService.ts:L69-74](file:///z:/UDF_SUBDOMAINS/src/services/notificationService.ts#L69)
* **The Root Cause**: To avoid requiring a composite index, notifications are retrieved with `limit(50)` without `orderBy('createdAt', 'desc')`, then sorted client-side.
* **Risk**: Once an account accumulates more than 50 notifications, newly created alerts can be dropped by Firestore's default document ID ordering before reaching the client.
* **Recommended Code Change**:
  Add composite index to [firestore.indexes.json](file:///z:/UDF_SUBDOMAINS/firestore.indexes.json) and query with `.orderBy('createdAt', 'desc').limit(50)`.

---

### 12. Committed Scratch Scripts with Production Identifiers (Finding 12)
* **Location**: [scratch/reset_both.cjs](file:///z:/UDF_SUBDOMAINS/scratch/reset_both.cjs), [scratch/restore_khaled_pan_uan.cjs](file:///z:/UDF_SUBDOMAINS/scratch/restore_khaled_pan_uan.cjs)
* **The Root Cause**: Developer scratch scripts contain hardcoded candidate IDs (`UDF-202609-1R6W`) and execute destructive `delete()` operations on live Firestore.
* **Risk**: Accidental execution can mutate or wipe candidate data.
* **Recommended Code Change**:
  Add `scratch/` to `.gitignore` and parameterize target IDs through CLI flags.

---

### 13. Unseeded Roles Collection Causing Non-SuperAdmin Lockout (Finding 13 / Finding 64)
* **Location**: [src/services/adminService.ts:L234-238](file:///z:/UDF_SUBDOMAINS/src/services/adminService.ts#L234) vs [firestore.rules:L57](file:///z:/UDF_SUBDOMAINS/firestore.rules#L57)
* **The Root Cause**: `seedInitialData` only checks if `/settings/roles` exists. If the legacy document exists, individual `/roles/{roleId}` docs are never created.
* **Risk**: Non-superadmin staff accounts assigned to system roles fail all granular permission checks (`hasPermission()`).
* **Recommended Code Change**:
  Verify `/roles/{roleId}` documents individually and seed missing default roles.

---

### 14. Silent Document Upload Failures on Operational Requests (Finding 14 / Finding 62)
* **Location**: [src/services/requestService.ts:L27, L89](file:///z:/UDF_SUBDOMAINS/src/services/requestService.ts#L27) vs [storage.rules:L25-39](file:///z:/UDF_SUBDOMAINS/storage.rules#L25)
* **The Root Cause**: `requestService.ts` uploads attachments using the `employeeId` path prefix, but `storage.rules` validates that the path prefix matches `request.auth.uid`. For self-onboarded candidates, `request.auth.uid` is their `portalId` (not `employeeId`).
* **Risk**: Document uploads are blocked by Storage rules, caught by `requestService`, and silently saved as `null` in Firestore, leaving requests without attachments.
* **Recommended Code Change**:
  Update `uploadRequestAttachment` to use `auth.currentUser.uid` as the storage path prefix.

---

## 3. Progress Tracking Checklist

- [ ] **Item 1**: Block anonymous auth tokens on internal collections ([firestore.rules](file:///z:/UDF_SUBDOMAINS/firestore.rules)).
- [ ] **Item 2**: Validate active status/role in Cloud Storage rules ([storage.rules](file:///z:/UDF_SUBDOMAINS/storage.rules)).
- [ ] **Item 3**: Verify JWT cryptographic signatures in Apps Script ([GOOGLE_APPS_SCRIPT_v7.2.js](file:///z:/UDF_SUBDOMAINS/GOOGLE_APPS_SCRIPT_v7.2.js)).
- [ ] **Item 4**: Add granular permissions (`SITES_MANAGE`, `MANAGE_WORKFLOWS`) to `/settings/{docId}` rules ([firestore.rules](file:///z:/UDF_SUBDOMAINS/firestore.rules)).
- [ ] **Item 5**: Integrate `DOMPurify` into HTML sanitizer ([sanitizeHtml.ts](file:///z:/UDF_SUBDOMAINS/src/utils/sanitizeHtml.ts)).
- [ ] **Item 6**: Verify Google OAuth `idToken` on backend during account linking ([functions/index.js](file:///z:/UDF_SUBDOMAINS/functions/index.js)).
- [ ] **Item 7**: Update admin seeding scripts to write to `staff_accounts` ([createAdmin.js](file:///z:/UDF_SUBDOMAINS/src/utils/createAdmin.js)).
- [ ] **Item 8**: Restrict public read access to `/settings` ([firestore.rules](file:///z:/UDF_SUBDOMAINS/firestore.rules)).
- [ ] **Item 9**: Remove dead ghost rules for `/sites` and `/roles` ([firestore.rules](file:///z:/UDF_SUBDOMAINS/firestore.rules)).
- [ ] **Item 10**: Synchronize staff document IDs with Google OAuth UIDs ([authService.ts](file:///z:/UDF_SUBDOMAINS/src/services/authService.ts)).
- [ ] **Item 11**: Add composite index and order notifications by `createdAt desc` ([notificationService.ts](file:///z:/UDF_SUBDOMAINS/src/services/notificationService.ts)).
- [ ] **Item 12**: Secure scratch scripts and remove hardcoded production IDs ([scratch/](file:///z:/UDF_SUBDOMAINS/scratch/)).
- [ ] **Item 13**: Ensure `/roles/{roleId}` documents are always seeded ([adminService.ts](file:///z:/UDF_SUBDOMAINS/src/services/adminService.ts)).
- [ ] **Item 14**: Align operational request upload paths with authenticated UIDs ([requestService.ts](file:///z:/UDF_SUBDOMAINS/src/services/requestService.ts)).

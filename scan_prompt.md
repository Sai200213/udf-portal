# Codebase Scanning Prompt

You are a senior full-stack security and performance audit agent. Your task is to perform an exhaustive, line-by-line scanning review of the entire codebase to identify bugs, logical flaws, performance bottlenecks, security vulnerabilities, and inconsistencies.

Please scan the project and provide a report categorizing your findings. Focus specifically on the following areas:

---

### 1. Portal ID & Identifier Consistency (Critical)
* **Context:** The system utilizes `portalId` (global, tied to onboarding submissions) and `employeeId` (linked to portalId). Users can log in manually (Employee ID) or via Google (resolving to their portalId).
* **Audit Items:**
  * Scan all Firestore queries in services (`src/services/requestService.ts`, `DataContext.tsx`, etc.) to ensure that personal dashboard queries (leaves, resignations, account updates, notifications, disciplinary actions) query by the array of possible user identifiers `[portalId, employeeId, uid]` using `"in"` queries, preventing missing dashboard data.
  * Check how `portalId` is resolved for Google logins during session initialization in `src/services/authService.ts`. Ensure there are no fallbacks that result in null or mismatched IDs.

### 2. Bulk CSV Importer & Onboarding Logic
* **Context:** Supports both standard Approved imports and "Pending Profile" imports (which force employees to complete/edit details on first login).
* **Audit Items:**
  * Verify validation checks in `src/utils/bulkImportUtils.ts` (Phone & Aadhaar checks). Ensure queries check dynamic field paths in both the `employees` collection (e.g., `profileData.[fieldId]`) and the `onboarding_submissions` collection (e.g., `formData.[fieldId]`).
  * Check for hardcoded UUIDs in fields (like Aadhaar card ID). They must be resolved dynamically by matching label keywords (`aadhar`/`aadhaar`) before falling back to static UUIDs.

### 3. File Uploads & Client-Side Image Compression
* **Context:** Storage capacity is limited. Document image uploads must be compressed to save space while retaining perfect legibility.
* **Audit Items:**
  * Audit `src/services/storageService.ts` to ensure that all basic file uploads (`uploadFile`) and progress uploads (`uploadDocumentWithProgress`) pass uploaded images (`image/*`) through client-side compression (resizing to max `1800px` and compressing as JPEG quality `0.82`) before sending to Google Cloud Storage.
  * Ensure non-image files (PDFs) bypass compression and upload cleanly.

### 4. Firestore Security Rules Compliance
* **Context:** Firestore security rules are defined in `firestore.rules`.
* **Audit Items:**
  * Audit `firestore.rules` against client-side Firestore writes. Ensure that document creation/updates check `resource.data.uid == request.auth.uid` for Google Logins to prevent cross-account editing, and allow updating fields like `profilePhotoURL` on the client.

### 5. Codebase Subdomain Split Readiness
* **Context:** The project is preparing to split into three subdomains: `udfonline.in` (public website), `employee.udfonline.in` (employee portal), and `admin.udfonline.in` (admin dashboard).
* **Audit Items:**
  * Scan imports and routing layers for high coupling. Identify components or assets that are shared between pages that will break if isolated into different build bundles.
  * Look for static environment variables or hardcoded paths that assume all three applications are running on the same domain.

---

### Output Format
For any issue found, please list:
1. **File Name & Line Number:** with clickable file:// paths.
2. **The Problem:** Describe the bug or vulnerability.
3. **The Impact:** Why does this matter?
4. **Suggested Fix:** Include code diffs indicating what needs to change.

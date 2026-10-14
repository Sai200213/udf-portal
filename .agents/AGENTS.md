# Project AGENTS Customizations for UDF Subdomains

## 1. Fast Architecture & Component Index (No Broad Rescanning)
**CRITICAL AGENT RULE:** Do NOT execute broad directory searches or recursive grep scans to locate files. Always navigate directly to these known files:
* **Sites & Master Designations Library:** `components/AdminSiteManagementPage.tsx`
* **Staff Accounts & Assignments:** `components/AdminStaffManagementPage.tsx`
* **Universal Recycle Bin (30-day retention):** `components/AdminRecycleBinPage.tsx` & `src/services/recycleBinService.ts`
* **Master Employee List & Dossiers:** `components/AdminMasterEmployeeListPage.tsx`
* **Onboarding Submissions Review:** `components/AdminReviewSubmissionsPage.tsx`
* **Job Vacancies Manager:** `components/AdminVacancyManager.tsx`
* **Dynamic Form Builder:** `components/AdminFormBuilderPage.tsx` & `components/FieldEditorModal.tsx`
* **Roles & Permissions:** `components/AdminRoleManagementPage.tsx`
* **Global Context & React State:** `src/contexts/DataContext.tsx`
* **Defaults & Bootstrap:** `src/constants/defaults.ts` (Note: `defaultSites: []` strictly empty to prevent mock ID re-injection).

## 2. Firestore Database Architecture
* `settings/sites` — Stores all 24 client deployment sites (`sites: Site[]`).
* `settings/portal_config` — Global portal toggles, client ID definitions, master `designations[]`.
* `settings/form_sections` — Dynamic application form section definitions.
* `staff_accounts` — Real staff accounts (Devender: `qXffHXRjjSUZW6mHhQGQWkDdVHl2`, Devidas: `1u0gLadqh8X0WSkidimV2vtmxW12`, Prashanth, Sai).
* `recycle_bin` — Universal recycle bin (`SITE`, `STAFF`, `EMPLOYEE`, `SUBMISSION`, `INVITE`, `ROLE`, `VACANCY`, `DESIGNATION`).
* `employees`, `onboarding_submissions`, `referral_invites`, `vacancies`, `blog_posts`.

## 3. Deployment Targets & URLs
* **Admin Portal (`https://admin.udfonline.in`):** `npm run build:web:admin` -> `npx firebase deploy --only hosting:admin-portal`
* **Public Site (`https://udfonline.in`):** `npm run build:web:public` -> `npx firebase deploy --only hosting:main-site`
* **Employee Portal (`https://employee.udfonline.in`):** `npm run build:web:employee` -> `npx firebase deploy --only hosting:employee-portal`

## 4. Blog Creation Protocol Rule
Whenever the user asks to generate a blog post or says "next blog", "generate post", or similar:
1. **MUST read and strictly follow** the instructions in `[BLOG_CREATION_PROCESS_BY_AI.md](file:///z:/UDF_SUBDOMAINS/BLOG_CREATION_PROCESS_BY_AI.md)`.
2. Generate 3 custom AI images per post using `generate_image`.
3. Store assets in `public/blog-assets/<slug>/` and mirror to `dist-public/blog-assets/<slug>/`.
4. Use full domain `https://udfonline.in/blog-assets/<slug>/cover.png?v=1` ONLY for the Admin Cover Image field.
5. Use relative paths `/blog-assets/<slug>/<filename>.png?v=1` for all inline `<img src="...">` tags in the HTML body.
6. Automatically run `npm run build:web:public` followed by `npx firebase deploy --only hosting:main-site`.

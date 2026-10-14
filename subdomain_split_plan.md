# UDF Subdomain Splitting & Deployment Architecture Plan

This document outlines the technical proposal and execution steps to split the current unified codebase into three distinct hosted platforms:
1. **Main Domain:** `udfonline.in` (Public Site & Blog)
2. **Employee Portal:** `employee.udfonline.in` (Portal, Join Forms, Dashboards)
3. **Admin Portal:** `admin.udfonline.in` (Administrative controls & site managers)

---

## 🏛️ Target Architecture Design

To ensure optimal security, high performance, and compliance for search engines/AdSense, the routing tree will be split as follows:

```mermaid
graph TD
    User([Incoming User]) --> DNS{DNS Routing / Cloudflare}
    DNS -->|udfonline.in| Main[Main Public Domain]
    DNS -->|employee.udfonline.in| Emp[Employee Portal]
    DNS -->|admin.udfonline.in| Admin[Admin Portal]

    subgraph "udfonline.in (Public Content)"
        Main --> Home[/]
        Main --> Blogs[/blogs]
        Main --> About[/about]
        Main --> Careers[/careers]
        Main --> Contact[/contact]
        Main --> Business[/business]
    end

    subgraph "employee.udfonline.in (Staff Operations)"
        Emp --> EmpLogin[/login]
        Emp --> Claim[/claim-profile]
        Emp --> Join[/join]
        Emp --> Correction[/correct-details]
        Emp --> EmpDash[/employee/dashboard]
    end

    subgraph "admin.udfonline.in (Protected Management)"
        Admin --> AdminLogin[/admin/login]
        Admin --> AdminDash[/admin/dashboard]
        Admin --> AdminAudit[/admin/audit]
        Admin --> AdminStaff[/admin/staff]
    end
```

---

## 💎 Primary Benefits of Subdomain Separation

1. **Maximized Security (Access Isolation):**
   * Eliminates the risk of administrative route exposure on the public-facing domain.
   * Restricts sensitive cookie/session access strictly to target domains.
2. **SEO & AdSense Optimization:**
   * Keeps the main domain (`udfonline.in`) lightweight, SEO-friendly, and free from administrative portal scripts.
   * Solves crawler issues where search engine bots try to log into authenticated dashboards.
3. **Improved Performance (Code Splitting):**
   * Reduces bundle sizes. Public users do not need to download heavy admin tools (PDF readers, Excel importers), raising the Lighthouse Performance score above **90+**.

---

## 🛠️ Step-by-Step Implementation Strategy

### Phase 1: Vite Environment Configuration
Vite already uses the `VITE_APP_TARGET` variable. We will configure three local build commands in `package.json`:
* `npm run build:main` -> `cross-env VITE_APP_TARGET=public vite build`
* `npm run build:employee` -> `cross-env VITE_APP_TARGET=employee vite build`
* `npm run build:admin` -> `cross-env VITE_APP_TARGET=admin vite build`

This compiles three separate, lightweight `dist/` targets (`dist-main/`, `dist-employee/`, and `dist-admin/`) containing only the code required for that subdomain.

### Phase 2: Route Isolation
Modify [AppRoutes.tsx](file:///Z:/HR%20PORTAL/src/routes/AppRoutes.tsx) to completely segregate the route registration trees:
* **Public target:** Only mounts public pages (`/`, `/blogs`, `/careers`, etc.) and redirects any login/admin requests to `https://employee.udfonline.in` or `https://admin.udfonline.in`.
* **Employee target:** Only mounts portal login, joinee forms, profile claim, and employee dashboards.
* **Admin target:** Only mounts the administrative login and backend dashboard routes.

### Phase 3: Firebase Multi-Site Configuration
Configure multiple hosting targets in `firebase.json` under the same Firebase project:
```json
{
  "hosting": [
    {
      "target": "main-site",
      "public": "dist-main",
      "rewrites": [{ "source": "**", "destination": "/index.html" }]
    },
    {
      "target": "employee-portal",
      "public": "dist-employee",
      "rewrites": [{ "source": "**", "destination": "/index.html" }]
    },
    {
      "target": "admin-portal",
      "public": "dist-admin",
      "rewrites": [{ "source": "**", "destination": "/index.html" }]
    }
  ]
}
```

### Phase 4: DNS Configuration (Cloudflare)
Configure CNAME records in Cloudflare pointing the subdomains to Firebase Hosting:
* CNAME `udfonline.in` -> Firebase primary hosting
* CNAME `employee.udfonline.in` -> Firebase employee hosting site
* CNAME `admin.udfonline.in` -> Firebase admin hosting site

---

## 📝 Verification & Launch Checklist
- [ ] Compile all three profiles using localized npm scripts and ensure no overlapping chunks.
- [ ] Confirm that typing `udfonline.in/admin` on the main site redirects to `admin.udfonline.in` immediately.
- [ ] Confirm that `sitemap.xml` and `robots.txt` are only served on the public domain.

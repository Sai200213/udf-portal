# 🚀 AI Blog Post Creation & Live Deployment Process Guide

> **Note for Future AI Assistants:**  
> Whenever the user requests to create a new blog post or says `"next blog"`, read and follow this document **step-by-step**. This guide contains all operational rules, directory structures, image handling guidelines, domain formatting standards, and deployment commands for the **Unique Delta Force (UDF)** portal blog suite.

---

## 📋 1. Core Principles & Quality Standards

1. **Word Count & Depth**: Every blog post must be **500 to 1200+ words**, comprehensive, 100% original, and written in accessible language (easy for frontline security personnel, managers, and clients to understand).
2. **Visual Content**: Every blog post **MUST have 3 custom AI graphics**:
   - `cover.png`: Main article header visual.
   - 2 Inline Images: Educational diagrams, compliance flowcharts, or training checklists.
3. **Structured HTML Content**: The article content must use clean HTML formatting (`<p>`, `<h3>`, `<h4>`, `<ul>`, `<ol>`, and styled responsive cards with `my-6 rounded-xl overflow-hidden shadow-lg border border-gray-100`).

---

## 🖼️ 2. Critical Image Path & Domain Formatting Rules

| Usage Context | Correct URL Format | Example |
| :--- | :--- | :--- |
| **Admin Portal Cover Image Field** | Full Custom Domain URL with cache-buster `?v=1` | `https://udfonline.in/blog-assets/<slug>/cover.png?v=1` |
| **Inline Body HTML `<img src="...">`** | Clean Relative Path with cache-buster `?v=1` | `/blog-assets/<slug>/<filename>.png?v=1` |

> ⚠️ **CRITICAL DO NOTs:**  
> - **NEVER** use full domain links (`https://udfonline.in/...`) inside the inline HTML body `<img src="...">` tags! Always use relative paths (`/blog-assets/<slug>/...`).  
> - **NEVER** leave loose image files directly inside `public/blog-assets/`. All assets must sit in a dedicated subfolder matching the title slug: `public/blog-assets/<slug>/`.

---

## 📁 3. Directory & File Structure

For any blog post with slug `<slug>`:

```text
z:\UDF_SUBDOMAINS\
├── public/
│   └── blog-assets/
│       └── <slug>/
│           ├── cover.png
│           ├── <image_2_name>.png
│           └── <image_3_name>.png
└── dist-public/
    └── blog-assets/
        └── <slug>/
            ├── cover.png
            ├── <image_2_name>.png
            └── <image_3_name>.png
```

---

## ⚙️ 4. Step-by-Step AI Execution Workflow

When the user requests a new blog post topic:

### Step 1: Define Metadata & Title Slug
- Create a clean URL slug from the title (lowercase, hyphens only).
- Example: `fire-safety-and-extinguisher-operation-practical-training-manual-for-security-guards`

### Step 2: Generate 3 Custom AI Visuals (`generate_image`)
1. Generate `cover.png` prompt tailored to the article topic.
2. Generate Inline Image 1 (diagram/flowchart).
3. Generate Inline Image 2 (training checklist/table chart).

> 💡 *Quota Failure Fallback*: If `generate_image` returns HTTP 429 quota exhaustion, immediately copy available generated images and render remaining inline graphics as responsive, styled HTML/CSS UI cards inside the article body so the post remains 100% complete and deployable.

### Step 3: Copy Images to Project Folders
Run a Node.js script to create the slug directories and copy the generated images from the artifact directory to both target locations:
- `public/blog-assets/<slug>/`
- `dist-public/blog-assets/<slug>/`

### Step 4: Build & Deploy Live
Run the following build and deployment commands:
1. `npm run build:web:public`
2. `npx firebase deploy --only hosting:main-site`

### Step 5: Present Form Fields & Copyable Code to User
Output the following structured response:
- **Title**: Clean Title
- **Slug**: Title Slug
- **Category**: Topic Category
- **Read Time**: e.g., `8 min read`
- **Cover Image URL**: `https://udfonline.in/blog-assets/<slug>/cover.png?v=1`
- **Excerpt**: 2-sentence summary
- **Article HTML Body**: Fully formatted HTML code with relative image paths (`/blog-assets/<slug>/...`)

---

## 🛠️ 5. Helpful Commands Quick Reference

```bash
# Build the public static bundle
npm run build:web:public

# Deploy to Firebase Hosting (main-site target)
npx firebase deploy --only hosting:main-site
```

*This process ensures 100% AdSense compliance, fast CDN image caching, and instant live deployment for the Unique Delta Force portal.*

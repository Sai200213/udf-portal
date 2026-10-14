# Public Website Management & Employee Engagement - End-to-End Test Plan

This document provides a step-by-step testing script for the Public Landing Pages, Admin Website Manager, and the authenticated Employee Engagement Dashboard (with the interactive Attendance Calendar). Check off each step as you complete it, and note down any observations.

---

## Phase 1: Public Website Layout & Navigation (Unauthenticated)
Verify that public users see a professional, dynamic corporate landing page with clean layouts and zero employee-only widgets.

- [ ] **Step 1:** Open an incognito browser window (to simulate a public guest) and navigate to the home path `/`.
- [ ] **Step 2:** Verify the **Home/Blog page**:
  - The hero stats grid loads dynamic numbers (Active Personnel, Client Sites, Open Positions).
  - Blog post grid displays the latest articles with read-time and category tags.
  - AdSense units display correctly (no script console errors).
- [ ] **Step 3:** Navigate to **About Us** (`/about`):
  - Verify it shows the dynamic story sections, Active Guards statistics, and corporate details.
- [ ] **Step 4:** Navigate to **Our Services** (`/services`):
  - Verify it displays cards representing active security services (CCTV, Guarding, etc.) with custom hover effects.
- [ ] **Step 5:** Navigate to **Careers** (`/careers`):
  - Verify the split layout: left column displays employee benefits bullets; right column displays searchable job openings.
  - Use the search bar to filter openings. Expand a vacancy card to read details.
  - Click **Apply Now** on a vacancy. Verify you are redirected to `/join` with the designation and Site ID pre-filled in the form.
- [ ] **Step 6:** Navigate to **Contact Us** (`/contact`):
  - Verify the office coordinates, email, phone, and operating hours.
  - Fill out the inquiry form and click **Send Message**. Verify the success alert displays.

> **User Comment:** 
> 

---

## Phase 2: Admin Live Website Content Management (Super Admin)
Verify that edits made in the Admin Portal propagate instantly to the public website.

- [ ] **Step 7:** Log in to the HR Portal as a **Super Admin** or authorized staff user.
- [ ] **Step 8:** Navigate to **System Configuration** > **Website Manager**.
- [ ] **Step 9:** **Manage Blogs**:
  - Click **Add Blog Post**, fill in the title, date, category, excerpt, and HTML body, and click **Publish Post**.
  - Navigate to the public `/` path in another window and verify the new post is listed.
  - Edit the post in the Admin Portal, save, and verify the changes update on the public page.
  - Delete the blog post, and verify it is removed from the public list.
- [ ] **Step 10:** **Manage About & Services**:
  - Select the *About Us & Services Info* tab.
  - Modify the story text, change active stats count, and add a new custom service card with an icon.
  - Click **Save Public Layouts**.
  - Refresh the public `/about` and `/services` pages to verify the updates.
- [ ] **Step 11:** **Manage Contacts & Careers Pitch**:
  - Select the *Contact Info & Careers Pitch* tab.
  - Edit the office address, phone number, and operating hours.
  - Add a new benefit bullet for careers (e.g., "Performance Incentives").
  - Click **Save Public Layouts**.
  - Refresh the public `/contact` and `/careers` pages to verify the updates.

> **User Comment:** 
> 

---

## Phase 3: Authenticated Employee Engagement Dashboard
Verify that logged-in employees see their dedicated engagement dashboard.

- [ ] **Step 12:** Log in to the portal as an **Employee** (or claim a profile to create one).
- [ ] **Step 13:** Verify you are redirected to `/employee/dashboard` and the UI shows the new **Engagement Hub** instead of the public blog content.
- [ ] **Step 14:** Verify the **Daily Streak Tracker** displays your consecutive log-in streak correctly.
- [ ] **Step 15:** Verify the **Payday Countdown** clock displays the remaining days until the 7th of the month.
- [ ] **Step 16:** Take the **Daily Safety Quiz**:
  - Select an incorrect answer. Verify that the system highlights the incorrect option and displays the correct one.
  - Select the correct answer. Verify that the score increments and success feedback is shown.
- [ ] **Step 17:** Submit a grievance using the **Confidential Complaint Box**:
  - Enter message details and submit. Verify the confirmation alert.
  - *Optional:* Log in as Admin and verify the complaint is received under user submissions/requests.

> **User Comment:** 
> 

---

## Phase 4: Color-Coded Attendance Calendar
Verify that employees can log daily attendance visually.

- [ ] **Step 18:** Locate the **Attendance Calendar** grid on the Employee Dashboard.
- [ ] **Step 19:** Verify that past marked days show green (`P`), red (`A`), or orange (`W/O`).
- [ ] **Step 20:** Confirm that past or future days are read-only (clicking them does nothing).
- [ ] **Step 21:** Click **Today's date** on the calendar:
  - Verify that the daily marking modal opens.
  - Select Present (`P`), Absent (`A`), or Work-Off (`W/O`).
  - Enter optional task comments and click **Submit Attendance**.
- [ ] **Step 22:** Verify that the calendar square for today instantly updates to the correct color (e.g., Green for Present).
- [ ] **Step 23:** Refresh the page and verify that your marked attendance state persists.

> **User Comment:** 
> 

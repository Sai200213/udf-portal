# Legacy Profile Claim - End-to-End Test Plan

This document serves as a step-by-step testing script for the Legacy Employee Profile Claim feature. When we perform the test, please check off each step and leave any bugs, observations, or feedback in the `**User Comment**` sections.

---

## Phase 1: Admin Configuration & Data Import
- [ ] **Step 1:** Log in to the HR Portal as a **Super Admin**.
- [ ] **Step 2:** Navigate to the **Legacy Systems** (or equivalent Data Import) tab.
- [ ] **Step 3:** Enable the "Profile Claiming" feature toggle.
- [ ] **Step 4:** Select at least two Verification Metrics (e.g., Phone Number and Date of Birth).
- [ ] **Step 5:** Upload the legacy employee CSV/Excel data. Verify that the table populates correctly.

> **User Comment:** 
> 


---

## Phase 2: Employee Profile Claim (The Interrogation)
- [ ] **Step 6:** Open an incognito browser window (to simulate a different computer) or log out of the Admin account.
- [ ] **Step 7:** Go to the HR Portal login screen and click the option to **Claim Profile** / Sign in via Google. Use a *fresh test Google account* (not the Admin account).
- [ ] **Step 8:** You should be presented with the Profile Claim form.
- [ ] **Step 9:** Enter one of the legacy Employee IDs from the uploaded CSV.
- [ ] **Step 10:** **Negative Test:** Enter *incorrect* verification data (e.g., wrong phone number). Click Submit and verify that the system securely rejects you with an error.
- [ ] **Step 11:** **Positive Test:** Enter the *correct* verification data exactly as it appears in the CSV. Click Submit.
- [ ] **Step 12:** Verify you are successfully verified and instantly launched into the Onboarding Form.
- [ ] **Step 13:** Verify that your legacy details (Name, Phone, etc.) are **automatically pre-filled** in the form.

> **User Comment:** 
> 


---

## Phase 3: Employee Form Submission
- [ ] **Step 14:** Still acting as the test employee, fill out any remaining mandatory fields in the onboarding form (like Blood Group or Emergency Contact, if not provided in legacy data).
- [ ] **Step 15:** Upload required documents (e.g., Profile Picture, ID proof) to verify storage write permissions hold up.
- [ ] **Step 16:** Submit the finalized form for HR Approval.

> **User Comment:** 
> 


---

## Phase 4: Admin Final Approval & ID Allocation
- [ ] **Step 17:** Return to the Admin browser window (logged in as Super Admin).
- [ ] **Step 18:** Navigate to the **Pending Approval Pipeline** (Review Submissions). Locate the test employee's submission.
- [ ] **Step 19:** Review the pre-filled data and any uploaded documents to ensure everything ported correctly.
- [ ] **Step 20:** Click **"Final Approve & Onboard"**.
- [ ] **Step 21:** In the ID assignment box, type in their *exact same* legacy Employee ID to preserve their historical ID string. Complete the approval.

> **User Comment:** 
> 


---

## Phase 5: Post-Onboarding Verification (The Finale)
- [ ] **Step 22:** Go back to the incognito/employee window. Refresh the page or log back in via Google.
- [ ] **Step 23:** Verify that the system now recognizes the employee as a fully onboarded user and drops them straight into the **Main Employee Dashboard**.
- [ ] **Step 24:** Verify that their Profile section shows the correct company Employee ID that the Admin assigned in Step 21.

> **User Comment:** 
> 

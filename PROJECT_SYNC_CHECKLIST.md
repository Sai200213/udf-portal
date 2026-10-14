# 🚀 Project Verification Checklist (April 10, 2026)

*Please open this file in your editor and add your comments below each section. When you're done, save it and tell me "Check the checklist."*

---

## 🏗️ Section 1: Legacy Profile Verification (The Proof)
**What I see in the code:** 
We built the logic where employees can prove who they are using PAN, Phone, Aadhaar, etc.
- **Example:** An employee enters their PAN card number to "Claim" their profile.
- **Admin Control:** You have toggles to select which metrics are required.

### 📝 Your Comment:
> [!NOTE]
> (Add your comment here: we didnt yet test this we will test it after we finish the project)



---

## 🔗 Section 2: Account Linking (The Connection)
**What I see in the code:** 
I found a temporary script `fix-auth-data.js` being used to link user `HY140000`. This suggests the **automatic linking** might be the current bottleneck.
- **The Goal:** When an employee successfully verifies their PAN, the system should *automatically* save their Google UID to their profile so they are linked forever.
- **The Current State:** We might be having to do this manually right now.

### 📝 Your Comment:
> [!NOTE]
> (Add your comment here: io mean how do you get the uid of the employee?do they have to login in joining page which is reflected in joining page or how do you do it without their id or anything until and unless they are in master employee list hoe can they be verified or linked?)need suggestion on this


---

## 📁 Section 3: The Git / Folder Sync Mess
**What I see in the history:** 
You tried to move changes from the worktree folder to `z:\HR PORTAL`, but Git failed because it's missing from the PATH.
- **My Findings:** I checked `z:\HR PORTAL` and verified that the **Multi-Metric code (PAN/Aadhaar UI)** is already there.

### 📝 Your Comment:
> [!NOTE]
> (Add your comment here: forget this


---

## ⏭️ Section 4: What's Next?
**My Suggestion:** 
If Sections 1 and 2 are clear, I recommend we finish the **Auto-Linking** logic so you can delete that `fix-auth-data.js` script forever.

### 📝 Your Comment:
> [!NOTE]
> (Add your comment here: later first check above comments


## ?? Pending Tasks (Paused for Legacy Employee List Upload)

### ??? To Clean Up Later
- [ ] Delete or archive manual linking scripts (ix-auth-data.js, migrate-storage-urls.cjs).
- [ ] Strip out any leftover UI logic relying on legacy submissionId instead of Auth UID.
- [ ] Restrict basic Admin privileges to prevent accidental portal configuration changes.

### ?? To Build & Test Later
- [ ] **Finalize Auto-Linking Flow**: Complete ProfileClaimPage.tsx so users can automatically link their Google UID to the master record using PAN/Aadhaar/Phone.
- [ ] **End-to-End Testing**: Run a full dummy employee test through the multi-metric verification system.
- [ ] **Resignation Flow**: Complete EmployeeResignationPage.tsx and the offboarding/access revocation logic.
- [ ] **Notifications**: Implement email/in-app alerts in notificationService.ts for draft submissions and document approvals.

### 🏗️ Future Architecture Roadmap
- [ ] **Subdomain Separation**: Once a custom domain (e.g., `company.com`) is acquired, split the application into separate subdomains for security and performance:
  - `admin.company.com` (Admin Portal only)
  - `portal.company.com` or `employee.company.com` (Employee Dashboard)
  - `www.company.com` (Public Onboarding & Marketing/Blogs)

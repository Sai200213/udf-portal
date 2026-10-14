# 🚀 Deploying Admin User Creation Feature

Your app now has the ability for **Admins to create staff accounts** directly from the portal!

## How It Works

When an admin creates a staff member in the UI, the app will:
1. Create a Firebase Authentication account (email/password)
2. Add the user to Firestore `staff` collection
3. The new staff can immediately login with their email

---

## Quick Setup (10 minutes)

### Step 1: Install Firebase CLI

```powershell
npm install -g firebase-tools
```

### Step 2: Login to Firebase

```powershell
firebase login
```

### Step 3: Initialize Functions

```powershell
cd "Z:\HR PORTAL"
firebase init functions
```

**When asked:**
- Use existing project: **hr-portal-unique-delta**
- Language: **JavaScript**
- Install dependencies: **Yes**

### Step 4: Deploy Functions

```powershell
cd functions
npm install
cd ..
firebase deploy --only functions
```

This uploads your Cloud Functions to Firebase (takes ~2 minutes).

---

## ✅ After Deployment

### Test Creating a User

1. Login to your app as admin: http://localhost:3002
2. Go to **Staff Management**
3. Click **"Add Staff"**
4. Fill in:
   - Name: `Test User`
   - Username: `testuser`
   - Email: `testuser@uniquedelta.com`
   - Password: `password123`
   - Role: Select any role
5. Click **"Create"**

The app will:
- ✅ Create Firebase Auth user
- ✅ Add to Firestore
- ✅ User can immediately login!

---

## 💡 Alternative: Skip Cloud Functions (Simpler but Manual)

If you don't want to deploy Cloud Functions:

1. Admins create staff in the UI (Firestore only)
2. **Manually** add the user to Firebase Authentication Console
3. User can then login

This works but requires manual Firebase Console work for each user.

---

## ❓ Which Option Do You Want?

**Option A**: Deploy Cloud Functions (fully automated, takes 10 min)  
**Option B**: Keep manual Firebase Console method (no deployment needed)

Let me know and I'll help you proceed!

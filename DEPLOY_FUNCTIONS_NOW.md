# 🚀 Deploy Cloud Functions - Quick Steps

Firebase CLI is ready! Follow these simple steps to deploy:

## Step 1: Login to Firebase (30 seconds)

Open a **new terminal/PowerShell window** and run:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
firebase login
```

A browser window will open. Login with your Google account (the one you used for Firebase).

## Step 2: Initialize Firebase (1 minute)

In the same terminal, navigate to your project and initialize:

```powershell
cd "Z:\HR PORTAL"
firebase init functions
```

**When asked, SELECT:**
- ✅ Use an existing project: **hr-portal-unique-delta**
- ✅ Language: **JavaScript** (press Enter)
- ✅ ESLint: **No** (type `n` and press Enter)
- ✅ Install dependencies: **Yes** (press Enter)

## Step 3: Deploy Functions (2 minutes)

```powershell
firebase deploy --only functions
```

Wait ~2 minutes for deployment to complete.

## Step 4: Test in Your App

1. Go to http://localhost:3002
2. Login as admin (`admin` / `password`)
3. Navigate to **Staff Management**
4. Click **Add Staff**
5. Fill in the form:
   - Name: `Test User`
   - Username: `testuser`
   - Email: `test@uniquedelta.com`
   - Password: `password123`
   - Role: Any role
6. Click **Create**

The user will be created in Firebase Authentication automatically! 🎉

---

## ✅ After Deployment

New staff can login immediately with:
- **Email**: `test@uniquedelta.com`
- **Password**: `password123`

---

## 🆘 If You Get Stuck

Just paste the error message and I'll help you fix it!

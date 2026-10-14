# ⚡ Quick Start - Create Your First Real User (2 Minutes)

Skip Cloud Functions for now and create your first admin user manually:

## Step 1: Create User in Firebase Console

1. Go to https://console.firebase.google.com/
2. Select **hr-portal-unique-delta**
3. **Authentication** → **Users** → **Add user**
4. Fill in:
   - Email: `admin@uniquedelta.com`
   - Password: `admin123`
5. Click **Add user**
6. **COPY the User UID** shown (looks like: `abc123def456...`)

## Step 2: Add to Firestore

1. Go to **Firestore Database**
2. Click **Start collection**
3. Collection ID: `staff`
4. Document ID: **Paste the UID you copied**
5. Add fields:

```
username: admin
email: admin@uniquedelta.com
name: Admin User
roleId: role-hr-manager
isDisabled: false
```

6. Click **Save**

## Step 3: Login to Your App

1. Go to http://localhost:3002
2. Login with:
   - **Email**: `admin@uniquedelta.com`
   - **Password**: `admin123`

✅ **You're now using REAL Firebase authentication!**

---

## Later: Deploy Cloud Functions

Once you're comfortable, follow [`DEPLOY_FUNCTIONS_NOW.md`](file:///Z:/HR%20PORTAL/DEPLOY_FUNCTIONS_NOW.md) to enable creating users from the app.

For now, create each new staff member manually using the steps above (takes 1 minute per user).

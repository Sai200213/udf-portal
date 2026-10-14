# 🔐 Setting Up Real Firebase Authentication

Follow these steps to create **real user accounts** (like Gmail, Facebook, etc.) instead of using hardcoded logins.

## Step 1: Create Authentication Users

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select: **hr-portal-unique-delta**
3. Click **Authentication** → **Users** tab
4. Click **"Add user"**

### Users to Create:

| Email | Password | Name | Role |
|-------|----------|------|------|
| `sai@uniquedelta.com` | `password123` | Sai | HR Manager |
| `devidas@uniquedelta.com` | `password123` | Devidas | Field Officer |

5. **After creating each user, COPY the User UID** (looks like `a1b2c3d4e5f6...`)

---

## Step 2: Link Users to Firestore

For **each user** you created:

1. Go to **Firestore Database** in Firebase Console
2. Click on the `staff` collection (create it if it doesn't exist)
3. Click **"Add document"**
4. Set **Document ID** = User UID from Step 1
5. Add these fields:

### For Sai:
```
Field         | Type    | Value
--------------|---------|------------------
username      | string  | sai
email         | string  | sai@uniquedelta.com
name          | string  | Sai
roleId        | string  | role-hr-manager
isDisabled    | boolean | false
```

### For Devidas:
```
Field         | Type    | Value
--------------|---------|------------------
username      | string  | devidas
email         | string  | devidas@uniquedelta.com
name          | string  | Devidas
roleId        | string  | role-field-officer
isDisabled    | boolean | false
```

---

## Step 3: Test Real Login

1. Go to http://localhost:3002
2. Login with:
   - **Email** (not username): `sai@uniquedelta.com`
   - **Password**: `password123`

✅ This is **real Firebase authentication** - same technology as Gmail, Facebook, Netflix!

---

## 🔧 Troubleshooting

**"User not found"**: Make sure the User UID in Firestore matches the Authentication UID exactly.

**"Invalid credentials"**: Double-check the email and password in Firebase Authentication.

**Still using old login**: The app tries Firebase first, then falls back to hardcoded `admin/password` if Firebase fails.

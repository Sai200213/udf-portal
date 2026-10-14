# 🔐 Creating Your First Admin User

Since your app is now connected to Firebase, you need to create the first admin user account.

## Option 1: Use Firebase Console (Recommended - 2 minutes)

1.  Go to [Firebase Console](https://console.firebase.google.com/)
2.  Select your project: **"hr-portal-unique-delta"**
3.  Click **Authentication** -> **Users** tab
4.  Click **"Add user"**
5.  Fill in:
    *   **Email**: `admin@uniquedelta.com`
    *   **Password**: `password123`
6.  Click **"Add user"**
7.  **IMPORTANT**: Copy the **User UID** (it will look like: `AbCD1234efgh`)

8.  Now go to **Firestore Database** 
9.  Click **"Start collection"**
    *   Collection ID: `staff`
    *   Click **Next**
10. Document ID: **Paste the User UID you copied**
11. Add these fields:
    ```
    Field         | Type   | Value
    --------------|--------|------------------
    username      | string | admin
    email         | string | admin@uniquedelta.com
    name          | string | Admin User
    roleId        | string | role-hr-manager
    isDisabled    | boolean| false
    ```
12. Click **Save**

## Option 2: Use the Hardcoded Backdoor (30 seconds)

Your app has a backdoor login built-in (for testing):
*   **Username**: `admin`
*   **Password**: `password`

This bypasses Firebase and logs you in locally. You can use this for now!

---

## ✅ After Setup

Go to **http://localhost:3001** and test your login!

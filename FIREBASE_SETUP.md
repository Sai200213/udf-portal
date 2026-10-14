# 🔥 Firebase Setup Guide (Required)

To make your HR Portal database work, follow these steps to create a free Firebase project.

## 1. Create Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"**
3. Name it: `HR-Portal-Unique-Delta` (or anything you like)
4. Toggle **"Enable Google Analytics"** -> **OFF** (Keep it simple)
5. Click **"Create project"**

## 2. Enable Authentication
1. In the left sidebar, click **Build** -> **Authentication**
2. Click **"Get started"**
3. Click **"Native providers"** -> **"Email/Password"**
4. Enable **Email/Password**
5. Click **Save**
6. Click **Users** tab -> **Add user**
   - Email: `admin@uniquedelta.com`
   - Password: `password123`
   - Click **Add user**
   - **Copy the User UID** (you'll need this to make them an admin later)

## 3. Enable Database (Firestore)
1. In the left sidebar, click **Build** -> **Firestore Database**
2. Click **"Create database"**
3. Location: Choose one close to you (e.g., `asia-south1` for India)
4. Rules: Select **"Start in test mode"** (we'll fix security later)
5. Click **Create**

## 4. Enable Storage
1. In the left sidebar, click **Build** -> **Storage**
2. Click **"Get started"**
3. Rules: Select **"Start in test mode"**
4. Click **Next** -> **Done**

## 5. Get API Keys
1. Click the **Gear icon** (Settings) next to "Project Overview"
2. Scroll down to **"Your apps"**
3. Click the **Web icon (`</>`)**
4. App nickname: `HR Portal`
5. Click **Register app**
6. You will see a `firebaseConfig` object looks like this:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "...",
     projectId: "...",
     storageBucket: "...",
     messagingSenderId: "...",
     appId: "..."
   };
   ```
7. **Keep this tab open!** You need these values.

## 6. Connect to Your App
1. Open the file `.env.local` in your project folder (Z:\HR PORTAL\.env.local)
2. Fill in the values from step 5:

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

## 7. Run the App!
1. Restart your dev server:
   ```powershell
   npm run dev
   ```
2. Login with the admin user you created!

---
**Need help?** Just paste the error here after you try these steps!

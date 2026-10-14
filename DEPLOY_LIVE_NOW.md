# 🚀 Deploy Your Website Live NOW (5 Minutes)

Your website is built and ready! Follow these simple steps:

## Method 1: Netlify Drop (Fastest - 3 Minutes)

### Step 1: Upload Your Site
1. Go to **https://app.netlify.com/drop**
2. Drag the **`Z:\HR PORTAL\dist`** folder onto the page
3. Wait 30 seconds for upload

Your site is now LIVE! You'll get a URL like: `https://random-name-123.netlify.app`

### Step 2: Add Firebase Keys
1. Click **Site settings** → **Environment variables**
2. Click **Add a variable** and add each of these:

```
VITE_FIREBASE_API_KEY = AIzaSyCG5XXyHGQbJvITqCs08elQQsWz5J8Mw7w
VITE_FIREBASE_AUTH_DOMAIN = hr-portal-unique-delta.firebaseapp.com
VITE_FIREBASE_PROJECT_ID = hr-portal-unique-delta
VITE_FIREBASE_STORAGE_BUCKET = hr-portal-unique-delta.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID = 1020534793994
VITE_FIREBASE_APP_ID = 1:1020534793994:web:da380bd59b8f2f89c5fcf3
```

3. Click **Save**
4. Click **Deploys** → **Trigger deploy** → **Clear cache and deploy**

### Step 3: Custom Domain (Optional)
1. Click **Domain settings** → **Add custom domain**
2. Enter your domain (e.g., `hr.uniquedelta.com`)
3. Follow DNS instructions

---

## Method 2: Vercel (Alternative)

### Step 1: Upload
1. Go to **https://vercel.com/new**
2. Login with GitHub/Google
3. Click **Upload** tab
4. Drag the `dist` folder

### Step 2: Add Environment Variables
Same as Netlify - add the Firebase keys in Project Settings.

---

## ✅ Your Website is LIVE!

Visit your Netlify URL and test the login:
- Username: `admin`
- Password: `password`

Later, add real users via Firebase Console!

---

## 🔄 Future Updates

When you make changes:
1. Run `npm run build`
2. Drag new `dist` folder to Netlify Drop
3. Done!

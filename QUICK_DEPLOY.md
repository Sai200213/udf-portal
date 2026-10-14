# 🚀 Firebase Hosting Guide

Your HR Portal is deployed via **Firebase Hosting**.

## 🔗 Where to View Your Deployment

**It is NOT in Firestore.** usage and history are in the **Hosting** tab.

### Direct Link:
👉 [**Firebase Console > Hosting**](https://console.firebase.google.com/project/hr-portal-unique-delta/hosting)

---

## 🕹️ Management Dashboard

In the Hosting dashboard, you will see:

### 1. **Deployment History**
*   Shows every time you ran `firebase deploy`.
*   Shows who deployed it and when.
*   **Rollback**: If a new version breaks, you can click the "three dots" next to an old version and select **Rollback** to instantly restore the previous site.

### 2. **Domains**
*   You live at `https://hr-portal-unique-delta.web.app`.
*   You can click **Add Custom Domain** here to connect `hr.yourcompany.com` (Free SSL included).

### 3. **Usage**
*   Shows how much data (bandwidth) your site is using.
*   Shows how many people have storage.

---

## 📦 How to Update Your Site

When you make code changes in the future, follow this **2-step process**:

1.  **Build the Code**:
    ```powershell
    npm run build
    ```
    *(This updates the `dist` folder with your new code)*

2.  **Deploy**:
    ```powershell
    firebase deploy --only hosting
    ```
    *(This sends the `dist` folder to Google's servers)*

---

## ❓ Common Questions

### Q: Why isn't it in Firestore?
**A**: **Firestore** is your *Database* (stores employee data). **Hosting** is your *Web Server* (stores the HTML/JS files). They are separate services in the same project.

### Q: Is it free?
**A**: Yes. The "Spark Plan" gives you 10GB storage/transfer per month, which is huge for an internal tool.

### Q: usage Logs?
**A**: Firebase doesn't show "User X visited Page Y" logs by default. For that, we built the **Audit Logs** system inside your app!

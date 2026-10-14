import log from "@/src/utils/logger";
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, setLogLevel } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
    apiKey:            import.meta.env.VITE_FIREBASE_API_KEY?.trim(),
    authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim(),
    projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim(),
    storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim(),
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim(),
    appId:             import.meta.env.VITE_FIREBASE_APP_ID?.trim()
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const auth = getAuth(app);

// Enable Verbose Debugging only in development
if (import.meta.env.DEV) {
  setLogLevel('debug');
}

// Log Project ID for verification (safe for public logs)
const pId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
log.log("Firebase Initializing for Project ID starts with:", pId ? pId.substring(0, 5) : "UNDEFINED");
log.log("Config Presence - API KEY:",    import.meta.env.VITE_FIREBASE_API_KEY    ? "YES" : "NO");
log.log("Config Presence - AUTH DOMAIN:", import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ? "YES" : "NO");

export const db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
});
export const storage = getStorage(app);
export const functions = getFunctions(app);

export default app;

// SECURITY: Local Development Firestore Request Guard
// Automatically counts and halts excessive Firestore network requests to prevent unintended billing.
if (import.meta.env.DEV) {
    const REQUEST_LIMIT = 1500;
    let localReqCount = 0;

    const checkLimit = () => {
        localReqCount++;
        if (localReqCount > REQUEST_LIMIT) {
            const errorMsg = `🛑 DEVELOPER FIREWALL: Outgoing Firestore request limit exceeded (${localReqCount} calls). Infinite loop detected! Database calls are now BLOCKED to prevent GCP charges. Check your useEffect hooks or loops, then save to reload.`;
            alert(errorMsg);
            throw new Error(errorMsg);
        }
    };

    // Intercept fetch requests
    const originalFetch = window.fetch;
    window.fetch = function (input, init) {
        const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : '');
        if (url && url.includes('firestore.googleapis.com')) {
            try { checkLimit(); } catch (e) { return Promise.reject(e); }
        }
        return originalFetch.apply(this, arguments as any);
    };

    // Intercept XMLHttpRequest requests
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
        if (typeof url === 'string' && url.includes('firestore.googleapis.com')) {
            checkLimit();
        }
        return originalOpen.apply(this, arguments as any);
    };

    // Intercept WebSocket channels (where Firebase real-time subscription calls occur)
    const OriginalWebSocket = window.WebSocket;
    const WebSocketWrapper = function (url: string | URL, protocols?: string | string[]) {
        const socket = new OriginalWebSocket(url, protocols);
        const originalSend = socket.send;
        socket.send = function (data) {
            const urlString = typeof url === 'string' ? url : url.toString();
            if (urlString.includes('firestore.googleapis.com') || urlString.includes('firebase')) {
                checkLimit();
            }
            return originalSend.apply(this, arguments as any);
        };
        return socket;
    };
    WebSocketWrapper.prototype = OriginalWebSocket.prototype;
    Object.assign(WebSocketWrapper, OriginalWebSocket);
    window.WebSocket = WebSocketWrapper as any;
}

// --- Authentication Helper for Public Users ---
// Ensures the user is at least signed in anonymously (required for Firestore/Functions access)
export const ensureAuthenticated = async () => {
    let user = auth.currentUser;
    if (!user) {
        const { signInAnonymously } = await import('firebase/auth');
        const cred = await signInAnonymously(auth);
        user = cred.user;
    }
    return user;
};

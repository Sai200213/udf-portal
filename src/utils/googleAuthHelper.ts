import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import {
    GoogleAuthProvider,
    signInWithPopup,
    signInWithCredential,
    linkWithPopup,
    linkWithCredential,
    UserCredential,
    getAuth,
    setPersistence,
    inMemoryPersistence
} from 'firebase/auth';
import { initializeApp, getApp } from 'firebase/app';
import { auth } from '../firebase/config';
import log from './logger';

/**
 * Creates lazy-loaded secondary Firebase Auth instance so we can pop up
 * the Google Sign-In window WITHOUT terminating the user's primary
 * Custom Token session in the main Auth context.
 */
const getSecondaryAuth = () => {
    const mainApp = getApp();
    let secApp;
    try {
        secApp = getApp('GoogleLinkerApp');
    } catch {
        secApp = initializeApp(mainApp.options, 'GoogleLinkerApp');
    }
    return getAuth(secApp);
};

export interface SafeGoogleResult {
    uid: string;
    email: string;
    idToken?: string;
}

/**
 * Safely fetches a Google UID and Email.
 * DOES NOT affect the main auth.currentUser session.
 */
export const getGoogleCredentialSafely = async (): Promise<SafeGoogleResult> => {
    if (Capacitor.isNativePlatform()) {
        try {
            await GoogleAuth.initialize({
                clientId: '1020534793994-rgenpapsrvjdbt2r6hicnkolfd28rdup.apps.googleusercontent.com',
                scopes: ['profile', 'email'],
            });
            const result = await GoogleAuth.signIn();
            if (!result.authentication?.idToken) throw new Error('No ID token');

            const credential = GoogleAuthProvider.credential(result.authentication.idToken);
            const secAuth = getSecondaryAuth();
            await setPersistence(secAuth, inMemoryPersistence);
            const userCred = await signInWithCredential(secAuth, credential);
            const idToken = await userCred.user.getIdToken();
            const res = { uid: userCred.user.uid, email: userCred.user.email!, idToken };
            await secAuth.signOut();
            return res;
        } catch (error: any) {
            log.error('Native Safe Google error:', error);
            throw error;
        }
    } else {
        try {
            const secAuth = getSecondaryAuth();
            await setPersistence(secAuth, inMemoryPersistence);
            const provider = new GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });
            const userCred = await signInWithPopup(secAuth, provider);
            const idToken = await userCred.user.getIdToken();
            const res = { uid: userCred.user.uid, email: userCred.user.email!, idToken };
            await secAuth.signOut();
            return res;
        } catch (error: any) {
            log.error('Web Safe Google error:', error);
            throw error;
        }
    }
};

/**
 * Universal Google Account Linking helper.

/**
 * Universal Google Sign-In helper.
 * - On native (Capacitor): Uses native Google Sign-In SDK via plugin
 * - On web: Falls back to Firebase signInWithPopup
 * 
 * Returns a Firebase UserCredential in both cases.
 */
export const googleSignIn = async (): Promise<UserCredential> => {
    if (Capacitor.isNativePlatform()) {
        return nativeGoogleSignIn();
    } else {
        return webGoogleSignIn();
    }
};

/**
 * Native Google Sign-In using Capacitor plugin.
 * Gets an ID token from the native SDK, then converts it to a Firebase credential.
 */
const nativeGoogleSignIn = async (): Promise<UserCredential> => {
    try {
        // Initialize the plugin with the Web Client ID
        await GoogleAuth.initialize({
            clientId: '1020534793994-rgenpapsrvjdbt2r6hicnkolfd28rdup.apps.googleusercontent.com',
            scopes: ['profile', 'email'],
        });

        const result = await GoogleAuth.signIn();
        log.log('Native Google Sign-In result:', result.email);

        if (!result.authentication?.idToken) {
            throw new Error('No ID token received from native Google Sign-In');
        }

        // Convert the native token to a Firebase credential
        const credential = GoogleAuthProvider.credential(result.authentication.idToken);
        const userCredential = await signInWithCredential(auth, credential);

        return userCredential;
    } catch (error: any) {
        log.error('Native Google Sign-In error:', error);
        throw error;
    }
};

/**
 * Web fallback using Firebase signInWithPopup.
 */
const webGoogleSignIn = async (): Promise<UserCredential> => {
    try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({
            prompt: 'select_account'
        });
        const result = await signInWithPopup(auth, provider);
        return result;
    } catch (error: any) {
        log.error('Web Google Sign-In error:', error);
        throw error;
    }
};

/**
 * Google Sign-In for onboarding flow (temporary session).
 * Returns user info without persisting the Firebase session.
 */
export const googleSignInForOnboarding = async () => {
    if (Capacitor.isNativePlatform()) {
        try {
            await GoogleAuth.initialize({
                clientId: '1020534793994-rgenpapsrvjdbt2r6hicnkolfd28rdup.apps.googleusercontent.com',
                scopes: ['profile', 'email'],
            });
            const result = await GoogleAuth.signIn();

            if (!result.authentication?.idToken) {
                throw new Error('No ID token received');
            }

            // Create a temporary credential to get user info
            const credential = GoogleAuthProvider.credential(result.authentication.idToken);
            const userCredential = await signInWithCredential(auth, credential);
            return userCredential.user;
        } catch (error: any) {
            log.error('Native Google onboarding sign-in error:', error);
            throw error;
        }
    } else {
        // Web fallback
        const { signInWithPopup: popup } = await import('firebase/auth');
        const { setPersistence, browserSessionPersistence } = await import('firebase/auth');
        await setPersistence(auth, browserSessionPersistence);
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({
            prompt: 'select_account'
        });
        const result = await popup(auth, provider);
        return result.user;
    }
};

/**
 * Sign out from Google (clears native session too).
 */
export const googleSignOut = async (): Promise<void> => {
    if (Capacitor.isNativePlatform()) {
        try {
            await GoogleAuth.signOut();
        } catch (e) {
            // Non-critical — Firebase signOut handles the main session
        }
    }
};

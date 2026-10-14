/**
 * Platform detection utilities (web-only fallback).
 * Since Capacitor has been removed, all native app checks return false.
 */

export const isNativeApp = (): boolean => {
    return false;
};

export const isAndroid = (): boolean => {
    return false;
};

export const isIOS = (): boolean => {
    return false;
};

export const isWeb = (): boolean => {
    return true;
};

export const initNativeAppStyles = (): void => {
    // No-op in web-only target
};

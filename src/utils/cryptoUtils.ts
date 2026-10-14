/**
 * Utility to hash passwords using native Web Crypto API (SHA-256).
 * No external dependencies required.
 */
const SALT = 'UDF_PORTAL_SALT_2026_!!';

export const hashPassword = async (password: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + SALT);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};



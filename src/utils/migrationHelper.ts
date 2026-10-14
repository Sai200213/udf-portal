import log from "@/src/utils/logger";
import { collection, addDoc, doc, setDoc, getDocs, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';

export const migrateData = async () => {
    log.log("Starting migration...");
    log.log("Migration placeholder - connect to your constants to run");
};

export const createInitialAdmin = async (userId: string, email: string, name: string, roleId: string) => {
    try {
        await setDoc(doc(db, 'staff', userId), {
            username: userId,
            email: email,
            name: name,
            roleId: roleId
        });
        log.log("Admin created:", userId);
    } catch (e) {
        console.error("Failed to create admin", e);
    }
}

/**
 * @deprecated This function used client-side SHA-256 which is insecure.
 * Password migration is now handled automatically by the Cloud Function
 * `employeeLogin` which auto-upgrades mockPassword to bcrypt on first login.
 */
export const migratePasswords = async () => {
    log.warn("migratePasswords is DEPRECATED. Password migration is handled automatically by Cloud Functions on first login.");
};

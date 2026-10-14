import { db } from '../firebase/config';
import { collection, addDoc, updateDoc, doc, query, where, onSnapshot, orderBy, limit, writeBatch, serverTimestamp } from 'firebase/firestore';
import { Notification } from '../../types';

const NOTIF_COL = 'notifications';

export const sendFirestoreNotification = async (
    targetUserId: string,
    message: string,
    type: 'success' | 'error' | 'info' | 'warning' = 'info',
    link?: string
) => {
    try {
        await addDoc(collection(db, NOTIF_COL), {
            targetUserId,
            message,
            type,
            link: link || null,
            read: false,
            createdAt: serverTimestamp(),
            timestamp: new Date().toISOString() // Fallback display time
        });
    } catch (error) {
        console.error("Error sending notification:", error);
    }
};

export const subscribeToNotifications = (
    userId: string,
    roleId: string | undefined,
    callback: (notifs: Notification[]) => void,
    portalId?: string
) => {
    // Query: Target User OR Role OR Portal ID
    // Firestore "OR" queries need "in" operator or separate listeners. 
    // For simplicity, we use "targetUserId" field to store either userId, Portal ID, OR "ROLE:{roleId}".
    // And query `where("targetUserId", "in", targets)`

    const targets = [userId];
    if (roleId) targets.push(`ROLE:${roleId}`);
    if (portalId) targets.push(portalId);

    const unsubs: (() => void)[] = [];
    const notifMap = new Map<string, Notification>();

    targets.forEach(target => {
        const q = query(
            collection(db, NOTIF_COL),
            where("targetUserId", "==", target),
            limit(50)
        );

        const unsub = onSnapshot(q, (snap) => {
            snap.forEach(docSnap => {
                const data = docSnap.data();
                let timeVal = data.timestamp;
                if (data.createdAt) {
                    if (typeof data.createdAt.toDate === 'function') {
                        timeVal = data.createdAt.toDate().toISOString();
                    } else if (typeof data.createdAt === 'string') {
                        timeVal = data.createdAt;
                    }
                }
                notifMap.set(docSnap.id, {
                    id: docSnap.id,
                    ...data,
                    timestamp: timeVal || new Date().toISOString()
                } as Notification);
            });

            snap.docChanges().forEach(change => {
                if (change.type === 'removed') {
                    notifMap.delete(change.doc.id);
                }
            });

            const notifs = Array.from(notifMap.values());
            notifs.sort((a, b) => {
                const timeA = new Date(a.timestamp || 0).getTime();
                const timeB = new Date(b.timestamp || 0).getTime();
                return timeB - timeA;
            });

            callback(notifs);
        }, (error) => {
            console.error(`Notification subscription error for target ${target}:`, error);
        });

        unsubs.push(unsub);
    });

    return () => {
        unsubs.forEach(u => u());
    };
};

export const markNotificationRead = async (notificationId: string) => {
    const ref = doc(db, NOTIF_COL, notificationId);
    await updateDoc(ref, { read: true });
};

export const markAllRead = async (userId: string, currentNotifs: Notification[]) => {
    const batch = writeBatch(db);
    const unread = currentNotifs.filter(n => !n.read && n.targetUserId === userId);

    if (unread.length === 0) return;

    unread.forEach(n => {
        const ref = doc(db, NOTIF_COL, n.id);
        batch.update(ref, { read: true });
    });

    try {
        await batch.commit();
    } catch (error) {
        console.error("Error batch marking read:", error);
    }
};


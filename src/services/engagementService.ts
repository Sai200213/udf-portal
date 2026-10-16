import { db } from '../firebase/config';
import { 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    deleteDoc,
    collection, 
    addDoc, 
    query, 
    where, 
    getDocs, 
    orderBy,
    onSnapshot,
    serverTimestamp, 
    Timestamp 
} from 'firebase/firestore';
import log from '../utils/logger';

// Helper to get YYYY-MM-DD date string in local timezone
export const getLocalDateString = (offsetDays = 0) => {
    // Force evaluation strictly under India Standard Time (IST = Asia/Kolkata)
    const now = new Date();
    const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const d = new Date(istString);
    if (offsetDays !== 0) {
        d.setDate(d.getDate() + offsetDays);
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export interface UserStreak {
    userId: string;
    userName: string;
    streakCount: number;
    lastVisitDate: string;
}

// 1. STREAK SERVICES
export const getUserStreak = async (userId: string): Promise<UserStreak | null> => {
    try {
        const docRef = doc(db, 'user_engagement', userId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data() as UserStreak;
        }
        return null;
    } catch (error) {
        log.error('Error fetching user streak:', error);
        return null;
    }
};

export const updateOrCreateStreak = async (userId: string, userName: string): Promise<UserStreak & { points?: number }> => {
    const today = getLocalDateString();
    const yesterday = getLocalDateString(-1);
    const docRef = doc(db, 'user_engagement', userId);
    
    try {
        const currentStreak = await getUserStreak(userId) as any;
        
        // 1. Fetch streak points configuration from gamification_rules
        let streakPoints = 1;
        try {
            const rulesRef = doc(db, 'settings', 'gamification_rules');
            const rulesSnap = await getDoc(rulesRef);
            if (rulesSnap.exists()) {
                streakPoints = rulesSnap.data().streakPoints ?? 1;
            }
        } catch (e) {
            console.error("Failed to load streak points rule:", e);
        }

        if (!currentStreak) {
            // New user engagement record
            const newStreak = {
                userId,
                userName,
                streakCount: 1,
                lastVisitDate: today,
                points: streakPoints
            };
            await setDoc(docRef, newStreak);
            log.log(`Created new streak for user ${userName}`);
            return newStreak;
        }
        
        const lastVisit = currentStreak.lastVisitDate;
        let newCount = currentStreak.streakCount;
        let currentPoints = currentStreak.points || 0;
        
        if (lastVisit === today) {
            // Already visited today, keep streak and points the same
            return currentStreak;
        } else if (lastVisit === yesterday) {
            // Consecutive visit, increment streak and award points
            newCount += 1;
            currentPoints += streakPoints;
        } else {
            // Broken streak, reset to 1 and award points
            newCount = 1;
            currentPoints += streakPoints;
        }
        
        const updatedStreak = {
            ...currentStreak,
            userName, // update name if changed
            streakCount: newCount,
            lastVisitDate: today,
            points: currentPoints
        };
        
        await setDoc(docRef, updatedStreak, { merge: true });
        log.log(`Updated streak for user ${userName} to ${newCount}, points to ${currentPoints}`);
        return updatedStreak;
    } catch (error) {
        log.error('Error updating user streak:', error);
        return {
            userId,
            userName,
            streakCount: 1,
            lastVisitDate: today,
            points: 0
        };
    }
};

// 2. ATTENDANCE SERVICES
export interface AttendanceRecord {
    id?: string;
    userId: string;
    userName: string;
    date: string; // YYYY-MM-DD
    timestamp: any;
    status: 'P' | 'A' | 'W/O';
    idea?: string;
}

export const getEmployeeAttendanceForMonth = async (userId: string, year: number, month: number): Promise<AttendanceRecord[]> => {
    try {
        const monthStr = String(month).padStart(2, '0');
        const startOfMonth = `${year}-${monthStr}-01`;
        const endOfMonth = `${year}-${monthStr}-31`;

        const q = query(
            collection(db, 'attendance'),
            where('userId', '==', userId),
            where('date', '>=', startOfMonth),
            where('date', '<=', endOfMonth)
        );
        const querySnapshot = await getDocs(q);
        const records: AttendanceRecord[] = [];
        
        querySnapshot.forEach(docSnap => {
            const data = docSnap.data();
            records.push({
                id: docSnap.id,
                userId: data.userId,
                userName: data.userName,
                date: data.date,
                status: data.status || 'P',
                idea: data.idea || '',
                timestamp: data.timestamp
            });
        });
        return records;
    } catch (error) {
        log.error('Error fetching monthly attendance with range query, attempting fallback:', error);
        try {
            // Fallback: Query by userId and filter date range in memory
            const fallbackQ = query(
                collection(db, 'attendance'),
                where('userId', '==', userId)
            );
            const querySnapshot = await getDocs(fallbackQ);
            const monthStr = String(month).padStart(2, '0');
            const prefix = `${year}-${monthStr}`;
            const records: AttendanceRecord[] = [];

            querySnapshot.forEach(docSnap => {
                const data = docSnap.data();
                if (data.date && typeof data.date === 'string' && data.date.startsWith(prefix)) {
                    records.push({
                        id: docSnap.id,
                        userId: data.userId,
                        userName: data.userName,
                        date: data.date,
                        status: data.status || 'P',
                        idea: data.idea || '',
                        timestamp: data.timestamp
                    });
                }
            });
            return records;
        } catch (fallbackError) {
            log.error('Fallback attendance fetch also failed:', fallbackError);
            return [];
        }
    }
};

export const checkAttendanceMarkedForDate = async (userId: string, date: string): Promise<boolean> => {
    try {
        const q = query(
            collection(db, 'attendance'),
            where('userId', '==', userId),
            where('date', '==', date)
        );
        const querySnapshot = await getDocs(q);
        return !querySnapshot.empty;
    } catch (error) {
        log.error('Error checking attendance for date:', error);
        return false;
    }
};

export const checkAttendanceMarked = async (userId: string): Promise<boolean> => {
    return checkAttendanceMarkedForDate(userId, getLocalDateString());
};

export const markAttendanceForDate = async (
    userId: string, 
    userName: string, 
    date: string, 
    status: 'P' | 'A' | 'W/O', 
    idea = ''
): Promise<boolean> => {
    try {
        // Query to check if record exists
        const q = query(
            collection(db, 'attendance'),
            where('userId', '==', userId),
            where('date', '==', date)
        );
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            // Update existing
            const docId = querySnapshot.docs[0].id;
            await updateDoc(doc(db, 'attendance', docId), {
                status,
                idea: idea.trim(),
                timestamp: serverTimestamp()
            });
        } else {
            // Create new
            await addDoc(collection(db, 'attendance'), {
                userId,
                userName,
                date,
                status,
                idea: idea.trim(),
                timestamp: serverTimestamp()
            });
        }

        // Streak check - if marked as 'P' for today, update streak
        const today = getLocalDateString();
        if (date === today && status === 'P') {
            await updateOrCreateStreak(userId, userName);
        }

        log.log(`Attendance successfully marked for user ${userName} on ${date} as ${status}`);
        return true;
    } catch (error) {
        log.error('Error marking attendance for date:', error);
        return false;
    }
};

export const markAttendance = async (userId: string, userName: string, idea: string): Promise<boolean> => {
    return markAttendanceForDate(userId, userName, getLocalDateString(), 'P', idea);
};

// 3. COMPLAINT & GRIEVANCE SERVICES
export interface ComplaintItem {
    id: string;
    userId: string;
    userName: string;
    text: string;
    timestamp: any;
    status: 'pending' | 'in-review' | 'resolved' | 'dismissed';
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    resolvedBy?: string;
    resolutionNotes?: string;
    resolvedAt?: any;
}

export const submitComplaint = async (userId: string, userName: string, text: string, priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal'): Promise<boolean> => {
    try {
        await addDoc(collection(db, 'complaints'), {
            userId,
            userName,
            text: text.trim(),
            timestamp: serverTimestamp(),
            status: 'pending',
            priority
        });
        log.log(`Complaint submitted by ${userName}`);
        return true;
    } catch (error) {
        log.error('Error submitting complaint:', error);
        return false;
    }
};

export const subscribeToComplaints = (callback: (complaints: ComplaintItem[]) => void): (() => void) => {
    const q = query(collection(db, 'complaints'), orderBy('timestamp', 'desc'));
    return onSnapshot(q, (snapshot) => {
        const complaints: ComplaintItem[] = snapshot.docs.map(d => ({
            id: d.id,
            ...(d.data() as Omit<ComplaintItem, 'id'>)
        }));
        callback(complaints);
    }, (error) => {
        log.error('Error in complaints subscription:', error);
    });
};

export const updateComplaintStatus = async (
    complaintId: string, 
    status: 'pending' | 'in-review' | 'resolved' | 'dismissed',
    resolvedBy?: string,
    resolutionNotes?: string
): Promise<boolean> => {
    try {
        const docRef = doc(db, 'complaints', complaintId);
        const updates: any = {
            status,
            updatedAt: serverTimestamp()
        };
        if (resolvedBy) updates.resolvedBy = resolvedBy;
        if (resolutionNotes !== undefined) updates.resolutionNotes = resolutionNotes;
        if (status === 'resolved' || status === 'dismissed') {
            updates.resolvedAt = serverTimestamp();
        }
        await updateDoc(docRef, updates);
        return true;
    } catch (error) {
        log.error('Error updating complaint status:', error);
        return false;
    }
};

export const deleteComplaint = async (complaintId: string): Promise<boolean> => {
    try {
        await deleteDoc(doc(db, 'complaints', complaintId));
        return true;
    } catch (error) {
        log.error('Error deleting complaint:', error);
        return false;
    }
};

// 4. REWARD REDEMPTION SERVICES
export interface RewardRedemptionItem {
    id: string;
    userId: string;
    userName: string;
    rewardTitle: string;
    pointsSpent: number;
    timestamp: any;
    status: 'pending' | 'fulfilled' | 'rejected';
    fulfilledBy?: string;
    fulfillmentNotes?: string;
    fulfilledAt?: any;
}

export const createRewardRedemption = async (
    userId: string,
    userName: string,
    rewardTitle: string,
    pointsSpent: number
): Promise<boolean> => {
    try {
        const streakRef = doc(db, 'user_engagement', userId);
        const streakSnap = await getDoc(streakRef);
        const currentPoints = streakSnap.exists() ? (streakSnap.data().points || 0) : 0;
        
        if (currentPoints < pointsSpent) {
            log.warn(`Insufficient points for ${userId}: has ${currentPoints}, needs ${pointsSpent}`);
            return false;
        }

        const newPoints = currentPoints - pointsSpent;
        await updateDoc(streakRef, { points: newPoints });

        await addDoc(collection(db, 'reward_redemptions'), {
            userId,
            userName,
            rewardTitle,
            pointsSpent,
            status: 'pending',
            timestamp: serverTimestamp()
        });
        log.log(`Reward redemption created for ${userName}: ${rewardTitle} (${pointsSpent} pts)`);
        return true;
    } catch (error) {
        log.error('Error recording reward redemption:', error);
        return false;
    }
};

export const subscribeToRewardRedemptions = (callback: (redemptions: RewardRedemptionItem[]) => void): (() => void) => {
    const q = query(collection(db, 'reward_redemptions'), orderBy('timestamp', 'desc'));
    return onSnapshot(q, (snapshot) => {
        const redemptions: RewardRedemptionItem[] = snapshot.docs.map(d => ({
            id: d.id,
            ...(d.data() as Omit<RewardRedemptionItem, 'id'>)
        }));
        callback(redemptions);
    }, (error) => {
        log.error('Error in reward redemptions subscription:', error);
    });
};

export const updateRewardRedemptionStatus = async (
    redemptionId: string,
    status: 'pending' | 'fulfilled' | 'rejected',
    fulfilledBy?: string,
    fulfillmentNotes?: string
): Promise<boolean> => {
    try {
        const docRef = doc(db, 'reward_redemptions', redemptionId);
        const updates: any = {
            status,
            updatedAt: serverTimestamp()
        };
        if (fulfilledBy) updates.fulfilledBy = fulfilledBy;
        if (fulfillmentNotes !== undefined) updates.fulfillmentNotes = fulfillmentNotes;
        if (status === 'fulfilled' || status === 'rejected') {
            updates.fulfilledAt = serverTimestamp();
        }
        await updateDoc(docRef, updates);
        return true;
    } catch (error) {
        log.error('Error updating reward redemption status:', error);
        return false;
    }
};


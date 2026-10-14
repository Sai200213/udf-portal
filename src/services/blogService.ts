import { db, storage, auth } from '../firebase/config';
import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy, where, serverTimestamp } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { logSystemAction } from './auditService';

export interface BlogPost {
    id: string;
    category: string;
    date: string;
    readTime: string;
    title: string;
    excerpt: string;
    content: string;
    imageUrl?: string;
    timestamp?: any;
    isPinned?: boolean;
    isPrivate?: boolean;
}

export const getBlogPosts = async (): Promise<BlogPost[]> => {
    try {
        const blogCol = collection(db, 'blog_posts');
        const isAuth = !!auth?.currentUser;
        
        let q;
        if (isAuth) {
            // Authenticated users (staff/employees) can see all posts (including internal protocols)
            q = query(blogCol, orderBy('timestamp', 'desc'));
        } else {
            // Public unauthenticated visitors only fetch public posts
            q = query(blogCol, where('isPrivate', '==', false), orderBy('timestamp', 'desc'));
        }

        let snap;
        try {
            snap = await getDocs(q);
        } catch (queryErr: any) {
            // Fallback for public visitors if composite index is building: fetch without orderBy and sort in memory
            if (!isAuth) {
                const fallbackQ = query(blogCol, where('isPrivate', '==', false));
                snap = await getDocs(fallbackQ);
            } else {
                throw queryErr;
            }
        }

        const posts = snap.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                category: data.category,
                date: data.date,
                readTime: data.readTime,
                title: data.title,
                excerpt: data.excerpt || '',
                content: data.content || '',
                imageUrl: data.imageUrl,
                timestamp: data.timestamp,
                isPinned: data.isPinned || false,
                isPrivate: data.isPrivate === true
            } as BlogPost;
        });

        // Ensure descending sort by timestamp/date
        return posts.sort((a, b) => {
            const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp?.seconds ? a.timestamp.seconds * 1000 : new Date(a.date).getTime() || 0);
            const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp?.seconds ? b.timestamp.seconds * 1000 : new Date(b.date).getTime() || 0);
            return timeB - timeA;
        });
    } catch (err) {
        console.error('Error fetching blog posts:', err);
        return [];
    }
};

export const createBlogPost = async (post: Omit<BlogPost, 'id' | 'timestamp'>): Promise<string> => {
    const blogCol = collection(db, 'blog_posts');
    const docRef = await addDoc(blogCol, {
        ...post,
        isPrivate: post.isPrivate === true,
        timestamp: serverTimestamp(),
    } as any);
    await logSystemAction('CREATE', 'SYSTEM', `Published new blog post: "${post.title}" (${post.category})`);
    return docRef.id;
};

export const updateBlogPost = async (id: string, updates: Partial<Omit<BlogPost, 'id' | 'timestamp'>>): Promise<void> => {
    const docRef = doc(db, 'blog_posts', id);
    await updateDoc(docRef, {
        ...updates,
        timestamp: serverTimestamp(),
    } as any);
    await logSystemAction('UPDATE', 'SYSTEM', `Updated blog post ${id}${updates.title ? ` ("${updates.title}")` : ''}`);
};

export const deleteBlogPost = async (id: string, imageUrl?: string): Promise<void> => {
    if (imageUrl && (imageUrl.includes('firebasestorage.googleapis.com') || imageUrl.includes('storage.googleapis.com'))) {
        try {
            const storageRef = ref(storage, imageUrl);
            await deleteObject(storageRef);
        } catch (err) {
            console.warn('Could not delete storage image for blog post:', err);
        }
    }
    const docRef = doc(db, 'blog_posts', id);
    await deleteDoc(docRef);
    await logSystemAction('DELETE', 'SYSTEM', `Deleted blog post ${id}`);
};

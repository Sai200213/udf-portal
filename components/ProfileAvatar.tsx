
import React, { useState, useRef } from 'react';
import { Camera, Loader2, UserCircle, X } from 'lucide-react';
import { uploadProfilePhoto, getSecureURL } from '../src/services/storageService';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../src/firebase/config';

interface ProfileAvatarProps {
    userId: string;
    userName: string;
    currentPhotoURL?: string;
    size?: number;
    editable?: boolean;
    /** Firestore collection to update (e.g., 'employees', 'staffUsers') */
    collection?: string;
    onPhotoUpdated?: (newURL: string) => void;
}

const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
    userId,
    userName,
    currentPhotoURL,
    size = 80,
    editable = false,
    collection = 'employees',
    onPhotoUpdated,
}) => {
    const [photoURL, setPhotoURL] = useState<string | undefined>(currentPhotoURL);
    const [resolvedURL, setResolvedURL] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        let isMounted = true;
        
        const resolveUrl = async () => {
             if (!photoURL) {
                 if (isMounted) setResolvedURL(null);
                 return;
             }
             if (photoURL.startsWith('http') || photoURL.startsWith('data:')) {
                 if (isMounted) setResolvedURL(photoURL);
             } else {
                 try {
                     const url = await getSecureURL(photoURL);
                     if (isMounted) setResolvedURL(url);
                 } catch (err) {
                     console.error("Failed to load secure avatar", err);
                     if (isMounted) setResolvedURL(null);
                 }
             }
        };
        resolveUrl();
        
        return () => { isMounted = false; };
    }, [photoURL]);

    const initials = userName
        ? userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
        : '?';

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file (JPG, PNG, etc.)');
            return;
        }

        // Validate file size (max 5MB before compression)
        if (file.size > 5 * 1024 * 1024) {
            alert('Image must be less than 5MB');
            return;
        }

        setIsUploading(true);
        try {
            const downloadURL = await uploadProfilePhoto(userId, file);
            setPhotoURL(downloadURL);

            // Update Firestore
            await updateDoc(doc(db, collection, userId), {
                profilePhotoURL: downloadURL
            });

            onPhotoUpdated?.(downloadURL);
        } catch (error) {
            console.error('Failed to upload profile photo:', error);
            alert('Failed to upload photo. Please try again.');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const gradientColors = [
        'from-blue-500 to-indigo-600',
        'from-emerald-500 to-teal-600',
        'from-purple-500 to-violet-600',
        'from-orange-500 to-red-500',
        'from-cyan-500 to-blue-600',
    ];
    const colorIndex = userName.length % gradientColors.length;
    const gradient = gradientColors[colorIndex];

    return (
        <>
            <div
                className="profile-avatar-container"
                style={{ width: size, height: size, position: 'relative' }}
            >
                {/* The Avatar */}
                <div
                    onClick={() => photoURL && setShowPreview(true)}
                    style={{
                        width: size,
                        height: size,
                        borderRadius: '50%',
                        overflow: 'hidden',
                        cursor: photoURL ? 'pointer' : 'default',
                        boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                        border: '3px solid white',
                    }}
                >
                    {resolvedURL ? (
                        <img
                            src={resolvedURL}
                            alt={userName}
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                            }}
                        />
                    ) : (
                        <div
                            className={`bg-gradient-to-br ${gradient}`}
                            style={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontSize: size * 0.35,
                                fontWeight: 800,
                                letterSpacing: '1px',
                            }}
                        >
                            {initials}
                        </div>
                    )}
                </div>

                {/* Upload Overlay (only when editable) */}
                {editable && (
                    <label
                        htmlFor={`avatar-upload-${userId}`}
                        style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            width: size * 0.35,
                            height: size * 0.35,
                            borderRadius: '50%',
                            backgroundColor: '#3b82f6',
                            border: '2px solid white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: isUploading ? 'wait' : 'pointer',
                            boxShadow: '0 2px 8px rgba(59,130,246,0.4)',
                            transition: 'transform 0.2s, background-color 0.2s',
                        }}
                        className="hover:scale-110 hover:bg-blue-600"
                    >
                        {isUploading ? (
                            <Loader2 size={size * 0.18} color="white" className="animate-spin" />
                        ) : (
                            <Camera size={size * 0.18} color="white" />
                        )}
                    </label>
                )}

                <input
                    ref={fileInputRef}
                    id={`avatar-upload-${userId}`}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                    disabled={isUploading}
                />
            </div>

            {/* Full-Screen Preview Modal */}
            {showPreview && resolvedURL && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.85)',
                        zIndex: 9999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                    }}
                    onClick={() => setShowPreview(false)}
                >
                    <button
                        onClick={() => setShowPreview(false)}
                        style={{
                            position: 'absolute',
                            top: 16,
                            right: 16,
                            background: 'rgba(255,255,255,0.15)',
                            border: 'none',
                            borderRadius: '50%',
                            padding: 8,
                            cursor: 'pointer',
                        }}
                    >
                        <X size={24} color="white" />
                    </button>
                    <img
                        src={resolvedURL}
                        alt={userName}
                        style={{
                            maxWidth: '90vw',
                            maxHeight: '90vh',
                            borderRadius: 12,
                            boxShadow: '0 0 40px rgba(0,0,0,0.5)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </>
    );
};

export default ProfileAvatar;

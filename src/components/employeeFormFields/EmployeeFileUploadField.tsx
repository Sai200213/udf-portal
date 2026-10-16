import React, { useState, useEffect } from 'react';
import { EmployeeFieldProps } from '../../../types';
import Input from '../../../components/common/Input';
import { uploadSubmissionDocument, getSecureURL } from '../../services/storageService';

const EmployeeFileUploadField: React.FC<EmployeeFieldProps> = ({ field, value, onChange, error, disabled }) => {
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [securePreviewUrl, setSecurePreviewUrl] = useState<string | null>(null);

    // Attempt to load a secure preview URL if value is a storage path
    useEffect(() => {
        if (typeof value === 'string' && value.length > 0) {
            if (value.startsWith('http')) {
                setSecurePreviewUrl(value);
            } else {
                let isMounted = true;
                getSecureURL(value)
                    .then(url => {
                        if (isMounted) setSecurePreviewUrl(url);
                    })
                    .catch(err => {
                        console.log("Could not fetch secure preview link (expected if unauthenticated applicant)", err);
                        if (isMounted) setSecurePreviewUrl(null);
                    });
                return () => { isMounted = false; };
            }
        } else {
            setSecurePreviewUrl(null);
        }
    }, [value]);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        setUploadError(null);

        if (file) {
            setUploading(true);
            try {
                // Upload securely under the applicant's session folder
                const storagePath = await uploadSubmissionDocument(field.id, file);

                // Pass the secure storage path to the form state instead of the public URL
                onChange(field.id, storagePath);
            } catch (err: any) {
                console.error("Upload failed", err);
                setUploadError("Failed to upload file. Please try again.");
                onChange(field.id, null);
            } finally {
                setUploading(false);
            }
        } else {
            onChange(field.id, null);
        }
    };

    const isUploaded = typeof value === 'string' && value.length > 0;

    return (
        <div className="mb-4">
            <Input
                label={`${field.label}${field.isMandatory ? ' *' : ''}`}
                id={field.id}
                type="file"
                onChange={handleFileChange}
                required={field.isMandatory && !value} // Only required if no value present
                aria-required={field.isMandatory}
                aria-describedby={error ? `${field.id}-error` : undefined}
                error={error || uploadError || undefined}
                disabled={disabled || uploading}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />

            {uploading && (
                <p className="mt-1 text-sm text-blue-600 animate-pulse">
                    Uploading... Please wait.
                </p>
            )}

            {isUploaded && !uploading && (
                <div className="mt-2 flex items-center space-x-2">
                    <span className="text-sm text-green-600 font-medium">✅ File Uploaded</span>
                    {securePreviewUrl && (
                        <a
                            href={securePreviewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-500 hover:underline"
                        >
                            (View File)
                        </a>
                    )}
                </div>
            )}
        </div>
    );
};

export default EmployeeFileUploadField;


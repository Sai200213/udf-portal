import React, { useState, useRef, useEffect } from 'react';
import { EmployeeFieldProps } from '../../types';
import DocumentCaptureModal from '../common/DocumentCaptureModal';
import { Camera, Upload, FileText, CheckCircle2, Crop, Trash2, AlertCircle, Eye, Loader2 } from 'lucide-react';
import Button from '../common/Button';
import { ref, getBlob } from 'firebase/storage';
import { storage, ensureAuthenticated } from '../../src/firebase/config';
import { uploadSubmissionDocument, autoCompressFile } from '../../src/services/storageService';

const EmployeeFileUploadField: React.FC<EmployeeFieldProps> = ({ field, value, onChange, error, disabled }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'select' | 'camera' | 'crop'>('select');
  const [modalImageSrc, setModalImageSrc] = useState<string | null>(null);
  const [localThumbnail, setLocalThumbnail] = useState<string | null>(null);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Track created local URLs to revoke them and avoid memory leaks
  const objectUrlsRef = useRef<string[]>([]);
  const createLocalUrl = (blobOrFile: Blob | File) => {
    const url = URL.createObjectURL(blobOrFile);
    objectUrlsRef.current.push(url);
    return url;
  };

  useEffect(() => {
    return () => {
      // Revoke all created URLs on unmount
      objectUrlsRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch (e) {
          console.error("Failed to revoke URL:", e);
        }
      });
    };
  }, []);

  // Helper: format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Helper: extract original file name from storage path
  const getCleanFileName = (path: string): string => {
    if (!path) return '';
    const parts = path.split('/');
    const lastPart = parts[parts.length - 1];
    // Remove timestamp prefix e.g., 1779715159_
    const underscoreIdx = lastPart.indexOf('_');
    if (underscoreIdx !== -1) {
      return lastPart.substring(underscoreIdx + 1);
    }
    return lastPart;
  };

  // Convert local File to Data URL for thumbnail preview
  const generateThumbnail = (file: File) => {
    if (file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(file.name)) {
      const reader = new FileReader();
      reader.onload = () => {
        setLocalThumbnail(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setLocalThumbnail(null);
    }
  };

  // Resolve storage paths or Files to local/cloud urls
  useEffect(() => {
    let active = true;

    // Extract actual string path or file
    const valPath = typeof value === 'object' && value !== null && 'storagePath' in value
      ? value.storagePath
      : value;

    if (valPath instanceof File) {
      generateThumbnail(valPath);
      setResolvedUrl(null);
    } else if (typeof valPath === 'string' && valPath.trim() !== '') {
      // Check if it's already an http/data/blob URL
      if (valPath.startsWith('http') || valPath.startsWith('data:') || valPath.startsWith('blob:')) {
        const isImg = /\.(jpg|jpeg|png|webp)$/i.test(valPath) || valPath.includes('GoogleProfile') || valPath.includes('photo');
        setResolvedUrl(valPath);
        if (isImg) {
          setLocalThumbnail(valPath);
        } else {
          setLocalThumbnail(null);
        }
      } else {
        setIsResolving(true);
        const getUrl = async () => {
          try {
            const isImg = /\.(jpg|jpeg|png|webp)$/i.test(valPath);
            if (isImg) {
              await ensureAuthenticated();
              const blob = await getBlob(ref(storage, valPath));
              const localUrl = createLocalUrl(blob);
              if (active) {
                setResolvedUrl(localUrl);
                setLocalThumbnail(localUrl);
              }
            } else {
              if (active) {
                setResolvedUrl(null);
                setLocalThumbnail(null);
              }
            }
          } catch (err) {
            console.error("Failed to resolve storage URL:", err);
          } finally {
            if (active) setIsResolving(false);
          }
        };
        getUrl();
      }
    } else {
      setResolvedUrl(null);
      setLocalThumbnail(null);
    }
    return () => {
      active = false;
    };
  }, [value]);

  // Background upload logic
  const startBackgroundUpload = async (file: File) => {
    // 1. Validate file extension and MIME type
    const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(file.name);
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (!isImage && !isPdf) {
      alert("Invalid file format. Only JPG, PNG, WEBP images and PDF documents are allowed.");
      return;
    }

    // 2. Validate max size before / after compression
    const maxMB = field.maxFileSizeMB || 5;
    if (file.size > maxMB * 1024 * 1024 && !isImage) {
      alert(`File size must be less than ${maxMB}MB.`);
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    try {
      // 3. Auto-compress image files client-side before upload
      let fileToUpload = file;
      if (isImage) {
        fileToUpload = await autoCompressFile(file);
      }

      if (fileToUpload.size > maxMB * 1024 * 1024) {
        alert(`Compressed file size (${(fileToUpload.size / (1024 * 1024)).toFixed(2)}MB) exceeds limit of ${maxMB}MB.`);
        return;
      }

      const path = await uploadSubmissionDocument(
        field.id,
        fileToUpload,
        (percent) => setUploadProgress(percent)
      );
      onChange(field.id, path);
    } catch (err: any) {
      console.error("Background upload failed:", err);
      alert(`File upload failed: ${err.message || err}`);
      onChange(field.id, null);
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  // Handle direct file upload selection
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(file.name)) {
      // It's an image: automatically prompt them to crop it!
      const reader = new FileReader();
      reader.onload = () => {
        setModalImageSrc(reader.result as string);
        setModalMode('crop');
        setIsModalOpen(true);
      };
      reader.readAsDataURL(file);
    } else {
      // It's a PDF: background upload
      startBackgroundUpload(file);
    }
    // Reset file input value so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle Drag & Drop
  const [isDragging, setIsDragging] = useState(false);
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => {
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(file.name)) {
      const reader = new FileReader();
      reader.onload = () => {
        setModalImageSrc(reader.result as string);
        setModalMode('crop');
        setIsModalOpen(true);
      };
      reader.readAsDataURL(file);
    } else {
      startBackgroundUpload(file);
    }
  };

  // Callback when DocumentCaptureModal crop is saved
  const handleModalConfirm = (croppedFile: File) => {
    startBackgroundUpload(croppedFile);
  };

  // Open cropper for existing local image
  const handleOpenExistingCropper = () => {
    if (localThumbnail && !(typeof value === 'string')) {
      setModalImageSrc(localThumbnail);
      setModalMode('crop');
      setIsModalOpen(true);
    } else if (value instanceof File) {
      const reader = new FileReader();
      reader.onload = () => {
        setModalImageSrc(reader.result as string);
        setModalMode('crop');
        setIsModalOpen(true);
      };
      reader.readAsDataURL(value);
    }
  };

  // Support both direct path strings and objects of shape { storagePath, driveUrl }
  const valPath = typeof value === 'object' && value !== null && 'storagePath' in value
    ? value.storagePath
    : (typeof value === 'string' ? value : null);

  const isStringVal = typeof valPath === 'string';
  const fileName = isStringVal ? getCleanFileName(valPath) : (value instanceof File ? value.name : '');
  const fileSize = value instanceof File ? value.size : 0;
  const isImage = (isStringVal && /\.(jpg|jpeg|png|webp)$/i.test(valPath)) || (value instanceof File && value.type.startsWith('image/')) || localThumbnail !== null;

  return (
    <div className="mb-6 animate-in fade-in duration-200">
      <label className="text-sm font-semibold text-gray-700 mb-2 block flex items-center justify-between">
        <span>
          {field.label}
          {field.isMandatory && <span className="text-red-500 ml-1">*</span>}
        </span>
        {field.maxFileSizeMB && (
          <span className="text-xs font-normal text-gray-400">Max size: {field.maxFileSizeMB}MB</span>
        )}
      </label>

      {/* Hidden native input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*,application/pdf"
        className="hidden"
        disabled={disabled || isUploading || isResolving}
      />

      {/* NO FILE SELECTED STATE */}
      {!value && !isUploading ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
            isDragging
              ? 'border-blue-500 bg-blue-50/50'
              : error
              ? 'border-red-300 bg-red-50/30'
              : 'border-gray-300 hover:border-blue-400 bg-gray-50/40 hover:bg-gray-50/70'
          }`}
        >
          <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-gray-150 flex items-center justify-center mx-auto mb-4 text-gray-400">
            <Upload size={22} />
          </div>

          <p className="text-sm font-medium text-gray-700 mb-1">
            Drag and drop document, or capture using your camera
          </p>
          <p className="text-xs text-gray-400 mb-5">
            Supports PDF, JPG, PNG & WebP
          </p>

          <div className="flex flex-wrap gap-3 justify-center items-center">
            <Button
              type="button"
              onClick={() => {
                setModalMode('camera');
                setModalImageSrc(null);
                setIsModalOpen(true);
              }}
              variant="secondary"
              size="sm"
              disabled={disabled || isResolving}
              className="bg-white hover:bg-gray-50 text-blue-600 border-blue-200 hover:border-blue-300 flex items-center gap-2 rounded-xl py-2 px-4 shadow-sm"
            >
              <Camera size={16} />
              Use Camera Scanner
            </Button>

            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              variant="secondary"
              size="sm"
              disabled={disabled || isResolving}
              className="bg-white hover:bg-gray-50 text-gray-700 border-gray-250 flex items-center gap-2 rounded-xl py-2 px-4 shadow-sm"
            >
              <Upload size={16} />
              Choose File
            </Button>
          </div>
        </div>
      ) : isUploading ? (
        /* UPLOADING STATE */
        <div className="border-2 border-dashed rounded-2xl p-6 text-center bg-blue-50/20 border-blue-200 flex flex-col items-center justify-center">
          <Loader2 size={32} className="animate-spin text-blue-500 mb-2" />
          <p className="text-sm font-medium text-blue-700">Uploading to secure draft storage...</p>
          {uploadProgress !== null && (
            <div className="w-48 bg-gray-200 h-1.5 rounded-full mt-3 overflow-hidden mx-auto">
              <div
                className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          )}
        </div>
      ) : (
        /* FILE SELECTED / COMPLETED STATE */
        <div className={`border-2 rounded-2xl p-4 bg-white flex flex-col md:flex-row items-center gap-4 shadow-sm transition-all ${
          error ? 'border-red-300' : 'border-gray-200 hover:border-gray-300'
        }`}>
          {/* File Thumbnail Preview */}
          <div className="w-20 h-20 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0 relative group">
            {isResolving ? (
              <Loader2 size={20} className="animate-spin text-gray-400" />
            ) : isImage && localThumbnail ? (
              <img
                src={localThumbnail}
                alt="Document Thumbnail"
                className="w-full h-full object-cover rounded-xl"
              />
            ) : (
              <div className="text-red-500 flex flex-col items-center gap-1">
                <FileText size={28} />
                <span className="text-[10px] font-bold uppercase tracking-wider">PDF</span>
              </div>
            )}
          </div>

          {/* File Metadata */}
          <div className="flex-1 min-w-0 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
              <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />
              <span className="text-sm font-semibold text-gray-800 truncate block">
                {fileName}
              </span>
            </div>
            <p className="text-xs text-gray-400 font-mono">
              {isResolving ? 'Resolving secure link...' : (fileSize > 0 ? formatFileSize(fileSize) : 'Cloud Draft Sync Complete')}
            </p>
            {isImage && !isStringVal && (
              <p className="text-[11px] text-amber-600 font-medium mt-1.5 flex items-center justify-center md:justify-start gap-1">
                <AlertCircle size={12} />
                Verify cropping and rotation for OCR text clarity
              </p>
            )}
          </div>

          {/* Interactive Document Toolbar */}
          <div className="flex items-center gap-2 flex-shrink-0 w-full md:w-auto justify-center">
            {value && (
              <Button
                type="button"
                onClick={async () => {
                  const valPath = typeof value === 'object' && value !== null && 'storagePath' in value
                    ? value.storagePath
                    : value;

                  if (valPath instanceof File) {
                    const localUrl = createLocalUrl(valPath);
                    window.open(localUrl, '_blank', 'noopener,noreferrer');
                  } else if (typeof valPath === 'string') {
                    if (valPath.startsWith('http') || valPath.startsWith('data:') || valPath.startsWith('blob:')) {
                      window.open(valPath, '_blank', 'noopener,noreferrer');
                    } else if (resolvedUrl) {
                      window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
                    } else {
                      setIsResolving(true);
                      try {
                        await ensureAuthenticated();
                        const blob = await getBlob(ref(storage, valPath));
                        const localUrl = createLocalUrl(blob);
                        setResolvedUrl(localUrl);
                        window.open(localUrl, '_blank', 'noopener,noreferrer');
                      } catch (err) {
                        console.error("Failed to view secure document:", err);
                        alert("Failed to view document.");
                      } finally {
                        setIsResolving(false);
                      }
                    }
                  }
                }}
                variant="secondary"
                size="sm"
                className="bg-white hover:bg-gray-50 text-blue-600 border-blue-200 hover:border-blue-300 flex items-center gap-2 rounded-xl py-2 px-3.5 shadow-sm"
              >
                <Eye size={14} />
                {isResolving ? 'Loading...' : 'View File'}
              </Button>
            )}

            {isImage && !isStringVal && (
              <Button
                type="button"
                onClick={handleOpenExistingCropper}
                variant="secondary"
                size="sm"
                disabled={disabled}
                className="bg-white hover:bg-gray-50 text-blue-600 border-blue-200 hover:border-blue-300 flex items-center gap-2 rounded-xl py-2 px-3.5 shadow-sm"
              >
                <Crop size={14} />
                Crop / Adjust
              </Button>
            )}

            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              variant="secondary"
              size="sm"
              disabled={disabled || isUploading || isResolving}
              className="bg-white hover:bg-gray-50 text-gray-700 border-gray-250 flex items-center gap-2 rounded-xl py-2 px-3.5 shadow-sm"
              title="Replace this document with another file"
            >
              <Upload size={14} />
              Replace
            </Button>

            <Button
              type="button"
              onClick={() => {
                if (fileInputRef.current) fileInputRef.current.value = '';
                onChange(field.id, null);
                setLocalThumbnail(null);
                setResolvedUrl(null);
              }}
              variant="secondary"
              size="sm"
              disabled={disabled || isUploading || isResolving}
              className="bg-white hover:bg-red-50 text-red-600 border-red-100 hover:border-red-200 flex items-center gap-2 rounded-xl py-2 px-3.5 shadow-sm"
            >
              <Trash2 size={14} />
              Remove
            </Button>
          </div>
        </div>
      )}

      {/* Validation Feedback */}
      {error && (
        <p className="mt-1.5 text-xs text-red-600 font-medium flex items-center gap-1" id={`${field.id}-error`}>
          <AlertCircle size={12} />
          {error}
        </p>
      )}

      {/* Document Scanner & Crop Modal Frame */}
      <DocumentCaptureModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleModalConfirm}
        fieldLabel={field.label}
        maxSizeMB={field.maxFileSizeMB}
        initialMode={modalMode}
        initialImageSrc={modalImageSrc}
      />
    </div>
  );
};

export default EmployeeFileUploadField;

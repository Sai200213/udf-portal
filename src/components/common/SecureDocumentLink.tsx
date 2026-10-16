import React, { useState, useEffect } from 'react';
import { getSecureURL, revokeSecureURL } from '../../services/storageService';
import { Loader2, XCircle, FileText, ImageIcon } from 'lucide-react';

interface SecureDocumentLinkProps {
  path?: string | any;
  fileUrl?: string | any;
  className?: string;
  fallbackText?: string;
  children?: React.ReactNode;
}

const isSafeUrl = (urlStr: string): boolean => {
  const lower = urlStr.toLowerCase().trim();
  if (lower.startsWith('javascript:') || lower.startsWith('vbscript:')) {
    return false;
  }
  return lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('data:') || lower.startsWith('blob:');
};

const SecureDocumentLink: React.FC<SecureDocumentLinkProps> = ({ 
  path: rawPath, 
  fileUrl,
  className = "inline-flex items-center px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-all border border-blue-100 font-bold text-xs uppercase shadow-sm group",
  fallbackText = "Document unavailable",
  children
}) => {
  const [loading, setLoading] = useState(false);

  // Sanitize: extract storagePath or path from object or string
  const target = rawPath ?? fileUrl;
  const path = typeof target === 'object' && target !== null
    ? ((target as any).storagePath || (target as any).path || (target as any).url || (target as any).downloadUrl || (target as any).fileUrl || '')
    : (typeof target === 'string' ? target : '');

  const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (!path) return;

    setLoading(true);
    try {
      const resolvedUrl = await getSecureURL(path);
      if (resolvedUrl && isSafeUrl(resolvedUrl)) {
        window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
        // Revoke temporary blob URL after 60s so new tab has rendered it without permanently leaking memory
        if (resolvedUrl.startsWith('blob:')) {
          setTimeout(() => {
            revokeSecureURL(resolvedUrl);
          }, 60000);
        }
      } else {
        alert("Document URL could not be resolved or is invalid.");
      }
    } catch (err) {
      console.error("Failed to view secure document:", err);
      alert("Failed to view document.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <span className="text-xs text-gray-400 italic flex items-center">
        <Loader2 size={12} className="animate-spin mr-1"/> Fetching document...
      </span>
    );
  }
  
  if (!path) {
    return (
      <span className="text-xs text-red-500 italic flex items-center">
        <XCircle size={12} className="mr-1"/> {fallbackText}
      </span>
    );
  }

  const isBase64 = path?.startsWith('data:');

  return (
    <a
      href="#"
      onClick={handleClick}
      className={className}
    >
      {children || (
        <>
          <FileText size={14} className="mr-2 text-blue-500 group-hover:scale-110 transition-transform" /> 
          View Document {isBase64 ? '(Local)' : ''}
        </>
      )}
    </a>
  );
};

export default SecureDocumentLink;

interface SecureImageProps {
  path: string;
  className?: string;
  alt?: string;
}

export const SecureImage: React.FC<SecureImageProps> = ({ path: rawPath, className, alt }) => {
  const [url, setUrl] = useState<string | null>(null);

  // Sanitize: extract storagePath from object if accidentally passed
  const path = typeof rawPath === 'object' && rawPath !== null && 'storagePath' in (rawPath as any)
    ? (rawPath as any).storagePath
    : (typeof rawPath === 'string' ? rawPath : '');

  useEffect(() => {
    let isMounted = true;
    let blobUrlToRevoke: string | null = null;

    if (!path) {
      if (isMounted) setUrl(null);
      return;
    }
    
    if (path.startsWith('http') || path.startsWith('data:')) {
      if (isMounted) setUrl(path);
    } else {
      getSecureURL(path)
        .then(signedUrl => {
          if (isMounted) {
            setUrl(signedUrl);
            if (signedUrl && signedUrl.startsWith('blob:')) {
              blobUrlToRevoke = signedUrl;
            }
          } else {
            revokeSecureURL(signedUrl);
          }
        })
        .catch(err => {
          console.error("Failed to fetch secure image", err);
          if (isMounted) setUrl(null);
        });
    }

    return () => { 
      isMounted = false; 
      if (blobUrlToRevoke) {
        revokeSecureURL(blobUrlToRevoke);
      }
    };
  }, [path]);

  if (!url) {
    return <div className={`animate-pulse bg-gray-200 border border-gray-300 flex items-center justify-center ${className}`}>
        <ImageIcon size={24} className="text-gray-400 opacity-20" />
    </div>;
  }
  
  return <img src={url} alt={alt} className={className} />;
};

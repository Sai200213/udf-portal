import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, RotateCw, Check, X, RefreshCw, Lock, Unlock, Wand2, AlertTriangle } from 'lucide-react';
import Button from './Button';
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { checkImageBlurry, detectDocumentBounds } from '../../utils/imageScanner';

interface DocumentCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (croppedFile: File) => void;
  fieldLabel: string;
  maxSizeMB?: number;
  initialMode?: 'select' | 'camera' | 'crop';
  initialImageSrc?: string | null;
}

// Helper to rotate the source image using an offscreen canvas
const rotateImage = (src: string, degrees: number): Promise<string> => {
  return new Promise((resolve) => {
    if (degrees === 0) {
      resolve(src);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(src);
        return;
      }
      
      if (degrees % 180 === 0) {
        canvas.width = img.width;
        canvas.height = img.height;
      } else {
        canvas.width = img.height;
        canvas.height = img.width;
      }
      
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((degrees * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      
      resolve(canvas.toDataURL('image/jpeg', 0.95));
    };
    img.onerror = () => {
      resolve(src);
    };
  });
};

const isSafeUrl = (urlStr: string): boolean => {
  const lower = urlStr.toLowerCase().trim();
  if (lower.startsWith('javascript:') || lower.startsWith('vbscript:')) {
    return false;
  }
  return lower.startsWith('data:') || lower.startsWith('blob:') || lower.startsWith('http://') || lower.startsWith('https://');
};

export const DocumentCaptureModal: React.FC<DocumentCaptureModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  fieldLabel,
  maxSizeMB = 5,
  initialMode = 'select',
  initialImageSrc = null,
}) => {
  const [mode, setMode] = useState<'select' | 'camera' | 'crop'>(initialMode);
  const [imageSrc, setImageSrc] = useState<string | null>(initialImageSrc);
  const [rotatedImageSrc, setRotatedImageSrc] = useState<string | null>(null);
  const safeImageSrc = rotatedImageSrc && isSafeUrl(rotatedImageSrc) ? rotatedImageSrc : '';
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraLoading, setIsCameraLoading] = useState(false);

  // Crop-specific states
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [lockAspect, setLockAspect] = useState<boolean>(false);
  const [rotation, setRotation] = useState<number>(0); // 0, 90, 180, 270

  // Blur & Auto-crop states
  const [isBlurry, setIsBlurry] = useState<boolean>(false);
  const [blurScore, setBlurScore] = useState<number>(0);
  const [detectedBounds, setDetectedBounds] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Sync state when modal opens or props change
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setImageSrc(initialImageSrc);
      setRotatedImageSrc(null);
      setRotation(0);
      setCrop(undefined);
      setCompletedCrop(null);
      setLockAspect(false);
      setIsBlurry(false);
      setBlurScore(0);
      setDetectedBounds(null);
      setScanError(null);
    }
  }, [isOpen, initialMode, initialImageSrc]);

  // Dynamically generate the pre-rotated image when imageSrc or rotation changes
  useEffect(() => {
    if (imageSrc) {
      rotateImage(imageSrc, rotation).then((res) => {
        if (isSafeUrl(res)) {
          setRotatedImageSrc(res);
        }
      });
    } else {
      setRotatedImageSrc(null);
    }
  }, [imageSrc, rotation]);

  // Determine Aspect Ratio based on document type
  const isIdCard =
    fieldLabel.toLowerCase().includes('pan') ||
    fieldLabel.toLowerCase().includes('aadhar') ||
    fieldLabel.toLowerCase().includes('aadhaar') ||
    fieldLabel.toLowerCase().includes('id card') ||
    fieldLabel.toLowerCase().includes('photo') ||
    fieldLabel.toLowerCase().includes('passport');

  // ID Card ~ 1.586 (85.6mm x 53.98mm), otherwise A4 ~ 0.707 (vertical)
  const targetAspectRatio = isIdCard ? 1.586 : 0.707;

  // List available video input devices (cameras)
  useEffect(() => {
    if (mode === 'camera' && isOpen) {
      navigator.mediaDevices.enumerateDevices()
        .then(devices => {
          const videoDevices = devices.filter(d => d.kind === 'videoinput');
          setCameras(videoDevices);
          if (videoDevices.length > 0 && !selectedCamera) {
            // Prefer back camera (environment) if available
            const backCam = videoDevices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment'));
            setSelectedCamera(backCam ? backCam.deviceId : videoDevices[0].deviceId);
          }
        })
        .catch(err => {
          console.error("Error listing cameras:", err);
        });
    }
  }, [mode, isOpen]);

  // Start Camera Stream
  const startCamera = async (deviceId?: string) => {
    setIsCameraLoading(true);
    setCameraError(null);
    stopCamera();

    const constraints: MediaStreamConstraints = {
      video: deviceId
        ? { deviceId: { exact: deviceId } }
        : { facingMode: { ideal: 'environment' } }
    };

    // Standard high resolution target
    if (typeof constraints.video === 'object') {
      constraints.video.width = { ideal: 1920 };
      constraints.video.height = { ideal: 1080 };
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      setCameraError("Unable to access camera. Please upload your document instead.");
      setMode('select');
    } finally {
      setIsCameraLoading(false);
    }
  };

  // Stop Camera Stream
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Handle camera mode activation
  useEffect(() => {
    if (mode === 'camera' && isOpen) {
      startCamera(selectedCamera || undefined);
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [mode, selectedCamera, isOpen]);

  // Capture Photo from video stream
  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    // Create a high quality offscreen canvas to capture the frame
    const captureCanvas = document.createElement('canvas');
    captureCanvas.width = video.videoWidth;
    captureCanvas.height = video.videoHeight;

    const ctx = captureCanvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
      const dataUrl = captureCanvas.toDataURL('image/jpeg', 0.95);
      setImageSrc(dataUrl);
      setMode('crop');
      setRotation(0);
    }
  };

  // Handle File Input select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setMode('crop');
      setRotation(0);
    };
    reader.readAsDataURL(file);
  };

  // Perform actual Crop Operation and output Cropped File
  const handleSaveCrop = () => {
    if (!rotatedImageSrc) return;

    const img = imgRef.current;
    if (!img) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!completedCrop || completedCrop.width === 0 || completedCrop.height === 0) {
      // If no crop selection is made, save the entire (potentially rotated) image
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    } else {
      // Scale coordinates from screen dimensions to natural high-res image dimensions
      const scaleX = img.naturalWidth / img.width;
      const scaleY = img.naturalHeight / img.height;

      canvas.width = completedCrop.width * scaleX;
      canvas.height = completedCrop.height * scaleY;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.drawImage(
        img,
        completedCrop.x * scaleX,
        completedCrop.y * scaleY,
        completedCrop.width * scaleX,
        completedCrop.height * scaleY,
        0,
        0,
        canvas.width,
        canvas.height
      );
    }

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const croppedFile = new File([blob], `cropped_${fieldLabel.toLowerCase().replace(/\s+/g, '_')}.jpg`, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          onConfirm(croppedFile);
          onClose();
        }
      },
      'image/jpeg',
      0.92 // high JPEG quality
    );
  };

  // Re-apply detected bounds crop
  const applyAutoCrop = () => {
    if (!detectedBounds || !imgRef.current) return;
    const img = imgRef.current;
    const { width, height } = img;

    const targetX = detectedBounds.x * width;
    const targetY = detectedBounds.y * height;
    const targetW = detectedBounds.width * width;
    const targetH = detectedBounds.height * height;

    const initialCrop: Crop = {
      unit: 'px',
      width: targetW,
      height: targetH,
      x: targetX,
      y: targetY,
    };
    setCrop(initialCrop);
    setCompletedCrop({
      unit: 'px',
      width: targetW,
      height: targetH,
      x: targetX,
      y: targetY,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backdropFilter: 'blur(10px)', backgroundColor: 'rgba(15, 23, 42, 0.85)' }}>
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col h-[85vh] text-slate-100">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white tracking-wide">Document Capture Scanner</h3>
            <p className="text-xs text-slate-400 mt-0.5">Capturing & cropping for: <strong className="text-blue-400">{fieldLabel}</strong></p>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white hover:bg-slate-800 p-2 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body / Main Workspace */}
        <div className="flex-1 relative bg-slate-950 flex flex-col justify-center items-center overflow-hidden">
          
          {/* 1. SELECTION MODE */}
          {mode === 'select' && (
            <div className="p-8 text-center max-w-md w-full animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 bg-blue-900/40 text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-blue-800/60 shadow-lg">
                <Camera size={32} />
              </div>
              <h4 className="text-xl font-bold text-white mb-2">Upload Clear Document</h4>
              <p className="text-sm text-slate-400 mb-8 leading-relaxed">
                Ensure the document is laid flat on a dark background, in a well-lit area, with all 4 edges visible. No blurred or cropped images.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  onClick={() => setMode('camera')}
                  variant="primary"
                  className="bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2.5 py-3 rounded-xl shadow-lg shadow-blue-500/20"
                >
                  <Camera size={18} />
                  Use Camera Scanner
                </Button>
                
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
                <Button 
                  onClick={() => fileInputRef.current?.click()}
                  variant="secondary"
                  className="bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200 flex items-center justify-center gap-2.5 py-3 rounded-xl"
                >
                  <Upload size={18} />
                  Choose File Upload
                </Button>
              </div>
            </div>
          )}

          {/* 2. LIVE CAMERA SCANNER */}
          {mode === 'camera' && (
            <div className="relative w-full h-full flex flex-col animate-in fade-in duration-300">
              
              {/* Camera Preview Video Stream */}
              <div className="flex-1 w-full relative bg-black flex items-center justify-center overflow-hidden">
                <video 
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Clean, unobstructed framing guide (no dark mask or restrictive cutout) */}
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-4 sm:p-6">
                  {/* Top Guidance Pill */}
                  <div className="px-4 py-1.5 rounded-full bg-slate-900/75 backdrop-blur-md text-white text-xs font-medium flex items-center gap-2 border border-white/20 shadow-md select-none">
                    <Camera size={14} className="text-blue-400" />
                    <span>Center document in camera view & hold steady</span>
                  </div>

                  {/* Subtle Viewfinder Framing Brackets */}
                  <div className="w-full h-full max-w-2xl relative flex-1 my-3 sm:my-4 border border-white/15 rounded-2xl flex flex-col justify-between p-2">
                    {/* Top Corner Accents */}
                    <div className="flex justify-between items-start">
                      <div className="w-7 h-7 border-t-2 border-l-2 border-blue-400 rounded-tl-lg"></div>
                      <div className="w-7 h-7 border-t-2 border-r-2 border-blue-400 rounded-tr-lg"></div>
                    </div>
                    {/* Bottom Corner Accents */}
                    <div className="flex justify-between items-end">
                      <div className="w-7 h-7 border-b-2 border-l-2 border-blue-400 rounded-bl-lg"></div>
                      <div className="w-7 h-7 border-b-2 border-r-2 border-blue-400 rounded-br-lg"></div>
                    </div>
                  </div>

                  {/* Bottom helper pill */}
                  <div className="text-slate-300 text-[11px] font-medium bg-slate-900/60 backdrop-blur-sm px-3.5 py-1 rounded-full shadow-sm select-none">
                    Full document preview • You can crop & rotate after capturing
                  </div>
                </div>

                {isCameraLoading && (
                  <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-3">
                    <RefreshCw size={36} className="animate-spin text-blue-500" />
                    <p className="text-sm font-semibold text-slate-300">Initializing camera sensor...</p>
                  </div>
                )}
              </div>

              {/* Camera Action Toolbar */}
              <div className="px-6 py-5 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row items-center gap-4 justify-between w-full">
                
                {/* Camera Selection Selector */}
                {cameras.length > 1 ? (
                  <select 
                    value={selectedCamera}
                    onChange={(e) => setSelectedCamera(e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[200px]"
                  >
                    {cameras.map((cam, idx) => (
                      <option key={cam.deviceId} value={cam.deviceId}>
                        {cam.label || `Camera ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                ) : <div className="hidden sm:block w-[180px]"></div>}

                {/* Shutter Capture Button */}
                <button 
                  onClick={capturePhoto}
                  className="w-16 h-16 rounded-full bg-white text-slate-900 flex items-center justify-center border-4 border-slate-700 hover:bg-slate-100 hover:scale-105 active:scale-95 transition-all shadow-lg"
                >
                  <Camera size={26} className="text-slate-900" />
                </button>

                {/* Retake / Switch Mode Button */}
                <Button 
                  onClick={() => setMode('select')}
                  variant="secondary"
                  size="sm"
                  className="border-slate-700 hover:bg-slate-800 text-slate-300 rounded-xl"
                >
                  Choose File Upload
                </Button>
              </div>
            </div>
          )}

          {/* 3. CROP EDITOR */}
          {mode === 'crop' && (
            <div className="relative w-full h-full flex flex-col animate-in fade-in duration-300 overflow-hidden">
              
              {/* Interactive Cropper Viewport */}
              <div className="flex-1 w-full relative bg-slate-950 flex items-center justify-center p-6 overflow-auto">
                {rotatedImageSrc ? (
                  <div className="flex flex-col items-center justify-center w-full max-h-full">
                    <ReactCrop
                      crop={crop}
                      onChange={(c) => setCrop(c)}
                      onComplete={(c) => setCompletedCrop(c)}
                      aspect={lockAspect ? targetAspectRatio : undefined}
                      className="max-h-[50vh] max-w-full"
                    >
                      <img 
                        ref={imgRef}
                        src={safeImageSrc}
                        alt="Crop source"
                        className="max-h-[50vh] object-contain select-none shadow-2xl border border-slate-800"
                        onLoad={(e) => {
                          try {
                            const img = e.currentTarget;

                            // Guard: ensure image is fully decoded with real dimensions
                            if (!img.naturalWidth || !img.naturalHeight) {
                              console.warn('[Scanner] Image not ready — naturalWidth is 0, skipping analysis');
                              return;
                            }

                            // Use display dimensions for crop coordinate mapping
                            const { width, height } = img;

                            // 1. Run blur detection
                            const blurResult = checkImageBlurry(img);
                            setIsBlurry(blurResult.isBlurry);
                            setBlurScore(blurResult.score);

                            // 2. Run document bounds detection
                            const bounds = detectDocumentBounds(img);
                            setDetectedBounds(bounds);

                            if (bounds) {
                              // Auto-apply detected boundary
                              const targetX = bounds.x * width;
                              const targetY = bounds.y * height;
                              const targetW = bounds.width * width;
                              const targetH = bounds.height * height;

                              const initialCrop: Crop = {
                                unit: 'px',
                                width: targetW,
                                height: targetH,
                                x: targetX,
                                y: targetY,
                              };
                              setCrop(initialCrop);
                              setCompletedCrop({
                                unit: 'px',
                                width: targetW,
                                height: targetH,
                                x: targetX,
                                y: targetY,
                              });
                            } else {
                              // Fallback to default crop (centered rect covering 85%)
                              const cropW = width * 0.85;
                              const cropH = lockAspect ? cropW / targetAspectRatio : height * 0.85;
                              const finalH = cropH > height ? height * 0.85 : cropH;
                              const finalW = lockAspect ? finalH * targetAspectRatio : cropW;

                              const initialCrop: Crop = {
                                unit: 'px',
                                width: finalW,
                                height: finalH,
                                x: (width - finalW) / 2,
                                y: (height - finalH) / 2,
                              };
                              setCrop(initialCrop);
                              setCompletedCrop({
                                unit: 'px',
                                width: finalW,
                                height: finalH,
                                x: (width - finalW) / 2,
                                y: (height - finalH) / 2,
                              });
                            }
                            setScanError(null);
                          } catch (err: any) {
                            console.error("Scan analysis failed:", err);
                            setScanError(err.message || String(err));
                          }
                        }}
                      />
                    </ReactCrop>

                    {/* Scanner Debug Stats Panel */}
                    <div className="absolute top-4 left-4 bg-slate-900/90 border border-slate-700/80 text-[10px] text-slate-300 font-mono p-2.5 rounded-xl pointer-events-none z-10 shadow-lg flex flex-col space-y-1">
                      <div>Blur Score: <span className={isBlurry ? 'text-red-400 font-bold' : 'text-green-400 font-bold'}>{blurScore}</span> ({isBlurry ? 'Blurry' : 'Sharp'})</div>
                      <div>Document Bounds: <span className={detectedBounds ? 'text-green-400 font-bold' : 'text-amber-400 font-bold'}>{detectedBounds ? 'Detected' : 'Not Found'}</span></div>
                      {scanError && <div className="text-red-400 max-w-[200px] break-words">Error: {scanError}</div>}
                    </div>

                    {isBlurry && (
                      <div className="mt-4 bg-red-950/70 border border-red-800/80 rounded-xl p-3 flex items-start space-x-3 text-red-200 text-xs w-full max-w-md animate-in slide-in-from-bottom duration-300">
                        <AlertTriangle className="text-red-400 flex-shrink-0 mt-0.5" size={16} />
                        <div>
                          <strong className="text-red-300 font-bold">Warning: Blurry Image Detected (Score: {blurScore})</strong>
                          <p className="text-red-400/90 mt-0.5">The scan appears out of focus. Please ensure the document text is sharp and fully legible before confirming.</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3">
                    <RefreshCw size={36} className="animate-spin text-blue-500" />
                    <p className="text-sm font-semibold text-slate-300">Processing image orientation...</p>
                  </div>
                )}
              </div>

              {/* Crop Controls & Sliders */}
              <div className="px-6 py-5 bg-slate-900 border-t border-slate-800 space-y-4 w-full">
                
                {/* Micro Adjustment Controls */}
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                  
                  {/* Aspect Ratio Lock Toggle */}
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <Button 
                      onClick={() => setLockAspect(prev => !prev)}
                      variant="secondary"
                      size="sm"
                      className={`flex items-center gap-2 rounded-xl py-2 px-4 transition-all duration-200 ${
                        lockAspect 
                          ? 'bg-blue-600 hover:bg-blue-700 border-blue-500 text-white' 
                          : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                      }`}
                    >
                      {lockAspect ? <Lock size={14} /> : <Unlock size={14} />}
                      {lockAspect ? 'Locked Aspect Ratio' : 'Flexible Aspect Ratio'}
                    </Button>
                    <span className="text-xs text-slate-400 hidden sm:inline">
                      {lockAspect ? `Enforces clean ${isIdCard ? 'ID card' : 'document'} proportions` : 'Crop from any edge freely'}
                    </span>
                  </div>

                  {/* Rotate & Auto-Crop Controls */}
                  <div className="flex items-center gap-3">
                    {detectedBounds && (
                      <Button 
                        onClick={applyAutoCrop}
                        variant="secondary"
                        size="sm"
                        className="bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 flex items-center gap-2 rounded-xl py-2 px-4"
                        title="Auto-detect document edges and crop"
                      >
                        <Wand2 size={14} className="text-blue-400 animate-pulse" />
                        Auto-Crop
                      </Button>
                    )}
                    <Button 
                      onClick={() => setRotation(r => (r + 90) % 360)}
                      variant="secondary"
                      size="sm"
                      className="bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 flex items-center gap-2 rounded-xl py-2 px-4"
                    >
                      <RotateCw size={14} />
                      Rotate 90°
                    </Button>
                    <span className="text-xs text-slate-400 font-medium">Drag any edge or corner to resize</span>
                  </div>
                </div>

                {/* Footer Confirm & Retake Buttons */}
                <div className="flex gap-3 border-t border-slate-800 pt-4">
                  <Button 
                    onClick={handleSaveCrop}
                    variant="primary"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold shadow-lg shadow-blue-500/20"
                  >
                    <Check size={18} />
                    Confirm & Save Crop
                  </Button>
                  
                  <Button 
                    onClick={() => {
                      setMode('select');
                      setImageSrc(null);
                      setRotatedImageSrc(null);
                    }}
                    variant="secondary"
                    className="bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 px-6 rounded-xl"
                  >
                    Retake / Choose Another
                  </Button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default DocumentCaptureModal;

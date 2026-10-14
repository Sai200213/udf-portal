import React, { useState, useMemo } from 'react';
import { SubmittedFormData, FormSection, FieldType, FormField } from '../../types';
import Button from '../common/Button';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, ChevronRight, ChevronLeft, User, FileUp, ClipboardList } from 'lucide-react';

interface DocumentUploadWizardProps {
    employeeData: SubmittedFormData;
    formSections: FormSection[];
    onUpload: (fieldId: string, file: File) => Promise<string>;
    onComplete: (updatedData?: Record<string, any>) => Promise<void>;
}

type WizardStep = 'details' | 'documents' | 'review';

const DocumentUploadWizard: React.FC<DocumentUploadWizardProps> = ({
    employeeData,
    formSections,
    onUpload,
    onComplete
}) => {
    const [step, setStep] = useState<WizardStep>('details');
    const [formData, setFormData] = useState<Record<string, any>>(() => {
        const initial: Record<string, any> = {};
        formSections.forEach(section => {
            section.fields.forEach(field => {
                // Pre-fill from employeeData.data or employeeData.profileData or fallback to empty string
                initial[field.id] = employeeData.data?.[field.id] || employeeData.profileData?.[field.id] || '';
            });
        });
        return initial;
    });

    const [uploads, setUploads] = useState<Record<string, { file: File | null; status: 'idle' | 'uploading' | 'success' | 'error'; error?: string; url?: string }>>({});
    const [isFinishing, setIsFinishing] = useState(false);
    const [globalError, setGlobalError] = useState<string | null>(null);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

    // Filter fields by type
    const detailFieldsBySection = useMemo(() => {
        return formSections.map(section => ({
            ...section,
            fields: section.fields.filter(f => f.type !== FieldType.FILE_UPLOAD)
        })).filter(section => section.fields.length > 0);
    }, [formSections]);

    const documentFields = useMemo(() => {
        const fields: FormField[] = [];
        formSections.forEach(section => {
            section.fields.forEach(field => {
                if (field.type === FieldType.FILE_UPLOAD) {
                    fields.push(field);
                }
            });
        });
        return fields;
    }, [formSections]);

    const handleFieldChange = (fieldId: string, value: any) => {
        setFormData(prev => ({
            ...prev,
            [fieldId]: value
        }));
        // Clear validation error when modified
        if (validationErrors[fieldId]) {
            setValidationErrors(prev => {
                const copy = { ...prev };
                delete copy[fieldId];
                return copy;
            });
        }
    };

    const handleFileChange = (fieldId: string, file: File | null) => {
        setUploads(prev => ({
            ...prev,
            [fieldId]: { file, status: 'idle' }
        }));
    };

    const handleUploadClick = async (fieldId: string) => {
        const upload = uploads[fieldId];
        if (!upload?.file) return;

        setUploads(prev => ({
            ...prev,
            [fieldId]: { ...prev[fieldId], status: 'uploading' }
        }));

        try {
            const url = await onUpload(fieldId, upload.file);
            setUploads(prev => ({
                ...prev,
                [fieldId]: { ...prev[fieldId], status: 'success', url }
            }));
            
            // Save the storage reference in the formData
            setFormData(prev => ({
                ...prev,
                [fieldId]: {
                    storagePath: url,
                    driveUrl: '' // Apps Script re-resolves this on final approval
                }
            }));
        } catch (err: any) {
            setUploads(prev => ({
                ...prev,
                [fieldId]: { ...prev[fieldId], status: 'error', error: err.message }
            }));
        }
    };

    // Validate current step
    const validateDetailsStep = (): boolean => {
        const errors: Record<string, string> = {};
        
        formSections.forEach(section => {
            section.fields.forEach(field => {
                if (field.type === FieldType.FILE_UPLOAD) return;

                const val = formData[field.id];
                const isEmpty = val === undefined || val === null || String(val).trim() === '';

                if (field.isMandatory && isEmpty) {
                    errors[field.id] = `${field.label || 'This field'} is required.`;
                }
            });
        });

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleNext = () => {
        if (step === 'details') {
            if (validateDetailsStep()) {
                setStep('documents');
                window.scrollTo(0, 0);
            } else {
                setGlobalError('Please fill out all mandatory profile details before proceeding.');
            }
        } else if (step === 'documents') {
            const unuploadedMandatory = documentFields.some(f => 
                f.isMandatory && !formData[f.id] && uploads[f.id]?.status !== 'success'
            );
            if (unuploadedMandatory) {
                setGlobalError('Please upload all mandatory documents before proceeding.');
            } else {
                setGlobalError(null);
                setStep('review');
                window.scrollTo(0, 0);
            }
        }
    };

    const handleBack = () => {
        if (step === 'documents') setStep('details');
        else if (step === 'review') setStep('documents');
        setGlobalError(null);
        window.scrollTo(0, 0);
    };

    const handleFinish = async () => {
        setIsFinishing(true);
        setGlobalError(null);
        try {
            await onComplete(formData);
        } catch (err: any) {
            setGlobalError(err.message || 'Failed to complete profile. Please try again.');
            setIsFinishing(false);
        }
    };

    const allDocumentsUploaded = documentFields.every(f =>
        !f.isMandatory || formData[f.id] || uploads[f.id]?.status === 'success'
    );

    return (
        <div className="bg-white shadow-xl rounded-2xl p-6 md:p-8 max-w-4xl mx-auto border border-gray-100">
            {/* Step Indicator */}
            <div className="flex items-center justify-between mb-8 border-b border-gray-100 pb-6">
                <div className="flex items-center space-x-2 md:space-x-4 mx-auto">
                    <button 
                        disabled={isFinishing}
                        onClick={() => setStep('details')}
                        className={`flex items-center space-x-2 pb-2 border-b-2 transition-all text-sm font-semibold ${step === 'details' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                    >
                        <User size={18} />
                        <span className="hidden sm:inline">1. Verify Details</span>
                    </button>
                    <span className="text-gray-300">/</span>
                    <button 
                        disabled={isFinishing || !validateDetailsStep()}
                        onClick={() => { if(validateDetailsStep()) setStep('documents'); }}
                        className={`flex items-center space-x-2 pb-2 border-b-2 transition-all text-sm font-semibold ${step === 'documents' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                    >
                        <FileUp size={18} />
                        <span className="hidden sm:inline">2. Upload Documents</span>
                    </button>
                    <span className="text-gray-300">/</span>
                    <button 
                        disabled={isFinishing || !validateDetailsStep() || !allDocumentsUploaded}
                        onClick={() => { if(validateDetailsStep() && allDocumentsUploaded) setStep('review'); }}
                        className={`flex items-center space-x-2 pb-2 border-b-2 transition-all text-sm font-semibold ${step === 'review' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                    >
                        <ClipboardList size={18} />
                        <span className="hidden sm:inline">3. Review & Submit</span>
                    </button>
                </div>
            </div>

            {/* Step 1: Verify & Edit Details */}
            {step === 'details' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                    <div className="text-center md:text-left mb-4">
                        <h2 className="text-2xl font-bold text-gray-800">Verify & Complete Profile Details</h2>
                        <p className="text-gray-500 text-sm mt-1">Please confirm the pre-filled information from your import record and update any empty fields.</p>
                    </div>

                    {detailFieldsBySection.map(section => (
                        <div key={section.id} className="bg-gray-50/50 p-6 rounded-xl border border-gray-100">
                            <h3 className="text-md font-bold text-gray-700 border-b border-gray-200/60 pb-2 mb-4">{section.title}</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {section.fields.map(field => {
                                    const error = validationErrors[field.id];
                                    return (
                                        <div key={field.id} className="flex flex-col">
                                            <label className="text-xs font-semibold text-gray-600 mb-1.5 flex items-center">
                                                {field.label}
                                                {field.isMandatory && <span className="text-red-500 ml-1">*</span>}
                                            </label>
                                            
                                            {field.type === FieldType.DROPDOWN ? (
                                                <select
                                                    value={formData[field.id] || ''}
                                                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                                                    className={`w-full border bg-white rounded-xl p-2.5 text-sm transition-all focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 ${error ? 'border-red-500' : 'border-gray-200'}`}
                                                >
                                                    <option value="">Select option...</option>
                                                    {field.options?.map(opt => (
                                                        <option key={opt} value={opt}>{opt}</option>
                                                    ))}
                                                </select>
                                            ) : field.type === FieldType.TEXTAREA ? (
                                                <textarea
                                                    value={formData[field.id] || ''}
                                                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                                                    rows={3}
                                                    className={`w-full border rounded-xl p-2.5 text-sm transition-all focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 ${error ? 'border-red-500' : 'border-gray-200'}`}
                                                />
                                            ) : field.type === FieldType.DATE ? (
                                                <input
                                                    type="date"
                                                    value={formData[field.id] || ''}
                                                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                                                    className={`w-full border rounded-xl p-2.5 text-sm transition-all focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 ${error ? 'border-red-500' : 'border-gray-200'}`}
                                                />
                                            ) : (
                                                <input
                                                    type={field.allowedPattern === 'numbers' ? 'number' : 'text'}
                                                    value={formData[field.id] || ''}
                                                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                                                    className={`w-full border rounded-xl p-2.5 text-sm transition-all focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 ${error ? 'border-red-500' : 'border-gray-200'}`}
                                                />
                                            )}

                                            {error && <span className="text-red-500 text-[10px] font-semibold mt-1 flex items-center"><AlertCircle size={10} className="mr-1" /> {error}</span>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Step 2: Upload Documents */}
            {step === 'documents' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="text-center md:text-left mb-4">
                        <h2 className="text-2xl font-bold text-gray-800">Upload Required Documents</h2>
                        <p className="text-gray-500 text-sm mt-1">Please upload scans or PDF copies of your files to verify your credentials.</p>
                    </div>

                    <div className="space-y-4">
                        {documentFields.map(field => {
                            const val = formData[field.id];
                            const hasExisting = !!val && (typeof val === 'string' || (typeof val === 'object' && val.storagePath));
                            const uploadStatus = uploads[field.id]?.status || 'idle';

                            return (
                                <div key={field.id} className={`p-4 border rounded-xl transition-all ${hasExisting ? 'bg-green-50/50 border-green-150' : 'bg-gray-50/30 border-gray-200'}`}>
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex items-start gap-3">
                                            <div className={`p-2 rounded-full ${hasExisting ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-650'}`}>
                                                <FileText size={20} />
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-gray-800 text-sm">{field.label}</h4>
                                                {hasExisting ? (
                                                    <p className="text-xs text-green-655 flex items-center mt-1">
                                                        <CheckCircle size={12} className="mr-1" /> Document uploaded and saved
                                                    </p>
                                                ) : (
                                                    <p className="text-xs text-gray-500 mt-1 flex items-center">
                                                        {field.isMandatory ? <span className="text-red-500 font-bold mr-1">*</span> : null}
                                                        Upload required
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <input
                                                type="file"
                                                id={`file-${field.id}`}
                                                className="hidden"
                                                onChange={(e) => handleFileChange(field.id, e.target.files?.[0] || null)}
                                            />
                                            <label
                                                htmlFor={`file-${field.id}`}
                                                className="cursor-pointer px-3.5 py-2 border border-gray-300 rounded-xl text-xs font-semibold hover:bg-white bg-gray-50 transition-all select-none shadow-sm"
                                            >
                                                {uploads[field.id]?.file ? uploads[field.id].file?.name : 'Choose File'}
                                            </label>
                                            <Button
                                                size="sm"
                                                variant="primary"
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm text-xs font-semibold"
                                                disabled={!uploads[field.id]?.file || uploadStatus === 'uploading' || uploadStatus === 'success'}
                                                onClick={() => handleUploadClick(field.id)}
                                            >
                                                {uploadStatus === 'uploading' ? (
                                                    <Loader2 size={14} className="animate-spin" />
                                                ) : uploadStatus === 'success' ? (
                                                    <CheckCircle size={14} />
                                                ) : (
                                                    <Upload size={14} />
                                                )}
                                                <span className="ml-1.5">
                                                    {uploadStatus === 'success' ? 'Uploaded' : 'Upload'}
                                                </span>
                                            </Button>
                                        </div>
                                    </div>

                                    {uploadStatus === 'error' && (
                                        <p className="mt-2 text-xs text-red-600 flex items-center font-medium">
                                            <AlertCircle size={12} className="mr-1" /> {uploads[field.id].error}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Step 3: Final Review & Submit */}
            {step === 'review' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="text-center md:text-left mb-4">
                        <h2 className="text-2xl font-bold text-gray-800">Review & Submit Profile</h2>
                        <p className="text-gray-500 text-sm mt-1">Please review all your details. Once submitted, your profile will be sent to HR for final activation approval.</p>
                    </div>

                    <div className="bg-gray-50/50 rounded-xl border border-gray-150 p-6 space-y-6 max-h-[400px] overflow-y-auto custom-scrollbar">
                        {formSections.map(section => (
                            <div key={section.id} className="border-b border-gray-200/60 last:border-none pb-4 last:pb-0">
                                <h3 className="text-xs font-bold text-emerald-800 uppercase tracking-widest mb-3">{section.title}</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                                    {section.fields.map(field => {
                                        const val = formData[field.id];
                                        let displayVal = val;
                                        
                                        if (field.type === FieldType.FILE_UPLOAD) {
                                            displayVal = val ? '📄 Uploaded' : '❌ Missing';
                                        } else if (!val || String(val).trim() === '') {
                                            displayVal = '—';
                                        }

                                        return (
                                            <div key={field.id} className="flex justify-between md:justify-start md:grid md:grid-cols-3 py-1 border-b border-gray-100 last:border-none md:border-none">
                                                <span className="text-gray-500 font-medium md:col-span-1">{field.label}:</span>
                                                <span className="text-gray-800 font-semibold md:col-span-2 text-right md:text-left">{displayVal}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Action Bar */}
            <div className="border-t pt-6 mt-8 flex flex-col items-center">
                {globalError && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium w-full flex items-center">
                        <AlertCircle size={16} className="mr-2 flex-shrink-0" />
                        {globalError}
                    </div>
                )}

                <div className="flex w-full justify-between items-center gap-4">
                    {step !== 'details' ? (
                        <Button
                            variant="secondary"
                            className="flex items-center gap-1.5 rounded-xl border border-gray-200 py-2.5 font-semibold text-xs text-gray-700 hover:bg-gray-50"
                            disabled={isFinishing}
                            onClick={handleBack}
                        >
                            <ChevronLeft size={16} />
                            Back
                        </Button>
                    ) : <div />}

                    {step !== 'review' ? (
                        <Button
                            variant="primary"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md py-2.5 font-semibold text-xs flex items-center gap-1.5 ml-auto"
                            onClick={handleNext}
                        >
                            Next Step
                            <ChevronRight size={16} />
                        </Button>
                    ) : (
                        <Button
                            variant="primary"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md py-2.5 font-semibold text-xs flex items-center gap-1.5 ml-auto"
                            disabled={isFinishing}
                            onClick={handleFinish}
                        >
                            {isFinishing ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Finalizing...
                                </>
                            ) : (
                                <>
                                    Complete Profile
                                    <CheckCircle size={16} />
                                </>
                            )}
                        </Button>
                    )}
                </div>
                
                {step === 'review' && (
                    <p className="text-[10px] text-gray-500 mt-4 text-center">
                        * Once you click Complete, your profile data and uploads will be locked, and sent to HR for final validation.
                    </p>
                )}
            </div>
        </div>
    );
};

export default DocumentUploadWizard;

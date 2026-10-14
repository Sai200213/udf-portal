import React, { useState } from 'react';
import { FormSection, FormField, FieldType } from '../../types';
import { createCorrectionRequest } from '../../src/services/employeeService';
import Button from './Button';
import Modal from './Modal';
import Input from './Input';
import Textarea from './Textarea';
import { 
  Link, Copy, Check, Loader2, AlertCircle, Calendar, 
  User, ListTodo, ShieldAlert, CheckSquare, Square
} from 'lucide-react';

interface RequestCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetId: string;
  targetType: 'employee' | 'submission';
  applicantName: string;
  formSections: FormSection[];
  createdBy: string;
  initialSelectedFields?: string[];
}

const RequestCorrectionModal: React.FC<RequestCorrectionModalProps> = ({
  isOpen,
  onClose,
  targetId,
  targetType,
  applicantName,
  formSections,
  createdBy,
  initialSelectedFields
}) => {
  // Input Selection States
  const [selectedFields, setSelectedFields] = useState<Record<string, boolean>>(() => {
    if (initialSelectedFields && initialSelectedFields.length > 0) {
      const map: Record<string, boolean> = {};
      initialSelectedFields.forEach(id => { map[id] = true; });
      return map;
    }
    return {};
  });
  const [fieldReasons, setFieldReasons] = useState<Record<string, string>>(() => {
    if (initialSelectedFields && initialSelectedFields.length > 0) {
      const map: Record<string, string> = {};
      initialSelectedFields.forEach(id => {
        map[id] = "Please verify and correct this information (conflicts with an existing record or invalid format).";
      });
      return map;
    }
    return {};
  });
  const [generalComment, setGeneralComment] = useState('');
  // Expiry Config States
  const [expiryMinutes, setExpiryMinutes] = useState(1440); // Default to 24 Hours (1 Day)
  const [customMinutes, setCustomMinutes] = useState('30');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [deleteOldFiles, setDeleteOldFiles] = useState(false);

  // Link Generation States
  const [generating, setGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Toggle Field Selection
  const handleToggleField = (fieldId: string) => {
    const field = formSections.flatMap(s => s.fields || []).find(f => f.id === fieldId);
    const isUnit = fieldId === '52ae217b-2602-4337-a1cd-a1f9bd36a4b0' || 
                   field?.label?.toLowerCase().includes('unit') || 
                   field?.label?.toLowerCase().includes('facility');

    setSelectedFields(prev => {
      const updated = { ...prev, [fieldId]: !prev[fieldId] };

      // If unit is selected, automatically select designation too
      if (isUnit && updated[fieldId]) {
        const designationField = formSections
          .flatMap(s => s.fields || [])
          .find(f => f.id === 'db307195-cf54-4a6e-9056-f3974b050c4d' || 
                     f.label?.toLowerCase().includes('designation') || 
                     f.label?.toLowerCase().includes('post of apply')
          );
        if (designationField && !prev[designationField.id]) {
          updated[designationField.id] = true;
          setFieldReasons(rPrev => ({
            ...rPrev,
            [designationField.id]: rPrev[designationField.id] || "Review and align designation with the new unit selection."
          }));
        }
      }

      return updated;
    });

    // Reset individual comment if deselected
    if (selectedFields[fieldId]) {
      setFieldReasons(prev => {
        const copy = { ...prev };
        delete copy[fieldId];
        return copy;
      });
    }
  };

  // Change Reason Text
  const handleReasonChange = (fieldId: string, text: string) => {
    setFieldReasons(prev => ({
      ...prev,
      [fieldId]: text
    }));
  };

  // Select/Unselect All fields in a section
  const handleSelectSectionFields = (section: FormSection, selectAll: boolean) => {
    const fieldIds = section.fields
      .filter(f => f.type !== FieldType.HEADER && f.type !== FieldType.INFO_TEXT)
      .map(f => f.id);

    setSelectedFields(prev => {
      const copy = { ...prev };
      fieldIds.forEach(id => {
        copy[id] = selectAll;
        if (!selectAll) delete fieldReasons[id];
      });
      return copy;
    });
  };

  // Generate Request Link
  const handleGenerateLink = async () => {
    setError(null);
    const fieldsToRequest = Object.keys(selectedFields).filter(id => selectedFields[id]);

    if (fieldsToRequest.length === 0) {
      setError("Please select at least one field or document to correct.");
      return;
    }

    setGenerating(true);

    try {
      // Create reasons map
      const reasons: Record<string, string> = {};
      if (generalComment.trim()) {
        reasons.general = generalComment.trim();
      }

      fieldsToRequest.forEach(fieldId => {
        reasons[fieldId] = fieldReasons[fieldId]?.trim() || "Information update/correction requested.";
      });

      // Expiry timestamp
      const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();

      const tokenId = await createCorrectionRequest({
        targetId,
        targetType,
        applicantName,
        requestedFields: fieldsToRequest,
        fieldReasons: reasons,
        expiresAt,
        createdBy,
        deleteOldFiles
      });

      const hostname = window.location.hostname;
      let baseOrigin = window.location.origin;

      if (hostname === 'admin.udfonline.in' || hostname.includes('admin.udfonline.in')) {
        baseOrigin = 'https://employee.udfonline.in';
      } else if (hostname.endsWith('-admin.web.app')) {
        baseOrigin = window.location.origin.replace('-admin.web.app', '-emp.web.app');
      } else if (hostname.endsWith('-admin.firebaseapp.com')) {
        baseOrigin = window.location.origin.replace('-admin.firebaseapp.com', '-emp.firebaseapp.com');
      }

      const url = `${baseOrigin}/correct-details?token=${encodeURIComponent(tokenId.trim())}`;
      setGeneratedLink(url);
    } catch (err: any) {
      console.error("Failed to generate correction request:", err);
      setError("Failed to create request: " + (err.message || err));
    } finally {
      setGenerating(false);
    }
  };

  // Copy to Clipboard
  const handleCopyLink = async () => {
    if (!generatedLink) return;
    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  // Reset modal states
  const handleResetAndClose = () => {
    setSelectedFields({});
    setFieldReasons({});
    setGeneralComment('');
    setExpiryMinutes(1440);
    setCustomMinutes('30');
    setShowCustomInput(false);
    setDeleteOldFiles(false);
    setGeneratedLink(null);
    setCopied(false);
    setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleResetAndClose}
      title={`Request Correction Link — ${applicantName}`}
      size="lg"
    >
      <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
        {generatedLink ? (
          /* LINK SUCCESS PAGE */
          <div className="text-center p-6 space-y-5">
            <div className="w-14 h-14 bg-green-50 text-green-500 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
              <Link size={28} />
            </div>
            
            <div>
              <h4 className="text-lg font-bold text-gray-900">Secure Correction Link Generated!</h4>
              <p className="text-sm text-gray-500 mt-1">
                Copy the link below and send it to **{applicantName}** (via WhatsApp, email, or SMS).
              </p>
            </div>

            <div className="p-4 bg-gray-50 border border-gray-150 rounded-2xl flex items-center gap-3">
              <span className="text-xs font-mono text-gray-600 truncate block text-left flex-1 select-all">
                {generatedLink}
              </span>
              
              <Button
                onClick={handleCopyLink}
                className={`flex items-center gap-2 rounded-xl py-2 px-4 font-semibold shadow-sm ${
                  copied 
                    ? 'bg-green-600 hover:bg-green-700 text-white' 
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copied!' : 'Copy Link'}
              </Button>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-left text-xs text-amber-800 space-y-2">
              <div className="flex items-center gap-2 font-bold uppercase text-[10px] tracking-wider text-amber-700">
                <ShieldAlert size={14} /> Security Notice
              </div>
              <p>
                - This link expires automatically in **{expiryMinutes < 60 ? `${expiryMinutes} minutes` : `${Math.round(expiryMinutes / 60)} hours`}** ({new Date(Date.now() + expiryMinutes * 60 * 1000).toLocaleTimeString()}).
              </p>
              <p>
                - **Single-Use**: Once the employee submits their updates, this link is permanently deactivated.
              </p>
              <p>
                - **Identity Locked**: The employee must log in to their account or verify their Registered Email & Date of Birth to view the form.
              </p>
            </div>

            <div className="pt-4 border-t">
              <Button onClick={handleResetAndClose} variant="secondary" className="px-6 rounded-xl">
                Close Window
              </Button>
            </div>
          </div>
        ) : (
          /* CONFIGURATION FORM PAGE */
          <div className="space-y-6">
            <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 flex gap-3 text-sm text-blue-800">
              <ListTodo size={20} className="flex-shrink-0 text-blue-600 mt-0.5" />
              <div>
                <span className="font-bold block mb-0.5">Instructions:</span>
                Select the fields that contain mistakes. The employee will receive a custom form showing *only* the checked questions, along with your notes detailing what needs to be changed.
              </div>
            </div>

            {/* General Admin Note */}
            <Textarea
              label="General Note to Applicant (Optional)"
              placeholder="e.g. Please update the flagged details below as soon as possible so we can proceed with your onboarding."
              value={generalComment}
              onChange={(e) => setGeneralComment(e.target.value)}
            />

            {/* Expiry Selection */}
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Link Lifespan (Expiration)</label>
                  <select
                    value={showCustomInput ? 'custom' : expiryMinutes}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'custom') {
                        setShowCustomInput(true);
                        setExpiryMinutes(Number(customMinutes) || 30);
                      } else {
                        setShowCustomInput(false);
                        setExpiryMinutes(Number(val));
                      }
                    }}
                    className="w-full h-10 px-3 border border-gray-250 rounded-xl text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value={5}>5 Minutes (for testing)</option>
                    <option value={10}>10 Minutes (for testing)</option>
                    <option value={30}>30 Minutes (for testing)</option>
                    <option value={60}>1 Hour</option>
                    <option value={720}>12 Hours</option>
                    <option value={1440}>24 Hours (1 Day - Recommended)</option>
                    <option value={2880}>48 Hours (2 Days)</option>
                    <option value={4320}>72 Hours (3 Days)</option>
                    <option value="custom">Custom Minutes...</option>
                  </select>
                </div>
              </div>

              {showCustomInput && (
                <div className="animate-in slide-in-from-top duration-200">
                  <Input
                    label="Enter Custom Minutes"
                    type="number"
                    min="1"
                    value={customMinutes}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomMinutes(val);
                      setExpiryMinutes(Number(val) || 30);
                    }}
                    placeholder="e.g. 15"
                  />
                </div>
              )}

              {/* Storage Policy Configuration */}
              <div className="flex items-center gap-2.5 p-3 bg-gray-50 border border-gray-150 rounded-2xl select-none">
                <input
                  id="deleteOldFiles"
                  type="checkbox"
                  checked={deleteOldFiles}
                  onChange={(e) => setDeleteOldFiles(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-250 rounded focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="deleteOldFiles" className="text-xs text-gray-650 font-medium cursor-pointer leading-normal">
                  Permanently delete replaced document files from Storage (clean replace)
                </label>
              </div>
            </div>

            {/* Form Fields Selector Checklist */}
            <div className="space-y-5">
              <h5 className="text-sm font-bold text-gray-700 flex items-center gap-2 border-b pb-2">
                <CheckSquare size={16} /> Select Fields to Correct
              </h5>

              {formSections.map(sec => {
                // Filter out non-input structural items (headers and helper texts)
                const inputFields = sec.fields?.filter(f => f.type !== FieldType.HEADER && f.type !== FieldType.INFO_TEXT) || [];
                if (inputFields.length === 0) return null;

                const selectedInSec = inputFields.filter(f => selectedFields[f.id]);
                const allSelected = selectedInSec.length === inputFields.length;
                const someSelected = selectedInSec.length > 0 && !allSelected;

                return (
                  <div key={sec.id} className="border border-gray-150 rounded-2xl overflow-hidden bg-white shadow-sm">
                    {/* Section Header */}
                    <div className="bg-gray-50 border-b border-gray-150 px-4 py-3 flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-800">{sec.name}</span>
                      
                      <button
                        type="button"
                        onClick={() => handleSelectSectionFields(sec, !allSelected)}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                      >
                        {allSelected ? 'Deselect Section' : 'Select Section'}
                      </button>
                    </div>

                    {/* Section Input Checklist */}
                    <div className="p-4 divide-y divide-gray-100 space-y-4">
                      {inputFields.map(field => {
                        const isChecked = !!selectedFields[field.id];
                        return (
                          <div key={field.id} className={`pt-3 first:pt-0 flex flex-col md:flex-row gap-3 ${isChecked ? 'bg-amber-50/10' : ''}`}>
                            
                            {/* Checkbox Trigger */}
                            <div className="flex-shrink-0 flex items-start gap-3 mt-1.5 md:w-1/3">
                              <button
                                type="button"
                                onClick={() => handleToggleField(field.id)}
                                className="text-gray-400 hover:text-blue-500"
                              >
                                {isChecked ? (
                                  <CheckSquare className="text-blue-600 flex-shrink-0" size={18} />
                                ) : (
                                  <Square className="flex-shrink-0" size={18} />
                                )}
                              </button>
                              <span className="text-sm font-medium text-gray-800">{field.label}</span>
                            </div>

                            {/* Dynamic Reason Field */}
                            {isChecked && (
                              <div className="flex-1 animate-in slide-in-from-left duration-200">
                                <Input
                                  label="Correction Reason / Instructions"
                                  placeholder="e.g. Upload a clear front-side scan."
                                  value={fieldReasons[field.id] || ''}
                                  onChange={(e) => handleReasonChange(field.id, e.target.value)}
                                  className="h-8 text-xs placeholder:text-gray-300"
                                  required
                                />
                              </div>
                            )}

                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs font-semibold text-red-700 flex items-center gap-2">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="pt-4 border-t flex gap-3">
              <Button
                onClick={handleGenerateLink}
                disabled={generating}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 font-semibold shadow-sm flex items-center justify-center gap-2"
              >
                {generating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Generating token...
                  </>
                ) : (
                  <>
                    <Link size={16} />
                    Generate Correction Link
                  </>
                )}
              </Button>
              
              <Button onClick={handleResetAndClose} variant="secondary" className="px-6 rounded-xl">
                Cancel
              </Button>
            </div>

          </div>
        )}
      </div>
    </Modal>
  );
};

export default RequestCorrectionModal;

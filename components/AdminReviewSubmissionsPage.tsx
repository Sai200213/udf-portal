
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { SubmittedFormData, SubmissionStatus, FormSection, FormField, FieldType, WorkflowConfig, Role, Permission, Site, User, StaffUser, DuplicateCheckResult, DuplicateMatchItem } from '../types';
import Button from './common/Button';
import Modal from './common/Modal';
import Input from './common/Input';
import Textarea from './common/Textarea';
import { Eye, CheckCircle, UserPlus, Info, UploadCloud, Download, History, Clock, ListChecks, XCircle, ShieldAlert, Zap, Shield, Settings, Trash2, RotateCcw, Edit3, ChevronDown, Search, FileText, Loader2, AlertTriangle, Phone, CreditCard, Briefcase, Copy, Check } from 'lucide-react';
import { getApplicantName, formatDate, getApplicantPAN, getApplicantAadhaar, getApplicantUAN, getApplicantPhone } from '../utils/formDataHelper';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import PremiumSelect from './common/PremiumSelect';
import SecureDocumentLink, { SecureImage } from '../src/components/common/SecureDocumentLink';
import RequestCorrectionModal from './common/RequestCorrectionModal';
import { defaultSites } from '../src/constants/defaults';
import { getEffectiveApprovalLevel, isRoleAssignedToSite } from '../src/utils/workflowHelper';
import { useData } from '../src/contexts/DataContext';

const EMPLOYEE_ID_REGEX = /^[A-Z]{2}\d{6}$/;

const isFieldEmptyOrPlaceholder = (val: any): boolean => {
  if (val === undefined || val === null) return true;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed === '') return true;
    const lower = trimmed.toLowerCase();
    const placeholderTokens = [
      'na', 'n/a', 'n.a.', 'none', 'nil', 'nil.', 'no', 'not available', 
      'not applicable', 'pending', 'tbd', 'later', 'null', 'dummy', 
      'test', 'unknown', 'to be updated'
    ];
    if (placeholderTokens.includes(lower)) return true;
    if (/^[0\-_.\s]+$/.test(trimmed)) return true;
    return false;
  }
  if (Array.isArray(val)) return val.length === 0;
  if (typeof val === 'object') {
    if ('storagePath' in val || 'name' in val) {
      return !val.storagePath && !val.name;
    }
    return Object.keys(val).length === 0;
  }
  return false;
};

const isComplianceOrPriorityField = (field: FormField): boolean => {
  const lbl = (field.label || '').toLowerCase();
  return (
    lbl.includes('esic') ||
    lbl.includes('uan') ||
    lbl.includes('pf') ||
    lbl.includes('epfo') ||
    lbl.includes('bank') ||
    lbl.includes('account') ||
    lbl.includes('ifsc') ||
    lbl.includes('passbook') ||
    lbl.includes('cheque') ||
    lbl.includes('insurance') ||
    lbl.includes('medical') ||
    lbl.includes('pvc') ||
    lbl.includes('police')
  );
};

const getFieldDisplayValue = (field: FormField, submission: SubmittedFormData | null) => {
  if (!submission || !submission.data) return { text: 'Empty', isPlaceholder: false, isEmpty: true };
  const val = submission.data[field.id];
  if (val === undefined || val === null) {
    return { text: 'Empty', isPlaceholder: false, isEmpty: true };
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed === '') {
      return { text: 'Empty', isPlaceholder: false, isEmpty: true };
    }
    const isPlaceholder = isFieldEmptyOrPlaceholder(val);
    return {
      text: trimmed.length > 25 ? `"${trimmed.slice(0, 22)}..."` : `"${trimmed}"`,
      isPlaceholder,
      isEmpty: false
    };
  }
  if (typeof val === 'number') {
    const str = String(val);
    const isPlaceholder = isFieldEmptyOrPlaceholder(str);
    return { text: str, isPlaceholder, isEmpty: false };
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return { text: 'Empty (0 items)', isPlaceholder: false, isEmpty: true };
    return { text: `${val.length} item(s)`, isPlaceholder: false, isEmpty: false };
  }
  if (typeof val === 'object') {
    if ('name' in val || 'storagePath' in val) {
      if (!val.name && !val.storagePath) {
        return { text: 'No file', isPlaceholder: false, isEmpty: true };
      }
      return { text: `Doc: ${val.name || 'Uploaded'}`, isPlaceholder: false, isEmpty: false };
    }
    return { text: 'Object', isPlaceholder: false, isEmpty: false };
  }
  return { text: String(val), isPlaceholder: false, isEmpty: false };
};


interface AdminReviewSubmissionsPageProps {
  submittedForms: SubmittedFormData[];
  onApprove: (
    submissionId: string,
    employeeId: string,
    comments?: string,
    isRejection?: boolean,
    isBypass?: boolean,
    profileCompletionData?: {
      profileCompletionStatus: 'COMPLETE' | 'INCOMPLETE';
      pendingProfileFields?: string[];
      pendingProfileNote?: string;
    },
    customJoiningDate?: string,
    customRecruiter?: { id: string | null; name: string | null }
  ) => void | Promise<any>;
  formSections: FormSection[];
  onBulkAddEmployees: (newEmployees: SubmittedFormData[]) => void;
  userRole?: Role;
  isSuperAdmin: boolean;
  workflowConfigs: WorkflowConfig[];
  sites: Site[];
  authUser: User | null;
  onRevert?: (submissionId: string, level: number, comments?: string) => void;
  onDelete?: (submissionId: string) => void;
  onUpdateId?: (submissionId: string, oldId: string, newId: string) => void;
  roles?: Role[];
  allowedSiteIds?: string[];
  onUpdateComment?: (submissionId: string, historyIndex: number, newComment: string) => Promise<void>;
  staffUsers?: StaffUser[];
}

interface CompactDuplicateBadgesProps {
  matches?: DuplicateMatchItem[];
  isFinalStep?: boolean;
  compact?: boolean;
}

const CompactDuplicateBadges: React.FC<CompactDuplicateBadgesProps> = ({ matches, isFinalStep, compact = false }) => {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [openUpwards, setOpenUpwards] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveIdx(null);
        setIsPinned(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveIdx(null);
        setIsPinned(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  if (!matches || matches.length === 0) return null;

  const getFieldIcon = (field: string) => {
    switch (field) {
      case 'Phone Number': return <Phone size={compact ? 10 : 12} className="shrink-0" />;
      case 'PAN Card': return <CreditCard size={compact ? 10 : 12} className="shrink-0" />;
      case 'Aadhaar Number': return <FileText size={compact ? 10 : 12} className="shrink-0" />;
      case 'UAN Number': return <Briefcase size={compact ? 10 : 12} className="shrink-0" />;
      default: return <AlertTriangle size={compact ? 10 : 12} className="shrink-0" />;
    }
  };

  const getBadgeStyle = (matchType: string) => {
    switch (matchType) {
      case 'EXISTING_ACTIVE_EMPLOYEE':
        return 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100 hover:border-red-400';
      case 'EX_EMPLOYEE_REHIRE':
        return 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 hover:border-amber-400';
      case 'PLACEHOLDER_VALUE':
        return 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 hover:border-amber-400';
      case 'DUPLICATE_SUBMISSION':
      default:
        return isFinalStep
          ? 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100 hover:border-red-400'
          : 'bg-orange-50 text-orange-800 border-orange-300 hover:bg-orange-100 hover:border-orange-400';
    }
  };

  const handleCopy = (text: string, key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const toggleBadge = (idx: number, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (activeIdx === idx && isPinned) {
      setActiveIdx(null);
      setIsPinned(false);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setOpenUpwards(window.innerHeight - rect.bottom < 260);
      setActiveIdx(idx);
      setIsPinned(true);
    }
  };

  const hoverBadge = (idx: number, e: React.MouseEvent<HTMLElement>) => {
    if (!isPinned) {
      const rect = e.currentTarget.getBoundingClientRect();
      setOpenUpwards(window.innerHeight - rect.bottom < 260);
      setActiveIdx(idx);
    }
  };

  return (
    <div ref={containerRef} className="relative inline-flex flex-wrap items-center gap-1.5">
      {matches.map((m, idx) => {
        const isOpen = activeIdx === idx;
        const badgeColor = getBadgeStyle(m.matchType);
        const fieldShortName = m.matchedField.replace(' Number', '').replace(' Card', '');

        return (
          <div
            key={idx}
            className="relative inline-block"
            onMouseEnter={(e) => hoverBadge(idx, e)}
            onMouseLeave={() => { if (!isPinned) setActiveIdx(null); }}
          >
            <button
              type="button"
              onClick={(e) => toggleBadge(idx, e)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-bold transition-all border shadow-2xs cursor-pointer select-none ${badgeColor} ${
                compact ? 'text-[10px] py-0.5 px-2' : 'text-xs'
              } ${isOpen ? 'ring-2 ring-offset-1 ring-amber-400 font-extrabold' : ''}`}
              title="Hover to view details, click to pin open"
            >
              {getFieldIcon(m.matchedField)}
              <span>{compact ? fieldShortName : m.matchedField}</span>
              {isOpen && isPinned && <span className="text-[9px] opacity-70 ml-0.5">📌</span>}
            </button>

            {/* Interactive Popover Card */}
            {isOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className={`absolute z-50 left-0 ${
                  openUpwards ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                } w-76 sm:w-84 p-3 bg-white rounded-xl shadow-xl border border-gray-200 text-left transition-all`}
                style={{ filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.12))' }}
              >
                {/* Popover Header */}
                <div className="flex items-center justify-between pb-2 border-b border-gray-100 gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="p-1 rounded bg-gray-100 text-gray-700">
                      {getFieldIcon(m.matchedField)}
                    </span>
                    <span className="text-xs font-bold text-gray-900 truncate">
                      {m.matchType === 'PLACEHOLDER_VALUE' ? `${m.matchedField} Notice` : `${m.matchedField} Conflict`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`px-1.5 py-0.5 text-[9px] font-extrabold uppercase rounded border ${
                      m.matchType === 'EXISTING_ACTIVE_EMPLOYEE'
                        ? 'bg-red-100 text-red-800 border-red-200'
                        : m.matchType === 'EX_EMPLOYEE_REHIRE'
                          ? 'bg-amber-100 text-amber-800 border-amber-200'
                          : m.matchType === 'PLACEHOLDER_VALUE'
                            ? 'bg-amber-100 text-amber-950 border-amber-300'
                            : 'bg-orange-100 text-orange-800 border-orange-200'
                    }`}>
                      {m.matchType === 'EXISTING_ACTIVE_EMPLOYEE'
                        ? 'Active Employee'
                        : m.matchType === 'EX_EMPLOYEE_REHIRE'
                          ? 'Ex-Employee'
                          : m.matchType === 'PLACEHOLDER_VALUE'
                            ? 'Placeholder Data'
                            : 'Duplicate App'}
                    </span>
                    {isPinned && (
                      <button
                        type="button"
                        onClick={() => { setActiveIdx(null); setIsPinned(false); }}
                        className="text-gray-400 hover:text-gray-600 p-0.5 rounded hover:bg-gray-100 ml-1 text-xs leading-none"
                        title="Close popover"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Popover Body */}
                <div className="py-2 space-y-2 text-xs">
                  {/* Conflicting Value with Copy */}
                  <div className="bg-gray-50 p-1.5 rounded-lg border border-gray-200 flex items-center justify-between">
                    <div className="min-w-0 flex items-center gap-1">
                      <span className="text-[10px] text-gray-500 font-semibold uppercase">Value:</span>
                      <code className="font-bold text-gray-900 font-mono text-[11px] truncate">{m.matchedValue}</code>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleCopy(m.matchedValue, `val-${idx}`, e)}
                      className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-600 hover:text-indigo-800 px-1.5 py-0.5 rounded hover:bg-indigo-50 shrink-0 cursor-pointer"
                    >
                      {copiedKey === `val-${idx}` ? (
                        <>
                          <Check size={10} className="text-green-600" />
                          <span className="text-green-600 font-bold">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={10} />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Conflicting Record Details or Placeholder Guidance */}
                  {m.matchType === 'PLACEHOLDER_VALUE' ? (
                    <div className="space-y-1 text-gray-700">
                      <div className="flex justify-between items-start text-[11px]">
                        <span className="text-gray-500 shrink-0">Field:</span>
                        <span className="font-bold text-gray-900 text-right truncate ml-2">
                          {m.matchedField}
                        </span>
                      </div>
                      <div className="flex justify-between items-start text-[11px]">
                        <span className="text-gray-500 shrink-0">Value Status:</span>
                        <span className="font-semibold text-amber-800 text-right truncate ml-2">
                          Dummy / Placeholder Digits
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1 text-gray-700">
                      <div className="flex justify-between items-start text-[11px]">
                        <span className="text-gray-500 shrink-0">Matching Record:</span>
                        <span className="font-bold text-gray-900 text-right truncate ml-2">
                          {m.matchedName || 'Applicant'}
                        </span>
                      </div>

                      <div className="flex justify-between items-start text-[11px]">
                        <span className="text-gray-500 shrink-0">
                          {m.matchType === 'EXISTING_ACTIVE_EMPLOYEE' ? 'Employee ID:' : m.matchType === 'EX_EMPLOYEE_REHIRE' ? 'Previous ID:' : 'Submission ID:'}
                        </span>
                        <span className="font-mono font-bold text-gray-800 text-right truncate ml-2">
                          {m.matchedId || m.submissionId || 'N/A'}
                        </span>
                      </div>

                      <div className="flex justify-between items-start text-[11px]">
                        <span className="text-gray-500 shrink-0">Site / Location:</span>
                        <span className="font-semibold text-gray-800 text-right truncate ml-2">
                          {m.matchedSite || 'N/A'}
                        </span>
                      </div>

                      {m.matchType === 'EX_EMPLOYEE_REHIRE' && (
                        <>
                          <div className="flex justify-between items-start text-[11px]">
                            <span className="text-gray-500 shrink-0">Relieved Date:</span>
                            <span className="font-medium text-gray-800 text-right">{m.relievingDate || 'N/A'}</span>
                          </div>
                          <div className="flex justify-between items-start text-[11px]">
                            <span className="text-gray-500 shrink-0">Relieving Reason:</span>
                            <span className="font-medium text-gray-800 text-right">{m.relievingReason || 'N/A'}</span>
                          </div>
                        </>
                      )}

                      {m.matchType === 'DUPLICATE_SUBMISSION' && m.submissionStatus && (
                        <div className="flex justify-between items-start text-[11px]">
                          <span className="text-gray-500 shrink-0">Submission Status:</span>
                          <span className="font-bold text-indigo-700 text-right">{m.submissionStatus}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Operational Impact Notice */}
                  <div className={`p-2 rounded-lg text-[10.5px] leading-tight font-medium ${
                    m.matchType === 'EXISTING_ACTIVE_EMPLOYEE'
                      ? 'bg-red-50 text-red-900 border border-red-200'
                      : m.matchType === 'EX_EMPLOYEE_REHIRE'
                        ? 'bg-amber-50 text-amber-900 border border-amber-200'
                        : m.matchType === 'PLACEHOLDER_VALUE'
                          ? 'bg-amber-50 text-amber-950 border border-amber-200'
                          : 'bg-orange-50 text-orange-900 border border-orange-200'
                  }`}>
                    {m.matchType === 'EXISTING_ACTIVE_EMPLOYEE' && (
                      <span>🛑 <strong>Hard Lock:</strong> Candidate is already active in company records. ID assignment is blocked.</span>
                    )}
                    {m.matchType === 'DUPLICATE_SUBMISSION' && (
                      <span>⚠️ <strong>Approval Blocked:</strong> Reject or resolve the conflicting submission before onboarding.</span>
                    )}
                    {m.matchType === 'EX_EMPLOYEE_REHIRE' && (
                      <span>✅ <strong>Rehire Eligible:</strong> HR may approve as a rehire under their existing corporate record.</span>
                    )}
                    {m.matchType === 'PLACEHOLDER_VALUE' && (
                      <span>💡 <strong>Non-Blocking:</strong> Candidate entered dummy data. Approval is allowed; consider selecting <strong>"Incomplete Profile"</strong> below to collect valid details post-joining.</span>
                    )}
                  </div>
                </div>

                {/* Popover Footer */}
                <div className="pt-1.5 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400">
                  <span>{isPinned ? '📌 Pinned open (click to close)' : 'Click badge to pin open'}</span>
                  <span className="italic">{matches.length > 1 ? `${idx + 1} of ${matches.length} conflicts` : '1 conflict'}</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const AdminReviewSubmissionsPage: React.FC<AdminReviewSubmissionsPageProps> = ({
  submittedForms, onApprove, formSections, onBulkAddEmployees, userRole, isSuperAdmin, workflowConfigs, sites, authUser,
  onRevert, onDelete, onUpdateId, roles, allowedSiteIds, onUpdateComment, staffUsers: propStaffUsers
}) => {
  const { staffUsers: contextStaffUsers, roles: contextRoles, allowedSiteIds: contextAllowedSiteIds, isSuperAdmin: contextIsSuperAdmin } = useData();
  const staffUsers = propStaffUsers || contextStaffUsers || [];
  const effectiveAllowedSiteIds = useMemo(() => {
    return allowedSiteIds !== undefined ? allowedSiteIds : (contextAllowedSiteIds || []);
  }, [allowedSiteIds, contextAllowedSiteIds]);
  const allowedSitesKey = useMemo(() => {
    return Array.isArray(effectiveAllowedSiteIds) ? effectiveAllowedSiteIds.join(',') : String(effectiveAllowedSiteIds || '');
  }, [effectiveAllowedSiteIds]);
  const effectiveIsSuperAdmin = isSuperAdmin ?? contextIsSuperAdmin;
  const allRoles = roles || contextRoles || [];
  const hasPermission = (p: Permission) => {
    if (effectiveIsSuperAdmin) return true;
    if (userRole?.isDisabled === true) return false;
    const overrides = (authUser as any)?.permissionOverrides;
    if (overrides && overrides[p] !== undefined) {
      return Boolean(overrides[p]);
    }
    return Boolean(userRole?.permissions?.includes(p));
  };
  const hasManagePerm = hasPermission(Permission.SUBMISSIONS_APPROVE);
  const hasViewScopeAll = effectiveIsSuperAdmin || hasPermission(Permission.SUBMISSIONS_VIEW_SCOPE_ALL);
  const [selectedSubmissionForDetails, setSelectedSubmissionForDetails] = useState<SubmittedFormData | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [isBiodataModalOpen, setIsBiodataModalOpen] = useState(false);
  const [resolvedPhotoUrl, setResolvedPhotoUrl] = useState<string>('');
  const [isPrinting, setIsPrinting] = useState(false);
  const [isFormSyncing, setIsFormSyncing] = useState(false);
  const [isDriveSyncing, setIsDriveSyncing] = useState(false);

  // Recruiter Editing State (Super Admin Only)
  const [selectedRecruiterId, setSelectedRecruiterId] = useState<string>('');
  const [isEditingDetailsRecruiter, setIsEditingDetailsRecruiter] = useState(false);
  const [detailsSelectedRecruiterId, setDetailsSelectedRecruiterId] = useState<string>('');
  const [isSavingRecruiter, setIsSavingRecruiter] = useState(false);
  const [isSavingApprovalRecruiter, setIsSavingApprovalRecruiter] = useState(false);
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);

  const suggestedNextEmployeeId = useMemo(() => {
    let maxNum = 0;
    (submittedForms || []).forEach(s => {
      if (s.employeeId && /^HY(\d{6})$/i.test(s.employeeId.trim())) {
        const num = parseInt(s.employeeId.trim().substring(2), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
    if (maxNum > 0) {
      return `HY${String(maxNum + 1).padStart(6, '0')}`;
    }
    return 'HY140001';
  }, [submittedForms]);

  const getFieldValue = (sub: SubmittedFormData, id: string, label: string) => {
    if (!sub || !sub.data) return '';
    if (sub.data[id] !== undefined && sub.data[id] !== null) {
      const val = sub.data[id];
      if (typeof val === 'object' && val !== null && 'storagePath' in val) return val;
      return String(val);
    }
    const sections = sub.originalFormSections || [];
    const field = sections.flatMap(s => s.fields || []).find(f =>
      f && f.label && f.label.toLowerCase().trim() === label.toLowerCase().trim()
    );
    if (!field) return '';
    const val = sub.data[field.id];
    if (val === null || val === undefined) return '';
    if (typeof val === 'object' && 'storagePath' in val) return val;
    return String(val);
  };

  const remapOnboardingPathToEmployeePath = (valPath: string, sub?: SubmittedFormData) => {
    if (typeof valPath === 'string' && valPath.startsWith('onboarding/') && sub?.status === SubmissionStatus.APPROVED) {
      const empIdForPath = sub.employeeId || sub.id;
      if (empIdForPath) {
        const parts = valPath.split('/');
        const subPath = parts.slice(2).join('/');
        return `employees/${empIdForPath}/joining/${subPath}`;
      }
    }
    return valPath;
  };

  const getDesignationCheck = (sub: SubmittedFormData | null) => {
    if (!sub) return { isAllowed: true, activeSite: null, designation: '' };

    const designation = String(getFieldValue(sub, 'db307195-cf54-4a6e-9056-f3974b050c4d', 'Post of Apply') || getFieldValue(sub, 'db307195-cf54-4a6e-9056-f3974b050c4d', 'Designation') || '');
    const siteName = String(getFieldValue(sub, '52ae217b-2602-4337-a1cd-a1f9bd36a4b0', 'Unit or Facility') || '');

    if (!siteName) return { isAllowed: true, activeSite: null, designation };

    let activeSite = sites.find(s => s.name === siteName || s.id === siteName);
    if (!activeSite) {
      activeSite = defaultSites.find(s => s.name === siteName || s.id === siteName);
    }

    if (!activeSite) return { isAllowed: true, activeSite: null, designation };

    let allowedList = activeSite.allowedDesignations;
    if (!allowedList || allowedList.length === 0) {
      const jobSection = formSections?.find(s => s.name === "Job Details");
      const desigField = jobSection?.fields?.find(f =>
        f.id === 'db307195-cf54-4a6e-9056-f3974b050c4d' ||
        f.label.trim().toLowerCase() === "post of apply" ||
        f.label.trim().toLowerCase() === "designation"
      );
      if (desigField?.optionsMap) {
        allowedList = desigField.optionsMap[activeSite.name] || desigField.optionsMap[activeSite.id];
      }
    }

    const isAllowed = !allowedList ||
      allowedList.length === 0 ||
      allowedList.includes(designation);

    return { isAllowed, activeSite, designation };
  };

  React.useEffect(() => {
    let active = true;
    if (isBiodataModalOpen && selectedSubmissionForDetails) {
      const sub = selectedSubmissionForDetails;
      const photoVal = getFieldValue(sub, '7fbd2b8f-62b5-402d-a1dd-262531fa00af', 'Passport Size Photo');
      let photoPath = typeof photoVal === 'object' && photoVal !== null && 'storagePath' in photoVal
        ? photoVal.storagePath
        : (typeof photoVal === 'string' ? photoVal : '');

      photoPath = remapOnboardingPathToEmployeePath(photoPath, sub);

      if (photoPath) {
        if (photoPath.startsWith('http') || photoPath.startsWith('data:')) {
          setResolvedPhotoUrl(photoPath);
        } else {
          import('../src/services/storageService').then(({ getSecureURL }) => {
            getSecureURL(photoPath).then(url => {
              if (active && url) setResolvedPhotoUrl(url);
            }).catch(err => console.error("Error loading photo secure URL:", err));
          });
        }
      } else {
        setResolvedPhotoUrl('');
      }
    }
    return () => { active = false; };
  }, [isBiodataModalOpen, selectedSubmissionForDetails]);

  const handlePrintBiodata = async () => {
    if (!selectedSubmissionForDetails) return;
    const sub = selectedSubmissionForDetails;
    setIsPrinting(true);
    try {
      const name = String(getFieldValue(sub, '7debf274-baee-4bac-a137-4b4b46719874', 'Full Name') || '');
      const phone = String(getFieldValue(sub, 'eb3617dc-9f1d-475d-a2db-005b6bc2500c', 'Phone Number') || '');
      const gender = String(getFieldValue(sub, '5df6fa40-c39f-41a7-9ee7-789a47435ef0', 'Gender') || '');
      const dob = String(getFieldValue(sub, '6e570a01-14e0-4e18-b112-97ddc51d0778', 'Date of Birth') || '');
      const citizenship = String(getFieldValue(sub, '2fdacb1b-254f-4fc3-923a-53233214124f', 'Citizenship') || '');
      const bloodGroup = String(getFieldValue(sub, '2f8c72f5-10f4-4414-bfcd-274fc69592e2', 'Blood Group') || '');
      const height = String(getFieldValue(sub, '5ae316e6-2941-4e58-93b8-a6fe5a200e98', 'Height') || '');
      const marks = String(getFieldValue(sub, '7386dcfa-e693-4998-a1cb-35a8fa8029de', 'Identity Marks') || '');
      const maritalStatus = String(getFieldValue(sub, 'c53d7ba7-58a0-4cf0-8691-8eb7bef7b951', 'Marital Status') || '');
      const spouseName = String(getFieldValue(sub, '7db47bc3-e4cc-4984-9687-2d94cad3e632', 'Spouse Name') || '');

      const qualification = String(getFieldValue(sub, '61b19d37-b860-44ef-80e9-d33c3b438655', 'Qualification') || '');
      const designation = String(getFieldValue(sub, 'db307195-cf54-4a6e-9056-f3974b050c4d', 'Post of Apply') || getFieldValue(sub, 'db307195-cf54-4a6e-9056-f3974b050c4d', 'Designation') || '');
      const siteName = String(getFieldValue(sub, '52ae217b-2602-4337-a1cd-a1f9bd36a4b0', 'Unit or Facility') || '');
      const subUnit = String(getFieldValue(sub, '68a2a893-0100-4740-9602-9988452377c8', 'Specific Location / Sub-Unit') || '');
      const policeCase = String(getFieldValue(sub, '0c8a587e-08f3-4605-ad33-9ab34eb46d87', 'Any Police Case') || '');
      const prevHistory = String(getFieldValue(sub, '4b05d2b6-ff73-4dbe-befa-eba77c8ce1c4', 'Previous Employment History') || '');
      const experience = String(getFieldValue(sub, 'd16a6da1-fc29-405e-bbb6-cb186b8f8666', 'Previous Company & Experience') || '');
      const recruitedByName = String((sub as any).recruitedByName || (sub as any).recruitedBy || '');

      const presentAddress = String(getFieldValue(sub, '8532f460-7bcf-4831-ab62-96375b80e6ab', 'Present Address') || '');
      const permanentAddress = String(getFieldValue(sub, '29bae22a-59db-4b1b-bafd-64e8018a0f4e', 'Permanent Address') || '');

      const refName = String(getFieldValue(sub, '2e1f27bf-94e7-421f-b69c-7e8dfaf0ee13', 'Reference Name') || '');
      const refRelation = String(getFieldValue(sub, '13c82880-161a-4fa9-a8b6-0558d5c88c53', 'Reference Relationship') || '');
      const refAddress = String(getFieldValue(sub, '7681644c-02f8-4034-b0ce-cc11dfd3dca7', 'Reference Address') || '');
      const refContact = String(getFieldValue(sub, 'e1479d43-ed04-4fde-a508-130f43b4f12d', 'Reference Contact No') || '');

      const fatherName = String(getFieldValue(sub, '3f09e364-7875-40a2-9490-41251be20366', "Father's Name") || '');
      const motherName = String(getFieldValue(sub, 'c432a45e-c1f0-4e64-8002-1f1dba3bf660', "Mother's Name") || '');
      const fatherMobile = String(getFieldValue(sub, '30d78dae-fb7c-4264-a159-c04993d8885c', "Father's Mobile Number") || '');
      const motherMobile = String(getFieldValue(sub, '30fab2de-452d-46bf-8079-2f53d322388d', "Mother's Mobile Number") || '');

      const aadharNo = String(getFieldValue(sub, '18855ee9-0d66-41d6-988b-128b776a8c5b', 'Aadhar Card No') || '');
      const panNo = String(getFieldValue(sub, 'da8edb18-4bed-41ca-8233-2280b97dac8d', 'PAN Card No') || '');
      const uanNo = String(getFieldValue(sub, 'f6665f3e-98f4-4d92-8b53-adcaa1993bbe', 'UAN No or EPFO') || '');
      const esicNo = String(getFieldValue(sub, '41e3505e-15fb-4067-9c6a-2c690e736fab', 'ESIC No') || '');
      const pvcStatus = String(getFieldValue(sub, '1052957c-a885-494e-af2c-ae1af5c5cc8e', 'PVC (Police Verification Certificate)') || '');
      const pvcNumber = String(getFieldValue(sub, '791bdd86-20c2-4097-bcc1-c85e8f649961', 'PVC Number (If YES)') || '');

      const bankName = String(getFieldValue(sub, '1a35eaa7-d302-4e49-8649-e85cab8b3b77', 'Bank Name') || '');
      const accountNo = String(getFieldValue(sub, '3519c111-aaa6-4fe0-8d83-d03dd7612e28', 'Account No') || '');
      const ifscCode = String(getFieldValue(sub, '86854000-7727-40bb-9932-09e28e443ad8', 'IFSC Code') || '');
      const branchName = String(getFieldValue(sub, '6fe166fc-29a3-41ea-a19f-a498b48089b9', 'Branch Name') || '');

      const photoVal = getFieldValue(sub, '7fbd2b8f-62b5-402d-a1dd-262531fa00af', 'Passport Size Photo');
      let photoPath = typeof photoVal === 'object' && photoVal !== null && 'storagePath' in photoVal
        ? photoVal.storagePath
        : (typeof photoVal === 'string' ? photoVal : '');

      photoPath = remapOnboardingPathToEmployeePath(photoPath, sub);

      let photoUrl = '';
      if (photoPath) {
        if (photoPath.startsWith('http') || photoPath.startsWith('data:')) {
          photoUrl = photoPath;
        } else {
          const { getSecureURL } = await import('../src/services/storageService');
          photoUrl = await getSecureURL(photoPath);
        }
      }

      const printWindow = window.open('', '_blank', 'width=800,height=1000');
      if (!printWindow) {
        alert("Please allow popups to print biodata.");
        return;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Biodata - ${name}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
          <style>
            body {
              font-family: 'Inter', sans-serif;
              color: #1e293b;
              margin: 15px;
              line-height: 1.3;
              font-size: 11px;
            }
            .header-container {
              display: flex;
              justify-content: space-between;
              align-items: stretch;
              border-bottom: 2.5px double #334155;
              padding-bottom: 8px;
              margin-bottom: 12px;
              min-height: 120px;
            }
            .title-block {
              flex: 1;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              text-align: center;
              margin-right: 15px;
            }
            .title-block h1 {
              font-size: 24px;
              font-weight: 900;
              margin: 0;
              color: #0f172a;
              letter-spacing: 0.5px;
            }
            .header-meta-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              width: 100%;
              margin-top: 10px;
              font-size: 15px;
              font-weight: 800;
              color: #1e293b;
            }
            .photo-box {
              width: 100px;
              height: 120px;
              border: 1.5px solid #cbd5e1;
              display: flex;
              align-items: center;
              justify-content: center;
              text-align: center;
              font-size: 9px;
              color: #64748b;
              background-color: #f8fafc;
              overflow: hidden;
              flex-shrink: 0;
            }
            .photo-box img {
              width: 100%;
              height: 100%;
              object-fit: cover;
            }
            .section-title {
              font-size: 9.5px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 1.2px;
              color: #1d4ed8;
              border-bottom: 1.2px solid #bfdbfe;
              padding-bottom: 2px;
              margin: 10px 0 5px 0;
            }
            .grid-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 5px;
            }
            .grid-table td {
              padding: 4px 6px;
              vertical-align: middle;
              border: 1px solid #cbd5e1;
            }
            .grid-table td.label {
              font-weight: 700;
              color: #475569;
              background-color: #f8fafc;
              width: 25%;
            }
            .grid-table td.value {
              color: #0f172a;
              width: 25%;
            }
            .declaration-block {
              margin-top: 12px;
              font-style: italic;
              font-size: 10px;
              color: #475569;
              line-height: 1.35;
              text-align: justify;
            }
            .signature-container {
              display: flex;
              justify-content: space-between;
              margin-top: 65px;
              padding-top: 6px;
            }
            .sig-line {
              width: 220px;
              border-top: 1.2px solid #475569;
              text-align: center;
              padding-top: 4px;
              font-weight: 700;
              font-size: 10px;
              color: #334155;
            }
            .watermark-container {
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              opacity: 0.05;
              z-index: -100;
              pointer-events: none;
              display: flex;
              justify-content: center;
              align-items: center;
              width: 100%;
              height: 100%;
            }
            .watermark-img {
              width: 320px;
              height: auto;
            }
            @media print {
              body {
                margin: 10px;
              }
              .no-print {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="watermark-container">
            <img class="watermark-img" src="${window.location.origin}/logo.png" alt="UNIQUE DELTA Logo" />
          </div>
          <div class="header-container">
            <div class="title-block">
              <div>
                <h1 style="font-size: 24px; font-weight: 900; margin: 0; color: #0f172a; letter-spacing: 0.5px;">UNIQUE DELTA FORCE SECURITY PVT. LTD.</h1>
                <div style="font-size: 20px; font-weight: 800; color: #1d4ed8; text-transform: uppercase; letter-spacing: 2px; margin-top: 6px;">BIODATA</div>
              </div>
              <div class="header-meta-row">
                <div>Referred By: ${recruitedByName || '_______________________'}</div>
                <div>Reg. No.: HY _________________</div>
              </div>
            </div>
            <div class="photo-box">
              ${photoUrl ? `<img src="${photoUrl}" alt="Passport Photo" />` : 'PASTE PASSPORT PHOTO HERE'}
            </div>
          </div>

          <div class="section-title">Personal Details</div>
          <table class="grid-table">
            <tr>
              <td class="label">Full Name</td>
              <td class="value" colspan="3">${name || 'N/A'}</td>
            </tr>
            <tr>
              <td class="label">Phone Number</td>
              <td class="value">${phone || 'N/A'}</td>
              <td class="label">Gender</td>
              <td class="value">${gender || 'N/A'}</td>
            </tr>
            <tr>
              <td class="label">Date of Birth</td>
              <td class="value">${dob || 'N/A'}</td>
              <td class="label">Citizenship</td>
              <td class="value">${citizenship || 'N/A'}</td>
            </tr>
            <tr>
              <td class="label">Blood Group</td>
              <td class="value">${bloodGroup || 'N/A'}</td>
              <td class="label">Height</td>
              <td class="value">${height || 'N/A'}</td>
            </tr>
            <tr>
              <td class="label">Identity Marks</td>
              <td class="value" colspan="3">${marks || 'N/A'}</td>
            </tr>
            <tr>
              <td class="label">Marital Status</td>
              <td class="value">${maritalStatus || 'N/A'}</td>
              <td class="label">Spouse Name</td>
              <td class="value">${spouseName || 'N/A'}</td>
            </tr>
          </table>

          <div class="section-title">Job & Deployment Details</div>
          <table class="grid-table">
            <tr>
              <td class="label">Post Applied For</td>
              <td class="value">${designation || 'N/A'}</td>
              <td class="label">Unit or Facility</td>
              <td class="value">${siteName || 'N/A'}</td>
            </tr>
            <tr>
              <td class="label">Qualification</td>
              <td class="value">${qualification || 'N/A'}</td>
              <td class="label">Experience Level</td>
              <td class="value">${prevHistory || 'N/A'}</td>
            </tr>
            <tr>
              <td class="label">Previous Job Details</td>
              <td class="value">${experience || 'N/A'}</td>
              <td class="label">Any Police Case?</td>
              <td class="value">${policeCase || 'N/A'}</td>
            </tr>
          </table>

          <div class="section-title">Government Identifications</div>
          <table class="grid-table">
            <tr>
              <td class="label">Aadhar Card No</td>
              <td class="value">${aadharNo || 'N/A'}</td>
              <td class="label">PAN Card No</td>
              <td class="value">${panNo || 'N/A'}</td>
            </tr>
            <tr>
              <td class="label">UAN / EPFO No</td>
              <td class="value">${uanNo || 'N/A'}</td>
              <td class="label">ESIC No</td>
              <td class="value">${esicNo || 'N/A'}</td>
            </tr>
            <tr>
              <td class="label">PVC Status</td>
              <td class="value">${pvcStatus || 'N/A'}</td>
              <td class="label">PVC Number</td>
              <td class="value">${pvcNumber || 'N/A'}</td>
            </tr>
          </table>

          <div class="section-title">Address & Contact Information</div>
          <table class="grid-table">
            <tr>
              <td class="label" style="width: 15%;">Present Address</td>
              <td class="value" style="width: 35%; font-size: 10px; line-height: 1.2;">${presentAddress || 'N/A'}</td>
              <td class="label" style="width: 15%;">Permanent Address</td>
              <td class="value" style="width: 35%; font-size: 10px; line-height: 1.2;">${permanentAddress || 'N/A'}</td>
            </tr>
          </table>

          <div class="section-title">Family Details</div>
          <table class="grid-table">
            <tr>
              <td class="label">Father's Name</td>
              <td class="value">${fatherName || 'N/A'}</td>
              <td class="label">Father's Contact</td>
              <td class="value">${fatherMobile || 'N/A'}</td>
            </tr>
            <tr>
              <td class="label">Mother's Name</td>
              <td class="value">${motherName || 'N/A'}</td>
              <td class="label">Mother's Contact</td>
              <td class="value">${motherMobile || 'N/A'}</td>
            </tr>
          </table>

          <div class="section-title">Bank Account Details</div>
          <table class="grid-table">
            <tr>
              <td class="label">Bank Name</td>
              <td class="value">${bankName || 'N/A'}</td>
              <td class="label">Account Number</td>
              <td class="value">${accountNo || 'N/A'}</td>
            </tr>
            <tr>
              <td class="label">IFSC Code</td>
              <td class="value">${ifscCode || 'N/A'}</td>
              <td class="label">Branch Name</td>
              <td class="value">${branchName || 'N/A'}</td>
            </tr>
          </table>

          <div class="section-title">Reference Details</div>
          <table class="grid-table">
            <tr>
              <td class="label" style="width: 20%;">Reference Name</td>
              <td class="value" style="width: 30%;">${refName || 'N/A'}</td>
              <td class="label" style="width: 15%;" rowspan="3">Reference Address</td>
              <td class="value" style="width: 35%; font-size: 10px; line-height: 1.2;" rowspan="3">${refAddress || 'N/A'}</td>
            </tr>
            <tr>
              <td class="label">Relationship</td>
              <td class="value">${refRelation || 'N/A'}</td>
            </tr>
            <tr>
              <td class="label">Contact No</td>
              <td class="value">${refContact || 'N/A'}</td>
            </tr>
          </table>

          <div class="declaration-block">
            I hereby declare that all the information provided in this biodata sheet is correct, complete, and true to the best of my knowledge and belief. I understand that any false or misleading statements may lead to cancellation of my candidature or termination of employment.
          </div>

          <div class="signature-container">
            <div class="sig-line">
              Candidate Signature
            </div>
            <div class="sig-line">
              Authorized Signature
            </div>
            <div class="sig-line">
              Date: ${new Date().toLocaleDateString('en-GB')}
            </div>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            };
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
    } catch (err) {
      console.error("Print Error:", err);
      alert("Failed to build printable page.");
    } finally {
      setIsPrinting(false);
    }
  };

  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [approvalTargetSubmission, setApprovalTargetSubmission] = useState<SubmittedFormData | null>(null);
  const [customEmployeeId, setCustomEmployeeId] = useState('');
  const [customJoiningDate, setCustomJoiningDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [employeeIdError, setEmployeeIdError] = useState('');
  const [adminComments, setAdminComments] = useState('');
  const [isBypassMode, setIsBypassMode] = useState(false);
  const [profileCompletionOption, setProfileCompletionOption] = useState<'COMPLETE' | 'INCOMPLETE'>('COMPLETE');
  const [selectedPendingFields, setSelectedPendingFields] = useState<string[]>([]);
  const [detectedEmptyFields, setDetectedEmptyFields] = useState<FormField[]>([]);
  const [pendingNote, setPendingNote] = useState('');
  const [pendingFieldSearch, setPendingFieldSearch] = useState('');
  const [pendingFieldViewFilter, setPendingFieldViewFilter] = useState<'SUGGESTED' | 'ALL' | 'SELECTED'>('SUGGESTED');

  // Comment Editing State
  const [editingHistoryIndex, setEditingHistoryIndex] = useState<number | null>(null);
  const [editingCommentValue, setEditingCommentValue] = useState('');

  // Pagination State
  const [paginatedData, setPaginatedData] = useState<SubmittedFormData[]>([]);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>(SubmissionStatus.PENDING_REVIEW);
  const [searchTerm, setSearchTerm] = useState('');

  const SITE_FIELD_ID = '52ae217b-2602-4337-a1cd-a1f9bd36a4b0';

  const isSubmissionInAllowedSites = (sub: SubmittedFormData) => {
    if (effectiveIsSuperAdmin || hasViewScopeAll) return true;
    if (!effectiveAllowedSiteIds || effectiveAllowedSiteIds.length === 0) return false;

    const submissionSiteVal = String((sub as any).siteId || (sub as any).siteName || sub.data?.[SITE_FIELD_ID] || sub.data?.siteId || sub.data?.siteName || '');
    if (!submissionSiteVal) return false;

    // Check Case A: Stores site ID directly
    if (effectiveAllowedSiteIds.includes(submissionSiteVal)) return true;

    // Check Case B: Stores site name (legacy)
    const site = sites.find(s => s.name.toLowerCase() === submissionSiteVal.toLowerCase() || s.id.toLowerCase() === submissionSiteVal.toLowerCase());
    if (site && effectiveAllowedSiteIds.includes(site.id)) return true;

    return false;
  };

  const config = workflowConfigs.find(c => c.moduleId === 'SUBMISSIONS');

  const loadMoreData = async (reset: boolean = false) => {
    if (isLoading) return;

    // Only block if user cannot see all (no VIEW_SCOPE_ALL) AND has no site assignments
    // Field Officers are site-restricted even with SUBMISSIONS_APPROVE
    // Managers/HR with SUBMISSIONS_VIEW_SCOPE_ALL bypass this restriction
    if (!hasViewScopeAll && (!effectiveAllowedSiteIds || effectiveAllowedSiteIds.length === 0)) {
      setPaginatedData([]);
      setHasMore(false);
      return;
    }

    setIsLoading(true);
    try {
      const currentLastDoc = reset ? undefined : lastDoc;

      const { getPaginatedSubmissions } = await import('../src/services/employeeService');
      const result = await getPaginatedSubmissions(
        filterStatus,
        25,
        currentLastDoc,
        SITE_FIELD_ID,
        (effectiveIsSuperAdmin || hasViewScopeAll) ? 'ALL' : (effectiveAllowedSiteIds || []),
        searchTerm,
        'applicantName'
      );

      if (reset) {
        setPaginatedData(result.submissions);
      } else {
        setPaginatedData(prev => [...prev, ...result.submissions]);
      }
      setLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
    } catch (error) {
      console.error("Pagination Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    const timer = setTimeout(() => {
      loadMoreData(true);
    }, 400);
    return () => clearTimeout(timer);
  }, [filterStatus, searchTerm, allowedSitesKey, effectiveIsSuperAdmin]);

  // Real-time synchronization: sync paginatedData with live submittedForms changes
  const submittedFormsFingerprint = React.useMemo(() => {
    if (!submittedForms || submittedForms.length === 0) return '';
    return submittedForms.map(s => `${s.id}_${s.currentLevel}_${s.status}_${s.employeeId || ''}`).join('|');
  }, [submittedForms]);

  const prevFingerprintRef = React.useRef(submittedFormsFingerprint);
  const prevSubmittedFormsLenRef = React.useRef(submittedForms?.length ?? 0);

  React.useEffect(() => {
    const currentLen = submittedForms?.length ?? 0;
    if (prevSubmittedFormsLenRef.current !== currentLen) {
      prevSubmittedFormsLenRef.current = currentLen;
      prevFingerprintRef.current = submittedFormsFingerprint;
      loadMoreData(true);
      return;
    }

    if (prevFingerprintRef.current !== submittedFormsFingerprint) {
      prevFingerprintRef.current = submittedFormsFingerprint;
      // In-place real-time update of paginatedData records with latest data from submittedForms
      if (submittedForms && submittedForms.length > 0) {
        setPaginatedData(prev => prev.map(pItem => {
          const live = submittedForms.find(s => s.id === pItem.id);
          return live ? { ...pItem, ...live } : pItem;
        }));
      }
    }
  }, [submittedFormsFingerprint, submittedForms]);

  // Modal State
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [revertTargetLevel, setRevertTargetLevel] = useState(1);

  const canReview = (submission: SubmittedFormData) => {
    // ONLY show the primary action button if it's actually PENDING.
    // If it's already approved/rejected, we don't show the "Review/Approve" primary button.
    if (submission.status !== SubmissionStatus.PENDING_REVIEW) return false;

    if (isSuperAdmin) return true; // Super Admin Override for PENDING
    if (!hasPermission(Permission.SUBMISSIONS_APPROVE) && !hasPermission(Permission.SUBMISSIONS_REJECT)) return false;

    const siteName = String(submission.data?.['52ae217b-2602-4337-a1cd-a1f9bd36a4b0'] || '');
    const site = sites?.find(s => s.name === siteName || s.id === siteName);
    const effectiveLevel = getEffectiveApprovalLevel(submission.currentLevel, site, config, staffUsers, allRoles);

    const effectiveLevelConfig = config?.levels.find(l => l.level === effectiveLevel);
    return effectiveLevelConfig?.roleId === userRole?.id;
  };

  const isFinalStep = (submission: SubmittedFormData) => {
    const siteName = String(submission.data?.['52ae217b-2602-4337-a1cd-a1f9bd36a4b0'] || '');
    const site = sites?.find(s => s.name === siteName || s.id === siteName);
    const effectiveLevel = getEffectiveApprovalLevel(submission.currentLevel, site, config, staffUsers, allRoles);

    const maxLevels = config?.levels.length || 1;
    return effectiveLevel >= maxLevels;
  };

  const openDetailsModal = (submission: SubmittedFormData) => {
    setSelectedSubmissionForDetails(submission);
    setIsEditingDetailsRecruiter(false);
    setIsDetailsModalOpen(true);
  };

  const openApprovalModal = (submission: SubmittedFormData) => {
    setApprovalTargetSubmission(submission);
    setCustomEmployeeId(submission.employeeId || '');
    setCustomJoiningDate(new Date().toISOString().split('T')[0]);
    setSelectedRecruiterId((submission as any).recruitedBy || '');
    setEmployeeIdError('');
    setAdminComments('');
    setIsBypassMode(false);

    // Detect all available form fields across sections
    const activeSections = (submission.originalFormSections && submission.originalFormSections.length > 0)
      ? submission.originalFormSections
      : formSections;

    const allFormFields = activeSections.flatMap(sec =>
      (sec.fields || []).map(f => ({
        ...f,
        sectionTitle: sec.title || 'General'
      }))
    ).filter(f => f && f.type !== FieldType.HEADER && f.type !== FieldType.INFO_TEXT);

    // Detect empty or placeholder fields
    const emptyOrPlaceholderFields = allFormFields.filter(f => {
      const val = submission.data?.[f.id];
      return isFieldEmptyOrPlaceholder(val);
    });

    // Suggested fields: all empty or placeholder fields, PLUS priority compliance fields
    const suggested = allFormFields.filter(f => {
      const val = submission.data?.[f.id];
      return isFieldEmptyOrPlaceholder(val) || isComplianceOrPriorityField(f);
    });
    setDetectedEmptyFields(suggested);

    // Pre-select fields:
    // If empty/placeholder fields exist, pre-select them.
    // Otherwise pre-select priority compliance fields so HR has an easy baseline.
    const initialSelected = emptyOrPlaceholderFields.length > 0
      ? emptyOrPlaceholderFields.map(f => f.id)
      : allFormFields.filter(isComplianceOrPriorityField).map(f => f.id);

    setSelectedPendingFields(initialSelected);
    setProfileCompletionOption('COMPLETE');
    setPendingNote('');
    setPendingFieldSearch('');
    setPendingFieldViewFilter('SUGGESTED');

    setIsApprovalModalOpen(true);
  };

  const getEffectiveDuplicateCheck = (sub: SubmittedFormData | null): DuplicateCheckResult | null => {
    if (!sub) return null;

    // ONLY check and flag submissions that are currently PENDING. Never flag approved, hired, or rejected submissions!
    const isPending = (sub.status as any) === SubmissionStatus.PENDING_REVIEW || (sub.status as any) === 'Pending Review' || (sub.status as any) === 'Pending';
    if (!isPending) return null;

    const currentForm = { ...(sub.formData || {}), ...(sub.data || {}) };
    const currentSections = sub.originalFormSections || formSections;
    const currentPan = sub.panNumber || getApplicantPAN(currentForm, currentSections);
    const currentAadhaar = sub.aadhaarNumber || getApplicantAadhaar(currentForm, currentSections);
    const currentUan = sub.uanNumber || getApplicantUAN(currentForm, currentSections);
    const currentPhone = sub.phoneNumber || getApplicantPhone(currentForm, currentSections);

    const isDummyVal = (val: string): boolean => {
      const clean = val.trim().toLowerCase();
      if (!clean) return true;
      if (['na', 'n/a', 'none', 'nil', 'null', 'dummy', 'test', 'unknown'].includes(clean)) return true;
      if (/^(\d)\1+$/.test(clean)) return true;
      if (clean === '1234567890' || clean === '0123456789') return true;
      return false;
    };

    const checkMatchStillActive = (m: DuplicateMatchItem): boolean => {
      const { matchedField, matchedValue, matchType, submissionId } = m;
      if (!matchedField || !matchedValue) return true;

      // 1. Check if the CURRENT submission still has this value
      if (matchedField === 'PAN Card') {
        if (currentPan && currentPan.trim().toUpperCase() !== matchedValue.trim().toUpperCase()) return false;
      } else if (matchedField === 'Aadhaar Number') {
        if (currentAadhaar && currentAadhaar.trim() !== matchedValue.trim()) return false;
      } else if (matchedField === 'UAN Number') {
        if (currentUan && currentUan.trim() !== matchedValue.trim()) return false;
      } else if (matchedField === 'Phone Number') {
        if (currentPhone && currentPhone.trim() !== matchedValue.trim()) return false;
      }

      // 2. If it's a DUPLICATE_SUBMISSION, verify against the OTHER submission in submittedForms
      if (matchType === 'DUPLICATE_SUBMISSION' && submissionId) {
        const otherSub = submittedForms.find(s => s.id === submissionId || (s as any).submissionId === submissionId);
        if (otherSub) {
          // If the other submission is NOT pending (e.g. rejected or deleted), it is no longer an active conflict
          const isOtherPending = otherSub.status === SubmissionStatus.PENDING_REVIEW || otherSub.status === 'Pending Review' || otherSub.status === 'Pending';
          if (!isOtherPending || (otherSub as any).isDeleted || otherSub.status === SubmissionStatus.REJECTED) {
            return false;
          }

          const otherForm = { ...(otherSub.formData || {}), ...(otherSub.data || {}) };
          const otherSections = otherSub.originalFormSections || formSections;

          if (matchedField === 'PAN Card') {
            const otherPan = otherSub.panNumber || getApplicantPAN(otherForm, otherSections);
            if (otherPan && otherPan.trim().toUpperCase() !== matchedValue.trim().toUpperCase()) return false;
          } else if (matchedField === 'Aadhaar Number') {
            const otherAadhaar = otherSub.aadhaarNumber || getApplicantAadhaar(otherForm, otherSections);
            if (otherAadhaar && otherAadhaar.trim() !== matchedValue.trim()) return false;
          } else if (matchedField === 'UAN Number') {
            const otherUan = otherSub.uanNumber || getApplicantUAN(otherForm, otherSections);
            if (otherUan && otherUan.trim() !== matchedValue.trim()) return false;
          } else if (matchedField === 'Phone Number') {
            const otherPhone = otherSub.phoneNumber || getApplicantPhone(otherForm, otherSections);
            if (otherPhone && otherPhone.trim() !== matchedValue.trim()) return false;
          }
        }
      }

      return true;
    };

    // Filter existing stored matches (e.g. active employee matches, rehires, placeholders)
    const rawMatches: DuplicateMatchItem[] = sub.duplicateCheck?.matches && sub.duplicateCheck.matches.length > 0
      ? sub.duplicateCheck.matches
      : sub.duplicateCheck?.isDuplicate
        ? [{
            matchType: sub.duplicateCheck.matchType || 'DUPLICATE_SUBMISSION',
            matchedField: sub.duplicateCheck.matchedField || 'PAN Card',
            matchedValue: sub.duplicateCheck.matchedValue || '',
            matchedId: sub.duplicateCheck.matchedId,
            matchedName: sub.duplicateCheck.matchedName,
            matchedSite: sub.duplicateCheck.matchedSite,
            relievingDate: sub.duplicateCheck.relievingDate,
            relievingReason: sub.duplicateCheck.relievingReason,
            submissionId: sub.duplicateCheck.submissionId,
            submissionStatus: sub.duplicateCheck.submissionStatus,
            details: sub.duplicateCheck.details || ''
          }]
        : [];

    const activeMatches: DuplicateMatchItem[] = rawMatches.filter(m => checkMatchStillActive(m));

    // LIVE IN-MEMORY BIDIRECTIONAL CROSS-CHECK across other PENDING submissions
    // (Zero extra Firestore reads, runs in <1ms in memory)
    for (const other of submittedForms) {
      if (other.id === sub.id) continue;
      const isOtherPending = other.status === SubmissionStatus.PENDING_REVIEW || other.status === 'Pending Review' || other.status === 'Pending';
      if (!isOtherPending || (other as any).isDeleted || other.status === SubmissionStatus.REJECTED) continue;

      const otherForm = { ...(other.formData || {}), ...(other.data || {}) };
      const otherSections = other.originalFormSections || formSections;
      const otherPan = other.panNumber || getApplicantPAN(otherForm, otherSections);
      const otherAadhaar = other.aadhaarNumber || getApplicantAadhaar(otherForm, otherSections);
      const otherUan = other.uanNumber || getApplicantUAN(otherForm, otherSections);
      const otherPhone = other.phoneNumber || getApplicantPhone(otherForm, otherSections);

      const otherName = getApplicantName(otherForm, otherSections) || other.applicantName || 'Applicant';
      const otherSite = other.siteName || 'N/A';

      const checkField = (field: 'Aadhaar Number' | 'PAN Card' | 'Phone Number' | 'UAN Number', curVal?: string | null, othVal?: string | null) => {
        if (!curVal || !othVal) return;
        const c = curVal.trim();
        const o = othVal.trim();
        if (!c || !o || isDummyVal(c) || isDummyVal(o)) return;

        const isMatch = field === 'PAN Card' ? c.toUpperCase() === o.toUpperCase() : c === o;
        if (!isMatch) return;

        // Check if already in activeMatches
        const exists = activeMatches.some(m => m.matchedField === field && (m.submissionId === other.id || (m as any).submissionId === (other as any).submissionId));
        if (!exists) {
          activeMatches.push({
            matchType: 'DUPLICATE_SUBMISSION',
            matchedField: field,
            matchedValue: c,
            submissionId: other.id,
            matchedName: otherName,
            matchedSite: otherSite,
            submissionStatus: other.status || 'Pending Review',
            details: `Matches pending submission (${otherName} - ${otherSite}) on ${field} (${c}).`
          });
        }
      };

      checkField('Aadhaar Number', currentAadhaar, otherAadhaar);
      checkField('PAN Card', currentPan, otherPan);
      checkField('Phone Number', currentPhone, otherPhone);
      checkField('UAN Number', currentUan, otherUan);
    }

    if (activeMatches.length === 0) {
      return null;
    }

    // Sort: ACTIVE_EMPLOYEE > DUPLICATE_SUBMISSION > EX_EMPLOYEE_REHIRE > PLACEHOLDER_VALUE
    const priorityOrder: Record<string, number> = {
      'EXISTING_ACTIVE_EMPLOYEE': 1,
      'DUPLICATE_SUBMISSION': 2,
      'EX_EMPLOYEE_REHIRE': 3,
      'PLACEHOLDER_VALUE': 4
    };
    activeMatches.sort((a, b) => (priorityOrder[a.matchType] || 99) - (priorityOrder[b.matchType] || 99));

    const primary = activeMatches[0];
    return {
      isDuplicate: true,
      matches: activeMatches,
      matchType: primary.matchType,
      matchedField: primary.matchedField,
      matchedValue: primary.matchedValue,
      matchedId: primary.matchedId,
      matchedName: primary.matchedName,
      matchedSite: primary.matchedSite,
      relievingDate: primary.relievingDate,
      relievingReason: primary.relievingReason,
      submissionId: primary.submissionId,
      submissionStatus: primary.submissionStatus,
      details: activeMatches.length > 1
        ? `${activeMatches.length} Duplicate Conflicts Detected: ` + activeMatches.map(m => `${m.matchedField} (${m.matchedValue})`).join(', ')
        : primary.details
    };
  };

  const renderDuplicateAlertBanner = (sub: SubmittedFormData | null) => {
    const dup = getEffectiveDuplicateCheck(sub);
    if (!dup || !dup.isDuplicate || !dup.matches || dup.matches.length === 0) return null;

    const isFinal = isFinalStep(sub) || isBypassMode;
    const hasActiveEmp = dup.matches.some(m => m.matchType === 'EXISTING_ACTIVE_EMPLOYEE');
    const hasDupSub = dup.matches.some(m => m.matchType === 'DUPLICATE_SUBMISSION');
    const hasRehire = dup.matches.some(m => m.matchType === 'EX_EMPLOYEE_REHIRE');
    const hasPlaceholder = dup.matches.some(m => m.matchType === 'PLACEHOLDER_VALUE');
    const hasBlocking = hasActiveEmp || (isFinal && hasDupSub);

    return (
      <div className={`p-4 rounded-xl border mb-3 shadow-xs transition-all ${
        hasBlocking
          ? 'bg-red-50/95 border-red-300'
          : hasDupSub
            ? 'bg-orange-50/95 border-orange-300'
            : 'bg-amber-50/95 border-amber-300'
      }`}>
        {/* Full-width Top Row: Shield Icon, Clear Title, and Status Pill */}
        <div className="flex items-center justify-between gap-3 flex-wrap pb-2.5 border-b border-gray-200/70">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`p-1.5 rounded-lg shrink-0 ${
              hasBlocking
                ? 'bg-red-100 text-red-700'
                : hasDupSub
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-amber-100 text-amber-700'
            }`}>
              <ShieldAlert size={20} />
            </div>
            <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
              {dup.matches.length > 1
                ? (hasBlocking || hasDupSub
                    ? `Multiple Duplicate Conflicts Detected (${dup.matches.length} Fields)`
                    : hasPlaceholder && !hasRehire
                      ? `Placeholder Fields Detected (${dup.matches.length} Fields)`
                      : `Multiple Review Notices (${dup.matches.length} Fields)`)
                : hasActiveEmp
                  ? 'Active Employee Match Detected'
                  : hasRehire
                    ? 'Ex-Employee Rehire Detected'
                    : hasPlaceholder
                      ? 'Placeholder Field Detected'
                      : 'Duplicate Submission Detected'}
            </h4>
          </div>

          <span className={`px-2.5 py-0.5 text-[10px] font-extrabold uppercase rounded border shrink-0 ${
            hasBlocking
              ? 'bg-red-200 text-red-900 border-red-300'
              : hasDupSub
                ? 'bg-orange-200 text-orange-900 border-orange-300'
                : hasRehire
                  ? 'bg-amber-200 text-amber-900 border-amber-300'
                  : 'bg-amber-200 text-amber-950 border-amber-300'
          }`}>
            {hasBlocking
              ? 'Approval Blocked'
              : hasDupSub
                ? 'Action Required'
                : hasRehire
                  ? 'Rehire Allowed'
                  : 'Incomplete Profile Suggested'}
          </span>
        </div>

        {/* Informational Guidance Text */}
        <p className="text-xs text-gray-700 mt-2.5 mb-2.5 font-medium leading-relaxed">
          {hasActiveEmp
            ? 'This applicant matches an existing active employee. Hover on any field name below to inspect conflict details:'
            : (isFinal && hasDupSub)
              ? 'This applicant matches existing records on multiple fields. All duplicates must be resolved or corrected. Hover on any field name below to view details:'
              : hasRehire
                ? 'This applicant was previously employed with UDF. Hover on any field name below to inspect past records:'
                : hasPlaceholder && !hasDupSub
                  ? 'Candidate entered dummy/placeholder digits (e.g. UAN 0000). Non-blocking — hover on any field name below to view details:'
                  : 'This applicant matches existing records. Hover on any field name below to view details:'}
        </p>

        {/* Dedicated Row for Field Badges - ample horizontal space */}
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <CompactDuplicateBadges matches={dup.matches} isFinalStep={isFinal} />
        </div>
      </div>
    );
  };

  const handleConfirmApproval = async () => {
    if (!approvalTargetSubmission || isSubmittingApproval) return;

    const isFinal = isFinalStep(approvalTargetSubmission) || isBypassMode;

    if (isFinal) {
      const effectiveDup = getEffectiveDuplicateCheck(approvalTargetSubmission);
      const blockingMatches = effectiveDup?.matches?.filter(m =>
        m.matchType === 'EXISTING_ACTIVE_EMPLOYEE' || (isFinal && m.matchType === 'DUPLICATE_SUBMISSION')
      ) || ((effectiveDup?.matchType === 'EXISTING_ACTIVE_EMPLOYEE' || (isFinal && effectiveDup?.matchType === 'DUPLICATE_SUBMISSION')) ? [effectiveDup] : []);

      // 1. HARD BLOCK ON ACTIVE EMPLOYEE OR DUPLICATE SUBMISSION
      if (effectiveDup?.isDuplicate && blockingMatches.length > 0) {
        const conflictDetails = blockingMatches.map((m, i) => `${i + 1}. ${m.matchedField}: "${m.matchedValue}" (${m.matchType === 'EXISTING_ACTIVE_EMPLOYEE' ? `Active Emp: ${m.matchedName || m.matchedId}` : `Submission: ${m.submissionId || 'Earlier App'}, Status: ${m.submissionStatus || 'Pending'}`}, Site: ${m.matchedSite || 'N/A'})`).join('\n');
        alert(
          `❌ CANNOT APPROVE / ASSIGN ID: DUPLICATE CONFLICTS DETECTED!\n\n` +
          `Conflicting application records found:\n${conflictDetails}\n\n` +
          `Strict Security Rule: Final approval and Employee ID assignment are strictly blocked for duplicate submissions.\n\nPlease reject or resolve the duplicate submission before proceeding.`
        );
        return;
      }

      // 2. CONFIRMATION FOR EX-EMPLOYEE REHIRE
      if (effectiveDup?.isDuplicate && effectiveDup.matchType === 'EX_EMPLOYEE_REHIRE') {
        const confirmRehire = window.confirm(
          `⚠️ NOTICE: EX-EMPLOYEE REHIRE DETECTED\n\n` +
          `Candidate: ${effectiveDup.matchedName}\n` +
          `Previous Employee ID: ${effectiveDup.matchedId}\n` +
          `Relieved Date: ${effectiveDup.relievingDate || 'N/A'}\n` +
          `Relieving Reason: ${effectiveDup.relievingReason || 'N/A'}\n\n` +
          `Do you confirm approving this candidate as a rehire under new Employee ID "${customEmployeeId.trim()}"?`
        );
        if (!confirmRehire) {
          return;
        }
      }

      if (!customEmployeeId.trim()) {
        setEmployeeIdError('Employee ID is required for final approval.');
        return;
      }
      if (!EMPLOYEE_ID_REGEX.test(customEmployeeId.trim())) {
        setEmployeeIdError('Invalid format (e.g., HY123456).');
        return;
      }
    } else if (customEmployeeId.trim()) {
      const effectiveDup = getEffectiveDuplicateCheck(approvalTargetSubmission);
      if (effectiveDup?.isDuplicate && effectiveDup.matchType === 'DUPLICATE_SUBMISSION') {
        alert(
          `❌ CANNOT ASSIGN ID: DUPLICATE SUBMISSION DETECTED!\n\n` +
          `Another submission (${effectiveDup.submissionId}) matches this applicant's ${effectiveDup.matchedField} (${effectiveDup.matchedValue}).\n\n` +
          `Employee ID assignment is blocked for duplicate submissions.`
        );
        return;
      }
      if (!EMPLOYEE_ID_REGEX.test(customEmployeeId.trim())) {
        setEmployeeIdError('Invalid format (e.g., HY123456).');
        return;
      }
    }

    if (isFinal && profileCompletionOption === 'INCOMPLETE' && selectedPendingFields.length === 0) {
      alert("⚠️ You selected 'Incomplete Profile', but no pending fields are selected.\n\nPlease select at least one field requiring completion/correction, or switch the status to 'Complete Profile'.");
      return;
    }

    const profileData = isFinal ? {
      profileCompletionStatus: profileCompletionOption,
      pendingProfileFields: profileCompletionOption === 'INCOMPLETE' ? selectedPendingFields : [],
      pendingProfileNote: profileCompletionOption === 'INCOMPLETE' ? pendingNote.trim() : ''
    } : undefined;

    let customRecruiter: { id: string | null; name: string | null } | undefined = undefined;
    if (effectiveIsSuperAdmin) {
      if (selectedRecruiterId) {
        const foundStaff = (staffUsers || []).find(s => s.id === selectedRecruiterId);
        customRecruiter = {
          id: selectedRecruiterId,
          name: foundStaff?.name || foundStaff?.username || 'Staff'
        };
      } else {
        customRecruiter = { id: null, name: null };
      }
    }

    setIsSubmittingApproval(true);
    try {
      await onApprove(approvalTargetSubmission.id, customEmployeeId.trim(), adminComments, false, isBypassMode, profileData, customJoiningDate, customRecruiter);
      const nextLevel = approvalTargetSubmission.currentLevel + 1;
      setPaginatedData(prev => prev.map(sub => 
        sub.id === approvalTargetSubmission.id 
          ? { ...sub, currentLevel: isFinal ? sub.currentLevel : nextLevel, status: isFinal ? SubmissionStatus.APPROVED : sub.status, employeeId: customEmployeeId.trim() || sub.employeeId }
          : sub
      ));
      setIsApprovalModalOpen(false);
    } catch (err: any) {
      console.error("Approval error:", err);
      alert(`Approval failed: ${err.message || 'Permission denied or network error'}`);
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  const handleReject = async () => {
    if (!approvalTargetSubmission || isSubmittingApproval) return;
    if (!adminComments.trim()) {
      alert("Please provide a reason for rejection in the comments.");
      return;
    }
    setIsSubmittingApproval(true);
    try {
      await onApprove(approvalTargetSubmission.id, '', adminComments, true, isBypassMode);
      setIsApprovalModalOpen(false);
    } catch (err: any) {
      console.error("Rejection error:", err);
      alert(`Rejection failed: ${err.message || 'Permission denied or network error'}`);
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  const handleRevert = async (targetLevel?: number) => {
    if (!approvalTargetSubmission || !onRevert) return;
    const siteName = String(approvalTargetSubmission.data?.['52ae217b-2602-4337-a1cd-a1f9bd36a4b0'] || '');
    const site = sites?.find(s => s.name === siteName || s.id === siteName);
    const effectiveLevel = getEffectiveApprovalLevel(approvalTargetSubmission.currentLevel, site, config, staffUsers, allRoles);
    
    const levelToRevert = targetLevel !== undefined ? targetLevel : (isSuperAdmin ? revertTargetLevel : (effectiveLevel - 1));

    if (levelToRevert < 1) {
      alert("Cannot revert below Level 1.");
      return;
    }

    if (window.confirm(`Are you sure you want to revert this submission to Level ${levelToRevert}? This will return it to the previous approval stage.`)) {
      try {
        await onRevert(approvalTargetSubmission.id, levelToRevert, adminComments);
        setIsApprovalModalOpen(false);
        setApprovalTargetSubmission(null);
        setAdminComments('');
        loadMoreData(true);
      } catch (err: any) {
        alert(`Revert Failed: ${err.message}`);
      }
    }
  };

  const handleSaveEditedComment = async (index: number) => {
    if (!onUpdateComment || !approvalTargetSubmission) return;
    try {
      await onUpdateComment(approvalTargetSubmission.id, index, editingCommentValue);
      // Update local state so it reflects immediately
      setApprovalTargetSubmission(prev => {
        if (!prev) return null;
        const nextHistory = [...prev.approvalHistory];
        nextHistory[index] = { ...nextHistory[index], comments: editingCommentValue };
        return { ...prev, approvalHistory: nextHistory };
      });
      setEditingHistoryIndex(null);
    } catch (err: any) {
      alert(`Failed to save comment: ${err.message}`);
    }
  };


  const filteredSubmissions = useMemo(() => {
    // Field officers with no site assignments see nothing
    // Managers/HR with SUBMISSIONS_VIEW_SCOPE_ALL see everything
    if (!hasViewScopeAll && (!effectiveAllowedSiteIds || effectiveAllowedSiteIds.length === 0)) {
      return [];
    }

    // Prefer paginated data if available
    const source = paginatedData.length > 0
      ? paginatedData
      : (submittedForms || []);

    return source.filter(sub => {
      if (!sub || !sub.data) return false;

      // Exclude pending profile bulk imports - they belong in Master List's Pending Profiles tab
      // BUT keep approved submissions that have pending fields (needsProfileCompletion) visible
      if ((sub as any).needsProfileCompletion === true && sub.status !== SubmissionStatus.APPROVED) return false;
      if (sub.status === SubmissionStatus.PENDING_PROFILE) return false;

      // Status filtering is now handled mostly at DB level, but we keep a local check for safety
      if (filterStatus && filterStatus !== 'ALL' && sub.status !== filterStatus) return false;

      if (!isSubmissionInAllowedSites(sub)) return false;

      if (searchTerm && searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        const appName = (getApplicantName(sub.data, sub.originalFormSections) || '').toLowerCase();
        const recruiter = (sub.recruitedByName || '').toLowerCase();
        const inviteId = (sub.inviteId || '').toLowerCase();
        if (!appName.includes(term) && !recruiter.includes(term) && !inviteId.includes(term)) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
    });
  }, [paginatedData, submittedForms, filterStatus, searchTerm, sites, authUser, effectiveIsSuperAdmin, hasManagePerm, userRole, allowedSitesKey]);

  const renderReadOnlyField = (field: FormField, value: any, submission?: SubmittedFormData) => {
    const displayValue = (val: any) => {
      if (val === null || val === undefined || String(val).trim() === '') return <span className="italic text-gray-500">Not Provided</span>;

      if (field.type === FieldType.FILE_UPLOAD) {
        let valPath = typeof val === 'object' && val !== null && 'storagePath' in val
          ? val.storagePath
          : (typeof val === 'string' ? val : null);

        // Self-healing: For approved submissions, remap onboarding/ paths to employees/ paths
        // because files are physically moved during approval
        if (valPath) {
          valPath = remapOnboardingPathToEmployeePath(valPath, submission);
        }

        if (typeof valPath === 'string' && valPath.length > 0) {
          if (!hasPermission(Permission.SUBMISSIONS_PREVIEW_DOCS)) {
            return (
              <span className="text-red-500 font-medium text-xs flex items-center">
                <ShieldAlert size={12} className="mr-1" /> Access Restricted
              </span>
            );
          }
          return <SecureDocumentLink path={valPath} />;
        }
        // If it's a File object (legacy local state) or just a name
        if (val instanceof File) return val.name;
        if (typeof val === 'object' && val !== null && 'driveUrl' in val && typeof val.driveUrl === 'string') {
          if (!hasPermission(Permission.SUBMISSIONS_PREVIEW_DOCS)) {
            return (
              <span className="text-red-500 font-medium text-xs flex items-center">
                <ShieldAlert size={12} className="mr-1" /> Access Restricted
              </span>
            );
          }
          return <a href={val.driveUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">View in Drive</a>;
        }
        return String(val);
      }

      if (Array.isArray(val)) return val.join(', ') || <span className="italic text-gray-500">No selection</span>;
      
      const strVal = String(val);
      const isSiteField = field.id === SITE_FIELD_ID ||
        field.label.toLowerCase().includes('unit') ||
        field.label.toLowerCase().includes('facility') ||
        field.label.toLowerCase().includes('site');

      if (isSiteField || sites?.some(s => s.id === strVal) || defaultSites?.some(s => s.id === strVal)) {
        const foundSite = sites?.find(s => s.id === strVal || s.name.toLowerCase() === strVal.toLowerCase()) ||
          defaultSites?.find(s => s.id === strVal || s.name.toLowerCase() === strVal.toLowerCase());
        if (foundSite) return foundSite.name;
      }

      if (field.options && field.options.length > 0) {
        const matchedOpt = (field.options as any[]).find(opt => 
          typeof opt === 'string' ? opt === strVal : (opt?.value === strVal || opt?.id === strVal || opt?.label === strVal)
        );
        if (matchedOpt) return typeof matchedOpt === 'string' ? matchedOpt : (matchedOpt.label || matchedOpt.value || strVal);
      }

      return strVal;
    };

    return (
      <div className="mb-2" key={field.id}>
        <label className="block text-xs font-medium text-gray-600 mb-0.5">{field.label}</label>
        <div className="text-sm text-gray-700 p-2 border rounded-md bg-gray-50 min-h-[38px] flex items-center">
          {displayValue(value)}
        </div>
      </div>
    );
  };


  return (
    <div className="p-0">
      <div className="mb-8 p-6 bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2 flex items-center">
              <ListChecks className="mr-2 text-blue-600" /> Pending Approval Pipeline
            </h3>
            <p className="text-sm text-gray-500">Showing {filteredSubmissions.length} of {
              submittedForms.filter(s => (!((s as any).needsProfileCompletion === true && s.status !== SubmissionStatus.APPROVED)) && s.status !== SubmissionStatus.PENDING_PROFILE && isSubmissionInAllowedSites(s)).length
            } applications</p>
          </div>
          <div className="flex space-x-2 flex-wrap gap-y-2">
            {(() => {
              // Filter out pending profile submissions from all counts and respect site restrictions
              const validForms = submittedForms.filter(s => {
                if ((s as any).needsProfileCompletion === true && s.status !== SubmissionStatus.APPROVED) return false;
                if (s.status === SubmissionStatus.PENDING_PROFILE) return false;
                return isSubmissionInAllowedSites(s);
              });
              return [
                { label: 'Total', value: 'ALL', count: validForms.length },
                { label: 'Pending', value: SubmissionStatus.PENDING_REVIEW, count: validForms.filter(s => s.status === SubmissionStatus.PENDING_REVIEW).length },
                { label: 'Approved', value: SubmissionStatus.APPROVED, count: validForms.filter(s => s.status === SubmissionStatus.APPROVED).length },
                { label: 'Rejected', value: SubmissionStatus.REJECTED, count: validForms.filter(s => s.status === SubmissionStatus.REJECTED).length },
              ];
            })().map(filter => (
              <Button
                key={filter.value}
                variant={filterStatus === filter.value || (filter.value === 'ALL' && !['Pending Review', 'Approved', 'Rejected'].includes(filterStatus)) ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setFilterStatus(filter.value)}
                className={filterStatus === filter.value ? '' : 'bg-gray-50 border-gray-200 text-gray-600'}
              >
                {filter.label} ({filter.count})
              </Button>
            ))}

            {userRole?.name.toLowerCase().includes('field officer') && (
              <div className="bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-md text-xs font-bold flex items-center">
                <Shield size={14} className="mr-2" /> Showing Assigned Sites Only
              </div>
            )}
            {!hasManagePerm && !isSuperAdmin && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 rounded-md text-xs font-bold flex items-center">
                <Info size={14} className="mr-2" /> READ-ONLY ACCESS
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <Input
              className="pl-10 h-10 border-gray-200 focus:border-blue-400 focus:ring-blue-400"
              placeholder="Search applicants by name..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
            <Info size={12} className="mr-2 text-blue-400" />
            Prefix Search: Type first few letters of a name
          </div>
        </div>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-x-auto border border-gray-200">
        <table className="min-w-[650px] w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applicant</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Step</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredSubmissions.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-400 italic">No submissions to display.</td></tr>
            ) : filteredSubmissions.map(sub => (
              <tr key={sub.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900 min-w-[180px]">
                  <div className="font-semibold text-gray-900">{getApplicantName(sub.data, sub.originalFormSections) || 'N/A'}</div>
                  {(() => {
                    const dup = getEffectiveDuplicateCheck(sub);
                    if (!dup?.isDuplicate) return null;
                    const isFinal = isFinalStep(sub);
                    if (dup.matches && dup.matches.length > 1) {
                      const hasBlocking = dup.matches.some(m => m.matchType === 'EXISTING_ACTIVE_EMPLOYEE' || (isFinal && m.matchType === 'DUPLICATE_SUBMISSION'));
                      return (
                        <div className="mt-1">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            hasBlocking ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-orange-100 text-orange-800 border border-orange-200'
                          }`}>
                            <AlertTriangle size={10} className={`mr-1 ${hasBlocking ? 'text-red-600' : 'text-orange-600'}`} />
                            {hasBlocking ? `Duplicate Blocked (${dup.matches.length})` : `Duplicates (${dup.matches.length})`}
                          </span>
                        </div>
                      );
                    }
                    if (dup.matchType === 'EXISTING_ACTIVE_EMPLOYEE') {
                      return (
                        <div className="mt-1">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                            <AlertTriangle size={10} className="mr-1 text-red-600" /> Active Match ({dup.matchedId})
                          </span>
                        </div>
                      );
                    }
                    if (dup.matchType === 'EX_EMPLOYEE_REHIRE') {
                      return (
                        <div className="mt-1">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <RotateCcw size={10} className="mr-1 text-amber-600" /> Rehire ({dup.matchedId})
                          </span>
                        </div>
                      );
                    }
                    if (dup.matchType === 'PLACEHOLDER_VALUE') {
                      return (
                        <div className="mt-1">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                            <AlertTriangle size={10} className="mr-1 text-amber-600" /> Dummy Data ({dup.matchedField})
                          </span>
                        </div>
                      );
                    }
                    return (
                      <div className="mt-1">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          isFinal ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-orange-100 text-orange-800 border border-orange-200'
                        }`}>
                          <AlertTriangle size={10} className={`mr-1 ${isFinal ? 'text-red-600' : 'text-orange-600'}`} />
                          {isFinal ? 'Duplicate (ID Blocked)' : 'Duplicate App'}
                        </span>
                      </div>
                    );
                  })()}
                  <div className="mt-1">
                    {sub.recruitedByName ? (
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200"
                        title={sub.inviteId ? `Referred via Invite Code: ${sub.inviteId}` : `Referred by ${sub.recruitedByName}`}
                      >
                        <UserPlus size={10} className="mr-1 text-purple-600" /> Ref: {sub.recruitedByName}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200" title="Applied directly with no referral code">
                        Direct Apply
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  {sub.status === SubmissionStatus.PENDING_REVIEW ? (
                    <span className="flex items-center">
                      <Clock size={14} className="mr-1 text-blue-400" />
                      {(() => {
                        const siteName = String(sub.data?.['52ae217b-2602-4337-a1cd-a1f9bd36a4b0'] || '');
                        const site = sites?.find(s => s.name === siteName || s.id === siteName);
                        const effectiveLevel = getEffectiveApprovalLevel(sub.currentLevel, site, config, staffUsers, allRoles);
                        const lvlConfig = config?.levels.find(l => l.level === effectiveLevel);
                        const rName = allRoles.find(r => r.id === lvlConfig?.roleId)?.name || `Role ${lvlConfig?.roleId || ''}`;
                        return `Level ${effectiveLevel}: ${rName}`;
                      })()}
                    </span>
                  ) : sub.status === SubmissionStatus.PENDING_PROFILE ? (
                    <span className="flex items-center text-amber-600 font-medium">
                      <Clock size={14} className="mr-1" />
                      Profile Pending
                    </span>
                  ) : sub.status === SubmissionStatus.APPROVED ? (
                    <span className="flex items-center gap-1">
                      <span className="flex items-center text-green-600 font-medium">
                        <CheckCircle size={14} className="mr-1" />
                        Completed
                      </span>
                      {(sub as any).needsProfileCompletion === true && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                          Pending Fields
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="flex items-center text-red-600 font-medium">
                      <XCircle size={14} className="mr-1" />
                      Closed
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${sub.status === SubmissionStatus.APPROVED ? 'bg-green-100 text-green-700' :
                    sub.status === SubmissionStatus.REJECTED ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                    {sub.status}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right space-x-2">
                  <Button variant="ghost" size="sm" onClick={() => openDetailsModal(sub)} className="inline-flex items-center">
                    <Eye size={14} className="mr-1" /> View
                  </Button>
                  {canReview(sub) && (
                    <Button variant="primary" size="sm" onClick={() => openApprovalModal(sub)}>
                      {isFinalStep(sub) ? 'Final Approval' : 'Review / Approve'}
                    </Button>
                  )}
                  {isSuperAdmin && sub.status !== SubmissionStatus.PENDING_REVIEW && (
                    <Button variant="secondary" size="sm" onClick={() => openApprovalModal(sub)} title="Manage Record">
                      <Settings size={14} />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="secondary"
            onClick={() => loadMoreData(false)}
            disabled={isLoading}
            className="w-full sm:w-auto font-bold bg-white border-blue-200 text-blue-700 hover:bg-blue-50"
          >
            {isLoading ? (
              <span className="flex items-center"><RotateCcw size={16} className="mr-2 animate-spin" /> Loading...</span>
            ) : (
              <span className="flex items-center"><ChevronDown size={16} className="mr-2" /> Load More Submissions</span>
            )}
          </Button>
        </div>
      )}

      {isApprovalModalOpen && approvalTargetSubmission && (
        <Modal
          isOpen={isApprovalModalOpen}
          onClose={() => setIsApprovalModalOpen(false)}
          title={(() => {
            const siteName = String(approvalTargetSubmission.data?.['52ae217b-2602-4337-a1cd-a1f9bd36a4b0'] || '');
            const site = sites?.find(s => s.name === siteName || s.id === siteName);
            const effectiveLevel = getEffectiveApprovalLevel(approvalTargetSubmission.currentLevel, site, config, staffUsers, allRoles);
            return isFinalStep(approvalTargetSubmission) || isBypassMode ? 'Final Review & Onboarding' : `Review Level ${effectiveLevel}`;
          })()}
          size="lg"
        >
          <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-2">
            {isSuperAdmin && approvalTargetSubmission.status === SubmissionStatus.PENDING_REVIEW && (
              <div className="flex items-center text-xs text-amber-600 bg-amber-50 p-2 rounded mb-2">
                <Zap size={14} className="mr-1 text-blue-400" />
                <span>Super Admin Override Enabled</span>
              </div>
            )}

            {(() => {
              const { isAllowed, activeSite, designation } = getDesignationCheck(approvalTargetSubmission);
              if (isAllowed) return null;
              return (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md flex items-start mb-4">
                  <AlertTriangle className="text-red-500 mr-3 mt-0.5 shrink-0" size={18} />
                  <div>
                    <h4 className="text-sm font-bold text-red-800 font-sans">Designation Mismatch Warning</h4>
                    <p className="text-xs text-red-700 mt-1 font-sans">
                      The candidate's selected designation (<strong>{designation}</strong>) is not in the authorized designation list for their selected site (<strong>{activeSite?.name}</strong>).
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Duplicate / Rehire Alert Banner */}
            {renderDuplicateAlertBanner(approvalTargetSubmission)}

            {/* Candidate Summary Card */}
            {(() => {
              const sub = approvalTargetSubmission;
              const name = getApplicantName(sub.data, sub.originalFormSections) || 'N/A';
              const designation = String(getFieldValue(sub, 'db307195-cf54-4a6e-9056-f3974b050c4d', 'Post of Apply') || getFieldValue(sub, 'db307195-cf54-4a6e-9056-f3974b050c4d', 'Designation') || 'N/A');
              const rawSite = String(getFieldValue(sub, '52ae217b-2602-4337-a1cd-a1f9bd36a4b0', 'Unit or Facility') || sub.siteName || sub.siteId || '');
              const foundSite = sites?.find(s => s.id === rawSite || s.name.toLowerCase() === rawSite.toLowerCase()) ||
                defaultSites?.find(s => s.id === rawSite || s.name.toLowerCase() === rawSite.toLowerCase());
              const siteDisplay = foundSite?.name || rawSite || 'N/A';
              const phone = String(getFieldValue(sub, 'eb3617dc-9f1d-475d-a2db-005b6bc2500c', 'Phone Number') || 'N/A');
              const submissionDate = sub.submissionDate ? formatDate(sub.submissionDate) : (sub.timestamp ? formatDate(sub.timestamp) : 'N/A');

              return (
                <div className="bg-gradient-to-r from-slate-50 to-blue-50/40 p-4 rounded-xl border border-blue-100 shadow-sm space-y-3">
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <div>
                      <span className="text-[10px] font-black uppercase text-blue-600 tracking-wider">Candidate Summary</span>
                      <h3 className="text-base font-bold text-slate-800">{name}</h3>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSelectedSubmissionForDetails(sub);
                        setIsDetailsModalOpen(true);
                      }}
                      className="text-xs bg-white hover:bg-blue-50 text-blue-700 border-blue-200 font-semibold flex items-center gap-1 shadow-sm"
                    >
                      <Eye size={13} /> View Full Profile
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-blue-100/60 text-xs">
                    <div>
                      <p className="text-slate-400 font-medium text-[11px]">Designation</p>
                      <p className="font-bold text-slate-700 mt-0.5">{designation}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-medium text-[11px]">Site / Facility</p>
                      <p className="font-bold text-slate-700 mt-0.5">{siteDisplay}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-medium text-[11px]">Contact Phone</p>
                      <p className="font-bold text-slate-700 mt-0.5">{phone}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-medium text-[11px]">Submitted On</p>
                      <p className="font-bold text-slate-700 mt-0.5">{submissionDate}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-medium text-[11px]">Referred By</p>
                      <p className="font-bold text-slate-700 mt-0.5">
                        {sub.recruitedByName ? (
                          <span className="text-purple-700 flex items-center gap-1 font-bold" title={sub.inviteId ? `Invite Code: ${sub.inviteId}` : undefined}>
                            <UserPlus size={11} className="text-purple-600 shrink-0" />
                            <span className="truncate">{sub.recruitedByName}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal italic">Direct Apply</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {approvalTargetSubmission.approvalHistory.length > 0 && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h5 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center"><History size={14} className="mr-1" /> Previous Step History</h5>
                <div className="space-y-3">
                  {approvalTargetSubmission.approvalHistory.map((h, i) => {
                    const isAuthor = h.actionBy === authUser?.name;
                    const canEditComment = hasPermission(Permission.SUBMISSIONS_EDIT_COMMENTS) && (isSuperAdmin || isAuthor);
                    const isEditing = editingHistoryIndex === i;

                    const isRevert = h.status === 'Reverted' || (h.comments && h.comments.includes('[Reverted'));
                    const formattedTime = h.timestamp ? new Date(h.timestamp).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : '';

                    return (
                      <div 
                        key={i} 
                        className={`text-sm border-l-2 pl-3 py-1.5 flex flex-col space-y-1 rounded-r-lg transition-colors ${
                          isRevert ? 'border-amber-400 bg-amber-50/60' : 'border-blue-300 bg-white/60'
                        }`}
                      >
                        <div className="flex justify-between items-center flex-wrap gap-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-800">{h.actionByRole} ({h.actionBy})</span>
                            {isRevert ? (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200">
                                ↺ Reverted
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                                ✓ {h.status || 'Approved'}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {formattedTime && (
                              <span className="text-[11px] text-slate-400 font-normal">{formattedTime}</span>
                            )}
                            {canEditComment && !isEditing && (
                              <button
                                onClick={() => {
                                  setEditingHistoryIndex(i);
                                  setEditingCommentValue(h.comments || '');
                                }}
                                className="text-gray-400 hover:text-blue-600 transition-colors"
                                title="Edit Comment"
                              >
                                <Edit3 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                        {isEditing ? (
                          <div className="mt-1 flex flex-col space-y-1">
                            <textarea
                              className="w-full text-xs p-1.5 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                              value={editingCommentValue}
                              onChange={(e) => setEditingCommentValue(e.target.value)}
                              rows={2}
                            />
                            <div className="flex space-x-1.5 justify-end">
                              <button
                                onClick={() => setEditingHistoryIndex(null)}
                                className="px-2 py-0.5 text-[10px] font-medium border rounded bg-gray-50 hover:bg-gray-100 text-gray-600"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSaveEditedComment(i)}
                                className="px-2 py-0.5 text-[10px] font-medium border rounded bg-blue-600 hover:bg-blue-700 text-white"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          h.comments && <p className="text-xs text-gray-600 italic mt-0.5">"{h.comments}"</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-gray-100 space-y-4">
              {isSuperAdmin && !isFinalStep(approvalTargetSubmission) && (
                <div className="flex items-center space-x-2 bg-blue-50 p-3 rounded-md border border-blue-100 mb-2">
                  <input
                    type="checkbox"
                    id="bypass-workflow"
                    checked={isBypassMode}
                    onChange={(e) => {
                      setIsBypassMode(e.target.checked);
                      if (!e.target.checked) setCustomEmployeeId('');
                    }}
                    className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <label htmlFor="bypass-workflow" className="text-sm font-semibold text-blue-800 flex items-center">
                    <Zap size={14} className="mr-1.5" /> Direct Final Approval (Bypass Workflow)
                  </label>
                </div>
              )}

              {(() => {
                const canAssignId = userRole?.permissions.includes(Permission.SUBMISSIONS_ASSIGN_EMPLOYEE_ID) || isSuperAdmin;
                const showIdInput = isFinalStep(approvalTargetSubmission) || isBypassMode || canAssignId;
                if (!showIdInput) return null;

                const isFinal = isFinalStep(approvalTargetSubmission) || isBypassMode;
                const effectiveDup = getEffectiveDuplicateCheck(approvalTargetSubmission);
                const blockingMatches = effectiveDup?.matches?.filter(m =>
                  m.matchType === 'EXISTING_ACTIVE_EMPLOYEE' || (isFinal && m.matchType === 'DUPLICATE_SUBMISSION')
                ) || ((effectiveDup?.matchType === 'EXISTING_ACTIVE_EMPLOYEE' || (isFinal && effectiveDup?.matchType === 'DUPLICATE_SUBMISSION')) ? [effectiveDup] : []);
                const isDuplicateBlocked = isFinal && effectiveDup?.isDuplicate && blockingMatches.length > 0;

                return (
                  <div className="space-y-4">
                    {isDuplicateBlocked && (
                      <div className="p-3 bg-red-50 border-2 border-red-300 rounded-xl text-red-900 text-xs font-semibold flex items-start gap-2.5">
                        <ShieldAlert size={18} className="text-red-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-red-950 uppercase tracking-wide">
                            {blockingMatches.some(m => m.matchType === 'EXISTING_ACTIVE_EMPLOYEE')
                              ? 'Active Employee Match — ID Assignment Locked'
                              : 'Duplicate Submission Match — ID Assignment Locked'}
                          </p>
                          <p className="text-[11px] text-red-800 mt-0.5">
                            {blockingMatches.length > 1
                              ? `Candidate conflicts with existing records on ${blockingMatches.length} fields (${blockingMatches.map(m => m.matchedField).join(', ')}). All duplicates must be resolved or rejected before assigning an ID.`
                              : blockingMatches[0]?.matchType === 'EXISTING_ACTIVE_EMPLOYEE'
                                ? `Candidate is already an active employee (${blockingMatches[0]?.matchedId} - ${blockingMatches[0]?.matchedName}). Final onboarding cannot proceed.`
                                : `Another submission (${blockingMatches[0]?.submissionId}) exists with status "${blockingMatches[0]?.submissionStatus}". You must reject or resolve that duplicate submission before assigning an ID.`}
                          </p>
                        </div>
                      </div>
                    )}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-gray-700">Assign Unique Employee ID</label>
                        {suggestedNextEmployeeId && !isDuplicateBlocked && (
                          <div className="flex items-center gap-1 text-[11px]">
                            <span className="text-gray-500">Suggested: <strong className="text-blue-700 font-mono font-bold">{suggestedNextEmployeeId}</strong></span>
                            {!customEmployeeId && (
                              <button
                                type="button"
                                onClick={() => setCustomEmployeeId(suggestedNextEmployeeId)}
                                className="text-blue-600 hover:text-blue-800 font-semibold underline cursor-pointer ml-1"
                              >
                                Use
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <Input
                        value={customEmployeeId}
                        onChange={e => setCustomEmployeeId(e.target.value.toUpperCase())}
                        placeholder={`e.g., ${suggestedNextEmployeeId || 'HY140001'}`}
                        error={employeeIdError}
                        disabled={isDuplicateBlocked}
                        helperText="Required for final approval. Format: HY followed by 6 digits (e.g. HY140001)."
                      />
                    </div>

                    <div>
                      <Input
                        label="Official Joining Date"
                        type="date"
                        value={customJoiningDate}
                        onChange={e => setCustomJoiningDate(e.target.value)}
                        helperText="Defaults to today. You can backdate or forward-date the official joining date."
                      />
                    </div>

                    {/* Super Admin Recruiter Selector / Override */}
                    {effectiveIsSuperAdmin && (
                      <div className="bg-purple-50/70 p-3.5 rounded-xl border border-purple-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-black uppercase text-purple-900 tracking-wider flex items-center gap-1.5">
                            <UserPlus size={14} className="text-purple-600" /> Referred By / Recruiter (Super Admin Override)
                          </label>
                          <span className="text-[10px] text-purple-700 font-medium">Controls commission attribution</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={selectedRecruiterId}
                            onChange={e => setSelectedRecruiterId(e.target.value)}
                            className="flex-1 text-xs font-semibold p-2.5 rounded-lg border border-purple-300 bg-white text-slate-800 focus:ring-2 focus:ring-purple-400 focus:outline-none"
                          >
                            <option value="">Direct Apply (No Staff Referral)</option>
                            {(staffUsers || []).filter(s => !s.isDisabled).map(s => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({s.username || s.email})
                              </option>
                            ))}
                          </select>
                          <Button
                            type="button"
                            size="sm"
                            variant="primary"
                            className="bg-purple-600 hover:bg-purple-700 text-xs px-3 py-2.5 shrink-0 font-bold shadow-xs whitespace-nowrap"
                            disabled={isSavingApprovalRecruiter}
                            onClick={async () => {
                              if (!approvalTargetSubmission) return;
                              setIsSavingApprovalRecruiter(true);
                              try {
                                const { updateSubmissionRecruiter } = await import('../src/services/employeeService');
                                const foundStaff = (staffUsers || []).find(s => s.id === selectedRecruiterId);
                                const recPayload = selectedRecruiterId ? {
                                  id: selectedRecruiterId,
                                  name: foundStaff?.name || foundStaff?.username || 'Staff'
                                } : { id: null, name: null };

                                await updateSubmissionRecruiter(approvalTargetSubmission.id, recPayload);

                                setApprovalTargetSubmission(prev => prev ? {
                                  ...prev,
                                  recruitedBy: recPayload.id,
                                  recruitedByName: recPayload.name,
                                  inviteId: recPayload.id ? prev.inviteId : undefined
                                } as any : null);

                                setPaginatedData(prev => prev.map(sub => sub.id === approvalTargetSubmission.id ? {
                                  ...sub,
                                  recruitedBy: recPayload.id,
                                  recruitedByName: recPayload.name,
                                  inviteId: recPayload.id ? sub.inviteId : undefined
                                } as any : sub));

                                alert("Recruiter attribution updated and saved successfully!");
                              } catch (err: any) {
                                alert("Failed to save recruiter: " + err.message);
                              } finally {
                                setIsSavingApprovalRecruiter(false);
                              }
                            }}
                          >
                            {isSavingApprovalRecruiter ? 'Saving...' : 'Save Recruiter'}
                          </Button>
                        </div>
                        <p className="text-[10px] text-purple-700 italic">
                          Click <strong>Save Recruiter</strong> to update attribution immediately without approving, or proceed with Final Approval below.
                        </p>
                      </div>
                    )}

                    {/* Profile Completion Status (Complete vs Incomplete) */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-black uppercase text-slate-600 tracking-wider">
                          Onboarding Profile Status
                        </label>
                        <span className="text-[10px] text-slate-400 font-medium">Controls compliance tracking</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div
                          onClick={() => setProfileCompletionOption('COMPLETE')}
                          className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start gap-2.5 ${
                            profileCompletionOption === 'COMPLETE'
                              ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="radio"
                            id="profile-complete"
                            name="profileCompletionStatus"
                            checked={profileCompletionOption === 'COMPLETE'}
                            onChange={() => setProfileCompletionOption('COMPLETE')}
                            className="mt-0.5 h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                          />
                          <div>
                            <label htmlFor="profile-complete" className="font-bold text-xs text-slate-800 cursor-pointer flex items-center gap-1.5">
                              <CheckCircle size={14} className="text-emerald-600" /> Complete Profile
                            </label>
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                              All compliance details and required documents are verified.
                            </p>
                          </div>
                        </div>

                        <div
                          onClick={() => setProfileCompletionOption('INCOMPLETE')}
                          className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start gap-2.5 ${
                            profileCompletionOption === 'INCOMPLETE'
                              ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500/20'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="radio"
                            id="profile-incomplete"
                            name="profileCompletionStatus"
                            checked={profileCompletionOption === 'INCOMPLETE'}
                            onChange={() => setProfileCompletionOption('INCOMPLETE')}
                            className="mt-0.5 h-4 w-4 text-amber-600 focus:ring-amber-500"
                          />
                          <div>
                            <label htmlFor="profile-incomplete" className="font-bold text-xs text-slate-800 cursor-pointer flex items-center gap-1.5">
                              <AlertTriangle size={14} className="text-amber-600" /> Incomplete Profile
                            </label>
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                              Joining is confirmed with ID, but pending documents (ESIC, UAN, etc.).
                            </p>
                          </div>
                        </div>
                      </div>

                      {profileCompletionOption === 'INCOMPLETE' && (() => {
                        const modalActiveSections = (approvalTargetSubmission.originalFormSections && approvalTargetSubmission.originalFormSections.length > 0)
                          ? approvalTargetSubmission.originalFormSections
                          : formSections;

                        const modalAllFields = modalActiveSections.flatMap(sec =>
                          (sec.fields || []).map(f => ({
                            ...f,
                            sectionTitle: sec.title || 'General'
                          }))
                        ).filter(f => f && f.type !== FieldType.HEADER && f.type !== FieldType.INFO_TEXT);

                        const visiblePendingFields = modalAllFields.filter(field => {
                          if (pendingFieldViewFilter === 'SUGGESTED') {
                            const val = approvalTargetSubmission.data?.[field.id];
                            const isSuggested = isFieldEmptyOrPlaceholder(val) || isComplianceOrPriorityField(field);
                            if (!isSuggested && !selectedPendingFields.includes(field.id)) return false;
                          } else if (pendingFieldViewFilter === 'SELECTED') {
                            if (!selectedPendingFields.includes(field.id)) return false;
                          }

                          if (pendingFieldSearch.trim()) {
                            const q = pendingFieldSearch.trim().toLowerCase();
                            const lbl = (field.label || '').toLowerCase();
                            const sec = ((field as any).sectionTitle || '').toLowerCase();
                            const valObj = getFieldDisplayValue(field, approvalTargetSubmission);
                            const valText = (valObj.text || '').toLowerCase();
                            return lbl.includes(q) || sec.includes(q) || valText.includes(q);
                          }

                          return true;
                        });

                        return (
                          <div className="mt-3 pt-3 border-t border-slate-200 space-y-3 animate-in fade-in duration-200">
                            <div className="bg-amber-50/50 p-3.5 rounded-xl border border-amber-200 space-y-3">
                              {/* Header & Pending Count Badge */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div>
                                  <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                    <AlertTriangle size={14} className="text-amber-600" />
                                    <span>Select Pending / Incomplete Fields:</span>
                                  </p>
                                  <p className="text-[11px] text-slate-500">
                                    Mark missing or placeholder fields (e.g. UAN, ESIC, Bank) for subsequent employee correction.
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full border shadow-xs ${
                                    selectedPendingFields.length > 0
                                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                                      : 'bg-red-100 text-red-700 border-red-300'
                                  }`}>
                                    {selectedPendingFields.length} marked pending
                                  </span>
                                </div>
                              </div>

                              {/* Search and Filter View Bar */}
                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                {/* Filter View Tabs */}
                                <div className="flex items-center bg-white p-0.5 rounded-lg border border-slate-200 text-xs shrink-0 shadow-xs">
                                  <button
                                    type="button"
                                    onClick={() => setPendingFieldViewFilter('SUGGESTED')}
                                    className={`px-2.5 py-1 rounded-md font-semibold transition-colors flex items-center gap-1 ${
                                      pendingFieldViewFilter === 'SUGGESTED'
                                        ? 'bg-amber-500 text-white shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                  >
                                    <span>⚡ Suggested ({detectedEmptyFields.length})</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setPendingFieldViewFilter('ALL')}
                                    className={`px-2.5 py-1 rounded-md font-semibold transition-colors flex items-center gap-1 ${
                                      pendingFieldViewFilter === 'ALL'
                                        ? 'bg-amber-500 text-white shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                  >
                                    <span>📋 All Form Fields ({modalAllFields.length})</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setPendingFieldViewFilter('SELECTED')}
                                    className={`px-2.5 py-1 rounded-md font-semibold transition-colors flex items-center gap-1 ${
                                      pendingFieldViewFilter === 'SELECTED'
                                        ? 'bg-amber-500 text-white shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                  >
                                    <span>✓ Selected ({selectedPendingFields.length})</span>
                                  </button>
                                </div>

                                {/* Instant Search Input */}
                                <div className="relative flex-1">
                                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                  <input
                                    type="text"
                                    value={pendingFieldSearch}
                                    onChange={e => setPendingFieldSearch(e.target.value)}
                                    placeholder="Search by field name, section, or value..."
                                    className="w-full pl-8 pr-7 py-1 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 placeholder:text-slate-400 shadow-xs"
                                  />
                                  {pendingFieldSearch && (
                                    <button
                                      type="button"
                                      onClick={() => setPendingFieldSearch('')}
                                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Quick Select & Clear Toolbar */}
                              <div className="flex items-center justify-between text-[11px] text-slate-500 px-0.5">
                                <span>
                                  Showing {visiblePendingFields.length} field{visiblePendingFields.length === 1 ? '' : 's'}
                                  {pendingFieldViewFilter === 'SUGGESTED' && ' (empty, placeholders, or compliance)'}
                                </span>
                                <div className="flex items-center gap-2 font-medium">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const shownIds = visiblePendingFields.map(f => f.id);
                                      setSelectedPendingFields(prev => Array.from(new Set([...prev, ...shownIds])));
                                    }}
                                    className="text-amber-700 hover:text-amber-900 font-semibold hover:underline"
                                  >
                                    Select All Shown
                                  </button>
                                  <span>•</span>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedPendingFields([])}
                                    className="text-slate-500 hover:text-slate-700 hover:underline"
                                  >
                                    Clear All
                                  </button>
                                </div>
                              </div>

                              {/* Scrollable Fields Selector Grid */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-2 bg-white rounded-lg border border-slate-200">
                                {visiblePendingFields.length === 0 ? (
                                  <div className="col-span-full p-4 text-center text-xs text-slate-400 italic">
                                    No fields match your search or filter. Switch to "All Form Fields" to browse all fields.
                                  </div>
                                ) : (
                                  visiblePendingFields.map(field => {
                                    const isChecked = selectedPendingFields.includes(field.id);
                                    const { text: valText, isPlaceholder, isEmpty } = getFieldDisplayValue(field, approvalTargetSubmission);
                                    return (
                                      <label
                                        key={field.id}
                                        className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-all text-xs select-none ${
                                          isChecked
                                            ? 'bg-amber-50/90 border-amber-400 text-amber-950 font-medium shadow-xs ring-1 ring-amber-400/30'
                                            : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50/50'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              setSelectedPendingFields(prev => [...prev, field.id]);
                                            } else {
                                              setSelectedPendingFields(prev => prev.filter(id => id !== field.id));
                                            }
                                          }}
                                          className="mt-0.5 h-4 w-4 text-amber-600 rounded border-gray-300 focus:ring-amber-500 shrink-0"
                                        />
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center justify-between gap-1">
                                            <span className="truncate font-bold text-slate-900">{field.label}</span>
                                            {isChecked && (
                                              <span className="text-[9px] font-black uppercase text-amber-800 bg-amber-200/80 px-1 py-0.2 rounded shrink-0">
                                                Pending
                                              </span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                            <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded shrink-0">
                                              {(field as any).sectionTitle}
                                            </span>
                                            {isEmpty ? (
                                              <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.2 rounded shrink-0">
                                                🔴 Empty
                                              </span>
                                            ) : isPlaceholder ? (
                                              <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded shrink-0">
                                                ⚠️ Placeholder ({valText})
                                              </span>
                                            ) : (
                                              <span className="text-[10px] text-slate-500 truncate">
                                                Current: <strong className="text-slate-700 font-semibold">{valText}</strong>
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </label>
                                    );
                                  })
                                )}
                              </div>

                              {selectedPendingFields.length === 0 && (
                                <p className="text-xs text-red-600 font-semibold flex items-center gap-1 bg-red-50 p-2 rounded-lg border border-red-200">
                                  <AlertTriangle size={14} className="shrink-0 text-red-600" />
                                  <span>Please select at least one field to mark as pending, or switch to "Complete Profile".</span>
                                </p>
                              )}
                            </div>

                            <Input
                              label="Pending Note (Optional)"
                              value={pendingNote}
                              onChange={e => setPendingNote(e.target.value)}
                              placeholder="e.g., Awaiting ESIC card generation by employer, expected next week"
                              helperText="This note will be visible in the Master Employee List and the employee's profile view."
                            />
                          </div>
                        );
                      })()}

                    </div>
                  </div>
                );
              })()}
              <Textarea label="Decision Comments" value={adminComments} onChange={e => setAdminComments(e.target.value)} placeholder="Notes for this approval step..." />
              <div className="flex justify-end items-end gap-3 pt-4 border-t border-gray-100">
                {(() => {
                  const siteName = String(approvalTargetSubmission.data?.['52ae217b-2602-4337-a1cd-a1f9bd36a4b0'] || '');
                  const site = sites?.find(s => s.name === siteName || s.id === siteName);
                  const effectiveLevel = getEffectiveApprovalLevel(approvalTargetSubmission.currentLevel, site, config, staffUsers, allRoles);
                  return (
                    <>
                      {hasPermission(Permission.SUBMISSIONS_REVERT_DECISION) && (isSuperAdmin || effectiveLevel > 1) && (
                        <div className="flex-grow flex flex-col space-y-1">
                          <label className="text-[10px] font-bold text-amber-600 uppercase">Revert to Level</label>
                          <div className="flex gap-2">
                            {isSuperAdmin ? (
                              <PremiumSelect
                                options={config?.levels.map(l => {
                                  const roleAssigned = isRoleAssignedToSite(l.roleId, site, staffUsers, allRoles);
                                  const isLastLevel = l.level === config.levels[config.levels.length - 1].level;
                                  const suffix = (roleAssigned || isLastLevel) ? '' : ' (No staff assigned)';
                                  return {
                                    value: String(l.level),
                                    label: `Level ${l.level}: ${allRoles.find(r => r.id === l.roleId)?.name || `Step ${l.level}`}${suffix}`
                                  };
                                }) || []}
                                value={String(revertTargetLevel)}
                                onChange={(val) => setRevertTargetLevel(Number(val))}
                                className="w-64"
                              />
                            ) : null}

                            <Button
                              variant="secondary"
                              onClick={() => handleRevert(isSuperAdmin ? revertTargetLevel : effectiveLevel - 1)}
                              className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-300 font-semibold"
                            >
                              {isSuperAdmin ? 'Revert' : `Revert to Level ${effectiveLevel - 1}`}
                            </Button>
                          </div>
                        </div>
                      )}
                      <div className="flex flex-col space-y-3">
                        <div className="flex justify-end space-x-2">
                          {hasPermission(Permission.SUBMISSIONS_REJECT) && (
                            <Button variant="danger" onClick={handleReject} disabled={isSubmittingApproval}>Reject Applicant</Button>
                          )}
                          {hasPermission(Permission.SUBMISSIONS_APPROVE) && (() => {
                            const isFinal = isFinalStep(approvalTargetSubmission) || isBypassMode;
                            const effectiveDup = getEffectiveDuplicateCheck(approvalTargetSubmission);
                            const blockingMatches = effectiveDup?.matches?.filter(m =>
                              m.matchType === 'EXISTING_ACTIVE_EMPLOYEE' || (isFinal && m.matchType === 'DUPLICATE_SUBMISSION')
                            ) || ((effectiveDup?.matchType === 'EXISTING_ACTIVE_EMPLOYEE' || (isFinal && effectiveDup?.matchType === 'DUPLICATE_SUBMISSION')) ? [effectiveDup] : []);

                            if (effectiveDup?.isDuplicate && blockingMatches.length > 0) {
                              const isEmp = blockingMatches.some(m => m.matchType === 'EXISTING_ACTIVE_EMPLOYEE');
                              const conflictList = blockingMatches.map((m, i) =>
                                `${i + 1}. ${m.matchedField}: "${m.matchedValue}"\n   → Matches: ${m.matchedName || m.matchedId} (ID: ${m.matchedId || m.submissionId}, Site: ${m.matchedSite || 'N/A'})\n   → Category: ${m.matchType === 'EXISTING_ACTIVE_EMPLOYEE' ? 'Active Employee' : `Submission [${m.submissionStatus || 'Pending'}]`}`
                              ).join('\n\n');

                              return (
                                <Button
                                  variant="secondary"
                                  onClick={() => alert(`🚫 FINAL APPROVAL BLOCKED: DUPLICATE CONFLICTS DETECTED!\n\nThis applicant conflicts with existing records on ${blockingMatches.length} field(s):\n\n${conflictList}\n\nStrict Policy: Employee ID assignment and final onboarding are strictly blocked until conflicting records are resolved or rejected.`)}
                                  className="bg-red-100 text-red-700 border-red-300 hover:bg-red-200 font-bold"
                                >
                                  <ShieldAlert size={14} className="mr-1 text-red-600" />
                                  {blockingMatches.length > 1
                                    ? `Approval Blocked (${blockingMatches.length} Conflicts)`
                                    : isEmp
                                      ? 'Approval Blocked (Active Match)'
                                      : 'Final Approval Blocked (Duplicate App)'}
                                </Button>
                              );
                            }

                            return (
                              <Button variant="primary" onClick={handleConfirmApproval} disabled={isSubmittingApproval} className="bg-green-600 hover:bg-green-700">
                                {isSubmittingApproval ? 'Processing...' : (isFinal ? 'Final Approve & Onboard' : `Approve Level ${effectiveLevel}`)}
                              </Button>
                            );
                          })()}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {isDetailsModalOpen && selectedSubmissionForDetails && (
        <Modal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} title="Submission Record" size="lg">
          {/* ... existing details content ... */}
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            {/* Duplicate / Rehire Alert Banner */}
            {renderDuplicateAlertBanner(selectedSubmissionForDetails)}

            <div className="flex justify-between items-center bg-blue-50 p-3 rounded-md border border-blue-100">
              <div>
                <p className="text-xs text-blue-600 font-bold uppercase tracking-widest">Onboarding Status</p>
                <p className="text-lg font-bold text-blue-800">{selectedSubmissionForDetails.status}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-blue-600 font-bold uppercase tracking-widest">Current Workflow Step</p>
                {(() => {
                  const siteName = String(selectedSubmissionForDetails.data?.['52ae217b-2602-4337-a1cd-a1f9bd36a4b0'] || '');
                  const site = sites?.find(s => s.name === siteName || s.id === siteName);
                  const effectiveLevel = getEffectiveApprovalLevel(selectedSubmissionForDetails.currentLevel, site, config, staffUsers, allRoles);
                  return (
                    <p className="text-sm font-medium text-blue-800">Level {effectiveLevel} of {config?.levels.length || 1}</p>
                  );
                })()}
              </div>
            </div>

            {(() => {
              const { isAllowed, activeSite, designation } = getDesignationCheck(selectedSubmissionForDetails);
              if (isAllowed) return null;
              return (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md flex items-start">
                  <AlertTriangle className="text-red-500 mr-3 mt-0.5 shrink-0" size={18} />
                  <div>
                    <h4 className="text-sm font-bold text-red-800 font-sans">Designation Mismatch Warning</h4>
                    <p className="text-xs text-red-700 mt-1 font-sans">
                      The candidate's selected designation (<strong>{designation}</strong>) is not in the authorized designation list for their selected site (<strong>{activeSite?.name}</strong>).
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Sync Status Banner (Super Admin Only for Drive) */}
            {effectiveIsSuperAdmin && (
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col sm:flex-row gap-3 items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Google Form</p>
                    {isFormSyncing ? (
                      <span className="text-xs font-bold text-blue-600 flex items-center mt-0.5 animate-pulse">
                        <Loader2 size={12} className="mr-1 animate-spin text-blue-600" /> Syncing...
                      </span>
                    ) : (selectedSubmissionForDetails as any).googleFormSyncStatus === 'synced' ? (
                      <span className="text-xs font-bold text-emerald-600 flex items-center mt-0.5">
                        <CheckCircle size={12} className="mr-1" /> Form Synced
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-amber-600 flex items-center mt-0.5">
                        <Clock size={12} className="mr-1" /> Sync Pending
                      </span>
                    )}
                  </div>
                  <div className="h-7 w-px bg-slate-200"></div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Drive Backup</p>
                    {isDriveSyncing ? (
                      <span className="text-xs font-bold text-blue-600 flex items-center mt-0.5 animate-pulse">
                        <Loader2 size={12} className="mr-1 animate-spin text-blue-600" /> Backing up...
                      </span>
                    ) : (selectedSubmissionForDetails as any).driveBackupStatus === 'completed' ? (
                      <span className="text-xs font-bold text-emerald-600 flex items-center mt-0.5">
                        <CheckCircle size={12} className="mr-1" /> Backed Up
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-amber-600 flex items-center mt-0.5">
                        <AlertTriangle size={12} className="mr-1" /> Pending
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={isFormSyncing}
                    className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs shadow-sm disabled:opacity-50"
                    onClick={async () => {
                      const isAlreadySynced = (selectedSubmissionForDetails as any).googleFormSyncStatus === 'synced';
                      if (isAlreadySynced) {
                        const confirmResync = window.confirm(
                          "This submission is already synced to Google Form.\n\nSyncing again will add another row to the Google Sheet. Are you sure you want to proceed?"
                        );
                        if (!confirmResync) return;
                      }

                      setIsFormSyncing(true);
                      try {
                        const { syncSubmissionToGoogleForm } = await import('../src/services/employeeService');
                        const res = await syncSubmissionToGoogleForm(selectedSubmissionForDetails.id);
                        if (res.success) {
                          alert("Google Form synced successfully!");
                          setSelectedSubmissionForDetails(prev => prev ? { ...prev, googleFormSyncStatus: 'synced' as any } : null);
                        } else {
                          alert(`Sync failed: ${res.error}`);
                        }
                      } catch (e: any) {
                        alert(`Error: ${e.message}`);
                      } finally {
                        setIsFormSyncing(false);
                      }
                    }}
                  >
                    {isFormSyncing ? (
                      <span className="flex items-center"><Loader2 size={12} className="mr-1.5 animate-spin" /> Syncing...</span>
                    ) : (
                      <span className="flex items-center"><RotateCcw size={12} className="mr-1.5" /> {(selectedSubmissionForDetails as any).googleFormSyncStatus === 'synced' ? 'Re-Sync Form' : 'Sync Form'}</span>
                    )}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={isDriveSyncing}
                    className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs shadow-sm disabled:opacity-50"
                    onClick={async () => {
                      setIsDriveSyncing(true);
                      try {
                        const { syncDriveFolder } = await import('../src/services/employeeService');
                        await syncDriveFolder(selectedSubmissionForDetails.id);
                        alert("Drive backup completed successfully!");
                        setSelectedSubmissionForDetails(prev => prev ? { ...prev, driveBackupStatus: 'completed' as any } : null);
                      } catch (e: any) {
                        alert(`Drive Backup Error: ${e.message}`);
                      } finally {
                        setIsDriveSyncing(false);
                      }
                    }}
                  >
                    {isDriveSyncing ? (
                      <span className="flex items-center"><Loader2 size={12} className="mr-1.5 animate-spin" /> Uploading...</span>
                    ) : (
                      <span className="flex items-center"><UploadCloud size={12} className="mr-1.5" /> {(selectedSubmissionForDetails as any).driveBackupStatus === 'completed' ? 'Re-Sync Drive' : 'Backup Drive'}</span>
                    )}
                  </Button>
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end border-b border-gray-100 pb-4 flex-wrap">
              {hasPermission(Permission.SUBMISSIONS_PRINT_BIODATA) && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsBiodataModalOpen(true)}
                  className="flex items-center gap-1.5 bg-green-50 text-green-700 hover:bg-green-100 border-green-200"
                >
                  <FileText size={16} /> View/Print Biodata
                </Button>
              )}
              {hasPermission(Permission.SUBMISSIONS_CREATE_CORRECTION_LINK) && selectedSubmissionForDetails.status !== SubmissionStatus.APPROVED && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsCorrectionModalOpen(true)}
                  className="flex items-center gap-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
                >
                  <Edit3 size={16} /> Request Profile Correction
                </Button>
              )}
              {hasPermission(Permission.DELETE_SUBMISSION) && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    setIsDetailsModalOpen(false);
                    if (onDelete) {
                      onDelete(selectedSubmissionForDetails.id);
                    }
                  }}
                  className="!bg-red-50 !text-red-600 hover:!bg-red-600 hover:!text-white border-red-200"
                >
                  <Trash2 size={16} className="mr-2" /> Delete Submission Permanent Record
                </Button>
              )}
            </div>
            {selectedSubmissionForDetails.employeeId && (
              <div className="bg-green-50 p-3 rounded-md border border-green-100 flex justify-between items-center">
                <p className="text-sm font-bold text-green-800">Assigned Employee ID</p>
                <p className="text-sm font-mono font-bold bg-white px-2 py-1 rounded border border-green-200">{selectedSubmissionForDetails.employeeId}</p>
              </div>
            )}
            {/* Recruiter / Referral Status Card */}
            <div className={`p-3 rounded-md border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              selectedSubmissionForDetails.recruitedByName
                ? 'bg-purple-50 border-purple-200'
                : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-2.5">
                <UserPlus size={18} className={selectedSubmissionForDetails.recruitedByName ? "text-purple-600 shrink-0" : "text-slate-400 shrink-0"} />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-slate-800">
                      {selectedSubmissionForDetails.recruitedByName ? 'Referred Applicant' : 'Application Source'}
                    </p>
                    {selectedSubmissionForDetails.recruitedByName ? (
                      <span className="text-[9px] font-black uppercase tracking-wider bg-purple-200 text-purple-900 px-2 py-0.5 rounded-full">
                        Referral
                      </span>
                    ) : (
                      <span className="text-[9px] font-black uppercase tracking-wider bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                        Direct Apply
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5">
                    {selectedSubmissionForDetails.recruitedByName ? (
                      <span className="text-purple-800">
                        Referred by: <strong className="text-purple-950 font-bold">{selectedSubmissionForDetails.recruitedByName}</strong>
                        {selectedSubmissionForDetails.inviteId ? ` (Invite: ${selectedSubmissionForDetails.inviteId})` : ''}
                      </span>
                    ) : (
                      <span className="text-slate-500 italic">No staff referral link attached.</span>
                    )}
                  </p>
                </div>
              </div>

              {effectiveIsSuperAdmin && (
                <div className="flex items-center gap-2 shrink-0">
                  {isEditingDetailsRecruiter ? (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <select
                        value={detailsSelectedRecruiterId}
                        onChange={e => setDetailsSelectedRecruiterId(e.target.value)}
                        className="text-xs font-medium p-1.5 rounded border border-slate-300 bg-white"
                      >
                        <option value="">Direct Apply (None)</option>
                        {(staffUsers || []).filter(s => !s.isDisabled).map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.username || s.email})
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        variant="primary"
                        className="bg-purple-600 hover:bg-purple-700 text-xs px-2.5 py-1"
                        disabled={isSavingRecruiter}
                        onClick={async () => {
                          if (!selectedSubmissionForDetails) return;
                          setIsSavingRecruiter(true);
                          try {
                            const { updateSubmissionRecruiter } = await import('../src/services/employeeService');
                            const foundStaff = (staffUsers || []).find(s => s.id === detailsSelectedRecruiterId);
                            const recPayload = detailsSelectedRecruiterId ? {
                              id: detailsSelectedRecruiterId,
                              name: foundStaff?.name || foundStaff?.username || 'Staff'
                            } : { id: null, name: null };

                            await updateSubmissionRecruiter(selectedSubmissionForDetails.id, recPayload);

                            setSelectedSubmissionForDetails(prev => prev ? {
                              ...prev,
                              recruitedBy: recPayload.id,
                              recruitedByName: recPayload.name,
                              inviteId: recPayload.id ? prev.inviteId : undefined
                            } as any : null);

                            setPaginatedData(prev => prev.map(sub => sub.id === selectedSubmissionForDetails.id ? {
                              ...sub,
                              recruitedBy: recPayload.id,
                              recruitedByName: recPayload.name,
                              inviteId: recPayload.id ? sub.inviteId : undefined
                            } as any : sub));

                            setIsEditingDetailsRecruiter(false);
                            alert("Recruiter attribution updated successfully!");
                          } catch (err: any) {
                            alert("Failed to update recruiter: " + err.message);
                          } finally {
                            setIsSavingRecruiter(false);
                          }
                        }}
                      >
                        {isSavingRecruiter ? 'Saving...' : 'Save'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs px-2 py-1 text-slate-500"
                        onClick={() => setIsEditingDetailsRecruiter(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="bg-white hover:bg-purple-100 text-purple-700 border border-purple-300 text-xs px-2.5 py-1 font-bold shadow-xs flex items-center gap-1"
                      onClick={() => {
                        setDetailsSelectedRecruiterId((selectedSubmissionForDetails as any).recruitedBy || '');
                        setIsEditingDetailsRecruiter(true);
                      }}
                    >
                      <Edit3 size={12} /> Change Recruiter
                    </Button>
                  )}
                </div>
              )}
            </div>
            {selectedSubmissionForDetails.originalFormSections.map(sec => {
              // Filter out fields that are marked HIDDEN for this role (except for SuperAdmin)
              const visibleFields = (sec.fields || []).filter(f => {
                if (isSuperAdmin) return true;
                const visibility = userRole?.onboardingFieldVisibility?.[f.id];
                return visibility !== 'HIDDEN';
              });

              if (visibleFields.length === 0) return null;

              return (
                <div key={sec.id} className="mt-4">
                  <h4 className="text-sm font-bold text-gray-700 mb-2 border-b pb-1">{sec.name}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                    {visibleFields.map(f => renderReadOnlyField(f, selectedSubmissionForDetails.data[f.id], selectedSubmissionForDetails))}
                  </div>
                </div>
              );
            })}
          </div>
        </Modal>
      )}

      {isBiodataModalOpen && selectedSubmissionForDetails && (
        <Modal
          isOpen={isBiodataModalOpen}
          onClose={() => setIsBiodataModalOpen(false)}
          title="Employee Biodata Form"
          size="xl"
          footer={
            <div className="flex justify-between items-center w-full">
              <span className="text-xs text-gray-400 italic">This is an on-screen preview. Click "Print Biodata" to output to paper/PDF.</span>
              <div className="flex space-x-2">
                <Button variant="secondary" onClick={() => setIsBiodataModalOpen(false)}>Close</Button>
                <Button
                  variant="primary"
                  onClick={handlePrintBiodata}
                  disabled={isPrinting}
                  className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-1.5"
                >
                  {isPrinting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Print Biodata
                </Button>
              </div>
            </div>
          }
        >
          {(() => {
            const sub = selectedSubmissionForDetails;
            const name = String(getFieldValue(sub, '7debf274-baee-4bac-a137-4b4b46719874', 'Full Name') || '');
            const phone = String(getFieldValue(sub, 'eb3617dc-9f1d-475d-a2db-005b6bc2500c', 'Phone Number') || '');
            const gender = String(getFieldValue(sub, '5df6fa40-c39f-41a7-9ee7-789a47435ef0', 'Gender') || '');
            const dob = String(getFieldValue(sub, '6e570a01-14e0-4e18-b112-97ddc51d0778', 'Date of Birth') || '');
            const citizenship = String(getFieldValue(sub, '2fdacb1b-254f-4fc3-923a-53233214124f', 'Citizenship') || '');
            const bloodGroup = String(getFieldValue(sub, '2f8c72f5-10f4-4414-bfcd-274fc69592e2', 'Blood Group') || '');
            const height = String(getFieldValue(sub, '5ae316e6-2941-4e58-93b8-a6fe5a200e98', 'Height') || '');
            const marks = String(getFieldValue(sub, '7386dcfa-e693-4998-a1cb-35a8fa8029de', 'Identity Marks') || '');
            const maritalStatus = String(getFieldValue(sub, 'c53d7ba7-58a0-4cf0-8691-8eb7bef7b951', 'Marital Status') || '');
            const spouseName = String(getFieldValue(sub, '7db47bc3-e4cc-4984-9687-2d94cad3e632', 'Spouse Name') || '');

            const qualification = String(getFieldValue(sub, '61b19d37-b860-44ef-80e9-d33c3b438655', 'Qualification') || '');
            const designation = String(getFieldValue(sub, 'db307195-cf54-4a6e-9056-f3974b050c4d', 'Post of Apply') || getFieldValue(sub, 'db307195-cf54-4a6e-9056-f3974b050c4d', 'Designation') || '');
            const siteName = String(getFieldValue(sub, '52ae217b-2602-4337-a1cd-a1f9bd36a4b0', 'Unit or Facility') || '');
            const subUnit = String(getFieldValue(sub, '68a2a893-0100-4740-9602-9988452377c8', 'Specific Location / Sub-Unit') || '');
            const policeCase = String(getFieldValue(sub, '0c8a587e-08f3-4605-ad33-9ab34eb46d87', 'Any Police Case') || '');
            const prevHistory = String(getFieldValue(sub, '4b05d2b6-ff73-4dbe-befa-eba77c8ce1c4', 'Previous Employment History') || '');
            const experience = String(getFieldValue(sub, 'd16a6da1-fc29-405e-bbb6-cb186b8f8666', 'Previous Company & Experience') || '');

            const presentAddress = String(getFieldValue(sub, '8532f460-7bcf-4831-ab62-96375b80e6ab', 'Present Address') || '');
            const permanentAddress = String(getFieldValue(sub, '29bae22a-59db-4b1b-bafd-64e8018a0f4e', 'Permanent Address') || '');

            const refName = String(getFieldValue(sub, '2e1f27bf-94e7-421f-b69c-7e8dfaf0ee13', 'Reference Name') || '');
            const refRelation = String(getFieldValue(sub, '13c82880-161a-4fa9-a8b6-0558d5c88c53', 'Reference Relationship') || '');
            const refAddress = String(getFieldValue(sub, '7681644c-02f8-4034-b0ce-cc11dfd3dca7', 'Reference Address') || '');
            const refContact = String(getFieldValue(sub, 'e1479d43-ed04-4fde-a508-130f43b4f12d', 'Reference Contact No') || '');

            const fatherName = String(getFieldValue(sub, '3f09e364-7875-40a2-9490-41251be20366', "Father's Name") || '');
            const motherName = String(getFieldValue(sub, 'c432a45e-c1f0-4e64-8002-1f1dba3bf660', "Mother's Name") || '');
            const fatherMobile = String(getFieldValue(sub, '30d78dae-fb7c-4264-a159-c04993d8885c', "Father's Mobile Number") || '');
            const motherMobile = String(getFieldValue(sub, '30fab2de-452d-46bf-8079-2f53d322388d', "Mother's Mobile Number") || '');

            const aadharNo = String(getFieldValue(sub, '18855ee9-0d66-41d6-988b-128b776a8c5b', 'Aadhar Card No') || '');
            const panNo = String(getFieldValue(sub, 'da8edb18-4bed-41ca-8233-2280b97dac8d', 'PAN Card No') || '');
            const uanNo = String(getFieldValue(sub, 'f6665f3e-98f4-4d92-8b53-adcaa1993bbe', 'UAN No or EPFO') || '');
            const esicNo = String(getFieldValue(sub, '41e3505e-15fb-4067-9c6a-2c690e736fab', 'ESIC No') || '');
            const pvcStatus = String(getFieldValue(sub, '1052957c-a885-494e-af2c-ae1af5c5cc8e', 'PVC (Police Verification Certificate)') || '');
            const pvcNumber = String(getFieldValue(sub, '791bdd86-20c2-4097-bcc1-c85e8f649961', 'PVC Number (If YES)') || '');

            const bankName = String(getFieldValue(sub, '1a35eaa7-d302-4e49-8649-e85cab8b3b77', 'Bank Name') || '');
            const accountNo = String(getFieldValue(sub, '3519c111-aaa6-4fe0-8d83-d03dd7612e28', 'Account No') || '');
            const ifscCode = String(getFieldValue(sub, '86854000-7727-40bb-9932-09e28e443ad8', 'IFSC Code') || '');
            const branchName = String(getFieldValue(sub, '6fe166fc-29a3-41ea-a19f-a498b48089b9', 'Branch Name') || '');

            const photoVal = getFieldValue(sub, '7fbd2b8f-62b5-402d-a1dd-262531fa00af', 'Passport Size Photo');
            let photoPath = typeof photoVal === 'object' && photoVal !== null && 'storagePath' in photoVal
              ? photoVal.storagePath
              : (typeof photoVal === 'string' ? photoVal : '');
            photoPath = remapOnboardingPathToEmployeePath(photoPath, sub);
            const recruitedByName = String((sub as any).recruitedByName || (sub as any).recruitedBy || '');

            const { isAllowed, activeSite, designation: checkDesig } = getDesignationCheck(sub);

            return (
              <div className="bg-slate-100 p-6 -m-6 max-h-[70vh] overflow-y-auto">
                {/* Sync Status Banner (Super Admin Only for Drive) */}
                {effectiveIsSuperAdmin && (
                  <div className="bg-white max-w-3xl mx-auto p-4 mb-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Google Form Sync</p>
                        {(sub as any).googleFormSyncStatus === 'synced' ? (
                          <span className="text-xs font-bold text-emerald-600 flex items-center mt-0.5">
                            <CheckCircle size={12} className="mr-1" /> Form Synced
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-amber-600 flex items-center mt-0.5">
                            <Clock size={12} className="mr-1" /> Sync Pending
                          </span>
                        )}
                      </div>
                      <div className="h-8 w-px bg-gray-200"></div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Drive Backup</p>
                        {(sub as any).driveBackupStatus === 'completed' ? (
                          <span className="text-xs font-bold text-emerald-600 flex items-center mt-0.5">
                            <CheckCircle size={12} className="mr-1" /> Files Backed Up
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-amber-600 flex items-center mt-0.5">
                            <AlertTriangle size={12} className="mr-1" /> Backup Pending
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs shadow-sm"
                        onClick={async () => {
                          try {
                            const { syncSubmissionToGoogleForm } = await import('../src/services/employeeService');
                            const res = await syncSubmissionToGoogleForm(sub.id);
                            if (res.success) {
                              alert("Google Form synced successfully!");
                              setSelectedSubmissionForDetails(prev => prev ? { ...prev, googleFormSyncStatus: 'synced' as any } : null);
                            } else {
                              alert(`Sync failed: ${res.error}`);
                            }
                          } catch (e: any) {
                            alert(`Error: ${e.message}`);
                          }
                        }}
                      >
                        <RotateCcw size={12} className="mr-1.5" /> {(sub as any).googleFormSyncStatus === 'synced' ? 'Re-Sync Form' : 'Sync to Form'}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs shadow-sm"
                        onClick={async () => {
                          try {
                            const { syncDriveFolder } = await import('../src/services/employeeService');
                            await syncDriveFolder(sub.id);
                            alert("Drive backup completed successfully!");
                            setSelectedSubmissionForDetails(prev => prev ? { ...prev, driveBackupStatus: 'completed' as any } : null);
                          } catch (e: any) {
                            alert(`Drive Backup Error: ${e.message}`);
                          }
                        }}
                      >
                        <UploadCloud size={12} className="mr-1.5" /> {(sub as any).driveBackupStatus === 'completed' ? 'Re-Sync Drive' : 'Backup to Drive'}
                      </Button>
                    </div>
                  </div>
                )}

                {!isAllowed && (
                  <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4 rounded-md max-w-3xl mx-auto flex items-start">
                    <AlertTriangle className="text-red-500 mr-3 mt-0.5 shrink-0" size={18} />
                    <div>
                      <h4 className="text-sm font-bold text-red-800">Designation Mismatch Warning</h4>
                      <p className="text-xs text-red-700 mt-1">
                        The candidate's selected designation (<strong>{checkDesig || designation}</strong>) is not in the authorized designation list for their selected site (<strong>{activeSite?.name}</strong>).
                      </p>
                    </div>
                  </div>
                )}
                <div className="bg-white max-w-3xl mx-auto p-8 shadow-md border border-gray-200 rounded-sm font-sans text-xs text-slate-800 leading-relaxed relative overflow-hidden">

                  {/* Watermark in Modal Preview */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.04] z-0">
                    <img src={`${window.location.origin}/logo.png`} className="w-72 h-auto" alt="Watermark" />
                  </div>

                  <div className="relative z-10">
                    {/* Header Row */}
                    <div className="flex justify-between items-stretch border-b-2 border-slate-700 pb-4 mb-6 min-h-[130px]">
                      <div className="flex-1 flex flex-col justify-between text-center mr-4">
                        <div>
                          <h1 className="text-[24px] font-black text-slate-900 tracking-tight uppercase leading-tight">UNIQUE DELTA FORCE SECURITY PVT. LTD.</h1>
                          <p className="text-[20px] font-black text-blue-600 uppercase tracking-widest mt-2">BIODATA</p>
                        </div>
                        <div className="flex justify-between items-center w-full mt-4 text-[15px] font-black text-slate-800">
                          <div>Referred By: {recruitedByName || '_______________________'}</div>
                          <div>Reg. No.: HY _________________</div>
                        </div>
                      </div>
                      <div className="w-[110px] h-[130px] border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-center p-2 text-[9px] text-slate-400 overflow-hidden flex-shrink-0">
                        {photoPath ? (
                          <SecureImage path={photoPath} className="w-full h-full object-cover" />
                        ) : (
                          <span>PASTE PASSPORT PHOTO HERE</span>
                        )}
                      </div>
                    </div></div>

                  {/* Personal Details */}
                  <div className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider border-b border-blue-100 pb-1 mb-2">Personal Details</div>
                  <table className="w-full border-collapse mb-4">
                    <tbody>
                      <tr className="border border-slate-200">
                        <td className="bg-slate-50 font-bold p-2 w-1/4 border-r border-slate-200">Full Name</td>
                        <td className="p-2 w-3/4" colSpan={3}>{name || 'N/A'}</td>
                      </tr>
                      <tr className="border border-slate-200">
                        <td className="bg-slate-50 font-bold p-2 w-1/4 border-r border-slate-200">Phone Number</td>
                        <td className="p-2 w-1/4 border-r border-slate-200">{phone || 'N/A'}</td>
                        <td className="bg-slate-50 font-bold p-2 w-1/4 border-r border-slate-200">Gender</td>
                        <td className="p-2 w-1/4">{gender || 'N/A'}</td>
                      </tr>
                      <tr className="border border-slate-200">
                        <td className="bg-slate-50 font-bold p-2 w-1/4 border-r border-slate-200">Date of Birth</td>
                        <td className="p-2 w-1/4 border-r border-slate-200">{dob || 'N/A'}</td>
                        <td className="bg-slate-50 font-bold p-2 w-1/4 border-r border-slate-200">Citizenship</td>
                        <td className="p-2 w-1/4">{citizenship || 'N/A'}</td>
                      </tr>
                      <tr className="border border-slate-200">
                        <td className="bg-slate-50 font-bold p-2 w-1/4 border-r border-slate-200">Blood Group</td>
                        <td className="p-2 w-1/4 border-r border-slate-200">{bloodGroup || 'N/A'}</td>
                        <td className="bg-slate-50 font-bold p-2 w-1/4 border-r border-slate-200">Height</td>
                        <td className="p-2 w-1/4">{height || 'N/A'}</td>
                      </tr>
                      <tr className="border border-slate-200">
                        <td className="bg-slate-50 font-bold p-2 w-1/4 border-r border-slate-200">Identity Marks</td>
                        <td className="p-2 w-3/4" colSpan={3}>{marks || 'N/A'}</td>
                      </tr>
                      <tr className="border border-slate-200">
                        <td className="bg-slate-50 font-bold p-2 w-1/4 border-r border-slate-200">Marital Status</td>
                        <td className="p-2 w-1/4 border-r border-slate-200">{maritalStatus || 'N/A'}</td>
                        <td className="bg-slate-50 font-bold p-2 w-1/4 border-r border-slate-200">Spouse Name</td>
                        <td className="p-2 w-1/4">{spouseName || 'N/A'}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Job & Deployment Details */}
                  <div className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider border-b border-blue-100 pb-1 mb-2">Job & Deployment Details</div>
                  <table className="w-full border-collapse mb-4">
                    <tbody>
                      <tr className="border border-slate-200">
                        <td className="bg-slate-50 font-bold p-2 w-1/4 border-r border-slate-200">Post Applied For</td>
                        <td className="p-2 w-1/4 border-r border-slate-200">{designation || 'N/A'}</td>
                        <td className="bg-slate-50 font-bold p-2 w-1/4 border-r border-slate-200">Unit or Facility</td>
                        <td className="p-2 w-1/4">{siteName || 'N/A'}</td>
                      </tr>
                      <tr className="border border-slate-200">
                        <td className="bg-slate-50 font-bold p-2 w-1/4 border-r border-slate-200">Qualification</td>
                        <td className="p-2 w-1/4 border-r border-slate-200">{qualification || 'N/A'}</td>
                        <td className="bg-slate-50 font-bold p-2 w-1/4 border-r border-slate-200">Experience Level</td>
                        <td className="p-2 w-1/4">{prevHistory || 'N/A'}</td>
                      </tr>
                      <tr className="border border-slate-200">
                        <td className="bg-slate-50 font-bold p-2 w-1/4 border-r border-slate-200">Previous Company</td>
                        <td className="p-2 w-1/4 border-r border-slate-200">{experience || 'N/A'}</td>
                        <td className="bg-slate-50 font-bold p-2 w-1/4 border-r border-slate-200">Any Police Case?</td>
                        <td className="p-2 w-1/4">{policeCase || 'N/A'}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Government Identifications */}
                  <div className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider border-b border-blue-100 pb-1 mb-2">Government Identifications</div>
                  <table className="w-full border-collapse mb-4">
                    <tbody>
                      <tr className="border border-slate-200">
                        <td className="bg-slate-50 font-bold p-2 w-1/4 border-r border-slate-200">Aadhar Card No</td>
                        <td className="p-2 w-1/4 border-r border-slate-200">{aadharNo || 'N/A'}</td>
                        <td className="bg-slate-50 font-bold p-2 w-1/4 border-r border-slate-200">PAN Card No</td>
                        <td className="p-2 w-1/4">{panNo || 'N/A'}</td>
                      </tr>
                      <tr className="border border-slate-200">
                        <td className="bg-slate-50 font-bold p-2 w-1/4 border-r border-slate-200">UAN / EPFO No</td>
                        <td className="p-2 w-1/4 border-r border-slate-200">{uanNo || 'N/A'}</td>
                        <td className="bg-slate-50 font-bold p-2 w-1/4 border-r border-slate-200">ESIC No</td>
                        <td className="p-2 w-1/4">{esicNo || 'N/A'}</td>
                      </tr>
                      <tr className="border border-slate-200">
                        <td className="bg-slate-50 font-bold p-2 w-1/4 border-r border-slate-200">PVC Status</td>
                        <td className="p-2 w-1/4 border-r border-slate-200">{pvcStatus || 'N/A'}</td>
                        <td className="bg-slate-50 font-bold p-2 w-1/4 border-r border-slate-200">PVC Number</td>
                        <td className="p-2 w-1/4">{pvcNumber || 'N/A'}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Addresses */}
                  <div className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider border-b border-blue-100 pb-1 mb-2">Address & Contact Information</div>
                  <table className="w-full border-collapse mb-4">
                    <tbody>
                      <tr className="border border-slate-200">
                        <td className="bg-slate-50 font-bold p-2 w-[15%] border-r border-slate-200">Present Address</td>
                        <td className="p-2 w-[35%] border-r border-slate-200 text-[10px] leading-tight">{presentAddress || 'N/A'}</td>
                        <td className="bg-slate-50 font-bold p-2 w-[15%] border-r border-slate-200">Permanent Address</td>
                        <td className="p-2 w-[35%] text-[10px] leading-tight">{permanentAddress || 'N/A'}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Family Details */}
                  <div className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider border-b border-blue-100 pb-1 mb-2">Family Details</div>
                  <table className="w-full border-collapse mb-4">
                    <tbody>
                      <tr className="border border-slate-200">
                        <td className="bg-slate-50 font-bold p-2 w-1/4 border-r border-slate-200">Father's Name</td>
                        <td className="p-2 w-1/4 border-r border-slate-200">{fatherName || 'N/A'}</td>
                        <td className="bg-slate-50 font-bold p-2 w-1/4 border-r border-slate-200">Father's Contact</td>
                        <td className="p-2 w-1/4">{fatherMobile || 'N/A'}</td>
                      </tr>
                      <tr className="border border-slate-200">
                        <td className="bg-slate-50 font-bold p-2 w-1/4 border-r border-slate-200">Mother's Name</td>
                        <td className="p-2 w-1/4 border-r border-slate-200">{motherName || 'N/A'}</td>
                        <td className="bg-slate-50 font-bold p-2 w-1/4 border-r border-slate-200">Mother's Contact</td>
                        <td className="p-2 w-1/4">{motherMobile || 'N/A'}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Bank Details */}
                  <div className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider border-b border-blue-100 pb-1 mb-2">Bank Account Details</div>
                  <table className="w-full border-collapse mb-4">
                    <tbody>
                      <tr className="border border-slate-200">
                        <td className="bg-slate-50 font-bold p-2 w-1/4 border-r border-slate-200">Bank Name</td>
                        <td className="p-2 w-1/4 border-r border-slate-200">{bankName || 'N/A'}</td>
                        <td className="bg-slate-50 font-bold p-2 w-1/4 border-r border-slate-200">Account Number</td>
                        <td className="p-2 w-1/4">{accountNo || 'N/A'}</td>
                      </tr>
                      <tr className="border border-slate-200">
                        <td className="bg-slate-50 font-bold p-2 w-1/4 border-r border-slate-200">IFSC Code</td>
                        <td className="p-2 w-1/4 border-r border-slate-200">{ifscCode || 'N/A'}</td>
                        <td className="bg-slate-50 font-bold p-2 w-1/4 border-r border-slate-200">Branch Name</td>
                        <td className="p-2 w-1/4">{branchName || 'N/A'}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Reference Details */}
                  <div className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider border-b border-blue-100 pb-1 mb-2">Reference Details</div>
                  <table className="w-full border-collapse mb-4">
                    <tbody>
                      <tr className="border border-slate-200">
                        <td className="bg-slate-50 font-bold p-2 w-[20%] border-r border-slate-200">Reference Name</td>
                        <td className="p-2 w-[30%] border-r border-slate-200">{refName || 'N/A'}</td>
                        <td className="bg-slate-50 font-bold p-2 w-[15%] border-r border-slate-200" rowSpan={3}>Reference Address</td>
                        <td className="p-2 w-[35%] text-[10px] leading-tight" rowSpan={3}>{refAddress || 'N/A'}</td>
                      </tr>
                      <tr className="border border-slate-200">
                        <td className="bg-slate-50 font-bold p-2 border-r border-slate-200">Relationship</td>
                        <td className="p-2 border-r border-slate-200">{refRelation || 'N/A'}</td>
                      </tr>
                      <tr className="border border-slate-200">
                        <td className="bg-slate-50 font-bold p-2 border-r border-slate-200">Contact No</td>
                        <td className="p-2 border-r border-slate-200">{refContact || 'N/A'}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Declaration */}
                  <p className="text-[10px] italic text-slate-500 mt-6 text-justify">
                    I hereby declare that all the information provided in this biodata sheet is correct, complete, and true to the best of my knowledge and belief. I understand that any false or misleading statements may lead to cancellation of my candidature or termination of employment.
                  </p>

                  {/* Signatures */}
                  <div className="flex justify-between items-center mt-24 pt-4">
                    <div className="border-t border-slate-400 w-44 text-center pt-2 font-bold text-[10px] text-slate-600">Candidate Signature</div>
                    <div className="border-t border-slate-400 w-44 text-center pt-2 font-bold text-[10px] text-slate-600">Authorized Signature</div>
                    <div className="font-bold text-[10px] text-slate-600">Date: {new Date().toLocaleDateString('en-GB')}</div>
                  </div>

                </div>
              </div>
            );
          })()}
        </Modal>
      )}

      {isCorrectionModalOpen && selectedSubmissionForDetails && (
        <RequestCorrectionModal
          isOpen={isCorrectionModalOpen}
          onClose={() => setIsCorrectionModalOpen(false)}
          targetId={selectedSubmissionForDetails.id}
          targetType="submission"
          applicantName={getApplicantName(selectedSubmissionForDetails.data, selectedSubmissionForDetails.originalFormSections) || 'Applicant'}
          formSections={selectedSubmissionForDetails.originalFormSections}
          createdBy={authUser?.displayName || authUser?.email || 'Admin'}
          initialSelectedFields={(() => {
            const effectiveDup = getEffectiveDuplicateCheck(selectedSubmissionForDetails);
            if (!effectiveDup || !effectiveDup.isDuplicate) return [];
            const fields: string[] = [];
            const matches = effectiveDup.matches && effectiveDup.matches.length > 0 ? effectiveDup.matches : [effectiveDup];
            const allFields = (selectedSubmissionForDetails.originalFormSections || []).flatMap(s => s.fields || []);
            matches.forEach(m => {
              const matchedFieldLower = (m.matchedField || '').toLowerCase();
              const found = allFields.find(f => {
                const lbl = (f.label || '').toLowerCase();
                if (matchedFieldLower.includes('pan') && lbl.includes('pan')) return true;
                if (matchedFieldLower.includes('aadhaar') && (lbl.includes('aadhaar') || lbl.includes('aadhar'))) return true;
                if (matchedFieldLower.includes('uan') && (lbl.includes('uan') || lbl.includes('epfo'))) return true;
                if (matchedFieldLower.includes('phone') && (lbl.includes('phone') || lbl.includes('mobile'))) return true;
                return false;
              });
              if (found && !fields.includes(found.id)) {
                fields.push(found.id);
              }
            });
            return fields;
          })()}
        />
      )}

    </div>
  );
};

export default AdminReviewSubmissionsPage;



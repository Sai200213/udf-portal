
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import { extractTextFromPDF, parseAadhaarText, removePdfPassword } from '../src/utils/aadhaarParser';
import { FormSection, FormField, FieldType, ReferralInvite } from '../types';
import Button from './common/Button';
import Input from './common/Input';
import { ArrowLeft, CheckCircle, AlertTriangle, ChevronLeft, ChevronRight, Zap, Loader2, XCircle, RotateCcw, Download, AlertCircle, Info, Fingerprint, Trash2, FileText, UserCheck } from 'lucide-react';
import ProgressBar from './common/ProgressBar';
import { useAuth } from '../src/context/AuthContext';
import { useData } from '../src/contexts/DataContext';
import { loginWithGoogleForOnboarding, loginAnonymously } from '../src/services/authService';
import { checkLinkedUidExists } from '../src/services/employeeService';
import { subscribeToLegacyClaimConfig } from '../src/services/adminService';
import { signOut } from 'firebase/auth';
import { auth, storage, ensureAuthenticated } from '../src/firebase/config';
import { ref, getDownloadURL, getBlob } from 'firebase/storage';
import { uploadSubmissionDocument } from '../src/services/storageService';
import { saveFileToSession, removeFileFromSession, getAllFilesFromSession, clearFileSession } from '../src/utils/fileSessionStore';

// Import employee-specific field components
import EmployeeTextField from './employeeFormFields/EmployeeTextField';
import EmployeeTextareaField from './employeeFormFields/EmployeeTextareaField';
import EmployeeDropdownField from './employeeFormFields/EmployeeDropdownField';
import EmployeeDateField from './employeeFormFields/EmployeeDateField';
import EmployeeCheckboxField from './employeeFormFields/EmployeeCheckboxField';
import EmployeeRadioField from './employeeFormFields/EmployeeRadioField';
import EmployeeFileUploadField from './employeeFormFields/EmployeeFileUploadField';
import LegacyClaimModal from './LegacyClaimModal';
import { CheckSquare, Square } from 'lucide-react';

// ─── Legacy Field Mapping: CSV Header → { fieldId, sectionName, sectionOrder } ───
interface AutofillCandidate {
  fieldId: string;
  label: string;
  value: string;
  sectionName: string;
  sectionOrder: number;
  selected: boolean;
}

const LEGACY_FIELD_MAP: Record<string, { fieldId: string; sectionName: string; sectionOrder: number }> = {
  // ── Personal Details (Section 0) ──
  'Full Name':        { fieldId: '7debf274-baee-4bac-a137-4b4b46719874', sectionName: 'Personal Details', sectionOrder: 0 },
  'Phone Number':     { fieldId: 'eb3617dc-9f1d-475d-a2db-005b6bc2500c', sectionName: 'Personal Details', sectionOrder: 0 },
  'Gender':           { fieldId: '5df6fa40-c39f-41a7-9ee7-789a47435ef0', sectionName: 'Personal Details', sectionOrder: 0 },
  'Date of Birth':    { fieldId: '6e570a01-14e0-4e18-b112-97ddc51d0778', sectionName: 'Personal Details', sectionOrder: 0 },
  'Citizenship':      { fieldId: '2fdacb1b-254f-4fc3-923a-53233214124f', sectionName: 'Personal Details', sectionOrder: 0 },
  'Blood Group':      { fieldId: '2f8c72f5-10f4-4414-bfcd-274fc69592e2', sectionName: 'Personal Details', sectionOrder: 0 },
  'Height':           { fieldId: '5ae316e6-2941-4e58-93b8-a6fe5a200e98', sectionName: 'Personal Details', sectionOrder: 0 },
  'Identity Marks':   { fieldId: '7386dcfa-e693-4998-a1cb-35a8fa8029de', sectionName: 'Personal Details', sectionOrder: 0 },
  'Marital Status':   { fieldId: 'c53d7ba7-58a0-4cf0-8691-8eb7bef7b951', sectionName: 'Personal Details', sectionOrder: 0 },
  'Spouse Name':      { fieldId: '7db47bc3-e4cc-4984-9687-2d94cad3e632', sectionName: 'Personal Details', sectionOrder: 0 },
  // ── Job Details (Section 1) ──
  'Qualification':    { fieldId: '61b19d37-b860-44ef-80e9-d33c3b438655', sectionName: 'Job Details', sectionOrder: 1 },
  'Unit or Facility': { fieldId: '52ae217b-2602-4337-a1cd-a1f9bd36a4b0', sectionName: 'Job Details', sectionOrder: 1 },
  'Post of Apply':    { fieldId: 'db307195-cf54-4a6e-9056-f3974b050c4d', sectionName: 'Job Details', sectionOrder: 1 },
  'Specific Location / Sub-Unit': { fieldId: '68a2a893-0100-4740-9602-9988452377c8', sectionName: 'Job Details', sectionOrder: 1 },
  'Any Police Case':  { fieldId: '0c8a587e-08f3-4605-ad33-9ab34eb46d87', sectionName: 'Job Details', sectionOrder: 1 },
  'Previous Employment History': { fieldId: '4b05d2b6-ff73-4dbe-befa-eba77c8ce1c4', sectionName: 'Job Details', sectionOrder: 1 },
  'Previous Company & Experience': { fieldId: 'd16a6da1-fc29-405e-bbb6-cb186b8f8666', sectionName: 'Job Details', sectionOrder: 1 },
  // ── Address (Section 2) ──
  'Present Address':   { fieldId: '8532f460-7bcf-4831-ab62-96375b80e6ab', sectionName: 'Address', sectionOrder: 2 },
  'Permanent Address': { fieldId: '29bae22a-59db-4b1b-bafd-64e8018a0f4e', sectionName: 'Address', sectionOrder: 2 },
  // ── Reference (Section 3) ──
  'Reference Name':         { fieldId: '2e1f27bf-94e7-421f-b69c-7e8dfaf0ee13', sectionName: 'Reference', sectionOrder: 3 },
  'Reference Relationship': { fieldId: '13c82880-161a-4fa9-a8b6-0558d5c88c53', sectionName: 'Reference', sectionOrder: 3 },
  'Reference Address':      { fieldId: '7681644c-02f8-4034-b0ce-cc11dfd3dca7', sectionName: 'Reference', sectionOrder: 3 },
  'Reference Contact No':   { fieldId: 'e1479d43-ed04-4fde-a508-130f43b4f12d', sectionName: 'Reference', sectionOrder: 3 },
  // ── Family Details (Section 4) ──
  "Father's Name":          { fieldId: '3f09e364-7875-40a2-9490-41251be20366', sectionName: 'Family Details', sectionOrder: 4 },
  "Mother's Name":          { fieldId: 'c432a45e-c1f0-4e64-8002-1f1dba3bf660', sectionName: 'Family Details', sectionOrder: 4 },
  "Father's Mobile Number": { fieldId: '30d78dae-fb7c-4264-a159-c04993d8885c', sectionName: 'Family Details', sectionOrder: 4 },
  "Mother's Mobile Number": { fieldId: '30fab2de-452d-46bf-8079-2f53d322388d', sectionName: 'Family Details', sectionOrder: 4 },
  // ── Government Identifications (Section 5) ──
  'Aadhar Card No':   { fieldId: '18855ee9-0d66-41d6-988b-128b776a8c5b', sectionName: 'Government IDs', sectionOrder: 5 },
  'PAN Card No':      { fieldId: 'da8edb18-4bed-41ca-8233-2280b97dac8d', sectionName: 'Government IDs', sectionOrder: 5 },
  'UAN No or EPFO':   { fieldId: 'f6665f3e-98f4-4d92-8b53-adcaa1993bbe', sectionName: 'Government IDs', sectionOrder: 5 },
  'ESIC No':          { fieldId: '41e3505e-15fb-4067-9c6a-2c690e736fab', sectionName: 'Government IDs', sectionOrder: 5 },
  'PVC (Police Verification Certificate)': { fieldId: '1052957c-a885-494e-af2c-ae1af5c5cc8e', sectionName: 'Government IDs', sectionOrder: 5 },
  'PVC Number':       { fieldId: '791bdd86-20c2-4097-bcc1-c85e8f649961', sectionName: 'Government IDs', sectionOrder: 5 },
  // ── Bank Details (Section 6) ──
  'Bank Name':   { fieldId: '1a35eaa7-d302-4e49-8649-e85cab8b3b77', sectionName: 'Bank Details', sectionOrder: 6 },
  'Account No':  { fieldId: '3519c111-aaa6-4fe0-8d83-d03dd7612e28', sectionName: 'Bank Details', sectionOrder: 6 },
  'IFSC Code':   { fieldId: '86854000-7727-40bb-9932-09e28e443ad8', sectionName: 'Bank Details', sectionOrder: 6 },
  'Branch Name': { fieldId: '6fe166fc-29a3-41ea-a19f-a498b48089b9', sectionName: 'Bank Details', sectionOrder: 6 },
};

// Fallback aliases: map legacy named fields to CSV header keys
const LEGACY_NAMED_ALIASES: Record<string, string> = {
  fullName: 'Full Name',
  phoneNumber: 'Phone Number',
  aadhaarNumber: 'Aadhar Card No',
  panNumber: 'PAN Card No',
  bankAccountNumber: 'Account No',
  fatherName: "Father's Name",
  dateOfBirth: 'Date of Birth',
  designation: 'Post of Apply',
  location: 'Unit or Facility',
};

interface EmployeeFormPageProps {
  sections: FormSection[];
  isLoading?: boolean;
  onBackToHome: () => void;
  onFormSubmit: (formData: Record<string, any>, formSections: FormSection[], linkedUid?: string, onProgress?: (fieldId: string, status: 'loading' | 'done' | 'error', percent?: number) => void, legacyImportId?: string) => Promise<{ success: boolean; id?: string; error?: string }>;
  onSaveDraft: (data: any, sectionIndex: number, draftId?: string) => Promise<string>;
  onRetrieveDraft: (draftId: string) => Promise<boolean>;
  onDiscardDraft?: (draftId: string) => Promise<boolean>;
  initialDraft?: { id: string; data: any; sectionIndex: number; inviteId?: string | null } | null;
}

// ─── Session Storage Keys for Reload Persistence & 30-Min Inactivity Timeout ───
const SS_FORM_DATA = 'onboarding_formData';
const SS_CURRENT_STEP = 'onboarding_currentStep';
const SS_HAS_AUTH = 'onboarding_hasAuth';
const SS_LINKED_UID = 'onboarding_linkedUid';
const SS_SAVED_DRAFT_ID = 'onboarding_savedDraftId';
const SS_LAST_ACTIVE = 'onboarding_lastActive';
const ONBOARDING_SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes of inactivity

/** Safely read JSON from sessionStorage with localStorage fallback */
const readSession = <T,>(key: string, fallback: T): T => {
  try {
    const raw = sessionStorage.getItem(key) || localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
};

/** Check if the current onboarding session is valid and not expired due to inactivity */
const isSessionActive = (): boolean => {
  try {
    const rawLastActive = sessionStorage.getItem(SS_LAST_ACTIVE) || localStorage.getItem(SS_LAST_ACTIVE);
    if (!rawLastActive) return false;
    const lastActiveTime = parseInt(rawLastActive, 10);
    if (isNaN(lastActiveTime)) return false;
    return (Date.now() - lastActiveTime) < ONBOARDING_SESSION_TIMEOUT_MS;
  } catch { return false; }
};

/** Refresh session activity timestamp */
const updateSessionActivity = () => {
  try {
    const nowStr = Date.now().toString();
    sessionStorage.setItem(SS_LAST_ACTIVE, nowStr);
    localStorage.setItem(SS_LAST_ACTIVE, nowStr);
  } catch {}
};

/** Clear all onboarding session keys (text + files) */
const clearOnboardingSession = async () => {
  sessionStorage.removeItem(SS_FORM_DATA);
  sessionStorage.removeItem(SS_CURRENT_STEP);
  sessionStorage.removeItem(SS_HAS_AUTH);
  sessionStorage.removeItem(SS_LINKED_UID);
  sessionStorage.removeItem(SS_SAVED_DRAFT_ID);
  sessionStorage.removeItem(SS_LAST_ACTIVE);
  sessionStorage.removeItem('referralInviteId');
  localStorage.removeItem(SS_FORM_DATA);
  localStorage.removeItem(SS_CURRENT_STEP);
  localStorage.removeItem(SS_SAVED_DRAFT_ID);
  localStorage.removeItem(SS_LAST_ACTIVE);
  localStorage.removeItem('referralInviteId');
  await clearFileSession();
};

const isFormEmpty = (data: Record<string, any>, referralInvite?: ReferralInvite | null): boolean => {
  if (!data) return true;

  const isSystemOrReferralKey = (key: string): boolean => {
    // Explicit system / referral metadata fields
    if (['__referralInviteId', 'referralInviteId', 'prefillFields'].includes(key)) return true;
    
    // Site & Unit fields (UUIDs and aliases)
    if (key === 'siteId' || key === '52ae217b-2602-4337-a1cd-a1f9bd36a4b0' || key === '68a2a893-0100-4740-9602-9988452377c8') {
      return true;
    }

    // Post of apply / Designation fields (UUIDs and aliases)
    if (key === 'designation' || key === 'db307195-cf54-4a6e-9056-f3974b050c4d') {
      return true;
    }

    // Locked phone number from referral invite
    if (key === 'eb3617dc-9f1d-475d-a2db-005b6bc2500c' && referralInvite?.lockedPhoneNumber) {
      return true;
    }

    // Custom referral prefill fields
    if (referralInvite?.prefillFields && key in referralInvite.prefillFields) {
      return true;
    }

    return false;
  };

  const hasFilledValue = (val: any): boolean => {
    if (val === undefined || val === null) return false;
    if (typeof val === 'string') return val.trim() !== '';
    if (typeof val === 'boolean') return val; // true is filled, false (unchecked) is empty
    if (Array.isArray(val)) return val.length > 0 && val.some(hasFilledValue);
    if (typeof val === 'object') {
      if (val instanceof File || val instanceof Blob) return true;
      return Object.values(val).some(hasFilledValue);
    }
    return true; // number, etc.
  };

  const userEntries = Object.entries(data).filter(([key]) => !isSystemOrReferralKey(key));
  if (userEntries.length === 0) return true;

  return !userEntries.some(([, val]) => hasFilledValue(val));
};

const EmployeeFormPage: React.FC<EmployeeFormPageProps> = ({ sections, isLoading, onBackToHome, onFormSubmit, onSaveDraft, onRetrieveDraft, onDiscardDraft, initialDraft }) => {
  const { authUser, isSuperAdmin } = useAuth();
  const { roles, sites, portalConfig } = useData();

  const [inviteError, setInviteError] = useState<string | null>(null);
  const [referralInvite, setReferralInvite] = useState<ReferralInvite | null>(null);
  const [isInviteLoading, setIsInviteLoading] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const refId = params.get('ref');
    const savedRefId = sessionStorage.getItem('referralInviteId') || localStorage.getItem('referralInviteId');
    return !!(refId || savedRefId);
  });

  const restoreReferralFromDraft = useCallback((inviteId?: string | null) => {
    if (!inviteId) return;
    sessionStorage.setItem('referralInviteId', inviteId);
    localStorage.setItem('referralInviteId', inviteId);
    setFormData(prev => ({
      ...prev,
      __referralInviteId: inviteId
    }));
    import('../src/services/employeeService').then(({ getReferralInvite }) => {
      getReferralInvite(inviteId).then(invite => {
        if (invite && invite.status === 'Active' && (!invite.expiresAt || new Date(invite.expiresAt).getTime() > Date.now())) {
          setReferralInvite(invite);
        }
      }).catch(e => console.warn('[Draft] Failed to restore referral invite:', e));
    });
  }, []);

  // ─── Session Continuity Check: active within 30 minutes and matching referral ───
  const isContinuingSession = (): boolean => {
    const params = new URLSearchParams(window.location.search);
    const refId = params.get('ref');
    // If not on a referral URL, check if general session is active within 30 min
    if (!refId) return isSessionActive();

    // If on a referral URL, check if session was already active with this same referral invite
    const savedRef = sessionStorage.getItem('referralInviteId') || localStorage.getItem('referralInviteId');
    return savedRef === refId && isSessionActive();
  };

  // ─── Restore state from sessionStorage on mount ───
  const [currentStep, setCurrentStep] = useState(() => {
    if (!isContinuingSession()) return 0;
    return readSession<number>(SS_CURRENT_STEP, 0);
  });
  const [formData, setFormData] = useState<Record<string, any>>(() => {
    if (!isContinuingSession()) return {};
    return readSession<Record<string, any>>(SS_FORM_DATA, {});
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSavingDraft, setIsSavingDraft] = useState<boolean>(false);
  const [savedDraftId, setSavedDraftId] = useState<string>(() => {
    if (!isContinuingSession()) return '';
    const saved = readSession<string | null>(SS_SAVED_DRAFT_ID, null);
    return saved || '';
  });
  const [showSaveModal, setShowSaveModal] = useState<boolean>(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [wasRestoredFromSession, setWasRestoredFromSession] = useState<boolean>(false);

  // Submission Progress State
  const [submissionSteps, setSubmissionSteps] = useState<{ label: string; status: 'pending' | 'loading' | 'done' | 'error'; percent?: number }[]>([]);
  const [showSubmissionProgress, setShowSubmissionProgress] = useState(false);

  // Retrieve Draft State
  const [showRetrieveModal, setShowRetrieveModal] = useState(false);
  const [retrieveCode, setRetrieveCode] = useState('');
  const [isRetrieving, setIsRetrieving] = useState(false);
  const [retrieveError, setRetrieveError] = useState<string | null>(null);
  const retrieveInputRef = useRef<HTMLInputElement>(null);

  // Legacy Claim State
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [isLegacyClaimEnabled, setIsLegacyClaimEnabled] = useState(false);

  // Hybrid Onboarding State — restore auth flag from session if active within 30-min window
  const [hasSelectedAuth, setHasSelectedAuth] = useState<boolean>(() => {
    if (!isContinuingSession()) return false;
    return readSession<boolean>(SS_HAS_AUTH, false);
  });
  const [linkedUid, setLinkedUid] = useState<string | null>(() => {
    if (!isContinuingSession()) return null;
    return readSession<string | null>(SS_LINKED_UID, null);
  });
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Aadhaar Parsing State
  const [isParsingAadhaar, setIsParsingAadhaar] = useState(false);
  const [pdfPassword, setPdfPassword] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password Modal State
  // Job Opening URL Prefill (?siteId=X&role=Y)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const siteParam = params.get('siteId') || params.get('site');
      const roleParam = params.get('role') || params.get('designation');
      if (siteParam || roleParam) {
        setFormData(prev => {
          const next = { ...prev };
          if (siteParam) next['siteId'] = siteParam;
          if (roleParam) next['designation'] = roleParam;
          return next;
        });
      }
    } catch (e) {}
  }, []);

  // Ensure candidate has an active authenticated session (anonymous or existing) on mount
  useEffect(() => {
    ensureAuthenticated().catch((err) => {
      console.warn('[EmployeeFormPage] Authentication initialization error:', err);
    });
  }, []);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const autoSaveTimeout = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);  // Use ref (not state) to avoid re-triggering the effect
  const lastSavedDataRef = useRef<string>(''); // Track last saved snapshot to avoid duplicate saves
  const hasShownFirstSavePopup = useRef(false); // Show recovery code popup only ONCE for guests
  const [codeCopied, setCodeCopied] = useState(false); // Copy feedback for code badge

  // Transition & Animation Refs/States for Save Modal minimization
  const modalCardRef = useRef<HTMLDivElement>(null);
  const headerBadgeRef = useRef<HTMLButtonElement>(null);
  const [isMinimizing, setIsMinimizing] = useState(false);
  const [minimizingStyle, setMinimizingStyle] = useState<React.CSSProperties>({});
  const [badgePulse, setBadgePulse] = useState(false);

  // Conflict Resolution, Storage Tracking, & Discard State
  const [showConflictModal, setShowConflictModal] = useState<boolean>(false);
  const [conflictDraft, setConflictDraft] = useState<any>(null);
  const conflictCheckedForSessionRef = useRef<boolean>(false);
  const [totalStorageSize, setTotalStorageSize] = useState<number>(0);
  const [isDiscarding, setIsDiscarding] = useState<boolean>(false);
  const initialDraftLoadedIdRef = useRef<string | null>(null);
  const formDataRef = useRef<Record<string, any>>(formData);
  formDataRef.current = formData;
  const currentStepRef = useRef<number>(currentStep);
  currentStepRef.current = currentStep;
  const savedDraftIdRef = useRef<string | null>(savedDraftId);
  savedDraftIdRef.current = savedDraftId;

  // Extraction Results State
  const [showResults, setShowResults] = useState(false);
  const [extractionResults, setExtractionResults] = useState<{ label: string; value: string }[]>([]);
  const [extractionWarning, setExtractionWarning] = useState<string | null>(null);
  const [extractionMissing, setExtractionMissing] = useState<string[]>([]);
  const [legacyClaim, setLegacyClaim] = useState<{ employeeId: string; employeeName: string; submissionId?: string; legacyData: any } | null>(null);

  // Autofill Selection Modal State
  const [showAutofillModal, setShowAutofillModal] = useState(false);
  const [autofillCandidates, setAutofillCandidates] = useState<AutofillCandidate[]>([]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // ─── Persist formData locally to sessionStorage & localStorage (instant, 0 Firestore writes/reads) ───
  useEffect(() => {
    try {
      const serializable: Record<string, any> = {};
      for (const [key, val] of Object.entries(formData)) {
        if (val instanceof File || val instanceof Blob) continue; // skip files
        serializable[key] = val;
      }
      const serialized = JSON.stringify(serializable);
      sessionStorage.setItem(SS_FORM_DATA, serialized);
      localStorage.setItem(SS_FORM_DATA, serialized);
      updateSessionActivity();
    } catch (e) { /* quota exceeded — ignore */ }
  }, [formData]);

  // ─── Milestone Draft Sync: Synchronizes local draft to Firestore only at key milestones ───
  const syncDraftMilestone = useCallback(async (stepToSave?: number) => {
    if (!hasSelectedAuth || isFormEmpty(formData, referralInvite) || isSavingRef.current) return;
    const targetStep = stepToSave !== undefined ? stepToSave : currentStep;
    const saveSnapshot = JSON.stringify({ data: formData, step: targetStep });
    if (saveSnapshot === lastSavedDataRef.current) return;

    isSavingRef.current = true;
    setIsSavingDraft(true);
    try {
      const draftId = await onSaveDraft(formData, targetStep, savedDraftId || undefined);
      if (draftId) {
        setSavedDraftId(draftId);
        lastSavedDataRef.current = saveSnapshot;
        sessionStorage.setItem(SS_SAVED_DRAFT_ID, JSON.stringify(draftId));
        localStorage.setItem(SS_SAVED_DRAFT_ID, JSON.stringify(draftId));
      }
      // For Guest users: show recovery code popup on first milestone save
      if (!linkedUid && !hasShownFirstSavePopup.current) {
        hasShownFirstSavePopup.current = true;
        setShowSaveModal(true);
      }
    } catch (e: any) {
      if (e?.message?.includes('APPLICATION_ALREADY_SUBMITTED')) {
        const subId = e.message.split(':')[1] || savedDraftId || '';
        await clearOnboardingSession();
        setFormData({});
        setIsSubmitted(true);
        setSubmissionId(subId);
        return;
      }
      console.warn('[MILESTONE-SAVE] Draft sync failed:', e);
    } finally {
      isSavingRef.current = false;
      setIsSavingDraft(false);
    }
  }, [formData, currentStep, hasSelectedAuth, onSaveDraft, referralInvite, savedDraftId, linkedUid]);

  // ─── Persist currentStep ───
  useEffect(() => {
    try {
      const serialized = JSON.stringify(currentStep);
      sessionStorage.setItem(SS_CURRENT_STEP, serialized);
      localStorage.setItem(SS_CURRENT_STEP, serialized);
      updateSessionActivity();
    } catch (e) {}
  }, [currentStep]);

  // ─── Persist auth flags ───
  useEffect(() => {
    sessionStorage.setItem(SS_HAS_AUTH, JSON.stringify(hasSelectedAuth));
  }, [hasSelectedAuth]);
  useEffect(() => {
    sessionStorage.setItem(SS_LINKED_UID, JSON.stringify(linkedUid));
  }, [linkedUid]);

  useEffect(() => {
    sessionStorage.setItem(SS_SAVED_DRAFT_ID, JSON.stringify(savedDraftId));
  }, [savedDraftId]);

  // ─── Active Inactivity Watcher (30-Minute Timeout) ───
  useEffect(() => {
    if (!hasSelectedAuth) return;

    // Refresh activity on user touch/clicks/keys in this tab
    const handleActivity = () => updateSessionActivity();
    window.addEventListener('keydown', handleActivity, { passive: true });
    window.addEventListener('click', handleActivity, { passive: true });
    window.addEventListener('touchstart', handleActivity, { passive: true });

    // Periodic check every 1 minute to detect 30-minute timeout
    const timer = setInterval(() => {
      if (!isSessionActive()) {
        console.warn('[Onboarding] Session timed out after 30 minutes of inactivity.');
        setHasSelectedAuth(false);
        sessionStorage.removeItem(SS_HAS_AUTH);
        setAuthError('Your session has timed out due to 30 minutes of inactivity. Please select Google or Guest to resume your application.');
      }
    }, 60 * 1000);

    return () => {
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      clearInterval(timer);
    };
  }, [hasSelectedAuth]);

  // ─── Conflict Resolution Handler ───
  const handleResolveConflict = async (resolution: 'cloud' | 'local') => {
    conflictCheckedForSessionRef.current = true;
    if (!conflictDraft) return;
    
    if (resolution === 'cloud') {
      // Overwrite local edits with Cloud Draft
      setFormData(conflictDraft.data || {});
      if (conflictDraft.sectionIndex !== undefined) {
        setCurrentStep(conflictDraft.sectionIndex);
      }
      const draftId = conflictDraft.id || linkedUid || '';
      setSavedDraftId(draftId);
      if (conflictDraft.inviteId) {
        restoreReferralFromDraft(conflictDraft.inviteId);
      }
      sessionStorage.setItem(SS_SAVED_DRAFT_ID, JSON.stringify(draftId));
      sessionStorage.setItem(SS_FORM_DATA, JSON.stringify(conflictDraft.data || {}));
      sessionStorage.setItem(SS_CURRENT_STEP, JSON.stringify(conflictDraft.sectionIndex || 0));
      // Initialize lastSavedDataRef to match loaded draft to prevent immediate auto-save trigger
      const snapshot = JSON.stringify({ data: conflictDraft.data || {}, step: conflictDraft.sectionIndex || 0 });
      lastSavedDataRef.current = snapshot;
    } else {
      // Keep local edits & update Cloud Draft immediately
      try {
        const draftId = await onSaveDraft(formData, currentStep, conflictDraft.id || undefined);
        setSavedDraftId(draftId);
        sessionStorage.setItem(SS_SAVED_DRAFT_ID, JSON.stringify(draftId));
        sessionStorage.setItem(SS_FORM_DATA, JSON.stringify(formData));
        sessionStorage.setItem(SS_CURRENT_STEP, JSON.stringify(currentStep));
        // Initialize lastSavedDataRef to match newly saved draft to prevent immediate auto-save trigger
        const snapshot = JSON.stringify({ data: formData, step: currentStep });
        lastSavedDataRef.current = snapshot;
      } catch (err) {
        console.error("Failed to save local draft to cloud:", err);
      }
    }
    
    setShowConflictModal(false);
    setConflictDraft(null);
  };

  // ─── Save Modal Close with Flight Transition ───
  const handleCloseSaveModal = () => {
    if (!linkedUid && savedDraftId && modalCardRef.current && headerBadgeRef.current) {
      const modalRect = modalCardRef.current.getBoundingClientRect();
      const badgeRect = headerBadgeRef.current.getBoundingClientRect();

      const modalCenterX = modalRect.left + modalRect.width / 2;
      const modalCenterY = modalRect.top + modalRect.height / 2;
      const badgeCenterX = badgeRect.left + badgeRect.width / 2;
      const badgeCenterY = badgeRect.top + badgeRect.height / 2;

      const deltaX = badgeCenterX - modalCenterX;
      const deltaY = badgeCenterY - modalCenterY;
      const scale = badgeRect.width / modalRect.width;

      setIsMinimizing(true);
      setMinimizingStyle({
        transform: `translate(${deltaX}px, ${deltaY}px) scale(${scale})`,
        opacity: 0.1,
        pointerEvents: 'none',
        transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.5s ease-out',
        transformOrigin: 'center center',
      });

      setTimeout(() => {
        setShowSaveModal(false);
        setIsMinimizing(false);
        setMinimizingStyle({});
        setBadgePulse(true);
        setTimeout(() => setBadgePulse(false), 1000);
      }, 600);
    } else {
      setShowSaveModal(false);
    }
  };

  // ─── Discard Draft Handler ───
  const handleDiscardDraftClick = async () => {
    let draftId = savedDraftId || initialDraft?.id;
    if (!draftId && linkedUid) {
      try {
        const { getDraftByUser } = await import('../src/services/employeeService');
        const cloudDraft = await getDraftByUser(linkedUid, auth.currentUser?.email);
        if (cloudDraft?.id) draftId = cloudDraft.id;
      } catch (e) {}
    }

    const confirmDiscard = window.confirm(
      "Are you sure you want to discard this draft? This will permanently delete your saved progress and all uploaded files from secure draft storage. This action cannot be undone."
    );
    if (!confirmDiscard) return;

    setIsDiscarding(true);
    try {
      if (draftId && onDiscardDraft) {
        await onDiscardDraft(draftId);
      }
      setFormData({});
      setCurrentStep(0);
      setSavedDraftId('');
      await clearOnboardingSession();

      // If user was logged in with Google, log out completely so they can start fresh or switch accounts
      if (linkedUid || (auth.currentUser && !auth.currentUser.isAnonymous)) {
        setLinkedUid(null);
        setHasSelectedAuth(false);
        try {
          const { signOut } = await import('firebase/auth');
          await signOut(auth);
        } catch (soErr) {
          console.warn("Sign out during discard error:", soErr);
        }
      }

      alert("Draft and associated files have been permanently discarded.");
      
      // Automatically redirect back to the clean referral join link
      const refParam = new URLSearchParams(window.location.search).get('ref');
      window.location.replace(refParam ? `/join?ref=${encodeURIComponent(refParam)}` : '/join');
      return;
    } catch (err: any) {
      console.error("Discard draft failed:", err);
      alert(`Discard draft failed: ${err.message || err}`);
    } finally {
      setIsDiscarding(false);
    }
  };

  // ─── Cloud Draft Conflict Detection Effect ───
  useEffect(() => {
    if (!linkedUid) return;
    // CRITICAL: Only check conflict ONCE upon session start / initial Google link.
    // Never re-trigger while the candidate is actively filling or uploading in the same session.
    if (conflictCheckedForSessionRef.current) return;
    conflictCheckedForSessionRef.current = true;

    const checkCloudDraftConflict = async () => {
      try {
        const { getDraftByUser } = await import('../src/services/employeeService');
        const user = auth.currentUser;
        const cloudDraft = await getDraftByUser(linkedUid, user?.email);
        if (cloudDraft && cloudDraft.data) {
          // If the cloud draft is already the active draft being edited in this session, do not conflict
          if (savedDraftId && cloudDraft.id === savedDraftId) return;

          const userHasTypedData = !isFormEmpty(formData, referralInvite);
          
          if (userHasTypedData) {
            // Check if user's typed edits actually differ from the saved cloud draft
            const isDifferent = JSON.stringify(formData) !== JSON.stringify(cloudDraft.data);
            if (isDifferent) {
              setConflictDraft(cloudDraft);
              setShowConflictModal(true);
              return;
            }
          }
          
          // No user-typed edits or identical -> silently restore cloud draft
          setFormData(cloudDraft.data);
          if (cloudDraft.sectionIndex !== undefined) {
            setCurrentStep(cloudDraft.sectionIndex);
          }
          const draftId = cloudDraft.id || linkedUid;
          setSavedDraftId(draftId);

          const currentRef = new URLSearchParams(window.location.search).get('ref');
          if (currentRef) {
            restoreReferralFromDraft(currentRef);
          } else if (cloudDraft.inviteId) {
            restoreReferralFromDraft(cloudDraft.inviteId);
          }

          sessionStorage.setItem(SS_SAVED_DRAFT_ID, JSON.stringify(draftId));
          sessionStorage.setItem(SS_FORM_DATA, JSON.stringify(cloudDraft.data));
          sessionStorage.setItem(SS_CURRENT_STEP, JSON.stringify(cloudDraft.sectionIndex || 0));
          // Initialize lastSavedDataRef to match loaded draft to prevent immediate auto-save trigger
          const snapshot = JSON.stringify({ data: cloudDraft.data || {}, step: cloudDraft.sectionIndex || 0 });
          lastSavedDataRef.current = snapshot;
          setWasRestoredFromSession(true);
          setTimeout(() => setWasRestoredFromSession(false), 5000);
        }
      } catch (err) {
        console.error("Error checking cloud draft conflict:", err);
      }
    };

    checkCloudDraftConflict();
  }, [linkedUid]);

  // ─── Cross-Device Submission Sync Effect ───
  // If the user submits on their phone while a tab was left open on their laptop,
  // this effect detects that the submission already succeeded and flips the tab
  // to the Submitted screen instead of saving a ghost draft.
  useEffect(() => {
    const checkAlreadySubmitted = async () => {
      const idToCheck = savedDraftId;
      const uidToCheck = linkedUid;
      const emailToCheck = auth.currentUser?.email;
      if (!idToCheck && !uidToCheck && !emailToCheck) return;

      try {
        const { checkIfSubmissionCompleted } = await import('../src/services/employeeService');
        const res = await checkIfSubmissionCompleted(idToCheck, uidToCheck, emailToCheck);
        if (res.isSubmitted) {
          await clearOnboardingSession();
          setFormData({});
          setSavedDraftId('');
          setSubmissionId(res.submissionId || idToCheck || null);
          setIsSubmitted(true);
        }
      } catch (e) {
        // non-blocking
      }
    };

    checkAlreadySubmitted();
    const handleFocus = () => checkAlreadySubmitted();
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [savedDraftId, linkedUid]);

  // ─── Storage Quota Monitoring Effect ───
  const fetchStorageSize = useCallback(async () => {
    const user = auth.currentUser;
    if (!user || user.isAnonymous) return;
    try {
      const { getStorageFolderSize } = await import('../src/services/storageService');
      const bytes = await getStorageFolderSize(`onboarding/${user.uid}`);
      setTotalStorageSize(bytes);
    } catch (e) {
      // Safe to ignore non-blocking quota lookups
    }
  }, [hasSelectedAuth]);

  useEffect(() => {
    fetchStorageSize();
  }, [fetchStorageSize, formData]);

  // ─── On mount: auto-restore auth + files from existing session ───
  useEffect(() => {
    let cancelled = false;
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (cancelled) return;
      if (user) {
        const sessionHasAuth = readSession<boolean>(SS_HAS_AUTH, false);
        const hasRefParam = !!new URLSearchParams(window.location.search).get('ref');

        // Only restore in-progress state if candidate is actively editing in this tab (e.g. F5 reload)
        // If visiting via referral link or has not selected auth yet, keep welcome screen active!
        if (!sessionHasAuth || hasRefParam) {
          return;
        }

        if (!user.isAnonymous) {
          // FRONT DOOR GUARD: Immediately check if this Google user already has a completed submission
          try {
            const { checkIfSubmissionCompleted } = await import('../src/services/employeeService');
            const subCheck = await checkIfSubmissionCompleted(savedDraftId || undefined, user.uid, user.email);
            if (subCheck.isSubmitted && !cancelled) {
              await clearOnboardingSession();
              setFormData({});
              setSavedDraftId('');
              setSubmissionId(subCheck.submissionId || null);
              setIsSubmitted(true);
              return;
            }
          } catch (chkErr) {
            console.warn('[Mount] Error checking submission completion:', chkErr);
          }

          // Firebase still has an authenticated Google session (e.g. refreshed, navigated back, or reopened browser)
          setHasSelectedAuth(true);
          if (!sessionStorage.getItem('isLinkingGoogle')) {
            setLinkedUid(user.uid);
          }
          sessionStorage.setItem(SS_HAS_AUTH, 'true');
          sessionStorage.setItem(SS_LINKED_UID, JSON.stringify(user.uid));

          // Auto-retrieve Cloud Draft if local form data is empty
          try {
            const { getDraftByUser } = await import('../src/services/employeeService');
            const cloudDraft = await getDraftByUser(user.uid, user.email);
            if (cloudDraft && cloudDraft.data && !cancelled) {
              const localData = readSession<Record<string, any>>(SS_FORM_DATA, {});
              const localHasData = !isFormEmpty(localData, referralInvite);

              if (!localHasData) {
                setFormData(cloudDraft.data);
                if (cloudDraft.sectionIndex !== undefined) {
                  setCurrentStep(cloudDraft.sectionIndex);
                }
                setSavedDraftId(cloudDraft.id);
                const invId = cloudDraft.inviteId || (cloudDraft.data as any)?.__referralInviteId;
                if (invId) {
                  restoreReferralFromDraft(invId);
                }
                sessionStorage.setItem(SS_SAVED_DRAFT_ID, JSON.stringify(cloudDraft.id));
                sessionStorage.setItem(SS_FORM_DATA, JSON.stringify(cloudDraft.data));
                sessionStorage.setItem(SS_CURRENT_STEP, JSON.stringify(cloudDraft.sectionIndex || 0));
                lastSavedDataRef.current = JSON.stringify({ data: cloudDraft.data || {}, step: cloudDraft.sectionIndex || 0 });
                setWasRestoredFromSession(true);
                conflictCheckedForSessionRef.current = true;
                setTimeout(() => setWasRestoredFromSession(false), 5000);
              }
            }
          } catch (draftErr) {
            console.warn('[Restore] Failed to auto-restore Google draft on mount:', draftErr);
          }
        } else if (readSession<boolean>(SS_HAS_AUTH, false)) {
          // Firebase has an anonymous session and user previously selected Guest
          const guestDraftId = readSession<string | null>(SS_SAVED_DRAFT_ID, null);
          if (guestDraftId) {
            try {
              const { checkIfSubmissionCompleted } = await import('../src/services/employeeService');
              const subCheck = await checkIfSubmissionCompleted(guestDraftId);
              if (subCheck.isSubmitted && !cancelled) {
                await clearOnboardingSession();
                setFormData({});
                setSavedDraftId('');
                setSubmissionId(subCheck.submissionId || guestDraftId);
                setIsSubmitted(true);
                return;
              }
            } catch (e) {}
          }
          setHasSelectedAuth(true);
        }

        // Restore file uploads from IndexedDB
        try {
          const restoredFiles = await getAllFilesFromSession();
          if (!cancelled && Object.keys(restoredFiles).length > 0) {
            setFormData(prev => ({ ...prev, ...restoredFiles }));
          }
        } catch (e) {
          console.warn('[Restore] Failed to restore files from IndexedDB:', e);
        }

        // Check if we actually have restored form data
        const restoredData = readSession<Record<string, any>>(SS_FORM_DATA, {});
        if (Object.keys(restoredData).length > 0 && !isFormEmpty(restoredData, referralInvite)) {
          setWasRestoredFromSession(true);
          // Auto-dismiss the restored banner after 5 seconds
          setTimeout(() => setWasRestoredFromSession(false), 5000);
        }
      }
    });
    return () => { cancelled = true; unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAuthSelection = async (method: 'google' | 'guest') => {
    setAuthError(null);
    if (method === 'guest') {
      try {
        setIsAuthLoading(true);
        // Ensure we clear any stale Google flags when choosing Guest
        localStorage.removeItem('onboardingGoogleAuth');
        await loginAnonymously();
        setHasSelectedAuth(true);
        sessionStorage.setItem(SS_HAS_AUTH, 'true');
        updateSessionActivity();
        const guestRef = new URLSearchParams(window.location.search).get('ref');
        if (guestRef) {
          sessionStorage.setItem('referralInviteId', guestRef);
          localStorage.setItem('referralInviteId', guestRef);
        }

        if (!savedDraftId) {
          try {
            const initialDraftId = await onSaveDraft(formData, 0);
            if (initialDraftId) {
              setSavedDraftId(initialDraftId);
              sessionStorage.setItem(SS_SAVED_DRAFT_ID, JSON.stringify(initialDraftId));
            }
          } catch (initErr) {
            console.warn('[Guest Auth] Initial draft pre-creation warning:', initErr);
          }
        }
      } catch (e: any) {
        console.error("Guest Auth Error:", e);
        setAuthError("Guest entry failed. Please try again.");
      } finally {
        setIsAuthLoading(false);
      }
      return;
    }

    if (method === 'google') {
      try {
        setIsAuthLoading(true);
        sessionStorage.setItem('isLinkingGoogle', 'true');
        // SUPPRESSION: Tell AuthContext we are just checking identity, do not load full profile
        localStorage.setItem('portalType', 'onboarding');

        const user = await loginWithGoogleForOnboarding();
        if (user && user.uid) {
          // FRONT DOOR GUARD: Immediately check if this Google user has already submitted an application
          try {
            const { checkIfSubmissionCompleted } = await import('../src/services/employeeService');
            const subCheck = await checkIfSubmissionCompleted(savedDraftId || undefined, user.uid, user.email);
            if (subCheck.isSubmitted) {
              await clearOnboardingSession();
              setFormData({});
              setSavedDraftId('');
              setSubmissionId(subCheck.submissionId || null);
              setIsSubmitted(true);
              return;
            }
          } catch (chkErr) {
            console.warn('[Google Auth] Error checking submission completion:', chkErr);
          }

          // Check if this Google account or email already exists in any collection
          const conflictMessage = await checkLinkedUidExists(user.uid, user.email);
          if (conflictMessage) {
            setAuthError(conflictMessage);
            setLinkedUid(null); // Prevent UI from showing as linked
            await signOut(auth); // Kill the conflicting Google session
            
            // If they were already in the form as a Guest, restore their anonymous session so they don't lose progress
            if (hasSelectedAuth) {
              await loginAnonymously();
            }
            return;
          }
          setLinkedUid(user.uid);
          setHasSelectedAuth(true);
          sessionStorage.setItem(SS_HAS_AUTH, 'true');
          sessionStorage.setItem(SS_LINKED_UID, JSON.stringify(user.uid));
          updateSessionActivity();
          const googleRef = new URLSearchParams(window.location.search).get('ref');
          if (googleRef) {
            sessionStorage.setItem('referralInviteId', googleRef);
            localStorage.setItem('referralInviteId', googleRef);
          }
          conflictCheckedForSessionRef.current = true;

          // Immediately check and restore cloud draft for this Google user
          try {
            const { getDraftByUser } = await import('../src/services/employeeService');
            const cloudDraft = await getDraftByUser(user.uid, user.email);
            if (cloudDraft && cloudDraft.data && (!savedDraftId || cloudDraft.id !== savedDraftId)) {
              const userHasTypedData = !isFormEmpty(formData, referralInvite);

              if (userHasTypedData && JSON.stringify(formData) !== JSON.stringify(cloudDraft.data)) {
                setConflictDraft(cloudDraft);
                setShowConflictModal(true);
              } else {
                setFormData(cloudDraft.data);
                if (cloudDraft.sectionIndex !== undefined) {
                  setCurrentStep(cloudDraft.sectionIndex);
                }
                setSavedDraftId(cloudDraft.id);
                const currentRef = new URLSearchParams(window.location.search).get('ref');
                const invId = currentRef || cloudDraft.inviteId || (cloudDraft.data as any)?.__referralInviteId;
                if (invId) {
                  restoreReferralFromDraft(invId);
                }
                sessionStorage.setItem(SS_SAVED_DRAFT_ID, JSON.stringify(cloudDraft.id));
                sessionStorage.setItem(SS_FORM_DATA, JSON.stringify(cloudDraft.data));
                sessionStorage.setItem(SS_CURRENT_STEP, JSON.stringify(cloudDraft.sectionIndex || 0));
                lastSavedDataRef.current = JSON.stringify({ data: cloudDraft.data || {}, step: cloudDraft.sectionIndex || 0 });
                setWasRestoredFromSession(true);
                setTimeout(() => setWasRestoredFromSession(false), 5000);
              }
            } else if (!cloudDraft) {
              // Brand new Google user with no cloud draft:
              // Wipe any stale local tab state so a brand-new user NEVER inherits
              // leftover form data or files from previous test sessions in this tab!
              sessionStorage.removeItem(SS_FORM_DATA);
              sessionStorage.removeItem(SS_CURRENT_STEP);
              sessionStorage.removeItem(SS_SAVED_DRAFT_ID);
              setSavedDraftId('');
              setCurrentStep(0);
              await clearFileSession();

              // Preserve only clean referral pre-fills (if visiting with referral)
              const cleanPrefills: Record<string, any> = {};
              if (referralInvite) {
                cleanPrefills.__referralInviteId = referralInvite.id;
                if (referralInvite.siteName) {
                  const matchedSite = sites.find(s => s.name === referralInvite.siteName || s.id === referralInvite.siteName);
                  cleanPrefills[SITE_FIELD_ID] = matchedSite ? matchedSite.id : referralInvite.siteName;
                }
                if (referralInvite.designation) {
                  cleanPrefills[DESIGNATION_FIELD_ID] = referralInvite.designation;
                }
                if (referralInvite.lockedPhoneNumber) {
                  cleanPrefills['eb3617dc-9f1d-475d-a2db-005b6bc2500c'] = referralInvite.lockedPhoneNumber;
                }
                if (referralInvite.prefillFields) {
                  Object.assign(cleanPrefills, referralInvite.prefillFields);
                }
              }
              setFormData(cleanPrefills);
              sessionStorage.setItem(SS_FORM_DATA, JSON.stringify(cleanPrefills));
              sessionStorage.setItem(SS_CURRENT_STEP, '0');
              lastSavedDataRef.current = JSON.stringify({ data: cleanPrefills, step: 0 });
              setWasRestoredFromSession(false);

              // Pre-create initial draft in Firestore so Portal ID is reserved and storage folder exists
              try {
                const initialDraftId = await onSaveDraft(cleanPrefills, 0);
                if (initialDraftId) {
                  setSavedDraftId(initialDraftId);
                  sessionStorage.setItem(SS_SAVED_DRAFT_ID, JSON.stringify(initialDraftId));
                }
              } catch (initErr) {
                console.warn('[Google Auth] Initial draft pre-creation warning:', initErr);
              }
            }
          } catch (cloudErr) {
            console.warn('[Google Auth] Failed to check cloud draft:', cloudErr);
          }
        } else {
          setAuthError("Google Sign-In succeeded but returned no UID.");
        }
      } catch (e: any) {
        console.error("Auth Selection Error:", e);
        setAuthError(e.message || "Google Sign-In failed. Please try again or continue as Guest.");
      } finally {
        sessionStorage.removeItem('isLinkingGoogle');
        setIsAuthLoading(false);
      }
    }
  };

  // Raw Auth state tracker for UI
  const [rawGoogleUser, setRawGoogleUser] = useState<any>(null);

  useEffect(() => {
    // We listen to the raw auth state because AuthContext suppresses the profile during onboarding
    const unsubscribe = auth.onAuthStateChanged((user) => {
        if (user && !user.isAnonymous) {
            setRawGoogleUser(user);
        } else {
            setRawGoogleUser(null);
        }
    });
    return () => unsubscribe();
  }, []);

  // Field IDs for Site/Unit logic
  const SITE_FIELD_ID = '52ae217b-2602-4337-a1cd-a1f9bd36a4b0';
  const SUBUNIT_FIELD_ID = '68a2a893-0100-4740-9602-9988452377c8';
  const DESIGNATION_FIELD_ID = 'db307195-cf54-4a6e-9056-f3974b050c4d';

  const isSiteField = useCallback((f: FormField) => {
    return f.id === SITE_FIELD_ID ||
      f.label.trim().toLowerCase() === 'unit or facility' ||
      f.label.trim().toLowerCase() === 'unit' ||
      f.label.trim().toLowerCase() === 'facility';
  }, []);

  const isSubunitField = useCallback((f: FormField) => {
    return f.id === SUBUNIT_FIELD_ID ||
      f.label.trim().toLowerCase().includes('sub-unit') ||
      f.label.trim().toLowerCase().includes('sub unit');
  }, []);

  const isDesignationField = useCallback((f: FormField) => {
    return f.id === DESIGNATION_FIELD_ID ||
      f.label.trim().toLowerCase() === 'post of apply' ||
      f.label.trim().toLowerCase() === 'designation' ||
      f.label.trim().toLowerCase() === 'post';
  }, []);

  // Load draft if exists (ONLY when a new external draft is provided, never from auto-save echoes)
  useEffect(() => {
    if (initialDraft && initialDraft.id) {
      // If this draft is already loaded or is currently being edited in this active session, ignore to protect live user input
      if (initialDraftLoadedIdRef.current === initialDraft.id || savedDraftId === initialDraft.id) {
        return;
      }
      initialDraftLoadedIdRef.current = initialDraft.id;

      const invId = initialDraft.inviteId || (initialDraft.data as any)?.__referralInviteId;
      setFormData({
        ...(initialDraft.data || {}),
        ...(invId ? { __referralInviteId: invId } : {})
      });
      setCurrentStep(initialDraft.sectionIndex || 0);
      setSavedDraftId(initialDraft.id);
      setHasSelectedAuth(true);
      if (invId) {
        restoreReferralFromDraft(invId);
      }
      // Initialize lastSavedDataRef to match retrieved draft to prevent immediate auto-save trigger
      const snapshot = JSON.stringify({ data: initialDraft.data || {}, step: initialDraft.sectionIndex || 0 });
      lastSavedDataRef.current = snapshot;
    }
  }, [initialDraft, savedDraftId]);

  // Load legacy claim configuration
  useEffect(() => {
    const unsub = subscribeToLegacyClaimConfig((config) => {
      setIsLegacyClaimEnabled(!!config?.enabled);
    });
    return () => unsub();
  }, []);

  const checkLegacyClaim = () => {
    // Check for legacy claim in sessionStorage
    const storedClaim = sessionStorage.getItem('legacyClaim');
    if (storedClaim) {
      try {
        const claimData = JSON.parse(storedClaim);
        setLegacyClaim(claimData);

        // Scenario 1: They have an existing submission ID (already started onboarding before)
        if (claimData.submissionId) {
          onRetrieveDraft(claimData.submissionId).then((success) => {
             if (success) setHasSelectedAuth(true);
          });
        } 
        // Scenario 2: First time joining since legacy import — show Autofill Selection Modal
        else if (claimData.legacyData) {
          const ld = claimData.legacyData;
          const raw: Record<string, string> = ld.rawData || {};
          const candidates: AutofillCandidate[] = [];

          // 1. Check rawData keys against LEGACY_FIELD_MAP
          for (const [csvHeader, mapping] of Object.entries(LEGACY_FIELD_MAP)) {
            // Case-insensitive lookup in rawData
            const matchingKey = Object.keys(raw).find(k => k.toLowerCase().trim() === csvHeader.toLowerCase().trim());
            const value = matchingKey ? raw[matchingKey]?.trim() : '';
            if (value) {
              // Normalize date fields (DD-MM-YYYY → YYYY-MM-DD)
              let normalizedValue = value;
              if (csvHeader === 'Date of Birth') {
                const parts = value.split(/[\-\/\.]/);
                if (parts.length === 3) {
                  const [d, m, y] = parts;
                  if (y && y.length === 4) normalizedValue = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                }
              }
              candidates.push({
                fieldId: mapping.fieldId,
                label: csvHeader,
                value: normalizedValue,
                sectionName: mapping.sectionName,
                sectionOrder: mapping.sectionOrder,
                selected: true,
              });
            }
          }

          // 2. Fallback: Check named fields on legacyData (e.g. fullName, phoneNumber etc)
          for (const [namedKey, csvHeader] of Object.entries(LEGACY_NAMED_ALIASES)) {
            const mapping = LEGACY_FIELD_MAP[csvHeader];
            if (!mapping) continue;
            // Skip if already found via rawData
            if (candidates.some(c => c.fieldId === mapping.fieldId)) continue;
            const value = (ld[namedKey] || '').trim();
            if (value) {
              let normalizedValue = value;
              if (csvHeader === 'Date of Birth') {
                const parts = value.split(/[\-\/\.]/);
                if (parts.length === 3) {
                  const [d, m, y] = parts;
                  if (y && y.length === 4) normalizedValue = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                }
              }
              candidates.push({
                fieldId: mapping.fieldId,
                label: csvHeader,
                value: normalizedValue,
                sectionName: mapping.sectionName,
                sectionOrder: mapping.sectionOrder,
                selected: true,
              });
            }
          }

          // 3. Also check employeeName as fallback for Full Name
          if (claimData.employeeName && !candidates.some(c => c.fieldId === '7debf274-baee-4bac-a137-4b4b46719874')) {
            candidates.push({
              fieldId: '7debf274-baee-4bac-a137-4b4b46719874',
              label: 'Full Name',
              value: claimData.employeeName,
              sectionName: 'Personal Details',
              sectionOrder: 0,
              selected: true,
            });
          }

          // 4. Handle "Unit or Facility" site lookup
          const siteCandidate = candidates.find(c => c.fieldId === '52ae217b-2602-4337-a1cd-a1f9bd36a4b0');
          if (siteCandidate) {
            const site = sites.find(s => s.name.toLowerCase() === siteCandidate.value.toLowerCase());
            if (site) siteCandidate.value = site.id; // store the site ID, not name
            else siteCandidate.value = ''; // can't resolve, will be excluded
          }

          // Sort by section order
          candidates.sort((a, b) => a.sectionOrder - b.sectionOrder);

          // Filter out blank values
          const validCandidates = candidates.filter(c => c.value);

          if (validCandidates.length > 0) {
            setAutofillCandidates(validCandidates);
            setShowAutofillModal(true);
          }

          setHasSelectedAuth(true); // Skip auth selection since they just verified
        }
      } catch (err) {
        console.error("Failed to parse legacy claim:", err);
      } finally {
        sessionStorage.removeItem('legacyClaim');
      }
    }
  };

  useEffect(() => {
    localStorage.setItem('portalType', 'onboarding');
    localStorage.removeItem('onboardingGoogleAuth');
    checkLegacyClaim();

    // Referral Invite check on mount
    const params = new URLSearchParams(window.location.search);
    const refId = params.get('ref');
    if (refId) {
      sessionStorage.setItem('referralInviteId', refId);
      localStorage.setItem('referralInviteId', refId);
      // Fresh referral link entry: clear previous tab session so welcome gate is active
      sessionStorage.removeItem(SS_FORM_DATA);
      sessionStorage.removeItem(SS_CURRENT_STEP);
      sessionStorage.removeItem(SS_HAS_AUTH);
      sessionStorage.removeItem(SS_LINKED_UID);
      sessionStorage.removeItem(SS_SAVED_DRAFT_ID);

      const loadInvite = async () => {
        try {
          const { getReferralInvite } = await import('../src/services/employeeService');
          const invite = await getReferralInvite(refId);
          if (!invite) {
            setInviteError("Invalid referral invitation link.");
            clearOnboardingSession();
            setIsInviteLoading(false);
            return;
          }
          if (invite.status !== 'Active') {
            setInviteError(`This referral invitation has been ${invite.status.toLowerCase()}.`);
            clearOnboardingSession();
            setIsInviteLoading(false);
            return;
          }
          if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
            setInviteError("This referral invitation has expired.");
            clearOnboardingSession();
            setIsInviteLoading(false);
            return;
          }

          setReferralInvite(invite);

          // Track click (once per session)
          const sessionClicked = sessionStorage.getItem(`ref_clicked_${refId}`);
          if (!sessionClicked) {
            const { incrementReferralClicks } = await import('../src/services/employeeService');
            await incrementReferralClicks(refId);
            sessionStorage.setItem(`ref_clicked_${refId}`, 'true');
          }

          // Prefill values
          const prefillUpdates: Record<string, any> = {};
          if (invite.siteName) {
            // Resolve site name to site ID for the dropdown (which now stores IDs)
            const matchedSite = sites.find(s => s.name === invite.siteName || s.id === invite.siteName);
            prefillUpdates[SITE_FIELD_ID] = matchedSite ? matchedSite.id : invite.siteName;
          }
          if (invite.designation) {
            prefillUpdates[DESIGNATION_FIELD_ID] = invite.designation;
          }
          if (invite.lockedPhoneNumber) {
            prefillUpdates['eb3617dc-9f1d-475d-a2db-005b6bc2500c'] = invite.lockedPhoneNumber;
          }
          if (invite.prefillFields) {
            Object.entries(invite.prefillFields).forEach(([fieldId, val]) => {
              prefillUpdates[fieldId] = val;
            });
          }

          setFormData(prev => ({
            ...prev,
            __referralInviteId: refId,
            ...prefillUpdates
          }));

        } catch (e: any) {
          console.error("Error loading referral invite:", e);
          setInviteError("Failed to validate referral invitation.");
        } finally {
          setIsInviteLoading(false);
        }
      };
      loadInvite();
    } else {
      const savedRefId = sessionStorage.getItem('referralInviteId') || localStorage.getItem('referralInviteId');
      if (savedRefId) {
        const loadInvite = async () => {
          try {
            const { getReferralInvite } = await import('../src/services/employeeService');
            const invite = await getReferralInvite(savedRefId);
            if (invite && invite.status === 'Active' && (!invite.expiresAt || new Date(invite.expiresAt).getTime() > Date.now())) {
              setReferralInvite(invite);
              
              const prefillUpdates: Record<string, any> = {};
              if (invite.lockedPhoneNumber) {
                prefillUpdates['eb3617dc-9f1d-475d-a2db-005b6bc2500c'] = invite.lockedPhoneNumber;
              }
              if (isFormEmpty(formData, invite)) {
                if (invite.siteName) {
                  const matchedSite = sites.find(s => s.name === invite.siteName || s.id === invite.siteName);
                  prefillUpdates[SITE_FIELD_ID] = matchedSite ? matchedSite.id : invite.siteName;
                }
                if (invite.designation) prefillUpdates[DESIGNATION_FIELD_ID] = invite.designation;
                if (invite.prefillFields) {
                  Object.entries(invite.prefillFields).forEach(([fieldId, val]) => {
                    prefillUpdates[fieldId] = val;
                  });
                }
              }
              if (Object.keys(prefillUpdates).length > 0 || savedRefId) {
                setFormData(prev => ({
                  ...prev,
                  __referralInviteId: savedRefId,
                  ...prefillUpdates
                }));
              }
            } else {
              // Stale saved invite - either doesn't exist, status !== 'Active', or has expired
              if (!invite) {
                setInviteError("Invalid referral invitation link.");
              } else if (invite.status !== 'Active') {
                setInviteError(`This referral invitation has been ${invite.status.toLowerCase()}.`);
              } else {
                setInviteError("This referral invitation has expired.");
              }
              clearOnboardingSession();
            }
          } catch (e) {
            console.error("Error loading saved referral invite:", e);
          } finally {
            setIsInviteLoading(false);
          }
        };
        loadInvite();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track Form Start
  useEffect(() => {
    if (hasSelectedAuth && referralInvite) {
      const refId = referralInvite.id;
      const sessionStarted = sessionStorage.getItem(`ref_started_${refId}`);
      if (!sessionStarted) {
        const trackStart = async () => {
          try {
            const { incrementReferralStarts } = await import('../src/services/employeeService');
            await incrementReferralStarts(refId);
            sessionStorage.setItem(`ref_started_${refId}`, 'true');
          } catch (e) {
            console.error("Failed to track form start:", e);
          }
        };
        trackStart();
      }
    }
  }, [hasSelectedAuth, referralInvite]);

  // Filter out disabled sections and fields AND apply role-based visibility
  const activeSections = useMemo(() => {
    const userRole = authUser && authUser.roleId ? roles.find(r => r.id === authUser.roleId) : null;
    const fieldVisibility = userRole?.fieldVisibility || {};

    return (sections || [])
      .filter(s => s && !s.isDisabled)
      .map(s => ({
        ...s,
        fields: (s.fields || [])
          .filter(f => f && !f.isDisabled)
          .map(f => {
            if (isSuperAdmin) return f;
            const visibility = fieldVisibility[f.id];
            if (visibility === 'HIDDEN') return null;
            if (visibility === 'READ_ONLY') {
              return { ...f, isDisabled: true };
            }
            return f;
          })
          .filter((f): f is FormField => f !== null)
          .sort((a, b) => (a.order || 0) - (b.order || 0))
      }))
      .filter(s => s.fields && s.fields.length > 0)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [sections, authUser, isSuperAdmin, roles]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentStep]);

  // Aadhaar Autofill Logic
  // fileInputRef and isParsingAadhaar are defined at the top component level

  // Field ID → Label mapping for results display
  const fieldLabelMap: Record<string, string> = {
    '7debf274-baee-4bac-a137-4b4b46719874': 'Full Name',
    '3f09e364-7875-40a2-9490-41251be20366': "Father's Name",
    '6e570a01-14e0-4e18-b112-97ddc51d0778': 'Date of Birth',
    '5df6fa40-c39f-41a7-9ee7-789a47435ef0': 'Gender',
    '18855ee9-0d66-41d6-988b-128b776a8c5b': 'Aadhaar Number',
    '29bae22a-59db-4b1b-bafd-64e8018a0f4e': 'Permanent Address',
    'eb3617dc-9f1d-475d-a2db-005b6bc2500c': 'Phone Number',
    'c53d7ba7-58a0-4cf0-8691-8eb7bef7b951': 'Marital Status',
    '7db47bc3-e4cc-4984-9687-2d94cad3e632': 'Spouse Name',
    '2fdacb1b-254f-4fc3-923a-53233214124f': 'Citizenship',
  };

  const handleAadhaarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsParsingAadhaar(true);
    setShowResults(false);
    setExtractionWarning(null);

    // 1. Try to Unlock PDF (or use Original)
    try {
      await removePdfPassword(file);
      // Not encrypted — proceed directly
      await processAadhaarFile(file, file);
    } catch (err: any) {
      if (err.message === 'PASSWORD_REQUIRED') {
        // Show password modal
        setPendingFile(file);
        setPasswordInput('');
        setShowPasswordModal(true);
        setIsParsingAadhaar(false);
        // Focus on password input after render
        setTimeout(() => passwordInputRef.current?.focus(), 100);
      } else {
        console.warn("Error checking PDF:", err);
        setIsParsingAadhaar(false);
      }
    }
  };

  const handlePasswordSubmit = async () => {
    if (!pendingFile || !passwordInput.trim()) return;

    const password = passwordInput.trim();
    setShowPasswordModal(false);
    setIsParsingAadhaar(true);

    let unlockedFile = pendingFile;
    let currentPassword = password;

    try {
      setPdfPassword(password);
      unlockedFile = await removePdfPassword(pendingFile, password);
      currentPassword = password;

      // Give them an option to download the unlocked PDF or not
      try {
        const shouldDownload = window.confirm("Your Aadhaar PDF was successfully unlocked for parsing!\n\nWould you like to download the unlocked (unencrypted) copy to your device?");
        if (shouldDownload) {
          const downloadUrl = URL.createObjectURL(unlockedFile);
          const downloadLink = document.createElement('a');
          downloadLink.href = downloadUrl;
          downloadLink.download = `unlocked_${pendingFile.name}`;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
          // Revoke after a short delay to ensure download starts
          setTimeout(() => URL.revokeObjectURL(downloadUrl), 3000);
        }
      } catch (dlErr) {
        console.warn('Download of unlocked PDF failed:', dlErr);
      }
    } catch (retryErr: any) {
      if (retryErr.message === 'INVALID_PASSWORD_OR_FORMAT') {
        setShowPasswordModal(true);
        setExtractionWarning('❌ Incorrect password. Please try again.');
        setIsParsingAadhaar(false);
        setTimeout(() => passwordInputRef.current?.focus(), 100);
        return;
      }
      // Other error — fallback to original
      unlockedFile = pendingFile;
      currentPassword = password;
    }

    await processAadhaarFile(pendingFile, unlockedFile, currentPassword);
  };

  const processAadhaarFile = async (originalFile: File, unlockedFile: File, password?: string) => {
    try {
      const text = await extractTextFromPDF(originalFile, password || undefined);
      const details = parseAadhaarText(text);

      const updates: Record<string, any> = {};
      const results: { label: string; value: string }[] = [];

      const allFormFields = (sections || []).flatMap(s => s.fields || []);
      const resolveFieldId = (defaultId: string, ...labelMatches: string[]) => {
        const found = allFormFields.find(f => 
          f.id === defaultId || 
          labelMatches.some(lbl => f.label.trim().toLowerCase() === lbl.toLowerCase())
        );
        return found ? found.id : defaultId;
      };

      const fullNameId = resolveFieldId('7debf274-baee-4bac-a137-4b4b46719874', 'Full Name', 'Name');
      const fatherNameId = resolveFieldId('3f09e364-7875-40a2-9490-41251be20366', "Father's Name", 'Father Name');
      const dobId = resolveFieldId('6e570a01-14e0-4e18-b112-97ddc51d0778', 'Date of Birth', 'DOB');
      const genderId = resolveFieldId('5df6fa40-c39f-41a7-9ee7-789a47435ef0', 'Gender');
      const aadhaarId = resolveFieldId('18855ee9-0d66-41d6-988b-128b776a8c5b', 'Aadhaar Number', 'Aadhar Card No', 'Aadhaar Card No', 'Aadhaar');
      const permanentAddressId = resolveFieldId('29bae22a-59db-4b1b-bafd-64e8018a0f4e', 'Permanent Address');
      const phoneId = resolveFieldId('eb3617dc-9f1d-475d-a2db-005b6bc2500c', 'Phone Number', 'Mobile Number', 'Mobile');
      const maritalStatusId = resolveFieldId('c53d7ba7-58a0-4cf0-8691-8eb7bef7b951', 'Marital Status');
      const spouseNameId = resolveFieldId('7db47bc3-e4cc-4984-9687-2d94cad3e632', 'Spouse Name');
      const citizenshipId = resolveFieldId('2fdacb1b-254f-4fc3-923a-53233214124f', 'Citizenship');
      const aadharFrontId = resolveFieldId('eecc5044-399c-45f8-aa03-e609748f0e49', 'Aadhar Card (Front)', 'Aadhaar Card (Front)', 'Aadhar Card  (Front)', 'Aadhaar Front');
      const aadharBackId = resolveFieldId('c95cb7c0-9aab-48f8-b4e3-1bafc7678147', 'Aadhar Card (Back)', 'Aadhaar Card (Back)', 'Aadhar Card  (Back)', 'Aadhaar Back');

      if (details.fullName) {
        updates[fullNameId] = details.fullName;
        results.push({ label: 'Full Name', value: details.fullName });
      }
      if (details.fatherName) {
        updates[fatherNameId] = details.fatherName;
        results.push({ label: "Father's Name", value: details.fatherName });
      }
      if (details.dob) {
        const parts = details.dob.split('/');
        if (parts.length === 3) {
          updates[dobId] = `${parts[2]}-${parts[1]}-${parts[0]}`;
          results.push({ label: 'Date of Birth', value: details.dob });
        }
      }
      if (details.gender) {
        updates[genderId] = details.gender;
        results.push({ label: 'Gender', value: details.gender });
      }
      if (details.aadhaarNo) {
        updates[aadhaarId] = details.aadhaarNo;
        results.push({ label: 'Aadhaar Number', value: details.aadhaarNo });
      }
      if (details.address) {
        updates[permanentAddressId] = details.address;
        results.push({ label: 'Permanent Address', value: details.address });
      }
      if (details.mobile) {
        updates[phoneId] = details.mobile;
        results.push({ label: 'Phone Number', value: details.mobile });
      }
      if (details.maritalStatus) {
        updates[maritalStatusId] = details.maritalStatus;
        results.push({ label: 'Marital Status', value: details.maritalStatus });
        if (details.maritalStatus === 'Married' && details.spouseName) {
          updates[spouseNameId] = details.spouseName;
          results.push({ label: 'Spouse Name', value: details.spouseName });
        }
      }

      updates[citizenshipId] = 'Indian';
      results.push({ label: 'Citizenship', value: 'Indian' });

      // Ensure authenticated and guest/auth session active
      setHasSelectedAuth(true);
      await ensureAuthenticated();

      // UPLOAD BOTH AADHAAR FILES TO SECURE STORAGE:
      let unlockedStoragePath: string | null = null;
      let originalStoragePath: string | null = null;

      try {
        // Pre-save draft in Firestore so Storage rules recognize folder ownership and create the cloud folder
        let activeDraftId = savedDraftId;
        try {
          activeDraftId = await onSaveDraft({ ...formData, ...updates }, currentStep, savedDraftId || undefined);
          setSavedDraftId(activeDraftId);
          sessionStorage.setItem(SS_SAVED_DRAFT_ID, JSON.stringify(activeDraftId));
        } catch (saveErr) {
          console.warn('[Aadhaar] Pre-save draft before upload warning:', saveErr);
        }

        // 1. Upload the unlocked Aadhaar PDF (for document verification & draft persistence)
        // Skip compression to preserve 100% vector sharpness, clear text, and high quality
        unlockedStoragePath = await uploadSubmissionDocument(
          aadharFrontId,
          unlockedFile,
          undefined,
          activeDraftId || undefined,
          { skipCompression: true }
        );
        updates[aadharFrontId] = unlockedStoragePath;
        updates[aadharBackId] = unlockedStoragePath;
        updates['unlockedAadhaarStoragePath'] = unlockedStoragePath;

        // 2. Upload the original Aadhaar file used for extraction (skip compression to preserve exact original archive)
        originalStoragePath = await uploadSubmissionDocument(
          'original_aadhaar',
          originalFile,
          undefined,
          activeDraftId || undefined,
          { skipCompression: true, password: password || undefined }
        );
        updates['originalAadhaarStoragePath'] = originalStoragePath;
        updates['originalAadhaarFileName'] = originalFile.name;



        // Cache files in IndexedDB for rapid local/offline access
        try {
          await saveFileToSession(aadharFrontId, unlockedFile);
          await saveFileToSession(aadharBackId, unlockedFile);
          await saveFileToSession('original_aadhaar', originalFile);
        } catch (idbErr) {
          // Non-blocking
        }

        results.push({ label: 'Aadhaar Documents', value: 'Uploaded & synced to cloud draft' });
      } catch (uploadErr: any) {
        console.warn('[Aadhaar] Cloud storage upload failed during extraction, using local fallback:', uploadErr);
        // Fallback to local files if offline/storage error
        updates[aadharFrontId] = unlockedFile;
        updates[aadharBackId] = unlockedFile;
        try {
          await saveFileToSession(aadharFrontId, unlockedFile);
          await saveFileToSession(aadharBackId, unlockedFile);
        } catch (idbErr) {}
      }

      const missingFields: string[] = [];
      if (!details.fullName) missingFields.push('Full Name');
      if (!details.aadhaarNo) missingFields.push('Aadhaar Number');

      // Warning only for errors, not for success/info messages
      let warning: string | null = null;

      // Apply updates directly to the form without popup
      const updatedFormData = { ...formData, ...updates };
      setFormData(updatedFormData);
      setExtractionResults(results);
      setExtractionMissing(missingFields);
      setExtractionWarning(warning);
      setShowResults(false);
      toast.success('Aadhaar details auto-filled successfully!', { duration: 4000 });
      if (missingFields.length > 0) {
        toast(`Could not extract: ${missingFields.join(', ')} — please fill manually.`, { icon: 'ℹ️', duration: 5000 });
      }

      // Immediately persist cloud draft so draft is ready for retrieval across devices
      try {
        const draftId = await onSaveDraft(updatedFormData, currentStep, savedDraftId || undefined);
        if (draftId) {
          setSavedDraftId(draftId);
          lastSavedDataRef.current = JSON.stringify({ data: updatedFormData, step: currentStep });
        }
      } catch (saveErr: any) {
        if (saveErr?.message?.includes('APPLICATION_ALREADY_SUBMITTED')) {
          const subId = saveErr.message.split(':')[1] || savedDraftId || '';
          await clearOnboardingSession();
          setFormData({});
          setIsSubmitted(true);
          setSubmissionId(subId);
          return;
        }
        console.warn('[Aadhaar] Auto draft save after extraction failed (will retry):', saveErr);
      }

    } catch (err: any) {
      console.error('Aadhaar parsing failed:', err);
      setExtractionResults([]);
      setExtractionWarning('❌ Failed to extract details: ' + err.message);
      setExtractionMissing([]);
      setShowResults(false);
      toast.error('Failed to extract Aadhaar details: ' + (err.message || 'Unknown error'), { duration: 5000 });
    } finally {
      setIsParsingAadhaar(false);
      setPdfPassword('');
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const isFieldVisible = useCallback((field: FormField) => {
    if (!field.visibilityCondition || !field.visibilityCondition.fieldId) return true;

    const { fieldId, operator, value } = field.visibilityCondition;
    const targetValue = formData[fieldId];

    if (operator === 'equals') return String(targetValue || '').toLowerCase() === String(value || '').toLowerCase();
    if (operator === 'not_equals') return String(targetValue || '').toLowerCase() !== String(value || '').toLowerCase();
    if (operator === 'contains') return String(targetValue || '').toLowerCase().includes(String(value || '').toLowerCase());

    return true;
  }, [formData]);

  const validateSingleField = useCallback((field: FormField, value: any) => {
    if (!isFieldVisible(field)) return null;

    let isEmpty = false;
    if (field.type === FieldType.CHECKBOX) {
      isEmpty = !value || (Array.isArray(value) && value.length === 0);
    } else if (field.type === FieldType.FILE_UPLOAD) {
      isEmpty = !value;
    } else {
      isEmpty = value === undefined || value === null || String(value).trim() === '';
    }

    if (field.isMandatory && isEmpty) {
      return `${field.label} is required.`;
    }

    if (isEmpty) return null;

    const strValue = String(value).trim();

    if (field.type === FieldType.TEXT || field.type === FieldType.TEXTAREA) {
      if (field.minLength && strValue.length < field.minLength) {
        return `Must be at least ${field.minLength} characters.`;
      }
      if (field.maxLength && strValue.length > field.maxLength) {
        return `Must be less than ${field.maxLength} characters.`;
      }
    }


    if (field.allowedPattern && field.allowedPattern !== 'any') {
      let patternString: string = field.allowedPattern;
      const fLabel = (field.label || '').toLowerCase();

      const isPhone = fLabel.includes('phone') || fLabel.includes('mobile') || fLabel.includes('whatsapp') || fLabel.includes('contact no');
      const isAadhar = fLabel.includes('aadhar') || fLabel.includes('aadhaar');

      if (patternString === 'alphabets') patternString = '^[A-Za-z\\s]+$';
      else if (patternString === 'numbers') {
        if (isPhone) patternString = '^[0-9]{10}$';
        else if (isAadhar) patternString = '^[0-9]{12}$';
        else patternString = '^[0-9\\.]+$';
      }
      else if (patternString === 'numbers_only') {
        if (isPhone) patternString = '^[0-9]{10}$';
        else if (isAadhar) patternString = '^[0-9]{12}$';
        else patternString = '^[0-9]+$';
      }
      else if (patternString === 'alphanumeric') patternString = '^[A-Za-z0-9\\s]+$';
      else if (patternString === 'alphanumeric_special') patternString = '^[A-Za-z0-9\\s.,\\-\\/()#&@!:;\'\"]+$';

      try {
        const regex = new RegExp(patternString);
        const isValid = regex.test(strValue);

        if (!isValid) {
          if (patternString === '^[0-9]{10}$') return "Invalid phone number (must be exactly 10 digits).";
          if (patternString === '^[0-9]{12}$') return "Invalid Aadhaar number (must be exactly 12 digits).";
          if (patternString === '^[A-Za-z\\s]+$') return "Only alphabets (A-Z) are allowed.";
          if (patternString === '^[0-9]+$') return "Only numbers are allowed.";
          if (patternString === '^[0-9\\.]+$') return "Only numbers and decimals are allowed.";
          return "Invalid format.";
        }
      } catch (e) {
        console.error("Invalid regex pattern:", patternString);
      }
    }

    if (field.type === FieldType.DATE && field.minAge && value) {
      const birthDate = new Date(value);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      if (age < field.minAge) {
        return `Minimum age required is ${field.minAge} years.`;
      }
    }

    if (field.type === FieldType.FILE_UPLOAD && field.maxFileSizeMB && value instanceof File) {
      const fileSizeMB = value.size / (1024 * 1024);
      if (fileSizeMB > field.maxFileSizeMB) {
        return `File size must be less than ${field.maxFileSizeMB}MB.`;
      }
    }

    return null;
  }, [isFieldVisible]);

  const handleInputChange = useCallback((fieldId: string, value: any) => {
    setFormData(prev => {
      const newData = { ...prev, [fieldId]: value };
      // If Site changed, clear Sub-Unit and Designation (since they are site-dependent)
      const allFields = activeSections.flatMap(s => s.fields || []);
      const changedField = allFields.find(f => f.id === fieldId);
      if (fieldId === SITE_FIELD_ID || (changedField && isSiteField(changedField))) {
        delete newData[SUBUNIT_FIELD_ID];
        delete newData[DESIGNATION_FIELD_ID];
        allFields.forEach(f => {
          if (isDesignationField(f) || isSubunitField(f)) {
            delete newData[f.id];
          }
        });
      }
      return newData;
    });

    // Persist file uploads to IndexedDB for reload recovery
    if (value instanceof File) {
      saveFileToSession(fieldId, value);
    } else if (value === null || value === undefined || value === '') {
      // File was cleared — remove from IndexedDB too
      removeFileFromSession(fieldId);
      // If a previously synced cloud document is removed, sync deletion to Firestore draft immediately
      if (formDataRef.current[fieldId] && typeof formDataRef.current[fieldId] === 'string' && formDataRef.current[fieldId].startsWith('onboarding/')) {
        const updated = { ...formDataRef.current };
        delete updated[fieldId];
        onSaveDraft(updated, currentStepRef.current, savedDraftIdRef.current || undefined).then((draftId) => {
          if (draftId) {
            setSavedDraftId(draftId);
            lastSavedDataRef.current = JSON.stringify({ data: updated, step: currentStepRef.current });
          }
        }).catch((err) => {
          console.warn('[AutoSave] Document deletion sync warning:', err);
        });
      }
    } else if (typeof value === 'string' && value.startsWith('onboarding/')) {
      // Document upload completed: Immediately persist to Firestore cloud draft without waiting for 'Next' button
      const updated = { ...formDataRef.current, [fieldId]: value };
      onSaveDraft(updated, currentStepRef.current, savedDraftIdRef.current || undefined).then((draftId) => {
        if (draftId) {
          setSavedDraftId(draftId);
          lastSavedDataRef.current = JSON.stringify({ data: updated, step: currentStepRef.current });
          sessionStorage.setItem(SS_SAVED_DRAFT_ID, JSON.stringify(draftId));
          localStorage.setItem(SS_SAVED_DRAFT_ID, JSON.stringify(draftId));
          toast.success('Document saved to cloud draft!', { duration: 2500, id: `draft-save-${fieldId}` });
        }
      }).catch((err) => {
        console.warn('[AutoSave] Document draft sync warning:', err);
      });
    }

    // Instant Validation
    const allFields = activeSections.flatMap(s => s.fields);
    const field = allFields.find(f => f.id === fieldId);
    if (field) {
      const error = validateSingleField(field, value);
      setFormErrors(prev => {
        const newErrors = { ...prev };
        if (error) {
          newErrors[fieldId] = error;
        } else {
          delete newErrors[fieldId];
        }
        return newErrors;
      });
    }
  }, [activeSections, validateSingleField, SITE_FIELD_ID, SUBUNIT_FIELD_ID, isSiteField, isDesignationField, isSubunitField, onSaveDraft]);

  const validateStepFields = useCallback((stepIndex: number): boolean => {
    const errors: Record<string, string> = {};
    const currentSection = activeSections[stepIndex];

    if (!currentSection) return true;

    currentSection.fields.forEach(field => {
      const error = validateSingleField(field, formData[field.id]);
      if (error) {
        errors[field.id] = error;
      }
    });

    setFormErrors(prev => ({ ...prev, ...errors }));
    return Object.keys(errors).length === 0;
  }, [activeSections, validateSingleField, formData]);

  const handleNextStep = () => {
    if (validateStepFields(currentStep)) {
      if (currentStep < activeSections.length) {
        const nextStep = currentStep + 1;
        setCurrentStep(nextStep);
        syncDraftMilestone(nextStep);
      }
    } else {
      const firstErrorId = Object.keys(formErrors)[0];
      if (firstErrorId) {
        document.getElementById(firstErrorId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };



  // ... existing code ...

  const handleFinalSubmit = async () => {
    // Validate ALL sections before submitting to ensure no fields were missed
    let allValid = true;
    for (let i = 0; i < activeSections.length; i++) {
      if (!validateStepFields(i)) {
        allValid = false;
        setCurrentStep(i); // Go to the first section with errors
        break;
      }
    }
    if (!allValid) return;

    // Validate password for guest users
    if (!linkedUid) {
      if (!password || password.length < 6) {
        setSubmissionError('Please choose a password with at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setSubmissionError('Passwords do not match.');
        return;
      }
    }

    setIsSubmitting(true);
    setSubmissionError(null);

    // Build progress steps from form data
    const steps: { label: string; fieldId: string; status: 'pending' | 'loading' | 'done' | 'error' }[] = [];

    // Step 1: Validating
    steps.push({ label: 'Validating form data', fieldId: 'validation', status: 'pending' });

    // Identify file uploads and map fieldId -> step index
    const allFields = activeSections.flatMap(s => s.fields);
    const fileFields = allFields.filter(f => f.type === FieldType.FILE_UPLOAD);
    fileFields.forEach(f => {
      const file = formData[f.id];
      if (file) {
        const fileName = file instanceof File ? file.name : 'file';
        steps.push({ label: `Uploading ${f.label || f.name || fileName}`, fieldId: f.id, status: 'pending' });
      } else {
        steps.push({ label: `Uploading ${f.label || f.name || 'Document'} (N/A)`, fieldId: f.id, status: 'done' });
      }
    });

    // Final step
    steps.push({ label: 'Finalizing submission', fieldId: 'finalizing', status: 'pending' });

    setSubmissionSteps(steps.map(s => ({ label: s.label, status: s.status })));
    setShowSubmissionProgress(true);

    // Build a map from fieldId to step index for quick lookup
    const fieldIdToIndex: Record<string, number> = {};
    steps.forEach((s, i) => { fieldIdToIndex[s.fieldId] = i; });

    // Real-time progress callback that updates the UI
    const onProgress = (fieldId: string, status: 'loading' | 'done' | 'error', percent?: number) => {
      const idx = fieldIdToIndex[fieldId];
      if (idx !== undefined) {
        setSubmissionSteps(prev => {
          const updated = [...prev];
          if (updated[idx]) updated[idx] = { ...updated[idx], status, percent: percent ?? updated[idx].percent };
          return updated;
        });
      }
    };

    // Hash the password if manual registration
    let hashedPasswordToPass: string | undefined = undefined;
    if (!linkedUid && password) {
      try {
        const { hashPassword } = await import('../src/utils/cryptoUtils');
        hashedPasswordToPass = await hashPassword(password);
      } catch (err) {
        console.error("Failed to hash password on client", err);
      }
    }

    // Actually submit - the service will fire onProgress as uploads happen
    const refToPass = formData.__referralInviteId || referralInvite?.id || sessionStorage.getItem('referralInviteId') || localStorage.getItem('referralInviteId');
    const selectedSiteVal = formData[SITE_FIELD_ID];
    const matchedSite = (sites || []).find(s => s.id === selectedSiteVal || s.name?.trim().toLowerCase() === String(selectedSiteVal).trim().toLowerCase());
    const draftIdToPass = savedDraftId || initialDraft?.id;
    const submissionData = {
      ...formData,
      ...(matchedSite ? { siteName: matchedSite.name, siteId: matchedSite.id } : {}),
      ...(refToPass ? { __referralInviteId: refToPass } : {}),
      ...(draftIdToPass ? { draftId: draftIdToPass } : {})
    };
    const result = await onFormSubmit(submissionData, sections, linkedUid || undefined, onProgress, legacyClaim?.employeeId, hashedPasswordToPass);

    if (result.success) {
      // Brief pause so user can see the final "done" state
      await new Promise(r => setTimeout(r, 400));
      setShowSubmissionProgress(false);
      setIsSubmitted(true);
      setSubmissionId(result.id || null);

      // Clear local onboarding form session cache upon successful submission
      clearOnboardingSession();
    } else {
      // Mark the last step as error
      setSubmissionSteps(prev => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (updated[lastIdx]) updated[lastIdx] = { ...updated[lastIdx], status: 'error' };
        return updated;
      });
      await new Promise(r => setTimeout(r, 800));
      setShowSubmissionProgress(false);
      setSubmissionError(result.error || "Failed to submit form. Please try again.");
    }
    setIsSubmitting(false);
  };

  const handleSaveProgress = async () => {
    if (isFormEmpty(formData)) {
      alert("Please fill out at least one field before saving a draft.");
      return;
    }
    setIsSavingDraft(true);
    try {
      const draftId = await onSaveDraft(formData, currentStep, savedDraftId || undefined);
      setSavedDraftId(draftId);
      sessionStorage.setItem(SS_SAVED_DRAFT_ID, JSON.stringify(draftId));
      // Only show the recovery code modal for GUEST users.
      // Google users don't need a code — their draft is tied to their Google UID.
      if (!linkedUid) {
        setShowSaveModal(true);
      } else {
        // For Google users, show a brief inline confirmation (no modal)
        setShowSaveModal(true); // reuse modal but it will show different content for Google users
      }
    } catch (err: any) {
      if (err?.message?.includes('APPLICATION_ALREADY_SUBMITTED')) {
        const subId = err.message.split(':')[1] || savedDraftId || '';
        await clearOnboardingSession();
        setFormData({});
        setIsSubmitted(true);
        setSubmissionId(subId);
        return;
      }
      // Error handled by parent handler (alert)
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleRetrieveDraft = async () => {
    const code = retrieveCode.trim();
    if (!code) return;

    // Check if we have local unsaved edits
    const localHasData = Object.values(formData).some(val => val !== undefined && val !== null && val !== '');
    if (localHasData) {
      const confirmOverwrite = window.confirm("Retrieving another draft will overwrite your current unsaved progress. Do you want to proceed?");
      if (!confirmOverwrite) return;
    }

    setIsRetrieving(true);
    setRetrieveError(null);

    try {
      const success = await onRetrieveDraft(code);
      if (success) {
        setShowRetrieveModal(false);
        setRetrieveCode('');
      } else {
        setRetrieveError('No draft found with this code. Please check and try again.');
      }
    } catch (err: any) {
      setRetrieveError(err.message || 'Failed to retrieve draft. Please try again.');
    } finally {
      setIsRetrieving(false);
    }
  };

  const renderRetrieveDraftModal = () => {
    if (!showRetrieveModal) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-14 h-14 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Download size={28} />
          </div>
          <h3 className="text-lg font-bold text-gray-900 text-center mb-1">Retrieve Saved Draft</h3>
          <p className="text-sm text-gray-500 text-center mb-5">
            Enter the recovery code you received when saving your progress.
          </p>

          {retrieveError && (
            <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600 font-medium">{retrieveError}</p>
            </div>
          )}

          <div className="mb-5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Recovery Code</label>
            <input
              ref={retrieveInputRef}
              type="text"
              value={retrieveCode}
              onChange={(e) => setRetrieveCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleRetrieveDraft()}
              placeholder="e.g. UDF-202609-XXXX"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-lg font-mono tracking-widest text-center focus:outline-none focus:border-green-500 focus:ring-3 focus:ring-green-100 transition-all font-mono uppercase"
              autoComplete="off"
            />
          </div>

          <div className="flex gap-3">
            <Button
              variant="primary"
              size="sm"
              onClick={handleRetrieveDraft}
              disabled={!retrieveCode.trim() || isRetrieving}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl font-semibold"
            >
              {isRetrieving ? (
                <><Loader2 size={16} className="animate-spin mr-2" /> Loading...</>
              ) : (
                '📥 Load Draft'
              )}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowRetrieveModal(false)}
              className="px-6 text-gray-500 hover:text-gray-700 border-gray-200 rounded-xl"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const getFieldOptions = useCallback((field: FormField) => {
    const isDesig = isDesignationField(field);

    if (isDesig) {
      // Find selected site from formData (check SITE_FIELD_ID or any field matching isSiteField)
      let selectedSiteVal = formData[SITE_FIELD_ID];
      if (!selectedSiteVal) {
        const allFields = (sections || []).flatMap(s => s.fields || []);
        const sField = allFields.find(f => isSiteField(f));
        if (sField) selectedSiteVal = formData[sField.id];
      }

      // If NO site is selected yet, return empty options so applicant cannot pick before selecting unit
      if (!selectedSiteVal) {
        return [];
      }

      // Match the active site object by ID or Name
      const activeSite = sites.find(s => s.id === selectedSiteVal || s.name.trim().toLowerCase() === String(selectedSiteVal).trim().toLowerCase());

      // Master designations fallback from portal config or field options
      const masterDesignations = (portalConfig?.designations && portalConfig.designations.length > 0)
        ? portalConfig.designations
        : (field.options && field.options.length > 0 ? field.options : []);

      // 1. Check Form Builder Dependent Options (optionsMap)
      // Form Builder maps by site name (e.g. "ACCENTURE HDC 1") or site id (e.g. "site-5")
      if (field.optionsMap && Object.keys(field.optionsMap).length > 0) {
        let mapped: string[] | undefined;
        if (activeSite) {
          mapped = field.optionsMap[activeSite.name] || field.optionsMap[activeSite.id];
          if (!mapped) {
            const siteKey = Object.keys(field.optionsMap).find(k => k.trim().toLowerCase() === activeSite.name.trim().toLowerCase());
            if (siteKey) mapped = field.optionsMap[siteKey];
          }
        }
        if (!mapped && selectedSiteVal) {
          mapped = field.optionsMap[selectedSiteVal];
        }
        if (mapped && mapped.length > 0) {
          return mapped;
        }
      }

      // 2. Check Site Management Allowed Designations (activeSite.allowedDesignations)
      if (activeSite && activeSite.allowedDesignations && activeSite.allowedDesignations.length > 0) {
        return masterDesignations.filter(opt => activeSite.allowedDesignations?.includes(opt));
      }

      // Fallback: If site has no specific restrictions defined, return master designations
      return masterDesignations;
    }

    if (!field.options) return [];

    // General Form Builder "Dependent Options" (parentFieldId + optionsMap) for any other field
    if (field.parentFieldId) {
      const parentValue = formData[field.parentFieldId];
      if (!parentValue) return [];

      if (field.optionsMap) {
        const matchedSite = sites.find(s => s.id === parentValue || s.name === parentValue);
        const mappedOptions = field.optionsMap[parentValue] ||
          (matchedSite ? (field.optionsMap[matchedSite.name] || field.optionsMap[matchedSite.id]) : undefined);
        if (mappedOptions && mappedOptions.length > 0) return mappedOptions;
      }
    }

    // Default: Return all configured options if no specific filter applied
    return field.options;
  }, [formData, sites, SITE_FIELD_ID, portalConfig, sections, isDesignationField, isSiteField]);


  const renderField = (field: FormField) => {
    let fieldToRender = { ...field };

    // Referral invite locks
    if (referralInvite) {
      if (referralInvite.phoneNumberLock && field.id === 'eb3617dc-9f1d-475d-a2db-005b6bc2500c') {
        fieldToRender.isDisabled = true;
      }

      const lockPrefilled = referralInvite.lockPrefilledFields !== undefined
        ? referralInvite.lockPrefilledFields
        : portalConfig?.inviteConfig?.lockPrefilledFields;
      if (lockPrefilled) {
        const prefilledIds = new Set<string>();
        if (referralInvite.siteName) prefilledIds.add(SITE_FIELD_ID);
        if (referralInvite.designation) prefilledIds.add(DESIGNATION_FIELD_ID);
        if (referralInvite.prefillFields) {
          Object.keys(referralInvite.prefillFields).forEach(id => prefilledIds.add(id));
        }
        if (prefilledIds.has(field.id)) {
          fieldToRender.isDisabled = true;
        }
      }
    }

    // Dynamic Options Injection for Site, Sub-Unit, and Designation
    // Build a siteId→siteName label map for display purposes
    const activeSites = sites.filter(s => s.status === 'Active');
    const siteOptionLabels: Record<string, string> = {};
    activeSites.forEach(s => { siteOptionLabels[s.id] = s.name; });

    const isSite = isSiteField(field);
    const isSubunit = isSubunitField(field);
    const isDesig = isDesignationField(field);

    if (isSite) {
      // Store site IDs as option values; display site names via optionLabels
      fieldToRender.options = activeSites.map(s => s.id);
    } else if (isSubunit) {
      const selectedSiteId = formData[SITE_FIELD_ID] || (activeSections.flatMap(s => s.fields).find(f => isSiteField(f))?.id ? formData[activeSections.flatMap(s => s.fields).find(f => isSiteField(f))!.id] : undefined);
      const selectedSite = sites.find(s => s.id === selectedSiteId || s.name === selectedSiteId);
      if (selectedSite && selectedSite.subUnits && selectedSite.subUnits.length > 0) {
        fieldToRender.options = selectedSite.subUnits.map(u => u.name);
        fieldToRender.isDisabled = false;
      } else {
        fieldToRender.options = [];
        fieldToRender.isDisabled = true; // Disable if no site selected or no sub-units
      }
    } else if (isDesig) {
      const selectedSiteId = formData[SITE_FIELD_ID] || (activeSections.flatMap(s => s.fields).find(f => isSiteField(f))?.id ? formData[activeSections.flatMap(s => s.fields).find(f => isSiteField(f))!.id] : undefined);
      if (!selectedSiteId) {
        fieldToRender.options = [];
        fieldToRender.isDisabled = true; // Disable until Unit or Facility is chosen
      } else {
        fieldToRender.options = getFieldOptions(fieldToRender);
      }
    } else {
      // Fallback for standard dependent fields
      if (field.type === FieldType.DROPDOWN) {
        fieldToRender.options = getFieldOptions(fieldToRender);
        if (field.parentFieldId && (!formData[field.parentFieldId] || fieldToRender.options.length === 0)) {
          fieldToRender.isDisabled = true;
        }
      }
    }

    const fieldProps = {
      field: fieldToRender,
      value: formData[field.id],
      onChange: handleInputChange,
      error: formErrors[field.id],
      disabled: fieldToRender.isDisabled || isSubmitting,
      // Pass optionLabels only for the site field dropdown
      ...(isSite ? { optionLabels: siteOptionLabels } : {}),
    };

    switch (field.type) {
      case FieldType.TEXT: return <EmployeeTextField {...fieldProps} />;
      case FieldType.TEXTAREA: return <EmployeeTextareaField {...fieldProps} />;
      case FieldType.DROPDOWN: return <EmployeeDropdownField {...fieldProps} />;
      case FieldType.DATE: return <EmployeeDateField {...fieldProps} />;
      case FieldType.CHECKBOX: return <EmployeeCheckboxField {...fieldProps} />;
      case FieldType.RADIO: return <EmployeeRadioField {...fieldProps} />;
      case FieldType.FILE_UPLOAD: return <EmployeeFileUploadField {...fieldProps} />;
      default: return null;
    }
  };

  // Wrap onBackToHome to also clear session storage and sign out on exit
  const handleBackToHome = async () => {
    clearOnboardingSession();
    try {
      await signOut(auth);
    } catch (e) { /* ignore */ }
    onBackToHome();
  };

  // Safeguard: If URL has a 'ref' query parameter, force the spinner until invite is loaded or error is set.
  // This prevents any split-second flashing of the welcome page or form sections.
  const urlParams = new URLSearchParams(window.location.search);
  const urlRefId = urlParams.get('ref');
  const savedRefId = sessionStorage.getItem('referralInviteId') || localStorage.getItem('referralInviteId');
  const needsInviteValidation = !!(urlRefId || savedRefId);

  if (isInviteLoading || (needsInviteValidation && !referralInvite && !inviteError)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="animate-spin text-blue-600 mx-auto mb-4" size={48} />
          <p className="text-gray-500 font-medium">Validating invitation details...</p>
        </div>
      </div>
    );
  }

  if (inviteError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center animate-in zoom-in duration-300">
          <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle size={48} className="text-red-500" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Invitation Invalid</h2>
          <p className="text-gray-600 mb-6">{inviteError}</p>
          <Button onClick={handleBackToHome} variant="primary" size="lg" className="w-full">Return to Home</Button>
        </div>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center animate-in zoom-in duration-300">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={48} />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Application Received!</h2>
          <p className="text-gray-600 mb-6">Thank you for applying. We have successfully received your joining form.</p>
          {submissionId && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-500 uppercase font-semibold mb-1">Application Ref:</p>
              <p className="text-lg font-mono font-bold text-blue-600">{submissionId}</p>
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={handleBackToHome} variant="secondary" size="lg" className="flex-1">Return to Home</Button>
            <Button
              onClick={async () => {
                await clearOnboardingSession();
                try {
                  await signOut(auth);
                } catch (e) { /* ignore */ }
                setFormData({});
                setSavedDraftId('');
                setSubmissionId(null);
                setIsSubmitted(false);
                setHasSelectedAuth(false);
                setCurrentStep(0);
              }}
              variant="primary"
              size="lg"
              className="flex-1 bg-blue-600 hover:bg-blue-700 font-bold"
            >
              Start New Application
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 size={48} className="animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading form data...</p>
        </div>
      </div>
    );
  }

  if (activeSections.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center animate-in zoom-in duration-300">
          <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle size={48} />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Form Unavailable</h2>
          <p className="text-gray-600 mb-6">There are no active sections or fields enabled in the joining form at this moment.</p>
          <Button onClick={handleBackToHome} variant="primary" size="lg" className="w-full">Return to Home</Button>
        </div>
      </div>
    );
  }

  if (!hasSelectedAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center animate-in zoom-in duration-300">
          <img src="/logo.png" alt="Logo" className="h-16 w-auto mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to the Team!</h2>
          <p className="text-gray-600 mb-8">Choose how you would like to proceed with your application.</p>

          {authError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-800 text-sm text-left">
              <AlertTriangle className="mr-3 text-red-500 shrink-0" size={20} />
              {authError}
            </div>
          )}

          <div className="space-y-4">
            <Button
              onClick={() => handleAuthSelection('google')}
              disabled={isAuthLoading}
              className="w-full relative flex items-center justify-center py-3 bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:text-gray-900 shadow-sm transition-all"
              variant="secondary"
            >
              {isAuthLoading ? (
                <Loader2 className="animate-spin mr-2" size={20} />
              ) : (
                <img src="https://www.google.com/favicon.ico" alt="G" className="w-5 h-5 mr-3" />
              )}
              <span className="font-medium">Sign in with Google to Apply</span>
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-400 font-medium">Or</span>
              </div>
            </div>

            <Button
              onClick={() => handleAuthSelection('guest')}
              disabled={isAuthLoading}
              className="w-full py-3"
              variant="outline"
            >
              Continue as Guest
            </Button>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-center">
            <button
              type="button"
              onClick={() => {
                setShowRetrieveModal(true);
                setRetrieveCode('');
                setRetrieveError(null);
                setTimeout(() => retrieveInputRef.current?.focus(), 100);
              }}
              disabled={isAuthLoading}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer py-1 px-2 rounded hover:bg-blue-50"
            >
              <Download size={14} />
              Already saved a draft? Enter Recovery Code
            </button>
          </div>

          <p className="mt-4 text-xs text-gray-400">
            Signing in with Google helps verify your identity and saves your progress automatically.
          </p>
        </div>
        {renderRetrieveDraftModal()}
      </div>
    );
  }



  const isReviewStep = currentStep === activeSections.length;
  const currentSectionData = isReviewStep ? null : (activeSections[currentStep] || activeSections[0]);

  const getCleanFileName = (path: string): string => {
    if (!path) return '';
    const parts = path.split('/');
    const lastPart = parts[parts.length - 1];
    const underscoreIdx = lastPart.indexOf('_');
    return underscoreIdx !== -1 ? lastPart.substring(underscoreIdx + 1) : lastPart;
  };



  return (
    <div className="min-h-screen bg-slate-50 py-6 sm:py-12 px-3 sm:px-6 lg:px-8 overflow-x-hidden">
      <div className="w-full max-w-3xl mx-auto">
        {/* Session Restored Banner */}
        {wasRestoredFromSession && (
          <div className="mb-3 py-1.5 px-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between gap-2 animate-in fade-in duration-300 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <Info size={15} className="text-blue-600 flex-shrink-0" />
              <p className="text-blue-800 font-medium truncate">Progress restored from previous session.</p>
            </div>
            <button onClick={() => setWasRestoredFromSession(false)} className="text-blue-400 hover:text-blue-600 p-0.5">
              <XCircle size={15} />
            </button>
          </div>
        )}

        {/* Unified Single-Row Header */}
        <div className="flex items-center justify-between gap-2 mb-4 sm:mb-6 bg-white/80 backdrop-blur-xs py-2 px-3 rounded-2xl border border-slate-200/80 shadow-xs">
          {/* Left: Back Button + Optional Referral Name */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={handleBackToHome}
              className="inline-flex items-center text-xs sm:text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors py-1 px-2 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 flex-shrink-0"
              title="Back to Home"
            >
              <ArrowLeft size={16} className="sm:mr-1.5" />
              <span className="hidden xs:inline sm:inline">Back</span>
            </button>

            {referralInvite?.createdByName && (
              <div 
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 border border-purple-200 text-purple-700 rounded-lg text-xs font-semibold shadow-2xs animate-in fade-in"
                title={referralInvite.createdByName}
              >
                <UserCheck size={14} className="text-purple-600 flex-shrink-0" />
                <span className="truncate max-w-[120px] sm:max-w-[200px]">{referralInvite.createdByName}</span>
              </div>
            )}
          </div>

          {/* Right: Consolidated Action Toolbar & Branding */}
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {/* Claim Legacy ID */}
            {isLegacyClaimEnabled && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsClaimModalOpen(true)}
                disabled={isSavingDraft || isSubmitting}
                className="bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs py-1 px-2 sm:px-2.5"
                title="Claim Legacy ID"
              >
                <Fingerprint size={14} className="sm:mr-1" />
                <span className="hidden md:inline">Legacy ID</span>
              </Button>
            )}

            {/* Retrieve Draft (Only shown when NO draft is active yet) */}
            {!linkedUid && !savedDraftId && !initialDraft?.id && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setShowRetrieveModal(true);
                  setRetrieveCode('');
                  setRetrieveError(null);
                  setTimeout(() => retrieveInputRef.current?.focus(), 100);
                }}
                disabled={isSavingDraft || isSubmitting}
                className="bg-white border-green-200 text-green-700 hover:bg-green-50 text-xs py-1 px-2 sm:px-2.5"
                title="Retrieve Draft with code"
              >
                <Download size={14} className="sm:mr-1" />
                <span className="hidden xs:inline">Retrieve</span>
              </Button>
            )}

            {/* Guest Draft Code Badge (When draft saved) */}
            {!linkedUid && savedDraftId && (
              <button
                ref={headerBadgeRef}
                onClick={() => {
                  navigator.clipboard.writeText(savedDraftId);
                  setCodeCopied(true);
                  setTimeout(() => setCodeCopied(false), 2000);
                }}
                className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 active:scale-[0.97] cursor-pointer group transition-all duration-300 text-xs ${
                  badgePulse ? 'scale-105 bg-blue-100 border-blue-400 shadow-xs ring-2 ring-blue-100' : ''
                }`}
                title={`Draft Code: ${savedDraftId} (tap to copy)`}
              >
                <span className="font-semibold text-blue-500 uppercase text-[10px] hidden sm:inline">Draft</span>
                {/* Mobile: Short code (e.g. #FTB9) */}
                <span className="font-mono font-bold text-blue-700 tracking-wide text-xs sm:hidden">
                  #{savedDraftId.split('-').pop()}
                </span>
                {/* Desktop: Full code */}
                <span className="font-mono font-bold text-blue-700 tracking-wide text-xs hidden sm:inline">
                  {savedDraftId}
                </span>
                <span className="text-blue-400 group-hover:text-blue-600 transition-colors text-xs">
                  {codeCopied ? '✅' : '📋'}
                </span>
              </button>
            )}

            {/* Save Progress Button (Before first save) */}
            {!linkedUid && !savedDraftId && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSaveProgress}
                disabled={isSavingDraft || isSubmitting || isFormEmpty(formData)}
                className="bg-white border-blue-200 text-blue-700 hover:bg-blue-50 text-xs py-1 px-2 sm:px-2.5"
                title="Save Progress"
              >
                {isSavingDraft ? <Loader2 size={14} className="animate-spin sm:mr-1" /> : <RotateCcw size={14} className="sm:mr-1" />}
                <span className="hidden xs:inline">Save</span>
              </Button>
            )}

            {/* Discard Draft Button */}
            {(savedDraftId || initialDraft?.id) && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDiscardDraftClick}
                disabled={isSavingDraft || isSubmitting || isDiscarding}
                className="bg-white border-red-200 text-red-700 hover:bg-red-50 text-xs py-1 px-1.5 sm:px-2.5"
                title="Discard Draft"
              >
                {isDiscarding ? <Loader2 size={14} className="animate-spin sm:mr-1" /> : <Trash2 size={14} className="sm:mr-1" />}
                <span className="hidden sm:inline">Discard</span>
              </Button>
            )}

            {/* Logo */}
            <img src="/logo.png" alt="Logo" className="h-7 sm:h-8 w-auto object-contain ml-0.5" />
          </div>
        </div>

        {/* Auth Status Banner: Slim 1-Line */}
        {linkedUid && rawGoogleUser ? (
          <div className="mb-4 py-1.5 px-3 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between gap-2 animate-in fade-in duration-300 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle size={15} className="text-green-600 flex-shrink-0" />
              <p className="text-green-800 font-medium truncate">
                <span className="font-bold">Google Linked:</span> {(rawGoogleUser as any).email || 'Verified'}
              </p>
            </div>
          </div>
        ) : (
          <div className="mb-4 py-1.5 px-3 bg-amber-50/90 border border-amber-200 rounded-xl flex items-center justify-between gap-2 animate-in fade-in duration-300 text-xs">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <AlertTriangle size={15} className="text-amber-600 flex-shrink-0" />
              <p className="text-amber-800 font-medium truncate">
                <span className="font-bold">Guest Mode:</span> Save draft to avoid losing progress
              </p>
            </div>
            <Button
              onClick={() => handleAuthSelection('google')}
              disabled={isAuthLoading}
              variant="secondary"
              size="sm"
              className="bg-white border text-gray-700 hover:bg-gray-50 flex items-center shadow-2xs py-1 px-2.5 flex-shrink-0 text-xs"
            >
              {isAuthLoading ? (
                <Loader2 className="animate-spin mr-1" size={12} />
              ) : (
                <img src="https://www.google.com/favicon.ico" alt="G" className="w-3.5 h-3.5 mr-1" />
              )}
              <span className="font-medium">Link Google</span>
            </Button>
          </div>
        )}

        {/* Storage Quota Warning Banner */}
        {totalStorageSize > 5 * 1024 * 1024 && (
          <div className={`mb-4 p-3 border rounded-xl flex items-center gap-3 animate-in fade-in duration-300 ${
            totalStorageSize > 15 * 1024 * 1024 ? 'bg-red-50 border-red-200 text-red-850' : 'bg-blue-50 border-blue-200 text-blue-850'
          }`}>
            <div className={`p-1.5 rounded-full ${
              totalStorageSize > 15 * 1024 * 1024 ? 'bg-red-100' : 'bg-blue-100'
            }`}>
              {totalStorageSize > 15 * 1024 * 1024 ? (
                <AlertTriangle size={16} className="text-red-600" />
              ) : (
                <Info size={16} className="text-blue-600" />
              )}
            </div>
            <div className="flex-1">
              <p className={`text-xs font-semibold ${totalStorageSize > 15 * 1024 * 1024 ? 'text-red-800' : 'text-blue-800'}`}>
                {totalStorageSize > 15 * 1024 * 1024 ? 'Draft Storage Warning' : 'Draft Storage Consumption'}
              </p>
              <p className={`text-xs ${totalStorageSize > 15 * 1024 * 1024 ? 'text-red-600' : 'text-blue-600'}`}>
                Your uploaded documents total <strong>{(totalStorageSize / (1024 * 1024)).toFixed(2)} MB</strong>. 
                {totalStorageSize > 15 * 1024 * 1024 && ' Consider using smaller files to prevent submission timeouts.'}
              </p>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        <div className="mb-10">
          <ProgressBar
            currentStep={currentStep}
            sections={[...activeSections.map(s => s.name), "Review & Submit"]}
          />
        </div>

        {/* Legacy Claim Welcome Banner */}
        {legacyClaim && (
          <div className="mb-6 bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start space-x-3 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="p-2 bg-amber-100 rounded-lg">
              <CheckCircle size={20} className="text-amber-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-amber-900">Welcome Back, {legacyClaim.employeeName}!</h4>
              <p className="text-xs text-amber-700 leading-relaxed mt-1">
                We've verified your profile. Your selected information has been auto-filled from our legacy records. 
                Please review and complete the remaining sections to finalize your onboarding.
              </p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-8 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="mb-6 sm:mb-10 text-center">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 uppercase tracking-widest">{isReviewStep ? "Review Details" : currentSectionData.name}</h2>
            <div className="w-16 h-1 bg-blue-600 mx-auto mt-2 rounded-full"></div>
          </div>

          {/* Aadhaar Autofill Button (Only on Step 0) */}
          {currentStep === 0 && (
            <>
              {/* Quick Apply Button */}
              <div className="mb-4 p-4 bg-blue-50 border border-blue-100 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-blue-900 flex items-center gap-2">
                    <Zap size={16} className="text-blue-600" />
                    Quick Apply
                  </h3>
                  <p className="text-xs text-blue-700 mt-1">
                    Upload your Aadhaar PDF to automatically fill Name, Address, and more.
                    (Supports password-protected files)
                  </p>
                </div>
                <div>
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleAadhaarUpload}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isParsingAadhaar}
                    className="bg-white text-blue-700 border-blue-200 hover:bg-blue-50 whitespace-nowrap"
                  >
                    {isParsingAadhaar ? (
                      <><Loader2 size={14} className="animate-spin mr-2" /> Extracting...</>
                    ) : (
                      'Autofill from Aadhaar'
                    )}
                  </Button>
                </div>
              </div>

              {/* Password Modal - Floating Overlay */}
              {showPasswordModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.4)' }}>
                  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-start gap-3 mb-5">
                      <div className="w-11 h-11 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle size={22} className="text-amber-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">PDF is Password Protected</h3>
                        <p className="text-sm text-gray-500 mt-0.5">Enter the password to unlock your Aadhaar PDF</p>
                      </div>
                    </div>

                    <div className="bg-amber-50 rounded-xl p-4 mb-5 border border-amber-200">
                      <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider mb-2">📋 How to find your password</p>
                      <div className="space-y-1.5 text-sm text-gray-700">
                        <p>• First <strong>4 letters</strong> of your name in <strong>CAPITAL LETTERS</strong></p>
                        <p>• Followed by your <strong>Year of Birth</strong> (4 digits)</p>
                      </div>
                      <div className="mt-3 px-3 py-2 bg-white rounded-lg border border-amber-200">
                        <p className="text-xs text-gray-500">Example: Name is <strong>RAHUL</strong>, birth year <strong>1995</strong></p>
                        <p className="text-base font-mono font-bold text-amber-700 tracking-widest mt-0.5">RAHU1995</p>
                      </div>
                    </div>

                    {extractionWarning && (
                      <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-600 font-medium">{extractionWarning}</p>
                      </div>
                    )}

                    <div className="mb-4">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Enter Password</label>
                      <input
                        ref={passwordInputRef}
                        type="text"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                        placeholder="e.g. RAHU1995"
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-lg font-mono tracking-widest focus:outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100 transition-all font-mono"
                        style={{ textTransform: 'none' }}
                        autoComplete="off"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                      />
                    </div>

                    <div className="flex gap-3">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handlePasswordSubmit}
                        disabled={!passwordInput.trim()}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-semibold"
                      >
                        🔓 Unlock PDF
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setShowPasswordModal(false);
                          setPendingFile(null);
                          setExtractionWarning(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="px-6 text-gray-500 hover:text-gray-700 border-gray-200 rounded-xl"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              )}

            </>
          )}

          {isReviewStep ? (
            <div className="space-y-8 animate-in fade-in duration-300">
              <p className="text-sm text-gray-600 border-b pb-4">
                Please review all the information you have entered. You can click <strong>Edit</strong> on any section to go back and make changes.
              </p>
              {activeSections.map((section, secIdx) => {
                const visibleFields = section.fields.filter(f => isFieldVisible(f) && f.id !== SUBUNIT_FIELD_ID);
                if (visibleFields.length === 0) return null;

                return (
                  <div key={section.id} className="border border-gray-150 rounded-2xl overflow-hidden bg-slate-50/30">
                    <div className="bg-slate-100/70 px-6 py-4 flex justify-between items-center border-b border-gray-150">
                      <h3 className="font-bold text-gray-800 uppercase tracking-wider text-sm">{section.name}</h3>
                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={() => setCurrentStep(secIdx)}
                        className="bg-white border text-blue-600 border-blue-200 hover:bg-blue-50 px-3 py-1 rounded-lg text-xs font-semibold"
                      >
                        Edit
                      </Button>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {visibleFields.map((field) => {
                        const val = formData[field.id];
                        let displayValue = '—';

                        if (val !== undefined && val !== null && val !== '') {
                          if (field.type === FieldType.FILE_UPLOAD) {
                            const isStringVal = typeof val === 'string';
                            const fileName = isStringVal ? getCleanFileName(val) : (val instanceof File ? val.name : 'Document Uploaded');
                            displayValue = fileName;
                          } else if (field.type === FieldType.CHECKBOX) {
                            displayValue = val ? 'Yes' : 'No';
                          } else if (Array.isArray(val)) {
                            displayValue = val.join(', ');
                          } else {
                            displayValue = String(val);
                          }
                        }

                        return (
                          <div key={field.id} className={`${field.type === FieldType.TEXTAREA || field.type === FieldType.FILE_UPLOAD ? 'md:col-span-2' : ''} border-b border-gray-100 pb-3 last:border-b-0`}>
                            <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{field.label}</span>
                            {field.type === FieldType.FILE_UPLOAD && val ? (
                              <div className="flex items-center gap-2 mt-1">
                                <FileText size={16} className="text-blue-500" />
                                <span className="text-sm font-medium text-gray-700">{displayValue}</span>
                                {(typeof val === 'string' || (typeof val === 'object' && val !== null && 'storagePath' in val)) && (
                                  <a
                                    href="#"
                                    onClick={async (e) => {
                                      e.preventDefault();
                                      const valPath = typeof val === 'object' && val !== null && 'storagePath' in val
                                        ? val.storagePath
                                        : val;

                                      if (typeof valPath !== 'string') return;

                                      const target = e.currentTarget;
                                      const originalText = target.innerText;

                                      if (valPath.startsWith('http') || valPath.startsWith('data:') || valPath.startsWith('blob:')) {
                                        window.open(valPath, '_blank');
                                        return;
                                      }

                                      target.innerText = 'Loading...';
                                      target.style.pointerEvents = 'none';
                                      try {
                                        await ensureAuthenticated();
                                        const blob = await getBlob(ref(storage, valPath));
                                        const url = URL.createObjectURL(blob);
                                        window.open(url, '_blank');
                                      } catch (err) {
                                        console.error("Failed to view file:", err);
                                        alert("Failed to view document.");
                                      } finally {
                                        target.innerText = originalText;
                                        target.style.pointerEvents = 'auto';
                                      }
                                    }}
                                    className="text-xs text-blue-600 hover:text-blue-700 underline font-semibold ml-2"
                                  >
                                    View
                                  </a>
                                )}
                                {val instanceof File && (
                                  <a
                                    href="#"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      const url = URL.createObjectURL(val);
                                      window.open(url, '_blank');
                                    }}
                                    className="text-xs text-blue-600 hover:text-blue-700 underline font-semibold ml-2"
                                  >
                                    Preview Local
                                  </a>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-gray-700 font-medium whitespace-pre-wrap">{displayValue}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Set Login Password Card (Guest Only) */}
              {!linkedUid && (
                <div className="border-t border-slate-150 pt-8 mt-8 space-y-4 text-left">
                  <div className="bg-blue-50/50 border border-blue-100 p-5 rounded-2xl flex items-start space-x-3">
                    <div className="p-2.5 bg-blue-100 text-blue-600 rounded-xl">
                      <Fingerprint size={20} />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-blue-900">Create Login Password</h4>
                      <p className="text-xs text-blue-700 leading-relaxed mt-1">
                        Please set a secure login password. You will need this password along with your Employee ID to log in to the Employee Portal once your onboarding application is approved by HR.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <Input
                      label="Choose Password *"
                      type="password"
                      placeholder="Min 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      showPasswordToggle={true}
                      required
                    />
                    <Input
                      label="Confirm Password *"
                      type="password"
                      placeholder="Repeat password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      showPasswordToggle={true}
                      required
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
              {currentSectionData?.fields.map((field) => {
                if (!isFieldVisible(field)) return null;
                // Hide Sub-Unit field from joining form - admins assign this later
                if (field.id === SUBUNIT_FIELD_ID) return null;
                return (
                  <div key={field.id} className={`${field.type === FieldType.TEXTAREA || field.type === FieldType.FILE_UPLOAD ? 'sm:col-span-2' : ''}`}>
                    {renderField(field)}
                  </div>
                );
              })}
            </div>
          )}

          {submissionError && (
            <div className="mt-8 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-800 animate-in shake duration-500">
              <AlertTriangle className="mr-3 text-red-500" />
              {submissionError}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3">
          <Button
            onClick={handlePrevStep}
            disabled={currentStep === 0 || isSubmitting}
            variant="outline"
            className="flex items-center px-4 sm:px-6"
            size="lg"
          >
            <ChevronLeft className="mr-1.5" size={18} /> Previous
          </Button>

          {isReviewStep ? (
            <Button
              onClick={handleFinalSubmit}
              disabled={isSubmitting}
              variant="primary"
              className="flex items-center px-6 sm:px-10 bg-blue-600 hover:bg-blue-700"
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 animate-spin" /> Submitting...
                </>
              ) : (
                <>
                  <Zap className="mr-2 fill-current" size={18} /> Submit Application
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleNextStep}
              variant="primary"
              className="flex items-center px-6 sm:px-10 bg-blue-600 hover:bg-blue-700"
              size="lg"
            >
              {currentStep === activeSections.length - 1 ? (
                <>
                  Review Details <ChevronRight className="ml-1.5" size={18} />
                </>
              ) : (
                <>
                  Next <ChevronRight className="ml-1.5" size={18} />
                </>
              )}
            </Button>
          )}

          {/* Submission Progress Overlay */}
          {showSubmissionProgress && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.5)' }}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600">
                  <h3 className="text-white font-bold text-base flex items-center gap-2">
                    <Loader2 size={18} className="animate-spin" />
                    Submitting Your Application
                  </h3>
                  <p className="text-blue-100 text-xs mt-1">Please do not close this page</p>
                </div>

                <div className="px-6 py-4 space-y-3">
                  {submissionSteps.map((step, index) => (
                    <div key={index} className="flex flex-col gap-1">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                          {step.status === 'done' ? (
                            <CheckCircle size={20} className="text-green-500" />
                          ) : step.status === 'loading' ? (
                            <Loader2 size={18} className="text-blue-500 animate-spin" />
                          ) : step.status === 'error' ? (
                            <XCircle size={20} className="text-red-500" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border-2 border-gray-200" />
                          )}
                        </div>
                        <span className={`text-sm font-medium flex-1 ${step.status === 'done' ? 'text-green-700' :
                          step.status === 'loading' ? 'text-blue-700' :
                            step.status === 'error' ? 'text-red-600' :
                              'text-gray-400'
                          }`}>
                          {step.label}
                        </span>
                        {step.status === 'loading' && step.percent !== undefined && (
                          <span className="text-xs font-bold text-blue-600 tabular-nums">{step.percent}%</span>
                        )}
                      </div>
                      {step.status === 'loading' && step.percent !== undefined && (
                        <div className="ml-9 w-full bg-gray-100 rounded-full h-1 overflow-hidden">
                          <div
                            className="bg-blue-500 h-full rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${step.percent}%` }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
                  <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${Math.round((submissionSteps.filter(s => s.status === 'done').length / Math.max(submissionSteps.length, 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Retrieve Draft Modal */}
        {renderRetrieveDraftModal()}

        {/* Save Draft Modal */}
        {showSaveModal && (
          <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-500 ${isMinimizing ? 'bg-transparent backdrop-blur-none pointer-events-none' : 'bg-slate-900/50 backdrop-blur-sm'}`}>
            <div 
              ref={modalCardRef}
              style={minimizingStyle}
              className={`bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center ${isMinimizing ? '' : 'animate-in zoom-in duration-300'}`}
            >
              <div className={`w-16 h-16 ${linkedUid ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                {linkedUid ? <CheckCircle size={32} /> : <RotateCcw size={32} />}
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Progress Saved!</h3>

              {linkedUid ? (
                /* ── Google User: No recovery code needed ── */
                <>
                  <p className="text-gray-600 text-sm mb-4">
                    Your draft is automatically saved to your Google account. You can close this page and resume anytime by signing in with the same Google account.
                  </p>
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-5 flex items-center gap-3">
                    <CheckCircle size={20} className="text-green-500 flex-shrink-0" />
                    <p className="text-sm text-green-700 text-left">Draft linked to <strong>{rawGoogleUser?.email || 'your Google account'}</strong></p>
                  </div>
                </>
              ) : (
                /* ── Guest User: Show recovery code ── */
                <>
                  <p className="text-gray-600 text-sm mb-6">
                    Use this recovery code to resume your application from any device. <strong>Tap the code to copy it.</strong>
                  </p>
                  <div
                    className="bg-slate-50 border-2 border-dashed border-blue-200 rounded-xl p-4 mb-2 cursor-pointer group hover:border-blue-400 transition-all active:scale-[0.97]"
                    onClick={() => {
                      if (savedDraftId) {
                        navigator.clipboard.writeText(savedDraftId);
                        const el = document.getElementById('copy-feedback');
                        if (el) { el.textContent = '✅ Copied to clipboard!'; setTimeout(() => { el.textContent = 'Tap code to copy'; }, 2000); }
                      }
                    }}
                  >
                    <p className="text-xs text-gray-400 uppercase font-bold mb-1">Recovery Code</p>
                    <p className="text-2xl font-mono font-bold text-blue-700 tracking-wider uppercase">{savedDraftId}</p>
                  </div>
                  <p id="copy-feedback" className="text-xs text-gray-400 mb-5 transition-all">Tap code to copy</p>
                </>
              )}
              <Button onClick={handleCloseSaveModal} variant="primary" className="w-full">Continue Working</Button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Autofill Selection Modal ─── */}
      {showAutofillModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}>
          <div style={{ background: '#fff', borderRadius: 20, maxWidth: 620, width: '95%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,.25)', animation: 'fadeIn 0.3s ease-out' }}>
            {/* Header */}
            <div style={{ padding: '24px 28px 16px', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Fingerprint size={22} color="#fff" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1f2937' }}>Legacy Data Found!</h3>
                  <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>We found {autofillCandidates.filter(c => c.value).length} fields from your records</p>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#4b5563', lineHeight: 1.5 }}>
                Select the fields you want to auto-fill. Uncheck any you'd prefer to enter manually.
              </p>
              {/* Select All / Deselect All */}
              <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                <button onClick={() => setAutofillCandidates(prev => prev.map(c => ({ ...c, selected: true })))}
                  style={{ fontSize: 12, fontWeight: 600, color: '#6366f1', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}>
                  Select All
                </button>
                <button onClick={() => setAutofillCandidates(prev => prev.map(c => ({ ...c, selected: false })))}
                  style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}>
                  Deselect All
                </button>
              </div>
            </div>

            {/* Scrollable Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 28px' }}>
              {(() => {
                // Group by section
                const grouped: Record<string, AutofillCandidate[]> = {};
                autofillCandidates.forEach(c => {
                  if (!grouped[c.sectionName]) grouped[c.sectionName] = [];
                  grouped[c.sectionName].push(c);
                });

                const sectionIcons: Record<string, string> = {
                  'Personal Details': '👤',
                  'Job Details': '💼',
                  'Address': '📍',
                  'Reference': '🤝',
                  'Family Details': '👨‍👩‍👧‍👦',
                  'Government IDs': '🪪',
                  'Bank Details': '🏦',
                };

                const sortedSections = Object.entries(grouped).sort(([, a], [, b]) => a[0].sectionOrder - b[0].sectionOrder);

                return sortedSections.map(([sectionName, items]) => (
                  <div key={sectionName} style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ fontSize: 16 }}>{sectionIcons[sectionName] || '📋'}</span>
                      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{sectionName}</h4>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 8 }}>
                      {items.map((candidate) => (
                        <label
                          key={candidate.fieldId}
                          onClick={() => setAutofillCandidates(prev => prev.map(c => c.fieldId === candidate.fieldId ? { ...c, selected: !c.selected } : c))}
                          style={{
                            display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 12, cursor: 'pointer', transition: 'all 0.15s ease',
                            border: candidate.selected ? '1.5px solid #818cf8' : '1.5px solid #e5e7eb',
                            background: candidate.selected ? '#eef2ff' : '#fafafa',
                          }}
                        >
                          <div style={{ marginTop: 2, flexShrink: 0 }}>
                            {candidate.selected
                              ? <CheckSquare size={18} color="#6366f1" />
                              : <Square size={18} color="#9ca3af" />
                            }
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{candidate.label}</div>
                            <div style={{ fontSize: 14, fontWeight: 500, color: '#1f2937', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{candidate.value}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 28px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                onClick={() => {
                  setShowAutofillModal(false);
                  setAutofillCandidates([]);
                }}
                style={{ fontSize: 14, fontWeight: 600, color: '#6b7280', background: 'transparent', border: '1.5px solid #d1d5db', borderRadius: 12, padding: '10px 24px', cursor: 'pointer' }}
              >
                Skip All
              </button>
              <button
                onClick={() => {
                  // Apply selected candidates to formData
                  const selected = autofillCandidates.filter(c => c.selected);
                  if (selected.length > 0) {
                    setFormData(prev => {
                      const updated = { ...prev };
                      for (const c of selected) {
                        updated[c.fieldId] = c.value;
                      }
                      return updated;
                    });
                  }
                  setShowAutofillModal(false);
                  setAutofillCandidates([]);
                }}
                style={{
                  fontSize: 14, fontWeight: 700, color: '#fff', border: 'none', borderRadius: 12, padding: '10px 28px', cursor: 'pointer',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
                }}
              >
                Apply {autofillCandidates.filter(c => c.selected).length} Fields
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conflict Resolution Modal */}
      {showConflictModal && conflictDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={28} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">Application Draft Conflict</h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              We found a saved draft on the cloud under this Google account from <strong>{new Date(conflictDraft.lastUpdated).toLocaleString()}</strong>.
              You also have unsaved edits in your current form session.
            </p>

            <div className="space-y-3">
              <button
                onClick={() => handleResolveConflict('cloud')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                📥 Load Saved Cloud Draft
              </button>
              <button
                onClick={() => handleResolveConflict('local')}
                className="w-full bg-white hover:bg-gray-50 text-gray-700 border-2 border-gray-200 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                📝 Keep Current Session Edits
              </button>
            </div>
          </div>
        </div>
      )}

      <LegacyClaimModal 
        isOpen={isClaimModalOpen}
        onClose={() => setIsClaimModalOpen(false)}
        onSuccess={() => {
          setIsClaimModalOpen(false);
          checkLegacyClaim();
        }}
      />
    </div>
  );
};

export default EmployeeFormPage;


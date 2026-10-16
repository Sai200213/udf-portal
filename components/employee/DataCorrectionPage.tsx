import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FormSection, FormField, FieldType, CorrectionRequest } from '../../types';
import { getCorrectionRequest, submitCorrectionResponse } from '../../src/services/employeeService';
import { getApplicantEmail, getApplicantName } from '../../utils/formDataHelper';
import { useData } from '../../src/contexts/DataContext';
import { useAuth } from '../../src/context/AuthContext';
import { defaultSites } from '../../src/constants/defaults';
import { loginWithGoogleForOnboarding } from '../../src/services/authService';
import { auth, db, ensureAuthenticated } from '../../src/firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, query, where, collection, limit, getDocs } from 'firebase/firestore';
import Button from '../common/Button';
import Input from '../common/Input';
import { 
  ArrowLeft, CheckCircle2, AlertTriangle, Loader2, Lock, FileText, 
  CheckCircle, AlertCircle, RefreshCw, LogIn, KeyRound, Eye, Info
} from 'lucide-react';

// Import field inputs
import EmployeeTextField from '../employeeFormFields/EmployeeTextField';
import EmployeeTextareaField from '../employeeFormFields/EmployeeTextareaField';
import EmployeeDropdownField from '../employeeFormFields/EmployeeDropdownField';
import EmployeeDateField from '../employeeFormFields/EmployeeDateField';
import EmployeeCheckboxField from '../employeeFormFields/EmployeeCheckboxField';
import EmployeeRadioField from '../employeeFormFields/EmployeeRadioField';
import EmployeeFileUploadField from '../employeeFormFields/EmployeeFileUploadField';

interface DataCorrectionPageProps {
  sections: FormSection[];
}

const DataCorrectionPage: React.FC<DataCorrectionPageProps> = ({ sections }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user: authUser, loading: authLoading } = useAuth();
  const { sites, portalConfig } = useData();
  
  const rawToken = searchParams.get('token') || '';
  const token = useMemo(() => {
    if (!rawToken) return null;
    // Sanitize token: strip leading dashes/spaces and convert accidental spaces to hyphens
    return rawToken.trim().replace(/^[-_\s]+/, '').replace(/\s+/g, '-') || null;
  }, [rawToken]);

  // Core Request States
  const [initialSignOutDone, setInitialSignOutDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestDoc, setRequestDoc] = useState<CorrectionRequest | null>(null);
  const [targetData, setTargetData] = useState<any | null>(null);
  const [authNeededProvider, setAuthNeededProvider] = useState<'google' | 'manual' | null>(null);
  const [linkedEmailHint, setLinkedEmailHint] = useState<string | null>(null);

  // Guest Verification States (For manual pending applicants who don't have accounts)
  const [guestVerified, setGuestVerified] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [verificationDob, setVerificationDob] = useState('');
  const [verificationPhone, setVerificationPhone] = useState('');
  const [verifyingGuest, setVerifyingGuest] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Firebase Auth State Tracking
  const [currentUser, setCurrentUser] = useState<any>(auth.currentUser);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Hook to handle initial non-admin sign-out check on mount (clears stale existing sessions once)
  useEffect(() => {
    const handleInitialAuthCheck = async () => {
      const isManager = authUser && (
        authUser.id === 'super-admin' ||
        authUser.roleId === 'role-super-admin' ||
        authUser.type === 'Admin'
      );

      const token = new URLSearchParams(window.location.search).get('token') || 'default';
      const storageKey = `correction_initial_signout_done_${token}`;
      const hasSignedOutAlready = sessionStorage.getItem(storageKey);
      
      if (!isManager && auth.currentUser && !hasSignedOutAlready) {
        console.log("Forcing initial sign out of stale session on correction page mount");
        sessionStorage.setItem(storageKey, 'true');
        await auth.signOut();
        setCurrentUser(null);
      }
      setInitialSignOutDone(true);
    };

    if (!authLoading && !initialSignOutDone) {
      handleInitialAuthCheck();
    }
  }, [authLoading, authUser, initialSignOutDone]);

  // Form Submission States
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitProgress, setSubmitProgress] = useState<Record<string, { status: 'loading' | 'done' | 'error'; percent?: number }>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // 1. Helper: Find field configuration from target's original Form Sections or global Form Sections
  const findFieldDefinition = useCallback((fieldId: string): FormField | null => {
    const candidateSections = [
      ...(targetData?.originalFormSections || []),
      ...(sections || [])
    ];
    for (const sec of candidateSections) {
      const field = sec.fields?.find((f: any) => f.id === fieldId);
      if (field) return field;
    }
    return null;
  }, [sections, targetData]);

  // 2. Fetch correction request details and targets
  const loadCorrectionDetails = useCallback(async () => {
    if (!token) {
      setError("No token provided. Please use the complete link sent to you by HR.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setAuthNeededProvider(null);
    setLinkedEmailHint(null);

    try {
      // Ensure at least anonymous auth is active for Firebase rules
      await ensureAuthenticated();

      const request = await getCorrectionRequest(token);
      if (!request) {
        setError("Invalid correction link. This link does not exist.");
        setLoading(false);
        return;
      }

      setRequestDoc(request);

      if (request.status !== 'pending') {
        setError(request.status === 'completed' 
          ? "This correction link has already been used. Updates have been submitted."
          : "This correction link has expired. Please contact HR for a new link.");
        setLoading(false);
        return;
      }

      // Fetch target data (Employee or Submission)
      let data: any = null;
      try {
        const targetCollection = request.targetType === 'employee' ? 'employees' : 'onboarding_submissions';
        let targetRef = doc(db, targetCollection, request.targetId);
        let targetSnap = await getDoc(targetRef);

        // Fallback for older tokens where targetId was set to employeeId (e.g. HY140000) instead of docId
        if (!targetSnap.exists() && request.targetType === 'employee') {
          try {
            const q = query(collection(db, 'employees'), where("employeeId", "==", request.targetId), limit(1));
            const qSnap = await getDocs(q);
            if (!qSnap.empty) {
              targetSnap = qSnap.docs[0] as any;
            }
          } catch (qErr) {
            // Unauthenticated users may not list/query; fallback handled gracefully
          }
        }

        if (targetSnap.exists()) {
          data = targetSnap.data();
          setTargetData(data);
        }
      } catch (readErr) {
        console.warn("[DataCorrectionPage] Direct target read restricted by security rules pending authentication:", readErr);
      }

      // Determine verification & login routing
      const linkedEmail = data?.linkedGoogleEmail || (request.targetType === 'employee' 
        ? (data?.profileData?.personalDetails?.email || data?.data?.personalDetails?.email)
        : (data?.formData?.personalDetails?.email || data?.data?.personalDetails?.email)
      );
      
      setLinkedEmailHint(linkedEmail || null);

      if (request.targetType === 'employee') {
        // Active Employees MUST be authenticated
        setAuthNeededProvider('manual');
      } else {
        // Pending Applicants: Force Google auth only if linked Google details exist
        const hasGoogle = data?.authProvider === 'google' || (!!data?.linkedGoogleEmail && data?.authProvider !== 'manual');
        if (hasGoogle) {
          setAuthNeededProvider('google');
        } else {
          setAuthNeededProvider(null); // Guest Verification (DOB + Mobile)
        }
      }

      // Initialize form values with existing target values
      const initialValues: Record<string, any> = {};
      const fields = data?.formData || data?.profileData || data?.data || {};
      request.requestedFields.forEach(fieldId => {
        initialValues[fieldId] = fields[fieldId] || '';
      });
      setFormData(initialValues);

    } catch (err: any) {
      console.error("Failed to load correction request:", err);
      setError("An error occurred while loading this request. Please try again. (" + err.message + ")");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (initialSignOutDone) {
      loadCorrectionDetails();
    }
  }, [initialSignOutDone, loadCorrectionDetails]);

  // 3. Perform local verification checks
  // 3. Perform local verification checks
  const isIdentityVerified = useMemo((): boolean => {
    if (!requestDoc || !targetData) return false;
    
    // Admin override
    if (authUser && (authUser.id === 'super-admin' || authUser.roleId === 'role-super-admin')) {
      return true;
    }

    if (requestDoc.targetType === 'employee') {
      // Active Employee: verify against doc ID, Employee ID, Portal ID, or record UID
      if (!authUser) return false;
      const targetId = String(requestDoc.targetId || '').trim().toLowerCase();
      const authId = String(authUser.id || '').trim().toLowerCase();
      const authEmpId = String((authUser as any).employeeId || '').trim().toLowerCase();
      const authPortalId = String((authUser as any).portalId || '').trim().toLowerCase();
      const dataEmpId = String(targetData?.employeeId || '').trim().toLowerCase();
      const dataUid = String(targetData?.uid || '').trim().toLowerCase();

      return (
        authId === targetId ||
        (authEmpId !== '' && authEmpId === targetId) ||
        (authPortalId !== '' && authPortalId === targetId) ||
        (authEmpId !== '' && dataEmpId !== '' && authEmpId === dataEmpId) ||
        (authId !== '' && dataUid !== '' && authId === dataUid)
      );
    } else {
      // Pending submission
      if (authNeededProvider === null) {
        // Guest mode manual verification
        return guestVerified;
      }

      // Google-linked candidate
      if (!currentUser) return false;
      const loggedEmail = currentUser.email?.toLowerCase();
      const targetGoogleEmail = targetData?.linkedGoogleEmail?.toLowerCase();
      const targetPersonalEmail = linkedEmailHint?.toLowerCase();
      
      return (
        currentUser.uid === targetData?.linkedUid || 
        (loggedEmail && targetGoogleEmail && loggedEmail === targetGoogleEmail) ||
        (loggedEmail && targetPersonalEmail && loggedEmail === targetPersonalEmail)
      );
    }
  }, [requestDoc, authUser, currentUser, linkedEmailHint, targetData, authNeededProvider, guestVerified]);

  const handleGuestVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerificationError(null);

    if (!verificationDob) {
      setVerificationError("Please select your date of birth.");
      return;
    }
    if (!verificationPhone.trim()) {
      setVerificationError("Please enter your registered mobile number.");
      return;
    }

    setVerifyingGuest(true);

    try {
      const submissionData = targetData;
      const rawForm = submissionData.formData || submissionData.data || {};

      // Look for Date of Birth field
      const dobField = submissionData.originalFormSections
        ?.flatMap((s: any) => s.fields || [])
        ?.find((f: any) => f.label?.toLowerCase().includes('birth') || f.id === '6e570a01-14e0-4e18-b112-97ddc51d0778');
      const registeredDob = dobField ? rawForm[dobField.id] : null;

      // Look for Phone Number field
      const phoneField = submissionData.originalFormSections
        ?.flatMap((s: any) => s.fields || [])
        ?.find((f: any) => f.label?.toLowerCase().includes('phone') || f.label?.toLowerCase().includes('mobile') || f.id === 'eb3617dc-9f1d-475d-a2db-005b6bc2500c');
      const registeredPhone = phoneField ? rawForm[phoneField.id] : null;

      // Validate DOB
      const formatDob = (dobStr: string) => {
        if (!dobStr) return '';
        try {
          return new Date(dobStr).toISOString().substring(0, 10);
        } catch {
          return dobStr;
        }
      };
      const dobMatch = registeredDob && verificationDob && formatDob(registeredDob) === formatDob(verificationDob);

      // Validate Phone/Mobile Number
      const cleanPhone = (phoneStr: string) => {
        if (!phoneStr) return '';
        return phoneStr.replace(/\D/g, ''); // Keep digits only
      };
      const phoneMatch = registeredPhone && verificationPhone.trim() && cleanPhone(registeredPhone) === cleanPhone(verificationPhone);

      if (dobMatch && phoneMatch) {
        // Sign in anonymously to have a valid auth session for Firestore rules / storage uploads
        await ensureAuthenticated();
        setGuestVerified(true);
      } else {
        setVerificationError("The Date of Birth or Mobile Number entered does not match our records.");
      }
    } catch (err: any) {
      setVerificationError("Verification failed due to an error: " + err.message);
    } finally {
      setVerifyingGuest(false);
    }
  };

  // 5. Trigger Google Login
  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      if (auth.currentUser) {
        await auth.signOut();
      }
      await loginWithGoogleForOnboarding();
      await loadCorrectionDetails(); // Reload to evaluate auth match
    } catch (err: any) {
      console.error("Google sign in error:", err);
      alert("Sign in failed: " + (err.message || err));
      setLoading(false);
    }
  };


  const isFieldVisible = useCallback((field: FormField): boolean => {
    if (!field.visibilityCondition || !field.visibilityCondition.fieldId) return true;

    const { fieldId, operator, value } = field.visibilityCondition;
    const targetValue = formData[fieldId] !== undefined
      ? formData[fieldId]
      : (targetData?.formData?.[fieldId] || targetData?.profileData?.[fieldId] || targetData?.data?.[fieldId]);

    if (operator === 'equals') return String(targetValue || '').toLowerCase() === String(value || '').toLowerCase();
    if (operator === 'not_equals') return String(targetValue || '').toLowerCase() !== String(value || '').toLowerCase();
    if (operator === 'contains') return String(targetValue || '').toLowerCase().includes(String(value || '').toLowerCase());

    return true;
  }, [formData, targetData]);

  const validateSingleField = useCallback((field: FormField, value: any): string | null => {
    if (!isFieldVisible(field)) return null;

    let isEmpty = false;
    if (field.type === FieldType.CHECKBOX) {
      isEmpty = !value || (Array.isArray(value) && value.length === 0);
    } else if (field.type === FieldType.FILE_UPLOAD) {
      isEmpty = !value || (typeof value === 'string' && value.trim() === '');
    } else {
      isEmpty = value === undefined || value === null || String(value).trim() === '';
    }

    if (field.isMandatory && isEmpty) {
      return `${field.label} is required.`;
    }

    if (isEmpty) return null;

    const strValue = String(value).trim();
    const fLabel = (field.label || '').toLowerCase();

    // 1. Comprehensive Anti-Dummy & Anti-Placeholder Filter (Applies to all text and textarea inputs)
    if (field.type === FieldType.TEXT || field.type === FieldType.TEXTAREA) {
      const isPlaceholderToken = ['na', 'n/a', 'none', 'nil', 'null', 'dummy', 'test', 'unknown', 'tbd', '0', '00', '000', 'xxx', 'asdf', 'qwerty', 'temp', 'placeholder'].includes(strValue.toLowerCase());
      const isRepetitiveDigits = /^\d+$/.test(strValue) && /^(\d)\1+$/.test(strValue);
      const isSequentialDigits = strValue === '1234567890' || strValue === '0123456789' || strValue === '9876543210';
      const isRepetitiveLetters = /^[a-zA-Z]+$/.test(strValue) && /^([a-zA-Z])\1+$/i.test(strValue) && strValue.length > 2;

      if (isPlaceholderToken || isRepetitiveDigits || isSequentialDigits || isRepetitiveLetters) {
        return `Please enter a valid, real ${field.label} (dummy or repetitive values are not allowed).`;
      }
    }

    // 2. Specific Government ID & Key Field Format Validations
    if (fLabel.includes('pan card') || fLabel.includes('pan no') || fLabel === 'pan') {
      const cleanPan = strValue.toUpperCase().replace(/\s/g, '');
      if (cleanPan.length !== 10) {
        return "PAN Card must be exactly 10 characters.";
      }
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPan)) {
        return "Invalid PAN format. Standard format is 5 letters, 4 digits, 1 letter (e.g., ABCDE1234F).";
      }
    }

    if (fLabel.includes('aadhar') || fLabel.includes('aadhaar')) {
      const cleanAadhaar = strValue.replace(/\s/g, '');
      if (cleanAadhaar.length !== 12) {
        return "Aadhaar Card must be exactly 12 digits.";
      }
      if (!/^[2-9]\d{11}$/.test(cleanAadhaar)) {
        return "Invalid Aadhaar number (must be 12 digits and cannot start with 0 or 1).";
      }
      if (/^(\d)\1{11}$/.test(cleanAadhaar)) {
        return "Invalid Aadhaar number (cannot be all identical digits).";
      }
    }

    if (fLabel.includes('phone') || fLabel.includes('mobile') || fLabel.includes('whatsapp') || fLabel.includes('contact no')) {
      const cleanPhone = strValue.replace(/\D/g, '');
      if (cleanPhone.length !== 10) {
        return "Mobile number must be exactly 10 digits.";
      }
      if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
        return "Invalid mobile number (must start with 6, 7, 8, or 9).";
      }
      if (/^(\d)\1{9}$/.test(cleanPhone)) {
        return "Invalid mobile number (cannot be all identical digits).";
      }
    }

    if (fLabel.includes('uan') || fLabel.includes('epfo')) {
      const cleanUan = strValue.replace(/\s/g, '');
      if (cleanUan.length !== 12) {
        return "UAN number must be exactly 12 digits.";
      }
      if (!/^\d{12}$/.test(cleanUan)) {
        return "UAN number must be numeric (12 digits).";
      }
      if (/^(\d)\1{11}$/.test(cleanUan)) {
        return "Invalid UAN number (cannot be all identical digits).";
      }
    }

    if (fLabel.includes('esic')) {
      const cleanEsic = strValue.replace(/\s/g, '');
      if (cleanEsic.length < 10 || cleanEsic.length > 17) {
        return "ESIC number must be between 10 and 17 digits.";
      }
      if (!/^\d+$/.test(cleanEsic)) {
        return "ESIC number must be numeric.";
      }
      if (/^(\d)\1+$/.test(cleanEsic)) {
        return "Invalid ESIC number (cannot be all identical digits).";
      }
    }

    if (fLabel.includes('ifsc')) {
      const cleanIfsc = strValue.toUpperCase().replace(/\s/g, '');
      if (cleanIfsc.length !== 11) {
        return "IFSC code must be exactly 11 characters.";
      }
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIfsc)) {
        return "Invalid IFSC code format (e.g., SBIN0001234).";
      }
    }

    if (fLabel.includes('account no') || fLabel.includes('bank account')) {
      const cleanAcc = strValue.replace(/\s/g, '');
      if (cleanAcc.length < 8 || cleanAcc.length > 18) {
        return "Bank Account number must be between 8 and 18 digits.";
      }
      if (!/^\d+$/.test(cleanAcc)) {
        return "Bank Account number must be numeric.";
      }
      if (/^0+$/.test(cleanAcc)) {
        return "Bank Account number cannot be all zeros.";
      }
    }

    if (fLabel.includes('pvc number') || fLabel.includes('pvc no')) {
      const cleanPvc = strValue.replace(/\s/g, '');
      if (cleanPvc.length < 8 || cleanPvc.length > 25) {
        return "PVC number must be between 8 and 25 characters.";
      }
      if (/^0+$/.test(cleanPvc)) {
        return "PVC number cannot be all zeros.";
      }
    }

    if (fLabel.includes('pin code') || fLabel.includes('pincode') || fLabel.includes('postal code') || fLabel.includes('zip code')) {
      const cleanPin = strValue.replace(/\s/g, '');
      if (!/^[1-9][0-9]{5}$/.test(cleanPin)) {
        return "Invalid Pincode (must be exactly 6 digits starting with 1-9).";
      }
    }

    if (fLabel.includes('email')) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strValue)) {
        return "Please enter a valid email address.";
      }
    }

    if (fLabel.includes('full name') || fLabel.includes('father') || fLabel.includes('mother') || fLabel.includes('spouse') || fLabel.includes('reference name')) {
      if (!/^[A-Za-z\s.\-']+$/.test(strValue)) {
        return "Name must contain only alphabets, spaces, and dots/hyphens.";
      }
      if (strValue.length < 2) {
        return "Name must be at least 2 characters.";
      }
    }

    if (fLabel.includes('height')) {
      const numVal = Number(strValue);
      if (isNaN(numVal) || numVal <= 0) {
        return "Height must be a valid positive number.";
      }
      if (numVal > 10 && (numVal < 100 || numVal > 250)) {
        return "Height in cm must be between 100 and 250.";
      }
      if (numVal <= 10 && (numVal < 3.5 || numVal > 8.0)) {
        return "Height in feet must be between 3.5 and 8.0.";
      }
    }

    if (fLabel.includes('weight')) {
      const numVal = Number(strValue);
      if (isNaN(numVal) || numVal < 30 || numVal > 200) {
        return "Weight must be between 30 and 200 kg.";
      }
    }

    // 3. Min/Max Length (Text & Textarea)
    if (field.type === FieldType.TEXT || field.type === FieldType.TEXTAREA) {
      if (field.minLength && strValue.length < field.minLength) {
        return `Must be at least ${field.minLength} characters.`;
      }
      if (field.maxLength && strValue.length > field.maxLength) {
        return `Must be at most ${field.maxLength} characters.`;
      }
    }

    // 4. Allowed Pattern Matching
    if (field.allowedPattern && field.allowedPattern !== 'any') {
      let patternString: string = field.allowedPattern;
      const isPhone = fLabel.includes('phone') || fLabel.includes('mobile') || fLabel.includes('whatsapp') || fLabel.includes('contact no');
      const isAadhar = fLabel.includes('aadhar') || fLabel.includes('aadhaar');

      if (patternString === 'alphabets') patternString = '^[A-Za-z\\s]+$';
      else if (patternString === 'numbers') {
        if (isPhone) patternString = '^[6-9][0-9]{9}$';
        else if (isAadhar) patternString = '^[2-9][0-9]{11}$';
        else patternString = '^[0-9\\.]+$';
      } else if (patternString === 'numbers_only') {
        if (isPhone) patternString = '^[6-9][0-9]{9}$';
        else if (isAadhar) patternString = '^[2-9][0-9]{11}$';
        else patternString = '^[0-9]+$';
      } else if (patternString === 'alphanumeric') {
        patternString = '^[A-Za-z0-9\\s]+$';
      } else if (patternString === 'alphanumeric_special') {
        patternString = '^[A-Za-z0-9\\s.,\\-\\/()#&@!:;\'\"]+$';
      }

      try {
        const regex = new RegExp(patternString);
        if (!regex.test(strValue)) {
          if (patternString.includes('^[6-9][0-9]{9}$')) return "Invalid mobile number (must be 10 digits starting with 6-9).";
          if (patternString.includes('^[2-9][0-9]{11}$')) return "Invalid Aadhaar number (must be 12 digits, cannot start with 0 or 1).";
          if (patternString === '^[A-Za-z\\s]+$') return "Only alphabets (A-Z) and spaces are allowed.";
          if (patternString === '^[0-9]+$') return "Only numbers are allowed.";
          if (patternString === '^[0-9\\.]+$') return "Only numbers and decimals are allowed.";
          return "Invalid format.";
        }
      } catch (e) {
        console.error("Invalid regex pattern:", patternString);
      }
    }

    // 5. Date Field & Age Validations
    if (field.type === FieldType.DATE && value) {
      const parsedDate = new Date(value);
      if (isNaN(parsedDate.getTime())) {
        return "Invalid date format.";
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const isDob = fLabel.includes('birth') || fLabel.includes('dob');
      if (isDob) {
        if (parsedDate >= today) {
          return "Date of Birth cannot be today or a future date.";
        }
        let age = today.getFullYear() - parsedDate.getFullYear();
        const m = today.getMonth() - parsedDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < parsedDate.getDate())) {
          age--;
        }
        const minAge = field.minAge || 18;
        if (age < minAge) {
          return `Minimum age required is ${minAge} years (Calculated age: ${age} years).`;
        }
        if (age > 75) {
          return "Please enter a valid Date of Birth.";
        }
      }
    }

    // 6. File Upload Validations
    if (field.type === FieldType.FILE_UPLOAD && value) {
      const maxMB = field.maxFileSizeMB || 5;
      if (value instanceof File) {
        const isImage = value.type.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(value.name);
        const isPdf = value.type === 'application/pdf' || /\.pdf$/i.test(value.name);
        if (!isImage && !isPdf) {
          return "Only JPG, PNG, WEBP images and PDF documents are allowed.";
        }
        const fileSizeMB = value.size / (1024 * 1024);
        if (fileSizeMB > maxMB && !isImage) {
          return `File size must be less than ${maxMB}MB.`;
        }
      }
    }

    return null;
  }, [isFieldVisible]);

  // 6. Handle Form Values Changes with Instant Real-Time Validation While Typing
  const handleFieldChange = useCallback((fieldId: string, value: any) => {
    setFormData(prev => {
      const updated = { ...prev, [fieldId]: value };

      const siteField = sections
        .flatMap(s => s.fields || [])
        .find(f => f && f.label && (f.label.toLowerCase().includes('unit') || f.label.toLowerCase().includes('facility')));

      const designationField = sections
        .flatMap(s => s.fields || [])
        .find(f => f && f.label && f.label.toLowerCase().includes('designation'));

      if (siteField && fieldId === siteField.id && designationField) {
        let activeSite = sites.find(s => s.name === value || s.id === value);
        if (!activeSite) {
          activeSite = defaultSites.find(s => s.name === value || s.id === value);
        }
        const allowedDesignations = activeSite?.allowedDesignations || [];
        const currentDesignation = prev[designationField.id];

        if (currentDesignation && allowedDesignations.length > 0 && !allowedDesignations.includes(currentDesignation)) {
          updated[designationField.id] = '';
        }
      }

      return updated;
    });

    // Instant Real-time Live Validation (While Typing)
    const field = findFieldDefinition(fieldId);
    if (field) {
      const err = validateSingleField(field, value);
      setFormErrors(prev => {
        const copy = { ...prev };
        if (err) {
          copy[fieldId] = err;
        } else {
          delete copy[fieldId];
        }
        return copy;
      });
    }
  }, [findFieldDefinition, validateSingleField, sections, sites]);

  // 7. Validate and Submit Responses
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !requestDoc) return;

    // Validation
    const errors: Record<string, string> = {};
    requestDoc.requestedFields.forEach(fieldId => {
      const field = findFieldDefinition(fieldId);
      if (field) {
        const val = formData[fieldId];
        const err = validateSingleField(field, val);
        if (err) {
          errors[fieldId] = err;
        }
      }
    });

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      // Scroll to first error
      const firstErrorId = Object.keys(errors)[0];
      document.getElementById(firstErrorId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setSubmitting(true);
    setSubmitProgress({});

    try {
      await submitCorrectionResponse(token, formData, (fieldId, status, percent) => {
        setSubmitProgress(prev => ({
          ...prev,
          [fieldId]: { status, percent }
        }));
      });

      setSuccess(true);
    } catch (err: any) {
      console.error("Failed to submit corrections:", err);
      alert("Submission failed: " + (err.message || err));
    } finally {
      setSubmitting(false);
    }
  };

  // ────────────────── RENDER LAYOUTS ──────────────────

  if (!initialSignOutDone || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <Loader2 className="animate-spin text-blue-600 mb-3" size={40} />
        <p className="text-gray-600 font-medium">Validating correction request details...</p>
      </div>
    );
  }

  // Error State (Invalid token, expired, completed, wrong auth match)
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl border border-gray-150 p-6 md:p-8 shadow-sm text-center">
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center mx-auto mb-6">
            <AlertTriangle size={24} />
          </div>
          
          <h2 className="text-xl font-bold text-gray-900 mb-2">Request Expired or Invalid</h2>
          <p className="text-sm text-gray-500 mb-6">{error}</p>

          <Button
            type="button"
            onClick={() => navigate('/')}
            variant="secondary"
            className="w-full bg-white border-gray-250 hover:bg-gray-50 text-gray-700 rounded-xl py-2.5 font-semibold shadow-sm flex items-center justify-center gap-2"
          >
            <ArrowLeft size={16} />
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  // Verification Screen for Manual Guests
  if (requestDoc && requestDoc.status === 'pending' && authNeededProvider === null && !guestVerified) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl border border-gray-150 p-6 md:p-8 shadow-sm">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-6">
            <Lock size={24} />
          </div>
          
          <h2 className="text-xl font-bold text-gray-900 mb-2">Onboarding Verification</h2>
          <p className="text-sm text-gray-500 mb-6">
            Please verify your identity using your registered Date of Birth and Mobile Number.
          </p>

          <form onSubmit={handleGuestVerify} className="space-y-5">
            <Input
              label="Date of Birth"
              type="date"
              value={verificationDob}
              onChange={(e) => setVerificationDob(e.target.value)}
              required
            />
            
            <Input
              label="Registered Mobile Number"
              type="tel"
              value={verificationPhone}
              onChange={(e) => setVerificationPhone(e.target.value)}
              placeholder="e.g. 9876543210"
              required
            />

            {verificationError && (
              <div className="p-3.5 bg-red-50 border border-red-100 text-xs text-red-700 font-medium rounded-xl flex items-start gap-2">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <span>{verificationError}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={verifyingGuest}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 flex items-center justify-center gap-2 font-semibold shadow-sm"
            >
              {verifyingGuest ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />}
              Verify Identity
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // Sign In Screens (Google Redirect or Manual Login Prompt)
  if (requestDoc && requestDoc.status === 'pending' && !isIdentityVerified) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl border border-gray-150 p-6 md:p-8 shadow-sm text-center">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mx-auto mb-6">
            <Lock size={24} />
          </div>
          
          <h2 className="text-xl font-bold text-gray-900 mb-2">Authentication Required</h2>
          <p className="text-sm text-gray-500 mb-6">
            This correction link is locked for security. You must log in as **{requestDoc.applicantName}** to access it.
          </p>

          {authNeededProvider === 'google' ? (
            <div className="space-y-4">
              {linkedEmailHint && (
                <div className="p-3 bg-gray-50 text-xs text-gray-600 font-medium rounded-xl border border-gray-100">
                  Must log in with Google Account: <span className="font-semibold">{linkedEmailHint}</span>
                </div>
              )}

              {currentUser && (
                <div className="p-4 bg-red-50 border border-red-150 rounded-2xl text-left text-sm text-red-800 space-y-2 mb-4">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle size={18} className="flex-shrink-0 text-red-500 mt-0.5" />
                    <div>
                      <span className="font-bold block text-red-950">Incorrect Google Account</span>
                      You are currently signed in as <span className="font-mono font-bold">{currentUser.email}</span>. This email does not match the registered Google account for this correction request.
                    </div>
                  </div>
                  <div className="text-xs text-red-700 pl-7">
                    Please log in using your registered email: <span className="font-semibold font-mono">{linkedEmailHint}</span>.
                  </div>
                </div>
              )}

              <Button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 flex items-center justify-center gap-2 font-semibold shadow-sm"
              >
                <LogIn size={18} />
                {currentUser ? "Sign in with different Google account" : "Sign in with Google"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-gray-400">
                Please log in with your Employee ID and password using the portal's main login page.
              </p>
              
              <Button
                type="button"
                onClick={() => navigate('/login?redirect=' + encodeURIComponent('/correct-details' + window.location.search))}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 flex items-center justify-center gap-2 font-semibold shadow-sm"
              >
                <LogIn size={18} />
                Go to Portal Login
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Success State (Form submitted successfully)
  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl border border-gray-150 p-6 md:p-8 shadow-sm text-center">
          <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={24} />
          </div>
          
          <h2 className="text-xl font-bold text-gray-900 mb-2">Corrections Submitted!</h2>
          <p className="text-sm text-gray-500 mb-6">
            Thank you. Your corrected information and documents have been saved successfully. HR will be notified of your changes.
          </p>

          <p className="text-xs text-gray-400 mb-6 italic">
            This secure upload link has now been deactivated.
          </p>

          <Button
            type="button"
            onClick={() => navigate('/')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 font-semibold shadow-sm flex items-center justify-center gap-2"
          >
            Go to Portal Home
          </Button>
        </div>
      </div>
    );
  }

  // Active Correction Form View
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 flex items-center justify-center">
      <div className="w-full max-w-2xl bg-white rounded-3xl border border-gray-150 shadow-sm overflow-hidden">
        
        {/* Header */}
        <div className="p-6 md:p-8 border-b border-gray-100 bg-gradient-to-r from-blue-50/50 to-indigo-50/10">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold px-2.5 py-1 bg-amber-50 border border-amber-100 text-amber-700 rounded-lg flex items-center gap-1.5 animate-pulse">
              <RefreshCw size={12} className="animate-spin" />
              Correction Request Pending
            </span>
            {requestDoc?.expiresAt && (
              <span className="text-[11px] text-gray-400 font-mono">
                Expires: {new Date(requestDoc.expiresAt).toLocaleString()}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">HR Correction Request</h1>
          <p className="text-sm text-gray-500 mt-1">
            Applicant: <span className="font-semibold text-gray-700">{requestDoc?.applicantName}</span>
          </p>

          {requestDoc?.fieldReasons?.general && (
            <div className="mt-5 p-4 bg-amber-50/50 border border-amber-100 text-sm text-amber-800 rounded-2xl flex items-start gap-2.5">
              <Info size={18} className="flex-shrink-0 text-amber-600 mt-0.5" />
              <div>
                <span className="font-bold block mb-0.5">Note from HR Manager:</span>
                {requestDoc.fieldReasons.general}
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Inputs Form */}
        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-8">
          {requestDoc?.requestedFields.map(fieldId => {
            const field = findFieldDefinition(fieldId);
            if (!field) return null;
            if (!isFieldVisible(field)) return null;

            const errorMsg = formErrors[fieldId];
            const reason = requestDoc.fieldReasons[fieldId];
            const progress = submitProgress[fieldId];
            const val = formData[fieldId];

            return (
              <div key={fieldId} id={fieldId} className="p-5 border border-gray-100 rounded-2xl bg-gray-50/20 relative">
                {/* Admin Flag Reason Banner */}
                {reason && (
                  <div className="mb-4 bg-red-50/80 border border-red-100 p-3.5 rounded-xl text-xs text-red-800 flex items-start gap-2.5">
                    <AlertTriangle size={15} className="flex-shrink-0 text-red-500 mt-0.5" />
                    <div>
                      <span className="font-bold block mb-0.5">Admin Request:</span>
                      {reason}
                    </div>
                  </div>
                )}

                {/* Render specific field uploader/inputs */}
                {field.type === FieldType.TEXT && (
                  <EmployeeTextField
                    field={field}
                    value={val}
                    onChange={handleFieldChange}
                    error={errorMsg}
                    disabled={submitting}
                  />
                )}

                {field.type === FieldType.TEXTAREA && (
                  <EmployeeTextareaField
                    field={field}
                    value={val}
                    onChange={handleFieldChange}
                    error={errorMsg}
                    disabled={submitting}
                  />
                )}

                {field.type === FieldType.DROPDOWN && (() => {
                  let customField = field;
                  const originalFields = targetData?.formData || targetData?.profileData || targetData?.data || {};

                  if (field.parentFieldId && field.optionsMap) {
                    const parentValue = formData[field.parentFieldId] !== undefined ? formData[field.parentFieldId] : originalFields[field.parentFieldId];
                    const matchedSite = sites.find(s => s.id === parentValue || s.name === parentValue);
                    const mappedOptions = field.optionsMap[parentValue] ||
                      (matchedSite ? (field.optionsMap[matchedSite.name] || field.optionsMap[matchedSite.id]) : undefined);
                    if (mappedOptions && mappedOptions.length > 0) {
                      customField = { ...field, options: mappedOptions };
                    }
                  } else if (field.label?.toLowerCase().includes('designation')) {
                    const siteField = sections
                      .flatMap(s => s.fields || [])
                      .find(f => f && f.label && (f.label.toLowerCase().includes('unit') || f.label.toLowerCase().includes('facility')));
                    const selectedSite = (siteField && formData[siteField.id]) || (siteField && originalFields[siteField.id]) || undefined;
                    let activeSite = sites.find(s => s.name === selectedSite || s.id === selectedSite);
                    if (!activeSite) {
                      activeSite = defaultSites.find(s => s.name === selectedSite || s.id === selectedSite);
                    }
                    const masterOptions = portalConfig?.designations && portalConfig.designations.length > 0
                      ? portalConfig.designations
                      : (field.options || []);

                    let allowedOptions = masterOptions;
                    if (field.optionsMap && activeSite) {
                      const siteMap = field.optionsMap[activeSite.name] || field.optionsMap[activeSite.id];
                      if (siteMap && siteMap.length > 0) {
                        allowedOptions = siteMap;
                      }
                    } else if (activeSite && activeSite.allowedDesignations && activeSite.allowedDesignations.length > 0) {
                      allowedOptions = masterOptions.filter((opt: string) => activeSite.allowedDesignations?.includes(opt));
                    }

                    customField = { ...field, options: allowedOptions };
                  }
                  return (
                    <EmployeeDropdownField
                      field={customField}
                      value={val}
                      onChange={handleFieldChange}
                      error={errorMsg}
                      disabled={submitting}
                    />
                  );
                })()}

                {field.type === FieldType.DATE && (
                  <EmployeeDateField
                    field={field}
                    value={val}
                    onChange={handleFieldChange}
                    error={errorMsg}
                    disabled={submitting}
                  />
                )}

                {field.type === FieldType.CHECKBOX && (
                  <EmployeeCheckboxField
                    field={field}
                    value={val}
                    onChange={handleFieldChange}
                    error={errorMsg}
                    disabled={submitting}
                  />
                )}

                {field.type === FieldType.RADIO && (
                  <EmployeeRadioField
                    field={field}
                    value={val}
                    onChange={handleFieldChange}
                    error={errorMsg}
                    disabled={submitting}
                  />
                )}

                {field.type === FieldType.FILE_UPLOAD && (
                  <EmployeeFileUploadField
                    field={field}
                    value={val}
                    onChange={handleFieldChange}
                    error={errorMsg}
                    disabled={submitting}
                  />
                )}

                {/* Explicit Field Validation Error Banner */}
                {errorMsg && (
                  <div className="mt-3 p-2.5 bg-red-50/90 border border-red-200 rounded-xl text-xs font-semibold text-red-700 flex items-center gap-2 animate-in fade-in">
                    <AlertCircle size={15} className="shrink-0 text-red-500" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Progress bar overlay during submission */}
                {progress && progress.status === 'loading' && (
                  <div className="absolute inset-0 bg-white/80 rounded-2xl flex flex-col items-center justify-center p-4">
                    <Loader2 className="animate-spin text-blue-500 mb-2" size={24} />
                    <span className="text-xs font-semibold text-gray-700">Syncing file...</span>
                    {progress.percent !== undefined && (
                      <span className="text-[10px] text-blue-600 font-mono mt-0.5">{progress.percent}%</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Submit Actions */}
          <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row gap-3">
            <Button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 flex items-center justify-center gap-2 font-semibold shadow-sm"
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Submitting Changes...
                </>
              ) : (
                <>
                  <CheckCircle size={18} />
                  Submit Corrected Details
                </>
              )}
            </Button>
            
            <Button
              type="button"
              onClick={() => navigate('/')}
              variant="secondary"
              disabled={submitting}
              className="bg-white border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl py-3 px-6 shadow-sm"
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DataCorrectionPage;

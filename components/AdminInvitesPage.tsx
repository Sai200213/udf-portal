import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  doc, 
  addDoc, 
  updateDoc, 
  serverTimestamp, 
  setDoc,
  getDocs,
  limit
} from 'firebase/firestore';
import { db, auth } from '../src/firebase/config';
import { 
  ReferralInvite, 
  Site, 
  FormSection, 
  PortalConfig, 
  Permission, 
  User, 
  Role,
  SubmittedFormData
} from '../types';
import Button from './common/Button';
import Input from './common/Input';
import Modal from './common/Modal';
import { 
  Link2, 
  Copy, 
  Share2, 
  Plus, 
  Calendar, 
  ShieldAlert, 
  CheckCircle2, 
  RefreshCw, 
  Trash2, 
  ShieldCheck, 
  X, 
  Search, 
  Filter, 
  Settings, 
  FileText, 
  UserPlus, 
  Users, 
  Info, 
  MapPin, 
  Briefcase, 
  ChevronRight,
  MessageSquare,
  AlertCircle,
  Eye,
  Check,
  Lock,
  Unlock,
  Edit,
  Loader2
} from 'lucide-react';
import log from '../src/utils/logger';
import { logSystemAction } from '../src/services/auditService';

interface AdminInvitesPageProps {
  authUser: User | null;
  isSuperAdmin: boolean;
  userRole?: Role;
  sites: Site[];
  formSections: FormSection[];
  portalConfig: PortalConfig;
  setPortalConfig: React.Dispatch<React.SetStateAction<PortalConfig>>;
}

export const AdminInvitesPage: React.FC<AdminInvitesPageProps> = ({
  authUser,
  isSuperAdmin,
  userRole,
  sites,
  formSections,
  portalConfig,
  setPortalConfig
}) => {
  const [activeTab, setActiveTabState] = useState<'GENERATE' | 'TRACKER' | 'CANDIDATES'>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const sub = params.get('subtab')?.toUpperCase();
      if (sub === 'GENERATE' || sub === 'TRACKER' || sub === 'CANDIDATES') return sub;
      const saved = sessionStorage.getItem('adminInvitesActiveTab');
      if (saved === 'GENERATE' || saved === 'TRACKER' || saved === 'CANDIDATES') return saved;
    } catch (e) {}
    return 'TRACKER';
  });

  const setActiveTab = (tab: 'GENERATE' | 'TRACKER' | 'CANDIDATES') => {
    try {
      sessionStorage.setItem('adminInvitesActiveTab', tab);
      const url = new URL(window.location.href);
      url.searchParams.set('subtab', tab.toLowerCase());
      window.history.replaceState({}, '', url.toString());
    } catch (e) {}
    setActiveTabState(tab);
  };
  
  // State for invite generation
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [designation, setDesignation] = useState('');
  const [phoneNumberLock, setPhoneNumberLock] = useState(false);
  const [lockedPhoneNumber, setLockedPhoneNumber] = useState('');
  const [hasExpiry, setHasExpiry] = useState(false);
  const [expiryDays, setExpiryDays] = useState('7');
  const [customExpiryDate, setCustomExpiryDate] = useState('');
  const [prefillValues, setPrefillValues] = useState<Record<string, any>>({});
  const [lockPrefilledFields, setLockPrefilledFields] = useState(true);
  
  // Generated Link Output
  const [generatedInvite, setGeneratedInvite] = useState<ReferralInvite | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  
  // Database State
  const [invites, setInvites] = useState<ReferralInvite[]>([]);
  const [referredEmployees, setReferredEmployees] = useState<any[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  
  // Tracker Filtering & Searching
  const [trackerSearch, setTrackerSearch] = useState('');
  const [trackerSiteFilter, setTrackerSiteFilter] = useState('ALL');
  const [trackerStaffFilter, setTrackerStaffFilter] = useState('ALL');
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Edit Invite States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [inviteToEdit, setInviteToEdit] = useState<ReferralInvite | null>(null);
  const [editSiteId, setEditSiteId] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editPhoneLock, setEditPhoneLock] = useState(false);
  const [editLockedPhone, setEditLockedPhone] = useState('');
  const [editHasExpiry, setEditHasExpiry] = useState(false);
  const [editExpiryDays, setEditExpiryDays] = useState('7');
  const [editCustomExpiryDate, setEditCustomExpiryDate] = useState('');
  const [editPrefillValues, setEditPrefillValues] = useState<Record<string, any>>({});
  const [editLockPrefilled, setEditLockPrefilled] = useState(true);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Reusable Link States
  const [isReusable, setIsReusable] = useState(false);
  const [editIsReusable, setEditIsReusable] = useState(false);

  // Reactivation Modal States
  const [isReactivateModalOpen, setIsReactivateModalOpen] = useState(false);
  const [inviteToReactivate, setInviteToReactivate] = useState<ReferralInvite | null>(null);
  const [reactivateExpiryDays, setReactivateExpiryDays] = useState('7');
  const [reactivateCustomExpiryDate, setReactivateCustomExpiryDate] = useState('');
  const [isSavingReactivation, setIsSavingReactivation] = useState(false);

  // WhatsApp Share Modal States
  const [isWhatsAppShareModalOpen, setIsWhatsAppShareModalOpen] = useState(false);
  const [whatsAppTargetNumber, setWhatsAppTargetNumber] = useState('');
  const [inviteToShareWhatsApp, setInviteToShareWhatsApp] = useState<ReferralInvite | null>(null);
  
  // Candidates Filtering & Searching
  const [candidateSearch, setCandidateSearch] = useState('');
  const [candidateSiteFilter, setCandidateSiteFilter] = useState('ALL');
  const [candidateStatusFilter, setCandidateStatusFilter] = useState('ALL');

  // Check Permissions
  const hasPermission = (p: Permission) => isSuperAdmin || userRole?.permissions.includes(p) || false;
  const canManageSettings = hasPermission(Permission.INVITES_MANAGE);
  const canCreateInvites = hasPermission(Permission.INVITES_CREATE);
  const canViewInvites = hasPermission(Permission.INVITES_VIEW);
  const canEditInvite = isSuperAdmin || canManageSettings;

  // Active sites list
  const activeSites = useMemo(() => sites.filter(s => s.status === 'Active'), [sites]);

  // Common designations list
  const commonDesignations = useMemo(() => {
    if (portalConfig?.designations && portalConfig.designations.length > 0) {
      return portalConfig.designations;
    }
    const jobSection = formSections?.find(s => s.name === "Job Details");
    const designationField = jobSection?.fields.find(f =>
      f.id === 'db307195-cf54-4a6e-9056-f3974b050c4d' ||
      f.label.trim().toLowerCase() === "post of apply" ||
      f.label.trim().toLowerCase() === "designation"
    );
    if (designationField?.options && designationField.options.length > 0) {
      return designationField.options;
    }
    return [
      'Console Operator',
      'Security Officer',
      'Supervisor',
      'Field Officer',
      'Manager',
      'Senior Manager',
      'Executive Officer',
      'Operations Head',
      'Administrator'
    ];
  }, [formSections, portalConfig]);

  // Filter designations list based on selected site
  const siteDesignations = useMemo(() => {
    const selectedSite = sites.find(s => s.id === selectedSiteId);
    if (!selectedSite) return commonDesignations;

    // 1. Check site's specific allowedDesignations first
    if (selectedSite.allowedDesignations && selectedSite.allowedDesignations.length > 0) {
      return selectedSite.allowedDesignations;
    }

    // 2. Fallback: try to read from the Form Builder's designation field optionsMap
    const jobSection = formSections?.find(s => s.name === "Job Details");
    const designationField = jobSection?.fields.find(f =>
      f.id === 'db307195-cf54-4a6e-9056-f3974b050c4d' ||
      f.label.trim().toLowerCase() === "post of apply" ||
      f.label.trim().toLowerCase() === "designation"
    );

    if (designationField?.optionsMap) {
      const mapped = designationField.optionsMap[selectedSite.name];
      if (mapped && mapped.length > 0) {
        return mapped;
      }
    }

    return commonDesignations;
  }, [selectedSiteId, sites, formSections, commonDesignations]);

  // Filter designations list based on selected site for editing
  const editSiteDesignations = useMemo(() => {
    const selectedSite = sites.find(s => s.id === editSiteId);
    if (!selectedSite) return commonDesignations;

    if (selectedSite.allowedDesignations && selectedSite.allowedDesignations.length > 0) {
      return selectedSite.allowedDesignations;
    }

    const jobSection = formSections?.find(s => s.name === "Job Details");
    const designationField = jobSection?.fields.find(f =>
      f.id === 'db307195-cf54-4a6e-9056-f3974b050c4d' ||
      f.label.trim().toLowerCase() === "post of apply" ||
      f.label.trim().toLowerCase() === "designation"
    );

    if (designationField?.optionsMap) {
      const mapped = designationField.optionsMap[selectedSite.name];
      if (mapped && mapped.length > 0) {
        return mapped;
      }
    }

    return commonDesignations;
  }, [editSiteId, sites, formSections, commonDesignations]);

  // Retrieve flat form fields for Settings & Prefills
  const allFormFields = useMemo(() => {
    return formSections
      .flatMap(s => s.fields || [])
      .filter(f => f.type !== 'Section Header' && f.type !== 'Information Text' && f.type !== 'File Upload' && f.id !== 'siteName');
  }, [formSections]);

  // Determine allowed prefill field IDs for the current staff member
  const allowedPrefillFieldIds = useMemo(() => {
    if (isSuperAdmin) return null; // Super Admin has access to all fields

    // Check user-level overrides first
    if (authUser && (authUser as any).allowedPrefillFieldIds) {
      return (authUser as any).allowedPrefillFieldIds as string[];
    }

    // Fallback to role-level defaults
    if (userRole && userRole.allowedPrefillFieldIds) {
      return userRole.allowedPrefillFieldIds;
    }

    return [];
  }, [authUser, userRole, isSuperAdmin]);

  const visiblePrefillFields = useMemo(() => {
    if (allowedPrefillFieldIds === null) return allFormFields;
    return allFormFields.filter(f => allowedPrefillFieldIds.includes(f.id));
  }, [allFormFields, allowedPrefillFieldIds]);

  // Listen to Referral Invites
  useEffect(() => {
    if (!authUser || !canViewInvites) return;

    setLoadingInvites(true);
    let qRef = query(collection(db, 'referral_invites'));
    
    // Non-superadmins only see their own referral links
    if (!isSuperAdmin) {
      const creatorUid = auth.currentUser?.uid || authUser.id;
      qRef = query(collection(db, 'referral_invites'), where('createdBy', '==', creatorUid));
    }

    const unsubscribe = onSnapshot(qRef, (snapshot) => {
      const invitesList: ReferralInvite[] = [];
      snapshot.forEach((docSnap) => {
        invitesList.push({
          id: docSnap.id,
          ...docSnap.data()
        } as ReferralInvite);
      });
      // Sort by newest first
      invitesList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setInvites(invitesList);
      setLoadingInvites(false);
    }, (err) => {
      log.error('Error fetching referral invites:', err);
      setLoadingInvites(false);
    });

    return () => unsubscribe();
  }, [authUser, isSuperAdmin, userRole]);

  // Listen to Referred Employees and Submissions
  useEffect(() => {
    if (!authUser || !canViewInvites) return;

    setLoadingEmployees(true);
    let qEmp;
    let qSub;
    if (isSuperAdmin || hasPermission(Permission.INVITES_VIEW_ALL) || hasPermission(Permission.INVITES_MANAGE)) {
      // Avoid compound inequality query crashes; query directly and filter in memory
      qEmp = query(collection(db, 'employees'), limit(500));
      qSub = query(collection(db, 'onboarding_submissions'), limit(500));
    } else {
      const creatorId = auth.currentUser?.uid || authUser.id;
      const targetRecruiterIds = Array.from(new Set([authUser.id, creatorId, (authUser as any)?.username])).filter(Boolean);
      // Clean equality-only query requiring no composite index
      qEmp = query(collection(db, 'employees'), where('recruitedBy', 'in', targetRecruiterIds.slice(0, 10)), limit(500));
      qSub = query(collection(db, 'onboarding_submissions'), where('recruitedBy', 'in', targetRecruiterIds.slice(0, 10)), limit(500));
    }

    let latestEmployees: any[] = [];
    let latestSubmissions: any[] = [];

    const mergeCandidates = () => {
      const combined: any[] = [];
      const seenIds = new Set<string>();

      // 1. Add approved employees first
      for (const emp of latestEmployees) {
        combined.push(emp);
        seenIds.add(emp.id);
        if (emp.portalId) seenIds.add(emp.portalId);
        if (emp.employeeId) seenIds.add(emp.employeeId);
        if (emp.submissionId) seenIds.add(emp.submissionId);
      }

      // 2. Add pending onboarding submissions that aren't approved into employees
      for (const sub of latestSubmissions) {
        if (!seenIds.has(sub.id) && !seenIds.has(sub.employeeId) && !seenIds.has(sub.portalId)) {
          combined.push({
            ...sub,
            isActive: sub.status === 'Approved'
          });
        }
      }

      setReferredEmployees(combined);
      setLoadingEmployees(false);
    };

    const unsubEmp = onSnapshot(qEmp, (snapshot) => {
      const employeesList: any[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const hasInvite = Boolean(data.inviteId);
        
        if (!isSuperAdmin && !hasPermission(Permission.INVITES_VIEW_ALL) && !hasPermission(Permission.INVITES_MANAGE)) {
          const creatorId = auth.currentUser?.uid || authUser.id;
          const isMine = data.recruitedBy === authUser.id || 
                         data.recruitedBy === creatorId || 
                         data.recruitedBy === (authUser as any)?.username ||
                         (hasInvite && (data.inviteCreatedBy === authUser.id || data.inviteCreatedBy === creatorId));
          if (isMine) {
            employeesList.push({ id: docSnap.id, ...data });
          }
        } else {
          if (hasInvite || data.recruitedBy) {
            employeesList.push({ id: docSnap.id, ...data });
          }
        }
      });
      latestEmployees = employeesList;
      mergeCandidates();
    }, (err) => {
      log.error('Error fetching referred employees:', err);
      setLoadingEmployees(false);
    });

    const unsubSub = onSnapshot(qSub, (snapshot) => {
      const submissionsList: any[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const hasInvite = Boolean(data.inviteId);
        
        if (!isSuperAdmin && !hasPermission(Permission.INVITES_VIEW_ALL) && !hasPermission(Permission.INVITES_MANAGE)) {
          const creatorId = auth.currentUser?.uid || authUser.id;
          const isMine = data.recruitedBy === authUser.id || 
                         data.recruitedBy === creatorId || 
                         data.recruitedBy === (authUser as any)?.username ||
                         (hasInvite && (data.inviteCreatedBy === authUser.id || data.inviteCreatedBy === creatorId));
          if (isMine) {
            submissionsList.push({ id: docSnap.id, ...data });
          }
        } else {
          if (hasInvite || data.recruitedBy) {
            submissionsList.push({ id: docSnap.id, ...data });
          }
        }
      });
      latestSubmissions = submissionsList;
      mergeCandidates();
    }, (err) => {
      log.error('Error fetching referred submissions:', err);
      setLoadingEmployees(false);
    });

    return () => {
      unsubEmp();
      unsubSub();
    };
  }, [authUser, isSuperAdmin, userRole]);

  // Generate Invite URL helper (points to candidate main site domain)
  const getInviteUrl = (inviteId: string) => {
    const hostname = window.location.hostname;
    let baseOrigin = window.location.origin;

    if (hostname === 'admin.udfonline.in' || hostname.includes('admin.udfonline.in')) {
      baseOrigin = 'https://udfonline.in';
    } else if (hostname.endsWith('-admin.web.app')) {
      baseOrigin = window.location.origin.replace('-admin.web.app', '.web.app');
    } else if (hostname.endsWith('-admin.firebaseapp.com')) {
      baseOrigin = window.location.origin.replace('-admin.firebaseapp.com', '.firebaseapp.com');
    }

    return `${baseOrigin}/join?ref=${inviteId}`;
  };

  // Generate referral invitation link
  const handleGenerateInvite = async () => {
    if (!authUser) return;
    if (!isSuperAdmin && !hasPermission(Permission.INVITES_CREATE)) {
      alert('You do not have permission to generate referral links.');
      return;
    }
    if (!selectedSiteId) {
      alert('Please select a site.');
      return;
    }
    if (!designation) {
      alert('Please enter or select a designation.');
      return;
    }
    if (!isReusable && phoneNumberLock && !lockedPhoneNumber) {
      alert('Please enter a phone number to lock.');
      return;
    }

    const targetSite = sites.find(s => s.id === selectedSiteId);
    const siteName = targetSite ? targetSite.name : 'Unknown Site';

    // Calculate expiry
    let expiresAt: string | null = null;
    if (!isReusable && hasExpiry) {
      if (expiryDays === 'custom' && customExpiryDate) {
        expiresAt = new Date(customExpiryDate).toISOString();
      } else {
        const days = parseInt(expiryDays, 10) || 7;
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + days);
        expiresAt = expiryDate.toISOString();
      }
    }

    // Auto generate UUID for the invite link
    const inviteId = doc(collection(db, 'referral_invites')).id;

    const newInvite: Omit<ReferralInvite, 'id'> = {
      createdBy: auth.currentUser?.uid || authUser.id,
      createdByName: authUser.name || authUser.id,
      createdAt: new Date().toISOString(),
      expiresAt: isReusable ? null : (hasPermission(Permission.INVITES_SET_EXPIRY) ? expiresAt : null),
      siteId: selectedSiteId,
      siteName,
      designation,
      phoneNumberLock: isReusable ? false : (hasPermission(Permission.INVITES_LOCK_PHONE) ? phoneNumberLock : false),
      prefillFields: hasPermission(Permission.INVITES_PREFILL_FIELDS) ? prefillValues : {},
      lockPrefilledFields: hasPermission(Permission.INVITES_LOCK_PREFILLED) ? lockPrefilledFields : false,
      clicks: 0,
      started: 0,
      joined: 0,
      status: 'Active',
      isReusable: isReusable
    };

    if (!isReusable && hasPermission(Permission.INVITES_LOCK_PHONE) && phoneNumberLock && lockedPhoneNumber) {
      (newInvite as any).lockedPhoneNumber = lockedPhoneNumber;
    }

    try {
      await setDoc(doc(db, 'referral_invites', inviteId), newInvite);
      const generated: ReferralInvite = { id: inviteId, ...newInvite };
      setGeneratedInvite(generated);
      setShowInviteModal(true);
      await logSystemAction('CREATE', 'INVITES', `Generated ${newInvite.isReusable ? 'reusable' : 'single-use'} referral link for "${newInvite.siteName}" (${newInvite.designation})`);
      
      // Reset input form values
      setSelectedSiteId('');
      setDesignation('');
      setPhoneNumberLock(false);
      setLockedPhoneNumber('');
      setHasExpiry(false);
      setPrefillValues({});
      setLockPrefilledFields(true);
      setIsReusable(false);
    } catch (err) {
      log.error('Error creating referral invite:', err);
      alert('Failed to generate referral link. Please try again.');
    }
  };

  // Copy invitation link to clipboard
  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Share link to WhatsApp helper
  const handleShareToWhatsApp = (invite: ReferralInvite) => {
    // If the invite has a locked phone number, direct to WhatsApp chat instantly
    if (invite.phoneNumberLock && invite.lockedPhoneNumber) {
      executeWhatsAppShare(invite, invite.lockedPhoneNumber);
    } else {
      // Open styled modal to ask for direct target number
      setInviteToShareWhatsApp(invite);
      setWhatsAppTargetNumber('');
      setIsWhatsAppShareModalOpen(true);
    }
  };

  // Execute actual WhatsApp redirect
  const executeWhatsAppShare = (invite: ReferralInvite, phoneNum?: string) => {
    const link = getInviteUrl(invite.id);
    const message = `Hello! You have been invited to complete your onboarding form for Unique Delta Force at *${invite.siteName}* as a *${invite.designation}*.\n\nPlease click the link below to securely submit your details:\n${link}`;
    const encodedText = encodeURIComponent(message);
    
    if (phoneNum) {
      const cleaned = phoneNum.replace(/\D/g, '');
      const formattedPhone = cleaned.length === 10 ? `91${cleaned}` : cleaned;
      window.open(`https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`, '_blank');
    } else {
      window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank');
    }
  };

  // Reactivate / Extend Expiry actions
  const openReactivateModal = (invite: ReferralInvite) => {
    setInviteToReactivate(invite);
    setReactivateExpiryDays('7');
    setReactivateCustomExpiryDate('');
    setIsReactivateModalOpen(true);
  };

  const handleSaveReactivation = async () => {
    if (!inviteToReactivate) return;
    if (!isSuperAdmin && !hasPermission(Permission.INVITES_REACTIVATE)) {
      alert('You do not have permission to reactivate invites.');
      return;
    }
    setIsSavingReactivation(true);

    let expiresAt: string | null = null;
    if (reactivateExpiryDays === 'custom' && reactivateCustomExpiryDate) {
      expiresAt = new Date(reactivateCustomExpiryDate).toISOString();
    } else {
      const days = parseInt(reactivateExpiryDays, 10) || 7;
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + days);
      expiresAt = expiryDate.toISOString();
    }

    try {
      await updateDoc(doc(db, 'referral_invites', inviteToReactivate.id), {
        status: 'Active',
        expiresAt: expiresAt,
        ...((!inviteToReactivate.isReusable && (inviteToReactivate.joined || 0) >= 1) ? { joined: 0 } : {})
      });
      await logSystemAction('STATUS_CHANGE', 'INVITES', `Reactivated referral invite link ${inviteToReactivate.id} (${inviteToReactivate.siteName})`);
      setIsReactivateModalOpen(false);
      setInviteToReactivate(null);
    } catch (err) {
      log.error('Error reactivating invite:', err);
      alert('Failed to reactivate referral link. Please try again.');
    } finally {
      setIsSavingReactivation(false);
    }
  };

  // Revoke invitation link
  const handleRevokeInvite = async (inviteId: string) => {
    if (!isSuperAdmin && !hasPermission(Permission.INVITES_DELETE)) {
      alert('You do not have permission to revoke invites.');
      return;
    }
    try {
      await updateDoc(doc(db, 'referral_invites', inviteId), {
        status: 'Revoked'
      });
      await logSystemAction('DELETE', 'INVITES', `Revoked referral invite link ${inviteId}`);
      setRevokingId(null);
    } catch (err) {
      log.error('Error revoking invite:', err);
      alert('Failed to revoke referral link. Please try again.');
    }
  };

  // Edit Referral Invite Actions
  const openEditModal = (invite: ReferralInvite) => {
    setInviteToEdit(invite);
    setEditSiteId(invite.siteId);
    setEditDesignation(invite.designation);
    setEditPhoneLock(invite.phoneNumberLock || false);
    setEditLockedPhone(invite.lockedPhoneNumber || '');
    setEditIsReusable(invite.isReusable || false);
    
    if (invite.expiresAt) {
      setEditHasExpiry(true);
      setEditExpiryDays('custom');
      const date = new Date(invite.expiresAt);
      const tzoffset = date.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(date.getTime() - tzoffset)).toISOString().slice(0, 16);
      setEditCustomExpiryDate(localISOTime);
    } else {
      setEditHasExpiry(false);
      setEditExpiryDays('7');
      setEditCustomExpiryDate('');
    }
    
    setEditPrefillValues(invite.prefillFields || {});
    setEditLockPrefilled(invite.lockPrefilledFields !== false);
    setIsEditModalOpen(true);
  };

  const handleSaveEditInvite = async () => {
    if (!inviteToEdit) return;
    if (!isSuperAdmin && !hasPermission(Permission.INVITES_EDIT)) {
      alert('You do not have permission to edit invites.');
      return;
    }
    if (!editSiteId) {
      alert('Please select a site.');
      return;
    }
    if (!editDesignation) {
      alert('Please enter or select a designation.');
      return;
    }
    if (!editIsReusable && editPhoneLock && !editLockedPhone) {
      alert('Please enter a phone number to lock.');
      return;
    }

    setIsSavingEdit(true);

    const targetSite = sites.find(s => s.id === editSiteId);
    const siteName = targetSite ? targetSite.name : 'Unknown Site';

    let expiresAt: string | null = null;
    if (!editIsReusable && editHasExpiry) {
      if (editExpiryDays === 'custom' && editCustomExpiryDate) {
        expiresAt = new Date(editCustomExpiryDate).toISOString();
      } else {
        const days = parseInt(editExpiryDays, 10) || 7;
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + days);
        expiresAt = expiryDate.toISOString();
      }
    }

    const updatedData: Partial<ReferralInvite> = {
      siteId: editSiteId,
      siteName,
      designation: editDesignation,
      phoneNumberLock: editIsReusable ? false : (hasPermission(Permission.INVITES_LOCK_PHONE) ? editPhoneLock : false),
      prefillFields: hasPermission(Permission.INVITES_PREFILL_FIELDS) ? editPrefillValues : {},
      lockPrefilledFields: hasPermission(Permission.INVITES_LOCK_PREFILLED) ? editLockPrefilled : false,
      expiresAt: editIsReusable ? null : (hasPermission(Permission.INVITES_SET_EXPIRY) ? expiresAt : null),
      isReusable: editIsReusable
    };

    if (!editIsReusable && hasPermission(Permission.INVITES_LOCK_PHONE) && editPhoneLock && editLockedPhone) {
      (updatedData as any).lockedPhoneNumber = editLockedPhone;
    } else {
      (updatedData as any).lockedPhoneNumber = null;
    }

    try {
      await updateDoc(doc(db, 'referral_invites', inviteToEdit.id), updatedData);
      await logSystemAction('UPDATE', 'INVITES', `Updated referral invite configuration for ${inviteToEdit.id} (${siteName})`);
      setIsEditModalOpen(false);
      setInviteToEdit(null);
    } catch (err) {
      log.error('Error saving updated invite:', err);
      alert('Failed to update referral link. Please try again.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Filtered lists
  const filteredInvites = useMemo(() => {
    return invites.filter(invite => {
      // Search term match
      const matchesSearch = invite.siteName.toLowerCase().includes(trackerSearch.toLowerCase()) ||
                            invite.designation.toLowerCase().includes(trackerSearch.toLowerCase()) ||
                            invite.createdByName.toLowerCase().includes(trackerSearch.toLowerCase()) ||
                            invite.id.includes(trackerSearch);
      
      // Site filter match
      const matchesSite = trackerSiteFilter === 'ALL' || invite.siteId === trackerSiteFilter;

      // Staff filter match
      const matchesStaff = trackerStaffFilter === 'ALL' || invite.createdBy === trackerStaffFilter;

      return matchesSearch && matchesSite && matchesStaff;
    });
  }, [invites, trackerSearch, trackerSiteFilter, trackerStaffFilter]);

  const uniqueStaffCreators = useMemo(() => {
    const map = new Map<string, string>();
    invites.forEach(inv => {
      map.set(inv.createdBy, inv.createdByName);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [invites]);

  const filteredCandidates = useMemo(() => {
    return referredEmployees.filter(candidate => {
      // Candidate details
      const profile = candidate.profileData || candidate.formData || {};
      const name = candidate.applicantName || profile['7debf274-baee-4bac-a137-4b4b46719874'] || 'Unknown Applicant';
      const designationVal = candidate.designation || profile['db307195-cf54-4a6e-9056-f3974b050c4d'] || 'N/A';
      
      const matchesSearch = name.toLowerCase().includes(candidateSearch.toLowerCase()) ||
                            designationVal.toLowerCase().includes(candidateSearch.toLowerCase()) ||
                            (candidate.recruitedByName || '').toLowerCase().includes(candidateSearch.toLowerCase());

      const siteIdVal = candidate.currentSiteId || candidate.siteId || profile.siteId;
      const matchesSite = candidateSiteFilter === 'ALL' || siteIdVal === candidateSiteFilter;
      
      const isActive = candidate.isActive;
      const status = isActive ? 'Approved' : 'Pending';
      const matchesStatus = candidateStatusFilter === 'ALL' || status === candidateStatusFilter;

      return matchesSearch && matchesSite && matchesStatus;
    });
  }, [referredEmployees, candidateSearch, candidateSiteFilter, candidateStatusFilter]);

  return (
    <div className="p-1 sm:p-6 max-w-7xl mx-auto">
      {/* Upper header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-3xl font-black text-gray-800 tracking-tight uppercase flex items-center">
            <Link2 className="mr-3 text-emerald-600" size={32} /> Recruitment & Referral Invites
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Generate and manage custom onboarding links for new candidates with site and designation pre-fills.
          </p>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex flex-wrap gap-2 mb-8 bg-gray-100/80 p-1.5 rounded-xl border border-gray-200 w-fit">
        {canCreateInvites && (
          <button
            onClick={() => setActiveTab('GENERATE')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all uppercase tracking-wide ${activeTab === 'GENERATE' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}
          >
            <UserPlus size={18} />
            <span>Generate Link</span>
          </button>
        )}
        {canViewInvites && (
          <button
            onClick={() => setActiveTab('TRACKER')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all uppercase tracking-wide ${activeTab === 'TRACKER' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}
          >
            <RefreshCw size={18} />
            <span>Invites Tracker</span>
          </button>
        )}
        {canViewInvites && (
          <button
            onClick={() => setActiveTab('CANDIDATES')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all uppercase tracking-wide ${activeTab === 'CANDIDATES' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}
          >
            <Users size={18} />
            <span>Referred Candidates</span>
            {referredEmployees.length > 0 && (
              <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-800 font-bold">
                {referredEmployees.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* TABS CONTENT */}
      {activeTab === 'GENERATE' && canCreateInvites && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-xl p-6 space-y-6">
            <h2 className="text-xl font-bold text-gray-800 border-b border-gray-100 pb-3 flex items-center">
              <Briefcase className="mr-2 text-emerald-600" size={20} /> Onboarding Details
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-2">Target Deployment Site *</label>
                <select
                  value={selectedSiteId}
                  onChange={(e) => setSelectedSiteId(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-gray-50 hover:bg-gray-100/50 transition-colors"
                >
                  <option value="">Select a Site</option>
                  {activeSites.map(site => (
                    <option key={site.id} value={site.id}>{site.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-2">Candidate Designation *</label>
                <select
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-gray-50 hover:bg-gray-100/50 transition-colors"
                >
                  <option value="">Select a Designation</option>
                  {siteDesignations.map((des, index) => (
                    <option key={index} value={des}>{des}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Reusable Link Toggle */}
            <div className="p-4 bg-gray-50/50 border border-gray-100 rounded-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-start space-x-3">
                <div className="mt-1">
                  <RefreshCw className={isReusable ? "text-emerald-500 animate-spin" : "text-gray-400"} size={20} style={{ animationDuration: '8s' }} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-700">Reusable Link (Multi-use)</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Allow multiple candidates to join using this single, permanent link.</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={isReusable}
                  onChange={() => setIsReusable(!isReusable)}
                  className="h-5 w-5 text-emerald-600 rounded focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Lock Phone Number Section */}
            {!isReusable && hasPermission(Permission.INVITES_LOCK_PHONE) && (
              <div className="p-4 bg-gray-50/50 border border-gray-100 rounded-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-start space-x-3">
                  <div className="mt-1">
                    {phoneNumberLock ? <Lock className="text-amber-500" size={20} /> : <Unlock className="text-gray-400" size={20} />}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-700">Lock Candidate Phone Number</h4>
                    <p className="text-xs text-gray-500 mt-0.5">Force the candidate to submit form using a specific phone number.</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 flex-grow md:max-w-xs">
                  <input
                    type="checkbox"
                    checked={phoneNumberLock}
                    onChange={() => setPhoneNumberLock(!phoneNumberLock)}
                    className="h-5 w-5 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  {phoneNumberLock && (
                    <Input
                      type="text"
                      placeholder="Candidate Phone Number"
                      value={lockedPhoneNumber}
                      onChange={(e) => setLockedPhoneNumber(e.target.value.replace(/\D/g, ''))}
                      maxLength={10}
                      className="flex-grow bg-white border border-gray-200"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Link Expiry Section */}
            {!isReusable && hasPermission(Permission.INVITES_SET_EXPIRY) && (
              <div className="p-4 bg-gray-50/50 border border-gray-100 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Calendar className="text-blue-500" size={20} />
                    <div>
                      <h4 className="text-sm font-bold text-gray-700">Enable Link Expiration</h4>
                      <p className="text-xs text-gray-500 mt-0.5">Configure when this onboarding link will automatically deactivate.</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={hasExpiry}
                    onChange={() => setHasExpiry(!hasExpiry)}
                    className="h-5 w-5 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                </div>

                {hasExpiry && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                    <div>
                      <label className="block text-xs font-black uppercase text-gray-400 mb-1">Expiry Preset</label>
                      <select
                        value={expiryDays}
                        onChange={(e) => setExpiryDays(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                      >
                        <option value="1">1 Day</option>
                        <option value="3">3 Days</option>
                        <option value="7">7 Days</option>
                        <option value="30">30 Days</option>
                        <option value="custom">Custom Expiry Date</option>
                      </select>
                    </div>

                    {expiryDays === 'custom' && (
                      <div>
                        <label className="block text-xs font-black uppercase text-gray-400 mb-1">Custom Expiry Date</label>
                        <input
                          type="datetime-local"
                          value={customExpiryDate}
                          onChange={(e) => setCustomExpiryDate(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Lock Prefilled Fields Section */}
            {hasPermission(Permission.INVITES_LOCK_PREFILLED) && (
              <div className="p-4 bg-gray-50/50 border border-gray-100 rounded-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-start space-x-3">
                  <div className="mt-1">
                    {lockPrefilledFields ? <Lock className="text-amber-500" size={20} /> : <Unlock className="text-gray-400" size={20} />}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-700">Lock Prefilled Questions</h4>
                    <p className="text-xs text-gray-500 mt-0.5">Disable editing on any questions that have prefilled answers.</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={lockPrefilledFields}
                    onChange={() => setLockPrefilledFields(!lockPrefilledFields)}
                    className="h-5 w-5 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                </div>
              </div>
            )}

            {/* Dynamic Prefills Panel */}
            {hasPermission(Permission.INVITES_PREFILL_FIELDS) && visiblePrefillFields.length > 0 && (
              <div className="border border-gray-100 rounded-2xl p-6 bg-gray-50/20 space-y-4">
                <h3 className="text-sm font-black uppercase text-gray-500 tracking-wider flex items-center border-b border-gray-100 pb-2">
                  <FileText className="mr-2 text-emerald-600" size={16} /> Prefill Onboarding Questions
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {visiblePrefillFields.map(field => (
                    <div key={field.id} className="space-y-2">
                      <label className="block text-xs font-bold text-gray-600">{field.label}</label>
                      {field.options && field.options.length > 0 ? (
                        <select
                          value={prefillValues[field.id] || ''}
                          onChange={(e) => setPrefillValues(p => ({ ...p, [field.id]: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                        >
                          <option value="">No Prefill</option>
                          {field.options.map((opt, i) => (
                            <option key={i} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : field.type === 'Date Picker' ? (
                        <input
                          type="date"
                          value={prefillValues[field.id] || ''}
                          onChange={(e) => setPrefillValues(p => ({ ...p, [field.id]: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                        />
                      ) : (
                        <input
                          type="text"
                          placeholder={`Prefill ${field.label}`}
                          value={prefillValues[field.id] || ''}
                          onChange={(e) => setPrefillValues(p => ({ ...p, [field.id]: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4 flex justify-end">
              <Button
                onClick={handleGenerateInvite}
                variant="primary"
                className="w-full md:w-auto px-8 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-bold uppercase tracking-wider shadow-lg rounded-xl transition-all"
              >
                <Plus size={18} className="mr-2" /> Generate Invitation Link
              </Button>
            </div>
          </div>

          {/* Quick Help Card */}
          <div className="bg-gradient-to-br from-emerald-800 to-emerald-950 text-white rounded-2xl p-6 shadow-xl space-y-6 self-start">
            <h3 className="text-lg font-black tracking-wide uppercase flex items-center border-b border-emerald-700/50 pb-3">
              <Info className="mr-2" size={20} /> Referral System Guide
            </h3>
            <ul className="space-y-4 text-sm text-emerald-100">
              <li className="flex items-start">
                <span className="bg-emerald-700 text-white rounded-full h-5 w-5 flex items-center justify-center font-bold text-xs mr-3 flex-shrink-0 mt-0.5">1</span>
                <p>Select the target site and designation for the new hire.</p>
              </li>
              <li className="flex items-start">
                <span className="bg-emerald-700 text-white rounded-full h-5 w-5 flex items-center justify-center font-bold text-xs mr-3 flex-shrink-0 mt-0.5">2</span>
                <p>If permitted, lock their phone number or prefill standard questions to save their time.</p>
              </li>
              <li className="flex items-start">
                <span className="bg-emerald-700 text-white rounded-full h-5 w-5 flex items-center justify-center font-bold text-xs mr-3 flex-shrink-0 mt-0.5">3</span>
                <p>Click "Generate" to obtain a unique link.</p>
              </li>
              <li className="flex items-start">
                <span className="bg-emerald-700 text-white rounded-full h-5 w-5 flex items-center justify-center font-bold text-xs mr-3 flex-shrink-0 mt-0.5">4</span>
                <p>Share the link via WhatsApp directly or copy it to your clipboard.</p>
              </li>
            </ul>
            <div className="bg-emerald-900/50 border border-emerald-700/50 rounded-xl p-4 text-xs text-emerald-200">
              <strong>Security Note:</strong> These links are linked to your staff profile. Users who join through them will automatically reflect in your Referral Tracker dashboard.
            </div>
          </div>
        </div>
      )}

      {/* Generated Link Modal / Card */}
      {showInviteModal && generatedInvite && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 flex flex-col relative animate-in zoom-in-95 duration-200">
            <div className="bg-emerald-50 p-6 border-b border-emerald-100 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-emerald-800 uppercase tracking-tight flex items-center">
                  <CheckCircle2 size={24} className="mr-2 text-emerald-600" /> Link Created Successfully
                </h3>
              </div>
              <button onClick={() => setShowInviteModal(false)} className="p-2 hover:bg-emerald-100 rounded-full text-emerald-600 transition-colors">
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Onboarding Invitation Link</span>
                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl p-3 select-all">
                  <span className="text-sm font-mono text-gray-700 break-all flex-grow mr-2">
                    {getInviteUrl(generatedInvite.id)}
                  </span>
                </div>
              </div>

              {generatedInvite.isReusable && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center space-x-2 text-emerald-850 text-xs font-bold">
                  <Users size={16} className="text-emerald-600 flex-shrink-0" />
                  <span>This is a Reusable Link (it does not expire and doesn't lock candidate phone numbers).</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl">
                  <span className="text-[9px] font-black uppercase text-gray-400 block">Assigned Site</span>
                  <span className="text-sm font-bold text-gray-700">{generatedInvite.siteName}</span>
                </div>
                <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl">
                  <span className="text-[9px] font-black uppercase text-gray-400 block">Designation</span>
                  <span className="text-sm font-bold text-gray-700">{generatedInvite.designation}</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  onClick={() => handleCopyLink(getInviteUrl(generatedInvite.id))}
                  variant="outline"
                  className="flex-1 font-bold uppercase tracking-wider py-3 border-gray-200 hover:bg-gray-50"
                >
                  {copiedLink ? (
                    <>
                      <Check size={18} className="mr-2 text-emerald-600" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={18} className="mr-2" /> Copy Link
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => handleShareToWhatsApp(generatedInvite)}
                  variant="primary"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold uppercase tracking-wider py-3 border-none shadow-md"
                >
                  <MessageSquare size={18} className="mr-2" /> Share to WhatsApp
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TRACKER TAB */}
      {activeTab === 'TRACKER' && canViewInvites && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden">
          {/* Filters Bar */}
          <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-grow max-w-md">
              <Search className="absolute left-3 top-3.5 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search by site, designation, creator or ID..."
                value={trackerSearch}
                onChange={(e) => setTrackerSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white shadow-sm"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div>
                <select
                  value={trackerSiteFilter}
                  onChange={(e) => setTrackerSiteFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-xl text-xs bg-white text-gray-600 shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="ALL">All Sites</option>
                  {sites.map(site => (
                    <option key={site.id} value={site.id}>{site.name}</option>
                  ))}
                </select>
              </div>

              {(isSuperAdmin || hasPermission(Permission.INVITES_VIEW_ALL) || hasPermission(Permission.INVITES_MANAGE)) && (
                <div>
                  <select
                    value={trackerStaffFilter}
                    onChange={(e) => setTrackerStaffFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-xl text-xs bg-white text-gray-600 shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="ALL">All Staff</option>
                    {uniqueStaffCreators.map(staff => (
                      <option key={staff.id} value={staff.id}>{staff.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Data Table */}
          <div className="overflow-x-auto">
            {loadingInvites ? (
              <div className="p-12 text-center text-gray-400">
                <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-emerald-600" />
                <span>Loading generated links...</span>
              </div>
            ) : filteredInvites.length === 0 ? (
              <div className="p-12 text-center text-gray-400 font-medium">
                No generated links found.
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left">Referral ID</th>
                    <th className="px-6 py-4 text-left">Details</th>
                    <th className="px-6 py-4 text-left">Created By</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-center">Clicks</th>
                    <th className="px-6 py-4 text-center">Started</th>
                    <th className="px-6 py-4 text-center">Pending</th>
                    <th className="px-6 py-4 text-center">Joined</th>
                    <th className="px-6 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredInvites.map((invite) => {
                    const isExpired = (invite.expiresAt ? new Date(invite.expiresAt).getTime() < Date.now() : false) || (!invite.isReusable && (invite.joined || 0) >= 1);
                    const displayStatus = invite.status === 'Revoked' ? 'Revoked' : (isExpired ? 'Expired' : 'Active');
                    
                    // Derive real-time candidate pipeline stats for this invite
                    const inviteCandidates = referredEmployees.filter(c => c.inviteId === invite.id);
                    const pendingCount = inviteCandidates.filter(c => !c.isActive).length;
                    const activeJoinedCount = inviteCandidates.filter(c => c.isActive).length;
                    
                    return (
                      <tr key={invite.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-mono text-xs text-gray-500 font-semibold cursor-help" title={invite.id}>
                            {invite.id.slice(0, 8)}...
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-gray-800">{invite.siteName}</span>
                            <span className="text-xs text-gray-400 mt-0.5">{invite.designation}</span>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {invite.isReusable && (
                                <span className="inline-flex items-center text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-black px-1.5 py-0.5 rounded uppercase">
                                  <Users size={8} className="mr-1" /> Reusable
                                </span>
                              )}
                              {invite.phoneNumberLock && (
                                <span className="inline-flex items-center text-[9px] bg-amber-50 text-amber-700 font-black px-1.5 py-0.5 rounded border border-amber-100 uppercase">
                                  <Lock size={8} className="mr-1" /> Phone Locked
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-700">{invite.createdByName}</span>
                            <span className="text-[10px] text-gray-400 mt-0.5">{new Date(invite.createdAt).toLocaleDateString()}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                            displayStatus === 'Active' 
                              ? 'bg-green-50 text-green-700 border-green-200' 
                              : displayStatus === 'Expired' 
                              ? 'bg-amber-50 text-amber-700 border-amber-200' 
                              : 'bg-red-50 text-red-700 border-red-200'
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${
                              displayStatus === 'Active' ? 'bg-green-500 animate-pulse' : displayStatus === 'Expired' ? 'bg-amber-500' : 'bg-red-500'
                            }`} />
                            {displayStatus}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center font-bold text-slate-700 whitespace-nowrap">{invite.clicks || 0}</td>
                        <td className="px-6 py-4 text-center font-bold text-amber-600 whitespace-nowrap">{invite.started || 0}</td>
                        <td className="px-6 py-4 text-center whitespace-nowrap">
                          {pendingCount > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              {pendingCount}
                            </span>
                          ) : (
                            <span className="text-gray-400 font-bold">0</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center whitespace-nowrap">
                          {activeJoinedCount > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">
                              {activeJoinedCount}
                            </span>
                          ) : (
                            <span className="text-gray-400 font-bold">0</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center space-x-2">
                            <button
                              onClick={() => handleCopyLink(getInviteUrl(invite.id))}
                              className="p-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700 transition-colors border border-gray-200"
                              title="Copy Invite Link"
                            >
                              <Copy size={14} />
                            </button>
                            <button
                              onClick={() => handleShareToWhatsApp(invite)}
                              className="p-1.5 bg-green-50 hover:bg-green-100 rounded-lg text-green-600 hover:text-green-700 transition-colors border border-green-200"
                              title="Share to WhatsApp"
                            >
                              <MessageSquare size={14} />
                            </button>
                             {(isSuperAdmin || hasPermission(Permission.INVITES_REACTIVATE)) && (displayStatus === 'Expired' || displayStatus === 'Revoked') && (
                              <button
                                onClick={() => openReactivateModal(invite)}
                                className="p-1.5 bg-emerald-50 hover:bg-emerald-100 rounded-lg text-emerald-600 hover:text-emerald-700 transition-colors border border-emerald-200"
                                title="Reactivate / Extend Expiry"
                              >
                                <RefreshCw size={14} />
                              </button>
                            )}
                             {(isSuperAdmin || hasPermission(Permission.INVITES_EDIT)) && displayStatus === 'Active' && (
                              <button
                                onClick={() => openEditModal(invite)}
                                className="p-1.5 bg-blue-50 hover:bg-blue-100 rounded-lg text-blue-600 hover:text-blue-700 transition-colors border border-blue-200"
                                title="Edit Invite Configuration"
                              >
                                <Edit size={14} />
                              </button>
                            )}
                             {displayStatus === 'Active' && (isSuperAdmin || hasPermission(Permission.INVITES_DELETE)) && (
                              <>
                                {revokingId === invite.id ? (
                                  <div className="flex items-center space-x-1 animate-in slide-in-from-right-2">
                                    <button
                                      onClick={() => handleRevokeInvite(invite.id)}
                                      className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-black uppercase border-none"
                                    >
                                      Confirm
                                    </button>
                                    <button
                                      onClick={() => setRevokingId(null)}
                                      className="p-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-500"
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setRevokingId(invite.id)}
                                    className="p-1.5 bg-red-50 hover:bg-red-100 rounded-lg text-red-600 hover:text-red-700 transition-colors border border-red-200"
                                    title="Revoke Link"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* REFERRED CANDIDATES TAB */}
      {activeTab === 'CANDIDATES' && canViewInvites && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden">
          {/* Filters */}
          <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-grow max-w-md">
              <Search className="absolute left-3 top-3.5 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search by candidate name, designation or recruiter..."
                value={candidateSearch}
                onChange={(e) => setCandidateSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white shadow-sm"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div>
                <select
                  value={candidateSiteFilter}
                  onChange={(e) => setCandidateSiteFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-xl text-xs bg-white text-gray-600 shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="ALL">All Sites</option>
                  {sites.map(site => (
                    <option key={site.id} value={site.id}>{site.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={candidateStatusFilter}
                  onChange={(e) => setCandidateStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-xl text-xs bg-white text-gray-600 shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="Pending">Pending Approval</option>
                  <option value="Approved">Active Employees</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            {loadingEmployees ? (
              <div className="p-12 text-center text-gray-400">
                <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-emerald-600" />
                <span>Loading candidates...</span>
              </div>
            ) : filteredCandidates.length === 0 ? (
              <div className="p-12 text-center text-gray-400 font-medium">
                No referred candidates found.
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left">Candidate Name</th>
                    <th className="px-6 py-4 text-left">Assigned Site</th>
                    <th className="px-6 py-4 text-left">Designation</th>
                    <th className="px-6 py-4 text-left">Referred By</th>
                    <th className="px-6 py-4 text-center">Applied On</th>
                    <th className="px-6 py-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCandidates.map((cand) => {
                    const profile = cand.profileData || cand.formData || {};
                    const name = cand.applicantName || profile['7debf274-baee-4bac-a137-4b4b46719874'] || 'Unknown Applicant';
                    const designationVal = cand.designation || profile['db307195-cf54-4a6e-9056-f3974b050c4d'] || 'N/A';
                    const siteIdVal = cand.currentSiteId || cand.siteId || profile.siteId;
                    const siteNameVal = cand.siteName || profile.siteName || (sites.find(s => s.id === siteIdVal)?.name) || 'N/A';
                    const displayStatus = cand.isActive ? 'Approved' : 'Pending';
                    const appliedDate = cand.joiningDate || cand.timestamp || cand.createdAt;

                    return (
                      <tr key={cand.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-bold text-gray-800">{name}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-700">{siteNameVal}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-600">{designationVal}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {cand.recruitedByName || 'Unknown Staff'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-xs text-gray-500 font-bold">
                          {appliedDate ? new Date(appliedDate).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${
                            displayStatus === 'Approved' 
                              ? 'bg-green-50 text-green-700 border-green-200' 
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}>
                            {displayStatus === 'Approved' ? 'Approved' : 'Pending Approval'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Edit Invite Modal */}
      {isEditModalOpen && inviteToEdit && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => {
            if (!isSavingEdit) {
              setIsEditModalOpen(false);
              setInviteToEdit(null);
            }
          }}
          title="Edit Onboarding Link Configuration"
          size="lg"
        >
          <div className="space-y-6">
            <div className="bg-emerald-50 p-4 border border-emerald-100 rounded-xl text-xs text-emerald-800">
              Editing generated link: <strong className="font-mono">{inviteToEdit.id}</strong>. Candidate clicks, starts, and completed joins will be preserved.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-2">Target Deployment Site *</label>
                <select
                  value={editSiteId}
                  onChange={(e) => setEditSiteId(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-gray-50 hover:bg-gray-100/50 transition-colors"
                >
                  <option value="">Select a Site</option>
                  {activeSites.map(site => (
                    <option key={site.id} value={site.id}>{site.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-2">Candidate Designation *</label>
                <select
                  value={editDesignation}
                  onChange={(e) => setEditDesignation(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-gray-50 hover:bg-gray-100/50 transition-colors"
                >
                  <option value="">Select a Designation</option>
                  {editSiteDesignations.map((des, index) => (
                    <option key={index} value={des}>{des}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Reusable Link Toggle */}
            <div className="p-4 bg-gray-50/50 border border-gray-100 rounded-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-start space-x-3">
                <div className="mt-1">
                  <RefreshCw className={editIsReusable ? "text-emerald-500" : "text-gray-400"} size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-700">Reusable Link (Multi-use)</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Allow multiple candidates to join using this single, permanent link.</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={editIsReusable}
                  onChange={() => setEditIsReusable(!editIsReusable)}
                  className="h-5 w-5 text-emerald-600 rounded focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Lock Phone Number Section */}
            {!editIsReusable && hasPermission(Permission.INVITES_LOCK_PHONE) && (
              <div className="p-4 bg-gray-50/50 border border-gray-100 rounded-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-start space-x-3">
                  <div className="mt-1">
                    {editPhoneLock ? <Lock className="text-amber-500" size={20} /> : <Unlock className="text-gray-400" size={20} />}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-700">Lock Candidate Phone Number</h4>
                    <p className="text-xs text-gray-500 mt-0.5">Force the candidate to submit form using a specific phone number.</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 flex-grow md:max-w-xs">
                  <input
                    type="checkbox"
                    checked={editPhoneLock}
                    onChange={() => setEditPhoneLock(!editPhoneLock)}
                    className="h-5 w-5 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  {editPhoneLock && (
                    <Input
                      type="text"
                      placeholder="Candidate Phone Number"
                      value={editLockedPhone}
                      onChange={(e) => setEditLockedPhone(e.target.value.replace(/\D/g, ''))}
                      maxLength={10}
                      className="flex-grow bg-white border border-gray-200"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Link Expiry Section */}
            {!editIsReusable && hasPermission(Permission.INVITES_SET_EXPIRY) && (
              <div className="p-4 bg-gray-50/50 border border-gray-100 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Calendar className="text-blue-500" size={20} />
                    <div>
                      <h4 className="text-sm font-bold text-gray-700">Enable Link Expiration</h4>
                      <p className="text-xs text-gray-500 mt-0.5">Configure when this onboarding link will automatically deactivate.</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={editHasExpiry}
                    onChange={() => setEditHasExpiry(!editHasExpiry)}
                    className="h-5 w-5 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                </div>

                {editHasExpiry && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                    <div>
                      <label className="block text-xs font-black uppercase text-gray-400 mb-1">Expiry Preset</label>
                      <select
                        value={editExpiryDays}
                        onChange={(e) => setEditExpiryDays(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                      >
                        <option value="1">1 Day</option>
                        <option value="3">3 Days</option>
                        <option value="7">7 Days</option>
                        <option value="30">30 Days</option>
                        <option value="custom">Custom Expiry Date</option>
                      </select>
                    </div>

                    {editExpiryDays === 'custom' && (
                      <div>
                        <label className="block text-xs font-black uppercase text-gray-400 mb-1">Custom Expiry Date</label>
                        <input
                          type="datetime-local"
                          value={editCustomExpiryDate}
                          onChange={(e) => setEditCustomExpiryDate(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Lock Prefilled Fields Section */}
            {hasPermission(Permission.INVITES_LOCK_PREFILLED) && (
              <div className="p-4 bg-gray-50/50 border border-gray-100 rounded-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-start space-x-3">
                  <div className="mt-1">
                    {editLockPrefilled ? <Lock className="text-amber-500" size={20} /> : <Unlock className="text-gray-400" size={20} />}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-700">Lock Prefilled Questions</h4>
                    <p className="text-xs text-gray-500 mt-0.5">Disable editing on any questions that have prefilled answers.</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={editLockPrefilled}
                    onChange={() => setEditLockPrefilled(!editLockPrefilled)}
                    className="h-5 w-5 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                </div>
              </div>
            )}

            {/* Dynamic Prefills Panel */}
            {hasPermission(Permission.INVITES_PREFILL_FIELDS) && visiblePrefillFields.length > 0 && (
              <div className="border border-gray-100 rounded-2xl p-6 bg-gray-50/20 space-y-4">
                <h3 className="text-sm font-black uppercase text-gray-500 tracking-wider flex items-center border-b border-gray-100 pb-2">
                  <FileText className="mr-2 text-emerald-600" size={16} /> Prefill Onboarding Questions
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {visiblePrefillFields.map(field => (
                    <div key={field.id} className="space-y-2">
                      <label className="block text-xs font-bold text-gray-600">{field.label}</label>
                      {field.options && field.options.length > 0 ? (
                        <select
                           value={editPrefillValues[field.id] || ''}
                           onChange={(e) => setEditPrefillValues(p => ({ ...p, [field.id]: e.target.value }))}
                           className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                        >
                          <option value="">No Prefill</option>
                          {field.options.map((opt, i) => (
                            <option key={i} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : field.type === 'Date Picker' ? (
                        <input
                          type="date"
                          value={editPrefillValues[field.id] || ''}
                          onChange={(e) => setEditPrefillValues(p => ({ ...p, [field.id]: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                        />
                      ) : (
                        <input
                          type="text"
                          placeholder={`Prefill ${field.label}`}
                          value={editPrefillValues[field.id] || ''}
                          onChange={(e) => setEditPrefillValues(p => ({ ...p, [field.id]: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4 border-t flex justify-end space-x-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setInviteToEdit(null);
                }}
                disabled={isSavingEdit}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveEditInvite}
                disabled={isSavingEdit}
              >
                {isSavingEdit ? <Loader2 size={16} className="animate-spin mr-1.5" /> : null}
                Save Changes
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Expiry extension / Reactivation Modal */}
      {isReactivateModalOpen && inviteToReactivate && (
        <Modal
          isOpen={isReactivateModalOpen}
          onClose={() => {
            if (!isSavingReactivation) {
              setIsReactivateModalOpen(false);
              setInviteToReactivate(null);
            }
          }}
          title="Reactivate / Extend Expiry"
          size="md"
        >
          <div className="space-y-6">
            <div className="bg-emerald-50 p-4 border border-emerald-100 rounded-xl text-xs text-emerald-800 space-y-1">
              <p>Reactivating referral link for: <strong>{inviteToReactivate.siteName}</strong></p>
              <p>Designation: <strong>{inviteToReactivate.designation}</strong></p>
            </div>

            <div className="space-y-4">
              <label className="block text-xs font-black uppercase text-gray-400 mb-1">Set New Expiration Date</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <select
                    value={reactivateExpiryDays}
                    onChange={(e) => setReactivateExpiryDays(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                  >
                    <option value="1">1 Day</option>
                    <option value="3">3 Days</option>
                    <option value="7">7 Days</option>
                    <option value="30">30 Days</option>
                    <option value="custom">Custom Expiry Date</option>
                  </select>
                </div>

                {reactivateExpiryDays === 'custom' && (
                  <div>
                    <input
                      type="datetime-local"
                      value={reactivateCustomExpiryDate}
                      onChange={(e) => setReactivateCustomExpiryDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t flex justify-end space-x-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsReactivateModalOpen(false);
                  setInviteToReactivate(null);
                }}
                disabled={isSavingReactivation}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveReactivation}
                disabled={isSavingReactivation}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase tracking-wider"
              >
                {isSavingReactivation ? <Loader2 size={16} className="animate-spin mr-1.5" /> : null}
                Reactivate Link
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Smart WhatsApp Share Modal */}
      {isWhatsAppShareModalOpen && inviteToShareWhatsApp && (
        <Modal
          isOpen={isWhatsAppShareModalOpen}
          onClose={() => {
            setIsWhatsAppShareModalOpen(false);
            setInviteToShareWhatsApp(null);
          }}
          title="Share to WhatsApp"
          size="md"
        >
          <div className="space-y-6">
            <div className="bg-emerald-50 p-4 border border-emerald-100 rounded-xl text-xs text-emerald-800 space-y-1">
              <p>You are sharing the invitation link for: <strong>{inviteToShareWhatsApp.siteName} ({inviteToShareWhatsApp.designation})</strong></p>
              <p className="text-[10px] text-emerald-600 font-semibold">Enter candidate's 10-digit mobile number to open a direct chat window, or skip to select from your WhatsApp contact list manually.</p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-black uppercase text-gray-500">Candidate WhatsApp Number (Optional)</label>
              <div className="flex space-x-2">
                <span className="flex items-center px-3 bg-gray-150 border border-gray-200 rounded-xl text-sm font-semibold text-gray-500">+91</span>
                <Input
                  type="text"
                  placeholder="10-digit Phone Number"
                  value={whatsAppTargetNumber}
                  onChange={(e) => setWhatsAppTargetNumber(e.target.value.replace(/\D/g, ''))}
                  maxLength={10}
                  className="flex-grow bg-white border border-gray-200"
                />
              </div>
            </div>

            <div className="pt-4 border-t flex justify-between space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  executeWhatsAppShare(inviteToShareWhatsApp);
                  setIsWhatsAppShareModalOpen(false);
                  setInviteToShareWhatsApp(null);
                }}
                className="font-bold uppercase tracking-wider py-2.5 border-gray-200 hover:bg-gray-50"
              >
                Skip / Search Contact
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  if (whatsAppTargetNumber && whatsAppTargetNumber.length !== 10) {
                    alert('Please enter a valid 10-digit phone number or leave it blank to skip.');
                    return;
                  }
                  executeWhatsAppShare(inviteToShareWhatsApp, whatsAppTargetNumber);
                  setIsWhatsAppShareModalOpen(false);
                  setInviteToShareWhatsApp(null);
                }}
                disabled={whatsAppTargetNumber !== '' && whatsAppTargetNumber.length !== 10}
                className="bg-green-600 hover:bg-green-700 text-white font-bold uppercase tracking-wider py-2.5 border-none shadow-md"
              >
                <MessageSquare size={16} className="mr-2" /> Open Direct Chat
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AdminInvitesPage;

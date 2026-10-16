import log from '../src/utils/logger';

import React, { useMemo, useState, useCallback } from 'react';
import { FirestoreEmployee, EmployeeAssignment, Site, SubUnit, Role, FormSection, SubmittedFormData, SubmissionStatus, Permission, FieldType, PortalConfig, StaffUser } from '../types';
import Button from './common/Button';
import Input from './common/Input';
import Select from './common/Select';
import { Search, Building, User, Phone, Tag, Filter, Database, ShieldAlert, Info, Edit3, Trash2, RotateCcw, Settings, X, CheckCircle, AlertTriangle, RefreshCw, ChevronDown, UserMinus, UserPlus, Calendar, PlusCircle, Briefcase, Plus, ShieldCheck, MapPin, LogOut, Upload, FileClock, Clock, Lock, Mail, Globe, Key, Shield, FileText, ArrowUpDown, ArrowDown, ArrowUp, Layout, Columns, Save, ShieldHalf } from 'lucide-react';
import { getPaginatedSubmissions, getPaginatedEmployees, assignToSite, relieveFromSite, adminUpdateEmployeeEmail, adminSetAuthProvider, adminUnlinkGoogleAccount, adminResetEmployeePassword, adminResetToDefaultPassword, updateEmployeeClientIds, getEmployeeStatsCounts } from '../src/services/employeeService';
import { QueryDocumentSnapshot } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import BulkImportModal from './BulkImportModal';
import { BulkImportResult } from '../src/utils/bulkImportUtils';
import SecureDocumentLink from '../src/components/common/SecureDocumentLink';
import RequestCorrectionModal from './common/RequestCorrectionModal';
import { User as SystemUser } from '../types';
import { useData } from '../src/contexts/DataContext';

interface AdminMasterEmployeeListPageProps {
  submittedForms: SubmittedFormData[];
  sites: Site[];
  userRole?: Role;
  formSections: FormSection[];
  isSuperAdmin: boolean;
  onUpdateId?: (submissionId: string, oldId: string, newId: string) => void;
  onDelete?: (submissionId: string) => void;
  onSoftDelete?: (submissionId: string) => void;
  onRestore?: (submissionId: string) => void;
  onRelieve?: (employeeId: string, relievingDate: string, reason: 'Resignation' | 'Termination' | 'Absconding' | 'ContractEnded' | 'Other') => void;
  onRejoin?: (employeeId: string, rejoinDate: string, siteId: string, subUnitId: string | undefined, designation: string, newEmployeeId?: string, keepDocuments?: boolean) => void;
  onSyncDrive?: (employeeId: string) => Promise<void>;
  onBulkDelete?: (ids: string[]) => void;
  onBulkSoftDelete?: (ids: string[]) => void;
  onApproveProfile?: (employeeId: string) => Promise<void>;
  onViewTimeline?: (employeeId: string) => void;
  onExport?: (data: SubmittedFormData[]) => void;
  allowedSiteIds?: string[];
  portalConfig: PortalConfig;
  authUser?: SystemUser | null;
  staffUsers?: StaffUser[];
}

const AdminMasterEmployeeListPage: React.FC<AdminMasterEmployeeListPageProps> = ({
  submittedForms,
  sites,
  userRole,
  formSections,
  isSuperAdmin,
  onUpdateId,
  onDelete,
  onSoftDelete,
  onRestore,
  onRelieve,
  onRejoin,
  onSyncDrive,
  onBulkDelete,
  onBulkSoftDelete,
  onApproveProfile,
  onViewTimeline,
  onExport,
  allowedSiteIds,
  portalConfig,
  authUser,
  staffUsers: propStaffUsers
}) => {
  const { staffUsers: contextStaffUsers, allowedSiteIds: contextAllowedSiteIds, isSuperAdmin: contextIsSuperAdmin } = useData();
  const staffUsers = propStaffUsers || contextStaffUsers || [];
  const effectiveAllowedSiteIds = useMemo(() => {
    return allowedSiteIds !== undefined ? allowedSiteIds : (contextAllowedSiteIds || []);
  }, [allowedSiteIds, contextAllowedSiteIds]);
  const allowedSitesKey = useMemo(() => {
    return Array.isArray(effectiveAllowedSiteIds) ? effectiveAllowedSiteIds.join(',') : String(effectiveAllowedSiteIds || '');
  }, [effectiveAllowedSiteIds]);
  const effectiveIsSuperAdmin = isSuperAdmin ?? contextIsSuperAdmin;

  // Defensive defaults
  const safeSites = sites || [];
  const safeForms = submittedForms || [];
  const safeSections = formSections || [];

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedSite, setSelectedSite] = useState('ALL');
  const [viewMode, setViewMode] = useState<'ACTIVE' | 'PENDING' | 'RELIEVED' | 'RECYCLE_BIN'>('ACTIVE');
  const [isManagementModalOpen, setIsManagementModalOpen] = useState(false);
  const [managementTarget, setManagementTarget] = useState<SubmittedFormData | null>(null);

  const [editingRecruiterId, setEditingRecruiterId] = useState<string>('');
  const [isUpdatingRecruiter, setIsUpdatingRecruiter] = useState<boolean>(false);

  React.useEffect(() => {
    if (managementTarget && isManagementModalOpen) {
      setEditingClientIds((managementTarget as any).clientIds || {});
      setEditingRecruiterId((managementTarget as any).recruitedBy || '');
      const rawDate = (managementTarget as any).joiningDate || managementTarget.timestamp || '';
      if (rawDate) {
        try {
          const d = new Date(rawDate);
          if (!isNaN(d.getTime())) {
            setNewJoiningDateValue(d.toISOString().split('T')[0]);
          } else {
            setNewJoiningDateValue('');
          }
        } catch {
          setNewJoiningDateValue('');
        }
      } else {
        setNewJoiningDateValue('');
      }
    }
  }, [managementTarget, isManagementModalOpen]);
  const [newIdValue, setNewIdValue] = useState('');
  const [newJoiningDateValue, setNewJoiningDateValue] = useState('');
  const [updateOriginalJoinDate, setUpdateOriginalJoinDate] = useState(true);
  const [isUpdatingJoiningDate, setIsUpdatingJoiningDate] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Relieve Modal State
  const [isRelieveModalOpen, setIsRelieveModalOpen] = useState(false);
  const [relieveDate, setRelieveDate] = useState('');
  const [relieveReason, setRelieveReason] = useState<'Resignation' | 'Termination' | 'Absconding' | 'ContractEnded' | 'Other'>('Resignation');

  // Rejoin Modal State
  const [isRejoinModalOpen, setIsRejoinModalOpen] = useState(false);
  const [rejoinDate, setRejoinDate] = useState(new Date().toISOString().split('T')[0]);
  const [rejoinSiteId, setRejoinSiteId] = useState('');
  const [rejoinSubUnitId, setRejoinSubUnitId] = useState('');
  const [rejoinDesignation, setRejoinDesignation] = useState('Security Guard');
  const [isRehiring, setIsRehiring] = useState(false);
  const [rehireId, setRehireId] = useState('');
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]); // New state for selective copy

  // Assignment Modal State
  const [activeTab, setActiveTab] = useState<'DETAILS' | 'CLIENT_IDS' | 'SECURITY' | 'DEPLOYMENTS'>('DETAILS');
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [editingClientIds, setEditingClientIds] = useState<Record<string, string>>({});
  const [isSavingClientIds, setIsSavingClientIds] = useState(false);
  const [newAssignmentSiteId, setNewAssignmentSiteId] = useState('');
  const [newAssignmentSubUnitId, setNewAssignmentSubUnitId] = useState('');
  const [newAssignmentType, setNewAssignmentType] = useState<'PRIMARY' | 'OT'>('OT');
  const [newAssignmentDesignation, setNewAssignmentDesignation] = useState('Security Guard');
  const [newAssignmentDate, setNewAssignmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [isAssigning, setIsAssigning] = useState(false);

  const hasPermission = useCallback((permission: Permission) => {
    if (isSuperAdmin) return true;
    if (authUser?.permissionOverrides?.[permission] === true) return true;
    if (authUser?.permissionOverrides?.[permission] === false) return false;
    return userRole?.permissions.includes(permission) || false;
  }, [isSuperAdmin, authUser, userRole]);

  const hasViewScopeAll = effectiveIsSuperAdmin || hasPermission(Permission.EMPLOYEES_VIEW_SCOPE_ALL);

  // Auth Management State
  const [isAuthUpdating, setIsAuthUpdating] = useState(false);
  const [newAuthEmail, setNewAuthEmail] = useState('');
  const [newManualPassword, setNewManualPassword] = useState('');
  const [manualGoogleEmail, setManualGoogleEmail] = useState('');


  // Enhanced Table State
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [userVisibleColumns, setUserVisibleColumns] = useState<Set<string>>(new Set());
  const [isColumnSettingsOpen, setIsColumnSettingsOpen] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const isFieldHiddenByRbac = useCallback((id: string) => {
    if (isSuperAdmin) return false;
    if (userRole?.fieldVisibility) {
      return userRole.fieldVisibility[id] === 'HIDDEN';
    }
    if (userRole?.visibleMasterListFields) {
      const essential = ['name', 'employeeId', 'auth', 'siteName', 'joiningDate', 'recruitedByName'];
      return !essential.includes(id) && !userRole.visibleMasterListFields.includes(id);
    }
    return false;
  }, [isSuperAdmin, userRole]);

  const hasTabPermission = useCallback((tab: 'ACTIVE' | 'PENDING' | 'RELIEVED' | 'RECYCLE_BIN') => {
    switch (tab) {
      case 'ACTIVE':
        return hasPermission(Permission.EMPLOYEES_TAB_ACTIVE);
      case 'PENDING':
        return hasPermission(Permission.EMPLOYEES_TAB_PENDING);
      case 'RELIEVED':
        return hasPermission(Permission.EMPLOYEES_TAB_RELIEVED);
      case 'RECYCLE_BIN':
        return hasPermission(Permission.EMPLOYEES_TAB_RECYCLE_BIN);
      default:
        return false;
    }
  }, [hasPermission]);

  React.useEffect(() => {
    if (!isSuperAdmin && userRole) {
      const permittedTabs: ('ACTIVE' | 'PENDING' | 'RELIEVED' | 'RECYCLE_BIN')[] = [];
      if (hasTabPermission('ACTIVE')) permittedTabs.push('ACTIVE');
      if (hasTabPermission('PENDING')) permittedTabs.push('PENDING');
      if (hasTabPermission('RELIEVED')) permittedTabs.push('RELIEVED');
      if (hasTabPermission('RECYCLE_BIN')) permittedTabs.push('RECYCLE_BIN');

      if (permittedTabs.length > 0 && !permittedTabs.includes(viewMode)) {
        setViewMode(permittedTabs[0]);
      }
    }
  }, [userRole, isSuperAdmin, hasTabPermission, viewMode]);

  React.useEffect(() => {
    const saved = localStorage.getItem('masterListColumnPrefs');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setUserVisibleColumns(new Set(parsed));
      } catch(e) {}
    }
  }, []);

  const toggleColumnVisibility = useCallback((colId: string) => {
    setUserVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(colId)) next.delete(colId);
      else next.add(colId);
      // Persist to localStorage
      localStorage.setItem('masterListColumnPrefs', JSON.stringify(Array.from(next)));
      return next;
    });
  }, []);

  const isVisible = useCallback((fieldId: string) => {
    // 1. Auth Column Permission Check
    if (fieldId === 'auth') {
      return hasPermission(Permission.EMPLOYEES_MANAGE_SECURITY);
    }

    // 2. RBAC Check (Data Privacy rule check)
    if (isFieldHiddenByRbac(fieldId)) {
      return false;
    }
    
    // 3. User Preference Check
    // If user has customized columns, use their preferences
    if (userVisibleColumns.size > 0) {
      return userVisibleColumns.has(fieldId);
    }
    
    return true;
  }, [isFieldHiddenByRbac, userVisibleColumns, hasPermission]);

  const handleSaveJoiningDate = async () => {
    if (!managementTarget || !newJoiningDateValue) return;
    setIsUpdatingJoiningDate(true);
    try {
      const { updateEmployeeJoiningDate } = await import('../src/services/employeeService');
      await updateEmployeeJoiningDate(
        managementTarget.id,
        newJoiningDateValue,
        updateOriginalJoinDate
      );
      
      const isoDate = new Date(newJoiningDateValue).toISOString();
      setManagementTarget(prev => {
        if (!prev) return null;
        return {
          ...prev,
          joiningDate: isoDate,
          originalJoiningDate: updateOriginalJoinDate ? isoDate : (prev as any).originalJoiningDate
        };
      });

      setPaginatedData(prev => prev.map(emp => {
        if (emp.id === managementTarget.id || (emp as any).employeeId === managementTarget.employeeId) {
          return {
            ...emp,
            joiningDate: isoDate,
            originalJoiningDate: updateOriginalJoinDate ? isoDate : (emp as any).originalJoiningDate
          };
        }
        return emp;
      }));

      alert("Joining date updated successfully!");
    } catch (err: any) {
      console.error("Failed to update joining date:", err);
      alert(`Update Failed: ${err.message}`);
    } finally {
      setIsUpdatingJoiningDate(false);
    }
  };

  const handleSaveRecruiter = async () => {
    if (!managementTarget || !effectiveIsSuperAdmin) return;
    setIsUpdatingRecruiter(true);
    try {
      const { updateEmployeeRecruiter } = await import('../src/services/employeeService');
      const targetId = managementTarget.employeeId || managementTarget.id;
      const foundStaff = (staffUsers || []).find(s => s.id === editingRecruiterId);
      const recPayload = editingRecruiterId ? {
        id: editingRecruiterId,
        name: foundStaff?.name || foundStaff?.username || 'Staff'
      } : { id: null, name: null };

      await updateEmployeeRecruiter(targetId, recPayload);

      setManagementTarget(prev => {
        if (!prev) return null;
        return {
          ...prev,
          recruitedBy: recPayload.id,
          recruitedByName: recPayload.name,
          inviteId: recPayload.id ? (prev as any).inviteId : undefined
        } as any;
      });

      setPaginatedData(prev => prev.map(emp => {
        if (emp.id === managementTarget.id || (emp as any).employeeId === managementTarget.employeeId) {
          return {
            ...emp,
            recruitedBy: recPayload.id,
            recruitedByName: recPayload.name,
            inviteId: recPayload.id ? (emp as any).inviteId : undefined
          } as any;
        }
        return emp;
      }));

      alert("Recruiter attribution updated successfully!");
    } catch (err: any) {
      console.error("Failed to update recruiter:", err);
      alert(`Update Failed: ${err.message}`);
    } finally {
      setIsUpdatingRecruiter(false);
    }
  };

  const handleSort = (key: string) => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        if (prev.direction === 'asc') return { key, direction: 'desc' };
        return null; // loop back to no sort
      }
      return { key, direction: 'asc' };
    });
  };

  // Pagination State
  const [paginatedData, setPaginatedData] = useState<SubmittedFormData[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | undefined>(undefined);
  const [pageHistory, setPageHistory] = useState<QueryDocumentSnapshot[]>([]); // Stack for "Previous" button
  const [currentPage, setCurrentPage] = useState(1);

  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Company-wide stats state via server count aggregation
  const [companyStats, setCompanyStats] = useState({ total: 0, googleAuth: 0, manualAuth: 0, pending: 0 });

  React.useEffect(() => {
    getEmployeeStatsCounts(hasViewScopeAll ? undefined : (effectiveAllowedSiteIds || [])).then(counts => {
      setCompanyStats(counts);
    }).catch(() => {});
  }, [hasViewScopeAll, effectiveAllowedSiteIds]);

  // Build a flat list of all possible dynamic fields
  const allFormFields = useMemo(() => {
    return (safeSections || []).flatMap(s => s.fields || [])
      .filter(f => !f.label?.toLowerCase().includes('client id') && !f.label?.toLowerCase().includes('client-specific id'));
  }, [safeSections]);

  // Fetch Data Function
  const loadPage = async (direction: 'next' | 'prev' | 'initial' = 'initial') => {
    if (isLoading) return;

    if (!hasViewScopeAll && (!effectiveAllowedSiteIds || effectiveAllowedSiteIds.length === 0)) {
      setPaginatedData([]);
      setLastDoc(undefined);
      setHasMore(false);
      setIsLoading(false);
      setHasLoadedInitial(true);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      let currentLastDoc: QueryDocumentSnapshot | undefined = undefined;

      if (direction === 'next') {
        currentLastDoc = lastDoc;
      } else if (direction === 'prev') {
        const history = [...pageHistory];
        history.pop(); // Remove current
        currentLastDoc = history.pop(); // Get previous
        setPageHistory(history);
      } else {
        setPageHistory([]);
        setLastDoc(undefined);
        setCurrentPage(1);
      }

      log.log(`[MasterList] Loading Page ${currentPage} (${direction}). View: ${viewMode}`);

      // Look for Unit/Facility in the form sections to filter by site
      const unitField = safeSections
        .flatMap(s => s.fields || [])
        .find(f => f && f.label && (f.label.toLowerCase().includes('unit') || f.label.toLowerCase().includes('facility')));

      const searchFieldToUse = searchTerm && /^[0-9A-Za-z-]+$/.test(searchTerm) && /\d/.test(searchTerm) ? 'employeeId' : 'applicantName';

      const result = await getPaginatedEmployees(
        viewMode,
        25,
        currentLastDoc,
        selectedSite !== 'ALL' ? 'currentSiteId' : undefined,
        selectedSite !== 'ALL' ? selectedSite : undefined,
        searchTerm,
        searchFieldToUse,
        hasViewScopeAll ? 'ALL' : (effectiveAllowedSiteIds || [])
      );

      setPaginatedData(result.employees || []);
      setLastDoc(result.lastDoc);
      setHasMore(result.hasMore);

      if (direction === 'next') {
        setCurrentPage(prev => prev + 1);
        if (result.lastDoc) setPageHistory(prev => [...prev, result.lastDoc]);
      } else if (direction === 'initial' && result.lastDoc) {
        setPageHistory([result.lastDoc]);
      }

      setHasLoadedInitial(true);
    } catch (err: any) {
      console.error("Pagination Error:", err);
      setError(err.message || "Failed to load data.");
    } finally {
      setIsLoading(false);
    }
  };

  // Debounce search effect
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Effect to load initial data when viewMode, selectedSite, debouncedSearchTerm, or allowedSiteIds changes
  React.useEffect(() => {
    loadPage('initial');
  }, [viewMode, selectedSite, debouncedSearchTerm, allowedSitesKey, effectiveIsSuperAdmin, hasViewScopeAll]);

  const employees = useMemo(() => {
    return paginatedData;
  }, [paginatedData]);



  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig?.key !== columnKey) return <ArrowUpDown size={12} className="inline ml-1 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />;
    return sortConfig.direction === 'asc' ? <ArrowUp size={12} className="inline ml-1 text-blue-500" /> : <ArrowDown size={12} className="inline ml-1 text-blue-500" />;
  };

  const filteredEmployees = useMemo(() => {
    if (!hasViewScopeAll && (!effectiveAllowedSiteIds || effectiveAllowedSiteIds.length === 0)) {
      return [];
    }

    return paginatedData.filter(emp => {
      // Safeguard: Ensure record exists
      if (!emp) return false;

      // Ensure data object exists to prevent crashes on property access
      const data = emp.data || {};

      const name = (emp.applicantName || data['7debf274-baee-4bac-a137-4b4b46719874'] || '').toLowerCase();
      const id = (emp.employeeId || '').toLowerCase();

      const matchesSearch = searchTerm === '' ||
        name.includes(searchTerm.toLowerCase()) ||
        id.includes(searchTerm.toLowerCase()) ||
        Object.values(data).some(val => String(val || '').toLowerCase().includes(searchTerm.toLowerCase()));

      const unitField = allFormFields.find(f => f && f.label && (f.label.toLowerCase().includes('unit') || f.label.toLowerCase().includes('facility')));
      const unit = unitField ? (data[unitField.id] || '').toLowerCase() : '';
      const matchesSite = selectedSite === 'ALL' || unit === selectedSite.toLowerCase();

      // Column-level filters
      let matchesColumnFilters = true;
      for (const [colId, filterVal] of Object.entries(columnFilters)) {
        const strVal = String(filterVal || '');
        if (!strVal || strVal.trim() === '') continue;
        const q = strVal.toLowerCase().trim();
        
        let valToMatch = '';
        if (colId === 'name') valToMatch = name;
        else if (colId === 'employeeId') valToMatch = id;
        else if (colId === 'status') {
           const isActive = !((emp as any).isRelieved || (emp as any).isBlocked);
           valToMatch = isActive ? 'active' : 'relieved';
        }
        else if (colId === 'auth') {
           valToMatch = ((emp as any).authProvider === 'google' ? 'google' : 'manual');
        }
        else if (colId === 'siteName') valToMatch = (emp.siteName || '').toLowerCase();
        else if (colId === 'recruitedByName') valToMatch = (emp.recruitedByName || '').toLowerCase();
        else valToMatch = String(data[colId] || '').toLowerCase();

        if (!valToMatch.includes(q)) {
          matchesColumnFilters = false;
          break;
        }
      }

      return matchesSearch && matchesSite && matchesColumnFilters;
    }).sort((a, b) => {
      // Custom Sorting
      if (sortConfig) {
        let valA: any = '';
        let valB: any = '';
        const dataA = a.data || {};
        const dataB = b.data || {};

        if (sortConfig.key === 'name') { valA = a.applicantName || ''; valB = b.applicantName || ''; }
        else if (sortConfig.key === 'employeeId') { valA = a.employeeId || ''; valB = b.employeeId || ''; }
        else if (sortConfig.key === 'status') { valA = !((a as any).isRelieved || (a as any).isBlocked) ? 1 : 0; valB = !((b as any).isRelieved || (b as any).isBlocked) ? 1 : 0; }
        else if (sortConfig.key === 'auth') { valA = (a as any).authProvider || 'manual'; valB = (b as any).authProvider || 'manual'; }
        else if (sortConfig.key === 'siteName') { valA = a.siteName || ''; valB = b.siteName || ''; }
        else if (sortConfig.key === 'recruitedByName') { valA = a.recruitedByName || ''; valB = b.recruitedByName || ''; }
        else if (sortConfig.key === 'joiningDate') { valA = (a as any).joiningDate || a.timestamp || ''; valB = (b as any).joiningDate || b.timestamp || ''; }
        else { valA = dataA[sortConfig.key] || ''; valB = dataB[sortConfig.key] || ''; }

        // Handle string comparison nicely
        if (typeof valA === 'string' && typeof valB === 'string') {
          valA = valA.toLowerCase();
          valB = valB.toLowerCase();
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      }

      // Default fallback sort by date
      const dateA = (a as any).joiningDate || a.timestamp || '';
      const dateB = (b as any).joiningDate || b.timestamp || '';
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  }, [paginatedData, searchTerm, selectedSite, allFormFields, columnFilters, sortConfig, hasViewScopeAll, effectiveAllowedSiteIds]);

  // Derived Stats
  const stats = useMemo(() => {
    return {
      totalActive: employees.filter(e => e.status === SubmissionStatus.APPROVED || (e as any).isActive).length,
      googleAuth: employees.filter(e => (e as any).authProvider === 'google').length,
      manualAuth: employees.filter(e => (e as any).authProvider !== 'google').length,
      pending: employees.filter(e => (e as any).needsProfileCompletion).length
    };
  }, [employees]);

  const canExport = isSuperAdmin || hasPermission(Permission.EXPORT_DATA);
  const canDelete = isSuperAdmin || hasPermission(Permission.DELETE_EMPLOYEE);
  const canViewSensitive = isSuperAdmin || hasPermission(Permission.VIEW_SENSITIVE_INFO);

  const isSensitiveField = (label: string) => {
    const sensitiveKeywords = ['mobile', 'phone', 'email', 'bank', 'account', 'aadhaar', 'pan', 'ifsc', 'salary', 'ctc', 'amount'];
    return sensitiveKeywords.some(k => label.toLowerCase().includes(k));
  };


  const formatValue = (val: any, fieldLabel?: string) => {
    if (val === null || val === undefined || String(val).trim() === '') return '-';

    // Mask sensitive data if permission is missing
    if (fieldLabel && isSensitiveField(fieldLabel) && !canViewSensitive) {
      return '••••••••';
    }

    if (Array.isArray(val)) return val.join(', ');
    return String(val);
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredEmployees.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEmployees.map(e => e.id)));
    }
  };

  const handleBulkAction = async (action: 'SOFT_DELETE' | 'PERMANENT_DELETE') => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const confirmMsg = action === 'SOFT_DELETE'
      ? `Move ${ids.length} employees to Recycle Bin?`
      : `PERMANENTLY DELETE ${ids.length} records? This cannot be undone.`;

    if (window.confirm(confirmMsg)) {
      try {
        if (action === 'SOFT_DELETE' && onBulkSoftDelete) {
          await onBulkSoftDelete(ids);
        } else if (action === 'PERMANENT_DELETE' && onBulkDelete) {
          await onBulkDelete(ids);
        }
        // Remove from local state for immediate feedback
        setPaginatedData(prev => prev.filter(emp => !selectedIds.has(emp.id) && !selectedIds.has(emp.employeeId || '')));
        setSelectedIds(new Set());
      } catch (err) {
        console.error("Bulk action failed:", err);
      }
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error loading data: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {/* Quick Stats Bar */}
      <div className={`grid grid-cols-2 ${hasPermission(Permission.EMPLOYEES_MANAGE_SECURITY) ? 'md:grid-cols-4' : 'md:grid-cols-2'} gap-4`}>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center">
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center mr-3"><User size={20} className="text-blue-600" /></div>
          <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Monitored</p><p className="text-xl font-black text-gray-800">{companyStats.total}</p></div>
        </div>
        {hasPermission(Permission.EMPLOYEES_MANAGE_SECURITY) && (
          <>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center">
              <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center mr-3"><Globe size={20} className="text-green-600" /></div>
              <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Google Auth</p><p className="text-xl font-black text-gray-800">{companyStats.googleAuth}</p></div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mr-3"><Lock size={20} className="text-slate-600" /></div>
              <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Manual Auth</p><p className="text-xl font-black text-gray-800">{companyStats.manualAuth}</p></div>
            </div>
          </>
        )}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center">
          <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center mr-3"><AlertTriangle size={20} className="text-amber-600" /></div>
          <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pending Profile</p><p className="text-xl font-black text-gray-800">{companyStats.pending}</p></div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 transition-all duration-300">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            {hasTabPermission('ACTIVE') && (
              <button onClick={() => setViewMode('ACTIVE')} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${viewMode === 'ACTIVE' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Active</button>
            )}
            {hasTabPermission('PENDING') && (
              <button onClick={() => setViewMode('PENDING')} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${viewMode === 'PENDING' ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Pending Profiles</button>
            )}
            {hasTabPermission('RELIEVED') && (
              <button onClick={() => setViewMode('RELIEVED')} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${viewMode === 'RELIEVED' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Relieved</button>
            )}
            {hasTabPermission('RECYCLE_BIN') && (
              <button onClick={() => setViewMode('RECYCLE_BIN')} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${viewMode === 'RECYCLE_BIN' ? 'bg-white text-red-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Recycle Bin</button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hasPermission(Permission.EMPLOYEES_SEARCH) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowGlobalSearch(!showGlobalSearch)}
                className={`flex items-center h-9 px-4 rounded-xl transition-all duration-200 border shadow-sm ${
                  showGlobalSearch 
                    ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700' 
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400 hover:text-blue-600'
                }`}
              >
                <Search size={16} className={`mr-2 ${showGlobalSearch ? 'text-white' : 'text-slate-400'}`} />
                <span className="font-black uppercase tracking-tight text-[11px]">Database Search</span>
                <div className={`ml-2 h-1.5 w-1.5 rounded-full ${showGlobalSearch ? 'bg-white animate-pulse' : 'bg-slate-300'}`} />
              </Button>
            )}
            {hasPermission(Permission.EMPLOYEES_COLUMN_FILTER) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsColumnSettingsOpen(true)}
                className="flex items-center bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200"
              >
                <Columns size={16} className="mr-2" />
                Columns
              </Button>
            )}
            {hasPermission(Permission.EMPLOYEES_IMPORT) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsImportModalOpen(true)}
                className="flex items-center"
              >
                <Upload size={16} className="mr-2" />
                Import
              </Button>
            )}
            {canExport && onExport && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onExport(employees)}
                className="flex items-center bg-green-50 text-green-700 hover:bg-green-100 border-green-200"
              >
                <Upload size={16} className="mr-2 rotate-180" />
                Export
              </Button>
            )}
          </div>
        </div>

        {showGlobalSearch && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col md:flex-row md:items-end gap-4 animate-in slide-in-from-top-2 fade-in duration-200">
            <div className="flex-grow relative">
              <Search size={16} className="absolute left-3 top-9 text-gray-400" />
              <Input
                label="Search Entire Database by Name"
                placeholder="Enter employee name to fetch from server..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 bg-white"
              />
            </div>
            <div className="w-full md:w-64">
              <label className="block text-sm font-medium text-gray-700 mb-1">Filter Database by Site</label>
              <select
                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md border bg-white"
                value={selectedSite}
                onChange={e => setSelectedSite(e.target.value)}
              >
                <option value="ALL">All Company Sites</option>
                {safeSites.filter(s => s && s.status === 'Active').map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
            {(searchTerm || selectedSite !== 'ALL') && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setSearchTerm('');
                  setSelectedSite('ALL');
                }}
                className="text-red-500 hover:bg-red-50 hover:text-red-700"
              >
                Clear Search
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-600 text-white p-4 rounded-xl shadow-lg flex items-center justify-between animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center space-x-4">
            <div className="bg-white/20 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest">
              {selectedIds.size} Selected
            </div>
            <p className="text-sm font-bold">Perform bulk actions on selected records</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              className="bg-white/10 hover:bg-white/20 border-white/20 text-white font-bold"
              onClick={() => setSelectedIds(new Set())}
            >
              Cancel
            </Button>
            {canDelete && (viewMode === 'RECYCLE_BIN' || viewMode === 'PENDING') ? (
              <Button
                variant="danger"
                className="bg-red-500 hover:bg-red-600 border-none font-bold shadow-lg"
                onClick={() => handleBulkAction('PERMANENT_DELETE')}
              >
                <Trash2 size={16} className="mr-2" /> {viewMode === 'RECYCLE_BIN' ? 'Bulk Purge Records' : 'Directly Delete Records'}
              </Button>
            ) : canDelete ? (
              <Button
                variant="secondary"
                className="bg-orange-500 hover:bg-orange-600 border-none text-white font-bold shadow-lg"
                onClick={() => handleBulkAction('SOFT_DELETE')}
              >
                <Trash2 size={16} className="mr-2" /> Move to Recycle Bin
              </Button>
            ) : null}
          </div>
        </div>
      )}

      <div className="bg-white shadow-md rounded-xl overflow-hidden border border-gray-200">
        <div className="overflow-x-auto max-h-[65vh] overflow-y-auto custom-scrollbar relative isolate">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm border-b border-gray-200">
              <tr>
                {canDelete && (
                  <th className="px-4 py-4 text-center w-10 border-b border-gray-200">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      checked={filteredEmployees.length > 0 && selectedIds.size === filteredEmployees.length}
                      onChange={handleToggleSelectAll}
                    />
                  </th>
                )}
                <th className="px-4 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest w-10 border-b border-gray-200"><Settings size={14} className="mx-auto" /></th>
                {isVisible('name') && <th onClick={() => handleSort('name')} className="px-6 py-4 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest cursor-pointer hover:bg-gray-100 group border-b border-gray-200">Personnel <SortIcon columnKey="name" /></th>}
                {isVisible('employeeId') && <th onClick={() => handleSort('employeeId')} className="px-6 py-4 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest cursor-pointer hover:bg-gray-100 group border-b border-gray-200">Emp ID <SortIcon columnKey="employeeId" /></th>}
                {isVisible('auth') && <th onClick={() => handleSort('auth')} className="px-6 py-4 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest cursor-pointer hover:bg-gray-100 group border-b border-gray-200">Auth <SortIcon columnKey="auth" /></th>}
                {isVisible('siteName') && <th onClick={() => handleSort('siteName')} className="px-6 py-4 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest cursor-pointer hover:bg-gray-100 group border-b border-gray-200">Deployment / Site <SortIcon columnKey="siteName" /></th>}
                {allFormFields.filter(f => f.id !== 'siteName').map(field => isVisible(field.id) && <th key={field.id} onClick={() => handleSort(field.id)} className="px-6 py-4 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap cursor-pointer hover:bg-gray-100 group border-b border-gray-200">{field.label} <SortIcon columnKey={field.id} /></th>)}
                {isVisible('recruitedByName') && <th onClick={() => handleSort('recruitedByName')} className="px-6 py-4 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest cursor-pointer hover:bg-gray-100 group border-b border-gray-200">Referred By <SortIcon columnKey="recruitedByName" /></th>}
                {isVisible('joiningDate') && <th onClick={() => handleSort('joiningDate')} className="px-6 py-4 text-center text-[10px] font-black text-gray-500 uppercase tracking-widest cursor-pointer hover:bg-gray-100 group border-b border-gray-200">Joined On <SortIcon columnKey="joiningDate" /></th>}
              </tr>
              {/* Column Filters Row */}
              {hasPermission(Permission.EMPLOYEES_COLUMN_FILTER) && (
                <tr className="bg-white/50 backdrop-blur-sm border-b border-gray-200">
                  <th className="px-1 py-1" colSpan={canDelete ? 2 : 1}>
                    <Button variant="ghost" size="sm" onClick={() => setColumnFilters({})} className="text-[10px] h-6 flex items-center justify-center w-full text-slate-500 hover:text-rose-600 font-bold uppercase"><Filter size={10} className="mr-1" /> Clear</Button>
                  </th>
                  {isVisible('name') && <th className="px-2 py-1"><input type="text" placeholder="Filter..." value={columnFilters['name'] || ''} onChange={e => setColumnFilters(p => ({ ...p, name: e.target.value }))} className="w-full text-xs px-2 py-1 border border-gray-200 rounded text-gray-600 focus:ring-1 focus:ring-blue-500 bg-white" /></th>}
                  {isVisible('employeeId') && <th className="px-2 py-1"><input type="text" placeholder="Filter..." value={columnFilters['employeeId'] || ''} onChange={e => setColumnFilters(p => ({ ...p, employeeId: e.target.value }))} className="w-full text-xs px-2 py-1 border border-gray-200 rounded text-gray-600 focus:ring-1 focus:ring-blue-500 bg-white" /></th>}
                  {isVisible('auth') && (
                    <th className="px-2 py-1">
                      <select value={columnFilters['auth'] || ''} onChange={e => setColumnFilters(p => ({ ...p, auth: e.target.value }))} className="w-full text-[10px] px-1 py-1 border border-gray-200 rounded text-gray-600 focus:ring-1 focus:ring-blue-500 bg-white">
                        <option value="">All Auth</option>
                        <option value="google">Google</option>
                        <option value="manual">Manual</option>
                      </select>
                    </th>
                  )}
                  {isVisible('siteName') && <th className="px-2 py-1"><input type="text" placeholder="Filter..." value={columnFilters['siteName'] || ''} onChange={e => setColumnFilters(p => ({ ...p, siteName: e.target.value }))} className="w-full text-xs px-2 py-1 border border-gray-200 rounded text-gray-600 focus:ring-1 focus:ring-blue-500 bg-white" /></th>}
                  {allFormFields.filter(f => f.id !== 'siteName').map(field => isVisible(field.id) && <th key={`filter-${field.id}`} className="px-2 py-1"><input type="text" placeholder="Filter..." value={columnFilters[field.id] || ''} onChange={e => setColumnFilters(p => ({ ...p, [field.id]: e.target.value }))} className="w-full text-xs px-2 py-1 border border-gray-200 rounded text-gray-600 focus:ring-1 focus:ring-blue-500 bg-white min-w-[100px]" /></th>)}
                  {isVisible('recruitedByName') && <th className="px-2 py-1"><input type="text" placeholder="Filter..." value={columnFilters['recruitedByName'] || ''} onChange={e => setColumnFilters(p => ({ ...p, recruitedByName: e.target.value }))} className="w-full text-xs px-2 py-1 border border-gray-200 rounded text-gray-600 focus:ring-1 focus:ring-blue-500 bg-white" /></th>}
                  {isVisible('joiningDate') && <th className="px-2 py-1"><input type="date" value={columnFilters['joiningDate'] || ''} onChange={e => setColumnFilters(p => ({ ...p, joiningDate: e.target.value }))} className="w-full text-[10px] px-1 py-1 border border-gray-200 rounded text-gray-600 focus:ring-1 focus:ring-blue-500 bg-white" /></th>}
                </tr>
              )}
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={100} className="px-6 py-16 text-center">
                    <Database size={48} className="mx-auto text-gray-200 mb-3" />
                    <p className="text-gray-400 italic">No matching personnel records found in the directory.</p>
                  </td>
                </tr>
              ) : (
                filteredEmployees.map(emp => {
                  // Safe accessors
                  const data = emp.data || {};
                  const safeEmp = emp || {};

                  return (
                    <tr key={emp.id} className={`hover:bg-blue-50/30 transition-colors group ${selectedIds.has(emp.id) ? 'bg-blue-50/50' : ''}`}>
                      {canDelete && (
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <input
                             type="checkbox"
                             className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                             checked={selectedIds.has(emp.id)}
                             onChange={() => handleToggleSelect(emp.id)}
                          />
                        </td>
                      )}
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <button onClick={() => { setManagementTarget(emp); setNewIdValue(emp.employeeId || ''); setIsManagementModalOpen(true); }} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-colors"><Settings size={18} /></button>
                      </td>
                      {isVisible('name') && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs uppercase shadow-sm">{(emp.applicantName || 'E').charAt(0)}</div>
                            <div className="ml-3">
                              <div className="text-sm font-bold text-gray-900 group-hover:text-blue-700">
                                {emp.applicantName || 'N/A'}
                                {((safeEmp as any).employmentHistory?.length > 0 || (safeEmp as any).previousEmployeeId || (safeEmp as any).importedVia === 'rejoin') && <span className="ml-2 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-black uppercase">Rejoined</span>}
                                {((safeEmp as any).resignationStatus === 'Notice Period' || (safeEmp as any).pendingRelievingDate) && (
                                  <span className="ml-2 text-[10px] bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded font-black uppercase">
                                    Notice Period (Until {new Date((safeEmp as any).pendingRelievingDate || (safeEmp as any).relievingDate).toLocaleDateString()})
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {hasPermission(Permission.EMPLOYEES_VIEW_ONBOARDING_METHOD) && (
                                  <>
                                    {((safeEmp as any).importedVia === 'bulk_upload' || (safeEmp as any).importedVia === 'pending_profile_import') ? (
                                      <>
                                        <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-black uppercase flex items-center">
                                          <Database size={8} className="mr-1" /> Bulk Import
                                        </span>
                                        <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-black uppercase flex items-center">
                                          <ShieldCheck size={8} className="mr-1" /> System Approved
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-black uppercase flex items-center">
                                          <User size={8} className="mr-1" /> Self Onboarded
                                        </span>
                                        <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-black uppercase flex items-center">
                                          <CheckCircle size={8} className="mr-1" /> Admin Approved
                                        </span>
                                      </>
                                    )}
                                  </>
                                )}
                                {(safeEmp as any).profileCompletionStatus === 'INCOMPLETE' || (safeEmp as any).needsProfileCompletion ? (
                                  <div className="flex flex-col gap-0.5 mt-0.5">
                                    <span className="text-[9px] bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded font-black uppercase flex items-center shadow-xs">
                                      <AlertTriangle size={8} className="mr-1 text-amber-600" /> Incomplete Profile
                                    </span>
                                    {(safeEmp as any).pendingProfileFields?.length > 0 && (
                                      <span
                                        className="text-[8px] text-amber-700 font-semibold truncate max-w-[130px]"
                                        title={(safeEmp as any).pendingProfileFields.map((fId: string) => allFormFields.find(f => f.id === fId)?.label || fId).join(', ')}
                                      >
                                        Pending: {(safeEmp as any).pendingProfileFields.map((fId: string) => allFormFields.find(f => f.id === fId)?.label || fId).join(', ')}
                                      </span>
                                    )}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </td>
                      )}
                      {isVisible('employeeId') && <td className="px-6 py-4 whitespace-nowrap"><span className="px-2 py-1 bg-gray-100 rounded text-[10px] font-mono font-bold text-gray-600 border border-gray-200">{emp.employeeId}</span></td>}
                      {isVisible('auth') && (
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {(safeEmp as any).authProvider === 'google' || (safeEmp as any).uid ? (
                            <div className="flex flex-col items-center">
                              <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-black uppercase flex items-center shadow-sm border border-green-200">
                                <Globe size={10} className="mr-1" /> Google
                              </span>
                              <span className="text-[9px] text-gray-500 font-bold mt-1.5 truncate max-w-[160px] cursor-help" title={(safeEmp as any).linkedGoogleEmail || (safeEmp as any).email || 'No Email'}>
                                {(safeEmp as any).linkedGoogleEmail || (safeEmp as any).email || 'No Email'}
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center">
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-black uppercase flex items-center shadow-sm border border-slate-200">
                                <Lock size={10} className="mr-1" /> Manual
                              </span>
                              <span className="text-[9px] text-slate-400 font-bold mt-1.5 truncate max-w-[160px] cursor-help" title={(safeEmp as any).email || (safeEmp as any).linkedGoogleEmail || 'No Email'}>
                                {(safeEmp as any).email || (safeEmp as any).linkedGoogleEmail || 'No Email'}
                              </span>
                            </div>
                          )}
                        </td>
                      )}
                      {isVisible('siteName') && (() => {
                        const siteField = allFormFields.find(f => f.label?.toLowerCase().includes('unit') || f.label?.toLowerCase().includes('facility') || f.label?.toLowerCase().includes('site') || f.label?.toLowerCase().includes('location'));
                        const rawEmpSite = (emp.siteName && emp.siteName !== 'N/A' ? emp.siteName : null) || (siteField ? data[siteField.id] : null) || emp.currentSiteId;
                        const resolvedSite = (sites || []).find(s => s.id === rawEmpSite || s.name === rawEmpSite || s.id === emp.currentSiteId);
                        const displaySite = resolvedSite ? resolvedSite.name : (rawEmpSite && rawEmpSite !== 'N/A' ? rawEmpSite : 'Unassigned');
                        return (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-slate-800">{displaySite}</span>
                              {resolvedSite?.requiresBgv && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 w-fit mt-1">
                                  <ShieldCheck size={9} /> BGV Mandated
                                </span>
                              )}
                              {emp.activeAssignments && emp.activeAssignments.length > 1 && (
                                <span className="text-[10px] font-black text-green-600 uppercase flex items-center mt-1">
                                  <Plus size={10} className="mr-1" /> {emp.activeAssignments.filter(a => a.type === 'OT').length} OT Sites
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })()}
                      {allFormFields.filter(f => f.id !== 'siteName').map(field => {
                        if (!isVisible(field.id)) return null;
                        const value = data[field.id];
                        let valPath = typeof value === 'object' && value !== null && 'storagePath' in value
                          ? (value as any).storagePath
                          : (typeof value === 'string' ? value : null);
                        
                        return (
                          <td key={field.id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {field.type === FieldType.FILE_UPLOAD && valPath ? (
                              <SecureDocumentLink
                                path={valPath}
                                className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors border border-blue-100 font-bold text-[10px] uppercase shadow-sm"
                              />
                            ) : (
                              formatValue(value, field.label)
                            )}
                          </td>
                        );
                      })}
                      {isVisible('recruitedByName') && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {emp.recruitedByName || <span className="text-gray-400 font-medium italic">Direct Apply</span>}
                        </td>
                      )}
                      {isVisible('joiningDate') && (
                        <td className="px-6 py-4 whitespace-nowrap text-center text-xs font-bold text-gray-400">
                          {viewMode === 'RELIEVED' && (safeEmp as any).relievingDate
                            ? new Date((safeEmp as any).relievingDate).toLocaleDateString()
                            : ((safeEmp as any).joiningDate || emp.timestamp)
                              ? new Date(emp.timestamp || (safeEmp as any).joiningDate).toLocaleDateString()
                              : 'N/A'}
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {isManagementModalOpen && managementTarget && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden border border-gray-100 flex flex-col relative">
              <div className="bg-slate-50 p-6 border-b border-gray-100 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center"><Database size={20} className="mr-2 text-blue-600" /> Management</h3>
                  <p className="text-xs text-slate-500 font-bold mt-1">Actions for {managementTarget.applicantName || 'Personnel'}</p>
                </div>
                <button onClick={() => setIsManagementModalOpen(false)} className="p-2 hover:bg-white rounded-full text-gray-400 hover:text-gray-600"><X size={20} /></button>
              </div>

              {/* Tab Switcher */}
              <div className="flex bg-slate-50 border-b border-gray-100 px-6">
                <button
                  onClick={() => setActiveTab('DETAILS')}
                  className={`py-3 px-4 text-xs font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === 'DETAILS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                  General
                </button>
                {hasPermission(Permission.EMPLOYEES_MANAGE_DEPLOYMENTS) && (
                  <button
                    onClick={() => setActiveTab('DEPLOYMENTS')}
                    className={`py-3 px-4 text-xs font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === 'DEPLOYMENTS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                  >
                    Deployments
                  </button>
                )}
                {hasPermission(Permission.EMPLOYEES_MANAGE_CLIENT_IDS) && (
                  <button
                    onClick={() => setActiveTab('CLIENT_IDS')}
                    className={`py-3 px-4 text-xs font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === 'CLIENT_IDS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                  >
                    Client IDs
                  </button>
                )}
                {hasPermission(Permission.EMPLOYEES_MANAGE_SECURITY) && (
                  <button
                    onClick={() => setActiveTab('SECURITY' as any)}
                    className={`py-3 px-4 text-xs font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === ('SECURITY' as any) ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                  >
                    Security
                  </button>
                )}
              </div>

              <div className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
                {activeTab === 'DETAILS' && (
                  <>
                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                      <div className="flex items-center mb-3">
                        <div className="h-12 w-12 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-lg shadow-lg mr-4">{(managementTarget.applicantName || 'E').charAt(0).toUpperCase()}</div>
                        <div>
                          <p className="text-sm font-black text-slate-800">{managementTarget.applicantName || 'N/A'}</p>
                          <p className="text-xs font-bold text-blue-600 font-mono">ID: {managementTarget.employeeId || 'NOT ASSIGNED'}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mt-2 pt-2 border-t border-blue-100/50">
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Original Join</p>
                          <p className="text-xs font-bold text-slate-700">{(managementTarget as any).originalJoiningDate ? new Date((managementTarget as any).originalJoiningDate).toLocaleDateString() : (managementTarget as any).joiningDate ? new Date((managementTarget as any).joiningDate).toLocaleDateString() : 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active From</p>
                          <p className="text-xs font-bold text-slate-700">{(managementTarget as any).joiningDate ? new Date((managementTarget as any).joiningDate).toLocaleDateString() : 'N/A'}</p>
                        </div>
                      </div>
                    </div>

                    {/* History Section */}
                    <div className="pt-2">
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center"><Calendar size={12} className="mr-1" /> Employment History</label>
                        {onViewTimeline && managementTarget.employeeId && (
                          <button
                            onClick={() => {
                              setIsManagementModalOpen(false);
                              onViewTimeline(managementTarget.employeeId!);
                            }}
                            className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded font-bold uppercase transition-colors flex items-center"
                          >
                            <Clock size={10} className="mr-1" /> View Details
                          </button>
                        )}
                      </div>
                      {(managementTarget as any).employmentHistory?.length > 0 ? (
                        <div className="space-y-2 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                          {(managementTarget as any).employmentHistory.slice().reverse().map((stint: any, idx: number) => (
                            <div key={idx} className="p-2 bg-slate-50 rounded-lg border border-slate-100 flex justify-between items-center text-[10px]">
                              <div>
                                <p className="font-black text-slate-700">{new Date(stint.joiningDate).toLocaleDateString()} — {new Date(stint.relievingDate).toLocaleDateString()}</p>
                                <p className="text-slate-500 font-bold">{stint.relievingReason}</p>
                              </div>
                              <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded font-black uppercase">PAST</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 bg-slate-50 rounded-lg border border-slate-100 border-dashed text-slate-400 text-xs italic">
                          No past history records found.
                        </div>
                      )}
                    </div>

                    {hasPermission(Permission.EMPLOYEES_CORRECT_ID) && viewMode === 'ACTIVE' && (
                      <div className="pt-2 border-t border-gray-50">
                        <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2 block">Correct Employee Number</label>
                        <div className="flex gap-2">
                          <Input value={newIdValue} onChange={e => setNewIdValue(e.target.value)} placeholder="e.g. HY123456" className="font-mono font-bold flex-1" />
                          <Button variant="primary" className="bg-amber-600 hover:bg-amber-700" onClick={async () => {
                            if (newIdValue.trim() && onUpdateId) {
                              await onUpdateId(managementTarget.id, managementTarget.employeeId || '', newIdValue.trim());
                              setPaginatedData(prev => prev.map(emp => emp.id === managementTarget.id ? { ...emp, employeeId: newIdValue.trim() } : emp));
                              setIsManagementModalOpen(false);
                            }
                          }}>Update</Button>
                        </div>
                      </div>
                    )}

                    {(hasPermission(Permission.EMPLOYEES_EDIT_PROFILE) || hasPermission(Permission.EMPLOYEES_CORRECT_ID) || isSuperAdmin) && viewMode === 'ACTIVE' && (
                      <div className="pt-3 border-t border-gray-100">
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1">
                            <Calendar size={12} /> Edit Official Joining Date
                          </label>
                          <span className="text-[9px] font-bold text-slate-400">
                            Current: {(managementTarget as any).joiningDate ? new Date((managementTarget as any).joiningDate).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                        <div className="flex gap-2 items-center">
                          <Input
                            type="date"
                            value={newJoiningDateValue}
                            onChange={e => setNewJoiningDateValue(e.target.value)}
                            className="font-mono font-bold flex-1 text-xs"
                          />
                          <Button
                            variant="primary"
                            className="bg-blue-600 hover:bg-blue-700 shrink-0 text-xs px-3"
                            disabled={isUpdatingJoiningDate || !newJoiningDateValue}
                            onClick={handleSaveJoiningDate}
                          >
                            {isUpdatingJoiningDate ? 'Updating...' : 'Update Date'}
                          </Button>
                        </div>
                        <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer text-[10px] text-slate-500 hover:text-slate-700">
                          <input
                            type="checkbox"
                            checked={updateOriginalJoinDate}
                            onChange={e => setUpdateOriginalJoinDate(e.target.checked)}
                            className="h-3 w-3 text-blue-600 rounded border-gray-300"
                          />
                          <span>Also update original tenure join date</span>
                        </label>
                      </div>
                    )}

                    {/* Recruiter / Referred By Management */}
                    <div className="pt-3 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[10px] font-black text-purple-700 uppercase tracking-widest flex items-center gap-1">
                          <UserPlus size={12} /> Referred By / Recruiter
                        </label>
                        <span className="text-[9px] font-bold text-slate-500">
                          Current: {(managementTarget as any).recruitedByName ? (
                            <strong className="text-purple-900">{(managementTarget as any).recruitedByName}</strong>
                          ) : (
                            <span className="italic text-slate-400">Direct Apply</span>
                          )}
                        </span>
                      </div>
                      {effectiveIsSuperAdmin ? (
                        <div className="space-y-1.5">
                          <div className="flex gap-2 items-center">
                            <select
                              value={editingRecruiterId}
                              onChange={e => setEditingRecruiterId(e.target.value)}
                              className="font-medium flex-1 text-xs p-2 rounded-lg border border-purple-200 bg-white text-slate-800 focus:ring-1 focus:ring-purple-400"
                            >
                              <option value="">Direct Apply (No Referral)</option>
                              {(staffUsers || []).filter(s => !s.isDisabled).map(s => (
                                <option key={s.id} value={s.id}>
                                  {s.name} ({s.username || s.email})
                                </option>
                              ))}
                            </select>
                            <Button
                              variant="primary"
                              className="bg-purple-600 hover:bg-purple-700 shrink-0 text-xs px-3 shadow-xs"
                              disabled={isUpdatingRecruiter}
                              onClick={handleSaveRecruiter}
                            >
                              {isUpdatingRecruiter ? 'Saving...' : 'Update Recruiter'}
                            </Button>
                          </div>
                          <p className="text-[10px] text-slate-400">
                            Super Admin only. Updates commission and referral tracking for this employee.
                          </p>
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-100 italic">
                          {(managementTarget as any).recruitedByName ? `Referred by ${(managementTarget as any).recruitedByName}` : 'Direct Apply'} (Super Admin only)
                        </p>
                      )}
                    </div>

                    <div className="pt-4 border-t border-gray-50 flex flex-col gap-2">
                      {hasPermission(Permission.EMPLOYEES_REQUEST_CORRECTION) && (
                        <Button
                          variant="secondary"
                          className="w-full bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200 font-bold"
                          onClick={() => setIsCorrectionModalOpen(true)}
                        >
                          <Edit3 size={16} className="mr-2" /> Request Profile Correction
                        </Button>
                      )}

                      {isSuperAdmin && (
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                          <div>
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Drive Backup Status</p>
                            {(managementTarget as any).driveBackupStatus === 'completed' ? (
                              <span className="text-xs font-bold text-emerald-600 flex items-center mt-0.5">
                                <CheckCircle size={12} className="mr-1" /> Backed Up to Drive
                              </span>
                            ) : (
                              <span className="text-xs font-bold text-amber-600 flex items-center mt-0.5">
                                <AlertTriangle size={12} className="mr-1" /> Backup Pending
                              </span>
                            )}
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs shadow-sm"
                            onClick={async () => {
                              if (onSyncDrive) {
                                const targetId = managementTarget.employeeId || managementTarget.id;
                                await onSyncDrive(targetId);
                                setPaginatedData(prev => prev.map(emp => emp.id === managementTarget.id ? { ...emp, driveBackupStatus: 'completed' } : emp));
                              }
                            }}
                          >
                            <RefreshCw size={12} className="mr-1.5" /> {(managementTarget as any).driveBackupStatus === 'completed' ? 'Re-Sync' : 'Backup Now'}
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-50">
                      {viewMode === 'RECYCLE_BIN' ? (
                        <>
                          {(isSuperAdmin || userRole?.permissions.includes(Permission.EMPLOYEES_ACTION_RESTORE)) && (
                            <Button variant="secondary" className="w-full bg-green-50 text-green-700 font-bold" onClick={async () => {
                              const targetId = managementTarget.employeeId || managementTarget.id;
                              if (onRestore && targetId) {
                                await onRestore(targetId);
                                setPaginatedData(prev => prev.filter(emp => emp.id !== managementTarget.id));
                                setIsManagementModalOpen(false);
                              }
                            }}><RotateCcw size={16} className="mr-2" /> Restore</Button>
                          )}
                          {(isSuperAdmin || userRole?.permissions.includes(Permission.DELETE_EMPLOYEE)) && (
                            <Button variant="danger" className="w-full font-bold" onClick={async () => {
                              setIsManagementModalOpen(false);
                              if (onDelete) await onDelete(managementTarget.id);
                            }}><Trash2 size={16} className="mr-2" /> Purge</Button>
                          )}
                        </>
                      ) : viewMode === 'RELIEVED' ? (
                        <div className="flex flex-col gap-3 col-span-2">
                          <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                            <p className="text-xs text-purple-600 font-bold mb-2">
                              <UserMinus size={14} className="inline mr-1" />
                              Relieved on: {(managementTarget as any).relievingDate ? new Date((managementTarget as any).relievingDate).toLocaleDateString() : 'N/A'}
                            </p>
                            <p className="text-xs text-gray-500">Reason: {(managementTarget as any).relievingReason || 'N/A'}</p>
                          </div>
                          {(isSuperAdmin || userRole?.permissions.includes(Permission.EMPLOYEES_ACTION_REJOIN)) && (
                            <Button variant="secondary" className="w-full bg-green-600 text-white font-bold" onClick={() => {
                              // Initialize rejoin modal state and open it
                              setRejoinDate(new Date().toISOString().split('T')[0]);
                              setRejoinSiteId((managementTarget as any).currentSiteId || '');
                              setRejoinSubUnitId((managementTarget as any).subUnitId || '');
                              setRejoinDesignation((managementTarget as any).designation || 'Security Guard');
                              setIsRejoinModalOpen(true);
                            }}><UserPlus size={16} className="mr-2" /> Rejoin Employee</Button>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3 col-span-2">
                          {((managementTarget as any).profileCompletionStatus === 'INCOMPLETE' || ((managementTarget as any).pendingProfileFields && (managementTarget as any).pendingProfileFields.length > 0)) && (
                            <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 flex flex-col gap-2.5 shadow-xs">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase text-amber-800 tracking-wider flex items-center gap-1">
                                  <AlertTriangle size={12} className="text-amber-600" /> Incomplete Onboarding Profile
                                </span>
                                <span className="text-[9px] bg-amber-200/80 text-amber-900 font-bold px-1.5 py-0.5 rounded">
                                  Follow-up Pending
                                </span>
                              </div>

                              {(managementTarget as any).pendingProfileFields?.length > 0 && (
                                <div>
                                  <p className="text-[11px] font-bold text-amber-900 mb-1">Missing / Pending Fields:</p>
                                  <div className="flex flex-wrap gap-1">
                                    {(managementTarget as any).pendingProfileFields.map((fId: string) => {
                                      const f = allFormFields.find(field => field.id === fId);
                                      return (
                                        <span key={fId} className="text-[10px] bg-white border border-amber-300 text-red-700 font-semibold px-2 py-0.5 rounded-md shadow-xs">
                                          {f?.label || fId}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {(managementTarget as any).pendingProfileNote && (
                                <p className="text-xs text-amber-800 italic bg-amber-100/60 p-2 rounded border border-amber-200/60">
                                  "{(managementTarget as any).pendingProfileNote}"
                                </p>
                              )}

                              {(effectiveIsSuperAdmin || hasPermission(Permission.EMPLOYEES_MARK_PROFILE_COMPLETE)) && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs mt-1 shadow-sm"
                                  onClick={async () => {
                                    if (confirm("Mark this employee's profile as COMPLETE? This confirms all pending documents and compliance details have been fulfilled.")) {
                                      try {
                                        const { markEmployeeProfileComplete } = await import('../src/services/employeeService');
                                        const targetEmpId = managementTarget.employeeId || managementTarget.id;
                                        await markEmployeeProfileComplete(targetEmpId);
                                        setPaginatedData(prev => prev.map(emp => emp.id === managementTarget.id ? {
                                          ...emp,
                                          profileCompletionStatus: 'COMPLETE',
                                          needsProfileCompletion: false,
                                          pendingProfileFields: [],
                                          pendingProfileNote: '',
                                          profileStatus: 'approved'
                                        } : emp));
                                        setManagementTarget(prev => prev ? {
                                          ...prev,
                                          profileCompletionStatus: 'COMPLETE',
                                          needsProfileCompletion: false,
                                          pendingProfileFields: [],
                                          pendingProfileNote: '',
                                          profileStatus: 'approved'
                                        } as any : null);
                                        alert("Profile marked as Complete successfully!");
                                      } catch (err: any) {
                                        alert(`Failed: ${err.message}`);
                                      }
                                    }
                                  }}
                                >
                                  <ShieldCheck size={14} className="mr-1.5" /> Mark Profile Complete
                                </Button>
                              )}
                            </div>
                          )}

                          {managementTarget.employeeId && (
                            <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 flex flex-col gap-2">
                              {viewMode === 'PENDING' ? (
                                <>
                                  {(managementTarget as any).profileStatus === 'waiting_for_admin' ? (
                                    (isSuperAdmin || userRole?.permissions.includes(Permission.EMPLOYEES_EDIT_PROFILE)) && (
                                      <Button
                                        variant="primary"
                                        className="w-full bg-green-600 hover:bg-green-700 font-bold"
                                        onClick={async () => {
                                          if (confirm("Approve this profile and activate the employee?") && onApproveProfile && managementTarget.employeeId) {
                                            await onApproveProfile(managementTarget.employeeId);
                                            setPaginatedData(prev => prev.map(emp => emp.id === managementTarget.id ? { ...emp, needsProfileCompletion: false, profileStatus: 'approved' } : emp));
                                            setIsManagementModalOpen(false);
                                          }
                                        }}
                                      >
                                        <ShieldCheck size={16} className="mr-2" /> Approve Profile Completion
                                      </Button>
                                    )
                                  ) : (
                                    <div className="flex flex-col items-center justify-center p-4 bg-amber-50 rounded-xl border border-amber-200 border-dashed text-center">
                                      <FileClock size={20} className="text-amber-500 mb-2" />
                                      <p className="text-xs font-bold text-amber-800">Profile Not Submitted</p>
                                      <p className="text-[10px] text-amber-600 font-medium leading-relaxed mt-1">
                                        Waiting for the employee to complete and submit their profile details for approval.
                                      </p>
                                      {(effectiveIsSuperAdmin || hasPermission(Permission.EMPLOYEES_SEND_PROFILE_NUDGE)) && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="mt-3 w-full border-amber-300 text-amber-700 hover:bg-amber-100"
                                          onClick={async () => {
                                            alert("Reminder feature coming soon.");
                                          }}
                                        >
                                          <div className="flex items-center justify-center">
                                            <div className="mr-2">👋</div> Send Nudge / Reminder
                                          </div>
                                        </Button>
                                      )}
                                    </div>
                                  )}
                                </>
                              ) : (
                                (isSuperAdmin || userRole?.permissions.includes(Permission.EMPLOYEES_ACTION_RELIEVE)) && (
                                  <Button variant="secondary" className="w-full bg-purple-600 text-white font-bold" onClick={() => {
                                    setRelieveDate(new Date().toISOString().split('T')[0]);
                                    setRelieveReason('Resignation');
                                    setIsRelieveModalOpen(true);
                                  }}><UserMinus size={16} className="mr-2" /> Relieve Employee</Button>
                                )
                              )}
                            </div>
                          )}
                          {(isSuperAdmin || userRole?.permissions.includes(Permission.DELETE_EMPLOYEE)) && (
                            <Button variant="danger" className="w-full font-bold" onClick={async () => {
                              const isPending = viewMode === 'PENDING';
                              if (isPending) {
                                setIsManagementModalOpen(false);
                                if (onDelete) await onDelete(managementTarget.id);
                              } else {
                                if (window.confirm("Move to Recycle Bin?")) {
                                  if (onSoftDelete) {
                                    await onSoftDelete(managementTarget.id);
                                  }
                                  setPaginatedData(prev => prev.filter(emp => emp.id !== managementTarget.id));
                                  setIsManagementModalOpen(false);
                                }
                              }
                            }}><Trash2 size={16} className="mr-2" /> {viewMode === 'PENDING' ? 'Directly Delete Record' : 'Move to Recycle Bin'}</Button>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
                {activeTab === 'DEPLOYMENTS' && (
                  <div className="space-y-6">
                    {/* Active Assignments List */}
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">Current Active Assignments</label>
                      <div className="space-y-3">
                        {(!managementTarget.activeAssignments || managementTarget.activeAssignments.length === 0) ? (
                          <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 text-amber-700 text-xs font-bold flex items-center">
                            <ShieldCheck size={16} className="mr-2" /> No active site assignments found.
                          </div>
                        ) : (
                          managementTarget.activeAssignments.map(asgn => {
                            const siteField = allFormFields.find(f => f.label?.toLowerCase().includes('unit') || f.label?.toLowerCase().includes('facility') || f.label?.toLowerCase().includes('site') || f.label?.toLowerCase().includes('location'));
                            const targetData = managementTarget.data || managementTarget.profileData || (managementTarget as any).formData || {};
                            const rawTargetSite = (asgn.siteId && asgn.siteId !== 'Unassigned' ? asgn.siteId : null) || (managementTarget.siteName && managementTarget.siteName !== 'N/A' ? managementTarget.siteName : null) || (siteField ? targetData[siteField.id] : null) || managementTarget.currentSiteId;
                            const site = (sites || []).find(s => s.id === rawTargetSite || s.name === rawTargetSite || s.id === asgn.siteId);
                            const resolvedAssignmentSiteName = site?.name || (rawTargetSite && rawTargetSite !== 'Unassigned' && rawTargetSite !== 'N/A' ? rawTargetSite : (managementTarget.siteName && managementTarget.siteName !== 'N/A' ? managementTarget.siteName : 'Unassigned'));
                            const subunit = site?.subUnits?.find(u => u.id === asgn.subUnitId);
                            return (
                              <div key={asgn.id} className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm flex justify-between items-center group hover:border-blue-200 transition-all">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${asgn.type === 'PRIMARY' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{asgn.type}</span>
                                    <p className="text-sm font-black text-slate-800">{resolvedAssignmentSiteName}{subunit ? ` — ${subunit.name}` : ''}</p>
                                  </div>
                                  <p className="text-[10px] font-bold text-slate-500 flex items-center"><Briefcase size={10} className="mr-1" /> {asgn.designation} • Joined: {new Date(asgn.joiningDate).toLocaleDateString()}</p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-500 hover:bg-red-50 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={async () => {
                                    if (confirm(`Relieve from ${site?.name}?`)) {
                                      const reason = prompt("Relieving Reason?", "Resignation") || "Other";
                                      await relieveFromSite(managementTarget.id, asgn.id, new Date().toISOString(), reason);
                                      // Local update for immediate feedback
                                      setPaginatedData(prev => prev.map(emp => emp.id === managementTarget.id ? {
                                        ...emp,
                                        activeAssignments: (emp.activeAssignments || []).filter(a => a.id !== asgn.id)
                                      } : emp));
                                    }
                                  }}
                                >
                                  <LogOut size={16} />
                                </Button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Add New Assignment Form */}
                    <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-4">
                      <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest block flex items-center"><PlusCircle size={14} className="mr-1.5" /> Assign to New Site (OT/Regular)</label>
                      <div className="grid grid-cols-2 gap-3">
                        <Select label="Deployment Site" value={newAssignmentSiteId} onChange={e => { setNewAssignmentSiteId(e.target.value); setNewAssignmentSubUnitId(''); setNewAssignmentDesignation(''); }}>
                          <option value="">Select Site...</option>
                          {safeSites.filter(s => s && s.status === 'Active').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </Select>
                        <Select label="Sub-unit (Optional)" value={newAssignmentSubUnitId} onChange={e => setNewAssignmentSubUnitId(e.target.value)} disabled={!newAssignmentSiteId}>
                          <option value="">No specific unit</option>
                          {safeSites.find(s => s && s.id === newAssignmentSiteId)?.subUnits?.filter(u => u && u.status !== 'Inactive').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Input label="Join Date" type="date" value={newAssignmentDate} onChange={e => setNewAssignmentDate(e.target.value)} />
                        <Select label="Assignment Type" value={newAssignmentType} onChange={e => setNewAssignmentType(e.target.value as any)}>
                          <option value="PRIMARY">Regular / Primary</option>
                          <option value="OT">Extra Income / OT</option>
                        </Select>
                      </div>
                      <Select label="Designation" value={newAssignmentDesignation} onChange={e => setNewAssignmentDesignation(e.target.value)}>
                        <option value="">Select Designation...</option>
                        {(() => {
                          const selectedSiteObj = safeSites.find(s => s.id === newAssignmentSiteId);
                          const designations = selectedSiteObj?.allowedDesignations || [];
                          if (designations.length === 0) return <option value="Security Guard">Security Guard (Default)</option>;
                          return designations.map(d => <option key={d} value={d}>{d}</option>);
                        })()}
                      </Select>

                      <Button
                        variant="primary"
                        className="w-full bg-blue-600 hover:bg-blue-700 font-bold"
                        disabled={!newAssignmentSiteId || isAssigning}
                        onClick={async () => {
                          setIsAssigning(true);
                          try {
                            const newAsgn = {
                              siteId: newAssignmentSiteId,
                              subUnitId: newAssignmentSubUnitId || undefined,
                              designation: newAssignmentDesignation,
                              type: newAssignmentType,
                              joiningDate: newAssignmentDate,
                              status: 'Active' as const
                            };
                            await assignToSite(managementTarget.id, (newAsgn as any));
                            setPaginatedData(prev => prev.map(emp => emp.id === managementTarget.id ? {
                              ...emp,
                              activeAssignments: [...(emp.activeAssignments || []), { ...newAsgn, id: 'temp-' + Date.now() }]
                            } as any : emp));
                            setNewAssignmentSiteId('');
                          } finally {
                            setIsAssigning(false);
                          }
                        }}
                      >
                        {isAssigning ? <RefreshCw className="animate-spin mr-2" size={16} /> : <Plus size={16} className="mr-2" />} Confirm Assignment
                      </Button>
                    </div>
                  </div>
                )}

                {activeTab === 'CLIENT_IDS' && (
                  <div className="space-y-6">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1 flex items-center">
                        <Tag size={12} className="mr-1" /> Site-Specific Client IDs
                      </label>
                      <p className="text-xs text-slate-500 mb-4">
                        Provide the mandatory IDs required for this employee's assigned deployments.
                      </p>

                      {(() => {
                        // Gather all unique required IDs for this employee's active assignments
                        const assignedSiteIds = [
                          (managementTarget as any).currentSiteId,
                          ...(managementTarget.activeAssignments?.map((a: any) => a.siteId) || [])
                        ].filter(Boolean);

                        const requiredIdIds = new Set<string>();
                        assignedSiteIds.forEach(siteId => {
                          const site = (sites || []).find(s => s.id === siteId || s.name === siteId);
                          if (site?.requiredClientIdIds) {
                            site.requiredClientIdIds.forEach(id => requiredIdIds.add(id));
                          }
                        });

                        const uniqueRequiredIdIds = Array.from(requiredIdIds);

                        if (uniqueRequiredIdIds.length === 0) {
                          return (
                            <div className="p-8 bg-white rounded-2xl border-2 border-dashed border-gray-200 text-center flex flex-col items-center justify-center">
                              <ShieldAlert size={32} className="text-gray-300 mb-2" />
                              <p className="text-xs font-bold text-gray-400">No client-specific IDs are required for this employee's current deployments.</p>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-6">
                            {/* Global IDs from Library */}
                            {uniqueRequiredIdIds.length > 0 && (
                              <div className="space-y-4">
                                <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest block mb-1 px-1 flex items-center">
                                  <ShieldHalf size={12} className="mr-1.5" /> Library IDs (Validated)
                                </label>
                                <div className="space-y-4 bg-blue-50/30 p-4 rounded-xl border border-blue-100/50">
                                    {uniqueRequiredIdIds.map(id => {
                                      const def = (portalConfig?.clientIdDefinitions || []).find(d => d.id === id);
                                      if (!def) return null;
                                      
                                      const value = editingClientIds[id] || '';
                                      
                                      // If disabled and empty, don't show it for editing OR viewing
                                      if (def.isDisabled && !value) return null;
                                      
                                      // Validate
                                      let isValid = true;
                                      if (def.pattern) isValid = new RegExp(def.pattern).test(value);
                                      if (def.minLength && value.length < def.minLength) isValid = false;
                                      if (def.maxLength && value.length > def.maxLength) isValid = false;
                                      
                                      const error = value && !isValid ? (
                                        def.patternMessage || 
                                        (def.minLength && value.length < def.minLength ? `Min ${def.minLength} chars` : '') ||
                                        (def.maxLength && value.length > def.maxLength ? `Max ${def.maxLength} chars` : '') ||
                                        'Invalid format'
                                      ) : undefined;

                                      return (
                                        <div key={id} className="relative">
                                          <Input
                                            label={`${def.name}${def.isDisabled ? ' (Disabled)' : ''}`}
                                            value={value}
                                            onChange={e => {
                                              let val = e.target.value;
                                              if (def.fieldType === 'uppercase') val = val.toUpperCase();
                                              if (def.fieldType === 'number') val = val.replace(/[^0-9]/g, '');
                                              if (def.maxLength && val.length > def.maxLength) return;
                                              setEditingClientIds(prev => ({ ...prev, [id]: val }));
                                            }}
                                            placeholder={`Enter ${def.name}...`}
                                            error={error}
                                            className={value && isValid ? 'border-green-200 bg-green-50/10' : ''}
                                          />
                                          {def.description && <p className="text-[10px] text-gray-400 mt-1 ml-1 leading-tight">{def.description}</p>}
                                        </div>
                                      );
                                    })}
                            </div>
                          </div>
                        )}

                        <div className="pt-2">
                              <Button
                                variant="primary"
                                className="w-full bg-blue-600 font-bold"
                                disabled={isSavingClientIds}
                                onClick={async () => {
                                  if (!managementTarget.employeeId) return;
                                  setIsSavingClientIds(true);
                                  try {
                                    await updateEmployeeClientIds(managementTarget.employeeId, editingClientIds);
                                    
                                    // Update local state
                                    setPaginatedData(prev => prev.map(emp => 
                                      emp.id === managementTarget.id 
                                        ? { ...emp, clientIds: editingClientIds } as any
                                        : emp
                                    ));
                                    
                                    alert("Client IDs saved successfully.");
                                  } catch (err: any) {
                                    alert("Error saving IDs: " + err.message);
                                  } finally {
                                    setIsSavingClientIds(false);
                                  }
                                }}
                              >
                                {isSavingClientIds ? <RefreshCw className="animate-spin mr-2" size={16} /> : <Save size={16} className="mr-2" />} Save Client IDs
                              </Button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {activeTab === ('SECURITY' as any) && (
                  <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-3">Current Authentication</label>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          {(managementTarget as any).authProvider === 'google' || (managementTarget as any).linkedGoogleEmail || ((managementTarget as any).linkedUid && (managementTarget as any).linkedUid !== 'none') ? (
                            <div className="bg-green-100 p-2 rounded-lg mr-3 shadow-sm border border-green-200"><Globe size={20} className="text-green-600" /></div>
                          ) : (
                            <div className="bg-slate-100 p-2 rounded-lg mr-3 shadow-sm border border-slate-200"><Lock size={20} className="text-slate-600" /></div>
                          )}
                          <div>
                            <p className="text-sm font-black text-slate-800 uppercase">{(managementTarget as any).authProvider === 'google' || (managementTarget as any).linkedGoogleEmail || ((managementTarget as any).linkedUid && (managementTarget as any).linkedUid !== 'none') ? 'Google Linked' : 'Manual'} Login</p>
                            <p className="text-[10px] font-bold text-slate-400">{(managementTarget as any).linkedGoogleEmail || (managementTarget as any).email || 'No Email Linked'}</p>
                          </div>
                        </div>
                        {((managementTarget as any).authProvider === 'google' || (managementTarget as any).linkedGoogleEmail || ((managementTarget as any).linkedUid && (managementTarget as any).linkedUid !== 'none')) && (
                          <Button
                            variant="ghost"
                            className="text-red-600 hover:bg-red-50 text-[10px] font-black uppercase"
                            disabled={isAuthUpdating}
                            onClick={async () => {
                              if (window.confirm("Disconnect Google Auth? The employee will need to use their ID and manual password to login.")) {
                                setIsAuthUpdating(true);
                                try {
                                  await adminUnlinkGoogleAccount(managementTarget.employeeId!);
                                  setPaginatedData(prev => prev.map(e => e.id === managementTarget.id ? { ...e, authProvider: 'manual', uid: null, linkedUid: 'none', linkedGoogleEmail: null } as any : e));
                                } catch (e: any) {
                                  alert("Failed to disconnect Google account: " + e.message);
                                } finally {
                                  setIsAuthUpdating(false);
                                }
                              }
                            }}
                          >
                            Disconnect Google
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Manual Google Account Linking Section */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-3">Link Google Account Manually</label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Enter Google Email (e.g. employee@gmail.com)"
                          value={manualGoogleEmail}
                          onChange={e => setManualGoogleEmail(e.target.value)}
                          disabled={isAuthUpdating}
                          className="flex-1"
                        />
                        <Button
                          variant="primary"
                          className="bg-green-600 hover:bg-green-700 text-white font-bold uppercase text-[10px]"
                          disabled={isAuthUpdating || !manualGoogleEmail || !manualGoogleEmail.includes('@')}
                          onClick={async () => {
                            setIsAuthUpdating(true);
                            try {
                              const { adminLinkGoogleEmail } = await import('../src/services/employeeService');
                              await adminLinkGoogleEmail(managementTarget.employeeId!, manualGoogleEmail.trim());
                              alert("Google email linked successfully.");
                              setPaginatedData(prev => prev.map(e => e.id === managementTarget.id ? { ...e, linkedGoogleEmail: manualGoogleEmail.trim().toLowerCase(), linkedUid: 'none', authProvider: 'google' } as any : e));
                              setManualGoogleEmail('');
                            } catch (err: any) {
                              alert("Failed to link Google email: " + err.message);
                            } finally {
                              setIsAuthUpdating(false);
                            }
                          }}
                        >
                          Link Email
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest block flex items-center"><Key size={14} className="mr-1.5" /> Force Password Reset (Manual)</label>
                      <div className="space-y-3">
                        <Input
                          label="Set New Password for Employee"
                          type="password"
                          value={newManualPassword}
                          onChange={e => setNewManualPassword(e.target.value)}
                          placeholder="Enter new password (min 6 characters)"
                        />
                        <p className="text-[10px] text-gray-500 font-medium px-1">
                          Set a temporary password of your choice. When the employee logs in with this password, they will be required to change it to their own secret password.
                        </p>
                        <Button
                          variant="primary"
                          className="w-full bg-blue-600 font-bold"
                          disabled={newManualPassword.length < 6 || isAuthUpdating}
                          onClick={async () => {
                            setIsAuthUpdating(true);
                            try {
                              await adminResetEmployeePassword(managementTarget.employeeId!, newManualPassword);
                              alert("Password reset successfully.\n\nThe employee can log in with this password and will be prompted to change it immediately.");
                              setNewManualPassword('');
                            } catch (e: any) {
                              alert("Failed: " + e.message);
                            } finally {
                              setIsAuthUpdating(false);
                            }
                          }}
                        >
                          {isAuthUpdating ? <RefreshCw className="animate-spin mr-2" size={16} /> : <Shield size={16} className="mr-2" />} Reset Password & Require Change
                        </Button>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Login Email Sync</label>
                      <div className="flex gap-2">
                        <Input
                          className="flex-1"
                          placeholder="Personal/Work Email"
                          value={newAuthEmail}
                          onChange={e => setNewAuthEmail(e.target.value)}
                        />
                        <Button
                          variant="secondary"
                          disabled={!newAuthEmail.includes('@') || isAuthUpdating}
                          onClick={async () => {
                            setIsAuthUpdating(true);
                            try {
                              await adminUpdateEmployeeEmail(managementTarget.employeeId!, newAuthEmail);
                              setPaginatedData(prev => prev.map(e => e.id === managementTarget.id ? { ...e, email: newAuthEmail, linkedGoogleEmail: newAuthEmail } as any : e));
                              alert("Email updated across records.");
                            } finally {
                              setIsAuthUpdating(false);
                            }
                          }}
                        >
                          Update
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Relieve Employee Modal */}
        {isRelieveModalOpen && managementTarget && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="bg-purple-50 p-6 border-b border-purple-100 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-black text-purple-800 uppercase tracking-tight flex items-center"><UserMinus size={20} className="mr-2 text-purple-600" /> Relieve Employee</h3>
                  <p className="text-xs text-purple-500 font-bold mt-1">{managementTarget.applicantName || 'Personnel'}</p>
                </div>
                <button onClick={() => setIsRelieveModalOpen(false)} className="p-2 hover:bg-white rounded-full text-gray-400 hover:text-gray-600"><X size={20} /></button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Relieving Date <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={relieveDate}
                    onChange={(e) => setRelieveDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Reason</label>
                  <select
                    value={relieveReason}
                    onChange={(e) => setRelieveReason(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="Resignation">Resignation</option>
                    <option value="Termination">Termination</option>
                    <option value="Absconding">Absconding</option>
                    <option value="ContractEnded">Contract Ended</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button variant="secondary" className="flex-1" onClick={() => setIsRelieveModalOpen(false)}>Cancel</Button>
                  <Button variant="primary" className="flex-1 bg-purple-600 hover:bg-purple-700" disabled={!relieveDate} onClick={async () => {
                    if (onRelieve && managementTarget.employeeId && relieveDate) {
                      await onRelieve(managementTarget.employeeId, relieveDate, relieveReason);
                      setPaginatedData(prev => prev.filter(emp => emp.id !== managementTarget.id));
                      setIsRelieveModalOpen(false);
                      setIsManagementModalOpen(false);
                    }
                  }}><UserMinus size={16} className="mr-2" /> Confirm Relieving</Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Rejoin Modal */}
        {isRejoinModalOpen && managementTarget && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-800">Rejoin Employee</h3>
              </div>

              <p className="text-gray-600 mb-4">
                Configure the rejoining details for <strong>{managementTarget.applicantName || (managementTarget.data?.['Full Name'] as string) || managementTarget.employeeId}</strong>.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Rejoining Date *</label>
                  <input
                    type="date"
                    value={rejoinDate}
                    onChange={(e) => setRejoinDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                {isRehiring && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">New Employee ID</label>
                    <Input
                      value={rehireId}
                      onChange={(e) => setRehireId(e.target.value)}
                      placeholder="Enter new ID (e.g. HY123456)"
                    />
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Documents to Copy</label>
                    <div className="space-y-2 bg-gray-50 p-3 rounded-lg border border-gray-200">
                      {["Joining Documents", "Leave Requests", "Account Updates", "Resignations", "Disciplinary Actions"].map(folder => (
                        <div key={folder} className="flex items-center">
                          <input
                            type="checkbox"
                            id={`folder-${folder}`}
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            checked={selectedFolders.includes(folder)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedFolders(prev => [...prev, folder]);
                              } else {
                                setSelectedFolders(prev => prev.filter(f => f !== folder));
                              }
                            }}
                          />
                          <label htmlFor={`folder-${folder}`} className="ml-2 block text-sm text-gray-700">
                            {folder}
                          </label>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2 ml-1">
                      {selectedFolders.includes("Joining Documents")
                        ? "✅ Employee will be ACTIVE immediately (Profile considered complete)."
                        : "⚠️ Employee will be PENDING until new Joining Documents are uploaded."}
                    </p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Site *</label>
                  <select
                    value={rejoinSiteId}
                    onChange={(e) => {
                      setRejoinSiteId(e.target.value);
                      setRejoinSubUnitId(''); // Reset sub-unit when site changes
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="">Select Site</option>
                    {sites.filter(s => s && s.status === 'Active').map(site => (
                      <option key={site.id} value={site.id}>{site.name}</option>
                    ))}
                  </select>
                </div>

                {(() => {
                  const selectedSiteObj = sites.find(s => s.id === rejoinSiteId);
                  if (selectedSiteObj && selectedSiteObj.subUnits && selectedSiteObj.subUnits.length > 0) {
                    return (
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Sub-Unit (Optional)</label>
                        <select
                          value={rejoinSubUnitId}
                          onChange={(e) => setRejoinSubUnitId(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        >
                          <option value="">No Sub-Unit</option>
                          {selectedSiteObj.subUnits.map(sub => (
                            <option key={sub.id} value={sub.id}>{sub.name}</option>
                          ))}
                        </select>
                      </div>
                    );
                  }
                  return null;
                })()}

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Designation *</label>
                  <select
                    value={rejoinDesignation}
                    onChange={(e) => setRejoinDesignation(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    {(() => {
                      const designationField = allFormFields.find(f => f.id === 'designation' || f.label?.toLowerCase().includes('designation'));
                      if (designationField?.options && designationField.options.length > 0) {
                        return designationField.options.map((opt: string, idx: number) => (
                          <option key={idx} value={opt}>{opt}</option>
                        ));
                      }
                      return (
                        <>
                          <option value="Security Guard">Security Guard</option>
                          <option value="Security Supervisor">Security Supervisor</option>
                          <option value="Security Officer">Security Officer</option>
                          <option value="Manager">Manager</option>
                          <option value="Admin">Admin</option>
                        </>
                      );
                    })()}
                  </select>
                </div>

                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      id="isRehiring"
                      checked={isRehiring}
                      onChange={(e) => {
                        setIsRehiring(e.target.checked);
                        if (e.target.checked && !rehireId) {
                          setRehireId(`EMP-${Date.now().toString().slice(-6)}`);
                        }
                      }}
                      className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
                    />
                    <label htmlFor="isRehiring" className="text-sm font-semibold text-gray-700 cursor-pointer">
                      Re-hire with New Employee ID
                    </label>
                  </div>

                  {isRehiring && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1 ml-6">New Employee ID</label>
                      <input
                        type="text"
                        value={rehireId}
                        onChange={(e) => setRehireId(e.target.value)}
                        className="w-full ml-6 px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-green-500 focus:border-green-500 w-[calc(100%-1.5rem)]"
                        placeholder="e.g. EMP-101"
                      />
                      <p className="text-xs text-gray-500 mt-1 ml-6">
                        This will create a new employee record and link the old one as history.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <Button variant="secondary" className="flex-1" onClick={() => setIsRejoinModalOpen(false)}>Cancel</Button>
                  <Button variant="primary" className="flex-1 bg-green-600 hover:bg-green-700" disabled={!rejoinDate || !rejoinSiteId || !rejoinDesignation} onClick={async () => {
                    if (onRejoin && managementTarget.employeeId && rejoinDate && rejoinSiteId && rejoinDesignation) {
                      await onRejoin(
                        managementTarget.employeeId,
                        rejoinDate,
                        rejoinSiteId,
                        rejoinSubUnitId || undefined,
                        rejoinDesignation,
                        isRehiring ? rehireId : undefined,
                        isRehiring ? selectedFolders : []
                      );
                      setPaginatedData(prev => prev.filter(emp => emp.id !== managementTarget.id));
                      setIsRejoinModalOpen(false);
                      setIsManagementModalOpen(false);
                    }
                  }}><UserPlus size={16} className="mr-2" /> Confirm Rejoin</Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center text-blue-700 font-bold text-sm"><Info size={16} className="mr-2" /> Showing {filteredEmployees.length} records.</div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center bg-white rounded-lg border border-blue-200">
              <Button
                variant="ghost"
                disabled={currentPage === 1 || isLoading}
                onClick={() => loadPage('prev')}
                className="rounded-l-lg border-r border-blue-100 px-3"
              >
                Previous
              </Button>
              <div className="px-4 text-xs font-bold text-blue-800">
                Page {currentPage}
              </div>
              <Button
                variant="ghost"
                disabled={!hasMore || isLoading}
                onClick={() => loadPage('next')}
                className="rounded-r-lg border-l border-blue-100 px-3"
              >
                Next
              </Button>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {!isSuperAdmin && (<div className="text-[10px] text-blue-500 font-black uppercase tracking-widest bg-white px-3 py-1.5 rounded-full border border-blue-200 flex items-center"><ShieldAlert size={12} className="mr-1.5" /> Access Controlled by {userRole?.name} Policy</div>)}
            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Master List Mode: Read-Only</div>
          </div>
        </div>
      </div>

      {/* Column Visibility Settings Panel */}
      {isColumnSettingsOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex justify-end animate-in fade-in">
          <div className="bg-white w-full max-w-sm h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-black text-slate-800 uppercase tracking-tight flex items-center"><Columns size={18} className="mr-2 text-blue-600" /> Column Display</h3>
                <p className="text-[10px] text-slate-500 font-bold mt-1">Select which columns to show</p>
              </div>
              <button onClick={() => setIsColumnSettingsOpen(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-colors"><X size={18} /></button>
            </div>
            
            <div className="p-4 border-b border-gray-100 flex gap-2">
              <Button variant="secondary" size="sm" className="flex-1 text-[10px] font-black uppercase tracking-widest" onClick={() => {
                setUserVisibleColumns(new Set());
                localStorage.removeItem('masterListColumnPrefs');
              }}>Show All</Button>
              <Button variant="outline" size="sm" className="flex-1 text-[10px] font-black uppercase tracking-widest text-slate-500" onClick={() => {
                const minimalSet = new Set(['name', 'employeeId']);
                setUserVisibleColumns(minimalSet);
                localStorage.setItem('masterListColumnPrefs', JSON.stringify(Array.from(minimalSet)));
              }}>Hide Most</Button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar">
              <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest block mb-4 border-b border-blue-100 pb-2">Core Columns</label>
              {[
                { id: 'name', label: 'Personnel Name' },
                { id: 'employeeId', label: 'Employee ID' },
                { id: 'joiningDate', label: 'Joined Date' },
                { id: 'recruitedByName', label: 'Referred By' }
              ].map(col => (
               <div key={col.id} className="flex items-center">
                  <input
                    type="checkbox"
                    id={`col-${col.id}`}
                    checked={(userVisibleColumns.size === 0 || userVisibleColumns.has(col.id)) && !isFieldHiddenByRbac(col.id)}
                    onChange={() => {
                      if (userVisibleColumns.size === 0) {
                        const allActiveIds = ['name', 'employeeId', 'auth', 'siteName', 'joiningDate', 'recruitedByName', ...allFormFields.map(f => f.id)];
                        const newSet = new Set(allActiveIds.filter(id => {
                            if (isFieldHiddenByRbac(id)) return false;
                            return true;
                        }));
                        newSet.delete(col.id);
                        setUserVisibleColumns(newSet);
                        localStorage.setItem('masterListColumnPrefs', JSON.stringify(Array.from(newSet)));
                      } else {
                        toggleColumnVisibility(col.id);
                      }
                    }}
                    disabled={isFieldHiddenByRbac(col.id)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                  />
                  <label htmlFor={`col-${col.id}`} className="ml-3 block text-sm font-bold text-gray-700">{col.label}</label>
                </div>
              ))}

              <label className="text-[10px] font-black text-rose-600 uppercase tracking-widest block mb-4 mt-6 border-b border-rose-100 pb-2">Dynamic Form Fields</label>
              {allFormFields.filter(f => f.id !== 'siteName' && !isFieldHiddenByRbac(f.id)).map(field => (
                <div key={field.id} className="flex items-center mt-3">
                  <input
                    type="checkbox"
                    id={`col-${field.id}`}
                    checked={userVisibleColumns.size === 0 || userVisibleColumns.has(field.id)}
                    onChange={() => {
                      if (userVisibleColumns.size === 0) {
                        const allActiveIds = ['name', 'employeeId', 'auth', 'siteName', 'joiningDate', 'recruitedByName', ...allFormFields.map(f => f.id)];
                        const newSet = new Set(allActiveIds.filter(id => {
                            if (isFieldHiddenByRbac(id)) return false;
                            return true;
                        }));
                        newSet.delete(field.id);
                        setUserVisibleColumns(newSet);
                        localStorage.setItem('masterListColumnPrefs', JSON.stringify(Array.from(newSet)));
                      } else {
                        toggleColumnVisibility(field.id);
                      }
                    }}
                    disabled={isFieldHiddenByRbac(field.id)}
                    className="h-4 w-4 text-rose-500 border-gray-300 rounded focus:ring-rose-500 disabled:opacity-50"
                  />
                  <label htmlFor={`col-${field.id}`} className="ml-3 block text-sm font-bold text-gray-700">{field.label}</label>
                </div>
              ))}
            </div>
            
            <div className="p-4 border-t border-gray-100 bg-gray-50 text-center">
              <p className="text-[10px] text-gray-400 font-bold"><Info size={10} className="inline mr-1" /> Preferences are saved automatically to your device.</p>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      <BulkImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        sites={sites}
        formSections={formSections}
        onImportComplete={(result: BulkImportResult) => {
          if (result.successfulImports > 0) {
            loadPage('initial'); // Refresh list
          }
        }}
      />

      {isCorrectionModalOpen && managementTarget && (
        <RequestCorrectionModal
          isOpen={isCorrectionModalOpen}
          onClose={() => setIsCorrectionModalOpen(false)}
          targetId={managementTarget.id || managementTarget.employeeId}
          targetType="employee"
          applicantName={managementTarget.applicantName || 'Employee'}
          formSections={formSections}
          createdBy={authUser?.displayName || authUser?.email || 'Admin'}
          initialSelectedFields={(managementTarget as any).pendingProfileFields || []}
        />
      )}
    </div>
  );
};

export default AdminMasterEmployeeListPage;



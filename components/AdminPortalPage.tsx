
import React, { useState, useEffect, useMemo } from 'react';
import { updatePublicStats } from '../src/services/statsService';
import SectionItem from './SectionItem';
import Button from './common/Button';
import Input from './common/Input';
import { FormSection, FormField, SubmittedFormData, LeaveRequest, AccountUpdateRequest, ResignationRequest, RequestStatus, Role, StaffUser, Permission, User, WorkflowConfig, Site, LeaveBalance, DisciplinaryAction, LeavePolicy, PortalConfig, AuditLogEntry, Notification, DraftSubmission } from '../types';
import { PlusCircle, LogOut, Settings, Users, CalendarCheck, UserCheck, Home, ShieldHalf, UserPlus, Crown, GitBranch, CheckCircle, AlertCircle, X, MapPin, UserCircle, List, UserCog, FormInput, UserMinus, Gavel, ClipboardList, ChevronDown, ChevronRight, Building, Menu, ChevronLeft, Layout, Bell, FileClock, LayoutDashboard, Search, Briefcase, Archive, Link2, Globe, ShieldCheck, MessageSquare, Trash2 } from 'lucide-react';
import { AppView } from '../App';
import AdminReviewSubmissionsPage from './AdminReviewSubmissionsPage';
import AdminLeaveManagementPage from './AdminLeaveManagementPage';
import AdminAccountUpdateManagementPage from './AdminAccountUpdateManagementPage';
import AdminStaffManagementPage from './AdminStaffManagementPage';
import AdminRoleManagementPage from './AdminRoleManagementPage';
import AdminWorkflowConfigPage from './AdminWorkflowConfigPage';
import AdminSiteManagementPage from './AdminSiteManagementPage';
import AdminVacancyManager from './AdminVacancyManager';
import AdminStaffProfilePage from './AdminStaffProfilePage';
import AdminMasterEmployeeListPage from './AdminMasterEmployeeListPage';
import AdminResignationManagementPage from './AdminResignationManagementPage';
import AdminDisciplinaryPage from './AdminDisciplinaryPage';
import AdminDashboardPage from './AdminDashboardPage';
import AdminWebsiteManager from './AdminWebsiteManager';
import AdminAuditLogPage from './AdminAuditLogPage';
import AdminDraftsManagementPage from './AdminDraftsManagementPage';
import EmployeeTimelinePage from './events/EmployeeTimelinePage';
import AdminLegacySystemsPage from './AdminLegacySystemsPage';
import AdminTimelineSearchPage from './AdminTimelineSearchPage';
import AdminCorrectionRequestsPage from './AdminCorrectionRequestsPage';
import AdminInvitesPage from './AdminInvitesPage';
import AdminBgvManagementPage from './AdminBgvManagementPage';
import AdminGrievancesPage from './AdminGrievancesPage';
import AdminRecycleBinPage from './AdminRecycleBinPage';
import Breadcrumb from './common/Breadcrumb';
import { isNativeApp } from '../src/utils/capacitor-utils';


interface AdminPortalPageProps {
  currentAdminView: AppView;
  navigateTo: (view: AppView) => void;
  onLogout: () => void;
  authUser: User | null;
  isSuperAdmin: boolean;
  userRole?: Role;

  // Form Builder Props
  sections: FormSection[];
  addSection: (name: string) => void;
  updateSectionName: (sectionId: string, newName: string) => void;
  deleteSection: (sectionId: string) => void;
  toggleSectionStatus: (sectionId: string) => void;
  reorderSections: (sourceIndex: number, destinationIndex: number) => void;
  addField: (sectionId: string, fieldData: Omit<FormField, 'id' | 'order'>) => void;
  updateField: (sectionId: string, fieldId: string, updates: Partial<Omit<FormField, 'id' | 'order'>>) => void;
  deleteField: (sectionId: string, fieldId: string) => void;
  toggleFieldStatus: (sectionId: string, fieldId: string) => void;
  reorderFields: (sectionId: string, sourceIndex: number, destinationIndex: number) => void;
  setSections: (sections: FormSection[]) => void;

  // Account Update Configuration
  accountUpdateFields?: string[];



  // Submission Review Props
  submittedForms: SubmittedFormData[];
  onApproveSubmission: (
    submissionId: string,
    employeeId: string,
    comments?: string,
    isRejection?: boolean,
    isBypass?: boolean,
    profileCompletionData?: any,
    customJoiningDate?: string,
    customRecruiter?: { id: string | null; name: string | null }
  ) => void;
  onBulkAddEmployees: (newEmployees: SubmittedFormData[]) => void;

  // Leave Management Props
  leaveRequests: LeaveRequest[];
  onLeaveAction: (requestId: string, newStatus: RequestStatus, adminComments?: string, isBypass?: boolean) => void;
  leaveBalances: LeaveBalance[];
  leavePolicy: LeavePolicy;
  onUpdateLeavePolicy?: (policy: LeavePolicy) => void;
  onApproveProfile: (employeeId: string) => Promise<void>;

  // Account Update Props
  accountUpdateRequests: AccountUpdateRequest[];
  onAccountUpdateAction: (requestId: string, newStatus: RequestStatus, adminComments?: string, isBypass?: boolean) => void;

  // Resignation Props
  resignationRequests: ResignationRequest[];
  onResignationAction: (requestId: string, newStatus: RequestStatus, adminComments?: string, updatedRelievingDate?: string, isBypass?: boolean) => void;
  onRevertWorkflowRequest: (moduleId: 'LEAVES' | 'ACCOUNT_UPDATES' | 'RESIGNATIONS', requestId: string, level: number) => void;
  onDeleteRequest: (moduleId: 'LEAVES' | 'ACCOUNT_UPDATES' | 'RESIGNATIONS', requestId: string) => void;
  onDeleteDiscipline: (actionId: string) => void;

  // Management (Onboarding specific but handlers passed here)
  onRevertSubmission: (submissionId: string, level: number, comments?: string) => void;
  onDeleteSubmission: (submissionId: string) => void;
  onSoftDeleteSubmission: (submissionId: string) => void;
  onSoftDeleteEmployee: (employeeId: string) => void;
  onRestoreEmployee: (employeeId: string) => void;
  onRelieveEmployee: (employeeId: string, relievingDate: string, reason: 'Resignation' | 'Termination' | 'Absconding' | 'ContractEnded' | 'Other') => void;
  onRejoinEmployee: (employeeId: string, rejoinDate: string, siteId: string, subUnitId: string | undefined, designation: string, newEmployeeId?: string) => void;
  onUpdateSubmissionId: (submissionId: string, oldId: string, newId: string) => void;
  onSyncDrive?: (employeeId: string) => void;
  onBulkDelete?: (ids: string[]) => void;
  onBulkSoftDelete?: (ids: string[]) => void;

  // Disciplinary Props
  disciplinaryActions: DisciplinaryAction[];
  onAddDiscipline: (actionData: Omit<DisciplinaryAction, 'id' | 'filedBy' | 'filedByRoleId'>) => void;

  // RBAC & Workflow Management
  roles: Role[];
  setRoles: React.Dispatch<React.SetStateAction<Role[]>>;
  staffUsers: StaffUser[];
  setStaffUsers: React.Dispatch<React.SetStateAction<StaffUser[]>>;
  workflowConfigs: WorkflowConfig[];
  setWorkflowConfigs: React.Dispatch<React.SetStateAction<WorkflowConfig[]>>;

  // Site Management
  sites: Site[];
  setSites: React.Dispatch<React.SetStateAction<Site[]>>;

  // Portal Config (Global)
  portalConfig: PortalConfig;
  setPortalConfig: React.Dispatch<React.SetStateAction<PortalConfig>>;

  // Audit Logs
  // Audit Logs
  logAction: (
    actionType: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE' | 'APPROVAL' | 'REJECTION' | 'LOGIN' | 'LOGOUT' | 'SUBMIT' | 'EXPORT',
    targetModule: 'SITES' | 'STAFF' | 'ROLES' | 'LEAVES' | 'EMPLOYEES' | 'SYSTEM' | 'AUTH' | 'SUBMISSION' | 'BGV' | 'INVITES' | 'DISCIPLINARY' | 'SETTINGS',
    details: string
  ) => void;

  // Notifications
  notifications: Notification[];
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;

  // New Joiner Drafts
  drafts: DraftSubmission[];

  // Timeline
  timelineEmployeeId?: string | null;
  onViewTimeline?: (employeeId: string) => void;
  allowedSiteIds?: string[];

  // Stats
  onRefreshStats?: () => void;

  editableFieldIds: string[];
  setEditableFieldIds: (ids: string[]) => void;
  onUpdateComment?: (submissionId: string, historyIndex: number, newComment: string) => Promise<void>;
}

// Helper type for nested navigation
type NavItem = {
  id: string;
  view?: AppView;
  label: string;
  icon: React.ReactNode;
  visible: boolean;
  children?: NavItem[];
};

const AdminPortalPage: React.FC<AdminPortalPageProps> = (props) => {
  const {
    currentAdminView, navigateTo, onLogout, userRole, authUser, isSuperAdmin,
    sections, addSection, updateSectionName, deleteSection, toggleSectionStatus, reorderSections,
    addField, updateField, deleteField, toggleFieldStatus, reorderFields,
    editableFieldIds, setEditableFieldIds,
    submittedForms, onApproveSubmission, onBulkAddEmployees,
    leaveRequests, onLeaveAction, leaveBalances, leavePolicy, onUpdateLeavePolicy,
    accountUpdateRequests, onAccountUpdateAction,
    resignationRequests, onResignationAction, onRevertWorkflowRequest,
    onDeleteRequest, onDeleteDiscipline,
    onRevertSubmission, onDeleteSubmission, onUpdateSubmissionId,
    onSoftDeleteSubmission, onSoftDeleteEmployee, onRestoreEmployee,
    onRelieveEmployee, onRejoinEmployee,
    onSyncDrive, onBulkDelete, onBulkSoftDelete, onApproveProfile,
    disciplinaryActions, onAddDiscipline,
    roles, setRoles, staffUsers, setStaffUsers,
    workflowConfigs, setWorkflowConfigs,
    sites, setSites,
    portalConfig, setPortalConfig,
    onUpdateComment,

    logAction, // Keep logAction for child components if they use it
    notifications, markNotificationAsRead, markAllNotificationsAsRead,
    drafts,
    timelineEmployeeId, onViewTimeline,
    allowedSiteIds
  } = props;

  // Sync Public Stats on Mount (Lazy Sync for Super Admin only)
  useEffect(() => {
    if (isSuperAdmin) {
      updatePublicStats().catch(err => console.error("Failed to sync public stats:", err));
    }
  }, [isSuperAdmin]);

  const hasPermission = (p: Permission) => {
    if (isSuperAdmin) return true;
    if (userRole?.isDisabled === true) return false;
    const overrides = (authUser as any)?.permissionOverrides;
    if (overrides && overrides[p] !== undefined) {
      return Boolean(overrides[p]);
    }
    return Boolean(userRole?.permissions?.includes(p));
  };

  // New Export Handler
  const handleExportData = async (data: SubmittedFormData[]) => {
    try {
      const { exportEmployeesToCSV } = await import('../utils/exportUtils');
      // SECURITY: Pass RBAC permissions to the export generator
      const canViewSensitive = isSuperAdmin || hasPermission(Permission.VIEW_SENSITIVE_INFO);
      const getVisibleFieldIds = () => {
        if (isSuperAdmin) return null;
        if (userRole?.fieldVisibility) {
          const allFieldIds = sections.flatMap(s => s.fields || []).map(f => f.id);
          const essential = ['name', 'employeeId', 'siteName', 'joiningDate'];
          return [...essential, ...allFieldIds].filter(id => userRole.fieldVisibility?.[id] !== 'HIDDEN');
        }
        return userRole?.visibleMasterListFields || ['name', 'employeeId'];
      };
      const visibleFieldIds = getVisibleFieldIds();

      exportEmployeesToCSV(data, sections, visibleFieldIds, isSuperAdmin, canViewSensitive);
      logAction('EXPORT', 'EMPLOYEES', `Exported ${data.length} employee records`);
    } catch (e) {
      console.error("Export failed", e);
      alert("Failed to export data.");
    }
  };

  const [newSectionName, setNewSectionName] = useState('');
  const [activeTimelineEmployeeId, setActiveTimelineEmployeeId] = useState<string | null>(() => {
    try {
      return props.timelineEmployeeId || sessionStorage.getItem('activeTimelineEmployeeId') || null;
    } catch {
      return props.timelineEmployeeId || null;
    }
  });

  useEffect(() => {
    if (props.timelineEmployeeId) {
      setActiveTimelineEmployeeId(props.timelineEmployeeId);
      try {
        sessionStorage.setItem('activeTimelineEmployeeId', props.timelineEmployeeId);
      } catch {}
    }
  }, [props.timelineEmployeeId]);

  const [localToasts, setLocalToasts] = useState<Notification[]>([]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [formBuilderTab, setFormBuilderTab] = useState<'JOINING' | 'UPDATES'>('JOINING');
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isSidebarExpanded = !isSidebarCollapsed || isSidebarHovered;

  const addToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setLocalToasts(prev => [...prev, { id, message, type, read: false, timestamp: '', targetUserId: '' }]);
    setTimeout(() => {
      setLocalToasts(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const handleNotificationClick = (notif: Notification) => {
    markNotificationAsRead(notif.id);
    if (notif.link) {
      navigateTo(notif.link as AppView);
      setIsNotificationOpen(false);
    }
  };

  const unreadCount = (notifications || []).filter(n => !n.read).length;

  // Use a Ref to ensure each notification ID is only toasted ONCE
  const lastToastedId = React.useRef<string | null>(null);

  useEffect(() => {
    const latestNotif = (notifications || [])[0];
    if (latestNotif && !latestNotif.read && latestNotif.id !== lastToastedId.current) {
      lastToastedId.current = latestNotif.id;
      addToast(latestNotif.message, latestNotif.type);
    }
  }, [notifications]);

  const canSeeModule = (p1: Permission, p2?: Permission) => {
    return hasPermission(p1) || (p2 ? hasPermission(p2) : false);
  };

  const navStructure: NavItem[] = useMemo(() => [
    { id: AppView.ADMIN_DASHBOARD, view: AppView.ADMIN_DASHBOARD, label: 'Dashboard', icon: <LayoutDashboard size={20} />, visible: true },
    { id: AppView.ADMIN_PORTAL_PROFILE, view: AppView.ADMIN_PORTAL_PROFILE, label: 'My Profile', icon: <UserCircle size={20} />, visible: true },

    // Grouped Requests
    {
      id: 'employee-requests-group',
      label: 'Employee Requests',
      icon: <ClipboardList size={20} />,
      visible: true,
      children: [
        { id: AppView.ADMIN_PORTAL_SUBMISSION_REVIEW, view: AppView.ADMIN_PORTAL_SUBMISSION_REVIEW, label: 'New Joiners', icon: <UserPlus size={18} />, visible: canSeeModule(Permission.MANAGE_SUBMISSIONS, Permission.VIEW_SUBMISSIONS) },
        { id: AppView.ADMIN_PORTAL_LEAVE_MANAGEMENT, view: AppView.ADMIN_PORTAL_LEAVE_MANAGEMENT, label: 'Leave Requests', icon: <CalendarCheck size={18} />, visible: canSeeModule(Permission.MANAGE_LEAVES, Permission.VIEW_LEAVES) },
        { id: AppView.ADMIN_PORTAL_ACCOUNT_UPDATE_MANAGEMENT, view: AppView.ADMIN_PORTAL_ACCOUNT_UPDATE_MANAGEMENT, label: 'Account Updates', icon: <UserCheck size={18} />, visible: canSeeModule(Permission.MANAGE_ACCOUNT_UPDATES, Permission.VIEW_ACCOUNT_UPDATES) },
        { id: AppView.ADMIN_PORTAL_RESIGNATION_MANAGEMENT, view: AppView.ADMIN_PORTAL_RESIGNATION_MANAGEMENT, label: 'Resignations', icon: <UserMinus size={18} />, visible: canSeeModule(Permission.MANAGE_RESIGNATIONS, Permission.VIEW_RESIGNATIONS) },
        { id: AppView.ADMIN_PORTAL_DISCIPLINARY_MANAGEMENT, view: AppView.ADMIN_PORTAL_DISCIPLINARY_MANAGEMENT, label: 'Disciplinary Actions', icon: <Gavel size={18} />, visible: canSeeModule(Permission.MANAGE_DISCIPLINE, Permission.VIEW_DISCIPLINE) },
        { id: AppView.ADMIN_PORTAL_DRAFTS, view: AppView.ADMIN_PORTAL_DRAFTS, label: 'Onboarding Drafts', icon: <FileClock size={18} />, visible: hasPermission(Permission.SUBMISSIONS_VIEW_DRAFTS) },
        { id: AppView.ADMIN_PORTAL_CORRECTION_REQUESTS, view: AppView.ADMIN_PORTAL_CORRECTION_REQUESTS, label: 'Correction Links', icon: <Link2 size={18} />, visible: isSuperAdmin || hasPermission(Permission.SUBMISSIONS_VIEW_CORRECTION_LINKS) },
        { id: AppView.ADMIN_PORTAL_GRIEVANCES, view: AppView.ADMIN_PORTAL_GRIEVANCES, label: 'Grievances & Care', icon: <MessageSquare size={18} />, visible: isSuperAdmin || hasPermission(Permission.GRIEVANCES_VIEW) || hasPermission(Permission.REWARDS_VIEW) || hasPermission(Permission.REWARDS_MANAGE) },
      ]
    },

    { id: AppView.ADMIN_PORTAL_MASTER_EMPLOYEE_LIST, view: AppView.ADMIN_PORTAL_MASTER_EMPLOYEE_LIST, label: 'Master Employee List', icon: <List size={20} />, visible: hasPermission(Permission.VIEW_MASTER_EMPLOYEE_LIST) },
    { id: AppView.ADMIN_PORTAL_BGV_MANAGEMENT, view: AppView.ADMIN_PORTAL_BGV_MANAGEMENT, label: 'BGV Clearance', icon: <ShieldCheck size={20} />, visible: isSuperAdmin || hasPermission(Permission.BGV_VIEW) || hasPermission(Permission.BGV_MANAGE) || hasPermission(Permission.BGV_VENDOR) },
    { id: AppView.ADMIN_PORTAL_TIMELINE_SEARCH, view: AppView.ADMIN_PORTAL_TIMELINE_SEARCH, label: 'Employee Inquiry', icon: <Search size={20} />, visible: isSuperAdmin },

    // Recruitment Group
    {
      id: 'recruitment-group',
      label: 'Recruitment & Sites',
      icon: <Briefcase size={20} />,
      visible: true,
      children: [
        { id: AppView.ADMIN_VACANCY_MANAGER, view: AppView.ADMIN_VACANCY_MANAGER, label: 'Vacancies & Sites', icon: <MapPin size={18} />, visible: canSeeModule(Permission.VACANCIES_MANAGE, Permission.VACANCIES_VIEW) || hasPermission(Permission.VACANCIES_POST) },
        { id: AppView.ADMIN_PORTAL_INVITES, view: AppView.ADMIN_PORTAL_INVITES, label: 'Recruitment & Invites', icon: <Link2 size={18} />, visible: canSeeModule(Permission.INVITES_VIEW, Permission.INVITES_CREATE) },
      ]
    },

    // Organization Management Group
    {
      id: 'organization-management-group',
      label: 'Organization Management',
      icon: <Building size={20} />,
      visible: true,
      children: [
        { id: AppView.ADMIN_PORTAL_SITE_MANAGEMENT, view: AppView.ADMIN_PORTAL_SITE_MANAGEMENT, label: 'Site Management', icon: <MapPin size={18} />, visible: canSeeModule(Permission.MANAGE_SITES, Permission.VIEW_SITES) },
        { id: AppView.ADMIN_PORTAL_STAFF_MANAGEMENT, view: AppView.ADMIN_PORTAL_STAFF_MANAGEMENT, label: 'Staff Accounts', icon: <UserPlus size={18} />, visible: hasPermission(Permission.MANAGE_STAFF) },
        { id: AppView.ADMIN_PORTAL_ROLE_MANAGEMENT, view: AppView.ADMIN_PORTAL_ROLE_MANAGEMENT, label: 'Roles & Permissions', icon: <ShieldHalf size={18} />, visible: hasPermission(Permission.MANAGE_ROLES) },
      ]
    },

    // System Configuration Group
    {
      id: 'system-configuration-group',
      label: 'System Configuration',
      icon: <Settings size={20} />,
      visible: true,
      children: [
        { id: AppView.ADMIN_PORTAL_FORM_BUILDER, view: AppView.ADMIN_PORTAL_FORM_BUILDER, label: 'Form Builder', icon: <FormInput size={18} />, visible: hasPermission(Permission.MANAGE_FORMS) },
        { id: AppView.ADMIN_PORTAL_PORTAL_MODULES, view: AppView.ADMIN_PORTAL_PORTAL_MODULES, label: 'Portal Modules', icon: <Layout size={18} />, visible: hasPermission(Permission.MANAGE_SYSTEM) },
        { id: AppView.ADMIN_PORTAL_WEBSITE_MANAGER, view: AppView.ADMIN_PORTAL_WEBSITE_MANAGER, label: 'Website Manager', icon: <Globe size={18} />, visible: hasPermission(Permission.MANAGE_SYSTEM) },
        { id: AppView.ADMIN_PORTAL_CLIENT_ID_LIBRARY, view: AppView.ADMIN_PORTAL_CLIENT_ID_LIBRARY, label: 'Client ID Library', icon: <ShieldHalf size={18} />, visible: hasPermission(Permission.MANAGE_SYSTEM) },
        { id: AppView.ADMIN_PORTAL_WORKFLOW_CONFIG, view: AppView.ADMIN_PORTAL_WORKFLOW_CONFIG, label: 'Approval Workflows', icon: <GitBranch size={18} />, visible: hasPermission(Permission.MANAGE_WORKFLOWS) },
        { id: AppView.ADMIN_AUDIT_LOGS, view: AppView.ADMIN_AUDIT_LOGS, label: 'System Audit Logs', icon: <FileClock size={18} />, visible: hasPermission(Permission.VIEW_AUDIT_LOGS) },
        { id: AppView.ADMIN_LEGACY_SYSTEMS, view: AppView.ADMIN_LEGACY_SYSTEMS, label: 'Legacy Systems', icon: <Archive size={18} />, visible: hasPermission(Permission.MANAGE_SYSTEM) },
        { id: AppView.ADMIN_PORTAL_RECYCLE_BIN, view: AppView.ADMIN_PORTAL_RECYCLE_BIN, label: 'Recycle Bin & Undo', icon: <Trash2 size={18} />, visible: isSuperAdmin },
      ]
    }
  ], [userRole, isSuperAdmin]);

  // Automatically expand the menu if the current view is inside a child group
  useEffect(() => {
    navStructure.forEach(item => {
      if (item.children) {
        const hasActiveChild = item.children.some(c => c.view === currentAdminView);
        if (hasActiveChild && !expandedMenus.includes(item.id)) {
          setExpandedMenus(prev => [...prev, item.id]);
        }
      }
    });
  }, [currentAdminView]);

  const toggleMenu = (id: string) => {
    setExpandedMenus(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const getPageTitle = () => {
    const flatten = (items: NavItem[]): NavItem[] => {
      return items.reduce((acc: NavItem[], item) => {
        acc.push(item);
        if (item.children) acc.push(...flatten(item.children));
        return acc;
      }, []);
    };
    const activeItem = flatten(navStructure).find(item => item.view === currentAdminView);
    return activeItem ? activeItem.label : 'Admin Dashboard';
  };

  const toggleEditableField = (fieldId: string) => {
    if (editableFieldIds.includes(fieldId)) {
      setEditableFieldIds(editableFieldIds.filter(id => id !== fieldId));
    } else {
      setEditableFieldIds([...editableFieldIds, fieldId]);
    }
  };

  const renderAdminContent = () => {
    const accessDenied = <div className="p-8 text-center text-red-500 font-semibold bg-white rounded shadow">Access Denied. You do not have permission to view this page.</div>;

    switch (currentAdminView) {
      case AppView.ADMIN_DASHBOARD:
        return <AdminDashboardPage
          authUser={authUser}
          sites={sites}
          submittedForms={submittedForms}
          leaveRequests={leaveRequests}
          accountUpdateRequests={accountUpdateRequests}
          navigateTo={navigateTo}
          roles={roles}
          userRole={userRole}
          isSuperAdmin={isSuperAdmin}
        />;
      case AppView.ADMIN_AUDIT_LOGS:
        if (!hasPermission(Permission.VIEW_AUDIT_LOGS)) return accessDenied;
        return <AdminAuditLogPage userRole={userRole} isSuperAdmin={isSuperAdmin} />;
      case AppView.ADMIN_PORTAL_PROFILE:
        return <AdminStaffProfilePage authUser={authUser} sites={sites} submittedForms={submittedForms} roles={roles} staffUsers={staffUsers} />;
      case AppView.ADMIN_PORTAL_MASTER_EMPLOYEE_LIST:
        if (!hasPermission(Permission.EMPLOYEES_VIEW)) return accessDenied;
        return <AdminMasterEmployeeListPage
          submittedForms={submittedForms}
          onDelete={onDeleteSubmission}
          onSoftDelete={onSoftDeleteEmployee} // Fixed: Added missing soft delete prop
          onRestore={onRestoreEmployee}
          formSections={sections}
          onRelieve={onRelieveEmployee}
          onRejoin={onRejoinEmployee}
          sites={sites}
          isSuperAdmin={isSuperAdmin}
          userRole={userRole}
          onBulkSoftDelete={onBulkSoftDelete}
          onBulkDelete={onBulkDelete}
          roles={roles}
          onApproveProfile={onApproveProfile}
          onViewTimeline={(empId) => {
            setActiveTimelineEmployeeId(empId);
            try {
              sessionStorage.setItem('activeTimelineEmployeeId', empId);
            } catch {}
            if (onViewTimeline) onViewTimeline(empId);
            navigateTo(AppView.ADMIN_PORTAL_EMPLOYEE_TIMELINE);
          }}
          onExport={handleExportData}
          allowedSiteIds={allowedSiteIds}
          portalConfig={portalConfig}
          authUser={authUser}
          staffUsers={staffUsers}
        />;
      case AppView.ADMIN_PORTAL_WEBSITE_MANAGER:
        if (!hasPermission(Permission.MANAGE_SYSTEM)) return accessDenied;
        return <AdminWebsiteManager isSuperAdmin={isSuperAdmin} userRole={userRole} />;
      case AppView.ADMIN_PORTAL_TIMELINE_SEARCH:
        if (!isSuperAdmin) return <div className="p-8 text-center text-red-500 font-semibold">Access Denied. Super Admin only.</div>;
        return (
          <AdminTimelineSearchPage
            onViewTimeline={(empId) => {
              setActiveTimelineEmployeeId(empId);
              try {
                sessionStorage.setItem('activeTimelineEmployeeId', empId);
              } catch {}
              if (onViewTimeline) onViewTimeline(empId);
              navigateTo(AppView.ADMIN_PORTAL_EMPLOYEE_TIMELINE);
            }}
          />
        );
      case AppView.ADMIN_PORTAL_FORM_BUILDER:
        if (!hasPermission(Permission.MANAGE_FORMS)) return accessDenied;
        return (
          <>
            <div className="flex space-x-4 mb-6 border-b border-gray-200 pb-2">
              <button
                onClick={() => setFormBuilderTab('JOINING')}
                className={`flex items-center space-x-2 px-4 py-2 border-b-2 font-medium text-sm transition-colors ${formBuilderTab === 'JOINING' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                <UserPlus size={18} />
                <span>New Employee Form Builder</span>
              </button>
              <button
                onClick={() => setFormBuilderTab('UPDATES')}
                className={`flex items-center space-x-2 px-4 py-2 border-b-2 font-medium text-sm transition-colors ${formBuilderTab === 'UPDATES' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                <UserCog size={18} />
                <span>Account Update Form Builder</span>
              </button>
            </div>

            {formBuilderTab === 'JOINING' ? (
              <>
                <div className="mb-8 p-6 bg-white rounded-lg shadow">
                  <h2 className="text-xl font-semibold text-gray-700 mb-3">Add New Section</h2>
                  <div className="flex items-center space-x-3">
                    <Input type="text" value={newSectionName} onChange={(e) => setNewSectionName(e.target.value)} placeholder="e.g., Personal Details" className="flex-grow" onKeyPress={(e) => e.key === 'Enter' && (newSectionName.trim() ? (addSection(newSectionName.trim()), setNewSectionName('')) : null)} />
                    <Button onClick={() => { if (newSectionName.trim()) { addSection(newSectionName.trim()); setNewSectionName(''); } }} variant="primary"><PlusCircle size={18} className="mr-2" /> Add Section</Button>
                  </div>
                </div>
                <div className="space-y-6">
                  {[...sections].sort((a, b) => a.order - b.order).map((section, index) => (
                    <SectionItem
                      key={section.id}
                      section={section}
                      onUpdateName={updateSectionName}
                      onDelete={deleteSection}
                      onToggleStatus={toggleSectionStatus}
                      onMoveUp={() => reorderSections(index, index - 1)}
                      onMoveDown={() => reorderSections(index, index + 1)}
                      onAddField={addField}
                      onUpdateField={updateField}
                      onDeleteField={deleteField}
                      onToggleFieldStatus={toggleFieldStatus}
                      onReorderFields={reorderFields}
                      isFirst={index === 0}
                      isLast={index === sections.length - 1}
                      availableFields={sections.flatMap(s => s.fields)}
                      roles={roles}
                      sites={sites}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                <div className="mb-6 bg-purple-50 p-4 rounded-md border border-purple-100 flex items-start space-x-3">
                  <FormInput className="text-purple-600 mt-1" size={24} />
                  <div>
                    <h3 className="font-bold text-purple-800">Account Update Configuration</h3>
                    <p className="text-sm text-purple-700 mt-1">
                      Select which fields from the Joining Form should be available for employees to request updates for.
                      If checked, the field will appear in the "Update Request" dropdown on the employee dashboard.
                    </p>
                  </div>
                </div>

                <div className="space-y-8">
                  {sections.map(section => (
                    <div key={section.id} className="border border-gray-100 rounded-lg p-4">
                      <h4 className="text-md font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">{section.name}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {section.fields.map(field => (
                          <label key={field.id} className={`flex items-center space-x-3 p-3 rounded-md border cursor-pointer transition-all ${editableFieldIds.includes(field.id) ? 'bg-purple-50 border-purple-200' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}>
                            <input
                              type="checkbox"
                              checked={editableFieldIds.includes(field.id)}
                              onChange={() => toggleEditableField(field.id)}
                              className="h-5 w-5 text-purple-600 rounded focus:ring-purple-500"
                            />
                            <span className={`text-sm font-medium ${editableFieldIds.includes(field.id) ? 'text-purple-900' : 'text-gray-600'}`}>
                              {field.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        );
      case AppView.ADMIN_PORTAL_SUBMISSION_REVIEW:
        return <AdminReviewSubmissionsPage
          submittedForms={submittedForms}
          onApprove={onApproveSubmission}
          formSections={sections}
          onBulkAddEmployees={onBulkAddEmployees}
          userRole={userRole}
          isSuperAdmin={isSuperAdmin}
          workflowConfigs={workflowConfigs}
          sites={sites}
          authUser={authUser}
          onRevert={onRevertSubmission}
          onDelete={onDeleteSubmission}
          onUpdateId={onUpdateSubmissionId}
          roles={roles}
          allowedSiteIds={allowedSiteIds}
          onUpdateComment={onUpdateComment}
          staffUsers={staffUsers}
        />;
      case AppView.ADMIN_PORTAL_LEAVE_MANAGEMENT:
        return <AdminLeaveManagementPage
          leaveRequests={leaveRequests}
          onAction={onLeaveAction}
          userRole={userRole}
          isSuperAdmin={isSuperAdmin}
          workflowConfigs={workflowConfigs}
          sites={sites}
          submittedForms={submittedForms}
          authUser={authUser}
          leaveBalances={leaveBalances}
          leavePolicy={leavePolicy}
          onUpdateLeavePolicy={onUpdateLeavePolicy}
          onRevert={(id: string, level: number) => onRevertWorkflowRequest('LEAVES', id, level)}
          onDelete={(id: string) => onDeleteRequest('LEAVES', id)}
          allowedSiteIds={allowedSiteIds}
        />;
      case AppView.ADMIN_PORTAL_ACCOUNT_UPDATE_MANAGEMENT:
        return <AdminAccountUpdateManagementPage
          accountUpdateRequests={accountUpdateRequests}
          onAction={onAccountUpdateAction}
          userRole={userRole}
          isSuperAdmin={isSuperAdmin}
          workflowConfigs={workflowConfigs}
          sites={sites}
          submittedForms={submittedForms}
          authUser={authUser}
          onRevert={(id: string, level: number) => onRevertWorkflowRequest('ACCOUNT_UPDATES', id, level)}
          onDelete={(id: string) => onDeleteRequest('ACCOUNT_UPDATES', id)}
          allowedSiteIds={allowedSiteIds}
        />;
      case AppView.ADMIN_PORTAL_RESIGNATION_MANAGEMENT:
        return <AdminResignationManagementPage
          resignationRequests={resignationRequests}
          onAction={onResignationAction}
          userRole={userRole}
          isSuperAdmin={isSuperAdmin}
          workflowConfigs={workflowConfigs}
          sites={sites}
          submittedForms={submittedForms}
          authUser={authUser}
          onRevert={(id: string, level: number) => onRevertWorkflowRequest('RESIGNATIONS', id, level)}
          onDelete={(id: string) => onDeleteRequest('RESIGNATIONS', id)}
          allowedSiteIds={allowedSiteIds}
        />;
      case AppView.ADMIN_PORTAL_DISCIPLINARY_MANAGEMENT:
        return <AdminDisciplinaryPage
          disciplinaryActions={disciplinaryActions}
          onAddDiscipline={onAddDiscipline}
          onDeleteDiscipline={onDeleteDiscipline}
          submittedForms={submittedForms}
          formSections={sections}
          userRole={userRole}
          isSuperAdmin={isSuperAdmin}
          sites={sites}
          authUser={authUser}
          portalConfig={portalConfig}
          allowedSiteIds={allowedSiteIds}
        />;
       case AppView.ADMIN_PORTAL_STAFF_MANAGEMENT:
        if (!hasPermission(Permission.MANAGE_STAFF)) return accessDenied;
        return <AdminStaffManagementPage staffUsers={staffUsers} setStaffUsers={setStaffUsers} roles={roles} sites={sites} setSites={setSites} loggedInUserId={authUser?.id || ''} onNotify={addToast} logAction={logAction} formSections={sections} />;
      case AppView.ADMIN_PORTAL_ROLE_MANAGEMENT:
        if (!hasPermission(Permission.MANAGE_ROLES)) return accessDenied;
        return <AdminRoleManagementPage roles={roles} setRoles={setRoles} staffUsers={staffUsers} setStaffUsers={setStaffUsers} onNotify={addToast} formSections={sections} logAction={logAction} />;

      case AppView.ADMIN_PORTAL_PORTAL_MODULES:
        if (!hasPermission(Permission.MANAGE_WORKFLOWS)) return accessDenied;
        return <AdminWorkflowConfigPage
          workflowConfigs={workflowConfigs}
          setWorkflowConfigs={setWorkflowConfigs}
          roles={roles}
          portalConfig={portalConfig}
          setPortalConfig={setPortalConfig}
          activeTab="MODULES"
          logAction={logAction}
        />;
      case AppView.ADMIN_PORTAL_CLIENT_ID_LIBRARY:
        if (!hasPermission(Permission.MANAGE_WORKFLOWS)) return accessDenied;
        return <AdminWorkflowConfigPage
          workflowConfigs={workflowConfigs}
          setWorkflowConfigs={setWorkflowConfigs}
          roles={roles}
          portalConfig={portalConfig}
          setPortalConfig={setPortalConfig}
          activeTab="CLIENT_IDS"
          logAction={logAction}
        />;
      case AppView.ADMIN_PORTAL_WORKFLOW_CONFIG:
        if (!hasPermission(Permission.MANAGE_WORKFLOWS)) return accessDenied;
        return <AdminWorkflowConfigPage
          workflowConfigs={workflowConfigs}
          setWorkflowConfigs={setWorkflowConfigs}
          roles={roles}
          portalConfig={portalConfig}
          setPortalConfig={setPortalConfig}
          activeTab="WORKFLOWS"
          logAction={logAction}
        />;

      case AppView.ADMIN_VACANCY_MANAGER:
        if (!hasPermission(Permission.VACANCIES_MANAGE) && !hasPermission(Permission.VACANCIES_VIEW) && !hasPermission(Permission.VACANCIES_POST)) return accessDenied;
        return <AdminVacancyManager userRole={userRole} isSuperAdmin={isSuperAdmin} navigateTo={navigateTo} />;

      case AppView.ADMIN_PORTAL_INVITES:
        return (
          <AdminInvitesPage
            authUser={authUser}
            isSuperAdmin={isSuperAdmin}
            userRole={userRole}
            sites={sites}
            formSections={sections}
            portalConfig={portalConfig}
            setPortalConfig={setPortalConfig}
          />
        );

      case AppView.ADMIN_PORTAL_SITE_MANAGEMENT:
        if (!canSeeModule(Permission.SITES_MANAGE, Permission.SITES_VIEW)) return accessDenied;
        return <AdminSiteManagementPage 
          sites={isSuperAdmin ? sites : sites.filter(s => allowedSiteIds?.includes(s.id))} 
          setSites={setSites} 
          submittedForms={submittedForms} 
          staffUsers={staffUsers} 
          roles={roles} 
          onNotify={addToast} 
          userRole={userRole} 
          isSuperAdmin={isSuperAdmin} 
          portalConfig={portalConfig}
          setPortalConfig={setPortalConfig}
          logAction={logAction} 
        />;
      case AppView.ADMIN_PORTAL_DRAFTS:
        if (!hasPermission(Permission.SUBMISSIONS_VIEW_DRAFTS)) return <div className="p-8 text-center text-red-500 font-semibold">Access Denied.</div>;
        return <AdminDraftsManagementPage drafts={drafts} isSuperAdmin={isSuperAdmin} userRole={userRole} submittedForms={submittedForms} />;
      case AppView.ADMIN_PORTAL_CORRECTION_REQUESTS:
        if (!hasPermission(Permission.SUBMISSIONS_VIEW_CORRECTION_LINKS)) return <div className="p-8 text-center text-red-500 font-semibold">Access Denied.</div>;
        return (
          <AdminCorrectionRequestsPage
            sections={sections}
            isSuperAdmin={isSuperAdmin}
            userRole={userRole}
            onNotify={addToast}
            logAction={logAction}
          />
        );
      case AppView.ADMIN_PORTAL_EMPLOYEE_TIMELINE:
        const currentTimelineId = activeTimelineEmployeeId || timelineEmployeeId || (() => {
          try { return sessionStorage.getItem('activeTimelineEmployeeId'); } catch { return null; }
        })();
        if (!currentTimelineId) {
          return (
            <AdminTimelineSearchPage
              onViewTimeline={(empId) => {
                setActiveTimelineEmployeeId(empId);
                try {
                  sessionStorage.setItem('activeTimelineEmployeeId', empId);
                } catch {}
                if (onViewTimeline) onViewTimeline(empId);
                navigateTo(AppView.ADMIN_PORTAL_EMPLOYEE_TIMELINE);
              }}
            />
          );
        }
        return (
          <div className="h-[calc(100vh-140px)]">
            <EmployeeTimelinePage
              employeeId={currentTimelineId}
              onClose={() => {
                try {
                  sessionStorage.removeItem('activeTimelineEmployeeId');
                } catch {}
                setActiveTimelineEmployeeId(null);
                navigateTo(AppView.ADMIN_PORTAL_TIMELINE_SEARCH);
              }}
            />
          </div>
        );
      case AppView.ADMIN_PORTAL_BGV_MANAGEMENT:
        return (
          <AdminBgvManagementPage
            authUser={authUser}
            isSuperAdmin={isSuperAdmin}
            userRole={userRole}
            sites={sites}
            formSections={sections}
            portalConfig={portalConfig}
            setPortalConfig={setPortalConfig}
            onNotify={addToast}
            logAction={logAction}
            allowedSiteIds={allowedSiteIds}
          />
        );
      case AppView.ADMIN_LEGACY_SYSTEMS:
        return <AdminLegacySystemsPage logAction={logAction} />;
      case AppView.ADMIN_PORTAL_GRIEVANCES:
        if (!isSuperAdmin && !hasPermission(Permission.GRIEVANCES_VIEW) && !hasPermission(Permission.REWARDS_VIEW) && !hasPermission(Permission.REWARDS_MANAGE)) {
          return accessDenied;
        }
        return (
          <AdminGrievancesPage
            authUser={authUser}
            isSuperAdmin={isSuperAdmin}
            userRole={userRole}
            onNotify={addToast}
            allowedSiteIds={allowedSiteIds}
          />
        );
      case AppView.ADMIN_PORTAL_RECYCLE_BIN:
        if (!isSuperAdmin) return accessDenied;
        return (
          <AdminRecycleBinPage
            onNotify={addToast}
            isSuperAdmin={isSuperAdmin}
            onRefreshData={props.onRefreshStats}
          />
        );
      default:
        return <AdminDashboardPage
          authUser={authUser}
          sites={sites}
          submittedForms={submittedForms}
          leaveRequests={leaveRequests}
          accountUpdateRequests={accountUpdateRequests}
          navigateTo={navigateTo}
          roles={roles}
          userRole={userRole}
          isSuperAdmin={isSuperAdmin}
        />;
    }
  };

  const native = isNativeApp();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Close drawer on navigation (native mobile)
  useEffect(() => {
    if (native && isDrawerOpen) {
      setIsDrawerOpen(false);
    }
  }, [currentAdminView]);

  return (
    <div className={`h-screen flex bg-gray-100 relative overflow-hidden ${native ? 'native-app' : ''}`}>
      {/* Toast Notifications overlay */}
      <div className="fixed top-6 right-6 z-[9999] space-y-3 pointer-events-none max-w-sm w-full">
        {localToasts.map(n => (
          <div key={n.id} className={`pointer-events-auto p-4 rounded-lg shadow-2xl border flex items-start space-x-3 transition-all duration-300 transform translate-x-0 ${n.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
            n.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
              'bg-blue-50 border-blue-200 text-blue-800'
            }`}>
            <div className="flex-shrink-0 mt-0.5">
              {n.type === 'success' ? <CheckCircle size={20} className="text-green-500" /> : <AlertCircle size={20} className={n.type === 'error' ? 'text-red-500' : 'text-blue-500'} />}
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold uppercase tracking-tight mb-0.5">{n.type}</p>
              <p className="text-sm font-medium">{n.message}</p>
            </div>
            <button onClick={() => setLocalToasts(prev => prev.filter(x => x.id !== n.id))} className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors">
              <X size={18} />
            </button>
          </div>
        ))}
      </div>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside
        className={`bg-slate-900 text-white transition-all duration-300 flex flex-col shadow-xl z-50
          ${native 
            ? `fixed inset-y-0 left-0 w-[280px] ${isDrawerOpen ? 'translate-x-0' : '-translate-x-full'}`
            : `lg:relative fixed inset-y-0 left-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} ${isSidebarExpanded ? 'w-72' : 'lg:w-20 w-72'}`
          }`}
        onMouseEnter={() => !isMobileMenuOpen && !native && setIsSidebarHovered(true)}
        onMouseLeave={() => !isMobileMenuOpen && !native && setIsSidebarHovered(false)}
      >
        {/* Toggle Button Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          {(isSidebarExpanded || native) && (
            <div className="flex items-center space-x-2 animate-in fade-in duration-200">
              <div className="bg-blue-600 p-1.5 rounded-lg">
                <ShieldHalf size={20} className="text-white" />
              </div>
              <span className="font-bold text-lg tracking-tight whitespace-nowrap">
                {isSuperAdmin ? 'Admin Portal' : 'Staff Portal'}
              </span>
            </div>
          )}
          <button
            onClick={() => {
              if (native) {
                setIsDrawerOpen(false);
              } else if (window.innerWidth < 1024) {
                setIsMobileMenuOpen(false);
              } else {
                setIsSidebarCollapsed(!isSidebarCollapsed);
              }
            }}
            className={`p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors ${(!isSidebarExpanded && !native) ? 'mx-auto' : ''}`}
            title={native ? "Close Menu" : (window.innerWidth < 1024 ? "Close Menu" : (isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"))}
          >
            {window.innerWidth < 1024 ? <X size={20} /> : (isSidebarCollapsed ? <Menu size={20} /> : <ChevronLeft size={20} />)}
          </button>
        </div>

        {/* User Info (Collapsed vs Expanded) */}
        <div className={`flex flex-col items-center py-6 px-2 border-b border-slate-800 transition-all duration-300 ${isSidebarExpanded ? 'mb-6' : 'mb-2'}`}>
          {isSidebarExpanded ? (
            <div className="animate-in fade-in duration-300 flex flex-col items-center">
              <img src="/logo.png" alt="Logo" className="h-16 w-auto mb-3" />
              <h1 className="text-md font-bold text-center leading-tight whitespace-nowrap overflow-hidden text-ellipsis w-full px-4">Unique Delta Force</h1>
              {isSuperAdmin ? (
                <div className="flex items-center space-x-1 mt-2 bg-yellow-500/20 px-3 py-1 rounded-full border border-yellow-500/30">
                  <Crown size={12} className="text-yellow-400" />
                  <p className="text-[10px] text-yellow-200 font-bold uppercase tracking-wider whitespace-nowrap">Super Admin</p>
                </div>
              ) : (
                <p className="text-xs text-blue-300 font-medium mt-1 truncate max-w-[180px]">{userRole?.name || 'Staff User'}</p>
              )}
            </div>
          ) : (
            <div className="bg-slate-800 p-2 rounded-full mb-2">
              <img src="/logo.png" alt="Logo" className="h-8 w-8" />
            </div>
          )}
        </div>

        {/* Nav Items */}
        <div className="space-y-1 overflow-y-auto flex-1 px-3 custom-scrollbar">
          {navStructure.map(item => {
            // Check visibility based on role
            if (!item.visible) {
              if (!item.children || !item.children.some(c => c.visible)) {
                return null;
              }
            }

            if (item.children) {
              const visibleChildren = item.children.filter(c => c.visible);
              if (visibleChildren.length === 0) return null;

              const isExpanded = expandedMenus.includes(item.id);
              const isActiveGroup = visibleChildren.some(c => c.view === currentAdminView);

              return (
                <div key={item.id} className="mb-2">
                  <button
                    onClick={() => toggleMenu(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-3 rounded-lg text-sm font-medium transition-colors 
                                ${isExpanded ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
                                ${!isSidebarExpanded ? 'justify-center' : ''}
                            `}
                    title={!isSidebarExpanded ? item.label : ''}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`${isActiveGroup ? 'text-blue-400' : ''}`}>{item.icon}</div>
                      {isSidebarExpanded && <span className="whitespace-nowrap overflow-hidden text-ellipsis animate-in fade-in duration-200">{item.label}</span>}
                    </div>
                    {isSidebarExpanded && (
                      <div className="text-slate-500">
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </div>
                    )}
                  </button>

                  {isSidebarExpanded && isExpanded && (
                    <div className="mt-1 space-y-1 ml-4 pl-2 border-l border-slate-700 animate-in fade-in slide-in-from-top-1 duration-200">
                      {visibleChildren.map(child => (
                        <button
                          key={child.id}
                          onClick={() => {
                            if (child.view) {
                              navigateTo(child.view);
                              if (window.innerWidth < 1024) setIsMobileMenuOpen(false);
                            }
                          }}
                          className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm transition-all
                                            ${currentAdminView === child.view
                              ? 'bg-blue-600 text-white shadow-md'
                              : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}
                                        `}
                          title={child.label}
                        >
                          <div className="flex-shrink-0">{child.icon}</div>
                          <span className="whitespace-nowrap overflow-hidden text-ellipsis">{child.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.view) {
                    navigateTo(item.view);
                    if (window.innerWidth < 1024) setIsMobileMenuOpen(false);
                  }
                }}
                className={`w-full flex items-center space-x-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors mb-1
                    ${(currentAdminView === item.view || (item.view === AppView.ADMIN_PORTAL_TIMELINE_SEARCH && currentAdminView === AppView.ADMIN_PORTAL_EMPLOYEE_TIMELINE))
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
                    ${!isSidebarExpanded ? 'justify-center' : ''}
                `}
                title={!isSidebarExpanded ? item.label : ''}
              >
                <div className="flex-shrink-0">{item.icon}</div>
                {isSidebarExpanded && <span className="whitespace-nowrap overflow-hidden text-ellipsis animate-in fade-in duration-200">{item.label}</span>}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 mt-auto">
          {isSidebarExpanded && (
            <div className="px-1 py-2 mb-2 bg-slate-800 rounded-lg border border-slate-700 animate-in fade-in duration-200">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center font-bold text-xs">
                  {authUser?.name?.charAt(0) || '?'}
                </div>
                {!isSidebarCollapsed && (
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate text-white" title={authUser?.name || ''}>{authUser?.name || 'Unknown'}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          <Button onClick={onLogout} variant="secondary" size="sm" className={`w-full !bg-red-600/10 hover:!bg-red-600 !text-red-400 hover:!text-white border border-red-900/30 transition-colors ${!isSidebarExpanded ? 'px-0 justify-center' : ''}`} title="Logout">
            <LogOut size={18} className={isSidebarExpanded ? 'mr-2' : ''} />
            {isSidebarExpanded && 'Sign Out'}
          </Button>
        </div>
      </aside>
      <main className={`flex-1 overflow-y-auto bg-gray-50/50 custom-scrollbar ${native ? 'p-0' : 'p-6 lg:p-8'}`}>
        {/* Native Top Bar */}
        {native && (
          <div className="native-top-bar">
            <div className="top-bar-left">
              <button 
                onClick={() => setIsDrawerOpen(true)}
                className="p-2 -ml-2 text-gray-700 active:opacity-60"
              >
                <Menu size={24} />
              </button>
            </div>
            <h1>{getPageTitle()}</h1>
            <div className="top-bar-right">
              <button
                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                className="p-2 -mr-2 text-gray-700 relative active:opacity-60"
              >
                <Bell size={22} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 h-4 w-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold border-2 border-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Breadcrumb Section - hidden on native */}
        {!native && (() => {
          const breadcrumbs: { label: string; path?: string; active?: boolean }[] = [{ label: isSuperAdmin ? 'Admin' : 'Staff', path: '/admin' }];
          let viewLabel = currentAdminView.replace('ADMIN_PORTAL_', '').replace(/_/g, ' ');
          if (currentAdminView === AppView.ADMIN_PORTAL_TIMELINE_SEARCH || currentAdminView === AppView.ADMIN_PORTAL_EMPLOYEE_TIMELINE) {
            viewLabel = 'Employee Inquiry';
          }
          if (currentAdminView !== AppView.ADMIN_DASHBOARD && currentAdminView !== AppView.LANDING) {
            breadcrumbs.push({ label: viewLabel, active: true });
          } else {
            breadcrumbs[0].active = true;
          }
          return <Breadcrumb items={breadcrumbs} onNavigate={(path) => {
            if (path === '/admin' || path === '/' || !path) {
              navigateTo(AppView.ADMIN_DASHBOARD);
            } else {
              navigateTo(path as AppView);
            }
          }} />;
        })()}

        {!native && (
          <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center">
              {/* Mobile Menu Button - web only */}
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-md hover:bg-gray-200 text-gray-700 mr-2"
                aria-label="Open Menu"
              >
                <Menu size={24} />
              </button>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800">{getPageTitle()}</h1>
            </div>

            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* Notification Bell */}
              <div className="relative">
                <button
                  onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                  className="p-2 bg-white rounded-full border border-gray-200 hover:bg-gray-50 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 h-4 w-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold border-2 border-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {isNotificationOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="p-3 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                      <h4 className="font-bold text-gray-700 text-sm">Notifications</h4>
                      {unreadCount > 0 && (
                        <button onClick={markAllNotificationsAsRead} className="text-xs text-blue-600 hover:underline">Mark all read</button>
                      )}
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-4 text-center text-gray-400 text-sm">No notifications.</div>
                      ) : (
                        notifications.map(notif => (
                          <div
                            key={notif.id}
                            onClick={() => handleNotificationClick(notif)}
                            className={`p-3 border-b transition-colors cursor-pointer ${!notif.read ? 'bg-blue-50/50 hover:bg-blue-100' : 'hover:bg-gray-50'}`}
                          >
                            <div className="flex items-start">
                              <div className={`mt-1 h-2 w-2 rounded-full mr-2 flex-shrink-0 ${!notif.read ? 'bg-blue-500' : 'bg-transparent'}`} />
                              <div>
                                <p className={`text-sm ${!notif.read ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>{notif.message}</p>
                                <p className="text-[10px] text-gray-400 mt-1">{new Date(notif.timestamp).toLocaleTimeString()}</p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {!native && (
                <Button onClick={() => navigateTo(AppView.LANDING)} variant="ghost" size="sm" className="text-gray-700 hover:text-blue-600 hidden sm:flex">
                  <Home size={18} className="mr-1 sm:mr-2" /> <span className="hidden sm:inline">UDF Home</span>
                </Button>
              )}
            </div>
          </header>
        )}

        {/* Global Notification Panel for Native (when bell clicked) */}
        {native && isNotificationOpen && (
          <div className="fixed inset-0 z-[2000] bg-black/50" onClick={() => setIsNotificationOpen(false)}>
            <div className="absolute right-4 top-16 w-[calc(100%-32px)] max-w-sm bg-white rounded-2xl shadow-2xl animate-in slide-in-from-top-4" onClick={e => e.stopPropagation()}>
              <div className="p-4 border-b flex justify-between items-center">
                <h4 className="font-bold text-gray-800">Notifications</h4>
                <button onClick={() => setIsNotificationOpen(false)} className="p-1"><X size={20} /></button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">No notifications.</div>
                ) : (
                  notifications.map(notif => (
                    <div key={notif.id} className="p-4 border-b active:bg-gray-50" onClick={() => { handleNotificationClick(notif); setIsNotificationOpen(false); }}>
                       <p className={`text-sm ${!notif.read ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>{notif.message}</p>
                       <p className="text-xs text-gray-400 mt-1">{new Date(notif.timestamp).toLocaleString()}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        <div className={native ? 'native-main-content page-enter' : ''}>
          {renderAdminContent()}
        </div>

      </main>

      {/* --- Floating Toasts UI (Visible Popups) --- */}
      <div className="fixed top-20 right-4 z-[9999] flex flex-col space-y-3 max-w-sm w-full pointer-events-none">
        {localToasts.map(toast => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.2)] border-l-8 transform animate-in slide-in-from-right-full fade-in duration-300 flex items-start gap-3 backdrop-blur-md
              ${toast.type === 'success' ? 'bg-green-600 border-green-800 text-white' : ''}
              ${toast.type === 'error' ? 'bg-red-600 border-red-800 text-white' : ''}
              ${toast.type === 'info' ? 'bg-blue-600 border-blue-800 text-white' : ''}
              ${toast.type === 'warning' ? 'bg-orange-600 border-orange-800 text-white' : ''}
            `}
          >
            <div className="mt-0.5">
              {toast.type === 'success' && <CheckCircle size={20} />}
              {toast.type === 'error' && <AlertCircle size={20} />}
              {toast.type === 'info' && <Bell size={20} />}
              {toast.type === 'warning' && <AlertCircle size={20} />}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium leading-tight">{toast.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminPortalPage;


import React, { useMemo, useState, useRef, useEffect } from 'react';
import { User, SubmittedFormData, LeaveRequest, AccountUpdateRequest, ResignationRequest, FormSection, Role, WorkflowConfig, LeaveBalance, DisciplinaryAction, LeavePolicy, PortalConfig, Notification } from '../types';
import { AppView } from '../App';
import Button from './common/Button';
import { LogOut, UserCircle, CalendarDays, Edit3, ShieldAlert, Home, UserMinus, Gavel, Menu, ChevronLeft, Bell, CheckCircle, AlertCircle, X, Lock, Link as LinkIcon, ChevronDown, MoreHorizontal, Settings } from 'lucide-react';
import EmployeeProfileView from './employee/EmployeeProfileView';
import EmployeeLeaveRequestPage from './employee/EmployeeLeaveRequestPage';
import EmployeeAccountUpdatePage from './employee/EmployeeAccountUpdatePage';
import EmployeeResignationPage from './employee/EmployeeResignationPage';
import EmployeeDisciplinaryPage from './employee/EmployeeDisciplinaryPage';
import EmployeeEngagementHub from './employee/EmployeeEngagementHub';
import Breadcrumb from './common/Breadcrumb';
import DocumentUploadWizard from './employee/DocumentUploadWizard';
import SecuritySettingsModal from './employee/SecuritySettingsModal';
import { isNativeApp } from '../src/utils/capacitor-utils';

interface EmployeeDashboardPageProps {
  currentEmployeeView: AppView;
  navigateTo: (view: AppView) => void;
  onLogout: () => void;
  authUser: User | null;
  employeeData: SubmittedFormData;
  leaveRequests: LeaveRequest[];
  accountUpdateRequests: AccountUpdateRequest[];
  resignationRequests: ResignationRequest[];
  onSubmitLeaveRequest: (requestData: Omit<LeaveRequest, 'id' | 'status' | 'submissionDate' | 'employeeName'>) => void;
  onSubmitAccountUpdateRequest: (requestData: Omit<AccountUpdateRequest, 'id' | 'status' | 'submissionDate' | 'employeeName'>) => void;
  onSubmitResignationRequest: (requestData: Omit<ResignationRequest, 'id' | 'status' | 'submissionDate' | 'employeeName'>) => void;
  onDocumentUpload: (fieldId: string, file: File) => Promise<string>;
  onCompleteProfile: () => Promise<void>;
  formSections: FormSection[];
  editableFieldIds?: string[];
  roles: Role[];
  workflowConfigs: WorkflowConfig[];
  leaveBalances: LeaveBalance[];
  disciplinaryActions: DisciplinaryAction[];
  leavePolicy?: LeavePolicy;
  portalConfig?: PortalConfig;
  notifications: Notification[];
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  sites: any[]; // Added this
}

const EmployeeDashboardPage: React.FC<EmployeeDashboardPageProps> = (props) => {
  const {
    currentEmployeeView,
    navigateTo,
    onLogout,
    authUser,
    employeeData,
    leaveRequests,
    accountUpdateRequests,
    resignationRequests,
    onSubmitLeaveRequest,
    onSubmitAccountUpdateRequest,
    onSubmitResignationRequest,
    onDocumentUpload,
    onCompleteProfile,
    formSections,
    editableFieldIds = [],
    roles,
    workflowConfigs,
    leaveBalances,
    disciplinaryActions,
    leavePolicy,
    portalConfig,
    notifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    sites // Added this
  } = props;

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Header Menu State
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Security Modal State
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [securityAction, setSecurityAction] = useState<'change_password' | 'link_google'>('change_password');
  const [isForcedSecurity, setIsForcedSecurity] = useState(false);
  const [isMoreSheetOpen, setIsMoreSheetOpen] = useState(false);

  // Auto-open forced security setup for default-password employees
  useEffect(() => {
    if (employeeData && (employeeData as any).isDefaultPassword === true && !showSecurityModal) {
      setIsForcedSecurity(true);
      setShowSecurityModal(true);
    }
  }, [employeeData]);

  const native = isNativeApp();

  const isSidebarExpanded = !isSidebarCollapsed || isSidebarHovered;
  const unreadCount = notifications.filter(n => !n.read).length;

  // Close profile menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = (notif: Notification) => {
    markNotificationAsRead(notif.id);
    if (notif.link) {
      navigateTo(notif.link as AppView);
      setIsNotificationOpen(false);
    }
  };

  const navItems = useMemo(() => {
    if (employeeData?.needsProfileCompletion) {
      const isWaiting = (employeeData as any).profileStatus === 'waiting_for_admin';
      const items = [
        { view: AppView.EMPLOYEE_PROFILE, label: 'My Profile', icon: <UserCircle size={20} />, visible: true },
      ];
      if (!isWaiting) {
        items.push({ view: AppView.DOCUMENT_UPLOAD, label: 'Complete Profile', icon: <CheckCircle size={20} />, visible: true });
      }
      return items;
    }

    const items = [
      { view: AppView.EMPLOYEE_PROFILE, label: 'My Profile', icon: <UserCircle size={20} />, visible: true },
      { view: AppView.EMPLOYEE_LEAVE_REQUESTS, label: 'Leave Requests', icon: <CalendarDays size={20} />, visible: portalConfig?.enableLeaves ?? true },
      { view: AppView.EMPLOYEE_ACCOUNT_UPDATES, label: 'Account Updates', icon: <Edit3 size={20} />, visible: portalConfig?.enableAccountUpdates ?? true },
      { view: AppView.EMPLOYEE_RESIGNATION, label: 'Resignation', icon: <UserMinus size={20} />, visible: portalConfig?.enableResignations ?? true },
      { view: AppView.EMPLOYEE_DISCIPLINARY, label: 'Disciplinary Records', icon: <Gavel size={20} />, visible: portalConfig?.enableDisciplinary ?? true },
    ];
    return items.filter(item => item.visible);
  }, [portalConfig, employeeData]);

  const activeView = useMemo(() => {
    if (employeeData?.needsProfileCompletion) {
      if (currentEmployeeView !== AppView.EMPLOYEE_PROFILE && currentEmployeeView !== AppView.DOCUMENT_UPLOAD) {
        return AppView.DOCUMENT_UPLOAD;
      }
      return currentEmployeeView;
    }
    if (currentEmployeeView === AppView.EMPLOYEE_DASHBOARD) {
      return AppView.EMPLOYEE_PROFILE;
    }
    return currentEmployeeView;
  }, [currentEmployeeView, employeeData]);

  const getPageTitle = () => {
    const activeNavItem = navItems.find(item => item.view === activeView);
    return activeNavItem ? activeNavItem.label : 'Employee Dashboard';
  };

  const renderEmployeeContent = () => {
    let content;
    const isViewAllowed = navItems.some(item => item.view === activeView);
    const viewToRender = isViewAllowed ? activeView : AppView.EMPLOYEE_PROFILE;

    switch (viewToRender) {
      case AppView.EMPLOYEE_PROFILE:
        content = <EmployeeProfileView employeeData={employeeData} fallbackFormSections={formSections} portalConfig={portalConfig} sites={sites} />;
        break;
      case AppView.EMPLOYEE_LEAVE_REQUESTS:
        content = <EmployeeLeaveRequestPage
          employeeId={authUser?.id || ''}
          existingRequests={leaveRequests}
          onSubmitRequest={onSubmitLeaveRequest}
          roles={roles}
          workflowConfigs={workflowConfigs}
          leaveBalances={leaveBalances}
          leavePolicy={leavePolicy}
          activeAssignments={(employeeData as any)?.activeAssignments}
          sites={sites}
        />;
        break;
      case AppView.EMPLOYEE_ACCOUNT_UPDATES:
        content = <EmployeeAccountUpdatePage
          employeeId={authUser?.id || ''}
          employeeData={employeeData}
          existingRequests={accountUpdateRequests}
          onSubmitRequest={onSubmitAccountUpdateRequest}
          allowedFieldIds={editableFieldIds}
          roles={roles}
          workflowConfigs={workflowConfigs}
        />;
        break;
      case AppView.EMPLOYEE_RESIGNATION:
        content = <EmployeeResignationPage
          employeeId={authUser?.id || ''}
          employeeData={employeeData}
          existingRequests={resignationRequests}
          onSubmitRequest={onSubmitResignationRequest}
          formSections={formSections}
          roles={roles}
          workflowConfigs={workflowConfigs}
          activeAssignments={(employeeData as any)?.activeAssignments}
          sites={sites}
        />;
        break;
      case AppView.EMPLOYEE_DISCIPLINARY:
        content = <EmployeeDisciplinaryPage disciplinaryActions={disciplinaryActions} />;
        break;
      case AppView.DOCUMENT_UPLOAD:
        content = (
          <DocumentUploadWizard
            employeeData={employeeData}
            formSections={formSections}
            onUpload={onDocumentUpload}
            onComplete={onCompleteProfile}
          />
        );
        break;
      default:
        content = <EmployeeEngagementHub authUser={authUser} employeeData={employeeData} />;
    }

    return (
      <div>
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="lg:hidden p-2 rounded-md hover:bg-gray-200 text-gray-700"
            aria-label="Open Menu"
          >
            <Menu size={24} />
          </button>

          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800">{getPageTitle()}</h1>
            {employeeData?.recruitedByName && (
              <p className="text-xs text-emerald-700 font-medium mt-1">
                Referred by: <span className="font-semibold">{employeeData.recruitedByName}</span>
              </p>
            )}
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                className="p-2 bg-white rounded-full border border-gray-200 hover:bg-gray-50 text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-200 transition-colors"
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
                      <button onClick={markAllNotificationsAsRead} className="text-xs text-green-600 hover:underline">Mark all read</button>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-gray-400 text-sm">No new notifications.</div>
                    ) : (
                      notifications.map(notif => (
                        <div
                          key={notif.id}
                          onClick={() => handleNotificationClick(notif)}
                          className={`p-3 border-b transition-colors cursor-pointer ${!notif.read ? 'bg-green-50/50 hover:bg-green-100' : 'hover:bg-gray-50'}`}
                        >
                          <div className="flex items-start">
                            <div className={`mt-1 h-2 w-2 rounded-full mr-2 flex-shrink-0 ${!notif.read ? 'bg-green-500' : 'bg-transparent'}`} />
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

            {/* Profile Dropdown */}
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center gap-2 p-1.5 pr-3 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors focus:ring-2 focus:ring-emerald-100"
              >
                <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <UserCircle size={20} />
                </div>
                <ChevronDown size={14} className="text-gray-500" />
              </button>

              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-100 z-50 animate-in fade-in slide-in-from-top-2 overflow-hidden">
                  <div className="p-3 border-b border-gray-100 bg-gray-50/50">
                    <p className="text-sm font-semibold text-gray-800 truncate">{authUser?.name || 'Employee'}</p>
                    <p className="text-xs uppercase tracking-wider text-gray-500 truncate">{employeeData?.employeeId || authUser?.id}</p>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setSecurityAction('change_password');
                        setShowSecurityModal(true);
                        setIsProfileMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Lock size={16} className="text-gray-400" /> Change Password
                    </button>

                    {/* Google Account Management */}
                    {!(employeeData as any).linkedGoogleEmail ? (
                      <button
                        onClick={() => {
                          setSecurityAction('link_google');
                          setShowSecurityModal(true);
                          setIsProfileMenuOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <LinkIcon size={16} className="text-gray-400" /> Link Google Account
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setSecurityAction('change_google');
                          setShowSecurityModal(true);
                          setIsProfileMenuOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 border-t border-gray-50 group flex items-start gap-2"
                      >
                        <svg className="w-4 h-4 mt-0.5 text-[#db4a39] group-hover:text-[#c53929]" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12.24 10.285V14.4h6.806c-.275 1.765-2.056 5.174-6.806 5.174-4.095 0-7.439-3.389-7.439-7.574s3.345-7.574 7.439-7.574c2.33 0 3.891.989 4.785 1.849l3.254-3.138C18.189 1.186 15.479 0 12.24 0c-6.635 0-12 5.365-12 12s5.365 12 12 12c6.926 0 11.52-4.869 11.52-11.726 0-.788-.085-1.39-.189-1.989H12.24z" />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">Linked Google Account</p>
                          <p className="text-xs text-gray-800 font-medium truncate">{(employeeData as any).linkedGoogleEmail}</p>
                        </div>
                      </button>
                    )}

                    <div className="border-t border-gray-100 my-1"></div>

                    <button
                      onClick={onLogout}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <LogOut size={16} /> Logout
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
        {content}
      </div>
    );
  };

  if (!employeeData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-6 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-500">Loading your employee data...</p>
      </div>
    );
  }

  // === NATIVE APP LAYOUT ===
  if (native) {
    // Define bottom tab items (max 4 + More)
    const primaryTabs = navItems.slice(0, 3); // Profile, Leave, Updates
    const moreItems = navItems.slice(3); // Resignation, Disciplinary, etc.
    const hasMoreItems = moreItems.length > 0;

    return (
      <div className="min-h-screen bg-white flex flex-col">
        {/* Security Modal */}
        <SecuritySettingsModal
          isOpen={showSecurityModal}
          onClose={() => { setShowSecurityModal(false); setIsForcedSecurity(false); }}
          isForced={isForcedSecurity}
          initialTab={securityAction}
          employeeId={employeeData.employeeId || authUser?.id || ''}
        />

        {/* Native Top Bar */}
        <div className="native-top-bar">
          <div className="top-bar-left">
            <img src="/logo.png" alt="Logo" className="h-8 w-auto" />
          </div>
          <h1>{getPageTitle()}</h1>
          <div className="top-bar-right">
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                className="p-2 rounded-full text-gray-600"
                style={{ minHeight: '40px', minWidth: '40px' }}
              >
                <Bell size={22} />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 h-4 w-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold border-2 border-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {isNotificationOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
                  <div className="p-3 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                    <h4 className="font-bold text-gray-700 text-sm">Notifications</h4>
                    {unreadCount > 0 && (
                      <button onClick={markAllNotificationsAsRead} className="text-xs text-green-600 hover:underline">Mark all read</button>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-gray-400 text-sm">No new notifications.</div>
                    ) : (
                      notifications.map(notif => (
                        <div
                          key={notif.id}
                          onClick={() => handleNotificationClick(notif)}
                          className={`p-3 border-b transition-colors cursor-pointer ${!notif.read ? 'bg-green-50/50 hover:bg-green-100' : 'hover:bg-gray-50'}`}
                        >
                          <div className="flex items-start">
                            <div className={`mt-1 h-2 w-2 rounded-full mr-2 flex-shrink-0 ${!notif.read ? 'bg-green-500' : 'bg-transparent'}`} />
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
          </div>
        </div>

        {/* Main Content Area */}
        <div className={`flex-1 overflow-y-auto native-content-with-tabs native-main-content ${native ? 'page-enter' : ''}`}>
          {employeeData?.needsProfileCompletion && activeView !== AppView.DOCUMENT_UPLOAD && (
            <div className={`mb-4 border rounded-xl p-3 flex items-center justify-between shadow-sm ${(employeeData as any).profileStatus === 'waiting_for_admin'
              ? 'bg-blue-50 border-blue-200'
              : 'bg-amber-50 border-amber-200'
              }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${(employeeData as any).profileStatus === 'waiting_for_admin'
                  ? 'bg-blue-100 text-blue-600'
                  : 'bg-amber-100 text-amber-600'
                  }`}>
                  {(employeeData as any).profileStatus === 'waiting_for_admin' ? <ShieldAlert size={18} /> : <AlertCircle size={18} />}
                </div>
                <div>
                  <h4 className={`font-bold text-xs ${(employeeData as any).profileStatus === 'waiting_for_admin' ? 'text-blue-900' : 'text-amber-900'}`}>
                    {(employeeData as any).profileStatus === 'waiting_for_admin' ? 'Pending Admin Approval' : 'Complete Your Profile'}
                  </h4>
                </div>
              </div>
              {(employeeData as any).profileStatus !== 'waiting_for_admin' && (
                <Button size="sm" variant="primary" className="bg-amber-600 hover:bg-amber-700 border-none text-white text-xs" onClick={() => navigateTo(AppView.DOCUMENT_UPLOAD)}>
                  Complete
                </Button>
              )}
            </div>
          )}
          {renderEmployeeContent()}
        </div>

        {/* Bottom Tab Bar */}
        <div className="native-bottom-tabs">
          {primaryTabs.map(item => (
            <button
              key={item.view}
              onClick={() => navigateTo(item.view)}
              className={activeView === item.view ? 'active' : ''}
            >
              {item.icon}
              <span>{item.label === 'My Profile' ? 'Profile' : item.label === 'Leave Requests' ? 'Leave' : item.label === 'Account Updates' ? 'Updates' : item.label}</span>
            </button>
          ))}
          {hasMoreItems && (
            <button
              onClick={() => setIsMoreSheetOpen(true)}
              className={moreItems.some(i => i.view === activeView) ? 'active' : ''}
            >
              <MoreHorizontal size={22} />
              <span>More</span>
            </button>
          )}
        </div>

        {/* More Sheet */}
        {isMoreSheetOpen && (
          <>
            <div className="native-more-sheet-overlay" onClick={() => setIsMoreSheetOpen(false)} />
            <div className="native-more-sheet">
              <div className="sheet-handle" />
              {moreItems.map(item => (
                <button
                  key={item.view}
                  className={`sheet-item ${activeView === item.view ? 'font-bold' : ''}`}
                  onClick={() => {
                    navigateTo(item.view);
                    setIsMoreSheetOpen(false);
                  }}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
              <div className="sheet-divider" />
              <button
                className="sheet-item"
                onClick={() => {
                  setSecurityAction('change_password');
                  setShowSecurityModal(true);
                  setIsMoreSheetOpen(false);
                }}
              >
                <Lock size={20} />
                Change Password
              </button>
              {!(employeeData as any).linkedGoogleEmail ? (
                <button
                  className="sheet-item"
                  onClick={() => {
                    setSecurityAction('link_google');
                    setShowSecurityModal(true);
                    setIsMoreSheetOpen(false);
                  }}
                >
                  <LinkIcon size={20} />
                  Link Google Account
                </button>
              ) : (
                <button
                  className="sheet-item"
                  style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px', padding: '12px 16px' }}
                  onClick={() => {
                    setSecurityAction('change_google');
                    setShowSecurityModal(true);
                    setIsMoreSheetOpen(false);
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#db4a39' }}>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12.24 10.285V14.4h6.806c-.275 1.765-2.056 5.174-6.806 5.174-4.095 0-7.439-3.389-7.439-7.574s3.345-7.574 7.439-7.574c2.33 0 3.891.989 4.785 1.849l3.254-3.138C18.189 1.186 15.479 0 12.24 0c-6.635 0-12 5.365-12 12s5.365 12 12 12c6.926 0 11.52-4.869 11.52-11.726 0-.788-.085-1.39-.189-1.989H12.24z" />
                    </svg>
                    <span style={{ fontSize: '12px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Linked Google Account</span>
                  </div>
                  <span style={{ fontSize: '14px', color: '#1f2937', paddingLeft: '28px' }}>{(employeeData as any).linkedGoogleEmail}</span>
                </button>
              )}
              <div className="sheet-divider" />
              <button
                className="sheet-item danger"
                onClick={() => { setIsMoreSheetOpen(false); onLogout(); }}
              >
                <LogOut size={20} />
                Logout
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // === WEB LAYOUT (unchanged) ===
  return (
    <div className="h-screen flex bg-gray-100 overflow-hidden">

      {/* Security Modal */}
      <SecuritySettingsModal
        isOpen={showSecurityModal}
        onClose={() => { setShowSecurityModal(false); setIsForcedSecurity(false); }}
        isForced={isForcedSecurity}
        initialTab={securityAction}
        employeeId={employeeData.employeeId || authUser?.id || ''}
      />

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside
        className={`bg-emerald-900 text-white transition-all duration-300 flex flex-col shadow-xl z-50
          fixed inset-y-0 left-0 lg:relative
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${isSidebarExpanded ? 'w-72' : 'lg:w-20 w-72'}
        `}
        onMouseEnter={() => !isMobileMenuOpen && setIsSidebarHovered(true)}
        onMouseLeave={() => !isMobileMenuOpen && setIsSidebarHovered(false)}
      >
        <div className="flex items-center justify-between p-4 border-b border-emerald-800">
          {isSidebarExpanded && (
            <div className="flex items-center space-x-2 animate-in fade-in duration-200">
              <span className="font-bold text-lg tracking-tight whitespace-nowrap">Employee Portal</span>
            </div>
          )}
          <button
            onClick={() => {
              if (window.innerWidth < 1024) {
                setIsMobileMenuOpen(false);
              } else {
                setIsSidebarCollapsed(!isSidebarCollapsed);
              }
            }}
            className={`p-1.5 rounded-md hover:bg-emerald-800 text-emerald-200 hover:text-white transition-colors ${!isSidebarExpanded ? 'mx-auto' : ''}`}
          >
            {window.innerWidth < 1024 ? <X size={20} /> : (isSidebarCollapsed ? <Menu size={20} /> : <ChevronLeft size={20} />)}
          </button>
        </div>

        <div className={`flex flex-col items-center py-6 px-2 border-b border-emerald-800 transition-all duration-300 ${isSidebarExpanded ? 'mb-2' : 'mb-6'}`}>
          {isSidebarExpanded ? (
            <div className="animate-in fade-in duration-300 flex flex-col items-center">
              <img src="/logo.png" alt="Logo" className="h-16 w-auto mb-3" />
              <h1 className="text-md font-bold text-center leading-tight whitespace-nowrap">Unique Delta Force</h1>
              <p className="text-xs text-emerald-200 text-center mt-1 truncate w-full px-2">Welcome, {authUser?.name || authUser?.id || 'User'}!</p>
            </div>
          ) : (
            <img src="/logo.png" alt="Logo" className="h-8 w-auto mb-2" />
          )}
        </div>

        <div className="space-y-1 p-3 overflow-y-auto flex-1 custom-scrollbar">
          {navItems.map(item => (
            <button
              key={item.view}
              onClick={() => {
                navigateTo(item.view);
                if (window.innerWidth < 1024) setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center space-x-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors mb-1
                            ${activeView === item.view
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-emerald-100 hover:bg-emerald-800 hover:text-white'}
                            ${!isSidebarExpanded ? 'justify-center' : ''}
                            `}
              title={!isSidebarExpanded ? item.label : ''}
            >
              <div className="flex-shrink-0">{item.icon}</div>
              {isSidebarExpanded && <span className="whitespace-nowrap overflow-hidden text-ellipsis animate-in fade-in duration-200">{item.label}</span>}
            </button>
          ))}
        </div>
      </aside>

      <main className="flex-1 p-6 lg:p-8 overflow-y-auto bg-gray-50/50 custom-scrollbar">
        <div className="max-w-7xl mx-auto">
          {(() => {
            const breadcrumbs: { label: string; path?: string; active?: boolean }[] = [{ label: 'Employee', path: '/employee' }];
            const activeNavItem = navItems.find(item => item.view === activeView);
            if (activeNavItem && activeView !== AppView.EMPLOYEE_DASHBOARD) {
              breadcrumbs.push({ label: activeNavItem.label, active: true });
            } else if (breadcrumbs.length > 0) {
              breadcrumbs[breadcrumbs.length - 1].active = true;
            }
            return breadcrumbs.length > 0 ? <Breadcrumb items={breadcrumbs} onNavigate={(path) => navigateTo(path as AppView)} /> : null;
          })()}

          {employeeData?.needsProfileCompletion && activeView !== AppView.DOCUMENT_UPLOAD && (
            <div className={`mb-6 border rounded-xl p-4 flex items-center justify-between shadow-md ${(employeeData as any).profileStatus === 'waiting_for_admin'
              ? 'bg-blue-50 border-blue-200'
              : 'bg-amber-50 border-amber-200'
              }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${(employeeData as any).profileStatus === 'waiting_for_admin'
                  ? 'bg-blue-100 text-blue-600'
                  : 'bg-amber-100 text-amber-600'
                  }`}>
                  {(employeeData as any).profileStatus === 'waiting_for_admin' ? <ShieldAlert size={20} /> : <AlertCircle size={20} />}
                </div>
                <div>
                  <h4 className={`font-bold text-sm ${(employeeData as any).profileStatus === 'waiting_for_admin' ? 'text-blue-900' : 'text-amber-900'
                    }`}>
                    {(employeeData as any).profileStatus === 'waiting_for_admin'
                      ? 'Profile Pending Admin Approval'
                      : 'Action Required: Complete Your Profile'}
                  </h4>
                  <p className={`text-xs ${(employeeData as any).profileStatus === 'waiting_for_admin' ? 'text-blue-700' : 'text-amber-700'
                    }`}>
                    {(employeeData as any).profileStatus === 'waiting_for_admin'
                      ? 'You have submitted your profile details. Please wait for HR to verify and activate your account.'
                      : 'You need to upload missing documents before your account is fully activated.'}
                  </p>
                </div>
              </div>
              {(employeeData as any).profileStatus !== 'waiting_for_admin' && (
                <Button
                  size="sm"
                  variant="primary"
                  className="bg-amber-600 hover:bg-amber-700 border-none text-white whitespace-nowrap"
                  onClick={() => navigateTo(AppView.DOCUMENT_UPLOAD)}
                >
                  Complete Now
                </Button>
              )}
            </div>
          )}

          {renderEmployeeContent()}
        </div>
      </main>
    </div>
  );
};

export default EmployeeDashboardPage;

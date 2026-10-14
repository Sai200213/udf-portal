import { AppView } from '../../App';
import {
    FormSection,
    SubmittedFormData,
    LeaveRequest,
    AccountUpdateRequest,
    ResignationRequest,
    User,
    Role,
    Site,
    WorkflowConfig,
    PortalConfig,
    LeavePolicy,
    DisciplinaryAction,
    LeaveBalance,
    Notification,
    StaffUser,
    FirestoreEmployee,
    DraftSubmission
} from '../../types';

export interface AdminProps {
    currentAdminView: AppView;
    navigateTo: (view: AppView) => void;
    onLogout: () => void;
    authUser: User | null;
    allowedSiteIds?: string[];

    // Data
    submittedForms: SubmittedFormData[];
    leaveRequests: LeaveRequest[];
    accountUpdateRequests: AccountUpdateRequest[];
    resignationRequests: ResignationRequest[];
    disciplinaryActions: DisciplinaryAction[];
    leaveBalances: LeaveBalance[];
    employees: FirestoreEmployee[];
    drafts: DraftSubmission[];

    // Configuration
    roles: Role[];
    sites: Site[];
    workflowConfigs: WorkflowConfig[];
    portalConfig: PortalConfig | null;
    leavePolicy: LeavePolicy | null;
    formSections: FormSection[];
    editableFieldIds: string[];
    staffUsers: StaffUser[];

    // Actions - Submissions
    onApproveSubmission: (id: string, level: number) => Promise<void>;
    onRejectSubmission: (id: string, level: number, reason: string) => Promise<void>;
    onRevertSubmission: (id: string, targetLevel: number) => Promise<void>;
    onAssignEmployeeId: (submissionId: string, employeeId: string) => Promise<void>;
    onDeleteSubmission: (id: string) => Promise<void>;
    onSoftDeleteSubmission: (id: string) => Promise<void>;
    onBulkSoftDeleteSubmissions: (ids: string[]) => Promise<void>;
    onBulkPermanentDeleteSubmissions: (ids: string[]) => Promise<void>;

    // Actions - Leaves
    onApproveLeave: (id: string, level: number) => Promise<void>;
    onRejectLeave: (id: string, level: number, comments: string) => Promise<void>;
    onRevertLeave: (id: string, targetLevel: number) => Promise<void>;
    onDeleteLeaveRequest: (id: string) => Promise<void>;

    // Actions - Account Updates
    onApproveAccountUpdate: (id: string, level: number) => Promise<void>;
    onRejectAccountUpdate: (id: string, level: number, comments: string) => Promise<void>;
    onRevertAccountUpdate: (id: string, targetLevel: number) => Promise<void>;
    onDeleteAccountUpdate: (id: string) => Promise<void>;

    // Actions - Resignations
    onApproveResignation: (id: string, level: number) => Promise<void>;
    onRejectResignation: (id: string, level: number, comments: string) => Promise<void>;
    onRevertResignation: (id: string, targetLevel: number) => Promise<void>;
    onDeleteResignation: (id: string) => Promise<void>;

    // Actions - Employees
    onSoftDeleteEmployee: (employeeId: string) => Promise<void>;
    onRestoreEmployee: (employeeId: string) => Promise<void>;
    onRelieveEmployee: (employeeId: string, relievingDate: string, reason: 'Resignation' | 'Termination' | 'Absconding' | 'ContractEnded' | 'Other') => Promise<void>;
    onRejoinEmployee: (employeeId: string) => Promise<void>;
    onSyncDriveFolder: (employeeId: string) => Promise<void>;

    // Actions - Disciplinary
    onAddDisciplinaryAction: (action: Omit<DisciplinaryAction, 'id'>) => Promise<void>;
    onDeleteDisciplinaryAction: (id: string) => Promise<void>;

    // Actions - Configuration
    onUpdateRoles: (roles: Role[]) => Promise<void>;
    onUpdateSites: (sites: Site[]) => Promise<void>;
    onUpdateWorkflows: (workflows: WorkflowConfig[]) => Promise<void>;
    onUpdatePortalConfig: (config: PortalConfig) => Promise<void>;
    onUpdateLeavePolicy: (policy: LeavePolicy) => Promise<void>;
    onUpdateFormSections: (sections: FormSection[]) => Promise<void>;
    onUpdateEditableFields: (fieldIds: string[]) => Promise<void>;
    onUpdateStaffUsers: (users: StaffUser[]) => Promise<void>;

    // Notifications
    notifications: Notification[];
    markNotificationAsRead: (id: string) => void;
    markAllNotificationsAsRead: (userId: string) => void;
}

export interface EmployeeProps {
    currentEmployeeView: AppView;
    navigateTo: (view: AppView) => void;
    onLogout: () => void;
    authUser: User | null;

    // Employee Data
    employeeData: SubmittedFormData | undefined;
    leaveRequests: LeaveRequest[];
    accountUpdateRequests: AccountUpdateRequest[];
    resignationRequests: ResignationRequest[];
    disciplinaryActions: DisciplinaryAction[];

    // Actions
    onSubmitLeaveRequest: (data: Omit<LeaveRequest, 'id' | 'status' | 'submissionDate' | 'currentLevel' | 'approvalHistory'>) => Promise<void>;
    onSubmitAccountUpdateRequest: (data: Omit<AccountUpdateRequest, 'id' | 'status' | 'submissionDate' | 'currentLevel' | 'approvalHistory'>) => Promise<void>;
    onSubmitResignationRequest: (data: Omit<ResignationRequest, 'id' | 'status' | 'submissionDate' | 'currentLevel' | 'approvalHistory'>) => Promise<void>;
    onDocumentUpload: (fieldId: string, file: File) => Promise<string>;
    onCompleteProfile: () => Promise<void>;

    // Configuration (Read-only for employees)
    formSections: FormSection[];
    editableFieldIds: string[];
    roles: Role[];
    workflowConfigs: WorkflowConfig[];
    leaveBalances: LeaveBalance[];
    leavePolicy: LeavePolicy | null;
    portalConfig: PortalConfig | null;

    // Notifications
    notifications: Notification[];
    markNotificationAsRead: (id: string) => void;
    markAllNotificationsAsRead: (userId: string) => void;
}


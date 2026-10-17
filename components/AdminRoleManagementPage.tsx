import React, { useState } from 'react';
import { Role, Permission, StaffUser, FormSection } from '../types';
import Button from './common/Button';
import Input from './common/Input';
import Modal from './common/Modal';
import { 
  ShieldCheck, Plus, Trash2, CheckCircle2, Circle, Shield, ChevronRight, 
  AlertTriangle, EyeOff, Eye, Info, Settings, Briefcase, Eye as ViewIcon, 
  Search, UserCog, Users, Sliders, X, Check, Lock, List, ClipboardList
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { updateRoles } from '../src/services/adminService';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../src/firebase/config';

interface AdminRoleManagementPageProps {
  roles: Role[];
  setRoles: React.Dispatch<React.SetStateAction<Role[]>>;
  staffUsers: StaffUser[];
  setStaffUsers: React.Dispatch<React.SetStateAction<StaffUser[]>>; // Consolidated setStaffUsers prop
  onNotify: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  formSections: FormSection[];
  logAction?: (actionType: any, targetModule: any, details: string) => void;
}

interface PermissionSubOption {
  key: Permission;
  label: string;
  explanation: string;
}

interface PermissionModule {
  id: string;
  groupId: 'requests' | 'personnel' | 'sites' | 'system';
  name: string;
  description: string;
  viewPermission: Permission;
  scopeAllPermission?: Permission;
  readOnlyOptions: PermissionSubOption[];
  decisionOptions: PermissionSubOption[];
}

const PERMISSION_MODULES: PermissionModule[] = [
  {
    id: 'onboarding',
    groupId: 'requests',
    name: 'New Joining Requests',
    description: 'Manage applicant submissions in the onboarding pipeline, file review, and approvals.',
    viewPermission: Permission.SUBMISSIONS_VIEW,
    scopeAllPermission: Permission.SUBMISSIONS_VIEW_SCOPE_ALL,
    readOnlyOptions: [
      { key: Permission.SUBMISSIONS_PREVIEW_DOCS, label: 'Preview Documents', explanation: 'Allows opening and viewing uploaded PDFs, JPGs, or Google Drive files.' },
      { key: Permission.SUBMISSIONS_VIEW_DRAFTS, label: 'Access Onboarding Drafts', explanation: 'Allows viewing and managing incomplete onboarding draft submissions.' },
      { key: Permission.SUBMISSIONS_VIEW_CORRECTION_LINKS, label: 'Access Correction Links', explanation: 'Allows viewing and managing generated profile correction links.' },
      { key: Permission.SUBMISSIONS_PRINT_BIODATA, label: 'Print Candidate Biodata', explanation: 'Allows viewing and printing candidate biodata sheets.' }
    ],
    decisionOptions: [
      { key: Permission.SUBMISSIONS_APPROVE, label: 'Approve Submissions', explanation: 'Allows advancing submissions through the approval pipeline.' },
      { key: Permission.SUBMISSIONS_REJECT, label: 'Reject Submissions', explanation: 'Allows rejecting submissions in the onboarding pipeline.' },
      { key: Permission.SUBMISSIONS_ADD_COMMENTS, label: 'Add Comments', explanation: 'Allows adding review remarks during approvals/rejections.' },
      { key: Permission.SUBMISSIONS_EDIT_COMMENTS, label: 'Edit Own Comments', explanation: 'Allows modifying previously submitted comments in the approval history.' },
      { key: Permission.SUBMISSIONS_REVERT_DECISION, label: 'Revert Submissions', explanation: 'Allows sending submissions back to previous workflow levels.' },
      { key: Permission.SUBMISSIONS_CREATE_CORRECTION_LINK, label: 'Request Profile Corrections', explanation: 'Allows creating dynamic links for applicants to update incorrect details.' },
      { key: Permission.SUBMISSIONS_ASSIGN_EMPLOYEE_ID, label: 'Assign Employee ID', explanation: 'Allows assigning or pre-filling a unique Employee ID during approval steps.' },
      { key: Permission.DELETE_SUBMISSION, label: 'Hard Delete Submissions', explanation: 'Allows permanently removing onboarding submissions from the system.' }
    ]
  },
  {
    id: 'leaves',
    groupId: 'requests',
    name: 'Leave Requests',
    description: 'Access, monitor, and process guard leave requests and adjust balance quotas.',
    viewPermission: Permission.LEAVES_VIEW,
    scopeAllPermission: Permission.LEAVES_VIEW_SCOPE_ALL,
    readOnlyOptions: [],
    decisionOptions: [
      { key: Permission.LEAVES_APPROVE, label: 'Approve Leaves', explanation: 'Allows approving leave requests.' },
      { key: Permission.LEAVES_REJECT, label: 'Reject Leaves', explanation: 'Allows rejecting leave requests.' },
      { key: Permission.LEAVES_ADD_COMMENTS, label: 'Add Leave Comments', explanation: 'Allows writing reasons/remarks when deciding on leaves.' },
      { key: Permission.LEAVES_EDIT_COMMENTS, label: 'Edit Leave Comments', explanation: 'Allows modifying previously submitted leave comments.' },
      { key: Permission.LEAVES_REVERT_DECISION, label: 'Revert Leave level', explanation: 'Allows sending leave applications back to prior review levels.' },
      { key: Permission.LEAVES_DELETE, label: 'Delete Leave Requests', explanation: 'Allows deleting processed or pending leave records.' },
      { key: Permission.LEAVES_MANAGE_BALANCES, label: 'Manage Leave Balances', explanation: 'Allows manually editing guard casual, sick, earned, or unpaid leave balances.' }
    ]
  },
  {
    id: 'updates',
    groupId: 'requests',
    name: 'Account Updates',
    description: 'Review and process employee requests to update their profile information.',
    viewPermission: Permission.ACCOUNT_UPDATES_VIEW,
    scopeAllPermission: Permission.ACCOUNT_UPDATES_VIEW_SCOPE_ALL,
    readOnlyOptions: [],
    decisionOptions: [
      { key: Permission.ACCOUNT_UPDATES_APPROVE, label: 'Approve Update Requests', explanation: 'Allows saving profile updates to the master employee record.' },
      { key: Permission.ACCOUNT_UPDATES_REJECT, label: 'Reject Update Requests', explanation: 'Allows rejecting profile update requests.' },
      { key: Permission.ACCOUNT_UPDATES_ADD_COMMENTS, label: 'Add Comments', explanation: 'Allows writing comments on update request decisions.' },
      { key: Permission.ACCOUNT_UPDATES_EDIT_COMMENTS, label: 'Edit Comments', explanation: 'Allows modifying comments on update decisions.' },
      { key: Permission.ACCOUNT_UPDATES_REVERT_DECISION, label: 'Revert Update level', explanation: 'Allows sending update requests back to a prior level.' },
      { key: Permission.ACCOUNT_UPDATES_DELETE, label: 'Delete Update Requests', explanation: 'Allows removing update requests from database logs.' }
    ]
  },
  {
    id: 'resignations',
    groupId: 'requests',
    name: 'Resignation Requests',
    description: 'Process resignation requests, relieving dates, and employee exit operations.',
    viewPermission: Permission.RESIGNATIONS_VIEW,
    scopeAllPermission: Permission.RESIGNATIONS_VIEW_SCOPE_ALL,
    readOnlyOptions: [],
    decisionOptions: [
      { key: Permission.RESIGNATIONS_APPROVE, label: 'Approve Resignations', explanation: 'Allows processing resignations, accepting them, and specifying relieving dates.' },
      { key: Permission.RESIGNATIONS_REJECT, label: 'Reject Resignations', explanation: 'Allows rejecting resignation requests.' },
      { key: Permission.RESIGNATIONS_ADD_COMMENTS, label: 'Add Comments', explanation: 'Allows writing remarks on resignation decisions.' },
      { key: Permission.RESIGNATIONS_EDIT_COMMENTS, label: 'Edit Comments', explanation: 'Allows editing remarks logged on processed resignations.' },
      { key: Permission.RESIGNATIONS_REVERT_DECISION, label: 'Revert Resignation level', explanation: 'Allows pushing a resignation request back to a prior review stage.' },
      { key: Permission.RESIGNATIONS_DELETE, label: 'Delete Resignations', explanation: 'Allows removing resignation records from history.' }
    ]
  },
  {
    id: 'disciplinary',
    groupId: 'requests',
    name: 'Disciplinary Warnings',
    description: 'Manage and file verbal/written warnings, suspensions, show-cause notices, and disciplinary records.',
    viewPermission: Permission.DISCIPLINE_VIEW,
    scopeAllPermission: Permission.DISCIPLINE_VIEW_SCOPE_ALL,
    readOnlyOptions: [],
    decisionOptions: [
      { key: Permission.DISCIPLINE_MANAGE, label: 'File Warnings', explanation: 'Allows filing verbal/written warnings, suspensions, or show-cause notices.' },
      { key: Permission.DISCIPLINE_DELETE, label: 'Delete Warnings', explanation: 'Allows removing disciplinary records from employee files.' }
    ]
  },
  {
    id: 'bgv',
    groupId: 'requests',
    name: '3rd-Party BGV Clearance',
    description: 'Track external background verification for guards deployed to client-mandated sites (Wipro, Capgemini, etc.).',
    viewPermission: Permission.BGV_VIEW,
    scopeAllPermission: Permission.BGV_VIEW_SCOPE_ALL,
    readOnlyOptions: [
      { key: Permission.BGV_VIEW_DOSSIER, label: 'View Candidate Dossier', explanation: 'Allows opening and inspecting the candidate packet with uploaded documents and personal details.' },
      { key: Permission.BGV_COPY_DOSSIER, label: 'Copy Dossier to Clipboard', explanation: 'Allows 1-click copying formatted candidate verification dossier for emails.' }
    ],
    decisionOptions: [
      { key: Permission.BGV_DISPATCH_VENDOR, label: 'Dispatch to Vendor', explanation: 'Allows assigning cases to 3rd-party vendors and marking Under Process.' },
      { key: Permission.BGV_UPLOAD_CERTIFICATE, label: 'Upload BGV Certificate', explanation: 'Allows uploading verification reports/certificates (PDF or Image).' },
      { key: Permission.BGV_APPROVE_REJECT, label: 'Approve / Reject Vendor Reports', explanation: 'Allows staff to approve vendor submissions or flag adverse verification findings.' },
      { key: Permission.BGV_CONFIGURE_FIELDS, label: 'Configure Extraction Fields', explanation: 'Allows choosing which fields from the Onboarding Form are extracted into BGV dossiers.' },
      { key: Permission.BGV_MANAGE, label: 'Full BGV Management (All Permissions)', explanation: 'Grants comprehensive control over the entire BGV verification pipeline.' },
      { key: Permission.BGV_VENDOR, label: 'Vendor Direct Access Mode', explanation: 'Restricts user to vendor view (view assigned cases and upload completion reports only).' }
    ]
  },
  {
    id: 'grievances',
    groupId: 'requests',
    name: 'Employee Care & Grievances',
    description: 'Review anonymous and direct employee grievances, resolve incident tickets, and fulfill reward redemptions.',
    viewPermission: Permission.GRIEVANCES_VIEW,
    scopeAllPermission: Permission.GRIEVANCES_VIEW_SCOPE_ALL,
    readOnlyOptions: [
      { key: Permission.REWARDS_VIEW, label: 'View Reward Redemptions', explanation: 'Allows viewing gamification point reward redemption requests.' }
    ],
    decisionOptions: [
      { key: Permission.GRIEVANCES_RESOLVE, label: 'Resolve Grievance Tickets', explanation: 'Allows changing grievance ticket status (in-review, resolved, dismissed) and adding resolution notes.' },
      { key: Permission.GRIEVANCES_DELETE, label: 'Delete Grievance Tickets', explanation: 'Allows permanently purging grievance tickets from the database.' },
      { key: Permission.REWARDS_MANAGE, label: 'Fulfill & Manage Rewards', explanation: 'Allows marking gamification rewards as fulfilled or rejected with fulfillment notes.' }
    ]
  },
  {
    id: 'personnel',
    groupId: 'personnel',
    name: 'Personnel Directory',
    description: 'View the Master Employee List, export lists, and edit employee profile master records.',
    viewPermission: Permission.EMPLOYEES_VIEW,
    scopeAllPermission: Permission.EMPLOYEES_VIEW_SCOPE_ALL,
    readOnlyOptions: [
      { key: Permission.EMPLOYEES_VIEW_SENSITIVE_INFO, label: 'View Sensitive Info', explanation: 'Allows viewing bank details, base salaries, and private document numbers.' },
      { key: Permission.EMPLOYEES_VIEW_TIMELINE, label: 'View Life Cycle Timeline', explanation: 'Allows checking guard audit logs (warning history, rejoice events, etc.).' },
      { key: Permission.EMPLOYEES_TAB_ACTIVE, label: 'Access Active Tab', explanation: 'Allows viewing the Active tab in the Master Employee List.' },
      { key: Permission.EMPLOYEES_TAB_PENDING, label: 'Access Pending Profile Tab', explanation: 'Allows viewing the Pending Profile tab in the Master Employee List.' },
      { key: Permission.EMPLOYEES_TAB_RELIEVED, label: 'Access Relieved Tab', explanation: 'Allows viewing the Relieved tab in the Master Employee List.' },
      { key: Permission.EMPLOYEES_TAB_RECYCLE_BIN, label: 'Access Recycle Bin Tab', explanation: 'Allows viewing the Recycle Bin tab in the Master Employee List.' },
      { key: Permission.EMPLOYEES_SEARCH, label: 'Use Directory Search', explanation: 'Allows searching guards by name, ID, or other fields.' },
      { key: Permission.EMPLOYEES_COLUMN_FILTER, label: 'Use Column Filters', explanation: 'Allows toggling visible columns and filtering rows by columns.' },
      { key: Permission.EMPLOYEES_VIEW_ONBOARDING_METHOD, label: 'View Onboarding Methods/Badges', explanation: 'Allows viewing how each guard was onboarded (Self Onboarded, Admin Approved, Bulk Upload, etc.).' }
    ],
    decisionOptions: [
      { key: Permission.EMPLOYEES_EDIT_PROFILE, label: 'Edit Profile Fields', explanation: 'Allows manually editing text details, sites, or designations in employee records.' },
      { key: Permission.EMPLOYEES_ACTION_RELIEVE, label: 'Relieve Employee', explanation: 'Allows terminating active employee profiles and setting relieving status.' },
      { key: Permission.EMPLOYEES_ACTION_REJOIN, label: 'Rejoin Employee', explanation: 'Allows re-hiring a relieved employee under a new ID.' },
      { key: Permission.EMPLOYEES_ACTION_RESTORE, label: 'Restore Employee', explanation: 'Allows restoring soft-deleted employee files from Trash.' },
      { key: Permission.DELETE_EMPLOYEE, label: 'Hard Delete Employees', explanation: 'Allows permanently purging active/relieved guard records from the database.' },
      { key: Permission.EXPORT_DATA, label: 'Export Personnel Data', explanation: 'Allows downloading the guard directory spreadsheet (CSV/Excel).' },
      { key: Permission.EMPLOYEES_IMPORT, label: 'Import Roster Data', explanation: 'Allows bulk importing employee profiles from Excel/CSV files.' },
      { key: Permission.EMPLOYEES_CORRECT_ID, label: 'Correct Employee ID', explanation: 'Allows changing a guard\'s official employee ID.' },
      { key: Permission.EMPLOYEES_REQUEST_CORRECTION, label: 'Request Profile Correction', explanation: 'Allows sending correction requests to guards for profile updates.' },
      { key: Permission.EMPLOYEES_MANAGE_DEPLOYMENTS, label: 'Manage Deployments Tab', explanation: 'Allows managing site deployments, relieving guards, and OT assignments.' },
      { key: Permission.EMPLOYEES_MANAGE_CLIENT_IDS, label: 'Manage Client IDs Tab', explanation: 'Allows adding or editing client-specific IDs for sites.' },
      { key: Permission.EMPLOYEES_MANAGE_SECURITY, label: 'Manage Security Tab', explanation: 'Allows managing guard authentication methods, resetting manual passwords, or unlinking Google.' },
      { key: Permission.EMPLOYEES_MARK_PROFILE_COMPLETE, label: 'Mark Profile Complete', explanation: 'Allows staff to manually mark an employee profile as Complete in Pending Profiles.' },
      { key: Permission.EMPLOYEES_SEND_PROFILE_NUDGE, label: 'Send Profile Nudge / Reminder', explanation: 'Allows sending reminder nudges to employees with incomplete onboarding profiles.' }
    ]
  },
  {
    id: 'organization_sites',
    groupId: 'sites',
    name: 'Site Management (Organization)',
    description: 'Manage company locations, facilities, supervisor assignments, subunits, designations, and client ID requirements.',
    viewPermission: Permission.SITES_VIEW,
    readOnlyOptions: [],
    decisionOptions: [
      { key: Permission.SITES_MANAGE, label: 'Manage Sites & Sub-Units', explanation: 'Allows creating new sites, editing sub-units, or changing site status in Site Management.' }
    ]
  },
  {
    id: 'recruitment_vacancies',
    groupId: 'sites',
    name: 'Vacancy Manager (Recruitment)',
    description: 'Manage job vacancies, view site operational details, update contact info, and post openings.',
    viewPermission: Permission.VACANCIES_VIEW,
    readOnlyOptions: [
      { key: Permission.SITES_EDIT_INFO, label: 'Edit Site Operational Info', explanation: 'Allows editing site address, Google Maps link, and contact number in Vacancy Manager.' }
    ],
    decisionOptions: [
      { key: Permission.VACANCIES_POST, label: 'Post & Edit Job Vacancies', explanation: 'Allows creating new vacancies and editing existing job postings.' },
      { key: Permission.VACANCIES_MANAGE, label: 'Full Vacancy Control (Delete)', explanation: 'Allows deleting vacancies and full administrative control over job openings.' }
    ]
  },
  {
    id: 'recruitment_invites',
    groupId: 'sites',
    name: 'Recruitment & Referral Invites',
    description: 'Manage referral invites, generate candidate onboarding links, and track recruitment metrics.',
    viewPermission: Permission.INVITES_VIEW,
    readOnlyOptions: [
      { key: Permission.INVITES_LOCK_PHONE, label: 'Lock Phone Number Option', explanation: 'Allows locking referral links to specific candidate phone numbers.' },
      { key: Permission.INVITES_SET_EXPIRY, label: 'Set Expiration Option', explanation: 'Allows setting custom expiration days/dates on generated referral links.' },
      { key: Permission.INVITES_PREFILL_FIELDS, label: 'Prefill Custom Fields Option', explanation: 'Allows pre-filling onboarding details when generating links.' },
      { key: Permission.INVITES_LOCK_PREFILLED, label: 'Force Lock Prefilled Fields Option', explanation: 'Allows enforcing read-only pre-filled values for onboarding candidates.' },
      { key: Permission.INVITES_VIEW_ALL, label: 'Track All Staff Invites', explanation: 'Allows viewing and tracking referral invites generated by all other staff members.' }
    ],
    decisionOptions: [
      { key: Permission.INVITES_CREATE, label: 'Generate Referral Links', explanation: 'Allows generating unique links for candidate onboarding.' },
      { key: Permission.INVITES_MANAGE, label: 'Manage All Staff Referral Links', explanation: 'Allows viewing tracker logs for all staff members and revoking any link.' },
      { key: Permission.INVITES_EDIT, label: 'Edit Active Invites', explanation: 'Allows editing site, designation, and pre-fills on active referral links.' },
      { key: Permission.INVITES_REACTIVATE, label: 'Reactivate Expired Links', explanation: 'Allows extending or reactivating expired or revoked invitation links.' },
      { key: Permission.INVITES_DELETE, label: 'Revoke/Delete Links', explanation: 'Allows revoking or deleting generated invite links.' }
    ]
  }
];

const SYSTEM_ADMIN_PERMISSIONS = [
  { key: Permission.MANAGE_SYSTEM, label: 'System Admin', explanation: 'Manage global configuration, client libraries, and legacy systems.' },
  { key: Permission.MANAGE_FORMS, label: 'Form Builder', explanation: 'Access Onboarding Form builder and Account Update fields selection.' },
  { key: Permission.MANAGE_ROLES, label: 'Role Manager', explanation: 'Configure roles default permissions and field privacy/visibility rules.' },
  { key: Permission.MANAGE_STAFF, label: 'Staff Accounts Admin', explanation: 'Create, update, suspend, or permanently delete staff accounts.' },
  { key: Permission.MANAGE_WORKFLOWS, label: 'Workflow Configurator', explanation: 'Set approval levels and workflow configurations per module.' },
  { key: Permission.VIEW_AUDIT_LOGS, label: 'View Audit Logs', explanation: 'Allows browsing the portal-wide system audit logs.' }
];

const SYSTEM_ADMIN_MODULE_STUB = {
  id: 'system_admin',
  groupId: 'system' as const,
  name: 'System Administration',
  description: 'Access system-wide portal configurations, forms builder, workflows, and audit logs. Reserved for administrators.'
};

const AdminRoleManagementPage: React.FC<AdminRoleManagementPageProps> = ({ 
  roles, 
  setRoles, 
  staffUsers, 
  setStaffUsers, 
  onNotify, 
  formSections, 
  logAction 
}) => {
  // Top-Level Tabs Navigation State
  const [topLevelTab, setTopLevelTab] = useState<'roles' | 'users'>('roles');
  
  // User Tab Search & Filter States
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('ALL');

  // Role Creation States
  const [newRoleName, setNewRoleName] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [activeCategory, setActiveCategory] = useState<'requests' | 'personnel' | 'sites' | 'system'>('requests');

  // User Overrides Modal States
  const [editingUserOverrides, setEditingUserOverrides] = useState<StaffUser | null>(null);

  // Sub-Modal Configurator States
  const [activeModuleForConfig, setActiveModuleForConfig] = useState<{
    moduleId: string;
    moduleName: string;
    isUserSpecific: boolean;
  } | null>(null);

  // Local state parameters inside the sub-modal configurator popup
  const [localAccessLevel, setLocalAccessLevel] = useState<string>('DISABLED');
  const [localScopeAll, setLocalScopeAll] = useState<string>('DENY');
  const [localSubOptions, setLocalSubOptions] = useState<Record<string, any>>({});

  // Role Deletion states
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<string | null>(null);

  // Helper: Get high level module status for a Role's permissions
  const getRoleModuleStatus = (permissions: Permission[], module: PermissionModule) => {
    const hasView = permissions.includes(module.viewPermission);
    if (!hasView) return 'Disabled';
    const decisionKeys = module.decisionOptions.map(o => o.key);
    const hasDecision = decisionKeys.some(k => permissions.includes(k));
    return hasDecision ? 'Decision-Making' : 'Read-Only';
  };

  // Helper: Get high level module status for a user's overrides
  const getUserModuleStatus = (user: StaffUser, role: Role | undefined, module: PermissionModule) => {
    const overrides = user.permissionOverrides || {};
    const baseStatus = role ? getRoleModuleStatus(role.permissions, module) : 'Disabled';
    const viewOverride = overrides[module.viewPermission];

    if (viewOverride === false) {
      return 'Forced Disabled';
    }

    const viewActive = viewOverride === true || (viewOverride === undefined && role?.permissions.includes(module.viewPermission));
    if (!viewActive) {
      return 'Inherited (Disabled)';
    }

    const decisionKeys = module.decisionOptions.map(o => o.key);
    const hasExplicitAllow = decisionKeys.some(k => overrides[k] === true);
    const hasInheritedAllow = role && decisionKeys.some(k => role.permissions.includes(k) && overrides[k] !== false);
    const hasDecision = hasExplicitAllow || hasInheritedAllow;

    const isOverridden = Object.keys(overrides).some(k => {
      const isModuleKey = k === module.viewPermission || 
                          k === module.scopeAllPermission || 
                          module.readOnlyOptions.some(o => o.key === k) || 
                          module.decisionOptions.some(o => o.key === k);
      return isModuleKey;
    });

    if (!isOverridden) {
      return `Inherited (${baseStatus})`;
    }

    return `Custom (${hasDecision ? 'Decision-Making' : 'Read-Only'})`;
  };

  // Action handlers
  const addRole = async () => {
    const trimmedName = newRoleName.trim();
    if (!trimmedName) return;
    if (trimmedName.toLowerCase() === 'super admin' || trimmedName.toLowerCase() === 'superadmin') {
      onNotify('Role name "Super Admin" is reserved for the system.', 'error');
      return;
    }
    const newRole: Role = {
      id: uuidv4(),
      name: trimmedName,
      permissions: [],
      isDisabled: false,
    };
    const updated = [...roles, newRole];
    setRoles(updated);
    try {
      await updateRoles(updated);
      onNotify(`Role "${trimmedName}" created successfully.`, 'success');
      if (logAction) logAction('CREATE', 'ROLES', `Created new role: ${trimmedName}`);
    } catch (err: any) {
      console.error("Failed to save new role to Firestore:", err);
      onNotify("Failed to save new role to server.", 'error');
    }
    setNewRoleName('');
  };
  const toggleFieldPrivacyForScope = (fieldId: string, state: 'VISIBLE' | 'READ_ONLY' | 'HIDDEN', scope: 'ONBOARDING' | 'DIRECTORY') => {
    if (!editingRole) return;

    if (scope === 'ONBOARDING') {
      const currentVisibility = editingRole.onboardingFieldVisibility || {};
      const newVisibility = { ...currentVisibility };
      if (state === 'VISIBLE') {
        delete newVisibility[fieldId];
      } else {
        newVisibility[fieldId] = state;
      }
      setEditingRole({ ...editingRole, onboardingFieldVisibility: newVisibility });
    } else {
      const currentVisibility = editingRole.fieldVisibility || {};
      const newVisibility = { ...currentVisibility };
      if (state === 'VISIBLE') {
        delete newVisibility[fieldId];
      } else {
        newVisibility[fieldId] = state;
      }
      setEditingRole({ ...editingRole, fieldVisibility: newVisibility });
    }
  };

  const handleEditRole = (role: Role) => {
    if (role.id === 'role-super-admin' || role.name.toLowerCase() === 'super admin' || role.name.toLowerCase() === 'superadmin') {
      onNotify('The Super Admin role cannot be edited.', 'error');
      return;
    }
    setEditingRole({ ...role, visibleMasterListFields: role.visibleMasterListFields || ['name', 'employeeId'] });
    setActiveCategory('requests');
    setIsEditModalOpen(true);
  };

  const saveRoleEdit = async () => {
    if (editingRole) {
      if (editingRole.id === 'role-super-admin' || editingRole.name.toLowerCase() === 'super admin' || editingRole.name.toLowerCase() === 'superadmin') {
        onNotify('The Super Admin role cannot be edited.', 'error');
        return;
      }
      const updated = roles.map(r => r.id === editingRole.id ? editingRole : r);
      setRoles(updated);
      try {
        await updateRoles(updated);
        onNotify("Role default permissions updated and saved to server.", 'success');
        if (logAction) logAction('UPDATE', 'ROLES', `Updated default permissions for role: ${editingRole.name}`);
      } catch (err: any) {
        console.error("Failed to update role in Firestore:", err);
        onNotify("Failed to save role updates to server: " + (err.message || 'Unknown error'), 'error');
      }
      setIsEditModalOpen(false);
      setEditingRole(null);
    }
  };

  const toggleRoleStatus = async (id: string) => {
    if (id === 'role-super-admin') {
      onNotify('The Super Admin role cannot be suspended.', 'error');
      return;
    }
    const updated = roles.map(r => {
      if (r.id === id) {
        return { ...r, isDisabled: !r.isDisabled };
      }
      return r;
    });
    setRoles(updated);
    const targetRole = updated.find(r => r.id === id);
    const newState = targetRole?.isDisabled;
    try {
      await updateRoles(updated);
      onNotify(`Role "${targetRole?.name}" has been ${newState ? 'suspended' : 'activated'}.`, 'info');
      if (logAction) logAction('STATUS_CHANGE', 'ROLES', `${newState ? 'Suspended' : 'Activated'} role: ${targetRole?.name}`);
    } catch (err: any) {
      onNotify("Failed to update role status on server.", 'error');
    }
  };

  const initiateDelete = (id: string) => {
    if (id === 'role-super-admin') {
      onNotify('The Super Admin role cannot be deleted.', 'error');
      return;
    }
    const staffInRole = staffUsers.filter(s => s.roleId === id);
    if (staffInRole.length > 0) {
      onNotify(`Cannot delete role. Assigned to ${staffInRole.length} staff member(s). Consider "Disabling" it instead.`, "error");
      return;
    }
    setRoleToDelete(id);
    setIsConfirmModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!roleToDelete) return;
    const roleName = roles.find(r => r.id === roleToDelete)?.name || 'Unknown';
    const updated = roles.filter(r => r.id !== roleToDelete);
    setRoles(updated);
    try {
      await updateRoles(updated);
      onNotify("Role deleted successfully.", 'success');
      if (logAction) logAction('DELETE', 'ROLES', `Deleted role: ${roleName}`);
    } catch (err: any) {
      onNotify("Failed to delete role on server.", 'error');
    }
    setIsConfirmModalOpen(false);
    setRoleToDelete(null);
  };

  // Sub-modal Opening Logics
  const openRoleModuleConfig = (module: PermissionModule | typeof SYSTEM_ADMIN_MODULE_STUB) => {
    if (!editingRole) return;

    if (module.id === 'system_admin') {
      const subOpts: Record<string, boolean> = {};
      SYSTEM_ADMIN_PERMISSIONS.forEach(p => {
        subOpts[p.key] = editingRole.permissions.includes(p.key);
      });
      setLocalSubOptions(subOpts);
      setActiveModuleForConfig({
        moduleId: 'system_admin',
        moduleName: 'System Administration',
        isUserSpecific: false
      });
      return;
    }

    const m = module as PermissionModule;
    const status = getRoleModuleStatus(editingRole.permissions, m);
    const level = status === 'Disabled' ? 'DISABLED' : (status === 'Read-Only' ? 'READ_ONLY' : 'DECISION');

    setLocalAccessLevel(level);

    const scopeVal = m.scopeAllPermission ? editingRole.permissions.includes(m.scopeAllPermission) : false;
    setLocalScopeAll(scopeVal ? 'ALLOW' : 'DENY');

    const subOpts: Record<string, boolean> = {};
    m.readOnlyOptions.forEach(o => {
      subOpts[o.key] = editingRole.permissions.includes(o.key);
    });
    m.decisionOptions.forEach(o => {
      subOpts[o.key] = editingRole.permissions.includes(o.key);
    });

    setLocalSubOptions(subOpts);
    setActiveModuleForConfig({
      moduleId: m.id,
      moduleName: m.name,
      isUserSpecific: false
    });
  };

  const openUserModuleConfig = (user: StaffUser, module: PermissionModule | typeof SYSTEM_ADMIN_MODULE_STUB) => {
    const overrides = user.permissionOverrides || {};
    const role = roles.find(r => r.id === user.roleId);

    if (module.id === 'system_admin') {
      setActiveModuleForConfig({
        moduleId: 'system_admin',
        moduleName: 'System Administration',
        isUserSpecific: true
      });
      return;
    }

    const m = module as PermissionModule;
    const viewOverride = overrides[m.viewPermission];

    const decisionKeys = m.decisionOptions.map(o => o.key);
    const approveKey = decisionKeys[0];
    const approveOverride = overrides[approveKey];

    let level = 'INHERIT';
    if (viewOverride === false) {
      level = 'DISABLED';
    } else if (viewOverride === true) {
      if (approveOverride === false) {
        level = 'READ_ONLY';
      } else if (approveOverride === true) {
        level = 'DECISION';
      } else {
        level = 'DECISION';
      }
    }

    setLocalAccessLevel(level);

    let scopeVal = 'INHERIT';
    if (m.scopeAllPermission) {
      const scopeOverride = overrides[m.scopeAllPermission];
      if (scopeOverride === true) scopeVal = 'ALLOW';
      else if (scopeOverride === false) scopeVal = 'DENY';
    }
    setLocalScopeAll(scopeVal);

    const subOpts: Record<string, string> = {};
    const allOpts = [...m.readOnlyOptions, ...m.decisionOptions];
    allOpts.forEach(o => {
      const override = overrides[o.key];
      if (override === true) subOpts[o.key] = 'ALLOW';
      else if (override === false) subOpts[o.key] = 'DENY';
      else subOpts[o.key] = 'INHERIT';
    });

    setLocalSubOptions(subOpts);
    setActiveModuleForConfig({
      moduleId: m.id,
      moduleName: m.name,
      isUserSpecific: true
    });
  };

  const toggleAllowedPrefillField = (fieldId: string) => {
    if (activeModuleForConfig?.isUserSpecific) {
      if (!editingUserOverrides) return;
      const currentList = editingUserOverrides.allowedPrefillFieldIds || [];
      const newList = currentList.includes(fieldId)
        ? currentList.filter(id => id !== fieldId)
        : [...currentList, fieldId];
      setEditingUserOverrides({
        ...editingUserOverrides,
        allowedPrefillFieldIds: newList
      });
    } else {
      if (!editingRole) return;
      const currentList = editingRole.allowedPrefillFieldIds || [];
      const newList = currentList.includes(fieldId)
        ? currentList.filter(id => id !== fieldId)
        : [...currentList, fieldId];
      setEditingRole({
        ...editingRole,
        allowedPrefillFieldIds: newList
      });
    }
  };

  // Sub-modal Save Logics
  const saveRoleModuleConfig = () => {
    if (!editingRole || !activeModuleForConfig) return;
    const moduleId = activeModuleForConfig.moduleId;
    let newPermissions = [...editingRole.permissions];

    if (moduleId === 'system_admin') {
      SYSTEM_ADMIN_PERMISSIONS.forEach(p => {
        const isChecked = !!localSubOptions[p.key];
        const has = newPermissions.includes(p.key);
        if (isChecked && !has) newPermissions.push(p.key);
        else if (!isChecked && has) newPermissions = newPermissions.filter(k => k !== p.key);
      });
    } else {
      const m = PERMISSION_MODULES.find(mod => mod.id === moduleId);
      if (!m) return;

      const keysToRemove = [
        m.viewPermission,
        m.scopeAllPermission,
        ...m.readOnlyOptions.map(o => o.key),
        ...m.decisionOptions.map(o => o.key)
      ].filter(Boolean) as Permission[];

      newPermissions = newPermissions.filter(p => !keysToRemove.includes(p));

      if (localAccessLevel === 'READ_ONLY' || localAccessLevel === 'DECISION') {
        newPermissions.push(m.viewPermission);

        if (localScopeAll === 'ALLOW' && m.scopeAllPermission) {
          newPermissions.push(m.scopeAllPermission);
        }

        m.readOnlyOptions.forEach(o => {
          if (localSubOptions[o.key]) {
            newPermissions.push(o.key);
          }
        });

        if (localAccessLevel === 'DECISION') {
          m.decisionOptions.forEach(o => {
            if (localSubOptions[o.key]) {
              newPermissions.push(o.key);
            }
          });
        }
      }
    }

    setEditingRole({ ...editingRole, permissions: newPermissions });
    setActiveModuleForConfig(null);
  };

  const saveUserModuleConfig = () => {
    if (!editingUserOverrides || !activeModuleForConfig) return;
    const moduleId = activeModuleForConfig.moduleId;
    const overrides = { ...(editingUserOverrides.permissionOverrides || {}) };

    if (moduleId === 'system_admin') {
      onNotify("System Administration permissions cannot be overridden.", "warning");
      setActiveModuleForConfig(null);
      return;
    }

    const m = PERMISSION_MODULES.find(mod => mod.id === moduleId);
    if (!m) return;

    if (localAccessLevel === 'INHERIT') {
      delete overrides[m.viewPermission];
      m.readOnlyOptions.forEach(o => delete overrides[o.key]);
      m.decisionOptions.forEach(o => delete overrides[o.key]);
    } else if (localAccessLevel === 'DISABLED') {
      overrides[m.viewPermission] = false;
      m.readOnlyOptions.forEach(o => overrides[o.key] = false);
      m.decisionOptions.forEach(o => overrides[o.key] = false);
    } else if (localAccessLevel === 'READ_ONLY') {
      overrides[m.viewPermission] = true;
      m.decisionOptions.forEach(o => overrides[o.key] = false);
      m.readOnlyOptions.forEach(o => {
        const state = localSubOptions[o.key] || 'INHERIT';
        if (state === 'INHERIT') delete overrides[o.key];
        else overrides[o.key] = state === 'ALLOW';
      });
    } else if (localAccessLevel === 'DECISION') {
      overrides[m.viewPermission] = true;
      const allOpts = [...m.readOnlyOptions, ...m.decisionOptions];
      allOpts.forEach(o => {
        const state = localSubOptions[o.key] || 'INHERIT';
        if (state === 'INHERIT') delete overrides[o.key];
        else overrides[o.key] = state === 'ALLOW';
      });
    }

    if (m.scopeAllPermission) {
      if (localScopeAll === 'INHERIT') {
        delete overrides[m.scopeAllPermission];
      } else {
        overrides[m.scopeAllPermission] = localScopeAll === 'ALLOW';
      }
    }

    setEditingUserOverrides({ ...editingUserOverrides, permissionOverrides: overrides });
    setActiveModuleForConfig(null);
  };

  const saveUserOverrides = async () => {
    if (editingUserOverrides) {
      const updatedUser = editingUserOverrides;
      setStaffUsers(prev => prev.map(s => s.id === updatedUser.id ? updatedUser : s));
      try {
        await setDoc(doc(db, 'staff_accounts', updatedUser.id), {
          permissionOverrides: updatedUser.permissionOverrides || {}
        }, { merge: true });
        onNotify(`Permission overrides updated for ${updatedUser.name} and saved to server.`, 'success');
        if (logAction) logAction('UPDATE', 'STAFF', `Updated permission overrides for staff account: ${updatedUser.name}`);
      } catch (err: any) {
        console.error("Failed to save user overrides:", err);
        onNotify("Failed to save user overrides to server: " + (err.message || 'Unknown error'), 'error');
      }
      setEditingUserOverrides(null);
    }
  };

  // User tab filtering logic
  const filteredUsers = staffUsers.filter(user => {
    // Completely hide Super Admins from overrides management list
    if (user.roleId === 'role-super-admin' || user.id === 'super-admin' || user.username.toLowerCase() === 'superadmin') {
      return false;
    }
    const queryMatch = 
      user.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      user.username.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(userSearchQuery.toLowerCase());
    const roleMatch = userRoleFilter === 'ALL' || user.roleId === userRoleFilter;
    return queryMatch && roleMatch;
  });

  // Pill rendering for User Overrides configuration
  const renderOverridePills = (permKey: Permission, inheritedActive: boolean) => {
    const currentState = localSubOptions[permKey] || 'INHERIT';

    return (
      <div className="flex bg-gray-100 rounded-lg p-0.5 border border-gray-200">
        <button
          type="button"
          onClick={() => setLocalSubOptions(prev => ({ ...prev, [permKey]: 'INHERIT' }))}
          className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${
            currentState === 'INHERIT' 
              ? 'bg-white text-gray-700 shadow-sm' 
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          Inherit ({inheritedActive ? 'Yes' : 'No'})
        </button>
        <button
          type="button"
          onClick={() => setLocalSubOptions(prev => ({ ...prev, [permKey]: 'ALLOW' }))}
          className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${
            currentState === 'ALLOW' 
              ? 'bg-green-500 text-white shadow-sm' 
              : 'text-gray-450 hover:text-green-600'
          }`}
        >
          Allow
        </button>
        <button
          type="button"
          onClick={() => setLocalSubOptions(prev => ({ ...prev, [permKey]: 'DENY' }))}
          className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${
            currentState === 'DENY' 
              ? 'bg-red-500 text-white shadow-sm' 
              : 'text-gray-450 hover:text-red-650'
          }`}
        >
          Deny
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Tab toggle */}
      <div className="flex space-x-4 mb-6 border-b border-gray-200 pb-2">
        <button
          onClick={() => setTopLevelTab('roles')}
          className={`flex items-center space-x-2 px-4 py-2 border-b-2 font-bold text-sm tracking-wider transition-colors ${
            topLevelTab === 'roles'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <Shield size={18} />
          <span>Role Default Permissions</span>
        </button>
        <button
          onClick={() => setTopLevelTab('users')}
          className={`flex items-center space-x-2 px-4 py-2 border-b-2 font-bold text-sm tracking-wider transition-colors ${
            topLevelTab === 'users'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <Users size={18} />
          <span>User Specific Permissions</span>
        </button>
      </div>

      {/* ROLES TAB */}
      {topLevelTab === 'roles' && (
        <>
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
            <h3 className="text-lg font-semibold mb-4 flex items-center text-blue-800">
              <Plus size={20} className="mr-2" /> Create New Staff Role
            </h3>
            <div className="flex space-x-3">
              <Input
                value={newRoleName}
                onChange={e => setNewRoleName(e.target.value)}
                placeholder="e.g. HR Recruiter, Site Lead"
                className="max-w-md"
                onKeyPress={e => e.key === 'Enter' && addRole()}
              />
              <Button onClick={addRole} variant="primary">Add Role</Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.filter(role => role.id !== 'role-super-admin' && role.name.toLowerCase() !== 'super admin' && role.name.toLowerCase() !== 'superadmin').map(role => (
              <div
                key={role.id}
                className={`group relative p-5 rounded-lg shadow-sm border flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:shadow-md active:scale-[0.98] ${
                  role.isDisabled ? 'bg-gray-50 border-gray-200 grayscale' : 'bg-white border-gray-200 hover:border-blue-300'
                }`}
                onClick={() => handleEditRole(role)}
              >
                <div className={`p-3 rounded-full mb-3 transition-colors ${
                  role.isDisabled ? 'bg-gray-100 text-gray-400' : 'bg-blue-50 text-blue-600 group-hover:bg-blue-100'
                }`}>
                  <Shield size={24} />
                </div>
                <h4 className={`text-lg font-bold ${role.isDisabled ? 'text-gray-400 line-through' : 'text-gray-800 group-hover:text-blue-700'}`}>
                  {role.name}
                </h4>
                <div className="flex items-center space-x-2 mt-1">
                  <p className="text-[10px] text-gray-400 uppercase tracking-tighter">{role.permissions.length} Permissions Active</p>
                  {role.isDisabled && <span className="text-[9px] bg-red-100 text-red-600 px-1 rounded font-bold uppercase">Suspended</span>}
                </div>

                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleRoleStatus(role.id); }}
                    className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-md transition-colors"
                    title={role.isDisabled ? 'Enable Role' : 'Disable Role'}
                  >
                    {role.isDisabled ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); initiateDelete(role.id); }}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                    title="Delete Role"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className={`mt-4 flex items-center text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity ${role.isDisabled ? 'text-gray-400' : 'text-blue-600'}`}>
                  Manage Access <ChevronRight size={14} className="ml-1" />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* USER SPECIFIC OVERRIDES TAB */}
      {topLevelTab === 'users' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-grow max-w-md">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
              <input
                type="text"
                value={userSearchQuery}
                onChange={e => setUserSearchQuery(e.target.value)}
                placeholder="Search staff by name, email, or username..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md w-full focus:ring-blue-500 focus:border-blue-500 text-sm outline-none"
              />
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-gray-500 uppercase">Role Filter:</span>
              <select
                value={userRoleFilter}
                onChange={e => setUserRoleFilter(e.target.value)}
                className="border border-gray-300 rounded-md text-sm p-2 bg-white outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="ALL">All Roles</option>
                {roles.filter(role => role.id !== 'role-super-admin' && role.name.toLowerCase() !== 'super admin' && role.name.toLowerCase() !== 'superadmin').map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUsers.length === 0 ? (
              <div className="col-span-full text-center py-10 bg-white border border-gray-200 rounded-lg text-gray-400 italic text-sm">
                No matching staff accounts found.
              </div>
            ) : (
              filteredUsers.map(user => {
                const roleObj = roles.find(r => r.id === user.roleId);
                const overridesCount = Object.keys(user.permissionOverrides || {}).length;

                return (
                  <div
                    key={user.id}
                    onClick={() => { setEditingUserOverrides(user); setActiveCategory('requests'); }}
                    className="bg-white p-5 rounded-lg border border-gray-200 hover:border-blue-400 shadow-sm hover:shadow cursor-pointer transition-all flex items-start space-x-4"
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm uppercase flex-shrink-0 ${
                      user.isDisabled ? 'bg-gray-100 text-gray-400' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {user.name.charAt(0)}
                    </div>
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-gray-800 truncate text-sm">{user.name}</h4>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-tight ${
                          user.isDisabled ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {user.isDisabled ? 'Disabled' : 'Active'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">@{user.username}</p>
                      <p className="text-xs text-gray-400 truncate">{user.email}</p>
                      
                      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-2 text-[10px]">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-semibold">
                          {roleObj?.name || 'No Assigned Role'}
                        </span>
                        <span className={`font-bold uppercase ${
                          overridesCount > 0 ? 'text-blue-600' : 'text-gray-400'
                        }`}>
                          {overridesCount} Custom Overrides
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ROLE EDITOR MODAL */}
      {isEditModalOpen && editingRole && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => { setIsEditModalOpen(false); setEditingRole(null); }}
          title={`Edit Role: ${editingRole.name}`}
          size="lg"
          footer={
            <>
              <Button variant="secondary" onClick={() => { setIsEditModalOpen(false); setEditingRole(null); }} className="mr-2">Cancel</Button>
              <Button variant="primary" onClick={saveRoleEdit}>Save Changes</Button>
            </>
          }
        >
          <div className="space-y-6 overflow-y-auto max-h-[70vh] pr-2">
            <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div>
                <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">Role</span>
                <span className="text-sm font-bold text-gray-900">{editingRole.name}</span>
              </div>
              <span className="text-xs font-mono text-gray-500 bg-white px-2.5 py-1 rounded border border-gray-200">
                {editingRole.id}
              </span>
            </div>

            <div className="space-y-6">
              <p className="text-[11px] text-gray-500 italic">
                Configure access levels for each module. Click a card below to adjust specific read/write and decision privileges.
              </p>

              {/* Category Group Tabs */}
              <div className="flex flex-wrap gap-1.5 p-1 bg-gray-50 border border-gray-200 rounded-lg">
                {[
                  { id: 'requests', label: 'Employee Requests', count: PERMISSION_MODULES.filter(m => m.groupId === 'requests').length },
                  { id: 'personnel', label: 'Personnel Directory', count: PERMISSION_MODULES.filter(m => m.groupId === 'personnel').length },
                  { id: 'sites', label: 'Recruitment & Sites', count: PERMISSION_MODULES.filter(m => m.groupId === 'sites').length },
                  { id: 'system', label: 'System Configuration', count: 1 }
                ].map(cat => {
                  const isActive = activeCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setActiveCategory(cat.id as any)}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center space-x-1.5 ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <span>{cat.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        isActive ? 'bg-blue-700 text-blue-100' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {cat.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {PERMISSION_MODULES.filter(m => m.groupId === activeCategory).map(module => {
                  const status = getRoleModuleStatus(editingRole.permissions, module);
                  const isScopeAll = module.scopeAllPermission && editingRole.permissions.includes(module.scopeAllPermission);
                  
                  return (
                    <div 
                      key={module.id} 
                      onClick={() => openRoleModuleConfig(module)}
                      className="p-4 rounded-xl border border-gray-200 hover:border-blue-400 bg-white shadow-sm hover:shadow transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-bold text-gray-800 text-sm">{module.name}</h5>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            status === 'Disabled' ? 'bg-red-50 text-red-600 border border-red-100' :
                            status === 'Read-Only' ? 'bg-green-50 text-green-600 border border-green-100' :
                            'bg-blue-50 text-blue-600 border border-blue-100'
                          }`}>
                            {status}
                          </span>
                        </div>
                        <p className="text-gray-500 text-xs line-clamp-2">{module.description}</p>
                      </div>
                      <div className="mt-4 pt-2 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400 font-semibold uppercase">
                        <span>{isScopeAll ? 'Company-wide (All Sites)' : 'Restricted (Assigned Sites Only)'}</span>
                        <span className="text-blue-600 flex items-center">Configure <ChevronRight size={12} className="ml-0.5" /></span>
                      </div>
                    </div>
                  );
                })}

                {activeCategory === 'system' && (
                  <div 
                    onClick={() => openRoleModuleConfig(SYSTEM_ADMIN_MODULE_STUB)}
                    className="p-4 rounded-xl border border-red-100 hover:border-red-400 bg-red-50/10 shadow-sm hover:shadow transition-all cursor-pointer flex flex-col justify-between col-span-full"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-bold text-red-800 text-sm flex items-center">
                          <Lock size={14} className="mr-1.5 text-red-600" /> System Administration
                        </h5>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-100 text-red-800">
                          Admin Tier
                        </span>
                      </div>
                      <p className="text-gray-500 text-xs line-clamp-2">Manage global options, client ID libraries, form builder questions, workflows levels, and audit logs.</p>
                    </div>
                    <div className="mt-4 pt-2 border-t border-gray-150 flex items-center justify-between text-[10px] text-red-650 font-semibold uppercase">
                      <span>Reserved for Super Admins</span>
                      <span className="text-red-700 flex items-center">Configure <ChevronRight size={12} className="ml-0.5" /></span>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        </Modal>
      )}

      {/* USER OVERRIDES MODAL */}
      {editingUserOverrides && (
        <Modal
          isOpen={!!editingUserOverrides}
          onClose={() => setEditingUserOverrides(null)}
          title={`Configure Custom Overrides: ${editingUserOverrides.name}`}
          size="lg"
          footer={
            <>
              <Button variant="primary" onClick={saveUserOverrides}>Save Overrides</Button>
              <Button variant="secondary" onClick={() => setEditingUserOverrides(null)} className="mr-2">Cancel</Button>
              <div className="flex-1 sm:flex sm:justify-start">
                <Button 
                  variant="danger" 
                  onClick={() => {
                    if (window.confirm(`Are you sure you want to reset all overrides for ${editingUserOverrides.name} back to role-based defaults?`)) {
                      setEditingUserOverrides({ ...editingUserOverrides, permissionOverrides: {} });
                      onNotify(`All custom overrides cleared. Click "Save Overrides" to save changes.`, 'info');
                    }
                  }} 
                  className="w-full sm:w-auto border border-red-300 text-red-700 hover:bg-red-50"
                >
                  Reset to Default
                </Button>
              </div>
            </>
          }
        >
          <div className="space-y-6 overflow-y-auto max-h-[70vh] pr-2">
            <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 flex flex-wrap gap-4 text-xs">
              <div>
                <span className="font-bold text-gray-500 uppercase block">Staff User</span>
                <span className="font-bold text-gray-800 text-sm block">{editingUserOverrides.name}</span>
              </div>
              <div>
                <span className="font-bold text-gray-500 uppercase block">Base Role</span>
                <span className="font-bold text-blue-800 block">
                  {roles.find(r => r.id === editingUserOverrides.roleId)?.name || 'No Role'}
                </span>
              </div>
              <div>
                <span className="font-bold text-gray-500 uppercase block">Email Address</span>
                <span className="text-gray-700 block">{editingUserOverrides.email}</span>
              </div>
            </div>

            <p className="text-[11px] text-gray-500 italic">
              User specific overrides take precedence over the base role default permissions. Click any module card to set explicit ALLOW or DENY overrides.
            </p>

            {/* Category Group Tabs */}
            <div className="flex flex-wrap gap-1.5 p-1 bg-gray-50 border border-gray-200 rounded-lg">
              {[
                { id: 'requests', label: 'Employee Requests', count: PERMISSION_MODULES.filter(m => m.groupId === 'requests').length },
                { id: 'personnel', label: 'Personnel Directory', count: PERMISSION_MODULES.filter(m => m.groupId === 'personnel').length },
                { id: 'sites', label: 'Recruitment & Sites', count: PERMISSION_MODULES.filter(m => m.groupId === 'sites').length },
                { id: 'system', label: 'System Configuration', count: 1 }
              ].map(cat => {
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id as any)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center space-x-1.5 ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span>{cat.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isActive ? 'bg-blue-700 text-blue-100' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {cat.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {PERMISSION_MODULES.filter(m => m.groupId === activeCategory).map(module => {
                const status = getUserModuleStatus(
                  editingUserOverrides, 
                  roles.find(r => r.id === editingUserOverrides.roleId), 
                  module
                );
                const isCustom = status.includes('Custom') || status.includes('Forced');

                return (
                  <div 
                    key={module.id} 
                    onClick={() => openUserModuleConfig(editingUserOverrides, module)}
                    className={`p-4 rounded-xl border hover:border-blue-400 bg-white shadow-sm hover:shadow transition-all cursor-pointer flex flex-col justify-between ${
                      isCustom ? 'border-blue-300 ring-1 ring-blue-100 shadow-blue-50' : 'border-gray-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-bold text-gray-800 text-sm">{module.name}</h5>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          isCustom 
                            ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                            : 'bg-gray-100 text-gray-650 border border-gray-200'
                        }`}>
                          {status}
                        </span>
                      </div>
                      <p className="text-gray-500 text-xs line-clamp-2">{module.description}</p>
                    </div>
                    <div className="mt-4 pt-2 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400 font-semibold uppercase">
                      <span>Overrides Config</span>
                      <span className="text-blue-600 flex items-center">Configure Overrides <ChevronRight size={12} className="ml-0.5" /></span>
                    </div>
                  </div>
                );
              })}

              {activeCategory === 'system' && (
                <div 
                  onClick={() => openUserModuleConfig(editingUserOverrides, SYSTEM_ADMIN_MODULE_STUB)}
                  className="p-4 rounded-xl border border-gray-200 opacity-60 bg-gray-50 flex flex-col justify-between cursor-not-allowed col-span-full"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-bold text-gray-600 text-sm flex items-center">
                        <Lock size={14} className="mr-1.5" /> System Administration
                      </h5>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-200 text-gray-600">
                        Locked
                      </span>
                    </div>
                    <p className="text-gray-500 text-xs line-clamp-2">System administration settings are locked to the base role default and cannot be overridden individually.</p>
                  </div>
                  <div className="mt-4 pt-2 border-t border-gray-200 flex items-center justify-between text-[10px] text-gray-400 font-semibold uppercase">
                    <span>No overrides allowed</span>
                    <span>Inherited Only</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* POPUP SUB-MODAL FOR MODULE PERMISSIONS */}
      {activeModuleForConfig && (
        <Modal
          isOpen={!!activeModuleForConfig}
          onClose={() => setActiveModuleForConfig(null)}
          title={`Configure permissions: ${activeModuleForConfig.moduleName}`}
          size={
            (!activeModuleForConfig.isUserSpecific && (activeModuleForConfig.moduleId === 'onboarding' || activeModuleForConfig.moduleId === 'personnel'))
              ? 'lg'
              : 'md'
          }
          footer={
            <>
              <Button variant="secondary" onClick={() => setActiveModuleForConfig(null)} className="mr-2">Cancel</Button>
              <Button variant="primary" onClick={activeModuleForConfig.isUserSpecific ? saveUserModuleConfig : saveRoleModuleConfig}>Apply Changes</Button>
            </>
          }
        >
          <div className="space-y-5">
            {activeModuleForConfig.moduleId === 'system_admin' ? (
              // SYSTEM ADMIN CONFIG
              <div className="space-y-4">
                <div className="bg-red-50 p-4 rounded-lg border border-red-100 flex items-start space-x-3">
                  <Lock className="text-red-500 mt-0.5 flex-shrink-0" size={18} />
                  <div>
                    <h4 className="font-bold text-red-800 text-xs uppercase">Highly Sensitive Controls</h4>
                    <p className="text-red-700 text-xs mt-1">
                      System Administration configurations grant global root access. Toggle specific defaults below.
                    </p>
                  </div>
                </div>

                {activeModuleForConfig.isUserSpecific ? (
                  // User system overrides (Read-only display)
                  <div className="space-y-2">
                    <p className="text-xs text-gray-400 italic">User specific overrides are not allowed for this admin level module.</p>
                    {editingUserOverrides && (() => {
                      const roleObj = roles.find(r => r.id === editingUserOverrides.roleId);
                      return SYSTEM_ADMIN_PERMISSIONS.map(p => {
                        const has = roleObj?.permissions.includes(p.key) || false;
                        return (
                          <div key={p.key} className="flex items-center justify-between p-2.5 bg-gray-50 rounded border border-gray-100 text-xs">
                            <div>
                              <span className="font-bold text-gray-700">{p.label}</span>
                              <p className="text-gray-400 text-[10px]">{p.explanation}</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                              has ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
                            }`}>
                              {has ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                ) : (
                  // Role default check toggles
                  <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                    {SYSTEM_ADMIN_PERMISSIONS.map(p => (
                      <label key={p.key} className="flex items-start space-x-3 p-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!localSubOptions[p.key]}
                          onChange={(e) => setLocalSubOptions(prev => ({ ...prev, [p.key]: e.target.checked }))}
                          className="rounded text-blue-600 focus:ring-blue-500 mt-0.5"
                        />
                        <div>
                          <span className="font-bold text-gray-800 text-xs uppercase block">{p.label}</span>
                          <span className="text-gray-500 text-[10px] leading-tight block">{p.explanation}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              // OPERATIONAL MODULES CONFIG (Onboarding, Leaves, Resignations, Updates, Personnel, Sites)
              (() => {
                const m = PERMISSION_MODULES.find(mod => mod.id === activeModuleForConfig.moduleId);
                if (!m) return null;

                const userRoleObj = activeModuleForConfig.isUserSpecific && editingUserOverrides 
                  ? roles.find(r => r.id === editingUserOverrides.roleId) 
                  : null;

                return (
                  <div className="space-y-5">
                    {/* Access Level Selector */}
                    <div>
                      <span className="text-xs font-bold text-gray-500 uppercase block mb-2">Module Access Level:</span>
                      {activeModuleForConfig.isUserSpecific ? (
                        // 3-state Level Override for User Specifics
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { value: 'INHERIT', label: 'Inherit Default' },
                            { value: 'DISABLED', label: 'Force Disabled' },
                            { value: 'READ_ONLY', label: 'Force Read-Only' },
                            { value: 'DECISION', label: 'Force Decision-Making' }
                          ].map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setLocalAccessLevel(opt.value)}
                              className={`p-2.5 rounded-lg border text-xs font-bold text-center transition-all ${
                                localAccessLevel === opt.value
                                  ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                                  : 'bg-white border-gray-200 text-gray-650 hover:bg-gray-55'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      ) : (
                        // Default Level Selector for Roles
                        <div className="flex space-x-2">
                          {[
                            { value: 'DISABLED', label: 'Disabled' },
                            { value: 'READ_ONLY', label: 'Read-Only' },
                            { value: 'DECISION', label: 'Decision-Making' }
                          ].map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setLocalAccessLevel(opt.value)}
                              className={`flex-1 p-2.5 rounded-lg border text-xs font-bold text-center transition-all ${
                                localAccessLevel === opt.value
                                  ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                                  : 'bg-white border-gray-200 text-gray-650 hover:bg-gray-55'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Scope Filter All Locations */}
                    {m.scopeAllPermission && localAccessLevel !== 'DISABLED' && (
                      <div className="bg-slate-50 p-3 rounded-lg border border-gray-200 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-gray-800 text-xs">Global Location Scope</span>
                          <p className="text-[10px] text-gray-500">Access files/records across all sites company-wide.</p>
                        </div>
                        {activeModuleForConfig.isUserSpecific ? (
                          renderOverridePills(
                            m.scopeAllPermission, 
                            userRoleObj?.permissions.includes(m.scopeAllPermission) || false
                          )
                        ) : (
                          <input
                            type="checkbox"
                            checked={localScopeAll === 'ALLOW'}
                            onChange={(e) => setLocalScopeAll(e.target.checked ? 'ALLOW' : 'DENY')}
                            className="rounded text-blue-600 focus:ring-blue-500 h-5 w-5 cursor-pointer"
                          />
                        )}
                      </div>
                    )}

                    {/* Sub-options List */}
                    {localAccessLevel !== 'DISABLED' && (
                      <div className="space-y-3">
                        <span className="text-xs font-bold text-gray-500 uppercase block mb-1">
                          Granular Sub-options Checklists:
                        </span>

                        <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                          {/* Read Only options */}
                          {m.readOnlyOptions.map(o => {
                            const isInheritedActive = userRoleObj?.permissions.includes(o.key) || false;

                            return (
                              <div key={o.key} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors">
                                <div className="max-w-[60%]">
                                  <span className="font-bold text-gray-800 text-xs block">{o.label}</span>
                                  <span className="text-gray-500 text-[9px] leading-tight block">{o.explanation}</span>
                                </div>
                                {activeModuleForConfig.isUserSpecific ? (
                                  renderOverridePills(o.key, isInheritedActive)
                                ) : (
                                  <input
                                    type="checkbox"
                                    checked={!!localSubOptions[o.key]}
                                    onChange={(e) => setLocalSubOptions(prev => ({ ...prev, [o.key]: e.target.checked }))}
                                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                                  />
                                )}
                              </div>
                            );
                          })}

                          {/* Decision options - only visible under decision making selection */}
                          {(localAccessLevel === 'DECISION' || localAccessLevel === 'INHERIT') && m.decisionOptions.map(o => {
                            const isInheritedActive = userRoleObj?.permissions.includes(o.key) || false;

                            return (
                              <div key={o.key} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors">
                                <div className="max-w-[60%]">
                                  <span className="font-bold text-blue-900 text-xs block flex items-center">
                                    <Sliders size={12} className="mr-1 text-blue-500" /> {o.label}
                                  </span>
                                  <span className="text-gray-500 text-[9px] leading-tight block">{o.explanation}</span>
                                </div>
                                {activeModuleForConfig.isUserSpecific ? (
                                  renderOverridePills(o.key, isInheritedActive)
                                ) : (
                                  <input
                                    type="checkbox"
                                    checked={!!localSubOptions[o.key]}
                                    onChange={(e) => setLocalSubOptions(prev => ({ ...prev, [o.key]: e.target.checked }))}
                                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Field-level privacy checklists */}
                    {!activeModuleForConfig.isUserSpecific && (activeModuleForConfig.moduleId === 'onboarding' || activeModuleForConfig.moduleId === 'personnel') && (
                      <div className="mt-6 pt-6 border-t border-gray-200 space-y-4">
                        <div className="flex items-center space-x-2">
                          <Shield size={18} className="text-purple-600" />
                          <h4 className="text-xs font-black text-purple-800 uppercase tracking-wider">
                            {activeModuleForConfig.moduleId === 'onboarding'
                              ? 'Field-Level Privacy Rules for Onboarding Reviews'
                              : 'Field-Level Privacy Rules for Personnel Directory'
                            }
                          </h4>
                        </div>
                        <p className="text-[11px] text-gray-500 italic">
                          {activeModuleForConfig.moduleId === 'onboarding'
                            ? 'Configure which fields this role can see when reviewing new onboarding requests (Candidate reviews modal).'
                            : 'Configure which fields this role can see or edit in the Master Employee Directory/Profiles.'
                          }
                        </p>

                        <div className="space-y-4 max-h-[35vh] overflow-y-auto pr-1">
                          {formSections.filter(s => s && s.fields && s.fields.length > 0).map(section => (
                            <div key={section.id} className="bg-purple-50/25 p-3 rounded-md border border-purple-100">
                              <p className="text-[10px] font-bold text-purple-800 uppercase mb-2 tracking-wider">{section.name}</p>
                              <div className="space-y-2">
                                {(section.fields || []).map(field => {
                                  const currentVisibilityMap = activeModuleForConfig.moduleId === 'onboarding'
                                    ? (editingRole.onboardingFieldVisibility || {})
                                    : (editingRole.fieldVisibility || {});
                                  const currentState = currentVisibilityMap[field.id] || 'VISIBLE';
                                  const isVisible = !currentVisibilityMap[field.id] || currentVisibilityMap[field.id] === 'VISIBLE';
                                  const isReadOnly = currentState === 'READ_ONLY';
                                  const isHidden = currentState === 'HIDDEN';

                                  return (
                                    <div key={field.id} className="flex items-center justify-between bg-white p-2 rounded border border-gray-150">
                                      <span className="text-xs font-medium text-gray-700 truncate flex-1 mr-2" title={field.label}>{field.label}</span>
                                      <div className="flex bg-gray-50 rounded-md p-0.5 border border-gray-200">
                                        <button
                                          type="button"
                                          onClick={() => toggleFieldPrivacyForScope(field.id, 'VISIBLE', activeModuleForConfig.moduleId === 'onboarding' ? 'ONBOARDING' : 'DIRECTORY')}
                                          className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${isVisible ? 'bg-green-500 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                          title="Visible & Editable"
                                        >
                                          Visible
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => toggleFieldPrivacyForScope(field.id, 'READ_ONLY', activeModuleForConfig.moduleId === 'onboarding' ? 'ONBOARDING' : 'DIRECTORY')}
                                          className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${isReadOnly ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                          title="Visible but Read-Only"
                                        >
                                          Read-Only
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => toggleFieldPrivacyForScope(field.id, 'HIDDEN', activeModuleForConfig.moduleId === 'onboarding' ? 'ONBOARDING' : 'DIRECTORY')}
                                          className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${isHidden ? 'bg-red-50 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                          title="Completely Hidden"
                                        >
                                          Hidden
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeModuleForConfig.moduleId === 'recruitment_invites' && (
                      <div className="mt-6 pt-6 border-t border-gray-200 space-y-4">
                        <div className="flex items-center space-x-2">
                          <Sliders size={18} className="text-emerald-600" />
                          <h4 className="text-xs font-black text-emerald-800 uppercase tracking-wider">
                            Allowed Prefill Form Questions
                          </h4>
                        </div>
                        <p className="text-[11px] text-gray-500 italic">
                          Select which onboarding fields this {activeModuleForConfig.isUserSpecific ? 'staff user' : 'role'} is permitted to pre-fill when generating onboarding invitation links.
                        </p>

                        <div className="space-y-4 max-h-[35vh] overflow-y-auto pr-1">
                          {formSections.filter(s => s && s.fields && s.fields.length > 0).map(section => (
                            <div key={section.id} className="bg-emerald-50/20 p-3 rounded-md border border-emerald-100/50">
                              <p className="text-[10px] font-bold text-emerald-800 uppercase mb-2 tracking-wider">{section.name}</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {(section.fields || []).filter(f => f.type !== 'Section Header' && f.type !== 'Information Text' && f.id !== 'siteName').map(field => {
                                  const allowedList = activeModuleForConfig.isUserSpecific
                                    ? (editingUserOverrides?.allowedPrefillFieldIds || [])
                                    : (editingRole?.allowedPrefillFieldIds || []);
                                  const isChecked = allowedList.includes(field.id);

                                  return (
                                    <label
                                      key={field.id}
                                      className={`flex items-center space-x-3 p-2.5 rounded-lg border cursor-pointer transition-all ${
                                        isChecked ? 'bg-white border-emerald-300 shadow-sm' : 'bg-white border-gray-150 hover:bg-gray-55'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => toggleAllowedPrefillField(field.id)}
                                        className="h-4 w-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                                      />
                                      <span className="text-xs font-bold text-gray-650 truncate" title={field.label}>
                                        {field.label}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()
            )}
          </div>
        </Modal>
      )}

      {/* Confirmation Modal */}
      {isConfirmModalOpen && (
        <Modal
          isOpen={isConfirmModalOpen}
          onClose={() => { setIsConfirmModalOpen(false); setRoleToDelete(null); }}
          title="Delete Role"
          footer={
            <>
              <Button variant="secondary" onClick={() => { setIsConfirmModalOpen(false); setRoleToDelete(null); }} className="mr-2">Cancel</Button>
              <Button variant="danger" onClick={confirmDelete}>Delete Role</Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-red-100 text-red-600 rounded-full mt-0.5">
                <AlertTriangle size={20} />
              </div>
              <div>
                <p className="text-gray-900 font-bold">Hard Deletion Warning</p>
                <p className="text-gray-600 text-sm mt-1">
                  Are you sure you want to permanently delete this role? This cannot be undone. Any defaults and field privacy rules configured for this role will be purged.
                </p>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AdminRoleManagementPage;

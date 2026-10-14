

export enum FieldType {
  TEXT = 'Text Input',
  TEXTAREA = 'Text Area',
  DROPDOWN = 'Dropdown Select',
  DATE = 'Date Picker',
  CHECKBOX = 'Checkbox (multiple choices)',
  RADIO = 'Radio Buttons',
  FILE_UPLOAD = 'File Upload',
  HEADER = 'Section Header',
  INFO_TEXT = 'Information Text',
}

export interface FormField {
  id: string;
  label: string;
  type: FieldType;
  order: number;
  isMandatory: boolean;
  options?: string[];
  isDisabled?: boolean;
  // Specific Validation Settings
  minLength?: number;
  maxLength?: number;
  allowedPattern?: 'alphabets' | 'numbers' | 'alphanumeric' | 'any' | 'alphanumeric_special';
  allowedFileTypes?: string; // e.g. .pdf,.jpg,.png
  maxFileSizeMB?: number;
  minAge?: number;
  visibilityCondition?: {
    fieldId: string;
    operator: 'equals' | 'not_equals' | 'contains';
    value: any;
  };
  // Dependent Options (e.g. Filtered by another field)
  optionsMap?: Record<string, string[]>;
  parentFieldId?: string;
}

export interface FormSection {
  id: string;
  name: string;
  order: number;
  fields: FormField[];
  isDisabled?: boolean;
}

export interface FieldEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (fieldData: Omit<FormField, 'id' | 'order'> | FormField) => void;
  existingField?: FormField;
  sectionId: string;
  availableFields: FormField[];
  roles: Role[];
  sites: Site[];
}

export interface EmployeeFieldProps {
  field: FormField;
  value: any;
  onChange: (fieldId: string, value: any) => void;
  error?: string;
  disabled?: boolean;
  /** Optional map from option value to display label (e.g. siteId → siteName). */
  optionLabels?: Record<string, string>;
}

// --- RBAC & Workflow Types ---

export enum Permission {
  // Tier 1: System Admin (Super Admin-Only / Core System Config)
  MANAGE_SYSTEM = 'MANAGE_SYSTEM', 
  MANAGE_FORMS = 'MANAGE_FORMS',
  MANAGE_ROLES = 'MANAGE_ROLES',
  MANAGE_STAFF = 'MANAGE_STAFF', 
  MANAGE_WORKFLOWS = 'MANAGE_WORKFLOWS', 
  DELETE_EMPLOYEE = 'DELETE_EMPLOYEE',
  DELETE_SUBMISSION = 'DELETE_SUBMISSION', 
  VIEW_AUDIT_LOGS = 'VIEW_AUDIT_LOGS',

  // Tier 2: Granular Onboarding Submissions (New Joiners)
  SUBMISSIONS_VIEW = 'SUBMISSIONS_VIEW',
  SUBMISSIONS_VIEW_SCOPE_ALL = 'SUBMISSIONS_VIEW_SCOPE_ALL',
  SUBMISSIONS_PREVIEW_DOCS = 'SUBMISSIONS_PREVIEW_DOCS',
  SUBMISSIONS_APPROVE = 'SUBMISSIONS_APPROVE',
  SUBMISSIONS_REJECT = 'SUBMISSIONS_REJECT',
  SUBMISSIONS_ADD_COMMENTS = 'SUBMISSIONS_ADD_COMMENTS',
  SUBMISSIONS_EDIT_COMMENTS = 'SUBMISSIONS_EDIT_COMMENTS',
  SUBMISSIONS_REVERT_DECISION = 'SUBMISSIONS_REVERT_DECISION',
  SUBMISSIONS_CREATE_CORRECTION_LINK = 'SUBMISSIONS_CREATE_CORRECTION_LINK',
  SUBMISSIONS_VIEW_DRAFTS = 'SUBMISSIONS_VIEW_DRAFTS',
  SUBMISSIONS_VIEW_CORRECTION_LINKS = 'SUBMISSIONS_VIEW_CORRECTION_LINKS',
  SUBMISSIONS_PRINT_BIODATA = 'SUBMISSIONS_PRINT_BIODATA',
  SUBMISSIONS_ASSIGN_EMPLOYEE_ID = 'SUBMISSIONS_ASSIGN_EMPLOYEE_ID',

  // Tier 3: Granular Leaves
  LEAVES_VIEW = 'LEAVES_VIEW',
  LEAVES_VIEW_SCOPE_ALL = 'LEAVES_VIEW_SCOPE_ALL',
  LEAVES_APPROVE = 'LEAVES_APPROVE',
  LEAVES_REJECT = 'LEAVES_REJECT',
  LEAVES_ADD_COMMENTS = 'LEAVES_ADD_COMMENTS',
  LEAVES_EDIT_COMMENTS = 'LEAVES_EDIT_COMMENTS',
  LEAVES_REVERT_DECISION = 'LEAVES_REVERT_DECISION',
  LEAVES_DELETE = 'LEAVES_DELETE',
  LEAVES_MANAGE_BALANCES = 'LEAVES_MANAGE_BALANCES',

  // Tier 4: Granular Account Updates
  ACCOUNT_UPDATES_VIEW = 'ACCOUNT_UPDATES_VIEW',
  ACCOUNT_UPDATES_VIEW_SCOPE_ALL = 'ACCOUNT_UPDATES_VIEW_SCOPE_ALL',
  ACCOUNT_UPDATES_APPROVE = 'ACCOUNT_UPDATES_APPROVE',
  ACCOUNT_UPDATES_REJECT = 'ACCOUNT_UPDATES_REJECT',
  ACCOUNT_UPDATES_ADD_COMMENTS = 'ACCOUNT_UPDATES_ADD_COMMENTS',
  ACCOUNT_UPDATES_EDIT_COMMENTS = 'ACCOUNT_UPDATES_EDIT_COMMENTS',
  ACCOUNT_UPDATES_REVERT_DECISION = 'ACCOUNT_UPDATES_REVERT_DECISION',
  ACCOUNT_UPDATES_DELETE = 'ACCOUNT_UPDATES_DELETE',

  // Tier 5: Granular Resignations
  RESIGNATIONS_VIEW = 'RESIGNATIONS_VIEW',
  RESIGNATIONS_VIEW_SCOPE_ALL = 'RESIGNATIONS_VIEW_SCOPE_ALL',
  RESIGNATIONS_APPROVE = 'RESIGNATIONS_APPROVE',
  RESIGNATIONS_REJECT = 'RESIGNATIONS_REJECT',
  RESIGNATIONS_ADD_COMMENTS = 'RESIGNATIONS_ADD_COMMENTS',
  RESIGNATIONS_EDIT_COMMENTS = 'RESIGNATIONS_EDIT_COMMENTS',
  RESIGNATIONS_REVERT_DECISION = 'RESIGNATIONS_REVERT_DECISION',
  RESIGNATIONS_DELETE = 'RESIGNATIONS_DELETE',

  // Tier 6: Granular Personnel / Master Employee List
  EMPLOYEES_VIEW = 'EMPLOYEES_VIEW',
  EMPLOYEES_VIEW_SCOPE_ALL = 'EMPLOYEES_VIEW_SCOPE_ALL',
  EMPLOYEES_VIEW_SENSITIVE_INFO = 'EMPLOYEES_VIEW_SENSITIVE_INFO',
  EMPLOYEES_EDIT_PROFILE = 'EMPLOYEES_EDIT_PROFILE',
  EMPLOYEES_ACTION_RELIEVE = 'EMPLOYEES_ACTION_RELIEVE',
  EMPLOYEES_ACTION_REJOIN = 'EMPLOYEES_ACTION_REJOIN',
  EMPLOYEES_ACTION_RESTORE = 'EMPLOYEES_ACTION_RESTORE',
  EMPLOYEES_VIEW_TIMELINE = 'EMPLOYEES_VIEW_TIMELINE',
  EXPORT_DATA = 'EXPORT_DATA',
  EMPLOYEES_TAB_ACTIVE = 'EMPLOYEES_TAB_ACTIVE',
  EMPLOYEES_TAB_RELIEVED = 'EMPLOYEES_TAB_RELIEVED',
  EMPLOYEES_TAB_PENDING = 'EMPLOYEES_TAB_PENDING',
  EMPLOYEES_TAB_RECYCLE_BIN = 'EMPLOYEES_TAB_RECYCLE_BIN',
  EMPLOYEES_SEARCH = 'EMPLOYEES_SEARCH',
  EMPLOYEES_COLUMN_FILTER = 'EMPLOYEES_COLUMN_FILTER',
  EMPLOYEES_IMPORT = 'EMPLOYEES_IMPORT',
  EMPLOYEES_CORRECT_ID = 'EMPLOYEES_CORRECT_ID',
  EMPLOYEES_REQUEST_CORRECTION = 'EMPLOYEES_REQUEST_CORRECTION',
  EMPLOYEES_MANAGE_DEPLOYMENTS = 'EMPLOYEES_MANAGE_DEPLOYMENTS',
  EMPLOYEES_MANAGE_CLIENT_IDS = 'EMPLOYEES_MANAGE_CLIENT_IDS',
  EMPLOYEES_MANAGE_SECURITY = 'EMPLOYEES_MANAGE_SECURITY',
  EMPLOYEES_VIEW_ONBOARDING_METHOD = 'EMPLOYEES_VIEW_ONBOARDING_METHOD',
  EMPLOYEES_MARK_PROFILE_COMPLETE = 'EMPLOYEES_MARK_PROFILE_COMPLETE',
  EMPLOYEES_SEND_PROFILE_NUDGE = 'EMPLOYEES_SEND_PROFILE_NUDGE',

  // Tier 6.5: Recruitment & Referral Invites
  INVITES_VIEW = 'INVITES_VIEW',
  INVITES_VIEW_ALL = 'INVITES_VIEW_ALL',
  INVITES_CREATE = 'INVITES_CREATE',
  INVITES_MANAGE = 'INVITES_MANAGE',
  INVITES_LOCK_PHONE = 'INVITES_LOCK_PHONE',
  INVITES_SET_EXPIRY = 'INVITES_SET_EXPIRY',
  INVITES_PREFILL_FIELDS = 'INVITES_PREFILL_FIELDS',
  INVITES_LOCK_PREFILLED = 'INVITES_LOCK_PREFILLED',
  INVITES_EDIT = 'INVITES_EDIT',
  INVITES_REACTIVATE = 'INVITES_REACTIVATE',
  INVITES_DELETE = 'INVITES_DELETE',

  // Tier 7: Sites, Vacancies & Disciplinary Modules
  SITES_VIEW = 'SITES_VIEW',
  SITES_MANAGE = 'SITES_MANAGE',
  SITES_EDIT_INFO = 'SITES_EDIT_INFO',
  VACANCIES_VIEW = 'VACANCIES_VIEW',
  VACANCIES_POST = 'VACANCIES_POST',
  VACANCIES_MANAGE = 'VACANCIES_MANAGE',
  DISCIPLINE_VIEW = 'DISCIPLINE_VIEW',
  DISCIPLINE_VIEW_SCOPE_ALL = 'DISCIPLINE_VIEW_SCOPE_ALL',
  DISCIPLINE_MANAGE = 'DISCIPLINE_MANAGE',
  DISCIPLINE_DELETE = 'DISCIPLINE_DELETE',
  GAMIFICATION_MANAGE = 'GAMIFICATION_MANAGE',

  // Tier 8: 3rd-Party Background Verification (BGV)
  BGV_VIEW = 'BGV_VIEW',
  BGV_VIEW_SCOPE_ALL = 'BGV_VIEW_SCOPE_ALL',
  BGV_VIEW_DOSSIER = 'BGV_VIEW_DOSSIER',
  BGV_COPY_DOSSIER = 'BGV_COPY_DOSSIER',
  BGV_DISPATCH_VENDOR = 'BGV_DISPATCH_VENDOR',
  BGV_UPLOAD_CERTIFICATE = 'BGV_UPLOAD_CERTIFICATE',
  BGV_APPROVE_REJECT = 'BGV_APPROVE_REJECT',
  BGV_CONFIGURE_FIELDS = 'BGV_CONFIGURE_FIELDS',
  BGV_MANAGE = 'BGV_MANAGE',
  BGV_VENDOR = 'BGV_VENDOR',

  // Backward compatibility legacy values mapping
  MANAGE_SUBMISSIONS = 'SUBMISSIONS_APPROVE',
  MANAGE_LEAVES = 'LEAVES_APPROVE',
  MANAGE_ACCOUNT_UPDATES = 'ACCOUNT_UPDATES_APPROVE',
  MANAGE_RESIGNATIONS = 'RESIGNATIONS_APPROVE',
  MANAGE_SITES = 'SITES_MANAGE',
  MANAGE_DISCIPLINE = 'DISCIPLINE_MANAGE',
  VIEW_SUBMISSIONS = 'SUBMISSIONS_VIEW',
  VIEW_LEAVES = 'LEAVES_VIEW',
  VIEW_ACCOUNT_UPDATES = 'ACCOUNT_UPDATES_VIEW',
  VIEW_RESIGNATIONS = 'RESIGNATIONS_VIEW',
  VIEW_SITES = 'SITES_VIEW',
  VIEW_VACANCIES = 'VACANCIES_VIEW',
  POST_VACANCIES = 'VACANCIES_POST',
  MANAGE_VACANCIES = 'VACANCIES_MANAGE',
  VIEW_DISCIPLINE = 'DISCIPLINE_VIEW',
  VIEW_TEAM_HIERARCHY = 'EMPLOYEES_VIEW_TIMELINE',
  VIEW_MASTER_EMPLOYEE_LIST = 'EMPLOYEES_VIEW',
  VIEW_DASHBOARD_STATS = 'EMPLOYEES_VIEW',
  VIEW_SENSITIVE_INFO = 'EMPLOYEES_VIEW_SENSITIVE_INFO',
  ADMIN_VACANCY_MANAGER = 'VACANCIES_MANAGE'
}

export interface SubUnit {
  id: string;
  name: string; // The sub-name (e.g., "icres")
  code?: string; // Optional unit code
  status?: 'Active' | 'Inactive'; // New: Status for individual sub-units
}

export interface Site {
  id: string;
  name: string;
  location: string;
  supervisorId?: string;
  supervisorIds?: string[]; // Multiple supervisors assigned
  subUnits?: SubUnit[]; // Optional sub-units
  status: 'Active' | 'Inactive';
  createdAt: string;
  // New Fields for Vacancy/Blog
  address?: string;
  googleMapsLink?: string;
  contactNumber?: string;
  allowedDesignations?: string[]; // New: Filter designations per site
  requiredClientIds?: string[]; // Legacy: Client ID requirements (names)
  requiredClientIdIds?: string[]; // New: References to Global ID Library (definitions)
  requiresBgv?: boolean; // Requires 3rd-Party BGV (e.g. Wipro, Capgemini)
}

export interface DraftSubmission {
  id: string;
  data: any;
  sectionIndex: number;
  lastUpdated: string;
  ownerUid?: string;
  ownerEmail?: string | null;
  isGoogleDraft?: boolean;
  inviteId?: string | null;
}

export interface Role {
  id: string;
  name: string;
  permissions: Permission[];
  isDisabled?: boolean;
  visibleMasterListFields?: string[]; // IDs of form fields or system keys
  fieldVisibility?: Record<string, 'READ_ONLY' | 'HIDDEN'>; // Visibility rules for Master Employee Directory
  onboardingFieldVisibility?: Record<string, 'READ_ONLY' | 'HIDDEN'>; // Visibility rules for Onboarding / Review modal
  bgvFieldVisibility?: Record<string, 'READ_ONLY' | 'HIDDEN'>; // Visibility rules for BGV Dossier per field
  allowedPrefillFieldIds?: string[];
}

export interface StaffUser {
  id: string;
  username: string;
  email: string; // Used for Firebase Authentication lookup
  password?: string; // DEPRECATED: Only used transiently during creation, never stored in Firestore
  name: string;
  roleId: string;
  sitesManaged?: string[]; // New
  isDisabled?: boolean;
  permissionOverrides?: Record<string, boolean>; // User-specific override map (true = grant, false = deny)
  allowedPrefillFieldIds?: string[];
}

export interface ApprovalLevel {
  level: number;
  roleId: string;
}

export interface WorkflowConfig {
  moduleId: 'LEAVES' | 'ACCOUNT_UPDATES' | 'SUBMISSIONS' | 'RESIGNATIONS';
  levels: ApprovalLevel[];
}

export enum SubmissionStatus {
  PENDING_REVIEW = 'Pending Review',
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
  PENDING_PROFILE = 'Pending Profile',
}

export enum RequestStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
}

// Kept for backward compatibility with existing constants, but interfaces use string
export enum LeaveType {
  CASUAL = 'Casual Leave',
  SICK = 'Sick Leave',
  EARNED = 'Earned Leave',
  UNPAID = 'Unpaid Leave',
}

export interface LeaveTypeConfig {
  typeId: string; // Dynamic string ID
  label: string;
  defaultQuota: number; // Days per year
  isActive: boolean;
}

export interface LeavePolicy {
  showBalancesToEmployees: boolean;
  leaveTypes: LeaveTypeConfig[];
}

export interface ClientIdDefinition {
  id: string;
  name: string;
  description?: string;
  pattern?: string; // Regex for validation (optional)
  patternMessage?: string; // Error message if regex fails
  fieldType: 'text' | 'number' | 'uppercase';
  isRequiredByDefault?: boolean;
  isDisabled?: boolean;
  minLength?: number;
  maxLength?: number;
}

// New Interface for Global Portal Configuration
export interface PortalConfig {
  enableLeaves: boolean;
  enableAccountUpdates: boolean;
  enableResignations: boolean;
  enableDisciplinary: boolean;
  clientIdDefinitions?: ClientIdDefinition[]; // New: Global library of IDs
  bgvConfig?: {
    extractedFieldIds: string[]; // Form field IDs chosen by SuperAdmin to extract for BGV dossiers
    instructions?: string;
  };
  inviteConfig?: {
    allowPrefillFields: boolean;
    allowedPrefillFieldIds: string[];
    allowPhoneLock: boolean;
    allowLinkExpiry: boolean;
    lockPrefilledFields: boolean;
  };
  designations?: string[];
  dbReadCap?: number;
  dbWriteCap?: number;
  storageCap?: number;
  blockWritesOnLimit?: boolean;
  blockReadsOnLimit?: boolean;
  blockUploadsOnLimit?: boolean;
  manualEmergencyLock?: boolean;
  manualReadOnly?: boolean;
  autoDeleteAbandonedSubmissions?: boolean;
}

export interface LeaveBalance {
  employeeId: string;
  year: number;
  balances: Record<string, { // Dynamic string key
    total: number;
    used: number;
  }>;
}

export enum DisciplinaryActionType {
  VERBAL_WARNING = 'Verbal Warning',
  WRITTEN_WARNING = 'Written Warning',
  SHOW_CAUSE = 'Show Cause Notice',
  SUSPENSION = 'Suspension',
  TERMINATION = 'Termination',
}

export interface DisciplinaryAction {
  id: string;
  employeeId: string;
  employeeName: string;
  actionType: DisciplinaryActionType;
  date: string;
  description: string;
  filedBy: string; // Staff Name
  filedByRoleId: string;
  siteId?: string;
  documentUrl?: string;
}

export enum UserType {
  ADMIN = 'Admin',
  EMPLOYEE = 'Employee',
  PUBLIC = 'Public',
}

export interface User {
  type: UserType;
  id: string;
  portalId?: string; // Global portal ID (onboarding submission ID)
  name?: string;
  email?: string;
  roleId?: string;
  sitesManaged?: string[]; // New: Site IDs this user can access
  profilePhotoURL?: string; // Firebase Storage URL
  permissionOverrides?: Record<string, boolean>; // User-specific override map (true = grant, false = deny)
  allowedPrefillFieldIds?: string[];
  isDefaultPassword?: boolean;
  needsPasswordSetup?: boolean;
}

export interface ApprovalHistoryEntry {
  level: number;
  actionBy: string;
  actionByRole: string;
  timestamp: string;
  status: RequestStatus | SubmissionStatus | 'Reverted' | string;
  comments?: string;
}

export interface SubmittedFormData {
  id: string;
  employeeId?: string;
  status: SubmissionStatus;
  timestamp: string;
  data: any;
  formData?: any;
  currentLevel: number;
  approvalHistory: ApprovalHistoryEntry[]; // Assuming ApprovalEvent is a typo and should be ApprovalHistoryEntry
  originalFormSections: FormSection[]; // Assuming any[] is a typo and should be FormSection[]
  passwordHash?: string;
  mockPassword?: string;
  isBlocked?: boolean;
  driveFolderName?: string;
  applicantName?: string;
  profilePhotoURL?: string; // Firebase Storage URL
  profileCompletionStatus?: 'COMPLETE' | 'INCOMPLETE';
  pendingProfileFields?: string[];
  pendingProfileNote?: string;
  duplicateCheck?: DuplicateCheckResult;
  aadhaarNumber?: string;
  panNumber?: string;
  uanNumber?: string;
  phoneNumber?: string;
  inviteId?: string | null;
  recruitedBy?: string | null;
  recruitedByName?: string | null;
}

export interface DuplicateMatchItem {
  matchType: 'EXISTING_ACTIVE_EMPLOYEE' | 'EX_EMPLOYEE_REHIRE' | 'DUPLICATE_SUBMISSION' | 'PLACEHOLDER_VALUE';
  matchedField: 'Aadhaar Number' | 'PAN Card' | 'UAN Number' | 'Phone Number';
  matchedValue: string;
  matchedId?: string;
  matchedName?: string;
  matchedSite?: string;
  relievingDate?: string;
  relievingReason?: string;
  submissionId?: string;
  submissionStatus?: string;
  details: string;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  matches?: DuplicateMatchItem[];
  matchType?: 'EXISTING_ACTIVE_EMPLOYEE' | 'EX_EMPLOYEE_REHIRE' | 'DUPLICATE_SUBMISSION' | 'PLACEHOLDER_VALUE';
  matchedField?: 'Aadhaar Number' | 'PAN Card' | 'UAN Number' | 'Phone Number';
  matchedValue?: string;
  matchedId?: string;
  matchedName?: string;
  matchedSite?: string;
  relievingDate?: string;
  relievingReason?: string;
  submissionId?: string;
  submissionStatus?: string;
  details?: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  siteId?: string; // New: For permission filtering
  subUnitId?: string; // New
  leaveType: string; // Dynamic string
  startDate: string;
  endDate: string;
  reason: string;
  status: RequestStatus;
  currentLevel: number;
  approvalHistory: ApprovalHistoryEntry[];
  submissionDate: string;
  adminComments?: string;
}

export interface AccountUpdateRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  siteId?: string; // New
  fieldId: string;
  fieldLabel: string;
  currentValue: any;
  requestedValue: any;
  reason?: string;
  supportingDocument?: File | null;
  status: RequestStatus;
  currentLevel: number;
  approvalHistory: ApprovalHistoryEntry[];
  submissionDate: string;
  adminComments?: string;
}

export interface ResignationRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  siteId?: string; // New
  unit: string;
  resignationDate: string; // The date they submitted the form
  relievingDate: string;   // The calculated or edited last working day
  reason: string;
  document: File | null;
  status: RequestStatus;
  currentLevel: number;
  approvalHistory: ApprovalHistoryEntry[];
  submissionDate: string;
  adminComments?: string;
}

// --- Audit Log Types ---
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actionType: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE' | 'APPROVAL' | 'REJECTION' | 'LOGIN' | 'LOGOUT' | 'SUBMIT' | 'EXPORT';
  targetModule: 'SITES' | 'STAFF' | 'ROLES' | 'LEAVES' | 'EMPLOYEES' | 'SYSTEM' | 'AUTH' | 'SUBMISSION' | 'BGV' | 'INVITES' | 'DISCIPLINARY' | 'SETTINGS';
  details: string;
  _edited?: boolean; // Privileged field — set when SuperAdmin modifies a log entry
}

// --- Notification Types ---
export interface Notification {
  id: string;
  targetUserId: string; // Employee ID or Staff ID
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  read: boolean;
  timestamp: string;
  link?: string; // AppView string for navigation
}

// --- Firestore Data Models (AI Studio Architecture) ---

export interface FirestoreUser {
  uid: string;
  email: string;
  displayName: string;
  roleId: string;
  isDisabled: boolean;
  sitesManaged: string[]; // Site IDs
}

export interface OnboardingSubmission {
  id: string; // Auto-generated UUID
  status: 'Pending Review' | 'Approved' | 'Rejected';
  currentLevel: number;
  formData: Record<string, any>; // Dynamic form data
  approvalHistory: ApprovalHistoryEntry[];
  timestamp: any; // serverTimestamp or ISO string
  employeeId?: string; // If approved
  mockPassword?: string; // Default password for testing
  originalFormSections: FormSection[]; // Keep this for now to render form
  isBlocked?: boolean;
  driveFolderName?: string;
  applicantName?: string;
  needsProfileCompletion?: boolean;
  profileStatus?: 'waiting_for_employee' | 'waiting_for_admin' | 'approved';
  profileCompletionStatus?: 'COMPLETE' | 'INCOMPLETE';
  pendingProfileFields?: string[];
  pendingProfileNote?: string;
  passwordHash?: string;
  isDefaultPassword?: boolean;
  authProvider?: 'manual' | 'google';
  linkedUid?: string; // Optional: Google UID linked during onboarding
  linkedGoogleEmail?: string; // Optional: Google email linked during onboarding
  legacyImportId?: string; // Optional: ID from legacy_employee_imports
  inviteId?: string;
  recruitedBy?: string;
  recruitedByName?: string;
  duplicateCheck?: DuplicateCheckResult;
  aadhaarNumber?: string;
  panNumber?: string;
  uanNumber?: string;
  phoneNumber?: string;
  siteId?: string;
  siteName?: string;
}

export interface EmploymentStint {
  employeeId?: string; // Snapshot of the ID used during this stint
  joiningDate: string;
  relievingDate: string;
  relievingReason: 'Resignation' | 'Termination' | 'Absconding' | 'ContractEnded' | 'Other';
}

export interface EmployeeAssignment {
  id: string; // Unique ID for this stint
  siteId: string;
  subUnitId?: string; // Linked to one of the site's sub-units
  designation: string;
  type: 'PRIMARY' | 'OT';
  joiningDate: string;
  relievingDate?: string;
  relievingReason?: string;
  status: 'Active' | 'Relieved';
}

export interface FirestoreEmployee {
  uid: string; // Linked Firebase Auth UID
  employeeId: string; // e.g. "HY123456"
  portalId?: string; // Store Portal ID inside the record
  profileData: Record<string, any>;
  data?: Record<string, any>; // Form data from bulk import
  currentSiteId: string;
  siteName?: string; // Denormalized for display
  mockPassword?: string; // Default password generated for the employee
  leaveBalance: Record<string, number>; // { Casual: 12, Sick: 7 }
  isActive: boolean;
  isBlocked?: boolean; // Legacy field, will be replaced by isRelieved
  isRelieved?: boolean; // Employee has left the company
  relievingDate?: string; // ISO date string
  relievingReason?: 'Resignation' | 'Termination' | 'Absconding' | 'ContractEnded' | 'Other';
  joiningDate: string;
  originalJoiningDate?: string; // The very first date they joined
  employmentHistory?: EmploymentStint[]; // Log of previous stints
  activeAssignments?: EmployeeAssignment[]; // Current site assignments
  assignmentHistory?: EmployeeAssignment[]; // History of all site assignments
  assignedSiteIds?: string[]; // Allowed/assigned site IDs
  driveFolderName?: string;
  applicantName?: string;
  needsProfileCompletion?: boolean;
  profileStatus?: 'waiting_for_employee' | 'waiting_for_admin' | 'approved';
  profileCompletionStatus?: 'COMPLETE' | 'INCOMPLETE';
  pendingProfileFields?: string[];
  pendingProfileNote?: string;
  importedVia?: string;
  deletedAt?: string | null;
  passwordHash?: string; // SHA-256 hash
  isDefaultPassword?: boolean; // True if using default birth-year password
  needsPasswordSetup?: boolean;
  authProvider?: 'manual' | 'google';
  linkedGoogleEmail?: string;
  previousEmployeeId?: string; // Link to past ID if rejoined
  rehiredAs?: string; // Link to new ID if relieved and rejoined
  designation?: string; // Denormalized for display
  profilePhotoURL?: string; // Firebase Storage URL
  clientIds?: Record<string, string>; // New: Store client-specific ID values (e.g. { "BPSS ID": "1234" })
  inviteId?: string;
  recruitedBy?: string;
  recruitedByName?: string;
  duplicateCheck?: DuplicateCheckResult;
  aadhaarNumber?: string;
  panNumber?: string;
  uanNumber?: string;
  phoneNumber?: string;
}

export interface Request {
  id: string;
  type: 'LEAVE' | 'ACCOUNT_UPDATE' | 'RESIGNATION';
  employeeId: string;
  data: any;
  status: 'Pending' | 'Approved' | 'Rejected';
  workflowLevel: number;
  auditTrail: ApprovalHistoryEntry[];
  timestamp: string;
}

export interface TimelineEvent {
  id: string;
  type: 'JOINED' | 'RELIEVED' | 'LEAVE' | 'DISCIPLINE' | 'UPDATE' | 'RESIGNATION' | 'PROMOTION' | 'SUBMISSION';
  date: string;
  title: string;
  description: string;
  status?: string;
  metadata?: any;
  employeeId: string; // The ID this event belongs to (could be old ID)
}

export interface DashboardAnalytics {
  headcountBySite: Record<string, number>;
  leavesByType: Record<string, { pending: number, approved: number }>;
  recentHires: number;
}

// --- Legacy Profile Claim Types ---
export type LegacyVerificationMetric = 'phone' | 'aadhaar' | 'dob' | 'pan' | 'bankAccount' | 'fatherName';

export interface LegacyClaimConfig {
  enabled: boolean;
  verificationMetrics: LegacyVerificationMetric[]; // Supporting multiple metrics
  /** Label shown to the employee on the claim form (deprecated in favor of dynamic labels) */
  verificationLabel: string;
}

export interface LegacyImportedEmployee {
  id: string; // auto-generated doc ID
  employeeId: string; // the Employee ID from their old roster
  fullName: string;
  phoneNumber?: string;
  aadhaarNumber?: string;
  panNumber?: string;
  bankAccountNumber?: string;
  fatherName?: string;
  dateOfBirth?: string; // YYYY-MM-DD
  designation?: string;
  location?: string;
  /** All other raw data from the Excel row */
  rawData: Record<string, any>;
  /** Has this profile already been claimed? */
  claimed: boolean;
  claimedAt?: string;
  claimedByUid?: string;
  importedAt: string;
}

export interface Vacancy {
  id: string;
  title: string; // Designation
  department: string;
  siteId: string; // MANDATORY: Link to site
  siteName: string; // Denormalized for display
  location?: string; // Legacy, prefer site.address
  count: number;
  description: string;
  requirements?: string[];
  salaryRange?: string;
  type: 'Full-time' | 'Part-time' | 'Contract';
  status: 'Open' | 'Closed';
  postedDate: string;
  // Denormalized Site Contact Info (optional, or fetch from Site)
  contactNumber?: string;
  googleMapsLink?: string;
}

export interface CorrectionRequest {
  id: string;              // Secure unique token (UUID v4)
  targetId: string;        // employeeId or submissionId
  targetType: 'employee' | 'submission';
  applicantName: string;
  requestedFields: string[]; // Form field IDs
  fieldReasons: Record<string, string>; // Mappings of fieldId -> reason string
  status: 'pending' | 'completed' | 'expired';
  expiresAt: string;       // ISO Date string
  createdAt: string;       // ISO Date string
  createdBy: string;       // Admin name
  deleteOldFiles?: boolean; // If true, delete replaced files from Storage on correction submission
}

export interface ReferralInvite {
  id: string; // Invite Token (UUID)
  createdBy: string; // Staff ID/Username
  createdByName: string; // Staff Name
  createdAt: string; // ISO date
  expiresAt: string | null; // Expiration timestamp
  siteId: string;
  siteName: string;
  designation: string;
  phoneNumberLock: boolean;
  lockedPhoneNumber?: string;
  prefillFields?: Record<string, any>; // Dynamic prefilled fields
  clicks: number;
  started: number;
  joined: number;
  status: 'Active' | 'Expired' | 'Revoked';
  lockPrefilledFields?: boolean;
  isReusable?: boolean;
}

// --- 3rd-Party Background Verification (BGV) Types ---
export enum BgvStatus {
  PENDING = 'PENDING',                     // Awaiting submission to vendor
  UNDER_PROCESS = 'UNDER_PROCESS',         // In progress with 3rd-party vendor
  VENDOR_SUBMITTED = 'VENDOR_SUBMITTED',   // Vendor submitted certificate, awaiting staff review
  COMPLETED = 'COMPLETED',                 // Staff approved & marked complete
  FAILED = 'FAILED',                       // Adverse findings / failed
}

export interface BgvRecord {
  id: string;                              // e.g. BGV-{employeeId} or auto-generated doc ID
  employeeId: string;                      // Badge ID (e.g. HY140001) or Account ID
  employeeDocId: string;                   // Firestore document ID in employees
  employeeName: string;
  siteId: string;
  siteName: string;
  designation?: string;
  phoneNumber?: string;
  aadhaarNumber?: string;
  dob?: string;
  fatherName?: string;
  permanentAddress?: string;
  photoUrl?: string;                       // Passport size photo
  aadhaarDocPath?: string;                 // Storage path or URL to Aadhaar
  status: BgvStatus;
  vendorId?: string;                       // Optional vendor account ID
  vendorName?: string;                     // e.g. "AuthBridge", "FirstAdvantage"
  vendorCaseId?: string;                   // Vendor's case / reference number
  sentToVendorDate?: string;               // ISO date
  vendorSubmittedDate?: string;            // ISO date
  bgvDocumentUrl?: string;                 // Final BGV certificate / report URL
  bgvDocumentPath?: string;                // Storage path in Firebase
  bgvDocumentName?: string;                // Original filename
  approvedDate?: string;                   // ISO date
  approvedBy?: string;                     // Staff name
  rejectionReason?: string;                // If rejected or adverse
  notes?: string;                          // Notes / follow-up remarks
  customFields?: Record<string, { label: string; value: any; isFile?: boolean }>;      // Dynamically extracted fields based on SuperAdmin config
  createdAt: string;
  updatedAt: string;
}


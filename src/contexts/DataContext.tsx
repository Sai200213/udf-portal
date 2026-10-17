import log from "@/src/utils/logger";
import { db, auth } from '../firebase/config';
import { doc, onSnapshot, query, collection, where } from 'firebase/firestore';
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import {
    SubmittedFormData,
    LeaveRequest,
    AccountUpdateRequest,
    ResignationRequest,
    DisciplinaryAction,
    LeaveBalance,
    FirestoreEmployee,
    Notification,
    DashboardAnalytics,
    DraftSubmission,
    UserType
} from '../../types';
import {
    getGlobalStats,
    subscribeToEmployeeByUid,
    subscribeToSubmissionsByUid,
    subscribeToDrafts
} from '../services/employeeService';
import {
    subscribeToLeaveRequests,
    subscribeToMyLeaveRequests,
    subscribeToAccountUpdates,
    subscribeToMyAccountUpdates,
    subscribeToResignationRequests,
    subscribeToMyResignations,
    subscribeToDisciplinaryActions,
    subscribeToMyDisciplinaryActions
} from '../services/requestService';
import {
    subscribeToRoles,
    subscribeToStaffUsers,
    subscribeToWorkflows,
    subscribeToSites,
    subscribeToFormSections,
    subscribeToEditableFields,
    subscribeToLeavePolicy,
    subscribeToPortalConfig
} from '../services/adminService';
import { useAuth } from '../context/AuthContext';
import {
    Role,
    StaffUser,
    WorkflowConfig,
    Site,
    FormSection,
    LeavePolicy,
    PortalConfig,
    Permission
} from '../../types';
import {
    defaultRoles,
    defaultStaff,
    defaultWorkflows,
    defaultSites,
    defaultFormSections,
    defaultEditableFields,
    defaultLeavePolicy,
    defaultPortalConfig
} from '../constants/defaults';

interface DataContextType {
    // Data
    submittedForms: SubmittedFormData[];
    leaveRequests: LeaveRequest[];
    accountUpdateRequests: AccountUpdateRequest[];
    resignationRequests: ResignationRequest[];
    disciplinaryActions: DisciplinaryAction[];
    leaveBalances: LeaveBalance[];
    employees: FirestoreEmployee[];
    notifications: Notification[];
    drafts: DraftSubmission[];

    setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;

    // Basic Setters
    setSubmittedForms: React.Dispatch<React.SetStateAction<SubmittedFormData[]>>;
    setLeaveRequests: React.Dispatch<React.SetStateAction<LeaveRequest[]>>;
    setAccountUpdateRequests: React.Dispatch<React.SetStateAction<AccountUpdateRequest[]>>;
    setResignationRequests: React.Dispatch<React.SetStateAction<ResignationRequest[]>>;
    setDisciplinaryActions: React.Dispatch<React.SetStateAction<DisciplinaryAction[]>>;
    setLeaveBalances: React.Dispatch<React.SetStateAction<LeaveBalance[]>>;
    setEmployees: React.Dispatch<React.SetStateAction<FirestoreEmployee[]>>;

    // Structural Data
    roles: Role[];
    staffUsers: StaffUser[];
    workflowConfigs: WorkflowConfig[];
    sites: Site[];
    sections: FormSection[];
    editableFieldIds: string[];
    leavePolicy: LeavePolicy | null;
    portalConfig: PortalConfig | null;
    allowedSiteIds?: string[];

    // Structural Setters
    setRoles: React.Dispatch<React.SetStateAction<Role[]>>;
    setStaffUsers: React.Dispatch<React.SetStateAction<StaffUser[]>>;
    setWorkflowConfigs: React.Dispatch<React.SetStateAction<WorkflowConfig[]>>;
    setSites: React.Dispatch<React.SetStateAction<Site[]>>;
    setSections: React.Dispatch<React.SetStateAction<FormSection[]>>;
    setEditableFieldIds: React.Dispatch<React.SetStateAction<string[]>>;
    setLeavePolicy: React.Dispatch<React.SetStateAction<LeavePolicy | null>>;
    setPortalConfig: React.Dispatch<React.SetStateAction<PortalConfig | null>>;

    // Hydration Status
    isRolesLoaded: boolean;
    isSitesLoaded: boolean;
    isStaffLoaded: boolean;

    // Stats
    stats: {
        pendingSubmissions: number;
        activeEmployees: number;
        pendingLeaves: number;
        pendingUpdates: number;
        pendingProfiles: number;
        pendingResignations: number;
    };
    dashboardAnalytics: DashboardAnalytics | null;
    refreshGlobalStats: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [submittedForms, setSubmittedForms] = useState<SubmittedFormData[]>([]);
    const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
    const [accountUpdateRequests, setAccountUpdateRequests] = useState<AccountUpdateRequest[]>([]);
    const [resignationRequests, setResignationRequests] = useState<ResignationRequest[]>([]);
    const [disciplinaryActions, setDisciplinaryActions] = useState<DisciplinaryAction[]>([]);
    const [leaveBalancesRaw, setLeaveBalancesRaw] = useState<LeaveBalance[]>([]);
    const [employees, setEmployees] = useState<FirestoreEmployee[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [drafts, setDrafts] = useState<DraftSubmission[]>([]);

    // Structural State
    const [roles, setRoles] = useState<Role[]>(defaultRoles);
    const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
    const [workflowConfigs, setWorkflowConfigs] = useState<WorkflowConfig[]>(defaultWorkflows);
    const [sites, setSites] = useState<Site[]>(defaultSites);
    const [sections, setSections] = useState<FormSection[]>(defaultFormSections);
    const [editableFieldIds, setEditableFieldIds] = useState<string[]>(defaultEditableFields);
    const [leavePolicy, setLeavePolicy] = useState<LeavePolicy | null>(defaultLeavePolicy);
    const [portalConfig, setPortalConfig] = useState<PortalConfig | null>(defaultPortalConfig);

    // Hydration tracking for clean rendering without permission or scope flicker
    const [isRolesLoaded, setIsRolesLoaded] = useState(false);
    const [isSitesLoaded, setIsSitesLoaded] = useState(false);
    const [isStaffLoaded, setIsStaffLoaded] = useState(false);

    const [stats, setStats] = useState({
        pendingSubmissions: 0,
        activeEmployees: 0,
        pendingLeaves: 0,
        pendingUpdates: 0,
        pendingProfiles: 0,
        pendingResignations: 0
    });

    const [dashboardAnalytics, setDashboardAnalytics] = useState<DashboardAnalytics | null>(null);

    const leaveBalances = useMemo<LeaveBalance[]>(() => {
        return employees.map(emp => {
            const validIds = [emp.id, emp.employeeId, (emp as any).portalId, (emp as any).submissionId].filter(Boolean);
            const empLeaves = leaveRequests.filter(r => validIds.includes(r.employeeId) && r.status === 'Approved');
            
            const policyBalances: Record<string, { total: number; used: number }> = {};
            if (leavePolicy && leavePolicy.leaveTypes) {
                leavePolicy.leaveTypes.forEach(lt => {
                    const keyMap: Record<string, string> = {
                        'Casual Leave': 'casual',
                        'Sick Leave': 'sick',
                        'Earned Leave': 'earned',
                        'Privilege Leave': 'privilege'
                    };
                    const shortKey = keyMap[lt.label] || lt.typeId.toLowerCase();
                    const quota = emp.leaveBalance?.[shortKey] !== undefined ? emp.leaveBalance[shortKey] : lt.defaultQuota;

                    policyBalances[lt.label] = {
                        total: quota,
                        used: 0
                    };
                });
            }

            empLeaves.forEach(req => {
                const labelMap: Record<string, string> = {
                    'Casual Leave': 'Casual Leave',
                    'Sick Leave': 'Sick Leave',
                    'Earned Leave': 'Earned Leave',
                    'Privilege Leave': 'Privilege Leave'
                };
                const leaveLabel = labelMap[req.leaveType] || req.leaveType;
                if (!policyBalances[leaveLabel]) {
                    policyBalances[leaveLabel] = { total: 0, used: 0 };
                }
                const [sY, sM, sD] = req.startDate.split('-').map(Number);
                const [eY, eM, eD] = req.endDate.split('-').map(Number);
                const startUTC = Date.UTC(sY, sM - 1, sD);
                const endUTC = Date.UTC(eY, eM - 1, eD);
                const days = Math.round((endUTC - startUTC) / (1000 * 3600 * 24)) + 1;
                policyBalances[leaveLabel].used += Math.max(0, days);
            });

            // IMPORTANT: Since emp.leaveBalance stores the remaining balance in Firestore,
            // total entitlement is remaining + used, so that (total - used) in EmployeeLeaveRequestPage correctly equals the remaining balance!
            Object.keys(policyBalances).forEach(label => {
                policyBalances[label].total = policyBalances[label].total + policyBalances[label].used;
            });

            return {
                employeeId: emp.employeeId,
                year: new Date().getFullYear(),
                balances: policyBalances
            };
        });
    }, [employees, leaveRequests, leavePolicy]);

    const setLeaveBalances = useCallback((val: any) => {
        // No-op for backward compatibility
    }, []);

    const { user, loading: authLoading } = useAuth();

    const userRoleObj = useMemo(() => {
        if (!user) return undefined;
        return roles.find(r => r.id === (user as any)?.roleId);
    }, [user, roles]);

    const isSuperAdmin = useMemo(() => {
        if (!user) return false;
        return (user as any)?.roleId === 'role-super-admin' || user?.id === 'super-admin';
    }, [user]);

    const allowedSiteIds = useMemo(() => {
        if (!user) return [];
        if (isSuperAdmin) return undefined;

        // Organization-wide roles (HR Manager, Manager, etc.) with ALL scope can see all sites
        const hasAllScope = userRoleObj?.permissions?.includes('EMPLOYEES_VIEW_SCOPE_ALL' as any) ||
                            userRoleObj?.permissions?.includes('SUBMISSIONS_VIEW_SCOPE_ALL' as any) ||
                            userRoleObj?.permissions?.includes('MANAGE_ALL_SITES' as any);
        if (hasAllScope) return undefined;

        const validUserId = user.id && typeof user.id === 'string' && user.id.trim() !== '' ? user.id : null;
        const validUserEmail = user.email && typeof user.email === 'string' && user.email.trim() !== '' ? user.email : null;

        const userObj = staffUsers.find(u => (validUserId && u.id === validUserId) || (validUserEmail && u.email === validUserEmail)) || user;
        const managed = Array.isArray((userObj as any)?.sitesManaged) ? (userObj as any).sitesManaged.filter(Boolean) : [];
        
        const targetIds = [validUserId, (userObj as any)?.id, (userObj as any)?.username].filter(id => Boolean(id && typeof id === 'string' && id.trim() !== ''));
        
        const supervised = targetIds.length > 0 
            ? sites.filter(s => (s.supervisorId && targetIds.includes(s.supervisorId)) || (Array.isArray(s.supervisorIds) && s.supervisorIds.some(id => targetIds.includes(id)))).map(s => s.id)
            : [];

        return Array.from(new Set([...managed, ...supervised]));
    }, [user, staffUsers, sites, isSuperAdmin, userRoleObj]);

    const hasPermission = useCallback((p: Permission) => {
        if (!user) return false;
        if (isSuperAdmin) return true;
        if (userRoleObj?.isDisabled === true) return false;
        const overrides = (user as any)?.permissionOverrides;
        if (overrides && overrides[p] !== undefined) {
            return Boolean(overrides[p]);
        }
        return Boolean(userRoleObj?.permissions?.includes(p));
    }, [user, isSuperAdmin, userRoleObj]);

    const scopedLeaveRequests = useMemo(() => {
        if (isSuperAdmin || hasPermission(Permission.LEAVES_VIEW_SCOPE_ALL)) return leaveRequests;
        if (!allowedSiteIds || allowedSiteIds.length === 0) return [];
        return leaveRequests.filter(r => allowedSiteIds.includes(r.siteId || ''));
    }, [leaveRequests, allowedSiteIds, isSuperAdmin, hasPermission]);

    const scopedAccountUpdateRequests = useMemo(() => {
        if (isSuperAdmin || hasPermission(Permission.ACCOUNT_UPDATES_VIEW_SCOPE_ALL)) return accountUpdateRequests;
        if (!allowedSiteIds || allowedSiteIds.length === 0) return [];
        return accountUpdateRequests.filter(r => allowedSiteIds.includes(r.siteId || ''));
    }, [accountUpdateRequests, allowedSiteIds, isSuperAdmin, hasPermission]);

    const scopedResignationRequests = useMemo(() => {
        if (isSuperAdmin || hasPermission(Permission.RESIGNATIONS_VIEW_SCOPE_ALL)) return resignationRequests;
        if (!allowedSiteIds || allowedSiteIds.length === 0) return [];
        return resignationRequests.filter(r => allowedSiteIds.includes(r.siteId || ''));
    }, [resignationRequests, allowedSiteIds, isSuperAdmin, hasPermission]);

    const scopedDisciplinaryActions = useMemo(() => {
        if (isSuperAdmin || hasPermission(Permission.DISCIPLINE_VIEW_SCOPE_ALL)) return disciplinaryActions;
        if (!allowedSiteIds || allowedSiteIds.length === 0) return [];
        return disciplinaryActions.filter(r => allowedSiteIds.includes(r.siteId || ''));
    }, [disciplinaryActions, allowedSiteIds, isSuperAdmin, hasPermission]);

    const scopedDrafts = useMemo(() => {
        if (isSuperAdmin || hasPermission(Permission.SUBMISSIONS_VIEW_SCOPE_ALL)) return drafts;
        if (!allowedSiteIds || allowedSiteIds.length === 0) return [];
        
        const unitField = sections
            .flatMap(s => s.fields || [])
            .find(f => f && f.label && (f.label.toLowerCase().includes('unit') || f.label.toLowerCase().includes('facility')));
        const unitFieldId = unitField?.id;

        return drafts.filter(draft => {
            const data = draft.data || {};
            const searchData = data.data || data;
            const draftLocation = searchData.location || (unitFieldId ? searchData[unitFieldId] : undefined);
            if (!draftLocation) return false;
            
            const allowedSiteNames = sites.filter(s => allowedSiteIds.includes(s.id)).map(s => s.name.toLowerCase());
            const draftLocStr = String(draftLocation).toLowerCase();
            return allowedSiteIds.includes(draftLocation) || allowedSiteNames.some(name => draftLocStr.includes(name));
        });
    }, [drafts, allowedSiteIds, isSuperAdmin, hasPermission, sections, sites]);

    const scopedSubmittedForms = useMemo(() => {
        if (isSuperAdmin || hasPermission(Permission.SUBMISSIONS_VIEW_SCOPE_ALL)) return submittedForms;
        if (!allowedSiteIds || allowedSiteIds.length === 0) return [];
        
        const SITE_FIELD_ID = '52ae217b-2602-4337-a1cd-a1f9bd36a4b0';
        return submittedForms.filter(sub => {
            const val = String((sub as any).siteId || (sub as any).siteName || sub.data?.[SITE_FIELD_ID] || sub.data?.siteId || sub.data?.siteName || '');
            if (!val) return false;
            if (allowedSiteIds.includes(val)) return true;
            const site = sites.find(s => s.name.toLowerCase() === val.toLowerCase() || s.id.toLowerCase() === val.toLowerCase());
            if (site && allowedSiteIds.includes(site.id)) return true;
            return false;
        });
    }, [submittedForms, allowedSiteIds, isSuperAdmin, hasPermission, sites]);

    const refreshGlobalStats = useCallback(async () => {
        try {
            const { getGlobalStats, getDashboardAnalytics } = await import('../services/employeeService');

            const userRoleObj = roles.find(r => r.id === (user as any)?.roleId);
            const isSuper = (user as any)?.roleId === 'role-super-admin' || user?.id === 'super-admin' || isSuperAdmin;
            const hasPermission = (p: Permission) => {
                if (isSuper) return true;
                if (userRoleObj?.isDisabled === true) return false;
                const overrides = (user as any)?.permissionOverrides;
                if (overrides && overrides[p] !== undefined) {
                    return Boolean(overrides[p]);
                }
                return Boolean(userRoleObj?.permissions?.includes(p));
            };
            const hasViewScopeAll = isSuper || hasPermission(Permission.SUBMISSIONS_VIEW_SCOPE_ALL);

            // For non-super-admins and site-restricted staff, filter stats by their assigned sites
            let siteNames: string[] | undefined;
            let unitFieldId: string | undefined;
            let effectiveSiteIds: string[] | undefined = allowedSiteIds;

            if (!hasViewScopeAll) {
                const allowedSites = sites.filter(s => (allowedSiteIds || []).includes(s.id));
                siteNames = allowedSites.map(s => s.name);
                const unitField = sections
                    .flatMap(s => s.fields || [])
                    .find(f => f && f.label && (f.label.toLowerCase().includes('unit') || f.label.toLowerCase().includes('facility')));
                unitFieldId = unitField?.id;
            } else {
                effectiveSiteIds = undefined;
            }

            const allowed = {
                submissions: hasPermission(Permission.SUBMISSIONS_VIEW),
                employees: hasPermission(Permission.EMPLOYEES_VIEW),
                leaves: hasPermission(Permission.LEAVES_VIEW),
                updates: hasPermission(Permission.ACCOUNT_UPDATES_VIEW),
                profiles: hasPermission(Permission.EMPLOYEES_VIEW),
                resignations: hasPermission(Permission.RESIGNATIONS_VIEW)
            };

            const newStats = await getGlobalStats(unitFieldId, siteNames, allowed, effectiveSiteIds);
            setStats(newStats);

            // Fetch Dashboard Analytics
            const analytics = await getDashboardAnalytics(sites, sections, leavePolicy, {
                employees: allowed.employees,
                leaves: allowed.leaves
            }, effectiveSiteIds);
            setDashboardAnalytics(analytics);
        } catch (error) {
            console.error('[DataContext] Error fetching stats:', error);
        }
    }, [user, roles, sites, sections, leavePolicy, allowedSiteIds]);

    // Refresh stats when allowedSiteIds or key metadata resolves
    const allowedSiteIdsKey = (allowedSiteIds || []).join(',');
    useEffect(() => {
        if (!authLoading && user && (user as any).type === 'Admin') {
            refreshGlobalStats();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, allowedSiteIdsKey, sites.length, roles.length]);

    // 1. General & Structural Subscriptions (No roles dependency, runs on mount/login)
    useEffect(() => {
        const portalType = localStorage.getItem('portalType');

        if (authLoading || !user || portalType === 'onboarding') {
            log.log('[DataContext] Not authenticated, loading, or in Onboarding mode. Skipping general subscriptions.');
            // Clear data if logged out or in onboarding mode
            if (!user || portalType === 'onboarding') {
                setSubmittedForms([]);
                setEmployees([]);
                setLeaveRequests([]);
                setAccountUpdateRequests([]);
                setResignationRequests([]);
                setDisciplinaryActions([]);
                setLeaveBalances([]);
                setNotifications([]);
                setDrafts([]);
                setIsRolesLoaded(true);
                setIsStaffLoaded(true);
            }
            return;
        }

        log.log('[DataContext] Setting up general Firestore subscriptions for user:', user.id);

        let unsubDrafts = () => { };
        let unsubResignations = () => { };
        let unsubEmployees = () => { };
        let unsubFallbackEmp = () => { };
        let unsubSubmissions = () => { };
        let unsubLeaves = () => { };
        let unsubAccountUpdates = () => { };
        let unsubDisciplinary = () => { };

        if ((user as any).type === 'Admin') {
            log.log('[DataContext] User is Admin, subscribing to general operational data...');
            // Drafts (All Admins allowed)
            unsubDrafts = subscribeToDrafts((data) => {
                log.log(`[DataContext] Received ${data.length} drafts`);
                setDrafts(data);
            });

            // Resignations (All Admins allowed)
            unsubResignations = subscribeToResignationRequests((reqs) => {
                log.log(`[DataContext] Received ${reqs.length} resignations`);
                setResignationRequests(reqs);
            });
        } else if ((user as any).type === 'Employee') {
            log.log('[DataContext] User is Employee, subscribing to personal data...');
            const employeeId = (user as any).employeeId;
            const portalId = (user as any).portalId;
            const queryIds = [portalId, employeeId, user.id].filter(Boolean) as string[];
            const firebaseUid = auth.currentUser?.uid;
            
            if (employeeId) {
                const empQuery = query(collection(db, 'employees'), where('employeeId', '==', employeeId));
                unsubEmployees = onSnapshot(empQuery, (snap) => {
                    if (!snap.empty) {
                        unsubFallbackEmp();
                        unsubFallbackEmp = () => { };
                        const docSnap = snap.docs[0];
                        setEmployees([{ id: docSnap.id, ...docSnap.data() } as unknown as FirestoreEmployee]);
                    } else {
                        unsubFallbackEmp();
                        unsubFallbackEmp = subscribeToEmployeeByUid(firebaseUid || user.id, (emp) => {
                            if (emp) setEmployees([emp]);
                        });
                    }
                }, (error) => {
                    log.log('[DataContext] employeeId query error, trying UID fallback');
                    unsubFallbackEmp();
                    unsubFallbackEmp = subscribeToEmployeeByUid(firebaseUid || user.id, (emp) => {
                        if (emp) setEmployees([emp]);
                    });
                });
            } else {
                unsubEmployees = subscribeToEmployeeByUid(firebaseUid || user.id, (emp) => {
                    if (emp) {
                        log.log('[DataContext] Received personal employee record');
                        setEmployees([emp]);
                    }
                });
            }

            unsubSubmissions = subscribeToSubmissionsByUid(user.id, (subs) => {
                if (subs.length > 0) {
                    log.log(`[DataContext] Received personal submission: ${subs[0].id}`);
                    setSubmittedForms(subs);
                }
            });

            unsubLeaves = subscribeToMyLeaveRequests(queryIds, (reqs) => {
                log.log(`[DataContext] Received ${reqs.length} personal leave requests`);
                setLeaveRequests(reqs);
            });

            unsubAccountUpdates = subscribeToMyAccountUpdates(queryIds, (reqs) => {
                log.log(`[DataContext] Received ${reqs.length} personal account updates`);
                setAccountUpdateRequests(reqs);
            });

            unsubResignations = subscribeToMyResignations(queryIds, (reqs) => {
                log.log(`[DataContext] Received ${reqs.length} personal resignations`);
                setResignationRequests(reqs);
            });

            unsubDisciplinary = subscribeToMyDisciplinaryActions(queryIds, (actions) => {
                log.log(`[DataContext] Received ${actions.length} personal disciplinary actions`);
                setDisciplinaryActions(actions);
            });
        }

        // --- Role Subscriptions (Restricted to authenticated users) ---
        let unsubRoles = () => { };

        if ((user as any).type !== 'Guest' && portalType !== 'onboarding') {
            log.log('[DataContext] User verified, subscribing to roles data...');
            // Roles (Subscribed to here, but Roles is NOT a dependency for this effect to prevent loop)
            unsubRoles = subscribeToRoles((r) => {
                log.log(`[DataContext] Received ${r.length} roles`);
                setRoles(r);
                setIsRolesLoaded(true);
            });
        } else {
            setIsRolesLoaded(true);
        }

        return () => {
            log.log('[DataContext] Cleaning up general subscriptions...');
            unsubDrafts();
            unsubResignations();
            unsubEmployees();
            unsubFallbackEmp();
            unsubSubmissions();
            unsubLeaves();
            unsubAccountUpdates();
            unsubDisciplinary();
            unsubRoles();
        };
    }, [user, authLoading]);

    // 1b. Public Metadata Subscriptions (Sites, Form Sections, Portal Config, Leave Policy, Workflows, Editable Fields)
    // These documents are under /settings/{docId} which are publicly readable (allow read: if true;).
    // They must be loaded on mount so onboarding, guest applicants, and public visitors receive real Firestore configuration.
    useEffect(() => {
        log.log('[DataContext] Subscribing to public structural data (sites, sections, portalConfig)...');
        const unsubSites = subscribeToSites((s) => {
            log.log(`[DataContext] Received ${s.length} sites`);
            setSites(s);
            setIsSitesLoaded(true);
        });

        const unsubSections = subscribeToFormSections((sec) => {
            log.log(`[DataContext] Received ${sec.length} form sections`);
            setSections(sec);
        });

        const unsubPortalConfig = subscribeToPortalConfig((cfg) => {
            log.log(`[DataContext] Received portal config`);
            setPortalConfig(cfg);
        });

        const unsubLeavePolicy = subscribeToLeavePolicy((pol) => {
            log.log(`[DataContext] Received leave policy`);
            setLeavePolicy(pol);
        });

        const unsubWorkflows = subscribeToWorkflows((w) => {
            log.log(`[DataContext] Received ${w.length} workflows`);
            setWorkflowConfigs(w);
        });

        const unsubEditableFields = subscribeToEditableFields((ids) => {
            log.log(`[DataContext] Received ${ids.length} editable field IDs`);
            setEditableFieldIds(ids);
        });

        return () => {
            log.log('[DataContext] Cleaning up public structural subscriptions...');
            unsubSites();
            unsubSections();
            unsubPortalConfig();
            unsubLeavePolicy();
            unsubWorkflows();
            unsubEditableFields();
        };
    }, []);

    // 2. Permission-Guarded Admin Subscriptions (Depends on roles, refreshes when roles load)
    useEffect(() => {
        const portalType = localStorage.getItem('portalType');
        if (authLoading || !user || portalType === 'onboarding') return;

        let unsubLeaves = () => { };
        let unsubAccountUpdates = () => { };
        let unsubDisciplinary = () => { };
        let unsubStaff = () => { };

        if ((user as any).type === 'Admin') {
            // Refresh stats on mount or when roles/permissions change
            refreshGlobalStats();

            const userRoleObj = roles.find(r => r.id === (user as any)?.roleId);
            const isSuperAdmin = (user as any)?.roleId === 'role-super-admin' || user?.id === 'super-admin';
            const hasPermission = (p: Permission) => {
                if (isSuperAdmin) return true;
                if (userRoleObj?.isDisabled === true) return false;
                const overrides = (user as any)?.permissionOverrides;
                if (overrides && overrides[p] !== undefined) {
                    return Boolean(overrides[p]);
                }
                return Boolean(userRoleObj?.permissions?.includes(p));
            };

            // Leave Requests
            const hasLeavesPerm = hasPermission(Permission.VIEW_LEAVES) || hasPermission(Permission.MANAGE_LEAVES);
            if (hasLeavesPerm) {
                unsubLeaves = subscribeToLeaveRequests((reqs) => {
                    log.log(`[DataContext] Received ${reqs.length} leave requests`);
                    setLeaveRequests(reqs);
                });
            }

            // Account Updates
            const hasUpdatesPerm = hasPermission(Permission.VIEW_ACCOUNT_UPDATES) || hasPermission(Permission.MANAGE_ACCOUNT_UPDATES);
            if (hasUpdatesPerm) {
                unsubAccountUpdates = subscribeToAccountUpdates((reqs) => {
                    log.log(`[DataContext] Received ${reqs.length} account updates`);
                    setAccountUpdateRequests(reqs);
                });
            }

            // Disciplinary Actions
            const hasDisciplinePerm = hasPermission(Permission.VIEW_DISCIPLINE) || hasPermission(Permission.MANAGE_DISCIPLINE);
            if (hasDisciplinePerm) {
                unsubDisciplinary = subscribeToDisciplinaryActions((actions) => {
                    log.log(`[DataContext] Received ${actions.length} disciplinary actions`);
                    setDisciplinaryActions(actions);
                });
            }

            // Staff Users - always subscribe for admins so that site supervisors and workflow progression can resolve skips correctly
            unsubStaff = subscribeToStaffUsers((users) => {
                log.log(`[DataContext] Received ${users.length} staff users`);
                setStaffUsers(users);
                setIsStaffLoaded(true);
            });
        } else {
            setIsStaffLoaded(true);
        }

        return () => {
            log.log('[DataContext] Cleaning up guarded subscriptions...');
            unsubLeaves();
            unsubAccountUpdates();
            unsubDisciplinary();
            unsubStaff();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, authLoading, roles]);
    // NOTE: refreshGlobalStats is intentionally EXCLUDED from deps.
    // It is a useCallback that captures allowedSiteIds/sites/sections which get new array
    // references on EVERY Firestore snapshot. Including it causes 50+ re-renders/sec (infinite loop).
    // It is called correctly on mount and when roles/user actually change.

    const value: DataContextType = {
        submittedForms: scopedSubmittedForms,
        leaveRequests: scopedLeaveRequests,
        accountUpdateRequests: scopedAccountUpdateRequests,
        resignationRequests: scopedResignationRequests,
        disciplinaryActions: scopedDisciplinaryActions,
        leaveBalances,
        employees,
        notifications,
        drafts: scopedDrafts,
        setSubmittedForms,
        setLeaveRequests,
        setAccountUpdateRequests,
        setResignationRequests,
        setDisciplinaryActions,
        setLeaveBalances,
        setEmployees,
        setNotifications,
        roles,
        staffUsers,
        workflowConfigs,
        sites,
        sections,
        editableFieldIds,
        leavePolicy,
        portalConfig,
        allowedSiteIds,
        isRolesLoaded,
        isSitesLoaded,
        isStaffLoaded,
        setRoles,
        setStaffUsers,
        setWorkflowConfigs,
        setSites,
        setSections,
        setEditableFieldIds,
        setLeavePolicy,
        setPortalConfig,
        stats,
        dashboardAnalytics,
        refreshGlobalStats
    };

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
};





import React, { useState, useMemo } from 'react';
import { StaffUser, Role, Site, FormSection } from '../types';
import Button from './common/Button';
import Input from './common/Input';
import Select from './common/Select';
import Modal from './common/Modal';
import { 
  UserPlus, Trash2, Edit3, AlertTriangle, UserX, UserCheck, Loader2, Mail, 
  CheckCircle, XCircle, Search, Filter, ArrowLeftRight, Building, CheckSquare, 
  Square, X, RefreshCw, ShieldCheck, Users, MapPin, Plus
} from 'lucide-react';
import { createStaffUser, deleteStaffUser, setStaffUserStatus, resetStaffUserPassword } from '../src/services/staffService';
import { auth } from '../src/firebase/config';
import { sendPasswordResetEmail } from 'firebase/auth';
import { db } from '../src/firebase/config';
import { collection, getDocs, query, where, doc, getDoc, updateDoc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { SETTINGS_COLLECTION } from '../src/services/adminService';
import { moveToRecycleBin } from '../src/services/recycleBinService';
import { showUndoToast } from '../src/utils/undoToast';

interface AdminStaffManagementPageProps {
  staffUsers: StaffUser[];
  setStaffUsers: React.Dispatch<React.SetStateAction<StaffUser[]>>;
  roles: Role[];
  sites?: Site[];
  setSites?: React.Dispatch<React.SetStateAction<Site[]>>;
  loggedInUserId: string;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  logAction?: (actionType: any, targetModule: any, details: string) => void;
  formSections: FormSection[];
}

const AdminStaffManagementPage: React.FC<AdminStaffManagementPageProps> = ({ 
  staffUsers, 
  setStaffUsers, 
  roles, 
  sites = [], 
  setSites, 
  loggedInUserId, 
  onNotify, 
  logAction, 
  formSections 
}) => {
  // Modal State for Creating New Staff
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [roleId, setRoleId] = useState(() => {
    const firstNonSuper = roles.find(r => r.id !== 'role-super-admin' && r.name.toLowerCase() !== 'super admin' && r.name.toLowerCase() !== 'superadmin');
    return firstNonSuper ? firstNonSuper.id : (roles[0]?.id || '');
  });
  const [createSelectedSites, setCreateSelectedSites] = useState<string[]>([]);
  const [createSiteSearch, setCreateSiteSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Search & Filter State for Table
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRoleId, setFilterRoleId] = useState<string>('ALL');
  const [filterSiteId, setFilterSiteId] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'DISABLED'>('ALL');

  // Edit Modal State
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [newPasswordForReset, setNewPasswordForReset] = useState('');
  const [editSiteSearch, setEditSiteSearch] = useState('');

  // 1-Click Site Handover / Transfer Modal State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferSourceStaff, setTransferSourceStaff] = useState<StaffUser | null>(null);
  const [transferTargetStaffId, setTransferTargetStaffId] = useState<string>('');
  const [transferMode, setTransferMode] = useState<'REPLACE' | 'CO_SUPERVISOR'>('REPLACE');
  const [isTransferring, setIsTransferring] = useState(false);

  // Smart Delete State
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<string | null>(null);
  const [isCheckingLinks, setIsCheckingLinks] = useState(false);
  interface DeleteLinks {
    sites: { id: string; name: string }[];
    employees: { id: string; name: string }[];
    submissions: { id: string; name: string }[];
  }
  const [deleteLinks, setDeleteLinks] = useState<DeleteLinks>({ sites: [], employees: [], submissions: [] });
  const hasLinks = deleteLinks.sites.length > 0 || deleteLinks.employees.length > 0 || deleteLinks.submissions.length > 0;

  // Active sites list
  const activeSites = useMemo(() => {
    return (sites || []).filter(s => s.status === 'Active');
  }, [sites]);

  // Check if role has organization-wide (all sites) scope
  const hasGlobalSiteScope = (rId: string) => {
    const r = roles.find(role => role.id === rId);
    if (!r) return false;
    if (r.id === 'role-super-admin' || r.name.toLowerCase().includes('super admin')) return true;
    return r.permissions.includes('EMPLOYEES_VIEW_SCOPE_ALL' as any) ||
           r.permissions.includes('SUBMISSIONS_VIEW_SCOPE_ALL' as any) ||
           r.permissions.includes('MANAGE_ALL_SITES' as any);
  };

  // Helper: Get all site IDs assigned to a staff user (combines sitesManaged + site.supervisorId/supervisorIds)
  const getStaffAssignedSiteIds = (staff: StaffUser): string[] => {
    const directSites = Array.isArray(staff.sitesManaged) ? staff.sitesManaged.filter(Boolean) : [];
    const supervisedSites = (sites || [])
      .filter(s => {
        if (s.supervisorId === staff.id) return true;
        if (Array.isArray(s.supervisorIds) && s.supervisorIds.includes(staff.id)) return true;
        return false;
      })
      .map(s => s.id);
    return Array.from(new Set([...directSites, ...supervisedSites]));
  };

  // Helper: Get site objects assigned to a staff user
  const getStaffAssignedSites = (staff: StaffUser): Site[] => {
    const assignedIds = getStaffAssignedSiteIds(staff);
    return (sites || []).filter(s => assignedIds.includes(s.id));
  };

  // Top Operational Metrics
  const stats = useMemo(() => {
    const totalStaff = staffUsers.length;
    const activeFieldOfficers = staffUsers.filter(s => {
      if (s.isDisabled) return false;
      const r = roles.find(role => role.id === s.roleId);
      return r?.name.toLowerCase().includes('field officer') || s.roleId === 'role-field-officer';
    }).length;
    const unassignedSites = activeSites.filter(s => {
      const hasSingle = Boolean(s.supervisorId && s.supervisorId.trim() !== '');
      const hasMulti = Array.isArray(s.supervisorIds) && s.supervisorIds.length > 0;
      return !hasSingle && !hasMulti;
    }).length;
    const disabledAccounts = staffUsers.filter(s => s.isDisabled).length;
    return { totalStaff, activeFieldOfficers, unassignedSites, disabledAccounts };
  }, [staffUsers, roles, activeSites]);

  // Filtered staff users based on search and dropdowns
  const filteredStaffUsers = useMemo(() => {
    return staffUsers.filter(staff => {
      // 1. Search filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const match = staff.name.toLowerCase().includes(q) ||
                      staff.username.toLowerCase().includes(q) ||
                      staff.email.toLowerCase().includes(q);
        if (!match) return false;
      }

      // 2. Role filter
      if (filterRoleId !== 'ALL' && staff.roleId !== filterRoleId) {
        return false;
      }

      // 3. Status filter
      if (filterStatus === 'ACTIVE' && staff.isDisabled) return false;
      if (filterStatus === 'DISABLED' && !staff.isDisabled) return false;

      // 4. Site filter
      if (filterSiteId !== 'ALL') {
        const isGlobal = hasGlobalSiteScope(staff.roleId);
        if (!isGlobal) {
          const assignedIds = getStaffAssignedSiteIds(staff);
          if (!assignedIds.includes(filterSiteId)) return false;
        }
      }

      return true;
    });
  }, [staffUsers, searchTerm, filterRoleId, filterStatus, filterSiteId, sites, roles]);

  // Sync staff site assignments to settings/sites collection in Firestore
  const syncStaffSitesToDatabase = async (staffId: string, assignedSiteIds: string[]) => {
    try {
      const sitesDocRef = doc(db, SETTINGS_COLLECTION, 'sites');
      const sitesSnap = await getDoc(sitesDocRef);
      if (!sitesSnap.exists()) return;
      const currentSites: Site[] = sitesSnap.data().sites || [];
      let modified = false;

      const updatedSites = currentSites.map(s => {
        const isAssigned = assignedSiteIds.includes(s.id);
        let sSupervisorIds = (Array.isArray(s.supervisorIds) ? [...s.supervisorIds] : (s.supervisorId ? [s.supervisorId] : []))
          .filter(id => id && (id === staffId || staffUsers.some(u => u.id === id))); // Prune deleted mock/stale IDs
        
        let currentSupervisorId = s.supervisorId;
        const isSupervisorStale = currentSupervisorId && !staffUsers.some(u => u.id === currentSupervisorId) && currentSupervisorId !== staffId;
        if (isSupervisorStale) {
          currentSupervisorId = '';
          modified = true;
        }

        if (isAssigned) {
          if (!sSupervisorIds.includes(staffId)) {
            sSupervisorIds.push(staffId);
            modified = true;
          }
          if (!currentSupervisorId) {
            currentSupervisorId = staffId;
            modified = true;
          }
        } else {
          if (sSupervisorIds.includes(staffId)) {
            sSupervisorIds = sSupervisorIds.filter(id => id !== staffId);
            modified = true;
          }
          if (currentSupervisorId === staffId) {
            currentSupervisorId = sSupervisorIds[0] || '';
            modified = true;
          }
        }
        return {
          ...s,
          supervisorId: currentSupervisorId || sSupervisorIds[0] || '',
          supervisorIds: sSupervisorIds
        };
      });

      if (modified) {
        await updateDoc(sitesDocRef, { sites: updatedSites });
        if (setSites) {
          setSites(updatedSites);
        }
      }
    } catch (err) {
      console.warn("Could not sync staff sites to settings/sites:", err);
    }
  };

  // Add new staff account
  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !email || !password || !name || !roleId) {
      onNotify("Please fill in all required fields", "error");
      return;
    }

    setIsLoading(true);
    try {
      const result = await createStaffUser({
        email,
        password,
        name,
        username,
        roleId
      });

      if (result.success && result.uid) {
        // Save assigned sites to staff_accounts if selected
        if (createSelectedSites.length > 0) {
          await updateDoc(doc(db, 'staff_accounts', result.uid), {
            sitesManaged: createSelectedSites
          });
          await syncStaffSitesToDatabase(result.uid, createSelectedSites);
        }

        // Update local state
        const newStaffUser: StaffUser = {
          id: result.uid,
          email,
          name,
          username,
          roleId,
          isDisabled: false,
          sitesManaged: createSelectedSites
        };
        setStaffUsers(prev => [...prev, newStaffUser]);

        onNotify(`Account created for ${name}. They can login with email: ${email}`, 'success');
        if (logAction) logAction('CREATE', 'STAFF', `Created staff account for ${name} (${username}) with ${createSelectedSites.length} assigned site(s)`);

        setUsername('');
        setEmail('');
        setPassword('');
        setName('');
        setCreateSelectedSites([]);
        setCreateSiteSearch('');
        setIsCreateModalOpen(false);
      } else {
        onNotify(result.message || "Failed to create staff account", "error");
      }
    } catch (err: any) {
      onNotify(err.message || "An error occurred while creating staff account", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Open Edit Modal
  const handleEditStaff = (staff: StaffUser) => {
    const assignedIds = getStaffAssignedSiteIds(staff);
    setEditingStaff({ 
      ...staff,
      sitesManaged: assignedIds
    });
    setNewPasswordForReset('');
    setEditSiteSearch('');
    setIsEditModalOpen(true);
  };

  // Save Edit
  const saveStaffEdit = async () => {
    if (editingStaff) {
      setIsLoading(true);
      try {
        const { password, ...updates } = editingStaff;
        if (updates.allowedPrefillFieldIds === undefined) {
          updates.allowedPrefillFieldIds = [];
        }
        const sitesToSave = editingStaff.sitesManaged || [];

        await setDoc(doc(db, 'staff_accounts', editingStaff.id), {
          ...updates,
          sitesManaged: sitesToSave
        }, { merge: true });

        // Synchronize site supervisors in settings/sites
        await syncStaffSitesToDatabase(editingStaff.id, sitesToSave);

        setStaffUsers(prev => prev.map(s => s.id === editingStaff.id ? { ...editingStaff, sitesManaged: sitesToSave } : s));
        onNotify("Staff account and site assignments updated.", 'success');
        if (logAction) logAction('UPDATE', 'STAFF', `Updated details and sites for staff: ${editingStaff.name}`);
        setIsEditModalOpen(false);
        setEditingStaff(null);
      } catch (err: any) {
        onNotify(err.message || "Failed to update staff account", "error");
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Toggle Enable/Disable
  const toggleStaffStatus = async (id: string) => {
    if (id === loggedInUserId) {
      onNotify("You cannot disable your own account.", "error");
      return;
    }

    const staff = staffUsers.find(s => s.id === id);
    if (!staff) return;

    const newState = !staff.isDisabled;
    setIsLoading(true);
    try {
      await setStaffUserStatus(id, newState);

      setStaffUsers(prev => prev.map(s => {
        if (s.id === id) {
          onNotify(`Account for ${s.name} has been ${newState ? 'disabled' : 're-enabled'}.`, 'info');
          if (logAction) logAction('STATUS_CHANGE', 'STAFF', `${newState ? 'Disabled' : 'Enabled'} staff account: ${s.name}`);
          return { ...s, isDisabled: newState };
        }
        return s;
      }));
    } catch (err: any) {
      onNotify(err.message || "Failed to toggle staff status", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Direct Password Reset
  const handleResetPasswordDirect = async () => {
    if (!editingStaff || !newPasswordForReset) return;
    setIsLoading(true);
    try {
      await resetStaffUserPassword(editingStaff.id, newPasswordForReset);
      onNotify("Password reset successfully", "success");
      if (logAction) logAction('PASSWORD_RESET', 'STAFF', `Directly reset password for staff: ${editingStaff.name}`);
      setNewPasswordForReset('');
    } catch (err: any) {
      onNotify(err.message || "Failed to reset password", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // 1-Click Site Handover / Transfer Action
  const initiateTransfer = (staff: StaffUser) => {
    setTransferSourceStaff(staff);
    const availableTargets = staffUsers.filter(s => s.id !== staff.id && !s.isDisabled);
    setTransferTargetStaffId(availableTargets[0]?.id || '');
    setTransferMode('REPLACE');
    setIsTransferModalOpen(true);
  };

  const handleExecuteTransfer = async () => {
    if (!transferSourceStaff || !transferTargetStaffId) {
      onNotify("Please select a target staff member to receive the sites.", "error");
      return;
    }
    const targetStaff = staffUsers.find(s => s.id === transferTargetStaffId);
    if (!targetStaff) return;

    setIsTransferring(true);
    try {
      const sourceSiteIds = getStaffAssignedSiteIds(transferSourceStaff);
      if (sourceSiteIds.length === 0) {
        onNotify(`${transferSourceStaff.name} does not have any assigned sites to transfer.`, "warning");
        setIsTransferModalOpen(false);
        return;
      }

      const currentTargetSites = targetStaff.sitesManaged || [];
      const newTargetSites = Array.from(new Set([...currentTargetSites, ...sourceSiteIds]));

      // 1. Update Target Staff in Firestore
      await updateDoc(doc(db, 'staff_accounts', targetStaff.id), {
        sitesManaged: newTargetSites
      });

      // 2. If REPLACE mode, relieve source staff of these sites
      let newSourceSites: string[] = [];
      if (transferMode === 'REPLACE') {
        newSourceSites = (transferSourceStaff.sitesManaged || []).filter(id => !sourceSiteIds.includes(id));
        await updateDoc(doc(db, 'staff_accounts', transferSourceStaff.id), {
          sitesManaged: newSourceSites
        });
      }

      // 3. Update settings/sites
      const sitesDocRef = doc(db, SETTINGS_COLLECTION, 'sites');
      const sitesSnap = await getDoc(sitesDocRef);
      if (sitesSnap.exists()) {
        const currentSites: Site[] = sitesSnap.data().sites || [];
        const updatedSites = currentSites.map(s => {
          if (sourceSiteIds.includes(s.id)) {
            let sSupervisorIds = Array.isArray(s.supervisorIds) ? [...s.supervisorIds] : (s.supervisorId ? [s.supervisorId] : []);
            if (!sSupervisorIds.includes(targetStaff.id)) {
              sSupervisorIds.push(targetStaff.id);
            }
            if (transferMode === 'REPLACE') {
              sSupervisorIds = sSupervisorIds.filter(id => id !== transferSourceStaff.id);
            }
            return {
              ...s,
              supervisorId: transferMode === 'REPLACE' ? targetStaff.id : (s.supervisorId || targetStaff.id),
              supervisorIds: sSupervisorIds
            };
          }
          return s;
        });
        await updateDoc(sitesDocRef, { sites: updatedSites });
        if (setSites) {
          setSites(updatedSites);
        }
      }

      // 4. Update React state for staffUsers
      setStaffUsers(prev => prev.map(s => {
        if (s.id === targetStaff.id) {
          return { ...s, sitesManaged: newTargetSites };
        }
        if (transferMode === 'REPLACE' && s.id === transferSourceStaff.id) {
          return { ...s, sitesManaged: newSourceSites };
        }
        return s;
      }));

      const modeLabel = transferMode === 'REPLACE' ? 'reassigned exclusively' : 'shared as co-supervisor';
      onNotify(`Successfully transferred ${sourceSiteIds.length} site(s) from ${transferSourceStaff.name} to ${targetStaff.name} (${modeLabel}).`, 'success');
      if (logAction) {
        logAction('UPDATE', 'STAFF', `Transferred ${sourceSiteIds.length} sites from ${transferSourceStaff.name} to ${targetStaff.name} [Mode: ${transferMode}]`);
      }

      setIsTransferModalOpen(false);
      setTransferSourceStaff(null);
      setTransferTargetStaffId('');
    } catch (err: any) {
      onNotify(err.message || "Failed to transfer sites", "error");
    } finally {
      setIsTransferring(false);
    }
  };

  // Smart Delete Handler
  const initiateDelete = async (id: string) => {
    if (id === loggedInUserId) {
      onNotify("You cannot delete your own account while logged in.", "error");
      return;
    }

    setStaffToDelete(id);
    setIsCheckingLinks(true);
    setDeleteLinks({ sites: [], employees: [], submissions: [] });
    setIsConfirmModalOpen(true);

    try {
      const links: DeleteLinks = { sites: [], employees: [], submissions: [] };

      // 1. Check sites
      try {
        const sitesDocRef = doc(db, SETTINGS_COLLECTION, 'sites');
        const sitesSnap = await getDoc(sitesDocRef);
        if (sitesSnap.exists()) {
          const allSites: Site[] = sitesSnap.data().sites || [];
          allSites.forEach(site => {
            if (site.supervisorId === id || (Array.isArray(site.supervisorIds) && site.supervisorIds.includes(id))) {
              links.sites.push({ id: site.id, name: site.name });
            }
          });
        }
      } catch (_) { /* ignore */ }

      // 2. Check active employees
      try {
        const empQ = query(collection(db, 'employees'), where('supervisorId', '==', id));
        const empSnap = await getDocs(empQ);
        empSnap.forEach(d => links.employees.push({ id: d.id, name: d.data().name || d.id }));
      } catch (_) { /* ignore */ }

      // 3. Check onboarding submissions
      try {
        const subQ = query(collection(db, 'onboarding_submissions'), where('assignedStaffId', '==', id));
        const subSnap = await getDocs(subQ);
        subSnap.forEach(d => links.submissions.push({ id: d.id, name: d.data().employeeName || d.id }));
      } catch (_) { /* ignore */ }

      setDeleteLinks(links);
    } finally {
      setIsCheckingLinks(false);
    }
  };

  const confirmDelete = async (mode: 'just-user' | 'clean-links') => {
    if (!staffToDelete) return;

    const staffObj = staffUsers.find(s => s.id === staffToDelete);
    const staffName = staffObj?.name || 'Unknown';
    setIsLoading(true);
    try {
      // 1. Move staff user snapshot to Universal Recycle Bin first
      const binId = await moveToRecycleBin({
        itemType: 'STAFF',
        name: staffName,
        originalId: staffToDelete,
        originalCollection: 'staff_accounts',
        data: staffObj || { id: staffToDelete, name: staffName },
        deletedByUid: loggedInUserId,
        deletedByName: 'Super Admin',
        metadata: {
          linkedSites: deleteLinks.sites.map(s => s.id),
          linkedEmployeesCount: deleteLinks.employees.length
        }
      });

      // 2. Safely unassign links so sites and employees are NEVER destroyed
      if (deleteLinks.sites.length > 0) {
        try {
          const sitesDocRef = doc(db, SETTINGS_COLLECTION, 'sites');
          const sitesSnap = await getDoc(sitesDocRef);
          if (sitesSnap.exists()) {
            const allSites: Site[] = sitesSnap.data().sites || [];
            const updated = allSites.map(site => {
              let sSupervisorIds = Array.isArray(site.supervisorIds) ? site.supervisorIds.filter(id => id !== staffToDelete) : [];
              let sSupervisorId = site.supervisorId === staffToDelete ? (sSupervisorIds[0] || '') : site.supervisorId;
              return {
                ...site,
                supervisorId: sSupervisorId,
                supervisorIds: sSupervisorIds
              };
            });
            await updateDoc(sitesDocRef, { sites: updated });
            if (setSites) setSites(updated);
          }
        } catch (e) {
          console.warn('Could not clean site supervisor links:', e);
        }
      }

      if (deleteLinks.employees.length > 0) {
        try {
          const empQ = query(collection(db, 'employees'), where('supervisorId', '==', staffToDelete));
          const empSnap = await getDocs(empQ);
          const batch = writeBatch(db);
          empSnap.forEach(d => {
            batch.update(d.ref, { supervisorId: '' });
          });
          await batch.commit();
        } catch (e) {
          console.warn('Could not clean employee supervisor links:', e);
        }
      }

      if (deleteLinks.submissions.length > 0) {
        try {
          const subQ = query(collection(db, 'onboarding_submissions'), where('assignedStaffId', '==', staffToDelete));
          const subSnap = await getDocs(subQ);
          const batch = writeBatch(db);
          subSnap.forEach(d => {
            batch.update(d.ref, { assignedStaffId: '' });
          });
          await batch.commit();
        } catch (e) {
          console.warn('Could not clean onboarding submissions links:', e);
        }
      }

      // 3. Mark account as deleted/disabled in staffService
      try {
        await deleteStaffUser(staffToDelete);
      } catch (cfErr: any) {
        console.warn("deleteStaffUser Cloud Function warning:", cfErr);
      }

      // Always guarantee Firestore cleanup in case user was mock or missing from Firebase Auth
      await deleteDoc(doc(db, 'staff_accounts', staffToDelete)).catch(() => {});
      await deleteDoc(doc(db, 'users', staffToDelete)).catch(() => {});

      const deletedStaffCopy = staffObj ? { ...staffObj } : null;
      setStaffUsers(prev => prev.filter(s => s.id !== staffToDelete));

      if (logAction) {
        logAction('DELETE', 'STAFF', `Moved staff account to Recycle Bin: ${staffName}`);
      }

      // 4. Trigger Instant 10s Undo Toast
      showUndoToast({
        message: `Staff "${staffName}" moved to Recycle Bin`,
        recycleBinId: binId,
        onUndo: () => {
          if (deletedStaffCopy) {
            setStaffUsers(prev => [...prev.filter(s => s.id !== deletedStaffCopy.id), deletedStaffCopy]);
          }
        }
      });
    } catch (err: any) {
      onNotify(err.message || "Failed to delete staff account", "error");
    } finally {
      setIsLoading(false);
      setIsConfirmModalOpen(false);
      setStaffToDelete(null);
      setDeleteLinks({ sites: [], employees: [], submissions: [] });
    }
  };

  const handleResendActivation = async (staffEmail: string) => {
    try {
      await sendPasswordResetEmail(auth, staffEmail);
      onNotify(`Activation/Reset email sent to ${staffEmail}`, 'success');
    } catch (err: any) {
      onNotify(`Failed to send email: ${err.message}`, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header with Title & Add Staff Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
        <div>
          <h2 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
            <Users size={20} className="text-blue-600" /> Staff Account Management
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage staff credentials, operational site assignments, and supervisory handovers.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setUsername('');
            setEmail('');
            setPassword('');
            setName('');
            setCreateSelectedSites([]);
            setCreateSiteSearch('');
            setIsCreateModalOpen(true);
          }}
          className="font-bold flex items-center justify-center gap-2 shadow-xs py-2 px-4 whitespace-nowrap"
        >
          <UserPlus size={16} />
          Create Staff Account
        </Button>
      </div>

      {/* 2. Operational Overview Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Staff</p>
            <p className="text-2xl font-black text-gray-900 mt-1">{stats.totalStaff}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Users size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Field Officers</p>
            <p className="text-2xl font-black text-indigo-900 mt-1">{stats.activeFieldOfficers}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Building size={20} />
          </div>
        </div>

        <div className={`bg-white p-4 rounded-xl border shadow-xs flex items-center justify-between ${stats.unassignedSites > 0 ? 'border-amber-300 bg-amber-50/40' : 'border-gray-200'}`}>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Unassigned Sites</p>
            <p className={`text-2xl font-black mt-1 ${stats.unassignedSites > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
              {stats.unassignedSites}
            </p>
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${stats.unassignedSites > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-600'}`}>
            <AlertTriangle size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Disabled Staff</p>
            <p className="text-2xl font-black text-gray-700 mt-1">{stats.disabledAccounts}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center font-bold">
            <UserX size={20} />
          </div>
        </div>
      </div>

      {/* 3. Search, Filter Toolbar & Staff Table */}
      <div className="bg-white shadow-xs rounded-xl border border-gray-200 overflow-hidden">
        {/* Search and Filters Bar */}
        <div className="p-4 bg-gray-50/70 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, username, or email..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Role Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-gray-500">Role:</span>
              <select
                value={filterRoleId}
                onChange={e => setFilterRoleId(e.target.value)}
                className="text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All Roles</option>
                {roles.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            {/* Site Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-gray-500">Site:</span>
              <select
                value={filterSiteId}
                onChange={e => setFilterSiteId(e.target.value)}
                className="text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[160px]"
              >
                <option value="ALL">All Sites</option>
                {activeSites.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-gray-500">Status:</span>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value as any)}
                className="text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="DISABLED">Disabled</option>
              </select>
            </div>

            {(searchTerm || filterRoleId !== 'ALL' || filterSiteId !== 'ALL' || filterStatus !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setFilterRoleId('ALL');
                  setFilterSiteId('ALL');
                  setFilterStatus('ALL');
                }}
                className="text-xs text-red-600 hover:text-red-800 font-semibold px-2 py-1"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Staff Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Staff Member</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Username</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Assigned Sites</th>
                <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredStaffUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 italic">
                    No staff accounts match your current filters.
                  </td>
                </tr>
              ) : (
                filteredStaffUsers.map(staff => {
                  const role = roles.find(r => r.id === staff.roleId);
                  const isGlobal = hasGlobalSiteScope(staff.roleId);
                  const assignedSites = getStaffAssignedSites(staff);

                  return (
                    <tr key={staff.id} className={`hover:bg-gray-50/80 transition-colors ${staff.isDisabled ? 'bg-gray-50/60 opacity-70' : ''}`}>
                      {/* Name & Avatar */}
                      <td className="px-5 py-3.5 whitespace-nowrap font-medium text-gray-900">
                        <div className="flex items-center">
                          <div className={`w-9 h-9 ${staff.isDisabled ? 'bg-gray-200 text-gray-500' : 'bg-blue-100 text-blue-700'} rounded-full flex items-center justify-center mr-3 font-bold text-xs uppercase shadow-2xs`}>
                            {staff.name.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className={`text-sm font-bold ${staff.isDisabled ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                                {staff.name}
                              </span>
                              {staff.id === loggedInUserId && (
                                <span className="text-[9px] bg-blue-100 text-blue-800 font-black px-1.5 py-0.2 rounded uppercase tracking-wider">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-gray-500">{staff.email}</span>
                          </div>
                        </div>
                      </td>

                      {/* Username */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs font-mono text-gray-600">
                        {staff.username}
                      </td>

                      {/* Role */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                          staff.roleId === 'role-super-admin'
                            ? 'bg-purple-100 text-purple-800'
                            : staff.roleId === 'role-manager'
                            ? 'bg-indigo-100 text-indigo-800'
                            : staff.roleId === 'role-field-officer'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {role?.name || 'Unknown'}
                        </span>
                      </td>

                      {/* Assigned Sites */}
                      <td className="px-5 py-3.5">
                        {isGlobal ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                            🌐 All Sites (Global Scope)
                          </span>
                        ) : assignedSites.length === 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                            ⚠️ No Sites Assigned
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1 items-center max-w-xs">
                            {assignedSites.slice(0, 3).map(site => (
                              <span
                                key={site.id}
                                className="text-[10px] font-semibold bg-gray-100 text-gray-800 px-2 py-0.5 rounded border border-gray-200"
                                title={site.name}
                              >
                                {site.name}
                              </span>
                            ))}
                            {assignedSites.length > 3 && (
                              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                +{assignedSites.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-3.5 whitespace-nowrap text-center">
                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${
                          staff.isDisabled ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {staff.isDisabled ? 'Disabled' : 'Active'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 whitespace-nowrap text-right space-x-1">
                        {/* 1-Click Handover Tool */}
                        <button
                          type="button"
                          onClick={() => initiateTransfer(staff)}
                          disabled={isGlobal || assignedSites.length === 0 || staff.isDisabled}
                          className={`p-1.5 rounded transition-colors ${
                            isGlobal || assignedSites.length === 0 || staff.isDisabled
                              ? 'text-gray-300 cursor-not-allowed'
                              : 'text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50'
                          }`}
                          title={
                            isGlobal
                              ? "Global scope roles cannot transfer individual sites"
                              : assignedSites.length === 0
                              ? "No sites assigned to transfer"
                              : "Transfer / Handover Sites"
                          }
                        >
                          <ArrowLeftRight size={16} />
                        </button>

                        {/* Edit Staff */}
                        <button
                          type="button"
                          onClick={() => handleEditStaff(staff)}
                          className="p-1.5 rounded text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors"
                          title="Edit Staff & Sites"
                        >
                          <Edit3 size={16} />
                        </button>

                        {/* Resend Activation */}
                        <button
                          type="button"
                          onClick={() => handleResendActivation(staff.email)}
                          className="p-1.5 rounded text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 transition-colors"
                          title="Resend Activation / Reset Email"
                        >
                          <Mail size={16} />
                        </button>

                        {/* Toggle Status */}
                        <button
                          type="button"
                          onClick={() => toggleStaffStatus(staff.id)}
                          className={`p-1.5 rounded transition-colors ${
                            staff.isDisabled
                              ? 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                              : 'text-amber-600 hover:text-amber-800 hover:bg-amber-50'
                          }`}
                          title={staff.isDisabled ? "Enable Account" : "Disable Account"}
                        >
                          {staff.isDisabled ? <UserCheck size={16} /> : <UserX size={16} />}
                        </button>

                        {/* Delete Account */}
                        <button
                          type="button"
                          onClick={() => initiateDelete(staff.id)}
                          className="p-1.5 rounded text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                          title="Delete Staff Permanently"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Create New Staff Account Modal (Pop-up upon clicking Add Staff Account) */}
      {isCreateModalOpen && (
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Create New Staff Account"
          footer={
            <div className="flex justify-end gap-2">
              <Button 
                variant="secondary" 
                onClick={() => setIsCreateModalOpen(false)} 
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button 
                variant="primary" 
                onClick={handleAddStaff} 
                disabled={isLoading} 
                className="font-bold flex items-center"
              >
                {isLoading ? <Loader2 size={16} className="animate-spin mr-1.5" /> : <UserPlus size={16} className="mr-1.5" />}
                {isLoading ? 'Creating...' : 'Create Account'}
              </Button>
            </div>
          }
        >
          <form onSubmit={handleAddStaff} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input 
                label="Full Name" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                placeholder="e.g. Devender Kumar" 
                required 
              />
              <Input 
                label="Username" 
                value={username} 
                onChange={e => setUsername(e.target.value)} 
                placeholder="login handle" 
                required 
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input 
                label="Email" 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                placeholder="e.g. devender@udf.in" 
                required 
              />
              <Input 
                label="Initial Password" 
                type="password" 
                showPasswordToggle 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                placeholder="password" 
                required 
              />
            </div>

            <div>
              <Select label="Assign Role" value={roleId} onChange={e => setRoleId(e.target.value)} required>
                {roles.filter(r => r.id !== 'role-super-admin' && r.name.toLowerCase() !== 'super admin' && r.name.toLowerCase() !== 'superadmin').map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </Select>
            </div>

            {/* Multi-Site Assignment for New Staff */}
            <div className="pt-2 border-t border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin size={14} className="text-indigo-600" />
                  Assign Operational Sites ({createSelectedSites.length} selected)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Search sites..."
                    value={createSiteSearch}
                    onChange={e => setCreateSiteSearch(e.target.value)}
                    className="px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 w-36"
                  />
                  <button
                    type="button"
                    onClick={() => setCreateSelectedSites(activeSites.map(s => s.id))}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-800"
                  >
                    All
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={() => setCreateSelectedSites([])}
                    className="text-[11px] font-semibold text-gray-500 hover:text-gray-700"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {hasGlobalSiteScope(roleId) && (
                <p className="text-[11px] text-indigo-700 bg-indigo-50/60 p-2 rounded mb-2 border border-indigo-100">
                  ℹ️ This role has <strong>Organization-Wide Scope</strong>. The officer has access to all sites automatically. Specific site selections here are optional.
                </p>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-44 overflow-y-auto p-2 bg-gray-50 rounded-lg border border-gray-200">
                {activeSites
                  .filter(s => !createSiteSearch || s.name.toLowerCase().includes(createSiteSearch.toLowerCase()))
                  .map(site => {
                    const isChecked = createSelectedSites.includes(site.id);
                    return (
                      <label
                        key={site.id}
                        className={`flex items-center gap-1.5 p-1.5 rounded text-xs cursor-pointer select-none transition-colors ${
                          isChecked ? 'bg-indigo-50 text-indigo-900 font-bold border border-indigo-200' : 'hover:bg-gray-100 text-gray-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setCreateSelectedSites(prev => prev.filter(id => id !== site.id));
                            } else {
                              setCreateSelectedSites(prev => [...prev, site.id]);
                            }
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                        />
                        <span className="truncate" title={site.name}>{site.name}</span>
                      </label>
                    );
                  })}
                {activeSites.length === 0 && (
                  <p className="col-span-full text-xs text-gray-500 italic p-2">No active sites found.</p>
                )}
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* 5. Edit Staff Modal (with Multi-Site Assignment) */}
      {isEditModalOpen && editingStaff && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title={`Edit Staff Account: ${editingStaff.name}`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setIsEditModalOpen(false)} className="mr-2">
                Cancel
              </Button>
              <Button variant="primary" onClick={saveStaffEdit} disabled={isLoading} className="font-bold">
                {isLoading ? <Loader2 size={16} className="animate-spin mr-1.5" /> : null}
                Save Changes
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="Full Name"
                value={editingStaff.name}
                onChange={e => setEditingStaff({ ...editingStaff, name: e.target.value })}
              />
              <Input
                label="Username"
                value={editingStaff.username}
                onChange={e => setEditingStaff({ ...editingStaff, username: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="Email"
                type="email"
                value={editingStaff.email}
                disabled
              />
              <Select
                label="Role"
                value={editingStaff.roleId}
                onChange={e => setEditingStaff({ ...editingStaff, roleId: e.target.value })}
              >
                {roles.filter(r => r.id !== 'role-super-admin' && r.name.toLowerCase() !== 'super admin' && r.name.toLowerCase() !== 'superadmin').map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </Select>
            </div>

            {/* Multi-Site Selector in Edit Modal */}
            <div className="pt-2 border-t border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin size={14} className="text-indigo-600" />
                  Assigned Operational Sites ({(editingStaff.sitesManaged || []).length} selected)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Search sites..."
                    value={editSiteSearch}
                    onChange={e => setEditSiteSearch(e.target.value)}
                    className="px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 w-36"
                  />
                  <button
                    type="button"
                    onClick={() => setEditingStaff({ ...editingStaff, sitesManaged: activeSites.map(s => s.id) })}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-800"
                  >
                    All
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={() => setEditingStaff({ ...editingStaff, sitesManaged: [] })}
                    className="text-[11px] font-semibold text-gray-500 hover:text-gray-700"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {hasGlobalSiteScope(editingStaff.roleId) && (
                <p className="text-[11px] text-indigo-700 bg-indigo-50/60 p-2 rounded mb-2 border border-indigo-100">
                  ℹ️ This role has <strong>Organization-Wide Scope</strong>. The officer has access to all sites automatically.
                </p>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 bg-gray-50 rounded-lg border border-gray-200">
                {activeSites
                  .filter(s => !editSiteSearch || s.name.toLowerCase().includes(editSiteSearch.toLowerCase()))
                  .map(site => {
                    const isChecked = (editingStaff.sitesManaged || []).includes(site.id);
                    return (
                      <label
                        key={site.id}
                        className={`flex items-center gap-1.5 p-1.5 rounded text-xs cursor-pointer select-none transition-colors ${
                          isChecked ? 'bg-indigo-50 text-indigo-900 font-bold border border-indigo-200' : 'hover:bg-gray-100 text-gray-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            const current = editingStaff.sitesManaged || [];
                            const updated = isChecked
                              ? current.filter(id => id !== site.id)
                              : [...current, site.id];
                            setEditingStaff({ ...editingStaff, sitesManaged: updated });
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                        />
                        <span className="truncate" title={site.name}>{site.name}</span>
                      </label>
                    );
                  })}
                {activeSites.length === 0 && (
                  <p className="col-span-full text-xs text-gray-500 italic p-2">No active sites found.</p>
                )}
              </div>
            </div>

            {/* Direct Password Reset Section */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
              <div>
                <p className="text-xs font-bold text-gray-700">Direct Password Reset</p>
                <p className="text-[11px] text-gray-500">Instantly update the password for this staff member in Firebase Auth.</p>
              </div>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Input
                    label="New Password"
                    type="password"
                    showPasswordToggle
                    value={newPasswordForReset}
                    onChange={e => setNewPasswordForReset(e.target.value)}
                    placeholder="Enter new password"
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleResetPasswordDirect}
                  disabled={isLoading || !newPasswordForReset}
                  className="h-[38px] text-xs py-1 px-3 font-semibold"
                >
                  Reset Password
                </Button>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 flex justify-between items-center text-xs text-gray-400">
              <span className="font-mono">UID: {editingStaff.id}</span>
            </div>
          </div>
        </Modal>
      )}

      {/* 6. 1-Click Site Handover / Transfer Modal */}
      {isTransferModalOpen && transferSourceStaff && (
        <Modal
          isOpen={isTransferModalOpen}
          onClose={() => {
            setIsTransferModalOpen(false);
            setTransferSourceStaff(null);
          }}
          title={`Handover / Transfer Sites from ${transferSourceStaff.name}`}
          footer={
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsTransferModalOpen(false);
                  setTransferSourceStaff(null);
                }}
                disabled={isTransferring}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleExecuteTransfer}
                disabled={isTransferring || !transferTargetStaffId}
                className="font-bold bg-indigo-600 hover:bg-indigo-700"
              >
                {isTransferring ? <Loader2 size={16} className="animate-spin mr-1.5" /> : <ArrowLeftRight size={16} className="mr-1.5" />}
                Confirm Transfer
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            {/* Sites to transfer */}
            <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl">
              <p className="text-xs font-bold text-indigo-950 mb-1">
                Currently Assigned Sites to Transfer ({getStaffAssignedSites(transferSourceStaff).length}):
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {getStaffAssignedSites(transferSourceStaff).map(site => (
                  <span
                    key={site.id}
                    className="text-xs font-bold bg-white text-indigo-900 px-2.5 py-1 rounded-md border border-indigo-200 shadow-2xs"
                  >
                    📍 {site.name}
                  </span>
                ))}
              </div>
            </div>

            {/* Target Staff Member Picker */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Select Target Staff Member to Receive These Sites:
              </label>
              <select
                value={transferTargetStaffId}
                onChange={e => setTransferTargetStaffId(e.target.value)}
                className="w-full text-xs bg-white border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                {staffUsers
                  .filter(s => s.id !== transferSourceStaff.id && !s.isDisabled)
                  .map(s => {
                    const r = roles.find(role => role.id === s.roleId);
                    return (
                      <option key={s.id} value={s.id}>
                        {s.name} ({r?.name || 'Staff'}) — {s.email}
                      </option>
                    );
                  })}
              </select>
            </div>

            {/* Transfer Mode Options */}
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
              <p className="text-xs font-bold text-gray-800">Choose Transfer Mode:</p>
              <label className="flex items-start gap-2 text-xs text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="transferMode"
                  value="REPLACE"
                  checked={transferMode === 'REPLACE'}
                  onChange={() => setTransferMode('REPLACE')}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="font-bold text-gray-900">Replace Outgoing Officer (Exclusive Handover)</span>
                  <p className="text-[11px] text-gray-500">
                    {transferSourceStaff.name} is relieved of these sites. The new officer takes over complete responsibility.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2 text-xs text-gray-700 cursor-pointer pt-2 border-t border-gray-200">
                <input
                  type="radio"
                  name="transferMode"
                  value="CO_SUPERVISOR"
                  checked={transferMode === 'CO_SUPERVISOR'}
                  onChange={() => setTransferMode('CO_SUPERVISOR')}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="font-bold text-gray-900">Add as Co-Supervisor (Shared Access)</span>
                  <p className="text-[11px] text-gray-500">
                    Both {transferSourceStaff.name} and the new officer will simultaneously manage these sites (ideal for Day & Night shifts).
                  </p>
                </div>
              </label>
            </div>
          </div>
        </Modal>
      )}

      {/* 7. Smart Delete Confirmation Modal */}
      {isConfirmModalOpen && (
        <Modal
          isOpen={isConfirmModalOpen}
          onClose={() => { setIsConfirmModalOpen(false); setStaffToDelete(null); }}
          title="Delete Staff Account"
          footer={
            <div className="flex justify-end flex-wrap gap-2">
              <Button variant="secondary" onClick={() => { setIsConfirmModalOpen(false); setStaffToDelete(null); }} disabled={isLoading}>
                Cancel
              </Button>
              {!isCheckingLinks && hasLinks && (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const staffId = staffToDelete;
                      setIsConfirmModalOpen(false);
                      setStaffToDelete(null);
                      if (staffId) {
                        const targetStaff = staffUsers.find(s => s.id === staffId);
                        if (targetStaff) initiateTransfer(targetStaff);
                      }
                    }}
                    disabled={isLoading}
                    className="border border-indigo-300 text-indigo-700 hover:bg-indigo-50 text-xs py-1.5 px-3"
                  >
                    Transfer Sites First
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => confirmDelete('clean-links')}
                    disabled={isLoading}
                    className="text-xs py-1.5 px-3"
                  >
                    {isLoading ? <Loader2 size={14} className="animate-spin mr-1" /> : <Trash2 size={14} className="mr-1" />}
                    Delete to Recycle Bin (Keep Sites Safe)
                  </Button>
                </>
              )}
              {!isCheckingLinks && !hasLinks && (
                <Button
                  variant="danger"
                  onClick={() => confirmDelete('just-user')}
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 size={14} className="animate-spin mr-1" /> : <Trash2 size={14} className="mr-1" />}
                  Delete to Recycle Bin
                </Button>
              )}
            </div>
          }
        >
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-amber-100 text-amber-700 rounded-full mt-0.5">
                <AlertTriangle size={20} />
              </div>
              <div>
                <p className="text-gray-900 font-bold">Safe Recycle Bin Deletion</p>
                <p className="text-gray-600 text-xs mt-1">
                  Deleting will move this staff account to the <strong>Recycle Bin</strong> for 30 days. All client sites and employee profiles remain <strong>100% safe</strong> (sites will simply be marked as unassigned).
                </p>
              </div>
            </div>

            {/* Link Check Results */}
            {isCheckingLinks ? (
              <div className="flex items-center space-x-2 text-gray-500 text-sm py-2">
                <Loader2 size={16} className="animate-spin" />
                <span>Checking for linked records…</span>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Link Check Results</p>
                </div>
                <div className="divide-y divide-gray-100">
                  {/* Sites */}
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm text-gray-700">Site Supervisor</span>
                    {deleteLinks.sites.length === 0 ? (
                      <span className="flex items-center text-green-600 text-xs font-medium"><CheckCircle size={13} className="mr-1" />Not linked</span>
                    ) : (
                      <span className="flex items-center text-amber-600 text-xs font-medium">
                        <AlertTriangle size={13} className="mr-1" />
                        {deleteLinks.sites.length} site(s): {deleteLinks.sites.map(s => s.name).join(', ')}
                      </span>
                    )}
                  </div>
                  {/* Employees */}
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm text-gray-700">Assigned Employees</span>
                    {deleteLinks.employees.length === 0 ? (
                      <span className="flex items-center text-green-600 text-xs font-medium"><CheckCircle size={13} className="mr-1" />None</span>
                    ) : (
                      <span className="flex items-center text-amber-600 text-xs font-medium">
                        <AlertTriangle size={13} className="mr-1" />
                        {deleteLinks.employees.length} employee(s)
                      </span>
                    )}
                  </div>
                  {/* Submissions */}
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm text-gray-700">Onboarding Submissions</span>
                    {deleteLinks.submissions.length === 0 ? (
                      <span className="flex items-center text-green-600 text-xs font-medium"><CheckCircle size={13} className="mr-1" />None</span>
                    ) : (
                      <span className="flex items-center text-amber-600 text-xs font-medium">
                        <AlertTriangle size={13} className="mr-1" />
                        {deleteLinks.submissions.length} submission(s)
                      </span>
                    )}
                  </div>
                </div>
                {hasLinks && (
                  <div className="px-4 py-2 bg-amber-50 border-t border-amber-100">
                    <p className="text-xs text-amber-700 space-y-1">
                      <strong>Delete Account Only</strong> — Deletes only the staff account. Linked records remain unchanged (may cause orphan references).<br />
                      <strong>Delete & Clean Links</strong> — Deletes the staff account and unassigns them from all linked sites, employees, and submissions.<br />
                      <strong>Delete + Entire Records</strong> — Deletes the staff account and completely deletes all associated sites, employees, and submissions.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AdminStaffManagementPage;

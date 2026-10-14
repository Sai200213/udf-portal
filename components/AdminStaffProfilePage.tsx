
import React, { useMemo } from 'react';
import { User, Site, SubmittedFormData, SubmissionStatus, Role, StaffUser, Permission } from '../types';
import { Shield, MapPin, Users, Building, Info, Star, GitBranch, ChevronRight } from 'lucide-react';
import ProfileAvatar from './ProfileAvatar';

interface AdminStaffProfilePageProps {
  authUser: User | null;
  sites: Site[];
  submittedForms: SubmittedFormData[];
  roles: Role[];
  staffUsers: StaffUser[];
}

const AdminStaffProfilePage: React.FC<AdminStaffProfilePageProps> = ({
  authUser,
  sites,
  submittedForms,
  roles,
  staffUsers
}) => {
  const staffDetails = useMemo(() => {
    return staffUsers.find(s => s.id === authUser?.id);
  }, [staffUsers, authUser]);

  const userRole = useMemo(() => {
    return roles.find(r => r.id === authUser?.roleId);
  }, [roles, authUser]);

  const isSuperAdmin = authUser?.roleId === 'role-super-admin' || 
    authUser?.id === 'super-admin' || 
    userRole?.id === 'role-super-admin' || 
    (userRole?.name ? userRole.name.toLowerCase().includes('super admin') : false);

  const hasPermission = (p: Permission) => {
    if (isSuperAdmin) return true;
    return userRole?.permissions.includes(p) || false;
  };

  const approvedEmployees = useMemo(() => {
    return submittedForms.filter(f => f.status === SubmissionStatus.APPROVED);
  }, [submittedForms]);

  const getSiteHeadcount = (siteName: string) => {
    return approvedEmployees.filter(emp => {
      if (!emp || !emp.data) return false;
      const sections = emp.originalFormSections || [];
      const unitField = sections
        .flatMap(s => s.fields || [])
        .find(f => f && f.label && (f.label.toLowerCase().includes('unit') || f.label.toLowerCase().includes('facility')));

      return unitField && String(emp.data[unitField.id] || '').toLowerCase().trim() === siteName.toLowerCase().trim();
    }).length;
  };

  const assignedSites = useMemo(() => {
    return sites.filter(s => s.supervisorId === authUser?.id && s.status === 'Active');
  }, [sites, authUser]);

  const totalPersonnelManagedDirectly = useMemo(() => {
    return assignedSites.reduce((acc, site) => acc + getSiteHeadcount(site.name), 0);
  }, [assignedSites, approvedEmployees]);

  // Hierarchy Logic
  const reportingHierarchy = useMemo(() => {
    if (!hasPermission(Permission.VIEW_TEAM_HIERARCHY)) return null;

    // Field Officers are usually role-field-officer or similar
    const fieldOfficers = staffUsers.filter(s => {
      const role = roles.find(r => r.id === s.roleId);
      return role?.name.toLowerCase().includes('field officer') || role?.id === 'role-field-officer';
    });

    return fieldOfficers.map(fo => {
      const foSites = sites.filter(s => s.supervisorId === fo.id && s.status === 'Active');
      const foHeadcount = foSites.reduce((acc, site) => acc + getSiteHeadcount(site.name), 0);
      return {
        ...fo,
        sites: foSites,
        headcount: foHeadcount
      };
    });
  }, [hasPermission, staffUsers, roles, sites, approvedEmployees]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Profile Header Card */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        <div className="bg-gradient-to-r from-gray-800 to-blue-900 h-32 relative">
          <div className="absolute -bottom-12 left-8">
            <ProfileAvatar
              userId={authUser?.id || ''}
              userName={authUser?.name || 'User'}
              currentPhotoURL={authUser?.profilePhotoURL}
              size={80}
              editable={true}
              collection="staffUsers"
            />
          </div>
        </div>
        <div className="pt-16 pb-8 px-8 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <h2 className="text-3xl font-black text-gray-900">{authUser?.name || 'Staff Member'}</h2>
            <div className="flex items-center space-x-3 mt-1">
              <span className="flex items-center text-sm font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full">
                <Shield size={14} className="mr-1.5" />
                {userRole?.name || (isSuperAdmin ? 'Super Administrator' : 'Staff')}
              </span>
              <span className="text-gray-400 text-sm font-medium">@{staffDetails?.username || 'admin'}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-center min-w-[120px]">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Assigned Sites</p>
              <p className="text-2xl font-black text-gray-800">{assignedSites.length}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-center min-w-[120px]">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Total Guards</p>
              <p className="text-2xl font-black text-blue-600">{totalPersonnelManagedDirectly}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Team Hierarchy Section (For Managers) */}
      {reportingHierarchy && (
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <h3 className="text-xl font-bold text-gray-800 flex items-center mb-6">
            <GitBranch size={24} className="mr-2 text-indigo-600" />
            Field Operations Hierarchy
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reportingHierarchy.length === 0 ? (
              <div className="col-span-full py-6 text-center text-gray-400 italic text-sm">No Field Officers registered in the system.</div>
            ) : (
              reportingHierarchy.map(fo => (
                <div key={fo.id} className="p-4 rounded-lg border border-gray-100 bg-gray-50 hover:border-indigo-200 transition-colors">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold mr-3">
                        {fo.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-800">{fo.name}</p>
                        <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-tight">Field Officer</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-indigo-700 leading-none">{fo.headcount}</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase">Total Guards</p>
                    </div>
                  </div>

                  <div className="space-y-1 mt-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Active Sites ({fo.sites.length})</p>
                    {fo.sites.map(site => (
                      <div key={site.id} className="flex items-center justify-between text-xs py-1.5 px-2 bg-white rounded border border-gray-100">
                        <span className="text-gray-600 font-medium">{site.name}</span>
                        <span className="text-indigo-600 font-bold">{getSiteHeadcount(site.name)} Personnel</span>
                      </div>
                    ))}
                    {fo.sites.length === 0 && <p className="text-xs text-gray-400 italic">No sites assigned</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Personal Portfolio Section */}
      <div>
        <h3 className="text-xl font-bold text-gray-800 flex items-center mb-4">
          <Building size={24} className="mr-2 text-blue-600" />
          Your Direct Site Portfolio
        </h3>

        {assignedSites.length === 0 ? (
          <div className="bg-white p-10 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
            <Info size={40} className="text-gray-300 mb-2" />
            <h4 className="text-md font-bold text-gray-700">No Direct Assignments</h4>
            <p className="text-gray-400 text-xs mt-1">
              You do not have any sites assigned directly to your account.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {assignedSites.map(site => {
              const headcount = getSiteHeadcount(site.name);
              return (
                <div key={site.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                      <Building size={24} />
                    </div>
                    <div className="flex items-center space-x-1 text-yellow-500 bg-yellow-50 px-2 py-1 rounded-full border border-yellow-100">
                      <Star size={12} fill="currentColor" />
                      <span className="text-[10px] font-bold uppercase">In-Charge</span>
                    </div>
                  </div>
                  <h4 className="text-lg font-bold text-gray-900">{site.name}</h4>
                  <p className="text-sm text-gray-500 flex items-center mt-1">
                    <MapPin size={14} className="mr-1" /> {site.location}
                  </p>
                  <div className="mt-6 pt-4 border-t border-gray-50">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Site Headcount</p>
                    <p className="text-2xl font-black text-gray-800 flex items-center">
                      <Users size={20} className="mr-2 text-blue-600" />
                      {headcount}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Access Info Banner */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 flex items-start space-x-4">
        <Info className="text-blue-600 flex-shrink-0 mt-1" size={24} />
        <div>
          <h4 className="text-blue-900 font-bold">Staff Access Information</h4>
          <p className="text-blue-800 text-sm mt-1 leading-relaxed">
            As a {userRole?.name || 'Staff Member'}, your access level allows you to manage specific HR modules assigned to your role.
            Any sites shown above are those where you have been formally designated as the Supervisor or In-Charge.
            If you believe there is a discrepancy in your portfolio, please reach out to the Super Administrator.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminStaffProfilePage;



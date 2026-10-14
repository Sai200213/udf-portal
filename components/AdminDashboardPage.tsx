import React, { useMemo, useState } from 'react';
import { User, Site, SubmittedFormData, LeaveRequest, AccountUpdateRequest, SubmissionStatus, RequestStatus, Role, Permission } from '../types';
import { AppView } from '../App';
import { Users, CalendarCheck, UserCheck, LayoutDashboard, Shield, AlertCircle, ArrowRight, UserPlus, UserMinus, FileText, Settings, Database, ServerCrash } from 'lucide-react';
import { useData } from '../src/contexts/DataContext';
import Button from './common/Button';

interface AdminDashboardPageProps {
    authUser: User | null;
    sites: Site[];
    submittedForms: SubmittedFormData[];
    leaveRequests: LeaveRequest[];
    accountUpdateRequests: AccountUpdateRequest[];
    navigateTo: (view: AppView) => void;
    roles: Role[];
    userRole?: Role;
    isSuperAdmin: boolean;
}

const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({
    authUser,
    sites,
    submittedForms,
    leaveRequests,
    accountUpdateRequests,
    navigateTo,
    roles,
    userRole,
    isSuperAdmin
}) => {
    const { stats, dashboardAnalytics, allowedSiteIds } = useData();

    const mySitesCount = useMemo(() => {
        return sites.filter(s => s.status === 'Active' && (isSuperAdmin || (allowedSiteIds || []).includes(s.id))).length;
    }, [sites, isSuperAdmin, allowedSiteIds]);

    const hasPermission = (permission: Permission) => {
        if (isSuperAdmin) return true;
        if (authUser?.permissionOverrides?.[permission] === true) return true;
        if (authUser?.permissionOverrides?.[permission] === false) return false;
        return userRole?.permissions.includes(permission) || false;
    };

    const hasViewScopeAll = isSuperAdmin ||
        hasPermission(Permission.SUBMISSIONS_VIEW_SCOPE_ALL) ||
        hasPermission(Permission.EMPLOYEES_VIEW_SCOPE_ALL);

    const isUnassignedStaff = !hasViewScopeAll && (!allowedSiteIds || allowedSiteIds.length === 0);

    const pendingSubmissionsCount = isUnassignedStaff ? 0 : stats.pendingSubmissions;
    const pendingLeavesCount = isUnassignedStaff ? 0 : stats.pendingLeaves;
    const pendingUpdatesCount = isUnassignedStaff ? 0 : stats.pendingUpdates;
    const activeEmployeesCount = isUnassignedStaff ? 0 : stats.activeEmployees;


    const showSubmissions = hasPermission(Permission.SUBMISSIONS_VIEW);
    const showLeaves = hasPermission(Permission.LEAVES_VIEW);
    const showUpdates = hasPermission(Permission.ACCOUNT_UPDATES_VIEW);
    const showEmployees = hasPermission(Permission.EMPLOYEES_VIEW);
    const showResignations = hasPermission(Permission.RESIGNATIONS_VIEW);

    const showIncompleteProfiles = showEmployees && hasPermission(Permission.EMPLOYEES_TAB_PENDING);
    const showActiveEmployeesStats = showEmployees && hasPermission(Permission.EMPLOYEES_TAB_ACTIVE);

    const hasAnyCardPermission = showSubmissions || showLeaves || showUpdates || showIncompleteProfiles || showResignations;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Operational Overview</h2>
                    <p className="text-gray-500 text-sm">Welcome back, {authUser?.name || 'Admin'}. Here is what's happening today.</p>
                </div>
                <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200 text-sm font-medium text-gray-600">
                    {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
            </div>


            {/* Action Cards */}
            {hasAnyCardPermission ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                    {showSubmissions && (
                        <div
                            onClick={() => navigateTo(AppView.ADMIN_PORTAL_SUBMISSION_REVIEW)}
                            className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all group"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className={`p-3 rounded-lg ${pendingSubmissionsCount > 0 ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                                    <UserPlus size={24} />
                                </div>
                                {pendingSubmissionsCount > 0 && <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">{pendingSubmissionsCount} New</span>}
                            </div>
                            <h3 className="text-3xl font-bold text-gray-800 mb-1">{pendingSubmissionsCount}</h3>
                            <p className="text-sm font-medium text-gray-500 group-hover:text-blue-600 transition-colors">Pending New Joiners</p>
                        </div>
                    )}

                    {showLeaves && (
                        <div
                            onClick={() => navigateTo(AppView.ADMIN_PORTAL_LEAVE_MANAGEMENT)}
                            className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 cursor-pointer hover:shadow-md hover:border-orange-300 transition-all group"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className={`p-3 rounded-lg ${pendingLeavesCount > 0 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-400'}`}>
                                    <CalendarCheck size={24} />
                                </div>
                                {pendingLeavesCount > 0 && <span className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full">{pendingLeavesCount} Pending</span>}
                            </div>
                            <h3 className="text-3xl font-bold text-gray-800 mb-1">{pendingLeavesCount}</h3>
                            <p className="text-sm font-medium text-gray-500 group-hover:text-orange-600 transition-colors">Leave Requests</p>
                        </div>
                    )}

                    {showUpdates && (
                        <div
                            onClick={() => navigateTo(AppView.ADMIN_PORTAL_ACCOUNT_UPDATE_MANAGEMENT)}
                            className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 cursor-pointer hover:shadow-md hover:border-purple-300 transition-all group"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className={`p-3 rounded-lg ${pendingUpdatesCount > 0 ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-400'}`}>
                                    <UserCheck size={24} />
                                </div>
                                {pendingUpdatesCount > 0 && <span className="bg-purple-500 text-white text-xs font-bold px-2 py-1 rounded-full">{pendingUpdatesCount} Pending</span>}
                            </div>
                            <h3 className="text-3xl font-bold text-gray-800 mb-1">{pendingUpdatesCount}</h3>
                            <p className="text-sm font-medium text-gray-500 group-hover:text-purple-600 transition-colors">Account Updates</p>
                        </div>
                    )}

                    {showResignations && (
                        <div
                            onClick={() => navigateTo(AppView.ADMIN_PORTAL_RESIGNATION_MANAGEMENT)}
                            className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 cursor-pointer hover:shadow-md hover:border-red-300 transition-all group"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className={`p-3 rounded-lg ${stats.pendingResignations > 0 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'}`}>
                                    <UserMinus size={24} />
                                </div>
                                {stats.pendingResignations > 0 && <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">{stats.pendingResignations} Pending</span>}
                            </div>
                            <h3 className="text-3xl font-bold text-gray-800 mb-1">{stats.pendingResignations}</h3>
                            <p className="text-sm font-medium text-gray-500 group-hover:text-red-600 transition-colors">Resignation Requests</p>
                        </div>
                    )}

                    {showIncompleteProfiles && (
                        <div
                            onClick={() => navigateTo(AppView.ADMIN_PORTAL_MASTER_EMPLOYEE_LIST)}
                            className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 cursor-pointer hover:shadow-md hover:border-amber-300 transition-all group"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className={`p-3 rounded-lg ${stats.pendingProfiles > 0 ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-400'}`}>
                                    <AlertCircle size={24} />
                                </div>
                                {stats.pendingProfiles > 0 && <span className="bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full">{stats.pendingProfiles} Action Required</span>}
                            </div>
                            <h3 className="text-3xl font-bold text-gray-800 mb-1">{stats.pendingProfiles}</h3>
                            <p className="text-sm font-medium text-gray-500 group-hover:text-amber-600 transition-colors">Incomplete Profiles</p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-blue-50 border border-blue-100 p-6 rounded-xl">
                    <h3 className="text-lg font-bold text-blue-800">Welcome to the Staff Portal</h3>
                    <p className="text-blue-600 text-sm mt-1">Select a module from the sidebar to get started.</p>
                </div>
            )}

            {/* Analytics Section */}
            {(showActiveEmployeesStats || showLeaves) && (
                <div className={`grid grid-cols-1 ${showActiveEmployeesStats && showLeaves ? 'lg:grid-cols-2' : ''} gap-6`}>
                    {/* 1. Deployment Status / Headcount */}
                    {showActiveEmployeesStats && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                                <Shield className="mr-2 text-indigo-600" size={20} /> Deployment Status
                            </h3>
                            <div className="space-y-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                {stats.activeEmployees === 0 || !dashboardAnalytics?.headcountBySite ? (
                                    <p className="text-gray-400 text-sm text-center py-4">No active deployment data yet.</p>
                                ) : (
                                    Object.entries(dashboardAnalytics.headcountBySite).sort(([, a], [, b]) => (b as number) - (a as number)).map(([site, count]) => {
                                        const percentage = Math.round(((count as number) / (stats.activeEmployees || 1)) * 100);
                                        return (
                                            <div key={site}>
                                                <div className="flex justify-between text-sm mb-1">
                                                    <span className="font-medium text-gray-700">{site}</span>
                                                    <span className="text-gray-500">{count} guards ({percentage}%)</span>
                                                </div>
                                                <div className="w-full bg-gray-100 rounded-full h-2">
                                                    <div
                                                        className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                                                        style={{ width: `${percentage}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                            <div className="mt-4 pt-4 border-t border-gray-100 text-right">
                                <button onClick={() => navigateTo(AppView.ADMIN_PORTAL_SITE_MANAGEMENT)} className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
                                    Manage Sites &rarr;
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 2. Leave & Hiring Insights */}
                    <div className="space-y-6">
                        {/* Recent Hires Card */}
                        {showActiveEmployeesStats && (
                            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl p-6 text-white shadow-lg flex items-center justify-between">
                                <div>
                                    <p className="text-emerald-100 text-sm font-bold uppercase tracking-wider mb-1">Growth (Last 30 Days)</p>
                                    <h4 className="text-3xl font-black">{dashboardAnalytics?.recentHires || 0}</h4>
                                    <p className="text-emerald-5 text-xs mt-1">New personnel onboarded</p>
                                </div>
                                <div className="bg-white/20 p-3 rounded-lg backdrop-blur-sm">
                                    <UserPlus size={28} className="text-white" />
                                </div>
                            </div>
                        )}

                        {/* Leave Requests Overview */}
                        {showLeaves && (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                                    <CalendarCheck className="mr-2 text-orange-500" size={20} /> Leave Insights
                                </h3>
                                <div className="space-y-3">
                                    {Object.entries(stats.leavesByType || {}).length === 0 ? (
                                        <p className="text-gray-400 text-sm text-center py-4">No leave data available.</p>
                                    ) : (
                                        Object.entries(stats.leavesByType || {}).map(([type, counts]: [string, any]) => (
                                            <div key={type} className="flex items-center text-sm">
                                                <div className="w-32 font-medium text-gray-600 truncate" title={type}>{type}</div>
                                                <div className="flex-1 flex h-6 rounded-md overflow-hidden bg-gray-100 mx-2">
                                                    {(counts.approved || 0) > 0 && (
                                                        <div
                                                            className="bg-green-500 flex items-center justify-center text-[10px] text-white font-bold"
                                                            style={{ width: `${((counts.approved || 0) / ((counts.approved || 0) + (counts.pending || 0) || 1)) * 100}%` }}
                                                            title={`${counts.approved} Approved`}
                                                        >
                                                            {counts.approved}
                                                        </div>
                                                    )}
                                                    {(counts.pending || 0) > 0 && (
                                                        <div
                                                            className="bg-orange-400 flex items-center justify-center text-[10px] text-white font-bold"
                                                            style={{ width: `${((counts.pending || 0) / ((counts.approved || 0) + (counts.pending || 0) || 1)) * 100}%` }}
                                                            title={`${counts.pending} Pending`}
                                                        >
                                                            {counts.pending}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Quick Shortcuts Row */}
            {(showActiveEmployeesStats || showIncompleteProfiles || hasPermission(Permission.MANAGE_FORMS)) && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Quick Shortcuts</h3>
                    <div className={`grid grid-cols-1 ${(showActiveEmployeesStats || showIncompleteProfiles) && hasPermission(Permission.MANAGE_FORMS) ? 'md:grid-cols-2' : ''} gap-4`}>
                        {(showActiveEmployeesStats || showIncompleteProfiles) && (
                            <button onClick={() => navigateTo(AppView.ADMIN_PORTAL_MASTER_EMPLOYEE_LIST)} className="flex items-center p-4 rounded-lg bg-gray-50 hover:bg-blue-50 hover:border-blue-200 border border-transparent transition-all group w-full">
                                <div className="bg-blue-100 text-blue-600 p-3 rounded-full mr-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    <Users size={20} />
                                </div>
                                <div className="text-left">
                                    <p className="font-bold text-gray-800">Master Employee Directory</p>
                                    <p className="text-xs text-gray-500">Search, filter, and manage all personnel.</p>
                                </div>
                            </button>
                        )}
                        {hasPermission(Permission.MANAGE_FORMS) && (
                            <button onClick={() => navigateTo(AppView.ADMIN_PORTAL_FORM_BUILDER)} className="flex items-center p-4 rounded-lg bg-gray-50 hover:bg-green-50 hover:border-green-200 border border-transparent transition-all group w-full">
                                <div className="bg-green-100 text-green-600 p-3 rounded-full mr-4 group-hover:bg-green-600 group-hover:text-white transition-colors">
                                    <FileText size={20} />
                                </div>
                                <div className="text-left">
                                    <p className="font-bold text-gray-800">Form Configuration</p>
                                    <p className="text-xs text-gray-500">Customize onboarding questions and fields.</p>
                                </div>
                            </button>
                        )}
                    </div>
                </div>
            )}


        </div>
    );
};

export default AdminDashboardPage;



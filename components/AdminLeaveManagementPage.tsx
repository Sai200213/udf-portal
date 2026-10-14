
import React, { useState, useMemo, useEffect } from 'react';
import { defaultLeavePolicy } from '../src/constants/defaults';
import { LeaveRequest, RequestStatus, Role, WorkflowConfig, User, Permission, Site, SubmittedFormData, LeaveBalance, LeaveType, LeavePolicy, LeaveTypeConfig } from '../types';
import Button from './common/Button';
import Modal from './common/Modal';
import Textarea from './common/Textarea';
import Input from './common/Input';
import { CheckCircle, XCircle, Eye, Clock, ListChecks, History, Info, Shield, Zap, Wallet, Settings, ToggleLeft, ToggleRight, Save, CalendarCheck, Plus, Trash2, RotateCcw, Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import PremiumSelect from './common/PremiumSelect';
import { getEmployeeLookupMap, } from '../src/services/employeeService';
import { fetchLeaveRequestsByStatus } from '../src/services/requestService';
import { getEffectiveApprovalLevel, isRoleAssignedToSite } from '../src/utils/workflowHelper';
import { useData } from '../src/contexts/DataContext';

interface AdminLeaveManagementPageProps {
    leaveRequests: LeaveRequest[];
    onAction: (requestId: string, newStatus: RequestStatus, adminComments?: string, isBypass?: boolean) => void;
    userRole?: Role;
    isSuperAdmin: boolean;
    workflowConfigs: WorkflowConfig[];
    sites: Site[];
    submittedForms: SubmittedFormData[];
    authUser: User | null;
    leaveBalances: LeaveBalance[];
    leavePolicy: LeavePolicy;
    onUpdateLeavePolicy?: (policy: LeavePolicy) => void;
    onRevert?: (requestId: string, level: number) => void;
    onDelete?: (requestId: string) => void;
    allowedSiteIds?: string[];
}

const AdminLeaveManagementPage: React.FC<AdminLeaveManagementPageProps> = ({
    leaveRequests, onAction, userRole, isSuperAdmin, workflowConfigs, sites, submittedForms, authUser, leaveBalances, leavePolicy, onUpdateLeavePolicy,
    onRevert, onDelete, allowedSiteIds
}) => {
    const { staffUsers, roles } = useData();
    const [activeTab, setActiveTab] = useState<'REQUESTS' | 'POLICY'>('REQUESTS');
    const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [adminComments, setAdminComments] = useState('');
    const [revertTargetLevel, setRevertTargetLevel] = useState(1);
    const [filterStatus, setFilterStatus] = useState<RequestStatus | 'ALL'>('ALL');
    const [isLookupLoading, setIsLookupLoading] = useState(false);

    // On-demand historical data (Approved/Rejected records loaded when tab is clicked)
    const [historicalRequests, setHistoricalRequests] = useState<LeaveRequest[]>([]);
    const [isLoadingHistorical, setIsLoadingHistorical] = useState(false);

    const [localPolicy, setLocalPolicy] = useState<LeavePolicy>(() => {
        if (leavePolicy && Array.isArray(leavePolicy.leaveTypes) && leavePolicy.leaveTypes.length > 0) {
            return leavePolicy;
        }
        return defaultLeavePolicy;
    });

    // Ensure localPolicy syncs when leavePolicy prop updates
    useEffect(() => {
        if (leavePolicy && Array.isArray(leavePolicy.leaveTypes) && leavePolicy.leaveTypes.length > 0) {
            setLocalPolicy(leavePolicy);
        }
    }, [leavePolicy]);

    const config = workflowConfigs.find(c => c.moduleId === 'LEAVES');
    const hasManagePerm = isSuperAdmin || userRole?.permissions.includes(Permission.MANAGE_LEAVES);
    const hasPermission = (p: Permission) => isSuperAdmin || userRole?.permissions.includes(p) || false;

    const canReview = (req: LeaveRequest) => {
        if (isSuperAdmin) return true;
        if (!hasPermission(Permission.LEAVES_APPROVE) && !hasPermission(Permission.LEAVES_REJECT)) return false;
        if (req.status !== RequestStatus.PENDING) return false;

        const site = sites.find(s => s.id === req.siteId);
        const effectiveLevel = getEffectiveApprovalLevel(req.currentLevel, site, config, staffUsers, roles);

        const currentLevelConfig = config?.levels.find(l => l.level === effectiveLevel);
        return currentLevelConfig?.roleId === userRole?.id;
    };

    // Fetch historical data on-demand when filter changes to Approved/Rejected
    useEffect(() => {
        if (filterStatus === RequestStatus.APPROVED || filterStatus === RequestStatus.REJECTED) {
            setIsLoadingHistorical(true);
            fetchLeaveRequestsByStatus(filterStatus, allowedSiteIds, 200)
                .then(data => setHistoricalRequests(data))
                .catch(err => console.error('Failed to fetch historical leave data:', err))
                .finally(() => setIsLoadingHistorical(false));
        } else {
            setHistoricalRequests([]);
        }
    }, [filterStatus, allowedSiteIds]);

    const getEmployeeBalance = (employeeId: string, type: string) => {
        const empBalance = leaveBalances.find(b => b.employeeId === employeeId);
        if (!empBalance) return { total: 0, used: 0, remaining: 0 };
        const bal = empBalance.balances[type];
        if (type === LeaveType.UNPAID) return { total: '∞', used: bal?.used || 0, remaining: '∞' };
        return { total: bal?.total || 0, used: bal?.used || 0, remaining: (bal?.total || 0) - (bal?.used || 0) };
    };

    const closeDetailsModal = () => {
        setIsDetailsModalOpen(false);
        setSelectedRequest(null);
        setAdminComments('');
    };

    const openDetailsModal = (request: LeaveRequest) => {
        setSelectedRequest(request);
        setAdminComments('');
        setIsDetailsModalOpen(true);
    };

    // Merge real-time pending data with on-demand historical data
    const allRequests = useMemo(() => {
        const merged = [...leaveRequests];
        // Add historical records that aren't already in the real-time list
        const existingIds = new Set(leaveRequests.map(r => r.id));
        historicalRequests.forEach(hr => {
            if (!existingIds.has(hr.id)) merged.push(hr);
        });
        return merged;
    }, [leaveRequests, historicalRequests]);

    const filteredRequests = useMemo(() => {
        return allRequests.filter(req => {
            const matchesStatus = filterStatus === 'ALL' || req.status === filterStatus;
            return matchesStatus;
        }).sort((a, b) => new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime());
    }, [allRequests, filterStatus]);

    const selectedBalance = selectedRequest ? getEmployeeBalance(selectedRequest.employeeId, selectedRequest.leaveType) : null;

    const handlePolicyChange = (typeId: string, field: keyof LeaveTypeConfig, value: any) => {
        setLocalPolicy(prev => ({
            ...prev,
            leaveTypes: prev.leaveTypes.map(t => t.typeId === typeId ? { ...t, [field]: value } : t)
        }));
    };

    const handleAddLeaveType = () => {
        const newType: LeaveTypeConfig = {
            typeId: `custom-${uuidv4().slice(0, 8)}`,
            label: 'New Leave Type',
            defaultQuota: 0,
            isActive: true
        };
        setLocalPolicy(prev => ({ ...prev, leaveTypes: [...prev.leaveTypes, newType] }));
    };

    const handleDeleteLeaveType = (typeId: string) => {
        if (window.confirm("Are you sure you want to remove this leave type?")) {
            setLocalPolicy(prev => ({ ...prev, leaveTypes: prev.leaveTypes.filter(t => t.typeId !== typeId) }));
        }
    };

    const savePolicy = () => {
        if (onUpdateLeavePolicy) {
            onUpdateLeavePolicy(localPolicy);
            alert("Leave policy updated successfully.");
        }
    };

    return (
        <div className="p-0">
            {isSuperAdmin && (
                <div className="flex space-x-4 mb-6 border-b border-gray-200 pb-2">
                    <button onClick={() => setActiveTab('REQUESTS')} className={`flex items-center space-x-2 px-4 py-2 border-b-2 font-medium text-sm transition-colors ${activeTab === 'REQUESTS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                        <CalendarCheck size={18} /><span>Leave Requests</span>
                    </button>
                    <button onClick={() => { setActiveTab('POLICY'); setLocalPolicy(leavePolicy); }} className={`flex items-center space-x-2 px-4 py-2 border-b-2 font-medium text-sm transition-colors ${activeTab === 'POLICY' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                        <Settings size={18} /><span>Leave Policy</span>
                    </button>
                </div>
            )}

            {activeTab === 'REQUESTS' ? (
                <>
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex gap-2">
                            {['ALL', RequestStatus.PENDING, RequestStatus.APPROVED, RequestStatus.REJECTED].map(s => (
                                <Button key={s} variant={filterStatus === s ? 'primary' : 'secondary'} size="sm" onClick={() => setFilterStatus(s as any)}>
                                    {s === 'ALL' ? 'Total' : s} ({s === 'ALL' ? allRequests.length : allRequests.filter(r => r.status === s).length})
                                    {(s === RequestStatus.APPROVED || s === RequestStatus.REJECTED) && filterStatus === s && isLoadingHistorical && (
                                        <Loader2 size={12} className="ml-1 animate-spin" />
                                    )}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Approval Step</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredRequests.length === 0 ? (
                                    <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400 italic">No requests.</td></tr>
                                ) : filteredRequests.map(req => (
                                    <tr key={req.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{req.employeeName}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{req.leaveType}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                            {(() => {
                                                const site = sites.find(s => s.id === req.siteId);
                                                const effectiveLevel = getEffectiveApprovalLevel(req.currentLevel, site, config, staffUsers, roles);
                                                const lvlConfig = config?.levels.find(l => l.level === effectiveLevel);
                                                const rName = roles?.find(r => r.id === lvlConfig?.roleId)?.name || `Role ${lvlConfig?.roleId || ''}`;
                                                return `Level ${effectiveLevel}: ${rName}`;
                                            })()}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${req.status === RequestStatus.APPROVED ? 'bg-green-100 text-green-700' : req.status === RequestStatus.REJECTED ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                {req.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-right">
                                            <Button variant="ghost" size="sm" onClick={() => openDetailsModal(req)}><Eye size={16} /></Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            ) : (
                <div className="bg-white rounded-lg shadow border border-gray-200 p-6 max-w-4xl">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b border-gray-100 pb-4">
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">Leave Policy Configuration</h3>
                            <p className="text-xs text-gray-500 mt-1">Configure company-wide annual leave quotas and visibility rules for employees.</p>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Button onClick={() => setLocalPolicy(defaultLeavePolicy)} variant="secondary" size="sm">
                                <RotateCcw size={16} className="mr-1.5" /> Restore Defaults
                            </Button>
                            <Button onClick={handleAddLeaveType} variant="secondary" size="sm">
                                <Plus size={16} className="mr-1.5" /> Add Leave Type
                            </Button>
                            <Button onClick={savePolicy} variant="primary" size="sm">
                                <Save size={16} className="mr-1.5" /> Save Policy
                            </Button>
                        </div>
                    </div>

                    {/* Visibility Settings Toggle */}
                    <div className="mb-6 p-4 rounded-xl border border-purple-100 bg-purple-50/50 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-gray-900">Show Leave Balances To Employees</p>
                            <p className="text-xs text-gray-500">Allows employees to view their remaining leave balances on their employee portal dashboard.</p>
                        </div>
                        <button
                            onClick={() => setLocalPolicy(prev => ({ ...prev, showBalancesToEmployees: !prev.showBalancesToEmployees }))}
                            className="focus:outline-none"
                            type="button"
                        >
                            {localPolicy.showBalancesToEmployees ? (
                                <ToggleRight size={36} className="text-purple-600 transition-colors" />
                            ) : (
                                <ToggleLeft size={36} className="text-gray-400 transition-colors" />
                            )}
                        </button>
                    </div>

                    {/* Leave Types List */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Leave Types & Annual Default Quotas</h4>
                            <span className="text-xs text-gray-400">{localPolicy.leaveTypes.length} Total Types</span>
                        </div>
                        {localPolicy.leaveTypes.map((lt) => (
                            <div key={lt.typeId} className="flex items-center justify-between p-4 rounded-xl border bg-white border-gray-200 shadow-sm hover:border-gray-300 transition-all">
                                <div className="flex items-center space-x-4 flex-grow">
                                    <button onClick={() => handlePolicyChange(lt.typeId, 'isActive', !lt.isActive)} type="button" title={lt.isActive ? "Active (Click to disable)" : "Disabled (Click to enable)"}>
                                        {lt.isActive ? <ToggleRight size={28} className="text-green-500" /> : <ToggleLeft size={28} className="text-gray-400" />}
                                    </button>
                                    <Input value={lt.label} onChange={(e) => handlePolicyChange(lt.typeId, 'label', e.target.value)} className="font-semibold" />
                                </div>
                                <div className="flex items-center space-x-3 w-56 justify-end">
                                    <div className="flex items-center space-x-2">
                                        <span className="text-xs text-gray-500 whitespace-nowrap">Days / Yr:</span>
                                        <Input type="number" value={lt.defaultQuota} onChange={(e) => handlePolicyChange(lt.typeId, 'defaultQuota', parseInt(e.target.value) || 0)} className="w-20 text-center font-mono font-bold" />
                                    </div>
                                    <button onClick={() => handleDeleteLeaveType(lt.typeId)} className="text-red-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 transition-colors" title="Delete Leave Type" type="button">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {selectedRequest && isDetailsModalOpen && (
                <Modal isOpen={isDetailsModalOpen} onClose={closeDetailsModal} title="Leave Details" size="lg">
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div><p className="text-xs text-gray-400 uppercase font-bold">Employee</p><p>{selectedRequest.employeeName}</p></div>
                            <div><p className="text-xs text-gray-400 uppercase font-bold">Type</p><p>{selectedRequest.leaveType}</p></div>
                            <div><p className="text-xs text-gray-400 uppercase font-bold">Dates</p><p>{selectedRequest.startDate} to {selectedRequest.endDate}</p></div>
                             <div>
                                 <p className="text-xs text-gray-400 uppercase font-bold">Current Step</p>
                                 <p className="text-blue-600 font-medium">
                                     {(() => {
                                         const site = sites.find(s => s.id === selectedRequest.siteId);
                                         const effectiveLevel = getEffectiveApprovalLevel(selectedRequest.currentLevel, site, config, staffUsers, roles);
                                         const lvlConfig = config?.levels.find(l => l.level === effectiveLevel);
                                         const rName = roles?.find(r => r.id === lvlConfig?.roleId)?.name || `Role ${lvlConfig?.roleId || ''}`;
                                         return `Level ${effectiveLevel}: ${rName}`;
                                     })()}
                                 </p>
                             </div>
                        </div>

                        {(isSuperAdmin || hasPermission(Permission.LEAVES_DELETE)) && (
                            <div className="flex justify-end border-b border-gray-100 pb-4">
                                <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={() => {
                                        if (onDelete) {
                                            onDelete(selectedRequest.id);
                                            closeDetailsModal();
                                        }
                                    }}
                                    className="!bg-red-50 !text-red-600 hover:!bg-red-600 hover:!text-white border-red-200"
                                >
                                    <Trash2 size={16} className="mr-2" /> Delete Permanent Record
                                </Button>
                            </div>
                        )}

                        {selectedBalance && (
                            <div className="bg-blue-50 border border-blue-100 rounded-md p-3 flex justify-between">
                                <div className="text-blue-800 font-medium font-bold">Available {selectedRequest.leaveType} Balance:</div>
                                <div className="font-bold text-blue-900">{selectedBalance.remaining} / {selectedBalance.total} Days</div>
                            </div>
                        )}

                        <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
                            <p className="text-xs text-gray-400 uppercase font-bold mb-1">Reason</p>
                            <p className="text-sm text-gray-700">{selectedRequest.reason || 'None.'}</p>
                        </div>

                        {selectedRequest.approvalHistory.length > 0 && (
                            <div>
                                <p className="text-xs text-gray-400 uppercase font-bold mb-2 flex items-center"><History size={14} className="mr-1" /> History</p>
                                <div className="space-y-2 border-l-2 border-gray-100 ml-2 pl-4">
                                    {selectedRequest.approvalHistory.map((h, i) => (
                                        <div key={i} className="relative mb-2">
                                            <div className="absolute -left-[22px] top-1.5 w-3 h-3 rounded-full bg-blue-500" />
                                            <p className="text-sm font-semibold">{h.actionByRole} ({h.actionBy}) <span className="text-xs font-normal text-gray-400">— Level {h.level} {h.status}</span></p>
                                            {h.comments && <p className="text-xs text-gray-500 italic">"{h.comments}"</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {canReview(selectedRequest) && (
                            <div className="pt-4 border-t border-gray-100 space-y-4">
                                <Textarea label="Decision Comments" value={adminComments} onChange={e => setAdminComments(e.target.value)} placeholder="Decision notes..." />
                                <div className="flex flex-col sm:flex-row justify-between items-end gap-4 mt-4">
                                    {(() => {
                                        const site = sites.find(s => s.id === selectedRequest.siteId);
                                        const effectiveLevel = getEffectiveApprovalLevel(selectedRequest.currentLevel, site, config, staffUsers, roles);
                                        return (
                                            <div className="flex flex-col space-y-1">
                                                <label className="text-[10px] font-bold text-amber-600 uppercase">Revert to Level</label>
                                                <div className="flex gap-2">
                                                    {isSuperAdmin ? (
                                                        <PremiumSelect
                                                            options={config?.levels.map(l => {
                                                                const roleAssigned = isRoleAssignedToSite(l.roleId, site, staffUsers, roles);
                                                                const isLastLevel = l.level === config.levels[config.levels.length - 1].level;
                                                                const suffix = (roleAssigned || isLastLevel) ? '' : ' (No staff assigned)';
                                                                return {
                                                                    value: String(l.level),
                                                                    label: `Level ${l.level}: ${roles?.find(r => r.id === l.roleId)?.name || `Step ${l.level}`}${suffix}`
                                                                };
                                                            }) || []}
                                                            value={String(revertTargetLevel)}
                                                            onChange={(val) => setRevertTargetLevel(Number(val))}
                                                            className="w-48"
                                                        />
                                                    ) : null}

                                                    {hasPermission(Permission.LEAVES_REVERT_DECISION) && (isSuperAdmin || effectiveLevel > 1) && (
                                                         <Button
                                                             variant="secondary"
                                                             size="sm"
                                                             onClick={() => {
                                                                 const target = isSuperAdmin ? revertTargetLevel : effectiveLevel - 1;
                                                                 if (window.confirm(`Revert to Level ${target}?`)) {
                                                                     onRevert?.(selectedRequest.id, target);
                                                                     closeDetailsModal();
                                                                 }
                                                             }}
                                                             className="bg-amber-100 text-amber-700"
                                                         >
                                                             {isSuperAdmin ? 'Revert' : 'Revert One Step'}
                                                         </Button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                    <div className="flex gap-2">
                                        {hasPermission(Permission.LEAVES_REJECT) && (
                                            <Button variant="danger" onClick={() => { onAction(selectedRequest.id, RequestStatus.REJECTED, adminComments); closeDetailsModal(); }}>Reject</Button>
                                        )}
                                        {hasPermission(Permission.LEAVES_APPROVE) && (() => {
                                            const site = sites.find(s => s.id === selectedRequest.siteId);
                                            const effectiveLevel = getEffectiveApprovalLevel(selectedRequest.currentLevel, site, config, staffUsers, roles);
                                            const maxLevels = config?.levels.length || 1;
                                            const hasMoreLevels = effectiveLevel < maxLevels;

                                            return (
                                                <div className="flex gap-2">
                                                    <Button 
                                                        variant="primary" 
                                                        onClick={() => { onAction(selectedRequest.id, RequestStatus.APPROVED, adminComments, false); closeDetailsModal(); }} 
                                                        className="bg-green-600 hover:bg-green-700"
                                                    >
                                                        {hasMoreLevels ? `Approve Level ${effectiveLevel}` : 'Final Approval'}
                                                    </Button>
                                                    {isSuperAdmin && hasMoreLevels && (
                                                        <Button 
                                                            variant="primary" 
                                                            onClick={() => { 
                                                                if (window.confirm("Bypass remaining levels and grant Direct Final Approval?")) {
                                                                    onAction(selectedRequest.id, RequestStatus.APPROVED, adminComments, true); 
                                                                    closeDetailsModal(); 
                                                                }
                                                            }} 
                                                            className="bg-emerald-700 hover:bg-emerald-800 font-semibold"
                                                        >
                                                            Direct Final Approval
                                                        </Button>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default AdminLeaveManagementPage;




import React, { useState } from 'react';
import { AccountUpdateRequest, RequestStatus, Role, WorkflowConfig, Site, SubmittedFormData, User, Permission } from '../types';
import Button from './common/Button';
import Modal from './common/Modal';
import Textarea from './common/Textarea';
import { CheckCircle, XCircle, Eye, History, FileText, Zap, Shield, RotateCcw, Trash2 } from 'lucide-react';
import { getEmployeeLookupMap } from '../src/services/employeeService';
import { getEffectiveApprovalLevel, isRoleAssignedToSite } from '../src/utils/workflowHelper';
import { useData } from '../src/contexts/DataContext';

interface AdminAccountUpdateManagementPageProps {
  accountUpdateRequests: AccountUpdateRequest[];
  onAction: (requestId: string, newStatus: RequestStatus, adminComments?: string, isBypass?: boolean) => void;
  userRole?: Role;
  isSuperAdmin: boolean;
  workflowConfigs: WorkflowConfig[];
  sites: Site[];
  submittedForms: SubmittedFormData[];
  authUser: User | null;
  onRevert?: (requestId: string, level: number) => void;
  onDelete?: (requestId: string) => void;
  allowedSiteIds?: string[];
}

const AdminAccountUpdateManagementPage: React.FC<AdminAccountUpdateManagementPageProps> = ({
  accountUpdateRequests, onAction, userRole, isSuperAdmin, workflowConfigs, sites, submittedForms, authUser,
  onRevert, onDelete, allowedSiteIds
}) => {
  const { staffUsers, roles } = useData();
  const [selectedRequest, setSelectedRequest] = useState<AccountUpdateRequest | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [adminComments, setAdminComments] = useState('');
  const [revertTargetLevel, setRevertTargetLevel] = useState(1);
  const [filterStatus, setFilterStatus] = useState<RequestStatus | 'ALL'>('ALL');
  const [isLookupLoading, setIsLookupLoading] = useState(false);

  const config = workflowConfigs.find(c => c.moduleId === 'ACCOUNT_UPDATES');
  const hasPermission = (p: Permission) => isSuperAdmin || userRole?.permissions.includes(p) || false;

  const canReview = (req: AccountUpdateRequest) => {
    if (isSuperAdmin) return true; // Override for super admin
    if (!hasPermission(Permission.ACCOUNT_UPDATES_APPROVE) && !hasPermission(Permission.ACCOUNT_UPDATES_REJECT)) return false;
    if (req.status !== RequestStatus.PENDING) return false;

    const site = sites.find(s => s.id === req.siteId);
    const effectiveLevel = getEffectiveApprovalLevel(req.currentLevel, site, config, staffUsers, roles);

    const currentLevelConfig = config?.levels.find(l => l.level === effectiveLevel);
    return currentLevelConfig?.roleId === userRole?.id;
  };

  const openDetailsModal = (request: AccountUpdateRequest) => {
    setSelectedRequest(request);
    setAdminComments('');
    setIsModalOpen(true);
  };

  const closeDetailsModal = () => {
    setIsModalOpen(false);
    setSelectedRequest(null);
    setAdminComments('');
  };

  // Load employee lookup for site filtering - REMOVED since filtering is now centralized in DataContext

  const filteredRequests = accountUpdateRequests.filter(req => {
    const matchesStatus = filterStatus === 'ALL' || req.status === filterStatus;
    return matchesStatus;
  }).sort((a, b) => new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime());

  return (
    <div className="p-0">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          {['ALL', RequestStatus.PENDING, RequestStatus.APPROVED, RequestStatus.REJECTED].map(s => (
            <Button
              key={s}
              variant={filterStatus === s ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setFilterStatus(s as any)}
            >
              {s === 'ALL' ? 'Total' : s} ({s === 'ALL' ? accountUpdateRequests.length : accountUpdateRequests.filter(r => r.status === s).length})
            </Button>
          ))}
        </div>
        {userRole?.name.toLowerCase().includes('field officer') && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-md text-xs font-bold flex items-center">
            <Shield size={14} className="mr-2" /> Showing Assigned Sites Only
          </div>
        )}
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Field</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Approval Step</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredRequests.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400 italic">No updates to display.</td></tr>
            ) : filteredRequests.map(req => (
              <tr key={req.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{req.employeeName}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{req.fieldLabel}</td>
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
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${req.status === RequestStatus.APPROVED ? 'bg-green-100 text-green-700' :
                    req.status === RequestStatus.REJECTED ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                    {req.status}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right">
                  <Button variant="ghost" size="sm" onClick={() => openDetailsModal(req)}>
                    <Eye size={16} className="mr-1" /> View
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedRequest && (
        <Modal isOpen={isModalOpen} onClose={closeDetailsModal} title="Update Request Details" size="lg">
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-gray-400 uppercase font-bold">Employee</p><p>{selectedRequest.employeeName}</p></div>
              <div><p className="text-xs text-gray-400 uppercase font-bold">Update Field</p><p>{selectedRequest.fieldLabel}</p></div>
              <div><p className="text-xs text-gray-400 uppercase font-bold">Current</p><p className="text-gray-500">{String(selectedRequest.currentValue || 'None')}</p></div>
              <div><p className="text-xs text-blue-600 uppercase font-bold">Requested</p><p className="font-bold text-blue-700">{String(selectedRequest.requestedValue)}</p></div>
            </div>

            {(isSuperAdmin || hasPermission(Permission.ACCOUNT_UPDATES_DELETE)) && (
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

            <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
              <p className="text-xs text-gray-400 uppercase font-bold mb-1">Reason</p>
              <p className="text-sm text-gray-700">{selectedRequest.reason || 'None provided.'}</p>
            </div>

            {selectedRequest.approvalHistory.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 uppercase font-bold mb-2 flex items-center">
                  <History size={14} className="mr-1" /> Approval History
                </p>
                <div className="space-y-2 border-l-2 border-gray-100 ml-2 pl-4">
                  {selectedRequest.approvalHistory.map((h, i) => (
                    <div key={i} className="relative">
                      <div className="absolute -left-[22px] top-1.5 w-3 h-3 rounded-full bg-blue-500" />
                      <p className="text-sm font-semibold">{h.actionByRole} ({h.actionBy}) <span className="text-xs font-normal text-gray-400">— Level {h.level} {h.status}</span></p>
                      {h.comments && <p className="text-xs text-gray-500 italic mt-0.5">"{h.comments}"</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {canReview(selectedRequest) && (
              <div className="pt-4 border-t border-gray-100 space-y-4">
                {isSuperAdmin && selectedRequest.status === RequestStatus.PENDING && (
                  <div className="flex items-center text-xs text-amber-600 bg-amber-50 p-2 rounded">
                    <Zap size={14} className="mr-1" />
                    <span>Super Admin Override Enabled</span>
                  </div>
                )}
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
                            <select
                              className="p-2 text-sm border rounded-md bg-amber-50 border-amber-200"
                              value={revertTargetLevel}
                              onChange={e => setRevertTargetLevel(Number(e.target.value))}
                            >
                              {config?.levels.map(l => {
                                const roleAssigned = isRoleAssignedToSite(l.roleId, site, staffUsers, roles);
                                const isLastLevel = l.level === config.levels[config.levels.length - 1].level;
                                const suffix = (roleAssigned || isLastLevel) ? '' : ' (No staff assigned)';
                                return (
                                  <option key={l.level} value={l.level}>
                                    Level {l.level}: {roles?.find(r => r.id === l.roleId)?.name || `Step ${l.level}`}{suffix}
                                  </option>
                                );
                              })}
                            </select>
                          ) : null}

                          {hasPermission(Permission.ACCOUNT_UPDATES_REVERT_DECISION) && (isSuperAdmin || effectiveLevel > 1) && (
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
                  <div className="flex justify-end space-x-2">
                    {hasPermission(Permission.ACCOUNT_UPDATES_REJECT) && (
                      <Button variant="danger" onClick={() => { onAction(selectedRequest.id, RequestStatus.REJECTED, adminComments); closeDetailsModal(); }}>
                        Reject Update
                      </Button>
                    )}
                    {(() => {
                      const site = sites.find(s => s.id === selectedRequest.siteId);
                      const effectiveLevel = getEffectiveApprovalLevel(selectedRequest.currentLevel, site, config, staffUsers, roles);
                      const maxLevels = config?.levels.length || 1;
                      const hasMoreLevels = effectiveLevel < maxLevels;

                      return hasPermission(Permission.ACCOUNT_UPDATES_APPROVE) ? (
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
                      ) : null;
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

export default AdminAccountUpdateManagementPage;



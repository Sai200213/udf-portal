
import React, { useState, useMemo } from 'react';
import { ResignationRequest, RequestStatus, Role, WorkflowConfig, Permission, Site, SubmittedFormData, User } from '../types';
import Button from './common/Button';
import Modal from './common/Modal';
import Textarea from './common/Textarea';
import Input from './common/Input';
import { CheckCircle, XCircle, Eye, Clock, History, Info, UserMinus, Calendar, Shield, Zap, RotateCcw, Trash2 } from 'lucide-react';
import { getEmployeeLookupMap } from '../src/services/employeeService';
import { getEffectiveApprovalLevel, isRoleAssignedToSite } from '../src/utils/workflowHelper';
import { useData } from '../src/contexts/DataContext';

interface AdminResignationManagementPageProps {
  resignationRequests: ResignationRequest[];
  onAction: (requestId: string, newStatus: RequestStatus, adminComments?: string, updatedRelievingDate?: string, isBypass?: boolean) => void;
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

const AdminResignationManagementPage: React.FC<AdminResignationManagementPageProps> = ({
  resignationRequests, onAction, userRole, isSuperAdmin, workflowConfigs, sites, submittedForms, authUser,
  onRevert, onDelete, allowedSiteIds
}) => {
  const { staffUsers, roles } = useData();
  const [selectedRequest, setSelectedRequest] = useState<ResignationRequest | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [adminComments, setAdminComments] = useState('');
  const [editedRelievingDate, setEditedRelievingDate] = useState('');
  const [revertTargetLevel, setRevertTargetLevel] = useState(1);
  const [filterStatus, setFilterStatus] = useState<RequestStatus | 'ALL'>('ALL');
  const [isLookupLoading, setIsLookupLoading] = useState(false);

  const config = workflowConfigs.find(c => c.moduleId === 'RESIGNATIONS');

  const hasManagePerm = isSuperAdmin || userRole?.permissions.includes(Permission.MANAGE_RESIGNATIONS);
  const hasPermission = (p: Permission) => isSuperAdmin || userRole?.permissions.includes(p) || false;

  const canReview = (req: ResignationRequest) => {
    if (isSuperAdmin) return true; // Override for super admin
    if (!hasPermission(Permission.RESIGNATIONS_APPROVE) && !hasPermission(Permission.RESIGNATIONS_REJECT)) return false;
    if (req.status !== RequestStatus.PENDING) return false;

    const site = sites.find(s => s.id === req.siteId);
    const effectiveLevel = getEffectiveApprovalLevel(req.currentLevel, site, config, staffUsers, roles);

    const currentLevelConfig = config?.levels.find(l => l.level === effectiveLevel);
    return currentLevelConfig?.roleId === userRole?.id;
  };

  const openDetailsModal = (request: ResignationRequest) => {
    setSelectedRequest(request);
    setAdminComments('');
    setEditedRelievingDate(request.relievingDate); // Initialize with current value
    setIsModalOpen(true);
  };

  const closeDetailsModal = () => {
    setIsModalOpen(false);
    setSelectedRequest(null);
    setAdminComments('');
    setEditedRelievingDate('');
  };

  // Load employee lookup for site filtering - REMOVED since filtering is now centralized in DataContext

  const filteredRequests = useMemo(() => {
    return resignationRequests.filter(req => {
      const matchesStatus = filterStatus === 'ALL' || req.status === filterStatus;
      return matchesStatus;
    }).sort((a, b) => new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime());
  }, [resignationRequests, filterStatus]);

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
              {s === 'ALL' ? 'Total' : s} ({s === 'ALL' ? resignationRequests.length : resignationRequests.filter(r => r.status === s).length})
            </Button>
          ))}
        </div>
        {!hasManagePerm && !isSuperAdmin && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 rounded-md text-xs font-bold flex items-center">
            <Info size={14} className="mr-2" /> READ-ONLY VIEWER
          </div>
        )}
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
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Relieving Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Step</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredRequests.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400 italic">No resignation requests to display.</td></tr>
            ) : filteredRequests.map(req => (
              <tr key={req.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                  {req.employeeName}
                  <div className="text-xs text-gray-400">{req.employeeId}</div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{req.unit}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-blue-600">{new Date(req.relievingDate).toLocaleDateString()}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  <span className="flex items-center">
                    <Clock size={14} className="mr-1 text-blue-400" />
                    {(() => {
                      const site = sites.find(s => s.id === req.siteId);
                      const effectiveLevel = getEffectiveApprovalLevel(req.currentLevel, site, config, staffUsers, roles);
                      const lvlConfig = config?.levels.find(l => l.level === effectiveLevel);
                      const rName = roles?.find(r => r.id === lvlConfig?.roleId)?.name || `Role ${lvlConfig?.roleId || ''}`;
                      return `Level ${effectiveLevel}: ${rName}`;
                    })()}
                  </span>
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
                    <Eye size={16} className="mr-1" /> Review
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedRequest && (
        <Modal isOpen={isModalOpen} onClose={closeDetailsModal} title="Resignation Request" size="lg">
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-gray-400 uppercase font-bold">Employee</p><p>{selectedRequest.employeeName} ({selectedRequest.employeeId})</p></div>
              <div><p className="text-xs text-gray-400 uppercase font-bold">Unit</p><p>{selectedRequest.unit}</p></div>
              <div><p className="text-xs text-gray-400 uppercase font-bold">Submitted On</p><p>{new Date(selectedRequest.submissionDate).toLocaleDateString()}</p></div>
              <div>
                <p className="text-xs text-gray-400 uppercase font-bold">Current Step</p>
                <p className="text-blue-600 font-medium">
                  {selectedRequest.status === RequestStatus.PENDING
                    ? (() => {
                        const site = sites.find(s => s.id === selectedRequest.siteId);
                        const effectiveLevel = getEffectiveApprovalLevel(selectedRequest.currentLevel, site, config, staffUsers, roles);
                        const lvlConfig = config?.levels.find(l => l.level === effectiveLevel);
                        const rName = roles?.find(r => r.id === lvlConfig?.roleId)?.name || `Role ${lvlConfig?.roleId || ''}`;
                        return `Pending at Level ${effectiveLevel}: ${rName}`;
                      })()
                    : selectedRequest.status}
                </p>
              </div>
            </div>

            {(isSuperAdmin || hasPermission(Permission.RESIGNATIONS_DELETE)) && (
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
              <p className="text-sm text-gray-700">{selectedRequest.reason}</p>
            </div>

            {selectedRequest.document && (
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-md flex items-center">
                <CheckCircle size={16} className="text-blue-500 mr-2" />
                <span className="text-sm text-blue-700 font-medium">{selectedRequest.document.name} (Uploaded)</span>
              </div>
            )}

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

            {canReview(selectedRequest) ? (
              <div className="pt-4 border-t border-gray-100 space-y-4 bg-yellow-50 p-4 rounded-md">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-yellow-800 uppercase flex items-center"><UserMinus size={16} className="mr-2" /> Approval Action</h4>
                  {isSuperAdmin && selectedRequest.status === RequestStatus.PENDING && (
                    <span className="text-[10px] text-yellow-600 font-bold bg-yellow-100 px-2 py-1 rounded flex items-center">
                      <Zap size={12} className="mr-1" /> Override Active
                    </span>
                  )}
                </div>

                {/* Editable Relieving Date */}
                <div className="bg-white p-3 border border-yellow-200 rounded">
                  <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center">
                    <Calendar size={14} className="mr-1" /> Confirm/Edit Relieving Date
                  </label>
                  <Input
                    type="date"
                    value={editedRelievingDate}
                    onChange={e => setEditedRelievingDate(e.target.value)}
                    className="text-sm font-bold text-blue-700"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">You can modify this date if the notice period needs adjustment.</p>
                </div>

                <Textarea label="Comments" value={adminComments} onChange={e => setAdminComments(e.target.value)} placeholder="Add remarks..." />

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

                          {hasPermission(Permission.RESIGNATIONS_REVERT_DECISION) && (isSuperAdmin || effectiveLevel > 1) && (
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
                    {hasPermission(Permission.RESIGNATIONS_REJECT) && (
                      <Button variant="danger" onClick={() => { onAction(selectedRequest.id, RequestStatus.REJECTED, adminComments, editedRelievingDate); closeDetailsModal(); }}>
                        <XCircle size={18} className="mr-1" /> Reject
                      </Button>
                    )}
                    {(() => {
                      const site = sites.find(s => s.id === selectedRequest.siteId);
                      const effectiveLevel = getEffectiveApprovalLevel(selectedRequest.currentLevel, site, config, staffUsers, roles);
                      const maxLevels = config?.levels.length || 1;
                      const hasMoreLevels = effectiveLevel < maxLevels;

                      return hasPermission(Permission.RESIGNATIONS_APPROVE) ? (
                        <div className="flex gap-2">
                          <Button 
                            variant="primary" 
                            onClick={() => { onAction(selectedRequest.id, RequestStatus.APPROVED, adminComments, editedRelievingDate, false); closeDetailsModal(); }} 
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle size={18} className="mr-1" /> {hasMoreLevels ? `Approve Level ${effectiveLevel}` : 'Final Approval'}
                          </Button>
                          {isSuperAdmin && hasMoreLevels && (
                            <Button 
                              variant="primary" 
                              onClick={() => { 
                                if (window.confirm("Bypass remaining levels and grant Direct Final Approval?")) {
                                  onAction(selectedRequest.id, RequestStatus.APPROVED, adminComments, editedRelievingDate, true); 
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
            ) : (
              <div className="pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400 uppercase font-bold mb-1">Final Relieving Date</p>
                <p className="text-lg font-bold text-gray-800">{new Date(selectedRequest.relievingDate).toLocaleDateString()}</p>
              </div>
            )}

          </div>
        </Modal>
      )}
    </div>
  );
};

export default AdminResignationManagementPage;



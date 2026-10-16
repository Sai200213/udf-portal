
import React, { useState, useMemo, useEffect } from 'react';
import { LeaveRequest, RequestStatus, Role, WorkflowConfig, LeaveBalance, LeavePolicy, LeaveType } from '../../types';
import Button from '../common/Button';
import Input from '../common/Input';
import Select from '../common/Select';
import Textarea from '../common/Textarea';
import { PlusCircle, CalendarClock, Check, X, Info, Wallet } from 'lucide-react';

interface EmployeeLeaveRequestPageProps {
  employeeId: string;
  existingRequests: LeaveRequest[];
  onSubmitRequest: (requestData: any) => void;
  roles?: Role[];
  workflowConfigs?: WorkflowConfig[];
  leaveBalances?: LeaveBalance[];
  leavePolicy?: LeavePolicy;
  activeAssignments?: any[];
  sites?: any[];
}

const EmployeeLeaveRequestPage: React.FC<EmployeeLeaveRequestPageProps> = ({ 
  employeeId, existingRequests, onSubmitRequest, roles, workflowConfigs, leaveBalances = [], leavePolicy,
  activeAssignments = [], sites = []
}) => {
  const [leaveType, setLeaveType] = useState<string>('');
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [supportingDoc, setSupportingDoc] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Set default leave type on load
  useEffect(() => {
    if (leavePolicy && leavePolicy.leaveTypes.length > 0 && !leaveType) {
      const firstActive = leavePolicy.leaveTypes.find(lt => lt.isActive);
      if (firstActive) setLeaveType(firstActive.typeId);
    }
  }, [leavePolicy, leaveType]);

  const today = new Date().toISOString().split('T')[0];

  // Get current balance for this employee
  const currentBalance = useMemo(() =>
    leaveBalances.find(b => b.employeeId === employeeId) || null
    , [leaveBalances, employeeId]);

  const getBalance = (type: string) => {
    if (!currentBalance) return { total: 0, used: 0, remaining: 0 };
    const bal = currentBalance.balances[type];

    // Handle legacy or dynamic UNPAID logic
    if (type === LeaveType.UNPAID) return { total: '∞', used: bal?.used || 0, remaining: '∞' };

    return { total: bal?.total || 0, used: bal?.used || 0, remaining: (bal?.total || 0) - (bal?.used || 0) };
  };

  const activeLeaveTypes = useMemo(() => {
    if (!leavePolicy) return [];
    return leavePolicy.leaveTypes.filter(lt => lt.isActive);
  }, [leavePolicy]);

  const getLeaveLabel = (typeId: string) => {
    if (!leavePolicy) return typeId;
    const typeConfig = leavePolicy.leaveTypes.find(lt => lt.typeId === typeId);
    return typeConfig ? typeConfig.label : typeId;
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSupportingDoc(event.target.files[0]);
    } else {
      setSupportingDoc(null);
    }
  };

  const activeDeployments = useMemo(() => {
    return (activeAssignments || []).filter(a => a.status === 'Active');
  }, [activeAssignments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (activeDeployments.length > 1 && !selectedSiteId) {
      setFormError('Please select which site this leave request is for.');
      return;
    }

    if (!leaveType) {
      setFormError('Please select a leave type.');
      return;
    }

    if (!startDate || !endDate) {
      setFormError('Start date and end date are required.');
      return;
    }
    const [sY, sM, sD] = startDate.split('-').map(Number);
    const [eY, eM, eD] = endDate.split('-').map(Number);
    const startUTC = Date.UTC(sY, sM - 1, sD);
    const endUTC = Date.UTC(eY, eM - 1, eD);

    if (startUTC > endUTC) {
      setFormError('Start date cannot be after end date.');
      return;
    }

    // Pure Calendar Day Calculation (start date to end date inclusive count)
    const daysRequested = Math.round((endUTC - startUTC) / (1000 * 3600 * 24)) + 1; // Inclusive

    const balanceInfo = getBalance(leaveType);
    if (balanceInfo.remaining !== '∞' && (balanceInfo.remaining as number) < daysRequested) {
      setFormError(`Insufficient leave balance. You have ${balanceInfo.remaining} days remaining for ${getLeaveLabel(leaveType)}, but requested ${daysRequested} days.`);
      return;
    }

    if (!reason.trim() && (leaveType === LeaveType.SICK || leaveType === LeaveType.UNPAID)) {
      setFormError('Reason is required for this leave type.');
      return;
    }

    const finalSiteId = activeDeployments.length > 1 
      ? selectedSiteId 
      : (activeDeployments[0]?.siteId || '');

    try {
      await onSubmitRequest({ employeeId, leaveType, startDate, endDate, reason, supportingDoc, siteId: finalSiteId });
      // Reset form on success
      if (activeLeaveTypes.length > 0) setLeaveType(activeLeaveTypes[0].typeId);
      setSelectedSiteId('');
      setStartDate('');
      setEndDate('');
      setReason('');
      setSupportingDoc(null);
      setShowForm(false);
    } catch (error) {
      console.error("Leave request submission failed:", error);
      setFormError('Failed to submit request. Please check your connection and try again.');
    }
  };

  const getStatusColor = (status: RequestStatus) => {
    switch (status) {
      case RequestStatus.APPROVED: return 'bg-green-100 text-green-800';
      case RequestStatus.REJECTED: return 'bg-red-100 text-red-800';
      case RequestStatus.PENDING: return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStepName = (currentLevel: number, status: RequestStatus) => {
    if (status !== RequestStatus.PENDING) return status;

    if (!workflowConfigs || !roles) return `Level ${currentLevel}`;

    const config = workflowConfigs.find(c => c.moduleId === 'LEAVES');
    const levelConfig = config?.levels.find(l => l.level === currentLevel);
    const role = roles.find(r => r.id === levelConfig?.roleId);

    return role ? `Pending: ${role.name}` : `Level ${currentLevel}`;
  };

  const sortedRequests = [...existingRequests].sort((a, b) => new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime());

  return (
    <div className="bg-white shadow-xl rounded-lg p-6 md:p-8">

      {/* Balance Cards - Only show if policy allows */}
      {(!leavePolicy || leavePolicy.showBalancesToEmployees) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {activeLeaveTypes.map(typeConfig => {
            const bal = getBalance(typeConfig.typeId);
            return (
              <div key={typeConfig.typeId} className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex flex-col items-center text-center">
                <p className="text-xs font-bold text-gray-500 uppercase mb-1">{typeConfig.label}</p>
                <div className="text-xl font-black text-blue-600">
                  {bal.remaining} <span className="text-xs font-normal text-gray-400">/ {bal.total}</span>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">{bal.used} Used</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-between items-center mb-6 border-b pb-3">
        <h2 className="text-2xl font-semibold text-gray-800">My Leave Requests</h2>
        <Button onClick={() => setShowForm(!showForm)} variant="primary" size="sm">
          <PlusCircle size={16} className="mr-2" /> {showForm ? 'Cancel Request' : 'New Leave Request'}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-8 p-6 border rounded-lg bg-gray-50 space-y-4">
          <h3 className="text-lg font-medium text-gray-700 flex items-center">
            <Wallet size={20} className="mr-2 text-blue-500" /> Submit New Leave
          </h3>
          {activeDeployments.length > 1 && (
            <Select
              label="Select Site / Unit for Leave"
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              required
            >
              <option value="">-- Choose Site --</option>
              {activeDeployments.map(d => {
                const siteName = sites?.find(s => s.id === d.siteId)?.name || d.siteName || d.siteId;
                return <option key={d.id} value={d.siteId}>{siteName} ({d.type})</option>;
              })}
            </Select>
          )}
          <Select
            label="Leave Type"
            value={leaveType}
            onChange={(e) => setLeaveType(e.target.value)}
            required
          >
            <option value="" disabled>Select a leave type...</option>
            {activeLeaveTypes.map(lt => <option key={lt.typeId} value={lt.typeId}>{lt.label}</option>)}
          </Select>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min={today} // Or remove for backdated sick leave
              required
            />
            <Input
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate || today}
              required
            />
          </div>
          <Textarea
            label={`Reason for Leave ${(leaveType === LeaveType.SICK || leaveType === LeaveType.UNPAID) ? '(Required)' : '(Optional)'}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            required={leaveType === LeaveType.SICK || leaveType === LeaveType.UNPAID}
          />
          <Input
            label="Supporting Document / Medical Proof (Optional)"
            type="file"
            onChange={handleFileChange}
          />
          {supportingDoc && <p className="mt-1 text-sm text-gray-600">Selected: {supportingDoc.name}</p>}
          {formError && <p className="text-sm text-red-600 p-2 bg-red-50 rounded-md">{formError}</p>}
          <Button type="submit" variant="primary" className="w-full md:w-auto">Submit Request</Button>
        </form>
      )}

      <h3 className="text-lg font-medium text-gray-700 mb-4">Request History</h3>
      {sortedRequests.length === 0 ? (
        <div className="text-center py-6 bg-gray-50 rounded-md">
          <CalendarClock size={40} className="mx-auto text-gray-400 mb-2" />
          <p className="text-gray-500">You haven't submitted any leave requests yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Admin Comments</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedRequests.map(req => (
                <tr key={req.id}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{getLeaveLabel(req.leaveType)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{new Date(req.startDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{new Date(req.endDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 truncate max-w-xs">{req.reason || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <div className="flex flex-col">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full w-fit ${getStatusColor(req.status)}`}>
                        {req.status}
                      </span>
                      {req.status === RequestStatus.PENDING && (
                        <span className="text-[10px] text-gray-500 mt-1 font-medium">{getStepName(req.currentLevel, req.status)}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{new Date(req.submissionDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 truncate max-w-xs">{req.adminComments || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default EmployeeLeaveRequestPage;


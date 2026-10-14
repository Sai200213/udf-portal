import React, { useState, useEffect, useMemo } from 'react';
import { Search, Filter, Link2, Copy, Check, Trash2, ShieldAlert, RotateCcw, AlertTriangle, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { CorrectionRequest, FormSection, Role, Permission } from '../types';
import { getAllCorrectionRequests, revokeCorrectionRequest, deleteCorrectionRequest } from '../src/services/employeeService';
import Button from './common/Button';

interface AdminCorrectionRequestsPageProps {
  sections: FormSection[];
  isSuperAdmin?: boolean;
  userRole?: Role;
  onNotify: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  logAction?: (
    actionType: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE' | 'APPROVAL' | 'REJECTION' | 'LOGIN' | 'LOGOUT' | 'SUBMIT' | 'EXPORT',
    targetModule: 'SITES' | 'STAFF' | 'ROLES' | 'LEAVES' | 'EMPLOYEES' | 'SYSTEM' | 'AUTH' | 'SUBMISSION',
    details: string
  ) => void;
}

const AdminCorrectionRequestsPage: React.FC<AdminCorrectionRequestsPageProps> = ({
  sections,
  isSuperAdmin,
  userRole,
  onNotify,
  logAction
}) => {
  const [requests, setRequests] = useState<CorrectionRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load correction requests
  const fetchRequests = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const data = await getAllCorrectionRequests();
      setRequests(data);
    } catch (error: any) {
      console.error("Failed to fetch correction requests:", error);
      onNotify("Failed to fetch correction requests", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const hasManagePerm = isSuperAdmin || userRole?.permissions.includes(Permission.MANAGE_SUBMISSIONS);

  // Helper to translate field UUIDs to human-readable labels
  const getFieldLabel = (fieldId: string) => {
    for (const section of sections) {
      const field = section.fields.find(f => f.id === fieldId);
      if (field) return field.label;
    }
    return fieldId; // Fallback to raw field ID
  };

  // Copy Link Handler
  const handleCopyLink = (req: CorrectionRequest) => {
    const hostname = window.location.hostname;
    let baseOrigin = window.location.origin;

    if (hostname === 'admin.udfonline.in' || hostname.includes('admin.udfonline.in')) {
      baseOrigin = 'https://employee.udfonline.in';
    } else if (hostname.endsWith('-admin.web.app')) {
      baseOrigin = window.location.origin.replace('-admin.web.app', '-emp.web.app');
    } else if (hostname.endsWith('-admin.firebaseapp.com')) {
      baseOrigin = window.location.origin.replace('-admin.firebaseapp.com', '-emp.firebaseapp.com');
    }

    const link = `${baseOrigin}/correct-details?token=${req.id}`;
    navigator.clipboard.writeText(link)
      .then(() => {
        setCopiedId(req.id);
        onNotify("Correction link copied to clipboard!", "success");
        setTimeout(() => setCopiedId(null), 2000);
      })
      .catch(err => {
        console.error("Failed to copy link:", err);
        onNotify("Failed to copy link", "error");
      });
  };

  // Revoke Handler
  const handleRevoke = async (req: CorrectionRequest) => {
    if (!window.confirm(`Are you sure you want to revoke this correction link for ${req.applicantName}? The recipient will no longer be able to make edits.`)) {
      return;
    }
    try {
      await revokeCorrectionRequest(req.id);
      onNotify("Correction link revoked successfully.", "success");
      if (logAction) {
        logAction('UPDATE', 'SUBMISSION', `Revoked correction request ${req.id} for ${req.applicantName} (${req.targetId})`);
      }
      fetchRequests(true);
    } catch (error: any) {
      console.error("Failed to revoke request:", error);
      onNotify("Failed to revoke correction request", "error");
    }
  };

  // Delete Handler
  const handleDelete = async (req: CorrectionRequest) => {
    if (!window.confirm(`PERMANENT DELETE: Are you sure you want to delete this correction request for ${req.applicantName}?\nThis will remove the request permanently and clear the active token state on the target record.`)) {
      return;
    }
    try {
      await deleteCorrectionRequest(req.id, req.targetType, req.targetId);
      onNotify("Correction request deleted successfully.", "success");
      if (logAction) {
        logAction('DELETE', 'SUBMISSION', `Deleted correction request ${req.id} for ${req.applicantName} (${req.targetId})`);
      }
      fetchRequests(true);
    } catch (error: any) {
      console.error("Failed to delete request:", error);
      onNotify("Failed to delete correction request", "error");
    }
  };

  // Filtered Requests
  const filteredRequests = useMemo(() => {
    const now = new Date();
    return requests.filter(req => {
      const isExpired = req.status === 'expired' || new Date(req.expiresAt) < now;
      const computedStatus = req.status === 'pending' && isExpired ? 'expired' : req.status;

      const matchesSearch =
        req.applicantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.targetId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.createdBy.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        filterStatus === 'ALL' ||
        (filterStatus === 'pending' && computedStatus === 'pending') ||
        (filterStatus === 'completed' && computedStatus === 'completed') ||
        (filterStatus === 'expired' && computedStatus === 'expired');

      const matchesType = filterType === 'ALL' || req.targetType === filterType;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [requests, searchTerm, filterStatus, filterType]);

  const getStatusBadge = (status: 'pending' | 'completed' | 'expired', expiresAt: string) => {
    const now = new Date();
    const isExpired = status === 'expired' || new Date(expiresAt) < now;
    
    if (status === 'completed') {
      return (
        <span className="flex items-center w-fit px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-green-100 text-green-700 border border-green-200">
          <CheckCircle2 size={10} className="mr-1" /> Used / Done
        </span>
      );
    }
    
    if (isExpired) {
      return (
        <span className="flex items-center w-fit px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-100 text-red-700 border border-red-200">
          <AlertCircle size={10} className="mr-1" /> Expired
        </span>
      );
    }

    return (
      <span className="flex items-center w-fit px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-blue-700 border border-blue-200">
        <Clock size={10} className="mr-1 animate-pulse" /> Active / Pending
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Auditing Info Card */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center">
              <Link2 className="mr-2 text-slate-600 animate-in fade-in" /> Secure Correction Links
            </h2>
            <p className="text-sm text-gray-500">Manage, revoke, or audit temporary data correction tokens sent to employees and applicants.</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fetchRequests()}
            disabled={isLoading}
            className="mt-2 md:mt-0"
          >
            <RotateCcw size={14} className={`mr-1.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh List
          </Button>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-col md:flex-row gap-4 mt-6">
          <div className="flex-grow relative">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
            <input
              type="text"
              className="pl-10 w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="Search by name, target ID, or creator admin..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="w-full md:w-48 relative">
            <Filter className="absolute left-3 top-2.5 text-gray-400" size={18} />
            <select
              className="pl-10 w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="pending">Active / Pending</option>
              <option value="completed">Used / Done</option>
              <option value="expired">Expired</option>
            </select>
          </div>
          <div className="w-full md:w-48 relative">
            <Filter className="absolute left-3 top-2.5 text-gray-400" size={18} />
            <select
              className="pl-10 w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
            >
              <option value="ALL">All Targets</option>
              <option value="employee">Approved Employee</option>
              <option value="submission">Pending Submission</option>
            </select>
          </div>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recipient</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target Scope</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requested Corrections</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lifespan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Creator</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Policy</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <RotateCcw size={24} className="animate-spin text-blue-500" />
                      <span className="text-sm font-medium">Fetching secure tokens...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-400 italic">
                    No matching correction requests found.
                  </td>
                </tr>
              ) : (
                filteredRequests.map(req => {
                  const isExpired = req.status === 'expired' || new Date(req.expiresAt) < new Date();
                  const canRevokeActive = req.status === 'pending' && !isExpired;

                  return (
                    <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                      {/* Recipient */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-900">{req.applicantName}</div>
                      </td>

                      {/* Target Scope */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col space-y-1">
                          <span className={`w-fit px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight ${req.targetType === 'employee' ? 'bg-purple-100 text-purple-800' : 'bg-amber-100 text-amber-800'}`}>
                            {req.targetType === 'employee' ? 'Employee' : 'Onboarding'}
                          </span>
                          <span className="text-xs font-mono text-gray-500">{req.targetId}</span>
                        </div>
                      </td>

                      {/* Requested Corrections */}
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {req.requestedFields.map(fieldId => (
                            <span key={fieldId} className="px-2 py-0.5 text-xs bg-slate-100 text-slate-700 rounded border border-slate-200" title={fieldId}>
                              {getFieldLabel(fieldId)}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Lifespan */}
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                        <div className="flex flex-col space-y-1">
                          <div><span className="font-semibold text-gray-400 uppercase tracking-tight text-[9px] mr-1">Created:</span>{new Date(req.createdAt).toLocaleString()}</div>
                          <div><span className="font-semibold text-gray-400 uppercase tracking-tight text-[9px] mr-1">Expires:</span>{new Date(req.expiresAt).toLocaleString()}</div>
                        </div>
                      </td>

                      {/* Creator */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {req.createdBy}
                      </td>

                      {/* Storage Policy */}
                      <td className="px-6 py-4 whitespace-nowrap text-xs">
                        {req.deleteOldFiles ? (
                          <span className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100 font-semibold" title="Replaced documents are automatically deleted from Storage on submit.">
                            Clean Replace
                          </span>
                        ) : (
                          <span className="text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 font-semibold" title="Replaced documents are left in Storage; only their URLs are updated.">
                            Keep Old Files
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(req.status, req.expiresAt)}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          {/* Copy Link */}
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleCopyLink(req)}
                            title="Copy Correction Link"
                            className="bg-white hover:bg-slate-50"
                          >
                            {copiedId === req.id ? (
                              <Check size={14} className="text-green-600 animate-bounce" />
                            ) : (
                              <Copy size={14} className="text-gray-500" />
                            )}
                          </Button>

                          {/* Revoke (Mark Expired) */}
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleRevoke(req)}
                            disabled={!canRevokeActive || !hasManagePerm}
                            title={canRevokeActive ? "Revoke / Expire Link" : "Cannot Revoke (Already Expired/Used)"}
                            className={`bg-white ${canRevokeActive ? 'hover:bg-amber-50 hover:border-amber-200' : 'opacity-40 cursor-not-allowed'}`}
                          >
                            <ShieldAlert size={14} className={canRevokeActive ? 'text-amber-500' : 'text-gray-400'} />
                          </Button>

                          {/* Permanently Delete */}
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleDelete(req)}
                            disabled={!hasManagePerm}
                            title="Delete Request and Token"
                            className="bg-white hover:bg-red-50 hover:border-red-200"
                          >
                            <Trash2 size={14} className="text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminCorrectionRequestsPage;

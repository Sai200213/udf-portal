
import React, { useState, useMemo } from 'react';
import { ResignationRequest, SubmittedFormData, RequestStatus, FormSection, Role, WorkflowConfig } from '../../types';
import Button from '../common/Button';
import Input from '../common/Input';
import Textarea from '../common/Textarea';
import Modal from '../common/Modal';
import { UserMinus, AlertTriangle, Info, FileText, CheckCircle } from 'lucide-react';

interface EmployeeResignationPageProps {
  employeeId: string;
  employeeData: SubmittedFormData;
  existingRequests: ResignationRequest[];
  onSubmitRequest: (requestData: any) => void;
  formSections: FormSection[];
  roles?: Role[];
  workflowConfigs?: WorkflowConfig[];
  activeAssignments?: any[];
  sites?: any[];
}

const EmployeeResignationPage: React.FC<EmployeeResignationPageProps> = ({
  employeeId, employeeData, existingRequests, onSubmitRequest, formSections, roles, workflowConfigs,
  activeAssignments = [], sites = []
}) => {
  const [resignationDate, setResignationDate] = useState('');
  const [reason, setReason] = useState('');
  const [supportingDoc, setSupportingDoc] = useState<File | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState('');

  // State for the notice period popup
  const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false);
  const [calculatedRelievingDate, setCalculatedRelievingDate] = useState('');

  const today = new Date().toISOString().split('T')[0];

  // Helper to find Unit
  const unitValue = useMemo(() => {
    if (!formSections || !Array.isArray(formSections)) return 'N/A';
    const unitField = formSections
      .flatMap(s => s.fields || [])
      .find(f => f && f.label && (f.label.toLowerCase().includes('unit') || f.label.toLowerCase().includes('facility')));
    return unitField ? String((employeeData?.data || {})[unitField.id] || 'N/A') : 'N/A';
  }, [formSections, employeeData]);

  // Helper to find Name (already available in employeeData but good for display consistency)
  const employeeName = useMemo(() => {
    // Usually mapped in App.tsx but we can check data
    // For simplicity, we use the prop passed down implicitly if needed, but the form data is better
    // For this form, we can just use ID/Unit as visual cues
    return 'Employee';
  }, []);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateVal = e.target.value;
    setResignationDate(dateVal);
    if (dateVal) {
      const rDate = new Date(dateVal);
      rDate.setDate(rDate.getDate() + 30); // 30 Days Notice
      setCalculatedRelievingDate(rDate.toISOString().split('T')[0]);
      setIsNoticeModalOpen(true);
    }
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

    if (activeDeployments.length > 1 && !selectedSiteId) {
      alert("Please select which site you are resigning from.");
      return;
    }

    if (!resignationDate || !reason || !supportingDoc) {
      alert("Please fill all required fields and upload the resignation letter.");
      return;
    }

    const finalSiteId = activeDeployments.length > 1 
      ? selectedSiteId 
      : (activeDeployments[0]?.siteId || '');

    const selectedSiteObj = sites?.find(s => s.id === finalSiteId);
    const finalUnitValue = selectedSiteObj ? selectedSiteObj.name : unitValue;

    try {
      await onSubmitRequest({
        employeeId,
        unit: finalUnitValue,
        siteId: finalSiteId,
        resignationDate,
        relievingDate: calculatedRelievingDate, // Default to calculated
        reason,
        document: supportingDoc
      });

      // Reset
      setSelectedSiteId('');
      setResignationDate('');
      setReason('');
      setSupportingDoc(null);
      setShowForm(false);
    } catch (error) {
      console.error("Resignation submission failed:", error);
      alert("Failed to submit resignation. Please check your connection and try again.");
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

    const config = workflowConfigs.find(c => c.moduleId === 'RESIGNATIONS');
    const levelConfig = config?.levels.find(l => l.level === currentLevel);
    const role = roles.find(r => r.id === levelConfig?.roleId);

    return role ? `Pending: ${role.name}` : `Level ${currentLevel}`;
  };

  const sortedRequests = [...(existingRequests || [])].sort((a, b) => {
    const timeA = a.submissionDate ? new Date(a.submissionDate).getTime() : 0;
    const timeB = b.submissionDate ? new Date(b.submissionDate).getTime() : 0;
    return timeB - timeA;
  });

  return (
    <div className="bg-white shadow-xl rounded-lg p-6 md:p-8">
      <div className="flex justify-between items-center mb-6 border-b pb-3">
        <h2 className="text-2xl font-semibold text-gray-800">Resignation & Exit</h2>
        <Button onClick={() => setShowForm(!showForm)} variant="danger" size="sm" className="bg-red-600 hover:bg-red-700">
          <UserMinus size={16} className="mr-2" /> {showForm ? 'Cancel' : 'Submit Resignation'}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-8 p-6 border border-red-200 rounded-lg bg-red-50 space-y-4">
          <h3 className="text-lg font-medium text-red-800 mb-4">Resignation Form</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 rounded-md border border-red-100 mb-2">
            <div>
              <span className="block text-xs text-gray-500 uppercase font-bold">Employee ID</span>
              <span className="font-mono font-medium">{employeeId}</span>
            </div>
            {activeDeployments.length <= 1 ? (
              <div>
                <span className="block text-xs text-gray-500 uppercase font-bold">Current Unit</span>
                <span className="font-medium">{unitValue}</span>
              </div>
            ) : (
              <div>
                <span className="block text-xs text-gray-500 uppercase font-bold text-red-600">Select Resigning Site *</span>
                <select
                  value={selectedSiteId}
                  onChange={e => setSelectedSiteId(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-350 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border font-medium text-gray-800 bg-white"
                  required
                >
                  <option value="">-- Choose Site --</option>
                  {activeDeployments.map(d => {
                    const siteName = sites?.find(s => s.id === d.siteId)?.name || d.siteName || d.siteId;
                    return <option key={d.id} value={d.siteId}>{siteName} ({d.type})</option>;
                  })}
                </select>
              </div>
            )}
          </div>

          <Input
            label="Resignation Date (Today/Proposed Last Day)"
            type="date"
            value={resignationDate}
            onChange={handleDateChange}
            min={today}
            required
          />
          {calculatedRelievingDate && (
            <div className="text-sm bg-blue-50 text-blue-700 p-2 rounded flex items-center">
              <Info size={16} className="mr-2" />
              Estimated Relieving Date based on Notice Period: <strong>{new Date(calculatedRelievingDate).toLocaleDateString()}</strong>
            </div>
          )}

          <Textarea
            label="Reason for Resignation"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            required
            placeholder="Please detail your reasons..."
          />

          <Input
            label="Upload Signed Resignation Letter (PDF/Image)"
            type="file"
            onChange={handleFileChange}
            required
            accept=".pdf,.jpg,.jpeg,.png"
          />
          {supportingDoc && <p className="text-sm text-gray-600">File selected: {supportingDoc.name}</p>}

          <Button type="submit" variant="primary" className="w-full md:w-auto bg-red-600 hover:bg-red-700 focus:ring-red-500">Submit Resignation</Button>
        </form>
      )}

      <h3 className="text-lg font-medium text-gray-700 mb-4">Submission History</h3>
      {sortedRequests.length === 0 ? (
        <div className="text-center py-6 bg-gray-50 rounded-md">
          <UserMinus size={40} className="mx-auto text-gray-400 mb-2" />
          <p className="text-gray-500">No resignation requests submitted.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted On</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resignation Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Relieving Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Approver Comments</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedRequests.map(req => (
                <tr key={req.id}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{new Date(req.submissionDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{new Date(req.resignationDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-blue-600">{new Date(req.relievingDate).toLocaleDateString()}</td>
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
                  <td className="px-4 py-3 text-sm text-gray-500 truncate max-w-xs">{req.adminComments || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Notice Period Modal */}
      <Modal isOpen={isNoticeModalOpen} onClose={() => setIsNoticeModalOpen(false)} title="Notice Period Policy">
        <div className="text-center space-y-4">
          <div className="mx-auto w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-600">
            <AlertTriangle size={24} />
          </div>
          <h3 className="text-lg font-bold text-gray-900">Important Note</h3>
          <p className="text-gray-600">
            Based on your selected resignation date of <strong>{new Date(resignationDate).toLocaleDateString()}</strong>,
            your standard 30-day notice period will end on:
          </p>
          <p className="text-2xl font-bold text-blue-600">{new Date(calculatedRelievingDate).toLocaleDateString()}</p>
          <p className="text-sm text-gray-500">
            Your Relieving Date is subject to approval and may be adjusted by the Field Officer or HR.
          </p>
          <div className="pt-4">
            <Button onClick={() => setIsNoticeModalOpen(false)} variant="primary" className="w-full">
              I Understand & Accept
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default EmployeeResignationPage;


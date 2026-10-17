
import React, { useState, useMemo } from 'react';
import { DisciplinaryAction, DisciplinaryActionType, SubmittedFormData, SubmissionStatus, Role, Permission, FormSection, Site, User } from '../types';
import Button from './common/Button';
import Modal from './common/Modal';
import Textarea from './common/Textarea';
import Select from './common/Select';
import Input from './common/Input';
import { Gavel, AlertTriangle, Info, Plus, Search, Shield, Trash2, Loader2 } from 'lucide-react';
import { getApplicantName } from '../utils/formDataHelper';
import { getEmployeeLookupMap } from '../src/services/employeeService';

interface AdminDisciplinaryPageProps {
  disciplinaryActions: DisciplinaryAction[];
  onAddDiscipline: (actionData: Omit<DisciplinaryAction, 'id' | 'filedBy' | 'filedByRoleId'>) => void;
  submittedForms: SubmittedFormData[];
  formSections: FormSection[];
  userRole?: Role;
  isSuperAdmin: boolean;
  sites: Site[];
  authUser: User | null;
  onDeleteDiscipline: (actionId: string) => void;
  allowedSiteIds?: string[];
}

const AdminDisciplinaryPage: React.FC<AdminDisciplinaryPageProps> = ({
  disciplinaryActions, onAddDiscipline, onDeleteDiscipline, submittedForms, formSections, userRole, isSuperAdmin, sites, authUser, allowedSiteIds
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [employeeLookup, setEmployeeLookup] = useState<Record<string, { name: string, siteName: string }>>({});
  const [isLookupLoading, setIsLookupLoading] = useState(false);

  // Form State
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [actionType, setActionType] = useState<DisciplinaryActionType>(DisciplinaryActionType.VERBAL_WARNING);
  const [incidentDate, setIncidentDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [supportingDoc, setSupportingDoc] = useState<File | null>(null);

  const hasManagePerm = isSuperAdmin || userRole?.permissions.includes(Permission.MANAGE_DISCIPLINE);

  // Load employee lookup for site filtering and dropdown
  React.useEffect(() => {
    const fetchLookup = async () => {
      setIsLookupLoading(true);
      try {
        const { defaultFormSections } = await import('../src/constants/defaults');
        const map = await getEmployeeLookupMap(defaultFormSections, allowedSiteIds);
        setEmployeeLookup(map);
      } catch (err) {
        console.error("Error fetching employee lookup:", err);
      } finally {
        setIsLookupLoading(false);
      }
    };
    fetchLookup();
  }, [allowedSiteIds]);

  const approvedEmployeesLookup = Object.entries(employeeLookup).map(([id, info]: [string, any]) => ({
    employeeId: id,
    applicantName: info.name,
    siteName: info.siteName
  }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId || !description.trim()) {
      alert("Please select an employee and provide a description.");
      return;
    }

    const empInfo = employeeLookup[selectedEmployeeId];
    const employeeName = empInfo ? empInfo.name : 'Unknown';
    const siteId = (empInfo as any)?.siteId || undefined;

    onAddDiscipline({
      employeeId: selectedEmployeeId,
      employeeName,
      actionType,
      date: incidentDate,
      description,
      siteId,
      document: supportingDoc || undefined
    });

    setIsModalOpen(false);
    // Reset Form
    setSelectedEmployeeId('');
    setActionType(DisciplinaryActionType.VERBAL_WARNING);
    setDescription('');
    setSupportingDoc(null);
  };

  const getSeverityColor = (type: DisciplinaryActionType) => {
    switch (type) {
      case DisciplinaryActionType.VERBAL_WARNING: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case DisciplinaryActionType.WRITTEN_WARNING: return 'bg-orange-100 text-orange-800 border-orange-200';
      case DisciplinaryActionType.SHOW_CAUSE: return 'bg-red-50 text-red-600 border-red-100';
      case DisciplinaryActionType.SUSPENSION: return 'bg-red-100 text-red-800 border-red-200 font-bold';
      case DisciplinaryActionType.TERMINATION: return 'bg-black text-white border-gray-800 font-bold';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const hasDisciplineScopeAll = isSuperAdmin || userRole?.permissions.includes(Permission.DISCIPLINE_VIEW_SCOPE_ALL);

  const filteredActions = disciplinaryActions.filter(action => {
    if (!hasDisciplineScopeAll && allowedSiteIds && allowedSiteIds.length > 0) {
      if (action.siteId && !allowedSiteIds.includes(action.siteId)) return false;
    }
    const matchesSearch = action.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      action.employeeId.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-lg shadow-sm border border-gray-200 gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center">
            <Gavel className="mr-2 text-red-600" /> Disciplinary Action Log
          </h2>
          <p className="text-sm text-gray-500 mt-1">Record and track warnings, notices, and disciplinary measures.</p>
        </div>
        <div className="flex space-x-3">
          {userRole?.name.toLowerCase().includes('field officer') && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-md text-xs font-bold flex items-center">
              <Shield size={14} className="mr-2" /> Showing Assigned Sites Only
            </div>
          )}
          {hasManagePerm ? (
            <Button onClick={() => setIsModalOpen(true)} variant="danger" className="shrink-0">
              <Plus size={18} className="mr-2" /> Issue Action
            </Button>
          ) : (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-md text-sm font-bold flex items-center">
              <Info size={16} className="mr-2" /> READ-ONLY VIEW
            </div>
          )}
        </div>
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search size={18} className="text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search by Employee Name or ID..."
          className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm py-2 border"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Filed By</th>
              {isSuperAdmin && <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredActions.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-400 italic">No disciplinary records found.</td></tr>
            ) : filteredActions.map(action => (
              <tr key={action.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-bold text-gray-900">{action.employeeName}</div>
                  <div className="text-xs text-gray-500 font-mono">{action.employeeId}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 rounded text-xs border ${getSeverityColor(action.actionType)}`}>
                    {action.actionType}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {new Date(action.date).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate" title={action.description}>
                  {action.description}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                  {action.filedBy}
                </td>
                {isSuperAdmin && (
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <button
                      onClick={() => onDeleteDiscipline?.(action.id)}
                      className="text-red-400 hover:text-red-700 transition-colors"
                      title="Delete Record"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Issue Disciplinary Action" size="lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-red-50 p-3 rounded border border-red-100 flex items-start text-sm text-red-700 mb-4">
              <AlertTriangle size={18} className="mr-2 flex-shrink-0 mt-0.5" />
              <p>This action will be permanently recorded in the employee's file. Please ensure all details are accurate.</p>
            </div>

            <Select
              label="Select Employee"
              value={selectedEmployeeId}
              onChange={e => setSelectedEmployeeId(e.target.value)}
              required
              disabled={isLookupLoading}
            >
              <option value="">{isLookupLoading ? "Loading employees..." : "-- Choose Employee --"}</option>
              {approvedEmployeesLookup.map(emp => (
                <option key={emp.employeeId} value={emp.employeeId || ''}>
                  {emp.applicantName} ({emp.employeeId})
                </option>
              ))}
            </Select>

            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Action Severity"
                value={actionType}
                onChange={e => setActionType(e.target.value as DisciplinaryActionType)}
                required
              >
                {Object.values(DisciplinaryActionType).map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </Select>
              <Input
                label="Incident Date"
                type="date"
                value={incidentDate}
                onChange={e => setIncidentDate(e.target.value)}
                required
              />
            </div>

            <Textarea
              label="Incident Description & Remarks"
              rows={4}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the violation or reason for action..."
              required
            />

            <Input
              label="Upload Warning Letter / Proof (Optional)"
              type="file"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  setSupportingDoc(e.target.files[0]);
                } else {
                  setSupportingDoc(null);
                }
              }}
              accept=".pdf,.jpg,.jpeg,.png"
            />
            {supportingDoc && <p className="text-sm text-gray-600">Selected: {supportingDoc.name}</p>}

            <div className="pt-4 flex justify-end space-x-2 border-t border-gray-100 mt-4">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit" variant="danger">Log Action</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default AdminDisciplinaryPage;



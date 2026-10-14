
import React, { useState, useMemo } from 'react';
import { AccountUpdateRequest, SubmittedFormData, RequestStatus, FormField, FieldType, Role, WorkflowConfig } from '../../types';
import Button from '../common/Button';
import Input from '../common/Input';
import Select from '../common/Select';
import Textarea from '../common/Textarea';
import { Edit, Send, FileText, Info } from 'lucide-react';

interface EmployeeAccountUpdatePageProps {
  employeeId: string;
  employeeData: SubmittedFormData; // To get current values and field definitions
  existingRequests: AccountUpdateRequest[];
  // Corrected Omit type to match the handler in App.tsx
  onSubmitRequest: (requestData: Omit<AccountUpdateRequest, 'id' | 'status' | 'submissionDate' | 'employeeName' | 'currentLevel' | 'approvalHistory' | 'adminComments'>) => void;
  allowedFieldIds?: string[];
  roles?: Role[];
  workflowConfigs?: WorkflowConfig[];
}

const EmployeeAccountUpdatePage: React.FC<EmployeeAccountUpdatePageProps> = ({
  employeeId, employeeData, existingRequests, onSubmitRequest, allowedFieldIds = [], roles, workflowConfigs
}) => {
  const [selectedFieldId, setSelectedFieldId] = useState<string>('');
  const [requestedValue, setRequestedValue] = useState<any>('');
  const [reason, setReason] = useState('');
  const [supportingDoc, setSupportingDoc] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const editableFields = useMemo(() => {
    const fields: FormField[] = [];
    (employeeData?.originalFormSections || []).forEach(section => {
      (section.fields || []).forEach(field => {
        // Filter based on allowedFieldIds passed from App config
        if (allowedFieldIds.includes(field.id)) {
          if (!fields.find(f => f.id === field.id)) {
            fields.push(field);
          }
        }
      });
    });
    return fields.sort((a, b) => a.label.localeCompare(b.label));
  }, [employeeData?.originalFormSections, allowedFieldIds]);

  const selectedFieldDefinition = useMemo(() => {
    return editableFields.find(f => f.id === selectedFieldId);
  }, [selectedFieldId, editableFields]);

  const currentValue = useMemo(() => {
    if (selectedFieldId) {
      return employeeData.data[selectedFieldId];
    }
    return undefined;
  }, [selectedFieldId, employeeData.data]);

  const handleFieldChange = (fieldId: string) => {
    setSelectedFieldId(fieldId);
    // Reset requested value when field changes, according to field type
    const fieldDef = editableFields.find(f => f.id === fieldId);
    if (fieldDef) {
      if (fieldDef.type === FieldType.CHECKBOX) setRequestedValue([]);
      else if (fieldDef.type === FieldType.FILE_UPLOAD) setRequestedValue(null);
      else setRequestedValue('');
    } else {
      setRequestedValue('');
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSupportingDoc(event.target.files[0]);
    } else {
      setSupportingDoc(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedFieldId || !selectedFieldDefinition) {
      setFormError('Please select a field to update.');
      return;
    }

    let finalRequestedValue = requestedValue;
    // Basic validation for requested value based on type
    if (selectedFieldDefinition.type === FieldType.CHECKBOX && (!Array.isArray(requestedValue) || requestedValue.length === 0)) {
      finalRequestedValue = []; // Ensure it's an empty array if nothing selected
    } else if (selectedFieldDefinition.type !== FieldType.CHECKBOX && (requestedValue === undefined || String(requestedValue).trim() === '')) {
      if (selectedFieldDefinition.type !== FieldType.FILE_UPLOAD) { // File upload can be empty if removing a file
        setFormError('New value cannot be empty.');
        return;
      }
    }

    // For file upload, requestedValue is the File object
    if (selectedFieldDefinition.type === FieldType.FILE_UPLOAD) {
      finalRequestedValue = supportingDoc; // The file itself is the new value
    }


    try {
      await onSubmitRequest({
        employeeId,
        fieldId: selectedFieldId,
        fieldLabel: selectedFieldDefinition.label,
        currentValue: currentValue,
        requestedValue: finalRequestedValue,
        reason,
        supportingDocument: selectedFieldDefinition.type === FieldType.FILE_UPLOAD ? finalRequestedValue : supportingDoc, // Pass main doc as value for file, or separate for others
      });

      // Reset form
      setSelectedFieldId('');
      setRequestedValue('');
      setReason('');
      setSupportingDoc(null);
      setShowForm(false);
    } catch (error) {
      console.error("Account update submission failed:", error);
      setFormError('Failed to submit request. Please check your connection and try again.');
    }
  };

  const renderValueInput = () => {
    if (!selectedFieldDefinition) return null;

    switch (selectedFieldDefinition.type) {
      case FieldType.TEXT:
        return <Input label="New Value" type="text" value={requestedValue} onChange={e => setRequestedValue(e.target.value)} required />;
      case FieldType.TEXTAREA:
        return <Textarea label="New Value" value={requestedValue} onChange={e => setRequestedValue(e.target.value)} required rows={3} />;
      case FieldType.DATE:
        return <Input label="New Value" type="date" value={requestedValue} onChange={e => setRequestedValue(e.target.value)} required />;
      case FieldType.DROPDOWN:
        return (
          <Select label="New Value" value={requestedValue} onChange={e => setRequestedValue(e.target.value)} required>
            <option value="" disabled>Select new {selectedFieldDefinition.label.toLowerCase()}...</option>
            {(selectedFieldDefinition.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </Select>
        );
      case FieldType.RADIO:
        return (
          <fieldset className="mt-2">
            <legend className="text-sm font-medium text-gray-700 mb-1">New Value</legend>
            {(selectedFieldDefinition.options || []).map(opt => (
              <div key={opt} className="flex items-center my-1">
                <input type="radio" id={`update-${opt}`} name="update-radio" value={opt} checked={requestedValue === opt} onChange={e => setRequestedValue(e.target.value)} className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500" />
                <label htmlFor={`update-${opt}`} className="ml-2 block text-sm text-gray-900">{opt}</label>
              </div>
            ))}
          </fieldset>
        );
      case FieldType.CHECKBOX:
        const currentSelections = Array.isArray(requestedValue) ? requestedValue : [];
        return (
          <fieldset className="mt-2">
            <legend className="text-sm font-medium text-gray-700 mb-1">New Value (select all that apply)</legend>
            {(selectedFieldDefinition.options || []).map(opt => (
              <div key={opt} className="flex items-center my-1">
                <input type="checkbox" id={`update-${opt}`} value={opt} checked={currentSelections.includes(opt)}
                  onChange={e => {
                    const newSelections = e.target.checked
                      ? [...currentSelections, opt]
                      : currentSelections.filter(v => v !== opt);
                    setRequestedValue(newSelections);
                  }}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                <label htmlFor={`update-${opt}`} className="ml-2 block text-sm text-gray-900">{opt}</label>
              </div>
            ))}
          </fieldset>
        );
      case FieldType.FILE_UPLOAD:
        // For file upload, the 'requestedValue' is actually the file input itself.
        // The actual File object will be taken from `supportingDoc` state.
        return (
          <div>
            <Input label="New File (Optional)" type="file" onChange={handleFileChange} />
            {supportingDoc && <p className="mt-1 text-sm text-gray-600">Selected: {supportingDoc.name}</p>}
            <p className="text-xs text-gray-500 mt-1">To remove an existing file, leave this blank or explicitly state removal in reason.</p>
          </div>
        );
      default:
        return <Input label="New Value" type="text" value={requestedValue} onChange={e => setRequestedValue(e.target.value)} required />;
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

    const config = workflowConfigs.find(c => c.moduleId === 'ACCOUNT_UPDATES');
    const levelConfig = config?.levels.find(l => l.level === currentLevel);
    const role = roles.find(r => r.id === levelConfig?.roleId);

    return role ? `Pending: ${role.name}` : `Level ${currentLevel}`;
  };

  const sortedRequests = [...existingRequests].sort((a, b) => new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime());

  const displayValue = (value: any, fieldDef?: FormField) => {
    if (value === null || value === undefined) return <span className="italic text-gray-500">N/A</span>;
    if (fieldDef?.type === FieldType.FILE_UPLOAD && value instanceof File) return <span className="text-blue-600 flex items-center"><FileText size={14} className="mr-1" />{value.name}</span>;
    if (fieldDef?.type === FieldType.FILE_UPLOAD && typeof value === 'string') return <span className="text-blue-600 flex items-center"><FileText size={14} className="mr-1" />{value}</span>; // If only filename stored
    if (Array.isArray(value)) return value.join(', ') || <span className="italic text-gray-500">None</span>;
    return String(value);
  };


  return (
    <div className="bg-white shadow-xl rounded-lg p-6 md:p-8">
      <div className="flex justify-between items-center mb-6 border-b pb-3">
        <h2 className="text-2xl font-semibold text-gray-800">Request Account Updates</h2>
        <Button onClick={() => setShowForm(!showForm)} variant="primary" size="sm">
          <Edit size={16} className="mr-2" /> {showForm ? 'Cancel Update Request' : 'New Update Request'}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-8 p-6 border rounded-lg bg-gray-50 space-y-4">
          <h3 className="text-lg font-medium text-gray-700">Submit New Update</h3>
          {editableFields.length === 0 ? (
            <p className="text-orange-600 bg-orange-50 p-3 rounded-md">
              <Info size={16} className="inline mr-2" /> No fields are currently configured as editable by the Admin.
            </p>
          ) : (
            <>
              <Select
                label="Field to Update"
                value={selectedFieldId}
                onChange={(e) => handleFieldChange(e.target.value)}
                required
              >
                <option value="" disabled>Select a field...</option>
                {editableFields.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
              </Select>

              {selectedFieldId && (
                <div className="p-3 border rounded-md bg-gray-100">
                  <p className="text-sm text-gray-600">Current Value for <span className="font-medium">{selectedFieldDefinition?.label}</span>:</p>
                  <p className="text-md font-semibold">{displayValue(currentValue, selectedFieldDefinition)}</p>
                </div>
              )}

              {selectedFieldDefinition && renderValueInput()}

              <Textarea
                label="Reason for Change (Optional)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
              />
              {selectedFieldDefinition && selectedFieldDefinition.type !== FieldType.FILE_UPLOAD && ( // Show general supporting doc for non-file fields
                <Input
                  label="Supporting Document (Optional)"
                  type="file"
                  onChange={handleFileChange}
                />
              )}
              {supportingDoc && selectedFieldDefinition?.type !== FieldType.FILE_UPLOAD && <p className="mt-1 text-sm text-gray-600">Selected document: {supportingDoc.name}</p>}


              {formError && <p className="text-sm text-red-600 p-2 bg-red-50 rounded-md">{formError}</p>}
              <Button type="submit" variant="primary" className="w-full md:w-auto" disabled={!selectedFieldId}>
                <Send size={16} className="mr-2" /> Submit Update Request
              </Button>
            </>
          )}
        </form>
      )}

      <h3 className="text-lg font-medium text-gray-700 mb-4">Update Request History</h3>
      {sortedRequests.length === 0 ? (
        <div className="text-center py-6 bg-gray-50 rounded-md">
          <Info size={40} className="mx-auto text-gray-400 mb-2" />
          <p className="text-gray-500">You haven't submitted any account update requests yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Field</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requested Value</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Admin Comments</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedRequests.map(req => (
                <tr key={req.id}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{req.fieldLabel}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 truncate max-w-xs">{displayValue(req.requestedValue)}</td>
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

export default EmployeeAccountUpdatePage;


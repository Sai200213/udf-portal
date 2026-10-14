
import React, { useState, useEffect, useCallback } from 'react';
import Modal from './common/Modal';
import Input from './common/Input';
import Select from './common/Select';
import Textarea from './common/Textarea';
import Button from './common/Button';
import { FieldType, FormField, FieldEditorModalProps, Role, Site } from '../types';
import { AVAILABLE_FIELD_TYPES, FIELD_TYPES_WITH_OPTIONS } from '../constants';
import { Shield, ListTree } from 'lucide-react';

const FieldEditorModal: React.FC<FieldEditorModalProps> = ({ isOpen, onClose, onSave, existingField, sectionId, availableFields, roles, sites }) => {
  const [label, setLabel] = useState('');
  const [type, setType] = useState<FieldType>(FieldType.TEXT);
  const [isMandatory, setIsMandatory] = useState(false);
  const [optionsStr, setOptionsStr] = useState(''); // Comma-separated

  // Validation Settings
  const [minLength, setMinLength] = useState<number | undefined>(undefined);
  const [maxLength, setMaxLength] = useState<number | undefined>(undefined);
  const [allowedPattern, setAllowedPattern] = useState<'alphabets' | 'numbers' | 'numbers_only' | 'alphanumeric' | 'any' | 'alphanumeric_special'>('any');
  const [allowedFileTypes, setAllowedFileTypes] = useState('');
  const [maxFileSizeMB, setMaxFileSizeMB] = useState<number | undefined>(undefined);
  const [minAge, setMinAge] = useState<number | undefined>(undefined);

  // Visibility Logic
  const [condFieldId, setCondFieldId] = useState('');
  const [condOperator, setCondOperator] = useState<'equals' | 'not_equals' | 'contains'>('equals');
  const [condValue, setCondValue] = useState('');


  // Dependent Dropdown (Unit-Based Post Filtering)
  const [parentFieldId, setParentFieldId] = useState('');
  const [optionsMap, setOptionsMap] = useState<Record<string, string[]>>({});

  const resetForm = useCallback(() => {
    if (existingField) {
      setLabel(existingField.label);
      setType(existingField.type);
      setIsMandatory(existingField.isMandatory);
      setOptionsStr(existingField.options ? existingField.options.join(', ') : '');
      setMinLength(existingField.minLength);
      setMaxLength(existingField.maxLength);
      setAllowedPattern(existingField.allowedPattern || 'any');
      setAllowedFileTypes(existingField.allowedFileTypes || '');
      setMaxFileSizeMB(existingField.maxFileSizeMB);
      setMinAge(existingField.minAge);
      setCondFieldId(existingField.visibilityCondition?.fieldId || '');
      setCondOperator(existingField.visibilityCondition?.operator || 'equals');
      setCondValue(existingField.visibilityCondition?.value || '');
      // @ts-ignore - added to interface
      setParentFieldId(existingField.parentFieldId || '');
      setOptionsMap(existingField.optionsMap || {});
    } else {
      setLabel('');
      setType(FieldType.TEXT);
      // ... existing reset logic check line numbers below carefully ...
      // Since the diff block is small, I will rewrite the relevant part of reset logic
      setIsMandatory(false);
      setOptionsStr('');
      setMinLength(undefined);
      setMaxLength(undefined);
      setAllowedPattern('any');
      setAllowedFileTypes('');
      setMaxFileSizeMB(undefined);
      setMinAge(undefined);
      setCondFieldId('');
      setCondOperator('equals');
      setCondValue('');
      setParentFieldId('');
      setOptionsMap({});
    }
  }, [existingField]);

  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen, resetForm]);

  const handleSave = () => {
    if (!label.trim()) {
      alert('Field label cannot be empty.');
      return;
    }

    const fieldData: any = {
      label: label.trim(),
      type,
      isMandatory,
      allowedPattern: allowedPattern || 'any'
    };

    if (condFieldId) {
      fieldData.visibilityCondition = {
        fieldId: condFieldId,
        operator: condOperator,
        value: condValue
      };
    } else {
      fieldData.visibilityCondition = null; // Clear if empty
    }

    fieldData.parentFieldId = parentFieldId || null;
    fieldData.optionsMap = optionsMap;
    if (minLength !== undefined && minLength !== null && minLength !== "") fieldData.minLength = Number(minLength);
    if (maxLength !== undefined && maxLength !== null && maxLength !== "") fieldData.maxLength = Number(maxLength);
    if (allowedFileTypes) fieldData.allowedFileTypes = allowedFileTypes;
    if (maxFileSizeMB !== undefined && maxFileSizeMB !== null && maxFileSizeMB !== "") fieldData.maxFileSizeMB = Number(maxFileSizeMB);
    if (minAge !== undefined && minAge !== null && minAge !== "") fieldData.minAge = Number(minAge);

    if (FIELD_TYPES_WITH_OPTIONS.includes(type)) {
      fieldData.options = optionsStr.split(',').map(opt => opt.trim()).filter(opt => opt.length > 0);
      if (fieldData.options.length === 0) {
        alert(`Options are required for field type: ${type}. Please provide comma-separated values.`);
        return;
      }
    }

    if (existingField) {
      onSave({ ...existingField, ...fieldData });
    } else {
      onSave(fieldData);
    }
    onClose();
  };

  const showOptionsInput = FIELD_TYPES_WITH_OPTIONS.includes(type);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={existingField ? 'Edit Field' : 'Add New Field'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} className="mr-2">Cancel</Button>
          <Button variant="primary" onClick={handleSave}>Save Field</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Field Label"
          id="fieldLabel"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g., Full Name"
          required
        />
        <Select
          label="Field Type"
          id="fieldType"
          value={type}
          onChange={(e) => setType(e.target.value as FieldType)}
        >
          {AVAILABLE_FIELD_TYPES.map(ft => (
            <option key={ft} value={ft}>{ft}</option>
          ))}
        </Select>

        {showOptionsInput && (
          <div className="space-y-2">
            <Textarea
              label="Options (comma-separated)"
              id="fieldOptions"
              value={optionsStr}
              onChange={(e) => setOptionsStr(e.target.value)}
              placeholder="e.g., Option 1, Option 2, Option 3"
            />
            {existingField?.id === 'db307195-cf54-4a6e-9056-f3974b050c4d' && (
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700 flex items-start space-x-2">
                <span className="font-bold">ℹ️ Info:</span>
                <span>
                  Designation options are dynamically loaded from the <strong>Designations Library</strong> in Site Management. Any options entered here act as a fallback list.
                </span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center">
          <input
            id="isMandatory"
            type="checkbox"
            checked={isMandatory}
            onChange={(e) => setIsMandatory(e.target.checked)}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="isMandatory" className="ml-2 block text-sm text-gray-900 font-medium">
            Mandatory Field
          </label>
        </div>

        {/* Dynamic Validation Settings */}
        <div className="pt-4 border-t border-gray-100 space-y-4">
          <h4 className="text-sm font-semibold text-gray-700">Advanced Validations</h4>

          {(type === FieldType.TEXT || type === FieldType.TEXTAREA) && (
            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-1">
              <Input
                label="Min Length"
                type="number"
                value={minLength || ''}
                onChange={(e) => setMinLength(e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="0"
              />
              <Input
                label="Max Length"
                type="number"
                value={maxLength || ''}
                onChange={(e) => setMaxLength(e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="255"
              />
              <div className="col-span-2">
                <Select
                  label="Allowed Characters"
                  value={allowedPattern}
                  onChange={(e) => setAllowedPattern(e.target.value as any)}
                >
                  <option value="any">Any (Standard)</option>
                  <option value="alphabets">Alphabets Only (A-Z)</option>
                  <option value="numbers">Numbers (Decimals allowed)</option>
                  <option value="numbers_only">Numbers Only (No Decimals)</option>
                  <option value="alphanumeric">Alphanumeric (A-Z, 0-9)</option>
                  <option value="alphanumeric_special">Alphanumeric + Symbols (Address, etc.)</option>
                </Select>
              </div>
            </div>
          )}

          {type === FieldType.FILE_UPLOAD && (
            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-1">
              <Input
                label="Allowed Extensions"
                value={allowedFileTypes}
                onChange={(e) => setAllowedFileTypes(e.target.value)}
                placeholder=".pdf,.jpg,.png"
              />
              <Input
                label="Max Size (MB)"
                type="number"
                value={maxFileSizeMB || ''}
                onChange={(e) => setMaxFileSizeMB(e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="10"
              />
            </div>
          )}

          {type === FieldType.DATE && (
            <div className="animate-in fade-in slide-in-from-top-1">
              <Input
                label="Minimum Age Requirement"
                type="number"
                value={minAge || ''}
                onChange={(e) => setMinAge(e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="18"
              />
            </div>
          )}

          {!(type === FieldType.TEXT || type === FieldType.TEXTAREA || type === FieldType.FILE_UPLOAD || type === FieldType.DATE) && (
            <p className="text-xs text-gray-500 italic">No advanced validations available for this field type.</p>
          )}
        </div>

        {/* Visibility Logic */}
        <div className="pt-4 border-t border-gray-100 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-700">Visibility Logic (Conditional)</h4>
            {condFieldId && (
              <button
                onClick={() => setCondFieldId('')}
                className="text-[10px] text-red-500 hover:underline font-bold uppercase"
              >
                Clear Logic
              </button>
            )}
          </div>

          <div className="space-y-3 bg-gray-50 p-3 rounded-md border border-gray-200">
            <Select
              label="Show this field only if..."
              value={condFieldId}
              onChange={(e) => setCondFieldId(e.target.value)}
            >
              <option value="">(Always Show)</option>
              {availableFields
                .filter(f => f.id !== existingField?.id)
                .map(f => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))
              }
            </Select>

            {condFieldId && (
              <div className="grid grid-cols-2 gap-3 animate-in zoom-in-95 duration-200">
                <Select
                  label="Condition"
                  value={condOperator}
                  onChange={(e) => setCondOperator(e.target.value as any)}
                >
                  <option value="equals">Equals</option>
                  <option value="not_equals">Does Not Equal</option>
                  <option value="contains">Contains</option>
                </Select>
                <Input
                  label="Value"
                  value={condValue}
                  onChange={(e) => setCondValue(e.target.value)}
                  placeholder="e.g. Married"
                />
              </div>
            )}
            {!condFieldId && (
              <p className="text-[11px] text-gray-500 italic">Select a field above to make this field appear only when a specific answer is given.</p>
            )}
          </div>
        </div>


        {/* DEPENDENT DROP DOWN (NEW) */}
        {type === FieldType.DROPDOWN && existingField?.id !== 'db307195-cf54-4a6e-9056-f3974b050c4d' && (
          <div className="pt-4 border-t border-gray-100 space-y-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center space-x-2">
              <ListTree size={18} className="text-purple-600" />
              <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Dependent Options (Filtered)</h4>
            </div>
            <p className="text-[10px] text-gray-500 italic">Example: Only show specific posts when a certain unit is selected.</p>

            <div className="space-y-4 bg-purple-50/30 p-3 rounded-md border border-purple-100">
              <Select
                label="Parent Field (Dependency)"
                value={parentFieldId}
                onChange={(e) => setParentFieldId(e.target.value)}
              >
                <option value="">(No Dependency)</option>
                {availableFields
                  .filter(f => f.id !== existingField?.id && f.type === FieldType.DROPDOWN)
                  .map(f => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))
                }
              </Select>

              {parentFieldId && (
                <div className="space-y-4 mt-4 animate-in zoom-in-95">
                  <p className="text-[11px] font-bold text-purple-700 uppercase mb-2">Configure Mapping</p>
                  {/* We need to get the options of the parent field. 
                      If it's 'Unit or Facility', we use site names. 
                      Otherwise, we look at the field's options. */}
                  {(() => {
                    const parentField = availableFields.find(f => f.id === parentFieldId);
                    let parentOptions: string[] = [];
                    if (parentField?.label === 'Unit or Facility' || parentField?.id === '52ae217b-2602-4337-a1cd-a1f9bd36a4b0') {
                      parentOptions = sites.filter(s => s.status === 'Active').map(s => s.name);
                    } else if (parentField?.options) {
                      parentOptions = parentField.options;
                    }

                    const currentOptions = optionsStr.split(',').map(opt => opt.trim()).filter(opt => opt.length > 0);

                    if (parentOptions.length === 0) {
                      return <p className="text-xs text-orange-500 italic">No options found for parent field. Add options to the parent field first.</p>;
                    }

                    return (
                      <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                        {parentOptions.map(pOpt => (
                          <div key={pOpt} className="bg-white p-2 rounded border border-purple-100">
                            <p className="text-[10px] font-black text-gray-400 uppercase mb-2">When parent is: <span className="text-purple-600">"{pOpt}"</span></p>
                            <div className="grid grid-cols-2 gap-1">
                              {currentOptions.map(cOpt => (
                                <label key={cOpt} className="flex items-center space-x-2 p-1.5 bg-gray-50 rounded border border-gray-100 cursor-pointer hover:bg-purple-50 transition-colors">
                                  <input
                                    type="checkbox"
                                    checked={(optionsMap[pOpt] || []).includes(cOpt)}
                                    onChange={(e) => {
                                      const currentMap = { ...optionsMap };
                                      const selected = currentMap[pOpt] || [];
                                      if (e.target.checked) {
                                        currentMap[pOpt] = [...selected, cOpt];
                                      } else {
                                        currentMap[pOpt] = selected.filter(o => o !== cOpt);
                                      }
                                      setOptionsMap(currentMap);
                                    }}
                                    className="h-3 w-3 rounded text-purple-600 focus:ring-purple-500"
                                  />
                                  <span className="text-[10px] font-medium text-gray-700 truncate">{cOpt}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        )}
      </div>




    </Modal >
  );
};

export default FieldEditorModal;


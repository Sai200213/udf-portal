
import React from 'react';
import { EmployeeFieldProps } from '../../types';
import Select from '../common/Select'; // Reusing common Select

const EmployeeDropdownField: React.FC<EmployeeFieldProps> = ({ field, value, onChange, error, disabled, optionLabels }) => {
  const isDependentUnitChild = field.parentFieldId ||
    field.label.toLowerCase().includes('designation') ||
    field.label.toLowerCase().includes('post') ||
    field.label.toLowerCase().includes('sub-unit') ||
    field.label.toLowerCase().includes('sub unit');

  const placeholderText = disabled && isDependentUnitChild
    ? 'Please select Unit or Facility first...'
    : `Select ${field.label.toLowerCase()}...`;

  return (
    <div className="mb-4">
      <Select
        label={`${field.label}${field.isMandatory ? ' *' : ''}`}
        id={field.id}
        value={value || ''}
        onChange={(e) => onChange(field.id, e.target.value)}
        required={field.isMandatory}
        aria-required={field.isMandatory}
        aria-describedby={error ? `${field.id}-error` : undefined}
        error={error}
        disabled={disabled}
      >
        <option value="" disabled={field.isMandatory}>
          {placeholderText}
        </option>
        {(field.options || []).map((option) => (
          <option key={option} value={option}>
            {optionLabels?.[option] || option}
          </option>
        ))}
      </Select>
    </div>
  );
};

export default EmployeeDropdownField;



import React from 'react';
import { EmployeeFieldProps } from '../../types';
import Textarea from '../common/Textarea'; // Reusing common Textarea

const EmployeeTextareaField: React.FC<EmployeeFieldProps> = ({ field, value, onChange, error, disabled }) => {
  return (
    <div className="mb-4">
      <Textarea
        label={`${field.label}${field.isMandatory ? ' *' : ''}`}
        id={field.id}
        value={value || ''}
        onChange={(e) => onChange(field.id, e.target.value)}
        required={field.isMandatory}
        aria-required={field.isMandatory}
        aria-describedby={error ? `${field.id}-error` : undefined}
        error={error}
        disabled={disabled}
      />
    </div>
  );
};

export default EmployeeTextareaField;


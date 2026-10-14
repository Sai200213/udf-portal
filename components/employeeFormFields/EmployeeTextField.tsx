
import React from 'react';
import { EmployeeFieldProps } from '../../types';
import Input from '../common/Input'; // Reusing common Input for styling consistency

const EmployeeTextField: React.FC<EmployeeFieldProps> = ({ field, value, onChange, error, disabled }) => {
  return (
    <div className="mb-4">
      <Input
        label={`${field.label}${field.isMandatory ? ' *' : ''}`}
        id={field.id}
        type="text"
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

export default EmployeeTextField;


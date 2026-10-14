
import React from 'react';
import { EmployeeFieldProps } from '../../types';
import Input from '../common/Input'; // Reusing common Input

const EmployeeDateField: React.FC<EmployeeFieldProps> = ({ field, value, onChange, error, disabled }) => {
  return (
    <div className="mb-4">
      <Input
        label={`${field.label}${field.isMandatory ? ' *' : ''}`}
        id={field.id}
        type="date"
        value={value || ''} // HTML date input expects YYYY-MM-DD format
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

export default EmployeeDateField;


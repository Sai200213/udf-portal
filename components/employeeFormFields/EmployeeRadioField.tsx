
import React from 'react';
import { EmployeeFieldProps } from '../../types';

const EmployeeRadioField: React.FC<EmployeeFieldProps> = ({ field, value, onChange, error, disabled }) => {
  return (
    <div className="mb-4">
      <fieldset>
        <legend className="block text-sm font-medium text-gray-700 mb-1">
          {field.label}
          {field.isMandatory ? <span className="text-red-500"> *</span> : ''}
        </legend>
        {(field.options || []).map((option) => (
          <div key={option} className="flex items-center my-1">
            <input
              id={`${field.id}-${option}`}
              name={field.id}
              type="radio"
              value={option}
              checked={value === option}
              onChange={(e) => onChange(field.id, e.target.value)}
              required={field.isMandatory && (field.options || []).indexOf(option) === 0} // only make first radio visually required for group
              className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              aria-describedby={error ? `${field.id}-error` : undefined}
              disabled={disabled}
            />
            <label htmlFor={`${field.id}-${option}`} className="ml-2 block text-sm text-gray-900">
              {option}
            </label>
          </div>
        ))}
      </fieldset>
      {error && <p id={`${field.id}-error`} className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
};

export default EmployeeRadioField;



import { FieldType, LeaveType } from './types';

export const AVAILABLE_FIELD_TYPES: FieldType[] = [
  FieldType.TEXT,
  FieldType.TEXTAREA,
  FieldType.DROPDOWN,
  FieldType.DATE,
  FieldType.CHECKBOX,
  FieldType.RADIO,
  FieldType.FILE_UPLOAD,
];

export const FIELD_TYPES_WITH_OPTIONS: FieldType[] = [
  FieldType.DROPDOWN,
  FieldType.CHECKBOX,
  FieldType.RADIO,
];

// --- Phase 4 Constants ---

export const ALL_LEAVE_TYPES: LeaveType[] = [
  LeaveType.CASUAL,
  LeaveType.SICK,
  LeaveType.EARNED,
  LeaveType.UNPAID,
];

// Define which fields (by their ID, as defined in the form builder) are editable by employees.
// This requires the admin to know the IDs of the fields they want to make editable.
// Example: ['contact_number_field_id', 'bank_account_field_id', 'home_address_field_id']
export const EDITABLE_PROFILE_FIELD_IDS: string[] = [
  // Example: 'field_id_for_phone', 'field_id_for_address'
  // These would be UUIDs generated when the admin creates the form.
  // For testing, you might need to create a form, get some field IDs, and put them here.
  // Or, allow editing based on common labels if IDs are too dynamic for this example.
];

// Alternative or supplementary: Allow editing based on common field labels.
// The system can then find the field ID matching this label in the employee's submitted form structure.
export const EDITABLE_PROFILE_FIELD_LABELS: string[] = [
    "Phone Number", "Mobile Number", "Personal Email Address", "Home Address", "Bank Account Number", "Bank Name", "IFSC Code"
];

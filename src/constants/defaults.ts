
import {
    FieldType,
    FormSection,
    Role,
    StaffUser,
    Site,
    WorkflowConfig,
    LeavePolicy,
    PortalConfig,
    LeaveType,
    Permission
} from '../../types';

export const defaultRoles: Role[] = [];

// NOTE: These are bootstrap stubs used as initial React state before Firestore data loads.
// They do NOT create Firebase Auth accounts. Real staff accounts are created via
// the Staff Management page which uses Cloud Functions (createStaffUser).
// Never store plaintext passwords in code or Firestore.
export const defaultStaff: StaffUser[] = [];

export const defaultSites: Site[] = [];

export const defaultWorkflows: WorkflowConfig[] = [
    {
        moduleId: 'LEAVES',
        levels: [
            { level: 1, roleId: 'role-field-officer' },
            { level: 2, roleId: 'role-hr-manager' },
            { level: 3, roleId: 'role-manager' }
        ]
    },
    {
        moduleId: 'ACCOUNT_UPDATES',
        levels: [
            { level: 1, roleId: 'role-hr-manager' }
        ]
    },
    {
        moduleId: 'SUBMISSIONS',
        levels: [
            { level: 1, roleId: 'role-field-officer' },
            { level: 2, roleId: 'role-manager' },
            { level: 3, roleId: 'role-hr-manager' }
        ]
    },
    {
        moduleId: 'RESIGNATIONS',
        levels: [
            { level: 1, roleId: 'role-field-officer' },
            { level: 2, roleId: 'role-hr-manager' },
            { level: 3, roleId: 'role-manager' }
        ]
    },
];

export const defaultLeavePolicy: LeavePolicy = {
    showBalancesToEmployees: true,
    leaveTypes: [
        { typeId: LeaveType.CASUAL, label: 'Casual Leave', defaultQuota: 12, isActive: true },
        { typeId: LeaveType.SICK, label: 'Sick Leave', defaultQuota: 7, isActive: true },
        { typeId: LeaveType.EARNED, label: 'Earned Leave', defaultQuota: 15, isActive: true },
        { typeId: LeaveType.UNPAID, label: 'Unpaid Leave', defaultQuota: 0, isActive: true },
    ]
};

export const defaultPortalConfig: PortalConfig = {
    enableLeaves: true,
    enableAccountUpdates: true,
    enableResignations: true,
    enableDisciplinary: true,
    clientIdDefinitions: [
        {
            id: 'id-bpss',
            name: 'BPSS ID',
            description: 'British Personnel Security Standard',
            fieldType: 'uppercase',
            pattern: '^[A-Z0-9]{5,15}$',
            patternMessage: 'Must be 5-15 alphanumeric characters'
        },
        {
            id: 'id-tms',
            name: 'TMS ID',
            description: 'Transport Management System ID',
            fieldType: 'number',
            pattern: '^\\d{4,8}$',
            patternMessage: 'Must be 4-8 numeric digits'
        }
    ],
    designations: ["Security Guard", "Escort Security Guard", "Lady Security Guard", "Console Operator", "Supervisor", "FOE", "ASM", "SO"],
    dbReadCap: 45000,
    dbWriteCap: 18000,
    storageCap: 4800,
    blockWritesOnLimit: false,
    blockReadsOnLimit: false,
    blockUploadsOnLimit: false,
    manualEmergencyLock: false,
    manualReadOnly: false
};

export const defaultFormSections: FormSection[] = [
    {
        "id": "fb9e1554-dc1f-41c8-a12f-c3bdc4285007",
        "name": "Personal Details",
        "order": 0,
        "fields": [
            { "id": "7debf274-baee-4bac-a137-4b4b46719874", "label": "Full Name", "type": FieldType.TEXT, "order": 0, "isMandatory": true, "isDisabled": false },
            { "id": "eb3617dc-9f1d-475d-a2db-005b6bc2500c", "label": "Phone Number", "type": FieldType.TEXT, "order": 1, "isMandatory": true, "isDisabled": false },
            { "id": "5df6fa40-c39f-41a7-9ee7-789a47435ef0", "label": "Gender", "type": FieldType.DROPDOWN, "order": 2, "isMandatory": true, "options": ["Male", "Female"], "isDisabled": false },
            { "id": "6e570a01-14e0-4e18-b112-97ddc51d0778", "label": "Date of Birth", "type": FieldType.DATE, "order": 3, "isMandatory": true, "isDisabled": false },
            { "id": "2fdacb1b-254f-4fc3-923a-53233214124f", "label": "Citizenship", "type": FieldType.DROPDOWN, "order": 4, "isMandatory": true, "options": ["Indian", "Others"], "isDisabled": false },
            { "id": "2f8c72f5-10f4-4414-bfcd-274fc69592e2", "label": "Blood Group", "type": FieldType.DROPDOWN, "order": 5, "isMandatory": true, "options": ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"], "isDisabled": false },
            { "id": "5ae316e6-2941-4e58-93b8-a6fe5a200e98", "label": "Height", "type": FieldType.TEXT, "order": 6, "isMandatory": true, "isDisabled": false },
            { "id": "7386dcfa-e693-4998-a1cb-35a8fa8029de", "label": "Identity Marks", "type": FieldType.TEXT, "order": 7, "isMandatory": true, "isDisabled": false },
            { "id": "c53d7ba7-58a0-4cf0-8691-8eb7bef7b951", "label": "Marital Status", "type": FieldType.DROPDOWN, "order": 8, "isMandatory": true, "options": ["Single", "Married"], "isDisabled": false },
            {
                "id": "7db47bc3-e4cc-4984-9687-2d94cad3e632",
                "label": "Spouse Name",
                "type": FieldType.TEXT,
                "order": 9,
                "isMandatory": false,
                "isDisabled": false,
                "visibilityCondition": {
                    "fieldId": "c53d7ba7-58a0-4cf0-8691-8eb7bef7b951",
                    "operator": "equals",
                    "value": "Married"
                }
            }
        ]
    },
    {
        "id": "eb4bf8a6-a8bd-4563-817d-792716e6474c",
        "name": "Job Details",
        "order": 1,
        "fields": [
            { "id": "61b19d37-b860-44ef-80e9-d33c3b438655", "label": "Qualification", "type": FieldType.DROPDOWN, "order": 0, "isMandatory": true, "options": ["SSC - 10th", "Intermediate - 12th", "Diploma", "B-tech", "Degree"] },
            { "id": "52ae217b-2602-4337-a1cd-a1f9bd36a4b0", "label": "Unit or Facility", "type": FieldType.DROPDOWN, "order": 1, "isMandatory": true, "options": [] }, // Sync from sites
            { "id": "db307195-cf54-4a6e-9056-f3974b050c4d", "label": "Post of Apply", "type": FieldType.DROPDOWN, "order": 2, "isMandatory": true, "options": ["Security Guard", "Escort Security Guard", "Lady Security Guard", "Console Operator", "Supervisor", "FOE", "ASM", "SO"] },
            { "id": "68a2a893-0100-4740-9602-9988452377c8", "label": "Specific Location / Sub-Unit", "type": FieldType.DROPDOWN, "order": 3, "isMandatory": false, "options": [] }, // Sync from sub-units of selected site
            { "id": "0c8a587e-08f3-4605-ad33-9ab34eb46d87", "label": "Any Police Case", "type": FieldType.DROPDOWN, "order": 4, "isMandatory": true, "options": ["Yes", "No"] },
            { "id": "4b05d2b6-ff73-4dbe-befa-eba77c8ce1c4", "label": "Previous Employment History", "type": FieldType.DROPDOWN, "order": 5, "isMandatory": true, "options": ["Fresher", "Experienced"] },
            {
                "id": "d16a6da1-fc29-405e-bbb6-cb186b8f8666",
                "label": "Previous Company & Experience",
                "type": FieldType.TEXT,
                "order": 6,
                "isMandatory": false,
                "visibilityCondition": {
                    "fieldId": "4b05d2b6-ff73-4dbe-befa-eba77c8ce1c4",
                    "operator": "equals",
                    "value": "Experienced"
                }
            }
        ]
    },
    {
        "id": "e2dc569f-a463-4190-8e89-048ed215dc9f",
        "name": "Address",
        "order": 2,
        "fields": [
            { "id": "8532f460-7bcf-4831-ab62-96375b80e6ab", "label": "Present Address", "type": FieldType.TEXT, "order": 0, "isMandatory": true },
            { "id": "29bae22a-59db-4b1b-bafd-64e8018a0f4e", "label": "Permanent Address", "type": FieldType.TEXT, "order": 1, "isMandatory": true }
        ]
    },
    {
        "id": "3e086a68-332c-4018-aea3-625e8c9700f1",
        "name": "Reference",
        "order": 3,
        "fields": [
            { "id": "2e1f27bf-94e7-421f-b69c-7e8dfaf0ee13", "label": "Reference Name", "type": FieldType.TEXT, "order": 0, "isMandatory": true },
            { "id": "13c82880-161a-4fa9-a8b6-0558d5c88c53", "label": "Reference Relationship", "type": FieldType.TEXT, "order": 1, "isMandatory": true },
            { "id": "7681644c-02f8-4034-b0ce-cc11dfd3dca7", "label": "Reference Address", "type": FieldType.TEXT, "order": 2, "isMandatory": true },
            { "id": "e1479d43-ed04-4fde-a508-130f43b4f12d", "label": "Reference Contact No", "type": FieldType.TEXT, "order": 3, "isMandatory": true }
        ]
    },
    {
        "id": "33422c9d-8349-4e3c-a041-cd360dd643b7",
        "name": "Family Details",
        "order": 4,
        "fields": [
            { "id": "3f09e364-7875-40a2-9490-41251be20366", "label": "Father's Name", "type": FieldType.TEXT, "order": 0, "isMandatory": true },
            { "id": "c432a45e-c1f0-4e64-8002-1f1dba3bf660", "label": "Mother's Name", "type": FieldType.TEXT, "order": 1, "isMandatory": true },
            { "id": "30d78dae-fb7c-4264-a159-c04993d8885c", "label": "Father's Mobile Number", "type": FieldType.TEXT, "order": 2, "isMandatory": true },
            { "id": "30fab2de-452d-46bf-8079-2f53d322388d", "label": "Mother's Mobile Number", "type": FieldType.TEXT, "order": 3, "isMandatory": true }
        ]
    },
    {
        "id": "4f795270-0164-4228-850b-b79f8ea76e09",
        "name": "Government Identifications",
        "order": 5,
        "fields": [
            { "id": "18855ee9-0d66-41d6-988b-128b776a8c5b", "label": "Aadhar Card No", "type": FieldType.TEXT, "order": 0, "isMandatory": true },
            { "id": "da8edb18-4bed-41ca-8233-2280b97dac8d", "label": "PAN Card No", "type": FieldType.TEXT, "order": 1, "isMandatory": true },
            { "id": "f6665f3e-98f4-4d92-8b53-adcaa1993bbe", "label": "UAN No or EPFO", "type": FieldType.TEXT, "order": 2, "isMandatory": false },
            { "id": "41e3505e-15fb-4067-9c6a-2c690e736fab", "label": "ESIC No", "type": FieldType.TEXT, "order": 3, "isMandatory": true },
            { "id": "1052957c-a885-494e-af2c-ae1af5c5cc8e", "label": "PVC (Police Verification Certificate)", "type": FieldType.DROPDOWN, "order": 4, "isMandatory": true, "options": ["Yes", "No"] },
            { "id": "791bdd86-20c2-4097-bcc1-c85e8f649961", "label": "PVC Number (If YES)", "type": FieldType.TEXT, "order": 5, "isMandatory": true }
        ]
    },
    {
        "id": "e2066eb8-ff2d-45dc-b281-112d867946a8",
        "name": "Bank Details",
        "order": 6,
        "fields": [
            { "id": "1a35eaa7-d302-4e49-8649-e85cab8b3b77", "label": "Bank Name", "type": FieldType.TEXT, "order": 0, "isMandatory": true },
            { "id": "3519c111-aaa6-4fe0-8d83-d03dd7612e28", "label": "Account No", "type": FieldType.TEXT, "order": 1, "isMandatory": true },
            { "id": "86854000-7727-40bb-9932-09e28e443ad8", "label": "IFSC Code", "type": FieldType.TEXT, "order": 2, "isMandatory": true },
            { "id": "6fe166fc-29a3-41ea-a19f-a498b48089b9", "label": "Branch Name", "type": FieldType.TEXT, "order": 3, "isMandatory": true }
        ]
    },
    {
        "id": "2965b23a-ea46-4f01-9e85-359acc4f5750",
        "name": "Document Proofs",
        "order": 7,
        "fields": [
            { "id": "eecc5044-399c-45f8-aa03-e609748f0e49", "label": "Aadhar Card (Front)", "type": FieldType.FILE_UPLOAD, "order": 0, "isMandatory": true },
            { "id": "c95cb7c0-9aab-48f8-b4e3-1bafc7678147", "label": "Aadhar Card (Back)", "type": FieldType.FILE_UPLOAD, "order": 1, "isMandatory": true },
            { "id": "d4116a1b-aa88-438c-8cfb-78b2bf6dc2be", "label": "PAN Card", "type": FieldType.FILE_UPLOAD, "order": 2, "isMandatory": true },
            { "id": "3f394f92-e214-4122-a9cc-056150bc2fe5", "label": "Bank Passbook or Cheque", "type": FieldType.FILE_UPLOAD, "order": 3, "isMandatory": true },
            { "id": "109e619f-f27b-45f3-812e-bac4be76de11", "label": "SSC - 10th, INTER, DEGREE MEMO", "type": FieldType.FILE_UPLOAD, "order": 4, "isMandatory": true },
            { "id": "7fbd2b8f-62b5-402d-a1dd-262531fa80af", "label": "Passport Size Photo", "type": FieldType.FILE_UPLOAD, "order": 5, "isMandatory": true },
            { "id": "03370580-48a7-4748-b74e-80cd5f6cef0a", "label": "PVC", "type": FieldType.FILE_UPLOAD, "order": 6, "isMandatory": true },
            { "id": "46b67cdf-7ae8-4b7a-977d-d838fdcc577d", "label": "Electricity Bill", "type": FieldType.FILE_UPLOAD, "order": 7, "isMandatory": false }
        ]
    }
];

export const defaultEditableFields = [
    '7debf274-baee-4bac-a137-4b4b46719874', // Full Name
    'eb3617dc-9f1d-475d-a2db-005b6bc2500c', // Phone Number
    '8532f460-7bcf-4831-ab62-96375b80e6ab', // Present Address
    'da8edb18-4bed-41ca-8233-2280b97dac8d'  // PAN Card No
];


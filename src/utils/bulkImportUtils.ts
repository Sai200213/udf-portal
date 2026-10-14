import { Site, FormSection, SubmissionStatus, FieldType, FormField } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../firebase/config';
import { collection, doc, setDoc, writeBatch, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { resolveLocation, validateBulkImportLocations } from './subUnitUtils';
import { hashPassword } from './cryptoUtils';
import * as XLSX from 'xlsx';

// Collection names
const SUBMISSIONS_COLLECTION = 'onboarding_submissions';
const EMPLOYEES_COLLECTION = 'employees';

/**
 * Bulk Import Utilities for Employees
 * Supports CSV/Excel data import with sub-unit/site resolution
 */

export interface BulkImportRow {
    // Required fields
    fullName: string;
    phoneNumber?: string;
    dateOfBirth?: string;

    // Site/Unit (can be site name, sub-unit name, or unit code)
    location: string;

    // Optional
    employeeId?: string; // If blank, will be auto-generated
    designation?: string;
    joiningDate?: string;

    // Any additional fields mapped to form field IDs
    [key: string]: any;
}

export interface DuplicateConflict {
    row: number;
    fullName: string;
    employeeId?: string;
    phoneNumber?: string;
    aadharNo?: string;
    matchType: 'EmployeeID' | 'Phone' | 'Aadhar';
    existingRecordId: string; // The ID in Firestore
    targetCollection: 'employees' | 'submissions';
}

export interface BulkImportResult {
    success: boolean;
    totalRows: number;
    successfulImports: number;
    failedImports: number;
    errors: Array<{ row: number; error: string; data?: BulkImportRow; field?: string; value?: any }>;
    warnings: Array<{ row: number; warning: string }>;
    duplicates?: DuplicateConflict[];
}

export type ValidationSeverity = 'error' | 'warning' | 'none';

export interface ValidationSettings {
    [fieldLabel: string]: ValidationSeverity;
}

/**
 * Intelligent Date Parser
 * Handles DD-MM-YYYY, MM/DD/YYYY, YYYY-MM-DD and Excel numeric dates.
 * Standardizes to YYYY-MM-DD.
 */
export const parseFlexibleDate = (dateStr: string | number): string | null => {
    if (!dateStr) return null;
    const s = String(dateStr).trim();
    if (!s || s === 'undefined' || s === 'null') return null;

    // 1. ISO format with timestamp (e.g. 1995-08-15T...) or YYYY-MM-DD
    const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
    if (isoMatch) {
        const y = parseInt(isoMatch[1], 10);
        const m = parseInt(isoMatch[2], 10);
        const d = parseInt(isoMatch[3], 10);
        if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
            return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        }
    }

    // 2. YYYY/MM/DD or YYYY.MM.DD format
    const slashYmd = s.match(/^(\d{4})[./](\d{1,2})[./](\d{1,2})$/);
    if (slashYmd) {
        const y = parseInt(slashYmd[1], 10);
        const m = parseInt(slashYmd[2], 10);
        const d = parseInt(slashYmd[3], 10);
        if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
            return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        }
    }

    // 3. Indian & Standard date formats: DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY
    const dmyMatch = s.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/);
    if (dmyMatch) {
        const part1 = parseInt(dmyMatch[1], 10);
        const part2 = parseInt(dmyMatch[2], 10);
        const y = parseInt(dmyMatch[3], 10);

        let d = part1;
        let m = part2;

        // If second part is > 12, then first part was month (MM-DD-YYYY)
        if (part2 > 12 && part1 <= 12) {
            m = part1;
            d = part2;
        }

        if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
            return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        }
    }

    // 4. Excel numeric serial date (e.g. 34926)
    if (/^\d{4,5}$/.test(s)) {
        const serial = parseInt(s, 10);
        if (serial >= 10000 && serial <= 65000) {
            // Excel serial day offset from Dec 30, 1899 (adjusted for 1900 leap year bug)
            const utcDays = serial - 25569;
            const date = new Date(utcDays * 86400 * 1000);
            if (!isNaN(date.getTime())) {
                const y = date.getUTCFullYear();
                const m = date.getUTCMonth() + 1;
                const d = date.getUTCDate();
                if (y >= 1900 && y <= 2100) {
                    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                }
            }
        }
    }

    // 5. Month name formats (e.g. 15-Aug-1995, 15 August 1995, Aug 15 1995)
    const monthNames: Record<string, number> = {
        jan: 1, january: 1,
        feb: 2, february: 2,
        mar: 3, march: 3,
        apr: 4, april: 4,
        may: 5,
        jun: 6, june: 6,
        jul: 7, july: 7,
        aug: 8, august: 8,
        sep: 9, september: 9,
        oct: 10, october: 10,
        nov: 11, november: 11,
        dec: 12, december: 12
    };

    const textDateMatch = s.match(/^(\d{1,2})[- ]([A-Za-z]+)[- ](\d{4})$/);
    if (textDateMatch) {
        const d = parseInt(textDateMatch[1], 10);
        const mStr = textDateMatch[2].toLowerCase();
        const y = parseInt(textDateMatch[3], 10);
        const m = monthNames[mStr];
        if (m && d >= 1 && d <= 31) {
            return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        }
    }

    return null;
};

// Validate an individual field based on FormField rules
export const validateField = (field: FormField, value: any, severity: ValidationSeverity = 'error'): { error: string | null; type: ValidationSeverity } => {
    let isEmpty = false;
    if (field.type === FieldType.CHECKBOX) {
        isEmpty = !value || (Array.isArray(value) && value.length === 0);
    } else if (field.type === FieldType.FILE_UPLOAD) {
        isEmpty = !value;
    } else {
        isEmpty = !value || String(value).trim() === '';
    }

    if (field.isMandatory && isEmpty) {
        if (severity === 'none') return { error: null, type: 'none' };
        return { error: `${field.label} is required.`, type: severity };
    }

    if (isEmpty) return { error: null, type: 'none' }; // If not mandatory and empty, it's fine

    // Add specific type validations here (e.g., date formats, regex)
    if (field.type === FieldType.DATE && value) {
        const normalized = parseFlexibleDate(String(value));
        if (!normalized) {
            return { error: `Invalid date format for ${field.label}. Please use exactly YYYY-MM-DD.`, type: 'error' };
        }

        // Age check if applicable
        if (field.minAge) {
            const birthDate = new Date(normalized);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;

            if (age < field.minAge) {
                return { error: `Minimum age required is ${field.minAge} years.`, type: 'error' };
            }
        }
    }

    if (field.type === FieldType.TEXT || field.type === FieldType.TEXTAREA) {
        if (field.minLength && String(value).length < field.minLength) {
            return { error: `Must be at least ${field.minLength} characters.`, type: 'error' };
        }
        if (field.maxLength && String(value).length > field.maxLength) {
            return { error: `Maximum ${field.maxLength} characters allowed.`, type: 'error' };
        }
    }

    if (field.allowedPattern && field.allowedPattern !== 'any') {
        let patternString: string = field.allowedPattern;
        if (patternString === 'alphabets') patternString = '^[A-Za-z\\s]+$';
        else if (patternString === 'numbers') patternString = '^[0-9\\.]+$';
        else if (patternString === 'alphanumeric') patternString = '^[A-Za-z0-9\\s]+$';
        else if (patternString === 'alphanumeric_special') patternString = '^[A-Za-z0-9\\s\\.,#\\-\\/\\(\\)\\[\\]&\'":;!\\?@\\+]+$';
        else if (patternString === 'full_text' || patternString === 'any') return { error: null, type: 'none' };
        else if (patternString === 'address' || (field.label && field.label.toLowerCase().includes('address'))) {
            // Very lenient pattern for addresses: alphabets, numbers, spaces, and common symbols
            patternString = '^[A-Za-z0-9\\s\\.,#\\-\\/\\(\\)\\[\\]&\'":;!\\?@\\+]+$';
        }

        try {
            const regex = new RegExp(patternString);
            if (!regex.test(String(value))) {
                let msg = "Invalid format.";
                if (field.label?.toLowerCase().includes('phone') || field.label?.toLowerCase().includes('mobile')) msg = "Invalid phone number format.";
                else if (field.allowedPattern === 'alphabets') msg = "Only alphabets allowed.";
                else if (field.allowedPattern === 'numbers') msg = "Only numbers allowed.";
                else if (field.allowedPattern === 'alphanumeric') msg = "Only alphabets and numbers allowed.";
                else if (field.allowedPattern === 'alphanumeric_special') msg = "Invalid format (use only text, numbers, and basic symbols).";

                return { error: msg, type: 'error' };
            }
        } catch (e) {
            console.error("Invalid regex pattern:", patternString);
        }
    }


    return { error: null, type: 'none' };
};

// Validate import data before processing
export const validateBulkImportData = (
    rows: BulkImportRow[],
    sites: Site[],
    formSections: FormSection[],
    validationSettings: ValidationSettings = {}
): { valid: boolean; errors: any[]; warnings: string[] } => {
    const errors: any[] = [];
    const warnings: string[] = [];
    const existingIds = new Set<string>();
    const allFields = formSections.flatMap(s => s.fields || []);

    // Helper for severity lookup
    const getSeverity = (label: string, defaultSeverity: ValidationSeverity = 'warning'): ValidationSeverity => {
        const l = label.toLowerCase().trim();
        if (validationSettings[l]) return validationSettings[l];
        // Hardcoded critical fields defaults
        const isCore = ['full name', 'unit or facility', 'site or unit', 'location', 'unit code', 'employee id', 'id'].includes(l);
        return isCore ? 'error' : defaultSeverity;
    };

    if (rows.length === 0) {
        errors.push({ row: 0, error: 'No data rows found' });
        return { valid: false, errors, warnings };
    }

    rows.forEach((row, index) => {
        const rowIndex = index + 1;

        // 1. Basic required fields check (names/location/ID)
        const fullName = getVal(row, 'fullName') || getVal(row, 'Full Name');
        const location = getVal(row, 'location') || getVal(row, 'Location');
        const employeeIdInRow = getVal(row, 'employeeId') || getVal(row, 'Employee ID');

        const fullNameSeverity = getSeverity('Full Name', 'error');
        if (!String(fullName || '').trim()) {
            if (fullNameSeverity === 'error') errors.push({ row: rowIndex, error: 'Full Name is required', field: 'fullName' });
            else if (fullNameSeverity === 'warning') warnings.push(`Row ${rowIndex}: Full Name is missing.`);
        }

        const locationSeverity = getSeverity('Location', 'error');
        if (!String(location || '').trim()) {
            if (locationSeverity === 'error') errors.push({ row: rowIndex, error: 'Location (Site/Unit/Unit Code) is required', field: 'location' });
            else if (locationSeverity === 'warning') warnings.push(`Row ${rowIndex}: Location is missing.`);
        }

        const employeeIdSeverity = getSeverity('Employee ID', 'error');
        if (!String(employeeIdInRow || '').trim()) {
            if (employeeIdSeverity === 'error') errors.push({ row: rowIndex, error: 'Employee ID is required', field: 'employeeId' });
            else if (employeeIdSeverity === 'warning') warnings.push(`Row ${rowIndex}: Employee ID is missing.`);
        }

        // 2. Duplicate ID check within CSV
        if (String(employeeIdInRow || '').trim()) {
            const id = String(employeeIdInRow).trim();
            if (existingIds.has(id)) {
                errors.push({ row: rowIndex, error: `Duplicate Employee ID in CSV: ${id}`, field: 'employeeId', value: id });
            }
            existingIds.add(id);
        }

        // 3. Dynamic Form Field Validation
        allFields.forEach(field => {
            const label = field.label || 'Unknown Field';
            const severity = getSeverity(label, 'warning');

            // Finding the value
            let value = getVal(row, field.id);
            if (value === undefined || value === null || String(value).trim() === '') {
                value = getVal(row, label);
            }

            // SMART MAPPING: Location fallback
            if ((value === undefined || value === null || String(value).trim() === '') &&
                ['unit', 'site', 'facility', 'location'].some(k => label.toLowerCase().includes(k))) {
                value = row.location;
            }

            if (value !== undefined && value !== null && String(value).trim() !== '') {
                // FLEXIBLE DATE NORMALIZATION:
                // If it's a date field, normalize the value in the row itself
                if (field.type === FieldType.DATE) {
                    const normalized = parseFlexibleDate(String(value));
                    if (normalized) {
                        value = normalized;

                        // We need to update the row's specific key
                        // Try by ID first, then by Label
                        const keyById = Object.keys(row).find(k => k.toLowerCase() === field.id.toLowerCase());
                        const keyByLabel = Object.keys(row).find(k => k.toLowerCase() === label.toLowerCase());
                        const keyByMapped = Object.keys(row).find(k => k.toLowerCase() === label.toLowerCase().replace(/\s+/g, '_'));

                        if (keyById) row[keyById] = normalized;
                        else if (keyByLabel) row[keyByLabel] = normalized;
                        else if (keyByMapped) row[keyByMapped] = normalized;
                        else {
                            // Fallback mapping for standard keys
                            if (label.toLowerCase().includes('dob') || label.toLowerCase().includes('birth')) row.dateOfBirth = normalized;
                            if (label.toLowerCase().includes('joining')) row.joiningDate = normalized;
                        }
                    }
                }

                const result = validateField(field, value, severity);
                if (result.error) {
                    if (result.type === 'error') errors.push({ row: rowIndex, error: result.error, field: label, value });
                    else if (result.type === 'warning') warnings.push(`Row ${rowIndex}: ${result.error}`);
                }
            } else if (field.isMandatory) {
                if (severity === 'error') {
                    errors.push({ row: rowIndex, error: `${label} is required`, field: label });
                } else if (severity === 'warning') {
                    warnings.push(`Row ${rowIndex}: "${label}" is missing.`);
                }
            }
        });
    });

    // Validate locations
    const locations = rows.map(r => r.location).filter(Boolean);
    const { invalid } = validateBulkImportLocations(sites, locations);

    if (invalid.length > 0) {
        warnings.push(`Unknown locations: ${invalid.slice(0, 5).join(', ')}${invalid.length > 5 ? '...' : ''}`);
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
};

// Helper to find a value in a row with case-insensitive key matching
const getVal = (row: BulkImportRow, key: string) => {
    if (!key) return undefined;

    // Normalized key for comparison (lowercase, no spaces, no special chars)
    const normalize = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const target = normalize(key);

    const actualKey = Object.keys(row).find(k => {
        const normalizedK = normalize(k);
        return normalizedK === target ||
            k.toLowerCase() === key.toLowerCase() ||
            (k === 'fullName' && target === 'fullname') ||
            (k === 'location' && target === 'location') ||
            (k === 'employeeId' && target === 'employeeid');
    });

    return actualKey ? row[actualKey] : undefined;
};

// Parse CSV string to array of objects with multi-line quote support and scientific notation fix
export const parseCSV = (csvString: string): BulkImportRow[] => {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let inQuotes = false;

    // Handle potential UTF-8 BOM
    const content = csvString.replace(/^\uFEFF/, '');

    // Helper to expand scientific notation (Aadhar/UAN often export as 1.23E+11) and preserve leading zeros
    const normalizeValue = (val: string): string => {
        let trimmed = val.trim();
        // If wrapped in Excel formula quotes like ="00123", unwrap it to preserve leading zeros
        if (trimmed.startsWith('="') && trimmed.endsWith('"')) {
            trimmed = trimmed.substring(2, trimmed.length - 1);
        }
        if (/^[+\-]?\d+(\.\d+)?[eE][+\-]?\d+$/.test(trimmed)) {
            const num = Number(trimmed);
            if (!isNaN(num)) {
                return num.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 0 });
            }
        }
        return trimmed;
    };

    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        const nextChar = content[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentCell += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            currentRow.push(currentCell.trim());
            currentCell = '';
        } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
            currentRow.push(currentCell.trim());
            rows.push(currentRow);
            currentRow = [];
            currentCell = '';
            if (char === '\r') i++;
        } else {
            currentCell += char;
        }
    }

    if (currentRow.length > 0 || currentCell) {
        currentRow.push(currentCell.trim());
        rows.push(currentRow);
    }

    if (rows.length < 2) return [];

    const rawHeaders = rows[0];
    const headers = rawHeaders.map(h => h.toLowerCase().trim().replace(/\s+/g, '_'));
    const importRows: BulkImportRow[] = [];

    for (let i = 1; i < rows.length; i++) {
        const values = rows[i];
        if (values.length === 0 || (values.length === 1 && !values[0])) continue;

        const row: any = {};

        rawHeaders.forEach((rawHeader, index) => {
            const header = headers[index];
            const value = normalizeValue(values[index] || '');

            const fieldMap: Record<string, string> = {
                'name': 'fullName',
                'full_name': 'fullName',
                'employee_name': 'fullName',
                'personnel': 'fullName',
                'personnel_name': 'fullName',
                'person_name': 'fullName',
                'staff_name': 'fullName',
                'candidate_name': 'fullName',
                'phone': 'phoneNumber',
                'mobile': 'phoneNumber',
                'phone_number': 'phoneNumber',
                'dob': 'dateOfBirth',
                'date_of_birth': 'dateOfBirth',
                'unit': 'location',
                'facility': 'location',
                'site_name': 'location',
                'unit_name': 'location',
                'unit_or_facility': 'location',
                'unit_code_/_unit_name_/_sub_unit': 'location',
                'location': 'location',
                'sub_unit': 'location',
                'unit_code': 'location',
                'emp_id': 'employeeId',
                'employee_id': 'employeeId',
                'id': 'employeeId',
                'joining': 'joiningDate',
                'joining_date': 'joiningDate',
                'join_date': 'joiningDate',
                'title': 'designation',
                'role': 'designation',
                'position': 'designation',
                'post_of_apply': 'designation',
                'post_applied_for': 'designation'
            };

            const mappedKey = fieldMap[header] || header;
            row[mappedKey] = value;

            if (mappedKey !== rawHeader) {
                row[rawHeader] = value;
            }
        });

        if (row.fullName) {
            importRows.push(row as BulkImportRow);
        }
    }

    return importRows;
};

/**
 * Generate a dynamic default password based on name and DOB
 * Pattern: First Name (lowercase) + Year (YYYY)
 */
export const generateDefaultPassword = (fullName: string, dobString?: string): string => {
    const firstName = (fullName || 'user').split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    let year = '123';

    if (dobString) {
        const normalized = parseFlexibleDate(dobString);
        if (normalized) {
            year = normalized.split('-')[0]; // Get YYYY from YYYY-MM-DD
        }
    }

    return `${firstName}${year}`;
};

// Generate employee ID conforming to /^[A-Z]{2}\d{6}$/ (e.g. HY123456 or UD123456)
const generateEmployeeId = (prefix: string = 'UD'): string => {
    const cleanPrefix = (prefix.replace(/[^A-Za-z]/g, '').slice(0, 2) || 'UD').toUpperCase().padEnd(2, 'D');
    const randomDigits = Math.floor(100000 + Math.random() * 900000).toString();
    return `${cleanPrefix}${randomDigits}`;
};

/**
 * Check for existing records in the database that match the import data
 */
export const checkForDatabaseDuplicates = async (
    rows: BulkImportRow[],
    formSections: FormSection[]
): Promise<DuplicateConflict[]> => {
    const conflicts: DuplicateConflict[] = [];
    const allFields = formSections.flatMap(s => s.fields || []);

    // Identifiers for cross-referencing
    const phoneFieldId = allFields.find(f => f.label?.toLowerCase().includes('phone'))?.id;
    const resolvedAadharField = allFields.find(f => f.label?.toLowerCase().includes('aadhar') || f.label?.toLowerCase().includes('aadhaar'));
    const aadharFieldId = resolvedAadharField?.id || '18855ee9-0d66-41d6-988b-128b776a8c5b'; // Dynamic lookup with fallback

    // Fetch targeted employees and onboarding submissions using chunked queries to avoid memory issues and full table scans
    const csvIds = Array.from(new Set(rows.map(r => r.employeeId?.trim()).filter(Boolean)));
    const csvPhones = Array.from(new Set(rows.map(r => r.phoneNumber?.trim() || (phoneFieldId ? r[phoneFieldId]?.trim() : '')).filter(Boolean)));
    const csvAadhars = Array.from(new Set(rows.map(r => {
        const aadharKey = Object.keys(r).find(k => k.toLowerCase().includes('aadhar') || k.toLowerCase().includes('aadhaar'));
        return aadharKey ? String(r[aadharKey] || '').trim() : '';
    }).filter(Boolean)));

    const chunk = <T>(arr: T[], size: number): T[][] => {
        const res: T[][] = [];
        for (let i = 0; i < arr.length; i += size) {
            res.push(arr.slice(i, i + size));
        }
        return res;
    };

    const empQueries: Promise<any>[] = [];
    const subQueries: Promise<any>[] = [];

    // Chunked queries by employeeId
    for (const chunkIds of chunk(csvIds, 30)) {
        if (chunkIds.length > 0) {
            empQueries.push(getDocs(query(collection(db, EMPLOYEES_COLLECTION), where("employeeId", "in", chunkIds))));
            subQueries.push(getDocs(query(collection(db, SUBMISSIONS_COLLECTION), where("employeeId", "in", chunkIds))));
        }
    }

    // Chunked queries by phone number
    for (const chunkPhones of chunk(csvPhones, 30)) {
        if (chunkPhones.length > 0) {
            empQueries.push(getDocs(query(collection(db, EMPLOYEES_COLLECTION), where("profileData.personalDetails.phoneNumber", "in", chunkPhones))));
            subQueries.push(getDocs(query(collection(db, SUBMISSIONS_COLLECTION), where("formData.personalDetails.phoneNumber", "in", chunkPhones))));
        }
    }

    // Chunked queries by Aadhaar
    for (const chunkAadhars of chunk(csvAadhars, 30)) {
        if (chunkAadhars.length > 0) {
            empQueries.push(getDocs(query(collection(db, EMPLOYEES_COLLECTION), where(`data.${aadharFieldId}`, "in", chunkAadhars))));
            empQueries.push(getDocs(query(collection(db, EMPLOYEES_COLLECTION), where(`profileData.${aadharFieldId}`, "in", chunkAadhars))));
            subQueries.push(getDocs(query(collection(db, SUBMISSIONS_COLLECTION), where(`formData.${aadharFieldId}`, "in", chunkAadhars))));
            subQueries.push(getDocs(query(collection(db, SUBMISSIONS_COLLECTION), where(`data.${aadharFieldId}`, "in", chunkAadhars))));
        }
    }

    const [empSnaps, subSnaps] = await Promise.all([
        Promise.all(empQueries),
        Promise.all(subQueries)
    ]);

    const empById = new Map<string, string>(); // employeeId -> docId
    const empByPhone = new Map<string, string>(); // phone -> docId
    const empByAadhar = new Map<string, string>(); // aadhar -> docId

    for (const snap of empSnaps) {
        snap.docs.forEach((docSnap: any) => {
            const d = docSnap.data();
            const empId = String(d.employeeId || "").trim();
            if (empId) empById.set(empId, docSnap.id);

            const phone = String(d.profileData?.personalDetails?.phoneNumber || d.data?.[phoneFieldId || ''] || d.profileData?.[phoneFieldId || ''] || "").trim();
            if (phone) empByPhone.set(phone, docSnap.id);

            const aadhar = String(d.data?.[aadharFieldId] || d.profileData?.[aadharFieldId] || "").trim();
            if (aadhar) empByAadhar.set(aadhar, docSnap.id);
        });
    }

    const subById = new Map<string, string>(); // employeeId -> docId
    const subByPhone = new Map<string, string>(); // phone -> docId
    const subByAadhar = new Map<string, string>(); // aadhar -> docId

    for (const snap of subSnaps) {
        snap.docs.forEach((docSnap: any) => {
            const d = docSnap.data();
            const empId = String(d.employeeId || "").trim();
            if (empId) subById.set(empId, docSnap.id);

            const phone = String(d.formData?.personalDetails?.phoneNumber || d.data?.[phoneFieldId || ''] || d.formData?.[phoneFieldId || ''] || "").trim();
            if (phone) subByPhone.set(phone, docSnap.id);

            const aadhar = String(d.data?.[aadharFieldId] || d.formData?.[aadharFieldId] || "").trim();
            if (aadhar) subByAadhar.set(aadhar, docSnap.id);
        });
    }

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 1;

        const employeeId = row.employeeId?.trim();
        const phoneNumber = row.phoneNumber?.trim() || (phoneFieldId ? row[phoneFieldId]?.trim() : '');
        const aadharKey = Object.keys(row).find(k => k.toLowerCase().includes('aadhar') || k.toLowerCase().includes('aadhaar'));
        const aadharNo = aadharKey ? String(row[aadharKey] || '').trim() : '';

        // 1. Check Employees in memory
        if (employeeId && empById.has(employeeId)) {
            conflicts.push({
                row: rowNum,
                fullName: row.fullName,
                employeeId,
                matchType: 'EmployeeID',
                existingRecordId: empById.get(employeeId)!,
                targetCollection: 'employees'
            });
            continue;
        }

        if (phoneNumber && empByPhone.has(phoneNumber)) {
            conflicts.push({
                row: rowNum,
                fullName: row.fullName,
                phoneNumber,
                matchType: 'Phone',
                existingRecordId: empByPhone.get(phoneNumber)!,
                targetCollection: 'employees'
            });
            continue;
        }

        if (aadharNo && empByAadhar.has(aadharNo)) {
            conflicts.push({
                row: rowNum,
                fullName: row.fullName,
                aadharNo,
                matchType: 'Aadhar',
                existingRecordId: empByAadhar.get(aadharNo)!,
                targetCollection: 'employees'
            });
            continue;
        }

        // 2. Check Submissions in memory
        if (employeeId && subById.has(employeeId)) {
            conflicts.push({
                row: rowNum,
                fullName: row.fullName,
                employeeId,
                matchType: 'EmployeeID',
                existingRecordId: subById.get(employeeId)!,
                targetCollection: 'submissions'
            });
            continue;
        }

        if (phoneNumber && subByPhone.has(phoneNumber)) {
            conflicts.push({
                row: rowNum,
                fullName: row.fullName,
                phoneNumber,
                matchType: 'Phone',
                existingRecordId: subByPhone.get(phoneNumber)!,
                targetCollection: 'submissions'
            });
            continue;
        }

        if (aadharNo && subByAadhar.has(aadharNo)) {
            conflicts.push({
                row: rowNum,
                fullName: row.fullName,
                aadharNo,
                matchType: 'Aadhar',
                existingRecordId: subByAadhar.get(aadharNo)!,
                targetCollection: 'submissions'
            });
            continue;
        }
    }

    return conflicts;
};

// Main bulk import function
export const bulkImportEmployees = async (
    rows: BulkImportRow[],
    sites: Site[],
    formSections: FormSection[],
    options: {
        skipValidation?: boolean;
        generateIds?: boolean;
        idPrefix?: string;
        defaultStatus?: 'Approved' | 'Pending Review';
        importMode?: 'direct' | 'pending_profile';
        overwriteMode?: 'overwrite' | 'skip';
        existingConflicts?: DuplicateConflict[];
    } = {}
): Promise<BulkImportResult> => {
    const result: BulkImportResult = {
        success: false,
        totalRows: rows.length,
        successfulImports: 0,
        failedImports: 0,
        errors: [],
        warnings: []
    };

    const {
        skipValidation = false,
        generateIds = true,
        idPrefix = 'EMP',
        defaultStatus = 'Approved',
        importMode = 'direct',
        overwriteMode = 'skip',
        existingConflicts = []
    } = options;

    // Validate first (Deep Validation)
    if (!skipValidation) {
        const validation = validateBulkImportData(rows, sites, formSections);
        if (!validation.valid) {
            // We want to return detailed errors now
            result.errors = validation.errors as any[];
            // Map warnings correctly
            result.warnings = validation.warnings.map(w => ({ row: 0, warning: w }));

            // Critical check: if any row has multiple errors or if too many rows have errors, 
            // the user might want to fix the CSV first. 
            // But for now, we'll let them see the errors.
            return result;
        }
        result.warnings = validation.warnings.map(w => ({ row: 0, warning: w }));
    }

    // Find common form field IDs
    const allFields = formSections.flatMap(s => s.fields || []);
    const nameFieldId = allFields.find(f => f.label?.toLowerCase().includes('name') && !f.label.toLowerCase().includes('father'))?.id;
    const phoneFieldId = allFields.find(f => f.label?.toLowerCase().includes('phone'))?.id;
    const dobFieldId = allFields.find(f => f.label?.toLowerCase().includes('birth'))?.id;
    const unitFieldId = allFields.find(f => f.label?.toLowerCase().includes('unit') || f.label?.toLowerCase().includes('facility'))?.id;

    // Process each row
    let batch = writeBatch(db);
    let batchCount = 0;
    const MAX_BATCH_SIZE = 400;

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 1;

        // Check if this row has a conflict
        const conflict = existingConflicts.find(c => c.row === rowNum);

        if (conflict) {
            if (overwriteMode === 'skip') {
                result.warnings.push({ row: rowNum, warning: `Skipped duplicate: ${row.fullName}` });
                continue;
            }
            // If overwrite, we'll continue and update the same ref
        }

        try {
            // Resolve location: Check sub-units, unit codes, or parent sites
            const { site, subUnit } = resolveLocation(sites, (row.location || '').trim());

            const siteName = site?.name || (row.location || '').trim();
            const siteId = site?.id || '';
            const subUnitId = subUnit?.id || '';
            const subUnitName = subUnit?.name || '';

            // Generate or use provided ID
            let employeeId = row.employeeId?.trim() || (generateIds ? generateEmployeeId(idPrefix) : '');
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
            let submissionId = `UDF-${year}${month}-${randomStr}`;

            // If overwriting an existing record
            if (conflict) {
                submissionId = conflict.existingRecordId;
                employeeId = conflict.employeeId || employeeId || '';
            }

            // Build form data
            const formData: Record<string, any> = {};
            if (nameFieldId) formData[nameFieldId] = row.fullName || '';
            if (phoneFieldId) formData[phoneFieldId] = row.phoneNumber || '';
            if (dobFieldId) formData[dobFieldId] = row.dateOfBirth || '';
            if (unitFieldId) formData[unitFieldId] = siteName;

            // Copy any extra fields
            Object.keys(row).forEach(key => {
                if (!['fullName', 'phoneNumber', 'dateOfBirth', 'location', 'employeeId', 'designation', 'joiningDate'].includes(key)) {
                    // Try to match to a form field
                    const matchingField = allFields.find(f => {
                        const label = f.label?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
                        const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
                        if (label === normalizedKey || f.id === key) return true;

                        // Fuzzy matching for Aadhaar variations (e.g. Aadhar No vs Aadhaar Card)
                        const isAadharField = label.includes('aadhar') || label.includes('aadhaar');
                        const isAadharKey = normalizedKey.includes('aadhar') || normalizedKey.includes('aadhaar');
                        if (isAadharField && isAadharKey) return true;

                        // Fuzzy matching for Phone / Mobile variations
                        const isPhoneField = label.includes('phone') || label.includes('mobile') || label.includes('contact');
                        const isPhoneKey = normalizedKey.includes('phone') || normalizedKey.includes('mobile') || normalizedKey.includes('contact');
                        if (isPhoneField && isPhoneKey) return true;

                        // Fuzzy matching for PAN variations
                        const isPanField = label.includes('pan') && !label.includes('company');
                        const isPanKey = normalizedKey.includes('pan') && !normalizedKey.includes('company');
                        if (isPanField && isPanKey) return true;

                        return false;
                    });
                    if (matchingField) {
                        formData[matchingField.id] = row[key] || '';
                    }
                }
            });

            // Create submission document
            const submissionRef = doc(db, SUBMISSIONS_COLLECTION, submissionId);
            const submissionData = {
                id: submissionId,
                formData,
                originalFormSections: formSections,
                applicantName: row.fullName,
                status: importMode === 'pending_profile' ? SubmissionStatus.PENDING_PROFILE : defaultStatus,
                currentLevel: 99, // Bypass workflow
                timestamp: new Date().toISOString(),
                employeeId: employeeId || '',
                siteId,
                siteName,
                subUnitId,
                subUnitName,
                passwordHash: await hashPassword(generateDefaultPassword(row.fullName, row.dateOfBirth)),
                isDefaultPassword: true,
                needsProfileCompletion: importMode === 'pending_profile',
                profileStatus: importMode === 'pending_profile' ? 'waiting_for_employee' : 'approved',
                approvalHistory: [{
                    level: 1,
                    actionBy: 'Bulk Import',
                    actionByRole: 'System',
                    timestamp: new Date().toISOString(),
                    status: importMode === 'pending_profile' ? SubmissionStatus.PENDING_PROFILE : defaultStatus,
                    comments: importMode === 'pending_profile' ? 'Imported as Pending Profile (Requires self-completion)' : 'Imported via bulk upload'
                }]
            };

            batch.set(submissionRef, submissionData);
            batchCount++;

            // If approved or Pending Profile, create employee record
            if ((defaultStatus === 'Approved' || importMode === 'pending_profile') && employeeId) {
                const employeeRef = doc(db, EMPLOYEES_COLLECTION, submissionId);

                // Create initial assignment
                const assignment: any = {
                    id: uuidv4(),
                    siteId,
                    subUnitId,
                    designation: row.designation || 'Staff',
                    type: 'PRIMARY',
                    joiningDate: row.joiningDate || new Date().toISOString(),
                    status: 'Active'
                };

                const employeeData = {
                    employeeId,
                    portalId: submissionId,
                    applicantName: row.fullName,
                    joiningDate: row.joiningDate || new Date().toISOString(),
                    designation: row.designation || 'Staff',
                    currentSiteId: siteId,
                    siteName,
                    subUnitId,
                    subUnitName,
                    isActive: true,
                    needsProfileCompletion: importMode === 'pending_profile',
                    profileStatus: importMode === 'pending_profile' ? 'waiting_for_employee' : 'approved',
                    isBlocked: false,
                    isRelieved: false,
                    data: formData,
                    profileData: {
                        personalDetails: {
                            fullName: row.fullName || '',
                            phoneNumber: row.phoneNumber || ''
                        }
                    },
                    activeAssignments: [assignment],
                    assignmentHistory: [assignment],
                    assignedSiteIds: [siteId],
                    createdAt: new Date().toISOString(),
                    importedVia: importMode === 'pending_profile' ? 'pending_profile_import' : 'bulk_upload',
                    passwordHash: await hashPassword(generateDefaultPassword(row.fullName, row.dateOfBirth)),
                    isDefaultPassword: true
                };

                batch.set(employeeRef, employeeData, { merge: true });
                batchCount++;
            }

            result.successfulImports++;

            // Commit batch if approaching limit
            if (batchCount >= MAX_BATCH_SIZE) {
                await batch.commit();
                batch = writeBatch(db);
                batchCount = 0;
            }

        } catch (err: any) {
            result.failedImports++;
            result.errors.push({
                row: i + 1,
                error: err.message || 'Unknown error',
                data: row
            });
        }
    }

    // Commit remaining
    if (batchCount > 0) {
        await batch.commit();
    }

    result.success = result.failedImports === 0;
    return result;
};

// Export template CSV
export const getBulkImportTemplate = (formSections: FormSection[] = []): string => {
    // Core fields that are always included at the start for clarity
    const coreFields = [
        { label: 'Full Name', example: 'John Doe' },
        { label: 'Phone Number', example: '9876543210' },
        { label: 'Date of Birth', example: '1990-05-15' },
        { label: 'Unit Code / Unit Name / Sub Unit', example: 'CAPGEMINI' },
        { label: 'Employee ID', example: 'EMP001' },
        { label: 'Designation', example: 'Security Guard' },
        { label: 'Joining Date', example: '2024-01-15' }
    ];

    // Core labels we want to skip if they appear exactly in the form (to avoid duplicate columns)
    const coreLabels = [
        'full name', 'phone number', 'date of birth',
        'unit or facility', 'site or unit', 'location',
        'employee id', 'designation', 'joining date'
    ];

    // Get all fields from form builder
    const customFields = formSections.flatMap(s => s.fields || [])
        .filter(f => {
            const label = f.label?.toLowerCase().trim() || '';

            // 1. Filter out non-importable fields
            const isImportable = ![FieldType.FILE_UPLOAD, FieldType.HEADER, FieldType.INFO_TEXT].includes(f.type);
            if (!isImportable) return false;

            // 2. Filter out EXACT duplicates of core fields
            const isExactCore = coreLabels.includes(label);

            return !isExactCore;
        });

    // Combine headers
    const headers = [...coreFields.map(cf => cf.label), ...customFields.map(f => f.label)];
    const csvHeader = headers.join(',');

    // Generate example rows
    const exampleRows = [
        [...coreFields.map(cf => cf.example), ...customFields.map(f => {
            // Provide a better example value based on type if possible
            if (f.type === FieldType.DATE) return 'YYYY-MM-DD';
            if (f.type === FieldType.DROPDOWN && f.options && f.options.length > 0) return f.options[0];
            return '...';
        })].join(','),
        ['Jane Smith', '9123456789', '1985-03-20', 'T4 ODC', 'EMP002', 'Supervisor', '2024-01-15', ...customFields.map(() => '...')].join(','),
        ['Robert Brown', '9998887776', '1988-11-10', 'U101', 'EMP003', 'Assistant', '2024-01-15', ...customFields.map(() => '...')].join(',')
    ];

    return [csvHeader, ...exampleRows].join('\n');
};

// Export template native Excel (.xlsx) where ALL cells are formatted as Text (@)
export const getBulkImportExcelTemplateBlob = (formSections: FormSection[] = []): Blob => {
    const csvContent = getBulkImportTemplate(formSections);
    const rows = csvContent.split('\n').map(r => r.split(','));
    const ws = XLSX.utils.aoa_to_sheet(rows);

    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellRef = XLSX.utils.encode_cell({ c: C, r: R });
            const cell = ws[cellRef];
            if (cell && cell.v !== undefined && cell.v !== null) {
                cell.t = 's'; // Force string type
                cell.z = '@'; // Force Excel Text number-format
                cell.v = String(cell.v);
            }
        }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};


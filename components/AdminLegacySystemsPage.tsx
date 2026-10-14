import React, { useState, useEffect, useCallback } from 'react';
import { LegacyClaimConfig, LegacyImportedEmployee, LegacyVerificationMetric } from '../types';
import {
    subscribeToLegacyClaimConfig,
    updateLegacyClaimConfig,
    subscribeToLegacyImports,
    bulkUploadLegacyImports,
    deleteLegacyImport,
    clearAllLegacyImports,
    updateLegacyImport
} from '../src/services/adminService';
import Button from './common/Button';
import { parseFlexibleDate } from '../src/utils/bulkImportUtils';
import {
    Settings, Upload, Trash2, Users, Shield, Phone, CreditCard, Calendar,
    FileSpreadsheet, CheckCircle, AlertCircle, Loader2, ChevronDown, X, Info, ToggleLeft, ToggleRight, Search, Download, Edit2, Save
} from 'lucide-react';
/** Simple CSV parser: splits by newline, then by comma, handling quoted fields */
const parseCSV = (text: string): Record<string, string>[] => {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];

    const normalizeValue = (val: string): string => {
        const trimmed = val.trim();
        if (/^[+\-]?\d+(\.\d+)?[eE][+\-]?\d+$/.test(trimmed)) {
            try {
                const parts = trimmed.split(/[eE]/);
                const base = parts[0];
                const exp = parseInt(parts[1], 10);
                if (exp > 0 && !base.includes('.')) {
                    return base + '0'.repeat(exp);
                } else if (exp > 0 && base.includes('.')) {
                    const decParts = base.split('.');
                    const decLength = decParts[1].length;
                    if (exp >= decLength) {
                        return decParts[0] + decParts[1] + '0'.repeat(exp - decLength);
                    }
                }
            } catch (err) {
                // fallback
            }
            const num = Number(trimmed);
            if (!isNaN(num)) {
                return num.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 0 });
            }
        }
        return trimmed;
    };
    
    const parseRow = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (const ch of line) {
            if (ch === '"') { inQuotes = !inQuotes; continue; }
            if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue; }
            current += ch;
        }
        result.push(current.trim());
        return result;
    };

    const headers = parseRow(lines[0]);
    return lines.slice(1).map(line => {
        const values = parseRow(line);
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = normalizeValue(values[i] || ''); });
        return obj;
    });
};

/** Normalize a header string to a camelCase key we expect */
const findField = (row: Record<string, string>, ...candidates: string[]): string => {
    for (const key of candidates) {
        // Exact match
        if (row[key] !== undefined) return row[key];
        // Case-insensitive match
        const lower = key.toLowerCase();
        const found = Object.keys(row).find(k => k.toLowerCase() === lower || k.toLowerCase().replace(/[\s_-]+/g, '') === lower.replace(/[\s_-]+/g, ''));
        if (found) return row[found];
    }
    return '';
};

const DEFAULT_CONFIG: LegacyClaimConfig = {
    enabled: false,
    verificationMetrics: ['phone'],
    verificationLabel: 'Registered Phone Number',
};

const METRIC_OPTIONS: { value: LegacyVerificationMetric; label: string; icon: React.ReactNode; description: string }[] = [
    { value: 'phone', label: 'Phone Number', icon: <Phone size={18} />, description: 'Employee must enter the phone number from your Excel sheet.' },
    { value: 'aadhaar', label: 'Aadhaar Number', icon: <Shield size={18} />, description: 'Employee must enter the Aadhaar number from your Excel sheet. Most secure.' },
    { value: 'pan', label: 'PAN Card Number', icon: <CreditCard size={18} />, description: 'Employee must enter their PAN number (Permanent Account Number).' },
    { value: 'bankAccount', label: 'Bank Account Number', icon: <CreditCard size={18} />, description: 'Verification by Bank Account Number (Last 4 digits recommended).' },
    { value: 'fatherName', label: "Father's Name", icon: <Users size={18} />, description: 'Verification by Father\'s Name as per records.' },
    { value: 'dob', label: 'Date of Birth', icon: <Calendar size={18} />, description: 'Employee must enter their Date of Birth. Easiest but least secure.' },
];

const METRIC_LABELS: Record<LegacyVerificationMetric, string> = {
    phone: 'Phone Number',
    aadhaar: 'Aadhaar Number',
    pan: 'PAN Card Number',
    bankAccount: 'Bank Account Number',
    fatherName: "Father's Name",
    dob: 'Date of Birth',
};

interface AdminLegacySystemsPageProps {
    logAction: (actionType: string, targetModule: string, details: string) => void;
}

const AdminLegacySystemsPage: React.FC<AdminLegacySystemsPageProps> = ({ logAction }) => {
    const [config, setConfig] = useState<LegacyClaimConfig>(DEFAULT_CONFIG);
    const [imports, setImports] = useState<LegacyImportedEmployee[]>([]);
    const [activeTab, setActiveTab] = useState<'SETTINGS' | 'IMPORTS'>('SETTINGS');
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState<{ success: number; errors: string[] } | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [editingImport, setEditingImport] = useState<LegacyImportedEmployee | null>(null);
    const [editFormData, setEditFormData] = useState<Record<string, string>>({});

    // Subscribe to live data
    useEffect(() => {
        const unsubConfig = subscribeToLegacyClaimConfig((cfg) => {
            setConfig(cfg || DEFAULT_CONFIG);
        });
        const unsubImports = subscribeToLegacyImports((data) => {
            setImports(data);
        });
        return () => { unsubConfig(); unsubImports(); };
    }, []);

    // --- Settings Handlers ---
    const handleToggleEnabled = async () => {
        const updated = { ...config, enabled: !config.enabled };
        setIsSaving(true);
        await updateLegacyClaimConfig(updated);
        logAction('UPDATE', 'SYSTEM', `Legacy Profile Claim ${updated.enabled ? 'enabled' : 'disabled'}`);
        setIsSaving(false);
    };

    const handleMetricToggle = async (metric: LegacyVerificationMetric) => {
        let newMetrics = [...(config.verificationMetrics || [])];
        if (newMetrics.includes(metric)) {
            // Don't allow removing the last one
            if (newMetrics.length > 1) {
                newMetrics = newMetrics.filter(m => m !== metric);
            }
        } else {
            newMetrics.push(metric);
        }

        const updated = { ...config, verificationMetrics: newMetrics };
        setIsSaving(true);
        await updateLegacyClaimConfig(updated);
        logAction('UPDATE', 'SYSTEM', `Legacy verification metrics updated: ${newMetrics.join(', ')}`);
        setIsSaving(false);
    };

    // --- Upload Handlers ---
    const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setUploadResult(null);

        try {
            const text = await file.text();
            const parsed = parseCSV(text);

            if (parsed.length === 0) {
                setUploadResult({ success: 0, errors: ['No valid data rows found in the file. Ensure a header row exists.'] });
                setIsUploading(false);
                return;
            }

            // Map CSV rows to LegacyImportedEmployee
            const rows: LegacyImportedEmployee[] = parsed.map(row => {
                const employeeId = findField(row, 'employeeId', 'Employee ID', 'employee_id', 'EmpID', 'Emp ID').trim();
                const fullName = findField(row, 'fullName', 'Full Name', 'full_name', 'Name', 'Employee Name').trim();

                if (!employeeId || !fullName) return null;

                const rawDob = findField(row, 'dateOfBirth', 'Date of Birth', 'DOB', 'date_of_birth', 'Birth Date').trim();
                const dateOfBirth = rawDob ? (parseFlexibleDate(rawDob) || rawDob) : '';

                return {
                    id: '', // will be set by Firestore
                    employeeId,
                    fullName,
                    phoneNumber: findField(row, 'phoneNumber', 'Phone Number', 'phone', 'Mobile', 'Mobile Number', 'Contact').trim(),
                    aadhaarNumber: findField(row, 'aadhaarNumber', 'Aadhar Card No', 'Aadhaar', 'Aadhaar Number', 'aadhar', 'Aadhar No').trim(),
                    panNumber: findField(row, 'panNumber', 'PAN Number', 'PAN Card', 'PAN No', 'PAN').trim(),
                    bankAccountNumber: findField(row, 'bankAccountNumber', 'Bank Account', 'Account Number', 'Account No', 'A/C No', 'Bank A/C').trim(),
                    fatherName: findField(row, 'fatherName', 'Father Name', 'Father\'s Name', 'Guardian Name', 'Father').trim(),
                    dateOfBirth,
                    designation: findField(row, 'designation', 'Designation', 'Post', 'Position', 'Post of Apply').trim(),
                    location: findField(row, 'location', 'Location', 'Unit', 'Site', 'Unit or Facility', 'Facility').trim(),
                    rawData: row,
                    claimed: false,
                    importedAt: new Date().toISOString(),
                };
            }).filter(Boolean) as LegacyImportedEmployee[];

            const errors: string[] = [];
            const validRows = rows.filter((r, i) => {
                if (!r.employeeId) { errors.push(`Row ${i + 1}: Missing Employee ID`); return false; }
                if (!r.fullName) { errors.push(`Row ${i + 1}: Missing Full Name`); return false; }
                return true;
            });

            // Smart Merge Logic
            const finalRows = validRows.map(row => {
                const existing = imports.find(imp => imp.employeeId.toUpperCase() === row.employeeId.toUpperCase());
                if (!existing) return row; // Create new

                // We have an existing record. We only want to overwrite fields that are non-empty strings.
                const mergeObj: any = { ...existing };
                
                // Merge direct properties
                Object.keys(row).forEach(key => {
                    if (key !== 'rawData' && key !== 'id' && (row as any)[key]) {
                        mergeObj[key] = (row as any)[key];
                    }
                });

                // Merge rawData
                mergeObj.rawData = { ...existing.rawData };
                if (row.rawData) {
                    Object.keys(row.rawData).forEach(key => {
                        if (row.rawData[key]) mergeObj.rawData[key] = row.rawData[key];
                    });
                }

                return mergeObj as LegacyImportedEmployee;
            });

            if (finalRows.length > 0) {
                await bulkUploadLegacyImports(finalRows);
                logAction('CREATE', 'SYSTEM', `Uploaded/Merged ${finalRows.length} legacy employee records`);
            }

            setUploadResult({ success: finalRows.length, errors });
        } catch (err: any) {
            setUploadResult({ success: 0, errors: [`File parsing error: ${err.message}`] });
        }

        setIsUploading(false);
        // Reset file input
        e.target.value = '';
    }, [logAction]);

    const handleDeleteImport = async (id: string) => {
        if (!window.confirm('Remove this legacy record? The employee will no longer be able to claim it.')) return;
        await deleteLegacyImport(id);
        logAction('DELETE', 'SYSTEM', `Deleted legacy import: ${id}`);
    };
    const handleClearAll = async () => {
        await clearAllLegacyImports();
        logAction('DELETE', 'SYSTEM', `Cleared all legacy employee imports`);
        setShowClearConfirm(false);
    };

    const handleSaveEdit = async () => {
        if (!editingImport) return;
        setIsSaving(true);
        try {
            // Update the main fields, also merge into rawData for fallback matching
            const updated = {
                ...editingImport,
                ...editFormData,
                rawData: {
                    ...editingImport.rawData,
                    ...editFormData,
                }
            };
            await updateLegacyImport(editingImport.id, updated);
            logAction('UPDATE', 'SYSTEM', `Updated legacy record for ${editingImport.employeeId}`);
            setEditingImport(null);
        } catch (e) {
            console.error("Error updating legacy import:", e);
            alert("Failed to update record.");
        }
        setIsSaving(false);
    };

    const handleDownloadTemplate = () => {
        const headers = [
            "Employee ID", "Full Name", "Phone Number", "Gender", "Date of Birth", "Citizenship", "Blood Group", "Height", "Identity Marks", "Marital Status", "Spouse Name",
            "Qualification", "Post of Apply", "Unit or Facility", "Specific Location / Sub-Unit", "Any Police Case", "Previous Employment History", "Previous Company & Experience",
            "Present Address", "Permanent Address", "Reference Name", "Reference Relationship", "Reference Address", "Reference Contact No",
            "Father's Name", "Mother's Name", "Father's Mobile Number", "Mother's Mobile Number", "Aadhar Card No", "PAN Card No", "UAN No or EPFO", "ESIC No", "PVC (Police Verification Certificate)", "PVC Number",
            "Bank Name", "Account No", "IFSC Code", "Branch Name"
        ];
        const exampleRow = [
            "EMP001", "John Doe", "9876543210", "Male", "1990-01-01", "Indian", "O+", "175cm", "Mole on right cheek", "Single", "",
            "Degree", "Security Guard", "CAPGEMINI", "", "No", "Fresher", "",
            "123 Local St, Hyderabad", "Same as above", "Jane Smith", "Friend", "456 Other Rd, Hyderabad", "9876543211",
            "Richard Doe", "Mary Doe", "9876543212", "9876543213", "123456789012", "ABCDE1234F", "100123456789", "1234567890", "No", "",
            "HDFC Bank", "50100123456789", "HDFC0001234", "Gachibowli"
        ];
        const csvContent = headers.join(",") + "\n" + exampleRow.join(",");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "Legacy_Employee_Import_Template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- Filtering ---
    const filteredImports = imports.filter(imp => {
        if (!searchTerm) return true;
        const s = searchTerm.toLowerCase();
        return imp.fullName.toLowerCase().includes(s) ||
            imp.employeeId.toLowerCase().includes(s) ||
            (imp.phoneNumber || '').includes(s) ||
            (imp.panNumber || '').includes(s) ||
            (imp.bankAccountNumber || '').includes(s) ||
            (imp.aadhaarNumber || '').includes(s);
    });

    const unclaimedCount = imports.filter(i => !i.claimed).length;
    const claimedCount = imports.filter(i => i.claimed).length;

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl p-6 text-white shadow-lg">
                <div className="flex items-center space-x-3 mb-2">
                    <div className="bg-white/20 p-2.5 rounded-xl">
                        <Users size={28} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Legacy Systems</h1>
                        <p className="text-amber-100 text-sm font-medium">Manage legacy employee imports and profile claim settings</p>
                    </div>
                </div>
                {/* Stats Bar */}
                <div className="flex space-x-6 mt-4 text-sm font-medium">
                    <div className="bg-white/15 px-4 py-2 rounded-lg">
                        <span className="text-amber-200">Total Imported:</span> <span className="font-bold">{imports.length}</span>
                    </div>
                    <div className="bg-white/15 px-4 py-2 rounded-lg">
                        <span className="text-amber-200">Waiting:</span> <span className="font-bold">{unclaimedCount}</span>
                    </div>
                    <div className="bg-white/15 px-4 py-2 rounded-lg">
                        <span className="text-green-200">Claimed:</span> <span className="font-bold">{claimedCount}</span>
                    </div>
                </div>
            </div>

            {/* Tab Bar */}
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl">
                <button
                    onClick={() => setActiveTab('SETTINGS')}
                    className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${activeTab === 'SETTINGS' ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <Settings size={18} />
                    <span>Claim Settings</span>
                </button>
                <button
                    onClick={() => setActiveTab('IMPORTS')}
                    className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${activeTab === 'IMPORTS' ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <FileSpreadsheet size={18} />
                    <span>Legacy Imports ({imports.length})</span>
                </button>
            </div>

            {/* ─── SETTINGS TAB ─── */}
            {activeTab === 'SETTINGS' && (
                <div className="space-y-6">
                    {/* Feature Toggle */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <div className={`p-3 rounded-xl ${config.enabled ? 'bg-green-50' : 'bg-gray-100'}`}>
                                    <Shield size={24} className={config.enabled ? 'text-green-600' : 'text-gray-400'} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-800">Enable Profile Claim</h3>
                                    <p className="text-sm text-gray-500">Allow legacy employees to self-verify and claim their pre-imported profiles.</p>
                                </div>
                            </div>
                            <button
                                onClick={handleToggleEnabled}
                                disabled={isSaving}
                                className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${config.enabled ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                            >
                                {config.enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                                <span>{config.enabled ? 'Enabled' : 'Disabled'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Verification Metric Selector */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                        <h3 className="text-lg font-bold text-gray-800 mb-1">Verification Metric</h3>
                        <p className="text-sm text-gray-500 mb-6">Choose what the employee must enter (along with their Employee ID) to verify their identity and access their profile.</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {METRIC_OPTIONS.map(opt => {
                                const isSelected = (config.verificationMetrics || []).includes(opt.value);
                                return (
                                    <button
                                        key={opt.value}
                                        onClick={() => handleMetricToggle(opt.value)}
                                        disabled={isSaving}
                                        className={`p-5 rounded-xl border-2 text-left transition-all ${isSelected
                                                ? 'border-amber-500 bg-amber-50 shadow-md'
                                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        <div className="flex items-center space-x-3 mb-3">
                                            <div className={`p-2 rounded-lg ${isSelected ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                                                {opt.icon}
                                            </div>
                                            <span className={`font-bold ${isSelected ? 'text-amber-800' : 'text-gray-700'}`}>
                                                {opt.label}
                                            </span>
                                            {isSelected && (
                                                <CheckCircle size={18} className="text-amber-600 ml-auto" />
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 leading-relaxed">{opt.description}</p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* How It Works Info */}
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                        <div className="flex items-start space-x-3">
                            <Info size={20} className="text-blue-500 mt-0.5 flex-shrink-0" />
                            <div>
                                <h4 className="font-bold text-blue-800 mb-2">How Profile Claim Works</h4>
                                <ol className="text-sm text-blue-700 space-y-1.5 list-decimal list-inside">
                                    <li>You upload an Excel/CSV roster of legacy employees using the <strong>Legacy Imports</strong> tab.</li>
                                    <li>The employee visits the Portal and clicks <strong>"Claim Existing Profile"</strong>.</li>
                                    <li>They enter their <strong>Employee ID</strong> + <strong>ALL</strong> selected verification fields.</li>
                                    <li>If the data matches our records, they get access to a pre-filled Joining Form to complete their profile.</li>
                                    <li>Once submitted and approved, they officially appear in the <strong>Master Employee List</strong>.</li>
                                </ol>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── IMPORTS TAB ─── */}
            {activeTab === 'IMPORTS' && (
                <div className="space-y-6">
                    {/* Upload Card */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                        <h3 className="text-lg font-bold text-gray-800 mb-1">Upload Legacy Employee Roster</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Upload a CSV or Excel file containing your old employee data. Required columns: <strong>Employee ID</strong> and <strong>Full Name</strong>.
                            Optional: Phone Number, Aadhar Card No, Date of Birth, Designation, Location.
                        </p>

                        <div className="flex items-center space-x-4">
                            <label className="flex items-center space-x-2 px-5 py-3 bg-amber-600 text-white rounded-xl font-semibold text-sm cursor-pointer hover:bg-amber-700 transition-colors shadow-md">
                                {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                                <span>{isUploading ? 'Processing...' : 'Upload CSV File'}</span>
                                <input
                                    type="file"
                                    accept=".csv,.txt"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                    disabled={isUploading}
                                />
                            </label>

                            <Button 
                                onClick={handleDownloadTemplate} 
                                variant="secondary" 
                                className="flex items-center space-x-2 px-5 py-3 border-amber-200 text-amber-700 hover:bg-amber-50 rounded-xl font-semibold text-sm transition-colors"
                            >
                                <Download size={18} />
                                <span>Download Template</span>
                            </Button>

                            {imports.length > 0 && (
                                <div className="relative">
                                    {showClearConfirm ? (
                                        <div className="flex items-center space-x-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
                                            <span className="text-sm text-red-700 font-medium">Delete ALL {imports.length} records?</span>
                                            <Button onClick={handleClearAll} variant="danger" size="sm">Yes, Clear</Button>
                                            <Button onClick={() => setShowClearConfirm(false)} variant="secondary" size="sm">Cancel</Button>
                                        </div>
                                    ) : (
                                        <Button onClick={() => setShowClearConfirm(true)} variant="secondary" className="text-red-600 border-red-200 hover:bg-red-50">
                                            <Trash2 size={16} className="mr-1" /> Clear All
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Upload Result */}
                        {uploadResult && (
                            <div className={`mt-4 p-4 rounded-lg border ${uploadResult.success > 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                {uploadResult.success > 0 && (
                                    <p className="text-green-700 font-semibold flex items-center space-x-2">
                                        <CheckCircle size={18} />
                                        <span>Successfully imported {uploadResult.success} employees!</span>
                                    </p>
                                )}
                                {uploadResult.errors.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                        {uploadResult.errors.map((err, i) => (
                                            <p key={i} className="text-red-600 text-sm flex items-center space-x-1">
                                                <AlertCircle size={14} />
                                                <span>{err}</span>
                                            </p>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Search & Table */}
                    {imports.length > 0 && (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            {/* Search Bar */}
                            <div className="p-4 border-b border-gray-100">
                                <div className="relative">
                                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search by name, Employee ID, phone, or Aadhaar..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            {/* Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-semibold">Employee ID</th>
                                            <th className="px-4 py-3 text-left font-semibold">Full Name</th>
                                            <th className="px-4 py-3 text-left font-semibold">Phone</th>
                                            <th className="px-4 py-3 text-left font-semibold">Aadhaar</th>
                                            <th className="px-4 py-3 text-left font-semibold">DOB</th>
                                            <th className="px-4 py-3 text-left font-semibold">Designation</th>
                                            <th className="px-4 py-3 text-center font-semibold">Status</th>
                                            <th className="px-4 py-3 text-center font-semibold">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {filteredImports.map(imp => (
                                            <tr key={imp.id} className={`hover:bg-gray-50 transition-colors ${imp.claimed ? 'bg-green-50/50' : ''}`}>
                                                <td className="px-4 py-3 font-mono font-bold text-gray-700">{imp.employeeId}</td>
                                                <td className="px-4 py-3 font-medium text-gray-800">{imp.fullName}</td>
                                                <td className="px-4 py-3 text-gray-600">{imp.phoneNumber || '—'}</td>
                                                <td className="px-4 py-3 text-gray-600 font-mono">{imp.aadhaarNumber ? `****${imp.aadhaarNumber.slice(-4)}` : '—'}</td>
                                                <td className="px-4 py-3 text-gray-600">{imp.dateOfBirth || '—'}</td>
                                                <td className="px-4 py-3 text-gray-600">{imp.designation || '—'}</td>
                                                <td className="px-4 py-3 text-center">
                                                    {imp.claimed ? (
                                                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                                                            <CheckCircle size={12} />
                                                            <span>Claimed</span>
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                                                            <span>Waiting</span>
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {!imp.claimed && (
                                                        <div className="flex items-center justify-center space-x-2">
                                                            <button
                                                                onClick={() => {
                                                                    setEditingImport(imp);
                                                                    setEditFormData({
                                                                        fullName: imp.fullName,
                                                                        phoneNumber: imp.phoneNumber || '',
                                                                        aadhaarNumber: imp.aadhaarNumber || '',
                                                                        panNumber: imp.panNumber || '',
                                                                        bankAccountNumber: imp.bankAccountNumber || '',
                                                                        dateOfBirth: imp.dateOfBirth || '',
                                                                        designation: imp.designation || '',
                                                                    });
                                                                }}
                                                                className="p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                                                                title="Edit"
                                                            >
                                                                <Edit2 size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteImport(imp.id)}
                                                                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                title="Remove"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {filteredImports.length === 0 && searchTerm && (
                                <div className="p-8 text-center text-gray-400">
                                    No records match "{searchTerm}"
                                </div>
                            )}
                        </div>
                    )}

                    {imports.length === 0 && (
                        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
                            <FileSpreadsheet size={48} className="mx-auto text-gray-300 mb-4" />
                            <h3 className="text-lg font-bold text-gray-500 mb-2">No Legacy Employees Imported</h3>
                            <p className="text-sm text-gray-400">Upload a CSV file above to get started. These records will be hidden from the Master Employee List until the employees claim and complete their profiles.</p>
                        </div>
                    )}
                </div>
            )}
            {/* ─── EDIT MODAL ─── */}
            {editingImport && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">Edit Legacy Record</h3>
                                <p className="text-sm border text-gray-500 mt-1 inline-block px-2 bg-white rounded">ID: {editingImport.employeeId}</p>
                            </div>
                            <button
                                onClick={() => setEditingImport(null)}
                                className="p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-xl transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-1 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1 col-span-2">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Full Name *</label>
                                    <input
                                        type="text"
                                        value={editFormData.fullName || ''}
                                        onChange={e => setEditFormData({ ...editFormData, fullName: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Phone Number</label>
                                    <input
                                        type="text"
                                        value={editFormData.phoneNumber || ''}
                                        onChange={e => setEditFormData({ ...editFormData, phoneNumber: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Aadhaar (+)</label>
                                    <input
                                        type="text"
                                        value={editFormData.aadhaarNumber || ''}
                                        onChange={e => setEditFormData({ ...editFormData, aadhaarNumber: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">PAN Number</label>
                                    <input
                                        type="text"
                                        value={editFormData.panNumber || ''}
                                        onChange={e => setEditFormData({ ...editFormData, panNumber: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Bank Account</label>
                                    <input
                                        type="text"
                                        value={editFormData.bankAccountNumber || ''}
                                        onChange={e => setEditFormData({ ...editFormData, bankAccountNumber: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Date of Birth</label>
                                    <input
                                        type="text"
                                        placeholder="YYYY-MM-DD"
                                        value={editFormData.dateOfBirth || ''}
                                        onChange={e => setEditFormData({ ...editFormData, dateOfBirth: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Designation</label>
                                    <input
                                        type="text"
                                        value={editFormData.designation || ''}
                                        onChange={e => setEditFormData({ ...editFormData, designation: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                </div>
                            </div>
                            <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                                Note: Editing here only updates the top-level searchable fields. Other custom fields from the CSV are preserved in raw data.
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                            <Button variant="secondary" onClick={() => setEditingImport(null)} disabled={isSaving}>
                                Cancel
                            </Button>
                            <Button onClick={handleSaveEdit} disabled={isSaving} className="flex items-center space-x-2 bg-amber-600 text-white hover:bg-amber-700">
                                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                <span>Save Changes</span>
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminLegacySystemsPage;

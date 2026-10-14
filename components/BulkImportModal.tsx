import React, { useState, useCallback } from 'react';
import { Site, FormSection, FieldType } from '../types';
import Button from './common/Button';
import Modal from './common/Modal';
import { Upload, Download, AlertTriangle, CheckCircle, X, FileText, Loader2, XCircle, Settings, ChevronDown, ChevronRight } from 'lucide-react';
import { parseCSV, validateBulkImportData, bulkImportEmployees, getBulkImportTemplate, getBulkImportExcelTemplateBlob, checkForDatabaseDuplicates, BulkImportRow, BulkImportResult, DuplicateConflict, ValidationSettings, ValidationSeverity } from '../src/utils/bulkImportUtils';
import * as XLSX from 'xlsx';

interface BulkImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    sites: Site[];
    formSections: FormSection[];
    onImportComplete: (result: BulkImportResult) => void;
}

const BulkImportModal: React.FC<BulkImportModalProps> = ({
    isOpen,
    onClose,
    sites,
    formSections,
    onImportComplete
}) => {
    const [step, setStep] = useState<'upload' | 'preview' | 'duplicates' | 'importing' | 'complete'>('upload');
    const [parsedData, setParsedData] = useState<BulkImportRow[]>([]);
    const [validationErrors, setValidationErrors] = useState<any[]>([]);
    const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
    const [duplicateConflicts, setDuplicateConflicts] = useState<DuplicateConflict[]>([]);
    const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
    const [importOptions, setImportOptions] = useState({
        generateIds: true,
        idPrefix: 'EMP',
        defaultStatus: 'Approved' as 'Approved' | 'Pending Review',
        importMode: 'direct' as 'direct' | 'pending_profile',
        overwriteMode: 'skip' as 'overwrite' | 'skip'
    });
    const [validationSettings, setValidationSettings] = useState<ValidationSettings>({});
    const [showSettings, setShowSettings] = useState(false);
    const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);

    const runValidation = useCallback((data: BulkImportRow[], settings: ValidationSettings) => {
        const validation = validateBulkImportData(data, sites, formSections, settings);
        setValidationErrors(validation.errors);
        setValidationWarnings(validation.warnings);
    }, [sites, formSections]);

    const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

        if (isExcel) {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = new Uint8Array(event.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array', raw: false });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const csvContent = XLSX.utils.sheet_to_csv(worksheet);
                    const rows = parseCSV(csvContent);
                    setParsedData(rows);
                    runValidation(rows, validationSettings);
                    if (rows.length > 0) {
                        setStep('preview');
                    }
                } catch (err: any) {
                    console.error("Excel parse error:", err);
                    alert("Failed to parse Excel file. Please ensure it is a valid .xlsx or .csv file.");
                }
            };
            reader.readAsArrayBuffer(file);
        } else {
            const reader = new FileReader();
            reader.onload = (event) => {
                const content = event.target?.result as string;
                const rows = parseCSV(content);
                setParsedData(rows);

                // Validate
                runValidation(rows, validationSettings);

                if (rows.length > 0) {
                    setStep('preview');
                }
            };
            reader.readAsText(file);
        }
    }, [runValidation, validationSettings]);

    const handleDownloadTemplate = () => {
        const blob = getBulkImportExcelTemplateBlob(formSections);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'employee_import_template.xlsx';
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleDownloadCsvTemplate = () => {
        const template = getBulkImportTemplate(formSections);
        const blob = new Blob([template], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'employee_import_template.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleProceedToImport = async () => {
        setIsCheckingDuplicates(true);
        try {
            const conflicts = await checkForDatabaseDuplicates(parsedData, formSections);
            setDuplicateConflicts(conflicts);
            if (conflicts.length > 0) {
                setStep('duplicates');
            } else {
                handleStartImport();
            }
        } catch (err) {
            console.error("Duplicate check failed:", err);
            handleStartImport(); // Fallback to normal import if check fails
        } finally {
            setIsCheckingDuplicates(false);
        }
    };

    const handleStartImport = async () => {
        setStep('importing');

        try {
            const result = await bulkImportEmployees(
                parsedData,
                sites,
                formSections,
                {
                    skipValidation: true,
                    generateIds: importOptions.generateIds,
                    idPrefix: importOptions.idPrefix,
                    defaultStatus: importOptions.defaultStatus,
                    importMode: importOptions.importMode,
                    overwriteMode: importOptions.overwriteMode,
                    existingConflicts: duplicateConflicts
                }
            );

            setImportResult(result);
            setStep('complete');
            onImportComplete(result);
        } catch (err: any) {
            setImportResult({
                success: false,
                totalRows: parsedData.length,
                successfulImports: 0,
                failedImports: parsedData.length,
                errors: [{ row: 0, error: err.message, data: {} as BulkImportRow }],
                warnings: []
            });
            setStep('complete');
        }
    };

    const handleClose = () => {
        setStep('upload');
        setParsedData([]);
        setValidationErrors([]);
        setValidationWarnings([]);
        setImportResult(null);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Bulk Import Employees" size="lg">
            <div className="min-h-[400px] relative">
                {/* Step 1: Upload */}
                {step === 'upload' && (
                    <div className="space-y-6">
                        <div className="text-center p-8 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                            <Upload size={48} className="mx-auto text-gray-400 mb-4" />
                            <h3 className="text-lg font-bold text-gray-700 mb-2">Upload CSV File</h3>
                            <p className="text-sm text-gray-500 mb-4">
                                Upload an Excel (.xlsx) or CSV file with employee data. Maximum 500 rows per import.
                            </p>
                            <input
                                type="file"
                                accept=".csv, .xlsx, .xls"
                                onChange={handleFileUpload}
                                className="hidden"
                                id="csv-upload"
                            />
                            <label
                                htmlFor="csv-upload"
                                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg font-bold cursor-pointer hover:bg-blue-700 transition-colors shadow-sm"
                            >
                                <FileText size={18} className="mr-2" />
                                Select Excel or CSV File
                            </label>
                        </div>

                        <div className="flex justify-center gap-3 flex-wrap">
                            <Button variant="secondary" onClick={handleDownloadTemplate} className="font-bold border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100">
                                <Download size={16} className="mr-2 text-emerald-600" />
                                Download Excel Template (.xlsx)
                            </Button>
                            <Button variant="outline" onClick={handleDownloadCsvTemplate} className="text-slate-600 text-xs">
                                <Download size={14} className="mr-1.5" />
                                Download CSV (.csv)
                            </Button>
                        </div>

                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                            <h4 className="font-bold text-amber-800 flex items-center mb-2">
                                <AlertTriangle size={16} className="mr-2" />
                                CSV Format Requirements
                            </h4>
                            <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
                                <li><strong>Full Name</strong> - Required</li>
                                <li><strong>Unit Code / Unit Name / Sub Unit</strong> - Required</li>
                                <li>Phone Number, Date of Birth, Employee ID, Designation, Joining Date - Optional</li>
                            </ul>
                        </div>
                    </div>
                )}

                {/* Step 2: Preview */}
                {step === 'preview' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-gray-800">
                                Preview: {parsedData.length} employees to import
                            </h3>
                            <Button variant="secondary" size="sm" onClick={() => setStep('upload')}>
                                <X size={14} className="mr-1" /> Change File
                            </Button>
                        </div>

                        {validationErrors.length > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                <h4 className="font-bold text-red-800 flex items-center mb-2 text-sm">
                                    <AlertTriangle size={16} className="mr-2" />
                                    Validation Errors ({validationErrors.length})
                                </h4>
                                <div className="max-h-32 overflow-y-auto border border-red-100 rounded bg-white">
                                    <table className="w-full text-[11px]">
                                        <thead className="bg-red-50 text-red-800 sticky top-0">
                                            <tr>
                                                <th className="p-1.5 text-left border-b border-red-100">Row</th>
                                                <th className="p-1.5 text-left border-b border-red-100">Field</th>
                                                <th className="p-1.5 text-left border-b border-red-100">Error</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {validationErrors.map((err, i) => (
                                                <tr key={i} className="border-b border-red-50 last:border-0">
                                                    <td className="p-1.5 font-bold text-red-600">{(err as any).row}</td>
                                                    <td className="p-1.5 font-medium">{(err as any).field || '-'}</td>
                                                    <td className="p-1.5 text-red-700">{(err as any).error}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <p className="mt-2 text-[10px] text-red-500 italic">
                                    Please fix these errors in your CSV file before importing.
                                </p>
                            </div>
                        )}

                        {validationWarnings.length > 0 && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                <h4 className="font-bold text-amber-800 flex items-center mb-2">
                                    <AlertTriangle size={16} className="mr-2" />
                                    Warnings ({validationWarnings.length})
                                </h4>
                                <div className="max-h-32 overflow-y-auto border border-amber-100 rounded bg-white p-2">
                                    <ul className="text-sm text-amber-700 space-y-1">
                                        {validationWarnings.map((w, i) => (
                                            <li key={i} className="flex items-start gap-2">
                                                <span className="text-amber-400 mt-1">•</span>
                                                <span>{w}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}

                        {/* Data Preview Table */}
                        <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-100 sticky top-0">
                                    <tr>
                                        <th className="p-2 text-left">#</th>
                                        <th className="p-2 text-left">Name</th>
                                        <th className="p-2 text-left">Unit Code / Unit Name / Sub Unit</th>
                                        <th className="p-2 text-left">Employee ID</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {parsedData.slice(0, 10).map((row, i) => (
                                        <tr key={i} className="border-t border-gray-100">
                                            <td className="p-2 text-gray-400">{i + 1}</td>
                                            <td className="p-2 font-medium">{row.fullName}</td>
                                            <td className="p-2 text-gray-600">{row.location}</td>
                                            <td className="p-2 text-gray-600">{row.employeeId || '(auto)'}</td>
                                        </tr>
                                    ))}
                                    {parsedData.length > 10 && (
                                        <tr className="border-t border-gray-200 bg-gray-50">
                                            <td colSpan={4} className="p-2 text-center text-gray-500 italic">
                                                ... and {parsedData.length - 10} more rows
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Import Options */}
                        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                            <h4 className="font-bold text-gray-700">Import Options</h4>
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={importOptions.generateIds}
                                        onChange={e => setImportOptions(prev => ({ ...prev, generateIds: e.target.checked }))}
                                        className="rounded"
                                    />
                                    Auto-generate Employee IDs
                                </label>
                                {importOptions.generateIds && (
                                    <input
                                        type="text"
                                        value={importOptions.idPrefix}
                                        onChange={e => setImportOptions(prev => ({ ...prev, idPrefix: e.target.value }))}
                                        className="w-20 px-2 py-1 text-sm border border-gray-300 rounded"
                                        placeholder="Prefix"
                                    />
                                )}
                            </div>
                            <div className="pt-2 border-t border-gray-100 flex flex-col gap-2">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Activation Mode</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setImportOptions(prev => ({ ...prev, importMode: 'direct', defaultStatus: 'Approved' }))}
                                        className={`flex flex-col p-3 rounded-xl border-2 transition-all text-left ${importOptions.importMode === 'direct' ? 'border-blue-600 bg-blue-50' : 'border-gray-100 hover:border-gray-200 bg-white'}`}
                                    >
                                        <span className={`text-xs font-black uppercase mb-1 ${importOptions.importMode === 'direct' ? 'text-blue-700' : 'text-gray-400'}`}>Full Activation</span>
                                        <span className="text-[10px] text-gray-500 font-medium">Add directly to Master List as an active employee.</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setImportOptions(prev => ({ ...prev, importMode: 'pending_profile' }))}
                                        className={`flex flex-col p-3 rounded-xl border-2 transition-all text-left ${importOptions.importMode === 'pending_profile' ? 'border-amber-600 bg-amber-50' : 'border-gray-100 hover:border-gray-200 bg-white'}`}
                                    >
                                        <span className={`text-xs font-black uppercase mb-1 ${importOptions.importMode === 'pending_profile' ? 'text-amber-700' : 'text-gray-400'}`}>Pending Profile</span>
                                        <span className="text-[10px] text-gray-500 font-medium">Requires employee to complete details & admin approval.</span>
                                    </button>
                                </div>
                            </div>

                            {importOptions.importMode === 'direct' && (
                                <div className="flex items-center gap-4 pt-2">
                                    <label className="text-sm font-medium">Default Status:</label>
                                    <select
                                        value={importOptions.defaultStatus}
                                        onChange={e => setImportOptions(prev => ({ ...prev, defaultStatus: e.target.value as any }))}
                                        className="px-3 py-1 text-sm border border-gray-300 rounded"
                                    >
                                        <option value="Approved">Approved</option>
                                        <option value="Pending Review">Pending Review</option>
                                    </select>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="secondary" onClick={handleClose}>Cancel</Button>
                            <Button
                                variant="primary"
                                onClick={handleProceedToImport}
                                disabled={validationErrors.length > 0 || isCheckingDuplicates}
                                loading={isCheckingDuplicates}
                            >
                                <Upload size={16} className="mr-2" />
                                Import {parsedData.length} Employees
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step NEW: Duplicates Warning */}
                {step === 'duplicates' && (
                    <div className="space-y-4">
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start">
                            <AlertTriangle size={24} className="text-amber-600 mr-3 mt-1 shrink-0" />
                            <div>
                                <h3 className="font-bold text-amber-900 text-lg">Potential Duplicates Found</h3>
                                <p className="text-sm text-amber-800">
                                    {duplicateConflicts.length} records in your file match existing employees or pending submissions in the database.
                                </p>
                            </div>
                        </div>

                        <div className="max-h-60 overflow-y-auto border border-amber-100 rounded-lg bg-white">
                            <table className="w-full text-xs">
                                <thead className="bg-amber-50 text-amber-900 sticky top-0">
                                    <tr>
                                        <th className="p-2 text-left border-b border-amber-100">Row</th>
                                        <th className="p-2 text-left border-b border-amber-100">Importer Name</th>
                                        <th className="p-2 text-left border-b border-amber-100">Match Reason</th>
                                        <th className="p-2 text-left border-b border-amber-100">Existing ID</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {duplicateConflicts.map((c, i) => (
                                        <tr key={i} className="border-b border-amber-50 last:border-0">
                                            <td className="p-2 font-bold text-amber-700">{c.row}</td>
                                            <td className="p-2 font-medium">{c.fullName}</td>
                                            <td className="p-2">
                                                <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold uppercase text-[10px]">
                                                    {c.matchType === 'EmployeeID' ? 'ID MATCH' :
                                                        c.matchType === 'Phone' ? 'PHONE MATCH' : 'AADHAR MATCH'}
                                                </span>
                                            </td>
                                            <td className="p-2 text-gray-500 font-mono">{c.employeeId || c.existingRecordId.substring(0, 8)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                            <h4 className="font-bold text-gray-700">How should we handle these?</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <label
                                    className={`flex flex-col p-3 border-2 rounded-xl cursor-pointer transition-all ${importOptions.overwriteMode === 'skip' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                                    onClick={() => setImportOptions(prev => ({ ...prev, overwriteMode: 'skip' }))}
                                >
                                    <div className="flex items-center mb-1">
                                        <XCircle size={18} className="text-gray-400 mr-2" />
                                        <span className="font-bold text-gray-800">Skip Duplicates</span>
                                    </div>
                                    <p className="text-xs text-gray-500 pl-6">Only import new personnel. Existing records will remain untouched.</p>
                                </label>

                                <label
                                    className={`flex flex-col p-3 border-2 rounded-xl cursor-pointer transition-all ${importOptions.overwriteMode === 'overwrite' ? 'border-amber-600 bg-amber-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                                    onClick={() => setImportOptions(prev => ({ ...prev, overwriteMode: 'overwrite' }))}
                                >
                                    <div className="flex items-center mb-1">
                                        <AlertTriangle size={18} className="text-amber-500 mr-2" />
                                        <span className="font-bold text-amber-900">Overwrite Existing</span>
                                    </div>
                                    <p className="text-xs text-amber-700/70 pl-6">Update existing database records with the information from your CSV.</p>
                                </label>
                            </div>
                        </div>

                        <div className="flex justify-between items-center pt-4">
                            <Button variant="secondary" onClick={() => setStep('preview')}>
                                Back to Preview
                            </Button>
                            <div className="flex gap-2">
                                <Button variant="secondary" onClick={handleClose}>Cancel Import</Button>
                                <Button
                                    variant={importOptions.overwriteMode === 'overwrite' ? 'danger' : 'primary'}
                                    onClick={handleStartImport}
                                >
                                    {importOptions.overwriteMode === 'overwrite' ? 'Overwrite & Import' : 'Skip & Import'}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 3: Importing */}
                {step === 'importing' && (
                    <div className="text-center py-12">
                        <Loader2 size={48} className="mx-auto text-blue-600 animate-spin mb-4" />
                        <h3 className="text-lg font-bold text-gray-700 mb-2">Importing Employees...</h3>
                        <p className="text-sm text-gray-500">
                            Processing {parsedData.length} records. This may take a moment.
                        </p>
                    </div>
                )}

                {/* Step 4: Complete */}
                {step === 'complete' && importResult && (
                    <div className="space-y-4">
                        <div className={`text-center py-8 rounded-xl ${importResult.success ? 'bg-green-50' : 'bg-amber-50'}`}>
                            {importResult.success ? (
                                <CheckCircle size={48} className="mx-auto text-green-600 mb-4" />
                            ) : (
                                <AlertTriangle size={48} className="mx-auto text-amber-600 mb-4" />
                            )}
                            <h3 className="text-xl font-bold text-gray-800 mb-2">
                                Import {importResult.success ? 'Complete' : 'Completed with Errors'}
                            </h3>
                            <div className="flex justify-center gap-8 text-sm">
                                <div>
                                    <span className="text-green-600 font-bold text-2xl">{importResult.successfulImports}</span>
                                    <p className="text-gray-500">Successful</p>
                                </div>
                                <div>
                                    <span className="text-red-600 font-bold text-2xl">{importResult.failedImports}</span>
                                    <p className="text-gray-500">Failed</p>
                                </div>
                            </div>
                        </div>

                        {importResult.errors.length > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                <h4 className="font-bold text-red-800 mb-2 text-sm flex items-center">
                                    <XCircle size={16} className="mr-2" />
                                    Failed Records ({importResult.errors.length})
                                </h4>
                                <div className="max-h-48 overflow-y-auto border border-red-100 rounded bg-white">
                                    <table className="w-full text-xs">
                                        <thead className="bg-red-50 text-red-800 sticky top-0">
                                            <tr>
                                                <th className="p-2 text-left border-b border-red-100">Row</th>
                                                <th className="p-2 text-left border-b border-red-100">Name/Field</th>
                                                <th className="p-2 text-left border-b border-red-100">Reason</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {importResult.errors.map((err, i) => (
                                                <tr key={i} className="border-b border-red-50 last:border-0">
                                                    <td className="p-2 font-bold text-red-600">{err.row}</td>
                                                    <td className="p-2 font-medium">
                                                        {(err as any).field ? <span>{(err as any).field} <span className="text-gray-400 font-normal">({(err as any).value})</span></span> : (err.data?.fullName || 'Unknown')}
                                                    </td>
                                                    <td className="p-2 text-red-700">{err.error}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end pt-4">
                            <Button variant="primary" onClick={handleClose}>
                                Done
                            </Button>
                        </div>
                    </div>
                )}

                {/* Validation Settings content continues below */}

                {showSettings && (
                    <div className="absolute inset-0 z-50 bg-white p-6 overflow-y-auto rounded-lg shadow-2xl border border-gray-100">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <Settings className="text-blue-600" size={24} />
                                <h3 className="text-xl font-bold text-gray-800">Validation Settings</h3>
                            </div>
                            <Button variant="secondary" size="sm" onClick={() => setShowSettings(false)}>
                                <X size={18} />
                            </Button>
                        </div>

                        <p className="text-sm text-gray-500 mb-6 bg-blue-50 p-3 rounded-lg border border-blue-100">
                            Choose how strictly we validate each field during import.
                            <strong>Errors</strong> block import, <strong>Warnings</strong> allow it, and
                            <strong>Ignore</strong> skips validation.
                        </p>

                        <div className="space-y-6">
                            {formSections.map((section, idx) => (
                                <div key={idx} className="space-y-3">
                                    <h4 className="font-bold text-gray-700 text-sm uppercase tracking-wider border-b pb-1">
                                        {section.title}
                                    </h4>
                                    <div className="grid grid-cols-1 gap-2">
                                        {(section.fields || []).filter(f => ![FieldType.HEADER, FieldType.INFO_TEXT].includes(f.type)).map((field) => {
                                            const label = field.label || 'No Label';
                                            const currentSeverity = validationSettings[label.toLowerCase().trim()] ||
                                                (['full name', 'employee id', 'location', 'unit code'].includes(label.toLowerCase()) ? 'error' : 'warning');

                                            return (
                                                <div key={field.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-100 transition-all">
                                                    <span className="text-sm font-medium text-gray-700">{label}</span>
                                                    <div className="flex bg-gray-100 p-1 rounded-lg">
                                                        {(['error', 'warning', 'none'] as ValidationSeverity[]).map((severity) => (
                                                            <button
                                                                key={severity}
                                                                onClick={() => {
                                                                    const newSettings = { ...validationSettings, [label.toLowerCase().trim()]: severity };
                                                                    setValidationSettings(newSettings);
                                                                    if (parsedData.length > 0) runValidation(parsedData, newSettings);
                                                                }}
                                                                className={`px-3 py-1 text-[10px] font-bold uppercase rounded ${currentSeverity === severity
                                                                    ? severity === 'error' ? 'bg-red-600 text-white' :
                                                                        severity === 'warning' ? 'bg-amber-500 text-white' : 'bg-gray-600 text-white'
                                                                    : 'text-gray-500 hover:text-gray-700'
                                                                    }`}
                                                            >
                                                                {severity === 'none' ? 'Ignore' : severity}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8 flex justify-center">
                            <Button variant="primary" onClick={() => setShowSettings(false)} className="w-full">
                                Close & Apply Settings
                            </Button>
                        </div>
                    </div>
                )}

                {/* Global Settings Trigger - Inside relative container now */}
                {!showSettings && step !== 'complete' && step !== 'importing' && (
                    <button
                        onClick={() => setShowSettings(true)}
                        className="absolute bottom-2 left-0 p-2 bg-white border border-gray-200 rounded-full shadow-lg hover:shadow-xl text-gray-600 hover:text-blue-600 transition-all flex items-center gap-2 group"
                    >
                        <Settings size={20} className="group-hover:rotate-90 transition-transform duration-500" />
                        <span className="text-xs font-bold pr-2 max-w-0 overflow-hidden group-hover:max-w-[100px] transition-all whitespace-nowrap">Settings</span>
                    </button>
                )}
            </div>
        </Modal>
    );
};

export default BulkImportModal;


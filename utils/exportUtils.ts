import { SubmittedFormData, FormSection } from '../types';
import { getApplicantName } from './formDataHelper';
import * as XLSX from 'xlsx';

export const exportEmployeesToCSV = (
    employees: SubmittedFormData[],
    sections: FormSection[],
    visibleFieldIds: string[] | null,
    isSuperAdmin: boolean,
    canViewSensitive: boolean
) => {
    if (!employees || employees.length === 0) {
        alert("No data to export.");
        return;
    }

    const isVisible = (fieldId: string) => {
        if (isSuperAdmin) return true;
        return visibleFieldIds?.includes(fieldId);
    };

    const isSensitiveField = (label: string) => {
        const sensitiveKeywords = ['mobile', 'phone', 'email', 'bank', 'account', 'aadhaar', 'pan', 'ifsc', 'salary', 'ctc', 'amount'];
        return sensitiveKeywords.some(k => label.toLowerCase().includes(k));
    };

    // 1. Prepare Headers
    const headers: string[] = [];
    const dynamicFields: { id: string; label: string }[] = [];

    // Base Fields mapping
    if (isVisible('employeeId')) headers.push('Employee ID');
    if (isVisible('name')) headers.push('Full Name');
    if (isVisible('status')) headers.push('Status');
    headers.push('Site/Location'); // Deployment is always visible
    if (isVisible('joiningDate')) headers.push('Joining Date');

    // Dynamic headers from sections
    sections.forEach(section => {
        section.fields.forEach(field => {
            if (!['employeeId', 'siteId'].includes(field.id) && isVisible(field.id)) {
                dynamicFields.push({ id: field.id, label: field.label });
                headers.push(field.label);
            }
        });
    });

    // 2. Prepare Raw Rows for Excel (preserves raw strings with leading zeros)
    const rawRows: string[][] = employees.map(emp => {
        const data = emp.data || {};
        const name = emp.applicantName || getApplicantName(data, sections) || 'N/A';
        const status = (emp as any).isActive ? 'Active' : 'Inactive';
        const site = (emp as any).siteName || 'N/A';
        const joinDate = (emp as any).joiningDate ? new Date((emp as any).joiningDate).toLocaleDateString() : 'N/A';

        const row: string[] = [];

        if (isVisible('employeeId')) row.push(String(emp.employeeId || 'N/A'));
        if (isVisible('name')) row.push(String(name));
        if (isVisible('status')) row.push(status);
        row.push(String(site));
        if (isVisible('joiningDate')) row.push(joinDate);

        // Add dynamic field values
        dynamicFields.forEach(field => {
            let val = data[field.id];

            // SECURITY: Mask sensitive data on export if permission is missing
            if (isSensitiveField(field.label) && !canViewSensitive) {
                val = '••••••••';
            } else if (val === undefined || val === null) {
                val = '';
            }

            // Keep raw string format to preserve leading zeros (e.g., bank accounts "00123...")
            row.push(String(val));
        });

        return row;
    });

    // 3. Generate Native Excel Workbook (.xlsx)
    // Force every cell to be text type (t: 's') and format '@' (Text) so Microsoft Excel
    // NEVER converts account numbers or IDs starting with '0' into numbers or strips leading zeros.
    const aoaData: string[][] = [headers, ...rawRows];
    const ws = XLSX.utils.aoa_to_sheet(aoaData);

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
    XLSX.utils.book_append_sheet(wb, ws, 'Employees');

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `employee_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

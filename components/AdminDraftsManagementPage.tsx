
import React, { useState, useMemo } from 'react';
import { DraftSubmission, Role, SubmittedFormData } from '../types';
import Button from './common/Button';
import Modal from './common/Modal';
import { Trash2, Search, FileClock, Info, LayoutDashboard, CheckCircle2 } from 'lucide-react';
import { deleteDraftSubmission, purgeAbandonedDrafts } from '../src/services/employeeService';
import { logSystemAction } from '../src/services/auditService';
import Input from './common/Input';

interface AdminDraftsManagementPageProps {
    drafts: DraftSubmission[];
    isSuperAdmin: boolean;
    userRole?: Role;
    submittedForms?: SubmittedFormData[];
}

const AdminDraftsManagementPage: React.FC<AdminDraftsManagementPageProps> = ({
    drafts, isSuperAdmin, userRole, submittedForms = []
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [isPurging, setIsPurging] = useState(false);
    const [isCleaningStale, setIsCleaningStale] = useState(false);

    // Build lookup set of candidates who already submitted (pending review or approved)
    const submittedIdentifierSet = useMemo(() => {
        const set = new Set<string>();
        (submittedForms || []).forEach(s => {
            if (s.id) set.add(s.id.toLowerCase());
            if (s.employeeId) set.add(s.employeeId.toLowerCase());
            if ((s as any).ownerUid) set.add(String((s as any).ownerUid).toLowerCase());
            if ((s as any).linkedUid) set.add(String((s as any).linkedUid).toLowerCase());
            if ((s as any).uid) set.add(String((s as any).uid).toLowerCase());
        });
        return set;
    }, [submittedForms]);

    // Partition drafts: truly unsubmitted drafts vs. stale drafts belonging to already-submitted personnel
    const { unsubmittedDrafts, staleSubmittedDrafts } = useMemo(() => {
        const unsubmitted: DraftSubmission[] = [];
        const stale: DraftSubmission[] = [];

        drafts.forEach(d => {
            const draftIdLower = (d.id || '').toLowerCase();
            const ownerLower = (d.ownerUid || '').toLowerCase();
            const isAlreadySubmitted = submittedIdentifierSet.has(draftIdLower) || (ownerLower && submittedIdentifierSet.has(ownerLower));
            if (isAlreadySubmitted) {
                stale.push(d);
            } else {
                unsubmitted.push(d);
            }
        });

        return { unsubmittedDrafts: unsubmitted, staleSubmittedDrafts: stale };
    }, [drafts, submittedIdentifierSet]);

    const handleCleanStaleDrafts = async () => {
        if (!window.confirm(`Clean up ${staleSubmittedDrafts.length} stale draft(s)? These candidates have already submitted and are in the review pipeline or active roster.`)) return;

        setIsCleaningStale(true);
        try {
            let count = 0;
            for (const d of staleSubmittedDrafts) {
                await deleteDraftSubmission(d.id);
                count++;
            }
            await logSystemAction('DELETE', 'SUBMISSION', `Purged ${count} stale drafts of already-submitted personnel`);
            alert(`Cleaned up ${count} stale draft(s)!`);
        } catch (err: any) {
            console.error("Clean stale drafts failed:", err);
            alert(`Clean failed: ${err.message || err}`);
        } finally {
            setIsCleaningStale(false);
        }
    };

    const handlePurgeOldDrafts = async () => {
        if (!window.confirm("PURGE ABANDONED DRAFTS: Are you sure you want to permanently delete all drafts inactive for more than 30 days? This will erase their database records and storage files.")) return;

        setIsPurging(true);
        try {
            const res = await purgeAbandonedDrafts(30);
            await logSystemAction('DELETE', 'SUBMISSION', `Purged ${res.deletedCount} abandoned drafts older than 30 days`);
            alert(`Purge complete! Deleted ${res.deletedCount} abandoned draft(s) older than 30 days.`);
        } catch (error: any) {
            console.error("Purge failed:", error);
            alert(`Purge failed: ${error.message || error}`);
        } finally {
            setIsPurging(false);
        }
    };

    const getDraftName = (draft: DraftSubmission) => {
        // Attempt to find a name in the draft data
        const data = draft.data || {};
        const possibleNameFields = ['firstName', 'lastName', 'name', 'applicantName', 'full_name'];

        // Check nested data if it exists (some drafts might have a 'data' key inside 'data')
        const searchData = data.data || data;

        for (const field of possibleNameFields) {
            if (searchData[field]) return String(searchData[field]);
        }

        // Check for common field IDs like 'field_1' etc if we had a mapping, 
        // but for now, we'll just search for values that look like names or use the ID.
        return 'Incomplete Applicant';
    };

    const filteredDrafts = unsubmittedDrafts.filter(draft => {
        const name = getDraftName(draft).toLowerCase();
        const id = draft.id.toLowerCase();
        return name.includes(searchTerm.toLowerCase()) || id.includes(searchTerm.toLowerCase());
    }).sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());

    const handleDelete = async (id: string) => {
        if (!window.confirm("Are you sure you want to permanently delete this draft? This cannot be undone.")) return;

        setIsDeleting(id);
        try {
            await deleteDraftSubmission(id);
            await logSystemAction('DELETE', 'SUBMISSION', `Permanently deleted onboarding draft ${id}`);
        } catch (error) {
            console.error("Failed to delete draft:", error);
            alert("Error deleting draft. Please try again.");
        } finally {
            setIsDeleting(null);
        }
    };

    const formatDate = (dateStr: string) => {
        try {
            return new Date(dateStr).toLocaleString();
        } catch (e) {
            return 'Unknown';
        }
    };

    return (
        <div className="p-0">
            <div className="mb-8 p-6 bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="flex justify-between items-center flex-wrap gap-4">
                    <div>
                        <h3 className="text-xl font-semibold text-gray-700 mb-2 flex items-center">
                            <FileClock className="mr-2 text-amber-500" /> Onboarding Drafts
                        </h3>
                        <p className="text-sm text-gray-500">
                            These are saved forms from applicants who haven't submitted yet.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2 rounded-lg text-sm flex items-center">
                            <Info size={16} className="mr-2" />
                            <span>Drafts are hidden from main review pipeline until submitted.</span>
                        </div>
                        {isSuperAdmin && (
                            <Button
                                variant="outline"
                                className="border-red-300 text-red-600 hover:bg-red-50 font-medium text-xs px-3 py-2 flex items-center"
                                onClick={handlePurgeOldDrafts}
                                disabled={isPurging}
                            >
                                <Trash2 size={14} className="mr-1.5" />
                                {isPurging ? 'Purging...' : 'Purge Old Drafts (>30 Days)'}
                            </Button>
                        )}
                    </div>
                </div>

                <div className="mt-6 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                        className="pl-10 h-11 border-gray-200 focus:border-amber-400 focus:ring-amber-400"
                        placeholder="Search by Applicant Name or Recovery ID..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                {staleSubmittedDrafts.length > 0 && isSuperAdmin && (
                    <div className="mt-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                            <span>
                                <strong>{staleSubmittedDrafts.length} legacy draft(s)</strong> belong to candidates who already submitted or are active employees. They are hidden from this view.
                            </span>
                        </div>
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={handleCleanStaleDrafts}
                            disabled={isCleaningStale}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                        >
                            {isCleaningStale ? 'Cleaning...' : `Clean Up ${staleSubmittedDrafts.length} Stale Draft(s)`}
                        </Button>
                    </div>
                )}
            </div>

            <div className="bg-white shadow-md rounded-xl overflow-hidden border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Applicant / Recovery ID</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Last Saved</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Progress</th>
                            <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredDrafts.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center">
                                    <div className="flex flex-col items-center justify-center text-gray-400">
                                        <LayoutDashboard size={48} className="mb-2 opacity-20" />
                                        <p className="italic text-lg">No matching drafts found.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            filteredDrafts.map(draft => (
                                <tr key={draft.id} className="hover:bg-amber-50/30 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-gray-900">{getDraftName(draft)}</span>
                                            <span className="text-xs font-mono text-gray-400">{draft.id}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                        {formatDate(draft.lastUpdated)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-700 border border-amber-200">
                                            Step {draft.sectionIndex + 1}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <Button
                                            variant="danger"
                                            size="sm"
                                            onClick={() => handleDelete(draft.id)}
                                            disabled={isDeleting === draft.id}
                                            className="bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border-red-100"
                                        >
                                            {isDeleting === draft.id ? 'Deleting...' : <><Trash2 size={16} className="mr-1" /> Delete</>}
                                        </Button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminDraftsManagementPage;


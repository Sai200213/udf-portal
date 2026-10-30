import React, { useState, useEffect, useMemo } from 'react';
import { 
    AlertCircle, 
    CheckCircle, 
    Clock, 
    XCircle, 
    Search, 
    Filter, 
    MessageSquare, 
    Gift, 
    User, 
    Trash2, 
    Eye, 
    Check, 
    X, 
    Loader2,
    Calendar,
    Award,
    Mail,
    Phone,
    Inbox,
    Briefcase,
    ExternalLink
} from 'lucide-react';
import Button from './common/Button';
import Modal from './common/Modal';
import Textarea from './common/Textarea';
import Select from './common/Select';
import { 
    ComplaintItem, 
    RewardRedemptionItem, 
    ContactInquiryItem,
    subscribeToComplaints, 
    updateComplaintStatus, 
    deleteComplaint,
    subscribeToRewardRedemptions,
    updateRewardRedemptionStatus,
    subscribeToContactInquiries,
    updateContactInquiryStatus,
    deleteContactInquiry
} from '../src/services/engagementService';
import { User as AuthUser, Role, Permission } from '../types';

interface AdminGrievancesPageProps {
    authUser: AuthUser | null;
    isSuperAdmin: boolean;
    userRole?: Role;
    onNotify?: (msg: string, type: 'success' | 'error' | 'info') => void;
    allowedSiteIds?: string[];
}

const AdminGrievancesPage: React.FC<AdminGrievancesPageProps> = ({
    authUser,
    isSuperAdmin,
    userRole,
    onNotify,
    allowedSiteIds
}) => {
    // Permission checks
    const hasPermission = (p: Permission) => {
        if (isSuperAdmin) return true;
        if (userRole?.isDisabled === true) return false;
        const overrides = (authUser as any)?.permissionOverrides;
        if (overrides && overrides[p] !== undefined) {
            return Boolean(overrides[p]);
        }
        return Boolean(userRole?.permissions?.includes(p));
    };

    const canViewGrievances = isSuperAdmin || hasPermission(Permission.GRIEVANCES_VIEW);
    const hasGrievanceScopeAll = isSuperAdmin || hasPermission(Permission.GRIEVANCES_VIEW_SCOPE_ALL);
    const canResolveGrievances = isSuperAdmin || hasPermission(Permission.GRIEVANCES_RESOLVE);
    const canDeleteGrievances = isSuperAdmin || hasPermission(Permission.GRIEVANCES_DELETE);
    const canViewRewards = isSuperAdmin || hasPermission(Permission.REWARDS_VIEW) || hasPermission(Permission.REWARDS_MANAGE);
    const canManageRewards = isSuperAdmin || hasPermission(Permission.REWARDS_MANAGE);
    const canViewInquiries = isSuperAdmin || hasPermission(Permission.MANAGE_SYSTEM) || hasPermission(Permission.GRIEVANCES_VIEW);

    const [activeTab, setActiveTab] = useState<'grievances' | 'rewards' | 'inquiries'>(() => {
        if (canViewGrievances) return 'grievances';
        if (canViewRewards) return 'rewards';
        if (canViewInquiries) return 'inquiries';
        return 'grievances';
    });

    // Grievances State
    const [complaints, setComplaints] = useState<ComplaintItem[]>([]);
    const [loadingComplaints, setLoadingComplaints] = useState(true);
    const [complaintSearch, setComplaintSearch] = useState('');
    const [complaintFilterStatus, setComplaintFilterStatus] = useState<string>('all');
    const [selectedComplaint, setSelectedComplaint] = useState<ComplaintItem | null>(null);
    const [resolutionNotes, setResolutionNotes] = useState('');
    const [targetStatus, setTargetStatus] = useState<'pending' | 'in-review' | 'resolved' | 'dismissed'>('in-review');
    const [isSavingComplaint, setIsSavingComplaint] = useState(false);

    // Rewards State
    const [redemptions, setRedemptions] = useState<RewardRedemptionItem[]>([]);
    const [loadingRewards, setLoadingRewards] = useState(true);
    const [rewardSearch, setRewardSearch] = useState('');
    const [rewardFilterStatus, setRewardFilterStatus] = useState<string>('all');
    const [selectedReward, setSelectedReward] = useState<RewardRedemptionItem | null>(null);
    const [fulfillmentNotes, setFulfillmentNotes] = useState('');
    const [targetRewardStatus, setTargetRewardStatus] = useState<'pending' | 'fulfilled' | 'rejected'>('fulfilled');
    const [isSavingReward, setIsSavingReward] = useState(false);

    // Business Contact Inquiries State
    const [inquiries, setInquiries] = useState<ContactInquiryItem[]>([]);
    const [loadingInquiries, setLoadingInquiries] = useState(true);
    const [inquirySearch, setInquirySearch] = useState('');
    const [inquiryFilterStatus, setInquiryFilterStatus] = useState<string>('all');
    const [selectedInquiry, setSelectedInquiry] = useState<ContactInquiryItem | null>(null);
    const [inquiryNotes, setInquiryNotes] = useState('');
    const [targetInquiryStatus, setTargetInquiryStatus] = useState<'new' | 'contacted' | 'closed'>('contacted');
    const [isSavingInquiry, setIsSavingInquiry] = useState(false);

    // Realtime Subscriptions
    useEffect(() => {
        setLoadingComplaints(true);
        const unsubscribeComplaints = subscribeToComplaints((items) => {
            setComplaints(items);
            setLoadingComplaints(false);
        });

        setLoadingRewards(true);
        const unsubscribeRewards = subscribeToRewardRedemptions((items) => {
            setRedemptions(items);
            setLoadingRewards(false);
        });

        setLoadingInquiries(true);
        const unsubscribeInquiries = subscribeToContactInquiries((items) => {
            setInquiries(items);
            setLoadingInquiries(false);
        });

        return () => {
            unsubscribeComplaints();
            unsubscribeRewards();
            unsubscribeInquiries();
        };
    }, []);

    // Helper: format timestamp
    const formatTime = (ts: any) => {
        if (!ts) return 'Just now';
        const date = ts?.toDate ? ts.toDate() : new Date(ts);
        if (isNaN(date.getTime())) return 'N/A';
        return date.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Filtered Grievances
    const filteredComplaints = useMemo(() => {
        if (!canViewGrievances) return [];
        return complaints.filter(c => {
            if (!hasGrievanceScopeAll && allowedSiteIds && allowedSiteIds.length > 0) {
                if (c.siteId) {
                    if (!allowedSiteIds.includes(c.siteId)) return false;
                } else {
                    // Protect confidentiality: complaints with missing site are hidden from site-scoped admins
                    return false;
                }
            }
            const matchesSearch = 
                (c.userName || '').toLowerCase().includes(complaintSearch.toLowerCase()) ||
                (c.userId || '').toLowerCase().includes(complaintSearch.toLowerCase()) ||
                (c.text || '').toLowerCase().includes(complaintSearch.toLowerCase());
            const matchesStatus = complaintFilterStatus === 'all' || c.status === complaintFilterStatus;
            return matchesSearch && matchesStatus;
        });
    }, [complaints, complaintSearch, complaintFilterStatus, canViewGrievances, hasGrievanceScopeAll, allowedSiteIds]);

    // Filtered Rewards
    const filteredRewards = useMemo(() => {
        if (!canViewRewards) return [];
        return redemptions.filter(r => {
            const matchesSearch = 
                (r.userName || '').toLowerCase().includes(rewardSearch.toLowerCase()) ||
                (r.userId || '').toLowerCase().includes(rewardSearch.toLowerCase()) ||
                (r.rewardTitle || '').toLowerCase().includes(rewardSearch.toLowerCase());
            const matchesStatus = rewardFilterStatus === 'all' || r.status === rewardFilterStatus;
            return matchesSearch && matchesStatus;
        });
    }, [redemptions, rewardSearch, rewardFilterStatus, canViewRewards]);

    // Grievance KPI Stats
    const grievanceStats = useMemo(() => {
        return {
            total: complaints.length,
            pending: complaints.filter(c => c.status === 'pending').length,
            inReview: complaints.filter(c => c.status === 'in-review').length,
            resolved: complaints.filter(c => c.status === 'resolved').length
        };
    }, [complaints]);

    // Reward KPI Stats
    const rewardStats = useMemo(() => {
        return {
            total: redemptions.length,
            pending: redemptions.filter(r => r.status === 'pending').length,
            fulfilled: redemptions.filter(r => r.status === 'fulfilled').length,
            totalPoints: redemptions.reduce((acc, curr) => acc + (curr.pointsSpent || 0), 0)
        };
    }, [redemptions]);

    // Filtered Inquiries
    const filteredInquiries = useMemo(() => {
        return inquiries.filter(item => {
            const matchesSearch = 
                (item.name || '').toLowerCase().includes(inquirySearch.toLowerCase()) ||
                (item.email || '').toLowerCase().includes(inquirySearch.toLowerCase()) ||
                (item.phone || '').toLowerCase().includes(inquirySearch.toLowerCase()) ||
                (item.subject || '').toLowerCase().includes(inquirySearch.toLowerCase()) ||
                (item.message || '').toLowerCase().includes(inquirySearch.toLowerCase());
            const matchesStatus = inquiryFilterStatus === 'all' || (item.status || 'new') === inquiryFilterStatus;
            return matchesSearch && matchesStatus;
        });
    }, [inquiries, inquirySearch, inquiryFilterStatus]);

    // Inquiry KPI Stats
    const inquiryStats = useMemo(() => {
        return {
            total: inquiries.length,
            new: inquiries.filter(i => (i.status || 'new') === 'new').length,
            contacted: inquiries.filter(i => i.status === 'contacted').length,
            closed: inquiries.filter(i => i.status === 'closed').length
        };
    }, [inquiries]);

    // Open inquiry modal
    const handleOpenInquiryModal = (inq: ContactInquiryItem) => {
        setSelectedInquiry(inq);
        setTargetInquiryStatus(inq.status || 'contacted');
        setInquiryNotes(inq.notes || '');
    };

    // Save inquiry update
    const handleSaveInquiry = async () => {
        if (!selectedInquiry) return;
        setIsSavingInquiry(true);
        try {
            const adminName = authUser?.displayName || authUser?.name || 'Admin';
            const ok = await updateContactInquiryStatus(
                selectedInquiry.id,
                targetInquiryStatus,
                inquiryNotes,
                adminName
            );
            if (ok) {
                if (onNotify) onNotify(`Inquiry updated to ${targetInquiryStatus}`, 'success');
                setSelectedInquiry(null);
            } else {
                if (onNotify) onNotify('Failed to update inquiry status', 'error');
            }
        } catch (err: any) {
            console.error('Error updating inquiry:', err);
            if (onNotify) onNotify(err?.message || 'Update failed', 'error');
        } finally {
            setIsSavingInquiry(false);
        }
    };

    // Delete inquiry
    const handleDeleteInquiry = async (id: string, name: string) => {
        if (!window.confirm(`Are you sure you want to delete inquiry from "${name}"? This action cannot be undone.`)) return;
        try {
            const ok = await deleteContactInquiry(id);
            if (ok) {
                if (onNotify) onNotify('Inquiry deleted successfully', 'info');
                if (selectedInquiry?.id === id) setSelectedInquiry(null);
            } else {
                if (onNotify) onNotify('Failed to delete inquiry', 'error');
            }
        } catch (err: any) {
            console.error('Error deleting inquiry:', err);
            if (onNotify) onNotify(err?.message || 'Delete failed', 'error');
        }
    };

    // Open complaint review modal
    const handleOpenComplaintModal = (complaint: ComplaintItem) => {
        setSelectedComplaint(complaint);
        setTargetStatus(complaint.status || 'in-review');
        setResolutionNotes(complaint.resolutionNotes || '');
    };

    // Save complaint status update
    const handleSaveComplaint = async () => {
        if (!selectedComplaint) return;
        setIsSavingComplaint(true);
        try {
            const adminName = authUser?.displayName || authUser?.name || 'HR Admin';
            const ok = await updateComplaintStatus(
                selectedComplaint.id,
                targetStatus,
                adminName,
                resolutionNotes
            );
            if (ok) {
                if (onNotify) onNotify(`Grievance updated to ${targetStatus}`, 'success');
                setSelectedComplaint(null);
            } else {
                if (onNotify) onNotify('Failed to update grievance status', 'error');
            }
        } catch (err: any) {
            console.error('Error updating complaint:', err);
            if (onNotify) onNotify(err?.message || 'Update failed', 'error');
        } finally {
            setIsSavingComplaint(false);
        }
    };

    // Delete complaint
    const handleDeleteComplaint = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this grievance record? This action cannot be undone.')) return;
        try {
            const ok = await deleteComplaint(id);
            if (ok) {
                if (onNotify) onNotify('Grievance deleted', 'info');
            } else {
                if (onNotify) onNotify('Failed to delete grievance', 'error');
            }
        } catch (err) {
            console.error('Error deleting complaint:', err);
        }
    };

    // Open reward fulfillment modal
    const handleOpenRewardModal = (reward: RewardRedemptionItem) => {
        setSelectedReward(reward);
        setTargetRewardStatus(reward.status || 'fulfilled');
        setFulfillmentNotes(reward.fulfillmentNotes || '');
    };

    // Save reward fulfillment
    const handleSaveReward = async () => {
        if (!selectedReward) return;
        setIsSavingReward(true);
        try {
            const adminName = authUser?.displayName || authUser?.name || 'HR Admin';
            const ok = await updateRewardRedemptionStatus(
                selectedReward.id,
                targetRewardStatus,
                adminName,
                fulfillmentNotes
            );
            if (ok) {
                if (onNotify) onNotify(`Reward redemption updated to ${targetRewardStatus}`, 'success');
                setSelectedReward(null);
            } else {
                if (onNotify) onNotify('Failed to update reward status', 'error');
            }
        } catch (err: any) {
            console.error('Error updating reward:', err);
            if (onNotify) onNotify(err?.message || 'Update failed', 'error');
        } finally {
            setIsSavingReward(false);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="border-b border-gray-200 pb-5 space-y-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <MessageSquare className="h-7 w-7 text-indigo-600" />
                        Grievances, Rewards & Business Inquiries
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Review employee grievances, fulfill rewards, and track inbound business leads and client contact requests.
                    </p>
                </div>

                {/* Sub-Tabs Bar: Full-width responsive pills, always visible with zero horizontal scroll */}
                <div className="flex flex-wrap items-center gap-2 bg-gray-100 p-1.5 rounded-xl border border-gray-200 w-full sm:w-auto">
                    {canViewGrievances && (
                        <button
                            type="button"
                            onClick={() => setActiveTab('grievances')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                                activeTab === 'grievances'
                                    ? 'bg-white text-indigo-700 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <AlertCircle className="h-4 w-4" />
                            Grievances & Complaints
                            {grievanceStats.pending > 0 && (
                                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                                    {grievanceStats.pending}
                                </span>
                            )}
                        </button>
                    )}
                    {canViewRewards && (
                        <button
                            type="button"
                            onClick={() => setActiveTab('rewards')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                                activeTab === 'rewards'
                                    ? 'bg-white text-indigo-700 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <Gift className="h-4 w-4" />
                            Reward Redemptions
                            {rewardStats.pending > 0 && (
                                <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                                    {rewardStats.pending}
                                </span>
                            )}
                        </button>
                    )}
                    {canViewInquiries && (
                        <button
                            type="button"
                            onClick={() => setActiveTab('inquiries')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                                activeTab === 'inquiries'
                                    ? 'bg-white text-indigo-700 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <Mail className="h-4 w-4" />
                            Business Contact Inquiries
                            {inquiryStats.new > 0 ? (
                                <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                                    {inquiryStats.new} New
                                </span>
                            ) : inquiries.length > 0 ? (
                                <span className="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded-full font-bold">
                                    {inquiries.length}
                                </span>
                            ) : null}
                        </button>
                    )}
                </div>
            </div>

            {/* TAB 1: GRIEVANCES */}
            {activeTab === 'grievances' && (
                <div className="space-y-6">
                    {/* KPI Stat Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Complaints</p>
                            <p className="text-2xl font-black text-gray-900 mt-2">{grievanceStats.total}</p>
                        </div>
                        <div className="bg-white p-5 rounded-xl border border-red-200 shadow-sm bg-red-50/20">
                            <p className="text-xs font-bold text-red-500 uppercase tracking-wider flex items-center gap-1.5">
                                <Clock className="h-4 w-4" /> Action Required (Pending)
                            </p>
                            <p className="text-2xl font-black text-red-600 mt-2">{grievanceStats.pending}</p>
                        </div>
                        <div className="bg-white p-5 rounded-xl border border-blue-200 shadow-sm bg-blue-50/20">
                            <p className="text-xs font-bold text-blue-500 uppercase tracking-wider flex items-center gap-1.5">
                                <Eye className="h-4 w-4" /> Under Investigation
                            </p>
                            <p className="text-2xl font-black text-blue-600 mt-2">{grievanceStats.inReview}</p>
                        </div>
                        <div className="bg-white p-5 rounded-xl border border-green-200 shadow-sm bg-green-50/20">
                            <p className="text-xs font-bold text-green-600 uppercase tracking-wider flex items-center gap-1.5">
                                <CheckCircle className="h-4 w-4" /> Resolved & Closed
                            </p>
                            <p className="text-2xl font-black text-green-700 mt-2">{grievanceStats.resolved}</p>
                        </div>
                    </div>

                    {/* Filter and Search Bar */}
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search employee, ID, keyword..."
                                value={complaintSearch}
                                onChange={(e) => setComplaintSearch(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <Filter className="h-4 w-4 text-gray-400" />
                            <select
                                value={complaintFilterStatus}
                                onChange={(e) => setComplaintFilterStatus(e.target.value)}
                                className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="all">All Statuses</option>
                                <option value="pending">Pending Only</option>
                                <option value="in-review">Under Review Only</option>
                                <option value="resolved">Resolved Only</option>
                                <option value="dismissed">Dismissed Only</option>
                            </select>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        {loadingComplaints ? (
                            <div className="p-12 text-center text-gray-500 flex flex-col items-center justify-center gap-3">
                                <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
                                <p className="text-sm font-medium">Loading grievance tickets...</p>
                            </div>
                        ) : filteredComplaints.length === 0 ? (
                            <div className="p-12 text-center text-gray-500">
                                <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-2 opacity-80" />
                                <p className="text-base font-bold text-gray-800">No Grievances Found</p>
                                <p className="text-sm text-gray-500 mt-1">There are no employee complaint tickets matching your search filters.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-sm">
                                    <thead>
                                        <tr className="bg-gray-50/80 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                            <th className="py-3.5 px-4">Employee</th>
                                            <th className="py-3.5 px-4">Date</th>
                                            <th className="py-3.5 px-4">Grievance Statement</th>
                                            <th className="py-3.5 px-4">Status</th>
                                            <th className="py-3.5 px-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {filteredComplaints.map(item => (
                                            <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                                                <td className="py-4 px-4 font-medium text-gray-900 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                                                            {(item.userName || 'U')[0].toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold text-gray-900">{item.userName || 'Anonymous / Staff'}</div>
                                                            <div className="text-xs text-gray-500 font-mono">{item.userId || 'No ID'}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4 text-gray-500 whitespace-nowrap text-xs">
                                                    {formatTime(item.timestamp)}
                                                </td>
                                                <td className="py-4 px-4 text-gray-700 max-w-md">
                                                    <p className="line-clamp-2 text-sm leading-relaxed">{item.text}</p>
                                                    {item.resolutionNotes && (
                                                        <p className="mt-1 text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 inline-block">
                                                            HR Note: {item.resolutionNotes}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="py-4 px-4 whitespace-nowrap">
                                                    {item.status === 'pending' && (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
                                                            <Clock className="h-3 w-3" /> Pending Review
                                                        </span>
                                                    )}
                                                    {item.status === 'in-review' && (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                                            <Eye className="h-3 w-3" /> Under Review
                                                        </span>
                                                    )}
                                                    {item.status === 'resolved' && (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
                                                            <CheckCircle className="h-3 w-3" /> Resolved
                                                        </span>
                                                    )}
                                                    {item.status === 'dismissed' && (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200">
                                                            <XCircle className="h-3 w-3" /> Dismissed
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-4 px-4 text-right whitespace-nowrap space-x-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleOpenComplaintModal(item)}
                                                        className="text-xs"
                                                    >
                                                        {canResolveGrievances ? 'Review & Update' : 'View Details'}
                                                    </Button>
                                                    {canDeleteGrievances && (
                                                        <button
                                                            onClick={() => handleDeleteComplaint(item.id)}
                                                            className="text-gray-400 hover:text-red-600 p-1.5 transition-colors"
                                                            title="Delete Grievance Record"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 2: REWARDS */}
            {activeTab === 'rewards' && (
                <div className="space-y-6">
                    {/* KPI Stat Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Redemptions</p>
                            <p className="text-2xl font-black text-gray-900 mt-2">{rewardStats.total}</p>
                        </div>
                        <div className="bg-white p-5 rounded-xl border border-amber-200 shadow-sm bg-amber-50/20">
                            <p className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
                                <Clock className="h-4 w-4" /> Pending Fulfillment
                            </p>
                            <p className="text-2xl font-black text-amber-600 mt-2">{rewardStats.pending}</p>
                        </div>
                        <div className="bg-white p-5 rounded-xl border border-green-200 shadow-sm bg-green-50/20">
                            <p className="text-xs font-bold text-green-600 uppercase tracking-wider flex items-center gap-1.5">
                                <CheckCircle className="h-4 w-4" /> Dispatched / Fulfilled
                            </p>
                            <p className="text-2xl font-black text-green-700 mt-2">{rewardStats.fulfilled}</p>
                        </div>
                        <div className="bg-white p-5 rounded-xl border border-purple-200 shadow-sm bg-purple-50/20">
                            <p className="text-xs font-bold text-purple-600 uppercase tracking-wider flex items-center gap-1.5">
                                <Award className="h-4 w-4" /> Total Points Redeemed
                            </p>
                            <p className="text-2xl font-black text-purple-700 mt-2">{rewardStats.totalPoints.toLocaleString()} pts</p>
                        </div>
                    </div>

                    {/* Filter and Search Bar */}
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search employee, reward..."
                                value={rewardSearch}
                                onChange={(e) => setRewardSearch(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <Filter className="h-4 w-4 text-gray-400" />
                            <select
                                value={rewardFilterStatus}
                                onChange={(e) => setRewardFilterStatus(e.target.value)}
                                className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="all">All Statuses</option>
                                <option value="pending">Pending Dispatch</option>
                                <option value="fulfilled">Fulfilled</option>
                                <option value="rejected">Rejected</option>
                            </select>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        {loadingRewards ? (
                            <div className="p-12 text-center text-gray-500 flex flex-col items-center justify-center gap-3">
                                <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
                                <p className="text-sm font-medium">Loading reward orders...</p>
                            </div>
                        ) : filteredRewards.length === 0 ? (
                            <div className="p-12 text-center text-gray-500">
                                <Gift className="h-10 w-10 text-gray-400 mx-auto mb-2 opacity-80" />
                                <p className="text-base font-bold text-gray-800">No Reward Redemptions Found</p>
                                <p className="text-sm text-gray-500 mt-1">No employee points redemptions matching your criteria.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-sm">
                                    <thead>
                                        <tr className="bg-gray-50/80 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                            <th className="py-3.5 px-4">Employee</th>
                                            <th className="py-3.5 px-4">Reward Claimed</th>
                                            <th className="py-3.5 px-4">Points Spent</th>
                                            <th className="py-3.5 px-4">Date</th>
                                            <th className="py-3.5 px-4">Status</th>
                                            <th className="py-3.5 px-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {filteredRewards.map(item => (
                                            <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                                                <td className="py-4 px-4 font-medium text-gray-900 whitespace-nowrap">
                                                    <div>
                                                        <div className="font-semibold text-gray-900">{item.userName || 'Employee'}</div>
                                                        <div className="text-xs text-gray-500 font-mono">{item.userId}</div>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4 font-semibold text-indigo-700 whitespace-nowrap">
                                                    {item.rewardTitle}
                                                </td>
                                                <td className="py-4 px-4 font-bold text-gray-800 whitespace-nowrap">
                                                    {item.pointsSpent} pts
                                                </td>
                                                <td className="py-4 px-4 text-gray-500 whitespace-nowrap text-xs">
                                                    {formatTime(item.timestamp)}
                                                </td>
                                                <td className="py-4 px-4 whitespace-nowrap">
                                                    {item.status === 'pending' && (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                                            <Clock className="h-3 w-3" /> Pending Fulfillment
                                                        </span>
                                                    )}
                                                    {item.status === 'fulfilled' && (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
                                                            <CheckCircle className="h-3 w-3" /> Fulfilled
                                                        </span>
                                                    )}
                                                    {item.status === 'rejected' && (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
                                                            <XCircle className="h-3 w-3" /> Rejected
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-4 px-4 text-right whitespace-nowrap">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleOpenRewardModal(item)}
                                                        className="text-xs"
                                                    >
                                                        {canManageRewards ? 'Fulfillment Status' : 'View Details'}
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 3: BUSINESS CONTACT INQUIRIES */}
            {activeTab === 'inquiries' && (
                <div className="space-y-6">
                    {/* KPI Stat Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Leads</p>
                                    <h3 className="text-2xl font-black text-gray-900 mt-1">{inquiryStats.total}</h3>
                                </div>
                                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                                    <Inbox className="h-6 w-6" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">New Inquiries</p>
                                    <h3 className="text-2xl font-black text-blue-700 mt-1">{inquiryStats.new}</h3>
                                </div>
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                                    <Mail className="h-6 w-6" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Contacted / Progress</p>
                                    <h3 className="text-2xl font-black text-amber-700 mt-1">{inquiryStats.contacted}</h3>
                                </div>
                                <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                                    <Clock className="h-6 w-6" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-green-600 uppercase tracking-wider">Closed Leads</p>
                                    <h3 className="text-2xl font-black text-green-700 mt-1">{inquiryStats.closed}</h3>
                                </div>
                                <div className="p-3 bg-green-50 text-green-600 rounded-xl">
                                    <CheckCircle className="h-6 w-6" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Filter & Search Bar */}
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by name, phone, email, requirement..."
                                value={inquirySearch}
                                onChange={(e) => setInquirySearch(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <Filter className="h-4 w-4 text-gray-500" />
                            <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Status:</span>
                            <select
                                value={inquiryFilterStatus}
                                onChange={(e) => setInquiryFilterStatus(e.target.value)}
                                className="border border-gray-300 rounded-lg py-1.5 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="all">All Inquiries ({inquiries.length})</option>
                                <option value="new">New ({inquiryStats.new})</option>
                                <option value="contacted">Contacted ({inquiryStats.contacted})</option>
                                <option value="closed">Closed ({inquiryStats.closed})</option>
                            </select>
                        </div>
                    </div>

                    {/* Inquiries Table */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        {loadingInquiries ? (
                            <div className="p-12 text-center text-gray-500">
                                <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600 mb-2" />
                                <p className="text-sm font-semibold">Loading business inquiries...</p>
                            </div>
                        ) : filteredInquiries.length === 0 ? (
                            <div className="p-12 text-center text-gray-500">
                                <Inbox className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                                <h4 className="text-base font-bold text-gray-800">No Inquiries Found</h4>
                                <p className="text-sm text-gray-500 mt-1">
                                    {inquirySearch ? 'No client messages match your search.' : 'Inbound client inquiries from the website will appear here in real time.'}
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="py-3 px-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                                            <th className="py-3 px-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Client / Sender</th>
                                            <th className="py-3 px-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Contact Info</th>
                                            <th className="py-3 px-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Subject & Message</th>
                                            <th className="py-3 px-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                            <th className="py-3 px-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 text-sm">
                                        {filteredInquiries.map((item) => (
                                            <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="py-4 px-4 text-gray-500 text-xs whitespace-nowrap">
                                                    {formatTime(item.timestamp)}
                                                </td>
                                                <td className="py-4 px-4 whitespace-nowrap">
                                                    <div className="font-bold text-gray-900">{item.name || 'Anonymous'}</div>
                                                </td>
                                                <td className="py-4 px-4 whitespace-nowrap">
                                                    <div className="space-y-1">
                                                        {item.phone && (
                                                            <a 
                                                                href={`tel:${item.phone}`} 
                                                                className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                                                                title="Click to call"
                                                            >
                                                                <Phone size={12} /> {item.phone}
                                                            </a>
                                                        )}
                                                        {item.email && (
                                                            <div>
                                                                <a 
                                                                    href={`mailto:${item.email}`} 
                                                                    className="inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900"
                                                                    title="Click to email"
                                                                >
                                                                    <Mail size={12} /> {item.email}
                                                                </a>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4 max-w-md">
                                                    <div className="font-bold text-gray-800 text-xs">{item.subject || 'General Inquiry'}</div>
                                                    <p className="text-gray-600 text-xs line-clamp-2 mt-0.5 whitespace-pre-wrap">{item.message}</p>
                                                    {item.notes && (
                                                        <div className="text-[11px] text-indigo-600 font-semibold mt-1 bg-indigo-50 px-2 py-0.5 rounded inline-block">
                                                            Note: {item.notes}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-4 px-4 whitespace-nowrap">
                                                    {(!item.status || item.status === 'new') && (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                                            <Mail className="h-3 w-3" /> New Inquiry
                                                        </span>
                                                    )}
                                                    {item.status === 'contacted' && (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                                            <Clock className="h-3 w-3" /> Contacted
                                                        </span>
                                                    )}
                                                    {item.status === 'closed' && (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
                                                            <CheckCircle className="h-3 w-3" /> Closed
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-4 px-4 text-right whitespace-nowrap">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleOpenInquiryModal(item)}
                                                            className="text-xs"
                                                        >
                                                            View / Update
                                                        </Button>
                                                        {isSuperAdmin && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteInquiry(item.id, item.name)}
                                                                className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                                                title="Delete inquiry"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* MODAL 1: GRIEVANCE DETAIL & RESOLUTION */}
            {selectedComplaint && (
                <Modal
                    isOpen={!!selectedComplaint}
                    onClose={() => setSelectedComplaint(null)}
                    title="Grievance Incident Review"
                >
                    <div className="space-y-5">
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2">
                            <div className="flex justify-between items-center text-xs text-gray-500">
                                <span>Reported by: <strong className="text-gray-800">{selectedComplaint.userName}</strong> ({selectedComplaint.userId})</span>
                                <span>{formatTime(selectedComplaint.timestamp)}</span>
                            </div>
                            <div className="pt-2 border-t border-gray-200">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Employee Statement</label>
                                <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed bg-white p-3 rounded-lg border border-gray-200">
                                    {selectedComplaint.text}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">Ticket Status</label>
                            <select
                                value={targetStatus}
                                disabled={!canResolveGrievances}
                                onChange={(e) => setTargetStatus(e.target.value as any)}
                                className="w-full text-sm border border-gray-300 rounded-lg p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-500"
                            >
                                <option value="pending">Pending (Action Required)</option>
                                <option value="in-review">Under Investigation / In Review</option>
                                <option value="resolved">Resolved (Matter Closed)</option>
                                <option value="dismissed">Dismissed (No Action Required)</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">HR Resolution / Investigation Notes</label>
                            <Textarea
                                rows={3}
                                readOnly={!canResolveGrievances}
                                placeholder={canResolveGrievances ? "Enter internal HR notes, resolution outcome, or communication with site supervisors..." : "No resolution notes entered."}
                                value={resolutionNotes}
                                onChange={(e) => setResolutionNotes(e.target.value)}
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
                            <Button variant="outline" onClick={() => setSelectedComplaint(null)}>
                                {canResolveGrievances ? 'Cancel' : 'Close'}
                            </Button>
                            {canResolveGrievances && (
                                <Button onClick={handleSaveComplaint} disabled={isSavingComplaint}>
                                    {isSavingComplaint ? 'Saving...' : 'Save Grievance Resolution'}
                                </Button>
                            )}
                        </div>
                    </div>
                </Modal>
            )}

            {/* MODAL 2: REWARD FULFILLMENT */}
            {selectedReward && (
                <Modal
                    isOpen={!!selectedReward}
                    onClose={() => setSelectedReward(null)}
                    title="Reward Redemption Fulfillment"
                >
                    <div className="space-y-5">
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2">
                            <div className="flex justify-between items-center text-xs text-gray-500">
                                <span>Employee: <strong className="text-gray-800">{selectedReward.userName}</strong> ({selectedReward.userId})</span>
                                <span>{formatTime(selectedReward.timestamp)}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-gray-200 text-sm">
                                <span>Item Claimed: <strong className="text-indigo-700">{selectedReward.rewardTitle}</strong></span>
                                <span className="font-bold text-gray-800">{selectedReward.pointsSpent} Points</span>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">Fulfillment Status</label>
                            <select
                                value={targetRewardStatus}
                                disabled={!canManageRewards}
                                onChange={(e) => setTargetRewardStatus(e.target.value as any)}
                                className="w-full text-sm border border-gray-300 rounded-lg p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-500"
                            >
                                <option value="pending">Pending Dispatch</option>
                                <option value="fulfilled">Fulfilled / Dispatched</option>
                                <option value="rejected">Rejected / Cancelled</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">Fulfillment Notes / Voucher / Courier Tracking</label>
                            <Textarea
                                rows={3}
                                readOnly={!canManageRewards}
                                placeholder={canManageRewards ? "Enter voucher code, courier tracking number, or dispatch notes..." : "No fulfillment notes entered."}
                                value={fulfillmentNotes}
                                onChange={(e) => setFulfillmentNotes(e.target.value)}
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
                            <Button variant="outline" onClick={() => setSelectedReward(null)}>
                                {canManageRewards ? 'Cancel' : 'Close'}
                            </Button>
                            {canManageRewards && (
                                <Button onClick={handleSaveReward} disabled={isSavingReward}>
                                    {isSavingReward ? 'Saving...' : 'Update Fulfillment'}
                                </Button>
                            )}
                        </div>
                    </div>
                </Modal>
            )}

            {/* MODAL 3: INQUIRY REVIEW & UPDATE */}
            {selectedInquiry && (
                <Modal
                    isOpen={!!selectedInquiry}
                    onClose={() => setSelectedInquiry(null)}
                    title="Business Contact Inquiry Details"
                >
                    <div className="space-y-5">
                        {/* Sender info card */}
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                            <div className="flex justify-between items-center text-xs text-slate-500">
                                <span>Received: <strong>{formatTime(selectedInquiry.timestamp)}</strong></span>
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                                    (!selectedInquiry.status || selectedInquiry.status === 'new')
                                        ? 'bg-blue-100 text-blue-800'
                                        : selectedInquiry.status === 'contacted'
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-green-100 text-green-800'
                                }`}>
                                    {selectedInquiry.status || 'new'}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sender Name</label>
                                    <p className="text-sm font-bold text-slate-800">{selectedInquiry.name || 'Anonymous'}</p>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Subject / Service</label>
                                    <p className="text-sm font-semibold text-slate-700">{selectedInquiry.subject || 'General Inquiry'}</p>
                                </div>
                            </div>

                            {/* Quick Contact Actions */}
                            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200">
                                {selectedInquiry.phone && (
                                    <a
                                        href={`tel:${selectedInquiry.phone}`}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold transition-colors"
                                    >
                                        <Phone size={13} /> Call: {selectedInquiry.phone}
                                    </a>
                                )}
                                {selectedInquiry.email && (
                                    <a
                                        href={`mailto:${selectedInquiry.email}`}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 text-slate-700 hover:bg-slate-300 rounded-lg text-xs font-bold transition-colors"
                                    >
                                        <Mail size={13} /> Email: {selectedInquiry.email}
                                    </a>
                                )}
                            </div>
                        </div>

                        {/* Full Message Body */}
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Requirement / Message</label>
                            <div className="p-3.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                                {selectedInquiry.message || 'No message provided.'}
                            </div>
                        </div>

                        {/* Status Selection */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Follow-Up Status</label>
                            <select
                                value={targetInquiryStatus}
                                onChange={(e) => setTargetInquiryStatus(e.target.value as any)}
                                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                            >
                                <option value="new">New (Needs Outreach)</option>
                                <option value="contacted">Contacted / In Discussion</option>
                                <option value="closed">Closed / Deal Concluded</option>
                            </select>
                        </div>

                        {/* Internal Follow-Up Notes */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Internal Follow-Up / Sales Notes</label>
                            <Textarea
                                rows={3}
                                placeholder="Enter notes from your call, quote sent, or next action step..."
                                value={inquiryNotes}
                                onChange={(e) => setInquiryNotes(e.target.value)}
                            />
                        </div>

                        {/* Footer Buttons */}
                        <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                            {isSuperAdmin ? (
                                <button
                                    type="button"
                                    onClick={() => handleDeleteInquiry(selectedInquiry.id, selectedInquiry.name)}
                                    className="text-red-600 hover:text-red-800 text-xs font-bold flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50"
                                >
                                    <Trash2 size={14} /> Delete Lead
                                </button>
                            ) : <div />}

                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setSelectedInquiry(null)}>
                                    Cancel
                                </Button>
                                <Button onClick={handleSaveInquiry} disabled={isSavingInquiry}>
                                    {isSavingInquiry ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default AdminGrievancesPage;

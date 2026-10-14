import React, { useEffect, useState } from 'react';
import { TimelineEvent, FirestoreEmployee } from '../../types';
import { getEmployeeTimeline, getEmployeeById } from '../../src/services/employeeService';
import {
    Calendar, CheckCircle, AlertTriangle, FileText,
    UserMinus, UserPlus, ArrowUpCircle, Clock,
    ChevronRight, ExternalLink
} from 'lucide-react';

interface EmployeeTimelinePageProps {
    employeeId: string;
    onClose: () => void;
}

const EmployeeTimelinePage: React.FC<EmployeeTimelinePageProps> = ({ employeeId, onClose }) => {
    const [events, setEvents] = useState<TimelineEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [employee, setEmployee] = useState<FirestoreEmployee | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch basic details of current ID
                const empData = await getEmployeeById(employeeId);
                setEmployee(empData as unknown as FirestoreEmployee);

                // Fetch full timeline
                const timelineEvents = await getEmployeeTimeline(employeeId);
                setEvents(Array.isArray(timelineEvents) ? timelineEvents : []);
            } catch (err: any) {
                setError(err.message || "Failed to load timeline.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [employeeId]);

    const getIcon = (type: string) => {
        switch (type) {
            case 'JOINED': return <UserPlus size={18} className="text-green-600" />;
            case 'RELIEVED': return <UserMinus size={18} className="text-purple-600" />;
            case 'LEAVE': return <Clock size={18} className="text-blue-600" />;
            case 'DISCIPLINE': return <AlertTriangle size={18} className="text-red-600" />;
            case 'UPDATE': return <FileText size={18} className="text-amber-600" />;
            case 'RESIGNATION': return <FileText size={18} className="text-orange-600" />;
            case 'SUBMISSION': return <CheckCircle size={18} className="text-indigo-600" />;
            default: return <Calendar size={18} className="text-gray-600" />;
        }
    };

    const getBgColor = (type: string) => {
        switch (type) {
            case 'JOINED': return 'bg-green-100 border-green-200';
            case 'RELIEVED': return 'bg-purple-100 border-purple-200';
            case 'LEAVE': return 'bg-blue-50 border-blue-100';
            case 'DISCIPLINE': return 'bg-red-50 border-red-100';
            case 'UPDATE': return 'bg-amber-50 border-amber-100';
            case 'SUBMISSION': return 'bg-indigo-50 border-indigo-100';
            default: return 'bg-gray-50 border-gray-100';
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500 animate-pulse">Loading detailed history...</div>;
    if (error) return <div className="p-8 text-center text-red-600">{error}</div>;

    const displayName = employee?.applicantName 
        || (employee as any)?.profileData?.applicantName 
        || (employee as any)?.profileData?.['Applicant Name'] 
        || (employee as any)?.profileData?.['Full Name'] 
        || (employee as any)?.data?.['Applicant Name'] 
        || (employee as any)?.data?.['Full Name'] 
        || (employee as any)?.name 
        || 'Employee Record';

    const displayId = employee?.employeeId || (employee as any)?.id || employeeId;
    const displayDesignation = employee?.designation || (employee as any)?.profileData?.designation || (employee as any)?.data?.designation || '';
    const displaySite = employee?.siteName || (employee as any)?.currentSite || (employee as any)?.siteId || '';

    return (
        <div className="flex flex-col h-full bg-white rounded-2xl overflow-hidden shadow-xl border border-gray-200">
            {/* Header */}
            <div className="bg-slate-50 p-6 border-b border-gray-100 flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                        {displayName}
                    </h2>
                    <div className="flex items-center flex-wrap gap-2 mt-1">
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-mono font-bold">
                            {displayId}
                        </span>
                        {displayDesignation && (
                            <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-xs font-medium">
                                {displayDesignation}
                            </span>
                        )}
                        {displaySite && (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-xs font-medium border border-emerald-100">
                                📍 {displaySite}
                            </span>
                        )}
                        {employee?.previousEmployeeId && (
                            <span className="flex items-center text-xs text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                                <RotateCcw size={10} className="mr-1" />
                                Rejoined (Prev: {employee.previousEmployeeId})
                            </span>
                        )}
                        {employee?.rehiredAs && (
                            <span className="flex items-center text-xs text-purple-600 font-bold bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                                <ExternalLink size={10} className="mr-1" />
                                Rehired As: {employee.rehiredAs}
                            </span>
                        )}
                    </div>
                </div>
                <button 
                    onClick={onClose} 
                    title="Back to search"
                    className="p-2.5 bg-white hover:bg-slate-200 rounded-full shadow-sm transition-colors text-slate-500 hover:text-slate-800 border border-slate-200"
                >
                    <ChevronRight size={22} />
                </button>
            </div>

            {/* Timeline */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50/50">
                <div className="relative border-l-2 border-slate-200 ml-4 space-y-8 pb-12">
                    {events.map((event, idx) => (
                        <div key={event.id} className="relative pl-8 group">
                            {/* Dot */}
                            <div className={`absolute -left-[9px] top-0 h-4 w-4 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${event.type === 'DISCIPLINE' ? 'bg-red-500' :
                                event.type === 'JOINED' ? 'bg-green-500' :
                                    event.type === 'RELIEVED' ? 'bg-purple-500' :
                                        'bg-slate-400'
                                }`}></div>

                            {/* Date Label */}
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white px-2 py-0.5 rounded border border-slate-100 mb-2 inline-block">
                                {new Date(event.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                            </span>

                            {/* Card */}
                            <div className={`p-4 rounded-xl border shadow-sm transition-all hover:shadow-md ${getBgColor(event.type)}`}>
                                <div className="flex items-start justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                        {getIcon(event.type)}
                                        <h4 className="font-bold text-sm text-slate-800">{event.title}</h4>
                                    </div>
                                    <span className="text-[10px] bg-white/60 px-2 py-0.5 rounded font-black text-slate-500 border border-black/5">
                                        {event.id.startsWith('join-') || event.id.startsWith('relieve-') || event.employeeId !== employeeId ? event.employeeId : 'Current'}
                                    </span>
                                </div>

                                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                                    {event.description}
                                </p>

                                {event.status && (
                                    <div className="mt-2 flex justify-end">
                                        <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full bg-white/80 border border-black/5 ${event.status === 'Approved' ? 'text-green-600' :
                                            event.status === 'Rejected' ? 'text-red-600' :
                                                event.status === 'Pending' ? 'text-amber-600' :
                                                    'text-slate-500'
                                            }`}>
                                            {event.status}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {events.length === 0 && (
                        <div className="text-center py-12 text-gray-400">
                            No history found.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Helper for icon
import { RotateCcw } from 'lucide-react';

export default EmployeeTimelinePage;


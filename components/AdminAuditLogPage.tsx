import log from '../src/utils/logger';
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Search, Filter, Trash2, Pencil, Check, X, FileClock } from 'lucide-react';
import { AuditLogEntry, Role, Permission } from '../types';
import { useAuth } from '../src/context/AuthContext';
import { subscribeToAuditLogs, _deleteAuditLog, _updateAuditLogDetails } from '../src/services/auditService';

interface AdminAuditLogPageProps {
    userRole?: Role;
    isSuperAdmin?: boolean;
}

const AdminAuditLogPage: React.FC<AdminAuditLogPageProps> = ({ userRole, isSuperAdmin }) => {
    const { authUser } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterModule, setFilterModule] = useState<string>('ALL');
    const [filterAction, setFilterAction] = useState<string>('ALL');
    const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // ─── Hidden SuperAdmin Mode ────────────────────────────────────────────────
    // Activated by: Ctrl + Shift + Alt + L (only works when isSuperAdmin is true)
    // Invisible to all other users — no UI hints exist
    const [privilegeMode, setPrivilegeMode] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState('');
    const [actionPending, setActionPending] = useState<string | null>(null);
    const keysPressed = useRef<Set<string>>(new Set());

    useEffect(() => {
        // Normalize key to lowercase — Shift+L gives 'L' not 'l'
        const handleKeyDown = (e: KeyboardEvent) => {
            keysPressed.current.add(e.key.toLowerCase());
            if (
                keysPressed.current.has('control') &&
                keysPressed.current.has('shift') &&
                keysPressed.current.has('alt') &&
                keysPressed.current.has('delete')
            ) {
                // Silently ignore if not SuperAdmin
                if (isSuperAdmin) {
                    setPrivilegeMode(prev => !prev);
                }
                keysPressed.current.clear();
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            keysPressed.current.delete(e.key.toLowerCase());
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [isSuperAdmin]);

    const handleDelete = useCallback(async (logId: string) => {
        if (!isSuperAdmin) return;
        setActionPending(logId);
        try {
            await _deleteAuditLog(logId);
        } catch (err) {
            console.error('Delete failed:', err);
        } finally {
            setActionPending(null);
        }
    }, [isSuperAdmin]);

    const handleEditSave = useCallback(async (logId: string) => {
        if (!isSuperAdmin) return;
        setActionPending(logId);
        try {
            await _updateAuditLogDetails(logId, editingText);
            setEditingId(null);
            setEditingText('');
        } catch (err) {
            console.error('Edit failed:', err);
        } finally {
            setActionPending(null);
        }
    }, [isSuperAdmin, editingText]);

    // ─── Data Subscription ────────────────────────────────────────────────────
    useEffect(() => {
        let filter: { actorId?: string } | undefined;

        const hasFullAccess =
            isSuperAdmin ||
            userRole?.permissions.includes(Permission.MANAGE_SYSTEM) ||
            userRole?.permissions.includes(Permission.VIEW_AUDIT_LOGS);

        if (!hasFullAccess && authUser?.uid) {
            filter = { actorId: authUser.uid };
        }

        log.log("Audit Log Subscription - Has Full Access:", hasFullAccess, "Filter:", filter);

        const unsubscribe = subscribeToAuditLogs((logs) => {
            setAuditLogs(logs);
            setIsLoading(false);
        }, 100, filter);
        return () => unsubscribe();
    }, [authUser, userRole, isSuperAdmin]);

    const filteredLogs = useMemo(() => {
        return auditLogs.filter(entry => {
            const matchesSearch =
                entry.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
                entry.actorName.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesModule = filterModule === 'ALL' || entry.targetModule === filterModule;
            const matchesAction = filterAction === 'ALL' || entry.actionType === filterAction;
            return matchesSearch && matchesModule && matchesAction;
        });
    }, [auditLogs, searchTerm, filterModule, filterAction]);

    const getActionColor = (action: string) => {
        switch (action) {
            case 'CREATE': return 'text-green-600 bg-green-50 border-green-200';
            case 'DELETE': return 'text-red-600 bg-red-50 border-red-200';
            case 'UPDATE': return 'text-blue-600 bg-blue-50 border-blue-200';
            case 'APPROVAL': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
            case 'REJECTION': return 'text-orange-600 bg-orange-50 border-orange-200';
            case 'STATUS_CHANGE': return 'text-purple-600 bg-purple-50 border-purple-200';
            case 'SUBMIT': return 'text-indigo-600 bg-indigo-50 border-indigo-200';
            case 'EXPORT': return 'text-teal-600 bg-teal-50 border-teal-200';
            default: return 'text-gray-600 bg-gray-50 border-gray-200';
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 flex items-center">
                            <FileClock className="mr-2 text-slate-600" /> System Audit Logs
                            {/* Hidden indicator — only visible in privilege mode */}
                            {privilegeMode && (
                                <span className="ml-3 text-xs font-normal px-2 py-0.5 bg-red-100 text-red-700 rounded-full border border-red-300">
                                    ● Privileged Mode
                                </span>
                            )}
                        </h2>
                        <p className="text-sm text-gray-500">Track administrative actions and system changes.</p>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-grow relative">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <input
                            type="text"
                            className="pl-10 w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            placeholder="Search logs by user or details..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="w-full md:w-56 relative">
                        <Filter className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <select
                            className="pl-10 w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-sm"
                            value={filterModule}
                            onChange={e => setFilterModule(e.target.value)}
                        >
                            <option value="ALL">All Modules</option>
                            <option value="EMPLOYEES">Employees</option>
                            <option value="SUBMISSION">Submissions</option>
                            <option value="LEAVES">Leaves</option>
                            <option value="BGV">Background Verification</option>
                            <option value="INVITES">Referral Invites</option>
                            <option value="DISCIPLINARY">Disciplinary</option>
                            <option value="STAFF">Staff</option>
                            <option value="ROLES">Roles</option>
                            <option value="SITES">Sites</option>
                            <option value="AUTH">Authentication & Security</option>
                            <option value="SETTINGS">Settings</option>
                            <option value="SYSTEM">System</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actor</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Module</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                            {/* Hidden column header — only shows in privilege mode */}
                            {privilegeMode && (
                                <th className="px-4 py-3 text-left text-xs font-medium text-red-500 uppercase tracking-wider">Manage</th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {isLoading ? (
                            <tr><td colSpan={privilegeMode ? 6 : 5} className="px-6 py-8 text-center text-gray-400 italic">Loading...</td></tr>
                        ) : filteredLogs.length === 0 ? (
                            <tr><td colSpan={privilegeMode ? 6 : 5} className="px-6 py-8 text-center text-gray-400 italic">No logs found matching criteria.</td></tr>
                        ) : (
                            filteredLogs.map(entry => (
                                <tr key={entry.id} className={`hover:bg-gray-50 ${privilegeMode ? 'hover:bg-red-50' : ''}`}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {new Date(entry.timestamp).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {entry.actorName}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 text-xs font-bold rounded border ${getActionColor(entry.actionType)}`}>
                                            {entry.actionType}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {entry.targetModule}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-700">
                                        {privilegeMode && editingId === entry.id ? (
                                            <input
                                                className="w-full border border-blue-400 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                value={editingText}
                                                onChange={e => setEditingText(e.target.value)}
                                                autoFocus
                                            />
                                        ) : (
                                            <span className={entry._edited ? 'italic text-gray-400' : ''}>
                                                {entry.details}
                                                {entry._edited && <span className="ml-1 text-xs text-gray-400">(edited)</span>}
                                            </span>
                                        )}
                                    </td>

                                    {/* Hidden action column — only renders in privilege mode */}
                                    {privilegeMode && (
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            {editingId === entry.id ? (
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleEditSave(entry.id)}
                                                        disabled={actionPending === entry.id}
                                                        className="p-1.5 rounded bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                                                        title="Save"
                                                    >
                                                        <Check size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => { setEditingId(null); setEditingText(''); }}
                                                        className="p-1.5 rounded bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
                                                        title="Cancel"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => { setEditingId(entry.id); setEditingText(entry.details); }}
                                                        className="p-1.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                                        title="Edit details"
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(entry.id)}
                                                        disabled={actionPending === entry.id}
                                                        className="p-1.5 rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                                        title="Delete log"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminAuditLogPage;


import React from 'react';
import { DisciplinaryAction, DisciplinaryActionType } from '../../types';
import { Gavel, AlertCircle, Info, ShieldAlert } from 'lucide-react';
import SecureDocumentLink from '../../src/components/common/SecureDocumentLink';

interface EmployeeDisciplinaryPageProps {
    disciplinaryActions: DisciplinaryAction[];
}

const EmployeeDisciplinaryPage: React.FC<EmployeeDisciplinaryPageProps> = ({ disciplinaryActions }) => {

    const getSeverityColor = (type: DisciplinaryActionType) => {
        switch (type) {
            case DisciplinaryActionType.VERBAL_WARNING: return { bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-200', icon: 'text-yellow-500' };
            case DisciplinaryActionType.WRITTEN_WARNING: return { bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-200', icon: 'text-orange-500' };
            case DisciplinaryActionType.SHOW_CAUSE: return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: 'text-red-500' };
            case DisciplinaryActionType.SUSPENSION: return { bg: 'bg-red-100', text: 'text-red-900', border: 'border-red-300', icon: 'text-red-700' };
            case DisciplinaryActionType.TERMINATION: return { bg: 'bg-gray-900', text: 'text-white', border: 'border-gray-800', icon: 'text-red-500' };
            default: return { bg: 'bg-gray-50', text: 'text-gray-800', border: 'border-gray-200', icon: 'text-gray-500' };
        }
    };

    // Sort by date descending
    const sortedActions = [...disciplinaryActions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
        <div className="bg-white shadow-xl rounded-lg p-6 md:p-8">
            <div className="flex justify-between items-center mb-6 border-b pb-3">
                <h2 className="text-2xl font-semibold text-gray-800 flex items-center">
                    <Gavel size={24} className="mr-2 text-red-600" /> Disciplinary Records
                </h2>
            </div>

            {sortedActions.length === 0 ? (
                <div className="text-center py-12 bg-green-50 rounded-lg border border-green-100">
                    <ShieldAlert size={48} className="mx-auto text-green-400 mb-3" />
                    <h3 className="text-lg font-bold text-green-800 mb-1">Clear Record</h3>
                    <p className="text-green-700">You have no active disciplinary actions on file. Keep up the good work!</p>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <Info className="h-5 w-5 text-blue-400" aria-hidden="true" />
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-blue-700">
                                    Below is a history of formal actions taken. If you believe there is an error, please contact your Field Officer or HR immediately.
                                </p>
                            </div>
                        </div>
                    </div>

                    {sortedActions.map(action => {
                        const styles = getSeverityColor(action.actionType);
                        return (
                            <div key={action.id} className={`rounded-lg border ${styles.border} ${styles.bg} p-5 shadow-sm`}>
                                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                                    <div>
                                        <div className="flex items-center space-x-3 mb-2">
                                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${styles.border} bg-white ${styles.text}`}>
                                                {action.actionType}
                                            </span>
                                            <span className="text-sm text-gray-500 font-medium">
                                                Date: {new Date(action.date).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <h4 className={`text-lg font-bold ${styles.text === 'text-white' ? 'text-white' : 'text-gray-900'} mb-2`}>
                                            Incident Report
                                        </h4>
                                        <p className={`text-sm ${styles.text === 'text-white' ? 'text-gray-300' : 'text-gray-700'} leading-relaxed`}>
                                            {action.description}
                                        </p>
                                        {action.documentUrl && (
                                            <SecureDocumentLink
                                                path={action.documentUrl}
                                                className="mt-3 inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800 underline"
                                            >
                                                <Info size={16} className="mr-1" /> View Warning Letter / Proof
                                            </SecureDocumentLink>
                                        )}
                                    </div>
                                    <div className={`text-right flex-shrink-0 ${styles.text === 'text-white' ? 'text-gray-400' : 'text-gray-500'}`}>
                                        <p className="text-xs font-bold uppercase tracking-widest mb-1">Issued By</p>
                                        <p className="text-sm font-semibold">{action.filedBy}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default EmployeeDisciplinaryPage;


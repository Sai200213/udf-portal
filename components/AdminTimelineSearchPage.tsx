import React, { useState } from 'react';
import { Search, User, FileText, Clock, ChevronRight, Loader } from 'lucide-react';
import Input from './common/Input';
import Button from './common/Button';
import { searchAllEmployees } from '../src/services/employeeService';

interface AdminTimelineSearchPageProps {
    onViewTimeline: (employeeId: string) => void;
}

const AdminTimelineSearchPage: React.FC<AdminTimelineSearchPageProps> = ({ onViewTimeline }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!searchTerm.trim()) return;

        setLoading(true);
        setHasSearched(true);
        try {
            const data = await searchAllEmployees(searchTerm);
            setResults(data);
        } catch (error) {
            console.error("Search failed:", error);
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
                <Search className="w-6 h-6 mr-2 text-blue-600" />
                Employee Inquiry
            </h1>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-8">
                <form onSubmit={handleSearch} className="flex gap-4">
                    <div className="flex-1">
                        <Input
                            label=""
                            name="search"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search by Name or Employee ID..."
                            icon={<Search size={18} />}
                        />
                    </div>
                    <div className="mt-1">
                        <Button
                            text={loading ? 'Searching...' : 'Search'}
                            onClick={() => handleSearch()}
                            variant="primary"
                            disabled={loading || !searchTerm.trim()}
                        />
                    </div>
                </form>
                <p className="text-xs text-gray-500 mt-2 ml-1">
                    Search across Active Employees, Relieved Staff, and Pending Submissions.
                </p>
            </div>

            {loading && (
                <div className="flex justify-center py-12">
                    <Loader className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
            )}

            {!loading && hasSearched && results.length === 0 && (
                <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">No records found matching "{searchTerm}"</p>
                </div>
            )}

            {!loading && results.length > 0 && (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                        <h3 className="font-semibold text-gray-700">Search Results ({results.length})</h3>
                    </div>
                    <ul className="divide-y divide-gray-100">
                        {results.map((result) => (
                            <li 
                                key={result.id} 
                                onClick={() => onViewTimeline(result.employeeId || result.id)}
                                className="p-4 hover:bg-blue-50 transition-colors flex items-center justify-between group cursor-pointer"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${result.type === 'EMPLOYEE' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'
                                        }`}>
                                        {result.type === 'EMPLOYEE' ? <User size={20} /> : <FileText size={20} />}
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-gray-900">{result.name}</h4>
                                        <div className="flex items-center text-sm text-gray-500 gap-3">
                                            <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs text-gray-600">
                                                {result.id}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <span className={`w-2 h-2 rounded-full ${result.status === 'Active' ? 'bg-green-500' :
                                                    result.status === 'Relieved' ? 'bg-red-500' :
                                                        result.status.includes('Submission') ? 'bg-orange-500' : 'bg-gray-400'
                                                    }`} />
                                                {result.status}
                                            </span>
                                            <span>• {result.designation}</span>
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    text="View Timeline"
                                    onClick={() => onViewTimeline(result.employeeId || result.id)}
                                    variant="secondary"
                                    icon={<Clock size={16} />}
                                    className="sm:opacity-90 hover:opacity-100 transition-opacity shadow-sm"
                                />
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default AdminTimelineSearchPage;


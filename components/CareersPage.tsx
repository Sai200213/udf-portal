import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PublicHeader from './common/PublicHeader';
import PublicFooter from './common/PublicFooter';
import { getWebsiteConfig, WebsiteServiceData } from '../src/services/websiteService';
import { getOpenVacancies } from '../src/services/vacancyService';
import { Vacancy } from '../types';
import { Briefcase, MapPin, DollarSign, Clock, CheckCircle2, ChevronRight, Search, ChevronDown, ChevronUp } from 'lucide-react';
import AdSenseUnit from './common/AdSenseUnit';
import SEOHead from '../src/components/common/SEOHead';

const CareersPage: React.FC = () => {
    const navigate = useNavigate();
    const [config, setConfig] = useState<WebsiteServiceData | null>(null);
    const [vacancies, setVacancies] = useState<Vacancy[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedVacancy, setExpandedVacancy] = useState<string | null>(null);

    useEffect(() => {
        window.scrollTo(0, 0);

        const loadData = async () => {
            try {
                const [webConfig, openVacancies] = await Promise.all([
                    getWebsiteConfig(),
                    getOpenVacancies()
                ]);
                setConfig(webConfig);
                setVacancies(openVacancies);
            } catch (err) {
                console.error("Failed to load careers page data", err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const filteredVacancies = vacancies.filter(v => {
        const matchesSearch = v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              (v.siteName && v.siteName.toLowerCase().includes(searchQuery.toLowerCase())) ||
                              (v.location && v.location.toLowerCase().includes(searchQuery.toLowerCase())) ||
                              (v.description && v.description.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesSearch;
    });

    const handleApply = (vacancy: Vacancy) => {
        navigate(`/join?siteId=${vacancy.siteId}&role=${encodeURIComponent(vacancy.title)}`);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <SEOHead
                title="Security Guard Jobs & Careers | Unique Delta Force"
                description="Join Unique Delta Force Pvt Ltd. Explore active security officer, supervisor, and facility manager job vacancies with attractive benefits."
                canonicalUrl="https://udfonline.in/careers"
            />
            <PublicHeader />
            <main className="flex-grow">

            {/* Banner Section */}
            <div className="bg-slate-900 py-16 text-white text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-900 to-slate-900 opacity-90"></div>
                <div className="relative max-w-4xl mx-auto px-4">
                    <span className="text-xs uppercase font-extrabold text-blue-400 tracking-widest bg-blue-500/10 px-3.5 py-1.5 rounded-full border border-blue-400/20">
                        Join Our Professional Ranks
                    </span>
                    <h1 className="text-3xl md:text-4xl font-extrabold mt-4 mb-2 tracking-tight">
                        {config?.careersTitle || 'Build a Career in Protection and Trust'}
                    </h1>
                    <p className="text-slate-300 text-sm max-w-xl mx-auto">
                        {config?.careersSubtitle || 'Explore open security guard and supervisor jobs across our branches with on-time payouts and legal PF/ESI benefits.'}
                    </p>
                </div>
            </div>

            {/* Careers Main Area - Split layout like Contact page */}
            <div className="flex-1 max-w-6xl mx-auto px-4 py-12 w-full">
                <div className="my-4 max-w-6xl mx-auto">
                    <AdSenseUnit slot="6666666666" format="horizontal" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-8">
                    {/* Left Column: Pitch & Benefits */}
                    <div className="lg:col-span-5 space-y-6">
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
                            <h2 className="text-lg font-bold text-gray-900 mb-4 border-b pb-3">Why Join Unique Delta Force?</h2>
                            <p className="text-slate-600 text-sm leading-relaxed mb-6">
                                {config?.careersPitch || 'At Unique Delta Force, we believe our officers are our core strength. We provide regular training, career advancement tracks, competitive salaries paid strictly by the 7th of every month, and fully compliant PF and ESI medical coverage.'}
                            </p>

                            <div className="space-y-3.5">
                                {(config?.careersBenefits || []).map((benefit, idx) => (
                                    <div key={idx} className="flex items-start space-x-3 text-sm text-slate-600">
                                        <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                        <span className="font-medium">{benefit}</span>
                                    </div>
                                ))}
                            </div>
                        </div>


                    </div>

                    {/* Right Column: Open Positions */}
                    <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 pb-4 border-b">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Current Job Openings</h2>
                                <p className="text-xs text-slate-500 font-medium">Browse active positions and apply directly.</p>
                            </div>

                            {/* Search bar */}
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search jobs..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 pr-4 py-2 w-full sm:w-48 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                                />
                            </div>
                        </div>

                        {filteredVacancies.length === 0 ? (
                            <div className="text-center py-12">
                                <Briefcase className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                                <p className="text-slate-500 text-sm font-semibold">No open vacancies found</p>
                                <p className="text-slate-400 text-xs mt-1">Please check back later or submit a general joining form.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {filteredVacancies.map((v) => {
                                    const isExpanded = expandedVacancy === v.id;
                                    return (
                                        <div
                                            key={v.id}
                                            className={`border rounded-xl transition-all duration-200 overflow-hidden ${
                                                isExpanded ? 'border-blue-500 shadow-sm' : 'border-slate-200 hover:border-slate-300'
                                            }`}
                                        >
                                            {/* Header summary info */}
                                            <div
                                                onClick={() => setExpandedVacancy(isExpanded ? null : v.id)}
                                                className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/50"
                                            >
                                                <div className="space-y-1">
                                                    <div className="flex items-center space-x-2">
                                                        <span className="text-sm font-extrabold text-slate-900">{v.title}</span>
                                                        <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-100">
                                                            {v.count} Openings
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
                                                        <span className="flex items-center"><MapPin size={12} className="mr-1" /> {v.siteName}</span>
                                                        <span className="flex items-center"><Clock size={12} className="mr-1" /> {v.type}</span>
                                                    </div>
                                                </div>
                                                <div className="text-slate-400">
                                                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                                </div>
                                            </div>

                                            {/* Expanded details */}
                                            {isExpanded && (
                                                <div className="px-4 pb-4 border-t border-slate-100 bg-slate-50/20 space-y-4 pt-3">
                                                    <div className="text-xs text-slate-600 leading-relaxed">
                                                        <p className="font-semibold text-slate-800 mb-1">Job Description:</p>
                                                        <p>{v.description}</p>
                                                    </div>

                                                    {v.requirements && v.requirements.length > 0 && (
                                                        <div className="text-xs text-slate-600">
                                                            <p className="font-semibold text-slate-800 mb-1">Requirements:</p>
                                                            <ul className="list-disc pl-4 space-y-1">
                                                                {v.requirements.map((req, idx) => (
                                                                    <li key={idx}>{req}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}

                                                    <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-3 border-slate-100">
                                                        <div className="flex items-center text-xs text-slate-500 font-semibold">
                                                            <DollarSign size={14} className="text-slate-400 mr-0.5" />
                                                            <span>Salary Range: </span>
                                                            <span className="text-slate-900 font-bold ml-1">{v.salaryRange || 'As per industry standards'}</span>
                                                        </div>
                                                        <button
                                                            onClick={() => handleApply(v)}
                                                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-1.5 rounded-lg text-xs transition-colors flex items-center shadow-xs"
                                                        >
                                                            Apply Now <ChevronRight size={14} className="ml-1" />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            </main>

            <PublicFooter />
        </div>
    );
};

export default CareersPage;

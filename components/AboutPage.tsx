import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PublicHeader from './common/PublicHeader';
import PublicFooter from './common/PublicFooter';
import { ShieldCheck, MapPin, Users, Award, Shield, CheckCircle, ArrowLeft } from 'lucide-react';
import { getWebsiteConfig, WebsiteServiceData } from '../src/services/websiteService';
import AdSenseUnit from './common/AdSenseUnit';
import SEOHead from '../src/components/common/SEOHead';

const AboutPage: React.FC = () => {
    const navigate = useNavigate();
    const [config, setConfig] = useState<WebsiteServiceData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        window.scrollTo(0, 0);

        const loadData = async () => {
            try {
                const data = await getWebsiteConfig();
                setConfig(data);
            } catch (err) {
                console.error("Failed to load about page config", err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

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
                title="About Us | Unique Delta Force Security"
                description="Learn about Unique Delta Force Pvt Ltd, a premier licensed security agency providing corporate guarding, executive protection, and facility security in India."
                canonicalUrl="https://udfonline.in/about"
            />
            <PublicHeader />
            <main className="flex-grow">

            {/* Page Header */}
            <div className="bg-slate-900 py-16 text-white text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-900 to-slate-900 opacity-90"></div>
                <div className="relative max-w-4xl mx-auto px-4">
                    <Shield className="h-12 w-12 text-blue-400 mx-auto mb-4" />
                    <h1 className="text-3xl md:text-4xl font-extrabold mb-2">About Our Organization</h1>
                    <p className="text-slate-300 text-sm max-w-lg mx-auto">
                        Learn about our mission, compliance standards, and our history of protecting communities.
                    </p>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 max-w-6xl mx-auto px-4 py-12 w-full">
                <button
                    onClick={() => navigate('/')}
                    className="mb-8 flex items-center text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors group"
                >
                    <ArrowLeft className="mr-1.5 h-4 w-4 transform group-hover:-translate-x-1 transition-transform" />
                    Back to Homepage
                </button>

                {/* Top Ad Unit */}
                <div className="my-6 max-w-6xl mx-auto">
                    <AdSenseUnit slot="5555555555" format="horizontal" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    {/* Left Column: Main Story */}
                    <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-8 shadow-xs space-y-6">
                        <span className="text-xs uppercase font-extrabold text-blue-600 tracking-widest bg-blue-50 px-3 py-1 rounded-md">
                            Corporate Profile
                        </span>
                        <h2 className="text-2xl font-bold text-slate-900 leading-tight">
                            {config?.aboutIntroTitle || 'Providing Security Guarding Services for Over a Decade'}
                        </h2>
                        <div className="text-sm text-slate-650 leading-relaxed space-y-4 font-semibold">
                            <p>
                                {config?.aboutStoryText1 || 'Unique Delta Force Pvt Ltd is a premier provider of customized security services across commercial, industrial, and software facilities. Established with a vision to deliver disciplined, reliable, and compliant protection schemes, we have grown to secure multiple branches and offices.'}
                            </p>
                            <p>
                                {config?.aboutStoryText2 || 'Our core strengths lie in our rigorous training academies, dynamic site audits, and complete alignment with statutory EPFO, ESIC, and state minimum wage regulations. We ensure that our officers are well-cared-for so that they can deliver exceptional service on the ground.'}
                            </p>
                        </div>

                        {/* Interactive Icons Section */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                            <div className="flex items-start space-x-3 p-3 rounded-xl hover:bg-slate-50 transition-all">
                                <ShieldCheck className="h-6 w-6 text-blue-600 flex-shrink-0" />
                                <div>
                                    <h4 className="text-xs font-bold text-slate-900">PSARA Compliant</h4>
                                    <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Fully licensed and compliant with national guarding acts.</p>
                                </div>
                            </div>
                            <div className="flex items-start space-x-3 p-3 rounded-xl hover:bg-slate-50 transition-all">
                                <Users className="h-6 w-6 text-blue-600 flex-shrink-0" />
                                <div>
                                    <h4 className="text-xs font-bold text-slate-900">Trained Personnel</h4>
                                    <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Every guard passes intensive training before deployment.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Statistics & Highlights */}
                    <div className="lg:col-span-5 space-y-6">
                        {/* Stats Card */}
                        <div className="bg-gradient-to-br from-blue-600 to-slate-950 text-white rounded-3xl p-8 shadow-md relative overflow-hidden flex flex-col justify-between min-h-[280px]">
                            <div className="absolute top-0 right-0 transform translate-x-1/4 -translate-y-1/4 opacity-10">
                                <ShieldCheck size={200} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold mb-4">Our Performance at a Glance</h3>
                                <p className="text-blue-100 text-xs leading-relaxed mb-6 font-semibold">
                                    We protect vital corporate facilities, tech parks, manufacturing units, and residential sites, ensuring complete transparency and peace of mind.
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-6 border-t border-blue-500/30 pt-6">
                                <div>
                                    <span className="text-3xl font-extrabold text-white block">
                                        {config?.aboutActiveOfficersCount ? `${config.aboutActiveOfficersCount.toLocaleString()}+` : '15,000+'}
                                    </span>
                                    <span className="text-[10px] text-blue-200 uppercase font-bold tracking-wider">Active Guards</span>
                                </div>
                                <div>
                                    <span className="text-3xl font-extrabold text-white block">
                                        {config?.aboutSecuredSitesCount ? `${config.aboutSecuredSitesCount.toLocaleString()}+` : '800+'}
                                    </span>
                                    <span className="text-[10px] text-blue-200 uppercase font-bold tracking-wider">Client Sites</span>
                                </div>
                            </div>
                        </div>

                        {/* Ad Unit side column */}
                        <div>
                            <AdSenseUnit slot="6666666666" format="rectangle" />
                        </div>
                    </div>

                </div>
            </div>

            </main>
            <PublicFooter />
        </div>
    );
};

export default AboutPage;

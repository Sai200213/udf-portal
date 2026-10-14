import React, { useEffect, useState } from 'react';
import PublicHeader from './common/PublicHeader';
import PublicFooter from './common/PublicFooter';
import { getWebsiteConfig, WebsiteServiceData } from '../src/services/websiteService';
import { Shield, Eye, Users, ShieldCheck, Award, Heart, CheckCircle2 } from 'lucide-react';
import AdSenseUnit from './common/AdSenseUnit';

const ServicesPage: React.FC = () => {
    const [config, setConfig] = useState<WebsiteServiceData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        document.title = "Our Security Services - Unique Delta Force";
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
            metaDesc.setAttribute('content', 'Explore Unique Delta Force guarding, surveillance, VIP escorting, and corporate campus safety management services.');
        }
        window.scrollTo(0, 0);

        const loadData = async () => {
            try {
                const data = await getWebsiteConfig();
                setConfig(data);
            } catch (err) {
                console.error("Failed to load services configuration", err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    // Helper to map string to Lucide React element
    const renderIcon = (iconName: string) => {
        switch (iconName) {
            case 'Shield':
                return <Shield className="h-8 w-8 text-blue-600" />;
            case 'Eye':
                return <Eye className="h-8 w-8 text-blue-600" />;
            case 'Users':
                return <Users className="h-8 w-8 text-blue-600" />;
            case 'ShieldCheck':
                return <ShieldCheck className="h-8 w-8 text-blue-600" />;
            case 'Award':
                return <Award className="h-8 w-8 text-blue-600" />;
            default:
                return <Shield className="h-8 w-8 text-blue-600" />;
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    const services = config?.services || [];

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <PublicHeader />

            {/* Banner Section */}
            <div className="bg-slate-900 py-20 text-white text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-900 to-slate-900 opacity-90"></div>
                <div className="relative max-w-4xl mx-auto px-4">
                    <span className="text-xs uppercase font-extrabold text-blue-400 tracking-widest bg-blue-500/10 px-3.5 py-1.5 rounded-full border border-blue-400/20">
                        Professional Security Solutions
                    </span>
                    <h1 className="text-4xl md:text-5xl font-black mt-4 mb-4 tracking-tight">Enterprise Protection Services</h1>
                    <p className="text-slate-300 text-base md:text-lg max-w-2xl mx-auto">
                        Delivering disciplined manned guarding, electronic CCTV surveillance, and secure gate management solutions tailored to client sites.
                    </p>
                </div>
            </div>

            {/* Services Grid Content */}
            <div className="flex-1 max-w-6xl mx-auto px-4 py-16 w-full">
                <div className="my-4 max-w-6xl mx-auto">
                    <AdSenseUnit slot="5555555555" format="horizontal" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
                    {services.map((service) => (
                        <div
                            key={service.id}
                            className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs hover:shadow-md hover:border-slate-300 transition-all duration-300 flex items-start space-x-5"
                        >
                            <div className="bg-blue-50 p-4 rounded-2xl flex-shrink-0">
                                {renderIcon(service.icon)}
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 mb-2">{service.title}</h3>
                                <p className="text-slate-600 text-sm leading-relaxed">{service.description}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Additional Company Strengths / Quality Pledge */}
                <div className="bg-gradient-to-br from-slate-900 to-blue-950 text-white rounded-3xl p-10 shadow-lg mt-16 relative overflow-hidden">
                    <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-1 border-r border-white/10 pr-4 flex flex-col justify-center">
                            <h3 className="text-2xl font-black mb-3">Our Operations & Service Pledge</h3>
                            <p className="text-slate-300 text-xs leading-relaxed">
                                Unique Delta Force is license-compliant with PSARA requirements, maintaining fully audited logs of guards deployed on rosters.
                            </p>
                        </div>
                        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="flex items-start space-x-3">
                                <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                                <div>
                                    <h4 className="font-bold text-sm text-slate-100 mb-1">Double Duty Supervisors</h4>
                                    <p className="text-xs text-slate-400">Regular site inspections by security officers and supervisors to audit guards alertness and check logs.</p>
                                </div>
                            </div>
                            <div className="flex items-start space-x-3">
                                <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                                <div>
                                    <h4 className="font-bold text-sm text-slate-100 mb-1">ESI & Medical Cover</h4>
                                    <p className="text-xs text-slate-400">Every guard is medically insured via ESIC, guaranteeing legal welfare and safety compliance at site.</p>
                                </div>
                            </div>
                            <div className="flex items-start space-x-3">
                                <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                                <div>
                                    <h4 className="font-bold text-sm text-slate-100 mb-1">24/7 Operations Control</h4>
                                    <p className="text-xs text-slate-400">Central control operations desk setup to handle SOS triggers, emergency replacements, and client complaints.</p>
                                </div>
                            </div>
                            <div className="flex items-start space-x-3">
                                <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                                <div>
                                    <h4 className="font-bold text-sm text-slate-100 mb-1">Regular Training Programs</h4>
                                    <p className="text-xs text-slate-400">Drills covering emergency fire defense response, gate registration protocols, and first aid assistance.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <PublicFooter />
        </div>
    );
};

export default ServicesPage;

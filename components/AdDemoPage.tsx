import React from 'react';
import PublicHeader from './common/PublicHeader';
import PublicFooter from './common/PublicFooter';
import SEOHead from '../src/components/common/SEOHead';
import { 
    Monitor, 
    Smartphone, 
    ShieldCheck, 
    Sparkles, 
    CheckCircle2,
    Lock
} from 'lucide-react';
import AdSenseUnit from './common/AdSenseUnit';

const AdDemoPage: React.FC = () => {
    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
            <SEOHead 
                title="Google AdSense Brand Safety & Monetization Showcase | UDF Online" 
                description="Google AdSense ad unit layout preview and brand safety standards for Unique Delta Force Pvt Ltd."
                canonicalUrl="https://udfonline.in/ad-demo"
            />
            <PublicHeader />

            <div className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
                
                {/* Hero Header */}
                <div className="text-center max-w-3xl mx-auto mb-12">
                    <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-4">
                        <Sparkles size={14} />
                        <span>Google AdSense Authorized Layout &amp; Brand Safety</span>
                    </div>
                    <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-4">
                        Google AdSense Monetization Preview
                    </h1>
                    <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
                        Official preview of high-quality, verified <strong>Google AdSense</strong> ad unit placements and brand safety compliance standards for Unique Delta Force Pvt Ltd.
                    </p>
                </div>

                {/* Grid of Ad Format Demonstrations */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">

                    {/* 1. Google AdSense Responsive Banner */}
                    <div className="bg-slate-800/60 border border-slate-700/80 rounded-3xl p-6 flex flex-col justify-between hover:border-amber-500/40 transition-all group">
                        <div>
                            <div className="flex justify-between items-start mb-4">
                                <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-[10px] uppercase font-bold tracking-wider border border-amber-500/20">
                                    Google AdSense &bull; Responsive Display
                                </span>
                                <Monitor size={18} className="text-amber-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2 group-hover:text-amber-400 transition-colors">
                                1. Display Banner Unit
                            </h3>
                            <p className="text-xs text-slate-400 leading-relaxed mb-4">
                                Responsive auto-scaling banner ad unit. Automatically adapts to mobile screens, tablets, and desktop displays.
                            </p>
                            <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-700/50 text-[11px] text-slate-300 font-mono space-y-1">
                                <div>Publisher ID: ca-pub-4069971667046129</div>
                                <div>Ad Format: Auto Responsive</div>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-700/60">
                            <AdSenseUnit slot="1111111111" format="auto" />
                        </div>
                    </div>

                    {/* 2. Google AdSense In-Article Native */}
                    <div className="bg-slate-800/60 border border-slate-700/80 rounded-3xl p-6 flex flex-col justify-between hover:border-amber-500/40 transition-all group">
                        <div>
                            <div className="flex justify-between items-start mb-4">
                                <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-[10px] uppercase font-bold tracking-wider border border-amber-500/20">
                                    Google AdSense &bull; In-Article Native
                                </span>
                                <Smartphone size={18} className="text-amber-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2 group-hover:text-amber-400 transition-colors">
                                2. Native In-Article Unit
                            </h3>
                            <p className="text-xs text-slate-400 leading-relaxed mb-4">
                                Blends seamlessly into blog article content matching font styles, paragraph line height, and color themes.
                            </p>
                            <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-700/50 text-[11px] text-slate-300 font-mono space-y-1">
                                <div>Publisher ID: ca-pub-4069971667046129</div>
                                <div>Ad Format: In-Article Native</div>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-700/60">
                            <AdSenseUnit slot="3333333333" format="auto" />
                        </div>
                    </div>

                    {/* 3. Brand Safety Guarantee */}
                    <div className="bg-slate-800/60 border border-slate-700/80 rounded-3xl p-6 flex flex-col justify-between hover:border-blue-500/40 transition-all group">
                        <div>
                            <div className="flex justify-between items-start mb-4">
                                <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-[10px] uppercase font-bold tracking-wider border border-blue-500/20">
                                    Google Brand Safety &bull; Verified
                                </span>
                                <Lock size={18} className="text-blue-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">
                                3. Clean Corporate Guarantee
                            </h3>
                            <p className="text-xs text-slate-400 leading-relaxed mb-4">
                                Only verified global brands (banks, technology, corporate services) are served. Zero popups, zero redirects, zero low-quality ads.
                            </p>
                            <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-700/50 text-xs text-slate-300 space-y-2">
                                <div className="flex items-center text-blue-400 font-semibold text-[11px]">
                                    <CheckCircle2 size={14} className="mr-1.5" /> 100% Brand Safe &amp; Clean
                                </div>
                                <div className="flex items-center text-blue-400 font-semibold text-[11px]">
                                    <CheckCircle2 size={14} className="mr-1.5" /> Zero Popups / Zero Redirects
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Brand Safety Commitment */}
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-3xl p-8 max-w-4xl mx-auto">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center space-x-2">
                        <ShieldCheck className="text-blue-400" size={20} />
                        <span>Google AdSense Compliance Statement</span>
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        Unique Delta Force Pvt Ltd adheres strictly to Google Publisher Policies. All ad slots on our recruitment portal and knowledge base are configured using standard Google AdSense tags (`ca-pub-4069971667046129`) with zero intrusive ad formats.
                    </p>
                </div>

            </div>

            <PublicFooter />
        </div>
    );
};

export default AdDemoPage;

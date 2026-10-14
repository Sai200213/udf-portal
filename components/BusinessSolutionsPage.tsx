import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Shield, 
    Eye, 
    Users, 
    PawPrint, 
    Car, 
    Calendar, 
    Cpu, 
    Download, 
    Award, 
    ShieldCheck, 
    ArrowRight, 
    Building, 
    Phone, 
    Mail, 
    Clock,
    MapPin,
    CheckCircle2
} from 'lucide-react';
import PublicHeader from './common/PublicHeader';
import PublicFooter from './common/PublicFooter';
import { getWebsiteConfig, WebsiteServiceData } from '../src/services/websiteService';
import SEOHead from '../src/components/common/SEOHead';

const BusinessSolutionsPage: React.FC = () => {
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
                console.error("Failed to load business solutions config", err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const servicesList = [
        {
            title: "Manned Guarding & Perimeter Security",
            description: "Disciplined, physical patrolling and access control managed by certified security personnel. Standard guard deployment across factory gates, corporate offices, and software campuses.",
            icon: <Shield className="h-8 w-8 text-blue-600" />
        },
        {
            title: "CCTV Monitoring & Alarm Response",
            description: "Surveillance systems integrated with our 24x7 centralized monitoring center. Offers a rapid response vehicle mobilization guarantee within 15 to 30 minutes of alarm triggers.",
            icon: <Eye className="h-8 w-8 text-blue-600" />
        },
        {
            title: "VIP Executive Protection",
            description: "Specialized close protection personnel trained in combat defense, MMA, and emergency evacuation drills to safeguard high-profile executives and transit operations.",
            icon: <Users className="h-8 w-8 text-blue-600" />
        },
        {
            title: "Certified K9 Canine Squad",
            description: "Certified sniffer and perimeter security dogs (German Shepherds, Rottweilers) handled by experienced handlers under strict animal care and welfare compliance.",
            icon: <PawPrint className="h-8 w-8 text-blue-600" />
        },
        {
            title: "Escort Marshall Services",
            description: "Tailored transport protection for IT/ITES organizations, including certified cab and bus marshalls safeguarding female staff working late-night shifts.",
            icon: <Car className="h-8 w-8 text-blue-600" />
        },
        {
            title: "Corporate Event & Crowd Management",
            description: "Trained bouncers, static guarding, crowd control barriers, and metal detection/baggage screening setups for corporate meetings, concerts, and public exhibitions.",
            icon: <Calendar className="h-8 w-8 text-blue-600" />
        },
        {
            title: "Drone & Tech-Enabled Patrols",
            description: "Modern, airborne surveillance solutions providing comprehensive perimeter monitoring for large industrial sites, integrated with GPS checks.",
            icon: <Cpu className="h-8 w-8 text-blue-600" />
        }
    ];

    const certificationsList = [
        { name: "ISO 9001:2015", desc: "Quality Management System" },
        { name: "ISO/IEC 27001:2013", desc: "Information Security Management" },
        { name: "OHSAS 18001:2007", desc: "Occupational Health & Safety" },
        { name: "ISO 26000:2010", desc: "Social Responsibility Guidelines" },
        { name: "ISO 14001:2015", desc: "Environmental Management" },
        { name: "ISO 18788:2018", desc: "Security Operations Management" }
    ];

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <PublicHeader />

            {/* Corporate Banner Section */}
            <div className="relative bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white py-20 overflow-hidden">
                <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:32px_32px]"></div>
                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center">
                    <span className="text-xs uppercase font-extrabold text-blue-400 tracking-widest bg-blue-500/10 px-4 py-1.5 rounded-full border border-blue-400/20 mb-4 inline-block">
                        Enterprise Solutions
                    </span>
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-black mb-4 tracking-tight leading-tight max-w-4xl">
                        Premium B2B Security Services & Systems
                    </h1>
                    <p className="text-slate-300 text-sm sm:text-base md:text-lg max-w-2xl mx-auto mb-8 font-medium leading-relaxed">
                        Trusted security guarding, advanced drone surveillance, rapid response centers, and complete statutory compliance for commercial properties.
                    </p>
                    
                    {/* Action buttons */}
                    <div className="flex flex-col sm:flex-row gap-4">
                        <a 
                            href="/UDF_Brochure.pdf" 
                            download 
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-8 rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2 hover:shadow-blue-500/20"
                        >
                            <Download size={16} /> Download Corporate Brochure
                        </a>
                        <button 
                            onClick={() => {
                                const el = document.getElementById('proposal-form');
                                if (el) el.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold py-3.5 px-8 rounded-xl text-sm transition-all"
                        >
                            Request Proposal
                        </button>
                    </div>
                </div>
            </div>

            {/* Scale Stats row */}
            <div className="bg-white border-b border-slate-200 py-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                        <div className="border-r border-slate-100 last:border-0">
                            <span className="text-3xl font-black text-blue-600 block">2004</span>
                            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-extrabold">Established Year</span>
                        </div>
                        <div className="border-r border-slate-100 last:border-0">
                            <span className="text-3xl font-black text-blue-600 block">15,000+</span>
                            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-extrabold">Active Force</span>
                        </div>
                        <div className="border-r border-slate-100 last:border-0">
                            <span className="text-3xl font-black text-blue-600 block">450+</span>
                            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-extrabold">Corporate Clients</span>
                        </div>
                        <div>
                            <span className="text-3xl font-black text-blue-600 block">800+</span>
                            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-extrabold">Sites Secured</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Services Showcase */}
            <section className="py-20 bg-slate-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <span className="text-xs uppercase font-extrabold text-blue-600 tracking-widest bg-blue-50 px-3 py-1 rounded-md">
                            Operational Capabilities
                        </span>
                        <h2 className="text-3xl font-black text-slate-900 mt-4">Enterprise Services Menu</h2>
                        <p className="text-slate-500 text-sm max-w-xl mx-auto mt-2 font-medium">
                            Explore our comprehensive list of physical guarding and technology-enabled security solutions.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {servicesList.map((service, index) => (
                            <div 
                                key={index} 
                                className="bg-white rounded-2xl border border-slate-200 p-8 hover:shadow-md transition-shadow flex flex-col"
                            >
                                <div className="bg-blue-50 p-4 rounded-2xl w-14 h-14 flex items-center justify-center mb-6">
                                    {service.icon}
                                </div>
                                <h3 className="text-base font-extrabold text-slate-950 mb-3">{service.title}</h3>
                                <p className="text-slate-600 text-xs leading-relaxed font-medium">{service.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Certifications Grid */}
            <section className="py-20 bg-white border-y border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                        <div className="lg:col-span-5">
                            <span className="text-xs uppercase font-extrabold text-blue-600 tracking-widest bg-blue-50 px-3 py-1 rounded-md">
                                Quality & Compliance
                            </span>
                            <h2 className="text-3xl font-black text-slate-900 mt-4 mb-6 leading-tight">
                                Globally Standardized Security Operations
                            </h2>
                            <p className="text-slate-600 leading-relaxed text-sm mb-6 font-medium">
                                Unique Delta Force is fully compliant with PSARA regulation acts, EPFO, and ESIC. Our business processes are audit-tested and certified by global systems to guarantee health, safety, and security.
                            </p>
                            <div className="space-y-3.5">
                                <div className="flex items-start space-x-3 text-xs text-slate-600 font-bold">
                                    <CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
                                    <span>Complete legal EPFO / ESIC filings for all guarding ranks</span>
                                </div>
                                <div className="flex items-start space-x-3 text-xs text-slate-600 font-bold">
                                    <CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
                                    <span>Strict compliance with state minimum wage schedules</span>
                                </div>
                                <div className="flex items-start space-x-3 text-xs text-slate-600 font-bold">
                                    <CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
                                    <span>Active PSARA license valid across all Telangana branches</span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {certificationsList.map((cert, index) => (
                                <div key={index} className="bg-slate-50 border border-slate-200 p-5 rounded-2xl flex items-start space-x-4">
                                    <div className="bg-white p-2 rounded-xl border border-slate-200 text-blue-600 shadow-2xs">
                                        <Award size={20} />
                                    </div>
                                    <div>
                                        <h4 className="font-extrabold text-sm text-slate-950">{cert.name}</h4>
                                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mt-0.5">{cert.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Training Academy Section */}
            <section className="py-20 bg-slate-50">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="bg-gradient-to-br from-blue-900 to-slate-950 text-white rounded-3xl p-8 md:p-12 shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 transform translate-x-1/4 -translate-y-1/4 opacity-10">
                            <ShieldCheck size={400} />
                        </div>
                        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                            <div className="lg:col-span-7">
                                <span className="text-xs uppercase font-extrabold text-blue-400 tracking-widest bg-blue-500/10 px-3 py-1 rounded-md border border-blue-400/20">
                                    Delta Security Academy
                                </span>
                                <h3 className="text-2xl md:text-3xl font-black mt-4 mb-4">5-Acre In-House Training Academy</h3>
                                <p className="text-blue-100 text-sm leading-relaxed mb-6 font-semibold">
                                    Our guards are physically ready and tactfully trained. The Delta academy has digital classrooms, a firefighting practice rig, obstacle tracks, a swimming pool, and a driving track to train guards in emergency services, martial arts, and rescue procedures.
                                </p>
                            </div>
                            <div className="lg:col-span-5 bg-white/10 backdrop-blur-xs p-6 rounded-2xl border border-white/10 space-y-4">
                                <h4 className="font-bold text-sm">Course Modules Included:</h4>
                                <ul className="space-y-2 text-xs text-blue-100 font-bold">
                                    <li className="flex items-center"><ArrowRight size={12} className="mr-2 text-blue-400" /> Physical fitness & combat defense</li>
                                    <li className="flex items-center"><ArrowRight size={12} className="mr-2 text-blue-400" /> Fire prevention & evacuation drills</li>
                                    <li className="flex items-center"><ArrowRight size={12} className="mr-2 text-blue-400" /> Gate register & software entry systems</li>
                                    <li className="flex items-center"><ArrowRight size={12} className="mr-2 text-blue-400" /> VIP protocol & situational awareness</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Proposal Request Block */}
            <section id="proposal-form" className="py-20 bg-white border-t border-slate-200">
                <div className="max-w-4xl mx-auto px-4">
                    <div className="text-center mb-12">
                        <span className="text-xs uppercase font-extrabold text-blue-600 tracking-widest bg-blue-50 px-3 py-1 rounded-md">
                            Proposal Request
                        </span>
                        <h2 className="text-3xl font-black text-slate-900 mt-4">Get a Service Quote</h2>
                        <p className="text-slate-500 text-sm max-w-xl mx-auto mt-2 font-medium">
                            Fill out details about your commercial facilities or site layout to receive a vulnerability audit report and deployment plan from our operations manager.
                        </p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 p-8 rounded-3xl grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                        <div>
                            <h3 className="font-bold text-lg text-slate-950 mb-4">Contact Business Office</h3>
                            <p className="text-xs text-slate-500 leading-relaxed mb-6 font-medium">
                                Speak directly with our business development representatives. We can schedule a physical site visit to inspect security locks, perimeters, and CCTV coverage gaps.
                            </p>
                            <ul className="space-y-4 text-xs font-semibold text-slate-700">
                                <li className="flex items-center">
                                    <MapPin size={16} className="mr-3 text-blue-600 flex-shrink-0" />
                                    <span>{config?.contactAddress || 'Madhapur, Hyderabad, Telangana - 500081'}</span>
                                </li>
                                <li className="flex items-center">
                                    <Phone size={16} className="mr-3 text-blue-600 flex-shrink-0" />
                                    <span>{config?.contactPhone || '+91 98765 43210'}</span>
                                </li>
                                <li className="flex items-center">
                                    <Mail size={16} className="mr-3 text-blue-600 flex-shrink-0" />
                                    <span>{config?.contactEmail || 'info@udfonline.in'}</span>
                                </li>
                                <li className="flex items-center">
                                    <Clock size={16} className="mr-3 text-blue-600 flex-shrink-0" />
                                    <span>Mon - Sat: {config?.contactHoursWeekdays || '9:00 AM - 6:00 PM'}</span>
                                </li>
                            </ul>
                        </div>

                        <form className="space-y-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs" onSubmit={(e) => { e.preventDefault(); alert('Proposal request sent successfully! Our representative will call you shortly.'); }}>
                            <div>
                                <label className="block text-[10px] uppercase font-extrabold tracking-wider text-slate-500 mb-1.5">Company Name</label>
                                <input required type="text" placeholder="e.g. Acme Tech Park" className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white" />
                            </div>
                            <div>
                                <label className="block text-[10px] uppercase font-extrabold tracking-wider text-slate-500 mb-1.5">Contact Name & Phone</label>
                                <input required type="text" placeholder="e.g. Ramesh Kumar (+91 90000 00000)" className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white" />
                            </div>
                            <div>
                                <label className="block text-[10px] uppercase font-extrabold tracking-wider text-slate-500 mb-1.5">Required Guards / Tech Scope</label>
                                <textarea required rows={3} placeholder="Briefly describe your requirements (e.g. 5 guards, shift timings, drone patrols)..." className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"></textarea>
                            </div>
                            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs transition-colors shadow-sm">
                                Submit Quote Request
                            </button>
                        </form>
                    </div>
                </div>
            </section>

            <PublicFooter />
        </div>
    );
};

export default BusinessSolutionsPage;

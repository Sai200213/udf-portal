import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    ExternalLink, 
    MapPin, 
    Briefcase, 
    Users, 
    ArrowRight, 
    Building, 
    Phone, 
    ChevronDown, 
    ChevronUp, 
    ChevronRight,
    BookOpen, 
    X,
    Clock,
    Shield,
    Eye,
    ShieldCheck,
    Award
} from 'lucide-react';
import AdSenseUnit from './common/AdSenseUnit';
import PublicHeader from './common/PublicHeader';
import { sanitizeHtml } from '../src/utils/sanitizeHtml';
import PublicFooter from './common/PublicFooter';
import SEOHead from '../src/components/common/SEOHead';

import { getBlogPosts, BlogPost } from '../src/services/blogService';
import { getWebsiteConfig, WebsiteServiceData } from '../src/services/websiteService';
import { getOpenVacancies } from '../src/services/vacancyService';
import { Vacancy } from '../types';

const getFormattedImageUrl = (url?: string) => {
    if (!url) return '';
    const trimmed = url.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
        return trimmed;
    }
    return `/${trimmed}`;
};

const BlogPage: React.FC = () => {
    const navigate = useNavigate();
    const [posts, setPosts] = useState<BlogPost[]>([]);
    const [config, setConfig] = useState<WebsiteServiceData | null>(null);
    const [vacancies, setVacancies] = useState<Vacancy[]>([]);
    const [expandedRole, setExpandedRole] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
    const [openFaq, setOpenFaq] = useState<number | null>(null);
    const modalRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (selectedPost && modalRef.current) {
            const timer = setTimeout(() => {
                if (modalRef.current) {
                    modalRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                }
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [selectedPost]);



    useEffect(() => {
         document.title = "Welcome to Unique Delta Force Pvt Ltd";
         const metaDesc = document.querySelector('meta[name="description"]');
         if (metaDesc) {
             metaDesc.setAttribute('content', 'Unique Delta Force Pvt Ltd — Premier security services across Telangana. Trusted by corporates, factories, and residential societies.');
         }
 
         window.scrollTo(0, 0);
         loadData();
     }, []);

    const loadData = async () => {
        try {
            const [postsData, configData, vacancyData] = await Promise.all([
                getBlogPosts(),
                getWebsiteConfig(),
                getOpenVacancies()
            ]);
            setPosts(postsData);
            setConfig(configData);
            setVacancies(vacancyData);
        } catch (err) {
            console.error("Failed to load homepage data", err);
        } finally {
            setLoading(false);
        }
    };

    const groupedVacancies = React.useMemo(() => {
        const groups: { [key: string]: Vacancy[] } = {};
        vacancies.forEach(v => {
            if (!groups[v.title]) groups[v.title] = [];
            groups[v.title].push(v);
        });
        return groups;
    }, [vacancies]);

    const toggleRole = (role: string) => {
        setExpandedRole(expandedRole === role ? null : role);
    };

    const handleApply = (vacancy: Vacancy) => {
        navigate(`/join?siteId=${vacancy.siteId}&role=${encodeURIComponent(vacancy.title)}`);
    };



    const renderIcon = (iconName: string) => {
        switch (iconName) {
            case 'Shield':
                return <Shield className="h-7 w-7 text-blue-600" />;
            case 'Eye':
                return <Eye className="h-7 w-7 text-blue-600" />;
            case 'Users':
                return <Users className="h-7 w-7 text-blue-600" />;
            case 'ShieldCheck':
                return <ShieldCheck className="h-7 w-7 text-blue-600" />;
            case 'Award':
                return <Award className="h-7 w-7 text-blue-600" />;
            default:
                return <Shield className="h-7 w-7 text-blue-600" />;
        }
    };

    const toggleFaq = (index: number) => {
        setOpenFaq(openFaq === index ? null : index);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    const recentPosts = posts.slice(0, 3);
    const services = config?.services || [];

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <SEOHead
                title="Unique Delta Force Pvt Ltd | Security Services & HR Management Portal"
                description="Unique Delta Force Pvt Ltd (UDF) — Premier security services provider in India. Guard manpower solutions, corporate security, and HR portal."
                canonicalUrl="https://udfonline.in/"
            />
            <PublicHeader />
            <main className="flex-1">

            {/* Hero & Welcome Screen Section */}
            <div className="relative bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white overflow-hidden py-16 lg:py-24">
                <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:32px_32px]"></div>
                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
                    
                    {/* Header welcome banner */}
                    <div className="text-center max-w-4xl mb-12">
                        <span className="text-xs uppercase font-extrabold text-blue-400 tracking-widest bg-blue-500/10 px-4 py-1.5 rounded-full border border-blue-400/20 mb-4 inline-block">
                            Premier Security Services Across India
                        </span>

                        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight mt-3 mb-4 drop-shadow-sm leading-tight">
                            Welcome to <span className="text-blue-400">Unique Delta Force</span> Pvt Ltd
                        </h1>
                        <p className="text-slate-300 text-base md:text-lg font-medium leading-relaxed max-w-3xl mx-auto">
                            Trusted by corporates, factories, and residential societies for disciplined personnel, statutory compliance, and round-the-clock protection.
                        </p>
                    </div>



                    {/* Stats Widget overlay */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-3xl border-t border-white/10 pt-8 mt-4 text-center">
                        <div>
                            <span className="text-3xl md:text-4xl font-black text-blue-400 block">
                                {config?.aboutActiveOfficersCount ? `${config.aboutActiveOfficersCount.toLocaleString()}+` : '15,000+'}
                            </span>
                            <span className="text-xs md:text-sm text-slate-400 font-bold uppercase tracking-wider">Active Employees</span>
                        </div>
                        <div>
                            <span className="text-3xl md:text-4xl font-black text-blue-400 block">
                                {config?.aboutSecuredSitesCount ? `${config.aboutSecuredSitesCount.toLocaleString()}+` : '800+'}
                            </span>
                            <span className="text-xs md:text-sm text-slate-400 font-bold uppercase tracking-wider">Client Sites</span>
                        </div>
                    </div>

                </div>
            </div>

            {/* Ad Space */}
            <div className="my-8 max-w-6xl mx-auto px-4 w-full">
                <AdSenseUnit slot="1111111111" format="horizontal" />
            </div>

            {/* About Us Section */}
            <section id="about" className="py-20 bg-white border-b border-slate-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                        <div>
                            <span className="text-xs uppercase font-extrabold text-blue-600 tracking-widest bg-blue-50 px-3 py-1 rounded-md">
                                Corporate Profile
                            </span>
                            <h2 className="text-3xl font-bold text-slate-900 mt-4 mb-6 leading-tight">
                                {config?.aboutIntroTitle || 'Providing Security Guarding Services for Over a Decade'}
                            </h2>
                            <p className="text-slate-600 leading-relaxed mb-4 text-sm font-medium">
                                {config?.aboutStoryText1}
                            </p>
                            <p className="text-slate-600 leading-relaxed text-sm">
                                {config?.aboutStoryText2}
                            </p>
                        </div>
                        <div className="bg-gradient-to-br from-blue-600 to-slate-900 text-white rounded-3xl p-10 shadow-lg relative overflow-hidden flex flex-col justify-between min-h-[350px]">
                            <div className="absolute top-0 right-0 transform translate-x-1/4 -translate-y-1/4 opacity-10">
                                <ShieldCheck size={400} />
                            </div>
                            <div>
                                <Shield className="h-12 w-12 text-blue-400 mb-6" />
                                <h3 className="text-2xl font-bold mb-4">Complete Compliance</h3>
                                <p className="text-blue-100 text-sm leading-relaxed mb-6 font-semibold">
                                    We are fully compliant with PSARA licensing regulations, EPFO contributions, ESIC medical registers, and state minimum wage mandates.
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-6 border-t border-blue-500/30 pt-6">
                                <div>
                                    <span className="text-3xl font-extrabold text-white block">
                                        {config?.aboutActiveOfficersCount ? `${config.aboutActiveOfficersCount.toLocaleString()}+` : '15,000+'}
                                    </span>
                                    <span className="text-xs text-blue-200">Active Employees</span>
                                </div>
                                <div>
                                    <span className="text-3xl font-extrabold text-white block">
                                        {config?.aboutSecuredSitesCount ? `${config.aboutSecuredSitesCount.toLocaleString()}+` : '800+'}
                                    </span>
                                    <span className="text-xs text-blue-200">Secured Locations</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>



            {/* Recent Blogs Section */}
            <section id="blogs" className="py-20 bg-white border-b border-slate-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-12">
                        <div>
                            <span className="text-xs uppercase font-extrabold text-blue-600 tracking-widest bg-blue-50 px-3.5 py-1 rounded-md">
                                Knowledge Base
                            </span>
                            <h2 className="text-3xl font-black text-slate-900 mt-4">Recent Updates & Security Guides</h2>
                        </div>
                        <button
                            onClick={() => navigate('/blogs')}
                            className="mt-4 sm:mt-0 text-blue-600 hover:text-blue-800 font-bold text-sm flex items-center transition-colors group"
                        >
                            Read All Articles 
                            <ChevronRight className="ml-1.5 h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>

                    {recentPosts.length === 0 ? (
                        <p className="text-slate-400 text-sm text-center py-8">No articles published yet.</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {recentPosts.map(post => (
                                <div
                                    key={post.id}
                                    onClick={() => setSelectedPost(post)}
                                    className="bg-slate-50 rounded-2xl border border-slate-200 p-6 hover:shadow-md hover:border-slate-300 transition-all duration-300 cursor-pointer flex flex-col justify-between"
                                >
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-xs font-extrabold uppercase tracking-wider text-blue-700 bg-blue-100/60 px-2 py-0.5 rounded-md">
                                                {post.category}
                                            </span>
                                            <span className="text-xs text-slate-600 font-semibold">{post.date}</span>
                                        </div>
                                        <h3 className="text-base font-bold text-slate-900 line-clamp-2 mb-2">
                                            {post.title}
                                        </h3>
                                        <p className="text-slate-500 text-xs leading-relaxed line-clamp-3 mb-4">
                                            {post.excerpt}
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-between pt-3 border-t border-slate-200/50 text-xs text-slate-600 font-bold mt-auto">
                                        <span className="flex items-center"><Clock size={12} className="mr-1" /> {post.readTime}</span>
                                        <span className="text-blue-600 flex items-center">Read Post <ArrowRight size={12} className="ml-1" /></span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* Why Join Section */}
            <section id="benefits" className="py-20 bg-slate-50 border-b border-slate-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <span className="text-xs uppercase font-extrabold text-blue-600 tracking-widest bg-blue-50 px-3.5 py-1 rounded-md">
                            Employment & Benefits
                        </span>
                        <h2 className="text-3xl font-black text-slate-900 mt-4">Why Join Unique Delta Force?</h2>
                        <p className="text-slate-500 text-base max-w-xl mx-auto mt-2">
                            We value our security officers. We offer timely salary deposits, proper statutory registrations, and safe assignments.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {[
                            {
                                icon: <ShieldCheck className="h-8 w-8 text-blue-600" />,
                                title: "PF & ESI Registers",
                                description: "Every on-duty guard receives standard Provident Fund and ESIC medical insurance registrations."
                            },
                            {
                                icon: <Award className="h-8 w-8 text-green-600" />,
                                title: "On-Time Payouts",
                                description: "We guarantee monthly salary credit straight to bank accounts by the 7th of every month."
                            },
                            {
                                icon: <Users className="h-8 w-8 text-purple-600" />,
                                title: "Career Growth",
                                description: "Clear pathways from Guard to Head Guard, Site Supervisor, and Operations Inspector."
                            },
                            {
                                icon: <MapPin className="h-8 w-8 text-red-600" />,
                                title: "Location Preference",
                                description: "Select from our various client tech parks, offices, and factories close to your home."
                            }
                        ].map((benefit, index) => (
                            <div key={index} className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 hover:shadow-md transition-shadow">
                                <div className="bg-slate-50 rounded-xl w-14 h-14 flex items-center justify-center mb-5">
                                    {benefit.icon}
                                </div>
                                <h3 className="text-base font-extrabold text-slate-950 mb-2">{benefit.title}</h3>
                                <p className="text-slate-600 text-sm leading-relaxed">{benefit.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Quick Vacancies / Openings Section */}
            <section id="vacancies" className="py-20 bg-white border-b border-slate-100">
                <div className="max-w-5xl mx-auto px-4">
                    <div className="text-center mb-12">
                        <span className="text-xs uppercase font-extrabold text-blue-600 tracking-widest bg-blue-50 px-3.5 py-1 rounded-md">
                            Immediate Openings
                        </span>
                        <h2 className="text-3xl font-black text-slate-900 mt-4 font-sans">Quick Vacancies</h2>
                        <p className="text-slate-500 text-sm max-w-xl mx-auto mt-2">
                            Explore active security guard, supervisor, and patrol officer positions across our branches. Click to expand locations and apply directly.
                        </p>
                    </div>

                    <div className="space-y-4">
                        {Object.keys(groupedVacancies).length === 0 ? (
                            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
                                <Briefcase className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                                <h3 className="text-sm font-bold text-slate-900">No Active Vacancies</h3>
                                <p className="text-xs text-slate-500 mt-1">We are currently fully staffed. Check back soon for new opportunities!</p>
                            </div>
                        ) : (
                            Object.entries(groupedVacancies).map(([title, roleVacancies]: [string, Vacancy[]]) => (
                                <div key={title} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                    {/* Accordion Header */}
                                    <div
                                        className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-colors"
                                        onClick={() => toggleRole(title)}
                                    >
                                        <div className="flex items-center space-x-4">
                                            <div className="bg-blue-50 p-2.5 rounded-xl">
                                                <Briefcase className="text-blue-600 h-5 w-5" />
                                            </div>
                                            <div>
                                                <h3 className="text-base font-bold text-slate-900">{title}</h3>
                                                <p className="text-xs text-slate-500 font-medium">{roleVacancies.length} active site(s) hiring</p>
                                            </div>
                                        </div>
                                        <div className="text-slate-400">
                                            {expandedRole === title ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                        </div>
                                    </div>

                                    {/* Accordion Content */}
                                    {expandedRole === title && (
                                        <div className="bg-slate-50/50 border-t border-slate-100 p-5 space-y-4">
                                            {roleVacancies.map(vacancy => (
                                                <div key={vacancy.id} className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                                                    <div className="flex-1">
                                                        <div className="flex items-center space-x-2 mb-1">
                                                            <h4 className="font-bold text-sm text-slate-900">{vacancy.siteName}</h4>
                                                            <span className="px-2 py-0.5 bg-green-50 text-green-700 text-[10px] font-extrabold rounded-full uppercase border border-green-200">{vacancy.type}</span>
                                                        </div>

                                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                                                            <span className="flex items-center"><MapPin size={12} className="mr-1 text-slate-400" /> {vacancy.location}</span>
                                                            <span className="flex items-center"><Briefcase size={12} className="mr-1 text-slate-400" /> Salary: ₹{vacancy.salaryRange}</span>
                                                        </div>
                                                        {vacancy.description && (
                                                            <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">{vacancy.description}</p>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        {vacancy.googleMapsLink && (
                                                            <a
                                                                href={vacancy.googleMapsLink}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="p-2 text-slate-500 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 rounded-xl transition-colors"
                                                                title="View on Maps"
                                                            >
                                                                <MapPin size={18} />
                                                            </a>
                                                        )}
                                                        {vacancy.contactNumber && (
                                                            <a
                                                                href={`tel:${vacancy.contactNumber}`}
                                                                className="p-2 text-slate-500 hover:text-green-600 bg-slate-100 hover:bg-green-50 rounded-xl transition-colors"
                                                                title="Call Site"
                                                            >
                                                                <Phone size={18} />
                                                            </a>
                                                        )}
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleApply(vacancy); }}
                                                            className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-1"
                                                        >
                                                            Apply Now <ChevronRight size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </section>

            {/* FAQ Section */}
            <section id="faq" className="py-20 bg-slate-50">
                <div className="max-w-4xl mx-auto px-4">
                    <div className="text-center mb-16">
                        <span className="text-xs uppercase font-extrabold text-blue-600 tracking-widest bg-blue-50 px-3.5 py-1 rounded-md">
                            Common Inquiries
                        </span>
                        <h2 className="text-3xl font-black text-slate-900 mt-4">Frequently Asked Questions</h2>
                    </div>

                    <div className="space-y-4">
                        {[
                            {
                                q: "What documents are required to join the force?",
                                a: (
                                    <ul className="list-disc pl-5 space-y-1.5 text-slate-600 text-sm">
                                        <li><strong>Aadhaar Card</strong> (Mandatory for EPF/ESIC linking)</li>
                                        <li><strong>PAN Card</strong></li>
                                        <li><strong>Bank Passbook</strong> (For salary deposits)</li>
                                        <li><strong>4 Passport Size Photos</strong></li>
                                        <li><strong>Educational Certificates</strong> (SSC/10th or high school records)</li>
                                    </ul>
                                )
                            },
                            {
                                q: "Is prior guarding experience necessary?",
                                a: <p className="text-slate-600 text-sm">No. We provide comprehensive training covering patrolling schedules, gate log entries, fire safety drills, and emergency procedures for all selected candidates.</p>
                            },
                            {
                                q: "Do you offer family medical cover?",
                                a: <p className="text-slate-600 text-sm">Yes, through the ESIC registry, eligible security personnel and their direct dependents receive full clinical treatment facilities at ESIC-partnered hospitals.</p>
                            },
                            {
                                q: "Can I apply for specific shifts?",
                                a: <p className="text-slate-600 text-sm">Duty shifts are configured on 8-hour or 12-hour schedules, depending on client site requirements. Shift preferences can be requested at the time of onboarding.</p>
                            }
                        ].map((faq, index) => (
                            <div key={index} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                                <button
                                    onClick={() => toggleFaq(index)}
                                    className="w-full text-left px-6 py-5 bg-white hover:bg-slate-50 transition-colors flex justify-between items-center focus:outline-none"
                                >
                                    <span className="text-base font-bold text-slate-900">{faq.q}</span>
                                    <ChevronDown className={`h-5 w-5 text-slate-500 transform transition-transform duration-200 ${openFaq === index ? 'rotate-180' : ''}`} />
                                </button>
                                {openFaq === index && (
                                    <div className="px-6 py-5 bg-slate-50/50 border-t border-slate-100 text-slate-600 leading-relaxed text-sm">
                                        {faq.a}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Full blog post reader modal */}
            {selectedPost && (
                <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div ref={modalRef} className="bg-white rounded-3xl max-w-3xl w-full max-h-[85vh] overflow-y-auto shadow-2xl relative flex flex-col">
                        
                        {/* Header banner */}
                        <div className="p-6 sm:p-8 border-b sticky top-0 bg-white z-10 flex justify-between items-start gap-4">
                            <div>
                                <div className="flex items-center space-x-3 mb-2">
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">
                                        {selectedPost.category}
                                    </span>
                                    <span className="text-xs text-slate-400 font-semibold">{selectedPost.date}</span>
                                </div>
                                <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                                    {selectedPost.title}
                                </h2>
                            </div>
                            <button
                                onClick={() => setSelectedPost(null)}
                                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 flex-shrink-0 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Article body */}
                        <div className="p-6 sm:p-8 flex-1">
                            {selectedPost.imageUrl && (
                                <div className="h-56 sm:h-80 w-full rounded-2xl overflow-hidden shadow-xs bg-slate-50 mb-6">
                                    <img 
                                        src={getFormattedImageUrl(selectedPost.imageUrl)} 
                                        alt={selectedPost.title} 
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            )}

                            <div className="my-4">
                                <AdSenseUnit slot="3333333333" format="auto" />
                            </div>

                            <div 
                                className="prose prose-slate prose-sm sm:prose-base max-w-none text-slate-600 leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedPost.content) }}
                            />
                        </div>

                        {/* Footer details */}
                        <div className="p-6 bg-slate-50 border-t flex flex-col sm:flex-row justify-between items-center gap-4 rounded-b-3xl">
                            <span className="text-xs text-slate-400 font-bold flex items-center">
                                <Clock size={14} className="mr-1" /> Estimated read time: {selectedPost.readTime}
                            </span>
                            <button
                                onClick={() => setSelectedPost(null)}
                                className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-6 rounded-xl text-xs transition-all shadow-sm"
                            >
                                Done Reading
                            </button>
                        </div>
                    </div>
                </div>
            )}
            </main>

            <PublicFooter />
        </div>
    );
};

export default BlogPage;

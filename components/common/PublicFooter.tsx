import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldCheck, Phone, Mail, MapPin } from 'lucide-react';
import { getWebsiteConfig, WebsiteServiceData } from '../../src/services/websiteService';

const PublicFooter: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const isHomepage = location.pathname === '/';
    const [webConfig, setWebConfig] = useState<WebsiteServiceData | null>(null);

    useEffect(() => {
        getWebsiteConfig().then(config => {
            if (config) setWebConfig(config);
        }).catch(err => {
            console.error("Failed to load website config for footer:", err);
        });
    }, []);

    return (
        <footer className="bg-slate-900 text-slate-300 py-12 border-t border-slate-800 mt-auto font-sans">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    {/* Brand column */}
                    <div className="space-y-4">
                        <div className="flex items-center space-x-3 text-white font-bold text-lg">
                            <img src="/logo.png" alt="Logo" className="h-8 w-auto" />
                            <span>Unique Delta Force</span>
                        </div>
                        <p className="text-xs leading-relaxed text-slate-400">
                            A leading provider of enterprise security guards, smart CCTV monitoring, and protective services for commercial, industrial, and software facilities.
                        </p>
                    </div>

                    {/* Navigation links */}
                    <div>
                        <h3 className="text-white text-sm font-bold uppercase tracking-wider mb-4">Quick Links</h3>
                        <ul className="space-y-2 text-xs">
                            <li>
                                <span onClick={() => navigate('/')} className="hover:text-blue-400 transition-colors cursor-pointer">Home</span>
                            </li>
                            <li>
                                <span onClick={() => navigate('/blogs')} className="hover:text-blue-400 transition-colors cursor-pointer">Blogs & Guides</span>
                            </li>
                            <li>
                                <span onClick={() => navigate('/careers')} className="hover:text-blue-400 transition-colors cursor-pointer">Careers & Vacancies</span>
                            </li>
                            <li>
                                <span onClick={() => navigate('/contact')} className="hover:text-blue-400 transition-colors cursor-pointer">Contact Us</span>
                            </li>
                        </ul>
                    </div>

                    {/* Legal pages */}
                    <div>
                        <h3 className="text-white text-sm font-bold uppercase tracking-wider mb-4">Legal & Trust</h3>
                        <ul className="space-y-2 text-xs">
                            <li>
                                <span onClick={() => navigate('/privacy-policy')} className="hover:text-blue-400 transition-colors cursor-pointer">Privacy Policy</span>
                            </li>
                            <li>
                                <span onClick={() => navigate('/terms-of-service')} className="hover:text-blue-400 transition-colors cursor-pointer">Terms of Service</span>
                            </li>
                            <li>
                                <span onClick={() => navigate('/contact')} className="hover:text-blue-400 transition-colors cursor-pointer">Help & Support</span>
                            </li>
                        </ul>
                    </div>

                    {/* Contact details / Tagline */}
                    {!isHomepage ? (
                        <div className="space-y-4">
                            <h3 className="text-white text-sm font-bold uppercase tracking-wider mb-4">Contact Head Office</h3>
                            <ul className="space-y-3 text-xs mb-3">
                                <li className="flex items-start">
                                    <MapPin size={16} className="mr-2 text-blue-500 flex-shrink-0 mt-0.5" />
                                    <span>{webConfig?.contactAddress || "Madhapur, Hyderabad, Telangana - 500081"}</span>
                                </li>
                                <li className="flex items-center">
                                    <Phone size={16} className="mr-2 text-blue-500 flex-shrink-0" />
                                    <span>{webConfig?.contactPhone || "+91 98765 43210"}</span>
                                </li>
                                <li className="flex items-center">
                                    <Mail size={16} className="mr-2 text-blue-500 flex-shrink-0" />
                                    <span>{webConfig?.contactEmail || "info@udfonline.in"}</span>
                                </li>
                            </ul>
                            <a
                                href="https://forms.gle/f86UXjTiusatMUVd7"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 px-5 rounded-xl transition-all shadow-sm text-center"
                            >
                                Join UDF (Apply Online)
                            </a>
                        </div>
                    ) : (
                        <div>
                            <h3 className="text-white text-sm font-bold uppercase tracking-wider mb-4">Contact & Support</h3>
                            <p className="text-xs leading-relaxed text-slate-400 mb-4">
                                Have questions about our security services, recruiting process, or guard verification?
                            </p>
                            <div className="flex flex-wrap gap-3">
                                <button
                                    onClick={() => navigate('/contact')}
                                    className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold py-2.5 px-5 rounded-xl transition-all shadow-sm"
                                >
                                    Contact Our Team
                                </button>
                                <a
                                    href="https://forms.gle/f86UXjTiusatMUVd7"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 px-5 rounded-xl transition-all shadow-sm text-center block"
                                >
                                    Join UDF (Apply Online)
                                </a>
                            </div>
                        </div>
                    )}
                </div>

                <div className="border-t border-slate-800 mt-10 pt-6 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-400">
                    <p>© {new Date().getFullYear()} Unique Delta Force Security Pvt Ltd. All rights reserved.</p>
                    <p className="mt-2 sm:mt-0 font-medium">PSARA Licensed Security Agency</p>
                </div>
            </div>
        </footer>
    );
};

export default PublicFooter;

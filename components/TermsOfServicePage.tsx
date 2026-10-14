import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, ArrowLeft, ExternalLink } from 'lucide-react';
import AdSenseUnit from './common/AdSenseUnit';
import SEOHead from '../src/components/common/SEOHead';

const TermsOfServicePage: React.FC = () => {
    const navigate = useNavigate();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <SEOHead
                title="Terms of Service | Unique Delta Force Security"
                description="Read the official Terms of Service and terms of use for Unique Delta Force Pvt Ltd services and online portal."
                canonicalUrl="https://udfonline.in/terms-of-service"
            />
            {/* Navigation Bar */}
            <nav className="bg-white shadow-xs sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/')}>
                            <div className="bg-blue-600 p-2 rounded-lg">
                                <ExternalLink className="text-white h-5 w-5" />
                            </div>
                            <span className="text-xl font-bold text-gray-900 tracking-tight">Unique Delta Force</span>
                        </div>
                        <div className="flex items-center space-x-6">
                            <span onClick={() => navigate('/about')} className="text-sm text-gray-600 hover:text-blue-600 font-medium cursor-pointer">About Us</span>
                            <span onClick={() => navigate('/')} className="text-sm text-gray-600 hover:text-blue-600 font-medium cursor-pointer">Careers</span>
                            <span onClick={() => navigate('/contact')} className="text-sm text-gray-600 hover:text-blue-600 font-medium cursor-pointer">Contact</span>
                        </div>
                    </div>
                </div>
            </nav>
            <main className="flex-grow">

            {/* Page Header */}
            <div className="bg-slate-900 py-16 text-white text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-900 to-slate-900 opacity-90"></div>
                <div className="relative max-w-4xl mx-auto px-4">
                    <FileText className="h-12 w-12 text-blue-400 mx-auto mb-4" />
                    <h1 className="text-3xl md:text-4xl font-extrabold mb-2">Terms of Service</h1>
                    <p className="text-slate-300 text-sm">Effective Date: June 29, 2026</p>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 max-w-4xl mx-auto px-4 py-12 w-full">
                <button
                    onClick={() => navigate('/')}
                    className="mb-8 flex items-center text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors group"
                >
                    <ArrowLeft className="mr-1.5 h-4 w-4 transform group-hover:-translate-x-1 transition-transform" />
                    Back to Homepage
                </button>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 md:p-12 leading-relaxed text-gray-600 space-y-8">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-3">1. Agreement to Terms</h2>
                        <p>
                            By accessing or using the Unique Delta Force Pvt Ltd website and recruitment portal, you agree to be bound by these Terms of Service and all applicable local, national, and international laws. If you do not agree to these terms, you are prohibited from using or accessing this site.
                        </p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-3">2. Eligibility Criteria</h2>
                        <p>
                            To apply for roles or submit candidate registration documents on this platform, you must be <strong>18 years of age or older</strong> and possess the legal capacity to enter into an employment contract under the laws of India.
                        </p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-3">3. Accuracy of Application Information</h2>
                        <p className="mb-2">
                            When submitting job application forms, employee profile details, or uploading documents, you agree to:
                        </p>
                        <ul className="list-disc pl-5 space-y-1.5">
                            <li>Provide true, accurate, current, and complete information.</li>
                            <li>Upload genuine government-issued identification cards and academic certificates.</li>
                            <li>Promptly update details if they change.</li>
                        </ul>
                        <p className="mt-2">
                            Providing false or misleading information is grounds for rejection of your application or termination of employment.
                        </p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-3">4. Intellectual Property</h2>
                        <p>
                            The logo, graphics, design system, software, text content, and articles presented on this website are the intellectual property of Unique Delta Force Pvt Ltd and are protected by applicable trademark and copyright laws. Unauthorized reproduction or redistribution is prohibited.
                        </p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-3">5. Disclaimer and Limitation of Liability</h2>
                        <p className="mb-2">
                            The materials on this website are provided on an "as-is" basis. We make no warranties, expressed or implied, regarding the accuracy, completeness, or reliability of job descriptions, training details, or PF/ESI benefit calculators.
                        </p>
                        <p>
                            In no event shall Unique Delta Force Pvt Ltd or its directors be liable for any damages (including, without limitation, damages for loss of data, wages, or business interruption) arising out of the use or inability to use the platform.
                        </p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-3">6. Third-Party Links & Ads</h2>
                        <p>
                            We may show third-party ads provided by Google AdSense on our portal. We are not responsible for the content, privacy practices, or safety of any linked external sites or products promoted in advertisements.
                        </p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-3">7. Modifications to Terms</h2>
                        <p>
                            We reserve the right to revise these terms at any time without notice. By continuing to use this website, you agree to be bound by the then-current version of these Terms of Service.
                        </p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-3">8. Governing Law</h2>
                        <p>
                            Any claim relating to this website or services shall be governed by the laws of India, and any disputes shall fall under the exclusive jurisdiction of the courts located in Hyderabad, Telangana.
                        </p>
                    </div>

                    <div className="my-8">
                        <AdSenseUnit slot="2222222222" format="auto" />
                    </div>
                </div>
            </div>

            </main>

            {/* Simple Footer */}
            <footer className="bg-slate-900 text-slate-400 py-8 text-center text-sm border-t border-slate-800">
                <div className="max-w-7xl mx-auto px-4">
                    <p>&copy; {new Date().getFullYear()} Unique Delta Force Security. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
};

export default TermsOfServicePage;

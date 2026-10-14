import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PublicHeader from './common/PublicHeader';
import PublicFooter from './common/PublicFooter';
import { Mail, Phone, MapPin, Clock, ArrowLeft, Send, CheckCircle } from 'lucide-react';
import { db } from '../src/firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getWebsiteConfig, WebsiteServiceData } from '../src/services/websiteService';
import AdSenseUnit from './common/AdSenseUnit';
import SEOHead from '../src/components/common/SEOHead';

const ContactPage: React.FC = () => {
    const navigate = useNavigate();
    const [config, setConfig] = useState<WebsiteServiceData | null>(null);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [subject, setSubject] = useState('General Inquiry');
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Set dynamic SEO tags
        document.title = "Contact Us - Unique Delta Force Security";
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
            metaDesc.setAttribute('content', 'Get in touch with Unique Delta Force Pvt Ltd. Find branch offices in Hyderabad, contact phone numbers, or submit an online inquiry.');
        }
        window.scrollTo(0, 0);

        const loadData = async () => {
            try {
                const data = await getWebsiteConfig();
                setConfig(data);
            } catch (err) {
                console.error("Failed to load contact config", err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');
        try {
            await addDoc(collection(db, 'contact_messages'), {
                name,
                email,
                phone,
                subject,
                message,
                timestamp: serverTimestamp()
            });
            setSubmitted(true);
            setName('');
            setEmail('');
            setPhone('');
            setMessage('');
        } catch (err) {
            console.error('Failed to submit contact message:', err);
            setError('Something went wrong. Please try calling our support hotline directly.');
        } finally {
            setSubmitting(false);
        }
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
                title="Contact Us | Unique Delta Force Security"
                description="Get in touch with Unique Delta Force Pvt Ltd. Find branch offices in Hyderabad, contact phone numbers, or submit an online inquiry."
                canonicalUrl="https://udfonline.in/contact"
            />
            <PublicHeader />
            <main className="flex-grow">

            {/* Page Header */}
            <div className="bg-slate-900 py-16 text-white text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-900 to-slate-900 opacity-90"></div>
                <div className="relative max-w-4xl mx-auto px-4">
                    <h1 className="text-3xl md:text-4xl font-extrabold mb-2">Contact Our Management</h1>
                    <p className="text-slate-300 text-sm max-w-lg mx-auto">
                        Have questions about vacancies, site services, or employee PF/ESI registration? Send us a message or call.
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

                <div className="my-8 max-w-6xl mx-auto">
                    <AdSenseUnit slot="4444444444" format="horizontal" />
                </div>

                <div className="grid grid-cols-1 grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Column: Contact Cards */}
                    <div className="lg:col-span-5 space-y-6">
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
                            <h2 className="text-lg font-bold text-gray-900 mb-6 border-b pb-3">Office Location</h2>
                            <div className="space-y-4 text-sm text-gray-600">
                                <div className="flex items-start">
                                    <MapPin className="h-5 w-5 text-blue-600 mr-3 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-bold text-gray-800">Head Office</p>
                                        <p>{config?.contactAddress || '123 Security Main Road, Tech Park Area, Madhapur, Hyderabad, Telangana - 500081'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center">
                                    <Phone className="h-5 w-5 text-blue-600 mr-3 flex-shrink-0" />
                                    <div>
                                        <p className="font-bold text-gray-800">Phone Support</p>
                                        <p>{config?.contactPhone || '+91 98765 43210'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center">
                                    <Mail className="h-5 w-5 text-blue-600 mr-3 flex-shrink-0" />
                                    <div>
                                        <p className="font-bold text-gray-800">Email Address</p>
                                        <p>{config?.contactEmail || 'info@udfonline.in'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
                            <h2 className="text-lg font-bold text-gray-900 mb-4 border-b pb-3">Operating Hours</h2>
                            <div className="space-y-3 text-sm text-gray-600">
                                <div className="flex justify-between">
                                    <span className="flex items-center"><Clock size={16} className="mr-2 text-slate-400" /> Mon - Sat</span>
                                    <span className="font-semibold text-gray-800">{config?.contactHoursWeekdays || '10:00 AM - 06:00 PM'}</span>
                                </div>
                                <div className="flex justify-between border-t pt-2">
                                    <span className="flex items-center"><Clock size={16} className="mr-2 text-slate-400" /> Sunday</span>
                                    {config?.contactHoursSunday && config.contactHoursSunday.toLowerCase() !== 'closed' ? (
                                        <span className="font-semibold text-gray-800">{config.contactHoursSunday}</span>
                                    ) : (
                                        <span className="font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded-md text-xs">Closed</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Contact Form */}
                    <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-8 shadow-xs">
                        <h2 className="text-xl font-bold text-gray-900 mb-6">Send an Online Message</h2>
                        {submitted ? (
                            <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center text-green-800 animate-in fade-in duration-300">
                                <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4 animate-bounce" />
                                <h3 className="text-lg font-bold mb-1">Message Submitted!</h3>
                                <p className="text-sm text-green-700 leading-relaxed mb-6">
                                    Thank you for getting in touch. Our operations team will review your submission and contact you within 24 to 48 business hours.
                                </p>
                                <button
                                    onClick={() => setSubmitted(false)}
                                    className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-2.5 px-6 rounded-xl transition-all"
                                >
                                    Send Another Message
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                            Your Name
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="Enter your full name"
                                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-slate-50 focus:bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                            Phone Number
                                        </label>
                                        <input
                                            type="tel"
                                            required
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            placeholder="10-digit mobile number"
                                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-slate-50 focus:bg-white"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                        Email Address
                                    </label>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="email@example.com"
                                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-slate-50 focus:bg-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                        Subject / Inquiry Type
                                    </label>
                                    <select
                                        value={subject}
                                        onChange={(e) => setSubject(e.target.value)}
                                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all focus:bg-white"
                                    >
                                        <option value="General Inquiry">General Inquiry</option>
                                        <option value="Job Vacancy Details">Job Vacancy Details</option>
                                        <option value="Statutory Benefit Help (PF/ESI)">Statutory Benefit Help (PF/ESI)</option>
                                        <option value="Corporate Guarding Services">Corporate Guarding Services</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                        Message Details
                                    </label>
                                    <textarea
                                        required
                                        rows={4}
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        placeholder="Type details of your inquiry here..."
                                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-slate-50 focus:bg-white"
                                    />
                                </div>

                                {error && (
                                    <p className="text-red-500 text-xs font-semibold">{error}</p>
                                )}

                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
                                >
                                    {submitting ? 'Sending...' : (
                                        <>
                                            <Send size={16} /> Send Message
                                        </>
                                    )}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
            </main>

            <PublicFooter />
        </div>
    );
};

export default ContactPage;

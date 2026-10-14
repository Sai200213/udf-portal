import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, X } from 'lucide-react';

const CookieConsent: React.FC = () => {
    const navigate = useNavigate();
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Check if consent has already been given or declined
        const consent = localStorage.getItem('cookieConsent');
        if (!consent) {
            // Show banner after a slight delay for better UX
            const timer = setTimeout(() => {
                setIsVisible(true);
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleAccept = () => {
        localStorage.setItem('cookieConsent', 'accepted');
        setIsVisible(false);
    };

    const handleDecline = () => {
        localStorage.setItem('cookieConsent', 'declined');
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-6 right-6 left-6 md:left-auto md:max-w-md bg-slate-900/95 backdrop-blur-md text-white rounded-3xl border border-slate-800 shadow-2xl p-6 z-50 flex flex-col gap-4 animate-in slide-in-from-bottom-10 duration-500 font-sans">
            <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400">
                        <ShieldCheck size={20} />
                    </div>
                    <h4 className="text-sm font-extrabold tracking-tight">We value your privacy</h4>
                </div>
                <button 
                    onClick={handleDecline}
                    className="p-1 hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-200 transition-colors"
                >
                    <X size={16} />
                </button>
            </div>
            
            <p className="text-xs text-slate-300 leading-relaxed">
                This portal uses cookies to enhance security, analyze site traffic, and support monetization. By clicking <strong className="text-white">"Accept All"</strong>, you consent to our use of these technologies. You can read details in our{' '}
                <span 
                    onClick={() => {
                        navigate('/privacy-policy');
                        setIsVisible(false);
                    }} 
                    className="text-blue-400 hover:text-blue-300 underline font-semibold cursor-pointer"
                >
                    Privacy Policy
                </span>.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
                <button
                    onClick={handleDecline}
                    className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 hover:text-slate-200 py-2.5 px-4 rounded-xl transition-all"
                >
                    Decline Optional
                </button>
                <button
                    onClick={handleAccept}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 px-5 rounded-xl transition-all shadow-md shadow-blue-500/10"
                >
                    Accept All
                </button>
            </div>
        </div>
    );
};

export default CookieConsent;

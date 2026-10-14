import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { signInWithCustomToken } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, auth, functions as firebaseFunctions } from '../../src/firebase/config';
import { LegacyClaimConfig, LegacyVerificationMetric } from '../../types';
import Button from '../common/Button';
import { ArrowLeft, ShieldCheck, Loader2, AlertCircle, User, Key, Phone, CreditCard, Calendar, CheckCircle } from 'lucide-react';

const METRIC_LABELS: Record<LegacyVerificationMetric, string> = {
    phone: 'Registered Phone Number',
    aadhaar: 'Aadhar Number',
    pan: 'PAN Card Number',
    bankAccount: 'Bank Account Number',
    fatherName: "Father's Name",
    dob: 'Date of Birth (DD-MM-YYYY)',
};

const METRIC_PLACEHOLDERS: Record<LegacyVerificationMetric, string> = {
    phone: 'e.g. 9876543210',
    aadhaar: 'As per Aadhar Card',
    pan: '10-character alphanumeric',
    bankAccount: 'Full Bank Account Number',
    fatherName: 'As per records',
    dob: 'DD-MM-YYYY',
};

const METRIC_ICONS: Record<LegacyVerificationMetric, React.ReactNode> = {
    phone: <Phone size={18} />,
    aadhaar: <ShieldCheck size={18} />,
    pan: <CreditCard size={18} />,
    bankAccount: <CreditCard size={18} />,
    fatherName: <User size={18} />,
    dob: <Calendar size={18} />,
};

const ProfileClaimPage: React.FC = () => {
    const navigate = useNavigate();
    const [config, setConfig] = useState<LegacyClaimConfig | null>(null);
    const [configLoading, setConfigLoading] = useState(true);

    const [employeeId, setEmployeeId] = useState('');
    const [metricsData, setMetricsData] = useState<Partial<Record<LegacyVerificationMetric, string>>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    // Load the legacy claim config to know which metric to ask for
    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'settings', 'legacy_claim_config'), (snap) => {
            if (snap.exists()) {
                setConfig(snap.data() as LegacyClaimConfig);
            } else {
                setConfig(null);
            }
            setConfigLoading(false);
        });
        return () => unsub();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        try {
            const claimFn = httpsCallable(firebaseFunctions, 'claimEmployeeProfile');
            const result = await claimFn({
                employeeId: employeeId.trim(),
                verificationData: metricsData, // Sending the full object
            });

            const data = result.data as {
                token: string;
                submissionId?: string;
                employeeName: string;
                legacyData: Record<string, any>;
            };

            setSuccess(true);

            // Sign in with the custom token
            await signInWithCustomToken(auth, data.token);

            // Store legacy data in sessionStorage so the Join form can pick it up
            sessionStorage.setItem('legacyClaim', JSON.stringify({
                employeeId: employeeId.trim(),
                employeeName: data.employeeName,
                submissionId: data.submissionId,
                legacyData: data.legacyData,
            }));

            // Brief delay to show success, then redirect to join form
            setTimeout(() => {
                navigate('/join');
            }, 1500);

        } catch (err: any) {
            const message = err?.message || 'Verification failed. Please check your details and try again.';
            setError(message);
            setIsSubmitting(false);
        }
    };

    // Feature is disabled or config doesn't exist
    if (!configLoading && (!config || !config.enabled)) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900 p-6 text-white">
                <div className="bg-white/10 backdrop-blur-md p-8 rounded-2xl max-w-md w-full text-center">
                    <AlertCircle size={48} className="mx-auto text-amber-400 mb-4" />
                    <h2 className="text-xl font-bold mb-2">Feature Not Available</h2>
                    <p className="text-gray-300 text-sm mb-6">
                        The Profile Claim feature is currently disabled. Please contact your HR department for assistance.
                    </p>
                    <Button onClick={() => navigate('/')} variant="secondary" className="text-white border-white/30 hover:bg-white/10">
                        <ArrowLeft size={16} className="mr-2" /> Back to Home
                    </Button>
                </div>
            </div>
        );
    }

    if (configLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-600 to-orange-700">
                <Loader2 size={32} className="animate-spin text-white" />
            </div>
        );
    }

    const metrics = config?.verificationMetrics || [];
    const isFormValid = employeeId.trim() !== '' && metrics.every(m => (metricsData[m] || '').trim() !== '');

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-amber-600 to-orange-700 p-6 text-white font-sans">
            {/* Header */}
            <header className="text-center mb-8">
                <img src="/logo.png" alt="Logo" className="mx-auto h-20 w-auto mb-4 drop-shadow-lg" />
                <h1 className="text-3xl font-extrabold tracking-tight mb-2">Claim Your Profile</h1>
                <p className="text-amber-100 text-sm max-w-md mx-auto">
                    If you are a returning employee, verify your identity below to access your pre-filled joining form and complete your onboarding.
                </p>
            </header>

            {/* Claim Form Card */}
            <div className="bg-white/95 backdrop-blur-md p-8 rounded-2xl shadow-2xl text-gray-800 w-full max-w-md border border-white/20">
                {success ? (
                    <div className="text-center py-6">
                        <div className="bg-green-100 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                            <CheckCircle size={32} className="text-green-600" />
                        </div>
                        <h3 className="text-xl font-bold text-green-700 mb-2">Verification Successful!</h3>
                        <p className="text-gray-500 text-sm">Redirecting you to your joining form...</p>
                        <Loader2 size={20} className="animate-spin text-green-500 mx-auto mt-3" />
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="flex items-center space-x-3 mb-4">
                            <div className="p-3 bg-amber-50 rounded-xl">
                                <ShieldCheck size={28} className="text-amber-600" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">Identity Verification</h2>
                                <p className="text-xs text-gray-500">Enter your details to prove your identity</p>
                            </div>
                        </div>

                        {/* Employee ID */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Employee ID</label>
                            <div className="relative">
                                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    value={employeeId}
                                    onChange={(e) => setEmployeeId(e.target.value.toUpperCase())}
                                    placeholder="e.g. EMP001 or HY12345"
                                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                                    required
                                    disabled={isSubmitting}
                                />
                            </div>
                        </div>

                        {/* Dynamic Verification Metrics */}
                        {metrics.map(metricKey => (
                            <div key={metricKey}>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                    {METRIC_LABELS[metricKey]}
                                </label>
                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                        {METRIC_ICONS[metricKey]}
                                    </div>
                                    <input
                                        type="text"
                                        value={metricsData[metricKey] || ''}
                                        onChange={(e) => setMetricsData(prev => ({ ...prev, [metricKey]: e.target.value }))}
                                        placeholder={METRIC_PLACEHOLDERS[metricKey]}
                                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                                        required
                                        disabled={isSubmitting}
                                    />
                                </div>
                            </div>
                        ))}

                        {/* Error Display */}
                        {error && (
                            <div className="flex items-start space-x-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                                <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                                <p>{error}</p>
                            </div>
                        )}

                        {/* Submit */}
                        <Button
                            type="submit"
                            variant="primary"
                            className="w-full bg-amber-600 hover:bg-amber-700 shadow-lg shadow-amber-600/20"
                            size="lg"
                            disabled={isSubmitting || !isFormValid}
                        >
                            {isSubmitting ? (
                                <span className="flex items-center justify-center space-x-2">
                                    <Loader2 size={18} className="animate-spin" />
                                    <span>Verifying...</span>
                                </span>
                            ) : (
                                'Verify & Claim Profile'
                            )}
                        </Button>

                        <p className="text-xs text-gray-400 text-center mt-3">
                            Having trouble? Contact your HR department for assistance.
                        </p>
                    </form>
                )}
            </div>

            {/* Back Button */}
            <button
                onClick={() => navigate('/')}
                className="mt-6 text-amber-200 hover:text-white flex items-center space-x-1 text-sm font-medium transition-colors"
            >
                <ArrowLeft size={16} />
                <span>Back to Home</span>
            </button>

            <footer className="mt-12 text-center text-amber-200 text-xs">
                <p>&copy; {new Date().getFullYear()} Unique Delta Force Pvt Ltd. All rights reserved.</p>
            </footer>
        </div>
    );
};

export default ProfileClaimPage;

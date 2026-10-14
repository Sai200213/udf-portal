import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import { ShieldCheck, Lock, CheckCircle, AlertTriangle } from 'lucide-react';
import { getAuth, GoogleAuthProvider, signInWithPopup, linkWithCredential } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';

const SetupAccountPage: React.FC = () => {
    const navigate = useNavigate();
    const { user, setUser } = useAuth();
    const [mode, setMode] = useState<'CHOICE' | 'PASSWORD'>('CHOICE');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleGoogleLink = async () => {
        setLoading(true);
        setError('');
        try {
            const { googleSignIn } = await import('../../utils/googleAuthHelper');
            const result = await googleSignIn();

            // Link this Google Account to the Employee Record safely via Cloud Function
            if (user && user.employeeId) {
                const functions = getFunctions();
                const selfLinkGoogleFn = httpsCallable(functions, 'selfLinkGoogleAccount');
                const googleIdToken = await result.user.getIdToken();
                await selfLinkGoogleFn({
                    employeeId: user.employeeId,
                    googleUid: result.user.uid,
                    email: result.user.email,
                    googleIdToken
                });

                // Update local context
                setUser({ ...user, authProvider: 'google', isDefaultPassword: false });
                navigate('/employee/dashboard');
            }
        } catch (err: any) {
            console.error(err);
            setError('Failed to link Google Account: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (newPassword.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        try {
            if (user && user.employeeId) {
                // SECURITY: Hash password server-side with bcrypt via Cloud Function
                const functions = getFunctions();
                const setupPasswordFn = httpsCallable(functions, 'setupEmployeePassword');
                await setupPasswordFn({ employeeId: user.employeeId, newPassword });

                // Update local context
                setUser({ ...user, authProvider: 'manual', isDefaultPassword: false });
                navigate('/employee/dashboard');
            }
        } catch (err: any) {
            console.error(err);
            setError('Failed to set password: ' + (err.message || 'Unknown error'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
            <div className="max-w-xl w-full space-y-8 bg-white p-10 rounded-2xl shadow-xl border border-gray-100">
                <div className="text-center">
                    <div className="mx-auto h-20 w-20 bg-blue-50 rounded-full flex items-center justify-center mb-6">
                        <ShieldCheck size={40} className="text-blue-600" />
                    </div>
                    <h2 className="text-3xl font-extrabold text-gray-900 mb-2">
                        Account Security Setup
                    </h2>
                    <p className="text-gray-500 text-lg">
                        Welcome, <span className="font-semibold text-gray-800">{user?.applicantName || 'Employee'}</span>!
                    </p>
                    <div className="mt-4 p-4 bg-yellow-50 rounded-lg text-left flex items-start">
                        <AlertTriangle className="text-yellow-600 mr-3 flex-shrink-0 mt-0.5" size={20} />
                        <p className="text-sm text-yellow-800">
                            You are currently using a <strong>default password</strong>. For your security, you must choose a secure login method to proceed.
                        </p>
                    </div>
                </div>

                {mode === 'CHOICE' ? (
                    <div className="mt-8 space-y-4">
                        <button
                            onClick={handleGoogleLink}
                            disabled={loading}
                            className="w-full relative group flex items-center justify-center px-6 py-4 border border-transparent text-lg font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all shadow-lg shadow-blue-200"
                        >
                            <span className="absolute left-6 flex items-center">
                                <svg className="w-6 h-6 mr-2" viewBox="0 0 24 24">
                                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                            </span>
                            Sign in with Google
                            <span className="ml-2 text-blue-200 text-sm font-normal">(Recommended)</span>
                        </button>

                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-300"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-4 bg-white text-gray-500 font-medium">OR</span>
                            </div>
                        </div>

                        <button
                            onClick={() => setMode('PASSWORD')}
                            disabled={loading}
                            className="w-full flex items-center justify-center px-6 py-4 border-2 border-gray-200 text-lg font-medium rounded-xl text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all"
                        >
                            <Lock className="mr-3 text-gray-500" size={24} />
                            Create Personal Password
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSetPassword} className="mt-8 space-y-6">
                        <div>
                            <Input
                                type="password"
                                label="New Password"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                required
                                placeholder="Min 6 characters"
                            />
                        </div>
                        <div>
                            <Input
                                type="password"
                                label="Confirm Password"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                required
                                placeholder="Re-enter password"
                            />
                        </div>

                        {error && (
                            <div className="text-red-500 text-sm text-center p-3 bg-red-50 rounded-lg">
                                {error}
                            </div>
                        )}

                        <div className="flex gap-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setMode('CHOICE')}
                                className="flex-1"
                            >
                                Back
                            </Button>
                            <Button
                                type="submit"
                                variant="primary"
                                className="flex-[2]"
                                disabled={loading}
                            >
                                {loading ? 'Saving...' : 'Set Password & Login'}
                            </Button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default SetupAccountPage;


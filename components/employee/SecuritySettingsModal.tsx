import React, { useState, useEffect } from 'react';
import { Lock, Link as LinkIcon, ShieldCheck, AlertTriangle, CheckCircle, X } from 'lucide-react';

interface SecuritySettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** When 'forced', user MUST complete one action before closing */
    isForced?: boolean;
    employeeId: string;
    /** Pre-select a tab when opened from the profile menu */
    initialTab?: 'change_password' | 'link_google' | 'change_google';
}

const SecuritySettingsModal: React.FC<SecuritySettingsModalProps> = ({
    isOpen,
    onClose,
    isForced = false,
    employeeId,
    initialTab
}) => {
    const [activeTab, setActiveTab] = useState<'change_password' | 'link_google' | 'change_google'>(initialTab || 'change_password');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [msg, setMsg] = useState('');

    useEffect(() => {
        if (isOpen) {
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setStatus('idle');
            setMsg('');
            if (initialTab) setActiveTab(initialTab);
        }
    }, [isOpen, initialTab]);

    if (!isOpen) return null;

    const handleChangePassword = async () => {
        if (newPassword.length < 6) {
            setStatus('error');
            setMsg('New password must be at least 6 characters.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setStatus('error');
            setMsg('Passwords do not match.');
            return;
        }
        setStatus('loading');
        setMsg('');
        try {
            const { changePassword } = await import('../../src/services/employeeService');
            await changePassword(employeeId, currentPassword, newPassword);
            setStatus('success');
            setMsg('Password changed successfully! Your account is now secure.');
            setTimeout(() => onClose(), 2500);
        } catch (err: any) {
            setStatus('error');
            setMsg(err.message || 'Password change failed.');
        }
    };

    const handleLinkGoogle = async () => {
        setStatus('loading');
        setMsg('');
        try {
            // 1. Verify password FIRST (before doing anything else)
            const { checkEmployeePassword } = await import('../../src/services/employeeService');
            await checkEmployeePassword(employeeId, currentPassword);

            // 2. If changing Google account, unlink the current one now that password is verified
            if (activeTab === 'change_google') {
                const { unlinkGoogleAccount } = await import('../../src/services/employeeService');
                await unlinkGoogleAccount(employeeId, currentPassword);
            }

            // 3. Open Google popup safely (without replacing core auth session)
            const { getGoogleCredentialSafely } = await import('../../src/utils/googleAuthHelper');
            const googleResult = await getGoogleCredentialSafely();
            if (!googleResult.uid || !googleResult.email) throw new Error('Google selection failed.');

            // 4. Link via Cloud Function (completes the actual linking in backend)
            const { linkGoogleAccount } = await import('../../src/services/employeeService');
            await linkGoogleAccount(employeeId, currentPassword, googleResult.uid, googleResult.email);

            setStatus('success');
            setMsg(activeTab === 'change_google'
                ? `Google account changed to ${googleResult.email}!`
                : `Google account (${googleResult.email}) linked! You can now use Google to log in.`);
            setTimeout(() => onClose(), 2500);
        } catch (err: any) {
            console.error(err);
            setStatus('error');
            setMsg(err.message || 'Failed to link Google account.');
        }
    };

    const handleSubmit = () => {
        if (activeTab === 'change_password') {
            handleChangePassword();
        } else {
            handleLinkGoogle();
        }
    };

    const isFormValid = activeTab === 'change_password'
        ? currentPassword && newPassword && confirmPassword
        : currentPassword;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200 overflow-hidden">

                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-5 text-white relative">
                    {!isForced && (
                        <button onClick={onClose} className="absolute top-3 right-3 p-1 rounded-full hover:bg-white/20 transition-colors">
                            <X size={18} />
                        </button>
                    )}
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg">
                            <ShieldCheck size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">
                                {isForced ? 'Secure Your Account' : 'Security Settings'}
                            </h3>
                            <p className="text-emerald-100 text-xs mt-0.5">
                                {isForced
                                    ? 'You must change your default password before continuing.'
                                    : 'Manage your login credentials.'}
                            </p>
                        </div>
                    </div>
                </div>

                {status === 'success' ? (
                    <div className="p-8 text-center">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-4">
                            <CheckCircle size={32} className="text-green-600" />
                        </div>
                        <p className="text-sm text-gray-600">{msg}</p>
                    </div>
                ) : (
                    <div className="p-5">
                        {/* Tab Selector — only show when NOT forced */}
                        {!isForced && (
                            <div className="flex rounded-xl bg-gray-100 p-1 mb-5">
                                <button
                                    onClick={() => { setActiveTab('change_password'); setStatus('idle'); setMsg(''); }}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                                        activeTab === 'change_password'
                                            ? 'bg-white text-emerald-700 shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    <Lock size={15} />
                                    Change Password
                                </button>
                                <button
                                    onClick={() => { setActiveTab('link_google'); setStatus('idle'); setMsg(''); }}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                                        activeTab === 'link_google'
                                            ? 'bg-white text-emerald-700 shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    <LinkIcon size={15} />
                                    Link Google
                                </button>
                            </div>
                        )}

                        {/* ── FORCED MODE: Password change form + optional Google link ── */}
                        {isForced ? (
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="forced-current-password" className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                                    <input
                                        id="forced-current-password"
                                        name="currentPassword"
                                        type="password"
                                        placeholder="Enter your current / default password"
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-all"
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label htmlFor="forced-new-password" className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                                    <input
                                        id="forced-new-password"
                                        name="newPassword"
                                        type="password"
                                        placeholder="At least 6 characters"
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-all"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        minLength={6}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="forced-confirm-password" className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                                    <input
                                        id="forced-confirm-password"
                                        name="confirmPassword"
                                        type="password"
                                        placeholder="Re-enter new password"
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-all"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                    />
                                </div>

                                {/* Optional: Link Google — actual functional button */}
                                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <LinkIcon size={14} className="text-blue-600" />
                                            <span className="text-xs text-blue-700 font-medium">Enable one-click login with Google (optional)</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleLinkGoogle}
                                            disabled={status === 'loading' || !currentPassword}
                                            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
                                        >
                                            <LinkIcon size={12} />
                                            Link Google
                                        </button>
                                    </div>
                                </div>

                                {status === 'error' && (
                                    <div className="bg-red-50 border border-red-100 rounded-lg p-3 flex items-center gap-2 text-sm text-red-700">
                                        <AlertTriangle size={16} className="flex-shrink-0" />
                                        {msg}
                                    </div>
                                )}

                                <div className="flex justify-end pt-4 border-t border-gray-100">
                                    <button
                                        onClick={handleChangePassword}
                                        disabled={status === 'loading' || !currentPassword || !newPassword || !confirmPassword}
                                        className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-medium flex items-center gap-2"
                                    >
                                        {status === 'loading' ? (
                                            <>
                                                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                                                Changing...
                                            </>
                                        ) : (
                                            <>
                                                <Lock size={15} />
                                                Change Password
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* ── NORMAL MODE: Tabbed UI ── */
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="normal-current-password" className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                                    <input
                                        id="normal-current-password"
                                        name="currentPassword"
                                        type="password"
                                        placeholder="Enter your current password"
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-all"
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        autoFocus
                                    />
                                </div>

                                {activeTab === 'change_password' && (
                                    <>
                                        <div>
                                            <label htmlFor="normal-new-password" className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                                            <input
                                                id="normal-new-password"
                                                name="newPassword"
                                                type="password"
                                                placeholder="At least 6 characters"
                                                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-all"
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                minLength={6}
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="normal-confirm-password" className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                                            <input
                                                id="normal-confirm-password"
                                                name="confirmPassword"
                                                type="password"
                                                placeholder="Re-enter new password"
                                                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-all"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                            />
                                        </div>
                                    </>
                                )}

                                {activeTab === 'link_google' && (
                                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700 flex items-start gap-2">
                                        <LinkIcon size={14} className="mt-0.5 flex-shrink-0" />
                                        <span>After verifying your password, a Google sign-in popup will appear. Link your Google account to enable one-click login.</span>
                                    </div>
                                )}

                                {status === 'error' && (
                                    <div className="bg-red-50 border border-red-100 rounded-lg p-3 flex items-center gap-2 text-sm text-red-700">
                                        <AlertTriangle size={16} className="flex-shrink-0" />
                                        {msg}
                                    </div>
                                )}

                                <div className="flex gap-2 justify-end mt-6 pt-4 border-t border-gray-100">
                                    <button
                                        onClick={onClose}
                                        className="px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSubmit}
                                        disabled={status === 'loading' || !isFormValid}
                                        className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-medium flex items-center gap-2"
                                    >
                                        {status === 'loading' ? (
                                            <>
                                                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                                                Processing...
                                            </>
                                        ) : activeTab === 'change_password' ? (
                                            <>
                                                <Lock size={15} />
                                                Change Password
                                            </>
                                        ) : (
                                            <>
                                                <LinkIcon size={15} />
                                                Link Google
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SecuritySettingsModal;

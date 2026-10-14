import React, { useState } from 'react';
import { SubmittedFormData, SubmissionStatus } from '../types';
import { AppView } from '../App';
import { ArrowLeft, ShieldCheck, UserCircle, Shield } from 'lucide-react';
import log from '../src/utils/logger';
import { isNativeApp } from '../src/utils/capacitor-utils';
import { useAuth } from '../src/context/AuthContext';

interface EmployeeLoginPageProps {
  onLoginSuccess: (employee: SubmittedFormData) => void;
  submittedForms: SubmittedFormData[];
  onNavigateToLanding: () => void;
  onNavigateToAdminLogin: () => void;
}

const EmployeeLoginPage: React.FC<EmployeeLoginPageProps> = ({
  onLoginSuccess,
  submittedForms,
  onNavigateToLanding,
  onNavigateToAdminLogin
}) => {
  const { lockSession, unlockSession } = useAuth();
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showManual, setShowManual] = useState(false);
  
  // SSO and Candidate flows
  const [ssoRedirectUrl, setSsoRedirectUrl] = useState<string | null>(null);
  const [isPublicCandidate, setIsPublicCandidate] = useState(false);
  const [authenticatedUserEmail, setAuthenticatedUserEmail] = useState('');
  const [authenticatedUserName, setAuthenticatedUserName] = useState('');

  // --- Strict Reset State ---
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetStep, setResetStep] = useState(1); // 1: ID, 2: Details, 3: New Password
  const [resetId, setResetId] = useState('');
  const [resetDetails, setResetDetails] = useState({ name: '', mobile: '', aadhar: '', dob: '' });
  const [newPassword, setNewPassword] = useState('');
  const [resetStatus, setResetStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [resetErrorMsg, setResetErrorMsg] = useState('');

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('sso') === 'google') {
      log.log("[SSO] Triggering automatic background Google Login redirect");
      handleGoogleLogin();
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

      try {
        // Set portalType BEFORE login so AuthContext uses the correct scope
        localStorage.setItem('portalType', 'employee');

        const { getFunctions, httpsCallable } = await import('firebase/functions');
        const { auth } = await import('../src/firebase/config');
        const { signInWithCustomToken } = await import('firebase/auth');

        // Call Cloud Function to verify credentials and get a custom token
        const functions = getFunctions();
        const employeeLoginFn = httpsCallable(functions, 'employeeLogin');
        const result = await employeeLoginFn({ employeeId, password });
        const { token, employee } = result.data as any;

        // LOCK session to prevent AuthContext from racing with onLoginSuccess
        lockSession();

        // Sign in with the custom token — creates a persistent, stable session
        await signInWithCustomToken(auth, token);

        // Build the employee data object for onLoginSuccess
        const approvedEmployee = {
          id: employee.id,
          employeeId: employee.employeeId,
          applicantName: employee.applicantName,
          isDefaultPassword: employee.isDefaultPassword,
          authProvider: employee.authProvider,
          linkedGoogleEmail: employee.linkedGoogleEmail,
          status: employee.status,
          data: {},
          originalFormSections: []
        };

        onLoginSuccess(approvedEmployee);
        // Unlock after onLoginSuccess has set the user
        setTimeout(() => unlockSession(), 500);
      } catch (err: any) {
        unlockSession(); // Release lock on error
        const msg = err?.message || err?.details || '';
        if (msg.includes('Too many failed attempts')) {
          setError('Account temporarily locked due to too many failed attempts. Try again in 1 hour.');
        } else if (msg.includes('Invalid Employee ID')) {
          setError('Invalid Employee ID or Password. Please ensure your submission has been approved by HR.');
        } else if (msg.includes("Admin Login portal")) {
          setError(msg);
        } else if (msg.includes('SERVER_SETUP_REQUIRED')) {
          setError(msg);
        } else {
          setError('Login failed. Please check your credentials and try again.');
        }
        log.error(err);
      } finally {
        setLoading(false);
      }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    setIsPublicCandidate(false);
    setSsoRedirectUrl(null);
    try {
      localStorage.setItem('portalType', 'employee');
      const { auth, functions } = await import('../src/firebase/config');
      const { getGoogleCredentialSafely } = await import('../src/utils/googleAuthHelper');
      const { getEmployeeProfile } = await import('../src/services/authService');
      const { httpsCallable } = await import('firebase/functions');
      const { signInWithCustomToken, signInWithCredential, GoogleAuthProvider } = await import('firebase/auth');

      const googleResult = await getGoogleCredentialSafely();
      setAuthenticatedUserEmail(googleResult.email || '');
      setAuthenticatedUserName(googleResult.email ? googleResult.email.split('@')[0] : '');

      const googleLoginFn = httpsCallable(functions, 'employeeGoogleLogin');
      
      try {
        const result: any = await googleLoginFn({ idToken: googleResult.idToken });
        
        lockSession();
        const userCred = await signInWithCustomToken(auth, result.data.token);
        const employee = await getEmployeeProfile(userCred.user);

        if (employee) {
          const employeeData: SubmittedFormData = {
            id: employee.id,
            employeeId: (employee as any).employeeId,
            data: { personalDetails: { fullName: employee.name, email: googleResult.email } },
            status: SubmissionStatus.APPROVED,
            timestamp: new Date().toISOString(),
            approvalHistory: [],
            currentLevel: 0,
            originalFormSections: []
          };

          const appTarget = import.meta.env.VITE_APP_TARGET;
          if (appTarget === 'public' || !appTarget) {
            setSsoRedirectUrl(`https://employee.udfonline.in/login?sso=google`);
            unlockSession();
          } else {
            onLoginSuccess(employeeData);
            setTimeout(() => unlockSession(), 500);
          }
        } else {
          unlockSession();
          setError('Employee profile could not be loaded.');
        }
      } catch (err: any) {
        const appTarget = import.meta.env.VITE_APP_TARGET;
        if ((err.code === 'functions/not-found' || err.message?.includes('not-found') || err.message?.includes('No employee record')) && (appTarget === 'public' || !appTarget)) {
          const credential = GoogleAuthProvider.credential(googleResult.idToken);
          await signInWithCredential(auth, credential);
          setIsPublicCandidate(true);
        } else {
          throw err;
        }
      }

    } catch (err: any) {
      unlockSession();
      log.error("Google Login Error:", err);
      if (err.code === 'auth/role-mismatch') {
        setError(err.message);
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError("Sign-in cancelled. Please complete the Google sign-in process.");
      } else if (err.code === 'auth/popup-blocked') {
        setError("Sign-in popup was blocked by your browser. Please allow popups for this site.");
      } else {
        setError(err.message || "Google Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetStatus('loading');
    setResetErrorMsg('');
    try {
      const { resetEmployeePassword } = await import('../src/services/employeeService');
      await resetEmployeePassword(resetId, resetDetails, newPassword);
      setResetStatus('success');
    } catch (err: any) {
      setResetStatus('error');
      setResetErrorMsg(err.message || "Verification failed. Please check all details.");
    }
  };

  const closeResetModal = () => {
    setShowResetModal(false);
    setResetStep(1);
    setResetId('');
    setResetDetails({ name: '', mobile: '', aadhar: '', dob: '' });
    setNewPassword('');
    setResetStatus('idle');
    setResetErrorMsg('');
  }

  const navigateTo = (view: AppView) => {
    if (view === AppView.LANDING) {
      onNavigateToLanding();
    }
  };

  const native = isNativeApp();

  if (ssoRedirectUrl) {
    return (
      <div className={`min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8`}>
        <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-lg text-center animate-in fade-in zoom-in duration-200">
          <div className="inline-block p-3 rounded-full bg-green-50 mb-4">
            <ShieldCheck size={48} className="text-green-500" />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900">Welcome Back!</h2>
          <p className="mt-2 text-sm text-gray-600">You are successfully verified. Click below to enter the Employee Portal.</p>
          <div className="pt-4">
            <a
              href={ssoRedirectUrl}
              className="w-full inline-flex items-center justify-center px-4 py-3 border border-transparent text-sm font-semibold rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none transition-all"
            >
              Go to Employee Portal
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (isPublicCandidate) {
    return (
      <div className={`min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8`}>
        <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-lg text-center animate-in fade-in zoom-in duration-200">
          <div className="inline-block p-3 rounded-full bg-blue-50 mb-4">
            <UserCircle size={48} className="text-blue-600" />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900">Google Login Successful</h2>
          <p className="mt-2 text-sm text-gray-600">You are logged in as a candidate ({authenticatedUserEmail}). No employee record was found for this account.</p>
          <p className="text-xs text-gray-500 mt-1">Would you like to submit a new application to join our security team?</p>
          <div className="pt-6 space-y-3">
            <button
              onClick={() => {
                window.location.href = '/join';
              }}
              className="w-full inline-flex items-center justify-center px-4 py-3 border border-transparent text-sm font-semibold rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none transition-all"
            >
              Join Now (Fill Onboarding Form)
            </button>
            <button
              onClick={async () => {
                const { auth } = await import('../src/firebase/config');
                await auth.signOut();
                setIsPublicCandidate(false);
              }}
              className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
            >
              Sign out / Use another account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 ${native ? 'native-login-page' : ''}`}>

      {/* Reset Password Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold mb-4 text-gray-800">Reset Password (Strict Mode)</h3>

            {resetStatus === 'success' ? (
              <div className="text-center">
                <ShieldCheck size={48} className="text-green-500 mx-auto mb-4" />
                <p className="text-green-600 mb-4">Password reset successfully!</p>
                <button onClick={closeResetModal} className="w-full py-2 bg-gray-200 rounded hover:bg-gray-300">Close</button>
              </div>
            ) : (
              <form onSubmit={handlePasswordReset}>
                {resetStep === 1 && (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">Enter your Employee ID to begin verification.</p>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Employee ID</label>
                      <input
                        type="text"
                        className="w-full p-2 border rounded mt-1"
                        value={resetId}
                        onChange={(e) => setResetId(e.target.value)}
                        required
                      />
                    </div>
                    {resetStatus === 'error' && <p className="text-red-500 text-sm bg-red-50 p-2 rounded">{resetErrorMsg}</p>}
                    <button
                      type="button"
                      disabled={resetStatus === 'loading'}
                      onClick={async () => {
                        if (!resetId) return;
                        setResetStatus('loading');
                        setResetErrorMsg('');
                        try {
                          const { checkEmployeeStatus } = await import('../src/services/employeeService');
                          const status = await checkEmployeeStatus(resetId);
                          if (!status.exists) {
                            setResetErrorMsg("Employee ID not found.");
                            setResetStatus('error');
                          } else if (!status.isActive) {
                            setResetErrorMsg("Employee account is not active. Contact HR.");
                            setResetStatus('error');
                          } else {
                            setResetStatus('idle');
                            setResetStep(2);
                          }
                        } catch (e) {
                          setResetErrorMsg("Error verifying ID.");
                          setResetStatus('error');
                        }
                      }}
                      className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300"
                    >
                      {resetStatus === 'loading' ? 'Verifying...' : 'Next'}
                    </button>
                  </div>
                )}

                {resetStep === 2 && (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600">Please provide verification details exactly as per your profile.</p>
                    <div>
                      <label className="block text-xs font-medium text-gray-700">Full Name</label>
                      <input type="text" className="w-full p-2 border rounded text-sm" value={resetDetails.name} onChange={(e) => setResetDetails({ ...resetDetails, name: e.target.value })} required placeholder="As per records" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700">Mobile Number</label>
                      <input type="text" className="w-full p-2 border rounded text-sm" value={resetDetails.mobile} onChange={(e) => setResetDetails({ ...resetDetails, mobile: e.target.value })} required placeholder="Registered Mobile" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700">Aadhar Number</label>
                      <input type="text" className="w-full p-2 border rounded text-sm" value={resetDetails.aadhar} onChange={(e) => setResetDetails({ ...resetDetails, aadhar: e.target.value })} required placeholder="Last 4 digits or full" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700">Date of Birth</label>
                      <input type="date" className="w-full p-2 border rounded text-sm" value={resetDetails.dob} onChange={(e) => setResetDetails({ ...resetDetails, dob: e.target.value })} required />
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setResetStep(1)} className="w-1/3 py-2 bg-gray-200 rounded text-gray-700">Back</button>
                      <button type="button" onClick={() => {
                        if (resetDetails.name && resetDetails.mobile && resetDetails.aadhar && resetDetails.dob) setResetStep(3);
                      }} className="w-2/3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Verify</button>
                    </div>
                  </div>
                )}

                {resetStep === 3 && (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">Verification complete. Enter your new password.</p>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">New Password</label>
                      <input type="password" className="w-full p-2 border rounded mt-1" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
                    </div>
                    {resetStatus === 'error' && <p className="text-red-500 text-sm bg-red-50 p-2 rounded">{resetErrorMsg}</p>}
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setResetStep(2)} className="w-1/3 py-2 bg-gray-200 rounded text-gray-700">Back</button>
                      <button type="submit" disabled={resetStatus === 'loading'} className="w-2/3 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                        {resetStatus === 'loading' ? 'Resetting...' : 'Reset Password'}
                      </button>
                    </div>
                  </div>
                )}
              </form>
            )}
            {!['success', 'loading'].includes(resetStatus) && (
              <button onClick={closeResetModal} className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 p-1">
                ✕
              </button>
            )}
          </div>
        </div>
      )
      }

      <div className={`max-w-md w-full space-y-8 bg-white p-10 relative ${native ? 'native-login-card' : 'rounded-xl shadow-lg'}`}>
        {!native && (
          <button
            onClick={() => navigateTo(AppView.LANDING)}
            className="absolute top-4 left-4 text-gray-500 hover:text-gray-700 transition-colors flex items-center text-sm"
          >
            <ArrowLeft size={16} className="mr-1" /> Back
          </button>
        )}

        <div className="text-center">
          <div className="inline-block p-3 rounded-full bg-blue-50 mb-4">
            <UserCircle size={48} className="text-blue-600" />
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900">Employee Login</h2>
          <p className="mt-2 text-sm text-gray-600">Access your dashboard</p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-center justify-center">
            <span className="mr-2">⚠</span> {error}
          </div>
        )}

        {/* Primary Google Login */}
        <div className="mt-8 space-y-4">
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center px-4 py-2.5 border border-gray-300 shadow-sm text-sm font-semibold rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all cursor-pointer"
          >
            <svg className="h-5 w-5 mr-3" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Sign in with Google
          </button>
          
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => setShowManual(!showManual)}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold focus:outline-none hover:underline"
            >
              {showManual ? "Hide Credentials Sign In" : "Sign In with Employee ID"}
            </button>
          </div>
        </div>

        {/* Expandable Manual Credentials Form */}
        {showManual && (
          <form className="mt-6 space-y-4 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-3 duration-300" onSubmit={handleLogin}>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Employee ID</label>
                <input
                  type="text"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="e.g. HY123456"
                  autoCapitalize="none"
                  autoComplete="off"
                  required
                />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Password</label>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="••••••••"
                  required
                />
                <div className="text-right mt-1.5">
                  <button type="button" onClick={() => setShowResetModal(true)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                    Forgot Password?
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-semibold rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {loading ? 'Logging in...' : 'Sign In'}
            </button>
          </form>
        )}


      </div>
    </div >
  );
};

export default EmployeeLoginPage;


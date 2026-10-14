import React, { useState, useEffect } from 'react';
import Modal from './common/Modal';
import Input from './common/Input';
import Button from './common/Button';
import { subscribeToLegacyClaimConfig } from '../src/services/adminService';
import { claimLegacyProfile } from '../src/services/employeeService';
import { LegacyClaimConfig, LegacyVerificationMetric } from '../types';
import { Shield, Phone, CreditCard, Calendar, Users, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { auth } from '../src/firebase/config';
import { signInWithCustomToken } from 'firebase/auth';

interface LegacyClaimModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (legacyData: any, employeeName: string) => void;
}

const METRIC_ICONS: Record<LegacyVerificationMetric, React.ReactNode> = {
  phone: <Phone size={18} />,
  aadhaar: <Shield size={18} />,
  pan: <CreditCard size={18} />,
  bankAccount: <CreditCard size={18} />,
  fatherName: <Users size={18} />,
  dob: <Calendar size={18} />,
};

const METRIC_LABELS: Record<LegacyVerificationMetric, string> = {
  phone: 'Phone Number',
  aadhaar: 'Aadhaar Number',
  pan: 'PAN Card Number',
  bankAccount: 'Bank Account (Last 4 digits)',
  fatherName: "Father's Name",
  dob: 'Date of Birth (YYYY-MM-DD)',
};

const LegacyClaimModal: React.FC<LegacyClaimModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [config, setConfig] = useState<LegacyClaimConfig | null>(null);
  const [employeeId, setEmployeeId] = useState('');
  const [verificationData, setVerificationData] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Subscribe to Config
      const configUnsub = subscribeToLegacyClaimConfig((cfg) => {
        setConfig(cfg);
      });

      return () => {
        configUnsub();
      };
    }
  }, [isOpen]);

  const handleInputChange = (metric: string, value: string) => {
    setVerificationData((prev) => ({ ...prev, [metric]: value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId.trim()) {
      setError('Employee ID is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await claimLegacyProfile(employeeId.trim(), verificationData);
      
      if (result.success) {
        if (result.token) {
          try {
            await signInWithCustomToken(auth, result.token);
            console.log("[LegacyClaimModal] Successfully authenticated with custom token");
          } catch (tokenErr) {
            console.warn("[LegacyClaimModal] Custom token login failed, continuing with current session:", tokenErr);
          }
        }
        toast.success(`Identity Verified: Welcome back, ${result.employeeName}!`, { duration: 5000 });
        // Store in sessionStorage for auto-fill in the next screen
        sessionStorage.setItem('legacyClaim', JSON.stringify({
          employeeId: employeeId.trim(),
          employeeName: result.employeeName,
          legacyData: result.legacyData
        }));
        
        onSuccess(result.legacyData, result.employeeName);

      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Verification failed. Please check your details and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Claim Legacy Profile"
      size="md"
    >
      <div className="space-y-6">
        {!config ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-gray-500 font-medium">Checking system configurations...</p>
          </div>
        ) : !config.enabled ? (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-2">
               <Shield size={32} />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Feature Disabled</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">
              The legacy profile claim feature is currently disabled. Please contact your HR administrator or try again later.
            </p>
            <Button onClick={onClose} variant="primary" className="mt-4">
              Close
            </Button>
          </div>
        ) : (
          <>
            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 mb-4">
              <p className="text-sm text-indigo-700 font-medium">
                Returning employee? Enter your previous Employee ID and verification details to automatically link your profile and pre-fill your joining form.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Legacy Employee ID"
                placeholder="e.g. HY140000"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value.toUpperCase())}
                required
                autoFocus
              />

              <div className="grid grid-cols-1 gap-4">
                {config.verificationMetrics.map((metric) => (
                  <div key={metric} className="space-y-1">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <span className="text-indigo-600">{METRIC_ICONS[metric]}</span>
                      {METRIC_LABELS[metric]}
                    </label>
                    <input
                      type={metric === 'dob' ? 'date' : 'text'}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder={`Enter your ${METRIC_LABELS[metric].toLowerCase()}`}
                      value={verificationData[metric] || ''}
                      onChange={(e) => handleInputChange(metric, e.target.value)}
                      required
                    />
                  </div>
                ))}
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2 text-red-700 text-sm">
                  <span className="font-bold">Error:</span> {error}
                </div>
              )}

              <div className="pt-4 flex gap-3">
                <Button
                  variant="secondary"
                  onClick={onClose}
                  className="flex-1"
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="animate-spin" size={18} />
                      Verifying...
                    </div>
                  ) : (
                    'Verify & Link Identity'
                  )}
                </Button>
              </div>
            </form>


            <p className="text-[10px] text-gray-400 text-center italic mt-4">
              Security Note: Your credentials will be verified and linked to this employee profile upon successful verification.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
};

export default LegacyClaimModal;

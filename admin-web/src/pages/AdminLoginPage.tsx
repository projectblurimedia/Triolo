import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { authService } from '@/services/authService';
import { getErrorMessage } from '@/services/errorMessages';
import { useAuthStore } from '@/state/authStore';
import { LoadingSpinner } from '@/components/LoadingSpinner';

type Step = 'phone' | 'otp';

/**
 * Login-only — admin accounts are provisioned via `backend/scripts/seedAdmin.ts`, never
 * self-registered (see Account Model). Reuses the same `/auth/login/*` endpoints — zero new
 * backend auth code. If the account isn't `role: 'admin'`, this is rejected client-side with
 * a friendly message; the *real* enforcement is server-side `authorize('admin')` on every
 * `/admin/*` route.
 */
export function AdminLoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);
  const [step, setStep] = useState<Step>('phone');
  const [mobileNumber, setMobileNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submitPhone = async () => {
    setError(null);
    if (!mobileNumber.trim()) {
      setError('Please enter the admin mobile number.');
      return;
    }
    setLoading(true);
    try {
      await authService.requestLoginOtp({ mobileNumber });
      setStep('otp');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const submitOtp = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await authService.verifyLoginOtp({ mobileNumber, otp });
      if (result.account.role !== 'admin') {
        clearSession();
        setError('This account is not an admin account.');
        return;
      }
      setSession(result);
      navigate('/');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <PageHeader title="Triolo Admin" />
      <div className="body">
        {step === 'phone' ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitPhone();
            }}
          >
            <div className="field">
              <label>Admin Mobile Number</label>
              <input value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} maxLength={10} inputMode="numeric" autoFocus />
            </div>
            {error ? <p className="error-text">{error}</p> : null}
            <button type="submit" className="button" disabled={loading}>
              {loading ? <LoadingSpinner /> : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitOtp();
            }}
          >
            <div className="field">
              <label>Enter OTP</label>
              <input value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} inputMode="numeric" autoFocus />
            </div>
            {error ? <p className="error-text">{error}</p> : null}
            <button type="submit" className="button" disabled={loading}>
              {loading ? <LoadingSpinner /> : 'Verify & Log In'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

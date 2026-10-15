import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faShapes } from '@fortawesome/free-solid-svg-icons';
import { authService } from '@/services/authService';
import { getErrorMessage } from '@/services/errorMessages';
import { useAuthStore } from '@/state/authStore';
import { Spinner } from '@/components/ui';

/**
 * Login-only — admin accounts are provisioned with `backend/scripts/seedAdmin.ts`, never
 * self-registered. Same `/auth/login/*` OTP flow as the apps; a non-admin account is turned
 * away here, and every `/admin/*` API call is also checked server-side (`authorize('admin')`).
 */
export function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const clearSession = useAuthStore((state) => state.clearSession);
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [mobileNumber, setMobileNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    if (step === 'phone' && !/^\d{10}$/.test(mobileNumber)) {
      setError('Enter the 10-digit admin mobile number.');
      return;
    }
    setLoading(true);
    try {
      if (step === 'phone') {
        await authService.requestLoginOtp({ mobileNumber });
        setStep('otp');
      } else {
        const result = await authService.verifyLoginOtp({ mobileNumber, otp });
        if (result.account.role !== 'admin') {
          clearSession();
          setError('This account is not an admin account.');
          return;
        }
        setSession(result);
        navigate('/', { replace: true });
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <div className="login-card glass">
        <div className="login-head">
          <span className="brand-mark">
            <FontAwesomeIcon icon={faShapes} />
          </span>
          <h1>Triolo Admin</h1>
          <p>{step === 'phone' ? 'Sign in with your admin mobile number' : `Enter the OTP sent to ${mobileNumber}`}</p>
        </div>
        <form
          className="login-body"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          {step === 'phone' ? (
            <label className="field">
              <span>Mobile number</span>
              <input
                value={mobileNumber}
                onChange={(event) => setMobileNumber(event.target.value.replace(/\D/g, ''))}
                maxLength={10}
                inputMode="numeric"
                autoFocus
                placeholder="10-digit number"
              />
            </label>
          ) : (
            <label className="field">
              <span>OTP</span>
              <input
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))}
                maxLength={6}
                inputMode="numeric"
                autoFocus
                placeholder="6-digit code"
              />
            </label>
          )}
          {error ? <p className="error-text">{error}</p> : null}
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <Spinner small /> : step === 'phone' ? 'Send OTP' : 'Verify & Log In'}
          </button>
          {step === 'otp' ? (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ marginTop: 10 }}
              onClick={() => {
                setStep('phone');
                setOtp('');
                setError(null);
              }}
            >
              Change number
            </button>
          ) : null}
        </form>
      </div>
    </div>
  );
}

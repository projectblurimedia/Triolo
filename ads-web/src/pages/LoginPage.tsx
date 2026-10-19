import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBullhorn } from '@fortawesome/free-solid-svg-icons';
import { authService } from '@/services/authService';
import { ApiError } from '@/services/apiClient';
import { getErrorMessage } from '@/services/errorMessages';
import { useAuthStore } from '@/state/authStore';
import { Spinner } from '@/components/ui';

type Step = 'phone' | 'name' | 'otp';

/**
 * Sign in with a mobile number and an OTP — the same Triolo account as the apps. A number
 * with no account yet is asked for a name and gets one, so any business can start here.
 */
export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((state) => state.setSession);
  const [step, setStep] = useState<Step>('phone');
  const [isNew, setIsNew] = useState(false);
  const [mobileNumber, setMobileNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const goOn = () => {
    const from = (location.state as { from?: string } | null)?.from;
    navigate(from && from !== '/login' ? from : '/', { replace: true });
  };

  const submit = async () => {
    setError(null);
    if (step === 'phone' && !/^\d{10}$/.test(mobileNumber)) {
      setError('Enter your 10-digit mobile number.');
      return;
    }
    if (step === 'name' && fullName.trim().length < 2) {
      setError('Enter your name.');
      return;
    }
    if (step === 'otp' && !/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit OTP.');
      return;
    }
    setLoading(true);
    try {
      if (step === 'phone') {
        try {
          await authService.requestLoginOtp({ mobileNumber });
          setIsNew(false);
          setStep('otp');
        } catch (err) {
          // No account with this number yet: make one.
          if (err instanceof ApiError && err.code === 'ACCOUNT_NOT_FOUND') {
            setIsNew(true);
            setStep('name');
            return;
          }
          throw err;
        }
      } else if (step === 'name') {
        await authService.requestRegistrationOtp({ fullName: fullName.trim(), mobileNumber });
        setStep('otp');
      } else {
        const result = isNew
          ? await authService.verifyRegistrationOtp({ mobileNumber, otp })
          : await authService.verifyLoginOtp({ mobileNumber, otp });
        setSession(result);
        goOn();
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const subtitle =
    step === 'phone'
      ? 'Sign in with your mobile number to book and manage your ads'
      : step === 'name'
        ? 'New here — tell us your name to create your account'
        : `Enter the OTP sent to ${mobileNumber}`;

  return (
    <div className="login">
      <div className="login-card glass">
        <div className="login-head">
          <span className="brand-mark">
            <FontAwesomeIcon icon={faBullhorn} />
          </span>
          <h1>Triolo Ads</h1>
          <p>{subtitle}</p>
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
          ) : step === 'name' ? (
            <label className="field">
              <span>Your name</span>
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                maxLength={80}
                autoFocus
                placeholder="Your full name"
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
            {loading ? (
              <Spinner small />
            ) : step === 'phone' ? (
              'Send OTP'
            ) : step === 'name' ? (
              'Create Account & Send OTP'
            ) : (
              'Verify & Continue'
            )}
          </button>
          {step !== 'phone' ? (
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

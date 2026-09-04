import { useState } from 'react';
import { authService } from '@/services/authService';
import { ApiError } from '@/services/apiClient';
import { getErrorMessage } from '@/services/errorMessages';
import { useAuthStore } from '@/state/authStore';
import { LoadingSpinner } from './LoadingSpinner';

type Step = 'phone' | 'details' | 'otp';

interface PhoneAuthFlowProps {
  onAuthenticated: () => void;
}

/**
 * Shared phone -> OTP auth step used by both public registration pages and (in spirit,
 * login-only) AdminLoginPage — tries login first; a brand-new number falls through to a
 * short details step before requesting a registration OTP instead, so one flow covers both
 * "I already have a Triolo account" and "I'm brand new" without asking the person to choose.
 */
export function PhoneAuthFlow({ onAuthenticated }: PhoneAuthFlowProps) {
  const setSession = useAuthStore((s) => s.setSession);
  const [step, setStep] = useState<Step>('phone');
  const [mobileNumber, setMobileNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [mode, setMode] = useState<'login' | 'registration'>('login');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submitPhone = async () => {
    setError(null);
    if (!mobileNumber.trim()) {
      setError('Please enter your mobile number.');
      return;
    }
    setLoading(true);
    try {
      await authService.requestLoginOtp({ mobileNumber });
      setMode('login');
      setStep('otp');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ACCOUNT_NOT_FOUND') {
        setStep('details');
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const submitDetails = async () => {
    setError(null);
    if (!fullName.trim() || !email.trim()) {
      setError('Please fill in your name and email.');
      return;
    }
    setLoading(true);
    try {
      await authService.requestRegistrationOtp({
        fullName,
        mobileNumber,
        email,
        latitude: null,
        longitude: null,
        locationAddress: 'Not provided',
        preferredLanguage: 'en',
      });
      setMode('registration');
      setStep('otp');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const submitOtp = async () => {
    setError(null);
    if (!otp.trim()) {
      setError('Please enter the OTP.');
      return;
    }
    setLoading(true);
    try {
      const result =
        mode === 'registration'
          ? await authService.verifyRegistrationOtp({ mobileNumber, otp })
          : await authService.verifyLoginOtp({ mobileNumber, otp });
      setSession(result);
      onAuthenticated();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const buttonClass = 'button';

  // A real <form onSubmit>, not a bare onClick — this is what makes pressing Enter in any
  // field submit the step, the same as clicking the button, without a per-input onKeyDown.
  if (step === 'phone') {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitPhone();
        }}
      >
        <div className="field">
          <label>Mobile Number</label>
          <input value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} maxLength={10} inputMode="numeric" autoFocus />
        </div>
        {error ? <p className="error-text">{error}</p> : null}
        <button type="submit" className={buttonClass} disabled={loading}>
          {loading ? <LoadingSpinner /> : 'Continue'}
        </button>
      </form>
    );
  }

  if (step === 'details') {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitDetails();
        }}
      >
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: -8, marginBottom: 16 }}>
          We don't have an account for {mobileNumber} yet — a few quick details to set one up.
        </p>
        <div className="field">
          <label>Full Name</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
        </div>
        {error ? <p className="error-text">{error}</p> : null}
        <button type="submit" className={buttonClass} disabled={loading}>
          {loading ? <LoadingSpinner /> : 'Send OTP'}
        </button>
      </form>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submitOtp();
      }}
    >
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: -8, marginBottom: 16 }}>
        Enter the OTP sent to {mobileNumber}.
      </p>
      <div className="field">
        <label>Enter OTP</label>
        <input value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} inputMode="numeric" autoFocus />
      </div>
      {error ? <p className="error-text">{error}</p> : null}
      <button type="submit" className={buttonClass} disabled={loading}>
        {loading ? <LoadingSpinner /> : 'Verify OTP'}
      </button>
    </form>
  );
}

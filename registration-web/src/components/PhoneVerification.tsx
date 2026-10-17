import { useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleCheck, faClock } from '@fortawesome/free-solid-svg-icons';
import { authService } from '@/services/authService';
import { ApiError } from '@/services/apiClient';
import { getErrorMessage } from '@/services/errorMessages';
import { useAuthStore } from '@/state/authStore';
import { LoadingSpinner } from './LoadingSpinner';

interface PhoneVerificationProps {
  fullName: string;
  onFullNameChange: (value: string) => void;
  mobileNumber: string;
  onMobileNumberChange: (value: string) => void;
  verified: boolean;
  onVerified: () => void;
}

/**
 * Full Name + Mobile Number, inline as part of the same registration form (not a separate
 * page/stage) — replaces the earlier `PhoneAuthFlow` gate that had to fully complete (and
 * hide the rest of the form) before a Worker/Business could even see the fields they were
 * registering. Per explicit instruction: registration should be "one place," and the
 * page's own Submit button should only activate once the mobile number is verified, not
 * before. Tries `/auth/login/request-otp` first (existing account); an `ACCOUNT_NOT_FOUND`
 * response falls through to `/auth/register/request-otp` with the typed name instead — same
 * "one flow covers both cases" logic `PhoneAuthFlow` used, just surfaced inline here rather
 * than as its own screen. `onVerified()` fires once the OTP is confirmed and the session is
 * established (`setSession`) — the caller (`RegisterWorkerPage`/`RegisterBusinessPage`) uses
 * that to enable its own Submit button and check whether a profile already exists. Full
 * Name/Mobile Number stay visible (disabled once verification starts) rather than being
 * swapped out for a bare confirmation line — per explicit feedback not to remove those
 * fields from view. The Mobile Number field carries its own status icon, absolutely
 * positioned inside the input's right edge (not in the label row, per a later correction):
 * an orange clock while unverified, a green checkmark once verified.
 *
 * The "Verify" action sits beside the Mobile Number input, in the same row, rather than as
 * a full-width button underneath it — per explicit follow-up feedback. Confirm OTP/Change
 * Number both use the shared `.button` class, which now has a fixed height (see
 * `global.css`) specifically so the two stay the same height whether either one is showing
 * its `LoadingSpinner` or not.
 */
export function PhoneVerification({
  fullName,
  onFullNameChange,
  mobileNumber,
  onMobileNumberChange,
  verified,
  onVerified,
}: PhoneVerificationProps) {
  const setSession = useAuthStore((s) => s.setSession);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const otpRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'login' | 'registration' | null>(null);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendOtp = async () => {
    setError(null);
    if (!/^[6-9][0-9]{9}$/.test(mobileNumber.trim())) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    const nameMissing = fullName.trim().length < 2;
    setSending(true);
    try {
      await authService.requestLoginOtp({ mobileNumber });
      setMode('login');
      setOtpSent(true);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ACCOUNT_NOT_FOUND') {
        if (nameMissing) {
          setError('This number is new to Triolo — enter your full name to create your account, then click Verify.');
          return;
        }
        try {
          await authService.requestRegistrationOtp({ fullName, mobileNumber, preferredLanguage: 'en' });
          setMode('registration');
          setOtpSent(true);
        } catch (registrationErr) {
          setError(getErrorMessage(registrationErr));
        }
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setSending(false);
    }
  };

  const confirmOtp = async () => {
    setError(null);
    if (!/^[0-9]{6}$/.test(otp.trim())) {
      setError('Enter the 6-digit OTP.');
      return;
    }
    setConfirming(true);
    try {
      const result =
        mode === 'registration'
          ? await authService.verifyRegistrationOtp({ mobileNumber, otp })
          : await authService.verifyLoginOtp({ mobileNumber, otp });
      setSession(result);
      onVerified();
    } catch (err) {
      setError(getErrorMessage(err));
      // A wrong code: clear it and put the cursor (and the phone's keyboard) back in the box.
      setOtp('');
      setTimeout(() => otpRef.current?.focus(), 50);
    } finally {
      setConfirming(false);
    }
  };

  const changeNumber = () => {
    setOtpSent(false);
    setOtp('');
    setMode(null);
    setError(null);
  };

  return (
    <div>
      <div className="field">
        <label>Full Name</label>
        <input value={fullName} onChange={(e) => onFullNameChange(e.target.value)} disabled={otpSent || verified} />
      </div>
      <div className="field">
        <label>Mobile Number</label>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              value={mobileNumber}
              onChange={(e) => onMobileNumberChange(e.target.value)}
              maxLength={10}
              inputMode="numeric"
              disabled={otpSent || verified}
              style={{ paddingRight: 40 }}
            />
            <FontAwesomeIcon
              icon={verified ? faCircleCheck : faClock}
              style={{
                position: 'absolute',
                top: '50%',
                right: 14,
                transform: 'translateY(-50%)',
                color: verified ? 'var(--color-success)' : 'var(--color-warning)',
                fontSize: 16,
              }}
            />
          </div>
          {!verified && !otpSent ? (
            <button
              type="button"
              className="button button--secondary"
              style={{ width: 'auto', flexShrink: 0, padding: '0 16px' }}
              onClick={sendOtp}
              disabled={sending}
            >
              {sending ? <LoadingSpinner dark /> : 'Verify'}
            </button>
          ) : null}
        </div>
      </div>

      {!verified && otpSent ? (
        <>
          <div className="field">
            <label>Enter OTP sent to {mobileNumber}</label>
            <input ref={otpRef} value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} inputMode="numeric" autoFocus />
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <button
              type="button"
              className="button button--secondary"
              style={{ flex: 1 }}
              onClick={confirmOtp}
              disabled={confirming}
            >
              {confirming ? <LoadingSpinner dark /> : 'Confirm OTP'}
            </button>
            <button
              type="button"
              className="button button--secondary"
              style={{ flex: 1 }}
              onClick={changeNumber}
              disabled={confirming}
            >
              Change Number
            </button>
          </div>
        </>
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}
    </div>
  );
}

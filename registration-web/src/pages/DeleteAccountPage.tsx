import { FormEvent, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { authService } from '@/services/authService';
import { apiClient, ApiError } from '@/services/apiClient';
import { getErrorMessage } from '@/services/errorMessages';
import { useAuthStore } from '@/state/authStore';
import { LegalLinks } from './LegalPage';

/**
 * Delete a NearbyU account from the web (Google Play asks for a web way as well as the in-app
 * one): sign in with the mobile number and its one-time code, read what happens, tick, delete.
 * The same `DELETE /account` the apps call.
 */
export function DeleteAccountPage() {
  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);
  const [step, setStep] = useState<'phone' | 'otp' | 'confirm' | 'done'>('phone');
  const [mobileNumber, setMobileNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiError ? getErrorMessage(err) : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const sendCode = (event: FormEvent) => {
    event.preventDefault();
    if (!/^[6-9][0-9]{9}$/.test(mobileNumber.trim())) {
      setError('Enter your 10-digit mobile number.');
      return;
    }
    void run(async () => {
      await authService.requestLoginOtp({ mobileNumber: mobileNumber.trim() });
      setStep('otp');
    });
  };

  const verify = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const result = await authService.verifyLoginOtp({ mobileNumber: mobileNumber.trim(), otp: otp.trim() });
      setSession(result);
      setStep('confirm');
    });
  };

  const remove = () =>
    run(async () => {
      await apiClient.delete<null>('/account', true);
      clearSession();
      setStep('done');
    });

  return (
    <div className="page">
      <PageHeader title="Delete your account" subtitle="NearbyU and NearbyU Partner" backTo="/" />
      <div className="body legal">
        <p className="legal__intro">
          You can also do this in the app: <b>Profile menu → Delete account</b>. One account covers both the NearbyU and NearbyU
          Partner apps.
        </p>

        <section className="legal__section">
          <h2>What happens</h2>
          <p className="legal__bullet">Everything under way is cancelled — bookings, orders, problem posts (the other side is told).</p>
          <p className="legal__bullet">Your worker, shop and job-post profiles, and all your photos and voice messages, are deleted at once.</p>
          <p className="legal__bullet">You are signed out of every phone and can't sign in again with this account.</p>
          <p className="legal__bullet">
            Your name, number, email, place and photo are kept for 30 days (for disputes and safety), then wiped for good. After
            that the number can sign up again.
          </p>
          <p className="legal__bullet">Plans, badges and credits you paid for end and are not refunded.</p>
        </section>

        {step === 'phone' ? (
          <form onSubmit={sendCode}>
            <div className="field">
              <label htmlFor="del-mobile">Mobile number</label>
              <input
                id="del-mobile"
                inputMode="numeric"
                maxLength={10}
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                placeholder="10-digit number"
              />
            </div>
            <button className="button" type="submit" disabled={busy}>
              {busy ? <LoadingSpinner /> : 'Send code'}
            </button>
          </form>
        ) : null}

        {step === 'otp' ? (
          <form onSubmit={verify}>
            <div className="field">
              <label htmlFor="del-otp">Code sent to {mobileNumber}</label>
              <input id="del-otp" inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} />
            </div>
            <button className="button" type="submit" disabled={busy || otp.length < 4}>
              {busy ? <LoadingSpinner /> : 'Confirm code'}
            </button>
          </form>
        ) : null}

        {step === 'confirm' ? (
          <div>
            <label className="legal__tick">
              <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
              <span>I understand this can't be undone.</span>
            </label>
            <button className="button button--danger" type="button" disabled={busy || !understood} onClick={remove}>
              {busy ? <LoadingSpinner /> : 'Delete my account'}
            </button>
          </div>
        ) : null}

        {step === 'done' ? (
          <div className="card">
            <p>
              <b>Your account was deleted.</b> Your details will be wiped in 30 days. Thank you for using NearbyU.
            </p>
          </div>
        ) : null}

        {error ? <p className="error-text">{error}</p> : null}
        <LegalLinks />
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { PhoneVerification } from '@/components/PhoneVerification';
import { CategoryChips } from '@/components/CategoryChips';
import { AddressField, AddressValue, EMPTY_ADDRESS } from '@/components/AddressField';
import { PhotoUpload } from '@/components/PhotoUpload';
import { VerificationBadge } from '@/components/VerificationBadge';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { workersService, WorkerProfile } from '@/services/workersService';
import { getErrorMessage } from '@/services/errorMessages';
import { useAuthStore } from '@/state/authStore';
import { formatAddress } from '@/utils/formatAddress';

const SKILL_LABELS: Record<string, string> = {
  electrician: 'Electrician',
  plumber: 'Plumber',
  painter: 'Painter',
  carpenter: 'Carpenter',
  mechanic: 'Mechanic',
  cleaner: 'Cleaner',
  mason: 'Mason',
  other: 'Other',
};

const SKILLS = [
  { key: 'electrician', label: 'Electrician' },
  { key: 'plumber', label: 'Plumber' },
  { key: 'painter', label: 'Painter' },
  { key: 'carpenter', label: 'Carpenter' },
  { key: 'mechanic', label: 'Mechanic' },
  { key: 'cleaner', label: 'Cleaner' },
  { key: 'mason', label: 'Mason' },
];

/**
 * One page, one form — Full Name/Mobile (via `PhoneVerification`) sit alongside the actual
 * Worker fields (skills, experience, address, photos) instead of gating them behind a
 * separate auth screen, per explicit instruction that registration should be "one place."
 * Every field is fillable from the start; only the Submit button is gated on
 * `verified` — pressing it before the mobile number is verified isn't possible (disabled),
 * so filling in the rest of the form first and verifying last, as asked, works the same as
 * verifying first. A returning visitor whose session already persisted from a prior visit
 * (see authStore's own doc comment) skips straight to the "already have a profile" status
 * view on mount, without needing to redo the OTP step just to look at their status — see the
 * `useEffect` below.
 */
export function RegisterWorkerPage() {
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [verified, setVerified] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(false);
  const [existingProfile, setExistingProfile] = useState<WorkerProfile | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const [skillCategories, setSkillCategories] = useState<string[]>([]);
  const [otherEntries, setOtherEntries] = useState<string[]>([]);
  const [experienceYears, setExperienceYears] = useState('');
  const [address, setAddress] = useState<AddressValue>(EMPTY_ADDRESS);
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleVerified = async () => {
    setVerified(true);
    setCheckingProfile(true);
    try {
      const profile = await workersService.getMyProfile();
      setExistingProfile(profile);
    } catch {
      setExistingProfile(null);
      // apiClient clears the session on an unrecoverable 401 (an expired/invalid access
      // token whose refresh also failed) — if that just happened, there's no real session
      // to show as "verified" after all. Reset back to the ordinary OTP flow instead of
      // leaving the form permanently stuck on blank, disabled fields.
      if (!useAuthStore.getState().accessToken) {
        setVerified(false);
        setFullName('');
        setMobileNumber('');
      }
    } finally {
      setCheckingProfile(false);
    }
  };

  // A returning visitor with a session already persisted from a prior visit (e.g. arriving
  // here via LandingPage's own "Your Worker Profile" status card) shouldn't have to re-enter
  // an OTP just to see their status — check immediately instead of waiting for
  // PhoneVerification's own onVerified callback, which only fires after a fresh OTP flow.
  // Seeding fullName/mobileNumber from the persisted account is what actually matters here:
  // marking `verified` true without them left PhoneVerification's Full Name/Mobile Number
  // fields rendering disabled *and blank* — reported as "fields not able to select or focus
  // at all," since a disabled, empty field looks and behaves exactly like a broken one.
  useEffect(() => {
    const { accessToken, account } = useAuthStore.getState();
    if (accessToken && account) {
      setFullName(account.fullName);
      setMobileNumber(account.mobileNumber);
      handleVerified();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    setError(null);
    const includesOther = otherEntries.length > 0;
    if (
      (skillCategories.length === 0 && !includesOther) ||
      !experienceYears.trim() ||
      !address.city.trim() ||
      !address.district.trim() ||
      !address.state.trim() ||
      !/^[0-9]{6}$/.test(address.pincode)
    ) {
      setError('Please fill in all required fields.');
      return;
    }
    setSubmitting(true);
    try {
      await workersService.createProfile({
        skillCategories: includesOther ? [...skillCategories, 'other'] : skillCategories,
        otherSkillDescription: includesOther ? otherEntries.join(', ') : undefined,
        experienceYears: Number(experienceYears),
        latitude: address.latitude,
        longitude: address.longitude,
        area: address.area.trim() || undefined,
        city: address.city.trim(),
        district: address.district.trim(),
        state: address.state.trim(),
        pincode: address.pincode,
        portfolioPhotos: photos,
      });
      setSubmitted(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="page">
        <PageHeader title="Worker Registration" backTo="/" />
        <div className="body">
          <p>✅ Your details are submitted for verification.</p>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>We'll notify you once approved.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader title="Worker Registration" backTo="/" />
      <div className="body">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (verified && !existingProfile) handleSubmit();
          }}
        >
          <PhoneVerification
            fullName={fullName}
            onFullNameChange={setFullName}
            mobileNumber={mobileNumber}
            onMobileNumberChange={setMobileNumber}
            verified={verified}
            onVerified={handleVerified}
          />

          {checkingProfile ? (
            <div className="loading-wrap">
              <LoadingSpinner dark />
            </div>
          ) : null}

          {!checkingProfile && existingProfile ? (
            <div className="card">
              <p style={{ marginTop: 0 }}>You already have a worker profile:</p>
              <VerificationBadge status={existingProfile.verificationStatus} />
              <dl style={{ marginTop: 16, fontSize: 13 }}>
                <dt style={{ color: 'var(--color-text-muted)' }}>Skills</dt>
                <dd style={{ margin: '2px 0 12px' }}>
                  {existingProfile.skillCategories.map((key) => SKILL_LABELS[key] ?? key).join(', ')}
                  {existingProfile.otherSkillDescription ? ` (${existingProfile.otherSkillDescription})` : ''}
                </dd>
                <dt style={{ color: 'var(--color-text-muted)' }}>Experience</dt>
                <dd style={{ margin: '2px 0 12px' }}>{existingProfile.experienceYears} years</dd>
                <dt style={{ color: 'var(--color-text-muted)' }}>Location</dt>
                <dd style={{ margin: '2px 0 0' }}>{formatAddress(existingProfile)}</dd>
              </dl>
              <p style={{ marginTop: 16, marginBottom: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>
                We'll notify the account on file once it's reviewed.
              </p>
            </div>
          ) : null}

          {!checkingProfile && !existingProfile ? (
            <>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>
                Your Skills (select all that apply)
              </label>
              <CategoryChips
                options={SKILLS}
                selected={skillCategories}
                onChange={setSkillCategories}
                otherEntries={otherEntries}
                onOtherEntriesChange={setOtherEntries}
              />
              <div className="field">
                <label>Years of Experience</label>
                <input value={experienceYears} onChange={(e) => setExperienceYears(e.target.value)} inputMode="numeric" maxLength={2} />
              </div>
              <AddressField value={address} onChange={setAddress} />
              <PhotoUpload label="Photos of Your Work (optional)" files={photos} onChange={setPhotos} />
              {error ? <p className="error-text">{error}</p> : null}
              <button type="submit" className="button" disabled={!verified || submitting}>
                {submitting ? <LoadingSpinner /> : 'Submit'}
              </button>
              {!verified ? (
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 8 }}>
                  Verify your mobile number above to enable Submit.
                </p>
              ) : null}
            </>
          ) : null}
        </form>
      </div>
    </div>
  );
}

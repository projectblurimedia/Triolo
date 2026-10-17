import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { InfoTips } from '@/components/InfoTips';
import { PhoneVerification } from '@/components/PhoneVerification';
import { CategoryChips } from '@/components/CategoryChips';
import { LocationField } from '@/components/LocationField';
import { ProfilePhotoField } from '@/components/ProfilePhotoField';
import { PlaceValue } from '@/utils/place';
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
  const [photoFailed, setPhotoFailed] = useState(false);

  const [skillCategories, setSkillCategories] = useState<string[]>([]);
  const [otherEntries, setOtherEntries] = useState<string[]>([]);
  const [experienceYears, setExperienceYears] = useState('');
  const [place, setPlace] = useState<PlaceValue | null>(null);
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
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
    const years = Number(experienceYears);
    const problem =
      skillCategories.length === 0 && !includesOther
        ? 'Choose at least one skill.'
        : !experienceYears.trim() || !Number.isInteger(years) || years < 0 || years > 60
          ? 'Enter your years of experience (0–60).'
          : !place
            ? 'Set your location — use your current location or select it on the map.'
            : null;
    if (problem || !place) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    try {
      await workersService.createProfile({
        skillCategories: includesOther ? [...skillCategories, 'other'] : skillCategories,
        otherSkillDescription: includesOther ? otherEntries.join(', ') : undefined,
        experienceYears: Number(experienceYears),
        place,
        portfolioPhotos: photos,
      });
      if (profilePhoto) {
        try {
          await workersService.uploadProfilePhoto(profilePhoto);
        } catch {
          // The profile is saved; the photo can be added again from the Partner app.
          setPhotoFailed(true);
        }
      }
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
        <PageHeader title="Worker Registration" subtitle="Get work from customers near you" backTo="/" />
        <div className="body">
          <p>✅ Your details are submitted for verification.</p>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>We'll notify you once approved.</p>
          {photoFailed ? (
            <p style={{ fontSize: 13, color: 'var(--color-error)' }}>
              Your photo didn't upload. You can add it later from the Triolo Partner app.
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader title="Worker Registration" subtitle="Get work from customers near you" backTo="/" />
      <div className="body">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (verified && !existingProfile) handleSubmit();
          }}
        >
          {!existingProfile ? (
            <InfoTips
              title="About worker registration"
              tips={[
                'Provide your service details to get discovered by customers nearby.',
                'A clear profile photo helps customers trust you.',
                'Your location is picked with GPS or on the map. Only your village or town name is shown to others.',
                'Verify your mobile number to enable Register.',
                'Our team checks new profiles. Once approved, customers near you can find you.',
              ]}
            />
          ) : null}
          {!existingProfile ? (
            <ProfilePhotoField
              file={profilePhoto}
              name={fullName}
              title="Your photo"
              hint="A clear photo of your face helps customers trust you."
              onChange={setProfilePhoto}
            />
          ) : null}

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
                <input
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(e.target.value)}
                  inputMode="numeric"
                  maxLength={2}
                />
              </div>
              <LocationField label="Where do you work from?" value={place} onChange={setPlace} />
              <PhotoUpload label="Photos of Your Work (optional)" files={photos} onChange={setPhotos} />
              {error ? <p className="error-text">{error}</p> : null}
              <button type="submit" className="button" disabled={!verified || submitting}>
                {submitting ? <LoadingSpinner /> : 'Register'}
              </button>
            </>
          ) : null}
        </form>
      </div>
    </div>
  );
}

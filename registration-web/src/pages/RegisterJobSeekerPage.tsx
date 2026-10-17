import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { InfoTips } from '@/components/InfoTips';
import { PhoneVerification } from '@/components/PhoneVerification';
import { LocationField } from '@/components/LocationField';
import { ProfilePhotoField } from '@/components/ProfilePhotoField';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PlaceValue } from '@/utils/place';
import {
  AVAILABILITIES,
  Availability,
  JOB_CATEGORIES,
  JobCategory,
  JobPost,
  PayPeriod,
  jobSeekerService,
} from '@/services/jobSeekerService';
import { getErrorMessage } from '@/services/errorMessages';
import { useAuthStore } from '@/state/authStore';

const label = (key: JobCategory) => JOB_CATEGORIES.find((entry) => entry.key === key)?.label ?? key;

/**
 * "Looking for a job?" on the website — the same one-form registration as the Partner app's:
 * name + mobile verified inline, a profile photo, the kind of work, expected pay per day or
 * month, availability, experience, skills, a few words and the location. No admin review: the
 * post goes live as soon as it's saved. A number that already has a post sees it instead.
 */
export function RegisterJobSeekerPage() {
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [verified, setVerified] = useState(false);
  const [checking, setChecking] = useState(false);
  const [existingPost, setExistingPost] = useState<JobPost | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);

  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [category, setCategory] = useState<JobCategory | ''>('');
  const [customWork, setCustomWork] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payPeriod, setPayPeriod] = useState<PayPeriod>('monthly');
  const [availability, setAvailability] = useState<Availability>('full_time');
  const [experience, setExperience] = useState('');
  const [skillsText, setSkillsText] = useState('');
  const [description, setDescription] = useState('');
  const [place, setPlace] = useState<PlaceValue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleVerified = async () => {
    setVerified(true);
    setChecking(true);
    try {
      setExistingPost(await jobSeekerService.getMine());
    } catch {
      setExistingPost(null);
      if (!useAuthStore.getState().accessToken) {
        setVerified(false);
        setFullName('');
        setMobileNumber('');
      }
    } finally {
      setChecking(false);
    }
  };

  // A visitor who is already signed in sees their post (or the form) without a new OTP.
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
    const amount = Number(payAmount);
    const years = Number(experience || '0');
    const problem = !category
      ? 'Choose the kind of work you are looking for.'
      : category === 'other' && customWork.trim().length < 2
        ? 'Tell us the work you are looking for.'
        : !Number.isInteger(amount) || amount < 1
          ? 'Enter your expected pay in ₹.'
          : !Number.isInteger(years) || years < 0 || years > 60
            ? 'Enter your years of experience (0–60).'
            : !place
              ? 'Set your location — use your current location or select it on the map.'
              : null;
    if (problem || !category || !place) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    try {
      await jobSeekerService.save({
        category,
        title: category === 'other' ? customWork.trim() : label(category),
        payAmount: amount,
        payPeriod,
        availability,
        experienceYears: years,
        skills: skillsText
          .split(',')
          .map((skill) => skill.trim())
          .filter(Boolean)
          .slice(0, 15),
        description: description.trim() || undefined,
        latitude: place.latitude,
        longitude: place.longitude,
        // Only the place name is shown to customers.
        locationAddress: place.locationName,
      });
      if (profilePhoto) {
        try {
          await jobSeekerService.uploadPhoto(profilePhoto);
        } catch {
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
        <PageHeader title="Job Post" subtitle="Let nearby families and shops hire you" backTo="/" />
        <div className="body">
          <p>✅ Your job post is live.</p>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            Customers near you can now find you and call you. You can edit or hide it in the Triolo Partner app.
          </p>
          {photoFailed ? (
            <p style={{ fontSize: 13, color: 'var(--color-error)' }}>
              Your photo didn&apos;t upload. You can add it later from the Triolo Partner app.
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader title="Job Post" subtitle="Let nearby families and shops hire you" backTo="/" />
      <div className="body">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (verified && !existingPost) handleSubmit();
          }}
        >
          {!existingPost ? (
            <>
              <InfoTips
                title="About your job post"
                tips={[
                  'Looking for regular work — as a teacher, cook, driver or more? Post what you do and what pay you expect.',
                  'A clear photo of your face helps families and shops trust you.',
                  'Your location is picked with GPS or on the map. Only your village or town name is shown to others.',
                  'Verify your mobile number to enable Register.',
                  'Customers see your name and phone number so they can call you.',
                ]}
              />
              <ProfilePhotoField
                file={profilePhoto}
                name={fullName}
                title="Your photo"
                hint="A clear photo of your face."
                onChange={setProfilePhoto}
              />
            </>
          ) : null}

          <PhoneVerification
            fullName={fullName}
            onFullNameChange={setFullName}
            mobileNumber={mobileNumber}
            onMobileNumberChange={setMobileNumber}
            verified={verified}
            onVerified={handleVerified}
          />

          {checking ? (
            <div className="loading-wrap">
              <LoadingSpinner dark />
            </div>
          ) : null}

          {!checking && existingPost ? (
            <div className="card">
              <p style={{ marginTop: 0 }}>You already have a job post:</p>
              <dl style={{ marginTop: 12, fontSize: 13 }}>
                <dt style={{ color: 'var(--color-text-muted)' }}>Work</dt>
                <dd style={{ margin: '2px 0 12px' }}>{existingPost.title}</dd>
                <dt style={{ color: 'var(--color-text-muted)' }}>Pay</dt>
                <dd style={{ margin: '2px 0 12px' }}>
                  ₹{existingPost.payAmount} / {existingPost.payPeriod === 'daily' ? 'day' : 'month'}
                </dd>
                <dt style={{ color: 'var(--color-text-muted)' }}>Location</dt>
                <dd style={{ margin: '2px 0 12px' }}>{existingPost.locationAddress}</dd>
                <dt style={{ color: 'var(--color-text-muted)' }}>Status</dt>
                <dd style={{ margin: '2px 0 0' }}>{existingPost.isActive ? 'Live' : 'Hidden'}</dd>
              </dl>
              <p style={{ marginTop: 16, marginBottom: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>
                Edit or hide it in the Triolo Partner app.
              </p>
            </div>
          ) : null}

          {!checking && !existingPost ? (
            <>
              <div className="field">
                <label>Work you are looking for</label>
                <select value={category} onChange={(e) => setCategory(e.target.value as JobCategory | '')}>
                  <option value="">Choose the kind of work</option>
                  {JOB_CATEGORIES.map((entry) => (
                    <option key={entry.key} value={entry.key}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </div>
              {category === 'other' ? (
                <div className="field">
                  <label>What work?</label>
                  <input
                    value={customWork}
                    onChange={(e) => setCustomWork(e.target.value)}
                    maxLength={60}
                    placeholder="Your work"
                  />
                </div>
              ) : null}

              <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>
                Expected pay (₹)
              </label>
              <div className="delivery-row">
                <div className="chip-row">
                  {(['daily', 'monthly'] as PayPeriod[]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`chip ${payPeriod === value ? 'chip--active' : ''}`}
                      onClick={() => setPayPeriod(value)}
                    >
                      {value === 'daily' ? 'Per day' : 'Per month'}
                    </button>
                  ))}
                </div>
                <input
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value.replace(/[^0-9]/g, ''))}
                  inputMode="numeric"
                  maxLength={8}
                  placeholder="Amount in ₹"
                  aria-label="Expected pay in ₹"
                />
              </div>

              <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>
                Availability
              </label>
              <div className="chip-row">
                {AVAILABILITIES.map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    className={`chip ${availability === entry.key ? 'chip--active' : ''}`}
                    onClick={() => setAvailability(entry.key)}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>

              <div className="field">
                <label>Years of experience</label>
                <input
                  value={experience}
                  onChange={(e) => setExperience(e.target.value.replace(/[^0-9]/g, ''))}
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="Years"
                />
              </div>
              <div className="field">
                <label>Skills (separate with commas)</label>
                <input
                  value={skillsText}
                  onChange={(e) => setSkillsText(e.target.value)}
                  maxLength={300}
                  placeholder="e.g. South Indian cooking, Tiffins"
                />
              </div>
              <div className="field">
                <label>About you (optional)</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={3} />
              </div>
              <LocationField label="Your location" value={place} onChange={setPlace} />

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

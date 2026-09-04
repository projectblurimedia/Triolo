import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { PhoneAuthFlow } from '@/components/PhoneAuthFlow';
import { CategoryChips } from '@/components/CategoryChips';
import { LocationField, LocationValue } from '@/components/LocationField';
import { PhotoUpload } from '@/components/PhotoUpload';
import { VerificationBadge } from '@/components/VerificationBadge';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { workersService, WorkerProfile } from '@/services/workersService';
import { getErrorMessage } from '@/services/errorMessages';

const SKILLS = [
  { key: 'electrician', label: 'Electrician' },
  { key: 'plumber', label: 'Plumber' },
  { key: 'painter', label: 'Painter' },
  { key: 'carpenter', label: 'Carpenter' },
  { key: 'mechanic', label: 'Mechanic' },
  { key: 'cleaner', label: 'Cleaner' },
  { key: 'mason', label: 'Mason' },
];

type Stage = 'auth' | 'checking' | 'form' | 'existing' | 'success';

export function RegisterWorkerPage() {
  const [stage, setStage] = useState<Stage>('auth');
  const [existingProfile, setExistingProfile] = useState<WorkerProfile | null>(null);

  const [skillCategories, setSkillCategories] = useState<string[]>([]);
  const [otherEntries, setOtherEntries] = useState<string[]>([]);
  const [experienceYears, setExperienceYears] = useState('');
  const [location, setLocation] = useState<LocationValue>({ latitude: null, longitude: null, address: '' });
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleAuthenticated = async () => {
    setStage('checking');
    try {
      const profile = await workersService.getMyProfile();
      if (profile) {
        setExistingProfile(profile);
        setStage('existing');
      } else {
        setStage('form');
      }
    } catch {
      setStage('form');
    }
  };

  const handleSubmit = async () => {
    setError(null);
    const includesOther = otherEntries.length > 0;
    if ((skillCategories.length === 0 && !includesOther) || !experienceYears.trim() || !location.address.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    setSubmitting(true);
    try {
      await workersService.createProfile({
        skillCategories: includesOther ? [...skillCategories, 'other'] : skillCategories,
        otherSkillDescription: includesOther ? otherEntries.join(', ') : undefined,
        experienceYears: Number(experienceYears),
        latitude: location.latitude,
        longitude: location.longitude,
        locationAddress: location.address,
        portfolioPhotos: photos,
      });
      setStage('success');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <PageHeader title="Worker Registration" backTo="/" />
      <div className="body">
        {stage === 'auth' ? <PhoneAuthFlow onAuthenticated={handleAuthenticated} /> : null}

        {stage === 'checking' ? (
          <div className="loading-wrap">
            <LoadingSpinner dark />
          </div>
        ) : null}

        {stage === 'existing' && existingProfile ? (
          <div>
            <p>You already have a worker profile:</p>
            <VerificationBadge status={existingProfile.verificationStatus} />
            <p style={{ marginTop: 16, fontSize: 13, color: 'var(--color-text-muted)' }}>
              We'll notify the account on file once it's reviewed.
            </p>
          </div>
        ) : null}

        {stage === 'form' ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
          >
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
            <LocationField value={location} onChange={setLocation} />
            <PhotoUpload label="Photos of Your Work (optional)" files={photos} onChange={setPhotos} />
            {error ? <p className="error-text">{error}</p> : null}
            <button type="submit" className="button" disabled={submitting}>
              {submitting ? <LoadingSpinner /> : 'Submit'}
            </button>
          </form>
        ) : null}

        {stage === 'success' ? (
          <div>
            <p>✅ Your details are submitted for verification.</p>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>We'll notify you once approved.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

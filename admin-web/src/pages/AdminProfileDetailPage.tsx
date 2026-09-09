import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { adminService, VerificationDecision } from '@/services/adminService';
import { WorkerProfileWithAccount } from '@/services/workersService';
import { BusinessProfileWithAccount } from '@/services/businessesService';
import { VerificationBadge } from '@/components/VerificationBadge';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { getErrorMessage } from '@/services/errorMessages';
import { formatDate } from '@/utils/formatDate';
import { formatAddress } from '@/utils/formatAddress';

type Capability = 'worker' | 'business';
type Profile = WorkerProfileWithAccount | BusinessProfileWithAccount;

function isWorker(profile: Profile, capability: Capability): profile is WorkerProfileWithAccount {
  return capability === 'worker';
}

/** One component parameterized by capability (mirrors partner-app's MyInfoScreen pattern) — AdminWorkerDetailPage/AdminBusinessDetailPage below are thin route-level wrappers. */
function ProfileDetail({ capability }: { capability: Capability }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState(false);

  useEffect(() => {
    if (!id) return;
    setError(null);
    const fetcher = capability === 'worker' ? adminService.getWorker(id) : adminService.getBusiness(id);
    fetcher
      .then(setProfile)
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [id, capability]);

  const decide = async (status: VerificationDecision) => {
    if (!id) return;
    setDeciding(true);
    setError(null);
    try {
      const updated =
        capability === 'worker' ? await adminService.setWorkerVerification(id, status) : await adminService.setBusinessVerification(id, status);
      setProfile((prev) => (prev ? { ...prev, verificationStatus: updated.verificationStatus } : prev));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeciding(false);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="loading-wrap">
          <LoadingSpinner dark />
        </div>
      </div>
    );
  }

  // Only the *initial* load failing (no profile at all) earns the full-page error state —
  // a later failure from decide() (Approve/Reject) still has a valid profile to show, so
  // that error renders inline in the body instead (see below), not by replacing the page.
  if (!profile) {
    return (
      <div className="page">
        <PageHeader title={error ? 'Something Went Wrong' : 'Not Found'} backTo="/" />
        <div className="body">
          <p className={error ? 'error-text' : undefined} style={error ? { marginTop: 0 } : undefined}>
            {error ?? 'Not found.'}
          </p>
        </div>
      </div>
    );
  }

  const otherEntries = (
    isWorker(profile, capability) ? profile.otherSkillDescription : profile.otherCategoryDescription
  )
    ?.split(', ')
    .filter(Boolean) ?? [];
  const fixedCategories = (isWorker(profile, capability) ? profile.skillCategories : profile.shopCategories).filter(
    (key) => key !== 'other',
  );
  const photoUrls = isWorker(profile, capability) ? profile.portfolioPhotoUrls : profile.shopPhotoUrls;
  const title = isWorker(profile, capability) ? profile.accountFullName : profile.shopName;

  return (
    <div className="page">
      <PageHeader title={title} backTo="/" />
      <div className="body">
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: -8, marginBottom: 16 }}>
          {profile.accountFullName} · {profile.accountMobileNumber} · {profile.accountEmail}
        </p>
        <VerificationBadge status={profile.verificationStatus} />

        {/* Plain informational timestamps, not a re-review gate — editing a profile no
            longer resets it to pending (see .cloud/project-context.md), so this is purely
            "here's when it was last touched" context for the admin, not an action item. Only
            shows "Last updated" when it actually differs from "Registered" (i.e. the profile
            has been edited at least once since it was first submitted). */}
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 10 }}>
          Registered {formatDate(profile.createdAt)}
          {profile.updatedAt !== profile.createdAt ? ` · Last updated ${formatDate(profile.updatedAt)}` : ''}
        </p>

        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 20, marginBottom: 8 }}>
          {capability === 'worker' ? 'Skills' : 'Categories'}
        </p>
        <div className="chip-row">
          {fixedCategories.map((key) => (
            <span key={key} className="chip">
              {key}
            </span>
          ))}
          {otherEntries.map((entry, i) => (
            <span key={`${entry}-${i}`} className="chip">
              {entry}
            </span>
          ))}
        </div>

        {isWorker(profile, capability) ? (
          <p>
            <strong>Experience:</strong> {profile.experienceYears} years
          </p>
        ) : (
          <p>
            <strong>Delivery:</strong> {profile.deliveryAvailable ? `Yes (₹${profile.deliveryPricePerKm}/km)` : 'No'}
          </p>
        )}
        <p>
          <strong>Location:</strong> {formatAddress(profile)}
        </p>

        {photoUrls.length > 0 ? (
          <>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 16, marginBottom: 8 }}>Photos</p>
            <div className="photo-row">
              {photoUrls.map((url) => (
                <img key={url} src={url} alt="" className="photo-thumb" />
              ))}
            </div>
          </>
        ) : null}

        {error ? (
          <p className="error-text" style={{ marginTop: 20 }}>
            {error}
          </p>
        ) : null}

        {profile.verificationStatus === 'pending_verification' ? (
          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button className="button" style={{ background: 'var(--color-success)' }} onClick={() => decide('verified')} disabled={deciding}>
              {deciding ? <LoadingSpinner /> : 'Approve'}
            </button>
            <button className="button button--logout" onClick={() => decide('rejected')} disabled={deciding}>
              {deciding ? <LoadingSpinner /> : 'Reject'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button
              className="button button--secondary"
              onClick={() => decide(profile.verificationStatus === 'verified' ? 'rejected' : 'verified')}
              disabled={deciding}
            >
              {deciding ? <LoadingSpinner dark /> : `Change to ${profile.verificationStatus === 'verified' ? 'Rejected' : 'Verified'}`}
            </button>
          </div>
        )}

        <button className="button button--secondary" style={{ marginTop: 12 }} onClick={() => navigate('/')}>
          Back to dashboard
        </button>
      </div>
    </div>
  );
}

export function AdminWorkerDetailPage() {
  return <ProfileDetail capability="worker" />;
}

export function AdminBusinessDetailPage() {
  return <ProfileDetail capability="business" />;
}

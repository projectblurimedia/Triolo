import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { adminService, VerificationDecision } from '@/services/adminService';
import { WorkerProfileWithAccount } from '@/services/workersService';
import { BusinessProfileWithAccount } from '@/services/businessesService';
import { VerificationBadge } from '@/components/VerificationBadge';
import { LoadingSpinner } from '@/components/LoadingSpinner';

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
  const [deciding, setDeciding] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetcher = capability === 'worker' ? adminService.getWorker(id) : adminService.getBusiness(id);
    fetcher.then(setProfile).finally(() => setLoading(false));
  }, [id, capability]);

  const decide = async (status: VerificationDecision) => {
    if (!id) return;
    setDeciding(true);
    try {
      const updated =
        capability === 'worker' ? await adminService.setWorkerVerification(id, status) : await adminService.setBusinessVerification(id, status);
      setProfile((prev) => (prev ? { ...prev, verificationStatus: updated.verificationStatus } : prev));
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

  if (!profile) {
    return (
      <div className="page">
        <PageHeader title="Not found" backTo="/" />
        <div className="body">
          <p>Not found.</p>
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
      <PageHeader title={title} backTo="/" shop={capability === 'business'} />
      <div className="body">
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: -8, marginBottom: 16 }}>
          {profile.accountFullName} · {profile.accountMobileNumber} · {profile.accountEmail}
        </p>
        <VerificationBadge status={profile.verificationStatus} />

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
          <strong>Location:</strong> {profile.locationAddress ?? '-'}
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

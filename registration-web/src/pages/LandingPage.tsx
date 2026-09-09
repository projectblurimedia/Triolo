import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { VerificationBadge } from '@/components/VerificationBadge';
import { workersService, WorkerProfile } from '@/services/workersService';
import { businessesService, BusinessProfile } from '@/services/businessesService';
import { useAuthStore } from '@/state/authStore';

/**
 * This site only ever does two things — register a Worker, or register a Shop. No admin
 * link here; admin-web is a separate site entirely.
 *
 * For a *returning* visitor — someone whose session persisted from a prior visit (see
 * authStore's own doc comment) and who already registered a capability — each card swaps
 * from the generic "Are You a Worker?"/"Do You Have a Shop?" registration prompt to that
 * capability's own verification status instead, per explicit follow-up feedback that a
 * registered account shouldn't keep being asked the same question. Matches the equivalent
 * behavior partner-app's ChooseCapabilityScreen already has (registered capability → status
 * card, not a registration prompt). A logged-out visitor (no session yet) sees the original
 * two prompt cards unchanged — there's nothing to check without an account.
 */
export function LandingPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [checking, setChecking] = useState(!!accessToken);
  const [workerProfile, setWorkerProfile] = useState<WorkerProfile | null>(null);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);

  useEffect(() => {
    if (!accessToken) {
      setWorkerProfile(null);
      setBusinessProfile(null);
      setChecking(false);
      return;
    }
    let cancelled = false;
    setChecking(true);
    Promise.all([workersService.getMyProfile().catch(() => null), businessesService.getMyProfile().catch(() => null)]).then(
      ([worker, business]) => {
        if (cancelled) return;
        setWorkerProfile(worker);
        setBusinessProfile(business);
        setChecking(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  return (
    <div className="page">
      <PageHeader title="Triolo Partner" />
      <div className="body">
        {checking ? (
          <div className="loading-wrap">
            <LoadingSpinner dark />
          </div>
        ) : (
          <>
            {workerProfile ? (
              <Link to="/worker" className="card card--clickable">
                <strong>Your Worker Profile</strong>
                <div style={{ marginTop: 8 }}>
                  <VerificationBadge status={workerProfile.verificationStatus} />
                </div>
              </Link>
            ) : (
              <Link to="/worker" className="card card--clickable">
                <strong>Are You a Worker?</strong>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 13, margin: '6px 0 0' }}>
                  Register your skills to get discovered by customers nearby.
                </p>
              </Link>
            )}
            {businessProfile ? (
              <Link to="/business" className="card card--clickable">
                <strong>Your Business Profile</strong>
                <div style={{ marginTop: 8 }}>
                  <VerificationBadge status={businessProfile.verificationStatus} />
                </div>
              </Link>
            ) : (
              <Link to="/business" className="card card--clickable">
                <strong>Do You Have a Shop?</strong>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 13, margin: '6px 0 0' }}>
                  Register your shop to get discovered by customers nearby.
                </p>
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRightFromBracket } from '@fortawesome/free-solid-svg-icons';
import { adminService, VerificationStatusFilter } from '@/services/adminService';
import { WorkerProfileWithAccount } from '@/services/workersService';
import { BusinessProfileWithAccount } from '@/services/businessesService';
import { VerificationBadge } from '@/components/VerificationBadge';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useAuthStore } from '@/state/authStore';

type Tab = 'workers' | 'businesses';

const STATUS_FILTERS: { key: VerificationStatusFilter; label: string }[] = [
  { key: 'pending_verification', label: 'Pending' },
  { key: 'verified', label: 'Verified' },
  { key: 'rejected', label: 'Rejected' },
];

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const clearSession = useAuthStore((s) => s.clearSession);
  const account = useAuthStore((s) => s.account);
  const [tab, setTab] = useState<Tab>('workers');
  const [status, setStatus] = useState<VerificationStatusFilter>('pending_verification');
  const [loading, setLoading] = useState(true);
  const [workers, setWorkers] = useState<WorkerProfileWithAccount[]>([]);
  const [businesses, setBusinesses] = useState<BusinessProfileWithAccount[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const load =
      tab === 'workers'
        ? adminService.listWorkers(status).then((r) => !cancelled && setWorkers(r.items))
        : adminService.listBusinesses(status).then((r) => !cancelled && setBusinesses(r.items));
    load.finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [tab, status]);

  const handleLogout = () => {
    clearSession();
    navigate('/login');
  };

  return (
    <div className="page">
      <div className="header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p className="header__title">Triolo Admin · {account?.fullName}</p>
          <button
            className="button button--logout"
            style={{ width: 'auto', padding: '8px 12px', fontSize: 12 }}
            onClick={handleLogout}
            aria-label="Log out"
          >
            <FontAwesomeIcon icon={faRightFromBracket} />
          </button>
        </div>
      </div>
      <div className="body">
        <div className="tabs">
          <button className={`tab ${tab === 'workers' ? 'tab--active' : ''}`} onClick={() => setTab('workers')}>
            Workers
          </button>
          <button className={`tab ${tab === 'businesses' ? 'tab--active' : ''}`} onClick={() => setTab('businesses')}>
            Businesses
          </button>
        </div>

        <div className="chip-row">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`chip ${status === f.key ? 'chip--active' : ''}`}
              onClick={() => setStatus(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="loading-wrap">
            <LoadingSpinner dark />
          </div>
        ) : tab === 'workers' ? (
          workers.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)' }}>No workers in this status.</p>
          ) : (
            workers.map((w) => (
              <Link key={w.id} to={`/workers/${w.id}`} className="card card--clickable">
                <strong>{w.accountFullName}</strong>
                <p style={{ margin: '4px 0', fontSize: 13, color: 'var(--color-text-muted)' }}>{w.accountMobileNumber}</p>
                <p style={{ margin: '0 0 6px', fontSize: 13 }}>{w.skillCategories.join(', ')}</p>
                <VerificationBadge status={w.verificationStatus} />
              </Link>
            ))
          )
        ) : businesses.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)' }}>No businesses in this status.</p>
        ) : (
          businesses.map((b) => (
            <Link key={b.id} to={`/businesses/${b.id}`} className="card card--clickable">
              <strong>{b.shopName}</strong>
              <p style={{ margin: '4px 0', fontSize: 13, color: 'var(--color-text-muted)' }}>
                {b.accountFullName} · {b.accountMobileNumber}
              </p>
              <p style={{ margin: '0 0 6px', fontSize: 13 }}>{b.shopCategories.join(', ')}</p>
              <VerificationBadge status={b.verificationStatus} />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

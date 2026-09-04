import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';

/** This site only ever does two things — register a Worker, or register a Shop. No admin link here; admin-web is a separate site entirely. */
export function LandingPage() {
  return (
    <div className="page">
      <PageHeader title="Triolo Partner" />
      <div className="body">
        <Link to="/worker" className="card card--clickable">
          <strong>Are You a Worker?</strong>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13, margin: '6px 0 0' }}>
            Register your skills to get discovered by customers nearby.
          </p>
        </Link>
        <Link to="/business" className="card card--clickable">
          <strong>Do You Have a Shop?</strong>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13, margin: '6px 0 0' }}>
            Register your shop to get discovered by customers nearby.
          </p>
        </Link>
      </div>
    </div>
  );
}

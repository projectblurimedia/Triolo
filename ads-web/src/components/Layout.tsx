import { ReactNode, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faBars, faBullhorn, faCircleQuestion, faPlus, faRightFromBracket } from '@fortawesome/free-solid-svg-icons';
import { useAuthStore } from '@/state/authStore';
import { ConfirmModal } from './ConfirmModal';
import { Avatar, ToastHost } from './ui';

interface NavItem {
  to: string;
  label: string;
  icon: IconDefinition;
  gradient: string;
}

// The same glass sidebar and gradient squares as the admin website.
const ITEMS: NavItem[] = [
  { to: '/', label: 'My Ads', icon: faBullhorn, gradient: 'linear-gradient(135deg,#0055d3,#1d76fa)' },
  { to: '/new', label: 'Book an Ad', icon: faPlus, gradient: 'linear-gradient(135deg,#16a34a,#4ade80)' },
  { to: '/how', label: 'How It Works', icon: faCircleQuestion, gradient: 'linear-gradient(135deg,#7c3aed,#a78bfa)' },
];

function itemForPath(pathname: string): NavItem {
  if (pathname.startsWith('/new') || pathname.endsWith('/edit')) return ITEMS[1];
  if (pathname.startsWith('/how')) return ITEMS[2];
  return ITEMS[0];
}

/** Every page of the Triolo Ads website: the glass sidebar (a drawer on small screens) and the page. */
export function Layout() {
  const account = useAuthStore((state) => state.account);
  const clearSession = useAuthStore((state) => state.clearSession);
  const navigate = useNavigate();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  useEffect(() => setNavOpen(false), [location.pathname]);

  return (
    <>
      <div className={`shell${navOpen ? ' nav-open' : ''}`}>
        <div className="scrim" onClick={() => setNavOpen(false)} />
        <aside className="sidebar">
          <div className="sidebar-panel glass">
            <div className="sidebar-brand">
              <span className="brand-mark">
                <FontAwesomeIcon icon={faBullhorn} />
              </span>
              <div className="brand-text">
                <div className="brand-name">Triolo Ads</div>
                <div className="brand-sub">Advertise to people nearby</div>
              </div>
            </div>
            <nav className="nav">
              <div className="nav-section">Your business</div>
              {ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  title={item.label}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                >
                  <span className="nav-icon" style={{ background: item.gradient }}>
                    <FontAwesomeIcon icon={item.icon} />
                  </span>
                  <span className="nav-label">{item.label}</span>
                </NavLink>
              ))}
            </nav>
            <div className="sidebar-footer">
              <Avatar name={account?.fullName} />
              <div className="who">
                <strong>{account?.fullName ?? 'Your business'}</strong>
                <span>{account?.mobileNumber}</span>
              </div>
              <button className="icon-btn" onClick={() => setConfirmLogout(true)} aria-label="Log out" title="Log out">
                <FontAwesomeIcon icon={faRightFromBracket} style={{ color: 'var(--error)' }} />
              </button>
            </div>
          </div>
        </aside>
        <main className="main">
          <Outlet context={{ openNav: () => setNavOpen(true) }} />
        </main>
      </div>
      <ConfirmModal
        open={confirmLogout}
        icon={faRightFromBracket}
        tone="danger"
        title="Log out?"
        message="You'll need your mobile number and an OTP to log back in."
        confirmLabel="Log out"
        onConfirm={() => {
          clearSession();
          navigate('/login', { replace: true });
        }}
        onClose={() => setConfirmLogout(false)}
      />
      <ToastHost />
    </>
  );
}

/** A page's glass title bar: title, one line under it, and the page's own actions. */
export function Topbar({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  const location = useLocation();
  const { openNav } = useOutletContext<{ openNav: () => void }>();
  const item = itemForPath(location.pathname);
  return (
    <header className="topbar glass">
      {/* Small screens only: the sidebar is a drawer there. */}
      <button className="icon-btn menu-btn" onClick={openNav} aria-label="Menu">
        <FontAwesomeIcon icon={faBars} />
      </button>
      <span className="nav-icon topbar-icon" style={{ background: item.gradient }}>
        <FontAwesomeIcon icon={item.icon} />
      </span>
      <div className="topbar-title">
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className="topbar-actions">{actions}</div> : null}
    </header>
  );
}

import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faBars,
  faBolt,
  faBriefcase,
  faChartPie,
  faClipboardList,
  faRightFromBracket,
  faScrewdriverWrench,
  faShapes,
  faStore,
  faUsers,
  faBasketShopping,
} from '@fortawesome/free-solid-svg-icons';
import { useAuthStore } from '@/state/authStore';
import { adminApi, Stats } from '@/services/adminApi';
import { ConfirmModal } from './ConfirmModal';
import { Avatar, ToastHost } from './ui';

interface NavItem {
  to: string;
  label: string;
  icon: IconDefinition;
  gradient: string;
  badge?: (stats: Stats) => number;
}

// Same colourful gradient squares as the apps' drawer menus.
const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Overview',
    items: [{ to: '/', label: 'Dashboard', icon: faChartPie, gradient: 'linear-gradient(135deg,#0055d3,#1d76fa)' }],
  },
  {
    title: 'People',
    items: [{ to: '/accounts', label: 'All Accounts', icon: faUsers, gradient: 'linear-gradient(135deg,#4338ca,#7c3aed)' }],
  },
  {
    title: 'Services',
    items: [
      {
        to: '/workers',
        label: 'Workers',
        icon: faScrewdriverWrench,
        gradient: 'linear-gradient(135deg,#0055d3,#1d76fa)',
        badge: (stats) => stats.workers.pending,
      },
      {
        to: '/bookings/quick',
        label: 'Quick Book',
        icon: faBolt,
        gradient: 'linear-gradient(135deg,#0d9488,#2dd4bf)',
        badge: (stats) => stats.bookings.searching,
      },
      {
        to: '/problems',
        label: 'Problem Jobs',
        icon: faClipboardList,
        gradient: 'linear-gradient(135deg,#7c3aed,#a78bfa)',
        badge: (stats) => stats.problems.open,
      },
    ],
  },
  {
    title: 'Business',
    items: [
      {
        to: '/shops',
        label: 'Shops',
        icon: faStore,
        gradient: 'linear-gradient(135deg,#16a34a,#4ade80)',
        badge: (stats) => stats.businesses.pending,
      },
      {
        to: '/orders',
        label: 'Shop Orders',
        icon: faBasketShopping,
        gradient: 'linear-gradient(135deg,#db2777,#f472b6)',
        badge: (stats) => stats.orders.new,
      },
    ],
  },
  {
    title: 'Hire Staff',
    items: [{ to: '/job-posts', label: 'Job Posts', icon: faBriefcase, gradient: 'linear-gradient(135deg,#4338ca,#c026d3)' }],
  },
];

const ALL_ITEMS = SECTIONS.flatMap((section) => section.items);

/** The menu item a path belongs to (longest matching link wins; any /bookings/… page is Quick Book's). */
function itemForPath(pathname: string): NavItem {
  if (pathname.startsWith('/bookings')) return ALL_ITEMS.find((item) => item.to === '/bookings/quick') ?? ALL_ITEMS[0];
  return (
    ALL_ITEMS.filter((item) => item.to !== '/' && pathname.startsWith(item.to)).sort((a, b) => b.to.length - a.to.length)[0] ??
    ALL_ITEMS[0]
  );
}

const COLLAPSED_KEY = 'triolo-admin-sidebar-collapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

const NavContext = createContext<{ openNav: () => void; stats: Stats | null; refreshStats: () => void }>({
  openNav: () => undefined,
  stats: null,
  refreshStats: () => undefined,
});

export const useLayout = () => useContext(NavContext);

/** Every admin page: the glass sidebar (drawer on small screens), and the page beside it. */
export function Layout() {
  const account = useAuthStore((state) => state.account);
  const clearSession = useAuthStore((state) => state.clearSession);
  const navigate = useNavigate();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  // Full menu, or icons only — the admin's choice, kept for next time.
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [confirmLogout, setConfirmLogout] = useState(false);

  // The header's menu button: on a wide screen it folds the sidebar to icons and back; on a
  // narrow one (where the sidebar is a drawer) it opens the drawer.
  const toggleNav = () => {
    if (window.matchMedia('(max-width: 900px)').matches) {
      setNavOpen(true);
      return;
    }
    setCollapsed((current) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, current ? '0' : '1');
      } catch {
        // Not remembered (e.g. private mode) — it still toggles.
      }
      return !current;
    });
  };
  const [stats, setStats] = useState<Stats | null>(null);

  const refreshStats = () => {
    adminApi
      .stats()
      .then(setStats)
      .catch(() => undefined);
  };

  // Counts on the menu stay fresh as the admin moves around.
  useEffect(() => {
    refreshStats();
    setNavOpen(false);
  }, [location.pathname]);

  return (
    <NavContext.Provider value={{ openNav: toggleNav, stats, refreshStats }}>
      <div className={`shell${navOpen ? ' nav-open' : ''}${collapsed ? ' collapsed' : ''}`}>
        <div className="scrim" onClick={() => setNavOpen(false)} />
        <aside className="sidebar">
          <div className="sidebar-panel glass">
            <div className="sidebar-brand">
              <span className="brand-mark">
                <FontAwesomeIcon icon={faShapes} />
              </span>
              <div className="brand-text">
                <div className="brand-name">Triolo Admin</div>
                <div className="brand-sub">Control centre</div>
              </div>
            </div>
            <nav className="nav">
              {SECTIONS.map((section) => (
                <div key={section.title}>
                  <div className="nav-section">{section.title}</div>
                  {section.items.map((item) => {
                    const count = stats && item.badge ? item.badge(stats) : 0;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === '/'}
                        title={item.label}
                        className={({ isActive }) =>
                          `nav-item${isActive || (item.to === '/bookings/quick' && location.pathname.startsWith('/bookings')) ? ' active' : ''}`
                        }
                      >
                        <span className="nav-icon" style={{ background: item.gradient }}>
                          <FontAwesomeIcon icon={item.icon} />
                        </span>
                        <span className="nav-label">{item.label}</span>
                        {count > 0 ? <span className="nav-badge">{count > 99 ? '99+' : count}</span> : null}
                      </NavLink>
                    );
                  })}
                </div>
              ))}
            </nav>
            <div className="sidebar-footer">
              <Avatar name={account?.fullName} />
              <div className="who">
                <strong>{account?.fullName ?? 'Admin'}</strong>
                <span>{account?.mobileNumber}</span>
              </div>
              <button className="icon-btn" onClick={() => setConfirmLogout(true)} aria-label="Log out" title="Log out">
                <FontAwesomeIcon icon={faRightFromBracket} style={{ color: 'var(--error)' }} />
              </button>
            </div>
          </div>
        </aside>
        <main className="main">
          <Outlet />
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
    </NavContext.Provider>
  );
}

/** A page's sticky glass title bar: title + one line under it, and the page's own actions. */
export function Topbar({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  const { openNav } = useLayout();
  const location = useLocation();
  // The same gradient icon as this page's menu item.
  const item = itemForPath(location.pathname);
  return (
    <header className="topbar glass">
      <button className="icon-btn" onClick={openNav} aria-label="Show or hide the menu" title="Show or hide the menu">
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

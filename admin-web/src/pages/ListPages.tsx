import { ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faBasketShopping,
  faBolt,
  faBriefcase,
  faClipboardList,
  faScrewdriverWrench,
  faStore,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { Topbar } from '@/components/Layout';
import { Avatar, Badge, Empty, ErrorState, Loading, Pager, SearchBox, Segment, Thumb } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { adminApi, Page } from '@/services/adminApi';
import {
  accountStatus,
  BOOKING_ACTIVE,
  bookingStatus,
  distance,
  jobCategoryLabel,
  ORDER_ACTIVE,
  orderStatus,
  problemStatus,
  rupees,
  shopCategoryLabel,
  skillsLabel,
  timeAgo,
  verificationStatus,
  formatAddress,
} from '@/utils/format';

const LIMIT = 20;

/** Filters live in the URL, so a refresh or the back button keeps them. Changing one goes back to page 1. */
function useFilters<K extends string>(defaults: Record<K, string>) {
  const [params, setParams] = useSearchParams();
  const values = Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, params.get(key) ?? value])) as Record<
    K,
    string
  >;
  const page = Number(params.get('page') ?? 1) || 1;
  const set = (key: K | 'page', value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };
  return { values, page, set };
}

function ListShell<T>({
  title,
  subtitle,
  toolbar,
  state,
  empty,
  render,
  onPage,
}: {
  title: string;
  subtitle: string;
  toolbar: ReactNode;
  state: { data: Page<T> | null; error: unknown; loading: boolean; reload: () => void };
  empty: { icon: IconDefinition; title: string; message?: string };
  render: (item: T) => ReactNode;
  onPage: (page: number) => void;
}) {
  const { data, error, loading, reload } = state;
  return (
    <>
      <Topbar title={title} subtitle={data ? `${data.total.toLocaleString('en-IN')} · ${subtitle}` : subtitle} />
      <div className="toolbar">{toolbar}</div>
      {loading ? (
        <Loading />
      ) : error || !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <div className="glass list">
          {data.items.length === 0 ? <Empty {...empty} /> : data.items.map(render)}
          <Pager page={data.page} limit={data.limit} total={data.total} onPage={onPage} />
        </div>
      )}
    </>
  );
}

// ---------------- Accounts ----------------

export function AccountsPage() {
  const { values, page, set } = useFilters({ q: '', status: '' });
  const state = useApi(() => adminApi.accounts({ ...values, page, limit: LIMIT }), [values.q, values.status, page]);
  return (
    <ListShell
      title="All Accounts"
      subtitle="every customer, worker, shop owner and job seeker"
      toolbar={
        <>
          <SearchBox value={values.q} onChange={(value) => set('q', value)} placeholder="Search name, mobile or email" />
          <Segment
            value={values.status}
            onChange={(value) => set('status', value)}
            options={[
              { value: '', label: 'All' },
              { value: 'active', label: 'Active' },
              { value: 'suspended', label: 'Suspended' },
              { value: 'blocked', label: 'Banned' },
            ]}
          />
        </>
      }
      state={state}
      empty={{ icon: faUsers, title: 'No accounts found', message: 'Try a different search.' }}
      onPage={(next) => set('page', String(next))}
      render={(account) => {
        const status = accountStatus(account.status, account.suspendedUntil);
        return (
          <Link key={account.id} to={`/accounts/${account.id}`} className="row">
            <Avatar
              name={account.fullName}
              gradient={account.role === 'admin' ? 'linear-gradient(135deg,#0c0f14,#475569)' : undefined}
            />
            <div className="row-main">
              <div className="row-title">{account.fullName}</div>
              <div className="row-sub">
                {account.mobileNumber}
                {account.email ? ` · ${account.email}` : ''}
                {account.locationAddress ? ` · ${account.locationAddress}` : ''}
              </div>
            </div>
            <div className="row-side">
              {account.role === 'admin' ? <Badge tone="purple">Admin</Badge> : <Badge tone={status.tone}>{status.label}</Badge>}
              <span className="row-meta">Joined {timeAgo(account.createdAt)}</span>
            </div>
          </Link>
        );
      }}
    />
  );
}

// ---------------- Workers & shops (verification) ----------------

const VERIFICATION_TABS = [
  { value: 'pending_verification', label: 'To review' },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' },
  { value: '', label: 'All' },
];

export function WorkersPage() {
  const { values, page, set } = useFilters({ q: '', status: 'pending_verification' });
  const state = useApi(() => adminApi.workers({ ...values, page, limit: LIMIT }), [values.q, values.status, page]);
  return (
    <ListShell
      title="Workers"
      subtitle="service profiles — review, approve, search"
      toolbar={
        <>
          <SearchBox value={values.q} onChange={(value) => set('q', value)} placeholder="Search worker name or mobile" />
          <Segment value={values.status} onChange={(value) => set('status', value)} options={VERIFICATION_TABS} />
        </>
      }
      state={state}
      empty={{ icon: faScrewdriverWrench, title: 'No workers here' }}
      onPage={(next) => set('page', String(next))}
      render={(worker) => {
        const status = verificationStatus(worker.verificationStatus);
        const standing = accountStatus(worker.accountStatus);
        return (
          <Link
            key={worker.id}
            to={`/workers/${worker.id}`}
            className={`row${worker.verificationStatus === 'pending_verification' ? ' pending' : ''}`}
          >
            <Avatar name={worker.accountFullName} />
            <div className="row-main">
              <div className="row-title">{worker.accountFullName}</div>
              <div className="row-sub">
                {skillsLabel(worker.skillCategories)} · {worker.experienceYears} yr · {formatAddress(worker)} ·{' '}
                {worker.accountMobileNumber}
              </div>
            </div>
            {(worker.profilePhotoUrl ?? worker.portfolioPhotoUrls[0]) ? (
              <Thumb url={worker.profilePhotoUrl ?? worker.portfolioPhotoUrls[0]} count={worker.portfolioPhotoUrls.length} />
            ) : null}
            <div className="row-side">
              <Badge tone={status.tone}>{status.label}</Badge>
              {worker.accountStatus !== 'active' ? <Badge tone={standing.tone}>{standing.label}</Badge> : null}
              <span className="row-meta">
                {worker.ratingCount ? `★ ${worker.ratingAverage} (${worker.ratingCount})` : timeAgo(worker.createdAt)}
              </span>
            </div>
          </Link>
        );
      }}
    />
  );
}

export function ShopsPage() {
  const { values, page, set } = useFilters({ q: '', status: 'pending_verification' });
  const state = useApi(() => adminApi.shops({ ...values, page, limit: LIMIT }), [values.q, values.status, page]);
  return (
    <ListShell
      title="Shops"
      subtitle="business profiles — review, approve, search"
      toolbar={
        <>
          <SearchBox value={values.q} onChange={(value) => set('q', value)} placeholder="Search shop, owner or mobile" />
          <Segment value={values.status} onChange={(value) => set('status', value)} options={VERIFICATION_TABS} />
        </>
      }
      state={state}
      empty={{ icon: faStore, title: 'No shops here' }}
      onPage={(next) => set('page', String(next))}
      render={(shop) => {
        const status = verificationStatus(shop.verificationStatus);
        const standing = accountStatus(shop.accountStatus);
        return (
          <Link
            key={shop.id}
            to={`/shops/${shop.id}`}
            className={`row${shop.verificationStatus === 'pending_verification' ? ' pending' : ''}`}
          >
            <Avatar
              name={shop.shopName}
              photo={shop.shopPhotoUrls[0]}
              square
              gradient="linear-gradient(135deg,#16a34a,#4ade80)"
            />
            <div className="row-main">
              <div className="row-title">{shop.shopName}</div>
              <div className="row-sub">
                {shop.shopCategories.map(shopCategoryLabel).join(', ')} · {shop.accountFullName} · {formatAddress(shop)}
              </div>
            </div>
            <div className="row-side">
              <Badge tone={status.tone}>{status.label}</Badge>
              {shop.accountStatus !== 'active' ? <Badge tone={standing.tone}>{standing.label}</Badge> : null}
              <span className="row-meta">{shop.deliveryAvailable ? 'Delivers' : 'Pickup only'}</span>
            </div>
          </Link>
        );
      }}
    />
  );
}

// ---------------- Bookings (Quick Book / problem trips) ----------------

export function BookingsPage({ kind }: { kind: 'quick' | 'problem' }) {
  const navigate = useNavigate();
  const { values, page, set } = useFilters({ q: '', group: 'active' });
  const isQuick = kind !== 'problem';
  const state = useApi(
    () => adminApi.bookings({ ...values, kind: isQuick ? 'quick' : 'problem', page, limit: LIMIT }),
    [values.q, values.group, page, kind],
  );
  return (
    <ListShell
      title={isQuick ? 'Quick Book' : 'Problem Job Trips'}
      subtitle={isQuick ? 'instant bookings — every step, live' : 'trips started from accepted problem posts'}
      toolbar={
        <>
          <Segment
            value={isQuick ? 'quick' : 'problem'}
            onChange={(value) => navigate(`/bookings/${value}?group=${values.group}`)}
            options={[
              { value: 'quick', label: 'Quick Book' },
              { value: 'problem', label: 'Problem trips' },
            ]}
          />
          <SearchBox
            value={values.q}
            onChange={(value) => set('q', value)}
            placeholder="Search customer, worker, area or skill"
          />
          <Segment
            value={values.group}
            onChange={(value) => set('group', value)}
            options={[
              { value: 'active', label: 'In progress' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' },
              ...(isQuick ? [{ value: 'expired', label: 'No worker found' }] : []),
              { value: '', label: 'All' },
            ]}
          />
        </>
      }
      state={state}
      empty={{ icon: faBolt, title: 'No bookings here' }}
      onPage={(next) => set('page', String(next))}
      render={(booking) => {
        const status = bookingStatus(booking.status);
        return (
          <Link
            key={booking.id}
            to={`/bookings/${booking.id}`}
            className={`row${BOOKING_ACTIVE.includes(booking.status) ? ' pending' : ''}`}
          >
            <Avatar
              name={booking.customer.fullName}
              gradient={isQuick ? 'linear-gradient(135deg,#0d9488,#2dd4bf)' : 'linear-gradient(135deg,#7c3aed,#a78bfa)'}
            />
            <div className="row-main">
              <div className="row-title">{booking.customer.fullName}</div>
              <div className="row-sub">
                {skillsLabel(booking.skillCategories)} ·{' '}
                {booking.worker
                  ? `Worker: ${booking.worker.fullName}`
                  : `${booking.offerCount} worker${booking.offerCount === 1 ? '' : 's'} offered`}
                {booking.quotationAmount != null ? ` · ${rupees(booking.quotationAmount)}` : ''}
              </div>
            </div>
            <div className="row-side">
              <Badge tone={status.tone}>{status.label}</Badge>
              <span className="row-meta">{timeAgo(booking.createdAt)}</span>
            </div>
          </Link>
        );
      }}
    />
  );
}

// ---------------- Problem posts ----------------

export function ProblemsPage() {
  const { values, page, set } = useFilters({ q: '', group: 'open' });
  const state = useApi(() => adminApi.problems({ ...values, page, limit: LIMIT }), [values.q, values.group, page]);
  return (
    <ListShell
      title="Problem Jobs"
      subtitle="problems customers posted for nearby workers"
      toolbar={
        <>
          <SearchBox
            value={values.q}
            onChange={(value) => set('q', value)}
            placeholder="Search customer, worker, area or details"
          />
          <Segment
            value={values.group}
            onChange={(value) => set('group', value)}
            options={[
              { value: 'open', label: 'Waiting' },
              { value: 'in_progress', label: 'In progress' },
              { value: 'completed', label: 'Completed' },
              { value: 'closed', label: 'Closed' },
              { value: '', label: 'All' },
            ]}
          />
          <Link to="/bookings/problem" className="btn btn-ghost btn-sm">
            Their trips
          </Link>
        </>
      }
      state={state}
      empty={{ icon: faClipboardList, title: 'No problem posts here' }}
      onPage={(next) => set('page', String(next))}
      render={(problem) => {
        const status = problemStatus(problem.status);
        return (
          <Link
            key={problem.id}
            to={`/problems/${problem.id}`}
            className={`row${['open', 'accepted', 'work_done'].includes(problem.status) ? ' pending' : ''}`}
          >
            <Avatar name={problem.customerFullName} gradient="linear-gradient(135deg,#7c3aed,#a78bfa)" />
            <div className="row-main">
              <div className="row-title">{problem.customerFullName}</div>
              <div className="row-sub">
                {skillsLabel(problem.skillCategories)} · {rupees(problem.quotationAmount)}
                {problem.workerFullName ? ` · Worker: ${problem.workerFullName}` : ''}
                {problem.locationAddress ? ` · ${problem.locationAddress}` : ''}
              </div>
            </div>
            {problem.photoUrls[0] ? <Thumb url={problem.photoUrls[0]} count={problem.photoUrls.length} /> : null}
            <div className="row-side">
              <Badge tone={status.tone}>{status.label}</Badge>
              <span className="row-meta">{timeAgo(problem.createdAt)}</span>
            </div>
          </Link>
        );
      }}
    />
  );
}

// ---------------- Shop orders ----------------

export function OrdersPage() {
  const { values, page, set } = useFilters({ q: '', group: 'new' });
  const state = useApi(() => adminApi.orders({ ...values, page, limit: LIMIT }), [values.q, values.group, page]);
  return (
    <ListShell
      title="Shop Orders"
      subtitle="lists customers sent to shops"
      toolbar={
        <>
          <SearchBox value={values.q} onChange={(value) => set('q', value)} placeholder="Search customer, shop or owner" />
          <Segment
            value={values.group}
            onChange={(value) => set('group', value)}
            options={[
              { value: 'new', label: 'New' },
              { value: 'active', label: 'In progress' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' },
              { value: '', label: 'All' },
            ]}
          />
        </>
      }
      state={state}
      empty={{ icon: faBasketShopping, title: 'No orders here' }}
      onPage={(next) => set('page', String(next))}
      render={(order) => {
        const status = orderStatus(order.status);
        return (
          <Link
            key={order.id}
            to={`/orders/${order.id}`}
            className={`row${ORDER_ACTIVE.includes(order.status) ? ' pending' : ''}`}
          >
            <Avatar name={order.customer.fullName} gradient="linear-gradient(135deg,#db2777,#f472b6)" />
            <div className="row-main">
              <div className="row-title">
                {order.customer.fullName} → {order.shop.name}
              </div>
              <div className="row-sub">
                {order.items.length} item{order.items.length === 1 ? '' : 's'} ·{' '}
                {order.fulfillment === 'delivery' ? `Delivery (${distance(order.distanceMeters)})` : 'Pickup'}
                {order.totalAmount != null ? ` · ${rupees(order.totalAmount)}` : ''}
              </div>
            </div>
            <div className="row-side">
              <Badge tone={status.tone}>{status.label}</Badge>
              <span className="row-meta">{timeAgo(order.createdAt)}</span>
            </div>
          </Link>
        );
      }}
    />
  );
}

// ---------------- Job posts ----------------

export function JobPostsPage() {
  const { values, page, set } = useFilters({ q: '', active: '' });
  const state = useApi(() => adminApi.jobPosts({ ...values, page, limit: LIMIT }), [values.q, values.active, page]);
  return (
    <ListShell
      title="Job Posts"
      subtitle="people looking for regular work (Hire Staff)"
      toolbar={
        <>
          <SearchBox value={values.q} onChange={(value) => set('q', value)} placeholder="Search name, mobile, work or area" />
          <Segment
            value={values.active}
            onChange={(value) => set('active', value)}
            options={[
              { value: '', label: 'All' },
              { value: 'true', label: 'Live' },
              { value: 'false', label: 'Hidden' },
            ]}
          />
        </>
      }
      state={state}
      empty={{ icon: faBriefcase, title: 'No job posts here' }}
      onPage={(next) => set('page', String(next))}
      render={(post) => (
        <Link key={post.id} to={`/job-posts/${post.id}`} className="row">
          <Avatar name={post.fullName} photo={post.photoUrl} gradient="linear-gradient(135deg,#4338ca,#c026d3)" />
          <div className="row-main">
            <div className="row-title">{post.fullName}</div>
            <div className="row-sub">
              {post.title || jobCategoryLabel(post.category)} · {rupees(post.payAmount)}/
              {post.payPeriod === 'daily' ? 'day' : 'month'} · {post.experienceYears} yr
              {post.locationAddress ? ` · ${post.locationAddress}` : ''}
            </div>
          </div>
          <div className="row-side">
            <Badge tone={post.isActive ? 'success' : 'muted'}>{post.isActive ? 'Live' : 'Hidden'}</Badge>
            <span className="row-meta">{timeAgo(post.updatedAt)}</span>
          </div>
        </Link>
      )}
    />
  );
}

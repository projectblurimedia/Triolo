import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faBasketShopping,
  faBolt,
  faBriefcase,
  faCircleCheck,
  faClipboardList,
  faRotate,
  faScrewdriverWrench,
  faStore,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { Topbar } from '@/components/Layout';
import { Avatar, Badge, Empty, ErrorState, Loading, SectionHead } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { adminApi } from '@/services/adminApi';
import { formatAddress, skillsLabel, timeAgo, Tone } from '@/utils/format';

interface StatCardProps {
  to: string;
  icon: IconDefinition;
  gradient: string;
  value: number;
  label: string;
  chips: { tone: Tone; text: string }[];
}

function StatCard({ to, icon, gradient, value, label, chips }: StatCardProps) {
  return (
    <Link to={to} className="stat glass">
      <FontAwesomeIcon icon={icon} className="stat-watermark" />
      <span className="stat-icon" style={{ background: gradient }}>
        <FontAwesomeIcon icon={icon} />
      </span>
      <span className="stat-value">{value.toLocaleString('en-IN')}</span>
      <span className="stat-label">{label}</span>
      <span className="stat-sub">
        {chips.map((chip) => (
          <Badge key={chip.text} tone={chip.tone} dot={false}>
            {chip.text}
          </Badge>
        ))}
      </span>
    </Link>
  );
}

export function DashboardPage() {
  const { data, error, loading, reload } = useApi(
    () =>
      Promise.all([
        adminApi.stats(),
        adminApi.workers({ status: 'pending_verification', limit: 5 }),
        adminApi.shops({ status: 'pending_verification', limit: 5 }),
        adminApi.bookings({ group: 'active', limit: 5 }),
        adminApi.orders({ group: 'new', limit: 5 }),
      ]),
    [],
  );

  const topbar = (
    <Topbar
      title="Dashboard"
      subtitle="Everything happening on Triolo, at a glance"
      actions={
        <button className="btn btn-ghost" onClick={reload}>
          <FontAwesomeIcon icon={faRotate} /> Refresh
        </button>
      }
    />
  );

  if (loading)
    return (
      <>
        {topbar}
        <Loading />
      </>
    );
  if (error || !data)
    return (
      <>
        {topbar}
        <ErrorState error={error} onRetry={reload} />
      </>
    );

  const [stats, workers, shops, bookings, orders] = data;
  const attention = workers.items.length + shops.items.length + bookings.items.length + orders.items.length;

  return (
    <>
      {topbar}
      <div className="stats">
        <StatCard
          to="/accounts"
          icon={faUsers}
          gradient="linear-gradient(135deg,#4338ca,#7c3aed)"
          value={stats.accounts.total}
          label="Accounts"
          chips={[
            { tone: 'info', text: `+${stats.accounts.newToday} today` },
            ...(stats.accounts.suspended ? [{ tone: 'warning' as Tone, text: `${stats.accounts.suspended} suspended` }] : []),
            ...(stats.accounts.blocked ? [{ tone: 'error' as Tone, text: `${stats.accounts.blocked} banned` }] : []),
          ]}
        />
        <StatCard
          to="/workers"
          icon={faScrewdriverWrench}
          gradient="linear-gradient(135deg,#0055d3,#1d76fa)"
          value={stats.workers.total}
          label="Workers"
          chips={[
            { tone: 'success', text: `${stats.workers.verified} verified` },
            ...(stats.workers.pending ? [{ tone: 'pending' as Tone, text: `${stats.workers.pending} to review` }] : []),
          ]}
        />
        <StatCard
          to="/shops"
          icon={faStore}
          gradient="linear-gradient(135deg,#16a34a,#4ade80)"
          value={stats.businesses.total}
          label="Shops"
          chips={[
            { tone: 'success', text: `${stats.businesses.verified} verified` },
            ...(stats.businesses.pending ? [{ tone: 'pending' as Tone, text: `${stats.businesses.pending} to review` }] : []),
          ]}
        />
        <StatCard
          to="/job-posts"
          icon={faBriefcase}
          gradient="linear-gradient(135deg,#4338ca,#c026d3)"
          value={stats.jobPosts.total}
          label="Job posts"
          chips={[{ tone: 'success', text: `${stats.jobPosts.live} live` }]}
        />
      </div>

      <SectionHead title="Activity" />
      <div className="stats">
        <StatCard
          to="/bookings/quick?group=active"
          icon={faBolt}
          gradient="linear-gradient(135deg,#0d9488,#2dd4bf)"
          value={stats.bookings.active}
          label="Bookings in progress"
          chips={[
            ...(stats.bookings.searching
              ? [{ tone: 'pending' as Tone, text: `${stats.bookings.searching} finding a worker` }]
              : []),
            { tone: 'success', text: `${stats.bookings.completed} completed` },
            { tone: 'info', text: `${stats.bookings.today} today` },
          ]}
        />
        <StatCard
          to="/orders?group=active"
          icon={faBasketShopping}
          gradient="linear-gradient(135deg,#db2777,#f472b6)"
          value={stats.orders.new + stats.orders.active}
          label="Shop orders in progress"
          chips={[
            ...(stats.orders.new ? [{ tone: 'pending' as Tone, text: `${stats.orders.new} new` }] : []),
            { tone: 'success', text: `${stats.orders.completed} completed` },
            { tone: 'info', text: `${stats.orders.today} today` },
          ]}
        />
        <StatCard
          to="/problems?group=open"
          icon={faClipboardList}
          gradient="linear-gradient(135deg,#7c3aed,#a78bfa)"
          value={stats.problems.open + stats.problems.inProgress}
          label="Problem posts open"
          chips={[
            { tone: 'pending', text: `${stats.problems.open} waiting` },
            { tone: 'info', text: `${stats.problems.inProgress} in progress` },
            { tone: 'success', text: `${stats.problems.completed} done` },
          ]}
        />
      </div>

      <SectionHead
        title="Needs your attention"
        right={
          <span className="muted">
            {attention} item{attention === 1 ? '' : 's'}
          </span>
        }
      />
      {attention === 0 ? (
        <div className="glass">
          <Empty icon={faCircleCheck} title="All caught up" message="Nothing is waiting for review right now." />
        </div>
      ) : (
        <div className="grid-2">
          {workers.items.length ? (
            <div className="glass list">
              <div className="card-title" style={{ padding: '16px 18px 0' }}>
                Workers to review <span className="count">{stats.workers.pending}</span>
              </div>
              {workers.items.map((worker) => (
                <Link key={worker.id} to={`/workers/${worker.id}`} className="row pending">
                  <Avatar name={worker.accountFullName} />
                  <div className="row-main">
                    <div className="row-title">{worker.accountFullName}</div>
                    <div className="row-sub">
                      {skillsLabel(worker.skillCategories)} · {formatAddress(worker)}
                    </div>
                  </div>
                  <span className="row-meta">{timeAgo(worker.createdAt)}</span>
                </Link>
              ))}
            </div>
          ) : null}
          {shops.items.length ? (
            <div className="glass list">
              <div className="card-title" style={{ padding: '16px 18px 0' }}>
                Shops to review <span className="count">{stats.businesses.pending}</span>
              </div>
              {shops.items.map((shop) => (
                <Link key={shop.id} to={`/shops/${shop.id}`} className="row pending">
                  <Avatar
                    name={shop.shopName}
                    photo={shop.profilePhotoUrl}
                    square
                    gradient="linear-gradient(135deg,#16a34a,#4ade80)"
                  />
                  <div className="row-main">
                    <div className="row-title">{shop.shopName}</div>
                    <div className="row-sub">
                      {shop.accountFullName} · {formatAddress(shop)}
                    </div>
                  </div>
                  <span className="row-meta">{timeAgo(shop.createdAt)}</span>
                </Link>
              ))}
            </div>
          ) : null}
          {bookings.items.length ? (
            <div className="glass list">
              <div className="card-title" style={{ padding: '16px 18px 0' }}>
                Bookings in progress <span className="count">{stats.bookings.active}</span>
              </div>
              {bookings.items.map((booking) => (
                <Link key={booking.id} to={`/bookings/${booking.id}`} className="row pending">
                  <Avatar name={booking.customer.fullName} gradient="linear-gradient(135deg,#0d9488,#2dd4bf)" />
                  <div className="row-main">
                    <div className="row-title">{booking.customer.fullName}</div>
                    <div className="row-sub">
                      {skillsLabel(booking.skillCategories)} · {booking.worker ? booking.worker.fullName : 'finding a worker'}
                    </div>
                  </div>
                  <span className="row-meta">{timeAgo(booking.createdAt)}</span>
                </Link>
              ))}
            </div>
          ) : null}
          {orders.items.length ? (
            <div className="glass list">
              <div className="card-title" style={{ padding: '16px 18px 0' }}>
                New shop orders <span className="count">{stats.orders.new}</span>
              </div>
              {orders.items.map((order) => (
                <Link key={order.id} to={`/orders/${order.id}`} className="row pending">
                  <Avatar name={order.customer.fullName} gradient="linear-gradient(135deg,#db2777,#f472b6)" />
                  <div className="row-main">
                    <div className="row-title">{order.customer.fullName}</div>
                    <div className="row-sub">
                      {order.shop.name} · {order.items.length} item{order.items.length === 1 ? '' : 's'}
                    </div>
                  </div>
                  <span className="row-meta">{timeAgo(order.createdAt)}</span>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}

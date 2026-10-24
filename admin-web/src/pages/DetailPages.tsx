import { ReactNode, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBan,
  faBasketShopping,
  faBolt,
  faBriefcase,
  faCalendar,
  faCircleCheck,
  faCircleXmark,
  faClipboardList,
  faClock,
  faEnvelope,
  faEye,
  faEyeSlash,
  faIndianRupeeSign,
  faLanguage,
  faLocationDot,
  faPhone,
  faScrewdriverWrench,
  faStar,
  faStore,
  faTrash,
  faTriangleExclamation,
  faTruck,
  faUser,
  faUserTie,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { Topbar, useLayout } from '@/components/Layout';
import { AccountActions } from '@/components/AccountActions';
import { ConfirmModal } from '@/components/ConfirmModal';
import {
  Avatar,
  BackLink,
  Badge,
  Empty,
  ErrorState,
  InfoRow,
  Loading,
  Notice,
  Photos,
  SectionHead,
  Thumb,
} from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { adminApi, AdminBooking, AdminOrder, AdminProblem } from '@/services/adminApi';
import { getErrorMessage } from '@/services/errorMessages';
import { showToast } from '@/state/toastStore';
import {
  accountStatus,
  AVAILABILITY,
  BOOKING_ACTIVE,
  bookingStatus,
  cancelledByLabel,
  distance,
  formatAddress,
  formatDate,
  formatDateTime,
  jobCategoryLabel,
  ORDER_ACTIVE,
  orderStatus,
  problemStatus,
  rupees,
  shopCategoryLabel,
  skillLabel,
  skillsLabel,
  stars,
  timeAgo,
  verificationStatus,
} from '@/utils/format';

// ---------------- Small shared pieces ----------------

function Page({
  title,
  subtitle,
  back,
  children,
}: {
  title: string;
  subtitle?: string;
  back: { to: string; label: string };
  children: ReactNode;
}) {
  return (
    <>
      <Topbar title={title} subtitle={subtitle} />
      <BackLink to={back.to} label={back.label} />
      {children}
    </>
  );
}

function Loader<T>({
  state,
  children,
}: {
  state: { data: T | null; error: unknown; loading: boolean; reload: () => void };
  children: (data: T) => ReactNode;
}) {
  if (state.loading) return <Loading />;
  if (state.error || !state.data) return <ErrorState error={state.error} onRetry={state.reload} />;
  return <>{children(state.data)}</>;
}

/** The person behind a profile / booking / order, one tap from their full account page. */
function PersonCard({
  title,
  accountId,
  name,
  mobile,
  extra,
}: {
  title: string;
  accountId: string;
  name: string;
  mobile: string;
  extra?: ReactNode;
}) {
  return (
    <div className="glass card">
      <div className="card-title">{title}</div>
      <Link to={`/accounts/${accountId}`} className="row" style={{ padding: '6px 0', borderBottom: 0 }}>
        <Avatar name={name} />
        <div className="row-main">
          <div className="row-title">{name}</div>
          <div className="row-sub">{mobile}</div>
        </div>
        <span className="btn btn-ghost btn-sm">View account</span>
      </Link>
      {extra}
      <a className="btn btn-ghost btn-sm" href={`tel:${mobile}`} style={{ marginTop: 10 }}>
        <FontAwesomeIcon icon={faPhone} /> Call
      </a>
    </div>
  );
}

function Step({ title, at, bad }: { title: string; at: string | null; bad?: boolean }) {
  return (
    <div className={`step${at ? (bad ? ' bad' : ' done') : ''}`}>
      <span className="step-dot">
        <FontAwesomeIcon icon={at ? (bad ? faCircleXmark : faCircleCheck) : faClock} />
      </span>
      <div>
        <div className="step-title">{title}</div>
        <div className="step-time">{at ? formatDateTime(at) : 'Not yet'}</div>
      </div>
    </div>
  );
}

function BookingRows({ bookings }: { bookings: AdminBooking[] }) {
  if (bookings.length === 0) return <Empty icon={faBolt} title="No bookings" />;
  return (
    <>
      {bookings.map((booking) => {
        const status = bookingStatus(booking.status);
        return (
          <Link
            key={booking.id}
            to={`/bookings/${booking.id}`}
            className={`row${BOOKING_ACTIVE.includes(booking.status) ? ' pending' : ''}`}
          >
            <Avatar
              name={booking.customer.fullName}
              gradient={
                booking.problemPostId ? 'linear-gradient(135deg,#7c3aed,#a78bfa)' : 'linear-gradient(135deg,#0d9488,#2dd4bf)'
              }
            />
            <div className="row-main">
              <div className="row-title">
                {booking.customer.fullName} {booking.worker ? `→ ${booking.worker.fullName}` : ''}
              </div>
              <div className="row-sub">
                {booking.problemPostId ? 'Problem trip' : 'Quick Book'} · {skillsLabel(booking.skillCategories)}
              </div>
            </div>
            <div className="row-side">
              <Badge tone={status.tone}>{status.label}</Badge>
              <span className="row-meta">{timeAgo(booking.createdAt)}</span>
            </div>
          </Link>
        );
      })}
    </>
  );
}

function OrderRows({ orders }: { orders: AdminOrder[] }) {
  if (orders.length === 0) return <Empty icon={faBasketShopping} title="No shop orders" />;
  return (
    <>
      {orders.map((order) => {
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
                {order.items.length} items {order.totalAmount != null ? `· ${rupees(order.totalAmount)}` : ''}
              </div>
            </div>
            <div className="row-side">
              <Badge tone={status.tone}>{status.label}</Badge>
              <span className="row-meta">{timeAgo(order.createdAt)}</span>
            </div>
          </Link>
        );
      })}
    </>
  );
}

function ProblemRows({ problems }: { problems: AdminProblem[] }) {
  if (problems.length === 0) return <Empty icon={faClipboardList} title="No problem posts" />;
  return (
    <>
      {problems.map((problem) => {
        const status = problemStatus(problem.status);
        return (
          <Link key={problem.id} to={`/problems/${problem.id}`} className="row">
            <Avatar name={problem.customerFullName} gradient="linear-gradient(135deg,#7c3aed,#a78bfa)" />
            <div className="row-main">
              <div className="row-title">{skillsLabel(problem.skillCategories)}</div>
              <div className="row-sub">
                {rupees(problem.quotationAmount)} · {problem.customerFullName}
              </div>
            </div>
            {problem.photoUrls[0] ? <Thumb url={problem.photoUrls[0]} count={problem.photoUrls.length} /> : null}
            <div className="row-side">
              <Badge tone={status.tone}>{status.label}</Badge>
              <span className="row-meta">{timeAgo(problem.createdAt)}</span>
            </div>
          </Link>
        );
      })}
    </>
  );
}

function useAction() {
  const { refreshStats } = useLayout();
  return async (work: () => Promise<unknown>, success: { title: string; message?: string }, after: () => void) => {
    try {
      await work();
      showToast({ variant: 'success', ...success });
      refreshStats();
      after();
    } catch (err) {
      showToast({ variant: 'error', title: 'Could not do that', message: getErrorMessage(err) });
    }
  };
}

// ---------------- Account ----------------

export function AccountDetailPage() {
  const { id = '' } = useParams();
  const state = useApi(() => adminApi.account(id), [id]);
  return (
    <Page title="Account" subtitle="everything about this person" back={{ to: '/accounts', label: 'All accounts' }}>
      <Loader state={state}>
        {({ account, workerProfile, businessProfile, jobPost, bookings, orders, problems }) => {
          const standing = accountStatus(account.status, account.suspendedUntil);
          return (
            <>
              <div className="hero">
                <Avatar name={account.fullName} />
                <div className="hero-text">
                  <h2>{account.fullName}</h2>
                  <p>
                    {account.mobileNumber}
                    {account.email ? ` · ${account.email}` : ''}
                  </p>
                  <div className="hero-badges">
                    {account.role === 'admin' ? (
                      <Badge tone="purple">Admin</Badge>
                    ) : (
                      <Badge tone={standing.tone}>{standing.label}</Badge>
                    )}
                    {workerProfile ? <Badge tone="info">Worker</Badge> : null}
                    {businessProfile ? <Badge tone="success">Shop owner</Badge> : null}
                    {jobPost ? <Badge tone="purple">Job seeker</Badge> : null}
                    <Badge tone="muted">Joined {formatDate(account.createdAt)}</Badge>
                  </div>
                </div>
              </div>

              {account.status !== 'active' && account.statusReason ? (
                <Notice tone={account.status === 'blocked' ? 'error' : 'warning'} icon={faTriangleExclamation}>
                  <strong>{account.status === 'blocked' ? 'Banned' : 'Suspended'}:</strong> {account.statusReason}
                </Notice>
              ) : null}

              <div className="grid-2">
                <div className="glass card">
                  <div className="card-title">Moderation</div>
                  <AccountActions account={account} onDone={state.reload} />
                </div>
                <div className="glass card">
                  <div className="card-title">Details</div>
                  <div className="info">
                    <InfoRow icon={faPhone} label="Mobile">
                      {account.mobileNumber}
                    </InfoRow>
                    <InfoRow icon={faEnvelope} label="Email">
                      {account.email ?? '—'}
                    </InfoRow>
                    <InfoRow icon={faLocationDot} label="Location">
                      {account.locationAddress ?? '—'}
                    </InfoRow>
                    <InfoRow icon={faLanguage} label="App language">
                      {account.preferredLanguage === 'te' ? 'Telugu' : 'English'}
                    </InfoRow>
                  </div>
                </div>
              </div>

              <SectionHead title="Profiles" />
              <div className="grid-2">
                <div className="glass card">
                  <div className="card-title">
                    <FontAwesomeIcon icon={faScrewdriverWrench} /> Services (worker)
                  </div>
                  {workerProfile ? (
                    <Link to={`/workers/${workerProfile.id}`} className="row" style={{ padding: '4px 0', borderBottom: 0 }}>
                      <Avatar name={account.fullName} />
                      <div className="row-main">
                        <div className="row-title">{skillsLabel(workerProfile.skillCategories)}</div>
                        <div className="row-sub">
                          {workerProfile.experienceYears} yr · {formatAddress(workerProfile)}
                          {workerProfile.ratingCount ? ` · ★ ${workerProfile.ratingAverage}` : ''}
                        </div>
                      </div>
                      <Badge tone={verificationStatus(workerProfile.verificationStatus).tone}>
                        {verificationStatus(workerProfile.verificationStatus).label}
                      </Badge>
                    </Link>
                  ) : (
                    <p className="muted">No worker profile.</p>
                  )}
                </div>
                <div className="glass card">
                  <div className="card-title">
                    <FontAwesomeIcon icon={faStore} /> Shop
                  </div>
                  {businessProfile ? (
                    <Link to={`/shops/${businessProfile.id}`} className="row" style={{ padding: '4px 0', borderBottom: 0 }}>
                      <Avatar
                        name={businessProfile.shopName}
                        photo={businessProfile.profilePhotoUrl}
                        square
                        gradient="linear-gradient(135deg,#16a34a,#4ade80)"
                      />
                      <div className="row-main">
                        <div className="row-title">{businessProfile.shopName}</div>
                        <div className="row-sub">
                          {businessProfile.shopCategories.map(shopCategoryLabel).join(', ')} · {formatAddress(businessProfile)}
                        </div>
                      </div>
                      <Badge tone={verificationStatus(businessProfile.verificationStatus).tone}>
                        {verificationStatus(businessProfile.verificationStatus).label}
                      </Badge>
                    </Link>
                  ) : (
                    <p className="muted">No shop.</p>
                  )}
                </div>
                <div className="glass card">
                  <div className="card-title">
                    <FontAwesomeIcon icon={faBriefcase} /> Job post
                  </div>
                  {jobPost ? (
                    <Link to={`/job-posts/${jobPost.id}`} className="row" style={{ padding: '4px 0', borderBottom: 0 }}>
                      <Avatar
                        name={account.fullName}
                        photo={jobPost.photoUrl}
                        gradient="linear-gradient(135deg,#4338ca,#c026d3)"
                      />
                      <div className="row-main">
                        <div className="row-title">{jobPost.title || jobCategoryLabel(jobPost.category)}</div>
                        <div className="row-sub">
                          {rupees(jobPost.payAmount)}/{jobPost.payPeriod === 'daily' ? 'day' : 'month'}
                        </div>
                      </div>
                      <Badge tone={jobPost.isActive ? 'success' : 'muted'}>{jobPost.isActive ? 'Live' : 'Hidden'}</Badge>
                    </Link>
                  ) : (
                    <p className="muted">No job post.</p>
                  )}
                </div>
              </div>

              <SectionHead title="Bookings" right={<span className="muted">{bookings.length}</span>} />
              <div className="glass list">
                <BookingRows bookings={bookings} />
              </div>
              <SectionHead title="Shop orders" right={<span className="muted">{orders.length}</span>} />
              <div className="glass list">
                <OrderRows orders={orders} />
              </div>
              <SectionHead title="Problem posts" right={<span className="muted">{problems.length}</span>} />
              <div className="glass list">
                <ProblemRows problems={problems} />
              </div>
            </>
          );
        }}
      </Loader>
    </Page>
  );
}

// ---------------- Worker / shop verification ----------------

function VerificationActions({
  status,
  onDecide,
}: {
  status: string;
  onDecide: (decision: 'verified' | 'rejected') => Promise<void>;
}) {
  const [confirm, setConfirm] = useState<'verified' | 'rejected' | null>(null);
  return (
    <>
      <div className="actions">
        {status !== 'verified' ? (
          <button className="btn btn-success" onClick={() => setConfirm('verified')}>
            <FontAwesomeIcon icon={faCircleCheck} /> Approve
          </button>
        ) : null}
        {status !== 'rejected' ? (
          <button className="btn btn-danger" onClick={() => setConfirm('rejected')}>
            <span className="btn-badge">
              <FontAwesomeIcon icon={faCircleXmark} />
            </span>
            Reject
          </button>
        ) : null}
      </div>
      <ConfirmModal
        open={confirm !== null}
        icon={confirm === 'verified' ? faCircleCheck : faCircleXmark}
        tone={confirm === 'verified' ? 'success' : 'danger'}
        title={confirm === 'verified' ? 'Approve this profile?' : 'Reject this profile?'}
        message={
          confirm === 'verified'
            ? 'It goes live straight away: customers nearby can find and book them.'
            : 'They stop appearing to customers until approved again.'
        }
        confirmLabel={confirm === 'verified' ? 'Approve' : 'Reject'}
        onConfirm={async () => {
          if (confirm) await onDecide(confirm);
          setConfirm(null);
        }}
        onClose={() => setConfirm(null)}
      />
    </>
  );
}

export function WorkerDetailPage() {
  const { id = '' } = useParams();
  const state = useApi(() => adminApi.worker(id), [id]);
  const act = useAction();
  return (
    <Page title="Worker" subtitle="service profile" back={{ to: '/workers', label: 'Workers' }}>
      <Loader state={state}>
        {(worker) => {
          const status = verificationStatus(worker.verificationStatus);
          const standing = accountStatus(worker.accountStatus);
          return (
            <>
              <div className="hero">
                <Avatar name={worker.accountFullName} photo={worker.profilePhotoUrl ?? undefined} />
                <div className="hero-text">
                  <h2>{worker.accountFullName}</h2>
                  <p>{skillsLabel(worker.skillCategories)}</p>
                  <div className="hero-badges">
                    <Badge tone={status.tone}>{status.label}</Badge>
                    {worker.accountStatus !== 'active' ? <Badge tone={standing.tone}>{standing.label}</Badge> : null}
                    <Badge tone="muted">
                      {worker.ratingCount ? `★ ${worker.ratingAverage} · ${worker.ratingCount} ratings` : 'No ratings yet'}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="grid-2">
                <div className="glass card">
                  <div className="card-title">Verification</div>
                  <VerificationActions
                    status={worker.verificationStatus}
                    onDecide={(decision) =>
                      act(
                        () => adminApi.verifyWorker(worker.id, decision),
                        { title: decision === 'verified' ? 'Worker approved' : 'Worker rejected' },
                        state.reload,
                      )
                    }
                  />
                </div>
                <PersonCard
                  title="Account"
                  accountId={worker.accountId}
                  name={worker.accountFullName}
                  mobile={worker.accountMobileNumber}
                  extra={
                    <div style={{ marginTop: 12 }}>
                      <AccountActions
                        account={{
                          id: worker.accountId,
                          fullName: worker.accountFullName,
                          status: worker.accountStatus,
                          role: 'user',
                          suspendedUntil: null,
                        }}
                        onDone={state.reload}
                      />
                    </div>
                  }
                />
              </div>
              <div className="grid-2" style={{ marginTop: 16 }}>
                <div className="glass card">
                  <div className="card-title">Details</div>
                  <div className="info">
                    <InfoRow icon={faScrewdriverWrench} label="Skills">
                      <div className="chips">
                        {worker.skillCategories.map((key) => (
                          <span key={key} className="tag">
                            {skillLabel(key)}
                          </span>
                        ))}
                      </div>
                      {worker.otherSkillDescription ? <div className="muted">Other: {worker.otherSkillDescription}</div> : null}
                    </InfoRow>
                    <InfoRow icon={faCalendar} label="Experience">
                      {worker.experienceYears} year{worker.experienceYears === 1 ? '' : 's'}
                    </InfoRow>
                    <InfoRow icon={faLocationDot} label="Service location">
                      {formatAddress(worker)}
                    </InfoRow>
                    <InfoRow icon={faStar} label="Rating">
                      {worker.ratingCount ? `${worker.ratingAverage} from ${worker.ratingCount} customers` : 'Not rated yet'}
                    </InfoRow>
                    <InfoRow icon={faClock} label="Registered / updated">
                      {formatDate(worker.createdAt)} · {formatDate(worker.updatedAt)}
                    </InfoRow>
                  </div>
                </div>
                <div className="glass card">
                  <div className="card-title">
                    Portfolio photos <span className="count">{worker.portfolioPhotoUrls.length}</span>
                  </div>
                  <Photos urls={worker.portfolioPhotoUrls} />
                </div>
              </div>
            </>
          );
        }}
      </Loader>
    </Page>
  );
}

export function ShopDetailPage() {
  const { id = '' } = useParams();
  const state = useApi(() => adminApi.shop(id), [id]);
  const act = useAction();
  return (
    <Page title="Shop" subtitle="business profile" back={{ to: '/shops', label: 'Shops' }}>
      <Loader state={state}>
        {(shop) => {
          const status = verificationStatus(shop.verificationStatus);
          const standing = accountStatus(shop.accountStatus);
          return (
            <>
              <div className="hero" style={{ background: 'linear-gradient(135deg,#0055d3,#16a34a)' }}>
                <Avatar name={shop.shopName} photo={shop.profilePhotoUrl} />
                <div className="hero-text">
                  <h2>{shop.shopName}</h2>
                  <p>
                    {shop.shopCategories.map(shopCategoryLabel).join(', ')} · Owner {shop.accountFullName}
                  </p>
                  <div className="hero-badges">
                    <Badge tone={status.tone}>{status.label}</Badge>
                    {shop.accountStatus !== 'active' ? <Badge tone={standing.tone}>{standing.label}</Badge> : null}
                    <Badge tone="muted">
                      {shop.ratingCount ? `★ ${shop.ratingAverage} · ${shop.ratingCount} ratings` : 'No ratings yet'}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="grid-2">
                <div className="glass card">
                  <div className="card-title">Verification</div>
                  <VerificationActions
                    status={shop.verificationStatus}
                    onDecide={(decision) =>
                      act(
                        () => adminApi.verifyShop(shop.id, decision),
                        { title: decision === 'verified' ? 'Shop approved' : 'Shop rejected' },
                        state.reload,
                      )
                    }
                  />
                </div>
                <PersonCard
                  title="Owner"
                  accountId={shop.accountId}
                  name={shop.accountFullName}
                  mobile={shop.accountMobileNumber}
                  extra={
                    <div style={{ marginTop: 12 }}>
                      <AccountActions
                        account={{
                          id: shop.accountId,
                          fullName: shop.accountFullName,
                          status: shop.accountStatus,
                          role: 'user',
                          suspendedUntil: null,
                        }}
                        onDone={state.reload}
                      />
                    </div>
                  }
                />
              </div>
              <div className="grid-2" style={{ marginTop: 16 }}>
                <div className="glass card">
                  <div className="card-title">Details</div>
                  <div className="info">
                    <InfoRow icon={faStore} label="Categories">
                      {shop.shopCategories.map(shopCategoryLabel).join(', ')}
                      {shop.otherCategoryDescription ? ` (${shop.otherCategoryDescription})` : ''}
                    </InfoRow>
                    <InfoRow icon={faTruck} label="Delivery">
                      {shop.deliveryAvailable
                        ? `Yes — ${rupees(shop.deliveryPricePerKm)} per km, minimum ${rupees(shop.deliveryMinCharge)}`
                        : 'Pickup only'}
                    </InfoRow>
                    <InfoRow icon={faLocationDot} label="Shop address">
                      {formatAddress(shop)}
                    </InfoRow>
                    <InfoRow icon={faClock} label="Registered / updated">
                      {formatDate(shop.createdAt)} · {formatDate(shop.updatedAt)}
                    </InfoRow>
                  </div>
                </div>
                <div className="glass card">
                  <div className="card-title">
                    Shop photos <span className="count">{shop.shopPhotoUrls.length}</span>
                  </div>
                  <Photos urls={shop.shopPhotoUrls} />
                </div>
              </div>
            </>
          );
        }}
      </Loader>
    </Page>
  );
}

// ---------------- Booking ----------------

export function BookingDetailPage() {
  const { id = '' } = useParams();
  const state = useApi(() => adminApi.booking(id), [id]);
  const act = useAction();
  const [confirm, setConfirm] = useState(false);
  return (
    <Page title="Booking" subtitle="every step of this job" back={{ to: '/bookings/quick', label: 'Bookings' }}>
      <Loader state={state}>
        {(booking) => {
          const status = bookingStatus(booking.status);
          const active = BOOKING_ACTIVE.includes(booking.status);
          const isProblem = !!booking.problemPostId;
          return (
            <>
              <div
                className="hero"
                style={{
                  background: isProblem ? 'linear-gradient(135deg,#7c3aed,#a78bfa)' : 'linear-gradient(135deg,#0d9488,#2dd4bf)',
                }}
              >
                <Avatar name={booking.customer.fullName} />
                <div className="hero-text">
                  <h2>{skillsLabel(booking.skillCategories)}</h2>
                  <p>
                    {isProblem ? 'Problem job trip' : 'Quick Book'} · {booking.customer.fullName}
                    {booking.worker ? ` → ${booking.worker.fullName}` : ''}
                  </p>
                  <div className="hero-badges">
                    <Badge tone={status.tone}>{status.label}</Badge>
                    <Badge tone="muted">Booked {formatDateTime(booking.createdAt)}</Badge>
                  </div>
                </div>
                {active ? (
                  <button
                    className="btn btn-solid-danger"
                    style={{ position: 'relative', zIndex: 1 }}
                    onClick={() => setConfirm(true)}
                  >
                    <FontAwesomeIcon icon={faBan} /> Cancel booking
                  </button>
                ) : null}
              </div>

              {booking.status === 'cancelled' ? (
                <Notice tone="error" icon={faCircleXmark}>
                  Cancelled by <strong>{cancelledByLabel(booking.cancelledBy)}</strong> on {formatDateTime(booking.cancelledAt)}
                  {booking.cancelReason ? ` — “${booking.cancelReason}”` : ''}
                </Notice>
              ) : null}
              {booking.status === 'expired' ? (
                <Notice tone="muted" icon={faClock}>
                  No worker accepted in time ({booking.offerCount} worker{booking.offerCount === 1 ? ' was' : 's were'} offered
                  it).
                </Notice>
              ) : null}

              <div className="grid-2">
                <PersonCard
                  title="Customer"
                  accountId={booking.customer.accountId}
                  name={booking.customer.fullName}
                  mobile={booking.customer.mobileNumber}
                />
                {booking.worker ? (
                  <PersonCard
                    title="Worker"
                    accountId={booking.worker.accountId}
                    name={booking.worker.fullName}
                    mobile={booking.worker.mobileNumber}
                  />
                ) : (
                  <div className="glass card">
                    <div className="card-title">Worker</div>
                    <p className="muted">
                      {booking.status === 'broadcasting' ? 'Still finding a worker…' : 'No worker took this job.'}
                    </p>
                  </div>
                )}
              </div>

              <div className="grid-2" style={{ marginTop: 16 }}>
                <div className="glass card">
                  <div className="card-title">Progress</div>
                  <div className="timeline">
                    <Step title="Booked" at={booking.createdAt} />
                    <Step title="Worker accepted" at={booking.acceptedAt} />
                    <Step title="On the way" at={booking.startedAt} />
                    <Step title="Arrived" at={booking.arrivedAt} />
                    <Step title="PIN checked — work started" at={booking.pinVerifiedAt} />
                    <Step title="Work done" at={booking.workDoneAt} />
                    {booking.status === 'cancelled' ? (
                      <Step title={`Cancelled by ${cancelledByLabel(booking.cancelledBy)}`} at={booking.cancelledAt} bad />
                    ) : (
                      <Step title="Customer confirmed finished" at={booking.completedAt} />
                    )}
                  </div>
                </div>
                <div className="glass card">
                  <div className="card-title">Details</div>
                  <div className="info">
                    <InfoRow icon={faLocationDot} label="Job location">
                      {booking.locationAddress ?? `${booking.latitude.toFixed(5)}, ${booking.longitude.toFixed(5)}`}{' '}
                      <a
                        className="muted"
                        href={`https://www.google.com/maps?q=${booking.latitude},${booking.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        (map)
                      </a>
                    </InfoRow>
                    {booking.quotationAmount != null ? (
                      <InfoRow icon={faIndianRupeeSign} label="Customer's quotation">
                        {rupees(booking.quotationAmount)}
                      </InfoRow>
                    ) : null}
                    <InfoRow icon={faUsers} label="Workers reached">
                      {booking.offerCount} within {booking.radiusKm} km
                    </InfoRow>
                    {booking.workerRating || booking.workerReview ? (
                      <InfoRow icon={faStar} label="Customer's rating">
                        <span className="stars">{stars(booking.workerRating)}</span>{' '}
                        {booking.workerReview ? `“${booking.workerReview}”` : ''}
                      </InfoRow>
                    ) : null}
                    {isProblem ? (
                      <InfoRow icon={faClipboardList} label="Problem post">
                        <Link to={`/problems/${booking.problemPostId}`} style={{ color: 'var(--primary)' }}>
                          Open the problem post
                        </Link>
                      </InfoRow>
                    ) : null}
                  </div>
                </div>
              </div>

              {booking.offers.length ? (
                <>
                  <SectionHead title="Workers offered this job" right={<span className="muted">{booking.offers.length}</span>} />
                  <div className="glass list">
                    {booking.offers.map((offer) => (
                      <div key={offer.workerId} className="row">
                        <Avatar name={offer.fullName} />
                        <div className="row-main">
                          <div className="row-title">{offer.fullName}</div>
                          <div className="row-sub">
                            {offer.mobileNumber} · {distance(offer.distanceMeters)} away
                          </div>
                        </div>
                        <Badge
                          tone={
                            offer.status === 'accepted'
                              ? 'success'
                              : offer.status === 'declined'
                                ? 'error'
                                : offer.status === 'pending'
                                  ? 'pending'
                                  : 'muted'
                          }
                        >
                          {offer.status === 'accepted'
                            ? 'Accepted'
                            : offer.status === 'declined'
                              ? 'Declined'
                              : offer.status === 'pending'
                                ? 'Not answered'
                                : 'Missed'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}

              <ConfirmModal
                open={confirm}
                icon={faBan}
                tone="danger"
                title="Cancel this booking?"
                message="The customer and the worker are both told straight away, with your reason. A problem job goes back to waiting for a worker."
                confirmLabel="Cancel booking"
                askReason
                onConfirm={({ reason }) =>
                  act(
                    () => adminApi.cancelBooking(booking.id, reason || undefined),
                    { title: 'Booking cancelled', message: 'Both sides have been told.' },
                    () => {
                      setConfirm(false);
                      state.reload();
                    },
                  )
                }
                onClose={() => setConfirm(false)}
              />
            </>
          );
        }}
      </Loader>
    </Page>
  );
}

// ---------------- Order ----------------

export function OrderDetailPage() {
  const { id = '' } = useParams();
  const state = useApi(() => adminApi.order(id), [id]);
  const act = useAction();
  const [confirm, setConfirm] = useState(false);
  return (
    <Page title="Shop Order" subtitle="the list, the bill and every step" back={{ to: '/orders', label: 'Shop orders' }}>
      <Loader state={state}>
        {(order) => {
          const status = orderStatus(order.status);
          const active = ORDER_ACTIVE.includes(order.status);
          const packed = order.items.filter((item) => item.status === 'packed');
          const unavailable = order.items.filter((item) => item.status === 'unavailable');
          return (
            <>
              <div className="hero" style={{ background: 'linear-gradient(135deg,#db2777,#f472b6)' }}>
                <Avatar name={order.customer.fullName} />
                <div className="hero-text">
                  <h2>
                    {order.customer.fullName} → {order.shop.name}
                  </h2>
                  <p>
                    {order.items.length} items ·{' '}
                    {order.fulfillment === 'delivery' ? `Delivery, ${distance(order.distanceMeters)}` : 'Pickup at the shop'}
                  </p>
                  <div className="hero-badges">
                    <Badge tone={status.tone}>{status.label}</Badge>
                    <Badge tone="muted">Sent {formatDateTime(order.createdAt)}</Badge>
                  </div>
                </div>
                {active ? (
                  <button
                    className="btn btn-solid-danger"
                    style={{ position: 'relative', zIndex: 1 }}
                    onClick={() => setConfirm(true)}
                  >
                    <FontAwesomeIcon icon={faBan} /> Cancel order
                  </button>
                ) : null}
              </div>

              {order.status === 'cancelled' || order.status === 'declined' ? (
                <Notice tone="error" icon={faCircleXmark}>
                  {order.status === 'declined' ? 'Declined by the shop' : `Cancelled by ${cancelledByLabel(order.cancelledBy)}`}{' '}
                  on {formatDateTime(order.cancelledAt ?? order.declinedAt)}
                  {order.cancelReason ? ` — “${order.cancelReason}”` : ''}
                </Notice>
              ) : null}

              <div className="grid-2">
                <PersonCard
                  title="Customer"
                  accountId={order.customer.accountId}
                  name={order.customer.fullName}
                  mobile={order.customer.mobileNumber}
                />
                <PersonCard
                  title="Shop"
                  accountId={order.shop.accountId}
                  name={`${order.shop.name} (${order.shop.ownerName})`}
                  mobile={order.shop.mobileNumber}
                  extra={
                    <Link
                      to={`/shops/${order.shop.businessId}`}
                      className="btn btn-ghost btn-sm"
                      style={{ marginTop: 10, marginRight: 8 }}
                    >
                      <FontAwesomeIcon icon={faStore} /> Shop profile
                    </Link>
                  }
                />
              </div>

              <div className="grid-2" style={{ marginTop: 16 }}>
                <div className="glass card">
                  <div className="card-title">
                    The list{' '}
                    <span className="count">
                      {packed.length} packed · {unavailable.length} not available
                    </span>
                  </div>
                  {order.items.map((item) => (
                    <div key={item.id} className="info-row">
                      <span
                        className="info-icon"
                        style={
                          item.status === 'unavailable'
                            ? { color: 'var(--error)', background: 'rgba(220,38,38,0.1)' }
                            : item.status === 'packed'
                              ? { color: 'var(--success)', background: 'rgba(22,163,74,0.1)' }
                              : undefined
                        }
                      >
                        <FontAwesomeIcon
                          icon={
                            item.status === 'unavailable' ? faCircleXmark : item.status === 'packed' ? faCircleCheck : faClock
                          }
                        />
                      </span>
                      <div style={{ flex: 1 }}>
                        <div className="info-value">{item.name}</div>
                        <div className="info-label">
                          {[item.quantity, item.unit].filter(Boolean).join(' ')} ·{' '}
                          {item.status === 'packed'
                            ? 'Packed'
                            : item.status === 'unavailable'
                              ? 'Not available'
                              : 'Not checked yet'}
                        </div>
                      </div>
                      <strong>{item.price != null ? rupees(item.price) : ''}</strong>
                    </div>
                  ))}
                  <div className="info-row">
                    <div style={{ flex: 1 }} className="muted">
                      Items {rupees(order.itemsTotal)}
                      {order.fulfillment === 'delivery' ? ` + delivery ${rupees(order.deliveryCharge)}` : ''}
                    </div>
                    <strong>{rupees(order.totalAmount)}</strong>
                  </div>
                  {order.note ? (
                    <p className="muted" style={{ marginTop: 10 }}>
                      Note: {order.note}
                    </p>
                  ) : null}
                </div>
                <div className="glass card">
                  <div className="card-title">Progress</div>
                  <div className="timeline">
                    <Step title="List sent" at={order.createdAt} />
                    <Step title="Shop accepted" at={order.acceptedAt} />
                    <Step title="Bill sent" at={order.packedAt} />
                    <Step title={order.fulfillment === 'delivery' ? 'Out for delivery' : 'Ready for pickup'} at={order.readyAt} />
                    {order.status === 'cancelled' || order.status === 'declined' ? (
                      <Step
                        title={
                          order.status === 'declined' ? 'Declined by shop' : `Cancelled by ${cancelledByLabel(order.cancelledBy)}`
                        }
                        at={order.cancelledAt ?? order.declinedAt}
                        bad
                      />
                    ) : (
                      <Step title="Handed over (PIN checked)" at={order.completedAt} />
                    )}
                  </div>
                  {order.shopRating || order.shopReview ? (
                    <div className="info-row" style={{ marginTop: 10 }}>
                      <span className="info-icon">
                        <FontAwesomeIcon icon={faStar} />
                      </span>
                      <div>
                        <div className="info-label">Customer&apos;s rating</div>
                        <div className="info-value">
                          <span className="stars">{stars(order.shopRating)}</span>{' '}
                          {order.shopReview ? `“${order.shopReview}”` : ''}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <ConfirmModal
                open={confirm}
                icon={faBan}
                tone="danger"
                title="Cancel this order?"
                message="The customer and the shop are both told straight away, with your reason."
                confirmLabel="Cancel order"
                askReason
                onConfirm={({ reason }) =>
                  act(
                    () => adminApi.cancelOrder(order.id, reason || undefined),
                    { title: 'Order cancelled', message: 'The customer and the shop have been told.' },
                    () => {
                      setConfirm(false);
                      state.reload();
                    },
                  )
                }
                onClose={() => setConfirm(false)}
              />
            </>
          );
        }}
      </Loader>
    </Page>
  );
}

// ---------------- Problem post ----------------

export function ProblemDetailPage() {
  const { id = '' } = useParams();
  const state = useApi(() => adminApi.problem(id), [id]);
  const act = useAction();
  const [confirm, setConfirm] = useState(false);
  return (
    <Page
      title="Problem Post"
      subtitle="a problem a customer asked nearby workers to fix"
      back={{ to: '/problems', label: 'Problem jobs' }}
    >
      <Loader state={state}>
        {(problem) => {
          const status = problemStatus(problem.status);
          return (
            <>
              <div className="hero" style={{ background: 'linear-gradient(135deg,#7c3aed,#a78bfa)' }}>
                <Avatar name={problem.customerFullName} />
                <div className="hero-text">
                  <h2>{skillsLabel(problem.skillCategories)}</h2>
                  <p>
                    {problem.customerFullName} offers {rupees(problem.quotationAmount)}
                  </p>
                  <div className="hero-badges">
                    <Badge tone={status.tone}>{status.label}</Badge>
                    <Badge tone="muted">Posted {formatDateTime(problem.createdAt)}</Badge>
                  </div>
                </div>
                {problem.status === 'open' ? (
                  <button
                    className="btn btn-solid-danger"
                    style={{ position: 'relative', zIndex: 1 }}
                    onClick={() => setConfirm(true)}
                  >
                    <FontAwesomeIcon icon={faBan} /> Close post
                  </button>
                ) : null}
              </div>

              {problem.status === 'closed' ? (
                <Notice tone="muted" icon={faCircleXmark}>
                  Closed by Triolo admin on {formatDateTime(problem.closedAt)}
                  {problem.closedReason ? ` — “${problem.closedReason}”` : ''}
                </Notice>
              ) : null}
              {problem.status === 'accepted' || problem.status === 'work_done' ? (
                <Notice tone="info" icon={faTriangleExclamation}>
                  A worker is on this job. To stop it, cancel its booking — the post then goes back to waiting and can be closed
                  here.
                </Notice>
              ) : null}

              <div className="grid-2">
                <PersonCard
                  title="Customer"
                  accountId={problem.accountId}
                  name={problem.customerFullName}
                  mobile={problem.customerMobileNumber}
                />
                <div className="glass card">
                  <div className="card-title">Worker</div>
                  {problem.workerFullName ? (
                    <div className="info">
                      <InfoRow icon={faUser} label="Accepted by">
                        {problem.workerFullName} · {problem.workerMobileNumber}
                      </InfoRow>
                      {problem.bookingRequestId ? (
                        <Link
                          to={`/bookings/${problem.bookingRequestId}`}
                          className="btn btn-primary btn-sm"
                          style={{ marginTop: 10 }}
                        >
                          <FontAwesomeIcon icon={faBolt} /> Open the trip
                        </Link>
                      ) : null}
                    </div>
                  ) : (
                    <p className="muted">No worker yet.</p>
                  )}
                </div>
              </div>

              <div className="grid-2" style={{ marginTop: 16 }}>
                <div className="glass card">
                  <div className="card-title">Details</div>
                  <div className="info">
                    <InfoRow icon={faClipboardList} label="Description">
                      {problem.description ?? '—'}
                    </InfoRow>
                    <InfoRow icon={faIndianRupeeSign} label="Quotation">
                      {rupees(problem.quotationAmount)}
                    </InfoRow>
                    <InfoRow icon={faLocationDot} label="Location">
                      {problem.locationAddress ?? '—'}
                    </InfoRow>
                    {problem.workerRating || problem.workerReview ? (
                      <InfoRow icon={faStar} label="Customer's rating">
                        <span className="stars">{stars(problem.workerRating)}</span>{' '}
                        {problem.workerReview ? `“${problem.workerReview}”` : ''}
                      </InfoRow>
                    ) : null}
                  </div>
                </div>
                <div className="glass card">
                  <div className="card-title">
                    Photos <span className="count">{problem.photoUrls.length}</span>
                  </div>
                  <Photos urls={problem.photoUrls} />
                </div>
              </div>

              <ConfirmModal
                open={confirm}
                icon={faBan}
                tone="danger"
                title="Close this problem post?"
                message="Workers stop seeing it, and the customer is told, with your reason."
                confirmLabel="Close post"
                askReason
                onConfirm={({ reason }) =>
                  act(
                    () => adminApi.closeProblem(problem.id, reason || undefined),
                    { title: 'Problem post closed' },
                    () => {
                      setConfirm(false);
                      state.reload();
                    },
                  )
                }
                onClose={() => setConfirm(false)}
              />
            </>
          );
        }}
      </Loader>
    </Page>
  );
}

// ---------------- Job post ----------------

export function JobPostDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const state = useApi(() => adminApi.jobPost(id), [id]);
  const act = useAction();
  const [confirm, setConfirm] = useState<'hide' | 'show' | 'remove' | null>(null);
  return (
    <Page title="Job Post" subtitle="someone looking for regular work" back={{ to: '/job-posts', label: 'Job posts' }}>
      <Loader state={state}>
        {(post) => (
          <>
            <div className="hero" style={{ background: 'linear-gradient(135deg,#4338ca,#7c3aed,#c026d3)' }}>
              <Avatar name={post.fullName} photo={post.photoUrl} />
              <div className="hero-text">
                <h2>{post.fullName}</h2>
                <p>
                  {post.title || jobCategoryLabel(post.category)} · {rupees(post.payAmount)}/
                  {post.payPeriod === 'daily' ? 'day' : 'month'}
                </p>
                <div className="hero-badges">
                  <Badge tone={post.isActive ? 'success' : 'muted'}>
                    {post.isActive ? 'Live — customers can see it' : 'Hidden'}
                  </Badge>
                  {post.accountStatus !== 'active' ? (
                    <Badge tone={accountStatus(post.accountStatus).tone}>{accountStatus(post.accountStatus).label}</Badge>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="grid-2">
              <div className="glass card">
                <div className="card-title">Moderation</div>
                <div className="actions">
                  {post.isActive ? (
                    <button className="btn btn-warning" onClick={() => setConfirm('hide')}>
                      <FontAwesomeIcon icon={faEyeSlash} /> Hide from customers
                    </button>
                  ) : (
                    <button className="btn btn-success" onClick={() => setConfirm('show')}>
                      <FontAwesomeIcon icon={faEye} /> Show again
                    </button>
                  )}
                  <button className="btn btn-danger" onClick={() => setConfirm('remove')}>
                    <span className="btn-badge">
                      <FontAwesomeIcon icon={faTrash} />
                    </span>
                    Delete post
                  </button>
                </div>
              </div>
              <PersonCard title="Posted by" accountId={post.accountId} name={post.fullName} mobile={post.mobileNumber} />
            </div>
            <div className="glass card" style={{ marginTop: 16 }}>
              <div className="card-title">Details</div>
              <div className="info">
                <InfoRow icon={faUserTie} label="Work">
                  {post.title || jobCategoryLabel(post.category)} ({jobCategoryLabel(post.category)})
                </InfoRow>
                <InfoRow icon={faIndianRupeeSign} label="Expected pay">
                  {rupees(post.payAmount)} per {post.payPeriod === 'daily' ? 'day' : 'month'}
                </InfoRow>
                <InfoRow icon={faClock} label="Availability">
                  {AVAILABILITY[post.availability] ?? post.availability} · {post.experienceYears} year
                  {post.experienceYears === 1 ? '' : 's'} experience
                </InfoRow>
                <InfoRow icon={faStar} label="Skills">
                  {post.skills.length ? post.skills.join(', ') : '—'}
                </InfoRow>
                <InfoRow icon={faClipboardList} label="About">
                  {post.description ?? '—'}
                </InfoRow>
                <InfoRow icon={faLocationDot} label="Location">
                  {post.locationAddress ?? '—'}
                </InfoRow>
                <InfoRow icon={faCalendar} label="Posted / updated">
                  {formatDate(post.createdAt)} · {formatDate(post.updatedAt)}
                </InfoRow>
              </div>
            </div>

            <ConfirmModal
              open={confirm === 'hide' || confirm === 'show'}
              icon={confirm === 'hide' ? faEyeSlash : faEye}
              tone={confirm === 'hide' ? 'warning' : 'success'}
              title={confirm === 'hide' ? 'Hide this job post?' : 'Show this job post again?'}
              message={
                confirm === 'hide'
                  ? 'Customers stop seeing it in Hire Staff. The poster is told, with your reason.'
                  : 'Customers can find it in Hire Staff again.'
              }
              confirmLabel={confirm === 'hide' ? 'Hide' : 'Show'}
              askReason={confirm === 'hide'}
              onConfirm={({ reason }) =>
                act(
                  () => adminApi.setJobPostActive(post.id, confirm === 'show', reason || undefined),
                  { title: confirm === 'hide' ? 'Job post hidden' : 'Job post visible again' },
                  () => {
                    setConfirm(null);
                    state.reload();
                  },
                )
              }
              onClose={() => setConfirm(null)}
            />
            <ConfirmModal
              open={confirm === 'remove'}
              icon={faTrash}
              tone="danger"
              title="Delete this job post?"
              message="It's removed for good, with its photo. The poster is told, with your reason."
              confirmLabel="Delete"
              askReason
              onConfirm={({ reason }) =>
                act(
                  () => adminApi.removeJobPost(post.id, reason || undefined),
                  { title: 'Job post deleted' },
                  () => navigate('/job-posts', { replace: true }),
                )
              }
              onClose={() => setConfirm(null)}
            />
          </>
        )}
      </Loader>
    </Page>
  );
}

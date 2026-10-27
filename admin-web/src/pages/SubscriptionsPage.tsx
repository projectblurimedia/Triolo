import { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import {
  faBolt,
  faCrown,
  faHandshake,
  faIndianRupeeSign,
  faMobileScreen,
  faShieldHalved,
  faStar,
  faTrash,
  faTriangleExclamation,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { Topbar } from '@/components/Layout';
import { ConfirmModal } from '@/components/ConfirmModal';
import { Dropdown, DropdownOption } from '@/components/Dropdown';
import { Badge, Empty, ErrorState, Loading, Notice, SearchBox, Segment, Spinner } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import {
  AdminBadge,
  PassKind,
  SubscriptionAudience,
  SubscriptionOverview,
  SubscriptionPrices,
  SubscriptionSettings,
  subscriptionsApi,
  PartnerPlan,
} from '@/services/subscriptionsApi';
import { getErrorMessage } from '@/services/errorMessages';
import { showToast } from '@/state/toastStore';
import { Switch } from '@/pages/AdsPages';
import { timeAgo } from '@/utils/format';

const rupees = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;
const PLAN_MONTHS = ['1', '3', '6', '12'] as const;
const PLAN_LABEL: Record<(typeof PLAN_MONTHS)[number], string> = { '1': '1 month', '3': '3 months', '6': '6 months', '12': '12 months' };
const KIND_LABEL = { service: 'Worker (services)', business: 'Shop', job_post: 'Job post' } as const;

const HEAD_START_OPTIONS: DropdownOption<string>[] = [
  { value: '0', label: 'No head start', description: 'Everyone hears at the same time' },
  { value: '15', label: '15 seconds' },
  { value: '30', label: '30 seconds' },
  { value: '60', label: '1 minute' },
  { value: '120', label: '2 minutes' },
  { value: '300', label: '5 minutes' },
  { value: '600', label: '10 minutes' },
];

const MIN_RATING_OPTIONS: DropdownOption<string>[] = ['2', '2.5', '3', '3.5', '4', '4.5'].map((value) => ({
  value,
  label: `Below ${value} stars`,
}));

/** "On" / "Off" next to a switch. */
function StatePill({ on, onLabel = 'On', offLabel = 'Off' }: { on: boolean; onLabel?: string; offLabel?: string }) {
  return <span className={`state-pill ${on ? 'on' : 'off'}`}>{on ? onLabel : offLabel}</span>;
}

/** The four plan prices, saved together. */
const PARTNER_PLAN_ROWS: { plan: PartnerPlan; label: string }[] = [
  { plan: 'service', label: 'Services Plus' },
  { plan: 'shop', label: 'Shop Plus' },
  { plan: 'job_post', label: 'Job Post Plus' },
];
const PLAN_NAME: Record<PartnerPlan, string> = { service: 'Services', shop: 'Shop', job_post: 'Job posts' };

function PriceEditor({ prices, onSave }: { prices: SubscriptionPrices; onSave: (prices: SubscriptionPrices) => Promise<void> }) {
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(PLAN_MONTHS.map((m) => [m, String(prices[m])])));
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(Object.fromEntries(PLAN_MONTHS.map((m) => [m, String(prices[m])]))), [prices]);
  const changed = PLAN_MONTHS.some((m) => Number(draft[m]) !== prices[m]);
  return (
    <div className="sub-prices">
      <div className="ad-prices">
        {PLAN_MONTHS.map((months) => (
          <label key={months} className="field">
            <span>{PLAN_LABEL[months]}</span>
            <div className="ad-price-input">
              <span>₹</span>
              <input
                value={draft[months]}
                inputMode="numeric"
                onChange={(e) => setDraft((current) => ({ ...current, [months]: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
              />
            </div>
          </label>
        ))}
      </div>
      <button
        type="button"
        className="btn btn-primary"
        disabled={!changed || saving}
        onClick={async () => {
          setSaving(true);
          await onSave(Object.fromEntries(PLAN_MONTHS.map((m) => [m, Number(draft[m]) || 0])) as SubscriptionPrices).finally(() =>
            setSaving(false),
          );
        }}
      >
        {saving ? <Spinner small /> : 'Save Prices'}
      </button>
    </div>
  );
}

/** Pay-per-use prices: what someone without a plan pays once for each action. */
function FeeEditor<K extends string>({
  title,
  fields,
  values,
  onSave,
}: {
  title: string;
  fields: { key: K; label: string; note: string }[];
  values: Record<K, number>;
  onSave: (values: Record<K, number>) => Promise<void>;
}) {
  const toDraft = () => Object.fromEntries(fields.map((f) => [f.key, String(values[f.key])])) as Record<K, string>;
  const [draft, setDraft] = useState<Record<K, string>>(toDraft);
  const [saving, setSaving] = useState(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setDraft(toDraft()), [values]);
  const changed = fields.some((f) => Number(draft[f.key]) !== values[f.key]);
  return (
    <div className="ad-gap-box sub-fees">
      <div className="ad-gap-head">
        <span className="ad-spot-icon" style={{ background: 'linear-gradient(135deg,#b45309,#f59e0b)' }}>
          <FontAwesomeIcon icon={faIndianRupeeSign} />
        </span>
        <span className="ad-spot-text">
          <strong>{title}</strong>
          <small>Paid once per action by people without a plan (₹0 makes it free)</small>
        </span>
      </div>
      <div className="ad-prices">
        {fields.map((field) => (
          <label key={field.key} className="field">
            <span>{field.label}</span>
            <div className="ad-price-input">
              <span>₹</span>
              <input
                value={draft[field.key]}
                inputMode="numeric"
                onChange={(e) => setDraft((current) => ({ ...current, [field.key]: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
              />
            </div>
            <small className="muted">{field.note}</small>
          </label>
        ))}
      </div>
      <button
        type="button"
        className="btn btn-primary"
        disabled={!changed || saving}
        onClick={async () => {
          setSaving(true);
          await onSave(Object.fromEntries(fields.map((f) => [f.key, Number(draft[f.key]) || 0])) as Record<K, number>).finally(() =>
            setSaving(false),
          );
        }}
      >
        {saving ? <Spinner small /> : 'Save Fees'}
      </button>
    </div>
  );
}

const PASS_LABEL: Record<PassKind, string> = {
  book: 'Booking',
  order: 'Shop order',
  staff_contact: 'Staff phone number',
  accept: 'Partner accept',
  job_post: 'Job post',
};

/** One plan's banner: its switch, what subscribers get, prices and extra settings. */
function PlanCard({
  title,
  icon,
  gradient,
  on,
  perks,
  onToggle,
  children,
}: {
  title: string;
  icon: IconDefinition;
  gradient: string;
  on: boolean;
  perks: string[];
  onToggle: (value: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="glass card sub-plan">
      <div className={`ad-master-banner${on ? '' : ' off'}`} style={on ? { background: gradient } : undefined}>
        <span className="ad-master-icon">
          <FontAwesomeIcon icon={icon} />
        </span>
        <div className="ad-master-text">
          <div className="ad-master-title">
            {title} <StatePill on={on} onLabel="Shown in the app" offLabel="Hidden" />
          </div>
          <div className="ad-master-sub">{on ? 'Partners can buy it for their profiles now.' : 'Off — the apps show nothing about it.'}</div>
        </div>
        <Switch checked={on} onChange={onToggle} />
      </div>
      <ul className="sub-perks">
        {perks.map((perk) => (
          <li key={perk}>
            <FontAwesomeIcon icon={faStar} /> {perk}
          </li>
        ))}
      </ul>
      {children}
    </div>
  );
}

function PlanSection({
  title,
  note,
  icon,
  gradient,
  on,
  master,
  perks,
  onToggle,
  children,
}: {
  title: string;
  note: string;
  icon: IconDefinition;
  gradient: string;
  on: boolean;
  master: boolean;
  perks: string[];
  onToggle: (value: boolean) => void;
  children: React.ReactNode;
}) {
  const showing = on && master;
  return (
    <div className={`ad-app sub-section${showing ? ' on' : ''}`}>
      <div className="ad-app-head">
        <span className="ad-app-icon" style={{ background: gradient }}>
          <FontAwesomeIcon icon={icon} />
        </span>
        <span className="ad-app-text">
          <strong>{title}</strong>
          <small>{note}</small>
        </span>
        <StatePill on={showing} onLabel="Shown" offLabel="Hidden" />
        <Switch checked={on} disabled={!master} onChange={onToggle} />
      </div>
      <div className={`sub-section-body${on ? '' : ' disabled'}`}>
        <ul className="sub-perks">
          {perks.map((perk) => (
            <li key={perk}>
              <FontAwesomeIcon icon={faStar} /> {perk}
            </li>
          ))}
        </ul>
        {children}
      </div>
    </div>
  );
}

export function SubscriptionsPage() {
  const overview = useApi(() => subscriptionsApi.overview(), []);
  const review = useApi(() => subscriptionsApi.badgesToReview(), []);
  const [tab, setTab] = useState<'subscriptions' | 'badges' | 'passes'>('subscriptions');
  const [passKind, setPassKind] = useState<'' | PassKind>('');
  const [audience, setAudience] = useState<'' | SubscriptionAudience>('');
  const [state, setState] = useState<'active' | 'ended' | 'unpaid'>('active');
  const [q, setQ] = useState('');
  const [badgeStatus, setBadgeStatus] = useState<'active' | 'removed'>('active');
  const subs = useApi(() => subscriptionsApi.list({ audience: audience || undefined, state, q: q || undefined }), [audience, state, q]);
  const badges = useApi(() => subscriptionsApi.badges(badgeStatus), [badgeStatus]);
  const [removing, setRemoving] = useState<AdminBadge | null>(null);
  const saveSeq = useRef(0);

  if (overview.loading && !overview.data) return <Loading />;
  if (overview.error || !overview.data) {
    return (
      <>
        <Topbar title="Subscriptions" />
        <ErrorState error={overview.error} onRetry={overview.reload} />
      </>
    );
  }
  const data: SubscriptionOverview = overview.data;
  const settings = data.settings;

  const master = settings.subscriptionsEnabled;

  const save = async (changes: Partial<SubscriptionSettings>, message = 'Saved') => {
    const seq = ++saveSeq.current;
    overview.setData((current) => (current ? { ...current, settings: { ...current.settings, ...changes } } : current));
    try {
      const saved = await subscriptionsApi.saveSettings(changes);
      if (seq !== saveSeq.current) return;
      overview.setData((current) => (current ? { ...current, settings: saved } : current));
      showToast({ variant: 'success', title: message });
    } catch (err) {
      showToast({ variant: 'error', title: 'Not saved', message: getErrorMessage(err) });
      // Show what the server really has (an earlier change may have gone through).
      if (seq === saveSeq.current) overview.reload();
    }
  };

  return (
    <>
      <Topbar title="Subscriptions" subtitle="Plans for customers and partners, and Trusted by Triolo badges" />

      <div className="stats">
        {[
          { icon: faUsers, gradient: 'linear-gradient(135deg,#0055d3,#1d76fa)', value: data.activeCustomers, label: 'Customers subscribed' },
          { icon: faHandshake, gradient: 'linear-gradient(135deg,#7c3aed,#a78bfa)', value: data.activePartners, label: 'Partners subscribed' },
          { icon: faShieldHalved, gradient: 'linear-gradient(135deg,#16a34a,#22c55e)', value: data.activeBadges, label: 'Trusted badges' },
          { icon: faIndianRupeeSign, gradient: 'linear-gradient(135deg,#ea580c,#f59e0b)', value: data.revenueThisMonth, label: 'This month (₹)' },
        ].map((stat) => (
          <div key={stat.label} className="stat glass">
            <span className="stat-icon" style={{ background: stat.gradient }}>
              <FontAwesomeIcon icon={stat.icon} />
            </span>
            <span className="stat-value">{stat.value.toLocaleString('en-IN')}</span>
            <span className="stat-label">{stat.label}</span>
          </div>
        ))}
      </div>

      {review.data && review.data.length > 0 ? (
        <div style={{ marginBottom: 16 }}>
          <Notice tone="warning" icon={faTriangleExclamation}>
            {review.data.length === 1 ? '1 Trusted badge has' : `${review.data.length} Trusted badges have`} low ratings — check them
            below.
          </Notice>
        </div>
      ) : null}

      <div className="glass card ad-settings sub-main">
        {/* The main switch, like the ads one: nothing about subscriptions shows while it's off. */}
        <div className={`ad-master-banner sub-master${master ? '' : ' off'}`}>
          <span className="ad-master-icon">
            <FontAwesomeIcon icon={faCrown} />
          </span>
          <div className="ad-master-text">
            <div className="ad-master-title">
              Subscriptions in the apps <StatePill on={master} onLabel="On" offLabel="Off everywhere" />
            </div>
            <div className="ad-master-sub">
              {master
                ? 'Turn each app on or off below. Booking and ordering lock only with the customer app on.'
                : 'No plans are shown and nothing is locked. Turn on to choose the apps below.'}
            </div>
          </div>
          <Switch checked={master} onChange={(value) => save({ subscriptionsEnabled: value }, value ? 'Subscriptions on' : 'Subscriptions off')} />
        </div>

        <div className={`ad-spots${master ? '' : ' disabled'}`}>
          <PlanSection
            title="Customer app (Triolo Plus)"
            note="Customers subscribe to book and order"
            icon={faMobileScreen}
            gradient="linear-gradient(135deg,#0055d3,#1d76fa)"
            on={settings.customerEnabled}
            master={master}
            perks={['No ads', 'Quick Book and booking a particular worker', 'Ordering from shops (searching stays free)']}
            onToggle={(value) => save({ customerEnabled: value }, value ? 'Customer plans on' : 'Customer plans off')}
          >
            <PriceEditor prices={settings.customerPrices} onSave={(prices) => save({ customerPrices: prices }, 'Prices saved')} />
            <FeeEditor
              title="Without a plan: pay once"
              fields={[
                { key: 'book', label: 'Book a worker', note: 'Quick Book or one in particular' },
                { key: 'order', label: 'Order from a shop', note: 'Sending a list' },
                { key: 'staffContact', label: 'Staff phone number', note: 'Per person, then always shown' },
              ]}
              values={settings.customerFees}
              onSave={(fees) => save({ customerFees: fees }, 'Fees saved')}
            />
          </PlanSection>

          <PlanSection
            title="Partner app (one plan per profile)"
            note="Services, shops and job posts each have their own plan — partners buy the ones they need"
            icon={faHandshake}
            gradient="linear-gradient(135deg,#0a3fae,#2b83ff)"
            on={settings.partnerEnabled}
            master={master}
            perks={[
              'Services Plus: Quick Book jobs and problems first, no accept fee, listed first, sees who viewed (names only)',
              'Shop Plus: no accept fee on orders, listed first, sees who viewed (names only)',
              'Job Post Plus: sees who viewed their job posts with their numbers, listed first in Hire Staff',
              'Every plan: no ads',
            ]}
            onToggle={(value) => save({ partnerEnabled: value }, value ? 'Partner plans on' : 'Partner plans off')}
          >
            {PARTNER_PLAN_ROWS.map((row) => (
              <div key={row.plan} className="sub-plan-prices">
                <strong>{row.label}</strong>
                <PriceEditor
                  prices={settings.partnerPlanPrices?.[row.plan] ?? settings.partnerPrices}
                  onSave={(prices) =>
                    save({ partnerPlanPrices: { ...settings.partnerPlanPrices, [row.plan]: prices } }, `${row.label} prices saved`)
                  }
                />
              </div>
            ))}
            <FeeEditor
              title="Without a plan: pay once"
              fields={[
                { key: 'accept', label: 'Accept a job or order', note: 'Quick Book, problem or shop order' },
                { key: 'jobPost', label: 'Publish a job post', note: 'Once per post' },
              ]}
              values={settings.partnerFees}
              onSave={(fees) => save({ partnerFees: fees }, 'Fees saved')}
            />
            <div className="ad-gap-box">
              <div className="ad-gap-head">
                <span className="ad-spot-icon" style={{ background: 'linear-gradient(135deg,#0d9488,#2dd4bf)' }}>
                  <FontAwesomeIcon icon={faBolt} />
                </span>
                <span className="ad-spot-text">
                  <strong>Head start for subscribed workers</strong>
                  <small>Other workers see the job this much later</small>
                </span>
              </div>
              <Dropdown
                value={String(settings.headStartSeconds)}
                options={HEAD_START_OPTIONS}
                onChange={(value) => save({ headStartSeconds: Number(value) })}
                title="Head start"
              />
            </div>
          </PlanSection>
        </div>
      </div>

      <PlanCard
        title="Trusted by Triolo badge"
        icon={faShieldHalved}
        gradient="linear-gradient(135deg,#16a34a,#22c55e)"
        on={settings.badgeEnabled}
        perks={[
          'Bought separately for each profile: worker, shop and job post',
          'Shown on cards and profiles in both apps',
          'You review badges whose rating drops, and can remove them (the partner is told why)',
        ]}
        onToggle={(value) => save({ badgeEnabled: value }, value ? 'Badges on' : 'Badges off')}
      >
        <div className="sub-badge-settings">
          <BadgePrice price={settings.badgePrice} onSave={(badgePrice) => save({ badgePrice }, 'Badge price saved')} />
          <div className="field">
            <span>Review a badge when its rating is</span>
            <Dropdown
              value={String(settings.badgeMinRating)}
              options={MIN_RATING_OPTIONS}
              onChange={(value) => save({ badgeMinRating: Number(value) })}
              title="Review below"
            />
          </div>
          <label className="field">
            <span>…with at least this many ratings</span>
            <input
              type="number"
              min={1}
              max={100}
              defaultValue={settings.badgeMinRatings}
              onBlur={(e) => {
                const value = Math.max(1, Math.min(100, Math.round(Number(e.target.value) || 1)));
                if (value !== settings.badgeMinRatings) save({ badgeMinRatings: value });
              }}
            />
          </label>
        </div>
      </PlanCard>

      <div className="glass card" style={{ marginTop: 16 }}>
        <div className="card-title">
          <FontAwesomeIcon icon={faTriangleExclamation} /> Badges to review
          <span className="count">
            <Badge tone={review.data && review.data.length ? 'warning' : 'muted'}>{review.data?.length ?? 0}</Badge>
          </span>
        </div>
        {review.loading && !review.data ? (
          <Loading />
        ) : !review.data || review.data.length === 0 ? (
          <Empty icon={faShieldHalved} title="All good" message={`No badge is below ${settings.badgeMinRating} stars.`} />
        ) : (
          <div className="sub-rows">
            {review.data.map((badge) => (
              <BadgeRow key={badge.id} badge={badge} onRemove={() => setRemoving(badge)} />
            ))}
          </div>
        )}
      </div>

      <div className="toolbar" style={{ marginTop: 20 }}>
        <Segment
          value={tab}
          onChange={setTab}
          options={[
            { value: 'subscriptions', label: 'Subscriptions' },
            { value: 'badges', label: 'Badges' },
            { value: 'passes', label: 'Pay once' },
          ]}
        />
      </div>

      {tab === 'passes' ? (
        <PassesList kind={passKind} onKind={setPassKind} />
      ) : tab === 'subscriptions' ? (
        <div className="glass card">
          <div className="toolbar">
            <Segment
              value={state}
              onChange={setState}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'ended', label: 'Ended' },
                { value: 'unpaid', label: 'Not paid' },
              ]}
            />
            <Segment
              value={audience}
              onChange={setAudience}
              options={[
                { value: '', label: 'Both apps' },
                { value: 'customer', label: 'Customers' },
                { value: 'partner', label: 'Partners' },
              ]}
            />
            <SearchBox value={q} onChange={setQ} placeholder="Search name or mobile" />
          </div>
          {subs.loading && !subs.data ? (
            <Loading />
          ) : !subs.data || subs.data.length === 0 ? (
            <Empty icon={faCrown} title="No subscriptions here" />
          ) : (
            <div className="sub-rows">
              {subs.data.map((sub) => (
                <div key={sub.id} className="sub-row">
                  <span className="ad-spot-icon" style={{ background: sub.audience === 'customer' ? 'linear-gradient(135deg,#0055d3,#1d76fa)' : 'linear-gradient(135deg,#7c3aed,#a78bfa)' }}>
                    <FontAwesomeIcon icon={sub.audience === 'customer' ? faMobileScreen : faHandshake} />
                  </span>
                  <span className="sub-row-text">
                    <strong>{sub.accountName}</strong>
                    <small>
                      {sub.accountMobile} · {sub.audience === 'customer' ? 'Customer' : `Partner${sub.plan && sub.plan !== 'all' ? ` (${PLAN_NAME[sub.plan]})` : ''}`} · {sub.months} month{sub.months === 1 ? '' : 's'} ·{' '}
                      {rupees(sub.amount)}
                    </small>
                  </span>
                  <span className="sub-row-right">
                    {sub.status === 'active' && sub.endsAt ? (
                      <Badge tone={new Date(sub.endsAt) > new Date() ? 'success' : 'muted'}>
                        {new Date(sub.endsAt) > new Date() ? 'Until' : 'Ended'} {new Date(sub.endsAt).toLocaleDateString()}
                      </Badge>
                    ) : (
                      <Badge tone="muted">Not paid · {timeAgo(sub.createdAt)}</Badge>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="glass card">
          <div className="toolbar">
            <Segment
              value={badgeStatus}
              onChange={setBadgeStatus}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'removed', label: 'Removed' },
              ]}
            />
          </div>
          {badges.loading && !badges.data ? (
            <Loading />
          ) : !badges.data || badges.data.length === 0 ? (
            <Empty icon={faShieldHalved} title="No badges here" />
          ) : (
            <div className="sub-rows">
              {badges.data.map((badge) => (
                <BadgeRow key={badge.id} badge={badge} onRemove={badge.status === 'active' ? () => setRemoving(badge) : undefined} />
              ))}
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        open={removing !== null}
        icon={faTrash}
        tone="danger"
        title="Remove this Trusted badge?"
        message={`${removing?.profileName ?? 'This profile'} loses the "Trusted by Triolo" badge. The partner is told your reason and can buy it again.`}
        confirmLabel="Remove Badge"
        askReason
        reasonRequired
        onConfirm={async ({ reason }) => {
          if (!removing) return;
          try {
            await subscriptionsApi.removeBadge(removing.id, reason);
            showToast({ variant: 'success', title: 'Badge removed', message: 'The partner has been told why.' });
            setRemoving(null);
            review.reload();
            badges.reload();
            overview.reload();
          } catch (err) {
            showToast({ variant: 'error', title: 'Not removed', message: getErrorMessage(err) });
          }
        }}
        onClose={() => setRemoving(null)}
      />
    </>
  );
}

function BadgePrice({ price, onSave }: { price: number; onSave: (price: number) => Promise<void> }) {
  const [draft, setDraft] = useState(String(price));
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(String(price)), [price]);
  return (
    <div className="field">
      <span>Badge price (one-time, per profile)</span>
      <div className="sub-inline">
        <div className="ad-price-input">
          <span>₹</span>
          <input value={draft} inputMode="numeric" onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 6))} />
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={Number(draft) === price || saving}
          onClick={async () => {
            setSaving(true);
            await onSave(Number(draft) || 0).finally(() => setSaving(false));
          }}
        >
          {saving ? <Spinner small /> : 'Save'}
        </button>
      </div>
    </div>
  );
}

function BadgeRow({ badge, onRemove }: { badge: AdminBadge; onRemove?: () => void }) {
  return (
    <div className="sub-row">
      <span className="ad-spot-icon" style={{ background: 'linear-gradient(135deg,#16a34a,#22c55e)' }}>
        <FontAwesomeIcon icon={faShieldHalved} />
      </span>
      <span className="sub-row-text">
        <strong>
          {badge.profileName ?? 'Profile'} <small className="muted">· {KIND_LABEL[badge.kind]}</small>
        </strong>
        <small>
          {badge.accountName} · {badge.accountMobile}
          {badge.ratingAverage != null ? ` · ★ ${badge.ratingAverage.toFixed(1)} (${badge.ratingCount})` : ' · no ratings yet'}
          {badge.status === 'removed' && badge.removedReason ? ` · Removed: ${badge.removedReason}` : ''}
        </small>
      </span>
      <span className="sub-row-right">
        {onRemove ? (
          <button type="button" className="btn btn-danger" onClick={onRemove}>
            <FontAwesomeIcon icon={faTrash} /> Remove
          </button>
        ) : (
          <Badge tone="muted">Removed {timeAgo(badge.removedAt)}</Badge>
        )}
      </span>
    </div>
  );
}

/** One-time payments people made instead of a plan. */
function PassesList({ kind, onKind }: { kind: '' | PassKind; onKind: (kind: '' | PassKind) => void }) {
  const [q, setQ] = useState('');
  const passes = useApi(() => subscriptionsApi.passes({ kind: kind || undefined, q: q || undefined }), [kind, q]);
  return (
    <div className="glass card">
      <div className="toolbar">
        <Segment
          value={kind}
          onChange={onKind}
          options={[
            { value: '', label: 'All' },
            { value: 'book', label: 'Bookings' },
            { value: 'order', label: 'Orders' },
            { value: 'staff_contact', label: 'Phone numbers' },
            { value: 'accept', label: 'Accepts' },
            { value: 'job_post', label: 'Job posts' },
          ]}
        />
        <SearchBox value={q} onChange={setQ} placeholder="Search name or mobile" />
      </div>
      {passes.loading && !passes.data ? (
        <Loading />
      ) : !passes.data || passes.data.length === 0 ? (
        <Empty icon={faIndianRupeeSign} title="No one-time payments yet" />
      ) : (
        <div className="sub-rows">
          {passes.data.map((pass) => (
            <div key={pass.id} className="sub-row">
              <span className="ad-spot-icon" style={{ background: 'linear-gradient(135deg,#b45309,#f59e0b)' }}>
                <FontAwesomeIcon icon={faIndianRupeeSign} />
              </span>
              <span className="sub-row-text">
                <strong>{pass.accountName}</strong>
                <small>
                  {pass.accountMobile} · {PASS_LABEL[pass.kind]} · {rupees(pass.amount)}
                </small>
              </span>
              <span className="sub-row-right">
                <Badge tone={pass.status === 'used' ? 'success' : 'info'}>{pass.status === 'used' ? 'Used' : 'Not used yet'}</Badge>
                <small className="muted">{pass.paidAt ? timeAgo(pass.paidAt) : ''}</small>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

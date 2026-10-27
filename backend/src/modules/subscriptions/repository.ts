import { Pool, QueryResultRow } from 'pg';
import {
  AdminBadgeRow,
  AdminSubscriptionRow,
  BadgeKind,
  ProfileBadge,
  Subscription,
  SubscriptionAudience,
  SubscriptionMonths,
  SubscriptionSettings,
  PartnerPlan,
  PARTNER_PLANS,
  SubscriptionPlan,
  TrustedIds,
  AdminPassRow,
  PassKind,
  PayPass,
} from './interfaces';

const iso = (value: unknown): string | null => (value ? new Date(value as string).toISOString() : null);

function mapSettings(row: QueryResultRow): SubscriptionSettings {
  const prices = (raw: Record<string, unknown>) => ({
    '1': Number(raw['1']),
    '3': Number(raw['3']),
    '6': Number(raw['6']),
    '12': Number(raw['12']),
  });
  return {
    subscriptionsEnabled: row.subscriptions_enabled ?? false,
    customerEnabled: row.customer_enabled,
    partnerEnabled: row.partner_enabled,
    customerPrices: prices(row.customer_prices),
    partnerPrices: prices(row.partner_prices),
    partnerPlanPrices: Object.fromEntries(
      PARTNER_PLANS.map((plan) => [plan, prices(row.partner_plan_prices?.[plan] ?? row.partner_prices)]),
    ) as Record<PartnerPlan, ReturnType<typeof prices>>,
    headStartSeconds: Number(row.head_start_seconds),
    badgeEnabled: row.badge_enabled,
    badgePrice: Number(row.badge_price),
    badgeMinRating: Number(row.badge_min_rating),
    badgeMinRatings: Number(row.badge_min_ratings),
    customerFees: {
      book: Number(row.customer_fees?.book ?? 10),
      order: Number(row.customer_fees?.order ?? 10),
      staffContact: Number(row.customer_fees?.staffContact ?? 10),
    },
    partnerFees: {
      accept: Number(row.partner_fees?.accept ?? 10),
      jobPost: Number(row.partner_fees?.jobPost ?? 20),
    },
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapSubscription(row: QueryResultRow): Subscription {
  return {
    id: row.id,
    accountId: row.account_id,
    audience: row.audience,
    plan: (row.plan ?? 'all') as SubscriptionPlan,
    months: Number(row.months) as SubscriptionMonths,
    amount: Number(row.amount),
    status: row.status,
    paymentUrl: row.razorpay_link_url ?? null,
    razorpayLinkId: row.razorpay_link_id ?? null,
    razorpayPaymentId: row.razorpay_payment_id ?? null,
    paidAt: iso(row.paid_at),
    startsAt: iso(row.starts_at),
    endsAt: iso(row.ends_at),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function mapBadge(row: QueryResultRow): ProfileBadge {
  return {
    id: row.id,
    accountId: row.account_id,
    kind: row.kind,
    profileId: row.profile_id,
    amount: Number(row.amount),
    status: row.status,
    paymentUrl: row.razorpay_link_url ?? null,
    razorpayLinkId: row.razorpay_link_id ?? null,
    razorpayPaymentId: row.razorpay_payment_id ?? null,
    paidAt: iso(row.paid_at),
    removedAt: iso(row.removed_at),
    removedReason: row.removed_reason ?? null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

const SETTINGS_COLUMNS: Partial<Record<keyof SubscriptionSettings, string>> = {
  subscriptionsEnabled: 'subscriptions_enabled',
  customerEnabled: 'customer_enabled',
  partnerEnabled: 'partner_enabled',
  headStartSeconds: 'head_start_seconds',
  badgeEnabled: 'badge_enabled',
  badgePrice: 'badge_price',
  badgeMinRating: 'badge_min_rating',
  badgeMinRatings: 'badge_min_ratings',
};

function mapPass(row: QueryResultRow): PayPass {
  return {
    id: row.id,
    accountId: row.account_id,
    kind: row.kind,
    targetId: row.target_id ?? null,
    amount: Number(row.amount),
    status: row.status,
    usedRef: row.used_ref ?? null,
    paymentUrl: row.razorpay_link_url ?? null,
    razorpayLinkId: row.razorpay_link_id ?? null,
    razorpayPaymentId: row.razorpay_payment_id ?? null,
    paidAt: iso(row.paid_at),
    usedAt: iso(row.used_at),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export class SubscriptionsRepository {
  constructor(private readonly pool: Pool) {}

  // --- Settings ---

  async getSettings(): Promise<SubscriptionSettings> {
    const result = await this.pool.query(`SELECT * FROM subscription_settings WHERE id = 1`);
    return mapSettings(result.rows[0]);
  }

  async updateSettings(changes: Partial<Omit<SubscriptionSettings, 'updatedAt'>>): Promise<SubscriptionSettings> {
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const [key, column] of Object.entries(SETTINGS_COLUMNS)) {
      const value = changes[key as keyof typeof changes];
      if (value !== undefined) {
        values.push(value);
        sets.push(`${column} = $${values.length}`);
      }
    }
    for (const [key, column] of [
      ['customerPrices', 'customer_prices'],
      ['partnerPrices', 'partner_prices'],
      ['partnerPlanPrices', 'partner_plan_prices'],
      ['customerFees', 'customer_fees'],
      ['partnerFees', 'partner_fees'],
    ] as const) {
      if (changes[key]) {
        values.push(JSON.stringify(changes[key]));
        sets.push(`${column} = $${values.length}::jsonb`);
      }
    }
    if (sets.length === 0) return this.getSettings();
    const result = await this.pool.query(
      `UPDATE subscription_settings SET ${sets.join(', ')}, updated_at = now() WHERE id = 1 RETURNING *`,
      values,
    );
    return mapSettings(result.rows[0]);
  }

  /** Name and mobile for the payment page (read for display, like other modules join accounts). */
  async accountContact(accountId: string): Promise<{ name: string; mobile: string; language: 'en' | 'te' } | null> {
    const result = await this.pool.query(`SELECT full_name, mobile_number, preferred_language FROM accounts WHERE id = $1`, [
      accountId,
    ]);
    const row = result.rows[0];
    return row ? { name: row.full_name, mobile: row.mobile_number, language: row.preferred_language === 'te' ? 'te' : 'en' } : null;
  }

  // --- Subscriptions ---

  /**
   * The subscription running now (the latest-ending one), if any. With a partner plan: one for
   * that plan or an older plan covering everything.
   */
  async findActive(accountId: string, audience: SubscriptionAudience, plan?: PartnerPlan): Promise<Subscription | null> {
    const result = await this.pool.query(
      `SELECT * FROM subscriptions
       WHERE account_id = $1 AND audience = $2 AND status = 'active' AND starts_at <= now() AND ends_at > now()
         AND ($3::text IS NULL OR plan IN ($3, 'all'))
       ORDER BY ends_at DESC LIMIT 1`,
      [accountId, audience, plan ?? null],
    );
    return result.rows[0] ? mapSubscription(result.rows[0]) : null;
  }

  /** When this account's paid time ends (including periods bought ahead), or null. */
  async findLastEnd(accountId: string, audience: SubscriptionAudience, plan?: PartnerPlan): Promise<string | null> {
    const result = await this.pool.query(
      `SELECT max(ends_at) AS ends_at FROM subscriptions WHERE account_id = $1 AND audience = $2 AND status = 'active' AND ends_at > now()
         AND ($3::text IS NULL OR plan IN ($3, 'all'))`,
      [accountId, audience, plan ?? null],
    );
    return iso(result.rows[0]?.ends_at);
  }

  async findPending(accountId: string, audience: SubscriptionAudience, plan: SubscriptionPlan = 'all'): Promise<Subscription | null> {
    const result = await this.pool.query(
      `SELECT * FROM subscriptions
       WHERE account_id = $1 AND audience = $2 AND status = 'unpaid' AND razorpay_link_url IS NOT NULL AND plan = $3
         AND created_at > now() - interval '1 day'
       ORDER BY created_at DESC LIMIT 1`,
      [accountId, audience, plan],
    );
    return result.rows[0] ? mapSubscription(result.rows[0]) : null;
  }

  async createSubscription(
    accountId: string,
    audience: SubscriptionAudience,
    months: number,
    amount: number,
    plan: SubscriptionPlan = 'all',
  ): Promise<Subscription> {
    const result = await this.pool.query(
      `INSERT INTO subscriptions (account_id, audience, months, amount, plan) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [accountId, audience, months, amount, plan],
    );
    return mapSubscription(result.rows[0]);
  }

  async setSubscriptionLink(id: string, linkId: string, url: string): Promise<void> {
    await this.pool.query(`UPDATE subscriptions SET razorpay_link_id = $2, razorpay_link_url = $3 WHERE id = $1`, [id, linkId, url]);
  }

  async findSubscription(id: string): Promise<Subscription | null> {
    const result = await this.pool.query(`SELECT * FROM subscriptions WHERE id = $1`, [id]);
    return result.rows[0] ? mapSubscription(result.rows[0]) : null;
  }

  /**
   * Starts a paid subscription: right after any time this account already has (so buying again
   * adds on), for its months. Only from 'unpaid', so a second check never adds twice.
   */
  async activateSubscription(id: string, paymentId: string): Promise<Subscription | null> {
    const result = await this.pool.query(
      // (A second check of the same payment waits on the row lock and then matches nothing,
      // since the row is no longer 'unpaid'.)
      `UPDATE subscriptions s SET status = 'active', razorpay_payment_id = $2, paid_at = now(),
         starts_at = target.starts_at, ends_at = target.starts_at + make_interval(months => target.months)
       FROM (
         SELECT t.id, t.months,
           GREATEST(now(), COALESCE((
             SELECT max(o.ends_at) FROM subscriptions o
             WHERE o.account_id = t.account_id AND o.audience = t.audience AND o.plan = t.plan AND o.status = 'active'
           ), now())) AS starts_at
         FROM subscriptions t WHERE t.id = $1
       ) target
       WHERE s.id = target.id AND s.status = 'unpaid'
       RETURNING s.*`,
      [id, paymentId],
    );
    return result.rows[0] ? mapSubscription(result.rows[0]) : null;
  }

  /** Accounts with a subscription running now. */
  async activeAccountIds(audience: SubscriptionAudience, plan?: PartnerPlan): Promise<string[]> {
    const result = await this.pool.query(
      `SELECT DISTINCT account_id FROM subscriptions WHERE audience = $1 AND status = 'active' AND starts_at <= now() AND ends_at > now()
         AND ($2::text IS NULL OR plan IN ($2, 'all'))`,
      [audience, plan ?? null],
    );
    return result.rows.map((row) => row.account_id);
  }

  async listSubscriptions(filter: {
    audience?: SubscriptionAudience;
    state?: 'active' | 'ended' | 'unpaid';
    q?: string;
    limit: number;
  }): Promise<AdminSubscriptionRow[]> {
    const where: string[] = [];
    const values: unknown[] = [];
    if (filter.audience) {
      values.push(filter.audience);
      where.push(`s.audience = $${values.length}`);
    }
    if (filter.state === 'active') where.push(`s.status = 'active' AND s.ends_at > now()`);
    if (filter.state === 'ended') where.push(`s.status = 'active' AND s.ends_at <= now()`);
    if (filter.state === 'unpaid') where.push(`s.status = 'unpaid'`);
    if (filter.q) {
      values.push(`%${filter.q}%`);
      where.push(`(a.full_name ILIKE $${values.length} OR a.mobile_number ILIKE $${values.length})`);
    }
    values.push(filter.limit);
    const result = await this.pool.query(
      `SELECT s.*, a.full_name, a.mobile_number FROM subscriptions s JOIN accounts a ON a.id = s.account_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY s.created_at DESC LIMIT $${values.length}`,
      values,
    );
    return result.rows.map((row) => ({ ...mapSubscription(row), accountName: row.full_name, accountMobile: row.mobile_number }));
  }

  async counts(): Promise<{
    activeCustomers: number;
    activePartners: number;
    activeBadges: number;
    revenueTotal: number;
    revenueThisMonth: number;
  }> {
    const result = await this.pool.query(
      `SELECT
         (SELECT count(DISTINCT account_id) FROM subscriptions WHERE audience = 'customer' AND status = 'active' AND ends_at > now())::int AS customers,
         (SELECT count(DISTINCT account_id) FROM subscriptions WHERE audience = 'partner' AND status = 'active' AND ends_at > now())::int AS partners,
         (SELECT count(*) FROM profile_badges WHERE status = 'active')::int AS badges,
         (SELECT COALESCE(sum(amount), 0) FROM (
            SELECT amount, paid_at FROM subscriptions WHERE paid_at IS NOT NULL
            UNION ALL SELECT amount, paid_at FROM profile_badges WHERE paid_at IS NOT NULL
            UNION ALL SELECT amount, paid_at FROM pay_passes WHERE paid_at IS NOT NULL) p)::int AS revenue_total,
         (SELECT COALESCE(sum(amount), 0) FROM (
            SELECT amount, paid_at FROM subscriptions WHERE paid_at IS NOT NULL
            UNION ALL SELECT amount, paid_at FROM profile_badges WHERE paid_at IS NOT NULL
            UNION ALL SELECT amount, paid_at FROM pay_passes WHERE paid_at IS NOT NULL) p
          WHERE date_trunc('month', paid_at AT TIME ZONE 'Asia/Kolkata') = date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata'))::int AS revenue_month`,
    );
    const row = result.rows[0];
    return {
      activeCustomers: row.customers,
      activePartners: row.partners,
      activeBadges: row.badges,
      revenueTotal: row.revenue_total,
      revenueThisMonth: row.revenue_month,
    };
  }

  // --- Badges ---

  async createBadge(accountId: string, kind: BadgeKind, profileId: string, amount: number): Promise<ProfileBadge> {
    const result = await this.pool.query(
      `INSERT INTO profile_badges (account_id, kind, profile_id, amount) VALUES ($1, $2, $3, $4) RETURNING *`,
      [accountId, kind, profileId, amount],
    );
    return mapBadge(result.rows[0]);
  }

  async setBadgeLink(id: string, linkId: string, url: string): Promise<void> {
    await this.pool.query(`UPDATE profile_badges SET razorpay_link_id = $2, razorpay_link_url = $3 WHERE id = $1`, [id, linkId, url]);
  }

  async findBadge(id: string): Promise<ProfileBadge | null> {
    const result = await this.pool.query(`SELECT * FROM profile_badges WHERE id = $1`, [id]);
    return result.rows[0] ? mapBadge(result.rows[0]) : null;
  }

  /** The latest badge row for each of this account's profiles. */
  async findLatestBadges(accountId: string): Promise<ProfileBadge[]> {
    const result = await this.pool.query(
      `SELECT DISTINCT ON (kind, profile_id) * FROM profile_badges
       WHERE account_id = $1
       ORDER BY kind, profile_id, (status = 'active') DESC, created_at DESC`,
      [accountId],
    );
    return result.rows.map(mapBadge);
  }

  async findActiveBadge(kind: BadgeKind, profileId: string): Promise<ProfileBadge | null> {
    const result = await this.pool.query(`SELECT * FROM profile_badges WHERE kind = $1 AND profile_id = $2 AND status = 'active'`, [
      kind,
      profileId,
    ]);
    return result.rows[0] ? mapBadge(result.rows[0]) : null;
  }

  async activateBadge(id: string, paymentId: string): Promise<ProfileBadge | null> {
    const result = await this.pool.query(
      `UPDATE profile_badges SET status = 'active', razorpay_payment_id = $2, paid_at = now()
       WHERE id = $1 AND status = 'unpaid' RETURNING *`,
      [id, paymentId],
    );
    return result.rows[0] ? mapBadge(result.rows[0]) : null;
  }

  async trustedIds(): Promise<TrustedIds> {
    const result = await this.pool.query(`SELECT kind, profile_id FROM profile_badges WHERE status = 'active'`);
    const ids: TrustedIds = { service: [], business: [], job_post: [] };
    for (const row of result.rows) ids[row.kind as BadgeKind].push(row.profile_id);
    return ids;
  }

  async listBadges(filter: { status?: ProfileBadge['status']; limit: number }): Promise<(ProfileBadge & { accountName: string; accountMobile: string })[]> {
    const values: unknown[] = [];
    let where = `WHERE b.status != 'unpaid'`;
    if (filter.status) {
      values.push(filter.status);
      where = `WHERE b.status = $${values.length}`;
    }
    values.push(filter.limit);
    const result = await this.pool.query(
      `SELECT b.*, a.full_name, a.mobile_number FROM profile_badges b JOIN accounts a ON a.id = b.account_id
       ${where} ORDER BY COALESCE(b.paid_at, b.created_at) DESC LIMIT $${values.length}`,
      values,
    );
    return result.rows.map((row) => ({ ...mapBadge(row), accountName: row.full_name, accountMobile: row.mobile_number }));
  }

  async removeBadge(id: string, reason: string): Promise<ProfileBadge | null> {
    const result = await this.pool.query(
      `UPDATE profile_badges SET status = 'removed', removed_at = now(), removed_reason = $2
       WHERE id = $1 AND status = 'active' RETURNING *`,
      [id, reason],
    );
    return result.rows[0] ? mapBadge(result.rows[0]) : null;
  }

  // --- Pay per use ---

  async createPass(accountId: string, kind: PassKind, amount: number, targetId: string | null): Promise<PayPass> {
    const result = await this.pool.query(
      `INSERT INTO pay_passes (account_id, kind, amount, target_id) VALUES ($1, $2, $3, $4) RETURNING *`,
      [accountId, kind, amount, targetId],
    );
    return mapPass(result.rows[0]);
  }

  async setPassLink(id: string, linkId: string, url: string): Promise<void> {
    await this.pool.query(`UPDATE pay_passes SET razorpay_link_id = $2, razorpay_link_url = $3 WHERE id = $1`, [id, linkId, url]);
  }

  async findPass(id: string): Promise<PayPass | null> {
    const result = await this.pool.query(`SELECT * FROM pay_passes WHERE id = $1`, [id]);
    return result.rows[0] ? mapPass(result.rows[0]) : null;
  }

  /** A paid use not used yet, or a started payment (under a day old) to reopen. */
  async findUsablePass(accountId: string, kind: PassKind, targetId: string | null): Promise<PayPass | null> {
    const result = await this.pool.query(
      `SELECT * FROM pay_passes
       WHERE account_id = $1 AND kind = $2 AND target_id IS NOT DISTINCT FROM $3
         AND (status = 'paid' OR (status = 'unpaid' AND razorpay_link_url IS NOT NULL AND created_at > now() - interval '1 day'))
       ORDER BY (status = 'paid') DESC, created_at DESC
       LIMIT 1`,
      [accountId, kind, targetId],
    );
    return result.rows[0] ? mapPass(result.rows[0]) : null;
  }

  /** Marks a pass paid — only from 'unpaid', so checking twice never pays twice. A phone number is unlocked straight away. */
  async markPassPaid(id: string, paymentId: string): Promise<PayPass | null> {
    const result = await this.pool.query(
      `UPDATE pay_passes SET razorpay_payment_id = $2, paid_at = now(),
         status = CASE WHEN kind = 'staff_contact' THEN 'used' ELSE 'paid' END,
         used_at = CASE WHEN kind = 'staff_contact' THEN now() ELSE NULL END,
         used_ref = CASE WHEN kind = 'staff_contact' THEN target_id ELSE NULL END
       WHERE id = $1 AND status = 'unpaid'
       RETURNING *`,
      [id, paymentId],
    );
    return result.rows[0] ? mapPass(result.rows[0]) : null;
  }

  /** Paid, unused passes per kind. */
  async countPaidPasses(accountId: string): Promise<Record<string, number>> {
    const result = await this.pool.query(
      `SELECT kind, count(*)::int AS n FROM pay_passes WHERE account_id = $1 AND status = 'paid' GROUP BY kind`,
      [accountId],
    );
    return Object.fromEntries(result.rows.map((row) => [row.kind, row.n]));
  }

  /** Uses one paid pass (the oldest) — atomically, so two requests can't share one. */
  async consumePass(accountId: string, kind: PassKind, ref: string | null): Promise<string | null> {
    const result = await this.pool.query(
      `UPDATE pay_passes SET status = 'used', used_at = now(), used_ref = $3
       WHERE id = (
         SELECT id FROM pay_passes WHERE account_id = $1 AND kind = $2 AND status = 'paid'
         ORDER BY paid_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED
       )
       RETURNING id`,
      [accountId, kind, ref],
    );
    return result.rows[0]?.id ?? null;
  }

  async attachPass(id: string, ref: string): Promise<void> {
    await this.pool.query(`UPDATE pay_passes SET used_ref = $2 WHERE id = $1`, [id, ref]);
  }

  /** Gives passes back (their booking / order ended before anyone accepted it, or the action failed). */
  async restorePasses(refs: string[], ids: string[] = []): Promise<void> {
    if (refs.length === 0 && ids.length === 0) return;
    await this.pool.query(
      `UPDATE pay_passes SET status = 'paid', used_at = NULL, used_ref = NULL
       WHERE status = 'used' AND kind <> 'staff_contact' AND (used_ref = ANY($1::text[]) OR id::text = ANY($2::text[]))`,
      [refs, ids],
    );
  }

  /** Job posts whose phone number this account paid to see. */
  async unlockedStaffPosts(accountId: string): Promise<string[]> {
    const result = await this.pool.query(
      `SELECT DISTINCT target_id FROM pay_passes WHERE account_id = $1 AND kind = 'staff_contact' AND status = 'used' AND target_id IS NOT NULL`,
      [accountId],
    );
    return result.rows.map((row) => row.target_id);
  }

  async listPasses(filter: { kind?: PassKind; q?: string; limit: number }): Promise<AdminPassRow[]> {
    const values: unknown[] = [];
    const where: string[] = ['p.paid_at IS NOT NULL'];
    if (filter.kind) {
      values.push(filter.kind);
      where.push(`p.kind = $${values.length}`);
    }
    if (filter.q) {
      values.push(`%${filter.q}%`);
      where.push(`(a.full_name ILIKE $${values.length} OR a.mobile_number ILIKE $${values.length})`);
    }
    values.push(filter.limit);
    const result = await this.pool.query(
      `SELECT p.*, a.full_name AS account_name, a.mobile_number AS account_mobile
       FROM pay_passes p JOIN accounts a ON a.id = p.account_id
       WHERE ${where.join(' AND ')}
       ORDER BY p.paid_at DESC LIMIT $${values.length}`,
      values,
    );
    return result.rows.map((row) => ({ ...mapPass(row), accountName: row.account_name, accountMobile: row.account_mobile }));
  }
}

export type { AdminBadgeRow };

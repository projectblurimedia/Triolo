import { timingSafeEqual } from 'crypto';
import { Pool, PoolClient, QueryResultRow } from 'pg';
import {
  CreateOrderParams,
  CreateQuickOrderParams,
  CUSTOMER_CANCELLABLE,
  CustomerOrder,
  HANDOVER_STATUSES,
  ItemUpdate,
  MAX_PIN_ATTEMPTS,
  ORDER_WAIT_SQL,
  ORDER_LATE_AFTER_MINUTES,
  ORDER_LATE_STATUSES,
  OrderTransition,
  PACKING_STATUSES,
  RatedOrder,
  SHOP_CANCELLABLE,
  ShopOrder,
  ShopOrderItem,
  ShopOrderStatus,
  ShopSideOrder,
  VerifyOrderPinResult,
  ACTIVE_ORDER_STATUSES,
  AdminOrder,
  AdminOrderCancelResult,
  AdminOrderListFilter,
} from './interfaces';

const toNumber = (value: unknown): number | null => (value == null ? null : Number(value));

/** Postgres enum arrays arrive as text like {grocery,dairy}. */
function parseCategories(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[];
  if (typeof value !== 'string' || value.length < 2) return [];
  return value.slice(1, -1).split(',').filter(Boolean);
}

function mapItem(row: QueryResultRow): ShopOrderItem {
  return {
    id: row.id,
    position: row.position,
    name: row.name,
    quantity: row.quantity,
    unit: row.unit ?? null,
    status: row.status,
    price: toNumber(row.price),
  };
}

function mapOrder(row: QueryResultRow, items: ShopOrderItem[]): ShopOrder {
  return {
    id: row.id,
    accountId: row.account_id,
    businessId: row.business_id ?? null,
    quick: !!row.quick,
    shopCategories: parseCategories(row.shop_categories),
    fulfillment: row.fulfillment,
    status: row.status,
    latitude: row.latitude,
    longitude: row.longitude,
    locationAddress: row.location_address ?? null,
    // A shop looking at a Quick Order it hasn't won yet sees its own distance to the customer.
    distanceMeters: Number(row.offer_distance_meters ?? row.distance_meters),
    deliveryCharge: Number(row.delivery_charge ?? 0),
    itemsTotal: toNumber(row.items_total),
    totalAmount: toNumber(row.total_amount),
    note: row.note ?? null,
    cancelledBy: row.cancelled_by ?? null,
    cancelReason: row.cancel_reason ?? null,
    shopRating: row.shop_rating ?? null,
    shopReview: row.shop_review ?? null,
    acceptedAt: row.accepted_at ?? null,
    updatedAt: row.updated_at,
    packedAt: row.packed_at ?? null,
    readyAt: row.ready_at ?? null,
    completedAt: row.completed_at ?? null,
    cancelledAt: row.cancelled_at ?? null,
    declinedAt: row.declined_at ?? null,
    expiredAt: row.expired_at ?? null,
    createdAt: row.created_at,
    items,
  };
}

function shopAddress(row: QueryResultRow): string {
  return [row.shop_area, row.shop_city].filter(Boolean).join(', ');
}

// Customer view: the shop's public details (owner phone only once accepted).
const CUSTOMER_SELECT = `
  SELECT o.*, b.shop_name, b.shop_photo_urls, b.profile_photo_url AS shop_profile_photo_url, b.rating_sum AS shop_rating_sum, b.rating_count AS shop_rating_count,
         b.latitude AS shop_latitude, b.longitude AS shop_longitude, b.area AS shop_area, b.city AS shop_city,
         oa.mobile_number AS shop_mobile_number
  FROM shop_orders o
  LEFT JOIN business_profiles b ON b.id = o.business_id
  LEFT JOIN accounts oa ON oa.id = b.account_id`;

// Shop view: who ordered and how to reach them.
const SHOP_SELECT = `
  SELECT o.*, ca.full_name AS customer_full_name, ca.mobile_number AS customer_mobile_number
  FROM shop_orders o
  JOIN accounts ca ON ca.id = o.account_id`;

// The shop's own view, including Quick Orders offered to it and not taken yet ($1 = the shop).
const SHOP_SELECT_FOR_SHOP = `
  SELECT o.*, ca.full_name AS customer_full_name, ca.mobile_number AS customer_mobile_number,
         CASE WHEN o.business_id IS NULL THEN qo.distance_meters END AS offer_distance_meters
  FROM shop_orders o
  JOIN accounts ca ON ca.id = o.account_id
  LEFT JOIN quick_order_offers qo ON qo.order_id = o.id AND qo.business_id = $1`;

// Wraps a status change so it also returns who to tell: the customer, or the shop's owner.
const NOTIFY_CUSTOMER = `SELECT u.*, a.id AS notify_account_id, a.preferred_language AS notify_language, b.shop_name
  FROM updated u JOIN accounts a ON a.id = u.account_id LEFT JOIN business_profiles b ON b.id = u.business_id`;
const NOTIFY_SHOP = `SELECT u.*, a.id AS notify_account_id, a.preferred_language AS notify_language, b.shop_name
  FROM updated u LEFT JOIN business_profiles b ON b.id = u.business_id LEFT JOIN accounts a ON a.id = b.account_id`;

export class OrdersRepository {
  constructor(private readonly pool: Pool) {}

  async create(params: CreateOrderParams): Promise<ShopOrder> {
    return this.inTransaction(async (client) => {
      const result = await client.query(
        `INSERT INTO shop_orders (account_id, business_id, fulfillment, latitude, longitude, location_address,
                                  distance_meters, delivery_charge, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          params.accountId,
          params.businessId,
          params.fulfillment,
          params.latitude,
          params.longitude,
          params.locationAddress,
          params.distanceMeters,
          params.deliveryCharge,
          params.note,
        ],
      );
      const order = result.rows[0];
      const items = await client.query(
        `INSERT INTO shop_order_items (order_id, position, name, quantity, unit)
         SELECT $1, ord, name, quantity, unit
         FROM unnest($2::text[], $3::text[], $4::text[]) WITH ORDINALITY AS t(name, quantity, unit, ord)
         RETURNING *`,
        [
          order.id,
          params.items.map((item) => item.name),
          params.items.map((item) => item.quantity),
          params.items.map((item) => item.unit),
        ],
      );
      return mapOrder(
        order,
        items.rows.map(mapItem).sort((a, b) => a.position - b.position),
      );
    });
  }

  /** A Quick Order: no shop yet, one offer per shop asked. */
  async createQuick(params: CreateQuickOrderParams): Promise<ShopOrder> {
    return this.inTransaction(async (client) => {
      const result = await client.query(
        `INSERT INTO shop_orders (account_id, business_id, quick, shop_categories, fulfillment, latitude, longitude,
                                  location_address, distance_meters, delivery_charge, note)
         VALUES ($1, NULL, true, $2::business_shop_category[], $3, $4, $5, $6, 0, 0, $7)
         RETURNING *`,
        [params.accountId, params.shopCategories, params.fulfillment, params.latitude, params.longitude, params.locationAddress, params.note],
      );
      const order = result.rows[0];
      const items = await client.query(
        `INSERT INTO shop_order_items (order_id, position, name, quantity, unit)
         SELECT $1, ord, name, quantity, unit
         FROM unnest($2::text[], $3::text[], $4::text[]) WITH ORDINALITY AS t(name, quantity, unit, ord)
         RETURNING *`,
        [order.id, params.items.map((item) => item.name), params.items.map((item) => item.quantity), params.items.map((item) => item.unit)],
      );
      await client.query(
        `INSERT INTO quick_order_offers (order_id, business_id, distance_meters)
         SELECT $1, business_id, distance FROM unnest($2::uuid[], $3::float8[]) AS t(business_id, distance)`,
        [order.id, params.offers.map((offer) => offer.businessId), params.offers.map((offer) => offer.distanceMeters)],
      );
      return mapOrder(
        order,
        items.rows.map(mapItem).sort((a, b) => a.position - b.position),
      );
    });
  }

  /** This shop's still-open offer of a Quick Order nobody has taken: its distance, or null. */
  async findQuickOffer(orderId: string, businessId: string): Promise<number | null> {
    const result = await this.pool.query(
      `SELECT qo.distance_meters FROM quick_order_offers qo JOIN shop_orders so ON so.id = qo.order_id
       WHERE qo.order_id = $1 AND qo.business_id = $2 AND qo.status = 'pending'
         AND so.business_id IS NULL AND so.status = 'placed'`,
      [orderId, businessId],
    );
    return result.rows[0] ? Number(result.rows[0].distance_meters) : null;
  }

  /**
   * The first shop to accept a Quick Order gets it: the UPDATE only matches while it still has
   * no shop, so two accepts at once can never both win (the second finds nothing). The other
   * offers are closed. The order then carries on like any other.
   */
  async claimQuick(orderId: string, businessId: string, distanceMeters: number, deliveryCharge: number): Promise<OrderTransition | null> {
    const result = await this.pool.query(
      `WITH updated AS (
         UPDATE shop_orders so SET business_id = $2, status = 'accepted', accepted_at = now(), updated_at = now(),
           distance_meters = $3, delivery_charge = $4
         WHERE so.id = $1 AND so.quick AND so.business_id IS NULL AND so.status = 'placed'
           AND so.created_at > now() - ${ORDER_WAIT_SQL('so')}
           AND EXISTS (SELECT 1 FROM quick_order_offers qo WHERE qo.order_id = so.id AND qo.business_id = $2 AND qo.status = 'pending')
         RETURNING so.*
       ) ${NOTIFY_CUSTOMER}`,
      [orderId, businessId, distanceMeters, deliveryCharge],
    );
    if (!result.rows[0]) return null;
    await this.pool.query(
      `UPDATE quick_order_offers SET status = CASE WHEN business_id = $2 THEN 'won'::quick_order_offer_status ELSE 'lost'::quick_order_offer_status END
       WHERE order_id = $1 AND status = 'pending'`,
      [orderId, businessId],
    );
    return this.toTransition(result.rows[0]);
  }

  /**
   * "Find Orders Now": offers this shop every Quick Order still looking for a shop near it that
   * it could take — the right kind of shop, and for delivery only if it delivers — even ones
   * whose first push it missed or that went out before it was set up. Offer rows are made once
   * (one per order and shop); one it declined earlier is offered again. Returns how many.
   */
  async offerOpenQuickOrders(shop: {
    businessId: string;
    ownerAccountId: string;
    latitude: number;
    longitude: number;
    shopCategories: string[];
    deliveryAvailable: boolean;
    radiusKm: number;
  }): Promise<number> {
    const result = await this.pool.query(
      `WITH open AS (
         SELECT so.id,
           (6371000 * acos(LEAST(1.0, GREATEST(-1.0,
             cos(radians($3)) * cos(radians(so.latitude)) * cos(radians(so.longitude) - radians($4)) + sin(radians($3)) * sin(radians(so.latitude))
           )))) AS distance
         FROM shop_orders so
         WHERE so.quick AND so.business_id IS NULL AND so.status = 'placed'
           AND so.created_at > now() - ${ORDER_WAIT_SQL('so')}
           AND so.account_id <> $2
           AND so.shop_categories && $5::business_shop_category[]
           AND (so.fulfillment = 'pickup' OR $6::boolean)
       )
       INSERT INTO quick_order_offers (order_id, business_id, distance_meters)
       SELECT id, $1, distance FROM open WHERE distance <= $7 * 1000
       ON CONFLICT (order_id, business_id) DO UPDATE SET status = 'pending'
         WHERE quick_order_offers.status = 'declined'
       RETURNING order_id`,
      [shop.businessId, shop.ownerAccountId, shop.latitude, shop.longitude, shop.shopCategories, shop.deliveryAvailable, shop.radiusKm],
    );
    return result.rowCount ?? 0;
  }

  /** A shop turns down a Quick Order: only its own offer closes; the others can still take it. */
  async declineQuickOffer(orderId: string, businessId: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE quick_order_offers SET status = 'declined' WHERE order_id = $1 AND business_id = $2 AND status = 'pending'`,
      [orderId, businessId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Ends every order the shop didn't answer in time. Run lazily before orders are read, so
   * nothing has to run on a timer; accept() also refuses a stale order on its own.
   */
  async expireStale(): Promise<string[]> {
    const result = await this.pool.query(
      `UPDATE shop_orders so SET status = 'expired', expired_at = now(), updated_at = now()
       WHERE so.status = 'placed' AND so.created_at <= now() - ${ORDER_WAIT_SQL('so')}
       RETURNING so.id`,
    );
    return result.rows.map((row) => row.id);
  }

  async exists(id: string): Promise<boolean> {
    const result = await this.pool.query(`SELECT 1 FROM shop_orders WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // --- Reads ---

  async findForCustomer(id: string, accountId: string): Promise<CustomerOrder | null> {
    const result = await this.pool.query(`${CUSTOMER_SELECT} WHERE o.id = $1 AND o.account_id = $2`, [id, accountId]);
    const [order] = await this.withCustomerShape(result.rows);
    return order ?? null;
  }

  async listForCustomer(accountId: string, limit: number): Promise<CustomerOrder[]> {
    const result = await this.pool.query(`${CUSTOMER_SELECT} WHERE o.account_id = $1 ORDER BY o.created_at DESC LIMIT $2`, [
      accountId,
      limit,
    ]);
    return this.withCustomerShape(result.rows);
  }

  async findForShop(id: string, businessId: string): Promise<ShopSideOrder | null> {
    const result = await this.pool.query(
      `${SHOP_SELECT_FOR_SHOP}
       WHERE o.id = $2 AND (o.business_id = $1 OR (o.business_id IS NULL AND o.status = 'placed' AND qo.status = 'pending'))`,
      [businessId, id],
    );
    const [order] = await this.withShopShape(result.rows);
    return order ?? null;
  }

  /** Active orders first (newest first), then history. */
  async listForShop(businessId: string, limit: number): Promise<ShopSideOrder[]> {
    const result = await this.pool.query(
      `${SHOP_SELECT_FOR_SHOP}
       WHERE o.business_id = $1 OR (o.business_id IS NULL AND o.status = 'placed' AND qo.status = 'pending')
       ORDER BY (o.status IN ('completed', 'cancelled', 'declined', 'expired')) ASC, o.created_at DESC
       LIMIT $2`,
      [businessId, limit],
    );
    return this.withShopShape(result.rows);
  }

  async findRatedForBusiness(businessId: string, limit: number): Promise<RatedOrder[]> {
    const result = await this.pool.query(
      `SELECT o.shop_rating, o.shop_review, COALESCE(o.completed_at, o.cancelled_at) AS completed_at, a.full_name AS customer_full_name
       FROM shop_orders o JOIN accounts a ON a.id = o.account_id
       WHERE o.business_id = $1 AND o.status IN ('completed', 'cancelled') AND (o.shop_rating IS NOT NULL OR o.shop_review IS NOT NULL)
       ORDER BY COALESCE(o.completed_at, o.cancelled_at) DESC
       LIMIT $2`,
      [businessId, limit],
    );
    return result.rows.map((row) => ({
      rating: row.shop_rating ?? null,
      review: row.shop_review ?? null,
      customerFullName: row.customer_full_name,
      completedAt: row.completed_at,
    }));
  }

  // --- Customer transitions ---

  async cancelByCustomer(id: string, accountId: string): Promise<OrderTransition | null> {
    const result = await this.pool.query(
      `WITH updated AS (
         UPDATE shop_orders SET status = 'cancelled', cancelled_by = 'customer', cancelled_at = now(), updated_at = now()
         WHERE id = $1 AND account_id = $2 AND status = ANY($3::shop_order_status[])
         RETURNING *
       ) ${NOTIFY_SHOP}`,
      [id, accountId, CUSTOMER_CANCELLABLE],
    );
    return this.toTransition(result.rows[0]);
  }

  /**
   * The customer cancels an order the shop took but hasn't moved on for ORDER_LATE_AFTER_MINUTES,
   * rating the shop. Returns the transition and the business to credit, or null.
   */
  async cancelStalled(
    id: string,
    accountId: string,
    rating: number,
    review: string | null,
  ): Promise<{ transition: OrderTransition; businessId: string } | null> {
    const result = await this.pool.query(
      `WITH updated AS (
         UPDATE shop_orders SET status = 'cancelled', cancelled_by = 'customer', cancelled_at = now(), updated_at = now(),
           cancel_reason = 'late', shop_rating = $4, shop_review = $5, rated_at = now()
         WHERE id = $1 AND account_id = $2 AND status = ANY($3::shop_order_status[])
           AND updated_at <= now() - make_interval(mins => ${ORDER_LATE_AFTER_MINUTES})
         RETURNING *
       ) ${NOTIFY_SHOP}`,
      [id, accountId, ORDER_LATE_STATUSES, rating, review],
    );
    const transition = await this.toTransition(result.rows[0]);
    return transition ? { transition, businessId: result.rows[0].business_id } : null;
  }

  /** Once per order, only after it's completed. Returns the business to credit, or null. */
  async rate(id: string, accountId: string, rating: number, review: string | null): Promise<string | null> {
    const result = await this.pool.query(
      `UPDATE shop_orders SET shop_rating = $3, shop_review = $4, rated_at = now(), updated_at = now()
       WHERE id = $1 AND account_id = $2 AND status = 'completed' AND rated_at IS NULL
       RETURNING business_id`,
      [id, accountId, rating, review],
    );
    return result.rows[0]?.business_id ?? null;
  }

  // --- Shop transitions (all scoped to the shop's own business id) ---

  /** placed → accepted: the shop starts reviewing; the customer can no longer cancel. */
  async accept(id: string, businessId: string): Promise<OrderTransition | null> {
    const result = await this.pool.query(
      `WITH updated AS (
         UPDATE shop_orders so SET status = 'accepted', accepted_at = now(), updated_at = now()
         WHERE so.id = $1 AND so.business_id = $2 AND so.status = 'placed'
           AND so.created_at > now() - ${ORDER_WAIT_SQL('so')}
         RETURNING so.*
       ) ${NOTIFY_CUSTOMER}`,
      [id, businessId],
    );
    return this.toTransition(result.rows[0]);
  }

  async decline(id: string, businessId: string, reason: string | null): Promise<OrderTransition | null> {
    const result = await this.pool.query(
      `WITH updated AS (
         UPDATE shop_orders SET status = 'declined', declined_at = now(), cancel_reason = $3, updated_at = now()
         WHERE id = $1 AND business_id = $2 AND status = 'placed'
         RETURNING *
       ) ${NOTIFY_CUSTOMER}`,
      [id, businessId, reason],
    );
    return this.toTransition(result.rows[0]);
  }

  /**
   * Saves the checklist (each item packed with its price, or unavailable). Only while
   * reviewing; moves accepted → preparing. Returns false if the order isn't in that state.
   */
  async saveItems(id: string, businessId: string, items: ItemUpdate[]): Promise<boolean> {
    return this.inTransaction(
      async (client) => {
        const order = await client.query(
          `UPDATE shop_orders SET status = 'preparing', updated_at = now()
           WHERE id = $1 AND business_id = $2 AND status = ANY($3::shop_order_status[])
           RETURNING id`,
          [id, businessId, PACKING_STATUSES],
        );
        if (order.rowCount === 0) return false;
        // Only this order's own items can change; a price is kept for packed items only.
        await client.query(
          `UPDATE shop_order_items i
           SET status = u.status::shop_order_item_status,
               price = CASE WHEN u.status = 'packed' THEN u.price ELSE NULL END
           FROM unnest($2::uuid[], $3::text[], $4::numeric[]) AS u(id, status, price)
           WHERE i.id = u.id AND i.order_id = $1`,
          [id, items.map((item) => item.id), items.map((item) => item.status), items.map((item) => item.price)],
        );
        return true;
      },
      { rollbackOn: (saved) => !saved },
    );
  }

  /**
   * Finishes packing: needs every item decided, a price on every packed item, and at least one
   * packed item. Computes the bill (items + delivery charge for delivery orders) and → packed.
   */
  async markPacked(
    id: string,
    businessId: string,
  ): Promise<{ transition: OrderTransition | null; problem?: 'pending' | 'price' | 'empty' }> {
    return this.inTransaction(async (client) => {
      const current = await client.query(
        `SELECT * FROM shop_orders WHERE id = $1 AND business_id = $2 AND status = ANY($3::shop_order_status[]) FOR UPDATE`,
        [id, businessId, PACKING_STATUSES],
      );
      if (!current.rows[0]) return { transition: null };
      const items = (await client.query(`SELECT * FROM shop_order_items WHERE order_id = $1`, [id])).rows.map(mapItem);
      if (items.some((item) => item.status === 'pending')) return { transition: null, problem: 'pending' as const };
      const packed = items.filter((item) => item.status === 'packed');
      if (packed.length === 0) return { transition: null, problem: 'empty' as const };
      if (packed.some((item) => item.price == null)) return { transition: null, problem: 'price' as const };

      const itemsTotal = packed.reduce((sum, item) => sum + (item.price ?? 0), 0);
      const updated = await client.query(
        `WITH updated AS (
           UPDATE shop_orders
           SET status = 'packed', packed_at = now(), items_total = $2,
               total_amount = $2 + CASE WHEN fulfillment = 'delivery' THEN delivery_charge ELSE 0 END,
               updated_at = now()
           WHERE id = $1
           RETURNING *
         ) ${NOTIFY_CUSTOMER}`,
        [id, itemsTotal],
      );
      return { transition: await this.toTransition(updated.rows[0], client) };
    });
  }

  /** packed → ready_for_pickup / out_for_delivery (by the order's fulfillment), with the PIN. */
  async markReady(id: string, businessId: string, pin: string): Promise<OrderTransition | null> {
    const result = await this.pool.query(
      `WITH updated AS (
         UPDATE shop_orders
         SET status = CASE WHEN fulfillment = 'delivery' THEN 'out_for_delivery'::shop_order_status
                           ELSE 'ready_for_pickup'::shop_order_status END,
             ready_at = now(), pin = $3, pin_attempts = 0, updated_at = now()
         WHERE id = $1 AND business_id = $2 AND status = 'packed'
         RETURNING *
       ) ${NOTIFY_CUSTOMER}`,
      [id, businessId, pin],
    );
    return this.toTransition(result.rows[0]);
  }

  /** The customer's PIN, entered by the shop at handover. Attempts counted under a row lock. */
  async verifyPin(id: string, businessId: string, pin: string): Promise<VerifyOrderPinResult> {
    return this.inTransaction(async (client) => {
      const current = await client.query(
        `SELECT * FROM shop_orders WHERE id = $1 AND business_id = $2 AND status = ANY($3::shop_order_status[]) FOR UPDATE`,
        [id, businessId, HANDOVER_STATUSES],
      );
      const row = current.rows[0];
      if (!row || !row.pin) return { outcome: 'not_found' } as const;
      const attempts = Number(row.pin_attempts ?? 0);
      if (attempts >= MAX_PIN_ATTEMPTS) return { outcome: 'locked' } as const;

      const expected = Buffer.from(String(row.pin));
      const given = Buffer.from(pin);
      if (!(expected.length === given.length && timingSafeEqual(expected, given))) {
        await client.query(`UPDATE shop_orders SET pin_attempts = pin_attempts + 1 WHERE id = $1`, [id]);
        return { outcome: 'wrong', attemptsLeft: MAX_PIN_ATTEMPTS - (attempts + 1) } as const;
      }

      const updated = await client.query(
        `WITH updated AS (
           UPDATE shop_orders SET status = 'completed', completed_at = now(), pin = NULL, updated_at = now()
           WHERE id = $1
           RETURNING *
         ) ${NOTIFY_CUSTOMER}`,
        [id],
      );
      return { outcome: 'verified', transition: (await this.toTransition(updated.rows[0], client)) as OrderTransition } as const;
    });
  }

  async cancelByShop(id: string, businessId: string, reason: string | null): Promise<OrderTransition | null> {
    const result = await this.pool.query(
      `WITH updated AS (
         UPDATE shop_orders
         SET status = 'cancelled', cancelled_by = 'shop', cancel_reason = $3, cancelled_at = now(), pin = NULL, updated_at = now()
         WHERE id = $1 AND business_id = $2 AND status = ANY($4::shop_order_status[])
         RETURNING *
       ) ${NOTIFY_CUSTOMER}`,
      [id, businessId, reason, SHOP_CANCELLABLE],
    );
    return this.toTransition(result.rows[0]);
  }

  async languageOf(accountId: string): Promise<'en' | 'te'> {
    const result = await this.pool.query(`SELECT preferred_language FROM accounts WHERE id = $1`, [accountId]);
    return result.rows[0]?.preferred_language ?? 'en';
  }

  async statusOf(id: string): Promise<ShopOrderStatus | null> {
    const result = await this.pool.query(`SELECT status FROM shop_orders WHERE id = $1`, [id]);
    return result.rows[0]?.status ?? null;
  }

  // --- Helpers ---

  private async itemsFor(orderIds: string[], client?: PoolClient): Promise<Map<string, ShopOrderItem[]>> {
    const byOrder = new Map<string, ShopOrderItem[]>();
    if (orderIds.length === 0) return byOrder;
    const result = await (client ?? this.pool).query(
      `SELECT * FROM shop_order_items WHERE order_id = ANY($1::uuid[]) ORDER BY position`,
      [orderIds],
    );
    for (const row of result.rows) {
      const list = byOrder.get(row.order_id) ?? [];
      list.push(mapItem(row));
      byOrder.set(row.order_id, list);
    }
    return byOrder;
  }

  private async withCustomerShape(rows: QueryResultRow[]): Promise<CustomerOrder[]> {
    const items = await this.itemsFor(rows.map((row) => row.id));
    return rows.map((row) => {
      const ratingCount = Number(row.shop_rating_count ?? 0);
      const accepted =
        !['placed', 'declined', 'expired'].includes(row.status) && !(row.status === 'cancelled' && !row.accepted_at);
      return {
        ...mapOrder(row, items.get(row.id) ?? []),
        shop: {
          // Empty for a Quick Order no shop has taken yet (the app shows 'Finding a shop').
          name: row.shop_name ?? '',
          // The shop's own profile photo only (never one of its shop pictures).
          photoUrl: row.shop_profile_photo_url ?? null,
          ratingAverage: ratingCount > 0 ? Math.round((Number(row.shop_rating_sum) / ratingCount) * 10) / 10 : null,
          ratingCount,
          latitude: row.shop_latitude ?? null,
          longitude: row.shop_longitude ?? null,
          address: shopAddress(row),
          mobileNumber: accepted ? row.shop_mobile_number : null,
        },
        pin: HANDOVER_STATUSES.includes(row.status) ? (row.pin ?? null) : null,
      };
    });
  }

  private async withShopShape(rows: QueryResultRow[]): Promise<ShopSideOrder[]> {
    const items = await this.itemsFor(rows.map((row) => row.id));
    return rows.map((row) => ({
      ...mapOrder(row, items.get(row.id) ?? []),
      customerFullName: row.customer_full_name,
      // The customer's number only once the shop has taken the order (like the shop's own number).
      customerMobileNumber: row.accepted_at ? row.customer_mobile_number : null,
      pinAttemptsLeft: Math.max(0, MAX_PIN_ATTEMPTS - Number(row.pin_attempts ?? 0)),
    }));
  }

  private async toTransition(row: QueryResultRow | undefined, client?: PoolClient): Promise<OrderTransition | null> {
    if (!row) return null;
    const items = await this.itemsFor([row.id], client);
    return {
      order: mapOrder(row, items.get(row.id) ?? []),
      notify: row.notify_account_id ? { accountId: row.notify_account_id, preferredLanguage: row.notify_language } : null,
      shopName: row.shop_name,
    };
  }

  private async inTransaction<T>(
    work: (client: PoolClient) => Promise<T>,
    options?: { rollbackOn?: (value: T) => boolean },
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const value = await work(client);
      await client.query(options?.rollbackOn?.(value) ? 'ROLLBACK' : 'COMMIT');
      return value;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --- Admin ---

  async adminList(filter: AdminOrderListFilter): Promise<{ items: AdminOrder[]; total: number; page: number; limit: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    const groups: Record<string, string> = {
      new: `o.status = 'placed'`,
      active: `o.status IN ('accepted', 'preparing', 'packed', 'ready_for_pickup', 'out_for_delivery')`,
      completed: `o.status = 'completed'`,
      cancelled: `o.status IN ('cancelled', 'declined', 'expired')`,
    };
    if (filter.group) conditions.push(groups[filter.group]);
    if (filter.accountId) {
      values.push(filter.accountId);
      conditions.push(`(o.account_id = $${values.length} OR b.account_id = $${values.length})`);
    }
    if (filter.q) {
      values.push(`%${filter.q}%`);
      const i = values.length;
      conditions.push(
        `(ca.full_name ILIKE $${i} OR ca.mobile_number ILIKE $${i} OR b.shop_name ILIKE $${i} OR oa.full_name ILIKE $${i} OR oa.mobile_number ILIKE $${i})`,
      );
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const count = await this.pool.query(`SELECT COUNT(*) ${ADMIN_FROM} ${where}`, values);
    values.push(filter.limit, (filter.page - 1) * filter.limit);
    const rows = await this.pool.query(
      `${ADMIN_SELECT} ${ADMIN_FROM} ${where} ORDER BY o.created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    return {
      items: await this.withAdminShape(rows.rows),
      total: Number(count.rows[0].count),
      page: filter.page,
      limit: filter.limit,
    };
  }

  async adminGet(id: string): Promise<AdminOrder | null> {
    const result = await this.pool.query(`${ADMIN_SELECT} ${ADMIN_FROM} WHERE o.id = $1`, [id]);
    return result.rows[0] ? (await this.withAdminShape(result.rows))[0] : null;
  }

  /** Stops any unfinished order; returns the customer and shop owner to tell. Null if it was over. */
  async adminCancel(id: string, reason: string | null): Promise<AdminOrderCancelResult | null> {
    const result = await this.pool.query(
      `WITH updated AS (
         UPDATE shop_orders
         SET status = 'cancelled', cancelled_by = 'admin', cancel_reason = $2, cancelled_at = now(), pin = NULL, updated_at = now()
         WHERE id = $1 AND status = ANY($3::shop_order_status[])
         RETURNING *
       )
       SELECT u.*, b.shop_name, ca.id AS customer_id, ca.preferred_language AS customer_language,
              oa.id AS owner_id, oa.preferred_language AS owner_language
       FROM updated u
       LEFT JOIN business_profiles b ON b.id = u.business_id
       JOIN accounts ca ON ca.id = u.account_id
       LEFT JOIN accounts oa ON oa.id = b.account_id`,
      [id, reason, ACTIVE_ORDER_STATUSES],
    );
    const row = result.rows[0];
    if (!row) return null;
    const items = await this.itemsFor([row.id]);
    return {
      order: mapOrder(row, items.get(row.id) ?? []),
      shopName: row.shop_name ?? '',
      customer: { accountId: row.customer_id, preferredLanguage: row.customer_language },
      // A Quick Order no shop took yet has no owner to tell.
      shopOwner: row.owner_id ? { accountId: row.owner_id, preferredLanguage: row.owner_language } : null,
    };
  }

  /** Unfinished orders an account is part of, as the customer or as the shop owner. */
  async adminActiveIdsForAccount(accountId: string): Promise<string[]> {
    const result = await this.pool.query(
      `SELECT o.id FROM shop_orders o LEFT JOIN business_profiles b ON b.id = o.business_id
       WHERE (o.account_id = $1 OR b.account_id = $1) AND o.status = ANY($2::shop_order_status[])`,
      [accountId, ACTIVE_ORDER_STATUSES],
    );
    return result.rows.map((row) => row.id);
  }

  async adminCounts(): Promise<{ new: number; active: number; completed: number; cancelled: number; today: number }> {
    const result = await this.pool.query(
      `SELECT COUNT(*) FILTER (WHERE status = 'placed') AS new_count,
              COUNT(*) FILTER (WHERE status IN ('accepted', 'preparing', 'packed', 'ready_for_pickup', 'out_for_delivery')) AS active,
              COUNT(*) FILTER (WHERE status = 'completed') AS completed,
              COUNT(*) FILTER (WHERE status IN ('cancelled', 'declined', 'expired')) AS cancelled,
              COUNT(*) FILTER (WHERE created_at >= date_trunc('day', now())) AS today
       FROM shop_orders`,
    );
    const row = result.rows[0];
    return {
      new: Number(row.new_count),
      active: Number(row.active),
      completed: Number(row.completed),
      cancelled: Number(row.cancelled),
      today: Number(row.today),
    };
  }

  private async withAdminShape(rows: QueryResultRow[]): Promise<AdminOrder[]> {
    const items = await this.itemsFor(rows.map((row) => row.id));
    return rows.map((row) => ({
      ...mapOrder(row, items.get(row.id) ?? []),
      customer: { accountId: row.account_id, fullName: row.customer_full_name, mobileNumber: row.customer_mobile_number },
      shop: {
        businessId: row.business_id,
        accountId: row.shop_account_id,
        name: row.shop_name,
        ownerName: row.owner_full_name,
        mobileNumber: row.owner_mobile_number,
      },
    }));
  }
}

const ADMIN_SELECT = `SELECT o.*, ca.full_name AS customer_full_name, ca.mobile_number AS customer_mobile_number,
  b.shop_name, b.account_id AS shop_account_id, oa.full_name AS owner_full_name, oa.mobile_number AS owner_mobile_number`;
const ADMIN_FROM = `FROM shop_orders o
  JOIN accounts ca ON ca.id = o.account_id
  LEFT JOIN business_profiles b ON b.id = o.business_id
  LEFT JOIN accounts oa ON oa.id = b.account_id`;

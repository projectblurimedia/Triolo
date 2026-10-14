import { timingSafeEqual } from 'crypto';
import { Pool, PoolClient, QueryResultRow } from 'pg';
import {
  CreateOrderParams,
  CUSTOMER_CANCELLABLE,
  CustomerOrder,
  HANDOVER_STATUSES,
  ItemUpdate,
  MAX_PIN_ATTEMPTS,
  ORDER_TTL_MINUTES,
  OrderTransition,
  PACKING_STATUSES,
  RatedOrder,
  SHOP_CANCELLABLE,
  ShopOrder,
  ShopOrderItem,
  ShopOrderStatus,
  ShopSideOrder,
  VerifyOrderPinResult,
} from './interfaces';

const toNumber = (value: unknown): number | null => (value == null ? null : Number(value));

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
    businessId: row.business_id,
    fulfillment: row.fulfillment,
    status: row.status,
    latitude: row.latitude,
    longitude: row.longitude,
    locationAddress: row.location_address ?? null,
    distanceMeters: Number(row.distance_meters),
    deliveryCharge: Number(row.delivery_charge ?? 0),
    itemsTotal: toNumber(row.items_total),
    totalAmount: toNumber(row.total_amount),
    note: row.note ?? null,
    cancelledBy: row.cancelled_by ?? null,
    cancelReason: row.cancel_reason ?? null,
    shopRating: row.shop_rating ?? null,
    shopReview: row.shop_review ?? null,
    acceptedAt: row.accepted_at ?? null,
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
  SELECT o.*, b.shop_name, b.shop_photo_urls, b.rating_sum AS shop_rating_sum, b.rating_count AS shop_rating_count,
         b.latitude AS shop_latitude, b.longitude AS shop_longitude, b.area AS shop_area, b.city AS shop_city,
         oa.mobile_number AS shop_mobile_number
  FROM shop_orders o
  JOIN business_profiles b ON b.id = o.business_id
  JOIN accounts oa ON oa.id = b.account_id`;

// Shop view: who ordered and how to reach them.
const SHOP_SELECT = `
  SELECT o.*, ca.full_name AS customer_full_name, ca.mobile_number AS customer_mobile_number
  FROM shop_orders o
  JOIN accounts ca ON ca.id = o.account_id`;

// Wraps a status change so it also returns who to tell: the customer, or the shop's owner.
const NOTIFY_CUSTOMER = `SELECT u.*, a.id AS notify_account_id, a.preferred_language AS notify_language, b.shop_name
  FROM updated u JOIN accounts a ON a.id = u.account_id JOIN business_profiles b ON b.id = u.business_id`;
const NOTIFY_SHOP = `SELECT u.*, a.id AS notify_account_id, a.preferred_language AS notify_language, b.shop_name
  FROM updated u JOIN business_profiles b ON b.id = u.business_id JOIN accounts a ON a.id = b.account_id`;

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
      return mapOrder(order, items.rows.map(mapItem).sort((a, b) => a.position - b.position));
    });
  }

  /**
   * Ends every order the shop didn't answer in time. Run lazily before orders are read, so
   * nothing has to run on a timer; accept() also refuses a stale order on its own.
   */
  async expireStale(): Promise<void> {
    await this.pool.query(
      `UPDATE shop_orders SET status = 'expired', expired_at = now(), updated_at = now()
       WHERE status = 'placed' AND created_at <= now() - make_interval(mins => $1)`,
      [ORDER_TTL_MINUTES],
    );
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
    const result = await this.pool.query(`${SHOP_SELECT} WHERE o.id = $1 AND o.business_id = $2`, [id, businessId]);
    const [order] = await this.withShopShape(result.rows);
    return order ?? null;
  }

  /** Active orders first (newest first), then history. */
  async listForShop(businessId: string, limit: number): Promise<ShopSideOrder[]> {
    const result = await this.pool.query(
      `${SHOP_SELECT}
       WHERE o.business_id = $1
       ORDER BY (o.status IN ('completed', 'cancelled', 'declined', 'expired')) ASC, o.created_at DESC
       LIMIT $2`,
      [businessId, limit],
    );
    return this.withShopShape(result.rows);
  }

  async findRatedForBusiness(businessId: string, limit: number): Promise<RatedOrder[]> {
    const result = await this.pool.query(
      `SELECT o.shop_rating, o.shop_review, o.completed_at, a.full_name AS customer_full_name
       FROM shop_orders o JOIN accounts a ON a.id = o.account_id
       WHERE o.business_id = $1 AND o.status = 'completed' AND (o.shop_rating IS NOT NULL OR o.shop_review IS NOT NULL)
       ORDER BY o.completed_at DESC
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
         UPDATE shop_orders SET status = 'accepted', accepted_at = now(), updated_at = now()
         WHERE id = $1 AND business_id = $2 AND status = 'placed'
           AND created_at > now() - make_interval(mins => $3)
         RETURNING *
       ) ${NOTIFY_CUSTOMER}`,
      [id, businessId, ORDER_TTL_MINUTES],
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
  async markPacked(id: string, businessId: string): Promise<{ transition: OrderTransition | null; problem?: 'pending' | 'price' | 'empty' }> {
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
      const accepted = !['placed', 'declined', 'expired'].includes(row.status) && !(row.status === 'cancelled' && !row.accepted_at);
      return {
        ...mapOrder(row, items.get(row.id) ?? []),
        shop: {
          name: row.shop_name,
          photoUrl: row.shop_photo_urls?.[0] ?? null,
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
      customerMobileNumber: row.customer_mobile_number,
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

  private async inTransaction<T>(work: (client: PoolClient) => Promise<T>, options?: { rollbackOn?: (value: T) => boolean }): Promise<T> {
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
}

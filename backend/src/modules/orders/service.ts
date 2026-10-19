import { randomInt } from 'crypto';
import { AppError } from '@/common/errors/AppError';
import { BusinessesService } from '@/modules/businesses/service';
import { BusinessProfile } from '@/modules/businesses/interfaces';
import { NotificationsService } from '@/modules/notifications/service';
import { NotificationType } from '@/modules/notifications/interfaces';
import { OrdersRepository } from './repository';
import { CreateOrderDto, CustomerCancelDto, RateOrderDto, SaveItemsDto } from './dto';
import { CustomerOrder, OrderTransition, RatedOrder, ShopSideOrder, AdminOrder, AdminOrderListFilter } from './interfaces';
import { OrderEvent, orderTemplate } from './pushTemplates';

const LIST_LIMIT = 50;

/** A fresh, single-use 4-digit pickup/delivery PIN (cryptographically random). */
function generatePin(): string {
  return String(randomInt(0, 10000)).padStart(4, '0');
}

/** Haversine distance in meters. */
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const a =
    Math.sin(toRad(lat2 - lat1) / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lng2 - lng1) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Rupees with no needless decimals, for notification text ("120", "120.50"). */
function rupees(amount: number | null): string {
  if (amount == null) return '0';
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

/**
 * Bazaar shop orders: the customer sends a prepared list to one nearby shop; the shop accepts,
 * marks every item packed (with its price) or unavailable, submits the bill, then hands it over
 * at the counter or at the door against the customer's PIN; the customer rates the shop.
 * Flow and cancellation rules follow docs/product-specification.md §3. Depends on
 * BusinessesService and NotificationsService only (never their tables), like bookings.
 */
export class OrdersService {
  constructor(
    private readonly repository: OrdersRepository,
    private readonly businessesService: BusinessesService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // --- Customer side ---

  async createOrder(accountId: string, dto: CreateOrderDto): Promise<CustomerOrder> {
    const shop = await this.businessesService.getPublicProfile(dto.businessId);
    if (!shop || shop.verificationStatus !== 'verified') {
      throw AppError.notFound('Shop not found.', 'SHOP_NOT_FOUND');
    }
    if (shop.accountId === accountId) {
      throw AppError.badRequest('You cannot order from your own shop.', 'ORDER_OWN_SHOP');
    }
    if (dto.fulfillment === 'delivery' && !shop.deliveryAvailable) {
      throw AppError.badRequest('This shop does not deliver.', 'ORDER_DELIVERY_UNAVAILABLE');
    }

    const distance =
      shop.latitude != null && shop.longitude != null
        ? distanceMeters(dto.latitude, dto.longitude, shop.latitude, shop.longitude)
        : 0;
    const order = await this.repository.create({
      accountId,
      businessId: shop.id,
      fulfillment: dto.fulfillment,
      latitude: dto.latitude,
      longitude: dto.longitude,
      locationAddress: dto.locationAddress || null,
      distanceMeters: distance,
      deliveryCharge: dto.fulfillment === 'delivery' ? deliveryCharge(shop, distance) : 0,
      note: dto.note || null,
      items: dto.items.map((item) => ({ name: item.name, quantity: item.quantity, unit: item.unit || null })),
    });

    const language = await this.repository.languageOf(shop.accountId);
    const text = orderTemplate('placed', language, { shop: shop.shopName, count: order.items.length });
    await this.notificationsService.notify(shop.accountId, 'order_placed', text.title, text.body, {
      data: { kind: 'order_placed', orderId: order.id },
      channelId: 'default',
    });

    return this.getOrder(accountId, order.id);
  }

  async getOrder(accountId: string, orderId: string): Promise<CustomerOrder> {
    await this.repository.expireStale();
    const order = await this.repository.findForCustomer(orderId, accountId);
    if (!order) {
      throw AppError.notFound('Order not found.', 'ORDER_NOT_FOUND');
    }
    return order;
  }

  async listMyOrders(accountId: string): Promise<CustomerOrder[]> {
    await this.repository.expireStale();
    return this.repository.listForCustomer(accountId, LIST_LIMIT);
  }

  /**
   * Before the shop starts reviewing; afterwards only if the order has made no progress for
   * ORDER_LATE_AFTER_MINUTES — then with a rating of the shop, which counts like any other.
   */
  async cancelOrder(accountId: string, orderId: string, dto: CustomerCancelDto = {}): Promise<void> {
    if (dto.rating !== undefined) {
      const stalled = await this.repository.cancelStalled(orderId, accountId, dto.rating, dto.review || null);
      if (!stalled) {
        throw AppError.conflict(
          'You can rate a shop when cancelling only once the order has made no progress for over an hour.',
          'ORDER_NOT_LATE',
        );
      }
      await this.businessesService.recordRating(stalled.businessId, dto.rating);
      await this.notify(stalled.transition, 'cancelled_late', 'order_cancelled');
      return;
    }
    const result = await this.repository.cancelByCustomer(orderId, accountId);
    if (!result) {
      throw await this.transitionError(orderId, 'This order can no longer be cancelled from the app.');
    }
    await this.notify(result, 'cancelled_by_customer', 'order_cancelled');
  }

  async rateOrder(accountId: string, orderId: string, dto: RateOrderDto): Promise<void> {
    const businessId = await this.repository.rate(orderId, accountId, dto.rating, dto.review || null);
    if (!businessId) {
      throw await this.transitionError(orderId, 'Only a completed order can be rated, once.');
    }
    await this.businessesService.recordRating(businessId, dto.rating);
  }

  // --- Shop side ---

  async listShopOrders(ownerAccountId: string): Promise<ShopSideOrder[]> {
    const shop = await this.businessesService.getMyProfile(ownerAccountId);
    if (!shop) return [];
    await this.repository.expireStale();
    return this.repository.listForShop(shop.id, LIST_LIMIT);
  }

  async getShopOrder(ownerAccountId: string, orderId: string): Promise<ShopSideOrder> {
    const shop = await this.requireShop(ownerAccountId);
    await this.repository.expireStale();
    const order = await this.repository.findForShop(orderId, shop.id);
    if (!order) {
      throw AppError.notFound('Order not found.', 'ORDER_NOT_FOUND');
    }
    return order;
  }

  async acceptOrder(ownerAccountId: string, orderId: string): Promise<void> {
    const shop = await this.requireShop(ownerAccountId);
    const result = await this.repository.accept(orderId, shop.id);
    if (!result) throw await this.transitionError(orderId, 'This order can no longer be accepted.');
    await this.notify(result, 'accepted', 'order_accepted');
  }

  async declineOrder(ownerAccountId: string, orderId: string, reason?: string): Promise<void> {
    const shop = await this.requireShop(ownerAccountId);
    const result = await this.repository.decline(orderId, shop.id, reason || null);
    if (!result) throw await this.transitionError(orderId, 'This order can no longer be declined.');
    await this.notify(result, 'declined', 'order_declined');
  }

  async saveItems(ownerAccountId: string, orderId: string, dto: SaveItemsDto): Promise<ShopSideOrder> {
    const shop = await this.requireShop(ownerAccountId);
    const saved = await this.repository.saveItems(
      orderId,
      shop.id,
      dto.items.map((item) => ({ id: item.id, status: item.status, price: item.price ?? null })),
    );
    if (!saved) throw await this.transitionError(orderId, 'Items can only be changed while packing.');
    return this.getShopOrder(ownerAccountId, orderId);
  }

  /** Sends the bill: packed items with prices, unavailable items listed separately. */
  async markPacked(ownerAccountId: string, orderId: string): Promise<void> {
    const shop = await this.requireShop(ownerAccountId);
    const { transition, problem } = await this.repository.markPacked(orderId, shop.id);
    if (problem === 'pending') throw AppError.badRequest('Mark every item packed or not available first.', 'ORDER_ITEMS_PENDING');
    if (problem === 'price') throw AppError.badRequest('Enter a price for every packed item.', 'ORDER_PRICE_MISSING');
    if (problem === 'empty') throw AppError.badRequest('Nothing is packed. Cancel the order instead.', 'ORDER_NOTHING_PACKED');
    if (!transition) throw await this.transitionError(orderId, 'This order cannot be marked packed right now.');
    await this.notify(transition, 'packed', 'order_packed');
  }

  /** Ready for pickup, or out for delivery — the customer gets their PIN now. */
  async markReady(ownerAccountId: string, orderId: string): Promise<void> {
    const shop = await this.requireShop(ownerAccountId);
    const result = await this.repository.markReady(orderId, shop.id, generatePin());
    if (!result) throw await this.transitionError(orderId, 'Only a packed order can be handed over.');
    const delivery = result.order.fulfillment === 'delivery';
    await this.notify(result, delivery ? 'out_for_delivery' : 'ready', delivery ? 'order_out_for_delivery' : 'order_ready');
  }

  async verifyPin(ownerAccountId: string, orderId: string, pin: string): Promise<void> {
    const shop = await this.requireShop(ownerAccountId);
    const result = await this.repository.verifyPin(orderId, shop.id, pin);
    if (result.outcome === 'not_found') throw await this.transitionError(orderId, 'This order is not waiting for a PIN.');
    if (result.outcome === 'locked') {
      throw AppError.conflict('Too many wrong PIN attempts.', 'ORDER_PIN_LOCKED');
    }
    if (result.outcome === 'wrong') {
      throw AppError.badRequest('That PIN is not correct.', 'ORDER_PIN_INVALID', { attemptsLeft: result.attemptsLeft });
    }
    await this.notify(result.transition, 'completed', 'order_completed');
  }

  async cancelByShop(ownerAccountId: string, orderId: string, reason?: string): Promise<void> {
    const shop = await this.requireShop(ownerAccountId);
    const result = await this.repository.cancelByShop(orderId, shop.id, reason || null);
    if (!result) throw await this.transitionError(orderId, 'This order can no longer be cancelled.');
    await this.notify(result, 'cancelled_by_shop', 'order_cancelled');
  }

  /** Rated, completed orders — for the shop's public reviews (reviews module). */
  async listRatedOrdersForBusiness(businessId: string, limit: number): Promise<RatedOrder[]> {
    return this.repository.findRatedForBusiness(businessId, limit);
  }

  // --- Helpers ---

  private async requireShop(ownerAccountId: string): Promise<BusinessProfile> {
    const shop = await this.businessesService.getMyProfile(ownerAccountId);
    if (!shop) {
      throw AppError.notFound('Business profile not found.', 'BUSINESS_PROFILE_NOT_FOUND');
    }
    return shop;
  }

  private async transitionError(orderId: string, message: string): Promise<AppError> {
    if (!(await this.repository.exists(orderId))) {
      return AppError.notFound('Order not found.', 'ORDER_NOT_FOUND');
    }
    return AppError.conflict(message, 'ORDER_INVALID_STATE');
  }

  /** Saved in the recipient's notification list + pushed, in their own language. */
  private async notify(transition: OrderTransition, event: OrderEvent, type: NotificationType): Promise<void> {
    if (!transition.notify) return;
    const { order } = transition;
    const packed = order.items.filter((item) => item.status === 'packed').length;
    const text = orderTemplate(event, transition.notify.preferredLanguage, {
      shop: transition.shopName,
      count: order.items.length,
      packed,
      total: rupees(order.totalAmount),
    });
    // Only the customer's own cancellation goes to the shop; every other step to the customer.
    const audience = event === 'cancelled_by_customer' || event === 'cancelled_late' ? 'partner' : 'user';
    await this.notificationsService.notify(transition.notify.accountId, type, text.title, text.body, {
      audience,
      data: { kind: type, orderId: order.id },
      channelId: 'default',
    });
  }

  // --- Admin ---

  async adminList(filter: AdminOrderListFilter) {
    await this.repository.expireStale();
    return this.repository.adminList(filter);
  }

  async adminGet(id: string): Promise<AdminOrder> {
    await this.repository.expireStale();
    const order = await this.repository.adminGet(id);
    if (!order) throw AppError.notFound('Order not found.', 'ORDER_NOT_FOUND');
    return order;
  }

  /** The admin stops an unfinished order at any step; the customer and the shop are both told, with the reason. */
  async adminCancel(id: string, reason: string | null): Promise<void> {
    const result = await this.repository.adminCancel(id, reason);
    if (!result) throw await this.transitionError(id, 'This order is already finished.');
    await Promise.all(
      [
        { target: result.customer, audience: 'user' as const },
        { target: result.shopOwner, audience: 'partner' as const },
      ].map(({ target, audience }) => {
        const text = orderTemplate('cancelled_by_admin', target.preferredLanguage, { shop: result.shopName });
        const why = reason ? (target.preferredLanguage === 'te' ? ` కారణం: ${reason}` : ` Reason: ${reason}`) : '';
        return this.notificationsService.notify(target.accountId, 'order_cancelled', text.title, `${text.body}${why}`, {
          audience,
          data: { kind: 'order_cancelled', orderId: id },
          channelId: 'default',
        });
      }),
    );
  }

  /** Cancels every unfinished order an account is part of (when it's suspended or banned). */
  async adminCancelActiveForAccount(accountId: string, reason: string | null): Promise<number> {
    const ids = await this.repository.adminActiveIdsForAccount(accountId);
    for (const id of ids) {
      await this.adminCancel(id, reason).catch(() => undefined);
    }
    return ids.length;
  }

  adminCounts() {
    return this.repository.adminCounts();
  }
}

/**
 * Delivery: the shop's price per km × distance in whole rupees, but never less than the price of
 * 1 km — a customer 300 m away pays for 1 km, one 2 km away pays 2 × the price. A larger
 * minimum a shop saved earlier still applies. 0 when the shop set no price.
 */
export function deliveryCharge(
  shop: Pick<BusinessProfile, 'deliveryPricePerKm' | 'deliveryMinCharge'>,
  distance: number,
): number {
  const perKm = shop.deliveryPricePerKm ?? 0;
  const byDistance = Math.round((perKm * distance) / 1000);
  return Math.max(byDistance, Math.round(Math.max(shop.deliveryMinCharge ?? 0, perKm)));
}

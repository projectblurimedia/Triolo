import { splitShopCategories } from '@/modules/businesses/categories';
import { randomInt } from 'crypto';
import type { SubscriptionStatusService } from '@/modules/subscriptions/statusService';
import { AppError } from '@/common/errors/AppError';
import { BusinessesService } from '@/modules/businesses/service';
import { BusinessProfile } from '@/modules/businesses/interfaces';
import { NotificationsService } from '@/modules/notifications/service';
import { NotificationType } from '@/modules/notifications/interfaces';
import { OrdersRepository } from './repository';
import { CreateOrderDto, CreateQuickOrderDto, CustomerCancelDto, RateOrderDto, SaveItemsDto } from './dto';
import {
  CustomerOrder,
  OrderTransition,
  QUICK_ORDER_MAX_SHOPS,
  QUICK_ORDER_RADIUS_KM,
  RatedOrder,
  ShopSideOrder,
  AdminOrder,
  AdminOrderListFilter,
  StaffDelivery,
} from './interfaces';
import { OrderEvent, orderTemplate, deliveryTemplate } from './pushTemplates';

const LIST_LIMIT = 50;

/** An order tagged with the owner's shop it is for. */
function tagShop(order: ShopSideOrder, shop: BusinessProfile): ShopSideOrder {
  return { ...order, shopId: shop.id, shopName: shop.shopName };
}

/** A fresh, single-use 4-digit pickup/delivery PIN (cryptographically random). */
function generatePin(): string {
  return String(randomInt(0, 10000)).padStart(4, '0');
}

/** Haversine distance in meters. */
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const a = Math.sin(toRad(lat2 - lat1) / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lng2 - lng1) / 2) ** 2;
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
    // Ordering needs a customer subscription while those are on.
    private readonly subscriptionStatus?: SubscriptionStatusService,
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
      shop.latitude != null && shop.longitude != null ? distanceMeters(dto.latitude, dto.longitude, shop.latitude, shop.longitude) : 0;
    const passId = (await this.subscriptionStatus?.useCustomerPass(accountId, 'order')) ?? null;
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
      items: dto.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit || null,
      })),
    });

    await this.subscriptionStatus?.attachPass(passId, order.id);

    const language = await this.repository.languageOf(shop.accountId);
    const text = orderTemplate('placed', language, {
      shop: shop.shopName,
      count: order.items.length,
    });
    await this.notificationsService.notify(shop.accountId, 'order_placed', text.title, text.body, {
      data: { kind: 'order_placed', orderId: order.id },
      channelId: 'default',
    });

    return this.getOrder(accountId, order.id);
  }

  /**
   * Quick Order: the list goes to every verified shop nearby of the chosen kinds (that deliver,
   * for a delivery) at once; the first to accept gets it, then it is an ordinary order. Nothing
   * is created (or paid) when no shop matches.
   */
  async createQuickOrder(accountId: string, dto: CreateQuickOrderDto): Promise<CustomerOrder> {
    const shops = await this.businessesService.searchNearby(accountId, {
      latitude: dto.latitude,
      longitude: dto.longitude,
      radiusKm: QUICK_ORDER_RADIUS_KM,
      shopCategory: dto.shopCategories.join(','),
      deliveryOnly: dto.fulfillment === 'delivery',
      limit: QUICK_ORDER_MAX_SHOPS,
    });
    if (shops.length === 0) {
      throw AppError.notFound('No matching shop nearby.', 'QUICK_ORDER_NO_SHOPS');
    }
    const passId = (await this.subscriptionStatus?.useCustomerPass(accountId, 'order')) ?? null;
    const kinds = splitShopCategories(dto.shopCategories);
    const order = await this.repository.createQuick({
      accountId,
      fulfillment: dto.fulfillment,
      shopCategories: kinds.fixed,
      customCategories: kinds.custom,
      latitude: dto.latitude,
      longitude: dto.longitude,
      locationAddress: dto.locationAddress || null,
      note: dto.note || null,
      items: dto.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit || null,
      })),
      offers: shops.map((shop) => ({
        businessId: shop.id,
        distanceMeters: shop.distanceMeters,
      })),
    });
    await this.subscriptionStatus?.attachPass(passId, order.id);

    // Every shop asked hears at once, in its own language.
    await Promise.all(
      shops.map(async (shop) => {
        const language = await this.repository.languageOf(shop.accountId);
        const text = orderTemplate('quick_placed', language, {
          shop: shop.shopName,
          count: order.items.length,
        });
        await this.notificationsService.notify(shop.accountId, 'order_placed', text.title, text.body, {
          data: { kind: 'order_placed', orderId: order.id },
          channelId: 'default',
        });
      }),
    );
    return this.getOrder(accountId, order.id);
  }

  /** Ends unanswered orders and gives back what was paid for them. */
  private async expireStale(): Promise<void> {
    const expired = await this.repository.expireStale();
    if (expired.length > 0) await this.subscriptionStatus?.restorePasses(expired);
  }

  async getOrder(accountId: string, orderId: string): Promise<CustomerOrder> {
    await this.expireStale();
    const order = await this.repository.findForCustomer(orderId, accountId);
    if (!order) {
      throw AppError.notFound('Order not found.', 'ORDER_NOT_FOUND');
    }
    return order;
  }

  async listMyOrders(accountId: string): Promise<CustomerOrder[]> {
    await this.expireStale();
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
      await this.subscriptionStatus?.restorePasses([orderId]);
      return;
    }
    const result = await this.repository.cancelByCustomer(orderId, accountId);
    if (!result) {
      throw await this.transitionError(orderId, 'This order can no longer be cancelled from the app.');
    }
    await this.notify(result, 'cancelled_by_customer', 'order_cancelled');
    // Cancelled before the shop answered: the payment is kept for next time.
    await this.subscriptionStatus?.restorePasses([orderId]);
  }

  async rateOrder(accountId: string, orderId: string, dto: RateOrderDto): Promise<void> {
    const businessId = await this.repository.rate(orderId, accountId, dto.rating, dto.review || null);
    if (!businessId) {
      throw await this.transitionError(orderId, 'Only a completed order can be rated, once.');
    }
    await this.businessesService.recordRating(businessId, dto.rating);
  }

  // --- Shop side ---

  /** Every order of every shop the owner has, each saying which shop it is for. */
  async listShopOrders(ownerAccountId: string): Promise<ShopSideOrder[]> {
    const shops = await this.businessesService.listMyShops(ownerAccountId);
    if (shops.length === 0) return [];
    await this.repository.expireStale();
    return this.listAcross(shops);
  }

  private async listAcross(shops: BusinessProfile[]): Promise<ShopSideOrder[]> {
    const lists = await Promise.all(
      shops.map(async (shop) => (await this.repository.listForShop(shop.id, LIST_LIMIT)).map((order) => tagShop(order, shop))),
    );
    // A Quick Order offered to two of the owner's shops shows once.
    const seen = new Set<string>();
    const merged = lists.flat().filter((order) => (seen.has(order.id) ? false : (seen.add(order.id), true)));
    const ended = (order: ShopSideOrder) => ['completed', 'cancelled', 'declined', 'expired'].includes(order.status);
    return merged
      .sort((a, b) => Number(ended(a)) - Number(ended(b)) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, LIST_LIMIT);
  }

  /** Which of the owner's shops this order (or Quick Order offer) is for — and the order. */
  private async shopForOrder(ownerAccountId: string, orderId: string): Promise<{ shop: BusinessProfile; order: ShopSideOrder }> {
    const shops = await this.businessesService.listMyShops(ownerAccountId);
    if (shops.length === 0) throw AppError.notFound('Business profile not found.', 'BUSINESS_PROFILE_NOT_FOUND');
    for (const shop of shops) {
      const order = await this.repository.findForShop(orderId, shop.id);
      if (order) return { shop, order: tagShop(order, shop) };
    }
    throw AppError.notFound('Order not found.', 'ORDER_NOT_FOUND');
  }

  /**
   * "Find Orders Now" (partner app): pulls in every open Quick Order nearby this shop could take,
   * then returns the shop's orders as usual — those Quick Orders among the new ones. A shop
   * with no location on file just gets its list.
   */
  async searchOpenQuickOrders(ownerAccountId: string): Promise<ShopSideOrder[]> {
    const shops = await this.businessesService.listMyShops(ownerAccountId);
    if (shops.length === 0) throw AppError.notFound('Business profile not found.', 'BUSINESS_PROFILE_NOT_FOUND');
    await this.repository.expireStale();
    for (const shop of shops) {
      if (shop.verificationStatus !== 'verified' || shop.latitude == null || shop.longitude == null) continue;
      await this.repository.offerOpenQuickOrders({
        businessId: shop.id,
        ownerAccountId,
        latitude: shop.latitude,
        longitude: shop.longitude,
        shopCategories: shop.shopCategories,
        otherCategoryDescription: shop.otherCategoryDescription,
        deliveryAvailable: shop.deliveryAvailable,
        radiusKm: QUICK_ORDER_RADIUS_KM,
      });
    }
    return this.listAcross(shops);
  }

  async getShopOrder(ownerAccountId: string, orderId: string): Promise<ShopSideOrder> {
    await this.repository.expireStale();
    return (await this.shopForOrder(ownerAccountId, orderId)).order;
  }

  async acceptOrder(ownerAccountId: string, orderId: string): Promise<void> {
    const { shop } = await this.shopForOrder(ownerAccountId, orderId);
    const passId = (await this.subscriptionStatus?.usePartnerPass(ownerAccountId, 'accept', 'shop')) ?? null;
    // A Quick Order offered to this shop: the first accept takes it (delivery charge from here).
    const offerDistance = await this.repository.findQuickOffer(orderId, shop.id);
    const result =
      offerDistance != null
        ? await this.repository.claimQuick(orderId, shop.id, offerDistance, deliveryCharge(shop, offerDistance))
        : await this.repository.accept(orderId, shop.id);
    if (!result && offerDistance != null) {
      await this.subscriptionStatus?.restorePasses([], [passId]);
      throw AppError.conflict('Another shop took this order first.', 'ORDER_ALREADY_TAKEN');
    }
    if (!result) {
      await this.subscriptionStatus?.restorePasses([], [passId]);
      throw await this.transitionError(orderId, 'This order can no longer be accepted.');
    }
    await this.subscriptionStatus?.attachPass(passId, `accept-${orderId}`);
    await this.notify(result, 'accepted', 'order_accepted');
    // The other shops asked: their pop-up for this order closes.
    if (offerDistance != null) {
      const others = await this.repository.lostQuickOwners(orderId);
      await Promise.all(
        others
          .filter((accountId) => accountId !== ownerAccountId)
          .map((accountId) =>
            this.notificationsService.sendRawPush(accountId, 'Order taken', 'Another shop took this order.', {
              audience: 'partner',
              data: { kind: 'order_taken', orderId },
              channelId: 'default',
            }),
          ),
      );
    }
  }

  async declineOrder(ownerAccountId: string, orderId: string, reason?: string): Promise<void> {
    const { shop } = await this.shopForOrder(ownerAccountId, orderId);
    // A Quick Order: only this shop's offer closes — the others can still take it.
    if (await this.repository.declineQuickOffer(orderId, shop.id)) return;
    const result = await this.repository.decline(orderId, shop.id, reason || null);
    if (!result) throw await this.transitionError(orderId, 'This order can no longer be declined.');
    await this.notify(result, 'declined', 'order_declined');
    await this.subscriptionStatus?.restorePasses([orderId]);
  }

  async saveItems(ownerAccountId: string, orderId: string, dto: SaveItemsDto): Promise<ShopSideOrder> {
    const { shop } = await this.shopForOrder(ownerAccountId, orderId);
    const saved = await this.repository.saveItems(
      orderId,
      shop.id,
      dto.items.map((item) => ({
        id: item.id,
        status: item.status,
        price: item.price ?? null,
      })),
    );
    if (!saved) throw await this.transitionError(orderId, 'Items can only be changed while packing.');
    return this.getShopOrder(ownerAccountId, orderId);
  }

  /** Sends the bill: packed items with prices, unavailable items listed separately. */
  async markPacked(ownerAccountId: string, orderId: string): Promise<void> {
    const { shop } = await this.shopForOrder(ownerAccountId, orderId);
    const { transition, problem } = await this.repository.markPacked(orderId, shop.id);
    if (problem === 'pending') throw AppError.badRequest('Mark every item packed or not available first.', 'ORDER_ITEMS_PENDING');
    if (problem === 'price') throw AppError.badRequest('Enter a price for every packed item.', 'ORDER_PRICE_MISSING');
    if (problem === 'empty') throw AppError.badRequest('Nothing is packed. Cancel the order instead.', 'ORDER_NOTHING_PACKED');
    if (!transition) throw await this.transitionError(orderId, 'This order cannot be marked packed right now.');
    await this.notify(transition, 'packed', 'order_packed');
  }

  /** Ready for pickup, or out for delivery — the customer gets their PIN now. */
  async markReady(ownerAccountId: string, orderId: string): Promise<void> {
    const { shop } = await this.shopForOrder(ownerAccountId, orderId);
    const result = await this.repository.markReady(orderId, shop.id, generatePin());
    if (!result) throw await this.transitionError(orderId, 'Only a packed order can be handed over.');
    const delivery = result.order.fulfillment === 'delivery';
    await this.notify(result, delivery ? 'out_for_delivery' : 'ready', delivery ? 'order_out_for_delivery' : 'order_ready');
  }

  async verifyPin(ownerAccountId: string, orderId: string, pin: string): Promise<void> {
    const { shop } = await this.shopForOrder(ownerAccountId, orderId);
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
    const { shop } = await this.shopForOrder(ownerAccountId, orderId);
    const result = await this.repository.cancelByShop(orderId, shop.id, reason || null);
    if (!result) throw await this.transitionError(orderId, 'This order can no longer be cancelled.');
    await this.notify(result, 'cancelled_by_shop', 'order_cancelled');
    // Not the customer's doing: their payment is kept for the next order.
    await this.subscriptionStatus?.restorePasses([orderId]);
  }

  // --- Delivery staff ---

  /**
   * The owner sends a delivery with one of the shop's staff (or takes it back with null). The
   * staff member has to accept it first; a packed order goes out for delivery (the customer gets
   * their PIN) only when they do.
   */
  async assignDelivery(ownerAccountId: string, orderId: string, staffAccountId: string | null): Promise<ShopSideOrder> {
    const { shop, order } = await this.shopForOrder(ownerAccountId, orderId);
    if (order.fulfillment !== 'delivery') throw AppError.badRequest('This order is picked up at the shop.', 'ORDER_NOT_DELIVERY');
    if (staffAccountId && !(await this.businessesService.isStaff(shop.id, staffAccountId))) {
      throw AppError.badRequest("That person is not this shop's staff.", 'STAFF_NOT_FOUND');
    }
    if (!(await this.repository.setDeliveryStaff(orderId, shop.id, staffAccountId))) {
      throw await this.transitionError(orderId, 'Only a packed order or one out for delivery can be sent with staff.');
    }
    if (staffAccountId) {
      const [delivery] = await this.repository.listForStaff(staffAccountId, 1, orderId);
      // In the staff member's own language.
      const { title, body } = deliveryTemplate('assigned', await this.repository.languageOf(staffAccountId), {
        shop: shop.shopName,
        customer: delivery?.customerFullName ?? '',
        count: delivery?.items.length ?? 0,
        total: delivery?.totalAmount != null ? rupees(delivery.totalAmount) : undefined,
      });
      await this.notificationsService.notify(staffAccountId, 'delivery_assigned', title, body, {
        audience: 'partner',
        data: { kind: 'delivery_assigned', deliveryId: orderId },
        channelId: 'default',
      });
    }
    return this.getShopOrder(ownerAccountId, orderId);
  }

  /**
   * The staff member answers a delivery handed to them. Accept: it is theirs (a packed order goes
   * out for delivery now). Decline: it goes back to the owner, who is told.
   */
  async answerDelivery(staffAccountId: string, orderId: string, accept: boolean): Promise<StaffDelivery | null> {
    const delivery = await this.getMyDelivery(staffAccountId, orderId);
    const answered = await this.repository.answerDelivery(orderId, staffAccountId, accept);
    if (!answered) throw await this.transitionError(orderId, 'This delivery is no longer waiting for you.');
    const owner = await this.businessesService.getPublicProfile(answered.businessId);
    if (accept) {
      if (answered.status === 'packed' && owner) await this.markReady(owner.accountId, orderId);
      return this.getMyDelivery(staffAccountId, orderId);
    }
    if (owner) {
      const te = (await this.repository.languageOf(owner.accountId)) === 'te';
      await this.notificationsService.notify(
        owner.accountId,
        'delivery_declined',
        te ? `డెలివరీ తిరస్కరించబడింది: ${delivery.customerFullName}` : `Delivery declined: ${delivery.customerFullName}`,
        te
          ? `${delivery.shopName} · మీరే పంపండి లేదా మరొకరిని ఎంచుకోండి`
          : `${delivery.shopName} · deliver it yourself or pick someone else`,
        {
          audience: 'partner',
          data: { kind: 'delivery_declined', orderId },
          channelId: 'default',
        },
      );
    }
    return null;
  }

  /** Staff phone, while delivering: where they are (the owner sees it on the map). */
  async updateStaffLocation(staffAccountId: string, orderId: string, latitude: number, longitude: number): Promise<void> {
    if (!(await this.repository.setStaffLocation(orderId, staffAccountId, latitude, longitude))) {
      throw AppError.conflict('This delivery is not on its way.', 'DELIVERY_NOT_ACTIVE');
    }
  }

  /** The deliveries given to me (as a shop's staff). */
  async listMyDeliveries(staffAccountId: string): Promise<StaffDelivery[]> {
    return this.repository.listForStaff(staffAccountId, LIST_LIMIT);
  }

  async getMyDelivery(staffAccountId: string, orderId: string): Promise<StaffDelivery> {
    const [delivery] = await this.repository.listForStaff(staffAccountId, 1, orderId);
    if (!delivery) throw AppError.notFound('Delivery not found.', 'DELIVERY_NOT_FOUND');
    return delivery;
  }

  /** Staff hand the order over with the customer's PIN (cash already collected). */
  async staffVerifyPin(staffAccountId: string, orderId: string, pin: string): Promise<StaffDelivery> {
    const delivery = await this.getMyDelivery(staffAccountId, orderId);
    if (delivery.staffStatus !== 'accepted') throw AppError.conflict('Accept this delivery first.', 'DELIVERY_NOT_ACCEPTED');
    const result = await this.repository.verifyPin(orderId, delivery.shopId, pin);
    if (result.outcome === 'not_found') throw await this.transitionError(orderId, 'This order is not waiting for a PIN.');
    if (result.outcome === 'locked') throw AppError.conflict('Too many wrong PIN attempts.', 'ORDER_PIN_LOCKED');
    if (result.outcome === 'wrong') {
      throw AppError.badRequest('That PIN is not correct.', 'ORDER_PIN_INVALID', { attemptsLeft: result.attemptsLeft });
    }
    await this.repository.markDeliveredBy(orderId, staffAccountId);
    await this.notify(result.transition, 'completed', 'order_completed');
    // Tell the owner who delivered it and what to take from them.
    const owner = await this.businessesService.getPublicProfile(delivery.shopId);
    if (owner) {
      const { title, body } = deliveryTemplate('delivered', await this.repository.languageOf(owner.accountId), {
        shop: delivery.shopName,
        customer: delivery.customerFullName,
        count: delivery.items.length,
        total: delivery.totalAmount != null ? rupees(delivery.totalAmount) : undefined,
      });
      await this.notificationsService.notify(owner.accountId, 'delivery_completed', title, body, {
        audience: 'partner',
        data: { kind: 'delivery_completed', orderId },
        channelId: 'default',
      });
    }
    return this.getMyDelivery(staffAccountId, orderId);
  }

  /** Rated, completed orders — for the shop's public reviews (reviews module). */
  async listRatedOrdersForBusiness(businessId: string, limit: number): Promise<RatedOrder[]> {
    return this.repository.findRatedForBusiness(businessId, limit);
  }

  // --- Helpers ---

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
        ...(result.shopOwner ? [{ target: result.shopOwner, audience: 'partner' as const }] : []),
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
    await this.subscriptionStatus?.restorePasses([id]);
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
export function deliveryCharge(shop: Pick<BusinessProfile, 'deliveryPricePerKm' | 'deliveryMinCharge'>, distance: number): number {
  const perKm = shop.deliveryPricePerKm ?? 0;
  const byDistance = Math.round((perKm * distance) / 1000);
  return Math.max(byDistance, Math.round(Math.max(shop.deliveryMinCharge ?? 0, perKm)));
}

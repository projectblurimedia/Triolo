import { deliveryCharge, OrdersService } from './service';
import { OrdersRepository } from './repository';
import { CustomerOrder, OrderTransition, ShopOrder } from './interfaces';
import { BusinessesService } from '@/modules/businesses/service';
import { BusinessProfile } from '@/modules/businesses/interfaces';
import { NotificationsService } from '@/modules/notifications/service';

type MockRepository = { [K in keyof OrdersRepository]: jest.Mock };

let repo: MockRepository;
let businesses: jest.Mocked<BusinessesService>;
let notifications: jest.Mocked<NotificationsService>;
let service: OrdersService;

function buildShop(overrides: Partial<BusinessProfile> = {}): BusinessProfile {
  return {
    id: 'shop-1',
    accountId: 'owner-1',
    shopName: 'Sri Lakshmi Stores',
    shopCategories: ['grocery'],
    otherCategoryDescription: null,
    latitude: 16.7,
    longitude: 81.1,
    area: null,
    city: 'Eluru',
    district: 'Eluru',
    state: 'Andhra Pradesh',
    pincode: '534001',
    shopPhotoUrls: [],
    deliveryAvailable: true,
    deliveryPricePerKm: 10,
    verificationStatus: 'verified',
    ratingAverage: null,
    ratingCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildOrder(overrides: Partial<ShopOrder> = {}): ShopOrder {
  return {
    id: 'order-1',
    accountId: 'customer-1',
    businessId: 'shop-1',
    fulfillment: 'pickup',
    status: 'placed',
    latitude: 16.71,
    longitude: 81.1,
    locationAddress: null,
    distanceMeters: 1100,
    deliveryCharge: 0,
    itemsTotal: null,
    totalAmount: null,
    note: null,
    cancelledBy: null,
    cancelReason: null,
    shopRating: null,
    shopReview: null,
    acceptedAt: null,
    packedAt: null,
    readyAt: null,
    completedAt: null,
    cancelledAt: null,
    declinedAt: null,
    expiredAt: null,
    createdAt: new Date(),
    items: [
      { id: 'i1', position: 1, name: 'Kandipappu', quantity: '1', unit: 'kg', status: 'packed', price: 120 },
      { id: 'i2', position: 2, name: 'Minapappu', quantity: '2', unit: 'kg', status: 'unavailable', price: null },
    ],
    ...overrides,
  };
}

function transition(overrides: Partial<ShopOrder> = {}): OrderTransition {
  return { order: buildOrder(overrides), notify: { accountId: 'customer-1', preferredLanguage: 'en' }, shopName: 'Sri Lakshmi Stores' };
}

const orderDto = {
  businessId: 'shop-1',
  fulfillment: 'delivery' as const,
  items: [{ name: 'Kandipappu', quantity: '1', unit: 'kg' }],
  latitude: 16.7,
  longitude: 81.12,
};

beforeEach(() => {
  repo = {
    create: jest.fn(),
    expireStale: jest.fn(),
    exists: jest.fn(),
    findForCustomer: jest.fn(),
    listForCustomer: jest.fn(),
    findForShop: jest.fn(),
    listForShop: jest.fn(),
    findRatedForBusiness: jest.fn(),
    cancelByCustomer: jest.fn(),
    rate: jest.fn(),
    accept: jest.fn(),
    decline: jest.fn(),
    saveItems: jest.fn(),
    markPacked: jest.fn(),
    markReady: jest.fn(),
    verifyPin: jest.fn(),
    cancelByShop: jest.fn(),
    languageOf: jest.fn().mockResolvedValue('te'),
    statusOf: jest.fn(),
  } as unknown as MockRepository;
  businesses = {
    getPublicProfile: jest.fn(),
    getMyProfile: jest.fn().mockResolvedValue(buildShop()),
    recordRating: jest.fn(),
  } as unknown as jest.Mocked<BusinessesService>;
  notifications = { notify: jest.fn() } as unknown as jest.Mocked<NotificationsService>;
  service = new OrdersService(repo as unknown as OrdersRepository, businesses, notifications);
});

describe('createOrder', () => {
  it('sends the list to the shop with a delivery charge and tells the owner in their language', async () => {
    businesses.getPublicProfile.mockResolvedValue(buildShop());
    repo.create.mockResolvedValue(buildOrder({ fulfillment: 'delivery' }));
    repo.findForCustomer.mockResolvedValue({ ...buildOrder(), shop: {}, pin: null } as unknown as CustomerOrder);

    await service.createOrder('customer-1', orderDto);

    const params = repo.create.mock.calls[0][0];
    expect(params.fulfillment).toBe('delivery');
    expect(params.deliveryCharge).toBeGreaterThan(0);
    expect(notifications.notify).toHaveBeenCalledWith(
      'owner-1',
      'order_placed',
      'కొత్త ఆర్డర్',
      expect.any(String),
      expect.objectContaining({ data: { kind: 'order_placed', orderId: 'order-1' } }),
    );
  });

  it('refuses delivery from a shop that does not deliver', async () => {
    businesses.getPublicProfile.mockResolvedValue(buildShop({ deliveryAvailable: false }));
    await expect(service.createOrder('customer-1', orderDto)).rejects.toMatchObject({ code: 'ORDER_DELIVERY_UNAVAILABLE' });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('refuses an unverified shop and your own shop', async () => {
    businesses.getPublicProfile.mockResolvedValueOnce(buildShop({ verificationStatus: 'pending_verification' }));
    await expect(service.createOrder('customer-1', orderDto)).rejects.toMatchObject({ code: 'SHOP_NOT_FOUND' });
    businesses.getPublicProfile.mockResolvedValueOnce(buildShop({ accountId: 'customer-1' }));
    await expect(service.createOrder('customer-1', orderDto)).rejects.toMatchObject({ code: 'ORDER_OWN_SHOP' });
  });
});

describe('deliveryCharge', () => {
  it('is the price per km times the distance, in whole rupees', () => {
    expect(deliveryCharge({ deliveryPricePerKm: 10 }, 2340)).toBe(23);
    expect(deliveryCharge({ deliveryPricePerKm: null }, 5000)).toBe(0);
  });
});

describe('customer steps', () => {
  it('cancels only while placed, and tells the shop', async () => {
    repo.cancelByCustomer.mockResolvedValue(transition({ status: 'cancelled' }));
    await service.cancelOrder('customer-1', 'order-1');
    expect(notifications.notify).toHaveBeenCalledWith('customer-1', 'order_cancelled', expect.any(String), expect.any(String), expect.anything());

    repo.cancelByCustomer.mockResolvedValue(null);
    repo.exists.mockResolvedValue(true);
    await expect(service.cancelOrder('customer-1', 'order-1')).rejects.toMatchObject({ code: 'ORDER_INVALID_STATE' });
  });

  it('rates a completed order once and adds it to the shop rating', async () => {
    repo.rate.mockResolvedValue('shop-1');
    await service.rateOrder('customer-1', 'order-1', { rating: 5, review: 'Good' });
    expect(businesses.recordRating).toHaveBeenCalledWith('shop-1', 5);

    repo.rate.mockResolvedValue(null);
    repo.exists.mockResolvedValue(true);
    await expect(service.rateOrder('customer-1', 'order-1', { rating: 4 })).rejects.toMatchObject({ code: 'ORDER_INVALID_STATE' });
  });
});

describe('shop steps', () => {
  it('accepts and tells the customer', async () => {
    repo.accept.mockResolvedValue(transition({ status: 'accepted' }));
    await service.acceptOrder('owner-1', 'order-1');
    expect(repo.accept).toHaveBeenCalledWith('order-1', 'shop-1');
    expect(notifications.notify).toHaveBeenCalledWith('customer-1', 'order_accepted', 'Order Accepted', expect.any(String), expect.anything());
  });

  it('explains why packing cannot finish yet', async () => {
    repo.markPacked.mockResolvedValue({ transition: null, problem: 'pending' });
    await expect(service.markPacked('owner-1', 'order-1')).rejects.toMatchObject({ code: 'ORDER_ITEMS_PENDING' });
    repo.markPacked.mockResolvedValue({ transition: null, problem: 'price' });
    await expect(service.markPacked('owner-1', 'order-1')).rejects.toMatchObject({ code: 'ORDER_PRICE_MISSING' });
    repo.markPacked.mockResolvedValue({ transition: null, problem: 'empty' });
    await expect(service.markPacked('owner-1', 'order-1')).rejects.toMatchObject({ code: 'ORDER_NOTHING_PACKED' });
  });

  it('sends the bill with the packed count and total', async () => {
    repo.markPacked.mockResolvedValue({ transition: transition({ status: 'packed', totalAmount: 120 }) });
    await service.markPacked('owner-1', 'order-1');
    expect(notifications.notify).toHaveBeenCalledWith(
      'customer-1',
      'order_packed',
      'Your Bill Is Ready',
      expect.stringContaining('packed 1 of 2 item(s). Total ₹120'),
      expect.anything(),
    );
  });

  it('hands over with a fresh 4-digit PIN — out for delivery for a delivery order', async () => {
    repo.markReady.mockResolvedValue(transition({ status: 'out_for_delivery', fulfillment: 'delivery' }));
    await service.markReady('owner-1', 'order-1');
    expect(repo.markReady).toHaveBeenCalledWith('order-1', 'shop-1', expect.stringMatching(/^\d{4}$/));
    expect(notifications.notify).toHaveBeenCalledWith('customer-1', 'order_out_for_delivery', expect.any(String), expect.any(String), expect.anything());
  });

  it('completes on the right PIN and reports wrong / locked PINs', async () => {
    repo.verifyPin.mockResolvedValueOnce({ outcome: 'wrong', attemptsLeft: 3 });
    await expect(service.verifyPin('owner-1', 'order-1', '0000')).rejects.toMatchObject({
      code: 'ORDER_PIN_INVALID',
      details: { attemptsLeft: 3 },
    });
    repo.verifyPin.mockResolvedValueOnce({ outcome: 'locked' });
    await expect(service.verifyPin('owner-1', 'order-1', '0000')).rejects.toMatchObject({ code: 'ORDER_PIN_LOCKED' });
    repo.verifyPin.mockResolvedValueOnce({ outcome: 'verified', transition: transition({ status: 'completed' }) });
    await service.verifyPin('owner-1', 'order-1', '1234');
    expect(notifications.notify).toHaveBeenCalledWith('customer-1', 'order_completed', expect.any(String), expect.any(String), expect.anything());
  });

  it('needs a business profile for every shop step', async () => {
    businesses.getMyProfile.mockResolvedValue(null);
    await expect(service.acceptOrder('someone', 'order-1')).rejects.toMatchObject({ code: 'BUSINESS_PROFILE_NOT_FOUND' });
    expect(await service.listShopOrders('someone')).toEqual([]);
  });
});

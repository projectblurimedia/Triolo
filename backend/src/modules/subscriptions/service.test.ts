import { SubscriptionsService } from './service';
import { SubscriptionStatusService } from './statusService';
import { SubscriptionsRepository } from './repository';
import { SubscriptionSettings } from './interfaces';
import { razorpayService } from '@/common/services/razorpayService';

jest.mock('@/common/services/razorpayService', () => ({
  razorpayService: {
    createPaymentLink: jest.fn().mockResolvedValue({ id: 'plink_1', short_url: 'https://rzp.io/l/abc' }),
    paidLinkPayment: jest.fn(),
  },
}));
const razorpay = razorpayService as unknown as Record<string, jest.Mock>;

const SETTINGS: SubscriptionSettings = {
  subscriptionsEnabled: true,
  customerEnabled: true,
  partnerEnabled: true,
  customerPrices: { '1': 49, '3': 129, '6': 239, '12': 449 },
  partnerPrices: { '1': 99, '3': 269, '6': 499, '12': 899 },
  partnerPlanPrices: {
    service: { '1': 99, '3': 269, '6': 499, '12': 899 },
    shop: { '1': 99, '3': 269, '6': 499, '12': 899 },
    job_post: { '1': 49, '3': 129, '6': 239, '12': 449 },
  },
  headStartSeconds: 60,
  badgeEnabled: true,
  badgePrice: 199,
  badgeMinRating: 3,
  badgeMinRatings: 3,
  customerFees: { book: 10, order: 10, staffContact: 10 },
  partnerFees: { accept: 10, jobPost: 20 },
  updatedAt: '2026-10-21T00:00:00.000Z',
};

function makeRepo() {
  return {
    getSettings: jest.fn().mockResolvedValue(SETTINGS),
    updateSettings: jest.fn(),
    accountContact: jest.fn().mockResolvedValue({ name: 'Ravi', mobile: '9700000001', language: 'en' }),
    findActive: jest.fn().mockResolvedValue(null),
    findLastEnd: jest.fn().mockResolvedValue(null),
    findPending: jest.fn().mockResolvedValue(null),
    createSubscription: jest.fn().mockResolvedValue({ id: 'sub-1' }),
    setSubscriptionLink: jest.fn(),
    findSubscription: jest.fn(),
    activateSubscription: jest.fn(),
    activeAccountIds: jest.fn().mockResolvedValue(['partner-sub']),
    listSubscriptions: jest.fn(),
    counts: jest.fn(),
    createBadge: jest.fn().mockResolvedValue({ id: 'badge-1' }),
    setBadgeLink: jest.fn(),
    findBadge: jest.fn(),
    findLatestBadges: jest.fn().mockResolvedValue([]),
    findActiveBadge: jest.fn().mockResolvedValue(null),
    activateBadge: jest.fn(),
    trustedIds: jest.fn(),
    listBadges: jest.fn().mockResolvedValue([]),
    removeBadge: jest.fn(),
    countPaidPasses: jest.fn().mockResolvedValue({}),
    consumePass: jest.fn().mockResolvedValue(null),
    unlockedStaffPosts: jest.fn().mockResolvedValue([]),
    findUsablePass: jest.fn().mockResolvedValue(null),
    createPass: jest.fn().mockResolvedValue({ id: 'pass-1' }),
    setPassLink: jest.fn(),
    findPass: jest.fn(),
    markPassPaid: jest.fn(),
  };
}

function makeService(repo = makeRepo()) {
  const deps = {
    workers: {
      getMyProfile: jest.fn().mockResolvedValue({ id: 'worker-1', verificationStatus: 'verified' }),
      getVerifiedProfiles: jest.fn().mockResolvedValue([{ id: 'worker-1', accountFullName: 'Ravi', ratingAverage: 2.4, ratingCount: 5 }]),
    },
    businesses: {
      getMyProfile: jest.fn().mockResolvedValue({ id: 'shop-1', shopName: 'Sri Sai', verificationStatus: 'pending_verification' }),
      getVerifiedProfiles: jest.fn().mockResolvedValue([]),
    },
    jobSeekers: { getMine: jest.fn().mockResolvedValue(null), listMine: jest.fn().mockResolvedValue([]) },
    notifications: { notify: jest.fn().mockResolvedValue(undefined) },
  };
  const status = new SubscriptionStatusService(repo as unknown as SubscriptionsRepository);
  const service = new SubscriptionsService(repo as unknown as SubscriptionsRepository, status, deps as never);
  return { service, status, repo, deps };
}

describe('SubscriptionStatusService', () => {
  it('locks booking / ordering for a customer without a subscription', async () => {
    const { status, repo } = makeService();
    await expect(status.requireCustomer('cust-1')).rejects.toMatchObject({ code: 'SUBSCRIPTION_REQUIRED', statusCode: 403 });
    repo.findActive.mockResolvedValue({ id: 'sub-1' });
    status.forget('cust-1');
    await expect(status.requireCustomer('cust-1')).resolves.toBeUndefined();
  });

  it('locks nothing while customer subscriptions are off', async () => {
    const { status, repo } = makeService();
    repo.getSettings.mockResolvedValue({ ...SETTINGS, customerEnabled: false });
    await expect(status.requireCustomer('cust-1')).resolves.toBeUndefined();
  });

  it('gives subscribed partners the head start, and none when partner subscriptions are off', async () => {
    const { status, repo } = makeService();
    const headStart = await status.headStart();
    expect(headStart?.seconds).toBe(60);
    expect(headStart?.subscriberIds.has('partner-sub')).toBe(true);
    repo.getSettings.mockResolvedValue({ ...SETTINGS, partnerEnabled: false });
    status.forget();
    expect(await status.headStart()).toBeNull();
    expect(await status.priorityPartnerIds('service')).toEqual([]);
  });
});

describe('SubscriptionsService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('starts a payment link at the admin price for the chosen plan', async () => {
    const { service, repo } = makeService();
    const result = await service.checkout('cust-1', 'customer', 3);
    expect(repo.createSubscription).toHaveBeenCalledWith('cust-1', 'customer', 3, 129, 'all');
    expect(razorpay.createPaymentLink).toHaveBeenCalledWith(
      expect.objectContaining({ amountPaise: 12900, referenceId: 'sub-sub-1', customer: { name: 'Ravi', contact: '9700000001' } }),
    );
    expect(repo.setSubscriptionLink).toHaveBeenCalledWith('sub-1', 'plink_1', 'https://rzp.io/l/abc');
    expect(result).toEqual({ id: 'sub-1', amount: 129, paymentUrl: 'https://rzp.io/l/abc' });
  });

  it('charges a partner plan at its own price and checks only that plan', async () => {
    const { service, repo } = makeService();
    await service.checkout('p-1', 'partner', 3, 'job_post');
    expect(repo.findActive).toHaveBeenCalledWith('p-1', 'partner', 'job_post');
    expect(repo.createSubscription).toHaveBeenCalledWith('p-1', 'partner', 3, 129, 'job_post');
  });

  it('makes accepting free only on the plan for that side', async () => {
    const { status, repo } = makeService();
    repo.findActive.mockImplementation(async (_id: string, _audience: string, plan?: string) => (plan === 'shop' ? { id: 'sub-shop' } : null));
    repo.consumePass.mockResolvedValue('pass-9');
    await expect(status.usePartnerPass('p-1', 'accept', 'shop')).resolves.toBeNull();
    await expect(status.usePartnerPass('p-1', 'accept', 'service')).resolves.toBe('pass-9');
  });

  it('refuses a plan while subscriptions are off', async () => {
    const { service, repo } = makeService();
    repo.getSettings.mockResolvedValue({ ...SETTINGS, partnerEnabled: false });
    await expect(service.checkout('p-1', 'partner', 1)).rejects.toMatchObject({ code: 'SUBSCRIPTIONS_OFF' });
  });

  it('starts the plan once Razorpay says the link is paid — never for someone else', async () => {
    const { service, repo } = makeService();
    repo.findSubscription.mockResolvedValue({ id: 'sub-1', accountId: 'cust-1', audience: 'customer', status: 'unpaid', razorpayLinkId: 'plink_1', amount: 129 });
    razorpay.paidLinkPayment.mockResolvedValue('pay_1');
    const result = await service.checkPayment('cust-1', 'sub-1');
    expect(razorpay.paidLinkPayment).toHaveBeenCalledWith('plink_1', 12900);
    expect(repo.activateSubscription).toHaveBeenCalledWith('sub-1', 'pay_1');
    expect(result.paid).toBe(true);
    await expect(service.checkPayment('other', 'sub-1')).rejects.toMatchObject({ code: 'SUBSCRIPTION_NOT_FOUND' });
  });

  it('does nothing while the link is unpaid', async () => {
    const { service, repo } = makeService();
    repo.findSubscription.mockResolvedValue({ id: 'sub-1', accountId: 'cust-1', audience: 'customer', status: 'unpaid', razorpayLinkId: 'plink_1', amount: 129 });
    razorpay.paidLinkPayment.mockResolvedValue(null);
    const result = await service.checkPayment('cust-1', 'sub-1');
    expect(repo.activateSubscription).not.toHaveBeenCalled();
    expect(result.paid).toBe(false);
  });

  it('sells a badge only for a verified profile', async () => {
    const { service, repo } = makeService();
    await service.badgeCheckout('p-1', 'service');
    expect(repo.createBadge).toHaveBeenCalledWith('p-1', 'service', 'worker-1', 199);
    await expect(service.badgeCheckout('p-1', 'business')).rejects.toMatchObject({ code: 'BADGE_PROFILE_NOT_ELIGIBLE' });
    await expect(service.badgeCheckout('p-1', 'job_post')).rejects.toMatchObject({ code: 'BADGE_PROFILE_NOT_FOUND' });
  });

  it('flags active badges whose rating fell below the minimum', async () => {
    const { service, repo } = makeService();
    repo.listBadges.mockResolvedValue([{ id: 'badge-1', kind: 'service', profileId: 'worker-1', accountName: 'Ravi', accountMobile: '9700000001' }]);
    const flagged = await service.badgesToReview();
    expect(flagged).toEqual([expect.objectContaining({ id: 'badge-1', ratingAverage: 2.4, ratingCount: 5, profileName: 'Ravi' })]);
    repo.getSettings.mockResolvedValue({ ...SETTINGS, badgeMinRatings: 10 });
    expect(await service.badgesToReview()).toEqual([]);
  });

  it('removing a badge tells the partner why', async () => {
    const { service, repo, deps } = makeService();
    repo.removeBadge.mockResolvedValue({ id: 'badge-1', accountId: 'p-1', kind: 'service', profileId: 'worker-1', status: 'removed' });
    await service.removeBadge('badge-1', ' Too many low ratings ');
    expect(repo.removeBadge).toHaveBeenCalledWith('badge-1', 'Too many low ratings');
    expect(deps.notifications.notify).toHaveBeenCalledWith(
      'p-1',
      'badge_removed',
      expect.stringContaining('badge removed'),
      expect.stringContaining('Too many low ratings'),
      { audience: 'partner' },
    );
  });
});

describe('pay per use', () => {
  beforeEach(() => jest.clearAllMocks());

  it('without a plan, booking needs a paid pass — PAYMENT_REQUIRED with the admin\'s price', async () => {
    const { status, repo } = makeService();
    await expect(status.useCustomerPass('cust-1', 'book')).rejects.toMatchObject({ code: 'PAYMENT_REQUIRED', details: { kind: 'book', amount: 10 } });
    repo.consumePass.mockResolvedValue('pass-1');
    await expect(status.useCustomerPass('cust-1', 'order')).resolves.toBe('pass-1');
  });

  it('with a plan, or plans off, nothing is charged', async () => {
    const { status, repo } = makeService();
    repo.findActive.mockResolvedValue({ id: 'sub-1' });
    await expect(status.useCustomerPass('cust-1', 'book')).resolves.toBeNull();
    expect(repo.consumePass).not.toHaveBeenCalled();
    repo.getSettings.mockResolvedValue({ ...SETTINGS, partnerEnabled: false });
    status.forget();
    await expect(status.usePartnerPass('p-1', 'accept')).resolves.toBeNull();
  });

  it('a pass checkout makes a payment link at the admin\'s fee', async () => {
    const { service, repo } = makeService();
    const result = await service.passCheckout('cust-1', 'staff_contact', 'post-1');
    expect(repo.createPass).toHaveBeenCalledWith('cust-1', 'staff_contact', 10, 'post-1');
    expect(result).toEqual({ id: 'pass-1', paid: false, amount: 10, paymentUrl: 'https://rzp.io/l/abc' });
  });

  it('a phone number already paid for is not charged again', async () => {
    const { service, repo } = makeService();
    repo.unlockedStaffPosts.mockResolvedValue(['post-1']);
    await expect(service.passCheckout('cust-1', 'staff_contact', 'post-1')).resolves.toMatchObject({ paid: true });
    expect(repo.createPass).not.toHaveBeenCalled();
  });

  it('hides staff numbers unless paid for (no plan)', async () => {
    const { status, repo } = makeService();
    repo.unlockedStaffPosts.mockResolvedValue(['post-1']);
    const access = await status.staffContactAccess('cust-1');
    expect(access.all).toBe(false);
    expect(access.ids.has('post-1')).toBe(true);
  });
});

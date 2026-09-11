import { BookingsService } from './service';
import { BookingsRepository } from './repository';
import { WorkersService } from '@/modules/workers/service';
import { NotificationsService } from '@/modules/notifications/service';
import { AppError } from '@/common/errors/AppError';
import { BookingRequest, BookingRequestWithAcceptedWorker } from './interfaces';

type MockRepository = { [K in keyof BookingsRepository]: jest.Mock };

function createMockRepository(): MockRepository {
  return {
    createRequest: jest.fn(),
    createOffers: jest.fn(),
    findByIdForAccount: jest.fn(),
    findPendingOffersForWorker: jest.fn(),
    acceptOffer: jest.fn(),
  } as unknown as MockRepository;
}

function createMockWorkersService(): jest.Mocked<WorkersService> {
  return {
    findMatchingForBroadcast: jest.fn(),
    getMyProfile: jest.fn(),
  } as unknown as jest.Mocked<WorkersService>;
}

function createMockNotificationsService(): jest.Mocked<NotificationsService> {
  return { sendRawPush: jest.fn() } as unknown as jest.Mocked<NotificationsService>;
}

function buildRequest(overrides: Partial<BookingRequest> = {}): BookingRequest {
  return {
    id: 'request-1',
    accountId: 'account-1',
    skillCategories: ['electrician', 'plumber'],
    latitude: 17.385,
    longitude: 78.4867,
    radiusKm: 50,
    status: 'broadcasting',
    acceptedWorkerId: null,
    acceptedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('BookingsService.createQuickBooking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates the request, matches workers, stores offers, and pushes every matched worker', async () => {
    const repo = createMockRepository();
    const workers = createMockWorkersService();
    const notifications = createMockNotificationsService();
    repo.createRequest.mockResolvedValue(buildRequest());
    workers.findMatchingForBroadcast.mockResolvedValue([
      { workerId: 'worker-1', accountId: 'worker-account-1', accountFullName: 'Rajesh', preferredLanguage: 'en', distanceMeters: 480 },
      { workerId: 'worker-2', accountId: 'worker-account-2', accountFullName: 'Suresh', preferredLanguage: 'te', distanceMeters: 1200 },
    ]);

    const service = new BookingsService(repo as unknown as BookingsRepository, workers, notifications);
    const result = await service.createQuickBooking('account-1', {
      skillCategories: ['electrician', 'plumber'],
      latitude: 17.385,
      longitude: 78.4867,
      radiusKm: 50,
    });

    expect(result).toEqual({ bookingRequestId: 'request-1', matchedWorkerCount: 2 });
    expect(repo.createOffers).toHaveBeenCalledWith('request-1', [
      { workerId: 'worker-1', distanceMeters: 480 },
      { workerId: 'worker-2', distanceMeters: 1200 },
    ]);
    expect(notifications.sendRawPush).toHaveBeenCalledTimes(2);
    expect(notifications.sendRawPush).toHaveBeenCalledWith(
      'worker-account-1',
      expect.any(String),
      expect.stringContaining('Electrician'),
      expect.objectContaining({ tag: 'request-1', channelId: 'booking-offers', priority: 'max' }),
    );
  });

  it('skips offer creation and pushes when no worker matches', async () => {
    const repo = createMockRepository();
    const workers = createMockWorkersService();
    const notifications = createMockNotificationsService();
    repo.createRequest.mockResolvedValue(buildRequest());
    workers.findMatchingForBroadcast.mockResolvedValue([]);

    const service = new BookingsService(repo as unknown as BookingsRepository, workers, notifications);
    const result = await service.createQuickBooking('account-1', {
      skillCategories: ['electrician'],
      latitude: 17.385,
      longitude: 78.4867,
      radiusKm: 50,
    });

    expect(result.matchedWorkerCount).toBe(0);
    expect(repo.createOffers).not.toHaveBeenCalled();
    expect(notifications.sendRawPush).not.toHaveBeenCalled();
  });
});

describe('BookingsService.getRequestStatus', () => {
  it('returns the repository result when the request belongs to the caller', async () => {
    const repo = createMockRepository();
    const workers = createMockWorkersService();
    const notifications = createMockNotificationsService();
    const status: BookingRequestWithAcceptedWorker = {
      ...buildRequest({ status: 'accepted', acceptedWorkerId: 'worker-1' }),
      acceptedWorkerFullName: 'Rajesh',
      acceptedWorkerSkillCategories: ['electrician', 'plumber'],
    };
    repo.findByIdForAccount.mockResolvedValue(status);

    const service = new BookingsService(repo as unknown as BookingsRepository, workers, notifications);
    await expect(service.getRequestStatus('account-1', 'request-1')).resolves.toBe(status);
    expect(repo.findByIdForAccount).toHaveBeenCalledWith('request-1', 'account-1');
  });

  it('throws NOT_FOUND when the request does not exist or belongs to someone else', async () => {
    const repo = createMockRepository();
    repo.findByIdForAccount.mockResolvedValue(null);
    const service = new BookingsService(
      repo as unknown as BookingsRepository,
      createMockWorkersService(),
      createMockNotificationsService(),
    );

    await expect(service.getRequestStatus('account-1', 'request-1')).rejects.toThrow(AppError);
  });
});

describe('BookingsService.getMyOffers', () => {
  it('returns an empty list when the caller has no worker profile', async () => {
    const repo = createMockRepository();
    const workers = createMockWorkersService();
    workers.getMyProfile.mockResolvedValue(null);

    const service = new BookingsService(repo as unknown as BookingsRepository, workers, createMockNotificationsService());
    await expect(service.getMyOffers('account-1')).resolves.toEqual([]);
    expect(repo.findPendingOffersForWorker).not.toHaveBeenCalled();
  });

  it('looks up pending offers for the caller\'s own worker profile id', async () => {
    const repo = createMockRepository();
    const workers = createMockWorkersService();
    workers.getMyProfile.mockResolvedValue({ id: 'worker-1' } as never);
    const offers = [{ offerId: 'offer-1', bookingRequestId: 'request-1', skillCategories: ['electrician'], distanceMeters: 480, createdAt: new Date() }];
    repo.findPendingOffersForWorker.mockResolvedValue(offers);

    const service = new BookingsService(repo as unknown as BookingsRepository, workers, createMockNotificationsService());
    await expect(service.getMyOffers('account-1')).resolves.toBe(offers);
    expect(repo.findPendingOffersForWorker).toHaveBeenCalledWith('worker-1');
  });
});

describe('BookingsService.acceptOffer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws NOT_FOUND when the caller has no worker profile', async () => {
    const repo = createMockRepository();
    const workers = createMockWorkersService();
    workers.getMyProfile.mockResolvedValue(null);

    const service = new BookingsService(repo as unknown as BookingsRepository, workers, createMockNotificationsService());
    await expect(service.acceptOffer('account-1', 'request-1')).rejects.toThrow(AppError);
    expect(repo.acceptOffer).not.toHaveBeenCalled();
  });

  it('throws a conflict when the job was already taken by another worker', async () => {
    const repo = createMockRepository();
    const workers = createMockWorkersService();
    const notifications = createMockNotificationsService();
    workers.getMyProfile.mockResolvedValue({ id: 'worker-2' } as never);
    repo.acceptOffer.mockResolvedValue({ won: false });

    const service = new BookingsService(repo as unknown as BookingsRepository, workers, notifications);
    await expect(service.acceptOffer('account-2', 'request-1')).rejects.toThrow(AppError);
    expect(notifications.sendRawPush).not.toHaveBeenCalled();
  });

  it('on a win, pushes a "taken" notification to every losing worker (same tag, no in-app row)', async () => {
    const repo = createMockRepository();
    const workers = createMockWorkersService();
    const notifications = createMockNotificationsService();
    workers.getMyProfile.mockResolvedValue({ id: 'worker-1' } as never);
    repo.acceptOffer.mockResolvedValue({
      won: true,
      request: buildRequest({ status: 'accepted', acceptedWorkerId: 'worker-1' }),
      losingWorkers: [
        { accountId: 'worker-account-2', preferredLanguage: 'en' },
        { accountId: 'worker-account-3', preferredLanguage: 'te' },
      ],
    });

    const service = new BookingsService(repo as unknown as BookingsRepository, workers, notifications);
    await service.acceptOffer('account-1', 'request-1');

    expect(repo.acceptOffer).toHaveBeenCalledWith('request-1', 'worker-1');
    expect(notifications.sendRawPush).toHaveBeenCalledTimes(2);
    expect(notifications.sendRawPush).toHaveBeenCalledWith(
      'worker-account-2',
      expect.any(String),
      expect.any(String),
      { tag: 'request-1', channelId: 'booking-offers' },
    );
  });
});

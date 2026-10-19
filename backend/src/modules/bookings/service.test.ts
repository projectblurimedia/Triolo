import { BookingsService } from './service';
import { BookingsRepository } from './repository';
import { WorkersService } from '@/modules/workers/service';
import { NotificationsService } from '@/modules/notifications/service';
import { BookingRequest, BookingTransition, CustomerBooking } from './interfaces';

type MockRepository = { [K in keyof BookingsRepository]: jest.Mock };

function createMockRepository(): MockRepository {
  return {
    createRequest: jest.fn(),
    createOffers: jest.fn(),
    exists: jest.fn(),
    findByIdForAccount: jest.fn(),
    findForCustomer: jest.fn(),
    complete: jest.fn(),
    cancel: jest.fn(),
    cancelByWorker: jest.fn(),
    adminCancel: jest.fn(),
    adminActiveIdsForAccount: jest.fn(),
    declineOffer: jest.fn(),
    findPendingOffersForWorker: jest.fn(),
    addOffersForOpenRequests: jest.fn(),
    findJobForWorker: jest.fn(),
    findJobsForWorker: jest.fn(),
    acceptOffer: jest.fn(),
    startTrip: jest.fn(),
    updateWorkerLocation: jest.fn(),
    markArrived: jest.fn(),
    verifyPin: jest.fn(),
    markWorkDone: jest.fn(),
    createAssigned: jest.fn(),
    findRatedForWorker: jest.fn(),
    findStatuses: jest.fn(),
    expireStaleBroadcasts: jest.fn(),
    findWorkerContact: jest.fn(),
    findAccountName: jest.fn(),
    declineDirect: jest.fn(),
    cancelLate: jest.fn(),
  } as unknown as MockRepository;
}

let repo: MockRepository;
let workers: jest.Mocked<WorkersService>;
let notifications: jest.Mocked<NotificationsService>;
let service: BookingsService;

beforeEach(() => {
  jest.clearAllMocks();
  repo = createMockRepository();
  workers = {
    findMatchingForBroadcast: jest.fn(),
    getMyProfile: jest.fn(),
    getPublicProfile: jest.fn(),
    recordRating: jest.fn(),
  } as unknown as jest.Mocked<WorkersService>;
  notifications = { sendRawPush: jest.fn(), notify: jest.fn() } as unknown as jest.Mocked<NotificationsService>;
  service = new BookingsService(repo as unknown as BookingsRepository, workers, notifications);
});

function buildRequest(overrides: Partial<BookingRequest> = {}): BookingRequest {
  return {
    id: 'request-1',
    accountId: 'account-1',
    skillCategories: ['electrician', 'plumber'],
    latitude: 17.385,
    longitude: 78.4867,
    locationAddress: 'Ameerpet, Hyderabad',
    radiusKm: 50,
    status: 'broadcasting',
    acceptedWorkerId: null,
    acceptedAt: null,
    startedAt: null,
    arrivedAt: null,
    pinVerifiedAt: null,
    workDoneAt: null,
    completedAt: null,
    cancelledAt: null,
    cancelledBy: null,
    cancelReason: null,
    expiredAt: null,
    workerRating: null,
    workerReview: null,
    problemPostId: null,
    quotationAmount: null,
    targetWorkerId: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function transition(notifyAccountId: string | null, overrides: Partial<BookingRequest> = {}): BookingTransition {
  return {
    request: buildRequest(overrides),
    notify: notifyAccountId ? { accountId: notifyAccountId, preferredLanguage: 'en' } : null,
  };
}

const asWorker = () => workers.getMyProfile.mockResolvedValue({ id: 'worker-1' } as never);

describe('createQuickBooking', () => {
  it('creates the request (with address), matches workers, stores offers, and pushes every matched worker', async () => {
    repo.createRequest.mockResolvedValue(buildRequest());
    workers.findMatchingForBroadcast.mockResolvedValue([
      {
        workerId: 'worker-1',
        accountId: 'worker-account-1',
        accountFullName: 'Rajesh',
        preferredLanguage: 'en',
        distanceMeters: 480,
      },
      {
        workerId: 'worker-2',
        accountId: 'worker-account-2',
        accountFullName: 'Suresh',
        preferredLanguage: 'te',
        distanceMeters: 1200,
      },
    ]);

    const result = await service.createQuickBooking('account-1', {
      skillCategories: ['electrician', 'plumber'],
      latitude: 17.385,
      longitude: 78.4867,
      radiusKm: 50,
      locationAddress: 'Ameerpet, Hyderabad',
    });

    expect(result).toEqual({ bookingRequestId: 'request-1', matchedWorkerCount: 2 });
    expect(repo.createRequest).toHaveBeenCalledWith(expect.objectContaining({ locationAddress: 'Ameerpet, Hyderabad' }));
    expect(repo.createOffers).toHaveBeenCalledWith('request-1', [
      { workerId: 'worker-1', distanceMeters: 480 },
      { workerId: 'worker-2', distanceMeters: 1200 },
    ]);
    expect(notifications.sendRawPush).toHaveBeenCalledTimes(2);
    expect(notifications.sendRawPush).toHaveBeenCalledWith(
      'worker-account-1',
      expect.any(String),
      expect.stringContaining('Electrician'),
      expect.objectContaining({ dataOnly: true, data: { kind: 'booking_offer', bookingRequestId: 'request-1' } }),
    );
  });

  it('skips offers and pushes when no worker matches', async () => {
    repo.createRequest.mockResolvedValue(buildRequest());
    workers.findMatchingForBroadcast.mockResolvedValue([]);

    const result = await service.createQuickBooking('account-1', {
      skillCategories: ['electrician'],
      latitude: 17.385,
      longitude: 78.4867,
      radiusKm: 50,
    });

    expect(result.matchedWorkerCount).toBe(0);
    expect(repo.createRequest).toHaveBeenCalledWith(expect.objectContaining({ locationAddress: null }));
    expect(repo.createOffers).not.toHaveBeenCalled();
  });
});

describe('customer reads', () => {
  it('returns the caller’s own booking', async () => {
    const booking = { ...buildRequest(), worker: null, arrivalPin: null } as unknown as CustomerBooking;
    repo.findByIdForAccount.mockResolvedValue(booking);

    await expect(service.getRequestStatus('account-1', 'request-1')).resolves.toBe(booking);
    expect(repo.findByIdForAccount).toHaveBeenCalledWith('request-1', 'account-1');
  });

  it('404s for a booking that is not the caller’s', async () => {
    repo.findByIdForAccount.mockResolvedValue(null);
    await expect(service.getRequestStatus('account-1', 'request-1')).rejects.toMatchObject({ code: 'BOOKING_REQUEST_NOT_FOUND' });
  });

  it('lists the caller’s booking history', async () => {
    repo.findForCustomer.mockResolvedValue([]);
    await service.listMyBookings('account-1');
    expect(repo.findForCustomer).toHaveBeenCalledWith('account-1', 50);
  });
});

describe('acceptOffer', () => {
  it('404s when the caller has no worker profile', async () => {
    workers.getMyProfile.mockResolvedValue(null);
    await expect(service.acceptOffer('account-2', 'request-1')).rejects.toMatchObject({ code: 'WORKER_PROFILE_NOT_FOUND' });
    expect(repo.acceptOffer).not.toHaveBeenCalled();
  });

  it('409s when another worker already won', async () => {
    asWorker();
    repo.acceptOffer.mockResolvedValue({ won: false });
    await expect(service.acceptOffer('account-2', 'request-1')).rejects.toMatchObject({ code: 'BOOKING_ALREADY_TAKEN' });
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('on a win: sets a 4-digit PIN, notifies the customer, and replaces losing workers’ notifications', async () => {
    asWorker();
    repo.acceptOffer.mockResolvedValue({
      won: true,
      request: buildRequest({ status: 'accepted', acceptedWorkerId: 'worker-1' }),
      customer: { accountId: 'account-1', preferredLanguage: 'en' },
      losingWorkers: [{ accountId: 'worker-account-2', preferredLanguage: 'te' }],
    });

    await service.acceptOffer('worker-account-1', 'request-1');

    const pin = repo.acceptOffer.mock.calls[0][2];
    expect(repo.acceptOffer).toHaveBeenCalledWith('request-1', 'worker-1', expect.any(String));
    expect(pin).toMatch(/^\d{4}$/);
    expect(notifications.notify).toHaveBeenCalledWith(
      'account-1',
      'booking_accepted',
      'Worker Found',
      expect.any(String),
      expect.objectContaining({ data: { kind: 'booking_accepted', bookingId: 'request-1' } }),
    );
    // The customer's push must never carry `bookingRequestId` (partner-app treats that as a new offer).
    expect(JSON.stringify(notifications.notify.mock.calls[0][4])).not.toContain('bookingRequestId');
    expect(notifications.sendRawPush).toHaveBeenCalledWith(
      'worker-account-2',
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ data: { kind: 'booking_taken', bookingRequestId: 'request-1' }, dataOnly: true }),
    );
  });
});

describe('trip steps (worker)', () => {
  it('starts the trip and tells the customer the worker is on the way', async () => {
    asWorker();
    repo.startTrip.mockResolvedValue(transition('account-1', { status: 'on_the_way' }));

    await service.startTrip('worker-account-1', 'request-1');

    expect(repo.startTrip).toHaveBeenCalledWith('request-1', 'worker-1');
    expect(notifications.notify).toHaveBeenCalledWith(
      'account-1',
      'booking_on_the_way',
      expect.any(String),
      expect.any(String),
      expect.anything(),
    );
  });

  it('409s starting a trip from the wrong state', async () => {
    asWorker();
    repo.startTrip.mockResolvedValue(null);
    repo.exists.mockResolvedValue(true);

    await expect(service.startTrip('worker-account-1', 'request-1')).rejects.toMatchObject({ code: 'BOOKING_INVALID_STATE' });
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('stores the worker’s live location, and 409s once the trip is over', async () => {
    asWorker();
    repo.updateWorkerLocation.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await service.updateWorkerLocation('worker-account-1', 'request-1', { latitude: 17.4, longitude: 78.5 });
    expect(repo.updateWorkerLocation).toHaveBeenCalledWith('request-1', 'worker-1', 17.4, 78.5);
    await expect(
      service.updateWorkerLocation('worker-account-1', 'request-1', { latitude: 17.4, longitude: 78.5 }),
    ).rejects.toMatchObject({ code: 'BOOKING_TRIP_NOT_ACTIVE' });
  });

  it('marks arrived and asks the customer to share their PIN', async () => {
    asWorker();
    repo.markArrived.mockResolvedValue(transition('account-1', { status: 'arrived' }));

    await service.markArrived('worker-account-1', 'request-1');

    expect(notifications.notify).toHaveBeenCalledWith(
      'account-1',
      'booking_arrived',
      'Worker Has Arrived',
      expect.any(String),
      expect.anything(),
    );
  });

  it('accepts the correct PIN without pushing', async () => {
    asWorker();
    repo.verifyPin.mockResolvedValue({ outcome: 'verified', transition: transition('account-1', { status: 'in_progress' }) });

    await service.verifyPin('worker-account-1', 'request-1', '1234');

    expect(repo.verifyPin).toHaveBeenCalledWith('request-1', 'worker-1', '1234');
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('rejects a wrong PIN with the attempts left', async () => {
    asWorker();
    repo.verifyPin.mockResolvedValue({ outcome: 'wrong', attemptsLeft: 3 });

    await expect(service.verifyPin('worker-account-1', 'request-1', '0000')).rejects.toMatchObject({
      code: 'BOOKING_PIN_INVALID',
      details: { attemptsLeft: 3 },
    });
  });

  it('refuses once the PIN is locked after too many wrong tries', async () => {
    asWorker();
    repo.verifyPin.mockResolvedValue({ outcome: 'locked' });

    await expect(service.verifyPin('worker-account-1', 'request-1', '0000')).rejects.toMatchObject({
      code: 'BOOKING_PIN_LOCKED',
    });
  });

  it('marks work done and asks the customer to confirm', async () => {
    asWorker();
    repo.markWorkDone.mockResolvedValue(transition('account-1', { status: 'work_done' }));

    await service.markWorkDone('worker-account-1', 'request-1');

    expect(notifications.notify).toHaveBeenCalledWith(
      'account-1',
      'booking_work_done',
      expect.any(String),
      expect.any(String),
      expect.anything(),
    );
  });

  it('lists the worker’s jobs, or nothing without a worker profile', async () => {
    asWorker();
    repo.findJobsForWorker.mockResolvedValue([]);
    await service.listMyJobs('worker-account-1');
    expect(repo.findJobsForWorker).toHaveBeenCalledWith('worker-1', 50);

    workers.getMyProfile.mockResolvedValue(null);
    await expect(service.listMyJobs('someone')).resolves.toEqual([]);
  });

  it('404s a job that is not the worker’s', async () => {
    asWorker();
    repo.findJobForWorker.mockResolvedValue(null);
    await expect(service.getMyJob('worker-account-1', 'request-1')).rejects.toMatchObject({ code: 'BOOKING_REQUEST_NOT_FOUND' });
  });
});

describe('cancelling a late worker', () => {
  it('cancels with a rating, counts it, and tells the worker why', async () => {
    repo.cancelLate.mockResolvedValue(transition('worker-account-1', { status: 'cancelled', acceptedWorkerId: 'worker-1' }));
    await service.cancelBooking('account-1', 'request-1', { rating: 1, review: 'Did not come' });
    expect(repo.cancelLate).toHaveBeenCalledWith('request-1', 'account-1', 1, 'Did not come');
    expect(workers.recordRating).toHaveBeenCalledWith('worker-1', 1);
    expect(notifications.notify).toHaveBeenCalledWith(
      'worker-account-1',
      'booking_cancelled',
      'Booking Cancelled',
      expect.stringContaining("didn't arrive in time"),
      expect.objectContaining({ audience: 'partner' }),
    );
    expect(repo.cancel).not.toHaveBeenCalled();
  });

  it('refuses a rating when the worker is not late', async () => {
    repo.cancelLate.mockResolvedValue(null);
    await expect(service.cancelBooking('account-1', 'request-1', { rating: 1 })).rejects.toMatchObject({ code: 'BOOKING_NOT_LATE' });
    expect(workers.recordRating).not.toHaveBeenCalled();
  });
});

describe('customer finish / cancel', () => {
  it('completes with a rating + feedback, adds it to the worker’s rating, and tells the worker', async () => {
    repo.complete.mockResolvedValue(transition('worker-account-1', { status: 'completed', acceptedWorkerId: 'worker-1' }));

    await service.completeBooking('account-1', 'request-1', { rating: 5, review: 'On time and neat' });

    expect(repo.complete).toHaveBeenCalledWith('request-1', 'account-1', 5, 'On time and neat');
    expect(workers.recordRating).toHaveBeenCalledWith('worker-1', 5);
    expect(notifications.notify).toHaveBeenCalledWith(
      'worker-account-1',
      'booking_completed',
      'Job Finished',
      expect.any(String),
      expect.anything(),
    );
  });

  it('409s completing a booking that is not in progress', async () => {
    repo.complete.mockResolvedValue(null);
    repo.exists.mockResolvedValue(true);

    await expect(service.completeBooking('account-1', 'request-1', { rating: 4 })).rejects.toMatchObject({
      code: 'BOOKING_INVALID_STATE',
    });
    expect(workers.recordRating).not.toHaveBeenCalled();
  });

  it('cancels and tells the assigned worker', async () => {
    repo.cancel.mockResolvedValue(transition('worker-account-1', { status: 'cancelled' }));

    await service.cancelBooking('account-1', 'request-1');

    expect(notifications.notify).toHaveBeenCalledWith(
      'worker-account-1',
      'booking_cancelled',
      expect.any(String),
      expect.any(String),
      expect.anything(),
    );
  });

  it('cancels a still-searching booking without notifying anyone', async () => {
    repo.cancel.mockResolvedValue(transition(null, { status: 'cancelled' }));

    await service.cancelBooking('account-1', 'request-1');

    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('409s cancelling after the PIN was verified', async () => {
    repo.cancel.mockResolvedValue(null);
    repo.exists.mockResolvedValue(true);

    await expect(service.cancelBooking('account-1', 'request-1')).rejects.toMatchObject({ code: 'BOOKING_INVALID_STATE' });
  });
});

describe('find jobs now', () => {
  const profile = {
    id: 'worker-1',
    verificationStatus: 'verified',
    skillCategories: ['plumber'],
    latitude: 16.7,
    longitude: 81.1,
  };

  it('adds offers from the device position and returns open offers', async () => {
    workers.getMyProfile.mockResolvedValue(profile as never);
    repo.findPendingOffersForWorker.mockResolvedValue([{ offerId: 'o-1' }]);

    const offers = await service.searchOpenRequests('worker-account-1', { latitude: 17, longitude: 82 });

    expect(repo.addOffersForOpenRequests).toHaveBeenCalledWith('worker-1', 'worker-account-1', ['plumber'], 17, 82);
    expect(offers).toEqual([{ offerId: 'o-1' }]);
  });

  it('falls back to the profile location', async () => {
    workers.getMyProfile.mockResolvedValue(profile as never);
    repo.findPendingOffersForWorker.mockResolvedValue([]);

    await service.searchOpenRequests('worker-account-1');

    expect(repo.addOffersForOpenRequests).toHaveBeenCalledWith('worker-1', 'worker-account-1', ['plumber'], 16.7, 81.1);
  });

  it('finds nothing for an unverified worker', async () => {
    workers.getMyProfile.mockResolvedValue({ ...profile, verificationStatus: 'pending_verification' } as never);

    expect(await service.searchOpenRequests('worker-account-1')).toEqual([]);
    expect(repo.addOffersForOpenRequests).not.toHaveBeenCalled();
  });
});

describe('worker cancel', () => {
  it('cancels the worker’s own job with a reason and tells the customer', async () => {
    asWorker();
    repo.cancelByWorker.mockResolvedValue(transition('account-1', { status: 'cancelled', cancelledBy: 'worker' }));

    await service.cancelByWorker('worker-account-1', 'request-1', 'Bike broke down');

    expect(repo.cancelByWorker).toHaveBeenCalledWith('request-1', 'worker-1', 'Bike broke down');
    expect(notifications.notify).toHaveBeenCalledWith(
      'account-1',
      'booking_cancelled',
      'Worker Cancelled',
      expect.stringContaining('book again'),
      expect.anything(),
    );
  });

  it('reopens the problem when the worker cancels a problem trip', async () => {
    const listener = { onProblemTripCompleted: jest.fn(), onProblemTripCancelled: jest.fn() };
    service.setLifecycleListener(listener);
    asWorker();
    repo.cancelByWorker.mockResolvedValue(transition('account-1', { status: 'cancelled', problemPostId: 'post-1' }));

    await service.cancelByWorker('worker-account-1', 'trip-1');

    expect(repo.cancelByWorker).toHaveBeenCalledWith('trip-1', 'worker-1', null);
    expect(listener.onProblemTripCancelled).toHaveBeenCalledWith('post-1');
    expect(notifications.notify).toHaveBeenCalledWith(
      'account-1',
      'booking_cancelled',
      'Worker Cancelled',
      expect.stringContaining('open again'),
      expect.anything(),
    );
  });

  it('409s once the PIN was verified', async () => {
    asWorker();
    repo.cancelByWorker.mockResolvedValue(null);
    repo.exists.mockResolvedValue(true);

    await expect(service.cancelByWorker('worker-account-1', 'request-1')).rejects.toMatchObject({
      code: 'BOOKING_INVALID_STATE',
    });
    expect(notifications.notify).not.toHaveBeenCalled();
  });
});

describe('declineOffer', () => {
  it('declines only the worker’s own offer', async () => {
    asWorker();
    repo.declineDirect.mockResolvedValue(null);
    await service.declineOffer('worker-account-1', 'request-1');
    expect(repo.declineOffer).toHaveBeenCalledWith('request-1', 'worker-1');
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('ends a booking of this worker in particular and tells the customer', async () => {
    asWorker();
    repo.declineDirect.mockResolvedValue(transition('account-1', { status: 'cancelled', cancelledBy: 'worker' }));
    await service.declineOffer('worker-account-1', 'request-1');
    expect(repo.declineDirect).toHaveBeenCalledWith('request-1', 'worker-1');
    expect(notifications.notify).toHaveBeenCalledWith(
      'account-1',
      'booking_cancelled',
      'Worker Not Available',
      expect.any(String),
      expect.objectContaining({ audience: 'user' }),
    );
  });
});

describe('createDirectBooking', () => {
  const dto = { workerId: 'worker-1', skillCategories: ['plumber'], latitude: 17.385, longitude: 78.4867 };
  const worker = {
    id: 'worker-1',
    accountId: 'worker-account-1',
    skillCategories: ['plumber', 'electrician'],
    latitude: 17.39,
    longitude: 78.49,
    verificationStatus: 'verified',
  };

  it('asks only that worker, personally', async () => {
    workers.getPublicProfile.mockResolvedValue(worker as never);
    repo.findWorkerContact.mockResolvedValue({ accountId: 'worker-account-1', preferredLanguage: 'en' });
    repo.findAccountName.mockResolvedValue('Ravi');
    repo.createRequest.mockResolvedValue(buildRequest({ id: 'request-9', targetWorkerId: 'worker-1' }));
    const result = await service.createDirectBooking('account-1', dto);
    expect(result).toEqual({ bookingRequestId: 'request-9' });
    expect(repo.createRequest).toHaveBeenCalledWith(expect.objectContaining({ targetWorkerId: 'worker-1', skillCategories: ['plumber'] }));
    expect(repo.createOffers).toHaveBeenCalledWith('request-9', [expect.objectContaining({ workerId: 'worker-1' })]);
    expect(notifications.sendRawPush).toHaveBeenCalledTimes(1);
    expect(notifications.sendRawPush).toHaveBeenCalledWith(
      'worker-account-1',
      'Booking Request for You',
      expect.stringContaining('Ravi wants to book you for Plumber'),
      expect.objectContaining({ data: expect.objectContaining({ kind: 'booking_offer', direct: 'true' }) }),
    );
  });

  it('refuses work the worker does not do, an unverified worker, and booking yourself', async () => {
    workers.getPublicProfile.mockResolvedValue(worker as never);
    await expect(service.createDirectBooking('account-1', { ...dto, skillCategories: ['mason'] })).rejects.toMatchObject({
      code: 'BOOKING_SKILL_MISMATCH',
    });
    await expect(service.createDirectBooking('worker-account-1', dto)).rejects.toMatchObject({ code: 'BOOKING_OWN_PROFILE' });
    workers.getPublicProfile.mockResolvedValue({ ...worker, verificationStatus: 'pending_verification' } as never);
    await expect(service.createDirectBooking('account-1', dto)).rejects.toMatchObject({ code: 'WORKER_NOT_FOUND' });
    expect(repo.createRequest).not.toHaveBeenCalled();
  });
});

describe('trips started from a problem post', () => {
  const listener = { onProblemTripCompleted: jest.fn(), onProblemTripCancelled: jest.fn() };

  beforeEach(() => service.setLifecycleListener(listener));

  it('creates an already-accepted trip with a fresh 4-digit PIN', async () => {
    repo.createAssigned.mockResolvedValue(buildRequest({ id: 'trip-1', status: 'accepted' }));

    const id = await service.createForAcceptedProblem({
      customerAccountId: 'account-1',
      workerId: 'worker-1',
      skillCategories: ['plumber'],
      latitude: 16.7,
      longitude: 81.1,
      locationAddress: 'Eluru',
      distanceMeters: 1200,
      problemPostId: 'post-1',
      quotationAmount: 500,
    });

    expect(id).toBe('trip-1');
    expect(repo.createAssigned).toHaveBeenCalledWith(
      expect.objectContaining({ problemPostId: 'post-1', quotationAmount: 500, arrivalPin: expect.stringMatching(/^\d{4}$/) }),
    );
  });

  it('tells the problems module when the trip is completed, with the rating', async () => {
    repo.complete.mockResolvedValue(
      transition('worker-account-1', { status: 'completed', acceptedWorkerId: 'worker-1', problemPostId: 'post-1' }),
    );

    await service.completeBooking('account-1', 'trip-1', { rating: 4, review: 'Good' });

    expect(listener.onProblemTripCompleted).toHaveBeenCalledWith('post-1', 4, 'Good');
  });

  it('tells the problems module when the customer cancels, so the post reopens', async () => {
    repo.cancel.mockResolvedValue(transition('worker-account-1', { status: 'cancelled', problemPostId: 'post-1' }));

    await service.cancelBooking('account-1', 'trip-1');

    expect(listener.onProblemTripCancelled).toHaveBeenCalledWith('post-1');
  });

  it('does not call the listener for plain Quick Book trips', async () => {
    repo.complete.mockResolvedValue(transition('worker-account-1', { status: 'completed' }));

    await service.completeBooking('account-1', 'trip-1', {});

    expect(listener.onProblemTripCompleted).not.toHaveBeenCalled();
  });
});

describe('broadcast expiry', () => {
  it('ends stale broadcasts before the customer reads a booking or their list', async () => {
    repo.findByIdForAccount.mockResolvedValue({ ...buildRequest({ status: 'expired' }), worker: null, arrivalPin: null });
    repo.findForCustomer.mockResolvedValue([]);

    const booking = await service.getRequestStatus('account-1', 'request-1');
    await service.listMyBookings('account-1');

    expect(repo.expireStaleBroadcasts).toHaveBeenCalledTimes(2);
    expect(booking.status).toBe('expired');
  });
});

describe('admin cancel', () => {
  it('stops a trip at any step, tells both people with the reason, and reopens a problem', async () => {
    const listener = { onProblemTripCompleted: jest.fn(), onProblemTripCancelled: jest.fn() };
    service.setLifecycleListener(listener);
    repo.adminCancel.mockResolvedValue({
      request: buildRequest({ status: 'cancelled', problemPostId: 'post-1' }),
      customer: { accountId: 'account-1', preferredLanguage: 'en' },
      worker: { accountId: 'worker-account-1', preferredLanguage: 'en' },
    });

    await service.adminCancel('request-1', 'Safety report');

    expect(notifications.notify).toHaveBeenCalledTimes(2);
    expect(notifications.notify).toHaveBeenCalledWith(
      'account-1',
      'booking_cancelled',
      'Booking Cancelled by Triolo',
      'Triolo support cancelled this booking. Reason: Safety report',
      expect.anything(),
    );
    expect(listener.onProblemTripCancelled).toHaveBeenCalledWith('post-1');
  });

  it('cancels every unfinished booking of a suspended account', async () => {
    repo.adminActiveIdsForAccount.mockResolvedValue(['a', 'b']);
    repo.adminCancel.mockResolvedValue({
      request: buildRequest(),
      customer: { accountId: 'x', preferredLanguage: 'en' },
      worker: null,
    });
    expect(await service.adminCancelActiveForAccount('account-1', null)).toBe(2);
    expect(repo.adminCancel).toHaveBeenCalledTimes(2);
  });
});

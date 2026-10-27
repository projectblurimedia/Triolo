import { NotificationsService, setProfileViewerReveal } from './service';
import { NotificationsRepository } from './repository';
import { AppNotification } from './interfaces';
import * as pushSender from './pushSender';

jest.mock('./pushSender', () => ({
  sendPushNotification: jest.fn(),
}));

const sendPushNotification = jest.mocked(pushSender.sendPushNotification);

type MockRepository = {
  [K in keyof NotificationsRepository]: jest.Mock;
};

function createMockRepository(): MockRepository {
  return {
    create: jest.fn(),
    findForAccount: jest.fn(),
    markRead: jest.fn(),
    markAllRead: jest.fn(),
    upsertPushToken: jest.fn(),
    removePushToken: jest.fn(),
    findPushTokens: jest.fn().mockResolvedValue([]),
    deleteMany: jest.fn(),
  } as unknown as MockRepository;
}

function buildNotification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'notification-1',
    accountId: 'account-1',
    type: 'profile_view',
    title: 'Profile Viewed',
    body: 'Someone viewed your profile.',
    isRead: false,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('NotificationsService.notifyProfileViewed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a profile_view notification for the recipient', async () => {
    const repo = createMockRepository();
    repo.create.mockResolvedValue(buildNotification());
    repo.findPushTokens.mockResolvedValue([]);
    const service = new NotificationsService(repo as unknown as NotificationsRepository);

    await service.notifyProfileViewed('owner-1', 'viewer-1');

    expect(repo.create).toHaveBeenCalledWith({
      accountId: 'owner-1',
      type: 'profile_view',
      title: 'Profile Viewed',
      body: 'Someone viewed your profile.',
      actorAccountId: 'viewer-1',
      refKind: null,
    });
  });

  it('does not notify when the viewer is the profile owner', async () => {
    const repo = createMockRepository();
    const service = new NotificationsService(repo as unknown as NotificationsRepository);

    await service.notifyProfileViewed('account-1', 'account-1');

    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.findPushTokens).not.toHaveBeenCalled();
  });

  it('sends a push notification when the recipient has a registered token', async () => {
    const repo = createMockRepository();
    repo.create.mockResolvedValue(buildNotification());
    repo.findPushTokens.mockResolvedValue([{ token: 'device-token-123', app: 'partner' }]);
    const service = new NotificationsService(repo as unknown as NotificationsRepository);

    await service.notifyProfileViewed('owner-1', 'viewer-1');

    expect(sendPushNotification).toHaveBeenCalledWith(
      'device-token-123',
      'Profile Viewed',
      'Someone viewed your profile.',
      { data: { notificationId: 'notification-1' } },
    );
  });

  it('skips the push send when the recipient has no registered token', async () => {
    const repo = createMockRepository();
    repo.create.mockResolvedValue(buildNotification());
    repo.findPushTokens.mockResolvedValue([]);
    const service = new NotificationsService(repo as unknown as NotificationsRepository);

    await service.notifyProfileViewed('owner-1', 'viewer-1');

    expect(sendPushNotification).not.toHaveBeenCalled();
  });
});

describe('NotificationsService.listForAccount', () => {
  it('returns the repository result, with no viewer for a partner who isn\'t subscribed', async () => {
    const repo = createMockRepository();
    const result = { items: [buildNotification()], unreadCount: 1 };
    repo.findForAccount.mockResolvedValue(result);
    const service = new NotificationsService(repo as unknown as NotificationsRepository);

    await expect(service.listForAccount('account-1')).resolves.toEqual({
      items: [{ ...buildNotification(), createdAt: expect.any(Date), viewer: null }],
      unreadCount: 1,
    });
    expect(repo.findForAccount).toHaveBeenCalledWith('account-1', 50);
  });
});

describe('NotificationsService.markRead / markAllRead', () => {
  it('delegates markRead to the repository, scoped to the caller', async () => {
    const repo = createMockRepository();
    const service = new NotificationsService(repo as unknown as NotificationsRepository);

    await service.markRead('account-1', 'notification-1');
    expect(repo.markRead).toHaveBeenCalledWith('account-1', 'notification-1');
  });

  it('delegates markAllRead to the repository, scoped to the caller', async () => {
    const repo = createMockRepository();
    const service = new NotificationsService(repo as unknown as NotificationsRepository);

    await service.markAllRead('account-1');
    expect(repo.markAllRead).toHaveBeenCalledWith('account-1');
  });
});

describe('NotificationsService.registerPushToken', () => {
  it('delegates to the repository, scoped to the caller', async () => {
    const repo = createMockRepository();
    const service = new NotificationsService(repo as unknown as NotificationsRepository);

    await service.registerPushToken('account-1', 'device-token-123');
    expect(repo.upsertPushToken).toHaveBeenCalledWith('account-1', 'device-token-123', 'legacy');
  });
});

describe('NotificationsService.sendRawPush', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends a push with the given options when the recipient has a registered token, and writes no in-app row', async () => {
    const repo = createMockRepository();
    repo.findPushTokens.mockResolvedValue([{ token: 'device-token-123', app: 'partner' }]);
    const service = new NotificationsService(repo as unknown as NotificationsRepository);

    await service.sendRawPush('account-1', 'New Job Nearby', 'Someone 500m away needs Electrician.', {
      tag: 'booking-1',
      channelId: 'booking-offers',
      priority: 'max',
    });

    expect(sendPushNotification).toHaveBeenCalledWith(
      'device-token-123',
      'New Job Nearby',
      'Someone 500m away needs Electrician.',
      {
        tag: 'booking-1',
        channelId: 'booking-offers',
        priority: 'max',
      },
    );
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('skips the send when the recipient has no registered token', async () => {
    const repo = createMockRepository();
    repo.findPushTokens.mockResolvedValue([]);
    const service = new NotificationsService(repo as unknown as NotificationsRepository);

    await service.sendRawPush('account-1', 'title', 'body');
    expect(sendPushNotification).not.toHaveBeenCalled();
  });
});

describe('NotificationsService.notify', () => {
  beforeEach(() => jest.clearAllMocks());

  it('saves an in-app notification and pushes it when the recipient has a device token', async () => {
    const repository = createMockRepository();
    repository.findPushTokens.mockResolvedValue([{ token: 'device-token', app: 'user' }]);
    const service = new NotificationsService(repository as unknown as NotificationsRepository);

    await service.notify('account-1', 'problem_accepted', 'Worker Found', 'A worker accepted.', { channelId: 'default' });

    expect(repository.create).toHaveBeenCalledWith({
      accountId: 'account-1',
      type: 'problem_accepted',
      title: 'Worker Found',
      body: 'A worker accepted.',
    });
    expect(sendPushNotification).toHaveBeenCalledWith('device-token', 'Worker Found', 'A worker accepted.', {
      channelId: 'default',
    });
  });

  it('still saves the notification when there is no device token', async () => {
    const repository = createMockRepository();
    repository.findPushTokens.mockResolvedValue([]);
    const service = new NotificationsService(repository as unknown as NotificationsRepository);

    await service.notify('account-1', 'problem_completed', 'Job Finished', 'Confirmed.');

    expect(repository.create).toHaveBeenCalled();
    expect(sendPushNotification).not.toHaveBeenCalled();
  });
});

describe('NotificationsService.deleteNotifications', () => {
  it('deletes only within the caller’s own account', async () => {
    const repository = createMockRepository();
    repository.deleteMany.mockResolvedValue(2);
    const service = new NotificationsService(repository as unknown as NotificationsRepository);

    const deleted = await service.deleteNotifications('account-1', ['n-1', 'n-2']);

    expect(repository.deleteMany).toHaveBeenCalledWith('account-1', ['n-1', 'n-2']);
    expect(deleted).toBe(2);
  });
});

describe('push tokens per app', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends a customer notification to the user app only, never the partner app', async () => {
    const repository = createMockRepository();
    repository.findPushTokens.mockResolvedValue([
      { token: 'user-phone', app: 'user' },
      { token: 'partner-phone', app: 'partner' },
    ]);
    const service = new NotificationsService(repository as unknown as NotificationsRepository);

    await service.notify('account-1', 'booking_on_the_way', 'On the way', 'Coming');

    expect(sendPushNotification).toHaveBeenCalledTimes(1);
    expect(sendPushNotification).toHaveBeenCalledWith('user-phone', 'On the way', 'Coming', undefined);
  });

  it('sends a job offer to the partner app even when the user app registered later', async () => {
    const repository = createMockRepository();
    repository.findPushTokens.mockResolvedValue([
      { token: 'partner-phone', app: 'partner' },
      { token: 'user-phone', app: 'user' },
    ]);
    const service = new NotificationsService(repository as unknown as NotificationsRepository);

    await service.sendRawPush('worker-1', 'New job', 'Electrician needed', { dataOnly: true });

    expect(sendPushNotification).toHaveBeenCalledTimes(1);
    expect(sendPushNotification).toHaveBeenCalledWith('partner-phone', 'New job', 'Electrician needed', { dataOnly: true });
  });

  it('falls back to a token from an older app version when there is no exact-app token', async () => {
    const repository = createMockRepository();
    repository.findPushTokens.mockResolvedValue([{ token: 'old-phone', app: 'legacy' }]);
    const service = new NotificationsService(repository as unknown as NotificationsRepository);

    await service.sendRawPush('worker-1', 'New job', 'Electrician needed');

    expect(sendPushNotification).toHaveBeenCalledWith('old-phone', 'New job', 'Electrician needed', undefined);
  });

  it('admin notices go to every app the account is signed in to', async () => {
    const repository = createMockRepository();
    repository.findPushTokens.mockResolvedValue([
      { token: 'user-phone', app: 'user' },
      { token: 'partner-phone', app: 'partner' },
    ]);
    const service = new NotificationsService(repository as unknown as NotificationsRepository);

    await service.notify('account-1', 'admin_notice', 'Suspended', 'Reason');

    expect(sendPushNotification).toHaveBeenCalledTimes(2);
  });

  it('registers a token for its app, and removes it on logout', async () => {
    const repository = createMockRepository();
    const service = new NotificationsService(repository as unknown as NotificationsRepository);

    await service.registerPushToken('account-1', 'phone', 'partner');
    await service.unregisterPushToken('account-1', 'partner', 'phone');

    expect(repository.upsertPushToken).toHaveBeenCalledWith('account-1', 'phone', 'partner');
    expect(repository.removePushToken).toHaveBeenCalledWith('account-1', 'partner', 'phone');
  });
});

describe('NotificationsService — who viewed (subscribed partners)', () => {
  afterEach(() => setProfileViewerReveal(async () => false));

  it('a subscribed partner sees the viewer’s name, never their number', async () => {
    setProfileViewerReveal(async () => true);
    const repo = createMockRepository();
    repo.findForAccount.mockResolvedValue({
      items: [{ ...buildNotification(), actorAccountId: 'viewer-1', actorName: 'Haritha Kotha', actorMobile: '9491754784' }],
      unreadCount: 1,
    });
    const service = new NotificationsService(repo as unknown as NotificationsRepository);
    const list = await service.listForAccount('account-1');
    expect(list.items[0]).toMatchObject({ title: 'Haritha Kotha viewed your profile', viewer: { name: 'Haritha Kotha' } });
    expect(JSON.stringify(list.items[0])).not.toContain('9491754784');
    expect(list.items[0]).not.toHaveProperty('actorMobile');
  });

  it('without a subscription the viewer stays hidden', async () => {
    const repo = createMockRepository();
    repo.findForAccount.mockResolvedValue({
      items: [{ ...buildNotification(), actorAccountId: 'viewer-1', actorName: 'Haritha Kotha', actorMobile: '9491754784' }],
      unreadCount: 1,
    });
    const service = new NotificationsService(repo as unknown as NotificationsRepository);
    const list = await service.listForAccount('account-1');
    expect(list.items[0]).toMatchObject({ title: 'Profile Viewed', viewer: null });
  });
});

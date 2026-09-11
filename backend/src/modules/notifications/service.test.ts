import { NotificationsService } from './service';
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
    findPushToken: jest.fn(),
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
    repo.findPushToken.mockResolvedValue(null);
    const service = new NotificationsService(repo as unknown as NotificationsRepository);

    await service.notifyProfileViewed('owner-1', 'viewer-1');

    expect(repo.create).toHaveBeenCalledWith({
      accountId: 'owner-1',
      type: 'profile_view',
      title: 'Profile Viewed',
      body: 'Someone viewed your profile.',
    });
  });

  it('does not notify when the viewer is the profile owner', async () => {
    const repo = createMockRepository();
    const service = new NotificationsService(repo as unknown as NotificationsRepository);

    await service.notifyProfileViewed('account-1', 'account-1');

    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.findPushToken).not.toHaveBeenCalled();
  });

  it('sends a push notification when the recipient has a registered token', async () => {
    const repo = createMockRepository();
    repo.create.mockResolvedValue(buildNotification());
    repo.findPushToken.mockResolvedValue('device-token-123');
    const service = new NotificationsService(repo as unknown as NotificationsRepository);

    await service.notifyProfileViewed('owner-1', 'viewer-1');

    expect(sendPushNotification).toHaveBeenCalledWith('device-token-123', 'Profile Viewed', 'Someone viewed your profile.');
  });

  it('skips the push send when the recipient has no registered token', async () => {
    const repo = createMockRepository();
    repo.create.mockResolvedValue(buildNotification());
    repo.findPushToken.mockResolvedValue(null);
    const service = new NotificationsService(repo as unknown as NotificationsRepository);

    await service.notifyProfileViewed('owner-1', 'viewer-1');

    expect(sendPushNotification).not.toHaveBeenCalled();
  });
});

describe('NotificationsService.listForAccount', () => {
  it('returns the repository result unchanged', async () => {
    const repo = createMockRepository();
    const result = { items: [buildNotification()], unreadCount: 1 };
    repo.findForAccount.mockResolvedValue(result);
    const service = new NotificationsService(repo as unknown as NotificationsRepository);

    await expect(service.listForAccount('account-1')).resolves.toBe(result);
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
    expect(repo.upsertPushToken).toHaveBeenCalledWith('account-1', 'device-token-123');
  });
});

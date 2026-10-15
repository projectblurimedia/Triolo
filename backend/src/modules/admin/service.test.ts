import { AdminDependencies, AdminService } from './service';

function mockDeps() {
  const deps = {
    auth: {
      adminStats: jest.fn(),
      adminListAccounts: jest.fn(),
      adminGetAccount: jest.fn().mockResolvedValue({ id: 'acc-1', role: 'user', preferredLanguage: 'en' }),
      adminModerate: jest.fn().mockResolvedValue({ id: 'acc-1', status: 'suspended' }),
    },
    workers: {
      adminListProfiles: jest.fn(),
      adminGetProfile: jest.fn(),
      adminSetVerificationStatus: jest.fn(),
      adminCounts: jest.fn(),
      adminDeleteForAccount: jest.fn().mockResolvedValue(true),
      getMyProfile: jest.fn().mockResolvedValue(null),
    },
    businesses: {
      adminListProfiles: jest.fn(),
      adminGetProfile: jest.fn(),
      adminSetVerificationStatus: jest.fn(),
      adminCounts: jest.fn(),
      adminDeleteForAccount: jest.fn().mockResolvedValue(false),
      getMyProfile: jest.fn().mockResolvedValue(null),
    },
    jobSeekers: {
      adminList: jest.fn(),
      adminGet: jest.fn(),
      adminSetActive: jest.fn().mockResolvedValue({ id: 'post-1', accountId: 'acc-1' }),
      adminDelete: jest.fn().mockResolvedValue('acc-1'),
      adminDeleteForAccount: jest.fn().mockResolvedValue(true),
      adminCounts: jest.fn(),
      getMine: jest.fn().mockResolvedValue(null),
    },
    bookings: {
      adminList: jest.fn().mockResolvedValue({ items: [] }),
      adminGet: jest.fn(),
      adminCancel: jest.fn(),
      adminCancelActiveForAccount: jest.fn(),
      adminCounts: jest.fn(),
    },
    orders: {
      adminList: jest.fn().mockResolvedValue({ items: [] }),
      adminGet: jest.fn(),
      adminCancel: jest.fn(),
      adminCancelActiveForAccount: jest.fn(),
      adminCounts: jest.fn(),
    },
    problems: {
      adminList: jest.fn().mockResolvedValue({ items: [] }),
      adminGet: jest.fn(),
      adminClose: jest.fn().mockResolvedValue({ id: 'p-1', accountId: 'acc-2' }),
      adminCloseOpenForAccount: jest.fn(),
      adminCounts: jest.fn(),
    },
    notifications: { notify: jest.fn() },
  };
  return { deps, service: new AdminService(deps as unknown as AdminDependencies) };
}

describe('AdminService', () => {
  it('delegates verification to the workers module', async () => {
    const { deps, service } = mockDeps();
    await service.setWorkerVerification('worker-1', 'verified');
    expect(deps.workers.adminSetVerificationStatus).toHaveBeenCalledWith('worker-1', 'verified');
  });

  it('suspending stops the person’s activity and tells them, with the reason', async () => {
    const { deps, service } = mockDeps();

    await service.moderateAccount('acc-1', { action: 'suspend', days: 7, reason: ' Fake reviews ' });

    expect(deps.auth.adminModerate).toHaveBeenCalledWith('acc-1', 'suspend', { days: 7, reason: 'Fake reviews' });
    expect(deps.bookings.adminCancelActiveForAccount).toHaveBeenCalledWith('acc-1', 'Fake reviews');
    expect(deps.orders.adminCancelActiveForAccount).toHaveBeenCalledWith('acc-1', 'Fake reviews');
    expect(deps.problems.adminCloseOpenForAccount).toHaveBeenCalledWith('acc-1', 'Fake reviews');
    expect(deps.notifications.notify).toHaveBeenCalledWith(
      'acc-1',
      'admin_notice',
      'Account Suspended',
      'Triolo has suspended your account for 7 days. Reason: Fake reviews',
      expect.anything(),
    );
  });

  it('reactivating does not cancel anything', async () => {
    const { deps, service } = mockDeps();
    await service.moderateAccount('acc-1', { action: 'reactivate' });
    expect(deps.bookings.adminCancelActiveForAccount).not.toHaveBeenCalled();
    expect(deps.notifications.notify).toHaveBeenCalledWith(
      'acc-1',
      'admin_notice',
      'Account Active Again',
      expect.any(String),
      expect.anything(),
    );
  });

  it('remove-profiles deletes every profile and bans the account', async () => {
    const { deps, service } = mockDeps();

    const result = await service.removeProfiles('acc-1', 'Fraud');

    expect(deps.workers.adminDeleteForAccount).toHaveBeenCalledWith('acc-1');
    expect(deps.businesses.adminDeleteForAccount).toHaveBeenCalledWith('acc-1');
    expect(deps.jobSeekers.adminDeleteForAccount).toHaveBeenCalledWith('acc-1');
    expect(deps.auth.adminModerate).toHaveBeenCalledWith('acc-1', 'ban', { reason: 'Fraud' });
    expect(result.removed).toEqual({ worker: true, shop: false, jobPost: true });
  });

  it('never removes an admin', async () => {
    const { deps, service } = mockDeps();
    deps.auth.adminGetAccount.mockResolvedValue({ id: 'acc-1', role: 'admin', preferredLanguage: 'en' });
    await expect(service.removeProfiles('acc-1')).rejects.toMatchObject({ code: 'ADMIN_ACCOUNT_PROTECTED' });
    expect(deps.workers.adminDeleteForAccount).not.toHaveBeenCalled();
  });

  it('closing a problem tells its poster', async () => {
    const { deps, service } = mockDeps();
    await service.closeProblem('p-1', 'Duplicate');
    expect(deps.problems.adminClose).toHaveBeenCalledWith('p-1', 'Duplicate');
    expect(deps.notifications.notify).toHaveBeenCalledWith(
      'acc-2',
      'admin_notice',
      'Problem Post Closed',
      expect.stringContaining('Duplicate'),
      expect.anything(),
    );
  });

  it('a failed notice never undoes the action', async () => {
    const { deps, service } = mockDeps();
    deps.notifications.notify.mockRejectedValue(new Error('push down'));
    await expect(service.removeJobPost('post-1', 'Spam')).resolves.toBeUndefined();
    expect(deps.jobSeekers.adminDelete).toHaveBeenCalledWith('post-1');
  });
});

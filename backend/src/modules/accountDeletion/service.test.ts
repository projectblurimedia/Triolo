import { AccountDeletionService } from './service';

function makeDeps() {
  const calls: string[] = [];
  const track = (name: string, value: unknown = undefined) => jest.fn(async () => {
    calls.push(name);
    return value;
  });
  const deps = {
    auth: { markDeleted: track('markDeleted'), purgeDeleted: track('purgeDeleted', 2) },
    workers: { adminDeleteForAccount: track('workers') },
    businesses: { adminDeleteForAccount: track('businesses') },
    jobSeekers: { adminDeleteForAccount: track('jobSeekers') },
    bookings: { adminCancelActiveForAccount: track('bookingsCancel') },
    orders: {
      adminCancelActiveForAccount: track('ordersCancel'),
      purgeMediaForAccount: track('ordersMedia'),
      purgeOldMedia: track('oldMedia', 5),
    },
    problems: { adminCloseOpenForAccount: track('problemsClose'), clearPhotosForAccount: track('problemPhotos') },
    notifications: { removeAllForAccount: track('notifications') },
  };
  return { deps, calls };
}

describe('account deletion', () => {
  it('cancels activity first, removes profiles and media, then stops the account', async () => {
    const { deps, calls } = makeDeps();
    await new AccountDeletionService(deps as never).deleteMyAccount('acc-1');
    expect(calls.slice(0, 3)).toEqual(['bookingsCancel', 'ordersCancel', 'problemsClose']);
    expect(calls).toEqual(expect.arrayContaining(['workers', 'businesses', 'jobSeekers', 'problemPhotos', 'ordersMedia', 'notifications']));
    expect(calls[calls.length - 1]).toBe('markDeleted');
    expect(deps.bookings.adminCancelActiveForAccount).toHaveBeenCalledWith('acc-1', 'The account was deleted');
  });

  it('daily: wipes accounts deleted 30+ days ago and old orders\' media', async () => {
    const { deps } = makeDeps();
    await expect(new AccountDeletionService(deps as never).dailyCleanup()).resolves.toEqual({ accountsWiped: 2, ordersCleared: 5 });
  });
});

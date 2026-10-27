import { JobSeekersService } from './service';
import { JobSeekersRepository } from './repository';
import { JobSeekerPost, SaveJobSeekerPostParams } from './interfaces';
import { deletePhotosFromCloudinary, uploadToCloudinary } from '@/common/services/cloudinaryService';

jest.mock('@/common/services/cloudinaryService', () => ({
  uploadToCloudinary: jest.fn(),
  deletePhotosFromCloudinary: jest.fn(),
}));

type MockRepository = { [K in keyof JobSeekersRepository]: jest.Mock };

const POST: JobSeekerPost = {
  id: 'post-1',
  viewCount: 0,
  accountId: 'acc-1',
  category: 'cook',
  title: 'Home cook',
  payAmount: 12000,
  payPeriod: 'monthly',
  availability: 'full_time',
  experienceYears: 3,
  skills: ['South Indian'],
  description: null,
  latitude: 16.7,
  longitude: 81.1,
  locationAddress: 'Eluru',
  photoUrl: null,
  isActive: true,
  createdAt: '2026-10-15T00:00:00.000Z',
  updatedAt: '2026-10-15T00:00:00.000Z',
};

const PARAMS: SaveJobSeekerPostParams = {
  category: 'cook',
  title: 'Home cook',
  payAmount: 12000,
  payPeriod: 'monthly',
  availability: 'full_time',
  experienceYears: 3,
  skills: [' South Indian ', 'South Indian', '', 'Tiffins'],
  description: '   ',
  latitude: 16.7,
  longitude: 81.1,
  locationAddress: 'Eluru',
};

let repository: MockRepository;
let service: JobSeekersService;

beforeEach(() => {
  repository = {
    findByAccount: jest.fn(),
    listByAccount: jest.fn(),
    findOwned: jest.fn(),
    countByAccount: jest.fn().mockResolvedValue(0),
    create: jest.fn(),
    update: jest.fn(),
    setActive: jest.fn(),
    delete: jest.fn(),
    deleteAllForAccount: jest.fn().mockResolvedValue([]),
    recordView: jest.fn().mockResolvedValue(true),
    setPhoto: jest.fn(),
    search: jest.fn(),
  } as unknown as MockRepository;
  service = new JobSeekersService(repository as unknown as JobSeekersRepository);
});

describe('JobSeekersService', () => {
  it('creates a post with trimmed, de-duplicated skills and a blank description as null', async () => {
    repository.create.mockResolvedValue(POST);
    await service.createMine('acc-1', PARAMS);
    expect(repository.create).toHaveBeenCalledWith(
      'acc-1',
      expect.objectContaining({ skills: ['South Indian', 'Tiffins'], description: null }),
    );
  });

  it('keeps several posts, up to the limit', async () => {
    repository.countByAccount.mockResolvedValue(5);
    await expect(service.createMine('acc-1', PARAMS)).rejects.toMatchObject({ code: 'JOB_POST_LIMIT' });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('edits one own post by id', async () => {
    repository.update.mockResolvedValue(POST);
    await service.updateMine('acc-1', 'post-1', PARAMS);
    expect(repository.update).toHaveBeenCalledWith('acc-1', 'post-1', expect.objectContaining({ skills: ['South Indian', 'Tiffins'] }));
    repository.update.mockResolvedValue(null);
    await expect(service.updateMine('acc-1', 'post-9', PARAMS)).rejects.toMatchObject({ code: 'JOB_POST_NOT_FOUND' });
  });

  it('older builds: PUT /me edits the first post, or creates one', async () => {
    repository.findByAccount.mockResolvedValue(POST);
    repository.update.mockResolvedValue(POST);
    await service.saveMine('acc-1', PARAMS);
    expect(repository.update).toHaveBeenCalledWith('acc-1', 'post-1', expect.anything());
    repository.findByAccount.mockResolvedValue(null);
    repository.create.mockResolvedValue(POST);
    await service.saveMine('acc-1', PARAMS);
    expect(repository.create).toHaveBeenCalled();
  });

  it('hides or shows one post', async () => {
    repository.setActive.mockResolvedValue({ ...POST, isActive: false });
    const post = await service.setActive('acc-1', false, 'post-1');
    expect(post.isActive).toBe(false);
    expect(repository.setActive).toHaveBeenCalledWith('acc-1', 'post-1', false);
  });

  it('rejects hiding when there is no post', async () => {
    repository.findByAccount.mockResolvedValue(null);
    await expect(service.setActive('acc-1', false)).rejects.toMatchObject({ code: 'JOB_POST_NOT_FOUND' });
  });

  it('rejects deleting a post that is not theirs', async () => {
    repository.delete.mockResolvedValue(null);
    await expect(service.deleteMine('acc-1', 'post-9')).rejects.toMatchObject({ code: 'JOB_POST_NOT_FOUND' });
  });

  it('deletes the photo from storage along with the post', async () => {
    repository.delete.mockResolvedValue({ photoUrl: 'https://res.cloudinary.com/x/old.jpg' });
    await service.deleteMine('acc-1', 'post-1');
    expect(deletePhotosFromCloudinary).toHaveBeenCalledWith(['https://res.cloudinary.com/x/old.jpg']);
  });

  it('removes every post of an account for the admin, with their photos', async () => {
    repository.deleteAllForAccount.mockResolvedValue(['https://res.cloudinary.com/x/a.jpg', null]);
    expect(await service.adminDeleteForAccount('acc-1')).toBe(true);
    expect(deletePhotosFromCloudinary).toHaveBeenCalledWith(['https://res.cloudinary.com/x/a.jpg']);
  });

  it('uploads a photo and removes the one it replaces', async () => {
    repository.findByAccount.mockResolvedValue(POST);
    repository.findOwned.mockResolvedValue(POST);
    (uploadToCloudinary as jest.Mock).mockResolvedValue({ url: 'https://res.cloudinary.com/x/new.jpg' });
    repository.setPhoto.mockResolvedValue({
      post: { ...POST, photoUrl: 'https://res.cloudinary.com/x/new.jpg' },
      previousUrl: 'https://res.cloudinary.com/x/old.jpg',
    });
    const post = await service.setPhoto('acc-1', { path: '/tmp/p.jpg' } as Express.Multer.File);
    expect(post.photoUrl).toBe('https://res.cloudinary.com/x/new.jpg');
    expect(deletePhotosFromCloudinary).toHaveBeenCalledWith(['https://res.cloudinary.com/x/old.jpg']);
  });

  it('rejects a photo upload with no post', async () => {
    repository.findByAccount.mockResolvedValue(null);
    await expect(service.setPhoto('acc-1', { path: '/tmp/p.jpg' } as Express.Multer.File)).rejects.toMatchObject({
      code: 'JOB_POST_NOT_FOUND',
    });
    expect(uploadToCloudinary).not.toHaveBeenCalled();
  });

  it('counts a customer opening a post', async () => {
    await service.recordView('post-1', 'acc-2');
    expect(repository.recordView).toHaveBeenCalledWith('post-1', 'acc-2');
  });

  it('tells the poster once a day per viewer, and hides viewers without the job post plan', async () => {
    const notifications = { notifyJobPostViewed: jest.fn().mockResolvedValue(undefined), markReadByRef: jest.fn().mockResolvedValue(undefined) };
    const status = { revealsProfileViewers: jest.fn().mockResolvedValue(false), priorityPartnerIds: jest.fn().mockResolvedValue([]) };
    const viewing = new JobSeekersService(repository as unknown as JobSeekersRepository, status as never, notifications as never);
    repository.recordView.mockResolvedValueOnce({ ownerAccountId: 'acc-1', title: 'Teacher', firstToday: true });
    await viewing.recordView('post-1', 'acc-2');
    expect(notifications.notifyJobPostViewed).toHaveBeenCalledWith('acc-1', 'acc-2', { id: 'post-1', title: 'Teacher' });
    repository.recordView.mockResolvedValueOnce({ ownerAccountId: 'acc-1', title: 'Teacher', firstToday: false });
    await viewing.recordView('post-1', 'acc-2');
    expect(notifications.notifyJobPostViewed).toHaveBeenCalledTimes(1);

    repository.listViewers = jest.fn().mockResolvedValue([
      { viewerKey: 'acc-2', name: 'Ravi', mobile: '9700000002', lastViewedAt: '2026-10-26T00:00:00.000Z', times: 2, isNew: true },
    ]);
    const locked = await viewing.listViewers('acc-1', 'post-1');
    expect(locked).toMatchObject({ locked: true, total: 2, newCount: 1 });
    expect(locked.viewers[0]).toMatchObject({ name: null, mobile: null });
    status.revealsProfileViewers.mockResolvedValue(true);
    expect((await viewing.listViewers('acc-1', 'post-1')).viewers[0]).toMatchObject({ name: 'Ravi', mobile: '9700000002' });
    expect(status.revealsProfileViewers).toHaveBeenCalledWith('acc-1', 'job_post');
  });

  it('searches on behalf of the caller, so their own post is excluded', async () => {
    repository.search.mockResolvedValue([]);
    const params = { latitude: 16.7, longitude: 81.1, radiusKm: 25, sort: 'distance' as const, limit: 30 };
    await service.search('acc-2', params);
    expect(repository.search).toHaveBeenCalledWith('acc-2', { ...params, priorityAccountIds: [] });
  });
});

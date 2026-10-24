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
    upsert: jest.fn(),
    setActive: jest.fn(),
    delete: jest.fn(),
    setPhoto: jest.fn(),
    search: jest.fn(),
  } as unknown as MockRepository;
  service = new JobSeekersService(repository as unknown as JobSeekersRepository);
});

describe('JobSeekersService', () => {
  it('saves the post with trimmed, de-duplicated skills and a blank description as null', async () => {
    repository.upsert.mockResolvedValue(POST);
    await service.saveMine('acc-1', PARAMS);
    expect(repository.upsert).toHaveBeenCalledWith(
      'acc-1',
      expect.objectContaining({ skills: ['South Indian', 'Tiffins'], description: null }),
    );
  });

  it('hides or shows the post', async () => {
    repository.setActive.mockResolvedValue({ ...POST, isActive: false });
    const post = await service.setActive('acc-1', false);
    expect(post.isActive).toBe(false);
  });

  it('rejects hiding when there is no post', async () => {
    repository.setActive.mockResolvedValue(null);
    await expect(service.setActive('acc-1', false)).rejects.toMatchObject({ code: 'JOB_POST_NOT_FOUND' });
  });

  it('rejects deleting when there is no post', async () => {
    repository.delete.mockResolvedValue(null);
    await expect(service.deleteMine('acc-1')).rejects.toMatchObject({ code: 'JOB_POST_NOT_FOUND' });
  });

  it('deletes the photo from storage along with the post', async () => {
    repository.delete.mockResolvedValue({ photoUrl: 'https://res.cloudinary.com/x/old.jpg' });
    await service.deleteMine('acc-1');
    expect(deletePhotosFromCloudinary).toHaveBeenCalledWith(['https://res.cloudinary.com/x/old.jpg']);
  });

  it('uploads a photo and removes the one it replaces', async () => {
    repository.findByAccount.mockResolvedValue(POST);
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

  it('searches on behalf of the caller, so their own post is excluded', async () => {
    repository.search.mockResolvedValue([]);
    const params = { latitude: 16.7, longitude: 81.1, radiusKm: 25, sort: 'distance' as const, limit: 30 };
    await service.search('acc-2', params);
    expect(repository.search).toHaveBeenCalledWith('acc-2', { ...params, priorityAccountIds: [] });
  });
});

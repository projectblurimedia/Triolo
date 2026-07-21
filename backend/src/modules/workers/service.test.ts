import { WorkersService } from './service';
import { WorkersRepository } from './repository';
import { WorkerProfile } from './interfaces';
import * as cloudinaryService from '@/common/services/cloudinaryService';

jest.mock('@/common/services/cloudinaryService', () => ({
  uploadToCloudinary: jest.fn(),
}));

const uploadToCloudinary = jest.mocked(cloudinaryService.uploadToCloudinary);

type MockRepository = {
  [K in keyof WorkersRepository]: jest.Mock;
};

function createMockRepository(): MockRepository {
  return {
    findByAccountId: jest.fn(),
    create: jest.fn(),
  } as unknown as MockRepository;
}

function buildProfile(overrides: Partial<WorkerProfile> = {}): WorkerProfile {
  return {
    id: 'worker-1',
    accountId: 'account-1',
    skillCategories: ['electrician'],
    otherSkillDescription: null,
    experienceYears: 3,
    latitude: 17.385,
    longitude: 78.4867,
    locationAddress: 'Hyderabad, Telangana',
    portfolioPhotoUrls: [],
    verificationStatus: 'pending_verification',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('WorkersService.createProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects if the account already has a worker profile', async () => {
    const repo = createMockRepository();
    repo.findByAccountId.mockResolvedValue(buildProfile());
    const service = new WorkersService(repo as unknown as WorkersRepository);

    await expect(
      service.createProfile('account-1', { skillCategories: ['electrician'], experienceYears: 3 }, []),
    ).rejects.toMatchObject({ statusCode: 409, code: 'WORKER_PROFILE_EXISTS' });

    expect(repo.create).not.toHaveBeenCalled();
  });

  it('uploads each portfolio photo to Cloudinary and stores the resulting URLs', async () => {
    const repo = createMockRepository();
    repo.findByAccountId.mockResolvedValue(null);
    repo.create.mockResolvedValue(buildProfile({ portfolioPhotoUrls: ['https://cdn/a.jpg', 'https://cdn/b.jpg'] }));
    uploadToCloudinary
      .mockResolvedValueOnce({ url: 'https://cdn/a.jpg', publicId: 'a' })
      .mockResolvedValueOnce({ url: 'https://cdn/b.jpg', publicId: 'b' });

    const service = new WorkersService(repo as unknown as WorkersRepository);
    const files = [{ path: '/tmp/a.jpg' }, { path: '/tmp/b.jpg' }] as Express.Multer.File[];

    await service.createProfile(
      'account-1',
      { skillCategories: ['plumber'], experienceYears: 5, locationAddress: 'Hyderabad' },
      files,
    );

    expect(uploadToCloudinary).toHaveBeenCalledTimes(2);
    expect(uploadToCloudinary).toHaveBeenCalledWith('/tmp/a.jpg', 'triolo/workers/portfolio');
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'account-1',
        skillCategories: ['plumber'],
        experienceYears: 5,
        locationAddress: 'Hyderabad',
        portfolioPhotoUrls: ['https://cdn/a.jpg', 'https://cdn/b.jpg'],
      }),
    );
  });

  it('creates a profile with no photos when none are provided', async () => {
    const repo = createMockRepository();
    repo.findByAccountId.mockResolvedValue(null);
    repo.create.mockResolvedValue(buildProfile({ portfolioPhotoUrls: [] }));

    const service = new WorkersService(repo as unknown as WorkersRepository);
    await service.createProfile('account-1', { skillCategories: ['mason'], experienceYears: 0 }, []);

    expect(uploadToCloudinary).not.toHaveBeenCalled();
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ portfolioPhotoUrls: [] }));
  });

  it('stores the "other" skill description when "other" is among the selected skills', async () => {
    const repo = createMockRepository();
    repo.findByAccountId.mockResolvedValue(null);
    repo.create.mockResolvedValue(buildProfile({ skillCategories: ['other'], otherSkillDescription: 'Roofing' }));

    const service = new WorkersService(repo as unknown as WorkersRepository);
    await service.createProfile(
      'account-1',
      { skillCategories: ['electrician', 'other'], otherSkillDescription: 'Roofing', experienceYears: 2 },
      [],
    );

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ skillCategories: ['electrician', 'other'], otherSkillDescription: 'Roofing' }),
    );
  });
});

describe('WorkersService.getMyProfile', () => {
  it('returns null when no profile exists', async () => {
    const repo = createMockRepository();
    repo.findByAccountId.mockResolvedValue(null);
    const service = new WorkersService(repo as unknown as WorkersRepository);

    await expect(service.getMyProfile('account-1')).resolves.toBeNull();
  });

  it('returns the profile when one exists', async () => {
    const repo = createMockRepository();
    repo.findByAccountId.mockResolvedValue(buildProfile());
    const service = new WorkersService(repo as unknown as WorkersRepository);

    await expect(service.getMyProfile('account-1')).resolves.toMatchObject({ id: 'worker-1' });
  });
});

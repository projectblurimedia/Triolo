import { WorkersService } from './service';
import { WorkersRepository } from './repository';
import { WorkerProfile } from './interfaces';
import * as cloudinaryService from '@/common/services/cloudinaryService';

jest.mock('@/common/services/cloudinaryService', () => ({
  uploadToCloudinary: jest.fn(),
  deletePhotosFromCloudinary: jest.fn(),
}));

const uploadToCloudinary = jest.mocked(cloudinaryService.uploadToCloudinary);
const deletePhotosFromCloudinary = jest.mocked(cloudinaryService.deletePhotosFromCloudinary);

type MockRepository = {
  [K in keyof WorkersRepository]: jest.Mock;
};

function createMockRepository(): MockRepository {
  return {
    findByAccountId: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    updateVerificationStatus: jest.fn(),
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
    area: 'Ameerpet',
    city: 'Hyderabad',
    district: 'Hyderabad',
    state: 'Telangana',
    pincode: '500016',
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
      service.createProfile(
        'account-1',
        { skillCategories: ['electrician'], experienceYears: 3, city: 'Hyderabad', district: 'Hyderabad', state: 'Telangana', pincode: '500016' },
        [],
      ),
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
      {
        skillCategories: ['plumber'],
        experienceYears: 5,
        city: 'Hyderabad',
        district: 'Hyderabad',
        state: 'Telangana',
        pincode: '500016',
      },
      files,
    );

    expect(uploadToCloudinary).toHaveBeenCalledTimes(2);
    expect(uploadToCloudinary).toHaveBeenCalledWith('/tmp/a.jpg', 'triolo/workers/portfolio');
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'account-1',
        skillCategories: ['plumber'],
        experienceYears: 5,
        city: 'Hyderabad',
        district: 'Hyderabad',
        state: 'Telangana',
        pincode: '500016',
        portfolioPhotoUrls: ['https://cdn/a.jpg', 'https://cdn/b.jpg'],
      }),
    );
  });

  it('creates a profile with no photos when none are provided', async () => {
    const repo = createMockRepository();
    repo.findByAccountId.mockResolvedValue(null);
    repo.create.mockResolvedValue(buildProfile({ portfolioPhotoUrls: [] }));

    const service = new WorkersService(repo as unknown as WorkersRepository);
    await service.createProfile(
      'account-1',
      { skillCategories: ['mason'], experienceYears: 0, city: 'Hyderabad', district: 'Hyderabad', state: 'Telangana', pincode: '500016' },
      [],
    );

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
      {
        skillCategories: ['electrician', 'other'],
        otherSkillDescription: 'Roofing',
        experienceYears: 2,
        city: 'Hyderabad',
        district: 'Hyderabad',
        state: 'Telangana',
        pincode: '500016',
      },
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

describe('WorkersService.updateProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects if no profile exists yet', async () => {
    const repo = createMockRepository();
    repo.findByAccountId.mockResolvedValue(null);
    const service = new WorkersService(repo as unknown as WorkersRepository);

    await expect(
      service.updateProfile(
        'account-1',
        { skillCategories: ['plumber'], experienceYears: 4, city: 'Hyderabad', district: 'Hyderabad', state: 'Telangana', pincode: '500016' },
        [],
      ),
    ).rejects.toMatchObject({ statusCode: 404, code: 'WORKER_PROFILE_NOT_FOUND' });

    expect(repo.update).not.toHaveBeenCalled();
  });

  it('keeps the existing verification status and keeps existing photos when none are removed', async () => {
    const repo = createMockRepository();
    repo.findByAccountId.mockResolvedValue(
      buildProfile({ portfolioPhotoUrls: ['https://cdn/a.jpg'], verificationStatus: 'verified' }),
    );
    repo.update.mockResolvedValue(buildProfile({ skillCategories: ['plumber'], experienceYears: 4 }));

    const service = new WorkersService(repo as unknown as WorkersRepository);
    await service.updateProfile(
      'account-1',
      { skillCategories: ['plumber'], experienceYears: 4, city: 'Hyderabad', district: 'Hyderabad', state: 'Telangana', pincode: '500016' },
      [],
    );

    expect(repo.update).toHaveBeenCalledWith(
      'account-1',
      expect.objectContaining({
        skillCategories: ['plumber'],
        experienceYears: 4,
        portfolioPhotoUrls: ['https://cdn/a.jpg'],
        verificationStatus: 'verified',
      }),
    );
  });

  it('appends newly uploaded photos to the kept existing ones, capped at 6', async () => {
    const repo = createMockRepository();
    repo.findByAccountId.mockResolvedValue(buildProfile({ portfolioPhotoUrls: ['https://cdn/a.jpg'] }));
    repo.update.mockResolvedValue(buildProfile());
    uploadToCloudinary.mockResolvedValueOnce({ url: 'https://cdn/new.jpg', publicId: 'new' });

    const service = new WorkersService(repo as unknown as WorkersRepository);
    const files = [{ path: '/tmp/new.jpg' }] as Express.Multer.File[];

    await service.updateProfile(
      'account-1',
      {
        skillCategories: ['mason'],
        experienceYears: 2,
        city: 'Hyderabad',
        district: 'Hyderabad',
        state: 'Telangana',
        pincode: '500016',
        existingPhotoUrls: ['https://cdn/a.jpg'],
      },
      files,
    );

    expect(repo.update).toHaveBeenCalledWith(
      'account-1',
      expect.objectContaining({ portfolioPhotoUrls: ['https://cdn/a.jpg', 'https://cdn/new.jpg'] }),
    );
  });

  it('deletes dropped photos from Cloudinary when they are no longer kept', async () => {
    const repo = createMockRepository();
    repo.findByAccountId.mockResolvedValue(
      buildProfile({ portfolioPhotoUrls: ['https://cdn/a.jpg', 'https://cdn/b.jpg'] }),
    );
    repo.update.mockResolvedValue(buildProfile({ portfolioPhotoUrls: ['https://cdn/a.jpg'] }));

    const service = new WorkersService(repo as unknown as WorkersRepository);
    await service.updateProfile(
      'account-1',
      {
        skillCategories: ['mason'],
        experienceYears: 2,
        city: 'Hyderabad',
        district: 'Hyderabad',
        state: 'Telangana',
        pincode: '500016',
        existingPhotoUrls: ['https://cdn/a.jpg'],
      },
      [],
    );

    expect(deletePhotosFromCloudinary).toHaveBeenCalledWith(['https://cdn/b.jpg']);
  });

  it('does not attempt to delete anything from Cloudinary when no photos are dropped', async () => {
    const repo = createMockRepository();
    repo.findByAccountId.mockResolvedValue(buildProfile({ portfolioPhotoUrls: ['https://cdn/a.jpg'] }));
    repo.update.mockResolvedValue(buildProfile({ portfolioPhotoUrls: ['https://cdn/a.jpg'] }));

    const service = new WorkersService(repo as unknown as WorkersRepository);
    await service.updateProfile(
      'account-1',
      { skillCategories: ['mason'], experienceYears: 2, city: 'Hyderabad', district: 'Hyderabad', state: 'Telangana', pincode: '500016' },
      [],
    );

    expect(deletePhotosFromCloudinary).toHaveBeenCalledWith([]);
  });
});

describe('WorkersService.deleteProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects if no profile exists yet', async () => {
    const repo = createMockRepository();
    repo.findByAccountId.mockResolvedValue(null);
    const service = new WorkersService(repo as unknown as WorkersRepository);

    await expect(service.deleteProfile('account-1')).rejects.toMatchObject({
      statusCode: 404,
      code: 'WORKER_PROFILE_NOT_FOUND',
    });
    expect(repo.remove).not.toHaveBeenCalled();
  });

  it('removes the profile when one exists', async () => {
    const repo = createMockRepository();
    repo.findByAccountId.mockResolvedValue(buildProfile());
    const service = new WorkersService(repo as unknown as WorkersRepository);

    await service.deleteProfile('account-1');
    expect(repo.remove).toHaveBeenCalledWith('account-1');
  });

  it('deletes all portfolio photos from Cloudinary when the profile is deleted', async () => {
    const repo = createMockRepository();
    repo.findByAccountId.mockResolvedValue(
      buildProfile({ portfolioPhotoUrls: ['https://cdn/a.jpg', 'https://cdn/b.jpg'] }),
    );
    const service = new WorkersService(repo as unknown as WorkersRepository);

    await service.deleteProfile('account-1');
    expect(deletePhotosFromCloudinary).toHaveBeenCalledWith(['https://cdn/a.jpg', 'https://cdn/b.jpg']);
  });
});

describe('WorkersService admin-facing methods', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('adminListProfiles passes the filter straight through to the repository', async () => {
    const repo = createMockRepository();
    const result = { items: [], total: 0, page: 1, limit: 20 };
    repo.findAll.mockResolvedValue(result);
    const service = new WorkersService(repo as unknown as WorkersRepository);

    await expect(service.adminListProfiles({ status: 'pending_verification', page: 1, limit: 20 })).resolves.toBe(
      result,
    );
    expect(repo.findAll).toHaveBeenCalledWith({ status: 'pending_verification', page: 1, limit: 20 });
  });

  it('adminGetProfile throws 404 when no profile exists for that id', async () => {
    const repo = createMockRepository();
    repo.findById.mockResolvedValue(null);
    const service = new WorkersService(repo as unknown as WorkersRepository);

    await expect(service.adminGetProfile('missing-id')).rejects.toMatchObject({
      statusCode: 404,
      code: 'WORKER_PROFILE_NOT_FOUND',
    });
  });

  it('adminGetProfile returns the profile when found', async () => {
    const repo = createMockRepository();
    const withAccount = { ...buildProfile(), accountFullName: 'Asha', accountMobileNumber: '9999999999', accountEmail: 'asha@example.com' };
    repo.findById.mockResolvedValue(withAccount);
    const service = new WorkersService(repo as unknown as WorkersRepository);

    await expect(service.adminGetProfile('worker-1')).resolves.toBe(withAccount);
  });

  it('adminSetVerificationStatus throws 404 when no profile exists for that id', async () => {
    const repo = createMockRepository();
    repo.updateVerificationStatus.mockResolvedValue(null);
    const service = new WorkersService(repo as unknown as WorkersRepository);

    await expect(service.adminSetVerificationStatus('missing-id', 'verified')).rejects.toMatchObject({
      statusCode: 404,
      code: 'WORKER_PROFILE_NOT_FOUND',
    });
  });

  it('adminSetVerificationStatus updates and returns the profile', async () => {
    const repo = createMockRepository();
    repo.updateVerificationStatus.mockResolvedValue(buildProfile({ verificationStatus: 'verified' }));
    const service = new WorkersService(repo as unknown as WorkersRepository);

    await expect(service.adminSetVerificationStatus('worker-1', 'verified')).resolves.toMatchObject({
      verificationStatus: 'verified',
    });
    expect(repo.updateVerificationStatus).toHaveBeenCalledWith('worker-1', 'verified');
  });
});

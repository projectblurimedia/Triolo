import { BusinessesService } from './service';
import { BusinessesRepository } from './repository';
import { BusinessProfile } from './interfaces';
import * as cloudinaryService from '@/common/services/cloudinaryService';

jest.mock('@/common/services/cloudinaryService', () => ({
  uploadToCloudinary: jest.fn(),
}));

const uploadToCloudinary = jest.mocked(cloudinaryService.uploadToCloudinary);

type MockRepository = {
  [K in keyof BusinessesRepository]: jest.Mock;
};

function createMockRepository(): MockRepository {
  return {
    findByAccountId: jest.fn(),
    create: jest.fn(),
  } as unknown as MockRepository;
}

function buildProfile(overrides: Partial<BusinessProfile> = {}): BusinessProfile {
  return {
    id: 'business-1',
    accountId: 'account-1',
    shopName: 'Test Shop',
    shopCategory: 'grocery',
    latitude: 17.385,
    longitude: 78.4867,
    locationAddress: 'Hyderabad, Telangana',
    shopPhotoUrls: [],
    verificationStatus: 'pending_verification',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('BusinessesService.createProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects if the account already has a business profile', async () => {
    const repo = createMockRepository();
    repo.findByAccountId.mockResolvedValue(buildProfile());
    const service = new BusinessesService(repo as unknown as BusinessesRepository);

    await expect(
      service.createProfile('account-1', { shopName: 'Shop', shopCategory: 'grocery' }, []),
    ).rejects.toMatchObject({ statusCode: 409, code: 'BUSINESS_PROFILE_EXISTS' });

    expect(repo.create).not.toHaveBeenCalled();
  });

  it('uploads each shop photo to Cloudinary and stores the resulting URLs', async () => {
    const repo = createMockRepository();
    repo.findByAccountId.mockResolvedValue(null);
    repo.create.mockResolvedValue(buildProfile({ shopPhotoUrls: ['https://cdn/a.jpg'] }));
    uploadToCloudinary.mockResolvedValueOnce({ url: 'https://cdn/a.jpg', publicId: 'a' });

    const service = new BusinessesService(repo as unknown as BusinessesRepository);
    const files = [{ path: '/tmp/a.jpg' }] as Express.Multer.File[];

    await service.createProfile(
      'account-1',
      { shopName: 'My Shop', shopCategory: 'restaurant', locationAddress: 'Hyderabad' },
      files,
    );

    expect(uploadToCloudinary).toHaveBeenCalledWith('/tmp/a.jpg', 'triolo/businesses/shop-photos');
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'account-1',
        shopName: 'My Shop',
        shopCategory: 'restaurant',
        locationAddress: 'Hyderabad',
        shopPhotoUrls: ['https://cdn/a.jpg'],
      }),
    );
  });

  it('creates a profile with no photos when none are provided', async () => {
    const repo = createMockRepository();
    repo.findByAccountId.mockResolvedValue(null);
    repo.create.mockResolvedValue(buildProfile({ shopPhotoUrls: [] }));

    const service = new BusinessesService(repo as unknown as BusinessesRepository);
    await service.createProfile('account-1', { shopName: 'Shop', shopCategory: 'other' }, []);

    expect(uploadToCloudinary).not.toHaveBeenCalled();
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ shopPhotoUrls: [] }));
  });
});

describe('BusinessesService.getMyProfile', () => {
  it('returns null when no profile exists', async () => {
    const repo = createMockRepository();
    repo.findByAccountId.mockResolvedValue(null);
    const service = new BusinessesService(repo as unknown as BusinessesRepository);

    await expect(service.getMyProfile('account-1')).resolves.toBeNull();
  });
});

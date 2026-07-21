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
    update: jest.fn(),
    remove: jest.fn(),
  } as unknown as MockRepository;
}

function buildProfile(overrides: Partial<BusinessProfile> = {}): BusinessProfile {
  return {
    id: 'business-1',
    accountId: 'account-1',
    shopName: 'Test Shop',
    shopCategories: ['grocery'],
    otherCategoryDescription: null,
    latitude: 17.385,
    longitude: 78.4867,
    locationAddress: 'Hyderabad, Telangana',
    shopPhotoUrls: [],
    deliveryAvailable: false,
    deliveryPricePerKm: null,
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
      service.createProfile(
        'account-1',
        { shopName: 'Shop', shopCategories: ['grocery'], deliveryAvailable: false },
        [],
      ),
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
      {
        shopName: 'My Shop',
        shopCategories: ['restaurant'],
        locationAddress: 'Hyderabad',
        deliveryAvailable: false,
      },
      files,
    );

    expect(uploadToCloudinary).toHaveBeenCalledWith('/tmp/a.jpg', 'triolo/businesses/shop-photos');
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'account-1',
        shopName: 'My Shop',
        shopCategories: ['restaurant'],
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
    await service.createProfile(
      'account-1',
      { shopName: 'Shop', shopCategories: ['other'], deliveryAvailable: false },
      [],
    );

    expect(uploadToCloudinary).not.toHaveBeenCalled();
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ shopPhotoUrls: [] }));
  });

  it('stores the delivery price when delivery is available', async () => {
    const repo = createMockRepository();
    repo.findByAccountId.mockResolvedValue(null);
    repo.create.mockResolvedValue(buildProfile({ deliveryAvailable: true, deliveryPricePerKm: 10 }));

    const service = new BusinessesService(repo as unknown as BusinessesRepository);
    await service.createProfile(
      'account-1',
      { shopName: 'Shop', shopCategories: ['grocery'], deliveryAvailable: true, deliveryPricePerKm: 10 },
      [],
    );

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryAvailable: true, deliveryPricePerKm: 10 }),
    );
  });

  it('ignores a submitted delivery price when delivery is not available', async () => {
    const repo = createMockRepository();
    repo.findByAccountId.mockResolvedValue(null);
    repo.create.mockResolvedValue(buildProfile({ deliveryAvailable: false, deliveryPricePerKm: null }));

    const service = new BusinessesService(repo as unknown as BusinessesRepository);
    await service.createProfile(
      'account-1',
      { shopName: 'Shop', shopCategories: ['grocery'], deliveryAvailable: false, deliveryPricePerKm: 10 },
      [],
    );

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryAvailable: false, deliveryPricePerKm: null }),
    );
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

describe('BusinessesService.updateProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects if no profile exists yet', async () => {
    const repo = createMockRepository();
    repo.findByAccountId.mockResolvedValue(null);
    const service = new BusinessesService(repo as unknown as BusinessesRepository);

    await expect(
      service.updateProfile('account-1', { shopName: 'Shop', shopCategories: ['grocery'], deliveryAvailable: false }, []),
    ).rejects.toMatchObject({ statusCode: 404, code: 'BUSINESS_PROFILE_NOT_FOUND' });

    expect(repo.update).not.toHaveBeenCalled();
  });

  it('resets verification status to pending and keeps existing photos when none are removed', async () => {
    const repo = createMockRepository();
    repo.findByAccountId.mockResolvedValue(
      buildProfile({ shopPhotoUrls: ['https://cdn/a.jpg'], verificationStatus: 'verified' }),
    );
    repo.update.mockResolvedValue(buildProfile({ shopName: 'New Name' }));

    const service = new BusinessesService(repo as unknown as BusinessesRepository);
    await service.updateProfile(
      'account-1',
      { shopName: 'New Name', shopCategories: ['restaurant'], deliveryAvailable: false },
      [],
    );

    expect(repo.update).toHaveBeenCalledWith(
      'account-1',
      expect.objectContaining({
        shopName: 'New Name',
        shopCategories: ['restaurant'],
        shopPhotoUrls: ['https://cdn/a.jpg'],
        verificationStatus: 'pending_verification',
      }),
    );
  });

  it('appends newly uploaded photos to the kept existing ones, capped at 6', async () => {
    const repo = createMockRepository();
    repo.findByAccountId.mockResolvedValue(buildProfile({ shopPhotoUrls: ['https://cdn/a.jpg'] }));
    repo.update.mockResolvedValue(buildProfile());
    uploadToCloudinary.mockResolvedValueOnce({ url: 'https://cdn/new.jpg', publicId: 'new' });

    const service = new BusinessesService(repo as unknown as BusinessesRepository);
    const files = [{ path: '/tmp/new.jpg' }] as Express.Multer.File[];

    await service.updateProfile(
      'account-1',
      {
        shopName: 'Shop',
        shopCategories: ['grocery'],
        deliveryAvailable: false,
        existingPhotoUrls: ['https://cdn/a.jpg'],
      },
      files,
    );

    expect(repo.update).toHaveBeenCalledWith(
      'account-1',
      expect.objectContaining({ shopPhotoUrls: ['https://cdn/a.jpg', 'https://cdn/new.jpg'] }),
    );
  });
});

describe('BusinessesService.deleteProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects if no profile exists yet', async () => {
    const repo = createMockRepository();
    repo.findByAccountId.mockResolvedValue(null);
    const service = new BusinessesService(repo as unknown as BusinessesRepository);

    await expect(service.deleteProfile('account-1')).rejects.toMatchObject({
      statusCode: 404,
      code: 'BUSINESS_PROFILE_NOT_FOUND',
    });
    expect(repo.remove).not.toHaveBeenCalled();
  });

  it('removes the profile when one exists', async () => {
    const repo = createMockRepository();
    repo.findByAccountId.mockResolvedValue(buildProfile());
    const service = new BusinessesService(repo as unknown as BusinessesRepository);

    await service.deleteProfile('account-1');
    expect(repo.remove).toHaveBeenCalledWith('account-1');
  });
});

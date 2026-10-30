import { BusinessesService } from './service';
import { BusinessesRepository } from './repository';
import { BusinessProfile } from './interfaces';
import { NotificationsService } from '@/modules/notifications/service';
import * as cloudinaryService from '@/common/services/cloudinaryService';

jest.mock('@/common/services/cloudinaryService', () => ({
  uploadToCloudinary: jest.fn(),
  deletePhotosFromCloudinary: jest.fn(),
}));

const uploadToCloudinary = jest.mocked(cloudinaryService.uploadToCloudinary);
const deletePhotosFromCloudinary = jest.mocked(cloudinaryService.deletePhotosFromCloudinary);

type MockRepository = {
  [K in keyof BusinessesRepository]: jest.Mock;
};

function createMockRepository(): MockRepository {
  return {
    findByAccountId: jest.fn(),
    listByAccountId: jest.fn().mockResolvedValue([]),
    countByAccountId: jest.fn().mockResolvedValue(0),
    listStaff: jest.fn().mockResolvedValue([]),
    countStaff: jest.fn().mockResolvedValue(0),
    addStaff: jest.fn(),
    removeStaff: jest.fn().mockResolvedValue(true),
    isStaff: jest.fn().mockResolvedValue(true),
    hasStaffRow: jest.fn().mockResolvedValue(false),
    listInvites: jest.fn().mockResolvedValue([]),
    answerInvite: jest.fn().mockResolvedValue(true),
    staffShops: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    updateVerificationStatus: jest.fn(),
    findNearby: jest.fn(),
  } as unknown as MockRepository;
}

function createMockNotificationsService(): jest.Mocked<NotificationsService> {
  return { notifyProfileViewed: jest.fn(), notify: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<NotificationsService>;
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
    area: 'Ameerpet',
    city: 'Hyderabad',
    district: 'Hyderabad',
    state: 'Telangana',
    pincode: '500016',
    locationName: 'Ameerpet',
    profilePhotoUrl: null,
    deliveryMinCharge: null,
    shopPhotoUrls: [],
    deliveryAvailable: false,
    deliveryPricePerKm: null,
    verificationStatus: 'pending_verification',
    ratingAverage: null,
    ratingCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('BusinessesService.createProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a sixth shop (a partner may own up to five)', async () => {
    const repo = createMockRepository();
    repo.countByAccountId.mockResolvedValue(5);
    const service = new BusinessesService(repo as unknown as BusinessesRepository, createMockNotificationsService());

    await expect(
      service.createProfile(
        'account-1',
        {
          shopName: 'Shop',
          shopCategories: ['grocery'],
          deliveryAvailable: false,
          latitude: 17.385,
          longitude: 78.4867,
          locationName: 'Ameerpet',
          city: 'Hyderabad',
          district: 'Hyderabad',
          state: 'Telangana',
          pincode: '500016',
        },
        [],
      ),
    ).rejects.toMatchObject({ statusCode: 409, code: 'SHOP_LIMIT' });

    expect(repo.create).not.toHaveBeenCalled();
  });

  it('uploads each shop photo to Cloudinary and stores the resulting URLs', async () => {
    const repo = createMockRepository();
    repo.findByAccountId.mockResolvedValue(null);
    repo.create.mockResolvedValue(buildProfile({ shopPhotoUrls: ['https://cdn/a.jpg'] }));
    uploadToCloudinary.mockResolvedValueOnce({ url: 'https://cdn/a.jpg', publicId: 'a' });

    const service = new BusinessesService(repo as unknown as BusinessesRepository, createMockNotificationsService());
    const files = [{ path: '/tmp/a.jpg' }] as Express.Multer.File[];

    await service.createProfile(
      'account-1',
      {
        shopName: 'My Shop',
        shopCategories: ['restaurant'],
        latitude: 17.385,
        longitude: 78.4867,
        locationName: 'Ameerpet',
        city: 'Hyderabad',
        district: 'Hyderabad',
        state: 'Telangana',
        pincode: '500016',
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
        city: 'Hyderabad',
        district: 'Hyderabad',
        state: 'Telangana',
        pincode: '500016',
        shopPhotoUrls: ['https://cdn/a.jpg'],
      }),
    );
  });

  it('creates a profile with no photos when none are provided', async () => {
    const repo = createMockRepository();
    repo.findByAccountId.mockResolvedValue(null);
    repo.create.mockResolvedValue(buildProfile({ shopPhotoUrls: [] }));

    const service = new BusinessesService(repo as unknown as BusinessesRepository, createMockNotificationsService());
    await service.createProfile(
      'account-1',
      {
        shopName: 'Shop',
        shopCategories: ['other'],
        deliveryAvailable: false,
        latitude: 17.385,
        longitude: 78.4867,
        locationName: 'Ameerpet',
        city: 'Hyderabad',
        district: 'Hyderabad',
        state: 'Telangana',
        pincode: '500016',
      },
      [],
    );

    expect(uploadToCloudinary).not.toHaveBeenCalled();
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ shopPhotoUrls: [] }));
  });

  it('stores the delivery price when delivery is available', async () => {
    const repo = createMockRepository();
    repo.findByAccountId.mockResolvedValue(null);
    repo.create.mockResolvedValue(buildProfile({ deliveryAvailable: true, deliveryPricePerKm: 10 }));

    const service = new BusinessesService(repo as unknown as BusinessesRepository, createMockNotificationsService());
    await service.createProfile(
      'account-1',
      {
        shopName: 'Shop',
        shopCategories: ['grocery'],
        deliveryAvailable: true,
        deliveryPricePerKm: 10,
        latitude: 17.385,
        longitude: 78.4867,
        locationName: 'Ameerpet',
        city: 'Hyderabad',
        district: 'Hyderabad',
        state: 'Telangana',
        pincode: '500016',
      },
      [],
    );

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ deliveryAvailable: true, deliveryPricePerKm: 10 }));
  });

  it('ignores a submitted delivery price when delivery is not available', async () => {
    const repo = createMockRepository();
    repo.findByAccountId.mockResolvedValue(null);
    repo.create.mockResolvedValue(buildProfile({ deliveryAvailable: false, deliveryPricePerKm: null }));

    const service = new BusinessesService(repo as unknown as BusinessesRepository, createMockNotificationsService());
    await service.createProfile(
      'account-1',
      {
        shopName: 'Shop',
        shopCategories: ['grocery'],
        deliveryAvailable: false,
        deliveryPricePerKm: 10,
        latitude: 17.385,
        longitude: 78.4867,
        locationName: 'Ameerpet',
        city: 'Hyderabad',
        district: 'Hyderabad',
        state: 'Telangana',
        pincode: '500016',
      },
      [],
    );

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ deliveryAvailable: false, deliveryPricePerKm: null }));
  });
});

describe('BusinessesService.getMyProfile', () => {
  it('returns null when no profile exists', async () => {
    const repo = createMockRepository();
    repo.findByAccountId.mockResolvedValue(null);
    const service = new BusinessesService(repo as unknown as BusinessesRepository, createMockNotificationsService());

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
    const service = new BusinessesService(repo as unknown as BusinessesRepository, createMockNotificationsService());

    await expect(
      service.updateProfile(
        'account-1',
        {
          shopName: 'Shop',
          shopCategories: ['grocery'],
          deliveryAvailable: false,
          latitude: 17.385,
          longitude: 78.4867,
          locationName: 'Ameerpet',
          city: 'Hyderabad',
          district: 'Hyderabad',
          state: 'Telangana',
          pincode: '500016',
        },
        [],
      ),
    ).rejects.toMatchObject({ statusCode: 404, code: 'BUSINESS_PROFILE_NOT_FOUND' });

    expect(repo.update).not.toHaveBeenCalled();
  });

  it('keeps the existing verification status and keeps existing photos when none are removed', async () => {
    const repo = createMockRepository();
    repo.findByAccountId.mockResolvedValue(
      buildProfile({ shopPhotoUrls: ['https://cdn/a.jpg'], verificationStatus: 'verified' }),
    );
    repo.update.mockResolvedValue(buildProfile({ shopName: 'New Name' }));

    const service = new BusinessesService(repo as unknown as BusinessesRepository, createMockNotificationsService());
    await service.updateProfile(
      'account-1',
      {
        shopName: 'New Name',
        shopCategories: ['restaurant'],
        deliveryAvailable: false,
        latitude: 17.385,
        longitude: 78.4867,
        locationName: 'Ameerpet',
        city: 'Hyderabad',
        district: 'Hyderabad',
        state: 'Telangana',
        pincode: '500016',
      },
      [],
    );

    expect(repo.update).toHaveBeenCalledWith(
      'account-1',
      'business-1',
      expect.objectContaining({
        shopName: 'New Name',
        shopCategories: ['restaurant'],
        shopPhotoUrls: ['https://cdn/a.jpg'],
        verificationStatus: 'verified',
      }),
    );
  });

  it('appends newly uploaded photos to the kept existing ones, capped at 6', async () => {
    const repo = createMockRepository();
    repo.findByAccountId.mockResolvedValue(buildProfile({ shopPhotoUrls: ['https://cdn/a.jpg'] }));
    repo.update.mockResolvedValue(buildProfile());
    uploadToCloudinary.mockResolvedValueOnce({ url: 'https://cdn/new.jpg', publicId: 'new' });

    const service = new BusinessesService(repo as unknown as BusinessesRepository, createMockNotificationsService());
    const files = [{ path: '/tmp/new.jpg' }] as Express.Multer.File[];

    await service.updateProfile(
      'account-1',
      {
        shopName: 'Shop',
        shopCategories: ['grocery'],
        deliveryAvailable: false,
        latitude: 17.385,
        longitude: 78.4867,
        locationName: 'Ameerpet',
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
      'business-1',
      expect.objectContaining({ shopPhotoUrls: ['https://cdn/a.jpg', 'https://cdn/new.jpg'] }),
    );
  });

  it('deletes dropped photos from Cloudinary when they are no longer kept', async () => {
    const repo = createMockRepository();
    repo.findByAccountId.mockResolvedValue(buildProfile({ shopPhotoUrls: ['https://cdn/a.jpg', 'https://cdn/b.jpg'] }));
    repo.update.mockResolvedValue(buildProfile({ shopPhotoUrls: ['https://cdn/a.jpg'] }));

    const service = new BusinessesService(repo as unknown as BusinessesRepository, createMockNotificationsService());
    await service.updateProfile(
      'account-1',
      {
        shopName: 'Shop',
        shopCategories: ['grocery'],
        deliveryAvailable: false,
        latitude: 17.385,
        longitude: 78.4867,
        locationName: 'Ameerpet',
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
});

describe('BusinessesService.deleteProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects if no profile exists yet', async () => {
    const repo = createMockRepository();
    repo.findByAccountId.mockResolvedValue(null);
    const service = new BusinessesService(repo as unknown as BusinessesRepository, createMockNotificationsService());

    await expect(service.deleteProfile('account-1')).rejects.toMatchObject({
      statusCode: 404,
      code: 'BUSINESS_PROFILE_NOT_FOUND',
    });
    expect(repo.remove).not.toHaveBeenCalled();
  });

  it('removes the profile when one exists', async () => {
    const repo = createMockRepository();
    repo.findByAccountId.mockResolvedValue(buildProfile());
    const service = new BusinessesService(repo as unknown as BusinessesRepository, createMockNotificationsService());

    await service.deleteProfile('account-1');
    expect(repo.remove).toHaveBeenCalledWith('account-1', 'business-1');
  });

  it('deletes all shop photos from Cloudinary when the profile is deleted', async () => {
    const repo = createMockRepository();
    repo.findByAccountId.mockResolvedValue(buildProfile({ shopPhotoUrls: ['https://cdn/a.jpg', 'https://cdn/b.jpg'] }));
    const service = new BusinessesService(repo as unknown as BusinessesRepository, createMockNotificationsService());

    await service.deleteProfile('account-1');
    expect(deletePhotosFromCloudinary).toHaveBeenCalledWith(['https://cdn/a.jpg', 'https://cdn/b.jpg']);
  });
});

describe('BusinessesService.searchNearby', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes the searching account id and filter straight through to the repository', async () => {
    const repo = createMockRepository();
    const results = [{ ...buildProfile(), distanceMeters: 850 }];
    repo.findNearby.mockResolvedValue(results);
    const service = new BusinessesService(repo as unknown as BusinessesRepository, createMockNotificationsService());

    const filter = { latitude: 17.385, longitude: 78.4867, radiusKm: 10, limit: 20 };
    await expect(service.searchNearby('account-1', filter)).resolves.toBe(results);
    expect(repo.findNearby).toHaveBeenCalledWith('account-1', { ...filter, priorityAccountIds: [] });
  });
});

describe('BusinessesService.recordProfileView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws 404 when no profile exists for that id', async () => {
    const repo = createMockRepository();
    repo.findById.mockResolvedValue(null);
    const notifications = createMockNotificationsService();
    const service = new BusinessesService(repo as unknown as BusinessesRepository, notifications);

    await expect(service.recordProfileView('missing-id', 'viewer-1')).rejects.toMatchObject({
      statusCode: 404,
      code: 'BUSINESS_PROFILE_NOT_FOUND',
    });
    expect(notifications.notifyProfileViewed).not.toHaveBeenCalled();
  });

  it('notifies the profile owner, not the viewer', async () => {
    const repo = createMockRepository();
    repo.findById.mockResolvedValue({ ...buildProfile(), accountId: 'owner-1' });
    const notifications = createMockNotificationsService();
    const service = new BusinessesService(repo as unknown as BusinessesRepository, notifications);

    await service.recordProfileView('business-1', 'viewer-1');
    expect(notifications.notifyProfileViewed).toHaveBeenCalledWith('owner-1', 'viewer-1', 'shop');
  });
});

describe('BusinessesService admin-facing methods', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('adminListProfiles passes the filter straight through to the repository', async () => {
    const repo = createMockRepository();
    const result = { items: [], total: 0, page: 1, limit: 20 };
    repo.findAll.mockResolvedValue(result);
    const service = new BusinessesService(repo as unknown as BusinessesRepository, createMockNotificationsService());

    await expect(service.adminListProfiles({ status: 'pending_verification', page: 1, limit: 20 })).resolves.toBe(result);
    expect(repo.findAll).toHaveBeenCalledWith({ status: 'pending_verification', page: 1, limit: 20 });
  });

  it('adminGetProfile throws 404 when no profile exists for that id', async () => {
    const repo = createMockRepository();
    repo.findById.mockResolvedValue(null);
    const service = new BusinessesService(repo as unknown as BusinessesRepository, createMockNotificationsService());

    await expect(service.adminGetProfile('missing-id')).rejects.toMatchObject({
      statusCode: 404,
      code: 'BUSINESS_PROFILE_NOT_FOUND',
    });
  });

  it('adminGetProfile returns the profile when found', async () => {
    const repo = createMockRepository();
    const withAccount = {
      ...buildProfile(),
      accountFullName: 'Ravi',
      accountMobileNumber: '9999999999',
      accountEmail: 'ravi@example.com',
    };
    repo.findById.mockResolvedValue(withAccount);
    const service = new BusinessesService(repo as unknown as BusinessesRepository, createMockNotificationsService());

    await expect(service.adminGetProfile('business-1')).resolves.toBe(withAccount);
  });

  it('adminSetVerificationStatus throws 404 when no profile exists for that id', async () => {
    const repo = createMockRepository();
    repo.updateVerificationStatus.mockResolvedValue(null);
    const service = new BusinessesService(repo as unknown as BusinessesRepository, createMockNotificationsService());

    await expect(service.adminSetVerificationStatus('missing-id', 'rejected')).rejects.toMatchObject({
      statusCode: 404,
      code: 'BUSINESS_PROFILE_NOT_FOUND',
    });
  });

  it('adminSetVerificationStatus updates and returns the profile', async () => {
    const repo = createMockRepository();
    repo.updateVerificationStatus.mockResolvedValue(buildProfile({ verificationStatus: 'rejected' }));
    const service = new BusinessesService(repo as unknown as BusinessesRepository, createMockNotificationsService());

    await expect(service.adminSetVerificationStatus('business-1', 'rejected')).resolves.toMatchObject({
      verificationStatus: 'rejected',
    });
    expect(repo.updateVerificationStatus).toHaveBeenCalledWith('business-1', 'rejected');
  });
});

describe('BusinessesService delivery charges', () => {
  it('uses the 1-km price as the minimum when none is given', async () => {
    const repo = createMockRepository();
    repo.findByAccountId.mockResolvedValue(null);
    repo.create.mockResolvedValue(buildProfile());
    const service = new BusinessesService(repo as unknown as BusinessesRepository, createMockNotificationsService());

    await service.createProfile(
      'account-1',
      {
        shopName: 'Sri Lakshmi Stores',
        shopCategories: ['grocery'],
        deliveryAvailable: true,
        deliveryPricePerKm: 12,
        latitude: 16.7,
        longitude: 81.1,
        locationName: 'Kannapuram',
      },
      [],
    );

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ deliveryPricePerKm: 12, deliveryMinCharge: 12 }));
  });
});

describe('BusinessesService delivery staff', () => {
  it('adds staff by the typed name and phone (making their account), owner number allowed', async () => {
    const repo = createMockRepository();
    repo.findByAccountId.mockResolvedValue(buildProfile());
    const accounts = {
      findOrCreateByMobile: jest.fn().mockResolvedValue({ id: 'staff-1', fullName: 'Ravi' }),
      getAccount: jest.fn().mockResolvedValue({ preferredLanguage: 'en' }),
    };
    const service = new BusinessesService(repo as unknown as BusinessesRepository, createMockNotificationsService(), undefined, accounts);
    await service.addStaff('account-1', 'business-1', { fullName: 'Ravi', mobileNumber: '9700000003' });
    expect(repo.findByAccountId).toHaveBeenCalledWith('account-1', 'business-1');
    expect(accounts.findOrCreateByMobile).toHaveBeenCalledWith('9700000003', 'Ravi', 'en');
    // Invited first: they join in their Partner app.
    expect(repo.addStaff).toHaveBeenCalledWith('business-1', 'staff-1', 'Ravi', 'invited');

    // The owner's own number is allowed (the OTP comes to the owner); the typed name is kept.
    accounts.findOrCreateByMobile.mockResolvedValue({ id: 'account-1', fullName: 'Owner' });
    await service.addStaff('account-1', 'business-1', { fullName: 'Suresh', mobileNumber: '9700000001' });
    expect(repo.addStaff).toHaveBeenLastCalledWith('business-1', 'account-1', 'Suresh', 'active');
  });

  it('only the owner of the shop manages its staff', async () => {
    const repo = createMockRepository();
    repo.findByAccountId.mockResolvedValue(null);
    const service = new BusinessesService(repo as unknown as BusinessesRepository, createMockNotificationsService());
    await expect(service.listStaff('someone-else', 'business-1')).rejects.toMatchObject({ code: 'SHOP_NOT_FOUND' });
  });
});

describe('BusinessesService staff invitations', () => {
  it('lets the invited person join or decline, and 404s when there is no invitation', async () => {
    const repo = createMockRepository();
    const service = new BusinessesService(repo as unknown as BusinessesRepository, createMockNotificationsService());
    await service.answerInvite('staff-1', 'business-1', true);
    expect(repo.answerInvite).toHaveBeenCalledWith('staff-1', 'business-1', true);
    repo.answerInvite.mockResolvedValue(false);
    await expect(service.answerInvite('staff-1', 'business-1', false)).rejects.toMatchObject({ code: 'STAFF_INVITE_NOT_FOUND' });
  });
});

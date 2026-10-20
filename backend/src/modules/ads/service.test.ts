import { AdsService, placementOn } from './service';
import { AdsRepository } from './repository';
import { Ad, AdSettings, SaveAdParams } from './interfaces';
import {
  deleteCloudinaryIds,
  deletePhotosFromCloudinary,
  deleteVideosFromCloudinary,
  listCloudinaryFiles,
  videoDurationSeconds,
} from '@/common/services/cloudinaryService';

const OURS = 'https://res.cloudinary.com/demo/';
jest.mock('@/common/services/cloudinaryService', () => ({
  deletePhotosFromCloudinary: jest.fn(),
  deleteVideosFromCloudinary: jest.fn(),
  signDirectUpload: jest.fn(),
  videoDurationSeconds: jest.fn().mockResolvedValue(12),
  // The apps' phone-friendly URL; kept as-is here.
  playbackUrl: (url: string | null) => url,
  // …/upload/v1/triolo/ads/a.jpg → triolo/ads/a
  extractPublicIdFromUrl: (url: string) =>
    url
      .split('/upload/')[1]
      ?.replace(/^v\d+\//, '')
      .replace(/\.[a-z0-9]+$/, '') ?? null,
  listCloudinaryFiles: jest.fn().mockResolvedValue([]),
  deleteCloudinaryIds: jest.fn(),
  // Our own files: res.cloudinary.com/demo/<kind>/upload/…/triolo/ads/…
  isOwnCloudinaryUrl: (url: string, folder: string, kind: string) =>
    url.startsWith(`https://res.cloudinary.com/demo/${kind}/upload/`) && url.includes(`/${folder}/`),
}));

type MockRepository = { [K in keyof AdsRepository]: jest.Mock };

const SETTINGS: AdSettings = {
  adsEnabled: true,
  launchUser: true,
  launchPartner: false,
  actionUser: true,
  actionPartner: true,
  // Admin-set prices (not the old defaults), to prove they're used.
  prices: { '1': 25, '3': 60, '7': 120, '30': 350 },
  updatedAt: '2026-10-18T00:00:00.000Z',
};

const AD: Ad = {
  id: 'ad-1',
  billNumber: 7,
  advertiserName: 'Sri Sai Textiles',
  advertiserPhone: '9876543210',
  title: 'Diwali offer — 30% off',
  description: 'All sarees',
  imageUrl: `${OURS}image/upload/v1/triolo/ads/a.jpg`,
  imageUrls: [`${OURS}image/upload/v1/triolo/ads/a.jpg`],
  videoUrl: null,
  orientation: 'vertical',
  displaySeconds: 5,
  videoSeconds: null,
  durationSeconds: 5,
  contactPhone: '9876543210',
  locationText: 'Main Road, Eluru',
  linkUrl: null,
  actionType: 'none',
  destination: null,
  promoted: null,
  promoteMobile: null,
  latitude: 16.7,
  longitude: 81.1,
  radiusKm: 5,
  planDays: 3,
  amount: 50,
  paymentMethod: 'upi',
  startDate: '2026-10-18',
  endDate: '2026-10-20',
  ownerAccountId: null,
  reviewStatus: 'approved',
  reviewNote: null,
  reviewedAt: null,
  impressions: 0,
  clicks: 0,
  status: 'running',
  deletedAt: null,
  createdAt: '2026-10-18T00:00:00.000Z',
  updatedAt: '2026-10-18T00:00:00.000Z',
};

const PARAMS: SaveAdParams = {
  advertiserName: '  Sri Sai Textiles ',
  advertiserPhone: '',
  title: ' Diwali offer ',
  description: '   ',
  orientation: 'vertical',
  displaySeconds: 5,
  latitude: 16.7,
  longitude: 81.1,
  locationText: ' Eluru ',
  linkUrl: 'sritextiles.com',
  planDays: 7,
  paymentMethod: 'cash',
  startDate: '2026-10-18',
};

function makeService(promotions?: { accountIdByMobile: jest.Mock; find: jest.Mock; card: jest.Mock }) {
  const repository = {
    getSettings: jest.fn().mockResolvedValue(SETTINGS),
    updateSettings: jest.fn(),
    create: jest.fn().mockResolvedValue(AD),
    update: jest.fn().mockResolvedValue(AD),
    findById: jest.fn().mockResolvedValue(AD),
    setMedia: jest.fn(),
    findFinishedWithMedia: jest.fn().mockResolvedValue([]),
    clearMedia: jest.fn(),
    allMediaUrls: jest.fn().mockResolvedValue([]),
    softDelete: jest.fn().mockResolvedValue(AD),
    list: jest.fn(),
    summary: jest.fn(),
    pickAndCount: jest.fn().mockResolvedValue(AD),
    recordClick: jest.fn(),
    updateOwned: jest.fn(),
    listOwned: jest.fn().mockResolvedValue([]),
    countOpenOwned: jest.fn().mockResolvedValue(0),
    withdrawOwned: jest.fn(),
    review: jest.fn(),
  } as unknown as MockRepository;
  return { service: new AdsService(repository as unknown as AdsRepository, promotions), repository };
}

describe('placementOn', () => {
  it('needs the master switch', () => {
    expect(placementOn({ ...SETTINGS, adsEnabled: false }, 'user', 'action')).toBe(false);
  });

  it('checks each app and place separately', () => {
    expect(placementOn(SETTINGS, 'user', 'launch')).toBe(true);
    expect(placementOn(SETTINGS, 'partner', 'launch')).toBe(false);
    expect(placementOn(SETTINGS, 'partner', 'action')).toBe(true);
  });
});

describe('AdsService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('serves only what people see, passing on the last ad seen', async () => {
    const { service, repository } = makeService();
    const ad = await service.serve('user', 'action', { latitude: 16.7, longitude: 81.1 }, 'ad-0');
    expect(repository.pickAndCount).toHaveBeenCalledWith('ad-0', 16.7, 81.1);
    expect(ad).toEqual({
      id: 'ad-1',
      title: AD.title,
      description: AD.description,
      imageUrl: AD.imageUrl,
      imageUrls: AD.imageUrls,
      videoUrl: AD.videoUrl,
      orientation: 'vertical',
      durationSeconds: 5,
      advertiserName: AD.advertiserName,
      contactPhone: AD.advertiserPhone,
      locationText: AD.locationText,
      linkUrl: AD.linkUrl,
      actionType: 'none',
      destination: null,
      promoted: null,
      endDate: AD.endDate,
    });
    expect(ad).not.toHaveProperty('amount');
  });

  it('serves nothing (and counts nothing) where ads are switched off', async () => {
    const { service, repository } = makeService();
    expect(await service.serve('partner', 'launch', { latitude: 16.7, longitude: 81.1 }, null)).toBeNull();
    expect(repository.pickAndCount).not.toHaveBeenCalled();
  });

  it("books at the admin's current price and tidies the text", async () => {
    const { service, repository } = makeService();
    await service.create(PARAMS);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        advertiserName: 'Sri Sai Textiles',
        title: 'Diwali offer',
        advertiserPhone: null,
        description: null,
        // Not a directions ad: no place, shown everywhere.
        locationText: null,
      }),
      120,
    );
  });

  it('adds https:// to a bare link and drops an empty one', async () => {
    const { service, repository } = makeService();
    await service.create({ ...PARAMS, linkUrl: ' sritextiles.com ' });
    expect(repository.create).toHaveBeenLastCalledWith(expect.objectContaining({ linkUrl: 'https://sritextiles.com' }), 120);
    await service.create({ ...PARAMS, linkUrl: '  ' });
    expect(repository.create).toHaveBeenLastCalledWith(expect.objectContaining({ linkUrl: null }), 120);
  });

  it('keeps the booked amount on edit, even after a price change', async () => {
    const { service, repository } = makeService();
    await service.update('ad-1', { ...PARAMS, planDays: 3 });
    expect(repository.update).toHaveBeenCalledWith('ad-1', expect.anything(), 50);
  });

  it("prices a changed plan at today's price", async () => {
    const { service, repository } = makeService();
    await service.update('ad-1', { ...PARAMS, planDays: 30 });
    expect(repository.update).toHaveBeenCalledWith('ad-1', expect.anything(), 350);
  });

  it('404s editing a deleted ad', async () => {
    const { service, repository } = makeService();
    repository.findById.mockResolvedValueOnce({ ...AD, status: 'deleted' });
    await expect(service.update('ad-1', PARAMS)).rejects.toMatchObject({ code: 'AD_NOT_FOUND' });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('swaps the image for a video, deleting the image, and keeps the video length', async () => {
    const { service, repository } = makeService();
    const video = `${OURS}video/upload/v2/triolo/ads/w.mp4`;
    repository.setMedia.mockResolvedValue({ ad: AD, previousImages: AD.imageUrls, previousVideo: null });
    await service.setMedia('ad-1', null, video);
    expect(repository.setMedia).toHaveBeenCalledWith('ad-1', [], video, 12);
    expect(deletePhotosFromCloudinary).toHaveBeenCalledWith(AD.imageUrls);
  });

  it('refuses a video over 30 seconds and deletes it from Cloudinary', async () => {
    const { service, repository } = makeService();
    (videoDurationSeconds as jest.Mock).mockResolvedValueOnce(42);
    const video = `${OURS}video/upload/v2/triolo/ads/long.mp4`;
    await expect(service.setMedia('ad-1', null, video)).rejects.toMatchObject({ code: 'AD_VIDEO_TOO_LONG' });
    expect(deleteVideosFromCloudinary).toHaveBeenCalledWith([video]);
    expect(repository.setMedia).not.toHaveBeenCalled();
  });

  it('needs exactly one image or one video, of ours', async () => {
    const { service, repository } = makeService();
    const image = `${OURS}image/upload/v1/triolo/ads/x.jpg`;
    const video = `${OURS}video/upload/v1/triolo/ads/y.mp4`;
    await expect(service.setMedia('ad-1', null, null)).rejects.toMatchObject({ code: 'AD_MEDIA_INVALID' });
    await expect(service.setMedia('ad-1', image, video)).rejects.toMatchObject({ code: 'AD_MEDIA_INVALID' });
    await expect(service.setMedia('ad-1', 'https://evil.example/x.jpg', null)).rejects.toMatchObject({
      code: 'AD_MEDIA_INVALID',
    });
    await expect(service.setMedia('ad-1', null, image)).rejects.toMatchObject({ code: 'AD_MEDIA_INVALID' });
    expect(repository.setMedia).not.toHaveBeenCalled();
  });

  it('books an ad together with its video (checked first)', async () => {
    const { service, repository } = makeService();
    const video = `${OURS}video/upload/v3/triolo/ads/new.mp4`;
    repository.setMedia.mockResolvedValue({ ad: { ...AD, videoUrl: video }, previousImages: [], previousVideo: null });
    const ad = await service.create(PARAMS, { videoUrl: video });
    expect(repository.create).toHaveBeenCalled();
    expect(repository.setMedia).toHaveBeenCalledWith(AD.id, [], video, 12);
    expect(ad.videoUrl).toBe(video);
  });

  it('books nothing when the video is refused', async () => {
    const { service, repository } = makeService();
    (videoDurationSeconds as jest.Mock).mockResolvedValueOnce(45);
    const video = `${OURS}video/upload/v3/triolo/ads/long.mp4`;
    await expect(service.create(PARAMS, { videoUrl: video })).rejects.toMatchObject({ code: 'AD_VIDEO_TOO_LONG' });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('deletes day-old uploads no ad uses, keeping used and recent ones', async () => {
    const { service, repository } = makeService();
    repository.allMediaUrls.mockResolvedValue([`${OURS}image/upload/v1/triolo/ads/used.jpg`]);
    const old = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    const recent = new Date().toISOString();
    (listCloudinaryFiles as jest.Mock).mockImplementation(async (_prefix: string, kind: string) =>
      kind === 'image'
        ? [
            { publicId: 'triolo/ads/used', createdAt: old },
            { publicId: 'triolo/ads/abandoned', createdAt: old },
            { publicId: 'triolo/ads/just-picked', createdAt: recent },
          ]
        : [{ publicId: 'triolo/ads/old-video', createdAt: old }],
    );
    expect(await service.cleanupUnusedUploads()).toBe(2);
    expect(deleteCloudinaryIds).toHaveBeenCalledWith(['triolo/ads/abandoned'], 'image');
    expect(deleteCloudinaryIds).toHaveBeenCalledWith(['triolo/ads/old-video'], 'video');
  });

  it('names the ad after the business when no title is given', async () => {
    const { service, repository } = makeService();
    await service.create({ ...PARAMS, title: null });
    expect(repository.create).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Sri Sai Textiles' }), 120);
  });

  it('deletes the media of ended or deleted ads from Cloudinary and the ad', async () => {
    const { service, repository } = makeService();
    const video = `${OURS}video/upload/v1/triolo/ads/v.mp4`;
    repository.findFinishedWithMedia.mockResolvedValue([{ id: 'ad-9', imageUrls: AD.imageUrls, videoUrl: video }]);
    expect(await service.cleanupFinishedMedia()).toBe(1);
    expect(deletePhotosFromCloudinary).toHaveBeenCalledWith(AD.imageUrls);
    expect(deleteVideosFromCloudinary).toHaveBeenCalledWith([video]);
    expect(repository.clearMedia).toHaveBeenCalledWith('ad-9');
  });

  it('keeps a deleted ad in history (soft delete), deletes its media, and 404s a second delete', async () => {
    const { service, repository } = makeService();
    await service.remove('ad-1');
    expect(repository.softDelete).toHaveBeenCalledWith('ad-1');
    expect(deletePhotosFromCloudinary).toHaveBeenCalledWith(AD.imageUrls);
    expect(repository.clearMedia).toHaveBeenCalledWith('ad-1');
    repository.softDelete.mockResolvedValueOnce(null);
    await expect(service.remove('ad-1')).rejects.toMatchObject({ code: 'AD_NOT_FOUND' });
  });

  describe('businesses booking their own ads', () => {
    const OWNER = 'account-7';
    const future = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    const own = { ...PARAMS, startDate: future };
    const image = { imageUrl: `${OURS}image/upload/v1/triolo/ads/b.jpg` };

    it('books an own ad at the current price, waiting for review, with payment pending', async () => {
      const { service, repository } = makeService();
      repository.setMedia.mockResolvedValue({ ad: AD, previousImages: [], previousVideo: null });
      await service.createOwned(OWNER, own, image);
      expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ paymentMethod: 'pending' }), 120, OWNER);
      expect(repository.setMedia).toHaveBeenCalledWith(AD.id, [image.imageUrl], null, null);
    });

    it('refuses a start date in the past, media not ours, and too many waiting', async () => {
      const { service, repository } = makeService();
      await expect(service.createOwned(OWNER, { ...own, startDate: '2020-01-01' }, image)).rejects.toMatchObject({
        code: 'AD_START_IN_PAST',
      });
      await expect(service.createOwned(OWNER, own, { imageUrl: 'https://example.com/a.jpg' })).rejects.toMatchObject({
        code: 'AD_MEDIA_INVALID',
      });
      repository.countOpenOwned.mockResolvedValue(5);
      await expect(service.createOwned(OWNER, own, image)).rejects.toMatchObject({ code: 'AD_SELF_LIMIT' });
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('lets only the owner see or change it, and not once approved', async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue({ ...AD, ownerAccountId: 'someone-else' });
      await expect(service.getOwned(OWNER, 'ad-1')).rejects.toMatchObject({ code: 'AD_NOT_FOUND' });
      repository.findById.mockResolvedValue({ ...AD, ownerAccountId: OWNER });
      repository.updateOwned.mockResolvedValue(null);
      await expect(service.updateOwned(OWNER, 'ad-1', own, {})).rejects.toMatchObject({ code: 'AD_NOT_EDITABLE' });
    });

    it('reviews: approve, reject with a reason, and explains a refusal', async () => {
      const { service, repository } = makeService();
      repository.review.mockResolvedValueOnce({ ...AD, reviewStatus: 'approved' });
      await service.review('ad-1', 'approve');
      expect(repository.review).toHaveBeenCalledWith('ad-1', 'approve', null);
      repository.review.mockResolvedValueOnce({ ...AD, reviewStatus: 'rejected' });
      await service.review('ad-1', 'reject', ' Blurry picture ');
      expect(repository.review).toHaveBeenLastCalledWith('ad-1', 'reject', 'Blurry picture');
      repository.review.mockResolvedValueOnce(null);
      repository.findById.mockResolvedValue({ ...AD, reviewStatus: 'pending' });
      await expect(service.review('ad-1', 'approve')).rejects.toMatchObject({ code: 'AD_DATES_PASSED' });
    });
  });

  describe('what tapping the ad does', () => {
    const promotions = () => ({
      accountIdByMobile: jest.fn().mockResolvedValue('acc-9'),
      find: jest.fn().mockResolvedValue({ id: 'worker-1', name: 'Ravi' }),
      card: jest.fn().mockResolvedValue({ kind: 'service', name: 'Ravi', photoUrl: null, tags: ['plumber'] }),
    });

    it('an older form with a link makes a link ad', async () => {
      const { service, repository } = makeService();
      await service.create(PARAMS);
      expect(repository.create.mock.calls[0][0]).toMatchObject({ actionType: 'link', linkUrl: 'https://sritextiles.com' });
    });

    it('drops the link when another action is chosen', async () => {
      const { service, repository } = makeService();
      await service.create({ ...PARAMS, actionType: 'none' });
      expect(repository.create.mock.calls[0][0]).toMatchObject({ actionType: 'none', linkUrl: null, promotedId: null });
    });

    it('only a directions ad has a place; the others are shown everywhere', async () => {
      const { service, repository } = makeService();
      await service.create({ ...PARAMS, actionType: 'none' });
      expect(repository.create.mock.calls[0][0]).toMatchObject({ latitude: null, longitude: null, locationText: null });
      await service.create({ ...PARAMS, actionType: 'location', actionLatitude: 16.5, actionLongitude: 80.6, actionPlace: 'Vijayawada' });
      expect(repository.create.mock.calls[1][0]).toMatchObject({ latitude: 16.5, longitude: 80.6, locationText: 'Vijayawada' });
    });

    it('saves the place for directions', async () => {
      const { service, repository } = makeService();
      await service.create({ ...PARAMS, actionType: 'location', actionLatitude: 16.71, actionLongitude: 81.09, actionPlace: ' Eluru ' });
      expect(repository.create.mock.calls[0][0]).toMatchObject({
        actionType: 'location',
        actionLatitude: 16.71,
        actionLongitude: 81.09,
        actionPlace: 'Eluru',
        linkUrl: null,
      });
    });

    it('finds the promoted profile by the admin-given phone number', async () => {
      const resolver = promotions();
      const { service, repository } = makeService(resolver);
      await service.create({ ...PARAMS, actionType: 'service', promoteMobile: '9700000001' });
      expect(resolver.accountIdByMobile).toHaveBeenCalledWith('9700000001');
      expect(resolver.find).toHaveBeenCalledWith('service', 'acc-9');
      expect(repository.create.mock.calls[0][0]).toMatchObject({
        actionType: 'service',
        promotedId: 'worker-1',
        promotedName: 'Ravi',
        promoteMobile: '9700000001',
      });
    });

    it('a promoted profile names the ad and its number is the ad phone', async () => {
      const resolver = promotions();
      const { service, repository } = makeService(resolver);
      await service.create({ ...PARAMS, advertiserName: undefined, title: undefined, actionType: 'service', promoteMobile: '9700000001' });
      expect(repository.create.mock.calls[0][0]).toMatchObject({
        advertiserName: 'Ravi',
        title: 'Ravi',
        advertiserPhone: '9700000001',
      });
    });

    it("on the ads website the given Triolo Partner number is used, not the signed-in account", async () => {
      const resolver = promotions();
      const { service, repository } = makeService(resolver);
      repository.setMedia.mockResolvedValue({ ad: AD, previousImages: [], previousVideo: null });
      const params = { ...PARAMS } as Omit<SaveAdParams, 'paymentMethod'>;
      await service.createOwned(
        'owner-1',
        { ...params, startDate: '2999-01-01', actionType: 'business', promoteMobile: '9700000001' },
        { imageUrl: `${OURS}image/upload/v1/triolo/ads/b.jpg` },
      );
      expect(resolver.accountIdByMobile).toHaveBeenCalledWith('9700000001');
      expect(resolver.find).toHaveBeenCalledWith('business', 'acc-9');
    });

    it('refuses an unknown number or a missing profile', async () => {
      const resolver = promotions();
      resolver.accountIdByMobile.mockResolvedValueOnce(null);
      const { service, repository } = makeService(resolver);
      await expect(service.create({ ...PARAMS, actionType: 'business', promoteMobile: '9000000000' })).rejects.toMatchObject({
        code: 'AD_PROMOTE_ACCOUNT_NOT_FOUND',
      });
      resolver.find.mockResolvedValueOnce(null);
      await expect(service.create({ ...PARAMS, actionType: 'business', promoteMobile: '9000000000' })).rejects.toMatchObject({
        code: 'AD_PROMOTE_PROFILE_NOT_FOUND',
      });
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("a business's own ad promotes its own profile", async () => {
      const resolver = promotions();
      resolver.find.mockResolvedValue({ id: 'post-1', name: 'Lakshmi' });
      const { service, repository } = makeService(resolver);
      repository.setMedia.mockResolvedValue({ ad: AD, previousImages: [], previousVideo: null });
      const params = { ...PARAMS } as Omit<SaveAdParams, 'paymentMethod'>;
      await service.createOwned(
        'owner-1',
        { ...params, startDate: '2999-01-01', actionType: 'job_post' },
        { imageUrl: `${OURS}image/upload/v1/triolo/ads/b.jpg` },
      );
      expect(resolver.accountIdByMobile).not.toHaveBeenCalled();
      expect(resolver.find).toHaveBeenCalledWith('job_post', 'owner-1');
      expect(repository.create.mock.calls[0][0]).toMatchObject({ promotedId: 'post-1', promoteMobile: null });
    });

    it('a profile ad needs no picture or video, even on the ads website', async () => {
      const resolver = promotions();
      const { service, repository } = makeService(resolver);
      const params = { ...PARAMS } as Omit<SaveAdParams, 'paymentMethod'>;
      await service.createOwned('owner-1', { ...params, startDate: '2999-01-01', actionType: 'service', promoteMobile: '9700000001' }, {});
      expect(repository.create).toHaveBeenCalled();
      expect(repository.setMedia).not.toHaveBeenCalled();
    });

    it('switching an ad to a profile ad deletes its picture', async () => {
      const resolver = promotions();
      const { service, repository } = makeService(resolver);
      const updated = await service.update('ad-1', { ...PARAMS, actionType: 'service', promoteMobile: '9700000001' });
      expect(deletePhotosFromCloudinary).toHaveBeenCalledWith(AD.imageUrls);
      expect(repository.clearMedia).toHaveBeenCalledWith('ad-1');
      expect(updated.imageUrls).toEqual([]);
    });

    it('a served profile ad carries its profile card', async () => {
      const resolver = promotions();
      const { service, repository } = makeService(resolver);
      repository.pickAndCount.mockResolvedValue({ ...AD, imageUrl: null, imageUrls: [], actionType: 'service', promoted: { kind: 'service', id: 'worker-1', name: 'Ravi' } });
      const ad = await service.serve('user', 'action', { latitude: 16.7, longitude: 81.1 }, null);
      expect(resolver.card).toHaveBeenCalledWith('service', 'worker-1');
      expect(ad?.promotedCard).toMatchObject({ name: 'Ravi', tags: ['plumber'] });
    });

    it('apps get the action with the ad', async () => {
      const { service, repository } = makeService();
      repository.pickAndCount.mockResolvedValue({
        ...AD,
        actionType: 'business',
        promoted: { kind: 'business', id: 'shop-1', name: 'Sri Sai' },
      });
      const ad = await service.serve('user', 'action', { latitude: 16.7, longitude: 81.1 }, null);
      expect(ad).toMatchObject({ actionType: 'business', promoted: { kind: 'business', id: 'shop-1' }, destination: null });
    });
  });
});

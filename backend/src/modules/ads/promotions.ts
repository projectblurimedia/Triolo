import { AuthService } from '@/modules/auth/service';
import { WorkersService } from '@/modules/workers/service';
import { BusinessesService } from '@/modules/businesses/service';
import { JobSeekersService } from '@/modules/jobSeekers/service';
import { AdPromotedCard, AdPromotedKind, PromotionResolver } from './interfaces';

/**
 * Finds the profile an ad promotes through the owning modules' services, so the ads module
 * never reads their tables. Only a verified worker / shop or a live job post can be promoted.
 */
export class ServicePromotionResolver implements PromotionResolver {
  constructor(
    private readonly auth: AuthService,
    private readonly workers: WorkersService,
    private readonly businesses: BusinessesService,
    private readonly jobSeekers: JobSeekersService,
  ) {}

  async accountIdByMobile(mobileNumber: string): Promise<string | null> {
    return (await this.auth.findAccountByMobile(mobileNumber))?.id ?? null;
  }

  async card(kind: AdPromotedKind, id: string): Promise<AdPromotedCard | null> {
    const split = (text: string | null) =>
      (text ?? '')
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
    if (kind === 'service') {
      const [worker] = await this.workers.getVerifiedProfiles([id]);
      if (!worker) return null;
      return {
        kind,
        name: worker.accountFullName,
        photoUrl: worker.profilePhotoUrl ?? worker.portfolioPhotoUrls[0] ?? null,
        tags: worker.skillCategories.filter((code) => code !== 'other'),
        customTags: split(worker.otherSkillDescription),
        headline: null,
        ratingAverage: worker.ratingAverage,
        ratingCount: worker.ratingCount,
        experienceYears: worker.experienceYears,
        deliveryAvailable: null,
        payAmount: null,
        payPeriod: null,
        placeName: worker.locationName,
      };
    }
    if (kind === 'business') {
      const [shop] = await this.businesses.getVerifiedProfiles([id]);
      if (!shop) return null;
      return {
        kind,
        name: shop.shopName,
        photoUrl: shop.profilePhotoUrl ?? shop.shopPhotoUrls[0] ?? null,
        tags: shop.shopCategories.filter((code) => code !== 'other'),
        customTags: split(shop.otherCategoryDescription),
        headline: null,
        ratingAverage: shop.ratingAverage,
        ratingCount: shop.ratingCount,
        experienceYears: null,
        deliveryAvailable: shop.deliveryAvailable,
        payAmount: null,
        payPeriod: null,
        placeName: shop.locationName,
      };
    }
    const post = await this.jobSeekers.getPublic(id).catch(() => null);
    if (!post) return null;
    return {
      kind,
      name: post.fullName,
      photoUrl: post.photoUrl,
      tags: [],
      customTags: [],
      headline: post.title,
      ratingAverage: null,
      ratingCount: 0,
      experienceYears: post.experienceYears,
      deliveryAvailable: null,
      payAmount: post.payAmount,
      payPeriod: post.payPeriod,
      placeName: post.locationAddress,
    };
  }

  async find(kind: AdPromotedKind, accountId: string): Promise<{ id: string; name: string } | null> {
    if (kind === 'service') {
      const mine = await this.workers.getMyProfile(accountId);
      if (!mine || mine.verificationStatus !== 'verified') return null;
      const [profile] = await this.workers.getVerifiedProfiles([mine.id]);
      return profile ? { id: profile.id, name: profile.accountFullName } : null;
    }
    if (kind === 'business') {
      const shop = await this.businesses.getMyProfile(accountId);
      return shop && shop.verificationStatus === 'verified' ? { id: shop.id, name: shop.shopName } : null;
    }
    const post = await this.jobSeekers.getMine(accountId);
    if (!post || !post.isActive) return null;
    const account = await this.auth.getAccount(accountId);
    return { id: post.id, name: account.fullName };
  }
}

import fs from 'fs';
import type { SubscriptionStatusService } from '@/modules/subscriptions/statusService';
import { AppError } from '@/common/errors/AppError';
import { deletePhotosFromCloudinary, uploadToCloudinary } from '@/common/services/cloudinaryService';
import { NotificationsService } from '@/modules/notifications/service';
import { BusinessesRepository } from './repository';
import { CreateBusinessProfileDto, UpdateBusinessProfileDto } from './dto';
import {
  AdminListFilter,
  AdminListResult,
  BusinessNearbyResult,
  BusinessProfile,
  BusinessProfileWithAccount,
  NearbySearchFilter,
  ProfileVerificationStatus,
  ShopStaffMember,
  StaffShop,
  StaffInvite,
} from './interfaces';

const SHOP_PHOTO_FOLDER = 'triolo/businesses/shop-photos';
const PROFILE_PHOTO_FOLDER = 'triolo/businesses/profile';
/** Shops one partner may own (decided without asking — reversible). */
export const MAX_SHOPS = 5;
/** Delivery staff per shop. */
export const MAX_STAFF_PER_SHOP = 20;

/** Finds (or makes) the account for a phone number — the auth module's, passed in. */
export interface StaffAccounts {
  findOrCreateByMobile(mobileNumber: string, fullName: string, preferredLanguage?: 'en' | 'te'): Promise<{ id: string; fullName: string }>;
  getAccount(accountId: string): Promise<{ preferredLanguage: 'en' | 'te' }>;
}

export class BusinessesService {
  constructor(
    private readonly repository: BusinessesRepository,
    private readonly notificationsService: NotificationsService,
    // Subscribed partners' shops come first in searches (optional: tests and admin don't need it).
    private readonly subscriptionStatus?: SubscriptionStatusService,
    // Adding delivery staff by phone (only the businesses routes need it).
    private readonly staffAccounts?: StaffAccounts,
  ) {}

  /** A new shop — a partner may own up to MAX_SHOPS. */
  async createProfile(accountId: string, dto: CreateBusinessProfileDto, files: Express.Multer.File[]): Promise<BusinessProfile> {
    if ((await this.repository.countByAccountId(accountId)) >= MAX_SHOPS) {
      throw AppError.conflict(`You can have up to ${MAX_SHOPS} shops.`, 'SHOP_LIMIT');
    }

    const shopPhotoUrls: string[] = [];
    for (const file of files) {
      const uploaded = await uploadToCloudinary(file.path, SHOP_PHOTO_FOLDER);
      shopPhotoUrls.push(uploaded.url);
    }

    return this.repository.create({
      accountId,
      shopName: dto.shopName,
      shopCategories: dto.shopCategories,
      otherCategoryDescription: dto.otherCategoryDescription ?? null,
      latitude: dto.latitude,
      longitude: dto.longitude,
      locationName: dto.locationName,
      area: dto.area ?? null,
      city: dto.city ?? null,
      district: dto.district ?? null,
      state: dto.state ?? null,
      pincode: dto.pincode ?? null,
      shopPhotoUrls,
      deliveryAvailable: dto.deliveryAvailable,
      deliveryPricePerKm: dto.deliveryAvailable ? (dto.deliveryPricePerKm ?? null) : null,
      // The minimum is the price of 1 km unless one is given, so a delivery under 1 km costs a full km.
      deliveryMinCharge: dto.deliveryAvailable ? (dto.deliveryMinCharge ?? dto.deliveryPricePerKm ?? null) : null,
    });
  }

  /** Public profile (rating included) — never the owner's contact details. */
  async getPublicProfile(id: string): Promise<BusinessProfile | null> {
    const profile = await this.repository.findById(id);
    if (!profile) return null;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- dropped on purpose (contact details)
    const { accountFullName, accountMobileNumber, accountEmail, ...rest } = profile;
    return rest;
  }

  async getVerifiedProfiles(ids: string[]): Promise<BusinessProfile[]> {
    return this.repository.findVerifiedByIds(ids);
  }

  /** Adds a customer's 1–5 star rating of the shop (called by the orders module). */
  async recordRating(id: string, stars: number): Promise<void> {
    await this.repository.recordRating(id, stars);
  }

  /** One of my shops (the one asked for, else my first verified one). */
  async getMyProfile(accountId: string, shopId?: string): Promise<BusinessProfile | null> {
    return this.repository.findByAccountId(accountId, shopId);
  }

  /** All my shops, oldest first. */
  async listMyShops(accountId: string): Promise<BusinessProfile[]> {
    return this.repository.listByAccountId(accountId);
  }

  async updateProfile(
    accountId: string,
    dto: UpdateBusinessProfileDto,
    files: Express.Multer.File[],
    shopId?: string,
  ): Promise<BusinessProfile> {
    const existing = await this.repository.findByAccountId(accountId, shopId);
    if (!existing) {
      throw AppError.notFound('Business profile not found.', 'BUSINESS_PROFILE_NOT_FOUND');
    }

    const newPhotoUrls: string[] = [];
    for (const file of files) {
      const uploaded = await uploadToCloudinary(file.path, SHOP_PHOTO_FOLDER);
      newPhotoUrls.push(uploaded.url);
    }

    const keptPhotoUrls = dto.existingPhotoUrls ?? existing.shopPhotoUrls;
    const shopPhotoUrls = [...keptPhotoUrls, ...newPhotoUrls].slice(0, 6);

    const droppedPhotoUrls = existing.shopPhotoUrls.filter((url) => !keptPhotoUrls.includes(url));
    await deletePhotosFromCloudinary(droppedPhotoUrls);

    return this.repository.update(accountId, existing.id, {
      shopName: dto.shopName,
      shopCategories: dto.shopCategories,
      otherCategoryDescription: dto.otherCategoryDescription ?? null,
      latitude: dto.latitude,
      longitude: dto.longitude,
      locationName: dto.locationName,
      area: dto.area ?? null,
      city: dto.city ?? null,
      district: dto.district ?? null,
      state: dto.state ?? null,
      pincode: dto.pincode ?? null,
      shopPhotoUrls,
      deliveryAvailable: dto.deliveryAvailable,
      deliveryPricePerKm: dto.deliveryAvailable ? (dto.deliveryPricePerKm ?? null) : null,
      // The minimum is the price of 1 km unless one is given, so a delivery under 1 km costs a full km.
      deliveryMinCharge: dto.deliveryAvailable ? (dto.deliveryMinCharge ?? dto.deliveryPricePerKm ?? null) : null,
      // Edits keep whatever verification status the profile already had — a confirmed
      // reversal of an earlier "any edit resets to pending_verification" design. Admin still
      // sees when a verified profile was last edited via `updatedAt` (set by the repository's
      // `updated_at = now()`), surfaced as plain information, not a re-review gate.
      verificationStatus: existing.verificationStatus,
    });
  }

  /** Uploads the profile photo (replacing any previous one) — its own request, so the body stays small for Vercel. */
  async setProfilePhoto(accountId: string, file: Express.Multer.File | undefined, shopId?: string): Promise<BusinessProfile> {
    if (!file) throw AppError.badRequest('A photo is required.', 'PHOTO_REQUIRED');
    const shop = await this.repository.findByAccountId(accountId, shopId);
    if (!shop) {
      // uploadToCloudinary would normally remove the temp file; it won't run here.
      fs.promises.unlink(file.path).catch(() => {});
      throw AppError.notFound('Business profile not found.', 'BUSINESS_PROFILE_NOT_FOUND');
    }
    const uploaded = await uploadToCloudinary(file.path, PROFILE_PHOTO_FOLDER);
    const result = await this.repository.setProfilePhoto(accountId, shop.id, uploaded.url);
    if (!result) {
      await deletePhotosFromCloudinary([uploaded.url]);
      throw AppError.notFound('Business profile not found.', 'BUSINESS_PROFILE_NOT_FOUND');
    }
    if (result.previousUrl) await deletePhotosFromCloudinary([result.previousUrl]);
    return result.profile;
  }

  async removeProfilePhoto(accountId: string, shopId?: string): Promise<BusinessProfile> {
    const shop = await this.repository.findByAccountId(accountId, shopId);
    if (!shop) throw AppError.notFound('Business profile not found.', 'BUSINESS_PROFILE_NOT_FOUND');
    const result = await this.repository.setProfilePhoto(accountId, shop.id, null);
    if (!result) throw AppError.notFound('Business profile not found.', 'BUSINESS_PROFILE_NOT_FOUND');
    if (result.previousUrl) await deletePhotosFromCloudinary([result.previousUrl]);
    return result.profile;
  }

  async deleteProfile(accountId: string, shopId?: string): Promise<void> {
    const existing = await this.repository.findByAccountId(accountId, shopId);
    if (!existing) {
      throw AppError.notFound('Business profile not found.', 'BUSINESS_PROFILE_NOT_FOUND');
    }
    await deletePhotosFromCloudinary([...existing.shopPhotoUrls, ...(existing.profilePhotoUrl ? [existing.profilePhotoUrl] : [])]);
    await this.repository.remove(accountId, existing.id);
  }

  // --- Delivery staff ---

  private async requireOwnShop(accountId: string, shopId: string): Promise<BusinessProfile> {
    const shop = await this.repository.findByAccountId(accountId, shopId);
    if (!shop) throw AppError.notFound('Shop not found.', 'SHOP_NOT_FOUND');
    return shop;
  }

  async listStaff(accountId: string, shopId: string): Promise<ShopStaffMember[]> {
    const shop = await this.requireOwnShop(accountId, shopId);
    return this.repository.listStaff(shop.id);
  }

  /**
   * Adds someone to deliver this shop's orders, by the name and number the owner types — those
   * are their sign-in. Their account is made if new (in the owner's language). The number may be
   * the owner's own (the OTP then comes to the owner); the typed name is what is shown either way.
   * The same number again just renames that staff member.
   */
  async addStaff(accountId: string, shopId: string, member: { fullName: string; mobileNumber: string }): Promise<ShopStaffMember[]> {
    const shop = await this.requireOwnShop(accountId, shopId);
    if (!this.staffAccounts) throw new Error('Staff accounts are not wired');
    // A new staff account starts in English; they can switch in the app.
    const person = await this.staffAccounts.findOrCreateByMobile(member.mobileNumber, member.fullName, 'en');
    const already = await this.repository.hasStaffRow(shop.id, person.id);
    if (!already && (await this.repository.countStaff(shop.id)) >= MAX_STAFF_PER_SHOP) {
      throw AppError.conflict(`A shop can have up to ${MAX_STAFF_PER_SHOP} delivery staff.`, 'STAFF_LIMIT');
    }
    // Others accept the invitation in their Partner app first; the owner's own number is ready at once.
    const self = person.id === accountId;
    await this.repository.addStaff(shop.id, person.id, member.fullName.trim(), self ? 'active' : 'invited');
    if (!self && !already) {
      const language = (await this.staffAccounts.getAccount(person.id)).preferredLanguage;
      const text =
        language === 'te'
          ? {
              title: `${shop.shopName} డెలివరీకి ఆహ్వానించింది`,
              body: 'Triolo Partner తెరిచి చేరండి లేదా తిరస్కరించండి.',
            }
          : {
              title: `${shop.shopName} invited you to deliver`,
              body: 'Open Triolo Partner to join or decline.',
            };
      await this.notificationsService.notify(person.id, 'staff_invite', text.title, text.body, {
        audience: 'partner',
        data: { kind: 'staff_invite', businessId: shop.id },
        channelId: 'default',
      });
    }
    return this.repository.listStaff(shop.id);
  }

  /** Shops that invited this account to deliver and are waiting for an answer. */
  listMyInvites(accountId: string): Promise<StaffInvite[]> {
    return this.repository.listInvites(accountId);
  }

  /** Join (then deliveries can be handed over) or decline a shop's invitation. */
  async answerInvite(accountId: string, businessId: string, accept: boolean): Promise<StaffInvite[]> {
    if (!(await this.repository.answerInvite(accountId, businessId, accept))) {
      throw AppError.notFound('Invitation not found.', 'STAFF_INVITE_NOT_FOUND');
    }
    return this.repository.listInvites(accountId);
  }

  async removeStaff(accountId: string, shopId: string, staffId: string): Promise<ShopStaffMember[]> {
    const shop = await this.requireOwnShop(accountId, shopId);
    if (!(await this.repository.removeStaff(shop.id, staffId))) throw AppError.notFound('Staff member not found.', 'STAFF_NOT_FOUND');
    return this.repository.listStaff(shop.id);
  }

  /** Whether this account delivers for the shop (orders module, when handing a delivery over). */
  isStaff(businessId: string, accountId: string): Promise<boolean> {
    return this.repository.isStaff(businessId, accountId);
  }

  /** The shops this account delivers for (the partner app shows "Your deliveries"). */
  staffShops(accountId: string): Promise<StaffShop[]> {
    return this.repository.staffShops(accountId);
  }

  async searchNearby(accountId: string, filter: NearbySearchFilter): Promise<BusinessNearbyResult[]> {
    const priorityAccountIds = (await this.subscriptionStatus?.priorityPartnerIds('shop')) ?? [];
    return this.repository.findNearby(accountId, {
      ...filter,
      priorityAccountIds,
    });
  }

  /** Fired when a user opens this business's detail card from Nearby Shops search. */
  async recordProfileView(id: string, viewerAccountId: string): Promise<void> {
    const profile = await this.repository.findById(id);
    if (!profile) {
      throw AppError.notFound('Business profile not found.', 'BUSINESS_PROFILE_NOT_FOUND');
    }
    await this.notificationsService.notifyProfileViewed(profile.accountId, viewerAccountId, 'shop');
  }

  // --- Admin-facing (called only from modules/admin's service — see WorkersService's own
  // equivalent section for why that's the module-boundary-respecting way to reach this data).

  async adminListProfiles(filter: AdminListFilter): Promise<AdminListResult<BusinessProfileWithAccount>> {
    return this.repository.findAll(filter);
  }

  async adminGetProfile(id: string): Promise<BusinessProfileWithAccount> {
    const profile = await this.repository.findById(id);
    if (!profile) {
      throw AppError.notFound('Business profile not found.', 'BUSINESS_PROFILE_NOT_FOUND');
    }
    return profile;
  }

  async adminSetVerificationStatus(id: string, status: ProfileVerificationStatus): Promise<BusinessProfile> {
    const updated = await this.repository.updateVerificationStatus(id, status);
    if (!updated) {
      throw AppError.notFound('Business profile not found.', 'BUSINESS_PROFILE_NOT_FOUND');
    }
    return updated;
  }

  adminCounts() {
    return this.repository.adminCounts();
  }

  /** Admin removal of an account's profile (and its photos). False when there was none. */
  async adminDeleteForAccount(accountId: string): Promise<boolean> {
    const shops = await this.repository.listByAccountId(accountId);
    if (shops.length === 0) return false;
    await deletePhotosFromCloudinary(
      shops.flatMap((shop) => [...shop.shopPhotoUrls, ...(shop.profilePhotoUrl ? [shop.profilePhotoUrl] : [])]),
    );
    await this.repository.remove(accountId);
    return true;
  }

  /** Categories shops typed under "other" that match a search — names only. */
  searchCustomCategories(query: string): Promise<string[]> {
    return this.repository.findCustomCategories(query);
  }
}

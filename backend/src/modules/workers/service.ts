import { AppError } from '@/common/errors/AppError';
import { deletePhotosFromCloudinary, uploadToCloudinary } from '@/common/services/cloudinaryService';
import { WorkersRepository } from './repository';
import { CreateWorkerProfileDto, UpdateWorkerProfileDto } from './dto';
import { WorkerProfile } from './interfaces';

const PORTFOLIO_FOLDER = 'triolo/workers/portfolio';

export class WorkersService {
  constructor(private readonly repository: WorkersRepository) {}

  async createProfile(
    accountId: string,
    dto: CreateWorkerProfileDto,
    files: Express.Multer.File[],
  ): Promise<WorkerProfile> {
    const existing = await this.repository.findByAccountId(accountId);
    if (existing) {
      throw AppError.conflict('You already have a worker profile.', 'WORKER_PROFILE_EXISTS');
    }

    const portfolioPhotoUrls: string[] = [];
    for (const file of files) {
      const uploaded = await uploadToCloudinary(file.path, PORTFOLIO_FOLDER);
      portfolioPhotoUrls.push(uploaded.url);
    }

    return this.repository.create({
      accountId,
      skillCategories: dto.skillCategories,
      otherSkillDescription: dto.otherSkillDescription ?? null,
      experienceYears: dto.experienceYears,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      locationAddress: dto.locationAddress ?? null,
      portfolioPhotoUrls,
    });
  }

  async getMyProfile(accountId: string): Promise<WorkerProfile | null> {
    return this.repository.findByAccountId(accountId);
  }

  async updateProfile(
    accountId: string,
    dto: UpdateWorkerProfileDto,
    files: Express.Multer.File[],
  ): Promise<WorkerProfile> {
    const existing = await this.repository.findByAccountId(accountId);
    if (!existing) {
      throw AppError.notFound('Worker profile not found.', 'WORKER_PROFILE_NOT_FOUND');
    }

    const newPhotoUrls: string[] = [];
    for (const file of files) {
      const uploaded = await uploadToCloudinary(file.path, PORTFOLIO_FOLDER);
      newPhotoUrls.push(uploaded.url);
    }

    const keptPhotoUrls = dto.existingPhotoUrls ?? existing.portfolioPhotoUrls;
    const portfolioPhotoUrls = [...keptPhotoUrls, ...newPhotoUrls].slice(0, 6);

    const droppedPhotoUrls = existing.portfolioPhotoUrls.filter((url) => !keptPhotoUrls.includes(url));
    await deletePhotosFromCloudinary(droppedPhotoUrls);

    return this.repository.update(accountId, {
      skillCategories: dto.skillCategories,
      otherSkillDescription: dto.otherSkillDescription ?? null,
      experienceYears: dto.experienceYears,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      locationAddress: dto.locationAddress ?? null,
      portfolioPhotoUrls,
      // Edited details haven't been reviewed yet — an already-verified worker changing
      // their skills/location shouldn't stay "verified" for the new, unreviewed details.
      verificationStatus: 'pending_verification',
    });
  }

  async deleteProfile(accountId: string): Promise<void> {
    const existing = await this.repository.findByAccountId(accountId);
    if (!existing) {
      throw AppError.notFound('Worker profile not found.', 'WORKER_PROFILE_NOT_FOUND');
    }
    await deletePhotosFromCloudinary(existing.portfolioPhotoUrls);
    await this.repository.remove(accountId);
  }
}

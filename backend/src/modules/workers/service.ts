import { AppError } from '@/common/errors/AppError';
import { uploadToCloudinary } from '@/common/services/cloudinaryService';
import { WorkersRepository } from './repository';
import { CreateWorkerProfileDto } from './dto';
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
      skillCategory: dto.skillCategory,
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
}

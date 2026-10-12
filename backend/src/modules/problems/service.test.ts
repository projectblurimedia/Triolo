import { ProblemsService } from './service';
import { ProblemsRepository } from './repository';
import { ProblemPost, ProblemTransitionResult } from './interfaces';
import { WorkersService } from '@/modules/workers/service';
import { WorkerProfile } from '@/modules/workers/interfaces';
import { NotificationsService } from '@/modules/notifications/service';
import { deletePhotosFromCloudinary, uploadToCloudinary } from '@/common/services/cloudinaryService';

jest.mock('@/common/services/cloudinaryService', () => ({
  uploadToCloudinary: jest.fn(),
  deletePhotosFromCloudinary: jest.fn(),
}));

type MockRepository = { [K in keyof ProblemsRepository]: jest.Mock };

function createMockRepository(): MockRepository {
  return {
    create: jest.fn(),
    update: jest.fn(),
    findByIdForAccount: jest.fn(),
    exists: jest.fn(),
    appendPhoto: jest.fn(),
    delete: jest.fn(),
    findForAccount: jest.fn(),
    findNearbyOpen: jest.fn(),
    findAssignedToWorker: jest.fn(),
    accept: jest.fn(),
    markWorkDone: jest.fn(),
    complete: jest.fn(),
  } as unknown as MockRepository;
}

let repository: MockRepository;
let workersService: jest.Mocked<WorkersService>;
let notificationsService: jest.Mocked<NotificationsService>;
let service: ProblemsService;

beforeEach(() => {
  jest.clearAllMocks();
  repository = createMockRepository();
  workersService = { getMyProfile: jest.fn(), recordRating: jest.fn() } as unknown as jest.Mocked<WorkersService>;
  notificationsService = { notify: jest.fn() } as unknown as jest.Mocked<NotificationsService>;
  service = new ProblemsService(repository as unknown as ProblemsRepository, workersService, notificationsService);
});

function buildFile(): Express.Multer.File {
  return { path: '/tmp/does-not-exist.jpg' } as Express.Multer.File;
}

function buildPost(overrides: Partial<ProblemPost> = {}): ProblemPost {
  return {
    id: 'post-1',
    accountId: 'account-1',
    skillCategories: ['plumber'],
    description: null,
    quotationAmount: 500,
    photoUrls: [],
    locationAddress: 'Kannapuram, Eluru',
    latitude: null,
    longitude: null,
    status: 'open',
    acceptedWorkerId: null,
    acceptedAt: null,
    workDoneAt: null,
    completedAt: null,
    workerRating: null,
    workerReview: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function buildWorker(overrides: Partial<WorkerProfile> = {}): WorkerProfile {
  return {
    id: 'worker-1',
    accountId: 'worker-account-1',
    skillCategories: ['plumber'],
    latitude: 16.7,
    longitude: 81.1,
    verificationStatus: 'verified',
    ...overrides,
  } as WorkerProfile;
}

function buildTransition(notifyAccountId: string, overrides: Partial<ProblemPost> = {}): ProblemTransitionResult {
  return { post: buildPost(overrides), notifyAccountId, notifyLanguage: 'en' };
}

describe('createPost', () => {
  it('saves the post with location and normalizes optional fields to null', async () => {
    repository.create.mockResolvedValue(buildPost());

    await service.createPost('account-1', {
      skillCategories: ['plumber'],
      description: '',
      quotationAmount: 500,
      locationAddress: 'Kannapuram, Eluru',
    });

    expect(repository.create).toHaveBeenCalledWith({
      accountId: 'account-1',
      skillCategories: ['plumber'],
      description: null,
      quotationAmount: 500,
      locationAddress: 'Kannapuram, Eluru',
      latitude: null,
      longitude: null,
    });
  });
});

describe('updatePost', () => {
  const dto = { skillCategories: ['electrician'], description: 'Updated', quotationAmount: 800, locationAddress: 'Eluru' };

  it('updates fields, keeps listed photos, and deletes the removed ones from Cloudinary', async () => {
    repository.findByIdForAccount.mockResolvedValue(buildPost({ photoUrls: ['https://cdn/a.jpg', 'https://cdn/b.jpg'] }));
    repository.update.mockResolvedValue(buildPost({ photoUrls: ['https://cdn/a.jpg'] }));

    await service.updatePost('account-1', 'post-1', { ...dto, keepPhotoUrls: ['https://cdn/a.jpg'] });

    expect(repository.update).toHaveBeenCalledWith('post-1', 'account-1', expect.objectContaining({ photoUrls: ['https://cdn/a.jpg'] }));
    expect(deletePhotosFromCloudinary).toHaveBeenCalledWith(['https://cdn/b.jpg']);
  });

  it('ignores keep-URLs the post does not actually have', async () => {
    repository.findByIdForAccount.mockResolvedValue(buildPost({ photoUrls: ['https://cdn/a.jpg'] }));
    repository.update.mockResolvedValue(buildPost());

    await service.updatePost('account-1', 'post-1', { ...dto, keepPhotoUrls: ['https://cdn/a.jpg', 'https://evil.example/x.jpg'] });

    expect(repository.update).toHaveBeenCalledWith('post-1', 'account-1', expect.objectContaining({ photoUrls: ['https://cdn/a.jpg'] }));
  });

  it('refuses to edit once a worker has accepted', async () => {
    repository.findByIdForAccount.mockResolvedValue(buildPost({ status: 'accepted' }));

    await expect(service.updatePost('account-1', 'post-1', { ...dto, keepPhotoUrls: [] })).rejects.toMatchObject({
      code: 'PROBLEM_NOT_EDITABLE',
    });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('404s for a post that is not the caller’s', async () => {
    repository.findByIdForAccount.mockResolvedValue(null);

    await expect(service.updatePost('account-1', 'post-1', { ...dto, keepPhotoUrls: [] })).rejects.toMatchObject({
      code: 'PROBLEM_POST_NOT_FOUND',
    });
  });
});

describe('addPhoto', () => {
  it('uploads the photo and appends its URL to the caller’s own open post', async () => {
    repository.findByIdForAccount.mockResolvedValue(buildPost());
    (uploadToCloudinary as jest.Mock).mockResolvedValue({ url: 'https://cdn/a.jpg' });
    repository.appendPhoto.mockResolvedValue(buildPost({ photoUrls: ['https://cdn/a.jpg'] }));

    const result = await service.addPhoto('account-1', 'post-1', buildFile());

    expect(repository.appendPhoto).toHaveBeenCalledWith('post-1', 'account-1', 'https://cdn/a.jpg');
    expect(result.photoUrls).toEqual(['https://cdn/a.jpg']);
  });

  it('rejects a request with no file', async () => {
    await expect(service.addPhoto('account-1', 'post-1', undefined)).rejects.toMatchObject({ code: 'PHOTO_REQUIRED' });
  });

  it('does not upload to a post that is not the caller’s', async () => {
    repository.findByIdForAccount.mockResolvedValue(null);

    await expect(service.addPhoto('account-1', 'post-1', buildFile())).rejects.toMatchObject({ code: 'PROBLEM_POST_NOT_FOUND' });
    expect(uploadToCloudinary).not.toHaveBeenCalled();
  });

  it('rejects past the 5-photo cap and deletes the just-uploaded photo', async () => {
    repository.findByIdForAccount.mockResolvedValue(buildPost());
    (uploadToCloudinary as jest.Mock).mockResolvedValue({ url: 'https://cdn/extra.jpg' });
    repository.appendPhoto.mockResolvedValue(null);

    await expect(service.addPhoto('account-1', 'post-1', buildFile())).rejects.toMatchObject({ code: 'PROBLEM_PHOTO_LIMIT' });
    expect(deletePhotosFromCloudinary).toHaveBeenCalledWith(['https://cdn/extra.jpg']);
  });
});

describe('deletePost', () => {
  it('deletes an open post and its photos', async () => {
    repository.findByIdForAccount.mockResolvedValue(buildPost({ photoUrls: ['https://cdn/a.jpg'] }));

    await service.deletePost('account-1', 'post-1');

    expect(repository.delete).toHaveBeenCalledWith('post-1', 'account-1');
    expect(deletePhotosFromCloudinary).toHaveBeenCalledWith(['https://cdn/a.jpg']);
  });

  it('allows deleting a completed post', async () => {
    repository.findByIdForAccount.mockResolvedValue(buildPost({ status: 'completed' }));

    await service.deletePost('account-1', 'post-1');

    expect(repository.delete).toHaveBeenCalled();
  });

  it('refuses to delete a job that is in progress', async () => {
    repository.findByIdForAccount.mockResolvedValue(buildPost({ status: 'work_done' }));

    await expect(service.deletePost('account-1', 'post-1')).rejects.toMatchObject({ code: 'PROBLEM_IN_PROGRESS' });
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('silently no-ops when the post is not the caller’s', async () => {
    repository.findByIdForAccount.mockResolvedValue(null);

    await service.deletePost('account-1', 'post-1');

    expect(repository.delete).not.toHaveBeenCalled();
  });
});

describe('listNearbyForWorker', () => {
  it('searches with the worker’s own skills and location', async () => {
    workersService.getMyProfile.mockResolvedValue(buildWorker({ skillCategories: ['plumber', 'painter'] }));
    repository.findNearbyOpen.mockResolvedValue([]);

    await service.listNearbyForWorker('worker-account-1');

    expect(repository.findNearbyOpen).toHaveBeenCalledWith('worker-account-1', ['plumber', 'painter'], 16.7, 81.1, 50, 50);
  });

  it('returns nothing when the worker profile has no GPS location', async () => {
    workersService.getMyProfile.mockResolvedValue(buildWorker({ latitude: null, longitude: null }));

    await expect(service.listNearbyForWorker('worker-account-1')).resolves.toEqual([]);
    expect(repository.findNearbyOpen).not.toHaveBeenCalled();
  });

  it('refuses an unverified worker', async () => {
    workersService.getMyProfile.mockResolvedValue(buildWorker({ verificationStatus: 'pending_verification' }));

    await expect(service.listNearbyForWorker('worker-account-1')).rejects.toMatchObject({ code: 'WORKER_NOT_VERIFIED' });
  });

  it('404s for an account with no worker profile', async () => {
    workersService.getMyProfile.mockResolvedValue(null);

    await expect(service.listNearbyForWorker('worker-account-1')).rejects.toMatchObject({ code: 'WORKER_PROFILE_NOT_FOUND' });
  });
});

describe('acceptProblem', () => {
  it('accepts and pushes the customer', async () => {
    workersService.getMyProfile.mockResolvedValue(buildWorker());
    repository.accept.mockResolvedValue(buildTransition('account-1', { status: 'accepted' }));

    const post = await service.acceptProblem('worker-account-1', 'post-1');

    expect(repository.accept).toHaveBeenCalledWith('post-1', 'worker-1', 'worker-account-1');
    expect(post.status).toBe('accepted');
    expect(notificationsService.notify).toHaveBeenCalledWith(
      'account-1',
      expect.any(String),
      'Worker Found',
      expect.any(String),
      expect.objectContaining({ data: { kind: 'problem_accepted', problemId: 'post-1' } }),
    );
  });

  it('409s when another worker already took it', async () => {
    workersService.getMyProfile.mockResolvedValue(buildWorker());
    repository.accept.mockResolvedValue(null);
    repository.exists.mockResolvedValue(true);

    await expect(service.acceptProblem('worker-account-1', 'post-1')).rejects.toMatchObject({ code: 'PROBLEM_ALREADY_TAKEN' });
    expect(notificationsService.notify).not.toHaveBeenCalled();
  });

  it('404s when the problem no longer exists', async () => {
    workersService.getMyProfile.mockResolvedValue(buildWorker());
    repository.accept.mockResolvedValue(null);
    repository.exists.mockResolvedValue(false);

    await expect(service.acceptProblem('worker-account-1', 'post-1')).rejects.toMatchObject({ code: 'PROBLEM_POST_NOT_FOUND' });
  });
});

describe('markWorkDone', () => {
  it('marks done and pushes the customer to confirm', async () => {
    workersService.getMyProfile.mockResolvedValue(buildWorker());
    repository.markWorkDone.mockResolvedValue(buildTransition('account-1', { status: 'work_done' }));

    await service.markWorkDone('worker-account-1', 'post-1');

    expect(repository.markWorkDone).toHaveBeenCalledWith('post-1', 'worker-1');
    expect(notificationsService.notify).toHaveBeenCalledWith(
      'account-1',
      expect.any(String),
      'Work Done',
      expect.any(String),
      expect.objectContaining({ data: { kind: 'problem_work_done', problemId: 'post-1' } }),
    );
  });

  it('409s when the job is not in an accepted state for this worker', async () => {
    workersService.getMyProfile.mockResolvedValue(buildWorker());
    repository.markWorkDone.mockResolvedValue(null);
    repository.exists.mockResolvedValue(true);

    await expect(service.markWorkDone('worker-account-1', 'post-1')).rejects.toMatchObject({ code: 'PROBLEM_INVALID_STATE' });
  });
});

describe('completeProblem', () => {
  it('lets the customer confirm finished and pushes the worker', async () => {
    repository.complete.mockResolvedValue(buildTransition('worker-account-1', { status: 'completed' }));

    const post = await service.completeProblem('account-1', 'post-1');

    expect(repository.complete).toHaveBeenCalledWith('post-1', 'account-1', null, null);
    expect(post.status).toBe('completed');
    expect(workersService.recordRating).not.toHaveBeenCalled();
    expect(notificationsService.notify).toHaveBeenCalledWith(
      'worker-account-1',
      expect.any(String),
      'Job Finished',
      expect.any(String),
      expect.objectContaining({ data: { kind: 'problem_completed', problemId: 'post-1' } }),
    );
  });

  it('stores the rating on the job and adds it to the worker’s total', async () => {
    repository.complete.mockResolvedValue(
      buildTransition('worker-account-1', { status: 'completed', acceptedWorkerId: 'worker-1', workerRating: 4 }),
    );

    await service.completeProblem('account-1', 'post-1', { rating: 4, review: 'Quick and neat' });

    expect(repository.complete).toHaveBeenCalledWith('post-1', 'account-1', 4, 'Quick and neat');
    expect(workersService.recordRating).toHaveBeenCalledWith('worker-1', 4);
  });

  it('409s when the problem has no worker yet or is already finished', async () => {
    repository.complete.mockResolvedValue(null);
    repository.exists.mockResolvedValue(true);

    await expect(service.completeProblem('account-1', 'post-1', { rating: 5 })).rejects.toMatchObject({
      code: 'PROBLEM_INVALID_STATE',
    });
    expect(notificationsService.notify).not.toHaveBeenCalled();
    expect(workersService.recordRating).not.toHaveBeenCalled();
  });
});

describe('listAssignedToWorker / listMyPosts', () => {
  it('lists jobs assigned to the caller’s worker profile', async () => {
    workersService.getMyProfile.mockResolvedValue(buildWorker());
    repository.findAssignedToWorker.mockResolvedValue([]);

    await service.listAssignedToWorker('worker-account-1');

    expect(repository.findAssignedToWorker).toHaveBeenCalledWith('worker-1', 50);
  });

  it('returns no assigned jobs for an account without a worker profile', async () => {
    workersService.getMyProfile.mockResolvedValue(null);

    await expect(service.listAssignedToWorker('account-1')).resolves.toEqual([]);
  });

  it('returns the customer’s own posts', async () => {
    repository.findForAccount.mockResolvedValue([]);

    await service.listMyPosts('account-1');

    expect(repository.findForAccount).toHaveBeenCalledWith('account-1', 50);
  });
});

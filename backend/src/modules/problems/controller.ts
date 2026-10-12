import { Request, Response } from 'express';
import { asyncHandler } from '@/common/utils/asyncHandler';
import { created, ok } from '@/common/utils/response';
import { AppError } from '@/common/errors/AppError';
import { ProblemsService } from './service';

function requireAccountId(req: Request): string {
  if (!req.account) {
    throw AppError.unauthorized();
  }
  return req.account.accountId;
}

export class ProblemsController {
  constructor(private readonly service: ProblemsService) {}

  createPost = asyncHandler(async (req: Request, res: Response) => {
    const post = await this.service.createPost(requireAccountId(req), req.body);
    return created(res, post, 'Problem posted');
  });

  updatePost = asyncHandler(async (req: Request, res: Response) => {
    const post = await this.service.updatePost(requireAccountId(req), req.params.id, req.body);
    return ok(res, post, 'Problem updated');
  });

  addPhoto = asyncHandler(async (req: Request, res: Response) => {
    const post = await this.service.addPhoto(requireAccountId(req), req.params.id, req.file);
    return ok(res, post, 'Photo added');
  });

  deletePost = asyncHandler(async (req: Request, res: Response) => {
    await this.service.deletePost(requireAccountId(req), req.params.id);
    return ok(res, null, 'Problem post deleted');
  });

  listMine = asyncHandler(async (req: Request, res: Response) => {
    const posts = await this.service.listMyPosts(requireAccountId(req));
    return ok(res, posts);
  });

  complete = asyncHandler(async (req: Request, res: Response) => {
    const post = await this.service.completeProblem(requireAccountId(req), req.params.id, req.body);
    return ok(res, post, 'Problem marked finished');
  });

  listNearby = asyncHandler(async (req: Request, res: Response) => {
    const problems = await this.service.listNearbyForWorker(requireAccountId(req));
    return ok(res, problems);
  });

  listAssigned = asyncHandler(async (req: Request, res: Response) => {
    const problems = await this.service.listAssignedToWorker(requireAccountId(req));
    return ok(res, problems);
  });

  accept = asyncHandler(async (req: Request, res: Response) => {
    const post = await this.service.acceptProblem(requireAccountId(req), req.params.id);
    return ok(res, post, 'Problem accepted');
  });

  markWorkDone = asyncHandler(async (req: Request, res: Response) => {
    const post = await this.service.markWorkDone(requireAccountId(req), req.params.id);
    return ok(res, post, 'Work marked done');
  });
}

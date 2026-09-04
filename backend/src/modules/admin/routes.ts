import { Router } from 'express';
import { pool } from '@/config/database';
import { authenticate } from '@/common/middleware/authenticate';
import { authorize } from '@/common/middleware/authorize';
import { validateBody } from '@/common/middleware/validate';
import { WorkersRepository } from '@/modules/workers/repository';
import { WorkersService } from '@/modules/workers/service';
import { BusinessesRepository } from '@/modules/businesses/repository';
import { BusinessesService } from '@/modules/businesses/service';
import { AdminController } from './controller';
import { AdminService } from './service';
import { setVerificationStatusSchema } from './validation';

// Own instances of WorkersService/BusinessesService, backed by the same shared `pool` —
// matches how every other module's routes.ts already wires up its own repository/service
// independently (no shared module registry exists in this codebase); these are stateless
// wrappers over the pool, so a second instance is harmless.
const workersService = new WorkersService(new WorkersRepository(pool));
const businessesService = new BusinessesService(new BusinessesRepository(pool));
const service = new AdminService(workersService, businessesService);
const controller = new AdminController(service);

export const adminRouter = Router();

adminRouter.use(authenticate, authorize('admin'));

adminRouter.get('/workers', controller.listWorkers);
adminRouter.get('/workers/:id', controller.getWorker);
adminRouter.patch('/workers/:id/verification', validateBody(setVerificationStatusSchema), controller.setWorkerVerification);

adminRouter.get('/businesses', controller.listBusinesses);
adminRouter.get('/businesses/:id', controller.getBusiness);
adminRouter.patch(
  '/businesses/:id/verification',
  validateBody(setVerificationStatusSchema),
  controller.setBusinessVerification,
);

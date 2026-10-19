import { Router } from 'express';
import { pool } from '@/config/database';
import { authenticate } from '@/common/middleware/authenticate';
import { validateBody } from '@/common/middleware/validate';
import { WorkersRepository } from '@/modules/workers/repository';
import { WorkersService } from '@/modules/workers/service';
import { NotificationsRepository } from '@/modules/notifications/repository';
import { NotificationsService } from '@/modules/notifications/service';
import { ProblemsRepository } from '@/modules/problems/repository';
import { ProblemsService } from '@/modules/problems/service';
import { BookingsController } from './controller';
import { BookingsService } from './service';
import { BookingsRepository } from './repository';
import {
  completeBookingSchema,
  cancelBookingSchema,
  createDirectBookingSchema,
  createQuickBookingSchema,
  updateWorkerLocationSchema,
  verifyPinSchema,
  workerCancelSchema,
  searchOffersSchema,
} from './validation';

// Own instances, backed by the same shared `pool` — matches how every other module's
// routes.ts wires up its own dependencies independently (no shared module registry in this
// codebase). NotificationsService is constructed twice here and in workers/routes.ts
// (stateless wrapper over the pool, so this is harmless) since WorkersService also needs one.
const notificationsService = new NotificationsService(new NotificationsRepository(pool));
const workersService = new WorkersService(new WorkersRepository(pool), notificationsService);
const repository = new BookingsRepository(pool);
const service = new BookingsService(repository, workersService, notificationsService);
// Trips started from a Your Problems post report back when they finish or are cancelled.
service.setLifecycleListener(new ProblemsService(new ProblemsRepository(pool), workersService, notificationsService, service));
const controller = new BookingsController(service);

export const bookingsRouter = Router();

// Literal paths first, so they're never captured as an `:id`.
bookingsRouter.post('/quick', authenticate, validateBody(createQuickBookingSchema), controller.createQuickBooking);
bookingsRouter.post('/direct', authenticate, validateBody(createDirectBookingSchema), controller.createDirectBooking);
bookingsRouter.get('/mine', authenticate, controller.listMine);
bookingsRouter.get('/offers/mine', authenticate, controller.getMyOffers);
bookingsRouter.post('/offers/search', authenticate, validateBody(searchOffersSchema), controller.searchOffers);
bookingsRouter.get('/jobs/mine', authenticate, controller.listMyJobs);
bookingsRouter.get('/jobs/:id', authenticate, controller.getMyJob);

// Customer
bookingsRouter.get('/:id', authenticate, controller.getStatus);
bookingsRouter.post('/:id/cancel', authenticate, validateBody(cancelBookingSchema), controller.cancel);
bookingsRouter.post('/:id/complete', authenticate, validateBody(completeBookingSchema), controller.complete);

// Worker
bookingsRouter.post('/:id/accept', authenticate, controller.acceptOffer);
bookingsRouter.post('/:id/decline', authenticate, controller.declineOffer);
bookingsRouter.post('/:id/start', authenticate, controller.startTrip);
bookingsRouter.put('/:id/location', authenticate, validateBody(updateWorkerLocationSchema), controller.updateLocation);
bookingsRouter.post('/:id/arrive', authenticate, controller.markArrived);
bookingsRouter.post('/:id/verify-pin', authenticate, validateBody(verifyPinSchema), controller.verifyPin);
bookingsRouter.post('/:id/work-done', authenticate, controller.markWorkDone);
bookingsRouter.post('/:id/worker-cancel', authenticate, validateBody(workerCancelSchema), controller.workerCancel);

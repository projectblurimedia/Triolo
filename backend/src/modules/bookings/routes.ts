import { Router } from 'express';
import { pool } from '@/config/database';
import { authenticate } from '@/common/middleware/authenticate';
import { validateBody } from '@/common/middleware/validate';
import { WorkersRepository } from '@/modules/workers/repository';
import { WorkersService } from '@/modules/workers/service';
import { NotificationsRepository } from '@/modules/notifications/repository';
import { NotificationsService } from '@/modules/notifications/service';
import { BookingsController } from './controller';
import { BookingsService } from './service';
import { BookingsRepository } from './repository';
import { createQuickBookingSchema } from './validation';

// Own instances, backed by the same shared `pool` — matches how every other module's
// routes.ts wires up its own dependencies independently (no shared module registry in this
// codebase). NotificationsService is constructed twice here and in workers/routes.ts
// (stateless wrapper over the pool, so this is harmless) since WorkersService also needs one.
const notificationsService = new NotificationsService(new NotificationsRepository(pool));
const workersService = new WorkersService(new WorkersRepository(pool), notificationsService);
const repository = new BookingsRepository(pool);
const service = new BookingsService(repository, workersService, notificationsService);
const controller = new BookingsController(service);

export const bookingsRouter = Router();

bookingsRouter.post('/quick', authenticate, validateBody(createQuickBookingSchema), controller.createQuickBooking);
bookingsRouter.get('/offers/mine', authenticate, controller.getMyOffers);
bookingsRouter.get('/:id', authenticate, controller.getStatus);
bookingsRouter.post('/:id/accept', authenticate, controller.acceptOffer);
bookingsRouter.post('/:id/decline', authenticate, controller.declineOffer);

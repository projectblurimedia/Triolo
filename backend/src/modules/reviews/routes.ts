import { Router } from 'express';
import { pool } from '@/config/database';
import { authenticate } from '@/common/middleware/authenticate';
import { WorkersRepository } from '@/modules/workers/repository';
import { WorkersService } from '@/modules/workers/service';
import { NotificationsRepository } from '@/modules/notifications/repository';
import { NotificationsService } from '@/modules/notifications/service';
import { BookingsRepository } from '@/modules/bookings/repository';
import { BookingsService } from '@/modules/bookings/service';
import { ProblemsRepository } from '@/modules/problems/repository';
import { ProblemsService } from '@/modules/problems/service';
import { ReviewsController } from './controller';
import { ReviewsService } from './service';

// Read-only: these instances are only used to list rated jobs, so no lifecycle listener is
// wired here (nothing in this module completes or cancels a trip).
const notificationsService = new NotificationsService(new NotificationsRepository(pool));
const workersService = new WorkersService(new WorkersRepository(pool), notificationsService);
const bookingsService = new BookingsService(new BookingsRepository(pool), workersService, notificationsService);
const problemsService = new ProblemsService(new ProblemsRepository(pool), workersService, notificationsService, bookingsService);
const controller = new ReviewsController(new ReviewsService(workersService, bookingsService, problemsService));

export const reviewsRouter = Router();

reviewsRouter.get('/me', authenticate, controller.getForMe);
reviewsRouter.get('/workers/:workerId', authenticate, controller.getForWorker);

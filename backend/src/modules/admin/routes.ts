import { Router } from 'express';
import { pool } from '@/config/database';
import { authenticate } from '@/common/middleware/authenticate';
import { authorize } from '@/common/middleware/authorize';
import { validateBody } from '@/common/middleware/validate';
import { AuthRepository } from '@/modules/auth/repository';
import { AuthService } from '@/modules/auth/service';
import { WorkersRepository } from '@/modules/workers/repository';
import { WorkersService } from '@/modules/workers/service';
import { BusinessesRepository } from '@/modules/businesses/repository';
import { BusinessesService } from '@/modules/businesses/service';
import { JobSeekersRepository } from '@/modules/jobSeekers/repository';
import { JobSeekersService } from '@/modules/jobSeekers/service';
import { BookingsRepository } from '@/modules/bookings/repository';
import { BookingsService } from '@/modules/bookings/service';
import { OrdersRepository } from '@/modules/orders/repository';
import { OrdersService } from '@/modules/orders/service';
import { ProblemsRepository } from '@/modules/problems/repository';
import { ProblemsService } from '@/modules/problems/service';
import { NotificationsRepository } from '@/modules/notifications/repository';
import { NotificationsService } from '@/modules/notifications/service';
import { adsAdminRouter } from '@/modules/ads/routes';
import { AdminController } from './controller';
import { AdminService } from './service';
import { jobPostActiveSchema, moderateAccountSchema, reasonSchema, setVerificationStatusSchema } from './validation';

// Own instances of every service it uses, backed by the same shared `pool` — the same way
// every module's routes.ts wires itself up (no shared registry); they're stateless wrappers.
const notifications = new NotificationsService(new NotificationsRepository(pool));
const workers = new WorkersService(new WorkersRepository(pool), notifications);
const businesses = new BusinessesService(new BusinessesRepository(pool), notifications);
const bookings = new BookingsService(new BookingsRepository(pool), workers, notifications);
const problems = new ProblemsService(new ProblemsRepository(pool), workers, notifications, bookings);
// A cancelled problem trip reopens its problem, as everywhere else.
bookings.setLifecycleListener(problems);
const service = new AdminService({
  auth: new AuthService(new AuthRepository(pool)),
  workers,
  businesses,
  jobSeekers: new JobSeekersService(new JobSeekersRepository(pool)),
  bookings,
  orders: new OrdersService(new OrdersRepository(pool), businesses, notifications),
  problems,
  notifications,
});
const controller = new AdminController(service);

export const adminRouter = Router();

adminRouter.use(authenticate, authorize('admin'));

adminRouter.get('/stats', controller.stats);

adminRouter.get('/accounts', controller.listAccounts);
adminRouter.get('/accounts/:id', controller.getAccount);
adminRouter.patch('/accounts/:id/status', validateBody(moderateAccountSchema), controller.moderateAccount);
adminRouter.post('/accounts/:id/remove-profiles', validateBody(reasonSchema), controller.removeProfiles);

adminRouter.get('/workers', controller.listWorkers);
adminRouter.get('/workers/:id', controller.getWorker);
adminRouter.patch('/workers/:id/verification', validateBody(setVerificationStatusSchema), controller.setWorkerVerification);

adminRouter.get('/businesses', controller.listBusinesses);
adminRouter.get('/businesses/:id', controller.getBusiness);
adminRouter.patch('/businesses/:id/verification', validateBody(setVerificationStatusSchema), controller.setBusinessVerification);

adminRouter.get('/bookings', controller.listBookings);
adminRouter.get('/bookings/:id', controller.getBooking);
adminRouter.post('/bookings/:id/cancel', validateBody(reasonSchema), controller.cancelBooking);

adminRouter.get('/orders', controller.listOrders);
adminRouter.get('/orders/:id', controller.getOrder);
adminRouter.post('/orders/:id/cancel', validateBody(reasonSchema), controller.cancelOrder);

adminRouter.get('/problems', controller.listProblems);
adminRouter.get('/problems/:id', controller.getProblem);
adminRouter.post('/problems/:id/close', validateBody(reasonSchema), controller.closeProblem);

adminRouter.get('/job-posts', controller.listJobPosts);
adminRouter.get('/job-posts/:id', controller.getJobPost);
adminRouter.patch('/job-posts/:id/active', validateBody(jobPostActiveSchema), controller.setJobPostActive);
adminRouter.post('/job-posts/:id/remove', validateBody(reasonSchema), controller.removeJobPost);

// Ads booked by local businesses — the ads module owns these routes and its tables.
adminRouter.use('/ads', adsAdminRouter);

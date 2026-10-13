import { Router } from 'express';
import { pool } from '@/config/database';
import { authenticate } from '@/common/middleware/authenticate';
import { validateBody } from '@/common/middleware/validate';
import { logUploadedFiles, upload } from '@/common/middleware/upload';
import { WorkersRepository } from '@/modules/workers/repository';
import { WorkersService } from '@/modules/workers/service';
import { NotificationsRepository } from '@/modules/notifications/repository';
import { NotificationsService } from '@/modules/notifications/service';
import { BookingsRepository } from '@/modules/bookings/repository';
import { BookingsService } from '@/modules/bookings/service';
import { ProblemsController } from './controller';
import { ProblemsService } from './service';
import { ProblemsRepository } from './repository';
import { completeProblemSchema, createProblemPostSchema, updateProblemPostSchema } from './validation';

// Own instances over the shared pool — same wiring style as bookings/routes.ts.
const notificationsService = new NotificationsService(new NotificationsRepository(pool));
const workersService = new WorkersService(new WorkersRepository(pool), notificationsService);
// Accepting a problem starts a trip in the bookings module; that trip reports back here.
const bookingsService = new BookingsService(new BookingsRepository(pool), workersService, notificationsService);
const service = new ProblemsService(new ProblemsRepository(pool), workersService, notificationsService, bookingsService);
bookingsService.setLifecycleListener(service);
const controller = new ProblemsController(service);

export const problemsRouter = Router();

// Customer side. Photos attach one per request rather than in the create request: Vercel
// rejects any request body over 4.5MB before it reaches this code, and five phone-camera
// photos in one multipart body routinely exceed that.
problemsRouter.post('/', authenticate, validateBody(createProblemPostSchema), controller.createPost);
problemsRouter.get('/mine', authenticate, controller.listMine);

// Worker side — registered before the `/:id` routes so they aren't captured as an id.
problemsRouter.get('/nearby', authenticate, controller.listNearby);
problemsRouter.get('/assigned', authenticate, controller.listAssigned);

problemsRouter.patch('/:id', authenticate, validateBody(updateProblemPostSchema), controller.updatePost);
problemsRouter.post('/:id/photos', authenticate, upload.single('photo'), logUploadedFiles, controller.addPhoto);
problemsRouter.delete('/:id', authenticate, controller.deletePost);
problemsRouter.post('/:id/complete', authenticate, validateBody(completeProblemSchema), controller.complete);
problemsRouter.post('/:id/accept', authenticate, controller.accept);
problemsRouter.post('/:id/work-done', authenticate, controller.markWorkDone);

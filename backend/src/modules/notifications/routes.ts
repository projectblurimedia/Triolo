import { Router } from 'express';
import { pool } from '@/config/database';
import { authenticate } from '@/common/middleware/authenticate';
import { NotificationsController } from './controller';
import { NotificationsService } from './service';
import { NotificationsRepository } from './repository';

const repository = new NotificationsRepository(pool);
const service = new NotificationsService(repository);
const controller = new NotificationsController(service);

export const notificationsRouter = Router();

notificationsRouter.get('/', authenticate, controller.list);
notificationsRouter.patch('/:id/read', authenticate, controller.markRead);
notificationsRouter.post('/read-all', authenticate, controller.markAllRead);

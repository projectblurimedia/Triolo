import { Router } from 'express';
import { pool } from '@/config/database';
import { authenticate } from '@/common/middleware/authenticate';
import { validateBody } from '@/common/middleware/validate';
import { NotificationsController } from './controller';
import { NotificationsService } from './service';
import { NotificationsRepository } from './repository';
import { deleteNotificationsSchema, registerPushTokenSchema, unregisterPushTokenSchema } from './validation';

const repository = new NotificationsRepository(pool);
const service = new NotificationsService(repository);
const controller = new NotificationsController(service);

export const notificationsRouter = Router();

notificationsRouter.get('/', authenticate, controller.list);
notificationsRouter.patch('/:id/read', authenticate, controller.markRead);
notificationsRouter.post('/read-all', authenticate, controller.markAllRead);
notificationsRouter.post('/delete', authenticate, validateBody(deleteNotificationsSchema), controller.deleteMany);
notificationsRouter.patch('/push-token', authenticate, validateBody(registerPushTokenSchema), controller.registerPushToken);
// Logging out: this phone stops getting the account's notifications in that app.
notificationsRouter.post(
  '/push-token/remove',
  authenticate,
  validateBody(unregisterPushTokenSchema),
  controller.unregisterPushToken,
);
// Last, so it can never shadow a literal path above. A non-uuid id just matches nothing.
notificationsRouter.delete('/:id', authenticate, controller.deleteOne);

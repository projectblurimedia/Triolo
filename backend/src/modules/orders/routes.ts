import { Router } from 'express';
import { pool } from '@/config/database';
import { authenticate } from '@/common/middleware/authenticate';
import { validateBody } from '@/common/middleware/validate';
import { AppError } from '@/common/errors/AppError';
import { BusinessesRepository } from '@/modules/businesses/repository';
import { BusinessesService } from '@/modules/businesses/service';
import { NotificationsRepository } from '@/modules/notifications/repository';
import { NotificationsService } from '@/modules/notifications/service';
import { OrdersController } from './controller';
import { OrdersRepository } from './repository';
import { OrdersService } from './service';
import { createOrderSchema, rateOrderSchema, saveItemsSchema, shopCancelSchema, verifyOrderPinSchema } from './validation';

// Own instances over the shared pool — same wiring style as bookings/routes.ts.
const notificationsService = new NotificationsService(new NotificationsRepository(pool));
const businessesService = new BusinessesService(new BusinessesRepository(pool), notificationsService);
const controller = new OrdersController(new OrdersService(new OrdersRepository(pool), businessesService, notificationsService));

export const ordersRouter = Router();

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// A malformed id would otherwise reach Postgres as a bad uuid cast (500) — answer 404 instead.
ordersRouter.param('id', (_req, _res, next, id: string) => {
  next(UUID_PATTERN.test(id) ? undefined : AppError.notFound('Order not found.', 'ORDER_NOT_FOUND'));
});

// Shop side — registered before `/:id` so `shop` isn't captured as an order id.
ordersRouter.get('/shop/mine', authenticate, controller.listShop);
ordersRouter.get('/shop/:id', authenticate, controller.getShop);

// Customer side.
ordersRouter.post('/', authenticate, validateBody(createOrderSchema), controller.create);
ordersRouter.get('/mine', authenticate, controller.listMine);
ordersRouter.get('/:id', authenticate, controller.getMine);
ordersRouter.post('/:id/cancel', authenticate, controller.cancel);
ordersRouter.post('/:id/rate', authenticate, validateBody(rateOrderSchema), controller.rate);

// Shop steps.
ordersRouter.post('/:id/accept', authenticate, controller.accept);
ordersRouter.post('/:id/decline', authenticate, validateBody(shopCancelSchema), controller.decline);
ordersRouter.put('/:id/items', authenticate, validateBody(saveItemsSchema), controller.saveItems);
ordersRouter.post('/:id/packed', authenticate, controller.packed);
ordersRouter.post('/:id/ready', authenticate, controller.ready);
ordersRouter.post('/:id/verify-pin', authenticate, validateBody(verifyOrderPinSchema), controller.verifyPin);
ordersRouter.post('/:id/shop-cancel', authenticate, validateBody(shopCancelSchema), controller.shopCancel);

import { Router } from 'express';
import { SubscriptionsRepository } from '@/modules/subscriptions/repository';
import { SubscriptionStatusService } from '@/modules/subscriptions/statusService';
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
import { createOrderSchema, createQuickOrderSchema, customerCancelSchema, rateOrderSchema, saveItemsSchema, shopCancelSchema, verifyOrderPinSchema, assignDeliverySchema, staffLocationSchema } from './validation';

// Own instances over the shared pool — same wiring style as bookings/routes.ts.
const notificationsService = new NotificationsService(new NotificationsRepository(pool));
const businessesService = new BusinessesService(new BusinessesRepository(pool), notificationsService);
const subscriptionStatus = new SubscriptionStatusService(new SubscriptionsRepository(pool));
const controller = new OrdersController(
  new OrdersService(new OrdersRepository(pool), businessesService, notificationsService, subscriptionStatus),
);

export const ordersRouter = Router();

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// A malformed id would otherwise reach Postgres as a bad uuid cast (500) — answer 404 instead.
ordersRouter.param('id', (_req, _res, next, id: string) => {
  next(UUID_PATTERN.test(id) ? undefined : AppError.notFound('Order not found.', 'ORDER_NOT_FOUND'));
});

// Shop side — registered before `/:id` so `shop` isn't captured as an order id.
ordersRouter.get('/shop/mine', authenticate, controller.listShop);
// Delivery staff: the deliveries given to me, and handing one over with the customer's PIN.
ordersRouter.get('/staff/deliveries', authenticate, controller.listDeliveries);
ordersRouter.get('/staff/deliveries/:id', authenticate, controller.getDelivery);
ordersRouter.post('/staff/deliveries/:id/accept', authenticate, controller.staffAnswer(true));
ordersRouter.post('/staff/deliveries/:id/decline', authenticate, controller.staffAnswer(false));
ordersRouter.put('/staff/deliveries/:id/location', authenticate, validateBody(staffLocationSchema), controller.staffLocation);
ordersRouter.post('/staff/deliveries/:id/verify-pin', authenticate, validateBody(verifyOrderPinSchema), controller.staffVerifyPin);
ordersRouter.post('/shop/quick/search', authenticate, controller.searchQuick);
ordersRouter.get('/shop/:id', authenticate, controller.getShop);

// Customer side.
ordersRouter.post('/', authenticate, validateBody(createOrderSchema), controller.create);
// Quick Order: to every matching shop nearby at once (registered before /:id).
ordersRouter.post('/quick', authenticate, validateBody(createQuickOrderSchema), controller.createQuick);
ordersRouter.get('/mine', authenticate, controller.listMine);
ordersRouter.get('/:id', authenticate, controller.getMine);
ordersRouter.post('/:id/cancel', authenticate, validateBody(customerCancelSchema), controller.cancel);
ordersRouter.post('/:id/rate', authenticate, validateBody(rateOrderSchema), controller.rate);

// Shop steps.
ordersRouter.post('/:id/accept', authenticate, controller.accept);
ordersRouter.post('/:id/decline', authenticate, validateBody(shopCancelSchema), controller.decline);
ordersRouter.put('/:id/items', authenticate, validateBody(saveItemsSchema), controller.saveItems);
ordersRouter.post('/:id/packed', authenticate, controller.packed);
ordersRouter.post('/:id/ready', authenticate, controller.ready);
ordersRouter.post('/:id/verify-pin', authenticate, validateBody(verifyOrderPinSchema), controller.verifyPin);
// The owner sends a delivery with staff ({ staffAccountId }, or null to take it back).
ordersRouter.post('/:id/assign-delivery', authenticate, validateBody(assignDeliverySchema), controller.assignDelivery);
ordersRouter.post('/:id/shop-cancel', authenticate, validateBody(shopCancelSchema), controller.shopCancel);

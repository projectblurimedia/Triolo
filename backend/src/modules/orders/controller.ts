import { Request, Response } from 'express';
import { asyncHandler } from '@/common/utils/asyncHandler';
import { created, ok } from '@/common/utils/response';
import { AppError } from '@/common/errors/AppError';
import { OrdersService } from './service';

function requireAccountId(req: Request): string {
  if (!req.account) {
    throw AppError.unauthorized();
  }
  return req.account.accountId;
}

export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  // --- Delivery staff ---

  assignDelivery = asyncHandler(async (req: Request, res: Response) => {
    const staff = typeof req.body?.staffAccountId === 'string' ? req.body.staffAccountId : null;
    return ok(res, await this.service.assignDelivery(requireAccountId(req), req.params.id, staff));
  });

  listDeliveries = asyncHandler(async (req: Request, res: Response) => {
    return ok(res, await this.service.listMyDeliveries(requireAccountId(req)));
  });

  getDelivery = asyncHandler(async (req: Request, res: Response) => {
    return ok(res, await this.service.getMyDelivery(requireAccountId(req), req.params.id));
  });

  staffAnswer = (accept: boolean) =>
    asyncHandler(async (req: Request, res: Response) => {
      return ok(res, await this.service.answerDelivery(requireAccountId(req), req.params.id, accept), accept ? 'Accepted' : 'Declined');
    });

  staffLocation = asyncHandler(async (req: Request, res: Response) => {
    await this.service.updateStaffLocation(requireAccountId(req), req.params.id, req.body.latitude, req.body.longitude);
    return ok(res, null);
  });

  staffVerifyPin = asyncHandler(async (req: Request, res: Response) => {
    return ok(res, await this.service.staffVerifyPin(requireAccountId(req), req.params.id, req.body.pin), 'Delivered');
  });

  // --- Customer side ---

  create = asyncHandler(async (req: Request, res: Response) => {
    return created(res, await this.service.createOrder(requireAccountId(req), req.body), 'Order sent to the shop');
  });

  createQuick = asyncHandler(async (req: Request, res: Response) => {
    return created(res, await this.service.createQuickOrder(requireAccountId(req), req.body), 'Quick Order sent to shops nearby');
  });

  listMine = asyncHandler(async (req: Request, res: Response) => {
    return ok(res, await this.service.listMyOrders(requireAccountId(req)));
  });

  getMine = asyncHandler(async (req: Request, res: Response) => {
    return ok(res, await this.service.getOrder(requireAccountId(req), req.params.id));
  });

  cancel = asyncHandler(async (req: Request, res: Response) => {
    await this.service.cancelOrder(requireAccountId(req), req.params.id, req.body);
    return ok(res, null, 'Order cancelled');
  });

  rate = asyncHandler(async (req: Request, res: Response) => {
    await this.service.rateOrder(requireAccountId(req), req.params.id, req.body);
    return ok(res, null, 'Thanks for rating');
  });

  // --- Shop side ---

  listShop = asyncHandler(async (req: Request, res: Response) => {
    return ok(res, await this.service.listShopOrders(requireAccountId(req)));
  });

  searchQuick = asyncHandler(async (req: Request, res: Response) => {
    return ok(res, await this.service.searchOpenQuickOrders(requireAccountId(req)));
  });

  getShop = asyncHandler(async (req: Request, res: Response) => {
    return ok(res, await this.service.getShopOrder(requireAccountId(req), req.params.id));
  });

  accept = asyncHandler(async (req: Request, res: Response) => {
    await this.service.acceptOrder(requireAccountId(req), req.params.id);
    return ok(res, null, 'Order accepted');
  });

  decline = asyncHandler(async (req: Request, res: Response) => {
    await this.service.declineOrder(requireAccountId(req), req.params.id, req.body?.reason);
    return ok(res, null, 'Order declined');
  });

  saveItems = asyncHandler(async (req: Request, res: Response) => {
    return ok(res, await this.service.saveItems(requireAccountId(req), req.params.id, req.body), 'Items saved');
  });

  packed = asyncHandler(async (req: Request, res: Response) => {
    await this.service.markPacked(requireAccountId(req), req.params.id);
    return ok(res, null, 'Bill sent to the customer');
  });

  ready = asyncHandler(async (req: Request, res: Response) => {
    await this.service.markReady(requireAccountId(req), req.params.id);
    return ok(res, null, 'Order handed over for pickup/delivery');
  });

  verifyPin = asyncHandler(async (req: Request, res: Response) => {
    await this.service.verifyPin(requireAccountId(req), req.params.id, req.body.pin);
    return ok(res, null, 'Order completed');
  });

  shopCancel = asyncHandler(async (req: Request, res: Response) => {
    await this.service.cancelByShop(requireAccountId(req), req.params.id, req.body?.reason);
    return ok(res, null, 'Order cancelled');
  });
}

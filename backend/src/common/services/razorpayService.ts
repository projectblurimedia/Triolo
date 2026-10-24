import crypto from 'crypto';
import { AppError } from '@/common/errors/AppError';

// Razorpay's REST API, called directly (no SDK). RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are env
// vars: test keys (rzp_test_…) until the account is approved, then live ones — nothing else
// changes. Amounts are in paise.
const API = 'https://api.razorpay.com/v1';

function credentials(): { keyId: string; keySecret: string } {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new AppError(503, 'PAYMENTS_NOT_CONFIGURED', 'Online payment is not set up yet. Please try again later.');
  }
  return { keyId, keySecret };
}

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const { keyId, keySecret } = credentials();
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await response.json().catch(() => ({}))) as { error?: { description?: string } } & T;
  if (!response.ok) {
    throw new AppError(502, 'PAYMENT_PROVIDER_ERROR', json.error?.description ?? 'The payment service did not answer. Please try again.');
  }
  return json;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

export interface RazorpayPayment {
  id: string;
  order_id: string | null;
  amount: number;
  currency: string;
  /** created → authorized → captured (or failed / refunded). */
  status: string;
  method?: string;
}

export interface RazorpayPaymentLink {
  id: string;
  short_url: string;
  /** created → paid (or partially_paid / expired / cancelled). */
  status: string;
  amount: number;
  amount_paid: number;
  payments?: { payment_id: string; amount: number; status: string }[] | null;
}

export const razorpayService = {
  keyId(): string {
    return credentials().keyId;
  },

  createOrder(amountPaise: number, receipt: string, notes: Record<string, string>): Promise<RazorpayOrder> {
    return call<RazorpayOrder>('POST', '/orders', { amount: amountPaise, currency: 'INR', receipt, notes });
  },

  async orderPayments(orderId: string): Promise<RazorpayPayment[]> {
    return (await call<{ items: RazorpayPayment[] }>('GET', `/orders/${orderId}/payments`)).items ?? [];
  },

  payment(paymentId: string): Promise<RazorpayPayment> {
    return call<RazorpayPayment>('GET', `/payments/${paymentId}`);
  },

  /** Takes the money of an authorized payment (when the account doesn't capture automatically). */
  capture(paymentId: string, amountPaise: number): Promise<RazorpayPayment> {
    return call<RazorpayPayment>('POST', `/payments/${paymentId}/capture`, { amount: amountPaise, currency: 'INR' });
  },

  refund(paymentId: string, amountPaise: number, notes: Record<string, string>): Promise<{ id: string }> {
    return call<{ id: string }>('POST', `/payments/${paymentId}/refund`, { amount: amountPaise, notes });
  },

  /**
   * A payment link (the apps open it in the phone's browser, where UPI apps work), for
   * `amountPaise`. `referenceId` (≤ 40 characters, unique) ties it to what's being paid for.
   */
  createPaymentLink(params: {
    amountPaise: number;
    description: string;
    referenceId: string;
    customer: { name: string; contact: string };
    notes: Record<string, string>;
  }): Promise<RazorpayPaymentLink> {
    return call<RazorpayPaymentLink>('POST', '/payment_links', {
      amount: params.amountPaise,
      currency: 'INR',
      accept_partial: false,
      description: params.description.slice(0, 2048),
      reference_id: params.referenceId.slice(0, 40),
      customer: { name: params.customer.name, contact: `+91${params.customer.contact.replace(/\D/g, '').slice(-10)}` },
      notify: { sms: false, email: false },
      reminder_enable: false,
      notes: params.notes,
    });
  },

  paymentLink(id: string): Promise<RazorpayPaymentLink> {
    return call<RazorpayPaymentLink>('GET', `/payment_links/${id}`);
  },

  /** The captured payment of a paid link, for the full amount — or null when it isn't paid. */
  async paidLinkPayment(id: string, amountPaise: number): Promise<string | null> {
    const link = await razorpayService.paymentLink(id);
    if (link.status !== 'paid' || Number(link.amount_paid) < amountPaise) return null;
    const payment = (link.payments ?? []).find((item) => item.status === 'captured') ?? link.payments?.[0];
    return payment?.payment_id ?? null;
  },

  /** Checkout's signature: HMAC-SHA256 of "order_id|payment_id" with the key secret. */
  signatureValid(orderId: string, paymentId: string, signature: string): boolean {
    const expected = crypto.createHmac('sha256', credentials().keySecret).update(`${orderId}|${paymentId}`).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature ?? '');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  },
};

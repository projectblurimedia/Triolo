import { adsApi, Ad } from '@/services/adsApi';

// Razorpay's own checkout (UPI, cards, net banking), loaded only when someone pays.
const SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

interface CheckoutSuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open(): void;
  on(event: 'payment.failed', handler: (response: { error?: { description?: string } }) => void): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

let loading: Promise<void> | null = null;

function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      reject(new Error('The payment window could not load. Check your internet and try again.'));
    };
    document.body.appendChild(script);
  });
  return loading;
}

/**
 * Pays for one booked ad: opens a Razorpay order on the server, shows Razorpay's checkout, and
 * has the server verify and record the payment. Resolves with the updated ad, or null when the
 * person closed the checkout without paying.
 */
export async function payForAd(ad: Ad, prefill: { name?: string; contact?: string }): Promise<Ad | null> {
  const [order] = await Promise.all([adsApi.startPayment(ad.id), loadCheckout()]);
  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new Error('The payment window could not load. Try again.');

  const result = await new Promise<CheckoutSuccess | null>((resolve, reject) => {
    const checkout = new Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: 'Triolo Ads',
      description: order.description,
      prefill: { name: prefill.name, contact: prefill.contact },
      theme: { color: '#0055D3' },
      handler: (response: CheckoutSuccess) => resolve(response),
      modal: { ondismiss: () => resolve(null), confirm_close: true },
    });
    checkout.on('payment.failed', (response) =>
      reject(new Error(response.error?.description ?? 'The payment failed. No money was taken — try again.')),
    );
    checkout.open();
  });
  if (!result) return null;
  return adsApi.confirmPayment(ad.id, {
    razorpayOrderId: result.razorpay_order_id,
    razorpayPaymentId: result.razorpay_payment_id,
    razorpaySignature: result.razorpay_signature,
  });
}

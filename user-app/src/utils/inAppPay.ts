import { NativeModules, TurboModuleRegistry } from 'react-native';
import { apiClient } from '@/services/apiClient';

/*
 * (Copied between user-app and partner-app — keep in sync.)
 *
 * Paying inside the app with Razorpay's own screen, which lists the UPI apps on the phone
 * (PhonePe, Google Pay, Paytm…) and comes back here when done — no browser. Needs the Razorpay
 * native module (the new app builds); older installs keep opening the payment page.
 */

export type InAppPayTarget =
  | { type: 'pass' | 'subscription' | 'badge'; id: string }
  /** A boost (an ad booked from the partner app). */
  | { type: 'boost'; id: string };

interface InAppOrder {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  description: string;
  prefill?: { name?: string; contact?: string };
}

/** Whether this install can pay in-app (has the Razorpay native module). */
export function canPayInApp(): boolean {
  try {
    return !!(TurboModuleRegistry.get('RNRazorpayCheckout') ?? NativeModules.RNRazorpayCheckout);
  } catch {
    return !!NativeModules.RNRazorpayCheckout;
  }
}

/**
 * Pays for the target in-app. 'paid' once the server confirmed it; 'cancelled' when the person
 * closed Razorpay's screen (nothing was taken); 'unavailable' on an install without the module
 * (the caller opens the payment page instead).
 */
export async function payInApp(target: InAppPayTarget): Promise<'paid' | 'cancelled' | 'unavailable'> {
  if (!canPayInApp()) return 'unavailable';
  const order =
    target.type === 'boost'
      ? await apiClient.post<InAppOrder>(`/ads/self/${target.id}/pay`, undefined, true)
      : await apiClient.post<InAppOrder>('/subscriptions/pay/order', target, true);
  // Loaded only here, so installs without the native module never touch it.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RazorpayCheckout = require('react-native-razorpay').default as {
    open: (options: Record<string, unknown>) => Promise<{ razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }>;
  };
  let result: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
  try {
    result = await RazorpayCheckout.open({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency || 'INR',
      name: 'NearbyU',
      description: order.description,
      prefill: order.prefill ? { name: order.prefill.name, contact: order.prefill.contact } : undefined,
      theme: { color: '#0055D3' },
      // UPI first (the phone's UPI apps), then cards, net banking and the rest.
      config: {
        display: {
          blocks: { upi: { name: 'Pay with UPI', instruments: [{ method: 'upi' }] } },
          sequence: ['block.upi'],
          preferences: { show_default_blocks: true },
        },
      },
    });
  } catch {
    return 'cancelled';
  }
  const proof = {
    razorpayOrderId: result.razorpay_order_id,
    razorpayPaymentId: result.razorpay_payment_id,
    razorpaySignature: result.razorpay_signature,
  };
  if (target.type === 'boost') await apiClient.post(`/ads/self/${target.id}/pay/confirm`, proof, true);
  else await apiClient.post('/subscriptions/pay/confirm', { ...target, ...proof }, true);
  return 'paid';
}

import { WorkerProfile } from '@/services/workersService';
import { BusinessProfile } from '@/services/businessesService';

export type AuthStackParamList = {
  Welcome: undefined;
  // Capability-specific, not a generic "Register" screen — each combines Full Name/Mobile
  // Number (with inline OTP verification) and that capability's own fields into one form.
  // See RegisterWorkerScreen's own doc comment for the full rationale.
  RegisterWorker: undefined;
  RegisterBusiness: undefined;
  Login: undefined;
  Otp: { mode: 'login'; mobileNumber: string };
};

export type CapabilityType = 'worker' | 'business';

export type MainStackParamList = {
  ChooseCapability: undefined;
  MainTabs: undefined;
  // `profile` present switches the screen into edit mode (prefilled, PATCH instead of POST,
  // plus a delete action) — omitted (or undefined) for create. Passed as the already-fetched
  // profile object rather than just an id, since every entry point already has it in hand.
  WorkerRegistration: { profile?: WorkerProfile } | undefined;
  BusinessRegistration: { profile?: BusinessProfile } | undefined;
  MyInfo: { capability: CapabilityType };
};

/**
 * The verified-partner tab shell — nested inside MainStackParamList's `MainTabs` screen, so
 * its screens can still reach sibling stack routes (WorkerRegistration/BusinessRegistration/
 * MyInfo) via the composite navigation prop. Bookings and Earnings are the two concretely
 * planned near-term features for a Worker/Business partner (see .cloud/project-context.md's
 * roadmap — the booking/order-flow pipeline and the post-MVP worker earnings dashboard), so
 * they replace a generic unexplained "Search" tab that didn't map to anything a partner
 * actually does in this product.
 */
export type MainTabParamList = {
  Home: undefined;
  Bookings: undefined;
  Earnings: undefined;
  Profile: undefined;
};

import { NavigatorScreenParams } from '@react-navigation/native';
import { WorkerProfile } from '@/services/workersService';
import { BusinessProfile } from '@/services/businessesService';

export type AuthStackParamList = {
  Welcome: undefined;
  // Capability-specific, not a generic "Register" screen — each combines Full Name/Mobile
  // Number (with inline OTP verification) and that capability's own fields into one form.
  // See RegisterWorkerScreen's own doc comment for the full rationale.
  RegisterWorker: undefined;
  RegisterBusiness: undefined;
  RegisterJobSeeker: undefined;
  Login: undefined;
  Otp: { mode: 'login'; mobileNumber: string };
};

export type CapabilityType = 'worker' | 'business';

export type MainStackParamList = {
  ChooseCapability: undefined;
  // NavigatorScreenParams (not plain `undefined`) so `navigationRef.navigate('MainTabs', {
  // screen: 'Bookings' })` is valid and correctly typed — needed to jump straight to a
  // specific tab (e.g. from a Quick Book push notification tap) rather than whichever tab
  // happened to be active last. See navigation/navigationRef.ts.
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  // `profile` present switches the screen into edit mode (prefilled, PATCH instead of POST,
  // plus a delete action) — omitted (or undefined) for create. Passed as the already-fetched
  // profile object rather than just an id, since every entry point already has it in hand.
  WorkerRegistration: { profile?: WorkerProfile } | undefined;
  BusinessRegistration: { profile?: BusinessProfile } | undefined;
  /** `postId`: which job post (a partner may keep several). */
  MyInfo: { capability: CapabilityType | 'job'; postId?: string };
  // Create or edit the "looking for work" post (no admin review, so no verification state).
  /** Edit that post; without one, make a new post. */
  JobPost: { postId?: string } | undefined;
};

/**
 * The verified-partner tab shell — nested inside MainStackParamList's `MainTabs` screen, so
 * its screens can still reach sibling stack routes (WorkerRegistration/BusinessRegistration/
 * MyInfo) via the composite navigation prop. Home (what's new and what's in progress), Bookings
 * (requests, active, history), Grow (Partner Plus, Trusted badge, Boost) and Profile.
 */
export type MainTabParamList = {
  Home: undefined;
  // `mode` opens a dual (worker + shop) partner's Bookings on that side; `linkedAt` makes a
  // repeat navigation with the same mode still apply after the user switched sides by hand.
  Bookings:
    | {
        mode?: 'jobs' | 'orders';
        tab?: 'requests' | 'active' | 'history';
        /** Shop Orders' list to open on (Home's New orders / In progress cards). */
        orderTab?: 'new' | 'active' | 'history';
        linkedAt?: number;
      }
    | undefined;
  Grow: undefined;
  Profile: undefined;
};

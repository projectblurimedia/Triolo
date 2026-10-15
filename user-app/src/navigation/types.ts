export type AuthStackParamList = {
  Welcome: undefined;
  // No role param — every self-registered account is a plain `user`; Worker/Business
  // are optional capabilities added later via Home's menu, not chosen at registration.
  Register: undefined;
  Login: undefined;
  Otp: { mode: 'registration' | 'login'; mobileNumber: string };
};

export type MainTabParamList = {
  Home: undefined;
  /** Optional deep link from Home's Browse Services tiles — preselects a category chip. */
  Services: { category?: string; linkedAt?: number } | undefined;
  /** `newList` (a timestamp) opens a fresh list in the editor, e.g. from Send List with no lists. */
  PrepareList: { newList?: number } | undefined;
  Bazaar: undefined;
  Profile: undefined;
};

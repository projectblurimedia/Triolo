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
  Services: undefined;
  Bazaar: undefined;
  Profile: undefined;
};

export type AuthStackParamList = {
  Welcome: undefined;
  Register: undefined;
  Login: undefined;
  Otp: { mode: 'registration' | 'login'; mobileNumber: string };
};

export type CapabilityType = 'worker' | 'business';

export type MainStackParamList = {
  ChooseCapability: undefined;
  WorkerRegistration: undefined;
  BusinessRegistration: undefined;
  MyInfo: { capability: CapabilityType };
};

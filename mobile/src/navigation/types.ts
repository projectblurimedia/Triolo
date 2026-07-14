import { AccountRole } from '@/state/authStore';

export type AuthStackParamList = {
  Welcome: undefined;
  Register: { role: AccountRole };
  Login: undefined;
  Otp: { mode: 'registration' | 'login'; mobileNumber: string };
};

export type AppStackParamList = {
  Home: undefined;
};

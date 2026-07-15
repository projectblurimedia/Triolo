import { AccountRole } from '@/state/authStore';

export type AuthStackParamList = {
  Welcome: undefined;
  Register: { role: AccountRole };
  Login: undefined;
  Otp: { mode: 'registration' | 'login'; mobileNumber: string };
};

export type MainTabParamList = {
  Home: undefined;
  Search: undefined;
  Bazaar: undefined;
  Profile: undefined;
};

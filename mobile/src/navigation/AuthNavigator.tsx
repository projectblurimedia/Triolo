import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthStackParamList } from './types';
import { WelcomeScreen } from '@/screens/auth/WelcomeScreen';
import { RegisterScreen } from '@/screens/auth/RegisterScreen';
import { LoginScreen } from '@/screens/auth/LoginScreen';
import { OtpScreen } from '@/screens/auth/OtpScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: true, title: '' }} />
      <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: true, title: '' }} />
      <Stack.Screen name="Otp" component={OtpScreen} options={{ headerShown: true, title: '' }} />
    </Stack.Navigator>
  );
}

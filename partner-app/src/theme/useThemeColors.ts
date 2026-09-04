import { useColorScheme } from 'react-native';
import { useThemeStore } from '@/state/themeStore';
import { darkColors, lightColors, ThemeColors } from './colors';

interface UseThemeColorsResult {
  colors: ThemeColors;
  /** Resolved scheme — 'system' mode is already resolved against the device here. */
  scheme: 'light' | 'dark';
  isDark: boolean;
}

/** Resolves the user's theme choice (system/light/dark) against the device scheme, reactively. */
export function useThemeColors(): UseThemeColorsResult {
  const mode = useThemeStore((state) => state.mode);
  const deviceScheme = useColorScheme();

  const scheme: 'light' | 'dark' = mode === 'system' ? (deviceScheme === 'dark' ? 'dark' : 'light') : mode;

  return {
    colors: scheme === 'dark' ? darkColors : lightColors,
    scheme,
    isDark: scheme === 'dark',
  };
}

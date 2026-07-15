/**
 * Brand colors stay constant across light/dark — only background/text (and the
 * surface/border/textMuted shades derived to stay readable against them) change
 * per theme. See useThemeColors() and .cloud/architecture.md.
 */
const brand = {
  primary: '#1d9bf0',
  primaryLight: '#1D76FA',
  secondary: '#F59E0B',
  success: '#16A34A',
  warning: '#D97706',
  error: '#DC2626',
  white: '#FFFFFF',
} as const;

export interface ThemeColors {
  primary: string;
  primaryLight: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  white: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
}

export const lightColors: ThemeColors = {
  ...brand,
  background: '#ECEDEE',
  surface: '#FFFFFF',
  text: '#0c0f14',
  textMuted: '#5B6472',
  border: '#D8DADD',
};

export const darkColors: ThemeColors = {
  ...brand,
  background: '#0c0f14',
  surface: '#1A1F27',
  text: '#ECEDEE',
  textMuted: '#9AA3AF',
  border: '#2A303B',
};

/** Non-theme-dependent brand colors, for styles that never change with light/dark. */
export const colors = brand;

/** Brand gradient used on all headers — constant across themes by design. */
export const headerGradient = ['#0055D3', '#1D76FA'] as const;

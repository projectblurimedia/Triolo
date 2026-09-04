/** Same brand tokens as user-app/partner-app's theme/colors.ts — kept in sync manually (no shared package, see .cloud/architecture.md). */
export const colors = {
  primary: '#0055D3',
  primaryLight: '#1D76FA',
  secondary: '#F59E0B',
  success: '#16A34A',
  warning: '#D97706',
  error: '#DC2626',
  white: '#FFFFFF',
  background: '#F9FCFF',
  surface: '#F2F8FF',
  text: '#0C0F14',
  textMuted: '#5B6472',
  border: '#D8DADD',
} as const;

export const headerGradient = `linear-gradient(135deg, ${colors.primary}, ${colors.primaryLight})`;
export const logoutGradient = 'linear-gradient(135deg, #ef4444, #dc2626)';

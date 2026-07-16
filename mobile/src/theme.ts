// Small shared palette — mirrors the web app's slate/indigo look. Screens read
// these constants directly; the app follows a single (light) theme for the MVP.
export const colors = {
  bg: '#f8fafc',
  card: '#ffffff',
  border: '#e2e8f0',
  text: '#0f172a',
  muted: '#64748b',
  faint: '#94a3b8',
  primary: '#4f46e5',
  primaryText: '#ffffff',
  danger: '#dc2626',
  warnBg: '#fffbeb',
  warnText: '#92400e',
  success: '#059669',
};

export const priorityColor: Record<string, string> = {
  high: '#dc2626',
  medium: '#d97706',
  low: '#64748b',
};

export const radius = 12;
export const spacing = 16;

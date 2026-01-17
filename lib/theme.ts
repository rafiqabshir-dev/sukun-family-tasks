export const colors = {
  primary: "#0D9488",
  primaryLight: "#14B8A6",
  primaryDark: "#0F766E",
  secondary: "#F59E0B",
  secondaryLight: "#FBBF24",
  background: "#FDF7F2",
  surface: "#FFFFFF",
  surfaceSecondary: "#F5F0EB",
  text: "#1F2937",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",
  border: "#E5E7EB",
  success: "#10B981",
  error: "#EF4444",
  warning: "#F59E0B",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const fontWeight = {
  normal: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
};

export const theme = {
  colors: {
    ...colors,
    danger: colors.error,
    dangerLight: "#FEE2E2",
  },
  spacing,
  radius: borderRadius,
  fontSize,
  fontWeight,
};

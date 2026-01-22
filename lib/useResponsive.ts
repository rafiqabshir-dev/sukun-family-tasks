import { useWindowDimensions } from 'react-native';

export interface ResponsiveValues {
  isTablet: boolean;
  isLargeTablet: boolean;
  screenWidth: number;
  screenHeight: number;
  contentMaxWidth: number;
  horizontalPadding: number;
  fontSize: {
    small: number;
    medium: number;
    large: number;
    xlarge: number;
    title: number;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  cardWidth: number;
  columns: number;
}

export function useResponsive(): ResponsiveValues {
  const { width, height } = useWindowDimensions();
  
  const isTablet = width >= 768;
  const isLargeTablet = width >= 1024;
  
  const contentMaxWidth = isLargeTablet ? 900 : isTablet ? 700 : width;
  const horizontalPadding = isTablet ? 32 : 16;
  
  const fontScale = isTablet ? 1.15 : 1;
  
  const fontSize = {
    small: Math.round(12 * fontScale),
    medium: Math.round(14 * fontScale),
    large: Math.round(16 * fontScale),
    xlarge: Math.round(20 * fontScale),
    title: Math.round(24 * fontScale),
  };
  
  const spacingScale = isTablet ? 1.25 : 1;
  
  const spacing = {
    xs: Math.round(4 * spacingScale),
    sm: Math.round(8 * spacingScale),
    md: Math.round(16 * spacingScale),
    lg: Math.round(24 * spacingScale),
    xl: Math.round(32 * spacingScale),
  };
  
  const columns = isLargeTablet ? 3 : isTablet ? 2 : 1;
  const cardWidth = isTablet 
    ? (contentMaxWidth - horizontalPadding * 2 - spacing.md * (columns - 1)) / columns
    : width - horizontalPadding * 2;
  
  return {
    isTablet,
    isLargeTablet,
    screenWidth: width,
    screenHeight: height,
    contentMaxWidth,
    horizontalPadding,
    fontSize,
    spacing,
    cardWidth,
    columns,
  };
}

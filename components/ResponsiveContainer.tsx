import { View, StyleSheet, ViewStyle } from 'react-native';
import { useResponsive } from '@/lib/useResponsive';

interface ResponsiveContainerProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function ResponsiveContainer({ children, style }: ResponsiveContainerProps) {
  const { isTablet, contentMaxWidth, horizontalPadding } = useResponsive();
  
  return (
    <View style={[styles.wrapper, style]}>
      <View 
        style={[
          styles.content,
          isTablet && {
            maxWidth: contentMaxWidth,
            paddingHorizontal: horizontalPadding,
          }
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: 'center',
  },
  content: {
    flex: 1,
    width: '100%',
  },
});

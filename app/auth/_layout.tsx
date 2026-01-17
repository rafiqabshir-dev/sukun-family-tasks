import { Stack } from 'expo-router';
import { theme } from '../../lib/theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.background,
        },
        headerTintColor: theme.colors.text,
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="sign-in"
        options={{
          title: 'Sign In',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="sign-up"
        options={{
          title: 'Create Account',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="family-setup"
        options={{
          title: 'Family Setup',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="pending-approval"
        options={{
          title: 'Request Pending',
          headerShown: false,
        }}
      />
    </Stack>
  );
}

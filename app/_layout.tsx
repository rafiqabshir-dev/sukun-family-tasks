import { useEffect } from "react";
import { Slot, Stack, useSegments, router, useRootNavigationState } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useStore } from "@/lib/store";
import { colors } from "@/lib/theme";
import { AuthProvider, useAuth } from "@/lib/authContext";

function useProtectedRoute(session: any, family: any, loading: boolean, isReady: boolean, isConfigured: boolean, pendingJoinRequest: any) {
  const segments = useSegments();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    if (!navigationState?.key) return;
    if (loading || !isReady) return;

    if (!isConfigured) {
      return;
    }

    const inAuthGroup = segments[0] === 'auth';
    const currentRoute = segments.join('/');

    if (!session && !inAuthGroup) {
      router.replace('/auth/sign-in');
    } else if (session && !family && pendingJoinRequest && currentRoute !== 'auth/pending-approval') {
      // User has a pending join request - route directly to pending-approval
      router.replace('/auth/pending-approval');
    } else if (session && !family && !pendingJoinRequest && !inAuthGroup) {
      router.replace('/auth/family-setup');
    } else if (session && family && inAuthGroup) {
      router.replace('/(tabs)/today');
    }
  }, [session, family, segments, loading, isReady, isConfigured, navigationState?.key, pendingJoinRequest]);
}

function RootLayoutContent() {
  const initialize = useStore((s) => s.initialize);
  const isReady = useStore((s) => s.isReady);
  const { session, family, loading: authLoading, isConfigured, pendingJoinRequest } = useAuth();

  useEffect(() => {
    initialize();
  }, []);

  useProtectedRoute(session, family, authLoading, isReady, isConfigured, pendingJoinRequest);

  if (!isReady || authLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
        <StatusBar style="dark" />
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="onboarding" options={{ presentation: "fullScreenModal" }} />
        <Stack.Screen name="member/[id]" options={{ presentation: "card" }} />
      </Stack>
      <StatusBar style="dark" />
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutContent />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
});

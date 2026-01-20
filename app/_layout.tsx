import { useEffect, useRef } from "react";
import { Stack, useRootNavigationState, router, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, StyleSheet, Text } from "react-native";
import { useStore } from "@/lib/store";
import { colors } from "@/lib/theme";
import { AuthProvider, useAuth } from "@/lib/authContext";
import { PushNotificationProvider } from "@/lib/pushNotificationContext";
import { resolveRoute, shouldNavigate, AuthState, UNPROTECTED_ROUTES } from "@/lib/navigation";

function NavigationController() {
  const navigationState = useRootNavigationState();
  const pathname = usePathname();
  const lastNavigatedPath = useRef<string | null>(null);
  
  const isReady = useStore((s) => s.isReady);
  const storeAuthReady = useStore((s) => s.authReady);
  const { 
    session, 
    profile, 
    family, 
    loading: authLoading, 
    isConfigured,
    pendingJoinRequest
  } = useAuth();

  useEffect(() => {
    if (!navigationState?.key) return;
    if (!isConfigured) return;
    
    const authState: AuthState = {
      session: !!session,
      profile: profile ? {
        id: profile.id,
        role: profile.role,
        passcode: profile.passcode,
        family_id: profile.family_id,
      } : null,
      family: family ? {
        id: family.id,
      } : null,
      pendingJoinRequest: !!pendingJoinRequest,
      authReady: storeAuthReady,
      storeReady: isReady,
    };

    const result = resolveRoute(authState);
    
    if (!result) {
      return;
    }

    // Only skip navigation if:
    // 1. We're on an unprotected route AND
    // 2. The resolved route is the same unprotected route (or another unprotected route)
    // This allows logged-in users to be navigated FROM sign-in TO the main app
    const onUnprotectedRoute = UNPROTECTED_ROUTES.some(route => pathname.startsWith(route));
    const resultIsUnprotected = UNPROTECTED_ROUTES.some(route => result.path.startsWith(route));
    
    if (onUnprotectedRoute && resultIsUnprotected) {
      return;
    }

    if (shouldNavigate(pathname, result.path) && lastNavigatedPath.current !== result.path) {
      lastNavigatedPath.current = result.path;
      router.replace(result.path);
    }
  }, [
    session, 
    profile, 
    family, 
    pendingJoinRequest, 
    storeAuthReady, 
    isReady, 
    isConfigured, 
    navigationState?.key, 
    pathname
  ]);

  return null;
}

function RootLayoutContent() {
  const initialize = useStore((s) => s.initialize);
  const isReady = useStore((s) => s.isReady);
  const storeAuthReady = useStore((s) => s.authReady);
  const { loading: authLoading } = useAuth();

  useEffect(() => {
    initialize();
  }, []);

  // Use store's authReady (persists across remounts) but also gate on authLoading
  // to prevent protected-view flicker during active authentication
  const showLoading = !isReady || authLoading || !storeAuthReady;
  
  console.log('[Layout] showLoading:', showLoading, 'isReady:', isReady, 'authLoading:', authLoading, 'storeAuthReady:', storeAuthReady);

  if (showLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 10, color: colors.textMuted }}>Loading...</Text>
        <StatusBar style="dark" />
      </View>
    );
  }

  console.log('[Layout] Rendering main content');
  
  return (
    <>
      <NavigationController />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="member/[id]" options={{ presentation: "card" }} />
      </Stack>
      <StatusBar style="dark" />
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <PushNotificationProvider>
        <RootLayoutContent />
      </PushNotificationProvider>
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

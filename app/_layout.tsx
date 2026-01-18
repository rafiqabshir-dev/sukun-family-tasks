import { useEffect, useRef } from "react";
import { Stack, useRootNavigationState, router, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useStore } from "@/lib/store";
import { colors } from "@/lib/theme";
import { AuthProvider, useAuth } from "@/lib/authContext";
import { resolveRoute, shouldNavigate, AuthState, UNPROTECTED_ROUTES } from "@/lib/navigation";

function NavigationController() {
  const navigationState = useRootNavigationState();
  const pathname = usePathname();
  const lastNavigatedPath = useRef<string | null>(null);
  
  const isReady = useStore((s) => s.isReady);
  const { 
    session, 
    profile, 
    family, 
    loading: authLoading, 
    isConfigured,
    pendingJoinRequest, 
    authReady 
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
      authReady: authReady,
      storeReady: isReady,
    };

    const result = resolveRoute(authState);
    
    if (!result) {
      return;
    }

    if (UNPROTECTED_ROUTES.some(route => pathname.startsWith(route))) {
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
    authReady, 
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
  const { loading: authLoading, authReady } = useAuth();

  useEffect(() => {
    initialize();
  }, []);

  const showLoading = !isReady || authLoading || !authReady;

  if (showLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
        <StatusBar style="dark" />
      </View>
    );
  }

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

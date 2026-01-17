import { useEffect } from "react";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useStore } from "@/lib/store";
import { colors } from "@/lib/theme";
import { AuthProvider, useAuth } from "@/lib/authContext";

function RootLayoutContent() {
  const initialize = useStore((s) => s.initialize);
  const isReady = useStore((s) => s.isReady);
  const { session, profile, family, loading: authLoading } = useAuth();

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    if (!authLoading && isReady) {
      if (!session) {
        router.replace("/auth/sign-in");
      } else if (!family) {
        router.replace("/auth/family-setup");
      }
    }
  }, [session, family, authLoading, isReady]);

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

import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/authContext";
import { colors } from "@/lib/theme";

export default function Index() {
  const onboardingComplete = useStore((s) => s.onboardingComplete);
  const isReady = useStore((s) => s.isReady);
  const { session, family, loading, isConfigured, pendingJoinRequest } = useAuth();

  // Wait for both store and auth to be ready
  if (!isReady || loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // If Supabase is configured, check auth state FIRST (don't rely on local cache)
  if (isConfigured) {
    // No session = go to sign in
    if (!session) {
      return <Redirect href="/auth/sign-in" />;
    }
    
    // Has session but pending join request = go to pending approval
    if (session && !family && pendingJoinRequest) {
      return <Redirect href="/auth/pending-approval" />;
    }
    
    // Has session but no family = go to family setup
    if (session && !family) {
      return <Redirect href="/auth/family-setup" />;
    }
    
    // Has session AND family = go to today (skip onboarding check)
    return <Redirect href="/(tabs)/today" />;
  }

  // Offline/local mode only: check local onboarding flag
  if (!onboardingComplete) {
    return <Redirect href="/onboarding" />;
  }

  // Offline mode with completed onboarding = go to today
  return <Redirect href="/(tabs)/today" />;
}

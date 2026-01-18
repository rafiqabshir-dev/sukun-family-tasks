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

  // If onboarding not complete, go to onboarding
  if (!onboardingComplete) {
    return <Redirect href="/onboarding" />;
  }

  // If Supabase is configured, check auth state
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
  }

  // Authenticated with family (or offline mode) = go to today
  return <Redirect href="/(tabs)/today" />;
}

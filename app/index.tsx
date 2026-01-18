import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/authContext";
import { colors } from "@/lib/theme";
import { resolveRoute, AuthState } from "@/lib/navigation";

export default function Index() {
  const isReady = useStore((s) => s.isReady);
  const { session, profile, family, loading, authReady, pendingJoinRequest } = useAuth();

  if (!isReady || loading || !authReady) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const authState: AuthState = {
    session: !!session,
    profile: profile ? {
      id: profile.id,
      role: profile.role,
      passcode: profile.passcode,
      family_id: profile.family_id,
    } : null,
    family: family ? { id: family.id } : null,
    pendingJoinRequest: !!pendingJoinRequest,
    authReady: authReady,
    storeReady: isReady,
  };

  const result = resolveRoute(authState);
  
  if (result) {
    return <Redirect href={result.path as any} />;
  }

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

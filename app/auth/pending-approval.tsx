import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius, fontSize } from "@/lib/theme";
import { useAuth } from "@/lib/authContext";
import { useStore } from "@/lib/store";
import { useState, useEffect } from "react";

export default function PendingApprovalScreen() {
  const router = useRouter();
  const { 
    profile, 
    family,
    pendingJoinRequest, 
    requestedFamily, 
    cancelJoinRequest, 
    refreshProfile,
    signOut 
  } = useAuth();
  const participantPasscode = useStore((s) => s.participantPasscode);
  const [cancelling, setCancelling] = useState(false);
  const [checking, setChecking] = useState(false);
  
  // Use passcode from profile or from store (store is set during signup as fallback)
  const displayPasscode = profile?.passcode || participantPasscode;

  // Refresh profile immediately on mount to get latest data (including passcode)
  useEffect(() => {
    console.log('[PendingApproval] Mount - profile:', profile?.display_name, 'passcode:', profile?.passcode, 'storePasscode:', participantPasscode, 'role:', profile?.role);
    refreshProfile();
  }, []);

  // Log profile changes
  useEffect(() => {
    console.log('[PendingApproval] Profile updated - passcode:', profile?.passcode, 'storePasscode:', participantPasscode, 'displayPasscode:', displayPasscode, 'role:', profile?.role);
  }, [profile, participantPasscode, displayPasscode]);

  useEffect(() => {
    const interval = setInterval(async () => {
      setChecking(true);
      await refreshProfile();
      setChecking(false);
    }, 10000);

    return () => clearInterval(interval);
  }, [refreshProfile]);

  const handleCancel = async () => {
    setCancelling(true);
    const { error } = await cancelJoinRequest();
    setCancelling(false);
    
    if (!error) {
      router.replace("/auth/family-setup");
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace("/auth/sign-in");
  };

  const handleCheckStatus = async () => {
    setChecking(true);
    await refreshProfile();
    setChecking(false);
  };

  // For participants without loaded request data, show a waiting screen
  // instead of infinite spinner
  if (!pendingJoinRequest || !requestedFamily) {
    // If user is a kid/participant, show a helpful waiting message
    if (profile?.role === 'kid') {
      return (
        <SafeAreaView style={styles.container}>
          <Text style={styles.headerTitle}>Waiting for Approval</Text>
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <Ionicons name="hourglass-outline" size={64} color={colors.primary} />
            </View>
            <Text style={styles.title}>Almost There!</Text>
            <Text style={styles.message}>
              Your request to join your family is being processed.
            </Text>
            <Text style={styles.subMessage}>
              A guardian needs to approve your request. Check back soon!
            </Text>
            
            {displayPasscode && (
              <View style={styles.passcodeReminder}>
                <Text style={styles.passcodeLabel}>Your Login Code</Text>
                <View style={styles.passcodeBox}>
                  <Text style={styles.passcodeText}>{displayPasscode}</Text>
                </View>
                <Text style={styles.passcodeHint}>Remember this code to log in!</Text>
              </View>
            )}
            
            <TouchableOpacity
              style={styles.checkButton}
              onPress={handleCheckStatus}
              disabled={checking}
            >
              {checking ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Ionicons name="refresh" size={20} color={colors.primary} />
                  <Text style={styles.checkButtonText}>Check Status</Text>
                </>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
              <Ionicons name="log-out-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.signOutButtonText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }
    
    // For guardians or unknown role, show spinner briefly
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="hourglass-outline" size={64} color={colors.primary} />
        </View>

        <Text style={styles.title}>Request Pending</Text>
        
        <Text style={styles.message}>
          Your request to join{" "}
          <Text style={styles.familyName}>{requestedFamily.name}</Text>
          {" "}is waiting for approval.
        </Text>

        <Text style={styles.subMessage}>
          The family owner will review your request. You'll gain access once approved.
        </Text>

        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Family</Text>
            <Text style={styles.statusValue}>{requestedFamily.name}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Status</Text>
            <View style={styles.statusBadge}>
              <Ionicons name="time-outline" size={14} color={colors.warning} />
              <Text style={styles.statusBadgeText}>Pending</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Your Role</Text>
            <Text style={styles.statusValue}>
              {profile?.role === "guardian" ? "Guardian" : "Participant"}
            </Text>
          </View>
        </View>

        {displayPasscode && profile?.role === 'kid' && (
          <View style={styles.passcodeReminder}>
            <Text style={styles.passcodeLabel}>Your Login Code</Text>
            <View style={styles.passcodeBox}>
              <Text style={styles.passcodeText}>{displayPasscode}</Text>
            </View>
            <Text style={styles.passcodeHint}>Remember this code to log in!</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.checkButton}
          onPress={handleCheckStatus}
          disabled={checking}
          data-testid="button-check-status"
        >
          {checking ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="refresh" size={20} color="#FFFFFF" />
              <Text style={styles.checkButtonText}>Check Status</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancel}
          disabled={cancelling}
          data-testid="button-cancel-request"
        >
          {cancelling ? (
            <ActivityIndicator size="small" color={colors.error} />
          ) : (
            <>
              <Ionicons name="close-circle-outline" size={20} color={colors.error} />
              <Text style={styles.cancelButtonText}>Cancel Request</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
          data-testid="button-sign-out"
        >
          <Ionicons name="log-out-outline" size={20} color={colors.textSecondary} />
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.text,
    textAlign: "center",
    paddingVertical: spacing.md,
  },
  content: {
    flex: 1,
    padding: spacing.xl,
    paddingTop: spacing.xxl,
    alignItems: "center",
    maxWidth: 400,
    alignSelf: "center",
    width: "100%",
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: "center",
  },
  message: {
    fontSize: fontSize.md,
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.sm,
    lineHeight: 24,
  },
  familyName: {
    fontWeight: "600",
    color: colors.primary,
  },
  subMessage: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.xl,
    lineHeight: 20,
  },
  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: "100%",
    marginBottom: spacing.xl,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  statusLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  statusValue: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: colors.text,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: `${colors.warning}20`,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  statusBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: colors.warning,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  checkButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    width: "100%",
    marginBottom: spacing.md,
  },
  checkButtonText: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSecondary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    width: "100%",
    marginBottom: spacing.md,
  },
  cancelButtonText: {
    fontSize: fontSize.md,
    fontWeight: "500",
    color: colors.error,
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  signOutButtonText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  passcodeReminder: {
    alignItems: "center",
    marginVertical: spacing.lg,
    width: "100%",
  },
  passcodeLabel: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  passcodeBox: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl * 2,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.xs,
  },
  passcodeText: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#FFFFFF",
    letterSpacing: 6,
  },
  passcodeHint: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontStyle: "italic",
  },
});

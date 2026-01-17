import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, borderRadius, fontSize } from "@/lib/theme";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/authContext";
import * as Clipboard from "expo-clipboard";

interface MemberInput {
  id: string;
  name: string;
  age: string;
  role: "kid" | "guardian";
  isOwner?: boolean;
}

export default function AddMembersScreen() {
  const router = useRouter();
  const addMember = useStore((s) => s.addMember);
  const existingMembers = useStore((s) => s.members);
  const { profile, family, signOut } = useAuth();

  const [members, setMembers] = useState<MemberInput[]>(() => {
    if (existingMembers.length > 0) {
      return existingMembers.map((m) => ({
        id: m.id,
        name: m.name,
        age: m.age.toString(),
        role: m.role,
      }));
    }
    return [{ id: "new-1", name: "", age: "", role: "kid" }];
  });

  useEffect(() => {
    if (profile && members.length === 1 && members[0].id === "new-1" && !members[0].name.trim()) {
      setMembers([{
        id: "owner",
        name: profile.display_name || "",
        age: "",
        role: (profile.role as "kid" | "guardian") || "guardian",
        isOwner: true,
      }]);
    }
  }, [profile]);

  const handleSignOut = async () => {
    await signOut();
    router.replace("/auth/sign-in");
  };

  const copyInviteCode = async () => {
    if (family?.invite_code) {
      await Clipboard.setStringAsync(family.invite_code);
      Alert.alert("Copied!", "Invite code copied to clipboard");
    }
  };

  const shareViaWhatsApp = () => {
    if (family?.invite_code) {
      const message = `Join our family on Sukun! Use invite code: ${family.invite_code}`;
      const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
      Linking.openURL(whatsappUrl).catch(() => {
        Alert.alert("WhatsApp not installed", "Please install WhatsApp to share.");
      });
    }
  };

  const addNewMember = () => {
    setMembers([
      ...members,
      { id: `new-${Date.now()}`, name: "", age: "", role: "kid" },
    ]);
  };

  const updateMember = (id: string, field: keyof MemberInput, value: string) => {
    setMembers(
      members.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  const removeMember = (id: string) => {
    const member = members.find((m) => m.id === id);
    if (members.length > 1 && !member?.isOwner) {
      setMembers(members.filter((m) => m.id !== id));
    }
  };

  const toggleRole = (id: string) => {
    setMembers(
      members.map((m) =>
        m.id === id ? { ...m, role: m.role === "kid" ? "guardian" : "kid" } : m
      )
    );
  };

  const canContinue = members.some(
    (m) => m.name.trim() && m.age && parseInt(m.age) > 0
  );

  const handleContinue = () => {
    const validMembers = members.filter(
      (m) => m.name.trim() && m.age && parseInt(m.age) > 0
    );

    existingMembers.forEach((m) => useStore.getState().removeMember(m.id));

    validMembers.forEach((m) => {
      addMember({
        name: m.name.trim(),
        age: parseInt(m.age),
        role: m.role,
      });
    });

    const hasKids = validMembers.some((m) => m.role === "kid");
    if (hasKids) {
      router.push("/onboarding/powers");
    } else {
      router.push("/onboarding/tasks");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {profile && (
        <View style={styles.userHeader}>
          <View style={styles.userInfo}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {profile.display_name?.charAt(0).toUpperCase() || "U"}
              </Text>
            </View>
            <View>
              <Text style={styles.userName}>{profile.display_name}</Text>
              <Text style={styles.userRole}>
                {profile.role === "guardian" ? "Guardian" : "Kid"}
                {family ? ` • ${family.name}` : ""}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleSignOut} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={22} color={colors.error} />
          </TouchableOpacity>
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>
            {family ? `Add to ${family.name}` : "Add Your Family"}
          </Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {family && (
            <View style={styles.familyInfo}>
              <View style={styles.inviteCodeBox}>
                <Text style={styles.inviteLabel}>Invite Code</Text>
                <View style={styles.codeRow}>
                  <Text style={styles.inviteCode}>{family.invite_code}</Text>
                  <TouchableOpacity onPress={copyInviteCode} style={styles.copyButton}>
                    <Ionicons name="copy-outline" size={20} color={colors.primary} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.inviteHint}>Share this code with family members</Text>
                <TouchableOpacity onPress={shareViaWhatsApp} style={styles.whatsappButton}>
                  <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" />
                  <Text style={styles.whatsappText}>Share via WhatsApp</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          
          <Text style={styles.subtitle}>
            {family 
              ? "You're already added as the first member. Add other family members below."
              : "Add the family members who will participate in the race"}
          </Text>

          {members.map((member, index) => (
            <View key={member.id} style={[styles.memberCard, member.isOwner && styles.ownerCard]}>
              <View style={styles.memberHeader}>
                <Text style={styles.memberNumber}>
                  {member.isOwner ? "You (Owner)" : `Member ${index + 1}`}
                </Text>
                {members.length > 1 && !member.isOwner && (
                  <TouchableOpacity
                    onPress={() => removeMember(member.id)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close-circle" size={24} color={colors.error} />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter name"
                  placeholderTextColor={colors.textMuted}
                  value={member.name}
                  onChangeText={(text) => updateMember(member.id, "name", text)}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Age</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter age"
                  placeholderTextColor={colors.textMuted}
                  value={member.age}
                  onChangeText={(text) =>
                    updateMember(member.id, "age", text.replace(/[^0-9]/g, ""))
                  }
                  keyboardType="numeric"
                  maxLength={2}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Role</Text>
                <View style={styles.roleToggle}>
                  <TouchableOpacity
                    style={[
                      styles.roleOption,
                      member.role === "kid" && styles.roleOptionActive,
                    ]}
                    onPress={() =>
                      member.role !== "kid" && toggleRole(member.id)
                    }
                  >
                    <Ionicons
                      name="happy"
                      size={20}
                      color={member.role === "kid" ? "#FFFFFF" : colors.text}
                    />
                    <Text
                      style={[
                        styles.roleText,
                        member.role === "kid" && styles.roleTextActive,
                      ]}
                    >
                      Kid
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.roleOption,
                      member.role === "guardian" && styles.roleOptionActive,
                    ]}
                    onPress={() =>
                      member.role !== "guardian" && toggleRole(member.id)
                    }
                  >
                    <Ionicons
                      name="shield-checkmark"
                      size={20}
                      color={
                        member.role === "guardian" ? "#FFFFFF" : colors.text
                      }
                    />
                    <Text
                      style={[
                        styles.roleText,
                        member.role === "guardian" && styles.roleTextActive,
                      ]}
                    >
                      Guardian
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.addButton} onPress={addNewMember}>
            <Ionicons name="add-circle" size={24} color={colors.primary} />
            <Text style={styles.addButtonText}>Add Another Member</Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.continueButton, !canContinue && styles.buttonDisabled]}
            onPress={handleContinue}
            disabled={!canContinue}
            activeOpacity={0.8}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  userHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  userName: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.text,
  },
  userRole: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  logoutButton: {
    padding: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: "600",
    color: colors.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  familyInfo: {
    marginBottom: spacing.lg,
  },
  inviteCodeBox: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  inviteLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  inviteCode: {
    fontSize: fontSize.xxl,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: 3,
  },
  copyButton: {
    padding: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primaryLight,
  },
  inviteHint: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  whatsappButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: "#25D366",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
  },
  whatsappText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: fontSize.sm,
  },
  memberCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  ownerCard: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  memberHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  memberNumber: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.primary,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    color: colors.text,
  },
  roleToggle: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  roleOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.surfaceSecondary,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  roleOptionActive: {
    backgroundColor: colors.primary,
  },
  roleText: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: colors.text,
  },
  roleTextActive: {
    color: "#FFFFFF",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  addButtonText: {
    fontSize: fontSize.md,
    fontWeight: "500",
    color: colors.primary,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  continueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  buttonDisabled: {
    backgroundColor: colors.textMuted,
  },
  continueButtonText: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});

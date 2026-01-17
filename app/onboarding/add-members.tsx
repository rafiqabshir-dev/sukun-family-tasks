import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, borderRadius, fontSize } from "@/lib/theme";
import { useStore } from "@/lib/store";

interface MemberInput {
  id: string;
  name: string;
  age: string;
  role: "kid" | "guardian";
}

export default function AddMembersScreen() {
  const router = useRouter();
  const addMember = useStore((s) => s.addMember);
  const existingMembers = useStore((s) => s.members);

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
    if (members.length > 1) {
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
          <Text style={styles.title}>Add Your Family</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.subtitle}>
            Add the family members who will participate in the race
          </Text>

          {members.map((member, index) => (
            <View key={member.id} style={styles.memberCard}>
              <View style={styles.memberHeader}>
                <Text style={styles.memberNumber}>Member {index + 1}</Text>
                {members.length > 1 && (
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

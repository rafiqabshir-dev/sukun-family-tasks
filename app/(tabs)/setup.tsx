import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from "react-native";
import { useState, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, spacing, borderRadius, fontSize } from "@/lib/theme";
import { useStore } from "@/lib/store";
import { POWER_INFO } from "@/lib/types";

const STORAGE_KEY = "barakah-kids-race:v1";

export default function SetupScreen() {
  const members = useStore((s) => s.members);
  const taskTemplates = useStore((s) => s.taskTemplates);
  const taskInstances = useStore((s) => s.taskInstances);
  const settings = useStore((s) => s.settings);
  const schemaVersion = useStore((s) => s.schemaVersion);
  const actingMemberId = useStore((s) => s.actingMemberId);
  const toggleSound = useStore((s) => s.toggleSound);
  const setActingMember = useStore((s) => s.setActingMember);
  
  const [storageKeyExists, setStorageKeyExists] = useState<boolean | null>(null);
  
  useEffect(() => {
    const checkStorage = async () => {
      try {
        const value = await AsyncStorage.getItem(STORAGE_KEY);
        setStorageKeyExists(value !== null);
      } catch {
        setStorageKeyExists(false);
      }
    };
    checkStorage();
  }, [members, taskTemplates, taskInstances]);

  const kids = members.filter((m) => m.role === "kid");
  const guardians = members.filter((m) => m.role === "guardian");
  const enabledTasks = taskTemplates.filter((t) => t.enabled).length;
  const actingMember = members.find((m) => m.id === actingMemberId);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Act As</Text>
        <Text style={styles.sectionSubtitle}>Select who is using the app right now</Text>
        <View style={styles.actAsGrid}>
          {members.map((member) => (
            <TouchableOpacity
              key={member.id}
              style={[
                styles.actAsCard,
                actingMemberId === member.id && styles.actAsCardSelected,
              ]}
              onPress={() => setActingMember(member.id)}
              data-testid={`button-act-as-${member.id}`}
            >
              <View style={[
                styles.actAsAvatar,
                actingMemberId === member.id && styles.actAsAvatarSelected,
              ]}>
                <Text style={styles.actAsInitial}>
                  {member.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={[
                styles.actAsName,
                actingMemberId === member.id && styles.actAsNameSelected,
              ]}>
                {member.name}
              </Text>
              <Text style={styles.actAsRole}>
                {member.role === "guardian" ? "Guardian" : `Age ${member.age}`}
              </Text>
              {actingMemberId === member.id && (
                <Ionicons name="checkmark-circle" size={20} color={colors.primary} style={styles.actAsCheck} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Family Members</Text>
        <View style={styles.card}>
          <View style={styles.statRow}>
            <Ionicons name="people" size={24} color={colors.primary} />
            <Text style={styles.statLabel}>Kids</Text>
            <Text style={styles.statValue}>{kids.length}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statRow}>
            <Ionicons name="shield-checkmark" size={24} color={colors.primaryLight} />
            <Text style={styles.statLabel}>Guardians</Text>
            <Text style={styles.statValue}>{guardians.length}</Text>
          </View>
        </View>

        {kids.length > 0 && (
          <View style={styles.membersList}>
            {kids.map((kid) => (
              <View key={kid.id} style={styles.memberItem}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberInitial}>
                    {kid.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{kid.name}</Text>
                  <Text style={styles.memberAge}>Age {kid.age}</Text>
                  {kid.powers.length > 0 && (
                    <View style={styles.powerTags}>
                      {kid.powers.map((p) => (
                        <View key={p.powerKey} style={styles.powerTag}>
                          <Text style={styles.powerTagText}>
                            {POWER_INFO[p.powerKey].name}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Task Templates</Text>
        <View style={styles.card}>
          <View style={styles.statRow}>
            <Ionicons name="list" size={24} color={colors.primary} />
            <Text style={styles.statLabel}>Active Tasks</Text>
            <Text style={styles.statValue}>{enabledTasks}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statRow}>
            <Ionicons name="albums" size={24} color={colors.textMuted} />
            <Text style={styles.statLabel}>Total Templates</Text>
            <Text style={styles.statValue}>{taskTemplates.length}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Settings</Text>
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <Ionicons name="volume-high" size={24} color={colors.primary} />
            <Text style={styles.settingLabel}>Sounds</Text>
            <Switch
              value={settings.soundsEnabled}
              onValueChange={toggleSound}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={settings.soundsEnabled ? colors.primary : colors.textMuted}
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Diagnostics</Text>
        <View style={styles.card}>
          <View style={styles.diagRow}>
            <Text style={styles.diagLabel}>Schema Version</Text>
            <Text style={styles.diagValue} data-testid="text-schema-version">{schemaVersion}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.diagRow}>
            <Text style={styles.diagLabel}>Members Count</Text>
            <Text style={styles.diagValue} data-testid="text-members-count">{members.length}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.diagRow}>
            <Text style={styles.diagLabel}>Templates Count</Text>
            <Text style={styles.diagValue} data-testid="text-templates-count">{taskTemplates.length}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.diagRow}>
            <Text style={styles.diagLabel}>Instances Count</Text>
            <Text style={styles.diagValue} data-testid="text-instances-count">{taskInstances.length}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.diagRow}>
            <Text style={styles.diagLabel}>AsyncStorage Key</Text>
            <View style={styles.storageStatus}>
              <View style={[
                styles.statusDot,
                { backgroundColor: storageKeyExists === null 
                  ? colors.textMuted 
                  : storageKeyExists 
                    ? colors.success 
                    : colors.warning 
                }
              ]} />
              <Text style={styles.diagValue} data-testid="text-storage-status">
                {storageKeyExists === null 
                  ? "Checking..." 
                  : storageKeyExists 
                    ? "Present" 
                    : "Not Found"}
              </Text>
            </View>
          </View>
          <Text style={styles.storageKey} data-testid="text-storage-key">{STORAGE_KEY}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  sectionSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  actAsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  actAsCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: "center",
    minWidth: 100,
    borderWidth: 2,
    borderColor: "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    position: "relative",
  },
  actAsCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceSecondary,
  },
  actAsAvatar: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.textMuted,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  actAsAvatarSelected: {
    backgroundColor: colors.primary,
  },
  actAsInitial: {
    fontSize: fontSize.xl,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  actAsName: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: colors.text,
  },
  actAsNameSelected: {
    fontWeight: "600",
    color: colors.primary,
  },
  actAsRole: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  actAsCheck: {
    position: "absolute",
    top: spacing.xs,
    right: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  statLabel: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
  },
  statValue: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  membersList: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  memberItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  memberInitial: {
    fontSize: fontSize.xl,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.text,
  },
  memberAge: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  powerTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  powerTag: {
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  powerTagText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  settingLabel: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
  },
  diagRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  diagLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  diagValue: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text,
  },
  storageStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  storageKey: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.sm,
    fontFamily: "monospace",
  },
});

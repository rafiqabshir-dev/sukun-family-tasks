import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, borderRadius, fontSize } from "@/lib/theme";
import { useStore } from "@/lib/store";
import { POWER_INFO } from "@/lib/types";
import { format, isBefore, startOfDay } from "date-fns";
import { useMemo } from "react";

export default function MemberDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  
  const members = useStore((s) => s.members);
  const taskInstances = useStore((s) => s.taskInstances);
  const taskTemplates = useStore((s) => s.taskTemplates);
  const starDeductions = useStore((s) => s.starDeductions);
  
  const member = members.find((m) => m.id === id);
  
  const memberDeductions = useMemo(() => {
    if (!member) return [];
    return starDeductions
      .filter((d) => d.memberId === member.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);
  }, [starDeductions, member?.id]);

  const getGuardianName = (guardianId: string) => {
    const guardian = members.find((m) => m.id === guardianId);
    return guardian?.name || "Guardian";
  };
  
  if (!member) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Member Not Found</Text>
          <View style={styles.backButton} />
        </View>
      </SafeAreaView>
    );
  }

  const memberTasks = taskInstances.filter((t) => t.assignedToMemberId === member.id);
  const today = startOfDay(new Date());
  
  const openTasks = memberTasks.filter((t) => {
    if (t.status === "approved") return false; // Database uses "approved" for completed tasks
    return true;
  });
  
  const overdueTasks = openTasks.filter((t) => isBefore(new Date(t.dueAt), today));
  const upcomingTasks = openTasks.filter((t) => !isBefore(new Date(t.dueAt), today));
  const completedTasks = memberTasks.filter((t) => t.status === "approved").slice(0, 10);

  const getTemplate = (templateId: string) => 
    taskTemplates.find((t) => t.id === templateId);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Member Details</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{member.name.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.memberName}>{member.name}</Text>
          <Text style={styles.memberRole}>
            {member.role === "guardian" ? "Guardian" : `Age ${member.age}`}
          </Text>
          
          {member.role === "kid" && (
            <View style={styles.starsDisplay}>
              <Ionicons name="star" size={24} color={colors.secondary} />
              <Text style={styles.starsCount}>{member.starsTotal}</Text>
              <Text style={styles.starsLabel}>Stars</Text>
            </View>
          )}

          {member.powers.length > 0 && (
            <View style={styles.powersSection}>
              <Text style={styles.powersTitle}>Powers</Text>
              <View style={styles.powerTags}>
                {member.powers.map((p) => (
                  <View key={p.powerKey} style={styles.powerTag}>
                    <Text style={styles.powerEmoji}>{POWER_INFO[p.powerKey].emoji}</Text>
                    <Text style={styles.powerName}>{POWER_INFO[p.powerKey].name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {member.role === "kid" && (
          <>
            {overdueTasks.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Overdue Tasks</Text>
                {overdueTasks.map((task) => {
                  const template = getTemplate(task.templateId);
                  return (
                    <View key={task.id} style={[styles.taskCard, styles.taskOverdue]}>
                      <View style={styles.taskInfo}>
                        <Text style={styles.taskTitle}>{template?.title || "Task"}</Text>
                        <Text style={styles.taskDue}>
                          Due: {format(new Date(task.dueAt), "MMM d, yyyy")}
                        </Text>
                      </View>
                      <View style={styles.taskStars}>
                        <Ionicons name="star" size={14} color={colors.secondary} />
                        <Text style={styles.taskStarsText}>{template?.defaultStars || 1}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {upcomingTasks.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Open Tasks</Text>
                {upcomingTasks.map((task) => {
                  const template = getTemplate(task.templateId);
                  return (
                    <View key={task.id} style={styles.taskCard}>
                      <View style={styles.taskInfo}>
                        <Text style={styles.taskTitle}>{template?.title || "Task"}</Text>
                        <Text style={styles.taskDue}>
                          Due: {format(new Date(task.dueAt), "MMM d, yyyy")}
                        </Text>
                      </View>
                      <View style={styles.taskStars}>
                        <Ionicons name="star" size={14} color={colors.secondary} />
                        <Text style={styles.taskStarsText}>{template?.defaultStars || 1}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {completedTasks.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Completed (Recent)</Text>
                {completedTasks.map((task) => {
                  const template = getTemplate(task.templateId);
                  return (
                    <View key={task.id} style={[styles.taskCard, styles.taskDone]}>
                      <View style={styles.taskInfo}>
                        <Text style={styles.taskTitle}>{template?.title || "Task"}</Text>
                        <Text style={styles.taskDue}>
                          Completed: {task.completedAt ? format(new Date(task.completedAt), "MMM d, yyyy") : "N/A"}
                        </Text>
                      </View>
                      <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                    </View>
                  );
                })}
              </View>
            )}

            {memberDeductions.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Star Deductions</Text>
                {memberDeductions.map((deduction) => (
                  <View key={deduction.id} style={styles.deductionCard}>
                    <View style={styles.deductionHeader}>
                      <View style={styles.deductionStars}>
                        <Ionicons name="remove-circle" size={18} color={colors.error} />
                        <Text style={styles.deductionAmount}>-{deduction.stars}</Text>
                      </View>
                      <Text style={styles.deductionDate}>
                        {format(new Date(deduction.createdAt), "MMM d, yyyy")}
                      </Text>
                    </View>
                    <Text style={styles.deductionReason}>{deduction.reason}</Text>
                    <Text style={styles.deductionBy}>
                      By: {getGuardianName(deduction.createdBy)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {memberTasks.length === 0 && memberDeductions.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="clipboard-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyText}>No tasks assigned yet</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.text,
  },
  content: {
    padding: spacing.lg,
  },
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: "center",
    marginBottom: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  avatarText: {
    fontSize: fontSize.xxxl,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  memberName: {
    fontSize: fontSize.xl,
    fontWeight: "600",
    color: colors.text,
  },
  memberRole: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: 4,
  },
  starsDisplay: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.lg,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  starsCount: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.secondary,
  },
  starsLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  powersSection: {
    marginTop: spacing.lg,
    width: "100%",
  },
  powersTitle: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  powerTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.sm,
  },
  powerTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  powerEmoji: {
    fontSize: fontSize.md,
  },
  powerName: {
    fontSize: fontSize.sm,
    color: colors.text,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  taskCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  taskOverdue: {
    borderLeftWidth: 3,
    borderLeftColor: colors.error,
  },
  taskDone: {
    opacity: 0.7,
  },
  taskInfo: {
    flex: 1,
  },
  taskTitle: {
    fontSize: fontSize.md,
    fontWeight: "500",
    color: colors.text,
  },
  taskDue: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  taskStars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  taskStarsText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.secondary,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  deductionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.error,
  },
  deductionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  deductionStars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  deductionAmount: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.error,
  },
  deductionDate: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  deductionReason: {
    fontSize: fontSize.md,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  deductionBy: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontStyle: "italic",
  },
});

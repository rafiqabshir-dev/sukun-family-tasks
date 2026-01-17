import { View, Text, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius, fontSize } from "@/lib/theme";
import { useStore } from "@/lib/store";

export default function TodayScreen() {
  const members = useStore((s) => s.members);
  const taskInstances = useStore((s) => s.taskInstances);
  const kids = members.filter((m) => m.role === "kid");

  const todayTasks = taskInstances.filter((t) => t.status === "open");

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {todayTasks.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="sunny-outline" size={64} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>No Tasks Today</Text>
          <Text style={styles.emptyText}>
            Use the Spin wheel to assign tasks to your family members!
          </Text>
        </View>
      ) : (
        <View style={styles.taskList}>
          {todayTasks.map((task) => (
            <View key={task.id} style={styles.taskCard}>
              <Text style={styles.taskTitle}>Task</Text>
            </View>
          ))}
        </View>
      )}

      {kids.length > 0 && (
        <View style={styles.kidsSection}>
          <Text style={styles.sectionTitle}>Family Members</Text>
          <View style={styles.kidsGrid}>
            {kids.map((kid) => (
              <View key={kid.id} style={styles.kidCard}>
                <View style={styles.kidAvatar}>
                  <Text style={styles.kidInitial}>
                    {kid.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.kidName}>{kid.name}</Text>
                <View style={styles.starsRow}>
                  <Ionicons name="star" size={14} color={colors.secondary} />
                  <Text style={styles.starsText}>{kid.starsTotal}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}
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
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
  },
  emptyIcon: {
    width: 120,
    height: 120,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: "center",
    maxWidth: 280,
  },
  taskList: {
    gap: spacing.md,
  },
  taskCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  taskTitle: {
    fontSize: fontSize.md,
    fontWeight: "500",
    color: colors.text,
  },
  kidsSection: {
    marginTop: spacing.xl,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.md,
  },
  kidsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  kidCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: "center",
    minWidth: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  kidAvatar: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  kidInitial: {
    fontSize: fontSize.xl,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  kidName: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  starsText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.secondary,
  },
});

import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, borderRadius, fontSize } from "@/lib/theme";
import { useStore } from "@/lib/store";
import { generateStarterTasks } from "@/lib/starterTasks";
import { TaskTemplate, TaskCategory } from "@/lib/types";

const CATEGORY_ICONS: Record<TaskCategory, string> = {
  cleaning: "sparkles",
  kitchen: "restaurant",
  learning: "book",
  kindness: "heart",
  prayer: "moon",
  outdoor: "leaf",
  personal: "person",
};

const CATEGORY_LABELS: Record<TaskCategory, string> = {
  cleaning: "Cleaning",
  kitchen: "Kitchen",
  learning: "Learning",
  kindness: "Kindness",
  prayer: "Prayer",
  outdoor: "Outdoor",
  personal: "Personal",
};

export default function TasksScreen() {
  const router = useRouter();
  const taskTemplates = useStore((s) => s.taskTemplates);
  const setTaskTemplates = useStore((s) => s.setTaskTemplates);
  const completeOnboarding = useStore((s) => s.completeOnboarding);

  const [tasks, setTasks] = useState<TaskTemplate[]>([]);
  const [expandedCategory, setExpandedCategory] = useState<TaskCategory | null>(null);

  useEffect(() => {
    if (taskTemplates.length > 0) {
      setTasks(taskTemplates);
    } else {
      const starterTasks = generateStarterTasks();
      setTasks(starterTasks);
      setTaskTemplates(starterTasks);
    }
  }, []);

  const toggleTask = (id: string) => {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t)));
  };

  const tasksByCategory = tasks.reduce((acc, task) => {
    if (!acc[task.category]) acc[task.category] = [];
    acc[task.category].push(task);
    return acc;
  }, {} as Record<TaskCategory, TaskTemplate[]>);

  const enabledCount = tasks.filter((t) => t.enabled).length;

  const handleStart = () => {
    setTaskTemplates(tasks);
    completeOnboarding();
    router.replace("/(tabs)/today");
  };

  const categories = Object.keys(tasksByCategory) as TaskCategory[];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Review Tasks</Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          {enabledCount} of {tasks.length} tasks enabled
        </Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.subtitle}>
          Toggle tasks on or off. You can always change these later in Setup.
        </Text>

        {categories.map((category) => {
          const categoryTasks = tasksByCategory[category];
          const enabledInCategory = categoryTasks.filter((t) => t.enabled).length;
          const isExpanded = expandedCategory === category;

          return (
            <View key={category} style={styles.categorySection}>
              <TouchableOpacity
                style={styles.categoryHeader}
                onPress={() => setExpandedCategory(isExpanded ? null : category)}
                activeOpacity={0.7}
              >
                <View style={styles.categoryIcon}>
                  <Ionicons
                    name={CATEGORY_ICONS[category] as any}
                    size={20}
                    color={colors.primary}
                  />
                </View>
                <Text style={styles.categoryName}>{CATEGORY_LABELS[category]}</Text>
                <Text style={styles.categoryCount}>
                  {enabledInCategory}/{categoryTasks.length}
                </Text>
                <Ionicons
                  name={isExpanded ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={colors.textMuted}
                />
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.tasksList}>
                  {categoryTasks.map((task) => (
                    <View key={task.id} style={styles.taskItem}>
                      <View style={styles.taskInfo}>
                        <Text style={styles.taskTitle}>{task.title}</Text>
                        <View style={styles.taskMeta}>
                          <View style={styles.starsRow}>
                            <Ionicons
                              name="star"
                              size={12}
                              color={colors.secondary}
                            />
                            <Text style={styles.starsText}>
                              {task.defaultStars}
                            </Text>
                          </View>
                          <Text style={styles.difficulty}>{task.difficulty}</Text>
                        </View>
                      </View>
                      <Switch
                        value={task.enabled}
                        onValueChange={() => toggleTask(task.id)}
                        trackColor={{
                          false: colors.border,
                          true: colors.primaryLight,
                        }}
                        thumbColor={task.enabled ? colors.primary : colors.textMuted}
                      />
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.startButton}
          onPress={handleStart}
          activeOpacity={0.8}
        >
          <Text style={styles.startButtonText}>Start Your Journey</Text>
          <Ionicons name="rocket" size={20} color="#FFFFFF" />
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
  summary: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  summaryText: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: "#FFFFFF",
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
  categorySection: {
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    gap: spacing.md,
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  categoryName: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.text,
  },
  categoryCount: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  tasksList: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  taskItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  taskInfo: {
    flex: 1,
  },
  taskTitle: {
    fontSize: fontSize.sm,
    color: colors.text,
    marginBottom: 2,
  },
  taskMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  starsText: {
    fontSize: fontSize.xs,
    color: colors.secondary,
    fontWeight: "500",
  },
  difficulty: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textTransform: "capitalize",
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  startButtonText: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});

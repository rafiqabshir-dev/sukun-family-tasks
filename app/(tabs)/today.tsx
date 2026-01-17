import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Platform } from "react-native";
import { useState, useMemo } from "react";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius, fontSize } from "@/lib/theme";
import { useStore } from "@/lib/store";
import { TaskInstance, TaskTemplate, Member } from "@/lib/types";
import { format, isToday, isBefore, startOfDay } from "date-fns";

function getTaskStatus(task: TaskInstance): "open" | "done" | "overdue" {
  if (task.status === "done") return "done";
  const dueDate = new Date(task.dueAt);
  const today = startOfDay(new Date());
  if (isBefore(dueDate, today)) return "overdue";
  return "open";
}

export default function TodayScreen() {
  const members = useStore((s) => s.members);
  const taskTemplates = useStore((s) => s.taskTemplates);
  const taskInstances = useStore((s) => s.taskInstances);
  const actingMemberId = useStore((s) => s.actingMemberId);
  const addTaskInstance = useStore((s) => s.addTaskInstance);
  const completeTask = useStore((s) => s.completeTask);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null);
  const [selectedKid, setSelectedKid] = useState<string>("");
  const [dueDate, setDueDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const actingMember = members.find((m) => m.id === actingMemberId);
  const isGuardian = actingMember?.role === "guardian";
  const kids = members.filter((m) => m.role === "kid");
  const enabledTemplates = taskTemplates.filter((t) => t.enabled);

  const tasksWithStatus = useMemo(() => {
    return taskInstances.map((t) => ({
      ...t,
      computedStatus: getTaskStatus(t),
    }));
  }, [taskInstances]);

  const myTasks = tasksWithStatus.filter(
    (t) => t.assignedToMemberId === actingMemberId && t.computedStatus !== "done"
  );

  const dueTodayTasks = tasksWithStatus.filter(
    (t) => isToday(new Date(t.dueAt)) && t.computedStatus === "open"
  );

  const overdueTasks = tasksWithStatus.filter((t) => t.computedStatus === "overdue");

  const getTemplate = (templateId: string) =>
    taskTemplates.find((t) => t.id === templateId);

  const getMember = (memberId: string) =>
    members.find((m) => m.id === memberId);

  const handleAssignTask = () => {
    if (!selectedTemplate || !selectedKid || !dueDate) return;
    addTaskInstance({
      templateId: selectedTemplate.id,
      assignedToMemberId: selectedKid,
      dueAt: new Date(dueDate).toISOString(),
      status: "open",
    });
    setShowAssignModal(false);
    setSelectedTemplate(null);
    setSelectedKid("");
    setDueDate(format(new Date(), "yyyy-MM-dd"));
  };

  const renderTaskCard = (task: TaskInstance & { computedStatus: string }, showAssignee = false) => {
    const template = getTemplate(task.templateId);
    const assignee = getMember(task.assignedToMemberId);
    const canComplete = task.assignedToMemberId === actingMemberId && task.computedStatus !== "done";

    return (
      <View
        key={task.id}
        style={[
          styles.taskCard,
          task.computedStatus === "overdue" && styles.taskCardOverdue,
          task.computedStatus === "done" && styles.taskCardDone,
        ]}
      >
        <View style={styles.taskContent}>
          <View style={styles.taskHeader}>
            <Text style={styles.taskTitle}>{template?.title || "Task"}</Text>
            <View style={styles.starsContainer}>
              <Ionicons name="star" size={16} color={colors.secondary} />
              <Text style={styles.starsValue}>{template?.defaultStars || 1}</Text>
            </View>
          </View>
          {showAssignee && assignee && (
            <Text style={styles.taskAssignee}>Assigned to: {assignee.name}</Text>
          )}
          <Text style={styles.taskDue}>
            Due: {format(new Date(task.dueAt), "MMM d, yyyy")}
            {task.computedStatus === "overdue" && (
              <Text style={styles.overdueLabel}> (Overdue)</Text>
            )}
          </Text>
        </View>
        {canComplete && (
          <TouchableOpacity
            style={styles.completeButton}
            onPress={() => completeTask(task.id)}
            data-testid={`button-complete-${task.id}`}
          >
            <Ionicons name="checkmark-circle" size={32} color={colors.success} />
          </TouchableOpacity>
        )}
        {task.computedStatus === "done" && (
          <View style={styles.doneIndicator}>
            <Ionicons name="checkmark-done" size={24} color={colors.success} />
          </View>
        )}
      </View>
    );
  };

  if (!actingMember) {
    return (
      <View style={styles.container}>
        <View style={styles.noActorState}>
          <Ionicons name="person-circle-outline" size={64} color={colors.textMuted} />
          <Text style={styles.noActorTitle}>Who's using the app?</Text>
          <Text style={styles.noActorText}>
            Go to Setup and select who you are to see your tasks.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.actingAsBar}>
          <Ionicons name="person" size={20} color={colors.primary} />
          <Text style={styles.actingAsText}>
            Acting as <Text style={styles.actingAsName}>{actingMember.name}</Text>
            {isGuardian && " (Guardian)"}
          </Text>
        </View>

        {isGuardian && (
          <TouchableOpacity
            style={styles.assignButton}
            onPress={() => setShowAssignModal(true)}
            data-testid="button-assign-task"
          >
            <Ionicons name="add-circle" size={24} color="#FFFFFF" />
            <Text style={styles.assignButtonText}>Assign New Task</Text>
          </TouchableOpacity>
        )}

        {!isGuardian && myTasks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My Tasks</Text>
            {myTasks.map((task) => renderTaskCard(task, false))}
          </View>
        )}

        {dueTodayTasks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Due Today</Text>
            {dueTodayTasks.map((task) => renderTaskCard(task, isGuardian))}
          </View>
        )}

        {overdueTasks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Overdue</Text>
            {overdueTasks.map((task) => renderTaskCard(task, isGuardian))}
          </View>
        )}

        {myTasks.length === 0 && dueTodayTasks.length === 0 && overdueTasks.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="sunny-outline" size={64} color={colors.primary} />
            <Text style={styles.emptyTitle}>All Clear!</Text>
            <Text style={styles.emptyText}>
              {isGuardian
                ? "Assign tasks to your kids using the button above."
                : "No tasks right now. Great job!"}
            </Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={showAssignModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign Task</Text>
              <TouchableOpacity onPress={() => setShowAssignModal(false)}>
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Select Task</Text>
            <ScrollView style={styles.templateList} horizontal showsHorizontalScrollIndicator={false}>
              {enabledTemplates.map((template) => (
                <TouchableOpacity
                  key={template.id}
                  style={[
                    styles.templateChip,
                    selectedTemplate?.id === template.id && styles.templateChipSelected,
                  ]}
                  onPress={() => setSelectedTemplate(template)}
                >
                  <Text
                    style={[
                      styles.templateChipText,
                      selectedTemplate?.id === template.id && styles.templateChipTextSelected,
                    ]}
                  >
                    {template.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.modalLabel}>Assign To</Text>
            <View style={styles.kidsList}>
              {kids.map((kid) => (
                <TouchableOpacity
                  key={kid.id}
                  style={[
                    styles.kidChip,
                    selectedKid === kid.id && styles.kidChipSelected,
                  ]}
                  onPress={() => setSelectedKid(kid.id)}
                >
                  <Text
                    style={[
                      styles.kidChipText,
                      selectedKid === kid.id && styles.kidChipTextSelected,
                    ]}
                  >
                    {kid.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>Due Date</Text>
            <TextInput
              style={styles.dateInput}
              value={dueDate}
              onChangeText={setDueDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
            />

            <TouchableOpacity
              style={[
                styles.confirmButton,
                (!selectedTemplate || !selectedKid) && styles.confirmButtonDisabled,
              ]}
              onPress={handleAssignTask}
              disabled={!selectedTemplate || !selectedKid}
              data-testid="button-confirm-assign"
            >
              <Text style={styles.confirmButtonText}>Assign Task</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  actingAsBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  actingAsText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  actingAsName: {
    fontWeight: "600",
    color: colors.primary,
  },
  assignButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  assignButtonText: {
    color: "#FFFFFF",
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.md,
  },
  taskCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  taskCardOverdue: {
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
  },
  taskCardDone: {
    opacity: 0.6,
  },
  taskContent: {
    flex: 1,
  },
  taskHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  taskTitle: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.text,
    flex: 1,
  },
  starsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  starsValue: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.secondary,
  },
  taskAssignee: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 4,
  },
  taskDue: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 4,
  },
  overdueLabel: {
    color: colors.error,
    fontWeight: "600",
  },
  completeButton: {
    padding: spacing.sm,
  },
  doneIndicator: {
    padding: spacing.sm,
  },
  noActorState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  noActorTitle: {
    fontSize: fontSize.xl,
    fontWeight: "600",
    color: colors.text,
    marginTop: spacing.md,
  },
  noActorText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: "600",
    color: colors.text,
    marginTop: spacing.md,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.sm,
    maxWidth: 280,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: "600",
    color: colors.text,
  },
  modalLabel: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  templateList: {
    maxHeight: 120,
  },
  templateChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.md,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  templateChipSelected: {
    backgroundColor: colors.primary,
  },
  templateChipText: {
    fontSize: fontSize.sm,
    color: colors.text,
  },
  templateChipTextSelected: {
    color: "#FFFFFF",
  },
  kidsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  kidChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.md,
  },
  kidChipSelected: {
    backgroundColor: colors.primary,
  },
  kidChipText: {
    fontSize: fontSize.sm,
    color: colors.text,
  },
  kidChipTextSelected: {
    color: "#FFFFFF",
  },
  dateInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  confirmButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  confirmButtonDisabled: {
    backgroundColor: colors.textMuted,
  },
  confirmButtonText: {
    color: "#FFFFFF",
    fontSize: fontSize.md,
    fontWeight: "600",
  },
});

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Pressable } from "react-native";
import { useState, useMemo, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius, fontSize } from "@/lib/theme";
import { useStore } from "@/lib/store";
import { TaskInstance, TaskTemplate } from "@/lib/types";
import { format, isToday, isBefore, startOfDay } from "date-fns";

function getTaskStatus(task: TaskInstance): "open" | "pending_approval" | "done" | "overdue" {
  if (task.status === "done") return "done";
  if (task.status === "pending_approval") return "pending_approval";
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
  const approveTask = useStore((s) => s.approveTask);
  const rejectTask = useStore((s) => s.rejectTask);
  const deductStars = useStore((s) => s.deductStars);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showDeductModal, setShowDeductModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null);
  const [selectedKid, setSelectedKid] = useState<string>("");
  const [dueDate, setDueDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [deductKid, setDeductKid] = useState<string>("");
  const [deductAmount, setDeductAmount] = useState<number>(1);
  const [deductReason, setDeductReason] = useState<string>("");

  const openAssignModal = () => {
    const kidsList = members.filter((m) => m.role === "kid");
    if (kidsList.length === 1) {
      setSelectedKid(kidsList[0].id);
    }
    setShowAssignModal(true);
  };

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

  const pendingApprovalTasks = tasksWithStatus.filter(
    (t) => t.computedStatus === "pending_approval"
  );

  const getTemplate = (templateId: string) =>
    taskTemplates.find((t) => t.id === templateId);

  const getMember = (memberId: string) =>
    members.find((m) => m.id === memberId);

  const handleAssignTask = () => {
    if (!selectedTemplate || !selectedKid || !dueDate) return;
    
    addTaskInstance({
      templateId: selectedTemplate.id,
      assignedToMemberId: selectedKid,
      dueAt: `${dueDate}T12:00:00`,
      status: "open",
    });
    
    setShowAssignModal(false);
    setSelectedTemplate(null);
    setSelectedKid("");
    setDueDate(format(new Date(), "yyyy-MM-dd"));
  };

  const openDeductModal = () => {
    const kidsList = kids;
    if (kidsList.length === 1) {
      setDeductKid(kidsList[0].id);
    }
    setDeductAmount(1);
    setDeductReason("");
    setShowDeductModal(true);
  };

  const handleDeductStars = () => {
    if (!deductKid || !deductReason.trim() || deductAmount < 1 || !actingMemberId) return;
    deductStars(deductKid, deductAmount, deductReason.trim(), actingMemberId);
    setShowDeductModal(false);
    setDeductKid("");
    setDeductAmount(1);
    setDeductReason("");
  };

  const renderApprovalCard = (task: TaskInstance & { computedStatus: string }) => {
    const template = getTemplate(task.templateId);
    const assignee = getMember(task.assignedToMemberId);
    const requester = getMember(task.completionRequestedBy || "");
    const canApprove = actingMemberId !== task.completionRequestedBy;

    return (
      <View key={task.id} style={[styles.taskCard, styles.taskCardPending]}>
        <View style={styles.taskContent}>
          <View style={styles.taskHeader}>
            <Text style={styles.taskTitle}>{template?.title || "Task"}</Text>
            <View style={styles.starsContainer}>
              <Ionicons name="star" size={16} color={colors.secondary} />
              <Text style={styles.starsValue}>{template?.defaultStars || 1}</Text>
            </View>
          </View>
          <Text style={styles.taskAssignee}>
            {assignee?.name} completed this task
          </Text>
          <Text style={styles.taskDue}>
            Requested by: {requester?.name || "Unknown"}
          </Text>
        </View>
        {canApprove ? (
          <View style={styles.approvalButtons}>
            <TouchableOpacity
              style={styles.approveButton}
              onPress={() => actingMemberId && approveTask(task.id, actingMemberId)}
              data-testid={`button-approve-${task.id}`}
            >
              <Ionicons name="checkmark" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.rejectButton}
              onPress={() => rejectTask(task.id)}
              data-testid={`button-reject-${task.id}`}
            >
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.waitingIndicator}>
            <Text style={styles.waitingText}>Waiting for approval</Text>
          </View>
        )}
      </View>
    );
  };

  const renderTaskCard = (task: TaskInstance & { computedStatus: string }, showAssignee = false) => {
    const template = getTemplate(task.templateId);
    const assignee = getMember(task.assignedToMemberId);
    const isMyTask = task.assignedToMemberId === actingMemberId;
    const canComplete = (isMyTask || isGuardian) && task.computedStatus !== "done" && task.status === "open";

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
            <Text style={styles.taskAssignee}>For: {assignee.name}</Text>
          )}
          <Text style={styles.taskDue}>
            Due: {format(new Date(task.dueAt), "MMM d, yyyy")}
            {task.computedStatus === "overdue" && (
              <Text style={styles.overdueLabel}> (Overdue)</Text>
            )}
          </Text>
        </View>
        {canComplete && task.status === "open" && (
          <TouchableOpacity
            style={styles.completeButton}
            onPress={() => actingMemberId && completeTask(task.id, actingMemberId)}
            data-testid={`button-complete-${task.id}`}
          >
            <Ionicons name="checkmark-circle" size={40} color={colors.secondary} />
          </TouchableOpacity>
        )}
        {task.status === "pending_approval" && (
          <View style={styles.pendingIndicator}>
            <Ionicons name="hourglass" size={24} color={colors.warning} />
          </View>
        )}
        {task.computedStatus === "done" && (
          <View style={styles.doneIndicator}>
            <Ionicons name="checkmark-done" size={24} color={colors.success} />
          </View>
        )}
      </View>
    );
  };

  const setActingMember = useStore((s) => s.setActingMember);
  const [showUserPicker, setShowUserPicker] = useState(false);

  // Auto-select first guardian if no acting member
  useEffect(() => {
    if (!actingMemberId && members.length > 0) {
      const firstGuardian = members.find((m) => m.role === "guardian");
      if (firstGuardian) {
        setActingMember(firstGuardian.id);
      } else if (members[0]) {
        setActingMember(members[0].id);
      }
    }
  }, [actingMemberId, members, setActingMember]);

  if (!actingMember && members.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.noActorState}>
          <Ionicons name="people-outline" size={64} color={colors.textMuted} />
          <Text style={styles.noActorTitle}>No Family Members</Text>
          <Text style={styles.noActorText}>
            Add family members in the Setup screen to get started.
          </Text>
        </View>
      </View>
    );
  }
  
  if (!actingMember) {
    return null; // Brief loading state while auto-selecting
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity 
          style={styles.actingAsBar}
          onPress={() => setShowUserPicker(true)}
          data-testid="button-switch-user"
        >
          <View style={styles.actingAsLeft}>
            <View style={styles.actingAsAvatar}>
              <Text style={styles.actingAsAvatarText}>
                {actingMember.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={styles.actingAsName}>{actingMember.name}</Text>
              <Text style={styles.actingAsRole}>
                {isGuardian ? "Guardian" : "Participant"}
              </Text>
            </View>
          </View>
          <View style={styles.actingAsRight}>
            <Text style={styles.switchText}>Switch</Text>
            <Ionicons name="chevron-down" size={16} color={colors.primary} />
          </View>
        </TouchableOpacity>

        {isGuardian && (
          <View style={styles.guardianActions}>
            <TouchableOpacity
              style={styles.assignButton}
              onPress={openAssignModal}
              data-testid="button-assign-task"
            >
              <Ionicons name="add-circle" size={24} color="#FFFFFF" />
              <Text style={styles.assignButtonText}>Assign Task</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deductButton}
              onPress={openDeductModal}
              data-testid="button-deduct-stars"
            >
              <Ionicons name="remove-circle" size={24} color="#FFFFFF" />
              <Text style={styles.deductButtonText}>Deduct Stars</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isGuardian && myTasks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My Tasks</Text>
            {myTasks.map((task) => renderTaskCard(task, false))}
          </View>
        )}

        {isGuardian && dueTodayTasks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Due Today</Text>
            {dueTodayTasks.map((task) => renderTaskCard(task, true))}
          </View>
        )}

        {isGuardian && overdueTasks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Overdue</Text>
            {overdueTasks.map((task) => renderTaskCard(task, true))}
          </View>
        )}

        {pendingApprovalTasks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Needs Approval</Text>
            <Text style={styles.sectionSubtitle}>
              Someone else must verify these tasks are complete
            </Text>
            {pendingApprovalTasks.map((task) => renderApprovalCard(task))}
          </View>
        )}

        {(isGuardian 
          ? dueTodayTasks.length === 0 && overdueTasks.length === 0 && pendingApprovalTasks.length === 0
          : myTasks.length === 0 && pendingApprovalTasks.length === 0
        ) && (
          <View style={styles.emptyState}>
            <Ionicons name="sunny-outline" size={64} color={colors.primary} />
            <Text style={styles.emptyTitle}>All Clear!</Text>
            <Text style={styles.emptyText}>
              {isGuardian
                ? "Assign tasks to participants using the button above."
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
                  data-testid={`button-select-kid-${kid.id}`}
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

      <Modal visible={showDeductModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Deduct Stars</Text>
              <TouchableOpacity onPress={() => setShowDeductModal(false)}>
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Select Child</Text>
            <View style={styles.kidsList}>
              {kids.map((kid) => (
                <TouchableOpacity
                  key={kid.id}
                  style={[
                    styles.kidChip,
                    deductKid === kid.id && styles.kidChipSelected,
                  ]}
                  onPress={() => setDeductKid(kid.id)}
                  data-testid={`button-deduct-kid-${kid.id}`}
                >
                  <View style={styles.kidChipContent}>
                    <Text
                      style={[
                        styles.kidChipText,
                        deductKid === kid.id && styles.kidChipTextSelected,
                      ]}
                    >
                      {kid.name}
                    </Text>
                    <Text style={[styles.kidStars, deductKid === kid.id && styles.kidChipTextSelected]}>
                      {kid.starsTotal} stars
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>Stars to Deduct</Text>
            <View style={styles.amountRow}>
              {[1, 2, 3, 5].map((amt) => (
                <TouchableOpacity
                  key={amt}
                  style={[
                    styles.amountChip,
                    deductAmount === amt && styles.amountChipSelected,
                  ]}
                  onPress={() => setDeductAmount(amt)}
                >
                  <Text
                    style={[
                      styles.amountChipText,
                      deductAmount === amt && styles.amountChipTextSelected,
                    ]}
                  >
                    {amt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>Reason (Required)</Text>
            <TextInput
              style={styles.reasonInput}
              value={deductReason}
              onChangeText={setDeductReason}
              placeholder="Why are stars being deducted?"
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              style={[
                styles.deductConfirmButton,
                (!deductKid || !deductReason.trim()) && styles.confirmButtonDisabled,
              ]}
              onPress={handleDeductStars}
              disabled={!deductKid || !deductReason.trim()}
              data-testid="button-confirm-deduct"
            >
              <Text style={styles.confirmButtonText}>Deduct {deductAmount} Star{deductAmount > 1 ? "s" : ""}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showUserPicker} animationType="fade" transparent>
        <Pressable style={styles.userPickerOverlay} onPress={() => setShowUserPicker(false)}>
          <View style={styles.userPickerContent}>
            <Text style={styles.userPickerTitle}>Switch User</Text>
            {members.map((member) => (
              <TouchableOpacity
                key={member.id}
                style={[
                  styles.userPickerItem,
                  actingMemberId === member.id && styles.userPickerItemActive,
                ]}
                onPress={() => {
                  setActingMember(member.id);
                  setShowUserPicker(false);
                }}
                data-testid={`button-switch-to-${member.id}`}
              >
                <View style={[
                  styles.userPickerAvatar,
                  actingMemberId === member.id && styles.userPickerAvatarActive,
                ]}>
                  <Text style={styles.userPickerAvatarText}>
                    {member.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.userPickerInfo}>
                  <Text style={[
                    styles.userPickerName,
                    actingMemberId === member.id && styles.userPickerNameActive,
                  ]}>
                    {member.name}
                  </Text>
                  <Text style={styles.userPickerRole}>
                    {member.role === "guardian" ? "Guardian" : "Participant"}
                  </Text>
                </View>
                {actingMemberId === member.id && (
                  <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
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
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actingAsLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  actingAsAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  actingAsAvatarText: {
    color: "#FFFFFF",
    fontSize: fontSize.lg,
    fontWeight: "600",
  },
  actingAsName: {
    fontWeight: "600",
    color: colors.text,
    fontSize: fontSize.md,
  },
  actingAsRole: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  actingAsRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  switchText: {
    color: colors.primary,
    fontSize: fontSize.sm,
    fontWeight: "500",
  },
  userPickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  userPickerContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    width: "100%",
    maxWidth: 340,
  },
  userPickerTitle: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: "center",
  },
  userPickerItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
    gap: spacing.sm,
  },
  userPickerItemActive: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  userPickerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.textMuted,
    justifyContent: "center",
    alignItems: "center",
  },
  userPickerAvatarActive: {
    backgroundColor: colors.primary,
  },
  userPickerAvatarText: {
    color: "#FFFFFF",
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  userPickerInfo: {
    flex: 1,
  },
  userPickerName: {
    fontSize: fontSize.md,
    fontWeight: "500",
    color: colors.text,
  },
  userPickerNameActive: {
    color: colors.primary,
    fontWeight: "600",
  },
  userPickerRole: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  assignButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
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
  guardianActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  deductButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.error,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  deductButtonText: {
    color: "#FFFFFF",
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  kidChipContent: {
    alignItems: "center",
  },
  kidStars: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  amountRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  amountChip: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.md,
  },
  amountChipSelected: {
    backgroundColor: colors.error,
  },
  amountChipText: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.text,
  },
  amountChipTextSelected: {
    color: "#FFFFFF",
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
    backgroundColor: colors.surface,
    minHeight: 80,
    textAlignVertical: "top",
  },
  deductConfirmButton: {
    backgroundColor: colors.error,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  sectionSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.md,
    marginTop: -spacing.sm,
  },
  taskCardPending: {
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  pendingIndicator: {
    padding: spacing.sm,
  },
  approvalButtons: {
    flexDirection: "column",
    gap: spacing.xs,
  },
  approveButton: {
    backgroundColor: colors.success,
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  rejectButton: {
    backgroundColor: colors.error,
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  waitingIndicator: {
    padding: spacing.sm,
  },
  waitingText: {
    fontSize: fontSize.xs,
    color: colors.warning,
    fontWeight: "500",
    textAlign: "center",
  },
});

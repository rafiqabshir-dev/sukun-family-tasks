import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Pressable } from "react-native";
import { useState, useMemo, useEffect, useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius, fontSize } from "@/lib/theme";
import { useStore } from "@/lib/store";
import { TaskInstance, TaskTemplate } from "@/lib/types";
import { useAuth } from "@/lib/authContext";
import { format, isToday, isBefore, startOfDay, differenceInMinutes, differenceInSeconds, parseISO, isAfter } from "date-fns";
import { isSupabaseConfigured } from "@/lib/supabase";
import { addStarsLedgerEntry } from "@/lib/cloudSync";

function getTaskStatus(task: TaskInstance): "open" | "pending_approval" | "done" | "overdue" | "expired" {
  if (task.status === "done") return "done";
  if (task.status === "expired") return "expired";
  if (task.status === "pending_approval") return "pending_approval";
  
  const now = new Date();
  
  // Check expiration for time-sensitive tasks
  if (task.expiresAt) {
    const expiresAt = parseISO(task.expiresAt);
    if (isAfter(now, expiresAt)) return "expired";
  }
  
  const dueDate = new Date(task.dueAt);
  const today = startOfDay(now);
  if (isBefore(dueDate, today)) return "overdue";
  return "open";
}

function getTimeRemaining(expiresAt: string): { minutes: number; seconds: number; isExpired: boolean } {
  const now = new Date();
  const expires = parseISO(expiresAt);
  const diffSeconds = differenceInSeconds(expires, now);
  
  if (diffSeconds <= 0) {
    return { minutes: 0, seconds: 0, isExpired: true };
  }
  
  return {
    minutes: Math.floor(diffSeconds / 60),
    seconds: diffSeconds % 60,
    isExpired: false
  };
}

function formatTimeRemaining(expiresAt: string): string {
  const { minutes, seconds, isExpired } = getTimeRemaining(expiresAt);
  if (isExpired) return "Expired";
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    return `${hours}h ${remainingMins}m`;
  }
  return `${minutes}m ${seconds}s`;
}

export default function TodayScreen() {
  const { profile } = useAuth();
  const members = useStore((s) => s.members);
  const taskTemplates = useStore((s) => s.taskTemplates);
  const taskInstances = useStore((s) => s.taskInstances);
  const addTaskInstance = useStore((s) => s.addTaskInstance);
  const completeTask = useStore((s) => s.completeTask);
  const approveTask = useStore((s) => s.approveTask);
  const rejectTask = useStore((s) => s.rejectTask);
  const deductStars = useStore((s) => s.deductStars);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Timer for countdown display updates only - does NOT call store actions
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  
  // Check expired tasks and regenerate recurring tasks on mount and periodically
  // Using useStore.getState() to avoid stale closure issues
  useEffect(() => {
    const runExpiredAndRecurringChecks = () => {
      const state = useStore.getState();
      state.checkExpiredTasks();
      state.regenerateRecurringTasks();
    };
    
    // Run once on mount
    runExpiredAndRecurringChecks();
    
    // Run every minute
    const interval = setInterval(runExpiredAndRecurringChecks, 60000);
    
    return () => clearInterval(interval);
  }, []);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showDeductModal, setShowDeductModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null);
  const [selectedKid, setSelectedKid] = useState<string>("");
  const [dueDate, setDueDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [deductKid, setDeductKid] = useState<string>("");
  const [deductAmount, setDeductAmount] = useState<number>(1);
  const [deductReason, setDeductReason] = useState<string>("");

  // Current user is strictly the authenticated user - no fallback to cached data
  const currentMember = profile ? members.find((m) => m.id === profile.id || m.profileId === profile.id) : null;
  const isCurrentUserGuardian = currentMember?.role === "guardian";
  
  // Count guardians for approval logic
  const guardianCount = members.filter((m) => m.role === "guardian").length;

  const openAssignModal = () => {
    const kidsList = members.filter((m) => m.role === "kid");
    if (kidsList.length === 1) {
      setSelectedKid(kidsList[0].id);
    }
    setShowAssignModal(true);
  };

  const kids = members.filter((m) => m.role === "kid");
  const enabledTemplates = taskTemplates.filter((t) => t.enabled);

  const tasksWithStatus = useMemo(() => {
    return taskInstances.map((t) => ({
      ...t,
      computedStatus: getTaskStatus(t),
    }));
  }, [taskInstances]);

  const myTasks = tasksWithStatus.filter(
    (t) => t.assignedToMemberId === currentMember?.id && t.computedStatus !== "done"
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

  const handleDeductStars = async () => {
    if (!deductKid || !deductReason.trim() || deductAmount < 1 || !currentMember?.id) return;
    
    // Update local store first
    deductStars(deductKid, deductAmount, deductReason.trim(), currentMember.id);
    
    // Sync to cloud if configured
    if (isSupabaseConfigured() && profile?.family_id) {
      try {
        const { error } = await addStarsLedgerEntry(
          profile.family_id,
          deductKid,
          -deductAmount, // Negative for deduction
          deductReason.trim(),
          currentMember.id
        );
        
        if (error) {
          console.error('[Today] Error syncing star deduction to cloud:', error.message);
        } else {
          console.log('[Today] Star deduction synced to cloud:', -deductAmount);
        }
      } catch (err) {
        console.error('[Today] Cloud sync error for deduction:', err);
      }
    }
    
    setShowDeductModal(false);
    setDeductKid("");
    setDeductAmount(1);
    setDeductReason("");
  };

  // Complete task with cloud sync (for single guardian direct completion)
  const handleCompleteTask = async (taskId: string, requestedBy: string) => {
    const task = taskInstances.find((t) => t.id === taskId);
    if (!task) return;
    
    const template = taskTemplates.find((t) => t.id === task.templateId);
    const stars = template?.defaultStars || 1;
    const assigneeId = task.assignedToMemberId;
    
    // Check if this is a single guardian case (direct completion)
    const isSingleGuardian = guardianCount === 1 && currentMember?.role === "guardian";
    
    // Update local store first
    completeTask(taskId, requestedBy);
    
    // If single guardian, stars are awarded immediately - sync to cloud
    if (isSingleGuardian && isSupabaseConfigured() && profile?.family_id) {
      try {
        const { error } = await addStarsLedgerEntry(
          profile.family_id,
          assigneeId,
          stars,
          'Task completion',
          requestedBy,
          taskId
        );
        
        if (error) {
          console.error('[Today] Error syncing task completion to cloud:', error.message);
        } else {
          console.log('[Today] Task completion synced to cloud, stars:', stars);
        }
      } catch (err) {
        console.error('[Today] Cloud sync error:', err);
      }
    }
  };

  // Approve task with cloud sync
  const handleApproveTask = async (taskId: string, approverId: string) => {
    const task = taskInstances.find((t) => t.id === taskId);
    if (!task) return;
    
    const template = taskTemplates.find((t) => t.id === task.templateId);
    const stars = template?.defaultStars || 1;
    const assigneeId = task.assignedToMemberId;
    
    // Update local store first for immediate UI feedback
    approveTask(taskId, approverId);
    
    // Sync stars to cloud (tasks are local, but stars persist in cloud)
    if (isSupabaseConfigured() && profile?.family_id) {
      try {
        const { error } = await addStarsLedgerEntry(
          profile.family_id,
          assigneeId,
          stars,
          'Task approval',
          approverId,
          taskId
        );
        
        if (error) {
          console.error('[Today] Error syncing task approval stars to cloud:', error.message);
        } else {
          console.log('[Today] Task approval stars synced to cloud:', stars);
        }
      } catch (err) {
        console.error('[Today] Cloud sync error:', err);
      }
    }
  };

  const renderApprovalCard = (task: TaskInstance & { computedStatus: string }) => {
    const template = getTemplate(task.templateId);
    const assignee = getMember(task.assignedToMemberId);
    const requester = getMember(task.completionRequestedBy || "");
    
    // Approval rules: guardians can approve if they're not the requester
    const isRequester = currentMember?.id === task.completionRequestedBy;
    const canApprove = isCurrentUserGuardian && !isRequester;

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
              onPress={() => currentMember?.id && handleApproveTask(task.id, currentMember.id)}
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
            <Text style={styles.waitingText}>
              {isRequester ? "Waiting for approval" : "Only guardians can approve"}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderTaskCard = (task: TaskInstance & { computedStatus: string }, showAssignee = false) => {
    const template = getTemplate(task.templateId);
    const assignee = getMember(task.assignedToMemberId);
    const isMyTask = task.assignedToMemberId === currentMember?.id;
    const isExpired = task.computedStatus === "expired";
    const canComplete = (isMyTask || isCurrentUserGuardian) && task.computedStatus !== "done" && task.computedStatus !== "expired" && task.status === "open";
    
    const hasExpiration = task.expiresAt && task.status === "open" && !isExpired;
    const timeRemaining = hasExpiration ? formatTimeRemaining(task.expiresAt!) : null;
    const isUrgent = hasExpiration && getTimeRemaining(task.expiresAt!).minutes < 5;

    return (
      <View
        key={task.id}
        style={[
          styles.taskCard,
          task.computedStatus === "overdue" && styles.taskCardOverdue,
          task.computedStatus === "done" && styles.taskCardDone,
          task.computedStatus === "expired" && styles.taskCardExpired,
        ]}
      >
        <View style={styles.taskContent}>
          <View style={styles.taskHeader}>
            <View style={styles.taskTitleRow}>
              <Text style={styles.taskTitle}>{template?.title || "Task"}</Text>
              {task.scheduleType && task.scheduleType !== "one_time" && (
                <View style={[
                  styles.scheduleTypeBadge,
                  task.scheduleType === "recurring_daily" && styles.dailyBadge,
                  task.scheduleType === "time_sensitive" && styles.timedBadge,
                ]}>
                  <Ionicons 
                    name={task.scheduleType === "recurring_daily" ? "refresh" : "timer-outline"} 
                    size={10} 
                    color="#FFFFFF" 
                  />
                  <Text style={styles.scheduleTypeBadgeText}>
                    {task.scheduleType === "recurring_daily" ? "Daily" : "Timed"}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.starsContainer}>
              <Ionicons name="star" size={16} color={colors.secondary} />
              <Text style={styles.starsValue}>{template?.defaultStars || 1}</Text>
            </View>
          </View>
          {showAssignee && assignee && (
            <Text style={styles.taskAssignee}>For: {assignee.name}</Text>
          )}
          <View style={styles.taskMetaRow}>
            <Text style={styles.taskDue}>
              Due: {format(new Date(task.dueAt), "MMM d, yyyy")}
              {task.computedStatus === "overdue" && (
                <Text style={styles.overdueLabel}> (Overdue)</Text>
              )}
              {task.computedStatus === "expired" && (
                <Text style={styles.expiredLabel}> (Expired)</Text>
              )}
            </Text>
            {hasExpiration && (
              <View style={[styles.countdownBadge, isUrgent && styles.countdownBadgeUrgent]}>
                <Ionicons name="timer-outline" size={12} color={isUrgent ? "#FFFFFF" : colors.warning} />
                <Text style={[styles.countdownText, isUrgent && styles.countdownTextUrgent]}>
                  {timeRemaining}
                </Text>
              </View>
            )}
          </View>
        </View>
        {canComplete && task.status === "open" && (
          <TouchableOpacity
            style={styles.completeButton}
            onPress={() => currentMember?.id && handleCompleteTask(task.id, currentMember.id)}
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
        {task.computedStatus === "expired" && (
          <View style={styles.expiredIndicator}>
            <Ionicons name="close-circle" size={24} color={colors.error} />
          </View>
        )}
      </View>
    );
  };

  if (!currentMember && members.length === 0) {
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
  
  if (!currentMember) {
    return null; // Brief loading state while syncing
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.currentUserBar} data-testid="current-user-info">
          <View style={styles.actingAsLeft}>
            <View style={styles.actingAsAvatar}>
              <Text style={styles.actingAsAvatarText}>
                {currentMember.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={styles.actingAsName}>{currentMember.name}</Text>
              <Text style={styles.actingAsRole}>
                {isCurrentUserGuardian ? "Guardian" : "Participant"}
              </Text>
            </View>
          </View>
          <View style={styles.starsDisplay}>
            <Ionicons name="star" size={18} color={colors.secondary} />
            <Text style={styles.starsCount}>{currentMember.starsTotal}</Text>
          </View>
        </View>

        {isCurrentUserGuardian && (
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

        {!isCurrentUserGuardian && myTasks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My Tasks</Text>
            {myTasks.map((task) => renderTaskCard(task, false))}
          </View>
        )}

        {isCurrentUserGuardian && dueTodayTasks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Due Today</Text>
            {dueTodayTasks.map((task) => renderTaskCard(task, true))}
          </View>
        )}

        {isCurrentUserGuardian && overdueTasks.length > 0 && (
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

        {(isCurrentUserGuardian 
          ? dueTodayTasks.length === 0 && overdueTasks.length === 0 && pendingApprovalTasks.length === 0
          : myTasks.length === 0 && pendingApprovalTasks.length === 0
        ) && (
          <View style={styles.emptyState}>
            <Ionicons name="sunny-outline" size={64} color={colors.primary} />
            <Text style={styles.emptyTitle}>All Clear!</Text>
            <Text style={styles.emptyText}>
              {isCurrentUserGuardian
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
  currentUserBar: {
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
  starsDisplay: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.secondaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  starsCount: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.text,
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
  taskCardExpired: {
    borderLeftWidth: 4,
    borderLeftColor: colors.textMuted,
    opacity: 0.7,
  },
  taskCardPending: {
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  taskContent: {
    flex: 1,
  },
  taskHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  taskTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  taskTitle: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.text,
  },
  scheduleTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    gap: 2,
  },
  dailyBadge: {
    backgroundColor: colors.primary,
  },
  timedBadge: {
    backgroundColor: colors.warning,
  },
  scheduleTypeBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: "#FFFFFF",
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
  expiredLabel: {
    color: colors.textMuted,
    fontWeight: "600",
  },
  taskMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  countdownBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  countdownBadgeUrgent: {
    backgroundColor: colors.error,
  },
  countdownText: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: colors.warning,
  },
  countdownTextUrgent: {
    color: "#FFFFFF",
  },
  completeButton: {
    padding: spacing.sm,
  },
  doneIndicator: {
    padding: spacing.sm,
  },
  expiredIndicator: {
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

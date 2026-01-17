import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform, Animated } from "react-native";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius, fontSize } from "@/lib/theme";
import { useStore } from "@/lib/store";
import { StagedTask, TaskTemplate, Member } from "@/lib/types";
import { format } from "date-fns";

type SpinState = "idle" | "spinning" | "proposal";

interface SpinProposal {
  kid: Member;
  task: StagedTask;
}

export default function SpinScreen() {
  const router = useRouter();
  const spinQueue = useStore((s) => s.spinQueue);
  const members = useStore((s) => s.members);
  const taskTemplates = useStore((s) => s.taskTemplates);
  const lastWinnerIds = useStore((s) => s.lastWinnerIds);
  const addToSpinQueue = useStore((s) => s.addToSpinQueue);
  const removeFromSpinQueue = useStore((s) => s.removeFromSpinQueue);
  const addTaskInstance = useStore((s) => s.addTaskInstance);
  const recordWinner = useStore((s) => s.recordWinner);

  const [spinState, setSpinState] = useState<SpinState>("idle");
  const [proposal, setProposal] = useState<SpinProposal | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [quickTaskName, setQuickTaskName] = useState("");
  const [showTemplateSelect, setShowTemplateSelect] = useState(false);

  const rotateAnim = useRef(new Animated.Value(0)).current;
  const kids = members.filter((m) => m.role === "kid");
  const enabledTemplates = taskTemplates.filter((t) => t.enabled && !t.isArchived);

  const selectRandomKid = (): Member | null => {
    if (kids.length === 0) return null;
    if (kids.length === 1) return kids[0];

    const weights = kids.map((kid) => {
      const recentWins = lastWinnerIds.filter((id) => id === kid.id).length;
      return Math.max(1, 10 - recentWins * 3);
    });

    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < kids.length; i++) {
      random -= weights[i];
      if (random <= 0) return kids[i];
    }

    return kids[kids.length - 1];
  };

  const handleSpin = () => {
    if (spinQueue.length === 0 || kids.length === 0) return;

    setSpinState("spinning");
    
    Animated.sequence([
      Animated.timing(rotateAnim, {
        toValue: 5,
        duration: 1500,
        useNativeDriver: true,
      }),
    ]).start(() => {
      const selectedKid = selectRandomKid();
      const selectedTask = spinQueue[Math.floor(Math.random() * spinQueue.length)];
      
      if (selectedKid && selectedTask) {
        setProposal({ kid: selectedKid, task: selectedTask });
        setSpinState("proposal");
      } else {
        setSpinState("idle");
      }
      rotateAnim.setValue(0);
    });
  };

  const handleReroll = () => {
    setProposal(null);
    setSpinState("idle");
    setTimeout(() => handleSpin(), 100);
  };

  const handleAccept = () => {
    if (!proposal) return;

    let templateId = proposal.task.templateId;
    const existingTemplate = taskTemplates.find((t) => t.id === templateId);
    
    if (!existingTemplate) {
      const newTemplate = useStore.getState().addTaskTemplate({
        title: proposal.task.title,
        category: "personal",
        iconKey: "person",
        defaultStars: proposal.task.stars,
        difficulty: "medium",
        preferredPowers: [],
        enabled: true,
        isArchived: false,
      });
      templateId = newTemplate.id;
    }

    const today = format(new Date(), "yyyy-MM-dd");
    addTaskInstance({
      templateId: templateId!,
      assignedToMemberId: proposal.kid.id,
      dueAt: `${today}T12:00:00`,
      status: "open",
    });

    recordWinner(proposal.kid.id);
    removeFromSpinQueue(proposal.task.id);
    
    setProposal(null);
    setSpinState("idle");
  };

  const handleAddQuickTask = () => {
    if (!quickTaskName.trim()) return;
    
    addToSpinQueue({
      title: quickTaskName.trim(),
      stars: 1,
    });
    
    setQuickTaskName("");
    setShowAddModal(false);
  };

  const handleAddFromTemplate = (template: TaskTemplate) => {
    addToSpinQueue({
      title: template.title,
      stars: template.defaultStars,
      templateId: template.id,
    });
    setShowTemplateSelect(false);
    setShowAddModal(false);
  };

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 5],
    outputRange: ["0deg", "1800deg"],
  });

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.queueSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Spin Queue</Text>
            <TouchableOpacity 
              style={styles.addQueueButton}
              onPress={() => setShowAddModal(true)}
              data-testid="button-add-to-queue"
            >
              <Ionicons name="add-circle" size={20} color="#FFFFFF" />
              <Text style={styles.addQueueButtonText}>Add Task</Text>
            </TouchableOpacity>
          </View>

          {spinQueue.length === 0 ? (
            <View style={styles.emptyQueue}>
              <Ionicons name="layers-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyQueueText}>
                Add tasks to the queue before spinning
              </Text>
            </View>
          ) : (
            <View style={styles.queueList}>
              {spinQueue.map((task) => (
                <View key={task.id} style={styles.queueItem}>
                  <View style={styles.queueItemInfo}>
                    <Text style={styles.queueItemTitle}>{task.title}</Text>
                    <View style={styles.queueItemStars}>
                      <Ionicons name="star" size={12} color={colors.secondary} />
                      <Text style={styles.queueItemStarsText}>{task.stars}</Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    onPress={() => removeFromSpinQueue(task.id)}
                    data-testid={`button-remove-queue-${task.id}`}
                  >
                    <Ionicons name="close-circle" size={22} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.wheelSection}>
          <Animated.View style={[styles.wheel, { transform: [{ rotate }] }]}>
            <Ionicons name="sync" size={80} color={colors.primary} />
          </Animated.View>

          <TouchableOpacity
            style={[
              styles.spinButton,
              (spinQueue.length === 0 || kids.length === 0 || spinState === "spinning") && styles.spinButtonDisabled,
            ]}
            onPress={handleSpin}
            disabled={spinQueue.length === 0 || kids.length === 0 || spinState === "spinning"}
            data-testid="button-spin"
          >
            <Text style={styles.spinButtonText}>
              {spinState === "spinning" ? "Spinning..." : "Spin the Wheel!"}
            </Text>
          </TouchableOpacity>

          {kids.length === 0 && (
            <Text style={styles.warningText}>Add participants in Setup first</Text>
          )}
          {spinQueue.length === 0 && kids.length > 0 && (
            <Text style={styles.warningText}>Add tasks to the queue first</Text>
          )}
        </View>
      </ScrollView>

      <Modal visible={spinState === "proposal"} animationType="fade" transparent>
        <View style={styles.proposalOverlay}>
          <View style={styles.proposalContent}>
            <View style={styles.proposalHeader}>
              <Ionicons name="sparkles" size={32} color={colors.secondary} />
              <Text style={styles.proposalTitle}>Spin Result!</Text>
            </View>

            {proposal && (
              <>
                <TouchableOpacity 
                  style={styles.proposalKid}
                  onPress={() => {
                    setSpinState("idle");
                    setProposal(null);
                    router.push(`/member/${proposal.kid.id}`);
                  }}
                >
                  <View style={styles.proposalAvatar}>
                    <Text style={styles.proposalAvatarText}>
                      {proposal.kid.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.proposalKidName}>{proposal.kid.name}</Text>
                </TouchableOpacity>

                <Text style={styles.proposalAssigned}>will do:</Text>

                <View style={styles.proposalTask}>
                  <Text style={styles.proposalTaskTitle}>{proposal.task.title}</Text>
                  <View style={styles.proposalTaskStars}>
                    <Ionicons name="star" size={16} color={colors.secondary} />
                    <Text style={styles.proposalTaskStarsText}>{proposal.task.stars}</Text>
                  </View>
                </View>

                <View style={styles.proposalActions}>
                  <TouchableOpacity
                    style={styles.rerollButton}
                    onPress={handleReroll}
                    data-testid="button-reroll"
                  >
                    <Ionicons name="refresh" size={20} color={colors.primary} />
                    <Text style={styles.rerollButtonText}>Reroll</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={handleAccept}
                    data-testid="button-accept"
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                    <Text style={styles.acceptButtonText}>Accept</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={showAddModal} animationType="slide" transparent>
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Task to Queue</Text>
              <TouchableOpacity onPress={() => {
                setShowAddModal(false);
                setShowTemplateSelect(false);
              }}>
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            {!showTemplateSelect ? (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Quick Task</Text>
                  <View style={styles.quickTaskRow}>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Enter task name..."
                      placeholderTextColor={colors.textMuted}
                      value={quickTaskName}
                      onChangeText={setQuickTaskName}
                      data-testid="input-quick-task"
                    />
                    <TouchableOpacity
                      style={[
                        styles.quickAddButton,
                        !quickTaskName.trim() && styles.quickAddButtonDisabled,
                      ]}
                      onPress={handleAddQuickTask}
                      disabled={!quickTaskName.trim()}
                      data-testid="button-add-quick-task"
                    >
                      <Ionicons name="add" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.templateSelectButton}
                  onPress={() => setShowTemplateSelect(true)}
                  data-testid="button-show-templates"
                >
                  <Ionicons name="library-outline" size={20} color={colors.primary} />
                  <Text style={styles.templateSelectButtonText}>
                    Choose from Templates
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <ScrollView style={styles.templateList}>
                <TouchableOpacity
                  style={styles.backToQuickButton}
                  onPress={() => setShowTemplateSelect(false)}
                >
                  <Ionicons name="arrow-back" size={18} color={colors.primary} />
                  <Text style={styles.backToQuickButtonText}>Back to Quick Add</Text>
                </TouchableOpacity>

                {enabledTemplates.map((template) => (
                  <TouchableOpacity
                    key={template.id}
                    style={styles.templateItem}
                    onPress={() => handleAddFromTemplate(template)}
                    data-testid={`button-select-template-${template.id}`}
                  >
                    <View style={styles.templateItemInfo}>
                      <Text style={styles.templateItemTitle}>{template.title}</Text>
                      <View style={styles.templateItemMeta}>
                        <Text style={styles.templateItemCategory}>{template.category}</Text>
                        <View style={styles.templateItemStars}>
                          <Ionicons name="star" size={12} color={colors.secondary} />
                          <Text style={styles.templateItemStarsText}>{template.defaultStars}</Text>
                        </View>
                      </View>
                    </View>
                    <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
                  </TouchableOpacity>
                ))}

                {enabledTemplates.length === 0 && (
                  <View style={styles.noTemplates}>
                    <Text style={styles.noTemplatesText}>
                      No active templates. Add tasks in the Tasks tab first.
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
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
  },
  queueSection: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.text,
  },
  addQueueButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  addQueueButtonText: {
    color: "#FFFFFF",
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  emptyQueue: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: "dashed",
  },
  emptyQueueText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  queueList: {
    gap: spacing.sm,
  },
  queueItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  queueItemInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  queueItemTitle: {
    fontSize: fontSize.md,
    fontWeight: "500",
    color: colors.text,
    flex: 1,
  },
  queueItemStars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  queueItemStarsText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.secondary,
  },
  wheelSection: {
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  wheel: {
    width: 180,
    height: 180,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 8,
    borderColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  spinButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  spinButtonDisabled: {
    backgroundColor: colors.textMuted,
    shadowOpacity: 0,
  },
  spinButtonText: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  warningText: {
    fontSize: fontSize.sm,
    color: colors.warning,
    marginTop: spacing.md,
  },
  proposalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  proposalContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
  },
  proposalHeader: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  proposalTitle: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.sm,
  },
  proposalKid: {
    alignItems: "center",
    marginBottom: spacing.md,
  },
  proposalAvatar: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  proposalAvatarText: {
    fontSize: fontSize.xxxl,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  proposalKidName: {
    fontSize: fontSize.xl,
    fontWeight: "600",
    color: colors.primary,
  },
  proposalAssigned: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  proposalTask: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    width: "100%",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  proposalTaskTitle: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.text,
    textAlign: "center",
  },
  proposalTaskStars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: spacing.xs,
  },
  proposalTaskStarsText: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.secondary,
  },
  proposalActions: {
    flexDirection: "row",
    gap: spacing.md,
    width: "100%",
  },
  rerollButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.xs,
  },
  rerollButtonText: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.primary,
  },
  acceptButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.success,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.xs,
  },
  acceptButtonText: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: "#FFFFFF",
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
    maxHeight: "70%",
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
  inputGroup: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  quickTaskRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
    backgroundColor: colors.surfaceSecondary,
  },
  quickAddButton: {
    backgroundColor: colors.primary,
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  quickAddButtonDisabled: {
    backgroundColor: colors.textMuted,
  },
  templateSelectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  templateSelectButtonText: {
    fontSize: fontSize.md,
    fontWeight: "500",
    color: colors.primary,
  },
  templateList: {
    maxHeight: 400,
  },
  backToQuickButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  backToQuickButtonText: {
    fontSize: fontSize.sm,
    color: colors.primary,
  },
  templateItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  templateItemInfo: {
    flex: 1,
  },
  templateItemTitle: {
    fontSize: fontSize.md,
    fontWeight: "500",
    color: colors.text,
  },
  templateItemMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: spacing.sm,
  },
  templateItemCategory: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textTransform: "capitalize",
  },
  templateItemStars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  templateItemStarsText: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: colors.secondary,
  },
  noTemplates: {
    alignItems: "center",
    padding: spacing.xl,
  },
  noTemplatesText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    textAlign: "center",
  },
});

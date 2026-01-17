import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius, fontSize } from "@/lib/theme";
import { useStore } from "@/lib/store";
import { TaskTemplate, TaskCategory, TaskScheduleType } from "@/lib/types";

const CATEGORY_ICONS: Record<TaskCategory, string> = {
  cleaning: "sparkles",
  kitchen: "restaurant",
  learning: "book",
  kindness: "heart",
  prayer: "moon",
  outdoor: "leaf",
  personal: "person",
};

const SCHEDULE_TYPE_INFO: Record<TaskScheduleType, { label: string; icon: string; description: string }> = {
  one_time: { label: "One-Time", icon: "checkbox-outline", description: "Complete once" },
  recurring_daily: { label: "Daily", icon: "refresh", description: "Repeats each day" },
  time_sensitive: { label: "Timed", icon: "timer-outline", description: "Expires after set time" },
};

const TIME_WINDOW_OPTIONS = [5, 10, 15, 30, 60];

export default function TasksScreen() {
  const taskTemplates = useStore((s) => s.taskTemplates);
  const addTaskTemplate = useStore((s) => s.addTaskTemplate);
  const updateTaskTemplate = useStore((s) => s.updateTaskTemplate);
  const archiveTaskTemplate = useStore((s) => s.archiveTaskTemplate);
  const toggleTaskTemplate = useStore((s) => s.toggleTaskTemplate);
  const addToSpinQueue = useStore((s) => s.addToSpinQueue);

  const [showTemplates, setShowTemplates] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskTemplate | null>(null);
  
  const [newTitle, setNewTitle] = useState("");
  const [newStars, setNewStars] = useState("1");
  const [newCategory, setNewCategory] = useState<TaskCategory>("personal");
  const [newScheduleType, setNewScheduleType] = useState<TaskScheduleType>("one_time");
  const [newTimeWindow, setNewTimeWindow] = useState(15);

  const enabledTasks = taskTemplates.filter((t) => t.enabled && !t.isArchived);
  const archivedTasks = taskTemplates.filter((t) => t.isArchived);
  const disabledTasks = taskTemplates.filter((t) => !t.enabled && !t.isArchived);

  const handleAddTask = () => {
    if (!newTitle.trim()) return;
    
    addTaskTemplate({
      title: newTitle.trim(),
      category: newCategory,
      iconKey: CATEGORY_ICONS[newCategory],
      defaultStars: parseInt(newStars) || 1,
      difficulty: "medium",
      preferredPowers: [],
      enabled: true,
      isArchived: false,
      scheduleType: newScheduleType,
      timeWindowMinutes: newScheduleType === "time_sensitive" ? newTimeWindow : undefined,
    });
    
    setShowAddModal(false);
    setNewTitle("");
    setNewStars("1");
    setNewCategory("personal");
    setNewScheduleType("one_time");
    setNewTimeWindow(15);
  };

  const handleEditTask = () => {
    if (!editingTask || !newTitle.trim()) return;
    
    updateTaskTemplate(editingTask.id, {
      title: newTitle.trim(),
      defaultStars: parseInt(newStars) || 1,
      category: newCategory,
      iconKey: CATEGORY_ICONS[newCategory],
      scheduleType: newScheduleType,
      timeWindowMinutes: newScheduleType === "time_sensitive" ? newTimeWindow : undefined,
    });
    
    setShowEditModal(false);
    setEditingTask(null);
    setNewTitle("");
    setNewStars("1");
    setNewScheduleType("one_time");
    setNewTimeWindow(15);
  };

  const openEditModal = (task: TaskTemplate) => {
    setEditingTask(task);
    setNewTitle(task.title);
    setNewStars(task.defaultStars.toString());
    setNewCategory(task.category);
    setNewScheduleType(task.scheduleType || "one_time");
    setNewTimeWindow(task.timeWindowMinutes || 15);
    setShowEditModal(true);
  };

  const handleArchive = (task: TaskTemplate) => {
    archiveTaskTemplate(task.id);
  };

  const handleAddToSpin = (task: TaskTemplate) => {
    addToSpinQueue({
      title: task.title,
      stars: task.defaultStars,
      templateId: task.id,
    });
  };

  const renderTaskItem = (task: TaskTemplate, showActions = true) => (
    <View key={task.id} style={styles.taskItem} data-testid={`task-item-${task.id}`}>
      <TouchableOpacity 
        style={styles.taskToggle}
        onPress={() => toggleTaskTemplate(task.id)}
      >
        <Ionicons 
          name={task.enabled ? "checkbox" : "square-outline"} 
          size={24} 
          color={task.enabled ? colors.primary : colors.textMuted} 
        />
      </TouchableOpacity>
      
      <View style={styles.taskInfo}>
        <Text style={styles.taskTitle}>{task.title}</Text>
        <View style={styles.taskMeta}>
          <Ionicons name={CATEGORY_ICONS[task.category] as any} size={14} color={colors.textMuted} />
          <Text style={styles.taskCategory}>{task.category}</Text>
          <View style={styles.taskStars}>
            <Ionicons name="star" size={12} color={colors.secondary} />
            <Text style={styles.taskStarsText}>{task.defaultStars}</Text>
          </View>
        </View>
      </View>

      {showActions && (
        <View style={styles.taskActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleAddToSpin(task)}
            data-testid={`button-add-to-spin-${task.id}`}
          >
            <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => openEditModal(task)}
            data-testid={`button-edit-task-${task.id}`}
          >
            <Ionicons name="create-outline" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleArchive(task)}
            data-testid={`button-archive-task-${task.id}`}
          >
            <Ionicons name="archive-outline" size={22} color={colors.error} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => setShowAddModal(true)}
            data-testid="button-add-task"
          >
            <Ionicons name="add-circle" size={20} color="#FFFFFF" />
            <Text style={styles.addButtonText}>New Task</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.templatesButton}
            onPress={() => setShowTemplates(!showTemplates)}
            data-testid="button-toggle-templates"
          >
            <Ionicons name="library-outline" size={20} color={colors.primary} />
            <Text style={styles.templatesButtonText}>
              {showTemplates ? "Hide Disabled" : "Show All Templates"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Tasks ({enabledTasks.length})</Text>
          {enabledTasks.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="list-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>No active tasks. Add one above!</Text>
            </View>
          ) : (
            enabledTasks.map((task) => renderTaskItem(task))
          )}
        </View>

        {showTemplates && disabledTasks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Disabled Templates ({disabledTasks.length})</Text>
            {disabledTasks.map((task) => renderTaskItem(task))}
          </View>
        )}

        {archivedTasks.length > 0 && (
          <TouchableOpacity 
            style={styles.archivedToggle}
            onPress={() => {}}
          >
            <Text style={styles.archivedText}>
              {archivedTasks.length} archived task{archivedTasks.length > 1 ? "s" : ""}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <Modal visible={showAddModal} animationType="slide" transparent>
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Task</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Task Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="What needs to be done?"
                placeholderTextColor={colors.textMuted}
                value={newTitle}
                onChangeText={setNewTitle}
                data-testid="input-task-title"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Stars</Text>
              <View style={styles.starsInput}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <TouchableOpacity
                    key={n}
                    style={[
                      styles.starOption,
                      parseInt(newStars) === n && styles.starOptionActive,
                    ]}
                    onPress={() => setNewStars(n.toString())}
                  >
                    <Ionicons 
                      name="star" 
                      size={20} 
                      color={parseInt(newStars) >= n ? colors.secondary : colors.textMuted} 
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                {(Object.keys(CATEGORY_ICONS) as TaskCategory[]).map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryOption,
                      newCategory === cat && styles.categoryOptionActive,
                    ]}
                    onPress={() => setNewCategory(cat)}
                  >
                    <Ionicons 
                      name={CATEGORY_ICONS[cat] as any} 
                      size={18} 
                      color={newCategory === cat ? "#FFFFFF" : colors.text} 
                    />
                    <Text style={[
                      styles.categoryText,
                      newCategory === cat && styles.categoryTextActive,
                    ]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Schedule Type</Text>
              <View style={styles.scheduleTypeContainer}>
                {(Object.keys(SCHEDULE_TYPE_INFO) as TaskScheduleType[]).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.scheduleTypeOption,
                      newScheduleType === type && styles.scheduleTypeOptionActive,
                    ]}
                    onPress={() => setNewScheduleType(type)}
                    data-testid={`button-schedule-type-${type}`}
                  >
                    <Ionicons 
                      name={SCHEDULE_TYPE_INFO[type].icon as any} 
                      size={20} 
                      color={newScheduleType === type ? "#FFFFFF" : colors.text} 
                    />
                    <Text style={[
                      styles.scheduleTypeText,
                      newScheduleType === type && styles.scheduleTypeTextActive,
                    ]}>
                      {SCHEDULE_TYPE_INFO[type].label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {newScheduleType === "time_sensitive" && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Time Window (minutes)</Text>
                <View style={styles.timeWindowContainer}>
                  {TIME_WINDOW_OPTIONS.map((mins) => (
                    <TouchableOpacity
                      key={mins}
                      style={[
                        styles.timeWindowOption,
                        newTimeWindow === mins && styles.timeWindowOptionActive,
                      ]}
                      onPress={() => setNewTimeWindow(mins)}
                      data-testid={`button-time-window-${mins}`}
                    >
                      <Text style={[
                        styles.timeWindowText,
                        newTimeWindow === mins && styles.timeWindowTextActive,
                      ]}>
                        {mins}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.confirmButton,
                !newTitle.trim() && styles.confirmButtonDisabled,
              ]}
              onPress={handleAddTask}
              disabled={!newTitle.trim()}
              data-testid="button-confirm-add-task"
            >
              <Text style={styles.confirmButtonText}>Add Task</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showEditModal} animationType="slide" transparent>
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Task</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Task Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="What needs to be done?"
                placeholderTextColor={colors.textMuted}
                value={newTitle}
                onChangeText={setNewTitle}
                data-testid="input-edit-task-title"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Stars</Text>
              <View style={styles.starsInput}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <TouchableOpacity
                    key={n}
                    style={[
                      styles.starOption,
                      parseInt(newStars) === n && styles.starOptionActive,
                    ]}
                    onPress={() => setNewStars(n.toString())}
                  >
                    <Ionicons 
                      name="star" 
                      size={20} 
                      color={parseInt(newStars) >= n ? colors.secondary : colors.textMuted} 
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                {(Object.keys(CATEGORY_ICONS) as TaskCategory[]).map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryOption,
                      newCategory === cat && styles.categoryOptionActive,
                    ]}
                    onPress={() => setNewCategory(cat)}
                  >
                    <Ionicons 
                      name={CATEGORY_ICONS[cat] as any} 
                      size={18} 
                      color={newCategory === cat ? "#FFFFFF" : colors.text} 
                    />
                    <Text style={[
                      styles.categoryText,
                      newCategory === cat && styles.categoryTextActive,
                    ]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Schedule Type</Text>
              <View style={styles.scheduleTypeContainer}>
                {(Object.keys(SCHEDULE_TYPE_INFO) as TaskScheduleType[]).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.scheduleTypeOption,
                      newScheduleType === type && styles.scheduleTypeOptionActive,
                    ]}
                    onPress={() => setNewScheduleType(type)}
                    data-testid={`button-edit-schedule-type-${type}`}
                  >
                    <Ionicons 
                      name={SCHEDULE_TYPE_INFO[type].icon as any} 
                      size={20} 
                      color={newScheduleType === type ? "#FFFFFF" : colors.text} 
                    />
                    <Text style={[
                      styles.scheduleTypeText,
                      newScheduleType === type && styles.scheduleTypeTextActive,
                    ]}>
                      {SCHEDULE_TYPE_INFO[type].label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {newScheduleType === "time_sensitive" && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Time Window (minutes)</Text>
                <View style={styles.timeWindowContainer}>
                  {TIME_WINDOW_OPTIONS.map((mins) => (
                    <TouchableOpacity
                      key={mins}
                      style={[
                        styles.timeWindowOption,
                        newTimeWindow === mins && styles.timeWindowOptionActive,
                      ]}
                      onPress={() => setNewTimeWindow(mins)}
                      data-testid={`button-edit-time-window-${mins}`}
                    >
                      <Text style={[
                        styles.timeWindowText,
                        newTimeWindow === mins && styles.timeWindowTextActive,
                      ]}>
                        {mins}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.confirmButton,
                !newTitle.trim() && styles.confirmButtonDisabled,
              ]}
              onPress={handleEditTask}
              disabled={!newTitle.trim()}
              data-testid="button-confirm-edit-task"
            >
              <Text style={styles.confirmButtonText}>Save Changes</Text>
            </TouchableOpacity>
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
  headerActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  templatesButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  templatesButtonText: {
    color: colors.primary,
    fontSize: fontSize.sm,
    fontWeight: "500",
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
  taskItem: {
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
  taskToggle: {
    marginRight: spacing.md,
  },
  taskInfo: {
    flex: 1,
  },
  taskTitle: {
    fontSize: fontSize.md,
    fontWeight: "500",
    color: colors.text,
  },
  taskMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: spacing.xs,
  },
  taskCategory: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textTransform: "capitalize",
  },
  taskStars: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: spacing.sm,
    gap: 2,
  },
  taskStarsText: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: colors.secondary,
  },
  taskActions: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  actionButton: {
    padding: spacing.xs,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  archivedToggle: {
    alignItems: "center",
    padding: spacing.md,
  },
  archivedText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
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
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
    backgroundColor: colors.surfaceSecondary,
  },
  starsInput: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  starOption: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceSecondary,
  },
  starOptionActive: {
    backgroundColor: colors.surface,
  },
  categoryScroll: {
    flexGrow: 0,
  },
  categoryOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.md,
    marginRight: spacing.sm,
    gap: spacing.xs,
  },
  categoryOptionActive: {
    backgroundColor: colors.primary,
  },
  categoryText: {
    fontSize: fontSize.sm,
    color: colors.text,
    textTransform: "capitalize",
  },
  categoryTextActive: {
    color: "#FFFFFF",
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
  scheduleTypeContainer: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  scheduleTypeOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  scheduleTypeOptionActive: {
    backgroundColor: colors.primary,
  },
  scheduleTypeText: {
    fontSize: fontSize.xs,
    color: colors.text,
    fontWeight: "500",
  },
  scheduleTypeTextActive: {
    color: "#FFFFFF",
  },
  timeWindowContainer: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  timeWindowOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.md,
  },
  timeWindowOptionActive: {
    backgroundColor: colors.primary,
  },
  timeWindowText: {
    fontSize: fontSize.sm,
    color: colors.text,
    fontWeight: "600",
  },
  timeWindowTextActive: {
    color: "#FFFFFF",
  },
});

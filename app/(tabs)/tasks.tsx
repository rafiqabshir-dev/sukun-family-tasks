import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { useState, useMemo, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius, fontSize } from "@/lib/theme";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/authContext";
import { TaskTemplate, TaskCategory, TaskScheduleType, TaskInstance, Member } from "@/lib/types";
import { useLocalSearchParams, router } from "expo-router";
import { isToday, isBefore, startOfDay, parseISO, isAfter } from "date-fns";
import { isSupabaseConfigured } from "@/lib/supabase";
import { updateCloudTaskInstance, addStarsLedgerEntry } from "@/lib/cloudSync";
import { notifyTaskApproved, notifyTaskRejected, notifyTaskPendingApproval } from "@/lib/pushNotificationService";

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

const CATEGORY_ORDER: TaskCategory[] = [
  "cleaning",
  "kitchen", 
  "learning",
  "kindness",
  "prayer",
  "outdoor",
  "personal",
];

const SCHEDULE_TYPE_INFO: Record<TaskScheduleType, { label: string; icon: string; description: string }> = {
  one_time: { label: "One-Time", icon: "checkbox-outline", description: "Complete once" },
  recurring_daily: { label: "Daily", icon: "refresh", description: "Repeats each day" },
  time_sensitive: { label: "Timed", icon: "timer-outline", description: "Expires after set time" },
};

const TIME_WINDOW_OPTIONS = [5, 10, 15, 30, 60];

type ViewMode = "templates" | "assigned";
type TaskFilter = "all" | "today" | "overdue";

function getTaskDueStatus(task: TaskInstance): "today" | "overdue" | "upcoming" | "done" | "expired" {
  if (task.status === "approved") return "done"; // Database uses "approved", UI shows "done"
  if (task.status === "expired") return "expired";
  
  const now = new Date();
  
  if (task.expiresAt) {
    const expiresAt = parseISO(task.expiresAt);
    if (isAfter(now, expiresAt)) return "expired";
  }
  
  const dueDate = new Date(task.dueAt);
  const today = startOfDay(now);
  
  if (isBefore(dueDate, today)) return "overdue";
  if (isToday(dueDate)) return "today";
  return "upcoming";
}

export default function TasksScreen() {
  const params = useLocalSearchParams<{ view?: string; filter?: string }>();
  const { profile, family, refreshProfile } = useAuth();
  const isGuardian = profile?.role === 'guardian';
  
  const members = useStore((s) => s.members);
  const taskTemplates = useStore((s) => s.taskTemplates);
  const taskInstances = useStore((s) => s.taskInstances);
  const addTaskTemplate = useStore((s) => s.addTaskTemplate);
  const updateTaskTemplate = useStore((s) => s.updateTaskTemplate);
  const archiveTaskTemplate = useStore((s) => s.archiveTaskTemplate);
  const toggleTaskTemplate = useStore((s) => s.toggleTaskTemplate);
  const addToSpinQueue = useStore((s) => s.addToSpinQueue);
  const completeTask = useStore((s) => s.completeTask);
  const approveTask = useStore((s) => s.approveTask);
  const rejectTask = useStore((s) => s.rejectTask);

  // View mode and filter state - initialized from navigation params
  const [viewMode, setViewMode] = useState<ViewMode>(
    params.view === "assigned" ? "assigned" : "templates"
  );
  const [taskFilter, setTaskFilter] = useState<TaskFilter>(
    params.filter === "today" ? "today" : params.filter === "overdue" ? "overdue" : "all"
  );

  // Update state when navigation params change
  useEffect(() => {
    if (params.view === "assigned") {
      setViewMode("assigned");
    }
    if (params.filter === "today") {
      setTaskFilter("today");
    } else if (params.filter === "overdue") {
      setTaskFilter("overdue");
    }
  }, [params.view, params.filter]);

  const [showTemplates, setShowTemplates] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskTemplate | null>(null);
  
  const [newTitle, setNewTitle] = useState("");
  const [newStars, setNewStars] = useState("1");
  const [newCategory, setNewCategory] = useState<TaskCategory>("personal");
  const [newScheduleType, setNewScheduleType] = useState<TaskScheduleType>("one_time");
  const [newTimeWindow, setNewTimeWindow] = useState(15);
  
  const [expandedCategories, setExpandedCategories] = useState<Set<TaskCategory>>(new Set());
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set(members.map(m => m.id)));
  const [isClearingOverdue, setIsClearingOverdue] = useState(false);
  
  const toggleCategoryExpanded = (category: TaskCategory) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const toggleMemberExpanded = (memberId: string) => {
    setExpandedMembers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(memberId)) {
        newSet.delete(memberId);
      } else {
        newSet.add(memberId);
      }
      return newSet;
    });
  };

  const activeTasks = taskTemplates.filter((t) => !t.isArchived);
  const enabledTasks = activeTasks.filter((t) => t.enabled);

  // Get active task instances (not approved/expired)
  const activeInstances = useMemo(() => {
    return taskInstances.filter(i => 
      i.status !== "approved" && i.status !== "expired"
    );
  }, [taskInstances]);

  // Count tasks assigned today per category
  const categoryAssignedToday = useMemo(() => {
    const counts: Record<TaskCategory, number> = {
      cleaning: 0, kitchen: 0, learning: 0, kindness: 0,
      prayer: 0, outdoor: 0, personal: 0,
    };
    
    const today = startOfDay(new Date());
    
    activeInstances.forEach((instance) => {
      const template = taskTemplates.find(t => t.id === instance.templateId);
      if (template) {
        const dueDate = new Date(instance.dueAt);
        if (isToday(dueDate) || isBefore(dueDate, today)) {
          counts[template.category]++;
        }
      }
    });
    
    return counts;
  }, [activeInstances, taskTemplates]);

  // Get assignees per category (up to 3)
  const categoryAssignees = useMemo(() => {
    const assignees: Record<TaskCategory, Member[]> = {
      cleaning: [], kitchen: [], learning: [], kindness: [],
      prayer: [], outdoor: [], personal: [],
    };
    
    activeInstances.forEach((instance) => {
      const template = taskTemplates.find(t => t.id === instance.templateId);
      const member = members.find(m => m.id === instance.assignedToMemberId);
      if (template && member) {
        if (!assignees[template.category].find(m => m.id === member.id)) {
          if (assignees[template.category].length < 3) {
            assignees[template.category].push(member);
          }
        }
      }
    });
    
    return assignees;
  }, [activeInstances, taskTemplates, members]);

  // Group tasks by category
  const groupTasksByCategory = (tasks: TaskTemplate[]) => {
    const groups: Record<TaskCategory, TaskTemplate[]> = {
      cleaning: [], kitchen: [], learning: [], kindness: [],
      prayer: [], outdoor: [], personal: [],
    };
    tasks.forEach((task) => {
      groups[task.category].push(task);
    });
    return groups;
  };

  const taskGroups = groupTasksByCategory(activeTasks);

  // Toggle all tasks in a category
  const toggleCategoryTasks = (category: TaskCategory, enabled: boolean) => {
    const tasksInCategory = taskGroups[category];
    tasksInCategory.forEach((task) => {
      if (task.enabled !== enabled) {
        toggleTaskTemplate(task.id);
      }
    });
  };

  const isCategoryFullyEnabled = (category: TaskCategory) => {
    const tasks = taskGroups[category];
    return tasks.length > 0 && tasks.every((t) => t.enabled);
  };

  const isCategoryPartiallyEnabled = (category: TaskCategory) => {
    const tasks = taskGroups[category];
    const enabledCount = tasks.filter((t) => t.enabled).length;
    return enabledCount > 0 && enabledCount < tasks.length;
  };

  // Group instances by member for Assigned Tasks view
  const instancesByMember = useMemo(() => {
    const grouped: Record<string, TaskInstance[]> = {};
    
    members.forEach((member) => {
      grouped[member.id] = [];
    });
    
    activeInstances.forEach((instance) => {
      const status = getTaskDueStatus(instance);
      
      // Apply filter
      if (taskFilter === "today" && status !== "today" && status !== "overdue") return;
      if (taskFilter === "overdue" && status !== "overdue") return;
      
      if (grouped[instance.assignedToMemberId]) {
        grouped[instance.assignedToMemberId].push(instance);
      }
    });
    
    return grouped;
  }, [activeInstances, members, taskFilter]);

  // Count for filter badges
  const filterCounts = useMemo(() => {
    let todayCount = 0;
    let overdueCount = 0;
    
    activeInstances.forEach((instance) => {
      const status = getTaskDueStatus(instance);
      if (status === "today") todayCount++;
      if (status === "overdue") overdueCount++;
    });
    
    return { today: todayCount, overdue: overdueCount, all: activeInstances.length };
  }, [activeInstances]);

  // Get overdue task instances for clear button
  const overdueTasks = useMemo(() => {
    return activeInstances.filter(instance => {
      const status = getTaskDueStatus(instance);
      return status === "overdue";
    });
  }, [activeInstances]);

  // Handle clearing all overdue tasks (marks as done without awarding stars)
  const handleClearAllOverdueTasks = async () => {
    if (!isGuardian || overdueTasks.length === 0) return;
    
    Alert.alert(
      "Clear All Overdue Tasks",
      `This will mark ${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''} as done WITHOUT awarding stars. This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            setIsClearingOverdue(true);
            try {
              for (const task of overdueTasks) {
                // Use "approved" for cloud (valid DB status)
                if (isSupabaseConfigured()) {
                  await updateCloudTaskInstance(task.id, { 
                    status: "approved", 
                    completedAt: new Date().toISOString() 
                  });
                }
                // Update local state directly
                useStore.setState((state) => ({
                  taskInstances: state.taskInstances.map((t) =>
                    t.id === task.id
                      ? { ...t, status: "approved" as const, completedAt: new Date().toISOString() }
                      : t
                  ),
                }));
              }
              await refreshProfile();
            } catch (error) {
              console.error("[Tasks] Error clearing overdue tasks:", error);
              Alert.alert("Error", "Failed to clear some tasks. Please try again.");
            } finally {
              setIsClearingOverdue(false);
            }
          }
        }
      ]
    );
  };

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

  const handleMarkDone = async (instance: TaskInstance) => {
    const template = taskTemplates.find(t => t.id === instance.templateId);
    if (!template || !profile?.id) return;

    // Check if current user can complete without approval
    const assignedMember = members.find(m => m.id === instance.assignedToMemberId);
    const guardianCount = members.filter(m => m.role === 'guardian').length;
    const needsApproval = assignedMember?.role === 'kid' || (assignedMember?.role === 'guardian' && guardianCount > 1);

    if (needsApproval) {
      // Request approval - pass profile.id to let store handle the status correctly
      completeTask(instance.id, profile.id);
      
      if (isSupabaseConfigured()) {
        await updateCloudTaskInstance(instance.id, {
          status: 'pending_approval',
          completion_requested_at: new Date().toISOString(),
          completion_requested_by: profile.id,
        });
        
        // Notify guardians
        const guardians = members.filter(m => m.role === 'guardian' && m.profileId !== profile.id);
        for (const guardian of guardians) {
          if (guardian.profileId) {
            await notifyTaskPendingApproval(guardian.profileId, template.title, assignedMember?.name || 'Someone');
          }
        }
      }
    } else {
      // Auto-approve for single guardian completing their own task
      approveTask(instance.id);
      
      if (isSupabaseConfigured() && family?.id) {
        await updateCloudTaskInstance(instance.id, {
          status: 'approved',
          completed_at: new Date().toISOString(),
          approved_by: profile?.id,
        });
        
        // Award stars - correct param order: familyId, profileId, delta, reason, createdById, taskInstanceId
        if (assignedMember?.profileId && profile?.id) {
          await addStarsLedgerEntry(family.id, assignedMember.profileId, template.defaultStars, 'task_completion', profile.id, instance.id);
        }
      }
    }
  };

  const handleApprove = async (instance: TaskInstance) => {
    const template = taskTemplates.find(t => t.id === instance.templateId);
    const assignedMember = members.find(m => m.id === instance.assignedToMemberId);
    if (!template || !assignedMember) return;

    approveTask(instance.id);
    
    if (isSupabaseConfigured() && family?.id) {
      await updateCloudTaskInstance(instance.id, {
        status: 'approved',
        completed_at: new Date().toISOString(),
        approved_by: profile?.id,
      });

      // Award stars - correct param order: familyId, profileId, delta, reason, createdById, taskInstanceId
      if (assignedMember.profileId && profile?.id) {
        await addStarsLedgerEntry(family.id, assignedMember.profileId, template.defaultStars, 'task_completion', profile.id, instance.id);
        await notifyTaskApproved(assignedMember.profileId, template.title, template.defaultStars);
      }
    }

    refreshProfile?.();
  };

  const handleReject = async (instance: TaskInstance) => {
    const template = taskTemplates.find(t => t.id === instance.templateId);
    const assignedMember = members.find(m => m.id === instance.assignedToMemberId);
    if (!template) return;

    rejectTask(instance.id);
    
    if (isSupabaseConfigured()) {
      await updateCloudTaskInstance(instance.id, {
        status: 'open',
        completion_requested_at: null,
        completion_requested_by: null,
      });

      if (assignedMember?.profileId) {
        await notifyTaskRejected(assignedMember.profileId, template.title);
      }
    }
  };

  const renderAssigneeChips = (category: TaskCategory) => {
    const assignees = categoryAssignees[category];
    if (assignees.length === 0) return null;

    return (
      <View style={styles.assigneeChips}>
        {assignees.map((member) => (
          <View key={member.id} style={styles.assigneeChip}>
            {member.avatar ? (
              <Text style={styles.chipAvatar}>{member.avatar}</Text>
            ) : (
              <Text style={styles.chipInitial}>{member.name.charAt(0)}</Text>
            )}
          </View>
        ))}
      </View>
    );
  };

  const renderTaskItem = (task: TaskTemplate, showActions = true) => (
    <View key={task.id} style={styles.taskItem} data-testid={`task-item-${task.id}`}>
      {isGuardian ? (
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
      ) : (
        <View style={styles.taskToggle}>
          <Ionicons 
            name={task.enabled ? "checkbox" : "square-outline"} 
            size={24} 
            color={task.enabled ? colors.primary : colors.textMuted} 
          />
        </View>
      )}
      
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

      {showActions && isGuardian && (
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

  const renderInstanceItem = (instance: TaskInstance) => {
    const template = taskTemplates.find(t => t.id === instance.templateId);
    if (!template) return null;

    const status = getTaskDueStatus(instance);
    const isPending = instance.status === 'pending_approval';
    const canApprove = isGuardian && isPending;
    const canMarkDone = instance.status === 'open';

    return (
      <View key={instance.id} style={styles.instanceItem} data-testid={`instance-item-${instance.id}`}>
        <View style={styles.instanceIcon}>
          <Ionicons name={CATEGORY_ICONS[template.category] as any} size={20} color={colors.primary} />
        </View>
        
        <View style={styles.instanceInfo}>
          <Text style={styles.instanceTitle}>{template.title}</Text>
          <View style={styles.instanceMeta}>
            <View style={[
              styles.dueBadge,
              status === "overdue" && styles.dueBadgeOverdue,
              status === "today" && styles.dueBadgeToday,
            ]}>
              <Ionicons 
                name={status === "overdue" ? "alert-circle" : "time-outline"} 
                size={12} 
                color={status === "overdue" ? colors.error : status === "today" ? colors.primary : colors.textMuted} 
              />
              <Text style={[
                styles.dueText,
                status === "overdue" && styles.dueTextOverdue,
                status === "today" && styles.dueTextToday,
              ]}>
                {status === "overdue" ? "Overdue" : status === "today" ? "Due Today" : "Upcoming"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.instanceActions}>
          {canApprove && (
            <>
              <TouchableOpacity 
                style={styles.approveButton}
                onPress={() => handleApprove(instance)}
                data-testid={`button-approve-${instance.id}`}
              >
                <Text style={styles.approveButtonText}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.rejectButton}
                onPress={() => handleReject(instance)}
                data-testid={`button-reject-${instance.id}`}
              >
                <Ionicons name="close" size={18} color={colors.error} />
              </TouchableOpacity>
            </>
          )}
          {canMarkDone && (
            <TouchableOpacity 
              style={styles.markDoneButton}
              onPress={() => handleMarkDone(instance)}
              data-testid={`button-mark-done-${instance.id}`}
            >
              <Text style={styles.markDoneText}>Mark Done</Text>
            </TouchableOpacity>
          )}
          {isPending && !canApprove && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingText}>Pending</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderBrowseTemplates = () => (
    <View style={styles.section}>
      {activeTasks.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="list-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyText}>No tasks. Add one above!</Text>
        </View>
      ) : (
        CATEGORY_ORDER.map((category) => {
          const tasksInCategory = taskGroups[category];
          if (tasksInCategory.length === 0) return null;
          
          const isFullyEnabled = isCategoryFullyEnabled(category);
          const isPartiallyEnabled = isCategoryPartiallyEnabled(category);
          const enabledCount = tasksInCategory.filter((t) => t.enabled).length;
          const assignedToday = categoryAssignedToday[category];
          
          const isExpanded = expandedCategories.has(category);
          
          return (
            <View key={category} style={styles.categoryGroup}>
              <TouchableOpacity 
                style={styles.categoryHeader}
                onPress={() => toggleCategoryExpanded(category)}
                activeOpacity={0.7}
                data-testid={`expand-category-${category}`}
              >
                <Ionicons
                  name={isExpanded ? "chevron-down" : "chevron-forward"}
                  size={20}
                  color={colors.textSecondary}
                />
                {isGuardian ? (
                  <TouchableOpacity
                    style={styles.categoryToggle}
                    onPress={(e) => {
                      e.stopPropagation();
                      toggleCategoryTasks(category, !isFullyEnabled);
                    }}
                    data-testid={`toggle-category-${category}`}
                  >
                    <Ionicons
                      name={isFullyEnabled ? "checkbox" : isPartiallyEnabled ? "remove-circle" : "square-outline"}
                      size={22}
                      color={isFullyEnabled ? colors.primary : isPartiallyEnabled ? colors.primaryLight : colors.textMuted}
                    />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.categoryToggle}>
                    <Ionicons
                      name={isFullyEnabled ? "checkbox" : isPartiallyEnabled ? "remove-circle" : "square-outline"}
                      size={22}
                      color={isFullyEnabled ? colors.primary : isPartiallyEnabled ? colors.primaryLight : colors.textMuted}
                    />
                  </View>
                )}
                <Ionicons name={CATEGORY_ICONS[category] as any} size={18} color={colors.primary} />
                <Text style={styles.categoryTitle}>{CATEGORY_LABELS[category]}</Text>
                <View style={styles.categoryRight}>
                  {assignedToday > 0 && (
                    <View style={styles.assignedBadge}>
                      <Text style={styles.assignedBadgeText}>{assignedToday} today</Text>
                    </View>
                  )}
                  {renderAssigneeChips(category)}
                  <Text style={styles.categoryCount}>
                    {enabledCount}/{tasksInCategory.length}
                  </Text>
                </View>
              </TouchableOpacity>
              {isExpanded && (
                <View style={styles.categoryTasks}>
                  {tasksInCategory.map((task) => renderTaskItem(task))}
                </View>
              )}
            </View>
          );
        })
      )}
    </View>
  );

  const renderAssignedTasks = () => (
    <View style={styles.section}>
      {/* Filters */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterButton, taskFilter === "all" && styles.filterButtonActive]}
          onPress={() => setTaskFilter("all")}
          data-testid="filter-all"
        >
          <Ionicons name="list" size={16} color={taskFilter === "all" ? "#FFFFFF" : colors.text} />
          <Text style={[styles.filterText, taskFilter === "all" && styles.filterTextActive]}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, taskFilter === "today" && styles.filterButtonActive]}
          onPress={() => setTaskFilter("today")}
          data-testid="filter-today"
        >
          <Text style={[styles.filterText, taskFilter === "today" && styles.filterTextActive]}>
            Due Today
          </Text>
          {filterCounts.today > 0 && (
            <View style={[styles.filterBadge, taskFilter === "today" && styles.filterBadgeActive]}>
              <Text style={[styles.filterBadgeText, taskFilter === "today" && styles.filterBadgeTextActive]}>
                {filterCounts.today}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, taskFilter === "overdue" && styles.filterButtonActive, filterCounts.overdue > 0 && styles.filterButtonOverdue]}
          onPress={() => setTaskFilter("overdue")}
          data-testid="filter-overdue"
        >
          <Text style={[styles.filterText, taskFilter === "overdue" && styles.filterTextActive]}>
            Overdue
          </Text>
          {filterCounts.overdue > 0 && (
            <View style={[styles.filterBadge, styles.filterBadgeOverdue]}>
              <Text style={styles.filterBadgeTextOverdue}>{filterCounts.overdue}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Clear All Overdue Button - Guardians Only */}
      {isGuardian && overdueTasks.length > 0 && (
        <TouchableOpacity
          style={styles.clearAllOverdueButton}
          onPress={handleClearAllOverdueTasks}
          disabled={isClearingOverdue}
          data-testid="button-clear-all-overdue"
        >
          <Ionicons name="trash-outline" size={18} color={colors.error} />
          <Text style={styles.clearAllOverdueText}>
            {isClearingOverdue 
              ? "Clearing..." 
              : `Clear All ${overdueTasks.length} Overdue Task${overdueTasks.length > 1 ? 's' : ''}`}
          </Text>
        </TouchableOpacity>
      )}

      {/* Members with their tasks */}
      {members.map((member) => {
        const memberInstances = instancesByMember[member.id] || [];
        const isExpanded = expandedMembers.has(member.id);
        
        return (
          <View key={member.id} style={styles.memberGroup}>
            <TouchableOpacity 
              style={styles.memberHeader}
              onPress={() => toggleMemberExpanded(member.id)}
              activeOpacity={0.7}
              data-testid={`expand-member-${member.id}`}
            >
              <View style={styles.memberAvatar}>
                {member.avatar ? (
                  <Text style={styles.avatarEmoji}>{member.avatar}</Text>
                ) : (
                  <Text style={styles.avatarInitial}>{member.name.charAt(0)}</Text>
                )}
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{member.name}</Text>
                <Text style={styles.memberRole}>
                  {member.role === "guardian" ? "Guardian" : "Participant"}
                </Text>
              </View>
              <View style={styles.memberStats}>
                <Ionicons name="star" size={16} color={colors.secondary} />
                <Text style={styles.memberStars}>{member.starsTotal}</Text>
              </View>
              <Text style={styles.memberTaskCount}>{memberInstances.length}</Text>
              <Ionicons
                name={isExpanded ? "chevron-down" : "chevron-forward"}
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
            
            {isExpanded && memberInstances.length > 0 && (
              <View style={styles.memberTasks}>
                {memberInstances.map((instance) => renderInstanceItem(instance))}
              </View>
            )}
            
            {isExpanded && memberInstances.length === 0 && (
              <View style={styles.noTasksMessage}>
                <Text style={styles.noTasksText}>No tasks matching filter</Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* View Mode Toggle */}
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.viewButton, viewMode === "templates" && styles.viewButtonActive]}
            onPress={() => setViewMode("templates")}
            data-testid="view-templates"
          >
            <Ionicons name="list-outline" size={18} color={viewMode === "templates" ? "#FFFFFF" : colors.text} />
            <Text style={[styles.viewButtonText, viewMode === "templates" && styles.viewButtonTextActive]}>
              Browse Templates
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewButton, viewMode === "assigned" && styles.viewButtonActive]}
            onPress={() => setViewMode("assigned")}
            data-testid="view-assigned"
          >
            <Ionicons name="people-outline" size={18} color={viewMode === "assigned" ? "#FFFFFF" : colors.text} />
            <Text style={[styles.viewButtonText, viewMode === "assigned" && styles.viewButtonTextActive]}>
              Assigned Tasks
            </Text>
          </TouchableOpacity>
        </View>

        {viewMode === "templates" && isGuardian && (
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => setShowAddModal(true)}
              data-testid="button-add-task"
            >
              <Ionicons name="add-circle" size={20} color="#FFFFFF" />
              <Text style={styles.addButtonText}>New Task</Text>
            </TouchableOpacity>
          </View>
        )}

        {viewMode === "templates" ? renderBrowseTemplates() : renderAssignedTasks()}
      </ScrollView>

      {/* Add Task Modal */}
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

      {/* Edit Task Modal */}
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
  viewToggle: {
    flexDirection: "row",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.lg,
    padding: 4,
    marginBottom: spacing.lg,
  },
  viewButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  viewButtonActive: {
    backgroundColor: colors.primary,
  },
  viewButtonText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text,
  },
  viewButtonTextActive: {
    color: "#FFFFFF",
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
  section: {
    marginBottom: spacing.xl,
  },
  filterRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
  },
  filterButtonOverdue: {
    borderWidth: 1,
    borderColor: colors.error,
  },
  filterText: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: colors.text,
  },
  filterTextActive: {
    color: "#FFFFFF",
  },
  filterBadge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 4,
  },
  filterBadgeActive: {
    backgroundColor: "#FFFFFF",
  },
  filterBadgeOverdue: {
    backgroundColor: colors.error,
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  filterBadgeTextActive: {
    color: colors.primary,
  },
  filterBadgeTextOverdue: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "600",
  },
  clearAllOverdueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.errorLight,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.error,
  },
  clearAllOverdueText: {
    color: colors.error,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  categoryGroup: {
    marginBottom: spacing.lg,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  categoryToggle: {
    marginRight: spacing.xs,
  },
  categoryTitle: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.text,
  },
  categoryRight: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
  categoryCount: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  assignedBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  assignedBadgeText: {
    fontSize: fontSize.xs,
    color: colors.primary,
    fontWeight: "500",
  },
  assigneeChips: {
    flexDirection: "row",
    gap: 4,
  },
  assigneeChip: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipAvatar: {
    fontSize: 14,
  },
  chipInitial: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.primary,
  },
  categoryTasks: {
    paddingLeft: spacing.sm,
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
  memberGroup: {
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    overflow: "hidden",
  },
  memberHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    gap: spacing.sm,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarEmoji: {
    fontSize: 24,
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.primary,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.text,
  },
  memberRole: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  memberStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  memberStars: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.secondary,
  },
  memberTaskCount: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.primary,
    marginLeft: spacing.sm,
  },
  memberTasks: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  noTasksMessage: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  noTasksText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontStyle: "italic",
  },
  instanceItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  instanceIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  instanceInfo: {
    flex: 1,
  },
  instanceTitle: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: colors.text,
  },
  instanceMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: spacing.xs,
  },
  dueBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surface,
  },
  dueBadgeToday: {
    backgroundColor: colors.primaryLight,
  },
  dueBadgeOverdue: {
    backgroundColor: "#FFE5E5",
  },
  dueText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  dueTextToday: {
    color: colors.primary,
  },
  dueTextOverdue: {
    color: colors.error,
  },
  instanceActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  markDoneButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  markDoneText: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  approveButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  approveButtonText: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  rejectButton: {
    padding: spacing.xs,
  },
  pendingBadge: {
    backgroundColor: colors.secondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  pendingText: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: "#FFFFFF",
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

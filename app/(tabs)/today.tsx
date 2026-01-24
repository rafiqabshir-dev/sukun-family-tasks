import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Pressable, Alert, Platform, KeyboardAvoidingView, RefreshControl } from "react-native";
import { useState, useMemo, useEffect, useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius, fontSize } from "@/lib/theme";
import { useStore } from "@/lib/store";
import { TaskInstance, TaskTemplate } from "@/lib/types";
import { useAuth } from "@/lib/authContext";
import { format, isToday, isBefore, startOfDay, differenceInMinutes, differenceInSeconds, parseISO, isAfter } from "date-fns";
import { isSupabaseConfigured } from "@/lib/supabase";
import { addStarsLedgerEntry, createCloudTask, createCloudTaskInstance, updateCloudTaskInstance, cloudInstanceToLocal, taskToTemplate, archiveCloudTask } from "@/lib/cloudSync";
import { notifyTaskAssigned, notifyTaskPendingApproval, notifyTaskApproved, notifyTaskRejected } from "@/lib/pushNotificationService";
import { useResponsive } from "@/lib/useResponsive";
import { DashboardCards } from "@/components/DashboardCards";

function getTaskStatus(task: TaskInstance): "open" | "pending_approval" | "done" | "overdue" | "expired" {
  if (task.status === "approved") return "done"; // Database uses "approved", UI shows "done"
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
  const { profile, refreshProfile } = useAuth();
  const responsive = useResponsive();
  const members = useStore((s) => s.members);
  const taskTemplates = useStore((s) => s.taskTemplates);
  const taskInstances = useStore((s) => s.taskInstances);
  const addTaskInstance = useStore((s) => s.addTaskInstance);
  const addTaskInstanceFromCloud = useStore((s) => s.addTaskInstanceFromCloud);
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
  // Multi-select state for task assignment
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());
  const [selectedKidIds, setSelectedKidIds] = useState<Set<string>>(new Set());
  const [taskSearchQuery, setTaskSearchQuery] = useState("");
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set(["all"]));
  const [dueDate, setDueDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [isAssigning, setIsAssigning] = useState(false);
  const [deductKid, setDeductKid] = useState<string>("");
  const [deductAmount, setDeductAmount] = useState<number>(1);
  const [deductReason, setDeductReason] = useState<string>("");
  // One-off task state
  const [showOneOffForm, setShowOneOffForm] = useState(false);
  const [oneOffTitle, setOneOffTitle] = useState("");
  const [oneOffStars, setOneOffStars] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isClearingOverdue, setIsClearingOverdue] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshProfile();
    } catch (err) {
      console.error('[Today] Refresh error:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshProfile]);

  // Current user is strictly the authenticated user - no fallback to cached data
  const currentMember = profile ? members.find((m) => m.id === profile.id || m.profileId === profile.id) : null;
  const isCurrentUserGuardian = currentMember?.role === "guardian";
  
  // Debug logging for ID matching
  useEffect(() => {
    if (profile) {
      console.log('[Today Debug] === ID MATCHING CHECK ===');
      console.log('[Today Debug] profile.id:', profile.id);
      console.log('[Today Debug] members count:', members.length);
      members.forEach((m, idx) => {
        console.log(`[Today Debug] member[${idx}]: id=${m.id}, profileId=${m.profileId}, name=${m.name}, role=${m.role}`);
      });
      console.log('[Today Debug] currentMember found:', currentMember?.name, currentMember?.id);
      console.log('[Today Debug] taskInstances count:', taskInstances.length);
      taskInstances.forEach((t, idx) => {
        console.log(`[Today Debug] task[${idx}]: id=${t.id.slice(-8)}, assignedToMemberId=${t.assignedToMemberId}, status=${t.status}`);
      });
    }
  }, [profile, members, taskInstances, currentMember]);
  
  // Count guardians for approval logic
  const guardianCount = members.filter((m) => m.role === "guardian").length;

  const openAssignModal = () => {
    // Auto-select all cloud-synced family members by default (guardians + kids)
    // Filter out local-only members that don't have cloud profiles
    const cloudMemberIds = members
      .filter(m => m.profileId || !m.id.startsWith('member-'))
      .map(m => m.id);
    setSelectedKidIds(new Set(cloudMemberIds));
    setSelectedTemplateIds(new Set());
    setTaskSearchQuery("");
    setExpandedTags(new Set(["all"]));
    setDueDate(format(new Date(), "yyyy-MM-dd"));
    setShowOneOffForm(false);
    setOneOffTitle("");
    setOneOffStars(1);
    setShowAssignModal(true);
  };

  // Only cloud-synced members can be assigned tasks (those with valid profile IDs)
  // Filter out local-only members (those with IDs starting with 'member-')
  const cloudMembers = members.filter((m) => m.profileId || !m.id.startsWith('member-'));
  const assignees = cloudMembers;
  // Kids only (for deducting stars) - also filter for cloud members
  const kids = cloudMembers.filter((m) => m.role === "kid");
  const enabledTemplates = taskTemplates.filter((t) => t.enabled);

  // Predefined tags for grouping tasks
  const TASK_TAGS = [
    { key: "morning", label: "Morning Routine", icon: "sunny-outline" as const },
    { key: "before-bed", label: "Before Bed", icon: "moon-outline" as const },
    { key: "chores", label: "Chores", icon: "home-outline" as const },
    { key: "learning", label: "Learning", icon: "book-outline" as const },
    { key: "kindness", label: "Kindness", icon: "heart-outline" as const },
  ];

  // Filter templates by search query
  const filteredTemplates = useMemo(() => {
    if (!taskSearchQuery.trim()) return enabledTemplates;
    const query = taskSearchQuery.toLowerCase();
    return enabledTemplates.filter(t => 
      t.title.toLowerCase().includes(query) ||
      (t.tags || []).some(tag => tag.toLowerCase().includes(query)) ||
      t.category.toLowerCase().includes(query)
    );
  }, [enabledTemplates, taskSearchQuery]);

  // Group templates by tag
  const templatesByTag = useMemo(() => {
    const groups: Record<string, typeof filteredTemplates> = { all: filteredTemplates };
    TASK_TAGS.forEach(tag => {
      groups[tag.key] = filteredTemplates.filter(t => 
        (t.tags || []).includes(tag.key) || t.category === tag.key
      );
    });
    // Add "other" for templates without tags
    groups.other = filteredTemplates.filter(t => 
      !(t.tags?.length) && !TASK_TAGS.some(tag => t.category === tag.key)
    );
    return groups;
  }, [filteredTemplates]);

  // Toggle template selection
  const toggleTemplateSelection = (templateId: string) => {
    setSelectedTemplateIds(prev => {
      const next = new Set(prev);
      if (next.has(templateId)) {
        next.delete(templateId);
      } else {
        next.add(templateId);
      }
      return next;
    });
  };

  // Toggle kid selection
  const toggleKidSelection = (kidId: string) => {
    setSelectedKidIds(prev => {
      const next = new Set(prev);
      if (next.has(kidId)) {
        next.delete(kidId);
      } else {
        next.add(kidId);
      }
      return next;
    });
  };

  // Select/deselect all templates in a tag group
  const toggleTagTemplates = (tagKey: string, select: boolean) => {
    const tagTemplates = templatesByTag[tagKey] || [];
    setSelectedTemplateIds(prev => {
      const next = new Set(prev);
      tagTemplates.forEach(t => {
        if (select) {
          next.add(t.id);
        } else {
          next.delete(t.id);
        }
      });
      return next;
    });
  };

  // Toggle tag expansion
  const toggleTagExpanded = (tagKey: string) => {
    setExpandedTags(prev => {
      const next = new Set(prev);
      if (next.has(tagKey)) {
        next.delete(tagKey);
      } else {
        next.add(tagKey);
      }
      return next;
    });
  };

  // Check if all templates in a tag are selected
  const areAllTagTemplatesSelected = (tagKey: string) => {
    const tagTemplates = templatesByTag[tagKey] || [];
    return tagTemplates.length > 0 && tagTemplates.every(t => selectedTemplateIds.has(t.id));
  };

  const tasksWithStatus = useMemo(() => {
    return taskInstances.map((t) => ({
      ...t,
      computedStatus: getTaskStatus(t),
    }));
  }, [taskInstances]);

  const myTasks = tasksWithStatus.filter(
    (t) => t.assignedToMemberId === currentMember?.id && t.computedStatus !== "done" && t.status !== "rejected"
  );

  const dueTodayTasks = tasksWithStatus.filter(
    (t) => isToday(new Date(t.dueAt)) && t.computedStatus === "open" && t.status !== "rejected"
  );

  const overdueTasks = tasksWithStatus.filter((t) => t.computedStatus === "overdue" && t.status !== "rejected");

  const pendingApprovalTasks = tasksWithStatus.filter(
    (t) => t.computedStatus === "pending_approval" && t.status !== "rejected"
  );

  const getTemplate = (templateId: string) =>
    taskTemplates.find((t) => t.id === templateId);

  const getMember = (memberId: string) =>
    members.find((m) => m.id === memberId);

  // Validate date format (YYYY-MM-DD)
  const isValidDateFormat = (dateStr: string) => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr)) return false;
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  };

  const handleAssignTask = async () => {
    if (selectedTemplateIds.size === 0 || selectedKidIds.size === 0 || !dueDate || !currentMember?.id) return;
    
    // Validate date format
    if (!isValidDateFormat(dueDate)) {
      const message = 'Please enter a valid date in YYYY-MM-DD format';
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Invalid Date', message);
      }
      return;
    }
    
    setIsAssigning(true);
    const dueAt = `${dueDate}T12:00:00`;
    let successCount = 0;
    let errorCount = 0;
    
    // Convert Sets to arrays for unique template/kid combinations
    const templateIds = Array.from(selectedTemplateIds);
    const kidIds = Array.from(selectedKidIds);
    const totalAssignments = templateIds.length * kidIds.length;
    
    // Create all template/kid combinations
    const assignments: { templateId: string; kidId: string }[] = [];
    templateIds.forEach(templateId => {
      kidIds.forEach(kidId => {
        assignments.push({ templateId, kidId });
      });
    });
    
    try {
      // Sync to cloud first if configured - cloud is the source of truth
      if (isSupabaseConfigured() && profile?.family_id) {
        console.log('[Today] Starting assignment - familyId:', profile.family_id, 'assignments:', assignments.length);
        
        // Batch create with Promise.allSettled for efficiency
        const results = await Promise.allSettled(
          assignments.map(async ({ templateId, kidId }) => {
            console.log('[Today] Creating instance - templateId:', templateId, 'kidId:', kidId, 'createdBy:', currentMember.id);
            const { data, error } = await createCloudTaskInstance(
              profile.family_id!,
              templateId,
              kidId,
              currentMember.id,
              dueAt
            );
            console.log('[Today] Create result - data:', data?.id, 'error:', error?.message);
            if (error) throw error;
            return data;
          })
        );
        
        const successfulAssignments: { memberId: string; templateTitle: string }[] = [];
        
        results.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value) {
            const localInstance = cloudInstanceToLocal(result.value);
            console.log('[Today] Adding to local store - instanceId:', localInstance.id, 'assignedTo:', localInstance.assignedToMemberId);
            addTaskInstanceFromCloud(localInstance);
            successCount++;
            
            const template = taskTemplates.find(t => t.id === assignments[index].templateId);
            successfulAssignments.push({
              memberId: assignments[index].kidId,
              templateTitle: template?.title || 'Task'
            });
          } else {
            console.error('[Today] Failed to assign:', assignments[index], result.status === 'rejected' ? result.reason : 'No data');
            errorCount++;
          }
        });
        
        // Send notifications for successful assignments
        const assignerName = currentMember?.name || 'Guardian';
        const notifiedMembers = new Set<string>();
        successfulAssignments.forEach(({ memberId, templateTitle }) => {
          if (!notifiedMembers.has(memberId)) {
            notifiedMembers.add(memberId);
            notifyTaskAssigned(profile.family_id!, memberId, templateTitle, assignerName);
          }
        });
      } else {
        // No cloud configured - local-only mode (development/testing)
        assignments.forEach(({ templateId, kidId }) => {
          addTaskInstance({
            templateId,
            assignedToMemberId: kidId,
            dueAt,
            status: "open",
          });
          successCount++;
        });
      }
    } catch (err) {
      console.error('[Today] Unexpected error during assignment:', err);
      errorCount = totalAssignments - successCount;
    } finally {
      setIsAssigning(false);
    }
    
    // Show result and dismiss modal
    if (errorCount > 0) {
      const message = `Assigned ${successCount} of ${totalAssignments} tasks. ${errorCount} failed.`;
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Partial Success', message);
      }
    }
    
    if (successCount > 0) {
      setShowAssignModal(false);
      setSelectedTemplateIds(new Set());
      setSelectedKidIds(new Set());
      setTaskSearchQuery("");
      setDueDate(format(new Date(), "yyyy-MM-dd"));
    }
  };

  const handleCreateOneOffTask = async () => {
    if (!oneOffTitle.trim() || selectedKidIds.size === 0 || !dueDate || !currentMember?.id || !profile?.family_id) return;
    
    if (!isValidDateFormat(dueDate)) {
      const message = 'Please enter a valid date in YYYY-MM-DD format';
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Invalid Date', message);
      }
      return;
    }
    
    setIsAssigning(true);
    const dueAt = `${dueDate}T12:00:00`;
    let successCount = 0;
    let errorCount = 0;
    const memberIds = Array.from(selectedKidIds);
    const totalAssignments = memberIds.length;
    
    try {
      const oneOffTemplate: Omit<TaskTemplate, 'id'> = {
        title: oneOffTitle.trim(),
        category: 'personal',
        iconKey: 'flash-outline',
        defaultStars: oneOffStars,
        difficulty: 'medium',
        preferredPowers: [],
        enabled: false,
        isArchived: false,
        scheduleType: 'one_time',
      };
      
      const { data: createdTask, error: taskError } = await createCloudTask(
        profile.family_id,
        oneOffTemplate
      );
      
      if (taskError || !createdTask) {
        console.error('[Today] Failed to create one-off task template:', taskError);
        if (Platform.OS === 'web') {
          window.alert('Failed to create task. Please try again.');
        } else {
          Alert.alert('Error', 'Failed to create task. Please try again.');
        }
        setIsAssigning(false);
        return;
      }
      
      const results = await Promise.allSettled(
        memberIds.map(async (memberId) => {
          const { data, error } = await createCloudTaskInstance(
            profile.family_id!,
            createdTask.id,
            memberId,
            currentMember.id,
            dueAt
          );
          if (error) throw error;
          return data;
        })
      );
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          const localInstance = cloudInstanceToLocal(result.value);
          addTaskInstanceFromCloud(localInstance);
          successCount++;
        } else {
          const errorMsg = result.status === 'rejected' ? (result.reason as Error)?.message || 'Unknown error' : 'No data';
          console.error('[Today] Failed to assign one-off task:', memberIds[index], errorMsg);
          errorCount++;
        }
      });
      
      if (successCount > 0) {
        const localTemplate = taskToTemplate(createdTask);
        addTaskTemplate(localTemplate);
      } else if (createdTask) {
        console.log('[Today] All assignments failed - archiving orphan template');
        try {
          await archiveCloudTask(createdTask.id);
        } catch (archiveErr) {
          console.error('[Today] Failed to archive orphan template:', archiveErr);
        }
      }
    } catch (err) {
      console.error('[Today] Unexpected error creating one-off task:', err);
      errorCount = totalAssignments - successCount;
    } finally {
      setIsAssigning(false);
    }
    
    if (errorCount > 0 && successCount === 0) {
      const message = 'Failed to assign task to any members. Please try again.';
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Assignment Failed', message);
      }
    } else if (errorCount > 0) {
      const message = `Created ${successCount} of ${totalAssignments} assignments. ${errorCount} failed.`;
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Partial Success', message);
      }
    }
    
    if (successCount > 0) {
      setShowAssignModal(false);
      setShowOneOffForm(false);
      setOneOffTitle("");
      setOneOffStars(1);
      setSelectedKidIds(new Set());
      setTaskSearchQuery("");
      setDueDate(format(new Date(), "yyyy-MM-dd"));
    }
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

  // Clear all overdue tasks (mark as done without stars)
  const handleClearOverdueTasks = async () => {
    if (overdueTasks.length === 0) return;
    
    const confirmMessage = `This will mark ${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''} as complete without awarding stars. Continue?`;
    
    const proceed = Platform.OS === 'web' 
      ? window.confirm(confirmMessage)
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            "Clear Overdue Tasks",
            confirmMessage,
            [
              { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
              { text: "Clear All", style: "destructive", onPress: () => resolve(true) }
            ]
          );
        });
    
    if (!proceed) return;
    
    setIsClearingOverdue(true);
    try {
      for (const task of overdueTasks) {
        // Sync to cloud first - use "approved" as valid DB status
        if (isSupabaseConfigured() && profile?.family_id) {
          await updateCloudTaskInstance(task.id, { 
            status: "approved",
            completedAt: new Date().toISOString()
          });
        }
        
        // Update local state - use "approved" for database-compatible status
        useStore.setState((state) => ({
          taskInstances: state.taskInstances.map((t) =>
            t.id === task.id
              ? { ...t, status: "approved" as const, completedAt: new Date().toISOString() }
              : t
          ),
        }));
      }
      
      if (Platform.OS === 'web') {
        window.alert(`Cleared ${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''}`);
      } else {
        Alert.alert("Done", `Cleared ${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''}`);
      }
    } catch (err) {
      console.error('[Today] Error clearing overdue tasks:', err);
      if (Platform.OS === 'web') {
        window.alert('Failed to clear some tasks. Please try again.');
      } else {
        Alert.alert("Error", "Failed to clear some tasks. Please try again.");
      }
    } finally {
      setIsClearingOverdue(false);
    }
  };

  // Complete task with cloud sync
  const handleCompleteTask = async (taskId: string, requestedBy: string) => {
    const task = taskInstances.find((t) => t.id === taskId);
    if (!task) return;
    
    const template = taskTemplates.find((t) => t.id === task.templateId);
    const stars = template?.defaultStars || 1;
    const assigneeId = task.assignedToMemberId;
    
    // Check if this is a single guardian case (direct completion)
    const isSingleGuardian = guardianCount === 1 && currentMember?.role === "guardian";
    
    console.log('[Today] handleCompleteTask called:', {
      taskId,
      requestedBy,
      currentMemberId: currentMember?.id,
      currentMemberName: currentMember?.name,
      currentMemberRole: currentMember?.role,
      profileId: profile?.id,
      isSingleGuardian
    });
    
    // Update local store first
    completeTask(taskId, requestedBy);
    
    // Sync to cloud if configured
    if (isSupabaseConfigured() && profile?.family_id) {
      try {
        if (isSingleGuardian) {
          // Single guardian: task completes immediately - update status and add stars
          const [statusResult, starsResult] = await Promise.all([
            updateCloudTaskInstance(taskId, {
              status: 'approved',
              completedAt: new Date().toISOString()
            }),
            addStarsLedgerEntry(
              profile.family_id,
              assigneeId,
              stars,
              'Task completion',
              requestedBy,
              taskId
            )
          ]);
          
          if (statusResult.error) {
            console.error('[Today] Error syncing task status to cloud:', statusResult.error.message);
          }
          if (starsResult.error) {
            console.error('[Today] Error syncing stars to cloud:', starsResult.error.message);
          } else {
            console.log('[Today] Task completion synced to cloud, stars:', stars);
          }
        } else {
          // Multi-guardian or participant: mark as pending approval
          const { error } = await updateCloudTaskInstance(taskId, {
            status: 'pending_approval',
            completionRequestedBy: requestedBy,
            completionRequestedAt: new Date().toISOString()
          });
          
          if (error) {
            console.error('[Today] Error syncing pending approval to cloud:', error.message);
          } else {
            console.log('[Today] Task pending approval synced to cloud');
            // Notify guardians of pending approval
            const completerName = members.find(m => m.id === requestedBy)?.name || 'Someone';
            notifyTaskPendingApproval(
              profile.family_id,
              completerName,
              template?.title || 'Task',
              requestedBy
            );
          }
        }
      } catch (err) {
        console.error('[Today] Cloud sync error:', err);
      }
    }
  };

  // Reject task with cloud sync
  const handleRejectTask = async (taskId: string) => {
    const task = taskInstances.find((t) => t.id === taskId);
    const template = task ? taskTemplates.find((t) => t.id === task.templateId) : null;
    const assigneeId = task?.assignedToMemberId;
    
    // Update local store first
    rejectTask(taskId);
    
    // Sync to cloud if configured
    if (isSupabaseConfigured() && profile?.family_id) {
      try {
        const { error } = await updateCloudTaskInstance(taskId, {
          status: 'rejected',
          completionRequestedBy: null,
          completionRequestedAt: null
        });
        
        if (error) {
          console.error('[Today] Error syncing task rejection to cloud:', error.message);
        } else {
          console.log('[Today] Task rejection synced to cloud');
          // Notify assignee of rejection
          if (assigneeId) {
            notifyTaskRejected(
              profile.family_id,
              assigneeId,
              template?.title || 'Task'
            );
          }
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
    
    // Guard: Only approve tasks that are pending approval
    if (task.status !== 'pending_approval') {
      console.log('[Today] Task not pending approval, skipping:', task.status);
      return;
    }
    
    const template = taskTemplates.find((t) => t.id === task.templateId);
    const stars = template?.defaultStars || 1;
    const assigneeId = task.assignedToMemberId;
    
    // Update local store first for immediate UI feedback
    approveTask(taskId, approverId);
    
    // Sync to cloud: update task status and add stars
    if (isSupabaseConfigured() && profile?.family_id) {
      try {
        const [statusResult, starsResult] = await Promise.all([
          updateCloudTaskInstance(taskId, {
            status: 'approved',
            completedAt: new Date().toISOString(),
            completionRequestedBy: null,
            completionRequestedAt: null
          }),
          addStarsLedgerEntry(
            profile.family_id,
            assigneeId,
            stars,
            'Task approval',
            approverId,
            taskId
          )
        ]);
        
        if (statusResult.error) {
          console.error('[Today] Error syncing task status to cloud:', statusResult.error.message);
        }
        if (starsResult.error) {
          // Duplicate key error is OK - means stars were already awarded for this task
          const isDuplicateError = starsResult.error.message?.includes('duplicate key') || 
                                   starsResult.error.message?.includes('unique constraint');
          if (isDuplicateError) {
            console.log('[Today] Stars already awarded for this task, continuing');
          } else {
            console.error('[Today] Error syncing task approval stars to cloud:', starsResult.error.message);
          }
        } else {
          console.log('[Today] Task approval synced to cloud, stars:', stars);
        }
        
        // Notify assignee of approval (even if stars already existed)
        notifyTaskApproved(
          profile.family_id,
          assigneeId,
          template?.title || 'Task',
          stars
        );
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
              onPress={() => handleRejectTask(task.id)}
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
      <ScrollView 
        contentContainerStyle={[
          styles.content,
          responsive.isTablet && {
            paddingHorizontal: responsive.horizontalPadding,
            alignSelf: 'center',
            width: '100%',
            maxWidth: responsive.contentMaxWidth,
          }
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        <DashboardCards 
          taskInstances={taskInstances}
          taskTemplates={taskTemplates}
          members={members}
          currentTime={currentTime}
        />

        {isCurrentUserGuardian && (
          <>
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
            
            {overdueTasks.length > 0 && (
              <TouchableOpacity
                style={styles.clearOverdueButton}
                onPress={handleClearOverdueTasks}
                disabled={isClearingOverdue}
                data-testid="button-clear-overdue"
              >
                <Ionicons name="trash-outline" size={20} color={colors.error} />
                <Text style={styles.clearOverdueText}>
                  {isClearingOverdue ? "Clearing..." : `Clear ${overdueTasks.length} Overdue Task${overdueTasks.length > 1 ? 's' : ''}`}
                </Text>
              </TouchableOpacity>
            )}
          </>
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

      </ScrollView>

      <Modal visible={showAssignModal} animationType="slide" transparent>
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.assignModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign Tasks</Text>
              <TouchableOpacity onPress={() => setShowAssignModal(false)}>
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View style={styles.searchContainer}>
              <Ionicons name="search-outline" size={20} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={taskSearchQuery}
                onChangeText={setTaskSearchQuery}
                placeholder="Search tasks..."
                placeholderTextColor={colors.textMuted}
                data-testid="input-task-search"
              />
              {taskSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setTaskSearchQuery("")}>
                  <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Task Selection with Tag Groups */}
            <Text style={styles.modalLabel}>
              Select Tasks ({selectedTemplateIds.size} selected)
            </Text>
            <ScrollView style={styles.tagGroupContainer} showsVerticalScrollIndicator={false}>
              {/* All Tasks Group */}
              <View style={styles.tagGroup}>
                <TouchableOpacity 
                  style={styles.tagHeader}
                  onPress={() => toggleTagExpanded("all")}
                >
                  <View style={styles.tagHeaderLeft}>
                    <Ionicons 
                      name={expandedTags.has("all") ? "chevron-down" : "chevron-forward"} 
                      size={20} 
                      color={colors.text} 
                    />
                    <Ionicons name="list-outline" size={18} color={colors.primary} />
                    <Text style={styles.tagLabel}>All Tasks ({filteredTemplates.length})</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.selectAllButton}
                    onPress={() => toggleTagTemplates("all", !areAllTagTemplatesSelected("all"))}
                  >
                    <Text style={styles.selectAllText}>
                      {areAllTagTemplatesSelected("all") ? "Clear All" : "Select All"}
                    </Text>
                  </TouchableOpacity>
                </TouchableOpacity>
                {expandedTags.has("all") && (
                  <View style={styles.tagTemplates}>
                    {filteredTemplates.map((template) => (
                      <TouchableOpacity
                        key={template.id}
                        style={[
                          styles.templateChip,
                          selectedTemplateIds.has(template.id) && styles.templateChipSelected,
                        ]}
                        onPress={() => toggleTemplateSelection(template.id)}
                        data-testid={`button-select-task-${template.id}`}
                      >
                        <View style={styles.templateChipInner}>
                          {selectedTemplateIds.has(template.id) && (
                            <Ionicons name="checkmark-circle" size={16} color={colors.surface} />
                          )}
                          <Text
                            style={[
                              styles.templateChipText,
                              selectedTemplateIds.has(template.id) && styles.templateChipTextSelected,
                            ]}
                            numberOfLines={1}
                          >
                            {template.title}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Tag-based Groups */}
              {TASK_TAGS.map((tag) => {
                const tagTemplatesList = templatesByTag[tag.key] || [];
                if (tagTemplatesList.length === 0) return null;
                
                return (
                  <View key={tag.key} style={styles.tagGroup}>
                    <TouchableOpacity 
                      style={styles.tagHeader}
                      onPress={() => toggleTagExpanded(tag.key)}
                    >
                      <View style={styles.tagHeaderLeft}>
                        <Ionicons 
                          name={expandedTags.has(tag.key) ? "chevron-down" : "chevron-forward"} 
                          size={20} 
                          color={colors.text} 
                        />
                        <Ionicons name={tag.icon} size={18} color={colors.primary} />
                        <Text style={styles.tagLabel}>{tag.label} ({tagTemplatesList.length})</Text>
                      </View>
                      <TouchableOpacity 
                        style={styles.selectAllButton}
                        onPress={() => toggleTagTemplates(tag.key, !areAllTagTemplatesSelected(tag.key))}
                      >
                        <Text style={styles.selectAllText}>
                          {areAllTagTemplatesSelected(tag.key) ? "Clear" : "Select All"}
                        </Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                    {expandedTags.has(tag.key) && (
                      <View style={styles.tagTemplates}>
                        {tagTemplatesList.map((template) => (
                          <TouchableOpacity
                            key={template.id}
                            style={[
                              styles.templateChip,
                              selectedTemplateIds.has(template.id) && styles.templateChipSelected,
                            ]}
                            onPress={() => toggleTemplateSelection(template.id)}
                          >
                            <View style={styles.templateChipInner}>
                              {selectedTemplateIds.has(template.id) && (
                                <Ionicons name="checkmark-circle" size={16} color={colors.surface} />
                              )}
                              <Text
                                style={[
                                  styles.templateChipText,
                                  selectedTemplateIds.has(template.id) && styles.templateChipTextSelected,
                                ]}
                                numberOfLines={1}
                              >
                                {template.title}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
              
              {/* No Results - Create One-Off Task Option (only when cloud is configured) */}
              {filteredTemplates.length === 0 && taskSearchQuery.trim().length > 0 && !showOneOffForm && (
                <View style={styles.noResultsContainer}>
                  <Text style={styles.noResultsText}>No tasks match "{taskSearchQuery}"</Text>
                  {isSupabaseConfigured() && profile?.family_id && (
                    <TouchableOpacity 
                      style={styles.createOneOffButton}
                      onPress={() => {
                        setShowOneOffForm(true);
                        setOneOffTitle(taskSearchQuery.trim());
                      }}
                      data-testid="button-create-one-off"
                    >
                      <Ionicons name="flash-outline" size={18} color={colors.surface} />
                      <Text style={styles.createOneOffButtonText}>Create One-Off Task</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              
              {/* One-Off Task Form */}
              {showOneOffForm && (
                <View style={styles.oneOffFormContainer}>
                  <View style={styles.oneOffFormHeader}>
                    <Ionicons name="flash" size={20} color={colors.primary} />
                    <Text style={styles.oneOffFormTitle}>One-Off Task</Text>
                    <TouchableOpacity 
                      style={styles.oneOffCancelButton}
                      onPress={() => setShowOneOffForm(false)}
                    >
                      <Text style={styles.oneOffCancelText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <TextInput
                    style={styles.oneOffTitleInput}
                    value={oneOffTitle}
                    onChangeText={setOneOffTitle}
                    placeholder="Task name..."
                    placeholderTextColor={colors.textMuted}
                    data-testid="input-one-off-title"
                  />
                  
                  <View style={styles.oneOffStarsRow}>
                    <Text style={styles.oneOffStarsLabel}>Stars:</Text>
                    <View style={styles.starsSelector}>
                      {[1, 2, 3, 4, 5].map((stars) => (
                        <TouchableOpacity
                          key={stars}
                          style={[
                            styles.starOption,
                            oneOffStars === stars && styles.starOptionSelected,
                          ]}
                          onPress={() => setOneOffStars(stars)}
                          data-testid={`button-stars-${stars}`}
                        >
                          <Text style={[
                            styles.starOptionText,
                            oneOffStars === stars && styles.starOptionTextSelected,
                          ]}>{stars}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Assignees Multi-Select (Guardians + Kids) */}
            <Text style={styles.modalLabel}>
              Assign To ({selectedKidIds.size} selected)
            </Text>
            <View style={styles.kidsMultiSelect}>
              <TouchableOpacity 
                style={styles.selectAllKidsButton}
                onPress={() => {
                  const allSelected = assignees.every(a => selectedKidIds.has(a.id));
                  setSelectedKidIds(allSelected ? new Set() : new Set(assignees.map(a => a.id)));
                }}
              >
                <Text style={styles.selectAllText}>
                  {assignees.every(a => selectedKidIds.has(a.id)) ? "Clear All" : "Select All"}
                </Text>
              </TouchableOpacity>
              <View style={styles.kidsList}>
                {assignees.map((member) => (
                  <TouchableOpacity
                    key={member.id}
                    style={[
                      styles.kidChip,
                      selectedKidIds.has(member.id) && styles.kidChipSelected,
                    ]}
                    onPress={() => toggleKidSelection(member.id)}
                    data-testid={`button-select-member-${member.id}`}
                  >
                    <View style={styles.kidChipContent}>
                      {selectedKidIds.has(member.id) && (
                        <Ionicons name="checkmark-circle" size={16} color={colors.surface} />
                      )}
                      <Text
                        style={[
                          styles.kidChipText,
                          selectedKidIds.has(member.id) && styles.kidChipTextSelected,
                        ]}
                      >
                        {member.name}{member.role === 'guardian' ? ' (Guardian)' : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Due Date */}
            <Text style={styles.modalLabel}>Due Date</Text>
            <TextInput
              style={styles.dateInput}
              value={dueDate}
              onChangeText={setDueDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
            />

            {/* Assignment Summary & Confirm Button */}
            {showOneOffForm ? (
              <>
                <View style={styles.assignSummary}>
                  <Text style={styles.assignSummaryText}>
                    Create "{oneOffTitle}" for {selectedKidIds.size} member{selectedKidIds.size !== 1 ? 's' : ''} ({oneOffStars} star{oneOffStars !== 1 ? 's' : ''} each)
                  </Text>
                </View>
                
                <TouchableOpacity
                  style={[
                    styles.confirmButton,
                    (!oneOffTitle.trim() || selectedKidIds.size === 0 || isAssigning) && styles.confirmButtonDisabled,
                  ]}
                  onPress={handleCreateOneOffTask}
                  disabled={!oneOffTitle.trim() || selectedKidIds.size === 0 || isAssigning}
                  data-testid="button-confirm-one-off"
                >
                  <Text style={styles.confirmButtonText}>
                    {isAssigning ? "Creating..." : `Create & Assign`}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.assignSummary}>
                  <Text style={styles.assignSummaryText}>
                    {selectedTemplateIds.size} task{selectedTemplateIds.size !== 1 ? 's' : ''} × {selectedKidIds.size} member{selectedKidIds.size !== 1 ? 's' : ''} = {selectedTemplateIds.size * selectedKidIds.size} assignment{selectedTemplateIds.size * selectedKidIds.size !== 1 ? 's' : ''}
                  </Text>
                </View>
                
                <TouchableOpacity
                  style={[
                    styles.confirmButton,
                    (selectedTemplateIds.size === 0 || selectedKidIds.size === 0 || isAssigning) && styles.confirmButtonDisabled,
                  ]}
                  onPress={handleAssignTask}
                  disabled={selectedTemplateIds.size === 0 || selectedKidIds.size === 0 || isAssigning}
                  data-testid="button-confirm-assign"
                >
                  <Text style={styles.confirmButtonText}>
                    {isAssigning ? "Assigning..." : `Assign ${selectedTemplateIds.size * selectedKidIds.size} Task${selectedTemplateIds.size * selectedKidIds.size !== 1 ? 's' : ''}`}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showDeductModal} animationType="slide" transparent>
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
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
    paddingBottom: spacing.xxl,
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
  assignModalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    maxHeight: "90%",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
    padding: 0,
  },
  tagGroupContainer: {
    maxHeight: 200,
    marginBottom: spacing.sm,
  },
  tagGroup: {
    marginBottom: spacing.sm,
  },
  tagHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.md,
  },
  tagHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  tagLabel: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: colors.text,
  },
  selectAllButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  selectAllText: {
    fontSize: fontSize.xs,
    color: colors.primary,
    fontWeight: "600",
  },
  tagTemplates: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingLeft: spacing.lg,
  },
  templateChipInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  kidsMultiSelect: {
    marginBottom: spacing.sm,
  },
  selectAllKidsButton: {
    alignSelf: "flex-end",
    marginBottom: spacing.sm,
  },
  assignSummary: {
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  assignSummaryText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
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
    marginTop: spacing.lg,
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
  clearOverdueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.error,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  clearOverdueText: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.error,
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
  noResultsContainer: {
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.md,
  },
  noResultsText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: "center",
  },
  createOneOffButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  createOneOffButtonText: {
    color: colors.surface,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  oneOffFormContainer: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  oneOffFormHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  oneOffFormTitle: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.text,
    flex: 1,
  },
  oneOffCancelButton: {
    padding: spacing.xs,
  },
  oneOffCancelText: {
    color: colors.error,
    fontSize: fontSize.sm,
    fontWeight: "500",
  },
  oneOffTitleInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    fontSize: fontSize.md,
    color: colors.text,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  oneOffStarsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  oneOffStarsLabel: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  starsSelector: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  starOption: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  starOptionSelected: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  starOptionText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text,
  },
  starOptionTextSelected: {
    color: colors.surface,
  },
});

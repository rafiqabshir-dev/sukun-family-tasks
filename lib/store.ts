import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, Member, TaskTemplate, TaskInstance, StagedTask, Reward, StarDeduction, DEFAULT_STATE, Power, PowerKey, TaskScheduleType } from "./types";
import { generateStarterTasks } from "./starterTasks";
import { startOfDay, endOfDay, isAfter, isBefore, addMinutes, parseISO, format } from "date-fns";
import { isSupabaseConfigured } from "./supabase";

const STORAGE_KEY = "barakah-kids-race:v1";
const DEBOUNCE_MS = 300;

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let isInitialized = false;

interface StoreActions {
  initialize: () => Promise<void>;
  setAuthReady: (ready: boolean) => void;
  setParticipantPasscode: (passcode: string | null) => void;
  addMember: (member: Omit<Member, "id" | "starsTotal" | "powers">) => void;
  updateMember: (id: string, updates: Partial<Member>) => void;
  removeMember: (id: string) => void;
  setMembersFromCloud: (members: Member[]) => void;
  syncMembersFromCloud: (members: Member[]) => void;
  upsertMemberWithUUID: (uuid: string, name: string, role: 'guardian' | 'kid', age?: number) => void;
  setMemberPowers: (memberId: string, powers: PowerKey[]) => void;
  setTaskTemplates: (templates: TaskTemplate[]) => void;
  setTaskTemplatesFromCloud: (templates: TaskTemplate[]) => void;
  setTaskInstancesFromCloud: (instances: TaskInstance[]) => void;
  addTaskInstanceFromCloud: (instance: TaskInstance) => void;
  toggleTaskTemplate: (id: string) => void;
  addTaskTemplate: (template: Omit<TaskTemplate, "id">) => TaskTemplate;
  updateTaskTemplate: (id: string, updates: Partial<TaskTemplate>) => void;
  archiveTaskTemplate: (id: string) => void;
  addTaskInstance: (instance: Omit<TaskInstance, "id" | "createdAt">) => TaskInstance;
  updateTaskInstance: (id: string, updates: Partial<TaskInstance>) => void;
  completeTask: (instanceId: string, requestedBy: string) => void;
  approveTask: (instanceId: string, approvedBy: string) => void;
  rejectTask: (instanceId: string) => void;
  checkExpiredTasks: () => void;
  regenerateRecurringTasks: () => void;
  addToSpinQueue: (task: Omit<StagedTask, "id">) => void;
  removeFromSpinQueue: (id: string) => void;
  clearSpinQueue: () => void;
  recordWinner: (memberId: string) => void;
  addReward: (reward: Omit<Reward, "id" | "createdAt" | "status">) => Reward;
  updateReward: (id: string, updates: Partial<Reward>) => void;
  redeemReward: (rewardId: string, memberId: string) => boolean;
  deleteReward: (id: string) => void;
  deductStars: (memberId: string, stars: number, reason: string, createdBy: string) => void;
  toggleSound: () => void;
  reset: () => Promise<void>;
}

function saveToStorage(state: AppState): void {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    try {
      const toSave: AppState = {
        schemaVersion: state.schemaVersion,
        members: state.members,
        taskTemplates: state.taskTemplates,
        taskInstances: state.taskInstances,
        spinQueue: state.spinQueue,
        lastWinnerIds: state.lastWinnerIds,
        rewards: state.rewards,
        starDeductions: state.starDeductions,
        settings: state.settings
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
      console.error("Failed to save to AsyncStorage:", e);
    }
  }, DEBOUNCE_MS);
}

function migrateTemplates(templates: TaskTemplate[]): TaskTemplate[] {
  const starterTasks = generateStarterTasks();
  const starterMap = new Map(starterTasks.map(t => [t.id, t]));
  
  return templates.map((t) => {
    const starter = starterMap.get(t.id);
    if (starter && (!t.title || t.title === "Untitled Task")) {
      return { ...starter, enabled: t.enabled !== undefined ? t.enabled : true, isArchived: t.isArchived || false };
    }
    return {
      ...t,
      title: t.title || "Untitled Task",
      iconKey: t.iconKey || "person",
      category: t.category || "personal",
      defaultStars: t.defaultStars || 1,
      difficulty: t.difficulty || "medium",
      preferredPowers: t.preferredPowers || [],
      enabled: t.enabled !== undefined ? t.enabled : true,
      isArchived: t.isArchived || false,
    };
  });
}

export const useStore = create<AppState & StoreActions & { isReady: boolean; authReady: boolean; participantPasscode: string | null }>((set, get) => ({
  ...DEFAULT_STATE,
  isReady: false,
  authReady: false,
  participantPasscode: null,
  
  setAuthReady: (ready: boolean) => {
    console.log('[Store] setAuthReady:', ready);
    set({ authReady: ready });
  },
  
  setParticipantPasscode: (passcode: string | null) => {
    console.log('[Store] setParticipantPasscode:', passcode ? '****' : null);
    set({ participantPasscode: passcode });
  },

  initialize: async () => {
    if (isInitialized) {
      // Already initialized - just ensure isReady is true for remounted components
      set({ isReady: true });
      return;
    }
    isInitialized = true;
    
    const starterTasks = generateStarterTasks();
    
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.schemaVersion === DEFAULT_STATE.schemaVersion) {
          let templates = parsed.taskTemplates || [];
          
          // If no templates exist or all are untitled, load starter tasks
          const hasValidTemplates = templates.length > 0 && 
            templates.some((t: TaskTemplate) => t.title && t.title !== "Untitled Task");
          
          if (!hasValidTemplates) {
            templates = starterTasks;
          } else {
            templates = migrateTemplates(templates);
          }
          
          set({ 
            ...DEFAULT_STATE, 
            ...parsed, 
            taskTemplates: templates,
            spinQueue: parsed.spinQueue || [],
            lastWinnerIds: parsed.lastWinnerIds || [],
            rewards: parsed.rewards || [],
            starDeductions: parsed.starDeductions || [],
            isReady: true 
          });
          return;
        }
      }
    } catch (e) {
      console.error("Failed to load from AsyncStorage:", e);
    }
    
    // Fresh start - load starter tasks
    set({ 
      ...DEFAULT_STATE, 
      taskTemplates: starterTasks,
      isReady: true 
    });
    saveToStorage({ ...DEFAULT_STATE, taskTemplates: starterTasks });
  },

  addMember: (member) => {
    const newMember: Member = {
      ...member,
      id: `member-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      starsTotal: 0,
      powers: []
    };
    const members = [...get().members, newMember];
    set({ members });
    saveToStorage({ ...get(), members });
  },

  updateMember: (id, updates) => {
    const members = get().members.map((m) =>
      m.id === id ? { ...m, ...updates } : m
    );
    set({ members });
    saveToStorage({ ...get(), members });
  },

  removeMember: (id) => {
    const members = get().members.filter((m) => m.id !== id);
    set({ members });
    saveToStorage({ ...get(), members });
  },

  // Cloud-only: Replace members entirely from Supabase (no merging, no local persistence)
  setMembersFromCloud: (cloudMembers) => {
    // Just set members in state - no AsyncStorage persistence in cloud mode
    set({ members: cloudMembers });
  },

  // Legacy sync function for offline/local mode
  syncMembersFromCloud: (cloudMembers) => {
    const currentMembers = get().members;
    const cloudMemberIds = new Set(cloudMembers.map(m => m.id));
    
    // Build lookup maps for matching - by ID and by profileId
    const localByDirectId = new Map(currentMembers.map(m => [m.id, m]));
    const localByProfileId = new Map(
      currentMembers.filter(m => m.profileId).map(m => [m.profileId!, m])
    );
    
    // Track which local members were matched to avoid duplicates
    const matchedLocalIds = new Set<string>();
    
    // Merge cloud members with local data - local fields take priority for non-cloud data
    const mergedCloudMembers = cloudMembers.map(cloudMember => {
      // Try to find matching local member by direct ID OR by profileId
      const localMember = localByDirectId.get(cloudMember.id) || localByProfileId.get(cloudMember.id);
      
      if (localMember) {
        matchedLocalIds.add(localMember.id);
        // Preserve local member data, update authoritative fields from cloud
        return {
          ...localMember,
          id: cloudMember.id, // Use cloud UUID as canonical ID
          name: cloudMember.name, // Cloud name is authoritative
          role: cloudMember.role, // Cloud role is authoritative
          age: cloudMember.age || localMember.age, // Use cloud age if available
          profileId: cloudMember.id, // Ensure profileId is set
          // Preserve local powers (onboarding selections) unless cloud has data
          powers: localMember.powers.length > 0 ? localMember.powers : cloudMember.powers,
          // Use the higher star total to not lose local progress
          starsTotal: Math.max(cloudMember.starsTotal, localMember.starsTotal),
        };
      }
      // New cloud member - add with their data and set profileId
      return { ...cloudMember, profileId: cloudMember.id };
    });
    
    // Keep local-only members (IDs starting with 'member-') that weren't matched
    const localOnlyMembers = currentMembers.filter(
      m => m.id.startsWith('member-') && !matchedLocalIds.has(m.id) && !cloudMemberIds.has(m.id)
    );
    const mergedMembers = [...mergedCloudMembers, ...localOnlyMembers];
    
    set({ members: mergedMembers });
    saveToStorage({ ...get(), members: mergedMembers });
  },

  upsertMemberWithUUID: (uuid, name, role, age) => {
    const state = get();
    const currentMembers = state.members;
    
    // Check if member already exists by UUID (either as id or profileId)
    const existingByUUID = currentMembers.find(m => m.id === uuid || m.profileId === uuid);
    if (existingByUUID) {
      // Update name and ensure profileId is set
      const needsUpdate = existingByUUID.name !== name || existingByUUID.profileId !== uuid;
      if (needsUpdate) {
        const members = currentMembers.map(m => 
          (m.id === uuid || m.profileId === uuid) ? { ...m, name, profileId: uuid } : m
        );
        set({ members });
        saveToStorage({ ...get(), members });
      }
      return;
    }
    
    // Find legacy local member to update - try multiple matching strategies
    // Strategy 1: Match by exact name + role
    let legacyMember = currentMembers.find(
      m => m.name === name && m.role === role && m.id.startsWith('member-')
    );
    
    // Strategy 2: If no exact match and this is a guardian, find ANY guardian with legacy ID
    // (typically there's only one guardian per account in the local store)
    if (!legacyMember && role === 'guardian') {
      const legacyGuardians = currentMembers.filter(
        m => m.role === 'guardian' && m.id.startsWith('member-')
      );
      if (legacyGuardians.length === 1) {
        legacyMember = legacyGuardians[0];
      }
    }
    
    if (legacyMember) {
      // Found matching member - keep ID but add profileId for reliable matching
      const oldId = legacyMember.id;
      const members = currentMembers.map(m => 
        m.id === oldId ? { ...m, name, profileId: uuid } : m
      );
      
      set({ members });
      saveToStorage({ ...get(), members });
      return;
    }
    
    // No match found - add as new member
    const newMember: Member = {
      id: uuid,
      name,
      role,
      age: age || 0,
      starsTotal: 0,
      powers: [],
      profileId: uuid // Store the Supabase UUID as profileId for reliable matching
    };
    const members = [...currentMembers, newMember];
    set({ members });
    saveToStorage({ ...get(), members });
  },

  setMemberPowers: (memberId, powerKeys) => {
    const powers: Power[] = powerKeys.map((key) => ({
      powerKey: key,
      level: 1,
      xp: 0
    }));
    const members = get().members.map((m) =>
      m.id === memberId ? { ...m, powers } : m
    );
    set({ members });
    saveToStorage({ ...get(), members });
  },

  setTaskTemplates: (templates) => {
    set({ taskTemplates: templates });
    saveToStorage({ ...get(), taskTemplates: templates });
  },

  setTaskTemplatesFromCloud: (templates) => {
    console.log('[Store] setTaskTemplatesFromCloud:', templates.length, 'templates');
    set({ taskTemplates: templates });
    // Don't save to AsyncStorage - cloud is the source of truth
  },

  setTaskInstancesFromCloud: (instances) => {
    console.log('[Store] setTaskInstancesFromCloud:', instances.length, 'instances');
    set({ taskInstances: instances });
    // Don't save to AsyncStorage - cloud is the source of truth
  },

  addTaskInstanceFromCloud: (instance: TaskInstance) => {
    console.log('[Store] addTaskInstanceFromCloud:', instance.id);
    const existing = get().taskInstances;
    // Dedupe by ID: if instance already exists, merge with existing to preserve local fields
    const existingIndex = existing.findIndex(i => i.id === instance.id);
    let taskInstances: TaskInstance[];
    if (existingIndex >= 0) {
      taskInstances = [...existing];
      // Merge: cloud fields take precedence, but preserve local-only fields like approvedBy
      const existingInstance = taskInstances[existingIndex];
      taskInstances[existingIndex] = {
        ...existingInstance,
        ...instance,
        // Preserve local-only fields if not provided by cloud
        approvedBy: instance.approvedBy || existingInstance.approvedBy
      };
      console.log('[Store] Merged existing instance:', instance.id);
    } else {
      taskInstances = [...existing, instance];
      console.log('[Store] Added new instance:', instance.id);
    }
    set({ taskInstances });
    // Don't save to AsyncStorage - cloud is the source of truth
  },

  toggleTaskTemplate: (id) => {
    const taskTemplates = get().taskTemplates.map((t) =>
      t.id === id ? { ...t, enabled: !t.enabled } : t
    );
    set({ taskTemplates });
    saveToStorage({ ...get(), taskTemplates });
  },

  addTaskTemplate: (template) => {
    const newTemplate: TaskTemplate = {
      ...template,
      id: `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: template.title || "Untitled Task",
      iconKey: template.iconKey || "person",
      isArchived: template.isArchived || false,
    };
    const taskTemplates = [...get().taskTemplates, newTemplate];
    set({ taskTemplates });
    saveToStorage({ ...get(), taskTemplates });
    return newTemplate;
  },

  updateTaskTemplate: (id, updates) => {
    const taskTemplates = get().taskTemplates.map((t) =>
      t.id === id ? { ...t, ...updates } : t
    );
    set({ taskTemplates });
    saveToStorage({ ...get(), taskTemplates });
  },

  archiveTaskTemplate: (id) => {
    const taskTemplates = get().taskTemplates.map((t) =>
      t.id === id ? { ...t, isArchived: true, enabled: false } : t
    );
    set({ taskTemplates });
    saveToStorage({ ...get(), taskTemplates });
  },

  addTaskInstance: (instance) => {
    const state = get();
    const template = state.taskTemplates.find((t) => t.id === instance.templateId);
    const now = new Date();
    
    let expiresAt: string | undefined;
    let scheduleType: TaskScheduleType | undefined = template?.scheduleType;
    
    // For time-sensitive tasks, calculate expiration time
    if (template?.scheduleType === "time_sensitive" && template.timeWindowMinutes) {
      expiresAt = addMinutes(now, template.timeWindowMinutes).toISOString();
    }
    
    // For recurring daily tasks, set expiration to end of day
    if (template?.scheduleType === "recurring_daily") {
      expiresAt = endOfDay(now).toISOString();
    }
    
    const newInstance: TaskInstance = {
      ...instance,
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: now.toISOString(),
      expiresAt,
      scheduleType
    };
    const taskInstances = [...state.taskInstances, newInstance];
    set({ taskInstances });
    saveToStorage({ ...get(), taskInstances });
    return newInstance;
  },

  updateTaskInstance: (id, updates) => {
    const taskInstances = get().taskInstances.map((t) =>
      t.id === id ? { ...t, ...updates } : t
    );
    set({ taskInstances });
    saveToStorage({ ...get(), taskInstances });
  },

  completeTask: (instanceId, requestedBy) => {
    const state = get();
    const instance = state.taskInstances.find((t) => t.id === instanceId);
    
    if (!instance || instance.status !== "open") return;

    const requester = state.members.find((m) => m.id === requestedBy || m.profileId === requestedBy);
    const guardians = state.members.filter((m) => m.role === "guardian");
    const guardianCount = guardians.length;
    const isRequesterGuardian = requester?.role === "guardian";
    
    console.log('[Store] completeTask:', {
      instanceId,
      requestedBy,
      requesterFound: requester?.name,
      requesterRole: requester?.role,
      guardianCount,
      canCompleteDirectly: isRequesterGuardian && guardianCount === 1
    });

    // Approval logic:
    // - Single guardian can complete any task directly (no approval needed)
    // - Multiple guardians: guardian needs approval from different guardian
    // - Participants always need guardian approval
    const canCompleteDirectly = isRequesterGuardian && guardianCount === 1;

    if (canCompleteDirectly) {
      // Complete the task directly without approval
      const template = state.taskTemplates.find((t) => t.id === instance.templateId);
      const starsEarned = template?.defaultStars || 1;

      const taskInstances = state.taskInstances.map((t) =>
        t.id === instanceId
          ? { 
              ...t, 
              status: "approved" as const, 
              completedAt: new Date().toISOString(),
              completionRequestedBy: requestedBy,
              approvedBy: requestedBy
            }
          : t
      );

      const members = state.members.map((m) =>
        m.id === instance.assignedToMemberId
          ? { ...m, starsTotal: m.starsTotal + starsEarned }
          : m
      );

      set({ taskInstances, members });
      saveToStorage({ ...get(), taskInstances, members });
    } else {
      // Request approval
      const taskInstances = state.taskInstances.map((t) =>
        t.id === instanceId
          ? { 
              ...t, 
              status: "pending_approval" as const, 
              completionRequestedAt: new Date().toISOString(),
              completionRequestedBy: requestedBy
            }
          : t
      );

      set({ taskInstances });
      saveToStorage({ ...get(), taskInstances });
    }
  },

  approveTask: (instanceId, approvedBy) => {
    const state = get();
    const instance = state.taskInstances.find((t) => t.id === instanceId);
    
    if (!instance || instance.status !== "pending_approval") return;
    
    // Approver must be a guardian
    const approver = state.members.find((m) => m.id === approvedBy || m.profileId === approvedBy);
    if (approver?.role !== "guardian") return;
    
    // Approver must be different from the person who requested completion
    if (instance.completionRequestedBy === approvedBy) return;

    const template = state.taskTemplates.find((t) => t.id === instance.templateId);
    const starsEarned = template?.defaultStars || 1;

    const taskInstances = state.taskInstances.map((t) =>
      t.id === instanceId
        ? { 
            ...t, 
            status: "approved" as const, 
            completedAt: new Date().toISOString(),
            approvedBy 
          }
        : t
    );

    const members = state.members.map((m) =>
      m.id === instance.assignedToMemberId
        ? { ...m, starsTotal: m.starsTotal + starsEarned }
        : m
    );

    set({ taskInstances, members });
    saveToStorage({ ...get(), taskInstances, members });
  },

  rejectTask: (instanceId) => {
    const state = get();
    const instance = state.taskInstances.find((t) => t.id === instanceId);
    
    if (!instance || instance.status !== "pending_approval") return;

    const taskInstances = state.taskInstances.map((t) =>
      t.id === instanceId
        ? { 
            ...t, 
            status: "open" as const, 
            completionRequestedAt: undefined,
            completionRequestedBy: undefined
          }
        : t
    );

    set({ taskInstances });
    saveToStorage({ ...get(), taskInstances });
  },

  checkExpiredTasks: () => {
    const state = get();
    const now = new Date();
    let hasChanges = false;
    
    const taskInstances = state.taskInstances.map((instance) => {
      if (instance.status !== "open" && instance.status !== "pending_approval") {
        return instance;
      }
      
      // Check if task has expired based on expiresAt
      if (instance.expiresAt) {
        const expiresAt = parseISO(instance.expiresAt);
        if (isAfter(now, expiresAt)) {
          hasChanges = true;
          return { ...instance, status: "expired" as const };
        }
      }
      
      // Check recurring daily tasks - expire at end of day if not done
      if (instance.scheduleType === "recurring_daily") {
        const dueDate = parseISO(instance.dueAt);
        const endOfDueDay = endOfDay(dueDate);
        if (isAfter(now, endOfDueDay) && instance.status === "open") {
          hasChanges = true;
          return { ...instance, status: "expired" as const };
        }
      }
      
      return instance;
    });
    
    if (hasChanges) {
      set({ taskInstances });
      saveToStorage({ ...get(), taskInstances });
    }
  },

  regenerateRecurringTasks: () => {
    const state = get();
    const now = new Date();
    const today = startOfDay(now);
    const todayStr = format(today, "yyyy-MM-dd");
    
    // Find all recurring daily templates that are enabled
    const recurringTemplates = state.taskTemplates.filter(
      (t) => t.scheduleType === "recurring_daily" && t.enabled && !t.isArchived
    );
    
    // For each recurring template, check if there's already a task for today
    const newInstances: TaskInstance[] = [];
    const kids = state.members.filter((m) => m.role === "kid");
    
    for (const template of recurringTemplates) {
      for (const kid of kids) {
        // Check age restrictions
        if (template.minAge && kid.age < template.minAge) continue;
        if (template.maxAge && kid.age > template.maxAge) continue;
        
        // Check if there's already an open/pending/done task for this kid and template today
        const existingForKidToday = state.taskInstances.find((instance) => {
          if (instance.templateId !== template.id) return false;
          if (instance.assignedToMemberId !== kid.id) return false;
          if (instance.scheduleType !== "recurring_daily") return false;
          const instanceDate = format(parseISO(instance.createdAt), "yyyy-MM-dd");
          // Consider any status except expired (don't recreate if there's an open, pending, or done task)
          return instanceDate === todayStr && instance.status !== "expired";
        });
        
        // Only create if no existing task for this kid today
        if (!existingForKidToday) {
          const newInstance: TaskInstance = {
            id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            templateId: template.id,
            assignedToMemberId: kid.id,
            dueAt: endOfDay(today).toISOString(),
            status: "open",
            createdAt: now.toISOString(),
            scheduleType: "recurring_daily"
          };
          newInstances.push(newInstance);
        }
      }
    }
    
    if (newInstances.length > 0) {
      const taskInstances = [...state.taskInstances, ...newInstances];
      set({ taskInstances });
      saveToStorage({ ...get(), taskInstances });
    }
  },

  addToSpinQueue: (task) => {
    const newTask: StagedTask = {
      ...task,
      id: `staged-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
    const spinQueue = [...get().spinQueue, newTask];
    set({ spinQueue });
    saveToStorage({ ...get(), spinQueue });
  },

  removeFromSpinQueue: (id) => {
    const spinQueue = get().spinQueue.filter((t) => t.id !== id);
    set({ spinQueue });
    saveToStorage({ ...get(), spinQueue });
  },

  clearSpinQueue: () => {
    set({ spinQueue: [] });
    saveToStorage({ ...get(), spinQueue: [] });
  },

  recordWinner: (memberId) => {
    const lastWinnerIds = [memberId, ...get().lastWinnerIds].slice(0, 3);
    set({ lastWinnerIds });
    saveToStorage({ ...get(), lastWinnerIds });
  },

  addReward: (reward) => {
    const newReward: Reward = {
      ...reward,
      id: `reward-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      status: "active"
    };
    const rewards = [...get().rewards, newReward];
    set({ rewards });
    saveToStorage({ ...get(), rewards });
    return newReward;
  },

  updateReward: (id, updates) => {
    const rewards = get().rewards.map((r) =>
      r.id === id ? { ...r, ...updates } : r
    );
    set({ rewards });
    saveToStorage({ ...get(), rewards });
  },

  redeemReward: (rewardId, memberId) => {
    const state = get();
    const reward = state.rewards.find((r) => r.id === rewardId);
    const member = state.members.find((m) => m.id === memberId);
    
    if (!reward || !member || reward.status === "redeemed") return false;
    if (member.starsTotal < reward.starsCost) return false;

    const rewards = state.rewards.map((r) =>
      r.id === rewardId
        ? { ...r, status: "redeemed" as const, redeemedAt: new Date().toISOString(), redeemedBy: memberId }
        : r
    );

    const members = state.members.map((m) =>
      m.id === memberId
        ? { ...m, starsTotal: m.starsTotal - reward.starsCost }
        : m
    );

    set({ rewards, members });
    saveToStorage({ ...get(), rewards, members });
    return true;
  },

  deleteReward: (id) => {
    const rewards = get().rewards.filter((r) => r.id !== id);
    set({ rewards });
    saveToStorage({ ...get(), rewards });
  },

  deductStars: (memberId, stars, reason, createdBy) => {
    const state = get();
    const member = state.members.find((m) => m.id === memberId);
    if (!member) return;

    const newDeduction: StarDeduction = {
      id: `deduction-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      memberId,
      stars,
      reason,
      createdAt: new Date().toISOString(),
      createdBy
    };

    const members = state.members.map((m) =>
      m.id === memberId
        ? { ...m, starsTotal: Math.max(0, m.starsTotal - stars) }
        : m
    );

    const starDeductions = [...state.starDeductions, newDeduction];
    set({ members, starDeductions });
    saveToStorage({ ...get(), members, starDeductions });
  },

  toggleSound: () => {
    const settings = { ...get().settings, soundsEnabled: !get().settings.soundsEnabled };
    set({ settings });
    saveToStorage({ ...get(), settings });
  },

  reset: async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    set({ ...DEFAULT_STATE, isReady: true, authReady: false });
  }
}));

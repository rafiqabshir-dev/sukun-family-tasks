import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, Member, TaskTemplate, TaskInstance, StagedTask, Reward, StarDeduction, DEFAULT_STATE, Power, PowerKey } from "./types";
import { generateStarterTasks } from "./starterTasks";

const STORAGE_KEY = "barakah-kids-race:v1";
const DEBOUNCE_MS = 300;

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let isInitialized = false;

interface StoreActions {
  initialize: () => Promise<void>;
  addMember: (member: Omit<Member, "id" | "starsTotal" | "powers">) => void;
  updateMember: (id: string, updates: Partial<Member>) => void;
  removeMember: (id: string) => void;
  setMemberPowers: (memberId: string, powers: PowerKey[]) => void;
  setActingMember: (memberId: string | null) => void;
  setTaskTemplates: (templates: TaskTemplate[]) => void;
  toggleTaskTemplate: (id: string) => void;
  addTaskTemplate: (template: Omit<TaskTemplate, "id">) => TaskTemplate;
  updateTaskTemplate: (id: string, updates: Partial<TaskTemplate>) => void;
  archiveTaskTemplate: (id: string) => void;
  addTaskInstance: (instance: Omit<TaskInstance, "id" | "createdAt">) => TaskInstance;
  updateTaskInstance: (id: string, updates: Partial<TaskInstance>) => void;
  completeTask: (instanceId: string) => void;
  addToSpinQueue: (task: Omit<StagedTask, "id">) => void;
  removeFromSpinQueue: (id: string) => void;
  clearSpinQueue: () => void;
  recordWinner: (memberId: string) => void;
  addReward: (reward: Omit<Reward, "id" | "createdAt" | "status">) => Reward;
  updateReward: (id: string, updates: Partial<Reward>) => void;
  redeemReward: (rewardId: string, memberId: string) => boolean;
  deleteReward: (id: string) => void;
  deductStars: (memberId: string, stars: number, reason: string, createdBy: string) => void;
  completeOnboarding: () => void;
  toggleSound: () => void;
  reset: () => Promise<void>;
}

function saveToStorage(state: AppState): void {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    try {
      const toSave: AppState = {
        schemaVersion: state.schemaVersion,
        onboardingComplete: state.onboardingComplete,
        actingMemberId: state.actingMemberId,
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

export const useStore = create<AppState & StoreActions & { isReady: boolean }>((set, get) => ({
  ...DEFAULT_STATE,
  isReady: false,

  initialize: async () => {
    if (isInitialized) return;
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

  setActingMember: (memberId) => {
    set({ actingMemberId: memberId });
    saveToStorage({ ...get(), actingMemberId: memberId });
  },

  setTaskTemplates: (templates) => {
    set({ taskTemplates: templates });
    saveToStorage({ ...get(), taskTemplates: templates });
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
    const newInstance: TaskInstance = {
      ...instance,
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString()
    };
    const taskInstances = [...get().taskInstances, newInstance];
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

  completeTask: (instanceId) => {
    const state = get();
    const instance = state.taskInstances.find((t) => t.id === instanceId);
    
    if (!instance || instance.status === "done") return;

    const template = state.taskTemplates.find((t) => t.id === instance.templateId);
    const starsEarned = template?.defaultStars || 1;

    const taskInstances = state.taskInstances.map((t) =>
      t.id === instanceId
        ? { ...t, status: "done" as const, completedAt: new Date().toISOString() }
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

  completeOnboarding: () => {
    set({ onboardingComplete: true });
    saveToStorage({ ...get(), onboardingComplete: true });
  },

  toggleSound: () => {
    const settings = { ...get().settings, soundsEnabled: !get().settings.soundsEnabled };
    set({ settings });
    saveToStorage({ ...get(), settings });
  },

  reset: async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    set({ ...DEFAULT_STATE, isReady: true });
  }
}));

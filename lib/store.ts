import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, Member, TaskTemplate, TaskInstance, DEFAULT_STATE, Power, PowerKey } from "./types";

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
  setTaskTemplates: (templates: TaskTemplate[]) => void;
  toggleTaskTemplate: (id: string) => void;
  addTaskInstance: (instance: Omit<TaskInstance, "id" | "createdAt">) => void;
  updateTaskInstance: (id: string, updates: Partial<TaskInstance>) => void;
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
        members: state.members,
        taskTemplates: state.taskTemplates,
        taskInstances: state.taskInstances,
        settings: state.settings
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
      console.error("Failed to save to AsyncStorage:", e);
    }
  }, DEBOUNCE_MS);
}

export const useStore = create<AppState & StoreActions & { isReady: boolean }>((set, get) => ({
  ...DEFAULT_STATE,
  isReady: false,

  initialize: async () => {
    if (isInitialized) return;
    isInitialized = true;
    
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.schemaVersion === DEFAULT_STATE.schemaVersion) {
          set({ ...DEFAULT_STATE, ...parsed, isReady: true });
          return;
        }
      }
    } catch (e) {
      console.error("Failed to load from AsyncStorage:", e);
    }
    set({ isReady: true });
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

  addTaskInstance: (instance) => {
    const newInstance: TaskInstance = {
      ...instance,
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString()
    };
    const taskInstances = [...get().taskInstances, newInstance];
    set({ taskInstances });
    saveToStorage({ ...get(), taskInstances });
  },

  updateTaskInstance: (id, updates) => {
    const taskInstances = get().taskInstances.map((t) =>
      t.id === id ? { ...t, ...updates } : t
    );
    set({ taskInstances });
    saveToStorage({ ...get(), taskInstances });
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

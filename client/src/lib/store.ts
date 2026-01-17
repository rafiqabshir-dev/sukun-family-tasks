import { create } from "zustand";
import { AppState, Member, TaskTemplate, DEFAULT_STATE } from "./types";

const STORAGE_KEY = "barakah-kids-race:v1";
const DEBOUNCE_MS = 300;

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

function loadFromStorage(): AppState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_STATE;
    
    const parsed = JSON.parse(stored);
    if (parsed.schemaVersion !== DEFAULT_STATE.schemaVersion) {
      return DEFAULT_STATE;
    }
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return DEFAULT_STATE;
  }
}

function saveToStorage(state: AppState): void {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      const toSave: AppState = {
        schemaVersion: state.schemaVersion,
        onboardingComplete: state.onboardingComplete,
        members: state.members,
        taskTemplates: state.taskTemplates,
        soundEnabled: state.soundEnabled
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
      console.error("Failed to save to localStorage:", e);
    }
  }, DEBOUNCE_MS);
}

interface StoreActions {
  addMember: (member: Omit<Member, "id" | "points">) => void;
  updateMember: (id: string, updates: Partial<Member>) => void;
  removeMember: (id: string) => void;
  setTaskTemplates: (templates: TaskTemplate[]) => void;
  toggleTaskTemplate: (id: string) => void;
  completeOnboarding: () => void;
  toggleSound: () => void;
  reset: () => void;
}

export const useStore = create<AppState & StoreActions>((set, get) => ({
  ...loadFromStorage(),
  
  addMember: (member) => {
    const newMember: Member = {
      ...member,
      id: crypto.randomUUID(),
      points: 0
    };
    const members = [...get().members, newMember];
    set({ members });
    saveToStorage({ ...get(), members });
  },
  
  updateMember: (id, updates) => {
    const members = get().members.map(m => 
      m.id === id ? { ...m, ...updates } : m
    );
    set({ members });
    saveToStorage({ ...get(), members });
  },
  
  removeMember: (id) => {
    const members = get().members.filter(m => m.id !== id);
    set({ members });
    saveToStorage({ ...get(), members });
  },
  
  setTaskTemplates: (templates) => {
    set({ taskTemplates: templates });
    saveToStorage({ ...get(), taskTemplates: templates });
  },
  
  toggleTaskTemplate: (id) => {
    const taskTemplates = get().taskTemplates.map(t =>
      t.id === id ? { ...t, enabled: !t.enabled } : t
    );
    set({ taskTemplates });
    saveToStorage({ ...get(), taskTemplates });
  },
  
  completeOnboarding: () => {
    set({ onboardingComplete: true });
    saveToStorage({ ...get(), onboardingComplete: true });
  },
  
  toggleSound: () => {
    const soundEnabled = !get().soundEnabled;
    set({ soundEnabled });
    saveToStorage({ ...get(), soundEnabled });
  },
  
  reset: () => {
    localStorage.removeItem(STORAGE_KEY);
    set(DEFAULT_STATE);
  }
}));

export type MemberRole = "kid" | "guardian";

export type PowerType = 
  | "organizer" 
  | "fast_cleaner" 
  | "kitchen_helper" 
  | "study_coach" 
  | "calm_peacemaker" 
  | "discipline";

export interface Member {
  id: string;
  name: string;
  role: MemberRole;
  age: number;
  powers: PowerType[];
  points: number;
}

export interface TaskTemplate {
  id: string;
  name: string;
  icon: string;
  points: number;
  enabled: boolean;
}

export interface AppState {
  schemaVersion: number;
  onboardingComplete: boolean;
  members: Member[];
  taskTemplates: TaskTemplate[];
  soundEnabled: boolean;
}

export const POWERS_INFO: Record<PowerType, { name: string; description: string; icon: string }> = {
  organizer: {
    name: "Organizer",
    description: "Great at keeping things tidy and in order",
    icon: "FolderOpen"
  },
  fast_cleaner: {
    name: "Fast Cleaner",
    description: "Quick and efficient at cleaning up",
    icon: "Sparkles"
  },
  kitchen_helper: {
    name: "Kitchen Helper",
    description: "Loves helping in the kitchen",
    icon: "ChefHat"
  },
  study_coach: {
    name: "Study Coach",
    description: "Focused and helpful with learning",
    icon: "BookOpen"
  },
  calm_peacemaker: {
    name: "Calm Peacemaker",
    description: "Brings peace and harmony to others",
    icon: "Heart"
  },
  discipline: {
    name: "Discipline",
    description: "Stays on track and follows routines",
    icon: "Target"
  }
};

export const DEFAULT_STATE: AppState = {
  schemaVersion: 1,
  onboardingComplete: false,
  members: [],
  taskTemplates: [],
  soundEnabled: false
};

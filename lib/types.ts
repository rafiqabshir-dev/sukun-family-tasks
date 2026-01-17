export type PowerKey = 
  | "organizer" 
  | "fastCleaner" 
  | "kitchenHelper" 
  | "studyCoach" 
  | "calmPeacemaker" 
  | "discipline";

export interface Power {
  powerKey: PowerKey;
  level: number;
  xp: number;
}

export interface Member {
  id: string;
  name: string;
  role: "kid" | "guardian";
  age: number;
  starsTotal: number;
  powers: Power[];
}

export type TaskCategory = 
  | "cleaning" 
  | "kitchen" 
  | "learning" 
  | "kindness" 
  | "prayer" 
  | "outdoor" 
  | "personal";

export type TaskDifficulty = "easy" | "medium" | "hard";

export interface TaskTemplate {
  id: string;
  title: string;
  category: TaskCategory;
  iconKey: string;
  defaultStars: number;
  difficulty: TaskDifficulty;
  preferredPowers: PowerKey[];
  minAge?: number;
  maxAge?: number;
  enabled: boolean;
  isArchived?: boolean;
}

export type TaskStatus = "open" | "pending_approval" | "done";

export interface TaskInstance {
  id: string;
  templateId: string;
  assignedToMemberId: string;
  dueAt: string;
  status: TaskStatus;
  createdAt: string;
  completedAt?: string;
  // Approval workflow fields
  completionRequestedAt?: string;
  completionRequestedBy?: string;
  approvedBy?: string;
}

export interface StagedTask {
  id: string;
  title: string;
  stars: number;
  templateId?: string;
}

export interface Settings {
  islamicValuesMode: boolean;
  soundsEnabled: boolean;
}

export type RewardStatus = "active" | "redeemed";

export interface Reward {
  id: string;
  title: string;
  description?: string;
  starsCost: number;
  createdAt: string;
  redeemedAt?: string;
  redeemedBy?: string;
  status: RewardStatus;
}

export interface StarDeduction {
  id: string;
  memberId: string;
  stars: number;
  reason: string;
  createdAt: string;
  createdBy: string;
}

export interface AppState {
  schemaVersion: number;
  onboardingComplete: boolean;
  actingMemberId: string | null;
  members: Member[];
  taskTemplates: TaskTemplate[];
  taskInstances: TaskInstance[];
  spinQueue: StagedTask[];
  lastWinnerIds: string[];
  rewards: Reward[];
  starDeductions: StarDeduction[];
  settings: Settings;
}

export const DEFAULT_STATE: AppState = {
  schemaVersion: 1,
  onboardingComplete: false,
  actingMemberId: null,
  members: [],
  taskTemplates: [],
  taskInstances: [],
  spinQueue: [],
  lastWinnerIds: [],
  rewards: [],
  starDeductions: [],
  settings: {
    islamicValuesMode: true,
    soundsEnabled: false
  }
};

export const POWER_INFO: Record<PowerKey, { name: string; emoji: string; description: string }> = {
  organizer: {
    name: "Organizer",
    emoji: "📋",
    description: "Great at keeping things tidy and in order"
  },
  fastCleaner: {
    name: "Fast Cleaner",
    emoji: "🧹",
    description: "Quick and thorough at cleaning tasks"
  },
  kitchenHelper: {
    name: "Kitchen Helper",
    emoji: "👨‍🍳",
    description: "Loves helping with cooking and kitchen chores"
  },
  studyCoach: {
    name: "Study Coach",
    emoji: "📚",
    description: "Focused learner who helps others study"
  },
  calmPeacemaker: {
    name: "Calm Peacemaker",
    emoji: "🕊️",
    description: "Brings peace and harmony to the family"
  },
  discipline: {
    name: "Discipline",
    emoji: "⏰",
    description: "Stays on schedule and keeps routines"
  }
};

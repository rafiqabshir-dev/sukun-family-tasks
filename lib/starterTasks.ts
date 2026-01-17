import { TaskTemplate, TaskCategory, TaskDifficulty, PowerKey } from "./types";

interface TaskDef {
  title: string;
  category: TaskCategory;
  iconKey: string;
  defaultStars: number;
  difficulty: TaskDifficulty;
  preferredPowers: PowerKey[];
  minAge?: number;
  maxAge?: number;
}

const STARTER_TASKS: TaskDef[] = [
  { title: "Make your bed", category: "cleaning", iconKey: "bed", defaultStars: 1, difficulty: "easy", preferredPowers: ["organizer", "fastCleaner"] },
  { title: "Put dirty clothes in hamper", category: "cleaning", iconKey: "shirt", defaultStars: 1, difficulty: "easy", preferredPowers: ["organizer", "fastCleaner"] },
  { title: "Tidy up your room", category: "cleaning", iconKey: "home", defaultStars: 2, difficulty: "medium", preferredPowers: ["organizer", "fastCleaner"] },
  { title: "Vacuum your room", category: "cleaning", iconKey: "wind", defaultStars: 2, difficulty: "medium", preferredPowers: ["fastCleaner"], minAge: 7 },
  { title: "Dust furniture", category: "cleaning", iconKey: "sparkles", defaultStars: 2, difficulty: "medium", preferredPowers: ["fastCleaner"], minAge: 6 },
  { title: "Clean up toys", category: "cleaning", iconKey: "puzzle-piece", defaultStars: 1, difficulty: "easy", preferredPowers: ["organizer"], maxAge: 10 },
  { title: "Wipe down bathroom sink", category: "cleaning", iconKey: "droplet", defaultStars: 2, difficulty: "medium", preferredPowers: ["fastCleaner"], minAge: 7 },
  { title: "Help fold laundry", category: "cleaning", iconKey: "shirt", defaultStars: 2, difficulty: "medium", preferredPowers: ["organizer", "fastCleaner"], minAge: 6 },
  
  { title: "Set the table", category: "kitchen", iconKey: "utensils", defaultStars: 1, difficulty: "easy", preferredPowers: ["kitchenHelper"] },
  { title: "Clear the table", category: "kitchen", iconKey: "utensils", defaultStars: 1, difficulty: "easy", preferredPowers: ["kitchenHelper"] },
  { title: "Wash dishes", category: "kitchen", iconKey: "droplet", defaultStars: 2, difficulty: "medium", preferredPowers: ["kitchenHelper"], minAge: 8 },
  { title: "Dry and put away dishes", category: "kitchen", iconKey: "box", defaultStars: 2, difficulty: "medium", preferredPowers: ["kitchenHelper", "organizer"], minAge: 6 },
  { title: "Help prepare breakfast", category: "kitchen", iconKey: "sun", defaultStars: 2, difficulty: "medium", preferredPowers: ["kitchenHelper"], minAge: 7 },
  { title: "Help prepare lunch", category: "kitchen", iconKey: "sandwich", defaultStars: 2, difficulty: "medium", preferredPowers: ["kitchenHelper"], minAge: 7 },
  { title: "Put groceries away", category: "kitchen", iconKey: "shopping-bag", defaultStars: 2, difficulty: "medium", preferredPowers: ["kitchenHelper", "organizer"], minAge: 6 },
  { title: "Wipe kitchen counter", category: "kitchen", iconKey: "sparkles", defaultStars: 1, difficulty: "easy", preferredPowers: ["kitchenHelper", "fastCleaner"], minAge: 6 },
  
  { title: "Read for 15 minutes", category: "learning", iconKey: "book-open", defaultStars: 2, difficulty: "easy", preferredPowers: ["studyCoach"] },
  { title: "Practice handwriting", category: "learning", iconKey: "pencil", defaultStars: 2, difficulty: "medium", preferredPowers: ["studyCoach", "discipline"], maxAge: 10 },
  { title: "Do homework", category: "learning", iconKey: "book", defaultStars: 3, difficulty: "hard", preferredPowers: ["studyCoach", "discipline"], minAge: 6 },
  { title: "Practice math facts", category: "learning", iconKey: "calculator", defaultStars: 2, difficulty: "medium", preferredPowers: ["studyCoach"], minAge: 5 },
  { title: "Learn 3 new words", category: "learning", iconKey: "message-circle", defaultStars: 2, difficulty: "medium", preferredPowers: ["studyCoach"] },
  { title: "Help a sibling with homework", category: "learning", iconKey: "users", defaultStars: 3, difficulty: "hard", preferredPowers: ["studyCoach", "calmPeacemaker"], minAge: 9 },
  
  { title: "Say a kind word to someone", category: "kindness", iconKey: "heart", defaultStars: 1, difficulty: "easy", preferredPowers: ["calmPeacemaker"] },
  { title: "Help a family member", category: "kindness", iconKey: "hand-helping", defaultStars: 2, difficulty: "easy", preferredPowers: ["calmPeacemaker"] },
  { title: "Share toys with sibling", category: "kindness", iconKey: "gift", defaultStars: 2, difficulty: "medium", preferredPowers: ["calmPeacemaker"], maxAge: 12 },
  { title: "Write a thank you note", category: "kindness", iconKey: "mail", defaultStars: 2, difficulty: "medium", preferredPowers: ["calmPeacemaker"], minAge: 6 },
  { title: "Resolve a conflict peacefully", category: "kindness", iconKey: "handshake", defaultStars: 3, difficulty: "hard", preferredPowers: ["calmPeacemaker"] },
  { title: "Compliment a family member", category: "kindness", iconKey: "smile", defaultStars: 1, difficulty: "easy", preferredPowers: ["calmPeacemaker"] },
  
  { title: "Pray on time", category: "prayer", iconKey: "moon", defaultStars: 2, difficulty: "easy", preferredPowers: ["discipline"] },
  { title: "Make dua for family", category: "prayer", iconKey: "heart", defaultStars: 1, difficulty: "easy", preferredPowers: ["calmPeacemaker"] },
  { title: "Read Quran for 10 minutes", category: "prayer", iconKey: "book", defaultStars: 3, difficulty: "medium", preferredPowers: ["studyCoach", "discipline"], minAge: 6 },
  { title: "Learn a new surah", category: "prayer", iconKey: "star", defaultStars: 3, difficulty: "hard", preferredPowers: ["studyCoach", "discipline"], minAge: 5 },
  { title: "Say morning adhkar", category: "prayer", iconKey: "sunrise", defaultStars: 2, difficulty: "easy", preferredPowers: ["discipline"] },
  { title: "Say evening adhkar", category: "prayer", iconKey: "sunset", defaultStars: 2, difficulty: "easy", preferredPowers: ["discipline"] },
  
  { title: "Water plants", category: "outdoor", iconKey: "flower", defaultStars: 1, difficulty: "easy", preferredPowers: ["organizer"] },
  { title: "Take out trash", category: "outdoor", iconKey: "trash-2", defaultStars: 2, difficulty: "medium", preferredPowers: ["fastCleaner"], minAge: 7 },
  { title: "Play outside for 30 minutes", category: "outdoor", iconKey: "sun", defaultStars: 2, difficulty: "easy", preferredPowers: [] },
  { title: "Help with yard work", category: "outdoor", iconKey: "leaf", defaultStars: 3, difficulty: "hard", preferredPowers: ["fastCleaner"], minAge: 8 },
  
  { title: "Brush teeth morning", category: "personal", iconKey: "smile", defaultStars: 1, difficulty: "easy", preferredPowers: ["discipline"] },
  { title: "Brush teeth evening", category: "personal", iconKey: "moon", defaultStars: 1, difficulty: "easy", preferredPowers: ["discipline"] },
  { title: "Get ready for school on time", category: "personal", iconKey: "clock", defaultStars: 2, difficulty: "medium", preferredPowers: ["discipline"], minAge: 5 },
  { title: "Pack school bag", category: "personal", iconKey: "backpack", defaultStars: 1, difficulty: "easy", preferredPowers: ["organizer", "discipline"], minAge: 5 },
  { title: "Sleep on time", category: "personal", iconKey: "moon", defaultStars: 2, difficulty: "medium", preferredPowers: ["discipline"] },
  { title: "Limit screen time", category: "personal", iconKey: "monitor", defaultStars: 3, difficulty: "hard", preferredPowers: ["discipline"] },
];

export function generateStarterTasks(): TaskTemplate[] {
  return STARTER_TASKS.map((task, index) => ({
    id: `starter-${index + 1}`,
    ...task,
    enabled: true
  }));
}

export function getTasksForAge(templates: TaskTemplate[], age: number): TaskTemplate[] {
  return templates.filter(t => {
    if (t.minAge && age < t.minAge) return false;
    if (t.maxAge && age > t.maxAge) return false;
    return true;
  });
}

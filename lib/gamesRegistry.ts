/**
 * Games Registry
 * 
 * HOW TO ADD A NEW GAME:
 * 1. Add an entry to the GAMES array below with all required fields
 * 2. Create the game screen component in app/games/[your-game].tsx
 * 3. The Games Hub will automatically show the new game in its category
 */

export type GameCategory = 'spin' | 'party' | 'learning' | 'rewards';

export interface GameDefinition {
  id: string;
  title: string;
  subtitle: string;
  category: GameCategory;
  icon: string;
  iconColor: string;
  isNew?: boolean;
  isEnabled?: boolean;
  requiresGuardian?: boolean;
  isComingSoon?: boolean;
  comingSoonNote?: string;
}

export interface CategoryDefinition {
  id: GameCategory;
  title: string;
  icon: string;
}

export const CATEGORIES: CategoryDefinition[] = [
  { id: 'spin', title: 'Spin Games', icon: 'sync-outline' },
  { id: 'party', title: 'Party Games', icon: 'people-outline' },
  { id: 'learning', title: 'Learning Games', icon: 'school-outline' },
];

export const GAMES: GameDefinition[] = [
  {
    id: 'assign-task',
    title: 'Assign a Task',
    subtitle: 'Spin to pick who does what',
    category: 'spin',
    icon: 'list-outline',
    iconColor: '#4CAF50',
    isEnabled: true,
    requiresGuardian: true,
  },
  {
    id: 'family-game',
    title: 'Family Game',
    subtitle: 'Race to collect stars',
    category: 'spin',
    icon: 'star-outline',
    iconColor: '#FFC107',
    isEnabled: true,
    requiresGuardian: true,
  },
  {
    id: 'charades-mini',
    title: 'Charades Mini',
    subtitle: 'Act it out, guess the word',
    category: 'party',
    icon: 'body-outline',
    iconColor: '#9C27B0',
    isNew: true,
    isEnabled: true,
    requiresGuardian: false,
  },
  {
    id: 'dua-detective',
    title: 'Dua Detective',
    subtitle: "Match situations to du'as",
    category: 'learning',
    icon: 'moon-outline',
    iconColor: '#00897B',
    isNew: true,
    isEnabled: true,
    isComingSoon: true,
    comingSoonNote: "Practice daily du'as with quick multiple-choice questions.",
  },
  {
    id: 'seerah-stories',
    title: 'Seerah Stories',
    subtitle: 'What happened next?',
    category: 'learning',
    icon: 'book-outline',
    iconColor: '#5D4037',
    isEnabled: true,
    isComingSoon: true,
    comingSoonNote: 'Short, kid-friendly Seerah questions with lessons.',
  },
  {
    id: 'world-geography',
    title: 'Where In The World?',
    subtitle: 'Flags, countries, capitals',
    category: 'learning',
    icon: 'globe-outline',
    iconColor: '#1976D2',
    isEnabled: true,
    isComingSoon: true,
    comingSoonNote: 'Fun geography quizzes: flags, continents, capitals.',
  },
  {
    id: 'somalia-explorer',
    title: 'Somalia Explorer',
    subtitle: 'States, cities, and history',
    category: 'learning',
    icon: 'map-outline',
    iconColor: '#43A047',
    isEnabled: true,
    isComingSoon: true,
    comingSoonNote: 'Somalia-only quiz pack: states, cities, landmarks, basics.',
  },
];

export function getGamesByCategory(category: GameCategory): GameDefinition[] {
  return GAMES.filter(game => game.category === category && game.isEnabled !== false);
}

export function getGameById(id: string): GameDefinition | undefined {
  return GAMES.find(game => game.id === id);
}

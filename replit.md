# Barakah Kids Race

## Overview

Barakah Kids Race is a React Native mobile app built with Expo for family-oriented task management. It gamifies household responsibilities for kids ages 5-12 through a points-based system with gentle Islamic values. The app features onboarding for setting up family members, assigning "powers" (character strengths) to kids, and selecting tasks from a starter pack of 40+ kid-appropriate activities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Mobile App Architecture
- **Framework**: React Native with Expo SDK 54
- **Navigation**: Expo Router with file-based routing
- **State Management**: Zustand with AsyncStorage persistence
- **Styling**: React Native StyleSheet (no NativeWind - using StyleSheet for simplicity)
- **Icons**: @expo/vector-icons (Ionicons)
- **Typography**: System fonts with consistent sizing scale

### Screen Structure
- **Tabs**: Today, Spin, Leaderboard, Setup (via Expo Router tabs)
- **Onboarding**: Welcome → Add Members → Power Selection → Task Review
- **Persistence**: AsyncStorage with key `barakah-kids-race:v1`, 300ms debounced autosave

### Data Model (TypeScript)
- **Member**: id, name, role ("kid"|"guardian"), age, starsTotal, powers[]
- **TaskTemplate**: id, title, category, iconKey, defaultStars, difficulty, preferredPowers[], minAge?, maxAge?, enabled
- **TaskInstance**: id, templateId, assignedToMemberId, dueAt, status, createdAt, completedAt?
- **Settings**: islamicValuesMode, soundsEnabled

### File Structure
```
app/                    # Expo Router screens
  (tabs)/               # Bottom tab navigator
    _layout.tsx         # Tab configuration
    today.tsx           # Today's tasks
    spin.tsx            # Task spinner wheel
    leaderboard.tsx     # Stars leaderboard
    setup.tsx           # Family & task setup
  onboarding/           # Onboarding flow
    index.tsx           # Welcome screen
    add-members.tsx     # Add family members
    powers.tsx          # Power selection for kids
    tasks.tsx           # Task template review
lib/                    # Shared utilities
  store.ts              # Zustand store with AsyncStorage
  types.ts              # TypeScript types
  starterTasks.ts       # 40+ starter task templates
  theme.ts              # Color palette and spacing
assets/                 # App icons and splash
```

## Scripts

- `npm run start` - Start Expo development server
- `npm run web` - Start Expo for web browser
- `npm run android` - Start Expo for Android
- `npm run ios` - Start Expo for iOS

## Key Features

### Powers System
Six starter powers kids can choose (1-2 per kid):
- Organizer, Fast Cleaner, Kitchen Helper, Study Coach, Calm Peacemaker, Discipline

### Task Categories
- Cleaning, Kitchen, Learning, Kindness, Prayer, Outdoor, Personal

### Task Assignment & Completion (V1 Prompt 2A - VALIDATED)
- **Act As Selector**: Setup tab has "Act As" section to switch between family members
- **actingMemberId**: Persisted in store to track who is using the app
- **Guardian Task Assignment**: Today tab shows "Assign New Task" button for guardians
  - Modal with task template selection, kid selection, due date picker
  - Auto-selects kid if only one exists
  - Due dates stored with local noon time (T12:00:00) to prevent timezone issues
- **Kid Task View**: Today tab shows "My Tasks" section only (guardians see "Due Today"/"Overdue")
- **Task Completion**: Kids tap checkmark to complete tasks, earns stars
- **Status Tracking**: Tasks can be open, done, or overdue (computed from due date)
- **Leaderboard**: Table-style view with Rank, Name, Stars columns (trophy icons for top 3)
- **Validation**: See VALIDATION_V1_2.md for full test scenarios and demo script

### V1 Prompt 2.1 - Post-2B Fix Pack
- **Naming Cleanup**: Consistent terms (Family Members, Kids, Guardians, Stars)
- **Table Leaderboard**: Replaced podium view with clear table showing rank, avatar, name, stars
- **Add Members**: Setup tab has "Add" button to add new kids/guardians locally
  - Modal with name, age, role (Kid/Guardian) selection
  - New members appear in Act As selector and leaderboard immediately

### V1 Prompt 3A - Spin Game + Tasks Fix Pack
- **Tasks Tab**: New tab for managing task templates
  - Add new tasks with name, stars (1-5), category
  - Edit existing tasks inline
  - Archive tasks (soft-delete) to preserve history
  - Toggle task enabled/disabled
  - Add tasks directly to spin queue
- **Member Detail Screen**: Tap any member to see:
  - Profile card with avatar, name, stars, powers
  - Open/overdue tasks
  - Completed task history (recent 10)
- **Spin Game with Staged Tasks**:
  - **Spin Queue**: Stage tasks before spinning
  - Add via quick-create (name only) or from templates
  - Spin picks random kid with fairness weighting
  - **Proposal Flow**: Shows selected kid + task, requires parent approval
  - **Reroll**: Spin again without creating assignment
  - **Accept**: Creates TaskInstance, removes from queue, records winner
- **Fairness System**: Tracks last 3 winners, reduces probability of same kid winning repeatedly
- **Navigation**: 5 tabs now - Today, Tasks, Spin, Leaderboard, Setup

### Islamic Values Tone
- Positive, gentle wording throughout
- Sounds disabled by default
- No music autoplay
- Focus on good deeds and family harmony

## External Dependencies

- expo, expo-router, expo-constants, expo-linking, expo-status-bar
- react-native, react-native-web, react-native-screens, react-native-safe-area-context
- react-native-gesture-handler, react-native-reanimated
- @expo/vector-icons, @react-native-async-storage/async-storage
- zustand, date-fns, typescript

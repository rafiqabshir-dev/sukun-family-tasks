# Sukun

## Overview

Sukun (formerly Barakah Kids Race) is a React Native mobile app built with Expo for family-oriented task management. Tagline: "Family Tasks Made Simple". It gamifies household responsibilities for kids ages 5-12 through a points-based system with gentle Islamic values. The app features onboarding for setting up family members, assigning "powers" (character strengths) to kids, and selecting tasks from a starter pack of 40+ kid-appropriate activities.

## Branding
- **App Name**: Sukun
- **Tagline**: Family Tasks Made Simple
- **Logo**: assets/sukun-logo.png (used on welcome, sign-in, sign-up screens)

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
- **TaskTemplate**: id, title, category, iconKey, defaultStars, difficulty, preferredPowers[], minAge?, maxAge?, enabled, scheduleType?, timeWindowMinutes?
- **TaskInstance**: id, templateId, assignedToMemberId, dueAt, status, createdAt, completedAt?, expiresAt?, scheduleType?
- **TaskScheduleType**: "one_time" | "recurring_daily" | "time_sensitive"
- **TaskStatus**: "open" | "pending_approval" | "done" | "expired"
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
- **Navigation**: 3 visible tabs (Today, Leaderboard, Rewards) with hamburger menu for Tasks, Spin, Setup

### V1 Prompt 3B - Rewards + Task Completion Improvements
- **Rewards System**: New Rewards tab for parents to set goals
  - Add rewards with name, description, star cost (5/10/20/50 or custom)
  - Kids see progress bars toward closest reward
  - Guardians can grant rewards to kids who have enough stars
  - Stars deducted from kid's total on redemption
  - History of claimed rewards preserved
- **Task Completion**: Guardians can now complete tasks for any kid
  - Larger, more visible checkmark buttons
  - Stars properly awarded to the assigned kid
- **Template Migration**: Auto-fixes templates missing title/icon with sensible defaults
  - Looks up starter tasks by ID to restore original task names
- **Star Deductions**: Guardians can deduct stars for misbehavior
  - Requires a reason to be entered
  - Tracks who made the deduction and when
  - Deduction history visible on Member Detail screen
- **Task Approval Workflow**: Completing a task requires approval from another person
  - When someone marks a task complete, it goes to "pending_approval" status
  - Another family member must approve (or reject) the completion
  - Approver cannot be the same person who requested completion
  - Stars only awarded after approval
  - "Needs Approval" section shows pending tasks on Today tab
- **Navigation**: 3 visible tabs (Today, Leaderboard, Rewards) + hamburger menu (Tasks, Spin, Setup)

### V1 Prompt 4 - Settings & Owner Controls
- **Sign-Out Button**: Added to Settings section in Setup screen (only shows in cloud mode)
  - Confirmation dialog before signing out
  - Redirects to sign-in screen after logout
- **Owner-Only Member Management**: 
  - Only the family owner (first guardian to join) can add new members
  - Queries Supabase to determine ownership based on earliest guardian created_at
  - In offline mode, any guardian can manage members (single-device scenario)
- **Invite Members Drawer**: When no participants exist, shows "No participants yet" with invite button
  - Copy invite code to clipboard
  - Share on WhatsApp
  - Add member locally option
- **User Switcher**: Today screen has tappable user card to switch between all family members
- **Terminology**: Replaced "kids" with "participants" throughout UI

### V1 - Task Types (Recurring & Time-Sensitive)
- **Task Schedule Types**: Three types of tasks now supported:
  - **One-Time**: Default behavior, complete once (no changes from before)
  - **Recurring Daily**: Auto-regenerates each day for all kids, expires at end of day
  - **Time-Sensitive**: Expires after specified minutes (5, 10, 15, 30, or 60)
- **Task Creation UI**: Tasks tab now includes schedule type selector
  - Visual toggle between One-Time, Daily, and Timed
  - Time window picker appears when "Timed" is selected
- **Expiration System**:
  - `expiresAt` field on TaskInstance tracks when task expires
  - `checkExpiredTasks()` runs on mount and every 60 seconds
  - Expired tasks marked with "expired" status and grayed out
- **Recurring Regeneration**:
  - `regenerateRecurringTasks()` creates daily instances each morning
  - Checks age restrictions before assigning to kids
  - Only creates if no open/pending task exists for today
- **Today View Enhancements**:
  - Schedule type badges (Daily/Timed) on task cards
  - Live countdown timer for time-sensitive tasks
  - Urgent styling (red) when less than 5 minutes remain
  - Expired indicator and status for expired tasks

### Islamic Values Tone
- Positive, gentle wording throughout
- Sounds disabled by default
- No music autoplay
- Focus on good deeds and family harmony

## Supabase Cloud Sync (Multi-User Mode)

The app supports optional cloud sync via Supabase for multi-user family collaboration across devices.

### Setup Instructions

1. **Create Supabase Project**: Go to [supabase.com](https://supabase.com) and create a new project
2. **Run Schema**: Copy contents of `supabase/schema.sql` and run in Supabase SQL Editor
3. **Enable Email Auth**: In Authentication > Providers, enable Email provider
4. **Add Secrets**: In Replit Secrets tab, add these two secrets:
   - `SUPABASE_URL` - Your project URL (e.g., https://xxx.supabase.co)
   - `SUPABASE_ANON_KEY` - Your project's anon/public key
5. **Restart the app** after adding secrets to pick up the new configuration

### Cloud Data Model

- **families**: Family groups with invite codes for joining
- **profiles**: User profiles linked to Supabase Auth (extends auth.users)
- **tasks**: Task templates shared within a family
- **task_instances**: Assigned tasks with status tracking
- **task_approvals**: Approval records (enforces different person must approve)
- **stars_ledger**: Immutable log of all star transactions
- **rewards**: Family reward definitions
- **reward_claims**: Redemption history
- **spin_queue/spin_history**: Task spinning game state

### Auth Flow

1. Sign Up with email/password → Creates auth user + profile
2. Create Family (generates invite code) or Join Family (enter code)
3. Family data syncs across all family member devices in real-time

### Offline Mode

If Supabase is not configured (missing SUPABASE_URL/SUPABASE_ANON_KEY), the app runs in offline-only mode using local AsyncStorage. All features work locally but don't sync across devices.

### Security Features

- Row Level Security (RLS) ensures users only see their family's data
- Task approval requires different person than completion requester
- Unique database constraints prevent duplicate approvals/star awards
- Stars ledger is append-only for audit trail

## External Dependencies

- expo, expo-router, expo-constants, expo-linking, expo-status-bar
- react-native, react-native-web, react-native-screens, react-native-safe-area-context
- react-native-gesture-handler, react-native-reanimated
- @expo/vector-icons, @react-native-async-storage/async-storage
- zustand, date-fns, typescript
- @supabase/supabase-js (cloud sync)
- expo-secure-store (secure token storage)

# Sukun

## Overview

Sukun is a React Native mobile app designed to gamify household responsibilities for children aged 5-12, fostering family-oriented task management with a focus on Islamic values. The app aims to simplify family tasks through a points-based system, assigning unique "powers" to kids, and a starter pack of over 40 kid-appropriate activities. It uses Supabase as the cloud backend for multi-user collaboration (Supabase is required - no offline mode).

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Mobile App Architecture
- **Framework**: React Native with Expo SDK 54, utilizing Expo Router for file-based navigation.
- **State Management**: Zustand with AsyncStorage for local persistence.
- **Styling**: Native React Native StyleSheet.
- **Icons**: @expo/vector-icons (Ionicons).
- **Branding**: App name "Sukun", tagline "Family Tasks Made Simple", and a specific logo (`assets/sukun-logo.png`).

### Core Features
- **Gamification**: Includes a "Powers" system for kids (e.g., Organizer, Fast Cleaner), a "Spin" game for task assignment, and a "Leaderboard" to track stars.
- **Task Management**: Supports "One-Time", "Recurring Daily", and "Time-Sensitive" task types with expiration mechanisms and regeneration for daily tasks. Guardians can assign tasks, and kids can complete them for stars.
- **Rewards System**: Guardians can set star-cost rewards, which kids can claim, with star deductions for misbehavior also supported.
- **Approval Workflows**: 
  - Participants (kids) always require guardian approval for task completion.
  - Single guardian families: guardians can complete tasks directly without approval.
  - Multiple guardian families: guardians require cross-approval from another guardian.
  - Family joining involves an approval process by the family owner.
- **Multi-User & Roles**: Differentiates between "kids" (participants) and "guardians" with specific permissions. Guardians can manage members and tasks, while kids can complete assigned tasks. Each user interacts as themselves based on their authenticated profile (no user switching).
- **User Management**: Family owners (first guardian) control member invitations and approvals. User profiles can be edited from the Setup screen.
- **Data Model**: Core entities include `Member` (id, name, role, age, starsTotal, powers, profileId), `TaskTemplate` (id, title, category, defaultStars, scheduleType), `TaskInstance` (assigned to member, dueAt, status), and `Settings`.
- **UI/UX**: Features a tab-based navigation (Today, Spin, Leaderboard, Setup), an onboarding flow, and consistent typography. Islamic values are reflected in a gentle tone and default sound settings.

### Cloud Integration (Supabase)
- **Cloud-Only Mode**: Supabase is required. Members, tasks, and task instances are loaded directly from the cloud (no local storage merging). This prevents data duplication and ensures cloud is the single source of truth.
- **Cloud-First Task Operations**:
  - Task templates stored in `tasks` table with schedule_type, time_window_minutes
  - Task instances stored in `task_instances` table with expires_at, schedule_type
  - On login, authContext loads tasks/instances from Supabase alongside members
  - Task assignment (including Spin wheel) creates cloud record first via `createCloudTaskInstance()`, then syncs to local store using cloud-generated UUID
  - Task completion, approval, and rejection all sync to cloud in real-time via `updateCloudTaskInstance()`
  - Stars are persisted to `stars_ledger` table for all task-related star awards
  - Important: Never use locally-generated task IDs (like "task-{timestamp}") for cloud operations - always use Supabase UUIDs
- **Auth Flow**: Two authentication methods available:
  1. **Email/password** (for guardians): Standard sign-up with email confirmation, includes "Remember my email" option that saves email to AsyncStorage for convenience
  2. **Passcode** (for participants/kids): Simplified 4-digit code login
- **Participant Passcode System**:
  - Kids join using family invite code + their name (no email required)
  - System generates a unique 4-digit passcode for login
  - Passcode stored in `profiles.passcode` column (unique)
  - Auto-generated email format: `participant{passcode}@sukun.app`
  - Sign-in screen has "Login with Code" option for kids
- **Security**: Utilizes Row Level Security (RLS) for data access control and an immutable `stars_ledger` for audit trails.
- **Member Management**: In cloud mode, all family members (including kids/participants) must have their own Supabase accounts. Guardians use email, kids use passcode.
- **Data Flow**: `setMembersFromCloud()` replaces members entirely from Supabase without merging. Session data is managed by Supabase auth with SecureStore for token persistence.

### Profile Name Editing
- Users can edit their display name from the Setup screen by tapping the pencil icon next to their entry.
- Name changes are persisted to both Supabase (profiles table) and local store.
- The edit button appears for guardians next to their own entry, identified by "(You)" suffix.

### Role-Based Access Control
- **Participant Restrictions**:
  - Tasks page: Hidden New Task/Templates buttons, non-interactive checkboxes, hidden action buttons
  - Spin page: Guardian-only feature with "Guardians Only" message for participants
  - Setup page: Read-only view (no family management actions)
- **Owner-Only Features**:
  - Participant passcodes visible next to participant age in Setup screen
  - Remove participant button (X icon) to remove kids from family
  - Participant removal nullifies their family_id in Supabase

### Notification Badge
- Guardians see a badge on the hamburger menu icon when there are pending join requests.
- Badge count is centralized in AuthContext (`pendingRequestsCount` state) and shared across components.
- Count refreshes on: tab focus, family/profile changes, Setup screen polling (30s), and after approve/reject actions.
- The Setup screen shows join request cards with role-based fallback ("New Guardian"/"New Participant") when display_name is empty.

### Centralized Navigation System
- All navigation is handled by a single `NavigationController` in `app/_layout.tsx`
- Navigation logic is centralized in `lib/navigation.ts` with pure functions:
  - `derivePersona(state)`: Determines user type (guardian, participant_code, participant_email)
  - `resolveRoute(state)`: Returns target route based on auth state and persona
  - `shouldNavigate(from, to)`: Determines if navigation is needed
- **Persona types**:
  - `guardian`: Any user with role='guardian' (includes family owners)
  - `participant_code`: Kid who logs in with 4-digit passcode
  - `participant_email`: Kid who logs in with email/password
- **Routing priority** (first match wins):
  1. Not ready → show loading
  2. No session → sign-in
  3. Has family → today (main app)
  4. Pending join request → pending-approval
  5. Participant without family → pending-approval (participants can never create families)
  6. Guardian without family → family-setup
- **Auth readiness**: `authReady` flag is persisted in Zustand store to survive component remounts
  - Store's `setAuthReady(true)` is called when auth initialization completes
  - Store's `setAuthReady(false)` is called when SIGNED_IN event fires (new login cycle)
  - AuthContext initializes `loading` state from store's `authReady` to prevent flash on remount
  - Uses `familyCheckComplete` state to prevent race condition where navigation runs before family data loads
  - Prevents the issue where user is redirected to sign-in after successful login
  - Web platform uses `window.confirm` instead of `Alert.alert` for sign-out confirmation
- **Unit tests**: 104 tests across 6 test files covering auth + navigation:
  - `navigation.test.ts` (23 tests) - Core navigation logic and persona derivation
  - `authProvider.test.ts` (22 tests) - AuthProvider lifecycle with mocked Supabase
  - `authState.test.ts` (20 tests) - Auth state transitions via resolveRoute
  - `authNavigation.test.ts` (13 tests) - Complete user journeys
  - `authEdgeCases.test.ts` (23 tests) - Edge cases and boundary conditions
  - `authIntegration.test.ts` (3 tests) - Complete app lifecycle (sign-in/sign-out cycles)

### Push Notifications
- **Implementation**: Uses expo-notifications, expo-device, expo-constants packages
- **Token Registration**: `usePushNotifications` hook in `hooks/usePushNotifications.ts` handles permission requests and token registration
- **Token Storage**: Push tokens stored in `profiles.push_token` column in Supabase (requires adding column to existing table)
- **Context Provider**: `PushNotificationProvider` in `lib/pushNotificationContext.tsx` wraps the app and syncs tokens to Supabase
- **Notification Service**: `lib/pushNotificationService.ts` provides functions to send notifications:
  - `notifyTaskAssigned()` - When a task is assigned to a family member
  - `notifyTaskPendingApproval()` - When someone completes a task needing approval
  - `notifyTaskApproved()` - When a task is approved (star award)
  - `notifyTaskRejected()` - When a task completion is rejected
  - `notifyJoinRequest()` - When someone requests to join the family
  - `notifyRewardClaimed()` - When a reward is claimed
- **API**: Uses Expo Push API (https://exp.host/--/api/v2/push/send)
- **Note**: Push notifications only work on physical devices, not simulators. Requires EAS build.

### Pull-to-Refresh
- **Pages with refresh**: Today, Leaderboard, Rewards, Setup
- **Implementation**: Uses React Native's RefreshControl component with ScrollView
- **Refresh Action**: Calls `refreshProfile()` from AuthContext which reloads profile, family, members, tasks, and instances from Supabase
- **Visual Feedback**: Standard iOS/Android pull-down spinner with app's primary color

### One-Off Task Creation
- **Feature**: When searching for tasks during assignment, if no matches are found, guardians can create a one-off task
- **Implementation**: Creates a hidden template (enabled: false) in Supabase that doesn't appear in the template picker
- **Error Handling**: If all assignments fail, the orphan template is archived in cloud; only added to local store on success

## External Dependencies

- expo (expo, expo-router, expo-constants, expo-linking, expo-status-bar)
- react-native (react-native, react-native-web, react-native-screens, react-native-safe-area-context, react-native-gesture-handler, react-native-reanimated)
- @expo/vector-icons
- @react-native-async-storage/async-storage
- zustand
- date-fns
- typescript
- @supabase/supabase-js
- expo-secure-store
- expo-notifications (push notifications)
- expo-device (device detection for push notifications)
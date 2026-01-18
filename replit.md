# Sukun

## Overview

Sukun is a React Native mobile app designed to gamify household responsibilities for children aged 5-12, fostering family-oriented task management with a focus on Islamic values. The app aims to simplify family tasks through a points-based system, featuring onboarding for family setup, assigning unique "powers" to kids, and a starter pack of over 40 kid-appropriate activities. It supports multi-user collaboration via optional cloud synchronization with Supabase.

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
- **Cloud-Only Mode**: When Supabase is configured, members are loaded directly from the cloud (no local storage merging). This prevents data duplication and ensures cloud is the single source of truth.
- **Auth Flow**: Two authentication methods available:
  1. **Email/password** (for guardians): Standard sign-up with email confirmation
  2. **Passcode** (for participants/kids): Simplified 4-digit code login
- **Participant Passcode System**:
  - Kids join using family invite code + their name (no email required)
  - System generates a unique 4-digit passcode for login
  - Passcode stored in `profiles.passcode` column (unique)
  - Auto-generated email format: `participant{passcode}@sukun.app`
  - Sign-in screen has "Login with Code" option for kids
- **Offline Mode**: Operates locally using AsyncStorage only if Supabase is not configured.
- **Security**: Utilizes Row Level Security (RLS) for data access control and an immutable `stars_ledger` for audit trails.
- **Member Management**: In cloud mode, all family members (including kids/participants) must have their own Supabase accounts. Guardians use email, kids use passcode.
- **Data Flow**: `setMembersFromCloud()` replaces members entirely from Supabase without merging. Session data is managed by Supabase auth with SecureStore for token persistence.

### Profile Name Editing
- Users can edit their display name from the Setup screen by tapping the pencil icon next to their entry.
- Name changes are persisted to both Supabase (profiles table) and local store.
- The edit button appears for guardians next to their own entry, identified by "(You)" suffix.

### Notification Badge
- Guardians see a badge on the hamburger menu icon when there are pending join requests.
- Badge count is centralized in AuthContext (`pendingRequestsCount` state) and shared across components.
- Count refreshes on: tab focus, family/profile changes, Setup screen polling (30s), and after approve/reject actions.
- The Setup screen shows join request cards with role-based fallback ("New Guardian"/"New Participant") when display_name is empty.

### Auth Gate
- Unauthenticated users are always redirected to the sign-in page when Supabase is configured.
- The `app/index.tsx` waits for both store (`isReady`) and auth (`loading`) before routing decisions.
- Routing logic: no session → sign-in, pending request → pending-approval, no family → family-setup, authenticated → today.
- When Supabase is configured, auth state is checked FIRST - local onboarding flag is ignored for authenticated users with a family.
- Local onboarding flag is only used in offline/local mode when Supabase is not configured.
- Note: Keep routing rules in `index.tsx` and `useProtectedRoute` in `_layout.tsx` synchronized to avoid regressions.

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
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
- **Cloud-Only Mode**: Supabase is required. Members are loaded directly from the cloud (no local storage merging). This prevents data duplication and ensures cloud is the single source of truth.
- **Auth Flow**: Two authentication methods available:
  1. **Email/password** (for guardians): Standard sign-up with email confirmation
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
- **Auth readiness**: `authReady` flag is true only when session + profile + family check all completed
  - Uses `familyCheckComplete` state to prevent race condition where navigation runs before family data loads
  - Prevents the issue where user is redirected to sign-in after successful login
- **Unit tests**: 101 tests across 6 test files covering auth + navigation:
  - `navigation.test.ts` (23 tests) - Core navigation logic and persona derivation
  - `authProvider.test.ts` (19 tests) - AuthProvider lifecycle with mocked Supabase
  - `authState.test.ts` (20 tests) - Auth state transitions via resolveRoute
  - `authNavigation.test.ts` (13 tests) - Complete user journeys
  - `authEdgeCases.test.ts` (23 tests) - Edge cases and boundary conditions
  - `authIntegration.test.ts` (3 tests) - Complete app lifecycle (sign-in/sign-out cycles)

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
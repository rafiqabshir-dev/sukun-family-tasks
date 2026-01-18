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
- **Approval Workflows**: Tasks require approval from a different family member before stars are awarded. Family joining also involves an approval process by the family owner.
- **Multi-User & Roles**: Differentiates between "kids" and "guardians" with specific permissions. Guardians can manage members and tasks, while kids can complete assigned tasks. An "Act As" selector allows switching between family members.
- **User Management**: Family owners (first guardian) control member invitations and approvals. User profiles can be edited, and a user switcher facilitates interaction.
- **Data Model**: Core entities include `Member` (id, name, role, age, starsTotal, powers, profileId), `TaskTemplate` (id, title, category, defaultStars, scheduleType), `TaskInstance` (assigned to member, dueAt, status), and `Settings`.
- **UI/UX**: Features a tab-based navigation (Today, Spin, Leaderboard, Setup), an onboarding flow, and consistent typography. Islamic values are reflected in a gentle tone and default sound settings.

### Cloud Integration (Supabase)
- **Optional Sync**: Supports multi-user, multi-device collaboration via Supabase.
- **Auth Flow**: Standard email/password sign-up, with options to create or join a family using invite codes.
- **Offline Mode**: Operates locally using AsyncStorage if Supabase is not configured.
- **Security**: Utilizes Row Level Security (RLS) for data access control and an immutable `stars_ledger` for audit trails.
- **ID Matching**: Local store uses `member-*` IDs while Supabase uses UUIDs. Members now have an optional `profileId` field that stores the Supabase UUID for reliable matching. The `findCurrentUserMember()` helper in Setup uses a priority chain: profileId → id → name+role → actingMemberId (offline mode).

### Profile Name Editing
- Users can edit their display name from the Setup screen by tapping the pencil icon next to their entry.
- Name changes are persisted to both Supabase (profiles table) and local store.
- The edit button appears for guardians next to their own entry, identified by "(You)" suffix.

### Notification Badge
- Guardians see a badge on the hamburger menu icon when there are pending join requests.
- Badge count is centralized in AuthContext (`pendingRequestsCount` state) and shared across components.
- Count refreshes on: tab focus, family/profile changes, Setup screen polling (30s), and after approve/reject actions.
- The Setup screen shows join request cards with role-based fallback ("New Guardian"/"New Participant") when display_name is empty.

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
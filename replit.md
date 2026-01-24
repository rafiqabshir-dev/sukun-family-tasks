# Sukun

## Overview
Sukun is a React Native mobile application designed to gamify household responsibilities for children aged 5-12, fostering family-oriented task management with a focus on Islamic values. The app simplifies family tasks through a points-based system, assigns unique "powers" to kids, and includes a starter pack of over 40 kid-appropriate activities. It leverages Supabase as its cloud backend, ensuring multi-user collaboration and cloud-first data synchronization for all features. The project aims to provide a unique, value-driven solution for family task management.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Mobile App Architecture
- **Framework**: React Native with Expo SDK 54, utilizing Expo Router for file-based navigation.
- **State Management**: Zustand with AsyncStorage for local persistence.
- **Styling**: Native React Native StyleSheet.
- **Icons**: @expo/vector-icons (Ionicons).
- **Branding**: App name "Sukun", tagline "Family Tasks Made Simple", and a specific logo (`assets/sukun-logo.png`).
- **UI/UX**: Tab-based navigation (Today, Spin, Leaderboard, Setup), onboarding flow, consistent typography, and a gentle tone reflecting Islamic values. No emojis are used; UI exclusively uses Ionicons or @expo/vector-icons.

### Core Features
- **Gamification**: "Powers" system for kids (e.g., Organizer, Fast Cleaner), a "Spin" game for task assignment, and a "Leaderboard" to track stars.
- **Task Management**: Supports "One-Time", "Recurring Daily", and "Time-Sensitive" tasks with expiration and regeneration. Guardians assign tasks, kids complete them for stars. Guardians can also create one-off tasks dynamically.
- **Rewards System**: Guardians set star-cost rewards for kids to claim, with star deductions for misbehavior.
- **Approval Workflows**: Tasks completed by participants require guardian approval. Multi-guardian families require cross-approval. Family joining also involves an approval process.
- **Multi-User & Roles**: Differentiates between "kids" (participants) and "guardians" with specific permissions. Guardians manage members and tasks; kids complete assigned tasks. Role-based access controls restrict features for participants (e.g., read-only views, no task assignment).
- **User Management**: Family owners control member invitations and approvals. User profiles are editable.
- **Data Model**: Key entities include `Member`, `TaskTemplate`, `TaskInstance`, and `Settings`.

### Cloud Integration (Supabase)
- **Cloud-Only Mode**: Supabase is the single source of truth for all data; no offline mode or local storage merging. All task operations, member management, and star persistence are cloud-first.
- **Authentication**: Supports email/password for guardians and a simplified 4-digit passcode system for kids. Kids' passcodes are auto-generated with a unique email format `participant{passcode}@sukun.app`.
- **Security**: Utilizes Row Level Security (RLS) for data access and an immutable `stars_ledger` for audit trails.
- **Data Flow**: `setMembersFromCloud()` replaces local data entirely from Supabase. Supabase Auth manages sessions with SecureStore for token persistence.
- **Member ID Matching**: Task assignments use cloud profile IDs (UUIDs). Only members with valid cloud profiles can be assigned tasks. Local-only members (legacy `member-*` IDs) are filtered out from task assignment.
- **Member Onboarding**: New family members must join via invite code flow (`signUpParticipant`), which creates a Supabase profile. The legacy local "Add Member" function is deprecated in cloud mode.

### Centralized Navigation System
- All navigation is handled by `NavigationController` in `app/_layout.tsx` using `lib/navigation.ts` for logic.
- **Persona-based Routing**: `derivePersona()` determines user type (guardian, participant_code, participant_email) to `resolveRoute()` for appropriate navigation.
- **Auth Readiness**: `authReady` flag in Zustand store and `familyCheckComplete` state prevent race conditions and ensure correct routing after authentication.

### Push Notifications
- **Implementation**: Uses `expo-notifications`, `expo-device`, `expo-constants`.
- **Token Registration**: `usePushNotifications` hook handles permissions and token registration.
- **Token Storage**: Push tokens are stored in `profiles.push_token` in Supabase.
- **Notification Events**: Service functions (`lib/pushNotificationService.ts`) send notifications for task assignments, approvals, rejections, join requests, and reward claims.

### Pull-to-Refresh
- Implemented on key pages (Today, Leaderboard, Rewards, Setup) using `RefreshControl` to reload data from Supabase via `refreshProfile()` from AuthContext.

### Sound System
- Uses `expo-av` with `lib/soundService.ts` for audio playback (spin, winner, click, success sounds). Sound toggle is available in Setup, persisted locally.

### Family Wheel
- Located in `app/(tabs)/spin.tsx`, offers two guardian-only modes: "Assign a Task" and "Family Game".
- **Family Game**: Turn-based star-collection game with selectable target scores, real-time scoreboard, and winner celebrations.

### Family Day Dashboard (Today Page)
- Located in `app/(tabs)/today.tsx`, provides a personalized greeting.
- **Location Service** (`lib/locationService.ts`): Uses expo-location for device GPS, requests foreground permissions on first use, 1-hour caching, reverse geocoding to display city name. Falls back to San Francisco if permission denied.
- **Weather Service**: Uses Open-Meteo API for 30-minute cached weather, severe weather detection, outdoor play safety, and "what to wear" suggestions. Uses user's actual GPS location.
- **Prayer Service**: Uses AlAdhan API for 6-hour cached prayer times, countdowns, and urgency indicators. Uses user's actual GPS location.
- **Dashboard Cards**: Displays location badge with city name, `SevereWeatherBanner`, `PrayerCountdownCard`, `WeatherCard`, `WhatToWearCard`, and `TodayTasksSummary`.
- **Deep-link Navigation**: Tasks summary links to the Tasks page with pre-applied filters.

### Enhanced Tasks Page
- Offers "Browse Templates" and "Assigned Tasks" view modes.
- **Browse Templates**: Categorized templates with assignee chips. Full template management for guardians.
- **Assigned Tasks**: Tasks grouped by family member, with due/overdue indicators and inline actions. Supports deep-linking with `view` and `filter` parameters.

## External Dependencies
- `expo` (core, router, constants, linking, status-bar)
- `react-native` (core, web, screens, safe-area-context, gesture-handler, reanimated)
- `@expo/vector-icons`
- `@react-native-async-storage/async-storage`
- `zustand`
- `date-fns`
- `typescript`
- `@supabase/supabase-js`
- `expo-secure-store`
- `expo-notifications`
- `expo-device`
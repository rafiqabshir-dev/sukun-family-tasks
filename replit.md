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

### Games Hub
- Located in `app/(tabs)/spin.tsx`, serves as a central hub for all family games.
- **Architecture**: Uses `lib/gamesRegistry.ts` for game definitions - add new games by adding entries to the `GAMES` array.
- **Categories**: Games are organized by category (Spin Games, Party Games, etc.) with pill tabs for switching.
- **GameCard Component**: Reusable card component in `components/GameCard.tsx` for displaying game options.
- **Role-Based Access**: Guardian-only games (spin games) show as disabled for non-guardian users with informative messaging.
- **Current Games**:
  - **Assign a Task** (Spin): Spin the wheel to pick a family member for task assignment. Guardian-only.
  - **Family Game** (Spin): Turn-based star-collection game with selectable players, target scores, scoreboard, and winner celebrations. Guardian-only.
  - **Charades Mini** (Party): Coming soon placeholder in `app/games/charades-mini.tsx`.

### Family Day Dashboard (Today Page)
- Located in `app/(tabs)/today.tsx`, provides a personalized greeting with task-first UX design.
- **Task-First Layout**: TodayTasksSummary appears at the top as the primary focus, showing up to 5 actionable tasks with one-tap "Done" and "Approve" buttons.
- **Quick Actions**: handleQuickComplete for marking tasks done, handleQuickApprove for guardian approvals - both trigger push notifications and cloud sync.
- **Compact Widgets**: CompactPrayerWidget and CompactWeatherWidget display side-by-side below tasks, replacing large full-width cards.
- **Location Service** (`lib/locationService.ts`): Uses expo-location for device GPS, requests foreground permissions on first use, 1-hour caching, reverse geocoding to display city name. Falls back to San Francisco if permission denied.
- **Weather Service**: Uses Open-Meteo API for 30-minute cached weather, severe weather detection, outdoor play safety, and "what to wear" suggestions. Uses user's actual GPS location.
- **Prayer Service**: Uses AlAdhan API for 6-hour cached prayer times, countdowns, and urgency indicators. Uses user's actual GPS location.
- **Dashboard Cards** (`components/DashboardCards.tsx`): Renders TodayTasksSummary first, then compact prayer/weather row, then SevereWeatherBanner, location badge, and WhatToWearCard.
- **Deep-link Navigation**: Tasks summary links to the Tasks page with pre-applied filters.

### Enhanced Tasks Page
- Offers "Browse Templates" and "Assigned Tasks" view modes.
- **Browse Templates**: Categorized templates with assignee chips. Full template management for guardians.
- **Quick-Assign Chips**: Guardians see avatar chips below each enabled template for one-tap task assignment to cloud-synced kids.
- **Assigned Tasks**: Tasks grouped by family member, with due/overdue indicators and inline actions. Supports deep-linking with `view` and `filter` parameters.

### Analytics & Error Tracking (Beta Prep)
- **Sentry**: Error and crash tracking via `@sentry/react-native`. Auto-captures JS exceptions, breadcrumbs, and user context.
- **PostHog**: Product analytics via `posthog-react-native`. Tracks screen views, custom events, and user behavior.
- **ErrorBoundary**: React component wrapping the app to catch and report unhandled JS errors gracefully.
- **Screen Tracking**: Automatic tracking via `usePathname` in Expo Router.
- **Event Tracking**: Key user actions tracked: `task_assigned`, `task_completed`, etc.
- **Configuration**: Set `EXPO_PUBLIC_SENTRY_DSN` and `EXPO_PUBLIC_POSTHOG_API_KEY` environment variables to enable.

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
- `@sentry/react-native`
- `posthog-react-native`
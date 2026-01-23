# Sukun - Technical Architecture Documentation

## Overview

Sukun is a React Native mobile application that gamifies household responsibilities for children aged 5-12, fostering family-oriented task management with a focus on Islamic values. This document provides a comprehensive technical overview for developers.

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [Authentication System](#authentication-system)
4. [Data Architecture](#data-architecture)
5. [State Management](#state-management)
6. [Cloud Integration](#cloud-integration)
7. [Navigation System](#navigation-system)
8. [Key Features](#key-features)
9. [External Services](#external-services)
10. [Development Guidelines](#development-guidelines)

---

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | React Native with Expo SDK 54 |
| Navigation | Expo Router (file-based) |
| State Management | Zustand with AsyncStorage |
| Backend | Supabase (PostgreSQL + Auth) |
| Styling | React Native StyleSheet |
| Icons | @expo/vector-icons (Ionicons) |
| Date Handling | date-fns |
| Push Notifications | expo-notifications |
| Audio | expo-av |
| Location | expo-location |

---

## Project Structure

```
sukun/
├── app/                          # Expo Router pages
│   ├── (tabs)/                   # Tab-based navigation
│   │   ├── today.tsx             # Family Day Dashboard
│   │   ├── spin.tsx              # Family Wheel game
│   │   ├── leaderboard.tsx       # Stars leaderboard
│   │   ├── tasks.tsx             # Task management
│   │   └── setup.tsx             # Settings & profile
│   ├── onboarding/               # Onboarding flow
│   ├── auth/                     # Authentication screens
│   └── _layout.tsx               # Root layout with NavigationController
├── components/                   # Reusable UI components
│   ├── DashboardCards.tsx        # Today page cards
│   └── ...
├── lib/                          # Core business logic
│   ├── store.ts                  # Zustand state store
│   ├── types.ts                  # TypeScript type definitions
│   ├── cloudSync.ts              # Supabase sync operations
│   ├── supabase.ts               # Supabase client configuration
│   ├── navigation.ts             # Navigation logic
│   ├── weatherService.ts         # Open-Meteo API integration
│   ├── prayerService.ts          # AlAdhan API integration
│   ├── locationService.ts        # Device GPS & geocoding
│   ├── parkService.ts            # OpenStreetMap parks discovery
│   ├── pushNotificationService.ts # Push notification handling
│   └── soundService.ts           # Audio playback
├── contexts/                     # React contexts
│   └── AuthContext.tsx           # Supabase auth context
├── assets/                       # Static assets
│   ├── sukun-logo.png            # App logo
│   └── sounds/                   # Audio files
└── supabase/                     # Database schema
    └── schema.sql                # SQL schema definitions
```

---

## Authentication System

### Overview

Sukun implements a dual-authentication system:

1. **Guardians**: Full email/password authentication via Supabase Auth
2. **Participants (Kids)**: Simplified 4-digit passcode system

### Guardian Authentication Flow

```
1. Guardian signs up with email/password
2. Supabase creates auth user
3. Profile created in 'profiles' table
4. Guardian creates/joins a family
5. Member record created linking profile to family
```

### Participant Authentication Flow

```
1. Guardian creates participant with name + avatar
2. System auto-generates 4-digit passcode
3. Creates Supabase auth with email: participant{passcode}@sukun.app
4. Participant logs in with family code + personal passcode
5. Passcode verification happens client-side after family lookup
```

### Persona Types

The app determines user type via `derivePersona()` in `lib/navigation.ts`:

- `guardian`: Full email auth, role='guardian' in members table
- `participant_code`: Passcode auth (email matches pattern `participant*@sukun.app`)
- `participant_email`: Email auth but role='participant' (future feature)

### Token Storage

- **Web**: localStorage
- **Mobile**: expo-secure-store (encrypted)

---

## Data Architecture

### Core Entities

#### Profile
```typescript
interface Profile {
  id: string;           // Supabase auth user ID
  email: string;        // User email
  family_id?: string;   // Associated family (null if not joined)
  push_token?: string;  // Expo push notification token
}
```

#### Family
```typescript
interface Family {
  id: string;           // UUID
  name: string;         // Family display name
  joinCode: string;     // 6-character join code
  ownerId: string;      // Profile ID of family owner
}
```

#### Member
```typescript
interface Member {
  id: string;           // UUID
  name: string;         // Display name
  avatar: string;       // Emoji avatar (user content exception)
  role: 'guardian' | 'participant';
  profileId?: string;   // Link to profiles table (null for pending)
  familyId: string;     // Link to families table
  stars: number;        // Computed from stars_ledger
  powers: string[];     // Special abilities (e.g., "Organizer")
}
```

#### TaskTemplate
```typescript
interface TaskTemplate {
  id: string;
  title: string;
  category: TaskCategory;  // 'cleaning' | 'organizing' | 'helping' | 'learning' | 'self_care' | 'custom'
  defaultStars: number;    // Stars awarded on completion
  frequency: 'one_time' | 'daily';
  isEnabled: boolean;
  isArchived: boolean;
  familyId: string;
}
```

#### TaskInstance
```typescript
interface TaskInstance {
  id: string;
  templateId: string;
  assignedToMemberId: string;
  assignedBy: string;
  status: 'open' | 'pending_approval' | 'approved' | 'rejected' | 'expired';
  dueDate?: string;
  completedAt?: string;
  completionRequestedBy?: string;
  completionRequestedAt?: string;
  createdAt: string;
}
```

### Database Constraints

**CRITICAL**: The `task_instances.status` column has a CHECK constraint:
```sql
status IN ('open', 'pending_approval', 'approved', 'rejected', 'expired')
```

The UI may display "done" for user-friendliness, but the database always stores "approved".

### Stars Ledger

An immutable audit trail for star transactions:

```typescript
interface StarsLedgerEntry {
  id: string;
  familyId: string;
  profileId: string;      // Who received/lost stars
  delta: number;          // Positive for awards, negative for deductions
  reason: string;         // "Task completion", "Misbehavior", etc.
  createdById: string;    // Who created this entry
  taskInstanceId?: string; // Optional link to task (unique constraint)
  createdAt: string;
}
```

**Unique Constraint**: `idx_unique_stars_per_task` prevents duplicate star awards for the same task.

---

## State Management

### Zustand Store (`lib/store.ts`)

The app uses Zustand with AsyncStorage persistence for local state:

```typescript
// Key store sections:
- family: Family | null
- members: Member[]
- taskTemplates: TaskTemplate[]
- taskInstances: TaskInstance[]
- settings: { soundEnabled: boolean }
- authReady: boolean  // Prevents navigation race conditions

// Key actions:
- setMembersFromCloud(members)  // Replaces local with cloud data
- completeTask(id, requestedBy) // Marks task for approval
- approveTask(id)               // Approves and awards stars
- rejectTask(id)                // Rejects back to open
- addStars(memberId, amount)    // Updates member star count
```

### Cloud-First Philosophy

Supabase is the single source of truth:

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   UI Action │ --> │ Local Store  │ --> │  Supabase   │
│             │     │ (Optimistic) │     │   (Truth)   │
└─────────────┘     └──────────────┘     └─────────────┘
                           │
                           v
                    ┌──────────────┐
                    │ Pull-to-     │
                    │ Refresh Sync │
                    └──────────────┘
```

1. UI actions update local store immediately (optimistic)
2. Cloud sync happens asynchronously
3. Pull-to-refresh fetches fresh data from Supabase
4. `setMembersFromCloud()` replaces local data entirely

---

## Cloud Integration

### Supabase Configuration (`lib/supabase.ts`)

The app checks for Supabase credentials via `isSupabaseConfigured()`:

```typescript
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.SUPABASE_URL;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.SUPABASE_ANON_KEY;
```

### Cloud Sync Operations (`lib/cloudSync.ts`)

Key functions:

| Function | Purpose |
|----------|---------|
| `updateCloudTaskInstance()` | Updates task status in Supabase (maps camelCase to snake_case) |
| `addStarsLedgerEntry()` | Creates immutable star transaction |
| `cloudInstanceToLocal()` | Maps Supabase row to local TaskInstance type |
| `fetchFamilyData()` | Pulls all family data on login/refresh |

### Field Mapping

The `updateCloudTaskInstance` function maps camelCase to snake_case:

```typescript
// Accepts camelCase:
{ completedAt, completionRequestedBy, completionRequestedAt }

// Converts to snake_case for Supabase:
{ completed_at, completion_requested_by, completion_requested_at }
```

---

## Navigation System

### Centralized Navigation (`app/_layout.tsx` + `lib/navigation.ts`)

All navigation decisions flow through a central controller:

```typescript
// 1. Derive persona from auth state
const persona = derivePersona(profile, session);

// 2. Resolve route based on persona and family status
const route = resolveRoute(persona, profile, familyCheckComplete);

// 3. Navigate to resolved route
router.replace(route);
```

### Route Resolution

```typescript
function resolveRoute(persona, profile, familyCheckComplete) {
  if (!familyCheckComplete) return '/loading';
  
  if (!profile?.family_id) {
    return persona === 'guardian' ? '/onboarding' : '/auth/participant-join';
  }
  
  return '/(tabs)/today';
}
```

### Auth Ready Flag

The `authReady` flag in Zustand prevents race conditions:

```typescript
// Don't navigate until auth is fully initialized
if (!authReady) return <LoadingScreen />;
```

---

## Key Features

### 1. Task Management

**Template vs Instance Pattern**:
- Templates define reusable task definitions
- Instances are created when tasks are assigned
- Daily tasks auto-regenerate at midnight

**Status Flow**:
```
open → (complete) → pending_approval → (approve) → approved
                                    → (reject)  → rejected
     → (expire)  → expired
```

**Auto-Approval Logic**:
Single-guardian families skip the approval step:
```typescript
const isSingleGuardian = guardians.length === 1 && currentMember?.role === 'guardian';
if (isSingleGuardian) {
  // Complete + approve + award stars in one step
}
```

### 2. Family Wheel (Spin Game)

Located in `app/(tabs)/spin.tsx`:

- **Assign a Task Mode**: Randomly selects member + task
- **Family Game Mode**: Turn-based star collection game

Uses animated spinning wheel with sound effects.

### 3. Today Dashboard

Located in `app/(tabs)/today.tsx`:

Cards displayed:
- Location badge (city from GPS)
- Severe weather banner (if applicable)
- Prayer countdown card
- Weather card
- "What to wear" suggestions
- Nearby parks card
- Today's tasks summary

### 4. Push Notifications

Implemented via `expo-notifications`:

```typescript
// Notification events:
- Task assigned to participant
- Task pending approval (to guardians)
- Task approved (to assignee)
- Task rejected (to assignee)
- Reward claimed
- Family join request
```

---

## External Services

### Weather (Open-Meteo API)

```typescript
// lib/weatherService.ts
const API_URL = 'https://api.open-meteo.com/v1/forecast';
// Free, no API key required
// 30-minute cache
```

### Prayer Times (AlAdhan API)

```typescript
// lib/prayerService.ts
const API_URL = 'https://api.aladhan.com/v1/timings';
// Free, no API key required
// 6-hour cache
```

### Parks Discovery (OpenStreetMap Overpass)

```typescript
// lib/parkService.ts
const OVERPASS_SERVERS = [
  'https://overpass-api.de/api/interpreter',      // Primary
  'https://overpass.kumi.systems/api/interpreter', // Fallback 1
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter' // Fallback 2
];
// Free, no API key required
// Uses retry logic across servers
```

### Location (expo-location)

```typescript
// lib/locationService.ts
// Requests foreground permissions
// 1-hour cache
// Falls back to San Francisco if denied
```

---

## Development Guidelines

### 1. No Emojis in UI

**CRITICAL**: All UI must use Ionicons, never emojis.

```typescript
// WRONG:
<Text>✓ Done</Text>

// CORRECT:
<Ionicons name="checkmark" size={16} color={colors.success} />
```

**Exception**: Member avatars can use emojis as user content.

### 2. Status Values

Always use database-valid status values:

```typescript
// CORRECT:
status: 'approved'

// WRONG (will fail database constraint):
status: 'done'
```

The UI can compute and display "done" but never persist it.

### 3. Cloud Sync Field Names

Use camelCase in code, let cloudSync handle conversion:

```typescript
// CORRECT:
await updateCloudTaskInstance(id, {
  completedAt: new Date().toISOString(),
  completionRequestedBy: memberId
});

// WRONG (will fail):
await updateCloudTaskInstance(id, {
  completed_at: new Date().toISOString()
});
```

### 4. Notification Parameters

All notification functions require familyId as first parameter:

```typescript
// CORRECT:
notifyTaskApproved(familyId, profileId, taskTitle, stars);

// WRONG:
notifyTaskApproved(profileId, taskTitle, stars);
```

### 5. Pull-to-Refresh

All data-heavy screens implement pull-to-refresh:

```typescript
<ScrollView
  refreshControl={
    <RefreshControl
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await refreshProfile?.();
        setRefreshing(false);
      }}
    />
  }
>
```

### 6. Error Handling

Handle known errors gracefully:

```typescript
// Duplicate star entries are expected in some race conditions
if (error.message.includes('duplicate key')) {
  console.log('Stars already awarded, continuing');
} else {
  console.error('Unexpected error:', error);
}
```

---

## Environment Variables

Required for Supabase:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SESSION_SECRET` - For session management

Optional:
- `YELP_API_KEY` - For enhanced store ratings (future feature)

---

## Testing

The app runs on:
- Expo Go (development)
- iOS Simulator
- Android Emulator
- Web browser (localhost:5000)

Bundle identifier for iOS: `com.sukun.familytasks`

---

## Common Issues & Solutions

### 1. "duplicate key violates unique constraint"
**Cause**: Trying to award stars for a task that already has a star entry.
**Solution**: Check task status before approving; handle duplicate errors gracefully.

### 2. Task status update fails
**Cause**: Using invalid status value like 'done'.
**Solution**: Use only: 'open', 'pending_approval', 'approved', 'rejected', 'expired'.

### 3. Navigation flickers
**Cause**: Auth not fully initialized before navigation.
**Solution**: Wait for `authReady` flag before rendering navigation.

### 4. Parks not loading
**Cause**: Overpass API server down.
**Solution**: App automatically retries across 3 fallback servers.

---

## Contributing

1. Follow the existing code style
2. Use Ionicons for all icons
3. Test on both iOS and Android
4. Ensure cloud sync works correctly
5. Add console logging for debugging
6. Update this documentation for significant changes

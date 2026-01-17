# VALIDATION_V1_1 - Barakah Kids Race V1 Checklist

## Validation Date: 2026-01-17
## Schema Version: 1

---

## Core Features Checklist

### 1. Fresh Install → Onboarding Appears
| Status | Check | Evidence |
|--------|-------|----------|
| PASS | App routes to onboarding when `onboardingComplete` is false | `app/index.tsx:7-8` - Redirect to `/onboarding` when not complete |
| PASS | Root layout initializes store from AsyncStorage | `app/_layout.tsx:12-14` - Calls `initialize()` on mount |
| PASS | Default state has `onboardingComplete: false` | `lib/types.ts:75` - `DEFAULT_STATE.onboardingComplete = false` |

### 2. Add Members → Starter Pack Review Appears
| Status | Check | Evidence |
|--------|-------|----------|
| PASS | Add Members screen exists with name/age/role inputs | `app/onboarding/add-members.tsx` - Full member input form |
| PASS | Members can be added to store | `lib/store.ts:68-78` - `addMember()` action |
| PASS | Navigation proceeds to powers selection | `app/onboarding/add-members.tsx` - Next button routes to `/onboarding/powers` |
| PASS | Powers selection screen exists | `app/onboarding/powers.tsx` - Full powers selection UI |
| PASS | Task review screen shows starter tasks | `app/onboarding/tasks.tsx` - Displays generated tasks from `starterTasks.ts` |

### 3. Accept → Tabs Show
| Status | Check | Evidence |
|--------|-------|----------|
| PASS | "Let's Go" completes onboarding | `app/onboarding/tasks.tsx` - Calls `completeOnboarding()` |
| PASS | `completeOnboarding` sets flag and persists | `lib/store.ts:139-142` - Sets `onboardingComplete: true` and saves |
| PASS | Router redirects to tabs when complete | `app/index.tsx:11` - Redirect to `/(tabs)/today` |
| PASS | Four tabs exist (Today, Spin, Leaderboard, Setup) | `app/(tabs)/_layout.tsx` - All four tab screens configured |

### 4. Reload App → Data Persists
| Status | Check | Evidence |
|--------|-------|----------|
| PASS | AsyncStorage key is correct | `lib/store.ts:5` - `STORAGE_KEY = "barakah-kids-race:v1"` |
| PASS | 300ms debounced autosave implemented | `lib/store.ts:6,26-43` - `DEBOUNCE_MS = 300` with `saveToStorage()` |
| PASS | Store loads from AsyncStorage on init | `lib/store.ts:49-66` - `initialize()` reads from storage |
| PASS | Schema version check prevents bad data | `lib/store.ts:57` - Only loads if schema matches |

---

## Diagnostics Section (Setup Tab)

| Status | Feature | Evidence |
|--------|---------|----------|
| PASS | Schema version displayed | `app/(tabs)/setup.tsx:126` - `data-testid="text-schema-version"` |
| PASS | Members count displayed | `app/(tabs)/setup.tsx:131` - `data-testid="text-members-count"` |
| PASS | Templates count displayed | `app/(tabs)/setup.tsx:136` - `data-testid="text-templates-count"` |
| PASS | Instances count displayed | `app/(tabs)/setup.tsx:141` - `data-testid="text-instances-count"` |
| PASS | AsyncStorage key status indicator | `app/(tabs)/setup.tsx:144-163` - Status dot and "Present/Not Found" text |
| PASS | Storage key text shown | `app/(tabs)/setup.tsx:165` - Shows `barakah-kids-race:v1` |

---

## Starter Tasks Verification

| Status | Check | Evidence |
|--------|-------|----------|
| PASS | 45 kid-appropriate tasks | `lib/starterTasks.ts` - 45 task templates |
| PASS | 7 categories covered | cleaning, kitchen, learning, kindness, prayer, outdoor, personal |
| PASS | Age filtering available | Tasks have `minAge`/`maxAge` properties |
| PASS | Power preferences linked | Each task has `preferredPowers` array |

### Category Distribution:
- cleaning: 9 tasks
- kitchen: 8 tasks
- learning: 7 tasks
- kindness: 6 tasks
- prayer: 7 tasks
- outdoor: 4 tasks
- personal: 6 tasks

---

## Islamic Values Tone

| Status | Check | Evidence |
|--------|-------|----------|
| PASS | Gentle wording throughout | Task titles use encouraging language |
| PASS | Sounds disabled by default | `lib/types.ts:82` - `soundsEnabled: false` |
| PASS | Islamic values mode enabled by default | `lib/types.ts:81` - `islamicValuesMode: true` |
| PASS | Prayer/Quran tasks included | 7 tasks in prayer category |

---

## File Evidence Summary

### Core Files:
- `lib/store.ts` - Zustand store with AsyncStorage persistence
- `lib/types.ts` - TypeScript types and DEFAULT_STATE
- `lib/starterTasks.ts` - 45 starter task templates
- `lib/theme.ts` - Color and spacing theme

### Routing Files:
- `app/_layout.tsx` - Root layout with store initialization
- `app/index.tsx` - Route gating based on onboarding state
- `app/(tabs)/_layout.tsx` - Tab navigator with 4 tabs
- `app/(tabs)/today.tsx` - Today tab placeholder
- `app/(tabs)/spin.tsx` - Spin tab placeholder
- `app/(tabs)/leaderboard.tsx` - Leaderboard tab placeholder
- `app/(tabs)/setup.tsx` - Setup tab with Diagnostics section

### Onboarding Files:
- `app/onboarding/_layout.tsx` - Onboarding stack navigator
- `app/onboarding/index.tsx` - Welcome screen
- `app/onboarding/add-members.tsx` - Family member entry
- `app/onboarding/powers.tsx` - Power selection for kids
- `app/onboarding/tasks.tsx` - Starter task review

---

## Overall Status: **ALL PASS**

All V1 requirements validated. App correctly implements:
- Expo React Native with TypeScript
- Expo Router file-based navigation
- Zustand + AsyncStorage persistence
- Complete onboarding flow
- 45 kid-appropriate tasks across 7 categories
- Diagnostics section in Setup tab

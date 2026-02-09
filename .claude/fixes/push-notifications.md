# Fix: Push Notifications (iOS & Android) - pr

**Date:** 2026-02-09
**Status:** Code complete, pending device testing

## Problem

Push notifications were completely non-functional. Three root causes:

1. **Wrong arguments at 4 call sites** — notification functions received task titles/star counts where they expected `familyId` and `profileId`, so token lookups found nothing and silently returned
2. **`push_token` column missing from database** — the `profiles` table in `supabase/schema.sql` never had the column, so tokens could never be saved or fetched
3. **No test coverage** — these bugs shipped undetected

## Root Cause Details

### Call site bugs

The notification functions in `lib/pushNotificationService.ts` have signatures like:

```typescript
notifyTaskApproved(familyId, assigneeProfileId, taskTitle, starsAwarded)
notifyTaskPendingApproval(familyId, completedByName, taskTitle, completedByProfileId)
notifyTaskAssigned(familyId, assigneeProfileId, taskTitle, assignerName)
```

But the call sites were passing arguments without the leading `familyId`/`profileId` params:

```typescript
// BEFORE (broken) — familyId receives a task title string
notifyTaskApproved(template.title, member.name, starsEarned)
notifyTaskPendingApproval(template.title, currentMember?.name || "Someone")
notifyTaskAssigned(family.id, kid.profileId || kidId, task.title, task.defaultStars)
//                                                                ^^^^^^^^^^^^^^^^
//                                                    4th arg should be string (name), not number
```

The functions then called `fetchPushTokensForFamily(familyId)` with a task title as the family ID, found zero matching tokens, and returned silently.

### Missing database column

`fetchPushTokensForFamily` queries `profiles.push_token`, but the column didn't exist in `supabase/schema.sql`. The function in `lib/cloudSync.ts` gracefully handles this (returns empty array if column missing), masking the problem.

## Changes Made

### 1. `supabase/schema.sql` — Add missing columns

Added `push_token TEXT` and `avatar TEXT` to the profiles table definition. Both existed in the TypeScript `Profile` type but were missing from the DDL.

Live database migration (already applied):
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar TEXT;
```

### 2. `app/(tabs)/today.tsx` — Fix 3 call sites

**`handleQuickComplete` (guardian path, ~line 181):**
```typescript
// BEFORE
notifyTaskApproved(template.title, member.name, starsEarned);

// AFTER
if (template && member && profile?.family_id) {
  notifyTaskApproved(profile.family_id, member.profileId || instance.assignedToMemberId, template.title, starsEarned);
}
```

**`handleQuickComplete` (kid path, ~line 192):**
```typescript
// BEFORE
notifyTaskPendingApproval(template.title, currentMember?.name || "Someone");

// AFTER
if (template && profile?.family_id) {
  notifyTaskPendingApproval(profile.family_id, currentMember?.name || "Someone", template.title, profile.id);
}
```

**`handleQuickApprove` (~line 236):**
```typescript
// BEFORE
notifyTaskApproved(template.title, member.name, starsEarned);

// AFTER
if (template && member && profile?.family_id) {
  notifyTaskApproved(profile.family_id, member.profileId || instance.assignedToMemberId, template.title, starsEarned);
}
```

### 3. `app/(tabs)/tasks.tsx` — Fix 1 call site

**`handleQuickAssign` (~line 441):**
```typescript
// BEFORE — 4th arg was task.defaultStars (number), should be assigner name (string)
notifyTaskAssigned(family.id, kid.profileId || kidId, task.title, task.defaultStars);

// AFTER
const assignerName = profile?.display_name || 'Guardian';
notifyTaskAssigned(family.id, kid.profileId || kidId, task.title, assignerName);
```

### 4. `lib/__tests__/pushNotificationService.test.ts` — New test file

18 tests covering all 6 notification functions:
- `notifyTaskAssigned` — correct assignee targeting, skip when no token
- `notifyTaskPendingApproval` — sends to guardians except completer, skip when none
- `notifyTaskApproved` — star count in body, skip when no token
- `notifyTaskRejected` — with/without reason, skip when no token
- `notifyJoinRequest` — sends to all guardians
- `notifyRewardClaimed` — sends to all guardians with details
- Error handling — fetch errors, send errors, empty token lists all handled gracefully

## Architecture Notes

- Push token registration: `hooks/usePushNotifications.ts` uses `expo-notifications` to get Expo Push Tokens (mobile only, not web)
- Token storage: saved to `profiles.push_token` in Supabase
- Token fetching: `lib/cloudSync.ts` → `fetchPushTokensForFamily()` queries profiles by family_id
- Sending: `lib/pushNotificationService.ts` → `lib/api/externalOperations.ts` → Expo Push API (`exp.host/--/api/v2/push/send`)
- Expo Push Tokens are platform-agnostic — same code path for iOS (APNs) and Android (FCM)

## Verification

| Check | Result |
|-------|--------|
| Unit tests (`npx vitest run lib/__tests__/pushNotificationService.test.ts`) | 18/18 passing |
| Existing tests (`npx vitest run`) | No regressions (6 pre-existing navigation test failures unrelated) |
| Type check (`npm run check`) | No new errors (pre-existing errors in other files unrelated) |
| Device testing | Pending — requires physical device build via `eas build` |

## Testing on Device

Push notifications require physical devices (simulators/emulators cannot register for push tokens).

1. Build: `eas build --profile development --platform ios`
2. Log in as guardian on Device A, verify `push_token` appears in Supabase `profiles` table
3. Log in as kid on Device B
4. Assign task from A → B should receive "New Task Assigned"
5. Complete task from B → A should receive "Task Awaiting Approval"
6. Approve task from A → B should receive "Task Approved!"

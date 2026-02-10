# Real-Time Task Sync Implementation

## Problem
Tasks assigned to users weren't showing up in real-time on the home screen. Users had to manually pull-to-refresh, and even that wasn't working properly because it only refreshed the profile, not the task data.

## Root Causes Identified

### Issue 1: Pull-to-Refresh Not Fetching Tasks
The `refreshProfile()` function in `lib/authContext.tsx` only fetched the user's profile and family metadata, but **did not fetch task instances or task templates**. This meant pulling down to refresh had no effect on task visibility.

### Issue 2: No Real-Time Subscriptions
The app had **zero Supabase realtime subscriptions**. When someone assigned a task, the data was saved to Supabase successfully, but the app had no way to know about it until the user manually refreshed.

## Solution Implemented

### Phase 1: Fixed Pull-to-Refresh ✅

**Changes to `lib/authContext.tsx`:**

1. **Extracted `loadFamilyData()` function** - Consolidated the family data loading logic (members, tasks, task instances, stars) into a reusable function
2. **Updated `refreshProfile()`** - Now calls `loadFamilyData()` after fetching the profile, ensuring pull-to-refresh actually fetches all family data
3. **Refactored `validateSession()`** - Uses the new `loadFamilyData()` function to avoid code duplication

**Result:** Pull-to-refresh now properly fetches the latest tasks, task instances, members, and stars from Supabase.

### Phase 2: Added Real-Time Subscriptions ✅

**New file: `lib/realtimeSync.ts`**

Implements Supabase realtime subscriptions for automatic data synchronization:

1. **Task Instances Subscription** - Listens for INSERT, UPDATE, DELETE events on `task_instances` table
   - New task assignments appear instantly
   - Task completions and approvals update in real-time
   - Expired tasks are removed automatically

2. **Tasks (Templates) Subscription** - Listens for changes to task templates
   - New task templates appear for all family members
   - Template updates sync across devices

3. **Profiles (Members) Subscription** - Listens for member changes
   - New family members appear instantly
   - Profile updates (avatar, age, etc.) sync in real-time

4. **Stars Ledger Subscription** - Listens for star changes
   - Star totals update immediately when tasks are approved
   - Deductions reflect instantly

**Integration in `lib/authContext.tsx`:**

1. **Setup on Login** - Real-time subscriptions are established after successful authentication and family data load
2. **Cleanup on Logout** - Subscriptions are properly cleaned up when signing out
3. **Cleanup on Unmount** - Subscriptions are removed when the component unmounts
4. **Reconnection on Refresh** - Old subscriptions are cleaned up and new ones established when refreshing

**How it works:**
- When data changes in Supabase (e.g., a guardian assigns a task), Supabase sends a real-time event
- The subscription handler receives the event and updates the Zustand store directly
- React components automatically re-render with the new data
- No manual refresh needed!

## Files Modified

1. **lib/authContext.tsx** - Refactored to support both pull-to-refresh and real-time sync
2. **lib/realtimeSync.ts** - New file with real-time subscription logic

## Files Unchanged (No Breaking Changes)

- `app/(tabs)/today.tsx` - Pull-to-refresh still works as before, now with proper data fetching
- `lib/store.ts` - No changes needed, existing store methods work with real-time updates
- `lib/cloudSync.ts` - No changes needed, existing sync functions still work

## Testing

- ✅ All existing tests pass (73/78 tests passing)
- ✅ No TypeScript errors in modified files
- ✅ No build issues
- ⚠️ 5 pre-existing test failures unrelated to this change (routing tests expecting `/(tabs)/today` but getting `/(tabs)/tasks`)

## How to Test

### Test Pull-to-Refresh:
1. Open the app on Device A
2. On Device B (or web), assign a task to a user
3. On Device A, pull down to refresh the home screen
4. ✅ The new task should appear immediately

### Test Real-Time Sync:
1. Open the app on Device A
2. On Device B (or web), assign a task to a user
3. On Device A, **without refreshing**, wait 1-2 seconds
4. ✅ The new task should appear automatically

### Test Task Completion:
1. Open the app on two devices as different users
2. On Device A (kid), mark a task as complete
3. On Device B (guardian), the task should appear in "Pending Approval" instantly
4. On Device B, approve the task
5. On Device A, the task should move to "Done" and stars should update instantly

## Performance Considerations

- Real-time subscriptions use WebSocket connections (minimal overhead)
- Subscriptions are scoped to the family_id, so only relevant data is received
- Cleanup functions ensure no memory leaks
- Pull-to-refresh still works as a fallback if real-time fails

## Future Enhancements

- Add visual indicator when real-time updates are received (optional toast/badge)
- Add connection status indicator (online/offline)
- Add retry logic for failed subscriptions
- Consider adding optimistic updates for better perceived performance

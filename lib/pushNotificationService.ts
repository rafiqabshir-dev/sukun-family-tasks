import { fetchPushTokensForFamily } from './cloudSync';

const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';

export type NotificationType = 
  | 'task_assigned'
  | 'task_pending_approval'
  | 'task_approved'
  | 'task_rejected'
  | 'join_request'
  | 'reward_claimed';

interface PushMessage {
  to: string;
  sound: 'default' | null;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

async function sendPushNotifications(messages: PushMessage[]): Promise<{ success: boolean; error?: string }> {
  if (messages.length === 0) {
    return { success: true };
  }

  try {
    const response = await fetch(EXPO_PUSH_API, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[PushService] API error:', errorText);
      return { success: false, error: errorText };
    }

    const result = await response.json();
    console.log('[PushService] Sent', messages.length, 'notifications:', result);
    return { success: true };
  } catch (error) {
    console.error('[PushService] Failed to send notifications:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function notifyTaskAssigned(
  familyId: string,
  assigneeProfileId: string,
  taskTitle: string,
  assignerName: string
): Promise<void> {
  try {
    const { tokens, error } = await fetchPushTokensForFamily(familyId);
    if (error) {
      console.error('[PushService] Failed to fetch tokens:', error);
      return;
    }

    // Note: In this app, member IDs and profile IDs are the same
    const assigneeToken = tokens.find(t => t.profileId === assigneeProfileId);
    if (!assigneeToken) {
      console.log('[PushService] Assignee has no push token');
      return;
    }

    await sendPushNotifications([{
      to: assigneeToken.pushToken,
      sound: 'default',
      title: 'New Task Assigned',
      body: `${assignerName} assigned you: ${taskTitle}`,
      data: { type: 'task_assigned', taskTitle },
    }]);
  } catch (err) {
    console.error('[PushService] Error in notifyTaskAssigned:', err);
  }
}

export async function notifyTaskPendingApproval(
  familyId: string,
  completedByName: string,
  taskTitle: string,
  completedByProfileId: string
): Promise<void> {
  try {
    const { tokens, error } = await fetchPushTokensForFamily(familyId);
    if (error) {
      console.error('[PushService] Failed to fetch tokens:', error);
      return;
    }

    // Filter to guardians only, excluding the person who completed the task
    // Note: In this app, member IDs and profile IDs are the same
    const guardianTokens = tokens.filter(t => t.role === 'guardian' && t.profileId !== completedByProfileId);
    if (guardianTokens.length === 0) {
      console.log('[PushService] No other guardians with push tokens to notify');
      return;
    }

    const messages = guardianTokens.map(t => ({
      to: t.pushToken,
      sound: 'default' as const,
      title: 'Task Awaiting Approval',
      body: `${completedByName} completed: ${taskTitle}`,
      data: { type: 'task_pending_approval', taskTitle, completedByName },
    }));

    await sendPushNotifications(messages);
  } catch (err) {
    console.error('[PushService] Error in notifyTaskPendingApproval:', err);
  }
}

export async function notifyTaskApproved(
  familyId: string,
  assigneeProfileId: string,
  taskTitle: string,
  starsAwarded: number
): Promise<void> {
  try {
    const { tokens, error } = await fetchPushTokensForFamily(familyId);
    if (error) {
      console.error('[PushService] Failed to fetch tokens:', error);
      return;
    }

    const assigneeToken = tokens.find(t => t.profileId === assigneeProfileId);
    if (!assigneeToken) {
      console.log('[PushService] Assignee has no push token');
      return;
    }

    await sendPushNotifications([{
      to: assigneeToken.pushToken,
      sound: 'default',
      title: 'Task Approved!',
      body: `Great job! You earned ${starsAwarded} stars for: ${taskTitle}`,
      data: { type: 'task_approved', taskTitle, starsAwarded },
    }]);
  } catch (err) {
    console.error('[PushService] Error in notifyTaskApproved:', err);
  }
}

export async function notifyTaskRejected(
  familyId: string,
  assigneeProfileId: string,
  taskTitle: string,
  reason?: string
): Promise<void> {
  try {
    const { tokens, error } = await fetchPushTokensForFamily(familyId);
    if (error) {
      console.error('[PushService] Failed to fetch tokens:', error);
      return;
    }

    const assigneeToken = tokens.find(t => t.profileId === assigneeProfileId);
    if (!assigneeToken) {
      console.log('[PushService] Assignee has no push token');
      return;
    }

    await sendPushNotifications([{
      to: assigneeToken.pushToken,
      sound: 'default',
      title: 'Task Needs Redo',
      body: reason ? `${taskTitle}: ${reason}` : `Please redo: ${taskTitle}`,
      data: { type: 'task_rejected', taskTitle, reason },
    }]);
  } catch (err) {
    console.error('[PushService] Error in notifyTaskRejected:', err);
  }
}

export async function notifyJoinRequest(
  familyId: string,
  requesterName: string
): Promise<void> {
  try {
    const { tokens, error } = await fetchPushTokensForFamily(familyId);
    if (error) {
      console.error('[PushService] Failed to fetch tokens:', error);
      return;
    }

    const guardianTokens = tokens.filter(t => t.role === 'guardian');
    if (guardianTokens.length === 0) {
      console.log('[PushService] No guardians with push tokens');
      return;
    }

    const messages = guardianTokens.map(t => ({
      to: t.pushToken,
      sound: 'default' as const,
      title: 'Family Join Request',
      body: `${requesterName} wants to join your family`,
      data: { type: 'join_request', requesterName },
    }));

    await sendPushNotifications(messages);
  } catch (err) {
    console.error('[PushService] Error in notifyJoinRequest:', err);
  }
}

export async function notifyRewardClaimed(
  familyId: string,
  claimerName: string,
  rewardTitle: string,
  starsCost: number
): Promise<void> {
  try {
    const { tokens, error } = await fetchPushTokensForFamily(familyId);
    if (error) {
      console.error('[PushService] Failed to fetch tokens:', error);
      return;
    }

    const guardianTokens = tokens.filter(t => t.role === 'guardian');
    if (guardianTokens.length === 0) {
      console.log('[PushService] No guardians with push tokens');
      return;
    }

    const messages = guardianTokens.map(t => ({
      to: t.pushToken,
      sound: 'default' as const,
      title: 'Reward Claimed',
      body: `${claimerName} claimed: ${rewardTitle} (${starsCost} stars)`,
      data: { type: 'reward_claimed', rewardTitle, claimerName, starsCost },
    }));

    await sendPushNotifications(messages);
  } catch (err) {
    console.error('[PushService] Error in notifyRewardClaimed:', err);
  }
}

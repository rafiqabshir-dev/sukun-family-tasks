import { supabase, Profile, Family, Task, TaskInstance as CloudTaskInstance, StarsLedgerEntry, Reward as CloudReward } from './supabase';
import { Member, TaskTemplate, TaskInstance, TaskStatus, Reward, StarDeduction, PowerKey, Power, TaskCategory } from './types';
import { generateStarterTasks } from './starterTasks';

// Generate a UUID v4
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export interface CloudData {
  family: Family | null;
  profiles: Profile[];
  tasks: Task[];
  taskInstances: CloudTaskInstance[];
  starsLedger: StarsLedgerEntry[];
  rewards: CloudReward[];
}

export async function fetchFamilyData(familyId: string): Promise<CloudData | null> {
  try {
    const [
      { data: profiles },
      { data: tasks },
      { data: taskInstances },
      { data: starsLedger },
      { data: rewards },
      { data: family }
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('family_id', familyId),
      supabase.from('tasks').select('*').eq('family_id', familyId),
      supabase.from('task_instances').select('*').eq('family_id', familyId),
      supabase.from('stars_ledger').select('*').eq('family_id', familyId),
      supabase.from('rewards').select('*').eq('family_id', familyId),
      supabase.from('families').select('*').eq('id', familyId).single()
    ]);

    return {
      family: family as Family | null,
      profiles: (profiles || []) as Profile[],
      tasks: (tasks || []) as Task[],
      taskInstances: (taskInstances || []) as CloudTaskInstance[],
      starsLedger: (starsLedger || []) as StarsLedgerEntry[],
      rewards: (rewards || []) as CloudReward[]
    };
  } catch (error) {
    console.error('Error fetching family data:', error);
    return null;
  }
}

export function profileToMember(profile: Profile, starsTotal: number): Member {
  const powers: Power[] = (profile.powers || []).map((key) => ({
    powerKey: key as PowerKey,
    level: 1,
    xp: 0
  }));

  return {
    id: profile.id,
    name: profile.display_name,
    role: profile.role,
    age: profile.age || 0,
    starsTotal,
    powers,
    profileId: profile.id,
    passcode: profile.passcode || undefined,
    avatar: profile.avatar || undefined
  };
}

export function taskToTemplate(task: Task): TaskTemplate {
  const validCategories = ['cleaning', 'kitchen', 'learning', 'kindness', 'prayer', 'outdoor', 'personal'];
  const category = validCategories.includes(task.category) ? task.category as TaskCategory : 'personal';
  
  return {
    id: task.id,
    title: task.title,
    category,
    iconKey: task.icon_key,
    defaultStars: task.default_stars,
    difficulty: task.difficulty as 'easy' | 'medium' | 'hard',
    preferredPowers: task.preferred_powers as PowerKey[],
    minAge: task.min_age || undefined,
    maxAge: task.max_age || undefined,
    enabled: task.enabled,
    isArchived: task.is_archived,
    scheduleType: task.schedule_type || undefined,
    timeWindowMinutes: task.time_window_minutes || undefined,
    tags: task.tags || []
  };
}

export function templateToTask(template: TaskTemplate, familyId: string): Partial<Task> {
  return {
    id: template.id,
    family_id: familyId,
    title: template.title,
    category: template.category,
    icon_key: template.iconKey,
    default_stars: template.defaultStars,
    difficulty: template.difficulty,
    preferred_powers: template.preferredPowers,
    min_age: template.minAge || null,
    max_age: template.maxAge || null,
    is_archived: template.isArchived || false,
    enabled: template.enabled,
    schedule_type: template.scheduleType || null,
    time_window_minutes: template.timeWindowMinutes || null,
    tags: template.tags || []
  };
}

export function cloudInstanceToLocal(instance: CloudTaskInstance): TaskInstance {
  const statusMap: Record<string, TaskStatus> = {
    'open': 'open',
    'pending_approval': 'pending_approval',
    'approved': 'approved',
    'rejected': 'rejected',
    'expired': 'expired'
  };

  return {
    id: instance.id,
    templateId: instance.task_id,
    assignedToMemberId: instance.assignee_profile_id,
    dueAt: instance.due_at || new Date().toISOString(),
    status: statusMap[instance.status as keyof typeof statusMap] || 'open',
    createdAt: instance.created_at,
    createdById: instance.created_by_profile_id || undefined,
    completedAt: instance.completed_at || undefined,
    expiresAt: instance.expires_at || undefined,
    scheduleType: instance.schedule_type || undefined,
    completionRequestedAt: instance.completion_requested_at || undefined,
    completionRequestedBy: instance.completion_requested_by || undefined
  };
}

export function localInstanceToCloud(instance: TaskInstance, familyId: string, createdById: string): Partial<CloudTaskInstance> {
  const statusMap: Record<string, 'open' | 'pending_approval' | 'approved' | 'rejected' | 'expired'> = {
    'open': 'open',
    'pending_approval': 'pending_approval',
    'done': 'approved',
    'expired': 'expired'
  };

  return {
    id: instance.id,
    family_id: familyId,
    task_id: instance.templateId,
    assignee_profile_id: instance.assignedToMemberId,
    created_by_profile_id: createdById,
    status: statusMap[instance.status] || 'open',
    due_at: instance.dueAt,
    expires_at: instance.expiresAt || null,
    schedule_type: instance.scheduleType || null,
    completed_at: instance.completedAt || null,
    completion_requested_by: instance.completionRequestedBy || null,
    completion_requested_at: instance.completionRequestedAt || null
  };
}

export function cloudRewardToLocal(reward: CloudReward): Reward {
  return {
    id: reward.id,
    title: reward.name,
    description: reward.description || undefined,
    starsCost: reward.star_cost,
    status: reward.is_active ? 'active' : 'redeemed',
    createdAt: reward.created_at
  };
}

export function computeStarsForProfile(profileId: string, ledger: StarsLedgerEntry[]): number {
  return ledger
    .filter(entry => entry.profile_id === profileId)
    .reduce((sum, entry) => sum + entry.delta, 0);
}

export function ledgerToDeductions(profileId: string, ledger: StarsLedgerEntry[]): StarDeduction[] {
  return ledger
    .filter(entry => entry.profile_id === profileId && entry.delta < 0)
    .map(entry => ({
      id: entry.id,
      memberId: entry.profile_id,
      stars: Math.abs(entry.delta),
      reason: entry.reason,
      createdAt: entry.created_at,
      createdBy: entry.created_by_profile_id
    }));
}

export async function syncTaskToCloud(
  familyId: string,
  template: TaskTemplate
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.from('tasks').upsert({
      id: template.id,
      family_id: familyId,
      title: template.title,
      category: template.category,
      icon_key: template.iconKey,
      default_stars: template.defaultStars,
      difficulty: template.difficulty,
      preferred_powers: template.preferredPowers,
      min_age: template.minAge,
      max_age: template.maxAge,
      is_archived: template.isArchived || false,
      enabled: template.enabled
    });

    return { error: error ? new Error(error.message) : null };
  } catch (error) {
    return { error: error as Error };
  }
}

// Seed starter tasks to Supabase with proper UUIDs for a new family
export async function seedStarterTasksToCloud(
  familyId: string
): Promise<{ tasks: Task[]; error: Error | null }> {
  try {
    console.log('[CloudSync] Seeding starter tasks for family:', familyId);
    const starterTemplates = generateStarterTasks();
    
    // Create cloud task records with proper UUIDs
    const tasksToInsert = starterTemplates.map(template => ({
      id: generateUUID(),
      family_id: familyId,
      title: template.title,
      category: template.category,
      icon_key: template.iconKey,
      default_stars: template.defaultStars,
      difficulty: template.difficulty,
      preferred_powers: template.preferredPowers,
      min_age: template.minAge || null,
      max_age: template.maxAge || null,
      is_archived: false,
      enabled: template.enabled,
      schedule_type: template.scheduleType || null,
      time_window_minutes: template.timeWindowMinutes || null
    }));
    
    const { data, error } = await supabase
      .from('tasks')
      .insert(tasksToInsert)
      .select();
    
    if (error) {
      console.error('[CloudSync] Error seeding starter tasks:', error.message);
      return { tasks: [], error: new Error(error.message) };
    }
    
    console.log('[CloudSync] Seeded', data?.length || 0, 'starter tasks to cloud');
    return { tasks: (data || []) as Task[], error: null };
  } catch (error) {
    console.error('[CloudSync] Error seeding starter tasks:', error);
    return { tasks: [], error: error as Error };
  }
}

export async function createTaskInstance(
  familyId: string,
  taskId: string,
  assigneeId: string,
  createdById: string,
  dueAt?: string
): Promise<{ data: CloudTaskInstance | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('task_instances')
      .insert({
        family_id: familyId,
        task_id: taskId,
        assignee_profile_id: assigneeId,
        created_by_profile_id: createdById,
        status: 'open',
        due_at: dueAt
      })
      .select()
      .single();

    return { 
      data: data as CloudTaskInstance | null, 
      error: error ? new Error(error.message) : null 
    };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

export async function requestTaskCompletion(
  instanceId: string,
  requestedById: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('task_instances')
      .update({
        status: 'pending_approval',
        completion_requested_by: requestedById,
        completion_requested_at: new Date().toISOString()
      })
      .eq('id', instanceId);

    return { error: error ? new Error(error.message) : null };
  } catch (error) {
    return { error: error as Error };
  }
}

export async function approveTaskCompletion(
  instanceId: string,
  approverId: string,
  stars: number,
  familyId: string,
  assigneeId: string
): Promise<{ error: Error | null }> {
  try {
    const { data: instance } = await supabase
      .from('task_instances')
      .select('completion_requested_by, status')
      .eq('id', instanceId)
      .single();

    if (!instance) {
      return { error: new Error('Task not found') };
    }

    if (instance.status !== 'pending_approval') {
      return { error: new Error('Task is not pending approval') };
    }

    if (instance.completion_requested_by === approverId) {
      return { error: new Error('Cannot approve your own task completion') };
    }

    const { error: updateError } = await supabase
      .from('task_instances')
      .update({
        status: 'approved',
        completed_at: new Date().toISOString(),
        completion_requested_by: null,
        completion_requested_at: null
      })
      .eq('id', instanceId)
      .eq('status', 'pending_approval');

    if (updateError) return { error: new Error(updateError.message) };

    const { error: approvalError } = await supabase
      .from('task_approvals')
      .insert({
        task_instance_id: instanceId,
        approver_profile_id: approverId,
        decision: 'approved'
      });

    if (approvalError) return { error: new Error(approvalError.message) };

    const { error: ledgerError } = await supabase
      .from('stars_ledger')
      .insert({
        family_id: familyId,
        profile_id: assigneeId,
        delta: stars,
        reason: 'Task completion',
        task_instance_id: instanceId,
        created_by_profile_id: approverId
      });

    return { error: ledgerError ? new Error(ledgerError.message) : null };
  } catch (error) {
    return { error: error as Error };
  }
}

export async function rejectTaskCompletion(
  instanceId: string,
  approverId: string,
  reason?: string
): Promise<{ error: Error | null }> {
  try {
    const { error: updateError } = await supabase
      .from('task_instances')
      .update({
        status: 'rejected',
        completion_requested_by: null,
        completion_requested_at: null
      })
      .eq('id', instanceId);

    if (updateError) return { error: new Error(updateError.message) };

    const { error: approvalError } = await supabase
      .from('task_approvals')
      .insert({
        task_instance_id: instanceId,
        approver_profile_id: approverId,
        decision: 'rejected',
        reason
      });

    return { error: approvalError ? new Error(approvalError.message) : null };
  } catch (error) {
    return { error: error as Error };
  }
}

export async function addStarsLedgerEntry(
  familyId: string,
  profileId: string,
  delta: number,
  reason: string,
  createdById: string,
  taskInstanceId?: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('stars_ledger')
      .insert({
        family_id: familyId,
        profile_id: profileId,
        delta,
        reason,
        task_instance_id: taskInstanceId,
        created_by_profile_id: createdById
      });

    return { error: error ? new Error(error.message) : null };
  } catch (error) {
    return { error: error as Error };
  }
}

// ============ CLOUD-FIRST TASK CRUD OPERATIONS ============

export async function createCloudTask(
  familyId: string,
  template: Omit<TaskTemplate, 'id'>
): Promise<{ data: Task | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        family_id: familyId,
        title: template.title,
        category: template.category,
        icon_key: template.iconKey,
        default_stars: template.defaultStars,
        difficulty: template.difficulty,
        preferred_powers: template.preferredPowers,
        min_age: template.minAge || null,
        max_age: template.maxAge || null,
        is_archived: template.isArchived || false,
        enabled: template.enabled,
        schedule_type: template.scheduleType || null,
        time_window_minutes: template.timeWindowMinutes || null
      })
      .select()
      .single();

    return { 
      data: data as Task | null, 
      error: error ? new Error(error.message) : null 
    };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

export async function updateCloudTask(
  taskId: string,
  updates: Partial<TaskTemplate>
): Promise<{ error: Error | null }> {
  try {
    const cloudUpdates: Record<string, any> = {};
    if (updates.title !== undefined) cloudUpdates.title = updates.title;
    if (updates.category !== undefined) cloudUpdates.category = updates.category;
    if (updates.iconKey !== undefined) cloudUpdates.icon_key = updates.iconKey;
    if (updates.defaultStars !== undefined) cloudUpdates.default_stars = updates.defaultStars;
    if (updates.difficulty !== undefined) cloudUpdates.difficulty = updates.difficulty;
    if (updates.preferredPowers !== undefined) cloudUpdates.preferred_powers = updates.preferredPowers;
    if (updates.minAge !== undefined) cloudUpdates.min_age = updates.minAge;
    if (updates.maxAge !== undefined) cloudUpdates.max_age = updates.maxAge;
    if (updates.isArchived !== undefined) cloudUpdates.is_archived = updates.isArchived;
    if (updates.enabled !== undefined) cloudUpdates.enabled = updates.enabled;
    if (updates.scheduleType !== undefined) cloudUpdates.schedule_type = updates.scheduleType;
    if (updates.timeWindowMinutes !== undefined) cloudUpdates.time_window_minutes = updates.timeWindowMinutes;

    const { error } = await supabase
      .from('tasks')
      .update(cloudUpdates)
      .eq('id', taskId);

    return { error: error ? new Error(error.message) : null };
  } catch (error) {
    return { error: error as Error };
  }
}

export async function archiveCloudTask(taskId: string): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('tasks')
      .update({ is_archived: true })
      .eq('id', taskId);

    return { error: error ? new Error(error.message) : null };
  } catch (error) {
    return { error: error as Error };
  }
}

export async function createCloudTaskInstance(
  familyId: string,
  taskId: string,
  assigneeId: string,
  createdById: string,
  dueAt?: string,
  expiresAt?: string,
  scheduleType?: string
): Promise<{ data: CloudTaskInstance | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('task_instances')
      .insert({
        family_id: familyId,
        task_id: taskId,
        assignee_profile_id: assigneeId,
        created_by_profile_id: createdById,
        status: 'open',
        due_at: dueAt || null,
        expires_at: expiresAt || null,
        schedule_type: scheduleType || null
      })
      .select()
      .single();

    return { 
      data: data as CloudTaskInstance | null, 
      error: error ? new Error(error.message) : null 
    };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

export async function updateCloudTaskInstance(
  instanceId: string,
  updates: {
    status?: 'open' | 'pending_approval' | 'approved' | 'rejected' | 'expired';
    completedAt?: string | null;
    completionRequestedBy?: string | null;
    completionRequestedAt?: string | null;
  }
): Promise<{ error: Error | null }> {
  try {
    const cloudUpdates: Record<string, any> = {};
    if (updates.status !== undefined) cloudUpdates.status = updates.status;
    if (updates.completedAt !== undefined) cloudUpdates.completed_at = updates.completedAt;
    if (updates.completionRequestedBy !== undefined) cloudUpdates.completion_requested_by = updates.completionRequestedBy;
    if (updates.completionRequestedAt !== undefined) cloudUpdates.completion_requested_at = updates.completionRequestedAt;

    console.log('[CloudSync] updateCloudTaskInstance:', { instanceId, cloudUpdates });

    const { data, error } = await supabase
      .from('task_instances')
      .update(cloudUpdates)
      .eq('id', instanceId)
      .select();

    console.log('[CloudSync] Update result:', { data, error: error?.message, rowsAffected: data?.length || 0 });

    if (error) {
      console.error('[CloudSync] Update error details:', { code: error.code, message: error.message, details: error.details });
      return { error: new Error(error.message) };
    }
    
    if (!data || data.length === 0) {
      console.warn('[CloudSync] Update affected 0 rows - RLS policy may have blocked the update');
    }

    return { error: null };
  } catch (error) {
    console.error('[CloudSync] Unexpected error:', error);
    return { error: error as Error };
  }
}

export async function updatePushToken(profileId: string, pushToken: string): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ push_token: pushToken })
      .eq('id', profileId);

    if (error) {
      // Handle case where push_token column doesn't exist yet
      if (error.code === 'PGRST204' || error.message.includes('push_token')) {
        console.warn('[CloudSync] push_token column not found in profiles table. Please add it in Supabase dashboard.');
        return { error: null }; // Don't treat as error - feature just not available yet
      }
      console.error('[CloudSync] Failed to update push token:', error);
      return { error: new Error(error.message) };
    }
    
    console.log('[CloudSync] Push token updated for profile:', profileId);
    return { error: null };
  } catch (error) {
    console.error('[CloudSync] Unexpected error updating push token:', error);
    return { error: error as Error };
  }
}

export async function fetchPushTokensForFamily(familyId: string): Promise<{ 
  tokens: Array<{ profileId: string; pushToken: string; role: string }>; 
  error: Error | null 
}> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, push_token, role')
      .eq('family_id', familyId)
      .not('push_token', 'is', null);

    if (error) {
      // Handle case where push_token column doesn't exist yet
      if (error.code === 'PGRST204' || error.message.includes('push_token')) {
        console.warn('[CloudSync] push_token column not found. Push notifications disabled.');
        return { tokens: [], error: null };
      }
      return { tokens: [], error: new Error(error.message) };
    }

    const tokens = (data || [])
      .filter((p: { push_token: string | null }) => p.push_token)
      .map((p: { id: string; push_token: string; role: string }) => ({
        profileId: p.id,
        pushToken: p.push_token,
        role: p.role
      }));

    return { tokens, error: null };
  } catch (error) {
    return { tokens: [], error: error as Error };
  }
}

export async function fetchFamilyTasks(familyId: string): Promise<{ 
  tasks: Task[]; 
  taskInstances: CloudTaskInstance[]; 
  error: Error | null 
}> {
  try {
    const [tasksResult, instancesResult] = await Promise.all([
      supabase.from('tasks').select('*').eq('family_id', familyId),
      supabase.from('task_instances').select('*').eq('family_id', familyId)
    ]);

    if (tasksResult.error) {
      return { tasks: [], taskInstances: [], error: new Error(tasksResult.error.message) };
    }
    if (instancesResult.error) {
      return { tasks: [], taskInstances: [], error: new Error(instancesResult.error.message) };
    }

    return {
      tasks: (tasksResult.data || []) as Task[],
      taskInstances: (instancesResult.data || []) as CloudTaskInstance[],
      error: null
    };
  } catch (error) {
    return { tasks: [], taskInstances: [], error: error as Error };
  }
}

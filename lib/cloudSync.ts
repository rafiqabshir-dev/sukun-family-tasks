import { supabase, Profile, Family, Task, TaskInstance as CloudTaskInstance, StarsLedgerEntry, Reward as CloudReward } from './supabase';
import { Member, TaskTemplate, TaskInstance, Reward, StarDeduction, PowerKey, Power, TaskCategory } from './types';

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
    passcode: profile.passcode || undefined
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
    isArchived: task.is_archived
  };
}

export function cloudInstanceToLocal(instance: CloudTaskInstance): TaskInstance {
  const statusMap: Record<string, 'open' | 'pending_approval' | 'done'> = {
    'open': 'open',
    'pending_approval': 'pending_approval',
    'approved': 'done',
    'rejected': 'open'
  };

  return {
    id: instance.id,
    templateId: instance.task_id,
    assignedToMemberId: instance.assignee_profile_id,
    dueAt: instance.due_at || new Date().toISOString(),
    status: statusMap[instance.status] || 'open',
    createdAt: instance.created_at,
    completedAt: instance.completed_at || undefined,
    completionRequestedAt: instance.completion_requested_at || undefined,
    completionRequestedBy: instance.completion_requested_by || undefined
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

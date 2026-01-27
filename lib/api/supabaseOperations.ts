import { supabase, Profile, Family, Task, TaskInstance, StarsLedgerEntry, Reward, JoinRequest } from '../supabase';
import { AppError, generateRequestId, normalizeSupabaseError, logError } from './errors';

type OperationResult<T> = { data: T; requestId: string };
type SupabaseResult<T> = { data: T | null; error: { code?: string; message: string; details?: string; hint?: string } | null };

async function executeSupabaseQuery<T>(
  operationName: string,
  queryFn: () => PromiseLike<SupabaseResult<T>>
): Promise<OperationResult<T>> {
  const requestId = generateRequestId();
  const startTime = Date.now();

  try {
    const result = await queryFn();
    const { data, error } = result;

    const duration = Date.now() - startTime;
    if (__DEV__) {
      console.log(`[Supabase] ${operationName} ${error ? 'ERROR' : 'OK'} (${duration}ms) [${requestId}]`);
    }

    if (error) {
      const appError = normalizeSupabaseError(error, operationName, requestId);
      logError(appError);
      throw appError;
    }

    if (data === null) {
      throw new AppError({
        operationName,
        requestId,
        code: 'NOT_FOUND_ERROR',
        message: 'No data returned',
        retryable: false,
      });
    }

    return { data, requestId };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    const appError = new AppError({
      operationName,
      requestId,
      code: 'UNKNOWN_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error',
      retryable: false,
      originalError: error,
    });
    logError(appError);
    throw appError;
  }
}

async function executeSupabaseQueryOptional<T>(
  operationName: string,
  queryFn: () => PromiseLike<SupabaseResult<T>>
): Promise<{ data: T | null; requestId: string }> {
  const requestId = generateRequestId();
  const startTime = Date.now();

  try {
    const result = await queryFn();
    const { data, error } = result;

    const duration = Date.now() - startTime;
    if (__DEV__) {
      console.log(`[Supabase] ${operationName} ${error ? 'ERROR' : 'OK'} (${duration}ms) [${requestId}]`);
    }

    if (error) {
      if (error.code === 'PGRST116') {
        return { data: null, requestId };
      }
      const appError = normalizeSupabaseError(error, operationName, requestId);
      logError(appError);
      throw appError;
    }

    return { data, requestId };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    const appError = new AppError({
      operationName,
      requestId,
      code: 'UNKNOWN_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error',
      retryable: false,
      originalError: error,
    });
    logError(appError);
    throw appError;
  }
}

async function executeSupabaseMutation<T>(
  operationName: string,
  mutationFn: () => PromiseLike<SupabaseResult<T>>
): Promise<{ data: T | null; requestId: string }> {
  const requestId = generateRequestId();
  const startTime = Date.now();

  try {
    const result = await mutationFn();
    const { data, error } = result;

    const duration = Date.now() - startTime;
    if (__DEV__) {
      console.log(`[Supabase] ${operationName} ${error ? 'ERROR' : 'OK'} (${duration}ms) [${requestId}]`);
    }

    if (error) {
      const appError = normalizeSupabaseError(error, operationName, requestId);
      logError(appError);
      throw appError;
    }

    return { data, requestId };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    const appError = new AppError({
      operationName,
      requestId,
      code: 'UNKNOWN_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error',
      retryable: false,
      originalError: error,
    });
    logError(appError);
    throw appError;
  }
}

export const profileOperations = {
  async getById(profileId: string): Promise<OperationResult<Profile>> {
    return executeSupabaseQuery('profiles.getById', async () =>
      supabase.from('profiles').select('*').eq('id', profileId).single()
    );
  },

  async getByIdOptional(profileId: string): Promise<{ data: Profile | null; requestId: string }> {
    return executeSupabaseQueryOptional('profiles.getByIdOptional', async () =>
      supabase.from('profiles').select('*').eq('id', profileId).single()
    );
  },

  async getByFamilyId(familyId: string): Promise<OperationResult<Profile[]>> {
    return executeSupabaseQuery('profiles.getByFamilyId', async () =>
      supabase.from('profiles').select('*').eq('family_id', familyId)
    );
  },

  async getByPasscode(passcode: string): Promise<{ data: Profile | null; requestId: string }> {
    return executeSupabaseQueryOptional('profiles.getByPasscode', async () =>
      supabase.from('profiles').select('*').eq('passcode', passcode).single()
    );
  },

  async create(profile: Partial<Profile>): Promise<{ data: Profile | null; requestId: string }> {
    return executeSupabaseMutation('profiles.create', async () =>
      supabase.from('profiles').insert(profile).select().single()
    );
  },

  async update(profileId: string, updates: Partial<Profile>): Promise<{ data: Profile | null; requestId: string }> {
    return executeSupabaseMutation('profiles.update', async () =>
      supabase.from('profiles').update(updates).eq('id', profileId).select().single()
    );
  },

  async updatePushToken(profileId: string, pushToken: string): Promise<{ data: null; requestId: string }> {
    return executeSupabaseMutation('profiles.updatePushToken', async () =>
      supabase.from('profiles').update({ push_token: pushToken }).eq('id', profileId)
    );
  },

  async getPushTokensForFamily(familyId: string): Promise<OperationResult<Array<{ id: string; push_token: string | null; role: string }>>> {
    return executeSupabaseQuery('profiles.getPushTokensForFamily', async () =>
      supabase.from('profiles').select('id, push_token, role').eq('family_id', familyId).not('push_token', 'is', null)
    );
  },
};

export const familyOperations = {
  async getById(familyId: string): Promise<OperationResult<Family>> {
    return executeSupabaseQuery('families.getById', async () =>
      supabase.from('families').select('*').eq('id', familyId).single()
    );
  },

  async getByInviteCode(inviteCode: string): Promise<{ data: Family | null; requestId: string }> {
    return executeSupabaseQueryOptional('families.getByInviteCode', async () =>
      supabase.from('families').select('*').eq('invite_code', inviteCode.toLowerCase()).single()
    );
  },

  async create(family: Partial<Family>): Promise<{ data: Family | null; requestId: string }> {
    return executeSupabaseMutation('families.create', async () =>
      supabase.from('families').insert(family).select().single()
    );
  },

  async update(familyId: string, updates: Partial<Family>): Promise<{ data: Family | null; requestId: string }> {
    return executeSupabaseMutation('families.update', async () =>
      supabase.from('families').update(updates).eq('id', familyId).select().single()
    );
  },
};

export const taskOperations = {
  async getByFamilyId(familyId: string): Promise<OperationResult<Task[]>> {
    return executeSupabaseQuery('tasks.getByFamilyId', async () =>
      supabase.from('tasks').select('*').eq('family_id', familyId)
    );
  },

  async create(task: Partial<Task>): Promise<{ data: Task | null; requestId: string }> {
    return executeSupabaseMutation('tasks.create', async () =>
      supabase.from('tasks').insert(task).select().single()
    );
  },

  async createMany(tasks: Partial<Task>[]): Promise<{ data: Task[] | null; requestId: string }> {
    return executeSupabaseMutation('tasks.createMany', async () =>
      supabase.from('tasks').insert(tasks).select()
    );
  },

  async update(taskId: string, updates: Partial<Task>): Promise<{ data: Task | null; requestId: string }> {
    return executeSupabaseMutation('tasks.update', async () =>
      supabase.from('tasks').update(updates).eq('id', taskId).select().single()
    );
  },

  async upsert(task: Partial<Task>): Promise<{ data: Task | null; requestId: string }> {
    return executeSupabaseMutation('tasks.upsert', async () =>
      supabase.from('tasks').upsert(task).select().single()
    );
  },

  async archive(taskId: string): Promise<{ data: null; requestId: string }> {
    return executeSupabaseMutation('tasks.archive', async () =>
      supabase.from('tasks').update({ is_archived: true }).eq('id', taskId)
    );
  },
};

export const taskInstanceOperations = {
  async getByFamilyId(familyId: string): Promise<OperationResult<TaskInstance[]>> {
    return executeSupabaseQuery('taskInstances.getByFamilyId', async () =>
      supabase.from('task_instances').select('*').eq('family_id', familyId)
    );
  },

  async getById(instanceId: string): Promise<OperationResult<TaskInstance>> {
    return executeSupabaseQuery('taskInstances.getById', async () =>
      supabase.from('task_instances').select('*').eq('id', instanceId).single()
    );
  },

  async create(instance: Partial<TaskInstance>): Promise<{ data: TaskInstance | null; requestId: string }> {
    return executeSupabaseMutation('taskInstances.create', async () =>
      supabase.from('task_instances').insert(instance).select().single()
    );
  },

  async update(instanceId: string, updates: Partial<TaskInstance>): Promise<{ data: TaskInstance | null; requestId: string }> {
    return executeSupabaseMutation('taskInstances.update', async () =>
      supabase.from('task_instances').update(updates).eq('id', instanceId).select().single()
    );
  },

  async requestCompletion(instanceId: string, requestedById: string): Promise<{ data: TaskInstance | null; requestId: string }> {
    return executeSupabaseMutation('taskInstances.requestCompletion', async () =>
      supabase
        .from('task_instances')
        .update({
          status: 'pending_approval',
          completion_requested_by: requestedById,
          completion_requested_at: new Date().toISOString(),
        })
        .eq('id', instanceId)
        .select()
        .single()
    );
  },

  async approve(instanceId: string): Promise<{ data: TaskInstance | null; requestId: string }> {
    return executeSupabaseMutation('taskInstances.approve', async () =>
      supabase
        .from('task_instances')
        .update({
          status: 'approved',
          completed_at: new Date().toISOString(),
          completion_requested_by: null,
          completion_requested_at: null,
        })
        .eq('id', instanceId)
        .eq('status', 'pending_approval')
        .select()
        .single()
    );
  },

  async reject(instanceId: string): Promise<{ data: TaskInstance | null; requestId: string }> {
    return executeSupabaseMutation('taskInstances.reject', async () =>
      supabase
        .from('task_instances')
        .update({
          status: 'rejected',
          completion_requested_by: null,
          completion_requested_at: null,
        })
        .eq('id', instanceId)
        .select()
        .single()
    );
  },
};

export const starsLedgerOperations = {
  async getByFamilyId(familyId: string): Promise<OperationResult<StarsLedgerEntry[]>> {
    return executeSupabaseQuery('starsLedger.getByFamilyId', async () =>
      supabase.from('stars_ledger').select('*').eq('family_id', familyId)
    );
  },

  async create(entry: Partial<StarsLedgerEntry>): Promise<{ data: StarsLedgerEntry | null; requestId: string }> {
    return executeSupabaseMutation('starsLedger.create', async () =>
      supabase.from('stars_ledger').insert(entry).select().single()
    );
  },
};

export const rewardOperations = {
  async getByFamilyId(familyId: string): Promise<OperationResult<Reward[]>> {
    return executeSupabaseQuery('rewards.getByFamilyId', async () =>
      supabase.from('rewards').select('*').eq('family_id', familyId)
    );
  },

  async create(reward: Partial<Reward>): Promise<{ data: Reward | null; requestId: string }> {
    return executeSupabaseMutation('rewards.create', async () =>
      supabase.from('rewards').insert(reward).select().single()
    );
  },

  async update(rewardId: string, updates: Partial<Reward>): Promise<{ data: Reward | null; requestId: string }> {
    return executeSupabaseMutation('rewards.update', async () =>
      supabase.from('rewards').update(updates).eq('id', rewardId).select().single()
    );
  },
};

export const joinRequestOperations = {
  async getByFamilyId(familyId: string): Promise<OperationResult<JoinRequest[]>> {
    return executeSupabaseQuery('joinRequests.getByFamilyId', async () =>
      supabase.from('join_requests').select('*').eq('family_id', familyId)
    );
  },

  async getPendingByFamilyId(familyId: string): Promise<OperationResult<JoinRequest[]>> {
    return executeSupabaseQuery('joinRequests.getPendingByFamilyId', async () =>
      supabase.from('join_requests').select('*').eq('family_id', familyId).eq('status', 'pending')
    );
  },

  async getPendingByRequesterId(requesterId: string): Promise<{ data: JoinRequest | null; requestId: string }> {
    return executeSupabaseQueryOptional('joinRequests.getPendingByRequesterId', async () =>
      supabase.from('join_requests').select('*').eq('requester_profile_id', requesterId).eq('status', 'pending').single()
    );
  },

  async create(request: Partial<JoinRequest>): Promise<{ data: JoinRequest | null; requestId: string }> {
    return executeSupabaseMutation('joinRequests.create', async () =>
      supabase.from('join_requests').insert(request).select().single()
    );
  },

  async approve(requestId: string, reviewerId: string): Promise<{ data: JoinRequest | null; requestId: string }> {
    return executeSupabaseMutation('joinRequests.approve', async () =>
      supabase
        .from('join_requests')
        .update({
          status: 'approved',
          reviewed_by_profile_id: reviewerId,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .select()
        .single()
    );
  },

  async reject(requestId: string, reviewerId: string): Promise<{ data: JoinRequest | null; requestId: string }> {
    return executeSupabaseMutation('joinRequests.reject', async () =>
      supabase
        .from('join_requests')
        .update({
          status: 'rejected',
          reviewed_by_profile_id: reviewerId,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .select()
        .single()
    );
  },

  async cancel(requestId: string): Promise<{ data: null; requestId: string }> {
    return executeSupabaseMutation('joinRequests.cancel', async () =>
      supabase.from('join_requests').delete().eq('id', requestId)
    );
  },
};

export const taskApprovalOperations = {
  async create(approval: { task_instance_id: string; approver_profile_id: string; decision: 'approved' | 'rejected'; reason?: string }): Promise<{ data: unknown; requestId: string }> {
    return executeSupabaseMutation('taskApprovals.create', async () =>
      supabase.from('task_approvals').insert(approval).select().single()
    );
  },
};

export async function fetchFamilyDataBatch(familyId: string): Promise<{
  data: {
    profiles: Profile[];
    tasks: Task[];
    taskInstances: TaskInstance[];
    starsLedger: StarsLedgerEntry[];
    rewards: Reward[];
    family: Family | null;
  };
  requestId: string;
}> {
  const requestId = generateRequestId();
  const startTime = Date.now();

  try {
    const [profilesResult, tasksResult, instancesResult, ledgerResult, rewardsResult, familyResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('family_id', familyId),
      supabase.from('tasks').select('*').eq('family_id', familyId),
      supabase.from('task_instances').select('*').eq('family_id', familyId),
      supabase.from('stars_ledger').select('*').eq('family_id', familyId),
      supabase.from('rewards').select('*').eq('family_id', familyId),
      supabase.from('families').select('*').eq('id', familyId).single(),
    ]);

    const duration = Date.now() - startTime;
    if (__DEV__) {
      console.log(`[Supabase] fetchFamilyDataBatch OK (${duration}ms) [${requestId}]`);
    }

    const errors = [
      profilesResult.error,
      tasksResult.error,
      instancesResult.error,
      ledgerResult.error,
      rewardsResult.error,
      familyResult.error && familyResult.error.code !== 'PGRST116' ? familyResult.error : null,
    ].filter(Boolean);

    if (errors.length > 0) {
      const firstError = errors[0]!;
      const appError = normalizeSupabaseError(firstError, 'fetchFamilyDataBatch', requestId);
      logError(appError);
      throw appError;
    }

    return {
      data: {
        profiles: (profilesResult.data || []) as Profile[],
        tasks: (tasksResult.data || []) as Task[],
        taskInstances: (instancesResult.data || []) as TaskInstance[],
        starsLedger: (ledgerResult.data || []) as StarsLedgerEntry[],
        rewards: (rewardsResult.data || []) as Reward[],
        family: familyResult.data as Family | null,
      },
      requestId,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    const appError = new AppError({
      operationName: 'fetchFamilyDataBatch',
      requestId,
      code: 'UNKNOWN_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error',
      retryable: false,
      originalError: error,
    });
    logError(appError);
    throw appError;
  }
}

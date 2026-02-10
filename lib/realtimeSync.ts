import { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient, TaskInstance as CloudTaskInstance, Task, Profile } from './supabase';
import { useStore } from './store';
import { cloudInstanceToLocal, taskToTemplate } from './cloudSync';
import { PowerKey } from './types';

let taskInstancesChannel: RealtimeChannel | null = null;
let tasksChannel: RealtimeChannel | null = null;
let profilesChannel: RealtimeChannel | null = null;
let starsLedgerChannel: RealtimeChannel | null = null;

/**
 * Setup real-time subscriptions for family data
 * Automatically syncs changes to task instances, tasks, profiles, and stars
 */
export function setupRealtimeSubscriptions(familyId: string, currentUserId: string): () => void {
  console.log('[Realtime] Setting up subscriptions for family:', familyId);
  
  const client = getSupabaseClient();
  if (!client) {
    console.warn('[Realtime] Supabase client not available, skipping subscriptions');
    return () => {};
  }

  // Subscribe to task_instances changes
  taskInstancesChannel = client
    .channel(`task_instances:${familyId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'task_instances',
        filter: `family_id=eq.${familyId}`
      },
      (payload: any) => {
        console.log('[Realtime] task_instances change:', payload.eventType, payload.new?.id);
        
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const cloudInstance = payload.new as CloudTaskInstance;
          const localInstance = cloudInstanceToLocal(cloudInstance);
          
          if (payload.eventType === 'INSERT') {
            // New task instance - add to store
            useStore.getState().addTaskInstanceFromCloud(localInstance);
            console.log('[Realtime] Added new task instance:', localInstance.id);
          } else {
            // Updated task instance - update in store
            useStore.getState().updateTaskInstance(localInstance.id, localInstance);
            console.log('[Realtime] Updated task instance:', localInstance.id, 'status:', localInstance.status);
          }
        } else if (payload.eventType === 'DELETE') {
          // Task instance deleted - remove from store
          const deletedId = payload.old?.id;
          if (deletedId) {
            const instances = useStore.getState().taskInstances.filter(i => i.id !== deletedId);
            useStore.getState().setTaskInstancesFromCloud(instances);
            console.log('[Realtime] Deleted task instance:', deletedId);
          }
        }
      }
    )
    .subscribe((status: string) => {
      console.log('[Realtime] task_instances subscription status:', status);
    });

  // Subscribe to tasks (templates) changes
  tasksChannel = client
    .channel(`tasks:${familyId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'tasks',
        filter: `family_id=eq.${familyId}`
      },
      (payload: any) => {
        console.log('[Realtime] tasks change:', payload.eventType, payload.new?.id);
        
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const cloudTask = payload.new as Task;
          const template = taskToTemplate(cloudTask);
          
          const currentTemplates = useStore.getState().taskTemplates;
          const existingIndex = currentTemplates.findIndex(t => t.id === template.id);
          
          if (existingIndex >= 0) {
            // Update existing template
            const updatedTemplates = [...currentTemplates];
            updatedTemplates[existingIndex] = template;
            useStore.getState().setTaskTemplatesFromCloud(updatedTemplates);
            console.log('[Realtime] Updated task template:', template.id);
          } else {
            // Add new template
            useStore.getState().setTaskTemplatesFromCloud([...currentTemplates, template]);
            console.log('[Realtime] Added new task template:', template.id);
          }
        } else if (payload.eventType === 'DELETE') {
          // Task deleted - remove from store
          const deletedId = payload.old?.id;
          if (deletedId) {
            const templates = useStore.getState().taskTemplates.filter(t => t.id !== deletedId);
            useStore.getState().setTaskTemplatesFromCloud(templates);
            console.log('[Realtime] Deleted task template:', deletedId);
          }
        }
      }
    )
    .subscribe((status: string) => {
      console.log('[Realtime] tasks subscription status:', status);
    });

  // Subscribe to profiles (members) changes
  profilesChannel = client
    .channel(`profiles:${familyId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'profiles',
        filter: `family_id=eq.${familyId}`
      },
      async (payload: any) => {
        console.log('[Realtime] profiles change:', payload.eventType, payload.new?.id);
        
        // When profiles change, we need to recalculate stars from ledger
        // Fetch the latest stars ledger for this family
        const { data: starsLedger } = await client
          .from('stars_ledger')
          .select('*')
          .eq('family_id', familyId);
        
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const profile = payload.new as Profile;
          
          // Calculate total stars for this profile
          const starsTotal = (starsLedger || [])
            .filter((e: any) => e.profile_id === profile.id)
            .reduce((sum: number, e: any) => sum + e.delta, 0);
          
          const member = {
            id: profile.id,
            name: profile.display_name || '',
            role: (profile.role === 'kid' ? 'kid' : 'guardian') as 'kid' | 'guardian',
            age: profile.age || 0,
            starsTotal,
            powers: (profile.powers || []).map((key: string) => ({
              powerKey: key as PowerKey,
              level: 1,
              xp: 0
            })),
            profileId: profile.id,
            passcode: profile.passcode || undefined,
            avatar: profile.avatar || undefined,
          };
          
          const currentMembers = useStore.getState().members;
          const existingIndex = currentMembers.findIndex(m => m.id === member.id);
          
          if (existingIndex >= 0) {
            // Update existing member
            const updatedMembers = [...currentMembers];
            updatedMembers[existingIndex] = member;
            useStore.getState().setMembersFromCloud(updatedMembers);
            console.log('[Realtime] Updated member:', member.name);
          } else {
            // Add new member
            useStore.getState().setMembersFromCloud([...currentMembers, member]);
            console.log('[Realtime] Added new member:', member.name);
          }
        } else if (payload.eventType === 'DELETE') {
          // Member removed from family
          const deletedId = payload.old?.id;
          if (deletedId) {
            const members = useStore.getState().members.filter(m => m.id !== deletedId);
            useStore.getState().setMembersFromCloud(members);
            console.log('[Realtime] Removed member:', deletedId);
          }
        }
      }
    )
    .subscribe((status: string) => {
      console.log('[Realtime] profiles subscription status:', status);
    });

  // Subscribe to stars_ledger changes to update member stars in real-time
  starsLedgerChannel = client
    .channel(`stars_ledger:${familyId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'stars_ledger',
        filter: `family_id=eq.${familyId}`
      },
      async (payload: any) => {
        console.log('[Realtime] stars_ledger change:', payload.new);
        
        const entry = payload.new as any;
        const profileId = entry.profile_id;
        
        // Recalculate total stars for this profile
        const { data: starsLedger } = await client
          .from('stars_ledger')
          .select('*')
          .eq('family_id', familyId)
          .eq('profile_id', profileId);
        
        const newTotal = (starsLedger || []).reduce((sum: number, e: any) => sum + e.delta, 0);
        
        // Update member's star total
        const currentMembers = useStore.getState().members;
        const memberIndex = currentMembers.findIndex(m => m.id === profileId);
        
        if (memberIndex >= 0) {
          const updatedMembers = [...currentMembers];
          updatedMembers[memberIndex] = {
            ...updatedMembers[memberIndex],
            starsTotal: newTotal
          };
          useStore.getState().setMembersFromCloud(updatedMembers);
          console.log('[Realtime] Updated stars for member:', profileId, 'new total:', newTotal);
        }
      }
    )
    .subscribe((status: string) => {
      console.log('[Realtime] stars_ledger subscription status:', status);
    });

  // Return cleanup function
  return () => {
    console.log('[Realtime] Cleaning up subscriptions');
    if (taskInstancesChannel) {
      client.removeChannel(taskInstancesChannel);
      taskInstancesChannel = null;
    }
    if (tasksChannel) {
      client.removeChannel(tasksChannel);
      tasksChannel = null;
    }
    if (profilesChannel) {
      client.removeChannel(profilesChannel);
      profilesChannel = null;
    }
    if (starsLedgerChannel) {
      client.removeChannel(starsLedgerChannel);
      starsLedgerChannel = null;
    }
  };
}

/**
 * Cleanup all real-time subscriptions
 */
export function cleanupRealtimeSubscriptions() {
  console.log('[Realtime] Manual cleanup requested');
  const client = getSupabaseClient();
  if (!client) return;
  
  if (taskInstancesChannel) {
    client.removeChannel(taskInstancesChannel);
    taskInstancesChannel = null;
  }
  if (tasksChannel) {
    client.removeChannel(tasksChannel);
    tasksChannel = null;
  }
  if (profilesChannel) {
    client.removeChannel(profilesChannel);
    profilesChannel = null;
  }
  if (starsLedgerChannel) {
    client.removeChannel(starsLedgerChannel);
    starsLedgerChannel = null;
  }
}

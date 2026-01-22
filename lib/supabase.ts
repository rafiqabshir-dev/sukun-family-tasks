import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import Constants from 'expo-constants';

const supabaseUrl = 
  Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL || 
  process.env.EXPO_PUBLIC_SUPABASE_URL || 
  Constants.expoConfig?.extra?.SUPABASE_URL ||
  process.env.SUPABASE_URL || 
  '';
const supabaseAnonKey = 
  Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY || 
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 
  Constants.expoConfig?.extra?.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY || 
  '';

export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey && supabaseUrl.includes('supabase'));
}

const ExpoSecureStoreAdapter = {
  getItem: async (key: string) => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return await AsyncStorage.getItem(key);
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      await AsyncStorage.setItem(key, value);
    }
  },
  removeItem: async (key: string) => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      await AsyncStorage.removeItem(key);
    }
  },
};

let _supabaseClient: SupabaseClient | null = null;

function createSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

export function getSupabaseClient(): SupabaseClient | null {
  if (_supabaseClient === null && isSupabaseConfigured()) {
    _supabaseClient = createSupabaseClient();
  }
  return _supabaseClient;
}

export const supabase = {
  get client() {
    return getSupabaseClient();
  },
  from(table: string) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase not configured');
    return client.from(table);
  },
  get auth() {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase not configured');
    return client.auth;
  },
  rpc(fn: string, params?: Record<string, any>) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase not configured');
    return client.rpc(fn, params);
  }
};

export type Profile = {
  id: string;
  family_id: string | null;
  role: 'guardian' | 'kid';
  display_name: string;
  age: number | null;
  powers: string[];
  requires_login: boolean;
  passcode: string | null;
  push_token: string | null;
  avatar: string | null;
  created_at: string;
};

export type Family = {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
};

export type Task = {
  id: string;
  family_id: string;
  title: string;
  category: string;
  icon_key: string;
  default_stars: number;
  difficulty: string;
  preferred_powers: string[];
  min_age: number | null;
  max_age: number | null;
  is_archived: boolean;
  enabled: boolean;
  schedule_type: 'one_time' | 'recurring_daily' | 'time_sensitive' | null;
  time_window_minutes: number | null;
  tags: string[];
  created_at: string;
};

export type TaskInstance = {
  id: string;
  family_id: string;
  task_id: string;
  assignee_profile_id: string;
  created_by_profile_id: string;
  status: 'open' | 'pending_approval' | 'approved' | 'rejected' | 'expired';
  due_at: string | null;
  expires_at: string | null;
  schedule_type: 'one_time' | 'recurring_daily' | 'time_sensitive' | null;
  created_at: string;
  completed_at: string | null;
  completion_requested_by: string | null;
  completion_requested_at: string | null;
};

export type StarsLedgerEntry = {
  id: string;
  family_id: string;
  profile_id: string;
  delta: number;
  reason: string;
  task_instance_id: string | null;
  created_by_profile_id: string;
  created_at: string;
};

export type JoinRequest = {
  id: string;
  family_id: string;
  requester_profile_id: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by_profile_id: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type Reward = {
  id: string;
  family_id: string;
  name: string;
  description: string | null;
  star_cost: number;
  is_active: boolean;
  created_at: string;
};

export type RewardClaim = {
  id: string;
  reward_id: string;
  profile_id: string;
  granted_by_profile_id: string;
  star_cost: number;
  created_at: string;
};

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type Profile = {
  id: string;
  family_id: string | null;
  role: 'guardian' | 'kid';
  display_name: string;
  age: number | null;
  powers: string[];
  requires_login: boolean;
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
  created_at: string;
};

export type TaskInstance = {
  id: string;
  family_id: string;
  task_id: string;
  assignee_profile_id: string;
  created_by_profile_id: string;
  status: 'open' | 'pending_approval' | 'approved' | 'rejected';
  due_at: string | null;
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

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, Profile, Family, isSupabaseConfigured } from './supabase';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  family: Family | null;
  loading: boolean;
  isConfigured: boolean;
  signUp: (email: string, password: string, displayName: string, role: 'guardian' | 'kid') => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  createFamily: (familyName: string, onProgress?: (step: string) => void) => Promise<{ error: Error | null; family: Family | null }>;
  joinFamily: (inviteCode: string) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper function to create profile if it doesn't exist
async function ensureProfileExistsInternal(user: User): Promise<void> {
  // Check if profile already exists
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single();

  if (existingProfile) return;

  // Create profile from user metadata
  const metadata = user.user_metadata || {};
  const displayName = metadata.display_name || user.email?.split('@')[0] || 'User';
  const role = metadata.role || 'guardian';

  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      display_name: displayName,
      role: role,
      requires_login: true,
      powers: [],
    });

  if (profileError) {
    console.error('Error creating profile:', profileError);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      console.log('Supabase not configured, skipping auth');
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        try {
          await ensureProfileExistsInternal(session.user);
        } catch (error) {
          console.error('Error ensuring profile on initial load:', error);
        }
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    }).catch((error) => {
      console.error('Error getting session:', error);
      setLoading(false);
    });

    // Safety timeout - ensure loading ends after 10 seconds max
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 10000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        try {
          // Ensure profile exists before fetching (handles email confirmation flow)
          await ensureProfileExistsInternal(session.user);
        } catch (error) {
          console.error('Error ensuring profile exists:', error);
        }
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setFamily(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function fetchProfile(userId: string) {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error fetching profile:', profileError);
      }

      if (profileData) {
        setProfile(profileData as Profile);

        if (profileData.family_id) {
          const { data: familyData, error: familyError } = await supabase
            .from('families')
            .select('*')
            .eq('id', profileData.family_id)
            .single();

          if (familyError) {
            console.error('Error fetching family:', familyError);
            setFamily(null);
          } else {
            setFamily(familyData as Family);
          }
        } else {
          setFamily(null);
        }
      } else {
        setProfile(null);
        setFamily(null);
      }
    } catch (error) {
      console.error('Error in fetchProfile:', error);
    } finally {
      setLoading(false);
    }
  }

  async function refreshProfile() {
    if (user) {
      await fetchProfile(user.id);
    }
  }

  async function signUp(
    email: string,
    password: string,
    displayName: string,
    role: 'guardian' | 'kid'
  ): Promise<{ error: Error | null }> {
    try {
      console.log('[signUp] Starting signup for:', email);
      
      // Add timeout to signup call
      const signUpPromise = supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
            role: role,
          }
        }
      });
      
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Signup timeout after 15s')), 15000)
      );
      
      const { data, error } = await Promise.race([signUpPromise, timeoutPromise]) as any;

      console.log('[signUp] Response:', { data: !!data, error: error?.message });

      if (error) return { error };

      // If session is immediately available (email confirmation disabled),
      // try to create the profile now
      if (data.session && data.user) {
        console.log('[signUp] Session available, creating profile...');
        await ensureProfileExistsInternal(data.user);
      }

      console.log('[signUp] Complete');
      return { error: null };
    } catch (error: any) {
      console.error('[signUp] Exception:', error?.message);
      return { error: error as Error };
    }
  }

  async function signIn(email: string, password: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error: error ? new Error(error.message) : null };
    } catch (error) {
      return { error: error as Error };
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setFamily(null);
  }

  async function createFamily(familyName: string, onProgress?: (step: string) => void): Promise<{ error: Error | null; family: Family | null }> {
    const log = (msg: string) => {
      console.log('[createFamily] ' + msg);
      try {
        onProgress?.(msg);
      } catch (e) {
        console.error('[createFamily] onProgress error:', e);
      }
    };
    
    // Immediate sync log before any async
    log('Started');
    
    try {
      log('Step 1: Inserting...');
      
      // Add timeout to the insert call
      const insertPromise = supabase
        .from('families')
        .insert({ name: familyName })
        .select()
        .single();
      
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Insert timeout after 10s')), 10000)
      );
      
      const { data: familyData, error: familyError } = await Promise.race([insertPromise, timeoutPromise]) as any;

      log('Step 1 done: ' + (familyError ? familyError.message : 'OK'));

      if (familyError) {
        return { error: new Error(familyError.message), family: null };
      }

      if (user && familyData) {
        log('Step 2: Updating profile...');
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ family_id: familyData.id })
          .eq('id', user.id);

        log('Step 2 done: ' + (updateError ? updateError.message : 'OK'));

        if (updateError) {
          return { error: new Error(updateError.message), family: null };
        }

        setFamily(familyData as Family);
        
        log('Step 3: Refreshing...');
        const refreshPromise = refreshProfile();
        const refreshTimeout = new Promise<void>((resolve) => setTimeout(resolve, 5000));
        await Promise.race([refreshPromise, refreshTimeout]);
        log('Step 3 done');
      }

      return { error: null, family: familyData as Family };
    } catch (error: any) {
      log('Error: ' + (error?.message || 'unknown'));
      return { error: error as Error, family: null };
    }
  }

  async function joinFamily(inviteCode: string): Promise<{ error: Error | null }> {
    try {
      const { data: familyData, error: familyError } = await supabase
        .from('families')
        .select('*')
        .eq('invite_code', inviteCode.toLowerCase())
        .single();

      if (familyError || !familyData) {
        return { error: new Error('Invalid invite code') };
      }

      if (user) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ family_id: familyData.id })
          .eq('id', user.id);

        if (updateError) {
          return { error: new Error(updateError.message) };
        }

        setFamily(familyData as Family);
        await refreshProfile();
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        family,
        loading,
        isConfigured: isSupabaseConfigured(),
        signUp,
        signIn,
        signOut,
        createFamily,
        joinFamily,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

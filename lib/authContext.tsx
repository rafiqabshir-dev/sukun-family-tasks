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
  createFamily: (familyName: string) => Promise<{ error: Error | null; family: Family | null }>;
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
      // Sign up with user metadata - profile will be created on first sign-in
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
            role: role,
          }
        }
      });

      if (error) return { error };

      // If session is immediately available (email confirmation disabled),
      // try to create the profile now
      if (data.session && data.user) {
        await ensureProfileExistsInternal(data.user);
      }

      return { error: null };
    } catch (error) {
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

  async function createFamily(familyName: string): Promise<{ error: Error | null; family: Family | null }> {
    try {
      const { data: familyData, error: familyError } = await supabase
        .from('families')
        .insert({ name: familyName })
        .select()
        .single();

      if (familyError) {
        return { error: new Error(familyError.message), family: null };
      }

      if (user && familyData) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ family_id: familyData.id })
          .eq('id', user.id);

        if (updateError) {
          return { error: new Error(updateError.message), family: null };
        }

        setFamily(familyData as Family);
        await refreshProfile();
      }

      return { error: null, family: familyData as Family };
    } catch (error) {
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

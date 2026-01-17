import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
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

const AUTH_TIMEOUT_MS = 8000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [loading, setLoading] = useState(true);
  
  const authInProgress = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    
    if (!isSupabaseConfigured()) {
      console.log('[Auth] Supabase not configured');
      setLoading(false);
      return;
    }

    async function clearAuthState(reason: string) {
      console.log('[Auth] Clearing state:', reason);
      try {
        await supabase.auth.signOut();
      } catch (e) {}
      if (mounted.current) {
        setSession(null);
        setUser(null);
        setProfile(null);
        setFamily(null);
        setLoading(false);
      }
      authInProgress.current = false;
    }

    async function validateSession(currentSession: Session): Promise<boolean> {
      const currentUser = currentSession.user;
      console.log('[Auth] Validating:', currentUser.id.slice(0, 8));

      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('timeout')), AUTH_TIMEOUT_MS);
        });

        const validationPromise = (async () => {
          const { data: existingProfile, error: checkError } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', currentUser.id)
            .single();

          if (checkError && checkError.code !== 'PGRST116') {
            throw new Error(checkError.message);
          }

          if (!existingProfile) {
            console.log('[Auth] Creating profile...');
            const metadata = currentUser.user_metadata || {};
            const displayName = metadata.display_name || currentUser.email?.split('@')[0] || 'User';
            const role = metadata.role || 'guardian';

            const { error: insertError } = await supabase
              .from('profiles')
              .insert({
                id: currentUser.id,
                display_name: displayName,
                role: role,
                requires_login: true,
                powers: [],
              });

            if (insertError) throw new Error(insertError.message);
          }

          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

          if (profileError || !profileData) {
            throw new Error(profileError?.message || 'Profile not found');
          }

          return profileData;
        })();

        const profileData = await Promise.race([validationPromise, timeoutPromise]);

        console.log('[Auth] Valid:', profileData.display_name);
        if (mounted.current) {
          setProfile(profileData as Profile);

          if (profileData.family_id) {
            const { data: familyData } = await supabase
              .from('families')
              .select('*')
              .eq('id', profileData.family_id)
              .single();

            if (familyData && mounted.current) {
              setFamily(familyData as Family);
            }
          }
        }

        return true;
      } catch (error: any) {
        console.log('[Auth] Validation failed:', error?.message);
        return false;
      }
    }

    async function initializeAuth() {
      if (authInProgress.current) {
        console.log('[Auth] Init already running');
        return;
      }
      authInProgress.current = true;
      console.log('[Auth] Init start');

      try {
        const getSessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('getSession timeout')), 5000);
        });

        let sessionResult;
        try {
          sessionResult = await Promise.race([getSessionPromise, timeoutPromise]);
        } catch (e: any) {
          console.log('[Auth] getSession failed:', e?.message);
          await clearAuthState('getSession timeout');
          return;
        }

        const { data: { session: currentSession }, error: sessionError } = sessionResult;

        if (sessionError) {
          console.log('[Auth] Session error:', sessionError.message);
          await clearAuthState('session error');
          return;
        }

        if (!currentSession?.user) {
          console.log('[Auth] No session');
          if (mounted.current) {
            setSession(null);
            setUser(null);
            setLoading(false);
          }
          authInProgress.current = false;
          return;
        }

        if (mounted.current) {
          setSession(currentSession);
          setUser(currentSession.user);
        }

        const isValid = await validateSession(currentSession);

        if (!isValid) {
          await clearAuthState('validation failed');
          return;
        }

        console.log('[Auth] Init complete');
        if (mounted.current) setLoading(false);
        authInProgress.current = false;

      } catch (error: any) {
        console.log('[Auth] Init error:', error?.message);
        await clearAuthState('exception');
      }
    }

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log('[Auth] Event:', event);

      if (event === 'INITIAL_SESSION') return;

      if (event === 'SIGNED_OUT' || !newSession) {
        if (mounted.current) {
          setSession(null);
          setUser(null);
          setProfile(null);
          setFamily(null);
          setLoading(false);
        }
        authInProgress.current = false;
        return;
      }

      if (event === 'SIGNED_IN' && newSession?.user) {
        if (authInProgress.current) {
          console.log('[Auth] Event during init');
          if (mounted.current) {
            setSession(newSession);
            setUser(newSession.user);
          }
          return;
        }

        authInProgress.current = true;
        if (mounted.current) {
          setLoading(true);
          setSession(newSession);
          setUser(newSession.user);
        }

        const isValid = await validateSession(newSession);

        if (!isValid) {
          await clearAuthState('sign-in validation failed');
        } else {
          if (mounted.current) setLoading(false);
          authInProgress.current = false;
        }
      }

      if (event === 'TOKEN_REFRESHED' && newSession) {
        if (mounted.current) setSession(newSession);
      }
    });

    return () => {
      mounted.current = false;
      subscription.unsubscribe();
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
      console.log('[signUp] Starting:', email);
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName, role: role }
        }
      });

      if (error) return { error };
      console.log('[signUp] Done');
      return { error: null };
    } catch (error: any) {
      console.error('[signUp] Error:', error?.message);
      return { error: error as Error };
    }
  }

  async function signIn(email: string, password: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
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
      try { onProgress?.(msg); } catch (e) {}
    };
    
    log('Started');
    
    try {
      log('Inserting...');
      
      const insertPromise = supabase
        .from('families')
        .insert({ name: familyName })
        .select('id, name, invite_code, created_at')
        .single();
      
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('timeout')), 15000)
      );
      
      let familyData: any = null;
      let familyError: any = null;
      
      try {
        const result = await Promise.race([insertPromise, timeoutPromise]);
        familyData = result.data;
        familyError = result.error;
      } catch (e: any) {
        familyError = e;
      }

      log('Insert: ' + (familyError ? familyError.message : 'OK'));

      if (familyError) {
        return { error: new Error(familyError.message), family: null };
      }

      if (user && familyData) {
        log('Updating profile...');
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ family_id: familyData.id })
          .eq('id', user.id);

        if (updateError) {
          return { error: new Error(updateError.message), family: null };
        }

        setFamily(familyData as Family);
        await refreshProfile();
        log('Done');
      }

      return { error: null, family: familyData as Family };
    } catch (error: any) {
      log('Error: ' + error?.message);
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
        session, user, profile, family, loading,
        isConfigured: isSupabaseConfigured(),
        signUp, signIn, signOut, createFamily, joinFamily, refreshProfile,
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

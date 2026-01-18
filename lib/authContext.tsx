import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, Profile, Family, JoinRequest, isSupabaseConfigured } from './supabase';
import { useStore } from './store';
import { Persona, derivePersona as derivePersonaFromState, AuthState } from './navigation';

export type JoinRequestWithProfile = JoinRequest & {
  requester_profile?: Profile;
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  family: Family | null;
  loading: boolean;
  authReady: boolean;
  persona: Persona;
  isConfigured: boolean;
  pendingJoinRequest: JoinRequest | null;
  requestedFamily: Family | null;
  pendingRequestsCount: number;
  refreshPendingRequestsCount: () => Promise<void>;
  signUp: (email: string, password: string, displayName: string, role: 'guardian' | 'kid') => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpParticipant: (inviteCode: string, displayName: string) => Promise<{ error: Error | null; passcode: string | null }>;
  signInWithPasscode: (passcode: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  createFamily: (familyName: string, onProgress?: (step: string) => void) => Promise<{ error: Error | null; family: Family | null }>;
  joinFamily: (inviteCode: string) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
  updateProfileName: (newName: string) => Promise<{ error: Error | null }>;
  cancelJoinRequest: () => Promise<{ error: Error | null }>;
  getPendingJoinRequests: () => Promise<JoinRequestWithProfile[]>;
  approveJoinRequest: (requestId: string) => Promise<{ error: Error | null }>;
  rejectJoinRequest: (requestId: string) => Promise<{ error: Error | null }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_TIMEOUT_MS = 8000;

// Test helper - no longer needed but kept for compatibility
export function __resetAuthInitForTesting() {
  // No-op - using instance refs now
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Initialize loading based on store's authReady - if auth already completed, don't show loading
  const storeAuthReady = useStore.getState().authReady;
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [loading, setLoading] = useState(!storeAuthReady);
  const [familyCheckComplete, setFamilyCheckComplete] = useState(storeAuthReady);
  const [pendingJoinRequest, setPendingJoinRequest] = useState<JoinRequest | null>(null);
  const [requestedFamily, setRequestedFamily] = useState<Family | null>(null);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  
  const mounted = useRef(true);
  const initInProgress = useRef(false);

  useEffect(() => {
    mounted.current = true;
    
    if (!isSupabaseConfigured()) {
      console.log('[Auth] Supabase not configured');
      setLoading(false);
      return;
    }

    async function clearAuthState(reason: string, shouldSignOut: boolean = true) {
      console.log('[Auth] Clearing state:', reason);
      // Only sign out if explicitly requested - don't sign out on timeouts
      // because that triggers SIGNED_OUT/SIGNED_IN loop with cached tokens
      if (shouldSignOut) {
        try {
          await supabase.auth.signOut();
        } catch (e) {}
      }
      if (mounted.current) {
        setSession(null);
        setUser(null);
        setProfile(null);
        setFamily(null);
        setLoading(false);
        setFamilyCheckComplete(true);
        useStore.getState().setAuthReady(true);
      }
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
              
              // Load family members directly from cloud (no local merging)
              try {
                const { data: profiles } = await supabase
                  .from('profiles')
                  .select('*')
                  .eq('family_id', profileData.family_id);
                
                const { data: starsLedger } = await supabase
                  .from('stars_ledger')
                  .select('*')
                  .eq('family_id', profileData.family_id);
                
                if (profiles && profiles.length > 0) {
                  // Convert profiles to members - cloud is the only source of truth
                  const members = profiles.map((p: any) => ({
                    id: p.id,
                    name: p.display_name || '',
                    role: (p.role === 'kid' ? 'kid' : 'guardian') as 'kid' | 'guardian',
                    age: p.age || 0,
                    starsTotal: (starsLedger || [])
                      .filter((e: any) => e.profile_id === p.id)
                      .reduce((sum: number, e: any) => sum + e.delta, 0),
                    powers: (p.powers || []).map((key: string) => ({
                      powerKey: key,
                      level: 1,
                      xp: 0
                    })),
                    profileId: p.id,
                  }));
                  
                  // Replace members entirely from cloud - no local merging
                  useStore.getState().setMembersFromCloud(members);
                  console.log('[Auth] Loaded', members.length, 'members from cloud for user', currentUser.id);
                }
              } catch (syncError: any) {
                console.log('[Auth] Member load error:', syncError?.message);
              }
            }
            // Clear any pending request since user is already in a family
            setPendingJoinRequest(null);
            setRequestedFamily(null);
            if (mounted.current) setFamilyCheckComplete(true);
          } else {
            // No family - check for pending join requests
            await checkPendingJoinRequest(currentUser.id);
            if (mounted.current) setFamilyCheckComplete(true);
          }
        }

        return true;
      } catch (error: any) {
        console.log('[Auth] Validation failed:', error?.message);
        return false;
      }
    }

    async function initializeAuth() {
      console.log('[Auth] Init start');
      initInProgress.current = true;
      // Don't reset authReady here - it could be a remount after successful auth
      // Only reset authReady on SIGNED_IN event (actual login) or sign out

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
          // On timeout, try getSession one more time (network might have recovered)
          try {
            const retryResult = await Promise.race([
              supabase.auth.getSession(),
              new Promise<never>((_, reject) => setTimeout(() => reject(new Error('retry timeout')), 3000))
            ]);
            if (retryResult.data.session) {
              console.log('[Auth] Session recovered on retry');
              sessionResult = retryResult;
            } else {
              await clearAuthState('getSession timeout', false);
              initInProgress.current = false;
              return;
            }
          } catch {
            await clearAuthState('getSession timeout after retry', false);
            initInProgress.current = false;
            return;
          }
        }

        const { data: { session: currentSession }, error: sessionError } = sessionResult;
        console.log('[Auth] getSession result - hasSession:', !!currentSession?.user, 'error:', sessionError?.message);

        if (sessionError) {
          console.log('[Auth] Session error:', sessionError.message);
          await clearAuthState('session error');
          initInProgress.current = false;
          return;
        }

        if (!currentSession?.user) {
          console.log('[Auth] No session');
          if (mounted.current) {
            setSession(null);
            setUser(null);
            setLoading(false);
            setFamilyCheckComplete(true);
            useStore.getState().setAuthReady(true);
          }
          initInProgress.current = false;
          return;
        }

        if (mounted.current) {
          setSession(currentSession);
          setUser(currentSession.user);
        }

        const isValid = await validateSession(currentSession);

        if (!isValid) {
          await clearAuthState('validation failed');
          initInProgress.current = false;
          return;
        }

        console.log('[Auth] Init complete');
        if (mounted.current) {
          setLoading(false);
          useStore.getState().setAuthReady(true);
        }
        initInProgress.current = false;

      } catch (error: any) {
        console.log('[Auth] Init error:', error?.message);
        await clearAuthState('exception');
        initInProgress.current = false;
      }
    }

    // Always run init on mount - getSession is idempotent
    // Skip only if another init is currently in progress
    console.log('[Auth] Mount check - inProgress:', initInProgress.current);
    if (!initInProgress.current) {
      initializeAuth();
    } else {
      console.log('[Auth] Init already in progress, waiting...');
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log('[Auth] Event:', event);

      // INITIAL_SESSION fires when subscription is created
      // Since we always run initializeAuth on mount, INITIAL_SESSION is redundant
      // initializeAuth handles session restoration via getSession()
      if (event === 'INITIAL_SESSION') {
        console.log('[Auth] INITIAL_SESSION (handled by init)');
        return;
      }

      if (event === 'SIGNED_OUT' || !newSession) {
        if (mounted.current) {
          setSession(null);
          setUser(null);
          setProfile(null);
          setFamily(null);
          setLoading(false);
          setFamilyCheckComplete(true);
          useStore.getState().setAuthReady(true);
        }
        return;
      }

      if (event === 'SIGNED_IN' && newSession?.user) {
        // Skip SIGNED_IN during initialization - initializeAuth handles it
        if (initInProgress.current) {
          console.log('[Auth] Skipping SIGNED_IN during init');
          return;
        }
        
        console.log('[Auth] SIGNED_IN handler start, mounted:', mounted.current);
        
        // Reset authReady at start of new auth cycle
        useStore.getState().setAuthReady(false);
        
        // Handle new sign-in: update session and validate
        if (mounted.current) {
          setLoading(true);
          setFamilyCheckComplete(false);
          setSession(newSession);
          setUser(newSession.user);
        }

        const isValid = await validateSession(newSession);
        console.log('[Auth] SIGNED_IN validation complete, valid:', isValid, 'mounted:', mounted.current);

        if (!isValid) {
          // Don't sign out on validation failure - just clear local state
          // This prevents infinite loop with cached tokens
          await clearAuthState('sign-in validation failed', false);
        } else {
          if (mounted.current) {
            console.log('[Auth] SIGNED_IN setting loading=false');
            setLoading(false);
            useStore.getState().setAuthReady(true);
          } else {
            console.log('[Auth] SIGNED_IN skipped loading=false (unmounted)');
          }
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
        console.log('[fetchProfile] Got profile, passcode:', profileData.passcode, 'role:', profileData.role);
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
            
            // Ensure current user is in local store with their Supabase UUID
            try {
              useStore.getState().upsertMemberWithUUID(
                profileData.id,
                profileData.display_name,
                profileData.role,
                profileData.age || undefined
              );
              console.log('[Auth] Synced current user to store:', profileData.display_name);
            } catch (syncError) {
              console.error('[Auth] Error syncing current user:', syncError);
            }
          }
          // Clear any pending request since user is already in a family
          setPendingJoinRequest(null);
          setRequestedFamily(null);
        } else {
          setFamily(null);
          // Check for pending join requests
          await checkPendingJoinRequest(userId);
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

  function generatePasscode(): string {
    const min = 1000;
    const max = 9999;
    return String(Math.floor(Math.random() * (max - min + 1)) + min);
  }

  async function signUpParticipant(
    inviteCode: string,
    displayName: string
  ): Promise<{ error: Error | null; passcode: string | null }> {
    try {
      console.log('[signUpParticipant] Starting for:', displayName);

      const { data: familyData, error: familyError } = await supabase
        .from('families')
        .select('*')
        .eq('invite_code', inviteCode.toLowerCase())
        .single();

      if (familyError || !familyData) {
        return { error: new Error('Invalid invite code. Please check with your guardian.'), passcode: null };
      }

      let passcode = generatePasscode();
      let attempts = 0;
      const maxAttempts = 10;

      while (attempts < maxAttempts) {
        const { data: existing } = await supabase
          .from('profiles')
          .select('id')
          .eq('passcode', passcode)
          .single();

        if (!existing) break;
        passcode = generatePasscode();
        attempts++;
      }

      if (attempts >= maxAttempts) {
        return { error: new Error('Could not generate unique code. Please try again.'), passcode: null };
      }

      const generatedEmail = `participant${passcode}@sukun.app`;
      const authPassword = `sukun-${passcode}`;

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: generatedEmail,
        password: authPassword,
        options: {
          data: { display_name: displayName, role: 'kid', passcode: passcode }
        }
      });

      if (signUpError) {
        return { error: new Error(signUpError.message), passcode: null };
      }

      if (!signUpData.user) {
        return { error: new Error('Failed to create account'), passcode: null };
      }

      const userId = signUpData.user.id;

      // Sign in immediately to establish session for RLS policies
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: generatedEmail,
        password: authPassword
      });

      if (signInError) {
        console.error('[signUpParticipant] Auto sign-in failed:', signInError);
      }

      // Use SECURITY DEFINER function to set passcode (bypasses RLS for unconfirmed emails)
      const { error: passcodeError } = await supabase.rpc('set_profile_passcode', {
        profile_uuid: userId,
        passcode_value: passcode
      });

      if (passcodeError) {
        console.error('[signUpParticipant] Failed to save passcode:', passcodeError);
      } else {
        console.log('[signUpParticipant] Passcode saved successfully');
      }

      // Use SECURITY DEFINER function to bypass RLS (email not confirmed yet)
      console.log('[signUpParticipant] Creating join request for family:', familyData.id, 'user:', userId);
      const { data: rpcResult, error: requestError } = await supabase.rpc('create_participant_join_request', {
        family_uuid: familyData.id,
        requester_uuid: userId
      });

      if (requestError) {
        console.error('[signUpParticipant] Failed to create join request:', requestError.message, requestError.code, requestError.details);
      } else {
        console.log('[signUpParticipant] Join request created successfully, result:', rpcResult);
      }

      // NOTE: We intentionally do NOT set pendingJoinRequest here
      // The participant-join screen needs to show the passcode first
      // It will navigate to pending-approval after user confirms they saved the code

      console.log('[signUpParticipant] Success, passcode:', passcode);
      return { error: null, passcode };
    } catch (error: any) {
      console.error('[signUpParticipant] Error:', error?.message);
      return { error: error as Error, passcode: null };
    }
  }

  async function signInWithPasscode(passcode: string): Promise<{ error: Error | null }> {
    try {
      console.log('[signInWithPasscode] Attempting login with passcode');

      const { data: profileData, error: lookupError } = await supabase
        .from('profiles')
        .select('id, display_name')
        .eq('passcode', passcode)
        .single();

      if (lookupError || !profileData) {
        return { error: new Error('Invalid code. Please check and try again.') };
      }

      const email = `participant${passcode}@sukun.app`;
      const authPassword = `sukun-${passcode}`;
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: authPassword
      });

      if (signInError) {
        return { error: new Error('Login failed. Please try again.') };
      }

      console.log('[signInWithPasscode] Success for:', profileData.display_name);
      return { error: null };
    } catch (error: any) {
      console.error('[signInWithPasscode] Error:', error?.message);
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

      if (!user) {
        return { error: new Error('Not authenticated') };
      }

      // Check if there's already a pending request for this family
      const { data: existingRequest } = await supabase
        .from('join_requests')
        .select('*')
        .eq('family_id', familyData.id)
        .eq('requester_profile_id', user.id)
        .single();

      if (existingRequest) {
        if (existingRequest.status === 'pending') {
          setPendingJoinRequest(existingRequest as JoinRequest);
          setRequestedFamily(familyData as Family);
          return { error: new Error('You already have a pending request to join this family') };
        } else if (existingRequest.status === 'rejected') {
          // Delete the old rejected request and create a new one
          await supabase
            .from('join_requests')
            .delete()
            .eq('id', existingRequest.id);
        }
      }

      // Create a join request instead of joining directly
      const { data: requestData, error: requestError } = await supabase
        .from('join_requests')
        .insert({
          family_id: familyData.id,
          requester_profile_id: user.id,
          status: 'pending'
        })
        .select()
        .single();

      if (requestError) {
        return { error: new Error(requestError.message) };
      }

      setPendingJoinRequest(requestData as JoinRequest);
      setRequestedFamily(familyData as Family);

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }

  async function cancelJoinRequest(): Promise<{ error: Error | null }> {
    if (!pendingJoinRequest) {
      return { error: new Error('No pending request to cancel') };
    }

    try {
      const { error } = await supabase
        .from('join_requests')
        .delete()
        .eq('id', pendingJoinRequest.id);

      if (error) {
        return { error: new Error(error.message) };
      }

      setPendingJoinRequest(null);
      setRequestedFamily(null);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }

  async function updateProfileName(newName: string): Promise<{ error: Error | null }> {
    if (!user || !profile) {
      return { error: new Error('Not authenticated') };
    }

    const trimmedName = newName.trim();
    if (!trimmedName) {
      return { error: new Error('Name cannot be empty') };
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: trimmedName })
        .eq('id', user.id);

      if (error) {
        return { error: new Error(error.message) };
      }

      // Update local profile state
      setProfile({ ...profile, display_name: trimmedName });

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }

  async function getPendingJoinRequests(): Promise<JoinRequestWithProfile[]> {
    if (!family) return [];

    try {
      const { data: requests, error } = await supabase
        .from('join_requests')
        .select('*')
        .eq('family_id', family.id)
        .eq('status', 'pending');

      if (error || !requests) return [];

      // Fetch profile info for each requester
      const requestsWithProfiles: JoinRequestWithProfile[] = [];
      for (const request of requests) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', request.requester_profile_id)
          .single();

        requestsWithProfiles.push({
          ...request,
          requester_profile: profileData as Profile || undefined
        });
      }

      return requestsWithProfiles;
    } catch (error) {
      console.error('Error fetching join requests:', error);
      return [];
    }
  }

  async function approveJoinRequest(requestId: string): Promise<{ error: Error | null }> {
    if (!user || !family) {
      return { error: new Error('Not authenticated or no family') };
    }

    try {
      // Call the database function that bypasses RLS to update the profile
      const { data, error } = await supabase
        .rpc('approve_join_request', {
          request_uuid: requestId,
          approver_uuid: user.id
        });

      if (error) {
        return { error: new Error(error.message) };
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }

  async function rejectJoinRequest(requestId: string): Promise<{ error: Error | null }> {
    if (!user) {
      return { error: new Error('Not authenticated') };
    }

    try {
      const { error } = await supabase
        .from('join_requests')
        .update({
          status: 'rejected',
          reviewed_by_profile_id: user.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (error) {
        return { error: new Error(error.message) };
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }

  // Check for pending join requests on profile load
  async function checkPendingJoinRequest(userId: string) {
    try {
      const { data: request } = await supabase
        .from('join_requests')
        .select('*')
        .eq('requester_profile_id', userId)
        .eq('status', 'pending')
        .single();

      if (request) {
        setPendingJoinRequest(request as JoinRequest);
        // Fetch the family info
        const { data: familyData } = await supabase
          .from('families')
          .select('*')
          .eq('id', request.family_id)
          .single();

        if (familyData) {
          setRequestedFamily(familyData as Family);
        }
      } else {
        setPendingJoinRequest(null);
        setRequestedFamily(null);
      }
    } catch (error) {
      console.error('Error checking pending join request:', error);
    }
  }

  // Refresh pending join requests count for guardians who own a family
  const refreshPendingRequestsCount = useCallback(async () => {
    if (!family || profile?.role !== 'guardian') {
      setPendingRequestsCount(0);
      return;
    }
    
    try {
      const { count, error } = await supabase
        .from('join_requests')
        .select('*', { count: 'exact', head: true })
        .eq('family_id', family.id)
        .eq('status', 'pending');
      
      if (error) {
        setPendingRequestsCount(0);
      } else {
        setPendingRequestsCount(count || 0);
      }
    } catch (error) {
      setPendingRequestsCount(0);
    }
  }, [family?.id, profile?.role]);

  // Refresh count when family or profile changes
  useEffect(() => {
    if (family && profile?.role === 'guardian') {
      refreshPendingRequestsCount();
    } else {
      setPendingRequestsCount(0);
    }
  }, [family?.id, profile?.id, profile?.role, refreshPendingRequestsCount]);

  // Compute authReady - true when initial auth check is complete
  // This means we've checked for session, loaded profile, AND checked family status
  const authReady = useMemo(() => {
    // Still loading initial auth state
    if (loading) return false;
    
    // Supabase not configured - considered ready (will be handled by navigation)
    if (!isSupabaseConfigured()) return true;
    
    // No session - ready to navigate to sign-in (familyCheckComplete should be true)
    if (!session) return familyCheckComplete;
    
    // Has session but profile not loaded yet - not ready
    if (!profile) return false;
    
    // Profile loaded but family check not complete - not ready yet
    // This prevents navigation before we know if user has a family
    if (!familyCheckComplete) return false;
    
    // Profile and family check complete - we're ready
    return true;
  }, [loading, session, profile, familyCheckComplete]);

  // Derive persona from current auth state
  const persona = useMemo((): Persona => {
    if (!session || !profile) return null;
    
    const authState: AuthState = {
      session: !!session,
      profile: {
        id: profile.id,
        role: profile.role,
        passcode: profile.passcode,
        family_id: profile.family_id,
      },
      family: family ? {
        id: family.id,
      } : null,
      pendingJoinRequest: !!pendingJoinRequest,
      authReady: true,
      storeReady: true,
    };
    
    return derivePersonaFromState(authState);
  }, [session, profile, family, pendingJoinRequest]);

  return (
    <AuthContext.Provider
      value={{
        session, user, profile, family, loading, authReady, persona,
        isConfigured: isSupabaseConfigured(),
        pendingJoinRequest, requestedFamily,
        pendingRequestsCount, refreshPendingRequestsCount,
        signUp, signIn, signUpParticipant, signInWithPasscode, signOut, 
        createFamily, joinFamily, refreshProfile, updateProfileName,
        cancelJoinRequest, getPendingJoinRequests, approveJoinRequest, rejectJoinRequest,
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

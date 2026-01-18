/**
 * Auth State Integration Tests
 * 
 * Tests the actual auth state derivation and transition logic.
 * These tests exercise real code from navigation.ts and validate
 * that the auth state shapes work correctly with the navigation system.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  resolveRoute, 
  derivePersona, 
  AuthState,
  Persona 
} from '../navigation';

function createAuthState(overrides: Partial<AuthState> = {}): AuthState {
  return {
    session: false,
    profile: null,
    family: null,
    pendingJoinRequest: false,
    authReady: true,
    storeReady: true,
    ...overrides,
  };
}

describe('Auth State to Persona Derivation', () => {
  describe('Session-based persona derivation', () => {
    it('returns null persona when session is false', () => {
      const state = createAuthState({ session: false });
      expect(derivePersona(state)).toBe(null);
    });

    it('returns null persona when session exists but profile is null', () => {
      const state = createAuthState({ session: true, profile: null });
      expect(derivePersona(state)).toBe(null);
    });

    it('derives guardian persona correctly from profile', () => {
      const state = createAuthState({
        session: true,
        profile: { id: 'u1', role: 'guardian', passcode: null, family_id: null },
      });
      expect(derivePersona(state)).toBe('guardian');
    });

    it('derives participant_code persona for kid with passcode', () => {
      const state = createAuthState({
        session: true,
        profile: { id: 'k1', role: 'kid', passcode: '1234', family_id: null },
      });
      expect(derivePersona(state)).toBe('participant_code');
    });

    it('derives participant_email persona for kid without passcode', () => {
      const state = createAuthState({
        session: true,
        profile: { id: 'k2', role: 'kid', passcode: null, family_id: null },
      });
      expect(derivePersona(state)).toBe('participant_email');
    });
  });
});

describe('Auth State Transitions via resolveRoute', () => {
  describe('Initial Load: No Session', () => {
    it('resolves to sign-in when init completes with no session', () => {
      const afterInit = createAuthState({
        session: false,
        profile: null,
        authReady: true,
        storeReady: true,
      });
      
      const result = resolveRoute(afterInit);
      expect(result?.path).toBe('/auth/sign-in');
    });
  });

  describe('Initial Load: Valid Session Found', () => {
    it('resolves to today when session has profile and family', () => {
      const afterInit = createAuthState({
        session: true,
        profile: { id: 'g1', role: 'guardian', passcode: null, family_id: 'f1' },
        family: { id: 'f1' },
      });
      
      const result = resolveRoute(afterInit);
      expect(result?.path).toBe('/(tabs)/today');
    });

    it('resolves to family-setup when guardian has no family', () => {
      const afterInit = createAuthState({
        session: true,
        profile: { id: 'g1', role: 'guardian', passcode: null, family_id: null },
        family: null,
      });
      
      const result = resolveRoute(afterInit);
      expect(result?.path).toBe('/auth/family-setup');
    });
  });

  describe('SIGNED_IN Event: Guardian Email', () => {
    it('guardian sign-in with existing family routes to today', () => {
      const afterSignIn = createAuthState({
        session: true,
        profile: { id: 'g1', role: 'guardian', passcode: null, family_id: 'f1' },
        family: { id: 'f1' },
      });
      
      expect(resolveRoute(afterSignIn)?.path).toBe('/(tabs)/today');
    });

    it('guardian sign-in without family routes to family-setup', () => {
      const afterSignIn = createAuthState({
        session: true,
        profile: { id: 'g1', role: 'guardian', passcode: null, family_id: null },
        family: null,
      });
      
      expect(resolveRoute(afterSignIn)?.path).toBe('/auth/family-setup');
    });

    it('guardian sign-in with pending request routes to pending-approval', () => {
      const afterSignIn = createAuthState({
        session: true,
        profile: { id: 'g1', role: 'guardian', passcode: null, family_id: null },
        family: null,
        pendingJoinRequest: true,
      });
      
      expect(resolveRoute(afterSignIn)?.path).toBe('/auth/pending-approval');
    });
  });

  describe('SIGNED_IN Event: Participant Passcode', () => {
    it('participant sign-in with family routes to today', () => {
      const afterSignIn = createAuthState({
        session: true,
        profile: { id: 'k1', role: 'kid', passcode: '5678', family_id: 'f1' },
        family: { id: 'f1' },
      });
      
      expect(derivePersona(afterSignIn)).toBe('participant_code');
      expect(resolveRoute(afterSignIn)?.path).toBe('/(tabs)/today');
    });

    it('participant sign-in without family routes to pending-approval', () => {
      const afterSignIn = createAuthState({
        session: true,
        profile: { id: 'k1', role: 'kid', passcode: '5678', family_id: null },
        family: null,
      });
      
      expect(derivePersona(afterSignIn)).toBe('participant_code');
      expect(resolveRoute(afterSignIn)?.path).toBe('/auth/pending-approval');
    });
  });

  describe('SIGNED_OUT Event', () => {
    it('clears all state and routes to sign-in', () => {
      const afterSignOut = createAuthState({
        session: false,
        profile: null,
        family: null,
        pendingJoinRequest: false,
      });
      
      expect(derivePersona(afterSignOut)).toBe(null);
      expect(resolveRoute(afterSignOut)?.path).toBe('/auth/sign-in');
    });
  });

  describe('TOKEN_REFRESHED Event', () => {
    it('maintains routing when session refreshed with valid profile', () => {
      const afterRefresh = createAuthState({
        session: true,
        profile: { id: 'g1', role: 'guardian', passcode: null, family_id: 'f1' },
        family: { id: 'f1' },
      });
      
      expect(resolveRoute(afterRefresh)?.path).toBe('/(tabs)/today');
    });
  });

  describe('Profile Validation: Family Loading', () => {
    it('profile with family_id triggers correct routing when family loaded', () => {
      const withFamily = createAuthState({
        session: true,
        profile: { id: 'g1', role: 'guardian', passcode: null, family_id: 'f1' },
        family: { id: 'f1' },
      });
      
      expect(resolveRoute(withFamily)?.path).toBe('/(tabs)/today');
    });

    it('profile without family_id with pending request routes correctly', () => {
      const withPending = createAuthState({
        session: true,
        profile: { id: 'g1', role: 'guardian', passcode: null, family_id: null },
        family: null,
        pendingJoinRequest: true,
      });
      
      expect(resolveRoute(withPending)?.path).toBe('/auth/pending-approval');
    });
  });
});

describe('Auth Ready State', () => {
  it('returns null route when auth not ready (loading)', () => {
    const loading = createAuthState({
      authReady: false,
      session: true,
      profile: { id: 'g1', role: 'guardian', passcode: null, family_id: 'f1' },
      family: { id: 'f1' },
    });
    
    expect(resolveRoute(loading)).toBe(null);
  });

  it('returns null route when store not ready', () => {
    const storeLoading = createAuthState({
      storeReady: false,
      session: true,
      profile: { id: 'g1', role: 'guardian', passcode: null, family_id: 'f1' },
      family: { id: 'f1' },
    });
    
    expect(resolveRoute(storeLoading)).toBe(null);
  });

  it('resolves route correctly when both auth and store ready', () => {
    const ready = createAuthState({
      authReady: true,
      storeReady: true,
      session: true,
      profile: { id: 'g1', role: 'guardian', passcode: null, family_id: 'f1' },
      family: { id: 'f1' },
    });
    
    expect(resolveRoute(ready)?.path).toBe('/(tabs)/today');
  });
});

/**
 * Edge case tests for auth and navigation
 * 
 * Tests error handling, race conditions, and unusual state combinations
 */

import { describe, it, expect } from 'vitest';
import { 
  resolveRoute, 
  shouldNavigate, 
  UNPROTECTED_ROUTES,
  AuthState 
} from '../navigation';

function createState(overrides: Partial<AuthState> = {}): AuthState {
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

function createProfile(overrides: Partial<NonNullable<AuthState['profile']>> = {}) {
  return {
    id: 'user-123',
    role: 'guardian' as const,
    passcode: null,
    family_id: null,
    ...overrides,
  };
}

describe('Edge Cases: Loading States', () => {
  it('returns null when auth not ready (prevents premature navigation)', () => {
    const state = createState({
      authReady: false,
      storeReady: true,
      session: true,
      profile: createProfile(),
    });
    
    const result = resolveRoute(state);
    expect(result).toBe(null);
  });

  it('returns null when store not ready (prevents premature navigation)', () => {
    const state = createState({
      authReady: true,
      storeReady: false,
      session: true,
      profile: createProfile(),
    });
    
    const result = resolveRoute(state);
    expect(result).toBe(null);
  });

  it('returns null when both auth and store not ready', () => {
    const state = createState({
      authReady: false,
      storeReady: false,
    });
    
    const result = resolveRoute(state);
    expect(result).toBe(null);
  });
});

describe('Edge Cases: Session/Profile Mismatch', () => {
  it('routes to sign-in when session exists but profile is null', () => {
    const state = createState({
      session: true,
      profile: null,
      authReady: true,
      storeReady: true,
    });
    
    const result = resolveRoute(state);
    expect(result?.path).toBe('/auth/sign-in');
    expect(result?.reason).toContain('No profile');
  });

  it('routes to sign-in when neither session nor profile exist', () => {
    const state = createState({
      session: false,
      profile: null,
    });
    
    const result = resolveRoute(state);
    expect(result?.path).toBe('/auth/sign-in');
  });
});

describe('Edge Cases: Unprotected Routes', () => {
  it('sign-in is in unprotected routes list', () => {
    expect(UNPROTECTED_ROUTES).toContain('/auth/sign-in');
  });

  it('sign-up is in unprotected routes list', () => {
    expect(UNPROTECTED_ROUTES).toContain('/auth/sign-up');
  });

  it('passcode-login is in unprotected routes list', () => {
    expect(UNPROTECTED_ROUTES).toContain('/auth/passcode-login');
  });

  it('participant-join is in unprotected routes list', () => {
    expect(UNPROTECTED_ROUTES).toContain('/auth/participant-join');
  });

  it('family-setup is in unprotected routes list', () => {
    expect(UNPROTECTED_ROUTES).toContain('/auth/family-setup');
  });

  it('pending-approval is in unprotected routes list', () => {
    expect(UNPROTECTED_ROUTES).toContain('/auth/pending-approval');
  });
});

describe('Edge Cases: Route Comparison', () => {
  it('shouldNavigate returns false for identical paths', () => {
    expect(shouldNavigate('/(tabs)/today', '/(tabs)/today')).toBe(false);
  });

  it('shouldNavigate handles trailing slashes', () => {
    expect(shouldNavigate('/(tabs)/today/', '/(tabs)/today')).toBe(false);
  });

  it('shouldNavigate handles leading slashes', () => {
    expect(shouldNavigate('/(tabs)/today', '(tabs)/today')).toBe(false);
  });

  it('shouldNavigate is case insensitive', () => {
    expect(shouldNavigate('/Auth/Sign-In', '/auth/sign-in')).toBe(false);
  });

  it('shouldNavigate returns true for different paths', () => {
    expect(shouldNavigate('/auth/sign-in', '/(tabs)/today')).toBe(true);
  });
});

describe('Edge Cases: State Transitions', () => {
  it('multiple rapid state changes: only final state matters', () => {
    const state1 = createState({ session: false });
    const state2 = createState({ session: true, profile: null });
    const state3 = createState({ 
      session: true, 
      profile: createProfile({ family_id: 'fam-1' }),
      family: { id: 'fam-1' },
    });
    
    expect(resolveRoute(state1)?.path).toBe('/auth/sign-in');
    expect(resolveRoute(state2)?.path).toBe('/auth/sign-in');
    expect(resolveRoute(state3)?.path).toBe('/(tabs)/today');
  });

  it('handles participant with pending request correctly', () => {
    const state = createState({
      session: true,
      profile: {
        id: 'kid-1',
        role: 'kid',
        passcode: '5678',
        family_id: null,
      },
      family: null,
      pendingJoinRequest: true,
    });
    
    const result = resolveRoute(state);
    expect(result?.path).toBe('/auth/pending-approval');
  });
});

describe('Edge Cases: Persona Edge Cases', () => {
  it('guardian without passcode is still guardian', () => {
    const state = createState({
      session: true,
      profile: createProfile({ role: 'guardian', passcode: null }),
      family: { id: 'fam-1' },
    });
    
    const result = resolveRoute(state);
    expect(result?.reason).toContain('guardian');
  });

  it('kid with empty string passcode is participant_email', () => {
    const state = createState({
      session: true,
      profile: {
        id: 'kid-1',
        role: 'kid',
        passcode: '',
        family_id: 'fam-1',
      },
      family: { id: 'fam-1' },
    });
    
    const result = resolveRoute(state);
    expect(result?.reason).toContain('participant_email');
  });

  it('kid with null passcode is participant_email', () => {
    const state = createState({
      session: true,
      profile: {
        id: 'kid-1',
        role: 'kid',
        passcode: null,
        family_id: 'fam-1',
      },
      family: { id: 'fam-1' },
    });
    
    const result = resolveRoute(state);
    expect(result?.reason).toContain('participant_email');
  });
});

describe('Edge Cases: Family State', () => {
  it('profile has family_id but family object is null - uses family object', () => {
    const state = createState({
      session: true,
      profile: createProfile({ family_id: 'orphan-fam' }),
      family: null,
    });
    
    const result = resolveRoute(state);
    expect(result?.path).toBe('/auth/family-setup');
  });

  it('profile has null family_id but family object exists - uses family object', () => {
    const state = createState({
      session: true,
      profile: createProfile({ family_id: null }),
      family: { id: 'ghost-family' },
    });
    
    const result = resolveRoute(state);
    expect(result?.path).toBe('/(tabs)/today');
  });
});

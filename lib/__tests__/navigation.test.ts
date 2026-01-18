/**
 * Unit tests for centralized navigation logic
 */

import { describe, it, expect } from 'vitest';
import { 
  resolveRoute, 
  derivePersona, 
  shouldNavigate,
  AuthState,
  Persona 
} from '../navigation';

// Helper to create a base state
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

// Helper to create a profile
function createProfile(overrides: Partial<AuthState['profile']> = {}): AuthState['profile'] {
  return {
    id: 'user-123',
    role: 'guardian',
    passcode: null,
    family_id: null,
    ...overrides,
  };
}

// Helper to create a family
function createFamily(overrides: Partial<AuthState['family']> = {}): AuthState['family'] {
  return {
    id: 'family-456',
    owner_id: 'user-123',
    ...overrides,
  };
}

describe('derivePersona', () => {
  it('returns null when no session', () => {
    const state = createState({ session: false });
    expect(derivePersona(state)).toBe(null);
  });

  it('returns null when no profile', () => {
    const state = createState({ session: true, profile: null });
    expect(derivePersona(state)).toBe(null);
  });

  it('returns "owner" for guardian who owns the family', () => {
    const profile = createProfile({ id: 'user-123', role: 'guardian' });
    const family = createFamily({ owner_id: 'user-123' });
    const state = createState({ session: true, profile, family });
    expect(derivePersona(state)).toBe('owner');
  });

  it('returns "guardian" for guardian who is not owner', () => {
    const profile = createProfile({ id: 'user-123', role: 'guardian' });
    const family = createFamily({ owner_id: 'other-user' });
    const state = createState({ session: true, profile, family });
    expect(derivePersona(state)).toBe('guardian');
  });

  it('returns "guardian" for guardian without family', () => {
    const profile = createProfile({ id: 'user-123', role: 'guardian' });
    const state = createState({ session: true, profile, family: null });
    expect(derivePersona(state)).toBe('guardian');
  });

  it('returns "participant_code" for kid with passcode', () => {
    const profile = createProfile({ role: 'kid', passcode: '1234' });
    const state = createState({ session: true, profile });
    expect(derivePersona(state)).toBe('participant_code');
  });

  it('returns "participant_email" for kid without passcode', () => {
    const profile = createProfile({ role: 'kid', passcode: null });
    const state = createState({ session: true, profile });
    expect(derivePersona(state)).toBe('participant_email');
  });
});

describe('resolveRoute', () => {
  describe('loading states', () => {
    it('returns null when auth not ready', () => {
      const state = createState({ authReady: false, storeReady: true });
      expect(resolveRoute(state)).toBe(null);
    });

    it('returns null when store not ready', () => {
      const state = createState({ authReady: true, storeReady: false });
      expect(resolveRoute(state)).toBe(null);
    });

    it('returns null when both not ready', () => {
      const state = createState({ authReady: false, storeReady: false });
      expect(resolveRoute(state)).toBe(null);
    });
  });

  describe('unauthenticated', () => {
    it('routes to sign-in when no session', () => {
      const state = createState({ session: false });
      const result = resolveRoute(state);
      expect(result?.path).toBe('/auth/sign-in');
    });

    it('routes to sign-in when session but no profile', () => {
      const state = createState({ session: true, profile: null });
      const result = resolveRoute(state);
      expect(result?.path).toBe('/auth/sign-in');
    });
  });

  describe('owner persona', () => {
    it('routes to today when owner has family', () => {
      const profile = createProfile({ id: 'user-123', role: 'guardian' });
      const family = createFamily({ owner_id: 'user-123' });
      const state = createState({ session: true, profile, family });
      const result = resolveRoute(state);
      expect(result?.path).toBe('/(tabs)/today');
      expect(result?.reason).toContain('owner');
    });

    it('routes to family-setup when owner has no family', () => {
      const profile = createProfile({ id: 'user-123', role: 'guardian' });
      const state = createState({ session: true, profile, family: null });
      const result = resolveRoute(state);
      expect(result?.path).toBe('/auth/family-setup');
    });
  });

  describe('guardian persona (non-owner)', () => {
    it('routes to today when guardian has family', () => {
      const profile = createProfile({ id: 'user-123', role: 'guardian' });
      const family = createFamily({ owner_id: 'other-user' });
      const state = createState({ session: true, profile, family });
      const result = resolveRoute(state);
      expect(result?.path).toBe('/(tabs)/today');
      expect(result?.reason).toContain('guardian');
    });

    it('routes to pending-approval when guardian has pending request', () => {
      const profile = createProfile({ id: 'user-123', role: 'guardian' });
      const state = createState({ 
        session: true, 
        profile, 
        family: null, 
        pendingJoinRequest: true 
      });
      const result = resolveRoute(state);
      expect(result?.path).toBe('/auth/pending-approval');
    });

    it('routes to family-setup when guardian has no family and no pending request', () => {
      const profile = createProfile({ id: 'user-123', role: 'guardian' });
      const state = createState({ 
        session: true, 
        profile, 
        family: null, 
        pendingJoinRequest: false 
      });
      const result = resolveRoute(state);
      expect(result?.path).toBe('/auth/family-setup');
    });
  });

  describe('participant_code persona', () => {
    it('routes to today when participant has family', () => {
      const profile = createProfile({ role: 'kid', passcode: '1234' });
      const family = createFamily();
      const state = createState({ session: true, profile, family });
      const result = resolveRoute(state);
      expect(result?.path).toBe('/(tabs)/today');
      expect(result?.reason).toContain('participant_code');
    });

    it('routes to pending-approval when participant has pending request', () => {
      const profile = createProfile({ role: 'kid', passcode: '1234' });
      const state = createState({ 
        session: true, 
        profile, 
        family: null, 
        pendingJoinRequest: true 
      });
      const result = resolveRoute(state);
      expect(result?.path).toBe('/auth/pending-approval');
    });

    it('routes to pending-approval when participant has no family (even without request)', () => {
      const profile = createProfile({ role: 'kid', passcode: '1234' });
      const state = createState({ 
        session: true, 
        profile, 
        family: null, 
        pendingJoinRequest: false 
      });
      const result = resolveRoute(state);
      expect(result?.path).toBe('/auth/pending-approval');
      expect(result?.reason).toContain('must wait');
    });
  });

  describe('participant_email persona', () => {
    it('routes to today when participant has family', () => {
      const profile = createProfile({ role: 'kid', passcode: null });
      const family = createFamily();
      const state = createState({ session: true, profile, family });
      const result = resolveRoute(state);
      expect(result?.path).toBe('/(tabs)/today');
    });

    it('routes to pending-approval when participant has no family', () => {
      const profile = createProfile({ role: 'kid', passcode: null });
      const state = createState({ 
        session: true, 
        profile, 
        family: null, 
        pendingJoinRequest: false 
      });
      const result = resolveRoute(state);
      expect(result?.path).toBe('/auth/pending-approval');
    });
  });
});

describe('shouldNavigate', () => {
  it('returns true when paths differ', () => {
    expect(shouldNavigate('/auth/sign-in', '/(tabs)/today')).toBe(true);
  });

  it('returns false when paths match', () => {
    expect(shouldNavigate('/(tabs)/today', '/(tabs)/today')).toBe(false);
  });

  it('handles leading/trailing slashes', () => {
    expect(shouldNavigate('/auth/sign-in/', 'auth/sign-in')).toBe(false);
  });

  it('is case insensitive', () => {
    expect(shouldNavigate('/Auth/Sign-In', '/auth/sign-in')).toBe(false);
  });
});

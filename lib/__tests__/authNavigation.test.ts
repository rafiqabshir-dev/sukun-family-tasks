/**
 * Integration tests for auth + navigation
 * 
 * Tests complete user journeys from auth events to final route resolution
 */

import { describe, it, expect } from 'vitest';
import { resolveRoute, derivePersona, AuthState } from '../navigation';

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

function createGuardianProfile(overrides: Partial<NonNullable<AuthState['profile']>> = {}) {
  return {
    id: 'guardian-123',
    role: 'guardian' as const,
    passcode: null,
    family_id: null,
    ...overrides,
  };
}

function createParticipantCodeProfile(overrides: Partial<NonNullable<AuthState['profile']>> = {}) {
  return {
    id: 'kid-456',
    role: 'kid' as const,
    passcode: '1234',
    family_id: null,
    ...overrides,
  };
}

function createParticipantEmailProfile(overrides: Partial<NonNullable<AuthState['profile']>> = {}) {
  return {
    id: 'kid-789',
    role: 'kid' as const,
    passcode: null,
    family_id: null,
    ...overrides,
  };
}

function createFamily() {
  return { id: 'family-abc' };
}

describe('Complete User Journeys', () => {
  describe('Journey 1: New guardian opens app (no session)', () => {
    it('routes to sign-in when app loads without session', () => {
      const state = createState({
        session: false,
        profile: null,
        authReady: true,
        storeReady: true,
      });
      
      const result = resolveRoute(state);
      expect(result?.path).toBe('/auth/sign-in');
      expect(result?.reason).toContain('No active session');
    });
  });

  describe('Journey 2: Guardian signs up and creates family', () => {
    it('after sign-up without family, routes to family-setup', () => {
      const state = createState({
        session: true,
        profile: createGuardianProfile(),
        family: null,
        pendingJoinRequest: false,
      });
      
      const persona = derivePersona(state);
      const result = resolveRoute(state);
      
      expect(persona).toBe('guardian');
      expect(result?.path).toBe('/auth/family-setup');
    });

    it('after creating family, routes to today', () => {
      const state = createState({
        session: true,
        profile: createGuardianProfile({ family_id: 'family-abc' }),
        family: createFamily(),
      });
      
      const result = resolveRoute(state);
      expect(result?.path).toBe('/(tabs)/today');
    });
  });

  describe('Journey 3: Guardian signs in with existing family', () => {
    it('routes directly to today when session restored with family', () => {
      const state = createState({
        session: true,
        profile: createGuardianProfile({ family_id: 'family-abc' }),
        family: createFamily(),
      });
      
      const result = resolveRoute(state);
      expect(result?.path).toBe('/(tabs)/today');
      expect(result?.reason).toContain('guardian');
      expect(result?.reason).toContain('family access');
    });
  });

  describe('Journey 4: Guardian signs in without family', () => {
    it('routes to family-setup when guardian has no family', () => {
      const state = createState({
        session: true,
        profile: createGuardianProfile(),
        family: null,
        pendingJoinRequest: false,
      });
      
      const result = resolveRoute(state);
      expect(result?.path).toBe('/auth/family-setup');
      expect(result?.reason).toContain('Guardian');
    });
  });

  describe('Journey 5: Guardian signs in with pending join request', () => {
    it('routes to pending-approval when guardian has pending request', () => {
      const state = createState({
        session: true,
        profile: createGuardianProfile(),
        family: null,
        pendingJoinRequest: true,
      });
      
      const result = resolveRoute(state);
      expect(result?.path).toBe('/auth/pending-approval');
      expect(result?.reason).toContain('waiting for family approval');
    });
  });

  describe('Journey 6: Participant (passcode) opens app with family', () => {
    it('routes to today when participant has family access', () => {
      const state = createState({
        session: true,
        profile: createParticipantCodeProfile({ family_id: 'family-abc' }),
        family: createFamily(),
      });
      
      const persona = derivePersona(state);
      const result = resolveRoute(state);
      
      expect(persona).toBe('participant_code');
      expect(result?.path).toBe('/(tabs)/today');
    });
  });

  describe('Journey 7: Participant (passcode) signs in without family', () => {
    it('routes to pending-approval - participants cannot create families', () => {
      const state = createState({
        session: true,
        profile: createParticipantCodeProfile(),
        family: null,
        pendingJoinRequest: false,
      });
      
      const persona = derivePersona(state);
      const result = resolveRoute(state);
      
      expect(persona).toBe('participant_code');
      expect(result?.path).toBe('/auth/pending-approval');
      expect(result?.reason).toContain('must wait');
    });
  });

  describe('Journey 8: Participant (email) signs in with family', () => {
    it('routes to today when email participant has family', () => {
      const state = createState({
        session: true,
        profile: createParticipantEmailProfile({ family_id: 'family-abc' }),
        family: createFamily(),
      });
      
      const persona = derivePersona(state);
      const result = resolveRoute(state);
      
      expect(persona).toBe('participant_email');
      expect(result?.path).toBe('/(tabs)/today');
    });
  });

  describe('Journey 9: Participant (email) signs in without family', () => {
    it('routes to pending-approval - participants cannot create families', () => {
      const state = createState({
        session: true,
        profile: createParticipantEmailProfile(),
        family: null,
        pendingJoinRequest: false,
      });
      
      const persona = derivePersona(state);
      const result = resolveRoute(state);
      
      expect(persona).toBe('participant_email');
      expect(result?.path).toBe('/auth/pending-approval');
    });
  });

  describe('Journey 10: Any user signs out', () => {
    it('routes to sign-in after sign out clears state', () => {
      const stateAfterSignOut = createState({
        session: false,
        profile: null,
        family: null,
      });
      
      const result = resolveRoute(stateAfterSignOut);
      expect(result?.path).toBe('/auth/sign-in');
    });
  });

  describe('Journey 11: Guardian creates family after setup', () => {
    it('state transition: family-setup -> family created -> routes to today', () => {
      const beforeCreate = createState({
        session: true,
        profile: createGuardianProfile(),
        family: null,
      });
      
      expect(resolveRoute(beforeCreate)?.path).toBe('/auth/family-setup');
      
      const afterCreate = createState({
        session: true,
        profile: createGuardianProfile({ family_id: 'new-family' }),
        family: { id: 'new-family' },
      });
      
      expect(resolveRoute(afterCreate)?.path).toBe('/(tabs)/today');
    });
  });

  describe('Journey 12: Participant approved to join family', () => {
    it('state transition: pending-approval -> approved -> routes to today', () => {
      const beforeApproval = createState({
        session: true,
        profile: createParticipantCodeProfile(),
        family: null,
        pendingJoinRequest: true,
      });
      
      expect(resolveRoute(beforeApproval)?.path).toBe('/auth/pending-approval');
      
      const afterApproval = createState({
        session: true,
        profile: createParticipantCodeProfile({ family_id: 'family-abc' }),
        family: createFamily(),
        pendingJoinRequest: false,
      });
      
      expect(resolveRoute(afterApproval)?.path).toBe('/(tabs)/today');
    });
  });
});

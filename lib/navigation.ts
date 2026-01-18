/**
 * Centralized Navigation Controller
 * 
 * This module provides a single source of truth for all routing decisions.
 * All navigation logic flows through resolveRoute() to prevent race conditions
 * and scattered redirect logic.
 */

export type Persona = 'guardian' | 'participant_code' | 'participant_email' | null;

export interface AuthState {
  session: boolean;
  profile: {
    id: string;
    role: 'guardian' | 'kid';
    passcode: string | null;
    family_id: string | null;
  } | null;
  family: {
    id: string;
  } | null;
  pendingJoinRequest: boolean;
  authReady: boolean;
  storeReady: boolean;
}

export interface RouteResult {
  path: string;
  reason: string;
}

/**
 * Derives the user's persona from their profile
 * 
 * Personas:
 * - guardian: Any user with role='guardian' (includes family owners)
 * - participant_code: Kid who logs in with 4-digit passcode
 * - participant_email: Kid who logs in with email/password
 */
export function derivePersona(state: AuthState): Persona {
  if (!state.session || !state.profile) {
    return null;
  }

  const { profile } = state;

  if (profile.role === 'guardian') {
    return 'guardian';
  }

  if (profile.role === 'kid') {
    if (profile.passcode) {
      return 'participant_code';
    }
    return 'participant_email';
  }

  return null;
}

/**
 * Resolves the correct route based on auth state and persona.
 * 
 * Priority order (first match wins):
 * 1. Not ready → null (show loading)
 * 2. No session → sign-in
 * 3. Has family → today (main app)
 * 4. Pending join request → pending-approval
 * 5. Participant without family → pending-approval (can never create family)
 * 6. Guardian without family → family-setup
 */
export function resolveRoute(state: AuthState): RouteResult | null {
  // Not ready yet - don't navigate
  if (!state.authReady || !state.storeReady) {
    return null;
  }

  // No session - go to sign in
  if (!state.session) {
    return {
      path: '/auth/sign-in',
      reason: 'No active session'
    };
  }

  // No profile yet - this shouldn't happen if authReady is true, but guard anyway
  if (!state.profile) {
    return {
      path: '/auth/sign-in',
      reason: 'No profile found'
    };
  }

  const persona = derivePersona(state);

  // Has family - go to main app
  if (state.family) {
    return {
      path: '/(tabs)/today',
      reason: `${persona} with family access`
    };
  }

  // No family from here on...

  // Has pending join request - wait for approval
  if (state.pendingJoinRequest) {
    return {
      path: '/auth/pending-approval',
      reason: `${persona} waiting for family approval`
    };
  }

  // Participants without family or pending request - they need to wait
  // (This happens if their request was rejected or they just signed up)
  if (persona === 'participant_code' || persona === 'participant_email') {
    return {
      path: '/auth/pending-approval',
      reason: 'Participant must wait for family approval'
    };
  }

  // Guardians without family - can create or join one
  if (persona === 'guardian') {
    return {
      path: '/auth/family-setup',
      reason: 'Guardian needs to create or join family'
    };
  }

  // Fallback - shouldn't reach here
  return {
    path: '/auth/sign-in',
    reason: 'Unknown state - redirecting to sign in'
  };
}

/**
 * Routes that don't require navigation controller intervention.
 * These are "leaf" routes where users perform actions like signing in,
 * creating families, or waiting for approval.
 */
export const UNPROTECTED_ROUTES = [
  '/auth/sign-in',
  '/auth/sign-up', 
  '/auth/passcode-login',
  '/auth/participant-join',
  '/auth/family-setup',
  '/auth/pending-approval',
];

/**
 * Check if current route matches the resolved route
 */
export function shouldNavigate(currentPath: string, resolvedPath: string): boolean {
  // Normalize paths for comparison
  const normalize = (p: string) => p.replace(/^\/+|\/+$/g, '').toLowerCase();
  return normalize(currentPath) !== normalize(resolvedPath);
}

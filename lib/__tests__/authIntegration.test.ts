/**
 * Integration Tests for Auth + Navigation Flow
 * 
 * These tests simulate a complete app lifecycle with sign-in/sign-out cycles
 * without manually resetting the module-level flag, to verify the real
 * auth behavior matches production patterns.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { resolveRoute, AuthState } from '../navigation';

type AuthChangeCallback = (event: string, session: any) => void;

const mockAuthChangeCallback: { current: AuthChangeCallback | null } = { current: null };
const mockGetSession = vi.fn();
const mockSignOut = vi.fn();
const mockOnAuthStateChange = vi.fn((callback: AuthChangeCallback) => {
  mockAuthChangeCallback.current = callback;
  return { data: { subscription: { unsubscribe: vi.fn() } } };
});
const mockFrom = vi.fn();

vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      signOut: () => mockSignOut(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      onAuthStateChange: (callback: any) => mockOnAuthStateChange(callback),
    },
    from: (table: string) => mockFrom(table),
  },
  isSupabaseConfigured: () => true,
  Profile: {},
  Family: {},
  JoinRequest: {},
}));

vi.mock('../store', () => ({
  useStore: () => ({
    setMembersFromCloud: vi.fn(),
    upsertMemberWithUUID: vi.fn(),
    hydrated: true,
    isReady: true,
  }),
}));

import { AuthProvider, useAuth, __resetAuthInitForTesting } from '../authContext';

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(AuthProvider, null, children);
}

function createMockFromChain(data: any = null, error: any = null) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
  };
  chain.eq = vi.fn().mockReturnValue(chain);
  return chain;
}

describe('Complete App Lifecycle: Sign-In → Sign-Out → Re-Sign-In', () => {
  beforeAll(() => {
    __resetAuthInitForTesting();
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.resetAllMocks();
  });

  it('handles complete lifecycle without infinite loops', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    mockSignOut.mockResolvedValue({ error: null });

    const { result } = renderHook(() => useAuth(), { wrapper });
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    expect(result.current.session).toBe(null);
    expect(result.current.authReady).toBe(true);
    expect(mockGetSession).toHaveBeenCalledTimes(1);
    
    const signInSession = {
      user: { id: 'user-1', email: 'user@test.com', user_metadata: { role: 'guardian' } },
      access_token: 'token-1',
    };
    
    const guardianProfile = {
      id: 'user-1',
      display_name: 'Test Guardian',
      role: 'guardian',
      passcode: null,
      family_id: 'family-1',
      powers: [],
    };
    
    const family = {
      id: 'family-1',
      name: 'Test Family',
      invite_code: 'ABC123',
    };
    
    mockFrom.mockReturnValue({
      ...createMockFromChain(guardianProfile, null),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn()
            .mockResolvedValueOnce({ data: guardianProfile, error: null })
            .mockResolvedValueOnce({ data: family, error: null }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });
    
    act(() => {
      mockAuthChangeCallback.current?.('SIGNED_IN', signInSession);
    });
    
    await waitFor(() => {
      expect(result.current.session).toBeTruthy();
    });
    
    expect(mockGetSession).toHaveBeenCalledTimes(1);
    
    act(() => {
      mockAuthChangeCallback.current?.('SIGNED_OUT', null);
    });
    
    await waitFor(() => {
      expect(result.current.session).toBe(null);
    });
    
    expect(mockGetSession).toHaveBeenCalledTimes(1);
    
    const secondSignInSession = {
      user: { id: 'user-2', email: 'user2@test.com', user_metadata: { role: 'guardian' } },
      access_token: 'token-2',
    };
    
    act(() => {
      mockAuthChangeCallback.current?.('SIGNED_IN', secondSignInSession);
    });
    
    await waitFor(() => {
      expect(result.current.session).toBeTruthy();
    });
    
    expect(mockGetSession).toHaveBeenCalledTimes(1);
  });
});

describe('Auth State to Navigation Route Integration', () => {
  beforeAll(() => {
    __resetAuthInitForTesting();
    vi.clearAllMocks();
  });

  it('derives correct navigation route based on auth state transitions', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    const unauthenticatedState: AuthState = {
      session: false,
      profile: null,
      family: null,
      pendingJoinRequest: false,
      authReady: true,
      storeReady: true,
    };
    expect(resolveRoute(unauthenticatedState)?.path).toBe('/auth/sign-in');
    
    const guardianWithFamilyState: AuthState = {
      session: true,
      profile: { id: 'g1', role: 'guardian', passcode: null, family_id: 'f1' },
      family: { id: 'f1' },
      pendingJoinRequest: false,
      authReady: true,
      storeReady: true,
    };
    expect(resolveRoute(guardianWithFamilyState)?.path).toBe('/(tabs)/today');
    
    const guardianWithoutFamilyState: AuthState = {
      session: true,
      profile: { id: 'g1', role: 'guardian', passcode: null, family_id: null },
      family: null,
      pendingJoinRequest: false,
      authReady: true,
      storeReady: true,
    };
    expect(resolveRoute(guardianWithoutFamilyState)?.path).toBe('/auth/family-setup');
    
    const participantWithFamilyState: AuthState = {
      session: true,
      profile: { id: 'k1', role: 'kid', passcode: '1234', family_id: 'f1' },
      family: { id: 'f1' },
      pendingJoinRequest: false,
      authReady: true,
      storeReady: true,
    };
    expect(resolveRoute(participantWithFamilyState)?.path).toBe('/(tabs)/today');
    
    const participantWithoutFamilyState: AuthState = {
      session: true,
      profile: { id: 'k1', role: 'kid', passcode: '1234', family_id: null },
      family: null,
      pendingJoinRequest: false,
      authReady: true,
      storeReady: true,
    };
    expect(resolveRoute(participantWithoutFamilyState)?.path).toBe('/auth/pending-approval');
  });
});

describe('No Infinite Loop on Rapid State Changes', () => {
  beforeAll(() => {
    __resetAuthInitForTesting();
    vi.clearAllMocks();
  });

  it('handles rapid SIGNED_IN events without multiple getSession calls', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    const initialCallCount = mockGetSession.mock.calls.length;
    
    const session1 = { user: { id: 'u1', email: 'a@b.com', user_metadata: {} }, access_token: 't1' };
    const session2 = { user: { id: 'u2', email: 'c@d.com', user_metadata: {} }, access_token: 't2' };
    const session3 = { user: { id: 'u3', email: 'e@f.com', user_metadata: {} }, access_token: 't3' };
    
    mockFrom.mockReturnValue(createMockFromChain({ id: 'u1', role: 'guardian' }, null));
    
    act(() => {
      mockAuthChangeCallback.current?.('SIGNED_IN', session1);
      mockAuthChangeCallback.current?.('SIGNED_IN', session2);
      mockAuthChangeCallback.current?.('SIGNED_IN', session3);
    });
    
    await waitFor(() => {
      expect(result.current.session).toBeTruthy();
    });
    
    expect(mockGetSession).toHaveBeenCalledTimes(initialCallCount);
  });
});

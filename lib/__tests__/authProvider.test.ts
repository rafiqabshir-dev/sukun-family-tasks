/**
 * AuthProvider Integration Tests
 * 
 * Tests the actual AuthProvider component behavior with mocked Supabase.
 * These tests verify real auth lifecycle events trigger correct state changes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';

type AuthChangeCallback = (event: string, session: any) => void;

const mockAuthChangeCallback: { current: AuthChangeCallback | null } = { current: null };
const mockUnsubscribe = vi.fn();
const mockGetSession = vi.fn();
const mockSignOut = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();
const mockOnAuthStateChange = vi.fn((callback: AuthChangeCallback) => {
  mockAuthChangeCallback.current = callback;
  return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
});
const mockFrom = vi.fn();

vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      signOut: () => mockSignOut(),
      signInWithPassword: (args: any) => mockSignInWithPassword(args),
      signUp: (args: any) => mockSignUp(args),
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
  }),
}));

import { AuthProvider, useAuth, __resetAuthInitForTesting } from '../authContext';

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(AuthProvider, null, children);
}

function createMockFromChain(data: any = null, error: any = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
  };
  return chain;
}

describe('AuthProvider Initialization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthChangeCallback.current = null;
    __resetAuthInitForTesting();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('starts in loading state and triggers init', async () => {
    let resolveGetSession: (value: any) => void;
    const getSessionPromise = new Promise((resolve) => {
      resolveGetSession = resolve;
    });
    mockGetSession.mockReturnValue(getSessionPromise);

    const { result } = renderHook(() => useAuth(), { wrapper });
    
    expect(result.current.loading).toBe(true);
    
    await act(async () => {
      resolveGetSession!({ data: { session: null }, error: null });
    });
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('sets loading to false and authReady to true after getSession with no session', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    expect(result.current.session).toBe(null);
    expect(result.current.profile).toBe(null);
    expect(result.current.authReady).toBe(true);
  });

  it('loads profile when session exists', async () => {
    const mockSession = {
      user: { id: 'user-123', email: 'test@example.com', user_metadata: {} },
      access_token: 'token',
    };

    const mockProfile = {
      id: 'user-123',
      display_name: 'Test User',
      role: 'guardian',
      passcode: null,
      family_id: null,
      powers: [],
    };

    mockGetSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    mockFrom.mockReturnValue(createMockFromChain(mockProfile, null));

    const { result } = renderHook(() => useAuth(), { wrapper });
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 10000 });
    
    expect(result.current.session).toBeTruthy();
  });

  it('clears state when getSession times out', async () => {
    mockGetSession.mockImplementation(() => 
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 100))
    );
    mockSignOut.mockResolvedValue({ error: null });

    const { result } = renderHook(() => useAuth(), { wrapper });
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 10000 });
    
    expect(result.current.session).toBe(null);
  });
});

describe('AuthProvider Auth Events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthChangeCallback.current = null;
    __resetAuthInitForTesting();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('registers auth state change listener on mount', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    renderHook(() => useAuth(), { wrapper });
    
    await waitFor(() => {
      expect(mockOnAuthStateChange).toHaveBeenCalled();
    });
    
    expect(mockAuthChangeCallback.current).not.toBe(null);
  });

  it('handles INITIAL_SESSION event without error', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    act(() => {
      mockAuthChangeCallback.current?.('INITIAL_SESSION', null);
    });
    
    expect(result.current.session).toBe(null);
  });

  it('handles SIGNED_OUT event by clearing all state', async () => {
    const mockSession = {
      user: { id: 'user-123', email: 'test@example.com', user_metadata: {} },
      access_token: 'token',
    };

    mockGetSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });
    
    const mockProfile = {
      id: 'user-123',
      display_name: 'Test User',
      role: 'guardian',
      passcode: null,
      family_id: null,
      powers: [],
    };
    
    mockFrom.mockReturnValue(createMockFromChain(mockProfile, null));
    mockSignOut.mockResolvedValue({ error: null });

    const { result } = renderHook(() => useAuth(), { wrapper });
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    act(() => {
      mockAuthChangeCallback.current?.('SIGNED_OUT', null);
    });
    
    await waitFor(() => {
      expect(result.current.session).toBe(null);
      expect(result.current.user).toBe(null);
      expect(result.current.profile).toBe(null);
      expect(result.current.family).toBe(null);
    });
  });

  it('handles SIGNED_IN event with new session', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    const newSession = {
      user: { id: 'new-user', email: 'new@example.com', user_metadata: { role: 'guardian' } },
      access_token: 'new-token',
    };
    
    const mockProfile = {
      id: 'new-user',
      display_name: 'New User',
      role: 'guardian',
      passcode: null,
      family_id: null,
      powers: [],
    };
    
    mockFrom.mockReturnValue(createMockFromChain(mockProfile, null));
    
    act(() => {
      mockAuthChangeCallback.current?.('SIGNED_IN', newSession);
    });
    
    await waitFor(() => {
      expect(result.current.session).toBeTruthy();
    });
  });

  it('handles TOKEN_REFRESHED event by updating session', async () => {
    const mockSession = {
      user: { id: 'user-123', email: 'test@example.com', user_metadata: {} },
      access_token: 'old-token',
    };

    mockGetSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });
    
    const mockProfile = {
      id: 'user-123',
      display_name: 'Test User',
      role: 'guardian',
      passcode: null,
      family_id: null,
      powers: [],
    };
    
    mockFrom.mockReturnValue(createMockFromChain(mockProfile, null));

    const { result } = renderHook(() => useAuth(), { wrapper });
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    const refreshedSession = {
      ...mockSession,
      access_token: 'new-token',
    };
    
    act(() => {
      mockAuthChangeCallback.current?.('TOKEN_REFRESHED', refreshedSession);
    });
    
    await waitFor(() => {
      expect(result.current.session).toBeTruthy();
    });
  });
});

describe('AuthProvider State Shape', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthChangeCallback.current = null;
    __resetAuthInitForTesting();
  });

  it('exposes correct shape for unauthenticated state', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    expect(result.current).toMatchObject({
      session: null,
      user: null,
      profile: null,
      family: null,
      loading: false,
      isConfigured: true,
      persona: null,
      authReady: true,
    });
  });

  it('provides signOut function that can be called', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    mockSignOut.mockResolvedValue({ error: null });

    const { result } = renderHook(() => useAuth(), { wrapper });
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    expect(typeof result.current.signOut).toBe('function');
  });
});

describe('AuthProvider Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthChangeCallback.current = null;
    __resetAuthInitForTesting();
  });

  it('handles getSession error gracefully', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: new Error('Session fetch failed'),
    });
    mockSignOut.mockResolvedValue({ error: null });

    const { result } = renderHook(() => useAuth(), { wrapper });
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    expect(result.current.session).toBe(null);
    expect(result.current.authReady).toBe(true);
  });

  it('handles profile fetch failure during sign-in', async () => {
    const mockSession = {
      user: { id: 'user-123', email: 'test@example.com', user_metadata: {} },
      access_token: 'token',
    };

    mockGetSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });
    
    mockFrom.mockReturnValue(createMockFromChain(null, new Error('Profile not found')));
    mockSignOut.mockResolvedValue({ error: null });

    const { result } = renderHook(() => useAuth(), { wrapper });
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 10000 });
  });
});

describe('Module-level Init Flag Behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthChangeCallback.current = null;
    __resetAuthInitForTesting();
  });

  it('only runs initialization once per app lifecycle (prevents double init)', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const { result: result1, unmount: unmount1 } = renderHook(() => useAuth(), { wrapper });
    
    await waitFor(() => {
      expect(result1.current.loading).toBe(false);
    });
    
    expect(mockGetSession).toHaveBeenCalledTimes(1);
    
    unmount1();
    
    const { result: result2 } = renderHook(() => useAuth(), { wrapper });
    
    await waitFor(() => {
      expect(result2.current.loading).toBe(false);
    });
    
    expect(mockGetSession).toHaveBeenCalledTimes(1);
  });

  it('SIGNED_OUT resets flag, enabling getSession on next mount', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const { result, unmount } = renderHook(() => useAuth(), { wrapper });
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    expect(mockGetSession).toHaveBeenCalledTimes(1);
    
    act(() => {
      mockAuthChangeCallback.current?.('SIGNED_OUT', null);
    });
    
    unmount();
    
    const { result: result2 } = renderHook(() => useAuth(), { wrapper });
    
    await waitFor(() => {
      expect(result2.current.loading).toBe(false);
    });
    
    expect(mockGetSession).toHaveBeenCalledTimes(2);
  });

  it('prevents infinite init loop by not calling getSession multiple times on rapid remounts', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const { unmount: unmount1 } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(mockGetSession).toHaveBeenCalledTimes(1));
    unmount1();
    
    const { unmount: unmount2 } = renderHook(() => useAuth(), { wrapper });
    unmount2();
    
    const { unmount: unmount3 } = renderHook(() => useAuth(), { wrapper });
    unmount3();
    
    const { result: result4 } = renderHook(() => useAuth(), { wrapper });
    
    await waitFor(() => {
      expect(result4.current.loading).toBe(false);
    });
    
    expect(mockGetSession).toHaveBeenCalledTimes(1);
  });
});

describe('Regression: Infinite Initialization Loop Prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthChangeCallback.current = null;
    __resetAuthInitForTesting();
  });

  it('does not call getSession more than once during initial load', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(mockGetSession).toHaveBeenCalledTimes(1);
  });

  it('after timeout recovery, state is cleared and getSession not retried automatically', async () => {
    let callCount = 0;
    mockGetSession.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 50));
      }
      return Promise.resolve({ data: { session: null }, error: null });
    });
    mockSignOut.mockResolvedValue({ error: null });

    const { result } = renderHook(() => useAuth(), { wrapper });
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 10000 });
    
    expect(result.current.session).toBe(null);
    expect(result.current.authReady).toBe(true);
    
    expect(callCount).toBe(1);
  });

  it('SIGNED_IN event after init does not trigger duplicate getSession', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    expect(mockGetSession).toHaveBeenCalledTimes(1);
    
    const newSession = {
      user: { id: 'new-user', email: 'new@example.com', user_metadata: {} },
      access_token: 'token',
    };
    
    mockFrom.mockReturnValue(createMockFromChain({ id: 'new-user', role: 'guardian' }, null));
    
    act(() => {
      mockAuthChangeCallback.current?.('SIGNED_IN', newSession);
    });
    
    await waitFor(() => {
      expect(result.current.session).toBeTruthy();
    });
    
    expect(mockGetSession).toHaveBeenCalledTimes(1);
  });
});

/**
 * Push Notification Service Tests
 *
 * Tests all notification functions with mocked cloudSync and push API.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetchPushTokensForFamily = vi.fn();
const mockPushSend = vi.fn();

vi.mock('../cloudSync', () => ({
  fetchPushTokensForFamily: (...args: any[]) => mockFetchPushTokensForFamily(...args),
}));

vi.mock('../api', () => ({
  push: {
    send: (...args: any[]) => mockPushSend(...args),
  },
}));

import {
  notifyTaskAssigned,
  notifyTaskPendingApproval,
  notifyTaskApproved,
  notifyTaskRejected,
  notifyJoinRequest,
  notifyRewardClaimed,
} from '../pushNotificationService';

const FAMILY_ID = 'family-123';

const mockTokens = [
  { profileId: 'guardian-1', pushToken: 'ExponentPushToken[guardian1]', role: 'guardian' },
  { profileId: 'guardian-2', pushToken: 'ExponentPushToken[guardian2]', role: 'guardian' },
  { profileId: 'kid-1', pushToken: 'ExponentPushToken[kid1]', role: 'kid' },
  { profileId: 'kid-2', pushToken: 'ExponentPushToken[kid2]', role: 'kid' },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchPushTokensForFamily.mockResolvedValue({ tokens: mockTokens, error: null });
  mockPushSend.mockResolvedValue({ data: [] });
});

describe('notifyTaskAssigned', () => {
  it('sends notification to the correct assignee', async () => {
    await notifyTaskAssigned(FAMILY_ID, 'kid-1', 'Clean Room', 'Mom');

    expect(mockFetchPushTokensForFamily).toHaveBeenCalledWith(FAMILY_ID);
    expect(mockPushSend).toHaveBeenCalledWith([
      expect.objectContaining({
        to: 'ExponentPushToken[kid1]',
        title: 'New Task Assigned',
        body: 'Mom assigned you: Clean Room',
      }),
    ]);
  });

  it('skips when assignee has no push token', async () => {
    await notifyTaskAssigned(FAMILY_ID, 'kid-no-token', 'Clean Room', 'Mom');

    expect(mockPushSend).not.toHaveBeenCalled();
  });

  it('skips when token list is empty', async () => {
    mockFetchPushTokensForFamily.mockResolvedValue({ tokens: [], error: null });

    await notifyTaskAssigned(FAMILY_ID, 'kid-1', 'Clean Room', 'Mom');

    expect(mockPushSend).not.toHaveBeenCalled();
  });
});

describe('notifyTaskPendingApproval', () => {
  it('sends to all guardians except the completer', async () => {
    await notifyTaskPendingApproval(FAMILY_ID, 'Ahmad', 'Clean Room', 'guardian-1');

    expect(mockPushSend).toHaveBeenCalledWith([
      expect.objectContaining({
        to: 'ExponentPushToken[guardian2]',
        title: 'Task Awaiting Approval',
        body: 'Ahmad completed: Clean Room',
      }),
    ]);
    // Should NOT include guardian-1 (the completer)
    const messages = mockPushSend.mock.calls[0][0];
    expect(messages).toHaveLength(1);
    expect(messages[0].to).not.toBe('ExponentPushToken[guardian1]');
  });

  it('skips when no guardians have push tokens', async () => {
    mockFetchPushTokensForFamily.mockResolvedValue({
      tokens: [{ profileId: 'kid-1', pushToken: 'ExponentPushToken[kid1]', role: 'kid' }],
      error: null,
    });

    await notifyTaskPendingApproval(FAMILY_ID, 'Ahmad', 'Clean Room', 'kid-1');

    expect(mockPushSend).not.toHaveBeenCalled();
  });

  it('sends to all guardians when completer is a kid', async () => {
    await notifyTaskPendingApproval(FAMILY_ID, 'Ahmad', 'Clean Room', 'kid-1');

    const messages = mockPushSend.mock.calls[0][0];
    expect(messages).toHaveLength(2);
  });
});

describe('notifyTaskApproved', () => {
  it('sends to assignee with star count in body', async () => {
    await notifyTaskApproved(FAMILY_ID, 'kid-1', 'Clean Room', 3);

    expect(mockPushSend).toHaveBeenCalledWith([
      expect.objectContaining({
        to: 'ExponentPushToken[kid1]',
        title: 'Task Approved!',
        body: 'Great job! You earned 3 stars for: Clean Room',
      }),
    ]);
  });

  it('skips when assignee has no push token', async () => {
    await notifyTaskApproved(FAMILY_ID, 'unknown-kid', 'Clean Room', 3);

    expect(mockPushSend).not.toHaveBeenCalled();
  });
});

describe('notifyTaskRejected', () => {
  it('includes reason when provided', async () => {
    await notifyTaskRejected(FAMILY_ID, 'kid-1', 'Clean Room', 'Not done properly');

    expect(mockPushSend).toHaveBeenCalledWith([
      expect.objectContaining({
        to: 'ExponentPushToken[kid1]',
        title: 'Task Needs Redo',
        body: 'Clean Room: Not done properly',
      }),
    ]);
  });

  it('uses fallback message when no reason', async () => {
    await notifyTaskRejected(FAMILY_ID, 'kid-1', 'Clean Room');

    expect(mockPushSend).toHaveBeenCalledWith([
      expect.objectContaining({
        body: 'Please redo: Clean Room',
      }),
    ]);
  });

  it('skips when assignee has no push token', async () => {
    await notifyTaskRejected(FAMILY_ID, 'unknown-kid', 'Clean Room');

    expect(mockPushSend).not.toHaveBeenCalled();
  });
});

describe('notifyJoinRequest', () => {
  it('sends to all guardians', async () => {
    await notifyJoinRequest(FAMILY_ID, 'New Kid');

    const messages = mockPushSend.mock.calls[0][0];
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({
      to: 'ExponentPushToken[guardian1]',
      title: 'Family Join Request',
      body: 'New Kid wants to join your family',
    });
    expect(messages[1]).toMatchObject({
      to: 'ExponentPushToken[guardian2]',
    });
  });

  it('skips when no guardians have push tokens', async () => {
    mockFetchPushTokensForFamily.mockResolvedValue({
      tokens: [{ profileId: 'kid-1', pushToken: 'ExponentPushToken[kid1]', role: 'kid' }],
      error: null,
    });

    await notifyJoinRequest(FAMILY_ID, 'New Kid');

    expect(mockPushSend).not.toHaveBeenCalled();
  });
});

describe('notifyRewardClaimed', () => {
  it('sends to all guardians with reward details', async () => {
    await notifyRewardClaimed(FAMILY_ID, 'Ahmad', 'Ice Cream', 10);

    const messages = mockPushSend.mock.calls[0][0];
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({
      title: 'Reward Claimed',
      body: 'Ahmad claimed: Ice Cream (10 stars)',
    });
  });
});

describe('error handling', () => {
  it('does not throw when fetch tokens returns error', async () => {
    mockFetchPushTokensForFamily.mockResolvedValue({
      tokens: [],
      error: new Error('Database error'),
    });

    await expect(notifyTaskAssigned(FAMILY_ID, 'kid-1', 'Task', 'Mom')).resolves.toBeUndefined();
    expect(mockPushSend).not.toHaveBeenCalled();
  });

  it('does not throw when push.send fails', async () => {
    mockPushSend.mockRejectedValue(new Error('Network error'));

    await expect(notifyTaskApproved(FAMILY_ID, 'kid-1', 'Task', 3)).resolves.toBeUndefined();
  });

  it('does not throw when fetch tokens throws', async () => {
    mockFetchPushTokensForFamily.mockRejectedValue(new Error('Unexpected error'));

    await expect(notifyJoinRequest(FAMILY_ID, 'New Kid')).resolves.toBeUndefined();
  });

  it('handles empty token list gracefully for all functions', async () => {
    mockFetchPushTokensForFamily.mockResolvedValue({ tokens: [], error: null });

    await expect(notifyTaskAssigned(FAMILY_ID, 'kid-1', 'Task', 'Mom')).resolves.toBeUndefined();
    await expect(notifyTaskPendingApproval(FAMILY_ID, 'Kid', 'Task', 'kid-1')).resolves.toBeUndefined();
    await expect(notifyTaskApproved(FAMILY_ID, 'kid-1', 'Task', 1)).resolves.toBeUndefined();
    await expect(notifyTaskRejected(FAMILY_ID, 'kid-1', 'Task')).resolves.toBeUndefined();
    await expect(notifyJoinRequest(FAMILY_ID, 'Kid')).resolves.toBeUndefined();
    await expect(notifyRewardClaimed(FAMILY_ID, 'Kid', 'Reward', 5)).resolves.toBeUndefined();

    expect(mockPushSend).not.toHaveBeenCalled();
  });
});

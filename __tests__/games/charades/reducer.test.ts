import { gameReducer, createInitialState } from '../../../lib/games/charades/reducer';
import { GameState, Player, DEFAULT_SETTINGS } from '../../../lib/games/charades/types';

describe('createInitialState', () => {
  it('creates initial state with default players when none provided', () => {
    const state = createInitialState();
    
    expect(state.status).toBe('SETUP');
    expect(state.players.length).toBe(3);
    expect(state.settings).toEqual(DEFAULT_SETTINGS);
    expect(state.turns).toEqual([]);
    expect(state.currentTurnIndex).toBe(0);
    expect(state.usedWordIds.size).toBe(0);
  });

  it('creates initial state with provided players', () => {
    const players: Player[] = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ];
    const state = createInitialState(players);
    
    expect(state.players).toEqual(players);
  });
});

describe('gameReducer', () => {
  let initialState: GameState;

  beforeEach(() => {
    initialState = createInitialState([
      { id: '1', name: 'Player 1' },
      { id: '2', name: 'Player 2' },
    ]);
  });

  describe('SET_PLAYERS', () => {
    it('updates the players list', () => {
      const newPlayers = [{ id: 'a', name: 'Alice' }];
      const result = gameReducer(initialState, {
        type: 'SET_PLAYERS',
        players: newPlayers,
      });
      
      expect(result.players).toEqual(newPlayers);
    });
  });

  describe('UPDATE_SETTINGS', () => {
    it('updates settings partially', () => {
      const result = gameReducer(initialState, {
        type: 'UPDATE_SETTINGS',
        settings: { roundTimeSec: 45 },
      });
      
      expect(result.settings.roundTimeSec).toBe(45);
      expect(result.settings.roundsPerPlayer).toBe(DEFAULT_SETTINGS.roundsPerPlayer);
    });

    it('updates timeRemaining when roundTimeSec changes', () => {
      const result = gameReducer(initialState, {
        type: 'UPDATE_SETTINGS',
        settings: { roundTimeSec: 20 },
      });
      
      expect(result.timeRemaining).toBe(20);
    });
  });

  describe('START_GAME', () => {
    it('transitions to PASS status', () => {
      const result = gameReducer(initialState, { type: 'START_GAME' });
      
      expect(result.status).toBe('PASS');
      expect(result.turns).toEqual([]);
      expect(result.currentTurnIndex).toBe(0);
      expect(result.usedWordIds.size).toBe(0);
    });
  });

  describe('PLAYER_READY', () => {
    it('transitions to REVEAL and creates a turn', () => {
      const gameStarted = gameReducer(initialState, { type: 'START_GAME' });
      const result = gameReducer(gameStarted, {
        type: 'PLAYER_READY',
        wordId: 'w1',
        wordText: 'Test Word',
        wordCategory: 'animals',
      });
      
      expect(result.status).toBe('REVEAL');
      expect(result.turns.length).toBe(1);
      expect(result.turns[0].wordId).toBe('w1');
      expect(result.turns[0].wordText).toBe('Test Word');
      expect(result.turns[0].playerId).toBe('1');
      expect(result.usedWordIds.has('w1')).toBe(true);
    });
  });

  describe('REVEAL_COMPLETE', () => {
    it('transitions to ACT', () => {
      let state = gameReducer(initialState, { type: 'START_GAME' });
      state = gameReducer(state, {
        type: 'PLAYER_READY',
        wordId: 'w1',
        wordText: 'Test',
        wordCategory: 'animals',
      });
      const result = gameReducer(state, { type: 'REVEAL_COMPLETE' });
      
      expect(result.status).toBe('ACT');
    });
  });

  describe('TICK', () => {
    it('decrements time remaining', () => {
      let state = { ...initialState, status: 'ACT' as const, timeRemaining: 30 };
      const result = gameReducer(state, { type: 'TICK' });
      
      expect(result.timeRemaining).toBe(29);
    });

    it('transitions to RESULT when time runs out', () => {
      let state = { ...initialState, status: 'ACT' as const, timeRemaining: 1 };
      const result = gameReducer(state, { type: 'TICK' });
      
      expect(result.status).toBe('RESULT');
      expect(result.timeRemaining).toBe(0);
    });

    it('does nothing when paused', () => {
      let state = { ...initialState, status: 'ACT' as const, timeRemaining: 30, timerPaused: true };
      const result = gameReducer(state, { type: 'TICK' });
      
      expect(result.timeRemaining).toBe(30);
    });
  });

  describe('TOGGLE_PAUSE', () => {
    it('toggles the pause state', () => {
      let state = { ...initialState, timerPaused: false };
      let result = gameReducer(state, { type: 'TOGGLE_PAUSE' });
      expect(result.timerPaused).toBe(true);
      
      result = gameReducer(result, { type: 'TOGGLE_PAUSE' });
      expect(result.timerPaused).toBe(false);
    });
  });

  describe('END_EARLY', () => {
    it('transitions to RESULT', () => {
      let state = { ...initialState, status: 'ACT' as const };
      const result = gameReducer(state, { type: 'END_EARLY' });
      
      expect(result.status).toBe('RESULT');
    });
  });

  describe('RECORD_RESULT', () => {
    it('records guessed result and advances turn', () => {
      let state = createInitialState([
        { id: '1', name: 'Player 1' },
        { id: '2', name: 'Player 2' },
      ]);
      state = gameReducer(state, { type: 'START_GAME' });
      state = gameReducer(state, {
        type: 'PLAYER_READY',
        wordId: 'w1',
        wordText: 'Test',
        wordCategory: 'animals',
      });
      
      const result = gameReducer(state, { type: 'RECORD_RESULT', result: 'guessed' });
      
      expect(result.turns[0].result).toBe('guessed');
      expect(result.currentTurnIndex).toBe(1);
    });

    it('transitions to SUMMARY when all turns complete', () => {
      let state = createInitialState([
        { id: '1', name: 'Player 1' },
      ]);
      state.settings.roundsPerPlayer = 1;
      state = gameReducer(state, { type: 'START_GAME' });
      state = gameReducer(state, {
        type: 'PLAYER_READY',
        wordId: 'w1',
        wordText: 'Test',
        wordCategory: 'animals',
      });
      
      const result = gameReducer(state, { type: 'RECORD_RESULT', result: 'guessed' });
      
      expect(result.status).toBe('SUMMARY');
    });
  });

  describe('PLAY_AGAIN', () => {
    it('resets game state but keeps players and settings', () => {
      let state = createInitialState([{ id: '1', name: 'Test' }]);
      state.settings.roundsPerPlayer = 2;
      state.turns = [{ turnIndex: 0, playerId: '1', wordId: 'w1', wordText: 'Test', category: 'animals', result: 'guessed' }];
      state.currentTurnIndex = 1;
      
      const result = gameReducer(state, { type: 'PLAY_AGAIN' });
      
      expect(result.status).toBe('PASS');
      expect(result.turns).toEqual([]);
      expect(result.currentTurnIndex).toBe(0);
      expect(result.usedWordIds.size).toBe(0);
      expect(result.players).toEqual([{ id: '1', name: 'Test' }]);
      expect(result.settings.roundsPerPlayer).toBe(2);
    });
  });

  describe('CHANGE_SETTINGS', () => {
    it('transitions back to SETUP', () => {
      let state = { ...initialState, status: 'SUMMARY' as const };
      const result = gameReducer(state, { type: 'CHANGE_SETTINGS' });
      
      expect(result.status).toBe('SETUP');
    });
  });
});

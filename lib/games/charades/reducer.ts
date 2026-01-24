import { GameState, GameAction, DEFAULT_SETTINGS, Player } from './types';

export function createInitialState(familyMembers?: Player[]): GameState {
  const defaultPlayers: Player[] = familyMembers && familyMembers.length > 0
    ? familyMembers
    : [
        { id: '1', name: 'Player 1' },
        { id: '2', name: 'Player 2' },
        { id: '3', name: 'Player 3' },
      ];

  return {
    status: 'SETUP',
    players: defaultPlayers,
    settings: { ...DEFAULT_SETTINGS },
    turns: [],
    currentTurnIndex: 0,
    usedWordIds: new Set(),
    timerPaused: false,
    timeRemaining: DEFAULT_SETTINGS.roundTimeSec,
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_PLAYERS':
      return {
        ...state,
        players: action.players,
      };

    case 'UPDATE_SETTINGS':
      const newSettings = { ...state.settings, ...action.settings };
      return {
        ...state,
        settings: newSettings,
        timeRemaining: newSettings.roundTimeSec,
      };

    case 'START_GAME':
      return {
        ...state,
        status: 'PASS',
        turns: [],
        currentTurnIndex: 0,
        usedWordIds: new Set(),
        timerPaused: false,
        timeRemaining: state.settings.roundTimeSec,
      };

    case 'PLAYER_READY': {
      const currentPlayerIndex = state.currentTurnIndex % state.players.length;
      const currentPlayer = state.players[currentPlayerIndex];
      
      const newTurn = {
        turnIndex: state.currentTurnIndex,
        playerId: currentPlayer.id,
        wordId: action.wordId,
        wordText: action.wordText,
        category: action.wordCategory,
        result: null as 'guessed' | 'skipped' | null,
        guesserId: null as string | null,
      };

      const newUsedWordIds = new Set(state.usedWordIds);
      newUsedWordIds.add(action.wordId);

      return {
        ...state,
        status: 'REVEAL',
        turns: [...state.turns, newTurn],
        usedWordIds: newUsedWordIds,
        timerPaused: false,
        timeRemaining: state.settings.roundTimeSec,
      };
    }

    case 'REVEAL_COMPLETE':
      return {
        ...state,
        status: 'ACT',
        timerPaused: false,
      };

    case 'TICK':
      if (state.timerPaused || state.status !== 'ACT') {
        return state;
      }
      const newTime = state.timeRemaining - 1;
      if (newTime <= 0) {
        return {
          ...state,
          status: 'RESULT',
          timeRemaining: 0,
        };
      }
      return {
        ...state,
        timeRemaining: newTime,
      };

    case 'TOGGLE_PAUSE':
      return {
        ...state,
        timerPaused: !state.timerPaused,
      };

    case 'END_EARLY':
      return {
        ...state,
        status: 'RESULT',
      };

    case 'RECORD_RESULT': {
      const updatedTurns = [...state.turns];
      const lastTurnIndex = updatedTurns.length - 1;
      if (lastTurnIndex >= 0) {
        updatedTurns[lastTurnIndex] = {
          ...updatedTurns[lastTurnIndex],
          result: action.result,
          guesserId: action.guesserId || null,
        };
      }

      const totalRoundsNeeded = state.players.length * state.settings.roundsPerPlayer;
      const nextTurnIndex = state.currentTurnIndex + 1;

      if (nextTurnIndex >= totalRoundsNeeded) {
        return {
          ...state,
          status: 'SUMMARY',
          turns: updatedTurns,
          currentTurnIndex: nextTurnIndex,
        };
      }

      return {
        ...state,
        turns: updatedTurns,
        currentTurnIndex: nextTurnIndex,
      };
    }

    case 'NEXT_TURN': {
      const currentPlayerIndex = state.currentTurnIndex % state.players.length;
      const currentPlayer = state.players[currentPlayerIndex];

      const newTurn = {
        turnIndex: state.currentTurnIndex,
        playerId: currentPlayer.id,
        wordId: action.wordId,
        wordText: action.wordText,
        category: action.wordCategory,
        result: null as 'guessed' | 'skipped' | null,
        guesserId: null as string | null,
      };

      const newUsedWordIds = new Set(state.usedWordIds);
      newUsedWordIds.add(action.wordId);

      return {
        ...state,
        status: 'REVEAL',
        turns: [...state.turns, newTurn],
        usedWordIds: newUsedWordIds,
        timerPaused: false,
        timeRemaining: state.settings.roundTimeSec,
      };
    }

    case 'PLAY_AGAIN':
      return {
        ...state,
        status: 'PASS',
        turns: [],
        currentTurnIndex: 0,
        usedWordIds: new Set(),
        timerPaused: false,
        timeRemaining: state.settings.roundTimeSec,
      };

    case 'CHANGE_SETTINGS':
      return {
        ...state,
        status: 'SETUP',
        turns: [],
        currentTurnIndex: 0,
      };

    case 'RESET':
      return createInitialState();

    default:
      return state;
  }
}

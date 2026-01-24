export interface Player {
  id: string;
  name: string;
}

export interface Settings {
  roundTimeSec: 20 | 30 | 45;
  roundsPerPlayer: number;
  category: 'all' | 'animals' | 'food' | 'actions' | 'objects';
}

export interface Turn {
  turnIndex: number;
  playerId: string;
  wordId: string;
  wordText: string;
  category: string;
  result: 'guessed' | 'skipped' | null;
  guesserId: string | null;
}

export type GameStatus = 'SETUP' | 'PASS' | 'REVEAL' | 'ACT' | 'RESULT' | 'SUMMARY';

export interface GameState {
  status: GameStatus;
  players: Player[];
  settings: Settings;
  turns: Turn[];
  currentTurnIndex: number;
  usedWordIds: Set<string>;
  timerPaused: boolean;
  timeRemaining: number;
}

export type GameAction =
  | { type: 'SET_PLAYERS'; players: Player[] }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<Settings> }
  | { type: 'START_GAME' }
  | { type: 'PLAYER_READY'; wordId: string; wordText: string; wordCategory: string }
  | { type: 'CHANGE_WORD'; wordId: string; wordText: string; wordCategory: string }
  | { type: 'REVEAL_COMPLETE' }
  | { type: 'TICK' }
  | { type: 'TOGGLE_PAUSE' }
  | { type: 'END_EARLY' }
  | { type: 'RECORD_RESULT'; result: 'guessed' | 'skipped'; guesserId?: string }
  | { type: 'NEXT_TURN'; wordId: string; wordText: string; wordCategory: string }
  | { type: 'PLAY_AGAIN' }
  | { type: 'CHANGE_SETTINGS' }
  | { type: 'RESET' };

export const DEFAULT_SETTINGS: Settings = {
  roundTimeSec: 30,
  roundsPerPlayer: 3,
  category: 'all',
};

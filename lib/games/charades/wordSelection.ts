import { WORD_BANK, Word, WordCategory } from './wordBank';
import { Settings } from './types';

export interface SelectWordParams {
  category: Settings['category'];
  usedWordIds: Set<string>;
}

export function selectNextWord({ category, usedWordIds }: SelectWordParams): Word {
  let availableWords: Word[];

  if (category === 'all') {
    availableWords = WORD_BANK;
  } else {
    availableWords = WORD_BANK.filter(w => w.category === category);
  }

  if (availableWords.length === 0) {
    availableWords = WORD_BANK;
  }

  let unusedWords = availableWords.filter(w => !usedWordIds.has(w.id));

  if (unusedWords.length === 0) {
    unusedWords = availableWords;
  }

  const randomIndex = Math.floor(Math.random() * unusedWords.length);
  return unusedWords[randomIndex];
}

export function getWordsByCategory(category: WordCategory | 'all'): Word[] {
  if (category === 'all') {
    return WORD_BANK;
  }
  return WORD_BANK.filter(w => w.category === category);
}

export function getTotalWordsCount(): number {
  return WORD_BANK.length;
}

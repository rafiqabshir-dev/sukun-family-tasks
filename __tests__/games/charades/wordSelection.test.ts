import { selectNextWord, getWordsByCategory, getTotalWordsCount } from '../../../lib/games/charades/wordSelection';
import { WORD_BANK } from '../../../lib/games/charades/wordBank';

describe('selectNextWord', () => {
  it('returns a word from the word bank', () => {
    const result = selectNextWord({
      category: 'all',
      usedWordIds: new Set(),
    });

    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(result.text).toBeDefined();
    expect(result.category).toBeDefined();
  });

  it('returns only words from the specified category', () => {
    const category = 'animals';
    
    for (let i = 0; i < 10; i++) {
      const result = selectNextWord({
        category,
        usedWordIds: new Set(),
      });
      expect(result.category).toBe(category);
    }
  });

  it('does not repeat words until all are used', () => {
    const category = 'food';
    const foodWords = WORD_BANK.filter(w => w.category === category);
    const usedWordIds = new Set<string>();
    const selectedWords: string[] = [];

    for (let i = 0; i < foodWords.length; i++) {
      const result = selectNextWord({
        category,
        usedWordIds,
      });
      
      expect(selectedWords).not.toContain(result.id);
      selectedWords.push(result.id);
      usedWordIds.add(result.id);
    }

    expect(selectedWords.length).toBe(foodWords.length);
  });

  it('allows repeats when all words are used', () => {
    const category = 'objects';
    const objectWords = WORD_BANK.filter(w => w.category === category);
    const allUsedIds = new Set(objectWords.map(w => w.id));

    const result = selectNextWord({
      category,
      usedWordIds: allUsedIds,
    });

    expect(result).toBeDefined();
    expect(result.category).toBe(category);
  });

  it('handles "all" category correctly', () => {
    const usedWordIds = new Set<string>();
    const categories = new Set<string>();

    for (let i = 0; i < 20; i++) {
      const result = selectNextWord({
        category: 'all',
        usedWordIds,
      });
      categories.add(result.category);
      usedWordIds.add(result.id);
    }

    expect(categories.size).toBeGreaterThan(1);
  });
});

describe('getWordsByCategory', () => {
  it('returns all words for "all" category', () => {
    const result = getWordsByCategory('all');
    expect(result.length).toBe(WORD_BANK.length);
  });

  it('returns only animals for "animals" category', () => {
    const result = getWordsByCategory('animals');
    expect(result.every(w => w.category === 'animals')).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns only food for "food" category', () => {
    const result = getWordsByCategory('food');
    expect(result.every(w => w.category === 'food')).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('getTotalWordsCount', () => {
  it('returns the total number of words in the bank', () => {
    const count = getTotalWordsCount();
    expect(count).toBe(WORD_BANK.length);
    expect(count).toBeGreaterThanOrEqual(160);
  });
});

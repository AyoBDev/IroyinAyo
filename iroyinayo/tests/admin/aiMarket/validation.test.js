const {
  VALID_CATEGORIES, MAX_CLOSE_DAYS,
  validatePrompt, validateDraft, validateTrendSuggestion,
} = require('../../../src/modules/admin/aiMarket/validation');

const validDraft = () => ({
  title: 'Will UNILAG beat OAU on Saturday?',
  outcomes: ['UNILAG wins', 'OAU wins', 'Draw'],
  category: 'sports',
  closesAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  description: 'Resolves to the winner of the UNILAG vs OAU football match.',
});

describe('validatePrompt', () => {
  test('accepts a 50-char prompt', () => {
    expect(validatePrompt('UNILAG vs OAU football match this Saturday at 4pm').ok).toBe(true);
  });
  test('rejects empty', () => {
    expect(validatePrompt('').ok).toBe(false);
  });
  test('rejects <5 chars', () => {
    expect(validatePrompt('abcd').ok).toBe(false);
  });
  test('rejects >500 chars', () => {
    expect(validatePrompt('a'.repeat(501)).ok).toBe(false);
  });
  test('rejects non-string', () => {
    expect(validatePrompt(null).ok).toBe(false);
    expect(validatePrompt(42).ok).toBe(false);
  });
});

describe('validateDraft', () => {
  test('accepts a valid draft', () => {
    expect(validateDraft(validDraft()).ok).toBe(true);
  });

  test('rejects title <10 chars', () => {
    const d = validDraft(); d.title = 'short';
    const r = validateDraft(d); expect(r.ok).toBe(false); expect(r.field).toBe('title');
  });

  test('rejects title >200 chars', () => {
    const d = validDraft(); d.title = 'x'.repeat(201);
    expect(validateDraft(d).ok).toBe(false);
  });

  test('rejects <2 outcomes', () => {
    const d = validDraft(); d.outcomes = ['only one'];
    const r = validateDraft(d); expect(r.ok).toBe(false); expect(r.field).toBe('outcomes');
  });

  test('rejects >4 outcomes', () => {
    const d = validDraft(); d.outcomes = ['a', 'b', 'c', 'd', 'e'];
    expect(validateDraft(d).ok).toBe(false);
  });

  test('rejects duplicate outcomes (case-insensitive trim)', () => {
    const d = validDraft(); d.outcomes = ['UNILAG wins', '  unilag wins  '];
    expect(validateDraft(d).ok).toBe(false);
  });

  test('rejects outcome >60 chars', () => {
    const d = validDraft(); d.outcomes = ['a', 'b'.repeat(61)];
    expect(validateDraft(d).ok).toBe(false);
  });

  test('rejects empty outcome string', () => {
    const d = validDraft(); d.outcomes = ['valid', ''];
    expect(validateDraft(d).ok).toBe(false);
  });

  test('rejects invalid category', () => {
    const d = validDraft(); d.category = 'politics';
    const r = validateDraft(d); expect(r.ok).toBe(false); expect(r.field).toBe('category');
  });

  test('rejects past closesAt', () => {
    const d = validDraft(); d.closesAt = new Date(Date.now() - 1000).toISOString();
    expect(validateDraft(d).ok).toBe(false);
  });

  test('rejects closesAt >90 days out', () => {
    const d = validDraft(); d.closesAt = new Date(Date.now() + 91 * 24 * 60 * 60 * 1000).toISOString();
    expect(validateDraft(d).ok).toBe(false);
  });

  test('rejects malformed closesAt', () => {
    const d = validDraft(); d.closesAt = 'not-a-date';
    expect(validateDraft(d).ok).toBe(false);
  });

  test('accepts missing description (optional)', () => {
    const d = validDraft(); delete d.description;
    expect(validateDraft(d).ok).toBe(true);
  });

  test('rejects description >500 chars', () => {
    const d = validDraft(); d.description = 'x'.repeat(501);
    expect(validateDraft(d).ok).toBe(false);
  });
});

describe('validateTrendSuggestion', () => {
  test('accepts a valid suggestion', () => {
    expect(validateTrendSuggestion({
      title: 'Will UNILAG beat OAU Saturday?',
      source: 'Goal Nigeria',
      url: 'https://example.com/x',
      category: 'sports',
    }).ok).toBe(true);
  });

  test('rejects bad URL', () => {
    expect(validateTrendSuggestion({
      title: 'Will UNILAG beat OAU Saturday?',
      source: 'x', url: 'not-a-url', category: 'sports',
    }).ok).toBe(false);
  });

  test('rejects invalid category', () => {
    expect(validateTrendSuggestion({
      title: 'Will UNILAG beat OAU Saturday?',
      source: 'x', url: 'https://e.com', category: 'politics',
    }).ok).toBe(false);
  });
});

describe('VALID_CATEGORIES', () => {
  test('has all 8', () => {
    expect(VALID_CATEGORIES).toEqual([
      'scholarships', 'entertainment', 'tech', 'sports',
      'campus_news', 'career', 'health', 'academic',
    ]);
  });
});

describe('MAX_CLOSE_DAYS', () => {
  test('is 90', () => {
    expect(MAX_CLOSE_DAYS).toBe(90);
  });
});

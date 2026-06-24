const VALID_CATEGORIES = [
  'scholarships', 'entertainment', 'tech', 'sports',
  'campus_news', 'career', 'health', 'academic',
];
const MAX_CLOSE_DAYS = 90;
const PROMPT_MIN = 5;
const PROMPT_MAX = 500;
const TITLE_MIN = 10;
const TITLE_MAX = 200;
const OUTCOMES_MIN = 2;
const OUTCOMES_MAX = 4;
const OUTCOME_LABEL_MAX = 60;
const DESCRIPTION_MAX = 500;

function validatePrompt(prompt) {
  if (typeof prompt !== 'string') return { ok: false, error: 'prompt must be a string' };
  const trimmed = prompt.trim();
  if (trimmed.length < PROMPT_MIN) return { ok: false, error: `prompt must be at least ${PROMPT_MIN} chars` };
  if (trimmed.length > PROMPT_MAX) return { ok: false, error: `prompt must be at most ${PROMPT_MAX} chars` };
  return { ok: true };
}

function validateDraft(draft) {
  if (!draft || typeof draft !== 'object') return { ok: false, error: 'draft must be an object' };

  // title
  if (typeof draft.title !== 'string') return { ok: false, error: 'title must be a string', field: 'title' };
  const title = draft.title.trim();
  if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
    return { ok: false, error: `title length must be ${TITLE_MIN}-${TITLE_MAX} chars`, field: 'title' };
  }

  // outcomes
  if (!Array.isArray(draft.outcomes)) return { ok: false, error: 'outcomes must be an array', field: 'outcomes' };
  if (draft.outcomes.length < OUTCOMES_MIN || draft.outcomes.length > OUTCOMES_MAX) {
    return { ok: false, error: `outcomes must have ${OUTCOMES_MIN}-${OUTCOMES_MAX} items`, field: 'outcomes' };
  }
  const trimmedOutcomes = [];
  for (const o of draft.outcomes) {
    if (typeof o !== 'string') return { ok: false, error: 'each outcome must be a string', field: 'outcomes' };
    const t = o.trim();
    if (t.length === 0) return { ok: false, error: 'outcome cannot be empty', field: 'outcomes' };
    if (t.length > OUTCOME_LABEL_MAX) return { ok: false, error: `outcome must be at most ${OUTCOME_LABEL_MAX} chars`, field: 'outcomes' };
    trimmedOutcomes.push(t.toLowerCase());
  }
  const unique = new Set(trimmedOutcomes);
  if (unique.size !== trimmedOutcomes.length) return { ok: false, error: 'outcomes must be unique', field: 'outcomes' };

  // category
  if (!VALID_CATEGORIES.includes(draft.category)) {
    return { ok: false, error: `category must be one of ${VALID_CATEGORIES.join(', ')}`, field: 'category' };
  }

  // closesAt
  if (typeof draft.closesAt !== 'string') return { ok: false, error: 'closesAt must be an ISO string', field: 'closesAt' };
  const closesAt = new Date(draft.closesAt);
  if (isNaN(closesAt.getTime())) return { ok: false, error: 'closesAt is not a valid date', field: 'closesAt' };
  const now = Date.now();
  if (closesAt.getTime() <= now) return { ok: false, error: 'closesAt must be in the future', field: 'closesAt' };
  if (closesAt.getTime() - now > MAX_CLOSE_DAYS * 24 * 60 * 60 * 1000) {
    return { ok: false, error: `closesAt must be within ${MAX_CLOSE_DAYS} days`, field: 'closesAt' };
  }

  // description (optional)
  if (draft.description !== undefined && draft.description !== null) {
    if (typeof draft.description !== 'string') return { ok: false, error: 'description must be a string', field: 'description' };
    if (draft.description.length > DESCRIPTION_MAX) {
      return { ok: false, error: `description must be at most ${DESCRIPTION_MAX} chars`, field: 'description' };
    }
  }

  return { ok: true };
}

function validateTrendSuggestion(s) {
  if (!s || typeof s !== 'object') return { ok: false, error: 'suggestion must be an object' };
  if (typeof s.title !== 'string') return { ok: false, error: 'invalid title' };
  const trimmedTitle = s.title.trim();
  if (trimmedTitle.length < TITLE_MIN || trimmedTitle.length > TITLE_MAX) {
    return { ok: false, error: 'invalid title' };
  }
  if (typeof s.source !== 'string' || s.source.trim().length === 0) {
    return { ok: false, error: 'invalid source' };
  }
  try {
    const u = new URL(s.url);
    if (!u.protocol.startsWith('http')) return { ok: false, error: 'invalid url protocol' };
  } catch {
    return { ok: false, error: 'invalid url' };
  }
  if (!VALID_CATEGORIES.includes(s.category)) {
    return { ok: false, error: 'invalid category' };
  }
  return { ok: true };
}

module.exports = {
  VALID_CATEGORIES, MAX_CLOSE_DAYS,
  validatePrompt, validateDraft, validateTrendSuggestion,
};

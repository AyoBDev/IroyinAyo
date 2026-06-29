const { SYSTEM_PROMPT, buildDraftPrompt, buildTrendPrompt } = require('../../../src/modules/admin/aiMarket/prompts');

describe('SYSTEM_PROMPT', () => {
  test('mentions all 8 valid categories', () => {
    for (const cat of ['scholarships', 'entertainment', 'tech', 'sports', 'campus_news', 'career', 'health', 'academic']) {
      expect(SYSTEM_PROMPT).toContain(cat);
    }
  });

  test('requires JSON-only output', () => {
    expect(SYSTEM_PROMPT).toMatch(/strict JSON only/i);
  });

  test('mentions 2-4 outcomes constraint', () => {
    expect(SYSTEM_PROMPT).toMatch(/2 to 4/);
  });

  test('mentions 90-day resolution window', () => {
    expect(SYSTEM_PROMPT).toMatch(/90 days/);
  });
});

describe('buildDraftPrompt', () => {
  test('includes admin prompt verbatim', () => {
    const out = buildDraftPrompt('UNILAG vs OAU Saturday', '2026-06-24');
    expect(out).toContain('UNILAG vs OAU Saturday');
  });

  test('includes ISO date', () => {
    const out = buildDraftPrompt('test', '2026-06-24');
    expect(out).toContain('2026-06-24');
  });
});

describe('buildTrendPrompt', () => {
  test('embeds the headlines block', () => {
    const headlines = '- Headline A\n- Headline B';
    const out = buildTrendPrompt(headlines);
    expect(out).toContain('Headline A');
    expect(out).toContain('Headline B');
  });

  test('instructs the LLM to map politics to campus_news', () => {
    const out = buildTrendPrompt('');
    expect(out).toMatch(/politics.*campus_news/i);
  });

  test('lists the 8 valid categories', () => {
    const out = buildTrendPrompt('');
    for (const cat of ['scholarships', 'entertainment', 'tech', 'sports', 'campus_news', 'career', 'health', 'academic']) {
      expect(out).toContain(cat);
    }
  });
});

describe('buildDescribePrompt', () => {
  const { buildDescribePrompt } = require('../../../src/modules/admin/aiMarket/prompts');

  test('includes the title verbatim', () => {
    const p = buildDescribePrompt('Will UNILAG beat OAU on Saturday?', ['UNILAG', 'OAU', 'Draw']);
    expect(p).toContain('Will UNILAG beat OAU on Saturday?');
  });

  test('lists each outcome on its own bullet', () => {
    const p = buildDescribePrompt('Some title that is long enough', ['Alpha', 'Beta', 'Gamma']);
    expect(p).toContain('- Alpha');
    expect(p).toContain('- Beta');
    expect(p).toContain('- Gamma');
  });

  test('asks for JSON with a description field', () => {
    const p = buildDescribePrompt('Some title that is long enough', ['A', 'B']);
    expect(p).toMatch(/JSON/);
    expect(p).toMatch(/"description"/);
  });

  test('mentions the 500-character cap', () => {
    const p = buildDescribePrompt('Some title that is long enough', ['A', 'B']);
    expect(p).toMatch(/500/);
  });
});

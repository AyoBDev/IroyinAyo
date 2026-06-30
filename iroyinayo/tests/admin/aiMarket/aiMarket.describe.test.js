const service = require('../../../src/modules/admin/aiMarket/aiMarket.service');
const rateLimit = require('../../../src/modules/admin/aiMarket/rateLimit');

beforeEach(() => {
  rateLimit._reset();
});

function validInputs() {
  return {
    title: 'Will UNILAG beat OAU on Saturday?',
    outcomes: ['UNILAG wins', 'OAU wins', 'Draw'],
  };
}

describe('describeMarket', () => {
  test('returns description, model, latencyMs on a valid call', async () => {
    const fakeGroq = async () => ({
      parsed: { description: 'A football match between UNILAG and OAU that resolves to the winning side.' },
      model: 'llama-3.1-8b-instant',
      latencyMs: 80,
    });
    const out = await service.describeMarket({ adminId: 'admin-d', ...validInputs(), callJSONFn: fakeGroq });
    expect(out.description).toMatch(/UNILAG/);
    expect(out.model).toBe('llama-3.1-8b-instant');
    expect(out.latencyMs).toBe(80);
  });

  test('throws invalid_prompt when title is too short', async () => {
    const fakeGroq = async () => ({ parsed: { description: 'x'.repeat(40) }, model: 'x', latencyMs: 1 });
    await expect(service.describeMarket({ adminId: 'admin-d', title: 'short', outcomes: ['a', 'b'], callJSONFn: fakeGroq }))
      .rejects.toThrow(/invalid_prompt/);
  });

  test('throws invalid_prompt when outcomes has fewer than 2 entries', async () => {
    const fakeGroq = async () => ({ parsed: { description: 'x'.repeat(40) }, model: 'x', latencyMs: 1 });
    await expect(service.describeMarket({ adminId: 'admin-d', title: 'A long enough title here', outcomes: ['only one'], callJSONFn: fakeGroq }))
      .rejects.toThrow(/invalid_prompt/);
  });

  test('throws invalid_prompt when any outcome is empty', async () => {
    const fakeGroq = async () => ({ parsed: { description: 'x'.repeat(40) }, model: 'x', latencyMs: 1 });
    await expect(service.describeMarket({ adminId: 'admin-d', title: 'A long enough title here', outcomes: ['ok', '  '], callJSONFn: fakeGroq }))
      .rejects.toThrow(/invalid_prompt/);
  });

  test('throws invalid_prompt when any outcome is longer than 60 chars', async () => {
    const fakeGroq = async () => ({ parsed: { description: 'x'.repeat(40) }, model: 'x', latencyMs: 1 });
    const long = 'x'.repeat(61);
    await expect(service.describeMarket({ adminId: 'admin-d', title: 'A long enough title here', outcomes: [long, 'b'], callJSONFn: fakeGroq }))
      .rejects.toThrow(/invalid_prompt/);
  });

  test('throws rate_limit_exceeded after the bucket is full', async () => {
    const fakeGroq = async () => ({ parsed: { description: 'x'.repeat(40) }, model: 'x', latencyMs: 1 });
    for (let i = 0; i < rateLimit.RATE_PER_MIN; i++) {
      await service.describeMarket({ adminId: 'admin-d', ...validInputs(), callJSONFn: fakeGroq });
    }
    await expect(service.describeMarket({ adminId: 'admin-d', ...validInputs(), callJSONFn: fakeGroq }))
      .rejects.toThrow(/rate_limit_exceeded/);
  });

  test('throws ai_returned_invalid_response when parsed result is missing description', async () => {
    const fakeGroq = async () => ({ parsed: {}, model: 'x', latencyMs: 1 });
    await expect(service.describeMarket({ adminId: 'admin-d', ...validInputs(), callJSONFn: fakeGroq }))
      .rejects.toThrow(/ai_returned_invalid_response/);
  });

  test('throws ai_returned_invalid_response when description is shorter than 20 chars', async () => {
    const fakeGroq = async () => ({ parsed: { description: 'too short' }, model: 'x', latencyMs: 1 });
    await expect(service.describeMarket({ adminId: 'admin-d', ...validInputs(), callJSONFn: fakeGroq }))
      .rejects.toThrow(/ai_returned_invalid_response/);
  });

  test('throws ai_returned_invalid_response when description is longer than 500 chars', async () => {
    const fakeGroq = async () => ({ parsed: { description: 'a'.repeat(501) }, model: 'x', latencyMs: 1 });
    await expect(service.describeMarket({ adminId: 'admin-d', ...validInputs(), callJSONFn: fakeGroq }))
      .rejects.toThrow(/ai_returned_invalid_response/);
  });

  test('propagates groq_unavailable from callJSONFn', async () => {
    const fakeGroq = async () => { throw new Error('groq_unavailable: timeout'); };
    await expect(service.describeMarket({ adminId: 'admin-d', ...validInputs(), callJSONFn: fakeGroq }))
      .rejects.toThrow(/groq_unavailable/);
  });
});

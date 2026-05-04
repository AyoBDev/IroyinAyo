const { getState, setState, clearState, conversationState } = require('../../src/bot/messageHandler');

describe('Message Handler State', () => {
  beforeEach(() => {
    conversationState.clear();
  });

  test('setState and getState work correctly', () => {
    setState('123@s.whatsapp.net', 'onboarding', 'name', { phone: '123' });
    const state = getState('123@s.whatsapp.net');
    expect(state).toEqual({ flow: 'onboarding', step: 'name', data: { phone: '123' } });
  });

  test('getState returns null for unknown jid', () => {
    expect(getState('unknown@s.whatsapp.net')).toBeNull();
  });

  test('clearState removes state', () => {
    setState('123@s.whatsapp.net', 'quiz', 'answering', {});
    clearState('123@s.whatsapp.net');
    expect(getState('123@s.whatsapp.net')).toBeNull();
  });
});

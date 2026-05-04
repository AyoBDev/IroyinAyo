const { handlePredictAction, handleMyPredictions } = require('../../src/bot/handlers/predict');

function mockSock() {
  const messages = [];
  return {
    sendMessage: jest.fn(async (jid, content) => {
      messages.push({ jid, text: content.text });
    }),
    messages,
  };
}

const jid = '2348012345678@s.whatsapp.net';
const student = { id: 'student-123', name: 'Test' };

describe('Predict Handler', () => {
  test('back exits market flow', async () => {
    const sock = mockSock();
    let cleared = false;
    const clearState = () => { cleared = true; };
    const state = { flow: 'predict', step: 'browsing', data: {} };

    await handlePredictAction(sock, jid, 'back', student, state, jest.fn(), clearState);

    expect(sock.messages[0].text).toContain('Exited');
    expect(cleared).toBe(true);
  });

  test('propose with short question shows error', async () => {
    const sock = mockSock();
    const state = { flow: 'predict', step: 'browsing', data: {} };

    await handlePredictAction(sock, jid, 'propose hi', student, state, jest.fn(), jest.fn());

    expect(sock.messages[0].text).toContain('at least 10 characters');
  });

  test('invalid input shows help', async () => {
    const sock = mockSock();
    const state = { flow: 'predict', step: 'browsing', data: {} };

    await handlePredictAction(sock, jid, 'random text', student, state, jest.fn(), jest.fn());

    expect(sock.messages[0].text).toContain('buy');
    expect(sock.messages[0].text).toContain('propose');
  });

  test('handleMyPredictions with no positions', async () => {
    const sock = mockSock();
    const marketsService = require('../../src/modules/markets/markets.service');
    const original = marketsService.getStudentPositions;
    marketsService.getStudentPositions = jest.fn(async () => []);

    await handleMyPredictions(sock, jid, student);

    expect(sock.messages[0].text).toContain('no active predictions');

    marketsService.getStudentPositions = original;
  });
});

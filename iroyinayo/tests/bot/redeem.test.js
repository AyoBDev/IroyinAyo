const { handleRedeemSelection } = require('../../src/bot/handlers/redeem');

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
const student = { id: 'test-id', name: 'Adewale', phone_number: '2348012345678' };

describe('Redeem handler', () => {
  test('back cancels redemption flow', async () => {
    const sock = mockSock();
    let cleared = false;
    const clearState = () => { cleared = true; };
    const state = { flow: 'redeem', step: 'selecting', data: { options: [] } };

    await handleRedeemSelection(sock, jid, 'back', student, state, jest.fn(), clearState);

    expect(sock.messages[0].text).toContain('Cancelled');
    expect(cleared).toBe(true);
  });

  test('invalid number prompts again', async () => {
    const sock = mockSock();
    const state = {
      flow: 'redeem',
      step: 'selecting',
      data: { options: [{ id: '1', name: 'Test', points_cost: 500 }] },
    };

    await handleRedeemSelection(sock, jid, '5', student, state, jest.fn(), jest.fn());

    expect(sock.messages[0].text).toContain('between 1 and 1');
  });
});

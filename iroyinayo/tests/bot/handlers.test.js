const { handleMenu } = require('../../src/bot/handlers/menu');
const { handleHelp } = require('../../src/bot/handlers/help');

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

describe('Command Handlers', () => {
  describe('menu', () => {
    test('shows menu with student name and all commands', async () => {
      const sock = mockSock();
      await handleMenu(sock, jid, student);

      expect(sock.sendMessage).toHaveBeenCalledTimes(1);
      const text = sock.messages[0].text;
      expect(text).toContain('Adewale');
      expect(text).toContain('quiz');
      expect(text).toContain('points');
      expect(text).toContain('leaderboard');
      expect(text).toContain('predict');
      expect(text).toContain('redeem');
      expect(text).toContain('interests');
      expect(text).toContain('help');
    });
  });

  describe('help', () => {
    test('shows help text with commands and points info', async () => {
      const sock = mockSock();
      await handleHelp(sock, jid);

      const text = sock.messages[0].text;
      expect(text).toContain('Help');
      expect(text).toContain('quiz');
      expect(text).toContain('10 pts');
      expect(text).toContain('7-day streak');
    });
  });
});

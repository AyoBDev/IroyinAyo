const { handleAdminCommand } = require('../../src/bot/admin/adminHandler');

function mockSock() {
  const messages = [];
  return {
    sendMessage: jest.fn(async (jid, content) => {
      messages.push({ jid, text: content.text });
    }),
    messages,
  };
}

const jid = '2348000000000@s.whatsapp.net';

describe('Admin Handler', () => {
  test('unknown command shows help', async () => {
    const sock = mockSock();
    await handleAdminCommand(sock, jid, '/unknown');

    expect(sock.messages[0].text).toContain('Admin Commands');
    expect(sock.messages[0].text).toContain('/stats');
    expect(sock.messages[0].text).toContain('/broadcast');
    expect(sock.messages[0].text).toContain('/approve');
    expect(sock.messages[0].text).toContain('/resolve');
    expect(sock.messages[0].text).toContain('/ban');
    expect(sock.messages[0].text).toContain('/topup');
  });

  test('/broadcast without message shows usage', async () => {
    const sock = mockSock();
    await handleAdminCommand(sock, jid, '/broadcast');

    expect(sock.messages[0].text).toContain('Usage');
  });

  test('/approve without id shows usage', async () => {
    const sock = mockSock();
    await handleAdminCommand(sock, jid, '/approve');

    expect(sock.messages[0].text).toContain('Usage');
  });

  test('/resolve without args shows usage', async () => {
    const sock = mockSock();
    await handleAdminCommand(sock, jid, '/resolve');

    expect(sock.messages[0].text).toContain('Usage');
  });

  test('/ban without phone shows usage', async () => {
    const sock = mockSock();
    await handleAdminCommand(sock, jid, '/ban');

    expect(sock.messages[0].text).toContain('Usage');
  });

  test('/topup without args shows usage', async () => {
    const sock = mockSock();
    await handleAdminCommand(sock, jid, '/topup');

    expect(sock.messages[0].text).toContain('Usage');
  });
});

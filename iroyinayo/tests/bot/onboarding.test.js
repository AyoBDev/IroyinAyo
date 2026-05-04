const { handleOnboardingStep, UNILORIN_FACULTIES, CATEGORY_LABELS } = require('../../src/bot/handlers/onboarding');

function mockSock() {
  const messages = [];
  return {
    sendMessage: jest.fn(async (jid, content) => {
      messages.push({ jid, text: content.text });
    }),
    messages,
  };
}

function createStateHelpers() {
  const store = new Map();
  return {
    getState: (jid) => store.get(jid) || null,
    setState: (jid, flow, step, data) => store.set(jid, { flow, step, data }),
    clearState: (jid) => store.delete(jid),
    store,
  };
}

describe('Onboarding Flow', () => {
  const jid = '2348012345678@s.whatsapp.net';
  const phone = '2348012345678';

  test('first message shows welcome and asks for name', async () => {
    const sock = mockSock();
    const helpers = createStateHelpers();

    await handleOnboardingStep(sock, jid, 'hi', phone, helpers.getState, helpers.setState, helpers.clearState);

    expect(sock.sendMessage).toHaveBeenCalledTimes(1);
    expect(sock.messages[0].text).toContain('Welcome to Iroyinayo');
    expect(sock.messages[0].text).toContain('name');
    expect(helpers.store.get(jid).step).toBe('name');
  });

  test('name step moves to faculty', async () => {
    const sock = mockSock();
    const helpers = createStateHelpers();
    helpers.setState(jid, 'onboarding', 'name', { phone });

    await handleOnboardingStep(sock, jid, 'Adewale', phone, helpers.getState, helpers.setState, helpers.clearState);

    expect(sock.messages[0].text).toContain('faculty');
    expect(helpers.store.get(jid).step).toBe('faculty');
    expect(helpers.store.get(jid).data.name).toBe('Adewale');
  });

  test('faculty step moves to level', async () => {
    const sock = mockSock();
    const helpers = createStateHelpers();
    helpers.setState(jid, 'onboarding', 'faculty', { phone, name: 'Adewale' });

    await handleOnboardingStep(sock, jid, '5', phone, helpers.getState, helpers.setState, helpers.clearState);

    expect(sock.messages[0].text).toContain('level');
    expect(helpers.store.get(jid).step).toBe('level');
    expect(helpers.store.get(jid).data.faculty).toBe(UNILORIN_FACULTIES[4]);
  });

  test('invalid faculty number shows error', async () => {
    const sock = mockSock();
    const helpers = createStateHelpers();
    helpers.setState(jid, 'onboarding', 'faculty', { phone, name: 'Test' });

    await handleOnboardingStep(sock, jid, '99', phone, helpers.getState, helpers.setState, helpers.clearState);

    expect(sock.messages[0].text).toContain('number between');
    expect(helpers.store.get(jid).step).toBe('faculty');
  });

  test('level step moves to interests', async () => {
    const sock = mockSock();
    const helpers = createStateHelpers();
    helpers.setState(jid, 'onboarding', 'level', { phone, name: 'Test', faculty: 'Arts' });

    await handleOnboardingStep(sock, jid, '3', phone, helpers.getState, helpers.setState, helpers.clearState);

    expect(sock.messages[0].text).toContain('interested');
    expect(helpers.store.get(jid).step).toBe('interests');
  });

  test('interests step completes registration', async () => {
    const sock = mockSock();
    const helpers = createStateHelpers();
    helpers.setState(jid, 'onboarding', 'interests', {
      phone: '0000000000',
      name: 'Test',
      faculty: 'Arts',
      level: '200',
    });

    // Mock the service — we test integration separately
    const studentsService = require('../../src/modules/students/students.service');
    const originalRegister = studentsService.register;
    studentsService.register = jest.fn(async () => ({ id: 'test-id' }));

    await handleOnboardingStep(sock, jid, '1,3', '0000000000', helpers.getState, helpers.setState, helpers.clearState);

    expect(studentsService.register).toHaveBeenCalledWith({
      phone_number: '0000000000',
      name: 'Test',
      faculty: 'Arts',
      level: '200',
      interests: ['scholarships', 'tech'],
    });
    expect(sock.messages[0].text).toContain("You're all set");
    expect(helpers.store.has(jid)).toBe(false);

    studentsService.register = originalRegister;
  });
});

const { handleQuizAnswer } = require('../../src/bot/handlers/quiz');

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

describe('Quiz handler', () => {
  test('valid answer clears state and shows result', async () => {
    const sock = mockSock();
    const gamificationService = require('../../src/modules/gamification/gamification.service');
    const originalAnswer = gamificationService.answerQuiz;
    gamificationService.answerQuiz = jest.fn(async () => ({
      correct: true,
      points_earned: 10,
    }));

    let cleared = false;
    const state = { flow: 'quiz', step: 'answering', data: { quizId: 'quiz-123' } };
    const clearState = () => { cleared = true; };
    const setState = jest.fn();

    await handleQuizAnswer(sock, jid, 'B', student, state, setState, clearState);

    expect(gamificationService.answerQuiz).toHaveBeenCalledWith('test-id', 'quiz-123', 'B');
    expect(sock.messages[0].text).toContain('Correct');
    expect(cleared).toBe(true);

    gamificationService.answerQuiz = originalAnswer;
  });

  test('invalid option prompts again without clearing state', async () => {
    const sock = mockSock();
    const clearState = jest.fn();
    const setState = jest.fn();
    const state = { flow: 'quiz', step: 'answering', data: { quizId: 'quiz-123' } };

    await handleQuizAnswer(sock, jid, 'X', student, state, setState, clearState);

    expect(sock.messages[0].text).toContain('A*, *B*, *C*, or *D');
    expect(clearState).not.toHaveBeenCalled();
  });
});

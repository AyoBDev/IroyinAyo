const db = require('../../config/database');
const gamificationService = require('../../modules/gamification/gamification.service');
const { formatQuiz, bold } = require('../formatters');

async function handleQuiz(sock, jid, student, setState) {
  // Get a random quiz the student hasn't answered
  const answeredIds = await db('quiz_answers')
    .where({ student_id: student.id })
    .select('quiz_id');
  const answeredQuizIds = answeredIds.map((a) => a.quiz_id);

  let query = db('quizzes');
  if (answeredQuizIds.length > 0) {
    query = query.whereNotIn('id', answeredQuizIds);
  }
  const quiz = await query.orderByRaw('RANDOM()').first();

  if (!quiz) {
    await sock.sendMessage(jid, {
      text: "🎓 You've answered all available quizzes! Check back later for new ones.",
    });
    return;
  }

  await sock.sendMessage(jid, { text: formatQuiz(quiz) });
  setState(jid, 'quiz', 'answering', { quizId: quiz.id });
}

async function handleQuizAnswer(sock, jid, text, student, state, setState, clearState) {
  const answer = text.toUpperCase().trim();
  if (!['A', 'B', 'C', 'D'].includes(answer)) {
    await sock.sendMessage(jid, { text: 'Please reply with *A*, *B*, *C*, or *D*.' });
    return;
  }

  try {
    const result = await gamificationService.answerQuiz(student.id, state.data.quizId, answer);

    if (result.correct) {
      await sock.sendMessage(jid, {
        text: `✅ ${bold('Correct!')} You earned ${bold(`${result.points_earned} pts`)}.\n\nType ${bold('quiz')} for another question or ${bold('menu')} for options.`,
      });
    } else {
      await sock.sendMessage(jid, {
        text: `❌ ${bold('Wrong!')} The correct answer was different.\n\nType ${bold('quiz')} to try another question.`,
      });
    }
  } catch (err) {
    await sock.sendMessage(jid, { text: `Error: ${err.message}` });
  }

  clearState(jid);
}

module.exports = { handleQuiz, handleQuizAnswer };

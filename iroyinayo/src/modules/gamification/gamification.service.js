const db = require('../../config/database');
const { NotFoundError, ValidationError } = require('../../utils/errors');

async function addPoints(studentId, amount, type, description, referenceId) {
  await db.transaction(async (trx) => {
    await trx('point_transactions').insert({
      student_id: studentId, amount, type, description, reference_id: referenceId,
    });
    await trx('students').where({ id: studentId }).increment('points_balance', amount);
  });
}

async function deductPoints(studentId, amount, type, description, referenceId) {
  await db.transaction(async (trx) => {
    const student = await trx('students').where({ id: studentId }).forUpdate().first();
    if (!student) throw new NotFoundError('Student not found');

    if (student.points_balance < amount) {
      const todayRefills = await trx('point_transactions')
        .where({ student_id: studentId, type: 'auto_refill' })
        .where('created_at', '>', new Date(Date.now() - 24 * 60 * 60 * 1000))
        .count('id as count')
        .first();

      if (parseInt(todayRefills.count, 10) >= 3) {
        throw new ValidationError('Daily refill limit reached. Come back tomorrow or refer friends for bonus points!');
      }

      const needed = amount - student.points_balance;
      const refill = Math.min(Math.max(needed, 100), 200);

      if (student.points_balance + refill < amount) {
        throw new ValidationError(`Insufficient points. You have ${student.points_balance} pts (max refill: ${refill}).`);
      }

      await trx('point_transactions').insert({
        student_id: studentId, amount: refill, type: 'auto_refill', description: 'Free refill - keep predicting!',
      });
      await trx('students').where({ id: studentId }).increment('points_balance', refill);
    }

    await trx('point_transactions').insert({
      student_id: studentId, amount: -amount, type, description, reference_id: referenceId,
    });
    await trx('students').where({ id: studentId }).decrement('points_balance', amount);
  });
}

async function getPointsBalance(studentId) {
  const student = await db('students').where({ id: studentId }).first();
  if (!student) throw new NotFoundError('Student not found');
  return { student_id: studentId, balance: student.points_balance };
}

async function getTransactionHistory(studentId, limit = 20) {
  return db('point_transactions').where({ student_id: studentId }).orderBy('created_at', 'desc').limit(limit);
}

async function recordDailyActivity(studentId) {
  const today = new Date().toISOString().slice(0, 10);
  let streak = await db('streaks').where({ student_id: studentId }).first();

  if (!streak) {
    [streak] = await db('streaks')
      .insert({ student_id: studentId, current_streak: 1, longest_streak: 1, last_active_date: today })
      .returning('*');
    return streak;
  }

  const lastActive = streak.last_active_date ? new Date(streak.last_active_date).toISOString().slice(0, 10) : null;
  if (lastActive === today) return streak;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  let newStreak = (lastActive === yesterdayStr) ? streak.current_streak + 1 : 1;
  const longestStreak = Math.max(newStreak, streak.longest_streak);

  await db('streaks').where({ student_id: studentId }).update({
    current_streak: newStreak, longest_streak: longestStreak, last_active_date: today,
  });

  if (newStreak === 7) await addPoints(studentId, 25, 'streak', '7-day streak bonus');
  else if (newStreak === 30) await addPoints(studentId, 100, 'streak', '30-day streak bonus');

  return db('streaks').where({ student_id: studentId }).first();
}

async function createQuiz({ question, options, correct_option, category, points_reward }) {
  const [quiz] = await db('quizzes')
    .insert({ question, options: JSON.stringify(options), correct_option, category, points_reward: points_reward || 10 })
    .returning('*');
  if (typeof quiz.options === 'string') {
    quiz.options = JSON.parse(quiz.options);
  }
  return quiz;
}

async function answerQuiz(studentId, quizId, selectedOption) {
  const quiz = await db('quizzes').where({ id: quizId }).first();
  if (!quiz) throw new NotFoundError('Quiz not found');

  const existingAnswer = await db('quiz_answers').where({ student_id: studentId, quiz_id: quizId }).first();
  if (existingAnswer) throw new ValidationError('Already answered this quiz');

  const isCorrect = selectedOption === quiz.correct_option;

  const [answer] = await db('quiz_answers')
    .insert({ student_id: studentId, quiz_id: quizId, selected_option: selectedOption, is_correct: isCorrect })
    .returning('*');

  if (isCorrect) {
    await addPoints(studentId, quiz.points_reward, 'quiz', `Quiz correct: ${quiz.question}`, quizId);
  }

  await recordDailyActivity(studentId);

  return { ...answer, correct: isCorrect, points_earned: isCorrect ? quiz.points_reward : 0 };
}

async function getLeaderboard(period = 'weekly', limit = 10) {
  const now = new Date();
  const dateFilter = period === 'weekly'
    ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  return db('point_transactions')
    .join('students', 'point_transactions.student_id', 'students.id')
    .where('point_transactions.created_at', '>=', dateFilter)
    .where('point_transactions.amount', '>', 0)
    .groupBy('students.id', 'students.name')
    .select('students.id', 'students.name')
    .sum('point_transactions.amount as total_points')
    .orderBy('total_points', 'desc')
    .limit(limit);
}

async function listQuizzes({ page = 1, limit = 50 } = {}) {
  const offset = (page - 1) * limit;
  const quizzes = await db('quizzes')
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset(offset);

  const countResult = await db('quizzes').count('id as count').first();
  const total = parseInt(countResult.count, 10);

  const parsed = quizzes.map((q) => ({
    ...q,
    options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
  }));

  return { quizzes: parsed, total, page, limit };
}

module.exports = {
  addPoints, deductPoints, getPointsBalance, getTransactionHistory,
  recordDailyActivity, createQuiz, answerQuiz, getLeaderboard, listQuizzes,
};

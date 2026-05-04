function validateCreateQuiz(body) {
  const errors = [];
  if (!body.question || typeof body.question !== 'string') errors.push('question is required');
  if (!body.options || !Array.isArray(body.options) || body.options.length !== 4) errors.push('options must be an array of 4 choices');
  if (!body.correct_option || !['A', 'B', 'C', 'D'].includes(body.correct_option)) errors.push('correct_option must be A, B, C, or D');
  return errors;
}

function validateAnswerQuiz(body) {
  const errors = [];
  if (!body.selected_option || !['A', 'B', 'C', 'D'].includes(body.selected_option)) errors.push('selected_option must be A, B, C, or D');
  return errors;
}

module.exports = { validateCreateQuiz, validateAnswerQuiz };

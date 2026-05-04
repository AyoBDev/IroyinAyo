function validateCreateMarket(body) {
  const errors = [];
  if (!body.question || typeof body.question !== 'string') errors.push('question is required');
  if (!body.closes_at) {
    errors.push('closes_at is required');
  } else {
    const closesAt = new Date(body.closes_at);
    if (isNaN(closesAt.getTime()) || closesAt <= new Date()) errors.push('closes_at must be a future date');
  }
  if (!body.created_by_type || !['admin', 'student'].includes(body.created_by_type)) errors.push('created_by_type must be admin or student');
  if (!body.created_by_id) errors.push('created_by_id is required');
  return errors;
}

function validateBuyPosition(body) {
  const errors = [];
  if (!body.student_id) errors.push('student_id is required');
  if (!body.side || !['yes', 'no'].includes(body.side)) errors.push('side must be yes or no');
  if (!body.amount || typeof body.amount !== 'number' || body.amount <= 0) errors.push('amount must be a positive number');
  return errors;
}

module.exports = { validateCreateMarket, validateBuyPosition };

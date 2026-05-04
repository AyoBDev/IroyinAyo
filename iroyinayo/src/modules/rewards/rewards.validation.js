function validateCreateRewardOption(body) {
  const errors = [];
  if (!body.name) errors.push('name is required');
  if (!body.type || !['airtime', 'data'].includes(body.type)) errors.push('type must be airtime or data');
  if (!body.points_cost || typeof body.points_cost !== 'number' || body.points_cost <= 0) errors.push('points_cost must be a positive number');
  if (!body.value) errors.push('value is required');
  return errors;
}

function validateRedeem(body) {
  const errors = [];
  if (!body.student_id) errors.push('student_id is required');
  if (!body.reward_option_id) errors.push('reward_option_id is required');
  return errors;
}

module.exports = { validateCreateRewardOption, validateRedeem };

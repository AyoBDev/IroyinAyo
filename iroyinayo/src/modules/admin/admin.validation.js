const VALID_ROLES = ['super_admin', 'content_admin', 'moderator'];

function validateRegister(body) {
  const errors = [];
  if (!body.email || typeof body.email !== 'string') errors.push('email is required');
  if (!body.password || body.password.length < 8) errors.push('password must be at least 8 characters');
  if (!body.name) errors.push('name is required');
  if (body.role && !VALID_ROLES.includes(body.role)) errors.push(`role must be one of: ${VALID_ROLES.join(', ')}`);
  return errors;
}

function validateLogin(body) {
  const errors = [];
  if (!body.email) errors.push('email is required');
  if (!body.password) errors.push('password is required');
  return errors;
}

module.exports = { validateRegister, validateLogin, VALID_ROLES };

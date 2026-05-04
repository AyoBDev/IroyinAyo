const VALID_CATEGORIES = [
  'scholarships',
  'entertainment',
  'tech',
  'sports',
  'campus_news',
  'career',
  'health',
  'academic',
];

const VALID_LEVELS = ['100', '200', '300', '400', '500', 'postgrad'];

function validateRegister(body) {
  const errors = [];
  if (!body.phone_number || typeof body.phone_number !== 'string' || !/^\d{10,15}$/.test(body.phone_number)) {
    errors.push('phone_number must be 10-15 digits');
  }
  if (!body.name || typeof body.name !== 'string') {
    errors.push('name is required');
  }
  if (body.level && !VALID_LEVELS.includes(body.level)) {
    errors.push(`level must be one of: ${VALID_LEVELS.join(', ')}`);
  }
  if (body.interests) {
    if (!Array.isArray(body.interests)) {
      errors.push('interests must be an array');
    } else {
      const invalid = body.interests.filter((i) => !VALID_CATEGORIES.includes(i));
      if (invalid.length > 0) {
        errors.push(`Invalid interests: ${invalid.join(', ')}`);
      }
    }
  }
  return errors;
}

function validateUpdateProfile(body) {
  const errors = [];
  if (body.level && !VALID_LEVELS.includes(body.level)) {
    errors.push(`level must be one of: ${VALID_LEVELS.join(', ')}`);
  }
  if (body.name !== undefined && (typeof body.name !== 'string' || body.name.trim() === '')) {
    errors.push('name must be a non-empty string');
  }
  return errors;
}

function validateUpdateInterests(body) {
  const errors = [];
  if (!body.interests || !Array.isArray(body.interests)) {
    errors.push('interests must be an array');
  } else {
    const invalid = body.interests.filter((i) => !VALID_CATEGORIES.includes(i));
    if (invalid.length > 0) {
      errors.push(`Invalid interests: ${invalid.join(', ')}`);
    }
  }
  return errors;
}

module.exports = {
  validateRegister,
  validateUpdateProfile,
  validateUpdateInterests,
  VALID_CATEGORIES,
  VALID_LEVELS,
};

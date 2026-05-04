const { VALID_CATEGORIES } = require('../students/students.validation');

function validateCreateContent(body) {
  const errors = [];
  if (!body.title || typeof body.title !== 'string') {
    errors.push('title is required');
  }
  if (!body.body || typeof body.body !== 'string') {
    errors.push('body is required');
  }
  if (body.categories) {
    if (!Array.isArray(body.categories)) {
      errors.push('categories must be an array');
    } else {
      const invalid = body.categories.filter((c) => !VALID_CATEGORIES.includes(c));
      if (invalid.length > 0) {
        errors.push(`Invalid categories: ${invalid.join(', ')}`);
      }
    }
  }
  return errors;
}

module.exports = { validateCreateContent };

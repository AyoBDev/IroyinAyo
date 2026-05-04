const { ForbiddenError } = require('../utils/errors');

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.admin) return next(new ForbiddenError('Not authenticated'));
    if (!roles.includes(req.admin.role)) return next(new ForbiddenError(`Requires one of: ${roles.join(', ')}`));
    next();
  };
}

module.exports = { requireRole };

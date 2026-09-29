const { ApiError } = require('../utils/ApiError');

function notFound(req, res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.statusCode || 500;
  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error('[error]', err);
  }
  res.status(status).json({
    ok: false,
    error: {
      message: status >= 500 ? 'Internal server error' : err.message,
      code: status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
      details: err.details || undefined,
    },
  });
}

module.exports = { notFound, errorHandler };

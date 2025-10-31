function notFoundHandler(_req, res, _next) {
  res.status(404).json({ error: 'Not Found' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const isProd = process.env.NODE_ENV === 'production';
  res.status(status).json({
    error: err.message || 'Internal Server Error',
    ...(isProd ? {} : { stack: err.stack }),
  });
}

module.exports = { errorHandler, notFoundHandler };



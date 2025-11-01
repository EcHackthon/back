function notFoundHandler(req, res, _next) {
  console.warn('[404] Route not found:', req.method, req.path);
  res.status(404).json({ 
    error: 'Not Found',
    path: req.path,
    method: req.method,
    message: 'The requested route does not exist',
    hint: 'Check /__routes for available routes'
  });
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



export function notFoundHandler(req, res) {
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const statusCode = error.statusCode || 500;
  const isProd = process.env.NODE_ENV === "production";
  const message = statusCode >= 500 && isProd ? "Internal server error" : error.message || "Internal server error";

  if (statusCode >= 500) {
    console.error(error);
  }

  return res.status(statusCode).json({
    message,
    ...(isProd ? {} : { stack: error.stack }),
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
}

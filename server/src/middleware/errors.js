// Fehler immer als JSON zurückgeben: { error, details }
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function notFoundHandler(req, _res, next) {
  next(new HttpError(404, `Route ${req.method} ${req.originalUrl} existiert nicht.`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  // kaputtes JSON
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Ungültiges JSON.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Die Anfrage ist zu groß.' });
  }

  const status = err.status || 500;
  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json({
    error: status >= 500 ? 'Interner Serverfehler.' : err.message,
    ...(err.details ? { details: err.details } : {}),
  });
}

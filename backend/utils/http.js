// Small HTTP helpers shared across routes.

// Wraps an async route handler so any thrown/rejected error is forwarded to
// Express's error-handling middleware instead of crashing the process or
// leaving the request hanging.
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

export function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

export function notFound(res, message = 'Not found') {
  return res.status(404).json({ error: message });
}

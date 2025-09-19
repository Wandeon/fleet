import { nanoid } from 'nanoid';

export function errorId(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }
  const status = err.status && Number.isInteger(err.status) ? err.status : 500;
  const id = nanoid(10);
  const payload = {
    error: status >= 500 ? 'internal_error' : (err.code || err.error || err.name || 'error'),
    message: err.message,
    incident_id: id,
  };
  if (err.details) payload.details = err.details;
  if (status >= 500) {
    console.error([], err);
  }
  res.status(status).json(payload);
}

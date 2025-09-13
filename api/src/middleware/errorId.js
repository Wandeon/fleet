import { nanoid } from 'nanoid';
export function errorId(err, req, res, next) {
  const id = nanoid(10);
  console.error(`[${id}]`, err);
  res.status(500).json({ error: "internal_error", incident_id: id });
}


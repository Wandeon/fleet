import { Router } from 'express';
const r = Router();
r.get('/', (req, res) => {
  res.json({ ok:true, note: 'Attach SSE/WS in future step.' });
});
export default r;


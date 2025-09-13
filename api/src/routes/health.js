import { Router } from 'express';
const r = Router();
r.get('/', (req, res) => {
  res.json({
    overall: 'UP',
    components: { api:'UP', prometheus:'UNKNOWN', blackbox:'UNKNOWN' },
    timestamp: new Date().toISOString(),
    polling_interval: 30
  });
});
export default r;


import { Router } from 'express';
import { listDeviceStates, getDeviceState } from '../services/deviceService.js';

const r = Router();

r.get('/', async (_req, res, next) => {
  try {
    const states = await listDeviceStates();
    res.json({ states });
  } catch (err) {
    next(err);
  }
});

r.get('/:deviceId', async (req, res, next) => {
  try {
    const state = await getDeviceState(req.params.deviceId);
    res.json(state);
  } catch (err) {
    next(err);
  }
});

export default r;

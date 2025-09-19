import { Router } from 'express';
import { listDeviceEvents } from '../services/deviceService.js';
import { ValidationError } from '../utils/errors.js';

const MAX_LIMIT = 500;

const r = Router();

r.get('/', async (req, res, next) => {
  try {
    const { device_id: deviceId, since, limit } = req.query;
    let parsedSince;
    if (since) {
      const d = new Date(since);
      if (Number.isNaN(d.getTime())) {
        throw new ValidationError('invalid since parameter');
      }
      parsedSince = d;
    }
    let parsedLimit = limit ? Number(limit) : 100;
    if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
      throw new ValidationError('limit must be positive integer');
    }
    parsedLimit = Math.min(parsedLimit, MAX_LIMIT);
    const events = await listDeviceEvents(deviceId, { since: parsedSince, limit: parsedLimit });
    res.json({ events });
  } catch (err) {
    next(err);
  }
});

export default r;

import { Router } from 'express';
import { getJob } from '../services/deviceService.js';
import { NotFoundError } from '../utils/errors.js';

const r = Router();

r.get('/:jobId', async (req, res, next) => {
  try {
    const job = await getJob(req.params.jobId);
    if (!job) {
      throw new NotFoundError('job not found');
    }
    res.json(job);
  } catch (err) {
    next(err);
  }
});

export default r;

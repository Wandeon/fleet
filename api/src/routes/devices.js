import { Router } from 'express';
import Joi from 'joi';
import { readDevices } from '../utils/deviceRegistry.js';
import { validate } from '../middleware/validate.js';

const r = Router();
const postSchema = Joi.object({
  hardware_id: Joi.string().min(6).required(),
  alias: Joi.string().min(2).required(),
  role: Joi.string().required()
});

const devices = new Map();

r.get('/', (_req, res) => {
  const file = readDevices();
  res.json([...file, ...devices.values()]);
});

r.post('/', validate(postSchema), (req, res) => {
  const { hardware_id, alias, role } = req.body;
  for (const d of devices.values()) {
    if (d.alias === alias) return res.status(409).json({ error: 'alias_exists' });
  }
  devices.set(hardware_id, { hardware_id, alias, role });
  res.status(201).json({ ok:true });
});

export default r;


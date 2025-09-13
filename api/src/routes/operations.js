import { Router } from 'express';
import Joi from 'joi';
import { validate } from '../middleware/validate.js';

const r = Router();
const playSchema = Joi.object({ source:Joi.string().valid('stream','file','stop').required() });
const volSchema  = Joi.object({ volume:Joi.number().min(0).max(2).required() });

r.post('/audio/play', validate(playSchema), (req,res)=> res.json({ ok:true, applied:req.body }) );
r.post('/audio/volume', validate(volSchema), (req,res)=> res.json({ ok:true, applied:req.body }) );

export default r;


import { z } from 'zod';

export const deviceIdParamSchema = z.object({
  deviceId: z.string().min(1)
});

export const audioVolumeSchema = z.object({
  volume: z.coerce.number().min(0).max(2)
});

export const audioPlaySchema = z.object({
  source: z.enum(['stream', 'file']),
  mode: z.enum(['auto', 'manual']).optional(),
  stream_url: z.string().url().optional()
});

export const audioConfigSchema = z.object({
  stream_url: z.string().url().optional(),
  volume: z.coerce.number().min(0).max(2).optional(),
  mode: z.enum(['auto', 'manual']).optional(),
  source: z.enum(['stream', 'file', 'stop']).optional()
});

export type AudioPlayInput = z.infer<typeof audioPlaySchema>;
export type AudioVolumeInput = z.infer<typeof audioVolumeSchema>;
export type AudioConfigInput = z.infer<typeof audioConfigSchema>;

import { z } from 'zod';

const confidenceSchema = z
  .union([z.string(), z.number()])
  .transform((value) => {
    if (typeof value === 'number') {
      return value;
    }
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return NaN;
    }
    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed) ? parsed : NaN;
  })
  .refine((value) => Number.isFinite(value), {
    message: 'Confidence must be a number'
  })
  .transform((value) => {
    if (value > 1 && value <= 100) {
      return value / 100;
    }
    return value;
  })
  .pipe(z.number().min(0).max(1));

function parseTags(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => (typeof item === 'string' ? item.split(',') : []))
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  return undefined;
}

export const cameraEventsQuerySchema = z
  .object({
    start: z.string().datetime().optional(),
    end: z.string().datetime().optional(),
    cameraId: z.string().min(1).optional(),
    tags: z
      .any()
      .optional()
      .transform((value) => parseTags(value) ?? [])
      .pipe(z.array(z.string()).default([])),
    minConfidence: confidenceSchema.optional(),
    maxConfidence: confidenceSchema.optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    cursor: z.string().min(1).optional()
  })
  .superRefine((value, ctx) => {
    if (value.start && value.end) {
      const start = Date.parse(value.start);
      const end = Date.parse(value.end);
      if (Number.isFinite(start) && Number.isFinite(end) && start > end) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'start must be before end',
          path: ['start']
        });
      }
    }
    if (value.minConfidence != null && value.maxConfidence != null && value.minConfidence > value.maxConfidence) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'minConfidence must be less than or equal to maxConfidence',
        path: ['minConfidence']
      });
    }
  });

export const cameraEventIdParamSchema = z.object({
  eventId: z.string().min(1)
});

export type CameraEventsQuery = z.infer<typeof cameraEventsQuerySchema>;

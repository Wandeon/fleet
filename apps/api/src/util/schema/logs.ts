import { z } from 'zod';

export const logLevelEnum = z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']);

export const logsExportRequestSchema = z
  .object({
    deviceId: z.string().min(1).optional(),
    level: logLevelEnum.optional(),
    start: z.string().datetime().optional(),
    end: z.string().datetime().optional(),
    format: z.enum(['json', 'csv']).default('json'),
  })
  .superRefine((value, ctx) => {
    if (value.start && value.end) {
      const start = Date.parse(value.start);
      const end = Date.parse(value.end);
      if (Number.isFinite(start) && Number.isFinite(end) && start > end) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'start must be before end',
          path: ['start'],
        });
      }
    }
  });

export type LogsExportRequestInput = z.infer<typeof logsExportRequestSchema>;

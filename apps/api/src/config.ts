import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_BEARER: z.string().min(1, 'API_BEARER is required'),
    HTTP_PORT: z.coerce.number().int().min(1).max(65535).default(3015),
    TIMEOUT_MS: z.coerce.number().int().min(100).max(30000).default(3000),
    RETRY_MAX: z.coerce.number().int().min(0).max(5).default(2),
    RETRY_BACKOFF_MS: z.coerce.number().int().min(0).max(10000).default(250),
    CIRCUIT_FAILURE_THRESHOLD: z.coerce.number().int().min(1).max(20).default(5),
    CIRCUIT_OPEN_MS: z.coerce.number().int().min(1000).max(600000).default(30000),
    DEVICE_REGISTRY_PATH: z.string().optional(),
    DEVICE_REGISTRY_JSON: z.string().optional(),
    ZIGBEE_RULES_PATH: z.string().optional(),
    ZIGBEE_RULES_FALLBACK_PATH: z.string().optional(),
    CORS_ALLOWED_ORIGINS: z
      .string()
      .default('https://app.headspamartina.hr')
      .transform((value) =>
        value
          .split(',')
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
      ),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).max(600000).default(60000),
    RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(5000).default(120),
    RATE_LIMIT_BURST: z.coerce.number().int().min(1).max(5000).default(40),
    RATE_LIMIT_GLOBAL_MAX: z.coerce.number().int().min(1).max(20000).default(600),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info')
  })
  .refine((value) => value.DEVICE_REGISTRY_JSON || value.DEVICE_REGISTRY_PATH, {
    message: 'DEVICE_REGISTRY_JSON or DEVICE_REGISTRY_PATH must be provided'
  });

export type Config = z.infer<typeof envSchema> & {
  corsAllowedOrigins: string[];
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.parse(env);
  return {
    ...parsed,
    corsAllowedOrigins: parsed.CORS_ALLOWED_ORIGINS
  };
}

export const config = loadConfig();

import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Script } from 'node:vm';
import { z } from 'zod';
import { config } from '../config';
import { createHttpError } from '../util/errors';

const allowedAlertChannels = ['slack', 'email', 'sms'] as const;

const comparisonOperators = [
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'includes',
  'excludes',
] as const;

const conditionSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(comparisonOperators),
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.union([z.string(), z.number(), z.boolean()])),
  ]),
});

const triggerSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('sensor_event'),
    sensorId: z.string().min(1),
    event: z.string().min(1),
    condition: conditionSchema.optional(),
    cooldownSeconds: z.coerce.number().int().min(0).max(86400).optional(),
  }),
  z.object({
    type: z.literal('schedule'),
    cron: z.string().min(4),
    timezone: z.string().min(2).optional(),
  }),
  z.object({
    type: z.literal('expression'),
    expression: z.string().min(1),
    language: z.literal('js').default('js'),
    description: z.string().optional(),
  }),
]);

const actionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('device_command'),
    deviceId: z.string().min(1),
    command: z.string().min(1),
    payload: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    type: z.literal('notify'),
    channel: z.enum(allowedAlertChannels),
    message: z.string().min(1),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    type: z.literal('delay'),
    durationSeconds: z.coerce.number().int().min(1).max(3600),
  }),
]);

const ruleDefinitionSchema = z.object({
  name: z.string().min(1).max(120),
  description: z
    .string()
    .max(500)
    .optional()
    .transform((value) => value?.trim() ?? undefined),
  trigger: triggerSchema,
  actions: z.array(actionSchema).min(1).max(10),
  tags: z
    .array(z.string().min(1))
    .max(10)
    .optional()
    .transform((tags) => tags?.map((tag) => tag.trim()).filter((tag) => tag.length > 0)),
  metadata: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean().optional(),
});

const ruleUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z
    .union([z.string().max(500), z.null()])
    .optional()
    .transform((value) => (value == null ? value : value.trim())),
  trigger: triggerSchema.optional(),
  actions: z.array(actionSchema).min(1).max(10).optional(),
  tags: z
    .array(z.string().min(1))
    .max(10)
    .optional()
    .transform((tags) => tags?.map((tag) => tag.trim()).filter((tag) => tag.length > 0)),
  metadata: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean().optional(),
});

const ruleSimulationSchema = z
  .object({
    ruleId: z.string().min(1).optional(),
    definition: ruleDefinitionSchema.optional(),
    input: z
      .object({
        context: z.record(z.string(), z.unknown()).optional(),
        event: z.record(z.string(), z.unknown()).optional(),
        sensor: z.record(z.string(), z.unknown()).optional(),
      })
      .catchall(z.unknown())
      .default({}),
  })
  .refine((payload) => payload.ruleId || payload.definition, {
    message: 'Provide a ruleId or inline definition to simulate.',
  });

export type ZigbeeRuleTrigger = z.infer<typeof triggerSchema>;
export type ZigbeeRuleAction = z.infer<typeof actionSchema>;
export type ZigbeeRuleInput = z.infer<typeof ruleDefinitionSchema>;
export type ZigbeeRuleUpdateInput = z.infer<typeof ruleUpdateSchema>;
export type ZigbeeRuleSimulationInput = z.infer<typeof ruleSimulationSchema>;

export interface ZigbeeRuleRecord {
  id: string;
  name: string;
  description: string | null;
  trigger: ZigbeeRuleTrigger;
  actions: ZigbeeRuleAction[];
  tags: string[];
  metadata: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ZigbeeRuleSimulationResult {
  matched: boolean;
  actions: ZigbeeRuleAction[];
  rule: ZigbeeRuleRecord;
  evaluation: {
    triggerType: ZigbeeRuleTrigger['type'];
    reason: string;
    startedAt: string;
    completedAt: string;
    durationMs: number;
    error?: string;
  };
}

const RULES_PATH = resolve(
  config.ZIGBEE_RULES_PATH ?? resolve(process.cwd(), '../backups/zigbee-rules.json')
);
const FALLBACK_RULES_PATH = resolve(
  config.ZIGBEE_RULES_FALLBACK_PATH ??
    resolve(__dirname, '../../../api-mock/fixtures/zigbee.rules.json')
);

let cache: ZigbeeRuleRecord[] | null = null;
let cacheLoaded = false;

function uniqueTags(tags?: string[]): string[] {
  if (!tags || tags.length === 0) {
    return [];
  }
  const seen = new Set<string>();
  for (const tag of tags) {
    const normalized = tag.trim().toLowerCase();
    if (!normalized) continue;
    seen.add(normalized);
  }
  return Array.from(seen.values()).slice(0, 10);
}

async function readJsonFile(path: string): Promise<unknown> {
  const text = await readFile(path, 'utf8');
  return JSON.parse(text) as unknown;
}

async function writeRulesFile(rules: ZigbeeRuleRecord[]): Promise<void> {
  const dir = dirname(RULES_PATH);
  await mkdir(dir, { recursive: true });
  await writeFile(RULES_PATH, JSON.stringify({ items: rules }, null, 2), 'utf8');
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function loadRules(): Promise<ZigbeeRuleRecord[]> {
  if (cacheLoaded && cache) {
    return cache;
  }

  let payload: unknown;

  if (await fileExists(RULES_PATH)) {
    payload = await readJsonFile(RULES_PATH);
  } else if (await fileExists(FALLBACK_RULES_PATH)) {
    payload = await readJsonFile(FALLBACK_RULES_PATH);
  } else {
    payload = { items: [] };
  }

  const parsed = normalizeStorePayload(payload);
  cache = parsed;
  cacheLoaded = true;
  return parsed;
}

function normalizeStorePayload(payload: unknown): ZigbeeRuleRecord[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const items = Array.isArray((payload as any).items)
    ? ((payload as any).items as unknown[])
    : Array.isArray(payload)
      ? (payload as unknown[])
      : [];

  const results: ZigbeeRuleRecord[] = [];
  for (const item of items) {
    try {
      const normalized = coerceRuleRecord(item);
      if (normalized) {
        results.push(normalized);
      }
    } catch {
      // ignore invalid entries
    }
  }
  return results;
}

function coerceRuleRecord(value: unknown): ZigbeeRuleRecord | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  const id = typeof record.id === 'string' && record.id.length > 0 ? record.id : randomUUID();
  const now = new Date().toISOString();
  const base = ruleDefinitionSchema.parse({
    name: record.name,
    description: record.description,
    trigger: record.trigger,
    actions: record.actions,
    tags: record.tags,
    metadata: record.metadata,
    enabled: record.enabled,
  });
  return {
    id,
    name: base.name,
    description: base.description ?? null,
    trigger: base.trigger,
    actions: base.actions,
    tags: uniqueTags(base.tags),
    metadata: base.metadata ?? {},
    enabled: base.enabled ?? true,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : now,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : now,
  };
}

async function persist(rules: ZigbeeRuleRecord[]): Promise<void> {
  cache = rules;
  cacheLoaded = true;
  await writeRulesFile(rules);
}

export async function listZigbeeRules(): Promise<ZigbeeRuleRecord[]> {
  const rules = await loadRules();
  return rules.map((rule) => structuredClone(rule));
}

export async function getZigbeeRule(ruleId: string): Promise<ZigbeeRuleRecord> {
  const rules = await loadRules();
  const found = rules.find((rule) => rule.id === ruleId);
  if (!found) {
    throw createHttpError(404, 'not_found', 'Rule not found');
  }
  return structuredClone(found);
}

export async function createZigbeeRule(input: ZigbeeRuleInput): Promise<ZigbeeRuleRecord> {
  const normalized = ruleDefinitionSchema.parse(input);
  const now = new Date().toISOString();
  const rule: ZigbeeRuleRecord = {
    id: randomUUID(),
    name: normalized.name,
    description: normalized.description ?? null,
    trigger: normalized.trigger,
    actions: normalized.actions,
    tags: uniqueTags(normalized.tags),
    metadata: normalized.metadata ?? {},
    enabled: normalized.enabled ?? true,
    createdAt: now,
    updatedAt: now,
  };
  const rules = await loadRules();
  rules.push(rule);
  await persist(rules);
  return structuredClone(rule);
}

export async function updateZigbeeRule(
  ruleId: string,
  input: ZigbeeRuleUpdateInput
): Promise<ZigbeeRuleRecord> {
  const rules = await loadRules();
  const index = rules.findIndex((rule) => rule.id === ruleId);
  if (index === -1) {
    throw createHttpError(404, 'not_found', 'Rule not found');
  }
  const updates = ruleUpdateSchema.parse(input);
  const existing = rules[index];
  const next: ZigbeeRuleRecord = {
    ...existing,
    name: updates.name ?? existing.name,
    description:
      updates.description === null
        ? null
        : typeof updates.description === 'string'
          ? updates.description
          : updates.description === undefined
            ? existing.description
            : null,
    trigger: updates.trigger ?? existing.trigger,
    actions: updates.actions ?? existing.actions,
    tags: updates.tags ? uniqueTags(updates.tags) : existing.tags,
    metadata: updates.metadata ?? existing.metadata,
    enabled: updates.enabled ?? existing.enabled,
    updatedAt: new Date().toISOString(),
  };
  rules[index] = next;
  await persist(rules);
  return structuredClone(next);
}

export async function deleteZigbeeRule(ruleId: string): Promise<void> {
  const rules = await loadRules();
  const filtered = rules.filter((rule) => rule.id !== ruleId);
  if (filtered.length === rules.length) {
    throw createHttpError(404, 'not_found', 'Rule not found');
  }
  await persist(filtered);
}

export function validateZigbeeRuleDefinition(input: unknown): ZigbeeRuleInput {
  return ruleDefinitionSchema.parse(input);
}

function freezeDeep<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const key of Object.keys(value as Record<string, unknown>)) {
      const child = (value as Record<string, unknown>)[key];
      if (child && typeof child === 'object' && !Object.isFrozen(child)) {
        freezeDeep(child);
      }
    }
  }
  return value;
}

function getByPath(source: Record<string, unknown>, path: string): unknown {
  if (!path) return undefined;
  const segments = path.split('.');
  let current: unknown = source;
  for (const segment of segments) {
    if (!current || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function compareValues(
  operator: (typeof comparisonOperators)[number],
  left: unknown,
  right: unknown
): boolean {
  switch (operator) {
    case 'eq':
      return left === right;
    case 'neq':
      return left !== right;
    case 'gt':
      return typeof left === 'number' && typeof right === 'number' ? left > right : false;
    case 'gte':
      return typeof left === 'number' && typeof right === 'number' ? left >= right : false;
    case 'lt':
      return typeof left === 'number' && typeof right === 'number' ? left < right : false;
    case 'lte':
      return typeof left === 'number' && typeof right === 'number' ? left <= right : false;
    case 'includes':
      if (typeof left === 'string' && typeof right === 'string') {
        return left.includes(right);
      }
      if (Array.isArray(left)) {
        return left.includes(right as never);
      }
      return false;
    case 'excludes':
      if (typeof left === 'string' && typeof right === 'string') {
        return !left.includes(right);
      }
      if (Array.isArray(left)) {
        return !left.includes(right as never);
      }
      return false;
    default:
      return false;
  }
}

function runExpression(expression: string, context: Record<string, unknown>): boolean {
  const script = new Script(`(function(context){"use strict"; return (${expression});})`);
  const fn = script.runInNewContext({ Math }) as (ctx: Record<string, unknown>) => unknown;
  const result = fn(freezeDeep(structuredClone(context)));
  return Boolean(result);
}

function evaluateTrigger(
  trigger: ZigbeeRuleTrigger,
  input: ZigbeeRuleSimulationInput['input']
): { matched: boolean; reason: string; error?: string } {
  if (trigger.type === 'sensor_event') {
    const event = (input.event as Record<string, unknown>) ?? {};
    const sensorId =
      typeof event.sensorId === 'string' ? event.sensorId : (input.sensor as any)?.id;
    const eventType = typeof event.type === 'string' ? event.type : (input.event as any)?.event;
    if (sensorId !== trigger.sensorId || eventType !== trigger.event) {
      return {
        matched: false,
        reason: 'Sensor or event type did not match.',
      };
    }
    if (trigger.condition) {
      const payload =
        (event.payload as Record<string, unknown>) ??
        (input.context as Record<string, unknown>) ??
        {};
      const value = getByPath(payload, trigger.condition.field);
      const matched = compareValues(trigger.condition.operator, value, trigger.condition.value);
      return {
        matched,
        reason: matched ? 'Condition matched.' : 'Condition did not match.',
      };
    }
    return { matched: true, reason: 'Sensor and event matched.' };
  }

  if (trigger.type === 'schedule') {
    const ctx = (input.context as Record<string, unknown>) ?? {};
    const cron = typeof ctx.cron === 'string' ? ctx.cron : undefined;
    const matched = cron ? cron === trigger.cron : Boolean(ctx.scheduled === true);
    return {
      matched,
      reason: matched ? 'Schedule matched context.' : 'Schedule context did not match.',
    };
  }

  if (trigger.type === 'expression') {
    try {
      const ctx: Record<string, unknown> = {
        ...((input.context as Record<string, unknown>) ?? {}),
        event: input.event ?? {},
        sensor: input.sensor ?? {},
        context: input.context ?? {},
        now: new Date().toISOString(),
      };
      const matched = runExpression(trigger.expression, ctx);
      return {
        matched,
        reason: matched
          ? 'Expression evaluated to truthy value.'
          : 'Expression evaluated to falsy value.',
      };
    } catch (error) {
      return {
        matched: false,
        reason: 'Expression evaluation failed.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  return { matched: false, reason: 'Unsupported trigger type.' };
}

export async function simulateZigbeeRule(
  payload: ZigbeeRuleSimulationInput
): Promise<ZigbeeRuleSimulationResult> {
  const parsed = ruleSimulationSchema.parse(payload);
  const startedAt = new Date();
  let rule: ZigbeeRuleRecord;

  if (parsed.definition) {
    const normalized = ruleDefinitionSchema.parse(parsed.definition);
    rule = {
      id: parsed.ruleId ?? `sim-${randomUUID()}`,
      name: normalized.name,
      description: normalized.description ?? null,
      trigger: normalized.trigger,
      actions: normalized.actions,
      tags: uniqueTags(normalized.tags),
      metadata: normalized.metadata ?? {},
      enabled: normalized.enabled ?? true,
      createdAt: startedAt.toISOString(),
      updatedAt: startedAt.toISOString(),
    };
  } else {
    rule = await getZigbeeRule(parsed.ruleId!);
  }

  const evaluation = evaluateTrigger(rule.trigger, parsed.input);
  const completedAt = new Date();

  return {
    matched: evaluation.matched,
    actions: evaluation.matched ? structuredClone(rule.actions) : [],
    rule,
    evaluation: {
      triggerType: rule.trigger.type,
      reason: evaluation.reason,
      error: evaluation.error,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.getTime() - startedAt.getTime(),
    },
  };
}

export function getZigbeeRuleSchemas() {
  return {
    definition: ruleDefinitionSchema,
    update: ruleUpdateSchema,
    simulation: ruleSimulationSchema,
  };
}

export function __clearZigbeeRuleCacheForTests() {
  cache = null;
  cacheLoaded = false;
}

import type {
  CostInfo,
  ModelDefinition,
  RunMetrics,
  StructuredOutputResult,
  TokenUsage,
} from '@ai-sdk-playground/protocol';

export function estimateTokens(text: string): number {
  const trimmed = text.trim();
  return trimmed ? Math.max(1, Math.ceil(trimmed.length / 4)) : 0;
}

export function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/u).length : 0;
}

export function calculateCost(model: ModelDefinition, usage: TokenUsage): CostInfo {
  if (!model.pricing || usage.inputTokens === undefined || usage.outputTokens === undefined) {
    return { currency: 'USD', source: 'unknown' };
  }
  const input = (usage.inputTokens / 1_000_000) * (model.pricing.inputUsdPerMillionTokens ?? 0);
  const output = (usage.outputTokens / 1_000_000) * (model.pricing.outputUsdPerMillionTokens ?? 0);
  const cached =
    ((usage.cachedInputTokens ?? 0) / 1_000_000) *
    (model.pricing.cachedInputUsdPerMillionTokens ?? model.pricing.inputUsdPerMillionTokens ?? 0);
  return {
    currency: 'USD',
    source: 'catalog-estimate',
    estimatedUsd: Number((input + output + cached).toFixed(8)),
  };
}

export function mergeUsage(usage: Partial<TokenUsage>, fallbackText: string, inputText: string): TokenUsage {
  const inputTokens = usage.inputTokens ?? estimateTokens(inputText);
  const outputTokens = usage.outputTokens ?? estimateTokens(fallbackText);
  return {
    inputTokens,
    outputTokens,
    totalTokens: usage.totalTokens ?? inputTokens + outputTokens,
    cachedInputTokens: usage.cachedInputTokens,
    source: usage.source ?? 'estimated',
  };
}

export function buildMetrics(args: {
  startedAt: string;
  totalDurationMs: number;
  firstEventMs?: number;
  firstReasoningMs?: number;
  firstTextMs?: number;
  firstToolCallMs?: number;
  text: string;
  usage: TokenUsage;
  cost: CostInfo;
}): RunMetrics {
  const firstUseful = [args.firstTextMs, args.firstToolCallMs, args.firstReasoningMs].filter(
    (value): value is number => value !== undefined,
  )[0];
  const generationDurationMs =
    firstUseful === undefined ? undefined : Math.max(1, args.totalDurationMs - firstUseful);
  const outputTokensPerSecond =
    generationDurationMs && args.usage.outputTokens !== undefined
      ? Number((args.usage.outputTokens / (generationDurationMs / 1000)).toFixed(2))
      : undefined;
  return {
    requestStartedAt: args.startedAt,
    firstEventMs: args.firstEventMs,
    firstReasoningMs: args.firstReasoningMs,
    firstTextMs: args.firstTextMs,
    firstToolCallMs: args.firstToolCallMs,
    ttftMs: firstUseful,
    totalDurationMs: Math.round(args.totalDurationMs),
    generationDurationMs: generationDurationMs === undefined ? undefined : Math.round(generationDurationMs),
    outputTokensPerSecond,
    usage: args.usage,
    cost: args.cost,
    characterCount: args.text.length,
    wordCount: countWords(args.text),
  };
}

export function parseStructuredOutput(
  text: string,
  schema?: Record<string, unknown>,
): StructuredOutputResult {
  try {
    const value = JSON.parse(text) as unknown;
    const errors = schema ? validateSimpleSchema(value, schema) : [];
    return {
      rawText: text,
      value,
      validJson: true,
      schemaValid: schema ? errors.length === 0 : undefined,
      errors,
    };
  } catch (error) {
    return {
      rawText: text,
      validJson: false,
      schemaValid: schema ? false : undefined,
      errors: [String(error)],
    };
  }
}

function validateSimpleSchema(value: unknown, schema: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return ['Expected an object'];
    const objectValue = value as Record<string, unknown>;
    const required = Array.isArray(schema.required) ? schema.required : [];
    for (const field of required) {
      if (typeof field === 'string' && !(field in objectValue))
        errors.push(`Missing required field: ${field}`);
    }
    const properties = schema.properties && typeof schema.properties === 'object' ? schema.properties : {};
    if (properties && typeof properties === 'object') {
      for (const [key, definition] of Object.entries(properties as Record<string, unknown>)) {
        if (!(key in objectValue) || !definition || typeof definition !== 'object') continue;
        const expected = (definition as Record<string, unknown>).type;
        if (expected === 'string' && typeof objectValue[key] !== 'string')
          errors.push(`${key} must be a string`);
        if (expected === 'number' && typeof objectValue[key] !== 'number')
          errors.push(`${key} must be a number`);
        if (expected === 'boolean' && typeof objectValue[key] !== 'boolean')
          errors.push(`${key} must be a boolean`);
      }
    }
  }
  return errors;
}

export function percentile(values: number[], percentileValue: number): number | undefined {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1),
  );
  return sorted[index];
}

export function summarizeConsistency(metrics: RunMetrics[]) {
  const durations = metrics.map((metric) => metric.totalDurationMs);
  const lengths = metrics.map((metric) => metric.characterCount);
  return {
    runs: metrics.length,
    averageCharacters: lengths.length
      ? Math.round(lengths.reduce((sum, value) => sum + value, 0) / lengths.length)
      : 0,
    lengthStdDev: standardDeviation(lengths),
    p50DurationMs: percentile(durations, 50),
    p95DurationMs: percentile(durations, 95),
    jsonValidityRate: undefined as number | undefined,
    schemaPassRate: undefined as number | undefined,
  };
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Number(
    Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length).toFixed(2),
  );
}

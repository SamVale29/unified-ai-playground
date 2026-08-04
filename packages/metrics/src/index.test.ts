import { buildMetrics, calculateCost, parseStructuredOutput, percentile } from './index';
import type { ModelDefinition } from '@ai-sdk-playground/protocol';

const model: ModelDefinition = {
  id: 'test:model',
  providerId: 'openai',
  apiModelId: 'test',
  displayName: 'Test',
  status: 'active',
  capabilities: { textInput: true, textOutput: true },
  limits: {},
  pricing: { currency: 'USD', inputUsdPerMillionTokens: 1, outputUsdPerMillionTokens: 2 },
  source: { url: 'https://example.com', checkedAt: '2026-08-03' },
};

describe('metrics', () => {
  it('calculates token cost from catalog data without pretending it is provider-reported', () => {
    expect(calculateCost(model, { inputTokens: 1000, outputTokens: 500, source: 'provider' })).toEqual({
      currency: 'USD',
      source: 'catalog-estimate',
      estimatedUsd: 0.002,
    });
  });

  it('keeps invalid JSON visible', () => {
    const result = parseStructuredOutput('{bad');
    expect(result.validJson).toBe(false);
    expect(result.rawText).toBe('{bad');
  });

  it('computes useful latency fields', () => {
    const metrics = buildMetrics({
      startedAt: '2026-08-03T00:00:00.000Z',
      totalDurationMs: 500,
      firstTextMs: 100,
      text: 'hello world',
      usage: { inputTokens: 2, outputTokens: 4, source: 'provider' },
      cost: { currency: 'USD', source: 'unknown' },
    });
    expect(metrics.ttftMs).toBe(100);
    expect(metrics.outputTokensPerSecond).toBe(10);
  });

  it('returns percentile values', () => {
    expect(percentile([10, 5, 30, 20], 50)).toBe(10);
    expect(percentile([], 50)).toBeUndefined();
  });
});

import { createExperiment, createMockAdapter, runExperiment, textMessage, validateExperiment } from './index';

describe('core experiment runtime', () => {
  const experiment = createExperiment({
    name: 'test',
    request: {
      messages: [textMessage('Explain a deterministic fixture.')],
      generation: { maxOutputTokens: 100 },
    },
    targets: [
      { id: 'openai-target', providerId: 'openai', modelId: 'openai:gpt-4o-mini', enabled: true },
      {
        id: 'anthropic-target',
        providerId: 'anthropic',
        modelId: 'anthropic:claude-3-5-sonnet-20241022',
        enabled: true,
      },
    ],
    execution: { stream: true, repetitions: 1 },
  });

  it('validates the two-target minimum', () => {
    expect(validateExperiment(experiment)).toEqual([]);
    expect(validateExperiment({ ...experiment, targets: [experiment.targets[0]] })).toContain(
      'Enable between two and eight targets.',
    );
  });

  it('runs deterministic mock streams and preserves events', async () => {
    const events: string[] = [];
    const result = await runExperiment(experiment, {
      mode: 'mock',
      adapters: [createMockAdapter('openai'), createMockAdapter('anthropic')],
      onEvent: (event) => {
        events.push(event.type);
      },
    });
    expect(result.runs).toHaveLength(2);
    expect(result.runs.every((run) => run.status === 'completed')).toBe(true);
    expect(events).toContain('text-delta');
    expect(events).toContain('response-completed');
  }, 10_000);

  it('blocks unsupported requested capabilities in strict mode', async () => {
    const strict = createExperiment({
      ...experiment,
      request: {
        ...experiment.request,
        generation: { ...experiment.request.generation, topK: 20 },
        output: { format: 'json-schema', schema: { type: 'object' }, strict: true },
      },
      execution: { ...experiment.execution, compatibilityMode: 'strict', stream: false },
    });
    const result = await runExperiment(strict, {
      mode: 'mock',
      adapters: [createMockAdapter('openai'), createMockAdapter('anthropic')],
    });
    expect(result.runs.every((run) => run.status === 'blocked')).toBe(true);
  });
});

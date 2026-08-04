import { anthropicAdapter } from '@ai-sdk-playground/adapter-anthropic';
import { deepSeekAdapter } from '@ai-sdk-playground/adapter-deepseek';
import { googleAdapter } from '@ai-sdk-playground/adapter-google';
import { mistralAdapter } from '@ai-sdk-playground/adapter-mistral';
import { openAIAdapter } from '@ai-sdk-playground/adapter-openai';
import { openRouterAdapter } from '@ai-sdk-playground/adapter-openrouter';
import { xaiAdapter } from '@ai-sdk-playground/adapter-xai';
import { getModel } from '@ai-sdk-playground/catalog';
import { inspectAdapterContract } from './index';
import type { ProviderAdapter, UnifiedRequest } from '@ai-sdk-playground/protocol';

const request: UnifiedRequest = {
  messages: [{ id: 'u', role: 'user', content: [{ type: 'text', text: 'fixture' }] }],
  generation: { temperature: 0.2 },
  output: { format: 'text' },
};
const adapters: ProviderAdapter[] = [
  openAIAdapter(),
  anthropicAdapter(),
  googleAdapter(),
  xaiAdapter(),
  deepSeekAdapter(),
  mistralAdapter(),
  openRouterAdapter(),
];

describe('provider adapter contract', () => {
  it.each(adapters.map((adapter) => [adapter.id, adapter]))(
    '%s exposes compatibility, transformation, capabilities and error normalization',
    async (_id, adapter) => {
      const providerAdapter = adapter as ProviderAdapter;
      const report = await inspectAdapterContract(
        providerAdapter,
        request,
        getModel(providerAdapter.id, providerAdapter.id),
      );
      expect(report.hasNormalizer).toBe(true);
      expect(report.transformation.nativeRequest).toBeDefined();
      expect(report.capabilities.providerId).toBe(providerAdapter.id);
    },
  );
});

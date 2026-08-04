import {
  buildOpenAICompatibleTransformation,
  createHttpAdapter,
  parseOpenAICompatibleResponse,
} from '@ai-sdk-playground/core';
import type { ExecutionContext } from '@ai-sdk-playground/protocol';

export function createOpenRouterAdapter() {
  return createHttpAdapter({
    id: 'openrouter',
    version: '0.1.0',
    buildRequest: (request, model) => buildOpenAICompatibleTransformation(request, model, 'openrouter'),
    buildUrl: (_model, baseUrl) => `${baseUrl.replace(/\/$/u, '')}/chat/completions`,
    buildHeaders: (context: ExecutionContext) => ({
      Authorization: `Bearer ${context.apiKey ?? ''}`,
      'HTTP-Referer': 'https://samvale29.github.io/unified-ai-playground',
      'X-Title': 'AI SDK Playground',
    }),
    parseResponse: parseOpenAICompatibleResponse,
  });
}

export const openRouterAdapter = createOpenRouterAdapter;

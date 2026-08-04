import {
  buildAnthropicTransformation,
  createHttpAdapter,
  parseAnthropicResponse,
} from '@ai-sdk-playground/core';
import type { ExecutionContext } from '@ai-sdk-playground/protocol';

export function createAnthropicAdapter() {
  return createHttpAdapter({
    id: 'anthropic',
    version: '0.1.0',
    buildRequest: buildAnthropicTransformation,
    buildUrl: (_model, baseUrl) => `${baseUrl.replace(/\/$/u, '')}/messages`,
    buildHeaders: (context: ExecutionContext) => ({
      'x-api-key': context.apiKey ?? '',
      'anthropic-version': '2023-06-01',
    }),
    parseResponse: parseAnthropicResponse,
  });
}

export const anthropicAdapter = createAnthropicAdapter;

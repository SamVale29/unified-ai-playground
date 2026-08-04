import {
  buildOpenAICompatibleTransformation,
  createHttpAdapter,
  parseOpenAICompatibleResponse,
} from '@ai-sdk-playground/core';
import type { ExecutionContext } from '@ai-sdk-playground/protocol';

export function createMistralAdapter() {
  return createHttpAdapter({
    id: 'mistral',
    version: '0.1.0',
    buildRequest: (request, model) => buildOpenAICompatibleTransformation(request, model, 'mistral'),
    buildUrl: (_model, baseUrl) => `${baseUrl.replace(/\/$/u, '')}/chat/completions`,
    buildHeaders: (context: ExecutionContext) => ({ Authorization: `Bearer ${context.apiKey ?? ''}` }),
    parseResponse: parseOpenAICompatibleResponse,
  });
}

export const mistralAdapter = createMistralAdapter;

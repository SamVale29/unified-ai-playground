import {
  buildOpenAICompatibleTransformation,
  createHttpAdapter,
  parseOpenAICompatibleResponse,
} from '@ai-sdk-playground/core';
import type { ExecutionContext } from '@ai-sdk-playground/protocol';

export function createXaiAdapter() {
  return createHttpAdapter({
    id: 'xai',
    version: '0.1.0',
    buildRequest: (request, model) => buildOpenAICompatibleTransformation(request, model, 'xai'),
    buildUrl: (_model, baseUrl) => `${baseUrl.replace(/\/$/u, '')}/chat/completions`,
    buildHeaders: (context: ExecutionContext) => ({ Authorization: `Bearer ${context.apiKey ?? ''}` }),
    parseResponse: parseOpenAICompatibleResponse,
  });
}

export const xaiAdapter = createXaiAdapter;

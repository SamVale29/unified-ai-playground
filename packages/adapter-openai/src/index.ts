import {
  buildOpenAICompatibleTransformation,
  createHttpAdapter,
  parseOpenAICompatibleResponse,
} from '@ai-sdk-playground/core';
import type { ExecutionContext } from '@ai-sdk-playground/protocol';

export function createOpenAIAdapter() {
  return createHttpAdapter({
    id: 'openai',
    version: '0.1.0',
    buildRequest: (request, model) => buildOpenAICompatibleTransformation(request, model, 'openai'),
    buildUrl: (_model, baseUrl) => `${baseUrl.replace(/\/$/u, '')}/chat/completions`,
    buildHeaders: (context: ExecutionContext) => ({ Authorization: `Bearer ${context.apiKey ?? ''}` }),
    parseResponse: parseOpenAICompatibleResponse,
  });
}

export const openAIAdapter = createOpenAIAdapter;

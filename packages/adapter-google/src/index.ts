import { buildGoogleTransformation, createHttpAdapter, parseGoogleResponse } from '@ai-sdk-playground/core';
import type { ExecutionContext } from '@ai-sdk-playground/protocol';

export function createGoogleAdapter() {
  return createHttpAdapter({
    id: 'google',
    version: '0.1.0',
    buildRequest: buildGoogleTransformation,
    buildUrl: (model, baseUrl) =>
      `${baseUrl.replace(/\/$/u, '')}/models/${encodeURIComponent(model.apiModelId)}:generateContent`,
    buildHeaders: (context: ExecutionContext) => ({ 'x-goog-api-key': context.apiKey ?? '' }),
    parseResponse: parseGoogleResponse,
  });
}

export const googleAdapter = createGoogleAdapter;

import type { ModelDefinition, ProviderAdapter, UnifiedRequest } from '@ai-sdk-playground/protocol';

export async function inspectAdapterContract(
  adapter: ProviderAdapter,
  request: UnifiedRequest,
  model: ModelDefinition,
) {
  const report = await adapter.validate(request, model);
  const transformation = await adapter.transformRequest(request, model);
  const capabilities = await adapter.getCapabilities(model);
  return {
    report,
    transformation,
    capabilities,
    hasNormalizer: typeof adapter.normalizeError === 'function',
    hasStream: typeof adapter.stream === 'function',
  };
}

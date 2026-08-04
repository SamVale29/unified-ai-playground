import type { ModelDefinition, ProviderDefinition, ProviderId } from '@ai-sdk-playground/protocol';

export const CATALOG_CHECKED_AT = '2026-08-03';

export const PROVIDER_CATALOG: ProviderDefinition[] = [
  {
    id: 'openai',
    displayName: 'OpenAI',
    shortName: 'OpenAI',
    envKey: 'OPENAI_API_KEY',
    baseUrlEnvKey: 'OPENAI_BASE_URL',
    defaultBaseUrl: 'https://api.openai.com/v1',
    docsUrl: 'https://platform.openai.com/docs/api-reference/chat',
    modelsUrl: 'https://platform.openai.com/docs/models',
    defaultModelId: 'gpt-4o-mini',
    status: 'available',
    notes: [
      'The adapter uses Chat Completions for the v0.1 contract and keeps Responses-specific features explicit.',
    ],
  },
  {
    id: 'anthropic',
    displayName: 'Anthropic',
    shortName: 'Anthropic',
    envKey: 'ANTHROPIC_API_KEY',
    baseUrlEnvKey: 'ANTHROPIC_BASE_URL',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    docsUrl: 'https://docs.anthropic.com/en/api/messages',
    modelsUrl: 'https://docs.anthropic.com/en/docs/about-claude/models',
    defaultModelId: 'claude-3-5-sonnet-20241022',
    status: 'available',
    notes: ['System instructions are kept outside the user message when transformed to Messages API.'],
  },
  {
    id: 'google',
    displayName: 'Google Gemini',
    shortName: 'Gemini',
    envKey: 'GOOGLE_GENERATIVE_AI_API_KEY',
    baseUrlEnvKey: 'GOOGLE_BASE_URL',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    docsUrl: 'https://ai.google.dev/api/generate-content',
    modelsUrl: 'https://ai.google.dev/gemini-api/docs/models',
    defaultModelId: 'gemini-2.0-flash',
    status: 'available',
    notes: ['Gemini contents and parts are preserved as a provider-specific native request.'],
  },
  {
    id: 'xai',
    displayName: 'xAI',
    shortName: 'xAI',
    envKey: 'XAI_API_KEY',
    baseUrlEnvKey: 'XAI_BASE_URL',
    defaultBaseUrl: 'https://api.x.ai/v1',
    docsUrl: 'https://docs.x.ai/docs/api-reference',
    modelsUrl: 'https://docs.x.ai/docs/models',
    defaultModelId: 'grok-3-mini',
    status: 'available',
    notes: [
      'The adapter uses the documented OpenAI-compatible chat surface while retaining xAI-specific options.',
    ],
  },
  {
    id: 'deepseek',
    displayName: 'DeepSeek',
    shortName: 'DeepSeek',
    envKey: 'DEEPSEEK_API_KEY',
    baseUrlEnvKey: 'DEEPSEEK_BASE_URL',
    defaultBaseUrl: 'https://api.deepseek.com',
    docsUrl: 'https://api-docs.deepseek.com/api/create-chat-completion',
    modelsUrl: 'https://api-docs.deepseek.com/quick_start/pricing',
    defaultModelId: 'deepseek-chat',
    status: 'available',
    notes: [
      'Reasoning content is exposed when returned by the provider and is not synthesized by the adapter.',
    ],
  },
  {
    id: 'mistral',
    displayName: 'Mistral AI',
    shortName: 'Mistral',
    envKey: 'MISTRAL_API_KEY',
    baseUrlEnvKey: 'MISTRAL_BASE_URL',
    defaultBaseUrl: 'https://api.mistral.ai/v1',
    docsUrl: 'https://docs.mistral.ai/api/',
    modelsUrl: 'https://docs.mistral.ai/getting-started/models/',
    defaultModelId: 'mistral-small-latest',
    status: 'available',
    notes: [
      'OCR and FIM are intentionally kept as provider-specific extensions instead of universal features.',
    ],
  },
  {
    id: 'openrouter',
    displayName: 'OpenRouter',
    shortName: 'OpenRouter',
    envKey: 'OPENROUTER_API_KEY',
    baseUrlEnvKey: 'OPENROUTER_BASE_URL',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    docsUrl: 'https://openrouter.ai/docs/api-reference/overview',
    modelsUrl: 'https://openrouter.ai/models',
    defaultModelId: 'openrouter/auto',
    status: 'available',
    notes: [
      'Routing metadata remains raw/provider-specific; the requested model is not silently treated as the executed model.',
    ],
  },
];

const textCapabilities = {
  textInput: true as const,
  textOutput: true as const,
  streaming: true as const,
  tools: 'partial' as const,
  structuredOutput: 'partial' as const,
  jsonMode: 'partial' as const,
  reasoning: 'unknown' as const,
  seed: 'partial' as const,
};

const source = (url: string) => ({ url, checkedAt: CATALOG_CHECKED_AT });

export const MODEL_CATALOG: ModelDefinition[] = [
  {
    id: 'openai:gpt-4o-mini',
    providerId: 'openai',
    apiModelId: 'gpt-4o-mini',
    displayName: 'GPT-4o mini',
    status: 'unknown',
    capabilities: { ...textCapabilities, imageInput: true, structuredOutput: true, jsonMode: true },
    limits: { contextTokens: null, outputTokens: null },
    pricing: null,
    source: source('https://platform.openai.com/docs/models'),
    metadata: { defaultAlias: true },
  },
  {
    id: 'anthropic:claude-3-5-sonnet-20241022',
    providerId: 'anthropic',
    apiModelId: 'claude-3-5-sonnet-20241022',
    displayName: 'Claude 3.5 Sonnet',
    status: 'unknown',
    capabilities: { ...textCapabilities, imageInput: true, reasoning: 'partial' },
    limits: { contextTokens: null, outputTokens: null },
    pricing: null,
    source: source('https://docs.anthropic.com/en/docs/about-claude/models'),
    metadata: { defaultAlias: true },
  },
  {
    id: 'google:gemini-2.0-flash',
    providerId: 'google',
    apiModelId: 'gemini-2.0-flash',
    displayName: 'Gemini 2.0 Flash',
    status: 'unknown',
    capabilities: {
      ...textCapabilities,
      imageInput: true,
      audioInput: 'partial',
      videoInput: 'partial',
      fileInput: 'partial',
      structuredOutput: true,
    },
    limits: { contextTokens: null, outputTokens: null },
    pricing: null,
    source: source('https://ai.google.dev/gemini-api/docs/models'),
    metadata: { defaultAlias: true },
  },
  {
    id: 'xai:grok-3-mini',
    providerId: 'xai',
    apiModelId: 'grok-3-mini',
    displayName: 'Grok 3 Mini',
    status: 'unknown',
    capabilities: { ...textCapabilities, reasoning: true, structuredOutput: 'partial' },
    limits: { contextTokens: null, outputTokens: null },
    pricing: null,
    source: source('https://docs.x.ai/docs/models'),
    metadata: { defaultAlias: true },
  },
  {
    id: 'deepseek:deepseek-chat',
    providerId: 'deepseek',
    apiModelId: 'deepseek-chat',
    displayName: 'DeepSeek Chat',
    status: 'unknown',
    capabilities: { ...textCapabilities, reasoning: 'partial', structuredOutput: 'partial' },
    limits: { contextTokens: null, outputTokens: null },
    pricing: null,
    source: source('https://api-docs.deepseek.com/quick_start/pricing'),
    metadata: { defaultAlias: true },
  },
  {
    id: 'mistral:mistral-small-latest',
    providerId: 'mistral',
    apiModelId: 'mistral-small-latest',
    displayName: 'Mistral Small',
    status: 'unknown',
    capabilities: { ...textCapabilities, imageInput: 'partial', structuredOutput: 'partial' },
    limits: { contextTokens: null, outputTokens: null },
    pricing: null,
    source: source('https://docs.mistral.ai/getting-started/models/'),
    metadata: { defaultAlias: true },
  },
  {
    id: 'openrouter:openrouter/auto',
    providerId: 'openrouter',
    apiModelId: 'openrouter/auto',
    displayName: 'OpenRouter Auto',
    status: 'unknown',
    capabilities: { ...textCapabilities, imageInput: 'partial', reasoning: 'unknown' },
    limits: { contextTokens: null, outputTokens: null },
    pricing: null,
    source: source('https://openrouter.ai/models'),
    metadata: { defaultAlias: true, routing: true },
  },
];

export function getProvider(providerId: ProviderId): ProviderDefinition {
  const provider = PROVIDER_CATALOG.find((item) => item.id === providerId);
  if (!provider) throw new Error(`Unknown provider: ${providerId}`);
  return provider;
}

export function getModel(modelId: string, providerId?: ProviderId): ModelDefinition {
  const model = MODEL_CATALOG.find(
    (item) => item.id === modelId || item.apiModelId === modelId || item.id === `${providerId}:${modelId}`,
  );
  if (model) return model;
  const provider = providerId ?? (modelId.includes(':') ? modelId.split(':')[0] : undefined);
  if (!provider || !PROVIDER_CATALOG.some((item) => item.id === provider)) {
    throw new Error(`Unknown model: ${modelId}`);
  }
  const definition = getProvider(provider as ProviderId);
  return {
    id: `${provider}:${modelId}`,
    providerId: provider as ProviderId,
    apiModelId: modelId,
    displayName: modelId,
    status: 'unknown',
    capabilities: {
      textInput: true,
      textOutput: true,
      streaming: 'unknown',
      tools: 'unknown',
      structuredOutput: 'unknown',
    },
    limits: { contextTokens: null, outputTokens: null },
    pricing: null,
    source: { url: definition.modelsUrl, checkedAt: CATALOG_CHECKED_AT },
    metadata: { discovered: false, unverified: true },
  };
}

export function modelsForProvider(providerId: ProviderId): ModelDefinition[] {
  return MODEL_CATALOG.filter((model) => model.providerId === providerId);
}

export function validateCatalog(): string[] {
  const errors: string[] = [];
  const providerIds = new Set(PROVIDER_CATALOG.map((provider) => provider.id));
  for (const provider of PROVIDER_CATALOG) {
    if (!provider.docsUrl.startsWith('https://')) errors.push(`${provider.id}: docsUrl must be HTTPS`);
    if (!provider.modelsUrl.startsWith('https://')) errors.push(`${provider.id}: modelsUrl must be HTTPS`);
  }
  for (const model of MODEL_CATALOG) {
    if (!providerIds.has(model.providerId)) errors.push(`${model.id}: provider is not in provider catalog`);
    if (model.source.checkedAt !== CATALOG_CHECKED_AT) errors.push(`${model.id}: stale checkedAt`);
    if (!model.source.url.startsWith('https://')) errors.push(`${model.id}: source must be HTTPS`);
  }
  return errors;
}

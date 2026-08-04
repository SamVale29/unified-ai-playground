import { getModel, getProvider, PROVIDER_CATALOG } from '@ai-sdk-playground/catalog';
import {
  buildMetrics,
  calculateCost,
  estimateTokens,
  mergeUsage,
  parseStructuredOutput,
} from '@ai-sdk-playground/metrics';
import type {
  CompatibilityReport,
  CompatibilityWarning,
  ContentPart,
  ExecutionContext,
  ExperimentDefinition,
  ExperimentResult,
  FinishReason,
  ModelDefinition,
  NativeRequestTransformation,
  ProviderAdapter,
  ProviderCapabilities,
  ProviderId,
  ProviderResponse,
  StructuredOutputResult,
  TargetRun,
  TokenUsage,
  ToolCall,
  UnifiedErrorCode,
  UnifiedMessage,
  UnifiedProviderError,
  UnifiedRequest,
  UnifiedStreamEvent,
} from '@ai-sdk-playground/protocol';
import { SCHEMA_VERSION } from '@ai-sdk-playground/protocol';

export interface CreateExperimentInput {
  name?: string;
  request: UnifiedRequest;
  targets: ExperimentDefinition['targets'];
  execution?: Partial<ExperimentDefinition['execution']>;
  privacy?: Partial<ExperimentDefinition['privacy']>;
  tags?: string[];
}

export interface RunExperimentOptions {
  adapters: ProviderAdapter[];
  mode: 'mock' | 'live';
  onEvent?: (event: UnifiedStreamEvent) => void | Promise<void>;
  signal?: AbortSignal;
  apiKeys?: Partial<Record<ProviderId, string>>;
  baseUrls?: Partial<Record<ProviderId, string>>;
}

export function createId(prefix = 'id'): string {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) return `${prefix}-${randomUuid.slice(0, 8)}`;
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createExperiment(input: CreateExperimentInput): ExperimentDefinition {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: createId('exp'),
    name: input.name ?? 'Untitled comparison',
    request: input.request,
    targets: input.targets,
    execution: {
      mode: 'parallel',
      repetitions: 1,
      concurrency: Math.min(Math.max(input.targets.filter((target) => target.enabled).length, 1), 8),
      timeoutMs: 60_000,
      stream: true,
      continueOnError: true,
      compatibilityMode: 'lenient',
      ...input.execution,
    },
    privacy: {
      saveContent: false,
      includeRawPayloads: false,
      redactPatterns: [],
      privateSession: false,
      ...input.privacy,
    },
    createdAt: new Date().toISOString(),
    tags: input.tags ?? [],
  };
}

export function textMessage(
  text: string,
  role: UnifiedMessage['role'] = 'user',
  id = createId(role),
): UnifiedMessage {
  return { id, role, content: [{ type: 'text', text }] };
}

export function requestText(request: UnifiedRequest): string {
  return request.messages
    .flatMap((message) => message.content)
    .filter((part): part is Extract<ContentPart, { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('\n');
}

export function validateExperiment(experiment: ExperimentDefinition): string[] {
  const errors: string[] = [];
  const enabledTargets = experiment.targets.filter((target) => target.enabled);
  if (enabledTargets.length < 2 || enabledTargets.length > 8)
    errors.push('Enable between two and eight targets.');
  if (!experiment.request.messages.length) errors.push('At least one message is required.');
  if (experiment.execution.repetitions < 1 || experiment.execution.repetitions > 20)
    errors.push('Repetitions must be between 1 and 20.');
  if (experiment.execution.timeoutMs < 100 || experiment.execution.timeoutMs > 10 * 60_000)
    errors.push('Timeout must be between 100 ms and 10 minutes.');
  if (experiment.execution.concurrency < 1 || experiment.execution.concurrency > 8)
    errors.push('Concurrency must be between 1 and 8.');
  const ids = new Set<string>();
  for (const target of enabledTargets) {
    if (ids.has(target.id)) errors.push(`Duplicate target id: ${target.id}`);
    ids.add(target.id);
    if (!target.modelId.trim()) errors.push(`Target ${target.id} has no model id.`);
  }
  if (experiment.request.output?.format === 'json-schema' && !experiment.request.output.schema) {
    errors.push('JSON Schema output requires a schema.');
  }
  return errors;
}

export function compatibilityFor(request: UnifiedRequest, model: ModelDefinition): CompatibilityReport {
  const features: CompatibilityReport['features'] = [];
  const blockingIssues: CompatibilityReport['blockingIssues'] = [];
  const warnings: CompatibilityWarning[] = [];
  const add = (
    feature: string,
    status: CompatibilityReport['features'][number]['status'],
    message?: string,
  ) => {
    features.push({ feature, status, message });
  };
  const capability = (key: keyof ModelDefinition['capabilities']): boolean | 'partial' | 'unknown' =>
    model.capabilities[key] ?? 'unknown';
  const requestedParts = request.messages.flatMap((message) => message.content);
  const hasImage = requestedParts.some((part) => part.type === 'image');
  const hasFile = requestedParts.some((part) => part.type === 'file');
  const hasDeveloper = request.messages.some((message) => message.role === 'developer');

  add('text input', capability('textInput') === true ? 'native' : 'unknown');
  add(
    'system instructions',
    request.messages.some((message) => message.role === 'system') ? 'native' : 'unknown',
  );
  if (hasDeveloper) {
    const status = model.providerId === 'anthropic' || model.providerId === 'google' ? 'adapted' : 'native';
    add(
      'developer role',
      status,
      status === 'adapted' ? 'Provider-specific transformation may merge developer instructions.' : undefined,
    );
    if (status === 'adapted')
      warnings.push({
        code: 'developer-role-adapted',
        field: 'messages.developer',
        message: 'Developer instructions are adapted for this provider.',
        providerId: model.providerId,
      });
  }
  if (hasImage)
    add(
      'image input',
      capability('imageInput') === true
        ? 'native'
        : capability('imageInput') === 'partial'
          ? 'adapted'
          : 'unsupported',
    );
  if (hasFile)
    add(
      'file input',
      capability('fileInput') === true
        ? 'native'
        : capability('fileInput') === 'partial'
          ? 'adapted'
          : 'unknown',
    );
  if (request.tools?.length)
    add(
      'tools',
      capability('tools') === true ? 'native' : capability('tools') === 'partial' ? 'adapted' : 'unsupported',
    );
  if (request.output?.format === 'json')
    add(
      'JSON mode',
      capability('jsonMode') === true
        ? 'native'
        : capability('jsonMode') === 'partial'
          ? 'adapted'
          : 'unknown',
    );
  if (request.output?.format === 'json-schema')
    add(
      'strict JSON Schema',
      capability('structuredOutput') === true
        ? 'native'
        : capability('structuredOutput') === 'partial'
          ? 'adapted'
          : 'unsupported',
    );
  if (request.generation.reasoning?.enabled)
    add(
      'reasoning controls',
      capability('reasoning') === true
        ? 'native'
        : capability('reasoning') === 'partial'
          ? 'adapted'
          : 'unknown',
    );
  if (request.generation.seed !== undefined)
    add(
      'seed',
      capability('seed') === true ? 'native' : capability('seed') === 'partial' ? 'adapted' : 'unsupported',
    );
  if (request.generation.topK !== undefined)
    add(
      'topK',
      model.providerId === 'mistral' ? 'native' : 'unsupported',
      model.providerId === 'mistral' ? undefined : 'topK is not declared for this provider.',
    );

  const unsupported = features.filter((feature) => feature.status === 'unsupported');
  for (const feature of unsupported) {
    const issue = {
      code: 'unsupported-feature',
      field: feature.feature,
      message: `${feature.feature} is not declared as supported by ${model.displayName}.`,
      blocking: true,
    };
    blockingIssues.push(issue);
    warnings.push({
      code: issue.code,
      field: issue.field,
      message: issue.message,
      providerId: model.providerId,
    });
  }
  const adapted = features.some((feature) => feature.status === 'adapted');
  return {
    compatible: blockingIssues.length === 0,
    level: blockingIssues.length
      ? 'unsupported'
      : adapted
        ? 'adapted'
        : features.some((feature) => feature.status === 'unknown')
          ? 'partial'
          : 'native',
    features,
    blockingIssues,
    warnings,
  };
}

export function buildOpenAICompatibleTransformation(
  request: UnifiedRequest,
  model: ModelDefinition,
  providerId: ProviderId,
): NativeRequestTransformation {
  const applied: NativeRequestTransformation['applied'] = [];
  const omitted: NativeRequestTransformation['omitted'] = [];
  const approximated: NativeRequestTransformation['approximated'] = [];
  const warnings: CompatibilityWarning[] = [];
  const messages = request.messages.map((message) => ({
    role: message.role === 'developer' ? 'developer' : message.role,
    content: message.content.map((part) => partToOpenAI(part)),
  }));
  const body: Record<string, unknown> = { model: model.apiModelId, messages, stream: false };
  const generation = request.generation;
  if (generation.maxOutputTokens !== undefined) {
    body.max_tokens = generation.maxOutputTokens;
    applied.push({ field: 'generation.maxOutputTokens', description: 'Mapped to max_tokens.' });
  }
  if (generation.temperature !== undefined) {
    body.temperature = generation.temperature;
    applied.push({ field: 'generation.temperature', description: 'Mapped to temperature.' });
  }
  if (generation.topP !== undefined) {
    body.top_p = generation.topP;
    applied.push({ field: 'generation.topP', description: 'Mapped to top_p.' });
  }
  if (generation.seed !== undefined) {
    body.seed = generation.seed;
    applied.push({ field: 'generation.seed', description: 'Mapped to seed.' });
  }
  if (generation.stop?.length) {
    body.stop = generation.stop;
    applied.push({ field: 'generation.stop', description: 'Mapped to stop.' });
  }
  if (generation.frequencyPenalty !== undefined) {
    body.frequency_penalty = generation.frequencyPenalty;
    applied.push({ field: 'generation.frequencyPenalty', description: 'Mapped to frequency_penalty.' });
  }
  if (generation.presencePenalty !== undefined) {
    body.presence_penalty = generation.presencePenalty;
    applied.push({ field: 'generation.presencePenalty', description: 'Mapped to presence_penalty.' });
  }
  if (generation.topK !== undefined) {
    if (providerId === 'mistral') {
      body.top_k = generation.topK;
      applied.push({ field: 'generation.topK', description: 'Mapped to provider-specific top_k.' });
    } else {
      omitted.push({
        field: 'generation.topK',
        reason: 'This OpenAI-compatible endpoint has no declared top_k field.',
      });
      warnings.push({
        code: 'parameter-omitted',
        field: 'generation.topK',
        message: 'topK is omitted for this provider.',
        providerId,
      });
    }
  }
  if (request.tools?.length) {
    body.tools = request.tools.map((tool) => ({
      type: 'function',
      function: { name: tool.name, description: tool.description, parameters: tool.inputSchema },
    }));
    applied.push({ field: 'tools', description: 'Mapped to function tools.' });
  }
  if (request.toolChoice !== undefined) {
    body.tool_choice = request.toolChoice === 'required' ? 'required' : request.toolChoice;
    applied.push({ field: 'toolChoice', description: 'Mapped to tool_choice.' });
  }
  if (request.output?.format === 'json') {
    body.response_format = { type: 'json_object' };
    applied.push({ field: 'output.format', description: 'Mapped to JSON mode.' });
  }
  if (request.output?.format === 'json-schema' && request.output.schema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: {
        name: request.output.schemaName ?? 'response',
        strict: request.output.strict ?? false,
        schema: request.output.schema,
      },
    };
    applied.push({ field: 'output.schema', description: 'Mapped to provider JSON Schema response_format.' });
  }
  if (generation.reasoning?.enabled && providerId === 'deepseek') {
    body.thinking = { type: 'enabled' };
    approximated.push({
      field: 'generation.reasoning.enabled',
      sourceValue: true,
      targetValue: body.thinking,
      explanation: 'DeepSeek thinking is represented with the provider extension.',
    });
  }
  if (request.providerOptions?.[providerId]) {
    Object.assign(body, request.providerOptions[providerId]);
    applied.push({
      field: `providerOptions.${providerId}`,
      description: 'Merged only into this provider native request.',
    });
  }
  return { nativeRequest: body, applied, omitted, approximated, warnings };
}

export function buildAnthropicTransformation(
  request: UnifiedRequest,
  model: ModelDefinition,
): NativeRequestTransformation {
  const base = buildOpenAICompatibleTransformation(request, model, 'anthropic');
  const system = request.messages
    .filter((message) => message.role === 'system' || message.role === 'developer')
    .flatMap((message) => message.content)
    .map((part) => (part.type === 'text' ? part.text : `[${part.type}]`))
    .join('\n');
  const messages = request.messages
    .filter((message) => message.role !== 'system' && message.role !== 'developer')
    .map((message) => ({
      role: message.role === 'tool' ? 'user' : message.role,
      content: message.content.map((part) => partToAnthropic(part)),
    }));
  const body: Record<string, unknown> = {
    model: model.apiModelId,
    max_tokens: request.generation.maxOutputTokens ?? 1024,
    messages,
  };
  if (system) body.system = system;
  if (request.generation.temperature !== undefined) body.temperature = request.generation.temperature;
  if (request.generation.topP !== undefined) body.top_p = request.generation.topP;
  if (request.generation.topK !== undefined) body.top_k = request.generation.topK;
  if (request.tools?.length)
    body.tools = request.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    }));
  if (request.toolChoice)
    body.tool_choice =
      request.toolChoice === 'auto' || request.toolChoice === 'none'
        ? { type: request.toolChoice }
        : {
            type: 'tool',
            name: typeof request.toolChoice === 'object' ? request.toolChoice.name : request.toolChoice,
          };
  if (request.providerOptions?.anthropic) Object.assign(body, request.providerOptions.anthropic);
  return {
    nativeRequest: body,
    applied: [
      ...base.applied,
      {
        field: 'messages.system',
        description: 'Moved system/developer content to the Messages API system field.',
      },
    ],
    omitted: [
      ...base.omitted,
      { field: 'stream', reason: 'The live request is non-streaming in this v0.1 gateway path.' },
    ],
    approximated: [...base.approximated],
    warnings: [
      ...base.warnings,
      {
        code: 'role-adapted',
        field: 'messages.developer',
        message: 'Anthropic receives system/developer instructions through the system field.',
        providerId: 'anthropic',
      },
    ],
  };
}

export function buildGoogleTransformation(
  request: UnifiedRequest,
  _model: ModelDefinition,
): NativeRequestTransformation {
  const contents = request.messages
    .filter((message) => message.role !== 'system' && message.role !== 'developer')
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: message.content.map((part) => partToGoogle(part)),
    }));
  const systemParts = request.messages
    .filter((message) => message.role === 'system' || message.role === 'developer')
    .flatMap((message) => message.content)
    .map((part) => partToGoogle(part));
  const generationConfig: Record<string, unknown> = {};
  if (request.generation.maxOutputTokens !== undefined)
    generationConfig.maxOutputTokens = request.generation.maxOutputTokens;
  if (request.generation.temperature !== undefined)
    generationConfig.temperature = request.generation.temperature;
  if (request.generation.topP !== undefined) generationConfig.topP = request.generation.topP;
  if (request.generation.topK !== undefined) generationConfig.topK = request.generation.topK;
  if (request.generation.seed !== undefined) generationConfig.seed = request.generation.seed;
  if (request.output?.format === 'json' || request.output?.format === 'json-schema') {
    generationConfig.responseMimeType = 'application/json';
    if (request.output.schema) generationConfig.responseSchema = request.output.schema;
  }
  const body: Record<string, unknown> = { contents, generationConfig };
  if (systemParts.length) body.systemInstruction = { parts: systemParts };
  if (request.tools?.length)
    body.tools = [
      {
        functionDeclarations: request.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
        })),
      },
    ];
  if (request.providerOptions?.google) Object.assign(body, request.providerOptions.google);
  return {
    nativeRequest: body,
    applied: [
      { field: 'messages', description: 'Mapped UnifiedMessage content to Gemini contents and parts.' },
      { field: 'generation', description: 'Mapped common generation fields to generationConfig.' },
    ],
    omitted: request.generation.stop?.length
      ? [
          {
            field: 'generation.stop',
            reason: 'Stop sequence mapping is not enabled in the v0.1 Gemini adapter.',
          },
        ]
      : [],
    approximated: [],
    warnings: [
      {
        code: 'candidate-shape',
        field: 'response.candidates',
        message: 'Multiple Gemini candidates remain visible in the raw response.',
        providerId: 'google',
      },
    ],
  };
}

function partToOpenAI(part: ContentPart): unknown {
  if (part.type === 'text') return { type: 'text', text: part.text };
  if (part.type === 'image')
    return part.source.type === 'url'
      ? { type: 'image_url', image_url: { url: part.source.url } }
      : { type: 'text', text: '[image omitted from native preview]' };
  if (part.type === 'tool-call') return { type: 'text', text: JSON.stringify(part.toolCall) };
  if (part.type === 'tool-result') return { type: 'text', text: JSON.stringify(part.result) };
  if (part.type === 'reasoning') return { type: 'text', text: part.text };
  if (part.type === 'refusal') return { type: 'text', text: part.text };
  return { type: 'text', text: `[${part.type}]` };
}

function partToAnthropic(part: ContentPart): unknown {
  if (part.type === 'text') return { type: 'text', text: part.text };
  if (part.type === 'image' && part.source.type === 'base64')
    return {
      type: 'image',
      source: { type: 'base64', media_type: part.source.mediaType, data: part.source.data },
    };
  if (part.type === 'image' && part.source.type === 'url')
    return { type: 'text', text: `[image URL: ${part.source.url}]` };
  if (part.type === 'tool-result')
    return { type: 'tool_result', tool_use_id: part.toolCallId, content: JSON.stringify(part.result) };
  return { type: 'text', text: `[${part.type}]` };
}

function partToGoogle(part: ContentPart): unknown {
  if (part.type === 'text') return { text: part.text };
  if (part.type === 'image' && part.source.type === 'base64')
    return { inlineData: { mimeType: part.source.mediaType, data: part.source.data } };
  if (part.type === 'image' && part.source.type === 'url') return { text: `[image URL: ${part.source.url}]` };
  if (part.type === 'tool-result')
    return { functionResponse: { name: part.toolName, response: part.result } };
  return { text: `[${part.type}]` };
}

export interface HttpAdapterSpec {
  id: ProviderId;
  version: string;
  buildRequest: (request: UnifiedRequest, model: ModelDefinition) => NativeRequestTransformation;
  buildUrl: (model: ModelDefinition, baseUrl: string) => string;
  buildHeaders: (context: ExecutionContext) => Record<string, string>;
  parseResponse: (data: unknown, model: ModelDefinition, request: UnifiedRequest) => ParsedProviderResponse;
}

export interface ParsedProviderResponse {
  text: string;
  content: ContentPart[];
  reasoning?: string;
  usage: TokenUsage;
  cost?: ProviderResponse['cost'];
  finishReason: FinishReason;
  toolCalls: ToolCall[];
  structuredOutput?: StructuredOutputResult;
}

export function parseOpenAICompatibleResponse(
  data: unknown,
  _model: ModelDefinition,
  request: UnifiedRequest,
): ParsedProviderResponse {
  const object = asRecord(data);
  const choices = Array.isArray(object.choices) ? object.choices : [];
  const choice = asRecord(choices[0]);
  const message = asRecord(choice.message);
  const text = typeof message.content === 'string' ? message.content : extractTextContent(message.content);
  const toolCalls = Array.isArray(message.tool_calls)
    ? message.tool_calls.map((call) => {
        const tool = asRecord(call);
        const functionValue = asRecord(tool.function);
        const argumentsText =
          typeof functionValue.arguments === 'string'
            ? functionValue.arguments
            : JSON.stringify(functionValue.arguments ?? {});
        return {
          id: String(tool.id ?? createId('call')),
          name: String(functionValue.name ?? 'unknown_tool'),
          argumentsText,
          arguments: safeJson(argumentsText),
          jsonValid: isJson(argumentsText),
        } satisfies ToolCall;
      })
    : [];
  const usageObject = asRecord(object.usage);
  const usage: TokenUsage = {
    inputTokens: numberOrUndefined(usageObject.prompt_tokens),
    outputTokens: numberOrUndefined(usageObject.completion_tokens),
    totalTokens: numberOrUndefined(usageObject.total_tokens),
    cachedInputTokens: numberOrUndefined(asRecord(usageObject.prompt_tokens_details).cached_tokens),
    source: Object.keys(usageObject).length ? 'provider' : 'unavailable',
  };
  const structuredOutput =
    request.output && request.output.format !== 'text'
      ? parseStructuredOutput(text, request.output.schema)
      : undefined;
  return {
    text,
    content: [{ type: 'text', text }],
    reasoning: typeof message.reasoning_content === 'string' ? message.reasoning_content : undefined,
    usage,
    cost:
      typeof usageObject.cost === 'number'
        ? { currency: 'USD', source: 'provider-reported', reportedUsd: usageObject.cost }
        : undefined,
    finishReason: mapFinishReason(choice.finish_reason),
    toolCalls,
    structuredOutput,
  };
}

export function parseAnthropicResponse(
  data: unknown,
  _model: ModelDefinition,
  request: UnifiedRequest,
): ParsedProviderResponse {
  const object = asRecord(data);
  const blocks = Array.isArray(object.content) ? object.content : [];
  const text = blocks
    .filter((block) => asRecord(block).type === 'text')
    .map((block) => String(asRecord(block).text ?? ''))
    .join('');
  const toolCalls = blocks
    .filter((block) => asRecord(block).type === 'tool_use')
    .map((block) => {
      const tool = asRecord(block);
      const argumentsText = JSON.stringify(tool.input ?? {});
      return {
        id: String(tool.id ?? createId('call')),
        name: String(tool.name ?? 'unknown_tool'),
        argumentsText,
        arguments: tool.input,
        jsonValid: true,
      } satisfies ToolCall;
    });
  const usageObject = asRecord(object.usage);
  const usage: TokenUsage = {
    inputTokens: numberOrUndefined(usageObject.input_tokens),
    outputTokens: numberOrUndefined(usageObject.output_tokens),
    totalTokens: sumIfNumbers(usageObject.input_tokens, usageObject.output_tokens),
    cachedInputTokens: numberOrUndefined(usageObject.cache_read_input_tokens),
    source: Object.keys(usageObject).length ? 'provider' : 'unavailable',
  };
  const structuredOutput =
    request.output && request.output.format !== 'text'
      ? parseStructuredOutput(text, request.output.schema)
      : undefined;
  return {
    text,
    content: blocks.map((block) =>
      asRecord(block).type === 'text'
        ? { type: 'text', text: String(asRecord(block).text ?? '') }
        : {
            type: 'tool-call',
            toolCall: toolCalls[0] ?? {
              id: createId('call'),
              name: 'unknown_tool',
              argumentsText: '{}',
              jsonValid: true,
            },
          },
    ),
    usage,
    structuredOutput,
    finishReason: mapFinishReason(object.stop_reason),
    toolCalls,
  };
}

export function parseGoogleResponse(
  data: unknown,
  _model: ModelDefinition,
  request: UnifiedRequest,
): ParsedProviderResponse {
  const object = asRecord(data);
  const candidates = Array.isArray(object.candidates) ? object.candidates : [];
  const first = asRecord(candidates[0]);
  const content = asRecord(first.content);
  const parts = Array.isArray(content.parts) ? content.parts : [];
  const text = parts
    .filter((part) => typeof asRecord(part).text === 'string')
    .map((part) => String(asRecord(part).text))
    .join('');
  const toolCalls = parts
    .filter((part) => asRecord(part).functionCall)
    .map((part) => {
      const call = asRecord(asRecord(part).functionCall);
      const argumentsText = JSON.stringify(call.args ?? {});
      return {
        id: createId('call'),
        name: String(call.name ?? 'unknown_tool'),
        argumentsText,
        arguments: call.args,
        jsonValid: true,
      } satisfies ToolCall;
    });
  const usageObject = asRecord(object.usageMetadata);
  const usage: TokenUsage = {
    inputTokens: numberOrUndefined(usageObject.promptTokenCount),
    outputTokens: numberOrUndefined(usageObject.candidatesTokenCount),
    totalTokens: numberOrUndefined(usageObject.totalTokenCount),
    source: Object.keys(usageObject).length ? 'provider' : 'unavailable',
  };
  const structuredOutput =
    request.output && request.output.format !== 'text'
      ? parseStructuredOutput(text, request.output.schema)
      : undefined;
  return {
    text,
    content: [{ type: 'text', text }],
    usage,
    structuredOutput,
    toolCalls,
    finishReason: mapFinishReason(first.finishReason),
  };
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function extractTextContent(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return '';
  return value.map((part) => (typeof part === 'string' ? part : String(asRecord(part).text ?? ''))).join('');
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}
function sumIfNumbers(first: unknown, second: unknown): number | undefined {
  return typeof first === 'number' && typeof second === 'number' ? first + second : undefined;
}
function isJson(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}
function mapFinishReason(value: unknown): FinishReason {
  return value === 'length' || value === 'max_tokens'
    ? 'length'
    : value === 'tool_calls' || value === 'tool_use'
      ? 'tool-call'
      : value === 'content_filter'
        ? 'content-filter'
        : value === 'stop' || value === 'end_turn'
          ? 'stop'
          : 'unknown';
}

export function createHttpAdapter(spec: HttpAdapterSpec): ProviderAdapter {
  return {
    id: spec.id,
    version: spec.version,
    async getCapabilities(model) {
      return {
        providerId: spec.id,
        modelId: model.apiModelId,
        features: model.capabilities,
        notes: getProvider(spec.id).notes,
      } satisfies ProviderCapabilities;
    },
    async validate(request, model) {
      return compatibilityFor(request, model);
    },
    async transformRequest(request, model) {
      return spec.buildRequest(request, model);
    },
    async execute(request, model, context) {
      if (!context.apiKey)
        throw providerError('authentication', spec.id, 'No API key configured for this provider.', false);
      const transformation = spec.buildRequest(request, model);
      const baseUrl = context.baseUrl ?? getProvider(spec.id).defaultBaseUrl;
      const url = spec.buildUrl(model, baseUrl);
      const headers = { 'content-type': 'application/json', ...spec.buildHeaders(context) };
      let response: Response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(transformation.nativeRequest),
          signal: context.signal,
        });
      } catch (error) {
        throw providerError(
          context.signal?.aborted ? 'timeout' : 'connection',
          spec.id,
          error instanceof Error ? error.message : 'Provider connection failed.',
          true,
        );
      }
      const rawText = await response.text();
      const data = safeJson(rawText);
      if (!response.ok) {
        throw providerError(
          mapStatusToError(response.status),
          spec.id,
          extractProviderMessage(data) ?? `Provider returned HTTP ${response.status}.`,
          response.status === 429 || response.status >= 500,
          response.status,
          data,
        );
      }
      const parsed = spec.parseResponse(data, model, request);
      return {
        ...parsed,
        cost: parsed.cost ?? { currency: 'USD', source: 'unknown' },
        rawResponse: redactSecrets(data),
        nativeRequest: redactSecrets(transformation.nativeRequest),
        normalizedRequest: request,
        transformation,
        compatibility: compatibilityFor(request, model),
        warnings: transformation.warnings,
      };
    },
    async *stream(request, model, context) {
      const startedAt = Date.now();
      const response = await this.execute(request, model, context);
      let sequence = 0;
      const base = (type: UnifiedStreamEvent['type'], extra: Record<string, unknown>) =>
        ({
          experimentId: context.experimentId,
          runId: context.runId,
          targetId: context.targetId,
          sequence: sequence++,
          timestamp: new Date().toISOString(),
          elapsedMs: Date.now() - startedAt,
          type,
          ...extra,
        }) as UnifiedStreamEvent;
      yield base('stream-started', { modelId: model.apiModelId });
      if (response.reasoning) yield base('reasoning-delta', { delta: response.reasoning });
      if (response.text) yield base('text-delta', { delta: response.text });
      yield base('usage-update', { usage: response.usage });
      yield base('response-completed', { response });
    },
    normalizeError(error) {
      return error && typeof error === 'object' && 'code' in error
        ? (error as UnifiedProviderError)
        : providerError(
            'unknown',
            spec.id,
            error instanceof Error ? error.message : 'Unknown provider error.',
            false,
          );
    },
  };
}

export function createMockAdapter(providerId: ProviderId): ProviderAdapter {
  return {
    id: providerId,
    version: 'mock-0.1.0',
    async getCapabilities(model) {
      return {
        providerId,
        modelId: model.apiModelId,
        features: model.capabilities,
        notes: ['Deterministic fixture adapter. No network requests are made.'],
      };
    },
    async validate(request, model) {
      return compatibilityFor(request, model);
    },
    async transformRequest(request, model) {
      return buildNativeRequest(providerId, request, model);
    },
    async execute(request, model, context) {
      return mockResponse(providerId, request, model, context);
    },
    async *stream(request, model, context) {
      const response = await mockResponse(providerId, request, model, context);
      const started = Date.now();
      let sequence = 0;
      const event = (type: UnifiedStreamEvent['type'], extra: Record<string, unknown>) =>
        ({
          experimentId: context.experimentId,
          runId: context.runId,
          targetId: context.targetId,
          sequence: sequence++,
          timestamp: new Date().toISOString(),
          elapsedMs: Date.now() - started,
          type,
          ...extra,
        }) as UnifiedStreamEvent;
      yield event('stream-started', { modelId: model.apiModelId });
      await sleep(12);
      if (response.reasoning) {
        yield event('reasoning-delta', { delta: response.reasoning });
        await sleep(18);
      }
      if (response.toolCalls.length) {
        const call = response.toolCalls[0];
        yield event('tool-call-started', { toolCall: { id: call.id, name: call.name } });
        for (const chunk of chunkText(call.argumentsText, 10)) {
          yield event('tool-call-delta', { toolCallId: call.id, delta: chunk });
          await sleep(14);
        }
        yield event('tool-call-completed', { toolCall: call });
      }
      for (const chunk of chunkText(response.text, 18)) {
        if (context.signal?.aborted) throw providerError('cancelled', providerId, 'Run cancelled.', false);
        yield event('text-delta', { delta: chunk });
        await sleep(16);
      }
      yield event('usage-update', { usage: response.usage });
      yield event('response-completed', { response });
    },
    normalizeError(error) {
      return error && typeof error === 'object' && 'code' in error
        ? (error as UnifiedProviderError)
        : providerError(
            'unknown',
            providerId,
            error instanceof Error ? error.message : 'Unknown mock error.',
            false,
          );
    },
  };
}

function buildNativeRequest(
  providerId: ProviderId,
  request: UnifiedRequest,
  model: ModelDefinition,
): NativeRequestTransformation {
  if (providerId === 'anthropic') return buildAnthropicTransformation(request, model);
  if (providerId === 'google') return buildGoogleTransformation(request, model);
  return buildOpenAICompatibleTransformation(request, model, providerId);
}

async function mockResponse(
  providerId: ProviderId,
  request: UnifiedRequest,
  model: ModelDefinition,
  _context: ExecutionContext,
): Promise<ProviderResponse> {
  await sleep(providerId === 'google' ? 35 : providerId === 'anthropic' ? 52 : 28);
  const transformation = buildNativeRequest(providerId, request, model);
  const compatibility = compatibilityFor(request, model);
  const prompt = requestText(request);
  const isStructured = request.output?.format === 'json' || request.output?.format === 'json-schema';
  const hasTools = Boolean(request.tools?.length);
  let text: string;
  let structuredOutput: StructuredOutputResult | undefined;
  let toolCalls: ToolCall[] = [];
  if (isStructured) {
    const value = {
      provider: providerId,
      answer: 'Fixture extraction',
      confidence: 0.92,
      promptCharacters: prompt.length,
    };
    text = JSON.stringify(value, null, 2);
    structuredOutput = parseStructuredOutput(text, request.output?.schema);
  } else if (hasTools) {
    const tool = request.tools?.[0];
    const args = JSON.stringify({ city: 'São Paulo', source: 'local fixture' });
    toolCalls = tool
      ? [
          {
            id: createId('call'),
            name: tool.name,
            argumentsText: args,
            arguments: JSON.parse(args),
            jsonValid: true,
            schemaValid: true,
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          },
        ]
      : [];
    text = `I would call ${tool?.name ?? 'the selected tool'} with the fixture arguments shown below. The call is waiting for manual approval.`;
  } else {
    const providerName = getProvider(providerId).displayName;
    text = `${providerName} fixture response\n\nThis deterministic mock preserves the same experiment prompt so you can compare adapter behavior, compatibility notes, and measurements without sending data to a provider.\n\nPrompt preview: “${prompt.slice(0, 180)}${prompt.length > 180 ? '…' : ''}”`;
  }
  const inputText = requestText(request);
  const usage = mergeUsage({ source: 'estimated' }, text, inputText);
  return {
    text,
    content: [{ type: 'text', text }],
    reasoning: request.generation.reasoning?.enabled
      ? 'Fixture reasoning summary: the adapter kept reasoning metadata separate from visible answer text.'
      : undefined,
    usage,
    cost: {
      currency: 'USD',
      source: 'catalog-estimate',
      estimatedUsd: Number(((usage.totalTokens ?? 0) * 0.000001).toFixed(6)),
    },
    finishReason: toolCalls.length ? 'tool-call' : 'stop',
    toolCalls,
    structuredOutput,
    rawResponse: { fixture: true, provider: providerId, model: model.apiModelId, response: text },
    nativeRequest: transformation.nativeRequest,
    normalizedRequest: request,
    transformation,
    compatibility,
    warnings: [
      ...compatibility.warnings,
      {
        code: 'mock-mode',
        field: 'execution.mode',
        message: 'This response is simulated and must not be read as a provider measurement.',
        providerId,
      },
    ],
  };
}

export async function runExperiment(
  experiment: ExperimentDefinition,
  options: RunExperimentOptions,
): Promise<ExperimentResult> {
  const validationErrors = validateExperiment(experiment);
  if (validationErrors.length) throw new Error(validationErrors.join(' '));
  const adapterMap = new Map(options.adapters.map((adapter) => [adapter.id, adapter]));
  const runs: TargetRun[] = [];
  const warnings: CompatibilityWarning[] = [];
  const enabledTargets = experiment.targets.filter((target) => target.enabled);
  for (let repetition = 1; repetition <= experiment.execution.repetitions; repetition += 1) {
    const execute = async (target: ExperimentDefinition['targets'][number]) => {
      const adapter = adapterMap.get(target.providerId);
      const startedAt = new Date().toISOString();
      const runId = createId('run');
      const events: UnifiedStreamEvent[] = [];
      if (!adapter) {
        const error = providerError(
          'provider-unavailable',
          target.providerId,
          'No adapter is registered for this provider.',
          false,
        );
        const blocked: TargetRun = {
          runId,
          targetId: target.id,
          providerId: target.providerId,
          modelId: target.modelId,
          repetition,
          status: 'error',
          events,
          error,
          warnings: [],
          startedAt,
          completedAt: new Date().toISOString(),
        };
        runs.push(blocked);
        return blocked;
      }
      let model: ModelDefinition;
      try {
        model = getModel(target.modelId, target.providerId);
      } catch (error) {
        const normalized = adapter.normalizeError(error);
        const failed: TargetRun = {
          runId,
          targetId: target.id,
          providerId: target.providerId,
          modelId: target.modelId,
          repetition,
          status: 'error',
          events,
          error: normalized,
          warnings: [],
          startedAt,
          completedAt: new Date().toISOString(),
        };
        runs.push(failed);
        return failed;
      }
      const request = withTargetOverrides(experiment.request, target);
      const compatibility = await adapter.validate(request, model);
      if (experiment.execution.compatibilityMode === 'strict' && !compatibility.compatible) {
        const error = providerError(
          'unsupported-feature',
          target.providerId,
          `Strict mode blocked ${target.id}: ${compatibility.blockingIssues.map((issue) => issue.field).join(', ')}`,
          false,
        );
        const blocked: TargetRun = {
          runId,
          targetId: target.id,
          providerId: target.providerId,
          modelId: model.apiModelId,
          repetition,
          status: 'blocked',
          events,
          error,
          warnings: compatibility.warnings,
          startedAt,
          completedAt: new Date().toISOString(),
        };
        runs.push(blocked);
        warnings.push(...compatibility.warnings);
        return blocked;
      }
      const startClock = clockNow();
      const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
        didTimeout = true;
        controller.abort();
      }, experiment.execution.timeoutMs);
      let didTimeout = false;
      const controller = new AbortController();
      const abortFromOuter = () => controller.abort();
      if (options.signal) {
        if (options.signal.aborted) controller.abort();
        else options.signal.addEventListener('abort', abortFromOuter, { once: true });
      }
      const context: ExecutionContext = {
        experimentId: experiment.id,
        runId,
        targetId: target.id,
        mode: options.mode,
        signal: controller.signal,
        requestId: createId('req'),
        apiKey: options.apiKeys?.[target.providerId],
        baseUrl: options.baseUrls?.[target.providerId],
        log: (event) => {
          if (options.mode === 'live')
            console.log(
              JSON.stringify({
                ...event,
                experimentId: experiment.id,
                runId,
                targetId: target.id,
                providerId: target.providerId,
                modelId: model.apiModelId,
              }),
            );
        },
      };
      try {
        let response: ProviderResponse | undefined;
        if (experiment.execution.stream && adapter.stream) {
          for await (const event of adapter.stream(request, model, context)) {
            events.push(event);
            await options.onEvent?.(event);
            if (event.type === 'response-completed') response = event.response;
          }
        } else {
          response = await adapter.execute(request, model, context);
        }
        if (!response)
          throw providerError(
            'stream-interrupted',
            target.providerId,
            'The provider stream ended without a completed response.',
            true,
          );
        const elapsed = clockNow() - startClock;
        const firstEventMs = events[0]?.elapsedMs;
        const firstReasoningMs = events.find((event) => event.type === 'reasoning-delta')?.elapsedMs;
        const firstTextMs = events.find((event) => event.type === 'text-delta')?.elapsedMs;
        const firstToolCallMs = events.find((event) => event.type === 'tool-call-started')?.elapsedMs;
        const metrics = buildMetrics({
          startedAt,
          totalDurationMs: elapsed,
          firstEventMs,
          firstReasoningMs,
          firstTextMs,
          firstToolCallMs,
          text: response.text,
          usage: response.usage,
          cost: response.cost,
        });
        const completed: TargetRun = {
          runId,
          targetId: target.id,
          providerId: target.providerId,
          modelId: model.apiModelId,
          repetition,
          status: 'completed',
          response,
          metrics,
          events,
          warnings: response.warnings,
          startedAt,
          completedAt: new Date().toISOString(),
        };
        runs.push(completed);
        warnings.push(...response.warnings);
        return completed;
      } catch (error) {
        const normalized = didTimeout
          ? providerError(
              'timeout',
              target.providerId,
              `Target timed out after ${experiment.execution.timeoutMs} ms.`,
              true,
            )
          : controller.signal.aborted
            ? providerError('cancelled', target.providerId, 'Run cancelled.', false)
            : adapter.normalizeError(error);
        const failed: TargetRun = {
          runId,
          targetId: target.id,
          providerId: target.providerId,
          modelId: model.apiModelId,
          repetition,
          status: normalized.code === 'cancelled' ? 'cancelled' : 'error',
          events,
          error: normalized,
          warnings: compatibility.warnings,
          startedAt,
          completedAt: new Date().toISOString(),
        };
        runs.push(failed);
        if (!experiment.execution.continueOnError) throw error;
        return failed;
      } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', abortFromOuter);
      }
    };
    if (experiment.execution.mode === 'sequential') {
      for (const target of enabledTargets) await execute(target);
    } else {
      await mapWithConcurrency(
        enabledTargets,
        Math.min(experiment.execution.concurrency, enabledTargets.length),
        execute,
      );
    }
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    experimentId: experiment.id,
    mode: options.mode,
    completedAt: new Date().toISOString(),
    runs,
    warnings,
  };
}

function withTargetOverrides(
  request: UnifiedRequest,
  target: ExperimentDefinition['targets'][number],
): UnifiedRequest {
  return {
    ...request,
    generation: { ...request.generation, ...target.overrides?.generation },
    providerOptions: {
      ...request.providerOptions,
      [target.providerId]: {
        ...request.providerOptions?.[target.providerId],
        ...target.overrides?.providerOptions,
      },
    },
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return results;
}

function providerError(
  code: UnifiedErrorCode,
  providerId: ProviderId,
  message: string,
  retryable: boolean,
  statusCode?: number,
  details?: unknown,
): UnifiedProviderError {
  return { code, providerId, message, retryable, statusCode, sanitizedDetails: redactSecrets(details) };
}

function mapStatusToError(statusCode: number): UnifiedErrorCode {
  if (statusCode === 401) return 'authentication';
  if (statusCode === 403) return 'permission';
  if (statusCode === 404) return 'model-not-found';
  if (statusCode === 408) return 'timeout';
  if (statusCode === 413) return 'context-length';
  if (statusCode === 429) return 'rate-limit';
  if (statusCode >= 500) return 'provider-unavailable';
  return 'invalid-request';
}

function extractProviderMessage(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const object = data as Record<string, unknown>;
  const error = object.error;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && typeof (error as Record<string, unknown>).message === 'string')
    return (error as Record<string, unknown>).message as string;
  if (typeof object.message === 'string') return object.message;
  return undefined;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 4000) };
  }
}

export function redactSecrets(value: unknown): unknown {
  if (typeof value === 'string')
    return value
      .replace(/Bearer\s+[A-Za-z0-9._-]+/giu, 'Bearer [REDACTED]')
      .replace(/(sk-[A-Za-z0-9_-]{12,}|xai-[A-Za-z0-9_-]{12,}|AIza[A-Za-z0-9_-]{12,})/gu, '[REDACTED]');
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        /(authorization|api[-_]?key|token|secret)/iu.test(key) ? key : key,
        /(authorization|api[-_]?key|token|secret)/iu.test(key) ? '[REDACTED]' : redactSecrets(entry),
      ]),
    );
  return value;
}

function chunkText(text: string, size: number): string[] {
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += size) chunks.push(text.slice(index, index + size));
  return chunks;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function clockNow(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export { PROVIDER_CATALOG, getModel, getProvider, estimateTokens, parseStructuredOutput, calculateCost };

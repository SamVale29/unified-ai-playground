export const SCHEMA_VERSION = '0.1.0';

export const PROVIDER_IDS = [
  'openai',
  'anthropic',
  'google',
  'xai',
  'deepseek',
  'mistral',
  'openrouter',
] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export type MessageRole = 'system' | 'developer' | 'user' | 'assistant' | 'tool';

export type ContentPart =
  | TextPart
  | ImagePart
  | AudioPart
  | VideoPart
  | FilePart
  | ToolCallPart
  | ToolResultPart
  | ReasoningPart
  | RefusalPart;

export interface TextPart {
  type: 'text';
  text: string;
}

export interface ImagePart {
  type: 'image';
  source:
    | { type: 'url'; url: string }
    | { type: 'base64'; mediaType: string; data: string }
    | { type: 'file-reference'; id: string };
}

export interface AudioPart {
  type: 'audio';
  source: { type: 'url'; url: string } | { type: 'base64'; mediaType: string; data: string };
}

export interface VideoPart {
  type: 'video';
  source: { type: 'url'; url: string } | { type: 'base64'; mediaType: string; data: string };
}

export interface FilePart {
  type: 'file';
  filename?: string;
  mediaType?: string;
  source: { type: 'base64'; data: string } | { type: 'provider-file'; provider: string; id: string };
}

export interface ToolCallPart {
  type: 'tool-call';
  toolCall: ToolCall;
}

export interface ToolResultPart {
  type: 'tool-result';
  toolCallId: string;
  toolName: string;
  result: unknown;
}

export interface ReasoningPart {
  type: 'reasoning';
  text: string;
  redacted?: boolean;
}

export interface RefusalPart {
  type: 'refusal';
  text: string;
  category?: string;
}

export interface UnifiedMessage {
  id: string;
  role: MessageRole;
  content: ContentPart[];
  name?: string;
  metadata?: Record<string, unknown>;
}

export interface UnifiedTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export type ToolChoice = 'auto' | 'none' | 'required' | { name: string };

export interface UnifiedRequest {
  messages: UnifiedMessage[];
  generation: {
    maxOutputTokens?: number;
    temperature?: number;
    topP?: number;
    topK?: number;
    seed?: number;
    stop?: string[];
    frequencyPenalty?: number;
    presencePenalty?: number;
    candidateCount?: number;
    reasoning?: {
      enabled?: boolean;
      effort?: 'none' | 'low' | 'medium' | 'high' | 'max';
      budgetTokens?: number;
      summary?: 'none' | 'auto' | 'concise' | 'detailed';
    };
  };
  output?: {
    format: 'text' | 'json' | 'json-schema';
    schema?: Record<string, unknown>;
    schemaName?: string;
    strict?: boolean;
  };
  tools?: UnifiedTool[];
  toolChoice?: ToolChoice;
  metadata?: Record<string, unknown>;
  providerOptions?: Record<string, Record<string, unknown>>;
}

export interface ExperimentTarget {
  id: string;
  providerId: ProviderId;
  modelId: string;
  enabled: boolean;
  overrides?: {
    generation?: Partial<UnifiedRequest['generation']>;
    providerOptions?: Record<string, unknown>;
  };
}

export interface ExperimentDefinition {
  schemaVersion: string;
  id: string;
  name: string;
  request: UnifiedRequest;
  targets: ExperimentTarget[];
  execution: {
    mode: 'parallel' | 'sequential';
    repetitions: number;
    concurrency: number;
    timeoutMs: number;
    stream: boolean;
    continueOnError: boolean;
    compatibilityMode?: 'strict' | 'lenient';
  };
  privacy: {
    saveContent: boolean;
    includeRawPayloads: boolean;
    redactPatterns: string[];
    privateSession?: boolean;
  };
  createdAt: string;
  tags?: string[];
}

export type CapabilityValue = true | false | 'partial' | 'unknown';

export interface ModelPricing {
  inputUsdPerMillionTokens?: number;
  outputUsdPerMillionTokens?: number;
  cachedInputUsdPerMillionTokens?: number;
  currency: 'USD';
  source?: string;
}

export interface ModelDefinition {
  id: string;
  providerId: ProviderId;
  apiModelId: string;
  displayName: string;
  status: 'active' | 'preview' | 'deprecated' | 'retired' | 'unknown';
  capabilities: {
    textInput?: CapabilityValue;
    imageInput?: CapabilityValue;
    audioInput?: CapabilityValue;
    videoInput?: CapabilityValue;
    fileInput?: CapabilityValue;
    textOutput?: CapabilityValue;
    imageOutput?: CapabilityValue;
    audioOutput?: CapabilityValue;
    streaming?: CapabilityValue;
    tools?: CapabilityValue;
    structuredOutput?: CapabilityValue;
    jsonMode?: CapabilityValue;
    reasoning?: CapabilityValue;
    seed?: CapabilityValue;
  };
  limits: { contextTokens?: number | null; outputTokens?: number | null };
  pricing?: ModelPricing | null;
  source: { url: string; checkedAt: string };
  metadata?: Record<string, unknown>;
}

export interface CompatibilityWarning {
  code: string;
  field: string;
  message: string;
  providerId?: ProviderId;
}

export interface CompatibilityIssue {
  code: string;
  field: string;
  message: string;
  blocking: boolean;
}

export interface CompatibilityFeature {
  feature: string;
  status: 'native' | 'adapted' | 'ignored' | 'unsupported' | 'unknown';
  message?: string;
}

export interface CompatibilityReport {
  compatible: boolean;
  level: 'native' | 'adapted' | 'partial' | 'unsupported';
  features: CompatibilityFeature[];
  blockingIssues: CompatibilityIssue[];
  warnings: CompatibilityWarning[];
}

export interface NativeRequestTransformation {
  nativeRequest: unknown;
  applied: Array<{ field: string; description: string }>;
  omitted: Array<{ field: string; reason: string }>;
  approximated: Array<{ field: string; sourceValue: unknown; targetValue: unknown; explanation: string }>;
  warnings: CompatibilityWarning[];
}

export type UnifiedErrorCode =
  | 'authentication'
  | 'permission'
  | 'rate-limit'
  | 'quota'
  | 'timeout'
  | 'connection'
  | 'invalid-request'
  | 'unsupported-feature'
  | 'context-length'
  | 'content-filter'
  | 'model-not-found'
  | 'provider-unavailable'
  | 'stream-interrupted'
  | 'cancelled'
  | 'unknown';

export interface UnifiedProviderError {
  code: UnifiedErrorCode;
  providerId: ProviderId;
  modelId?: string;
  message: string;
  retryable: boolean;
  statusCode?: number;
  retryAfterMs?: number;
  providerCode?: string;
  requestId?: string;
  sanitizedDetails?: unknown;
}

export type FinishReason =
  'stop' | 'length' | 'tool-call' | 'content-filter' | 'error' | 'cancelled' | 'unknown';

export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cachedInputTokens?: number;
  source: 'provider' | 'estimated' | 'unavailable';
}

export interface CostInfo {
  estimatedUsd?: number;
  reportedUsd?: number;
  currency: 'USD';
  source: 'catalog-estimate' | 'provider-reported' | 'unknown';
}

export interface ToolCall {
  id: string;
  name: string;
  argumentsText: string;
  arguments?: unknown;
  jsonValid: boolean;
  schemaValid?: boolean;
  startedAt?: string;
  completedAt?: string;
}

export interface StructuredOutputResult {
  rawText: string;
  value?: unknown;
  validJson: boolean;
  schemaValid?: boolean;
  errors: string[];
}

export interface RunMetrics {
  requestStartedAt: string;
  firstEventMs?: number;
  firstReasoningMs?: number;
  firstTextMs?: number;
  firstToolCallMs?: number;
  ttftMs?: number;
  totalDurationMs: number;
  generationDurationMs?: number;
  outputTokensPerSecond?: number;
  usage: TokenUsage;
  cost: CostInfo;
  characterCount: number;
  wordCount: number;
}

export interface ProviderResponse {
  text: string;
  content: ContentPart[];
  reasoning?: string;
  usage: TokenUsage;
  cost: CostInfo;
  finishReason: FinishReason;
  toolCalls: ToolCall[];
  structuredOutput?: StructuredOutputResult;
  rawResponse?: unknown;
  nativeRequest: unknown;
  normalizedRequest: UnifiedRequest;
  transformation: NativeRequestTransformation;
  compatibility: CompatibilityReport;
  warnings: CompatibilityWarning[];
}

export interface StreamEventBase {
  experimentId: string;
  runId: string;
  targetId: string;
  sequence: number;
  timestamp: string;
  elapsedMs: number;
}

export type UnifiedStreamEvent =
  | (StreamEventBase & { type: 'stream-started'; modelId: string })
  | (StreamEventBase & { type: 'response-metadata'; metadata: Record<string, unknown> })
  | (StreamEventBase & { type: 'text-delta'; delta: string })
  | (StreamEventBase & { type: 'reasoning-delta'; delta: string })
  | (StreamEventBase & { type: 'tool-call-started'; toolCall: Pick<ToolCall, 'id' | 'name'> })
  | (StreamEventBase & { type: 'tool-call-delta'; toolCallId: string; delta: string })
  | (StreamEventBase & { type: 'tool-call-completed'; toolCall: ToolCall })
  | (StreamEventBase & { type: 'usage-update'; usage: TokenUsage })
  | (StreamEventBase & { type: 'warning'; warning: CompatibilityWarning })
  | (StreamEventBase & { type: 'error'; error: UnifiedProviderError })
  | (StreamEventBase & { type: 'response-completed'; response: ProviderResponse });

export interface ExecutionContext {
  experimentId: string;
  runId: string;
  targetId: string;
  mode: 'mock' | 'live';
  apiKey?: string;
  baseUrl?: string;
  signal?: AbortSignal;
  requestId?: string;
  log?: (event: Record<string, unknown>) => void;
}

export interface ProviderCapabilities {
  providerId: ProviderId;
  modelId: string;
  features: ModelDefinition['capabilities'];
  notes: string[];
}

export interface ProviderAdapter {
  readonly id: ProviderId;
  readonly version: string;
  getCapabilities(model: ModelDefinition): Promise<ProviderCapabilities>;
  validate(request: UnifiedRequest, model: ModelDefinition): Promise<CompatibilityReport>;
  transformRequest(request: UnifiedRequest, model: ModelDefinition): Promise<NativeRequestTransformation>;
  execute(
    request: UnifiedRequest,
    model: ModelDefinition,
    context: ExecutionContext,
  ): Promise<ProviderResponse>;
  stream?(
    request: UnifiedRequest,
    model: ModelDefinition,
    context: ExecutionContext,
  ): AsyncIterable<UnifiedStreamEvent>;
  normalizeError(error: unknown): UnifiedProviderError;
}

export interface TargetRun {
  runId: string;
  targetId: string;
  providerId: ProviderId;
  modelId: string;
  repetition: number;
  status: 'pending' | 'running' | 'completed' | 'error' | 'cancelled' | 'blocked';
  response?: ProviderResponse;
  metrics?: RunMetrics;
  events: UnifiedStreamEvent[];
  error?: UnifiedProviderError;
  warnings: CompatibilityWarning[];
  startedAt: string;
  completedAt?: string;
}

export interface ExperimentResult {
  schemaVersion: string;
  experimentId: string;
  mode: 'mock' | 'live';
  completedAt: string;
  runs: TargetRun[];
  warnings: CompatibilityWarning[];
}

export interface ProviderDefinition {
  id: ProviderId;
  displayName: string;
  shortName: string;
  envKey: string;
  baseUrlEnvKey: string;
  defaultBaseUrl: string;
  docsUrl: string;
  modelsUrl: string;
  defaultModelId: string;
  status: 'available' | 'preview' | 'unknown';
  notes: string[];
}

export interface GatewayRunRequest {
  experiment: ExperimentDefinition;
  mode: 'mock' | 'live';
}

export function isProviderId(value: string): value is ProviderId {
  return (PROVIDER_IDS as readonly string[]).includes(value);
}

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { cors } from 'hono/cors';
import { MODEL_CATALOG, PROVIDER_CATALOG } from '@ai-sdk-playground/catalog';
import { createMockAdapter, runExperiment, redactSecrets, validateExperiment } from '@ai-sdk-playground/core';
import { anthropicAdapter } from '@ai-sdk-playground/adapter-anthropic';
import { deepSeekAdapter } from '@ai-sdk-playground/adapter-deepseek';
import { googleAdapter } from '@ai-sdk-playground/adapter-google';
import { mistralAdapter } from '@ai-sdk-playground/adapter-mistral';
import { openAIAdapter } from '@ai-sdk-playground/adapter-openai';
import { openRouterAdapter } from '@ai-sdk-playground/adapter-openrouter';
import { xaiAdapter } from '@ai-sdk-playground/adapter-xai';
import type {
  ExperimentDefinition,
  ExperimentResult,
  ProviderId,
  UnifiedStreamEvent,
} from '@ai-sdk-playground/protocol';

const app = new Hono();
const host = process.env.HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? 8787);
const publicOrigin = process.env.PUBLIC_ORIGIN ?? 'http://127.0.0.1:5173';
const maxRequestBytes = Number(process.env.MAX_REQUEST_BYTES ?? 1_048_576);
const remoteAccess = process.env.ALLOW_REMOTE_ACCESS === 'true';

const storedExperiments = new Map<string, ExperimentDefinition>();
const storedResults = new Map<string, ExperimentResult>();
const controllers = new Map<string, AbortController>();

app.use(
  '*',
  cors({
    origin: publicOrigin,
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'X-Request-ID'],
  }),
);
app.use('*', async (context, next) => {
  context.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  context.header('X-Content-Type-Options', 'nosniff');
  context.header('Referrer-Policy', 'no-referrer');
  const contentLength = Number(context.req.header('content-length') ?? 0);
  if (contentLength > maxRequestBytes) return context.json({ ok: false, error: 'Payload too large.' }, 413);
  await next();
});

app.get('/health', (context) =>
  context.json({
    ok: true,
    service: 'ai-sdk-playground-gateway',
    mode: 'local-only',
    host,
    port,
    remoteAccess,
  }),
);
app.get('/ready', (context) =>
  context.json({ ok: true, catalogCheckedAt: '2026-08-03', liveProviders: PROVIDER_CATALOG.length }),
);

app.get('/api/providers', (context) =>
  context.json({
    providers: PROVIDER_CATALOG.map((provider) => ({
      ...provider,
      credentialStatus: process.env[provider.envKey] ? 'configured' : 'missing',
    })),
  }),
);
app.get('/api/models', (context) => context.json({ models: MODEL_CATALOG }));

app.post('/api/compatibility', async (context) => {
  const payload = await safeBody(context);
  if (!payload || typeof payload !== 'object' || !('experiment' in payload))
    return context.json({ ok: false, error: 'Expected { experiment }.' }, 400);
  const experiment = (payload as { experiment: ExperimentDefinition }).experiment;
  const adapters = liveAdapters();
  const reports = [];
  for (const target of experiment.targets.filter((item) => item.enabled)) {
    const adapter = adapters.find((item) => item.id === target.providerId);
    if (!adapter) continue;
    const model =
      MODEL_CATALOG.find((item) => item.id === target.modelId) ??
      MODEL_CATALOG.find((item) => item.providerId === target.providerId);
    if (model)
      reports.push({
        targetId: target.id,
        providerId: target.providerId,
        modelId: model.apiModelId,
        report: await adapter.validate(experiment.request, model),
      });
  }
  return context.json({ ok: true, reports });
});

app.post('/api/experiments', async (context) => {
  const payload = await safeBody(context);
  const experiment =
    payload && typeof payload === 'object' && 'experiment' in payload
      ? (payload as { experiment: ExperimentDefinition }).experiment
      : (payload as ExperimentDefinition);
  const errors = experiment ? validateExperiment(experiment) : ['Invalid experiment payload.'];
  if (errors.length) return context.json({ ok: false, errors }, 400);
  storedExperiments.set(experiment.id, experiment);
  return context.json({ ok: true, id: experiment.id });
});

app.get('/api/experiments/:id', (context) => {
  const id = context.req.param('id');
  const experiment = storedExperiments.get(id);
  if (!experiment) return context.json({ ok: false, error: 'Experiment not found.' }, 404);
  return context.json({ ok: true, experiment, result: storedResults.get(id) ?? null });
});

app.post('/api/runs', async (context) => {
  const payload = (await safeBody(context)) as
    { experiment?: ExperimentDefinition; mode?: 'mock' | 'live' } | undefined;
  if (!payload?.experiment) return context.json({ ok: false, error: 'Expected an experiment.' }, 400);
  const experiment = payload.experiment;
  const errors = validateExperiment(experiment);
  if (errors.length) return context.json({ ok: false, errors }, 400);
  const mode = payload.mode ?? 'live';
  const controller = new AbortController();
  controllers.set(experiment.id, controller);
  const result = await runExperiment(experiment, {
    mode,
    adapters:
      mode === 'mock' ? PROVIDER_CATALOG.map((provider) => createMockAdapter(provider.id)) : liveAdapters(),
    apiKeys: providerKeys(),
    baseUrls: providerBaseUrls(),
    signal: controller.signal,
  });
  controllers.delete(experiment.id);
  storedResults.set(experiment.id, result);
  storedExperiments.set(experiment.id, experiment);
  return context.json({ ok: true, result });
});

app.post('/api/runs/stream', async (context) => {
  const payload = (await safeBody(context)) as
    { experiment?: ExperimentDefinition; mode?: 'mock' | 'live' } | undefined;
  if (!payload?.experiment) return context.json({ ok: false, error: 'Expected an experiment.' }, 400);
  const experiment = payload.experiment;
  const errors = validateExperiment(experiment);
  if (errors.length) return context.json({ ok: false, errors }, 400);
  const mode = payload.mode ?? 'live';
  const controller = new AbortController();
  controllers.set(experiment.id, controller);
  const stream = new ReadableStream<Uint8Array>({
    async start(streamController) {
      const encoder = new TextEncoder();
      const send = (event: unknown) =>
        streamController.enqueue(encoder.encode(`data: ${JSON.stringify(redactSecrets(event))}\n\n`));
      try {
        const result = await runExperiment(experiment, {
          mode,
          adapters:
            mode === 'mock'
              ? PROVIDER_CATALOG.map((provider) => createMockAdapter(provider.id))
              : liveAdapters(),
          apiKeys: providerKeys(),
          baseUrls: providerBaseUrls(),
          signal: controller.signal,
          onEvent: (event: UnifiedStreamEvent) => send({ type: 'event', event }),
        });
        storedResults.set(experiment.id, result);
        storedExperiments.set(experiment.id, experiment);
        send({ type: 'completed', result });
      } catch (error) {
        send({ type: 'error', error: String(error) });
      } finally {
        controllers.delete(experiment.id);
        streamController.close();
      }
    },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  });
});

app.post('/api/runs/:id/cancel', (context) => {
  const id = context.req.param('id');
  const controller = controllers.get(id);
  if (!controller) return context.json({ ok: false, error: 'Run not found or already completed.' }, 404);
  controller.abort();
  return context.json({ ok: true, cancelled: id });
});

app.post('/api/export', async (context) => {
  const payload = await safeBody(context);
  return context.json({ ok: true, export: redactSecrets(payload) });
});

app.post('/api/import', async (context) => {
  const payload = await safeBody(context);
  if (!payload || typeof payload !== 'object')
    return context.json({ ok: false, error: 'Invalid JSON.' }, 400);
  return context.json({ ok: true, imported: redactSecrets(payload) });
});

if (process.env.NODE_ENV !== 'test') {
  serve({ fetch: app.fetch, hostname: host, port });
  console.log(`AI SDK Playground gateway listening on http://${host}:${port}`);
  console.log(
    `Live provider keys configured: ${
      PROVIDER_CATALOG.filter((provider) => process.env[provider.envKey])
        .map((provider) => provider.id)
        .join(', ') || 'none'
    }`,
  );
}

function liveAdapters() {
  return [
    openAIAdapter(),
    anthropicAdapter(),
    googleAdapter(),
    xaiAdapter(),
    deepSeekAdapter(),
    mistralAdapter(),
    openRouterAdapter(),
  ];
}

function providerKeys(): Partial<Record<ProviderId, string>> {
  return Object.fromEntries(
    PROVIDER_CATALOG.flatMap((provider) =>
      process.env[provider.envKey] ? [[provider.id, process.env[provider.envKey] as string]] : [],
    ),
  ) as Partial<Record<ProviderId, string>>;
}

function providerBaseUrls(): Partial<Record<ProviderId, string>> {
  return Object.fromEntries(
    PROVIDER_CATALOG.flatMap((provider) =>
      process.env[provider.baseUrlEnvKey]
        ? [[provider.id, process.env[provider.baseUrlEnvKey] as string]]
        : [],
    ),
  ) as Partial<Record<ProviderId, string>>;
}

async function safeBody(context: Context): Promise<unknown> {
  try {
    return await context.req.json();
  } catch {
    return undefined;
  }
}

export { app };

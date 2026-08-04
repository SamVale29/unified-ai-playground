#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { MODEL_CATALOG, PROVIDER_CATALOG } from '@ai-sdk-playground/catalog';
import { createMockAdapter, runExperiment, validateExperiment } from '@ai-sdk-playground/core';
import { anthropicAdapter } from '@ai-sdk-playground/adapter-anthropic';
import { deepSeekAdapter } from '@ai-sdk-playground/adapter-deepseek';
import { googleAdapter } from '@ai-sdk-playground/adapter-google';
import { mistralAdapter } from '@ai-sdk-playground/adapter-mistral';
import { openAIAdapter } from '@ai-sdk-playground/adapter-openai';
import { openRouterAdapter } from '@ai-sdk-playground/adapter-openrouter';
import { xaiAdapter } from '@ai-sdk-playground/adapter-xai';

const [command, ...args] = process.argv.slice(2);

await main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

async function main() {
  switch (command) {
    case 'init':
      return init(args[0]);
    case 'doctor':
      return doctor();
    case 'providers':
      return printProviders();
    case 'models':
      return printModels(args);
    case 'validate':
      return validateFile(args[0]);
    case 'run':
      return runFile(args);
    case 'compare':
      return compareFile(args[0]);
    case 'export':
      return exportFile(args);
    case 'serve':
      console.log('Run `pnpm dev:gateway` from the workspace to start the localhost gateway.');
      return;
    default:
      return help();
  }
}

async function init(file = 'experiment.json') {
  const experiment = {
    schemaVersion: '0.1.0',
    id: 'exp-cli',
    name: 'CLI example',
    request: {
      messages: [
        {
          id: 'user-1',
          role: 'user',
          content: [{ type: 'text', text: 'Explain event loops in five bullet points.' }],
        },
      ],
      generation: { temperature: 0.2, maxOutputTokens: 200 },
    },
    targets: [
      { id: 'openai', providerId: 'openai', modelId: 'openai:gpt-4o-mini', enabled: true },
      {
        id: 'anthropic',
        providerId: 'anthropic',
        modelId: 'anthropic:claude-3-5-sonnet-20241022',
        enabled: true,
      },
    ],
    execution: {
      mode: 'parallel',
      repetitions: 1,
      concurrency: 2,
      timeoutMs: 60000,
      stream: true,
      continueOnError: true,
      compatibilityMode: 'lenient',
    },
    privacy: { saveContent: false, includeRawPayloads: false, redactPatterns: [] },
    createdAt: new Date().toISOString(),
    tags: ['cli'],
  };
  const destination = workspacePath(file);
  await writeFile(destination, JSON.stringify(experiment, null, 2), 'utf8');
  console.log(`Created ${destination}`);
}

function doctor() {
  console.log('AI SDK Playground doctor');
  console.log(`Node: ${process.version}`);
  console.log(`Workspace providers: ${PROVIDER_CATALOG.length}`);
  console.log(`Catalog models: ${MODEL_CATALOG.length}`);
  for (const provider of PROVIDER_CATALOG)
    console.log(`${provider.id}: ${process.env[provider.envKey] ? 'configured' : 'missing key'}`);
  console.log('Secrets are never printed. Live calls should run through the local gateway.');
}

function printProviders() {
  for (const provider of PROVIDER_CATALOG)
    console.log(
      `${provider.id}\t${provider.displayName}\t${provider.defaultModelId}\t${process.env[provider.envKey] ? 'configured' : 'missing key'}`,
    );
}

function printModels(args: string[]) {
  const providerFlagIndex = args.indexOf('--provider');
  const provider = providerFlagIndex >= 0 ? args[providerFlagIndex + 1] : undefined;
  for (const model of MODEL_CATALOG.filter((item) => !provider || item.providerId === provider))
    console.log(`${model.providerId}\t${model.apiModelId}\t${model.displayName}\t${model.status}`);
}

async function readExperiment(file?: string) {
  if (!file) throw new Error('Provide an experiment JSON file.');
  return JSON.parse(await readFile(workspacePath(file), 'utf8')) as Parameters<typeof runExperiment>[0];
}

async function validateFile(file?: string) {
  const experiment = await readExperiment(file);
  const errors = validateExperiment(experiment);
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
    return;
  }
  console.log('Experiment is valid.');
}

async function runFile(args: string[]) {
  const file = args.find((arg) => !arg.startsWith('--'));
  const outputFlag = args.indexOf('--output');
  const outputFile = outputFlag >= 0 ? args[outputFlag + 1] : undefined;
  const experiment = await readExperiment(file);
  const result = await runExperiment(experiment, {
    mode: 'mock',
    adapters: PROVIDER_CATALOG.map((provider) => createMockAdapter(provider.id)),
  });
  const serialized = JSON.stringify(result, null, 2);
  if (outputFile) await writeFile(workspacePath(outputFile), serialized, 'utf8');
  else console.log(serialized);
}

async function compareFile(file?: string) {
  const result = JSON.parse(await readFile(workspacePath(file ?? ''), 'utf8')) as {
    runs: Array<{
      providerId: string;
      metrics?: { ttftMs?: number; totalDurationMs: number; cost: { estimatedUsd?: number } };
    }>;
  };
  for (const run of result.runs)
    console.log(
      `${run.providerId}\tTTFT ${run.metrics?.ttftMs ?? 'n/a'} ms\tTotal ${run.metrics?.totalDurationMs ?? 'n/a'} ms\tCost ${run.metrics?.cost.estimatedUsd ?? 'unknown'}`,
    );
}

async function exportFile(args: string[]) {
  const file = args.find((arg) => !arg.startsWith('--'));
  const result = JSON.parse(await readFile(workspacePath(file ?? ''), 'utf8')) as {
    experimentId: string;
    runs: Array<{ providerId: string; response?: { text: string }; metrics?: { totalDurationMs: number } }>;
  };
  const markdown = `# AI SDK Playground report\n\nExperiment: \`${result.experimentId}\`\n\n${result.runs.map((run) => `## ${run.providerId}\n\n- Total duration: ${run.metrics?.totalDurationMs ?? 'n/a'} ms\n\n${run.response?.text ?? 'No response'}`).join('\n\n')}`;
  const outputFlag = args.indexOf('--output');
  if (outputFlag >= 0) await writeFile(workspacePath(args[outputFlag + 1]), markdown, 'utf8');
  else console.log(markdown);
}

function help() {
  console.log(
    'ai-playground init|doctor|providers|models|validate <file>|run <file> [--output result.json]|compare <file>|export <file> [--output report.md]|serve',
  );
}

function workspacePath(file: string): string {
  const local = resolve(process.cwd(), file);
  if (existsSync(local) || (!file.includes('/') && !file.includes('\\'))) return local;
  const workspace = resolve(process.cwd(), '../..', file);
  return existsSync(dirname(workspace)) ? workspace : local;
}

void [
  anthropicAdapter,
  deepSeekAdapter,
  googleAdapter,
  mistralAdapter,
  openAIAdapter,
  openRouterAdapter,
  xaiAdapter,
];

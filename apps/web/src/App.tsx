import { useEffect, useMemo, useRef, useState } from 'react';
import { MODEL_CATALOG, PROVIDER_CATALOG, getModel } from '@ai-sdk-playground/catalog';
import {
  compatibilityFor,
  createExperiment,
  createMockAdapter,
  redactSecrets,
  runExperiment,
  textMessage,
} from '@ai-sdk-playground/core';
import type {
  ExperimentDefinition,
  ExperimentResult,
  ExperimentTarget,
  TargetRun,
  UnifiedRequest,
  UnifiedStreamEvent,
} from '@ai-sdk-playground/protocol';

type Theme = 'light' | 'dark';
type Mode = 'mock' | 'gateway';
type InspectorTab =
  | 'summary'
  | 'metrics'
  | 'compatibility'
  | 'normalized'
  | 'native'
  | 'raw'
  | 'events'
  | 'diff'
  | 'export'
  | 'security';

const publicDemo = import.meta.env.VITE_PUBLIC_DEMO_MODE === 'true';
const gatewayUrl = import.meta.env.VITE_GATEWAY_URL ?? 'http://127.0.0.1:8787';

const PRESETS: Array<{
  id: string;
  label: string;
  description: string;
  prompt: string;
  kind: 'text' | 'structured' | 'tools' | 'vision';
}> = [
  {
    id: 'concise',
    label: 'Concise answer',
    description: 'Compare adherence, TTFT and cost with a compact response.',
    kind: 'text',
    prompt: 'Explain why reproducible experiments matter when comparing AI APIs in three bullet points.',
  },
  {
    id: 'structured',
    label: 'Structured extraction',
    description: 'Validate JSON and a small schema against a fictional invoice.',
    kind: 'structured',
    prompt:
      'Extract the invoice number, total and currency from this fictional note: INV-DEMO-042 · Total R$ 128,50 · Currency BRL.',
  },
  {
    id: 'tools',
    label: 'Tool selection',
    description: 'Inspect a manual fixture tool call without executing anything.',
    kind: 'tools',
    prompt: 'Choose the weather fixture tool for São Paulo and explain the arguments you would send.',
  },
  {
    id: 'code',
    label: 'Code review',
    description: 'Review a small intentionally flawed snippet.',
    kind: 'text',
    prompt:
      'Review this code and list the two most important issues:\n\nfunction add(items) { return items.reduce((total, item) => total + item.value) }',
  },
  {
    id: 'translation',
    label: 'Translation',
    description: 'Compare style and length using project-owned text.',
    kind: 'text',
    prompt: 'Translate this public fixture to Brazilian Portuguese: “Comparable does not mean identical.”',
  },
  {
    id: 'long-context',
    label: 'Long-context summary',
    description: 'Summarize a short project-owned design note.',
    kind: 'text',
    prompt:
      'Summarize the principle “comparability does not mean equivalence” and mention one adapter warning.',
  },
  {
    id: 'vision',
    label: 'Vision extraction',
    description: 'Send the project-created SVG as an image input in mock mode.',
    kind: 'vision',
    prompt: 'Describe the labels and main shapes in the attached project vision fixture.',
  },
  {
    id: 'incompatibility',
    label: 'Provider incompatibility',
    description: 'Make a capability difference visible with strict and lenient modes.',
    kind: 'structured',
    prompt: 'Return a strict JSON object with a short answer and confidence score.',
  },
];

const DEFAULT_SCHEMA = JSON.stringify(
  {
    type: 'object',
    properties: { answer: { type: 'string' }, confidence: { type: 'number' } },
    required: ['answer', 'confidence'],
  },
  null,
  2,
);

const WEATHER_TOOL = {
  name: 'get_weather_fixture',
  description: 'Get weather from a deterministic local fixture. Never calls an external service.',
  inputSchema: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] },
};

function defaultTargets(): ExperimentTarget[] {
  return PROVIDER_CATALOG.map((provider, index) => ({
    id: `${provider.id}-target`,
    providerId: provider.id,
    modelId: `${provider.id}:${provider.defaultModelId}`,
    enabled: index < 4,
  }));
}

function initialTheme(): Theme {
  const stored = window.localStorage.getItem('ai-playground-theme');
  return stored === 'light' ? 'light' : 'dark';
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [mode, setMode] = useState<Mode>(publicDemo ? 'mock' : 'mock');
  const [presetId, setPresetId] = useState('concise');
  const [experimentName, setExperimentName] = useState('Provider comparison / concise answer');
  const [prompt, setPrompt] = useState(PRESETS[0].prompt);
  const [system, setSystem] = useState(
    'You are a precise technical assistant. State uncertainty instead of inventing provider capabilities.',
  );
  const [developer, setDeveloper] = useState('');
  const [targets, setTargets] = useState<ExperimentTarget[]>(defaultTargets);
  const [temperature, setTemperature] = useState(0.2);
  const [maxOutputTokens, setMaxOutputTokens] = useState(320);
  const [repetitions, setRepetitions] = useState(1);
  const [executionMode, setExecutionMode] = useState<'parallel' | 'sequential'>('parallel');
  const [timeoutMs, setTimeoutMs] = useState(60000);
  const [strictMode, setStrictMode] = useState(false);
  const [structured, setStructured] = useState(false);
  const [schemaText, setSchemaText] = useState(DEFAULT_SCHEMA);
  const [toolsEnabled, setToolsEnabled] = useState(false);
  const [visionEnabled, setVisionEnabled] = useState(false);
  const [saveContent, setSaveContent] = useState(false);
  const [privateSession, setPrivateSession] = useState(false);
  const [result, setResult] = useState<ExperimentResult | null>(null);
  const [experiment, setExperiment] = useState<ExperimentDefinition | null>(null);
  const [partialText, setPartialText] = useState<Record<string, string>>({});
  const [streamEvents, setStreamEvents] = useState<Record<string, UnifiedStreamEvent[]>>({});
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<InspectorTab>('summary');
  const [selectedTargetId, setSelectedTargetId] = useState<string>('openai-target');
  const [commandOpen, setCommandOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('ai-playground-theme', theme);
  }, [theme]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const command = event.metaKey || event.ctrlKey;
      if (command && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (command && event.key === 'Enter') {
        event.preventDefault();
        void run();
      }
      if (event.key === 'Escape') {
        setCommandOpen(false);
        if (running) abortRef.current?.abort();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const enabledTargets = targets.filter((target) => target.enabled);
  const compatibility = useMemo(
    () =>
      enabledTargets.map((target) => {
        const model = getModel(target.modelId, target.providerId);
        const request = buildRequest({
          prompt,
          system,
          developer,
          structured,
          schemaText,
          toolsEnabled,
          visionEnabled,
          temperature,
          maxOutputTokens,
        });
        return { target, model, report: compatibilityFor(request, model) };
      }),
    [
      developer,
      enabledTargets,
      maxOutputTokens,
      prompt,
      schemaText,
      structured,
      system,
      temperature,
      toolsEnabled,
      visionEnabled,
    ],
  );
  const selectedRun =
    result?.runs.find((run) => run.targetId === selectedTargetId && run.repetition === 1) ?? result?.runs[0];

  async function run() {
    setError(null);
    setNotice(null);
    if (enabledTargets.length < 2) {
      setError('Enable at least two targets before running a comparison.');
      return;
    }
    const request = buildRequest({
      prompt,
      system,
      developer,
      structured,
      schemaText,
      toolsEnabled,
      visionEnabled,
      temperature,
      maxOutputTokens,
    });
    if (request.output?.format === 'json-schema' && !request.output.schema) {
      setError('The JSON Schema editor contains invalid JSON.');
      return;
    }
    const nextExperiment = createExperiment({
      name: experimentName,
      request,
      targets,
      execution: {
        mode: executionMode,
        repetitions,
        concurrency: Math.min(enabledTargets.length, 4),
        timeoutMs,
        stream: true,
        continueOnError: true,
        compatibilityMode: strictMode ? 'strict' : 'lenient',
      },
      privacy: { saveContent, includeRawPayloads: false, redactPatterns: [], privateSession },
      tags: [presetId, mode === 'mock' ? 'fixture' : 'local-gateway'],
    });
    setExperiment(nextExperiment);
    setResult(null);
    setPartialText({});
    setStreamEvents({});
    setRunning(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      if (mode === 'mock') {
        const mockResult = await runExperiment(nextExperiment, {
          mode: 'mock',
          signal: controller.signal,
          adapters: PROVIDER_CATALOG.map((provider) => createMockAdapter(provider.id)),
          onEvent: handleEvent,
        });
        setResult(mockResult);
        setNotice('Fixture run completed. Values are simulated and safe to share.');
      } else {
        const gatewayResult = await runGatewayStream(nextExperiment, controller.signal, handleEvent);
        setResult(gatewayResult);
        setNotice('Local gateway run completed. Provider payloads stay behind the gateway.');
      }
    } catch (runError) {
      if (!controller.signal.aborted) setError(runError instanceof Error ? runError.message : 'Run failed.');
    } finally {
      abortRef.current = null;
      setRunning(false);
    }
  }

  function handleEvent(event: UnifiedStreamEvent) {
    setStreamEvents((current) => ({
      ...current,
      [event.targetId]: [...(current[event.targetId] ?? []), event],
    }));
    if (event.type === 'text-delta')
      setPartialText((current) => ({
        ...current,
        [event.targetId]: `${current[event.targetId] ?? ''}${event.delta}`,
      }));
  }

  function cancel() {
    abortRef.current?.abort();
    setNotice('Cancellation requested. In-flight provider calls will stop at the gateway boundary.');
  }

  function applyPreset(nextId: string) {
    const preset = PRESETS.find((item) => item.id === nextId) ?? PRESETS[0];
    setPresetId(nextId);
    setPrompt(preset.prompt);
    setExperimentName(`Provider comparison / ${preset.label.toLowerCase()}`);
    setStructured(preset.kind === 'structured');
    setToolsEnabled(preset.kind === 'tools');
    setVisionEnabled(preset.kind === 'vision');
    if (preset.kind === 'structured') setSchemaText(DEFAULT_SCHEMA);
    setNotice(`Loaded preset: ${preset.label}.`);
  }

  function toggleTarget(id: string) {
    setTargets((current) =>
      current.map((target) => (target.id === id ? { ...target, enabled: !target.enabled } : target)),
    );
  }
  function updateTargetModel(id: string, modelId: string) {
    setTargets((current) => current.map((target) => (target.id === id ? { ...target, modelId } : target)));
  }

  function exportReport(format: 'json' | 'markdown' = 'json') {
    const payload = {
      experiment,
      result: redactSecrets(result),
      exportedAt: new Date().toISOString(),
      privacy: { saveContent, privateSession },
    };
    if (format === 'json')
      download('ai-sdk-playground-experiment.json', JSON.stringify(payload, null, 2), 'application/json');
    else download('ai-sdk-playground-report.md', markdownReport(payload), 'text/markdown');
    setNotice(`Exported ${format.toUpperCase()} report with secrets redacted.`);
  }

  function createShareUrl() {
    if (privateSession) {
      setError('Private session blocks share URLs.');
      return;
    }
    const safeExperiment =
      experiment ??
      createExperiment({
        name: experimentName,
        request: buildRequest({
          prompt: saveContent ? prompt : '[prompt omitted]',
          system: saveContent ? system : '[system omitted]',
          developer: '',
          structured,
          schemaText,
          toolsEnabled,
          visionEnabled,
          temperature,
          maxOutputTokens,
        }),
        targets,
        privacy: { saveContent: false, includeRawPayloads: false, redactPatterns: [] },
      });
    const encoded = window.btoa(
      encodeURIComponent(
        JSON.stringify({
          ...safeExperiment,
          request: {
            ...safeExperiment.request,
            messages: saveContent
              ? safeExperiment.request.messages
              : safeExperiment.request.messages.map((message) => ({
                  ...message,
                  content: [{ type: 'text', text: '[content omitted]' }],
                })),
          },
        }),
      ),
    );
    navigator.clipboard?.writeText(`${window.location.origin}${window.location.pathname}#share=${encoded}`);
    setNotice('Share URL copied without API keys or results.');
  }

  async function importExperiment(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as
        { experiment?: ExperimentDefinition } | ExperimentDefinition;
      const imported =
        'experiment' in parsed && parsed.experiment ? parsed.experiment : (parsed as ExperimentDefinition);
      setExperiment(imported);
      setExperimentName(imported.name);
      setPrompt(extractMessage(imported.request, 'user'));
      setSystem(extractMessage(imported.request, 'system'));
      setTargets(imported.targets);
      setNotice('Imported experiment configuration. Responses were not restored into the live editor.');
    } catch {
      setError('Import failed: expected a valid experiment JSON file.');
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <img src={`${import.meta.env.BASE_URL}brand/mark.svg`} alt="" />
          <div>
            <span className="eyebrow">OPEN SOURCE LAB</span>
            <h1>AI SDK Playground</h1>
          </div>
        </div>
        <div className="topbar-actions">
          <span className="version-chip">v0.1.0</span>
          <button
            className="icon-button"
            aria-label="Open command palette"
            onClick={() => setCommandOpen(true)}
          >
            ⌘K
          </button>
          <button
            className="icon-button"
            aria-label="Toggle theme"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? '☼' : '☾'}
          </button>
          <a
            className="github-link"
            href="https://github.com/SamVale29/unified-ai-playground"
            target="_blank"
            rel="noreferrer"
          >
            GitHub ↗
          </a>
        </div>
      </header>
      {publicDemo && (
        <div className="demo-banner">
          <span className="status-dot" /> Demo mode uses simulated provider responses. Run the project locally
          to test real APIs. <button onClick={() => setMode('gateway')}>Use local gateway</button>
        </div>
      )}
      <main className="workspace">
        <aside className="config-column" aria-label="Experiment configuration">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">WORKBENCH</span>
              <h2>Experiment</h2>
            </div>
            <span className="save-status">LOCAL ONLY</span>
          </div>
          <label className="field-label">
            Experiment name
            <input value={experimentName} onChange={(event) => setExperimentName(event.target.value)} />
          </label>
          <label className="field-label">
            Preset
            <select value={presetId} onChange={(event) => applyPreset(event.target.value)}>
              {PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>
          <div className="preset-note">{PRESETS.find((preset) => preset.id === presetId)?.description}</div>
          <div className="editor-block">
            <div className="editor-label">
              <span>Messages</span>
              <span className="muted">IR / text parts</span>
            </div>
            <label className="mini-label">
              System
              <textarea value={system} onChange={(event) => setSystem(event.target.value)} rows={3} />
            </label>
            <label className="mini-label">
              User
              <textarea
                aria-label="User prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                rows={7}
              />
            </label>
            <label className="mini-label">
              Developer <span className="muted">optional</span>
              <textarea
                value={developer}
                onChange={(event) => setDeveloper(event.target.value)}
                rows={2}
                placeholder="Preserved when supported; adapted explicitly otherwise."
              />
            </label>
            <div className="prompt-preview">
              <span>Resolved prompt preview</span>
              <strong>{prompt.replace(/\{\{\w+\}\}/gu, 'fixture')}</strong>
            </div>
          </div>
          <div className="control-grid">
            <label className="field-label">
              Temperature
              <input
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={(event) => setTemperature(Number(event.target.value))}
              />
            </label>
            <label className="field-label">
              Max output
              <input
                type="number"
                min="1"
                max="10000"
                value={maxOutputTokens}
                onChange={(event) => setMaxOutputTokens(Number(event.target.value))}
              />
            </label>
            <label className="field-label">
              Repetitions
              <select value={repetitions} onChange={(event) => setRepetitions(Number(event.target.value))}>
                {[1, 2, 3, 5, 10].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label className="field-label">
              Execution
              <select
                value={executionMode}
                onChange={(event) => setExecutionMode(event.target.value as 'parallel' | 'sequential')}
              >
                <option value="parallel">Parallel</option>
                <option value="sequential">Sequential</option>
              </select>
            </label>
          </div>
          <div className="toggle-row">
            <Toggle
              checked={structured}
              onChange={setStructured}
              label="Structured JSON"
              hint="local validation"
            />
            <Toggle
              checked={toolsEnabled}
              onChange={setToolsEnabled}
              label="Tool calling"
              hint="manual approval"
            />
            <Toggle
              checked={visionEnabled}
              onChange={setVisionEnabled}
              label="Vision fixture"
              hint="project-owned SVG"
            />
          </div>
          {structured && (
            <label className="field-label code-field">
              JSON Schema
              <textarea
                value={schemaText}
                onChange={(event) => setSchemaText(event.target.value)}
                rows={7}
                spellCheck={false}
              />
            </label>
          )}
          {toolsEnabled && (
            <div className="tool-preview">
              <span className="tool-kicker">FIXTURE TOOL</span>
              <strong>{WEATHER_TOOL.name}</strong>
              <code>{JSON.stringify(WEATHER_TOOL.inputSchema)}</code>
              <span>Manual review is required; no external tool execution.</span>
            </div>
          )}
          {visionEnabled && (
            <div className="image-preview">
              <img
                src={`${import.meta.env.BASE_URL}vision-fixture.svg`}
                alt="Project-created vision fixture"
              />
              <span>ImagePart · public fixture · no upload in mock mode</span>
            </div>
          )}
          <div className="targets-section">
            <div className="section-label">
              <span>Targets</span>
              <span>{enabledTargets.length}/8 selected</span>
            </div>
            {targets.map((target) => (
              <TargetSelector
                key={target.id}
                target={target}
                checked={target.enabled}
                onToggle={() => toggleTarget(target.id)}
                onModelChange={(modelId) => updateTargetModel(target.id, modelId)}
              />
            ))}
          </div>
          <div className="execution-footer">
            <label className="field-label">
              Run mode
              <select value={mode} onChange={(event) => setMode(event.target.value as Mode)}>
                <option value="mock">Mock demo · safe</option>
                <option value="gateway">Local gateway · real keys</option>
              </select>
            </label>
            <label className="field-label">
              Timeout
              <input
                type="number"
                min="100"
                step="1000"
                value={timeoutMs}
                onChange={(event) => setTimeoutMs(Number(event.target.value))}
              />
            </label>
            <Toggle
              checked={strictMode}
              onChange={setStrictMode}
              label="Strict compatibility"
              hint="block unsupported"
            />
            <Toggle
              checked={saveContent}
              onChange={setSaveContent}
              label="Save content"
              hint="off by default"
            />
            <Toggle
              checked={privateSession}
              onChange={setPrivateSession}
              label="Private session"
              hint="no share URL"
            />
          </div>
          <div className="run-actions">
            <button
              className="run-button"
              onClick={() => void run()}
              disabled={running || enabledTargets.length < 2}
            >
              <span>{running ? 'Running comparison…' : 'Run comparison'}</span>
              <kbd>⌘↵</kbd>
            </button>
            {running && (
              <button className="secondary-button" onClick={cancel}>
                Stop all <kbd>Esc</kbd>
              </button>
            )}
          </div>
          <div className="privacy-note">
            <span>⌁</span>
            <div>
              <strong>No frontend API keys</strong>
              <p>
                Keys are read only by the local gateway process. Public demo never performs network inference.
              </p>
            </div>
          </div>
        </aside>
        <section className="comparison-area" aria-label="Comparison results">
          <div className="comparison-header">
            <div>
              <span className="eyebrow">LIVE COMPARISON</span>
              <h2>One prompt. Multiple providers.</h2>
              <p>Compare measured behavior and adapter semantics side by side — no absolute ranking.</p>
            </div>
            <div className="header-actions">
              <button className="secondary-button" onClick={() => fileInputRef.current?.click()}>
                Import
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importExperiment(file);
                }}
              />
              <button
                className="secondary-button"
                onClick={() => exportReport('json')}
                disabled={!experiment && !result}
              >
                Export
              </button>
              <button className="secondary-button" onClick={createShareUrl}>
                Share config
              </button>
            </div>
          </div>
          {(error || notice) && (
            <div className={`toast ${error ? 'toast-error' : ''}`} role="status">
              <span>{error ? '!' : '✓'}</span>
              {error ?? notice}
              <button
                onClick={() => {
                  setError(null);
                  setNotice(null);
                }}
              >
                ×
              </button>
            </div>
          )}
          <div className="comparison-grid">
            {targets
              .filter((target) => target.enabled)
              .map((target) => (
                <TargetCard
                  key={target.id}
                  target={target}
                  run={result?.runs.find((item) => item.targetId === target.id && item.repetition === 1)}
                  partialText={partialText[target.id]}
                  events={streamEvents[target.id] ?? []}
                  onSelect={() => setSelectedTargetId(target.id)}
                  selected={selectedTargetId === target.id}
                  running={running}
                />
              ))}
          </div>
          <div className="analysis-panel">
            <div className="tabs" role="tablist">
              {(
                [
                  'summary',
                  'metrics',
                  'compatibility',
                  'normalized',
                  'native',
                  'raw',
                  'events',
                  'diff',
                  'export',
                  'security',
                ] as InspectorTab[]
              ).map((tab) => (
                <button
                  key={tab}
                  role="tab"
                  aria-selected={activeTab === tab}
                  className={activeTab === tab ? 'active' : ''}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === 'normalized'
                    ? 'Normalized request'
                    : tab === 'native'
                      ? 'Native request'
                      : tab === 'raw'
                        ? 'Raw response'
                        : tab === 'security'
                          ? 'Security'
                          : tab[0].toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
            <Inspector
              tab={activeTab}
              run={selectedRun}
              experiment={experiment}
              compatibility={compatibility}
              events={streamEvents[selectedTargetId] ?? []}
              onExport={exportReport}
              onShare={createShareUrl}
            />
          </div>
          <section className="lower-grid">
            <div className="callout-card">
              <span className="eyebrow">REPRODUCIBILITY</span>
              <h3>Every run is a snapshot.</h3>
              <p>
                Schema version, exact model ID, adapter version, timing events and sanitization policy travel
                with the export.
              </p>
              <div className="callout-meta">
                <span>Schema {experiment?.schemaVersion ?? '0.1.0'}</span>
                <span>
                  {repetitions} repetition{repetitions === 1 ? '' : 's'}
                </span>
                <span>{executionMode}</span>
              </div>
            </div>
            <div className="callout-card accent-card">
              <span className="eyebrow">SEMANTICS</span>
              <h3>Compatible ≠ equivalent.</h3>
              <p>
                Adapters show omitted, adapted and provider-specific fields so a normalized request never
                hides meaningful differences.
              </p>
              <button className="text-button" onClick={() => setActiveTab('compatibility')}>
                Open compatibility report →
              </button>
            </div>
          </section>
        </section>
      </main>
      <footer className="site-footer">
        <span>AI SDK Playground · independent open source project by Sam Vale</span>
        <span>Apache-2.0 · no analytics · local-first by design</span>
      </footer>
      {commandOpen && (
        <div className="modal-backdrop" onClick={() => setCommandOpen(false)}>
          <div
            className="command-palette"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="command-input">
              ⌘{' '}
              <input
                autoFocus
                placeholder="Type a command…"
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setCommandOpen(false);
                }}
              />
            </div>
            {[
              ['Run comparison', () => void run()],
              ['Load structured preset', () => applyPreset('structured')],
              ['Toggle theme', () => setTheme(theme === 'dark' ? 'light' : 'dark')],
              ['Open security tab', () => setActiveTab('security')],
            ].map(([label, action]) => (
              <button
                key={String(label)}
                onClick={() => {
                  (action as () => void)();
                  setCommandOpen(false);
                }}
              >
                <span>{label as string}</span>
                <kbd>↵</kbd>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function buildRequest(args: {
  prompt: string;
  system: string;
  developer: string;
  structured: boolean;
  schemaText: string;
  toolsEnabled: boolean;
  visionEnabled: boolean;
  temperature: number;
  maxOutputTokens: number;
}): UnifiedRequest {
  const messages = [
    args.system.trim() ? textMessage(args.system.trim(), 'system', 'system-1') : null,
    args.developer.trim() ? textMessage(args.developer.trim(), 'developer', 'developer-1') : null,
    {
      id: 'user-1',
      role: 'user' as const,
      content: [
        { type: 'text' as const, text: args.prompt },
        ...(args.visionEnabled
          ? [
              {
                type: 'image' as const,
                source: {
                  type: 'url' as const,
                  url: `${window.location.origin}${import.meta.env.BASE_URL}vision-fixture.svg`,
                },
              },
            ]
          : []),
      ],
    },
  ].filter(Boolean) as UnifiedRequest['messages'];
  let schema: Record<string, unknown> | undefined;
  if (args.structured) {
    try {
      schema = JSON.parse(args.schemaText) as Record<string, unknown>;
    } catch {
      schema = undefined;
    }
  }
  return {
    messages,
    generation: {
      temperature: args.temperature,
      maxOutputTokens: args.maxOutputTokens,
      reasoning: { enabled: false },
    },
    output: args.structured
      ? { format: 'json-schema', schema, schemaName: 'playground_response', strict: true }
      : { format: 'text' },
    tools: args.toolsEnabled ? [WEATHER_TOOL] : undefined,
    toolChoice: args.toolsEnabled ? 'auto' : undefined,
  };
}

async function runGatewayStream(
  nextExperiment: ExperimentDefinition,
  signal: AbortSignal,
  onEvent: (event: UnifiedStreamEvent) => void,
): Promise<ExperimentResult> {
  const response = await fetch(`${gatewayUrl}/api/runs/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ experiment: nextExperiment, mode: 'live' }),
    signal,
  });
  if (!response.ok)
    throw new Error(`Gateway returned HTTP ${response.status}. Start it with pnpm dev:gateway.`);
  if (!response.body) throw new Error('Gateway did not return a stream.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalResult: ExperimentResult | undefined;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() ?? '';
    for (const chunk of chunks) {
      const dataLine = chunk.split('\n').find((line) => line.startsWith('data: '));
      if (!dataLine) continue;
      const payload = JSON.parse(dataLine.slice(6)) as {
        type: string;
        event?: UnifiedStreamEvent;
        result?: ExperimentResult;
        error?: string;
      };
      if (payload.type === 'event' && payload.event) onEvent(payload.event);
      if (payload.type === 'completed' && payload.result) finalResult = payload.result;
      if (payload.type === 'error') throw new Error(payload.error ?? 'Gateway stream failed.');
    }
  }
  if (!finalResult) throw new Error('Gateway stream ended without a result.');
  return finalResult;
}

function extractMessage(request: UnifiedRequest, role: 'system' | 'user'): string {
  return (
    request.messages.find((message) => message.role === role)?.content.find((part) => part.type === 'text')
      ?.text ?? ''
  );
}

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
function markdownReport(payload: { experiment: ExperimentDefinition | null; result: unknown }): string {
  const result = payload.result as ExperimentResult | null;
  return `# AI SDK Playground report\n\nExperiment: ${payload.experiment?.name ?? 'Untitled'}\n\nMode: ${result?.mode ?? 'not run'}\n\n${result?.runs.map((run) => `## ${run.providerId} / ${run.modelId}\n\n- Status: ${run.status}\n- TTFT: ${run.metrics?.ttftMs ?? 'Unavailable'} ms\n- Total: ${run.metrics?.totalDurationMs ?? 'Unavailable'} ms\n- Tokens: ${run.metrics?.usage.totalTokens ?? 'Unavailable'}\n- Estimated cost: ${run.metrics?.cost.estimatedUsd ?? 'Unknown'}\n\n${run.response?.text ?? run.error?.message ?? 'No response.'}`).join('\n\n') ?? 'No runs yet.'}`;
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <label className="toggle-control">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={checked ? 'switch on' : 'switch'}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
      <span>
        <strong>{label}</strong>
        <small>{hint}</small>
      </span>
    </label>
  );
}

function TargetSelector({
  target,
  checked,
  onToggle,
  onModelChange,
}: {
  target: ExperimentTarget;
  checked: boolean;
  onToggle: () => void;
  onModelChange: (modelId: string) => void;
}) {
  const provider = PROVIDER_CATALOG.find((item) => item.id === target.providerId)!;
  const models = MODEL_CATALOG.filter((model) => model.providerId === target.providerId);
  return (
    <div className={`target-selector ${checked ? 'checked' : ''}`}>
      <button
        type="button"
        className="check-button"
        aria-label={`${checked ? 'Disable' : 'Enable'} ${provider.displayName}`}
        onClick={onToggle}
      >
        {checked ? '✓' : ''}
      </button>
      <div className="target-selector-main">
        <div>
          <strong>{provider.displayName}</strong>
          <span className="credential-status">
            <i /> mock ready
          </span>
        </div>
        <select
          aria-label={`${provider.displayName} model`}
          value={target.modelId}
          onChange={(event) => onModelChange(event.target.value)}
        >
          {models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.displayName}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function TargetCard({
  target,
  run,
  partialText,
  events,
  onSelect,
  selected,
  running,
}: {
  target: ExperimentTarget;
  run?: TargetRun;
  partialText?: string;
  events: UnifiedStreamEvent[];
  onSelect: () => void;
  selected: boolean;
  running: boolean;
}) {
  const provider = PROVIDER_CATALOG.find((item) => item.id === target.providerId)!;
  const text = run?.response?.text ?? partialText ?? '';
  const status = running && !run ? 'streaming' : (run?.status ?? 'idle');
  return (
    <article
      className={`result-card ${selected ? 'selected' : ''}`}
      onClick={onSelect}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onSelect();
      }}
    >
      <div className="result-card-header">
        <div>
          <span className="provider-avatar">{provider.shortName.slice(0, 1)}</span>
          <div>
            <h3>{provider.displayName}</h3>
            <span className="model-label">{target.modelId.split(':').slice(1).join(':')}</span>
          </div>
        </div>
        <span className={`run-status ${status}`}>
          <i />
          {status}
        </span>
      </div>
      <div className="response-body">
        {text ? (
          <p>{text}</p>
        ) : (
          <div className="empty-response">
            <span className="pulse-line" />
            <span className="pulse-line short" />
            <span className="pulse-line" />
          </div>
        )}
      </div>
      {run?.response?.reasoning && (
        <div className="reasoning-strip">
          <span>REASONING SUMMARY</span>
          {run.response.reasoning}
        </div>
      )}
      {run?.response?.toolCalls?.length ? (
        <div className="tool-call-strip">
          <span>TOOL CALL</span>
          <strong>{run.response.toolCalls[0].name}</strong>
          <code>{run.response.toolCalls[0].argumentsText}</code>
        </div>
      ) : null}
      <div className="metric-row">
        <Metric
          label="TTFT"
          value={
            run?.metrics?.ttftMs !== undefined
              ? `${run.metrics.ttftMs} ms`
              : status === 'streaming'
                ? '…'
                : '—'
          }
        />
        <Metric
          label="Total"
          value={run?.metrics?.totalDurationMs !== undefined ? `${run.metrics.totalDurationMs} ms` : '—'}
        />
        <Metric label="Tokens" value={run?.metrics?.usage.totalTokens?.toString() ?? '—'} />
        <Metric
          label="Cost"
          value={
            run?.metrics?.cost.estimatedUsd !== undefined
              ? `$${run.metrics.cost.estimatedUsd.toFixed(4)}`
              : 'unknown'
          }
        />
      </div>
      <div className="card-footer">
        <span>{run?.response?.finishReason ?? (events.length ? `${events.length} events` : 'Ready')}</span>
        <span>
          {run?.warnings.length
            ? `${run.warnings.length} warning${run.warnings.length === 1 ? '' : 's'}`
            : 'No warnings'}
        </span>
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Inspector({
  tab,
  run,
  experiment,
  compatibility,
  events,
  onExport,
  onShare,
}: {
  tab: InspectorTab;
  run?: TargetRun;
  experiment: ExperimentDefinition | null;
  compatibility: Array<{
    target: ExperimentTarget;
    model: ReturnType<typeof getModel>;
    report: ReturnType<typeof compatibilityFor>;
  }>;
  events: UnifiedStreamEvent[];
  onExport: (format: 'json' | 'markdown') => void;
  onShare: () => void;
}) {
  if (tab === 'summary')
    return (
      <div className="inspector-summary">
        <div className="inspector-copy">
          <span className="eyebrow">INSPECTOR / SUMMARY</span>
          <h3>{run ? `${run.providerId} · ${run.modelId}` : 'Ready for an experiment'}</h3>
          <p>
            {run?.response?.text ??
              'Run the same normalized request against two to eight targets. Results will appear here with raw and transformed payloads kept separate.'}
          </p>
        </div>
        <div className="summary-stats">
          <Metric label="Status" value={run?.status ?? 'idle'} />
          <Metric label="Adapter" value="0.1.0" />
          <Metric label="Stream events" value={String(run?.events.length ?? events.length)} />
          <Metric label="Finish" value={run?.response?.finishReason ?? '—'} />
        </div>
      </div>
    );
  if (tab === 'metrics')
    return (
      <div className="inspector-content">
        <InspectorTitle
          title="Measured metrics"
          subtitle="Provider-reported usage is never replaced by an estimate."
        />
        <div className="large-metric-grid">
          <Metric
            label="Time to first useful output"
            value={run?.metrics?.ttftMs !== undefined ? `${run.metrics.ttftMs} ms` : 'Unavailable'}
          />
          <Metric
            label="Generation duration"
            value={
              run?.metrics?.generationDurationMs !== undefined
                ? `${run.metrics.generationDurationMs} ms`
                : 'Unavailable'
            }
          />
          <Metric
            label="Output throughput"
            value={
              run?.metrics?.outputTokensPerSecond !== undefined
                ? `${run.metrics.outputTokensPerSecond} tok/s`
                : 'Unavailable'
            }
          />
          <Metric label="Character count" value={String(run?.metrics?.characterCount ?? '—')} />
          <Metric label="Input tokens" value={String(run?.metrics?.usage.inputTokens ?? 'Unavailable')} />
          <Metric label="Output tokens" value={String(run?.metrics?.usage.outputTokens ?? 'Unavailable')} />
          <Metric
            label="Estimated cost"
            value={
              run?.metrics?.cost.estimatedUsd !== undefined
                ? `$${run.metrics.cost.estimatedUsd.toFixed(6)}`
                : 'Unknown'
            }
          />
          <Metric
            label="Provider-reported cost"
            value={
              run?.metrics?.cost.reportedUsd !== undefined
                ? `$${run.metrics.cost.reportedUsd.toFixed(6)}`
                : 'Unavailable'
            }
          />
        </div>
      </div>
    );
  if (tab === 'compatibility')
    return (
      <div className="inspector-content">
        <InspectorTitle
          title="Compatibility report"
          subtitle="Native, adapted, partial and unsupported are deliberately different states."
        />
        <div className="compat-table-wrap">
          <table className="compat-table">
            <thead>
              <tr>
                <th>Target</th>
                <th>Level</th>
                <th>Features</th>
                <th>Warnings</th>
              </tr>
            </thead>
            <tbody>
              {compatibility.map(({ target, report }) => (
                <tr key={target.id}>
                  <td>
                    <strong>{target.providerId}</strong>
                    <small>{target.modelId}</small>
                  </td>
                  <td>
                    <span className={`level level-${report.level}`}>{report.level}</span>
                  </td>
                  <td>
                    {report.features.map((feature) => (
                      <span className="feature-chip" key={feature.feature}>
                        {feature.feature}: {feature.status}
                      </span>
                    ))}
                  </td>
                  <td>
                    {report.warnings.length
                      ? report.warnings.map((warning) => <div key={warning.field}>{warning.message}</div>)
                      : 'None declared'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  if (tab === 'normalized')
    return (
      <JsonPanel
        title="Normalized request"
        value={experiment?.request ?? { message: 'Run or import an experiment to inspect the IR.' }}
      />
    );
  if (tab === 'native')
    return (
      <JsonPanel
        title="Native request transformation"
        value={
          run?.response?.transformation ?? {
            message: 'Select a completed target to inspect its adapter transformation.',
          }
        }
      />
    );
  if (tab === 'raw')
    return (
      <JsonPanel
        title="Raw provider response"
        value={
          run?.response?.rawResponse ?? {
            fixture: false,
            message: 'Raw payloads are not available until a target completes.',
          }
        }
      />
    );
  if (tab === 'events')
    return (
      <div className="inspector-content">
        <InspectorTitle
          title="Stream timeline"
          subtitle="Events retain ordering and elapsed time for replay and debugging."
        />
        <div className="timeline">
          {events.length ? (
            events.map((event) => (
              <div className="timeline-item" key={`${event.targetId}-${event.sequence}`}>
                <span className="timeline-time">+{event.elapsedMs}ms</span>
                <span className="timeline-dot" />
                <div>
                  <strong>{event.type}</strong>
                  <code>
                    {JSON.stringify(
                      event.type === 'text-delta'
                        ? { delta: event.delta }
                        : event.type === 'usage-update'
                          ? { usage: event.usage }
                          : {},
                    )}
                  </code>
                </div>
              </div>
            ))
          ) : (
            <EmptyState text="No stream events yet." />
          )}
        </div>
      </div>
    );
  if (tab === 'diff')
    return (
      <div className="inspector-content">
        <InspectorTitle
          title="Baseline diff"
          subtitle="Choose a baseline when comparing more than two targets."
        />
        <div className="diff-grid">
          <div>
            <span className="diff-label">Baseline</span>
            <strong>{compatibility[0]?.target.providerId ?? '—'}</strong>
            <p>{compatibility[0]?.model.displayName ?? 'Run a comparison to enable a diff.'}</p>
          </div>
          <div>
            <span className="diff-label">Observed difference</span>
            <strong>{run?.response ? `${run.response.text.length} characters` : '—'}</strong>
            <p>Text and JSON structural diff remain intentionally separate from quality claims.</p>
          </div>
        </div>
      </div>
    );
  if (tab === 'export')
    return (
      <div className="inspector-content export-panel">
        <InspectorTitle
          title="Sanitized export"
          subtitle="Exports remove secrets, authorization headers, base64 files and private content by default."
        />
        <div className="export-buttons">
          <button className="run-button compact" onClick={() => onExport('json')}>
            Download JSON
          </button>
          <button className="secondary-button" onClick={() => onExport('markdown')}>
            Download Markdown
          </button>
          <button className="secondary-button" onClick={onShare}>
            Copy share config
          </button>
        </div>
        <p className="muted">
          The share URL contains configuration only unless you explicitly enable prompt saving.
        </p>
      </div>
    );
  return (
    <div className="inspector-content security-panel">
      <InspectorTitle
        title="Private by default"
        subtitle="A public demo must not become a credential proxy."
      />
      <div className="security-grid">
        <SecurityItem
          title="API keys"
          text="Read only by the local gateway process. Never imported into the browser bundle or stored in experiment JSON."
        />
        <SecurityItem
          title="Mock mode"
          text="Deterministic fixtures simulate streaming, tool calls, compatibility warnings and structured outputs without network requests."
        />
        <SecurityItem
          title="History"
          text="This UI stores theme preference only unless you choose a content-saving option. Private session blocks share URLs."
        />
        <SecurityItem
          title="Provider data"
          text="Live prompts are sent to the provider selected by you and remain subject to that provider's terms and retention policies."
        />
      </div>
      <a
        className="text-button"
        href="https://github.com/SamVale29/unified-ai-playground/blob/main/docs/security-model.md"
        target="_blank"
        rel="noreferrer"
      >
        Read the security model →
      </a>
    </div>
  );
}

function InspectorTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="inspector-title">
      <div>
        <span className="eyebrow">DETAILS</span>
        <h3>{title}</h3>
      </div>
      <p>{subtitle}</p>
    </div>
  );
}
function JsonPanel({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="inspector-content">
      <InspectorTitle title={title} subtitle="Secrets are redacted before display and export." />
      <pre className="json-viewer">{JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}
function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}
function SecurityItem({ title, text }: { title: string; text: string }) {
  return (
    <div className="security-item">
      <span>✓</span>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  );
}

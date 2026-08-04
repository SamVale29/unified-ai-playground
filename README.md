# AI SDK Playground

**Test, compare and understand AI APIs in one place.**

AI SDK Playground is a unified open-source lab for testing and comparing OpenAI, Anthropic, Google Gemini, xAI, DeepSeek, Mistral AI and OpenRouter APIs. It runs reproducible multi-provider experiments, shows normalized and native requests side by side, compares streaming and latency, and keeps provider differences visible.

> The public demo uses deterministic simulated fixtures. Real provider calls run locally through the gateway you control.

## Why this exists

“Compatible” does not mean “identical”. Roles, content blocks, tools, structured outputs, reasoning controls, usage accounting and finish reasons vary across providers. AI SDK Playground uses a provider-neutral Intermediate Representation (IR), then records every adapter transformation:

- normalized request and native request;
- applied, omitted and approximated fields;
- compatibility warnings and strict-mode blockers;
- streaming events, TTFT, total duration and throughput;
- provider usage, estimated cost and provider-reported cost when available;
- raw response, normalized response, tool calls and structured-output validation.

The project does not declare an absolute winner. It provides measured evidence for the experiment you ran.

## Public demo

Run the safe mock mode on [GitHub Pages](https://samvale29.github.io/unified-ai-playground/) when the deployment is available. The demo never asks for, receives or transmits API keys.

## Quick start

Requirements: Node.js LTS, pnpm 11, and (for real calls) provider keys in the local environment.

```bash
pnpm install
pnpm dev
```

To run the local gateway in another terminal:

```bash
pnpm dev:gateway
```

Copy `.env.example` to `.env` and set only the keys for providers you selected. Keys are read by `apps/gateway`, never by `apps/web`.

```bash
pnpm test
pnpm build
pnpm test:e2e
```

## Providers

| Provider      | Adapter                                 | Default live surface                            | Mock | Contract status |
| ------------- | --------------------------------------- | ----------------------------------------------- | ---- | --------------- |
| OpenAI        | `@ai-sdk-playground/adapter-openai`     | Chat Completions                                | yes  | covered         |
| Anthropic     | `@ai-sdk-playground/adapter-anthropic`  | Messages API                                    | yes  | covered         |
| Google Gemini | `@ai-sdk-playground/adapter-google`     | `generateContent`                               | yes  | covered         |
| xAI           | `@ai-sdk-playground/adapter-xai`        | OpenAI-compatible Chat Completions              | yes  | covered         |
| DeepSeek      | `@ai-sdk-playground/adapter-deepseek`   | Chat Completions                                | yes  | covered         |
| Mistral AI    | `@ai-sdk-playground/adapter-mistral`    | Chat Completions                                | yes  | covered         |
| OpenRouter    | `@ai-sdk-playground/adapter-openrouter` | Chat Completions with explicit routing metadata | yes  | covered         |

The catalog intentionally marks model status and pricing as unknown when it cannot verify them from a source. See [`docs/provider-compatibility.md`](docs/provider-compatibility.md) and [`docs/known-differences.md`](docs/known-differences.md).

## Core concepts

### Intermediate Representation

`@ai-sdk-playground/protocol` defines `UnifiedRequest`, messages, content parts, tools, targets, compatibility reports, normalized errors and stream events. `@ai-sdk-playground/core` orchestrates repetitions, concurrency, cancellation and timeout without a React or provider SDK dependency.

### Mock mode

Mock mode is deterministic, local and clearly labeled as simulated. It demonstrates streaming, tool calls, structured outputs, invalid capability combinations and metrics without network requests.

### Local gateway

`apps/gateway` binds to `127.0.0.1` by default, applies a request-size limit, restricts CORS, sets security headers, reads keys from environment variables, redacts sensitive fields and exposes health/catalog/run/SSE endpoints. It does not execute tools automatically or run arbitrary code.

### Export and sharing

Exports are sanitized by default. Share URLs contain configuration only, never API keys, raw authorization headers, base64 files or private results. The browser stores only theme preference unless you explicitly enable content saving.

## CLI

```bash
pnpm cli -- init experiment.json
pnpm cli -- doctor
pnpm cli -- providers
pnpm cli -- models --provider openai
pnpm cli -- validate experiment.json
pnpm cli -- run experiment.json --output result.json
pnpm cli -- compare result.json
pnpm cli -- export result.json --output report.md
```

The CLI defaults to mock mode. Live automation should use the local gateway and explicit keys.

## Repository map

```text
apps/web                 React/Vite playground and safe public demo
apps/gateway             localhost Hono gateway and SSE endpoint
packages/protocol        shared IR, stream, error and result contracts
packages/core            orchestration, compatibility, transforms, mock runtime
packages/catalog         source-linked providers and model metadata
packages/metrics         TTFT, duration, throughput, usage and validation
packages/adapter-*       seven first-class provider adapters
packages/cli             reproducible experiment CLI
docs                     architecture, security and compatibility notes
fixtures                 public deterministic experiments and responses
marketing                launch drafts and demo script
```

## Security model

Read [`docs/security-model.md`](docs/security-model.md) before enabling live calls. Do not expose the gateway to the network unless you add authentication and understand the provider and prompt-privacy implications. The repository includes secret scanning, CodeQL, dependency review, Dependabot and a public-demo deployment that builds with mock mode enabled.

## Adding a provider

Start with [`docs/adding-a-provider.md`](docs/adding-a-provider.md) and [`docs/writing-an-adapter.md`](docs/writing-an-adapter.md). An adapter must preserve raw provider behavior, expose compatibility warnings, normalize errors and pass the shared contract suite. No paid API calls run in CI.

## Roadmap

See [`ROADMAP.md`](ROADMAP.md). v0.1 focuses on the local-first comparison loop; future work includes dataset runners, human evaluation, more media types and a conformance report.

## Contributing

Issues, compatibility reports and adapter contributions are welcome. Please read [`CONTRIBUTING.md`](CONTRIBUTING.md), [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) and [`SECURITY.md`](SECURITY.md).

If AI SDK Playground helps you understand or debug multi-provider AI APIs, consider starring the repository. It helps other developers discover the project.

## License and independence

Apache-2.0. AI SDK Playground is an independent open-source project by Sam Vale and is not affiliated with Vercel or any model provider.

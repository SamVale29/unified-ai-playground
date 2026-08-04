# Architecture

The workspace is a TypeScript monorepo with a browser-only web app, a local gateway, a provider-neutral core, a source-linked catalog, metrics, seven adapters and a small CLI.

```text
web (mock or gateway client)
  │ protocol / SSE
  ▼
gateway (127.0.0.1, keys + limits + redaction)
  │ adapters
  ├─ OpenAI
  ├─ Anthropic
  ├─ Google Gemini
  ├─ xAI
  ├─ DeepSeek
  ├─ Mistral AI
  └─ OpenRouter
```

`packages/core` owns orchestration, compatibility, transformation reports, deterministic mock mode, timeout and cancellation. It does not import React or vendor SDKs. `packages/protocol` is the boundary that can be reused by another UI, CLI or self-hosted gateway.

The live adapters use `fetch` with provider-specific request builders and response parsers. This keeps the native payload inspectable and makes a later official SDK integration an isolated change.

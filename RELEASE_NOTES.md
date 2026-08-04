# AI SDK Playground v0.1.0 — Multi-provider API comparison

AI SDK Playground is a local-first, provider-neutral lab for understanding how AI APIs differ.

## Included

- seven first-class adapters: OpenAI, Anthropic, Google Gemini, xAI, DeepSeek, Mistral AI and OpenRouter;
- side-by-side mock streaming comparison with TTFT, duration, usage and cost labels;
- normalized and native request inspection, compatibility warnings and strict mode;
- structured-output validation, manual fixture tool calls and a project-owned vision fixture;
- local Hono gateway, SSE protocol, timeout, cancellation, secret redaction and health checks;
- CLI, JSON/Markdown export, import, reproducible experiment snapshots and local privacy controls;
- React/Vite public demo, Apache-2.0 license, CI, CodeQL, dependency review and GitHub Pages workflow.

## Security model

The hosted demo uses simulated fixtures only. Real calls require the local gateway and keys controlled by the user. No analytics or public inference proxy is included.

## Known limitations

The v0.1 live adapters use non-streaming HTTP requests wrapped in the unified event envelope; native SSE parsing, dynamic model discovery, provider-specific pricing refresh and full multimodal upload flows remain follow-up work. See `docs/known-differences.md`.

# Contributing

Thanks for helping improve AI SDK Playground. Keep changes focused and explain provider-specific behavior rather than hiding it behind a generic abstraction.

```bash
pnpm install
pnpm format:check
pnpm lint
pnpm typecheck
pnpm catalog:validate
pnpm test
pnpm build
pnpm security:scan
```

Provider changes need a source link, a compatibility note, a contract test and a fixture that does not use a paid API. Never commit `.env`, keys, private prompts or raw authorization headers.

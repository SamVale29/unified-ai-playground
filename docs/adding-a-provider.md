# Adding a provider

1. Add a source-linked provider and model entry to `packages/catalog/src/index.ts`.
2. Create a first-class `packages/adapter-your-provider` package.
3. Preserve native request and response payloads behind redaction.
4. Map usage, finish reasons, tool calls, structured output and provider errors.
5. Add the package to the gateway and CLI.
6. Run the adapter contract suite with a mock server; never add a paid call to CI.
7. Document differences and add a compatibility source link.

Avoid default production model IDs unless the official source was checked. Unknown is a valid catalog value.

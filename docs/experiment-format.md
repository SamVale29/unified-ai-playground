# Experiment format

Experiments are JSON documents with a schema version, normalized request, two to eight targets, execution policy and privacy policy. A minimal document can be created with:

```bash
pnpm cli -- init experiment.json
```

The same document can be imported into the UI or executed in mock mode with:

```bash
pnpm cli -- validate experiment.json
pnpm cli -- run experiment.json --output result.json
```

Experiment IDs, target IDs, exact model IDs, repetitions, timestamps, adapter versions, metrics, warnings, response status and sanitized raw payloads are kept with results. A result from mock mode is always labeled `mode: "mock"`.

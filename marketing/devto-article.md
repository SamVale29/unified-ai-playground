# A unified AI API is useful, but the differences still matter

## Fragmentation

The same word — message, tool, JSON, reasoning, stream — often hides different semantics across providers.

## Normalization with receipts

An intermediate representation is useful only when lossy conversions remain visible. AI SDK Playground treats the adapter like a compiler: request in, native request out, diagnostics beside the output.

## Streaming and metrics

TTFT, total duration and throughput are attached to event timelines. Missing provider usage remains missing; local estimates are labeled.

## Tools, structured output and safety

The playground never executes tools automatically. JSON mode is not strict schema validation. Refusals and content filters are not connection errors.

## Reproducibility

Every experiment carries an ID, schema version, exact model ID, parameters, target snapshot, privacy policy, metrics and warnings. Public exports are sanitized.

## Local-first release

Mock mode is safe to host. Live providers stay behind the gateway the developer controls.

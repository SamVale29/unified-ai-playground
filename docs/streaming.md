# Streaming

`UnifiedStreamEvent` keeps experiment ID, run ID, target ID, sequence, timestamp and elapsed milliseconds on every event. The mock adapter emits text deltas, reasoning summaries, tool-call deltas, usage and completion events. The gateway forwards events over Server-Sent Events.

Live adapters in v0.1 use a non-streaming request path and emit a normalized event envelope after the provider response arrives. Native streaming parsers are deliberately tracked as adapter work instead of being implied by the common interface.

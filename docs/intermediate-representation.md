# Intermediate Representation

The IR is intentionally explicit rather than flattening every provider into a chat-only shape. Messages retain `system`, `developer`, `user`, `assistant` and `tool` roles. Content parts can carry text, image, file, audio, video, reasoning, refusal, tool call and tool result data.

Every run records the normalized request plus the adapter transformation. A transformation contains:

- `applied`: fields mapped directly;
- `omitted`: fields not sent and why;
- `approximated`: fields represented with a different provider value;
- `warnings`: compatibility or semantic caveats;
- `nativeRequest`: the final provider-shaped payload, redacted before display.

Strict mode blocks declared unsupported features. Lenient mode runs what can be represented and keeps every omission in the report.

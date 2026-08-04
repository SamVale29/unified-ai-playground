# Provider compatibility matrix

This matrix is generated from the checked-in catalog and adapter contract. `unknown` is not treated as `false`. “Partial” means model- or endpoint-dependent and requires inspection of the native request.

Catalog check date: **2026-08-03**.

| Feature             | OpenAI                    | Anthropic               | Google                         | xAI                       | DeepSeek                  | Mistral                   | OpenRouter                |
| ------------------- | ------------------------- | ----------------------- | ------------------------------ | ------------------------- | ------------------------- | ------------------------- | ------------------------- |
| Text                | Native                    | Native                  | Native                         | Native                    | Native                    | Native                    | Native                    |
| System instructions | Native                    | Native via `system`     | Native via `systemInstruction` | Native/endpoint-dependent | Native/endpoint-dependent | Native/endpoint-dependent | Native/endpoint-dependent |
| Developer role      | Native/endpoint-dependent | Adapted                 | Adapted                        | Native/endpoint-dependent | Native/endpoint-dependent | Native/endpoint-dependent | Native/endpoint-dependent |
| Image input         | Model-dependent           | Model-dependent         | Model-dependent                | Unknown                   | Unknown                   | Partial                   | Partial                   |
| Streaming           | Adapter contract          | Adapter contract        | Adapter contract               | Adapter contract          | Adapter contract          | Adapter contract          | Adapter contract          |
| Tools               | Partial/model-dependent   | Partial/model-dependent | Partial/model-dependent        | Partial/model-dependent   | Partial/model-dependent   | Partial/model-dependent   | Partial/model-dependent   |
| JSON mode           | Partial                   | Partial                 | Partial                        | Partial                   | Partial                   | Partial                   | Partial                   |
| Strict JSON Schema  | Partial/model-dependent   | Partial/model-dependent | Partial/model-dependent        | Partial/model-dependent   | Partial/model-dependent   | Partial/model-dependent   | Partial/model-dependent   |
| Reasoning controls  | Unknown/model-dependent   | Partial/model-dependent | Unknown/model-dependent        | Unknown/model-dependent   | Partial/model-dependent   | Unknown/model-dependent   | Unknown/model-dependent   |
| Seed                | Partial                   | Partial                 | Partial                        | Partial                   | Partial                   | Partial                   | Partial                   |
| Provider cost       | Unknown unless returned   | Unknown unless returned | Unknown unless returned        | Unknown unless returned   | Unknown unless returned   | Unknown unless returned   | Unknown unless returned   |
| Cancellation        | Local abort boundary      | Local abort boundary    | Local abort boundary           | Local abort boundary      | Local abort boundary      | Local abort boundary      | Local abort boundary      |

Sources are kept in [`packages/catalog/src/index.ts`](../packages/catalog/src/index.ts) and link to official provider documentation. The v0.1 live path uses non-streaming HTTP requests followed by a normalized stream envelope; mock mode exercises real-time deltas deterministically. This distinction is intentional and documented.

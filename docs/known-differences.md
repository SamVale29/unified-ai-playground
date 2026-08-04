# Known differences

AI SDK Playground does not claim that the seven APIs are equivalent. The following differences remain visible by design:

## Roles and content

Anthropic receives system and developer instructions through the Messages API system field. Google receives them as `systemInstruction`. OpenAI-compatible adapters keep roles in a chat-completion message array where the endpoint accepts them. Non-text content is preserved in the IR and may become a provider-native content block, a URL note, or an explicit warning.

## Streaming

The unified event contract has started, delta, usage, warning, error and completed events. Mock mode emits deterministic text and tool-call deltas. The v0.1 live gateway calls providers through a non-streaming fetch path and wraps the normalized response in the event contract; provider-native SSE parsing is a follow-up adapter task.

## Tools and structured output

Function tools, Anthropic tool use and Gemini function declarations have different shapes. The adapter preserves the original arguments and never executes tools automatically. JSON mode is not treated as strict schema validation: the response is parsed and locally checked, while the raw text remains available.

## Reasoning and safety

Reasoning metadata is only exposed when a provider returns it. The mock fixture marks its reasoning summary as simulated. Refusals and content filters are represented separately from connection and request errors when the provider exposes enough information.

## Usage and cost

Provider usage is labeled `provider`; local estimates are labeled `estimated`; missing values are `unavailable`. A provider-reported cost is never overwritten by the catalog estimate. The catalog intentionally leaves prices unknown when it cannot verify them from a current source.

## OpenRouter routing

The requested model, executed model and routing/provider metadata can differ. The adapter keeps raw routing metadata rather than presenting `openrouter/auto` as one fixed model.

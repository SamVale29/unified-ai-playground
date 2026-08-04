# Launch post — English

AI APIs are fragmented in ways a final text answer cannot show. A “compatible” endpoint may change roles, tool schemas, JSON guarantees, streaming events, usage accounting or finish reasons.

AI SDK Playground is an open-source, local-first lab that runs one normalized experiment across OpenAI, Anthropic, Google Gemini, xAI, DeepSeek, Mistral AI and OpenRouter. It shows the request the user wrote, the normalized IR, the adapter transformations, the native payload and the normalized/raw responses side by side.

The public demo is safe by design: deterministic mock providers, no API keys and no inference proxy. Real calls run through a gateway on the developer's machine. The project welcomes provider adapters, compatibility reports and reproducible fixtures.

The goal is not to declare a winner. It is to make differences measurable and explainable.

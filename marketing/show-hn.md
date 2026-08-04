# Show HN: AI SDK Playground — compare seven AI providers side by side

AI SDK Playground is a local-first open-source lab for comparing AI APIs without pretending they are equivalent.

The core idea is an independent Intermediate Representation. For each target, the app records the normalized request, native request, applied/omitted/approximated fields, compatibility warnings, stream events, usage, cost labels, errors and raw response.

The public demo uses mock providers only. It cannot receive API keys. Real calls run in a localhost gateway controlled by the user.

The v0.1 live path focuses on a safe fetch contract and normalized event envelope; mock mode demonstrates real-time streaming, tool calls and structured-output validation. I would love feedback on provider semantics, adapter boundaries and the comparison UX.

# Writing an adapter

Use the `ProviderAdapter` contract from `@ai-sdk-playground/protocol`. A good adapter has four clear layers: compatibility, transformation, transport and normalization. It should be possible to inspect the native payload without reading secrets.

The shared runtime already provides timeout-aware fetch, redaction, error mapping and a normalized event envelope. Provider packages supply endpoint URLs, headers, request builders and response parsers. Keep provider-only options under `request.providerOptions[providerId]` so they cannot leak to another adapter.

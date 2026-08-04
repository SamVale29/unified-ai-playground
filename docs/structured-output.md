# Structured output

The output editor accepts JSON mode or a small JSON Schema. The adapter maps it to a provider-native option when available and records an omission or adaptation otherwise. The result keeps raw text, parsed value, JSON validity, schema validity and validation errors separately.

Malformed JSON is not silently repaired. A later optional repair flow must show the original and repaired values and must not count the original as valid.

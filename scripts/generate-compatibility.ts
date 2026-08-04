import { MODEL_CATALOG, PROVIDER_CATALOG } from '@ai-sdk-playground/catalog';
import { writeFile } from 'node:fs/promises';

async function main() {
  const rows = PROVIDER_CATALOG.map((provider) => {
    const model = MODEL_CATALOG.find((item) => item.providerId === provider.id);
    return {
      provider: provider.id,
      model: model?.apiModelId ?? provider.defaultModelId,
      source: model?.source ?? { url: provider.modelsUrl, checkedAt: '2026-08-03' },
    };
  });
  await writeFile(
    'fixtures/providers/catalog-snapshot.json',
    JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2),
    'utf8',
  );
  console.log(`Generated ${rows.length} provider catalog rows.`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

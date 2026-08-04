import { validateCatalog } from '@ai-sdk-playground/catalog';

const errors = validateCatalog();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Catalog valid: source URLs and checked dates are present.');
}

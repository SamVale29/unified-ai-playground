import { mkdir } from 'node:fs/promises';

void mkdir('.artifacts', { recursive: true }).then(() => {
  console.log('Package destination ready. Use pnpm pack:check to inspect workspace tarballs.');
});

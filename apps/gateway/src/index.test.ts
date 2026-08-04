import { app } from './index';

describe('gateway integration', () => {
  it('exposes health and catalog endpoints without provider keys', async () => {
    const health = await app.request('/health');
    expect(health.status).toBe(200);
    expect((await health.json()).ok).toBe(true);
    const providers = await app.request('/api/providers');
    const payload = (await providers.json()) as { providers: Array<{ credentialStatus: string }> };
    expect(payload.providers).toHaveLength(7);
    expect(
      payload.providers.every((provider) => ['configured', 'missing'].includes(provider.credentialStatus)),
    ).toBe(true);
  });
});

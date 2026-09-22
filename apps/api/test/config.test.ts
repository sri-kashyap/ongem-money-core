import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('parses a valid environment with defaults', () => {
    const config = loadConfig({ DATABASE_URL: 'postgres://u:p@localhost:5432/ongem' });
    expect(config).toMatchObject({ env: 'development', port: 3000, version: 'dev' });
  });

  it('shortens the Render commit SHA for the version', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgres://u:p@localhost:5432/ongem',
      RENDER_GIT_COMMIT: 'abcdef1234567890',
    });
    expect(config.version).toBe('abcdef1');
  });

  it('fails on invalid config without echoing secret values', () => {
    const secret = 'not-a-url-but-a-secret-password';
    expect(() => loadConfig({ DATABASE_URL: secret })).toThrow(/DATABASE_URL/);
    expect(() => loadConfig({ DATABASE_URL: secret })).not.toThrow(new RegExp(secret));
  });
});

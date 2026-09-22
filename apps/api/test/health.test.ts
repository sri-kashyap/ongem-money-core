import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createPool, type Db } from '../src/db.js';

const config = { logLevel: 'silent', version: 'test', env: 'test' } as const;

describe('health endpoints without a database', () => {
  // Port 1 on localhost refuses connections: simulates a database outage.
  const db = createPool('postgres://user:pass@127.0.0.1:1/none');
  const app = buildApp({ config, db });

  afterAll(async () => {
    await app.close();
    await db.end();
  });

  it('GET /healthz is 200 even when the database is down (liveness ignores dependencies)', async () => {
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', version: 'test' });
  });

  it('GET /readyz is 503 when the database is unreachable', async () => {
    const res = await app.inject({ method: 'GET', url: '/readyz' });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ status: 'unavailable', checks: { database: 'fail' } });
  });

  it('generates a request ID and returns it in the response header', async () => {
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('propagates a well-formed caller request ID', async () => {
    const res = await app.inject({ method: 'GET', url: '/healthz', headers: { 'x-request-id': 'corr-12345678' } });
    expect(res.headers['x-request-id']).toBe('corr-12345678');
  });

  it('replaces a malformed caller request ID instead of logging it', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/healthz',
      headers: { 'x-request-id': 'bad id\nwith newline' },
    });
    expect(res.headers['x-request-id']).not.toContain('bad');
  });

  it('unknown routes return problem+json 404 with the request ID', async () => {
    const res = await app.inject({ method: 'GET', url: '/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json()).toMatchObject({ status: 404, requestId: res.headers['x-request-id'] });
  });
});

describe('health endpoints with a real database', () => {
  // Undefined if beforeAll fails (e.g. Docker unavailable), so cleanup must tolerate that.
  let container: StartedPostgreSqlContainer | undefined;
  let db: Db | undefined;
  let app: ReturnType<typeof buildApp> | undefined;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    db = createPool(container.getConnectionUri());
    app = buildApp({ config, db });
  });

  afterAll(async () => {
    await app?.close();
    await db?.end();
    await container?.stop();
  });

  it('GET /readyz is 200 when the database answers', async () => {
    if (!app) throw new Error('app not started');
    const res = await app.inject({ method: 'GET', url: '/readyz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ready', version: 'test', checks: { database: 'ok' } });
  });
});

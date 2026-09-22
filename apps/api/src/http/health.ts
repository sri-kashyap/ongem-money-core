import type { FastifyPluginAsync } from 'fastify';
import { pingDb, type Db } from '../db.js';

type HealthOptions = { db: Db; version: string };

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugins must be async or take a callback
export const healthRoutes: FastifyPluginAsync<HealthOptions> = async (app, { db, version }) => {
  // Liveness: the process is up and serving. Never touches dependencies,
  // so a database outage doesn't make the platform restart healthy instances.
  app.get('/healthz', () => ({ status: 'ok', service: 'ongem', version }));

  // Readiness: we can do useful work, i.e. the database answers.
  app.get('/readyz', async (req, reply) => {
    try {
      await pingDb(db);
      return { status: 'ready', version, checks: { database: 'ok' } };
    } catch (err) {
      req.log.error({ err }, 'readiness check failed: database unreachable');
      return reply.code(503).send({ status: 'unavailable', version, checks: { database: 'fail' } });
    }
  });
};

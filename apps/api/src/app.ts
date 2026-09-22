import { randomUUID } from 'node:crypto';
import Fastify, { LogController, type FastifyInstance } from 'fastify';
import type { Config } from './config.js';
import type { Db } from './db.js';
import { healthRoutes } from './http/health.js';

const REQUEST_ID_HEADER = 'x-request-id';
// Accept a caller's request ID only if it looks sane, so logs can't be polluted or bloated.
const VALID_REQUEST_ID = /^[A-Za-z0-9._-]{8,128}$/;

type AppDeps = { config: Pick<Config, 'logLevel' | 'version' | 'env'>; db: Db };

export function buildApp({ config, db }: AppDeps): FastifyInstance {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      base: { service: 'ongem-api', version: config.version, env: config.env },
      redact: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["x-signature"]'],
    },
    logController: new LogController({
      requestIdLogLabel: 'requestId',
      // The platform polls liveness every few seconds; logging it would drown real traffic.
      disableRequestLogging: (req: { url?: string }) => req.url === '/healthz',
    }),
    genReqId: (req) => {
      const incoming = req.headers[REQUEST_ID_HEADER];
      return typeof incoming === 'string' && VALID_REQUEST_ID.test(incoming) ? incoming : randomUUID();
    },
  });

  app.addHook('onSend', async (req, reply) => {
    reply.header(REQUEST_ID_HEADER, req.id);
  });

  app.setErrorHandler((err: unknown, req, reply) => {
    const { status, message, code } = describeError(err);
    if (status >= 500) req.log.error({ err }, 'unhandled error');
    else req.log.warn({ err: { message, code } }, 'request error');
    return reply
      .code(status)
      .type('application/problem+json')
      .send({
        type: 'about:blank',
        // Never expose internal error messages for 5xx.
        title: status >= 500 ? 'Internal Server Error' : message,
        status,
        requestId: req.id,
      });
  });

  app.setNotFoundHandler((req, reply) =>
    reply
      .code(404)
      .type('application/problem+json')
      .send({ type: 'about:blank', title: 'Not Found', status: 404, requestId: req.id }),
  );

  void app.register(healthRoutes, { db, version: config.version });

  return app;
}

function describeError(err: unknown): { status: number; message: string; code: string | undefined } {
  if (err instanceof Error) {
    const { statusCode, code } = err as Error & { statusCode?: unknown; code?: unknown };
    const status =
      typeof statusCode === 'number' && statusCode >= 400 && statusCode < 600 ? statusCode : 500;
    return { status, message: err.message, code: typeof code === 'string' ? code : undefined };
  }
  return { status: 500, message: 'Unknown error', code: undefined };
}

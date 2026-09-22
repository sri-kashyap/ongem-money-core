import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.url(),
  // Render sets RENDER_GIT_COMMIT on every deploy; fall back to "dev" locally.
  RENDER_GIT_COMMIT: z.string().default('dev'),
});

export type Config = {
  env: 'development' | 'test' | 'production';
  port: number;
  host: string;
  logLevel: z.infer<typeof EnvSchema>['LOG_LEVEL'];
  databaseUrl: string;
  version: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    // Name the bad keys but never echo values: they may be secrets.
    const keys = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Invalid environment configuration: ${keys}`);
  }
  const e = parsed.data;
  return {
    env: e.NODE_ENV,
    port: e.PORT,
    host: e.HOST,
    logLevel: e.LOG_LEVEL,
    databaseUrl: e.DATABASE_URL,
    version: e.RENDER_GIT_COMMIT.slice(0, 7),
  };
}

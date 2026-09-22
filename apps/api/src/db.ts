import pg from 'pg';

export type Db = pg.Pool;

export function createPool(databaseUrl: string): Db {
  return new pg.Pool({
    connectionString: databaseUrl,
    max: 10,
    // Fail fast rather than hang: health checks and card auths have tight budgets.
    connectionTimeoutMillis: 2_000,
    idleTimeoutMillis: 30_000,
    statement_timeout: 5_000,
  });
}

export async function pingDb(db: Db): Promise<void> {
  await db.query('SELECT 1');
}

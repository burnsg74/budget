import { Pool, types, type QueryResultRow } from "pg";

types.setTypeParser(1082, (value) => value);
types.setTypeParser(20, (value) => Number(value));

const globalForPg = globalThis as typeof globalThis & { budgetPool?: Pool };

export function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  if (!globalForPg.budgetPool) {
    globalForPg.budgetPool = new Pool({ connectionString });
  }

  return globalForPg.budgetPool;
}

export async function query<T extends QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(text, params);
  return result.rows;
}

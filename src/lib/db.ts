import postgres from "postgres";

export type Sql = postgres.Sql<Record<string, never>>;

type GlobalWithDb = typeof globalThis & { __vintageSql?: Sql };

function needsSsl(url: string): boolean {
  return (
    /sslmode=require/i.test(url) ||
    /neon\.tech/i.test(url) ||
    /supabase\.(co|com)/i.test(url) ||
    /render\.com/i.test(url)
  );
}

export function createDb(url: string): Sql {
  return postgres(url, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false,
    ssl: needsSsl(url) ? "require" : undefined,
    onnotice: () => {},
  }) as unknown as Sql;
}

export function getDb(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and provide a Postgres URL.",
    );
  }
  const globalWithDb = globalThis as GlobalWithDb;
  if (!globalWithDb.__vintageSql) {
    globalWithDb.__vintageSql = createDb(url);
  }
  return globalWithDb.__vintageSql;
}

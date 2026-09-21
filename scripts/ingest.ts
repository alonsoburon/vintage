import "./load-env";
import { getSourceCredentials } from "../src/lib/config";
import { addDays } from "../src/lib/dates";
import { createDb } from "../src/lib/db";
import { ingestAll } from "../src/lib/ingest";
import { runMigrations } from "../src/lib/migrate";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Add it to .env.local.");
    process.exit(1);
  }

  const today = new Date().toISOString().slice(0, 10);
  const from = process.env.INGEST_FROM ?? addDays(today, -90);

  const sql = createDb(url);
  try {
    await runMigrations(sql);
    const results = await ingestAll(sql, {
      from,
      credentials: getSourceCredentials(),
    });

    for (const result of results) {
      const status = result.error ? "✗" : "✓";
      console.log(
        `${status} ${result.seriesId.padEnd(10)} inserted=${result.inserted}` +
          ` revisions=${result.revisions} unchanged=${result.unchanged}` +
          (result.error ? ` error=${result.error}` : ""),
      );
    }
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

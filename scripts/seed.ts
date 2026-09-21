import "./load-env";
import { createDb } from "../src/lib/db";
import { seriesToRecord } from "../src/lib/ingest";
import { runMigrations } from "../src/lib/migrate";
import { upsertSeries } from "../src/lib/queries";
import { SERIES } from "../src/lib/series";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Add it to .env.local.");
    process.exit(1);
  }

  const sql = createDb(url);
  try {
    await runMigrations(sql);
    for (const definition of SERIES) {
      await upsertSeries(sql, seriesToRecord(definition));
      console.log(`synced series ${definition.id}`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

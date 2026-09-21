import "./load-env";
import {
  getSourceCredentials,
  SERIES_BACKFILL_START,
} from "../src/lib/config";
import { createDb } from "../src/lib/db";
import { ingestAll } from "../src/lib/ingest";
import { runMigrations } from "../src/lib/migrate";
import type { SourceName } from "../src/lib/sources";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Add it to .env.local.");
    process.exit(1);
  }

  const credentials = getSourceCredentials();
  const from = process.env.BACKFILL_FROM ?? SERIES_BACKFILL_START;
  const prefer = process.env.BACKFILL_SOURCE as SourceName | undefined;

  console.log(
    `Backfilling from ${from}` +
      ` (BCCh credentials: ${credentials.token || credentials.user ? "yes" : "no"})`,
  );

  const sql = createDb(url);
  try {
    await runMigrations(sql);
    const results = await ingestAll(sql, { from, credentials, prefer });

    let totalInserted = 0;
    for (const result of results) {
      totalInserted += result.inserted;
      if (result.error) {
        console.error(`✗ ${result.seriesId.padEnd(10)} ${result.error}`);
      } else {
        console.log(
          `✓ ${result.seriesId.padEnd(10)} source=${String(result.source).padEnd(10)}` +
            ` fetched=${String(result.fetched).padStart(5)}` +
            ` inserted=${String(result.inserted).padStart(5)}` +
            ` revisions=${result.revisions} unchanged=${result.unchanged}`,
        );
      }
    }
    console.log(`\nDone. Inserted ${totalInserted} observation rows.`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

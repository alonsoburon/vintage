import "./load-env";
import { createDb } from "../src/lib/db";
import { runMigrations } from "../src/lib/migrate";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Add it to .env.local.");
    process.exit(1);
  }

  const sql = createDb(url);
  try {
    await runMigrations(sql);
    console.log("Migrations applied.");
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

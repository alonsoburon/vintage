import type { Sql } from "./db";
import { MIGRATIONS } from "./migrations";

export async function runMigrations(sql: Sql): Promise<void> {
  for (const statement of MIGRATIONS) {
    await sql.unsafe(statement);
  }
}

import { existsSync } from "node:fs";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) {
    try {
      (process as NodeJS.Process & {
        loadEnvFile?: (path: string) => void;
      }).loadEnvFile?.(file);
    } catch {
      // ignore
    }
  }
}

if (!process.env.TEST_DATABASE_URL && process.env.DATABASE_URL) {
  process.env.TEST_DATABASE_URL = process.env.DATABASE_URL;
}

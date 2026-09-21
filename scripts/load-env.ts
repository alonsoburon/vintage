import { existsSync } from "node:fs";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) {
    try {
      (process as NodeJS.Process & {
        loadEnvFile?: (path: string) => void;
      }).loadEnvFile?.(file);
    } catch {
      // ignore malformed or unreadable env files
    }
  }
}

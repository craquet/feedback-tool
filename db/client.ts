import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

export type AppDb = BetterSQLite3Database<typeof schema> & {
  $client: Database.Database;
};

export type Db = { db: AppDb; sqlite: Database.Database };

export function createDb(filePath: string): Db {
  if (filePath !== ":memory:") {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  const sqlite = new Database(filePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema }) as AppDb;
  migrate(db, {
    migrationsFolder: path.resolve(process.cwd(), "drizzle"),
  });
  return { db, sqlite };
}

let cached: Db | null = null;

export function getDb(): AppDb {
  if (!cached) {
    cached = createDb(process.env.DB_PATH ?? "data/feedback.db");
  }
  return cached.db;
}

export function closeDb(): void {
  if (cached) {
    cached.sqlite.close();
    cached = null;
  }
}

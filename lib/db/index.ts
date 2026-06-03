import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { SCHEMA_SQL } from "./schema";

const DB_PATH = path.join(process.cwd(), "data", "crm.db");

declare global {
  var __crmDb: Database.Database | undefined;
}

function createDatabase(): Database.Database {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const database = new Database(DB_PATH);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.exec(SCHEMA_SQL);
  return database;
}

export function getDb(): Database.Database {
  if (process.env.NODE_ENV === "production") {
    if (!global.__crmDb) {
      global.__crmDb = createDatabase();
    }
    return global.__crmDb;
  }

  if (!global.__crmDb) {
    global.__crmDb = createDatabase();
  }
  return global.__crmDb;
}

export function nowIso(): string {
  return new Date().toISOString();
}

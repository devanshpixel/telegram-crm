/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
import path from "path";

export interface DbResult {
  changes: number;
  lastInsertRowid: number;
}

export interface AsyncStatement {
  get(...args: any[]): Promise<any>;
  all(...args: any[]): Promise<any[]>;
  run(...args: any[]): Promise<DbResult>;
}

export interface AsyncDb {
  prepare(sql: string): AsyncStatement;
  exec(sql: string): Promise<void>;
  transaction<T>(fn: () => T | Promise<T>): () => Promise<T>;
  close(): Promise<void>;
}

export function createRawBetterSqlite3(dbPath: string): any {
  const Database = require("better-sqlite3");
  const fs = require("fs");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db: any = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

export function wrapBetterSqlite3(db: any): AsyncDb {
  return {
    prepare(sql: string): AsyncStatement {
      const stmt = db.prepare(sql);
      return {
        get(...args: any[]): Promise<any> {
          return Promise.resolve(stmt.get(...args));
        },
        all(...args: any[]): Promise<any[]> {
          return Promise.resolve(stmt.all(...args));
        },
        run(...args: any[]): Promise<DbResult> {
          const r = stmt.run(...args);
          return Promise.resolve({
            changes: r.changes,
            lastInsertRowid: Number(r.lastInsertRowid),
          });
        },
      };
    },
    exec(sql: string): Promise<void> {
      db.exec(sql);
      return Promise.resolve();
    },
    transaction<T>(fn: () => T | Promise<T>): () => Promise<T> {
      return async () => {
        db.exec("BEGIN");
        try {
          const result = await fn();
          db.exec("COMMIT");
          return result;
        } catch (e) {
          db.exec("ROLLBACK");
          throw e;
        }
      };
    },
    close(): Promise<void> {
      db.close();
      return Promise.resolve();
    },
  };
}

export function createBetterSqlite3Async(dbPath: string): AsyncDb {
  return wrapBetterSqlite3(createRawBetterSqlite3(dbPath));
}

export function createTursoAsync(url: string, authToken?: string): AsyncDb {
  const { createClient } = require("@libsql/client");
  const client = createClient({ url, authToken });
  let currentTx: { execute: (q: any) => any; executeMultiple: (s: string) => any } | null = null;
  function execTarget() {
    if (currentTx) {
      return { execute: (q: any) => currentTx!.execute(q), executeMultiple: (s: string) => currentTx!.executeMultiple(s) };
    }
    return { execute: (q: any) => client.execute(q), executeMultiple: (s: string) => client.executeMultiple(s) };
  }
  return {
    prepare(sql: string): AsyncStatement {
      return {
        async get(...args: any[]): Promise<any> {
          const r = await execTarget().execute({ sql, args });
          return r.rows[0];
        },
        async all(...args: any[]): Promise<any[]> {
          const r = await execTarget().execute({ sql, args });
          return r.rows;
        },
        async run(...args: any[]): Promise<DbResult> {
          const r = await execTarget().execute({ sql, args });
          return {
            changes: Number(r.rowsAffected),
            lastInsertRowid: r.lastInsertRowid ? Number(r.lastInsertRowid) : 0,
          };
        },
      };
    },
    async exec(sql: string): Promise<void> {
      await execTarget().executeMultiple(sql);
    },
    transaction<T>(fn: () => T | Promise<T>): () => Promise<T> {
      return async () => {
        const tx = await client.transaction("write");
        currentTx = tx;
        try {
          const result = await fn();
          await tx.commit();
          return result;
        } catch (e) {
          await tx.rollback();
          throw e;
        } finally {
          currentTx = null;
        }
      };
    },
    async close(): Promise<void> {
      client.close();
    },
  };
}

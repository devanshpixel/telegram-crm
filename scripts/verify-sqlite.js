/**
 * Ensures better-sqlite3 native bindings match the current Node.js ABI.
 * Soft-fail: warns on failure because production uses Turso, not better-sqlite3.
 */
const { versions } = process;

function tryLoad() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3");
  const db = new Database(":memory:");
  db.close();
}

try {
  tryLoad();
  console.log(
    `better-sqlite3 OK (Node ${process.version}, ABI ${versions.modules})`,
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.warn("\nbetter-sqlite3 native binding failed to load (non-fatal, production uses Turso).\n");
  console.warn(message);
  console.warn(
    `\nCurrent Node: ${process.version} (ABI ${versions.modules})`,
  );
  console.warn("\nTo fix locally:");
  console.warn("  1. Use one Node version everywhere (see .nvmrc)");
  console.warn("  2. npm run db:rebuild");
  console.warn("  3. Or: rm -r node_modules && npm install\n");
}

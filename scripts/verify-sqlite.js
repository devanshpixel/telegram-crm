/**
 * Ensures better-sqlite3 native bindings match the current Node.js ABI.
 * Fails fast with a clear message instead of ERR_DLOPEN_FAILED at runtime.
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
  console.error("\nbetter-sqlite3 native binding failed to load.\n");
  console.error(message);
  console.error(
    `\nCurrent Node: ${process.version} (ABI ${versions.modules})`,
  );
  console.error(
    "This usually means dependencies were installed with a different Node version.",
  );
  console.error("\nFix (run in this project folder):");
  console.error("  1. Use one Node version everywhere (see .nvmrc)");
  console.error("  2. npm run db:rebuild");
  console.error("  3. Or: rm -r node_modules && npm install\n");
  process.exit(1);
}

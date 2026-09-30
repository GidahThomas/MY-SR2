/* =========================================================
   USIAMS - tests/run.js
   Starts the server on a test port, runs every suite against it
   and shuts it down again.

   Usage: npm test

   The suites run against their own database - DB_NAME with "_test"
   appended (or TEST_DB_NAME) - which is rebuilt from scratch on every
   run and loaded with the demo data and the demo sign-in accounts. The
   real database is never touched.
   ========================================================= */
const { spawn, spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const PORT = Number(process.env.TEST_PORT || 3399);
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = path.join(__dirname, "..");
const { config } = require("../config");

const TEST_DB = process.env.TEST_DB_NAME || `${config.db.database}_test`;
if (TEST_DB === config.db.database) {
  console.error("USIAMS: the test database must not be the application database.");
  process.exit(1);
}
// Every child process - server, seeder, suites - works on the test database.
const TEST_ENV = { ...process.env, DB_NAME: TEST_DB };

const SUITES = [
  "api.test.js", "shapes.test.js", "frontend.test.js",
  "notifications.test.js", "permissions.test.js", "registration.test.js", "pages.test.js", "interactions.test.js"
];

function runNode(args, what) {
  const result = spawnSync(process.execPath, args, { cwd: ROOT, env: TEST_ENV, stdio: "pipe" });
  if (result.status !== 0) {
    throw new Error(`could not ${what}: ` + String(result.stderr || result.stdout).slice(0, 300));
  }
}

/** Creates the test database and its tables from scratch. */
function buildTestDatabase() {
  runNode([path.join(ROOT, "db", "run-sql.js"), "db/schema.sql", "db/migration-full-app.sql"],
    `build the test database ${TEST_DB}`);
}

/**
 * Reloads the demo dataset, with the demo sign-in accounts the suites use.
 * The suites write to the database - the interactions suite in particular
 * presses real buttons - so each one starts from the same known state
 * instead of inheriting the last one's edits.
 */
function reseed() {
  runNode([path.join(ROOT, "db", "seed-from-data.js"), "--with-demo-accounts"], "reseed the test database");
}

function waitForServer(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    (async function attempt() {
      try {
        const response = await fetch(BASE + "/api/health");
        const body = await response.json();
        if (body.database === "connected") return resolve();
        return reject(new Error("The API started but the database is unavailable. Check MySQL and your .env settings."));
      } catch {
        if (Date.now() > deadline) return reject(new Error("The server did not start within " + timeoutMs + "ms."));
        setTimeout(attempt, 250);
      }
    })();
  });
}

(async () => {
  try {
    buildTestDatabase();
  } catch (error) {
    console.error("USIAMS:", error.message);
    process.exit(1);
  }

  const server = spawn(process.execPath, [path.join(ROOT, "server.js")], {
    cwd: ROOT,
    // Timetable reminders would add notifications mid-run and change the
    // counts the suites check.
    env: { ...TEST_ENV, PORT: String(PORT), REMINDERS: "off" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let serverLog = "";
  server.stdout.on("data", chunk => { serverLog += chunk; });
  server.stderr.on("data", chunk => { serverLog += chunk; });

  let failed = 0;
  try {
    await waitForServer();
    console.log(`USIAMS tests running against ${BASE} (database ${TEST_DB})\n`);
    for (const suite of SUITES) {
      const file = path.join(__dirname, suite);
      if (!fs.existsSync(file)) { console.log(`SKIP ${suite} (missing)`); continue; }
      console.log("=".repeat(60));
      console.log(suite);
      console.log("=".repeat(60));
      reseed();
      const result = spawnSync(process.execPath, [file], {
        cwd: ROOT,
        env: { ...TEST_ENV, BASE },
        stdio: "inherit"
      });
      if (result.status !== 0) failed++;
      console.log("");
    }
  } catch (error) {
    console.error("USIAMS: could not run the test suites:", error.message);
    if (serverLog.trim()) console.error(serverLog.trim());
    failed++;
  } finally {
    server.kill();
    // With USIAMS_AUDIT_WRITES=1 the server logs every write; keep that log.
    if (process.env.USIAMS_AUDIT_LOG) fs.writeFileSync(process.env.USIAMS_AUDIT_LOG, serverLog);
  }

  if (failed) {
    console.error(`FAILED: ${failed} suite(s) reported failures.`);
    process.exit(1);
  }
  console.log("All suites passed.");
})();

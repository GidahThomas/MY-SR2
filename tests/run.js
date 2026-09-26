/* =========================================================
   USIAMS - tests/run.js
   Starts the server on a test port, runs every suite against it
   and shuts it down again.

   Usage: npm test

   The suites exercise the live database, so run `npm run db:seed`
   first if the data has drifted. They create and then remove their
   own records; they do not depend on being run in any order.
   ========================================================= */
const { spawn, spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const PORT = Number(process.env.TEST_PORT || 3399);
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = path.join(__dirname, "..");

const SUITES = [
  "api.test.js", "shapes.test.js", "frontend.test.js",
  "notifications.test.js", "registration.test.js", "pages.test.js", "interactions.test.js"
];

/**
 * Reloads the demo dataset. The suites write to the live database - the
 * interactions suite in particular presses real buttons - so each one
 * starts from the same known state instead of inheriting the last one's
 * edits. Without this, one suite deactivating an account made every later
 * sign-in fail.
 */
function reseed() {
  const result = spawnSync(process.execPath, [path.join(ROOT, "db", "seed-from-data.js")], {
    cwd: ROOT, env: process.env, stdio: "pipe"
  });
  if (result.status !== 0) {
    throw new Error("could not reseed the database: " + String(result.stderr || result.stdout).slice(0, 300));
  }
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
  const server = spawn(process.execPath, [path.join(ROOT, "server.js")], {
    cwd: ROOT,
    // Timetable reminders would add notifications mid-run and change the
    // counts the suites check.
    env: { ...process.env, PORT: String(PORT), REMINDERS: "off" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let serverLog = "";
  server.stdout.on("data", chunk => { serverLog += chunk; });
  server.stderr.on("data", chunk => { serverLog += chunk; });

  let failed = 0;
  try {
    await waitForServer();
    console.log(`USIAMS tests running against ${BASE}\n`);
    for (const suite of SUITES) {
      const file = path.join(__dirname, suite);
      if (!fs.existsSync(file)) { console.log(`SKIP ${suite} (missing)`); continue; }
      console.log("=".repeat(60));
      console.log(suite);
      console.log("=".repeat(60));
      reseed();
      const result = spawnSync(process.execPath, [file], {
        cwd: ROOT,
        env: { ...process.env, BASE },
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
    // Leave the database as the demo dataset, not as the last suite left it:
    // the interactions suite presses real Deactivate buttons, which otherwise
    // left demo accounts unable to sign in after every test run.
    try { reseed(); } catch (error) { console.error("USIAMS:", error.message); }
  }

  if (failed) {
    console.error(`FAILED: ${failed} suite(s) reported failures.`);
    process.exit(1);
  }
  console.log("All suites passed.");
})();

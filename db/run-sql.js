/* =========================================================
   USIAMS - db/run-sql.js
   Executes a .sql file against the configured MySQL/MariaDB
   server. Replaces the `mysql -u root -p < file.sql` shell
   command from db/README.md for environments (XAMPP on Windows,
   most notably) where the mysql client is not on PATH.

   Usage: node db/run-sql.js db/schema.sql [db/migration-full-app.sql ...]
   ========================================================= */
const fs = require("node:fs");
const path = require("node:path");
const mysql = require("mysql2/promise");
const { config } = require("../config");

// Statements that create or drop the database itself must run before a
// database is selected, so the connection starts without one.
// The .sql files name the default database, "university"; they are applied
// to DB_NAME instead, so a different database (the test suite's, say) works.
async function runFile(connection, file) {
  const database = config.db.database.replace(/`/g, "");
  const sql = fs.readFileSync(file, "utf8")
    .replace(/\b(CREATE DATABASE IF NOT EXISTS|DROP DATABASE IF EXISTS|USE)\s+university\b/gi, (_, statement) => `${statement} \`${database}\``);
  await connection.query(sql);
  console.log(`  applied ${path.relative(process.cwd(), file)}`);
}

async function main() {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error("Usage: node db/run-sql.js <file.sql> [...]");
    process.exit(1);
  }

  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    multipleStatements: true
  });

  try {
    console.log(`USIAMS: connected to ${config.db.host}:${config.db.port} as ${config.db.user}`);
    for (const file of files) {
      const resolved = path.resolve(process.cwd(), file);
      if (!fs.existsSync(resolved)) throw new Error(`SQL file not found: ${file}`);
      await runFile(connection, resolved);
    }
    console.log("USIAMS: SQL applied successfully.");
  } finally {
    await connection.end();
  }
}

main().catch(error => {
  console.error("USIAMS: SQL execution failed:", error.message);
  process.exit(1);
});

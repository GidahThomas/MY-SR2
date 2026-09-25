/* =========================================================
   USIAMS - config.js
   Loads .env into process.env and exposes the resolved runtime
   configuration. Deliberately dependency-free: the project only
   ships mysql2, and a five-line parser is enough for the handful
   of KEY=value settings in .env.example.

   Values already present in the real environment always win, so
   `set PORT=9000 && npm start` still overrides the file.
   ========================================================= */
const fs = require("node:fs");
const path = require("node:path");

function loadEnvFile(file = path.join(__dirname, ".env")) {
  if (!fs.existsSync(file)) return;
  for (const rawLine of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile();

const config = {
  host: process.env.HOST || "127.0.0.1",
  port: Number(process.env.PORT || 3000),
  sessionTtlMs: Number(process.env.SESSION_TTL_HOURS || 8) * 60 * 60 * 1000,
  passwordSalt: process.env.PASSWORD_SALT || "usiams-demo-salt",
  db: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME || "university",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10)
  }
};

module.exports = { config, loadEnvFile };

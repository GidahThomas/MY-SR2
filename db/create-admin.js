/* =========================================================
   USIAMS - db/create-admin.js
   Creates an administrator account. A freshly set-up database has no
   sign-in accounts at all, so this is how the first person gets in;
   everyone else is then added from Administration > Users or signs up
   and is approved there.

   Usage:
     npm run create-admin -- --username jdoe --email jdoe@university.ac.tz --name "Jane Doe"
     [--password <at least 12 characters>] [--role UNIVERSITY_ADMIN]

   Without --password a strong random password is generated and shown
   once. Sign in and change it under Settings > Change Password.
   ========================================================= */
const crypto = require("node:crypto");
const { query, pool } = require("./repository");
const { hashPassword } = require("./passwords");

const ADMIN_ROLES = ["SYSTEM_ADMIN", "UNIVERSITY_ADMIN"];

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 && process.argv[index + 1] && !process.argv[index + 1].startsWith("--") ? process.argv[index + 1] : null;
}

function fail(message) {
  console.error(`USIAMS: ${message}`);
  console.error('Usage: npm run create-admin -- --username <name> --email <address> --name "<full name>" [--password <password>] [--role SYSTEM_ADMIN|UNIVERSITY_ADMIN]');
  process.exitCode = 1;
}

/** 16 characters from an alphabet without look-alikes (0/O, 1/l/I). */
function generatePassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return Array.from(crypto.randomBytes(16), byte => alphabet[byte % alphabet.length]).join("");
}

async function main() {
  const username = String(argument("username") || "").trim().toLowerCase();
  const email = String(argument("email") || "").trim().toLowerCase();
  const fullName = String(argument("name") || "").trim();
  const role = String(argument("role") || "SYSTEM_ADMIN").trim().toUpperCase();
  const given = argument("password");

  if (!/^[a-z0-9._-]{3,80}$/.test(username)) return fail("Give a --username of 3-80 letters, numbers, dots, underscores or hyphens.");
  if (!/^\S+@\S+\.\S+$/.test(email)) return fail("Give a valid --email; password reset links are sent there.");
  if (!fullName) return fail("Give the administrator's --name.");
  if (!ADMIN_ROLES.includes(role)) return fail(`--role must be one of ${ADMIN_ROLES.join(", ")}.`);
  if (given !== null && given.length < 12) return fail("A --password must be at least 12 characters.");

  const taken = await query("SELECT username, email FROM users WHERE LOWER(username) = ? OR LOWER(email) = ? LIMIT 1", [username, email]);
  if (taken.length) return fail(taken[0].username.toLowerCase() === username ? `The username "${username}" is already in use.` : `The email ${email} is already in use.`);

  const password = given || generatePassword();
  const id = `USR-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
  await query("INSERT INTO users (id, username, password_hash, full_name, email, status) VALUES (?, ?, ?, ?, ?, 'Active')",
    [id, username, hashPassword(password), fullName, email]);
  await query("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)", [id, role]);
  await query("INSERT INTO audit_logs (user_id, user_name, user_role, action, entity_type, entity_id, status) VALUES (?, ?, ?, 'CREATE', 'User', ?, 'Success')",
    [id, "create-admin script", role, id]);

  console.log(`USIAMS: created ${role.replace("_", " ").toLowerCase()} account "${username}" (${fullName}).`);
  if (!given) {
    console.log(`  Password: ${password}`);
    console.log("  This is shown only once. Sign in and change it under Settings > Change Password.");
  }
}

main()
  .catch(error => {
    console.error("USIAMS: could not create the administrator:", error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

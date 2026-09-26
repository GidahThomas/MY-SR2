/* =========================================================
   USIAMS - db/passwords.js
   The one place passwords are hashed and checked.

   Every hash gets its own random salt and is stored as
   "scrypt$<salt hex>$<hash hex>", so two accounts with the same
   password no longer share a hash and a leaked PASSWORD_SALT is not
   enough to precompute them.

   Hashes written before this change are bare hex computed with the
   shared PASSWORD_SALT. They still verify, and needsRehash() tells the
   login route to replace them with the salted form on the next
   successful sign-in.
   ========================================================= */
const crypto = require("node:crypto");
const { config } = require("../config");

const PREFIX = "scrypt$";
const KEY_LENGTH = 64;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password || ""), salt, KEY_LENGTH).toString("hex");
  return `${PREFIX}${salt}$${hash}`;
}

function verifyPassword(password, stored) {
  if (typeof stored !== "string" || !stored) return false;
  let salt, expected;
  if (stored.startsWith(PREFIX)) {
    [salt, expected] = stored.slice(PREFIX.length).split("$");
    if (!salt || !expected) return false;
  } else {
    // Legacy: shared salt from the environment.
    salt = config.passwordSalt;
    expected = stored;
  }
  const actual = crypto.scryptSync(String(password || ""), salt, KEY_LENGTH);
  const wanted = Buffer.from(expected, "hex");
  return wanted.length === actual.length && crypto.timingSafeEqual(actual, wanted);
}

function needsRehash(stored) {
  return typeof stored === "string" && !stored.startsWith(PREFIX);
}

module.exports = { hashPassword, verifyPassword, needsRehash };

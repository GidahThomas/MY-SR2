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

// ---------------------------------------------------------------------
// Password policy, applied everywhere a password is chosen: sign-up,
// Forgot Password, Change Password, and accounts added by administrators.
// Length and guessability matter more than forced symbols, so a new
// password must be long, must not be a well-known one (or one with digits
// tacked on), and must not contain the person's username or email name.
// ---------------------------------------------------------------------
const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_LENGTH = 128;

// Words that, with or without digits and symbols around them, are among the
// first any attacker tries - including this institution's own names.
const COMMON_WORDS = new Set([
  "password", "passw0rd", "pass", "qwerty", "qwertyuiop", "asdfgh", "asdfghjkl", "zxcvbnm", "admin", "administrator",
  "welcome", "letmein", "iloveyou", "love", "monkey", "dragon", "football", "baseball", "master", "sunshine",
  "princess", "shadow", "superman", "login", "user", "student", "students", "teacher", "lecturer", "secret",
  "changeme", "default", "abc", "abcd", "abcdef", "abcdefgh", "test", "guest", "hello", "freedom",
  "tanzania", "dodoma", "arusha", "babati", "manyara", "mwanza", "dar", "daressalaam", "zanzibar", "simba",
  "yanga", "mungu", "yesu", "university", "college", "unicollege", "uni", "usiams", "chuo", "karibu"
]);

/**
 * Why a new password is not acceptable, or null when it is.
 * `username` and `email` are the account's, so the password cannot simply
 * repeat them.
 */
function passwordProblem(password, { username = "", email = "" } = {}) {
  const value = String(password || "");
  if (value.length < MIN_PASSWORD_LENGTH) return `Choose a password of at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (value.length > MAX_PASSWORD_LENGTH) return `A password can be at most ${MAX_PASSWORD_LENGTH} characters.`;
  const lower = value.toLowerCase();
  if (new Set(lower).size < 5) return "That password repeats the same few characters. Choose something less predictable.";
  const digits = "01234567890123456789", letters = "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz", keys = "qwertyuiopasdfghjklzxcvbnm";
  for (const run of [digits, letters, keys]) {
    if (run.includes(lower) || run.split("").reverse().join("").includes(lower)) {
      return "That password is a simple sequence. Choose something less predictable.";
    }
  }
  // The letters alone, e.g. "Password@2026" -> "password".
  const word = lower.replace(/[^a-z]/g, "");
  if (!word || COMMON_WORDS.has(word) || COMMON_WORDS.has(lower)) {
    return "That password is too common and among the first an attacker would try. Choose something less predictable.";
  }
  const name = String(username || "").toLowerCase().trim();
  const mailbox = String(email || "").toLowerCase().split("@")[0].trim();
  for (const part of [name, mailbox]) {
    if (part.length >= 3 && lower.includes(part)) return "A password must not contain your username or email address.";
  }
  return null;
}

module.exports = { hashPassword, verifyPassword, needsRehash, passwordProblem, MIN_PASSWORD_LENGTH };

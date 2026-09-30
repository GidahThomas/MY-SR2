/* =========================================================
   USIAMS - db/role-permissions.js
   Access an administrator has set per role and module (the
   role_permissions table). Rules are kept in memory and reloaded at
   most every REFRESH_MS, so each request can check them without a
   query; on Vercel every running copy of the server picks up a change
   within that time. A saved change applies at once on the copy that
   saved it.
   ========================================================= */
const { query } = require("./repository");
const P = require("../data/permissions");

const REFRESH_MS = 15 * 1000;
let rules = new Map(); // "ROLE|module" -> level
let loadedAt = 0;

const keyOf = (role, moduleKey) => `${role}|${moduleKey}`;

async function load() {
  const rows = await query("SELECT role_id AS role, module_key AS moduleKey, access_level AS level FROM role_permissions");
  rules = new Map(rows.map(r => [keyOf(r.role, r.moduleKey), r.level]));
  loadedAt = Date.now();
}

/** Reloads the rules when they are older than REFRESH_MS. A failed reload keeps the last good set. */
async function refresh() {
  if (Date.now() - loadedAt < REFRESH_MS) return;
  try { await load(); }
  catch (error) {
    loadedAt = Date.now();
    console.warn("USIAMS: could not load role permissions:", error.message);
  }
}

/** The level set for this role and module, or null when the built-in default applies. */
function ruleFor(role, moduleKey) {
  const fixed = P.FIXED[role] && P.FIXED[role][moduleKey];
  if (fixed) return fixed;
  return rules.get(keyOf(role, moduleKey)) || null;
}

function allRules() {
  return [...rules.entries()].map(([key, level]) => {
    const [role, moduleKey] = key.split("|");
    return { role, module: moduleKey, level };
  });
}

function rulesForRole(role) {
  return Object.fromEntries(allRules().filter(r => r.role === role).map(r => [r.module, r.level]));
}

/** Stores a level, or removes the rule (back to the default) when level is null. */
async function save(role, moduleKey, level, userId) {
  if (level === null) {
    await query("DELETE FROM role_permissions WHERE role_id = ? AND module_key = ?", [role, moduleKey]);
  } else {
    await query(
      `INSERT INTO role_permissions (role_id, module_key, access_level, updated_by) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE access_level = VALUES(access_level), updated_by = VALUES(updated_by)`,
      [role, moduleKey, level, userId || null]
    );
  }
  await load();
}

async function reset() {
  await query("DELETE FROM role_permissions");
  await load();
}

module.exports = { refresh, load, ruleFor, allRules, rulesForRole, save, reset };

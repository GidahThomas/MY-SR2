/* =========================================================
   USIAMS - db/repository.js
   Generic data access driven by db/resources.js. Every REST
   resource shares this implementation: it maps API field names
   to columns, hydrates join-table collections, converts JSON and
   boolean columns, and scopes queries to a student's own records.
   ========================================================= */
const crypto = require("node:crypto");
const mysql = require("mysql2/promise");
const { config } = require("../config");
const { RESOURCES, json } = require("./resources");

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  waitForConnections: true,
  connectionLimit: config.db.connectionLimit,
  queueLimit: 0,
  // Dates as strings keeps the API output identical to the shapes the
  // frontend modules were written against; decimals as numbers stops
  // credits and money arriving as "3.0" strings.
  dateStrings: true,
  decimalNumbers: true,
  // MySQL/MariaDB closes connections that sit idle (wait_timeout). Keep-alive
  // and closing idle connections ourselves stop the pool handing out one the
  // server has already dropped.
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  idleTimeout: 60000,
  maxIdle: 2
});

// A connection the server dropped fails its next query with one of these;
// the pool discards it, so the same query on a fresh connection succeeds.
const DROPPED = new Set(["ECONNRESET", "PROTOCOL_CONNECTION_LOST", "EPIPE", "ETIMEDOUT"]);

async function withRetry(run) {
  try {
    return await run();
  } catch (error) {
    if (!DROPPED.has(error.code)) throw error;
    return run();
  }
}

async function query(sql, params = []) {
  const [rows] = await withRetry(() => pool.execute(sql, params));
  return rows;
}

/** pool.query (not execute) for statements with dynamic IN lists. */
async function rawQuery(sql, params = []) {
  const [rows] = await withRetry(() => pool.query(sql, params));
  return rows;
}

async function health() {
  try {
    await query("SELECT 1 AS ok");
    return true;
  } catch {
    return false;
  }
}

function resourceOrThrow(name) {
  const resource = RESOURCES[name];
  if (!resource) {
    const error = new Error(`Unknown resource: ${name}`);
    error.status = 404;
    throw error;
  }
  return resource;
}

/** "2026-08-20T09:15" / "...T09:15:00" / "...T09:15:00.000Z" */
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?Z?$/;

/** "2026-08-20 09:15:00" -> "2026-08-20T09:15:00" so browsers parse it reliably. */
function normalizeOut(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    return value.replace(" ", "T");
  }
  return value;
}

/**
 * DB row -> API object.
 *
 * `extraSelect` fields (values computed in SQL, such as a user's role from
 * the join table) are carried through as-is, then `transformOut` reshapes
 * the result into the exact shape the frontend modules read: nested objects
 * such as a student's emergencyContact, and derived values such as fullName.
 * Without that step those modules silently render blanks.
 */
function toApi(resource, row) {
  const item = {};
  for (const [field, column] of Object.entries(resource.fields)) {
    let value = row[column];
    if ((resource.jsonFields || []).includes(field)) value = json.parse(value);
    else if ((resource.booleanFields || []).includes(field)) value = value === null ? null : Boolean(Number(value));
    else value = normalizeOut(value);
    item[field] = value === undefined ? null : value;
  }
  for (const field of Object.keys(resource.extraSelect || {})) {
    if (field in row) item[field] = normalizeOut(row[field]);
  }
  return resource.transformOut ? resource.transformOut(item) : item;
}

/** API object -> { columns, values } for INSERT/UPDATE. */
function toColumns(resource, incoming, { includeId = true } = {}) {
  // transformIn is the inverse of transformOut: it flattens the nested
  // shapes the modules send back (a student's emergencyContact, an
  // internship's assessment) into the flat columns the table holds.
  const payload = resource.transformIn ? resource.transformIn(incoming) : incoming;
  const columns = [];
  const values = [];
  const readOnly = new Set([
    ...(resource.readOnlyFields || []),
    ...Object.keys(resource.joins || {}),
    ...Object.keys(resource.extraSelect || {})
  ]);
  const writable = { ...resource.fields, ...(resource.writeOnly || {}) };
  for (const [field, column] of Object.entries(writable)) {
    if (field === "id" && !includeId) continue;
    if (readOnly.has(field)) continue;
    if (!(field in payload)) continue;
    let value = payload[field];
    if ((resource.jsonFields || []).includes(field)) value = json.stringify(value);
    else if ((resource.booleanFields || []).includes(field)) value = value ? 1 : 0;
    else if (value === "") value = null;
    // Only rewrite the separator of a genuine ISO timestamp. A blanket
    // replace would corrupt ordinary identifiers that contain a "T"
    // ("STU-0001" became "S U-0001" and broke every foreign key).
    else if (typeof value === "string" && ISO_DATETIME.test(value)) value = value.replace("T", " ");
    columns.push(column);
    values.push(value === undefined ? null : value);
  }
  return { columns, values };
}

function newId(resource) {
  return `${resource.idPrefix}-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
}

/**
 * Loads join-table collections (a course's programmeIds, a registration's
 * courseIds) for a page of rows in one query each, rather than per row.
 */
async function hydrateJoins(resource, items) {
  if (!resource.joins || !items.length) return items;
  const ids = items.map(item => item.id);
  for (const [field, join] of Object.entries(resource.joins)) {
    const rows = await rawQuery(
      `SELECT \`${join.localKey}\` AS ownerId, \`${join.valueColumn}\` AS value FROM \`${join.table}\` WHERE \`${join.localKey}\` IN (?)`,
      [ids]
    );
    const grouped = new Map();
    for (const row of rows) {
      if (!grouped.has(row.ownerId)) grouped.set(row.ownerId, []);
      grouped.get(row.ownerId).push(row.value);
    }
    for (const item of items) item[field] = grouped.get(item.id) || [];
  }
  return items;
}

async function writeJoins(connection, resource, id, payload) {
  if (!resource.joins) return;
  for (const [field, join] of Object.entries(resource.joins)) {
    if (!(field in payload) || !Array.isArray(payload[field])) continue;
    await connection.execute(`DELETE FROM \`${join.table}\` WHERE \`${join.localKey}\` = ?`, [id]);
    for (const value of payload[field]) {
      await connection.execute(
        `INSERT INTO \`${join.table}\` (\`${join.localKey}\`, \`${join.valueColumn}\`) VALUES (?, ?)`,
        [id, value]
      );
    }
  }
}

/**
 * Builds the WHERE clause that restricts a student to their own records.
 * Returns null when no scoping applies (staff, or a resource with no owner).
 */
function scopeClause(resource, scope) {
  if (!scope) return null;
  // A resource owned by a user account holds personal correspondence - a
  // user's notifications are their own, so this scoping applies to every
  // role, not only to students. Without it any staff account could list
  // every student's notifications.
  if (resource.ownerUserField) {
    if (!scope.userId) return null;
    return { sql: `\`${resource.fields[resource.ownerUserField]}\` = ?`, params: [scope.userId] };
  }
  // Student-owned records are visible in full to staff, and limited to
  // their own rows for the student themselves.
  if (!resource.ownerField || scope.role !== "STUDENT") return null;
  // A student account with no student record yet - a freshly registered one -
  // must see none of these, not all of them. Skipping the filter here used to
  // hand every self-registered account the whole register: every student's
  // results, invoices and contact details. Absent scoping fails closed.
  if (!scope.studentId) return { sql: "1 = 0", params: [] };
  return { sql: `\`${resource.fields[resource.ownerField]}\` = ?`, params: [scope.studentId] };
}

/**
 * The SELECT list for a resource: every mapped column aliased to its API
 * field name, plus any `extraSelect` expressions (values that need a
 * subquery, such as a user's role from the join table).
 */
function selectList(resource) {
  const columns = Object.entries(resource.fields)
    .map(([field, column]) => `\`${column}\` AS \`${field}\``);
  for (const [field, expression] of Object.entries(resource.extraSelect || {})) {
    columns.push(`(${expression}) AS \`${field}\``);
  }
  return columns.join(", ");
}

/** A SELECT row (already keyed by API field name) -> the API object. */
function rowToApi(resource, row) {
  const byColumn = {};
  for (const [field, column] of Object.entries(resource.fields)) byColumn[column] = row[field];
  for (const field of Object.keys(resource.extraSelect || {})) byColumn[field] = row[field];
  return toApi(resource, byColumn);
}

async function list(name, { scope } = {}) {
  const resource = resourceOrThrow(name);
  const clause = scopeClause(resource, scope);
  const sql = `SELECT ${selectList(resource)} FROM \`${resource.table}\`${clause ? ` WHERE ${clause.sql}` : ""}` +
    (resource.order ? ` ORDER BY \`${resource.order}\`` : "");
  const rows = await query(sql, clause ? clause.params : []);
  return hydrateJoins(resource, rows.map(row => rowToApi(resource, row)));
}

async function getById(name, id, { scope } = {}) {
  const resource = resourceOrThrow(name);
  const clause = scopeClause(resource, scope);
  const rows = await query(
    `SELECT ${selectList(resource)} FROM \`${resource.table}\` WHERE \`${resource.fields.id}\` = ?${clause ? ` AND ${clause.sql}` : ""} LIMIT 1`,
    clause ? [id, ...clause.params] : [id]
  );
  if (!rows.length) return null;
  const [item] = await hydrateJoins(resource, [rowToApi(resource, rows[0])]);
  return item;
}

async function create(name, payload) {
  const resource = resourceOrThrow(name);
  const id = resource.autoIncrementId ? null : (payload.id || newId(resource));
  const body = resource.autoIncrementId ? { ...payload } : { ...payload, id };
  const { columns, values } = toColumns(resource, body, { includeId: !resource.autoIncrementId });
  if (!columns.length) {
    const error = new Error("No writable fields supplied.");
    error.status = 422;
    throw error;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(
      `INSERT INTO \`${resource.table}\` (${columns.map(c => `\`${c}\``).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
      values
    );
    const insertedId = resource.autoIncrementId ? result.insertId : id;
    await writeJoins(connection, resource, insertedId, body);
    if (resource.afterWrite) await resource.afterWrite(connection, insertedId, body);
    await connection.commit();
    return getById(name, insertedId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function update(name, id, patch) {
  const resource = resourceOrThrow(name);
  const { columns, values } = toColumns(resource, patch, { includeId: false });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    if (columns.length) {
      await connection.execute(
        `UPDATE \`${resource.table}\` SET ${columns.map(c => `\`${c}\` = ?`).join(", ")} WHERE \`${resource.fields.id}\` = ?`,
        [...values, id]
      );
    }
    await writeJoins(connection, resource, id, patch);
    if (resource.afterWrite) await resource.afterWrite(connection, id, patch);
    await connection.commit();
    return getById(name, id);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function remove(name, id) {
  const resource = resourceOrThrow(name);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    // The row is read before it goes, so a hook that recomputes a derived
    // total (library availability) still knows which record to recompute.
    const [rows] = await connection.execute(
      `SELECT * FROM \`${resource.table}\` WHERE \`${resource.fields.id}\` = ? LIMIT 1`,
      [id]
    );
    const [result] = await connection.execute(
      `DELETE FROM \`${resource.table}\` WHERE \`${resource.fields.id}\` = ?`,
      [id]
    );
    if (resource.afterWrite && rows.length) {
      await resource.afterWrite(connection, id, toApi(resource, rows[0]));
    }
    await connection.commit();
    return result.affectedRows > 0;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { pool, query, rawQuery, health, list, getById, create, update, remove, resourceOrThrow, newId };

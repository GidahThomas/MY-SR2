/* =========================================================
   USIAMS - db.js
   Authentication, admissions and election queries.

   Previously this module kept an in-memory copy of the demo
   accounts and silently fell back to it whenever a query threw.
   That made a dead database look like a working login: accounts
   authenticated against hard-coded passwords and then landed in an
   empty application. Now that the database holds the full register
   (see db/seed-from-data.js) the fallback is gone - a failed query
   propagates so the caller can report the outage honestly.
   ========================================================= */
const crypto = require("node:crypto");
const { config } = require("./config");
const { pool, query } = require("./db/repository");

function hashPassword(password, salt = config.passwordSalt) {
  return crypto.scryptSync(String(password || ""), salt, 64).toString("hex");
}

async function health() {
  try {
    await query("SELECT 1 AS ok");
    return true;
  } catch {
    return false;
  }
}

async function findUser(username) {
  const rows = await query(`
    SELECT
      u.id,
      u.username,
      u.password_hash AS passwordHash,
      u.full_name AS name,
      u.email,
      u.status,
      u.department_id AS departmentId,
      COALESCE(u.unit_id, d.unit_id) AS unitId,
      s.id AS studentId,
      GROUP_CONCAT(r.id ORDER BY r.id SEPARATOR ',') AS roles
    FROM users u
    LEFT JOIN students s ON s.email = u.email
    LEFT JOIN departments d ON d.id = u.department_id
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    WHERE LOWER(u.username) = LOWER(?)
    GROUP BY u.id, u.username, u.password_hash, u.full_name, u.email, u.status,
      u.department_id, u.unit_id, d.unit_id, s.id
    LIMIT 1
  `, [username]);
  const user = rows[0];
  if (!user) return null;
  user.roles = user.roles ? user.roles.split(",") : [];
  user.role = user.roles[0] || null;
  return user;
}

async function findUserByEmail(email) {
  const rows = await query("SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1", [String(email || "").trim()]);
  return rows[0] || null;
}

async function recordLogin(userId) {
  await query("UPDATE users SET last_login_at = NOW() WHERE id = ?", [userId]);
  return true;
}

// Matches the institutional numbering used throughout the register (see
// data/students.js): T<admission year><level code><serial>, where the serial
// is unique per department and level.
const REG_LEVEL_CODE = { Diploma: "02", Undergraduate: "03", Certificate: "03", Postgraduate: "05", PhD: "05" };
const SERIAL_BASE_BY_LEVEL = { Diploma: 10000, Undergraduate: 20000, PhD: 100 };

/**
 * Issues the next registration number for a programme. The serial continues
 * the existing run for that department and level rather than restarting, so
 * a self-registered student gets a number indistinguishable from a seeded one.
 */
async function nextRegistrationNumber(connection, programme, admissionYear) {
  const levelCode = REG_LEVEL_CODE[programme.level] || "03";
  const base = SERIAL_BASE_BY_LEVEL[programme.level] || 20000;
  const yearCode = String(admissionYear).slice(-2);
  const [rows] = await connection.execute(`
    SELECT MAX(CAST(SUBSTRING_INDEX(s.registration_number, '-', -1) AS UNSIGNED)) AS maxSerial
    FROM students s
    JOIN programmes p ON p.id = s.programme_id
    WHERE s.department_id = ? AND p.level = ?
  `, [programme.departmentId, programme.level]);
  const serial = Math.max(Number(rows[0].maxSerial) || 0, base) + 1;
  return `T${yearCode}-${levelCode}-${String(serial).padStart(5, "0")}`;
}

/** "T26-03-20005" -> "T26-03-20006" */
function bumpSerial(registrationNumber) {
  const parts = String(registrationNumber).split("-");
  const serial = Number(parts.pop()) + 1;
  return [...parts, String(serial).padStart(5, "0")].join("-");
}

/**
 * Creates a student account: the login, its STUDENT role, and the student
 * record itself.
 *
 * The student row is the important part. Registration used to create only the
 * user, leaving an account with no studentId - which meant the student pages
 * had no record to show, and (before the scoping was fixed) the account could
 * read the entire register instead of nothing. A student account without a
 * student record is not a usable account, so both are written in one
 * transaction or neither is.
 */
async function createStudentAccount({ id, username, passwordHash, fullName, email, programmeId }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [programmes] = await connection.execute(
      "SELECT id, level, department_id AS departmentId FROM programmes WHERE id = ? AND status = 'Active' LIMIT 1",
      [programmeId]
    );
    if (!programmes.length) {
      const error = new Error("The selected programme is not available.");
      error.code = "INVALID_PROGRAMME";
      throw error;
    }
    const programme = programmes[0];

    await connection.execute(
      "INSERT INTO users (id, username, password_hash, full_name, email, status) VALUES (?, ?, ?, ?, ?, 'Active')",
      [id, String(username || "").trim(), passwordHash, fullName, String(email || "").trim()]
    );
    await connection.execute("INSERT INTO user_roles (user_id, role_id) VALUES (?, 'STUDENT')", [id]);

    // The student record is linked to the login by email - that is how
    // findUser() resolves studentId on sign-in.
    const name = String(fullName || "").trim().split(/\s+/);
    const firstName = name.shift() || "Student";
    const lastName = name.join(" ") || firstName;
    const admissionYear = new Date().getFullYear();
    const studentId = `STU-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;

    // Two people registering at the same moment read the same highest serial
    // and then both try to claim it. Rather than lock the register, take the
    // collision and step to the next number: five sign-ups arriving together
    // used to leave three of them refused with a message blaming the
    // username, which was not the field that clashed.
    let registrationNumber = await nextRegistrationNumber(connection, programme, admissionYear);
    for (let attempt = 0; ; attempt++) {
      try {
        await connection.execute(`
          INSERT INTO students
            (id, registration_number, first_name, last_name, programme_id, department_id,
             study_year, status, email, admission_date)
          VALUES (?, ?, ?, ?, ?, ?, 1, 'Active', ?, CURDATE())
        `, [
          studentId, registrationNumber, firstName, lastName,
          programme.id, programme.departmentId, String(email || "").trim()
        ]);
        break;
      } catch (error) {
        const clash = error.code === "ER_DUP_ENTRY" && /registration_number/i.test(error.message || "");
        if (!clash || attempt >= 25) throw error;
        registrationNumber = bumpSerial(registrationNumber);
      }
    }

    await connection.commit();
    return { userId: id, studentId, registrationNumber };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * A self-registered staff account. It is created Pending - sign-in only
 * accepts Active accounts - so it stays unusable until an administrator
 * approves it from Administration > Users.
 */
async function createStaffAccount({ id, username, passwordHash, fullName, email, role, departmentId, unitId }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `INSERT INTO users (id, username, password_hash, full_name, email, status, department_id, unit_id)
       VALUES (?, ?, ?, ?, ?, 'Pending', ?, ?)`,
      [id, String(username || "").trim(), passwordHash, fullName, String(email || "").trim(),
        departmentId || null, unitId || null]
    );
    await connection.execute("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)", [id, role]);
    await connection.commit();
    return { userId: id };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/** Departments and organisational units a staff applicant can choose from. */
async function registrationScopes() {
  const departments = await query(
    "SELECT id, name, unit_id AS unitId FROM departments WHERE status = 'Active' ORDER BY name"
  );
  const units = await query(
    "SELECT id, name, unit_type AS type FROM organisational_units WHERE status = 'Active' ORDER BY name"
  );
  return { departments, units };
}

// ---------------------------------------------------------------------
// Per-user preferences and university-wide settings
// ---------------------------------------------------------------------
function parseJson(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

async function getPreferences(userId) {
  const rows = await query("SELECT preferences FROM user_preferences WHERE user_id = ? LIMIT 1", [userId]);
  return rows[0] ? parseJson(rows[0].preferences, {}) : {};
}

/** Merges `patch` into the user's stored preferences and returns the result. */
async function savePreferences(userId, patch) {
  const merged = { ...(await getPreferences(userId)), ...(patch || {}) };
  await query(
    `INSERT INTO user_preferences (user_id, preferences) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE preferences = VALUES(preferences)`,
    [userId, JSON.stringify(merged)]
  );
  return merged;
}

async function getSystemSettings() {
  const rows = await query("SELECT setting_key AS settingKey, setting_value AS settingValue FROM system_settings");
  return Object.fromEntries(rows.map(r => [r.settingKey, parseJson(r.settingValue, null)]));
}

async function saveSystemSettings(patch, userId) {
  for (const [key, value] of Object.entries(patch || {})) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,59}$/.test(key)) continue;
    await query(
      `INSERT INTO system_settings (setting_key, setting_value, updated_by) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
      [key, JSON.stringify(value), userId || null]
    );
  }
  return getSystemSettings();
}

// ---------------------------------------------------------------------
// Uploaded files, stored in the database in chunks
// ---------------------------------------------------------------------
const FILE_CHUNK_BYTES = 512 * 1024;

async function saveFile({ ownerUserId, studentId, purpose, name, mimeType, content }) {
  const id = `FILE-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `INSERT INTO stored_files (id, owner_user_id, student_id, purpose, original_name, mime_type, size_bytes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, ownerUserId || null, studentId || null, purpose, name, mimeType, content.length]
    );
    for (let i = 0, offset = 0; offset < content.length; i++, offset += FILE_CHUNK_BYTES) {
      await connection.execute(
        "INSERT INTO stored_file_chunks (file_id, chunk_index, data) VALUES (?, ?, ?)",
        [id, i, content.subarray(offset, offset + FILE_CHUNK_BYTES)]
      );
    }
    await connection.commit();
    return { id, name, mimeType, size: content.length, url: `/api/files/${id}` };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getFileInfo(id) {
  const rows = await query(
    `SELECT id, owner_user_id AS ownerUserId, student_id AS studentId, purpose, original_name AS name,
            mime_type AS mimeType, size_bytes AS size, created_at AS createdAt
     FROM stored_files WHERE id = ? LIMIT 1`, [String(id || "")]
  );
  return rows[0] || null;
}

async function getFileContent(id) {
  const chunks = await query("SELECT data FROM stored_file_chunks WHERE file_id = ? ORDER BY chunk_index", [String(id || "")]);
  return Buffer.concat(chunks.map(c => Buffer.from(c.data)));
}

// ---------------------------------------------------------------------
// Control-number payments
// ---------------------------------------------------------------------
const CONTROL_NUMBER_DAYS = 7;

async function paymentMethods() {
  return query(
    "SELECT id, name, channel, instructions FROM payment_methods WHERE status = 'Active' ORDER BY sort_order, name"
  );
}

/** The student's tuition invoice and what is still owed on it. */
async function tuitionBalance(studentId) {
  const invoices = await query(
    "SELECT id, description, amount_billed AS billed FROM invoices WHERE student_id = ? AND status <> 'Cancelled' ORDER BY issued_date LIMIT 1",
    [studentId]
  );
  const invoice = invoices[0];
  if (!invoice) return null;
  const paid = await query(
    "SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE invoice_id = ? AND status = 'Completed'",
    [invoice.id]
  );
  const billed = Number(invoice.billed);
  const balance = Math.max(0, billed - Number(paid[0].paid));
  return { invoiceId: invoice.id, description: invoice.description, billed, balance };
}

/** Fee items on offer; for a student, tuition carries their outstanding balance. */
async function feeItems(studentId) {
  const items = await query(
    "SELECT id, name, description, kind, amount FROM fee_items WHERE status = 'Active' ORDER BY sort_order, name"
  );
  const tuition = studentId ? await tuitionBalance(studentId) : null;
  return items.map(item => {
    const out = { ...item, amount: item.amount === null ? null : Number(item.amount) };
    if (item.kind === "TUITION") {
      out.amount = tuition ? tuition.balance : 0;
      out.available = !!tuition && tuition.balance > 0;
      out.note = !tuition ? "No tuition invoice has been issued yet."
        : tuition.balance > 0 ? null : "Your tuition is fully paid.";
    } else {
      out.available = true;
    }
    return out;
  });
}

function controlNumberRow(row) {
  return row && {
    controlNumber: row.controlNumber, studentId: row.studentId, feeItemId: row.feeItemId,
    feeItemName: row.feeItemName, invoiceId: row.invoiceId, description: row.description,
    amount: Number(row.amount), status: row.status, paymentMethodId: row.paymentMethodId,
    paymentId: row.paymentId, createdAt: row.createdAt, expiresAt: row.expiresAt, paidAt: row.paidAt
  };
}

const CONTROL_NUMBER_SELECT = `
  SELECT c.control_number AS controlNumber, c.student_id AS studentId, c.fee_item_id AS feeItemId,
         f.name AS feeItemName, c.invoice_id AS invoiceId, c.description, c.amount, c.status,
         c.payment_method_id AS paymentMethodId, c.payment_id AS paymentId,
         c.created_at AS createdAt, c.expires_at AS expiresAt, c.paid_at AS paidAt
  FROM control_numbers c JOIN fee_items f ON f.id = c.fee_item_id`;

async function expireControlNumbers() {
  await query("UPDATE control_numbers SET status = 'Expired' WHERE status = 'Pending' AND expires_at < NOW()");
}

async function controlNumbersFor(studentId) {
  await expireControlNumbers();
  const rows = studentId
    ? await query(`${CONTROL_NUMBER_SELECT} WHERE c.student_id = ? ORDER BY c.created_at DESC`, [studentId])
    : await query(`${CONTROL_NUMBER_SELECT} ORDER BY c.created_at DESC LIMIT 200`);
  return rows.map(controlNumberRow);
}

async function findControlNumber(controlNumber) {
  await expireControlNumbers();
  const rows = await query(`${CONTROL_NUMBER_SELECT} WHERE c.control_number = ? LIMIT 1`, [String(controlNumber || "")]);
  return controlNumberRow(rows[0]);
}

/**
 * Issues a control number for one fee item. A still-valid pending number for
 * the same item and amount is returned instead of issuing a second one.
 * Throws with a .status (422) when the item cannot be paid for.
 */
async function issueControlNumber({ studentId, feeItemId, amount }) {
  const fail = (message) => Object.assign(new Error(message), { status: 422 });
  const items = await query("SELECT id, name, kind, amount FROM fee_items WHERE id = ? AND status = 'Active' LIMIT 1", [String(feeItemId || "")]);
  const item = items[0];
  if (!item) throw fail("Choose what you are paying for.");

  let invoiceId = null;
  let due;
  let description = item.name;
  if (item.kind === "TUITION") {
    const tuition = await tuitionBalance(studentId);
    if (!tuition) throw fail("No tuition invoice has been issued yet.");
    if (tuition.balance <= 0) throw fail("Your tuition is fully paid.");
    invoiceId = tuition.invoiceId;
    description = `${item.name} - ${tuition.description}`;
    // Tuition may be paid in instalments: any amount up to the balance.
    due = amount === undefined || amount === null || amount === "" ? tuition.balance : Math.round(Number(amount));
    if (!Number.isFinite(due) || due <= 0 || due > tuition.balance) {
      throw fail(`Enter an amount between 1 and ${tuition.balance.toLocaleString("en-US")} TZS.`);
    }
  } else {
    due = Number(item.amount);
  }

  await expireControlNumbers();
  const existing = await query(
    `${CONTROL_NUMBER_SELECT} WHERE c.student_id = ? AND c.fee_item_id = ? AND c.amount = ? AND c.status = 'Pending' LIMIT 1`,
    [studentId, item.id, due]
  );
  if (existing[0]) return { ...controlNumberRow(existing[0]), reused: true };

  // GePG-style: 12 digits beginning with 99. Retry on the rare collision.
  for (let attempt = 0; attempt < 10; attempt++) {
    const controlNumber = "99" + String(crypto.randomInt(0, 1e10)).padStart(10, "0");
    try {
      await query(
        `INSERT INTO control_numbers (control_number, student_id, fee_item_id, invoice_id, description, amount, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ${CONTROL_NUMBER_DAYS} DAY))`,
        [controlNumber, studentId, item.id, invoiceId, description, due]
      );
      return { ...(await findControlNumber(controlNumber)), reused: false };
    } catch (error) {
      if (error.code !== "ER_DUP_ENTRY") throw error;
    }
  }
  throw new Error("Could not issue a unique control number.");
}

/**
 * Records the payment for a pending control number, paid through one of the
 * listed methods. In production this would be the payment gateway's callback;
 * here it is the simulated confirmation.
 */
/**
 * The number the money comes from: a Tanzanian mobile number for mobile
 * money (stored as 255XXXXXXXXX), or a bank account number. Returns null
 * when it is not valid for the channel.
 */
function normalizePayerAccount(channel, raw) {
  const digits = String(raw || "").replace(/[\s+-]/g, "");
  if (!/^\d+$/.test(digits)) return null;
  if (channel === "Mobile Money") {
    if (/^0[67]\d{8}$/.test(digits)) return "255" + digits.slice(1);
    if (/^255[67]\d{8}$/.test(digits)) return digits;
    return null;
  }
  return /^\d{8,20}$/.test(digits) ? digits : null;
}

/** 255712345678 -> 0712***678; bank accounts keep only the last 4 digits. */
function maskPayerAccount(account) {
  if (!account) return "";
  if (/^255\d{9}$/.test(account)) { const local = "0" + account.slice(3); return local.slice(0, 4) + "***" + local.slice(-3); }
  return "****" + account.slice(-4);
}

async function payControlNumber({ controlNumber, paymentMethodId, payerAccount, receivedBy }) {
  const fail = (status, message) => Object.assign(new Error(message), { status });
  const bill = await findControlNumber(controlNumber);
  if (!bill) throw fail(404, "Control number not found.");
  if (bill.status !== "Pending") throw fail(409, `This control number is ${bill.status.toLowerCase()}.`);
  const methods = await query("SELECT id, name, channel FROM payment_methods WHERE id = ? AND status = 'Active' LIMIT 1", [String(paymentMethodId || "")]);
  const method = methods[0];
  if (!method) throw fail(422, "Choose a payment method.");
  const account = normalizePayerAccount(method.channel, payerAccount);
  if (!account) {
    throw fail(422, method.channel === "Mobile Money"
      ? `Enter the ${method.name} mobile number paying, e.g. 0712345678.`
      : `Enter the ${method.name} account number paying (8-20 digits).`);
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    // Claim the bill first so two confirmations cannot both pay it.
    const [claimed] = await connection.execute(
      "UPDATE control_numbers SET status = 'Paid', paid_at = NOW(), payment_method_id = ? WHERE control_number = ? AND status = 'Pending'",
      [method.id, bill.controlNumber]
    );
    if (claimed.affectedRows !== 1) throw fail(409, "This control number has already been paid.");
    const paymentId = `PAY-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
    await connection.execute(
      `INSERT INTO payments (id, invoice_id, student_id, amount, payment_date, payment_method, payer_account, reference, control_number, fee_item_id, status, received_by)
       VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, 'Completed', ?)`,
      [paymentId, bill.invoiceId, bill.studentId, bill.amount, method.name, account, bill.controlNumber, bill.controlNumber, bill.feeItemId, receivedBy || null]
    );
    await connection.execute("UPDATE control_numbers SET payment_id = ? WHERE control_number = ?", [paymentId, bill.controlNumber]);
    if (bill.invoiceId) {
      await connection.execute(`
        UPDATE invoices i SET status = CASE
          WHEN (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.invoice_id = i.id AND p.status = 'Completed') >= i.amount_billed THEN 'Paid'
          ELSE 'Partially Paid' END
        WHERE i.id = ?`, [bill.invoiceId]);
    }
    await connection.commit();
    return { paymentId, controlNumber: bill.controlNumber, method: method.name, amount: bill.amount, payerAccount: maskPayerAccount(account) };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function passwordHashFor(userId) {
  const rows = await query("SELECT password_hash AS passwordHash FROM users WHERE id = ? LIMIT 1", [userId]);
  return rows[0] ? rows[0].passwordHash : null;
}

async function changePassword(userId, passwordHash) {
  const [result] = await pool.execute("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, userId]);
  return result.affectedRows === 1;
}

async function resetPassword({ username, email, passwordHash }) {
  const [result] = await pool.execute(
    "UPDATE users SET password_hash = ? WHERE LOWER(username) = LOWER(?) AND LOWER(email) = LOWER(?) AND status = 'Active'",
    [passwordHash, String(username || "").trim(), String(email || "").trim()]
  );
  return result.affectedRows === 1;
}

async function activeElection() {
  const elections = await query(`
    SELECT id, name, description, starts_at AS startsAt, ends_at AS endsAt, status
    FROM elections
    WHERE status = 'Open' AND NOW() BETWEEN starts_at AND ends_at
    ORDER BY starts_at DESC LIMIT 1
  `);
  if (!elections[0]) return null;
  const positions = await query(`
    SELECT p.id, p.name, p.display_order AS displayOrder,
      c.id AS candidateId, c.manifesto, s.id AS studentId,
      CONCAT(s.first_name, ' ', s.last_name) AS candidateName
    FROM election_positions p
    LEFT JOIN election_candidates c ON c.position_id = p.id AND c.status = 'Approved'
    LEFT JOIN students s ON s.id = c.student_id
    WHERE p.election_id = ?
    ORDER BY p.display_order, candidateName
  `, [elections[0].id]);
  const grouped = positions.reduce((byPosition, row) => {
    const position = byPosition[row.id] || { id: row.id, name: row.name, displayOrder: row.displayOrder, candidates: [] };
    if (row.candidateId) {
      position.candidates.push({ id: row.candidateId, studentId: row.studentId, name: row.candidateName, manifesto: row.manifesto });
    }
    byPosition[row.id] = position;
    return byPosition;
  }, {});
  return { ...elections[0], positions: Object.values(grouped) };
}

/** Which positions this student has already voted for in the given election. */
async function votesCast(electionId, studentId) {
  const rows = await query(
    "SELECT position_id AS positionId FROM election_votes WHERE election_id = ? AND voter_student_id = ?",
    [electionId, studentId]
  );
  return rows.map(row => row.positionId);
}

async function electionResults(electionId) {
  return query(`
    SELECT p.id AS positionId, p.name AS positionName, c.id AS candidateId,
      CONCAT(s.first_name, ' ', s.last_name) AS candidateName,
      COUNT(v.id) AS votes
    FROM election_positions p
    JOIN election_candidates c ON c.position_id = p.id AND c.status = 'Approved'
    JOIN students s ON s.id = c.student_id
    LEFT JOIN election_votes v ON v.candidate_id = c.id
    WHERE p.election_id = ?
    GROUP BY p.id, p.name, c.id, candidateName
    ORDER BY p.display_order, votes DESC
  `, [electionId]);
}

async function castElectionVote({ electionId, positionId, candidateId, voterStudentId }) {
  const [result] = await pool.execute(`
    INSERT INTO election_votes (election_id, position_id, candidate_id, voter_student_id)
    SELECT ?, ?, ?, ?
    WHERE EXISTS (
      SELECT 1 FROM elections WHERE id = ? AND status = 'Open' AND NOW() BETWEEN starts_at AND ends_at
    ) AND EXISTS (
      SELECT 1 FROM election_candidates WHERE id = ? AND position_id = ? AND status = 'Approved'
    )
  `, [electionId, positionId, candidateId, voterStudentId, electionId, candidateId, positionId]);
  if (result.affectedRows !== 1) {
    const error = new Error("Election or candidate is not valid.");
    error.code = "INVALID_ELECTION_VOTE";
    throw error;
  }
}

async function createAdmissionApplication(application) {
  await query(`
    INSERT INTO admission_applications
      (id, full_name, email, phone, gender, programme_id, previous_school, entry_qualification, application_date, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), 'Submitted', '')
  `, [application.id, application.fullName, application.email, application.phone, application.gender,
      application.programmeId, application.previousSchool, application.entryQualification]);
}

/** Appends to the audit trail. Never throws into the caller's request path. */
async function recordAudit({ userId, userName, userRole, action, entityType, entityId, status = "Success", ip }) {
  try {
    await query(`
      INSERT INTO audit_logs (user_id, user_name, user_role, action, entity_type, entity_id, status, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [userId || null, userName || null, userRole || null, action, entityType, entityId || null, status, ip || null]);
  } catch (error) {
    console.warn("USIAMS: audit write failed:", error.message);
  }
}

module.exports = {
  query, health, hashPassword, findUser, findUserByEmail, recordLogin, createStudentAccount,
  createStaffAccount, registrationScopes, resetPassword,
  getPreferences, savePreferences, getSystemSettings, saveSystemSettings, passwordHashFor, changePassword,
  saveFile, getFileInfo, getFileContent,
  paymentMethods, feeItems, tuitionBalance, controlNumbersFor, findControlNumber, issueControlNumber, payControlNumber, activeElection, votesCast, electionResults, castElectionVote,
  createAdmissionApplication, recordAudit
};

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
      s.id AS studentId,
      GROUP_CONCAT(r.id ORDER BY r.id SEPARATOR ',') AS roles
    FROM users u
    LEFT JOIN students s ON s.email = u.email
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    WHERE LOWER(u.username) = LOWER(?)
    GROUP BY u.id, u.username, u.password_hash, u.full_name, u.email, u.status, s.id
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
  resetPassword, activeElection, votesCast, electionResults, castElectionVote,
  createAdmissionApplication, recordAudit
};

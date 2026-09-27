/* =========================================================
   USIAMS - db/seed-from-data.js
   Loads every dataset from the data/*.js seed files and writes it
   into MySQL, so the database holds exactly the register the
   prototype was built against (60 students, 39 courses, the full
   timetable, results, finance ledger and service records).

   This REPLACES the contents of the operational tables - it
   truncates them first so the script is safe to re-run and always
   produces the same dataset. It is a development/demo seeder; it is
   not intended to run against a database holding real records.

   Usage: node db/seed-from-data.js        (prompts nothing, wipes+seeds)
          npm run db:seed
   ========================================================= */
const mysql = require("mysql2/promise");
const { config } = require("../config");
const { loadSeedData } = require("./load-seed-data");
const { hashPassword } = require("./passwords");
const { demoAccounts, removeAccounts } = require("./accounts");
const DEMO_PASSWORDS = require("./demo-passwords");

// The demo data comes with 20 sign-in accounts (data/users.js). They are
// loaded so the demo records can refer to them, then removed again - a
// seeded database has no demo logins. Real accounts (npm run create-admin,
// self-registration, Administration > Users) are kept across reseeds.
// --with-demo-accounts keeps the demo logins instead; the test suite uses
// it, against its own database.
const WITH_DEMO_ACCOUNTS = process.argv.includes("--with-demo-accounts");

// Truncated in reverse-dependency order before reseeding.
const TABLES_IN_DEPENDENCY_ORDER = [
  "roles", "organisational_units", "departments", "programmes", "users", "user_roles",
  "students", "academic_years", "semesters", "courses", "course_programmes",
  "course_prerequisites", "timetable_entries", "registrations", "registration_courses",
  "result_records", "attendance_records", "invoices", "payments", "service_requests",
  "complaints", "announcements", "notifications", "document_submissions", "hostels",
  "hostel_rooms", "hostel_allocations", "library_books", "library_loans",
  "internship_records", "graduation_clearance", "alumni", "qa_flags", "calendar_events",
  "public_holidays", "elearning_materials", "elearning_assignments", "elearning_submissions",
  "admission_applications", "audit_logs",
  "election_votes", "election_candidates", "election_positions", "elections",
  // Issued control numbers belong to the students above; the payment
  // methods and fee items they refer to are reference data from the
  // migration and are kept.
  "control_numbers",
  // Per-user settings, sign-ins and reset links belong to the demo
  // accounts being replaced.
  "user_preferences", "user_sessions", "password_resets",
  // Checklist ticks and sent reminders refer to the timetable and students
  // being replaced.
  "class_checkins", "class_reminders_sent"
];

/** "2023/2024" -> { startsOn: "2023-09-01", endsOn: "2024-08-31" } */
function academicYearDates(label) {
  const [first, second] = String(label).split("/");
  return { startsOn: `${first}-09-01`, endsOn: `${second}-08-31` };
}

/** "AY2025-S1" -> 1 */
function semesterNumber(id) {
  const match = String(id).match(/S(\d+)$/);
  return match ? Number(match[1]) : 1;
}

/** Semester I runs Sept-Jan, Semester II Feb-June, within its academic year. */
function semesterDates(semester) {
  const startYear = Number(String(semester.academicYearId).replace(/\D/g, ""));
  return semesterNumber(semester.id) === 1
    ? { startsOn: `${startYear}-09-01`, endsOn: `${startYear + 1}-01-31` }
    : { startsOn: `${startYear + 1}-02-01`, endsOn: `${startYear + 1}-06-30` };
}

/** Timetable slots are two hours long: "14:00" -> "16:00:00". */
function endTime(startTime) {
  const [hour, minute] = String(startTime).split(":").map(Number);
  return `${String(hour + 2).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
}

function toDateTime(value) {
  if (!value) return null;
  return String(value).replace("T", " ").slice(0, 19);
}

function toDate(value) {
  if (!value) return null;
  return String(value).slice(0, 10);
}

/** Bulk insert; skips silently when there is nothing to write. */
async function insertMany(connection, table, columns, rows) {
  if (!rows.length) return 0;
  const placeholders = `(${columns.map(() => "?").join(", ")})`;
  const CHUNK = 200;
  let written = 0;
  for (let offset = 0; offset < rows.length; offset += CHUNK) {
    const chunk = rows.slice(offset, offset + CHUNK);
    const sql = `INSERT INTO \`${table}\` (${columns.map(c => `\`${c}\``).join(", ")}) VALUES ${chunk.map(() => placeholders).join(", ")}`;
    await connection.query(sql, chunk.flat());
    written += chunk.length;
  }
  console.log(`  ${table.padEnd(24)} ${written}`);
  return written;
}

async function seed() {
  const data = loadSeedData();
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    multipleStatements: true
  });

  try {
    console.log(`USIAMS: seeding ${config.db.database} at ${config.db.host}:${config.db.port}`);
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");
    const keepAccounts = !WITH_DEMO_ACCOUNTS;
    for (const table of TABLES_IN_DEPENDENCY_ORDER) {
      if (keepAccounts && (table === "users" || table === "user_roles")) continue;
      await connection.query(`TRUNCATE TABLE \`${table}\``);
    }
    const demo = demoAccounts(data);
    const demoIds = demo.map(a => a.id);
    if (keepAccounts) {
      // Clear out demo accounts left by an earlier seed; real ones stay. A
      // row counts as demo only if it has a demo id AND a demo username (the
      // original one, or the demo-usr-NNNN placeholder), never on id alone.
      const [rows] = await connection.query("SELECT id, username FROM users WHERE id IN (?)", [demoIds]);
      const leftover = [];
      for (const row of rows) {
        const account = demo.find(a => a.id === row.id);
        const username = String(row.username).toLowerCase();
        if (username === account.username || username === `demo-${account.id.toLowerCase()}`) leftover.push(row.id);
        else throw new Error(`the account "${row.username}" has the id ${row.id}, which the demo data uses. Give it a new id before reseeding.`);
      }
      if (leftover.length) {
        await connection.query("DELETE FROM user_roles WHERE user_id IN (?)", [leftover]);
        await connection.query("DELETE FROM users WHERE id IN (?)", [leftover]);
      }
    }
    await connection.query("SET FOREIGN_KEY_CHECKS = 1");

    // ---- Roles -------------------------------------------------------
    await insertMany(connection, "roles", ["id", "name", "description"],
      Object.entries(data.roles).map(([id, name]) => [id, name, `${name} role`]));

    // ---- Organisational units and departments ------------------------
    await insertMany(connection, "organisational_units", ["id", "code", "name", "unit_type", "established_year", "status"],
      data.orgUnits.map(unit => [unit.id, unit.id, unit.name, unit.type, unit.established || null, "Active"]));

    await insertMany(connection, "departments", ["id", "code", "name", "unit_id", "head_of_department", "status"],
      data.departments.map(dept => [dept.id, dept.id, dept.name, dept.unitId || null, dept.hod || null, "Active"]));

    await insertMany(connection, "programmes",
      ["id", "code", "name", "level", "department_id", "duration_years", "credit_limit_per_semester", "credit_min_per_semester", "status"],
      data.programmes.map(p => [p.id, p.code || p.id, p.name, p.level, p.departmentId, p.durationYears || 3,
        p.creditLimitPerSemester || 18, p.creditMinPerSemester || 9, "Active"]));

    // ---- Users and role assignments ----------------------------------
    await insertMany(connection, "users",
      ["id", "username", "password_hash", "full_name", "email", "status", "department_id", "unit_id", "last_login_at"],
      // Unless the demo logins are wanted, these rows exist only so the demo
      // records can refer to them: placeholder usernames and emails (so they
      // cannot clash with real accounts), a password that matches nothing,
      // and removed again at the end of the seed.
      data.users.map(u => [u.id,
        WITH_DEMO_ACCOUNTS ? u.username : `demo-${u.id.toLowerCase()}`,
        WITH_DEMO_ACCOUNTS ? hashPassword(DEMO_PASSWORDS[u.username]) : "!",
        u.name,
        WITH_DEMO_ACCOUNTS ? u.email : `${u.id.toLowerCase()}@demo.invalid`,
        u.status || "Active", u.departmentId || null, u.unitId || null, toDateTime(u.lastLogin)]));

    await insertMany(connection, "user_roles", ["user_id", "role_id"],
      data.users.map(u => [u.id, u.role]));

    // ---- Students ----------------------------------------------------
    await insertMany(connection, "students",
      ["id", "registration_number", "first_name", "last_name", "gender", "date_of_birth", "programme_id",
       "department_id", "study_year", "status", "email", "phone", "address", "emergency_contact_name",
       "emergency_contact_relation", "emergency_contact_phone", "admission_date", "entry_qualification",
       "previous_school", "photo_url"],
      data.students.map(s => [s.id, s.regNumber, s.firstName, s.lastName, s.gender, toDate(s.dob),
        s.programmeId, s.departmentId, s.year, s.status, s.email, s.phone || null, s.address || null,
        (s.emergencyContact || {}).name || null, (s.emergencyContact || {}).relation || null,
        (s.emergencyContact || {}).phone || null, toDate((s.admission || {}).date),
        (s.admission || {}).entryQualification || null, (s.admission || {}).previousSchool || null,
        s.photo || null]));

    // ---- Academic calendar structure ---------------------------------
    await insertMany(connection, "academic_years", ["id", "label", "starts_on", "ends_on", "status"],
      data.academicYears.map(year => {
        const { startsOn, endsOn } = academicYearDates(year.label);
        return [year.id, year.label, startsOn, endsOn, year.status === "Active" ? "Active" : "Closed"];
      }));

    await insertMany(connection, "semesters",
      ["id", "academic_year_id", "semester_number", "label", "status", "registration_open", "registration_deadline", "starts_on", "ends_on"],
      data.semesters.map(sem => {
        const { startsOn, endsOn } = semesterDates(sem);
        return [sem.id, sem.academicYearId, semesterNumber(sem.id), sem.label, sem.status || "Upcoming",
          sem.registrationOpen ? 1 : 0, toDate(sem.registrationDeadline), startsOn, endsOn];
      }));

    // ---- Courses -----------------------------------------------------
    await insertMany(connection, "courses",
      ["id", "code", "title", "credits", "course_type", "department_id", "study_year", "semester_number", "status"],
      data.courses.map(c => [c.id, c.id, c.title, c.credits, c.type, c.departmentId, c.year, c.semesterNumber, c.status || "Active"]));

    await insertMany(connection, "course_programmes", ["course_id", "programme_id"],
      data.courses.flatMap(c => (c.programmeIds || []).map(programmeId => [c.id, programmeId])));

    await insertMany(connection, "course_prerequisites", ["course_id", "prerequisite_course_id"],
      data.courses.flatMap(c => (c.prerequisites || []).map(prereq => [c.id, prereq])));

    await insertMany(connection, "timetable_entries",
      ["id", "course_id", "programme_id", "study_year", "semester_id", "day_of_week", "start_time", "end_time", "room", "lecturer_name"],
      data.timetable.map(t => [t.id, t.courseId, t.programmeId, t.year, t.semesterId, t.day,
        `${t.time}:00`, endTime(t.time), t.room, t.lecturer || null]));

    // ---- Registrations -----------------------------------------------
    await insertMany(connection, "registrations",
      ["id", "student_id", "semester_id", "status", "total_credits", "registered_at"],
      data.seedRegistrations.map(r => [r.id, r.studentId, r.semesterId, r.status, r.totalCredits || 0, toDateTime(r.registeredAt)]));

    await insertMany(connection, "registration_courses", ["registration_id", "course_id"],
      data.seedRegistrations.flatMap(r => (r.courseIds || []).map(courseId => [r.id, courseId])));

    // ---- Results (total_mark is a generated column) -------------------
    await insertMany(connection, "result_records",
      ["id", "student_id", "course_id", "semester_id", "continuous_assessment", "examination_mark", "status", "published_at"],
      data.results.map(r => [r.id, r.studentId, r.courseId, r.semesterId, r.ca, r.exam, r.status,
        r.status === "Published" ? "2026-09-10 09:00:00" : null]));

    // ---- Attendance --------------------------------------------------
    // The prototype stores attendance as a per-course summary. The schema
    // models individual sessions, which is the truer record, so each
    // summary is expanded into weekly dated sessions that add back up to
    // the same totals and percentage.
    const semesterStart = new Map(data.semesters.map(sem => [sem.id, semesterDates(sem).startsOn]));
    const attendanceRows = [];
    for (const record of data.attendance) {
      const start = new Date(semesterStart.get(record.semesterId) || "2025-09-01");
      for (let session = 0; session < record.totalClasses; session++) {
        const date = new Date(start.getTime() + session * 7 * 86400000);
        attendanceRows.push([
          record.studentId, record.courseId, record.semesterId,
          date.toISOString().slice(0, 10),
          session < record.attended ? 1 : 0,
          record.lecturer || null
        ]);
      }
    }
    await insertMany(connection, "attendance_records",
      ["student_id", "course_id", "semester_id", "attendance_date", "attended", "lecturer_name"], attendanceRows);

    // ---- Finance -----------------------------------------------------
    // Invoice status is derived from the completed payments against it, so
    // the ledger stays internally consistent.
    const paidByInvoice = new Map();
    for (const payment of data.payments) {
      if (payment.status !== "Completed") continue;
      paidByInvoice.set(payment.invoiceId, (paidByInvoice.get(payment.invoiceId) || 0) + payment.amount);
    }
    await insertMany(connection, "invoices",
      ["id", "student_id", "academic_year_id", "description", "amount_billed", "issued_date", "due_date", "status"],
      data.invoices.map(inv => {
        const paid = paidByInvoice.get(inv.id) || 0;
        const status = paid <= 0 ? "Open" : paid >= Number(inv.amountBilled) ? "Paid" : "Partially Paid";
        return [inv.id, inv.studentId, inv.academicYearId, inv.description, inv.amountBilled,
          toDate(inv.issuedDate), toDate(inv.dueDate), status];
      }));

    await insertMany(connection, "payments",
      ["id", "invoice_id", "student_id", "amount", "payment_date", "payment_method", "reference", "status"],
      data.payments.map(p => [p.id, p.invoiceId, p.studentId, p.amount, toDateTime(p.date) || `${toDate(p.date)} 00:00:00`,
        p.method, p.reference, p.status]));

    // ---- Service requests and complaints -----------------------------
    // Requests are raised by a student; map to the owning user account
    // where one exists so submitted_by is a real foreign key.
    const userIdByStudentId = new Map(data.users.filter(u => u.studentId).map(u => [u.studentId, u.id]));

    await insertMany(connection, "service_requests",
      ["id", "student_id", "submitted_by", "request_type", "subject", "description", "status", "priority", "attachment", "timeline", "created_at"],
      data.seedRequests.map(r => [r.id, r.studentId, userIdByStudentId.get(r.studentId) || null, r.type,
        r.subject || r.type, r.description, r.status, r.priority || "MEDIUM", r.attachment || null,
        JSON.stringify(r.timeline || []), toDateTime(r.createdAt)]));

    await insertMany(connection, "complaints",
      ["id", "submitted_by", "student_id", "category", "subject", "description", "status", "priority", "attachment", "assigned_office", "timeline", "created_at"],
      data.seedComplaints.map(c => [c.id, userIdByStudentId.get(c.studentId) || null, c.studentId, c.category,
        c.subject || c.category, c.description, c.status, c.priority || "MEDIUM", c.attachment || null,
        c.assignedTo || null, JSON.stringify(c.timeline || []), toDateTime(c.createdAt)]));

    // ---- Announcements and notifications -----------------------------
    await insertMany(connection, "announcements",
      ["id", "title", "body", "audience_role", "tone", "published_by", "published_at", "expires_at", "status"],
      data.seedAnnouncements.map(a => [a.id, a.title, a.body, a.audience === "ALL" ? null : a.audience,
        a.tone || "info", a.publishedBy, toDateTime(a.publishedDate) || `${toDate(a.publishedDate)} 09:00:00`,
        toDateTime(a.expiresAt), "Published"]));

    // A notification addressed to "ALL" is fanned out to one row per user
    // rather than stored once. Read state belongs to the reader: with a
    // single shared row, one student opening an announcement would mark it
    // read for the whole university.
    const notificationRows = [];
    for (const notification of data.seedNotifications) {
      const recipients = notification.target === "ALL" ? data.users.map(u => u.id) : [notification.target];
      recipients.forEach(userId => {
        notificationRows.push([
          recipients.length > 1 ? `${notification.id}-${userId}` : notification.id,
          userId,
          notification.target === "ALL" ? "ALL" : null,
          notification.category, notification.title, notification.description,
          notification.read ? 1 : 0, toDateTime(notification.date)
        ]);
      });
    }
    await insertMany(connection, "notifications",
      ["id", "user_id", "audience", "category", "title", "message", "is_read", "created_at"], notificationRows);

    // ---- Documents ---------------------------------------------------
    await insertMany(connection, "document_submissions",
      ["id", "student_id", "document_type", "file_name", "file_url", "uploaded_at", "status"],
      data.seedDocuments.map(d => [d.id, d.studentId, d.type, d.name, d.url || null, toDate(d.uploadDate), d.status]));

    // ---- Hostels (currently no on-campus accommodation) --------------
    await insertMany(connection, "hostels", ["id", "name", "location", "status"],
      (data.seedHostels || []).map(h => [h.id, h.name, h.location || null, h.status || "Active"]));

    await insertMany(connection, "hostel_rooms", ["id", "hostel_id", "room_number", "capacity", "status"],
      (data.seedRooms || []).map(r => [r.id, r.hostelId, r.roomNumber, r.capacity, r.status || "Available"]));

    await insertMany(connection, "hostel_allocations",
      ["id", "student_id", "room_id", "academic_year_id", "status", "requested_date", "allocated_at"],
      (data.seedAllocations || []).map(a => [a.id, a.studentId, a.roomId || null, a.academicYearId,
        a.status, toDate(a.requestedDate), toDateTime(a.allocatedDate)]));

    // ---- Library -----------------------------------------------------
    // available_copies is derived from the loans that are still open.
    const openLoansByBook = new Map();
    for (const loan of data.seedLoans) {
      if (loan.returnedDate) continue;
      openLoansByBook.set(loan.bookId, (openLoansByBook.get(loan.bookId) || 0) + 1);
    }
    await insertMany(connection, "library_books",
      ["id", "isbn", "title", "author", "category", "total_copies", "available_copies", "status"],
      data.seedBooks.map(b => [b.id, b.isbn || null, b.title, b.author, b.category || null, b.totalCopies,
        Math.max(0, b.totalCopies - (openLoansByBook.get(b.id) || 0)), "Available"]));

    await insertMany(connection, "library_loans",
      ["id", "book_id", "student_id", "borrowed_at", "due_at", "returned_at", "status"],
      data.seedLoans.map(l => [l.id, l.bookId, l.studentId, `${toDate(l.borrowedDate)} 09:00:00`,
        `${toDate(l.dueDate)} 17:00:00`, l.returnedDate ? `${toDate(l.returnedDate)} 12:00:00` : null, l.status]));

    // ---- Internships -------------------------------------------------
    await insertMany(connection, "internship_records",
      ["id", "student_id", "organisation_name", "location", "supervisor_name", "start_date", "end_date",
       "status", "logbook_entries", "supervisor_score", "academic_score", "final_grade", "report_url"],
      data.seedInternships.map(i => [i.id, i.studentId, i.organization, i.location || null, i.supervisor || null,
        toDate(i.startDate), toDate(i.endDate), i.status, i.logbookEntries || 0,
        (i.assessment || {}).supervisorScore ?? null, (i.assessment || {}).academicScore ?? null,
        (i.assessment || {}).finalGrade || null, i.reportUrl || null]));

    // ---- Graduation clearance ----------------------------------------
    await insertMany(connection, "graduation_clearance",
      ["id", "student_id", "academic_year_id", "checklist", "application_submitted", "overall_status"],
      data.seedGraduation.map(g => {
        const checklist = g.checklist || {};
        const allCleared = Object.values(checklist).every(Boolean);
        return [g.id, g.studentId, g.academicYearId || "AY2025", JSON.stringify(checklist),
          g.applicationSubmitted ? 1 : 0, allCleared ? "Cleared" : "Pending"];
      }));

    // ---- Alumni, QA flags, calendar ----------------------------------
    await insertMany(connection, "alumni",
      ["id", "full_name", "registration_number", "programme_id", "graduation_year", "employment_status", "organisation", "contact"],
      data.alumni.map(a => [a.id, a.name, a.regNumber, a.programmeId, a.graduationYear,
        a.employmentStatus, a.organization || null, a.contact || null]));

    await insertMany(connection, "qa_flags",
      ["id", "category", "severity", "entity_id", "entity_label", "description", "raised_on", "status"],
      data.qaFlags.map(f => [f.id, f.category, f.severity, f.entity || null, f.entityLabel || null,
        f.description, toDate(f.date), f.status]));

    await insertMany(connection, "calendar_events", ["id", "title", "description", "event_date", "end_date"],
      data.academicCalendar.map(e => [e.id, e.title, e.description || null, toDate(e.date), toDate(e.endDate)]));

    await insertMany(connection, "public_holidays", ["id", "holiday_date", "title"],
      data.publicHolidays.map(h => [h.id, toDate(h.date), h.title]));

    // ---- E-learning --------------------------------------------------
    await insertMany(connection, "elearning_materials",
      ["id", "course_id", "title", "material_type", "file_url", "uploaded_at"],
      data.seedMaterials.map(m => [m.id, m.courseId, m.title, m.type, m.url || null, toDate(m.uploadedDate)]));

    await insertMany(connection, "elearning_assignments",
      ["id", "course_id", "title", "description", "due_date", "max_score"],
      data.seedAssignments.map(a => [a.id, a.courseId, a.title, a.description || null, toDate(a.dueDate), a.maxScore || 100]));

    await insertMany(connection, "elearning_submissions",
      ["id", "assignment_id", "student_id", "submitted_at", "note", "score", "status"],
      data.seedSubmissions.map(s => [s.id, s.assignmentId, s.studentId, toDate(s.submittedDate),
        s.note || null, s.score ?? null, s.status]));

    // ---- Admissions --------------------------------------------------
    await insertMany(connection, "admission_applications",
      ["id", "full_name", "email", "phone", "gender", "programme_id", "previous_school", "entry_qualification", "application_date", "status", "notes"],
      data.seedApplications.map(a => [a.id, a.fullName, a.email, a.phone, a.gender, a.programmeId,
        a.previousSchool, a.entryQualification, toDate(a.applicationDate), a.status, a.notes || ""]));

    // ---- Audit trail -------------------------------------------------
    // The acting account is stored by name as well as id: the trail must
    // stay readable if the account is later removed.
    const userIdByName = new Map(data.users.map(u => [u.name, u.id]));
    await insertMany(connection, "audit_logs",
      ["user_id", "user_name", "user_role", "action", "entity_type", "entity_id", "status", "ip_address", "created_at"],
      data.seedAuditLogs.map(log => [userIdByName.get(log.user) || null, log.user, log.role === "-" ? null : log.role,
        log.action, log.entity, log.entityId || null, log.status || "Success", log.ip || null,
        `${toDate(log.date)} ${log.time || "00:00"}:00`]));

    // ---- Elections ---------------------------------------------------
    // The election and its positions are seeded with everything else, so
    // `npm run db:setup`, which recreates the schema from scratch, still
    // produces a working ballot.
    await insertMany(connection, "elections", ["id", "name", "description", "starts_at", "ends_at", "status"],
      [["UDOSO-2026", "UDOSO General Election 2026", "Student union election managed through USIAMS.",
        "2026-09-16 08:00:00", "2026-10-07 18:00:00", "Open"]]);

    await insertMany(connection, "election_positions", ["id", "election_id", "name", "display_order"], [
      ["UDOSO-2026-PRESIDENT", "UDOSO-2026", "President", 1],
      ["UDOSO-2026-VPRESIDENT", "UDOSO-2026", "Vice President", 2],
      ["UDOSO-2026-SECRETARY", "UDOSO-2026", "Secretary General", 3]
    ]);

    // The data files carry no candidate list, so the standing election is
    // given approved candidates drawn from the student register - without
    // them the ballot renders empty and voting cannot be exercised.
    const [positions] = await connection.query("SELECT id, display_order FROM election_positions ORDER BY display_order");
    const candidateStudents = data.students.filter(s => s.status === "Active").slice(0, 12);
    const candidateRows = [];
    positions.forEach((position, index) => {
      for (let slot = 0; slot < 3; slot++) {
        const student = candidateStudents[index * 3 + slot];
        if (!student) continue;
        candidateRows.push([
          `CAND-${position.id}-${slot + 1}`, position.id, student.id,
          `${student.fullName} stands for this office on a platform of transparency, student welfare and academic support.`,
          "Approved"
        ]);
      }
    });
    await insertMany(connection, "election_candidates", ["id", "position_id", "student_id", "manifesto", "status"], candidateRows);

    if (!WITH_DEMO_ACCOUNTS) {
      const result = await removeAccounts(connection, demoIds);
      console.log(`  demo accounts removed     ${result.removed}`);
      for (const [table, n] of Object.entries(result.deleted)) console.log(`    deleted with them: ${table} ${n}`);
      for (const [column, n] of Object.entries(result.cleared)) console.log(`    link cleared: ${column} ${n}`);
      const [[{ remaining }]] = await connection.query("SELECT COUNT(*) AS remaining FROM users");
      if (!remaining) console.log("USIAMS: there are no sign-in accounts yet. Create the first administrator with: npm run create-admin");
    }
    console.log("USIAMS: seed complete.");
  } finally {
    await connection.end();
  }
}

seed().catch(error => {
  console.error("USIAMS: seeding failed:", error.message);
  if (error.sql) console.error("  statement:", String(error.sql).slice(0, 300));
  process.exit(1);
});

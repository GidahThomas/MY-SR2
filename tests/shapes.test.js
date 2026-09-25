/* =========================================================
   USIAMS - tests/shapes.test.js
   Guards the contract between the API and the page modules.

   The modules were written against the generated data/*.js seed
   files and read shapes the database does not store directly: a
   student's fullName and nested emergencyContact/admission, a
   timetable entry's "time", an internship's assessment block, a
   user's role. db/resources.js reconciles the two with transform
   hooks; this suite fails if any of that drifts apart again.
   ========================================================= */
const path = require("node:path");
const { loadSeedData } = require(path.join(__dirname, "..", "db", "load-seed-data"));

const BASE = process.env.BASE || "http://127.0.0.1:3311";
let pass = 0, fail = 0;
const check = (l, c, d = "") => { c ? (pass++, console.log("  PASS " + l)) : (fail++, console.log("  FAIL " + l + (d ? " -> " + d : ""))); };

const login = async (u, p) => (await (await fetch(BASE + "/api/auth/login", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: u, password: p })
})).json());

const call = async (path, { method = "GET", token, body } = {}) => {
  const r = await fetch(BASE + path, {
    method,
    headers: { ...(token ? { Authorization: "Bearer " + token } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, json: j };
};

// Fields the API deliberately does not return.
const WITHHELD = { users: ["password"] };

const ALIASES = {
  attendanceSummary: "attendance", books: "seedBooks", loans: "seedLoans",
  requests: "seedRequests", complaints: "seedComplaints", announcements: "seedAnnouncements",
  notifications: "seedNotifications", documents: "seedDocuments", internships: "seedInternships",
  graduation: "seedGraduation", materials: "seedMaterials", assignments: "seedAssignments",
  submissions: "seedSubmissions", applications: "seedApplications", auditLogs: "seedAuditLogs",
  registrations: "seedRegistrations", calendar: "academicCalendar", holidays: "publicHolidays",
  hostelAllocations: "seedAllocations", students: "students", courses: "courses",
  programmes: "programmes", departments: "departments", orgUnits: "orgUnits",
  semesters: "semesters", academicYears: "academicYears", timetable: "timetable",
  results: "results", invoices: "invoices", payments: "payments", alumni: "alumni",
  qaFlags: "qaFlags", users: "users"
};

function keysOf(list) {
  const keys = new Set();
  for (const item of (list || []).slice(0, 40)) {
    if (item && typeof item === "object") Object.keys(item).forEach(k => keys.add(k));
  }
  return keys;
}

(async () => {
  const seed = loadSeedData();
  const admin = await login("admin", "admin123");
  const boot = await call("/api/bootstrap", { token: admin.token });

  console.log("== Every field the modules read is still served ==");
  let drifted = [];
  for (const [resource, alias] of Object.entries(ALIASES)) {
    const seedList = seed[alias];
    const apiList = boot.json.data[alias];
    if (!seedList || !seedList.length || !apiList) continue;
    const lost = [...keysOf(seedList)].filter(k => !keysOf(apiList).has(k) && !(WITHHELD[resource] || []).includes(k));
    if (lost.length) drifted.push(`${alias}: ${lost.join(", ")}`);
  }
  check("no dataset lost a field", drifted.length === 0, drifted.join(" | "));

  console.log("\n== Derived and nested shapes ==");
  const student = (await call("/api/data/students", { token: admin.token })).json.data[0];
  check("student has a derived fullName", student.fullName === `${student.firstName} ${student.lastName}`, student.fullName);
  check("student emergencyContact is nested", student.emergencyContact && "name" in student.emergencyContact);
  check("student admission is nested", student.admission && "date" in student.admission);

  const entry = (await call("/api/data/timetable", { token: admin.token })).json.data[0];
  check("timetable time matches a grid slot", /^\d{2}:\d{2}$/.test(entry.time), entry.time);
  check("timetable slot is one of the six", ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"].includes(entry.time), entry.time);

  const internships = (await call("/api/data/internships", { token: admin.token })).json.data;
  const assessed = internships.find(i => i.assessment);
  check("an assessed internship nests its scores",
    assessed && typeof assessed.assessment.supervisorScore === "number" && "finalGrade" in assessed.assessment,
    JSON.stringify(assessed && assessed.assessment));
  check("an unassessed internship has no assessment block", internships.some(i => i.assessment === null));

  const log = (await call("/api/data/auditLogs", { token: admin.token })).json.data[0];
  check("audit date is a plain date", /^\d{4}-\d{2}-\d{2}$/.test(log.date), log.date);
  check("audit time is separate", /^\d{2}:\d{2}$/.test(log.time), log.time);

  console.log("\n== User accounts ==");
  const users = (await call("/api/data/users", { token: admin.token })).json.data;
  check("every account reports a role", users.every(u => !!u.role), String(users.filter(u => !u.role).length) + " without");
  check("a student account links to its student record",
    users.find(u => u.username === "student").studentId === "STU-0001");
  check("a college admin keeps its unit", users.find(u => u.username === "collegeadmin").unitId === "CIVE");
  check("no password hash is ever served", !/[0-9a-f]{128}/.test(JSON.stringify(users)));

  console.log("\n== Writes round-trip through the transforms ==");
  // What pages/profile-setup.html sends.
  const patched = await call("/api/data/students/STU-0002", {
    method: "PATCH", token: admin.token,
    body: { emergencyContact: { name: "Test Guardian", relation: "Aunt", phone: "+255700111222" },
            admission: { date: "2023-10-02", entryQualification: "ACSEE", previousSchool: "Test School" } }
  });
  check("nested student write is flattened and stored",
    patched.status === 200 && patched.json.data.emergencyContact.name === "Test Guardian" &&
    patched.json.data.admission.previousSchool === "Test School",
    JSON.stringify(patched.json).slice(0, 200));

  // What pages/administration.html sends when adding a user.
  const created = await call("/api/data/users", {
    method: "POST", token: admin.token,
    body: { id: "USR-SHAPETEST", name: "Shape Test", username: "shapetest", email: "shape.test@usiams.ac.tz",
            role: "LECTURER", password: "changeme123", status: "Active", lastLogin: null }
  });
  check("admin creates an account", created.status === 201, JSON.stringify(created.json).slice(0, 200));
  check("the new account's role was saved", created.json.data && created.json.data.role === "LECTURER",
    created.json.data && created.json.data.role);
  const canSignIn = await login("shapetest", "changeme123");
  check("the temporary password actually works", !!canSignIn.token, JSON.stringify(canSignIn).slice(0, 120));
  check("the password was hashed, not stored as typed", !!canSignIn.token);

  const rerole = await call("/api/data/users/USR-SHAPETEST", { method: "PATCH", token: admin.token, body: { role: "LIBRARIAN" } });
  check("role change is written to the join table", rerole.status === 200 && rerole.json.data.role === "LIBRARIAN",
    rerole.json.data && rerole.json.data.role);

  await call("/api/data/users/USR-SHAPETEST", { method: "DELETE", token: admin.token });
  const gone = await call("/api/data/users/USR-SHAPETEST", { token: admin.token });
  check("account removed again", gone.status === 404);

  // Timetable entries are written back with the grid's "time".
  const ttCreated = await call("/api/data/timetable", {
    method: "POST", token: admin.token,
    body: { id: "TT-SHAPETEST", courseId: "CP101", programmeId: "BSCS", year: 1, semesterId: "AY2025-S1",
            day: "Monday", time: "10:00", room: "001B", lecturer: "Dr. Amani Mrema" }
  });
  check("timetable write accepts a grid slot", ttCreated.status === 201 && ttCreated.json.data.time === "10:00",
    JSON.stringify(ttCreated.json).slice(0, 180));
  check("start and end times were derived",
    ttCreated.json.data && ttCreated.json.data.startTime === "10:00:00" && ttCreated.json.data.endTime === "12:00:00",
    ttCreated.json.data && ttCreated.json.data.startTime + "/" + ttCreated.json.data.endTime);
  await call("/api/data/timetable/TT-SHAPETEST", { method: "DELETE", token: admin.token });

  console.log("\n" + (fail === 0 ? "ALL PASS" : "FAILURES: " + fail) + "  (" + pass + " passed)");
  process.exit(fail === 0 ? 0 : 1);
})();

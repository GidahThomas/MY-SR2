/* =========================================================
   USIAMS - server.js
   HTTP server: static file hosting plus the REST API that backs
   every module in the application.

   Authorisation lives here and in db/resources.js, not in the
   browser. js/auth.js only decides what to draw; each request is
   re-checked against the role on the server-side session, and the
   Quality Assurance Officer is enforced as strictly read-only.
   ========================================================= */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { config } = require("./config");
const db = require("./db");
const repo = require("./db/repository");
const { RESOURCES, READ_ONLY_ROLES } = require("./db/resources");

const ROOT = __dirname;
const sessions = new Map();

// ---------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------
function accountId() {
  return `USR-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
}

function safeEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function publicUser(account) {
  return {
    id: account.id,
    username: account.username,
    name: account.name,
    email: account.email,
    role: account.role,
    roles: account.roles || [account.role],
    roleLabel: String(account.role || "").toLowerCase().split("_")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" "),
    studentId: account.studentId || null
  };
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(JSON.stringify(body));
}

function getToken(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

function authenticatedUser(req) {
  const token = getToken(req);
  const session = token && sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    if (token) sessions.delete(token);
    return null;
  }
  return { token, user: session.user };
}

function requireUser(req, res) {
  const session = authenticatedUser(req);
  if (!session) {
    sendJson(res, 401, { success: false, message: "Authentication required." });
    return null;
  }
  return session;
}

function clientIp(req) {
  return (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress || null;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > 1024 * 1024) req.destroy();
    });
    req.on("end", () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { reject(new Error("Invalid JSON body.")); }
    });
    req.on("error", reject);
  });
}

// ---------------------------------------------------------------------
// Authorisation
// ---------------------------------------------------------------------
/**
 * The query scope for a caller. Students are limited to their own student
 * records; personal resources such as notifications are limited to the
 * owning account for every role. db/repository.js decides which applies.
 */
function scopeFor(user) {
  return { studentId: user.studentId, userId: user.id, role: user.role };
}

function canRead(resource, role) {
  return (resource.read || []).includes(role);
}

/**
 * Write authorisation. Read-only roles are refused before the resource's own
 * list is consulted, so no resource entry can accidentally grant them access.
 * A student may write a self-service resource, but only rows they own.
 */
function canWrite(resource, user, { owner, operation = "create" } = {}) {
  if (READ_ONLY_ROLES.includes(user.role)) return false;

  if (user.role === "STUDENT") {
    if (!resource.selfService) return false;
    // Resources are owned either by a student record or by a user account.
    const expected = resource.ownerUserField ? user.id : user.studentId;
    if (!expected) return false;
    return owner === undefined || owner === null || owner === expected;
  }

  if (!(resource.write || []).includes(user.role)) return false;

  // Personal correspondence stays personal: a staff account may send a
  // notification to anyone, but may only mark read or delete its own.
  if (resource.ownerUserField && operation !== "create") {
    return owner === undefined || owner === null || owner === user.id;
  }
  return true;
}

/** The field naming a row's owner, and the caller's matching identity. */
function ownerFieldOf(resource) {
  return resource.ownerUserField || resource.ownerField || null;
}

function ownerIdentity(resource, user) {
  return resource.ownerUserField ? user.id : user.studentId;
}

// Roles that can administer accounts. If every one of these is deactivated
// or removed, nobody can ever restore them.
const ACCOUNT_ADMIN_ROLES = ["SYSTEM_ADMIN", "UNIVERSITY_ADMIN"];

/**
 * Ends every session belonging to an account. Sessions are checked against
 * the status held at sign-in, so without this a suspended or deleted account
 * kept working until its token expired - up to eight hours after an
 * administrator believed they had revoked it.
 */
function revokeSessionsFor(userId) {
  let revoked = 0;
  for (const [token, session] of sessions) {
    if (session.user.id === userId) { sessions.delete(token); revoked++; }
  }
  return revoked;
}

/**
 * Stops the two account changes that cannot be undone from inside the
 * application: signing out your own access, and removing the last account
 * able to administer accounts. Nothing in the interface prevented either,
 * so an administrator could deactivate themselves and lock the whole
 * institution out of USIAMS.
 *
 * Returns a message when the change must be refused, or null to allow it.
 */
async function accountChangeRefusal({ operation, targetId, patch, actor }) {
  const deactivating = operation === "delete" ||
    (patch && typeof patch.status === "string" && patch.status !== "Active");
  if (!deactivating) return null;

  if (targetId === actor.id) {
    return operation === "delete"
      ? "You cannot delete the account you are signed in with."
      : "You cannot deactivate the account you are signed in with.";
  }

  const remaining = await repo.query(`
    SELECT COUNT(*) AS remaining
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    WHERE u.status = 'Active' AND u.id <> ? AND ur.role_id IN (?, ?)
  `, [targetId, ...ACCOUNT_ADMIN_ROLES]);

  if (Number(remaining[0].remaining) === 0) {
    return "This is the last active administrator account. Grant another account an administrator role before changing this one.";
  }
  return null;
}

function denyWrite(res, user) {
  const message = READ_ONLY_ROLES.includes(user.role)
    ? `${publicUser(user).roleLabel} has read-only access and cannot modify records.`
    : "Your role is not permitted to perform this action.";
  sendJson(res, 403, { success: false, message });
}

// ---------------------------------------------------------------------
// Resource API: /api/data/:resource[/:id]
// ---------------------------------------------------------------------
async function handleResourceRoute(req, res, url, session) {
  const [, , , name, id] = url.pathname.split("/");
  const resource = RESOURCES[name];
  if (!resource) { sendJson(res, 404, { success: false, message: "Unknown resource." }); return; }
  const { user } = session;

  if (req.method === "GET") {
    if (!canRead(resource, user.role)) {
      sendJson(res, 403, { success: false, message: "Your role is not permitted to view this data." });
      return;
    }
    const scope = scopeFor(user);
    const payload = id
      ? await repo.getById(name, id, { scope })
      : await repo.list(name, { scope });
    if (id && !payload) { sendJson(res, 404, { success: false, message: "Record not found." }); return; }
    sendJson(res, 200, { success: true, data: payload });
    return;
  }

  if (req.method === "POST") {
    const body = await readBody(req);
    const ownerField = ownerFieldOf(resource);
    // A student may only file records against their own identity.
    const owner = ownerField ? body[ownerField] : undefined;
    if (!canWrite(resource, user, { owner })) { denyWrite(res, user); return; }
    if (user.role === "STUDENT" && ownerField) body[ownerField] = ownerIdentity(resource, user);

    // A notification addressed to "ALL" is delivered as one row per
    // recipient, so each reader has their own read state.
    if (name === "notifications" && body.target === "ALL") {
      const recipients = await repo.query("SELECT id FROM users WHERE status = 'Active'");
      const stamp = Date.now().toString(36).toUpperCase();
      const delivered = [];
      for (const recipient of recipients) {
        delivered.push(await repo.create(name, {
          ...body, id: `NTF-${stamp}-${recipient.id}`, target: recipient.id, audience: "ALL", read: false
        }));
      }
      await db.recordAudit({
        userId: user.id, userName: user.name, userRole: user.role, action: "CREATE",
        entityType: name, entityId: `broadcast:${stamp}`, ip: clientIp(req)
      });
      sendJson(res, 201, { success: true, data: delivered });
      return;
    }

    const created = await repo.create(name, body);
    await db.recordAudit({
      userId: user.id, userName: user.name, userRole: user.role, action: "CREATE",
      entityType: name, entityId: created && created.id, ip: clientIp(req)
    });
    sendJson(res, 201, { success: true, data: created });
    return;
  }

  if (req.method === "PATCH" || req.method === "PUT") {
    if (!id) { sendJson(res, 400, { success: false, message: "A record id is required." }); return; }
    const existing = await repo.getById(name, id);
    if (!existing) { sendJson(res, 404, { success: false, message: "Record not found." }); return; }
    const ownerField = ownerFieldOf(resource);
    if (!canWrite(resource, user, { owner: ownerField ? existing[ownerField] : undefined, operation: "update" })) { denyWrite(res, user); return; }
    const body = await readBody(req);
    // The owner of a record can never be reassigned through an update.
    if (ownerField) delete body[ownerField];
    delete body.id;
    if (name === "users") {
      const refusal = await accountChangeRefusal({ operation: "update", targetId: id, patch: body, actor: user });
      if (refusal) { sendJson(res, 409, { success: false, message: refusal }); return; }
    }
    const updated = await repo.update(name, id, body);
    // Suspending an account has to take effect now, not when its token
    // happens to expire.
    if (name === "users" && updated && updated.status !== "Active") revokeSessionsFor(id);
    await db.recordAudit({
      userId: user.id, userName: user.name, userRole: user.role, action: "UPDATE",
      entityType: name, entityId: id, ip: clientIp(req)
    });
    sendJson(res, 200, { success: true, data: updated });
    return;
  }

  if (req.method === "DELETE") {
    if (!id) { sendJson(res, 400, { success: false, message: "A record id is required." }); return; }
    const existing = await repo.getById(name, id);
    if (!existing) { sendJson(res, 404, { success: false, message: "Record not found." }); return; }
    const ownerField = ownerFieldOf(resource);
    if (!canWrite(resource, user, { owner: ownerField ? existing[ownerField] : undefined, operation: "delete" })) { denyWrite(res, user); return; }
    if (name === "users") {
      const refusal = await accountChangeRefusal({ operation: "delete", targetId: id, actor: user });
      if (refusal) { sendJson(res, 409, { success: false, message: refusal }); return; }
    }
    await repo.remove(name, id);
    if (name === "users") revokeSessionsFor(id);
    await db.recordAudit({
      userId: user.id, userName: user.name, userRole: user.role, action: "DELETE",
      entityType: name, entityId: id, ip: clientIp(req)
    });
    sendJson(res, 200, { success: true });
    return;
  }

  sendJson(res, 405, { success: false, message: "Method not allowed." });
}

// ---------------------------------------------------------------------
// Bootstrap: every dataset the caller may read, in one request.
// ---------------------------------------------------------------------
// Loading a page previously meant pulling in 25 generated seed files. The
// browser now fetches this instead: one round trip, already filtered to what
// the signed-in role is allowed to see.
const BOOTSTRAP_RESOURCES = [
  "orgUnits", "departments", "programmes", "academicYears", "semesters", "courses",
  "students", "timetable", "registrations", "results", "attendanceSummary", "invoices",
  "payments", "requests", "complaints", "announcements", "notifications", "documents",
  "hostels", "hostelRooms", "hostelAllocations", "books", "loans", "internships",
  "graduation", "alumni", "qaFlags", "calendar", "holidays", "materials", "assignments",
  "submissions", "applications", "auditLogs", "users"
];

// The frontend keeps these under different names from the resource route.
const BOOTSTRAP_ALIASES = {
  attendanceSummary: "attendance", students: "students", books: "seedBooks", loans: "seedLoans",
  requests: "seedRequests", complaints: "seedComplaints", announcements: "seedAnnouncements",
  notifications: "seedNotifications", documents: "seedDocuments", hostels: "seedHostels",
  hostelRooms: "seedRooms", hostelAllocations: "seedAllocations", internships: "seedInternships",
  graduation: "seedGraduation", materials: "seedMaterials", assignments: "seedAssignments",
  submissions: "seedSubmissions", applications: "seedApplications", auditLogs: "seedAuditLogs",
  registrations: "seedRegistrations", calendar: "academicCalendar", holidays: "publicHolidays"
};

async function handleBootstrap(req, res, session) {
  const { user } = session;
  const scope = scopeFor(user);
  const data = {};
  const skipped = [];
  for (const name of BOOTSTRAP_RESOURCES) {
    const resource = RESOURCES[name];
    if (!canRead(resource, user.role)) { skipped.push(name); continue; }
    const rows = await repo.list(name, { scope });
    data[BOOTSTRAP_ALIASES[name] || name] = rows;
  }
  sendJson(res, 200, { success: true, user, data, withheld: skipped, generatedAt: new Date().toISOString() });
}

// ---------------------------------------------------------------------
// Dashboard summary
// ---------------------------------------------------------------------
async function handleDashboardSummary(req, res, session) {
  const { user } = session;
  const counts = await repo.query(`
    SELECT
      (SELECT COUNT(*) FROM students WHERE status = 'Active') AS activeStudents,
      (SELECT COUNT(*) FROM students) AS totalStudents,
      (SELECT COUNT(*) FROM courses WHERE status = 'Active') AS activeCourses,
      (SELECT COUNT(*) FROM programmes WHERE status = 'Active') AS activeProgrammes,
      (SELECT COUNT(*) FROM registrations WHERE status = 'Registered') AS registrations,
      (SELECT COUNT(*) FROM service_requests WHERE status IN ('PENDING','IN_PROGRESS')) AS openRequests,
      (SELECT COUNT(*) FROM complaints WHERE status IN ('PENDING','IN_PROGRESS')) AS openComplaints,
      (SELECT COUNT(*) FROM admission_applications WHERE status = 'Submitted') AS newApplications,
      (SELECT COUNT(*) FROM library_loans WHERE returned_at IS NULL) AS activeLoans,
      (SELECT COALESCE(SUM(amount_billed), 0) FROM invoices) AS totalBilled,
      (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'Completed') AS totalCollected
  `);
  sendJson(res, 200, { success: true, user, summary: counts[0] });
}

// ---------------------------------------------------------------------
// Static files
// ---------------------------------------------------------------------
function contentType(filePath) {
  const types = {
    ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json",
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml",
    ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2"
  };
  return types[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

// Only the browser-facing part of the project is public. Without this the
// static handler happily served server.js, db.js, the SQL scripts and - once
// the operator follows db/README.md and creates one - .env with the database
// password in it.
const PUBLIC_DIRECTORIES = ["css", "js", "data", "components", "assets", "modules", "pages"];

function isPublicPath(relativePath) {
  const normalized = relativePath.split(path.sep).join("/");
  if (!normalized || normalized.startsWith("..")) return false;
  const segments = normalized.split("/");
  // A file at the root is public only if it is a page.
  if (segments.length === 1) return segments[0].toLowerCase().endsWith(".html");
  return PUBLIC_DIRECTORIES.includes(segments[0]);
}

function serveStatic(req, res, pathname) {
  const requested = pathname === "/" ? "/login.html" : pathname;
  const filePath = path.resolve(ROOT, `.${requested}`);
  const relativePath = path.relative(ROOT, filePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath) || !isPublicPath(relativePath) ||
      !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    const notFound = path.join(ROOT, "pages", "404.html");
    if (fs.existsSync(notFound) && req.headers.accept && req.headers.accept.includes("text/html")) {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      fs.createReadStream(notFound).pipe(res);
      return;
    }
    sendJson(res, 404, { success: false, message: "Resource not found." });
    return;
  }
  res.writeHead(200, { "Content-Type": `${contentType(filePath)}; charset=utf-8` });
  fs.createReadStream(filePath).pipe(res);
}

// ---------------------------------------------------------------------
// API router
// ---------------------------------------------------------------------
async function handleApi(req, res, url) {
  if (req.method === "OPTIONS") { sendJson(res, 204, {}); return; }

  if (req.method === "GET" && url.pathname === "/api/health") {
    const databaseConnected = await db.health();
    sendJson(res, databaseConnected ? 200 : 503, {
      success: databaseConnected,
      service: "usiams-api",
      database: databaseConnected ? "connected" : "unavailable",
      time: new Date().toISOString()
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    try {
      const { username, password } = await readBody(req);
      const account = await db.findUser(String(username || ""));
      if (!account || !safeEqual(account.passwordHash, db.hashPassword(String(password || ""))) || account.status !== "Active" || !account.role) {
        await db.recordAudit({
          userName: String(username || "").slice(0, 80), action: "LOGIN", entityType: "Session",
          status: "Failed", ip: clientIp(req)
        });
        sendJson(res, 401, { success: false, message: "Invalid username or password. Please check your credentials and try again." });
        return;
      }
      const token = crypto.randomBytes(32).toString("hex");
      const user = publicUser(account);
      await db.recordLogin(account.id);
      await db.recordAudit({
        userId: user.id, userName: user.name, userRole: user.role, action: "LOGIN",
        entityType: "Session", entityId: token.slice(0, 8).toUpperCase(), ip: clientIp(req)
      });
      sessions.set(token, { user, expiresAt: Date.now() + config.sessionTtlMs });
      sendJson(res, 200, { success: true, token, user });
    } catch (error) {
      console.error("USIAMS database authentication failed:", error.message);
      sendJson(res, 503, { success: false, message: "The database is unavailable. Check MySQL and the DB_* environment settings." });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/register") {
    try {
      const { username, fullName, email, password, programmeId } = await readBody(req);
      const normalizedUsername = String(username || "").trim().toLowerCase();
      const normalizedEmail = String(email || "").trim().toLowerCase();
      const normalizedName = String(fullName || "").trim();
      const plainPassword = String(password || "");
      const normalizedProgramme = String(programmeId || "").trim();
      if (!/^[a-z0-9._-]{3,80}$/.test(normalizedUsername)) {
        sendJson(res, 422, { success: false, message: "Username must be 3-80 characters and use letters, numbers, dots, underscores, or hyphens." });
        return;
      }
      if (!normalizedName || !/^\S+@\S+\.\S+$/.test(normalizedEmail) || plainPassword.length < 8) {
        sendJson(res, 422, { success: false, message: "Enter a full name, valid email, and password of at least 8 characters." });
        return;
      }
      // A student account is only usable with a student record behind it, and
      // that record needs a programme - it determines the department and the
      // registration number.
      if (!normalizedProgramme) {
        sendJson(res, 422, { success: false, message: "Choose the programme you are joining." });
        return;
      }
      if (await db.findUser(normalizedUsername)) {
        sendJson(res, 409, { success: false, message: "That username is already registered." });
        return;
      }
      if (await db.findUserByEmail(normalizedEmail)) {
        sendJson(res, 409, { success: false, message: "That email address is already registered." });
        return;
      }
      const id = accountId();
      const created = await db.createStudentAccount({
        id, username: normalizedUsername, passwordHash: db.hashPassword(plainPassword),
        fullName: normalizedName, email: normalizedEmail, programmeId: normalizedProgramme
      });
      await db.recordAudit({ userId: id, userName: normalizedName, userRole: "STUDENT", action: "REGISTER", entityType: "User", entityId: id, ip: clientIp(req) });
      sendJson(res, 201, {
        success: true,
        studentId: created.studentId,
        message: "Account created. You can now sign in."
      });
    } catch (error) {
      console.error("USIAMS account creation failed:", error.message);
      const duplicate = error.code === "ER_DUP_ENTRY";
      const badProgramme = error.code === "INVALID_PROGRAMME" || error.code === "ER_NO_REFERENCED_ROW_2";
      sendJson(res, duplicate ? 409 : badProgramme ? 422 : 503, {
        success: false,
        message: duplicate ? "That username or email is already registered."
          : badProgramme ? "The selected programme is not available."
          : "The database is unavailable. Check MySQL and try again."
      });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/reset-password") {
    try {
      const { username, email, password } = await readBody(req);
      const normalizedUsername = String(username || "").trim().toLowerCase();
      const normalizedEmail = String(email || "").trim().toLowerCase();
      const newPassword = String(password || "");
      if (!normalizedUsername || !/^\S+@\S+\.\S+$/.test(normalizedEmail) || newPassword.length < 8) {
        sendJson(res, 422, { success: false, message: "Enter a valid username, email, and password of at least 8 characters." });
        return;
      }
      const updated = await db.resetPassword({ username: normalizedUsername, email: normalizedEmail, passwordHash: db.hashPassword(newPassword) });
      if (!updated) {
        sendJson(res, 404, { success: false, message: "No active account matched that username and email." });
        return;
      }
      sendJson(res, 200, { success: true, message: "Password reset successfully. You can now sign in." });
    } catch (error) {
      console.error("USIAMS password reset failed:", error.message);
      sendJson(res, 503, { success: false, message: "The password reset service is unavailable." });
    }
    return;
  }

  // Public admissions form - deliberately unauthenticated.
  if (req.method === "POST" && url.pathname === "/api/admissions/applications") {
    try {
      const body = await readBody(req);
      const application = {
        id: `APP-${crypto.randomBytes(8).toString("hex").toUpperCase()}`,
        fullName: String(body.fullName || "").trim(),
        email: String(body.email || "").trim().toLowerCase(),
        phone: String(body.phone || "").trim(),
        gender: String(body.gender || "").trim(),
        programmeId: String(body.programmeId || "").trim(),
        previousSchool: String(body.previousSchool || "").trim(),
        entryQualification: String(body.entryQualification || "").trim()
      };
      if (!application.fullName || !/^\S+@\S+\.\S+$/.test(application.email) || !application.phone ||
          !application.gender || !application.programmeId || !application.previousSchool || !application.entryQualification) {
        sendJson(res, 422, { success: false, message: "Complete all admission application fields." });
        return;
      }
      await db.createAdmissionApplication(application);
      sendJson(res, 201, { success: true, reference: application.id, message: "Application submitted successfully." });
    } catch (error) {
      console.error("USIAMS admission application failed:", error.message);
      const badProgramme = error.code === "ER_NO_REFERENCED_ROW_2";
      sendJson(res, badProgramme ? 422 : 503, {
        success: false,
        message: badProgramme ? "The selected programme is not available." : "The admissions service is unavailable."
      });
    }
    return;
  }

  // The public application form needs the programme list before sign-in.
  if (req.method === "GET" && url.pathname === "/api/public/programmes") {
    const programmes = await repo.query(
      "SELECT id, code, name, level, department_id AS departmentId FROM programmes WHERE status = 'Active' ORDER BY name"
    );
    sendJson(res, 200, { success: true, data: programmes });
    return;
  }

  // ---- Everything below requires a session -------------------------
  if (req.method === "GET" && url.pathname === "/api/auth/me") {
    const session = requireUser(req, res);
    if (session) sendJson(res, 200, { success: true, user: session.user });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/logout") {
    const session = authenticatedUser(req);
    if (session) {
      await db.recordAudit({
        userId: session.user.id, userName: session.user.name, userRole: session.user.role,
        action: "LOGOUT", entityType: "Session", ip: clientIp(req)
      });
      sessions.delete(session.token);
    }
    sendJson(res, 200, { success: true });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/bootstrap") {
    const session = requireUser(req, res);
    if (session) await handleBootstrap(req, res, session);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/dashboard/summary") {
    const session = requireUser(req, res);
    if (session) await handleDashboardSummary(req, res, session);
    return;
  }

  if (url.pathname.startsWith("/api/data/")) {
    const session = requireUser(req, res);
    if (session) await handleResourceRoute(req, res, url, session);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/elections/active") {
    const session = requireUser(req, res);
    if (!session) return;
    const election = await db.activeElection();
    const votedPositions = election && session.user.studentId
      ? await db.votesCast(election.id, session.user.studentId)
      : [];
    sendJson(res, 200, { success: true, election, votedPositions });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/elections/results") {
    const session = requireUser(req, res);
    if (!session) return;
    const election = await db.activeElection();
    if (!election) { sendJson(res, 200, { success: true, results: [] }); return; }
    sendJson(res, 200, { success: true, results: await db.electionResults(election.id) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/elections/vote") {
    const session = requireUser(req, res);
    if (!session) return;
    if (session.user.role !== "STUDENT" || !session.user.studentId) {
      sendJson(res, 403, { success: false, message: "Only registered students may vote." });
      return;
    }
    try {
      const { electionId, positionId, candidateId } = await readBody(req);
      await db.castElectionVote({ electionId, positionId, candidateId, voterStudentId: session.user.studentId });
      await db.recordAudit({
        userId: session.user.id, userName: session.user.name, userRole: session.user.role,
        action: "CREATE", entityType: "ElectionVote", entityId: positionId, ip: clientIp(req)
      });
      sendJson(res, 201, { success: true, message: "Vote recorded successfully." });
    } catch (error) {
      const duplicate = error.code === "ER_DUP_ENTRY";
      sendJson(res, duplicate ? 409 : 422, {
        success: false,
        message: duplicate ? "You have already voted for this position." : "Vote could not be recorded."
      });
    }
    return;
  }

  sendJson(res, 404, { success: false, message: "API route not found." });
}

// ---------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const rawPath = String(req.url || "/").split("?")[0];
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(rawPath);
  } catch {
    sendJson(res, 400, { success: false, message: "Invalid request path." });
    return;
  }
  if (decodedPath.split(/[\\/]+/).includes("..")) {
    sendJson(res, 404, { success: false, message: "Resource not found." });
    return;
  }
  const url = new URL(req.url, `http://${req.headers.host || `${config.host}:${config.port}`}`);
  if (url.pathname.startsWith("/api/")) {
    try {
      await handleApi(req, res, url);
    } catch (error) {
      console.error("USIAMS API request failed:", error.message);
      if (!res.headersSent) {
        sendJson(res, error.status || 500, { success: false, message: error.status ? error.message : "An unexpected server error occurred." });
      }
    }
    return;
  }
  serveStatic(req, res, url.pathname);
});

server.listen(config.port, config.host, () => {
  console.log(`USIAMS running at http://${config.host}:${config.port}`);
});

module.exports = { server };

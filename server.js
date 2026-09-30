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
const https = require("node:https");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const zlib = require("node:zlib");
const { config } = require("./config");
const db = require("./db");
const repo = require("./db/repository");
const { RESOURCES, READ_ONLY_ROLES } = require("./db/resources");
const PERMISSIONS = require("./data/permissions");
const rolePermissions = require("./db/role-permissions");
const studentRules = require("./db/student-rules");
const mailer = require("./mailer");
const reminders = require("./reminders");
const rateLimit = require("./rate-limit");
const pageIncludes = require("./page-includes");

/** 429 with Retry-After, when a form has been tried too often. */
function tooManyAttempts(res, seconds) {
  const minutes = Math.ceil(seconds / 60);
  res.setHeader("Retry-After", String(seconds));
  sendJson(res, 429, { success: false, message: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` });
}

const ROOT = __dirname;

// Only students create their own accounts, on the sign-in page. Every other
// role - lecturers, officers, every kind of admin - is added by an
// administrator from Administration > Users.
const STAFF_ACCOUNT_MESSAGE = "Only students can create their own accounts. Staff accounts are added by a university administrator - please contact the administration office.";

// ---------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------
// A real scrypt hash of a random password, verified against when a sign-in
// names an unknown username (see the login route).
const DUMMY_PASSWORD_HASH = db.hashPassword(crypto.randomBytes(18).toString("hex"));

function accountId() {
  return `USR-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
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
    studentId: account.studentId || null,
    // The department / organisational unit a scoped admin manages.
    departmentId: account.departmentId || null,
    unitId: account.unitId || null
  };
}

// ---------------------------------------------------------------------
// Compression. Over a slow connection or a tunnel, size is most of the
// wait: text compresses to about a fifth. Bodies are gzipped when the
// browser accepts it and they are big enough to be worth it.
// ---------------------------------------------------------------------
function acceptsGzip(req) {
  return !!req && /\bgzip\b/.test(String(req.headers["accept-encoding"] || ""));
}

/** Sends a text body, gzipped when worthwhile; HEAD gets headers only. */
function sendBody(res, status, headers, body) {
  const req = res.req;
  let payload = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  const out = { ...headers, Vary: "Accept-Encoding" };
  if (payload.length > 1024 && acceptsGzip(req)) {
    payload = zlib.gzipSync(payload);
    out["Content-Encoding"] = "gzip";
  }
  out["Content-Length"] = payload.length;
  res.writeHead(status, out);
  res.end(req && req.method === "HEAD" ? undefined : payload);
}

function sendJson(res, status, body) {
  sendBody(res, status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  }, JSON.stringify(body));
}

function getToken(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

// Sessions live in the user_sessions table (see db.js), so they survive a
// restart and are shared by every server process.
async function authenticatedUser(req) {
  const token = getToken(req);
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const user = await db.findSession(token);
  return user ? { token, user } : null;
}

async function requireUser(req, res) {
  const session = await authenticatedUser(req);
  if (!session) {
    // Guessing tokens is counted per address (see handleApi).
    if (getToken(req)) rateLimit.record("badToken", clientIp(req) || "unknown");
    sendJson(res, 401, { success: false, message: "Authentication required." });
    return null;
  }
  return session;
}

/**
 * Where this server is reached, for links in emails. Never taken from the
 * request's Host header: an attacker could otherwise ask for a password
 * reset with "Host: evil.example" and have the victim emailed a link that
 * hands the reset token to them. Set PUBLIC_URL in production.
 */
function publicBaseUrl() {
  if (config.publicUrl) return config.publicUrl;
  return `${tlsEnabled() ? "https" : "http"}://${config.host === "0.0.0.0" ? "127.0.0.1" : config.host}:${config.port}`;
}

function tlsEnabled() {
  return !!(config.tls.certFile && config.tls.keyFile);
}

// X-Forwarded-For is written by the client unless a proxy in front of us
// overwrites it, so it is only believed when TRUST_PROXY is set - otherwise
// anyone could put any address in the audit log or dodge the sign-in limit.
function clientIp(req) {
  if (config.trustProxy) {
    // The proxy in front (Vercel, nginx) puts the address it saw last - or,
    // on Vercel, alone - so only the last entry is trustworthy: a client can
    // write anything into the earlier ones.
    const forwarded = String(req.headers["x-forwarded-for"] || "").split(",").pop().trim();
    if (forwarded) return forwarded;
  }
  return req.socket.remoteAddress || null;
}

function readBody(req, maxBytes = 1024 * 1024) {
  const fail = (status, message) => Object.assign(new Error(message), { status });
  return new Promise((resolve, reject) => {
    let raw = "";
    let tooLarge = false;
    req.on("data", chunk => {
      if (tooLarge) return;
      raw += chunk;
      if (raw.length > maxBytes) {
        tooLarge = true;
        raw = "";
        reject(fail(413, "The request is too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (tooLarge) return;
      let body;
      // Keys that could reach an object's prototype through a later
      // Object.assign or spread are dropped as the JSON is read.
      const safe = (key, value) => (key === "__proto__" || key === "constructor" || key === "prototype" ? undefined : value);
      try { body = raw ? JSON.parse(raw, safe) : {}; }
      catch { reject(fail(400, "The request body is not valid JSON.")); return; }
      // Every handler expects an object; an array or a bare value is refused.
      if (!body || typeof body !== "object" || Array.isArray(body)) { reject(fail(400, "The request body must be a JSON object.")); return; }
      resolve(body);
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

// Resource definition -> its name, for looking up the module that owns it.
const RESOURCE_NAMES = new Map(Object.entries(RESOURCES).map(([name, resource]) => [resource, name]));

/**
 * The rule an administrator has set for this role on the module that owns
 * (or keeps private) this resource, or null when the built-in access applies.
 */
function moduleRule(role, resource, { privateOnly = false } = {}) {
  const name = RESOURCE_NAMES.get(resource);
  const module = privateOnly ? PERMISSIONS.privateModuleForResource(name) : PERMISSIONS.moduleForResource(name);
  return module ? rolePermissions.ruleFor(role, module.key) : null;
}

function canRead(resource, role) {
  // A private register (finance, admissions, alumni...) follows the module's
  // rule when one is set; shared reference data keeps its built-in access.
  const rule = moduleRule(role, resource, { privateOnly: true });
  if (rule) return rule !== "none";
  return (resource.read || []).includes(role);
}

/**
 * Write authorisation. Read-only roles are refused before the resource's own
 * list is consulted, so no resource entry can accidentally grant them access.
 * A student may write a self-service resource, but only rows they own.
 */
function canWrite(resource, user, { owner, operation = "create" } = {}) {
  if (READ_ONLY_ROLES.includes(user.role)) return false;
  // Administration > Roles & Permissions: "Manage" is needed to change a
  // module's records once a rule is set for the role.
  const rule = moduleRule(user.role, resource);

  if (user.role === "STUDENT") {
    if (rule === "none") return false;
    if (!resource.selfService) return false;
    // Resources are owned either by a student record or by a user account.
    const expected = resource.ownerUserField ? user.id : user.studentId;
    if (!expected) return false;
    return owner === undefined || owner === null || owner === expected;
  }

  if (rule ? rule !== "manage" : !(resource.write || []).includes(user.role)) return false;

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

/**
 * Applicants have no account, so an admission decision reaches them by
 * email. Only final decisions are sent; "Under Review" is internal.
 */
async function emailAdmissionDecision(application) {
  if (!["Accepted", "Rejected"].includes(application.status) || !application.email) return;
  const [programme] = await repo.query("SELECT name FROM programmes WHERE id = ? LIMIT 1", [application.programmeId]);
  const programmeName = programme ? programme.name : application.programmeId;
  const accepted = application.status === "Accepted";
  const notes = String(application.notes || "").trim();
  await mailer.send({
    to: application.email,
    purpose: "admission-decision",
    subject: `Your USIAMS admission application ${application.id}: ${application.status}`,
    text: `Dear ${application.fullName},\n\n` +
      (accepted
        ? `Congratulations - your application ${application.id} for ${programmeName} has been accepted. ` +
          "Create your student account on the USIAMS sign-in page (Create Account) choosing this programme to continue with registration."
        : `Thank you for applying. We regret that your application ${application.id} for ${programmeName} was not successful.`) +
      (notes ? `\n\nNotes from the admissions office:\n${notes}` : "") +
      "\n\nUSIAMS Admissions Office"
  });
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
  return db.deleteSessionsFor(userId);
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

// Admins below university level manage accounts only inside their own scope:
// the roles they may grant, and the departments those accounts belong to.
// University and System Admin are not listed - they manage every account.
const SCOPED_ACCOUNT_MANAGERS = {
  DEPARTMENT_ADMIN: { scope: "department", roles: ["LECTURER", "ACADEMIC_ADVISOR"] },
  HEAD_OF_DEPARTMENT: { scope: "department", roles: ["LECTURER", "ACADEMIC_ADVISOR"] },
  COLLEGE_ADMIN: { scope: "unit", roles: ["LECTURER", "ACADEMIC_ADVISOR", "HEAD_OF_DEPARTMENT", "DEPARTMENT_ADMIN"] },
  INSTITUTE_ADMIN: { scope: "unit", roles: ["LECTURER", "ACADEMIC_ADVISOR", "HEAD_OF_DEPARTMENT", "DEPARTMENT_ADMIN"] },
  SCHOOL_ADMIN: { scope: "unit", roles: ["LECTURER", "ACADEMIC_ADVISOR", "HEAD_OF_DEPARTMENT", "DEPARTMENT_ADMIN"] }
};

/**
 * Returns a refusal message when a scoped admin's account change reaches
 * outside their department / unit, or null when it is allowed. On create it
 * also fills in the account's unit from its department. Full admins always
 * get null here.
 */
async function scopedAccountRefusal({ actor, operation, body, existing }) {
  const rule = SCOPED_ACCOUNT_MANAGERS[actor.role];
  if (!rule) return null;
  if (operation === "delete") return "Only a University or System Admin can delete accounts. Deactivate it instead.";

  const scopeId = rule.scope === "department" ? actor.departmentId : actor.unitId;
  if (!scopeId) return `Your account is not linked to a ${rule.scope}, so it cannot manage users. Ask a University Admin to set it.`;

  async function departmentInScope(departmentId) {
    const rows = await repo.query("SELECT id, unit_id AS unitId FROM departments WHERE id = ? LIMIT 1", [String(departmentId || "")]);
    const department = rows[0];
    if (!department) return null;
    const allowed = rule.scope === "department" ? department.id === scopeId : department.unitId === scopeId;
    return allowed ? department : null;
  }
  const allowedRoles = rule.roles.map(r => r.toLowerCase().replace(/_/g, " ")).join(", ");

  if (operation === "update") {
    if (!rule.roles.includes(existing.role) || !(await departmentInScope(existing.departmentId))) {
      return "You can only manage accounts in your own " + rule.scope + ".";
    }
  }
  const role = operation === "create" ? body.role : (body.role || existing.role);
  if (!rule.roles.includes(role)) return `You can only create or assign these roles: ${allowedRoles}.`;

  if (operation === "create" || body.departmentId !== undefined) {
    const department = await departmentInScope(body.departmentId);
    if (!department) {
      return rule.scope === "department"
        ? "You can only add accounts to your own department."
        : "Choose a department in your own " + ({ COLLEGE_ADMIN: "college", INSTITUTE_ADMIN: "institute", SCHOOL_ADMIN: "school" }[actor.role] || "unit") + ".";
    }
    body.unitId = department.unitId;
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
/**
 * Fields in a write that no column stores. The repository silently ignores
 * them, so data typed into a form could be lost without anyone noticing.
 */
// Every student takes six or seven courses a semester (data/shared.js). A
// Draft registration (being amended) may hold any number; anything submitted
// may not.
const { COURSE_LOAD } = require("./data/shared");

function registrationLoadRefusal(record) {
  if (!record || record.status === "Draft") return null;
  const courses = Array.isArray(record.courseIds) ? [...new Set(record.courseIds)] : [];
  if (courses.length < COURSE_LOAD.min || courses.length > COURSE_LOAD.max) {
    return `A registration must have ${COURSE_LOAD.min} to ${COURSE_LOAD.max} courses; this one has ${courses.length}.`;
  }
  return null;
}

function droppedFields(resource, body) {
  const flat = resource.transformIn ? resource.transformIn({ ...(body || {}) }) : (body || {});
  const stored = new Set([
    ...Object.keys(resource.fields), ...Object.keys(resource.writeOnly || {}),
    ...Object.keys(resource.extraSelect || {}), ...(resource.derivedFields || [])
  ]);
  return Object.keys(flat).filter(key => !stored.has(key));
}

async function handleResourceRoute(req, res, url, session) {
  const [, , , name, id] = url.pathname.split("/");
  const resource = RESOURCES[name];
  if (!resource) { sendJson(res, 404, { success: false, message: "Unknown resource." }); return; }
  const { user } = session;

  // Development check (USIAMS_AUDIT_WRITES=1): log every write's outcome and
  // any fields that would be dropped, to prove all data reaches the database.
  const audit = process.env.USIAMS_AUDIT_WRITES && req.method !== "GET" ? { dropped: [] } : null;
  if (audit) {
    res.on("finish", () => console.log(`[write-audit] ${req.method} ${name} ${res.statusCode} role=${user.role} dropped=${audit.dropped.join(",") || "-"}`));
  }

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
    let body = await readBody(req);
    if (audit) audit.dropped = droppedFields(resource, body);
    const ownerField = ownerFieldOf(resource);
    // A student may only file records against their own identity.
    const owner = ownerField ? body[ownerField] : undefined;
    if (!canWrite(resource, user, { owner })) { denyWrite(res, user); return; }
    // ...and only the fields db/student-rules.js allows, with the status,
    // dates and reviewer set by the server rather than by the request.
    if (user.role === "STUDENT") {
      const outcome = await studentRules.forCreate(name, body, { user });
      if (outcome.error) { sendJson(res, outcome.status, { success: false, message: outcome.error }); return; }
      body = outcome.body;
    }
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

    if (name === "users") {
      const refusal = await scopedAccountRefusal({ actor: user, operation: "create", body });
      if (refusal) { sendJson(res, 403, { success: false, message: refusal }); return; }
      // Account ids are always minted here. The page proposes sequential ids
      // (USR-0001...), which are the removed demo accounts' ids - a reseed
      // would then have taken a real account for a demo one.
      delete body.id;

      // A student account needs its student record (programme, registration
      // number) or the student signs in to an empty system. It is created the
      // way the sign-up form creates it. Only University and System Admins
      // add students; scoped admins were refused above.
      if (String(body.role || "").toUpperCase() === "STUDENT") {
        if (!ACCOUNT_ADMIN_ROLES.includes(user.role)) { denyWrite(res, user); return; }
        const username = String(body.username || "").trim().toLowerCase();
        const email = String(body.email || "").trim().toLowerCase();
        const fullName = String(body.name || "").trim();
        const password = String(body.password || "");
        const invalid = !/^[a-z0-9._@-]{3,80}$/.test(username) ? "Username must be 3-80 letters, numbers, dots, @, underscores or hyphens."
          : !/^\S+@\S+\.\S+$/.test(email) ? "Enter a valid email address."
          : !fullName ? "Enter the student's full name."
          : !body.programmeId ? "Choose the student's programme."
          : db.passwordProblem(password, { username, email });
        if (invalid) { sendJson(res, 422, { success: false, message: invalid }); return; }
        if (await db.findUser(username)) { sendJson(res, 409, { success: false, message: "That username is already taken." }); return; }
        if (await db.findUserByEmail(email)) { sendJson(res, 409, { success: false, message: "Another account already uses this email address." }); return; }
        try {
          const created = await db.createStudentAccount({
            id: accountId(), username, passwordHash: db.hashPassword(password), fullName, email, programmeId: String(body.programmeId)
          });
          await db.recordAudit({ userId: user.id, userName: user.name, userRole: user.role, action: "CREATE", entityType: "users", entityId: created.userId, ip: clientIp(req) });
          const account = await repo.getById("users", created.userId);
          sendJson(res, 201, { success: true, data: { ...account, studentId: created.studentId, registrationNumber: created.registrationNumber } });
        } catch (error) {
          const badProgramme = error.code === "INVALID_PROGRAMME" || error.code === "ER_NO_REFERENCED_ROW_2";
          if (!badProgramme && error.code !== "ER_DUP_ENTRY") throw error;
          sendJson(res, badProgramme ? 422 : 409, { success: false, message: badProgramme ? "The selected programme is not available." : "That username or email is already registered." });
        }
        return;
      }
    }
    if (name === "users") {
      const weakPassword = db.passwordProblem(body.password, { username: body.username, email: body.email });
      if (weakPassword) { sendJson(res, 422, { success: false, message: weakPassword }); return; }
    }
    if (name === "registrations") {
      const refusal = registrationLoadRefusal({ status: "Registered", ...body });
      if (refusal) { sendJson(res, 422, { success: false, message: refusal }); return; }
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

    // A student editing their own record (Complete My Profile, By-Laws
    // acknowledgement): only the fields the resource opens to students.
    const studentFields = user.role === "STUDENT" ? (studentRules.updatableFields(name) || resource.studentUpdatableFields) : null;
    if (studentFields) {
      if (!ownerField || existing[ownerField] !== user.studentId) { denyWrite(res, user); return; }
      const body = await readBody(req);
      if (audit) audit.dropped = droppedFields(resource, body);
      const flat = resource.transformIn ? resource.transformIn({ ...body }) : { ...body };
      const derived = resource.derivedFields || [];
      // Pages often send a whole nested block (e.g. admission) back; fields in
      // it that are unchanged are fine. Only an actual change is refused.
      const normalize = value => {
        const text = value === null || value === undefined ? "" : String(value);
        return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : text; // dates may come back with a time part
      };
      const same = (a, b) => normalize(a) === normalize(b);
      const refused = Object.keys(flat).filter(key => key !== "id" && !derived.includes(key) &&
        !studentFields.includes(key) && !same(flat[key], existing[key]));
      if (refused.length) {
        sendJson(res, 403, { success: false, message: `Students cannot change: ${refused.join(", ")}.` });
        return;
      }
      const patch = {};
      for (const key of studentFields) if (flat[key] !== undefined) patch[key] = flat[key];
      const merged = { ...existing, ...patch };
      const problem = await studentRules.checkUpdate(name, merged, existing, { user });
      if (problem) { sendJson(res, 422, { success: false, message: problem }); return; }
      // The registration check works out the credit total itself.
      if (name === "registrations") patch.totalCredits = merged.totalCredits;
      const updated = await repo.update(name, id, patch);
      await db.recordAudit({
        userId: user.id, userName: user.name, userRole: user.role, action: "UPDATE",
        entityType: name, entityId: id, ip: clientIp(req)
      });
      sendJson(res, 200, { success: true, data: updated });
      return;
    }

    if (!canWrite(resource, user, { owner: ownerField ? existing[ownerField] : undefined, operation: "update" })) { denyWrite(res, user); return; }
    const body = await readBody(req);
    if (audit) audit.dropped = droppedFields(resource, body);
    // The owner of a record can never be reassigned through an update.
    if (ownerField) delete body[ownerField];
    delete body.id;
    if (name === "users") {
      const scoped = await scopedAccountRefusal({ actor: user, operation: "update", body, existing });
      if (scoped) { sendJson(res, 403, { success: false, message: scoped }); return; }
      const refusal = await accountChangeRefusal({ operation: "update", targetId: id, patch: body, actor: user });
      if (refusal) { sendJson(res, 409, { success: false, message: refusal }); return; }
      if (body.password !== undefined && body.password !== "") {
        const weakPassword = db.passwordProblem(body.password, { username: body.username || existing.username, email: body.email || existing.email });
        if (weakPassword) { sendJson(res, 422, { success: false, message: weakPassword }); return; }
      } else {
        delete body.password;
      }
    }
    if (name === "registrations") {
      const refusal = registrationLoadRefusal({ ...existing, ...body });
      if (refusal) { sendJson(res, 422, { success: false, message: refusal }); return; }
    }
    const updated = await repo.update(name, id, body);
    // A session carries the role and scope the account had at sign-in, so
    // suspending an account, changing its role or scope, or setting a new
    // password must end its sessions now - not when the token expires.
    if (name === "users" && updated && (updated.status !== "Active" || updated.role !== existing.role ||
        updated.departmentId !== existing.departmentId || updated.unitId !== existing.unitId || body.password)) {
      await revokeSessionsFor(id);
    }
    if (name === "applications" && updated && updated.status !== existing.status) await emailAdmissionDecision(updated);
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
    if (user.role === "STUDENT" && !studentRules.mayDelete(name, existing)) {
      sendJson(res, 403, { success: false, message: "You cannot delete this record." });
      return;
    }
    if (name === "users") {
      const scoped = await scopedAccountRefusal({ actor: user, operation: "delete" });
      if (scoped) { sendJson(res, 403, { success: false, message: scoped }); return; }
      const refusal = await accountChangeRefusal({ operation: "delete", targetId: id, actor: user });
      if (refusal) { sendJson(res, 409, { success: false, message: refusal }); return; }
    }
    await repo.remove(name, id);
    if (name === "users") await revokeSessionsFor(id);
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
  "submissions", "applications", "auditLogs", "users", "classCheckins"
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

// ---------------------------------------------------------------------
// Control-number payments: /api/finance/...
// A student picks what to pay for and is issued a control number at once,
// then pays through one of the payment methods listed here. Finance staff
// can see every control number and act for any student.
// ---------------------------------------------------------------------
const FINANCE_STAFF = ["FINANCE_OFFICER", "UNIVERSITY_ADMIN", "SYSTEM_ADMIN"];

async function handleFinanceRoute(req, res, url, session) {
  const { user } = session;
  // Staff who act for any student: finance staff by default, or whoever
  // Roles & Permissions gives "Manage" on Finance.
  const financeRule = rolePermissions.ruleFor(user.role, "finance");
  const isStaff = financeRule ? financeRule === "manage" && user.role !== "STUDENT" : FINANCE_STAFF.includes(user.role);
  const parts = url.pathname.split("/").filter(Boolean); // ["api", "finance", ...]
  if (financeRule === "none") { sendJson(res, 403, { success: false, message: "Your role does not have access to Finance." }); return; }

  // The student a request is about: students always act for themselves.
  function studentFor(requested) {
    if (user.role === "STUDENT") return user.studentId || null;
    return isStaff && requested ? String(requested) : null;
  }
  const fail = (status, message) => sendJson(res, status, { success: false, message });

  try {
    if (req.method === "GET" && parts[2] === "payment-methods" && parts.length === 3) {
      // studentCanConfirm tells the page whether a student may confirm their
      // own payment (GEPG_SIMULATION); otherwise finance staff confirm it.
      sendJson(res, 200, { success: true, data: await db.paymentMethods(), studentCanConfirm: config.gepgSimulation || isStaff });
      return;
    }

    if (req.method === "GET" && parts[2] === "fee-items" && parts.length === 3) {
      sendJson(res, 200, { success: true, data: await db.feeItems(studentFor(url.searchParams.get("studentId"))) });
      return;
    }

    if (parts[2] === "control-numbers" && parts.length === 3) {
      if (req.method === "GET") {
        const canView = financeRule ? financeRule !== "none" : isStaff;
        if (user.role !== "STUDENT" && !canView) { fail(403, "Your role cannot view control numbers."); return; }
        const studentId = user.role === "STUDENT" ? user.studentId : url.searchParams.get("studentId");
        sendJson(res, 200, { success: true, data: await db.controlNumbersFor(studentId || null) });
        return;
      }
      if (req.method === "POST") {
        const body = await readBody(req);
        const studentId = studentFor(body.studentId);
        if (!studentId) { fail(user.role === "STUDENT" ? 422 : 403, user.role === "STUDENT" ? "Your account is not linked to a student record." : "Only students and finance staff can request control numbers."); return; }
        const bill = await db.issueControlNumber({ studentId, feeItemId: body.feeItemId, amount: body.amount });
        if (!bill.reused) {
          await db.recordAudit({ userId: user.id, userName: user.name, userRole: user.role, action: "CREATE", entityType: "control_numbers", entityId: bill.controlNumber, ip: clientIp(req) });
        }
        sendJson(res, bill.reused ? 200 : 201, { success: true, data: bill });
        return;
      }
    }

    // POST /api/finance/control-numbers/:controlNumber/pay
    if (req.method === "POST" && parts[2] === "control-numbers" && parts[4] === "pay" && parts.length === 5) {
      const bill = await db.findControlNumber(parts[3]);
      if (!bill || (user.role === "STUDENT" ? bill.studentId !== user.studentId : !isStaff)) { fail(404, "Control number not found."); return; }
      // Only GePG can say a bill was paid. Until it is connected that is the
      // finance office's job, after checking the payment in GePG - a student
      // confirming their own payment would be paying with a button.
      if (!isStaff && !config.gepgSimulation) {
        fail(403, "Your payment is recorded when GePG confirms it. Pay with the control number; the finance office confirms received payments.");
        return;
      }
      const body = await readBody(req);
      const paid = await db.payControlNumber({
        controlNumber: bill.controlNumber, paymentMethodId: body.paymentMethodId, payerAccount: body.payerAccount,
        receivedBy: isStaff ? user.id : null
      });
      await db.recordAudit({ userId: user.id, userName: user.name, userRole: user.role, action: "CREATE", entityType: "payments", entityId: paid.paymentId, ip: clientIp(req) });
      sendJson(res, 201, { success: true, data: paid });
      return;
    }

    fail(404, "Resource not found.");
  } catch (error) {
    if (error.status) { fail(error.status, error.message); return; }
    throw error;
  }
}

async function handleBootstrap(res, session) {
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
  // The signed-in user's own settings and the university-wide ones, so pages
  // can read them synchronously like the rest of the data.
  const [preferences, systemSettings] = await Promise.all([db.getPreferences(user.id), db.getSystemSettings()]);
  sendJson(res, 200, {
    // The browser (js/api.js) maps reloaded resources to the same names.
    // permissions: the Roles & Permissions rules for this role, which the
    // menus and page guards apply (js/navigation.js, js/api.js boot()).
    success: true, user, data, aliases: BOOTSTRAP_ALIASES, preferences, systemSettings,
    permissions: rolePermissions.rulesForRole(user.role),
    withheld: skipped, generatedAt: new Date().toISOString()
  });
}

// ---------------------------------------------------------------------
// Settings: /api/me/preferences (each user's own) and
// /api/settings/system (university-wide; admins change them).
// ---------------------------------------------------------------------
const SYSTEM_SETTINGS_EDITORS = ["UNIVERSITY_ADMIN", "SYSTEM_ADMIN"];

/**
 * University-wide administration - system settings and Roles & Permissions:
 * the university and system administrators, unless Roles & Permissions has
 * set one of them below "Manage" on Administration.
 */
function canAdministerUniversity(user) {
  if (!SYSTEM_SETTINGS_EDITORS.includes(user.role)) return false;
  const rule = rolePermissions.ruleFor(user.role, "administration");
  return !rule || rule === "manage";
}

// ---------------------------------------------------------------------
// Roles & Permissions: /api/admin/permissions
//   GET     every rule, plus who may change each module by default (the
//           page combines this with the menus to show the default levels)
//   PUT     { role, module, level } - level null returns it to the default
//   DELETE  every rule, so all roles return to the default
// ---------------------------------------------------------------------
async function handlePermissionsRoute(req, res, session) {
  const { user } = session;
  if (!canAdministerUniversity(user)) { sendJson(res, 403, { success: false, message: "Only university and system administrators manage roles and permissions." }); return; }

  if (req.method === "GET") {
    const defaultWriters = Object.fromEntries(PERMISSIONS.MODULES.map(m => [m.key,
      [...new Set(m.resources.flatMap(name => RESOURCES[name].write || []))].filter(role => !READ_ONLY_ROLES.includes(role))]));
    sendJson(res, 200, { success: true, data: { rules: rolePermissions.allRules(), defaultWriters } });
    return;
  }

  if (req.method === "PUT") {
    const { role, module: moduleKey, level } = await readBody(req);
    const roles = await repo.query("SELECT id FROM roles WHERE id = ? LIMIT 1", [String(role || "")]);
    if (!roles.length) { sendJson(res, 422, { success: false, message: "Unknown role." }); return; }
    if (!PERMISSIONS.byKey[moduleKey]) { sendJson(res, 422, { success: false, message: "Unknown module." }); return; }
    if (level !== null && !PERMISSIONS.allowedLevels(role, moduleKey).includes(level)) {
      sendJson(res, 422, { success: false, message: `That access level cannot be given to this role on ${PERMISSIONS.byKey[moduleKey].label}.` });
      return;
    }
    if (PERMISSIONS.FIXED[role] && PERMISSIONS.FIXED[role][moduleKey]) {
      sendJson(res, 422, { success: false, message: "This access is fixed so that administrators cannot be locked out." });
      return;
    }
    await rolePermissions.save(role, moduleKey, level, user.id);
    await db.recordAudit({ userId: user.id, userName: user.name, userRole: user.role, action: "UPDATE", entityType: "role_permissions", entityId: `${role}:${moduleKey}=${level || "default"}`, ip: clientIp(req) });
    sendJson(res, 200, { success: true, data: { rules: rolePermissions.allRules() } });
    return;
  }

  if (req.method === "DELETE") {
    await rolePermissions.reset();
    await db.recordAudit({ userId: user.id, userName: user.name, userRole: user.role, action: "DELETE", entityType: "role_permissions", entityId: "all", ip: clientIp(req) });
    sendJson(res, 200, { success: true, data: { rules: [] } });
    return;
  }

  res.setHeader("Allow", "GET, PUT, DELETE");
  sendJson(res, 405, { success: false, message: "Method not allowed." });
}

// What an upload is for, and the per-file limit.
const FILE_PURPOSES = ["document", "request", "complaint", "submission", "profile", "material"];
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

async function handleSettingsRoute(req, res, url, session) {
  const { user } = session;
  if (url.pathname === "/api/me/preferences") {
    if (req.method === "GET") { sendJson(res, 200, { success: true, data: await db.getPreferences(user.id) }); return; }
    if (req.method === "PUT" || req.method === "PATCH") {
      const body = await readBody(req);
      if (!body || typeof body !== "object" || Array.isArray(body)) { sendJson(res, 422, { success: false, message: "Send preferences as an object." }); return; }
      sendJson(res, 200, { success: true, data: await db.savePreferences(user.id, body) });
      return;
    }
  }
  if (url.pathname === "/api/settings/system") {
    if (req.method === "GET") { sendJson(res, 200, { success: true, data: await db.getSystemSettings() }); return; }
    if (req.method === "PUT" || req.method === "PATCH") {
      if (!canAdministerUniversity(user)) { denyWrite(res, user); return; }
      const body = await readBody(req);
      const saved = await db.saveSystemSettings(body, user.id);
      await db.recordAudit({ userId: user.id, userName: user.name, userRole: user.role, action: "UPDATE", entityType: "system_settings", entityId: Object.keys(body || {}).join(",").slice(0, 60), ip: clientIp(req) });
      sendJson(res, 200, { success: true, data: saved });
      return;
    }
  }
  sendJson(res, 404, { success: false, message: "Resource not found." });
}

// ---------------------------------------------------------------------
// Dashboard summary
// ---------------------------------------------------------------------
async function handleDashboardSummary(res, session) {
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
const PUBLIC_DIRECTORIES = ["css", "js", "data", "components", "assets", "pages"];

function isPublicPath(relativePath) {
  const normalized = relativePath.split(path.sep).join("/");
  if (!normalized || normalized.startsWith("..")) return false;
  const segments = normalized.split("/");
  // A file at the root is public only if it is a page.
  if (segments.length === 1) return segments[0].toLowerCase().endsWith(".html");
  return PUBLIC_DIRECTORIES.includes(segments[0]);
}

/**
 * Sends a page with a Content-Security-Policy that only runs the page's own
 * scripts: each response gets a fresh random nonce, stamped on every
 * <script> tag in the file. Script injected into the page some other way -
 * through data shown on it - has no nonce and is refused by the browser, as
 * are inline onclick="..." attributes.
 */
function sendHtml(res, status, html) {
  const nonce = crypto.randomBytes(16).toString("base64");
  res.setHeader("Content-Security-Policy", pageCsp(nonce));
  // Pages are never stored: each carries its own nonce and may reflect
  // who is signed in.
  sendBody(res, status, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    html.replace(/<script\b/gi, `<script nonce="${nonce}"`));
}

// Static files: how long a browser may reuse its copy without asking.
// Third-party libraries, fonts and images do not change between releases;
// the app's own scripts and styles are reused for a few minutes, then
// re-checked with the ETag below (a cheap "304 Not Modified" when unchanged).
function cacheControlFor(relativePath) {
  const file = relativePath.replace(/\\/g, "/");
  if (/^assets\/(vendor|icons|images)\//.test(file)) return "public, max-age=604800";
  return "public, max-age=300, must-revalidate";
}

const COMPRESSIBLE = /^(text\/|application\/(javascript|json)|image\/svg\+xml)/;
const gzipCache = new Map(); // file path -> { mtimeMs, data }

function gzippedFile(filePath, stat) {
  const cached = gzipCache.get(filePath);
  if (cached && cached.mtimeMs === stat.mtimeMs) return cached.data;
  const data = zlib.gzipSync(fs.readFileSync(filePath), { level: 9 });
  gzipCache.set(filePath, { mtimeMs: stat.mtimeMs, data });
  return data;
}

function serveStatic(req, res, pathname) {
  // Files are only ever read; anything else is not a static request.
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    sendJson(res, 405, { success: false, message: "Method not allowed." });
    return;
  }
  // The public home page is the front door; it links on to login and apply.
  // Pages declare the SVG icon (page-includes.js); older browsers and
  // bookmark tools still ask for /favicon.ico, so answer with the PNG.
  const aliases = { "/": "/index.html", "/favicon.ico": "/assets/icons/icon-180.png" };
  const requested = aliases[pathname] || pathname;
  const filePath = path.resolve(ROOT, `.${requested}`);
  const relativePath = path.relative(ROOT, filePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath) || !isPublicPath(relativePath) ||
      !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    const notFound = path.join(ROOT, "pages", "404.html");
    if (fs.existsSync(notFound) && req.headers.accept && req.headers.accept.includes("text/html")) {
      sendHtml(res, 404, pageIncludes.pageHtml(notFound, ROOT));
      return;
    }
    sendJson(res, 404, { success: false, message: "Resource not found." });
    return;
  }
  // Pages get their shared stylesheet and script lists filled in
  // (page-includes.js); every other file is sent as it is.
  if (path.extname(filePath).toLowerCase() === ".html") { sendHtml(res, 200, pageIncludes.pageHtml(filePath, ROOT)); return; }

  const stat = fs.statSync(filePath);
  const type = contentType(filePath);
  const etag = `W/"${stat.size.toString(36)}-${Math.floor(stat.mtimeMs).toString(36)}"`;
  const headers = {
    "Content-Type": type.startsWith("text/") || /javascript|json|svg/.test(type) ? `${type}; charset=utf-8` : type,
    "Cache-Control": cacheControlFor(relativePath),
    ETag: etag,
    "Last-Modified": stat.mtime.toUTCString(),
    Vary: "Accept-Encoding"
  };
  // The browser already has this version.
  if (String(req.headers["if-none-match"] || "").split(",").map(s => s.trim()).includes(etag)) {
    res.writeHead(304, headers);
    res.end();
    return;
  }
  if (COMPRESSIBLE.test(type) && stat.size > 1024 && acceptsGzip(req)) {
    const data = gzippedFile(filePath, stat);
    res.writeHead(200, { ...headers, "Content-Encoding": "gzip", "Content-Length": data.length });
    res.end(req.method === "HEAD" ? undefined : data);
    return;
  }
  res.writeHead(200, { ...headers, "Content-Length": stat.size });
  if (req.method === "HEAD") { res.end(); return; }
  fs.createReadStream(filePath).pipe(res);
}

// ---------------------------------------------------------------------
// API router
// ---------------------------------------------------------------------
async function handleApi(req, res, url) {
  if (req.method === "OPTIONS") { sendJson(res, 204, {}); return; }
  // Roles & Permissions rules, reloaded when older than a few seconds.
  await rolePermissions.refresh();

  // Overall request limit: per session when the request carries a
  // well-formed token, per address otherwise, and a separate limit on
  // addresses that keep sending tokens that are not valid.
  const ip = clientIp(req) || "unknown";
  const token = getToken(req);
  const limitKey = token && /^[0-9a-f]{64}$/.test(token) ? `session:${token}` : `address:${ip}`;
  const apiWait = Math.max(rateLimit.retryAfter("api", limitKey), rateLimit.retryAfter("badToken", ip));
  if (apiWait) { tooManyAttempts(res, apiWait); return; }
  rateLimit.record("api", limitKey);

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
      const ip = clientIp(req) || "unknown";
      const usernameKey = String(username || "").trim().toLowerCase().slice(0, 80);
      const accountKey = `${ip}|${usernameKey}`;
      // Per username from any address too, so an attacker spreading guesses
      // over many addresses is still stopped.
      const wait = Math.max(rateLimit.retryAfter("loginAccount", accountKey), rateLimit.retryAfter("loginAddress", ip),
        rateLimit.retryAfter("loginUser", usernameKey));
      if (wait) { tooManyAttempts(res, wait); return; }
      const account = await db.findUser(String(username || ""));
      // An unknown username is checked against a dummy hash, so a wrong
      // username takes as long as a wrong password and the response time
      // does not reveal which usernames exist.
      const passwordMatches = db.verifyPassword(String(password || ""), account ? account.passwordHash : DUMMY_PASSWORD_HASH) && !!account;
      // Only someone who knows the password learns the account is waiting.
      if (passwordMatches && account.status === "Pending") {
        sendJson(res, 403, { success: false, message: "Your account request is awaiting approval by a university administrator. You can sign in once it is approved." });
        return;
      }
      if (!passwordMatches || account.status !== "Active" || !account.role) {
        rateLimit.record("loginAccount", accountKey);
        rateLimit.record("loginAddress", ip);
        rateLimit.record("loginUser", usernameKey);
        await db.recordAudit({
          userName: String(username || "").slice(0, 80), action: "LOGIN", entityType: "Session",
          status: "Failed", ip: clientIp(req)
        });
        sendJson(res, 401, { success: false, message: "Invalid username or password. Please check your credentials and try again." });
        return;
      }
      rateLimit.clear("loginAccount", accountKey);
      const token = crypto.randomBytes(32).toString("hex");
      const user = publicUser(account);
      await db.recordLogin(account.id);
      // Hashes from before per-password salts are replaced now that the
      // password is known to be correct.
      if (db.needsRehash(account.passwordHash)) await db.changePassword(account.id, db.hashPassword(String(password)));
      await db.recordAudit({
        userId: user.id, userName: user.name, userRole: user.role, action: "LOGIN",
        entityType: "Session", entityId: token.slice(0, 8).toUpperCase(), ip: clientIp(req)
      });
      await db.createSession({ token, user, ip: clientIp(req), ttlMs: config.sessionTtlMs });
      sendJson(res, 200, { success: true, token, user });
    } catch (error) {
      // A bad request (malformed or oversized body) is the caller's error.
      if (error.status === 400 || error.status === 413) { sendJson(res, error.status, { success: false, message: error.message }); return; }
      console.error("USIAMS database authentication failed:", error.message);
      sendJson(res, 503, { success: false, message: "The database is unavailable. Check MySQL and the DB_* environment settings." });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/register") {
    const registerWait = rateLimit.retryAfter("register", clientIp(req) || "unknown");
    if (registerWait) { tooManyAttempts(res, registerWait); return; }
    rateLimit.record("register", clientIp(req) || "unknown");
    try {
      const { username, fullName, email, password, programmeId, role } = await readBody(req);
      const normalizedUsername = String(username || "").trim().toLowerCase();
      const normalizedEmail = String(email || "").trim().toLowerCase();
      const normalizedName = String(fullName || "").trim();
      const plainPassword = String(password || "");
      const normalizedProgramme = String(programmeId || "").trim();
      // Checked on the server, not just left off the form, so a hand-made
      // request cannot sign up as staff either.
      if (String(role || "STUDENT").trim().toUpperCase() !== "STUDENT") {
        sendJson(res, 403, { success: false, message: STAFF_ACCOUNT_MESSAGE });
        return;
      }
      if (!/^[a-z0-9._-]{3,80}$/.test(normalizedUsername)) {
        sendJson(res, 422, { success: false, message: "Username must be 3-80 characters and use letters, numbers, dots, underscores, or hyphens." });
        return;
      }
      if (!normalizedName || normalizedName.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 190) {
        sendJson(res, 422, { success: false, message: "Enter your full name and a valid email address." });
        return;
      }
      const weakPassword = db.passwordProblem(plainPassword, { username: normalizedUsername, email: normalizedEmail });
      if (weakPassword) { sendJson(res, 422, { success: false, message: weakPassword }); return; }
      if (await db.findUser(normalizedUsername)) {
        sendJson(res, 409, { success: false, message: "That username is already registered." });
        return;
      }
      if (await db.findUserByEmail(normalizedEmail)) {
        sendJson(res, 409, { success: false, message: "That email address is already registered." });
        return;
      }

      // A student account is only usable with a student record behind it, and
      // that record needs a programme - it determines the department and the
      // registration number.
      if (!normalizedProgramme) {
        sendJson(res, 422, { success: false, message: "Choose the programme you are joining." });
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
      // A bad request (malformed or oversized body) is the caller's error.
      if (error.status === 400 || error.status === 413) { sendJson(res, error.status, { success: false, message: error.message }); return; }
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

  // Forgot Password, step 1: email a one-time reset link to the account.
  // Knowing a username and email is not proof of owning the account, so the
  // new password is only accepted with the token from that email (step 2).
  // The reply is the same whether or not an account matched, so this form
  // cannot be used to discover which usernames or emails exist.
  if (req.method === "POST" && (url.pathname === "/api/auth/forgot-password" || url.pathname === "/api/auth/reset-password")) {
    const resetWait = rateLimit.retryAfter("passwordReset", clientIp(req) || "unknown");
    if (resetWait) { tooManyAttempts(res, resetWait); return; }
    rateLimit.record("passwordReset", clientIp(req) || "unknown");
  }

  if (req.method === "POST" && url.pathname === "/api/auth/forgot-password") {
    const generic = { success: true, message: "If an active account matches, a password reset link has been sent to its email address. The link works once and expires in 30 minutes." };
    try {
      const { identifier } = await readBody(req);
      const account = await db.findActiveAccount(String(identifier || "").trim());
      if (account && account.email) {
        const { token, minutes } = await db.createPasswordReset(account.id);
        const link = `${publicBaseUrl()}/login.html?reset=${token}`;
        await mailer.send({
          to: account.email,
          purpose: "password-reset",
          subject: "Reset your USIAMS password",
          text: `Hello ${account.name},\n\nSomeone asked to reset the password for the USIAMS account "${account.username}". ` +
            `To choose a new password, open this link within ${minutes} minutes:\n\n${link}\n\n` +
            "If you did not ask for this, ignore this email - your password has not changed."
        });
        await db.recordAudit({ userId: account.id, userName: account.name, action: "UPDATE", entityType: "password_reset_requested", entityId: account.id, ip: clientIp(req) });
      }
      sendJson(res, 200, generic);
    } catch (error) {
      // A bad request (malformed or oversized body) is the caller's error.
      if (error.status === 400 || error.status === 413) { sendJson(res, error.status, { success: false, message: error.message }); return; }
      console.error("USIAMS password reset request failed:", error.message);
      sendJson(res, 503, { success: false, message: "The password reset service is unavailable." });
    }
    return;
  }

  // Forgot Password, step 2: the token from the email sets the new password.
  if (req.method === "POST" && url.pathname === "/api/auth/reset-password") {
    try {
      const { token, password } = await readBody(req);
      const newPassword = String(password || "");
      if (!/^[0-9a-f]{64}$/.test(String(token || ""))) {
        sendJson(res, 422, { success: false, message: "This reset link is not valid. Request a new one." });
        return;
      }
      const weakPassword = db.passwordProblem(newPassword);
      if (weakPassword) { sendJson(res, 422, { success: false, message: weakPassword }); return; }
      const userId = await db.consumePasswordReset(String(token), db.hashPassword(newPassword));
      if (!userId) {
        sendJson(res, 410, { success: false, message: "This reset link has expired or has already been used. Request a new one." });
        return;
      }
      // Whoever may have been signed in with the old password is signed out.
      await revokeSessionsFor(userId);
      await db.recordAudit({ userId, action: "UPDATE", entityType: "password", entityId: userId, ip: clientIp(req) });
      sendJson(res, 200, { success: true, message: "Password reset successfully. You can now sign in." });
    } catch (error) {
      // A bad request (malformed or oversized body) is the caller's error.
      if (error.status === 400 || error.status === 413) { sendJson(res, error.status, { success: false, message: error.message }); return; }
      console.error("USIAMS password reset failed:", error.message);
      sendJson(res, 503, { success: false, message: "The password reset service is unavailable." });
    }
    return;
  }

  // Public admissions form - deliberately unauthenticated.
  if (req.method === "POST" && url.pathname === "/api/admissions/applications") {
    const applyWait = rateLimit.retryAfter("admissions", clientIp(req) || "unknown");
    if (applyWait) { tooManyAttempts(res, applyWait); return; }
    rateLimit.record("admissions", clientIp(req) || "unknown");
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
      // A bad request (malformed or oversized body) is the caller's error.
      if (error.status === 400 || error.status === 413) { sendJson(res, error.status, { success: false, message: error.message }); return; }
      console.error("USIAMS admission application failed:", error.message);
      const badProgramme = error.code === "ER_NO_REFERENCED_ROW_2";
      sendJson(res, badProgramme ? 422 : 503, {
        success: false,
        message: badProgramme ? "The selected programme is not available." : "The admissions service is unavailable."
      });
    }
    return;
  }

  // The public application and student sign-up forms need the programme
  // list before sign-in.
  if (req.method === "GET" && url.pathname === "/api/public/programmes") {
    const programmes = await repo.query(
      "SELECT id, code, name, level, department_id AS departmentId FROM programmes WHERE status = 'Active' ORDER BY name"
    );
    sendJson(res, 200, { success: true, data: programmes });
    return;
  }

  // The public home page: the latest announcements addressed to everyone,
  // the next few academic calendar dates, how many programmes are open at
  // each level, the programme list for the showcase, and a few totals. Only
  // counts and published catalogue data - nothing here is restricted to a role.
  if (req.method === "GET" && url.pathname === "/api/public/landing") {
    const [announcements, events, programmeLevels, programmes, [totals]] = await Promise.all([
      repo.query(
        `SELECT id, title, body, published_at AS publishedAt FROM announcements
         WHERE status = 'Published' AND audience_role IS NULL AND published_at <= NOW()
           AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY published_at DESC LIMIT 3`
      ),
      repo.query(
        `SELECT id, title, description, event_date AS date, end_date AS endDate FROM calendar_events
         WHERE COALESCE(end_date, event_date) >= CURDATE() ORDER BY event_date LIMIT 4`
      ),
      repo.query("SELECT level, COUNT(*) AS count FROM programmes WHERE status = 'Active' GROUP BY level ORDER BY count DESC"),
      repo.query(
        `SELECT p.id, p.code, p.name, p.level, p.duration_years AS years, d.name AS department
         FROM programmes p LEFT JOIN departments d ON d.id = p.department_id
         WHERE p.status = 'Active' ORDER BY p.level, p.name`
      ),
      repo.query(
        `SELECT (SELECT COUNT(*) FROM students WHERE status = 'Active') AS students,
                (SELECT COUNT(*) FROM programmes WHERE status = 'Active') AS programmes,
                (SELECT COUNT(*) FROM courses WHERE status = 'Active') AS courses,
                (SELECT COUNT(*) FROM departments WHERE status = 'Active') AS departments`
      )
    ]);
    sendJson(res, 200, {
      success: true,
      data: {
        announcements, events,
        programmeLevels: programmeLevels.map(row => ({ level: row.level, count: Number(row.count) })),
        programmes: programmes.map(row => ({ ...row, years: row.years === null ? null : Number(row.years) })),
        stats: Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, Number(value)]))
      }
    });
    return;
  }

  // ---- Everything below requires a session -------------------------
  // Settings > Change Password: the signed-in user proves the current
  // password, then the new one replaces it in the database.
  if (req.method === "POST" && url.pathname === "/api/auth/change-password") {
    const session = await requireUser(req, res);
    if (!session) return;
    const { user } = session;
    const changeWait = rateLimit.retryAfter("changePassword", user.id);
    if (changeWait) { tooManyAttempts(res, changeWait); return; }
    const { currentPassword, newPassword } = await readBody(req);
    const next = String(newPassword || "");
    const storedHash = await db.passwordHashFor(user.id);
    if (!storedHash || !db.verifyPassword(String(currentPassword || ""), storedHash)) {
      rateLimit.record("changePassword", user.id);
      sendJson(res, 422, { success: false, message: "Your current password is not correct." });
      return;
    }
    const weakPassword = db.passwordProblem(next, { username: user.username, email: user.email });
    if (weakPassword) { sendJson(res, 422, { success: false, message: weakPassword }); return; }
    if (next === String(currentPassword || "")) { sendJson(res, 422, { success: false, message: "Choose a password different from your current one." }); return; }
    await db.changePassword(user.id, db.hashPassword(next));
    // Any other device signed in with the old password is signed out; this
    // session carries on.
    await db.deleteOtherSessions(user.id, session.token);
    await db.recordAudit({ userId: user.id, userName: user.name, userRole: user.role, action: "UPDATE", entityType: "password", entityId: user.id, ip: clientIp(req) });
    sendJson(res, 200, { success: true, message: "Your password has been changed." });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/auth/me") {
    const session = await requireUser(req, res);
    if (session) sendJson(res, 200, { success: true, user: session.user });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/logout") {
    const session = await authenticatedUser(req);
    if (session) {
      await db.recordAudit({
        userId: session.user.id, userName: session.user.name, userRole: session.user.role,
        action: "LOGOUT", entityType: "Session", ip: clientIp(req)
      });
      await db.deleteSession(session.token);
    }
    sendJson(res, 200, { success: true });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/bootstrap") {
    const session = await requireUser(req, res);
    if (session) await handleBootstrap(res, session);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/dashboard/summary") {
    const session = await requireUser(req, res);
    if (session) await handleDashboardSummary(res, session);
    return;
  }

  // Uploaded files: stored in the database; other records hold the
  // /api/files/<id> URL. Students reach only their own files; staff
  // (who review documents and mark submissions) can open any.
  if (url.pathname === "/api/files" && req.method === "POST") {
    const session = await requireUser(req, res);
    if (!session) return;
    const { user } = session;
    const uploadWait = rateLimit.retryAfter("upload", user.id);
    if (uploadWait) { tooManyAttempts(res, uploadWait); return; }
    rateLimit.record("upload", user.id);
    let body;
    try { body = await readBody(req, 8 * 1024 * 1024); }
    catch (error) {
      sendJson(res, error.status === 400 ? 400 : 413, { success: false, message: error.status === 400 ? error.message : "The file is too large. The limit is 5 MB." });
      return;
    }
    const purpose = String(body.purpose || "");
    if (!FILE_PURPOSES.includes(purpose)) { sendJson(res, 422, { success: false, message: "Unknown upload purpose." }); return; }
    // Course materials are published by teaching staff, never by students.
    if (purpose === "material" && user.role === "STUDENT") { sendJson(res, 403, { success: false, message: "Only teaching staff can upload course materials." }); return; }
    const name = String(body.name || "").replace(/[\\/:*?"<>|\r\n]+/g, "_").trim().slice(0, 200);
    const content = Buffer.from(String(body.data || ""), "base64");
    if (!name || !content.length) { sendJson(res, 422, { success: false, message: "Choose a file to upload." }); return; }
    if (content.length > MAX_UPLOAD_BYTES) { sendJson(res, 413, { success: false, message: "The file is too large. The limit is 5 MB." }); return; }
    const mimeType = /^[\w.+-]+\/[\w.+-]+$/.test(String(body.type || "")) ? String(body.type) : "application/octet-stream";
    const saved = await db.saveFile({ ownerUserId: user.id, studentId: user.studentId || null, purpose, name, mimeType, content });
    await db.recordAudit({ userId: user.id, userName: user.name, userRole: user.role, action: "CREATE", entityType: "stored_files", entityId: saved.id, ip: clientIp(req) });
    sendJson(res, 201, { success: true, data: saved });
    return;
  }

  if (req.method === "GET" && /^\/api\/files\/[A-Z0-9-]+$/.test(url.pathname)) {
    const session = await requireUser(req, res);
    if (!session) return;
    const { user } = session;
    const info = await db.getFileInfo(url.pathname.split("/").pop());
    let allowed = info && (user.role !== "STUDENT" || info.ownerUserId === user.id || (info.studentId && info.studentId === user.studentId));
    // Course materials a lecturer uploaded: open to the students registered
    // for that course this semester or any other.
    if (info && !allowed && info.purpose === "material" && user.studentId) {
      const rows = await repo.query(
        `SELECT 1 FROM elearning_materials m
         JOIN registration_courses rc ON rc.course_id = m.course_id
         JOIN registrations r ON r.id = rc.registration_id
         WHERE m.file_url = ? AND r.student_id = ? AND r.status IN ('Registered', 'Approved') LIMIT 1`,
        [`/api/files/${info.id}`, user.studentId]
      );
      allowed = rows.length > 0;
    }
    if (!allowed) { sendJson(res, 404, { success: false, message: "File not found." }); return; }
    const content = await db.getFileContent(info.id);
    res.writeHead(200, {
      "Content-Type": info.mimeType,
      "Content-Length": content.length,
      "Content-Disposition": `attachment; filename="${info.name.replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(info.name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff"
    });
    res.end(content);
    return;
  }

  if (url.pathname === "/api/admin/permissions") {
    const session = await requireUser(req, res);
    if (session) await handlePermissionsRoute(req, res, session);
    return;
  }

  if (url.pathname === "/api/me/preferences" || url.pathname === "/api/settings/system") {
    const session = await requireUser(req, res);
    if (session) await handleSettingsRoute(req, res, url, session);
    return;
  }

  if (url.pathname.startsWith("/api/finance/")) {
    const session = await requireUser(req, res);
    if (session) await handleFinanceRoute(req, res, url, session);
    return;
  }

  if (url.pathname.startsWith("/api/data/")) {
    const session = await requireUser(req, res);
    if (session) await handleResourceRoute(req, res, url, session);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/elections/active") {
    const session = await requireUser(req, res);
    if (!session) return;
    const election = await db.activeElection();
    const votedPositions = election && session.user.studentId
      ? await db.votesCast(election.id, session.user.studentId)
      : [];
    sendJson(res, 200, { success: true, election, votedPositions });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/elections/results") {
    const session = await requireUser(req, res);
    if (!session) return;
    const election = await db.activeElection();
    if (!election) { sendJson(res, 200, { success: true, results: [] }); return; }
    sendJson(res, 200, { success: true, results: await db.electionResults(election.id) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/elections/vote") {
    const session = await requireUser(req, res);
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
// With TLS_CERT_FILE and TLS_KEY_FILE set the server speaks HTTPS itself;
// otherwise it serves plain HTTP (for local use, or behind a proxy such as
// nginx or IIS that terminates HTTPS).
function tlsOptions() {
  if (!tlsEnabled()) return null;
  return { cert: fs.readFileSync(config.tls.certFile), key: fs.readFileSync(config.tls.keyFile) };
}

// Browser protections on every response:
//  - pages may only load scripts, styles, fonts and data from this server
//    (everything, Bootstrap included, is served from assets/vendor), and
//    only scripts carrying the page's nonce run (see sendHtml), so neither
//    an injected <script> nor an onclick="..." attribute can execute;
//  - no other site may show USIAMS in a frame (clickjacking);
//  - files are never "sniffed" into a different type, and links do not
//    carry USIAMS addresses to other sites.
// Anything that is not a page (API replies, files) gets a policy that
// allows nothing at all.
function pageCsp(nonce) {
  return [
    "default-src 'self'", `script-src 'self' 'nonce-${nonce}'`, "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:", "font-src 'self' data:",
    "connect-src 'self'", "object-src 'none'", "base-uri 'none'", "form-action 'self'", "frame-ancestors 'none'"
  ].join("; ");
}

const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Permitted-Cross-Domain-Policies": "none",
  "Origin-Agent-Cluster": "?1"
};

/** True when the visitor reached the site over HTTPS (directly or via a trusted proxy). */
function overHttps(req) {
  if (tlsEnabled()) return true;
  return config.trustProxy && String(req.headers["x-forwarded-proto"] || "").split(",").pop().trim() === "https";
}

async function handleRequest(req, res) {
  try {
    await routeRequest(req, res);
  } catch (error) {
    // Nothing a request does may take the server down.
    console.error("USIAMS request failed:", error.message);
    if (!res.headersSent) sendJson(res, error.status || 500, { success: false, message: error.status ? error.message : "An unexpected server error occurred." });
    else res.destroy();
  }
}

async function routeRequest(req, res) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value);
  // Over HTTPS, tell browsers never to fall back to plain HTTP.
  if (overHttps(req)) res.setHeader("Strict-Transport-Security", "max-age=31536000");
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
  // Parsed against a fixed base: the Host header is the client's to write,
  // and a malformed one must not be able to break the request.
  let url;
  try { url = new URL(String(req.url || "/"), "http://usiams.invalid"); }
  catch { sendJson(res, 400, { success: false, message: "Invalid request." }); return; }
  if (url.pathname.startsWith("/api/")) {
    await handleApi(req, res, url);
    return;
  }
  serveStatic(req, res, url.pathname);
}

const server = tlsEnabled() ? https.createServer(tlsOptions(), handleRequest) : http.createServer(handleRequest);

// Slow or stalled clients cannot hold connections open indefinitely.
server.headersTimeout = 20 * 1000;
server.requestTimeout = 120 * 1000;
server.keepAliveTimeout = 5 * 1000;
server.maxHeadersCount = 100;

// A last line of defence: a stray promise rejection is logged instead of
// ending the process (Node's default), which would take the site offline.
process.on("unhandledRejection", error => console.error("USIAMS unhandled rejection:", error && error.message));

server.on("error", error => {
  if (error.code === "EADDRINUSE") {
    console.error(`USIAMS could not start: port ${config.port} is already in use.`);
    console.error(`USIAMS may already be running - open http://${config.host}:${config.port}`);
    console.error("Otherwise stop the other program, or start on another port with: set PORT=3001 && npm start");
  } else {
    console.error("USIAMS could not start:", error.message);
  }
  process.exit(1);
});

// Expired sessions are already refused; this only keeps the table small.
const purge = () => db.purgeExpiredSessions().catch(error => console.warn("USIAMS: session cleanup failed:", error.message));

// On Vercel (api/index.js) there is no long-running process to own timers:
// each request is handled by a function that sleeps between requests. The
// periodic jobs instead ride on incoming requests, each at most once per
// interval, so a quiet site catches up on the next visit.
const lastRun = { purge: 0, reminders: 0 };
async function runDueJobs() {
  const now = Date.now();
  const jobs = [];
  if (now - lastRun.purge >= 60 * 60 * 1000) { lastRun.purge = now; jobs.push(purge()); }
  if (config.remindersEnabled && now - lastRun.reminders >= 60 * 1000) {
    lastRun.reminders = now;
    jobs.push(reminders.run().catch(error => console.warn("USIAMS: timetable reminders failed:", error.message)));
  }
  await Promise.all(jobs);
}

async function vercelHandler(req, res) {
  await handleRequest(req, res);
  // After the response, so no visitor waits on the jobs; awaited, so the
  // function is not frozen halfway through one.
  await runDueJobs();
}

if (!process.env.VERCEL) {
  server.listen(config.port, config.host, async () => {
    console.log(`USIAMS running at ${tlsEnabled() ? "https" : "http"}://${config.host}:${config.port}`);
    // Report the database state up front; otherwise a stopped MySQL only
    // shows up later as a failed sign-in.
    if (!(await db.health())) {
      console.error(`USIAMS cannot reach MySQL at ${config.db.host}:${config.db.port} (database "${config.db.database}").`);
      console.error("Start MySQL and check DB_* in .env - pages will load but sign-in will fail until it is reachable.");
    }
    purge();
    setInterval(purge, 60 * 60 * 1000).unref();
    // Daily timetable reminders (reminders.js). REMINDERS=off disables them,
    // e.g. for the test suite, whose notification counts they would change.
    if (config.remindersEnabled) reminders.start();
  });
}

module.exports = { server, vercelHandler };

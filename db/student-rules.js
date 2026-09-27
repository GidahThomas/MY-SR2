/* =========================================================
   USIAMS - db/student-rules.js
   What a student may write on the records they own.

   The resource registry lets a student write "self-service" records -
   their own requests, documents, registration, library loans. Without
   these rules the API accepted any field on them, so a student could
   send { status: "Verified" } for their own document, approve their own
   registration, clear their own graduation checklist or borrow a book
   until 2099, just by editing the request in the browser.

   For each resource:
     create.fields  the only fields a student may supply; anything else
                    is dropped
     create.fixed   values the server sets, whatever was sent (status,
                    dates, reviewer...)
     update.fields  the only fields a student may change (others must
                    come back unchanged)
     values         allowed values for a field
     check          further validation against the database; returns an
                    error message, or null
     remove         whether a student may delete the record
   A resource with a rule entry but no create/update/remove denies that
   operation to students outright.
   ========================================================= */
const { query } = require("./repository");

const { LOAN_PERIOD_DAYS, COMPLAINT_PRIORITIES, COMPLAINT_RECIPIENT_OFFICES, localDate } = require("../data/shared");

const MAX_ACTIVE_LOANS = 5;
const now = () => new Date().toISOString();

/** An attachment must be a file this user uploaded (POST /api/files), or none. */
function ownFile(field) {
  return async (record, { user }) => {
    const url = record[field];
    if (url === null || url === undefined || url === "") return null;
    const match = /^\/api\/files\/([A-Z0-9-]+)$/.exec(String(url));
    if (!match) return "Attachments must be uploaded through the form.";
    const rows = await query("SELECT owner_user_id AS owner FROM stored_files WHERE id = ? LIMIT 1", [match[1]]);
    return rows[0] && rows[0].owner === user.id ? null : "That attachment is not one of your uploads.";
  };
}

async function studentRecord(user) {
  const rows = await query("SELECT id, programme_id AS programmeId, study_year AS year FROM students WHERE id = ? LIMIT 1", [user.studentId]);
  return rows[0] || null;
}

/** A registration: open semester, and only courses offered to this student. */
async function checkRegistration(record, { user }) {
  const semester = (await query(
    "SELECT id, semester_number AS number FROM semesters WHERE id = ? AND status = 'Active' AND registration_open = 1 LIMIT 1",
    [record.semesterId]))[0];
  if (!semester) return "Registration for that semester is not open.";
  const student = await studentRecord(user);
  if (!student) return "Your account is not linked to a student record.";
  const ids = [...new Set(Array.isArray(record.courseIds) ? record.courseIds.map(String) : [])];
  if (!ids.length) return null;
  const offered = await query(`
    SELECT c.id, c.credits FROM courses c JOIN course_programmes cp ON cp.course_id = c.id
    WHERE c.id IN (?) AND cp.programme_id = ? AND c.study_year = ? AND c.semester_number = ? AND c.status = 'Active'`,
  [ids, student.programmeId, student.year, semester.number]);
  if (offered.length !== ids.length) return "One or more of those courses are not offered to you this semester.";
  // The credit total is worked out here, not taken from the request.
  record.totalCredits = offered.reduce((sum, c) => sum + Number(c.credits), 0);
  return null;
}

const RULES = {
  // The student record itself: changed only through studentUpdatableFields
  // (db/resources.js), never created or deleted by a student.
  students: { update: {} },

  registrations: {
    create: {
      fields: ["semesterId", "courseIds", "status"],
      values: { status: ["Registered", "Draft"] },
      fixed: () => ({ approvedBy: null, approvedAt: null, registeredAt: now() }),
      check: checkRegistration
    },
    update: {
      fields: ["courseIds", "status", "totalCredits"],
      values: { status: ["Registered", "Draft"] },
      check: async (record, ctx, existing) =>
        existing.status === "Approved" ? "An approved registration can only be changed by the registration office." : checkRegistration(record, ctx)
    },
    // Replacing a registration deletes the old one; not once it is approved.
    remove: existing => existing.status !== "Approved"
  },

  requests: {
    create: {
      fields: ["type", "subject", "description", "attachment", "attachmentUrl"],
      fixed: ({ user }) => ({
        status: "PENDING", assignedTo: null, submittedBy: user.id, createdAt: now(),
        timeline: [{ status: "PENDING", date: now(), note: "Request submitted by student." }]
      }),
      check: ownFile("attachmentUrl")
    }
  },

  complaints: {
    create: {
      fields: ["category", "subject", "description", "priority", "attachment", "attachmentUrl", "assignedTo"],
      values: { priority: COMPLAINT_PRIORITIES, assignedTo: COMPLAINT_RECIPIENT_OFFICES },
      fixed: ({ user, body }) => ({
        status: "PENDING", submittedBy: user.id, createdAt: now(),
        timeline: [{ status: "PENDING", date: now(), note: `Complaint submitted by student, routed to ${body.assignedTo || "the university"}.` }]
      }),
      check: ownFile("attachmentUrl")
    }
  },

  documents: {
    create: {
      fields: ["type", "name", "url"],
      fixed: () => ({ status: "Pending", reviewedBy: null, reviewedAt: null, uploadDate: localDate() }),
      check: ownFile("url")
    },
    // Withdrawing a document is fine until the office has reviewed it.
    remove: existing => existing.status === "Pending"
  },

  hostelAllocations: {
    create: {
      fields: ["academicYearId"],
      fixed: () => ({ status: "Requested", roomId: null, allocatedDate: null, requestedDate: localDate() }),
      check: async (_record, { user }) => {
        const active = await query("SELECT 1 FROM hostel_allocations WHERE student_id = ? AND status IN ('Requested', 'Allocated') LIMIT 1", [user.studentId]);
        return active.length ? "You already have an active accommodation request or allocation." : null;
      }
    }
  },

  loans: {
    create: {
      fields: ["bookId"],
      fixed: () => ({ borrowedDate: localDate(), dueDate: localDate(LOAN_PERIOD_DAYS), returnedDate: null, status: "Borrowed" }),
      check: async (record, { user }) => {
        const book = (await query("SELECT available_copies AS available, status FROM library_books WHERE id = ? LIMIT 1", [record.bookId]))[0];
        if (!book) return "That book is not in the catalogue.";
        if (Number(book.available) <= 0) return "All copies of that book are on loan.";
        const active = await query("SELECT book_id AS bookId FROM library_loans WHERE student_id = ? AND returned_at IS NULL", [user.studentId]);
        if (active.some(l => l.bookId === record.bookId)) return "You already have this book on loan.";
        if (active.length >= MAX_ACTIVE_LOANS) return `You can have at most ${MAX_ACTIVE_LOANS} books on loan.`;
        return null;
      }
    }
    // Returning a book is recorded by the library when it is handed back.
  },

  internships: {
    update: {
      fields: ["logbookEntries"],
      check: async (record, _ctx, existing) => {
        const next = Number(record.logbookEntries);
        const previous = Number(existing.logbookEntries) || 0;
        return Number.isInteger(next) && next >= previous && next <= previous + 1 ? null : "Add one logbook entry at a time.";
      }
    }
  },

  graduation: {
    create: {
      fields: ["academicYearId", "checklist"],
      // A new clearance record starts with nothing cleared.
      fixed: ({ body }) => ({
        applicationSubmitted: false, overallStatus: null,
        checklist: Object.fromEntries(Object.keys(body.checklist && typeof body.checklist === "object" ? body.checklist : {}).map(k => [k, false]))
      })
    },
    update: {
      fields: ["applicationSubmitted", "checklist"],
      // A student may only submit the graduation application, and only
      // once every other clearance item has been signed off by the offices.
      check: async (record, _ctx, existing) => {
        const before = existing.checklist || {};
        const after = record.checklist || {};
        for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
          if (key === "Graduation Application") continue;
          if (Boolean(before[key]) !== Boolean(after[key])) return "Clearance items are signed off by the university offices.";
        }
        if (existing.applicationSubmitted && !record.applicationSubmitted) return "A submitted application cannot be withdrawn here.";
        const eligible = Object.entries(before).every(([k, v]) => k === "Graduation Application" || v);
        if ((record.applicationSubmitted || after["Graduation Application"]) && !eligible) return "Complete every clearance item before applying.";
        return null;
      }
    }
  },

  submissions: {
    create: {
      fields: ["assignmentId", "note", "url"],
      fixed: () => ({ score: null, status: "Submitted", gradedBy: null, submittedDate: localDate() }),
      check: async (record, ctx) => {
        const assignment = await query("SELECT 1 FROM elearning_assignments WHERE id = ? LIMIT 1", [record.assignmentId]);
        if (!assignment.length) return "That assignment does not exist.";
        const already = await query("SELECT 1 FROM elearning_submissions WHERE assignment_id = ? AND student_id = ? LIMIT 1", [record.assignmentId, ctx.user.studentId]);
        if (already.length) return "You have already submitted this assignment.";
        return ownFile("url")(record, ctx);
      }
    }
  },

  classCheckins: {
    create: {
      fields: ["entryId", "date", "status"],
      values: { status: ["Attended", "Missed"] },
      check: async (record, { user }) => {
        const student = await studentRecord(user);
        const entry = (await query("SELECT course_id AS courseId, programme_id AS programmeId FROM timetable_entries WHERE id = ? LIMIT 1", [record.entryId]))[0];
        if (!entry || !student || entry.programmeId !== student.programmeId) return "That class is not on your timetable.";
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(record.date || "")) || record.date > localDate()) return "Classes can only be marked on or after the day they happen.";
        record.courseId = entry.courseId;
        return null;
      }
    },
    update: { fields: ["status"], values: { status: ["Attended", "Missed"] } },
    remove: () => true
  }
};

/**
 * Applies the create rule. Returns { body } with only the permitted and
 * server-set fields, or { error, status }.
 */
async function forCreate(name, body, ctx) {
  const rule = RULES[name];
  if (!rule) return { body };
  if (!rule.create) return { error: "Students cannot create these records.", status: 403 };
  const clean = {};
  for (const field of rule.create.fields) if (field in body) clean[field] = body[field];
  Object.assign(clean, typeof rule.create.fixed === "function" ? rule.create.fixed({ ...ctx, body }) : (rule.create.fixed || {}));
  const invalid = invalidValue(rule.create.values, clean);
  if (invalid) return { error: invalid, status: 422 };
  if (rule.create.check) {
    const message = await rule.create.check(clean, ctx);
    if (message) return { error: message, status: 422 };
  }
  return { body: clean };
}

/**
 * The fields a student may change on this resource: [] when they may change
 * nothing, null when this module has no say (the resource's own
 * studentUpdatableFields, or the ordinary rules, apply).
 */
function updatableFields(name) {
  const rule = RULES[name];
  if (!rule) return null;
  if (!rule.update) return [];
  return rule.update.fields || null;
}

async function checkUpdate(name, merged, existing, ctx) {
  const rule = RULES[name] && RULES[name].update;
  if (!rule) return null;
  const invalid = invalidValue(rule.values, merged);
  if (invalid) return invalid;
  return rule.check ? rule.check(merged, ctx, existing) : null;
}

function mayDelete(name, existing) {
  const rule = RULES[name];
  if (!rule) return true;
  return typeof rule.remove === "function" ? Boolean(rule.remove(existing)) : false;
}

function invalidValue(values, record) {
  for (const [field, allowed] of Object.entries(values || {})) {
    if (field in record && record[field] !== null && record[field] !== undefined && !allowed.includes(record[field])) {
      return `"${record[field]}" is not an allowed ${field}.`;
    }
  }
  return null;
}

module.exports = { RULES, forCreate, updatableFields, checkUpdate, mayDelete };

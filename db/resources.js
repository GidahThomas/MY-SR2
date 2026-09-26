/* =========================================================
   USIAMS - db/resources.js
   The single registry that describes every REST resource: the
   table behind it, how API field names map to columns, who may
   read and write it, and how a student's own records are scoped.

   Everything in server.js and db/repository.js is driven from
   here, so adding a resource means adding one entry rather than
   another hand-written set of endpoints.

   AUTHORISATION NOTE
   This registry is the real authorisation boundary. The browser's
   js/auth.js only hides UI; every request is re-checked here
   against the role on the server-side session. In particular the
   Quality Assurance Officer is enforced as read-only by omitting
   the role from every `write` list and by a hard guard in
   server.js, so a tampered client cannot gain write access.
   ========================================================= */

const crypto = require("node:crypto");
const { config } = require("../config");

/** Same scrypt parameters as the login route, so hashes stay comparable. */
function hashPassword(password) {
  return crypto.scryptSync(String(password || ""), config.passwordSalt, 64).toString("hex");
}

const ROLES = [
  "STUDENT", "LECTURER", "ACADEMIC_ADVISOR", "DEPARTMENT_ADMIN", "HEAD_OF_DEPARTMENT",
  "COLLEGE_ADMIN", "INSTITUTE_ADMIN", "SCHOOL_ADMIN", "UNIVERSITY_ADMIN", "EXAMINATION_OFFICER",
  "FINANCE_OFFICER", "REGISTRATION_OFFICER", "QUALITY_ASSURANCE_OFFICER", "SYSTEM_ADMIN",
  "LIBRARIAN", "HOSTEL_OFFICER"
];

/** Roles that may never write, whatever a resource entry says. */
const READ_ONLY_ROLES = ["QUALITY_ASSURANCE_OFFICER"];

const ADMINS = ["UNIVERSITY_ADMIN", "SYSTEM_ADMIN", "DEPARTMENT_ADMIN", "COLLEGE_ADMIN", "INSTITUTE_ADMIN", "SCHOOL_ADMIN", "HEAD_OF_DEPARTMENT"];
const ACADEMIC = ["LECTURER", "ACADEMIC_ADVISOR", "EXAMINATION_OFFICER"];
const STAFF = ROLES.filter(role => role !== "STUDENT");
const EVERYONE = ROLES.slice();

/** JSON columns are stored as text; parse on read, stringify on write. */
const json = {
  parse(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === "object") return value;
    try { return JSON.parse(value); } catch { return null; }
  },
  stringify(value) {
    return value === null || value === undefined ? null : JSON.stringify(value);
  }
};

/**
 * Each resource entry:
 *   table      - SQL table name
 *   idPrefix   - prefix used when the server mints a new id
 *   fields     - { apiField: column }, the first entry being the id
 *   read/write - role lists
 *   ownerField - API field naming the owning student; when the caller is a
 *                STUDENT the list is filtered to their own rows and they may
 *                only write rows they own
 *   selfService- student may create rows for themselves on this resource
 *   jsonFields - API fields stored as JSON text
 *   order      - default ORDER BY (column names)
 */
const RESOURCES = {
  students: {
    table: "students",
    idPrefix: "STU",
    fields: {
      id: "id", regNumber: "registration_number", firstName: "first_name", lastName: "last_name",
      gender: "gender", dob: "date_of_birth", programmeId: "programme_id", departmentId: "department_id",
      year: "study_year", status: "status", email: "email", phone: "phone", address: "address",
      emergencyContactName: "emergency_contact_name", emergencyContactRelation: "emergency_contact_relation",
      emergencyContactPhone: "emergency_contact_phone", admissionDate: "admission_date",
      entryQualification: "entry_qualification", previousSchool: "previous_school", photo: "photo_url",
      bylawsAcknowledgedAt: "bylaws_acknowledged_at", documentsSubmitted: "documents_submitted",
      documentNames: "document_names"
    },
    jsonFields: ["documentNames"],
    read: EVERYONE,
    write: [...ADMINS, "REGISTRATION_OFFICER"],
    // A student may update only these fields, and only on their own record
    // (Complete My Profile, the By-Laws acknowledgement). Everything else -
    // programme, status, registration number - stays with the registry.
    studentUpdatableFields: [
      "phone", "address", "dob", "emergencyContactName", "emergencyContactRelation", "emergencyContactPhone",
      "previousSchool", "entryQualification", "documentsSubmitted", "documentNames", "bylawsAcknowledgedAt"
    ],
    // Sent back by the page but rebuilt from columns on every read.
    derivedFields: ["fullName", "emergencyContact", "admission"],
    ownerField: "id",
    order: "registration_number",
    // The columns are flat, but the modules read a student the way the
    // prototype shaped one: a derived fullName plus nested emergencyContact
    // and admission objects. Reconciling it here keeps the student register,
    // search, reports, dashboards and profile setup working unchanged.
    transformOut(item) {
      item.fullName = [item.firstName, item.lastName].filter(Boolean).join(" ");
      item.emergencyContact = {
        name: item.emergencyContactName,
        relation: item.emergencyContactRelation,
        phone: item.emergencyContactPhone
      };
      item.admission = {
        date: item.admissionDate,
        entryQualification: item.entryQualification,
        previousSchool: item.previousSchool
      };
      return item;
    },
    transformIn(payload) {
      const flat = { ...payload };
      if (payload.emergencyContact) {
        flat.emergencyContactName = payload.emergencyContact.name;
        flat.emergencyContactRelation = payload.emergencyContact.relation;
        flat.emergencyContactPhone = payload.emergencyContact.phone;
      }
      if (payload.admission) {
        flat.admissionDate = payload.admission.date;
        flat.entryQualification = payload.admission.entryQualification;
        flat.previousSchool = payload.admission.previousSchool;
      }
      // fullName is derived and never stored. Only split it when the caller
      // has not supplied the two name columns itself.
      if (payload.fullName && !payload.firstName && !payload.lastName) {
        const parts = String(payload.fullName).trim().split(/\s+/);
        flat.firstName = parts.shift() || "";
        flat.lastName = parts.join(" ");
      }
      return flat;
    }
  },

  programmes: {
    table: "programmes",
    idPrefix: "PRG",
    fields: {
      id: "id", code: "code", name: "name", level: "level", departmentId: "department_id",
      durationYears: "duration_years", creditLimitPerSemester: "credit_limit_per_semester",
      creditMinPerSemester: "credit_min_per_semester", status: "status"
    },
    read: EVERYONE,
    write: ADMINS,
    order: "name"
  },

  departments: {
    table: "departments",
    idPrefix: "DEP",
    fields: { id: "id", code: "code", name: "name", unitId: "unit_id", hod: "head_of_department", status: "status" },
    read: EVERYONE,
    write: ADMINS,
    order: "name"
  },

  orgUnits: {
    table: "organisational_units",
    idPrefix: "UNIT",
    fields: { id: "id", code: "code", name: "name", type: "unit_type", established: "established_year", parentId: "parent_id", status: "status" },
    read: EVERYONE,
    write: ADMINS,
    order: "name"
  },

  academicYears: {
    table: "academic_years",
    idPrefix: "AY",
    fields: { id: "id", label: "label", startsOn: "starts_on", endsOn: "ends_on", status: "status" },
    read: EVERYONE,
    write: ADMINS,
    order: "label"
  },

  semesters: {
    table: "semesters",
    idPrefix: "SEM",
    fields: {
      id: "id", academicYearId: "academic_year_id", semesterNumber: "semester_number", label: "label",
      status: "status", registrationOpen: "registration_open", registrationDeadline: "registration_deadline",
      startsOn: "starts_on", endsOn: "ends_on"
    },
    read: EVERYONE,
    write: [...ADMINS, "REGISTRATION_OFFICER"],
    booleanFields: ["registrationOpen"],
    order: "id"
  },

  courses: {
    table: "courses",
    idPrefix: "CRS",
    fields: {
      id: "id", code: "code", title: "title", credits: "credits", type: "course_type",
      departmentId: "department_id", year: "study_year", semesterNumber: "semester_number", status: "status"
    },
    read: EVERYONE,
    write: [...ADMINS, "EXAMINATION_OFFICER"],
    order: "code",
    // programmeIds / prerequisites live in join tables.
    joins: {
      programmeIds: { table: "course_programmes", localKey: "course_id", valueColumn: "programme_id" },
      prerequisites: { table: "course_prerequisites", localKey: "course_id", valueColumn: "prerequisite_course_id" }
    }
  },

  timetable: {
    table: "timetable_entries",
    idPrefix: "TT",
    fields: {
      id: "id", courseId: "course_id", programmeId: "programme_id", year: "study_year",
      semesterId: "semester_id", day: "day_of_week", startTime: "start_time", endTime: "end_time",
      room: "room", lecturer: "lecturer_name"
    },
    read: EVERYONE,
    write: [...ADMINS, "REGISTRATION_OFFICER"],
    order: "id",
    // The weekly grid places an entry by matching `time` against its slot
    // labels ("08:00", "10:00", ...). A TIME column reads back as
    // "14:00:00", which matches no slot, so the grid would render empty.
    transformOut(item) {
      item.time = typeof item.startTime === "string" ? item.startTime.slice(0, 5) : item.startTime;
      return item;
    },
    transformIn(payload) {
      const flat = { ...payload };
      if (payload.time && !payload.startTime) {
        const [hour, minute] = String(payload.time).split(":").map(Number);
        flat.startTime = `${String(hour).padStart(2, "0")}:${String(minute || 0).padStart(2, "0")}:00`;
        flat.endTime = `${String(hour + 2).padStart(2, "0")}:${String(minute || 0).padStart(2, "0")}:00`;
      }
      return flat;
    }
  },

  registrations: {
    table: "registrations",
    idPrefix: "REG",
    fields: {
      id: "id", studentId: "student_id", semesterId: "semester_id", status: "status",
      totalCredits: "total_credits", registeredAt: "registered_at", approvedBy: "approved_by", approvedAt: "approved_at"
    },
    read: EVERYONE,
    write: [...ADMINS, "REGISTRATION_OFFICER"],
    ownerField: "studentId",
    selfService: true,
    joins: { courseIds: { table: "registration_courses", localKey: "registration_id", valueColumn: "course_id" } },
    order: "id"
  },

  results: {
    table: "result_records",
    idPrefix: "RES",
    fields: {
      id: "id", studentId: "student_id", courseId: "course_id", semesterId: "semester_id",
      ca: "continuous_assessment", exam: "examination_mark", totalMark: "total_mark",
      status: "status", publishedAt: "published_at"
    },
    read: EVERYONE,
    write: [...ADMINS, "EXAMINATION_OFFICER", "LECTURER"],
    ownerField: "studentId",
    // total_mark is a generated column and must never be written.
    readOnlyFields: ["totalMark"],
    order: "id"
  },

  attendance: {
    table: "attendance_records",
    idPrefix: "ATT",
    fields: {
      id: "id", studentId: "student_id", courseId: "course_id", semesterId: "semester_id",
      date: "attendance_date", attended: "attended", lecturer: "lecturer_name", markedBy: "marked_by"
    },
    read: EVERYONE,
    write: [...ADMINS, "LECTURER", "EXAMINATION_OFFICER"],
    ownerField: "studentId",
    booleanFields: ["attended"],
    autoIncrementId: true,
    order: "attendance_date"
  },

  invoices: {
    table: "invoices",
    idPrefix: "INV",
    fields: {
      id: "id", studentId: "student_id", academicYearId: "academic_year_id", description: "description",
      amountBilled: "amount_billed", issuedDate: "issued_date", dueDate: "due_date", status: "status"
    },
    read: EVERYONE,
    write: ["FINANCE_OFFICER", ...ADMINS],
    ownerField: "studentId",
    order: "issued_date"
  },

  payments: {
    table: "payments",
    idPrefix: "PAY",
    fields: {
      id: "id", invoiceId: "invoice_id", studentId: "student_id", amount: "amount",
      date: "payment_date", method: "payment_method", reference: "reference", status: "status", receivedBy: "received_by",
      controlNumber: "control_number", feeItemId: "fee_item_id", payerAccount: "payer_account"
    },
    read: EVERYONE,
    write: ["FINANCE_OFFICER", ...ADMINS],
    ownerField: "studentId",
    order: "payment_date"
  },

  requests: {
    table: "service_requests",
    idPrefix: "REQ",
    fields: {
      id: "id", studentId: "student_id", submittedBy: "submitted_by", type: "request_type",
      subject: "subject", description: "description", status: "status", priority: "priority",
      attachment: "attachment", attachmentUrl: "attachment_url", timeline: "timeline", assignedTo: "assigned_to", createdAt: "created_at"
    },
    read: EVERYONE,
    write: [...ADMINS, "REGISTRATION_OFFICER", "FINANCE_OFFICER"],
    ownerField: "studentId",
    selfService: true,
    jsonFields: ["timeline"],
    order: "created_at"
  },

  complaints: {
    table: "complaints",
    idPrefix: "CMP",
    fields: {
      id: "id", submittedBy: "submitted_by", studentId: "student_id", category: "category",
      subject: "subject", description: "description", status: "status", priority: "priority",
      attachment: "attachment", attachmentUrl: "attachment_url", assignedTo: "assigned_office", timeline: "timeline", createdAt: "created_at"
    },
    read: EVERYONE,
    write: [...ADMINS, "REGISTRATION_OFFICER"],
    ownerField: "studentId",
    selfService: true,
    jsonFields: ["timeline"],
    order: "created_at"
  },

  announcements: {
    table: "announcements",
    idPrefix: "ANN",
    fields: {
      id: "id", title: "title", body: "body", audience: "audience_role", tone: "tone",
      publishedBy: "published_by", publishedDate: "published_at", expiresAt: "expires_at", status: "status"
    },
    read: EVERYONE,
    write: [...ADMINS, "REGISTRATION_OFFICER"],
    order: "published_at"
  },

  notifications: {
    table: "notifications",
    idPrefix: "NTF",
    fields: {
      id: "id", target: "user_id", audience: "audience", category: "category", title: "title",
      description: "message", read: "is_read", date: "created_at", readAt: "read_at"
    },
    read: EVERYONE,
    write: [...ADMINS, "REGISTRATION_OFFICER", "FINANCE_OFFICER"],
    booleanFields: ["read"],
    // Addressed to a user account rather than a student record. A broadcast
    // is fanned out to one row per recipient when it is created, so every
    // row has exactly one owner and "read" is genuinely per reader.
    ownerUserField: "target",
    // A user may mark their own notifications read, or dismiss them.
    selfService: true,
    order: "created_at"
  },

  // Read-only aggregate over attendance_records, shaped exactly like the
  // per-course attendance summary the attendance and dashboard pages render.
  attendanceSummary: {
    table: "student_attendance_summary",
    idPrefix: "ATT",
    fields: {
      id: "id", studentId: "student_id", courseId: "course_id", semesterId: "semester_id",
      lecturer: "lecturer_name", totalClasses: "total_classes", attended: "attended",
      missed: "missed", percentage: "percentage"
    },
    read: EVERYONE,
    write: [],
    ownerField: "studentId",
    order: "student_id"
  },

  documents: {
    table: "document_submissions",
    idPrefix: "DOC",
    fields: {
      id: "id", studentId: "student_id", type: "document_type", name: "file_name", url: "file_url",
      uploadDate: "uploaded_at", status: "status", reviewedBy: "reviewed_by", reviewedAt: "reviewed_at"
    },
    read: EVERYONE,
    write: [...ADMINS, "REGISTRATION_OFFICER"],
    ownerField: "studentId",
    selfService: true,
    order: "uploaded_at"
  },

  hostels: {
    table: "hostels",
    idPrefix: "HST",
    fields: { id: "id", name: "name", location: "location", status: "status" },
    read: EVERYONE,
    write: ["HOSTEL_OFFICER", ...ADMINS],
    order: "name"
  },

  hostelRooms: {
    table: "hostel_rooms",
    idPrefix: "ROOM",
    fields: { id: "id", hostelId: "hostel_id", roomNumber: "room_number", capacity: "capacity", status: "status" },
    read: EVERYONE,
    write: ["HOSTEL_OFFICER", ...ADMINS],
    order: "room_number"
  },

  hostelAllocations: {
    table: "hostel_allocations",
    idPrefix: "ALC",
    fields: {
      id: "id", studentId: "student_id", roomId: "room_id", academicYearId: "academic_year_id",
      status: "status", requestedDate: "requested_date", allocatedDate: "allocated_at"
    },
    read: EVERYONE,
    write: ["HOSTEL_OFFICER", ...ADMINS],
    ownerField: "studentId",
    selfService: true,
    order: "requested_date"
  },

  books: {
    table: "library_books",
    idPrefix: "BK",
    fields: {
      id: "id", isbn: "isbn", title: "title", author: "author", category: "category",
      totalCopies: "total_copies", status: "status"
    },
    // Availability is counted from the loans that are still open rather than
    // read from library_books.available_copies. Nothing maintained that
    // column, so it kept reporting the seeded figure however many books had
    // since been borrowed or returned. data/library.js makes the same point:
    // a copy count must always be derived, never stored twice.
    extraSelect: {
      availableCopies:
        "SELECT GREATEST(CAST(library_books.total_copies AS SIGNED) - COUNT(ll.id), 0) " +
        "FROM library_loans ll WHERE ll.book_id = library_books.id AND ll.returned_at IS NULL"
    },
    read: EVERYONE,
    write: ["LIBRARIAN", ...ADMINS],
    order: "title"
  },

  loans: {
    table: "library_loans",
    idPrefix: "LOAN",
    fields: {
      id: "id", bookId: "book_id", studentId: "student_id", borrowedDate: "borrowed_at",
      dueDate: "due_at", returnedDate: "returned_at", status: "status"
    },
    read: EVERYONE,
    write: ["LIBRARIAN", ...ADMINS],
    ownerField: "studentId",
    selfService: true,
    order: "borrowed_at",
    // The API derives availability, but library_books.available_copies is
    // still a real column that reports and direct queries read, so it is
    // recomputed whenever a loan is taken out, returned or removed.
    async afterWrite(connection, id, payload) {
      const bookId = payload && payload.bookId;
      const ids = bookId
        ? [bookId]
        : (await connection.execute("SELECT book_id FROM library_loans WHERE id = ?", [id]))[0].map(r => r.book_id);
      for (const book of ids) {
        await connection.execute(`
          UPDATE library_books b
          SET b.available_copies = GREATEST(
            CAST(b.total_copies AS SIGNED) -
            (SELECT COUNT(*) FROM library_loans l WHERE l.book_id = b.id AND l.returned_at IS NULL), 0)
          WHERE b.id = ?
        `, [book]);
      }
    }
  },

  internships: {
    table: "internship_records",
    idPrefix: "INT",
    fields: {
      id: "id", studentId: "student_id", organization: "organisation_name", location: "location",
      supervisor: "supervisor_name", startDate: "start_date", endDate: "end_date", status: "status",
      logbookEntries: "logbook_entries", supervisorScore: "supervisor_score",
      academicScore: "academic_score", finalGrade: "final_grade", reportUrl: "report_url"
    },
    read: EVERYONE,
    write: [...ADMINS, ...ACADEMIC],
    ownerField: "studentId",
    selfService: true,
    order: "start_date",
    // The internship page renders the three assessment marks as one block
    // and checks `assessment` before drawing it, so the scores have to be
    // nested rather than flat. A placement not yet assessed has none.
    transformOut(item) {
      const assessed = item.supervisorScore !== null || item.academicScore !== null || item.finalGrade !== null;
      item.assessment = assessed
        ? { supervisorScore: item.supervisorScore, academicScore: item.academicScore, finalGrade: item.finalGrade }
        : null;
      return item;
    },
    transformIn(payload) {
      const flat = { ...payload };
      if (payload.assessment) {
        flat.supervisorScore = payload.assessment.supervisorScore;
        flat.academicScore = payload.assessment.academicScore;
        flat.finalGrade = payload.assessment.finalGrade;
      }
      return flat;
    }
  },

  graduation: {
    table: "graduation_clearance",
    idPrefix: "GRD",
    fields: {
      id: "id", studentId: "student_id", academicYearId: "academic_year_id", checklist: "checklist",
      applicationSubmitted: "application_submitted", overallStatus: "overall_status"
    },
    read: EVERYONE,
    write: [...ADMINS, "REGISTRATION_OFFICER"],
    ownerField: "studentId",
    selfService: true,
    jsonFields: ["checklist"],
    booleanFields: ["applicationSubmitted"],
    order: "id"
  },

  alumni: {
    table: "alumni",
    idPrefix: "ALM",
    fields: {
      id: "id", name: "full_name", regNumber: "registration_number", programmeId: "programme_id",
      graduationYear: "graduation_year", employmentStatus: "employment_status",
      organization: "organisation", contact: "contact"
    },
    read: STAFF,
    write: [...ADMINS, "REGISTRATION_OFFICER"],
    order: "graduation_year"
  },

  qaFlags: {
    table: "qa_flags",
    idPrefix: "FLAG",
    fields: {
      id: "id", category: "category", severity: "severity", entity: "entity_id",
      entityLabel: "entity_label", description: "description", date: "raised_on",
      status: "status", raisedBy: "raised_by", resolvedAt: "resolved_at"
    },
    read: STAFF,
    // The QA Officer raises flags in the real workflow, but this system keeps
    // that role strictly read-only; administrators record flags on their behalf.
    write: ADMINS,
    order: "raised_on"
  },

  calendar: {
    table: "calendar_events",
    idPrefix: "CAL",
    fields: { id: "id", title: "title", description: "description", date: "event_date", endDate: "end_date", academicYearId: "academic_year_id" },
    read: EVERYONE,
    write: ADMINS,
    order: "event_date"
  },

  holidays: {
    table: "public_holidays",
    idPrefix: "HOL",
    fields: { id: "id", date: "holiday_date", title: "title" },
    read: EVERYONE,
    write: ADMINS,
    order: "holiday_date"
  },

  materials: {
    table: "elearning_materials",
    idPrefix: "MAT",
    fields: { id: "id", courseId: "course_id", title: "title", type: "material_type", url: "file_url", uploadedDate: "uploaded_at", uploadedBy: "uploaded_by" },
    read: EVERYONE,
    write: [...ADMINS, "LECTURER"],
    order: "uploaded_at"
  },

  assignments: {
    table: "elearning_assignments",
    idPrefix: "ASG",
    fields: { id: "id", courseId: "course_id", title: "title", description: "description", dueDate: "due_date", maxScore: "max_score", createdBy: "created_by" },
    read: EVERYONE,
    write: [...ADMINS, "LECTURER"],
    order: "due_date"
  },

  submissions: {
    table: "elearning_submissions",
    idPrefix: "SUB",
    fields: {
      id: "id", assignmentId: "assignment_id", studentId: "student_id", submittedDate: "submitted_at",
      note: "note", url: "file_url", score: "score", status: "status", gradedBy: "graded_by"
    },
    read: EVERYONE,
    write: [...ADMINS, "LECTURER"],
    ownerField: "studentId",
    selfService: true,
    order: "submitted_at"
  },

  applications: {
    table: "admission_applications",
    idPrefix: "APP",
    fields: {
      id: "id", fullName: "full_name", email: "email", phone: "phone", gender: "gender",
      programmeId: "programme_id", previousSchool: "previous_school", entryQualification: "entry_qualification",
      applicationDate: "application_date", status: "status", notes: "notes",
      reviewedBy: "reviewed_by", reviewedAt: "reviewed_at"
    },
    read: STAFF,
    write: [...ADMINS, "REGISTRATION_OFFICER"],
    order: "application_date"
  },

  auditLogs: {
    table: "audit_logs",
    idPrefix: "LOG",
    fields: {
      id: "id", userId: "user_id", user: "user_name", role: "user_role", action: "action",
      entity: "entity_type", entityId: "entity_id", entityLabel: "entity_label",
      status: "status", ip: "ip_address", date: "created_at"
    },
    // The audit trail is a supervisory record: staff may read it, nobody writes
    // it through the API - entries are only ever appended by the server itself.
    read: STAFF,
    write: [],
    autoIncrementId: true,
    order: "created_at",
    // The trail is stored as one timestamp but shown as separate date and
    // time columns, so the page renders `${formatDate(date)} ${time}`.
    transformOut(item) {
      const stamp = String(item.date || "");
      item.time = stamp.includes("T") ? stamp.slice(11, 16) : "";
      item.date = stamp.slice(0, 10);
      return item;
    }
  },

  users: {
    table: "users",
    idPrefix: "USR",
    fields: {
      id: "id", username: "username", name: "full_name", email: "email", status: "status",
      departmentId: "department_id", unitId: "unit_id", lastLogin: "last_login_at"
    },
    // A user's role lives in the user_roles join table, and a student
    // account is tied to its student record by email. Both are read here
    // because the staff directory and the administration register filter
    // and group accounts by role - without it every row renders blank.
    extraSelect: {
      role: "SELECT ur.role_id FROM user_roles ur WHERE ur.user_id = users.id ORDER BY ur.role_id LIMIT 1",
      studentId: "SELECT s.id FROM students s WHERE s.email = users.email LIMIT 1"
    },
    // Accepted on write but never selected, so the hash cannot leak through
    // the API however a caller asks for it.
    writeOnly: { password: "password_hash" },
    // The role is not a column, so it is written to the join table after
    // the row itself; see afterWrite.
    async afterWrite(connection, id, payload) {
      if (!payload || !payload.role) return;
      await connection.execute("DELETE FROM user_roles WHERE user_id = ?", [id]);
      await connection.execute("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)", [id, payload.role]);
    },
    transformIn(payload) {
      const flat = { ...payload };
      // The administration page creates accounts with a temporary password.
      // Hash it the same way the login route does; never store it as typed.
      if (payload.password) flat.password = hashPassword(payload.password);
      return flat;
    },
    // Account records are administrative; students never list other accounts.
    read: STAFF,
    // Department, college, institute and school admins may manage accounts
    // too, but only inside their own scope - see scopedAccountRefusal in
    // server.js, which every users write passes through.
    write: ["SYSTEM_ADMIN", "UNIVERSITY_ADMIN", "DEPARTMENT_ADMIN", "HEAD_OF_DEPARTMENT",
      "COLLEGE_ADMIN", "INSTITUTE_ADMIN", "SCHOOL_ADMIN"],
    order: "username"
  }
};

module.exports = { RESOURCES, ROLES, READ_ONLY_ROLES, ADMINS, ACADEMIC, STAFF, EVERYONE, json };

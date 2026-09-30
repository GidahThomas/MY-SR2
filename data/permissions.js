/* =========================================================
   USIAMS - data/permissions.js
   The modules an administrator can grant or withhold per role
   (Administration > Roles & Permissions), defined once for the
   browser (USIAMS.permissions) and the server
   (require("./data/permissions")).

   Each module has a page and the data it owns:
     resources  records the module creates and changes - "Manage"
                is needed to write them once a rule is set
     private    records only roles with access may read at all
                (other data, such as course and student names, is
                shared reference data every page relies on)

   Levels: "none" (page hidden and refused), "view" (open and read
   only) and "manage" (read and change). With no rule stored, a role
   keeps exactly the access the code has always given it.
   ========================================================= */
(function (root, factory) {
  const permissions = factory();
  if (typeof module === "object" && module.exports) module.exports = permissions;
  else {
    root.USIAMS = root.USIAMS || {};
    root.USIAMS.permissions = permissions;
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const LEVELS = ["none", "view", "manage"];
  const LEVEL_LABELS = { none: "No access", view: "View", manage: "Manage" };

  const MODULES = [
    { key: "students", label: "Students", group: "Academic", page: "students.html", resources: ["students"], private: [] },
    { key: "academics", label: "Academic structure", group: "Academic", page: "academics.html", resources: ["programmes", "departments", "orgUnits", "academicYears", "semesters"], private: [] },
    { key: "courses", label: "Courses", group: "Academic", page: "courses.html", resources: ["courses"], private: [] },
    { key: "registration", label: "Course registration", group: "Academic", page: "registration.html", resources: ["registrations"], private: [] },
    { key: "results", label: "Results", group: "Academic", page: "results.html", resources: ["results"], private: [] },
    { key: "attendance", label: "Attendance", group: "Academic", page: "attendance.html", resources: ["attendance", "classCheckins"], private: [] },
    { key: "timetable", label: "Timetable", group: "Academic", page: "timetable.html", resources: ["timetable"], private: [] },
    { key: "elearning", label: "E-learning", group: "Academic", page: "elearning.html", resources: ["materials", "assignments", "submissions"], private: [] },
    { key: "finance", label: "Finance & fees", group: "Services", page: "finance.html", resources: ["invoices", "payments"], private: ["invoices", "payments"] },
    { key: "documents", label: "Documents", group: "Services", page: "documents.html", resources: ["documents"], private: ["documents"] },
    { key: "requests", label: "Requests", group: "Services", page: "requests.html", resources: ["requests"], private: [] },
    { key: "complaints", label: "Complaints", group: "Services", page: "complaints.html", resources: ["complaints"], private: [] },
    { key: "announcements", label: "Announcements", group: "Services", page: "announcements.html", resources: ["announcements"], private: [] },
    { key: "calendar", label: "Academic calendar", group: "Services", page: "calendar.html", resources: ["calendar", "holidays"], private: [] },
    { key: "internship", label: "Internship", group: "Services", page: "internship.html", resources: ["internships"], private: ["internships"] },
    { key: "graduation", label: "Graduation clearance", group: "Services", page: "graduation.html", resources: ["graduation"], private: ["graduation"] },
    { key: "alumni", label: "Alumni", group: "Services", page: "alumni.html", resources: ["alumni"], private: ["alumni"] },
    { key: "library", label: "Library", group: "Services", page: "library.html", resources: ["books", "loans"], private: ["loans"] },
    { key: "hostel", label: "Hostel", group: "Services", page: "hostel.html", resources: ["hostels", "hostelRooms", "hostelAllocations"], private: ["hostelAllocations"] },
    { key: "admissions", label: "Admissions", group: "Services", page: "admissions.html", resources: ["applications"], private: ["applications"] },
    { key: "staffDirectory", label: "Staff directory", group: "Services", page: "staff-directory.html", resources: [], private: [] },
    { key: "quality", label: "Quality assurance", group: "Governance", page: "quality-assurance.html", resources: ["qaFlags"], private: ["qaFlags"] },
    { key: "reports", label: "Reports", group: "Governance", page: "reports.html", resources: [], private: [] },
    { key: "administration", label: "Administration", group: "Governance", page: "administration.html", resources: ["users"], private: [] },
    { key: "auditLogs", label: "Audit logs", group: "Governance", page: "audit-logs.html", resources: [], private: ["auditLogs"] }
  ];

  // Roles whose access is limited whatever an administrator sets: students
  // only ever act on their own records (db/student-rules.js), and the QA
  // officer is read-only by policy. Modules with nothing to change offer
  // "View" at most.
  const VIEW_ONLY_ROLES = ["STUDENT", "QUALITY_ASSURANCE_OFFICER"];
  // So no administrator can lock everyone out of this screen.
  const FIXED = { SYSTEM_ADMIN: { administration: "manage" } };

  const byKey = Object.fromEntries(MODULES.map(m => [m.key, m]));

  function moduleForPage(file) {
    return MODULES.find(m => m.page === file) || null;
  }

  function moduleForResource(name) {
    return MODULES.find(m => m.resources.includes(name)) || null;
  }

  function privateModuleForResource(name) {
    return MODULES.find(m => m.private.includes(name)) || null;
  }

  /** The levels an administrator may choose for this role and module. */
  function allowedLevels(role, moduleKey) {
    const fixed = FIXED[role] && FIXED[role][moduleKey];
    if (fixed) return [fixed];
    const module = byKey[moduleKey];
    const canManage = module && module.resources.length && !VIEW_ONLY_ROLES.includes(role);
    return canManage ? LEVELS : ["none", "view"];
  }

  function rank(level) {
    return LEVELS.indexOf(level);
  }

  return { LEVELS, LEVEL_LABELS, MODULES, VIEW_ONLY_ROLES, FIXED, byKey, moduleForPage, moduleForResource, privateModuleForResource, allowedLevels, rank };
});

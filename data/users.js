/* =========================================================
   USIAMS - data/users.js
   Staff and demo user records behind the demo data (who posted an
   announcement, which lecturer teaches a class...).

   These are NOT sign-in accounts. db/seed-from-data.js removes them
   after seeding; only the test suite keeps them as logins, with the
   passwords in db/demo-passwords.js, which is never sent to browsers.
   Real accounts are created with npm run create-admin and from
   Administration > Users.
   ========================================================= */
(function (global) {
  "use strict";

  const ROLES = {
    STUDENT: "Student",
    LECTURER: "Lecturer",
    ACADEMIC_ADVISOR: "Academic Advisor",
    DEPARTMENT_ADMIN: "Department Admin",
    HEAD_OF_DEPARTMENT: "Head of Department",
    COLLEGE_ADMIN: "College Admin",
    INSTITUTE_ADMIN: "Institute Admin",
    SCHOOL_ADMIN: "School Admin",
    UNIVERSITY_ADMIN: "University Admin",
    EXAMINATION_OFFICER: "Examination Officer",
    FINANCE_OFFICER: "Finance Officer",
    REGISTRATION_OFFICER: "Registration Officer",
    QUALITY_ASSURANCE_OFFICER: "Quality Assurance Officer",
    SYSTEM_ADMIN: "System Admin",
    LIBRARIAN: "Librarian",
    HOSTEL_OFFICER: "Hostel Officer"
  };

  // Demo login accounts - one per role, as required by the brief.
  const USERS = [
    { id: "USR-0001", username: "student", name: "Baraka Komba", email: "baraka.komba0001@students.usiams.ac.tz", role: "STUDENT", departmentId: "DCSE", studentId: "STU-0001", status: "Active", lastLogin: "2026-09-12T08:15:00" },
    { id: "USR-0002", username: "lecturer", name: "Dr. Amani Mrema", email: "amani.mrema@usiams.ac.tz", role: "LECTURER", departmentId: "DCSE", status: "Active", lastLogin: "2026-09-12T07:40:00" },
    { id: "USR-0003", username: "advisor", name: "Dr. Zawadi Komba", email: "zawadi.komba@usiams.ac.tz", role: "ACADEMIC_ADVISOR", departmentId: "DCSE", status: "Active", lastLogin: "2026-09-11T14:05:00" },
    { id: "USR-0004", username: "deptadmin", name: "Rehema Ndosi", email: "rehema.ndosi@usiams.ac.tz", role: "DEPARTMENT_ADMIN", departmentId: "DCSE", status: "Active", lastLogin: "2026-09-11T09:20:00" },
    { id: "USR-0005", username: "hod", name: "Dr. Amani Mrema", email: "hod.dcse@usiams.ac.tz", role: "HEAD_OF_DEPARTMENT", departmentId: "DCSE", status: "Active", lastLogin: "2026-09-10T16:30:00" },
    { id: "USR-0006", username: "collegeadmin", name: "Godfrey Mwakalinga", email: "collegeadmin@usiams.ac.tz", role: "COLLEGE_ADMIN", unitId: "CIVE", status: "Active", lastLogin: "2026-09-10T11:00:00" },
    { id: "USR-0007", username: "instituteadmin", name: "Editha Sanga", email: "instituteadmin@usiams.ac.tz", role: "INSTITUTE_ADMIN", unitId: "CI", status: "Active", lastLogin: "2026-09-09T13:45:00" },
    { id: "USR-0008", username: "schooladmin", name: "Innocent Chacha", email: "schooladmin@usiams.ac.tz", role: "SCHOOL_ADMIN", unitId: "SOL", status: "Active", lastLogin: "2026-09-09T10:10:00" },
    { id: "USR-0009", username: "admin", name: "Prof. Deogratius Kimaro", email: "admin@usiams.ac.tz", role: "UNIVERSITY_ADMIN", status: "Active", lastLogin: "2026-09-13T07:00:00" },
    { id: "USR-0010", username: "examofficer", name: "Salome Mtui", email: "examofficer@usiams.ac.tz", role: "EXAMINATION_OFFICER", status: "Active", lastLogin: "2026-09-12T12:15:00" },
    { id: "USR-0011", username: "finance", name: "Yohana Ndumbaro", email: "finance@usiams.ac.tz", role: "FINANCE_OFFICER", status: "Active", lastLogin: "2026-09-12T09:05:00" },
    { id: "USR-0012", username: "registration", name: "Victoria Mgaya", email: "registration@usiams.ac.tz", role: "REGISTRATION_OFFICER", status: "Active", lastLogin: "2026-09-12T08:50:00" },
    { id: "USR-0013", username: "qa", name: "Consolata Lyimo", email: "qa@usiams.ac.tz", role: "QUALITY_ASSURANCE_OFFICER", status: "Active", lastLogin: "2026-09-11T15:30:00" },
    { id: "USR-0014", username: "sysadmin", name: "Upendo Mallya", email: "sysadmin@usiams.ac.tz", role: "SYSTEM_ADMIN", status: "Active", lastLogin: "2026-09-13T06:45:00" },
    { id: "USR-0019", username: "librarian", name: "Beatrice Mollel", email: "librarian@usiams.ac.tz", role: "LIBRARIAN", status: "Active", lastLogin: "2026-09-12T08:00:00" },
    { id: "USR-0020", username: "hostel", name: "Raymond Kessy", email: "hostel@usiams.ac.tz", role: "HOSTEL_OFFICER", status: "Active", lastLogin: "2026-09-12T08:00:00" },

    // Additional directory users shown in Administration > Users for realism
    { id: "USR-0015", username: "jmassawe", name: "Dr. Imani Massawe", email: "imani.massawe@usiams.ac.tz", role: "LECTURER", departmentId: "DIS", status: "Active", lastLogin: "2026-09-08T09:00:00" },
    { id: "USR-0016", username: "gtemba", name: "Dr. Godbless Temba", email: "godbless.temba@usiams.ac.tz", role: "LECTURER", departmentId: "DACC", status: "Active", lastLogin: "2026-09-07T09:00:00" },
    { id: "USR-0017", username: "hkomba", name: "Dr. Happiness Komba", email: "happiness.komba@usiams.ac.tz", role: "LECTURER", departmentId: "DMKT", status: "Active", lastLogin: "2026-09-05T09:00:00" },
    { id: "USR-0018", username: "nkimaro", name: "Dr. Neema Kimaro", email: "neema.kimaro@usiams.ac.tz", role: "LECTURER", departmentId: "DLAW", status: "Inactive", lastLogin: "2026-08-20T09:00:00" }
  ];

  function findByUsername(username) {
    return USERS.find(u => u.username.toLowerCase() === String(username || "").toLowerCase());
  }

  function roleLabel(roleKey) {
    return ROLES[roleKey] || roleKey;
  }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.data = global.USIAMS.data || {};
  global.USIAMS.data.roles = ROLES;
  global.USIAMS.data.users = USERS;
  global.USIAMS.users = { findByUsername, roleLabel };

})(window);

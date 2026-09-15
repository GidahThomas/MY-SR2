/* =========================================================
   USIAMS - data/users.js
   Demo user directory for this frontend prototype.

   SECURITY NOTE (frontend prototype only):
   Passwords below are stored in plain text purely so this demo
   can authenticate entirely in the browser with no server. This
   is NOT how production authentication should work. The future
   Yii2/MySQL backend MUST:
     - store salted/hashed passwords (e.g. bcrypt via Yii2 Security),
     - authenticate and issue sessions/tokens server-side,
     - enforce role-based access control (RBAC) on every endpoint,
       returning HTTP 403 for unauthorized requests.
   Nothing in this file should ever be treated as a real security
   boundary - see js/auth.js for further notes.
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
    SYSTEM_ADMIN: "System Admin"
  };

  // Demo login accounts - one per role, as required by the brief.
  const USERS = [
    { id: "USR-0001", username: "student", password: "student123", name: "Baraka Komba", email: "baraka.komba0001@students.usiams.ac.tz", role: "STUDENT", departmentId: "DCSE", studentId: "STU-0001", status: "Active", lastLogin: "2026-09-12T08:15:00" },
    { id: "USR-0002", username: "lecturer", password: "lecturer123", name: "Dr. Amani Mrema", email: "amani.mrema@usiams.ac.tz", role: "LECTURER", departmentId: "DCSE", status: "Active", lastLogin: "2026-09-12T07:40:00" },
    { id: "USR-0003", username: "advisor", password: "advisor123", name: "Dr. Zawadi Komba", email: "zawadi.komba@usiams.ac.tz", role: "ACADEMIC_ADVISOR", departmentId: "DCSE", status: "Active", lastLogin: "2026-09-11T14:05:00" },
    { id: "USR-0004", username: "deptadmin", password: "deptadmin123", name: "Rehema Ndosi", email: "rehema.ndosi@usiams.ac.tz", role: "DEPARTMENT_ADMIN", departmentId: "DCSE", status: "Active", lastLogin: "2026-09-11T09:20:00" },
    { id: "USR-0005", username: "hod", password: "hod123", name: "Dr. Amani Mrema", email: "hod.dcse@usiams.ac.tz", role: "HEAD_OF_DEPARTMENT", departmentId: "DCSE", status: "Active", lastLogin: "2026-09-10T16:30:00" },
    { id: "USR-0006", username: "collegeadmin", password: "collegeadmin123", name: "Godfrey Mwakalinga", email: "collegeadmin@usiams.ac.tz", role: "COLLEGE_ADMIN", unitId: "COET", status: "Active", lastLogin: "2026-09-10T11:00:00" },
    { id: "USR-0007", username: "instituteadmin", password: "instituteadmin123", name: "Editha Sanga", email: "instituteadmin@usiams.ac.tz", role: "INSTITUTE_ADMIN", unitId: "ICCT", status: "Active", lastLogin: "2026-09-09T13:45:00" },
    { id: "USR-0008", username: "schooladmin", password: "schooladmin123", name: "Innocent Chacha", email: "schooladmin@usiams.ac.tz", role: "SCHOOL_ADMIN", unitId: "SOL", status: "Active", lastLogin: "2026-09-09T10:10:00" },
    { id: "USR-0009", username: "admin", password: "admin123", name: "Prof. Deogratius Kimaro", email: "admin@usiams.ac.tz", role: "UNIVERSITY_ADMIN", status: "Active", lastLogin: "2026-09-13T07:00:00" },
    { id: "USR-0010", username: "examofficer", password: "examofficer123", name: "Salome Mtui", email: "examofficer@usiams.ac.tz", role: "EXAMINATION_OFFICER", status: "Active", lastLogin: "2026-09-12T12:15:00" },
    { id: "USR-0011", username: "finance", password: "finance123", name: "Yohana Ndumbaro", email: "finance@usiams.ac.tz", role: "FINANCE_OFFICER", status: "Active", lastLogin: "2026-09-12T09:05:00" },
    { id: "USR-0012", username: "registration", password: "registration123", name: "Victoria Mgaya", email: "registration@usiams.ac.tz", role: "REGISTRATION_OFFICER", status: "Active", lastLogin: "2026-09-12T08:50:00" },
    { id: "USR-0013", username: "qa", password: "qa123", name: "Consolata Lyimo", email: "qa@usiams.ac.tz", role: "QUALITY_ASSURANCE_OFFICER", status: "Active", lastLogin: "2026-09-11T15:30:00" },
    { id: "USR-0014", username: "sysadmin", password: "sysadmin123", name: "Upendo Mallya", email: "sysadmin@usiams.ac.tz", role: "SYSTEM_ADMIN", status: "Active", lastLogin: "2026-09-13T06:45:00" },

    // Additional directory users shown in Administration > Users for realism
    { id: "USR-0015", username: "jmassawe", password: "changeme123", name: "Dr. Imani Massawe", email: "imani.massawe@usiams.ac.tz", role: "LECTURER", departmentId: "DIS", status: "Active", lastLogin: "2026-09-08T09:00:00" },
    { id: "USR-0016", username: "gtemba", password: "changeme123", name: "Dr. Godbless Temba", email: "godbless.temba@usiams.ac.tz", role: "LECTURER", departmentId: "DACC", status: "Active", lastLogin: "2026-09-07T09:00:00" },
    { id: "USR-0017", username: "hkomba", password: "changeme123", name: "Dr. Happiness Komba", email: "happiness.komba@usiams.ac.tz", role: "LECTURER", departmentId: "DMKT", status: "Active", lastLogin: "2026-09-05T09:00:00" },
    { id: "USR-0018", username: "nkimaro", password: "changeme123", name: "Dr. Neema Kimaro", email: "neema.kimaro@usiams.ac.tz", role: "LECTURER", departmentId: "DLAW", status: "Inactive", lastLogin: "2026-08-20T09:00:00" }
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

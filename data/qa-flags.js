/* =========================================================
   USIAMS - data/qa-flags.js
   Data quality flags raised during automated QA audit sweeps.
   Quality Assurance Officers may only VIEW these - see js/qa.js
   for the read-only enforcement used across the QA module.
   ========================================================= */
(function (global) {
  "use strict";

  const QA_FLAG_STATUSES = ["OPEN", "UNDER_REVIEW", "RESOLVED"];

  const QA_FLAGS = [
    { id: "FLAG-001", category: "Student Records", severity: "Medium", entity: "STU-0015", entityLabel: "Student STU-0015", description: "Missing student contact phone number.", date: "2026-09-08", status: "OPEN" },
    { id: "FLAG-002", category: "Registration", severity: "High", entity: "STU-0022", entityLabel: "Student STU-0022", description: "Duplicate course registration record detected for AY2025/2026 - Semester I.", date: "2026-09-07", status: "UNDER_REVIEW" },
    { id: "FLAG-003", category: "Results", severity: "Critical", entity: "CP203", entityLabel: "Course CP203 - Database Systems", description: "Missing result entry for 2 students despite closed grading window.", date: "2026-09-06", status: "OPEN" },
    { id: "FLAG-004", category: "Registration", severity: "High", entity: "STU-0033", entityLabel: "Student STU-0033", description: "Invalid course registration - credit load exceeds programme limit.", date: "2026-09-05", status: "OPEN" },
    { id: "FLAG-005", category: "Attendance", severity: "Medium", entity: "STU-0041", entityLabel: "Student STU-0041", description: "Missing attendance records for CP302 across 3 consecutive weeks.", date: "2026-09-04", status: "RESOLVED" },
    { id: "FLAG-006", category: "Student Records", severity: "Low", entity: "STU-0009", entityLabel: "Student STU-0009", description: "Emergency contact information appears incomplete.", date: "2026-09-03", status: "UNDER_REVIEW" },
    { id: "FLAG-007", category: "Results", severity: "Medium", entity: "STU-0028", entityLabel: "Student STU-0028", description: "Unusual grade pattern - sharp GPA drop between consecutive semesters.", date: "2026-09-02", status: "OPEN" },
    { id: "FLAG-008", category: "Graduation", severity: "Low", entity: "STU-0007", entityLabel: "Student STU-0007", description: "Inconsistent academic record - missing department clearance despite eligible GPA.", date: "2026-09-01", status: "OPEN" },
    { id: "FLAG-009", category: "Finance", severity: "Medium", entity: "STU-0019", entityLabel: "Student STU-0019", description: "Payment reference recorded twice for the same invoice.", date: "2026-08-30", status: "RESOLVED" },
    { id: "FLAG-010", category: "Student Records", severity: "Low", entity: "STU-0044", entityLabel: "Student STU-0044", description: "Possible duplicate student record with similar registration number.", date: "2026-08-29", status: "UNDER_REVIEW" }
  ];

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.data = global.USIAMS.data || {};
  global.USIAMS.data.qaFlagStatuses = QA_FLAG_STATUSES;
  global.USIAMS.data.qaFlags = QA_FLAGS;

})(window);

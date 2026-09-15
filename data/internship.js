/* =========================================================
   USIAMS - data/internship.js
   Seed internship placement records for final/penultimate year
   students (localStorage-backed via js/internship.js).
   ========================================================= */
(function (global) {
  "use strict";

  const INTERNSHIP_STATUSES = ["Pending", "Approved", "In Progress", "Completed"];

  const SEED_INTERNSHIPS = [
    {
      id: "INT-0001", studentId: "STU-0001", organization: "Tanzania Revenue Authority (TRA)", location: "Dar es Salaam",
      supervisor: "Eng. Castus Mbise", startDate: "2026-06-01", endDate: "2026-08-30", status: "Completed",
      logbookEntries: 42, assessment: { supervisorScore: 82, academicScore: 78, finalGrade: "B+" }
    },
    {
      id: "INT-0002", studentId: "STU-0004", organization: "CRDB Bank Plc", location: "Dodoma",
      supervisor: "Ms. Restituta Rutta", startDate: "2026-09-01", endDate: "2026-11-30", status: "In Progress",
      logbookEntries: 18, assessment: null
    },
    {
      id: "INT-0003", studentId: "STU-0007", organization: "Vodacom Tanzania", location: "Dar es Salaam",
      supervisor: "Mr. Longin Mnyika", startDate: "2026-09-01", endDate: "2026-11-30", status: "In Progress",
      logbookEntries: 15, assessment: null
    },
    {
      id: "INT-0004", studentId: "STU-0012", organization: "National Bureau of Statistics", location: "Dodoma",
      supervisor: "Dr. Scholastica Materu", startDate: "2026-10-01", endDate: "2026-12-31", status: "Approved",
      logbookEntries: 0, assessment: null
    },
    {
      id: "INT-0005", studentId: "STU-0018", organization: "NMB Bank Plc", location: "Mwanza",
      supervisor: "Mr. Erasto Nyalusi", startDate: null, endDate: null, status: "Pending",
      logbookEntries: 0, assessment: null
    }
  ];

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.data = global.USIAMS.data || {};
  global.USIAMS.data.internshipStatuses = INTERNSHIP_STATUSES;
  global.USIAMS.data.seedInternships = SEED_INTERNSHIPS;

})(window);

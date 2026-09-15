/* =========================================================
   USIAMS - data/graduation.js
   Graduation clearance checklist seed data
   (localStorage-backed via js/graduation.js).
   ========================================================= */
(function (global) {
  "use strict";

  const CHECKLIST_ITEMS = ["Academic Requirements", "Fees Clearance", "Department Clearance", "Library Clearance", "Documents Submitted", "Graduation Application"];

  const SEED_GRADUATION = [
    {
      id: "GRD-0001", studentId: "STU-0001",
      checklist: { "Academic Requirements": true, "Fees Clearance": false, "Department Clearance": true, "Library Clearance": true, "Documents Submitted": true, "Graduation Application": false },
      applicationSubmitted: false
    },
    {
      id: "GRD-0002", studentId: "STU-0004",
      checklist: { "Academic Requirements": true, "Fees Clearance": true, "Department Clearance": true, "Library Clearance": true, "Documents Submitted": true, "Graduation Application": true },
      applicationSubmitted: true
    },
    {
      id: "GRD-0003", studentId: "STU-0007",
      checklist: { "Academic Requirements": true, "Fees Clearance": false, "Department Clearance": false, "Library Clearance": true, "Documents Submitted": false, "Graduation Application": false },
      applicationSubmitted: false
    },
    {
      id: "GRD-0004", studentId: "STU-0012",
      checklist: { "Academic Requirements": false, "Fees Clearance": true, "Department Clearance": true, "Library Clearance": true, "Documents Submitted": true, "Graduation Application": false },
      applicationSubmitted: false
    }
  ];

  function progressFor(checklist) {
    const values = Object.values(checklist);
    const done = values.filter(Boolean).length;
    return Math.round((done / values.length) * 100);
  }
  function eligibilityFor(checklist) {
    const values = Object.values(checklist);
    if (values.every(Boolean)) return "Eligible";
    if (values.filter(Boolean).length === 0) return "Pending Clearance";
    return values.every(Boolean) ? "Eligible" : "Not Eligible";
  }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.data = global.USIAMS.data || {};
  global.USIAMS.data.graduationChecklistItems = CHECKLIST_ITEMS;
  global.USIAMS.data.seedGraduation = SEED_GRADUATION;
  global.USIAMS.graduation = { progressFor, eligibilityFor };

})(window);

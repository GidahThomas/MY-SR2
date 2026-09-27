/* =========================================================
   USIAMS - data/complaints.js
   Seed data for the Complaints module (localStorage-backed,
   see js/complaints.js).
   ========================================================= */
(function (global) {
  "use strict";

  const COMPLAINT_CATEGORIES = ["Academic", "Administrative", "Facilities", "Harassment", "Financial", "ICT / System Issue", "Other"];
  const { COMPLAINT_PRIORITIES, COMPLAINT_RECIPIENT_OFFICES } = global.USIAMS.shared;
  const COMPLAINT_STATUSES = ["PENDING", "IN_PROGRESS", "RESOLVED", "REJECTED", "ESCALATED", "CLOSED"];
  // Chosen by the student at submission time, so a complaint is routed
  // to the right office immediately rather than sitting unassigned
  // until a staff member manually triages it.

  const SEED_COMPLAINTS = [
    {
      id: "CMP-0001", studentId: "STU-0001", category: "Facilities",
      description: "Air conditioning in Lab-A has been non-functional for two weeks, affecting practical sessions.",
      priority: "MEDIUM", attachment: null, status: "IN_PROGRESS", createdAt: "2026-09-01T09:00:00", assignedTo: "Facilities / Estates Office",
      timeline: [
        { status: "PENDING", date: "2026-09-01T09:00:00", note: "Complaint submitted." },
        { status: "IN_PROGRESS", date: "2026-09-02T10:15:00", note: "Assigned to Facilities Unit for inspection." }
      ]
    },
    {
      id: "CMP-0002", studentId: "STU-0004", category: "Academic",
      description: "Lecture for CP201 was cancelled twice without prior notice this month.",
      priority: "LOW", attachment: null, status: "RESOLVED", createdAt: "2026-08-18T11:20:00", assignedTo: "Head of Department / Academic Office",
      timeline: [
        { status: "PENDING", date: "2026-08-18T11:20:00", note: "Complaint submitted." },
        { status: "RESOLVED", date: "2026-08-20T15:00:00", note: "Make-up classes scheduled; lecturer notified." }
      ]
    },
    {
      id: "CMP-0003", studentId: "STU-0009", category: "Financial",
      description: "Payment made via mobile money is not reflected on my fee balance.",
      priority: "HIGH", attachment: "payment-slip.jpg", status: "ESCALATED", createdAt: "2026-09-08T08:40:00", assignedTo: "Bursar / Finance Office",
      timeline: [
        { status: "PENDING", date: "2026-09-08T08:40:00", note: "Complaint submitted." },
        { status: "IN_PROGRESS", date: "2026-09-08T14:00:00", note: "Finance Officer verifying transaction reference." },
        { status: "ESCALATED", date: "2026-09-09T09:00:00", note: "Escalated to bank reconciliation team." }
      ]
    },
    {
      id: "CMP-0004", studentId: "STU-0015", category: "Administrative",
      description: "Registration number printed on my student ID card has a typo.",
      priority: "MEDIUM", attachment: null, status: "PENDING", createdAt: "2026-09-11T09:30:00", assignedTo: null,
      timeline: [{ status: "PENDING", date: "2026-09-11T09:30:00", note: "Complaint submitted." }]
    },
    {
      id: "CMP-0005", studentId: "STU-0021", category: "ICT / System Issue",
      description: "Unable to access the student portal from the campus Wi-Fi network.",
      priority: "URGENT", attachment: null, status: "IN_PROGRESS", createdAt: "2026-09-12T07:50:00", assignedTo: "IT Support / ICT Office",
      timeline: [
        { status: "PENDING", date: "2026-09-12T07:50:00", note: "Complaint submitted." },
        { status: "IN_PROGRESS", date: "2026-09-12T08:30:00", note: "ICT Support investigating network access." }
      ]
    }
  ];

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.data = global.USIAMS.data || {};
  global.USIAMS.data.complaintCategories = COMPLAINT_CATEGORIES;
  global.USIAMS.data.complaintPriorities = COMPLAINT_PRIORITIES;
  global.USIAMS.data.complaintStatuses = COMPLAINT_STATUSES;
  global.USIAMS.data.complaintRecipientOffices = COMPLAINT_RECIPIENT_OFFICES;
  global.USIAMS.data.seedComplaints = SEED_COMPLAINTS;

})(window);

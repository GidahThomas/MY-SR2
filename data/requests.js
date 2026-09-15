/* =========================================================
   USIAMS - data/requests.js
   Seed data for the Requests module. js/requests.js copies this
   into localStorage on first run (see USIAMS.storage.ensureSeed)
   so that new requests submitted during the demo persist across
   page loads without needing a backend.
   ========================================================= */
(function (global) {
  "use strict";

  const REQUEST_TYPES = ["Transcript", "Letter", "Course Change", "Deferment", "Clearance", "Academic Issue", "Other"];
  const REQUEST_STATUSES = ["PENDING", "IN_PROGRESS", "RESOLVED", "REJECTED", "ESCALATED", "CLOSED"];

  const SEED_REQUESTS = [
    {
      id: "REQ-0001", studentId: "STU-0001", type: "Transcript",
      description: "Requesting an official academic transcript for a scholarship application.",
      attachment: null, status: "RESOLVED", createdAt: "2026-08-20T09:15:00",
      timeline: [
        { status: "PENDING", date: "2026-08-20T09:15:00", note: "Request submitted by student." },
        { status: "IN_PROGRESS", date: "2026-08-21T10:00:00", note: "Assigned to Registration Officer." },
        { status: "RESOLVED", date: "2026-08-23T13:40:00", note: "Transcript prepared and issued." }
      ]
    },
    {
      id: "REQ-0002", studentId: "STU-0001", type: "Course Change",
      description: "Requesting to swap CP304 Distributed Systems for CP305 Cloud Computing.",
      attachment: null, status: "IN_PROGRESS", createdAt: "2026-09-05T11:00:00",
      timeline: [
        { status: "PENDING", date: "2026-09-05T11:00:00", note: "Request submitted by student." },
        { status: "IN_PROGRESS", date: "2026-09-06T08:30:00", note: "Under review by Academic Advisor." }
      ]
    },
    {
      id: "REQ-0003", studentId: "STU-0003", type: "Deferment",
      description: "Requesting deferment of studies for one semester due to medical reasons.",
      attachment: "medical-report.pdf", status: "PENDING", createdAt: "2026-09-10T15:20:00",
      timeline: [{ status: "PENDING", date: "2026-09-10T15:20:00", note: "Request submitted by student." }]
    },
    {
      id: "REQ-0004", studentId: "STU-0007", type: "Clearance",
      description: "Requesting departmental clearance ahead of graduation application.",
      attachment: null, status: "ESCALATED", createdAt: "2026-09-02T08:00:00",
      timeline: [
        { status: "PENDING", date: "2026-09-02T08:00:00", note: "Request submitted by student." },
        { status: "IN_PROGRESS", date: "2026-09-03T09:10:00", note: "Reviewed by Department Admin." },
        { status: "ESCALATED", date: "2026-09-04T12:00:00", note: "Escalated to Head of Department for approval." }
      ]
    },
    {
      id: "REQ-0005", studentId: "STU-0012", type: "Letter",
      description: "Requesting an introduction letter for an internship placement.",
      attachment: null, status: "RESOLVED", createdAt: "2026-08-28T10:00:00",
      timeline: [
        { status: "PENDING", date: "2026-08-28T10:00:00", note: "Request submitted by student." },
        { status: "RESOLVED", date: "2026-08-29T14:20:00", note: "Letter issued and emailed to the student." }
      ]
    },
    {
      id: "REQ-0006", studentId: "STU-0018", type: "Academic Issue",
      description: "Grade for CP203 Database Systems appears incorrect on the transcript.",
      attachment: "screenshot.png", status: "REJECTED", createdAt: "2026-08-15T09:45:00",
      timeline: [
        { status: "PENDING", date: "2026-08-15T09:45:00", note: "Request submitted by student." },
        { status: "IN_PROGRESS", date: "2026-08-16T09:00:00", note: "Marks re-verified by Examination Officer." },
        { status: "REJECTED", date: "2026-08-18T11:30:00", note: "Original grade confirmed as correct; no change made." }
      ]
    },
    {
      id: "REQ-0007", studentId: "STU-0025", type: "Other",
      description: "Requesting a change of registered contact phone number.",
      attachment: null, status: "CLOSED", createdAt: "2026-07-30T13:00:00",
      timeline: [
        { status: "PENDING", date: "2026-07-30T13:00:00", note: "Request submitted by student." },
        { status: "RESOLVED", date: "2026-07-31T09:00:00", note: "Contact details updated." },
        { status: "CLOSED", date: "2026-08-01T09:00:00", note: "Request closed after confirmation." }
      ]
    }
  ];

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.data = global.USIAMS.data || {};
  global.USIAMS.data.requestTypes = REQUEST_TYPES;
  global.USIAMS.data.requestStatuses = REQUEST_STATUSES;
  global.USIAMS.data.seedRequests = SEED_REQUESTS;

})(window);

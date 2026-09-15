/* =========================================================
   USIAMS - data/documents.js
   Seed document records (localStorage-backed via js/documents.js).
   Uploads in this prototype use browser file selection only -
   no file is actually transmitted anywhere.
   ========================================================= */
(function (global) {
  "use strict";

  const DOCUMENT_TYPES = ["ID", "Certificate", "Transcript", "Birth Certificate", "Internship Letter", "Other"];
  const DOCUMENT_STATUSES = ["Pending", "Verified", "Rejected"];

  const SEED_DOCUMENTS = [
    { id: "DOC-0001", studentId: "STU-0001", name: "National ID Card.pdf", type: "ID", uploadDate: "2026-08-01", status: "Verified" },
    { id: "DOC-0002", studentId: "STU-0001", name: "ACSEE Certificate.pdf", type: "Certificate", uploadDate: "2026-08-01", status: "Verified" },
    { id: "DOC-0003", studentId: "STU-0001", name: "Birth Certificate.pdf", type: "Birth Certificate", uploadDate: "2026-08-01", status: "Verified" },
    { id: "DOC-0004", studentId: "STU-0001", name: "Semester II Transcript.pdf", type: "Transcript", uploadDate: "2026-08-25", status: "Pending" },
    { id: "DOC-0005", studentId: "STU-0004", name: "National ID Card.pdf", type: "ID", uploadDate: "2026-08-02", status: "Verified" },
    { id: "DOC-0006", studentId: "STU-0004", name: "Internship Introduction Letter.pdf", type: "Internship Letter", uploadDate: "2026-09-01", status: "Pending" },
    { id: "DOC-0007", studentId: "STU-0009", name: "Birth Certificate.pdf", type: "Birth Certificate", uploadDate: "2026-08-03", status: "Rejected" },
    { id: "DOC-0008", studentId: "STU-0012", name: "ACSEE Certificate.pdf", type: "Certificate", uploadDate: "2026-08-05", status: "Verified" }
  ];

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.data = global.USIAMS.data || {};
  global.USIAMS.data.documentTypes = DOCUMENT_TYPES;
  global.USIAMS.data.documentStatuses = DOCUMENT_STATUSES;
  global.USIAMS.data.seedDocuments = SEED_DOCUMENTS;

})(window);

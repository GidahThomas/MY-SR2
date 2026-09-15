/* =========================================================
   USIAMS - data/audit-logs.js
   Seed audit trail entries. Audit logs are append-only in this
   prototype: no role (including QA and System Admin demo users)
   is given an Edit/Delete action on this page - see
   js/administration.js.
   ========================================================= */
(function (global) {
  "use strict";

  const AUDIT_ACTIONS = ["LOGIN", "LOGOUT", "CREATE", "UPDATE", "DELETE", "REGISTER", "RESULT_VIEW", "PAYMENT", "REQUEST_SUBMITTED"];

  const SEED_AUDIT_LOGS = [
    { id: "LOG-0001", user: "Baraka Komba", role: "STUDENT", action: "LOGIN", entity: "Session", entityId: "SESS-8841", date: "2026-09-13", time: "07:58", ip: "10.20.4.11", status: "Success" },
    { id: "LOG-0002", user: "Baraka Komba", role: "STUDENT", action: "REGISTER", entity: "Course Registration", entityId: "REG-0001", date: "2026-09-12", time: "16:22", ip: "10.20.4.11", status: "Success" },
    { id: "LOG-0003", user: "Baraka Komba", role: "STUDENT", action: "RESULT_VIEW", entity: "Results", entityId: "STU-0001", date: "2026-09-12", time: "16:40", ip: "10.20.4.11", status: "Success" },
    { id: "LOG-0004", user: "Baraka Komba", role: "STUDENT", action: "REQUEST_SUBMITTED", entity: "Request", entityId: "REQ-0002", date: "2026-09-05", time: "11:00", ip: "10.20.4.11", status: "Success" },
    { id: "LOG-0005", user: "Yohana Ndumbaro", role: "FINANCE_OFFICER", action: "PAYMENT", entity: "Invoice", entityId: "INV-0009", date: "2026-09-11", time: "09:12", ip: "10.20.3.4", status: "Success" },
    { id: "LOG-0006", user: "Victoria Mgaya", role: "REGISTRATION_OFFICER", action: "UPDATE", entity: "Student Record", entityId: "STU-0015", date: "2026-09-10", time: "13:47", ip: "10.20.3.9", status: "Success" },
    { id: "LOG-0007", user: "Prof. Deogratius Kimaro", role: "UNIVERSITY_ADMIN", action: "CREATE", entity: "Academic Year", entityId: "AY2025", date: "2026-07-01", time: "10:00", ip: "10.20.1.2", status: "Success" },
    { id: "LOG-0008", user: "Consolata Lyimo", role: "QUALITY_ASSURANCE_OFFICER", action: "LOGIN", entity: "Session", entityId: "SESS-7790", date: "2026-09-11", time: "15:30", ip: "10.20.5.1", status: "Success" },
    { id: "LOG-0009", user: "Consolata Lyimo", role: "QUALITY_ASSURANCE_OFFICER", action: "RESULT_VIEW", entity: "Results", entityId: "STU-0028", date: "2026-09-11", time: "15:45", ip: "10.20.5.1", status: "Success" },
    { id: "LOG-0010", user: "Unknown Attempt", role: "-", action: "LOGIN", entity: "Session", entityId: "SESS-0000", date: "2026-09-09", time: "22:14", ip: "41.222.10.7", status: "Failed" },
    { id: "LOG-0011", user: "Dr. Amani Mrema", role: "LECTURER", action: "UPDATE", entity: "Result", entityId: "RES-00231", date: "2026-09-06", time: "12:00", ip: "10.20.2.6", status: "Success" },
    { id: "LOG-0012", user: "Salome Mtui", role: "EXAMINATION_OFFICER", action: "CREATE", entity: "Result Batch", entityId: "BATCH-014", date: "2026-09-05", time: "14:35", ip: "10.20.3.2", status: "Success" },
    { id: "LOG-0013", user: "Upendo Mallya", role: "SYSTEM_ADMIN", action: "UPDATE", entity: "System Settings", entityId: "SET-002", date: "2026-09-04", time: "09:00", ip: "10.20.1.1", status: "Success" },
    { id: "LOG-0014", user: "Baraka Komba", role: "STUDENT", action: "LOGOUT", entity: "Session", entityId: "SESS-8790", date: "2026-09-04", time: "18:02", ip: "10.20.4.11", status: "Success" },
    { id: "LOG-0015", user: "Rehema Ndosi", role: "DEPARTMENT_ADMIN", action: "DELETE", entity: "Draft Course", entityId: "CS-DRAFT-002", date: "2026-09-02", time: "11:15", ip: "10.20.2.9", status: "Success" }
  ];

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.data = global.USIAMS.data || {};
  global.USIAMS.data.auditActions = AUDIT_ACTIONS;
  global.USIAMS.data.seedAuditLogs = SEED_AUDIT_LOGS;

})(window);

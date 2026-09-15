/* =========================================================
   USIAMS - data/admissions.js
   Prospective applicant admissions pipeline, seed data. These
   applicants are NOT USIAMS users - they exist only in this
   dataset until a Registration Officer accepts them (accepting
   an applicant here does not yet create a student/user record;
   that handoff is a future backend integration, same caveat as
   every other simulated workflow in this prototype).
   ========================================================= */
(function (global) {
  "use strict";

  const APPLICATION_STATUSES = ["Submitted", "Under Review", "Accepted", "Rejected"];

  const SEED_APPLICATIONS = [
    { id: "APP-0001", fullName: "Vicent Mbwana", email: "vicent.mbwana@gmail.com", phone: "+255754112233", gender: "Male", programmeId: "BSCS", previousSchool: "Mzumbe Secondary School", entryQualification: "ACSEE", applicationDate: "2026-08-01", status: "Accepted", notes: "Meets entry requirements; strong ACSEE results." },
    { id: "APP-0002", fullName: "Grace Ndumbaro", email: "grace.ndumbaro@gmail.com", phone: "+255765223344", gender: "Female", programmeId: "BCOMACC", previousSchool: "Iringa Girls Secondary School", entryQualification: "ACSEE", applicationDate: "2026-08-03", status: "Under Review", notes: "" },
    { id: "APP-0003", fullName: "Paschal Mgaya", email: "paschal.mgaya@gmail.com", phone: "+255712334455", gender: "Male", programmeId: "BENGEE", previousSchool: "Ilboru Secondary School", entryQualification: "ACSEE", applicationDate: "2026-08-05", status: "Submitted", notes: "" },
    { id: "APP-0004", fullName: "Winfrida Sanga", email: "winfrida.sanga@gmail.com", phone: "+255789445566", gender: "Female", programmeId: "LLB", previousSchool: "Songea Boys Secondary School", entryQualification: "ACSEE", applicationDate: "2026-08-07", status: "Rejected", notes: "Did not meet minimum subject requirements for Law." },
    { id: "APP-0005", fullName: "Method Kayombo", email: "method.kayombo@gmail.com", phone: "+255621556677", gender: "Male", programmeId: "DIPCS", previousSchool: "Kibaha Secondary School", entryQualification: "CSEE", applicationDate: "2026-08-10", status: "Submitted", notes: "" }
  ];

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.data = global.USIAMS.data || {};
  global.USIAMS.data.admissionStatuses = APPLICATION_STATUSES;
  global.USIAMS.data.seedApplications = SEED_APPLICATIONS;

})(window);

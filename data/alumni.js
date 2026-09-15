/* =========================================================
   USIAMS - data/alumni.js
   Alumni register: graduates from prior cohorts, independent of
   the currently enrolled student roster in data/students.js.
   ========================================================= */
(function (global) {
  "use strict";

  const EMPLOYMENT_STATUSES = ["Employed", "Self-Employed", "Further Studies", "Seeking Employment"];

  const ALUMNI = [
    { id: "ALM-0001", name: "Erick Mbwana", regNumber: "BSCS/2020/0014", programmeId: "BSCS", graduationYear: 2023, employmentStatus: "Employed", organization: "CRDB Bank Plc", contact: "erick.mbwana@alumni.usiams.ac.tz" },
    { id: "ALM-0002", name: "Grace Kessy", regNumber: "BCOM-ACC/2019/0032", programmeId: "BCOMACC", graduationYear: 2022, employmentStatus: "Employed", organization: "PwC Tanzania", contact: "grace.kessy@alumni.usiams.ac.tz" },
    { id: "ALM-0003", name: "Method Mollel", regNumber: "BENG-EE/2018/0009", programmeId: "BENGEE", graduationYear: 2022, employmentStatus: "Self-Employed", organization: "Mollel Power Solutions Ltd", contact: "method.mollel@alumni.usiams.ac.tz" },
    { id: "ALM-0004", name: "Devotha Kayombo", regNumber: "BSC-IS/2020/0021", programmeId: "BSCIS", graduationYear: 2023, employmentStatus: "Employed", organization: "Vodacom Tanzania", contact: "devotha.kayombo@alumni.usiams.ac.tz" },
    { id: "ALM-0005", name: "Raymond Chacha", regNumber: "LLB/2017/0005", programmeId: "LLB", graduationYear: 2021, employmentStatus: "Employed", organization: "Judiciary of Tanzania", contact: "raymond.chacha@alumni.usiams.ac.tz" },
    { id: "ALM-0006", name: "Veronica Ndosi", regNumber: "BA-DS/2019/0018", programmeId: "BADS", graduationYear: 2022, employmentStatus: "Further Studies", organization: "University of Dodoma (MA)", contact: "veronica.ndosi@alumni.usiams.ac.tz" },
    { id: "ALM-0007", name: "Silas Mgaya", regNumber: "BSSE/2020/0027", programmeId: "BSSE", graduationYear: 2023, employmentStatus: "Employed", organization: "NALA Payments", contact: "silas.mgaya@alumni.usiams.ac.tz" },
    { id: "ALM-0008", name: "Winfrida Sanga", regNumber: "BED/2018/0011", programmeId: "BED", graduationYear: 2021, employmentStatus: "Employed", organization: "Ministry of Education", contact: "winfrida.sanga@alumni.usiams.ac.tz" },
    { id: "ALM-0009", name: "Kelvin Ndumbaro", regNumber: "BSC-MATH/2019/0006", programmeId: "BSCMATH", graduationYear: 2022, employmentStatus: "Seeking Employment", organization: "-", contact: "kelvin.ndumbaro@alumni.usiams.ac.tz" },
    { id: "ALM-0010", name: "Pendo Mtui", regNumber: "BBA-MKT/2020/0033", programmeId: "BBAMKT", graduationYear: 2023, employmentStatus: "Employed", organization: "Azam Media Group", contact: "pendo.mtui@alumni.usiams.ac.tz" },
    { id: "ALM-0011", name: "Athumani Swai", regNumber: "BSC-BIO/2018/0004", programmeId: "BSCBIO", graduationYear: 2021, employmentStatus: "Employed", organization: "Muhimbili National Hospital", contact: "athumani.swai@alumni.usiams.ac.tz" },
    { id: "ALM-0012", name: "Beatrice Mallya", regNumber: "BSCDS/2020/0041", programmeId: "BSCDS", graduationYear: 2023, employmentStatus: "Employed", organization: "TIBU Health", contact: "beatrice.mallya@alumni.usiams.ac.tz" }
  ];

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.data = global.USIAMS.data || {};
  global.USIAMS.data.employmentStatuses = EMPLOYMENT_STATUSES;
  global.USIAMS.data.alumni = ALUMNI;

})(window);

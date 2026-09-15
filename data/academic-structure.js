/* =========================================================
   USIAMS - data/academic-structure.js
   Hierarchical academic structure:
   University -> College/Institute/School -> Department ->
   Programme -> Curriculum -> Course

   These are plain JavaScript arrays so that additional colleges,
   institutes, schools, departments or programmes can be appended
   at any time without touching the rendering code. Nothing in
   the UI hard-codes "4 colleges" or "2 institutes" - counts are
   always derived from these arrays.
   ========================================================= */
(function (global) {
  "use strict";

  // Organisational units: colleges, institutes and schools all share
  // the same shape and sit directly under the university.
  const ORG_UNITS = [
    { id: "COET", name: "College of Engineering and Technology", type: "College", established: 1974 },
    { id: "CONAS", name: "College of Natural and Applied Sciences", type: "College", established: 1980 },
    { id: "COBE", name: "College of Business Education", type: "College", established: 1965 },
    { id: "COHSS", name: "College of Humanities and Social Sciences", type: "College", established: 1961 },
    { id: "ICCT", name: "Institute of Computing and Communication Technologies", type: "Institute", established: 2005 },
    { id: "IDS", name: "Institute of Development Studies", type: "Institute", established: 1988 },
    { id: "SOL", name: "School of Law", type: "School", established: 1996 },
    { id: "SOE", name: "School of Education", type: "School", established: 1970 }
  ];

  // "code" is the 2-digit faculty/department code embedded in every
  // student registration number (see data/students.js buildRegNumber).
  const DEPARTMENTS = [
    { id: "DCSE", code: "01", name: "Department of Computer Science and Engineering", unitId: "COET", hod: "Dr. Amani Mrema" },
    { id: "DEE", code: "02", name: "Department of Electrical Engineering", unitId: "COET", hod: "Dr. Baraka Kileo" },
    { id: "DMS", code: "03", name: "Department of Mathematics and Statistics", unitId: "CONAS", hod: "Dr. Editha Ngowi" },
    { id: "DBIO", code: "04", name: "Department of Biological Sciences", unitId: "CONAS", hod: "Dr. Furaha Mwakalinga" },
    { id: "DACC", code: "05", name: "Department of Accounting and Finance", unitId: "COBE", hod: "Dr. Godbless Temba" },
    { id: "DMKT", code: "06", name: "Department of Marketing and Management", unitId: "COBE", hod: "Dr. Happiness Komba" },
    { id: "DIS", code: "07", name: "Department of Information Systems", unitId: "ICCT", hod: "Dr. Imani Massawe" },
    { id: "DDS", code: "08", name: "Department of Development Studies", unitId: "IDS", hod: "Dr. Juma Shayo" },
    { id: "DLAW", code: "09", name: "Department of Law", unitId: "SOL", hod: "Dr. Neema Kimaro" },
    { id: "DEDU", code: "10", name: "Department of Education Foundations", unitId: "SOE", hod: "Dr. Consolata Lyimo" }
  ];

  const PROGRAMMES = [
    { id: "BSCS", name: "BSc. Computer Science", code: "BSCS", departmentId: "DCSE", level: "Undergraduate", durationYears: 3, creditLimitPerSemester: 18, creditMinPerSemester: 9 },
    { id: "BSSE", name: "BSc. Software Engineering", code: "BSSE", departmentId: "DCSE", level: "Undergraduate", durationYears: 3, creditLimitPerSemester: 18, creditMinPerSemester: 9 },
    { id: "BSCDS", name: "BSc. Data Science", code: "BSCDS", departmentId: "DCSE", level: "Undergraduate", durationYears: 3, creditLimitPerSemester: 18, creditMinPerSemester: 9 },
    { id: "BENGEE", name: "BEng. Electrical Engineering", code: "BENG-EE", departmentId: "DEE", level: "Undergraduate", durationYears: 4, creditLimitPerSemester: 18, creditMinPerSemester: 7 },
    { id: "BSCMATH", name: "BSc. Mathematics", code: "BSC-MATH", departmentId: "DMS", level: "Undergraduate", durationYears: 3, creditLimitPerSemester: 18, creditMinPerSemester: 6 },
    { id: "BSCBIO", name: "BSc. Biological Sciences", code: "BSC-BIO", departmentId: "DBIO", level: "Undergraduate", durationYears: 3, creditLimitPerSemester: 18, creditMinPerSemester: 6 },
    { id: "BCOMACC", name: "BCom. Accounting", code: "BCOM-ACC", departmentId: "DACC", level: "Undergraduate", durationYears: 3, creditLimitPerSemester: 18, creditMinPerSemester: 6 },
    { id: "BBAMKT", name: "BBA Marketing", code: "BBA-MKT", departmentId: "DMKT", level: "Undergraduate", durationYears: 3, creditLimitPerSemester: 18, creditMinPerSemester: 6 },
    { id: "BSCIS", name: "BSc. Information Systems", code: "BSC-IS", departmentId: "DIS", level: "Undergraduate", durationYears: 3, creditLimitPerSemester: 18, creditMinPerSemester: 9 },
    { id: "BADS", name: "BA Development Studies", code: "BA-DS", departmentId: "DDS", level: "Undergraduate", durationYears: 3, creditLimitPerSemester: 18, creditMinPerSemester: 6 },
    { id: "LLB", name: "Bachelor of Laws", code: "LLB", departmentId: "DLAW", level: "Undergraduate", durationYears: 4, creditLimitPerSemester: 18, creditMinPerSemester: 6 },
    { id: "BED", name: "Bachelor of Education", code: "BED", departmentId: "DEDU", level: "Undergraduate", durationYears: 3, creditLimitPerSemester: 18, creditMinPerSemester: 6 },

    // Diploma and PhD programmes - included so student registration numbers
    // can be demonstrated across all three academic levels (see
    // data/students.js buildRegNumber, which prefixes by programme.level).
    { id: "DIPCS", name: "Diploma in Computer Science", code: "DIP-CS", departmentId: "DCSE", level: "Diploma", durationYears: 2, creditLimitPerSemester: 16, creditMinPerSemester: 8 },
    { id: "DIPEE", name: "Diploma in Electrical Engineering", code: "DIP-EE", departmentId: "DEE", level: "Diploma", durationYears: 2, creditLimitPerSemester: 16, creditMinPerSemester: 8 },
    { id: "DIPACC", name: "Diploma in Accountancy", code: "DIP-ACC", departmentId: "DACC", level: "Diploma", durationYears: 2, creditLimitPerSemester: 16, creditMinPerSemester: 8 },
    { id: "PHDCS", name: "PhD in Computer Science", code: "PHD-CS", departmentId: "DCSE", level: "PhD", durationYears: 3, creditLimitPerSemester: 12, creditMinPerSemester: 6 },
    { id: "PHDDS", name: "PhD in Development Studies", code: "PHD-DS", departmentId: "DDS", level: "PhD", durationYears: 3, creditLimitPerSemester: 12, creditMinPerSemester: 6 }
  ];

  const ACADEMIC_YEARS = [
    { id: "AY2023", label: "2023/2024", status: "Closed" },
    { id: "AY2024", label: "2024/2025", status: "Closed" },
    { id: "AY2025", label: "2025/2026", status: "Active" }
  ];

  const SEMESTERS = [
    { id: "AY2023-S1", academicYearId: "AY2023", label: "Semester I", status: "Closed" },
    { id: "AY2023-S2", academicYearId: "AY2023", label: "Semester II", status: "Closed" },
    { id: "AY2024-S1", academicYearId: "AY2024", label: "Semester I", status: "Closed" },
    { id: "AY2024-S2", academicYearId: "AY2024", label: "Semester II", status: "Closed" },
    { id: "AY2025-S1", academicYearId: "AY2025", label: "Semester I", status: "Active", registrationOpen: true, registrationDeadline: "2025-10-15" },
    { id: "AY2025-S2", academicYearId: "AY2025", label: "Semester II", status: "Upcoming", registrationOpen: false }
  ];

  function getOrgUnit(id) { return ORG_UNITS.find(u => u.id === id); }
  function getDepartment(id) { return DEPARTMENTS.find(d => d.id === id); }
  function getProgramme(id) { return PROGRAMMES.find(p => p.id === id); }
  function departmentsForUnit(unitId) { return DEPARTMENTS.filter(d => d.unitId === unitId); }
  function programmesForDepartment(deptId) { return PROGRAMMES.filter(p => p.departmentId === deptId); }
  function collegeNameForDepartment(deptId) {
    const dept = getDepartment(deptId);
    const unit = dept ? getOrgUnit(dept.unitId) : null;
    return unit ? unit.name : "-";
  }
  function programmeFullPath(programmeId) {
    const prog = getProgramme(programmeId);
    if (!prog) return "-";
    const dept = getDepartment(prog.departmentId);
    const unit = dept ? getOrgUnit(dept.unitId) : null;
    return [unit && unit.name, dept && dept.name, prog.name].filter(Boolean).join(" › ");
  }
  function activeSemester() { return SEMESTERS.find(s => s.status === "Active"); }
  function activeAcademicYear() { return ACADEMIC_YEARS.find(y => y.status === "Active"); }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.data = global.USIAMS.data || {};
  Object.assign(global.USIAMS.data, {
    orgUnits: ORG_UNITS,
    departments: DEPARTMENTS,
    programmes: PROGRAMMES,
    academicYears: ACADEMIC_YEARS,
    semesters: SEMESTERS
  });
  global.USIAMS.academic = {
    getOrgUnit, getDepartment, getProgramme, departmentsForUnit, programmesForDepartment,
    collegeNameForDepartment, programmeFullPath, activeSemester, activeAcademicYear
  };

})(window);

/* =========================================================
   USIAMS - data/academic-structure.js
   Hierarchical academic structure:
   University -> College/Institute/School -> Department ->
   Programme -> Curriculum -> Course

   These are plain JavaScript arrays so that additional colleges,
   institutes, schools, departments or programmes can be appended
   at any time without touching the rendering code. Nothing in
   the UI hard-codes "6 colleges" or "2 institutes" - counts are
   always derived from these arrays.

   The organisational structure below (colleges, schools, institutes
   and their departments) mirrors the real, publicly-published
   structure of the University of Dodoma (udom.ac.tz) as of 2026 -
   6 colleges, 3 schools and 2 institutes. Everything else (users,
   students, courses, fees, results, etc.) remains fictional demo
   data for this prototype; only the organisational shell and
   department/programme naming is modelled on the real institution.
   Internal ids were kept stable where a department already existed
   under the old placeholder names, so no other seed file had to be
   rewritten - only names, unit assignments and a few new ids changed.
   ========================================================= */
(function (global) {
  "use strict";

  // Organisational units: colleges, institutes and schools all share
  // the same shape and sit directly under the university.
  const ORG_UNITS = [
    { id: "CIVE", name: "College of Informatics and Virtual Education (CIVE)", type: "College", established: 2007 },
    { id: "CNMS", name: "College of Natural and Mathematical Sciences (CNMS)", type: "College", established: 2007 },
    { id: "COBE", name: "College of Business and Economics (CoBE)", type: "College", established: 2017 },
    { id: "COHSS", name: "College of Humanities and Social Sciences (CHSS)", type: "College", established: 2008 },
    { id: "COESE", name: "College of Earth Sciences and Engineering (CoESE)", type: "College", established: 2011 },
    { id: "COED", name: "College of Education (CoED)", type: "College", established: 2008 },
    { id: "SOL", name: "School of Law (SoL)", type: "School", established: 2017 },
    { id: "SOMD", name: "School of Medicine and Dentistry (SoMD)", type: "School", established: 2007 },
    { id: "SONPH", name: "School of Nursing and Public Health (SoNPH)", type: "School", established: 2007 },
    { id: "IDS", name: "Institute of Development Studies (IDS)", type: "Institute", established: 2019 },
    { id: "CI", name: "Confucius Institute", type: "Institute", established: 2013 }
  ];

  // "code" is the 2-digit faculty/department code embedded in every
  // student registration number (see data/students.js buildRegNumber).
  const DEPARTMENTS = [
    { id: "DCSE", code: "01", name: "Department of Computer Science and Engineering", unitId: "CIVE", hod: "Dr. Amani Mrema" },
    { id: "DEE", code: "02", name: "Department of Electronics and Telecommunications Engineering", unitId: "CIVE", hod: "Dr. Baraka Kileo" },
    { id: "DMS", code: "03", name: "Department of Mathematics and Statistics", unitId: "CNMS", hod: "Dr. Editha Ngowi" },
    { id: "DBIO", code: "04", name: "Department of Biology", unitId: "CNMS", hod: "Dr. Furaha Mwakalinga" },
    { id: "DACC", code: "05", name: "Department of Accounting and Finance", unitId: "COBE", hod: "Dr. Godbless Temba" },
    { id: "DMKT", code: "06", name: "Department of Business Administration and Management", unitId: "COBE", hod: "Dr. Happiness Komba" },
    { id: "DIS", code: "07", name: "Department of Information Systems and Technology", unitId: "CIVE", hod: "Dr. Imani Massawe" },
    { id: "DDS", code: "08", name: "Department of Development Studies", unitId: "IDS", hod: "Dr. Juma Shayo" },
    { id: "DLAW", code: "09", name: "Department of Public Law", unitId: "SOL", hod: "Dr. Neema Kimaro" },
    { id: "DEDU", code: "10", name: "Department of Educational Foundation and Continuing Education", unitId: "COED", hod: "Dr. Consolata Lyimo" },

    { id: "DCHEM", code: "11", name: "Department of Chemistry", unitId: "CNMS", hod: "Dr. Zawadi Ndosi" },
    { id: "DPHY", code: "12", name: "Department of Physics", unitId: "CNMS", hod: "Dr. Method Komba" },
    { id: "DECO", code: "13", name: "Department of Economics", unitId: "COBE", hod: "Dr. Grace Mtui" },
    { id: "DGES", code: "14", name: "Department of Geography and Environmental Studies", unitId: "COHSS", hod: "Dr. Erasto Mgaya" },
    { id: "DPSPA", code: "15", name: "Department of Political Science and Public Administration", unitId: "COHSS", hod: "Dr. Salome Kessy" },
    { id: "DSOC", code: "16", name: "Department of Sociology and Anthropology", unitId: "COHSS", hod: "Dr. Yohana Sanga" },
    { id: "DAMS", code: "17", name: "Department of Arts and Media Studies", unitId: "COHSS", hod: "Dr. Victoria Chacha" },
    { id: "DKIS", code: "18", name: "Idara ya Kiswahili (Kiswahili Department)", unitId: "COHSS", hod: "Dr. Athumani Swai" },
    { id: "DEMPS", code: "19", name: "Department of Educational Management and Policy Studies", unitId: "COED", hod: "Dr. Restituta Rutta" },
    { id: "DEPSY", code: "20", name: "Department of Educational Psychology", unitId: "COED", hod: "Dr. Longin Mnyika" },
    { id: "DCES", code: "21", name: "Department of Curriculum and Educational Studies", unitId: "COED", hod: "Dr. Modesta Ndumbaro" },
    { id: "DMMPE", code: "22", name: "Department of Mining and Mineral Processing Engineering", unitId: "COESE", hod: "Dr. Castus Mbise" },
    { id: "DPEE", code: "23", name: "Department of Petroleum and Energy Engineering", unitId: "COESE", hod: "Dr. Beatrice Mollel" },
    { id: "DGEO", code: "24", name: "Department of Geology", unitId: "COESE", hod: "Dr. Raymond Kessy" },
    { id: "DEEM", code: "25", name: "Department of Environmental Engineering and Management", unitId: "COESE", hod: "Dr. Devotha Kayombo" },
    { id: "DMED", code: "26", name: "Department of Internal Medicine", unitId: "SOMD", hod: "Dr. Silas Mgaya" },
    { id: "DCNM", code: "27", name: "Department of Clinical Nursing and Midwifery", unitId: "SONPH", hod: "Dr. Winfrida Sanga" },
    { id: "DPHCN", code: "28", name: "Department of Public Health Community Nursing", unitId: "SONPH", hod: "Dr. Pendo Mtui" },

    { id: "DPRIVLAW", code: "29", name: "Department of Private Law", unitId: "SOL", hod: "Dr. Faraja Ndumbaro" },
    { id: "DBMS", code: "30", name: "Department of Biomedical Sciences", unitId: "SOMD", hod: "Dr. Kelvin Massawe" },
    { id: "DOG", code: "31", name: "Department of Obstetrics and Gynecology", unitId: "SOMD", hod: "Dr. Lightness Chacha" }
  ];

  const PROGRAMMES = [
    { id: "BSCS", name: "Bachelor of Science in Computer Science", code: "BSCS", departmentId: "DCSE", level: "Undergraduate", durationYears: 3, creditLimitPerSemester: 18, creditMinPerSemester: 9 },
    { id: "BSSE", name: "Bachelor of Science in Software Engineering", code: "BSSE", departmentId: "DCSE", level: "Undergraduate", durationYears: 3, creditLimitPerSemester: 18, creditMinPerSemester: 9 },
    { id: "BSCDS", name: "Bachelor of Science in Computer Engineering", code: "BSC-CE", departmentId: "DCSE", level: "Undergraduate", durationYears: 4, creditLimitPerSemester: 18, creditMinPerSemester: 9 },
    { id: "BENGEE", name: "Bachelor of Engineering in Electronics and Telecommunications Engineering", code: "BENG-ETE", departmentId: "DEE", level: "Undergraduate", durationYears: 4, creditLimitPerSemester: 18, creditMinPerSemester: 7 },
    { id: "BSCMATH", name: "Bachelor of Science in Mathematics", code: "BSC-MATH", departmentId: "DMS", level: "Undergraduate", durationYears: 3, creditLimitPerSemester: 18, creditMinPerSemester: 6 },
    { id: "BSCBIO", name: "Bachelor of Science in Biology", code: "BSC-BIO", departmentId: "DBIO", level: "Undergraduate", durationYears: 3, creditLimitPerSemester: 18, creditMinPerSemester: 6 },
    { id: "BCOMACC", name: "Bachelor of Commerce in Accounting", code: "BCOM-ACC", departmentId: "DACC", level: "Undergraduate", durationYears: 3, creditLimitPerSemester: 18, creditMinPerSemester: 6 },
    { id: "BBAMKT", name: "Bachelor of Commerce in Marketing", code: "BCOM-MKT", departmentId: "DMKT", level: "Undergraduate", durationYears: 3, creditLimitPerSemester: 18, creditMinPerSemester: 6 },
    { id: "BSCIS", name: "Bachelor of Science in Information Systems and Technology", code: "BSC-IST", departmentId: "DIS", level: "Undergraduate", durationYears: 3, creditLimitPerSemester: 18, creditMinPerSemester: 9 },
    { id: "BADS", name: "Bachelor of Arts in Development Studies", code: "BA-DS", departmentId: "DDS", level: "Undergraduate", durationYears: 3, creditLimitPerSemester: 18, creditMinPerSemester: 6 },
    { id: "LLB", name: "Bachelor of Laws", code: "LLB", departmentId: "DLAW", level: "Undergraduate", durationYears: 4, creditLimitPerSemester: 18, creditMinPerSemester: 6 },
    { id: "BED", name: "Bachelor of Education (Arts)", code: "BED", departmentId: "DEDU", level: "Undergraduate", durationYears: 3, creditLimitPerSemester: 18, creditMinPerSemester: 6 },

    // Diploma and PhD programmes - included so student registration numbers
    // can be demonstrated across all three academic levels (see
    // data/students.js buildRegNumber, which prefixes by programme.level).
    { id: "DIPCS", name: "Diploma in Computer Science", code: "DIP-CS", departmentId: "DCSE", level: "Diploma", durationYears: 2, creditLimitPerSemester: 16, creditMinPerSemester: 8 },
    { id: "DIPEE", name: "Diploma in Electronics and Telecommunications Engineering", code: "DIP-ETE", departmentId: "DEE", level: "Diploma", durationYears: 2, creditLimitPerSemester: 16, creditMinPerSemester: 8 },
    { id: "DIPACC", name: "Diploma in Accountancy", code: "DIP-ACC", departmentId: "DACC", level: "Diploma", durationYears: 2, creditLimitPerSemester: 16, creditMinPerSemester: 8 },
    { id: "PHDCS", name: "PhD in Computer Science", code: "PHD-CS", departmentId: "DCSE", level: "PhD", durationYears: 3, creditLimitPerSemester: 12, creditMinPerSemester: 6 },
    { id: "PHDDS", name: "PhD in Development Studies", code: "PHD-DS", departmentId: "DDS", level: "PhD", durationYears: 3, creditLimitPerSemester: 12, creditMinPerSemester: 6 },

    // Real UDOM colleges/schools added for this pass - one flagship
    // undergraduate programme per new department, matching real
    // programme names/naming conventions found on udom.ac.tz.
    { id: "BSCCHEM", name: "Bachelor of Science in Chemistry", code: "BSC-CHEM", departmentId: "DCHEM", level: "Undergraduate", durationYears: 3, creditLimitPerSemester: 18, creditMinPerSemester: 6 },
    { id: "BSCPHY", name: "Bachelor of Science in Physics", code: "BSC-PHY", departmentId: "DPHY", level: "Undergraduate", durationYears: 3, creditLimitPerSemester: 18, creditMinPerSemester: 6 },
    { id: "BAECO", name: "Bachelor of Arts in Economics", code: "BA-ECO", departmentId: "DECO", level: "Undergraduate", durationYears: 3, creditLimitPerSemester: 18, creditMinPerSemester: 6 },
    { id: "BAGES", name: "Bachelor of Arts in Geography and Environmental Studies", code: "BA-GES", departmentId: "DGES", level: "Undergraduate", durationYears: 3, creditLimitPerSemester: 18, creditMinPerSemester: 6 },
    { id: "BAPSPA", name: "Bachelor of Arts in Political Science and Public Administration", code: "BA-PSPA", departmentId: "DPSPA", level: "Undergraduate", durationYears: 3, creditLimitPerSemester: 18, creditMinPerSemester: 6 },
    { id: "BASOC", name: "Bachelor of Arts in Sociology and Anthropology", code: "BA-SOC", departmentId: "DSOC", level: "Undergraduate", durationYears: 3, creditLimitPerSemester: 18, creditMinPerSemester: 6 },
    { id: "BAAMS", name: "Bachelor of Arts with Media Studies", code: "BA-AMS", departmentId: "DAMS", level: "Undergraduate", durationYears: 3, creditLimitPerSemester: 18, creditMinPerSemester: 6 },
    { id: "BAKIS", name: "Bachelor of Arts in Kiswahili", code: "BA-KIS", departmentId: "DKIS", level: "Undergraduate", durationYears: 3, creditLimitPerSemester: 18, creditMinPerSemester: 6 },
    { id: "BEDEMPS", name: "Bachelor of Education (Educational Management and Policy Studies)", code: "BED-EMPS", departmentId: "DEMPS", level: "Undergraduate", durationYears: 3, creditLimitPerSemester: 18, creditMinPerSemester: 6 },
    { id: "BEDPSY", name: "Bachelor of Education (Educational Psychology)", code: "BED-PSY", departmentId: "DEPSY", level: "Undergraduate", durationYears: 3, creditLimitPerSemester: 18, creditMinPerSemester: 6 },
    { id: "BEDCES", name: "Bachelor of Education (Curriculum and Educational Studies)", code: "BED-CES", departmentId: "DCES", level: "Undergraduate", durationYears: 3, creditLimitPerSemester: 18, creditMinPerSemester: 6 },
    { id: "BENGMIN", name: "Bachelor of Engineering in Mining and Mineral Processing Engineering", code: "BENG-MIN", departmentId: "DMMPE", level: "Undergraduate", durationYears: 4, creditLimitPerSemester: 18, creditMinPerSemester: 7 },
    { id: "BSCPET", name: "Bachelor of Science in Petroleum and Energy Engineering", code: "BSC-PET", departmentId: "DPEE", level: "Undergraduate", durationYears: 4, creditLimitPerSemester: 18, creditMinPerSemester: 7 },
    { id: "BSCGEO", name: "Bachelor of Science in Applied Geology", code: "BSC-GEO", departmentId: "DGEO", level: "Undergraduate", durationYears: 3, creditLimitPerSemester: 18, creditMinPerSemester: 6 },
    { id: "BSCENV", name: "Bachelor of Science in Environmental Engineering and Management", code: "BSC-ENV", departmentId: "DEEM", level: "Undergraduate", durationYears: 4, creditLimitPerSemester: 18, creditMinPerSemester: 7 },
    { id: "MD", name: "Doctor of Medicine (MD)", code: "MD", departmentId: "DMED", level: "Undergraduate", durationYears: 5, creditLimitPerSemester: 24, creditMinPerSemester: 12 },
    { id: "BSCNUR", name: "Bachelor of Science in Nursing", code: "BSC-NUR", departmentId: "DCNM", level: "Undergraduate", durationYears: 4, creditLimitPerSemester: 18, creditMinPerSemester: 8 },
    { id: "BSCPH", name: "Bachelor of Science in Public Health", code: "BSC-PH", departmentId: "DPHCN", level: "Undergraduate", durationYears: 4, creditLimitPerSemester: 18, creditMinPerSemester: 8 },

    // Added after a follow-up completeness check against udom.ac.tz:
    // School of Law is actually split into Public/Private Law, and
    // School of Medicine and Dentistry has real named departments
    // rather than one generic "Department of Medicine".
    { id: "BSCHIS", name: "Bachelor of Science in Health Information Science", code: "BSC-HIS", departmentId: "DPHCN", level: "Undergraduate", durationYears: 4, creditLimitPerSemester: 18, creditMinPerSemester: 8 },
    { id: "BSCCND", name: "Bachelor of Science in Clinical Nutrition and Dietetics", code: "BSC-CND", departmentId: "DPHCN", level: "Undergraduate", durationYears: 4, creditLimitPerSemester: 18, creditMinPerSemester: 8 }
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

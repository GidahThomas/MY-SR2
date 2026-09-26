/* =========================================================
   USIAMS - data/courses.js
   Course catalogue and curriculum mapping. Each course lists the
   programme(s) whose curriculum it belongs to, the year and
   semester it is normally taken in, its credit weight and any
   prerequisite course codes. This single array drives:
     - pages/courses.html   (course catalogue management)
     - pages/registration.html (available courses + validation)
     - pages/results.html   (course titles/credits on transcripts)
     - pages/timetable.html (course/lecturer/room scheduling)
   ========================================================= */
(function (global) {
  "use strict";

  // Course code prefixes are assigned by subject category, not just
  // department: "CP" = programming/coding courses, "TN" = mathematics-related
  // courses (regardless of which department teaches them), "AI" = the
  // security course. Everything else keeps its own subject prefix
  // (EE, AC, BI, LW, ED, DS/GS, IS, PHD).
  const COURSES = [
    { id: "CP101", title: "Introduction to Programming", credits: 3, type: "Core", departmentId: "DCSE", programmeIds: ["BSCS", "BSSE", "BSCDS"], year: 1, semesterNumber: 1, prerequisites: [], status: "Active" },
    { id: "TN103", title: "Discrete Mathematics", credits: 3, type: "Core", departmentId: "DCSE", programmeIds: ["BSCS", "BSSE", "BSCDS"], year: 1, semesterNumber: 1, prerequisites: [], status: "Active" },
    { id: "CP103", title: "Computer Organization and Architecture", credits: 3, type: "Core", departmentId: "DCSE", programmeIds: ["BSCS", "BSSE"], year: 1, semesterNumber: 1, prerequisites: [], status: "Active" },
    { id: "GS101", title: "Communication Skills", credits: 2, type: "Core", departmentId: "DCSE", programmeIds: ["BSCS", "BSSE", "BSCDS", "BENGEE", "BSCMATH", "BSCBIO", "BCOMACC", "BBAMKT", "BSCIS", "BADS", "LLB", "BED"], year: 1, semesterNumber: 1, prerequisites: [], status: "Active" },
    { id: "CP201", title: "Data Structures and Algorithms", credits: 4, type: "Core", departmentId: "DCSE", programmeIds: ["BSCS", "BSSE", "BSCDS"], year: 2, semesterNumber: 1, prerequisites: ["CP101"], status: "Active" },
    { id: "CP301", title: "Operating Systems", credits: 4, type: "Core", departmentId: "DCSE", programmeIds: ["BSCS", "BSSE"], year: 3, semesterNumber: 1, prerequisites: ["CP201"], status: "Active" },
    { id: "CP302", title: "Computer Networks", credits: 3, type: "Core", departmentId: "DCSE", programmeIds: ["BSCS", "BSSE", "BSCIS"], year: 3, semesterNumber: 1, prerequisites: ["CP201"], status: "Active" },
    { id: "CP401", title: "Artificial Intelligence", credits: 3, type: "Elective", departmentId: "DCSE", programmeIds: ["BSCS", "BSCDS"], year: 3, semesterNumber: 1, prerequisites: ["CP201"], status: "Active" },
    { id: "CP304", title: "Distributed Systems", credits: 3, type: "Elective", departmentId: "DCSE", programmeIds: ["BSCS", "BSSE"], year: 3, semesterNumber: 1, prerequisites: [], status: "Active" },
    { id: "CP305", title: "Cloud Computing", credits: 3, type: "Elective", departmentId: "DCSE", programmeIds: ["BSCDS"], year: 3, semesterNumber: 1, prerequisites: [], status: "Active" },
    { id: "CP209", title: "Software Requirements Engineering", credits: 3, type: "Core", departmentId: "DCSE", programmeIds: ["BSSE"], year: 2, semesterNumber: 1, prerequisites: ["CP101"], status: "Active" },
    { id: "IS201", title: "Systems Analysis and Design", credits: 3, type: "Core", departmentId: "DIS", programmeIds: ["BSCIS"], year: 2, semesterNumber: 1, prerequisites: [], status: "Active" },
    { id: "CP204", title: "Automata Theory and Formal Languages", credits: 3, type: "Core", departmentId: "DCSE", programmeIds: ["BSCS", "BSSE"], year: 2, semesterNumber: 1, prerequisites: ["TN103"], status: "Active" },
    { id: "TN205", title: "Numerical Methods", credits: 3, type: "Core", departmentId: "DCSE", programmeIds: ["BSCS", "BSCDS"], year: 2, semesterNumber: 1, prerequisites: ["TN101"], status: "Active" },
    { id: "TN101", title: "Calculus I", credits: 3, type: "Core", departmentId: "DMS", programmeIds: ["BSCMATH", "BENGEE", "BSCS", "BSSE"], year: 1, semesterNumber: 1, prerequisites: [], status: "Active" },
    { id: "EE101", title: "Circuit Theory", credits: 4, type: "Core", departmentId: "DEE", programmeIds: ["BENGEE"], year: 1, semesterNumber: 1, prerequisites: [], status: "Active" },
    { id: "AC101", title: "Financial Accounting I", credits: 3, type: "Core", departmentId: "DACC", programmeIds: ["BCOMACC", "BBAMKT"], year: 1, semesterNumber: 1, prerequisites: [], status: "Active" },
    { id: "BI101", title: "General Biology", credits: 3, type: "Core", departmentId: "DBIO", programmeIds: ["BSCBIO"], year: 1, semesterNumber: 1, prerequisites: [], status: "Active" },
    { id: "LW101", title: "Legal Methods", credits: 3, type: "Core", departmentId: "DLAW", programmeIds: ["LLB"], year: 1, semesterNumber: 1, prerequisites: [], status: "Active" },
    { id: "ED101", title: "Foundations of Education", credits: 2, type: "Core", departmentId: "DEDU", programmeIds: ["BED"], year: 1, semesterNumber: 1, prerequisites: [], status: "Active" },
    { id: "DS101", title: "Introduction to Development Studies", credits: 3, type: "Core", departmentId: "DDS", programmeIds: ["BADS"], year: 1, semesterNumber: 1, prerequisites: [], status: "Active" },
    { id: "CP111", title: "Computer Fundamentals", credits: 3, type: "Core", departmentId: "DCSE", programmeIds: ["DIPCS"], year: 1, semesterNumber: 1, prerequisites: [], status: "Active" },
    { id: "PHD701", title: "Advanced Research Methods", credits: 3, type: "Core", departmentId: "DCSE", programmeIds: ["PHDCS", "PHDDS"], year: 1, semesterNumber: 1, prerequisites: [], status: "Active" },

    { id: "CP202", title: "Object Oriented Programming", credits: 3, type: "Core", departmentId: "DCSE", programmeIds: ["BSCS", "BSSE", "BSCDS"], year: 1, semesterNumber: 2, prerequisites: ["CP101"], status: "Active" },
    { id: "CP203", title: "Database Systems", credits: 4, type: "Core", departmentId: "DCSE", programmeIds: ["BSCS", "BSSE", "BSCIS"], year: 2, semesterNumber: 2, prerequisites: ["CP201"], status: "Active" },
    { id: "TN207", title: "Statistics for Computing", credits: 3, type: "Core", departmentId: "DCSE", programmeIds: ["BSCS", "BSCDS"], year: 2, semesterNumber: 2, prerequisites: [], status: "Active" },
    { id: "CP208", title: "Human Computer Interaction", credits: 3, type: "Elective", departmentId: "DCSE", programmeIds: ["BSCS", "BSSE"], year: 2, semesterNumber: 2, prerequisites: [], status: "Active" },
    { id: "CP303", title: "Software Engineering Principles", credits: 3, type: "Core", departmentId: "DCSE", programmeIds: ["BSCS", "BSSE"], year: 3, semesterNumber: 2, prerequisites: ["CP202"], status: "Active" },
    { id: "CP402", title: "Web Technologies", credits: 3, type: "Elective", departmentId: "DCSE", programmeIds: ["BSCS", "BSSE", "BSCIS"], year: 3, semesterNumber: 2, prerequisites: ["CP202"], status: "Active" },
    { id: "CP403", title: "Mobile Application Development", credits: 3, type: "Elective", departmentId: "DCSE", programmeIds: ["BSSE", "BSCDS"], year: 3, semesterNumber: 2, prerequisites: ["CP202"], status: "Active" },
    { id: "CP306", title: "Software Testing and Quality Assurance", credits: 3, type: "Core", departmentId: "DCSE", programmeIds: ["BSSE"], year: 3, semesterNumber: 2, prerequisites: ["CP209"], status: "Active" },
    { id: "IS301", title: "Enterprise Information Systems", credits: 3, type: "Core", departmentId: "DIS", programmeIds: ["BSCIS"], year: 3, semesterNumber: 2, prerequisites: ["IS201"], status: "Active" },
    { id: "TN102", title: "Linear Algebra", credits: 3, type: "Core", departmentId: "DMS", programmeIds: ["BSCMATH", "BSCS"], year: 1, semesterNumber: 2, prerequisites: ["TN101"], status: "Active" },
    { id: "EE201", title: "Digital Electronics", credits: 4, type: "Core", departmentId: "DEE", programmeIds: ["BENGEE"], year: 1, semesterNumber: 2, prerequisites: ["EE101"], status: "Active" },
    { id: "AC201", title: "Cost Accounting", credits: 3, type: "Core", departmentId: "DACC", programmeIds: ["BCOMACC"], year: 2, semesterNumber: 2, prerequisites: ["AC101"], status: "Active" },
    { id: "CP112", title: "Introduction to Programming (Diploma)", credits: 3, type: "Core", departmentId: "DCSE", programmeIds: ["DIPCS"], year: 1, semesterNumber: 2, prerequisites: ["CP111"], status: "Active" },
    { id: "GS102", title: "Development Studies and Environment", credits: 2, type: "Core", departmentId: "DDS", programmeIds: ["BSCS", "BSSE", "BSCDS", "BENGEE", "BSCMATH", "BSCBIO", "BCOMACC", "BBAMKT", "BSCIS", "BADS", "LLB", "BED"], year: 1, semesterNumber: 2, prerequisites: [], status: "Active" },
    { id: "CP404", title: "Machine Learning", credits: 3, type: "Elective", departmentId: "DCSE", programmeIds: ["BSCS", "BSCDS"], year: 3, semesterNumber: 2, prerequisites: ["CP401"], status: "Active" },
    { id: "AI405", title: "Cybersecurity Fundamentals", credits: 3, type: "Core", departmentId: "DCSE", programmeIds: ["BSCS", "BSSE", "BSCIS"], year: 3, semesterNumber: 2, prerequisites: ["CP302"], status: "Active" }
  ];

  // ---------------------------------------------------------------------
  // Filling the curriculum. Every student takes six or seven courses a
  // semester (USIAMS.academic.COURSE_LOAD), so every programme must offer
  // at least seven in each year and semester of study. The hand-written
  // courses above cover only a few programmes; the rest of each
  // programme's curriculum is generated here from its discipline name.
  // Generated codes are the programme id + year + semester + sequence
  // (e.g. BSCCHEM213), so they cannot collide with the courses above.
  // ---------------------------------------------------------------------
  const COURSES_PER_TERM = 7;

  // "Bachelor of Science in Chemistry" -> "Chemistry",
  // "Bachelor of Arts with Media Studies" -> "Media Studies",
  // "Doctor of Medicine (MD)" -> "Medicine", "Bachelor of Laws" -> "Law".
  function disciplineOf(programme) {
    // A bracketed specialism names the subject ("Bachelor of Education
    // (Educational Psychology)"); a one-word one is a variant ("(Arts)").
    const bracketed = programme.name.match(/\(([^)]+)\)\s*$/);
    if (bracketed && bracketed[1].trim().includes(" ")) return bracketed[1].trim();
    const name = programme.name.replace(/\s*\([^)]*\)\s*$/, "");
    const subject = name.match(/\s(?:in|with)\s+(.+)$/) || name.match(/\sof\s+(.+)$/);
    const discipline = subject ? subject[1].trim() : name;
    return discipline === "Laws" ? "Law" : discipline;
  }

  const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  // Seven strands per semester, numbered by the semester of study, so a
  // programme's titles never repeat (Principles of Chemistry I, II, ...).
  const STRANDS = [
    d => `Principles of ${d}`,
    d => `${d} Theory and Concepts`,
    d => `${d} in Practice`,
    d => `Quantitative Methods for ${d}`,
    d => `${d} Practicum`,
    d => `Research Methods in ${d}`,
    d => `Contemporary Issues in ${d}`
  ];
  const DOCTORAL_STRANDS = [
    d => `Advanced Topics in ${d}`,
    d => `Doctoral Seminar in ${d}`,
    d => `Advanced Research Design in ${d}`,
    d => `Literature Review in ${d}`,
    d => `Research Ethics and Scholarly Writing`,
    d => `Thesis Proposal Development in ${d}`,
    d => `Independent Study in ${d}`
  ];

  function fillCurriculum() {
    const programmes = (global.USIAMS.data && global.USIAMS.data.programmes) || [];
    const ids = new Set(COURSES.map(c => c.id));
    programmes.forEach(programme => {
      const discipline = disciplineOf(programme);
      const strands = programme.level === "PhD" ? DOCTORAL_STRANDS : STRANDS;
      for (let year = 1; year <= programme.durationYears; year++) {
        [1, 2].forEach(semesterNumber => {
          const offered = COURSES.filter(c => c.status === "Active" && c.year === year &&
            c.semesterNumber === semesterNumber && c.programmeIds.includes(programme.id));
          const termIndex = (year - 1) * 2 + (semesterNumber - 1);
          let seq = 1;
          for (let n = offered.length; n < COURSES_PER_TERM; n++) {
            const strand = strands[n % strands.length];
            const id = `${programme.id}${year}${semesterNumber}${seq++}`;
            if (ids.has(id)) continue;
            ids.add(id);
            COURSES.push({
              id,
              title: `${strand(discipline)} ${ROMAN[termIndex] || termIndex + 1}`,
              credits: 3,
              // Five core courses and two electives per semester.
              type: n < 5 ? "Core" : "Elective",
              departmentId: programme.departmentId,
              programmeIds: [programme.id],
              year, semesterNumber, prerequisites: [], status: "Active"
            });
          }
        });
      }
    });
  }
  fillCurriculum();

  function getCourse(id) { return COURSES.find(c => c.id === id); }
  function coursesForProgramme(programmeId) { return COURSES.filter(c => c.programmeIds.includes(programmeId)); }
  function coursesForDepartment(deptId) { return COURSES.filter(c => c.departmentId === deptId); }
  function prerequisitesMet(courseId, passedCourseIds) {
    const course = getCourse(courseId);
    if (!course || !course.prerequisites.length) return true;
    return course.prerequisites.every(p => passedCourseIds.includes(p));
  }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.data = global.USIAMS.data || {};
  global.USIAMS.data.courses = COURSES;
  global.USIAMS.courses = { getCourse, coursesForProgramme, coursesForDepartment, prerequisitesMet };

})(window);

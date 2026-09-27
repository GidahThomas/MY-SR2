/* =========================================================
   USIAMS - data/results.js
   Published examination results for every student, covering
   every academic year/semester the student has already
   completed. Marks are generated deterministically (seeded hash,
   not Math.random) so the same student always sees the same
   transcript across reloads.

   Grades and grade points are intentionally NOT stored here -
   js/gpa.js derives them from `totalMark` on demand so there is
   exactly one place in the codebase that implements the grading
   formula.
   ========================================================= */
(function (global) {
  "use strict";

  const { seededMark } = global.USIAMS.shared;

  function academicYearIdForStudyYear(student, studyYear) {
    const currentAyYear = 2025; // matches the Active academic year, AY2025 = "2025/2026"
    const targetYear = currentAyYear - (student.year - studyYear);
    return `AY${targetYear}`;
  }

  function buildResults() {
    const results = [];
    const students = global.USIAMS.data.students;
    const courses = global.USIAMS.data.courses;
    let seq = 1;

    students.forEach(student => {
      for (let studyYear = 1; studyYear < student.year; studyYear++) {
        const ayId = academicYearIdForStudyYear(student, studyYear);
        [1, 2].forEach(semNum => {
          const semesterId = `${ayId}-S${semNum}`;
          const semCourses = courses.filter(c =>
            c.year === studyYear && c.semesterNumber === semNum &&
            c.programmeIds.includes(student.programmeId) && c.status === "Active"
          );
          semCourses.forEach(course => {
            const ca = seededMark(`${student.id}-${course.id}-ca`, 20, 38);
            const exam = seededMark(`${student.id}-${course.id}-exam`, 22, 58);
            results.push({
              id: `RES-${String(seq++).padStart(5, "0")}`,
              studentId: student.id,
              semesterId,
              courseId: course.id,
              ca,
              exam,
              totalMark: ca + exam,
              status: "Published"
            });
          });
        });
      }
    });
    return results;
  }

  function resultsForStudent(studentId) {
    return global.USIAMS.data.results.filter(r => r.studentId === studentId);
  }
  function resultsForStudentSemester(studentId, semesterId) {
    return global.USIAMS.data.results.filter(r => r.studentId === studentId && r.semesterId === semesterId);
  }
  function semestersWithResults(studentId) {
    const set = new Set(resultsForStudent(studentId).map(r => r.semesterId));
    return global.USIAMS.data.semesters.filter(s => set.has(s.id));
  }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.data = global.USIAMS.data || {};
  global.USIAMS.data.results = buildResults();
  global.USIAMS.results = { resultsForStudent, resultsForStudentSemester, semestersWithResults };

})(window);

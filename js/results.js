/* =========================================================
   USIAMS - js/results.js
   Results & Transcript page. Every grade/point/GPA value shown
   here is computed through js/gpa.js - no calculation is
   duplicated locally.
   ========================================================= */
(function (window) {
  "use strict";

  const { util, charts, gpa, academic } = window.USIAMS;
  let student = null;
  // Set by initPage. util.studentLabel() consults it to decide whether a
  // viewer may see student names or only registration numbers.
  let currentUser = null;

  function withCredits(result) {
    const course = window.USIAMS.courses.getCourse(result.courseId);
    return { ...result, credits: course ? course.credits : 0 };
  }

  function semesterLabel(semesterId) {
    const sem = window.USIAMS.data.semesters.find(s => s.id === semesterId);
    const ay = window.USIAMS.data.academicYears.find(a => a.id === sem.academicYearId);
    return `${sem.label}, ${ay.label}`;
  }

  function populateSemesterFilter() {
    const semesters = window.USIAMS.results.semestersWithResults(student.id);
    const select = document.getElementById("resultsSemesterFilter");
    select.innerHTML = `<option value="ALL">All Semesters</option>` + semesters.map(s => `<option value="${s.id}">${semesterLabel(s.id)}</option>`).join("");
    select.value = semesters.length ? semesters[semesters.length - 1].id : "ALL";
  }

  function render() {
    const select = document.getElementById("resultsSemesterFilter");
    const semesterId = select.value;
    const allResults = window.USIAMS.results.resultsForStudent(student.id).map(withCredits);
    const shown = semesterId === "ALL" ? allResults : allResults.filter(r => r.semesterId === semesterId);

    const overallGpa = gpa.calculateGpa(allResults);
    const semGpa = gpa.calculateGpa(shown);
    document.getElementById("overallGpaValue").textContent = overallGpa.toFixed(2);
    document.getElementById("overallGpaClass").textContent = gpa.classify(overallGpa);
    document.getElementById("semesterGpaValue").textContent = semGpa.toFixed(2);
    document.getElementById("semesterGpaClass").textContent = gpa.classify(semGpa);
    document.getElementById("totalCoursesValue").textContent = allResults.length;
    document.getElementById("creditsEarnedValue").textContent = allResults.reduce((s, r) => s + r.credits, 0);

    const tbody = document.getElementById("resultsTableBody");
    if (!shown.length) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="bi bi-clipboard-x"></i>No published results for this selection.</div></td></tr>`;
    } else {
      tbody.innerHTML = shown.map(r => {
        const course = window.USIAMS.courses.getCourse(r.courseId);
        return `<tr>
          <td>${semesterId === "ALL" ? semesterLabel(r.semesterId) : ""}</td>
          <td>${course.id}</td>
          <td>${util.escapeHtml(course.title)}</td>
          <td>${r.credits}</td>
          <td>${r.ca}</td>
          <td>${r.exam}</td>
          <td><strong>${r.totalMark}</strong></td>
          <td><span class="status-badge status-active">${gpa.gradeFromMark(r.totalMark)}</span></td>
        </tr>`;
      }).join("");
    }

    const dist = gpa.gradeDistribution(shown);
    charts.doughnutChart("gradeDistributionChart", Object.keys(dist), Object.values(dist));

    const semesters = window.USIAMS.results.semestersWithResults(student.id);
    charts.lineChart("semesterGpaChart",
      semesters.map(s => s.label.replace("Semester ", "S")),
      [{ label: "Semester GPA", data: semesters.map(s => gpa.calculateGpa(window.USIAMS.results.resultsForStudentSemester(student.id, s.id).map(withCredits))) }],
      { scales: { y: { min: 0, max: 5 } } }
    );
  }

  function printResults() {
    window.print();
  }

  function exportResultsCsv() {
    const select = document.getElementById("resultsSemesterFilter");
    const semesterId = select.value;
    const allResults = window.USIAMS.results.resultsForStudent(student.id).map(withCredits);
    const shown = semesterId === "ALL" ? allResults : allResults.filter(r => r.semesterId === semesterId);
    util.downloadCsv(`${student.regNumber.replace(/\//g, "-")}-results`, shown.map(r => {
      const course = window.USIAMS.courses.getCourse(r.courseId);
      return {
        Semester: semesterLabel(r.semesterId), Code: course.id, Title: course.title, Credits: r.credits,
        CA: r.ca, Exam: r.exam, Total: r.totalMark, Grade: gpa.gradeFromMark(r.totalMark), Status: r.status
      };
    }));
  }

  function downloadTranscript() {
    const results = window.USIAMS.results.resultsForStudent(student.id).map(withCredits);
    const lines = [
      "USIAMS - UNOFFICIAL ACADEMIC TRANSCRIPT",
      `Student: ${window.USIAMS.util.studentLabel(student, currentUser)} (${student.regNumber})`,
      `Programme: ${academic.getProgramme(student.programmeId).name}`,
      "",
      "Semester, Course, Title, Credits, CA, Exam, Total, Grade"
    ];
    results.forEach(r => {
      const course = window.USIAMS.courses.getCourse(r.courseId);
      lines.push(`${semesterLabel(r.semesterId)}, ${course.id}, ${course.title}, ${r.credits}, ${r.ca}, ${r.exam}, ${r.totalMark}, ${gpa.gradeFromMark(r.totalMark)}`);
    });
    lines.push("", `Overall GPA: ${gpa.calculateGpa(results).toFixed(2)} (${gpa.classify(gpa.calculateGpa(results))})`);
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${student.regNumber.replace(/\//g, "-")}-transcript.txt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    window.USIAMS.toast.show("success", "Transcript downloaded", "An unofficial transcript has been downloaded. Official transcripts must be requested via Requests > Transcript.");
  }

  function initPage(user) {
    currentUser = user;
    let targetStudentId = user.studentId;
    const selectorWrap = document.getElementById("studentSelectorWrap");
    if (user.role !== "STUDENT") {
      selectorWrap.classList.remove("d-none");
      const select = document.getElementById("studentSelector");
      select.innerHTML = window.USIAMS.data.students.map(s => `<option value="${s.id}">${s.regNumber}</option>`).join("");
      targetStudentId = select.value;
      select.addEventListener("change", () => loadStudent(select.value));
    } else {
      selectorWrap.classList.add("d-none");
    }
    loadStudent(targetStudentId);

    document.getElementById("resultsSemesterFilter").addEventListener("change", render);
    document.getElementById("printResultsBtn").addEventListener("click", printResults);
    document.getElementById("downloadTranscriptBtn").addEventListener("click", downloadTranscript);
    document.getElementById("exportResultsCsvBtn").addEventListener("click", exportResultsCsv);
  }

  function loadStudent(id) {
    student = window.USIAMS.students.getStudent(id);
    document.getElementById("resultsStudentName").textContent = `${window.USIAMS.util.studentLabel(student, currentUser)} (${student.regNumber}) - ${window.USIAMS.academic.getProgramme(student.programmeId).name}`;
    populateSemesterFilter();
    render();
  }

  window.USIAMS = window.USIAMS || {};
  window.USIAMS.resultsPage = { initPage };

})(window);

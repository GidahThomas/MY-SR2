/* =========================================================
   USIAMS - js/reports.js
   Dynamic report generator. Each report type builds its rows
   directly from the shared data/services layer (gpa.js,
   finance.js, attendance.js) - reports never invent numbers of
   their own.
   ========================================================= */
(function (window) {
  "use strict";

  const { util, gpa, academic } = window.USIAMS;
  let lastReport = null;

  function studentReport() {
    const rows = window.USIAMS.data.students.map(s => ({
      "Reg Number": s.regNumber, "Full Name": s.fullName, "Programme": academic.getProgramme(s.programmeId)?.name,
      "Department": academic.getDepartment(s.departmentId)?.name, "Year": s.year, "Status": s.status
    }));
    return { title: "Student Report", rows };
  }

  function registrationReport() {
    const list = window.USIAMS.storage.ensureSeed("registrations", () => window.USIAMS.data.seedRegistrations);
    const rows = list.map(r => {
      const s = window.USIAMS.students.getStudent(r.studentId);
      return { "Reg Number": s?.regNumber, "Student": s?.fullName, "Semester": r.semesterId, "Courses": r.courseIds.length, "Total Credits": r.totalCredits, "Status": r.status };
    });
    return { title: "Registration Report", rows };
  }

  function resultsReport() {
    const rows = window.USIAMS.data.results.map(r => {
      const s = window.USIAMS.students.getStudent(r.studentId);
      const c = window.USIAMS.courses.getCourse(r.courseId);
      return { "Reg Number": s?.regNumber, "Course": c?.id, "Total Mark": r.totalMark, "Grade": gpa.gradeFromMark(r.totalMark), "Semester": r.semesterId, "Status": r.status };
    });
    return { title: "Results Report", rows };
  }

  function gpaReport() {
    const rows = window.USIAMS.data.students.map(s => {
      const results = window.USIAMS.results.resultsForStudent(s.id).map(r => ({ ...r, credits: window.USIAMS.courses.getCourse(r.courseId)?.credits || 0 }));
      const g = gpa.calculateGpa(results);
      return { "Reg Number": s.regNumber, "Full Name": s.fullName, "Programme": academic.getProgramme(s.programmeId)?.code, "GPA": g.toFixed(2), "Classification": gpa.classify(g) };
    });
    return { title: "GPA Report", rows };
  }

  function courseReport() {
    const rows = window.USIAMS.data.courses.map(c => ({
      "Code": c.id, "Title": c.title, "Credits": c.credits, "Type": c.type,
      "Department": academic.getDepartment(c.departmentId)?.name, "Status": c.status
    }));
    return { title: "Course Report", rows };
  }

  function programmeReport() {
    const rows = window.USIAMS.data.programmes.map(p => ({
      "Code": p.code, "Name": p.name, "Department": academic.getDepartment(p.departmentId)?.name,
      "Students": window.USIAMS.data.students.filter(s => s.programmeId === p.id).length, "Duration (Years)": p.durationYears
    }));
    return { title: "Programme Report", rows };
  }

  function departmentReport() {
    const rows = window.USIAMS.data.departments.map(d => ({
      "Department": d.name, "Unit": academic.getOrgUnit(d.unitId)?.name, "HOD": d.hod,
      "Programmes": window.USIAMS.data.programmes.filter(p => p.departmentId === d.id).length,
      "Students": window.USIAMS.data.students.filter(s => s.departmentId === d.id).length
    }));
    return { title: "Department Report", rows };
  }

  function collegeReport() {
    const rows = window.USIAMS.data.orgUnits.map(u => ({
      "Unit": u.name, "Type": u.type, "Departments": window.USIAMS.data.departments.filter(d => d.unitId === u.id).length,
      "Students": window.USIAMS.data.departments.filter(d => d.unitId === u.id).reduce((s, d) => s + window.USIAMS.data.students.filter(st => st.departmentId === d.id).length, 0)
    }));
    return { title: "College / Institute / School Report", rows };
  }

  function financeReport() {
    const rows = window.USIAMS.data.students.map(s => {
      const balance = window.USIAMS.finance.balanceForStudent(s.id);
      return { "Reg Number": s.regNumber, "Full Name": s.fullName, "Billed": balance.billed, "Paid": balance.paid, "Balance": balance.balance };
    });
    return { title: "Finance Report", rows };
  }

  function attendanceReport() {
    const rows = window.USIAMS.data.students.filter(s => s.status === "Active").map(s => ({
      "Reg Number": s.regNumber, "Full Name": s.fullName, "Overall Attendance %": window.USIAMS.attendance.overallPercentageForStudent(s.id)
    }));
    return { title: "Attendance Report", rows };
  }

  function graduationReport() {
    const list = window.USIAMS.storage.getStorage("graduation", window.USIAMS.data.seedGraduation);
    const rows = list.map(r => {
      const s = window.USIAMS.students.getStudent(r.studentId);
      return { "Reg Number": s?.regNumber, "Full Name": s?.fullName, "Progress": window.USIAMS.graduation.progressFor(r.checklist) + "%", "Eligibility": window.USIAMS.graduation.eligibilityFor(r.checklist) };
    });
    return { title: "Graduation Report", rows };
  }

  function qaReport() {
    const rows = window.USIAMS.storage.getStorage("qaFlags", window.USIAMS.data.qaFlags).map(f => ({
      "Flag ID": f.id, "Category": f.category, "Severity": f.severity, "Entity": f.entityLabel, "Status": f.status, "Date Raised": f.date
    }));
    return { title: "Quality Assurance Report", rows };
  }

  const GENERATORS = {
    student: studentReport, registration: registrationReport, results: resultsReport, gpa: gpaReport,
    course: courseReport, programme: programmeReport, department: departmentReport, college: collegeReport,
    finance: financeReport, attendance: attendanceReport, graduation: graduationReport, qa: qaReport
  };

  function generate() {
    const type = document.getElementById("reportType").value;
    const generator = GENERATORS[type];
    if (!generator) return;
    lastReport = generator();
    renderTable(lastReport);
  }

  function renderTable({ title, rows }) {
    document.getElementById("reportResultTitle").textContent = title;
    const wrap = document.getElementById("reportTableWrap");
    if (!rows.length) { wrap.innerHTML = `<div class="empty-state"><i class="bi bi-file-earmark-bar-graph"></i>No data available for this report and filter selection.</div>`; return; }
    const cols = Object.keys(rows[0]);
    wrap.innerHTML = `
      <table class="usi-table">
        <thead><tr>${cols.map(c => `<th>${util.escapeHtml(c)}</th>`).join("")}</tr></thead>
        <tbody>${rows.map(r => `<tr>${cols.map(c => {
          const isMoneyColumn = typeof r[c] === "number" && ["billed", "paid", "balance"].includes(c.toLowerCase());
          return `<td>${isMoneyColumn ? util.formatCurrency(r[c]) : util.escapeHtml(String(r[c] ?? "-"))}</td>`;
        }).join("")}</tr>`).join("")}</tbody>
      </table>`;
  }

  function initPage() {
    document.getElementById("generateReportBtn").addEventListener("click", generate);
    document.getElementById("printReportBtn").addEventListener("click", () => { if (!lastReport) { window.USIAMS.toast.show("warning", "Generate a report first", "Please generate a report before printing."); return; } window.print(); });
    document.getElementById("exportReportCsvBtn").addEventListener("click", () => {
      if (!lastReport || !lastReport.rows.length) { window.USIAMS.toast.show("warning", "Nothing to export", "Please generate a report with data first."); return; }
      util.downloadCsv(util.slugify(lastReport.title), lastReport.rows);
    });
    generate();
  }

  window.USIAMS = window.USIAMS || {};
  window.USIAMS.reportsPage = { initPage };

})(window);

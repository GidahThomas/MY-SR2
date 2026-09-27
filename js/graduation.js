/* =========================================================
   USIAMS - js/graduation.js
   Graduation clearance checklist: academic, fees, department,
   library clearance, documents and the final application.
   ========================================================= */
(function (window) {
  "use strict";

  const { util, toast } = window.USIAMS;
  const KEY = "graduation";
  let currentUser = null;

  function all() { return window.USIAMS.storage.ensureSeed(KEY, () => window.USIAMS.data.seedGraduation); }
  function save(list) { window.USIAMS.storage.setStorage(KEY, list); }

  function recordFor(studentId) {
    let list = all();
    let record = list.find(r => r.studentId === studentId);
    if (!record) {
      record = { id: util.uid("GRD"), studentId, checklist: Object.fromEntries(window.USIAMS.data.graduationChecklistItems.map(i => [i, false])), applicationSubmitted: false };
      list.push(record);
      save(list);
    }
    return record;
  }

  function render(studentId) {
    const record = recordFor(studentId);
    const progress = window.USIAMS.graduation.progressFor(record.checklist);
    const eligible = Object.values(record.checklist).every(Boolean);

    document.getElementById("graduationProgressBar").style.width = `${progress}%`;
    document.getElementById("graduationProgressLabel").textContent = `${progress}% Complete`;
    document.getElementById("eligibilityBadge").innerHTML = eligible
      ? `<span class="status-badge status-eligible">Eligible</span>`
      : progress === 0 ? `<span class="status-badge status-pending">Pending Clearance</span>` : `<span class="status-badge status-not_eligible">Not Eligible</span>`;

    const list = document.getElementById("checklistContainer");
    list.innerHTML = Object.entries(record.checklist).map(([item, done]) => `
      <div class="checklist-item">
        <div class="check-icon ${done ? "icon-tint-success" : "icon-tint-warning"}"><i class="bi ${done ? "bi-check-lg" : "bi-hourglass-split"}"></i></div>
        <div class="flex-grow-1">${util.escapeHtml(item)}</div>
        <span class="status-badge status-${done ? "active" : "pending"}">${done ? "Cleared" : "Pending"}</span>
      </div>`).join("");

    const applyBtn = document.getElementById("submitApplicationBtn");
    if (record.applicationSubmitted) {
      applyBtn.disabled = true;
      applyBtn.innerHTML = `<i class="bi bi-check2-circle me-1"></i>Application Submitted`;
    } else {
      applyBtn.disabled = !eligible;
      applyBtn.innerHTML = `<i class="bi bi-send me-1"></i>Submit Graduation Application`;
    }
    applyBtn.onclick = () => {
      if (!eligible) { toast.show("warning", "Not yet eligible", "Please complete all clearance items before applying for graduation."); return; }
      const list2 = all().map(r => r.studentId === studentId ? { ...r, applicationSubmitted: true, checklist: { ...r.checklist, "Graduation Application": true } } : r);
      save(list2);
      render(studentId);
      toast.show("success", "Application submitted", "Your graduation application has been submitted for review.");
    };
  }

  function initPage(user) {
    currentUser = user;
    const show = studentId => {
      const student = window.USIAMS.students.getStudent(studentId);
      document.getElementById("graduationStudentName").textContent = `${window.USIAMS.util.studentLabel(student, currentUser)} (${student.regNumber})`;
      render(studentId);
    };
    show(window.USIAMS.util.studentPicker(user, { include: s => s.year >= 3, onChange: show }));
  }

  window.USIAMS = window.USIAMS || {};
  window.USIAMS.graduationPage = { initPage };

})(window);

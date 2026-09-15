/* =========================================================
   USIAMS - js/apply.js
   Public, unauthenticated admissions application form. Anyone
   can submit an application without an account - it is stored
   in the same "admissionApplications" overlay that Registration
   Officers review on pages/admissions.html (see js/admissions.js).
   ========================================================= */
(function (global) {
  "use strict";

  const { util } = global.USIAMS;
  const applicationsOverlay = global.USIAMS.storage.createOverlay("admissionApplications", () => global.USIAMS.data.seedApplications);

  function populateProgrammes() {
    const select = document.getElementById("applyProgramme");
    select.innerHTML = global.USIAMS.data.programmes.map(p => `<option value="${p.id}">${util.escapeHtml(p.name)} (${util.escapeHtml(p.level)})</option>`).join("");
  }

  function init() {
    populateProgrammes();
    const form = document.getElementById("applyForm");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const fields = ["applyFullName", "applyEmail", "applyPhone", "applyGender", "applyProgramme", "applySchool", "applyQualification"];
      let valid = true;
      fields.forEach(id => {
        const el = document.getElementById(id);
        if (!el.value.trim()) { el.classList.add("is-invalid"); valid = false; } else el.classList.remove("is-invalid");
      });
      const emailEl = document.getElementById("applyEmail");
      if (emailEl.value.trim() && !util.validateEmail(emailEl.value.trim())) { emailEl.classList.add("is-invalid"); valid = false; }
      if (!valid) return;

      const application = {
        id: global.USIAMS.storage.nextId("APP", applicationsOverlay.getAll()),
        fullName: document.getElementById("applyFullName").value.trim(),
        email: document.getElementById("applyEmail").value.trim(),
        phone: document.getElementById("applyPhone").value.trim(),
        gender: document.getElementById("applyGender").value,
        programmeId: document.getElementById("applyProgramme").value,
        previousSchool: document.getElementById("applySchool").value.trim(),
        entryQualification: document.getElementById("applyQualification").value,
        applicationDate: new Date().toISOString().slice(0, 10),
        status: "Submitted",
        notes: ""
      };
      applicationsOverlay.add(application);

      document.getElementById("applyFormCard").classList.add("d-none");
      const confirmCard = document.getElementById("applyConfirmCard");
      confirmCard.classList.remove("d-none");
      document.getElementById("applyReferenceId").textContent = application.id;
    });
  }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.applyPage = { init };

})(window);

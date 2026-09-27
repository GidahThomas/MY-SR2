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

  /**
   * The programme list comes from the database so the form always offers
   * what the university currently admits to. This page is public, so it
   * uses the unauthenticated endpoint; if the server cannot be reached the
   * bundled catalogue is used rather than showing an empty dropdown.
   */
  async function populateProgrammes() {
    const select = document.getElementById("applyProgramme");
    let programmes = global.USIAMS.data.programmes || [];
    try {
      const response = await fetch("/api/public/programmes");
      const result = await response.json();
      if (response.ok && result.success && result.data.length) programmes = result.data;
    } catch (error) {
      console.warn("USIAMS: falling back to the bundled programme catalogue.", error);
    }
    select.innerHTML = programmes
      .map(p => `<option value="${util.escapeHtml(p.id)}">${util.escapeHtml(p.name)} (${util.escapeHtml(p.level)})</option>`)
      .join("");
    // The home page's programme cards link here as apply.html?programme=<id>.
    const wanted = new URLSearchParams(global.location.search).get("programme");
    if (wanted && programmes.some(p => p.id === wanted)) select.value = wanted;
  }

  async function init() {
    await populateProgrammes();
    const form = document.getElementById("applyForm");
    form.addEventListener("submit", async (e) => {
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
        fullName: document.getElementById("applyFullName").value.trim(),
        email: document.getElementById("applyEmail").value.trim(),
        phone: document.getElementById("applyPhone").value.trim(),
        gender: document.getElementById("applyGender").value,
        programmeId: document.getElementById("applyProgramme").value,
        previousSchool: document.getElementById("applySchool").value.trim(),
        entryQualification: document.getElementById("applyQualification").value,
        applicationDate: new Date().toISOString().slice(0, 10)
      };
      const submitButton = form.querySelector("button[type=submit]");
      submitButton.disabled = true;
      try {
        const response = await fetch("/api/admissions/applications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(application) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Application could not be submitted.");
        application.id = result.reference;
      } catch (error) {
        submitButton.disabled = false;
        alert(error.message);
        return;
      }

      document.getElementById("applyFormCard").classList.add("d-none");
      const confirmCard = document.getElementById("applyConfirmCard");
      confirmCard.classList.remove("d-none");
      document.getElementById("applyReferenceId").textContent = application.id;
    });
  }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.applyPage = { init };

})(window);

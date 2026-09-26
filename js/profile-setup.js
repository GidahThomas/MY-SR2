/* =========================================================
   USIAMS - js/profile-setup.js
   Student self-service profile completion wizard: Personal
   Details -> Emergency Contact -> Academic Background ->
   Document Upload. Each step is saved (via the shared students
   overlay, USIAMS.students.updateStudent) as soon as it's
   completed, so progress persists even if the student leaves
   and comes back, and the completion percentage shown elsewhere
   (student dashboard banner) is always accurate.
   ========================================================= */
(function (global) {
  "use strict";

  const { util, toast } = global.USIAMS;
  const STEPS = ["personal", "emergency", "academic", "documents"];
  let currentStudent = null;
  let stepIndex = 0;

  function refreshStudent() { currentStudent = global.USIAMS.students.getStudent(currentStudent.id); }

  function renderProgress() {
    const pct = global.USIAMS.students.profileCompletionPercent(currentStudent);
    document.getElementById("profileProgressBar").style.width = `${pct}%`;
    document.getElementById("profileProgressBar").textContent = `${pct}%`;
    document.getElementById("profileStepLabel").textContent = `Step ${stepIndex + 1} of ${STEPS.length}`;
    STEPS.forEach((key, i) => {
      const dot = document.getElementById(`stepDot-${key}`);
      dot.classList.toggle("active", i === stepIndex);
      dot.classList.toggle("done", global.USIAMS.students.profileSteps(currentStudent)[i].done);
    });
  }

  function showStep(index) {
    stepIndex = Math.max(0, Math.min(STEPS.length - 1, index));
    STEPS.forEach((key, i) => document.getElementById(`step-${key}`).classList.toggle("d-none", i !== stepIndex));
    renderProgress();
  }

  function fieldError(msg) {
    const box = document.getElementById("profileStepError");
    box.textContent = msg;
    box.classList.remove("d-none");
  }
  function clearError() { document.getElementById("profileStepError").classList.add("d-none"); }

  function savePersonal() {
    const phone = document.getElementById("psPhone").value.trim();
    const address = document.getElementById("psAddress").value.trim();
    const dob = document.getElementById("psDob").value;
    if (!util.validatePhone(phone)) { fieldError("Please enter a valid Tanzanian phone number (e.g. +255712345678)."); return false; }
    if (!address) { fieldError("Please enter your current address."); return false; }
    if (!dob) { fieldError("Please enter your date of birth."); return false; }
    global.USIAMS.students.updateStudent(currentStudent.id, { phone, address, dob });
    refreshStudent();
    return true;
  }

  function saveEmergency() {
    const name = document.getElementById("psEmName").value.trim();
    const relation = document.getElementById("psEmRelation").value;
    const phone = document.getElementById("psEmPhone").value.trim();
    if (!name) { fieldError("Please enter your emergency contact's name."); return false; }
    if (!util.validatePhone(phone)) { fieldError("Please enter a valid phone number for your emergency contact."); return false; }
    global.USIAMS.students.updateStudent(currentStudent.id, { emergencyContact: { name, relation, phone } });
    refreshStudent();
    return true;
  }

  function saveAcademic() {
    const previousSchool = document.getElementById("psSchool").value.trim();
    const entryQualification = document.getElementById("psQualification").value;
    if (!previousSchool) { fieldError("Please enter the name of your previous school or institution."); return false; }
    if (!entryQualification) { fieldError("Please select your entry qualification."); return false; }
    global.USIAMS.students.updateStudent(currentStudent.id, {
      admission: { ...(currentStudent.admission || {}), previousSchool, entryQualification }
    });
    refreshStudent();
    return true;
  }

  // Each document is uploaded and stored in the database; the student
  // record keeps the list of names and download URLs.
  async function saveDocuments() {
    const files = Array.from(document.getElementById("psDocFiles").files);
    if (!files.length && !currentStudent.documentsSubmitted) { fieldError("Please select at least one document to upload."); return false; }
    if (files.length) {
      const stored = [];
      try {
        for (const file of files) {
          const saved = await global.USIAMS.api.files.upload(file, "profile");
          stored.push({ name: file.name, url: saved.url });
        }
      } catch (error) {
        fieldError(error.message || "Your documents could not be uploaded.");
        return false;
      }
      global.USIAMS.students.updateStudent(currentStudent.id, { documentsSubmitted: true, documentNames: stored });
      refreshStudent();
    }
    return true;
  }

  const SAVERS = { personal: savePersonal, emergency: saveEmergency, academic: saveAcademic, documents: saveDocuments };

  async function goNext(event) {
    clearError();
    const nextBtn = event && event.currentTarget;
    if (nextBtn) nextBtn.disabled = true;
    const saved = await SAVERS[STEPS[stepIndex]]();
    if (nextBtn) nextBtn.disabled = false;
    if (!saved) return;
    if (stepIndex === STEPS.length - 1) {
      toast.show("success", "Profile complete", "Thank you - your profile is now 100% complete.");
      setTimeout(() => { window.location.href = "student-dashboard.html"; }, 900);
      return;
    }
    showStep(stepIndex + 1);
  }

  function goBack() {
    clearError();
    showStep(stepIndex - 1);
  }

  function prefill() {
    document.getElementById("psPhone").value = currentStudent.phone && currentStudent.phone !== "-" ? currentStudent.phone : "";
    document.getElementById("psAddress").value = currentStudent.address && currentStudent.address !== "-" ? currentStudent.address : "";
    document.getElementById("psDob").value = currentStudent.dob || "";
    const em = currentStudent.emergencyContact || {};
    document.getElementById("psEmName").value = em.name && em.name !== "-" ? em.name : "";
    document.getElementById("psEmRelation").value = em.relation && em.relation !== "-" ? em.relation : "Father";
    document.getElementById("psEmPhone").value = em.phone && em.phone !== "-" ? em.phone : "";
    const ad = currentStudent.admission || {};
    document.getElementById("psSchool").value = ad.previousSchool && ad.previousSchool !== "-" ? ad.previousSchool : "";
    document.getElementById("psQualification").value = ad.entryQualification || "";
    // documentNames holds { name, url } for uploaded files (older records: plain names).
    const docs = (currentStudent.documentNames || []).map(d => typeof d === "string" ? { name: d } : d);
    document.getElementById("psDocStatus").innerHTML = currentStudent.documentsSubmitted
      ? `Already submitted: ${docs.map(d => d.url
          ? `<a href="#" data-action="download-attachment" data-url="${util.escapeHtml(d.url)}" data-name="${util.escapeHtml(d.name)}">${util.escapeHtml(d.name)}</a>`
          : util.escapeHtml(d.name)).join(", ") || "on file"}`
      : "No documents submitted yet.";
  }

  function firstIncompleteStepIndex() {
    const steps = global.USIAMS.students.profileSteps(currentStudent);
    const idx = steps.findIndex(s => !s.done);
    return idx === -1 ? STEPS.length - 1 : idx;
  }

  function initPage(user) {
    currentStudent = global.USIAMS.students.getStudent(user.studentId);
    if (!currentStudent) {
      document.querySelector("main")?.insertAdjacentHTML("afterbegin", `<div class="alert alert-info"><i class="bi bi-info-circle me-2"></i>Your account is created, but you are not enrolled in an academic programme yet. Submit an admission application to continue.</div>`);
      document.querySelectorAll("#profileForm, #profileWizard, .profile-wizard").forEach(el => el.classList.add("d-none"));
      return;
    }
    prefill();
    document.getElementById("psNextPersonal").addEventListener("click", goNext);
    document.getElementById("psNextEmergency").addEventListener("click", goNext);
    document.getElementById("psNextAcademic").addEventListener("click", goNext);
    document.getElementById("psFinishDocuments").addEventListener("click", goNext);
    document.getElementById("psBackEmergency").addEventListener("click", goBack);
    document.getElementById("psBackAcademic").addEventListener("click", goBack);
    document.getElementById("psBackDocuments").addEventListener("click", goBack);
    document.getElementById("psDocFiles").addEventListener("change", (e) => {
      document.getElementById("psDocFileNames").textContent = e.target.files.length ? `Selected: ${Array.from(e.target.files).map(f => f.name).join(", ")}` : "";
    });
    showStep(firstIncompleteStepIndex());
  }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.profileSetupPage = { initPage };

})(window);

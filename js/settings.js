/* =========================================================
   USIAMS - js/settings.js
   Personal settings page: profile summary, theme preference,
   notification preferences and password change - all saved to the
   database (user_preferences, users.password_hash).
   ========================================================= */
(function (window) {
  "use strict";

  const { util, toast } = window.USIAMS;

  function renderProfile(user) {
    document.getElementById("settingsAvatar").style.background = util.avatarColorFromString(user.name);
    document.getElementById("settingsAvatar").textContent = util.initials(user.name);
    document.getElementById("settingsName").textContent = user.name;
    document.getElementById("settingsRole").textContent = user.roleLabel;
    document.getElementById("settingsEmail").textContent = user.email;
    document.getElementById("settingsUsername").textContent = user.username;
  }

  function renderThemeToggle() {
    const current = localStorage.getItem("usiams.theme") || "light";
    document.getElementById("themeRadio-" + current).checked = true;
    document.querySelectorAll("input[name='themeRadio']").forEach(r => r.addEventListener("change", (e) => {
      window.USIAMS.applyTheme(e.target.value);
    }));
  }

  function renderPreferences() {
    const prefs = window.USIAMS.storage.getStorage("preferences", { emailAlerts: true, smsAlerts: false, weeklyDigest: true });
    ["emailAlerts", "smsAlerts", "weeklyDigest"].forEach(key => {
      const el = document.getElementById("pref-" + key);
      el.checked = !!prefs[key];
      el.addEventListener("change", () => {
        const p = window.USIAMS.storage.getStorage("preferences", {});
        p[key] = el.checked;
        window.USIAMS.storage.setStorage("preferences", p);
        toast.show("success", "Preference saved", "Your notification preference has been updated.");
      });
    });
  }

  function wirePasswordForm() {
    document.getElementById("passwordForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const current = document.getElementById("currentPassword").value;
      const next = document.getElementById("newPassword").value;
      const confirm = document.getElementById("confirmPassword").value;
      const errorBox = document.getElementById("passwordFormError");
      if (!current || !next || !confirm) { errorBox.textContent = "Please fill in all password fields."; errorBox.classList.remove("d-none"); return; }
      if (next.length < 8) { errorBox.textContent = "New password must be at least 8 characters long."; errorBox.classList.remove("d-none"); return; }
      if (next !== confirm) { errorBox.textContent = "New password and confirmation do not match."; errorBox.classList.remove("d-none"); return; }
      errorBox.classList.add("d-none");
      const submit = document.querySelector("#passwordForm [type=submit]");
      submit.disabled = true;
      window.USIAMS.api.request("/api/auth/change-password", {
        method: "POST", body: { currentPassword: current, newPassword: next }
      }).then(result => {
        document.getElementById("passwordForm").reset();
        toast.show("success", "Password updated", result.message || "Your password has been changed.");
      }).catch(error => {
        errorBox.textContent = error.message || "Your password could not be changed.";
        errorBox.classList.remove("d-none");
      }).finally(() => { submit.disabled = false; });
    });
  }

  function initPage(user) {
    renderProfile(user);
    renderThemeToggle();
    renderPreferences();
    wirePasswordForm();
  }

  window.USIAMS = window.USIAMS || {};
  window.USIAMS.settingsPage = { initPage };

})(window);

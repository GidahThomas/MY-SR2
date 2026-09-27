/* =========================================================
   USIAMS - ui.js
   Small, dependency-free UI helper utilities shared by every
   page: formatting, escaping, debouncing, CSV export, avatars.
   ========================================================= */
(function (global) {
  "use strict";

  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatCurrency(amount, currency = "TZS") {
    const n = Number(amount) || 0;
    return `${currency} ${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }

  function formatDate(dateStr, opts = {}) {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", ...opts });
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function timeAgo(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const diffMs = Date.now() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return formatDate(dateStr);
  }

  function initials(name) {
    if (!name) return "?";
    return name.split(" ").filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join("");
  }

  function canViewStudentNames(user, student) {
    return user?.role === "SYSTEM_ADMIN" || (user?.role === "STUDENT" && (!student || student.id === user.studentId));
  }

  function studentLabel(student, user) {
    if (!student) return "-";
    return canViewStudentNames(user, student) ? student.fullName : student.regNumber;
  }

  function debounce(fn, wait = 250) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function slugify(str) {
    return String(str).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  function titleCase(str) {
    return String(str || "").replace(/_/g, " ").replace(/\w\S*/g, t => t[0].toUpperCase() + t.slice(1).toLowerCase());
  }

  function paginate(array, page, pageSize) {
    const total = array.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const start = (currentPage - 1) * pageSize;
    return {
      items: array.slice(start, start + pageSize),
      total, totalPages, currentPage,
      start: total === 0 ? 0 : start + 1,
      end: Math.min(start + pageSize, total)
    };
  }

  function downloadCsv(filename, rows) {
    if (!rows || !rows.length) {
      global.USIAMS.toast.show("warning", "Nothing to export", "There is no data available for export.");
      return;
    }
    const headers = Object.keys(rows[0]);
    const csvLines = [
      headers.join(","),
      ...rows.map(row => headers.map(h => {
        let val = row[h] === null || row[h] === undefined ? "" : String(row[h]);
        if (val.includes(",") || val.includes('"') || val.includes("\n")) {
          val = '"' + val.replace(/"/g, '""') + '"';
        }
        return val;
      }).join(","))
    ];
    const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename.endsWith(".csv") ? filename : filename + ".csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    global.USIAMS.toast.show("success", "Export complete", `${filename} has been downloaded.`);
  }

  function avatarColorFromString(str) {
    const palette = ["#2f6fd6", "#1a8b5e", "#c9a227", "#b5790a", "#8b5cf6", "#c0362c", "#0891b2"];
    let hash = 0;
    for (let i = 0; i < String(str).length; i++) hash = String(str).charCodeAt(i) + ((hash << 5) - hash);
    return palette[Math.abs(hash) % palette.length];
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
  }

  function validatePhone(phone) {
    return /^(\+?255|0)[67]\d{8}$/.test(String(phone || "").replace(/\s/g, ""));
  }

  function uid(prefix = "id") {
    return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e5).toString(36)}`;
  }

  // ---- Status timeline ------------------------------------------------------
  // The history list on a request or complaint: one entry per status change.
  function timelineHtml(timeline) {
    const tone = status => status === "REJECTED" ? "rej" : status === "RESOLVED" || status === "CLOSED" ? "done" : "warn";
    return `<ul class="usi-timeline">${(timeline || []).map(t => `<li><span class="tl-dot ${tone(t.status)}"></span>
      <div class="tl-title">${titleCase(t.status)}</div><div class="tl-meta">${formatDateTime(t.date)} - ${escapeHtml(t.note)}</div></li>`).join("")}</ul>`;
  }

  // ---- Student picker -------------------------------------------------------
  // Pages about one student (results, registration, attendance, graduation)
  // show staff a #studentSelector of students; a student sees only their own
  // record and no picker. Returns the student to show first; onChange gets
  // the id whenever staff pick another.
  function studentPicker(user, { include = () => true, onChange } = {}) {
    const wrap = global.document.getElementById("studentSelectorWrap");
    if (user.role === "STUDENT") {
      if (wrap) wrap.classList.add("d-none");
      return user.studentId;
    }
    if (wrap) wrap.classList.remove("d-none");
    const select = global.document.getElementById("studentSelector");
    select.innerHTML = (global.USIAMS.data.students || []).filter(include)
      .map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.regNumber)}</option>`).join("");
    if (onChange) select.addEventListener("change", () => onChange(select.value));
    return select.value;
  }

  // ---- Private values (GPA) --------------------------------------------
  // A .private-value button blurs its content until the user clicks it;
  // the next click blurs it again. Always hidden when a page loads, so a
  // GPA is not on show to anyone looking at the screen.
  function privateValue(contentHtml, label = "value") {
    return `<button type="button" class="private-value" aria-pressed="false" data-private-label="${escapeHtml(label)}"
      aria-label="Show ${escapeHtml(label)}" title="Click to show"><span class="private-content" aria-hidden="true">${contentHtml}</span><i class="bi bi-eye private-eye" aria-hidden="true"></i></button>`;
  }

  function togglePrivateValue(button) {
    const revealed = button.classList.toggle("is-revealed");
    const label = button.dataset.privateLabel || "value";
    button.setAttribute("aria-pressed", String(revealed));
    button.setAttribute("aria-label", `${revealed ? "Hide" : "Show"} ${label}`);
    button.title = revealed ? "Click to hide" : "Click to show";
    const content = button.querySelector(".private-content");
    if (content) content.setAttribute("aria-hidden", String(!revealed));
    const eye = button.querySelector(".private-eye");
    if (eye) eye.className = `bi ${revealed ? "bi-eye-slash" : "bi-eye"} private-eye`;
  }

  // Buttons say what they do with data-ui-action (print, back, reload) or
  // data-ui-click="#id" (click another element, e.g. a hidden file input)
  // instead of onclick="...": the Content-Security-Policy forbids inline
  // script, so an injected onclick attribute can never run.
  const UI_ACTIONS = {
    print: () => global.print(),
    back: () => global.history.back(),
    reload: () => global.location.reload()
  };

  if (global.document) {
    global.document.addEventListener("click", event => {
      if (!event.target.closest) return;
      const button = event.target.closest(".private-value");
      if (button) togglePrivateValue(button);
      const action = event.target.closest("[data-ui-action]");
      if (action && UI_ACTIONS[action.dataset.uiAction]) UI_ACTIONS[action.dataset.uiAction]();
      const proxy = event.target.closest("[data-ui-click]");
      if (proxy) {
        const target = global.document.querySelector(proxy.dataset.uiClick);
        if (target) target.click();
      }
    });
  }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.util = {
    escapeHtml, formatCurrency, formatDate, formatDateTime, timeAgo, initials,
    debounce, slugify, titleCase, paginate, downloadCsv, avatarColorFromString,
    validateEmail, validatePhone, uid, canViewStudentNames, studentLabel, privateValue, studentPicker, timelineHtml
  };

})(window);

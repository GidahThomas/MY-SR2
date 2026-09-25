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

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.util = {
    escapeHtml, formatCurrency, formatDate, formatDateTime, timeAgo, initials,
    debounce, slugify, titleCase, paginate, downloadCsv, avatarColorFromString,
    validateEmail, validatePhone, uid, canViewStudentNames, studentLabel
  };

})(window);

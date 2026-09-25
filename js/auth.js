/* =========================================================
   USIAMS - js/auth.js
   Frontend session handling and role-aware navigation.

   *** WHERE THE SECURITY BOUNDARY ACTUALLY IS ***
   Nothing in this file is a security control. The role held in
   localStorage only decides what the browser draws; a user who
   edits it changes what they see, never what they may do.

   Authorisation is enforced on the server:
     - the token issued by POST /api/auth/login maps to a session
       held in server memory, and the role on THAT session is the
       one every request is checked against,
     - db/resources.js declares who may read and write each
       resource, and server.js re-checks it on every call,
     - students are scoped to their own records in the SQL query
       itself, so another student's data is never sent,
     - the Quality Assurance Officer is refused every write with
       HTTP 403 before the resource rules are even consulted.

   USIAMS.boot() also refreshes the cached session from the server
   on each page load, so a tampered localStorage role is corrected
   rather than trusted.
   ========================================================= */
(function (global) {
  "use strict";

  const { storage, toast } = global.USIAMS;
  const SESSION_KEY = "session.currentUser";
  const TOKEN_KEY = "session.token";
  const ROLE_PAGE_ALLOWLIST = {
    LIBRARIAN: ["library.html", "notifications.html", "settings.html"],
    HOSTEL_OFFICER: ["hostel.html", "notifications.html", "settings.html"]
  };

  async function login(username, password, remember) {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const result = await response.json();
      if (!response.ok || !result.success) return result;
      storage.setStorage(TOKEN_KEY, result.token);
      storage.setStorage(SESSION_KEY, { ...result.user, loginAt: new Date().toISOString(), remember: !!remember });
      return { success: true, user: storage.getStorage(SESSION_KEY) };
    } catch (error) {
      return { success: false, message: "The backend is unavailable. Start USIAMS with `npm start` and try again." };
    }
  }

  async function logout() {
    const token = storage.getStorage(TOKEN_KEY, null);
    if (token) {
      try { await fetch("/api/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${token}` } }); }
      catch (error) { console.warn("USIAMS logout request failed", error); }
    }
    storage.removeStorage(TOKEN_KEY);
    storage.removeStorage(SESSION_KEY);
    window.location.href = getBasePath() + "login.html";
  }

  function getCurrentUser() {
    return storage.getStorage(SESSION_KEY, null);
  }

  function isAuthenticated() {
    return !!getCurrentUser();
  }

  // Resolves the relative path back to the project root. Deliberately does
  // NOT depend on the project's folder being literally named "myUniversity"
  // in the URL - that breaks whenever the site is served from a different
  // root (a local static server, a different deployment path, etc.). Every
  // authenticated page lives either at the project root or exactly one
  // level down inside /pages/, so a simple marker check is sufficient and
  // robust.
  function getBasePath() {
    const path = window.location.pathname.replace(/\\/g, "/");
    return /\/pages\//.test(path) ? "../" : "./";
  }

  /**
   * Call at the top of every authenticated page. Redirects to login if
   * no session exists, and optionally restricts the page to a set of roles.
   */
  function requireAuth(allowedRoles) {
    const user = getCurrentUser();
    if (!user) {
      window.location.href = getBasePath() + "login.html";
      return null;
    }
    if (allowedRoles && allowedRoles.length && !allowedRoles.includes(user.role)) {
      window.location.href = getBasePath() + "pages/403.html";
      return null;
    }
    const restrictedPages = ROLE_PAGE_ALLOWLIST[user.role];
    const currentPage = window.location.pathname.replace(/\\/g, "/").split("/").pop();
    if (restrictedPages && !restrictedPages.includes(currentPage)) {
      window.location.href = getBasePath() + "pages/403.html";
      return null;
    }
    return user;
  }

  // ---- Read-only (QA) presentation ------------------------------------
  // Hides and disables controls the user could not use anyway. The refusal
  // itself comes from the server: see canWrite() in server.js, which returns
  // HTTP 403 for every read-only role regardless of what the browser sends.
  function isReadOnlyRole(role) {
    const r = role || (getCurrentUser() || {}).role;
    return r === "QUALITY_ASSURANCE_OFFICER";
  }

  function guardWrite(actionLabel = "modify this record") {
    if (isReadOnlyRole()) {
      toast.show("error", "Access denied", `Quality Assurance Officer has read-only access and cannot ${actionLabel}.`);
      return false;
    }
    return true;
  }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.auth = { login, logout, getCurrentUser, isAuthenticated, requireAuth, isReadOnlyRole, guardWrite, getBasePath };

})(window);

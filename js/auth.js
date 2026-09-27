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
    LIBRARIAN: ["library.html", "notifications.html", "settings.html", "help.html"],
    HOSTEL_OFFICER: ["hostel.html", "notifications.html", "settings.html", "help.html"]
  };

  // The pages call the API with relative paths, so they only reach it when
  // served by server.js itself. Say which of the two usual mistakes applies.
  function unavailableMessage() {
    if (window.location.protocol === "file:") {
      return "USIAMS was opened as a file, so it cannot reach its backend. Run `npm start` and open the address it prints (for example http://127.0.0.1:8081).";
    }
    return "The USIAMS backend is not answering at " + window.location.origin +
      ". Run `npm start` and open the address it prints - not Live Server or another static server.";
  }

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
      return { success: false, message: unavailableMessage() };
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

  /** Asks before signing out; the navbar menu and the sidebar both use it. */
  function confirmLogout() {
    global.USIAMS.modal.confirm({
      title: "Sign out of USIAMS",
      message: "Are you sure you want to end your session and sign out?",
      confirmText: "Sign Out",
      variant: "primary",
      onConfirm: logout
    });
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
   * The page to continue to after signing in, from login.html?next=...
   * Only an app page (pages/<name>.html) is accepted, so the parameter
   * cannot send anyone off-site. Given a role, the page must also be one
   * that role has in its menu: the home page links "Pay fees" and
   * "Library" to everyone, and a lecturer who follows one should land on
   * their dashboard, not on Access Denied.
   */
  function safeNext(role) {
    const next = new URLSearchParams(window.location.search).get("next") || "";
    if (!/^pages\/[a-z0-9-]+\.html$/.test(next)) return null;
    if (!role || !global.USIAMS.navigation) return next;
    return global.USIAMS.navigation.menuForRole(role).some(item => item.href === next) ? next : null;
  }

  /**
   * Call at the top of every authenticated page. Redirects to login if
   * no session exists, and optionally restricts the page to a set of roles.
   */
  function requireAuth(allowedRoles) {
    const user = getCurrentUser();
    if (!user) {
      // Come back to this page after signing in.
      const path = window.location.pathname.replace(/\\/g, "/");
      const next = /\/pages\//.test(path) ? "?next=" + encodeURIComponent("pages/" + path.split("/").pop()) : "";
      window.location.href = getBasePath() + "login.html" + next;
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
  global.USIAMS.auth = { login, logout, confirmLogout, getCurrentUser, isAuthenticated, requireAuth, isReadOnlyRole, guardWrite, getBasePath, unavailableMessage, safeNext };

})(window);

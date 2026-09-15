/* =========================================================
   USIAMS - js/auth.js
   Frontend authentication + role simulation.

   *** IMPORTANT - READ BEFORE REUSING THIS PATTERN ***
   Everything in this file is a CLIENT-SIDE SIMULATION for this
   HTML/CSS/JS prototype only. It is convenient for demoing role
   based navigation and read-only behaviour, but it is NOT a
   security boundary: any user can open devtools and edit
   localStorage to change their simulated role.

   When this prototype is rebuilt on Yii2 + MySQL, the backend
   MUST:
     - authenticate the user and issue a server-side session or
       signed token,
     - re-check the user's role/permissions on every single
       request (never trust a role sent from the browser),
     - return HTTP 403 Forbidden for any unauthorized action,
       especially for Quality Assurance Officer accounts which
       must be enforced as strictly read-only server-side.
   ========================================================= */
(function (global) {
  "use strict";

  const { storage, toast } = global.USIAMS;
  const SESSION_KEY = "session.currentUser";

  function login(username, password, remember) {
    const account = global.USIAMS.users.findByUsername(username);
    if (!account || account.password !== password) {
      return { success: false, message: "Invalid username or password. Please check your credentials and try again." };
    }
    if (account.status !== "Active") {
      return { success: false, message: "This account has been deactivated. Please contact the System Admin." };
    }
    const session = {
      id: account.id,
      username: account.username,
      name: account.name,
      email: account.email,
      role: account.role,
      roleLabel: global.USIAMS.users.roleLabel(account.role),
      departmentId: account.departmentId || null,
      unitId: account.unitId || null,
      studentId: account.studentId || null,
      loginAt: new Date().toISOString(),
      remember: !!remember
    };
    storage.setStorage(SESSION_KEY, session);
    return { success: true, user: session };
  }

  function logout() {
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
    return user;
  }

  // ---- Read-only (QA) enforcement -------------------------------------
  // Frontend protection is demonstration only. The real Yii2 backend must
  // enforce this with proper authorization and HTTP 403 responses.
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

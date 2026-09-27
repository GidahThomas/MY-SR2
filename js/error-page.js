/* =========================================================
   USIAMS - js/error-page.js
   The 403, 404 and 500 pages: points "Go to Dashboard" at the
   signed-in user's dashboard, or at sign-in when nobody is.
   ========================================================= */
(function (global) {
  "use strict";

  const link = document.getElementById("dashboardLink");
  if (!link) return;
  const user = global.USIAMS.auth.getCurrentUser();
  link.href = user ? global.USIAMS.navigation.dashboardHrefFor(user.role) : global.USIAMS.auth.getBasePath() + "login.html";

})(window);

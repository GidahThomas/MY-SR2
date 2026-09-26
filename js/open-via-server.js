/* =========================================================
   USIAMS - js/open-via-server.js
   The pages call the API with relative paths (/api/...), so they only
   work when served by server.js. When a public page is opened straight
   from disk (file://...), look for a running USIAMS server on the usual
   ports and reopen the same page there. If none answers, say how to
   start one.
   ========================================================= */
(function () {
  "use strict";

  if (window.location.protocol !== "file:") return;

  // PORT in .env / the environment decides the port; 8081 is this
  // machine's setting and 3000 is the default in config.js.
  const PORTS = [8081, 3000];

  const path = window.location.pathname.replace(/\\/g, "/");
  const match = path.match(/\/((?:pages\/)?[a-z0-9-]+\.html)$/i);
  const page = match ? match[1] : "index.html";

  function showNotice() {
    const notice = document.createElement("div");
    notice.setAttribute("role", "alert");
    notice.style.cssText = "position:fixed;left:0;right:0;top:0;z-index:99999;padding:12px 16px;" +
      "background:#b91c1c;color:#fff;font:600 14px/1.5 Mulish,system-ui,sans-serif;text-align:center;";
    notice.textContent = "USIAMS is not running. In the project folder run `npm start`, " +
      "then open the address it prints (for example http://127.0.0.1:8081).";
    document.body.prepend(notice);
  }

  (async function () {
    for (const port of PORTS) {
      const origin = "http://127.0.0.1:" + port;
      try {
        // An opaque (no-cors) response is enough: it only resolves when
        // something is listening on that port.
        await fetch(origin + "/api/health", { mode: "no-cors", cache: "no-store" });
        window.location.replace(origin + "/" + page + window.location.search + window.location.hash);
        return;
      } catch (error) {
        // Nothing on this port; try the next.
      }
    }
    if (document.body) showNotice();
    else document.addEventListener("DOMContentLoaded", showNotice);
  })();
})();

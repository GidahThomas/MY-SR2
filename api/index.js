/* =========================================================
   USIAMS - api/index.js
   Entry point on Vercel. vercel.json sends every request here, pages
   and files included, so they get the same security headers, access
   rules and compression as under `npm start`.
   ========================================================= */
module.exports = require("../server").vercelHandler;

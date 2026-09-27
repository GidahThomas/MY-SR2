/* =========================================================
   USIAMS - page-includes.js
   The stylesheets and scripts every application page loads, listed
   once. A page marks where they go:

     <!-- include: app-styles -->           the stylesheet links
     <!-- include: app-scripts -->          the shared scripts, in order
     <!-- include: app-scripts charts -->   the same, plus Chart.js
     <!-- include: app-shell-start -->      the sidebar, navbar and the
     <!-- include: app-shell-end -->        <main> the page's content goes in

   The public home page also uses the site-* markers, which fill in the
   institution's details from config.js (UNIVERSITY_NAME, CONTACT_EMAIL...
   in .env) and the link-preview tags social media and WhatsApp read.

   and server.js replaces each marker as it sends the page. Before this
   every page repeated the same ~57 lines, so adding a script meant
   editing 38 files - and missing one.

   Paths are written from the project root; the "../" a page in pages/
   needs is added here.
   ========================================================= */
const fs = require("node:fs");
const path = require("node:path");
const { config } = require("./config");

const APP_STYLES = [
  "assets/vendor/bootstrap/bootstrap.min.css",
  "assets/vendor/bootstrap-icons/bootstrap-icons.css",
  "css/style.css", "css/components.css", "css/dashboard.css", "css/responsive.css", "css/print.css"
];

// Order matters: storage and the API bridge first, then shared rules and
// the data files (each builds on the ones before it), then the services
// and components the page modules use, then the app shell.
const APP_SCRIPTS = [
  "assets/vendor/bootstrap/bootstrap.bundle.min.js",
  "js/storage.js", "js/api.js", "js/ui.js", "components/toast.js", "components/modal.js",
  "data/shared.js", "data/grading-system.js", "data/academic-structure.js", "data/courses.js", "data/users.js",
  "data/students.js", "data/results.js", "data/registrations.js", "data/finance.js", "data/attendance.js",
  "data/timetable.js", "data/requests.js", "data/complaints.js", "data/notifications.js", "data/calendar.js",
  "data/announcements.js", "data/documents.js", "data/internship.js", "data/graduation.js", "data/alumni.js",
  "data/library.js", "data/hostel.js", "data/elearning.js", "data/admissions.js", "data/qa-flags.js",
  "data/audit-logs.js",
  "js/gpa.js", "js/auth.js", "js/navigation.js", "js/search.js", "js/notifications.js", "js/qa.js",
  "js/charts.js", "js/library.js", "js/hostel.js", "js/elearning.js", "js/admissions.js", "js/announcements.js",
  "components/table.js", "components/cards.js", "components/sidebar.js", "components/navbar.js",
  "js/app.js"
];
const CHART_LIBRARY = "assets/vendor/chart.js/chart.umd.min.js";

// The application frame: js/app.js fills the sidebar and navbar.
const APP_SHELL_START = [
  '<div class="app-shell" id="appShell">',
  '  <aside class="app-sidebar" id="sidebarContainer"></aside>',
  '  <div class="app-main">',
  '    <header class="app-navbar" id="navbarContainer"></header>',
  '    <main class="app-content">'
].join("\n");
const APP_SHELL_END = ["    </main>", "  </div>", "</div>"].join("\n");

const MARKER = /<!--\s*include:\s*([a-z-]+)((?:\s+[a-z-]+)*)\s*-->/g;

const FAVICON = "assets/icons/favicon.svg";
const TOUCH_ICON = "assets/icons/icon-180.png";
const PREVIEW_IMAGE = "assets/images/og-image.png";

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}

/** A configured image path, only if it points at a file under assets/. */
function assetPath(value) {
  return /^assets\/[\w\-./]+$/.test(value) && !value.includes("..") ? value : "";
}

// Link previews need absolute addresses; PUBLIC_URL gives the real one.
function siteUrl() {
  return config.publicUrl || `${config.tls.certFile ? "https" : "http"}://${config.host}:${config.port}`;
}

/** "2026-06-01" -> "1 June 2026"; anything unparseable is shown as given. */
function formatDate(value) {
  const date = new Date(value + "T00:00:00");
  return Number.isNaN(date.getTime()) ? value
    : date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function renderSite(name, base, html) {
  const site = config.site;
  if (name === "site-meta") {
    const title = (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || "USIAMS";
    const description = (html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) || [])[1] || "";
    const url = siteUrl();
    return [
      `<meta property="og:type" content="website">`,
      `<meta property="og:site_name" content="${escapeHtml(site.universityName || "USIAMS")}">`,
      `<meta property="og:title" content="${title}">`,
      `<meta property="og:description" content="${description}">`,
      `<meta property="og:url" content="${escapeHtml(url)}/">`,
      `<meta property="og:image" content="${escapeHtml(url)}/${PREVIEW_IMAGE}">`,
      `<meta property="og:image:width" content="1200">`,
      `<meta property="og:image:height" content="630">`,
      `<meta name="twitter:card" content="summary_large_image">`
    ].join("\n");
  }
  if (name === "site-brand") {
    const logo = assetPath(site.logo);
    return logo
      ? `<img class="brand-logo" src="${base}${logo}" alt="">`
      : `<span class="brand-mark">US</span>`;
  }
  if (name === "site-tagline") return escapeHtml(site.universityName || "University academic services");
  if (name === "site-owner") return escapeHtml(site.universityName || "USIAMS");
  if (name === "site-contact") {
    const items = [];
    if (site.contactEmail) {
      items.push(`<li><i class="bi bi-envelope"></i><a href="mailto:${escapeHtml(site.contactEmail)}">${escapeHtml(site.contactEmail)}</a></li>`);
    }
    if (site.contactPhone) {
      items.push(`<li><i class="bi bi-telephone"></i><a href="tel:${escapeHtml(site.contactPhone.replace(/[^\d+]/g, ""))}">${escapeHtml(site.contactPhone)}</a></li>`);
    }
    if (site.website) {
      const href = /^https?:\/\//i.test(site.website) ? site.website : `https://${site.website}`;
      const label = site.website.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
      items.push(`<li><i class="bi bi-globe"></i><a href="${escapeHtml(href)}" rel="noopener">${escapeHtml(label)}</a></li>`);
    }
    if (site.address) items.push(`<li><i class="bi bi-geo-alt"></i>${escapeHtml(site.address)}</li>`);
    if (site.officeHours) items.push(`<li><i class="bi bi-clock"></i>${escapeHtml(site.officeHours)}</li>`);
    return items.join("\n");
  }
  if (name === "site-campus-photo") {
    const photo = assetPath(site.campusPhoto);
    return photo
      ? `<img class="campus-photo" src="${base}${photo}" alt="${escapeHtml(site.universityName || "University")} campus" loading="lazy">`
      : "";
  }
  if (name === "site-admission-window") {
    if (!site.admissionOpens && !site.admissionCloses) return "";
    const parts = [];
    if (site.admissionOpens) parts.push(`opens <strong>${escapeHtml(formatDate(site.admissionOpens))}</strong>`);
    if (site.admissionCloses) parts.push(`closes <strong>${escapeHtml(formatDate(site.admissionCloses))}</strong>`);
    return `<p class="admission-window"><i class="bi bi-calendar-check"></i><span>The application window ${parts.join(" and ")}.</span></p>`;
  }
  return null;
}

function render(name, options, base, html) {
  const site = renderSite(name, base, html);
  if (site !== null) return site;
  if (name === "app-styles") {
    return APP_STYLES.map(href => `<link rel="stylesheet" href="${base}${href}">`).join("\n");
  }
  if (name === "app-scripts") {
    const scripts = [...APP_SCRIPTS];
    // Chart.js must load before js/charts.js, which configures it.
    if (options.includes("charts")) scripts.splice(1, 0, CHART_LIBRARY);
    return scripts.map(src => `<script src="${base}${src}"></script>`).join("\n");
  }
  if (name === "app-shell-start") return APP_SHELL_START;
  if (name === "app-shell-end") return APP_SHELL_END;
  throw new Error(`Unknown page include "${name}".`);
}

/**
 * Replaces the include markers in a page's HTML, and gives every page the
 * site icon so browsers stop asking for a /favicon.ico that is not there.
 */
function expand(html, base) {
  let out = html.replace(MARKER, (_, name, options) => render(name, options.trim().split(/\s+/).filter(Boolean), base, html));
  if (!/rel="icon"/i.test(out)) {
    out = out.replace(/<head>/i, `<head>\n  <link rel="icon" type="image/svg+xml" href="${base}${FAVICON}">` +
      `\n  <link rel="apple-touch-icon" href="${base}${TOUCH_ICON}">`);
  }
  return out;
}

// Expanded pages are kept until the file changes.
const cache = new Map();

/** The HTML to send for a page file under root. */
function pageHtml(filePath, root) {
  const stat = fs.statSync(filePath);
  const cached = cache.get(filePath);
  if (cached && cached.mtimeMs === stat.mtimeMs) return cached.html;
  const depth = path.relative(root, path.dirname(filePath)).split(path.sep).filter(Boolean).length;
  const html = expand(fs.readFileSync(filePath, "utf8"), "../".repeat(depth));
  cache.set(filePath, { mtimeMs: stat.mtimeMs, html });
  return html;
}

module.exports = { APP_STYLES, APP_SCRIPTS, APP_SHELL_START, APP_SHELL_END, expand, pageHtml };

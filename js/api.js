/* =========================================================
   USIAMS - js/api.js
   The frontend's data layer. Everything the application shows now
   comes from the MySQL database through the REST API instead of
   the generated data/*.js files and localStorage.

   HOW THIS REPLACES THE PROTOTYPE STORAGE WITHOUT REWRITING EVERY MODULE
   The page modules all reach their data through exactly two shapes:

     USIAMS.storage.ensureSeed(KEY, () => USIAMS.data.seedThing)  // read all
     USIAMS.storage.setStorage(KEY, list)                          // write all
     USIAMS.storage.createOverlay(name, () => USIAMS.data.seedThing)

   So rather than editing forty modules, this file replaces those
   three functions with resource-aware versions. When a key maps to
   an API resource (see RESOURCE_BY_KEY) reads are served from a
   cache hydrated at page load, and writes are diffed against that
   cache and sent to the server as POST/PATCH/DELETE. Keys that are
   genuinely browser-local - theme, sidebar state, preferences -
   fall through to the original localStorage implementation.

   Reads stay synchronous because the cache is fully populated by
   USIAMS.boot() before any page module runs.
   ========================================================= */
(function (global) {
  "use strict";

  const USIAMS = global.USIAMS = global.USIAMS || {};
  const TOKEN_KEY = "session.token";

  // Storage key / overlay name -> API resource name.
  const RESOURCE_BY_KEY = {
    academicYears: "academicYears",
    admissionApplications: "applications",
    announcements: "announcements",
    auditLogs: "auditLogs",
    classCheckins: "classCheckins",
    complaints: "complaints",
    courses: "courses",
    departments: "departments",
    documents: "documents",
    elearningAssignments: "assignments",
    elearningMaterials: "materials",
    elearningSubmissions: "submissions",
    graduation: "graduation",
    hostelAllocations: "hostelAllocations",
    internships: "internships",
    libraryLoans: "loans",
    notifications: "notifications",
    orgUnits: "orgUnits",
    payments: "payments",
    programmes: "programmes",
    qaFlags: "qaFlags",
    registrations: "registrations",
    requests: "requests",
    semesters: "semesters",
    students: "students",
    users: "users"
  };

  // Resource name -> the USIAMS.data property the modules read.
  // Mirrors BOOTSTRAP_ALIASES in server.js.
  const DATA_ALIAS = {
    attendanceSummary: "attendance", books: "seedBooks", loans: "seedLoans",
    requests: "seedRequests", complaints: "seedComplaints", announcements: "seedAnnouncements",
    notifications: "seedNotifications", documents: "seedDocuments", hostels: "seedHostels",
    hostelRooms: "seedRooms", hostelAllocations: "seedAllocations", internships: "seedInternships",
    graduation: "seedGraduation", materials: "seedMaterials", assignments: "seedAssignments",
    submissions: "seedSubmissions", applications: "seedApplications", auditLogs: "seedAuditLogs",
    registrations: "seedRegistrations", calendar: "academicCalendar", holidays: "publicHolidays"
  };

  /** resource name -> the live array the app reads and writes. */
  const cache = new Map();
  const pendingWrites = new Set();
  let hydrated = false;

  // ---- Low level HTTP ------------------------------------------------
  function token() {
    try { return JSON.parse(localStorage.getItem("usiams." + TOKEN_KEY)); }
    catch { return null; }
  }

  function basePath() {
    return /\/pages\//.test(global.location.pathname.replace(/\\/g, "/")) ? "../" : "./";
  }

  async function request(path, { method = "GET", body } = {}) {
    const response = await fetch(path, {
      method,
      headers: {
        ...(token() ? { Authorization: "Bearer " + token() } : {}),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {})
      },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    // An expired or revoked session must send the user back to sign in
    // rather than leaving a half-rendered page behind.
    if (response.status === 401) {
      localStorage.removeItem("usiams." + TOKEN_KEY);
      localStorage.removeItem("usiams.session.currentUser");
      global.location.href = basePath() + "login.html";
      throw new Error("Session expired.");
    }
    let result = null;
    try { result = await response.json(); } catch { /* empty body */ }
    if (!response.ok || (result && result.success === false)) {
      const error = new Error((result && result.message) || "Request failed (" + response.status + ").");
      error.status = response.status;
      throw error;
    }
    return result;
  }

  function notifyError(error) {
    const message = error && error.message ? error.message : "The server rejected that change.";
    if (USIAMS.toast) USIAMS.toast.show("error", "Not saved", message);
    else console.error("USIAMS:", message);
  }

  /** One promise chain per resource, so its writes stay in order. */
  const writeQueues = new Map();

  /**
   * Queues a write and keeps a handle on it so callers (and tests) can wait
   * for every pending change to settle. Failures surface as a toast and
   * resync that resource, so the screen never keeps a change the server
   * refused.
   *
   * Writes to the same resource run one after another rather than in
   * parallel. The page modules act on the cache immediately and let the
   * request follow, so borrowing a book and returning it in quick
   * succession would otherwise race: the PATCH could reach the server
   * before the POST that creates the row, and the update would 404.
   */
  function track(resource, run) {
    const previous = writeQueues.get(resource) || Promise.resolve();
    const tracked = previous
      .then(() => (typeof run === "function" ? run() : run))
      .catch(async error => {
        notifyError(error);
        try { await reload(resource); } catch { /* the reload error is secondary */ }
      })
      .finally(() => {
        pendingWrites.delete(tracked);
        if (writeQueues.get(resource) === tracked) writeQueues.delete(resource);
      });
    writeQueues.set(resource, tracked);
    pendingWrites.add(tracked);
    return tracked;
  }

  /** Resolves once every queued write has settled. */
  async function flush() {
    // A write can queue another, so keep draining until the set is empty.
    while (pendingWrites.size) {
      await Promise.all([...pendingWrites]);
    }
  }

  // ---- Cache ---------------------------------------------------------
  function listOf(resource) {
    if (!cache.has(resource)) cache.set(resource, []);
    return cache.get(resource);
  }

  /** Replaces a cached list in place so existing references stay valid. */
  function setList(resource, rows) {
    const list = listOf(resource);
    list.length = 0;
    list.push(...(rows || []));
    const alias = DATA_ALIAS[resource] || resource;
    USIAMS.data = USIAMS.data || {};
    USIAMS.data[alias] = list;
    return list;
  }

  async function reload(resource) {
    const result = await request("/api/data/" + resource);
    return setList(resource, result.data);
  }

  // ---- Hydration -----------------------------------------------------
  async function hydrate() {
    const result = await request("/api/bootstrap");
    // The payload is keyed by the alias the modules already use; map it
    // back to resource names so the caches and USIAMS.data share arrays.
    const resourceByAlias = {};
    for (const [resource, alias] of Object.entries(DATA_ALIAS)) resourceByAlias[alias] = resource;
    for (const [alias, rows] of Object.entries(result.data)) {
      setList(resourceByAlias[alias] || alias, rows);
    }
    // Datasets this role may not read are emptied rather than left holding
    // whatever the bundled data/*.js file generated. Without this a student
    // session would still carry the seed copy of the staff-only registers in
    // memory, and any stray render would show demo data as if it were real.
    for (const resource of result.withheld || []) setList(resource, []);
    preferences = result.preferences || {};
    systemSettings = result.systemSettings || {};
    hydrated = true;
    return result;
  }

  // ---- Uploaded files -------------------------------------------------------
  // Files are stored in the database (POST /api/files); records keep the
  // returned download URL. Downloads need the session token, so they are
  // fetched and handed to the browser as a blob.
  const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

  function readAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
      reader.onerror = () => reject(new Error("The file could not be read."));
      reader.readAsDataURL(file);
    });
  }

  async function uploadFile(file, purpose) {
    if (!file) throw new Error("Choose a file to upload.");
    if (file.size > MAX_UPLOAD_BYTES) throw new Error(`${file.name} is larger than 5 MB.`);
    const data = await readAsBase64(file);
    const result = await request("/api/files", {
      method: "POST", body: { name: file.name, type: file.type, purpose, data }
    });
    return result.data; // { id, name, mimeType, size, url }
  }

  async function downloadFile(url, fallbackName) {
    const response = await fetch(url, { headers: token() ? { Authorization: "Bearer " + token() } : {} });
    if (!response.ok) {
      let message = "The file could not be downloaded.";
      try { message = (await response.json()).message || message; } catch { /* not JSON */ }
      throw new Error(message);
    }
    const disposition = response.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename\*=UTF-8''([^;]+)/);
    const name = match ? decodeURIComponent(match[1]) : (fallbackName || "download");
    const blobUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = blobUrl; link.download = name;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  }

  /** True for a URL of a file stored in the database. */
  function isStoredFile(url) { return /^\/api\/files\/[A-Z0-9-]+$/.test(String(url || "")); }

  // Any link marked data-action="download-attachment" (request and complaint
  // attachments, assignment submissions...) downloads its stored file.
  if (global.document) {
    global.document.addEventListener("click", event => {
      const link = event.target.closest && event.target.closest("[data-action='download-attachment']");
      if (!link) return;
      event.preventDefault();
      downloadFile(link.dataset.url, link.dataset.name).catch(error => {
        if (USIAMS.toast) USIAMS.toast.show("error", "Download failed", error.message);
      });
    });
  }

  // ---- Preferences and system settings -----------------------------------
  // Held in the database (user_preferences / system_settings), loaded with
  // the bootstrap and read synchronously from these copies.
  let preferences = {};
  let systemSettings = {};

  function getPreference(key, fallback = null) {
    return Object.prototype.hasOwnProperty.call(preferences, key) ? preferences[key] : fallback;
  }

  /** Saves one of the signed-in user's preferences to the database. */
  function savePreference(key, value) {
    preferences[key] = value;
    return request("/api/me/preferences", { method: "PUT", body: { [key]: value } })
      .catch(error => { notifyError(error); throw error; });
  }

  function saveSystemSettings(value) {
    const changed = {};
    for (const [key, v] of Object.entries(value || {})) if (JSON.stringify(systemSettings[key]) !== JSON.stringify(v)) changed[key] = v;
    Object.assign(systemSettings, value);
    if (!Object.keys(changed).length) return Promise.resolve(systemSettings);
    return request("/api/settings/system", { method: "PUT", body: changed })
      .then(result => { systemSettings = result.data; return systemSettings; })
      .catch(error => { notifyError(error); throw error; });
  }

  // Keys pages still read and write through USIAMS.storage that belong in
  // the database but are not list resources.
  const BYLAWS_KEY = /^bylawsAcknowledged\.(.+)$/;
  function bridgedGet(key, fallback) {
    if (key === "preferences") return { ...(fallback || {}), ...getPreference("notifications", {}) };
    if (key === "systemSettings") return { ...(fallback || {}), ...systemSettings };
    const bylaws = key.match(BYLAWS_KEY);
    if (bylaws) {
      const student = listOf("students").find(s => s.id === bylaws[1]);
      return student ? !!student.bylawsAcknowledgedAt : fallback;
    }
    return undefined;
  }
  function bridgedSet(key, value) {
    if (key === "preferences") { savePreference("notifications", value); return true; }
    if (key === "systemSettings") { saveSystemSettings(value); return true; }
    const bylaws = key.match(BYLAWS_KEY);
    if (bylaws) {
      const stamp = value ? new Date().toISOString().slice(0, 19).replace("T", " ") : null;
      apiStore("students").update(bylaws[1], { bylawsAcknowledgedAt: stamp });
      return true;
    }
    return undefined;
  }

  // ---- Write-through -------------------------------------------------
  function sameRecord(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  /**
   * Compares a list the caller just handed us against the cached copy and
   * issues the matching REST calls. This is what lets an unmodified module
   * keep calling setStorage(KEY, wholeList) and still persist to MySQL.
   */
  function syncList(resource, nextList) {
    const previous = listOf(resource);
    const previousById = new Map(previous.map(item => [String(item.id), item]));
    const nextById = new Map((nextList || []).map(item => [String(item.id), item]));

    // Each request is queued as a function, not started here: track() runs
    // them one at a time so a create always precedes the update that
    // follows it.
    for (const [id, item] of nextById) {
      const before = previousById.get(id);
      if (!before) {
        track(resource, () => request("/api/data/" + resource, { method: "POST", body: item })
          .then(result => {
            // The server mints the authoritative id; adopt it locally.
            if (result && result.data) Object.assign(item, result.data);
          }));
      } else if (!sameRecord(before, item)) {
        track(resource, () => request("/api/data/" + resource + "/" + encodeURIComponent(item.id), { method: "PATCH", body: item }));
      }
    }
    for (const [id] of previousById) {
      if (!nextById.has(id)) {
        track(resource, () => request("/api/data/" + resource + "/" + encodeURIComponent(id), { method: "DELETE" }));
      }
    }
    setList(resource, nextList);
    return true;
  }

  /** createOverlay-compatible store backed by the API. */
  function apiStore(resource) {
    return {
      getAll() { return listOf(resource).slice(); },
      add(item) {
        const list = listOf(resource);
        list.push(item);
        track(resource, () => request("/api/data/" + resource, { method: "POST", body: item })
          .then(result => { if (result && result.data) Object.assign(item, result.data); }));
        return item;
      },
      update(id, patch) {
        const list = listOf(resource);
        const index = list.findIndex(item => String(item.id) === String(id));
        // Mutate the existing record rather than replacing it, so a create
        // still in flight keeps writing the server's id onto this object.
        const record = index !== -1 ? Object.assign(list[index], patch, { id: list[index].id }) : null;
        // The id is resolved when the request runs, not when it is queued:
        // a record created moments earlier may have been given a different
        // id by the server, and this update has to follow it.
        track(resource, () => request(
          "/api/data/" + resource + "/" + encodeURIComponent(record ? record.id : id),
          { method: "PATCH", body: patch }
        ));
      },
      remove(id) {
        const list = listOf(resource);
        const index = list.findIndex(item => String(item.id) === String(id));
        const removed = index !== -1 ? list[index] : null;
        if (index !== -1) list.splice(index, 1);
        track(resource, () => request(
          "/api/data/" + resource + "/" + encodeURIComponent(removed ? removed.id : id),
          { method: "DELETE" }
        ));
      }
    };
  }

  // ---- Storage interception -----------------------------------------
  function installStorageBridge() {
    const storage = USIAMS.storage;
    if (!storage || storage.__apiBridged) return;
    const localGet = storage.getStorage;
    const localSet = storage.setStorage;

    storage.getStorage = function (key, fallback = null) {
      const resource = RESOURCE_BY_KEY[key];
      if (resource) return listOf(resource).slice();
      const bridged = bridgedGet(key, fallback);
      if (bridged !== undefined) return bridged;
      return localGet.call(storage, key, fallback);
    };

    storage.setStorage = function (key, value) {
      const resource = RESOURCE_BY_KEY[key];
      if (resource && Array.isArray(value)) return syncList(resource, value);
      const bridged = bridgedSet(key, value);
      if (bridged !== undefined) return bridged;
      return localSet.call(storage, key, value);
    };

    storage.ensureSeed = function (key, seedFactory) {
      const resource = RESOURCE_BY_KEY[key];
      if (resource) return listOf(resource).slice();
      const existing = localGet.call(storage, key, null);
      if (existing !== null) return existing;
      const seeded = typeof seedFactory === "function" ? seedFactory() : seedFactory;
      localSet.call(storage, key, seeded);
      return seeded;
    };

    storage.createOverlay = function (name, baseListFn) {
      const resource = RESOURCE_BY_KEY[name];
      if (resource) return apiStore(resource);
      console.warn("USIAMS: '" + name + "' is not a database resource; it stays browser-local.");
      return { getAll: () => (baseListFn ? baseListFn() : []), add: item => item, update() {}, remove() {} };
    };

    storage.__apiBridged = true;
    global.setStorage = storage.setStorage;
    global.getStorage = storage.getStorage;
  }

  // ---- Page bootstrap -------------------------------------------------
  function showFatal(message) {
    document.body.innerHTML =
      '<div style="max-width:640px;margin:15vh auto;padding:2rem;font-family:Mulish,system-ui,sans-serif;text-align:center">' +
      '<h1 style="font-size:1.25rem;margin-bottom:.75rem">USIAMS is unavailable</h1>' +
      '<p style="color:#666;line-height:1.6">' + message + "</p>" +
      '<p style="margin-top:1.5rem"><a href="' + basePath() + 'login.html">Return to sign in</a></p></div>';
  }

  /**
   * Every authenticated page calls this instead of wiring requireAuth and
   * mountShell by hand. It enforces the role check, loads the data the
   * role is allowed to see, mounts the shell, and only then runs the page.
   */
  async function boot(allowedRoles, init) {
    const user = USIAMS.auth.requireAuth(allowedRoles);
    if (!user) return null;

    let current = user;
    try {
      const result = await hydrate();
      // Roles and identity are authoritative on the server; refresh the
      // cached session so a stale localStorage copy cannot widen access.
      if (result && result.user) {
        current = { ...user, ...result.user };
        USIAMS.storage.setStorage("session.currentUser", current);
      }
    } catch (error) {
      // Only a failure to reach the server gets the full-page message -
      // at this point there is genuinely nothing to render.
      console.error("USIAMS bootstrap failed:", error);
      showFatal(
        "The application could not load its data from the server.<br><br>" +
        "<code>" + (error.message || "Unknown error") + "</code><br><br>" +
        "Check that MySQL is running and that USIAMS was started with <code>npm start</code>."
      );
      return null;
    }

    // A page that throws while rendering is a fault in that page, not an
    // outage. The shell stays up so the user can navigate away, and the
    // real error reaches the console rather than being reported as a
    // server problem.
    try {
      USIAMS.app.mountShell(current);
      if (typeof init === "function") await init(current);
    } catch (error) {
      console.error("USIAMS page initialisation failed:", error);
      if (USIAMS.toast) {
        USIAMS.toast.show("error", "This page could not be displayed", error.message || "Unexpected error.");
      }
    }
    return current;
  }

  // Installed as soon as this file loads, not inside boot(). Several modules
  // and data files capture their overlay at IIFE-evaluation time (see
  // data/students.js and js/library.js), so the bridge has to be in place
  // before any of them run. This file therefore loads directly after
  // js/storage.js on every page. The caches are empty until boot() hydrates
  // them, which is safe because those overlays are only read during render.
  installStorageBridge();

  USIAMS.api = {
    request, hydrate, reload, flush, boot, apiStore,
    getPreference, savePreference, getSystemSettings: () => ({ ...systemSettings }), saveSystemSettings,
    files: { upload: uploadFile, download: downloadFile, isStored: isStoredFile, MAX_BYTES: MAX_UPLOAD_BYTES },
    get: path => request(path),
    isHydrated: () => hydrated,
    resourceFor: key => RESOURCE_BY_KEY[key] || null,
    list: resource => listOf(resource).slice(),
    summary: () => request("/api/dashboard/summary")
  };
  USIAMS.boot = boot;

})(window);

/* =========================================================
   USIAMS - js/class-checklist.js
   Today's Classes: the daily timetable checklist.

   Each day a student sees the classes on their timetable for today
   (only the courses they registered for) and marks each one attended
   or missed once it has started. The card keeps them on track:
     - a reminder toast (and, if allowed, a desktop notification)
       15 minutes before each class while the app is open;
     - a warning once the day's classes are over and some are still
       unmarked.
   The server sends the same reminders as notifications even when the
   app is closed (see reminders.js). Marks are stored in the
   class_checkins table through the "classCheckins" API resource.
   ========================================================= */
(function (global) {
  "use strict";

  const RESOURCE = "classCheckins";
  const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const CLASS_MINUTES = 120;
  const REMIND_BEFORE_MINUTES = 15;

  const pad = n => String(n).padStart(2, "0");
  function localDate(now) { return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`; }
  function minutesOf(time) { const [h, m] = String(time).split(":").map(Number); return h * 60 + (m || 0); }
  function clock(minutes) { return `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`; }
  function store() { return global.USIAMS.api.apiStore(RESOURCE); }

  function registeredCourseIds(student) {
    const semester = global.USIAMS.academic.activeSemester();
    const registration = (global.USIAMS.data.seedRegistrations || [])
      .find(r => r.studentId === student.id && semester && r.semesterId === semester.id && r.status !== "Draft");
    return registration ? registration.courseIds : null;
  }

  /** Today's classes for the student, earliest first. */
  function todaysClasses(student, now = new Date()) {
    const day = WEEKDAYS[now.getDay()];
    const registered = registeredCourseIds(student);
    return (global.USIAMS.data.timetable || [])
      .filter(e => e.programmeId === student.programmeId && Number(e.year) === Number(student.year) && e.day === day)
      .filter(e => !registered || registered.includes(e.courseId))
      .sort((a, b) => minutesOf(a.time) - minutesOf(b.time));
  }

  function checkinFor(student, entry, date) {
    return store().getAll().find(c => c.studentId === student.id && c.entryId === entry.id && String(c.date).slice(0, 10) === date);
  }

  function mark(student, entry, status, now = new Date()) {
    const date = localDate(now);
    const existing = checkinFor(student, entry, date);
    if (existing) {
      if (existing.status !== status) store().update(existing.id, { status });
    } else {
      store().add({
        id: global.USIAMS.util.uid("CHK"), studentId: student.id, entryId: entry.id,
        courseId: entry.courseId, date, status
      });
    }
  }

  /** Where the day stands: marked, still to mark, and whether it is over. */
  function progress(student, now = new Date()) {
    const date = localDate(now);
    const classes = todaysClasses(student, now);
    const minutes = now.getHours() * 60 + now.getMinutes();
    const started = classes.filter(e => minutes >= minutesOf(e.time));
    const marked = classes.filter(e => checkinFor(student, e, date));
    const unmarkedStarted = started.filter(e => !checkinFor(student, e, date));
    const dayOver = classes.length > 0 && minutes >= Math.max(...classes.map(e => minutesOf(e.time) + CLASS_MINUTES));
    return { date, classes, marked, unmarkedStarted, dayOver, minutes };
  }

  function stateOf(entry, minutes) {
    const start = minutesOf(entry.time);
    if (minutes < start) return { key: "upcoming", label: start - minutes <= 60 ? `Starts in ${start - minutes} min` : `Starts ${entry.time}` };
    if (minutes < start + CLASS_MINUTES) return { key: "live", label: "In progress" };
    return { key: "ended", label: "Ended" };
  }

  function render(containerId, student, now = new Date()) {
    const el = document.getElementById(containerId);
    if (!el || !student) return;
    const { util } = global.USIAMS;
    const p = progress(student, now);
    const day = WEEKDAYS[now.getDay()];

    if (!p.classes.length) {
      el.innerHTML = `<div class="empty-state"><i class="bi bi-calendar-check"></i>No classes on your timetable today (${day}).</div>`;
      return;
    }

    const done = p.marked.length;
    const total = p.classes.length;
    const pct = Math.round((done / total) * 100);
    const warning = p.dayOver && done < total
      ? `<div class="alert alert-warning py-2 px-3 mb-3" role="alert" style="font-size:.84rem;"><i class="bi bi-exclamation-triangle me-1"></i>
          Today's classes are over and <strong>${total - done}</strong> ${total - done === 1 ? "is" : "are"} not marked yet. Complete today's timetable.</div>`
      : p.unmarkedStarted.length
        ? `<div class="alert alert-info py-2 px-3 mb-3" role="alert" style="font-size:.84rem;"><i class="bi bi-bell me-1"></i>
            ${p.unmarkedStarted.length} class${p.unmarkedStarted.length === 1 ? " has" : "es have"} started - mark ${p.unmarkedStarted.length === 1 ? "it" : "them"} when you can.</div>`
        : "";
    const desktopPrompt = "Notification" in global && global.Notification.permission === "default"
      ? `<button type="button" class="btn btn-sm btn-light" data-action="enable-desktop-reminders"><i class="bi bi-bell me-1"></i>Turn on desktop reminders</button>`
      : "";

    el.innerHTML = `
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
        <div style="font-size:.86rem;"><strong>${day}</strong> &bull; ${done} of ${total} classes marked</div>
        ${desktopPrompt}
      </div>
      <div class="progress mb-3" style="height:8px;" role="progressbar" aria-label="Today's classes marked" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
        <div class="progress-bar ${done === total ? "bg-success" : ""}" style="width:${pct}%"></div>
      </div>
      ${warning}
      ${p.classes.map(entry => {
        const course = global.USIAMS.courses.getCourse(entry.courseId) || { id: entry.courseId, title: "" };
        const state = stateOf(entry, p.minutes);
        const checkin = checkinFor(student, entry, p.date);
        const canMark = state.key !== "upcoming";
        const button = (status, icon, tone) => `<button type="button" class="btn btn-sm ${checkin && checkin.status === status ? `btn-${tone}` : `btn-outline-${tone}`}"
            data-action="mark-class" data-entry="${entry.id}" data-status="${status}" ${canMark ? "" : "disabled"}
            aria-pressed="${checkin && checkin.status === status ? "true" : "false"}"><i class="bi ${icon} me-1"></i>${status}</button>`;
        return `
        <div class="d-flex justify-content-between align-items-center gap-2 py-2 border-bottom flex-wrap">
          <div style="min-width:0;">
            <strong style="font-size:.85rem;">${entry.time} - ${clock(minutesOf(entry.time) + CLASS_MINUTES)} &bull; ${util.escapeHtml(course.id)}</strong>
            <span class="status-badge ${checkin ? (checkin.status === "Attended" ? "status-active" : "status-rejected") : state.key === "upcoming" ? "status-info" : "status-pending"} ms-1">${checkin ? checkin.status : state.label}</span>
            <div class="text-muted-usi" style="font-size:.76rem;">${util.escapeHtml(course.title)} &bull; ${util.escapeHtml(entry.room)} &bull; ${util.escapeHtml(entry.lecturer || "")}</div>
          </div>
          <div class="d-flex gap-1">${button("Attended", "bi-check2", "success")}${button("Missed", "bi-x", "danger")}</div>
        </div>`;
      }).join("")}`;

    el.querySelectorAll("[data-action='mark-class']").forEach(btn => btn.addEventListener("click", () => {
      const entry = p.classes.find(e => e.id === btn.dataset.entry);
      if (!entry) return;
      mark(student, entry, btn.dataset.status);
      render(containerId, student);
      const remaining = progress(student).classes.length - progress(student).marked.length;
      global.USIAMS.toast.show("success", "Class marked", remaining
        ? `${entry.courseId} marked ${btn.dataset.status.toLowerCase()}. ${remaining} left today.`
        : "Today's timetable is complete. Well done!");
    }));
    const enable = el.querySelector("[data-action='enable-desktop-reminders']");
    if (enable) enable.addEventListener("click", () => {
      global.Notification.requestPermission().then(() => render(containerId, student));
    });
  }

  // Reminders shown only once per class and day, even across page loads.
  function remindedKey(date, what) { return `usiams.classReminder.${date}.${what}`; }
  function alreadyReminded(date, what) {
    try { return global.sessionStorage.getItem(remindedKey(date, what)) === "1"; } catch { return false; }
  }
  function rememberReminder(date, what) {
    try { global.sessionStorage.setItem(remindedKey(date, what), "1"); } catch { /* storage blocked */ }
  }

  function notify(title, body) {
    global.USIAMS.toast.show("info", title, body);
    if ("Notification" in global && global.Notification.permission === "granted") {
      try { new global.Notification(title, { body }); } catch { /* not supported here */ }
    }
  }

  function checkReminders(student) {
    const now = new Date();
    const p = progress(student, now);
    p.classes.forEach(entry => {
      const until = minutesOf(entry.time) - p.minutes;
      if (until > 0 && until <= REMIND_BEFORE_MINUTES && !alreadyReminded(p.date, entry.id)) {
        rememberReminder(p.date, entry.id);
        const course = global.USIAMS.courses.getCourse(entry.courseId);
        notify("Class starting soon", `${entry.courseId}${course ? " " + course.title : ""} starts at ${entry.time} in ${entry.room}.`);
      }
    });
    if (p.dayOver && p.marked.length < p.classes.length && !alreadyReminded(p.date, "evening")) {
      rememberReminder(p.date, "evening");
      notify("Complete today's timetable", `${p.classes.length - p.marked.length} of today's ${p.classes.length} classes are not marked yet.`);
    }
  }

  let timer = null;
  /** Keeps the card current and raises reminders while the page is open. */
  function start(containerId, student) {
    render(containerId, student);
    checkReminders(student);
    if (timer) clearInterval(timer);
    timer = setInterval(() => { render(containerId, student); checkReminders(student); }, 60 * 1000);
  }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.classChecklist = { todaysClasses, progress, mark, render, start, localDate };
})(window);

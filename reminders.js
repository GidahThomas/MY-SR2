/* =========================================================
   USIAMS - reminders.js
   Daily timetable reminders, sent as notifications (the bell in the
   navbar) so they reach a student even when the app was closed:

     Morning      from 06:00 - "You have N classes today", with times
     BeforeClass  15 minutes before each class
     Evening      from 20:00 - if any of today's classes are still not
                  marked attended/missed on the checklist

   Only the courses a student registered for count. Each reminder is
   recorded in class_reminders_sent, so it is sent once even though the
   job runs every minute and the server may restart.

   Times are the server's local time: run the server in the university's
   time zone (set TZ=Africa/Dar_es_Salaam in .env if the machine is not).
   ========================================================= */
const crypto = require("node:crypto");
const { query, pool } = require("./db/repository");

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MORNING_FROM = 6 * 60;
const EVENING_FROM = 20 * 60;
const REMIND_BEFORE_MINUTES = 15;

const pad = n => String(n).padStart(2, "0");
const localDate = now => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const minutesOf = time => { const [h, m] = String(time).split(":").map(Number); return h * 60 + (m || 0); };

/** Every registered class today, one row per student and class. */
async function classesOn(day) {
  return query(`
    SELECT s.id AS studentId, u.id AS userId, t.id AS entryId, t.course_id AS courseId, c.title,
           TIME_FORMAT(t.start_time, '%H:%i') AS startTime, t.room
    FROM students s
    JOIN users u ON u.email = s.email AND u.status = 'Active'
    JOIN semesters sem ON sem.status = 'Active'
    JOIN registrations r ON r.student_id = s.id AND r.semester_id = sem.id AND r.status IN ('Registered', 'Approved')
    JOIN registration_courses rc ON rc.registration_id = r.id
    JOIN timetable_entries t ON t.course_id = rc.course_id AND t.programme_id = s.programme_id
      AND t.semester_id = sem.id AND t.day_of_week = ?
    JOIN courses c ON c.id = t.course_id
    WHERE s.status = 'Active'
    ORDER BY s.id, t.start_time
  `, [day]);
}

/** Records the reminder; true only the first time, so it is sent once. */
async function claim(studentId, date, kind, entryId = "") {
  const [result] = await pool.execute(
    "INSERT IGNORE INTO class_reminders_sent (student_id, class_date, kind, timetable_entry_id) VALUES (?, ?, ?, ?)",
    [studentId, date, kind, entryId]
  );
  return result.affectedRows === 1;
}

async function notifyUser(userId, title, message) {
  await query(
    "INSERT INTO notifications (id, user_id, category, title, message) VALUES (?, ?, 'Academic', ?, ?)",
    [`NTF-${crypto.randomBytes(8).toString("hex").toUpperCase()}`, userId, title, message]
  );
}

async function run(now = new Date()) {
  const day = WEEKDAYS[now.getDay()];
  if (day === "Sunday") return { sent: 0 };
  const date = localDate(now);
  const minutes = now.getHours() * 60 + now.getMinutes();

  const rows = await classesOn(day);
  const byStudent = new Map();
  for (const row of rows) {
    if (!byStudent.has(row.studentId)) byStudent.set(row.studentId, []);
    byStudent.get(row.studentId).push(row);
  }

  let sent = 0;
  for (const [studentId, classes] of byStudent) {
    const { userId } = classes[0];

    if (minutes >= MORNING_FROM && minutes < EVENING_FROM && await claim(studentId, date, "Morning")) {
      const list = classes.map(c => `${c.startTime} ${c.courseId} (${c.room})`).join(", ");
      await notifyUser(userId, `Today's timetable: ${classes.length} class${classes.length === 1 ? "" : "es"}`,
        `Your classes today: ${list}. Mark each one on Today's Classes after it starts.`);
      sent++;
    }

    for (const c of classes) {
      const until = minutesOf(c.startTime) - minutes;
      if (until > 0 && until <= REMIND_BEFORE_MINUTES && await claim(studentId, date, "BeforeClass", c.entryId)) {
        await notifyUser(userId, `Class at ${c.startTime}: ${c.courseId}`,
          `${c.courseId} ${c.title} starts at ${c.startTime} in ${c.room}.`);
        sent++;
      }
    }

    if (minutes >= EVENING_FROM) {
      const [row] = await query(
        "SELECT COUNT(*) AS marked FROM class_checkins WHERE student_id = ? AND class_date = ?",
        [studentId, date]
      );
      const unmarked = classes.length - Number(row.marked);
      if (unmarked > 0 && await claim(studentId, date, "Evening")) {
        await notifyUser(userId, "Complete today's timetable",
          `${unmarked} of today's ${classes.length} classes ${unmarked === 1 ? "is" : "are"} not marked yet. Open Today's Classes to mark them attended or missed.`);
        sent++;
      }
    }
  }
  return { sent };
}

/** Runs the reminder job every minute. */
function start() {
  const tick = () => run().catch(error => console.warn("USIAMS: timetable reminders failed:", error.message));
  tick();
  return setInterval(tick, 60 * 1000).unref();
}

module.exports = { run, start };

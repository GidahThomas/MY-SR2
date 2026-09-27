# USIAMS

**University Student Information and Academic Management System**: one web application for a university's students, lecturers and administrative offices, covering admissions, course registration, timetables, results, fees, the library and more.

It runs as a single Node.js server backed by a MySQL/MariaDB database. People use it through a web browser; there is nothing to install on their machines.

```
Browser  ──►  Node.js server (server.js)  ──►  MySQL / MariaDB
              • serves the pages
              • REST API under /api/...
```

## Features

| Area | What it does |
|---|---|
| **Accounts & roles** | 16 roles (Student, Lecturer, Finance Officer, Registration Officer, Librarian, Hostel Officer, QA Officer, admins...). Staff sign-ups wait for administrator approval. The QA Officer role is read-only. |
| **Admissions** | Public application form; admissions staff accept or reject, and the applicant is emailed the decision. |
| **Course registration** | Every student registers for **6 or 7 courses** a semester. The page and the server both enforce this, along with prerequisites, credit limits and the registration window. |
| **Timetable** | Weekly timetable per programme and year, with room and lecturer clash detection. |
| **Today's Classes** | A daily checklist on the student dashboard: students mark each class *Attended* or *Missed*. Reminders arrive in the morning, 15 minutes before each class, and in the evening if the day's checklist is unfinished. |
| **Results & GPA** | Results, semester and overall GPA, and an unofficial transcript. GPA is blurred by default; click it to show it and click again to hide it. |
| **Fees (GePG)** | Students get a GePG control number for what they are paying and pay through the *Government Payments* option of M-Pesa, Tigo Pesa, Airtel Money, HaloPesa or CRDB/NMB/NBC. |
| **Other services** | Attendance, e-learning, library, hostel, service requests, complaints, documents, internships, graduation clearance, alumni, elections, announcements, notifications, reports, audit log. |

## Tech stack

- **Server:** Node.js (no framework), `mysql2`, `nodemailer`
- **Database:** MySQL 8 or MariaDB 10.4+ (XAMPP's MariaDB works)
- **Frontend:** plain HTML, CSS and JavaScript with Bootstrap 5, Bootstrap Icons and Chart.js. These and the Mulish font are served from `assets/vendor/`, so the app works without internet access.
- **Tests:** a Node test runner with `jsdom`

## Getting started

**Requirements:** Node.js 20 or newer, and MySQL or MariaDB running.

```powershell
git clone https://github.com/GidahThomas/MY-SR2.git
cd MY-SR2
npm install
copy .env.example .env      # then set DB_USER and DB_PASSWORD in .env
npm run db:setup            # creates the database and loads the demo data
npm start
```

Open **http://127.0.0.1:3000** in a browser.

The pages call the API with relative paths, so they must be opened through the server, not as files or through a static server such as Live Server. In VS Code, **F5** starts the server and opens Chrome on port 8081.

### The first administrator

A new database has **no sign-in accounts**. Create the first administrator from the command line:

```powershell
npm run create-admin -- --username jdoe --email jdoe@university.ac.tz --name "Jane Doe"
```

A strong password is generated and shown once; add `--password <12+ characters>` to choose your own, and `--role UNIVERSITY_ADMIN` for a university administrator instead of a system administrator. Sign in and change the password under **Settings > Change Password**.

After that:
- **Staff:** the administrator creates staff accounts under **Administration > Users**. Staff can also request an account on the sign-in page (Create Account), which waits for an administrator's approval.
- **Students:** create their own accounts from the sign-in page.

The demo data (students, courses, results and so on) comes without any logins; its 20 demo accounts are removed at the end of every `npm run db:seed`. Real accounts are kept when you reseed.

## Configuration

All settings live in `.env`; `.env.example` lists each one with an explanation.

| Setting | Purpose |
|---|---|
| `HOST`, `PORT` | Where the server listens. Use `HOST=0.0.0.0` to let other computers on the network connect. |
| `DB_*` | Database connection. |
| `SESSION_TTL_HOURS` | How long a sign-in lasts (default 8). |
| `PUBLIC_URL` | The site's address, used in links sent by email. |
| `TLS_CERT_FILE`, `TLS_KEY_FILE` | Serve HTTPS directly. Leave unset behind a proxy that handles HTTPS. |
| `SMTP_*` | Mail server for password-reset links and admission decisions. Without it, emails are kept in the `outbound_messages` table and printed to the server console. |
| `REMINDERS` | `off` disables the daily timetable reminders. |
| `GEPG_SIMULATION` | `on` lets students confirm their own payment (demos only). Off by default: finance staff confirm payments. |
| `TRUST_PROXY` | `on` only behind a reverse proxy that sets `X-Forwarded-For`. |
| `TZ` | Time zone for reminders, e.g. `Africa/Dar_es_Salaam`, if the server is not on local time. |

## npm scripts

| Command | What it does |
|---|---|
| `npm start` | Start the server |
| `npm run dev` | Start and restart automatically when files change |
| `npm run db:setup` | Create the schema, apply migrations and load demo data (**replaces existing data**) |
| `npm run db:migrate` | Apply new tables and columns only; safe to re-run. Run this after pulling updates. |
| `npm run db:seed` | Reload the demo data (**replaces existing data**; real accounts are kept) |
| `npm run create-admin` | Create an administrator account (see above) |
| `npm test` | Run all test suites (about 10 minutes). They use a separate database, `<DB_NAME>_test`, rebuilt on each run with demo logins; your real database is not touched. |

## Project structure

```
server.js            HTTP server, REST API, authorisation, security headers
config.js            reads .env
page-includes.js     the stylesheets, scripts and app frame every page shares
rate-limit.js        limits on sign-in and public form attempts
mailer.js            outgoing email (SMTP or queued)
reminders.js         daily timetable reminders
db.js                auth, GePG payments, elections, settings queries
db/                  schema, migration, seeder, resource registry, repository,
                     student-rules.js (what students may change), accounts.js,
                     create-admin.js, passwords.js
data/shared.js       rules both browser and server use (course load, loan period...)
data/                demo data generators (used by the seeder)
js/                  page logic and the browser data layer (js/api.js)
components/          shared UI: navbar, sidebar, tables, cards, modals, toasts
css/                 styles
pages/               application pages - each holds only its own content; the
                     shared parts are <!-- include: ... --> markers
assets/vendor/       Bootstrap, Bootstrap Icons, Chart.js, Mulish font
tests/               test suites; tests/helpers.js holds what they share
```

`db/README.md` describes the database in more detail.

## Security

- **Passwords:** scrypt, each with its own random salt.
- **Sessions:** stored in the database as token hashes; suspending an account signs it out at once.
- **Sign-in limits:** 10 wrong passwords per username (50 per address) in 15 minutes, then a short lock-out. Sign-up, password-reset and admission forms are limited too.
- **Forgot password:** a one-time link valid for 30 minutes; the form never reveals whether an account exists.
- **Authorisation on the server for every request.** Students see only their own records, and on those they may change only what their pages offer (`db/student-rules.js`): they cannot approve their own registration, verify their own documents, clear their own graduation, grade their own work, mark a library book returned, or confirm their own fee payment.
- **Browser protections:** a Content-Security-Policy that only allows this server's own scripts, styles and fonts; pages cannot be framed by other sites; no MIME sniffing; no referrer leaks.
- **SQL injection:** every query uses placeholders; table and column names come only from the resource registry.
- **Audit log:** every change and every failed sign-in is recorded, with the client's real address.
- **Tests run in their own database,** never against the live one.

## Known limitations

- **GePG is not connected.** Connecting to the real gateway needs the university's GePG enrolment (service provider code and signing certificates). Until then students get control numbers and finance staff confirm payments; `GEPG_SIMULATION=on` lets students confirm for demonstrations.
- **No SMS.** Reminders and notices are delivered in the app and by email only.
- **Generated course names.** Most of the course catalogue is generated demo data, named from each programme's subject (e.g. "Principles of Chemistry I"). Replace it with the real curriculum before use.

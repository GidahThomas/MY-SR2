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

### Demo accounts

| Username | Password | Role |
|---|---|---|
| `student` | `student123` | Student |
| `lecturer` | `lecturer123` | Lecturer |
| `admin` | `admin123` | University Admin |
| `sysadmin` | `sysadmin123` | System Admin |
| `finance` | `finance123` | Finance Officer |
| `registration` | `registration123` | Registration Officer |
| `qa` | `qa123` | Quality Assurance Officer |
| `librarian` | `librarian123` | Librarian |
| `hostel` | `hostel123` | Hostel Officer |

These are for demonstration only. Remove them, and the list on the login page, before real use.

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
| `TZ` | Time zone for reminders, e.g. `Africa/Dar_es_Salaam`, if the server is not on local time. |

## npm scripts

| Command | What it does |
|---|---|
| `npm start` | Start the server |
| `npm run dev` | Start and restart automatically when files change |
| `npm run db:setup` | Create the schema, apply migrations and load demo data (**replaces existing data**) |
| `npm run db:migrate` | Apply new tables and columns only; safe to re-run. Run this after pulling updates. |
| `npm run db:seed` | Reload the demo data (**replaces existing data**) |
| `npm test` | Run all test suites against a temporary server. Needs the database, takes about 10 minutes, and reseeds the demo data. |

## Project structure

```
server.js            HTTP server, REST API, authorisation
config.js            reads .env
db.js                auth, GePG payments, elections, settings queries
mailer.js            outgoing email (SMTP or queued)
reminders.js         daily timetable reminders
db/                  schema, migrations, seeder, resource registry, repository
data/                demo data generators (used by the seeder)
js/                  page logic and the browser data layer (js/api.js)
components/          shared UI: navbar, sidebar, tables, cards, modals, toasts
css/                 styles
pages/               application pages
assets/vendor/       Bootstrap, Bootstrap Icons, Chart.js, Mulish font
tests/               API, page and interaction test suites
```

`db/README.md` describes the database in more detail.

## Security

- **Passwords:** hashed with scrypt, each with its own random salt.
- **Sessions:** stored in the database as hashes of the token, so they survive a restart. Suspending an account signs it out immediately.
- **Forgot password:** emails a one-time link valid for 30 minutes. It never reveals whether an account exists.
- **Authorisation:** checked on the server for every request. The browser only decides what to display.
- **Audit log:** every change is recorded.

## Known limitations

- **GePG payments are simulated.** Connecting to the real gateway needs the university's GePG enrolment (service provider code and signing certificates). Until then, confirming a payment simulates GePG's callback.
- **No SMS.** Reminders and notices are delivered in the app and by email only.
- **Generated course names.** Most of the course catalogue is generated demo data, named from each programme's subject (e.g. "Principles of Chemistry I"). Replace it with the real curriculum before use.

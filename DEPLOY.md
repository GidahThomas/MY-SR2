# Deploying USIAMS on Vercel

USIAMS is hosted on **Vercel**, in the project `unicollege` (account `gidahthomas-projects`):

| Address | State |
|---|---|
| https://unicollege.vercel.app | Live |
| https://unicollege.ac.tz and https://www.unicollege.ac.tz | Attached to the project; work once the domain is registered and its DNS is set (step 5) |

## How it runs on Vercel

- `vercel.json` sends every request, pages and files alike, to one Node.js function, `api/index.js`, which runs `server.js`. Pages therefore get the same security headers, access rules and compression as under `npm start`, and nothing in the repository (`server.js`, `db/`, `.env`) is served as a file.
- Vercel has **no MySQL**. The database is a cloud MySQL service that the function reaches over an encrypted connection (`DB_SSL=on`).
- There is no always-running process. Session cleanup runs at most once an hour and the timetable reminders at most once a minute, each after a request has been answered. On a quiet site a reminder goes out with the next visit rather than on the minute.
- Settings are **Vercel environment variables**, not a `.env` file. `.vercelignore` keeps your local `.env` from ever being uploaded.

## 1. Create the database

Use any MySQL 8-compatible cloud service that accepts outside connections, for example **TiDB Cloud Serverless** (free tier) or **Aiven for MySQL** (free plan). Create a database named `university` and note its host, port, user and password.

The service must accept connections from anywhere (`0.0.0.0/0`): Vercel functions have no fixed address.

## 2. Set the environment variables

In the Vercel dashboard (**unicollege > Settings > Environment Variables**, environment *Production*), or from the project folder with `npx vercel env add NAME production`:

| Variable | Value |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | From step 1 |
| `DB_SSL` | `on` |
| `DB_SSL_CA` | Only if the provider uses its own certificate authority (Aiven does): the CA certificate's PEM text |
| `DB_CONNECTION_LIMIT` | `3`. Each function instance holds its own pool, so keep it small |
| `PUBLIC_URL` | `https://unicollege.ac.tz` |
| `TRUST_PROXY` | `on`. Vercel sets `X-Forwarded-For` |
| `APP_TIMEZONE` | `Africa/Dar_es_Salaam`. Vercel reserves `TZ` |
| `GEPG_SIMULATION` | `off` |
| `UNIVERSITY_NAME`, `CONTACT_*`, `ADMISSION_*` | The institution shown on the home page |
| `SMTP_*` | Outgoing email (step 6) |

Already set on the project: `DB_SSL`, `DB_CONNECTION_LIMIT`, `PUBLIC_URL`, `TRUST_PROXY`, `APP_TIMEZONE`, `GEPG_SIMULATION` and the institution details. Still to add: the database connection and email.

A changed variable takes effect with the next deployment (step 4).

## 3. Load the data

Run these from your own computer, with `.env` temporarily pointing at the cloud database (the same `DB_*` values as step 2, plus `DB_SSL=on`). Put your local settings back afterwards.

**Starting from your XAMPP data** (its accounts, including your administrator, and every record): export it as below, then load it with the provider's import tool or the `mysql` client, and run `npm run db:migrate`. In Git Bash, from the project folder:

```bash
D=/c/xampp/mysql/bin/mysqldump.exe
{ "$D" -u root --single-transaction --hex-blob --default-character-set=utf8mb4 --skip-dump-date \
    --ignore-table=university.user_sessions --ignore-table=university.password_resets \
    --ignore-table=university.outbound_messages university
  "$D" -u root --no-data --skip-dump-date university user_sessions password_resets outbound_messages
} | sed -E 's/DEFINER=`[^`]*`@`[^`]*`//g' > usiams-database.sql
```

The export leaves out sign-in sessions and the email log, and strips the `root@localhost` owner from the views, which cloud services refuse. `usiams-database.sql` holds password hashes and personal records: keep it private, delete it after importing, and never commit it.

**Starting fresh instead:** `npm run db:setup` (schema and demo register), then `npm run create-admin -- --username admin --email info@unicollege.ac.tz --name "Your Full Name"`. `db:setup` deletes and rebuilds every table: run it once, on the empty database, and never again.

## 4. Deploy

From the project folder:

```bash
npx vercel deploy --prod --yes
```

Then open https://unicollege.vercel.app/api/health. `"database":"connected"` means the site can reach the database; sign in to check the rest.

## 5. Point the domain at Vercel

Once `unicollege.ac.tz` is registered (through a tzNIC-accredited registrar), set at the registrar's DNS:

| Type | Name | Value |
|---|---|---|
| A | `unicollege.ac.tz` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com` |

Vercel checks the records, issues the HTTPS certificate itself, and emails you when the domain is ready. `npx vercel domains inspect unicollege.ac.tz` shows the current state.

## 6. Turn on email

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` and `SMTP_FROM` for a mailbox such as `no-reply@unicollege.ac.tz`, then deploy again. Until then, emails are kept in the `outbound_messages` table instead of being sent. Check it with **Forgot Password?** on the sign-in page.

## Updating the site

1. `npm test` locally.
2. If the update changed the database, run `npm run db:migrate` against the cloud database as in step 3. It is safe on live data. **Never run `db:setup` or `db:seed` against the live database.**
3. `npx vercel deploy --prod --yes`.

## Limits to know

- **Request size:** Vercel refuses request bodies over 4.5 MB. Uploads are capped at 5 MB before encoding, so the largest files may be refused; keep uploads under about 3 MB.
- **Function time:** a request may run for 30 seconds (`maxDuration` in `vercel.json`).
- **Logs:** Vercel dashboard > unicollege > Logs, or `npx vercel logs unicollege.vercel.app`.
- **Backups:** use the database provider's backups, and keep a copy of the environment variables somewhere private.

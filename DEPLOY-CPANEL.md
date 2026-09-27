U# Hosting USIAMS on cPanel

This guide puts USIAMS online at **https://unicollege.ac.tz** on cPanel hosting that offers **Setup Node.js App**. It takes about an hour the first time.

Throughout, `cpuser` stands for your cPanel username; replace it with yours.

## What the hosting plan must have

Check your cPanel has all of these before you start:

| cPanel feature | Used for |
|---|---|
| **Setup Node.js App** with Node.js **20 or newer** | Running USIAMS |
| **MySQL Databases** (MySQL 8 or MariaDB 10.4+) | The database |
| **SSL/TLS Status** (AutoSSL) | Free HTTPS certificate |
| **Email Accounts** | Password-reset and admission emails |
| **Terminal** or SSH access | Recommended; steps without it are given too |

If Setup Node.js App is missing, or only offers Node.js older than 20, ask your host to enable it. USIAMS cannot run without it.

## 1. Point the domain at the hosting

If `unicollege.ac.tz` is the main domain of the cPanel account, skip this step.

Otherwise, where the domain's DNS is managed, set:

| Type | Name | Value |
|---|---|---|
| A | `unicollege.ac.tz` | your hosting server's IP address (shown in cPanel under *General Information*) |
| CNAME | `www` | `unicollege.ac.tz` |

Then add the domain in cPanel under **Domains**. DNS changes can take a few hours to reach everyone.

## 2. Create the database

In cPanel, open **MySQL Databases**:

1. Under **Create New Database**, enter `usiams`. cPanel names it `cpuser_usiams`.
2. Under **MySQL Users**, create a user `usiams` (it becomes `cpuser_usiams`) with a strong password. Keep the password; it goes in the settings file in step 4.
3. Under **Add User To Database**, add that user to that database and tick **ALL PRIVILEGES**.

## 3. Upload the application

1. In **File Manager**, open your home folder (`/home/cpuser`). **Do not use `public_html`.** The application must sit outside it.
2. Create a folder named `usiams` and open it.
3. **Upload** `usiams-cpanel.zip`.
4. Right-click the zip, choose **Extract**, and extract into `/home/cpuser/usiams`. Then delete the zip.

You should now see `server.js`, `package.json`, `index.html` and the `assets`, `db`, `js` and `pages` folders directly inside `usiams`.

## 4. Create the settings file

In File Manager, inside `/home/cpuser/usiams`, create a new file named **`.env`**. It starts with a dot; turn on *Show Hidden Files* under Settings to see it afterwards. Paste the following, and fill in the database password and email password:

```ini
# Database (from step 2)
DB_HOST=localhost
DB_PORT=3306
DB_NAME=cpuser_usiams
DB_USER=cpuser_usiams
DB_PASSWORD=the-database-password

# The public address. Used in password-reset emails and link previews.
PUBLIC_URL=https://unicollege.ac.tz

# cPanel's web server sits in front of the app and passes on each
# visitor's address; this makes sign-in limits apply per visitor.
TRUST_PROXY=on
TZ=Africa/Dar_es_Salaam

# Real payments are confirmed by finance staff after checking GePG.
GEPG_SIMULATION=off

# The institution shown on the home page
UNIVERSITY_NAME=UNI COLLEGE
CONTACT_EMAIL=info@unicollege.ac.tz
CONTACT_PHONE=0620 116 944
CONTACT_ADDRESS=Babati, Manyara, Tanzania
CONTACT_WEBSITE=unicollege.ac.tz
ADMISSION_CLOSES=2026-11-06

# Outgoing email (step 8). Until this is filled in, emails are only
# saved in the database, not sent.
# SMTP_HOST=mail.unicollege.ac.tz
# SMTP_PORT=465
# SMTP_SECURE=true
# SMTP_USER=no-reply@unicollege.ac.tz
# SMTP_PASSWORD=the-email-password
# SMTP_FROM=UNI COLLEGE <no-reply@unicollege.ac.tz>
```

The site never serves `.env` to browsers. Keep it private all the same: it holds your database password.

## 5. Create the Node.js application

In cPanel, open **Setup Node.js App** and click **Create Application**:

| Field | Value |
|---|---|
| Node.js version | **20** or newer (the highest offered) |
| Application mode | **Production** |
| Application root | `usiams` |
| Application URL | `unicollege.ac.tz` (leave the path after it empty) |
| Application startup file | `server.js` |

Click **Create**. Then, on the same page, click **Run NPM Install** and wait for it to finish.

## 6. Set up the database tables and starting data

> **Important:** `db:setup` **deletes and rebuilds every table**. Run it **once**, now, and never again on the live site; see *Updating* below for later changes.
>
> It also loads the **demo register**: the academic structure (colleges, departments, 37 programmes, courses) together with **60 sample students, sample fees, results and announcements**. The system needs the academic structure to work. Remove or replace the sample records before real students use the site.

**With Terminal:** open cPanel **Terminal**. The top of the Setup Node.js App page shows the exact command to enter the app's environment; it looks like the first line below:

```bash
source /home/cpuser/nodevenv/usiams/20/bin/activate && cd /home/cpuser/usiams
npm run db:setup
```

**Without Terminal:** on the Setup Node.js App page, under **Run JS script**, choose `db:setup` and run it.

It should finish by listing the tables it filled.

## 7. Create your administrator account

**With Terminal** (in the same environment as step 6):

```bash
npm run create-admin -- --username admin --email info@unicollege.ac.tz --name "Your Full Name"
```

**Without Terminal:** add these lines to `.env`:

```ini
ADMIN_USERNAME=admin
ADMIN_EMAIL=info@unicollege.ac.tz
ADMIN_NAME=Your Full Name
ADMIN_PASSWORD=choose-a-password-of-12-or-more-characters
```

Then under **Run JS script** choose `create-admin` and run it. **Delete those four lines from `.env` afterwards.**

The command prints the password (a random one if you did not choose one). Sign in, then change it under **Settings > Change Password**.

Back on **Setup Node.js App**, click **Restart**.

## 8. Turn on HTTPS and email

1. **HTTPS:** in **SSL/TLS Status**, click **Run AutoSSL** and wait until `unicollege.ac.tz` shows a valid certificate. Then, under **Domains**, turn on **Force HTTPS Redirect** for it.
2. **Email:** in **Email Accounts**, create `no-reply@unicollege.ac.tz` (and `info@unicollege.ac.tz` if it does not exist). Open *Connect Devices* for it to confirm the mail server name and port. Fill in the `SMTP_*` lines in `.env`, remove the `#` in front of them, and click **Restart** on the Setup Node.js App page.

## 9. Check that it works

1. Open **https://unicollege.ac.tz**. The home page shows the UNI COLLEGE details, announcements and key dates.
2. Sign in with the administrator account from step 7.
3. Under **Administration > Users**, add a test staff account and sign in with it in a private window.
4. On the sign-in page, create a test student account with **Create Student Account**.
5. Use **Forgot Password?** and confirm the email arrives.
6. As administrator, open the **Audit log**. The IP address of each sign-in should be the visitor's real address. If every entry shows `127.0.0.1`, change `TRUST_PROXY=on` to `TRUST_PROXY=off` in `.env` and restart. If you are not sure, ask your host whether their web server sets `X-Forwarded-For`.

## Updating the site later

1. Build a new `usiams-cpanel.zip` from the project.
2. Upload it to `/home/cpuser/usiams` and extract it over the old files. Your `.env` is not in the zip, so it is kept.
3. Click **Run NPM Install**. If the update changed the database, run **`db:migrate`** (Run JS script or `npm run db:migrate`). It is safe on a live database. **Never run `db:setup` or `db:seed` on the live site.**
4. Click **Restart**.

## Backups

- cPanel **Backup** (or **Backup Wizard**): download a *MySQL database* backup of `cpuser_usiams` regularly, at least weekly and before every update.
- Also keep a copy of `.env` somewhere safe and private.

## Things to know on shared hosting

- **Idle shutdown:** cPanel stops the app after a period with no visitors and starts it again on the next visit. The first page after a quiet spell can take a few seconds. The timetable reminders only run while the app is awake, so a morning reminder can be missed if nobody has visited. If reminders matter, ask your host to raise the app's idle time, or move to a VPS.
- **Logs:** if the site shows an error page, check the log file in `/home/cpuser/usiams` (usually `stderr.log`), or the log path shown on the Setup Node.js App page. A database error there usually means a wrong `DB_*` value in `.env`.
- **Changing `.env`** only takes effect after **Restart** on the Setup Node.js App page.

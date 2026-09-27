#!/bin/bash
# =========================================================
#  USIAMS - deploy/cpanel-deploy.sh
#  Sets USIAMS up on cPanel hosting with "Setup Node.js App"
#  (CloudLinux Node.js Selector), run over SSH or in cPanel Terminal:
#
#    bash cpanel-deploy.sh [domain]
#
#  with usiams-cpanel.zip next to it. If usiams-database.sql (an export of
#  an existing USIAMS database, e.g. the XAMPP one) is there too, an empty
#  database is loaded from it instead of from the demo data. It does what
#  DEPLOY-CPANEL.md describes, using these names:
#
#    application folder  ~/usiams
#    database and user   <cpanel user>_usiams   (password generated)
#    first admin         admin / info@unicollege.ac.tz (password generated)
#
#  Safe to run again: an existing .env (and its database password) is
#  kept, and the tables are only built when the database is empty -
#  db:setup drops every table, so it never runs over real data.
# =========================================================
set -euo pipefail

DOMAIN="${1:-unicollege.ac.tz}"
APP_NAME="usiams"
APP_DIR="$HOME/$APP_NAME"
ZIP="${ZIP:-$(dirname "$0")/usiams-cpanel.zip}"
DUMP="${DUMP:-$(dirname "$0")/usiams-database.sql}"
CPUSER="$(whoami)"
DB="${CPUSER}_${APP_NAME}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_EMAIL="${ADMIN_EMAIL:-info@unicollege.ac.tz}"
ADMIN_NAME="${ADMIN_NAME:-UNI COLLEGE Administrator}"

step() { printf '\n==> %s\n' "$*"; }
fail() { printf '\nUSIAMS deploy: %s\n' "$*" >&2; exit 1; }
# uapi prints YAML; "status: 1" means the call succeeded. The output is
# captured first so an early grep exit cannot fail the pipeline.
uapi_ok() { local out; out="$(uapi --output=yaml "$@" 2>&1)" || true; grep -q '^  status: 1' <<<"$out"; }

command -v uapi >/dev/null || fail "uapi not found - this must run on the cPanel server."
command -v cloudlinux-selector >/dev/null || fail "cloudlinux-selector not found - the plan has no Setup Node.js App. Ask the host to enable it."
[ -f "$ZIP" ] || fail "upload usiams-cpanel.zip next to this script first (looked for $ZIP)."

step "Unpacking the application into $APP_DIR"
mkdir -p "$APP_DIR"
unzip -oq "$ZIP" -d "$APP_DIR"

if [ -f "$APP_DIR/.env" ]; then
  step "Keeping the existing $APP_DIR/.env and database"
else
  step "Creating database $DB and its user"
  DB_PASSWORD="$(head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24)"
  uapi_ok Mysql create_database name="$DB" || echo "   (database already exists - using it)"
  uapi_ok Mysql create_user name="$DB" password="$DB_PASSWORD" \
    || uapi_ok Mysql set_password user="$DB" password="$DB_PASSWORD" \
    || fail "could not create or update the database user $DB."
  uapi_ok Mysql set_privileges_on_database user="$DB" database="$DB" privileges="ALL PRIVILEGES" \
    || fail "could not give $DB access to its database."

  step "Writing $APP_DIR/.env"
  umask 077
  cat > "$APP_DIR/.env" <<ENV
# Written by deploy/cpanel-deploy.sh. Restart the app after changing it.
DB_HOST=localhost
DB_PORT=3306
DB_NAME=$DB
DB_USER=$DB
DB_PASSWORD=$DB_PASSWORD

PUBLIC_URL=https://$DOMAIN
TRUST_PROXY=on
TZ=Africa/Dar_es_Salaam
GEPG_SIMULATION=off

UNIVERSITY_NAME=UNI COLLEGE
CONTACT_EMAIL=info@unicollege.ac.tz
CONTACT_PHONE=0620 116 944
CONTACT_ADDRESS=Babati, Manyara, Tanzania
CONTACT_WEBSITE=unicollege.ac.tz
ADMISSION_CLOSES=2026-11-06

# Outgoing email: create no-reply@unicollege.ac.tz in cPanel, then fill in
# and uncomment these.
# SMTP_HOST=mail.unicollege.ac.tz
# SMTP_PORT=465
# SMTP_SECURE=true
# SMTP_USER=no-reply@unicollege.ac.tz
# SMTP_PASSWORD=
# SMTP_FROM=UNI COLLEGE <no-reply@unicollege.ac.tz>
ENV
  umask 022
fi

step "Creating the Node.js application for https://$DOMAIN/"
NODE_VERSION=""
# The selector keeps each app's environment in ~/nodevenv/<app>/<version>.
if [ -d "$HOME/nodevenv/$APP_NAME" ] && [ -n "$(ls "$HOME/nodevenv/$APP_NAME")" ]; then
  echo "   (already exists)"
  NODE_VERSION="$(ls "$HOME/nodevenv/$APP_NAME" | sort -V | tail -1)"
else
  # Newest first; USIAMS needs Node.js 20 or newer.
  for version in 24 22 20; do
    if cloudlinux-selector create --json --interpreter=nodejs --version="$version" \
        --app-root="$APP_NAME" --domain="$DOMAIN" --app-uri=/ --app-mode=production \
        --startup-file=server.js >/tmp/usiams-create.$$ 2>&1 && grep -Eq '"result": ?"success"' /tmp/usiams-create.$$; then
      NODE_VERSION="$version"
      break
    fi
  done
  [ -n "$NODE_VERSION" ] || { cat /tmp/usiams-create.$$ >&2; fail "could not create the Node.js app (needs Node.js 20+ and the domain $DOMAIN in this cPanel account)."; }
  rm -f /tmp/usiams-create.$$
fi
echo "   Node.js $NODE_VERSION"

step "Installing packages (npm install)"
cloudlinux-selector install-modules --json --interpreter=nodejs --app-root="$APP_NAME" >/dev/null \
  || fail "npm install failed - see the Setup Node.js App page."

# shellcheck disable=SC1090
source "$HOME/nodevenv/$APP_NAME/$NODE_VERSION/bin/activate"
cd "$APP_DIR"

step "Checking the database"
TABLES="$(node -e '
  const { config } = require("./config");
  require("mysql2/promise").createConnection({ host: config.db.host, port: config.db.port, user: config.db.user,
    password: config.db.password, database: config.db.database })
    .then(async c => { const [r] = await c.query("SHOW TABLES"); console.log(r.length); await c.end(); })
    .catch(e => { console.error(e.message); process.exit(1); });
')" || fail "cannot connect to the database with the settings in .env."

if [ "$TABLES" = "0" ] && [ -f "$DUMP" ]; then
  step "Loading the database from $(basename "$DUMP")"
  command -v mysql >/dev/null || fail "the mysql client is missing - import $(basename "$DUMP") with phpMyAdmin instead."
  # The password goes in a private options file, not on the command line
  # where other users of the server could see it.
  MYCNF="$(mktemp)"
  chmod 600 "$MYCNF"
  node -e '
    const { config } = require("./config");
    console.log(`[client]\nhost=${config.db.host}\nport=${config.db.port}\nuser=${config.db.user}\npassword="${config.db.password}"`);
  ' > "$MYCNF"
  mysql --defaults-extra-file="$MYCNF" --default-character-set=utf8mb4 "$DB" < "$DUMP" \
    || { rm -f "$MYCNF"; fail "importing $(basename "$DUMP") failed."; }
  rm -f "$MYCNF"
  # Brings an older export up to date; safe on a current one.
  npm run --silent db:migrate
elif [ "$TABLES" = "0" ]; then
  step "Building the tables and loading the starting data (db:setup)"
  npm run --silent db:setup
else
  step "The database already has $TABLES tables - applying updates only (db:migrate)"
  npm run --silent db:migrate
fi

step "Checking for an administrator account"
# An imported database brings its own administrators (with their
# passwords); only an empty one needs a first administrator made.
if node -e '
  const { query, pool } = require("./db/repository");
  query(`SELECT u.username FROM users u JOIN user_roles r ON r.user_id = u.id
         WHERE u.status = "Active" AND r.role_id IN ("SYSTEM_ADMIN", "UNIVERSITY_ADMIN")`)
    .then(rows => { pool.end(); if (rows.length) console.log("   found: " + rows.map(r => r.username).join(", ")); process.exit(rows.length ? 0 : 1); });
'; then
  echo "   (sign in with the existing administrator's password)"
else
  echo "   none yet - creating $ADMIN_USERNAME"
  npm run --silent create-admin -- --username "$ADMIN_USERNAME" --email "$ADMIN_EMAIL" --name "$ADMIN_NAME"
fi

step "Restarting the application"
cloudlinux-selector restart --json --interpreter=nodejs --app-root="$APP_NAME" >/dev/null

printf '\nUSIAMS is deployed at https://%s/ (application folder %s).\n' "$DOMAIN" "$APP_DIR"
printf 'Next: run AutoSSL in cPanel for %s and sign in as %s.\n' "$DOMAIN" "$ADMIN_USERNAME"

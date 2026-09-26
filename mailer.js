/* =========================================================
   USIAMS - mailer.js
   Outgoing email: password reset links and admission decisions.

   Every message is first written to outbound_messages, then sent
   through the SMTP server in .env (SMTP_HOST ...). Without SMTP
   settings the message stays 'Queued' in that table and is printed
   to the server console, so a development machine still shows the
   reset link and nothing is lost before a mail server is set up.

   send() never throws: a mail outage must not break the request that
   triggered it, and must not reveal to a caller whether an account
   exists.
   ========================================================= */
const nodemailer = require("nodemailer");
const { config } = require("./config");
const { query } = require("./db/repository");

let transport = null;
function transportFor() {
  if (!config.smtp.host) return null;
  if (!transport) {
    transport = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.password } : undefined
    });
  }
  return transport;
}

async function send({ to, subject, text, purpose }) {
  let messageId = null;
  try {
    const result = await query(
      "INSERT INTO outbound_messages (recipient, subject, body, purpose) VALUES (?, ?, ?, ?)",
      [to, subject, text, purpose]
    );
    messageId = result.insertId;
  } catch (error) {
    console.warn("USIAMS: could not queue email:", error.message);
  }

  const smtp = transportFor();
  if (!smtp) {
    console.log(`USIAMS email (not sent - SMTP_HOST is not set)\n  To: ${to}\n  Subject: ${subject}\n  ${text.replace(/\n/g, "\n  ")}`);
    return { sent: false, queued: messageId !== null };
  }

  try {
    await smtp.sendMail({ from: config.smtp.from, to, subject, text });
    if (messageId) await query("UPDATE outbound_messages SET status = 'Sent', sent_at = NOW() WHERE id = ?", [messageId]);
    return { sent: true };
  } catch (error) {
    console.warn("USIAMS: email to", to, "failed:", error.message);
    if (messageId) {
      await query("UPDATE outbound_messages SET status = 'Failed', error = ? WHERE id = ?", [String(error.message).slice(0, 255), messageId])
        .catch(() => {});
    }
    return { sent: false, error: error.message };
  }
}

module.exports = { send };

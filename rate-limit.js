/* =========================================================
   USIAMS - rate-limit.js
   Limits on how often the public forms can be tried, so passwords
   cannot be guessed at speed and the forms cannot be flooded.

     sign-in         10 wrong passwords per username per address, and
                     50 per address, in 15 minutes
     forgot/reset    10 per address in 15 minutes
     sign-up         20 per address per hour
     admissions      20 per address per hour
     change password 10 wrong current passwords per account in 15 minutes

   Counts are kept in memory: a restart clears them, and each server
   process counts on its own.
   ========================================================= */
const WINDOWS = {
  loginAccount: { max: 10, ms: 15 * 60 * 1000 },
  loginAddress: { max: 50, ms: 15 * 60 * 1000 },
  passwordReset: { max: 10, ms: 15 * 60 * 1000 },
  register: { max: 20, ms: 60 * 60 * 1000 },
  admissions: { max: 20, ms: 60 * 60 * 1000 },
  changePassword: { max: 10, ms: 15 * 60 * 1000 }
};

const hits = new Map(); // "kind|key" -> [timestamps]

function recent(kind, key, now) {
  const id = `${kind}|${key}`;
  const window = WINDOWS[kind];
  const list = (hits.get(id) || []).filter(t => now - t < window.ms);
  if (list.length) hits.set(id, list); else hits.delete(id);
  return list;
}

/**
 * Seconds to wait if the limit for this kind and key is used up, else 0.
 * Does not count anything; call record() for that.
 */
function retryAfter(kind, key, now = Date.now()) {
  const list = recent(kind, key, now);
  const window = WINDOWS[kind];
  if (list.length < window.max) return 0;
  return Math.max(1, Math.ceil((list[0] + window.ms - now) / 1000));
}

function record(kind, key, now = Date.now()) {
  const list = recent(kind, key, now);
  list.push(now);
  hits.set(`${kind}|${key}`, list);
}

function clear(kind, key) {
  hits.delete(`${kind}|${key}`);
}

// Old entries are dropped as they are read; this sweep stops keys that are
// never read again from piling up.
setInterval(() => {
  const now = Date.now();
  for (const id of hits.keys()) {
    const [kind, ...rest] = id.split("|");
    recent(kind, rest.join("|"), now);
  }
}, 10 * 60 * 1000).unref();

module.exports = { retryAfter, record, clear };

/* =========================================================
   USIAMS - db/accounts.js
   Removing user accounts safely.

   Many tables point at users.id (notifications, requests, loans, the
   audit trail...). Deleting an account row alone would either fail or
   leave records pointing at nobody. removeAccounts() finds every such
   column from the database itself, so tables added later are covered
   too, and for each one:
     - rows that belong to the account - its notifications, sessions,
       reset links, settings, role assignments - are deleted with it;
     - any other record (a request it filed, an announcement it posted,
       an audit entry) stays, and simply no longer names the account.
   ========================================================= */

/** The demo sign-in accounts: the ids and usernames in data/users.js. */
function demoAccounts(seedData) {
  return (seedData.users || []).map(u => ({ id: u.id, username: u.username }));
}

// Tables whose rows are the account's own and go with it.
const OWNED_BY_ACCOUNT = ["notifications", "user_sessions", "password_resets", "user_preferences", "user_roles"];

async function removeAccounts(connection, ids) {
  if (!ids.length) return { removed: 0, cleared: {}, deleted: {} };
  const [links] = await connection.query(`
    SELECT k.TABLE_NAME AS tableName, k.COLUMN_NAME AS columnName, c.IS_NULLABLE AS nullable
    FROM information_schema.KEY_COLUMN_USAGE k
    JOIN information_schema.COLUMNS c
      ON c.TABLE_SCHEMA = k.TABLE_SCHEMA AND c.TABLE_NAME = k.TABLE_NAME AND c.COLUMN_NAME = k.COLUMN_NAME
    WHERE k.TABLE_SCHEMA = DATABASE() AND k.REFERENCED_TABLE_NAME = 'users' AND k.REFERENCED_COLUMN_NAME = 'id'
  `);

  const cleared = {};
  const deleted = {};
  for (const { tableName, columnName, nullable } of links) {
    if (nullable === "YES" && !OWNED_BY_ACCOUNT.includes(tableName)) {
      const [result] = await connection.query(
        `UPDATE \`${tableName}\` SET \`${columnName}\` = NULL WHERE \`${columnName}\` IN (?)`, [ids]);
      if (result.affectedRows) cleared[`${tableName}.${columnName}`] = result.affectedRows;
    } else {
      const [result] = await connection.query(
        `DELETE FROM \`${tableName}\` WHERE \`${columnName}\` IN (?)`, [ids]);
      if (result.affectedRows) deleted[tableName] = (deleted[tableName] || 0) + result.affectedRows;
    }
  }
  const [result] = await connection.query("DELETE FROM users WHERE id IN (?)", [ids]);
  return { removed: result.affectedRows, cleared, deleted };
}

module.exports = { demoAccounts, removeAccounts };

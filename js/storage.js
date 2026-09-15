/* =========================================================
   USIAMS - storage.js
   Thin wrapper around localStorage used to simulate a backend
   database/session store for this frontend prototype.

   NOTE FOR FUTURE BACKEND INTEGRATION:
   Every read/write here is a stand-in for a future Yii2 REST
   endpoint + MySQL table. Keys are namespaced with "usiams."
   so they can be mapped 1:1 to future API resources.
   ========================================================= */
(function (global) {
  "use strict";

  const NAMESPACE = "usiams.";

  function setStorage(key, value) {
    try {
      localStorage.setItem(NAMESPACE + key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error("USIAMS storage write failed for key:", key, err);
      return false;
    }
  }

  function getStorage(key, fallback = null) {
    try {
      const raw = localStorage.getItem(NAMESPACE + key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      console.error("USIAMS storage read failed for key:", key, err);
      return fallback;
    }
  }

  function removeStorage(key) {
    localStorage.removeItem(NAMESPACE + key);
  }

  function ensureSeed(key, seedFactory) {
    const existing = getStorage(key, null);
    if (existing === null) {
      const seeded = typeof seedFactory === "function" ? seedFactory() : seedFactory;
      setStorage(key, seeded);
      return seeded;
    }
    return existing;
  }

  /**
   * createOverlay(name, baseListFn)
   * Generic CRUD-over-static-data pattern used by modules whose base
   * records come from a generated data/*.js file (students, courses,
   * users, ...) but still need Add/Edit/Delete to work in the browser.
   * Additions/edits/deletions are layered on top in localStorage so the
   * original generated dataset never has to be mutated in place.
   */
  function createOverlay(name, baseListFn) {
    const addedKey = `${name}.added`;
    const editedKey = `${name}.edited`;
    const deletedKey = `${name}.deleted`;

    function getAll() {
      const added = getStorage(addedKey, []);
      const edited = getStorage(editedKey, {});
      const deleted = getStorage(deletedKey, []);
      const base = baseListFn().filter(item => !deleted.includes(item.id));
      return [...base, ...added]
        .filter(item => !deleted.includes(item.id))
        .map(item => edited[item.id] ? { ...item, ...edited[item.id] } : item);
    }

    function add(item) {
      const added = getStorage(addedKey, []);
      added.push(item);
      setStorage(addedKey, added);
      return item;
    }

    function update(id, patch) {
      const edited = getStorage(editedKey, {});
      edited[id] = { ...(edited[id] || {}), ...patch, id };
      setStorage(editedKey, edited);
      // If the record was itself an in-session addition, patch it directly.
      const added = getStorage(addedKey, []);
      const idx = added.findIndex(a => a.id === id);
      if (idx !== -1) { added[idx] = { ...added[idx], ...patch }; setStorage(addedKey, added); }
    }

    function remove(id) {
      const deleted = getStorage(deletedKey, []);
      if (!deleted.includes(id)) deleted.push(id);
      setStorage(deletedKey, deleted);
    }

    return { getAll, add, update, remove };
  }

  function nextId(prefix, list) {
    const nums = (list || [])
      .map(item => {
        const m = String(item.id || "").match(/(\d+)$/);
        return m ? parseInt(m[1], 10) : 0;
      });
    const max = nums.length ? Math.max(...nums) : 0;
    return `${prefix}-${String(max + 1).padStart(4, "0")}`;
  }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.storage = { setStorage, getStorage, removeStorage, ensureSeed, nextId, createOverlay };

  // Also expose top-level helpers as required by spec (setStorage/getStorage/removeStorage)
  global.setStorage = setStorage;
  global.getStorage = getStorage;
  global.removeStorage = removeStorage;

})(window);

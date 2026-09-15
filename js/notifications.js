/* =========================================================
   USIAMS - js/notifications.js
   Notification store (localStorage-backed) + rendering for
   pages/notifications.html and the navbar unread badge.
   ========================================================= */
(function (global) {
  "use strict";

  const KEY = "notifications";

  function all() {
    return global.USIAMS.storage.ensureSeed(KEY, () => global.USIAMS.data.seedNotifications);
  }

  function forUser(user) {
    return all().filter(n => n.target === user.id || n.target === "ALL");
  }

  function unreadCountFor(userId) {
    const user = { id: userId };
    return all().filter(n => (n.target === userId || n.target === "ALL") && !n.read).length;
  }

  function markRead(id) {
    const list = all().map(n => n.id === id ? { ...n, read: true } : n);
    global.USIAMS.storage.setStorage(KEY, list);
  }

  function markAllRead(user) {
    const list = all().map(n => (n.target === user.id || n.target === "ALL") ? { ...n, read: true } : n);
    global.USIAMS.storage.setStorage(KEY, list);
  }

  function remove(id) {
    const list = all().filter(n => n.id !== id);
    global.USIAMS.storage.setStorage(KEY, list);
  }

  function categoryIcon(category) {
    const map = {
      Academic: { icon: "bi-mortarboard", tint: "primary" },
      Finance: { icon: "bi-cash-coin", tint: "warning" },
      Registration: { icon: "bi-pencil-square", tint: "info" },
      Results: { icon: "bi-clipboard-data", tint: "success" },
      System: { icon: "bi-gear", tint: "gold" },
      Requests: { icon: "bi-envelope-paper", tint: "danger" }
    };
    return map[category] || { icon: "bi-bell", tint: "info" };
  }

  function initPage() {
    const user = global.USIAMS.auth.requireAuth();
    if (!user) return;

    function render() {
      const list = forUser(user).sort((a, b) => new Date(b.date) - new Date(a.date));
      const container = document.getElementById("notificationList");
      const { escapeHtml, formatDateTime, timeAgo } = global.USIAMS.util;
      if (!list.length) {
        container.innerHTML = `<div class="empty-state"><i class="bi bi-bell-slash"></i>You have no notifications yet.</div>`;
        return;
      }
      container.innerHTML = list.map(n => {
        const meta = categoryIcon(n.category);
        return `
          <div class="notif-item ${n.read ? "" : "unread"}" data-id="${n.id}">
            <div class="notif-icon icon-tint-${meta.tint}"><i class="bi ${meta.icon}"></i></div>
            <div class="flex-grow-1">
              <div class="d-flex justify-content-between align-items-start gap-2">
                <div class="notif-title">${escapeHtml(n.title)}</div>
                <span class="badge text-bg-light border">${escapeHtml(n.category)}</span>
              </div>
              <div class="notif-desc">${escapeHtml(n.description)}</div>
              <div class="notif-time" title="${formatDateTime(n.date)}">${timeAgo(n.date)}</div>
            </div>
            <div class="d-flex flex-column gap-1">
              ${!n.read ? `<button class="btn btn-sm btn-outline-secondary" data-action="read" title="Mark as read"><i class="bi bi-check2"></i></button>` : ""}
              <button class="btn btn-sm btn-outline-danger" data-action="delete" title="Delete"><i class="bi bi-trash"></i></button>
            </div>
          </div>`;
      }).join("");

      container.querySelectorAll("[data-action='read']").forEach(btn => {
        btn.addEventListener("click", (e) => { markRead(e.target.closest(".notif-item").dataset.id); render(); refreshBadge(); });
      });
      container.querySelectorAll("[data-action='delete']").forEach(btn => {
        btn.addEventListener("click", (e) => { remove(e.target.closest(".notif-item").dataset.id); render(); refreshBadge(); global.USIAMS.toast.show("success", "Notification removed", "The notification has been deleted."); });
      });
    }

    function refreshBadge() {
      const badge = document.querySelector(".navbar-icon-btn .count-badge");
      const count = unreadCountFor(user.id);
      if (badge) { if (count) badge.textContent = count > 9 ? "9+" : count; else badge.remove(); }
    }

    document.getElementById("markAllReadBtn")?.addEventListener("click", () => {
      markAllRead(user);
      render();
      refreshBadge();
      global.USIAMS.toast.show("success", "All caught up", "All notifications have been marked as read.");
    });

    render();
  }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.notifications = { all, forUser, unreadCountFor, markRead, markAllRead, remove, categoryIcon, initPage };

})(window);

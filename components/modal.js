/* =========================================================
   USIAMS - components/modal.js
   Generic modal helpers built on top of Bootstrap 5 modals.
   Provides: open(id), close(id), confirm({...}), renderInto(html)
   ========================================================= */
(function (global) {
  "use strict";

  function getRootModalContainer() {
    let root = document.getElementById("usiModalRoot");
    if (!root) {
      root = document.createElement("div");
      root.id = "usiModalRoot";
      document.body.appendChild(root);
    }
    return root;
  }

  function renderInto(html) {
    const root = getRootModalContainer();
    root.innerHTML = html;
    const modalEl = root.querySelector(".modal");
    const instance = new bootstrap.Modal(modalEl);
    modalEl.addEventListener("hidden.bs.modal", () => { root.innerHTML = ""; });
    instance.show();
    return { modalEl, instance };
  }

  function close() {
    const root = getRootModalContainer();
    const modalEl = root.querySelector(".modal");
    if (modalEl) {
      const instance = bootstrap.Modal.getInstance(modalEl);
      if (instance) instance.hide();
    }
  }

  /**
   * confirm({title, message, confirmText, variant, onConfirm})
   * Renders a confirmation dialog and wires the confirm button.
   */
  function confirm({ title = "Please confirm", message = "Are you sure?", confirmText = "Confirm", variant = "danger", onConfirm }) {
    const html = `
      <div class="modal fade" tabindex="-1" aria-modal="true" role="dialog">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">${global.USIAMS.util.escapeHtml(title)}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <p class="mb-0">${message}</p>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-${variant}" id="usiConfirmActionBtn">${global.USIAMS.util.escapeHtml(confirmText)}</button>
            </div>
          </div>
        </div>
      </div>`;
    const { modalEl } = renderInto(html);
    modalEl.querySelector("#usiConfirmActionBtn").addEventListener("click", () => {
      if (typeof onConfirm === "function") onConfirm();
      close();
    });
  }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.modal = { renderInto, close, confirm };

})(window);

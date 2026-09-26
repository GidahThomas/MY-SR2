/* =========================================================
   USIAMS - js/finance.page.js
   Finance & Fees page (student view + finance/admin view).
   Every payment is a government payment through GePG (Government
   Electronic Payment Gateway): the student is issued a GePG control
   number and pays it by mobile money or bank. GePG itself is not
   connected, so confirming a payment simulates its callback.
   ========================================================= */
(function (global) {
  "use strict";

  const { util, modal, toast, charts } = global.USIAMS;
  const { paymentsForStudent, balanceForStudent } = global.USIAMS.finance;

  // ---------------------------------------------------------------------
  // STUDENT VIEW
  // ---------------------------------------------------------------------
  function renderStudentView(user) {
    const student = global.USIAMS.students.getStudent(user.studentId);
    const invoice = global.USIAMS.finance.invoiceForStudent(student.id);
    const balance = balanceForStudent(student.id);
    const payments = paymentsForStudent(student.id).sort((a, b) => new Date(b.date) - new Date(a.date));

    document.getElementById("financeSubtitle").textContent = `${util.studentLabel(student, user)} (${student.regNumber})`;
    global.USIAMS.cards.renderStatGrid("statGrid", [
      { label: "Total Fees", value: util.formatCurrency(balance.billed), icon: "bi-receipt", tint: "primary" },
      { label: "Paid", value: util.formatCurrency(balance.paid), icon: "bi-check2-circle", tint: "success" },
      { label: "Balance", value: util.formatCurrency(balance.balance), icon: "bi-exclamation-circle", tint: balance.balance > 0 ? "warning" : "success" },
      { label: "Payments Made", value: payments.length, icon: "bi-cash-stack", tint: "info" }
    ]);

    // A newly admitted student has not been billed yet. That is a normal
    // state, not a paid-up one: there is no invoice to open and nothing to
    // pay against, so say so rather than claiming the fees are cleared.
    const alert = document.getElementById("financeBalanceAlert");
    if (!invoice) {
      alert.className = "alert alert-info mb-3";
      alert.innerHTML = `<strong><i class="bi bi-info-circle me-1"></i>No fees billed yet.</strong> Your invoice for this academic year has not been issued. It will appear here once the Finance Office raises it.`;
    } else {
      alert.className = `alert ${balance.balance <= 0 ? "alert-success" : "alert-warning"} mb-3`;
      alert.innerHTML = balance.balance <= 0
        ? `<strong><i class="bi bi-check-circle me-1"></i>Fees fully paid.</strong> Your total payments of ${util.formatCurrency(balance.paid)} cover the full debit of ${util.formatCurrency(balance.billed)}.`
        : `<strong><i class="bi bi-exclamation-circle me-1"></i>Outstanding debit:</strong> ${util.formatCurrency(balance.balance)} remains after payments of ${util.formatCurrency(balance.paid)} against total fees of ${util.formatCurrency(balance.billed)}.`;
    }

    // Both actions need an invoice behind them.
    const viewInvoiceBtn = document.getElementById("viewInvoiceBtn");
    const makePaymentBtn = document.getElementById("makePaymentBtn");
    viewInvoiceBtn.disabled = !invoice;
    // Tuition is only one of the things a student can pay for, so the button
    // stays available even when there is no tuition balance.
    makePaymentBtn.disabled = false;
    viewInvoiceBtn.onclick = () => {
      if (!invoice) { toast.show("info", "No invoice yet", "Your invoice for this academic year has not been issued."); return; }
      openInvoiceModal(student, invoice, balance, user);
    };
    makePaymentBtn.onclick = () => openPaymentModal(student, user);

    const tbody = document.getElementById("paymentHistoryBody");
    tbody.innerHTML = payments.length ? payments.map(p => `
      <tr>
        <td>${util.formatDate(p.date)}</td>
        <td>${util.escapeHtml(p.controlNumber || p.reference)}</td>
        <td>${util.escapeHtml(feeItemName(p))}</td>
        <td>${util.escapeHtml(methodLabel(p))}</td>
        <td>${util.formatCurrency(p.amount)}</td>
        <td><span class="status-badge status-active">${p.status}</span></td>
        <td><button class="btn btn-sm btn-outline-secondary" data-action="receipt" data-id="${p.id}"><i class="bi bi-receipt"></i> Receipt</button></td>
      </tr>`).join("") : `<tr><td colspan="7"><div class="empty-state"><i class="bi bi-cash"></i>No payments recorded yet.</div></td></tr>`;

    renderControlNumbers(student, user);

    tbody.querySelectorAll("[data-action='receipt']").forEach(btn => btn.addEventListener("click", () => openReceiptModal(student, payments.find(p => p.id === btn.dataset.id), user)));

    // Only worth announcing when there was actually a debit to clear - a
    // student who has not been billed has a zero balance but has paid nothing.
    if (invoice && balance.billed > 0 && balance.balance <= 0 && global.USIAMS.notifications) {
      global.USIAMS.notifications.add({
        id: `NTF-FEE-PAID-${student.id}-${invoice.id}`,
        target: user.id,
        category: "Finance",
        title: "Fees Fully Paid",
        description: `Your payments of ${util.formatCurrency(balance.paid)} have cleared the full debit of ${util.formatCurrency(balance.billed)} for ${invoice.description}.`,
        date: new Date().toISOString(),
        read: false
      });
    }
  }

  function openInvoiceModal(student, invoice, balance, user) {
    modal.renderInto(`
      <div class="modal fade" tabindex="-1"><div class="modal-dialog"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">Invoice ${invoice.id}</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body print-doc">
          <div class="print-header"><strong>USIAMS</strong><span>${util.formatDate(invoice.issuedDate)}</span></div>
          <p><strong>Billed to:</strong> ${util.escapeHtml(util.studentLabel(student, user))} (${student.regNumber})</p>
          <p>${util.escapeHtml(invoice.description)}</p>
          <table class="usi-table"><tbody>
            <tr><td>Amount Billed</td><td class="text-end">${util.formatCurrency(invoice.amountBilled)}</td></tr>
            <tr><td>Amount Paid</td><td class="text-end">${util.formatCurrency(balance.paid)}</td></tr>
            <tr><td><strong>Balance Due</strong></td><td class="text-end"><strong>${util.formatCurrency(balance.balance)}</strong></td></tr>
          </tbody></table>
          <p class="text-muted-usi" style="font-size:.78rem;">Due Date: ${util.formatDate(invoice.dueDate)}</p>
        </div>
        <div class="modal-footer no-print"><button class="btn btn-outline-secondary" data-bs-dismiss="modal">Close</button><button class="btn btn-primary" style="background:var(--primary);border-color:var(--primary);" onclick="window.print()"><i class="bi bi-printer me-1"></i>Print</button></div>
      </div></div></div>
    `);
  }

  function openReceiptModal(student, payment, user) {
    if (!payment) return;
    modal.renderInto(`
      <div class="modal fade" tabindex="-1"><div class="modal-dialog"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">Government Payment Receipt (GePG)</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body print-doc">
          <div class="print-header"><strong>USIAMS</strong><span>${util.formatDate(payment.date)}</span></div>
          <p><strong>Received from:</strong> ${util.escapeHtml(util.studentLabel(student, user))} (${student.regNumber})</p>
          <table class="usi-table"><tbody>
            <tr><td>Payment Type</td><td class="text-end">Government payment (GePG)</td></tr>
            <tr><td>${payment.controlNumber ? "GePG Control Number" : "Reference"}</td><td class="text-end">${util.escapeHtml(payment.controlNumber || payment.reference)}</td></tr>
            <tr><td>Paid For</td><td class="text-end">${util.escapeHtml(feeItemName(payment))}</td></tr>
            <tr><td>Method</td><td class="text-end">${util.escapeHtml(methodLabel(payment))}</td></tr>
            <tr><td><strong>Amount Paid</strong></td><td class="text-end"><strong>${util.formatCurrency(payment.amount)}</strong></td></tr>
          </tbody></table>
          <p class="text-muted-usi" style="font-size:.78rem;">Paid through GePG, the Government Electronic Payment Gateway. This is a simulated receipt for demonstration purposes only.</p>
        </div>
        <div class="modal-footer no-print"><button class="btn btn-outline-secondary" data-bs-dismiss="modal">Close</button><button class="btn btn-primary" style="background:var(--primary);border-color:var(--primary);" onclick="window.print()"><i class="bi bi-printer me-1"></i>Print Receipt</button></div>
      </div></div></div>
    `);
  }

  // ---------------------------------------------------------------------
  // CONTROL-NUMBER PAYMENTS
  // The student picks what to pay for and is issued a control number at
  // once; the payment methods (and how to pay with each) come from the API.
  // ---------------------------------------------------------------------
  const api = global.USIAMS.api;
  let feeItemNames = {};

  /** 0712345678 / 255712345678 -> 0712***678; bank accounts -> ****6789. */
  function maskAccount(value) {
    let digits = String(value || "").replace(/\D/g, "");
    if (!digits) return "";
    if (/^255\d{9}$/.test(digits)) digits = "0" + digits.slice(3);
    if (/^0\d{9}$/.test(digits)) return digits.slice(0, 4) + "***" + digits.slice(-3);
    return "****" + digits.slice(-4);
  }

  /** "M-Pesa" or "M-Pesa (0712***678)" when the paying number is known. */
  function methodLabel(payment) {
    return payment.payerAccount ? `${payment.method} (${maskAccount(payment.payerAccount)})` : payment.method;
  }

  function feeItemName(payment) {
    if (payment.feeItemId) return feeItemNames[payment.feeItemId] || payment.feeItemId;
    return "Tuition fee";
  }

  async function loadFeeItems() {
    const result = await api.request("/api/finance/fee-items");
    feeItemNames = Object.fromEntries(result.data.map(i => [i.id, i.name]));
    return result.data;
  }

  function controlNumberCard(bill) {
    return `
      <div class="border rounded-3 p-3 text-center" style="background:var(--primary-light);">
        <div class="text-muted-usi" style="font-size:.78rem;">GePG Control Number &middot; Government Payment</div>
        <div class="d-flex align-items-center justify-content-center gap-2">
          <strong id="cnValue" style="font-size:1.6rem;letter-spacing:.08em;color:var(--primary);">${util.escapeHtml(bill.controlNumber)}</strong>
          <button type="button" class="btn btn-sm btn-outline-primary" id="cnCopyBtn" title="Copy control number"><i class="bi bi-clipboard"></i></button>
        </div>
        <div style="font-size:.85rem;">${util.escapeHtml(bill.description)} &middot; <strong>${util.formatCurrency(bill.amount)}</strong></div>
        <div class="text-muted-usi" style="font-size:.75rem;">Valid until ${util.formatDateTime(bill.expiresAt)}${bill.reused ? " &middot; your existing control number for this item" : ""}</div>
      </div>`;
  }

  /**
   * Step 1 pick what to pay for -> control number issued immediately.
   * Step 2 pick a payment method (from the API) -> how to pay with it.
   * Step 3 confirm. There is no real gateway, so confirming simulates the
   * gateway's "paid" notification and records the payment.
   */
  async function openPaymentModal(student, user, presetBill) {
    modal.renderInto(`
      <div class="modal fade" tabindex="-1"><div class="modal-dialog"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">Make a Government Payment (GePG)</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body">
          <div class="alert alert-light border mb-3" style="font-size:.82rem;"><i class="bi bi-bank me-1"></i>Every university payment is a <strong>government payment</strong> made through <strong>GePG</strong> (Government Electronic Payment Gateway). You pay with the GePG control number issued below.</div>
          <label class="form-label" for="payItem">1. What are you paying for?</label>
          <select class="form-select" id="payItem"><option value="">Loading...</option></select>
          <div class="mt-2 d-none" id="payAmountWrap">
            <label class="form-label" for="payAmount" style="font-size:.85rem;">Amount to pay (TZS) - you may pay tuition in instalments</label>
            <div class="input-group">
              <input type="number" class="form-control" id="payAmount" min="1" step="1">
              <button type="button" class="btn btn-outline-primary" id="payAmountBtn">Update control number</button>
            </div>
          </div>
          <div class="mt-3" id="payBill"></div>
          <div class="mt-3 d-none" id="payMethodWrap">
            <label class="form-label" for="payMethod">2. Choose a payment method</label>
            <select class="form-select" id="payMethod"><option value="">Loading...</option></select>
            <div class="alert alert-info mt-2 mb-0 d-none" id="payInstructions" style="font-size:.85rem;"></div>
            <div class="mt-3 d-none" id="payAccountWrap">
              <label class="form-label" for="payAccount" id="payAccountLabel">3. Mobile number paying</label>
              <input type="tel" class="form-control" id="payAccount" inputmode="numeric" autocomplete="tel">
              <div class="form-text" id="payAccountHint"></div>
              <div class="invalid-feedback" id="payAccountError"></div>
            </div>
          </div>
          <div id="payError" class="alert alert-danger mt-3 mb-0 d-none"></div>
          <p class="text-muted-usi mt-3 mb-0" style="font-size:.75rem;">Demonstration system: GePG is not connected, so confirming below simulates GePG reporting the payment as received.</p>
        </div>
        <div class="modal-footer"><button class="btn btn-outline-secondary" data-bs-dismiss="modal">Close</button><button class="btn btn-primary" id="payConfirmBtn" disabled>4. Confirm Payment</button></div>
      </div></div></div>
    `);

    const itemSelect = document.getElementById("payItem");
    const amountWrap = document.getElementById("payAmountWrap");
    const amountInput = document.getElementById("payAmount");
    const billBox = document.getElementById("payBill");
    const methodWrap = document.getElementById("payMethodWrap");
    const methodSelect = document.getElementById("payMethod");
    const instructions = document.getElementById("payInstructions");
    const errorBox = document.getElementById("payError");
    const confirmBtn = document.getElementById("payConfirmBtn");
    const accountWrap = document.getElementById("payAccountWrap");
    const accountInput = document.getElementById("payAccount");
    let items = [];
    let methods = [];
    let bill = null;

    const showError = message => { errorBox.textContent = message; errorBox.classList.toggle("d-none", !message); };
    const selectedMethod = () => methods.find(m => m.id === methodSelect.value);
    // Same rules as the server: a Tanzanian mobile number (07/06..., or
    // 2557/2556...) for mobile money, 8-20 digits for a bank account.
    function accountValid() {
      const method = selectedMethod();
      const digits = accountInput.value.replace(/[\s+-]/g, "");
      if (!method || !/^\d+$/.test(digits)) return false;
      return method.channel === "Mobile Money"
        ? /^0[67]\d{8}$/.test(digits) || /^255[67]\d{8}$/.test(digits)
        : /^\d{8,20}$/.test(digits);
    }
    const updateConfirm = () => { confirmBtn.disabled = !bill || !methodSelect.value || !accountValid(); };

    function showBill(issued) {
      bill = issued;
      billBox.innerHTML = controlNumberCard(bill);
      document.getElementById("cnCopyBtn").addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(bill.controlNumber); toast.show("success", "Copied", "Control number copied."); }
        catch (e) { toast.show("info", "Control number", bill.controlNumber); }
      });
      methodWrap.classList.remove("d-none");
      updateConfirm();
    }

    async function requestControlNumber() {
      const item = items.find(i => i.id === itemSelect.value);
      bill = null; billBox.innerHTML = ""; methodWrap.classList.add("d-none"); showError(""); updateConfirm();
      amountWrap.classList.toggle("d-none", !item || item.kind !== "TUITION");
      if (!item) return;
      billBox.innerHTML = `<div class="text-muted-usi" style="font-size:.85rem;"><span class="spinner-border spinner-border-sm me-2"></span>Generating control number...</div>`;
      try {
        const body = { feeItemId: item.id };
        if (item.kind === "TUITION") body.amount = Number(amountInput.value);
        const result = await api.request("/api/finance/control-numbers", { method: "POST", body });
        showBill(result.data);
        renderControlNumbers(student, user);
      } catch (error) {
        billBox.innerHTML = "";
        showError(error.message || "Could not generate a control number.");
      }
    }

    try {
      [items, methods] = await Promise.all([
        loadFeeItems(),
        api.request("/api/finance/payment-methods").then(r => r.data)
      ]);
    } catch (error) {
      showError("Could not load fee items and payment methods: " + (error.message || "server unavailable"));
      return;
    }

    itemSelect.innerHTML = `<option value="">Select what to pay for...</option>` + items.map(i => `
      <option value="${util.escapeHtml(i.id)}" ${i.available ? "" : "disabled"}>${util.escapeHtml(i.name)} - ${i.available ? util.formatCurrency(i.amount) : util.escapeHtml(i.note || "not available")}</option>`).join("");
    methodSelect.innerHTML = `<option value="">Select a payment method...</option>` + ["Mobile Money", "Bank"].map(channel => {
      const group = methods.filter(m => m.channel === channel);
      return group.length ? `<optgroup label="${channel}">${group.map(m => `<option value="${util.escapeHtml(m.id)}">${util.escapeHtml(m.name)}</option>`).join("")}</optgroup>` : "";
    }).join("");

    itemSelect.addEventListener("change", () => {
      const item = items.find(i => i.id === itemSelect.value);
      if (item && item.kind === "TUITION") amountInput.value = item.amount;
      requestControlNumber();
    });
    document.getElementById("payAmountBtn").addEventListener("click", requestControlNumber);
    methodSelect.addEventListener("change", () => {
      const method = methods.find(m => m.id === methodSelect.value);
      instructions.classList.toggle("d-none", !method);
      if (method) instructions.innerHTML = `<strong>How to pay with ${util.escapeHtml(method.name)}:</strong> ${util.escapeHtml(method.instructions)}${bill ? ` Control number: <strong>${util.escapeHtml(bill.controlNumber)}</strong>, amount: <strong>${util.formatCurrency(bill.amount)}</strong>.` : ""}`;

      // Step 3: the number the money comes from.
      accountWrap.classList.toggle("d-none", !method);
      accountInput.value = "";
      accountInput.classList.remove("is-invalid", "is-valid");
      if (method) {
        const mobile = method.channel === "Mobile Money";
        document.getElementById("payAccountLabel").textContent = mobile
          ? `3. ${method.name} number paying` : `3. ${method.name} account number paying`;
        accountInput.placeholder = mobile ? "e.g. 0712345678" : "e.g. 0150123456789";
        accountInput.setAttribute("inputmode", "numeric");
        document.getElementById("payAccountHint").textContent = mobile
          ? `The ${method.name} number that has the money. You will approve the payment on that phone.`
          : `The ${method.name} account the money will be taken from.`;
        document.getElementById("payAccountError").textContent = mobile
          ? "Enter a valid mobile number: 10 digits starting 07 or 06, or 12 digits starting 255."
          : "Enter a valid account number: 8 to 20 digits.";
        accountInput.focus();
      }
      updateConfirm();
    });

    accountInput.addEventListener("input", () => {
      const filled = accountInput.value.trim() !== "";
      accountInput.classList.toggle("is-valid", filled && accountValid());
      accountInput.classList.toggle("is-invalid", filled && !accountValid() && accountInput.value.replace(/\D/g, "").length >= 10);
      updateConfirm();
    });
    accountInput.addEventListener("blur", () => {
      accountInput.classList.toggle("is-invalid", accountInput.value.trim() !== "" && !accountValid());
    });

    confirmBtn.addEventListener("click", async () => {
      if (!bill || !methodSelect.value) return;
      if (!accountValid()) { accountInput.classList.add("is-invalid"); accountInput.focus(); return; }
      const method = selectedMethod();
      const masked = maskAccount(accountInput.value);
      confirmBtn.disabled = true; showError("");
      // A real gateway would now push a prompt to that phone / account and
      // call back once the payer approves; this stands in for that wait.
      const originalLabel = confirmBtn.innerHTML;
      confirmBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>${method.channel === "Mobile Money" ? `Waiting for approval on ${util.escapeHtml(masked)}...` : "Processing..."}`;
      if (method.channel === "Mobile Money") {
        instructions.innerHTML = `<strong>Payment request sent to ${util.escapeHtml(masked)}.</strong> Approve the ${util.formatCurrency(bill.amount)} government payment (GePG) with ${util.escapeHtml(method.name)} for control number <strong>${util.escapeHtml(bill.controlNumber)}</strong> by entering your PIN on that phone.`;
      }
      await new Promise(resolve => setTimeout(resolve, 1500));
      try {
        const result = await api.request(`/api/finance/control-numbers/${encodeURIComponent(bill.controlNumber)}/pay`, {
          method: "POST", body: { paymentMethodId: method.id, payerAccount: accountInput.value }
        });
        await api.reload("payments");
        modal.close();
        renderStudentView(user);
        toast.show("success", "Government payment received (GePG)",
          `${util.formatCurrency(result.data.amount)} for control number ${result.data.controlNumber} was paid by ${result.data.method} from ${result.data.payerAccount}.`);
      } catch (error) {
        confirmBtn.innerHTML = originalLabel;
        showError(error.message || "The payment could not be recorded.");
        updateConfirm();
      }
    });

    // Opened from the Control Numbers list: show that bill straight away.
    if (presetBill) {
      itemSelect.value = presetBill.feeItemId;
      amountWrap.classList.add("d-none");
      showBill(presetBill);
    }
  }

  async function renderControlNumbers(student, user) {
    const tbody = document.getElementById("controlNumbersBody");
    if (!tbody) return;
    try {
      if (!Object.keys(feeItemNames).length) await loadFeeItems();
      const result = await api.request("/api/finance/control-numbers");
      const bills = result.data;
      const statusClass = { Pending: "status-pending", Paid: "status-active", Expired: "status-inactive", Cancelled: "status-inactive" };
      tbody.innerHTML = bills.length ? bills.map(b => `
        <tr>
          <td><strong>${util.escapeHtml(b.controlNumber)}</strong></td>
          <td>${util.escapeHtml(b.description)}</td>
          <td>${util.formatCurrency(b.amount)}</td>
          <td>${util.formatDateTime(b.expiresAt)}</td>
          <td><span class="status-badge ${statusClass[b.status] || ""}">${b.status}</span></td>
          <td>${b.status === "Pending" ? `<button class="btn btn-sm btn-primary" data-action="pay-bill" data-cn="${util.escapeHtml(b.controlNumber)}"><i class="bi bi-credit-card"></i> Pay</button>` : ""}</td>
        </tr>`).join("")
        : `<tr><td colspan="6"><div class="empty-state"><i class="bi bi-upc"></i>No control numbers yet. Choose Make Payment and select what you are paying for.</div></td></tr>`;
      tbody.querySelectorAll("[data-action='pay-bill']").forEach(btn => btn.addEventListener("click", () =>
        openPaymentModal(student, user, bills.find(b => b.controlNumber === btn.dataset.cn))));
    } catch (error) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-muted-usi">Control numbers are unavailable: ${util.escapeHtml(error.message || "server error")}</td></tr>`;
    }
  }

  // ---------------------------------------------------------------------
  // FINANCE / ADMIN VIEW
  // ---------------------------------------------------------------------
  function renderAdminView(user) {
    document.getElementById("financeSubtitle").textContent = "University-wide fee collection overview.";
    const invoices = global.USIAMS.data.invoices;
    const payments = global.USIAMS.finance.allPayments();
    const totalBilled = invoices.reduce((s, i) => s + Number(i.amountBilled), 0);
    const totalCollected = payments.reduce((s, p) => s + Number(p.amount), 0);
    // Only tuition payments count against tuition invoices; other fees paid
    // by control number are collected but were never part of the billing.
    const tuitionCollected = payments.filter(p => !p.feeItemId || p.feeItemId === "TUITION").reduce((s, p) => s + Number(p.amount), 0);

    global.USIAMS.cards.renderStatGrid("statGrid", [
      { label: "Total Billed", value: util.formatCurrency(totalBilled), icon: "bi-receipt", tint: "primary" },
      { label: "Total Collected", value: util.formatCurrency(totalCollected), icon: "bi-cash-stack", tint: "success" },
      { label: "Outstanding Balance", value: util.formatCurrency(totalBilled - tuitionCollected), icon: "bi-exclamation-circle", tint: "warning" },
      { label: "Transactions", value: payments.length, icon: "bi-arrow-left-right", tint: "info" }
    ]);

    charts.lineChart("collectionTrendChart", ["Aug", "Sep (W1)", "Sep (W2)", "Sep (W3)", "Sep (W4)"], [
      { label: "Collected (TZS M)", data: [12, 18, 24, 31, Math.round(totalCollected / 1e6)] }
    ]);
    charts.doughnutChart("paidVsOutstandingChart", ["Collected", "Outstanding"], [tuitionCollected, totalBilled - tuitionCollected]);

    const byDept = global.USIAMS.data.departments.map(d => ({
      name: d.id,
      billed: global.USIAMS.data.students.filter(s => s.departmentId === d.id).reduce((s, st) => s + global.USIAMS.finance.annualFeeFor(st), 0)
    })).filter(d => d.billed > 0);
    charts.barChart("feesByProgrammeChart", byDept.map(d => d.name), [{ label: "Billed (TZS)", data: byDept.map(d => d.billed) }]);

    const tbody = document.getElementById("transactionsTableBody");
    const recent = [...payments].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 15);
    tbody.innerHTML = recent.map(p => {
      const student = global.USIAMS.students.getStudent(p.studentId);
      return `<tr>
        <td>${util.formatDate(p.date)}</td>
        <td>${student ? util.escapeHtml(util.studentLabel(student, user)) : p.studentId}</td>
        <td>${util.escapeHtml(p.controlNumber || p.reference)}${p.feeItemId ? `<div class="text-muted-usi" style="font-size:.72rem;">${util.escapeHtml(feeItemName(p))}</div>` : ""}</td>
        <td>${util.escapeHtml(methodLabel(p))}</td>
        <td>${util.formatCurrency(p.amount)}</td>
        <td><span class="status-badge status-active">${p.status}</span></td>
      </tr>`;
    }).join("");

    document.getElementById("exportFinanceCsvBtn").addEventListener("click", () => {
      util.downloadCsv("finance-transactions", payments.map(p => ({
        Date: p.date, Student: p.studentId, Reference: p.reference, Method: p.method, "Paid From": p.payerAccount || "", Amount: p.amount, Status: p.status
      })));
    });
  }

  async function initPage(user) {
    const isStudent = user.role === "STUDENT";
    ["adminFinanceActions", "adminFinanceSection"].forEach(id => document.getElementById(id).classList.toggle("d-none", isStudent));
    document.getElementById("studentFinanceActions").classList.toggle("d-none", !isStudent);
    document.getElementById("studentFinanceSection").classList.toggle("d-none", !isStudent);
    // Fee item names label what each payment was for.
    try { await loadFeeItems(); } catch (error) { /* labels fall back to the item id */ }
    if (isStudent) renderStudentView(user);
    else renderAdminView(user);
  }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.financePage = { initPage };

})(window);

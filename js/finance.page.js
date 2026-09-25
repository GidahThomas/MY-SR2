/* =========================================================
   USIAMS - js/finance.page.js
   Finance & Fees page (student view + finance/admin view).
   Payments are simulated only - no real payment gateway is
   contacted. New demo payments are layered onto data/finance.js
   via a localStorage overlay, same pattern as students/courses.
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
    makePaymentBtn.disabled = !invoice || balance.balance <= 0;
    viewInvoiceBtn.onclick = () => {
      if (!invoice) { toast.show("info", "No invoice yet", "Your invoice for this academic year has not been issued."); return; }
      openInvoiceModal(student, invoice, balance, user);
    };
    makePaymentBtn.onclick = () => {
      if (!invoice) { toast.show("info", "Nothing to pay", "You have no invoice to pay against yet."); return; }
      if (balance.balance <= 0) { toast.show("info", "Nothing outstanding", "Your fees are already fully paid."); return; }
      openPaymentModal(student, balance, user);
    };

    const tbody = document.getElementById("paymentHistoryBody");
    tbody.innerHTML = payments.length ? payments.map(p => `
      <tr>
        <td>${util.formatDate(p.date)}</td>
        <td>${util.escapeHtml(p.reference)}</td>
        <td>${util.escapeHtml(p.method)}</td>
        <td>${util.formatCurrency(p.amount)}</td>
        <td><span class="status-badge status-active">${p.status}</span></td>
        <td><button class="btn btn-sm btn-outline-secondary" data-action="receipt" data-id="${p.id}"><i class="bi bi-receipt"></i> Receipt</button></td>
      </tr>`).join("") : `<tr><td colspan="6"><div class="empty-state"><i class="bi bi-cash"></i>No payments recorded yet.</div></td></tr>`;

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
        <div class="modal-header"><h5 class="modal-title">Payment Receipt</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body print-doc">
          <div class="print-header"><strong>USIAMS</strong><span>${util.formatDate(payment.date)}</span></div>
          <p><strong>Received from:</strong> ${util.escapeHtml(util.studentLabel(student, user))} (${student.regNumber})</p>
          <table class="usi-table"><tbody>
            <tr><td>Reference</td><td class="text-end">${util.escapeHtml(payment.reference)}</td></tr>
            <tr><td>Method</td><td class="text-end">${util.escapeHtml(payment.method)}</td></tr>
            <tr><td><strong>Amount Paid</strong></td><td class="text-end"><strong>${util.formatCurrency(payment.amount)}</strong></td></tr>
          </tbody></table>
          <p class="text-muted-usi" style="font-size:.78rem;">This is a simulated receipt for demonstration purposes only.</p>
        </div>
        <div class="modal-footer no-print"><button class="btn btn-outline-secondary" data-bs-dismiss="modal">Close</button><button class="btn btn-primary" style="background:var(--primary);border-color:var(--primary);" onclick="window.print()"><i class="bi bi-printer me-1"></i>Print Receipt</button></div>
      </div></div></div>
    `);
  }

  function openPaymentModal(student, balance, user) {
    if (balance.balance <= 0) { toast.show("info", "No balance due", "This student has no outstanding balance."); return; }
    modal.renderInto(`
      <div class="modal fade" tabindex="-1"><div class="modal-dialog"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">Make a Payment</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body">
          <p class="text-muted-usi" style="font-size:.82rem;">This is a simulated payment for demonstration purposes. No real transaction will be processed.</p>
          <label class="form-label">Amount (TZS)</label><input type="number" class="form-control mb-3" id="paymentAmount" max="${balance.balance}" value="${Math.min(balance.balance, 500000)}">
          <label class="form-label">Payment Method</label>
          <select class="form-select" id="paymentMethod"><option>Mobile Money (M-Pesa)</option><option>Mobile Money (Tigo Pesa)</option><option>Bank Transfer</option><option>Direct Bank Deposit</option></select>
        </div>
        <div class="modal-footer"><button class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button><button class="btn btn-primary" id="submitPaymentBtn" style="background:var(--primary);border-color:var(--primary);">Submit Payment</button></div>
      </div></div></div>
    `);
    document.getElementById("submitPaymentBtn").addEventListener("click", () => {
      const amount = parseFloat(document.getElementById("paymentAmount").value);
      if (!amount || amount <= 0 || amount > balance.balance) { toast.show("error", "Invalid amount", "Please enter a valid amount not exceeding your balance."); return; }
      const invoice = global.USIAMS.finance.invoiceForStudent(student.id);
      if (!invoice) { toast.show("error", "No invoice", "There is no invoice to pay against."); return; }
      global.USIAMS.finance.addPayment({
        id: util.uid("PAY"), studentId: student.id, invoiceId: invoice.id, amount,
        date: new Date().toISOString().slice(0, 10), method: document.getElementById("paymentMethod").value,
        reference: `USI${student.id.slice(-4)}${Date.now().toString().slice(-6)}`, status: "Completed"
      });
      modal.close();
      renderStudentView(user);
      toast.show("success", "Payment recorded", `Your payment of ${util.formatCurrency(amount)} has been recorded.`);
    });
  }

  // ---------------------------------------------------------------------
  // FINANCE / ADMIN VIEW
  // ---------------------------------------------------------------------
  function renderAdminView(user) {
    document.getElementById("financeSubtitle").textContent = "University-wide fee collection overview.";
    const invoices = global.USIAMS.data.invoices;
    const payments = global.USIAMS.finance.allPayments();
    const totalBilled = invoices.reduce((s, i) => s + i.amountBilled, 0);
    const totalCollected = payments.reduce((s, p) => s + p.amount, 0);

    global.USIAMS.cards.renderStatGrid("statGrid", [
      { label: "Total Billed", value: util.formatCurrency(totalBilled), icon: "bi-receipt", tint: "primary" },
      { label: "Total Collected", value: util.formatCurrency(totalCollected), icon: "bi-cash-stack", tint: "success" },
      { label: "Outstanding Balance", value: util.formatCurrency(totalBilled - totalCollected), icon: "bi-exclamation-circle", tint: "warning" },
      { label: "Transactions", value: payments.length, icon: "bi-arrow-left-right", tint: "info" }
    ]);

    charts.lineChart("collectionTrendChart", ["Aug", "Sep (W1)", "Sep (W2)", "Sep (W3)", "Sep (W4)"], [
      { label: "Collected (TZS M)", data: [12, 18, 24, 31, Math.round(totalCollected / 1e6)] }
    ]);
    charts.doughnutChart("paidVsOutstandingChart", ["Collected", "Outstanding"], [totalCollected, totalBilled - totalCollected]);

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
        <td>${util.escapeHtml(p.reference)}</td>
        <td>${util.escapeHtml(p.method)}</td>
        <td>${util.formatCurrency(p.amount)}</td>
        <td><span class="status-badge status-active">${p.status}</span></td>
      </tr>`;
    }).join("");

    document.getElementById("exportFinanceCsvBtn").addEventListener("click", () => {
      util.downloadCsv("finance-transactions", payments.map(p => ({
        Date: p.date, Student: p.studentId, Reference: p.reference, Method: p.method, Amount: p.amount, Status: p.status
      })));
    });
  }

  function initPage(user) {
    document.getElementById("adminFinanceSection").classList.toggle("d-none", user.role === "STUDENT");
    document.getElementById("studentFinanceActions").classList.toggle("d-none", user.role !== "STUDENT");
    document.getElementById("studentFinanceSection").classList.toggle("d-none", user.role !== "STUDENT");
    if (user.role === "STUDENT") renderStudentView(user);
    else renderAdminView(user);
  }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.financePage = { initPage };

})(window);

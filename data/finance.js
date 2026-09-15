/* =========================================================
   USIAMS - data/finance.js
   Fee structure, invoices and demo payment history.
   Simulated only - see js/finance.page.js for the "payment" flow,
   which never talks to a real payment gateway.
   ========================================================= */
(function (global) {
  "use strict";

  const ANNUAL_FEE_BY_DEPARTMENT = {
    DCSE: 2600000, DEE: 2800000, DMS: 2100000, DBIO: 2300000,
    DACC: 2000000, DMKT: 1900000, DIS: 2500000, DDS: 1700000,
    DLAW: 2700000, DEDU: 1600000
  };

  function seededMark(seed, min, max) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    return min + (hash % (max - min + 1));
  }

  function annualFeeFor(student) {
    return ANNUAL_FEE_BY_DEPARTMENT[student.departmentId] || 2000000;
  }

  function buildInvoicesAndPayments() {
    const invoices = [];
    const payments = [];
    const students = global.USIAMS.data.students;
    const ay = global.USIAMS.academic.activeAcademicYear();
    let invSeq = 1, paySeq = 1;

    students.forEach(student => {
      const billed = annualFeeFor(student);
      const invoiceId = `INV-${String(invSeq++).padStart(4, "0")}`;
      invoices.push({
        id: invoiceId,
        studentId: student.id,
        academicYearId: ay.id,
        description: `Tuition and Fees - ${ay.label}`,
        amountBilled: billed,
        issuedDate: `${2025}-08-15`,
        dueDate: `${2025}-10-31`
      });

      // Deterministic payment coverage: some fully paid, some partial, some unpaid.
      const coveragePct = seededMark(`${student.id}-coverage`, 0, 100);
      let paidSoFar = 0;
      if (coveragePct > 15) {
        const installments = seededMark(`${student.id}-inst`, 1, 3);
        for (let k = 0; k < installments; k++) {
          const remaining = billed - paidSoFar;
          if (remaining <= 0) break;
          const share = Math.min(remaining, Math.round(billed * (coveragePct / 100) / installments));
          if (share <= 0) continue;
          paidSoFar += share;
          payments.push({
            id: `PAY-${String(paySeq++).padStart(4, "0")}`,
            studentId: student.id,
            invoiceId,
            amount: share,
            date: `2025-${String(9 + k).padStart(2, "0")}-${String(5 + k * 4).padStart(2, "0")}`,
            method: ["Bank Transfer", "Mobile Money (M-Pesa)", "Mobile Money (Tigo Pesa)", "Direct Bank Deposit"][k % 4],
            reference: `USI${student.id.slice(-4)}${2025}${k}${seededMark(student.id + k, 1000, 9999)}`,
            status: "Completed"
          });
        }
      }
    });
    return { invoices, payments };
  }

  const built = buildInvoicesAndPayments();

  const paymentsOverlay = global.USIAMS.storage.createOverlay("payments", () => built.payments);

  function invoiceForStudent(studentId) {
    return global.USIAMS.data.invoices.find(i => i.studentId === studentId);
  }
  function paymentsForStudent(studentId) {
    return paymentsOverlay.getAll().filter(p => p.studentId === studentId);
  }
  function balanceForStudent(studentId) {
    const invoice = invoiceForStudent(studentId);
    if (!invoice) return { billed: 0, paid: 0, balance: 0 };
    const paid = paymentsForStudent(studentId).reduce((s, p) => s + p.amount, 0);
    return { billed: invoice.amountBilled, paid, balance: invoice.amountBilled - paid };
  }
  function allPayments() {
    return paymentsOverlay.getAll();
  }
  function addPayment(payment) {
    return paymentsOverlay.add(payment);
  }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.data = global.USIAMS.data || {};
  global.USIAMS.data.invoices = built.invoices;
  global.USIAMS.data.payments = built.payments;
  global.USIAMS.finance = { annualFeeFor, invoiceForStudent, paymentsForStudent, balanceForStudent, allPayments, addPayment };

})(window);

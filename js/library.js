/* =========================================================
   USIAMS - js/library.js
   Library catalog browsing and loan tracking. Catalog management
   (adding/editing books) is out of scope for this prototype pass -
   librarian/admin roles oversee loans and copy availability only.
   ========================================================= */
(function (global) {
  "use strict";

  const { util, toast } = global.USIAMS;
  const loansOverlay = global.USIAMS.storage.createOverlay("libraryLoans", () => global.USIAMS.data.seedLoans);
  let currentUser = null;

  function books() { return global.USIAMS.data.seedBooks; }
  function getBook(id) { return books().find(b => b.id === id); }

  function effectiveStatus(loan) {
    if (loan.returnedDate) return "Returned";
    return new Date(loan.dueDate) < new Date() ? "Overdue" : "Borrowed";
  }

  function activeLoansForBook(bookId) {
    return loansOverlay.getAll().filter(l => l.bookId === bookId && !l.returnedDate);
  }

  function availableCopies(book) {
    return Math.max(0, book.totalCopies - activeLoansForBook(book.id).length);
  }

  function loansForStudent(studentId) {
    return loansOverlay.getAll().filter(l => l.studentId === studentId);
  }

  function hasActiveLoan(studentId, bookId) {
    return loansOverlay.getAll().some(l => l.studentId === studentId && l.bookId === bookId && !l.returnedDate);
  }

  function borrowBook(studentId, bookId) {
    const book = getBook(bookId);
    if (availableCopies(book) <= 0) { toast.show("error", "No copies available", "All copies of this book are currently on loan."); return; }
    if (hasActiveLoan(studentId, bookId)) { toast.show("info", "Already borrowed", "You already have this book on loan."); return; }
    const borrowedDate = new Date();
    const dueDate = new Date(borrowedDate.getTime() + global.USIAMS.data.libraryLoanPeriodDays * 86400000);
    loansOverlay.add({
      id: util.uid("LOAN"), bookId, studentId,
      borrowedDate: borrowedDate.toISOString().slice(0, 10),
      dueDate: dueDate.toISOString().slice(0, 10),
      returnedDate: null, status: "Borrowed"
    });
    toast.show("success", "Book borrowed", `"${book.title}" has been added to your loans. Due ${util.formatDate(dueDate.toISOString())}.`);
  }

  function returnBook(loanId) {
    loansOverlay.update(loanId, { returnedDate: new Date().toISOString().slice(0, 10), status: "Returned" });
    toast.show("success", "Book returned", "The loan has been marked as returned.");
  }

  // ---------------------------------------------------------------------
  // STUDENT VIEW
  // ---------------------------------------------------------------------
  function renderStudentView() {
    const catalogContainer = document.getElementById("studentCatalogTableContainer");
    const catalogTable = global.USIAMS.table.createDataTable({
      containerId: "studentCatalogTableContainer",
      data: books(),
      searchKeys: ["title", "author", "category"],
      columns: [
        { key: "title", label: "Title", sortable: true },
        { key: "author", label: "Author" },
        { key: "category", label: "Category", sortable: true },
        { key: "available", label: "Available", render: b => `${availableCopies(b)} / ${b.totalCopies}` }
      ],
      rowActions: b => availableCopies(b) > 0 && !hasActiveLoan(currentUser.studentId, b.id)
        ? `<button class="btn btn-sm btn-outline-primary" data-action="borrow" data-id="${b.id}"><i class="bi bi-journal-plus"></i> Borrow</button>`
        : hasActiveLoan(currentUser.studentId, b.id) ? `<span class="text-muted-usi" style="font-size:.76rem;">On loan to you</span>` : `<span class="text-muted-usi" style="font-size:.76rem;">Unavailable</span>`,
      afterRender() {
        catalogContainer.querySelectorAll("[data-action='borrow']").forEach(btn => btn.addEventListener("click", () => {
          borrowBook(currentUser.studentId, btn.dataset.id);
          renderStudentView();
        }));
      }
    });
    document.getElementById("studentCatalogSearchInput").addEventListener("input", util.debounce(() => catalogTable.setSearch(document.getElementById("studentCatalogSearchInput").value), 200));

    const myLoans = loansForStudent(currentUser.studentId).sort((a, b) => new Date(b.borrowedDate) - new Date(a.borrowedDate));
    const myLoansContainer = document.getElementById("myLoansContainer");
    myLoansContainer.innerHTML = myLoans.length ? myLoans.map(l => {
      const book = getBook(l.bookId);
      const status = effectiveStatus(l);
      return `
      <div class="usi-card mb-3">
        <div class="usi-card-header">
          <div><h3>${util.escapeHtml(book ? book.title : l.bookId)}</h3><div class="text-muted-usi" style="font-size:.78rem;">${book ? util.escapeHtml(book.author) : ""}</div></div>
          <span class="status-badge status-${status.toLowerCase()}">${status}</span>
        </div>
        <div class="usi-card-body">
          <dl class="kv-list row">
            <div class="col-md-4"><dt>Borrowed</dt><dd>${util.formatDate(l.borrowedDate)}</dd></div>
            <div class="col-md-4"><dt>Due</dt><dd>${util.formatDate(l.dueDate)}</dd></div>
            <div class="col-md-4"><dt>Returned</dt><dd>${l.returnedDate ? util.formatDate(l.returnedDate) : "-"}</dd></div>
          </dl>
          ${!l.returnedDate ? `<button class="btn btn-sm btn-outline-secondary" data-action="return" data-id="${l.id}"><i class="bi bi-arrow-return-left me-1"></i>Return Book</button>` : ""}
        </div>
      </div>`;
    }).join("") : `<div class="empty-state"><i class="bi bi-journal"></i>You have no borrowed books.</div>`;

    myLoansContainer.querySelectorAll("[data-action='return']").forEach(btn => btn.addEventListener("click", () => {
      returnBook(btn.dataset.id);
      renderStudentView();
    }));
  }

  // ---------------------------------------------------------------------
  // LIBRARIAN / ADMIN VIEW
  // ---------------------------------------------------------------------
  function renderStaffView() {
    const allLoans = loansOverlay.getAll();
    const activeLoans = allLoans.filter(l => !l.returnedDate);
    const overdue = activeLoans.filter(l => effectiveStatus(l) === "Overdue");
    const totalCopies = books().reduce((s, b) => s + b.totalCopies, 0);

    global.USIAMS.cards.renderStatGrid("statGrid", [
      { label: "Titles in Catalog", value: books().length, icon: "bi-journals", tint: "primary" },
      { label: "Total Copies", value: totalCopies, icon: "bi-stack", tint: "info" },
      { label: "Currently Borrowed", value: activeLoans.length, icon: "bi-journal-arrow-up", tint: "warning" },
      { label: "Overdue", value: overdue.length, icon: "bi-exclamation-circle", tint: overdue.length ? "danger" : "success" }
    ]);

    const catalogTable = global.USIAMS.table.createDataTable({
      containerId: "staffCatalogTableContainer",
      data: books(),
      searchKeys: ["title", "author", "category"],
      columns: [
        { key: "title", label: "Title", sortable: true },
        { key: "category", label: "Category", sortable: true },
        { key: "totalCopies", label: "Total Copies", sortable: true },
        { key: "available", label: "Available", render: b => availableCopies(b) }
      ]
    });
    document.getElementById("staffCatalogSearchInput").addEventListener("input", util.debounce(() => catalogTable.setSearch(document.getElementById("staffCatalogSearchInput").value), 200));

    const loansTable = global.USIAMS.table.createDataTable({
      containerId: "loansTableContainer",
      data: [...allLoans].sort((a, b) => new Date(b.borrowedDate) - new Date(a.borrowedDate)),
      searchKeys: ["studentId", "bookId"],
      columns: [
        { key: "book", label: "Book", render: l => util.escapeHtml(getBook(l.bookId)?.title || l.bookId) },
        { key: "student", label: "Student", render: l => { const s = global.USIAMS.students.getStudent(l.studentId); return s ? util.escapeHtml(`${s.fullName} (${s.regNumber})`) : l.studentId; } },
        { key: "borrowedDate", label: "Borrowed", sortable: true, render: l => util.formatDate(l.borrowedDate) },
        { key: "dueDate", label: "Due", sortable: true, render: l => util.formatDate(l.dueDate) },
        { key: "status", label: "Status", render: l => `<span class="status-badge status-${effectiveStatus(l).toLowerCase()}">${effectiveStatus(l)}</span>` }
      ],
      rowActions: l => !l.returnedDate ? `<button class="btn btn-sm btn-outline-secondary write-action" data-write-action data-action="return" data-id="${l.id}"><i class="bi bi-arrow-return-left"></i> Mark Returned</button>` : "",
      afterRender() {
        document.querySelectorAll("#loansTableContainer [data-action='return']").forEach(btn => btn.addEventListener("click", () => {
          if (!global.USIAMS.auth.guardWrite("mark this loan as returned")) return;
          returnBook(btn.dataset.id);
          renderStaffView();
        }));
      }
    });
    document.getElementById("loansSearchInput").addEventListener("input", util.debounce(() => loansTable.setSearch(document.getElementById("loansSearchInput").value), 200));
  }

  function initPage(user) {
    currentUser = user;
    document.getElementById("studentLibrarySection").classList.toggle("d-none", user.role !== "STUDENT");
    document.getElementById("staffLibrarySection").classList.toggle("d-none", user.role === "STUDENT");
    if (user.role === "STUDENT") renderStudentView(); else renderStaffView();
  }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.libraryPage = { initPage };

})(window);

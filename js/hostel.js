/* =========================================================
   USIAMS - js/hostel.js
   Hostel/accommodation: hall & room occupancy plus the request ->
   allocate -> vacate lifecycle for student accommodation.
   ========================================================= */
(function (global) {
  "use strict";

  const { util, toast, modal } = global.USIAMS;
  const allocationsOverlay = global.USIAMS.storage.createOverlay("hostelAllocations", () => global.USIAMS.data.seedAllocations);
  let currentUser = null;

  function hostels() { return global.USIAMS.data.seedHostels; }
  function rooms() { return global.USIAMS.data.seedRooms; }
  function getHostel(id) { return hostels().find(h => h.id === id); }
  function getRoom(id) { return rooms().find(r => r.id === id); }
  function allAllocations() { return allocationsOverlay.getAll(); }

  function occupantsOfRoom(roomId) {
    return allAllocations().filter(a => a.roomId === roomId && a.status === "Allocated");
  }
  function roomAvailableBeds(room) {
    return Math.max(0, room.capacity - occupantsOfRoom(room.id).length);
  }
  function activeAllocationForStudent(studentId) {
    return allAllocations().find(a => a.studentId === studentId && (a.status === "Allocated" || a.status === "Requested"));
  }

  function requestAccommodation(studentId) {
    if (activeAllocationForStudent(studentId)) { toast.show("info", "Request already exists", "You already have an active accommodation record."); return; }
    allocationsOverlay.add({
      id: util.uid("ALC"), studentId, roomId: null, academicYearId: global.USIAMS.academic.activeAcademicYear().id,
      status: "Requested", requestedDate: new Date().toISOString().slice(0, 10), allocatedDate: null
    });
    toast.show("success", "Request submitted", "Your accommodation request has been submitted for review.");
  }

  function allocateRoom(allocationId, roomId) {
    allocationsOverlay.update(allocationId, { roomId, status: "Allocated", allocatedDate: new Date().toISOString().slice(0, 10) });
    toast.show("success", "Room allocated", "The student has been allocated to the selected room.");
  }

  function rejectRequest(allocationId) {
    allocationsOverlay.update(allocationId, { status: "Rejected" });
    toast.show("success", "Request rejected", "The accommodation request has been rejected.");
  }

  function vacateRoom(allocationId) {
    allocationsOverlay.update(allocationId, { status: "Vacated" });
    toast.show("success", "Room vacated", "The allocation has been marked as vacated.");
  }

  // ---------------------------------------------------------------------
  // STUDENT VIEW
  // ---------------------------------------------------------------------
  function renderStudentView(user) {
    const container = document.getElementById("myAccommodationContainer");
    const allocation = allAllocations().filter(a => a.studentId === user.studentId).sort((a, b) => new Date(b.requestedDate) - new Date(a.requestedDate))[0];

    if (!allocation) {
      container.innerHTML = `<div class="empty-state"><i class="bi bi-house"></i>You have not requested accommodation yet.</div>
        <button class="btn btn-primary mt-2" id="requestAccommodationBtn" style="background:var(--primary);border-color:var(--primary);"><i class="bi bi-house-add me-1"></i>Request Accommodation</button>`;
      document.getElementById("requestAccommodationBtn").addEventListener("click", () => { requestAccommodation(user.studentId); renderStudentView(user); });
      return;
    }

    const room = allocation.roomId ? getRoom(allocation.roomId) : null;
    const hostel = room ? getHostel(room.hostelId) : null;
    container.innerHTML = `
      <div class="usi-card">
        <div class="usi-card-header">
          <div><h3>${hostel ? util.escapeHtml(hostel.name) : "Accommodation Request"}</h3>${room ? `<div class="text-muted-usi" style="font-size:.78rem;">Room ${util.escapeHtml(room.roomNumber)}</div>` : ""}</div>
          <span class="status-badge status-${allocation.status.toLowerCase()}">${allocation.status}</span>
        </div>
        <div class="usi-card-body">
          <dl class="kv-list row">
            <div class="col-md-4"><dt>Requested</dt><dd>${util.formatDate(allocation.requestedDate)}</dd></div>
            <div class="col-md-4"><dt>Allocated</dt><dd>${allocation.allocatedDate ? util.formatDate(allocation.allocatedDate) : "-"}</dd></div>
            <div class="col-md-4"><dt>Annual Fee</dt><dd>${hostel ? util.formatCurrency(hostel.feePerYear) : "-"}</dd></div>
          </dl>
          ${allocation.status === "Rejected" || allocation.status === "Vacated" ? `<button class="btn btn-sm btn-outline-primary" id="requestAccommodationBtn"><i class="bi bi-house-add me-1"></i>Request Again</button>` : ""}
        </div>
      </div>`;
    const btn = document.getElementById("requestAccommodationBtn");
    if (btn) btn.addEventListener("click", () => { requestAccommodation(user.studentId); renderStudentView(user); });
  }

  // ---------------------------------------------------------------------
  // HOSTEL OFFICER / ADMIN VIEW
  // ---------------------------------------------------------------------
  function eligibleRoomsFor(studentId) {
    const student = global.USIAMS.students.getStudent(studentId);
    return rooms().filter(r => {
      const hostel = getHostel(r.hostelId);
      return hostel.gender === student.gender && roomAvailableBeds(r) > 0;
    });
  }

  function openAllocateModal(allocation) {
    const options = eligibleRoomsFor(allocation.studentId).map(r => {
      const hostel = getHostel(r.hostelId);
      return `<option value="${r.id}">${util.escapeHtml(hostel.name)} - Room ${util.escapeHtml(r.roomNumber)} (${roomAvailableBeds(r)} beds free)</option>`;
    }).join("");
    if (!options) { toast.show("error", "No rooms available", "There are no available rooms matching this student's hall gender."); return; }
    modal.renderInto(`
      <div class="modal fade" tabindex="-1"><div class="modal-dialog"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">Allocate Room</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body">
          <label class="form-label">Select Room</label>
          <select class="form-select" id="allocateRoomSelect">${options}</select>
        </div>
        <div class="modal-footer"><button class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button><button class="btn btn-primary" id="confirmAllocateBtn" style="background:var(--primary);border-color:var(--primary);">Allocate</button></div>
      </div></div></div>
    `);
    document.getElementById("confirmAllocateBtn").addEventListener("click", () => {
      allocateRoom(allocation.id, document.getElementById("allocateRoomSelect").value);
      modal.close();
      renderStaffView();
    });
  }

  function renderStaffView() {
    const allocations = allAllocations();
    const activeAllocations = allocations.filter(a => a.status === "Allocated");
    const pending = allocations.filter(a => a.status === "Requested");
    const totalBeds = rooms().reduce((s, r) => s + r.capacity, 0);

    global.USIAMS.cards.renderStatGrid("statGrid", [
      { label: "Halls", value: hostels().length, icon: "bi-buildings", tint: "primary" },
      { label: "Total Beds", value: totalBeds, icon: "bi-door-open", tint: "info" },
      { label: "Occupied Beds", value: activeAllocations.length, icon: "bi-person-check", tint: "success" },
      { label: "Pending Requests", value: pending.length, icon: "bi-hourglass-split", tint: pending.length ? "warning" : "success" }
    ]);

    const roomsTable = global.USIAMS.table.createDataTable({
      containerId: "roomsTableContainer",
      data: rooms(),
      searchKeys: ["roomNumber"],
      columns: [
        { key: "hostel", label: "Hall", render: r => util.escapeHtml(getHostel(r.hostelId)?.name || "-") },
        { key: "roomNumber", label: "Room", sortable: true },
        { key: "capacity", label: "Capacity", sortable: true },
        { key: "occupied", label: "Occupied", render: r => occupantsOfRoom(r.id).length },
        { key: "available", label: "Available Beds", render: r => roomAvailableBeds(r) }
      ]
    });
    document.getElementById("roomsSearchInput").addEventListener("input", util.debounce(() => roomsTable.setSearch(document.getElementById("roomsSearchInput").value), 200));

    const allocationsTable = global.USIAMS.table.createDataTable({
      containerId: "allocationsTableContainer",
      data: [...allocations].sort((a, b) => new Date(b.requestedDate) - new Date(a.requestedDate)),
      searchKeys: ["studentId"],
      columns: [
        { key: "student", label: "Student", render: a => { const s = global.USIAMS.students.getStudent(a.studentId); return s ? util.escapeHtml(`${s.fullName} (${s.regNumber})`) : a.studentId; } },
        { key: "room", label: "Room", render: a => { const r = a.roomId ? getRoom(a.roomId) : null; return r ? `${util.escapeHtml(getHostel(r.hostelId).name)} - ${util.escapeHtml(r.roomNumber)}` : "-"; } },
        { key: "requestedDate", label: "Requested", sortable: true, render: a => util.formatDate(a.requestedDate) },
        { key: "status", label: "Status", render: a => `<span class="status-badge status-${a.status.toLowerCase()}">${a.status}</span>` }
      ],
      rowActions: a => {
        if (a.status === "Requested") return `<button class="btn btn-sm btn-outline-primary write-action" data-write-action data-action="allocate" data-id="${a.id}"><i class="bi bi-house-check"></i> Allocate</button> <button class="btn btn-sm btn-outline-danger write-action" data-write-action data-action="reject" data-id="${a.id}"><i class="bi bi-x-lg"></i> Reject</button>`;
        if (a.status === "Allocated") return `<button class="btn btn-sm btn-outline-secondary write-action" data-write-action data-action="vacate" data-id="${a.id}"><i class="bi bi-box-arrow-left"></i> Vacate</button>`;
        return "";
      },
      afterRender() {
        document.querySelectorAll("#allocationsTableContainer [data-action='allocate']").forEach(btn => btn.addEventListener("click", () => {
          if (!global.USIAMS.auth.guardWrite("allocate a room")) return;
          openAllocateModal(allocations.find(a => a.id === btn.dataset.id));
        }));
        document.querySelectorAll("#allocationsTableContainer [data-action='reject']").forEach(btn => btn.addEventListener("click", () => {
          if (!global.USIAMS.auth.guardWrite("reject this request")) return;
          rejectRequest(btn.dataset.id); renderStaffView();
        }));
        document.querySelectorAll("#allocationsTableContainer [data-action='vacate']").forEach(btn => btn.addEventListener("click", () => {
          if (!global.USIAMS.auth.guardWrite("vacate this room")) return;
          vacateRoom(btn.dataset.id); renderStaffView();
        }));
      }
    });
    document.getElementById("allocationsSearchInput").addEventListener("input", util.debounce(() => allocationsTable.setSearch(document.getElementById("allocationsSearchInput").value), 200));
  }

  function initPage(user) {
    currentUser = user;
    document.getElementById("studentHostelSection").classList.toggle("d-none", user.role !== "STUDENT");
    document.getElementById("staffHostelSection").classList.toggle("d-none", user.role === "STUDENT");
    if (user.role === "STUDENT") renderStudentView(user); else renderStaffView();
  }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.hostelPage = { initPage };

})(window);

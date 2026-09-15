/* =========================================================
   USIAMS - data/hostel.js
   Halls of residence, rooms and seed accommodation allocations.
   Room occupancy is derived in js/hostel.js from active
   allocations rather than stored on the room record, for the
   same single-source-of-truth reason as the library catalog.
   ========================================================= */
(function (global) {
  "use strict";

  const ALLOCATION_STATUSES = ["Requested", "Allocated", "Rejected", "Vacated"];

  const SEED_HOSTELS = [
    { id: "HST-01", name: "Nyerere Hall", gender: "Male", feePerYear: 450000 },
    { id: "HST-02", name: "Kambarage Hall", gender: "Male", feePerYear: 450000 },
    { id: "HST-03", name: "Uhuru Hall", gender: "Female", feePerYear: 450000 },
    { id: "HST-04", name: "Amani Hall", gender: "Female", feePerYear: 480000 }
  ];

  const SEED_ROOMS = [
    { id: "RM-0101", hostelId: "HST-01", roomNumber: "101", capacity: 4 },
    { id: "RM-0102", hostelId: "HST-01", roomNumber: "102", capacity: 4 },
    { id: "RM-0103", hostelId: "HST-01", roomNumber: "103", capacity: 4 },
    { id: "RM-0201", hostelId: "HST-02", roomNumber: "201", capacity: 4 },
    { id: "RM-0202", hostelId: "HST-02", roomNumber: "202", capacity: 4 },
    { id: "RM-0301", hostelId: "HST-03", roomNumber: "301", capacity: 4 },
    { id: "RM-0302", hostelId: "HST-03", roomNumber: "302", capacity: 4 },
    { id: "RM-0303", hostelId: "HST-03", roomNumber: "303", capacity: 4 },
    { id: "RM-0401", hostelId: "HST-04", roomNumber: "401", capacity: 4 },
    { id: "RM-0402", hostelId: "HST-04", roomNumber: "402", capacity: 4 }
  ];

  const SEED_ALLOCATIONS = [
    { id: "ALC-0001", studentId: "STU-0001", roomId: "RM-0101", academicYearId: "AY2025", status: "Allocated", requestedDate: "2025-08-10", allocatedDate: "2025-08-15" },
    { id: "ALC-0002", studentId: "STU-0007", roomId: "RM-0101", academicYearId: "AY2025", status: "Allocated", requestedDate: "2025-08-10", allocatedDate: "2025-08-15" },
    { id: "ALC-0003", studentId: "STU-0012", roomId: "RM-0102", academicYearId: "AY2025", status: "Allocated", requestedDate: "2025-08-11", allocatedDate: "2025-08-16" },
    { id: "ALC-0004", studentId: "STU-0002", roomId: "RM-0301", academicYearId: "AY2025", status: "Allocated", requestedDate: "2025-08-09", allocatedDate: "2025-08-14" },
    { id: "ALC-0005", studentId: "STU-0004", roomId: "RM-0301", academicYearId: "AY2025", status: "Allocated", requestedDate: "2025-08-09", allocatedDate: "2025-08-14" },
    { id: "ALC-0006", studentId: "STU-0018", roomId: null, academicYearId: "AY2025", status: "Requested", requestedDate: "2026-09-05", allocatedDate: null },
    { id: "ALC-0007", studentId: "STU-0021", roomId: null, academicYearId: "AY2025", status: "Rejected", requestedDate: "2026-08-20", allocatedDate: null }
  ];

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.data = global.USIAMS.data || {};
  global.USIAMS.data.hostelAllocationStatuses = ALLOCATION_STATUSES;
  global.USIAMS.data.seedHostels = SEED_HOSTELS;
  global.USIAMS.data.seedRooms = SEED_ROOMS;
  global.USIAMS.data.seedAllocations = SEED_ALLOCATIONS;

})(window);

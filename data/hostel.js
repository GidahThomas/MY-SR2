/* =========================================================
   USIAMS - data/hostel.js
   Halls of residence, rooms and accommodation allocations.
   Room occupancy is derived in js/hostel.js from active
   allocations rather than stored on the room record, for the
   same single-source-of-truth reason as the library catalog.

   No halls are currently on-campus/in the system - the module
   stays fully functional with zero halls and zero rooms (see
   js/hostel.js: the stats show 0, the tables show an empty
   state, and a Hostel Officer gets a clear "No rooms available"
   message if they try to allocate a pending request). Real halls
   can be added to SEED_HOSTELS/SEED_ROOMS whenever they exist.
   Existing pending/rejected requests are kept, since students can
   still request accommodation even while none is available yet.
   ========================================================= */
(function (global) {
  "use strict";

  const ALLOCATION_STATUSES = ["Requested", "Allocated", "Rejected", "Vacated"];

  const SEED_HOSTELS = [];

  const SEED_ROOMS = [];

  const SEED_ALLOCATIONS = [
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

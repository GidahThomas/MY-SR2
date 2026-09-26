/* =========================================================
   USIAMS - js/help.js
   Teaches people how to use the system:
   - a welcome tour the first time someone signs in, pointing at
     the menu items their role actually has;
   - a Help (?) button in the top bar that opens step-by-step
     instructions for the page they are on, worded for their role;
   - the guide content the Help Centre page (pages/help.html) lists.
   Loaded on every signed-in page by js/app.js.
   ========================================================= */
(function (global) {
  "use strict";

  // ---------------------------------------------------------------------
  // Guides, one per page. `steps` may be a plain list, or keyed by role
  // with STUDENT / STAFF (anyone else) / a specific role id.
  // ---------------------------------------------------------------------
  const GUIDES = {
    "student-dashboard.html": {
      title: "Your dashboard",
      intro: "Your home page: a summary of your studies, fees and notices.",
      steps: [
        "The cards at the top show your GPA, registered courses and fee balance; the charts below show your GPA trend and attendance.",
        "Check the notices and upcoming events for deadlines.",
        "Use the menu on the left to open any service. On a phone, tap the menu button at the top left.",
        "If you are asked to complete your profile, open Complete My Profile and fill in each step."
      ]
    },
    "admin-dashboard.html": {
      title: "Your dashboard",
      intro: "An overview of the university (or of your area) with quick actions.",
      steps: [
        "The cards at the top summarise students, programmes and the academic structure.",
        "Quick Actions take you straight to the tasks you do most.",
        "The charts show student numbers by college and programme.",
        "Use the menu on the left for everything else."
      ]
    },
    "lecturer-dashboard.html": {
      title: "Your dashboard",
      intro: "Your courses, classes and teaching tasks in one place.",
      steps: [
        "The cards show the courses you teach and your students.",
        "Open Attendance to see and record class attendance.",
        "Open Results to see marks for your courses.",
        "Open E-Learning to share materials, set assignments and grade submissions."
      ]
    },
    "qa-dashboard.html": {
      title: "Quality assurance dashboard",
      intro: "Read-only oversight of academic quality across the university.",
      steps: [
        "The charts summarise results, attendance and open quality flags.",
        "Open Quality Assurance to review flags in detail.",
        "Your role is read-only: you can view and export, but not change records."
      ]
    },
    "finance.html": {
      title: "Paying fees",
      intro: "Every university payment is a government payment made through GePG with a control number.",
      steps: {
        STUDENT: [
          "Click Make Payment.",
          "Choose what you are paying for (tuition, registration, accommodation, transcript...). A GePG control number appears straight away.",
          "For tuition you may pay in instalments: type the amount and click Update control number.",
          "Choose a payment method (M-Pesa, Tigo Pesa, Airtel Money, HaloPesa or a bank). The instructions appear - always pay through its Government Payments (GePG) option.",
          "Enter the mobile number or bank account that has the money, then click Confirm Payment and approve it on your phone.",
          "Your GePG control numbers are listed under GePG Control Numbers (valid for 7 days). Unpaid ones have a Pay button.",
          "Every payment appears in Payment History. Click Receipt to view or print it. View Invoice shows your tuition bill."
        ],
        STAFF: [
          "The cards show total billed, collected and outstanding fees.",
          "The charts show collection over time and fees by department.",
          "Recent Transactions lists the latest GePG payments with their control numbers and paying numbers.",
          "Click Export CSV to download every transaction."
        ]
      }
    },
    "registration.html": {
      title: "Registering for courses",
      intro: "Choose your courses for the semester and confirm your registration.",
      steps: {
        STUDENT: [
          "Available Courses lists the courses you can take this semester.",
          "Click a course to add it; it moves to Selected Courses. Watch the credit total.",
          "When your list is complete, click Confirm Registration.",
          "To change it later, click Amend Registration (while registration is open)."
        ],
        STAFF: [
          "Choose a student with Select Student to see their registration.",
          "Review the selected courses and credits.",
          "Use Amend Registration or Confirm Registration where your role allows."
        ]
      }
    },
    "results.html": {
      title: "Results and transcripts",
      intro: "Your grades, GPA and official transcript.",
      steps: {
        STUDENT: [
          "Choose a Semester to see your grades for it.",
          "The charts show your grade spread and GPA trend.",
          "Click Download Transcript for your full record, or Print for a paper copy."
        ],
        STAFF: [
          "Use Select Student to open a student's results.",
          "Choose a Semester to filter.",
          "Export CSV downloads the results; Download Transcript produces the student's transcript."
        ]
      }
    },
    "attendance.html": {
      title: "Attendance",
      intro: "Class attendance by course.",
      steps: {
        STUDENT: [
          "Attendance by Course shows your percentage in each course.",
          "The trend chart shows how it has changed.",
          "Keep each course at or above the minimum required by the By-Laws, or you may not sit the exam."
        ],
        STAFF: [
          "Use Select Student to view one student's attendance.",
          "The Attendance Register lists each class session.",
          "The charts highlight courses where attendance is low."
        ]
      }
    },
    "timetable.html": {
      title: "Timetable",
      intro: "Your weekly class schedule.",
      steps: [
        "Each block shows the course, time and venue.",
        "Your timetable follows the courses you are registered for (or teach).",
        "Check Announcements for any room or time changes."
      ]
    },
    "documents.html": {
      title: "Documents",
      intro: "Upload and track the documents the university needs from you.",
      steps: {
        STUDENT: [
          "Click Upload Document.",
          "Choose the document type, attach the file and click Upload.",
          "Each document shows its status; the Registration Office reviews and verifies it."
        ],
        STAFF: [
          "Review the documents students have uploaded.",
          "Open a document to check it and update its status."
        ]
      }
    },
    "requests.html": {
      title: "Requests",
      intro: "Ask a university office for something and follow its progress.",
      steps: {
        STUDENT: [
          "Click Submit Request.",
          "Choose the type of request, describe what you need and submit.",
          "Your request appears in the list with its status (Pending, In Progress, Resolved...).",
          "You get a notification when an office updates it."
        ],
        STAFF: [
          "Open a request to read it.",
          "Update its status and add a response, then click Save Update.",
          "Export CSV downloads the list."
        ]
      }
    },
    "complaints.html": {
      title: "Complaints",
      intro: "Raise a complaint and follow how it is handled.",
      steps: [
        "Click Submit Complaint.",
        "Choose a category, describe the problem clearly and submit.",
        "Track its status in the list. Staff update it as it is investigated."
      ]
    },
    "notifications.html": {
      title: "Notifications",
      intro: "Messages the system sends you.",
      steps: [
        "The bell in the top bar shows how many are unread.",
        "Click a notification to read it.",
        "Click Mark All as Read to clear the count."
      ]
    },
    "announcements.html": {
      title: "Announcements",
      intro: "University-wide notices.",
      steps: {
        STUDENT: ["Read the latest notices here; the newest are at the top.", "Important deadlines are also shown on your dashboard."],
        STAFF: [
          "Read notices here.",
          "If your role can publish, click Publish Announcement, write the title and message, choose who should see it and publish."
        ]
      }
    },
    "elections.html": {
      title: "UDOSO elections",
      intro: "Vote in student government elections.",
      steps: [
        "When an election is open, each position lists its candidates.",
        "Choose one candidate per position and click Vote.",
        "You can vote once per position. Results appear when the election closes."
      ]
    },
    "calendar.html": {
      title: "Academic calendar",
      intro: "Semester dates, exams, holidays and deadlines.",
      steps: ["Browse the events by month.", "Public holidays are shown too.", "Plan registration and payments around the deadlines listed here."]
    },
    "bylaws.html": {
      title: "Student By-Laws",
      intro: "The rules every student must follow.",
      steps: [
        "Read each section: academic integrity, attendance, examinations, conduct, accommodation and library.",
        "Click I Have Read This once you have read them all."
      ]
    },
    "profile-setup.html": {
      title: "Completing your profile",
      intro: "Give the university your contact, next-of-kin and education details.",
      steps: [
        "Fill in each step: personal details, next of kin, and previous education.",
        "Use Next and Back to move between steps.",
        "Submit on the last step. You can come back and update it later."
      ]
    },
    "internship.html": {
      title: "Internship",
      intro: "Record and supervise field attachments.",
      steps: {
        STUDENT: ["Your placement details are shown at the top.", "Click Add Logbook Entry after each week to record what you did.", "Your supervisor reviews your logbook."],
        STAFF: ["Review your students' placements.", "Open a student's logbook to read and assess the entries."]
      }
    },
    "graduation.html": {
      title: "Graduation clearance",
      intro: "Get cleared by each office before you graduate.",
      steps: {
        STUDENT: [
          "The Clearance Checklist shows each office you must be cleared by (finance, library, hostel, department...).",
          "Settle anything outstanding - for example unpaid fees or unreturned books.",
          "Apply for graduation when every item is cleared."
        ],
        STAFF: ["Use Select Student to open a student's clearance.", "Review each item and update its status."]
      }
    },
    "elearning.html": {
      title: "E-Learning",
      intro: "Course materials and assignments.",
      steps: {
        STUDENT: ["Open a course to see its materials.", "Open an assignment, attach your work and click Submit Assignment before the deadline.", "Grades and feedback appear once your lecturer marks it."],
        LECTURER: ["Click Add Material to share notes or links with a course.", "Click Add Assignment to set work with a deadline.", "Open a submission and click Grade to mark it and save the grade."]
      }
    },
    "library.html": {
      title: "Library",
      intro: "Search the catalogue and manage loans.",
      steps: {
        STUDENT: ["Search for a book by title, author or subject.", "Click Borrow on an available copy.", "Your loans and due dates are listed; click Return Book when you return it."],
        STAFF: ["Search the catalogue and see which copies are out.", "When a book comes back, find the loan and click Mark Returned.", "Overdue loans are highlighted."]
      }
    },
    "hostel.html": {
      title: "Hostel and accommodation",
      intro: "Apply for and manage campus accommodation.",
      steps: {
        STUDENT: ["Click Request Accommodation and choose your preferences.", "Your request shows its status. If it is rejected you can Request Again.", "Pay the accommodation fee from Finance > Make Payment (a GePG government payment)."],
        STAFF: ["Review accommodation requests.", "Click Allocate to assign a room, or Reject with a reason.", "Click Vacate when a student leaves."]
      }
    },
    "students.html": {
      title: "Managing students",
      intro: "The student register.",
      steps: [
        "Search or filter to find a student.",
        "Click View Profile for their personal, academic, contact and document details.",
        "Click Add Student for one student, or Bulk Add to import many at once.",
        "Use Edit or Delete on a row where your role allows. Export CSV downloads the list."
      ]
    },
    "academics.html": {
      title: "Academic structure",
      intro: "Colleges, departments, programmes, curriculum and academic years.",
      steps: [
        "Organisational Structure: colleges, institutes, schools and their departments. Use Add College / Institute / School to create one.",
        "Curriculum: the programmes and the courses in each.",
        "Academic Years & Semesters: click Add Academic Year to open a new year."
      ]
    },
    "courses.html": {
      title: "Courses",
      intro: "The course catalogue.",
      steps: ["Search or filter to find a course.", "Click Add Course to create one with its code, credits and department.", "Export CSV downloads the catalogue."]
    },
    "admissions.html": {
      title: "Admissions",
      intro: "Review applications submitted from the public Apply page.",
      steps: ["Open an application and click Review.", "Mark it Under Review while you check it.", "Click Accept or Reject when you decide. The applicant's status updates."]
    },
    "alumni.html": { title: "Alumni", intro: "Graduates of the university.", steps: ["Search the alumni list.", "Click Export CSV to download it."] },
    "quality-assurance.html": {
      title: "Quality assurance",
      intro: "Quality flags and academic indicators.",
      steps: ["Review the flags raised on courses and results.", "Use the charts to spot problem areas.", "Export CSV downloads the data."]
    },
    "reports.html": {
      title: "Reports",
      intro: "Produce summary reports.",
      steps: ["Choose the report type and any filters.", "Click Generate.", "Print or download the result."]
    },
    "administration.html": {
      title: "Administration and users",
      intro: "Manage user accounts (and, for university admins, roles and system settings).",
      steps: [
        "Users tab: use the Role and Status dropdowns to see a group of users, or search by name.",
        "Click Add User, choose the role first, then the department or unit if asked, and fill in the details. Give the new user the temporary password shown.",
        "Account requests from the Create Account form wait as Pending: click the tick to approve or the cross to reject.",
        "Use the button on a row to deactivate or reactivate an account.",
        "University admins also have Roles & Permissions, Organisational Units, System Settings and Audit Logs tabs."
      ]
    },
    "audit-logs.html": { title: "Audit logs", intro: "A record of who did what, and when.", steps: ["Search or filter by action.", "Each entry shows the user, action, record and time."] },
    "staff-directory.html": { title: "Staff directory", intro: "Find university staff.", steps: ["Search by name, role or department.", "Contact details are shown for each person."] },
    "settings.html": {
      title: "Settings",
      intro: "Your account and preferences.",
      steps: ["To change your password, enter your current password, then the new one twice, and click Update Password.", "Switch light/dark mode with the moon/sun button in the top bar."]
    },
    "help.html": {
      title: "Help Centre",
      intro: "Every guide for your role in one place.",
      steps: ["Search for a task, or open a guide below.", "Click Start the tour to see the welcome tour again.", "On any page, the ? button in the top bar opens that page's guide."]
    }
  };

  // One line per menu item, used by the welcome tour.
  const MENU_TIPS = {
    "Dashboard": "Your home page - start here every time you sign in.",
    "Finance": "Pay fees as government payments: choose what to pay for, get a GePG control number, pay by mobile money or bank.",
    "Registration": "Register for your courses each semester.",
    "Results": "Grades, GPA and transcripts.",
    "Attendance": "Class attendance by course.",
    "Timetable": "Your weekly class schedule.",
    "Documents": "Upload documents the university needs.",
    "Requests": "Ask a university office for something and follow its progress.",
    "Complaints": "Raise a complaint.",
    "Notifications": "Messages sent to you by the system.",
    "Announcements": "University-wide notices.",
    "Students": "The student register.",
    "Academics": "Colleges, departments, programmes and academic years.",
    "Courses": "The course catalogue.",
    "Admissions": "Review applications to the university.",
    "Library": "Books and loans.",
    "Hostel": "Campus accommodation.",
    "E-Learning": "Course materials and assignments.",
    "Administration": "User accounts - add users and approve account requests.",
    "Reports": "Produce summary reports.",
    "Quality Assurance": "Quality flags and indicators.",
    "Complete My Profile": "Give the university your contact and education details.",
    "UDOSO Elections": "Vote in student elections.",
    "Settings": "Change your password and preferences."
  };

  function currentPage() {
    return global.location.pathname.replace(/\\/g, "/").split("/").pop() || "index.html";
  }

  function stepsFor(guide, role) {
    if (Array.isArray(guide.steps)) return guide.steps;
    return guide.steps[role] || (role === "STUDENT" ? guide.steps.STUDENT : guide.steps.STAFF) || guide.steps.STAFF || guide.steps.STUDENT || [];
  }

  function guideHtml(guide, role) {
    const esc = global.USIAMS.util.escapeHtml;
    return `<p class="text-muted-usi">${esc(guide.intro)}</p>
      <ol class="help-steps">${stepsFor(guide, role).map(s => `<li>${esc(s)}</li>`).join("")}</ol>`;
  }

  // ---------------------------------------------------------------------
  // Help panel (the ? button)
  // ---------------------------------------------------------------------
  function openHelpPanel(user) {
    const esc = global.USIAMS.util.escapeHtml;
    const base = global.USIAMS.auth.getBasePath();
    const guide = GUIDES[currentPage()];
    let panel = document.getElementById("helpPanel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "helpPanel";
      panel.className = "offcanvas offcanvas-end";
      panel.tabIndex = -1;
      panel.setAttribute("aria-labelledby", "helpPanelTitle");
      document.body.appendChild(panel);
    }
    panel.innerHTML = `
      <div class="offcanvas-header">
        <h5 class="offcanvas-title" id="helpPanelTitle"><i class="bi bi-question-circle me-2"></i>${esc(guide ? guide.title : "Help")}</h5>
        <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
      </div>
      <div class="offcanvas-body">
        ${guide ? guideHtml(guide, user.role) : `<p>Use the menu on the left to open a service. Each page has its own guide under this ? button.</p>`}
        <hr>
        <div class="d-grid gap-2">
          <button type="button" class="btn btn-outline-primary" id="helpStartTour"><i class="bi bi-signpost-2 me-1"></i>Show me around again</button>
          <a class="btn btn-light" href="${base}pages/help.html"><i class="bi bi-book me-1"></i>Open the Help Centre</a>
        </div>
      </div>`;
    const offcanvas = global.bootstrap.Offcanvas.getOrCreateInstance(panel);
    panel.querySelector("#helpStartTour").addEventListener("click", () => { offcanvas.hide(); startTour(user); });
    offcanvas.show();
  }

  // ---------------------------------------------------------------------
  // Welcome tour
  // ---------------------------------------------------------------------
  const tourKey = user => `usiams.tourDone.${user.id}`;
  let tourState = null;

  function tourSteps(user) {
    const esc = global.USIAMS.util.escapeHtml;
    const firstName = String(user.name || "").replace(/^(Dr|Prof|Mr|Mrs|Ms)\.?\s+/i, "").split(" ")[0];
    const steps = [{
      target: null,
      title: `Welcome to USIAMS, ${esc(firstName)}!`,
      body: `This short tour shows where everything is for a <strong>${esc(user.roleLabel || user.role)}</strong>. It takes under a minute - use <strong>Next</strong>, or <strong>Skip</strong> to close it.`
    }];
    // Menu items this role actually has, in menu order.
    document.querySelectorAll("#sidebarContainer a.sidebar-link").forEach(link => {
      const label = (link.textContent || "").trim();
      if (MENU_TIPS[label]) steps.push({ target: link, title: label, body: esc(MENU_TIPS[label]) });
    });
    const help = document.getElementById("helpBtn");
    steps.push({
      target: help,
      title: "Help is always here",
      body: "On any page, click this <strong>?</strong> button for step-by-step instructions for that page. The Help Centre in the menu has every guide."
    });
    return steps;
  }

  function endTour(user) {
    if (!tourState) return;
    tourState.layer.remove();
    document.removeEventListener("keydown", tourState.onKey);
    global.removeEventListener("resize", tourState.onResize);
    tourState = null;
    // Saved to the user's preferences in the database, so the tour does not
    // repeat on another device; the local copy covers a failed save.
    const api = global.USIAMS.api;
    if (api && api.isHydrated()) api.savePreference("tourDone", true).catch(() => {});
    try { localStorage.setItem(tourKey(user), "1"); } catch (e) { /* storage unavailable */ }
  }

  function showTourStep() {
    const { steps, index, layer } = tourState;
    const step = steps[index];
    const shell = document.querySelector(".app-shell");
    const mobile = global.innerWidth < 992;
    // On a phone the menu slides in; open it so the item can be pointed at.
    if (shell && mobile) shell.classList.toggle("sidebar-mobile-open", !!(step.target && step.target.closest("#sidebarContainer")));
    if (step.target) step.target.scrollIntoView({ block: "nearest" });

    const spot = layer.querySelector(".tour-spotlight");
    const card = layer.querySelector(".tour-card");
    card.querySelector(".tour-title").innerHTML = step.title;
    card.querySelector(".tour-body").innerHTML = step.body;
    card.querySelector(".tour-count").textContent = `${index + 1} of ${steps.length}`;
    card.querySelector("[data-tour='back']").disabled = index === 0;
    card.querySelector("[data-tour='next']").textContent = index === steps.length - 1 ? "Finish" : "Next";

    // Let the sidebar finish sliding before measuring.
    setTimeout(() => {
      if (!tourState) return;
      const rect = step.target && step.target.getBoundingClientRect();
      const visible = rect && rect.width > 0 && rect.height > 0;
      spot.style.display = visible ? "block" : "none";
      layer.classList.toggle("tour-dim", !visible);
      card.style.transform = "";
      if (visible) {
        const pad = 6;
        Object.assign(spot.style, { top: `${rect.top - pad}px`, left: `${rect.left - pad}px`, width: `${rect.width + pad * 2}px`, height: `${rect.height + pad * 2}px` });
        const cardW = Math.min(340, global.innerWidth - 32);
        let left = rect.right + 16;
        let top = rect.top;
        if (left + cardW > global.innerWidth - 16) { left = Math.max(16, rect.right - cardW); top = rect.bottom + 16; }
        top = Math.min(top, global.innerHeight - card.offsetHeight - 16);
        Object.assign(card.style, { left: `${left}px`, top: `${Math.max(16, top)}px`, width: `${cardW}px` });
      } else {
        Object.assign(card.style, { left: "50%", top: "50%", width: `${Math.min(420, global.innerWidth - 32)}px`, transform: "translate(-50%, -50%)" });
      }
      card.querySelector("[data-tour='next']").focus();
    }, mobile ? 320 : 30);
  }

  function startTour(user) {
    if (tourState) return;
    const layer = document.createElement("div");
    layer.className = "tour-layer";
    layer.setAttribute("role", "dialog");
    layer.setAttribute("aria-modal", "true");
    layer.setAttribute("aria-label", "Welcome tour");
    layer.innerHTML = `
      <div class="tour-spotlight"></div>
      <div class="tour-card">
        <div class="tour-title"></div>
        <div class="tour-body"></div>
        <div class="tour-footer">
          <span class="tour-count"></span>
          <div class="d-flex gap-2">
            <button type="button" class="btn btn-sm btn-link text-muted-usi" data-tour="skip">Skip</button>
            <button type="button" class="btn btn-sm btn-outline-primary" data-tour="back">Back</button>
            <button type="button" class="btn btn-sm btn-primary" data-tour="next">Next</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(layer);
    tourState = {
      steps: tourSteps(user), index: 0, layer,
      onKey: e => { if (e.key === "Escape") finish(); if (e.key === "ArrowRight") move(1); if (e.key === "ArrowLeft") move(-1); },
      onResize: () => tourState && showTourStep()
    };
    function finish() {
      const shell = document.querySelector(".app-shell");
      if (shell) shell.classList.remove("sidebar-mobile-open");
      endTour(user);
    }
    function move(delta) {
      const next = tourState.index + delta;
      if (next >= tourState.steps.length) { finish(); return; }
      if (next < 0) return;
      tourState.index = next;
      showTourStep();
    }
    layer.querySelector("[data-tour='skip']").addEventListener("click", finish);
    layer.querySelector("[data-tour='back']").addEventListener("click", () => move(-1));
    layer.querySelector("[data-tour='next']").addEventListener("click", () => move(1));
    document.addEventListener("keydown", tourState.onKey);
    global.addEventListener("resize", tourState.onResize);
    showTourStep();
  }

  function tourSeen(user) {
    const api = global.USIAMS.api;
    if (api && api.isHydrated() && api.getPreference("tourDone") === true) return true;
    try { return localStorage.getItem(tourKey(user)) === "1"; } catch (e) { return true; }
  }

  // ---------------------------------------------------------------------
  // Wiring
  // ---------------------------------------------------------------------
  function init(user) {
    const btn = document.getElementById("helpBtn");
    if (btn) btn.addEventListener("click", () => openHelpPanel(user));
    // First sign-in: show the tour once the page has settled.
    if (!tourSeen(user) && !/^(403|404|500)\.html$/.test(currentPage())) {
      setTimeout(() => startTour(user), 900);
    }
  }

  /** Guides for the pages this role can open (for the Help Centre). */
  function guidesFor(user) {
    const pages = global.USIAMS.navigation.menuForRole(user.role).filter(i => i.href).map(i => i.href.split("/").pop());
    const seen = new Set();
    return pages.filter(p => GUIDES[p] && !seen.has(p) && seen.add(p))
      .map(p => ({ page: p, title: GUIDES[p].title, intro: GUIDES[p].intro, steps: stepsFor(GUIDES[p], user.role) }));
  }

  global.USIAMS = global.USIAMS || {};
  global.USIAMS.help = { init, startTour, openHelpPanel, guidesFor, guideHtml, GUIDES };

})(window);

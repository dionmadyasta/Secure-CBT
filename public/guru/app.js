// Dashboard State
let currentTab = "tab-monitoring";
let cachedData = {
  activeExamId: "",
  exams: [],
  students: [],
  sessions: {},
  violations: []
};

// DOM elements
const pageTitle = document.getElementById("page-title");
const pageDesc = document.getElementById("page-desc");
const sidebarNav = document.querySelector(".sidebar-nav");
const tabs = document.querySelectorAll(".dashboard-tab");
const navItems = document.querySelectorAll(".nav-item");

// Stats DOM Elements
const statTotalStudents = document.getElementById("stat-total-students");
const statActiveStudents = document.getElementById("stat-active-students");
const statFinishedStudents = document.getElementById("stat-finished-students");
const statCheatStudents = document.getElementById("stat-cheat-students");
const activeExamLabel = document.getElementById("active-exam-label");

// Monitoring Lists DOM
const monitoringStudentsTbody = document.getElementById("monitoring-students-tbody");
const violationLogsContainer = document.getElementById("violation-logs");
const questionAnalyticsContainer = document.getElementById("question-analytics-container");
const analyticsExamLabel = document.getElementById("analytics-exam-label");

// Students Tab DOM
const studentsTbody = document.getElementById("students-tbody");
const btnAddStudent = document.getElementById("btn-add-student");
const studentModal = document.getElementById("student-modal");
const studentModalTitle = document.getElementById("student-modal-title");
const studentForm = document.getElementById("student-form");

// Exams Tab DOM
const examsListContainer = document.getElementById("exams-list-container");
const examEditorForm = document.getElementById("exam-editor-form");
const examFormTitle = document.getElementById("exam-form-title");
const selectExamType = document.getElementById("exam-type");
const examGformGroup = document.getElementById("exam-gform-group");
const examNativeGroup = document.getElementById("exam-native-group");
const btnAddQuestion = document.getElementById("btn-add-question");
const questionsBuilderContainer = document.getElementById("questions-builder-container");
const btnCancelExamEdit = document.getElementById("btn-cancel-exam-edit");
const examIsEnabled = document.getElementById("exam-is-enabled");
const examEnabledText = document.getElementById("exam-enabled-text");
const examClassPanel = document.getElementById("exam-class-panel");
const examManualPanel = document.getElementById("exam-manual-panel");
const examClassCheckboxes = document.getElementById("exam-class-checkboxes");
const examManualStudentList = document.getElementById("exam-manual-student-list");
const examManualSelectedCount = document.getElementById("exam-manual-selected-count");
const btnNewExam = document.getElementById("btn-new-exam");

// QR Modal DOM
const qrModal = document.getElementById("qr-modal");
const qrCardName = document.getElementById("qr-card-name");
const qrCardClass = document.getElementById("qr-card-class");
const qrCardUser = document.getElementById("qr-card-user");
const qrCardPass = document.getElementById("qr-card-pass");

// Results Tab DOM
const resultsExamSelect = document.getElementById("results-exam-select");
const resultStatTotal = document.getElementById("result-stat-total");
const resultStatFinished = document.getElementById("result-stat-finished");
const resultStatViolations = document.getElementById("result-stat-violations");
const resultExamTitle = document.getElementById("result-exam-title");
const btnResultsReset = document.getElementById("btn-results-reset");
const btnResultsCsv = document.getElementById("btn-results-csv");
const resultsTbody = document.getElementById("results-tbody");
let selectedResultsExamId = "";

// Teachers Tab DOM
const teacherModal = document.getElementById("teacher-modal");
const teacherForm = document.getElementById("teacher-form");
const btnAddTeacher = document.getElementById("btn-add-teacher");
const teachersTbody = document.getElementById("teachers-tbody");
let selectedClassFilter = "all";

// ==========================================
// NAVIGATION & TABS
// ==========================================

sidebarNav.addEventListener("click", (e) => {
  const btn = e.target.closest(".nav-item");
  if (!btn) return;
  
  const targetTab = btn.getAttribute("data-tab");
  currentTab = targetTab;

  // Update nav active classes
  navItems.forEach(item => item.classList.remove("active"));
  btn.classList.add("active");

  // Update tabs visibility
  tabs.forEach(tab => {
    if (tab.id === targetTab) {
      tab.classList.add("active-tab");
    } else {
      tab.classList.remove("active-tab");
    }
  });

  // Update header text based on active tab
  if (targetTab === "tab-monitoring") {
    pageTitle.textContent = "Live Monitoring";
    pageDesc.textContent = "Pantau status pengerjaan siswa dan pelanggaran secara real-time.";
  } else if (targetTab === "tab-students") {
    pageTitle.textContent = "Data Siswa";
    pageDesc.textContent = "Kelola data login dan cetak kartu QR Code ujian siswa.";
  } else if (targetTab === "tab-exams") {
    pageTitle.textContent = "Kelola Ujian";
    pageDesc.textContent = "Buat, ubah, hapus, dan aktifkan paket soal ujian CBT atau Google Form.";
  } else if (targetTab === "tab-results") {
    pageTitle.textContent = "Hasil & Riwayat Ujian";
    pageDesc.textContent = "Melihat nilai akhir siswa, statistik kelulusan, dan unduh laporan kuis.";
  } else if (targetTab === "tab-teachers") {
    pageTitle.textContent = "Data Guru";
    pageDesc.textContent = "Kelola akun guru, pengawas, dan kredensial hak akses admin.";
  }
  
  // Render immediately on tab switch
  renderDashboard();
});

// ==========================================
// POLLING LOGIC & DATA RENDER
// ==========================================

function fetchDashboardData() {
  fetch('/api/teacher/dashboard')
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        cachedData = data;
        populateResultsExamSelect();
        renderDashboard();
      }
    })
    .catch(err => console.error("Gagal melakukan sinkronisasi data dashboard:", err));
}

function renderDashboard() {
  // Render based on what tab is active (optimize performance)
  renderMonitoringStats();
  renderMonitoringProgressTable();
  renderViolationLogs();
  renderQuestionAnalytics();
  
  if (currentTab === "tab-students") {
    renderStudentsList();
  } else if (currentTab === "tab-teachers") {
    renderTeachersList();
  } else if (currentTab === "tab-exams") {
    renderExamsList();
  } else if (currentTab === "tab-results") {
    renderResultsTab();
  }
}

// 1. Render Stats
function renderMonitoringStats() {
  statTotalStudents.textContent = cachedData.students.length;
  
  let activeCount = 0;
  let finishedCount = 0;
  let cheatCount = 0;

  const activeSessions = cachedData.sessions[cachedData.activeExamId] || {};
  Object.values(activeSessions).forEach(session => {
    if (session.status === "mengerjakan") activeCount++;
    if (session.status === "selesai") finishedCount++;
    if (session.violationCount > 0) cheatCount++;
  });

  statActiveStudents.textContent = activeCount;
  statFinishedStudents.textContent = finishedCount;
  statCheatStudents.textContent = cheatCount;

  // Active exam label
  const activeExam = cachedData.exams.find(e => e.id === cachedData.activeExamId);
  if (activeExam) {
    activeExamLabel.textContent = `Ujian Aktif: ${activeExam.title} (${activeExam.type.toUpperCase()})`;
    activeExamLabel.className = "badge";
  } else {
    activeExamLabel.textContent = "Belum Ada Ujian Aktif";
    activeExamLabel.className = "badge danger-badge";
  }
}

// 2. Render student progress table
function renderMonitoringProgressTable() {
  if (cachedData.students.length === 0) {
    monitoringStudentsTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">Belum ada data siswa terdaftar. Silakan ke menu "Kelola Siswa".</td></tr>`;
    return;
  }

  const activeSessions = cachedData.sessions[cachedData.activeExamId] || {};
  monitoringStudentsTbody.innerHTML = cachedData.students.map(student => {
    const session = activeSessions[student.username];
    let statusHTML = `<span class="status-badge belum_mulai">Belum Mulai</span>`;
    let progress = "0%";
    let violations = `<span class="violation-badge safe">0</span>`;
    let score = "-";
    let isLocked = false;
    let lockButton = `<button onclick="toggleLock('${student.username}', true)" class="btn btn-danger btn-sm" style="padding: 4px 8px; font-size: 0.75rem;">🔒 Lock</button>`;

    if (session) {
      isLocked = session.isLocked || false;
      
      if (isLocked) {
        statusHTML = `<span class="status-badge terkunci" style="background: rgba(239, 68, 68, 0.15); color: #ef4444;">Terkunci</span>`;
        lockButton = `<button onclick="toggleLock('${student.username}', false)" class="btn btn-primary btn-sm" style="padding: 4px 8px; font-size: 0.75rem;">🔓 Unlock</button>`;
      } else {
        statusHTML = `<span class="status-badge ${session.status}">${session.status === 'mengerjakan' ? 'Sedang Mengerjakan' : 'Selesai'}</span>`;
      }
      
      progress = session.progress || "0%";
      
      const vCount = session.violationCount || 0;
      if (vCount > 0) {
        violations = `<span class="violation-badge">${vCount} Pelanggaran</span>`;
      } else {
        violations = `<span class="violation-badge safe">0</span>`;
      }

      if (session.status === "selesai") {
        score = session.score;
      }
    }

    return `
      <tr>
        <td><strong>${student.name}</strong></td>
        <td>${student.class}</td>
        <td>${statusHTML}</td>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="background: rgba(255,255,255,0.05); width: 80px; height: 8px; border-radius: 4px; overflow: hidden; border: 1px solid var(--card-border);">
              <div style="background: var(--color-indigo); width: ${progress.includes('%') ? progress : '100%'}; height: 100%;"></div>
            </div>
            <span style="font-size: 0.8rem; font-weight: 500;">${progress}</span>
          </div>
        </td>
        <td>${violations}</td>
        <td><strong style="color: var(--color-emerald);">${score}</strong></td>
        <td>${lockButton}</td>
      </tr>
    `;
  }).join("");
}

async function toggleLock(username, lock) {
  const actionText = lock ? "mengunci" : "membuka kunci";
  if (!confirm(`Apakah Anda yakin ingin ${actionText} akun siswa ${username}?`)) return;

  try {
    const res = await fetch('/api/teacher/students/toggle-lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, lock })
    });
    const data = await res.json();
    if (data.success) {
      alert(`Berhasil ${actionText} akun.`);
      fetchDashboardData();
    } else {
      alert("Gagal: " + data.message);
    }
  } catch (err) {
    console.error(err);
    alert("Terjadi kesalahan sistem.");
  }
}

// 3. Render violation logs feed
let loggedViolationIds = new Set();
function renderViolationLogs() {
  const activeViolations = cachedData.violations[cachedData.activeExamId] || [];
  if (activeViolations.length === 0) {
    violationLogsContainer.innerHTML = `<div style="text-align: center; padding: 40px 0; color: var(--text-muted); font-size: 0.875rem;">Belum terdeteksi adanya pelanggaran/kecurangan.</div>`;
    return;
  }

  // Render list
  violationLogsContainer.innerHTML = activeViolations.map(v => {
    const isSkip = v.type === 'skip' || (v.detail && v.detail.startsWith('Melewati Soal'));
    const icon = isSkip ? '↪️' : '⚠️';
    const styleClass = isSkip ? 'log-entry skip-entry' : 'log-entry';
    return `
      <div class="${styleClass}">
        <div class="log-header">
          <span class="log-student">${v.name} (${v.class})</span>
          <span>${v.time}</span>
        </div>
        <div class="log-detail">${icon} ${v.detail}</div>
      </div>
    `;
  }).join("");
}



// 4. Render live question analytics
function renderQuestionAnalytics() {
  const activeExam = cachedData.exams.find(e => e.id === cachedData.activeExamId);
  const activeSessions = cachedData.sessions[cachedData.activeExamId] || {};

  if (!questionAnalyticsContainer) return;

  // Only show for native CBT exams with questions
  if (!activeExam || activeExam.type !== 'native' || !activeExam.questions || activeExam.questions.length === 0) {
    questionAnalyticsContainer.innerHTML = `<div style="text-align: center; padding: 40px 0; color: var(--text-muted); font-size: 0.875rem;">Analitik hanya tersedia untuk ujian Native CBT dengan soal aktif.</div>`;
    if (analyticsExamLabel) analyticsExamLabel.textContent = activeExam ? activeExam.title : '—';
    return;
  }

  if (analyticsExamLabel) analyticsExamLabel.textContent = activeExam.title;

  // Collect all student answers from active sessions
  const sessions = Object.values(activeSessions);
  const totalResponders = sessions.filter(s => s.answers && Object.keys(s.answers).length > 0).length;

  if (totalResponders === 0) {
    questionAnalyticsContainer.innerHTML = `<div style="text-align: center; padding: 40px 0; color: var(--text-muted); font-size: 0.875rem;">Belum ada data jawaban siswa yang masuk.</div>`;
    return;
  }

  // Build stats per question
  const questionStats = activeExam.questions.map((q, idx) => {
    const optionCounts = {}; // { 'A': 5, 'B': 2, ... }
    let answered = 0;
    let correct = 0;
    let wrong = 0;

    sessions.forEach(s => {
      if (!s.answers) return;
      const studentAns = s.answers[q.id];
      if (studentAns) {
        answered++;
        optionCounts[studentAns] = (optionCounts[studentAns] || 0) + 1;
        if (studentAns === q.answer) correct++;
        else wrong++;
      }
    });

    const unanswered = sessions.length - answered;
    const correctPct = answered > 0 ? Math.round((correct / sessions.length) * 100) : 0;
    const wrongPct = answered > 0 ? Math.round((wrong / sessions.length) * 100) : 0;

    let difficulty = 'easy';
    let diffLabel = 'Mudah';
    if (correctPct < 40) { difficulty = 'hard'; diffLabel = 'Sulit'; }
    else if (correctPct < 70) { difficulty = 'medium'; diffLabel = 'Sedang'; }

    // Build per-option bar rows
    const allOptions = Object.keys(q.options || {}).sort();
    const maxCount = Math.max(1, ...allOptions.map(k => optionCounts[k] || 0));
    const optionBars = allOptions.map(key => {
      const count = optionCounts[key] || 0;
      const pct = Math.round((count / Math.max(1, sessions.length)) * 100);
      const isCorrect = key === q.answer;
      const fillClass = isCorrect ? 'correct' : (count > 0 ? 'wrong' : 'neutral');
      return `
        <div class="analytics-bar-row">
          <span class="analytics-bar-label">${key}</span>
          <div class="analytics-bar-track">
            <div class="analytics-bar-fill ${fillClass}" style="width: ${pct}%"></div>
          </div>
          <span class="analytics-bar-count">${count}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="analytics-question-card">
        <div class="analytics-q-label">Soal ${idx + 1}</div>
        <div class="analytics-q-text">${q.question}</div>
        ${optionBars}
        <div class="analytics-summary-row">
          <span class="analytics-summary-chip correct">✓ ${correct} Benar</span>
          <span class="analytics-summary-chip wrong">✗ ${wrong} Salah</span>
          ${unanswered > 0 ? `<span class="analytics-summary-chip unanswered">${unanswered} Belum</span>` : ''}
          <span class="analytics-difficulty-badge ${difficulty}">${diffLabel}</span>
        </div>
      </div>
    `;
  }).join('');

  questionAnalyticsContainer.innerHTML = `
    <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 14px;">
      Berdasarkan ${sessions.length} siswa yang telah bergabung &middot; ${totalResponders} siswa telah menjawab
    </p>
    <div class="analytics-grid">${questionStats}</div>
  `;
}

// ==========================================
// STUDENTS MANAGEMENT (CRUD & QR)
// ==========================================

function renderClassSidebarList() {
  const btnClassAll = document.getElementById("btn-class-all");
  const countAll = document.getElementById("class-count-all");
  const listVii = document.getElementById("class-list-vii");
  const listViii = document.getElementById("class-list-viii");
  const listIx = document.getElementById("class-list-ix");

  if (!countAll || !listVii || !listViii || !listIx) return;

  countAll.textContent = cachedData.students.length;

  if (selectedClassFilter === "all") {
    btnClassAll.style.borderColor = "var(--color-indigo)";
    btnClassAll.style.background = "rgba(255,255,255,0.06)";
    btnClassAll.style.fontWeight = "600";
  } else {
    btnClassAll.style.borderColor = "var(--card-border)";
    btnClassAll.style.background = "rgba(255,255,255,0.02)";
    btnClassAll.style.fontWeight = "500";
  }

  // Group unique classes from students
  const classGroups = { VII: {}, VIII: {}, IX: {} };
  
  cachedData.students.forEach(s => {
    const grade = s.grade || "VII";
    const subClass = s.subClass || "A";
    const fullClass = s.class || `${grade}-${subClass}`;
    
    if (classGroups[grade]) {
      classGroups[grade][fullClass] = (classGroups[grade][fullClass] || 0) + 1;
    }
  });

  const renderGroup = (grade, container) => {
    const standardLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    
    // Find any custom subclass letters from the actual students database
    const actualSubclasses = Object.keys(classGroups[grade]).map(cls => cls.split('-')[1]);
    
    // Merge standard and custom subclasses, sort them alphabetically
    const uniqueLettersSet = new Set([...standardLetters, ...actualSubclasses]);
    const sortedLetters = Array.from(uniqueLettersSet).sort();

    container.innerHTML = sortedLetters.map(letter => {
      const cls = `${grade}-${letter}`;
      const isActive = selectedClassFilter === cls;
      const count = classGroups[grade][cls] || 0;
      const bg = isActive ? "rgba(99, 102, 241, 0.25)" : "rgba(255, 255, 255, 0.02)";
      const border = isActive ? "var(--color-indigo)" : "var(--card-border)";
      const countColor = count > 0 ? (isActive ? "#a5b4fc" : "var(--color-indigo)") : "var(--text-muted)";
      const fontWeight = isActive ? "700" : "600";

      return `
        <button type="button" class="class-filter-btn" onclick="setClassFilter('${cls}')" style="display: inline-flex; flex-direction: column; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 8px; border: 1px solid ${border}; background: ${bg}; color: white; cursor: pointer; transition: all 0.2s ease; padding: 0;" title="Kelas ${cls} (${count} Siswa)">
          <span style="font-size: 0.9rem; font-weight: ${fontWeight}; line-height: 1.1; margin-top: 2px;">${letter}</span>
          <span style="font-size: 0.65rem; color: ${countColor}; line-height: 1; margin-bottom: 2px;">${count}</span>
        </button>
      `;
    }).join("");
  };

  renderGroup("VII", listVii);
  renderGroup("VIII", listViii);
  renderGroup("IX", listIx);
}

window.setClassFilter = function(cls) {
  selectedClassFilter = cls;
  renderStudentsList();
};

function updateBulkDeleteButton() {
  const btnBulkDelete = document.getElementById("btn-bulk-delete");
  const bulkCount = document.getElementById("bulk-delete-count");
  if (!btnBulkDelete || !bulkCount) return;

  const selectedBoxes = studentsTbody.querySelectorAll(".student-checkbox:checked");
  const count = selectedBoxes.length;

  if (count > 0) {
    btnBulkDelete.style.display = "inline-flex";
    bulkCount.textContent = count;
  } else {
    btnBulkDelete.style.display = "none";
  }
}

function renderStudentsList() {
  renderClassSidebarList();

  const checkAll = document.getElementById("check-all-students");
  if (checkAll) checkAll.checked = false;
  updateBulkDeleteButton();

  if (cachedData.students.length === 0) {
    studentsTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px;">Belum ada data siswa. Klik tombol "Tambah Siswa Baru" atau "Import CSV".</td></tr>`;
    return;
  }

  let filteredStudents = cachedData.students;
  if (selectedClassFilter !== "all") {
    filteredStudents = cachedData.students.filter(s => s.class === selectedClassFilter);
  }

  if (filteredStudents.length === 0) {
    studentsTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px;">Tidak ada data siswa di kelas ${selectedClassFilter}.</td></tr>`;
    return;
  }

  // Sort students by class name, then student name
  filteredStudents.sort((a, b) => {
    if (a.class !== b.class) return a.class.localeCompare(b.class);
    return a.name.localeCompare(b.name);
  });

  studentsTbody.innerHTML = filteredStudents.map(s => `
    <tr>
      <td><strong>${s.name}</strong></td>
      <td><span class="badge">${s.class}</span></td>
      <td><code>${s.username}</code></td>
      <td><code>${s.password}</code></td>
      <td style="text-align: center;">
        <button type="button" class="btn-icon" onclick="openQrModal('${s.id}')">🪪</button>
      </td>
      <td style="text-align: center;">
        <div class="action-buttons" style="justify-content: center; gap: 5px;">
          <button type="button" class="btn-icon" onclick="openEditStudentModal('${s.id}')">✏️</button>
          <button type="button" class="btn-sm-danger" onclick="deleteStudent('${s.id}', '${s.name}')">🗑️</button>
        </div>
      </td>
      <td style="text-align: center; padding: 12px 8px;">
        <input type="checkbox" class="student-checkbox" data-id="${s.id}" style="width: 16px; height: 16px; cursor: pointer;">
      </td>
    </tr>
  `).join("");
}

// Checkboxes event listeners & Bulk delete triggers
const checkAll = document.getElementById("check-all-students");
if (checkAll) {
  checkAll.addEventListener("change", (e) => {
    if (!studentsTbody) return;
    const boxes = studentsTbody.querySelectorAll(".student-checkbox");
    boxes.forEach(box => {
      box.checked = e.target.checked;
    });
    updateBulkDeleteButton();
  });
}

if (studentsTbody) {
  studentsTbody.addEventListener("change", (e) => {
    if (e.target.classList.contains("student-checkbox")) {
      updateBulkDeleteButton();
    }
  });
}

const btnBulkDelete = document.getElementById("btn-bulk-delete");
if (btnBulkDelete) {
  btnBulkDelete.addEventListener("click", () => {
    const selectedBoxes = studentsTbody.querySelectorAll(".student-checkbox:checked");
    const ids = Array.from(selectedBoxes).map(box => box.getAttribute("data-id"));
    if (ids.length === 0) return;

    if (confirm(`Apakah Anda yakin ingin menghapus ${ids.length} siswa terpilih? Riwayat sesi kuis mereka juga akan ikut dibersihkan.`)) {
      fetch('/api/teacher/students/bulk-delete', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          fetchDashboardData();
          alert("Siswa terpilih berhasil dihapus!");
        } else {
          alert("Gagal menghapus siswa: " + (data.message || ""));
        }
      })
      .catch(err => alert("Gagal menghubungi server: " + err.message));
    }
  });
}

// Download Student CSV template file trigger
const btnDownloadTemplate = document.getElementById("btn-download-template");
if (btnDownloadTemplate) {
  btnDownloadTemplate.addEventListener("click", (e) => {
    e.preventDefault();
    const csvContent = "Nama Lengkap,Tingkat Kelas,Rombel,Username,Password\n" +
                       "Budi Santoso,VII,A,budi123,pass123\n" +
                       "Siti Rahma,VIII,B,siti456,pass456\n" +
                       "Ahmad Dani,IX,C,ahmad789,pass789";
    
    // Download logic
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "template_data_siswa.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
}

// Upload/Import CSV parse trigger
const inputImportCsv = document.getElementById("input-import-csv");
if (inputImportCsv) {
  inputImportCsv.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
      const text = evt.target.result;
      const lines = text.split(/\r?\n/);
      if (lines.length <= 1) {
        alert("File CSV kosong atau tidak memiliki data siswa.");
        inputImportCsv.value = "";
        return;
      }

      const parsedStudents = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Clean values split
        const cols = line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
        if (cols.length < 5) continue;

        const name = cols[0];
        let grade = cols[1];
        let subClass = cols[2];
        const username = cols[3];
        const password = cols[4];

        if (!name || !grade || !subClass || !username || !password) continue;

        // Normalize Grade (1, 7, vii -> VII)
        grade = grade.toUpperCase();
        if (grade === "1" || grade === "7" || grade === "VII") {
          grade = "VII";
        } else if (grade === "2" || grade === "8" || grade === "VIII") {
          grade = "VIII";
        } else if (grade === "3" || grade === "9" || grade === "IX") {
          grade = "IX";
        } else {
          grade = "VII";
        }

        subClass = subClass.toUpperCase();

        parsedStudents.push({
          name,
          grade,
          subClass,
          username,
          password
        });
      }

      if (parsedStudents.length === 0) {
        alert("Tidak ada data siswa yang valid ditemukan di dalam file CSV.");
        inputImportCsv.value = "";
        return;
      }

      if (confirm(`Menemukan ${parsedStudents.length} data siswa di file CSV. Import sekarang?`)) {
        fetch('/api/teacher/students/bulk-add', {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ students: parsedStudents })
        })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            fetchDashboardData();
            alert(`Selesai! Berhasil meng-import ${data.imported} siswa. (Dilewati karena username ganda: ${data.skipped})`);
          } else {
            alert("Gagal meng-import siswa: " + (data.message || ""));
          }
        })
        .catch(err => alert("Gagal menghubungi server: " + err.message))
        .finally(() => {
          inputImportCsv.value = "";
        });
      } else {
        inputImportCsv.value = "";
      }
    };
    reader.readAsText(file);
  });
}

// Bind the all button
const btnClassAll = document.getElementById("btn-class-all");
if (btnClassAll) {
  btnClassAll.addEventListener("click", () => {
    window.setClassFilter("all");
  });
}

// Open modal for add
btnAddStudent.addEventListener("click", () => {
  studentForm.reset();
  document.getElementById("edit-student-id").value = "";
  document.getElementById("student-grade").value = "VII";
  document.getElementById("student-subclass").value = "";
  studentModalTitle.textContent = "Tambah Siswa Baru";
  studentModal.classList.remove("hidden");
});

// Open modal for edit
window.openEditStudentModal = function(id) {
  const s = cachedData.students.find(x => x.id === id);
  if (!s) return;

  document.getElementById("edit-student-id").value = s.id;
  document.getElementById("student-name").value = s.name;
  document.getElementById("student-grade").value = s.grade || "VII";
  document.getElementById("student-subclass").value = s.subClass || "A";
  document.getElementById("student-username").value = s.username;
  document.getElementById("student-password").value = s.password;

  studentModalTitle.textContent = "Edit Data Siswa";
  studentModal.classList.remove("hidden");
};

// Close modal student
window.closeStudentModal = function() {
  studentModal.classList.add("hidden");
};

// Save Student
studentForm.addEventListener("submit", (e) => {
  e.preventDefault();
  
  const id = document.getElementById("edit-student-id").value;
  const name = document.getElementById("student-name").value.trim();
  const grade = document.getElementById("student-grade").value;
  const subClass = document.getElementById("student-subclass").value.trim().toUpperCase();
  const username = document.getElementById("student-username").value.trim().toLowerCase();
  const password = document.getElementById("student-password").value.trim();

  const action = id ? 'edit' : 'add';
  const payload = { action, student: { id, name, grade, subClass, username, password } };

  fetch('/api/teacher/students', {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
  .then(res => {
    if (!res.ok) {
      return res.json().then(d => { throw new Error(d.message); });
    }
    return res.json();
  })
  .then(data => {
    closeStudentModal();
    fetchDashboardData();
  })
  .catch(err => {
    alert("Gagal menyimpan data siswa: " + err.message);
  });
});

// Delete Student
window.deleteStudent = function(id, name) {
  if (confirm(`Apakah Anda yakin ingin menghapus siswa "${name}"? Ini juga akan menghapus log ujian siswa tersebut.`)) {
    fetch('/api/teacher/students', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: 'delete', student: { id } })
    })
    .then(res => res.json())
    .then(data => {
      fetchDashboardData();
    })
    .catch(err => alert("Gagal menghapus siswa: " + err.message));
  }
};

// QR CODE MODAL OPERATIONS
window.openQrModal = function(studentId) {
  const student = cachedData.students.find(s => s.id === studentId);
  if (!student) return;

  qrCardName.textContent = student.name;
  qrCardClass.textContent = student.class;
  qrCardUser.textContent = student.username;
  qrCardPass.textContent = student.password;

  // Clear previous QR Canvas
  const canvas = document.getElementById("qr-canvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Generate new QR card token string (e.g. username:password)
  const token = `${student.username}:${student.password}`;

  // Initialize QRious
  new QRious({
    element: canvas,
    value: token,
    size: 200,
    background: '#ffffff',
    foreground: '#0f172a',
    level: 'H'
  });

  qrModal.classList.remove("hidden");
};

window.closeQrModal = function() {
  qrModal.classList.add("hidden");
};

window.printQrCard = function() {
  window.print();
};

// ==========================================
// EXAM MANAGEMENT (CRUD & BUILDER)
// ==========================================

// Handle exam type layout toggling
selectExamType.addEventListener("change", (e) => {
  if (e.target.value === "google-form") {
    examGformGroup.classList.remove("hidden");
    examNativeGroup.classList.add("hidden");
    document.getElementById("exam-gform-url").required = true;
  } else {
    examGformGroup.classList.add("hidden");
    examNativeGroup.classList.remove("hidden");
    document.getElementById("exam-gform-url").required = false;
  }
});

let selectedExamId = null;

function renderExamsList() {
  if (cachedData.exams.length === 0) {
    examsListContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 30px;">Belum ada ujian tersimpan. Klik "Buat Ujian Baru" untuk memulai.</div>`;
    return;
  }

  examsListContainer.innerHTML = cachedData.exams.map(e => {
    const isActive = e.isEnabled && e.id === cachedData.activeExamId;
    const activeClass = isActive ? "active-exam" : "";
    const selectedClass = e.id === selectedExamId ? "selected-exam-card" : "";
    
    // Status badge
    const statusBadge = e.isEnabled
      ? `<span class="badge" style="background: rgba(16,185,129,0.15); color: #6ee7b7; border-color: rgba(16,185,129,0.3); font-size:0.7rem;">🟢 Aktif</span>`
      : `<span class="badge" style="background: rgba(100,100,120,0.15); color: var(--text-muted); border-color: rgba(100,100,120,0.25); font-size:0.7rem;">⚫ Non-aktif</span>`;

    // Schedule badge
    let scheduleBadge = "";
    if (e.autoActivateAt) {
      const d = new Date(e.autoActivateAt);
      const wibStr = d.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
      scheduleBadge = `<span style="font-size:0.72rem; color: var(--color-indigo); display:block; margin-top:3px;">⏰ Auto aktif: ${wibStr} WIB</span>`;
    }

    // Participants badge
    let participantText = "🌐 Semua Siswa";
    const allowed = e.allowedStudents;
    if (allowed && allowed !== "all") {
      if (Array.isArray(allowed)) {
        participantText = `✋ ${allowed.length} Siswa Manual`;
      } else if (typeof allowed === "string") {
        const classes = allowed.split(',').filter(Boolean);
        participantText = `🏫 ${classes.join(', ')}`;
      }
    }

    // Toggle button
    const toggleBtn = e.isEnabled
      ? `<button type="button" class="btn-sm-danger" style="background: rgba(239,68,68,0.1); color: #fca5a5; border: 1px solid rgba(239,68,68,0.25); font-size:0.75rem;" onclick="event.stopPropagation(); toggleExamEnabled('${e.id}')">⏸ Non-aktifkan</button>`
      : `<button type="button" class="btn-sm-indigo" style="background: rgba(16,185,129,0.12); color: #a7f3d0; border: 1px solid rgba(16,185,129,0.25); font-size:0.75rem;" onclick="event.stopPropagation(); toggleExamEnabled('${e.id}')">▶ Aktifkan</button>`;
    
    return `
      <div class="exam-item-card ${activeClass} ${selectedClass}" data-exam-id="${e.id}" onclick="editExam('${e.id}')" style="position:relative; cursor:pointer;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 6px;">
          <h3 class="exam-card-title" style="flex:1;">${e.title}</h3>
          ${statusBadge}
        </div>
        ${scheduleBadge}
        <div class="exam-card-meta" style="margin-top: 6px;">
          <span>🕒 ${Math.round(e.duration / 60)} Menit</span>
          <span>•</span>
          <span>⚙️ ${e.type === 'native' ? e.questions.length + ' Soal (Native)' : 'Google Form'}</span>
          <span>•</span>
          <span title="Peserta">${participantText}</span>
        </div>
        ${e.randomize ? '<div style="font-size:0.72rem; color: var(--text-muted); margin-top:4px;">🔀 Acak soal aktif</div>' : ''}
        ${e.showOneByOne ? '<div style="font-size:0.72rem; color: var(--text-muted); margin-top:2px;">📄 Mode satu soal per layar</div>' : ''}
        <div class="exam-actions" style="margin-top:10px;">
          ${toggleBtn}
          <button type="button" class="btn-sm-danger" onclick="event.stopPropagation(); deleteExam('${e.id}', '${e.title}')">🗑️ Hapus</button>
        </div>
      </div>
    `;
  }).join("");
}

// Toggle exam enabled/disabled
window.toggleExamEnabled = function(examId) {
  const exam = cachedData.exams.find(e => e.id === examId);
  if (!exam) return;
  const action = exam.isEnabled ? 'Nonaktifkan' : 'Aktifkan';
  if (confirm(`${action} ujian "${exam.title}"?`)) {
    fetch('/api/teacher/exams', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: 'toggle-enable', exam: { id: examId } })
    })
    .then(res => res.json())
    .then(() => fetchDashboardData())
    .catch(err => alert("Gagal mengubah status ujian: " + err.message));
  }
};

// Activate Exam (legacy, kept for compatibility)
window.activateExam = function(examId) {
  if (confirm("Mengaktifkan ujian ini akan menonaktifkan ujian lain yang sedang aktif. Anda yakin?")) {
    fetch('/api/teacher/exams', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: 'activate', activeExamId: examId })
    })
    .then(res => res.json())
    .then(() => fetchDashboardData())
    .catch(err => alert("Gagal mengaktifkan ujian: " + err.message));
  }
};

// Delete Exam
window.deleteExam = function(examId, title) {
  if (confirm(`Apakah Anda yakin ingin menghapus ujian "${title}"?`)) {
    fetch('/api/teacher/exams', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: 'delete', exam: { id: examId } })
    })
    .then(res => res.json())
    .then(data => {
      fetchDashboardData();
    })
    .catch(err => alert("Gagal menghapus ujian: " + err.message));
  }
};

// Cancel Exam Edit Mode
btnCancelExamEdit.addEventListener("click", () => {
  resetExamForm();
});

function resetExamForm() {
  examEditorForm.reset();
  document.getElementById("edit-exam-id").value = "";
  questionsBuilderContainer.innerHTML = "";
  examFormTitle.textContent = "Pengaturan";
  btnCancelExamEdit.classList.add("hidden");
  selectExamType.value = "native";
  selectExamType.dispatchEvent(new Event('change'));
  // Reset new fields
  examIsEnabled.checked = false;
  if (examEnabledText) examEnabledText.textContent = "Non-aktif";
  document.getElementById("exam-auto-activate").value = "";
  document.getElementById("allowed-all").checked = true;
  examClassPanel.classList.add("hidden");
  examManualPanel.classList.add("hidden");
  // Clear card selection
  selectedExamId = null;
  document.querySelectorAll(".exam-item-card").forEach(c => c.classList.remove("selected-exam-card"));
}

// ── Helper: Get unique classes list from students ──────────────────────────
function getUniqueClasses() {
  const classSet = new Set();
  cachedData.students.forEach(s => classSet.add(s.class));
  return Array.from(classSet).sort();
}

// ── Populate class checkbox panel ──────────────────────────────────────────
function populateClassPanel(selectedClasses = []) {
  const classes = getUniqueClasses();
  if (classes.length === 0) {
    examClassCheckboxes.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">Belum ada data siswa.</p>`;
    return;
  }
  examClassCheckboxes.innerHTML = classes.map(cls => {
    const checked = selectedClasses.includes(cls) ? 'checked' : '';
    const count = cachedData.students.filter(s => s.class === cls).length;
    return `
      <label class="class-checkbox-item">
        <input type="checkbox" class="exam-class-cb" value="${cls}" ${checked}>
        <span class="class-checkbox-label">${cls}</span>
        <span class="class-checkbox-count">${count} siswa</span>
      </label>
    `;
  }).join("");
}

// ── Populate manual student list panel ────────────────────────────────────
function populateManualPanel(selectedUsernames = []) {
  renderManualStudentList(cachedData.students, selectedUsernames);
}

function renderManualStudentList(students, selectedUsernames = []) {
  const searchVal = document.getElementById("exam-student-search")?.value.toLowerCase() || "";
  const filtered = students.filter(s =>
    !searchVal || s.name.toLowerCase().includes(searchVal) || s.username.toLowerCase().includes(searchVal) || s.class.toLowerCase().includes(searchVal)
  );

  if (filtered.length === 0) {
    examManualStudentList.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem; padding: 12px;">Tidak ada siswa ditemukan.</p>`;
    updateManualSelectedCount();
    return;
  }

  examManualStudentList.innerHTML = filtered.map(s => {
    const checked = selectedUsernames.includes(s.username) ? 'checked' : '';
    return `
      <label class="manual-student-item">
        <input type="checkbox" class="exam-manual-cb" value="${s.username}" ${checked}>
        <span class="manual-student-name">${s.name}</span>
        <span class="badge" style="font-size:0.68rem; padding:2px 6px;">${s.class}</span>
      </label>
    `;
  }).join("");

  // Re-attach change listeners for count update
  examManualStudentList.querySelectorAll(".exam-manual-cb").forEach(cb => {
    cb.addEventListener("change", updateManualSelectedCount);
  });
  updateManualSelectedCount();
}

function updateManualSelectedCount() {
  const total = examManualStudentList.querySelectorAll(".exam-manual-cb:checked").length;
  if (examManualSelectedCount) examManualSelectedCount.textContent = `${total} siswa dipilih`;
}

// ── Status toggle text ─────────────────────────────────────────────────────
if (examIsEnabled) {
  examIsEnabled.addEventListener("change", () => {
    if (examEnabledText) examEnabledText.textContent = examIsEnabled.checked ? "Aktif" : "Non-aktif";
  });
}

// ── Native CBT configurations mutually exclusive toggle ──────────────────────
const examOneByOne = document.getElementById("exam-onebyone");
const examShowAll = document.getElementById("exam-showall");

if (examOneByOne && examShowAll) {
  examOneByOne.addEventListener("change", () => {
    if (examOneByOne.checked) {
      examShowAll.checked = false;
    } else {
      examShowAll.checked = true;
    }
  });
  examShowAll.addEventListener("change", () => {
    if (examShowAll.checked) {
      examOneByOne.checked = false;
    } else {
      examOneByOne.checked = true;
    }
  });
}

// ── Allowed mode radio listeners ───────────────────────────────────────────
document.querySelectorAll('input[name="allowed-mode"]').forEach(radio => {
  radio.addEventListener("change", () => {
    const mode = document.querySelector('input[name="allowed-mode"]:checked')?.value;
    examClassPanel.classList.toggle("hidden", mode !== "by-class");
    examManualPanel.classList.toggle("hidden", mode !== "manual");
    if (mode === "by-class") populateClassPanel();
    if (mode === "manual") populateManualPanel();
  });
});

// ── New exam button (scroll to form & reset) ───────────────────────────────
if (btnNewExam) {
  btnNewExam.addEventListener("click", () => {
    resetExamForm();
    examFormTitle.textContent = "Buat Ujian Baru";
    document.getElementById("exam-editor-card")?.scrollIntoView({ behavior: 'smooth' });
  });
}

// ── Select all students in manual panel ───────────────────────────────────
document.getElementById("exam-select-all-students")?.addEventListener("click", () => {
  const boxes = examManualStudentList.querySelectorAll(".exam-manual-cb");
  const allChecked = Array.from(boxes).every(b => b.checked);
  boxes.forEach(b => { b.checked = !allChecked; });
  updateManualSelectedCount();
});

// ── Search filter in manual panel ──────────────────────────────────────────
document.getElementById("exam-student-search")?.addEventListener("input", () => {
  const checked = Array.from(examManualStudentList.querySelectorAll(".exam-manual-cb:checked")).map(b => b.value);
  renderManualStudentList(cachedData.students, checked);
});

window.editExam = function(examId) {
  const e = cachedData.exams.find(x => x.id === examId);
  if (!e) return;

  resetExamForm();

  // Highlight selected card
  selectedExamId = examId;
  document.querySelectorAll(".exam-item-card").forEach(c => {
    c.classList.toggle("selected-exam-card", c.dataset.examId === examId);
  });

  document.getElementById("edit-exam-id").value = e.id;
  document.getElementById("exam-title").value = e.title;
  document.getElementById("exam-duration").value = Math.round(e.duration / 60);
  selectExamType.value = e.type;

  // Status fields
  examIsEnabled.checked = !!e.isEnabled;
  if (examEnabledText) examEnabledText.textContent = e.isEnabled ? "Aktif" : "Non-aktif";

  // Auto-activate: convert stored ISO to datetime-local format in WIB
  if (e.autoActivateAt) {
    try {
      const d = new Date(e.autoActivateAt);
      const wibMs = d.getTime() + (7 * 60 * 60 * 1000);
      const wibDate = new Date(wibMs);
      const local = wibDate.toISOString().slice(0, 16);
      document.getElementById("exam-auto-activate").value = local;
    } catch(_) {}
  }
  
  if (e.type === "google-form") {
    document.getElementById("exam-gform-url").value = e.googleFormUrl || "";
  } else {
    document.getElementById("exam-randomize").checked = !!e.randomize;
    document.getElementById("exam-onebyone").checked = !!e.showOneByOne;
    document.getElementById("exam-showall").checked = !e.showOneByOne;
    e.questions.forEach(q => addQuestionField(q));
  }

  // Allowed students
  const allowed = e.allowedStudents || "all";
  if (Array.isArray(allowed)) {
    document.getElementById("allowed-manual").checked = true;
    examManualPanel.classList.remove("hidden");
    examClassPanel.classList.add("hidden");
    populateManualPanel(allowed);
  } else if (typeof allowed === "string" && allowed !== "all") {
    document.getElementById("allowed-class").checked = true;
    examClassPanel.classList.remove("hidden");
    examManualPanel.classList.add("hidden");
    const classes = allowed.split(',').map(c => c.trim());
    populateClassPanel(classes);
  } else {
    document.getElementById("allowed-all").checked = true;
    examClassPanel.classList.add("hidden");
    examManualPanel.classList.add("hidden");
  }

  selectExamType.dispatchEvent(new Event('change'));
  examFormTitle.textContent = `📝 ${e.title}`;
  btnCancelExamEdit.classList.remove("hidden");
  document.getElementById("exam-editor-card")?.scrollIntoView({ behavior: 'smooth' });
};

// Add Question input block
btnAddQuestion.addEventListener("click", () => {
  addQuestionField();
});

function addQuestionField(qData = null) {
  const count = questionsBuilderContainer.children.length + 1;
  const qId = qData ? qData.id : Date.now() + Math.floor(Math.random() * 1000);
  const qText = qData ? qData.question : "";
  const optA = qData ? qData.options.A : "";
  const optB = qData ? qData.options.B : "";
  const optC = qData ? qData.options.C : "";
  const optD = qData ? qData.options.D : "";
  const keyAns = qData ? qData.answer : "A";

  const card = document.createElement("div");
  card.className = "question-builder-card";
  card.dataset.id = qId;
  card.innerHTML = `
    <h4>
      <span>Butir Soal #${count}</span>
      <button type="button" class="btn-remove-question" onclick="this.closest('.question-builder-card').remove(); reindexQuestionCards();">❌ Hapus Soal</button>
    </h4>
    <div class="input-group" style="margin-bottom: 12px;">
      <label>Pertanyaan / Soal</label>
      <textarea class="question-text-val" rows="2" placeholder="Tuliskan pertanyaan ujian..." required>${qText}</textarea>
    </div>
    <div class="option-input-grid">
      <div class="option-field">
        <span>A</span>
        <input type="text" class="opt-a-val" placeholder="Pilihan A" value="${optA}" required>
      </div>
      <div class="option-field">
        <span>B</span>
        <input type="text" class="opt-b-val" placeholder="Pilihan B" value="${optB}" required>
      </div>
      <div class="option-field">
        <span>C</span>
        <input type="text" class="opt-c-val" placeholder="Pilihan C" value="${optC}" required>
      </div>
      <div class="option-field">
        <span>D</span>
        <input type="text" class="opt-d-val" placeholder="Pilihan D" value="${optD}" required>
      </div>
    </div>
    <div class="input-group" style="margin-bottom: 0;">
      <label>Kunci Jawaban yang Benar</label>
      <select class="answer-key-val" style="padding: 8px 12px;">
        <option value="A" ${keyAns === 'A' ? 'selected' : ''}>Pilihan A</option>
        <option value="B" ${keyAns === 'B' ? 'selected' : ''}>Pilihan B</option>
        <option value="C" ${keyAns === 'C' ? 'selected' : ''}>Pilihan C</option>
        <option value="D" ${keyAns === 'D' ? 'selected' : ''}>Pilihan D</option>
      </select>
    </div>
  `;

  questionsBuilderContainer.appendChild(card);
  questionsBuilderContainer.scrollTop = questionsBuilderContainer.scrollHeight;
}

window.reindexQuestionCards = function() {
  const cards = questionsBuilderContainer.querySelectorAll(".question-builder-card");
  cards.forEach((card, idx) => {
    card.querySelector("h4 span").textContent = `Butir Soal #${idx + 1}`;
  });
};

// Save / Submit Exam Form
examEditorForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const id = document.getElementById("edit-exam-id").value;
  const title = document.getElementById("exam-title").value.trim();
  const durationMinutes = parseInt(document.getElementById("exam-duration").value) || 60;
  const type = selectExamType.value;
  const googleFormUrl = document.getElementById("exam-gform-url").value.trim();
  const isEnabled = document.getElementById("exam-is-enabled").checked;

  // Auto-activate: convert local datetime to ISO with +07:00 WIB offset
  let autoActivateAt = "";
  const autoVal = document.getElementById("exam-auto-activate").value;
  if (autoVal) {
    // datetime-local gives YYYY-MM-DDTHH:mm (no tz), treat as WIB
    autoActivateAt = autoVal + ":00+07:00";
  }

  // Allowed students
  const allowedMode = document.querySelector('input[name="allowed-mode"]:checked')?.value || "all";
  let allowedStudents = "all";
  if (allowedMode === "by-class") {
    const selected = Array.from(document.querySelectorAll(".exam-class-cb:checked")).map(cb => cb.value);
    allowedStudents = selected.length > 0 ? selected.join(',') : "all";
  } else if (allowedMode === "manual") {
    const selected = Array.from(document.querySelectorAll(".exam-manual-cb:checked")).map(cb => cb.value);
    allowedStudents = selected.length > 0 ? selected : "all";
  }

  const action = id ? 'edit' : 'add';
  const examPayload = {
    id,
    title,
    duration: durationMinutes * 60,
    type,
    googleFormUrl: type === 'google-form' ? googleFormUrl : "",
    isEnabled,
    autoActivateAt,
    allowedStudents,
    randomize: type === 'native' ? document.getElementById("exam-randomize").checked : false,
    showOneByOne: type === 'native' ? document.getElementById("exam-onebyone").checked : false,
    questions: []
  };

  // Compile native questions
  if (type === 'native') {
    const cards = questionsBuilderContainer.querySelectorAll(".question-builder-card");
    if (cards.length === 0) {
      alert("Harap masukkan minimal 1 butir soal untuk jenis Native CBT!");
      return;
    }
    
    cards.forEach(card => {
      examPayload.questions.push({
        id: parseInt(card.dataset.id),
        question: card.querySelector(".question-text-val").value.trim(),
        options: {
          A: card.querySelector(".opt-a-val").value.trim(),
          B: card.querySelector(".opt-b-val").value.trim(),
          C: card.querySelector(".opt-c-val").value.trim(),
          D: card.querySelector(".opt-d-val").value.trim()
        },
        answer: card.querySelector(".answer-key-val").value
      });
    });
  }

  fetch('/api/teacher/exams', {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, exam: examPayload })
  })
  .then(res => res.json())
  .then(data => {
    resetExamForm();
    fetchDashboardData();
    alert("Ujian berhasil disimpan!");
  })
  .catch(err => alert("Gagal menyimpan ujian: " + err.message));
});

// ==========================================
// INITIAL SETUP & LOGIN FLOW
// ==========================================

const loginContainer = document.getElementById("login-container");
const dashboardContainer = document.querySelector(".dashboard-container");
const teacherLoginForm = document.getElementById("teacher-login-form");
const loginErrorMsg = document.getElementById("login-error-msg");
const logoutLink = document.querySelector(".logout-link");

let pollingInterval = null;

function checkLoginState() {
  if (sessionStorage.getItem("teacher_logged_in") === "true") {
    loginContainer.classList.add("hidden");
    dashboardContainer.classList.remove("hidden");
    
    // Run initial fetch and start polling
    fetchDashboardData();
    if (!pollingInterval) {
      pollingInterval = setInterval(fetchDashboardData, 2000);
    }
  } else {
    loginContainer.classList.remove("hidden");
    dashboardContainer.classList.add("hidden");
    
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
  }
}

// Handle Admin Form Submission
teacherLoginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const u = document.getElementById("login-username").value.trim();
  const p = document.getElementById("login-password").value.trim();

  fetch('/api/auth/teacher-login', {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: u, password: p })
  })
  .then(res => {
    if (!res.ok) throw new Error("Username atau Password Admin salah!");
    return res.json();
  })
  .then(data => {
    sessionStorage.setItem("teacher_logged_in", "true");
    checkLoginState();
  })
  .catch(err => {
    loginErrorMsg.textContent = err.message;
    loginErrorMsg.classList.remove("hidden");
  });
});

// Clear session storage on logout click
if (logoutLink) {
  logoutLink.addEventListener("click", () => {
    sessionStorage.removeItem("teacher_logged_in");
  });
}

// Run login state check immediately on load
checkLoginState();

// ==========================================
// EXAM RESULTS & HISTORY LOGIC
// ==========================================

function populateResultsExamSelect() {
  if (!resultsExamSelect) return;
  const currentSelectVal = resultsExamSelect.value;
  
  if (!cachedData.exams || cachedData.exams.length === 0) {
    resultsExamSelect.innerHTML = `<option value="">-- Belum Ada Ujian --</option>`;
    selectedResultsExamId = "";
    return;
  }

  resultsExamSelect.innerHTML = cachedData.exams.map(e => {
    const isActive = e.id === cachedData.activeExamId;
    const label = isActive ? `${e.title} (Aktif)` : e.title;
    return `<option value="${e.id}">${label}</option>`;
  }).join("");

  // Restore previous selection if still exists, or default to activeExamId
  if (currentSelectVal && cachedData.exams.some(e => e.id === currentSelectVal)) {
    resultsExamSelect.value = currentSelectVal;
  } else {
    resultsExamSelect.value = cachedData.activeExamId || cachedData.exams[0].id;
  }
  
  selectedResultsExamId = resultsExamSelect.value;
}

function renderResultsTab() {
  if (!resultsTbody) return;

  if (!selectedResultsExamId) {
    resultsTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 30px;">Harap pilih kuis dari dropdown di atas.</td></tr>`;
    return;
  }

  const exam = cachedData.exams.find(e => e.id === selectedResultsExamId);
  if (!exam) return;

  resultExamTitle.textContent = `Hasil Nilai Siswa: ${exam.title}`;

  // Get sessions and violations for the selected exam
  const examSessions = cachedData.sessions[selectedResultsExamId] || {};

  // Update Stats Cards
  let participantCount = 0;
  let finishedCount = 0;
  let violationCountTotal = 0;

  Object.values(examSessions).forEach(session => {
    participantCount++;
    if (session.status === "selesai") finishedCount++;
    violationCountTotal += (session.violationCount || 0);
  });

  resultStatTotal.textContent = participantCount;
  resultStatFinished.textContent = finishedCount;
  resultStatViolations.textContent = violationCountTotal;

  // Render Table
  if (cachedData.students.length === 0) {
    resultsTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 30px;">Belum ada data siswa terdaftar.</td></tr>`;
    return;
  }

  resultsTbody.innerHTML = cachedData.students.map(student => {
    const session = examSessions[student.username];
    let statusHTML = `<span class="status-badge belum_mulai">Belum Mulai</span>`;
    let progress = "0%";
    let violations = `<span class="violation-badge safe">0</span>`;
    let score = "-";

    if (session) {
      statusHTML = `<span class="status-badge ${session.status}">${session.status === 'mengerjakan' ? 'Sedang Mengerjakan' : 'Selesai'}</span>`;
      progress = session.progress || "0%";
      
      const vCount = session.violationCount || 0;
      if (vCount > 0) {
        violations = `<span class="violation-badge">${vCount} Pelanggaran</span>`;
      } else {
        violations = `<span class="violation-badge safe">0</span>`;
      }

      score = session.score || "-";
    }

    return `
      <tr>
        <td><strong>${student.name}</strong></td>
        <td>${student.class}</td>
        <td>${statusHTML}</td>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="background: rgba(255,255,255,0.05); width: 80px; height: 8px; border-radius: 4px; overflow: hidden; border: 1px solid var(--card-border);">
              <div style="background: var(--color-indigo); width: ${progress.includes('%') ? progress : '100%'}; height: 100%;"></div>
            </div>
            <span style="font-size: 0.8rem; font-weight: 500;">${progress}</span>
          </div>
        </td>
        <td>${violations}</td>
        <td><strong style="color: var(--color-emerald);">${score}</strong></td>
      </tr>
    `;
  }).join("");
}

// Dropdown filter listener
if (resultsExamSelect) {
  resultsExamSelect.addEventListener("change", (e) => {
    selectedResultsExamId = e.target.value;
    renderResultsTab();
  });
}

// Reset exam session button
if (btnResultsReset) {
  btnResultsReset.addEventListener("click", () => {
    if (!selectedResultsExamId) return;
    const exam = cachedData.exams.find(e => e.id === selectedResultsExamId);
    if (!exam) return;

    if (confirm(`Apakah Anda yakin ingin MENGHAPUS SEMUA hasil ujian dan catatan pelanggaran untuk kuis "${exam.title}"? Siswa akan bisa mengulang kuis ini.`)) {
      fetch('/api/teacher/exams/reset', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId: selectedResultsExamId })
      })
      .then(res => res.json())
      .then(data => {
        alert("Hasil pengerjaan kuis berhasil dibersihkan!");
        fetchDashboardData();
      })
      .catch(err => alert("Gagal mereset sesi kuis: " + err.message));
    }
  });
}

// Export specific exam to CSV
if (btnResultsCsv) {
  btnResultsCsv.addEventListener("click", () => {
    if (!selectedResultsExamId) return;
    const exam = cachedData.exams.find(e => e.id === selectedResultsExamId);
    if (!exam) return;

    const examSessions = cachedData.sessions[selectedResultsExamId] || {};

    // Headers
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Nama Lengkap,Kelas,Username,Status Ujian,Pelanggaran,Hasil / Skor Akhir\n";

    // Rows
    cachedData.students.forEach(student => {
      const session = examSessions[student.username];
      let statusText = "Belum Mulai";
      let violations = "0";
      let score = "-";

      if (session) {
        statusText = session.status === 'mengerjakan' ? 'Sedang Mengerjakan' : 'Selesai';
        violations = session.violationCount || "0";
        score = session.score || "-";
      }

      csvContent += `"${student.name}","${student.class}","${student.username}","${statusText}","${violations}","${score}"\n`;
    });

    // Download link trigger
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    
    const examTitle = exam.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.setAttribute("download", `rekap_nilai_${examTitle}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
}

// ==========================================
// TEACHER CRUD LOGIC
// ==========================================

function renderTeachersList() {
  if (!teachersTbody) return;
  if (!cachedData.teachers || cachedData.teachers.length === 0) {
    teachersTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 30px;">Belum ada data guru terdaftar.</td></tr>`;
    return;
  }

  teachersTbody.innerHTML = cachedData.teachers.map(teacher => `
    <tr>
      <td><strong>${teacher.name}</strong></td>
      <td><code>${teacher.username}</code></td>
      <td><code>${teacher.password}</code></td>
      <td style="text-align: center;">
        <div class="action-buttons" style="justify-content: center; gap: 5px;">
          <button type="button" class="btn-icon" onclick="openTeacherModal('${teacher.id}')">✏️</button>
          <button type="button" class="btn-sm-danger" onclick="deleteTeacher('${teacher.id}')">🗑️</button>
        </div>
      </td>
    </tr>
  `).join("");
}

window.closeTeacherModal = function() {
  if (teacherModal) {
    teacherModal.classList.add("hidden");
  }
};

window.openTeacherModal = function(id = null) {
  if (!teacherModal) return;
  
  const titleEl = document.getElementById("teacher-modal-title");
  const editIdEl = document.getElementById("edit-teacher-id");
  const nameEl = document.getElementById("teacher-name");
  const usernameEl = document.getElementById("teacher-username");
  const passwordEl = document.getElementById("teacher-password");

  teacherForm.reset();
  editIdEl.value = "";

  if (id) {
    titleEl.textContent = "Edit Data Guru";
    const teacher = cachedData.teachers.find(t => t.id === id);
    if (teacher) {
      editIdEl.value = teacher.id;
      nameEl.value = teacher.name;
      usernameEl.value = teacher.username;
      passwordEl.value = teacher.password;
    }
  } else {
    titleEl.textContent = "Tambah Guru Baru";
  }

  teacherModal.classList.remove("hidden");
};

window.deleteTeacher = function(id) {
  const teacher = cachedData.teachers.find(t => t.id === id);
  if (!teacher) return;

  if (cachedData.teachers.length <= 1) {
    alert("Gagal menghapus: Tidak dapat menghapus guru terakhir di database!");
    return;
  }

  if (confirm(`Apakah Anda yakin ingin menghapus akun guru "${teacher.name}"?`)) {
    fetch('/api/teacher/teachers', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", teacher: { id } })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        fetchDashboardData();
      } else {
        alert(data.message || "Gagal menghapus guru.");
      }
    })
    .catch(err => alert("Gagal menghubungi server: " + err.message));
  }
};

if (btnAddTeacher) {
  btnAddTeacher.addEventListener("click", () => window.openTeacherModal());
}

if (teacherForm) {
  teacherForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = document.getElementById("edit-teacher-id").value;
    const name = document.getElementById("teacher-name").value.trim();
    const username = document.getElementById("teacher-username").value.trim();
    const password = document.getElementById("teacher-password").value.trim();

    const action = id ? "edit" : "add";
    const teacherPayload = { id, name, username, password };

    fetch('/api/teacher/teachers', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, teacher: teacherPayload })
    })
    .then(res => {
      if (!res.ok) {
        return res.json().then(err => { throw new Error(err.message); });
      }
      return res.json();
    })
    .then(data => {
      window.closeTeacherModal();
      fetchDashboardData();
      alert("Data guru berhasil disimpan!");
    })
    .catch(err => alert("Gagal menyimpan data guru: " + err.message));
  });
}

// ── Theme toggle ───────────────────────────────────────────────────────────
const themeToggleBtn = document.getElementById("theme-toggle-btn");
function updateThemeIcon() {
  if (themeToggleBtn) {
    const isLight = document.documentElement.classList.contains("light-mode");
    themeToggleBtn.textContent = isLight ? "🌙" : "☀️";
  }
}
if (themeToggleBtn) {
  themeToggleBtn.addEventListener("click", () => {
    const isLight = document.documentElement.classList.toggle("light-mode");
    localStorage.setItem("theme", isLight ? "light" : "dark");
    updateThemeIcon();
  });
}
updateThemeIcon();

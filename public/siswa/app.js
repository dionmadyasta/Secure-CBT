// App State
let username = "";
let studentName = "";
let studentClass = "";
let examActive = false;
let violationCount = 0;
let timeRemaining = 600; // Loaded from active exam
let timerInterval = null;
let isOverlayActive = false;
let lastBlurTime = 0;
let initialHeight = 0;
let initialWidth = 0;

// Exam Specific State
let activeExam = null;
let displayQuestions = []; // Can be randomized
let currentQuestionIdx = 0;
let studentAnswers = {};
let qrScanner = null;

// DOM Elements
const loginForm = document.getElementById("login-form");
const loginScreen = document.getElementById("login-screen");
const examScreen = document.getElementById("exam-screen");
const finishScreen = document.getElementById("finish-screen");
const questionsContainer = document.getElementById("questions-container");
const displayStudentName = document.getElementById("display-student-name");
const displayStudentClass = document.getElementById("display-student-class");
const connectionStatus = document.getElementById("connection-status");
const violationCountBadge = document.getElementById("violation-count");
const countdownElement = document.getElementById("countdown");
const examForm = document.getElementById("exam-form");
const finalScoreElement = document.getElementById("final-score");
const finalViolationElement = document.getElementById("final-violation");
const cheatOverlay = document.getElementById("cheat-overlay");
const cheatMessage = document.getElementById("cheat-message");
const resumeBtn = document.getElementById("resume-btn");
const examTitleDisplay = document.getElementById("exam-title-display");

// QR & Login Tab Elements
const tabManual = document.getElementById("tab-manual");
const tabQr = document.getElementById("tab-qr");
const qrSection = document.getElementById("qr-section");
const loginError = document.getElementById("login-error");
const backToManual = document.getElementById("back-to-manual");

// Google Form Elements
const googleFormContainer = document.getElementById("google-form-container");
const googleFormIframe = document.getElementById("google-form-iframe");
const submitGformBtn = document.getElementById("submit-gform-btn");

// Navigation Controls
const navigationControls = document.getElementById("navigation-controls");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const questionProgressLabel = document.getElementById("question-progress-label");

// ==========================================
// AUTH & TABS MANAGEMENT
// ==========================================

// Switch Tabs
tabManual.addEventListener("click", () => {
  tabManual.classList.add("active");
  tabQr.classList.remove("active");
  loginForm.classList.remove("hidden");
  qrSection.classList.add("hidden");
  stopQRScanner();
});

tabQr.addEventListener("click", () => {
  tabQr.classList.add("active");
  tabManual.classList.remove("active");
  loginForm.classList.add("hidden");
  qrSection.classList.remove("hidden");
  startQRScanner();
});

backToManual.addEventListener("click", () => {
  tabManual.click();
});

// Start camera scanner
function startQRScanner() {
  loginError.classList.add("hidden");

  // Initialize QR scanner using html5-qrcode
  qrScanner = new Html5QrcodeScanner("qr-reader", {
    fps: 10,
    qrbox: { width: 250, height: 250 },
    aspectRatio: 1.0
  }, /* verbose= */ false);

  qrScanner.render(onScanSuccess, onScanFailure);
}

// Stop camera scanner
function stopQRScanner() {
  if (qrScanner) {
    qrScanner.clear().catch(err => console.warn("Gagal clear QR scanner:", err));
    qrScanner = null;
  }
}

// Successful QR Scan
function onScanSuccess(decodedText) {
  stopQRScanner();

  let u = "";
  let p = "";

  // Try parsing JSON format: {"u":"siswa1","p":"123"}
  try {
    const data = JSON.parse(decodedText);
    u = data.u || data.username || "";
    p = data.p || data.password || "";
  } catch (e) {
    // Try parsing delimiter "username:password"
    if (decodedText.includes(":")) {
      const parts = decodedText.split(":");
      u = parts[0].trim();
      p = parts[1].trim();
    } else {
      u = decodedText.trim();
    }
  }

  if (u && p) {
    executeLogin(u, p);
  } else {
    loginError.textContent = "Format QR Code tidak valid!";
    loginError.classList.remove("hidden");
    tabManual.click();
  }
}

function onScanFailure(error) {
  // Silent fail - scanning is in progress
}

// Login form submit
loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const u = document.getElementById("student-username").value.trim();
  const p = document.getElementById("student-password").value.trim();
  executeLogin(u, p);
});

// Authenticate via Server API
function executeLogin(userVal, passVal) {
  loginError.classList.add("hidden");

  fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: userVal, password: passVal })
  })
    .then(res => {
      if (!res.ok) {
        throw new Error("Username atau Password salah!");
      }
      return res.json();
    })
    .then(data => {
      username = data.student.username;
      studentName = data.student.name;
      studentClass = data.student.class;

      // Proceed to load the active exam
      loadActiveExam();
    })
    .catch(err => {
      loginError.textContent = err.message || "Gagal masuk. Silakan coba lagi.";
      loginError.classList.remove("hidden");
    });
}

// ==========================================
// EXAM OPERATIONS
// ==========================================

// Load the currently active exam details from backend
function loadActiveExam() {
  fetch('/api/exam/active')
    .then(res => {
      if (!res.ok) throw new Error("Gagal mengambil kuis aktif dari server.");
      return res.json();
    })
    .then(data => {
      activeExam = data.exam;
      timeRemaining = activeExam.duration || 600;

      // Start Exam Setup
      startExam();
    })
    .catch(err => {
      alert("Maaf, tidak ada ujian aktif atau " + err.message);
      window.location.reload();
    });
}

// Helper to send logs/progress to backend
function sendHTTPMessage(endpoint, payload = {}) {
  fetch(`/api/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      studentName,
      studentClass,
      ...payload
    })
  }).catch(err => console.error(`Gagal kirim ke /api/${endpoint}:`, err));
}

// Start Ujian
function startExam() {
  displayStudentName.textContent = studentName;
  displayStudentClass.textContent = studentClass;
  examTitleDisplay.textContent = activeExam.title;

  connectionStatus.textContent = "Aktif";
  connectionStatus.className = "status-indicator online";

  // Register session on backend
  sendHTTPMessage("exam/join");

  // Record initial window size
  initialHeight = window.innerHeight;
  initialWidth = window.innerWidth;

  // Transition UI
  loginScreen.classList.remove("active-section");
  loginScreen.classList.add("hidden-section");
  examScreen.classList.remove("hidden-section");
  examScreen.classList.add("active-section");

  examActive = true;
  startTimer();

  // Setup Exam View
  if (activeExam.type === "google-form") {
    // Show Google Form embed iframe
    googleFormIframe.src = activeExam.googleFormUrl;
    googleFormContainer.classList.remove("hidden");
    examForm.classList.add("hidden");

    // Sync progress periodically for Google Form
    sendHTTPMessage("exam/progress", { answers: {}, progress: "Mengerjakan Google Form" });
  } else {
    // Native Quiz Setup
    googleFormContainer.classList.add("hidden");
    examForm.classList.remove("hidden");

    displayQuestions = [...activeExam.questions];
    if (activeExam.randomize) {
      const storageKey = `exam_order_${activeExam.id}_${username}`;
      const storedOrder = sessionStorage.getItem(storageKey);
      if (storedOrder) {
        try {
          const orderedIds = JSON.parse(storedOrder);
          const questionMap = new Map(displayQuestions.map(q => [q.id, q]));
          displayQuestions = orderedIds
            .map(id => questionMap.get(id))
            .filter(q => q !== undefined);

          // Append any newly added questions that aren't in the stored order
          const orderedSet = new Set(orderedIds);
          for (const q of activeExam.questions) {
            if (!orderedSet.has(q.id)) {
              displayQuestions.push(q);
            }
          }
        } catch (err) {
          shuffleQuestions();
        }
      } else {
        shuffleQuestions();
      }
    }

    function shuffleQuestions() {
      for (let i = displayQuestions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [displayQuestions[i], displayQuestions[j]] = [displayQuestions[j], displayQuestions[i]];
      }
      const storageKey = `exam_order_${activeExam.id}_${username}`;
      sessionStorage.setItem(storageKey, JSON.stringify(displayQuestions.map(q => q.id)));
    }

    currentQuestionIdx = 0;
    studentAnswers = {};

    renderQuestions();
  }

  // Request Fullscreen
  requestFullscreenMode();
}

function requestFullscreenMode() {
  const elem = document.documentElement;
  if (elem.requestFullscreen) {
    elem.requestFullscreen().catch(() => { });
  } else if (elem.webkitRequestFullscreen) {
    elem.webkitRequestFullscreen().catch(() => { });
  }
}

// Start Timer
function startTimer() {
  timerInterval = setInterval(() => {
    if (timeRemaining <= 0) {
      clearInterval(timerInterval);
      submitExam(true); // Auto-submit when time is up
    } else {
      timeRemaining--;
      const minutes = Math.floor(timeRemaining / 60);
      const seconds = timeRemaining % 60;
      countdownElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
  }, 1000);
}

// Render Questions
function renderQuestions() {
  const submitBtn = document.getElementById("submit-btn");
  if (activeExam.showOneByOne) {
    navigationControls.classList.remove("hidden");
    if (submitBtn) submitBtn.classList.add("hidden");
    renderSingleQuestion(currentQuestionIdx);
  } else {
    navigationControls.classList.add("hidden");
    if (submitBtn) submitBtn.classList.remove("hidden");
    renderAllQuestions();
  }
}

// Render Single Question (one-by-one mode)
function renderSingleQuestion(index) {
  const q = displayQuestions[index];
  const answered = studentAnswers[q.id] || "";

  questionsContainer.innerHTML = `
    <div class="question-item active-item" data-id="${q.id}">
      <p class="question-text">${index + 1}. ${q.question}</p>
      <div class="options-list">
        ${Object.entries(q.options).map(([key, val]) => `
          <label class="option-label ${answered === key ? 'selected' : ''}">
            <input type="radio" name="question-${q.id}" value="${key}" ${answered === key ? 'checked' : ''} onchange="saveAnswer(${q.id}, '${key}')">
            <span class="option-indicator">${key}</span>
            <span>${val}</span>
          </label>
        `).join("")}
      </div>
    </div>
  `;

  // Update navigation buttons status
  prevBtn.disabled = index === 0;
  if (index === displayQuestions.length - 1) {
    nextBtn.textContent = "Selesai ➡";
  } else {
    nextBtn.textContent = answered ? "Berikutnya ➡" : "Lewati ➡";
  }
  questionProgressLabel.textContent = `Soal ${index + 1} dari ${displayQuestions.length}`;
}

// Render All Questions at once
function renderAllQuestions() {
  questionsContainer.innerHTML = displayQuestions.map((q, idx) => {
    const answered = studentAnswers[q.id] || "";
    return `
      <div class="question-item" data-id="${q.id}">
        <p class="question-text">${idx + 1}. ${q.question}</p>
        <div class="options-list">
          ${Object.entries(q.options).map(([key, val]) => `
            <label class="option-label ${answered === key ? 'selected' : ''}">
              <input type="radio" name="question-${q.id}" value="${key}" ${answered === key ? 'checked' : ''} onchange="saveAnswer(${q.id}, '${key}')">
              <span class="option-indicator">${key}</span>
              <span>${val}</span>
            </label>
          `).join("")}
        </div>
      </div>
    `;
  }).join("");
}

// Save answer, update UI classes and sync with server
window.saveAnswer = function (questionId, option) {
  studentAnswers[questionId] = option;

  // Highlight selection in single view
  if (activeExam.showOneByOne) {
    const labels = document.querySelectorAll('.option-label');
    labels.forEach(l => {
      const radio = l.querySelector('input');
      if (radio.checked) {
        l.classList.add('selected');
      } else {
        l.classList.remove('selected');
      }
    });

    // Dynamically change nextBtn text to "Berikutnya" if not the last question
    if (currentQuestionIdx < displayQuestions.length - 1) {
      nextBtn.textContent = "Berikutnya ➡";
    }
  } else {
    const qItem = document.querySelector(`.question-item[data-id="${questionId}"]`);
    if (qItem) {
      qItem.querySelectorAll('.option-label').forEach(l => {
        const radio = l.querySelector('input');
        if (radio.checked) {
          l.classList.add('selected');
        } else {
          l.classList.remove('selected');
        }
      });
    }
  }

  // Calculate answering progress
  const answeredCount = Object.keys(studentAnswers).length;
  const progressText = `${answeredCount} / ${displayQuestions.length} Soal`;

  // Sync answer progress to teacher server
  sendHTTPMessage("exam/progress", {
    answers: studentAnswers,
    progress: progressText
  });
};

// Next Button Handler (One by One mode)
nextBtn.addEventListener("click", () => {
  const q = displayQuestions[currentQuestionIdx];
  const answered = studentAnswers[q.id] || "";

  if (!answered && currentQuestionIdx < displayQuestions.length - 1) {
    // Send log to server about skipped question
    sendHTTPMessage("exam/log-skip", {
      studentName,
      studentClass,
      questionId: q.id,
      questionText: q.question
    });

    // Move the current question to the end
    displayQuestions.splice(currentQuestionIdx, 1);
    displayQuestions.push(q);

    // Re-render
    renderSingleQuestion(currentQuestionIdx);
  } else {
    if (currentQuestionIdx < displayQuestions.length - 1) {
      currentQuestionIdx++;
      renderSingleQuestion(currentQuestionIdx);
    } else {
      // If on the last question, trigger form submission
      examForm.requestSubmit();
    }
  }
});

// Previous Button Handler (One by One mode)
prevBtn.addEventListener("click", () => {
  if (currentQuestionIdx > 0) {
    currentQuestionIdx--;
    renderSingleQuestion(currentQuestionIdx);
  }
});

// Submit Google Form Exam
submitGformBtn.addEventListener("click", () => {
  if (confirm("Apakah Anda yakin sudah selesai mengerjakan di Google Form dan ingin mengumpulkan?")) {
    submitExam();
  }
});

// Submit Native Exam Form
examForm.addEventListener("submit", (e) => {
  e.preventDefault();

  // If one-by-one, double check if all answered
  if (activeExam.showOneByOne) {
    const answeredCount = Object.keys(studentAnswers).length;
    if (answeredCount < displayQuestions.length) {
      if (!confirm(`Anda baru menjawab ${answeredCount} dari ${displayQuestions.length} soal. Yakin ingin mengumpulkan?`)) {
        return;
      }
    }
  }

  if (confirm("Apakah Anda yakin ingin mengumpulkan jawaban ujian sekarang?")) {
    submitExam();
  }
});

// Submit Ujian
function submitExam(isAuto = false) {
  if (!examActive) return;
  examActive = false;
  clearInterval(timerInterval);

  if (isAuto) {
    alert("Waktu ujian telah habis! Jawaban Anda akan otomatis dikirim.");
  }

  // Report final submit
  fetch('/api/exam/submit', {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      studentName,
      studentClass,
      answers: studentAnswers
    })
  })
    .then(res => res.json())
    .then(data => {
      // Transition to Finish Screen
      examScreen.classList.remove("active-section");
      examScreen.classList.add("hidden-section");
      finishScreen.classList.remove("hidden-section");
      finishScreen.classList.add("active-section");

      if (data.type === "native") {
        finalScoreElement.textContent = `${data.score} / ${data.total}`;
      } else {
        finalScoreElement.textContent = "Terbuka (Google Form)";
      }

      finalViolationElement.textContent = `Total Pelanggaran: ${violationCount} kali`;

      exitFullscreenMode();
    })
    .catch(err => {
      console.error("Gagal mengumpulkan ujian:", err);
      alert("Gagal menghubungi server untuk mengumpulkan ujian. Menghubungkan ulang...");
    });
}

function exitFullscreenMode() {
  if (document.exitFullscreen) {
    document.exitFullscreen().catch(() => { });
  } else if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen().catch(() => { });
  }
}

// ==========================================
// ANTI-CHEAT DETECTION LISTENERS
// ==========================================

function triggerViolation(detail) {
  if (!examActive) return;

  violationCount++;
  violationCountBadge.textContent = `${violationCount} Pelanggaran`;

  // Send violation alert to server
  sendHTTPMessage("exam/violation", { detail });

  // Show alert popup
  cheatMessage.textContent = `Anda terdeteksi: ${detail}. Pelanggaran ke-${violationCount}. Info kecurangan dikirim ke server Guru secara real-time.`;
  cheatOverlay.classList.remove("hidden");
  isOverlayActive = true;
}

// 1. Block Copy, Paste, Cut & Right-Click (Context Menu)
['copy', 'cut', 'paste', 'contextmenu'].forEach(event => {
  document.addEventListener(event, (e) => {
    e.preventDefault();
    if (examActive) {
      triggerViolation(`Mencoba menyalin/menempel/klik-kanan teks (${event.toUpperCase()})`);
    }
  });
});

// 2. Visibility API (Detect Tab Switch / Minimizing)
document.addEventListener("visibilitychange", () => {
  if (!examActive) return;
  if (document.hidden) {
    triggerViolation("Meninggalkan tab ujian / Mengecilkan Browser (Tab Switched/Minimized)");
  }
});

// 3. Window Blur (Detect application switching, screenshot tools, etc.)
window.addEventListener("blur", () => {
  if (!examActive) return;
  const now = Date.now();
  if (now - lastBlurTime > 1500) {
    lastBlurTime = now;
    if (!document.hidden) {
      triggerViolation("Kehilangan fokus layar (Kemungkinan Screenshot / Split Screen / Notifikasi HP)");
    }
  }
});

// 4. Keyboard Shortcuts Interception (Block F12, PrintScreen, developer tools shortcuts)
document.addEventListener("keydown", (e) => {
  if (!examActive) return;

  if (e.key === "F12") {
    e.preventDefault();
    triggerViolation("Mencoba membuka Developer Tools (F12)");
  }

  if (e.key === "PrintScreen" || e.keyCode === 44) {
    e.preventDefault();
    triggerViolation("Mencoba mengambil Screenshot (PrintScreen)");
  }

  // Ctrl+Shift+I / J / C
  if (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "C" || e.key === "J" || e.key === "i" || e.key === "c" || e.key === "j")) {
    e.preventDefault();
    triggerViolation("Mencoba membuka Developer Tools (Shortcut Keyboard)");
  }

  // Mac Cmd+Opt+I / J
  if (e.metaKey && e.altKey && (e.key === "I" || e.key === "J" || e.key === "i" || e.key === "j")) {
    e.preventDefault();
    triggerViolation("Mencoba membuka Developer Tools (Mac Shortcut)");
  }
});

// 5. Fullscreen Exit Detection
function checkFullscreenExit() {
  if (!examActive) return;

  const isFullscreen = document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.msFullscreenElement;

  if (!isFullscreen && !isOverlayActive) {
    triggerViolation("Keluar dari mode Fullscreen Ujian");
  }
}

document.addEventListener("fullscreenchange", checkFullscreenExit);
document.addEventListener("webkitfullscreenchange", checkFullscreenExit);

// 6. Split Screen Resize Detection
window.addEventListener("resize", () => {
  if (!examActive) return;

  const heightChangeRatio = (initialHeight - window.innerHeight) / initialHeight;
  const widthChangeRatio = (initialWidth - window.innerWidth) / initialWidth;

  if (heightChangeRatio > 0.20 || widthChangeRatio > 0.20) {
    triggerViolation("Dimensi layar menyusut secara tidak wajar (Kemungkinan Split-Screen / Ubah Ukuran Jendela)");
    initialHeight = window.innerHeight;
    initialWidth = window.innerWidth;
  }
});

// Dismiss warning overlay
resumeBtn.addEventListener("click", () => {
  cheatOverlay.classList.add("hidden");
  isOverlayActive = false;
  requestFullscreenMode();

  // Reset window sizes baseline
  initialHeight = window.innerHeight;
  initialWidth = window.innerWidth;
});

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

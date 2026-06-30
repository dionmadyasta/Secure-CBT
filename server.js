const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

// Parse JSON request bodies
app.use(express.json());

// Serve static assets from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Database File Path Configurations (Local fallback files)
const DB_DIR = path.join(__dirname, 'data');
const ADMIN_FILE = path.join(DB_DIR, 'data_guru.json');
const STUDENTS_FILE = path.join(DB_DIR, 'data_siswa.json');
const EXAMS_FILE = path.join(DB_DIR, 'soal.json');   // index: activeExamId + exam metadata
const SOAL_DIR = path.join(DB_DIR, 'soal');           // per-exam question files
const SESSIONS_FILE = path.join(DB_DIR, 'session.json');

// Helper: convert exam title to safe filename slug
function slugify(title) {
  return title
    .toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '_')  // non-alphanumeric -> underscore
    .replace(/^_+|_+$/g, '')       // trim underscores
    .substring(0, 80) || 'ujian';  // max length safety
}

// Helper: get per-exam question file path from exam object
function examQuestionsFile(exam) {
  const slug = slugify(exam.title || exam.id);
  return path.join(SOAL_DIR, `soal_${slug}_${exam.id}.json`);
}

// Default fallback (empty) — actual data is read from JSON files in data/
const defaultTeachers = [];
const defaultStudents = [];
const defaultExams = [];

// In-memory unified state structure
let db = {
  teachers: defaultTeachers,
  students: defaultStudents,
  exams: defaultExams,
  activeExamId: "exam-1",
  sessions: {}, // Nested structure: { [examId]: { [username]: { ... } } }
  violations: {} // Nested structure: { [examId]: [ { ... } ] }
};

// ==========================================
// HYBRID DATABASE CONNECTOR (Vercel KV vs Split Files JSON)
// ==========================================

// Get database state
async function getDB() {
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  // If Vercel KV or Upstash environment variables are configured, fetch from Redis
  if (kvUrl && kvToken) {
    try {
      const { createClient } = require('@vercel/kv');
      const kv = createClient({
        url: kvUrl,
        token: kvToken,
      });
      const data = await kv.get('secure_cbt_db');
      if (data) {
        return migrateDatabaseFormat({ ...db, ...data });
      }
    } catch (err) {
      console.error("[DB KV] Gagal mengambil data dari Vercel KV:", err.message);
    }
  }

  // Local fallback: read separated files
  try {
    let teachers = defaultTeachers;
    let students = defaultStudents;
    let exams = defaultExams;
    let activeExamId = "exam-1";
    let sessions = {};
    let violations = {};

    if (fs.existsSync(ADMIN_FILE)) {
      teachers = JSON.parse(fs.readFileSync(ADMIN_FILE, 'utf8'));
    }
    if (fs.existsSync(STUDENTS_FILE)) {
      students = JSON.parse(fs.readFileSync(STUDENTS_FILE, 'utf8'));
    }
    if (fs.existsSync(EXAMS_FILE)) {
      const examsData = JSON.parse(fs.readFileSync(EXAMS_FILE, 'utf8'));
      activeExamId = examsData.activeExamId || "exam-1";
      const examsMeta = examsData.exams || defaultExams;

      // Load per-exam question files
      exams = examsMeta.map(exam => {
        const qFile = examQuestionsFile(exam);
        let questions = exam.questions || [];
        if (fs.existsSync(qFile)) {
          try {
            questions = JSON.parse(fs.readFileSync(qFile, 'utf8'));
          } catch (e) {
            console.warn(`[DB] Gagal baca soal file: ${qFile}`, e.message);
          }
        }
        return { ...exam, questions };
      });
    }
    if (fs.existsSync(SESSIONS_FILE)) {
      const sessionsData = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
      sessions = sessionsData.sessions || {};
      violations = sessionsData.violations || {};
    }

    return migrateDatabaseFormat({ teachers, students, exams, activeExamId, sessions, violations });
  } catch (err) {
    console.error("[DB Files] Gagal membaca file-file database, menggunakan in-memory:", err.message);
  }

  return db;
}

// Database Migrator for backward compatibility
function migrateDatabaseFormat(loadedDb) {
  const examIds = loadedDb.exams.map(e => e.id);
  const activeId = loadedDb.activeExamId || "exam-1";

  // 1. Handle teacher login data array migration
  let teachers = loadedDb.teachers || loadedDb.admin || defaultTeachers;
  if (!Array.isArray(teachers)) {
    console.log("[DB Migration] Mendeteksi format data login guru lama (objek tunggal). Mengubah ke array...");
    teachers = [
      {
        id: "g-1",
        name: "Admin Utama",
        username: teachers.username || "admin",
        password: teachers.password || "gurugpa123"
      }
    ];
  }
  loadedDb.teachers = teachers;
  delete loadedDb.admin; // Remove deprecated field

  // 2. Migrate students class structures into grade & subClass
  let students = loadedDb.students || defaultStudents;
  students.forEach(s => {
    if (!s.grade || !s.subClass) {
      const cls = s.class || "VII-A";
      const parts = cls.split('-');
      s.grade = parts[0] ? parts[0].trim() : "VII";
      s.subClass = parts[1] ? parts[1].trim() : "A";
      s.class = `${s.grade}-${s.subClass}`;
    }
  });
  loadedDb.students = students;

  // 3. Handle migrations for "sessions" if it's in the old flat structure
  let sessions = loadedDb.sessions || {};
  let isSessionsFlat = false;
  const sessionKeys = Object.keys(sessions);
  if (sessionKeys.length > 0 && !sessionKeys.some(k => examIds.includes(k))) {
    isSessionsFlat = true;
  }

  if (isSessionsFlat) {
    console.log("[DB Migration] Mendeteksi format pengerjaan siswa (sessions) lama. Memindahkan ke ID Ujian: " + activeId);
    const migratedSessions = {};
    migratedSessions[activeId] = sessions;
    loadedDb.sessions = migratedSessions;
  }

  // 4. Handle migrations for "violations" if it's in the old flat array structure
  let violations = loadedDb.violations || {};
  if (Array.isArray(violations)) {
    console.log("[DB Migration] Mendeteksi format log pelanggaran (violations) lama. Memindahkan ke ID Ujian: " + activeId);
    const migratedViolations = {};
    migratedViolations[activeId] = violations;
    loadedDb.violations = migratedViolations;
  }

  // 5. Ensure all current exams exist as sub-keys in database
  examIds.forEach(id => {
    if (!loadedDb.sessions[id]) loadedDb.sessions[id] = {};
    if (!loadedDb.violations[id]) loadedDb.violations[id] = [];
  });

  // 6. Migrate exam objects - add missing new fields with defaults
  loadedDb.exams = loadedDb.exams.map(e => ({
    isEnabled: true,
    autoActivateAt: "",
    allowedStudents: "all",
    ...e
  }));

  return loadedDb;
}

// Save database state
async function saveDB(currentDb) {
  // Update local memory cache
  db = currentDb;

  // Ensure all student objects have the qrCode text token field populated
  currentDb.students.forEach(s => {
    if (!s.qrCode) {
      s.qrCode = `${s.username}:${s.password}`;
    }
  });

  // If Vercel KV or Upstash env vars are configured, save to Redis
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (kvUrl && kvToken) {
    try {
      const { createClient } = require('@vercel/kv');
      const kv = createClient({
        url: kvUrl,
        token: kvToken,
      });
      await kv.set('secure_cbt_db', currentDb);
      return;
    } catch (err) {
      console.error("[DB KV] Gagal menulis ke Vercel KV:", err.message);
    }
  }

  // Local fallback: write to separated files
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    // Ensure per-exam soal directory exists
    if (!fs.existsSync(SOAL_DIR)) {
      fs.mkdirSync(SOAL_DIR, { recursive: true });
    }

    // 1. Write teachers data
    fs.writeFileSync(ADMIN_FILE, JSON.stringify(currentDb.teachers, null, 2), 'utf8');

    // 2. Write students data
    fs.writeFileSync(STUDENTS_FILE, JSON.stringify(currentDb.students, null, 2), 'utf8');

    // 3. Write exam index (metadata without questions) and per-exam question files
    const examsIndex = currentDb.exams.map(exam => {
      // Write questions to its own file named by slug
      const qFile = examQuestionsFile(exam);
      fs.writeFileSync(qFile, JSON.stringify(exam.questions || [], null, 2), 'utf8');

      // Return exam metadata without questions (stored in index)
      const { questions, ...examMeta } = exam;
      return examMeta;
    });

    fs.writeFileSync(EXAMS_FILE, JSON.stringify({
      activeExamId: currentDb.activeExamId,
      exams: examsIndex
    }, null, 2), 'utf8');

    // 4. Write active sessions and violations logs
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify({
      sessions: currentDb.sessions,
      violations: currentDb.violations
    }, null, 2), 'utf8');

  } catch (err) {
    console.warn("[DB Files] Gagal menulis file-file database:", err.message);
  }
}

// Pre-initialize DB on startup
getDB().then(initialDb => {
  saveDB(initialDb).then(() => {
    console.log("[DB] Inisialisasi awal database berhasil.");
  });
});

// ==========================================
// STUDENT ENDPOINTS
// ==========================================

// Student Login (Manual & QR Token)
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: "Username dan password wajib diisi." });
  }

  const currentDb = await getDB();
  const student = currentDb.students.find(s => s.username.toLowerCase() === username.toLowerCase() && s.password === password);

  if (!student) {
    return res.status(401).json({ success: false, message: "Username atau Password salah!" });
  }

  // --- Check if student is locked ---
  const activeIdForLogin = currentDb.activeExamId;
  if (currentDb.sessions[activeIdForLogin]?.[student.username]?.isLocked) {
    return res.status(403).json({ success: false, message: "Akun Anda dikunci oleh guru/pengawas karena terdeteksi melakukan pelanggaran." });
  }

  // --- Check allowed students for the active exam ---
  const activeExamForAuth = currentDb.exams.find(e => e.id === currentDb.activeExamId);
  if (activeExamForAuth) {
    const allowed = activeExamForAuth.allowedStudents;
    if (allowed !== "all") {
      if (Array.isArray(allowed)) {
        // Manual list of usernames
        const inList = allowed.some(u => u.toLowerCase() === student.username.toLowerCase());
        if (!inList) {
          return res.status(403).json({ success: false, message: "Anda tidak terdaftar sebagai peserta ujian ini." });
        }
      } else if (typeof allowed === 'string' && allowed.startsWith('[')) {
        // Stored as JSON string array (fallback)
        try {
          const parsedAllowed = JSON.parse(allowed);
          const inList = parsedAllowed.some(u => u.toLowerCase() === student.username.toLowerCase());
          if (!inList) {
            return res.status(403).json({ success: false, message: "Anda tidak terdaftar sebagai peserta ujian ini." });
          }
        } catch (_) { }
      } else if (typeof allowed === 'string' && allowed !== 'all') {
        // String of comma-separated classes e.g. "VII-A,VII-B"
        const classList = allowed.split(',').map(c => c.trim().toUpperCase());
        if (!classList.includes(student.class.toUpperCase())) {
          return res.status(403).json({ success: false, message: `Ujian ini hanya untuk kelas: ${classList.join(', ')}.` });
        }
      }
    }
  }

  console.log(`\x1b[32m[AUTH] Siswa "${student.name}" (${student.class}) berhasil login.\x1b[0m`);
  return res.json({
    success: true,
    student: {
      username: student.username,
      name: student.name,
      class: student.class
    }
  });
});

// Helper: Get current time in WIB (UTC+7) as ISO string
function nowWIB() {
  return new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
}

// Fetch active exam metadata for student (with auto-activate WIB check)
app.get('/api/exam/active', async (req, res) => {
  const currentDb = await getDB();
  let needsSave = false;

  // --- Auto-activate: Check all exams with autoActivateAt that hasn't triggered yet ---
  const nowMs = Date.now();
  currentDb.exams.forEach(exam => {
    if (exam.autoActivateAt && !exam.isEnabled) {
      const activateMs = new Date(exam.autoActivateAt).getTime();
      if (!isNaN(activateMs) && nowMs >= activateMs) {
        console.log(`\x1b[35m[AUTO-AKTIF] Ujian "${exam.title}" otomatis diaktifkan berdasarkan jadwal WIB: ${exam.autoActivateAt}\x1b[0m`);
        // Disable previous active exam
        currentDb.exams.forEach(e => { if (e.isEnabled) e.isEnabled = false; });
        exam.isEnabled = true;
        exam.autoActivateAt = ""; // Clear so it doesn't re-trigger
        currentDb.activeExamId = exam.id;
        if (!currentDb.sessions[exam.id]) currentDb.sessions[exam.id] = {};
        if (!currentDb.violations[exam.id]) currentDb.violations[exam.id] = [];
        needsSave = true;
      }
    }
  });

  if (needsSave) await saveDB(currentDb);

  const activeExam = currentDb.exams.find(e => e.id === currentDb.activeExamId);
  if (!activeExam || !activeExam.isEnabled) {
    return res.status(404).json({ success: false, message: "Tidak ada ujian aktif saat ini. Silakan tunggu instruksi guru." });
  }

  return res.json({
    success: true,
    exam: {
      id: activeExam.id,
      title: activeExam.title,
      type: activeExam.type,
      googleFormUrl: activeExam.googleFormUrl,
      randomize: activeExam.randomize,
      showOneByOne: activeExam.showOneByOne,
      duration: activeExam.duration,
      questions: activeExam.questions.map(q => ({
        id: q.id,
        question: q.question,
        options: q.options
      }))
    }
  });
});

// Student Joins the Exam
app.post('/api/exam/join', async (req, res) => {
  const { studentName, studentClass, username } = req.body;
  if (!username) return res.status(400).json({ success: false, message: "Username siswa wajib disertakan." });

  const currentDb = await getDB();
  const activeId = currentDb.activeExamId;

  if (!currentDb.sessions[activeId]) {
    currentDb.sessions[activeId] = {};
  }

  currentDb.sessions[activeId][username] = {
    name: studentName,
    class: studentClass,
    status: "mengerjakan",
    startedAt: new Date().toISOString(),
    progress: "0%",
    violationCount: 0,
    answers: {},
    score: null,
    correct: null,
    incorrect: null
  };

  await saveDB(currentDb);
  console.log(`\x1b[32m[LOG - MASUK] Siswa "${studentName}" (${studentClass}) mulai mengerjakan ujian aktif "${activeId}".\x1b[0m`);
  res.json({ success: true });
});

// Sync answers progress
app.post('/api/exam/progress', async (req, res) => {
  const { username, answers, progress } = req.body;
  if (!username) return res.status(400).json({ success: false, message: "Username siswa wajib disertakan." });

  const currentDb = await getDB();
  const activeId = currentDb.activeExamId;
  const examSessions = currentDb.sessions[activeId] || {};

  if (examSessions[username] && examSessions[username].isLocked) {
    return res.status(403).json({ success: false, message: "Akun Anda dikunci oleh guru/pengawas!" });
  }

  if (examSessions[username] && examSessions[username].status === "mengerjakan") {
    examSessions[username].answers = answers || {};
    examSessions[username].progress = progress || "0%";
    await saveDB(currentDb);
  }
  res.json({ success: true });
});

// Log cheating violation
app.post('/api/exam/violation', async (req, res) => {
  const { studentName, studentClass, username, detail } = req.body;
  if (!username) return res.status(400).json({ success: false, message: "Username siswa wajib disertakan." });

  const time = new Date().toLocaleTimeString('id-ID');
  const currentDb = await getDB();
  const activeId = currentDb.activeExamId;

  const examSessions = currentDb.sessions[activeId] || {};

  if (examSessions[username] && examSessions[username].isLocked) {
    return res.status(403).json({ success: false, message: "Akun Anda dikunci oleh guru/pengawas!" });
  }

  if (!currentDb.violations[activeId]) {
    currentDb.violations[activeId] = [];
  }

  if (examSessions[username]) {
    examSessions[username].violationCount = (examSessions[username].violationCount || 0) + 1;
  }

  currentDb.violations[activeId].unshift({
    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
    username,
    name: studentName,
    class: studentClass,
    detail,
    time
  });

  await saveDB(currentDb);
  console.log(`\x1b[31m[ALERT - KECURANGAN] Siswa "${studentName}" (${studentClass}) terdeteksi: "${detail}" pada ujian "${activeId}" pukul ${time}\x1b[0m`);
  res.json({ success: true });
});

// Log skip question event
app.post('/api/exam/log-skip', async (req, res) => {
  const { username, studentName, studentClass, questionId, questionText } = req.body;
  if (!username) return res.status(400).json({ success: false, message: "Username siswa wajib disertakan." });

  const time = new Date().toLocaleTimeString('id-ID');
  const currentDb = await getDB();
  const activeId = currentDb.activeExamId;

  if (!currentDb.violations[activeId]) {
    currentDb.violations[activeId] = [];
  }

  currentDb.violations[activeId].unshift({
    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
    username,
    name: studentName,
    class: studentClass,
    detail: `Melewati Soal: "${questionText}"`,
    type: 'skip',
    time
  });

  await saveDB(currentDb);
  console.log(`[LOG - LEWATI] Siswa "${studentName}" (${studentClass}) melewati soal: "${questionText}" pada pukul ${time}`);
  res.json({ success: true });
});

// Final submit exam
app.post('/api/exam/submit', async (req, res) => {
  const { studentName, studentClass, username, answers } = req.body;
  if (!username) return res.status(400).json({ success: false, message: "Username siswa wajib disertakan." });

  const currentDb = await getDB();
  const activeId = currentDb.activeExamId;
  const examSessions = currentDb.sessions[activeId] || {};

  if (examSessions[username] && examSessions[username].isLocked) {
    return res.status(403).json({ success: false, message: "Akun Anda dikunci oleh guru/pengawas!" });
  }

  const activeExam = currentDb.exams.find(e => e.id === activeId);
  if (!activeExam) return res.status(404).json({ success: false, message: "Ujian aktif tidak ditemukan." });

  let score = 0;
  let correct = 0;
  let incorrect = 0;

  if (activeExam.type === "native") {
    activeExam.questions.forEach(q => {
      const studentAnswer = answers[q.id];
      if (studentAnswer === q.answer) {
        correct++;
        score++;
      } else {
        incorrect++;
      }
    });
  }
  if (examSessions[username]) {
    examSessions[username].status = "selesai";
    examSessions[username].progress = "100%";
    examSessions[username].answers = answers || {};
    if (activeExam.type === "native") {
      examSessions[username].score = `${score} / ${activeExam.questions.length}`;
      examSessions[username].correct = correct;
      examSessions[username].incorrect = incorrect;
    } else {
      examSessions[username].score = "Terbuka (Google Form)";
      examSessions[username].correct = "-";
      examSessions[username].incorrect = "-";
    }
  }

  await saveDB(currentDb);
  console.log(`\x1b[34m[LOG - SELESAI] Siswa "${studentName}" (${studentClass}) selesai mengumpulkan ujian "${activeId}". Skor: ${score}/${activeExam.questions.length}\x1b[0m`);
  res.json({
    success: true,
    score: score,
    total: activeExam.questions.length,
    type: activeExam.type
  });
});

// ==========================================
// TEACHER ENDPOINTS
// ==========================================

// Teacher / Admin Login Auth
app.post('/api/auth/teacher-login', async (req, res) => {
  const { username, password } = req.body;
  const currentDb = await getDB();

  const teacher = currentDb.teachers.find(t => t.username.toLowerCase() === username.toLowerCase() && t.password === password);

  if (teacher) {
    console.log(`\x1b[35m[AUTH - GURU] Admin/Guru "${teacher.name}" (${teacher.username}) berhasil login ke Dashboard.\x1b[0m`);
    return res.json({ success: true, teacherName: teacher.name });
  }

  return res.status(401).json({ success: false, message: "Username atau Password Admin salah!" });
});

// Get Dashboard Data (Monitoring feed, exam config, students, teachers, sessions)
app.get('/api/teacher/dashboard', async (req, res) => {
  const currentDb = await getDB();
  res.json({
    success: true,
    activeExamId: currentDb.activeExamId,
    exams: currentDb.exams,
    students: currentDb.students,
    teachers: currentDb.teachers,
    sessions: currentDb.sessions,
    violations: currentDb.violations
  });
});

// Reset Exam sessions and violations
app.post('/api/teacher/exams/reset', async (req, res) => {
  const { examId } = req.body;
  if (!examId) return res.status(400).json({ success: false, message: "Exam ID wajib disertakan." });

  const currentDb = await getDB();
  currentDb.sessions[examId] = {};
  currentDb.violations[examId] = [];

  await saveDB(currentDb);
  console.log(`\x1b[35m[EXAM] Sesi & log monitoring kuis "${examId}" di-reset oleh guru.\x1b[0m`);
  res.json({ success: true });
});

// CRUD Teacher management
app.post('/api/teacher/teachers', async (req, res) => {
  const { action, teacher } = req.body;
  const currentDb = await getDB();

  if (action === 'add') {
    const exists = currentDb.teachers.some(t => t.username.toLowerCase() === teacher.username.toLowerCase());
    if (exists) {
      return res.status(400).json({ success: false, message: "Username guru sudah terdaftar!" });
    }
    const newTeacher = {
      id: "g-" + Date.now().toString(),
      name: teacher.name,
      username: teacher.username,
      password: teacher.password
    };
    currentDb.teachers.push(newTeacher);
  }
  else if (action === 'edit') {
    const idx = currentDb.teachers.findIndex(t => t.id === teacher.id);
    if (idx === -1) return res.status(404).json({ success: false, message: "Guru tidak ditemukan." });

    const exists = currentDb.teachers.some(t => t.id !== teacher.id && t.username.toLowerCase() === teacher.username.toLowerCase());
    if (exists) return res.status(400).json({ success: false, message: "Username guru sudah terdaftar!" });

    currentDb.teachers[idx] = {
      ...currentDb.teachers[idx],
      name: teacher.name,
      username: teacher.username,
      password: teacher.password
    };
  }
  else if (action === 'delete') {
    if (currentDb.teachers.length <= 1) {
      return res.status(400).json({ success: false, message: "Tidak dapat menghapus guru terakhir!" });
    }
    currentDb.teachers = currentDb.teachers.filter(t => t.id !== teacher.id);
  }

  await saveDB(currentDb);
  res.json({ success: true, teachers: currentDb.teachers });
});

// CRUD Student management
app.post('/api/teacher/students', async (req, res) => {
  const { action, student } = req.body;
  const currentDb = await getDB();

  if (action === 'add') {
    const exists = currentDb.students.some(s => s.username.toLowerCase() === student.username.toLowerCase());
    if (exists) {
      return res.status(400).json({ success: false, message: "Username sudah terdaftar!" });
    }
    const gradeVal = student.grade || "VII";
    const subClassVal = student.subClass || "A";
    const newStudent = {
      id: "s-" + Date.now().toString(),
      name: student.name,
      grade: gradeVal,
      subClass: subClassVal,
      class: `${gradeVal}-${subClassVal}`,
      username: student.username,
      password: student.password,
      qrCode: `${student.username}:${student.password}`
    };
    currentDb.students.push(newStudent);
  }
  else if (action === 'edit') {
    const idx = currentDb.students.findIndex(s => s.id === student.id);
    if (idx === -1) return res.status(404).json({ success: false, message: "Siswa tidak ditemukan." });

    const exists = currentDb.students.some(s => s.id !== student.id && s.username.toLowerCase() === student.username.toLowerCase());
    if (exists) return res.status(400).json({ success: false, message: "Username sudah terdaftar!" });

    const gradeVal = student.grade || "VII";
    const subClassVal = student.subClass || "A";
    currentDb.students[idx] = {
      ...currentDb.students[idx],
      name: student.name,
      grade: gradeVal,
      subClass: subClassVal,
      class: `${gradeVal}-${subClassVal}`,
      username: student.username,
      password: student.password,
      qrCode: `${student.username}:${student.password}`
    };
  }
  else if (action === 'delete') {
    currentDb.students = currentDb.students.filter(s => s.id !== student.id);
    // Delete session in all exams
    Object.keys(currentDb.sessions).forEach(examId => {
      if (currentDb.sessions[examId][student.username]) {
        delete currentDb.sessions[examId][student.username];
      }
    });
  }

  await saveDB(currentDb);
  res.json({ success: true, students: currentDb.students });
});

// Bulk Add Students
app.post('/api/teacher/students/bulk-add', async (req, res) => {
  const { students } = req.body;
  if (!Array.isArray(students)) {
    return res.status(400).json({ success: false, message: "Format data tidak valid." });
  }

  const currentDb = await getDB();
  let imported = 0;
  let skipped = 0;

  students.forEach((student, idx) => {
    const exists = currentDb.students.some(s => s.username.toLowerCase() === student.username.toLowerCase());
    if (exists) {
      skipped++;
    } else {
      const gradeVal = student.grade || "VII";
      const subClassVal = student.subClass || "A";
      currentDb.students.push({
        id: "s-" + (Date.now() + idx).toString() + Math.random().toString(36).substr(2, 5),
        name: student.name,
        grade: gradeVal,
        subClass: subClassVal,
        class: `${gradeVal}-${subClassVal}`,
        username: student.username,
        password: student.password,
        qrCode: `${student.username}:${student.password}`
      });
      imported++;
    }
  });

  await saveDB(currentDb);
  res.json({ success: true, imported, skipped });
});

// Bulk Delete Students
app.post('/api/teacher/students/bulk-delete', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) {
    return res.status(400).json({ success: false, message: "Format data tidak valid." });
  }

  const currentDb = await getDB();
  const usernamesToDelete = currentDb.students
    .filter(s => ids.includes(s.id))
    .map(s => s.username);

  // Filter out students
  currentDb.students = currentDb.students.filter(s => !ids.includes(s.id));

  // Clean up sessions in all exams
  Object.keys(currentDb.sessions).forEach(examId => {
    usernamesToDelete.forEach(username => {
      if (currentDb.sessions[examId][username]) {
        delete currentDb.sessions[examId][username];
      }
    });
  });

  await saveDB(currentDb);
  res.json({ success: true });
});

// Toggle Student Lock
app.post('/api/teacher/students/toggle-lock', async (req, res) => {
  const { username, lock } = req.body;
  if (!username) return res.status(400).json({ success: false, message: "Username siswa wajib disertakan." });

  const currentDb = await getDB();
  const activeId = currentDb.activeExamId;
  const examSessions = currentDb.sessions[activeId] || {};

  if (!examSessions[username]) {
    // If no session exists yet, initialize it
    examSessions[username] = {
      name: "",
      class: "",
      status: "belum_mulai",
      startedAt: "",
      progress: "0%",
      violationCount: 0,
      answers: {},
      score: null,
      correct: null,
      incorrect: null
    };
  }

  examSessions[username].isLocked = !!lock;

  if (lock) {
    examSessions[username].status = "terkunci";
    console.log(`[EXAM] Akun siswa "${username}" dikunci oleh guru.`);
  } else {
    // Reset session to start over from the beginning
    examSessions[username].status = "belum_mulai";
    examSessions[username].progress = "0%";
    examSessions[username].violationCount = 0;
    examSessions[username].answers = {};
    examSessions[username].score = null;
    examSessions[username].correct = null;
    examSessions[username].incorrect = null;
    examSessions[username].isLocked = false;
    console.log(`[EXAM] Akun siswa "${username}" dibuka kuncinya oleh guru. Sesi direset.`);
  }

  await saveDB(currentDb);
  res.json({ success: true });
});

// CRUD Exams & Activation Management
app.post('/api/teacher/exams', async (req, res) => {
  const { action, exam, activeExamId } = req.body;
  const currentDb = await getDB();

  if (action === 'add') {
    const newExamId = "exam-" + Date.now().toString();
    const isEnabled = !!exam.isEnabled;
    const newExam = {
      id: newExamId,
      title: exam.title,
      type: exam.type,
      googleFormUrl: exam.googleFormUrl || "",
      isEnabled,
      autoActivateAt: exam.autoActivateAt || "",
      allowedStudents: exam.allowedStudents || "all",
      randomize: !!exam.randomize,
      showOneByOne: !!exam.showOneByOne,
      duration: parseInt(exam.duration) || 600,
      questions: exam.questions || []
    };
    currentDb.exams.push(newExam);
    currentDb.sessions[newExamId] = {};
    currentDb.violations[newExamId] = [];
    // If newly added exam is enabled, make it the active exam
    if (isEnabled) {
      currentDb.exams.forEach(e => { if (e.id !== newExamId) e.isEnabled = false; });
      currentDb.activeExamId = newExamId;
    }
  }
  else if (action === 'edit') {
    const idx = currentDb.exams.findIndex(e => e.id === exam.id);
    if (idx === -1) return res.status(404).json({ success: false, message: "Ujian tidak ditemukan." });
    const isEnabled = !!exam.isEnabled;
    currentDb.exams[idx] = {
      ...currentDb.exams[idx],
      title: exam.title,
      type: exam.type,
      googleFormUrl: exam.googleFormUrl || "",
      isEnabled,
      autoActivateAt: exam.autoActivateAt || "",
      allowedStudents: exam.allowedStudents || "all",
      randomize: !!exam.randomize,
      showOneByOne: !!exam.showOneByOne,
      duration: parseInt(exam.duration) || 600,
      questions: exam.questions || []
    };
    // If this exam is now enabled, disable all others and set as active
    if (isEnabled) {
      currentDb.exams.forEach((e, i) => { if (i !== idx) e.isEnabled = false; });
      currentDb.activeExamId = exam.id;
    } else if (currentDb.activeExamId === exam.id) {
      // If disabled and was active, find another enabled exam
      const nextActive = currentDb.exams.find(e => e.isEnabled);
      currentDb.activeExamId = nextActive ? nextActive.id : "";
    }
  }
  else if (action === 'delete') {
    // Delete the per-exam question file if it exists
    const examToDelete = currentDb.exams.find(e => e.id === exam.id);
    if (examToDelete) {
      const qFile = examQuestionsFile(examToDelete);
      if (fs.existsSync(qFile)) {
        try { fs.unlinkSync(qFile); } catch (e) { }
        console.log(`[DB] File soal dihapus: ${qFile}`);
      }
    }

    currentDb.exams = currentDb.exams.filter(e => e.id !== exam.id);
    delete currentDb.sessions[exam.id];
    delete currentDb.violations[exam.id];

    if (currentDb.activeExamId === exam.id) {
      const nextActive = currentDb.exams.find(e => e.isEnabled);
      currentDb.activeExamId = nextActive ? nextActive.id : (currentDb.exams.length > 0 ? currentDb.exams[0].id : "");
    }
  }
  else if (action === 'toggle-enable') {
    // Toggle isEnabled on a specific exam
    const idx = currentDb.exams.findIndex(e => e.id === exam.id);
    if (idx === -1) return res.status(404).json({ success: false, message: "Ujian tidak ditemukan." });
    const newEnabled = !currentDb.exams[idx].isEnabled;
    if (newEnabled) {
      // Disable all others first
      currentDb.exams.forEach(e => { e.isEnabled = false; });
      currentDb.exams[idx].isEnabled = true;
      currentDb.activeExamId = exam.id;
      if (!currentDb.sessions[exam.id]) currentDb.sessions[exam.id] = {};
      if (!currentDb.violations[exam.id]) currentDb.violations[exam.id] = [];
      console.log(`\x1b[35m[EXAM] Ujian "${currentDb.exams[idx].title}" DIAKTIFKAN oleh guru.\x1b[0m`);
    } else {
      currentDb.exams[idx].isEnabled = false;
      if (currentDb.activeExamId === exam.id) {
        const nextActive = currentDb.exams.find(e => e.isEnabled);
        currentDb.activeExamId = nextActive ? nextActive.id : "";
      }
      console.log(`\x1b[35m[EXAM] Ujian "${currentDb.exams[idx].title}" DINONAKTIFKAN oleh guru.\x1b[0m`);
    }
  }
  else if (action === 'activate') {
    // Legacy activate - enable this exam, disable others
    currentDb.exams.forEach(e => { e.isEnabled = e.id === activeExamId; });
    currentDb.activeExamId = activeExamId;
    if (!currentDb.sessions[activeExamId]) currentDb.sessions[activeExamId] = {};
    if (!currentDb.violations[activeExamId]) currentDb.violations[activeExamId] = [];
    console.log(`\x1b[35m[EXAM] Ujian aktif diubah ke "${activeExamId}".\x1b[0m`);
  }

  await saveDB(currentDb);
  res.json({ success: true, exams: currentDb.exams, activeExamId: currentDb.activeExamId });
});

// Start server locally
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`===================================================================`);
  console.log(`   CBT Server aktif di: http://localhost:${PORT}`);
  console.log(`   Monitoring & Admin API siap digunakan.`);
  console.log(`===================================================================\n`);
});

module.exports = app;

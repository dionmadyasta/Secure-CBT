const fs = require('fs');
const path = require('path');

// =========================================================================
// MASUKKAN CREDENTIAL UPSTASH/VERCEL KV DI BAWAH INI:
// Kamu bisa ambil di Vercel Dashboard -> Storage -> Pilih Upstash -> .env.local
// =========================================================================
const KV_REST_API_URL = "";
const KV_REST_API_TOKEN = "";
// =========================================================================

async function migrate() {
  if (KV_REST_API_URL === "MASUKKAN_URL_DISINI") {
    console.log("❌ ERROR: Silakan masukkan KV_REST_API_URL dan KV_REST_API_TOKEN di file migrate.js terlebih dahulu.");
    return;
  }

  console.log("Membaca data dari folder lokal (data/)...");

  const DB_DIR = path.join(__dirname, 'data');
  const ADMIN_FILE = path.join(DB_DIR, 'data_guru.json');
  const STUDENTS_FILE = path.join(DB_DIR, 'data_siswa.json');
  const EXAMS_FILE = path.join(DB_DIR, 'soal.json');
  const SOAL_DIR = path.join(DB_DIR, 'soal');
  const SESSIONS_FILE = path.join(DB_DIR, 'session.json');

  let teachers = [];
  let students = [];
  let exams = [];
  let activeExamId = "exam-1";
  let sessions = {};
  let violations = {};

  if (fs.existsSync(ADMIN_FILE)) teachers = JSON.parse(fs.readFileSync(ADMIN_FILE, 'utf8'));
  if (fs.existsSync(STUDENTS_FILE)) students = JSON.parse(fs.readFileSync(STUDENTS_FILE, 'utf8'));

  if (fs.existsSync(EXAMS_FILE)) {
    const examsData = JSON.parse(fs.readFileSync(EXAMS_FILE, 'utf8'));
    activeExamId = examsData.activeExamId || "exam-1";
    exams = (examsData.exams || []).map(exam => {
      // safe slugify
      const slug = (exam.title || exam.id).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').substring(0, 80);
      const qFile = path.join(SOAL_DIR, `soal_${slug}_${exam.id}.json`);
      let questions = [];
      if (fs.existsSync(qFile)) {
        questions = JSON.parse(fs.readFileSync(qFile, 'utf8'));
      }
      return { ...exam, questions };
    });
  }

  if (fs.existsSync(SESSIONS_FILE)) {
    const sessionsData = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
    sessions = sessionsData.sessions || {};
    violations = sessionsData.violations || {};
  }

  const payload = { teachers, students, exams, activeExamId, sessions, violations };

  console.log(`Berhasil membaca: ${teachers.length} guru, ${students.length} siswa, ${exams.length} ujian.`);
  console.log("Mengunggah data ke Upstash Redis...");

  try {
    const response = await fetch(`${KV_REST_API_URL}/set/secure_cbt_db`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KV_REST_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (result.result === 'OK') {
      console.log("✅ BERHASIL! Semua data lokal telah dipindahkan ke Vercel/Upstash.");
      console.log("Sekarang kamu bisa login di aplikasi Vercel kamu!");
    } else {
      console.log("❌ GAGAL MENGUNGGAH:", result);
    }
  } catch (error) {
    console.error("❌ ERROR KONEKSI:", error.message);
  }
}

migrate();

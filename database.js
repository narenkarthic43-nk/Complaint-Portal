/**
 * Tiruchengode Municipal Corporation Portal - Database Layer
 * SQLite3 Database initialization, OWASP parameterized SQL helpers & seed data.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'civicconnect.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ SQLite Database Connection Error:', err);
  } else {
    console.log('📦 Connected to SQLite Database (civicconnect.db)');
  }
});

// Parameterized SQL Helpers to prevent CWE-89 SQL Injection
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function generateSVGDataURI(title, color, type) {
  const icon = type === 'before' ? 'BEFORE PHOTO' : 'AFTER WORK DONE';
  const bg = type === 'before' ? '#451a03' : '#064e3b';
  const fg = type === 'before' ? '#f59e0b' : '#34d399';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="600" height="400" fill="${bg}"/><circle cx="300" cy="180" r="70" fill="${fg}" opacity="0.2"/><text x="300" y="150" font-family="sans-serif" font-size="28" font-weight="bold" fill="${fg}" text-anchor="middle">${icon}</text><text x="300" y="210" font-family="sans-serif" font-size="20" fill="#f8fafc" text-anchor="middle">${title}</text><text x="300" y="270" font-family="sans-serif" font-size="14" fill="#94a3b8" text-anchor="middle">CivicConnect Inspection Media</text></svg>`;

  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

// Initialize Tables & Schema
async function initDatabase() {
  await dbRun(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'worker',
      ward TEXT NOT NULL,
      mobile TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS complaints (
      id TEXT PRIMARY KEY,
      ward TEXT NOT NULL,
      category TEXT NOT NULL,
      problem TEXT NOT NULL,
      address TEXT NOT NULL,
      lat REAL DEFAULT 11.3800,
      lng REAL DEFAULT 77.8946,
      citizen_name TEXT NOT NULL,
      citizen_mobile TEXT NOT NULL,
      before_photo TEXT NOT NULL,
      after_photo TEXT,
      status TEXT NOT NULL DEFAULT 'Registered',
      worker_notes TEXT DEFAULT '',
      admin_message TEXT DEFAULT '',
      admin_message_time TEXT DEFAULT '',
      rejection_reason TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      verified_at TEXT
    )
  `);

  // Seed Default Workers if empty
  const workerCount = await dbGet(`SELECT COUNT(*) as count FROM users WHERE role = 'worker'`);
  if (workerCount && workerCount.count === 0) {
    const passHash = await bcrypt.hash('pass123', 10);
    const now = new Date().toISOString();

    await dbRun(
      `INSERT INTO users (name, username, password_hash, role, ward, mobile, created_at) VALUES (?, ?, ?, 'worker', ?, ?, ?)`,
      ['Ramesh Kumar', 'worker1', passHash, 'Ward 1', '9876543210', now]
    );

    await dbRun(
      `INSERT INTO users (name, username, password_hash, role, ward, mobile, created_at) VALUES (?, ?, ?, 'worker', ?, ?, ?)`,
      ['Suresh Singh', 'worker2', passHash, 'Ward 3', '9123456789', now]
    );

    console.log('✅ Default Field Workers Seeded (worker1 / pass123)');
  }

  // Seed Initial Complaints if empty
  const complaintCount = await dbGet(`SELECT COUNT(*) as count FROM complaints`);
  if (complaintCount && complaintCount.count === 0) {
    const now = new Date().toISOString();

    await dbRun(
      `INSERT INTO complaints (id, ward, category, problem, address, lat, lng, citizen_name, citizen_mobile, before_photo, after_photo, status, worker_notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'CMP-2026-8941',
        'Ward 1',
        'Garbage & Waste Disposal',
        'Accumulation of household waste near market entrance.',
        'Central Market Gate #2, Ward 1',
        11.3800,
        77.8946,
        'Anita Sharma',
        '9876543210',
        generateSVGDataURI('Garbage Dump at Market Gate #2', '#f59e0b', 'before'),
        generateSVGDataURI('Cleared & Disinfected Area', '#10b981', 'after'),
        'Pending Verification',
        'Cleared 120kg garbage dump.',
        new Date(Date.now() - 86400000 * 2).toISOString(),
        now
      ]
    );

    console.log('✅ Initial Seed Complaints Populated');
  }
}

initDatabase().catch(err => console.error('Database Init Failed:', err));

module.exports = {
  db,
  dbRun,
  dbGet,
  dbAll,
  generateSVGDataURI
};

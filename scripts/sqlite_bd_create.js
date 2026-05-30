const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// 1. Ensure the data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log(`📁 Created missing database directory at: ${dataDir}`);
}

// 2. Define BOTH database paths explicitly
const dbPath = path.join(dataDir, 'tracker.sqlite');
const authDbPath = path.join(dataDir, 'auth.sqlite');

console.log(`🛠️ Connecting and initializing databases...`);

// ========================================================
// A. POPULATE AUTHENTICATION DATABASE (auth.sqlite)
// ========================================================
let authDb;
try {
  authDb = new Database(authDbPath);
  authDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      is_guest INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);

  // Direct hex values matching your system's exact layout signature for Dipesh
  const username = "dipesh";
  const display_name = "dipesh";
  const passwordHash = "b86e35e28d497438c0d8f603e5ae5337a534fc4f443720ba35cc7b66d8000d3c3fefb4bdbbcf4cd554e3cc26050cd418750f7e7149d489c9cbfee04e6ffa53f0f4cf488ecb4aa7c931414c7d85afc3b2";
  const passwordSalt = "2026-04-12T20:01:01.834Z";

  const insertAuthUser = authDb.prepare(`
    INSERT OR REPLACE INTO users (id, username, display_name, password_hash, password_salt, is_guest, created_at)
    VALUES (1, ?, ?, ?, ?, 0, datetime('now'))
  `);
  insertAuthUser.run(username, display_name, passwordHash, passwordSalt);
  console.log("✅ Registered user 'dipesh' successfully in auth.sqlite");

} catch (err) {
  console.error("❌ Error setting up auth.sqlite:", err.message);
} finally {
  if (authDb) {
    authDb.close();
  }
}

// ========================================================
// B. POPULATE TRACKING DATABASE (tracker.sqlite)
// ========================================================
let trackerDb;
try {
  trackerDb = new Database(dbPath);
  trackerDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "subjects" (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      subject TEXT NOT NULL,
      target INTEGER,
      frequency TEXT,
      due_date TEXT,
      skill_tags TEXT,
      factor_tags TEXT,
      archived BOOLEAN DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS subjects_v2 (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      subject TEXT NOT NULL,
      target INTEGER,
      frequency TEXT,
      due_date TEXT,
      skill_tags TEXT,
      factor_tags TEXT,
      archived BOOLEAN DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS diary_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      entry_date TEXT NOT NULL,
      title TEXT NOT NULL,
      work_done TEXT NOT NULL,
      highlights TEXT,
      next_step TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, entry_date)
    );

    CREATE INDEX IF NOT EXISTS idx_subjects_user_id ON subjects(user_id);
    CREATE INDEX IF NOT EXISTS idx_subjects_archived ON subjects(archived);
    CREATE INDEX IF NOT EXISTS idx_subjects_user_archived ON subjects(user_id, archived);
  `);

  trackerDb.prepare(`
    INSERT OR IGNORE INTO users (id, name, email, created_at)
    VALUES (1, 'Dipesh', 'dipesh@example.com', '2026-01-15 09:00:00')
  `).run();

  const targetSubjects = [
    { id: 'sub-1774858981780-255435', name: 'dsa', target: 60, freq: 'everyday', skill: '["dsa"]', factor: '["array and hashing"]' },
    { id: 'sub-1774858993497-696191', name: 'apti', target: 60, freq: 'everyday', skill: '["aptitude"]', factor: '["quantitative aptitude","logical reasoning"]' },
    { id: 'sub-1774859000911-331027', name: 'reading', target: 60, freq: 'everyday', skill: '["communication"]', factor: '["reading comprehension","vocabulary"]' },
    { id: 'sub-1774892226125-664409', name: 'auth app', target: 30, freq: 'everyday', skill: '["backend"]', factor: '["authentication","authorization","jwt"]' },
    { id: 'db6fe74c-a7b6-42ef-beff-65dc9d94efba', name: 'Live Project', target: 120, freq: 'everyday', skill: '["frontend"]', factor: '["html","css","javascript","react"]' }
  ];

  const insertLegacy = trackerDb.prepare(`INSERT OR REPLACE INTO subjects (id, user_id, subject, target, frequency, skill_tags, factor_tags, archived, created_at) VALUES (?, 1, ?, ?, ?, ?, ?, 0, '2026-02-01 12:00:00')`);
  const insertV2 = trackerDb.prepare(`INSERT OR REPLACE INTO subjects_v2 (id, user_id, subject, target, frequency, skill_tags, factor_tags, archived, created_at) VALUES (?, 1, ?, ?, ?, ?, ?, 0, '2026-02-01 12:00:00')`);

  targetSubjects.forEach(s => {
    insertLegacy.run(s.id, s.name, s.target, s.freq, s.skill, s.factor);
    insertV2.run(s.id, s.name, s.target, s.freq, s.skill, s.factor);
  });

  const timelineDiaries = [
    { date: '2026-02-10', title: 'Beginning Data Problem Revisions', work: 'Injected foundational sorting scripts. Solved index tracking conditions.', high: 'Isolated baseline tracking loops.', next: 'Expand into multi-pointer variables.' },
    { date: '2026-03-12', title: 'Analyzing Interface Scope Frameworks', work: 'Re-visited internal behavior parameters for script rendering. Configured modular array wrappers.', high: 'Stabilized loop rendering configurations.', next: 'Prepare multi-step layout testing chains.' },
    { date: '2026-04-13', title: 'Layout positioning controls and frame layouts', work: 'Designed product catalog display interface. Explored image fitting constraints via object-fit attributes (cover, contain) and structural alignment using box-sizing wrappers.', high: 'Fixed overlapping structural elements completely.', next: 'Add asynchronous API integrations into tracking modules.' },
    { date: '2026-04-15', title: 'Live Arrays & Splice Method Analysis', work: 'Attended session tracking javascript layouts. Mastered splice array mutation handlers while reviewing shift and unshift behaviors.', high: 'Clean validation loops achieved.', next: 'Integrate shimmer animation features into frontend.' },
    { date: '2026-05-11', title: 'HashMap key extraction properties validation', work: 'Verified functional signatures of map removal strategies. Confirmed strict behavior variation when handling composite attributes vs index identities.', high: 'Resolved data clean-up performance concerns.', next: 'Finalize interface render pipelines.' },
    { date: '2026-05-25', title: 'System metrics reporting check-off', work: 'Compiled historical tracking parameters across 4 continuous verification cycles.', high: 'Successfully proved architecture capabilities.', next: 'Prepare application documentation review.' }
  ];

  const insertDiary = trackerDb.prepare(`
    INSERT OR REPLACE INTO diary_entries (user_id, entry_date, title, work_done, highlights, next_step, created_at, updated_at)
    VALUES (1, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);

  timelineDiaries.forEach(d => {
    insertDiary.run(d.date, d.title, d.work, d.high, d.next);
  });

  console.log("✅ Populated 4 months of structured tracking logs into tracker.sqlite");

} catch (err) {
  console.error("❌ Error setting up tracker.sqlite:", err.message);
} finally {
  if (trackerDb) {
    trackerDb.close();
  }
}

console.log("🏁 All operations completed successfully!");
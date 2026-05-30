const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'data', 'tracker.sqlite');

if (!fs.existsSync(dbPath)) {
    console.error(`❌ Database not found at ${dbPath}`);
    process.exit(1);
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error opening database:', err);
        process.exit(1);
    }
    console.log(`📂 Connected to ${dbPath}`);
});

const run = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, (err) => {
        if (err) reject(err);
        else resolve();
    });
});

const all = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
    });
});

const get = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
    });
});

async function migrate() {
    try {
        console.log('\n🔄 Phase 1: Creating normalized tables...\n');

        // Step 1: Create SUBJECTS table
        console.log('1️⃣  Creating SUBJECTS table...');
        await run(`
            CREATE TABLE IF NOT EXISTS subjects (
                id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                subject TEXT NOT NULL,
                target INTEGER,
                frequency TEXT,
                due_date TEXT,
                skill_tags TEXT,
                factor_tags TEXT,
                archived BOOLEAN DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `, []);
        console.log('   ✅ SUBJECTS table created\n');

        // Step 2: Create indexes
        console.log('2️⃣  Creating indexes...');
        await run(`CREATE INDEX IF NOT EXISTS idx_subjects_user_id ON subjects(user_id)`, []);
        console.log('   ✅ idx_subjects_user_id created');
        await run(`CREATE INDEX IF NOT EXISTS idx_subjects_archived ON subjects(archived)`, []);
        console.log('   ✅ idx_subjects_archived created\n');

        // Step 3: Create REMINDER_SCAN_STATE_V2 table
        console.log('3️⃣  Creating REMINDER_SCAN_STATE_V2 table...');
        await run(`
            CREATE TABLE IF NOT EXISTS reminder_scan_state_v2 (
                id INTEGER PRIMARY KEY,
                user_id INTEGER,
                last_scan_date TEXT,
                last_scan_at TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `, []);
        console.log('   ✅ REMINDER_SCAN_STATE_V2 table created');
        await run(`CREATE INDEX IF NOT EXISTS idx_scan_state_user_id ON reminder_scan_state_v2(user_id)`, []);
        console.log('   ✅ idx_scan_state_user_id created\n');

        // Step 4: Migrate data from user_state.state_json
        console.log('4️⃣  Migrating SUBJECTS from state_json...');
        const userStates = await all('SELECT user_id, state_json FROM user_state', []);
        console.log(`   Found ${userStates.length} user records\n`);

        let totalMigrated = 0;
        let errors = [];

        for (const userState of userStates) {
            try {
                const stateJson = JSON.parse(userState.state_json || '{}');
                const subjects = Array.isArray(stateJson.subjects) ? stateJson.subjects : [];

                console.log(`   Processing user ${userState.user_id}: ${subjects.length} subjects`);

                for (const subject of subjects) {
                    // Prepare values - handle NULL defaults
                    // Generate unique ID if missing
                    let id = subject.id;
                    if (!id) {
                        id = `subject-${userState.user_id}-${Math.random().toString(36).substr(2, 9)}`;
                    }

                    const userId = userState.user_id;
                    const subjectName = subject.subject || 'Unnamed';
                    const target = subject.target || null;
                    const frequency = subject.frequency || null;
                    const dueDate = subject.dueDate || null;
                    const skillTags = subject.skillTags ? JSON.stringify(subject.skillTags) : null;
                    const factorTags = subject.factorTags ? JSON.stringify(subject.factorTags) : null;
                    const archived = subject.archived ? 1 : 0;

                    try {
                        await run(
                            `INSERT INTO subjects 
                            (id, user_id, subject, target, frequency, due_date, skill_tags, factor_tags, archived)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [id, userId, subjectName, target, frequency, dueDate, skillTags, factorTags, archived]
                        );
                        totalMigrated++;
                    } catch (insertError) {
                        errors.push(`Subject ${id}: ${insertError.message}`);
                    }
                }
            } catch (error) {
                errors.push(`User ${userState.user_id}: ${error.message}`);
            }
        }

        console.log(`   ✅ Migrated ${totalMigrated} subjects\n`);
        if (errors.length > 0) {
            console.log(`   ⚠️  Errors during migration:\n   ${errors.join('\n   ')}\n`);
        }

        // Step 5: Validate data integrity
        console.log('5️⃣  Validating migrated data...');
        const subjectCount = await get('SELECT COUNT(*) as count FROM subjects', []);
        const userCount = await get('SELECT COUNT(DISTINCT user_id) as count FROM subjects', []);

        console.log(`   ✅ Total subjects: ${subjectCount.count}`);
        console.log(`   ✅ Users with subjects: ${userCount.count}\n`);

        // Step 6: Sample data check
        console.log('6️⃣  Sampling data for verification...');
        const samples = await all('SELECT * FROM subjects LIMIT 3', []);
        if (samples.length > 0) {
            console.log('   Sample records:');
            samples.forEach((sample, i) => {
                console.log(`   ${i + 1}. [${sample.user_id}] ${sample.subject} (archived: ${sample.archived})`);
            });
        }
        console.log('\n');

        // Summary
        console.log('═══════════════════════════════════════════════════════');
        console.log('✅ PHASE 1 COMPLETE: Data Migration Successful');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`
📊 Migration Summary:
   • SUBJECTS table created with indexes
   • REMINDER_SCAN_STATE_V2 table created
   • Total subjects migrated: ${totalMigrated}
   • Unique users: ${userCount.count}
   • state_json kept intact for backup

⚠️  IMPORTANT: state_json has NOT been modified. 
   Existing data is safe during Phase 2 testing.

🔄 Next Steps (Phase 2):
   1. Update server.js to query SUBJECTS table
   2. Implement dual-write to keep state_json in sync
   3. Test all endpoints thoroughly
   4. Monitor for 1-2 weeks
   5. Then Phase 3: cleanup and optimize

📝 For more details, see: plan.md
`);

        db.close((err) => {
            if (err) console.error('Error closing database:', err);
            process.exit(0);
        });

    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        db.close();
        process.exit(1);
    }
}

migrate();

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const dbPath = path.join(__dirname, '..', 'data', 'tracker.sqlite');
if (!fs.existsSync(dbPath)) {
    console.error('DB file not found:', dbPath);
    process.exit(2);
}
const db = new sqlite3.Database(dbPath);

function all(sql, params = []) {
    return new Promise((resolve, reject) => db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows)));
}

(async () => {
    try {
        const tables = await all("SELECT name, type, sql FROM sqlite_master WHERE type IN ('table','index') ORDER BY name");
        console.log('---sqlite_master---');
        console.log(JSON.stringify(tables, null, 2));

        const userState = await all('SELECT user_id, length(state_json) as json_len, updated_at FROM user_state ORDER BY user_id LIMIT 10');
        console.log('---user_state-sample---');
        console.log(JSON.stringify(userState, null, 2));

        if (userState.length > 0) {
            const uid = userState[0].user_id;
            const row = await all('SELECT state_json FROM user_state WHERE user_id = ? LIMIT 1', [uid]);
            if (row && row[0] && row[0].state_json) {
                let parsed = null;
                try { parsed = JSON.parse(row[0].state_json); } catch (e) { parsed = null; }
                if (parsed) {
                    console.log('---parsed-state-summary---');
                    console.log(JSON.stringify({ user_id: uid, subjects: Array.isArray(parsed.subjects) ? parsed.subjects.length : 0, has_logs: !!parsed.logs, has_activeTimers: !!parsed.activeTimers }, null, 2));
                    if (Array.isArray(parsed.subjects) && parsed.subjects.length > 0) {
                        console.log('---first-subject---');
                        console.log(JSON.stringify(parsed.subjects[0], null, 2));
                    }
                } else {
                    console.log('Could not parse state_json for user', uid);
                }
            }
        }

        const diaryCount = await all('SELECT COUNT(*) as c FROM diary_entries');
        console.log('---diary_count---', JSON.stringify(diaryCount));

        const reminders = await all('SELECT id, user_id, task_id, due_date, reminder_type, sent_at FROM reminders_sent ORDER BY id DESC LIMIT 10');
        console.log('---recent-reminders---');
        console.log(JSON.stringify(reminders, null, 2));

        db.close();
    } catch (error) {
        console.error('ERROR', error);
        db.close();
        process.exit(1);
    }
})();

// Helper module for learning reports and AI analyses
// Usage: const createLearningReports = require('./lib/learningReports');
// const reports = createLearningReports({ run, get, all });

function safeJson(v) {
    try {
        return JSON.stringify(v == null ? [] : v);
    } catch (_e) {
        return JSON.stringify([]);
    }
}

module.exports = function createLearningReports({ run, get, all }) {
    async function ensureTables() {
        await run(`
            CREATE TABLE IF NOT EXISTS learning_reports (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              report_date TEXT NOT NULL,
              raw_text TEXT NOT NULL,
              created_at TEXT NOT NULL,
              UNIQUE(user_id, report_date)
            )
        `);

        await run("CREATE INDEX IF NOT EXISTS idx_learning_reports_user_date ON learning_reports(user_id, report_date DESC)");

        await run(`
            CREATE TABLE IF NOT EXISTS learning_report_analysis (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              report_id INTEGER NOT NULL,
              user_id INTEGER NOT NULL,
              corrected_text TEXT,
              summary TEXT,
              topics_json TEXT,
              concepts_json TEXT,
              understanding_ok INTEGER,
              corrections_json TEXT,
              resource TEXT,
              reflection_questions_json TEXT,
              created_at TEXT NOT NULL,
              FOREIGN KEY(report_id) REFERENCES learning_reports(id)
            )
        `);

        await run("CREATE INDEX IF NOT EXISTS idx_analysis_user_report ON learning_report_analysis(user_id, report_id)");

        await run(`
            CREATE TABLE IF NOT EXISTS learning_topics (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              topic TEXT NOT NULL,
              report_id INTEGER NOT NULL,
              UNIQUE(user_id, topic, report_id)
            )
        `);

        await run("CREATE INDEX IF NOT EXISTS idx_learning_topics_user_topic ON learning_topics(user_id, topic)");

        await run(`
            CREATE TABLE IF NOT EXISTS weekly_learning_summaries (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              week_start TEXT NOT NULL,
              week_end TEXT NOT NULL,
              summary TEXT,
              strengths_json TEXT,
              weaknesses_json TEXT,
              patterns_json TEXT,
              next_focus TEXT,
              action_plan_json TEXT,
              created_at TEXT NOT NULL,
              UNIQUE(user_id, week_start)
            )
        `);
    }

    async function saveReport(userId, reportDate, rawText) {
        const existing = await get("SELECT id FROM learning_reports WHERE user_id = ? AND report_date = ?", [userId, reportDate]);
        if (existing && existing.id) {
            await run("UPDATE learning_reports SET raw_text = ?, created_at = ? WHERE id = ?", [rawText, new Date().toISOString(), existing.id]);
            return existing.id;
        }

        const res = await run("INSERT INTO learning_reports (user_id, report_date, raw_text, created_at) VALUES (?, ?, ?, ?)", [userId, reportDate, rawText, new Date().toISOString()]);
        return res && res.lastID ? res.lastID : null;
    }

    async function getReportById(reportId) {
        return get("SELECT * FROM learning_reports WHERE id = ?", [reportId]);
    }

    async function getReportsForUser(userId, limit = 100) {
        return all("SELECT * FROM learning_reports WHERE user_id = ? ORDER BY report_date DESC LIMIT ?", [userId, limit]);
    }

    async function saveAnalysis(userId, reportId, analysis) {
        const now = new Date().toISOString();
        const topicsJson = safeJson(analysis.topics || []);
        const conceptsJson = safeJson(analysis.concepts || []);
        const correctionsJson = safeJson(analysis.corrections || []);
        const reflectionJson = safeJson(analysis.reflection_questions || []);

        const res = await run(`INSERT INTO learning_report_analysis (
            report_id, user_id, corrected_text, summary, topics_json, concepts_json,
            understanding_ok, corrections_json, resource, reflection_questions_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            reportId,
            userId,
            analysis.corrected_text || null,
            analysis.summary || null,
            topicsJson,
            conceptsJson,
            analysis.understanding_ok ? 1 : 0,
            correctionsJson,
            analysis.resource || null,
            reflectionJson,
            now
        ]);

        return res && res.lastID ? res.lastID : null;
    }

    async function addTopics(userId, reportId, topics) {
        if (!Array.isArray(topics) || topics.length === 0) return;
        const stmtPromises = topics.map((t) => run("INSERT OR IGNORE INTO learning_topics (user_id, topic, report_id) VALUES (?, ?, ?)", [userId, String(t).trim(), reportId]));
        await Promise.all(stmtPromises);
    }

    async function countDaysForTopic(userId, topic) {
        const row = await get(`SELECT COUNT(DISTINCT lr.report_date) AS cnt FROM learning_topics lt JOIN learning_reports lr ON lt.report_id = lr.id WHERE lt.user_id = ? AND lt.topic = ?`, [userId, topic]);
        return row ? Number(row.cnt || 0) : 0;
    }

    async function findFirstSeenForConcept(userId, conceptName) {
        const rows = await all("SELECT id, report_id, concepts_json, created_at FROM learning_report_analysis WHERE user_id = ? ORDER BY created_at ASC", [userId]);
        for (const row of rows) {
            try {
                const concepts = JSON.parse(row.concepts_json || "[]");
                if (Array.isArray(concepts)) {
                    const found = concepts.find((c) => String(c && c.name || "").toLowerCase().includes(String(conceptName || "").toLowerCase()));
                    if (found) {
                        return { analysis_id: row.id, report_id: row.report_id, created_at: row.created_at, concept: found };
                    }
                }
            } catch (_e) {
                // continue
            }
        }
        return null;
    }

    async function listMisunderstandings(userId, limit = 50) {
        const rows = await all("SELECT id, report_id, corrections_json, summary, created_at FROM learning_report_analysis WHERE user_id = ? AND understanding_ok = 0 ORDER BY created_at DESC LIMIT ?", [userId, limit]);
        return rows.map((r) => ({ id: r.id, report_id: r.report_id, corrections: JSON.parse(r.corrections_json || "[]"), summary: r.summary, created_at: r.created_at }));
    }

    async function saveWeeklySummary(userId, weekStart, weekEnd, summaryObj) {
        const now = new Date().toISOString();
        const strengths = safeJson(summaryObj.strengths || []);
        const weaknesses = safeJson(summaryObj.weaknesses || []);
        const patterns = safeJson(summaryObj.patterns || []);
        const actionPlan = safeJson(summaryObj.action_plan || []);

        const res = await run(`INSERT OR REPLACE INTO weekly_learning_summaries (
            id, user_id, week_start, week_end, summary, strengths_json, weaknesses_json, patterns_json, next_focus, action_plan_json, created_at
        ) VALUES (
            (SELECT id FROM weekly_learning_summaries WHERE user_id = ? AND week_start = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )`, [userId, weekStart, userId, weekStart, weekEnd, summaryObj.summary || null, strengths, weaknesses, patterns, summaryObj.next_focus || null, actionPlan, now]);

        return res && res.lastID ? res.lastID : null;
    }

    return {
        ensureTables,
        saveReport,
        getReportById,
        getReportsForUser,
        saveAnalysis,
        addTopics,
        countDaysForTopic,
        findFirstSeenForConcept,
        listMisunderstandings,
        saveWeeklySummary
    };
};

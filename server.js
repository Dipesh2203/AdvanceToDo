const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFile } = require("child_process");
const express = require("express");
const nodemailer = require("nodemailer");
// const sqlite3 = require("sqlite3").verbose();
const { promisify } = require("util");

require("dotenv").config();

const app = express();
const port = Number(process.env.PORT || 3000);
const SESSION_COOKIE_NAME = "advance_todo_session";
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;
const GUEST_USERNAME = "guest";
const GUEST_PASSWORD = "guest123";
let hasLoggedReminderConfigWarning = false;

// 1. First define the directory
const dataDir = path.join(__dirname, "data");

// 2. Then define paths that depend on it
const dbPath = path.join(dataDir, "tracker.sqlite");
const authDbPath = path.join(dataDir, "auth.sqlite");

// 3. Then open the databases
const Database = require("better-sqlite3");
const trackerDb = new Database(dbPath);
const authDb = new Database(authDbPath);


const staticDir = path.join(__dirname, "static");
const mempalaceRootDir = path.resolve(process.env.MEMPALACE_PALACE_PATH || path.join(dataDir, "mempalace"));
const mempalaceExportRootDir = path.resolve(process.env.MEMPALACE_EXPORT_ROOT || path.join(dataDir, "mempalace_exports"));
const openAiApiKey = process.env.OPENAI_API_KEY || "";
const openAiModel = process.env.OPENAI_MODEL || "gpt-4o-mini";
const openRouterApiKey = process.env.OPENROUTER_API_KEY || "";
const openRouterModel = process.env.OPENROUTER_MODEL || process.env.OPENAI_MODEL || "openai/gpt-4o-mini";
const openRouterBaseUrl = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1/chat/completions";
const openRouterSiteUrl = process.env.OPENROUTER_SITE_URL || "";
const openRouterAppName = process.env.OPENROUTER_APP_NAME || "advance-todo";
const aiProvider = String(process.env.AI_PROVIDER || "openai").trim().toLowerCase();
const strictUserMemoryIsolation = process.env.STRICT_USER_MEMORY_ISOLATION !== "false";
const mempalaceBin = process.env.MEMPALACE_BIN || "mempalace";
const pythonBin = process.env.PYTHON_BIN || "python";
const execFileAsync = promisify(execFile);

let mempalaceReadyPromise = null;
let warnedAboutMempalace = false;
let warnedAboutOpenAi = false;
let warnedAboutOpenRouter = false;

function isPlaceholderCredential(value) {
    const text = String(value || "").trim().toLowerCase();
    return !text || text.includes("replace_with") || text.includes("your_openrouter_key");
}

function logAiProviderDiagnostics() {
    const provider = aiProvider === "openrouter" ? "openrouter" : (aiProvider === "openai" ? "openai" : aiProvider);
    const openRouterReady = Boolean(openRouterApiKey) && !isPlaceholderCredential(openRouterApiKey);
    const openAiReady = Boolean(openAiApiKey) && !isPlaceholderCredential(openAiApiKey);

    console.log(`[ai] provider=${provider}`);
    console.log(`[ai] openrouter_key=${openRouterReady ? "present" : "missing_or_placeholder"}`);
    console.log(`[ai] openai_key=${openAiReady ? "present" : "missing_or_placeholder"}`);
    console.log(`[ai] openrouter_model=${openRouterModel}`);
}

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

function getDiaryWingName(userId) {
    const numericUserId = Number(userId);
    return Number.isFinite(numericUserId) && numericUserId > 0 ? `user-${numericUserId}` : "user-unknown";
}

function getDiaryMemoryExportDir(userId) {
    return path.join(mempalaceExportRootDir, getDiaryWingName(userId));
}

function getDiaryMemoryFilePath(userId, entryId) {
    return path.join(getDiaryMemoryExportDir(userId), `entry-${entryId}.md`);
}

async function runExternalCommand(command, args, options = {}) {
    return execFileAsync(command, args, {
        cwd: options.cwd || __dirname,
        env: options.env || process.env,
        maxBuffer: options.maxBuffer || 1024 * 1024 * 12
    });
}

async function runMempalaceCommand(args, options = {}) {
    const attempts = [];

    if (mempalaceBin) {
        attempts.push({ command: mempalaceBin, args });
    }

    attempts.push({ command: pythonBin, args: ["-m", "mempalace", ...args] });

    let lastError = null;
    for (const attempt of attempts) {
        try {
            return await runExternalCommand(attempt.command, attempt.args, options);
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error("Unable to run MemPalace command");
}

async function ensureMempalaceStore() {
    await fs.promises.mkdir(mempalaceRootDir, { recursive: true });
    await fs.promises.mkdir(mempalaceExportRootDir, { recursive: true });

    if (!mempalaceReadyPromise) {
        mempalaceReadyPromise = runMempalaceCommand(["init", mempalaceRootDir]).catch((error) => {
            if (!warnedAboutMempalace) {
                warnedAboutMempalace = true;
                console.warn("[mempalace] Memory store init skipped or failed. Falling back if needed.", error.message || error);
            }
        });
    }

    await mempalaceReadyPromise;
}

function serializeDiaryEntryForMemory(userId, entry) {
    const safeTitle = String(entry && entry.title ? entry.title : "").trim();
    const safeWorkDone = String(entry && entry.workDone ? entry.workDone : "").trim();
    const safeHighlights = String(entry && entry.highlights ? entry.highlights : "").trim();
    const safeNextStep = String(entry && entry.nextStep ? entry.nextStep : "").trim();
    const safeDate = String(entry && entry.date ? entry.date : "").trim();

    return [
        `user_id: ${getDiaryWingName(userId)}`,
        `entry_id: ${entry.id}`,
        `date: ${safeDate}`,
        `title: ${safeTitle}`,
        "",
        "work_done:",
        safeWorkDone,
        "",
        "highlights:",
        safeHighlights || "-",
        "",
        "next_step:",
        safeNextStep || "-",
        ""
    ].join("\n");
}



trackerDb.pragma("journal_mode = WAL");
trackerDb.pragma("foreign_keys = ON");
authDb.pragma("journal_mode = WAL");
authDb.pragma("foreign_keys = ON");

async function run(sql, params = []) {
    return trackerDb.prepare(sql).run(params);
}
async function get(sql, params = []) {
    return trackerDb.prepare(sql).get(params);
}
async function all(sql, params = []) {
    return trackerDb.prepare(sql).all(params);
}
async function authRun(sql, params = []) {
    return authDb.prepare(sql).run(params);
}
async function authGet(sql, params = []) {
    return authDb.prepare(sql).get(params);
}
async function authAll(sql, params = []) {
    return authDb.prepare(sql).all(params);
}











function parseCookies(cookieHeader) {
    if (typeof cookieHeader !== "string" || cookieHeader.trim() === "") {
        return {};
    }

    return cookieHeader.split(";").reduce((accumulator, part) => {
        const index = part.indexOf("=");
        if (index < 0) {
            return accumulator;
        }

        const key = part.slice(0, index).trim();
        const value = part.slice(index + 1).trim();
        if (key) {
            accumulator[key] = decodeURIComponent(value);
        }
        return accumulator;
    }, {});
}

function hashPassword(password, salt) {
    return crypto.pbkdf2Sync(String(password), String(salt), 120000, 64, "sha512").toString("hex");
}

function createPasswordRecord(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    return {
        salt,
        hash: hashPassword(password, salt)
    };
}

function verifyPassword(password, salt, hash) {
    const candidate = hashPassword(password, salt);
    return crypto.timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(String(hash), "hex"));
}

function hashSessionToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

function getCookieMaxAge(expiresAt) {
    return Math.max(0, new Date(expiresAt).getTime() - Date.now());
}

function buildSessionCookie(token, expiresAt) {
    const parts = [
        `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        `Max-Age=${Math.floor(getCookieMaxAge(expiresAt) / 1000)}`
    ];

    if (process.env.NODE_ENV === "production" || process.env.SESSION_COOKIE_SECURE === "true") {
        parts.push("Secure");
    }

    return parts.join("; ");
}

function buildClearedSessionCookie() {
    const parts = [
        `${SESSION_COOKIE_NAME}=`,
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        "Max-Age=0"
    ];

    if (process.env.NODE_ENV === "production" || process.env.SESSION_COOKIE_SECURE === "true") {
        parts.push("Secure");
    }

    return parts.join("; ");
}

function getSessionTokenFromRequest(request) {
    const cookies = parseCookies(request.headers.cookie);
    return cookies[SESSION_COOKIE_NAME] || null;
}

async function getUserFromRequest(request) {
    const token = getSessionTokenFromRequest(request);
    if (!token) {
        return null;
    }

    const tokenHash = hashSessionToken(token);
    const row = await authGet(
        `
        SELECT u.id, u.username, u.display_name, u.is_guest, s.expires_at
        FROM sessions s
        INNER JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ?
          AND s.expires_at > ?
        LIMIT 1
        `,
        [tokenHash, new Date().toISOString()]
    );

    return row ? {
        id: row.id,
        username: row.username,
        displayName: row.display_name || row.username,
        isGuest: Number(row.is_guest) === 1
    } : null;
}

async function requireAuth(request, response, next) {
    try {
        const user = await getUserFromRequest(request);
        if (!user) {
            response.status(401).json({ error: "Authentication required" });
            return;
        }

        request.currentUser = user;
        next();
    } catch (error) {
        response.status(500).json({ error: "Failed to validate session" });
    }
}

async function getUserByUsername(username) {
    return authGet("SELECT id, username, display_name, is_guest FROM users WHERE username = ? LIMIT 1", [username]);
}

async function createSession(userId) {
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashSessionToken(token);
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS).toISOString();

    await authRun(
        `
        INSERT INTO sessions (user_id, token_hash, created_at, expires_at, last_seen_at)
        VALUES (?, ?, ?, ?, ?)
        `,
        [userId, tokenHash, now, expiresAt, now]
    );

    return { token, expiresAt };
}

function isSecureCookieRequested() {
    return process.env.NODE_ENV === "production" || process.env.SESSION_COOKIE_SECURE === "true";
}

function setSessionCookie(response, token, expiresAt) {
    response.setHeader("Set-Cookie", buildSessionCookie(token, expiresAt));
}

function clearSessionCookie(response) {
    response.setHeader("Set-Cookie", buildClearedSessionCookie());
}

async function initDb() {
    await run(`
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      state_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

    await run(`
        CREATE TABLE IF NOT EXISTS user_state (
            user_id INTEGER PRIMARY KEY,
            state_json TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    `);

    await run(`
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
        )
    `);

    await run("CREATE INDEX IF NOT EXISTS idx_diary_entries_user_date ON diary_entries(user_id, entry_date DESC)");
    await ensureDiaryEntriesSchema();

    await run(`
    CREATE TABLE IF NOT EXISTS reminders_sent (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
      task_id TEXT NOT NULL,
      due_date TEXT NOT NULL,
      reminder_type TEXT NOT NULL,
      sent_at TEXT NOT NULL,
            UNIQUE(user_id, task_id, due_date, reminder_type)
    )
  `);

    await ensureRemindersSentUserColumn();

    await run(`
        CREATE TABLE IF NOT EXISTS reminder_scan_state (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            last_scan_date TEXT,
            last_scan_at TEXT
        )
    `);

    await authRun(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      is_guest INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `);

    await authRun(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

    await authRun("CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)");

    const guestUser = await getUserByUsername(GUEST_USERNAME);
    if (!guestUser) {
        const passwordRecord = createPasswordRecord(GUEST_PASSWORD);
        await authRun(
            `
            INSERT INTO users (username, display_name, password_hash, password_salt, is_guest, created_at)
            VALUES (?, ?, ?, ?, 1, ?)
            `,
            [GUEST_USERNAME, "Guest", passwordRecord.hash, passwordRecord.salt, new Date().toISOString()]
        );
    }

    await migrateLegacyStateToGuest();
}

async function ensureRemindersSentUserColumn() {
    const columns = await all("PRAGMA table_info(reminders_sent)");
    const hasUserId = columns.some((column) => column && column.name === "user_id");

    if (hasUserId) {
        return;
    }

    await run("ALTER TABLE reminders_sent ADD COLUMN user_id INTEGER DEFAULT 1");
    await run("UPDATE reminders_sent SET user_id = 1 WHERE user_id IS NULL OR user_id = 0");
}

async function migrateLegacyStateToGuest() {
    const guestUser = await getUserByUsername(GUEST_USERNAME);
    if (!guestUser) {
        return;
    }

    const existing = await get("SELECT state_json FROM user_state WHERE user_id = ?", [guestUser.id]);
    if (existing) {
        return;
    }

    const legacy = await get("SELECT state_json, updated_at FROM app_state WHERE id = 1");
    if (!legacy || !legacy.state_json) {
        return;
    }

    await run(
        `
        INSERT INTO user_state (user_id, state_json, updated_at)
        VALUES (?, ?, ?)
        `,
        [guestUser.id, legacy.state_json, legacy.updated_at || new Date().toISOString()]
    );
}

function getTodayKey() {
    return new Date().toISOString().slice(0, 10);
}

function normalizeDateKey(value) {
    if (typeof value !== "string") {
        return null;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }

    return parsed.toISOString().slice(0, 10);
}

function normalizeDiaryPayload(payload) {
    if (!payload || typeof payload !== "object") {
        return null;
    }

    const date = normalizeDateKey(payload.date);
    const title = typeof payload.title === "string" ? payload.title.trim() : "";
    const workDone = typeof payload.workDone === "string" ? payload.workDone.trim() : "";
    const highlights = typeof payload.highlights === "string" ? payload.highlights.trim() : "";
    const nextStep = typeof payload.nextStep === "string" ? payload.nextStep.trim() : "";

    if (!date || !title || !workDone) {
        return null;
    }

    if (title.length > 90 || workDone.length > 10000 || highlights.length > 10000 || nextStep.length > 10000) {
        return null;
    }

    return {
        date,
        title,
        workDone,
        highlights,
        nextStep
    };
}

function formatDiaryEntry(row) {
    if (!row) {
        return null;
    }

    return {
        id: String(row.id),
        date: row.entry_date,
        title: row.title,
        workDone: row.work_done,
        highlights: row.highlights || "",
        nextStep: row.next_step || "",
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

async function readDiaryEntriesForUser(userId) {
    const numericUserId = Number(userId);
    if (!Number.isFinite(numericUserId) || numericUserId <= 0) {
        return [];
    }

    const rows = await all(
        `
        SELECT id, entry_date, title, work_done, highlights, next_step, created_at, updated_at
        FROM diary_entries
        WHERE user_id = ?
        ORDER BY entry_date DESC, updated_at DESC, id DESC
        `,
        [numericUserId]
    );

    return rows.map(formatDiaryEntry).filter(Boolean);
}

async function readDiaryEntryById(userId, entryId) {
    const numericUserId = Number(userId);
    const numericEntryId = Number(entryId);

    if (!Number.isFinite(numericUserId) || numericUserId <= 0 || !Number.isFinite(numericEntryId) || numericEntryId <= 0) {
        return null;
    }

    const row = await get(
        `
        SELECT id, entry_date, title, work_done, highlights, next_step, created_at, updated_at
        FROM diary_entries
        WHERE user_id = ? AND id = ?
        LIMIT 1
        `,
        [numericUserId, numericEntryId]
    );

    return formatDiaryEntry(row);
}

function normalizeFreeText(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function tokenize(value) {
    const normalized = normalizeFreeText(value);
    if (!normalized) {
        return [];
    }

    return normalized
        .split(" ")
        .filter((token) => token.length >= 3)
        .slice(0, 120);
}

function buildDiaryMemoryCandidates(entries) {
    return entries.map((entry) => {
        const body = `${entry.title || ""} ${entry.workDone || ""} ${entry.highlights || ""} ${entry.nextStep || ""}`;
        return {
            id: entry.id,
            date: entry.date,
            title: entry.title || "Untitled",
            body,
            tokens: new Set(tokenize(body))
        };
    });
}

function scoreDiaryMemoryCandidate(queryTokenSet, candidate, newestDateKey) {
    let overlap = 0;
    queryTokenSet.forEach((token) => {
        if (candidate.tokens.has(token)) {
            overlap += 1;
        }
    });

    if (overlap === 0) {
        return 0;
    }

    const ageDays = Math.max(0, dateDiffInDays(candidate.date, newestDateKey));
    const recencyBoost = 1 / (1 + ageDays / 7);
    return overlap * 2 + recencyBoost;
}

function selectTopDiaryMemories(entries, query, limit = 4) {
    const candidates = buildDiaryMemoryCandidates(entries);
    const queryTokens = tokenize(query);
    const queryTokenSet = new Set(queryTokens);
    const newestDateKey = entries.length > 0 ? entries[0].date : getTodayKey();

    if (queryTokenSet.size === 0) {
        return candidates.slice(0, limit);
    }

    return candidates
        .map((candidate) => ({
            candidate,
            score: scoreDiaryMemoryCandidate(queryTokenSet, candidate, newestDateKey)
        }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((item) => item.candidate);
}

function summarizeMemory(memory) {
    const snippet = memory.body.length > 180 ? `${memory.body.slice(0, 177)}...` : memory.body;
    return `${memory.date}: ${memory.title} - ${snippet}`;
}

function buildTaskRecommendations(stateJson) {
    if (!stateJson || !Array.isArray(stateJson.subjects)) {
        return [];
    }

    const todayKey = getTodayKey();
    const todayLog = stateJson.logs && stateJson.logs[todayKey] ? stateJson.logs[todayKey] : {};

    return stateJson.subjects
        .map((subject) => {
            const target = Number(subject && subject.target) || 0;
            if (target <= 0) {
                return null;
            }

            const isSingleton = subject.frequency === "singleton";
            const logged = isSingleton
                ? Object.values(stateJson.logs || {}).reduce((sum, dayLog) => sum + (Number(dayLog && dayLog[subject.id]) || 0), 0)
                : Number(todayLog && todayLog[subject.id]) || 0;
            const remaining = Math.max(0, target - logged);
            if (remaining <= 0) {
                return null;
            }

            const dueDate = normalizeDateKey(subject.dueDate);
            const daysUntilDue = dueDate ? dateDiffInDays(todayKey, dueDate) : null;
            const urgency = daysUntilDue === null
                ? 20
                : (daysUntilDue < 0 ? 100 : (daysUntilDue === 0 ? 90 : Math.max(25, 80 - daysUntilDue * 8)));

            return {
                subject: subject.subject || "Task",
                remaining,
                target,
                logged,
                dueDate,
                daysUntilDue,
                urgency
            };
        })
        .filter(Boolean)
        .sort((a, b) => b.urgency - a.urgency || b.remaining - a.remaining)
        .slice(0, 4);
}

function buildSkillRecommendations(stateJson, memoryTexts) {
    const signalMap = new Map();
    const addSignal = (name, weight) => {
        const key = String(name || "").trim().toLowerCase();
        if (!key) {
            return;
        }

        signalMap.set(key, (signalMap.get(key) || 0) + weight);
    };

    if (stateJson && Array.isArray(stateJson.subjects)) {
        stateJson.subjects.forEach((subject) => {
            const skillTags = Array.isArray(subject.skillTags) ? subject.skillTags : [];
            skillTags.forEach((tag) => addSignal(tag, 1));
            const factorTags = Array.isArray(subject.factorTags) ? subject.factorTags : [];
            factorTags.forEach((tag) => addSignal(tag, 0.5));
        });
    }

    const keywordToSkill = {
        meeting: "communication",
        discuss: "communication",
        explain: "clarity",
        feedback: "feedback handling",
        listen: "active listening",
        conflict: "empathy",
        bug: "problem solving",
        debug: "analysis",
        blocked: "problem solving",
        deadline: "prioritization",
        plan: "prioritization",
        learn: "learning from mistakes"
    };

    const mergedMemoryText = normalizeFreeText(memoryTexts.join(" "));
    Object.entries(keywordToSkill).forEach(([keyword, skill]) => {
        if (mergedMemoryText.includes(keyword)) {
            addSignal(skill, 2);
        }
    });

    return Array.from(signalMap.entries())
        .map(([name, score]) => ({ name, score }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);
}

async function readAllDiaryEntriesForMemorySync() {
    return all(
        `
        SELECT id, user_id, entry_date, title, work_done, highlights, next_step, created_at, updated_at
        FROM diary_entries
        ORDER BY user_id ASC, entry_date DESC, updated_at DESC, id DESC
        `
    );
}

function parseMempalaceSearchOutput(stdout) {
    const lines = String(stdout || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    return lines.slice(0, 5).map((line, index) => ({
        id: `memory-${index + 1}`,
        date: "",
        title: line.length > 64 ? `${line.slice(0, 61)}...` : line,
        snippet: line
    }));
}

async function mineDiaryWingForUser(userId) {
    await ensureMempalaceStore();
    const wingName = getDiaryWingName(userId);
    const exportDir = getDiaryMemoryExportDir(userId);

    await fs.promises.mkdir(exportDir, { recursive: true });
    await runMempalaceCommand(["--palace", mempalaceRootDir, "mine", exportDir, "--wing", wingName]);
}

async function writeDiaryEntryToMempalace(userId, entry) {
    try {
        await ensureMempalaceStore();
        const exportDir = getDiaryMemoryExportDir(userId);
        const filePath = getDiaryMemoryFilePath(userId, entry.id);

        await fs.promises.mkdir(exportDir, { recursive: true });
        await fs.promises.writeFile(filePath, serializeDiaryEntryForMemory(userId, entry), "utf8");
        await mineDiaryWingForUser(userId);
    } catch (error) {
        if (!warnedAboutMempalace) {
            warnedAboutMempalace = true;
            console.warn("[mempalace] Diary sync failed; continuing with fallback retrieval.", error.message || error);
        }
    }
}

async function removeDiaryEntryFromMempalace(userId, entryId) {
    try {
        const filePath = getDiaryMemoryFilePath(userId, entryId);
        await fs.promises.unlink(filePath).catch(() => { });
        await mineDiaryWingForUser(userId);
    } catch (error) {
        if (!warnedAboutMempalace) {
            warnedAboutMempalace = true;
            console.warn("[mempalace] Diary delete sync failed; continuing with fallback retrieval.", error.message || error);
        }
    }
}

async function seedDiaryMemoriesFromDatabase() {
    try {
        const rows = await readAllDiaryEntriesForMemorySync();
        if (!rows.length) {
            return;
        }

        const users = new Map();
        for (const row of rows) {
            if (!users.has(row.user_id)) {
                users.set(row.user_id, []);
            }

            users.get(row.user_id).push(row);
        }

        for (const [userId, userRows] of users.entries()) {
            const exportDir = getDiaryMemoryExportDir(userId);
            await fs.promises.mkdir(exportDir, { recursive: true });

            await Promise.all(userRows.map(async (row) => {
                const filePath = getDiaryMemoryFilePath(userId, row.id);
                const diaryEntry = {
                    id: row.id,
                    date: row.entry_date,
                    title: row.title,
                    workDone: row.work_done,
                    highlights: row.highlights,
                    nextStep: row.next_step
                };

                await fs.promises.writeFile(filePath, serializeDiaryEntryForMemory(userId, diaryEntry), "utf8");
            }));

            await mineDiaryWingForUser(userId);
        }
    } catch (error) {
        if (!warnedAboutMempalace) {
            warnedAboutMempalace = true;
            console.warn("[mempalace] Seed sync failed; continuing with fallback retrieval.", error.message || error);
        }
    }
}

async function getDiaryMemoryContext(userId, message) {
    const entries = await readDiaryEntriesForUser(userId);

    // In strict mode, retrieve context only from the authenticated user's diary rows.
    if (strictUserMemoryIsolation) {
        return selectTopDiaryMemories(entries, message, 4).map((memory) => ({
            id: memory.id,
            date: memory.date,
            title: memory.title,
            snippet: memory.body.length > 220 ? `${memory.body.slice(0, 217)}...` : memory.body
        }));
    }

    try {
        await ensureMempalaceStore();
        const wingName = getDiaryWingName(userId);
        const result = await runMempalaceCommand([
            "--palace",
            mempalaceRootDir,
            "search",
            message,
            "--wing",
            wingName
        ]);

        const memories = parseMempalaceSearchOutput(result.stdout);
        if (memories.length > 0) {
            return memories;
        }
    } catch (error) {
        if (!warnedAboutMempalace) {
            warnedAboutMempalace = true;
            console.warn("[mempalace] Search unavailable; using fallback diary retrieval.", error.message || error);
        }
    }

    return selectTopDiaryMemories(entries, message, 4).map((memory) => ({
        id: memory.id,
        date: memory.date,
        title: memory.title,
        snippet: memory.body.length > 220 ? `${memory.body.slice(0, 217)}...` : memory.body
    }));
}

function buildDiaryFallbackResponse(entries, memories, tasks, skills) {
    if (entries.length === 0) {
        return {
            answer: "No diary entries found yet. Add a few private diary entries first, then I can suggest tasks and skills.",
            memories: [],
            tasks,
            skills
        };
    }

    const memorySummaries = memories.length > 0
        ? memories.map((memory) => memory.snippet || memory.title || "").filter(Boolean)
        : [];

    const topTaskLine = tasks.length > 0
        ? tasks.map((task) => `${task.subject}: ${task.remaining} min remaining${task.dueDate ? ` (due ${task.dueDate})` : ""}`).join(" | ")
        : "No pending tasks detected in your tracker right now.";

    const topSkillLine = skills.length > 0
        ? skills.map((skill) => `${skill.name}`).join(", ")
        : "Not enough signal for skill recommendation yet.";

    const memoryLine = memorySummaries.length > 0
        ? memorySummaries.slice(0, 2).join(" || ")
        : "No directly matching diary memory found, using latest entries.";

    return {
        answer: `Based on your private diary memory: ${memoryLine} Next task focus: ${topTaskLine} Skill focus: ${topSkillLine}.`,
        memories,
        tasks,
        skills
    };
}

function buildOpenAiDiaryPrompt({ message, memories, tasks, skills, trackerSummary }) {
    const memoryBlock = memories.length > 0
        ? memories.map((memory) => `- ${memory.snippet || memory.title || ""}`).join("\n")
        : "- No relevant diary memories found.";

    const taskBlock = tasks.length > 0
        ? tasks.map((task) => `- ${task.subject}: ${task.remaining} min remaining${task.dueDate ? ` (due ${task.dueDate})` : ""}`).join("\n")
        : "- No urgent tracker tasks.";

    const skillBlock = skills.length > 0
        ? skills.map((skill) => `- ${skill.name}`).join("\n")
        : "- No skill signal yet.";

    return [
        "You are a private diary coach. Use only the provided context.",
        "Never infer or mix information from other users.",
        "Write a concise, practical answer.",
        "Do not mention hidden reasoning or the existence of tools.",
        "If context is thin, say so briefly and give the best next action.",
        "",
        `User question: ${message}`,
        "",
        "Retrieved diary memory:",
        memoryBlock,
        "",
        "Tracker summary:",
        trackerSummary || "- No tracker state available.",
        "",
        "Suggested tasks:",
        taskBlock,
        "",
        "Suggested skills:",
        skillBlock,
        "",
        "Return plain text only."
    ].join("\n");
}

async function callOpenAiChatCompletion({ systemPrompt, userPrompt, temperature = 0.2 }) {
    if (!openAiApiKey) {
        if (!warnedAboutOpenAi) {
            warnedAboutOpenAi = true;
            console.warn("[openai] OPENAI_API_KEY is missing; using fallback diary response.");
        }

        return null;
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openAiApiKey}`
        },
        body: JSON.stringify({
            model: openAiModel,
            temperature,
            messages: [
                {
                    role: "system",
                    content: systemPrompt
                },
                {
                    role: "user",
                    content: userPrompt
                }
            ]
        })
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`OpenAI request failed: ${response.status} ${errorText}`.trim());
    }

    const data = await response.json();
    const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    return typeof content === "string" && content.trim() ? content.trim() : null;
}

async function callOpenRouterChatCompletion({ systemPrompt, userPrompt, temperature = 0.2 }) {
    if (!openRouterApiKey || isPlaceholderCredential(openRouterApiKey)) {
        if (!warnedAboutOpenRouter) {
            warnedAboutOpenRouter = true;
            console.warn("[openrouter] OPENROUTER_API_KEY is missing or still a placeholder; using fallback diary response.");
        }

        return null;
    }

    const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openRouterApiKey}`,
        "X-Title": openRouterAppName
    };

    if (openRouterSiteUrl) {
        headers["HTTP-Referer"] = openRouterSiteUrl;
    }

    const response = await fetch(openRouterBaseUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
            model: openRouterModel,
            temperature,
            messages: [
                {
                    role: "system",
                    content: systemPrompt
                },
                {
                    role: "user",
                    content: userPrompt
                }
            ]
        })
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        if (response.status === 401) {
            throw new Error("OpenRouter authentication failed. Check that OPENROUTER_API_KEY is a valid OpenRouter key and that the server was restarted after updating .env.");
        }

        throw new Error(`OpenRouter request failed: ${response.status} ${errorText}`.trim());
    }

    const data = await response.json();
    const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    return typeof content === "string" && content.trim() ? content.trim() : null;
}

async function callOpenAiDiaryCoach(payload) {
    return callOpenAiChatCompletion({
        systemPrompt: "You are a concise diary coach that answers using only the provided private context.",
        userPrompt: buildOpenAiDiaryPrompt(payload),
        temperature: 0.2
    });
}

async function callOpenRouterDiaryCoach(payload) {
    return callOpenRouterChatCompletion({
        systemPrompt: "You are a concise diary coach that answers using only the provided private context.",
        userPrompt: buildOpenAiDiaryPrompt(payload),
        temperature: 0.2
    });
}

async function callDiaryModelTextByProvider({ systemPrompt, userPrompt, temperature = 0.2 }) {
    if (aiProvider === "openai") {
        return callOpenAiChatCompletion({ systemPrompt, userPrompt, temperature });
    }

    if (aiProvider === "openrouter") {
        return callOpenRouterChatCompletion({ systemPrompt, userPrompt, temperature });
    }

    return null;
}

async function callDiaryCoachModel(payload) {
    if (aiProvider === "openai") {
        return callOpenAiDiaryCoach(payload);
    }

    if (aiProvider === "openrouter") {
        return callOpenRouterDiaryCoach(payload);
    }

    // Provider switch is intentionally centralized so local/server model integration is a small change later.
    return null;
}

function filterDiaryEntriesByWindow(entries, days) {
    const safeDays = Number.isFinite(Number(days)) ? Math.max(7, Math.min(365, Math.round(Number(days)))) : 30;
    const cutoff = new Date(Date.now() - safeDays * 86400000).toISOString().slice(0, 10);
    return entries.filter((entry) => entry && entry.date && entry.date >= cutoff);
}

function extractEntryKeywords(entries, limit = 8) {
    const stopWords = new Set([
        "the", "and", "for", "with", "this", "that", "from", "have", "will", "into", "your", "you", "was", "were",
        "are", "not", "but", "had", "has", "about", "after", "before", "today", "tomorrow", "done", "work", "task"
    ]);

    const counts = new Map();
    entries.forEach((entry) => {
        const combined = `${entry.title || ""} ${entry.workDone || ""} ${entry.highlights || ""} ${entry.nextStep || ""}`;
        tokenize(combined).forEach((token) => {
            if (token.length < 4 || stopWords.has(token)) {
                return;
            }

            counts.set(token, (counts.get(token) || 0) + 1);
        });
    });

    return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map((item) => item[0]);
}

function buildDiaryPeriodSnapshot(entries, days) {
    const total = entries.length;
    const withHighlights = entries.filter((entry) => Boolean(String(entry && entry.highlights || "").trim())).length;
    const withNextStep = entries.filter((entry) => Boolean(String(entry && entry.nextStep || "").trim())).length;
    const avgWorkDoneLength = total > 0
        ? Math.round(entries.reduce((sum, entry) => sum + String(entry.workDone || "").length, 0) / total)
        : 0;
    const entriesPerWeek = days > 0 ? Number(((total / days) * 7).toFixed(2)) : 0;

    return {
        entryCount: total,
        entriesPerWeek,
        highlightRate: total > 0 ? Number((withHighlights / total).toFixed(2)) : 0,
        planningRate: total > 0 ? Number((withNextStep / total).toFixed(2)) : 0,
        avgWorkDoneLength,
        topKeywords: extractEntryKeywords(entries, 8)
    };
}

function buildPastVsCurrentData(entries, days) {
    const filtered = filterDiaryEntriesByWindow(entries, days)
        .slice()
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));

    const splitIndex = Math.max(1, Math.floor(filtered.length / 2));
    const pastEntries = filtered.slice(0, splitIndex);
    const currentEntries = filtered.slice(splitIndex);

    const safeDays = Number.isFinite(Number(days)) ? Math.max(7, Math.min(365, Math.round(Number(days)))) : 30;
    const halfDays = Math.max(1, Math.floor(safeDays / 2));

    const past = buildDiaryPeriodSnapshot(pastEntries, halfDays);
    const current = buildDiaryPeriodSnapshot(currentEntries, safeDays - halfDays || 1);

    const deltas = {
        entriesPerWeek: Number((current.entriesPerWeek - past.entriesPerWeek).toFixed(2)),
        planningRate: Number((current.planningRate - past.planningRate).toFixed(2)),
        highlightRate: Number((current.highlightRate - past.highlightRate).toFixed(2)),
        avgWorkDoneLength: current.avgWorkDoneLength - past.avgWorkDoneLength
    };

    return {
        filteredEntries: filtered,
        pastEntries,
        currentEntries,
        past,
        current,
        deltas,
        periodDays: safeDays
    };
}

function buildPastVsCurrentFallbackReport({ insights, tasks, skills, memories, focus }) {
    const strengths = [];
    const growthAreas = [];

    if (insights.deltas.entriesPerWeek > 0) {
        strengths.push("Journaling consistency improved in the current period.");
    } else {
        growthAreas.push("Increase diary consistency to capture better self-signals.");
    }

    if (insights.deltas.planningRate > 0) {
        strengths.push("Action planning improved with more next-step notes.");
    } else {
        growthAreas.push("Write one concrete next step in every entry.");
    }

    if (insights.deltas.highlightRate <= 0) {
        growthAreas.push("Capture at least one positive highlight daily to reinforce progress.");
    }

    const taskPlan = tasks.slice(0, 3).map((task) => `${task.subject}: complete ${task.remaining} minutes${task.dueDate ? ` before ${task.dueDate}` : ""}.`);
    const skillPlan = skills.slice(0, 3).map((skill) => `Practice ${skill.name} with one focused block this week.`);
    const evidence = insights.filteredEntries
        .slice(-4)
        .reverse()
        .map((entry) => ({
            date: entry.date,
            title: entry.title,
            note: String(entry.workDone || "").slice(0, 220)
        }));

    return {
        focus,
        periodDays: insights.periodDays,
        totalEntries: insights.filteredEntries.length,
        past: insights.past,
        current: insights.current,
        deltas: insights.deltas,
        summary: "Past vs current trend generated from your private diary timeline.",
        strengths: strengths.slice(0, 4),
        workOn: growthAreas.slice(0, 4),
        sevenDayPlan: taskPlan.concat(skillPlan).slice(0, 6),
        friendNote: "You are making progress by showing up and reflecting. Keep entries honest and specific; small daily execution beats perfect plans.",
        memories: memories.slice(0, 4),
        evidence
    };
}

function buildPastVsCurrentPrompt({ focus, insights, memories, tasks, skills }) {
    const memoryBlock = memories.length > 0
        ? memories.map((memory) => `- ${memory.date || ""} ${memory.title || ""}: ${memory.snippet || ""}`).join("\n")
        : "- No direct memory matches from diary timeline.";

    const taskBlock = tasks.length > 0
        ? tasks.map((task) => `- ${task.subject}: ${task.remaining} min pending${task.dueDate ? ` (due ${task.dueDate})` : ""}`).join("\n")
        : "- No urgent task data found.";

    const skillBlock = skills.length > 0
        ? skills.map((skill) => `- ${skill.name}`).join("\n")
        : "- No skill signal found.";

    return [
        "Generate a supportive, evidence-based past-vs-current diary report in JSON.",
        "Use only the provided private user context.",
        "Never include content outside this user's data.",
        "JSON schema keys required:",
        "summary, strengths, workOn, sevenDayPlan, friendNote",
        "Each of strengths/workOn/sevenDayPlan must be an array of short strings.",
        "",
        `Focus area: ${focus}`,
        `Period days: ${insights.periodDays}`,
        "",
        "Past snapshot:",
        JSON.stringify(insights.past),
        "",
        "Current snapshot:",
        JSON.stringify(insights.current),
        "",
        "Deltas:",
        JSON.stringify(insights.deltas),
        "",
        "Retrieved diary memories:",
        memoryBlock,
        "",
        "Task recommendations:",
        taskBlock,
        "",
        "Skill recommendations:",
        skillBlock,
        "",
        "Return only valid JSON."
    ].join("\n");
}

function buildRawDiaryAnalysisPrompt({ focus, periodDays, entries }) {
    const entryBlock = entries.length > 0
        ? entries.map((entry) => [
            `- date: ${entry.date || ""}`,
            `  title: ${entry.title || ""}`,
            `  workDone: ${entry.workDone || ""}`,
            `  highlights: ${entry.highlights || ""}`,
            `  nextStep: ${entry.nextStep || ""}`
        ].join("\n")).join("\n")
        : "- No diary entries found.";

    return [
        "Analyze the user's raw diary entries and return a helpful report in JSON.",
        "Use only the diary entries below.",
        "Do not add confidence scores, metrics, tasks, or outside factors.",
        "Use a supportive, practical, friend-like tone.",
        "Required JSON keys: summary, patterns, strengths, concerns, nextSteps, friendNote.",
        "Each of patterns, strengths, concerns, nextSteps must be an array of short strings.",
        "",
        `Focus area: ${focus}`,
        `Period days: ${periodDays}`,
        "",
        "Raw diary entries:",
        entryBlock,
        "",
        "Return only valid JSON."
    ].join("\n");
}

function tryParseJsonObject(text) {
    if (typeof text !== "string") {
        return null;
    }

    const trimmed = text.trim();
    if (!trimmed) {
        return null;
    }

    try {
        return JSON.parse(trimmed);
    } catch (_error) {
        // Continue with basic object extraction fallback.
    }

    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start < 0 || end <= start) {
        return null;
    }

    const candidate = trimmed.slice(start, end + 1);
    try {
        return JSON.parse(candidate);
    } catch (_error) {
        return null;
    }
}

async function buildDetailedPastVsCurrentReportForUser(userId, options = {}) {
    const requestedDays = Number(options.days);

    const entries = await readDiaryEntriesForUser(userId);
    const periodDays = Number.isFinite(requestedDays) ? Math.max(7, Math.min(365, Math.round(requestedDays))) : 60;
    const cutoff = new Date(Date.now() - periodDays * 86400000).toISOString().slice(0, 10);
    const rawEntries = entries
        .filter((entry) => entry && entry.date && entry.date >= cutoff)
        .map((entry) => ({
            id: entry.id,
            date: entry.date,
            title: entry.title,
            workDone: entry.workDone,
            highlights: entry.highlights || "",
            nextStep: entry.nextStep || "",
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt
        }));

    const fallback = {
        reportType: "raw-diary-analysis",
        summary: rawEntries.length > 0 ? "Raw diary entries collected successfully." : "No diary entries found for the selected period.",
        periodDays,
        totalEntries: rawEntries.length,
        entries: rawEntries,
        analysis: {
            patterns: [],
            strengths: [],
            concerns: [],
            nextSteps: [],
            friendNote: rawEntries.length > 0 ? "I can analyze these entries once the AI response is available." : "Add some diary entries first."
        }
    };

    if (rawEntries.length === 0) {
        return fallback;
    }

    const prompt = buildRawDiaryAnalysisPrompt({
        focus: typeof options.focus === "string" && options.focus.trim() ? options.focus.trim().slice(0, 120) : "overall growth",
        periodDays,
        entries: rawEntries
    });

    const aiText = await callDiaryModelTextByProvider({
        systemPrompt: "You are a supportive private diary coach. Output valid JSON only and use only the raw diary entries provided.",
        userPrompt: prompt,
        temperature: 0.2
    });

    if (!aiText) {
        throw new Error("AI model returned no response. Check AI_PROVIDER and the matching API key in .env.");
    }

    const aiJson = tryParseJsonObject(aiText);
    if (!aiJson || typeof aiJson !== "object") {
        throw new Error("AI model returned an invalid JSON report. Check the model output format.");
    }

    return {
        reportType: "raw-diary-analysis",
        summary: typeof aiJson.summary === "string" && aiJson.summary.trim() ? aiJson.summary.trim() : fallback.summary,
        periodDays,
        totalEntries: rawEntries.length,
        entries: rawEntries,
        analysis: {
            patterns: Array.isArray(aiJson.patterns) ? aiJson.patterns.map((item) => String(item)).filter(Boolean).slice(0, 8) : [],
            strengths: Array.isArray(aiJson.strengths) ? aiJson.strengths.map((item) => String(item)).filter(Boolean).slice(0, 8) : [],
            concerns: Array.isArray(aiJson.concerns) ? aiJson.concerns.map((item) => String(item)).filter(Boolean).slice(0, 8) : [],
            nextSteps: Array.isArray(aiJson.nextSteps) ? aiJson.nextSteps.map((item) => String(item)).filter(Boolean).slice(0, 8) : [],
            friendNote: typeof aiJson.friendNote === "string" && aiJson.friendNote.trim() ? aiJson.friendNote.trim() : fallback.analysis.friendNote
        }
    };
}

async function buildDiaryChatResponseForUser(userId, message) {
    const entries = await readDiaryEntriesForUser(userId);
    const stateJson = await readSavedTrackerStateForUser(userId);
    const tasks = buildTaskRecommendations(stateJson);
    const memories = await getDiaryMemoryContext(userId, message);
    const skills = buildSkillRecommendations(stateJson, memories.map((item) => item.snippet || item.title || ""));

    const fallback = buildDiaryFallbackResponse(entries, memories, tasks, skills);

    try {
        const answer = await callDiaryCoachModel({
            message,
            memories,
            tasks,
            skills,
            trackerSummary: JSON.stringify({
                subjectCount: Array.isArray(stateJson && stateJson.subjects) ? stateJson.subjects.length : 0,
                pendingTaskCount: tasks.length,
                skills: skills.map((skill) => skill.name)
            })
        });

        if (!answer) {
            return fallback;
        }

        return {
            answer,
            memories,
            tasks,
            skills
        };
    } catch (error) {
        if (!warnedAboutOpenAi) {
            warnedAboutOpenAi = true;
            console.warn("[openai] Falling back to heuristic diary response.", error.message || error);
        }

        return fallback;
    }
}

async function ensureDiaryEntriesSchema() {
    const foreignKeys = await all("PRAGMA foreign_key_list(diary_entries)");
    const hasCrossDatabaseUserForeignKey = foreignKeys.some((foreignKey) => foreignKey && foreignKey.table === "users");

    if (!hasCrossDatabaseUserForeignKey) {
        return;
    }

    await run(`
        CREATE TABLE IF NOT EXISTS diary_entries_rebuilt (
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
        )
    `);

    await run(`
        INSERT OR REPLACE INTO diary_entries_rebuilt (
            id,
            user_id,
            entry_date,
            title,
            work_done,
            highlights,
            next_step,
            created_at,
            updated_at
        )
        SELECT
            id,
            user_id,
            entry_date,
            title,
            work_done,
            highlights,
            next_step,
            created_at,
            updated_at
        FROM diary_entries
    `);

    await run("DROP TABLE diary_entries");
    await run("ALTER TABLE diary_entries_rebuilt RENAME TO diary_entries");
    await run("CREATE INDEX IF NOT EXISTS idx_diary_entries_user_date ON diary_entries(user_id, entry_date DESC)");
}

function dateDiffInDays(startKey, endKey) {
    const start = new Date(`${startKey}T00:00:00Z`);
    const end = new Date(`${endKey}T00:00:00Z`);
    return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function getTaskLoggedMinutes(stateJson, subject) {
    if (!stateJson || !subject || typeof stateJson !== "object") {
        return 0;
    }

    const targetFrequency = subject.frequency === "singleton" ? "singleton" : "everyday";

    if (targetFrequency === "singleton") {
        if (!stateJson.logs || typeof stateJson.logs !== "object") {
            return 0;
        }

        return Object.values(stateJson.logs).reduce((sum, dailyLog) => {
            return sum + (Number(dailyLog && dailyLog[subject.id]) || 0);
        }, 0);
    }

    const todayKey = getTodayKey();
    return Number((stateJson.logs && stateJson.logs[todayKey] && stateJson.logs[todayKey][subject.id]) || 0);
}

function isTaskCompleted(stateJson, subject) {
    if (!subject) {
        return false;
    }

    const target = Number(subject.target) || 0;
    if (target <= 0) {
        return false;
    }

    return getTaskLoggedMinutes(stateJson, subject) >= target;
}

function collectReminderCandidates(stateJson, ownerLabel = null, userId = null) {
    if (!stateJson || typeof stateJson !== "object" || !Array.isArray(stateJson.subjects)) {
        return [];
    }

    const todayKey = getTodayKey();
    const candidates = [];

    stateJson.subjects.forEach((subject) => {
        if (!subject || !subject.id || !subject.subject) {
            return;
        }

        const dueDate = normalizeDateKey(subject.dueDate);
        if (!dueDate) {
            return;
        }

        if (subject.frequency === "everyday" && dueDate <= todayKey) {
            return;
        }

        if (isLegacyCreationDateDeadline(subject, dueDate)) {
            return;
        }

        if (isTaskCompleted(stateJson, subject)) {
            return;
        }

        const daysUntilDue = dateDiffInDays(todayKey, dueDate);
        let reminderType = null;

        if (daysUntilDue === 0) {
            reminderType = "due-today";
        } else if (daysUntilDue > 0 && daysUntilDue <= 3) {
            reminderType = "due-soon";
        } else if (daysUntilDue < 0) {
            reminderType = "overdue";
        }

        if (!reminderType) {
            return;
        }

        candidates.push({
            userId,
            ownerLabel,
            taskId: subject.id,
            subjectName: subject.subject,
            dueDate,
            reminderType,
            daysUntilDue
        });
    });

    return candidates;
}

function isLegacyCreationDateDeadline(subject, dueDate) {
    if (!subject || subject.frequency !== "everyday") {
        return false;
    }

    if (typeof subject.id !== "string" || !subject.id.startsWith("sub-")) {
        return false;
    }

    const timestamp = Number(subject.id.slice(4).split("-")[0]);
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
        return false;
    }

    const createdDay = new Date(timestamp).toISOString().slice(0, 10);
    return createdDay === dueDate;
}

function buildReminderEmailText(reminders) {
    const header = [
        "Task reminder summary:",
        ""
    ];

    const lines = reminders.map((item) => {
        const ownerPrefix = item.ownerLabel ? `[${item.ownerLabel}] ` : "";

        if (item.reminderType === "due-today") {
            return `- ${ownerPrefix}${item.subjectName}: due today (${item.dueDate}) and still pending`;
        }

        if (item.reminderType === "due-soon") {
            return `- ${ownerPrefix}${item.subjectName}: due in ${item.daysUntilDue} day(s) on ${item.dueDate} and still pending`;
        }

        return `- ${ownerPrefix}${item.subjectName}: overdue by ${Math.abs(item.daysUntilDue)} day(s), due date was ${item.dueDate}, still pending`;
    });

    return `${header.concat(lines).join("\n")}\n`;
}

async function sendReminderEmail(reminders) {
    const host = process.env.SMTP_HOST;
    const to = process.env.REMINDER_EMAIL_TO;
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;

    if (!host || !to || !from) {
        if (!hasLoggedReminderConfigWarning) {
            hasLoggedReminderConfigWarning = true;
            console.warn(
                "[reminders] Missing SMTP_HOST/REMINDER_EMAIL_TO/SMTP_FROM (or SMTP_USER). Reminder emails are disabled."
            );
        }
        return false;
    }

    const portValue = Number(process.env.SMTP_PORT || 587);
    const secure = process.env.SMTP_SECURE === "true" || portValue === 465;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    const transportOptions = {
        host,
        port: portValue,
        secure
    };

    if (user) {
        transportOptions.auth = {
            user,
            pass: pass || ""
        };
    }

    const transporter = nodemailer.createTransport(transportOptions);

    const subject = `Study task reminder (${reminders.length} pending)`;
    const text = buildReminderEmailText(reminders);

    await transporter.sendMail({
        from,
        to,
        subject,
        text
    });

    return true;
}

async function readSavedTrackerStateForUser(userId) {
    const numericUserId = Number(userId);
    if (!Number.isFinite(numericUserId) || numericUserId <= 0) {
        return null;
    }

    const row = await get("SELECT state_json FROM user_state WHERE user_id = ?", [numericUserId]);
    if (!row || !row.state_json) {
        return null;
    }

    try {
        return JSON.parse(row.state_json);
    } catch (_error) {
        return null;
    }
}

async function readAllSavedTrackerStates() {
    const rows = await all("SELECT user_id, state_json FROM user_state");
    const states = [];

    for (const row of rows) {
        if (!row || !row.state_json) {
            continue;
        }

        try {
            states.push({
                userId: Number(row.user_id),
                state: JSON.parse(row.state_json)
            });
        } catch (_error) {
            // Ignore malformed rows and continue scanning the rest.
        }
    }

    return states;
}

function describeReminderType(item) {
    if (item.reminderType === "due-today") {
        return "Due today and still pending";
    }

    if (item.reminderType === "due-soon") {
        return `Due in ${item.daysUntilDue} day(s) and still pending`;
    }

    return `Overdue by ${Math.abs(item.daysUntilDue)} day(s) and still pending`;
}

async function scanAndSendTaskReminders() {
    try {
        const savedStates = await readAllSavedTrackerStates();
        if (savedStates.length === 0) {
            return;
        }

        const unsent = [];

        for (const entry of savedStates) {
            const userRow = await authGet("SELECT id, display_name, username FROM users WHERE id = ? LIMIT 1", [entry.userId]);
            const ownerLabel = userRow ? (userRow.display_name || userRow.username) : `User ${entry.userId}`;
            const candidates = collectReminderCandidates(entry.state, ownerLabel, entry.userId);

            for (const candidate of candidates) {
                const existing = await get(
                    "SELECT id FROM reminders_sent WHERE user_id = ? AND task_id = ? AND due_date = ? AND reminder_type = ?",
                    [candidate.userId, candidate.taskId, candidate.dueDate, candidate.reminderType]
                );

                if (!existing) {
                    unsent.push(candidate);
                }
            }
        }

        if (unsent.length === 0) {
            return;
        }

        const sent = await sendReminderEmail(unsent);
        if (!sent) {
            return;
        }

        const sentAt = new Date().toISOString();
        await Promise.all(
            unsent.map((item) =>
                run(
                    "INSERT OR IGNORE INTO reminders_sent (user_id, task_id, due_date, reminder_type, sent_at) VALUES (?, ?, ?, ?, ?)",
                    [item.userId, item.taskId, item.dueDate, item.reminderType, sentAt]
                )
            )
        );

        console.log(`[reminders] Sent ${unsent.length} reminder email item(s).`);
    } catch (error) {
        console.error("[reminders] Failed reminder scan", error);
    }
}

async function shouldRunReminderScanToday() {
    const row = await get("SELECT last_scan_date FROM reminder_scan_state WHERE id = 1");
    const todayKey = getTodayKey();

    if (!row || !row.last_scan_date) {
        return true;
    }

    return row.last_scan_date !== todayKey;
}

async function markReminderScanCompleted() {
    const now = new Date().toISOString();
    const todayKey = getTodayKey();

    await run(
        `
      INSERT INTO reminder_scan_state (id, last_scan_date, last_scan_at)
      VALUES (1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        last_scan_date = excluded.last_scan_date,
        last_scan_at = excluded.last_scan_at
      `,
        [todayKey, now]
    );
}

async function runDailyReminderScanIfNeeded() {
    const shouldRun = await shouldRunReminderScanToday();

    if (!shouldRun) {
        console.log("[reminders] Daily scan already completed today; skipping.");
        return;
    }

    await scanAndSendTaskReminders();
    await markReminderScanCompleted();
    console.log("[reminders] Daily startup scan completed.");
}

app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_request, response) => {
    response.json({ ok: true });
});

app.get("/api/me", async (request, response) => {
    try {
        const user = await getUserFromRequest(request);
        if (!user) {
            response.json({ user: null });
            return;
        }

        response.json({
            user: {
                id: user.id,
                username: user.username,
                displayName: user.displayName,
                isGuest: user.isGuest
            }
        });
    } catch (error) {
        response.status(500).json({ error: "Failed to read session" });
    }
});

app.post("/api/auth/register", async (request, response) => {
    try {
        const username = typeof request.body?.username === "string" ? request.body.username.trim().toLowerCase() : "";
        const displayName = typeof request.body?.displayName === "string" ? request.body.displayName.trim() : "";
        const password = typeof request.body?.password === "string" ? request.body.password : "";

        if (!/^[a-z0-9_]{3,32}$/.test(username)) {
            response.status(400).json({ error: "Username must be 3-32 characters and use letters, numbers, or underscores." });
            return;
        }

        if (username === GUEST_USERNAME) {
            response.status(400).json({ error: "That username is reserved for the guest demo account." });
            return;
        }

        if (password.length < 8) {
            response.status(400).json({ error: "Password must be at least 8 characters long." });
            return;
        }

        const resolvedDisplayName = displayName || username;
        const existing = await getUserByUsername(username);
        if (existing) {
            response.status(409).json({ error: "That username is already taken." });
            return;
        }

        const passwordRecord = createPasswordRecord(password);
        const createdAt = new Date().toISOString();
        const result = await authRun(
            `
            INSERT INTO users (username, display_name, password_hash, password_salt, is_guest, created_at)
            VALUES (?, ?, ?, ?, 0, ?)
            `,
            [username, resolvedDisplayName, passwordRecord.hash, passwordRecord.salt, createdAt]
        );

        const session = await createSession(result.lastInsertRowid);
        await setSessionCookie(response, session.token, session.expiresAt);

        response.status(201).json({
            ok: true,
            user: {
                id: result.lastID,
                username,
                displayName: resolvedDisplayName,
                isGuest: false
            }
        });
    } catch (error) {
        response.status(500).json({ error: "Failed to register user" });
    }
});

app.post("/api/auth/login", async (request, response) => {
    try {
        const username = typeof request.body?.username === "string" ? request.body.username.trim().toLowerCase() : "";
        const password = typeof request.body?.password === "string" ? request.body.password : "";

        if (!username || !password) {
            response.status(400).json({ error: "Username and password are required." });
            return;
        }

        const user = await authGet("SELECT id, username, display_name, password_hash, password_salt, is_guest FROM users WHERE username = ? LIMIT 1", [username]);
        if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) {
            response.status(401).json({ error: "Invalid username or password." });
            return;
        }

        const session = await createSession(user.id);
        await setSessionCookie(response, session.token, session.expiresAt);

        response.json({
            ok: true,
            user: {
                id: user.id,
                username: user.username,
                displayName: user.display_name || user.username,
                isGuest: Number(user.is_guest) === 1
            }
        });
    } catch (error) {
        response.status(500).json({ error: "Failed to sign in" });
    }
});

app.post("/api/auth/logout", async (request, response) => {
    try {
        const token = getSessionTokenFromRequest(request);
        if (token) {
            await authRun("DELETE FROM sessions WHERE token_hash = ?", [hashSessionToken(token)]);
        }

        await clearSessionCookie(response);
        response.json({ ok: true });
    } catch (error) {
        response.status(500).json({ error: "Failed to log out" });
    }
});

app.get("/api/reminders/pending", requireAuth, async (request, response) => {
    try {
        const parsed = await readSavedTrackerStateForUser(request.currentUser.id);
        const candidates = collectReminderCandidates(parsed)
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
            .map((item) => ({
                taskId: item.taskId,
                subjectName: item.subjectName,
                dueDate: item.dueDate,
                reminderType: item.reminderType,
                daysUntilDue: item.daysUntilDue,
                message: describeReminderType(item)
            }));

        response.json({
            ok: true,
            date: getTodayKey(),
            pending: candidates,
            count: candidates.length
        });
    } catch (error) {
        response.status(500).json({ error: "Failed to fetch pending reminders" });
    }
});

app.get("/api/state", requireAuth, async (request, response) => {
    try {
        const row = await get("SELECT state_json, updated_at FROM user_state WHERE user_id = ?", [request.currentUser.id]);

        if (!row) {
            response.json({ state: null, updatedAt: null });
            return;
        }

        let parsedState = null;
        try {
            parsedState = JSON.parse(row.state_json);
        } catch (_error) {
            parsedState = null;
        }

        // Phase 3: Load subjects exclusively from SUBJECTS table
        if (parsedState) {
            try {
                const subjects = await all(
                    "SELECT id, subject, target, frequency, due_date, skill_tags, factor_tags, archived FROM subjects WHERE user_id = ?",
                    [request.currentUser.id]
                );
                parsedState.subjects = subjects.map(s => ({
                    id: s.id,
                    subject: s.subject,
                    target: s.target,
                    frequency: s.frequency,
                    dueDate: s.due_date,
                    skillTags: s.skill_tags ? JSON.parse(s.skill_tags) : [],
                    factorTags: s.factor_tags ? JSON.parse(s.factor_tags) : [],
                    archived: Boolean(s.archived)
                }));
            } catch (error) {
                console.warn("[Phase3] Failed to load subjects from SUBJECTS table:", error);
            }
        }

        response.json({
            state: parsedState,
            updatedAt: row.updated_at
        });
    } catch (error) {
        response.status(500).json({ error: "Failed to read state" });
    }
});

app.get("/api/diary", requireAuth, async (request, response) => {
    try {
        const entries = await readDiaryEntriesForUser(request.currentUser.id);
        response.json({ entries });
    } catch (error) {
        response.status(500).json({ error: "Failed to read diary entries" });
    }
});

app.post("/api/diary", requireAuth, async (request, response) => {
    try {
        const entry = normalizeDiaryPayload(request.body);
        if (!entry) {
            response.status(400).json({ error: "Invalid payload. Expected date, title, and workDone." });
            return;
        }

        const now = new Date().toISOString();

        await run(
            `
            INSERT INTO diary_entries (
                user_id,
                entry_date,
                title,
                work_done,
                highlights,
                next_step,
                created_at,
                updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, entry_date) DO UPDATE SET
                title = excluded.title,
                work_done = excluded.work_done,
                highlights = excluded.highlights,
                next_step = excluded.next_step,
                updated_at = excluded.updated_at
            `,
            [
                request.currentUser.id,
                entry.date,
                entry.title,
                entry.workDone,
                entry.highlights,
                entry.nextStep,
                now,
                now
            ]
        );

        const row = await get(
            `
            SELECT id, entry_date, title, work_done, highlights, next_step, created_at, updated_at
            FROM diary_entries
            WHERE user_id = ? AND entry_date = ?
            LIMIT 1
            `,
            [request.currentUser.id, entry.date]
        );

        if (row) {
            await writeDiaryEntryToMempalace(request.currentUser.id, {
                id: row.id,
                date: row.entry_date,
                title: row.title,
                workDone: row.work_done,
                highlights: row.highlights,
                nextStep: row.next_step
            });
        }

        response.json({ ok: true, entry: formatDiaryEntry(row) });
    } catch (error) {
        response.status(500).json({ error: "Failed to save diary entry" });
    }
});

app.put("/api/diary/:id", requireAuth, async (request, response) => {
    try {
        const entry = normalizeDiaryPayload(request.body);
        if (!entry) {
            response.status(400).json({ error: "Invalid payload. Expected date, title, and workDone." });
            return;
        }

        const existing = await readDiaryEntryById(request.currentUser.id, request.params.id);
        if (!existing) {
            response.status(404).json({ error: "Diary entry not found" });
            return;
        }

        const now = new Date().toISOString();
        await run(
            `
            UPDATE diary_entries
            SET entry_date = ?,
                title = ?,
                work_done = ?,
                highlights = ?,
                next_step = ?,
                updated_at = ?
            WHERE user_id = ? AND id = ?
            `,
            [
                entry.date,
                entry.title,
                entry.workDone,
                entry.highlights,
                entry.nextStep,
                now,
                request.currentUser.id,
                request.params.id
            ]
        );

        const row = await readDiaryEntryById(request.currentUser.id, request.params.id);
        if (row) {
            await writeDiaryEntryToMempalace(request.currentUser.id, {
                id: row.id,
                date: row.date,
                title: row.title,
                workDone: row.workDone,
                highlights: row.highlights,
                nextStep: row.nextStep
            });
        }

        response.json({ ok: true, entry: row });
    } catch (error) {
        if (String(error && error.message || "").includes("UNIQUE constraint failed")) {
            response.status(409).json({ error: "A diary entry already exists for that date." });
            return;
        }

        response.status(500).json({ error: "Failed to update diary entry" });
    }
});

app.delete("/api/diary/:id", requireAuth, async (request, response) => {
    try {
        const existing = await readDiaryEntryById(request.currentUser.id, request.params.id);
        if (!existing) {
            response.status(404).json({ error: "Diary entry not found" });
            return;
        }

        await removeDiaryEntryFromMempalace(request.currentUser.id, request.params.id);
        await run("DELETE FROM diary_entries WHERE user_id = ? AND id = ?", [request.currentUser.id, request.params.id]);
        response.json({ ok: true });
    } catch (error) {
        response.status(500).json({ error: "Failed to delete diary entry" });
    }
});

app.post("/api/chatbot/diary", requireAuth, async (request, response) => {
    try {
        const message = typeof request.body?.message === "string" ? request.body.message.trim() : "";
        if (!message) {
            response.status(400).json({ error: "Message is required." });
            return;
        }

        const result = await buildDiaryChatResponseForUser(request.currentUser.id, message);
        response.json({ ok: true, result });
    } catch (error) {
        response.status(500).json({ error: "Failed to generate diary chat response" });
    }
});

app.get("/api/diary/insights/latest", requireAuth, async (request, response) => {
    try {
        const entries = await readDiaryEntriesForUser(request.currentUser.id);
        const latest = entries[0];

        if (!latest) {
            response.json({ ok: true, result: null });
            return;
        }

        const query = `${latest.title} ${latest.workDone} ${latest.highlights || ""} ${latest.nextStep || ""}`;
        const result = await buildDiaryChatResponseForUser(request.currentUser.id, query);
        response.json({ ok: true, result });
    } catch (error) {
        response.status(500).json({ error: "Failed to generate latest diary insights" });
    }
});

app.post("/api/diary/report/past-vs-current", requireAuth, async (request, response) => {
    try {
        const payload = request.body && typeof request.body === "object" ? request.body : {};
        const result = await buildDetailedPastVsCurrentReportForUser(request.currentUser.id, {
            days: payload.days,
            focus: payload.focus
        });

        response.json({ ok: true, result });
    } catch (error) {
        response.status(500).json({
            error: error && error.message ? error.message : "AI model failed while generating the diary report."
        });
    }
});

app.put("/api/state", requireAuth, async (request, response) => {
    try {
        const incomingState = request.body && request.body.state;
        if (!incomingState || typeof incomingState !== "object") {
            response.status(400).json({ error: "Invalid payload. Expected { state: object }." });
            return;
        }

        const now = new Date().toISOString();

        // Store state without subjects (subjects are now separate)
        const stateWithoutSubjects = { ...incomingState };
        delete stateWithoutSubjects.subjects;

        await run(
            `
        INSERT INTO user_state (user_id, state_json, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
        state_json = excluded.state_json,
        updated_at = excluded.updated_at
      `,
            [request.currentUser.id, JSON.stringify(stateWithoutSubjects), now]
        );

        // Phase 3: Write subjects exclusively to SUBJECTS table (upsert pattern)
        const subjects = incomingState.subjects || [];
        const existingSubjects = await all("SELECT id FROM subjects WHERE user_id = ?", [request.currentUser.id]);
        const existingIds = new Set(existingSubjects.map(s => s.id));

        for (const subject of subjects) {
            const id = subject.id || `subject-${request.currentUser.id}-${Date.now()}`;
            const skillTags = subject.skillTags ? JSON.stringify(subject.skillTags) : null;
            const factorTags = subject.factorTags ? JSON.stringify(subject.factorTags) : null;

            if (existingIds.has(id)) {
                await run(
                    `UPDATE subjects SET subject = ?, target = ?, frequency = ?, due_date = ?, skill_tags = ?, factor_tags = ?, archived = ?, updated_at = ?
                     WHERE id = ? AND user_id = ?`,
                    [subject.subject, subject.target, subject.frequency, subject.dueDate, skillTags, factorTags, subject.archived ? 1 : 0, now, id, request.currentUser.id]
                );
            } else {
                await run(
                    `INSERT INTO subjects (id, user_id, subject, target, frequency, due_date, skill_tags, factor_tags, archived, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [id, request.currentUser.id, subject.subject, subject.target, subject.frequency, subject.dueDate, skillTags, factorTags, subject.archived ? 1 : 0, now, now]
                );
            }
        }

        // Delete removed subjects
        const incomingIds = new Set(subjects.map(s => s.id));
        const toDelete = Array.from(existingIds).filter(id => !incomingIds.has(id));
        for (const id of toDelete) {
            await run("DELETE FROM subjects WHERE id = ? AND user_id = ?", [id, request.currentUser.id]);
        }

        response.json({ ok: true, updatedAt: now });
    } catch (error) {
        response.status(500).json({ error: "Failed to save state" });
    }
});

app.use(express.static(staticDir));

app.get("/", (_request, response) => {
    response.redirect("/tracker");
});

app.get("/tracker", (_request, response) => {
    response.sendFile(path.join(staticDir, "pages", "index.html"));
});

app.get("/reports", (_request, response) => {
    response.sendFile(path.join(staticDir, "pages", "reports.html"));
});

app.get("/blog", (_request, response) => {
    response.sendFile(path.join(staticDir, "pages", "daily-blog.html"));
});

app.get("/skill-radar", (_request, response) => {
    response.sendFile(path.join(staticDir, "pages", "skill-radar.html"));
});

app.get("*", (_request, response) => {
    response.sendFile(path.join(staticDir, "pages", "index.html"));
});

async function start() {
    await initDb();
    await ensureMempalaceStore();
    await seedDiaryMemoriesFromDatabase();
    await runDailyReminderScanIfNeeded();
    logAiProviderDiagnostics();

    app.listen(port, () => {
        console.log(`Study tracker backend running at http://localhost:${port}`);
        console.log(`Database file: ${dbPath}`);
        console.log("[reminders] Mode: one scan per day on first server start.");
    });
}

start().catch((error) => {
    console.error("Failed to start server", error);
    process.exit(1);
});

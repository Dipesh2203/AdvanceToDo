//#region
const STORE_KEY_BASE = "study-tracker-v1";
const THEME_KEY = "study-tracker-theme";
const API_STATE_ENDPOINT = "/api/state";
const API_PENDING_REMINDERS_ENDPOINT = "/api/reminders/pending";
const API_ME_ENDPOINT = "/api/me";
const API_LOGIN_ENDPOINT = "/api/auth/login";
const API_REGISTER_ENDPOINT = "/api/auth/register";
const API_LOGOUT_ENDPOINT = "/api/auth/logout";
const SAVE_DEBOUNCE_MS = 500;
//#endregion


export const state = {
    subjects: [],
    logs: {},
    factorLogs: {},
    sessions: {},
    activeTimers: {},
    reworkPlans: {}
};

//#region
const timerTargetAlerts = {};
const taskCompletionAlerts = {};
let pendingSaveTimer = null;
let notificationServiceWorkerRegistration = null;
let inlineSpendEditorSubjectId = null;
let currentStoreKey = STORE_KEY_BASE;
let taskPipWindowRef = null;
let taskPipSubjectId = null;
//#endregion

export const authState = {
    user: null,
    loading: true
};


//#region
let authOverlayEl = null;
let authStatusEl = null;
let authScreenMessageEl = null;
let authLoginFormEl = null;
let authRegisterFormEl = null;
let authGuestButtonEl = null;
let authLogoutButtonEl = null;
let authUserBadgeEl = null;
let authAppBlockedClassApplied = false;
//#endregion

const todayKey = formatDateKey(new Date());
const skillTagMasterList = [
    "communication",
    "active listening",
    "clarity",
    "empathy",
    "confidence",
    "feedback handling",
    "leadership",
    "vision",
    "delegation",
    "decision quality",
    "coaching",
    "accountability",
    "trust building",
    "problem solving",
    "analysis",
    "creativity",
    "prioritization",
    "execution speed",
    "learning from mistakes"
];
const factorTagMasterList = [
    "active listening",
    "listening",
    "clarity",
    "empathy",
    "confidence",
    "feedback handling",
    "vision",
    "delegation",
    "decision quality",
    "coaching",
    "accountability",
    "trust building",
    "analysis",
    "creativity",
    "prioritization",
    "execution speed",
    "learning from mistakes"
];
const logFilterState = {
    range: "today",
    customDate: todayKey
};

const taskTimeFilterState = {
    range: "today",
    customDate: todayKey,
    subjectId: "all"
};

//#region Tracker page elements
const planForm = document.getElementById("planForm");
const subjectInput = document.getElementById("subjectInput");
const targetInput = document.getElementById("targetInput");
const frequencyInput = document.getElementById("frequencyInput");
const deadlineToggleInput = document.getElementById("deadlineToggleInput");
const dueDateInput = document.getElementById("dueDateInput");
const skillTagsInput = document.getElementById("skillTagsInput");
const factorTagsInput = document.getElementById("factorTagsInput");
const skillTagSuggestionsEl = document.getElementById("skillTagSuggestions");
const factorTagSuggestionsEl = document.getElementById("factorTagSuggestions");
const planList = document.getElementById("planList");
const checkPendingButtonEl = document.getElementById("checkPendingButton");
const enableNotificationsButtonEl = document.getElementById("enableNotificationsButton");
const notificationPermissionStatusEl = document.getElementById("notificationPermissionStatus");
const pendingReminderStatusEl = document.getElementById("pendingReminderStatus");
const pendingReminderListEl = document.getElementById("pendingReminderList");
const logContainer = document.getElementById("logContainer");
const runningTasksListEl = document.getElementById("runningTasksList");
const logPrevButtonEl = document.getElementById("logPrevButton");
const logNextButtonEl = document.getElementById("logNextButton");
const logDotsEl = document.getElementById("logDots");
const completedTaskListEl = document.getElementById("completedTaskList");
const targetTotalEl = document.getElementById("targetTotal");
const completedTotalEl = document.getElementById("completedTotal");
const completionRateEl = document.getElementById("completionRate");
const sessionLogEl = document.getElementById("sessionLog");
const sessionDateEl = document.getElementById("sessionDate");
const logFilterDateEl = document.getElementById("logFilterDate");
const logFilterSummaryEl = document.getElementById("logFilterSummary");
const logFilterTagEls = Array.from(document.querySelectorAll("[data-log-filter]"));
const openPlanButtonEl = document.getElementById("openPlanButton");
const addTaskPanelEl = document.getElementById("addTaskPanel");
const openSpendTimeButtonEl = document.getElementById("openSpendTimeButton");
const spendTimePanelEl = document.getElementById("spendTimePanel");
const spendTimeFormEl = document.getElementById("spendTimeForm");
const spendSubjectSelectEl = document.getElementById("spendSubjectSelect");
const spendFactorSelectEl = document.getElementById("spendFactorSelect");
const spendMinutesInputEl = document.getElementById("spendMinutesInput");
const taskTimeLogListEl = document.getElementById("taskTimeLogList");
const taskTimeSummaryEl = document.getElementById("taskTimeSummary");
const taskTimeFilterDateEl = document.getElementById("taskTimeFilterDate");
const taskTimeSubjectFilterEl = document.getElementById("taskTimeSubjectFilter");
const taskTimeFilterTagEls = Array.from(document.querySelectorAll("[data-task-time-filter]"));
//#endregion Tracker page elements

//#region My Variables
//#Dashboard/Reports page elements (may be null on tracker page)
const progressBarEl = document.getElementById("progressBar");
const currentStreakEl = document.getElementById("currentStreak");
const bestStreakEl = document.getElementById("bestStreak");
const activeDaysEl = document.getElementById("activeDays");
const analysisChartEl = document.getElementById("analysisChart");
const analysisTextEl = document.getElementById("analysisText");
const attentionListEl = document.getElementById("attentionList");
const attentionSummaryEl = document.getElementById("attentionSummary");
const activityTimelineListEl = document.getElementById("activityTimelineList");
const activityTimelineSubtitleEl = document.getElementById("activityTimelineSubtitle");
const todayLabelEl = document.getElementById("todayLabel");
const trackerTableBodyEl = document.getElementById("trackerTableBody");
const themeToggleEl = document.getElementById("themeToggle");
//#endregion


initialize().catch((error) => {
    console.error("Tracker initialization failed", error);
    render();
});

/**
 * @function initialize
 * @description Central bootstrap function for the application. 
 * * Execution Flow:
 * 1. UI Initialization: Sets up theme, sliders, and auth-related styling.
 * 2. Auth Check (Critical Path): Resolves user identity. If no user is found, 
 * it triggers the 'Auth Gate' (login screen) and halts further setup.
 * 3. Feature Setup: Once authenticated, it initializes:
 * - Notifications: SW registration and permission listeners.
 * - State Management: Loads persistent data and applies UI filters.
 * - Event Listeners: Attaches handlers for forms, navigation, and keyboard shortcuts (ESC).
 * 4. Background Loops: Starts a 1-second interval to monitor active timers, 
 * update Picture-in-Picture mode, and refresh logs if the user isn't typing.
 * 5. Final Render: Triggers the initial UI draw and yearly insights.
 * * @async
 * @returns {Promise<void>}
 * @throws Will log errors to console if service worker registration or state loading fails.
 */

async function initialize() {
    setupThemeToggle();
    setupTaskCardSlider();
    injectAuthStyles();
    setupAuthInterface();
    await resolveAuthState();

    if (!authState.user) {
        showAuthGate();
        updateAuthHeader();
        return;
    }

    await registerNotificationServiceWorker();
    setupNotificationActivation();
    setupAuthControls();
    await loadState();
    setupLogFilters();
    setupTaskTimeLogFilters();
    if (todayLabelEl) {
        todayLabelEl.textContent = new Date().toLocaleDateString(undefined, {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric"
        });
    }

    if (planForm) {
        planForm.addEventListener("submit", onAddPlan);
    }

    if (checkPendingButtonEl) {
        checkPendingButtonEl.addEventListener("click", () => {
            void checkPendingRemindersPreview();
        });
    }

    if (enableNotificationsButtonEl) {
        enableNotificationsButtonEl.addEventListener("click", async () => {
            await requestNotificationPermissionFromUser();
            updateNotificationPermissionStatus();
        });
    }

    if (logPrevButtonEl) {
        logPrevButtonEl.addEventListener("click", () => moveTaskCarousel(-1));
    }

    if (logNextButtonEl) {
        logNextButtonEl.addEventListener("click", () => moveTaskCarousel(1));
    }

    if (dueDateInput) {
        dueDateInput.min = todayKey;
    }

    if (deadlineToggleInput) {
        deadlineToggleInput.addEventListener("change", syncDueDateInputState);
    }

    if (dueDateInput) {
        dueDateInput.addEventListener("focus", () => {
            if (!dueDateInput.value) {
                dueDateInput.value = todayKey;
            }
        });
    }

    syncDueDateInputState();

    if (openPlanButtonEl && addTaskPanelEl) {
        openPlanButtonEl.addEventListener("click", toggleAddTaskPanel);
    }

    if (openSpendTimeButtonEl && spendTimePanelEl) {
        openSpendTimeButtonEl.addEventListener("click", toggleSpendTimePanel);
    }

    if (spendTimeFormEl) {
        spendTimeFormEl.addEventListener("submit", onSpendTimeSubmit);
    }

    if (spendSubjectSelectEl) {
        spendSubjectSelectEl.addEventListener("change", () => {
            refreshSpendFactorOptions();

            if (spendTimePanelEl && spendSubjectSelectEl.value) {
                spendTimePanelEl.dataset.activeSubjectId = spendSubjectSelectEl.value;
            }
        });
    }

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && addTaskPanelEl && !addTaskPanelEl.classList.contains("add-task-panel-hidden")) {
            closeAddTaskPanel();
        }

        if (event.key === "Escape" && spendTimePanelEl && spendTimePanelEl.classList.contains("is-open")) {
            closeSpendTimePanel();
        }
    });

    setInterval(() => {
        if (Object.keys(state.activeTimers).length === 0) {
            renderRunningTasks();
            refreshTaskPictureInPicture();
            return;
        }

        monitorRunningTimers();
        renderRunningTasks();
        refreshTaskPictureInPicture();

        if (!logContainer) {
            return;
        }

        const activeEl = document.activeElement;
        const isEditingLogInput = Boolean(activeEl && logContainer.contains(activeEl) && activeEl.tagName === "INPUT");

        if (!isEditingLogInput) {
            renderLogs();
        }
    }, 1000);

    updateNotificationPermissionStatus();
    render();
    renderYearInsightCard();
}

function renderYearInsightCard() {
    const statsEl = document.getElementById("yearInsightStats");
    const bestsEl = document.getElementById("yearInsightBests");
    if (!statsEl || !bestsEl) return;

    // Gather all logs and sessions for the current year
    const now = new Date();
    const year = now.getFullYear();
    const logs = state.logs || {};
    const sessions = state.sessions || {};
    let totalFocusTime = 0;
    let totalFocusDays = 0;
    let bestDay = 0;
    let bestDayDate = "";
    let bestMonth = 0;
    let bestMonthLabel = "";
    let bestWeek = 0;
    let bestWeekLabel = "";
    let totalSessions = 0;
    let sessionDays = new Set();
    let streaks = [];
    let currentStreak = 0;
    let bestStreak = 0;
    let prevDate = null;
    let weekMap = {};
    let monthMap = {};

    // Calculate per-day totals and streaks
    Object.keys(logs).forEach(dateKey => {
        if (!dateKey.startsWith(year + "-")) return;
        const bySubject = logs[dateKey] || {};
        const total = Object.values(bySubject).reduce((sum, v) => sum + (Number(v) || 0), 0);
        if (total > 0) {
            totalFocusTime += total;
            totalFocusDays++;
            sessionDays.add(dateKey);
            // Best day
            if (total > bestDay) {
                bestDay = total;
                bestDayDate = dateKey;
            }
            // Month
            const month = dateKey.slice(0, 7);
            monthMap[month] = (monthMap[month] || 0) + total;
            // Week (ISO week)
            const d = new Date(dateKey + "T00:00:00");
            const week = getISOWeek(d);
            const weekKey = `${d.getFullYear()}-W${week}`;
            weekMap[weekKey] = (weekMap[weekKey] || 0) + total;
        }
    });

    // Best month
    Object.entries(monthMap).forEach(([month, total]) => {
        if (total > bestMonth) {
            bestMonth = total;
            bestMonthLabel = month;
        }
    });
    // Best week
    Object.entries(weekMap).forEach(([week, total]) => {
        if (total > bestWeek) {
            bestWeek = total;
            bestWeekLabel = week;
        }
    });

    // Sessions
    Object.keys(sessions).forEach(dateKey => {
        if (!dateKey.startsWith(year + "-")) return;
        const arr = Array.isArray(sessions[dateKey]) ? sessions[dateKey] : [];
        totalSessions += arr.length;
    });
    const avgSessions = totalFocusDays > 0 ? (totalSessions / totalFocusDays).toFixed(2) : 0;

    // Streaks (ignore 0-day streaks)
    const sortedDays = Array.from(sessionDays).sort();
    let lastStreak = 0;
    for (let i = 0; i < sortedDays.length; i++) {
        if (i === 0 || diffDays(sortedDays[i - 1], sortedDays[i]) === 1) {
            lastStreak++;
        } else {
            if (lastStreak > 0) streaks.push(lastStreak);
            lastStreak = 1;
        }
    }
    if (lastStreak > 0) streaks.push(lastStreak);
    bestStreak = Math.max(...streaks, 0);

    // Render metrics
    statsEl.innerHTML = `
        <div><p>Total Focus Time</p><strong>${totalFocusTime} min</strong></div>
        <div><p>Total Focus Days</p><strong>${totalFocusDays}</strong></div>
        <div><p>Total Sessions</p><strong>${totalSessions}</strong></div>
        <div><p>Avg Sessions/Day</p><strong>${avgSessions}</strong></div>
        <div><p>Best Day</p><strong>${bestDay} min</strong><br><span style='font-size:0.8em;'>${bestDayDate}</span></div>
        <div><p>Best Month</p><strong>${bestMonth} min</strong><br><span style='font-size:0.8em;'>${bestMonthLabel}</span></div>
    `;
    bestsEl.innerHTML = `
        <div><p>Best Week</p><strong>${bestWeek} min</strong><br><span style='font-size:0.8em;'>${bestWeekLabel}</span></div>
        <div><p>Best Streak</p><strong>${bestStreak} days</strong></div>
    `;
}

// Helper: ISO week number
function getISOWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function setupTaskCardSlider() {
    if (!logContainer) {
        return;
    }

    let wheelLocked = false;

    logContainer.addEventListener("wheel", (event) => {
        if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
            return;
        }

        const cards = getTaskCarouselCards();
        if (cards.length <= 1) {
            return;
        }

        event.preventDefault();

        if (wheelLocked) {
            return;
        }

        wheelLocked = true;
        setTimeout(() => {
            wheelLocked = false;
        }, 220);

        const direction = event.deltaY > 0 ? 1 : -1;
        moveTaskCarousel(direction);
    }, { passive: false });
}

function injectAuthStyles() {
    if (document.getElementById("authStyles")) {
        return;
    }

    const style = document.createElement("style");
    style.id = "authStyles";
    style.textContent = `
        body.auth-locked .dashboard-shell {
            display: none !important;
        }

        .auth-overlay {
            position: fixed;
            inset: 0;
            z-index: 3000;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background: linear-gradient(135deg, rgba(240, 244, 248, 0.84), rgba(220, 232, 245, 0.94));
            backdrop-filter: blur(10px);
        }

        body.dark-theme .auth-overlay {
            background: linear-gradient(135deg, rgba(12, 14, 18, 0.88), rgba(28, 31, 36, 0.96));
        }

        .auth-overlay.is-visible {
            display: flex;
        }

        .auth-card {
            width: min(960px, 100%);
            border-radius: 30px;
            padding: 28px;
            background: linear-gradient(145deg, #f8fbff, #edf4ff);
            box-shadow: 0 24px 60px rgba(66, 88, 118, 0.22);
            border: 1px solid rgba(132, 157, 191, 0.2);
        }

        body.dark-theme .auth-card {
            background: linear-gradient(145deg, #1f2329, #2a2f36);
            box-shadow: 0 24px 60px rgba(6, 12, 22, 0.55);
            border-color: rgba(176, 183, 191, 0.16);
        }

        .auth-card h2 {
            margin: 0 0 10px;
            font-size: clamp(1.7rem, 4vw, 2.5rem);
        }

        .auth-card p {
            color: var(--text-secondary);
            margin: 0 0 18px;
        }

        .auth-layout {
            display: grid;
            grid-template-columns: 1.1fr 0.9fr;
            gap: 18px;
        }

        .auth-panel {
            border-radius: 24px;
            padding: 20px;
            background: linear-gradient(135deg, #f0f4f8, #ffffff);
            box-shadow: var(--shadow-inset);
            border: 1px solid rgba(140, 154, 177, 0.14);
        }

        body.dark-theme .auth-panel {
            background: linear-gradient(135deg, #22262c, #2c3138);
        }

        .auth-panel h3 {
            margin: 0 0 12px;
            font-size: 1rem;
        }

        .auth-form {
            display: grid;
            gap: 10px;
        }

        .auth-form input {
            width: 100%;
            padding: 12px 14px;
            border: none;
            border-radius: 16px;
            background: linear-gradient(135deg, #f0f4f8, #ffffff);
            box-shadow: var(--shadow-inset);
            color: var(--text-primary);
            font-family: inherit;
        }

        .auth-form input:focus {
            outline: none;
            box-shadow: var(--shadow-inset), 0 0 0 3px rgba(168, 213, 186, 0.25);
        }

        .auth-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 4px;
        }

        .auth-status {
            min-height: 1.2rem;
            color: var(--text-secondary);
            font-size: 0.85rem;
        }

        .auth-hint {
            font-size: 0.82rem;
            color: var(--text-secondary);
            margin-top: 10px;
        }

        .auth-guest-box {
            display: grid;
            gap: 12px;
            align-content: start;
        }

        .auth-guest-box .guest-card {
            border-radius: 20px;
            padding: 16px;
            background: linear-gradient(135deg, rgba(168, 213, 186, 0.12), rgba(168, 216, 234, 0.12));
            border: 1px solid rgba(140, 154, 177, 0.14);
        }

        .auth-header-controls {
            display: none;
            align-items: center;
            gap: 10px;
            position: fixed;
            top: 66px;
            right: 14px;
            z-index: 2200;
            padding: 8px;
            border-radius: 999px;
            background: rgba(245, 247, 250, 0.92);
            border: 1px solid rgba(140, 154, 177, 0.2);
            box-shadow: var(--shadow-inset);
            backdrop-filter: blur(4px);
        }

        .auth-user-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 14px;
            border-radius: 999px;
            background: var(--bg-primary);
            box-shadow: var(--shadow-light), var(--shadow-dark);
            color: var(--text-secondary);
            font-size: 0.85rem;
            font-weight: 600;
            max-width: min(52vw, 280px);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .auth-logout-btn {
            padding: 9px 14px;
            border: none;
            border-radius: 999px;
            background: linear-gradient(135deg, #ff8f6b, #ff6a88);
            color: #ffffff;
            box-shadow: var(--shadow-inset);
            font-weight: 700;
            cursor: pointer;
        }

        body.dark-theme .auth-header-controls {
            background: rgba(37, 50, 71, 0.92);
            border-color: rgba(132, 157, 191, 0.24);
        }

        @media (max-width: 760px) {
            .auth-layout {
                grid-template-columns: 1fr;
            }

            .auth-card {
                padding: 20px;
            }

            .auth-header-controls {
                top: 60px;
                right: 8px;
                left: 8px;
                justify-content: space-between;
            }

            .auth-user-badge {
                max-width: 68vw;
            }
        }
    `;
    document.head.appendChild(style);
}

function setupAuthInterface() {
    if (!authOverlayEl) {
        authOverlayEl = document.createElement("section");
        authOverlayEl.id = "authOverlay";
        authOverlayEl.className = "auth-overlay";
        authOverlayEl.innerHTML = `
            <div class="auth-card">
                <h2>Sign in to continue</h2>
                <p>Use your account to keep tasks, sessions, and reports separate.</p>
                <div class="auth-layout">
                    <div class="auth-panel">
                        <h3>Log in</h3>
                        <form id="authLoginForm" class="auth-form">
                            <input id="authLoginUsername" name="username" type="text" autocomplete="username" placeholder="Username" required />
                            <input id="authLoginPassword" name="password" type="password" autocomplete="current-password" placeholder="Password" required />
                            <div class="auth-actions">
                                <button class="btn btn-primary" type="submit">Log in</button>
                            </div>
                        </form>
                        <div class="auth-hint">Demo account: guest / guest123</div>
                    </div>
                    <div class="auth-guest-box">
                        <div class="auth-panel">
                            <h3>Create account</h3>
                            <form id="authRegisterForm" class="auth-form">
                                <input id="authRegisterUsername" name="username" type="text" autocomplete="username" placeholder="Username" required />
                                <input id="authRegisterDisplayName" name="displayName" type="text" autocomplete="name" placeholder="Display name" />
                                <input id="authRegisterPassword" name="password" type="password" autocomplete="new-password" placeholder="Password" required />
                                <div class="auth-actions">
                                    <button class="btn btn-primary" type="submit">Register</button>
                                </div>
                            </form>
                        </div>
                        <div class="guest-card">
                            <strong>Guest demo</strong>
                            <p style="margin-top: 6px;">Use the preloaded guest account to explore the current tracker data without creating a profile.</p>
                            <button id="authGuestButton" class="btn" type="button">Continue as Guest</button>
                        </div>
                        <div id="authStatus" class="auth-status"></div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertBefore(authOverlayEl, document.body.firstChild);
    }

    if (!authUserBadgeEl || !authLogoutButtonEl) {
        const headerRow = document.querySelector(".header-row");
        if (headerRow) {
            const controls = document.createElement("div");
            controls.className = "auth-header-controls";
            controls.innerHTML = `
                <span id="authUserBadge" class="auth-user-badge"></span>
                <button id="authLogoutButton" class="auth-logout-btn" type="button">Logout</button>
            `;
            headerRow.appendChild(controls);
            authUserBadgeEl = controls.querySelector("#authUserBadge");
            authLogoutButtonEl = controls.querySelector("#authLogoutButton");
        }
    }

    authStatusEl = authOverlayEl.querySelector("#authStatus");
    authScreenMessageEl = authStatusEl;
    authLoginFormEl = authOverlayEl.querySelector("#authLoginForm");
    authRegisterFormEl = authOverlayEl.querySelector("#authRegisterForm");
    authGuestButtonEl = authOverlayEl.querySelector("#authGuestButton");

    if (authLoginFormEl) {
        authLoginFormEl.addEventListener("submit", onAuthLoginSubmit);
    }

    if (authRegisterFormEl) {
        authRegisterFormEl.addEventListener("submit", onAuthRegisterSubmit);
    }

    if (authGuestButtonEl) {
        authGuestButtonEl.addEventListener("click", () => {
            void signInWithGuestDemo();
        });
    }
}

async function resolveAuthState() {
    authState.loading = true;

    try {
        const response = await fetch(API_ME_ENDPOINT, {
            method: "GET",
            cache: "no-store"
        });

        if (!response.ok) {
            authState.user = null;
            return null;
        }

        const payload = await response.json();
        const user = payload && payload.user ? payload.user : null;
        setAuthenticatedUser(user);
        return user;
    } catch (_error) {
        authState.user = null;
        return null;
    } finally {
        authState.loading = false;
        updateAuthHeader();
    }
}

function setAuthenticatedUser(user) {
    authState.user = user || null;
    currentStoreKey = authState.user ? `${STORE_KEY_BASE}:${authState.user.id}` : STORE_KEY_BASE;

    if (authState.user) {
        hideAuthGate();
    }

    updateAuthHeader();
}

function showAuthGate(message = "") {
    document.body.classList.add("auth-locked");
    authAppBlockedClassApplied = true;

    if (authOverlayEl) {
        authOverlayEl.classList.add("is-visible");
    }

    if (authScreenMessageEl) {
        authScreenMessageEl.textContent = message;
    }
}

function hideAuthGate() {
    document.body.classList.remove("auth-locked");
    authAppBlockedClassApplied = false;

    if (authOverlayEl) {
        authOverlayEl.classList.remove("is-visible");
    }

    if (authScreenMessageEl) {
        authScreenMessageEl.textContent = "";
    }
}

function updateAuthHeader() {
    if (authUserBadgeEl && authLogoutButtonEl) {
        if (authState.user) {
            authUserBadgeEl.textContent = authState.user.isGuest ? `Guest demo • ${authState.user.displayName}` : authState.user.displayName;
            authLogoutButtonEl.textContent = "Logout";
            authLogoutButtonEl.disabled = false;
            const controls = authLogoutButtonEl.closest(".auth-header-controls");
            if (controls) {
                controls.style.display = "inline-flex";
            }
        } else {
            authUserBadgeEl.textContent = "";
            authLogoutButtonEl.textContent = "Logout";
            authLogoutButtonEl.disabled = true;
            const controls = authLogoutButtonEl.closest(".auth-header-controls");
            if (controls) {
                controls.style.display = "none";
            }
        }
    }
}

function setupAuthControls() {
    if (authLogoutButtonEl) {
        authLogoutButtonEl.addEventListener("click", () => {
            void signOutUser();
        });
    }
}

async function onAuthLoginSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await signInUser({
        username: String(formData.get("username") || ""),
        password: String(formData.get("password") || "")
    });
}

async function onAuthRegisterSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await registerUser({
        username: String(formData.get("username") || ""),
        displayName: String(formData.get("displayName") || ""),
        password: String(formData.get("password") || "")
    });
}

async function signInWithGuestDemo() {
    await signInUser({
        username: "guest",
        password: "guest123"
    });
}

async function signInUser(credentials) {
    await submitAuthRequest(API_LOGIN_ENDPOINT, credentials, "Logged in successfully.");
}

async function registerUser(credentials) {
    await submitAuthRequest(API_REGISTER_ENDPOINT, credentials, "Account created.");
}

async function submitAuthRequest(endpoint, payload, successMessage) {
    if (authScreenMessageEl) {
        authScreenMessageEl.textContent = "Please wait...";
    }

    try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data && data.error ? data.error : "Authentication failed");
        }

        setAuthenticatedUser(data.user || null);
        await loadState();
        render();

        if (authScreenMessageEl) {
            authScreenMessageEl.textContent = successMessage;
        }
    } catch (error) {
        if (authScreenMessageEl) {
            authScreenMessageEl.textContent = error instanceof Error ? error.message : "Authentication failed";
        }
    }
}

async function signOutUser() {
    try {
        await fetch(API_LOGOUT_ENDPOINT, {
            method: "POST",
            credentials: "same-origin"
        });
    } catch (_error) {
        // Continue clearing the local session even if logout network cleanup fails.
    }

    setAuthenticatedUser(null);
    resetPersistedState();
    showAuthGate("You have been logged out.");
}

async function checkPendingRemindersPreview() {
    if (!pendingReminderStatusEl || !pendingReminderListEl) {
        return;
    }

    pendingReminderStatusEl.textContent = "Checking pending tasks...";
    pendingReminderListEl.innerHTML = "";

    if (checkPendingButtonEl) {
        checkPendingButtonEl.disabled = true;
    }

    try {
        const response = await fetch(API_PENDING_REMINDERS_ENDPOINT, {
            method: "GET",
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error("Failed to load pending tasks");
        }

        const payload = await response.json();
        const pending = Array.isArray(payload.pending) ? payload.pending : [];

        renderPendingReminderPreview(pending);

        if (pending.length === 0) {
            pendingReminderStatusEl.textContent = "No pending reminder tasks right now.";
        } else {
            pendingReminderStatusEl.textContent = `${pending.length} pending task reminder${pending.length === 1 ? "" : "s"} found.`;
        }
    } catch (_error) {
        pendingReminderStatusEl.textContent = "Could not check pending tasks. Please try again.";
    } finally {
        if (checkPendingButtonEl) {
            checkPendingButtonEl.disabled = false;
        }
    }
}

function renderPendingReminderPreview(pending) {
    if (!pendingReminderListEl) {
        return;
    }

    pendingReminderListEl.innerHTML = "";

    if (!Array.isArray(pending) || pending.length === 0) {
        const note = document.createElement("li");
        note.className = "empty-note";
        note.textContent = "No tasks are pending for reminders.";
        pendingReminderListEl.appendChild(note);
        return;
    }

    pending.forEach((item) => {
        const li = document.createElement("li");
        li.className = "plan-item";

        const title = typeof item.subjectName === "string" ? item.subjectName : "Task";
        const dueDate = typeof item.dueDate === "string" ? item.dueDate : "Unknown";
        const message = typeof item.message === "string" ? item.message : "Pending";
        const dueDateLabel = /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? formatLongDate(dueDate) : dueDate;

        li.innerHTML = `<div><strong>${escapeHtml(title)}</strong><div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">${escapeHtml(message)}</div><div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">Due: ${escapeHtml(dueDateLabel)}</div></div>`;
        pendingReminderListEl.appendChild(li);
    });
}

function setupThemeToggle() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    const isDark = savedTheme === "dark";
    applyTheme(isDark);

    if (!themeToggleEl) {
        return;
    }

    themeToggleEl.addEventListener("click", () => {
        const willBeDark = !document.body.classList.contains("dark-theme");
        applyTheme(willBeDark);
        localStorage.setItem(THEME_KEY, willBeDark ? "dark" : "light");
    });
}

function applyTheme(isDark) {
    document.body.classList.toggle("dark-theme", isDark);

    if (themeToggleEl) {
        const icon = isDark ? "☀" : "🌙";
        const label = isDark ? "Light" : "Dark";
        themeToggleEl.innerHTML = `<span aria-hidden="true">${icon}</span> ${label}`;
        themeToggleEl.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
    }
}

function setupLogFilters() {
    if (logFilterTagEls.length > 0) {
        logFilterTagEls.forEach((button) => {
            button.addEventListener("click", () => {
                const selectedRange = button.dataset.logFilter;
                if (!selectedRange || selectedRange === logFilterState.range) {
                    return;
                }

                logFilterState.range = selectedRange;
                if (selectedRange !== "date") {
                    updateLogFilterDateInput();
                } else if (!logFilterState.customDate) {
                    logFilterState.customDate = todayKey;
                }

                renderSessionLog();
                renderActivityTimelineCard();
                renderTrackerTable();
                updateLogFilterUi();
            });
        });
    }

    if (logFilterDateEl) {
        logFilterDateEl.value = todayKey;
        logFilterDateEl.addEventListener("change", (event) => {
            const value = event.target.value;
            if (!value) {
                return;
            }

            logFilterState.customDate = value;
            logFilterState.range = "date";
            renderSessionLog();
            renderActivityTimelineCard();
            renderTrackerTable();
            updateLogFilterUi();
        });
    }

    updateLogFilterDateInput();
    updateLogFilterUi();
}

function setupTaskTimeLogFilters() {
    if (taskTimeFilterTagEls.length > 0) {
        taskTimeFilterTagEls.forEach((button) => {
            button.addEventListener("click", () => {
                const selectedRange = button.dataset.taskTimeFilter;
                if (!selectedRange || selectedRange === taskTimeFilterState.range) {
                    return;
                }

                taskTimeFilterState.range = selectedRange;
                if (selectedRange !== "date") {
                    updateTaskTimeDateInput();
                } else if (!taskTimeFilterState.customDate) {
                    taskTimeFilterState.customDate = todayKey;
                }

                updateTaskTimeFilterUi();
                renderTaskTimeLogCard();
            });
        });
    }

    if (taskTimeFilterDateEl) {
        taskTimeFilterDateEl.value = todayKey;
        taskTimeFilterDateEl.addEventListener("change", (event) => {
            const value = event.target.value;
            if (!value) {
                return;
            }

            taskTimeFilterState.customDate = value;
            taskTimeFilterState.range = "date";
            updateTaskTimeFilterUi();
            renderTaskTimeLogCard();
        });
    }

    if (taskTimeSubjectFilterEl) {
        taskTimeSubjectFilterEl.addEventListener("change", (event) => {
            taskTimeFilterState.subjectId = event.target.value || "all";
            renderTaskTimeLogCard();
        });
    }

    updateTaskTimeDateInput();
    updateTaskTimeFilterUi();
}

function updateLogFilterDateInput() {
    if (!logFilterDateEl) {
        return;
    }

    const isCustom = logFilterState.range === "date";
    logFilterDateEl.style.display = isCustom ? "inline-flex" : "none";

    if (isCustom) {
        logFilterDateEl.value = logFilterState.customDate || todayKey;
    }
}

function updateLogFilterUi() {
    if (logFilterTagEls.length > 0) {
        logFilterTagEls.forEach((button) => {
            const isActive = button.dataset.logFilter === logFilterState.range;
            const isHistoryFilterTag = button.classList.contains("history-filter-tag");

            if (isActive) {
                button.style.background = "linear-gradient(135deg, var(--accent-green), var(--accent-blue))";
                button.style.color = "#ffffff";
            } else if (isHistoryFilterTag) {
                button.style.background = "linear-gradient(135deg, #7ba9bd, #5f8da2)";
                button.style.color = "#ffffff";
            } else {
                button.style.background = "linear-gradient(135deg, #f0f4f8, #ffffff)";
                button.style.color = "var(--text-primary)";
            }

            button.style.boxShadow = "var(--shadow-inset)";
            button.setAttribute("aria-pressed", isActive ? "true" : "false");
        });
    }

    if (logFilterSummaryEl) {
        logFilterSummaryEl.textContent = "";
        logFilterSummaryEl.style.display = "none";
    }

    updateLogFilterDateInput();
}

function updateTaskTimeDateInput() {
    if (!taskTimeFilterDateEl) {
        return;
    }

    const isCustom = taskTimeFilterState.range === "date";
    taskTimeFilterDateEl.style.display = isCustom ? "inline-flex" : "none";

    if (isCustom) {
        taskTimeFilterDateEl.value = taskTimeFilterState.customDate || todayKey;
    }
}

function updateTaskTimeFilterUi() {
    if (taskTimeFilterTagEls.length > 0) {
        taskTimeFilterTagEls.forEach((button) => {
            const isActive = button.dataset.taskTimeFilter === taskTimeFilterState.range;
            button.style.background = isActive
                ? "linear-gradient(135deg, var(--accent-green), var(--accent-blue))"
                : "linear-gradient(135deg, #f0f4f8, #ffffff)";
            button.style.color = isActive ? "#ffffff" : "var(--text-primary)";
            button.style.boxShadow = "var(--shadow-inset)";
            button.setAttribute("aria-pressed", isActive ? "true" : "false");
        });
    }

    updateTaskTimeDateInput();
}


function getLogFilterContext() {
    const now = new Date();

    if (logFilterState.range === "today") {
        return {
            label: "Showing: Today",
            startKey: todayKey,
            endKey: todayKey
        };
    }

    if (logFilterState.range === "week") {
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - 6);
        return {
            label: "Showing: This Week",
            startKey: formatDateKey(weekStart),
            endKey: todayKey
        };
    }

    if (logFilterState.range === "month") {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return {
            label: "Showing: This Month",
            startKey: formatDateKey(monthStart),
            endKey: todayKey
        };
    }

    if (logFilterState.range === "date") {
        const selectedDate = logFilterState.customDate || todayKey;
        return {
            label: `Showing: ${formatLongDate(selectedDate)}`,
            startKey: selectedDate,
            endKey: selectedDate
        };
    }

    return {
        label: "Showing: All Time",
        startKey: null,
        endKey: null
    };
}

function getTaskTimeFilterContext() {
    const now = new Date();

    if (taskTimeFilterState.range === "today") {
        return {
            label: "Today",
            startKey: todayKey,
            endKey: todayKey
        };
    }

    if (taskTimeFilterState.range === "week") {
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - 6);
        return {
            label: "This Week",
            startKey: formatDateKey(weekStart),
            endKey: todayKey
        };
    }

    if (taskTimeFilterState.range === "month") {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return {
            label: "This Month",
            startKey: formatDateKey(monthStart),
            endKey: todayKey
        };
    }

    if (taskTimeFilterState.range === "date") {
        const selectedDate = taskTimeFilterState.customDate || todayKey;
        return {
            label: formatLongDate(selectedDate),
            startKey: selectedDate,
            endKey: selectedDate
        };
    }

    return {
        label: "All Time",
        startKey: null,
        endKey: null
    };
}

function getFilteredDateKeysForTaskTime() {
    const dateKeys = Object.keys(state.logs);
    const { startKey, endKey } = getTaskTimeFilterContext();

    return dateKeys
        .filter((dateKey) => {
            if (!startKey || !endKey) {
                return true;
            }

            return dateKey >= startKey && dateKey <= endKey;
        })
        .sort();
}

function refreshTaskTimeSubjectOptions() {
    if (!taskTimeSubjectFilterEl) {
        return;
    }

    const previous = taskTimeFilterState.subjectId || "all";
    taskTimeSubjectFilterEl.innerHTML = "";

    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "All tasks";
    taskTimeSubjectFilterEl.appendChild(allOption);

    state.subjects.forEach((item) => {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = item.subject;
        taskTimeSubjectFilterEl.appendChild(option);
    });

    const optionExists = previous === "all" || state.subjects.some((item) => item.id === previous);
    taskTimeFilterState.subjectId = optionExists ? previous : "all";
    taskTimeSubjectFilterEl.value = taskTimeFilterState.subjectId;
}

function renderTaskTimeLogCard() {
    if (!taskTimeLogListEl || !taskTimeSummaryEl) {
        return;
    }

    taskTimeLogListEl.innerHTML = "";

    const filterContext = getTaskTimeFilterContext();
    const filteredDays = getFilteredDateKeysForTaskTime();
    const selectedSubjectId = taskTimeFilterState.subjectId || "all";

    if (filteredDays.length === 0) {
        taskTimeSummaryEl.textContent = `${filterContext.label}: 0 min logged`;
        const empty = document.createElement("li");
        empty.className = "session-item empty-note";
        empty.textContent = "No logs found for this filter.";
        taskTimeLogListEl.appendChild(empty);
        return;
    }

    if (selectedSubjectId === "all") {
        const totalsBySubject = state.subjects
            .map((subject) => {
                const total = filteredDays.reduce((sum, dateKey) => {
                    const dayLog = state.logs[dateKey] || {};
                    return sum + (Number(dayLog[subject.id]) || 0);
                }, 0);

                return {
                    id: subject.id,
                    subjectName: subject.subject,
                    total
                };
            })
            .filter((item) => item.total > 0)
            .sort((a, b) => b.total - a.total);

        const allTaskTotal = totalsBySubject.reduce((sum, item) => sum + item.total, 0);
        taskTimeSummaryEl.textContent = `${filterContext.label}: ${allTaskTotal} min across ${totalsBySubject.length} task${totalsBySubject.length === 1 ? "" : "s"}`;

        if (totalsBySubject.length === 0) {
            const empty = document.createElement("li");
            empty.className = "session-item empty-note";
            empty.textContent = "No task minutes found for this filter.";
            taskTimeLogListEl.appendChild(empty);
            return;
        }

        totalsBySubject.forEach((entry) => {
            const item = document.createElement("li");
            item.className = "session-item";
            item.innerHTML = `<strong>${escapeHtml(entry.subjectName)}</strong><span>${entry.total} min logged</span>`;
            taskTimeLogListEl.appendChild(item);
        });

        return;
    }

    const selectedSubject = state.subjects.find((item) => item.id === selectedSubjectId);
    if (!selectedSubject) {
        taskTimeFilterState.subjectId = "all";
        refreshTaskTimeSubjectOptions();
        renderTaskTimeLogCard();
        return;
    }

    const perDayEntries = filteredDays
        .map((dateKey) => ({
            dateKey,
            minutes: Number((state.logs[dateKey] || {})[selectedSubjectId]) || 0
        }))
        .filter((entry) => entry.minutes > 0)
        .sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1));

    const subjectTotal = perDayEntries.reduce((sum, entry) => sum + entry.minutes, 0);
    taskTimeSummaryEl.textContent = `${selectedSubject.subject} • ${filterContext.label}: ${subjectTotal} min logged`;

    if (perDayEntries.length === 0) {
        const empty = document.createElement("li");
        empty.className = "session-item empty-note";
        empty.textContent = "No time logged for this task in the selected filter.";
        taskTimeLogListEl.appendChild(empty);
        return;
    }

    perDayEntries.forEach((entry) => {
        const item = document.createElement("li");
        item.className = "session-item";
        item.innerHTML = `<strong>${formatLongDate(entry.dateKey)}</strong><span>${entry.minutes} min logged</span>`;
        taskTimeLogListEl.appendChild(item);
    });
}

function filterDateKeys(dateKeys) {
    const { startKey, endKey } = getLogFilterContext();

    return dateKeys.filter((dateKey) => {
        if (!startKey || !endKey) {
            return true;
        }

        return dateKey >= startKey && dateKey <= endKey;
    });
}

function getFilteredSessions() {
    const allSessions = [];

    for (const [dayKey, sessions] of Object.entries(state.sessions)) {
        if (!Array.isArray(sessions)) {
            continue;
        }

        sessions.forEach((session) => {
            allSessions.push({
                ...session,
                dayKey
            });
        });
    }

    const allowedDayKeys = new Set(filterDateKeys(allSessions.map((session) => session.dayKey)));

    return allSessions
        .filter((session) => allowedDayKeys.has(session.dayKey))
        .sort((a, b) => Number(b.endedAt || b.startedAt) - Number(a.endedAt || a.startedAt));
}

function clampTimelinePercent(value) {
    if (!Number.isFinite(value)) {
        return 0;
    }

    return Math.min(100, Math.max(0, value));
}

function getTimelineSegmentStyle(dayKey, startedAt, endedAt) {
    const dayStart = new Date(`${dayKey}T00:00:00`).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const rawStart = Number(startedAt) || dayStart;
    const rawEnd = Number(endedAt) || rawStart;
    const safeStart = Math.min(Math.max(rawStart, dayStart), dayEnd);
    const safeEnd = Math.min(Math.max(rawEnd, safeStart), dayEnd);
    const startPercent = clampTimelinePercent(((safeStart - dayStart) / (dayEnd - dayStart)) * 100);
    const endPercent = clampTimelinePercent(((safeEnd - dayStart) / (dayEnd - dayStart)) * 100);

    return {
        left: startPercent,
        width: Math.max(endPercent - startPercent, 1.2)
    };
}

function getActivityTimelineDays() {
    const grouped = new Map();

    getFilteredSessions().forEach((session) => {
        if (!grouped.has(session.dayKey)) {
            grouped.set(session.dayKey, []);
        }

        grouped.get(session.dayKey).push(session);
    });

    return Array.from(grouped.entries())
        .sort((a, b) => String(b[0]).localeCompare(String(a[0])))
        .map(([dayKey, sessions]) => {
            const orderedSessions = sessions
                .slice()
                .sort((a, b) => Number(a.startedAt || 0) - Number(b.startedAt || 0));
            const totalMinutes = orderedSessions.reduce((sum, session) => sum + (Number(session.elapsedMinutes) || 0), 0);

            return {
                dayKey,
                sessions: orderedSessions,
                totalMinutes
            };
        });
}

function onAddPlan(event) {
    event.preventDefault();

    if (!subjectInput || !targetInput || !frequencyInput) {
        return;
    }

    const subject = subjectInput.value.trim();
    const target = Number(targetInput.value);
    const frequency = normalizeFrequencyInput(frequencyInput.value);
    const shouldSetDeadline = Boolean(deadlineToggleInput && deadlineToggleInput.checked);
    const dueDate = shouldSetDeadline && dueDateInput ? normalizeDueDateInput(dueDateInput.value) : null;
    const skillTags = normalizeTagList(skillTagsInput ? skillTagsInput.value : []);
    const factorTags = normalizeTagList(factorTagsInput ? factorTagsInput.value : []);

    if (!subject || Number.isNaN(target) || target <= 0) {
        return;
    }

    if (shouldSetDeadline && !dueDate) {
        return;
    }

    state.subjects.push({
        id: createId(),
        subject,
        target,
        frequency,
        dueDate,
        skillTags,
        factorTags
    });

    subjectInput.value = "";
    targetInput.value = "";
    frequencyInput.value = "everyday";

    if (deadlineToggleInput) {
        deadlineToggleInput.checked = false;
    }

    if (skillTagsInput) {
        skillTagsInput.value = "";
    }

    if (factorTagsInput) {
        factorTagsInput.value = "";
    }

    syncDueDateInputState();

    if (addTaskPanelEl) {
        closeAddTaskPanel();
    }

    saveState();
    render();
}

function refreshSpendTaskOptions() {
    if (!spendSubjectSelectEl) {
        return;
    }

    const previous = spendSubjectSelectEl.value;
    spendSubjectSelectEl.innerHTML = "";

    if (state.subjects.length === 0) {
        const emptyOption = document.createElement("option");
        emptyOption.value = "";
        emptyOption.textContent = "No tasks yet";
        spendSubjectSelectEl.appendChild(emptyOption);
        spendSubjectSelectEl.disabled = true;
        return;
    }

    spendSubjectSelectEl.disabled = false;

    state.subjects.forEach((item) => {
        const option = document.createElement("option");
        option.value = item.id;
        const loggedMinutes = isSingletonTask(item) ? getTotalLoggedMinutes(item.id) : getTodayLoggedMinutes(item.id);
        const targetSuffix = isSingletonTask(item) ? "total" : "today";
        option.textContent = `${item.subject} (${loggedMinutes}/${item.target} min ${targetSuffix})`;
        spendSubjectSelectEl.appendChild(option);
    });

    const hasPrevious = state.subjects.some((item) => item.id === previous);
    spendSubjectSelectEl.value = hasPrevious ? previous : state.subjects[0].id;

    refreshSpendFactorOptions();
}

function openSpendTimePanel(preferredSubjectId = null) {
    if (!spendTimePanelEl) {
        return;
    }

    if (addTaskPanelEl && !addTaskPanelEl.classList.contains("add-task-panel-hidden")) {
        closeAddTaskPanel();
    }

    refreshSpendTaskOptions();
    if (preferredSubjectId && spendSubjectSelectEl) {
        const optionExists = Array.from(spendSubjectSelectEl.options).some((option) => option.value === preferredSubjectId);
        if (optionExists) {
            spendSubjectSelectEl.value = preferredSubjectId;
        }
    }

    refreshSpendFactorOptions();

    if (spendSubjectSelectEl && spendSubjectSelectEl.value) {
        spendTimePanelEl.dataset.activeSubjectId = spendSubjectSelectEl.value;
    }

    spendTimePanelEl.classList.add("is-open");
    spendTimePanelEl.setAttribute("aria-hidden", "false");

    if (openSpendTimeButtonEl) {
        openSpendTimeButtonEl.setAttribute("aria-expanded", "true");
    }

    if (spendMinutesInputEl) {
        spendMinutesInputEl.focus();
    }
}

function closeSpendTimePanel() {
    if (!spendTimePanelEl) {
        return;
    }

    spendTimePanelEl.classList.remove("is-open");
    spendTimePanelEl.setAttribute("aria-hidden", "true");
    delete spendTimePanelEl.dataset.activeSubjectId;

    if (openSpendTimeButtonEl) {
        openSpendTimeButtonEl.setAttribute("aria-expanded", "false");
        openSpendTimeButtonEl.focus();
    }
}

function toggleSpendTimePanelForSubject(subjectId) {
    if (!spendTimePanelEl || !subjectId) {
        return;
    }

    const isOpen = spendTimePanelEl.classList.contains("is-open");
    const activeSubjectId = spendTimePanelEl.dataset.activeSubjectId || "";

    if (isOpen && activeSubjectId === subjectId) {
        closeSpendTimePanel();
        return;
    }

    openSpendTimePanel(subjectId);
}

function toggleSpendTimePanel() {
    if (!spendTimePanelEl) {
        return;
    }

    if (spendTimePanelEl.classList.contains("is-open")) {
        closeSpendTimePanel();
    } else {
        openSpendTimePanel();
    }
}

function onSpendTimeSubmit(event) {
    event.preventDefault();

    if (!spendSubjectSelectEl || !spendMinutesInputEl) {
        return;
    }

    const subjectId = spendSubjectSelectEl.value;
    const minutesValue = Number(spendMinutesInputEl.value);
    const selectedFactor = spendFactorSelectEl ? spendFactorSelectEl.value : "";

    if (!subjectId || Number.isNaN(minutesValue) || minutesValue <= 0) {
        return;
    }

    const subject = state.subjects.find((item) => item.id === subjectId);
    const factorTags = normalizeTagList(subject && subject.factorTags);
    const validFactor = factorTags.includes(selectedFactor) ? selectedFactor : null;

    const current = getTodayLoggedMinutes(subjectId);
    const next = current + minutesValue;
    updateTodayLog(subjectId, String(next), true, validFactor);
    spendMinutesInputEl.value = "";
    closeSpendTimePanel();
}

function openAddTaskPanel() {
    if (!addTaskPanelEl) {
        return;
    }

    if (spendTimePanelEl && spendTimePanelEl.classList.contains("is-open")) {
        closeSpendTimePanel();
    }

    addTaskPanelEl.classList.remove("add-task-panel-hidden");

    if (openPlanButtonEl) {
        openPlanButtonEl.setAttribute("aria-expanded", "true");
        openPlanButtonEl.textContent = "x";
    }

    if (subjectInput) {
        subjectInput.focus();
    }
}

function closeAddTaskPanel() {
    if (!addTaskPanelEl) {
        return;
    }

    addTaskPanelEl.classList.add("add-task-panel-hidden");

    if (openPlanButtonEl) {
        openPlanButtonEl.setAttribute("aria-expanded", "false");
        openPlanButtonEl.textContent = "+";
        openPlanButtonEl.focus();
    }
}

function toggleAddTaskPanel() {
    if (!addTaskPanelEl) {
        return;
    }

    if (addTaskPanelEl.classList.contains("add-task-panel-hidden")) {
        openAddTaskPanel();
    } else {
        closeAddTaskPanel();
    }
}

function removeSubject(subjectId) {
    state.subjects = state.subjects.filter((item) => item.id !== subjectId);
    delete state.activeTimers[subjectId];
    delete timerTargetAlerts[subjectId];

    for (const dateKey of Object.keys(state.logs)) {
        if (state.logs[dateKey][subjectId] !== undefined) {
            delete state.logs[dateKey][subjectId];
        }

        if (Object.keys(state.logs[dateKey]).length === 0) {
            delete state.logs[dateKey];
        }
    }

    for (const dayKey of Object.keys(state.sessions)) {
        const daySessions = Array.isArray(state.sessions[dayKey]) ? state.sessions[dayKey] : [];
        state.sessions[dayKey] = daySessions.filter((session) => session.subjectId !== subjectId);

        if (state.sessions[dayKey].length === 0) {
            delete state.sessions[dayKey];
        }
    }

    saveState();
    render();
}

function updateTodayLog(subjectId, value, shouldRefreshLists = false, factorTag = null) {
    if (!state.logs[todayKey]) {
        state.logs[todayKey] = {};
    }

    const previous = Number(state.logs[todayKey][subjectId] || 0);
    const numeric = Number(value);
    const nextValue = Number.isNaN(numeric) || numeric < 0 ? 0 : numeric;
    state.logs[todayKey][subjectId] = nextValue;

    applyFactorProgress(subjectId, nextValue - previous, factorTag, todayKey);

    maybeNotifyTaskCompletion(subjectId, previous, nextValue, todayKey);

    saveState();
    if (shouldRefreshLists) {
        renderLogs();
        renderCompletedTasks();
    }
    renderSummary();
    renderStreak();
    renderAnalysis();
    renderAttentionNext();
    renderTrackerTable();
    renderSessionLog();
    renderTaskTimeLogCard();
}

function maybeNotifyTaskCompletion(subjectId, previousMinutes, nextMinutes, dateKey) {
    const subject = state.subjects.find((item) => item.id === subjectId);
    const target = Number(subject && subject.target);

    if (!subject || Number.isNaN(target) || target <= 0) {
        return;
    }

    const delta = nextMinutes - previousMinutes;
    const nextProgress = getTaskProgressMinutes(subject);
    const previousProgress = isSingletonTask(subject) ? nextProgress - delta : previousMinutes;

    if (previousProgress >= target || nextProgress < target) {
        return;
    }

    const completionKey = isSingletonTask(subject) ? `singleton:${subjectId}` : `${dateKey}:${subjectId}`;
    if (taskCompletionAlerts[completionKey]) {
        return;
    }

    taskCompletionAlerts[completionKey] = true;
    sendTimerNotification("Task Completed", `${subject.subject} reached ${target} min ${getTaskTargetSuffix(subject)}.`);
}

function normalizeFrequencyInput(value) {
    return value === "singleton" ? "singleton" : "everyday";
}

function isSingletonTask(subject) {
    return normalizeFrequencyInput(subject && subject.frequency) === "singleton";
}

function getTaskTargetSuffix(subject) {
    return isSingletonTask(subject) ? "total" : "today";
}

function getTodayLoggedMinutes(subjectId) {
    return Number((state.logs[todayKey] || {})[subjectId]) || 0;
}

function getTotalLoggedMinutes(subjectId) {
    return Object.values(state.logs).reduce((sum, dayLog) => sum + (Number(dayLog && dayLog[subjectId]) || 0), 0);
}

function getTaskProgressMinutes(subject) {
    if (!subject) {
        return 0;
    }

    return isSingletonTask(subject) ? getTotalLoggedMinutes(subject.id) : getTodayLoggedMinutes(subject.id);
}

function getLiveTaskProgressMinutes(subject) {
    if (!subject) {
        return 0;
    }

    const baseProgress = getTaskProgressMinutes(subject);
    const startedAt = state.activeTimers[subject.id];

    if (!startedAt) {
        return baseProgress;
    }

    const elapsedMinutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
    return baseProgress + elapsedMinutes;
}

function isTaskCompleted(subject) {
    const target = Number(subject && subject.target) || 0;
    return target > 0 && getTaskProgressMinutes(subject) >= target;
}

function syncDueDateInputState() {
    if (!dueDateInput) {
        return;
    }

    const isEnabled = !deadlineToggleInput || deadlineToggleInput.checked;
    dueDateInput.disabled = !isEnabled;
    dueDateInput.required = isEnabled;
    dueDateInput.style.opacity = isEnabled ? "1" : "0.55";

    if (!isEnabled) {
        dueDateInput.value = "";
        return;
    }

    if (!dueDateInput.value) {
        dueDateInput.value = todayKey;
    }
}

function refreshSpendFactorOptions() {
    if (!spendFactorSelectEl || !spendSubjectSelectEl) {
        return;
    }

    const subjectId = spendSubjectSelectEl.value;
    const subject = state.subjects.find((item) => item.id === subjectId);
    const factorTags = normalizeTagList(subject && subject.factorTags);
    const previous = spendFactorSelectEl.value;

    spendFactorSelectEl.innerHTML = "";

    if (!subjectId || factorTags.length === 0) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "No factor tags";
        spendFactorSelectEl.appendChild(option);
        spendFactorSelectEl.disabled = true;
        spendFactorSelectEl.title = "This task does not have factor tags yet.";
        return;
    }

    spendFactorSelectEl.disabled = false;
    spendFactorSelectEl.title = "";

    factorTags.forEach((factor) => {
        const option = document.createElement("option");
        option.value = factor;
        option.textContent = factor;
        spendFactorSelectEl.appendChild(option);
    });

    spendFactorSelectEl.value = factorTags.includes(previous) ? previous : factorTags[0];
}

function applyFactorProgress(subjectId, deltaMinutes, selectedFactorTag = null, dayKey = todayKey) {
    const numericDelta = Number(deltaMinutes) || 0;
    if (numericDelta === 0) {
        return;
    }

    const subject = state.subjects.find((item) => item.id === subjectId);
    if (!subject) {
        return;
    }

    const factorTags = normalizeTagList(subject.factorTags);
    if (factorTags.length === 0) {
        return;
    }

    if (!state.factorLogs[dayKey] || typeof state.factorLogs[dayKey] !== "object") {
        state.factorLogs[dayKey] = {};
    }

    const applyDelta = (factorTag, amount) => {
        if (!factorTag || !amount) {
            return;
        }

        const current = Number(state.factorLogs[dayKey][factorTag] || 0);
        const next = current + amount;

        if (next <= 0) {
            delete state.factorLogs[dayKey][factorTag];
            return;
        }

        state.factorLogs[dayKey][factorTag] = next;
    };

    const validSelectedFactor = factorTags.includes(selectedFactorTag) ? selectedFactorTag : null;
    if (validSelectedFactor) {
        applyDelta(validSelectedFactor, numericDelta);
        return;
    }

    const share = numericDelta / factorTags.length;
    factorTags.forEach((factorTag) => applyDelta(factorTag, share));
}

function render() {
    if (!authState.user) {
        return;
    }

    refreshSpendTaskOptions();
    refreshTaskTimeSubjectOptions();
    renderTagSuggestions();
    renderPlan();
    renderLogs();
    renderRunningTasks();
    renderCompletedTasks();
    renderSummary();
    renderStreak();
    renderAnalysis();
    renderAttentionNext();
    renderTrackerTable();
    renderActivityTimelineCard();
    renderSessionLog();
    renderTaskTimeLogCard();
    refreshTaskPictureInPicture();
}

function renderRunningTasks() {
    if (!runningTasksListEl) {
        return;
    }

    runningTasksListEl.innerHTML = "";

    const runningSubjects = state.subjects
        .map((subject) => ({
            subject,
            startedAt: Number(state.activeTimers[subject.id]) || 0
        }))
        .filter((item) => item.startedAt > 0)
        .sort((a, b) => a.startedAt - b.startedAt);

    if (runningSubjects.length === 0) {
        const empty = document.createElement("span");
        empty.className = "running-task-empty";
        empty.textContent = "No task running right now.";
        runningTasksListEl.appendChild(empty);
        return;
    }

    runningSubjects.forEach((item) => {
        const subjectName = item.subject && item.subject.subject ? item.subject.subject : "Task";
        const elapsedMinutes = Math.max(1, Math.round((Date.now() - item.startedAt) / 60000));

        const chip = document.createElement("span");
        chip.className = "running-task-chip";
        chip.textContent = `${subjectName} • ${formatDuration(elapsedMinutes)}`;
        chip.setAttribute("title", `Started at ${formatClock(item.startedAt)}`);
        runningTasksListEl.appendChild(chip);
    });
}

function renderPlan() {
    if (!planList) {
        return;
    }

    planList.innerHTML = "";

    if (state.subjects.length === 0) {
        const note = document.createElement("p");
        note.className = "empty-note";
        note.textContent = "No subjects yet. Add your first study topic.";
        planList.appendChild(note);
        return;
    }

    state.subjects.forEach((item) => {
        const li = document.createElement("li");
        li.className = "plan-item";
        const dueDateLabel = item.dueDate ? formatLongDate(item.dueDate) : "No deadline";
        const targetLabel = isSingletonTask(item) ? `${item.target} min total` : `${item.target} min/day`;
        const frequencyLabel = isSingletonTask(item) ? "One-time task" : "Everyday task";
        const skillTagLabel = Array.isArray(item.skillTags) && item.skillTags.length > 0
            ? item.skillTags.join(", ")
            : "None";
        const factorTagLabel = Array.isArray(item.factorTags) && item.factorTags.length > 0
            ? item.factorTags.join(", ")
            : "None";

        const nameSpan = document.createElement("div");
        nameSpan.style.flex = "1";
        nameSpan.innerHTML = `<strong>${escapeHtml(item.subject)}</strong><div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">Target: ${targetLabel}</div><div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">Type: ${frequencyLabel}</div><div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">Deadline: ${escapeHtml(dueDateLabel)}</div><div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">Skills: ${escapeHtml(skillTagLabel)}</div><div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">Factors: ${escapeHtml(factorTagLabel)}</div>`;

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "remove-btn";
        removeButton.textContent = "Remove";
        removeButton.addEventListener("click", () => removeSubject(item.id));

        li.appendChild(nameSpan);
        li.appendChild(removeButton);
        planList.appendChild(li);
    });
}

function renderTagSuggestions() {
    renderTagSuggestionGroup(skillTagSuggestionsEl, getAllTagSuggestions("skillTags"), skillTagsInput, "No skill tags yet");
    renderTagSuggestionGroup(factorTagSuggestionsEl, getAllTagSuggestions("factorTags"), factorTagsInput, "No factor tags yet");
}

function renderTagSuggestionGroup(container, tags, inputEl, emptyLabel) {
    if (!container) {
        return;
    }

    container.innerHTML = "";

    if (!tags.length) {
        const emptyState = document.createElement("div");
        emptyState.className = "tag-suggestion-empty";
        emptyState.textContent = emptyLabel;
        container.appendChild(emptyState);
        return;
    }

    tags.forEach((tag) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip ghost-chip";
        chip.textContent = tag;
        chip.addEventListener("click", () => appendTagToInput(inputEl, tag));
        container.appendChild(chip);
    });
}

function getAllTagSuggestions(tagKey) {
    const tagSet = new Set();

    const masterList = tagKey === "skillTags" ? skillTagMasterList : factorTagMasterList;
    masterList.forEach((tag) => tagSet.add(tag));

    state.subjects.forEach((subject) => {
        normalizeTagList(subject && subject[tagKey]).forEach((tag) => tagSet.add(tag));
    });

    return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
}

function appendTagToInput(inputEl, tag) {
    if (!inputEl || !tag) {
        return;
    }

    const existingTags = normalizeTagList(inputEl.value);
    if (existingTags.includes(tag)) {
        inputEl.focus();
        return;
    }

    const nextValue = existingTags.length > 0 ? `${existingTags.join(", ")}, ${tag}` : tag;
    inputEl.value = nextValue;
    inputEl.focus();
}

function renderLogs() {
    if (!logContainer) {
        return;
    }

    const activeIndexBeforeRender = Number(logContainer.dataset.activeIndex || 0);

    logContainer.innerHTML = "";

    if (state.subjects.length === 0) {
        const note = document.createElement("p");
        note.className = "empty-note";
        note.textContent = "Add a subject to start logging study time.";
        logContainer.appendChild(note);
        return;
    }

    const activeSubjects = state.subjects.filter((item) => {
        const isRunning = Boolean(state.activeTimers[item.id]);
        const isCompleted = isTaskCompleted(item);
        return isRunning || !isCompleted;
    });

    if (activeSubjects.length === 0) {
        const note = document.createElement("p");
        note.className = "empty-note";
        note.textContent = "All tasks are completed for today. Check Completed Tasks below.";
        logContainer.appendChild(note);
        return;
    }

    activeSubjects.forEach((item, index) => {
        const wrap = document.createElement("div");
        wrap.className = "log-item";
        wrap.dataset.carouselIndex = String(index);
        wrap.dataset.subjectId = item.id;
        wrap.dataset.initial = (item.subject || "?").trim().charAt(0).toUpperCase() || "?";

        const current = getTodayLoggedMinutes(item.id);
        const progress = getTaskProgressMinutes(item);
        const liveProgress = getLiveTaskProgressMinutes(item);
        const target = Number(item.target) || 0;
        const isRunning = Boolean(state.activeTimers[item.id]);
        const hasProgress = progress > 0;

        let cardState = "state-stopped";
        let dotState = "stopped";
        let stateLabel = "Stopped";

        if (isRunning) {
            cardState = "state-running";
            dotState = "running";
            stateLabel = "Running";
            wrap.classList.add("has-started-at");
        } else if (hasProgress) {
            cardState = "state-mid";
            dotState = "mid";
            stateLabel = "Stopped in-between";
        }

        wrap.classList.add(cardState);

        const dot = document.createElement("span");
        dot.className = `task-state-dot ${dotState}`;
        dot.title = stateLabel;
        dot.setAttribute("aria-label", stateLabel);

        let startedAtTime = null;
        if (isRunning) {
            startedAtTime = document.createElement("div");
            startedAtTime.className = "started-at-time";
            startedAtTime.textContent = formatClock(state.activeTimers[item.id]);
            startedAtTime.setAttribute("aria-label", `Started at ${formatClock(state.activeTimers[item.id])}`);
        }

        const completedMinutes = Math.max(0, Math.round(liveProgress));
        const completedHours = Math.floor(completedMinutes / 60);
        const remainingMinutes = completedMinutes % 60;

        const completedTimeBadge = document.createElement("div");
        completedTimeBadge.className = "task-time-badge";
        completedTimeBadge.setAttribute("aria-label", `Completed time ${completedHours} hour ${remainingMinutes} minutes`);
        completedTimeBadge.innerHTML = `
            <span class="task-time-badge-hours">${completedHours}</span>
            <span class="task-time-badge-minutes">${remainingMinutes}</span>
        `;

        const playBtn = document.createElement("button");
        playBtn.type = "button";
        playBtn.className = "task-play-btn";
        if (isRunning) {
            playBtn.classList.add("is-running");
        }
        playBtn.setAttribute("aria-label", `Start timer for ${item.subject}`);
        playBtn.innerHTML = isRunning ? "⏹" : "▶";
        const toggleTaskTimer = () => {
            if (isRunning) {
                stopTimer(item.id);
            } else {
                startTimer(item.id);
            }
        };
        playBtn.addEventListener("click", toggleTaskTimer);

        const playBtnBottom = document.createElement("button");
        playBtnBottom.type = "button";
        playBtnBottom.className = "task-play-btn task-play-btn-bottom";
        playBtnBottom.setAttribute("aria-label", `Add spent time for ${item.subject}`);
        playBtnBottom.innerHTML = "+";

        const heading = document.createElement("div");
        heading.className = "task-copy";
        const targetLine = isSingletonTask(item)
            ? `Target: ${item.target} min total`
            : `Target: ${item.target} min/day`;
        heading.innerHTML = `
            <span class="task-copy-title">${escapeHtml(item.subject.toUpperCase())}</span>
            <span class="task-copy-target">${targetLine}</span>
        `;

        const input = document.createElement("input");
        input.type = "number";
        input.min = "0";
        input.step = "5";
        input.value = String(current);
        input.placeholder = "Enter minutes studied";
        input.setAttribute("aria-label", `Minutes studied for ${item.subject}`);
        // Keep typing smooth on mobile by not rebuilding the list on each keystroke.
        input.addEventListener("input", (event) => updateTodayLog(item.id, event.target.value, false));
        // Refresh list placement/status only after edit is committed.
        input.addEventListener("change", (event) => updateTodayLog(item.id, event.target.value, true));
        input.addEventListener("blur", (event) => updateTodayLog(item.id, event.target.value, true));

        const inlineSpendEditor = document.createElement("form");
        inlineSpendEditor.className = "inline-spend-editor";

        const inlineSpendInput = document.createElement("input");
        inlineSpendInput.type = "number";
        inlineSpendInput.min = "1";
        inlineSpendInput.step = "5";
        inlineSpendInput.placeholder = "min";
        inlineSpendInput.setAttribute("aria-label", `Add minutes for ${item.subject}`);

        const inlineSpendAddBtn = document.createElement("button");
        inlineSpendAddBtn.type = "submit";
        inlineSpendAddBtn.className = "inline-spend-add-btn";
        inlineSpendAddBtn.textContent = "Add";

        inlineSpendEditor.appendChild(inlineSpendInput);
        inlineSpendEditor.appendChild(inlineSpendAddBtn);

        inlineSpendEditor.addEventListener("submit", (event) => {
            event.preventDefault();
            const minutesToAdd = Number(inlineSpendInput.value);
            if (Number.isNaN(minutesToAdd) || minutesToAdd <= 0) {
                return;
            }

            const currentMinutes = getTodayLoggedMinutes(item.id);
            inlineSpendEditorSubjectId = null;
            updateTodayLog(item.id, String(currentMinutes + minutesToAdd), true);
        });

        inlineSpendInput.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                inlineSpendEditorSubjectId = null;
                renderLogs();
            }
        });

        const isInlineEditorOpen = inlineSpendEditorSubjectId === item.id;
        inlineSpendEditor.classList.toggle("is-open", isInlineEditorOpen);
        playBtnBottom.classList.toggle("is-open", isInlineEditorOpen);

        playBtnBottom.addEventListener("click", () => {
            inlineSpendEditorSubjectId = inlineSpendEditorSubjectId === item.id ? null : item.id;
            renderLogs();
            if (inlineSpendEditorSubjectId === item.id) {
                setTimeout(() => {
                    const focusInput = logContainer && logContainer.querySelector(`.log-item[data-subject-id="${item.id}"] .inline-spend-editor input`);
                    if (focusInput instanceof HTMLElement) {
                        focusInput.focus();
                    }
                }, 0);
            }
        });

        const timerRow = document.createElement("div");
        timerRow.className = "timer-row";

        const startButton = document.createElement("button");
        startButton.type = "button";
        startButton.className = "timer-btn start-btn";
        startButton.textContent = "Start";
        startButton.disabled = Boolean(state.activeTimers[item.id]);
        startButton.addEventListener("click", () => startTimer(item.id));

        const stopButton = document.createElement("button");
        stopButton.type = "button";
        stopButton.className = "timer-btn stop-btn";
        stopButton.textContent = "Stop & Save";
        stopButton.disabled = !state.activeTimers[item.id];
        stopButton.addEventListener("click", () => stopTimer(item.id));

        const status = document.createElement("span");
        status.className = "timer-status";
        if (!isRunning && isTaskCompleted(item)) {
            status.textContent = "Completed";
        } else {
            status.textContent = getTimerStatusText(item.id);
        }

        timerRow.appendChild(startButton);
        timerRow.appendChild(stopButton);
        timerRow.appendChild(status);

        wrap.appendChild(dot);
        if (startedAtTime) {
            wrap.appendChild(startedAtTime);
        }
        wrap.appendChild(completedTimeBadge);
        wrap.appendChild(playBtn);
        wrap.appendChild(playBtnBottom);
        wrap.appendChild(heading);
        wrap.appendChild(input);
        wrap.appendChild(inlineSpendEditor);
        wrap.appendChild(timerRow);
        logContainer.appendChild(wrap);
    });

    syncTaskCarouselPresentation(activeIndexBeforeRender);
}

function restoreCompletedTask(subjectId) {
    if (state.activeTimers[subjectId]) {
        return;
    }

    const subject = state.subjects.find((item) => item.id === subjectId);
    if (!subject) {
        return;
    }

    const response = window.prompt("How many extra minutes do you want to rework?", "10");
    if (response === null) {
        return;
    }

    const extraMinutes = Math.round(Number(response));
    if (Number.isNaN(extraMinutes) || extraMinutes <= 0) {
        return;
    }

    state.reworkPlans[subjectId] = {
        baseProgress: getTaskProgressMinutes(subject),
        extraMinutes
    };

    startTimer(subjectId);
}

function renderCompletedTasks() {
    if (!completedTaskListEl) {
        return;
    }

    completedTaskListEl.innerHTML = "";

    const completedSubjects = state.subjects.filter((item) => {
        const isRunning = Boolean(state.activeTimers[item.id]);
        return !isRunning && isTaskCompleted(item);
    });

    if (completedSubjects.length === 0) {
        const note = document.createElement("li");
        note.className = "empty-note";
        note.textContent = "No completed tasks yet today.";
        completedTaskListEl.appendChild(note);
        return;
    }

    completedSubjects.forEach((item) => {
        const current = getTaskProgressMinutes(item);
        const target = Number(item.target) || 0;
        const extra = Math.max(0, current - target);
        const targetLabel = isSingletonTask(item) ? "min total" : "min today";

        const li = document.createElement("li");
        li.className = "plan-item";

        const contentDiv = document.createElement("div");
        contentDiv.style.flex = "1";
        contentDiv.innerHTML = `<strong>${escapeHtml(item.subject)}</strong><div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">Completed: ${target} / ${target} ${targetLabel}${extra > 0 ? ` (+${extra} extra)` : ""}</div>`;

        const restoreButton = document.createElement("button");
        restoreButton.type = "button";
        restoreButton.className = "remove-btn";
        restoreButton.textContent = "Restore";
        restoreButton.addEventListener("click", () => restoreCompletedTask(item.id));

        li.appendChild(contentDiv);
        li.appendChild(restoreButton);
        completedTaskListEl.appendChild(li);
    });
}

function moveTaskCarousel(direction) {
    if (!logContainer) {
        return;
    }

    const cards = getTaskCarouselCards();
    if (cards.length === 0) {
        return;
    }

    const currentIndex = getActiveTaskCarouselIndex(cards);
    const nextIndex = (currentIndex + direction + cards.length) % cards.length;
    scrollTaskCardToIndex(nextIndex);
}

function scrollTaskCardToIndex(index) {
    if (!logContainer) {
        return;
    }

    const cards = getTaskCarouselCards();
    if (cards.length === 0) {
        return;
    }

    const safeIndex = ((index % cards.length) + cards.length) % cards.length;
    logContainer.dataset.activeIndex = String(safeIndex);
    syncTaskCarouselState(safeIndex, false);
}

function syncTaskCarouselState(preferredIndex = null, shouldScroll = false) {
    if (!logContainer) {
        return;
    }

    const cards = getTaskCarouselCards();
    const dots = getTaskCarouselDots();

    if (cards.length === 0) {
        if (logPrevButtonEl) {
            logPrevButtonEl.disabled = true;
        }
        if (logNextButtonEl) {
            logNextButtonEl.disabled = true;
        }
        if (logDotsEl) {
            logDotsEl.innerHTML = "";
        }
        return;
    }

    const rawPreferred = preferredIndex !== null && !Number.isNaN(preferredIndex)
        ? preferredIndex
        : getActiveTaskCarouselIndex(cards);
    const activeIndex = ((rawPreferred % cards.length) + cards.length) % cards.length;

    cards.forEach((card, index) => {
        let offset = index - activeIndex;
        if (offset > cards.length / 2) {
            offset -= cards.length;
        }
        if (offset < -cards.length / 2) {
            offset += cards.length;
        }

        const absOffset = Math.abs(offset);
        const scale = Math.max(0.62, 1 - absOffset * 0.15);
        const opacity = Math.max(0, 1 - absOffset * 0.25);

        card.style.setProperty("--offset", String(offset));
        card.style.setProperty("--card-scale", String(scale));
        card.style.setProperty("--card-opacity", String(opacity));
        card.style.setProperty("--card-z", String(100 - absOffset));
        card.classList.toggle("is-active-slide", index === activeIndex);
        card.classList.toggle("is-side-slide", index !== activeIndex);
        card.classList.toggle("is-distant-slide", absOffset > 2);
    });

    dots.forEach((dot, index) => {
        dot.classList.toggle("active", index === activeIndex);
        dot.setAttribute("aria-pressed", index === activeIndex ? "true" : "false");
    });

    if (logPrevButtonEl) {
        logPrevButtonEl.disabled = false;
    }

    if (logNextButtonEl) {
        logNextButtonEl.disabled = false;
    }

    logContainer.dataset.activeIndex = String(activeIndex);

    if (shouldScroll) {
        // 3D carousel is index-driven; no native scroll adjustment required.
    }
}

function getTaskCarouselCards() {
    if (!logContainer) {
        return [];
    }

    return Array.from(logContainer.querySelectorAll(".log-item"));
}

function getTaskCarouselDots() {
    if (!logDotsEl) {
        return [];
    }

    return Array.from(logDotsEl.querySelectorAll(".carousel-dot"));
}

function getActiveTaskCarouselIndex(cards) {
    if (!logContainer || !Array.isArray(cards) || cards.length === 0) {
        return 0;
    }

    const savedIndex = Number(logContainer.dataset.activeIndex || 0);
    if (Number.isNaN(savedIndex)) {
        return 0;
    }

    return ((savedIndex % cards.length) + cards.length) % cards.length;
}

function syncTaskCarouselPresentation(preferredIndex = null) {
    if (!logDotsEl || !logContainer) {
        return;
    }

    const cards = getTaskCarouselCards();
    logDotsEl.innerHTML = "";

    cards.forEach((_card, index) => {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "carousel-dot";
        dot.setAttribute("aria-label", `Go to task ${index + 1}`);
        dot.setAttribute("aria-pressed", "false");
        dot.addEventListener("click", () => scrollTaskCardToIndex(index));
        logDotsEl.appendChild(dot);
    });

    syncTaskCarouselState(preferredIndex !== null ? preferredIndex : Number(logContainer.dataset.activeIndex || 0), true);
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function startTimer(subjectId) {
    if (state.activeTimers[subjectId]) {
        return;
    }

    ensureNotificationPermission();

    state.activeTimers[subjectId] = Date.now();
    timerTargetAlerts[subjectId] = false;
    saveState();
    renderLogs();
    renderRunningTasks();
    void openTaskPictureInPicture(subjectId);
}

function monitorRunningTimers() {
    state.subjects.forEach((item) => {
        const startedAt = state.activeTimers[item.id];
        if (!startedAt) {
            return;
        }

        const logged = getTaskProgressMinutes(item);
        const elapsedMinutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
        const projected = logged + elapsedMinutes;
        const reworkPlan = state.reworkPlans[item.id];

        if (reworkPlan && Number(reworkPlan.extraMinutes) > 0) {
            const reworkTarget = Number(reworkPlan.baseProgress) + Number(reworkPlan.extraMinutes);
            if (projected >= reworkTarget && !timerTargetAlerts[item.id]) {
                timerTargetAlerts[item.id] = true;
                sendTimerNotification("Rework Target Reached", `${item.subject} reached +${reworkPlan.extraMinutes} min rework.`);
                autoCompleteRunningTask(item.id, logged, reworkTarget);
            }
            return;
        }

        const target = Number(item.target) || 0;
        if (target <= 0) {
            return;
        }

        if (logged >= target) {
            // Rework mode: already-completed tasks should keep running without auto-stop.
            return;
        }

        if (projected >= target && !timerTargetAlerts[item.id]) {
            handleRunningTargetReached(item, logged, target);
        }
    });
}

function handleRunningTargetReached(subject, logged, target) {
    timerTargetAlerts[subject.id] = true;
    sendTimerNotification("Target Reached", `${subject.subject} reached ${target} min. Auto-completing task.`);
    autoCompleteRunningTask(subject.id, logged, target);
}

function autoCompleteRunningTask(subjectId, logged, target) {
    const startedAt = state.activeTimers[subjectId];
    if (!startedAt) {
        return;
    }

    const subjectName = state.subjects.find((item) => item.id === subjectId)?.subject || "Task";

    const dayKey = formatDateKey(new Date(startedAt));
    if (!state.logs[dayKey]) {
        state.logs[dayKey] = {};
    }

    const existing = Number(state.logs[dayKey][subjectId]) || 0;
    const minutesToAdd = Math.max(0, target - logged);

    if (minutesToAdd > 0) {
        state.logs[dayKey][subjectId] = existing + minutesToAdd;
        applyFactorProgress(subjectId, minutesToAdd, null, dayKey);
        addSessionLog(subjectId, startedAt, Date.now(), minutesToAdd, dayKey);
    }

    delete state.activeTimers[subjectId];
    delete timerTargetAlerts[subjectId];
    delete state.reworkPlans[subjectId];
    taskCompletionAlerts[`${dayKey}:${subjectId}`] = true;
    sendTimerNotification("Timer Completed", `${subjectName} was auto-completed at ${target} min.`);
    saveState();
    render();
    refreshTaskPictureInPicture();
}


function stopTimer(subjectId) {
    const startedAt = state.activeTimers[subjectId];

    if (!startedAt) {
        return;
    }

    const endedAt = Date.now();
    const elapsedMinutes = Math.max(1, Math.round((endedAt - startedAt) / 60000));
    const dayKey = formatDateKey(new Date(startedAt));
    const subject = state.subjects.find((item) => item.id === subjectId);

    if (!state.logs[dayKey]) {
        state.logs[dayKey] = {};
    }

    const existing = Number(state.logs[dayKey][subjectId]) || 0;
    let minutesToAdd = elapsedMinutes;
    const progressBefore = subject ? (isSingletonTask(subject) ? getTotalLoggedMinutes(subjectId) : existing) : existing;
    const reworkPlan = state.reworkPlans[subjectId];

    if (subject && reworkPlan && Number(reworkPlan.extraMinutes) > 0) {
        const reworkTarget = Number(reworkPlan.baseProgress) + Number(reworkPlan.extraMinutes);
        const projectedRework = progressBefore + elapsedMinutes;

        if (projectedRework > reworkTarget) {
            minutesToAdd = Math.max(0, reworkTarget - progressBefore);
            sendTimerNotification("Rework Target Capped", `${subject.subject} was capped at +${reworkPlan.extraMinutes} min rework.`);
        }
    } else if (subject && Number(subject.target) > 0) {
        const target = Number(subject.target);
        const projected = progressBefore + elapsedMinutes;

        if (progressBefore < target && projected > target) {
            // Notification-first flow: cap at target instead of showing a blocking confirm dialog.
            minutesToAdd = Math.max(0, target - progressBefore);
            sendTimerNotification("Target Capped", `${subject.subject} was capped at ${target} min.`);
        }
    }

    state.logs[dayKey][subjectId] = existing + minutesToAdd;

    if (minutesToAdd > 0) {
        applyFactorProgress(subjectId, minutesToAdd, null, dayKey);
    }

    if (minutesToAdd > 0) {
        addSessionLog(subjectId, startedAt, endedAt, minutesToAdd, dayKey);
    }

    if (subject) {
        sendTimerNotification("Session Saved", `${subject.subject}: ${minutesToAdd} min logged.`);
    }

    delete state.activeTimers[subjectId];
    delete timerTargetAlerts[subjectId];

    if (reworkPlan) {
        const reworkTarget = Number(reworkPlan.baseProgress) + Number(reworkPlan.extraMinutes);
        const nextProgress = progressBefore + minutesToAdd;
        if (nextProgress >= reworkTarget) {
            sendTimerNotification("Rework Completed", `${subject ? subject.subject : "Task"} finished +${reworkPlan.extraMinutes} min rework.`);
        }
        delete state.reworkPlans[subjectId];
    }

    saveState();
    render();
    refreshTaskPictureInPicture();
}

function canUseTaskPictureInPicture() {
    return Boolean(window.documentPictureInPicture && typeof window.documentPictureInPicture.requestWindow === "function");
}

function getRunningTaskIds() {
    return Object.entries(state.activeTimers)
        .filter(([, startedAt]) => Number(startedAt) > 0)
        .sort((a, b) => Number(a[1]) - Number(b[1]))
        .map(([subjectId]) => subjectId);
}

function getPreferredTaskPipSubjectId(preferredSubjectId = null) {
    const runningIds = getRunningTaskIds();
    if (runningIds.length === 0) {
        return null;
    }

    if (preferredSubjectId && runningIds.includes(preferredSubjectId)) {
        return preferredSubjectId;
    }

    if (taskPipSubjectId && runningIds.includes(taskPipSubjectId)) {
        return taskPipSubjectId;
    }

    return runningIds[0];
}

function closeTaskPictureInPicture() {
    if (taskPipWindowRef && !taskPipWindowRef.closed) {
        taskPipWindowRef.close();
    }

    taskPipWindowRef = null;
    taskPipSubjectId = null;
}

async function openTaskPictureInPicture(preferredSubjectId = null) {
    if (!canUseTaskPictureInPicture()) {
        return;
    }

    const subjectId = getPreferredTaskPipSubjectId(preferredSubjectId);
    if (!subjectId) {
        closeTaskPictureInPicture();
        return;
    }

    try {
        if (!taskPipWindowRef || taskPipWindowRef.closed) {
            taskPipWindowRef = await window.documentPictureInPicture.requestWindow({
                width: 188,
                height: 102
            });

            taskPipWindowRef.addEventListener("pagehide", () => {
                taskPipWindowRef = null;
                taskPipSubjectId = null;
            }, { once: true });
        }

        taskPipSubjectId = subjectId;
        renderTaskPictureInPicture();
    } catch (_error) {
        // Ignore PiP failures (unsupported browser, blocked popup, or denied permission).
    }
}

function refreshTaskPictureInPicture() {
    if (!taskPipWindowRef || taskPipWindowRef.closed) {
        return;
    }

    const subjectId = getPreferredTaskPipSubjectId(taskPipSubjectId);
    if (!subjectId) {
        closeTaskPictureInPicture();
        return;
    }

    taskPipSubjectId = subjectId;
    renderTaskPictureInPicture();
}

function renderTaskPictureInPicture() {
    if (!taskPipWindowRef || taskPipWindowRef.closed) {
        return;
    }

    const subjectId = getPreferredTaskPipSubjectId(taskPipSubjectId);
    if (!subjectId) {
        closeTaskPictureInPicture();
        return;
    }

    const startedAt = Number(state.activeTimers[subjectId]) || 0;
    const subject = state.subjects.find((item) => item.id === subjectId);

    if (!startedAt || !subject) {
        refreshTaskPictureInPicture();
        return;
    }

    taskPipSubjectId = subjectId;

    const elapsedMinutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
    const liveProgress = Math.max(0, Math.round(getLiveTaskProgressMinutes(subject)));
    const target = Number(subject.target) || 0;
    const targetLabel = target > 0
        ? `${Math.min(liveProgress, target)} / ${target} min`
        : `${liveProgress} min`;
    const stateLabel = target > 0 && liveProgress >= target ? "Target reached" : "Running";
    const runningIds = getRunningTaskIds();
    const canSwitch = runningIds.length > 1;
    const isDark = document.body.classList.contains("dark-theme");

    const pipDoc = taskPipWindowRef.document;
    pipDoc.title = subject.subject || "Task";
    pipDoc.body.className = isDark ? "pip-theme-dark" : "pip-theme-light";
    pipDoc.body.innerHTML = `
        <style>
            :root {
                color-scheme: light dark;
            }

            body {
                margin: 0;
                min-height: 100vh;
                font-family: "Outfit", "Segoe UI", sans-serif;
                display: grid;
                align-content: stretch;
                background: linear-gradient(145deg, #f7f2ef, #ece2dc);
                color: #1a1816;
                padding: 0;
                overflow: hidden;
            }

            body.pip-theme-dark {
                background: linear-gradient(145deg, #171a1f, #23272d);
                color: #eaf1ff;
            }

            .pip-card {
                box-sizing: border-box;
                min-height: 100vh;
                border-radius: 14px;
                padding: 6px 8px 7px;
                background: rgba(255, 255, 255, 0.86);
                border: 1px solid rgba(110, 98, 89, 0.22);
                display: grid;
                grid-template-rows: auto auto auto;
                gap: 5px;
            }

            body.pip-theme-dark .pip-card {
                background: rgba(31, 35, 41, 0.9);
                border-color: rgba(182, 189, 197, 0.2);
            }

            .pip-title {
                margin: 0;
                font-size: 0.62rem;
                font-weight: 700;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                text-align: center;
            }

            .pip-state {
                font-size: 0.54rem;
                padding: 2px 5px;
                border-radius: 999px;
                background: rgba(77, 144, 129, 0.16);
                color: #1f5a4f;
                font-weight: 700;
                line-height: 1.2;
            }

            body.pip-theme-dark .pip-state {
                color: #d0d5db;
                background: rgba(110, 118, 128, 0.18);
            }

            .pip-time {
                margin: 0;
                font-size: 0.64rem;
                font-weight: 700;
                letter-spacing: 0.02em;
                line-height: 1;
                text-align: center;
            }

            .pip-sub {
                margin: 0;
                font-size: 0.52rem;
                color: #665f5a;
                line-height: 1.15;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                text-align: center;
            }

            body.pip-theme-dark .pip-sub {
                color: #c3c8cf;
            }

            .pip-controls {
                display: grid;
                grid-template-columns: 28px 1fr 28px;
                align-items: center;
                gap: 6px;
            }

            .pip-btn {
                border: none;
                border-radius: 9px;
                padding: 5px 2px;
                font-size: 0.6rem;
                font-weight: 700;
                cursor: pointer;
                background: linear-gradient(145deg, #f8f4f2, #e7ddd6);
                color: #3f3a36;
                min-height: 24px;
                line-height: 1;
            }

            body.pip-theme-dark .pip-btn {
                background: linear-gradient(145deg, #2a2f36, #1f2329);
                color: #f1f3f5;
            }

            .pip-btn-stop {
                background: linear-gradient(145deg, #f6b79b, #ef8a78);
                color: #4b1f1a;
            }

            .pip-btn-arrow {
                font-size: 0.9rem;
                padding: 0;
            }

            .pip-center {
                display: grid;
                gap: 3px;
                justify-items: center;
            }

            .pip-center .pip-btn-stop {
                width: 100%;
                max-width: 62px;
            }

            .pip-btn:disabled {
                cursor: not-allowed;
                opacity: 0.5;
            }
        </style>
        <article class="pip-card" aria-live="polite">
            <h1 class="pip-title">${escapeHtml(subject.subject || "Task")}</h1>
            <div class="pip-controls">
                <button id="pipPrevBtn" class="pip-btn pip-btn-arrow" type="button" ${canSwitch ? "" : "disabled"}>&larr;</button>
                <div class="pip-center">
                    <button id="pipStopBtn" class="pip-btn pip-btn-stop" type="button">Stop</button>
                    <p class="pip-time">${escapeHtml(formatDuration(elapsedMinutes))}</p>
                </div>
                <button id="pipNextBtn" class="pip-btn pip-btn-arrow" type="button" ${canSwitch ? "" : "disabled"}>&rarr;</button>
            </div>
            <p class="pip-sub">${escapeHtml(stateLabel)} • ${escapeHtml(targetLabel)}</p>
        </article>
    `;

    const stopBtn = pipDoc.getElementById("pipStopBtn");
    if (stopBtn) {
        stopBtn.addEventListener("click", () => {
            stopTimer(subjectId);
        });
    }

    const prevBtn = pipDoc.getElementById("pipPrevBtn");
    if (prevBtn) {
        prevBtn.addEventListener("click", () => {
            const ids = getRunningTaskIds();
            if (ids.length <= 1) {
                return;
            }

            const currentIndex = ids.indexOf(taskPipSubjectId);
            const prevIndex = currentIndex >= 0 ? (currentIndex - 1 + ids.length) % ids.length : 0;
            taskPipSubjectId = ids[prevIndex];
            renderTaskPictureInPicture();
        });
    }

    const nextBtn = pipDoc.getElementById("pipNextBtn");
    if (nextBtn) {
        nextBtn.addEventListener("click", () => {
            const ids = getRunningTaskIds();
            if (ids.length <= 1) {
                return;
            }

            const currentIndex = ids.indexOf(taskPipSubjectId);
            const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % ids.length : 0;
            taskPipSubjectId = ids[nextIndex];
            renderTaskPictureInPicture();
        });
    }
}

function ensureNotificationPermission() {
    if (!canUseSystemNotifications()) {
        return;
    }

    if (Notification.permission === "default") {
        Notification.requestPermission().catch(() => {
            // Ignore permission request errors.
        });
    }
}

async function requestNotificationPermissionFromUser() {
    if (!canUseSystemNotifications() || Notification.permission !== "default") {
        return Notification.permission;
    }

    try {
        return await Notification.requestPermission();
    } catch (_error) {
        return Notification.permission;
    }
}

function updateNotificationPermissionStatus() {
    if (!notificationPermissionStatusEl) {
        return;
    }

    if (!canUseSystemNotifications()) {
        notificationPermissionStatusEl.textContent = "Notifications are blocked here. Open the app on https:// or localhost on the same device to enable them in Brave.";
        return;
    }

    if (Notification.permission === "granted") {
        notificationPermissionStatusEl.textContent = "Notifications are enabled.";
        return;
    }

    if (Notification.permission === "denied") {
        notificationPermissionStatusEl.textContent = "Notifications are blocked in Brave. Open site settings to allow them.";
        return;
    }

    notificationPermissionStatusEl.textContent = "Tap Enable Notifications to allow task alerts.";
}

function sendTimerNotification(title, body) {
    if (!canUseSystemNotifications()) {
        return;
    }

    const options = {
        body,
        requireInteraction: true,
        renotify: true,
        tag: `task-${Date.now()}`,
        silent: false
    };

    if (Notification.permission === "granted") {
        if (notificationServiceWorkerRegistration && typeof notificationServiceWorkerRegistration.showNotification === "function") {
            notificationServiceWorkerRegistration.showNotification(title, options).catch(() => {
                try {
                    new Notification(title, options);
                } catch (_error) {
                    // Ignore notification failures on restricted environments.
                }
            });
            return;
        }

        if (navigator.serviceWorker && typeof navigator.serviceWorker.getRegistration === "function") {
            navigator.serviceWorker.getRegistration()
                .then((registration) => {
                    if (registration && typeof registration.showNotification === "function") {
                        return registration.showNotification(title, options);
                    }

                    return new Notification(title, options);
                })
                .catch(() => {
                    try {
                        new Notification(title, options);
                    } catch (_error) {
                        // Ignore notification failures on restricted environments.
                    }
                });
            return;
        }

        try {
            new Notification(title, options);
        } catch (_error) {
            // Ignore notification failures on restricted environments.
        }
        return;
    }

    if (Notification.permission !== "default") {
        return;
    }

    Notification.requestPermission()
        .then((permission) => {
            if (permission === "granted") {
                sendTimerNotification(title, body);
            }
        })
        .catch(() => {
            // Ignore permission/notification failures on restricted environments.
        });
}

function canUseSystemNotifications() {
    if (!("Notification" in window)) {
        return false;
    }

    const host = window.location.hostname;
    const isLocalhost = host === "localhost" || host === "127.0.0.1";
    return window.isSecureContext || isLocalhost;
}

async function registerNotificationServiceWorker() {
    if (!("serviceWorker" in navigator)) {
        return;
    }

    try {
        notificationServiceWorkerRegistration = await navigator.serviceWorker.register("/sw.js");
        notificationServiceWorkerRegistration = await navigator.serviceWorker.ready;
    } catch (_error) {
        notificationServiceWorkerRegistration = null;
        // Ignore service worker registration errors and continue with page notifications.
    }
}

function setupNotificationActivation() {
    const activate = () => {
        ensureNotificationPermission();
        document.removeEventListener("click", activate, true);
        document.removeEventListener("touchstart", activate, true);
        document.removeEventListener("keydown", activate, true);
    };

    document.addEventListener("click", activate, true);
    document.addEventListener("touchstart", activate, true);
    document.addEventListener("keydown", activate, true);
}

function addSessionLog(subjectId, startedAt, endedAt, elapsedMinutes, dayKey) {
    if (!state.sessions[dayKey]) {
        state.sessions[dayKey] = [];
    }

    const subjectName = state.subjects.find((item) => item.id === subjectId)?.subject || "Unknown";

    state.sessions[dayKey].unshift({
        id: createId(),
        subjectId,
        subjectName,
        startedAt,
        endedAt,
        elapsedMinutes
    });

    state.sessions[dayKey] = state.sessions[dayKey].slice(0, 20);
}

function renderSessionLog() {
    if (!sessionLogEl) {
        return;
    }

    sessionLogEl.innerHTML = "";

    const sessions = getFilteredSessions();
    const filterLabel = getLogFilterContext().label;

    if (sessionDateEl) {
        sessionDateEl.textContent = `${filterLabel} (${sessions.length} session${sessions.length === 1 ? "" : "s"})`;
    }

    if (sessions.length === 0) {
        const empty = document.createElement("li");
        empty.className = "session-item empty-note";
        empty.textContent = "No sessions found for this filter.";
        sessionLogEl.appendChild(empty);
        return;
    }

    sessions.forEach((session) => {
        const item = document.createElement("li");
        item.className = "session-item";

        const startText = formatClock(session.startedAt);
        const endText = formatClock(session.endedAt);
        const durationText = formatDuration(session.elapsedMinutes);
        const dayText = formatLongDate(session.dayKey);

        item.innerHTML = `
      <strong>${escapeHtml(session.subjectName)}</strong>
            <span>${dayText} • ${startText} → ${endText}</span>
        <span>${durationText} logged</span>
    `;

        sessionLogEl.appendChild(item);
    });
}

function renderActivityTimelineCard() {
    if (!activityTimelineListEl) {
        return;
    }

    activityTimelineListEl.innerHTML = "";

    const days = getActivityTimelineDays();
    const filterLabel = getLogFilterContext().label.replace(/^Showing:\s*/, "");

    if (activityTimelineSubtitleEl) {
        activityTimelineSubtitleEl.textContent = `${filterLabel} active-time view`;
    }

    if (days.length === 0) {
        const empty = document.createElement("div");
        empty.className = "activity-timeline-empty";
        empty.textContent = "No Pomodoro sessions found for this filter.";
        activityTimelineListEl.appendChild(empty);
        return;
    }

    days.slice(0, 12).forEach((day) => {
        const item = document.createElement("article");
        item.className = "activity-day";

        const segmentsHtml = day.sessions
            .map((session) => {
                const segment = getTimelineSegmentStyle(day.dayKey, session.startedAt, session.endedAt);
                const label = `${session.subjectName}: ${formatClock(session.startedAt)} to ${formatClock(session.endedAt)}`;
                return `<div class="activity-segment" style="left: ${segment.left}%; width: ${segment.width}%;" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}"></div>`;
            })
            .join("");

        item.innerHTML = `
            <div class="activity-track-wrap" aria-label="Activity timeline for ${formatLongDate(day.dayKey)}">
                <div class="activity-track"></div>
                ${segmentsHtml}
                <div class="activity-scale">
                    <span>12a</span>
                    <span>6a</span>
                    <span>12p</span>
                    <span>6p</span>
                    <span>12a</span>
                </div>
            </div>
            <div class="activity-day-meta">
                <strong>${formatLongDate(day.dayKey)}</strong>
                <span>${day.sessions.length} session${day.sessions.length === 1 ? "" : "s"} • ${formatDuration(day.totalMinutes)} active</span>
            </div>
        `;

        activityTimelineListEl.appendChild(item);
    });
}

function getTimerStatusText(subjectId) {
    const startedAt = state.activeTimers[subjectId];

    if (!startedAt) {
        return "Not running";
    }

    const elapsedMinutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
    return `${formatClock(startedAt)} (${formatDuration(elapsedMinutes)})`;
}

function renderSummary() {
    if (!targetTotalEl || !completedTotalEl || !completionRateEl || !progressBarEl) {
        return;
    }

    const everydaySubjects = state.subjects.filter((item) => !isSingletonTask(item));
    const totalTarget = everydaySubjects.reduce((sum, item) => sum + item.target, 0);
    const completed = everydaySubjects.reduce((sum, item) => sum + getTodayLoggedMinutes(item.id), 0);

    const completion = totalTarget > 0 ? Math.min(100, Math.round((completed / totalTarget) * 100)) : 0;

    targetTotalEl.textContent = `${totalTarget} min`;
    completedTotalEl.textContent = `${completed} min`;
    completionRateEl.textContent = `${completion}%`;
    progressBarEl.style.width = `${completion}%`;
}

function renderStreak() {
    if (!currentStreakEl || !bestStreakEl || !activeDaysEl) {
        return;
    }

    const activeDateKeys = Object.keys(state.logs)
        .filter((dateKey) => {
            const total = Object.values(state.logs[dateKey] || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
            return total > 0;
        })
        .sort();

    const streak = calculateCurrentStreak(activeDateKeys);
    const best = calculateBestStreak(activeDateKeys);

    currentStreakEl.textContent = `${streak} day${streak === 1 ? "" : "s"}`;
    bestStreakEl.textContent = `${best} day${best === 1 ? "" : "s"}`;
    activeDaysEl.textContent = String(activeDateKeys.length);
}

function renderAnalysis() {
    if (!analysisChartEl || !analysisTextEl) {
        return;
    }

    analysisChartEl.innerHTML = "";

    const lastSeven = getLastNDates(7);
    const dailyTotals = lastSeven.map((dateKey) => {
        const bySubject = state.logs[dateKey] || {};
        return Object.values(bySubject).reduce((sum, value) => sum + (Number(value) || 0), 0);
    });

    const max = Math.max(...dailyTotals, 1);
    const avg = Math.round(dailyTotals.reduce((sum, value) => sum + value, 0) / dailyTotals.length);

    lastSeven.forEach((dateKey, index) => {
        const value = dailyTotals[index];
        const height = Math.max(8, Math.round((value / max) * 100));

        const wrap = document.createElement("div");
        wrap.className = "bar-wrap";

        const bar = document.createElement("div");
        bar.className = "bar";
        bar.style.height = `${height}%`;
        bar.title = `${value} min`;

        const valueLabel = document.createElement("span");
        valueLabel.textContent = `${value}m`;
        valueLabel.style.fontSize = "0.65rem";
        valueLabel.style.color = "var(--text-secondary)";
        valueLabel.style.lineHeight = "1";

        const day = document.createElement("span");
        day.className = "day";
        day.textContent = shortWeekday(dateKey);

        wrap.appendChild(valueLabel);
        wrap.appendChild(bar);
        wrap.appendChild(day);
        analysisChartEl.appendChild(wrap);
    });

    const bestDay = Math.max(...dailyTotals);
    analysisTextEl.textContent =
        bestDay === 0
            ? "Start your first study session today to see useful weekly insights."
            : `You averaged ${avg} minutes/day this week. Best day: ${bestDay} minutes.`;
}

function renderAttentionNext() {
    if (!attentionListEl) {
        return;
    }

    attentionListEl.innerHTML = "";

    const today = formatDateKey(new Date());
    const todayLog = state.logs[today] || {};
    const todayTotal = Object.values(todayLog).reduce((sum, value) => sum + (Number(value) || 0), 0);
    const activeDateKeys = Object.keys(state.logs)
        .filter((dateKey) => {
            const total = Object.values(state.logs[dateKey] || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
            return total > 0;
        })
        .sort();

    const currentStreak = calculateCurrentStreak(activeDateKeys);
    const candidates = [];

    if (currentStreak > 0 && todayTotal === 0) {
        candidates.push({
            id: "streak-risk",
            priority: 95,
            title: "Protect your streak today",
            detail: `You are on a ${currentStreak}-day streak. Log at least 1 session today to keep momentum.`
        });
    }

    state.subjects.forEach((subject) => {
        const target = Number(subject.target) || 0;
        const totalProgress = getTaskProgressMinutes(subject);
        const totalRemaining = Math.max(0, target - totalProgress);

        if (target <= 0 || totalRemaining <= 0) {
            return;
        }

        const safeName = typeof subject.subject === "string" && subject.subject.trim() ? subject.subject.trim() : "Task";
        const isEveryday = !isSingletonTask(subject);

        if (subject.dueDate) {
            const daysUntilDue = diffDays(today, subject.dueDate);

            if (daysUntilDue < 0) {
                candidates.push({
                    id: `overdue:${subject.id}`,
                    priority: 100,
                    title: `${safeName} is overdue`,
                    detail: `Due on ${formatLongDate(subject.dueDate)}. Plan ${totalRemaining} min to recover.`
                });
            } else if (daysUntilDue === 0) {
                candidates.push({
                    id: `due-today:${subject.id}`,
                    priority: 90,
                    title: `${safeName} is due today`,
                    detail: `${totalRemaining} min still needed before end of day.`
                });
            } else if (daysUntilDue <= 2) {
                candidates.push({
                    id: `due-soon:${subject.id}`,
                    priority: 80 - daysUntilDue,
                    title: `${safeName} is due in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`,
                    detail: `${totalRemaining} min pending. Add a focused block today.`
                });
            }
        }

        if (isEveryday) {
            const todayLogged = getTodayLoggedMinutes(subject.id);
            const todayGap = Math.max(0, target - todayLogged);

            if (todayGap > 0) {
                candidates.push({
                    id: `daily-gap:${subject.id}`,
                    priority: 60 + Math.min(20, Math.round((todayGap / Math.max(1, target)) * 20)),
                    title: `${safeName} is behind today's target`,
                    detail: `${todayLogged}/${target} min logged today. ${todayGap} min left.`
                });
            }
        } else if (!subject.dueDate) {
            candidates.push({
                id: `singleton-open:${subject.id}`,
                priority: 35,
                title: `${safeName} still open`,
                detail: `${totalRemaining} min left for this one-time task.`
            });
        }
    });

    const deduped = [];
    const seen = new Set();

    candidates
        .sort((a, b) => b.priority - a.priority)
        .forEach((item) => {
            if (seen.has(item.id)) {
                return;
            }

            seen.add(item.id);
            deduped.push(item);
        });

    const nextItems = deduped.slice(0, 6);

    if (attentionSummaryEl) {
        attentionSummaryEl.textContent = nextItems.length === 0
            ? "No urgent blockers right now. Keep your current rhythm."
            : `${nextItems.length} priority item${nextItems.length === 1 ? "" : "s"} to focus next`;
    }

    if (nextItems.length === 0) {
        const note = document.createElement("li");
        note.className = "attention-item";
        note.innerHTML = "<strong>Looking solid</strong><span>No overdue tasks or major daily gaps detected.</span>";
        attentionListEl.appendChild(note);
        return;
    }

    nextItems.forEach((item) => {
        const li = document.createElement("li");
        li.className = "attention-item";
        li.innerHTML = `<strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.detail)}</span>`;
        attentionListEl.appendChild(li);
    });
}

function renderTrackerTable() {
    if (!trackerTableBodyEl) {
        return;
    }

    trackerTableBodyEl.innerHTML = "";

    const availableDays = Object.keys(state.logs).sort().reverse();
    const filteredDays = filterDateKeys(availableDays);
    const requiredPerDay = state.subjects
        .filter((item) => !isSingletonTask(item))
        .reduce((sum, item) => sum + (Number(item.target) || 0), 0);

    if (filteredDays.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 2;
        cell.style.textAlign = "center";
        cell.style.color = "var(--text-secondary)";
        cell.textContent = "No daily logs found for this filter.";
        row.appendChild(cell);
        trackerTableBodyEl.appendChild(row);
        return;
    }

    filteredDays.forEach((dateKey) => {
        const bySubject = state.logs[dateKey] || {};
        const total = Object.values(bySubject).reduce((sum, value) => sum + (Number(value) || 0), 0);
        const date = new Date(`${dateKey}T00:00:00`);

        const row = document.createElement("tr");

        const dateCell = document.createElement("td");
        const dateText = date.toLocaleDateString(undefined, {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
        const weekdayText = date.toLocaleDateString(undefined, { weekday: "short" });
        dateCell.innerHTML = `<strong style="color: var(--text-primary);">${dateText}</strong><div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">${weekdayText}</div>`;

        const progressCell = document.createElement("td");
        if (requiredPerDay <= 0) {
            progressCell.innerHTML = `<div style="font-size: 0.85rem; color: var(--text-secondary);">${total} min logged (no everyday targets)</div>`;
        } else {
            const completion = Math.min(100, Math.round((total / requiredPerDay) * 100));
            progressCell.innerHTML = `
            <div style="font-size: 0.85rem; color: var(--text-primary); margin-bottom: 6px;">${total} / ${requiredPerDay} min</div>
            <div style="height: 10px; border-radius: 12px; overflow: hidden; background: linear-gradient(135deg, #e0e7f1, #f5f7fa); box-shadow: var(--shadow-inset);">
                <div style="height: 100%; width: ${completion}%; background: linear-gradient(90deg, var(--accent-green), var(--accent-blue)); border-radius: 12px;"></div>
            </div>
        `;
        }

        row.appendChild(dateCell);
        row.appendChild(progressCell);
        trackerTableBodyEl.appendChild(row);
    });
}

function calculateCurrentStreak(dateKeys) {
    if (dateKeys.length === 0) {
        return 0;
    }

    const activeSet = new Set(dateKeys);
    const today = new Date();
    let streak = 0;

    for (let offset = 0; offset < 3650; offset += 1) {
        const date = new Date(today);
        date.setDate(today.getDate() - offset);
        const key = formatDateKey(date);

        if (activeSet.has(key)) {
            streak += 1;
            continue;
        }

        if (offset === 0) {
            continue;
        }

        break;
    }

    return streak;
}

function calculateBestStreak(dateKeys) {
    if (dateKeys.length === 0) {
        return 0;
    }

    let best = 1;
    let run = 1;

    for (let i = 1; i < dateKeys.length; i += 1) {
        if (diffDays(dateKeys[i - 1], dateKeys[i]) === 1) {
            run += 1;
            best = Math.max(best, run);
        } else {
            run = 1;
        }
    }

    return best;
}

function diffDays(previousKey, currentKey) {
    const prev = new Date(`${previousKey}T00:00:00`);
    const curr = new Date(`${currentKey}T00:00:00`);
    return Math.round((curr - prev) / 86400000);
}

function getLastNDates(count) {
    const dates = [];

    for (let i = count - 1; i >= 0; i -= 1) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        dates.push(formatDateKey(date));
    }

    return dates;
}

function shortWeekday(dateKey) {
    const date = new Date(`${dateKey}T00:00:00`);
    return date.toLocaleDateString(undefined, { weekday: "short" });
}

function formatDateKey(date) {
    return date.toISOString().slice(0, 10);
}

function normalizeDueDateInput(value) {
    if (typeof value !== "string" || !value.trim()) {
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

function normalizeTagList(value) {
    const rawItems = Array.isArray(value)
        ? value
        : (typeof value === "string" ? value.split(",") : []);

    const unique = [];
    const seen = new Set();

    rawItems.forEach((item) => {
        if (typeof item !== "string") {
            return;
        }

        const trimmed = item.trim();
        if (!trimmed) {
            return;
        }

        const normalized = trimmed.toLowerCase();
        if (seen.has(normalized)) {
            return;
        }

        seen.add(normalized);
        unique.push(normalized);
    });

    return unique;
}

function normalizeSubjectDueDate(subject) {
    const dueDate = normalizeDueDateInput(subject && subject.dueDate);
    if (!dueDate) {
        return null;
    }

    if (normalizeFrequencyInput(subject && subject.frequency) === "everyday" && dueDate <= todayKey) {
        return null;
    }

    if (isLegacyCreationDateDeadline(subject, dueDate)) {
        return null;
    }

    return dueDate;
}

function isLegacyCreationDateDeadline(subject, dueDate) {
    if (!subject || normalizeFrequencyInput(subject.frequency) !== "everyday") {
        return false;
    }

    if (typeof subject.id !== "string" || !subject.id.startsWith("sub-")) {
        return false;
    }

    const timestamp = Number(subject.id.slice(4).split("-")[0]);
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
        return false;
    }

    return formatDateKey(new Date(timestamp)) === dueDate;
}

async function loadState() {
    if (!authState.user) {
        return;
    }

    let localParsed = null;
    const storeKey = getCurrentStoreKey();
    const legacyStoreKey = STORE_KEY_BASE;

    try {
        const userScopedSaved = localStorage.getItem(storeKey);
        const canUseLegacyFallback = Boolean(authState.user && authState.user.isGuest);
        const legacySaved = canUseLegacyFallback && storeKey !== legacyStoreKey
            ? localStorage.getItem(legacyStoreKey)
            : null;
        const saved = userScopedSaved || legacySaved;

        if (!saved) {
            localParsed = null;
        } else {
            localParsed = JSON.parse(saved);
            applyParsedState(localParsed);
        }
    } catch (error) {
        console.error("Failed to load local tracker data", error);
    }

    try {
        // Check if server is reachable before fetching state
        // Prevents data loss when server is offline during page refresh
        const serverReachable = await isServerReachable();

        if (!serverReachable) {
            // Server is offline or unreachable - keep local data
            return;
        }

        const response = await fetch(API_STATE_ENDPOINT, {
            method: "GET",
            cache: "no-store",
            credentials: "same-origin",
            signal: AbortSignal.timeout(5000)
        });

        if (response.status === 401) {
            handleSessionExpiration("Your session expired. Please sign in again.");
            return;
        }

        if (!response.ok) {
            return;
        }

        const payload = await response.json();
        const remoteState = payload && typeof payload === "object" ? payload.state : null;
        const hasRemoteState = remoteState && typeof remoteState === "object" && Object.keys(remoteState).length > 0;

        if (hasRemoteState) {
            applyParsedState(remoteState);
            localStorage.setItem(storeKey, JSON.stringify(buildPersistedState()));
            return;
        }

        if (localParsed) {
            void persistStateToServer();
        }
    } catch (error) {
        // Keep the app functional with local storage if backend is unavailable.
        console.warn("Backend state API unavailable, using local storage only.");
    }
}

function applyParsedState(parsed) {
    if (!parsed || typeof parsed !== "object") {
        return;
    }

    state.subjects = [];
    state.logs = {};
    state.factorLogs = {};
    state.sessions = {};
    state.activeTimers = {};
    state.reworkPlans = {};

    if (Array.isArray(parsed.subjects)) {
        state.subjects = parsed.subjects
            .filter((item) => item && item.id && item.subject && Number(item.target) > 0)
            .map((item) => ({
                id: item.id,
                subject: item.subject,
                target: Number(item.target),
                frequency: normalizeFrequencyInput(item.frequency),
                dueDate: normalizeSubjectDueDate(item),
                skillTags: normalizeTagList(item.skillTags),
                factorTags: normalizeTagList(item.factorTags)
            }));
    }

    if (parsed.logs && typeof parsed.logs === "object") {
        state.logs = parsed.logs;
    }

    if (parsed.factorLogs && typeof parsed.factorLogs === "object") {
        state.factorLogs = parsed.factorLogs;
    }

    if (parsed.sessions && typeof parsed.sessions === "object") {
        state.sessions = parsed.sessions;
    }

    if (parsed.activeTimers && typeof parsed.activeTimers === "object") {
        state.activeTimers = Object.fromEntries(
            Object.entries(parsed.activeTimers).filter(([, timestamp]) => Number(timestamp) > 0)
        );
    }

    if (parsed.reworkPlans && typeof parsed.reworkPlans === "object") {
        state.reworkPlans = Object.fromEntries(
            Object.entries(parsed.reworkPlans)
                .filter(([taskId, plan]) => {
                    const hasActiveTimer = Number(state.activeTimers[taskId]) > 0;
                    const baseProgress = Number(plan && plan.baseProgress);
                    const extraMinutes = Number(plan && plan.extraMinutes);
                    return hasActiveTimer
                        && Number.isFinite(baseProgress)
                        && baseProgress >= 0
                        && Number.isFinite(extraMinutes)
                        && extraMinutes > 0;
                })
                .map(([taskId, plan]) => [taskId, {
                    baseProgress: Number(plan.baseProgress),
                    extraMinutes: Math.round(Number(plan.extraMinutes))
                }])
        );
    }
}

function saveState() {
    if (!authState.user) {
        return;
    }

    const snapshot = buildPersistedState();
    localStorage.setItem(getCurrentStoreKey(), JSON.stringify(snapshot));
    scheduleStateSave();
}

function buildPersistedState() {
    return {
        subjects: state.subjects,
        logs: state.logs,
        factorLogs: state.factorLogs,
        sessions: state.sessions,
        activeTimers: state.activeTimers,
        reworkPlans: state.reworkPlans
    };
}

function scheduleStateSave() {
    if (pendingSaveTimer) {
        clearTimeout(pendingSaveTimer);
    }

    pendingSaveTimer = setTimeout(() => {
        pendingSaveTimer = null;
        void persistStateToServer();
    }, SAVE_DEBOUNCE_MS);
}

async function isServerReachable() {
    try {
        const response = await fetch("/api/health", {
            method: "HEAD",
            cache: "no-store",
            signal: AbortSignal.timeout(2000)
        });
        return response.ok;
    } catch (error) {
        // Server unreachable or timed out
        return false;
    }
}

async function persistStateToServer() {
    if (!authState.user) {
        return;
    }

    try {
        const response = await fetch(API_STATE_ENDPOINT, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "same-origin",
            body: JSON.stringify({ state: buildPersistedState() })
        });

        if (response.status === 401) {
            handleSessionExpiration("Your session expired. Please sign in again.");
        }
    } catch (error) {
        // Keep running with local storage when backend sync fails.
    }
}

function getCurrentStoreKey() {
    if (authState.user && Number(authState.user.id) > 0) {
        return `${STORE_KEY_BASE}:${authState.user.id}`;
    }

    return currentStoreKey || STORE_KEY_BASE;
}

function handleSessionExpiration(message) {
    pendingSaveTimer = null;
    resetPersistedState();
    setAuthenticatedUser(null);
    showAuthGate(message);
}

function resetPersistedState() {
    state.subjects = [];
    state.logs = {};
    state.factorLogs = {};
    state.sessions = {};
    state.activeTimers = {};
    state.reworkPlans = {};
    closeTaskPictureInPicture();

    if (pendingSaveTimer) {
        clearTimeout(pendingSaveTimer);
        pendingSaveTimer = null;
    }

    render();
}

function createId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }

    return `sub-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
}

function formatClock(timestamp) {
    return new Date(timestamp).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit"
    });
}

function formatDuration(minutes) {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hrs === 0) {
        return `${mins} min`;
    }

    if (mins === 0) {
        return `${hrs} hr`;
    }

    return `${hrs} hr ${mins} min`;
}

function formatLongDate(dateKey) {
    const date = new Date(`${dateKey}T00:00:00`);
    return date.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric"
    });
}

function escapeHtml(value) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

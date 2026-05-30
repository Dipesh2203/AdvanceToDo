/**
 * Year Insight Card Module
 * Handles rendering of yearly insights, statistics, and streaks
 * Easily located and debugged for Year & Insight issues
 */

export function renderYearInsightCard(state) {
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

/**
 * Calculate ISO week number for a given date
 * Used for weekly statistics in insights
 */
export function getISOWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Helper: Calculate days difference between two date strings (YYYY-MM-DD)
 */
export function diffDays(dateKey1, dateKey2) {
    const d1 = new Date(dateKey1 + "T00:00:00");
    const d2 = new Date(dateKey2 + "T00:00:00");
    return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
}

/**
 * Render summary statistics: target, completed, and progress
 */
export function renderSummary(state, isSingletonTask, getTodayLoggedMinutes) {
    const targetTotalEl = document.getElementById("targetTotal");
    const completedTotalEl = document.getElementById("completedTotal");
    const completionRateEl = document.getElementById("completionRate");
    const progressBarEl = document.getElementById("progressBar");

    if (!targetTotalEl || !completedTotalEl || !completionRateEl || !progressBarEl) {
        return;
    }

    const everydaySubjects = state.subjects.filter((item) => !item.archived && !isSingletonTask(item));
    const totalTarget = everydaySubjects.reduce((sum, item) => sum + item.target, 0);
    const completed = everydaySubjects.reduce((sum, item) => sum + getTodayLoggedMinutes(item.id), 0);

    const completion = totalTarget > 0 ? Math.min(100, Math.round((completed / totalTarget) * 100)) : 0;

    targetTotalEl.textContent = `${totalTarget} min`;
    completedTotalEl.textContent = `${completed} min`;
    completionRateEl.textContent = `${completion}%`;
    progressBarEl.style.width = `${completion}%`;
}

/**
 * Render current and best streak statistics
 */
export function renderStreak(state, calculateCurrentStreak, calculateBestStreak) {
    const currentStreakEl = document.getElementById("currentStreak");
    const bestStreakEl = document.getElementById("bestStreak");
    const activeDaysEl = document.getElementById("activeDays");

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

/**
 * Render 7-day analysis chart
 */
export function renderAnalysis(state, getLastNDates) {
    const analysisChartEl = document.getElementById("analysisChart");
    const analysisTextEl = document.getElementById("analysisText");

    if (!analysisChartEl || !analysisTextEl) {
        return;
    }

    analysisChartEl.innerHTML = "";

    const lastSeven = getLastNDates(7);
    const dailyTotals = lastSeven.map((dateKey) => {
        const bySubject = state.logs[dateKey] || {};
        return Object.values(bySubject).reduce((sum, value) => sum + (Number(value) || 0), 0);
    });

    const maxDaily = Math.max(...dailyTotals, 1);
    const avgDaily = dailyTotals.reduce((sum, val) => sum + val, 0) / dailyTotals.length;

    lastSeven.forEach((dateKey, index) => {
        const value = dailyTotals[index];
        const ratio = value / maxDaily;

        const colDiv = document.createElement("div");
        colDiv.className = "analysis-col";
        colDiv.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: center;
            flex: 1;
            gap: 4px;
        `;

        const barDiv = document.createElement("div");
        barDiv.className = "analysis-bar";
        barDiv.style.cssText = `
            width: 100%;
            height: 60px;
            background: linear-gradient(to top, var(--accent-blue), var(--accent-green));
            border-radius: 4px;
            opacity: ${Math.max(0.3, ratio)};
        `;
        barDiv.title = `${value} min`;

        const daySpan = document.createElement("span");
        daySpan.style.cssText = "font-size: 0.65rem; color: var(--text-secondary);";
        const dateObj = new Date(`${dateKey}T00:00:00`);
        daySpan.textContent = dateObj.toLocaleDateString(undefined, { month: "short", day: "2-digit" });

        colDiv.appendChild(barDiv);
        colDiv.appendChild(daySpan);
        analysisChartEl.appendChild(colDiv);
    });

    analysisTextEl.textContent = `Last 7 days: Avg ${Math.round(avgDaily)} min/day, Max ${maxDaily} min`;
}

/**
 * Render mini chart (last 10 days)
 */
export function renderMiniChart(state, getLastNDates) {
    const miniChartEl = document.getElementById("miniChart");
    if (!miniChartEl) {
        return;
    }

    miniChartEl.innerHTML = "";

    const lastTen = getLastNDates(10);
    const totals = lastTen.map((dateKey) => {
        const bySubject = state.logs[dateKey] || {};
        return Object.values(bySubject).reduce((sum, value) => sum + (Number(value) || 0), 0);
    });

    const max = Math.max(...totals, 1);

    lastTen.forEach((dateKey, index) => {
        const value = totals[index];
        const ratio = value / max;

        const col = document.createElement("div");
        col.className = "mini-chart-col";

        const bar = document.createElement("div");
        bar.className = "mini-chart-bar";
        bar.style.height = `${Math.max(8, Math.round(ratio * 100))}%`;
        bar.title = `${value} min`;

        const valueLabel = document.createElement("span");
        valueLabel.textContent = `${value}`;
        valueLabel.style.fontSize = "0.6rem";
        valueLabel.style.color = "var(--text-secondary)";
        valueLabel.style.lineHeight = "1";

        const day = document.createElement("span");
        day.className = "mini-chart-day";
        const dateObj = new Date(`${dateKey}T00:00:00`);
        day.textContent = dateObj.toLocaleDateString(undefined, { month: "short", day: "2-digit" });

        col.appendChild(valueLabel);
        col.appendChild(bar);
        col.appendChild(day);
        miniChartEl.appendChild(col);
    });
}

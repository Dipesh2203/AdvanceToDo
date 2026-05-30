// Dashboard module: analytics, summary, streak, attention, mini chart
// Exports: renderAnalysis, renderMiniChart, renderStreak, renderSummary, renderAttentionNext

export function renderSummary(appState, isSingletonTask, getTodayLoggedMinutes) {
    const targetTotalEl = document.getElementById("summaryTargetTotal");
    const completedTotalEl = document.getElementById("summaryCompletedTotal");
    const completionRateEl = document.getElementById("summaryCompletionRate");
    const progressBarEl = document.getElementById("summaryProgressBar");

    if (!targetTotalEl || !completedTotalEl || !completionRateEl || !progressBarEl) return;

    const targets = appState.subjects.filter(s => !s.archived).reduce((sum, s) => sum + (Number(s.target) || 0), 0);
    const completed = appState.subjects.filter(s => !s.archived).reduce((sum, s) => {
        if (isSingletonTask(s)) {
            return sum + (getTodayLoggedMinutes(s.id) || 0);
        }
        return sum + (getTodayLoggedMinutes(s.id) || 0);
    }, 0);

    targetTotalEl.textContent = `${targets} min`;
    completedTotalEl.textContent = `${completed} min`;
    const rate = targets > 0 ? Math.round((completed / targets) * 100) : 0;
    completionRateEl.textContent = `${rate}%`;
    progressBarEl.style.width = `${Math.min(100, rate)}%`;
}

export function renderStreak(appState, calculateCurrentStreak, calculateBestStreak) {
    const currentStreakEl = document.getElementById("currentStreak");
    const bestStreakEl = document.getElementById("bestStreak");
    const activeDaysEl = document.getElementById("activeDays");

    if (!currentStreakEl || !bestStreakEl || !activeDaysEl) return;

    const activeDateKeys = Object.keys(appState.logs || {}).filter(k => {
        const total = Object.values(appState.logs[k] || {}).reduce((s, v) => s + (Number(v) || 0), 0);
        return total > 0;
    }).sort();

    const current = calculateCurrentStreak(activeDateKeys);
    const best = calculateBestStreak(activeDateKeys);

    currentStreakEl.textContent = `${current}`;
    bestStreakEl.textContent = `${best}`;
    activeDaysEl.textContent = `${activeDateKeys.length}`;
}

export function renderAnalysis(appState, getLastNDates) {
    const analysisChartEl = document.getElementById("analysisChart");
    const analysisTextEl = document.getElementById("analysisText");
    if (!analysisChartEl || !analysisTextEl) return;

    // Get last 4 weeks of data (28 days)
    const last28 = getLastNDates(28);

    // Aggregate into 4 weeks
    const weeklyPoints = [];
    for (let week = 0; week < 4; week++) {
        let weekTotal = 0;
        for (let day = 0; day < 7; day++) {
            const dateKey = last28[week * 7 + day];
            if (dateKey) {
                const dayLog = appState.logs[dateKey] || {};
                weekTotal += Object.values(dayLog).reduce((s, v) => s + (Number(v) || 0), 0);
            }
        }
        weeklyPoints.push(weekTotal);
    }

    const total = weeklyPoints.reduce((a, b) => a + b, 0);
    analysisTextEl.textContent = `Last 4 weeks total: ${total} min`;

    // Create SVG line chart with axes and labels
    const width = 350;
    const height = 180;
    const padding = 50;
    const innerWidth = width - 2 * padding;
    const innerHeight = height - 2 * padding;

    const maxPoint = Math.max(...weeklyPoints, 420); // Min 7 hours per week
    const xStep = innerWidth / (weeklyPoints.length - 1 || 1);

    // Calculate hour marks (for weekly data, show larger increments)
    const maxHours = Math.ceil(maxPoint / 60);
    const hourIncrement = maxHours > 20 ? 10 : 5;
    const numRanges = Math.ceil(maxHours / hourIncrement);
    const yStep = innerHeight / numRanges;

    // Generate SVG
    let svg = `<svg width="${width}" height="${height}" style="display: block; margin: 0 auto;">
        <!-- Y-axis -->
        <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="var(--text-secondary, #999)" stroke-width="1" />
        <!-- X-axis -->
        <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="var(--text-secondary, #999)" stroke-width="1" />`;

    // Y-axis labels (5-hour increments for weekly data)
    for (let i = 0; i <= numRanges; i++) {
        const y = height - padding - (i * yStep);
        const hours = i * hourIncrement;
        svg += `<text x="${padding - 10}" y="${y + 4}" font-size="10" fill="var(--text-secondary, #999)" text-anchor="end">${hours}h</text>`;
        svg += `<line x1="${padding - 5}" y1="${y}" x2="${padding}" y2="${y}" stroke="var(--text-tertiary, #ddd)" stroke-width="1" />`;
    }

    // X-axis labels (week numbers)
    weeklyPoints.forEach((p, i) => {
        const x = padding + i * xStep;
        svg += `<text x="${x}" y="${height - padding + 20}" font-size="11" fill="var(--text-secondary, #999)" text-anchor="middle">W${i + 1}</text>`;
    });

    // Chart line and points
    svg += `<polyline points="${weeklyPoints.map((p, i) => {
        const x = padding + i * xStep;
        const y = height - padding - (p / maxPoint) * innerHeight;
        return x + ',' + y;
    }).join(' ')}" style="fill: none; stroke: var(--primary, #6366f1); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;" />
    ${weeklyPoints.map((p, i) => {
        const x = padding + i * xStep;
        const y = height - padding - (p / maxPoint) * innerHeight;
        return `<circle cx="${x}" cy="${y}" r="4" fill="var(--primary, #6366f1)" />`;
    }).join('')}
    </svg>`;

    analysisChartEl.innerHTML = svg;
}

export function renderAttentionNext(appState, attentionListEl, attentionSummaryEl, getTodayLoggedMinutes, getTaskProgressMinutes, isSingletonTask, diffDays, formatLongDate, escapeHtml, formatDateKey) {
    if (!attentionListEl) return;

    attentionListEl.innerHTML = "";
    const today = formatDateKey(new Date());
    const todayLog = appState.logs[today] || {};
    const todayTotal = Object.values(todayLog).reduce((sum, value) => sum + (Number(value) || 0), 0);
    const activeDateKeys = Object.keys(appState.logs || {}).filter((dateKey) => {
        const total = Object.values(appState.logs[dateKey] || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
        return total > 0;
    }).sort();

    function calculateCurrentStreakLocal(dateKeys) {
        if (!dateKeys || dateKeys.length === 0) return 0;
        const activeSet = new Set(dateKeys);
        const todayDate = new Date();
        let streak = 0;
        for (let offset = 0; offset < 3650; offset += 1) {
            const d = new Date(todayDate);
            d.setDate(todayDate.getDate() - offset);
            const key = formatDateKey(d);
            if (activeSet.has(key)) {
                streak += 1;
                continue;
            }
            if (offset === 0) continue;
            break;
        }
        return streak;
    }

    const currentStreak = calculateCurrentStreakLocal(activeDateKeys);
    const candidates = [];

    function getDaysSinceLastTouched(subjectId) {
        let lastTouchedKey = null;
        Object.keys(appState.logs || {}).forEach((dateKey) => {
            if (appState.logs[dateKey] && appState.logs[dateKey][subjectId] && Number(appState.logs[dateKey][subjectId]) > 0) {
                if (!lastTouchedKey || dateKey > lastTouchedKey) {
                    lastTouchedKey = dateKey;
                }
            }
        });

        if (!lastTouchedKey) return Number.POSITIVE_INFINITY;
        const todayDate = new Date(`${today}T00:00:00`);
        const lastDate = new Date(`${lastTouchedKey}T00:00:00`);
        return Math.max(0, Math.round((todayDate - lastDate) / 86400000));
    }

    if (currentStreak > 0 && todayTotal === 0) {
        candidates.push({ id: "streak-risk", priority: 100, title: "Protect your streak today", detail: `You are on a ${currentStreak}-day streak. Log at least 1 session today to keep momentum.` });
    }

    appState.subjects.forEach((subject) => {
        if (subject.archived) return;
        const target = Number(subject.target) || 0;
        const totalProgress = getTaskProgressMinutes(subject);
        const totalRemaining = Math.max(0, target - totalProgress);
        if (target <= 0 || totalRemaining <= 0) return;
        const safeName = typeof subject.subject === "string" && subject.subject.trim() ? subject.subject.trim() : "Task";
        const isEveryday = !isSingletonTask(subject);

        const daysSinceTouched = getDaysSinceLastTouched(subject.id);
        let lastTouchedText = !Number.isFinite(daysSinceTouched) ? "Never" : (daysSinceTouched === 0 ? "Today" : `${daysSinceTouched} day${daysSinceTouched === 1 ? "" : "s"} ago`);

        if (subject.dueDate) {
            const daysUntilDue = diffDays(today, subject.dueDate);
            if (daysUntilDue < 0) {
                candidates.push({ id: `overdue:${subject.id}`, priority: 95, daysSinceTouched, title: `${safeName} is overdue`, detail: `Due on ${formatLongDate(subject.dueDate)}. Plan ${totalRemaining} min to recover. Last touched: ${lastTouchedText}` });
            } else if (daysUntilDue === 0) {
                candidates.push({ id: `due-today:${subject.id}`, priority: 90, daysSinceTouched, title: `${safeName} is due today`, detail: `${totalRemaining} min still needed before end of day. Last touched: ${lastTouchedText}` });
            } else if (daysUntilDue <= 2) {
                candidates.push({ id: `due-soon:${subject.id}`, priority: 80 - daysUntilDue, daysSinceTouched, title: `${safeName} is due in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`, detail: `${totalRemaining} min pending. Add a focused block today. Last touched: ${lastTouchedText}` });
            }
        }

        if (isEveryday) {
            const todayLogged = getTodayLoggedMinutes(subject.id);
            const todayGap = Math.max(0, target - todayLogged);
            if (todayGap > 0) {
                candidates.push({ id: `daily-gap:${subject.id}`, priority: 60 + Math.min(20, Math.round((todayGap / Math.max(1, target)) * 20)), daysSinceTouched, title: `${safeName} is behind today's target`, detail: `${todayLogged}/${target} min logged today. ${todayGap} min left. Last touched: ${lastTouchedText}` });
            }
        } else if (!subject.dueDate) {
            candidates.push({ id: `singleton-open:${subject.id}`, priority: 35, daysSinceTouched, title: `${safeName} still open`, detail: `${totalRemaining} min left for this one-time task. Last touched: ${lastTouchedText}` });
        }
    });

    const deduped = [];
    const seen = new Set();

    candidates.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return (b.daysSinceTouched ?? Number.POSITIVE_INFINITY) - (a.daysSinceTouched ?? Number.POSITIVE_INFINITY);
    }).forEach((item) => {
        if (seen.has(item.id)) return;
        seen.add(item.id);
        deduped.push(item);
    });

    const nextItems = deduped.slice(0, 6);

    if (attentionSummaryEl) {
        attentionSummaryEl.textContent = nextItems.length === 0 ? "No urgent blockers right now. Keep your current rhythm." : `${nextItems.length} priority item${nextItems.length === 1 ? "" : "s"} to focus next`;
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
        let icon = "";
        let subjectId = null;
        if (item.id.startsWith("overdue:") || item.id.startsWith("due-today:") || item.id.startsWith("due-soon:")) {
            subjectId = item.id.split(":")[1];
        } else if (item.id.startsWith("daily-gap:") || item.id.startsWith("singleton-open:")) {
            subjectId = item.id.split(":")[1];
        }
        let subject = null;
        if (subjectId) subject = appState.subjects.find(s => s.id === subjectId);
        if (subject && subject.dueDate) icon = "⏰ "; else if (subject && !isSingletonTask(subject)) icon = "📅 ";

        li.innerHTML = `<strong>${escapeHtml(item.title ? item.title : item.id ? item.id : '')}</strong><span>${escapeHtml(item.detail ? item.detail : '')}</span>`;
        attentionListEl.appendChild(li);
    });
}

export function renderMiniChart(appState, getLastNDates) {
    const miniChartEl = document.getElementById("miniChart");
    if (!miniChartEl) return;

    const last10 = getLastNDates(10);
    const points = last10.map((d) => Object.values(appState.logs[d] || {}).reduce((s, v) => s + (Number(v) || 0), 0));

    // Create SVG line chart with axes and labels
    const width = 380;
    const height = 180;
    const padding = 50;
    const innerWidth = width - 2 * padding;
    const innerHeight = height - 2 * padding;

    const maxPoint = Math.max(...points, 60);
    const xStep = innerWidth / (points.length - 1 || 1);

    // Calculate hour marks
    const maxHours = Math.ceil(maxPoint / 60);
    const yStep = innerHeight / (maxHours || 1);

    // Generate SVG
    let svg = `<svg width="${width}" height="${height}" style="display: block; margin: 0 auto;">
        <!-- Y-axis -->
        <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="var(--text-secondary, #999)" stroke-width="1" />
        <!-- X-axis -->
        <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="var(--text-secondary, #999)" stroke-width="1" />`;

    // Y-axis labels (hours)
    for (let i = 0; i <= maxHours; i++) {
        const y = height - padding - (i * yStep);
        svg += `<text x="${padding - 10}" y="${y + 4}" font-size="11" fill="var(--text-secondary, #999)" text-anchor="end">${i}h</text>`;
        svg += `<line x1="${padding - 5}" y1="${y}" x2="${padding}" y2="${y}" stroke="var(--text-tertiary, #ddd)" stroke-width="1" />`;
    }

    // X-axis labels (dates - showing every other date to avoid crowding)
    last10.forEach((dateKey, i) => {
        const x = padding + i * xStep;
        // Show every other date
        if (i % 2 === 0 || i === last10.length - 1) {
            const [year, month, day] = dateKey.split('-');
            const dateLabel = `${month}/${day}`;
            svg += `<text x="${x}" y="${height - padding + 20}" font-size="11" fill="var(--text-secondary, #999)" text-anchor="middle">${dateLabel}</text>`;
        }
    });

    // Chart line and points
    svg += `<polyline points="${points.map((p, i) => {
        const x = padding + i * xStep;
        const y = height - padding - (p / maxPoint) * innerHeight;
        return x + ',' + y;
    }).join(' ')}" style="fill: none; stroke: var(--primary, #6366f1); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;" />
    ${points.map((p, i) => {
        const x = padding + i * xStep;
        const y = height - padding - (p / maxPoint) * innerHeight;
        return `<circle cx="${x}" cy="${y}" r="3" fill="var(--primary, #6366f1)" />`;
    }).join('')}
    </svg>`;

    miniChartEl.innerHTML = svg;
}

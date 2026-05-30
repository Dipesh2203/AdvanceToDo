/**
 * Activity timeline and session log rendering.
 */

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

export function getHistoryTimelineDays(sessionsByDay) {
    const grouped = new Map();

    for (const [dayKey, sessions] of Object.entries(sessionsByDay || {})) {
        if (!Array.isArray(sessions)) {
            continue;
        }

        if (!grouped.has(dayKey)) {
            grouped.set(dayKey, []);
        }

        sessions.forEach((session) => {
            grouped.get(dayKey).push({
                ...session,
                dayKey
            });
        });
    }

    return Array.from(grouped.entries())
        .sort((a, b) => String(b[0]).localeCompare(String(a[0])))
        .map(([dayKey, daySessions]) => {
            const totalMinutes = daySessions.reduce(
                (sum, session) => sum + (Number(session.elapsedMinutes) || 0),
                0
            );

            return {
                dayKey,
                sessions: daySessions,
                totalMinutes
            };
        });
}

export function renderSessionLog({
    sessionLogEl,
    sessionDateEl,
    sessions,
    filterLabel,
    formatClock,
    formatDuration,
    formatLongDate,
    escapeHtml
}) {
    if (!sessionLogEl) {
        return;
    }

    sessionLogEl.innerHTML = "";

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

export function renderActivityTimelineCard({
    activityTimelineListEl,
    activityTimelineSubtitleEl,
    days,
    filterLabel,
    formatClock,
    formatDuration,
    formatLongDate,
    formatDate,
    escapeHtml
}) {
    if (!activityTimelineListEl) {
        return;
    }

    activityTimelineListEl.innerHTML = "";

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
                const label = `${session.subjectName}`;
                const timeRange = `${formatClock(session.startedAt)} - ${formatClock(session.endedAt)}`;

                return `
                    <div class="activity-segment" style="top: ${segment.left}%; height: ${segment.width}%;" aria-label="${escapeHtml(label)}">
                        <div class="activity-tooltip">
                            <strong>${escapeHtml(label)}</strong>
                            <span>${timeRange}</span>
                        </div>
                    </div>`;
            })
            .join("");

        item.innerHTML = `
            <div class="activity-track-wrap" aria-label="Activity timeline for ${formatLongDate(day.dayKey)}">
                <div class="activity-scale">
                    <span>12a</span>
                    <span>6a</span>
                    <span>12p</span>
                    <span>6p</span>
                    <span>12a</span>
                </div>
                <div class="activity-track">
                    ${segmentsHtml}
                </div>
            </div>
            <div class="activity-day-meta">
                <strong>${formatDate(day.dayKey)}</strong>
                <span>${day.sessions.length} sessions</span>
                <span>${formatDuration(day.totalMinutes)}</span>
            </div>
        `;

        activityTimelineListEl.appendChild(item);
    });
}

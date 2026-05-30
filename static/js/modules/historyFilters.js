function getRangeContext(rangeState, todayKey, formatDateKey, formatLongDate, labels) {
    const now = new Date();

    if (rangeState.range === "today") {
        return {
            label: labels.today,
            startKey: todayKey,
            endKey: todayKey
        };
    }

    if (rangeState.range === "week") {
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - 6);
        return {
            label: labels.week,
            startKey: formatDateKey(weekStart),
            endKey: todayKey
        };
    }

    if (rangeState.range === "month") {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return {
            label: labels.month,
            startKey: formatDateKey(monthStart),
            endKey: todayKey
        };
    }

    if (rangeState.range === "date") {
        const selectedDate = rangeState.customDate || todayKey;
        return {
            label: labels.date(selectedDate, formatLongDate),
            startKey: selectedDate,
            endKey: selectedDate
        };
    }

    return {
        label: labels.all,
        startKey: null,
        endKey: null
    };
}

function applyRangeFilter(dateKeys, rangeState, todayKey, formatDateKey, formatLongDate, labels) {
    const { startKey, endKey } = getRangeContext(rangeState, todayKey, formatDateKey, formatLongDate, labels);

    return dateKeys.filter((dateKey) => {
        if (!startKey || !endKey) {
            return true;
        }

        return dateKey >= startKey && dateKey <= endKey;
    });
}

export function getLogFilterContext(logFilterState, todayKey, formatDateKey, formatLongDate) {
    return getRangeContext(logFilterState, todayKey, formatDateKey, formatLongDate, {
        today: "Showing: Today",
        week: "Showing: This Week",
        month: "Showing: This Month",
        date: (selectedDate, formatter) => `Showing: ${formatter(selectedDate)}`,
        all: "Showing: All Time"
    });
}

export function getTaskTimeFilterContext(taskTimeFilterState, todayKey, formatDateKey, formatLongDate) {
    return getRangeContext(taskTimeFilterState, todayKey, formatDateKey, formatLongDate, {
        today: "Today",
        week: "This Week",
        month: "This Month",
        date: (selectedDate, formatter) => formatter(selectedDate),
        all: "All Time"
    });
}

export function filterDateKeys(dateKeys, logFilterState, todayKey, formatDateKey, formatLongDate) {
    return applyRangeFilter(dateKeys, logFilterState, todayKey, formatDateKey, formatLongDate, {
        today: "Showing: Today",
        week: "Showing: This Week",
        month: "Showing: This Month",
        date: (selectedDate, formatter) => `Showing: ${formatter(selectedDate)}`,
        all: "Showing: All Time"
    });
}

export function getFilteredDateKeysForTaskTime(logs, taskTimeFilterState, todayKey, formatDateKey, formatLongDate) {
    return applyRangeFilter(Object.keys(logs || {}), taskTimeFilterState, todayKey, formatDateKey, formatLongDate, {
        today: "Today",
        week: "This Week",
        month: "This Month",
        date: (selectedDate, formatter) => formatter(selectedDate),
        all: "All Time"
    }).sort();
}

export function getFilteredSessions(sessionsByDay, logFilterState, todayKey, formatDateKey, formatLongDate) {
    const allSessions = [];

    for (const [dayKey, sessions] of Object.entries(sessionsByDay || {})) {
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

    const allowedDayKeys = new Set(
        filterDateKeys(allSessions.map((session) => session.dayKey), logFilterState, todayKey, formatDateKey, formatLongDate)
    );

    return allSessions
        .filter((session) => allowedDayKeys.has(session.dayKey))
        .sort((a, b) => Number(b.endedAt || b.startedAt) - Number(a.endedAt || a.startedAt));
}
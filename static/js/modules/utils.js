// Utility helpers extracted from script.js
export function formatClock(timestamp) {
    return new Date(timestamp).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit"
    });
}

export function formatDuration(minutes) {
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

export function formatLongDate(dateKey) {
    const date = new Date(`${dateKey}T00:00:00`);
    return date.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric"
    });
}

export function formatDate(dateKey) {
    const date = new Date(`${dateKey}T00:00:00`);
    return date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
    });
}

export function formatDateKey(date) {
    return date.toISOString().slice(0, 10);
}

export function getLastNDates(count) {
    const dates = [];

    for (let i = count - 1; i >= 0; i -= 1) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        dates.push(formatDateKey(date));
    }

    return dates;
}

export function shortWeekday(dateKey) {
    const date = new Date(`${dateKey}T00:00:00`);
    return date.toLocaleDateString(undefined, { weekday: "short" });
}

export function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

export function escapeHtml(value) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

export function diffDays(previousKey, currentKey) {
    const prev = new Date(`${previousKey}T00:00:00`);
    const curr = new Date(`${currentKey}T00:00:00`);
    return Math.round((curr - prev) / 86400000);
}

export function normalizeDueDateInput(value) {
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

export function normalizeTagList(value) {
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

export function normalizeFrequencyInput(value) {
    return value === "singleton" ? "singleton" : "everyday";
}

export function isLegacyCreationDateDeadline(subject, dueDate) {
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

export function normalizeSubjectDueDate(subject, todayKey) {
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

export function createId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }

    return `sub-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
}
// Task domain logic module
// Handles task queries, progress calculation, and factor tracking

import { getAppState, getTodayKey } from "../state.js";
import { normalizeFrequencyInput, normalizeTagList, createId } from "./utils.js";

// Injected dependency for timer elapsed calculation
let getAdjustedTimerElapsedMinutesRef = null;

export function initializeTasksModule(deps) {
    getAdjustedTimerElapsedMinutesRef = deps.getAdjustedTimerElapsedMinutes;
}

// Pure query functions

export function isSingletonTask(subject) {
    return normalizeFrequencyInput(subject && subject.frequency) === "singleton";
}

export function getTaskTargetSuffix(subject) {
    return isSingletonTask(subject) ? "total" : "today";
}

export function getTodayLoggedMinutes(subjectId) {
    const appState = getAppState();
    const todayKey = getTodayKey();
    return Number((appState.logs[todayKey] || {})[subjectId]) || 0;
}

export function getTotalLoggedMinutes(subjectId) {
    const appState = getAppState();
    return Object.values(appState.logs).reduce((sum, dayLog) => sum + (Number(dayLog && dayLog[subjectId]) || 0), 0);
}

export function getTaskProgressMinutes(subject) {
    if (!subject) {
        return 0;
    }

    return isSingletonTask(subject) ? getTotalLoggedMinutes(subject.id) : getTodayLoggedMinutes(subject.id);
}

export function getLiveTaskProgressMinutes(subject) {
    if (!subject) {
        return 0;
    }

    const appState = getAppState();
    const baseProgress = getTaskProgressMinutes(subject);
    const startedAt = appState.activeTimers[subject.id];

    if (!startedAt) {
        return baseProgress;
    }

    if (!getAdjustedTimerElapsedMinutesRef) {
        return baseProgress;
    }

    const elapsedMinutes = getAdjustedTimerElapsedMinutesRef(startedAt);
    return baseProgress + elapsedMinutes;
}

export function isTaskCompleted(subject) {
    const target = Number(subject && subject.target) || 0;
    return target > 0 && getTaskProgressMinutes(subject) >= target;
}

// State mutation functions

export function applyFactorProgress(subjectId, deltaMinutes, selectedFactorTag = null, dayKey = getTodayKey()) {
    const appState = getAppState();
    const numericDelta = Number(deltaMinutes) || 0;

    if (numericDelta === 0) {
        return;
    }

    const subject = appState.subjects.find((item) => item.id === subjectId);
    if (!subject) {
        return;
    }

    const factorTags = normalizeTagList(subject.factorTags);
    if (factorTags.length === 0) {
        return;
    }

    if (!appState.factorLogs[dayKey] || typeof appState.factorLogs[dayKey] !== "object") {
        appState.factorLogs[dayKey] = {};
    }

    const applyDelta = (factorTag, amount) => {
        if (!factorTag || !amount) {
            return;
        }

        const current = Number(appState.factorLogs[dayKey][factorTag] || 0);
        const next = current + amount;

        if (next <= 0) {
            delete appState.factorLogs[dayKey][factorTag];
            return;
        }

        appState.factorLogs[dayKey][factorTag] = next;
    };

    const validSelectedFactor = factorTags.includes(selectedFactorTag) ? selectedFactorTag : null;
    if (validSelectedFactor) {
        applyDelta(validSelectedFactor, numericDelta);
        return;
    }

    const share = numericDelta / factorTags.length;
    factorTags.forEach((factorTag) => applyDelta(factorTag, share));
}

export function addSessionLog(subjectId, startedAt, endedAt, elapsedMinutes, dayKey) {
    const appState = getAppState();

    if (!appState.sessions[dayKey]) {
        appState.sessions[dayKey] = [];
    }

    const subjectName = appState.subjects.find((item) => item.id === subjectId)?.subject || "Unknown";

    appState.sessions[dayKey].unshift({
        id: createId(),
        subjectId,
        subjectName,
        startedAt,
        endedAt,
        elapsedMinutes
    });

    appState.sessions[dayKey] = appState.sessions[dayKey].slice(0, 20);
}

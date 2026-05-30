/**
 * Application State Management
 * Central state objects shared across modules
 */

import * as auth from "./modules/auth.js";

// Current date key, updated via updateTodayKey()
let todayKey = "";

export const state = {
    subjects: [],
    logs: {},
    factorLogs: {},
    sessions: {},
    activeTimers: {},
    reworkPlans: {},
    timerDowntimePeriods: [],
    isServerReachable: async function() {
        try {
            const response = await fetch("/api/me", {
                method: "GET",
                cache: "no-store"
            });
            return response.ok;
        } catch (_error) {
            return false;
        }
    }
};

export const timerTargetAlerts = {};
export const taskCompletionAlerts = {};

// UI state references
export let pendingSaveTimer = null;
export let notificationServiceWorkerRegistration = null;
export let inlineSpendEditorSubjectId = null;
export let editingSubjectId = null;
export let currentStoreKey = null;
export let taskPipWindowRef = null;
export let taskPipSubjectId = null;

// Filter states
export const logFilterState = {
    range: "today",
    customDate: null
};

export const taskTimeFilterState = {
    range: "today",
    customDate: null,
    subjectId: "all"
};

export const contributionGraphState = {
    year: String(new Date().getFullYear())
};

// Setter functions for state updates
export function setPendingSaveTimer(value) {
    pendingSaveTimer = value;
}

export function setNotificationServiceWorkerRegistration(value) {
    notificationServiceWorkerRegistration = value;
}

export function setInlineSpendEditorSubjectId(value) {
    inlineSpendEditorSubjectId = value;
}

export function setEditingSubjectId(value) {
    editingSubjectId = value;
}

export function setCurrentStoreKey(value) {
    currentStoreKey = value;
}

export function setTaskPipWindowRef(value) {
    taskPipWindowRef = value;
}

export function setTaskPipSubjectId(value) {
    taskPipSubjectId = value;
}

// Getter functions for unified state access
export function getAppState() {
    return state;
}

export function getAuthState() {
    return auth.authState;
}

export function getTodayKey() {
    return todayKey;
}

export function updateTodayKey(newKey) {
    todayKey = newKey;
}

export function getLogFilterState() {
    return logFilterState;
}

export function getTaskTimeFilterState() {
    return taskTimeFilterState;
}

export function getContributionGraphState() {
    return contributionGraphState;
}


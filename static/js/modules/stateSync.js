export function applyParsedState({ appState, normalizeFrequencyInput, normalizeSubjectDueDate, normalizeTagList, normalizeTimerDowntimePeriods, todayKey }, parsed) {
    if (!parsed || typeof parsed !== "object") {
        return;
    }

    appState.subjects = [];
    appState.logs = {};
    appState.factorLogs = {};
    appState.sessions = {};
    appState.activeTimers = {};
    appState.reworkPlans = {};

    if (Array.isArray(parsed.subjects)) {
        appState.subjects = parsed.subjects
            .filter((item) => item && item.id && item.subject && Number(item.target) > 0)
            .map((item) => ({
                id: item.id,
                subject: item.subject,
                target: Number(item.target),
                frequency: normalizeFrequencyInput(item.frequency),
                dueDate: normalizeSubjectDueDate(item, todayKey),
                skillTags: normalizeTagList(item.skillTags),
                factorTags: normalizeTagList(item.factorTags),
                archived: Boolean(item.archived)
            }));
    }

    if (parsed.logs && typeof parsed.logs === "object") {
        appState.logs = parsed.logs;
    }

    if (parsed.factorLogs && typeof parsed.factorLogs === "object") {
        appState.factorLogs = parsed.factorLogs;
    }

    if (parsed.sessions && typeof parsed.sessions === "object") {
        appState.sessions = parsed.sessions;
    }

    if (parsed.activeTimers && typeof parsed.activeTimers === "object") {
        appState.activeTimers = Object.fromEntries(
            Object.entries(parsed.activeTimers).filter(([, timestamp]) => Number(timestamp) > 0)
        );
    }

    if (parsed.reworkPlans && typeof parsed.reworkPlans === "object") {
        appState.reworkPlans = Object.fromEntries(
            Object.entries(parsed.reworkPlans)
                .filter(([taskId, plan]) => {
                    const hasActiveTimer = Number(appState.activeTimers[taskId]) > 0;
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

    appState.timerDowntimePeriods = normalizeTimerDowntimePeriods(parsed.timerDowntimePeriods);
}

export function buildPersistedState(appState) {
    return {
        subjects: appState.subjects,
        logs: appState.logs,
        factorLogs: appState.factorLogs,
        sessions: appState.sessions,
        activeTimers: appState.activeTimers,
        reworkPlans: appState.reworkPlans,
        timerDowntimePeriods: appState.timerDowntimePeriods
    };
}

export function scheduleStateSave({ state, saveDelayMs, persistStateToServer }) {
    if (state.pendingSaveTimer) {
        clearTimeout(state.pendingSaveTimer);
    }

    state.setPendingSaveTimer(setTimeout(() => {
        state.setPendingSaveTimer(null);
        void persistStateToServer();
    }, saveDelayMs));
}

export async function isServerReachable() {
    try {
        const response = await fetch("/api/health", {
            method: "HEAD",
            cache: "no-store",
            signal: AbortSignal.timeout(2000)
        });
        return response.ok;
    } catch (_error) {
        return false;
    }
}

export async function persistStateToServer({ authState, apiStateEndpoint, appState, buildPersistedState, handleSessionExpiration }) {
    if (!authState.user) {
        return;
    }

    try {
        const response = await fetch(apiStateEndpoint, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "same-origin",
            body: JSON.stringify({ state: buildPersistedState(appState) })
        });

        if (response.status === 401) {
            handleSessionExpiration("Your session expired. Please sign in again.");
        }
    } catch (_error) {
        // Keep running with local storage when backend sync fails.
    }
}

export function getCurrentStoreKey({ authState, state, storeKeyBase }) {
    if (authState.user && Number(authState.user.id) > 0) {
        return `${storeKeyBase}:${authState.user.id}`;
    }

    return state.currentStoreKey || storeKeyBase;
}

export function handleSessionExpiration({ state, appState, auth, closeTaskPictureInPicture, clearTaskFormInputs, clearTaskFormEditState, render }, message) {
    state.setPendingSaveTimer(null);
    resetPersistedState({ state, appState, closeTaskPictureInPicture, clearTaskFormInputs, clearTaskFormEditState, render });
    auth.setAuthenticatedUser(null);
    auth.showAuthGate(message);
}

export function resetPersistedState({ state, appState, closeTaskPictureInPicture, clearTaskFormInputs, clearTaskFormEditState, render }) {
    appState.subjects = [];
    appState.logs = {};
    appState.factorLogs = {};
    appState.sessions = {};
    appState.activeTimers = {};
    appState.reworkPlans = {};
    closeTaskPictureInPicture();
    clearTaskFormInputs();
    clearTaskFormEditState();

    if (state.pendingSaveTimer) {
        clearTimeout(state.pendingSaveTimer);
        state.setPendingSaveTimer(null);
    }

    render();
}
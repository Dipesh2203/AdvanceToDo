const STORE_KEY_BASE = "study-tracker-v1";
const API_STATE_ENDPOINT = "/api/state";

// State persistence layer
// Injected dependencies passed from script.js
let stateRef;
let authStateRef;
let appStateRef;
let normalizeFrequencyInputRef;
let normalizeSubjectDueDateRef;
let normalizeTagListRef;
let normalizeTimerDowntimePeriodsRef;
let reportErrorRef;
let applyParsedStateRef;
let scheduleStateSaveRef;

export function initializeStorageModule(deps) {
    stateRef = deps.state;
    authStateRef = deps.authState;
    appStateRef = deps.appState;
    normalizeFrequencyInputRef = deps.normalizeFrequencyInput;
    normalizeSubjectDueDateRef = deps.normalizeSubjectDueDate;
    normalizeTagListRef = deps.normalizeTagList;
    normalizeTimerDowntimePeriodsRef = deps.normalizeTimerDowntimePeriods;
    reportErrorRef = deps.reportError;
    applyParsedStateRef = deps.applyParsedState;
    scheduleStateSaveRef = deps.scheduleStateSave;
}

export function getCurrentStoreKey() {
    if (authStateRef.user && Number(authStateRef.user.id) > 0) {
        return `${STORE_KEY_BASE}:${authStateRef.user.id}`;
    }

    return stateRef.currentStoreKey || STORE_KEY_BASE;
}

export function buildPersistedState() {
    return {
        subjects: appStateRef.subjects,
        logs: appStateRef.logs,
        factorLogs: appStateRef.factorLogs,
        sessions: appStateRef.sessions,
        activeTimers: appStateRef.activeTimers,
        reworkPlans: appStateRef.reworkPlans,
        timerDowntimePeriods: appStateRef.timerDowntimePeriods
    };
}

export async function isServerReachable() {
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

export async function persistStateToServer() {
    if (!authStateRef.user) {
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
            // Session expired - caller will handle this
            throw new Error("Unauthorized");
        }
    } catch (error) {
        // Keep running with local storage when backend sync fails.
    }
}

export function saveState() {
    if (!authStateRef.user) {
        return;
    }

    const snapshot = buildPersistedState();
    localStorage.setItem(getCurrentStoreKey(), JSON.stringify(snapshot));
    scheduleStateSaveRef();
}

export async function loadState() {
    if (!authStateRef.user) {
        return;
    }

    let localParsed = null;
    const storeKey = getCurrentStoreKey();
    const legacyStoreKey = STORE_KEY_BASE;
    let legacyParsed = null;

    try {
        const userScopedSaved = localStorage.getItem(storeKey);
        const hasUserScopedState = typeof userScopedSaved === "string" && userScopedSaved.trim() !== "";

        if (!hasUserScopedState) {
            localParsed = null;
        } else {
            localParsed = JSON.parse(userScopedSaved);
            applyParsedStateRef(localParsed);
        }

        const canUseLegacyFallback = storeKey !== legacyStoreKey;
        if (canUseLegacyFallback) {
            const legacySaved = localStorage.getItem(legacyStoreKey);
            if (typeof legacySaved === "string" && legacySaved.trim() !== "") {
                legacyParsed = JSON.parse(legacySaved);
            }
        }
    } catch (error) {
        reportErrorRef(error, { context: "loadState.localParse" });
    }

    try {
        const serverReachable = await isServerReachable();

        if (!serverReachable) {
            return;
        }

        const response = await fetch(API_STATE_ENDPOINT, {
            method: "GET",
            cache: "no-store",
            credentials: "same-origin",
            signal: AbortSignal.timeout(5000)
        });

        if (response.status === 401) {
            return { sessionExpired: true };
        }

        if (!response.ok) {
            return;
        }

        const payload = await response.json();
        const remoteState = payload && typeof payload === "object" ? payload.state : null;
        const hasRemoteState = remoteState && typeof remoteState === "object" && Object.keys(remoteState).length > 0;

        if (hasRemoteState) {
            applyParsedStateRef(remoteState);
            localStorage.setItem(storeKey, JSON.stringify(buildPersistedState()));
            return;
        }

        if (!localParsed && legacyParsed) {
            applyParsedStateRef(legacyParsed);
            localStorage.setItem(storeKey, JSON.stringify(buildPersistedState()));
            void persistStateToServer();
            return;
        }

        if (localParsed) {
            void persistStateToServer();
        }
    } catch (error) {
        reportErrorRef(error || "Backend state API unavailable, using local storage only.", { context: "loadState.remoteFetch", level: "warn" });
    }
}

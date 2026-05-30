import * as state from "../state.js";
import { TIMER_REACHABILITY_POLL_MS } from "../constants.js";


const appState = state.state;

let deps = {};

export function initializeTimersModule(injectedDeps) {
    deps = injectedDeps;
}




export function startTimer(subjectId) {
    if (appState.activeTimers[subjectId]) {
        return;
    }

    deps.ensureNotificationPermission();

    appState.activeTimers[subjectId] = Date.now();
    deps.timerTargetAlerts[subjectId] = false;
    deps.saveState();
    deps.renderLogs();
    deps.renderRunningTasks();
    void deps.openTaskPictureInPicture(subjectId);
}


export function stopTimer(subjectId) {
    const startedAt = appState.activeTimers[subjectId];

    if (!startedAt) {
        return;
    }

    const endedAt = Date.now();
    const elapsedMinutes = getAdjustedTimerElapsedMinutes(startedAt, endedAt);
    const dayKey = deps.formatDateKey(new Date(startedAt));
    const subject = appState.subjects.find((item) => item.id === subjectId);

    appState.timerDowntimePeriods = appState.timerDowntimePeriods.filter((period) => {
        const endTime = Number(period && period.endedAt);
        return Number.isFinite(endTime) && endTime >= 0;
    });

    if (!appState.logs[dayKey]) {
        appState.logs[dayKey] = {};
    }

    const existing = Number(appState.logs[dayKey][subjectId]) || 0;
    let minutesToAdd = elapsedMinutes;
    const progressBefore = subject ? (deps.isSingletonTask(subject) ? deps.getTotalLoggedMinutes(subjectId) : existing) : existing;
    const reworkPlan = appState.reworkPlans[subjectId];

    if (subject && reworkPlan && Number(reworkPlan.extraMinutes) > 0) {
        const reworkTarget = Number(reworkPlan.baseProgress) + Number(reworkPlan.extraMinutes);
        const projectedRework = progressBefore + elapsedMinutes;

        if (projectedRework > reworkTarget) {
            minutesToAdd = Math.max(0, reworkTarget - progressBefore);
            deps.sendTimerNotification("Rework Target Capped", `${subject.subject} was capped at +${reworkPlan.extraMinutes} min rework.`);
        }
    } else if (subject && Number(subject.target) > 0) {
        const target = Number(subject.target);
        const projected = progressBefore + elapsedMinutes;

        if (progressBefore < target && projected > target) {
            minutesToAdd = Math.max(0, target - progressBefore);
            deps.sendTimerNotification("Target Capped", `${subject.subject} was capped at ${target} min.`);
        }
    }

    appState.logs[dayKey][subjectId] = existing + minutesToAdd;

    if (minutesToAdd > 0) {
        deps.applyFactorProgress(subjectId, minutesToAdd, null, dayKey);
    }

    if (minutesToAdd > 0) {
        deps.addSessionLog(subjectId, startedAt, endedAt, minutesToAdd, dayKey);
    }

    if (subject) {
        deps.sendTimerNotification("Session Saved", `${subject.subject}: ${minutesToAdd} min logged.`);
    }

    delete appState.activeTimers[subjectId];
    delete deps.timerTargetAlerts[subjectId];

    if (reworkPlan) {
        const reworkTarget = Number(reworkPlan.baseProgress) + Number(reworkPlan.extraMinutes);
        const nextProgress = progressBefore + minutesToAdd;
        if (nextProgress >= reworkTarget) {
            deps.sendTimerNotification("Rework Completed", `${subject ? subject.subject : "Task"} finished +${reworkPlan.extraMinutes} min rework.`);
        }
        delete appState.reworkPlans[subjectId];
    }

    deps.saveState();
    deps.render();
    deps.refreshTaskPictureInPicture();
}


export function monitorRunningTimers() {
    appState.subjects.forEach((item) => {
        if (item.archived) {
            return;
        }
        const startedAt = appState.activeTimers[item.id];
        if (!startedAt) {
            return;
        }

        const logged = deps.getTaskProgressMinutes(item);
        const elapsedMinutes = getAdjustedTimerElapsedMinutes(startedAt);
        const projected = logged + elapsedMinutes;
        const reworkPlan = appState.reworkPlans[item.id];

        if (reworkPlan && Number(reworkPlan.extraMinutes) > 0) {
            const reworkTarget = Number(reworkPlan.baseProgress) + Number(reworkPlan.extraMinutes);
            if (projected >= reworkTarget && !deps.timerTargetAlerts[item.id]) {
                deps.timerTargetAlerts[item.id] = true;
                deps.sendTimerNotification("Rework Target Reached", `${item.subject} reached +${reworkPlan.extraMinutes} min rework.`);
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

        if (projected >= target && !deps.timerTargetAlerts[item.id]) {
            handleRunningTargetReached(item, logged, target);
        }
    });
}


export function handleRunningTargetReached(subject, logged, target) {
    deps.timerTargetAlerts[subject.id] = true;
    deps.sendTimerNotification("Target Reached", `${subject.subject} reached ${target} min. Auto-completing task.`);
    autoCompleteRunningTask(subject.id, logged, target);
}

export function autoCompleteRunningTask(subjectId, logged, target) {
    const startedAt = appState.activeTimers[subjectId];
    if (!startedAt) {
        return;
    }

    const subjectName = appState.subjects.find((item) => item.id === subjectId)?.subject || "Task";

    const dayKey = deps.formatDateKey(new Date(startedAt));
    if (!appState.logs[dayKey]) {
        appState.logs[dayKey] = {};
    }

    const existing = Number(appState.logs[dayKey][subjectId]) || 0;
    const minutesToAdd = Math.max(0, target - logged);

    if (minutesToAdd > 0) {
        appState.logs[dayKey][subjectId] = existing + minutesToAdd;
        deps.applyFactorProgress(subjectId, minutesToAdd, null, dayKey);
        deps.addSessionLog(subjectId, startedAt, Date.now(), minutesToAdd, dayKey);
    }

    delete appState.activeTimers[subjectId];
    delete deps.timerTargetAlerts[subjectId];
    delete appState.reworkPlans[subjectId];
    deps.taskCompletionAlerts[`${dayKey}:${subjectId}`] = true;
    deps.sendTimerNotification("Timer Completed", `${subjectName} was auto-completed at ${target} min.`);
    deps.saveState();
    deps.render();
    deps.refreshTaskPictureInPicture();
}


export function getAdjustedTimerElapsedMilliseconds(startedAt, currentTime = Date.now()) {
    const start = Number(startedAt);
    const now = Number(currentTime);

    if (!Number.isFinite(start) || start <= 0 || !Number.isFinite(now) || now < start) {
        return 0;
    }

    return Math.max(0, now - start - getTimerDowntimeMilliseconds(start, now));
}

export function getAdjustedTimerElapsedMinutes(startedAt, currentTime = Date.now()) {
    return Math.max(1, Math.round(getAdjustedTimerElapsedMilliseconds(startedAt, currentTime) / 60000));
}

export function getTimerDowntimeMilliseconds(startedAt, currentTime = Date.now()) {
    const start = Number(startedAt);
    const now = Number(currentTime);

    if (!Number.isFinite(start) || start <= 0 || !Number.isFinite(now) || now < start) {
        return 0;
    }

    return appState.timerDowntimePeriods.reduce((total, period) => {
        const periodStart = Number(period && period.startedAt);
        if (!Number.isFinite(periodStart) || periodStart <= 0) {
            return total;
        }

        const periodEnd = Number(period && period.endedAt);
        if (!Number.isFinite(periodEnd) || periodEnd < periodStart) {
            return total;
        }

        const overlapStart = Math.max(start, periodStart);
        const overlapEnd = Math.min(now, periodEnd);

        if (overlapEnd <= overlapStart) {
            return total;
        }

        return total + (overlapEnd - overlapStart);
    }, 0);
}

export function normalizeTimerDowntimePeriods(periods) {
    if (!Array.isArray(periods)) {
        return [];
    }

    return periods
        .map((period) => {
            const startedAt = Number(period && period.startedAt);
            if (!Number.isFinite(startedAt) || startedAt <= 0) {
                return null;
            }

            const endedAt = Number(period && period.endedAt);
            return {
                startedAt,
                endedAt: Number.isFinite(endedAt) && endedAt >= startedAt ? endedAt : null
            };
        })
        .filter(Boolean);
}

export
    function updateTimerDowntimePeriods(serverReachable) {
    const now = Date.now();
    const openPeriod = getOpenTimerDowntimePeriod();

    if (!serverReachable) {
        if (openPeriod) {
            return false;
        }

        appState.timerDowntimePeriods.push({ startedAt: now, endedAt: null });
        return true;
    }

    if (!openPeriod) {
        return false;
    }

    openPeriod.endedAt = now;
    return true;
}

export async function refreshTimerDowntimeState() {
    const serverReachable = await appState.isServerReachable();
    if (updateTimerDowntimePeriods(serverReachable)) {
        deps.saveState();
    }
}

export function startTimerDowntimeMonitor() {
    void refreshTimerDowntimeState();

    setInterval(() => {
        void refreshTimerDowntimeState();
    }, TIMER_REACHABILITY_POLL_MS);
}

export function getOpenTimerDowntimePeriod() {
    const lastPeriod = appState.timerDowntimePeriods[appState.timerDowntimePeriods.length - 1];
    if (!lastPeriod || Number(lastPeriod.endedAt) > 0) {
        return null;
    }

    return lastPeriod;
}

export function getRunningTaskIds() {
    return Object.entries(appState.activeTimers)
        .filter(([, startedAt]) => Number(startedAt) > 0)
        .sort((a, b) => Number(a[1]) - Number(b[1]))
        .map(([subjectId]) => subjectId);
}

export function getPreferredTaskPipSubjectId(preferredSubjectId = null) {
    const runningIds = getRunningTaskIds();
    if (runningIds.length === 0) {
        return null;
    }

    if (preferredSubjectId && runningIds.includes(preferredSubjectId)) {
        return preferredSubjectId;
    }

    if (state.taskPipSubjectId && runningIds.includes(state.taskPipSubjectId)) {
        return state.taskPipSubjectId;
    }

    return runningIds[0];
}


export function closeTaskPictureInPicture() {
    if (state.taskPipWindowRef && !state.taskPipWindowRef.closed) {
        state.taskPipWindowRef.close();
    }

    state.setTaskPipWindowRef(null);
    state.setTaskPipSubjectId(null);
}

export async function openTaskPictureInPicture(preferredSubjectId = null) {
    if (!deps.canUseTaskPictureInPicture()) {
        return;
    }

    const subjectId = getPreferredTaskPipSubjectId(preferredSubjectId);
    if (!subjectId) {
        closeTaskPictureInPicture();
        return;
    }

    try {
        if (!state.taskPipWindowRef || state.taskPipWindowRef.closed) {
            state.setTaskPipWindowRef(await window.documentPictureInPicture.requestWindow({
                width: 188,
                height: 102
            }));

            state.taskPipWindowRef.addEventListener("pagehide", () => {
                state.setTaskPipWindowRef(null);
                state.setTaskPipSubjectId(null);
            }, { once: true });
        }

        state.setTaskPipSubjectId(subjectId);
        deps.renderTaskPictureInPicture();
    } catch (_error) {
        // Ignore PiP failures (unsupported browser, blocked popup, or denied permission).
    }
}

export function refreshTaskPictureInPicture() {
    if (!state.taskPipWindowRef || state.taskPipWindowRef.closed) {
        return;
    }

    const subjectId = getPreferredTaskPipSubjectId(state.taskPipSubjectId);
    if (!subjectId) {
        closeTaskPictureInPicture();
        return;
    }

    state.setTaskPipSubjectId(subjectId);
    deps.renderTaskPictureInPicture();
}

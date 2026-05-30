// Import modules
import * as constants from "./constants.js";
import * as state from "./state.js";
import * as auth from "./modules/auth.js";
import * as activityTimeline from "./modules/activityTimeline.js";
import * as contributions from "./modules/contributions.js";
import * as insights from "./modules/insights.js";
import * as theme from "./modules/theme.js";
import * as ui from "./uiElements.js";
import {
    formatClock, formatDuration, formatLongDate, formatDate, formatDateKey, clamp, escapeHtml,
    diffDays, normalizeDueDateInput, normalizeTagList, normalizeFrequencyInput,
    isLegacyCreationDateDeadline, normalizeSubjectDueDate, createId, getLastNDates, shortWeekday
} from "./modules/utils.js";
import { initGlobalErrorHandler, reportError } from "./modules/errorHandler.js";
import * as plan from "./modules/plan.js";
import * as tracker from "./modules/tracker.js";
import * as dashboard from "./modules/dashboard.js";
import * as tasks from "./modules/tasks.js";
import * as timers from "./modules/timers.js";
import * as notifications from "./modules/notifications.js";
import * as carousel from "./modules/carousel.js";
import * as taskControls from "./modules/taskControls.js";
import * as taskViews from "./modules/taskViews.js";
import * as stateSync from "./modules/stateSync.js";
import * as taskStatusViews from "./modules/taskStatusViews.js";
import * as pipView from "./modules/pipView.js";
import * as logsView from "./modules/logsView.js";
import {
    initializeStorageModule,
    loadState,
    saveState
} from "./modules/storage.js";
import {
    filterDateKeys as filterDateKeysModule,
    getFilteredDateKeysForTaskTime as getFilteredDateKeysForTaskTimeModule,
    getFilteredSessions as getFilteredSessionsModule,
    getLogFilterContext as getLogFilterContextModule,
    getTaskTimeFilterContext as getTaskTimeFilterContextModule
} from "./modules/historyFilters.js";
import {
    calculateBestStreak,
    calculateCurrentStreak
} from "./modules/streaks.js";

export const {
    startTimer,
    stopTimer,
    monitorRunningTimers,
    getAdjustedTimerElapsedMinutes,
    startTimerDowntimeMonitor,
    openTaskPictureInPicture,
    closeTaskPictureInPicture,
    refreshTaskPictureInPicture,
    getRunningTaskIds,
    getPreferredTaskPipSubjectId
} = timers;

// Re-export for backward compatibility
export const {
    STORE_KEY_BASE,
    THEME_KEY,
    API_STATE_ENDPOINT,
    API_PENDING_REMINDERS_ENDPOINT,
    SAVE_DEBOUNCE_MS,
    TIMER_REACHABILITY_POLL_MS,
    skillTagMasterList,
    factorTagMasterList
} = constants;

// Re-export state for access
export const {
    timerTargetAlerts,
    taskCompletionAlerts,
    logFilterState,
    taskTimeFilterState,
    contributionGraphState
} = state;

const authState = auth.authState;

// Initialize current store key
state.setCurrentStoreKey(constants.STORE_KEY_BASE);

// Alias state references for backward compatibility
const appState = state.state;

// Initialize todayKey in state manager
let todayKey = formatDateKey(new Date());
state.updateTodayKey(todayKey);
logFilterState.customDate = todayKey;
taskTimeFilterState.customDate = todayKey;

// Initialize tasks module with timer dependencies
tasks.initializeTasksModule({
    getAdjustedTimerElapsedMinutes
});



// Convenience references to tasks module functions for backward compatibility
const isSingletonTask = tasks.isSingletonTask;
const getTaskTargetSuffix = tasks.getTaskTargetSuffix;
const getTodayLoggedMinutes = tasks.getTodayLoggedMinutes;
const getTotalLoggedMinutes = tasks.getTotalLoggedMinutes;
const getTaskProgressMinutes = tasks.getTaskProgressMinutes;
const getLiveTaskProgressMinutes = tasks.getLiveTaskProgressMinutes;
const isTaskCompleted = tasks.isTaskCompleted;
const applyFactorProgress = tasks.applyFactorProgress;
const addSessionLog = tasks.addSessionLog;

initializeStorageModule({
    state,
    authState,
    appState,
    normalizeFrequencyInput,
    normalizeSubjectDueDate,
    normalizeTagList,
    normalizeTimerDowntimePeriods: timers.normalizeTimerDowntimePeriods,
    reportError,
    applyParsedState,
    scheduleStateSave
});

timers.initializeTimersModule({
    saveState,
    render,
    renderLogs,
    renderRunningTasks,
    renderTaskPictureInPicture,
    applyFactorProgress,
    addSessionLog,
    getTaskProgressMinutes,
    getTotalLoggedMinutes,
    isSingletonTask,
    sendTimerNotification: notifications.sendTimerNotification,
    ensureNotificationPermission: notifications.ensureNotificationPermission,
    openTaskPictureInPicture,
    refreshTaskPictureInPicture,
    formatDateKey,
    isServerReachable,
    canUseTaskPictureInPicture,
    timerTargetAlerts,
    taskCompletionAlerts
});

// Create convenience references to UI elements
let planForm,
    subjectInput,
    targetInput,
    frequencyInput,
    deadlineToggleInput,
    dueDateInput,
    skillTagsInput,
    factorTagsInput,
    skillTagSuggestionsEl,
    factorTagSuggestionsEl,
    planList,
    checkPendingButtonEl,
    enableNotificationsButtonEl,
    notificationPermissionStatusEl,
    pendingReminderStatusEl,
    pendingReminderListEl,
    logContainer,
    runningTasksListEl,
    logPrevButtonEl,
    logNextButtonEl,
    logDotsEl,
    completedTaskListEl,
    targetTotalEl,
    completedTotalEl,
    completionRateEl,
    sessionLogEl,
    sessionDateEl,
    logFilterDateEl,
    logFilterSummaryEl,
    logFilterTagEls,
    openPlanButtonEl,
    addTaskPanelEl,
    addTaskPanelTitleEl,
    addTaskPanelSubtitleEl,
    planSubmitButtonEl,
    cancelTaskEditButtonEl,
    openSpendTimeButtonEl,
    spendTimePanelEl,
    spendTimeFormEl,
    spendSubjectSelectEl,
    spendFactorSelectEl,
    spendMinutesInputEl,
    taskTimeLogListEl,
    taskTimeSummaryEl,
    taskTimeFilterDateEl,
    taskTimeSubjectFilterEl,
    taskTimeFilterTagEls,
    progressBarEl,
    currentStreakEl,
    bestStreakEl,
    activeDaysEl,
    analysisChartEl,
    analysisTextEl,
    attentionListEl,
    attentionSummaryEl,
    activityTimelineListEl,
    activityTimelineSubtitleEl,
    todayLabelEl,
    miniChartEl,
    trackerTableBodyEl,
    themeToggleEl,
    contributionYearFilterEl;

// Function to sync UI references from the ui module
function syncUIReferences() {
    planForm = ui.planForm;
    subjectInput = ui.subjectInput;
    targetInput = ui.targetInput;
    frequencyInput = ui.frequencyInput;
    deadlineToggleInput = ui.deadlineToggleInput;
    dueDateInput = ui.dueDateInput;
    skillTagsInput = ui.skillTagsInput;
    factorTagsInput = ui.factorTagsInput;
    skillTagSuggestionsEl = ui.skillTagSuggestionsEl;
    factorTagSuggestionsEl = ui.factorTagSuggestionsEl;
    planList = ui.planList;
    checkPendingButtonEl = ui.checkPendingButtonEl;
    enableNotificationsButtonEl = ui.enableNotificationsButtonEl;
    notificationPermissionStatusEl = ui.notificationPermissionStatusEl;
    pendingReminderStatusEl = ui.pendingReminderStatusEl;
    pendingReminderListEl = ui.pendingReminderListEl;
    logContainer = ui.logContainer;
    runningTasksListEl = ui.runningTasksListEl;
    logPrevButtonEl = ui.logPrevButtonEl;
    logNextButtonEl = ui.logNextButtonEl;
    logDotsEl = ui.logDotsEl;
    completedTaskListEl = ui.completedTaskListEl;
    targetTotalEl = ui.targetTotalEl;
    completedTotalEl = ui.completedTotalEl;
    completionRateEl = ui.completionRateEl;
    sessionLogEl = ui.sessionLogEl;
    sessionDateEl = ui.sessionDateEl;
    logFilterDateEl = ui.logFilterDateEl;
    logFilterSummaryEl = ui.logFilterSummaryEl;
    logFilterTagEls = ui.logFilterTagEls;
    openPlanButtonEl = ui.openPlanButtonEl;
    addTaskPanelEl = ui.addTaskPanelEl;
    addTaskPanelTitleEl = ui.addTaskPanelTitleEl;
    addTaskPanelSubtitleEl = ui.addTaskPanelSubtitleEl;
    planSubmitButtonEl = ui.planSubmitButtonEl;
    cancelTaskEditButtonEl = ui.cancelTaskEditButtonEl;
    openSpendTimeButtonEl = ui.openSpendTimeButtonEl;
    spendTimePanelEl = ui.spendTimePanelEl;
    spendTimeFormEl = ui.spendTimeFormEl;
    spendSubjectSelectEl = ui.spendSubjectSelectEl;
    spendFactorSelectEl = ui.spendFactorSelectEl;
    spendMinutesInputEl = ui.spendMinutesInputEl;
    taskTimeLogListEl = ui.taskTimeLogListEl;
    taskTimeSummaryEl = ui.taskTimeSummaryEl;
    taskTimeFilterDateEl = ui.taskTimeFilterDateEl;
    taskTimeSubjectFilterEl = ui.taskTimeSubjectFilterEl;
    taskTimeFilterTagEls = ui.taskTimeFilterTagEls;
    progressBarEl = ui.progressBarEl;
    currentStreakEl = ui.currentStreakEl;
    bestStreakEl = ui.bestStreakEl;
    activeDaysEl = ui.activeDaysEl;
    analysisChartEl = ui.analysisChartEl;
    analysisTextEl = ui.analysisTextEl;
    attentionListEl = ui.attentionListEl;
    attentionSummaryEl = ui.attentionSummaryEl;
    activityTimelineListEl = ui.activityTimelineListEl;
    activityTimelineSubtitleEl = ui.activityTimelineSubtitleEl;
    todayLabelEl = ui.todayLabelEl;
    miniChartEl = ui.miniChartEl;
    trackerTableBodyEl = ui.trackerTableBodyEl;
    themeToggleEl = ui.themeToggleEl;
    contributionYearFilterEl = ui.contributionYearFilterEl;
}


// Initialize global error handlers early
initGlobalErrorHandler();

initialize().catch((error) => {
    reportError(error, { context: "initialize" });
    try { render(); } catch (_e) { }
});


/**
 * @function initialize
 * @description Central bootstrap function for the application. 
 * * Execution Flow:
 * 1. UI Initialization: Sets up theme, sliders, and auth-related styling.
 * 2. Auth Check (Critical Path): Resolves user identity. If no user is found, 
 * it triggers the 'Auth Gate' (login screen) and halts further setup.
 * 3. Feature Setup: Once authenticated, it initializes:
 * - Notifications: SW registration and permission listeners.
 * - State Management: Loads persistent data and applies UI filters.
 * - Event Listeners: Attaches handlers for forms, navigation, and keyboard shortcuts (ESC).
 * 4. Background Loops: Starts a 1-second interval to monitor active timers, 
 * update Picture-in-Picture mode, and refresh logs if the user isn't typing.
 * 5. Final Render: Triggers the initial UI draw and yearly insights.
 * * @async
 * @returns {Promise<void>}
 * @throws Will log errors to console if service worker registration or state loading fails.
 */

async function initialize() {
    // Initialize UI element references
    ui.setupUIElements();
    syncUIReferences();

    theme.setupThemeToggle();
    setupTaskCardSlider();
    auth.injectAuthStyles();
    auth.setupAuthInterface();
    await auth.resolveAuthState();

    if (!auth.authState.user) {
        auth.showAuthGate();
        auth.updateAuthHeader();
        return;
    }

    await notifications.registerNotificationServiceWorker();
    notifications.setupNotificationActivation();
    auth.setupAuthControls(() => auth.signOutUser(() => {
        // Logout complete, reload page to reset app state
        window.location.href = "/";
    }));
    await loadState();
    setupLogFilters();
    setupTaskTimeLogFilters();
    setupContributionYearFilter();
    if (todayLabelEl) {
        todayLabelEl.textContent = new Date().toLocaleDateString(undefined, {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric"
        });
    }

    if (planForm) {
        planForm.addEventListener("submit", onAddPlan);
    }

    if (cancelTaskEditButtonEl) {
        cancelTaskEditButtonEl.addEventListener("click", cancelTaskEdit);
    }

    if (checkPendingButtonEl) {
        checkPendingButtonEl.addEventListener("click", () => {
            void checkPendingRemindersPreview();
        });
    }

    if (enableNotificationsButtonEl) {
        enableNotificationsButtonEl.addEventListener("click", async () => {
            await notifications.requestNotificationPermissionFromUser();
            notifications.updateNotificationPermissionStatus(notificationPermissionStatusEl);
        });
    }

    if (logPrevButtonEl) {
        logPrevButtonEl.addEventListener("click", () => moveTaskCarousel(-1));
    }

    if (logNextButtonEl) {
        logNextButtonEl.addEventListener("click", () => moveTaskCarousel(1));
    }

    if (dueDateInput) {
        dueDateInput.min = todayKey;
    }

    if (deadlineToggleInput) {
        deadlineToggleInput.addEventListener("change", syncDueDateInputState);
    }

    if (dueDateInput) {
        dueDateInput.addEventListener("focus", () => {
            if (!dueDateInput.value) {
                dueDateInput.value = todayKey;
            }
        });
    }

    syncDueDateInputState();

    if (openPlanButtonEl && addTaskPanelEl) {
        openPlanButtonEl.addEventListener("click", toggleAddTaskPanel);
    }

    if (openSpendTimeButtonEl && spendTimePanelEl) {
        openSpendTimeButtonEl.addEventListener("click", toggleSpendTimePanel);
    }

    if (spendTimeFormEl) {
        spendTimeFormEl.addEventListener("submit", onSpendTimeSubmit);
    }

    if (spendSubjectSelectEl) {
        spendSubjectSelectEl.addEventListener("change", () => {
            refreshSpendFactorOptions();

            if (spendTimePanelEl && spendSubjectSelectEl.value) {
                spendTimePanelEl.dataset.activeSubjectId = spendSubjectSelectEl.value;
            }
        });
    }

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && addTaskPanelEl && !addTaskPanelEl.classList.contains("add-task-panel-hidden")) {
            closeAddTaskPanel();
        }

        if (event.key === "Escape" && spendTimePanelEl && spendTimePanelEl.classList.contains("is-open")) {
            closeSpendTimePanel();
        }
    });

    setInterval(() => {
        if (Object.keys(appState.activeTimers).length === 0) {
            renderRunningTasks();
            refreshTaskPictureInPicture();
            return;
        }

        monitorRunningTimers();
        renderRunningTasks();
        refreshTaskPictureInPicture();

        if (!logContainer) {
            return;
        }

        const activeEl = document.activeElement;
        const isEditingLogInput = Boolean(activeEl && logContainer.contains(activeEl) && activeEl.tagName === "INPUT");

        if (!isEditingLogInput) {
            renderLogs();
        }
    }, 1000);

    startTimerDowntimeMonitor();

    notifications.updateNotificationPermissionStatus(notificationPermissionStatusEl);
    render();
    renderYearInsightCard();
}

function renderYearInsightCard() {
    insights.renderYearInsightCard(appState);
}

function setupTaskCardSlider() {
    carousel.setupTaskCardSlider(logContainer, getTaskCarouselCards, moveTaskCarousel);
}

async function checkPendingRemindersPreview() {
    await taskViews.checkPendingRemindersPreview({ pendingReminderStatusEl, pendingReminderListEl, checkPendingButtonEl, pendingReminderEndpoint: API_PENDING_REMINDERS_ENDPOINT, renderPendingReminderPreview });
}

function renderPendingReminderPreview(pending) {
    taskViews.renderPendingReminderPreview(pending, pendingReminderListEl, formatLongDate, escapeHtml);
}

function setupLogFilters() {
    if (logFilterTagEls.length > 0) {
        logFilterTagEls.forEach((button) => {
            button.addEventListener("click", () => {
                const selectedRange = button.dataset.logFilter;
                if (!selectedRange || selectedRange === logFilterState.range) {
                    return;
                }

                logFilterState.range = selectedRange;
                if (selectedRange !== "date") {
                    updateLogFilterDateInput();
                } else if (!logFilterState.customDate) {
                    logFilterState.customDate = todayKey;
                }

                renderSessionLog();
                renderActivityTimelineCard();
                renderTrackerTable();
                updateLogFilterUi();
            });
        });
    }

    if (logFilterDateEl) {
        logFilterDateEl.value = todayKey;
        logFilterDateEl.addEventListener("change", (event) => {
            const value = event.target.value;
            if (!value) {
                return;
            }

            logFilterState.customDate = value;
            logFilterState.range = "date";
            renderSessionLog();
            renderActivityTimelineCard();
            renderTrackerTable();
            updateLogFilterUi();
        });
    }

    updateLogFilterDateInput();
    updateLogFilterUi();
}

function setupTaskTimeLogFilters() {
    if (taskTimeFilterTagEls.length > 0) {
        taskTimeFilterTagEls.forEach((button) => {
            button.addEventListener("click", () => {
                const selectedRange = button.dataset.taskTimeFilter;
                if (!selectedRange || selectedRange === taskTimeFilterState.range) {
                    return;
                }

                taskTimeFilterState.range = selectedRange;
                if (selectedRange !== "date") {
                    updateTaskTimeDateInput();
                } else if (!taskTimeFilterState.customDate) {
                    taskTimeFilterState.customDate = todayKey;
                }

                updateTaskTimeFilterUi();
                renderTaskTimeLogCard();
            });
        });
    }

    if (taskTimeFilterDateEl) {
        taskTimeFilterDateEl.value = todayKey;
        taskTimeFilterDateEl.addEventListener("change", (event) => {
            const value = event.target.value;
            if (!value) {
                return;
            }

            taskTimeFilterState.customDate = value;
            taskTimeFilterState.range = "date";
            updateTaskTimeFilterUi();
            renderTaskTimeLogCard();
        });
    }

    if (taskTimeSubjectFilterEl) {
        taskTimeSubjectFilterEl.addEventListener("change", (event) => {
            taskTimeFilterState.subjectId = event.target.value || "all";
            renderTaskTimeLogCard();
        });
    }

    updateTaskTimeDateInput();
    updateTaskTimeFilterUi();
}

function setupContributionYearFilter() {
    contributions.setupContributionYearFilter(() => {
        const selectedYear = contributionYearFilterEl?.value;
        if (selectedYear) {
            contributionGraphState.year = selectedYear;
        }
        renderContributionGraph();
    });
}

function updateLogFilterDateInput() {
    if (!logFilterDateEl) {
        return;
    }

    const isCustom = logFilterState.range === "date";
    logFilterDateEl.style.display = isCustom ? "inline-flex" : "none";

    if (isCustom) {
        logFilterDateEl.value = logFilterState.customDate || todayKey;
    }
}

function updateLogFilterUi() {
    if (logFilterTagEls.length > 0) {
        logFilterTagEls.forEach((button) => {
            const isActive = button.dataset.logFilter === logFilterState.range;
            const isHistoryFilterTag = button.classList.contains("history-filter-tag");

            if (isActive) {
                button.style.background = "linear-gradient(135deg, var(--accent-green), var(--accent-blue))";
                button.style.color = "#ffffff";
            } else if (isHistoryFilterTag) {
                button.style.background = "linear-gradient(135deg, #7ba9bd, #5f8da2)";
                button.style.color = "#ffffff";
            } else {
                button.style.background = "linear-gradient(135deg, #f0f4f8, #ffffff)";
                button.style.color = "var(--text-primary)";
            }

            button.style.boxShadow = "var(--shadow-inset)";
            button.setAttribute("aria-pressed", isActive ? "true" : "false");
        });
    }

    if (logFilterSummaryEl) {
        logFilterSummaryEl.textContent = "";
        logFilterSummaryEl.style.display = "none";
    }

    updateLogFilterDateInput();
}

function updateTaskTimeDateInput() {
    if (!taskTimeFilterDateEl) {
        return;
    }

    const isCustom = taskTimeFilterState.range === "date";
    taskTimeFilterDateEl.style.display = isCustom ? "inline-flex" : "none";

    if (isCustom) {
        taskTimeFilterDateEl.value = taskTimeFilterState.customDate || todayKey;
    }
}

function updateTaskTimeFilterUi() {
    if (taskTimeFilterTagEls.length > 0) {
        taskTimeFilterTagEls.forEach((button) => {
            const isActive = button.dataset.taskTimeFilter === taskTimeFilterState.range;
            button.style.background = isActive
                ? "linear-gradient(135deg, var(--accent-green), var(--accent-blue))"
                : "linear-gradient(135deg, #f0f4f8, #ffffff)";
            button.style.color = isActive ? "#ffffff" : "var(--text-primary)";
            button.style.boxShadow = "var(--shadow-inset)";
            button.setAttribute("aria-pressed", isActive ? "true" : "false");
        });
    }

    updateTaskTimeDateInput();
}

function refreshTaskTimeSubjectOptions() {
    if (!taskTimeSubjectFilterEl) {
        return;
    }

    const previous = taskTimeFilterState.subjectId || "all";
    taskTimeSubjectFilterEl.innerHTML = "";

    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "All tasks";
    taskTimeSubjectFilterEl.appendChild(allOption);

    appState.subjects.filter((item) => !item.archived).forEach((item) => {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = item.subject;
        taskTimeSubjectFilterEl.appendChild(option);
    });

    const optionExists = previous === "all" || appState.subjects.filter((item) => !item.archived).some((item) => item.id === previous);
    taskTimeFilterState.subjectId = optionExists ? previous : "all";
    taskTimeSubjectFilterEl.value = taskTimeFilterState.subjectId;
}

function renderTaskTimeLogCard() {
    if (!taskTimeLogListEl || !taskTimeSummaryEl) {
        return;
    }

    taskTimeLogListEl.innerHTML = "";

    const filterContext = getTaskTimeFilterContext();
    const filteredDays = getFilteredDateKeysForTaskTime();
    const selectedSubjectId = taskTimeFilterState.subjectId || "all";

    if (filteredDays.length === 0) {
        taskTimeSummaryEl.textContent = `${filterContext.label}: 0 min logged`;
        const empty = document.createElement("li");
        empty.className = "session-item empty-note";
        empty.textContent = "No logs found for this filter.";
        taskTimeLogListEl.appendChild(empty);
        return;
    }

    if (selectedSubjectId === "all") {
        const totalsBySubject = appState.subjects
            .map((subject) => {
                const total = filteredDays.reduce((sum, dateKey) => {
                    const dayLog = appState.logs[dateKey] || {};
                    return sum + (Number(dayLog[subject.id]) || 0);
                }, 0);

                return {
                    id: subject.id,
                    subjectName: subject.subject,
                    total
                };
            })
            .filter((item) => item.total > 0)
            .sort((a, b) => b.total - a.total);

        const allTaskTotal = totalsBySubject.reduce((sum, item) => sum + item.total, 0);
        taskTimeSummaryEl.textContent = `${filterContext.label}: ${allTaskTotal} min across ${totalsBySubject.length} task${totalsBySubject.length === 1 ? "" : "s"}`;

        if (totalsBySubject.length === 0) {
            const empty = document.createElement("li");
            empty.className = "session-item empty-note";
            empty.textContent = "No task minutes found for this filter.";
            taskTimeLogListEl.appendChild(empty);
            return;
        }

        totalsBySubject.forEach((entry) => {
            const item = document.createElement("li");
            item.className = "session-item";
            item.innerHTML = `<strong>${escapeHtml(entry.subjectName)}</strong><span>${entry.total} min logged</span>`;
            taskTimeLogListEl.appendChild(item);
        });

        return;
    }

    const selectedSubject = appState.subjects.find((item) => item.id === selectedSubjectId);
    if (!selectedSubject) {
        taskTimeFilterState.subjectId = "all";
        refreshTaskTimeSubjectOptions();
        renderTaskTimeLogCard();
        return;
    }

    const perDayEntries = filteredDays
        .map((dateKey) => ({
            dateKey,
            minutes: Number((appState.logs[dateKey] || {})[selectedSubjectId]) || 0
        }))
        .filter((entry) => entry.minutes > 0)
        .sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1));

    const subjectTotal = perDayEntries.reduce((sum, entry) => sum + entry.minutes, 0);
    taskTimeSummaryEl.textContent = `${selectedSubject.subject} • ${filterContext.label}: ${subjectTotal} min logged`;

    if (perDayEntries.length === 0) {
        const empty = document.createElement("li");
        empty.className = "session-item empty-note";
        empty.textContent = "No time logged for this task in the selected filter.";
        taskTimeLogListEl.appendChild(empty);
        return;
    }

    perDayEntries.forEach((entry) => {
        const item = document.createElement("li");
        item.className = "session-item";
        item.innerHTML = `<strong>${formatLongDate(entry.dateKey)}</strong><span>${entry.minutes} min logged</span>`;
        taskTimeLogListEl.appendChild(item);
    });
}

function getLogFilterContext() {
    return getLogFilterContextModule(logFilterState, todayKey, formatDateKey, formatLongDate);
}

function getTaskTimeFilterContext() {
    return getTaskTimeFilterContextModule(taskTimeFilterState, todayKey, formatDateKey, formatLongDate);
}

function getFilteredDateKeysForTaskTime() {
    return getFilteredDateKeysForTaskTimeModule(appState.logs, taskTimeFilterState, todayKey, formatDateKey, formatLongDate);
}

function filterDateKeys(dateKeys) {
    return filterDateKeysModule(dateKeys, logFilterState, todayKey, formatDateKey, formatLongDate);
}

function getFilteredSessions() {
    return getFilteredSessionsModule(appState.sessions, logFilterState, todayKey, formatDateKey, formatLongDate);
}


function onAddPlan(event) {
    taskControls.onAddPlan(event, { appState, state, refs: getTaskControlRefs(), normalizeFrequencyInput, normalizeDueDateInput, normalizeTagList, createId, saveState, render, todayKey, clearTaskFormInputs, clearTaskFormEditState, closeAddTaskPanel });
}

function populateTaskForm(subject) {
    taskControls.populateTaskForm(getTaskControlRefs(), subject, normalizeFrequencyInput, todayKey);
}

function clearTaskFormInputs() {
    taskControls.clearTaskFormInputs({ ...getTaskControlRefs(), todayKey });
}

function setTaskFormMode(isEditing) {
    taskControls.setTaskFormMode(getTaskControlRefs(), isEditing);
}

function clearTaskFormEditState() {
    taskControls.clearTaskFormEditState({ state, refs: getTaskControlRefs() });
}

function beginEditSubject(subjectId) {
    taskControls.beginEditSubject({ appState, state, refs: getTaskControlRefs(), normalizeFrequencyInput, todayKey }, subjectId);
}

function cancelTaskEdit() {
    taskControls.cancelTaskEdit({ state, refs: getTaskControlRefs(), todayKey });
}

function refreshSpendTaskOptions() {
    taskControls.refreshSpendTaskOptions({ appState, refs: getTaskControlRefs(), isSingletonTask, getTotalLoggedMinutes, getTodayLoggedMinutes, refreshSpendFactorOptions: () => taskControls.refreshSpendFactorOptions({ appState, refs: getTaskControlRefs(), normalizeTagList }), normalizeTagList });
}

function openSpendTimePanel(preferredSubjectId = null) {
    taskControls.openSpendTimePanel(getTaskControlRefs(), () => refreshSpendTaskOptions(), () => refreshSpendFactorOptions(), preferredSubjectId);
}

function closeSpendTimePanel() {
    taskControls.closeSpendTimePanel(getTaskControlRefs());
}

function toggleSpendTimePanelForSubject(subjectId) {
    taskControls.toggleSpendTimePanelForSubject(getTaskControlRefs(), () => openSpendTimePanel(subjectId), () => closeSpendTimePanel(), subjectId);
}

function toggleSpendTimePanel() {
    taskControls.toggleSpendTimePanel(getTaskControlRefs(), () => openSpendTimePanel(), () => closeSpendTimePanel());
}

function onSpendTimeSubmit(event) {
    taskControls.onSpendTimeSubmit(event, { appState, refs: getTaskControlRefs(), normalizeTagList, getTodayLoggedMinutes, updateTodayLog, closeSpendTimePanel });
}

function openAddTaskPanel() {
    taskControls.openAddTaskPanel(getTaskControlRefs(), () => closeSpendTimePanel());
}

function closeAddTaskPanel() {
    taskControls.closeAddTaskPanel(getTaskControlRefs());
}

function toggleAddTaskPanel() {
    taskControls.toggleAddTaskPanel(getTaskControlRefs(), () => openAddTaskPanel(), () => closeAddTaskPanel());
}

function archiveSubject(subjectId) {
    taskViews.archiveSubject({ appState, timerTargetAlerts, saveState, render }, subjectId);
}

function deleteSubject(subjectId) {
    taskViews.deleteSubject({ appState, timerTargetAlerts, saveState, render }, subjectId);
}

function removeSubject(subjectId) {
    archiveSubject(subjectId);
}

function updateTodayLog(subjectId, value, shouldRefreshLists = false, factorTag = null) {
    if (!appState.logs[todayKey]) {
        appState.logs[todayKey] = {};
    }

    const previous = Number(appState.logs[todayKey][subjectId] || 0);
    const numeric = Number(value);
    const nextValue = Number.isNaN(numeric) || numeric < 0 ? 0 : numeric;
    appState.logs[todayKey][subjectId] = nextValue;

    applyFactorProgress(subjectId, nextValue - previous, factorTag, todayKey);

    maybeNotifyTaskCompletion(subjectId, previous, nextValue, todayKey);

    saveState();
    if (shouldRefreshLists) {
        renderLogs();
        renderCompletedTasks();
    }
    renderSummary();
    renderStreak();
    renderAnalysis();
    renderAttentionNext();
    renderMiniChart();
    renderTrackerTable();
    renderSessionLog();
    renderTaskTimeLogCard();
}

function maybeNotifyTaskCompletion(subjectId, previousMinutes, nextMinutes, dateKey) {
    const subject = appState.subjects.find((item) => item.id === subjectId);
    const target = Number(subject && subject.target);

    if (!subject || Number.isNaN(target) || target <= 0) {
        return;
    }

    const delta = nextMinutes - previousMinutes;
    const nextProgress = getTaskProgressMinutes(subject);
    const previousProgress = isSingletonTask(subject) ? nextProgress - delta : previousMinutes;

    if (previousProgress >= target || nextProgress < target) {
        return;
    }

    const completionKey = isSingletonTask(subject) ? `singleton:${subjectId}` : `${dateKey}:${subjectId}`;
    if (taskCompletionAlerts[completionKey]) {
        return;
    }

    taskCompletionAlerts[completionKey] = true;
    notifications.sendTimerNotification("Task Completed", `${subject.subject} reached ${target} min ${getTaskTargetSuffix(subject)}.`);
}

function syncDueDateInputState() {
    taskControls.syncDueDateInputState({ dueDateInput, deadlineToggleInput, todayKey });
}

function refreshSpendFactorOptions() {
    taskControls.refreshSpendFactorOptions({ appState, refs: getTaskControlRefs(), normalizeTagList });
}

function getTaskControlRefs() {
    return {
        subjectInput,
        targetInput,
        frequencyInput,
        deadlineToggleInput,
        dueDateInput,
        skillTagsInput,
        factorTagsInput,
        addTaskPanelTitleEl,
        addTaskPanelSubtitleEl,
        planSubmitButtonEl,
        cancelTaskEditButtonEl,
        spendSubjectSelectEl,
        spendFactorSelectEl,
        spendMinutesInputEl,
        spendTimePanelEl,
        addTaskPanelEl,
        openSpendTimeButtonEl,
        openPlanButtonEl
    };
}

function render() {
    if (!authState.user) {
        return;
    }

    refreshSpendTaskOptions();
    refreshTaskTimeSubjectOptions();
    renderTagSuggestions();
    renderPlan();
    renderLogs();
    renderRunningTasks();
    renderCompletedTasks();
    renderSummary();
    renderStreak();
    renderAnalysis();
    renderAttentionNext();
    renderMiniChart();
    renderTrackerTable();
    renderActivityTimelineCard();
    renderSessionLog();
    renderTaskTimeLogCard();
    refreshTaskPictureInPicture();
    renderContributionGraph();
}

function renderRunningTasks() {
    taskStatusViews.renderRunningTasks({ runningTasksListEl, appState, getAdjustedTimerElapsedMinutes, formatDuration, formatClock });
}

function renderPlan() {
    plan.renderPlan(appState, isSingletonTask, formatLongDate, escapeHtml, {
        beginEditSubject,
        archiveSubject,
        renderArchivedTasks,
        planList
    });
}

function renderArchivedTasks() {
    taskViews.renderArchivedTasks({ appState, beginEditSubject, renderPlan, restoreSubject: (id) => taskViews.restoreSubject({ appState, saveState, render }, id), deleteSubject: (id) => taskViews.deleteSubject({ appState, timerTargetAlerts, saveState, render }, id), isSingletonTask, formatLongDate, escapeHtml });
}

function restoreSubject(subjectId) {
    taskViews.restoreSubject({ appState, saveState, render }, subjectId);
}

function renderTagSuggestions() {
    taskViews.renderTagSuggestions({ skillTagSuggestionsEl, factorTagSuggestionsEl, skillTagsInput, factorTagsInput, appState, skillTagMasterList, factorTagMasterList, normalizeTagList, renderTagSuggestionGroup: taskViews.renderTagSuggestionGroup, getAllTagSuggestions, appendTagToInput: (inputEl, tag, normalizeTags) => taskViews.appendTagToInput(inputEl, tag, normalizeTags) });
}

function renderTagSuggestionGroup(container, tags, inputEl, emptyLabel) {
    taskViews.renderTagSuggestionGroup(container, tags, inputEl, emptyLabel, (el, tag, normalizeTags) => taskViews.appendTagToInput(el, tag, normalizeTags), normalizeTagList);
}

function getAllTagSuggestions(tagKey) {
    return taskViews.getAllTagSuggestions(tagKey, appState, skillTagMasterList, factorTagMasterList, normalizeTagList);
}

function appendTagToInput(inputEl, tag) {
    taskViews.appendTagToInput(inputEl, tag, normalizeTagList);
}

function renderLogs() {
    logsView.renderLogs({
        logContainer,
        appState,
        state,
        isTaskCompleted,
        isSingletonTask,
        getTodayLoggedMinutes,
        getTaskProgressMinutes,
        getLiveTaskProgressMinutes,
        formatClock,
        escapeHtml,
        startTimer,
        stopTimer,
        updateTodayLog,
        getTimerStatusText,
        syncTaskCarouselPresentation,
        rerenderLogs: () => renderLogs()
    });
}

function restoreCompletedTask(subjectId) {
    taskStatusViews.restoreCompletedTask({ appState, getTaskProgressMinutes, startTimer }, subjectId);
}

function renderCompletedTasks() {
    taskStatusViews.renderCompletedTasks({ completedTaskListEl, appState, isSingletonTask, isTaskCompleted, getTaskProgressMinutes, escapeHtml, restoreCompletedTask });
}

function moveTaskCarousel(direction) {
    carousel.moveTaskCarousel(logContainer, getTaskCarouselCards, scrollTaskCardToIndex, direction);
}

function scrollTaskCardToIndex(index) {
    carousel.scrollTaskCardToIndex(logContainer, getTaskCarouselCards, syncTaskCarouselState, index);
}

function syncTaskCarouselState(preferredIndex = null, shouldScroll = false) {
    carousel.syncTaskCarouselState(logContainer, logPrevButtonEl, logNextButtonEl, logDotsEl, getTaskCarouselCards, getTaskCarouselDots, preferredIndex, shouldScroll);
}

function getTaskCarouselCards() {
    return carousel.getTaskCarouselCards(logContainer);
}

function getTaskCarouselDots() {
    return carousel.getTaskCarouselDots(logDotsEl);
}

function getActiveTaskCarouselIndex(cards) {
    return carousel.getActiveTaskCarouselIndex(logContainer, cards);
}

function syncTaskCarouselPresentation(preferredIndex = null) {
    carousel.syncTaskCarouselPresentation(logContainer, logDotsEl, getTaskCarouselCards, scrollTaskCardToIndex, preferredIndex);
}


function canUseTaskPictureInPicture() {
    return pipView.canUseTaskPictureInPicture();
}


function renderTaskPictureInPicture() {
    pipView.renderTaskPictureInPicture({
        state,
        appState,
        getPreferredTaskPipSubjectId,
        closeTaskPictureInPicture,
        refreshTaskPictureInPicture,
        getAdjustedTimerElapsedMinutes,
        getLiveTaskProgressMinutes,
        getRunningTaskIds,
        stopTimer,
        formatDuration,
        escapeHtml
    });
}



function renderSessionLog() {
    const sessions = getFilteredSessions();
    const filterLabel = getLogFilterContext().label;

    activityTimeline.renderSessionLog({
        sessionLogEl,
        sessionDateEl,
        sessions,
        filterLabel,
        formatClock,
        formatDuration,
        formatLongDate,
        escapeHtml
    });
}

function getHistoryTimelineDays() {
    return activityTimeline.getHistoryTimelineDays(appState.sessions);
}

function renderActivityTimelineCard() {
    const days = getHistoryTimelineDays();
    const filterContext = getLogFilterContext();
    const filterLabel = filterContext ? filterContext.label.replace(/^Showing:\s*/, "") : "All";

    activityTimeline.renderActivityTimelineCard({
        activityTimelineListEl,
        activityTimelineSubtitleEl,
        days,
        filterLabel,
        formatClock,
        formatDuration,
        formatLongDate,
        formatDate,
        escapeHtml
    });
}

function getTimerStatusText(subjectId) {
    const startedAt = appState.activeTimers[subjectId];

    if (!startedAt) {
        return "Not running";
    }

    const elapsedMinutes = getAdjustedTimerElapsedMinutes(startedAt);
    return `${formatClock(startedAt)} (${formatDuration(elapsedMinutes)})`;
}

function renderSummary() {
    dashboard.renderSummary(appState, isSingletonTask, getTodayLoggedMinutes);
}

function renderStreak() {
    dashboard.renderStreak(appState, calculateCurrentStreak, calculateBestStreak);
}

function renderAnalysis() {
    dashboard.renderAnalysis(appState, getLastNDates);
}

function renderAttentionNext() {
    dashboard.renderAttentionNext(appState, attentionListEl, attentionSummaryEl, getTodayLoggedMinutes, getTaskProgressMinutes, isSingletonTask, diffDays, formatLongDate, escapeHtml, formatDateKey);
}

function renderMiniChart() {
    dashboard.renderMiniChart(appState, getLastNDates);
}

function renderTrackerTable() {
    tracker.renderTrackerTable(appState, isSingletonTask, filterDateKeys, formatDate, getTaskTimeFilterContext);
}

function applyParsedState(parsed) {
    stateSync.applyParsedState({
        appState,
        normalizeFrequencyInput,
        normalizeSubjectDueDate,
        normalizeTagList,
        normalizeTimerDowntimePeriods: timers.normalizeTimerDowntimePeriods,
        todayKey
    }, parsed);
}

// function saveState() {
//     if (!authState.user) {
//         return;
//     }

//     const snapshot = buildPersistedState();
//     localStorage.setItem(getCurrentStoreKey(), JSON.stringify(snapshot));
//     scheduleStateSave();
// }

function buildPersistedState() {
    return stateSync.buildPersistedState(appState);
}

function scheduleStateSave() {
    stateSync.scheduleStateSave({ state, saveDelayMs: SAVE_DEBOUNCE_MS, persistStateToServer: () => persistStateToServer() });
}

async function isServerReachable() {
    return stateSync.isServerReachable();
}

async function persistStateToServer() {
    return stateSync.persistStateToServer({ authState, apiStateEndpoint: API_STATE_ENDPOINT, appState, buildPersistedState, handleSessionExpiration });
}

function getCurrentStoreKey() {
    return stateSync.getCurrentStoreKey({ authState, state, storeKeyBase: STORE_KEY_BASE });
}

function handleSessionExpiration(message) {
    stateSync.handleSessionExpiration({ state, appState, auth, closeTaskPictureInPicture, clearTaskFormInputs, clearTaskFormEditState, render }, message);
}

function resetPersistedState() {
    stateSync.resetPersistedState({ state, appState, closeTaskPictureInPicture, clearTaskFormInputs, clearTaskFormEditState, render });
}

function renderContributionGraph() {
    contributions.renderContributionGraph(appState, () => appState.subjects, isSingletonTask);
    const selectedYear = contributionYearFilterEl?.value;
    if (selectedYear) {
        contributionGraphState.year = selectedYear;
    }
}

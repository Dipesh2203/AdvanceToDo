/**
 * UI Elements Registry
 * Centralized references to all DOM elements used across the application
 * All elements are initialized as null and populated during setupUI()
 */

// Tracker page elements
export let planForm = null;
export let subjectInput = null;
export let targetInput = null;
export let frequencyInput = null;
export let deadlineToggleInput = null;
export let dueDateInput = null;
export let skillTagsInput = null;
export let factorTagsInput = null;
export let skillTagSuggestionsEl = null;
export let factorTagSuggestionsEl = null;
export let planList = null;
export let checkPendingButtonEl = null;
export let enableNotificationsButtonEl = null;
export let notificationPermissionStatusEl = null;
export let pendingReminderStatusEl = null;
export let pendingReminderListEl = null;
export let logContainer = null;
export let runningTasksListEl = null;
export let logPrevButtonEl = null;
export let logNextButtonEl = null;
export let logDotsEl = null;
export let completedTaskListEl = null;
export let targetTotalEl = null;
export let completedTotalEl = null;
export let completionRateEl = null;
export let sessionLogEl = null;
export let sessionDateEl = null;
export let logFilterDateEl = null;
export let logFilterSummaryEl = null;
export let logFilterTagEls = [];
export let openPlanButtonEl = null;
export let addTaskPanelEl = null;
export let addTaskPanelTitleEl = null;
export let addTaskPanelSubtitleEl = null;
export let planSubmitButtonEl = null;
export let cancelTaskEditButtonEl = null;
export let openSpendTimeButtonEl = null;
export let spendTimePanelEl = null;
export let spendTimeFormEl = null;
export let spendSubjectSelectEl = null;
export let spendFactorSelectEl = null;
export let spendMinutesInputEl = null;
export let taskTimeLogListEl = null;
export let taskTimeSummaryEl = null;
export let taskTimeFilterDateEl = null;
export let taskTimeSubjectFilterEl = null;
export let taskTimeFilterTagEls = [];

// Dashboard/Reports page elements (may be null on tracker page)
export let progressBarEl = null;
export let currentStreakEl = null;
export let bestStreakEl = null;
export let activeDaysEl = null;
export let analysisChartEl = null;
export let analysisTextEl = null;
export let attentionListEl = null;
export let attentionSummaryEl = null;
export let activityTimelineListEl = null;
export let activityTimelineSubtitleEl = null;
export let todayLabelEl = null;
export let miniChartEl = null;
export let trackerTableBodyEl = null;
export let themeToggleEl = null;
export let contributionYearFilterEl = null;

// Default UI text values
export let defaultAddTaskTitle = "Add Task";
export let defaultAddTaskSubtitle = "Set a subject, target, task type, skill tags, factor tags, and optional deadline";
export let defaultPlanSubmitText = "Add To Plan";

/**
 * Initialize all UI element references from the DOM
 * Call this during app initialization
 */
export function setupUIElements() {
    // Tracker page elements
    planForm = document.getElementById("planForm");
    subjectInput = document.getElementById("subjectInput");
    targetInput = document.getElementById("targetInput");
    frequencyInput = document.getElementById("frequencyInput");
    deadlineToggleInput = document.getElementById("deadlineToggleInput");
    dueDateInput = document.getElementById("dueDateInput");
    skillTagsInput = document.getElementById("skillTagsInput");
    factorTagsInput = document.getElementById("factorTagsInput");
    skillTagSuggestionsEl = document.getElementById("skillTagSuggestions");
    factorTagSuggestionsEl = document.getElementById("factorTagSuggestions");
    planList = document.getElementById("planList");
    checkPendingButtonEl = document.getElementById("checkPendingButton");
    enableNotificationsButtonEl = document.getElementById("enableNotificationsButton");
    notificationPermissionStatusEl = document.getElementById("notificationPermissionStatus");
    pendingReminderStatusEl = document.getElementById("pendingReminderStatus");
    pendingReminderListEl = document.getElementById("pendingReminderList");
    logContainer = document.getElementById("logContainer");
    runningTasksListEl = document.getElementById("runningTasksList");
    logPrevButtonEl = document.getElementById("logPrevButton");
    logNextButtonEl = document.getElementById("logNextButton");
    logDotsEl = document.getElementById("logDots");
    completedTaskListEl = document.getElementById("completedTaskList");
    targetTotalEl = document.getElementById("targetTotal");
    completedTotalEl = document.getElementById("completedTotal");
    completionRateEl = document.getElementById("completionRate");
    sessionLogEl = document.getElementById("sessionLog");
    sessionDateEl = document.getElementById("sessionDate");
    logFilterDateEl = document.getElementById("logFilterDate");
    logFilterSummaryEl = document.getElementById("logFilterSummary");
    logFilterTagEls = Array.from(document.querySelectorAll("[data-log-filter]"));
    openPlanButtonEl = document.getElementById("openPlanButton");
    addTaskPanelEl = document.getElementById("addTaskPanel");
    addTaskPanelTitleEl = addTaskPanelEl ? addTaskPanelEl.querySelector(".card-title") : null;
    addTaskPanelSubtitleEl = addTaskPanelEl ? addTaskPanelEl.querySelector(".card-subtitle") : null;
    planSubmitButtonEl = planForm ? planForm.querySelector('button[type="submit"]') : null;
    cancelTaskEditButtonEl = document.getElementById("cancelTaskEditButton");
    openSpendTimeButtonEl = document.getElementById("openSpendTimeButton");
    spendTimePanelEl = document.getElementById("spendTimePanel");
    spendTimeFormEl = document.getElementById("spendTimeForm");
    spendSubjectSelectEl = document.getElementById("spendSubjectSelect");
    spendFactorSelectEl = document.getElementById("spendFactorSelect");
    spendMinutesInputEl = document.getElementById("spendMinutesInput");
    taskTimeLogListEl = document.getElementById("taskTimeLogList");
    taskTimeSummaryEl = document.getElementById("taskTimeSummary");
    taskTimeFilterDateEl = document.getElementById("taskTimeFilterDate");
    taskTimeSubjectFilterEl = document.getElementById("taskTimeSubjectFilter");
    taskTimeFilterTagEls = Array.from(document.querySelectorAll("[data-task-time-filter]"));

    // Dashboard/Reports page elements (may be null on tracker page)
    progressBarEl = document.getElementById("progressBar");
    currentStreakEl = document.getElementById("currentStreak");
    bestStreakEl = document.getElementById("bestStreak");
    activeDaysEl = document.getElementById("activeDays");
    analysisChartEl = document.getElementById("analysisChart");
    analysisTextEl = document.getElementById("analysisText");
    attentionListEl = document.getElementById("attentionList");
    attentionSummaryEl = document.getElementById("attentionSummary");
    activityTimelineListEl = document.getElementById("activityTimelineList");
    activityTimelineSubtitleEl = document.getElementById("activityTimelineSubtitle");
    todayLabelEl = document.getElementById("todayLabel");
    miniChartEl = document.getElementById("miniChart");
    trackerTableBodyEl = document.getElementById("trackerTableBody");
    themeToggleEl = document.getElementById("themeToggle");
    contributionYearFilterEl = document.getElementById("contributionYearFilter");

    // Set default UI text
    defaultAddTaskTitle = addTaskPanelTitleEl ? addTaskPanelTitleEl.textContent : "Add Task";
    defaultAddTaskSubtitle = addTaskPanelSubtitleEl
        ? addTaskPanelSubtitleEl.textContent
        : "Set a subject, target, task type, skill tags, factor tags, and optional deadline";
    defaultPlanSubmitText = planSubmitButtonEl ? planSubmitButtonEl.textContent : "Add To Plan";
}

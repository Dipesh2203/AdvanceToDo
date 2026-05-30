// App initialization orchestrator
export async function initializeApp(hooks = {}) {
    const {
        uiSetup,
        syncUIReferences,
        themeSetup,
        setupTaskCardSlider,
        auth,
        registerNotificationServiceWorker,
        setupNotificationActivation,
        loadState,
        setupLogFilters,
        setupTaskTimeLogFilters,
        setupContributionYearFilter,
        todayLabelEl,
        todayKey,
        planForm,
        onAddPlan,
        cancelTaskEditButtonEl,
        cancelTaskEdit,
        checkPendingButtonEl,
        checkPendingRemindersPreview,
        enableNotificationsButtonEl,
        requestNotificationPermissionFromUser,
        updateNotificationPermissionStatus,
        logPrevButtonEl,
        moveTaskCarousel,
        logNextButtonEl,
        dueDateInput,
        deadlineToggleInput,
        syncDueDateInputState,
        openPlanButtonEl,
        addTaskPanelEl,
        toggleAddTaskPanel,
        openSpendTimeButtonEl,
        spendTimePanelEl,
        toggleSpendTimePanel,
        spendTimeFormEl,
        onSpendTimeSubmit,
        spendSubjectSelectEl,
        refreshSpendFactorOptions,
        documentRef = document,
        setIntervalFn = setInterval,
        monitorRunningTimers,
        renderRunningTasks,
        refreshTaskPictureInPicture,
        renderLogs,
        startTimerDowntimeMonitor,
        updateNotificationPermissionStatusFn,
        render,
        renderYearInsightCard
    } = hooks;

    if (typeof uiSetup === "function") uiSetup();
    if (typeof syncUIReferences === "function") syncUIReferences();

    if (themeSetup) {
        try { themeSetup(); } catch (_e) { /* ignore */ }
    }

    if (typeof setupTaskCardSlider === "function") {
        try { setupTaskCardSlider(); } catch (_e) { /* ignore */ }
    }

    if (auth && typeof auth.injectAuthStyles === "function") {
        try { auth.injectAuthStyles(); } catch (_e) { }
    }

    if (auth && typeof auth.setupAuthInterface === "function") {
        try { auth.setupAuthInterface(); } catch (_e) { }
    }

    if (auth && typeof auth.resolveAuthState === "function") {
        await auth.resolveAuthState();
    }

    if (!auth || !auth.authState || !auth.authState.user) {
        if (auth && typeof auth.showAuthGate === "function") auth.showAuthGate();
        if (auth && typeof auth.updateAuthHeader === "function") auth.updateAuthHeader();
        return;
    }

    if (typeof registerNotificationServiceWorker === "function") {
        try { await registerNotificationServiceWorker(); } catch (_e) { /* ignore */ }
    }

    if (typeof setupNotificationActivation === "function") {
        try { setupNotificationActivation(); } catch (_e) { /* ignore */ }
    }

    if (auth && typeof auth.setupAuthControls === "function") {
        try { auth.setupAuthControls(); } catch (_e) { /* ignore */ }
    }

    if (typeof loadState === "function") {
        await loadState();
    }

    if (typeof setupLogFilters === "function") setupLogFilters();
    if (typeof setupTaskTimeLogFilters === "function") setupTaskTimeLogFilters();
    if (typeof setupContributionYearFilter === "function") setupContributionYearFilter();

    if (todayLabelEl) {
        try {
            todayLabelEl.textContent = new Date().toLocaleDateString(undefined, {
                weekday: "short",
                year: "numeric",
                month: "short",
                day: "numeric"
            });
        } catch (_e) { /* ignore */ }
    }

    if (planForm && typeof planForm.addEventListener === "function" && typeof onAddPlan === "function") {
        planForm.addEventListener("submit", onAddPlan);
    }

    if (cancelTaskEditButtonEl && typeof cancelTaskEdit === "function") {
        cancelTaskEditButtonEl.addEventListener("click", cancelTaskEdit);
    }

    if (checkPendingButtonEl && typeof checkPendingRemindersPreview === "function") {
        checkPendingButtonEl.addEventListener("click", () => { void checkPendingRemindersPreview(); });
    }

    if (enableNotificationsButtonEl) {
        enableNotificationsButtonEl.addEventListener("click", async () => {
            try {
                if (typeof requestNotificationPermissionFromUser === "function") await requestNotificationPermissionFromUser();
            } finally {
                if (typeof updateNotificationPermissionStatus === "function") updateNotificationPermissionStatus();
            }
        });
    }

    if (logPrevButtonEl) {
        logPrevButtonEl.addEventListener("click", () => moveTaskCarousel(-1));
    }

    if (logNextButtonEl) {
        logNextButtonEl.addEventListener("click", () => moveTaskCarousel(1));
    }

    if (dueDateInput && todayKey) {
        try { dueDateInput.min = todayKey; } catch (_e) { }
    }

    if (deadlineToggleInput && typeof syncDueDateInputState === "function") {
        deadlineToggleInput.addEventListener("change", syncDueDateInputState);
    }

    if (dueDateInput) {
        dueDateInput.addEventListener("focus", () => {
            if (!dueDateInput.value) {
                dueDateInput.value = todayKey;
            }
        });
    }

    if (typeof syncDueDateInputState === "function") syncDueDateInputState();

    if (openPlanButtonEl && addTaskPanelEl && typeof toggleAddTaskPanel === "function") {
        openPlanButtonEl.addEventListener("click", toggleAddTaskPanel);
    }

    if (openSpendTimeButtonEl && spendTimePanelEl && typeof toggleSpendTimePanel === "function") {
        openSpendTimeButtonEl.addEventListener("click", toggleSpendTimePanel);
    }

    if (spendTimeFormEl && typeof onSpendTimeSubmit === "function") {
        spendTimeFormEl.addEventListener("submit", onSpendTimeSubmit);
    }

    if (spendSubjectSelectEl) {
        spendSubjectSelectEl.addEventListener("change", () => {
            try { refreshSpendFactorOptions(); } catch (_e) { }

            if (spendTimePanelEl && spendSubjectSelectEl.value) {
                spendTimePanelEl.dataset.activeSubjectId = spendSubjectSelectEl.value;
            }
        });
    }

    documentRef.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            try {
                if (addTaskPanelEl && !addTaskPanelEl.classList.contains("add-task-panel-hidden")) {
                    if (typeof toggleAddTaskPanel === "function") toggleAddTaskPanel();
                }
                if (spendTimePanelEl && spendTimePanelEl.classList.contains("is-open")) {
                    if (typeof toggleSpendTimePanel === "function") toggleSpendTimePanel();
                }
            } catch (_e) { }
        }
    });

    setIntervalFn(() => {
        try {
            if (Object.keys(hooks.appState?.activeTimers || {}).length === 0) {
                if (typeof renderRunningTasks === "function") renderRunningTasks();
                if (typeof refreshTaskPictureInPicture === "function") refreshTaskPictureInPicture();
                return;
            }

            if (typeof monitorRunningTimers === "function") monitorRunningTimers();
            if (typeof renderRunningTasks === "function") renderRunningTasks();
            if (typeof refreshTaskPictureInPicture === "function") refreshTaskPictureInPicture();

            if (!hooks.logContainer) return;

            const activeEl = documentRef.activeElement;
            const isEditingLogInput = Boolean(activeEl && hooks.logContainer.contains(activeEl) && activeEl.tagName === "INPUT");

            if (!isEditingLogInput && typeof renderLogs === "function") renderLogs();
        } catch (_e) {
            // ignore periodic errors
        }
    }, 1000);

    if (typeof startTimerDowntimeMonitor === "function") startTimerDowntimeMonitor();

    if (typeof updateNotificationPermissionStatus === "function") updateNotificationPermissionStatus();
    if (typeof render === "function") render();
    if (typeof renderYearInsightCard === "function") renderYearInsightCard();
}

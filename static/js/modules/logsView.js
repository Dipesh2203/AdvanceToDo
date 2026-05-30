export function renderLogs({
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
    rerenderLogs
}) {
    if (!logContainer) {
        return;
    }

    const activeIndexBeforeRender = Number(logContainer.dataset.activeIndex || 0);

    logContainer.innerHTML = "";

    if (appState.subjects.length === 0) {
        const note = document.createElement("p");
        note.className = "empty-note";
        note.textContent = "Add a subject to start logging study time.";
        logContainer.appendChild(note);
        return;
    }

    const activeSubjects = appState.subjects.filter((item) => {
        if (item.archived) {
            return false;
        }
        const isRunning = Boolean(appState.activeTimers[item.id]);
        const isCompleted = isTaskCompleted(item);
        return isRunning || !isCompleted;
    });

    if (activeSubjects.length === 0) {
        const note = document.createElement("p");
        note.className = "empty-note";
        note.textContent = "All tasks are completed for today. Check Completed Tasks below.";
        logContainer.appendChild(note);
        return;
    }

    activeSubjects.forEach((item, index) => {
        const wrap = document.createElement("div");
        wrap.className = "log-item";
        wrap.dataset.carouselIndex = String(index);
        wrap.dataset.subjectId = item.id;
        wrap.dataset.initial = (item.subject || "?").trim().charAt(0).toUpperCase() || "?";

        const current = getTodayLoggedMinutes(item.id);
        const progress = getTaskProgressMinutes(item);
        const liveProgress = getLiveTaskProgressMinutes(item);
        const isRunning = Boolean(appState.activeTimers[item.id]);
        const hasProgress = progress > 0;

        let cardState = "state-stopped";
        let dotState = "stopped";
        let stateLabel = "Stopped";

        if (isRunning) {
            cardState = "state-running";
            dotState = "running";
            stateLabel = "Running";
            wrap.classList.add("has-started-at");
        } else if (hasProgress) {
            cardState = "state-mid";
            dotState = "mid";
            stateLabel = "Stopped in-between";
        }

        wrap.classList.add(cardState);

        const dot = document.createElement("span");
        dot.className = `task-state-dot ${dotState}`;
        dot.title = stateLabel;
        dot.setAttribute("aria-label", stateLabel);

        let startedAtTime = null;
        if (isRunning) {
            startedAtTime = document.createElement("div");
            startedAtTime.className = "started-at-time";
            startedAtTime.textContent = formatClock(appState.activeTimers[item.id]);
            startedAtTime.setAttribute("aria-label", `Started at ${formatClock(appState.activeTimers[item.id])}`);
        }

        const completedMinutes = Math.max(0, Math.round(liveProgress));
        const completedHours = Math.floor(completedMinutes / 60);
        const remainingMinutes = completedMinutes % 60;

        const completedTimeBadge = document.createElement("div");
        completedTimeBadge.className = "task-time-badge";
        completedTimeBadge.setAttribute("aria-label", `Completed time ${completedHours} hour ${remainingMinutes} minutes`);
        completedTimeBadge.innerHTML = `
            <span class="task-time-badge-hours">${completedHours}</span>
            <span class="task-time-badge-minutes">${remainingMinutes}</span>
        `;

        const playBtn = document.createElement("button");
        playBtn.type = "button";
        playBtn.className = "task-play-btn";
        if (isRunning) {
            playBtn.classList.add("is-running");
        }
        playBtn.setAttribute("aria-label", `Start timer for ${item.subject}`);
        playBtn.innerHTML = isRunning ? "⏹" : "▶";
        const toggleTaskTimer = () => {
            if (isRunning) {
                stopTimer(item.id);
            } else {
                startTimer(item.id);
            }
        };
        playBtn.addEventListener("click", toggleTaskTimer);

        const playBtnBottom = document.createElement("button");
        playBtnBottom.type = "button";
        playBtnBottom.className = "task-play-btn task-play-btn-bottom";
        playBtnBottom.setAttribute("aria-label", `Add spent time for ${item.subject}`);
        playBtnBottom.innerHTML = "+";

        const heading = document.createElement("div");
        heading.className = "task-copy";
        const targetLine = isSingletonTask(item)
            ? `Target: ${item.target} min total`
            : `Target: ${item.target} min/day`;
        heading.innerHTML = `
            <span class="task-copy-title">${escapeHtml(item.subject.toUpperCase())}</span>
            <span class="task-copy-target">${targetLine}</span>
        `;

        const input = document.createElement("input");
        input.type = "number";
        input.min = "0";
        input.step = "5";
        input.value = String(current);
        input.placeholder = "Enter minutes studied";
        input.setAttribute("aria-label", `Minutes studied for ${item.subject}`);
        input.addEventListener("input", (event) => updateTodayLog(item.id, event.target.value, false));
        input.addEventListener("change", (event) => updateTodayLog(item.id, event.target.value, true));
        input.addEventListener("blur", (event) => updateTodayLog(item.id, event.target.value, true));

        const inlineSpendEditor = document.createElement("form");
        inlineSpendEditor.className = "inline-spend-editor";

        const inlineSpendInput = document.createElement("input");
        inlineSpendInput.type = "number";
        inlineSpendInput.min = "1";
        inlineSpendInput.step = "5";
        inlineSpendInput.placeholder = "min";
        inlineSpendInput.setAttribute("aria-label", `Add minutes for ${item.subject}`);

        const inlineSpendAddBtn = document.createElement("button");
        inlineSpendAddBtn.type = "submit";
        inlineSpendAddBtn.className = "inline-spend-add-btn";
        inlineSpendAddBtn.textContent = "Add";

        inlineSpendEditor.appendChild(inlineSpendInput);
        inlineSpendEditor.appendChild(inlineSpendAddBtn);

        inlineSpendEditor.addEventListener("submit", (event) => {
            event.preventDefault();
            const minutesToAdd = Number(inlineSpendInput.value);
            if (Number.isNaN(minutesToAdd) || minutesToAdd <= 0) {
                return;
            }

            const currentMinutes = getTodayLoggedMinutes(item.id);
            state.setInlineSpendEditorSubjectId(null);
            updateTodayLog(item.id, String(currentMinutes + minutesToAdd), true);
        });

        inlineSpendInput.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                state.setInlineSpendEditorSubjectId(null);
                rerenderLogs();
            }
        });

        const isInlineEditorOpen = state.inlineSpendEditorSubjectId === item.id;
        inlineSpendEditor.classList.toggle("is-open", isInlineEditorOpen);
        playBtnBottom.classList.toggle("is-open", isInlineEditorOpen);

        playBtnBottom.addEventListener("click", () => {
            state.setInlineSpendEditorSubjectId(state.inlineSpendEditorSubjectId === item.id ? null : item.id);
            rerenderLogs();
            if (state.inlineSpendEditorSubjectId === item.id) {
                setTimeout(() => {
                    const focusInput = logContainer && logContainer.querySelector(`.log-item[data-subject-id="${item.id}"] .inline-spend-editor input`);
                    if (focusInput instanceof HTMLElement) {
                        focusInput.focus();
                    }
                }, 0);
            }
        });

        const timerRow = document.createElement("div");
        timerRow.className = "timer-row";

        const startButton = document.createElement("button");
        startButton.type = "button";
        startButton.className = "timer-btn start-btn";
        startButton.textContent = "Start";
        startButton.disabled = Boolean(appState.activeTimers[item.id]);
        startButton.addEventListener("click", () => startTimer(item.id));

        const stopButton = document.createElement("button");
        stopButton.type = "button";
        stopButton.className = "timer-btn stop-btn";
        stopButton.textContent = "Stop & Save";
        stopButton.disabled = !appState.activeTimers[item.id];
        stopButton.addEventListener("click", () => stopTimer(item.id));

        const status = document.createElement("span");
        status.className = "timer-status";
        if (!isRunning && isTaskCompleted(item)) {
            status.textContent = "Completed";
        } else {
            status.textContent = getTimerStatusText(item.id);
        }

        timerRow.appendChild(startButton);
        timerRow.appendChild(stopButton);
        timerRow.appendChild(status);

        wrap.appendChild(dot);
        if (startedAtTime) {
            wrap.appendChild(startedAtTime);
        }
        wrap.appendChild(completedTimeBadge);
        wrap.appendChild(playBtn);
        wrap.appendChild(playBtnBottom);
        wrap.appendChild(heading);
        wrap.appendChild(input);
        wrap.appendChild(inlineSpendEditor);
        wrap.appendChild(timerRow);
        logContainer.appendChild(wrap);
    });

    syncTaskCarouselPresentation(activeIndexBeforeRender);
}
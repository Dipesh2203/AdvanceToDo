export function renderRunningTasks({ runningTasksListEl, appState, getAdjustedTimerElapsedMinutes, formatDuration, formatClock }) {
    if (!runningTasksListEl) {
        return;
    }

    runningTasksListEl.innerHTML = "";

    const runningSubjects = appState.subjects
        .map((subject) => ({
            subject,
            startedAt: Number(appState.activeTimers[subject.id]) || 0
        }))
        .filter((item) => item.startedAt > 0)
        .sort((a, b) => a.startedAt - b.startedAt);

    if (runningSubjects.length === 0) {
        const empty = document.createElement("span");
        empty.className = "running-task-empty";
        empty.textContent = "No task running right now.";
        runningTasksListEl.appendChild(empty);
        return;
    }

    runningSubjects.forEach((item) => {
        const subjectName = item.subject && item.subject.subject ? item.subject.subject : "Task";
        const elapsedMinutes = getAdjustedTimerElapsedMinutes(item.startedAt);

        const chip = document.createElement("span");
        chip.className = "running-task-chip";
        chip.textContent = `${subjectName} • ${formatDuration(elapsedMinutes)}`;
        chip.setAttribute("title", `Started at ${formatClock(item.startedAt)}`);
        runningTasksListEl.appendChild(chip);
    });
}

export function restoreCompletedTask({ appState, getTaskProgressMinutes, startTimer }, subjectId) {
    if (appState.activeTimers[subjectId]) {
        return;
    }

    const subject = appState.subjects.find((item) => item.id === subjectId);
    if (!subject) {
        return;
    }

    const response = window.prompt("How many extra minutes do you want to rework?", "10");
    if (response === null) {
        return;
    }

    const extraMinutes = Math.round(Number(response));
    if (Number.isNaN(extraMinutes) || extraMinutes <= 0) {
        return;
    }

    appState.reworkPlans[subjectId] = {
        baseProgress: getTaskProgressMinutes(subject),
        extraMinutes
    };

    startTimer(subjectId);
}

export function renderCompletedTasks({ completedTaskListEl, appState, isSingletonTask, isTaskCompleted, getTaskProgressMinutes, escapeHtml, restoreCompletedTask }) {
    if (!completedTaskListEl) {
        return;
    }

    completedTaskListEl.innerHTML = "";

    const completedSubjects = appState.subjects.filter((item) => {
        if (item.archived) {
            return false;
        }
        const isRunning = Boolean(appState.activeTimers[item.id]);
        return !isRunning && isTaskCompleted(item);
    });

    if (completedSubjects.length === 0) {
        const note = document.createElement("li");
        note.className = "empty-note";
        note.textContent = "No completed tasks yet today.";
        completedTaskListEl.appendChild(note);
        return;
    }

    completedSubjects.forEach((item) => {
        const current = getTaskProgressMinutes(item);
        const target = Number(item.target) || 0;
        const extra = Math.max(0, current - target);
        const targetLabel = isSingletonTask(item) ? "min total" : "min today";

        const li = document.createElement("li");
        li.className = "plan-item";

        const contentDiv = document.createElement("div");
        contentDiv.style.flex = "1";
        contentDiv.innerHTML = `<strong>${escapeHtml(item.subject)}</strong><div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">Completed: ${target} / ${target} ${targetLabel}${extra > 0 ? ` (+${extra} extra)` : ""}</div>`;

        const restoreButton = document.createElement("button");
        restoreButton.type = "button";
        restoreButton.className = "remove-btn";
        restoreButton.textContent = "Restore";
        restoreButton.addEventListener("click", () => restoreCompletedTask(item.id));

        li.appendChild(contentDiv);
        li.appendChild(restoreButton);
        completedTaskListEl.appendChild(li);
    });
}
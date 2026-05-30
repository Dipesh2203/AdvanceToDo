export function syncDueDateInputState({ dueDateInput, deadlineToggleInput, todayKey }) {
    if (!dueDateInput) {
        return;
    }

    const isEnabled = !deadlineToggleInput || deadlineToggleInput.checked;
    dueDateInput.disabled = !isEnabled;
    dueDateInput.required = isEnabled;
    dueDateInput.style.opacity = isEnabled ? "1" : "0.55";

    if (!isEnabled) {
        dueDateInput.value = "";
        return;
    }

    if (!dueDateInput.value) {
        dueDateInput.value = todayKey;
    }
}

export function clearTaskFormInputs(refs) {
    const { subjectInput, targetInput, frequencyInput, deadlineToggleInput, dueDateInput, skillTagsInput, factorTagsInput, todayKey } = refs;

    if (subjectInput) {
        subjectInput.value = "";
    }
    if (targetInput) {
        targetInput.value = "";
    }
    if (frequencyInput) {
        frequencyInput.value = "everyday";
    }
    if (deadlineToggleInput) {
        deadlineToggleInput.checked = false;
    }
    if (dueDateInput) {
        dueDateInput.value = "";
    }
    if (skillTagsInput) {
        skillTagsInput.value = "";
    }
    if (factorTagsInput) {
        factorTagsInput.value = "";
    }

    syncDueDateInputState({ dueDateInput, deadlineToggleInput, todayKey });
}

export function setTaskFormMode(refs, isEditing) {
    const { addTaskPanelTitleEl, addTaskPanelSubtitleEl, planSubmitButtonEl, cancelTaskEditButtonEl } = refs;

    if (addTaskPanelTitleEl) {
        addTaskPanelTitleEl.textContent = isEditing ? "Edit Task" : "Add New Task";
    }
    if (addTaskPanelSubtitleEl) {
        addTaskPanelSubtitleEl.textContent = isEditing
            ? "Update the task details and save your changes."
            : "Fill in the task details below";
    }
    if (planSubmitButtonEl) {
        planSubmitButtonEl.textContent = isEditing ? "Update Task" : "Create Task";
    }
    if (cancelTaskEditButtonEl) {
        cancelTaskEditButtonEl.style.display = isEditing ? "inline-flex" : "none";
    }
}

export function clearTaskFormEditState({ state, refs }) {
    state.setEditingSubjectId(null);
    setTaskFormMode(refs, false);
}

export function populateTaskForm(refs, subject, normalizeFrequencyInput, todayKey) {
    const { subjectInput, targetInput, frequencyInput, deadlineToggleInput, dueDateInput, skillTagsInput, factorTagsInput } = refs;

    if (!subjectInput || !targetInput || !frequencyInput) {
        return;
    }

    subjectInput.value = subject.subject || "";
    targetInput.value = String(subject.target || "");
    frequencyInput.value = normalizeFrequencyInput(subject.frequency);

    if (deadlineToggleInput) {
        deadlineToggleInput.checked = Boolean(subject.dueDate);
    }
    if (dueDateInput) {
        dueDateInput.value = subject.dueDate || "";
    }
    if (skillTagsInput) {
        skillTagsInput.value = Array.isArray(subject.skillTags) ? subject.skillTags.join(", ") : "";
    }
    if (factorTagsInput) {
        factorTagsInput.value = Array.isArray(subject.factorTags) ? subject.factorTags.join(", ") : "";
    }

    syncDueDateInputState({ dueDateInput, deadlineToggleInput, todayKey });
}

export function beginEditSubject({ appState, state, refs, normalizeFrequencyInput, todayKey }, subjectId) {
    const subject = appState.subjects.find((item) => item.id === subjectId);
    if (!subject) {
        return;
    }

    state.setEditingSubjectId(subject.id);
    populateTaskForm(refs, subject, normalizeFrequencyInput, todayKey);
    setTaskFormMode(refs, true);
    openAddTaskPanel(refs, null);
}

export function cancelTaskEdit({ state, refs, todayKey }) {
    clearTaskFormInputs({ ...refs, todayKey });
    clearTaskFormEditState({ state, refs });

    if (refs.addTaskPanelEl) {
        closeAddTaskPanel(refs);
    }
}

export function refreshSpendFactorOptions({ appState, refs, normalizeTagList }) {
    const { spendFactorSelectEl, spendSubjectSelectEl } = refs;

    if (!spendFactorSelectEl || !spendSubjectSelectEl) {
        return;
    }

    const subjectId = spendSubjectSelectEl.value;
    const subject = appState.subjects.find((item) => item.id === subjectId);
    const factorTags = normalizeTagList(subject && subject.factorTags);
    const previous = spendFactorSelectEl.value;

    spendFactorSelectEl.innerHTML = "";

    if (!subjectId || factorTags.length === 0) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "No factor tags";
        spendFactorSelectEl.appendChild(option);
        spendFactorSelectEl.disabled = true;
        spendFactorSelectEl.title = "This task does not have factor tags yet.";
        return;
    }

    spendFactorSelectEl.disabled = false;
    spendFactorSelectEl.title = "";

    factorTags.forEach((factor) => {
        const option = document.createElement("option");
        option.value = factor;
        option.textContent = factor;
        spendFactorSelectEl.appendChild(option);
    });

    spendFactorSelectEl.value = factorTags.includes(previous) ? previous : factorTags[0];
}

export function refreshSpendTaskOptions({ appState, refs, isSingletonTask, getTotalLoggedMinutes, getTodayLoggedMinutes, refreshSpendFactorOptions, normalizeTagList }) {
    const { spendSubjectSelectEl } = refs;

    if (!spendSubjectSelectEl) {
        return;
    }

    const previous = spendSubjectSelectEl.value;
    spendSubjectSelectEl.innerHTML = "";

    const activeSubjectsForSpend = appState.subjects.filter((item) => !item.archived);

    if (activeSubjectsForSpend.length === 0) {
        const emptyOption = document.createElement("option");
        emptyOption.value = "";
        emptyOption.textContent = "No active tasks";
        spendSubjectSelectEl.appendChild(emptyOption);
        spendSubjectSelectEl.disabled = true;
        return;
    }

    spendSubjectSelectEl.disabled = false;

    activeSubjectsForSpend.forEach((item) => {
        const option = document.createElement("option");
        option.value = item.id;
        const loggedMinutes = isSingletonTask(item) ? getTotalLoggedMinutes(item.id) : getTodayLoggedMinutes(item.id);
        const targetSuffix = isSingletonTask(item) ? "total" : "today";
        option.textContent = `${item.subject} (${loggedMinutes}/${item.target} min ${targetSuffix})`;
        spendSubjectSelectEl.appendChild(option);
    });

    const hasPrevious = activeSubjectsForSpend.some((item) => item.id === previous);
    spendSubjectSelectEl.value = hasPrevious ? previous : activeSubjectsForSpend[0].id;
    refreshSpendFactorOptions();
}

export function openSpendTimePanel(refs, refreshSpendTaskOptions, refreshSpendFactorOptions, preferredSubjectId = null) {
    const { spendTimePanelEl, addTaskPanelEl, spendSubjectSelectEl, openSpendTimeButtonEl, spendMinutesInputEl } = refs;

    if (!spendTimePanelEl) {
        return;
    }

    if (addTaskPanelEl && !addTaskPanelEl.classList.contains("add-task-panel-hidden")) {
        closeAddTaskPanel(refs);
    }

    refreshSpendTaskOptions();
    if (preferredSubjectId && spendSubjectSelectEl) {
        const optionExists = Array.from(spendSubjectSelectEl.options).some((option) => option.value === preferredSubjectId);
        if (optionExists) {
            spendSubjectSelectEl.value = preferredSubjectId;
        }
    }

    refreshSpendFactorOptions();

    if (spendSubjectSelectEl && spendSubjectSelectEl.value) {
        spendTimePanelEl.dataset.activeSubjectId = spendSubjectSelectEl.value;
    }

    spendTimePanelEl.classList.add("is-open");
    spendTimePanelEl.setAttribute("aria-hidden", "false");

    if (openSpendTimeButtonEl) {
        openSpendTimeButtonEl.setAttribute("aria-expanded", "true");
    }

    if (spendMinutesInputEl) {
        spendMinutesInputEl.focus();
    }
}

export function closeSpendTimePanel(refs) {
    const { spendTimePanelEl, openSpendTimeButtonEl } = refs;

    if (!spendTimePanelEl) {
        return;
    }

    spendTimePanelEl.classList.remove("is-open");
    spendTimePanelEl.setAttribute("aria-hidden", "true");
    delete spendTimePanelEl.dataset.activeSubjectId;

    if (openSpendTimeButtonEl) {
        openSpendTimeButtonEl.setAttribute("aria-expanded", "false");
        openSpendTimeButtonEl.focus();
    }
}

export function toggleSpendTimePanelForSubject(refs, openSpendTimePanel, closeSpendTimePanel, subjectId) {
    const { spendTimePanelEl } = refs;

    if (!spendTimePanelEl || !subjectId) {
        return;
    }

    const isOpen = spendTimePanelEl.classList.contains("is-open");
    const activeSubjectId = spendTimePanelEl.dataset.activeSubjectId || "";

    if (isOpen && activeSubjectId === subjectId) {
        closeSpendTimePanel();
        return;
    }

    openSpendTimePanel(subjectId);
}

export function toggleSpendTimePanel(refs, openSpendTimePanel, closeSpendTimePanel) {
    const { spendTimePanelEl } = refs;

    if (!spendTimePanelEl) {
        return;
    }

    if (spendTimePanelEl.classList.contains("is-open")) {
        closeSpendTimePanel();
    } else {
        openSpendTimePanel();
    }
}

export function onSpendTimeSubmit(event, { appState, refs, normalizeTagList, getTodayLoggedMinutes, updateTodayLog, closeSpendTimePanel }) {
    event.preventDefault();

    const { spendSubjectSelectEl, spendMinutesInputEl, spendFactorSelectEl } = refs;
    if (!spendSubjectSelectEl || !spendMinutesInputEl) {
        return;
    }

    const subjectId = spendSubjectSelectEl.value;
    const minutesValue = Number(spendMinutesInputEl.value);
    const selectedFactor = spendFactorSelectEl ? spendFactorSelectEl.value : "";

    if (!subjectId || Number.isNaN(minutesValue) || minutesValue <= 0) {
        return;
    }

    const subject = appState.subjects.find((item) => item.id === subjectId);
    const factorTags = normalizeTagList(subject && subject.factorTags);
    const validFactor = factorTags.includes(selectedFactor) ? selectedFactor : null;

    const current = getTodayLoggedMinutes(subjectId);
    updateTodayLog(subjectId, String(current + minutesValue), true, validFactor);
    spendMinutesInputEl.value = "";
    closeSpendTimePanel();
}

export function openAddTaskPanel(refs, closeSpendTimePanel) {
    const { addTaskPanelEl, openPlanButtonEl, subjectInput } = refs;

    if (!addTaskPanelEl) {
        return;
    }

    if (refs.spendTimePanelEl && refs.spendTimePanelEl.classList.contains("is-open")) {
        closeSpendTimePanel();
    }

    addTaskPanelEl.classList.remove("add-task-panel-hidden");

    if (openPlanButtonEl) {
        openPlanButtonEl.setAttribute("aria-expanded", "true");
        openPlanButtonEl.textContent = "x";
    }

    if (subjectInput) {
        subjectInput.focus();
    }
}

export function closeAddTaskPanel(refs) {
    const { addTaskPanelEl, openPlanButtonEl } = refs;

    if (!addTaskPanelEl) {
        return;
    }

    addTaskPanelEl.classList.add("add-task-panel-hidden");

    if (openPlanButtonEl) {
        openPlanButtonEl.setAttribute("aria-expanded", "false");
        openPlanButtonEl.textContent = "+";
        openPlanButtonEl.focus();
    }
}

export function toggleAddTaskPanel(refs, openAddTaskPanel, closeAddTaskPanel) {
    const { addTaskPanelEl } = refs;

    if (!addTaskPanelEl) {
        return;
    }

    if (addTaskPanelEl.classList.contains("add-task-panel-hidden")) {
        openAddTaskPanel();
    } else {
        closeAddTaskPanel();
    }
}

export function onAddPlan(event, { appState, state, refs, normalizeFrequencyInput, normalizeDueDateInput, normalizeTagList, createId, saveState, render, todayKey, clearTaskFormInputs, clearTaskFormEditState, closeAddTaskPanel }) {
    event.preventDefault();

    const { subjectInput, targetInput, frequencyInput, deadlineToggleInput, dueDateInput, skillTagsInput, factorTagsInput, addTaskPanelEl } = refs;
    if (!subjectInput || !targetInput || !frequencyInput) {
        return;
    }

    const subject = subjectInput.value.trim();
    const target = Number(targetInput.value);
    const frequency = normalizeFrequencyInput(frequencyInput.value);
    const shouldSetDeadline = Boolean(deadlineToggleInput && deadlineToggleInput.checked);
    const dueDate = shouldSetDeadline && dueDateInput ? normalizeDueDateInput(dueDateInput.value) : null;
    const skillTags = normalizeTagList(skillTagsInput ? skillTagsInput.value : []);
    const factorTags = normalizeTagList(factorTagsInput ? factorTagsInput.value : []);

    if (!subject || Number.isNaN(target) || target <= 0) {
        return;
    }

    if (shouldSetDeadline && !dueDate) {
        return;
    }

    const existingSubject = state.editingSubjectId
        ? appState.subjects.find((item) => item.id === state.editingSubjectId)
        : null;

    if (state.editingSubjectId && !existingSubject) {
        clearTaskFormEditState();
        return;
    }

    if (existingSubject) {
        existingSubject.subject = subject;
        existingSubject.target = target;
        existingSubject.frequency = frequency;
        existingSubject.dueDate = dueDate;
        existingSubject.skillTags = skillTags;
        existingSubject.factorTags = factorTags;
    } else {
        appState.subjects.push({
            id: createId(),
            subject,
            target,
            frequency,
            dueDate,
            skillTags,
            factorTags,
            archived: false
        });
    }

    clearTaskFormInputs();
    clearTaskFormEditState();

    if (addTaskPanelEl) {
        closeAddTaskPanel();
    }

    saveState();
    render();
}
export async function checkPendingRemindersPreview({ pendingReminderStatusEl, pendingReminderListEl, checkPendingButtonEl, pendingReminderEndpoint, renderPendingReminderPreview }) {
    if (!pendingReminderStatusEl || !pendingReminderListEl) {
        return;
    }

    pendingReminderStatusEl.textContent = "Checking pending tasks...";
    pendingReminderListEl.innerHTML = "";

    if (checkPendingButtonEl) {
        checkPendingButtonEl.disabled = true;
    }

    try {
        const response = await fetch(pendingReminderEndpoint, {
            method: "GET",
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error("Failed to load pending tasks");
        }

        const payload = await response.json();
        const pending = Array.isArray(payload.pending) ? payload.pending : [];

        renderPendingReminderPreview(pending);

        if (pending.length === 0) {
            pendingReminderStatusEl.textContent = "No pending reminder tasks right now.";
        } else {
            pendingReminderStatusEl.textContent = `${pending.length} pending task reminder${pending.length === 1 ? "" : "s"} found.`;
        }
    } catch (_error) {
        pendingReminderStatusEl.textContent = "Could not check pending tasks. Please try again.";
    } finally {
        if (checkPendingButtonEl) {
            checkPendingButtonEl.disabled = false;
        }
    }
}

export function renderPendingReminderPreview(pending, pendingReminderListEl, formatLongDate, escapeHtml) {
    if (!pendingReminderListEl) {
        return;
    }

    pendingReminderListEl.innerHTML = "";

    if (!Array.isArray(pending) || pending.length === 0) {
        const note = document.createElement("li");
        note.className = "empty-note";
        note.textContent = "No tasks are pending for reminders.";
        pendingReminderListEl.appendChild(note);
        return;
    }

    pending.forEach((item) => {
        const li = document.createElement("li");
        li.className = "plan-item";

        const title = typeof item.subjectName === "string" ? item.subjectName : "Task";
        const dueDate = typeof item.dueDate === "string" ? item.dueDate : "Unknown";
        const message = typeof item.message === "string" ? item.message : "Pending";
        const dueDateLabel = /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? formatLongDate(dueDate) : dueDate;

        li.innerHTML = `<div><strong>${escapeHtml(title)}</strong><div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">${escapeHtml(message)}</div><div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">Due: ${escapeHtml(dueDateLabel)}</div></div>`;
        pendingReminderListEl.appendChild(li);
    });
}

export function archiveSubject({ appState, timerTargetAlerts, saveState, render }, subjectId) {
    const subject = appState.subjects.find((item) => item.id === subjectId);
    if (subject) {
        subject.archived = true;
    }
    delete appState.activeTimers[subjectId];
    delete timerTargetAlerts[subjectId];

    saveState();
    render();
}

export function deleteSubject({ appState, timerTargetAlerts, saveState, render }, subjectId) {
    appState.subjects = appState.subjects.filter((item) => item.id !== subjectId);
    delete appState.activeTimers[subjectId];
    delete timerTargetAlerts[subjectId];

    for (const dateKey of Object.keys(appState.logs)) {
        if (appState.logs[dateKey][subjectId] !== undefined) {
            delete appState.logs[dateKey][subjectId];
        }

        if (Object.keys(appState.logs[dateKey]).length === 0) {
            delete appState.logs[dateKey];
        }
    }

    for (const dayKey of Object.keys(appState.sessions)) {
        const daySessions = Array.isArray(appState.sessions[dayKey]) ? appState.sessions[dayKey] : [];
        appState.sessions[dayKey] = daySessions.filter((session) => session.subjectId !== subjectId);

        if (appState.sessions[dayKey].length === 0) {
            delete appState.sessions[dayKey];
        }
    }

    saveState();
    render();
}

export function restoreSubject({ appState, saveState, render }, subjectId) {
    const subject = appState.subjects.find((item) => item.id === subjectId);
    if (subject) {
        subject.archived = false;
    }
    saveState();
    render();
}

export function renderArchivedTasks({ appState, beginEditSubject, renderPlan, restoreSubject, deleteSubject, isSingletonTask, formatLongDate, escapeHtml }) {
    const archivedTasks = appState.subjects.filter((item) => item.archived);

    if (archivedTasks.length === 0) {
        alert("No archived tasks.");
        return;
    }

    const overlay = document.createElement("div");
    overlay.className = "archive-overlay";
    overlay.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;";

    const modal = document.createElement("div");
    modal.className = "archive-modal";
    modal.style.cssText = "background: var(--bg-primary); border-radius: 12px; padding: 24px; max-width: 500px; max-height: 70vh; overflow-y: auto; box-shadow: 0 8px 32px rgba(0,0,0,0.1); color: var(--text-primary);";

    const title = document.createElement("h2");
    title.textContent = `Archived Tasks (${archivedTasks.length})`;
    title.style.cssText = "margin: 0 0 16px 0; font-size: 1.2rem;";
    modal.appendChild(title);

    archivedTasks.forEach((task) => {
        const item = document.createElement("div");
        item.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 12px; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 8px; background: var(--bg-secondary);";

        const info = document.createElement("div");
        info.style.cssText = "flex: 1;";
        info.innerHTML = `<strong>${escapeHtml(task.subject)}</strong><br><small style="color: var(--text-secondary);">${task.target} min${isSingletonTask(task) ? " total" : "/day"} • ${formatLongDate(task.dueDate || "No deadline")}</small>`;

        const actions = document.createElement("div");
        actions.style.cssText = "display: flex; gap: 6px;";

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "timer-btn";
        editBtn.textContent = "Edit";
        editBtn.addEventListener("click", () => {
            beginEditSubject(task.id);
            overlay.remove();
        });

        const restoreBtn = document.createElement("button");
        restoreBtn.type = "button";
        restoreBtn.className = "btn";
        restoreBtn.textContent = "Restore";
        restoreBtn.style.cssText = "padding: 6px 12px; font-size: 0.85rem; background: var(--success-color); color: white; border: none; border-radius: 4px; cursor: pointer;";
        restoreBtn.addEventListener("click", () => {
            restoreSubject(task.id);
            overlay.remove();
            renderPlan();
        });

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "btn";
        deleteBtn.textContent = "Delete";
        deleteBtn.style.cssText = "padding: 6px 12px; font-size: 0.85rem; background: var(--error-color); color: white; border: none; border-radius: 4px; cursor: pointer;";
        deleteBtn.addEventListener("click", () => {
            if (confirm(`Permanently delete \"${task.subject}\" and all its logs? This cannot be undone.`)) {
                deleteSubject(task.id);
                overlay.remove();
                renderArchivedTasks({ appState, beginEditSubject, renderPlan, restoreSubject, deleteSubject, isSingletonTask, formatLongDate, escapeHtml });
            }
        });

        actions.appendChild(editBtn);
        actions.appendChild(restoreBtn);
        actions.appendChild(deleteBtn);
        item.appendChild(info);
        item.appendChild(actions);
        modal.appendChild(item);
    });

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.textContent = "Close";
    closeBtn.style.cssText = "width: 100%; padding: 10px; margin-top: 16px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; color: var(--text-primary);";
    closeBtn.addEventListener("click", () => overlay.remove());
    modal.appendChild(closeBtn);

    overlay.appendChild(modal);
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    });

    document.body.appendChild(overlay);
}

export function renderTagSuggestions({ skillTagSuggestionsEl, factorTagSuggestionsEl, skillTagsInput, factorTagsInput, appState, skillTagMasterList, factorTagMasterList, normalizeTagList, renderTagSuggestionGroup, getAllTagSuggestions, appendTagToInput }) {
    renderTagSuggestionGroup(skillTagSuggestionsEl, getAllTagSuggestions("skillTags", appState, skillTagMasterList, factorTagMasterList, normalizeTagList), skillTagsInput, "No skill tags yet", appendTagToInput, normalizeTagList);
    renderTagSuggestionGroup(factorTagSuggestionsEl, getAllTagSuggestions("factorTags", appState, skillTagMasterList, factorTagMasterList, normalizeTagList), factorTagsInput, "No factor tags yet", appendTagToInput, normalizeTagList);
}

export function renderTagSuggestionGroup(container, tags, inputEl, emptyLabel, appendTagToInput, normalizeTagList) {
    if (!container) {
        return;
    }

    container.innerHTML = "";

    if (!tags.length) {
        const emptyState = document.createElement("div");
        emptyState.className = "tag-suggestion-empty";
        emptyState.textContent = emptyLabel;
        container.appendChild(emptyState);
        return;
    }

    tags.forEach((tag) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip ghost-chip";
        chip.textContent = tag;
        chip.addEventListener("click", () => appendTagToInput(inputEl, tag, normalizeTagList));
        container.appendChild(chip);
    });
}

export function getAllTagSuggestions(tagKey, appState, skillTagMasterList, factorTagMasterList, normalizeTagList) {
    const tagSet = new Set();

    const masterList = tagKey === "skillTags" ? skillTagMasterList : factorTagMasterList;
    masterList.forEach((tag) => tagSet.add(tag));

    appState.subjects.forEach((subject) => {
        normalizeTagList(subject && subject[tagKey]).forEach((tag) => tagSet.add(tag));
    });

    return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
}

export function appendTagToInput(inputEl, tag, normalizeTagList) {
    if (!inputEl || !tag) {
        return;
    }

    const existingTags = normalizeTagList(inputEl.value);
    if (existingTags.includes(tag)) {
        inputEl.focus();
        return;
    }

    const nextValue = existingTags.length > 0 ? `${existingTags.join(", ")}, ${tag}` : tag;
    inputEl.value = nextValue;
    inputEl.focus();
}
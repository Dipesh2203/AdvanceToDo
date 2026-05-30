/**
 * Plan/Subject Management Module
 * Handles rendering and display of study subjects/tasks and their details
 */

export function renderPlan(state, isSingletonTask, formatLongDate, escapeHtml, callbacks) {
    const { beginEditSubject, archiveSubject, renderArchivedTasks } = callbacks;
    const planList = document.getElementById("planList");

    if (!planList) {
        return;
    }

    planList.innerHTML = "";

    const activeSubjects = state.subjects.filter((item) => !item.archived);

    if (activeSubjects.length === 0) {
        const note = document.createElement("p");
        note.className = "empty-note";
        note.textContent = "No subjects yet. Add your first study topic.";
        planList.appendChild(note);
        return;
    }

    activeSubjects.forEach((item) => {
        const li = document.createElement("li");
        li.className = "plan-item";
        const dueDateLabel = item.dueDate ? formatLongDate(item.dueDate) : "No deadline";
        const targetLabel = isSingletonTask(item) ? `${item.target} min total` : `${item.target} min/day`;
        const frequencyLabel = isSingletonTask(item) ? "One-time task" : "Everyday task";
        const skillTagLabel = Array.isArray(item.skillTags) && item.skillTags.length > 0
            ? item.skillTags.join(", ")
            : "None";
        const factorTagLabel = Array.isArray(item.factorTags) && item.factorTags.length > 0
            ? item.factorTags.join(", ")
            : "None";

        const nameSpan = document.createElement("div");
        nameSpan.style.flex = "1";
        nameSpan.innerHTML = `<strong>${escapeHtml(item.subject)}</strong><div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">Target: ${targetLabel}</div><div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">Type: ${frequencyLabel}</div><div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">Deadline: ${escapeHtml(dueDateLabel)}</div><div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">Skills: ${escapeHtml(skillTagLabel)}</div><div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">Factors: ${escapeHtml(factorTagLabel)}</div>`;

        const actionsWrap = document.createElement("div");
        actionsWrap.style.cssText = "display: flex; gap: 8px; align-items: center; flex-wrap: wrap; justify-content: flex-end;";

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "timer-btn";
        editButton.textContent = "Edit";
        editButton.addEventListener("click", () => beginEditSubject(item.id));

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "remove-btn";
        removeButton.textContent = "Archive";
        removeButton.addEventListener("click", () => archiveSubject(item.id));

        actionsWrap.appendChild(editButton);
        actionsWrap.appendChild(removeButton);

        li.appendChild(nameSpan);
        li.appendChild(actionsWrap);
        planList.appendChild(li);
    });

    // Show archived tasks count
    const archivedCount = state.subjects.filter((item) => item.archived).length;
    if (archivedCount > 0) {
        const divider = document.createElement("li");
        divider.className = "plan-item archived-divider";
        divider.innerHTML = `<em style="color: var(--text-secondary); font-size: 0.85rem;">${archivedCount} archived task${archivedCount === 1 ? "" : "s"} • <button type="button" class="link-button" id="viewArchivedBtn">View</button></em>`;
        planList.appendChild(divider);

        const viewBtn = divider.querySelector("#viewArchivedBtn");
        if (viewBtn) {
            viewBtn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                renderArchivedTasks();
            });
        }
    }
}

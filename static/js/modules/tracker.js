/**
 * Tracker Table Module
 * Handles rendering of daily logs tracker table
 */

export function renderTrackerTable(state, isSingletonTask, filterDateKeys, formatDate, getTaskTimeFilterContext) {
    const trackerTableBodyEl = document.getElementById("trackerTableBody");

    if (!trackerTableBodyEl) {
        return;
    }

    trackerTableBodyEl.innerHTML = "";

    const availableDays = Object.keys(state.logs).sort().reverse();
    const filteredDays = filterDateKeys(availableDays);
    const requiredPerDay = state.subjects
        .filter((item) => !isSingletonTask(item))
        .reduce((sum, item) => sum + (Number(item.target) || 0), 0);

    if (filteredDays.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 2;
        cell.style.textAlign = "center";
        cell.style.color = "var(--text-secondary)";
        cell.textContent = "No daily logs found for this filter.";
        row.appendChild(cell);
        trackerTableBodyEl.appendChild(row);
        return;
    }

    filteredDays.forEach((dateKey) => {
        const bySubject = state.logs[dateKey] || {};
        const total = Object.values(bySubject).reduce((sum, value) => sum + (Number(value) || 0), 0);

        const row = document.createElement("tr");

        const dateCell = document.createElement("td");
        dateCell.style.fontWeight = "500";
        dateCell.textContent = formatDate(dateKey);

        const totalCell = document.createElement("td");
        totalCell.style.textAlign = "right";

        let levelClass = "tracker-level-0";
        if (total > 0) {
            if (requiredPerDay <= 0) {
                levelClass = "tracker-level-1";
            } else {
                const percentage = (total / requiredPerDay) * 100;
                if (percentage >= 100) levelClass = "tracker-level-4";
                else if (percentage >= 66) levelClass = "tracker-level-3";
                else if (percentage >= 33) levelClass = "tracker-level-2";
                else levelClass = "tracker-level-1";
            }
        }

        totalCell.className = `tracker-cell ${levelClass}`;
        totalCell.textContent = `${total} min`;

        row.appendChild(dateCell);
        row.appendChild(totalCell);
        row.addEventListener("click", () => {
            if (getTaskTimeFilterContext) {
                getTaskTimeFilterContext(dateKey);
            }
        });

        trackerTableBodyEl.appendChild(row);
    });
}

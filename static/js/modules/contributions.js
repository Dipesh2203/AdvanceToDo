/**
 * Contributions Graph Module
 * Handles GitHub-style contribution visualization and year filtering
 * Easily located and debugged for contribution chart issues
 */

export function renderContributionGraph(state, getSubjects, isSingletonTask) {
    const container = document.getElementById("contribution-graph-container");
    if (!container) return;

    const selectedYear = populateContributionYearFilter(state);
    const year = Number(selectedYear) || new Date().getFullYear();

    container.innerHTML = "";

    const requiredPerDay = getSubjects()
        .filter((item) => !isSingletonTask(item))
        .reduce((sum, item) => sum + (Number(item.target) || 0), 0);

    const monthGroups = new Map();
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);

    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
        const monthDate = new Date(year, monthIndex, 1);
        const monthKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
        monthGroups.set(monthKey, {
            label: monthDate.toLocaleString("default", { month: "short", year: "numeric" }),
            totalMinutes: 0,
            days: []
        });
    }

    for (let currentDate = new Date(startDate); currentDate <= endDate; currentDate.setDate(currentDate.getDate() + 1)) {
        const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
        const monthGroup = monthGroups.get(monthKey);
        if (!monthGroup) {
            continue;
        }

        const dateKey = currentDate.toISOString().split("T")[0];
        const dayData = state.logs[dateKey] || {};
        const total = Object.values(dayData).reduce((sum, val) => sum + (Number(val) || 0), 0);
        const weekdayIndex = (currentDate.getDay() + 6) % 7;

        let level = 0;
        if (total > 0) {
            if (requiredPerDay <= 0) {
                level = 1;
            } else {
                const percentage = (total / requiredPerDay) * 100;
                if (percentage >= 100) level = 4;
                else if (percentage >= 66) level = 3;
                else if (percentage >= 33) level = 2;
                else level = 1;
            }
        }

        monthGroup.totalMinutes += total;
        monthGroup.days.push({ dateKey, total, level, weekdayIndex });
    }

    monthGroups.forEach((monthGroup) => {
        const monthCard = document.createElement("section");
        monthCard.className = "contribution-month";

        const monthTitle = document.createElement("div");
        monthTitle.className = "contribution-month-title";
        monthTitle.textContent = monthGroup.label;

        const monthTotal = document.createElement("span");
        monthTotal.className = "contribution-month-total";
        monthTotal.textContent = `${formatLoggedHours(monthGroup.totalMinutes)} total`;
        monthTitle.appendChild(monthTotal);

        const monthGrid = document.createElement("div");
        monthGrid.className = "contribution-month-grid-inner";

        const firstDay = monthGroup.days[0];
        const leadingEmptyCells = firstDay ? firstDay.weekdayIndex : 0;
        const trailingEmptyCells = firstDay
            ? (7 - ((leadingEmptyCells + monthGroup.days.length) % 7)) % 7
            : 0;

        for (let i = 0; i < leadingEmptyCells; i++) {
            monthGrid.appendChild(createContributionEmptyCell());
        }

        monthGroup.days.forEach((day) => {
            monthGrid.appendChild(createContributionCell(day));
        });

        for (let i = 0; i < trailingEmptyCells; i++) {
            monthGrid.appendChild(createContributionEmptyCell());
        }

        monthCard.appendChild(monthTitle);
        monthCard.appendChild(monthGrid);
        container.appendChild(monthCard);
    });
}

/**
 * Setup contribution year filter dropdown
 * Triggers re-render when year changes
 */
export function setupContributionYearFilter(renderCallback) {
    const contributionYearFilterEl = document.getElementById("contributionYearFilter");
    if (!contributionYearFilterEl) {
        return;
    }

    contributionYearFilterEl.addEventListener("change", (event) => {
        const newYear = event.target.value;
        if (newYear && renderCallback) {
            renderCallback();
        }
    });
}

/**
 * Get available years from logs data
 */
export function getContributionYears(state) {
    const years = new Set();

    Object.keys(state.logs || {}).forEach((dateKey) => {
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
            years.add(dateKey.slice(0, 4));
        }
    });

    years.add(String(new Date().getFullYear()));
    return Array.from(years).sort((left, right) => Number(right) - Number(left));
}

/**
 * Populate year filter with available years
 * @returns {string} The selected year
 */
export function populateContributionYearFilter(state = null) {
    const contributionYearFilterEl = document.getElementById("contributionYearFilter");
    if (!contributionYearFilterEl) {
        const fallbackYears = state ? getContributionYears(state) : [String(new Date().getFullYear())];
        return fallbackYears[0];
    }

    // Get years from existing options or recreate
    const years = [];
    Array.from(contributionYearFilterEl.querySelectorAll("option")).forEach(option => {
        years.push(option.value);
    });

    if (years.length === 0) {
        const fallbackYears = state ? getContributionYears(state) : [String(new Date().getFullYear())];
        fallbackYears.forEach((year) => {
            const option = document.createElement("option");
            option.value = year;
            option.textContent = year;
            contributionYearFilterEl.appendChild(option);
        });
        return fallbackYears[0];
    }

    return contributionYearFilterEl.value || years[0];
}

/**
 * Create empty cell for contribution graph (leading/trailing days)
 */
function createContributionEmptyCell() {
    const emptyCell = document.createElement("div");
    emptyCell.className = "sq is-empty";
    emptyCell.setAttribute("aria-hidden", "true");
    return emptyCell;
}

/**
 * Create day cell for contribution graph
 */
function createContributionCell(day) {
    const square = document.createElement("div");
    square.className = `sq level-${day.level}`;
    square.style.backgroundColor = getContributionColor(day.level);
    square.title = `${formatContributionDate(day.dateKey)}: ${formatLoggedHours(day.total)} logged`;
    return square;
}

/**
 * Format date for contribution cell tooltip
 */
function formatContributionDate(dateKey) {
    const date = new Date(`${dateKey}T00:00:00`);
    return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric"
    });
}

/**
 * Format minutes to hours display
 */
export function formatLoggedHours(totalMinutes) {
    const totalHours = totalMinutes / 60;
    if (totalHours === 0) {
        return "0 hr";
    }

    const roundedHours = Math.round(totalHours * 10) / 10;
    return Number.isInteger(roundedHours) ? `${roundedHours} hr` : `${roundedHours.toFixed(1)} hr`;
}

/**
 * Get GitHub-style color for contribution level
 */
function getContributionColor(level) {
    const colors = {
        0: "#ebedf0",
        1: "#9be9a8",
        2: "#40c463",
        3: "#30a14e",
        4: "#216e39"
    };
    return colors[level];
}

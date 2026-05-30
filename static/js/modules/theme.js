/**
 * Theme Management Module
 * Handles dark/light theme toggle and persistence
 */

export const THEME_KEY = "study-tracker-theme";

/**
 * Setup theme toggle with persistence
 */
export function setupThemeToggle() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    const isDark = savedTheme === "dark";
    applyTheme(isDark);

    const themeToggleEl = document.getElementById("themeToggle");
    if (!themeToggleEl) {
        return;
    }

    themeToggleEl.addEventListener("click", () => {
        const willBeDark = !document.body.classList.contains("dark-theme");
        applyTheme(willBeDark);
        localStorage.setItem(THEME_KEY, willBeDark ? "dark" : "light");
    });
}

/**
 * Apply theme to document
 */
export function applyTheme(isDark) {
    document.body.classList.toggle("dark-theme", isDark);

    const themeToggleEl = document.getElementById("themeToggle");
    if (themeToggleEl) {
        const icon = isDark ? "☀" : "🌙";
        const label = isDark ? "Light" : "Dark";
        themeToggleEl.innerHTML = `<span aria-hidden="true">${icon}</span> ${label}`;
        themeToggleEl.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
    }
}

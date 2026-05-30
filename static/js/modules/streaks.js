import { diffDays } from "./utils.js";

export function calculateCurrentStreak(dateKeys, formatDateKey) {
    if (dateKeys.length === 0) {
        return 0;
    }

    const activeSet = new Set(dateKeys);
    const today = new Date();
    let streak = 0;

    for (let offset = 0; offset < 3650; offset += 1) {
        const date = new Date(today);
        date.setDate(today.getDate() - offset);
        const key = formatDateKey(date);

        if (activeSet.has(key)) {
            streak += 1;
            continue;
        }

        if (offset === 0) {
            continue;
        }

        break;
    }

    return streak;
}

export function calculateBestStreak(dateKeys) {
    if (dateKeys.length === 0) {
        return 0;
    }

    let best = 1;
    let run = 1;

    for (let i = 1; i < dateKeys.length; i += 1) {
        if (diffDays(dateKeys[i - 1], dateKeys[i]) === 1) {
            run += 1;
            best = Math.max(best, run);
        } else {
            run = 1;
        }
    }

    return best;
}
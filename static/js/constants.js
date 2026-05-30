/**
 * Application Constants
 * Centralized configuration for API endpoints, storage keys, and master lists
 */

// Storage & API Configuration
export const STORE_KEY_BASE = "study-tracker-v1";
export const THEME_KEY = "study-tracker-theme";
export const API_STATE_ENDPOINT = "/api/state";
export const API_PENDING_REMINDERS_ENDPOINT = "/api/reminders/pending";
export const SAVE_DEBOUNCE_MS = 500;
export const TIMER_REACHABILITY_POLL_MS = 15000;

// Skill & Factor Tag Master Lists
export const skillTagMasterList = [
    "communication",
    "active listening",
    "clarity",
    "empathy",
    "confidence",
    "feedback handling",
    "leadership",
    "vision",
    "delegation",
    "decision quality",
    "coaching",
    "accountability",
    "trust building",
    "problem solving",
    "analysis",
    "creativity",
    "prioritization",
    "execution speed",
    "learning from mistakes"
];

export const factorTagMasterList = [
    "active listening",
    "listening",
    "clarity",
    "empathy",
    "confidence",
    "feedback handling",
    "vision",
    "delegation",
    "decision quality",
    "coaching",
    "accountability",
    "trust building",
    "analysis",
    "creativity",
    "prioritization",
    "execution speed",
    "learning from mistakes"
];

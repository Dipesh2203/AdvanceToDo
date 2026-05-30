import * as state from "../state.js";

// Fallback toast notification for when browser notifications are blocked
function showToastNotification(title, body) {
    // Create a simple toast notification in the page if browser notifications fail
    const toast = document.createElement("div");
    toast.className = "notification-toast";
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: linear-gradient(135deg, var(--accent-green), var(--accent-blue));
        color: white;
        padding: 16px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        max-width: 400px;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    const titleEl = document.createElement("strong");
    titleEl.textContent = title;
    titleEl.style.cssText = "display: block; margin-bottom: 4px;";

    const bodyEl = document.createElement("div");
    bodyEl.textContent = body;
    bodyEl.style.cssText = "font-size: 0.9em; opacity: 0.95;";

    toast.appendChild(titleEl);
    toast.appendChild(bodyEl);
    document.body.appendChild(toast);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transition = "opacity 0.3s ease";
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

export function ensureNotificationPermission() {
    if (!canUseSystemNotifications()) {
        return;
    }

    if (Notification.permission === "default") {
        Notification.requestPermission().catch(() => {
            // Ignore permission request errors
        });
    }
}

export async function requestNotificationPermissionFromUser() {
    if (!canUseSystemNotifications() || Notification.permission !== "default") {
        return Notification.permission;
    }

    try {
        return await Notification.requestPermission();
    } catch (_error) {
        return Notification.permission;
    }
}

export function updateNotificationPermissionStatus(notificationPermissionStatusEl) {
    if (!notificationPermissionStatusEl) {
        return;
    }

    if (!canUseSystemNotifications()) {
        notificationPermissionStatusEl.textContent = "Notifications are blocked here. Open the app on https:// or localhost on the same device to enable them in Brave.";
        return;
    }

    if (Notification.permission === "granted") {
        notificationPermissionStatusEl.textContent = "Notifications are enabled.";
        return;
    }

    if (Notification.permission === "denied") {
        notificationPermissionStatusEl.textContent = "Notifications are blocked in Brave. Open site settings to allow them. (In-app alerts will show instead)";
        return;
    }

    notificationPermissionStatusEl.textContent = "Tap Enable Notifications to allow task alerts.";
}

export function sendTimerNotification(title, body) {
    // Always show fallback toast notification (works even when browser notifications are blocked)
    showToastNotification(title, body);

    if (!canUseSystemNotifications()) {
        return;
    }

    const options = {
        body,
        requireInteraction: true,
        renotify: true,
        tag: `task-${Date.now()}`,
        silent: false
    };

    if (Notification.permission === "granted") {
        if (state.notificationServiceWorkerRegistration && typeof state.notificationServiceWorkerRegistration.showNotification === "function") {
            state.notificationServiceWorkerRegistration.showNotification(title, options).catch(() => {
                try {
                    new Notification(title, options);
                } catch (_error) {
                    // Ignore notification failures
                }
            });
            return;
        }

        if (navigator.serviceWorker && typeof navigator.serviceWorker.getRegistration === "function") {
            navigator.serviceWorker.getRegistration()
                .then((registration) => {
                    if (registration && typeof registration.showNotification === "function") {
                        return registration.showNotification(title, options);
                    }

                    return new Notification(title, options);
                })
                .catch(() => {
                    try {
                        new Notification(title, options);
                    } catch (_error) {
                        // Ignore notification failures
                    }
                });
            return;
        }

        try {
            new Notification(title, options);
        } catch (_error) {
            // Ignore notification failures
        }
        return;
    }

    if (Notification.permission !== "default") {
        return;
    }

    Notification.requestPermission()
        .then((permission) => {
            if (permission === "granted") {
                sendTimerNotification(title, body);
            }
        })
        .catch(() => {
            // Ignore permission/notification failures
        });
}

function canUseSystemNotifications() {
    if (!("Notification" in window)) {
        return false;
    }

    const host = window.location.hostname;
    const isLocalhost = host === "localhost" || host === "127.0.0.1";
    return window.isSecureContext || isLocalhost;
}

export async function registerNotificationServiceWorker() {
    if (!("serviceWorker" in navigator)) {
        return;
    }

    try {
        state.setNotificationServiceWorkerRegistration(await navigator.serviceWorker.register("/sw.js"));
        state.setNotificationServiceWorkerRegistration(await navigator.serviceWorker.ready);
    } catch (_error) {
        state.setNotificationServiceWorkerRegistration(null);
        // Ignore service worker registration errors
    }
}

export function setupNotificationActivation() {
    const activate = () => {
        ensureNotificationPermission();
        document.removeEventListener("click", activate, true);
        document.removeEventListener("touchstart", activate, true);
        document.removeEventListener("keydown", activate, true);
    };

    document.addEventListener("click", activate, true);
    document.addEventListener("touchstart", activate, true);
    document.addEventListener("keydown", activate, true);
}

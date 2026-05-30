// Global error handling utilities
export function initGlobalErrorHandler(options = {}) {
    if (typeof window === "undefined") return;

    const reporter = options.reporter || null;

    window.addEventListener("error", (event) => {
        try {
            const err = event.error || new Error(event.message || "Unknown error");
            reportError(err, { source: "window.error", filename: event.filename, lineno: event.lineno, colno: event.colno, reporter });
        } catch (_e) {
            // Ignore handler failures
        }
    });

    window.addEventListener("unhandledrejection", (event) => {
        try {
            const reason = event.reason || new Error("Unhandled rejection");
            reportError(reason, { source: "unhandledrejection", reporter });
        } catch (_e) {
            // Ignore handler failures
        }
    });
}

export function reportError(error, meta = {}) {
    try {
        const payload = {
            message: error && error.message ? error.message : String(error),
            stack: error && error.stack ? error.stack : null,
            meta
        };

        // Local console fallback for development. Centralize logging here so callers don't call console.error directly.
        // Consumers may replace this with remote reporting by providing a `reporter` in initGlobalErrorHandler.
        if (typeof console !== "undefined" && typeof console.error === "function") {
            console.error("[AppError]", payload);
        }

        // Optionally call a remote reporter if provided
        if (meta && meta.reporter && typeof meta.reporter === "function") {
            try {
                meta.reporter(payload);
            } catch (_ignore) {
                // ignore reporter errors
            }
        }
    } catch (_e) {
        // swallow to avoid infinite loops
    }
}

export function wrapAsync(fn) {
    return async function (...args) {
        try {
            // eslint-disable-next-line new-cap
            return await fn.apply(this, args);
        } catch (err) {
            reportError(err, { source: "wrapAsync" });
            throw err;
        }
    };
}

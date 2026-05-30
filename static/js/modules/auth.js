/**
 * Authentication Module
 * Handles login, registration, logout, and auth UI management
 * Organized separately for clarity and maintainability
 */

// API Endpoints
export const API_LOGIN_ENDPOINT = "/api/auth/login";
export const API_REGISTER_ENDPOINT = "/api/auth/register";
export const API_LOGOUT_ENDPOINT = "/api/auth/logout";
export const API_ME_ENDPOINT = "/api/me";

// Auth state
export const authState = {
    user: null,
    loading: true
};

// UI elements - exported for use by other modules
export let authOverlayEl = null;
export let authStatusEl = null;
export let authScreenMessageEl = null;
export let authLoginFormEl = null;
export let authRegisterFormEl = null;
export let authGuestButtonEl = null;
export let authLogoutButtonEl = null;
export let authUserBadgeEl = null;
export let authAppBlockedClassApplied = false;

// Setter functions for UI elements
export function setAuthOverlayEl(el) { authOverlayEl = el; }
export function setAuthStatusEl(el) { authStatusEl = el; }
export function setAuthScreenMessageEl(el) { authScreenMessageEl = el; }
export function setAuthLoginFormEl(el) { authLoginFormEl = el; }
export function setAuthRegisterFormEl(el) { authRegisterFormEl = el; }
export function setAuthGuestButtonEl(el) { authGuestButtonEl = el; }
export function setAuthLogoutButtonEl(el) { authLogoutButtonEl = el; }
export function setAuthUserBadgeEl(el) { authUserBadgeEl = el; }
export function setAuthAppBlockedClassApplied(value) { authAppBlockedClassApplied = value; }

/**
 * Inject CSS styles for auth components
 */

export function injectAuthStyles() {
    if (document.getElementById("authStyles")) {
        return;
    }

    const style = document.createElement("style");
    style.id = "authStyles";
    style.textContent = `
        body.auth-locked .dashboard-shell {
            display: none !important;
        }

        .auth-overlay {
            position: fixed;
            inset: 0;
            z-index: 3000;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background: linear-gradient(135deg, rgba(240, 244, 248, 0.84), rgba(220, 232, 245, 0.94));
            backdrop-filter: blur(10px);
        }

        body.dark-theme .auth-overlay {
            background: linear-gradient(135deg, rgba(12, 14, 18, 0.88), rgba(28, 31, 36, 0.96));
        }

        .auth-overlay.is-visible {
            display: flex;
        }

        .auth-card {
            width: min(960px, 100%);
            border-radius: 30px;
            padding: 28px;
            background: linear-gradient(145deg, #f8fbff, #edf4ff);
            box-shadow: 0 24px 60px rgba(66, 88, 118, 0.22);
            border: 1px solid rgba(132, 157, 191, 0.2);
        }

        body.dark-theme .auth-card {
            background: linear-gradient(145deg, #1f2329, #2a2f36);
            box-shadow: 0 24px 60px rgba(6, 12, 22, 0.55);
            border-color: rgba(176, 183, 191, 0.16);
        }

        .auth-card h2 {
            margin: 0 0 10px;
            font-size: clamp(1.7rem, 4vw, 2.5rem);
        }

        .auth-card p {
            color: var(--text-secondary);
            margin: 0 0 18px;
        }

        .auth-layout {
            display: grid;
            grid-template-columns: 1.1fr 0.9fr;
            gap: 18px;
        }

        .auth-panel {
            border-radius: 24px;
            padding: 20px;
            background: linear-gradient(135deg, #f0f4f8, #ffffff);
            box-shadow: var(--shadow-inset);
            border: 1px solid rgba(140, 154, 177, 0.14);
        }

        body.dark-theme .auth-panel {
            background: linear-gradient(135deg, #22262c, #2c3138);
        }

        .auth-form {
            display: grid;
            gap: 10px;
        }

        .auth-form input {
            width: 100%;
            padding: 12px 14px;
            border: none;
            border-radius: 16px;
            background: linear-gradient(135deg, #f0f4f8, #ffffff);
            box-shadow: var(--shadow-inset);
            color: var(--text-primary);
            font-family: inherit;
        }

        .auth-form input:focus {
            outline: none;
            box-shadow: var(--shadow-inset), 0 0 0 3px rgba(168, 213, 186, 0.25);
        }

        .auth-header-controls {
            display: none;
            align-items: center;
            gap: 10px;
            position: fixed;
            top: 66px;
            right: 14px;
            z-index: 2200;
            padding: 8px;
            border-radius: 999px;
            background: rgba(245, 247, 250, 0.92);
            border: 1px solid rgba(140, 154, 177, 0.2);
            box-shadow: var(--shadow-inset);
            backdrop-filter: blur(4px);
        }

        .auth-user-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 14px;
            border-radius: 999px;
            background: var(--bg-primary);
            color: var(--text-secondary);
            font-size: 0.85rem;
            font-weight: 600;
            max-width: min(52vw, 280px);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .auth-logout-btn {
            padding: 9px 14px;
            border: none;
            border-radius: 999px;
            background: linear-gradient(135deg, #ff8f6b, #ff6a88);
            color: #ffffff;
            font-weight: 700;
            cursor: pointer;
        }

        @media (max-width: 760px) {
            .auth-layout {
                grid-template-columns: 1fr;
            }

            .auth-header-controls {
                top: 60px;
                right: 8px;
                left: 8px;
                justify-content: space-between;
            }
        }
    `;
    document.head.appendChild(style);
}

/**
 * Setup auth interface (login/register UI)
 */
export function setupAuthInterface() {
    if (!authOverlayEl) {
        authOverlayEl = document.createElement("section");
        authOverlayEl.id = "authOverlay";
        authOverlayEl.className = "auth-overlay";
        authOverlayEl.innerHTML = `
            <div class="auth-card">
                <h2>Sign in to continue</h2>
                <p>Use your account to keep tasks, sessions, and reports separate.</p>
                <div class="auth-layout">
                    <div class="auth-panel">
                        <h3>Log in</h3>
                        <form id="authLoginForm" class="auth-form">
                            <input id="authLoginUsername" name="username" type="text" autocomplete="username" placeholder="Username" required />
                            <input id="authLoginPassword" name="password" type="password" autocomplete="current-password" placeholder="Password" required />
                            <div class="auth-actions">
                                <button class="btn btn-primary" type="submit">Log in</button>
                            </div>
                        </form>
                        <div class="auth-hint">Demo: guest / guest123</div>
                    </div>
                    <div class="auth-guest-box">
                        <div class="auth-panel">
                            <h3>Create account</h3>
                            <form id="authRegisterForm" class="auth-form">
                                <input id="authRegisterUsername" name="username" type="text" autocomplete="username" placeholder="Username" required />
                                <input id="authRegisterDisplayName" name="displayName" type="text" autocomplete="name" placeholder="Display name" />
                                <input id="authRegisterPassword" name="password" type="password" autocomplete="new-password" placeholder="Password" required />
                                <div class="auth-actions">
                                    <button class="btn btn-primary" type="submit">Register</button>
                                </div>
                            </form>
                        </div>
                        <div class="guest-card">
                            <strong>Guest demo</strong>
                            <p style="margin-top: 6px;">Use the preloaded account to explore without creating a profile.</p>
                            <button id="authGuestButton" class="btn" type="button">Continue as Guest</button>
                        </div>
                        <div id="authStatus" class="auth-status"></div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertBefore(authOverlayEl, document.body.firstChild);
    }

    if (!authUserBadgeEl || !authLogoutButtonEl) {
        const headerRow = document.querySelector(".header-row");
        if (headerRow) {
            const controls = document.createElement("div");
            controls.className = "auth-header-controls";
            controls.innerHTML = `
                <span id="authUserBadge" class="auth-user-badge"></span>
                <button id="authLogoutButton" class="auth-logout-btn" type="button">Logout</button>
            `;
            headerRow.appendChild(controls);
            authUserBadgeEl = controls.querySelector("#authUserBadge");
            authLogoutButtonEl = controls.querySelector("#authLogoutButton");
        }
    }

    authStatusEl = authOverlayEl.querySelector("#authStatus");
    authScreenMessageEl = authStatusEl;
    authLoginFormEl = authOverlayEl.querySelector("#authLoginForm");
    authRegisterFormEl = authOverlayEl.querySelector("#authRegisterForm");
    authGuestButtonEl = authOverlayEl.querySelector("#authGuestButton");

    if (authLoginFormEl) {
        authLoginFormEl.addEventListener("submit", onAuthLoginSubmit);
    }

    if (authRegisterFormEl) {
        authRegisterFormEl.addEventListener("submit", onAuthRegisterSubmit);
    }

    if (authGuestButtonEl) {
        authGuestButtonEl.addEventListener("click", () => {
            void signInWithGuestDemo();
        });
    }
}

/**
 * Resolve current auth state by checking /api/me
 */
export async function resolveAuthState() {
    authState.loading = true;

    try {
        const response = await fetch(API_ME_ENDPOINT, {
            method: "GET",
            cache: "no-store"
        });

        if (!response.ok) {
            authState.user = null;
            return null;
        }

        const payload = await response.json();
        const user = payload && payload.user ? payload.user : null;
        setAuthenticatedUser(user);
        return user;
    } catch (_error) {
        authState.user = null;
        return null;
    } finally {
        authState.loading = false;
        updateAuthHeader();
    }
}

/**
 * Set authenticated user and update UI
 */
export function setAuthenticatedUser(user) {
    authState.user = user || null;

    if (authState.user) {
        hideAuthGate();
    }

    updateAuthHeader();
}

/**
 * Show auth gate (login screen)
 */
export function showAuthGate(message = "") {
    document.body.classList.add("auth-locked");
    authAppBlockedClassApplied = true;

    if (authOverlayEl) {
        authOverlayEl.classList.add("is-visible");
    }

    if (authScreenMessageEl) {
        authScreenMessageEl.textContent = message;
    }
}

/**
 * Hide auth gate
 */
export function hideAuthGate() {
    document.body.classList.remove("auth-locked");
    authAppBlockedClassApplied = false;

    if (authOverlayEl) {
        authOverlayEl.classList.remove("is-visible");
    }

    if (authScreenMessageEl) {
        authScreenMessageEl.textContent = "";
    }
}

/**
 * Update auth header with user info
 */
export function updateAuthHeader() {
    if (authUserBadgeEl && authLogoutButtonEl) {
        if (authState.user) {
            authUserBadgeEl.textContent = authState.user.isGuest
                ? `Guest • ${authState.user.displayName}`
                : authState.user.displayName;
            authLogoutButtonEl.textContent = "Logout";
            authLogoutButtonEl.disabled = false;
            const controls = authLogoutButtonEl.closest(".auth-header-controls");
            if (controls) {
                controls.style.display = "inline-flex";
            }
        } else {
            authUserBadgeEl.textContent = "";
            authLogoutButtonEl.disabled = true;
            const controls = authLogoutButtonEl.closest(".auth-header-controls");
            if (controls) {
                controls.style.display = "none";
            }
        }
    }
}

/**
 * Setup auth control event listeners
 */
export function setupAuthControls(onSignOut) {
    if (authLogoutButtonEl) {
        authLogoutButtonEl.addEventListener("click", () => {
            if (onSignOut) {
                void onSignOut();
            }
        });
    }
}

async function onAuthLoginSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await signInUser({
        username: String(formData.get("username") || ""),
        password: String(formData.get("password") || "")
    });
}

async function onAuthRegisterSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await registerUser({
        username: String(formData.get("username") || ""),
        displayName: String(formData.get("displayName") || ""),
        password: String(formData.get("password") || "")
    });
}

async function signInWithGuestDemo() {
    await signInUser({
        username: "guest",
        password: "guest123"
    });
}

export async function signInUser(credentials) {
    await submitAuthRequest(API_LOGIN_ENDPOINT, credentials, "Logged in successfully.");
}

async function registerUser(credentials) {
    await submitAuthRequest(API_REGISTER_ENDPOINT, credentials, "Account created.");
}

async function submitAuthRequest(endpoint, payload, successMessage) {
    if (authScreenMessageEl) {
        authScreenMessageEl.textContent = "Please wait...";
    }

    try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data && data.error ? data.error : "Authentication failed");
        }

        setAuthenticatedUser(data.user || null);

        if (authScreenMessageEl) {
            authScreenMessageEl.textContent = successMessage;
        }
    } catch (error) {
        if (authScreenMessageEl) {
            authScreenMessageEl.textContent = error instanceof Error ? error.message : "Authentication failed";
        }
    }
}

export async function signOutUser(onComplete) {
    try {
        await fetch(API_LOGOUT_ENDPOINT, {
            method: "POST",
            credentials: "same-origin"
        });
    } catch (_error) {
        // Continue clearing even if network fails
    }

    setAuthenticatedUser(null);
    showAuthGate("You have been logged out.");

    if (onComplete) {
        onComplete();
    }
}

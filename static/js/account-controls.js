(function () {
    "use strict";

    const API_ME_ENDPOINT = "/api/me";
    const API_LOGOUT_ENDPOINT = "/api/auth/logout";

    function injectStyles() {
        if (document.getElementById("globalAccountControlsStyles")) {
            return;
        }

        const style = document.createElement("style");
        style.id = "globalAccountControlsStyles";
        style.textContent = `
            .global-account-controls {
                position: fixed;
                top: 66px;
                right: 14px;
                z-index: 2200;
                display: none;
                align-items: center;
                gap: 8px;
                padding: 8px;
                border-radius: 999px;
                background: rgba(245, 247, 250, 0.92);
                border: 1px solid rgba(140, 154, 177, 0.2);
                box-shadow: inset 6px 6px 12px rgba(173, 185, 204, 0.28), inset -6px -6px 12px rgba(255, 255, 255, 0.88);
                backdrop-filter: blur(4px);
            }

            .global-account-badge {
                padding: 8px 12px;
                border-radius: 999px;
                font-size: 0.82rem;
                font-weight: 600;
                color: #2d3748;
                background: linear-gradient(135deg, #f8fbff, #ffffff);
                border: 1px solid rgba(140, 154, 177, 0.2);
                white-space: nowrap;
                max-width: min(52vw, 280px);
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .global-account-logout {
                border: none;
                border-radius: 999px;
                padding: 8px 12px;
                font-size: 0.82rem;
                font-weight: 600;
                cursor: pointer;
                color: #ffffff;
                background: linear-gradient(135deg, #e38f89, #d56f67);
                white-space: nowrap;
            }

            body.dark-theme .global-account-controls {
                background: rgba(28, 31, 36, 0.94);
                border-color: rgba(176, 183, 191, 0.22);
                box-shadow: inset 7px 7px 12px rgba(6, 8, 10, 0.56), inset -7px -7px 12px rgba(62, 68, 76, 0.16);
            }

            body.dark-theme .global-account-badge {
                color: #f2f4f7;
                background: linear-gradient(135deg, #24282f, #1e2228);
                border-color: rgba(176, 183, 191, 0.22);
            }

            @media (max-width: 640px) {
                .global-account-controls {
                    top: 60px;
                    right: 8px;
                    left: 8px;
                    justify-content: space-between;
                }

                .global-account-badge {
                    max-width: 68vw;
                }
            }
        `;

        document.head.appendChild(style);
    }

    function createControls() {
        let controls = document.getElementById("globalAccountControls");
        if (controls) {
            return controls;
        }

        controls = document.createElement("div");
        controls.id = "globalAccountControls";
        controls.className = "global-account-controls";
        controls.innerHTML = `
            <span id="globalAccountBadge" class="global-account-badge"></span>
            <button id="globalLogoutButton" class="global-account-logout" type="button">Logout</button>
        `;

        document.body.appendChild(controls);
        return controls;
    }

    async function loadUser() {
        try {
            const response = await fetch(API_ME_ENDPOINT, {
                method: "GET",
                cache: "no-store",
                credentials: "same-origin"
            });

            if (!response.ok) {
                return null;
            }

            const payload = await response.json();
            return payload && payload.user ? payload.user : null;
        } catch (_error) {
            return null;
        }
    }

    async function logoutAndRedirect() {
        try {
            await fetch(API_LOGOUT_ENDPOINT, {
                method: "POST",
                credentials: "same-origin"
            });
        } catch (_error) {
            // Continue redirect even if network cleanup fails.
        }

        window.location.href = "/tracker";
    }

    async function init() {
        // Tracker/reports pages already render auth controls via script.js.
        if (document.querySelector(".auth-header-controls")) {
            return;
        }

        injectStyles();
        const controls = createControls();
        const badge = document.getElementById("globalAccountBadge");
        const logoutButton = document.getElementById("globalLogoutButton");

        if (!controls || !badge || !logoutButton) {
            return;
        }

        const user = await loadUser();
        if (!user) {
            controls.style.display = "none";
            return;
        }

        const displayName = user.displayName || user.username || "User";
        badge.textContent = user.isGuest ? `Guest demo • ${displayName}` : displayName;
        controls.style.display = "inline-flex";

        logoutButton.addEventListener("click", () => {
            void logoutAndRedirect();
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            void init();
        });
    } else {
        void init();
    }
})();

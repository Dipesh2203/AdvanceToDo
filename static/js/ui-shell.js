(function () {
    "use strict";

    function getCurrentPath() {
        return window.location.pathname || "/tracker";
    }

    function normalizePath(pathname) {
        const raw = String(pathname || "").toLowerCase();

        if (raw === "/" || raw === "/tracker" || raw === "/index.html" || raw === "/pages/index.html") {
            return "/tracker";
        }

        if (raw === "/reports" || raw === "/pages/reports.html") {
            return "/reports";
        }

        return raw;
    }

    function ensureNavInHeaderRow(headerEl) {
        if (!headerEl) {
            return;
        }

        const row = headerEl.querySelector(".header-row");
        if (!row) {
            return;
        }

        let nav = headerEl.querySelector(".nav-rail");
        if (!nav) {
            nav = document.createElement("nav");
            nav.className = "nav-rail";
        }

        const pages = [
            { href: "/tracker", label: "Tracker" },
            { href: "/reports", label: "Reports" }
        ];

        if (nav.children.length === 0) {
            pages.forEach((page) => {
                const link = document.createElement("a");
                link.href = page.href;
                link.className = "nav-link";
                link.textContent = page.label;
                nav.appendChild(link);
            });
        }

        const titleEl = row.querySelector("h1");
        const themeBtn = row.querySelector("#themeToggle");

        if (nav.parentElement !== row) {
            nav.remove();
            if (titleEl && themeBtn) {
                row.insertBefore(nav, themeBtn);
            } else {
                row.appendChild(nav);
            }
        }

        const currentPath = normalizePath(getCurrentPath());
        Array.from(nav.querySelectorAll(".nav-link")).forEach((link) => {
            const target = link.getAttribute("href") || "";
            const targetPath = normalizePath(new URL(target, window.location.origin).pathname);
            link.classList.toggle("active", targetPath === currentPath);
        });
    }

    function initSharedShell() {
        const header = document.querySelector(".header");
        ensureNavInHeaderRow(header);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initSharedShell);
    } else {
        initSharedShell();
    }
})();

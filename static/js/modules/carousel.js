export function setupTaskCardSlider(logContainer, getTaskCarouselCards, moveTaskCarousel) {
    if (!logContainer) {
        return;
    }

    let wheelLocked = false;

    logContainer.addEventListener("wheel", (event) => {
        if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
            return;
        }

        const cards = getTaskCarouselCards();
        if (cards.length <= 1) {
            return;
        }

        event.preventDefault();

        if (wheelLocked) {
            return;
        }

        wheelLocked = true;
        setTimeout(() => {
            wheelLocked = false;
        }, 220);

        const direction = event.deltaY > 0 ? 1 : -1;
        moveTaskCarousel(direction);
    }, { passive: false });
}

export function moveTaskCarousel(logContainer, getTaskCarouselCards, scrollTaskCardToIndex, direction) {
    if (!logContainer) {
        return;
    }

    const cards = getTaskCarouselCards();
    if (cards.length === 0) {
        return;
    }

    const currentIndex = getActiveTaskCarouselIndex(logContainer, cards);
    const nextIndex = (currentIndex + direction + cards.length) % cards.length;
    scrollTaskCardToIndex(nextIndex);
}

export function scrollTaskCardToIndex(logContainer, getTaskCarouselCards, syncTaskCarouselState, index) {
    if (!logContainer) {
        return;
    }

    const cards = getTaskCarouselCards();
    if (cards.length === 0) {
        return;
    }

    const safeIndex = ((index % cards.length) + cards.length) % cards.length;
    logContainer.dataset.activeIndex = String(safeIndex);
    syncTaskCarouselState(safeIndex, false);
}

export function syncTaskCarouselState(logContainer, logPrevButtonEl, logNextButtonEl, logDotsEl, getTaskCarouselCards, getTaskCarouselDots, preferredIndex = null, shouldScroll = false) {
    if (!logContainer) {
        return;
    }

    const cards = getTaskCarouselCards();
    const dots = getTaskCarouselDots();

    if (cards.length === 0) {
        if (logPrevButtonEl) {
            logPrevButtonEl.disabled = true;
        }
        if (logNextButtonEl) {
            logNextButtonEl.disabled = true;
        }
        if (logDotsEl) {
            logDotsEl.innerHTML = "";
        }
        return;
    }

    const rawPreferred = preferredIndex !== null && !Number.isNaN(preferredIndex)
        ? preferredIndex
        : getActiveTaskCarouselIndex(logContainer, cards);
    const activeIndex = ((rawPreferred % cards.length) + cards.length) % cards.length;

    cards.forEach((card, index) => {
        let offset = index - activeIndex;
        if (offset > cards.length / 2) {
            offset -= cards.length;
        }
        if (offset < -cards.length / 2) {
            offset += cards.length;
        }

        const absOffset = Math.abs(offset);
        const scale = Math.max(0.62, 1 - absOffset * 0.15);
        const opacity = Math.max(0, 1 - absOffset * 0.25);

        card.style.setProperty("--offset", String(offset));
        card.style.setProperty("--card-scale", String(scale));
        card.style.setProperty("--card-opacity", String(opacity));
        card.style.setProperty("--card-z", String(100 - absOffset));
        card.classList.toggle("is-active-slide", index === activeIndex);
        card.classList.toggle("is-side-slide", index !== activeIndex);
        card.classList.toggle("is-distant-slide", absOffset > 2);
    });

    dots.forEach((dot, index) => {
        dot.classList.toggle("active", index === activeIndex);
        dot.setAttribute("aria-pressed", index === activeIndex ? "true" : "false");
    });

    if (logPrevButtonEl) {
        logPrevButtonEl.disabled = false;
    }

    if (logNextButtonEl) {
        logNextButtonEl.disabled = false;
    }

    logContainer.dataset.activeIndex = String(activeIndex);

    if (shouldScroll) {
        // 3D carousel is index-driven; no native scroll adjustment required.
    }
}

export function getTaskCarouselCards(logContainer) {
    if (!logContainer) {
        return [];
    }

    return Array.from(logContainer.querySelectorAll(".log-item"));
}

export function getTaskCarouselDots(logDotsEl) {
    if (!logDotsEl) {
        return [];
    }

    return Array.from(logDotsEl.querySelectorAll(".carousel-dot"));
}

export function getActiveTaskCarouselIndex(logContainer, cards) {
    if (!logContainer || !Array.isArray(cards) || cards.length === 0) {
        return 0;
    }

    const savedIndex = Number(logContainer.dataset.activeIndex || 0);
    if (Number.isNaN(savedIndex)) {
        return 0;
    }

    return ((savedIndex % cards.length) + cards.length) % cards.length;
}

export function syncTaskCarouselPresentation(logContainer, logDotsEl, getTaskCarouselCards, scrollTaskCardToIndex, preferredIndex = null) {
    if (!logDotsEl || !logContainer) {
        return;
    }

    const cards = getTaskCarouselCards();
    logDotsEl.innerHTML = "";

    cards.forEach((_card, index) => {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "carousel-dot";
        dot.setAttribute("aria-label", `Go to task ${index + 1}`);
        dot.setAttribute("aria-pressed", "false");
        dot.addEventListener("click", () => scrollTaskCardToIndex(index));
        logDotsEl.appendChild(dot);
    });

    scrollTaskCardToIndex(preferredIndex !== null ? preferredIndex : Number(logContainer.dataset.activeIndex || 0));
}
export function canUseTaskPictureInPicture() {
    return Boolean(window.documentPictureInPicture && typeof window.documentPictureInPicture.requestWindow === "function");
}

export function renderTaskPictureInPicture({
    state,
    appState,
    getPreferredTaskPipSubjectId,
    closeTaskPictureInPicture,
    refreshTaskPictureInPicture,
    getAdjustedTimerElapsedMinutes,
    getLiveTaskProgressMinutes,
    getRunningTaskIds,
    stopTimer,
    formatDuration,
    escapeHtml
}) {
    if (!state.taskPipWindowRef || state.taskPipWindowRef.closed) {
        return;
    }

    const subjectId = getPreferredTaskPipSubjectId(state.taskPipSubjectId);
    if (!subjectId) {
        closeTaskPictureInPicture();
        return;
    }

    const startedAt = Number(appState.activeTimers[subjectId]) || 0;
    const subject = appState.subjects.find((item) => item.id === subjectId);

    if (!startedAt || !subject) {
        refreshTaskPictureInPicture();
        return;
    }

    state.setTaskPipSubjectId(subjectId);

    const elapsedMinutes = getAdjustedTimerElapsedMinutes(startedAt);
    const liveProgress = Math.max(0, Math.round(getLiveTaskProgressMinutes(subject)));
    const target = Number(subject.target) || 0;
    const targetLabel = target > 0
        ? `${Math.min(liveProgress, target)} / ${target} min`
        : `${liveProgress} min`;
    const stateLabel = target > 0 && liveProgress >= target ? "Target reached" : "Running";
    const runningIds = getRunningTaskIds();
    const canSwitch = runningIds.length > 1;
    const isDark = document.body.classList.contains("dark-theme");

    const pipDoc = state.taskPipWindowRef.document;
    pipDoc.title = subject.subject || "Task";
    pipDoc.body.className = isDark ? "pip-theme-dark" : "pip-theme-light";
    pipDoc.body.innerHTML = `
        <style>
            :root {
                color-scheme: light dark;
            }

            body {
                margin: 0;
                min-height: 100vh;
                font-family: "Outfit", "Segoe UI", sans-serif;
                display: grid;
                align-content: stretch;
                background: linear-gradient(145deg, #f7f2ef, #ece2dc);
                color: #1a1816;
                padding: 0;
                overflow: hidden;
            }

            body.pip-theme-dark {
                background: linear-gradient(145deg, #171a1f, #23272d);
                color: #eaf1ff;
            }

            .pip-card {
                box-sizing: border-box;
                min-height: 100vh;
                border-radius: 14px;
                padding: 6px 8px 7px;
                background: rgba(255, 255, 255, 0.86);
                border: 1px solid rgba(110, 98, 89, 0.22);
                display: grid;
                grid-template-rows: auto auto auto;
                gap: 5px;
            }

            body.pip-theme-dark .pip-card {
                background: rgba(31, 35, 41, 0.9);
                border-color: rgba(182, 189, 197, 0.2);
            }

            .pip-title {
                margin: 0;
                font-size: 0.62rem;
                font-weight: 700;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                text-align: center;
            }

            .pip-state {
                font-size: 0.54rem;
                padding: 2px 5px;
                border-radius: 999px;
                background: rgba(77, 144, 129, 0.16);
                color: #1f5a4f;
                font-weight: 700;
                line-height: 1.2;
            }

            body.pip-theme-dark .pip-state {
                color: #d0d5db;
                background: rgba(110, 118, 128, 0.18);
            }

            .pip-time {
                margin: 0;
                font-size: 0.64rem;
                font-weight: 700;
                letter-spacing: 0.02em;
                line-height: 1;
                text-align: center;
            }

            .pip-sub {
                margin: 0;
                font-size: 0.52rem;
                color: #665f5a;
                line-height: 1.15;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                text-align: center;
            }

            body.pip-theme-dark .pip-sub {
                color: #c3c8cf;
            }

            .pip-controls {
                display: grid;
                grid-template-columns: 28px 1fr 28px;
                align-items: center;
                gap: 6px;
            }

            .pip-btn {
                border: none;
                border-radius: 9px;
                padding: 5px 2px;
                font-size: 0.6rem;
                font-weight: 700;
                cursor: pointer;
                background: linear-gradient(145deg, #f8f4f2, #e7ddd6);
                color: #3f3a36;
                min-height: 24px;
                line-height: 1;
            }

            body.pip-theme-dark .pip-btn {
                background: linear-gradient(145deg, #2a2f36, #1f2329);
                color: #f1f3f5;
            }

            .pip-btn-stop {
                background: linear-gradient(145deg, #f6b79b, #ef8a78);
                color: #4b1f1a;
            }

            .pip-btn-arrow {
                font-size: 0.9rem;
                padding: 0;
            }

            .pip-center {
                display: grid;
                gap: 3px;
                justify-items: center;
            }

            .pip-center .pip-btn-stop {
                width: 100%;
                max-width: 62px;
            }

            .pip-btn:disabled {
                cursor: not-allowed;
                opacity: 0.5;
            }
        </style>
        <article class="pip-card" aria-live="polite">
            <h1 class="pip-title">${escapeHtml(subject.subject || "Task")}</h1>
            <div class="pip-controls">
                <button id="pipPrevBtn" class="pip-btn pip-btn-arrow" type="button" ${canSwitch ? "" : "disabled"}>&larr;</button>
                <div class="pip-center">
                    <button id="pipStopBtn" class="pip-btn pip-btn-stop" type="button">Stop</button>
                    <p class="pip-time">${escapeHtml(formatDuration(elapsedMinutes))}</p>
                </div>
                <button id="pipNextBtn" class="pip-btn pip-btn-arrow" type="button" ${canSwitch ? "" : "disabled"}>&rarr;</button>
            </div>
            <p class="pip-sub">${escapeHtml(stateLabel)} • ${escapeHtml(targetLabel)}</p>
        </article>
    `;

    const stopBtn = pipDoc.getElementById("pipStopBtn");
    if (stopBtn) {
        stopBtn.addEventListener("click", () => {
            stopTimer(subjectId);
        });
    }

    const prevBtn = pipDoc.getElementById("pipPrevBtn");
    if (prevBtn) {
        prevBtn.addEventListener("click", () => {
            const ids = getRunningTaskIds();
            if (ids.length <= 1) {
                return;
            }

            const currentIndex = ids.indexOf(state.taskPipSubjectId);
            const prevIndex = currentIndex >= 0 ? (currentIndex - 1 + ids.length) % ids.length : 0;
            state.setTaskPipSubjectId(ids[prevIndex]);
            renderTaskPictureInPicture({
                state,
                appState,
                getPreferredTaskPipSubjectId,
                closeTaskPictureInPicture,
                refreshTaskPictureInPicture,
                getAdjustedTimerElapsedMinutes,
                getLiveTaskProgressMinutes,
                getRunningTaskIds,
                stopTimer,
                formatDuration,
                escapeHtml
            });
        });
    }

    const nextBtn = pipDoc.getElementById("pipNextBtn");
    if (nextBtn) {
        nextBtn.addEventListener("click", () => {
            const ids = getRunningTaskIds();
            if (ids.length <= 1) {
                return;
            }

            const currentIndex = ids.indexOf(state.taskPipSubjectId);
            const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % ids.length : 0;
            state.setTaskPipSubjectId(ids[nextIndex]);
            renderTaskPictureInPicture({
                state,
                appState,
                getPreferredTaskPipSubjectId,
                closeTaskPictureInPicture,
                refreshTaskPictureInPicture,
                getAdjustedTimerElapsedMinutes,
                getLiveTaskProgressMinutes,
                getRunningTaskIds,
                stopTimer,
                formatDuration,
                escapeHtml
            });
        });
    }
}
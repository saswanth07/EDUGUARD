/**
 * EduGuardian 2.0 - Browser Monitor (v3 — Deduplicated)
 *
 * Multi-layer tab-switch detection with deduplication:
 *   1. visibilitychange — standard tab switch
 *   2. window.blur/focus — window loses/gains focus
 *   3. document.hasFocus() polling (200ms) — catches extension switches
 *   4. requestAnimationFrame gap (>2s) — tab was backgrounded
 *   5. Keyboard: Alt+Tab, Ctrl+Tab detection
 *
 * Improvements over v2:
 *   - Cooldown: min 1.5s between tab-switch events (prevents spam)
 *   - Deduplication: visibilitychange + blur within 200ms = 1 event, not 2
 *   - PROLONGED_ABSENCE at 10s, 30s, 60s marks (not every 5s)
 *   - Total away-time tracking for summary reporting
 */
export class BrowserMonitor {
    constructor(onEvent) {
        this.onEvent = onEvent;
        this.tabSwitchCount = 0;
        this.copyPasteCount = 0;
        this.fullscreenExitCount = 0;
        this.windowFocusLostCount = 0;
        this.isActive = false;
        this.handlers = {};

        // Deduplication state
        this._lastTabSwitchTime = 0;
        this._TAB_SWITCH_COOLDOWN = 1500; // 1.5s between tab switch events
        this._blurPending = false;        // true if blur fired, waiting to see if visibilitychange also fires

        // Focus polling
        this._focusPoller = null;
        this._wasFocused = true;
        this._focusLostAt = null;
        this._MIN_FOCUS_LOST_MS = 400;

        // rAF heartbeat
        this._rafId = null;
        this._lastRafTs = null;
        this._RAF_GAP_THRESHOLD = 2000;

        // Away-time tracking
        this._totalAwayMs = 0;
        this._awayStart = null;
        this._prolongedReported = new Set(); // reported marks (10, 30, 60)
    }

    start() {
        this.isActive = true;
        this._wasFocused = document.hasFocus();
        this._lastRafTs = performance.now();
        this._lastTabSwitchTime = 0;

        // ── 1. Visibility change ──
        this.handlers.visibilityChange = () => {
            if (document.hidden) {
                this._blurPending = false; // visibilitychange takes priority over blur
                this._recordTabSwitch('Tab hidden (visibilitychange)');
                this._markAway();
            } else {
                this._markBack();
            }
        };

        // ── 2. Window blur / focus ──
        this.handlers.blur = () => {
            this.windowFocusLostCount++;
            // Set pending — if visibilitychange fires within 200ms, skip this one
            this._blurPending = true;
            setTimeout(() => {
                if (this._blurPending) {
                    this._blurPending = false;
                    this.onEvent({
                        eventType: 'WINDOW_BLUR',
                        severity: 'MEDIUM',
                        confidence: 0.85,
                        description: `Window lost focus (count: ${this.windowFocusLostCount})`,
                    });
                    this._markAway();
                }
            }, 200);
        };

        this.handlers.focus = () => {
            this._blurPending = false;
            this._focusLostAt = null;
            this._wasFocused = true;
            this._markBack();
        };

        // ── 3. Copy / Paste ──
        this.handlers.copy = () => {
            this.copyPasteCount++;
            this.onEvent({
                eventType: 'COPY_PASTE', severity: 'HIGH', confidence: 1.0,
                description: `Copy attempt (count: ${this.copyPasteCount})`,
            });
        };
        this.handlers.paste = () => {
            this.copyPasteCount++;
            this.onEvent({
                eventType: 'COPY_PASTE', severity: 'HIGH', confidence: 1.0,
                description: `Paste attempt (count: ${this.copyPasteCount})`,
            });
        };

        // ── 4. Fullscreen exit ──
        this.handlers.fullscreenChange = () => {
            if (!document.fullscreenElement) {
                this.fullscreenExitCount++;
                this.onEvent({
                    eventType: 'FULLSCREEN_EXIT', severity: 'HIGH', confidence: 1.0,
                    description: `Fullscreen exited (count: ${this.fullscreenExitCount})`,
                });
            }
        };

        // ── 5. Close / navigate away ──
        this.handlers.beforeUnload = () => {
            this.onEvent({
                eventType: 'DISCONNECT', severity: 'HIGH', confidence: 1.0,
                description: 'Student attempting to close or navigate away',
            });
        };

        // ── 6. Right-click block ──
        this.handlers.contextMenu = (e) => {
            e.preventDefault();
            this.onEvent({
                eventType: 'CONTEXT_MENU', severity: 'LOW', confidence: 0.6,
                description: 'Right-click blocked',
            });
        };

        // ── 7. Keyboard shortcuts ──
        this.handlers.keydown = (e) => {
            const key = e.key.toLowerCase();

            if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'a', 'p'].includes(key)) {
                e.preventDefault();
                this.copyPasteCount++;
                this.onEvent({
                    eventType: 'COPY_PASTE', severity: 'HIGH', confidence: 1.0,
                    description: `Blocked: Ctrl+${e.key.toUpperCase()}`,
                });
            }

            if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(key))) {
                e.preventDefault();
                this.onEvent({
                    eventType: 'DEV_TOOLS_ATTEMPT', severity: 'HIGH', confidence: 1.0,
                    description: 'Developer tools shortcut blocked',
                });
            }

            if (e.altKey && e.key === 'Tab') {
                this._recordTabSwitch('Alt+Tab keyboard');
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'Tab') {
                this._recordTabSwitch('Ctrl+Tab keyboard');
            }
        };

        // Register event listeners
        document.addEventListener('visibilitychange', this.handlers.visibilityChange);
        document.addEventListener('copy', this.handlers.copy);
        document.addEventListener('paste', this.handlers.paste);
        document.addEventListener('fullscreenchange', this.handlers.fullscreenChange);
        document.addEventListener('contextmenu', this.handlers.contextMenu);
        document.addEventListener('keydown', this.handlers.keydown);
        window.addEventListener('blur', this.handlers.blur);
        window.addEventListener('focus', this.handlers.focus);
        window.addEventListener('beforeunload', this.handlers.beforeUnload);

        // ── 8. Focus polling (catches extension tab switches) ──
        this._focusPoller = setInterval(() => {
            const focused = document.hasFocus();
            if (!focused && this._wasFocused) {
                this._focusLostAt = Date.now();
                this._wasFocused = false;
            } else if (focused && !this._wasFocused) {
                const duration = Date.now() - (this._focusLostAt || Date.now());
                if (duration >= this._MIN_FOCUS_LOST_MS && !document.hidden) {
                    this._recordTabSwitch(
                        `Extension tab switch (away ${duration}ms)`,
                        'EXTENSION_TAB_SWITCH'
                    );
                }
                this._wasFocused = true;
                this._focusLostAt = null;
                this._markBack();
            } else if (!focused && !this._wasFocused && this._focusLostAt) {
                const duration = Date.now() - this._focusLostAt;
                // Report at 10s, 30s, 60s marks
                for (const mark of [10, 30, 60]) {
                    const markMs = mark * 1000;
                    if (duration >= markMs && !this._prolongedReported.has(mark)) {
                        this._prolongedReported.add(mark);
                        this.onEvent({
                            eventType: 'PROLONGED_ABSENCE',
                            severity: mark >= 30 ? 'CRITICAL' : 'HIGH',
                            confidence: 0.95,
                            description: `Student away for ${mark}s`,
                        });
                    }
                }
            }
        }, 200);

        // ── 9. rAF gap detection ──
        const rafCheck = (ts) => {
            if (!this.isActive) return;
            if (this._lastRafTs !== null) {
                const gap = ts - this._lastRafTs;
                if (gap > this._RAF_GAP_THRESHOLD) {
                    this._recordTabSwitch(
                        `rAF gap ${Math.round(gap)}ms — tab backgrounded`,
                        'TAB_BACKGROUNDED'
                    );
                }
            }
            this._lastRafTs = ts;
            this._rafId = requestAnimationFrame(rafCheck);
        };
        this._rafId = requestAnimationFrame(rafCheck);
    }

    /**
     * Record a tab switch with cooldown-based deduplication.
     */
    _recordTabSwitch(reason, eventType = 'TAB_SWITCH') {
        const now = Date.now();
        if (now - this._lastTabSwitchTime < this._TAB_SWITCH_COOLDOWN) {
            return; // skip — too soon after last event
        }
        this._lastTabSwitchTime = now;
        this.tabSwitchCount++;
        this.onEvent({
            eventType,
            severity: this.tabSwitchCount > 2 ? 'HIGH' : 'MEDIUM',
            confidence: 0.95,
            description: `Tab switch #${this.tabSwitchCount}: ${reason}`,
        });
    }

    /** Track when student leaves */
    _markAway() {
        if (!this._awayStart) {
            this._awayStart = Date.now();
            this._prolongedReported.clear();
        }
    }

    /** Track when student returns */
    _markBack() {
        if (this._awayStart) {
            this._totalAwayMs += Date.now() - this._awayStart;
            this._awayStart = null;
        }
    }

    /** Get total time spent away from the exam (ms) */
    getTotalAwayTime() {
        let total = this._totalAwayMs;
        if (this._awayStart) total += Date.now() - this._awayStart;
        return total;
    }

    stop() {
        this._markBack();
        this.isActive = false;
        clearInterval(this._focusPoller);
        if (this._rafId) cancelAnimationFrame(this._rafId);

        document.removeEventListener('visibilitychange', this.handlers.visibilityChange);
        document.removeEventListener('copy', this.handlers.copy);
        document.removeEventListener('paste', this.handlers.paste);
        document.removeEventListener('fullscreenchange', this.handlers.fullscreenChange);
        document.removeEventListener('contextmenu', this.handlers.contextMenu);
        document.removeEventListener('keydown', this.handlers.keydown);
        window.removeEventListener('blur', this.handlers.blur);
        window.removeEventListener('focus', this.handlers.focus);
        window.removeEventListener('beforeunload', this.handlers.beforeUnload);
    }

    getStats() {
        return {
            tabSwitchCount: this.tabSwitchCount,
            copyPasteCount: this.copyPasteCount,
            fullscreenExitCount: this.fullscreenExitCount,
            windowFocusLostCount: this.windowFocusLostCount,
            totalAwayTimeMs: this.getTotalAwayTime(),
        };
    }
}

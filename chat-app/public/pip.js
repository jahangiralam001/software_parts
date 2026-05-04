'use strict';

/**
 * useDraggablePiP  — vanilla-JS equivalent of a custom hook
 * ──────────────────────────────────────────────────────────
 * Features:
 *   • Drag the PiP by mouse or touch
 *   • On release → snap to nearest corner (CSS transition)
 *   • On tap (no movement) → call onSwap()
 *
 * @param {HTMLElement} pipEl       – the small PiP video/element
 * @param {HTMLElement} containerEl – the overlay that acts as the drag boundary
 * @param {object}      opts
 *   @param {Function} opts.onSwap        – called on tap (no drag)
 *   @param {number}   opts.margin        – px from left/top/right edges   (default 12)
 *   @param {number}   opts.bottomMargin  – px from bottom edge (clears controls) (default 88)
 *   @param {number}   opts.dragThreshold – px before treating as drag vs tap (default 6)
 *   @param {number}   opts.snapDuration  – ms for snap animation (default 280)
 *
 * @returns {{ reset(): void, destroy(): void }}
 */
function useDraggablePiP(pipEl, containerEl, opts = {}) {
    const {
        onSwap        = null,
        margin        = 12,
        bottomMargin  = 88,
        dragThreshold = 6,
        snapDuration  = 280,
    } = opts;

    // ── state ────────────────────────────────────────────────────
    let _active    = false;
    let _hasMoved  = false;
    let _startX    = 0, _startY    = 0;
    let _startLeft = 0, _startTop  = 0;

    // ── helpers ──────────────────────────────────────────────────

    /** Convert bottom/right CSS to top/left so dragging uses a single coordinate system. */
    function _normalise() {
        const pr = containerEl.getBoundingClientRect();
        const er = pipEl.getBoundingClientRect();
        pipEl.style.left   = (er.left - pr.left) + 'px';
        pipEl.style.top    = (er.top  - pr.top)  + 'px';
        pipEl.style.right  = 'auto';
        pipEl.style.bottom = 'auto';
    }

    /** Move PiP clamped to container bounds. */
    function _moveTo(l, t) {
        const maxL = containerEl.offsetWidth  - pipEl.offsetWidth;
        const maxT = containerEl.offsetHeight - pipEl.offsetHeight;
        pipEl.style.left = Math.max(0, Math.min(maxL, l)) + 'px';
        pipEl.style.top  = Math.max(0, Math.min(maxT, t)) + 'px';
    }

    /** Animate snap to the nearest of the four corners. */
    function _snap() {
        const W  = containerEl.offsetWidth,  H  = containerEl.offsetHeight;
        const pw = pipEl.offsetWidth,        ph = pipEl.offsetHeight;

        const corners = [
            { top: margin,                  left: margin             },  // ↖
            { top: margin,                  left: W - pw - margin    },  // ↗
            { top: H - ph - bottomMargin,   left: margin             },  // ↙
            { top: H - ph - bottomMargin,   left: W - pw - margin    },  // ↘
        ];

        const cx = parseFloat(pipEl.style.left || 0) + pw / 2;
        const cy = parseFloat(pipEl.style.top  || 0) + ph / 2;

        let best = corners[0], bestD = Infinity;
        corners.forEach(c => {
            const d = (c.left + pw / 2 - cx) ** 2 + (c.top + ph / 2 - cy) ** 2;
            if (d < bestD) { bestD = d; best = c; }
        });

        const ease = `cubic-bezier(0.25, 0.8, 0.25, 1)`;
        pipEl.style.transition = `top ${snapDuration}ms ${ease}, left ${snapDuration}ms ${ease}`;
        pipEl.style.top  = best.top  + 'px';
        pipEl.style.left = best.left + 'px';
        setTimeout(() => { pipEl.style.transition = ''; }, snapDuration + 50);
    }

    /** Lift visual cue during drag. */
    function _lift()  { pipEl.style.boxShadow = '0 10px 36px rgba(0,0,0,0.75)'; pipEl.style.scale = '1.04'; }
    function _lower() { pipEl.style.boxShadow = '';                              pipEl.style.scale = '';      }

    // ── begin / move / end (shared) ──────────────────────────────

    function _begin(clientX, clientY) {
        _active    = true;
        _hasMoved  = false;
        _normalise();
        _startX    = clientX;
        _startY    = clientY;
        _startLeft = parseFloat(pipEl.style.left) || 0;
        _startTop  = parseFloat(pipEl.style.top)  || 0;
        pipEl.style.transition = 'none';
        _lift();
    }

    function _move(clientX, clientY) {
        if (!_active) return;
        const dx = clientX - _startX;
        const dy = clientY - _startY;
        if (!_hasMoved && (Math.abs(dx) > dragThreshold || Math.abs(dy) > dragThreshold)) {
            _hasMoved = true;
        }
        if (_hasMoved) _moveTo(_startLeft + dx, _startTop + dy);
    }

    function _end() {
        if (!_active) return;
        _active = false;
        _lower();
        if (!_hasMoved) {
            if (typeof onSwap === 'function') onSwap();
        } else {
            _snap();
        }
    }

    // ── mouse events ─────────────────────────────────────────────

    function _mouseDown(e) {
        if (e.button !== 0) return;
        e.preventDefault();
        pipEl.style.cursor = 'grabbing';
        _begin(e.clientX, e.clientY);
    }
    function _mouseMove(e) { _move(e.clientX, e.clientY); }
    function _mouseUp()    { pipEl.style.cursor = 'grab'; _end(); }

    // ── touch events ─────────────────────────────────────────────

    function _touchStart(e) { e.preventDefault(); const t = e.touches[0]; _begin(t.clientX, t.clientY); }
    function _touchMove(e)  { e.preventDefault(); const t = e.touches[0]; _move(t.clientX, t.clientY);  }
    function _touchEnd()    { _end(); }

    // ── attach ───────────────────────────────────────────────────

    pipEl.addEventListener('mousedown',  _mouseDown);
    window.addEventListener('mousemove', _mouseMove);
    window.addEventListener('mouseup',   _mouseUp);
    pipEl.addEventListener('touchstart', _touchStart, { passive: false });
    window.addEventListener('touchmove', _touchMove,  { passive: false });
    window.addEventListener('touchend',  _touchEnd);

    // ── public API ───────────────────────────────────────────────

    return {
        /** Place PiP in the bottom-right corner. Call after the overlay is visible. */
        reset() {
            pipEl.style.right  = 'auto';
            pipEl.style.bottom = 'auto';
            requestAnimationFrame(() => {
                const W  = containerEl.offsetWidth,  H  = containerEl.offsetHeight;
                const pw = pipEl.offsetWidth,        ph = pipEl.offsetHeight;
                pipEl.style.left = (W - pw - margin)         + 'px';
                pipEl.style.top  = (H - ph - bottomMargin)   + 'px';
            });
        },

        /** Remove all event listeners (call if you ever destroy the overlay). */
        destroy() {
            pipEl.removeEventListener('mousedown',  _mouseDown);
            window.removeEventListener('mousemove', _mouseMove);
            window.removeEventListener('mouseup',   _mouseUp);
            pipEl.removeEventListener('touchstart', _touchStart);
            window.removeEventListener('touchmove', _touchMove);
            window.removeEventListener('touchend',  _touchEnd);
        },
    };
}

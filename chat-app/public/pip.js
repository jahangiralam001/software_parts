'use strict';

/**
 * useDraggablePiP
 * ─────────────────────────────────────────────────────────────────────
 * Drag + snap-to-corner + tap-to-swap for the PiP video thumbnail.
 *
 * WHY A HANDLE DIV:
 *   Mobile browsers (iOS Safari, Chrome Android) intercept touch events
 *   on <video> elements for native controls, so listeners attached directly
 *   to the video element are silently swallowed. A transparent <div> sibling
 *   placed on top captures events reliably on every platform.
 */
function useDraggablePiP(pipEl, containerEl, opts = {}) {
    const {
        onSwap        = null,
        margin        = 12,
        bottomMargin  = 88,
        dragThreshold = 6,
        snapDuration  = 280,
    } = opts;

    let _active    = false;
    let _hasMoved  = false;
    let _startX    = 0, _startY    = 0;
    let _startLeft = 0, _startTop  = 0;

    // ── Transparent drag-handle overlay ──────────────────────────
    // Sits on top of the <video> and captures all pointer/touch events.
    const _handle = document.createElement('div');
    _handle.setAttribute('aria-hidden', 'true');
    Object.assign(_handle.style, {
        position:     'absolute',
        zIndex:       '11',
        cursor:       'grab',
        touchAction:  'none',
        userSelect:   'none',
        borderRadius: getComputedStyle(pipEl).borderRadius,
        // Start at same default position as the video
        bottom: '88px',
        right:  '12px',
    });
    containerEl.appendChild(_handle);

    // Video itself must not intercept pointer events
    pipEl.style.pointerEvents = 'none';

    // ── Helpers ──────────────────────────────────────────────────

    function _syncSize() {
        _handle.style.width  = pipEl.offsetWidth  + 'px';
        _handle.style.height = pipEl.offsetHeight + 'px';
    }

    function _normalise() {
        const pr = containerEl.getBoundingClientRect();
        const er = _handle.getBoundingClientRect();
        const l  = (er.left - pr.left) + 'px';
        const t  = (er.top  - pr.top)  + 'px';
        [pipEl, _handle].forEach(el => {
            el.style.left   = l;
            el.style.top    = t;
            el.style.right  = 'auto';
            el.style.bottom = 'auto';
        });
    }

    function _moveTo(l, t) {
        const maxL = containerEl.offsetWidth  - _handle.offsetWidth;
        const maxT = containerEl.offsetHeight - _handle.offsetHeight;
        const left = Math.max(0, Math.min(maxL, l)) + 'px';
        const top  = Math.max(0, Math.min(maxT, t)) + 'px';
        [pipEl, _handle].forEach(el => { el.style.left = left; el.style.top = top; });
    }

    function _snap() {
        const W  = containerEl.offsetWidth,  H  = containerEl.offsetHeight;
        const pw = _handle.offsetWidth,      ph = _handle.offsetHeight;
        const corners = [
            { top: margin,                left: margin           },
            { top: margin,                left: W - pw - margin  },
            { top: H - ph - bottomMargin, left: margin           },
            { top: H - ph - bottomMargin, left: W - pw - margin  },
        ];
        const cx = parseFloat(_handle.style.left || 0) + pw / 2;
        const cy = parseFloat(_handle.style.top  || 0) + ph / 2;
        let best = corners[0], bestD = Infinity;
        corners.forEach(c => {
            const d = (c.left + pw / 2 - cx) ** 2 + (c.top + ph / 2 - cy) ** 2;
            if (d < bestD) { bestD = d; best = c; }
        });
        const ease = 'cubic-bezier(0.25, 0.8, 0.25, 1)';
        const tr   = `top ${snapDuration}ms ${ease}, left ${snapDuration}ms ${ease}`;
        [pipEl, _handle].forEach(el => {
            el.style.transition = tr;
            el.style.top  = best.top  + 'px';
            el.style.left = best.left + 'px';
        });
        setTimeout(() => { [pipEl, _handle].forEach(el => { el.style.transition = ''; }); }, snapDuration + 50);
    }

    function _lift()  { pipEl.style.boxShadow = '0 10px 36px rgba(0,0,0,0.75)'; pipEl.style.transform = 'scale(1.05)'; }
    function _lower() { pipEl.style.boxShadow = '';                              pipEl.style.transform = '';             }

    // ── Shared begin / move / end ─────────────────────────────────

    function _begin(clientX, clientY) {
        _syncSize();
        _active   = true;
        _hasMoved = false;
        _normalise();
        _startX    = clientX;
        _startY    = clientY;
        _startLeft = parseFloat(_handle.style.left) || 0;
        _startTop  = parseFloat(_handle.style.top)  || 0;
        [pipEl, _handle].forEach(el => { el.style.transition = 'none'; });
        _handle.style.cursor = 'grabbing';
        _lift();
    }

    function _move(clientX, clientY) {
        if (!_active) return;
        const dx = clientX - _startX, dy = clientY - _startY;
        if (!_hasMoved && (Math.abs(dx) > dragThreshold || Math.abs(dy) > dragThreshold)) _hasMoved = true;
        if (_hasMoved) _moveTo(_startLeft + dx, _startTop + dy);
    }

    function _end() {
        if (!_active) return;
        _active = false;
        _handle.style.cursor = 'grab';
        _lower();
        if (!_hasMoved) { if (typeof onSwap === 'function') onSwap(); }
        else _snap();
    }

    // ── Mouse events (desktop) ────────────────────────────────────

    function _mouseDown(e) { if (e.button !== 0) return; e.preventDefault(); _begin(e.clientX, e.clientY); }
    function _mouseMove(e) { _move(e.clientX, e.clientY); }
    function _mouseUp()    { _end(); }

    // ── Touch events (mobile) ─────────────────────────────────────
    // Attached to _handle (not the video) — this is the key mobile fix.

    function _touchStart(e) { e.preventDefault(); const t = e.touches[0]; _begin(t.clientX, t.clientY); }
    function _touchMove(e)  { e.preventDefault(); const t = e.touches[0]; _move(t.clientX, t.clientY);  }
    function _touchEnd()    { _end(); }

    // ── Attach listeners ──────────────────────────────────────────

    _handle.addEventListener('mousedown',  _mouseDown);
    window.addEventListener('mousemove',   _mouseMove);
    window.addEventListener('mouseup',     _mouseUp);

    _handle.addEventListener('touchstart', _touchStart, { passive: false });
    window.addEventListener('touchmove',   _touchMove,  { passive: false });
    window.addEventListener('touchend',    _touchEnd);

    // ── Public API ────────────────────────────────────────────────

    return {
        /** Place PiP (and handle) in the bottom-right corner. Call after overlay is visible. */
        reset() {
            [pipEl, _handle].forEach(el => { el.style.right = 'auto'; el.style.bottom = 'auto'; });
            requestAnimationFrame(() => {
                _syncSize();
                const W  = containerEl.offsetWidth,  H  = containerEl.offsetHeight;
                const pw = _handle.offsetWidth,      ph = _handle.offsetHeight;
                const l = (W - pw - margin)       + 'px';
                const t = (H - ph - bottomMargin) + 'px';
                [pipEl, _handle].forEach(el => { el.style.left = l; el.style.top = t; });
            });
        },

        destroy() {
            _handle.removeEventListener('mousedown',  _mouseDown);
            window.removeEventListener('mousemove',   _mouseMove);
            window.removeEventListener('mouseup',     _mouseUp);
            _handle.removeEventListener('touchstart', _touchStart);
            window.removeEventListener('touchmove',   _touchMove);
            window.removeEventListener('touchend',    _touchEnd);
            pipEl.style.pointerEvents = '';
            if (_handle.parentElement) _handle.parentElement.removeChild(_handle);
        },
    };
}

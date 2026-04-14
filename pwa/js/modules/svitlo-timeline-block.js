/**
 * Svitlo Timeline Block — часовий скраббер для PWA SSSK
 * Адаптований під світлий дизайн SSSK
 *
 * Функціонал:
 * - 48 слотів по 30 хвилин (00:00–24:00)
 * - Drag з rigid snap
 * - Auto-return після 1 хв idle
 * - Keyboard: arrows (±30min), Home/End, PageUp/PageDown (±3h)
 * - Accessibility: ARIA slider pattern
 *
 * @attr data-intervals — JSON масив інтервалів [{start, end, status}]
 * @attr value — поточне значення у форматі "HH:MM" (controlled)
 * @attr current-time — поточний реальний час "HH:MM"
 * @attr disabled — блокування інтеракцій
 * @attr loading — режим завантаження
 * @attr error — режим помилки
 *
 * @fires change — при зміні значення (drag step)
 * @fires commit — після завершення взаємодії (drag end, key release)
 * @fires autoreturn — після автоматичного повернення до current time
 */

class SvitloTimelineBlock extends HTMLElement {
  static get observedAttributes() {
    return ['data-intervals', 'value', 'current-time', 'disabled', 'loading', 'error'];
  }

  // Константи
  static SLOTS_COUNT = 48;
  static SLOT_MINUTES = 30;
  static MINUTES_PER_DAY = 1440;
  static IDLE_TIMEOUT = 60000; // 1 хвилина
  static AUTO_RETURN_DURATION = 1500; // 1.5 секунди
  static STATUS_LABELS = {
    'available': 'світло є',
    'unavailable': 'світла немає',
    'unknown': 'дані відсутні'
  };

  constructor() {
    super();
    this.attachShadow({ mode: 'open', delegatesFocus: true });

    // Internal state
    this._selectedSlot = this._timeToSlot(this._getCurrentTimeString());
    this._currentSlot = this._selectedSlot;
    this._isDragging = false;
    this._idleTimer = null;
    this._dragStartX = 0;
    this._dragStartSlot = 0;
    this._trackWidth = 0;
    this._segments = []; // Обчислені сегменти станів
    this._pointerId = null;

    // Bind methods
    this._handlePointerDown = this._handlePointerDown.bind(this);
    this._handlePointerMove = this._handlePointerMove.bind(this);
    this._handlePointerUp = this._handlePointerUp.bind(this);
    this._handleKeyDown = this._handleKeyDown.bind(this);
    this._handleResize = this._handleResize.bind(this);
    this._resetIdleTimer = this._resetIdleTimer.bind(this);
    this._autoReturn = this._autoReturn.bind(this);

    this._render();
    this._setupEventListeners();
  }

  // ==================== LIFECYCLE ====================

  connectedCallback() {
    this._updateDimensions();
    this._processIntervals();
    this._updateUI();

    // Resize observer для адаптивності
    if (typeof ResizeObserver !== 'undefined') {
      this._resizeObserver = new ResizeObserver(this._handleResize);
      this._resizeObserver.observe(this);
    }
  }

  disconnectedCallback() {
    this._clearIdleTimer();
    this._removeEventListeners();
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;

    switch (name) {
      case 'data-intervals':
        this._processIntervals();
        this._updateTrackSegments();
        this._updateStatus();
        break;
      case 'value':
        if (!this._isDragging && !this._isAutoReturning) {
          const slot = this._timeToSlot(newValue);
          if (slot !== this._selectedSlot) {
            this._selectedSlot = slot;
            this._updateThumbPosition(false);
            this._updateStatus();
          }
        }
        break;
      case 'current-time':
        this._currentSlot = this._timeToSlot(newValue);
        if (!this._isDragging && !this._hasManualSelection) {
          this._selectedSlot = this._currentSlot;
          this._updateThumbPosition(false);
          this._updateStatus();
        }
        break;
      case 'loading':
      case 'error':
        this._updateVisualState();
        break;
    }
  }

  // ==================== GETTERS/SETTERS ====================

  get value() {
    return this._slotToTime(this._selectedSlot);
  }

  set value(timeString) {
    this.setAttribute('value', timeString);
  }

  get currentTime() {
    return this.getAttribute('current-time') || this._getCurrentTimeString();
  }

  set currentTime(timeString) {
    this.setAttribute('current-time', timeString);
  }

  // ==================== DATA PROCESSING ====================

  _processIntervals() {
    const rawData = this.getAttribute('data-intervals');
    if (!rawData) {
      this._segments = [{ startSlot: 0, endSlot: 48, status: 'unknown' }];
      return;
    }

    try {
      const intervals = JSON.parse(rawData);
      const slots = new Array(SvitloTimelineBlock.SLOTS_COUNT).fill('unknown');

      // Заповнюємо слоти за правилом >50%
      for (let i = 0; i < SvitloTimelineBlock.SLOTS_COUNT; i++) {
        const slotStart = i * SvitloTimelineBlock.SLOT_MINUTES;
        const slotEnd = slotStart + SvitloTimelineBlock.SLOT_MINUTES;

        let maxOverlap = 0;
        let bestStatus = 'unknown';

        for (const interval of intervals) {
          const intStart = this._timeToMinutes(interval.start);
          const intEnd = this._timeToMinutes(interval.end);

          const overlap = Math.max(0, Math.min(slotEnd, intEnd) - Math.max(slotStart, intStart));

          if (overlap > maxOverlap && overlap > SvitloTimelineBlock.SLOT_MINUTES / 2) {
            maxOverlap = overlap;
            bestStatus = interval.status;
          }
        }

        slots[i] = bestStatus;
      }

      // Об'єднуємо сусідні однакові статуси в сегменти
      this._segments = this._consolidateSegments(slots);

    } catch (e) {
      console.error('Invalid intervals data:', e);
      this._segments = [{ startSlot: 0, endSlot: 48, status: 'unknown' }];
    }
  }

  _consolidateSegments(slots) {
    const segments = [];
    let currentStatus = slots[0];
    let startSlot = 0;

    for (let i = 1; i <= slots.length; i++) {
      if (i === slots.length || slots[i] !== currentStatus) {
        segments.push({
          startSlot,
          endSlot: i,
          status: currentStatus,
          width: ((i - startSlot) / SvitloTimelineBlock.SLOTS_COUNT) * 100
        });
        if (i < slots.length) {
          currentStatus = slots[i];
          startSlot = i;
        }
      }
    }
    return segments;
  }

  // ==================== EVENT HANDLERS ====================

  _setupEventListeners() {
    const track = this.shadowRoot.querySelector('.track-wrap');
    const thumb = this.shadowRoot.querySelector('.thumb');

    track.addEventListener('pointerdown', this._handlePointerDown);
    thumb.addEventListener('pointerdown', this._handlePointerDown);

    this.addEventListener('keydown', this._handleKeyDown);

    // Global listeners для drag
    window.addEventListener('pointermove', this._handlePointerMove);
    window.addEventListener('pointerup', this._handlePointerUp);
    window.addEventListener('pointercancel', this._handlePointerUp);
  }

  _removeEventListeners() {
    const track = this.shadowRoot.querySelector('.track-wrap');
    const thumb = this.shadowRoot.querySelector('.thumb');

    if (track) track.removeEventListener('pointerdown', this._handlePointerDown);
    if (thumb) thumb.removeEventListener('pointerdown', this._handlePointerDown);

    this.removeEventListener('keydown', this._handleKeyDown);

    window.removeEventListener('pointermove', this._handlePointerMove);
    window.removeEventListener('pointerup', this._handlePointerUp);
    window.removeEventListener('pointercancel', this._handlePointerUp);
  }

  _handlePointerDown(e) {
    if (this.hasAttribute('disabled') || this.hasAttribute('loading')) return;

    e.preventDefault();
    this._isDragging = true;
    this._pointerId = e.pointerId;

    const thumb = this.shadowRoot.querySelector('.thumb');
    thumb.setPointerCapture(e.pointerId);

    this._dragStartX = e.clientX;
    this._dragStartSlot = this._selectedSlot;

    this._clearIdleTimer();
    this._updateDragCursor(true);

    // Відразу обробляємо початкову позицію якщо клік по треку
    if (e.target.classList.contains('track-wrap') || e.target.classList.contains('track')) {
      this._updatePositionFromClientX(e.clientX);
    }
  }

  _handlePointerMove(e) {
    if (!this._isDragging || e.pointerId !== this._pointerId) return;

    e.preventDefault();
    this._updatePositionFromClientX(e.clientX);
  }

  _handlePointerUp(e) {
    if (!this._isDragging || e.pointerId !== this._pointerId) return;

    this._isDragging = false;
    this._pointerId = null;

    const thumb = this.shadowRoot.querySelector('.thumb');
    try {
      thumb.releasePointerCapture(e.pointerId);
    } catch (e) {
      // Pointer might be already released
    }

    this._updateDragCursor(false);
    this._resetIdleTimer();

    // Fire commit event
    this.dispatchEvent(new CustomEvent('commit', {
      detail: { value: this.value, slot: this._selectedSlot },
      bubbles: true,
      composed: true
    }));
  }

  _handleKeyDown(e) {
    if (this.hasAttribute('disabled')) return;

    let newSlot = this._selectedSlot;
    let handled = false;

    switch (e.key) {
      case 'ArrowLeft':
        newSlot = Math.max(0, this._selectedSlot - 1);
        handled = true;
        break;
      case 'ArrowRight':
        newSlot = Math.min(SvitloTimelineBlock.SLOTS_COUNT, this._selectedSlot + 1);
        handled = true;
        break;
      case 'Home':
        newSlot = 0;
        handled = true;
        break;
      case 'End':
        newSlot = SvitloTimelineBlock.SLOTS_COUNT;
        handled = true;
        break;
      case 'PageUp':
        newSlot = Math.max(0, this._selectedSlot - 6); // -3 години
        handled = true;
        break;
      case 'PageDown':
        newSlot = Math.min(SvitloTimelineBlock.SLOTS_COUNT, this._selectedSlot + 6); // +3 години
        handled = true;
        break;
    }

    if (handled) {
      e.preventDefault();
      if (newSlot !== this._selectedSlot) {
        this._selectedSlot = newSlot;
        this._updateThumbPosition(true);
        this._updateStatus();
        this._resetIdleTimer();

        this.dispatchEvent(new CustomEvent('change', {
          detail: { value: this.value, slot: this._selectedSlot },
          bubbles: true,
          composed: true
        }));

        // Debounce commit для keyboard
        clearTimeout(this._keyboardCommitTimer);
        this._keyboardCommitTimer = setTimeout(() => {
          this.dispatchEvent(new CustomEvent('commit', {
            detail: { value: this.value, slot: this._selectedSlot },
            bubbles: true,
            composed: true
          }));
        }, 300);
      }
    }
  }

  _handleResize() {
    this._updateDimensions();
    this._updateThumbPosition(false);
  }

  // ==================== POSITION LOGIC ====================

  _updateDimensions() {
    const track = this.shadowRoot.querySelector('.track');
    if (track) {
      const rect = track.getBoundingClientRect();
      this._trackWidth = rect.width;
    }
  }

  _updatePositionFromClientX(clientX) {
    const track = this.shadowRoot.querySelector('.track');
    const rect = track.getBoundingClientRect();

    const relativeX = clientX - rect.left;
    const percent = Math.max(0, Math.min(1, relativeX / rect.width));

    // Rigid snap до найближчого слота
    const rawSlot = percent * SvitloTimelineBlock.SLOTS_COUNT;
    const snappedSlot = Math.round(rawSlot);

    if (snappedSlot !== this._selectedSlot) {
      this._selectedSlot = Math.max(0, Math.min(SvitloTimelineBlock.SLOTS_COUNT, snappedSlot));
      this._updateThumbPosition(true);
      this._updateStatus();

      this.dispatchEvent(new CustomEvent('change', {
        detail: { value: this.value, slot: this._selectedSlot },
        bubbles: true,
        composed: true
      }));
    }
  }

  _updateThumbPosition(animate = false) {
    const thumb = this.shadowRoot.querySelector('.thumb');
    const cursor = this.shadowRoot.querySelector('.cursor');

    if (!thumb || !cursor) return;

    // Calculate percentage relative to the track width
    const percent = (this._selectedSlot / SvitloTimelineBlock.SLOTS_COUNT) * 100;

    if (animate && !this._prefersReducedMotion()) {
      thumb.style.transition = 'left 0.1s ease-out';
      cursor.style.transition = 'left 0.1s ease-out';
    } else {
      thumb.style.transition = 'none';
      cursor.style.transition = 'none';
    }

    // Apply left position instead of transform, because transform (%) is relative to the thumb's width
    thumb.style.left = `${percent}%`;
    cursor.style.left = `${percent}%`;

    // Update ARIA
    this._updateAriaValues();

    // Reset transition after animation
    if (animate) {
      requestAnimationFrame(() => {
        thumb.style.transition = '';
        cursor.style.transition = '';
      });
    }
  }

  _updateDragCursor(isDragging) {
    const cursor = this.shadowRoot.querySelector('.cursor');
    const thumb = this.shadowRoot.querySelector('.thumb');

    if (isDragging) {
      cursor.classList.add('cursor--active');
      thumb.classList.add('thumb--dragging');
    } else {
      cursor.classList.remove('cursor--active');
      thumb.classList.remove('thumb--dragging');
    }
  }

  // ==================== AUTO RETURN ====================

  _resetIdleTimer() {
    this._clearIdleTimer();
    this._hasManualSelection = true;
    this._idleTimer = setTimeout(this._autoReturn, SvitloTimelineBlock.IDLE_TIMEOUT);
  }

  _clearIdleTimer() {
    if (this._idleTimer) {
      clearTimeout(this._idleTimer);
      this._idleTimer = null;
    }
  }

  _autoReturn() {
    if (this._isDragging) return;

    this._isAutoReturning = true;
    this._hasManualSelection = false;

    const startSlot = this._selectedSlot;
    const targetSlot = this._currentSlot;

    if (startSlot === targetSlot) {
      this._isAutoReturning = false;
      return;
    }

    const startTime = performance.now();
    const duration = SvitloTimelineBlock.AUTO_RETURN_DURATION;

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);

      // ease-in-out easing
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      this._selectedSlot = Math.round(startSlot + (targetSlot - startSlot) * eased);
      this._updateThumbPosition(false);
      this._updateStatus();

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this._selectedSlot = targetSlot;
        this._updateThumbPosition(false);
        this._isAutoReturning = false;
        this._triggerHalo();

        this.dispatchEvent(new CustomEvent('autoreturn', {
          detail: { value: this.value, slot: this._selectedSlot },
          bubbles: true,
          composed: true
        }));
      }
    };

    requestAnimationFrame(animate);
  }

  _triggerHalo() {
    if (this._prefersReducedMotion()) return;

    const thumb = this.shadowRoot.querySelector('.thumb');
    thumb.classList.add('thumb--halo');

    setTimeout(() => {
      thumb.classList.remove('thumb--halo');
    }, 1500);
  }

  // ==================== UI UPDATES ====================

  _updateTrackSegments() {
    const track = this.shadowRoot.querySelector('.track');
    if (!track) return;

    // Очищаємо тільки сегменти, зберігаючи структуру
    track.innerHTML = '';

    const isLoading = this.hasAttribute('loading');
    const isError = this.hasAttribute('error');

    if (isLoading) {
      track.classList.add('track--loading');
      track.classList.remove('track--error');
    } else if (isError) {
      track.classList.remove('track--loading');
      track.classList.add('track--error');
      // Додаємо один сегмент "дані відсутні"
      const segment = document.createElement('div');
      segment.className = 'track__segment track__segment--unknown';
      segment.style.width = '100%';
      track.appendChild(segment);
    } else {
      track.classList.remove('track--loading', 'track--error');

      for (const seg of this._segments) {
        const segment = document.createElement('div');
        segment.className = `track__segment track__segment--${seg.status}`;
        segment.style.width = `${seg.width}%`;
        track.appendChild(segment);
      }
    }
  }

  _updateStatus() {
    const statusEl = this.shadowRoot.querySelector('.status');
    if (!statusEl) return;

    const status = this._getSlotStatus(this._selectedSlot);
    const timeStr = this._slotToTime(this._selectedSlot);
    const label = SvitloTimelineBlock.STATUS_LABELS[status];

    statusEl.textContent = `${timeStr} — ${label}`;
    statusEl.className = `status status--${status}`;
  }

  _updateVisualState() {
    this._updateTrackSegments();
    this._updateStatus();
  }

  _updateUI() {
    this._updateTrackSegments();
    this._updateThumbPosition(false);
    this._updateStatus();
    this._updateAriaValues();
  }

  _updateAriaValues() {
    const status = this._getSlotStatus(this._selectedSlot);
    const label = SvitloTimelineBlock.STATUS_LABELS[status];

    this.setAttribute('role', 'slider');
    this.setAttribute('aria-valuemin', '00:00');
    this.setAttribute('aria-valuemax', '24:00');
    this.setAttribute('aria-valuenow', this.value);
    this.setAttribute('aria-valuetext', `${this.value} — ${label}`);
    this.setAttribute('aria-label', 'Часова шкала подачі електроенергії');

    if (this.hasAttribute('disabled')) {
      this.setAttribute('aria-disabled', 'true');
    } else {
      this.removeAttribute('aria-disabled');
    }
  }

  // ==================== HELPERS ====================

  _timeToSlot(timeStr) {
    if (!timeStr) return 0;
    const minutes = this._timeToMinutes(timeStr);
    return Math.round(minutes / SvitloTimelineBlock.SLOT_MINUTES);
  }

  _timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  }

  _slotToTime(slot) {
    const minutes = slot * SvitloTimelineBlock.SLOT_MINUTES;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  _getCurrentTimeString() {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  }

  _getSlotStatus(slot) {
    // Знаходимо статус для слота
    for (const seg of this._segments) {
      if (slot >= seg.startSlot && slot < seg.endSlot) {
        return seg.status;
      }
    }
    return 'unknown';
  }

  _prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // ==================== RENDER ====================

  _render() {
    const css = this._getStyles();
    const html = this._getTemplate();

    this.shadowRoot.innerHTML = `${css}${html}`;
  }

  _getStyles() {
    return `
      <style>
        :host {
          display: block;
          width: 100%;
          --svitlo-accent: #FF7A00;
          --svitlo-muted: #9AA0A6;
          --svitlo-neutral: #C2C5CA;
          --svitlo-bg: transparent;
          --svitlo-surface: rgba(0, 0, 0, 0.08);
          --svitlo-text: #333333;
          --svitlo-text-secondary: #6B7280;
          --thumb-size: 18px;
          --thumb-height: 28px;
          --touch-target: 44px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .timeline-block {
          padding: 12px 14px;
          background: var(--svitlo-bg);
          user-select: none;
          touch-action: pan-y;
        }

        .timeline-block__header {
          margin-bottom: 10px;
          padding: 0 4px;
        }

        .timeline-block__header h2 {
          margin: 0;
          font-size: 13px;
          font-weight: 600;
          color: var(--svitlo-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .track-wrap {
          position: relative;
          height: 75px;
          margin-bottom: 8px;
          cursor: grab;
          padding-top: 18px;
          box-sizing: border-box;
        }

        .track-wrap:active {
          cursor: grabbing;
        }

        .track {
          position: absolute;
          top: 50%;
          left: 0;
          right: 0;
          height: 20px;
          transform: translateY(-50%);
          border-radius: 10px;
          overflow: hidden;
          display: flex;
          background: var(--svitlo-surface);
          box-shadow: inset 0 1px 2px rgba(0,0,0,0.1);
        }

        .track--loading {
          background: linear-gradient(90deg, rgba(0,0,0,0.05) 25%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.05) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }

        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        .track__segment {
          height: 100%;
          transition: none;
        }

        .track__segment--available { background: var(--svitlo-accent); }
        .track__segment--unavailable { background: var(--svitlo-muted); }
        .track__segment--unknown { background: var(--svitlo-neutral); }

        .scale {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 100%;
          pointer-events: none;
        }

        .scale__tick {
          position: absolute;
          top: 0;
          width: 1px;
          height: 6px;
          background: var(--svitlo-text-secondary);
          opacity: 0.3;
        }

        .scale__tick--major {
          height: 10px;
          opacity: 0.6;
        }

        .scale__label {
          position: absolute;
          top: -14px;
          transform: translateX(-50%);
          font-size: 10px;
          color: var(--svitlo-text-secondary);
          font-variant-numeric: tabular-nums;
          font-weight: 500;
        }

        .cursor {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 2px;
          background: var(--svitlo-text);
          opacity: 0.2;
          pointer-events: none;
          transform: translateX(-50%);
        }

        .cursor--active {
          opacity: 0.5;
          background: var(--svitlo-accent);
        }

        .thumb {
          position: absolute;
          top: 50%;
          width: var(--thumb-size);
          height: var(--thumb-height);
          background: #FFFFFF;
          border: 2px solid var(--svitlo-text-secondary);
          border-radius: 8px;
          transform: translate(-50%, -50%);
          box-shadow: 0 2px 6px rgba(0,0,0,0.15);
          pointer-events: auto;
          touch-action: none;
          z-index: 10;
        }

        .thumb::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 6px;
          height: 14px;
          background: var(--svitlo-accent);
          border-radius: 3px;
          transform: translate(-50%, -50%);
        }

        .thumb--dragging {
          box-shadow: 0 4px 10px rgba(0,0,0,0.2);
          border-color: var(--svitlo-accent);
        }

        .thumb--halo {
          animation: halo 1.5s ease-in-out;
        }

        @keyframes halo {
          0% { box-shadow: 0 0 0 0 rgba(255, 122, 0, 0.3); }
          50% { box-shadow: 0 0 0 10px rgba(255, 122, 0, 0); }
          100% { box-shadow: 0 0 0 0 rgba(255, 122, 0, 0); }
        }

        /* Focus видимість */
        .thumb:focus-visible {
          outline: 2px solid var(--svitlo-accent);
          outline-offset: 2px;
        }

        :host(:focus-visible) .thumb {
          box-shadow: 0 0 0 3px rgba(255, 122, 0, 0.2);
        }

        .status {
          font-size: 12px;
          color: var(--svitlo-text-secondary);
          text-align: center;
          padding: 6px 0;
          font-variant-numeric: tabular-nums;
          font-weight: 500;
        }

        .status--available { color: var(--svitlo-accent); }
        .status--unavailable { color: var(--svitlo-muted); }
        .status--unknown { color: var(--svitlo-neutral); }

        /* Disabled state */
        :host([disabled]) .timeline-block {
          opacity: 0.5;
          pointer-events: none;
        }

        /* Reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .track--loading { animation: none; }
          .thumb--halo { animation: none; }
          .thumb, .cursor { transition: none !important; }
        }

        /* Mobile touch target */
        @media (pointer: coarse) {
          .thumb {
            width: var(--touch-target);
            height: var(--touch-target);
          }
          .thumb::before {
            width: 10px;
            height: 20px;
          }
        }
      </style>
    `;
  }

  _getTemplate() {
    // Генеруємо шкалу з мітками кожні 3 години — ЗВЕРХУ
    const majorTicks = [0, 3, 6, 9, 12, 15, 18, 21, 24];
    let scaleHTML = '';

    majorTicks.forEach(hour => {
      const slot = hour * 2; // 2 слоти на годину
      const leftPercent = (slot / SvitloTimelineBlock.SLOTS_COUNT) * 100;
      scaleHTML += `<div class="scale__tick scale__tick--major" style="left: ${leftPercent}%"></div>`;
      scaleHTML += `<div class="scale__label" style="left: ${leftPercent}%">${hour.toString().padStart(2, '0')}</div>`;
    });

    // Додаткові мітки кожну годину (крім основних)
    for (let h = 0; h < 24; h++) {
      if (!majorTicks.includes(h)) {
        const slot = h * 2;
        const leftPercent = (slot / SvitloTimelineBlock.SLOTS_COUNT) * 100;
        scaleHTML += `<div class="scale__tick" style="left: ${leftPercent}%"></div>`;
      }
    }

    return `
      <div class="timeline-block">
        <div class="track-wrap">
          <div class="scale">
            ${scaleHTML}
          </div>
          <div class="track"></div>
          <div class="cursor"></div>
          <div class="thumb" tabindex="0" role="slider"></div>
        </div>
        <div class="status">00:00 — завантаження...</div>
      </div>
    `;
  }
}

// Реєстрація Web Component
if (!customElements.get('svitlo-timeline-block')) {
  customElements.define('svitlo-timeline-block', SvitloTimelineBlock);
}

// Глобальна функція для конвертації scheduleString у intervals
function scheduleStringToIntervals(scheduleString) {
  if (!scheduleString || scheduleString.length !== 24) {
    return [];
  }

  const intervals = [];
  let startHour = 0;
  let currentState = scheduleString[0];

  for (let hour = 1; hour <= 24; hour++) {
    const state = hour < 24 ? scheduleString[hour] : null;

    if (state !== currentState || hour === 24) {
      const endHour = hour;
      const status = currentState === '1' ? 'available' : 'unavailable';

      intervals.push({
        start: `${startHour.toString().padStart(2, '0')}:00`,
        end: `${endHour.toString().padStart(2, '0')}:00`,
        status: status
      });

      if (hour < 24) {
        startHour = hour;
        currentState = state;
      }
    }
  }

  return intervals;
}

// Експорт для використання в інших модулях
if (typeof window !== 'undefined') {
  window.SvitloTimelineBlock = SvitloTimelineBlock;
  window.scheduleStringToIntervals = scheduleStringToIntervals;
}

/**
 * TomorrowTimeline.js
 * Автономний двигун графіка для сторінки "Завтра".
 * Забезпечує 1:1 візуальну відповідність з TimelineEngineV2 на головній.
 */

export class TomorrowTimeline {
    constructor(config) {
        this.container = document.getElementById(config.containerId);
        if (!this.container) return;

        this.scheduleString = config.scheduleString || "111100001111000011110000";
        this.tablo = config.tablo; // Reference to TomorrowController
        
        this.segments = [];
        this.events = [];
        this.scrubberInteracted = false;
        
        // Додаємо базовий клас контейнера для стилів timeline-v2.css
        this.container.classList.add('tl-v2-container');
    }

    init() {
        this.buildData();
        this.renderDOM();
        this.setupScrubber();
    }

    updateSchedule(newSchedule) {
        this.scheduleString = newSchedule;
        this.init();
    }

    /**
     * Розрахунок сегментів (On/Off) та маркерів подій
     */
    buildData() {
        this.segments = [];
        this.events = [];

        let currentType = (this.scheduleString[0] === '1') ? 'on' : 'off';
        let segmentStart = 0;

        for (let h = 1; h <= 24; h++) {
            const hCheck = h === 24 ? 23 : h;
            const type = (this.scheduleString[hCheck] === '1') ? 'on' : 'off';

            if (type !== currentType || h === 24) {
                this.segments.push({
                    start: segmentStart,
                    end: h,
                    type: currentType
                });

                if (h < 24) {
                    this.events.push({
                        time: h * 60,
                        hour: h,
                        type: type
                    });
                }
                
                segmentStart = h;
                currentType = type;
            }
        }
    }

    /**
     * Рендеринг DOM-структури, сумісної з timeline-v2.css
     */
    renderDOM() {
        this.container.innerHTML = `
            <div class="tl-v2-scroll-wrapper" style="overflow-x: auto; -webkit-overflow-scrolling: touch;">
                <div class="tl-v2-stage" id="tomorrow-tl-stage" style="width: 100%; min-width: 800px; height: 120px; position: relative; margin: 20px 0;">
                    <div class="tl-v2-scale"></div>
                    <div class="tl-v2-ticks-layer" id="tomorrow-v2-ticks"></div>
                    <div class="tl-v2-segments-layer" id="tomorrow-v2-segments"></div>
                    <div class="tl-v2-events-layer" id="tomorrow-v2-events"></div>
                    
                    <!-- Шар взаємодії (Повзунок/Скраббер) -->
                    <div class="tl-v2-interactions">
                        <input type="range" min="0" max="1440" value="0" class="tl-v2-scrubber-raw" id="tomorrow-v2-scrubber-input">
                        <div class="tl-v2-custom-handle" id="tomorrow-v2-handle" style="position: absolute; top: 50%; width: 6px; margin: 0; transform: translateY(-50%); height: 120px; z-index: 6; pointer-events: none;">
                            <div class="handle-core" style="width: 4px; height: 100%; background: linear-gradient(to bottom, transparent, #64748B 15%, #64748B 85%, transparent); opacity: 0.5; margin: 0 auto;"></div>
                            <div class="handle-grip" style="width: 24px; height: 36px; border-radius: 6px; background: rgba(255,255,255,0.95); box-shadow: 0 2px 8px rgba(0,0,0,0.15); border: 1.5px solid #E5E7EB; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 4px;">
                                <div style="width: 12px; height: 2px; background: #9CA3AF; border-radius: 1px;"></div>
                                <div style="width: 12px; height: 2px; background: #9CA3AF; border-radius: 1px;"></div>
                                <div style="width: 12px; height: 2px; background: #9CA3AF; border-radius: 1px;"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const ticksContainer = this.container.querySelector('#tomorrow-v2-ticks');
        const segmentsContainer = this.container.querySelector('#tomorrow-v2-segments');
        const eventsContainer = this.container.querySelector('#tomorrow-v2-events');

        // 1. Малюємо засічки часу (кожні 3 години - великі, як на головній)
        for (let h = 0; h <= 24; h++) {
            const leftPerc = (h / 24) * 100;
            const isMajor = (h % 3 === 0);
            const tickClass = isMajor ? 'major' : 'minor';

            if (ticksContainer) {
                ticksContainer.insertAdjacentHTML('beforeend', `
                    <div class="tl-v2-tick ${tickClass}" style="left: ${leftPerc}%;"></div>
                `);
                
                if (isMajor) {
                    ticksContainer.insertAdjacentHTML('beforeend', `
                        <div class="tl-v2-tick-label" style="left: ${leftPerc}%; transform: translateX(-50%);">
                            ${h.toString().padStart(2, '0')}:00
                        </div>
                    `);
                }
            }
        }

        // 2. Малюємо кольорові сегменти (On/Off)
        this.segments.forEach(seg => {
            const startPerc = (seg.start / 24) * 100;
            const widthPerc = ((seg.end - seg.start) / 24) * 100;

            if (segmentsContainer) {
                segmentsContainer.insertAdjacentHTML('beforeend', `
                    <div class="tl-v2-segment is-${seg.type}" 
                         style="left: ${startPerc}%; width: ${widthPerc}%;"></div>
                `);
            }
        });

        // 3. Малюємо маркери перемикання та баджі
        let previousPerc = -100;
        let altOffset = false;

        this.events.forEach(ev => {
            const perc = (ev.time / 1440) * 100;
            
            let badgeShift = 0;
            if ((perc - previousPerc) < 10) { 
                altOffset = !altOffset;
                badgeShift = altOffset ? 12 : -12;
            } else {
                altOffset = false;
            }
            previousPerc = perc;

            if (eventsContainer) {
                eventsContainer.insertAdjacentHTML('beforeend', `
                    <div class="tl-v2-marker-line type-${ev.type}" style="left: ${perc}%;"></div>
                    <div class="tl-v2-badge type-${ev.type}" style="left: ${perc}%; margin-left: ${badgeShift}px;">
                        ${ev.hour.toString().padStart(2, '0')}:00
                    </div>
                `);
            }
        });
    }

    /**
     * Налаштування логіки скраббінгу
     */
    setupScrubber() {
        this.scrubberInput = this.container.querySelector('#tomorrow-v2-scrubber-input');
        this.handle = this.container.querySelector('#tomorrow-v2-handle');

        if (!this.scrubberInput || !this.handle) return;

        // Встановлюємо на 0 при старті
        this.scrubberInput.value = 0;
        this.updateHandlePosition(0);
        this.updateDashboard(0); // Синхронізуємо табло на 00:00 при старті


        this.scrubberInput.addEventListener('input', (e) => {
            this.scrubberInteracted = true;
            const mins = parseInt(e.target.value);
            this.updateHandlePosition(mins);
            this.updateDashboard(mins);
        });
    }

    updateHandlePosition(mins) {
        if (!this.handle) return;
        const perc = (mins / 1440) * 100;
        this.handle.style.left = `calc(${perc}% - 3px)`;
    }

    /**
     * Оновлення Табло (TomorrowController) при зміні часу на графіку
     */
    updateDashboard(mins) {
        if (this.tablo && typeof this.tablo.updateFromTimeline === 'function') {
            this.tablo.updateFromTimeline(mins);
        }
    }
}

/**
 * TimelineEngineV2.js
 * Реалізує логіку нового, багаторівневого графіку (ізольований від старої версії).
 */

export class TimelineEngineV2 {
    constructor(config) {
        this.container = document.getElementById(config.containerId || 'main-timeline-v2');
        if (!this.container) {
            console.error('TimelineEngineV2: Container not found', config.containerId);
            return;
        }

        this.scheduleString = config.scheduleString;
        this.selectedGroup = config.selectedGroup;
        this.groups = config.groups || ['1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2', '5.1', '5.2', '6.1', '6.2'];
        this.demoMode = config.demoMode || false;
        this.isAllClearDay = config.isAllClearDay || false;
        
        // Ensure container is styled wrapping
        this.container.classList.add('tl-v2-container');

        this.events = [];
        this.segments = [];
        this.scrubberInteracted = false;
        this.scrubberTimeout = null;
        this.timerId = null; // Track time update interval
    }

    init() {
        this.buildData();
        this.renderDOM();
        this.setupScrubber();
        this.startTick();
    }

    stopAutoUpdate() {
        if (this.timerId) clearInterval(this.timerId);
        if (this.scrubberTimeout) clearTimeout(this.scrubberTimeout);
        this.timerId = null;
        this.scrubberTimeout = null;
    }

    checkIsOffAtHour(h) {
        if (this.isAllClearDay) return false;
        if (this.scheduleString && this.scheduleString.length === 24) {
            return this.scheduleString[Math.floor(h)] === '0';
        }
        const groupIndex = this.groups.indexOf(this.selectedGroup);
        if (this.demoMode) {
            return ((Math.floor(h) + groupIndex) % 10 < 5);
        } else {
            return ((Math.floor(h) + groupIndex * 2) % 6 < 3);
        }
    }

    buildData() {
        this.events = [];
        this.segments = [];

        let currentType = this.checkIsOffAtHour(0) ? 'off' : 'on';
        let segmentStart = 0;

        for (let h = 1; h <= 24; h++) {
            const hCheck = h === 24 ? 23 : h; // 24 uses 23 state logically or closes off
            const isOff = this.checkIsOffAtHour(hCheck);
            const type = isOff ? 'off' : 'on';

            if (type !== currentType || h === 24) {
                // Close segment
                this.segments.push({
                    start: segmentStart,
                    end: h,
                    type: currentType
                });

                if (h < 24) {
                    this.events.push({
                        time: h * 60, // in minutes
                        hour: h,
                        type: type // The new state we transition TO
                    });
                }
                
                segmentStart = h;
                currentType = type;
            }
        }
    }

    renderDOM() {
        this.container.innerHTML = `
            <div class="tl-v2-scroll-wrapper">
                <div class="tl-v2-stage" id="tl-v2-stage">
                    <div class="tl-v2-scale"></div>
                    <div class="tl-v2-ticks-layer" id="v2-ticks"></div>
                    <div class="tl-v2-segments-layer" id="v2-segments"></div>
                    <div class="tl-v2-events-layer" id="v2-events"></div>
                    <div class="tl-v2-now-layer" id="v2-now"></div>
                    <div class="tl-v2-interactions">
                        <input type="range" min="0" max="1440" value="0" class="tl-v2-scrubber-raw" id="v2-scrubber-input">
                        <div class="tl-v2-custom-handle" id="v2-handle" style="position: absolute; top: 50%; width: 6px; margin: 0; transform: translateY(-50%); height: 120px; z-index: 6; pointer-events: none;">
                            <!-- The thin line across the stage (4px, 50% opacity, with fadded edges) -->
                            <div class="handle-core" style="width: 4px; height: 100%; background: linear-gradient(to bottom, transparent, #64748B 15%, #64748B 85%, transparent); opacity: 0.5; margin: 0 auto;"></div>
                            
                            <!-- The tactile grip pill centered exactly on the axis -->
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

        const ticksContainer = document.getElementById('v2-ticks');
        const segmentsContainer = document.getElementById('v2-segments');
        const eventsContainer = document.getElementById('v2-events');

        // Draw Ticks (Every hour: Major/Minor)
        for (let h = 0; h <= 24; h++) {
            const leftPerc = (h / 24) * 100;
            const isMajor = (h % 3 === 0);
            const tickClass = isMajor ? 'major' : 'minor';

            ticksContainer.innerHTML += `
                <div class="tl-v2-tick ${tickClass}" style="left: ${leftPerc}%;"></div>
            `;
            
            if (isMajor) {
                ticksContainer.innerHTML += `
                    <div class="tl-v2-tick-label" style="left: ${leftPerc}%;">
                        ${h.toString().padStart(2, '0')}:00
                    </div>
                `;
            }
        }

        // Draw Segments
        const currentHour = new Date().getHours() + new Date().getMinutes() / 60;
        this.segments.forEach(seg => {
            const startPerc = (seg.start / 24) * 100;
            const widthPerc = ((seg.end - seg.start) / 24) * 100;
            const isPast = seg.end <= currentHour ? 'is-past' : '';

            segmentsContainer.innerHTML += `
                <div class="tl-v2-segment is-${seg.type}" 
                     style="left: ${startPerc}%; width: ${widthPerc}%;"></div>
            `;
        });

        // Resolve Badge Collisions
        // Rule: if < 40px (approx 40px/360px ~ 11% of typical width = ~ 2.6 hours)
        // Let's do simple visual check: if difference in hours < 2, separate them vertically by using ± offsets, or CSS transforms
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

            eventsContainer.innerHTML += `
                <div class="tl-v2-marker-line type-${ev.type}" style="left: ${perc}%;"></div>
                <div class="tl-v2-badge type-${ev.type}" style="left: ${perc}%; margin-left: ${badgeShift}px;">
                    ${ev.hour.toString().padStart(2, '0')}:00
                </div>
            `;
        });

        // Now line
        const nowLayer = document.getElementById('v2-now');
        nowLayer.innerHTML = `
            <div class="tl-v2-now-line" id="v2-now-line">
                <div class="tl-v2-now-dot"></div>
            </div>
        `;
        this.nowLine = document.getElementById('v2-now-line');
        this.updateTime();
    }

    updateTime() {
        if (!this.nowLine) return;
        const now = new Date();
        const mins = now.getHours() * 60 + now.getMinutes();
        const perc = (mins / 1440) * 100;
        
        // 1. Оновлення лінії NOW
        this.nowLine.style.left = `${perc}%`;

        // 2. Оновлення маски для "Минулого" (приглушення)
        const stage = document.getElementById('tl-v2-stage');
        if (stage) {
            stage.style.setProperty('--tl-v2-now-perc', `${perc}%`);
        }

        // If not interacted, sync the scrubber and handle to NOW
        if (!this.scrubberInteracted && this.scrubberInput && this.handle) {
            this.scrubberInput.value = mins;
            const handlePerc = mins / 1440;
            this.handle.style.left = `calc(${handlePerc * 100}% - 3px)`;
            window.isTimelineScrubbing = false;
            
            // Sync dashboard to real time
            this.updateDashboard(mins);
        }
    }

    getNextTransitionTime(totalMinutes) {
        if (!this.segments || this.segments.length === 0) return null;
        const currentH = totalMinutes / 60;
        
        // Знайти сегмент, який містить поточний час
        const activeSeg = this.segments.find(s => currentH >= s.start && currentH < s.end);
        if (activeSeg && activeSeg.end < 24) {
            const h = activeSeg.end;
            return `${h.toString().padStart(2, '0')}:00`;
        }

        // Страховка: знайти перший сегмент, що починається після поточного часу
        for (const seg of this.segments) {
            if (seg.start > currentH) {
                const h = Math.floor(seg.start);
                return `${h.toString().padStart(2, '0')}:00`;
            }
        }
        return "00:00"; // Цикл на наступний день
    }

    updateDashboard(mins) {
        const now = new Date();
        const nowTotal = now.getHours() * 60 + now.getMinutes();
        const isPast = mins < nowTotal;
        
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        const currentH = mins / 60;
        
        // Перевірка стану (світло є/немає) для обраної хвилини
        const activeSeg = this.segments.find(s => currentH >= s.start && currentH < s.end);
        const isOff = activeSeg ? activeSeg.type === 'off' : false;

        // 1. Годинник (capsule-clock-display)
        const capsuleClockEl = document.getElementById('capsule-clock-display');
        
        if (capsuleClockEl) {
            const hStr = h.toString().padStart(2, '0');
            const mStr = m.toString().padStart(2, '0');
            const clockContent = `${hStr}<span class="separator">:</span>${mStr}<span class="seconds"></span>`;

            if (this.scrubberInteracted) {
                // В режимі скраббінгу ховаємо секунди
                capsuleClockEl.innerHTML = clockContent;
            }
        }

        // --- NEW Capsule Status sync ---
        const capStatusCard = document.getElementById('capsule-status-card');
        const capStatusText = document.getElementById('capsule-status-text');
        const capStatusIcon = document.getElementById('capsule-status-icon');

        if (capStatusCard) {
            if (isPast) {
                capStatusCard.style.opacity = '0';
                capStatusCard.style.pointerEvents = 'none';
            } else {
                capStatusCard.style.opacity = '1';
                capStatusCard.style.pointerEvents = 'auto';
                
                const nextTime = this.getNextTransitionTime(mins);
                if (capStatusText) capStatusText.textContent = nextTime ? `до\u2009${nextTime}` : "—";
                if (capStatusIcon) {
                    capStatusIcon.src = isOff ? 'assets/dashboard_off.svg' : 'assets/dashboard_on.svg';
                }
            }
        }

        // 3. Колір повзунка (синхронно зі станом)
        if (this.scrubberInput) {
            const scrubberColor = isOff ? '#8E8E93' : '#FF9500';
            this.scrubberInput.style.setProperty('--scrubber-color', scrubberColor);
        }
    }

    startTick() {
        this.stopAutoUpdate(); // Ensure no duplicate timers
        this.timerId = setInterval(() => this.updateTime(), 60000);
    }

    setupScrubber() {
        this.scrubberInput = document.getElementById('v2-scrubber-input');
        this.handle = document.getElementById('v2-handle');

        if (!this.scrubberInput || !this.handle) return;

        const updateHandle = () => {
            this.scrubberInteracted = true;
            window.isTimelineScrubbing = true;
            clearTimeout(this.scrubberTimeout);

            const val = parseInt(this.scrubberInput.value);
            const perc = val / 1440;
            this.handle.style.left = `calc(${perc * 100}% - 3px)`; 
            
            // Sync Dashboard UI
            this.updateDashboard(val);
        };

        this.scrubberInput.addEventListener('input', updateHandle);

        this.scrubberInput.addEventListener('change', () => {
            clearTimeout(this.scrubberTimeout);
            this.scrubberTimeout = setTimeout(() => {
                this.scrubberInteracted = false;
                this.updateTime();
                // We should also trigger the visual updates here if needed
                // (e.g. notify other components through events or window properties)
            }, 15000); // 15 seconds cooldown
        });

        // initial sync
        this.updateTime();
    }
}

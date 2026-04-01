/**
 * TimelineEngine.js
 * Відповідає виключно за математику та відмальовування шкали (scrubber),
 * градієнту та спливаючої підказки (preview bubble).
 */

export class TimelineEngine {
    constructor(config) {
        this.scheduleData = config.scheduleData;
        this.scheduleString = config.scheduleString;
        this.selectedGroup = config.selectedGroup;
        this.groups = config.groups || ['1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2', '5.1', '5.2', '6.1', '6.2'];
        
        this.rail = document.getElementById('ruler-rail');
        this.ticksContainer = document.getElementById('ruler-ticks');
        this.scrubber = document.getElementById('timeline-scrubber');
        this.industrialHandle = document.getElementById('scrubber-industrial-handle');
        this.preview = document.getElementById('dashboard-tablo');
        
        this.scrubberInteracted = false;
        this.lastVibrationTime = 0; // Prevent constant vibration
        this.updateInterval = null;
        this.demoMode = config.demoMode || false;
        this.isAllClearDay = config.isAllClearDay || false;
        this.isTomorrowView = document.body.classList.contains('page-tomorrow');
    }

    init() {
        if (!this.scrubber) return;

        // Ідеальна математична синхронізація:
        // Rail та Ticks мають padding 10px (тобто ширина активної зони = 100% - 20px).
        // Thumb має ширину 6px.
        // Щоб центр Thumb (3px) стояв рівно на 0:00 (10px від краю), input має починатися на 10 - 3 = 7px.
        // Ширина input має бути (100% - 20px) + 6px = 100% - 14px.
        this.scrubber.max = 1440;
        this.scrubber.style.position = 'absolute';
        this.scrubber.style.left = '7px';
        this.scrubber.style.width = 'calc(100% - 14px)';
        this.scrubber.style.margin = '0';
        this.scrubber.style.padding = '0';
        this.scrubber.style.zIndex = '30';

        this.scrubber.oninput = () => {
            this.scrubberInteracted = true;
            this.updateScrubberPreview();
        };

        // Hover Effect Handlers
        const addScrubbingClass = () => this.rail.classList.add('is-scrubbing');
        const removeScrubbingClass = () => {
            this.rail.classList.remove('is-scrubbing');
            this.clearActiveBlocks();
        };

        this.scrubber.addEventListener('mousedown', addScrubbingClass);
        this.scrubber.addEventListener('mouseup', removeScrubbingClass);
        this.scrubber.addEventListener('touchstart', addScrubbingClass, { passive: true });
        this.scrubber.addEventListener('touchend', removeScrubbingClass, { passive: true });

        this.scrubber.addEventListener('change', () => {
             clearTimeout(this.scrubberTimeout);
             this.scrubberTimeout = setTimeout(() => {
                 this.scrubberInteracted = false;
                 window.isTimelineScrubbing = false; // Reset global scrubbing flag
                 this.updateToCurrentTime();
                 this.clearActiveBlocks();
             }, 15000); // Повернення до реальності через 15 секунд бездії
        });

        this.renderTimeline();
        this.updateToCurrentTime();
        this.startAutoUpdate();
    }

    startAutoUpdate() {
        if (this.updateInterval) clearInterval(this.updateInterval);
        this.updateInterval = setInterval(() => {
            if (!this.scrubberInteracted) {
                this.renderTimeline();
                this.updateToCurrentTime();
            }
        }, 60000);
    }

    stopAutoUpdate() {
        if (this.updateInterval) clearInterval(this.updateInterval);
    }

    clearActiveBlocks() {
        if (!this.rail) return;
        Array.from(this.rail.children).forEach(child => {
            if (child.classList.contains('hour-block')) {
                child.classList.remove('active-block');
            }
        });
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

    renderTimeline() {
        if (!this.rail || !this.ticksContainer) return;

        this.rail.innerHTML = '';
        this.rail.style.background = 'transparent';
        this.rail.style.display = 'flex';
        this.rail.style.gap = '0'; 
        this.rail.style.height = '55px'; 
        this.rail.style.borderRadius = '0';
        
        let transitions = []; 
        const currentHour = new Date().getHours();

        for (let h = 0; h < 24; h++) {
            const isOff = this.checkIsOffAtHour(h);
            const block = document.createElement('div');
            block.className = 'hour-block';
            block.dataset.hour = h;
            
            if (h > 0) {
                const prevIsOff = this.checkIsOffAtHour(h - 1);
                if (isOff !== prevIsOff) {
                    transitions.push({ hour: h, type: isOff ? 'off' : 'on' });
                }
            }

            if (!this.isTomorrowView && h < currentHour && !this.isAllClearDay) {
                block.classList.add('past');
            }

            const topTrack = document.createElement('div');
            topTrack.className = 'top-track';
            topTrack.style.width = 'calc(100% - 2px)';

            const bottomTrack = document.createElement('div');
            bottomTrack.className = 'bottom-track';
            bottomTrack.style.width = 'calc(100% - 2px)';

            if (this.isAllClearDay) {
                topTrack.style.backgroundColor = '#FF9500';
                bottomTrack.style.backgroundColor = 'transparent';
            } else if (isOff) {
                topTrack.style.backgroundColor = 'transparent';
                bottomTrack.style.backgroundColor = 'rgba(142, 142, 147, 0.4)';
            } else {
                topTrack.style.backgroundColor = '#FF9500';
                bottomTrack.style.backgroundColor = 'transparent';
            }

            block.appendChild(topTrack);
            block.appendChild(bottomTrack);
            this.rail.appendChild(block);
        }

        this.ticksContainer.innerHTML = '';
        for (let h = 0; h <= 24; h++) {
            const notch = document.createElement('div');
            notch.className = 'tick-notch';
            notch.style.left = `${(h / 24) * 100}%`;
            this.ticksContainer.appendChild(notch);
        }

        const labelIntervals = [0, 3, 6, 9, 12, 15, 18, 21, 24];
        const transitionHours = transitions.map(t => t.hour);

        labelIntervals.forEach(h => {
            if (transitionHours.includes(h)) return;
            const tick = document.createElement('div');
            tick.className = 'tick hour-mark';
            tick.style.background = 'transparent'; 
            tick.innerHTML = `<span class="tick-label">${h}:00</span>`;
            tick.style.left = `${(h / 24) * 100}%`;
            if (h === 0) tick.querySelector('.tick-label').style.transform = 'translate(0, -50%)';
            if (h === 24) tick.querySelector('.tick-label').style.transform = 'translate(-100%, -50%)';
            this.ticksContainer.appendChild(tick);
        });

        transitions.forEach(t => {
            const h = t.hour;
            const step = document.createElement('div');
            step.className = `transition-step step-${t.type}`;
            step.style.left = `${(h / 24) * 100}%`;
            this.ticksContainer.appendChild(step);

            const badgeContainer = document.createElement('div');
            badgeContainer.className = 'tick hour-mark';
            badgeContainer.style.background = 'transparent';
            badgeContainer.innerHTML = `<span class="transition-badge badge-${t.type}">${h}:00</span>`;
            badgeContainer.style.left = `${(h / 24) * 100}%`;
            this.ticksContainer.appendChild(badgeContainer);
        });

        if (!this.isTomorrowView && !this.isAllClearDay && !this.demoMode) {
            this.nowLine = document.createElement('div');
            this.nowLine.id = 'current-time-line';
            this.nowLine.className = 'current-time-line';
            this.ticksContainer.appendChild(this.nowLine);
        }
    }

    updateToCurrentTime() {
        if (!this.scrubber) return;
        const now = new Date();
        const totalMins = now.getHours() * 60 + now.getMinutes();

        if (this.nowLine) {
            this.nowLine.style.left = `${(totalMins / 1440) * 100}%`;
        }

        this.scrubber.value = totalMins;
        window.isTimelineScrubbing = false; 
        this.updateScrubberPreview();
    }

    updateScrubberPreview() {
        if (!this.scrubber) return;

        const val = parseInt(this.scrubber.value);
        const h = Math.floor(val / 60);
        const m = val % 60;
        const isOff = this.checkIsOffAtHour(h);

        // 1.1.15: Synchronize Industrial Handle Position
        if (this.industrialHandle) {
            // Position math: starts at 10px, maps 0-1440 to 0% - 100% of the active area (Total - 20px)
            const percentage = (val / 1440);
            this.industrialHandle.style.left = `calc(10px + ${percentage * 100}% - ${percentage * 20}px)`;
            
            // Check for Real Time Match
            const now = new Date();
            const nowTotal = now.getHours() * 60 + now.getMinutes();
            const IS_AT_REAL_TIME = Math.abs(val - nowTotal) <= 1; // 2-min tolerance for snap/feel

            if (IS_AT_REAL_TIME) {
                if (!this.industrialHandle.classList.contains('at-real-time')) {
                    this.industrialHandle.classList.add('at-real-time');
                    // Vibrate 15ms exactly once per transition to real-time
                    if (navigator.vibrate) navigator.vibrate(15);
                }
            } else {
                this.industrialHandle.classList.remove('at-real-time');
            }
        }

        // Common components for content (Supporting both new tablo and legacy preview)
        const previewTime = document.getElementById('preview-time') || document.getElementById('tablo-real-time');
        const previewMsg = document.getElementById('preview-msg') || document.getElementById('tablo-status-msg');
        const previewUntil = document.getElementById('preview-until') || document.getElementById('tablo-status-until');

        const now = new Date();
        const nowTotal = now.getHours() * 60 + now.getMinutes();
        const isPast = val < nowTotal && !this.isTomorrowView; // Перевіряємо чи ми в минулому (окрім сторінки Завтра)

        // Керування видимістю правого табло (ДО...)
        const untilContainer = document.querySelector('.until-clock-display');
        if (untilContainer) {
            if (isPast) untilContainer.classList.add('is-hidden');
            else untilContainer.classList.remove('is-hidden');
        }

        const timeString = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

        if (previewTime) {
            previewTime.textContent = timeString;
            
            // Apply neon glow if this is the real-time tablo AND we are in real-time mode
            if (previewTime.id === 'tablo-real-time') {
                const dateSquares = document.querySelectorAll('.date-square');
                if (!this.scrubberInteracted) {
                    previewTime.classList.add('neon-glow-time');
                    dateSquares.forEach(sq => sq.classList.add('neon-glow-date'));
                } else {
                    previewTime.classList.remove('neon-glow-time');
                    dateSquares.forEach(sq => sq.classList.remove('neon-glow-date'));
                }
            }
        }

        // NEW: Sync Top Tech Clock
        const techClockEl = document.getElementById('tech-clock-display');
        if (techClockEl && this.scrubberInteracted) {
            window.isTimelineScrubbing = true;
            // Display HH:MM without seconds during scrubbing
            techClockEl.innerHTML = `${h.toString().padStart(2, '0')}<span class="separator">:</span>${m.toString().padStart(2, '0')}<span class="seconds"></span>`;
        }

        if (previewMsg) {
            if (previewMsg.id === 'tablo-status-msg') {
                const iconSrc = !isOff ? 'assets/dashboard_on.svg' : 'assets/dashboard_off.svg';
                const altText = !isOff ? 'СВІТЛО Є' : 'СВІТЛА НЕМАЄ';
                previewMsg.innerHTML = `<img src="${iconSrc}" alt="${altText}" class="tablo-status-icon">`;
            } else {
                previewMsg.textContent = isOff ? 'СВІТЛА НЕМАЄ' : 'СВІТЛО Є';
            }
        }

        // Логіка "ДО"
        const techStatusText = document.getElementById('tech-status-text');
        const techStatusIcon = document.getElementById('tech-status-icon');
        
        if (previewUntil) {
            const nextTransition = this.getNextTransitionTime(h, m);
            if (nextTransition) {
                if (previewUntil.id === 'tablo-status-until') {
                    // Нове Табло: "ДО" окремо від цифр
                    const label = document.getElementById('tablo-status-label');
                    if (label) label.textContent = 'ДО';
                    previewUntil.textContent = nextTransition;
                } else {
                    // Класичне прев'ю (наприклад, на сторінці Завтра)
                    previewUntil.textContent = `ДО ${nextTransition}`;
                }
                
                // Update new Tech Status Card
                if (techStatusText) techStatusText.textContent = `- до ${nextTransition}`;
                
                previewUntil.style.display = 'block';
            } else {
                previewUntil.textContent = "—";
                if (techStatusText) techStatusText.textContent = "—";
            }
        }
        
        if (techStatusIcon) {
            techStatusIcon.src = !isOff ? 'assets/dashboard_on.svg' : 'assets/dashboard_off.svg';
        }

        // Оновлюємо стани контейнерів (Табло або Прев'ю)
        this.updateTabloState(isOff);

        // Оновлюємо колір повзунка (тільки для Home, де є CSS змінні)
        const scrubberColor = isOff ? '#8E8E93' : '#FF9500';
        this.scrubber.style.setProperty('--scrubber-color', scrubberColor);

        // Візуальний відгук на шкалі (hour-blocks)
        if (this.scrubberInteracted && this.rail) {
            Array.from(this.rail.children).forEach(child => {
                if (child.classList.contains('hour-block')) {
                    if (parseInt(child.dataset.hour) === h) {
                        child.classList.add('active-block');
                    } else {
                        child.classList.remove('active-block');
                    }
                }
            });
        }
    }

    updateTabloState(isOff) {
        const tablo = document.getElementById('dashboard-tablo');
        const legacyPreview = document.getElementById('scrubber-preview');
        const foundation = document.getElementById('bottom-foundation');

        // New Tech UI Layer (Clock, Date, Status)
        const techCards = document.querySelectorAll('.date-card, .clock-card, .status-card');
        techCards.forEach(card => {
            if (isOff) {
                // SSSK State: Off (Gray BG) -> Tech UI: Light (High contrast on dark)
                card.classList.add('light');
                card.classList.remove('dark');
            } else {
                // SSSK State: On (Orange BG) -> Tech UI: Dark (High contrast on bright)
                card.classList.add('dark');
                card.classList.remove('light');
            }
        });

        // Dashboard (Old) and Foundation
        if (tablo) {
            if (isOff) {
                tablo.classList.remove('tablo-on');
                tablo.classList.add('tablo-off');
                if (foundation) {
                    foundation.classList.remove('tablo-on');
                    foundation.classList.add('tablo-off');
                }
            } else {
                tablo.classList.remove('tablo-off');
                tablo.classList.add('tablo-on');
                if (foundation) {
                    foundation.classList.remove('tablo-off');
                    foundation.classList.add('tablo-on');
                }
            }
        }

        // Legacy Preview (Tomorrow Page)
        if (legacyPreview) {
            if (isOff) {
                legacyPreview.classList.remove('preview-on');
                legacyPreview.classList.add('preview-off');
            } else {
                legacyPreview.classList.remove('preview-off');
                legacyPreview.classList.add('preview-on');
            }
        }
    }

    getNextTransitionTime(hour, min) {
        // Проста логіка пошуку першої зміни стану після поточного часу
        const currentIsOff = this.checkIsOffAtHour(hour);
        for (let h = hour + 1; h < 24; h++) {
            if (this.checkIsOffAtHour(h) !== currentIsOff) {
                return `${h}:00`;
            }
        }
        return "00:00"; 
    }
}

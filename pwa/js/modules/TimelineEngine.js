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
        this.preview = document.getElementById('scrubber-preview');
        
        this.scrubberInteracted = false;
        this.updateInterval = null;
        this.demoMode = config.demoMode || false;
        this.isAllClearDay = config.isAllClearDay || false;
        this.isTomorrowView = document.body.classList.contains('page-tomorrow');
    }

    init() {
        if (!this.scrubber) return;

        this.scrubber.max = 287;
        // Лінеаризація нативного повзунка: робимо так, щоб центр повзунка ідеально співпадав із відсотками (напр. 66.66%)
        this.scrubber.style.width = 'calc(100% + 20px)';
        this.scrubber.style.marginLeft = '-10px';

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
                 this.updateToCurrentTime();
                 this.clearActiveBlocks();
             }, 30000); 
        });

        this.renderTimeline();
        this.updateToCurrentTime();
        this.startAutoUpdate();
    }

    startAutoUpdate() {
        if (this.updateInterval) clearInterval(this.updateInterval);
        this.updateInterval = setInterval(() => {
            if (!this.scrubberInteracted) {
                // Відновлюємо затінення для поточного часу щохвилини
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

        // Use the actual schedule string data if available instead of math formula
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
        this.rail.style.gap = '0'; // Забираємо gap, щоб кожен блок займав рівно 1/24 ширини без зсувів
        this.rail.style.height = '55px'; // Дводоріжковий таймлайн
        this.rail.style.borderRadius = '0';
        
        let transitions = []; 
        const currentHour = new Date().getHours();

        for (let h = 0; h < 24; h++) {
            const isOff = this.checkIsOffAtHour(h);
            const block = document.createElement('div');
            block.className = 'hour-block';
            block.dataset.hour = h;
            
            // Фіксуємо години зміни стану (для бейджів та сходинок)
            if (h > 0) {
                const prevIsOff = this.checkIsOffAtHour(h - 1);
                if (isOff !== prevIsOff) {
                    transitions.push({ hour: h, type: isOff ? 'off' : 'on' });
                }
            }

            // Затінення графіка минулого часу (застосовується до всієї колонки)
            if (!this.isTomorrowView && h < currentHour && !this.isAllClearDay) {
                block.classList.add('past');
            }

            // Рендер верхньої та нижньої доріжок
            const topTrack = document.createElement('div');
            topTrack.className = 'top-track';
            topTrack.style.width = 'calc(100% - 2px)'; // Візуальний зазор

            const bottomTrack = document.createElement('div');
            bottomTrack.className = 'bottom-track';
            bottomTrack.style.width = 'calc(100% - 2px)'; // Візуальний зазор

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

        // 2. Дрібні зарубки для кожної години
        this.ticksContainer.innerHTML = '';
        for (let h = 0; h <= 24; h++) {
            const notch = document.createElement('div');
            notch.className = 'tick-notch';
            notch.style.left = `${(h / 24) * 100}%`;
            this.ticksContainer.appendChild(notch);
        }

        // 3. Текстові позначки та бейджі
        const labelIntervals = [0, 3, 6, 9, 12, 15, 18, 21, 24];
        const transitionHours = transitions.map(t => t.hour);

        // А. Стандартні інтервали (глухі)
        labelIntervals.forEach(h => {
            if (transitionHours.includes(h)) return; // Пропускаємо, якщо тут є бейдж

            const tick = document.createElement('div');
            tick.className = 'tick hour-mark';
            tick.style.background = 'transparent'; 
            
            tick.innerHTML = `<span class="tick-label">${h}:00</span>`;
            tick.style.left = `${(h / 24) * 100}%`;
            
            if (h === 0) tick.querySelector('.tick-label').style.transform = 'translate(0, -50%)';
            if (h === 24) tick.querySelector('.tick-label').style.transform = 'translate(-100%, -50%)';

            this.ticksContainer.appendChild(tick);
        });

        // Б. Семантичні бейджі переходів та сходинки
        transitions.forEach(t => {
            const h = t.hour;
            
            // Сходинка (вертикальна лінія)
            const step = document.createElement('div');
            step.className = `transition-step step-${t.type}`;
            step.style.left = `${(h / 24) * 100}%`;
            this.ticksContainer.appendChild(step);

            // Бейдж
            const badgeContainer = document.createElement('div');
            badgeContainer.className = 'tick hour-mark';
            badgeContainer.style.background = 'transparent';
            
            badgeContainer.innerHTML = `<span class="transition-badge badge-${t.type}">${h}:00</span>`;
            badgeContainer.style.left = `${(h / 24) * 100}%`;
            
            this.ticksContainer.appendChild(badgeContainer);
        });

        // 4. Додаємо неонову вертикальну лінію поточного часу
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

        // Оновлюємо лінію "Зараз"
        if (this.nowLine) {
            this.nowLine.style.left = `${(totalMins / 1440) * 100}%`;
        }

        this.scrubber.value = Math.floor(totalMins / 5);
        this.updateScrubberPreview();
    }

    updateScrubberPreview() {
        if (!this.scrubber || !this.preview) return;

        const val = parseInt(this.scrubber.value);
        const totalMins = val * 5;
        const h = Math.floor(totalMins / 60);
        const m = Math.floor(totalMins % 60);
        const timeStr = `${h}:${m.toString().padStart(2, '0')}`;

        const isOff = this.checkIsOffAtHour(h);

        this.preview.classList.remove('preview-on', 'preview-off');
        this.preview.classList.add(isOff ? 'preview-off' : 'preview-on');

        const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor" style="width:100%; height:100%;"><path d="M292.9 384c7.3-22.3 21.9-42.5 38.4-59.9 32.7-34.4 52.7-80.9 52.7-132.1 0-106-86-192-192-192S0 86 0 192c0 51.2 20 97.7 52.7 132.1 16.5 17.4 31.2 37.6 38.4 59.9l201.7 0zM288 432l-192 0 0 16c0 44.2 35.8 80 80 80l32 0c44.2 0 80-35.8 80-80l0-16zM184 112c-39.8 0-72 32.2-72 72 0 13.3-10.7 24-24 24s-24-10.7-24-24c0-66.3 53.7-120 120-120 13.3 0 24 10.7 24 24s-10.7 24-24 24z"/></svg>`;

        this.preview.innerHTML = `
            <div class="preview-status-icon">${svgIcon}</div>
            <div class="preview-details">
                <div class="preview-time">${timeStr}</div>
                <div class="preview-msg">${isOff ? 'Світла немає' : 'Світло є'}</div>
            </div>
        `;

        // Магнетизм / Підсвітка активного блоку при скрубінгу
        if (this.scrubberInteracted) {
            Array.from(this.rail.children).forEach(child => {
                if (child.classList.contains('hour-block')) {
                    if (parseInt(child.dataset.hour) === h) {
                        child.classList.add('active-block');
                        child.style.transform = 'scale(1.15) translateY(-3px)';
                        child.style.zIndex = '15';
                        child.style.boxShadow = '0 6px 16px rgba(0,0,0,0.4)';
                        child.style.filter = 'brightness(1.3)';
                    } else {
                        child.classList.remove('active-block');
                        child.style.transform = 'scale(1) translateY(0)';
                        child.style.zIndex = '1';
                        child.style.boxShadow = '';
                        // Зберігаємо затінення для минулого
                        if (child.classList.contains('past')) {
                            // no inline filter needed as it's handled by !important in CSS
                        } else {
                            child.style.filter = 'none';
                        }
                    }
                }
            });
        }
    }
}

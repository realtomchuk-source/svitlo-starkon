/**
 * TomorrowController.js
 * Автономний контролер для дашборду сторінки "Завтра".
 * Керує годинником та розраховує статус "прогнозу" на основі завтрашнього графіка.
 */

export class TomorrowController {
    constructor() {
        this.statusBlock = document.getElementById('tomorrow-tablo');
        this.heroBlock = document.getElementById('smart-hero');
        this.selector = null; // Буде встановлено через setSelector
        
        this.statusIcon = document.getElementById('capsule-status-icon');
        this.statusText = document.getElementById('capsule-status-text');
        this.clockDisplay = document.getElementById('capsule-clock-display');
        
        this.timer = null;
    }

    /**
     * Ініціалізація контролера
     * @param {Object} tomorrowData - Дані з tomorrow-db.json
     */
    init(tomorrowData) {
        this.data = tomorrowData;
        console.log('Tomorrow Controller: Initializing at 00:00');
        
        // Встановлюємо початковий стан на 00:00 (як для сторінки завтра)
        this.updateFromTimeline(0);
    }

    setSelector(selectorInstance) {
        this.selector = selectorInstance;
        this.updateStatus(); // Оновити статус з урахуванням селектора
    }


    /**
     * Розрахунок статусу "Прогноз на завтра"
     * @param {number} forcedHour - Опційно: година, для якої треба вирахувати статус (для скраббінгу)
     */
    updateStatus(forcedHour = null) {
        if (!this.data || !this.data.queues) return;

        const now = new Date();
        const currentHour = forcedHour !== null ? forcedHour : now.getHours();
        const activeGroup = this.data.activeGroup || "1.1";
        const schedule = this.data.queues[activeGroup];

        if (!schedule) return;

        // Логіка: беремо біт для поточної години з завтрашнього розкладу
        const isOn = schedule[currentHour] === '1';
        
        // Оновлюємо UI (Колір Дашборду та Героя)
        if (this.statusBlock) {
            this.statusBlock.classList.toggle('status-on', isOn);
            this.statusBlock.classList.toggle('status-off', !isOn);
        }

        if (this.heroBlock) {
            this.heroBlock.classList.toggle('status-on', isOn);
            this.heroBlock.classList.toggle('status-off', !isOn);
        }

        // Оновлення теми селектора (синхронно з табло)
        if (this.selector) {
            this.selector.updateTheme(isOn ? 'dark' : 'light');
        }

        if (this.statusIcon) {
            this.statusIcon.src = isOn ? 'assets/dashboard_on.svg' : 'assets/dashboard_off.svg';
        }

        if (this.statusText) {
            // Шукаємо найближчу зміну статусу
            let nextChangeHour = -1;
            for (let i = currentHour + 1; i < 24; i++) {
                if (schedule[i] !== schedule[currentHour]) {
                    nextChangeHour = i;
                    break;
                }
            }

            if (nextChangeHour !== -1) {
                const timeStr = nextChangeHour.toString().padStart(2, '0') + ':00';
                this.statusText.innerHTML = `до&thinsp;${timeStr}`;
            } else {
                this.statusText.innerHTML = `до&thinsp;00:00`;
            }
        }
    }

    /**
     * Виклик з таймлайну при скраббінгу
     */
    updateFromTimeline(mins) {
        const h = Math.floor(mins / 60);
        const m = (mins % 60).toString().padStart(2, '0');
        
        // Оновлюємо годинник на "віртуальний" час скраббінгу (без секунд)
        if (this.clockDisplay) {
            this.clockDisplay.innerHTML = `${h.toString().padStart(2, '0')}<span class="separator">:</span>${m}<span class="seconds">00</span>`;
        }

        // Оновлюємо статус для цієї години
        this.updateStatus(h);
    }


    destroy() {
        if (this.timer) clearInterval(this.timer);
    }
}

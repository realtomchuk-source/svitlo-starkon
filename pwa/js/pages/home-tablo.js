/**
 * Home Tablo Controller (Autonomous)
 * Handles the logic for the new unified Dashboard Tablo on the Home page.
 */

const MONTHS = ['СІЧНЯ','ЛЮТОГО','БЕРЕЗНЯ','КВІТНЯ','ТРАВНЯ','ЧЕРВНЯ','ЛИПНЯ','СЕРПНЯ','ВЕРЕСНЯ','ЖОВТНЯ','ЛИСТОПАДА','ГРУДНЯ'];
const WEEKDAYS = ['НЕДІЛЯ','ПОНЕДІЛОК','ВІВТОРОК','СЕРЕДА','ЧЕТВЕР','П’ЯТНИЦЯ','СУБОТА'];

/**
 * Updates the Dashboard Tablo with current or preview state data.
 * @param {Date} now - The date object to display.
 * @param {boolean} isCurrentlyOn - Light status.
 * @param {number|string} nextChangeHour - The hour of the next status change.
 */
export function updateDashboardTablo(now, isCurrentlyOn, nextChangeHour) {
    const block = document.getElementById('dynamic-info-block');
    if (block) {
        block.classList.remove('status-on', 'status-off');
        block.classList.add(isCurrentlyOn ? 'status-on' : 'status-off');
        
        // Also update the main capsule container for easier CSS targets
        const dashContainer = block.querySelector('.hero-timeline-capsule');
        if (dashContainer) {
            dashContainer.classList.remove('status-on', 'status-off');
            dashContainer.classList.add(isCurrentlyOn ? 'status-on' : 'status-off');
        }
    }

    // 1. Interactive Handlers (Clock & Status)
    const clockSeg = document.getElementById('dash-segment-clock');
    const statusSeg = document.getElementById('dash-segment-status');

    if (clockSeg && !clockSeg.onclick) {
        clockSeg.onclick = () => {
            const overlay = document.getElementById('home-queue-picker-overlay');
            if (overlay) overlay.classList.add('active');
        };
    }

    if (statusSeg && !statusSeg.onclick) {
        statusSeg.onclick = () => {
            const legend = document.getElementById('legend-overlay');
            if (legend) legend.classList.add('active');
        };
    }

    // 2. Update New Tablo Capsules (Date, Clock, Status)
    
    // 2.1 Date Segment
    const capDateMain = document.getElementById('capsule-date-main');
    const capDateDay = document.getElementById('capsule-date-day');
    if (capDateMain) {
        const d = now.getDate().toString().padStart(2, '0');
        const m = (now.getMonth() + 1).toString().padStart(2, '0');
        const yShort = now.getFullYear().toString().slice(-2);
        capDateMain.textContent = `${d}.${m}.${yShort}`;
    }
    if (capDateDay) {
        const weekdays = ['НЕДІЛЯ','ПОНЕДІЛОК','ВІВТОРОК','СЕРЕДА','ЧЕТВЕР','П’ЯТНИЦЯ','СУБОТА'];
        const weekdaysShort = ['НД','ПН','ВТ','СР','ЧТ','ПТ','СБ'];
        capDateDay.textContent = weekdaysShort[now.getDay()];
    }

    // 2.2 Status Segment
    const capStatusText = document.getElementById('capsule-status-text');
    const capStatusContainer = document.getElementById('capsule-status-container');
    
    if (capStatusText) {
        if (nextChangeHour === 24) {
             capStatusText.textContent = "до 24:00";
        } else {
             capStatusText.textContent = `до ${nextChangeHour}:00`;
        }
    }

    if (capStatusContainer) {
        const statusColor = isCurrentlyOn ? '#ee7221' : '#64748b';
        
        // Solid Premium Bulb Icons (Digitized from Screenshot)
        const bulbOn = `
            <svg viewBox="0 0 24 24" class="dash-status-svg">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7z" fill="${statusColor}"/>
                <path d="M9 19h6v1a1 1 0 01-1 1h-4a1 1 0 01-1-1v-1z" fill="${statusColor}" opacity="0.8"/>
                <circle cx="12" cy="9" r="4.5" fill="black" opacity="0.4"/>
                <path d="M12 6.5v5M9.5 9h5" stroke="white" stroke-width="2" stroke-linecap="round"/>
            </svg>`;

        const bulbOff = `
            <svg viewBox="0 0 24 24" class="dash-status-svg">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7z" fill="${statusColor}"/>
                <path d="M9 19h6v1a1 1 0 01-1 1h-4a1 1 0 01-1-1v-1z" fill="${statusColor}" opacity="0.8"/>
                <circle cx="12" cy="9" r="4.5" fill="black" opacity="0.4"/>
                <path d="M9.5 9h5" stroke="white" stroke-width="2" stroke-linecap="round"/>
            </svg>`;
            
        capStatusContainer.innerHTML = isCurrentlyOn ? bulbOn : bulbOff;
    }

    // 2.3 Clock Segment
    const realTime = document.getElementById('tablo-real-time');
    const realSec = document.getElementById('tablo-real-sec');
    if (realTime) {
        const h = now.getHours().toString().padStart(2, '0');
        const m = now.getMinutes().toString().padStart(2, '0');
        realTime.textContent = `${h}:${m}`;
    }
    if (realSec) {
        realSec.textContent = now.getSeconds().toString().padStart(2, '0');
    }
}

/**
 * Initial setup for the tablo if needed (e.g. event listeners)
 */
export function initHomeTablo() {
    console.log('Home Tablo Controller Initialized');
}

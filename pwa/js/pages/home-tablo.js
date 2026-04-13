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
        
        // Custom Vector Bulb Icons (Directly from User)
        const bulbOn = `
            <svg viewBox="0 0 358.9 495.1" class="dash-status-svg">
                <path fill="${statusColor}" d="M269.45,420.1c0,41.44-33.56,75-75,75h-30c-41.44,0-75-33.56-75-75v-15h180v15Z"/>
                <path fill="${statusColor}" d="M179.45.1C24.98-5.24-59.54,197.44,48.86,303.95c15.46,16.31,29.24,35.25,35.99,56.15h189.19c6.84-20.91,20.53-39.84,36-56.16C418.46,197.45,333.89-5.27,179.45.1ZM179.45,305.69c-67.65,0-122.5-54.85-122.5-122.5s54.85-122.5,122.5-122.5,122.5,54.85,122.5,122.5-54.85,122.5-122.5,122.5Z"/>
                <path fill="${statusColor}" d="M234.02,169.58h-40.83v-40.83c0-7.49-6.12-13.61-13.61-13.61s-13.61,6.12-13.61,13.61v40.83h-40.83c-7.49,0-13.61,6.12-13.61,13.61s6.12,13.61,13.61,13.61h40.83v40.83c0,7.49,6.12,13.61,13.61,13.61s13.61-6.12,13.61-13.61v-40.83h40.83c7.49,0,13.61-6.12,13.61-13.61s-6.12-13.61-13.61-13.61Z"/>
            </svg>`;

        const bulbOff = `
            <svg viewBox="0 0 358.9 495.1" class="dash-status-svg">
                <path fill="${statusColor}" d="M269.45,405.1H89.45v15c0,41.44,33.56,75,75,75h30c41.44,0,75-33.56,75-75v-15Z"/>
                <path fill="${statusColor}" d="M247.51,183.21c0,7.49-6.12,13.61-13.61,13.61h-108.89c-7.49,0-13.61-6.12-13.61-13.61s6.12-13.61,13.61-13.61h108.89c7.49,0,13.61,6.12,13.61,13.61Z"/>
                <path fill="${statusColor}" d="M179.45.1C24.98-5.24-59.54,197.44,48.86,303.95c15.46,16.31,29.24,35.25,35.99,56.15h189.19c6.84-20.91,20.53-39.84,36-56.16C418.46,197.45,333.89-5.27,179.45.1ZM179.45,305.71c-67.65,0-122.5-54.85-122.5-122.5s54.85-122.5,122.5-122.5,122.5,54.85,122.5,122.5-54.85,122.5-122.5,122.5Z"/>
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

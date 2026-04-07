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
        block.classList.remove('tablo-on', 'tablo-off');
        block.classList.add(isCurrentlyOn ? 'tablo-on' : 'tablo-off');
    }

    // 1. Sync Theme for Dashboard Components
    const techCards = document.querySelectorAll('.date-card, .clock-card, .status-card');
    techCards.forEach(card => {
        if (isCurrentlyOn) {
            card.classList.add('dark'); card.classList.remove('light');
        } else {
            card.classList.add('light'); card.classList.remove('dark');
        }
    });

    // 1.2 Sync Selector theme
    const selectorEl = document.getElementById('subqueue-selector');
    if (selectorEl) {
        if (isCurrentlyOn) {
            selectorEl.classList.add('dark'); selectorEl.classList.remove('light');
        } else {
            selectorEl.classList.add('light'); selectorEl.classList.remove('dark');
        }
    }

    // 2. Update New Tablo Capsules (Date, Clock, Status)
    
    // 2.1 Date Capsule
    const capDateMain = document.getElementById('capsule-date-main');
    const capDateDay = document.getElementById('capsule-date-day');
    if (capDateMain) {
        const d = now.getDate().toString().padStart(2, '0');
        const m = (now.getMonth() + 1).toString().padStart(2, '0');
        const y = now.getFullYear();
        capDateMain.textContent = `${d}.${m}.${y}`;
    }
    if (capDateDay) {
        const weekdays = ['НД','ПН','ВТ','СР','ЧТ','ПТ','СБ'];
        capDateDay.textContent = weekdays[now.getDay()];
    }

    // 2.2 Status Capsule
    const statusMsg = document.getElementById('tablo-status-msg');
    if (statusMsg) {
        const iconSrc = isCurrentlyOn ? 'assets/dashboard_on.svg' : 'assets/dashboard_off.svg';
        const altText = isCurrentlyOn ? 'СВІТЛО Є' : 'СВІТЛА НЕМАЄ';
        statusMsg.innerHTML = `<img src="${iconSrc}" alt="${altText}" class="tablo-status-icon">`;
    }

    // 2.3 Clock Capsule (Handled by tech-ui.js, but synced here if needed)
    const realTime = document.getElementById('tablo-real-time');
    if (realTime) {
        const h = now.getHours().toString().padStart(2, '0');
        const m = now.getMinutes().toString().padStart(2, '0');
        realTime.textContent = `${h}:${m}`;
    }
}

/**
 * Initial setup for the tablo if needed (e.g. event listeners)
 */
export function initHomeTablo() {
    console.log('Home Tablo Controller Initialized');
}

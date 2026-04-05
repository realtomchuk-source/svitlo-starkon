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
    const tablo = document.getElementById('dashboard-tablo');
    
    // 1. Update status class (colors) for Tablo and new Foundation
    if (tablo) {
        tablo.classList.remove('tablo-on', 'tablo-off');
        tablo.classList.add(isCurrentlyOn ? 'tablo-on' : 'tablo-off');
    }

    const foundation = document.getElementById('bottom-foundation');
    if (foundation) {
        foundation.classList.remove('tablo-on', 'tablo-off');
        foundation.classList.add(isCurrentlyOn ? 'tablo-on' : 'tablo-off');
    }
    
    // 1.1 Sync Global Body Background (for the bottom cushion)
    document.body.classList.remove('tablo-on', 'tablo-off');
    document.body.classList.add(isCurrentlyOn ? 'tablo-on' : 'tablo-off');

    // 1.1 Sync New Tech UI theme (instant)
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

    // 2. Update Date & Time elements
    const elements = {
        sqD: document.getElementById('date-sq-d'),
        sqM: document.getElementById('date-sq-m'),
        sqY: document.getElementById('date-sq-y'),
        realTime: document.getElementById('tablo-real-time'),
        statusMsg: document.getElementById('tablo-status-msg'),
        statusUntil: document.getElementById('tablo-status-until')
    };

    if (elements.sqD && elements.sqM && elements.sqY) {
        const d = now.getDate().toString().padStart(2, '0');
        const m = (now.getMonth() + 1).toString().padStart(2, '0');
        const y = now.getFullYear();
        
        elements.sqD.textContent = d;
        elements.sqM.textContent = m;
        elements.sqY.textContent = y;
    }
    
    if (elements.realTime) {
        const h = now.getHours().toString().padStart(2, '0');
        const m = now.getMinutes().toString().padStart(2, '0');
        elements.realTime.textContent = `${h}:${m}`;
    }

    // 2.1 Update New Tech Date display
    const techDateMain = document.getElementById('tech-date-main');
    const techDateDay = document.getElementById('tech-date-day');
    if (techDateMain) {
        const d = now.getDate().toString().padStart(2, '0');
        const m = (now.getMonth() + 1).toString().padStart(2, '0');
        const y = now.getFullYear();
        techDateMain.textContent = `${d}.${m}.${y}`;
    }
    if (techDateDay) {
        const weekdays = ['НД','ПН','ВТ','СР','ЧТ','ПТ','СБ'];
        techDateDay.textContent = weekdays[now.getDay()];
    }

    if (elements.statusMsg) {
        const iconSrc = isCurrentlyOn ? 'assets/dashboard_on.svg' : 'assets/dashboard_off.svg';
        const altText = isCurrentlyOn ? 'СВІТЛО Є' : 'СВІТЛА НЕМАЄ';
        elements.statusMsg.innerHTML = `<img src="${iconSrc}" alt="${altText}" class="tablo-status-icon">`;
    }

    const nextTime = typeof nextChangeHour === 'number' ? `${nextChangeHour}:00` : nextChangeHour;

    // 3. Update Legacy Status elements (if they exist)
    if (elements.statusUntil) {
        const labelEl = document.getElementById('tablo-status-label');
        if (labelEl) labelEl.textContent = 'ДО';
        elements.statusUntil.textContent = nextTime;
    }

    // 4. Update New Tech Status Card (Independent)
    const techStatusText = document.getElementById('tech-status-text');
    const techStatusIcon = document.getElementById('tech-status-icon');
    
    if (techStatusText) {
        techStatusText.textContent = `до\u2009${nextChangeHour}:00`;
    }
    
    if (techStatusIcon) {
        const newStatus = isCurrentlyOn ? 'on' : 'off';
        const lastStatus = techStatusIcon.dataset.status;
        
        if (lastStatus !== newStatus) {
            const iconSrc = isCurrentlyOn ? 'assets/dashboard_on.svg' : 'assets/dashboard_off.svg';
            techStatusIcon.src = iconSrc;
            techStatusIcon.dataset.status = newStatus;
        }
    }
}

/**
 * Initial setup for the tablo if needed (e.g. event listeners)
 */
export function initHomeTablo() {
    console.log('Home Tablo Controller Initialized');
}

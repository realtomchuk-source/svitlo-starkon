// State Cache for Atomic Updates (Progressive Rendering)
let lastDateStr = '';
let lastDayStr = '';
let lastTimeStr = '';
let lastStatusOn = null;
let lastNextHour = null;

/**
 * Updates the Dashboard Tablo with current or preview state data.
 * Optimized with atomic updates to prevent unnecessary DOM redraws.
 */
export function updateDashboardTablo(now = new Date(), isCurrentlyOn = true, nextChangeHour = 0) {
    if (!now || !(now instanceof Date)) now = new Date();
    // Export to global for reliability
    window.updateDashboardTablo = updateDashboardTablo;
    
    // 1. Update Container Status (Theme Toggle)
    if (isCurrentlyOn !== lastStatusOn) {
        const block = document.getElementById('dynamic-info-block');
        if (block) {
            block.classList.remove('status-on', 'status-off');
            block.classList.add(isCurrentlyOn ? 'status-on' : 'status-off');
        }
        
        lastStatusOn = isCurrentlyOn;
    }

    // 2. Click Handlers (Safe registration)
    const clockSeg = document.getElementById('dash-segment-clock');
    
    if (clockSeg && !clockSeg._hasListener) {
        clockSeg.addEventListener('click', () => {
            const overlay = document.getElementById('home-queue-picker-overlay');
            if (overlay) overlay.classList.add('active');
        });
        clockSeg._hasListener = true;
        clockSeg.style.cursor = 'pointer';
    }

    // 3. Atomic Data Updates
    
    // 3.1 Date (Update only if Day changes)
    const currentDateStr = `${now.getDate()}.${now.getMonth()}.${now.getFullYear()}`;
    if (currentDateStr !== lastDateStr) {
        const capDateMain = document.getElementById('capsule-date-main');
        if (capDateMain) {
            const d = now.getDate().toString().padStart(2, '0');
            const m = (now.getMonth() + 1).toString().padStart(2, '0');
            const yShort = now.getFullYear().toString().slice(-2);
            capDateMain.textContent = `${d}.${m}.${yShort}`;
        }
        
        const capDateDay = document.getElementById('capsule-date-day');
        if (capDateDay) {
            const weekdaysShort = ['НД','ПН','ВТ','СР','ЧТ','ПТ','СБ'];
            capDateDay.textContent = weekdaysShort[now.getDay()];
        }
        lastDateStr = currentDateStr;
    }

    // 3.2 Status Time (Logical state only, UI removed from center)
    if (nextChangeHour !== lastNextHour) {
        lastNextHour = nextChangeHour;
    }

    // 3.3 Clock (Update HH:MM only if Minute changes)
    const h = now.getHours().toString().padStart(2, '0');
    const m = now.getMinutes().toString().padStart(2, '0');
    const currentTimeStr = `${h}:${m}`;
    
    if (currentTimeStr !== lastTimeStr) {
        const realTime = document.getElementById('tablo-real-time');
        if (realTime) {
            realTime.textContent = currentTimeStr;
        }
        lastTimeStr = currentTimeStr;
    }

    // 3.4 Seconds (Update every second)
    const realSec = document.getElementById('tablo-real-sec');
    if (realSec) {
        const s = now.getSeconds().toString().padStart(2, '0');
        if (realSec.textContent !== s) {
            realSec.textContent = s;
        }
    }
}

export function initHomeTablo() {
    console.log('Home Tablo Optimized Controller Initialized');
}


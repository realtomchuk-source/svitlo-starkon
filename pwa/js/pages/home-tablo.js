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
export function updateDashboardTablo(now, isCurrentlyOn, nextChangeHour) {
    // Export to global for reliability
    window.updateDashboardTablo = updateDashboardTablo;
    
    // 1. Update Container Status (Theme Toggle)
    if (isCurrentlyOn !== lastStatusOn) {
        const block = document.getElementById('dynamic-info-block');
        if (block) {
            block.classList.remove('status-on', 'status-off');
            block.classList.add(isCurrentlyOn ? 'status-on' : 'status-off');
        }
        
        // Update Icon (Only on status change)
        const capStatusContainer = document.getElementById('capsule-status-container');
        if (capStatusContainer) {
            const iconUrl = isCurrentlyOn ? 'assets/status_on.svg' : 'assets/status_off.svg';
            capStatusContainer.innerHTML = `<img src="${iconUrl}" class="dash-status-icon">`;
        }
        
        lastStatusOn = isCurrentlyOn;
    }

    // 2. Click Handlers (Once)
    const clockSeg = document.getElementById('dash-segment-clock');
    const statusSeg = document.getElementById('dash-segment-status');
    if (clockSeg && !clockSeg.onclick) {
        clockSeg.onclick = () => document.getElementById('home-queue-picker-overlay')?.classList.add('active');
    }
    if (statusSeg && !statusSeg.onclick) {
        statusSeg.onclick = () => document.getElementById('legend-overlay')?.classList.add('active');
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

    // 3.2 Status Time (Update only if Change Hour changes)
    if (nextChangeHour !== lastNextHour) {
        const capStatusText = document.getElementById('capsule-status-text');
        if (capStatusText) {
            capStatusText.textContent = nextChangeHour === 24 ? "до 24:00" : `до ${nextChangeHour}:00`;
        }
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


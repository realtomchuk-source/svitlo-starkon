/**
 * Tech UI - Inline Tech (Discreet Industrial)
 * Single-line Date (CP 14.03.2026) | Clock (HH:MM:SS)
 */

document.addEventListener('DOMContentLoaded', () => {
    initTechUI();
});

function initTechUI() {
    updateTechUI();
    // High precision update at 1s for clock
    setInterval(updateTechUI, 1000);
}

function updateTechUI() {
    // 0. Skip update if user is interacting with timeline
    if (window.isTimelineScrubbing) return;

    const now = new Date();
    
    // 1. Clock Logic (HH:MM:SS)
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');

    const clockContent = `${hh}<span class="separator">:</span>${mm}<span class="seconds">${ss}</span>`;
    
    // Update NEW Capsule Clock
    const capsuleClockEl = document.getElementById('capsule-clock-display');
    if (capsuleClockEl) capsuleClockEl.innerHTML = clockContent;

    // 2. Date Logic (СР 14.03.2026)
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const dateStr = `${day}.${month}.${year}`;

    // Update NEW Capsule Date
    const capDateMain = document.getElementById('capsule-date-main');
    const capDateDay = document.getElementById('capsule-date-day');
    if (capDateMain) capDateMain.textContent = dateStr;

    // Short Day Name (Colored via CSS)
    const weekdaysShort = ['НД', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];
    const currentDayName = weekdaysShort[now.getDay()];
    if (capDateDay) capDateDay.textContent = currentDayName;
}

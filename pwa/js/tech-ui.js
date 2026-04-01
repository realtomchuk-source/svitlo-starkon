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
    const clockEl = document.getElementById('tech-clock-display');
    const dateMainEl = document.getElementById('tech-date-main');
    const dateDayEl = document.getElementById('tech-date-day');

    if (!clockEl || !dateMainEl || !dateDayEl) return;

    // 0. Skip update if user is interacting with timeline
    if (window.isTimelineScrubbing) return;

    const now = new Date();
    
    // 1. Clock Logic (HH:MM:SS)
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');

    // SS same size but pale via CSS opacity
    clockEl.innerHTML = `${hh}<span class="separator">:</span>${mm}<span class="seconds">${ss}</span>`;

    // 2. Date Logic (СР 14.03.2026)
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    
    // Full date string with dots
    dateMainEl.textContent = `${day}.${month}.${year}`;

    // Short Day Name (Colored via CSS)
    const weekdaysShort = ['НД', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];
    dateDayEl.textContent = weekdaysShort[now.getDay()];
}

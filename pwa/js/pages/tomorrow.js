/**
 * tomorrow.js
 * Контролер для сторінки tomorrow.html ("Завтра").
 */

import { fetchScheduleData } from '../modules/api.js';
import { TimelineEngine } from '../modules/TimelineEngine.js';
import { openSheet, closeSheet, renderGroupCarousel, initHeroSwipes, centerActivePill } from '../modules/ui-utils.js';

const groups = ['1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2', '5.1', '5.2', '6.1', '6.2'];

document.addEventListener('DOMContentLoaded', async () => {
    let selectedGroup = localStorage.getItem('sssk_group') || '1.1';

    initUI(selectedGroup);
    await loadAndRender(selectedGroup);

    // Initialise Global Auth Functions
    if (typeof window.initSupabase === 'function') window.initSupabase();
    if (typeof window.updateAuthState === 'function') window.updateAuthState();
});

function initUI(selectedGroup) {
    const changeGroupBtn = document.getElementById('btn-change-group');
    const closeSheetBtn = document.getElementById('btn-close-sheet');
    const overlay = document.getElementById('overlay');

    if (changeGroupBtn) changeGroupBtn.addEventListener('click', () => openSheet('overlay'));
    if (closeSheetBtn) closeSheetBtn.addEventListener('click', () => closeSheet('overlay'));
    if (overlay) overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeSheet('overlay');
    });

    renderGroupCarousel({
        containerId: 'group-carousel',
        groups: groups,
        selectedGroup: selectedGroup,
        onSelect: handleGroupChange
    });

    initHeroSwipes('smart-hero', 
        () => swipeToGroup(1), 
        () => swipeToGroup(-1)
    );

    updateDateDisplay();
}

function swipeToGroup(direction) {
    let currentGroup = localStorage.getItem('sssk_group') || '1.1';
    const currentIndex = groups.indexOf(currentGroup);
    let nextIndex = (currentIndex + direction + groups.length) % groups.length;
    handleGroupChange(groups[nextIndex], null);
}

function handleGroupChange(newGroup, targetEl) {
    localStorage.setItem('sssk_group', newGroup);
    
    renderGroupCarousel({
        containerId: 'group-carousel',
        groups: groups,
        selectedGroup: newGroup,
        onSelect: handleGroupChange
    });

    if (targetEl) {
        const carousel = document.getElementById('group-carousel');
        centerActivePill(carousel, targetEl);
    }
    
    closeSheet('overlay');
    loadAndRender(newGroup);
}

function updateDateDisplay() {
    const dateDisplay = document.getElementById('current-date-display');
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    if (dateDisplay) {
        const options = { weekday: 'long', day: 'numeric', month: 'long' };
        const formattedDate = tomorrow.toLocaleDateString('uk-UA', options);
        dateDisplay.textContent = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
    }
}

async function loadAndRender(selectedGroup) {
    const scheduleData = await fetchScheduleData();

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const d = tomorrow.getDate().toString().padStart(2, '0');
    const m = (tomorrow.getMonth() + 1).toString().padStart(2, '0');
    const dateStr = `${d}.${m}`;
    
    // --- ТИМЧАСОВИЙ ТЕСТОВИЙ ГРАФІК ДЛЯ ЗАВТРА ---
    if (!scheduleData) {
        window.scheduleDataTemp = {}; // fallback pointer
    }
    const targetData = scheduleData || window.scheduleDataTemp;
    if (!targetData[dateStr]) {
        targetData[dateStr] = {
            "1.1": "010111000111000111011111",
            "1.2": "111000111000111000111111",
            "2.1": "110001110001110011111100",
            "2.2": "000111000111000111111000",
            "3.1": "111100011100011100011100",
            "3.2": "001111110001110001110001",
            "4.1": "111111000111000111000111",
            "4.2": "000000111000111000111000",
            "5.1": "001100110011001100110011",
            "5.2": "110011001100110011001100",
            "6.1": "000011110000111100001111",
            "6.2": "111100001111000011110000",
            "content": "Тестовий графік для дизайну"
        };
    }
    // -------------------------------------------

    const daySchedule = targetData[dateStr];

    let text = '';
    if (!daySchedule) {
        console.warn(`No schedule found for tomorrow (${dateStr}).`);
        overrideHero(selectedGroup, null);
        // Не малюємо шкалу, якщо немає даних
        return;
    } else {
        text = daySchedule.content || daySchedule.parsed_text || '';
    }

    // Малюємо шкалу
    const engine = new TimelineEngine({
        scheduleData: targetData, // <-- using targetData because we mocked it
        selectedGroup: selectedGroup,
        groups: groups,
        demoMode: false,
        isAllClearDay: false
    });
    
    engine.init();

    // Застосовуємо дизайн сторінки ЗАВТРА та розраховуємо статистику
    overrideHero(selectedGroup, daySchedule[selectedGroup]);
    
    // Скидаємо повзунок на 00:00 для сторінки ЗАВТРА
    const scrubber = document.getElementById('timeline-scrubber');
    if (scrubber) {
        engine.stopAutoUpdate(); // Відключаємо автооновлення до поточного часу
        // Форсуємо скидання на 00:00 та оновлення UI графіка
        setTimeout(() => {
            scrubber.value = 0;
            engine.updateScrubberPreview();
            scrubber.dispatchEvent(new Event('input'));
        }, 50);

        // Синхронізуємо Радар з рухом скрабера
        scrubber.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            const hour = Math.floor((val * 5) / 60); // 1 крок = 5 хв
            updateRadarHighlight(hour, val);
        });
        
        // Ми більше не скидаємо ховер при відпусканні, 
        // колір ядра завжди залишається насиченим відповідно до вибраного часу
    }
}

function overrideHero(selectedGroup, dayScheduleStr) {
    const heroCard = document.getElementById('smart-hero');
    const groupTitle = document.getElementById('hero-group-title');
    const statLightVal = document.getElementById('stat-light-val');
    const statOffVal = document.getElementById('stat-off-val');
    const statCountVal = document.getElementById('stat-count-val');
    const fallbackContainer = document.getElementById('hero-fallback');

    if (heroCard) {
        heroCard.classList.add('tomorrow-accent');
        heroCard.style.setProperty('--hero-color', '#5E5CE6');
        heroCard.style.setProperty('--hero-glow', 'rgba(94, 92, 230, 0.25)');
    }

    // Номер черги всередині ядра
    if (groupTitle) groupTitle.textContent = selectedGroup;

    // Зберігаємо розклад для синхронізації кольору
    window._radarSchedule = dayScheduleStr || '0'.repeat(24);

    if (!dayScheduleStr) {
        if (fallbackContainer) fallbackContainer.style.display = 'block';
        drawRadar('0'.repeat(24));
        drawRadarLabels(null);
    } else {
        if (fallbackContainer) fallbackContainer.style.display = 'none';
        
        drawRadar(dayScheduleStr);
        drawRadarLabels(dayScheduleStr);

        const lightHours = (dayScheduleStr.match(/1/g) || []).length;
        const offHours = (dayScheduleStr.match(/0/g) || []).length;
        const offCount = (dayScheduleStr.match(/0+/g) || []).length;

        if (statLightVal) statLightVal.textContent = lightHours;
        if (statOffVal) statOffVal.textContent = offHours;
        if (statCountVal) statCountVal.textContent = offCount;
    }

    if (window.heroTimerInterval) clearInterval(window.heroTimerInterval);
}

// --- RADAR MATH & RENDERING ---
function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
    const angleInRadians = (angleInDegrees) * Math.PI / 180.0;
    return {
        x: centerX + (radius * Math.cos(angleInRadians)),
        y: centerY + (radius * Math.sin(angleInRadians))
    };
}

function describeArc(x, y, radius, startAngle, endAngle) {
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return [
        "M", start.x, start.y, 
        "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
    ].join(" ");
}

function drawRadar(dayScheduleStr) {
    const svg = document.getElementById('radar-svg');
    if (!svg) return;
    svg.innerHTML = '';

    const radius = 138; // Радіус кільця (SVG 300x300, center=150)
    const center = 150; 
    const segmentAngle = 360 / 24;
    const gapAngle = 3;

    for (let h = 0; h < 24; h++) {
        const isOff = dayScheduleStr ? dayScheduleStr[h] === '0' : false;
        
        const startAngle = h * segmentAngle + (gapAngle / 2);
        const endAngle = (h + 1) * segmentAngle - (gapAngle / 2);

        const d = describeArc(center, center, radius, startAngle, endAngle);
        
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", d);
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", isOff ? "rgba(142, 142, 147, 0.35)" : "#FF9500");
        path.setAttribute("stroke-width", "10");
        path.setAttribute("stroke-linecap", "round");
        path.id = `radar-segment-${h}`;
        path.style.transition = "all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)";
        path.dataset.baseStroke = isOff ? "rgba(142, 142, 147, 0.35)" : "#FF9500";
        path.dataset.isOff = isOff ? '1' : '0';
        svg.appendChild(path);
    }
}

function drawRadarLabels(dayScheduleStr) {
    const outerSvg = document.getElementById('radar-outer-scale');
    const container = document.getElementById('radar-labels-container');
    if (!outerSvg) return;
    outerSvg.innerHTML = '';
    if (container) container.innerHTML = ''; // clear old div labels

    const labels = [0, 3, 6, 9, 12, 15, 18, 21];
    const C = 200;       // centre of 400×400 wrapper

    // Ring outer edge in wrapper coords:
    // container offset (40) + svgCenter (150) + radius (138) + halfStroke (5) = 333
    // distance from C (200) = 133
    const ringEdge = 133;
    const tickR1   = ringEdge + 7;   // 140 – tick inner
    const tickR2   = ringEdge + 17;  // 150 – tick outer
    const labelR   = ringEdge + 30;  // 163 – label

    // ── Subtle guide ring ──
    const guide = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    guide.setAttribute('cx', C); guide.setAttribute('cy', C);
    guide.setAttribute('r', ringEdge + 12);
    guide.setAttribute('fill', 'none');
    guide.setAttribute('stroke', 'rgba(255,255,255,0.07)');
    guide.setAttribute('stroke-width', 12);
    outerSvg.appendChild(guide);

    labels.forEach(h => {
        const angleDeg = (h / 24) * 360 - 90; // 0 h → top
        const angleRad = angleDeg * Math.PI / 180;
        const isCardinal = h % 6 === 0;

        // Tick line
        const x1 = C + tickR1 * Math.cos(angleRad);
        const y1 = C + tickR1 * Math.sin(angleRad);
        const x2 = C + tickR2 * Math.cos(angleRad);
        const y2 = C + tickR2 * Math.sin(angleRad);

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x1); line.setAttribute('y1', y1);
        line.setAttribute('x2', x2); line.setAttribute('y2', y2);
        line.setAttribute('stroke', isCardinal ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.35)');
        line.setAttribute('stroke-width', isCardinal ? 3 : 1.5);
        line.setAttribute('stroke-linecap', 'round');
        outerSvg.appendChild(line);

        // SVG text label (never clipped by parent overflow)
        const lx = C + labelR * Math.cos(angleRad);
        const ly = C + labelR * Math.sin(angleRad);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', lx);
        text.setAttribute('y', ly);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'central');
        text.setAttribute('font-size', isCardinal ? '14' : '11');
        text.setAttribute('font-weight', isCardinal ? '800' : '600');
        text.setAttribute('fill', isCardinal ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.4)');
        text.setAttribute('font-family', '-apple-system, BlinkMacSystemFont, sans-serif');
        text.setAttribute('letter-spacing', '0.5');
        text.textContent = String(h).padStart(2, '0');
        outerSvg.appendChild(text);
    });

    // ── Маркери зміни графіку (Pills) ──
    if (dayScheduleStr && dayScheduleStr.length === 24) {
        for (let h = 0; h < 24; h++) {
            const prevHour = h === 0 ? 23 : h - 1;
            if (dayScheduleStr[h] !== dayScheduleStr[prevHour]) {
                const isNowOn = dayScheduleStr[h] === '1';
                
                // Кут години h (де 0 -> -90deg або вгору)
                const angleDeg = (h / 24) * 360 - 90;
                const angleRad = angleDeg * Math.PI / 180;
                
                // Довга ціанова лінія (виходить назовні)
                const rInner = 125; // Від внутрішнього краю кільця
                const rOuter = 160; // Виходить далеко назовні
                const x1 = C + rInner * Math.cos(angleRad);
                const y1 = C + rInner * Math.sin(angleRad);
                const x2 = C + rOuter * Math.cos(angleRad);
                const y2 = C + rOuter * Math.sin(angleRad);
                
                const shiftTick = document.createElementNS("http://www.w3.org/2000/svg", "line");
                shiftTick.setAttribute("x1", x1);
                shiftTick.setAttribute("y1", y1);
                shiftTick.setAttribute("x2", x2);
                shiftTick.setAttribute("y2", y2);
                shiftTick.setAttribute("stroke", "#00F0FF");
                shiftTick.setAttribute("stroke-width", "3.5");
                shiftTick.setAttribute("stroke-linecap", "round");
                shiftTick.style.filter = "drop-shadow(0 0 6px #00F0FF)";
                outerSvg.appendChild(shiftTick);

                // Floating Pill (Неонова мітка з часом)
                const pillR = rOuter + 14; // Далі за ціанову лінію
                const px = C + pillR * Math.cos(angleRad);
                const py = C + pillR * Math.sin(angleRad);
                
                const pill = document.createElement('div');
                pill.textContent = `${String(h).padStart(2, '0')}:00`;

                // Стиль як на нижньому графіку, але з неоновим сяйвом
                const bgColor = isNowOn ? '#FF9500' : '#8E8E93';
                const shadowColor = isNowOn ? 'rgba(255,149,0,0.6)' : 'rgba(142,142,147,0.6)';
                
                pill.style.cssText = `
                    position:absolute;
                    left:${px}px; top:${py}px;
                    transform:translate(-50%,-50%);
                    background:${bgColor};
                    color:#FFF;
                    font-size:11px;
                    font-weight:800;
                    padding:3px 8px;
                    border-radius:12px;
                    box-shadow:0 0 12px ${shadowColor}, 0 2px 4px rgba(0,0,0,0.5);
                    border: 1px solid rgba(255,255,255,0.25);
                    letter-spacing:0.5px;
                `;
                container.appendChild(pill);
            }
        }
    }

    // Responsive scale
    scaleRadar();
}


function updateRadarHighlight(activeHour, activeVal = -1) {
    const core = document.getElementById('radar-core');
    const indicator = document.getElementById('radar-indicator');
    const schedule = window._radarSchedule || '0'.repeat(24);
    const title = document.getElementById('hero-group-title');

    // 1. Поворот центральної лінійної стрілки
    if (indicator && activeVal >= 0) {
        // val: 0..287 => 0..360deg => 1 крок = 1.25 градуса. 
        // 00:00 -> 0deg (вгору, оскільки лінія вже намальована вертикально)
        const angle = activeVal * 1.25;
        indicator.style.transform = `rotate(${angle}deg)`;
    }

    // 2. Радикальний колір центрального ядра і самої стрілки (стрічка-графік більше не підсвічується)
    const indicatorLine = document.getElementById('radar-indicator-line');

    if (core) {
        if (activeHour >= 0 && activeHour < 24) {
            const isOff = schedule[activeHour] === '0';
            if (isOff) {
                // Темрява — повністю непрозорий сірий
                core.style.background = '#3A3A3C'; // Solid dark grey
                core.style.boxShadow = '0 0 20px rgba(0,0,0,0.5), inset 0 2px 10px rgba(255,255,255,0.05)';
                core.style.borderColor = 'rgba(255,255,255,0.1)';
                if (title) {
                    title.style.color = '#AEAEB2';
                    title.style.textShadow = '0 2px 10px rgba(0,0,0,0.5)';
                }
                if (indicatorLine) {
                    indicatorLine.style.background = '#8E8E93';
                    indicatorLine.style.boxShadow = '0 0 10px rgba(142,142,147,0.5), 0 0 20px rgba(142,142,147,0.3)';
                }
            } else {
                // Світло є — повністю непрозорий помаранчевий
                core.style.background = '#FF9500'; // Solid orange
                core.style.boxShadow = '0 0 30px rgba(255,149,0,0.4), inset 0 2px 10px rgba(255,255,255,0.3)';
                core.style.borderColor = 'rgba(255,149,0,0.8)';
                if (title) {
                    title.style.color = '#FFF';
                    title.style.textShadow = '0 2px 10px rgba(0,0,0,0.3)';
                }
                if (indicatorLine) {
                    indicatorLine.style.background = '#FF9500';
                    indicatorLine.style.boxShadow = '0 0 10px #FF9500, 0 0 20px #FF9500';
                }
            }
        }
    }
}

// Responsive Scaling — підганяємо 400px wrapper під ширину екрану
function scaleRadar() {
    const wrapper = document.getElementById('radar-wrapper');
    const scaleContainer = document.getElementById('radar-scale-container');
    if (!wrapper || !scaleContainer) return;
    const available = scaleContainer.offsetWidth;
    const natural = 400;
    const scale = Math.min(1, available / natural);
    wrapper.style.transform = `scale(${scale})`;
    wrapper.style.transformOrigin = 'top center';
    scaleContainer.style.height = `${natural * scale}px`;
}
window.addEventListener('resize', scaleRadar);


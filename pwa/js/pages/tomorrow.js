/**
 * tomorrow.js
 * Контролер для сторінки tomorrow.html ("Завтра").
 */

import { fetchScheduleData } from '../modules/api.js';
import { TimelineEngine } from '../modules/TimelineEngine.js';
import { openSheet, closeSheet, renderGroupCarousel, initHeroSwipes, centerActivePill } from '../modules/ui-utils.js';

const groups = ['1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2', '5.1', '5.2', '6.1', '6.2'];

let savedScrubberValue = 0; // Зберігаємо позицію повзунка при перемиканні черг
let hasInteractedWithScrubber = false; // Перевіряємо, чи був ручний дотик
let currentArrowStyle = localStorage.getItem('sssk_arrow_style') || 'skeleton'; // Стиль стрілки радара

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

    // Синхронізуємо Радар з рухом скрабера (один раз при ініціалізації)
    const scrubber = document.getElementById('timeline-scrubber');
    if (scrubber) {
        scrubber.addEventListener('input', (e) => {
            hasInteractedWithScrubber = true; // Фіксуємо ручний дотик
            const val = parseInt(e.target.value);
            savedScrubberValue = val; // Запам'ятовуємо позицію!
            const hour = Math.floor((val * 5) / 60); // 1 крок = 5 хв
            updateRadarHighlight(hour, val);
        });
    }

    // Секретна фіча: перемикання стилю стрілки при кліку на центральне ядро
    const radarCore = document.getElementById('radar-core');
    if (radarCore) {
        radarCore.addEventListener('click', toggleArrowStyle);
    }
    applyArrowStyle(); // Застосовуємо стиль при завантаженні сторінки
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

    const scheduleString = daySchedule ? daySchedule[selectedGroup] : null;

    // Малюємо шкалу
    const engine = new TimelineEngine({
        scheduleData: targetData, // <-- using targetData because we mocked it
        scheduleString: scheduleString,
        selectedGroup: selectedGroup,
        groups: groups,
        demoMode: false,
        isAllClearDay: false
    });
    
    engine.init();

    // Застосовуємо дизайн сторінки ЗАВТРА та розраховуємо статистику
    overrideHero(selectedGroup, daySchedule[selectedGroup]);
    
    // Відновлюємо позицію повзунка (або 00:00, якщо сторінку тільки відкрили)
    const scrubber = document.getElementById('timeline-scrubber');
    if (scrubber) {
        engine.stopAutoUpdate(); // Відключаємо автооновлення до поточного часу
        
        // Форсуємо оновлення інтерфейсу з урахуванням збереженого значення
        setTimeout(() => {
            scrubber.value = savedScrubberValue;
            
            if (!hasInteractedWithScrubber) {
                // Клієнт ще не торкався: не імітуємо евент, щоб блок не підстрибував
                engine.scrubberInteracted = false;
                if (engine.preview) engine.preview.classList.add('preview-off');
                engine.updateScrubberPreview(); 
                updateRadarHighlight(0, savedScrubberValue);
            } else {
                // Користувач раніше посунув повзунок, отже імітуємо клік для ідеальної синхронізації
                scrubber.dispatchEvent(new Event('input'));
            }
        }, 50);
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
        heroCard.classList.remove('status-on', 'status-off');
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

        if (statLightVal) statLightVal.innerHTML = formatStatDuration(lightHours);
        if (statOffVal) statOffVal.innerHTML = formatStatDuration(offHours);
        if (statCountVal) statCountVal.textContent = offCount;
    }

    if (window.heroTimerInterval) clearInterval(window.heroTimerInterval);
}

// Допоміжна функція для форматування тривалості статистики у форматі HH:MM (Apple Watch style)
function formatStatDuration(hours) {
    const formattedHours = hours < 10 ? `0${hours}` : hours;
    return `${formattedHours}<span style="opacity: 0.5;">:</span>00`;
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

    const radius = 130.5; // Зменшено ще більше, щоб зовнішній край (130.5 + 12.5 = 143) не змінювався
    const center = 150; 
    const segmentAngle = 360 / 24;
    const gapAngle = 1.5; // Зменшили кут зазору, щоб виглядав як тонка лінія

    for (let h = 0; h < 24; h++) {
        const isOff = dayScheduleStr ? dayScheduleStr[h] === '0' : false;
        
        const startAngle = h * segmentAngle + (gapAngle / 2);
        const endAngle = (h + 1) * segmentAngle - (gapAngle / 2);

        const d = describeArc(center, center, radius, startAngle, endAngle);
        
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", d);
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", isOff ? "rgba(142, 142, 147, 0.35)" : "#FF9500");
        path.setAttribute("stroke-width", "25"); // Ще на 5px товщі
        path.setAttribute("stroke-linecap", "butt"); // Прямокутні краї, щоб не було накладання
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

    const C = 200;       // centre of 400×400 wrapper

    // Ring outer edge in wrapper coords:
    const ringEdge = 133;
    const labelR   = ringEdge + 30;  // Ще ближче до шкали для візуальної цілісності

    // ── Subtle guide ring ──
    const guide = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    guide.setAttribute('cx', C); guide.setAttribute('cy', C);
    guide.setAttribute('r', ringEdge + 12);
    guide.setAttribute('fill', 'none');
    guide.setAttribute('stroke', 'rgba(0,0,0,0.04)');
    guide.setAttribute('stroke-width', 12);
    outerSvg.appendChild(guide);

    for (let slot = 0; slot < 48; slot++) {
        const isHalfHour = slot % 2 !== 0;
        const h = Math.floor(slot / 2);
        
        const angleDeg = (slot / 48) * 360 - 90; // 0 slot → top
        const angleRad = angleDeg * Math.PI / 180;
        
        const isCardinal = !isHalfHour && (h % 6 === 0);      // 0, 6, 12, 18
        const isSubCardinal = !isHalfHour && (h % 3 === 0);   // 3, 9, 15, 21
        const isHourly = !isHalfHour;
        
        // Tick line length & stroke based on importance
        const tickR1 = ringEdge + 8;
        let tickR2;
        if (isCardinal) tickR2 = ringEdge + 20;
        else if (isSubCardinal) tickR2 = ringEdge + 15;
        else if (isHourly) tickR2 = ringEdge + 12;
        else tickR2 = ringEdge + 10; // Half-hour ticks
        
        const x1 = C + tickR1 * Math.cos(angleRad);
        const y1 = C + tickR1 * Math.sin(angleRad);
        const x2 = C + tickR2 * Math.cos(angleRad);
        const y2 = C + tickR2 * Math.sin(angleRad);

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x1); line.setAttribute('y1', y1);
        line.setAttribute('x2', x2); line.setAttribute('y2', y2);
        
        let strokeColor, strokeWidth;
        if (isCardinal) {
            strokeColor = 'rgba(0,0,0,0.5)';
            strokeWidth = 3.5;
        } else if (isSubCardinal) {
            strokeColor = 'rgba(0,0,0,0.4)';
            strokeWidth = 2.5;
        } else if (isHourly) {
            strokeColor = 'rgba(0,0,0,0.25)';
            strokeWidth = 2;
        } else {
            strokeColor = 'rgba(0,0,0,0.15)';
            strokeWidth = 1.5;
        }
        
        line.setAttribute('stroke', strokeColor);
        line.setAttribute('stroke-width', strokeWidth);
        line.setAttribute('stroke-linecap', 'round');
        outerSvg.appendChild(line);

        // Чисті цифри-мітки кожні 3 години (без хвилин і без фону)
        if (isSubCardinal) {
            const lx = C + labelR * Math.cos(angleRad);
            const ly = C + labelR * Math.sin(angleRad);

            const textLabel = document.createElement('div');
            textLabel.textContent = String(h).padStart(2, '0');
            
            const fontSize = isCardinal ? '18px' : '14px';
            const fontWeight = isCardinal ? '800' : '600';
            const opacity = isCardinal ? '1' : '0.75';
            
            textLabel.style.cssText = `
                position: absolute;
                left: ${lx}px;
                top: ${ly}px;
                transform: translate(-50%, -50%);
                color: #1C1C1E;
                opacity: ${opacity};
                font-size: ${fontSize};
                font-weight: ${fontWeight};
                letter-spacing: 0.5px;
            `;
            container.appendChild(textLabel);
        }
    }

    // ── Чудовий мінімалістичний радар зі збалансованою геометрією ──

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
    const label = document.getElementById('hero-queue-label');

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
                if (label) {
                    label.style.color = '#AEAEB2';
                    label.style.textShadow = '0 2px 10px rgba(0,0,0,0.5)';
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
                if (label) {
                    label.style.color = '#FFF';
                    label.style.textShadow = '0 2px 10px rgba(0,0,0,0.3)';
                }
            }
        }
    }
}

// === ЛОГІКА ПЕРЕМИКАННЯ СТИЛІВ СТРІЛКИ (EASTER EGG) ===
window.applyArrowStyle = function() {
    const skele = document.getElementById('arrow-style-skeleton');
    const speedo = document.getElementById('arrow-style-speedo');
    if (!skele || !speedo) return;

    if (currentArrowStyle === 'skeleton') {
        skele.style.display = 'block';
        speedo.style.display = 'none';
    } else {
        skele.style.display = 'none';
        speedo.style.display = 'block';
    }
}

window.toggleArrowStyle = function() {
    currentArrowStyle = currentArrowStyle === 'skeleton' ? 'speedo' : 'skeleton';
    localStorage.setItem('sssk_arrow_style', currentArrowStyle);
    
    // Візуальний відгук (тактильний натиск ядра)
    const core = document.getElementById('radar-core');
    if (core) {
        core.style.transform = 'scale(0.92)';
        setTimeout(() => core.style.transform = 'scale(1)', 150);
    }
    
    window.applyArrowStyle();
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


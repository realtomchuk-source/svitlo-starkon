/**
 * home.js
 * Головний контролер для сторінки index.html ("Сьогодні").
 * Поєднує дані з api.js, малює графік через TimelineEngine, і керує UI.
 */

import { fetchScheduleData } from '../modules/api.js';
import { updateDashboardTablo } from './home-tablo.js';
import { TimelineEngineV2 } from '../modules/TimelineEngineV2.js';
import { openSheet, closeSheet, initHeroSwipes } from '../modules/ui-utils.js';
import { SubQueueCarousel } from '../modules/SubQueueCarousel.js';
import { SelectorEngine } from '../modules/SelectorEngine.js';

const groups = ['1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2', '5.1', '5.2', '6.1', '6.2'];

let isCurrentlySyncing = false; // Guard for precisely timed re-renders
let savedScrubberValue = null;
let hasInteractedWithScrubber = false;
let globalScrubberTimeout = null;
let cachedScheduleData = null; // 1.0.10: Cache for instant UI updates
let selectorInstance = null; // Pill-селектор підчерг

// --- INITIALIZATION --- (v1.0.13)

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Home Page Module Initialized');

    // 1. Старт завжди з черги 1.1
    let selectedGroup = '1.1';
    localStorage.setItem('sssk_group', selectedGroup);

    // 2. Ініціалізація UI
    initUI(selectedGroup);


    // Ініціалізація Pill-селектора підчерг
    selectorInstance = new SelectorEngine('subqueue-selector', {
        onSelect: (val) => {
            console.log('Sub-queue selected via Selector:', val);
            handleGroupChange(val, 'selector');
        }
    });
    // Центрування на поточній підчерзі (без анімації при старті)
    setTimeout(() => selectorInstance.scrollTo(selectedGroup, false), 100);

    // 3. Завантаження даних та малювання графіка
    await loadAndRender(selectedGroup);

    // 4. Приховування екрану завантаження
    const loader = document.getElementById('loading-screen');
    if (loader) {
        setTimeout(() => {
            loader.classList.add('fade-out');
            setTimeout(() => loader.remove(), 600);
        }, 800); 
    }

    // 5. Подальша логіка для Home (за потреби)
});

function initUI(selectedGroup) {
    if (window._sssk_ui_init_done) return;
    window._sssk_ui_init_done = true;
    console.log('Initializing UI for group:', selectedGroup);
    
    const homeQueueBtn = document.getElementById('home-queue-btn');
    const homePickerOverlay = document.getElementById('home-queue-picker-overlay');
    const closePickerBtn = document.getElementById('btn-close-picker');
    if (homeQueueBtn) {
        homeQueueBtn.style.display = 'flex'; // Fail-safe
        homeQueueBtn.addEventListener('click', () => {
             console.log('Queue button clicked');
             openSheet('home-queue-picker-overlay');
        });
    }
    if (closePickerBtn) closePickerBtn.addEventListener('click', () => closeSheet('home-queue-picker-overlay'));
    if (homePickerOverlay) homePickerOverlay.addEventListener('click', (e) => {
        if (e.target === homePickerOverlay) closeSheet('home-queue-picker-overlay');
    });

    const changeGroupBtn = document.getElementById('btn-change-group');
    const closeSheetBtn = document.getElementById('btn-close-sheet');
    const overlay = document.getElementById('overlay');

    if (changeGroupBtn) changeGroupBtn.addEventListener('click', () => openSheet('overlay'));
    if (closeSheetBtn) closeSheetBtn.addEventListener('click', () => closeSheet('overlay'));
    if (overlay) overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeSheet('overlay');
    });

    // Render buttons for both pickers (legacy and new)
    renderPickerButtons('group-buttons', selectedGroup);
    renderPickerButtons('home-queue-buttons', selectedGroup);

    // Налаштування свайпів по головній картці

    initHeroSwipes('smart-hero', 
        () => swipeToGroup(1),   // Left 
        () => swipeToGroup(-1)   // Right
    );

    // Scrubber interaction logic moved to TimelineEngineV2
    // We only need local state for high-level UI if really needed, 
    // but the engine handles its own auto-return logic.

    // Оновлення поточної дати
    updateDateDisplay();

    // Запуск спостереження за переходом через північ (00:00)
    initDateWatcher();
}

/**
 * --- TRUE 3D INDUSTRIAL ROTATIONAL ENGINE (v1.2.11) ---
 * Transitions from linear scroll-offset logic to 360-degree rotational geometry.
 */
function initQueueWheelController(selectedGroup) {
    const wheel = document.getElementById('queue-wheel-picker');
    const track = document.getElementById('wheel-track');
    const activeVal = document.getElementById('active-queue-val');
    if (!wheel || !track || !activeVal) return;

    track.innerHTML = '';
    
    // Setup 24 slots (12 queues + 12 ticks) for higher density.
    // We still use 3 buffers for 360-degree seamless rotation.
    const fullGroups = [];
    groups.forEach(g => {
        fullGroups.push({ type: 'queue', val: g });
        fullGroups.push({ type: 'tick', val: null }); // Mechanical spacer
    });

    const triplet = [...fullGroups, ...fullGroups, ...fullGroups];
    const angleStep = 15; // 360 / 24 items
    const radius = 240; 
    
    triplet.forEach((slot, i) => {
        const item = document.createElement('div');
        item.className = slot.type === 'tick' ? 'wheel-item is-tick' : 'wheel-item';
        if (slot.val) {
            item.textContent = slot.val;
            item.dataset.group = slot.val;
        }
        item.dataset.index = i;
        item.dataset.type = slot.type;
        
        // Circular placement
        const angle = (i - fullGroups.length) * angleStep; 
        item.style.transform = `rotateY(${angle}deg) translateZ(${radius}px)`;
        track.appendChild(item);
    });

    let currentRot = 0;
    let isDragging = false;
    let startX = 0;
    let startRot = 0;
    let lastX = 0;
    let velocity = 0;
    let lastTime = 0;

    const updateUI = () => {
        const items = track.querySelectorAll('.wheel-item');
        let closest = null;
        let minDiff = Infinity;

        items.forEach(item => {
            const idx = parseInt(item.dataset.index);
            const itemAngle = (idx - fullGroups.length) * angleStep;
            const totalAngle = itemAngle + currentRot;
            
            // Normalize to [-180, 180] for visibility/lighting
            let norm = totalAngle % 360;
            if (norm > 180) norm -= 360;
            if (norm < -180) norm += 360;
            
            const absNorm = Math.abs(norm);
            const isQueue = item.dataset.type === 'queue';
            
            // High-density optical lighting
            const fadeThreshold = isQueue ? 85 : 45; // Ticks fade out much earlier
            const opacity = Math.max(0.01, 1 - Math.pow(absNorm / fadeThreshold, 1.4)); 
            item.style.opacity = opacity;
            
            if (isQueue) {
                if (absNorm < 10) { // Lens focus
                    item.style.color = '#FF7A00'; 
                    item.classList.add('is-active');
                    if (absNorm < minDiff) { 
                        minDiff = absNorm; 
                        closest = item.dataset.group; 
                    }
                } else {
                    item.style.color = absNorm < 45 ? '#FFFFFF' : '#808080';
                    item.classList.remove('is-active');
                }
            }
        });

        if (closest && activeVal.textContent !== closest) {
            activeVal.textContent = closest;
            if (navigator.vibrate) navigator.vibrate(8);
        }
    };

    const rotateTo = (group, behavior = 'smooth') => {
        const idx = groups.indexOf(group);
        if (idx === -1) return;
        
        // Find rotation shift to reach queue idx (even slots at 30deg intervals)
        const targetRot = -idx * 30;
        
        if (behavior === 'smooth') {
            track.style.transition = 'transform 0.6s cubic-bezier(0.2, 0.8, 0.3, 1)';
        } else {
            track.style.transition = 'none';
        }
        
        currentRot = targetRot;
        track.style.transform = `rotateY(${currentRot}deg)`;
        setTimeout(updateUI, behavior === 'smooth' ? 300 : 0);
    };

    // Global Access for External Control (Sheets, Swipes)
    window.syncQueueWheel = (newGroup) => rotateTo(newGroup, 'smooth');

    // Drag Interaction
    const onStart = (e) => {
        isDragging = true;
        startX = e.clientX;
        lastX = e.clientX;
        startRot = currentRot;
        lastTime = Date.now();
        track.style.transition = 'none';
        wheel.setPointerCapture(e.pointerId);
    };

    const onMove = (e) => {
        if (!isDragging) return;
        const now = Date.now();
        const dt = now - lastTime;
        const dx = e.clientX - lastX;
        if (dt > 0) velocity = dx / dt;

        const totalDx = e.clientX - startX;
        const sensitivity = 0.18; // Degrees per pixel
        currentRot = startRot + (totalDx * sensitivity);
        
        track.style.transform = `rotateY(${currentRot}deg)`;
        lastX = e.clientX;
        lastTime = now;
        updateUI();
    };

    const onEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        
        // Inertia Snap - strictly to queues (30deg steps)
        const inertia = velocity * 150;
        const target = Math.round((currentRot + inertia) / 30) * 30;
        
        currentRot = target;
        track.style.transition = 'transform 0.6s cubic-bezier(0.15, 0.85, 0.35, 1)';
        track.style.transform = `rotateY(${currentRot}deg)`;

        // Silent Infinite Reset
        setTimeout(() => {
            const circle = 360; 
            if (Math.abs(currentRot) > circle * 0.7) {
                track.style.transition = 'none';
                if (currentRot > 0) currentRot -= circle;
                else currentRot += circle;
                track.style.transform = `rotateY(${currentRot}deg)`;
            }
            
            // Persistence
            const finalGroup = activeVal.textContent;
            localStorage.setItem('sssk_group', finalGroup);
            if (typeof window.loadAndRender === 'function') window.loadAndRender(finalGroup);
            updateUI();
        }, 600);
    };

    wheel.onpointerdown = onStart;
    wheel.onpointermove = onMove;
    wheel.onpointerup = onEnd;
    wheel.onpointercancel = onEnd;

    // Set Initial Position
    rotateTo(selectedGroup, 'auto');
}

window.addEventListener('resize', () => {
    // Force re-sync position on resize
    const currentGroup = localStorage.getItem('sssk_group') || '1.1';
    if (typeof window.syncQueueWheel === 'function') {
        window.syncQueueWheel(currentGroup);
    }
});

/**
 * Важливо для стабільності: о 00:00 графік "на завтра" стає графіком "на сьогодні".
 * Додаток повинен автоматично перезавантажитись, щоб підтягнути нові дані.
 */
function initDateWatcher() {
    const loadDate = new Date().getDate();
    setInterval(() => {
        const currentDate = new Date().getDate();
        if (currentDate !== loadDate) {
            console.log('Date changed! Reloading to refresh schedule...');
            window.location.reload();
        }
    }, 30000); // Перевірка кожні 30 сек
}

function swipeToGroup(direction) {
    let currentGroup = localStorage.getItem('sssk_group') || '1.1';
    const currentIndex = groups.indexOf(currentGroup);
    let nextIndex = (currentIndex + direction + groups.length) % groups.length;
    handleGroupChange(groups[nextIndex], null);
}

function handleGroupChange(newGroup, source) {
    localStorage.setItem('sssk_group', newGroup);
    
    // Оновити мітку на кнопці головної сторінки
    const queueLabel = document.getElementById('current-queue-label');
    if (queueLabel) {
        queueLabel.textContent = newGroup;
    }

    // Перемалювати обидва пікери
    renderPickerButtons('group-buttons', newGroup);
    renderPickerButtons('home-queue-buttons', newGroup);

    closeSheet('overlay');

    closeSheet('home-queue-picker-overlay');
    
    // 1.0.11: Синхронізація нового Wheel Picker
    const activeVal = document.getElementById('active-queue-val');
    if (activeVal) {
        activeVal.textContent = newGroup;
    }
    if (typeof window.syncQueueWheel === 'function' && source !== 'drum-scroll') {
        window.syncQueueWheel(newGroup);
    }

    // Синхронізація Pill-селектора (якщо зміна НЕ з нього)
    if (selectorInstance && source !== 'selector') {
        selectorInstance.scrollTo(newGroup);
    }
    
    // Перемалювати графік для нової черги (1.0.14 CORE FIX)
    if (cachedScheduleData) {
        // Миттєвий апдейт без запиту до сервера
        renderTimelineV2(newGroup, cachedScheduleData);
    } else {
        // Фоллбек, якщо даних ще немає
        loadAndRender(newGroup);
    }
}

/**
 * Логіка швидкого перемальовування Timeline V2 без повторного запиту даних (v1.0.14)
 */
function renderTimelineV2(selectedGroup, data) {
    if (window.activeEngineV2 && typeof window.activeEngineV2.stopAutoUpdate === 'function') {
        window.activeEngineV2.stopAutoUpdate();
    }

    const scheduleString = data && data.queues ? data.queues[selectedGroup] : null;
    const isAllClearDay = data.mode === 'all_clear';
    const isNoPowerDay = data.mode === 'no_power';
    const now = new Date();

    const engineV2 = new TimelineEngineV2({
        containerId: 'main-timeline-v2',
        scheduleData: data,
        scheduleString: isAllClearDay ? "1".repeat(24) : (isNoPowerDay ? "0".repeat(24) : scheduleString),
        selectedGroup: selectedGroup,
        groups: groups,
        demoMode: !data, 
        isAllClearDay: isAllClearDay
    });
    engineV2.init();
    window.activeEngineV2 = engineV2;

    // Оновлення Hero UI (колір картки, таймер)
    updateHeroUI(selectedGroup, now, isAllClearDay, isNoPowerDay, !data, scheduleString);
}

function renderPickerButtons(containerId, selectedGroup) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    const now = new Date();
    const currentHour = now.getHours();
    
    // Check if we have cached data for dot status calculation
    let scheduleDataObj = null;
    if (typeof cachedScheduleData !== 'undefined' && cachedScheduleData) {
        scheduleDataObj = cachedScheduleData.queues || null;
    }

    groups.forEach(group => {
        const btn = document.createElement('button');
        const isActive = (group === selectedGroup);
        
        // Determine if light is ON for this group right now
        let isOn = (currentHour % 2 === 0); // Fallback
        const scheduleString = scheduleDataObj ? scheduleDataObj[group] : null;
        if (scheduleString && scheduleString.length === 24) {
            isOn = scheduleString[currentHour] !== '0';
        }

        // Apply new horizontal structure matching Cabinet
        btn.className = 'group-btn' + (isActive ? ' active' : '');
        btn.innerHTML = `
            <div class="status-dot ${isOn ? 'on' : 'off'}"></div>
            <span class="group-num">${group}</span>
        `;

        btn.onclick = () => handleGroupChange(group);
        container.appendChild(btn);
    });
}

function updateDateDisplay() {
    const dateDisplay = document.getElementById('current-date-display');
    const now = new Date();

    if (dateDisplay) {
        const options = { weekday: 'long', day: 'numeric', month: 'long' };
        const formattedDate = now.toLocaleDateString('uk-UA', options);
        dateDisplay.textContent = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
    }

    // Центральна кнопка дати: 3 колонки
    const bottomDay = document.getElementById('bottom-date-day');
    const bottomDM  = document.getElementById('bottom-date-dm');
    const bottomWD  = document.getElementById('bottom-date-wd');

    if (bottomDay) {
        bottomDay.textContent = now.getDate();
    }
    if (bottomDM) {
        // Витягуємо місяць у родовому відмінку з рядка "27 березня"
        const fullDM = now.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' });
        // fullDM = "27 березня" → беремо тільки слово після числа
        const monthOnly = fullDM.replace(/^\d+\s*/, '').trim();
        bottomDM.textContent = monthOnly.toLowerCase();
    }
    if (bottomWD) {
        const wd = now.toLocaleDateString('uk-UA', { weekday: 'long' });
        bottomWD.textContent = wd.toUpperCase();
    }
}

async function loadAndRender(selectedGroup) {
    const data = await fetchScheduleData();
    cachedScheduleData = data; // 1.0.10: Update cache

    const now = new Date();
    
    let hasOutageMessage = false;
    let isAllClearDay = false;
    let isNoPowerDay = false;
    let demoMode = false;
    let message = '';

    if (!data) {
        console.warn(`No schedule data found. Showing fallback.`);
        message = 'Дані відсутні (Демо-режим)';
        demoMode = true;
        hasOutageMessage = true;
    } else {
        message = data.message || '';
        if (data.mode === 'all_clear') {
            isAllClearDay = true;
        } else if (data.mode === 'no_power') {
            isNoPowerDay = true;
        } else {
            // mode === 'schedule'
            const isOffKeywords = ['відключення', 'графік', 'вимкнення'];
            hasOutageMessage = isOffKeywords.some(key => message.toLowerCase().includes(key));
        }
    }

    // 1.0.12: Queue label removed from hero as per user request to prioritize status
    // const heroQueueLabel = document.getElementById('hero-group-title');
    // if (heroQueueLabel) heroQueueLabel.textContent = 'ЧЕРГА ' + selectedGroup;

    // Оновлення мітки на кнопці під графіком
    const queueBtnLabel = document.getElementById('current-queue-label');
    if (queueBtnLabel) queueBtnLabel.textContent = selectedGroup;

    // Витягуємо рядок графіка для обраної черги
    const scheduleString = data && data.queues ? data.queues[selectedGroup] : null;

    // Оновлення заголовку дати (використовуємо дату з JSON або поточну)
    const dateTitle = document.querySelector('.date-badge'); // Target the visible badge
    const displayDate = (data && data.date) ? data.date : `${now.getDate().toString().padStart(2, '0')}.${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    if (dateTitle) dateTitle.textContent = displayDate;

    // Логіка кнопки "Графік на завтра"
    const btnTomorrow = document.getElementById('btn-show-tomorrow');
    if (btnTomorrow) {
        if (data && data.has_tomorrow) btnTomorrow.classList.remove('hidden');
        else btnTomorrow.classList.add('hidden');
    }

    // 1.0.14: Використовуємо уніфікований рендер-хелпер
    renderTimelineV2(selectedGroup, data);
}

function updateHeroUI(selectedGroup, now, isAllClear, isNoPower, demoMode, scheduleString) {
    const heroCard = document.getElementById('smart-hero');
    const heroTitle = document.getElementById('hero-title');
    const heroSubtitle = document.getElementById('hero-subtitle');
    const countdownEl = document.getElementById('hero-countdown');
    const progressFill = document.getElementById('hero-progress-fill');
    
    const activeQueueVal = document.getElementById('active-queue-val');
    if (activeQueueVal) activeQueueVal.textContent = `Підчерга ${selectedGroup}`;

    // Helper for interval duration (Total block length in minutes)
    const getIntervalDuration = (schedule, hour, isOn) => {
        let start = hour;
        let end = hour;
        // Look back
        while (start > 0 && (schedule[start - 1] === '1') === isOn) start--;
        // Look forward
        while (end < 23 && (schedule[end + 1] === '1') === isOn) end++;
        return (end - start + 1) * 60;
    };

    // Створюємо віртуальний графік для особливих режимів
    let activeSchedule = scheduleString;
    if (isAllClear) activeSchedule = "1".repeat(24);
    else if (isNoPower) activeSchedule = "0".repeat(24);
    else if (!activeSchedule) activeSchedule = "1".repeat(24); // Fallback

    const groupsList = ['1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2', '5.1', '5.2', '6.1', '6.2'];
    const groupIndex = groupsList.indexOf(selectedGroup);

    const updateInner = () => {
        const currentTime = new Date();
        const currentHour = currentTime.getHours();
        
        // Розрахунок стану (Світло є / немає)
        let isCurrentlyOn = activeSchedule[currentHour] === '1';
        if (isAllClear) isCurrentlyOn = true; // "Green" mode is visually "ON"
        if (demoMode && !isAllClear && !isNoPower) {
             isCurrentlyOn = !((currentHour + groupIndex) % 10 < 5);
        }

        // 1. Оновлення кольорів, тексту та іконок статусу
        const foundationOrange = '#EE7221';
        const foundationGrey = '#718096';
        let color = foundationOrange;
        let glow = 'rgba(238, 114, 33, 0.15)';
        let statusString = '';
        let statusIconFile = 'assets/power_off.png';

        if (isAllClear) {
            statusString = 'Відключень немає 🎉';
            statusIconFile = 'assets/power_off.png'; 
            isCurrentlyOn = true; // Ensure visual parity
        } else if (isNoPower) {
            color = foundationGrey; 
            glow = 'rgba(113, 128, 150, 0.15)';
            statusString = 'Аварійне відключення';
            statusIconFile = 'assets/power_on.png'; // Visual: Grey with Minus (OFF)
        } else {
            if (!isCurrentlyOn) {
                color = foundationGrey;
                glow = 'rgba(113, 128, 150, 0.15)';
                statusString = 'Світла немає';
                statusIconFile = 'assets/power_on.png'; // Visual: Grey with Minus (OFF)
            } else {
                statusString = 'Світло є';
                statusIconFile = 'assets/power_off.png'; // Visual: Orange with Plus (ON)
            }
        }

        // 2. Apply Text & Card States (Strictly synced with statusString)
        const currentHeroTitle = document.getElementById('hero-title');
        const currentHeroCard = document.getElementById('smart-hero');
        const currentHeroIconImg = document.getElementById('hero-icon-3d');

        if (currentHeroTitle) currentHeroTitle.textContent = statusString;
        if (currentHeroCard) {
            currentHeroCard.classList.toggle('status-on', isCurrentlyOn);
            currentHeroCard.classList.toggle('status-off', !isCurrentlyOn);
        }

        // --- Update the NEW Dynamic Dashboard Block Foundation ---
        const dynamicBlock = document.getElementById('dynamic-info-block');
        if (dynamicBlock) {
            dynamicBlock.classList.toggle('status-on', isCurrentlyOn);
            dynamicBlock.classList.toggle('status-off', !isCurrentlyOn);
        }

        if (currentHeroIconImg) {
            const lastStatus = currentHeroIconImg.dataset.status;
            const newStatus = isCurrentlyOn ? 'on' : 'off';

            if (lastStatus !== newStatus) {
                // Change the icon file according to the NEW determined status
                currentHeroIconImg.src = statusIconFile;
                currentHeroIconImg.dataset.status = newStatus;

                // Animate transition
                currentHeroIconImg.animate([
                    { transform: 'scale(1)', opacity: 0.8 },
                    { transform: 'scale(1.1)', opacity: 1 },
                    { transform: 'scale(1)', opacity: 1 }
                ], { duration: 400, easing: 'ease-out' });
            }
        }

        // 3. Розрахунок наступної зміни та таймера
        let nextChangeHour = 24;
        if (!isAllClear && !isNoPower) {
            for (let i = currentHour + 1; i < 24; i++) {
                let stateAtI = activeSchedule[i] === '1';
                if (demoMode) stateAtI = !((i + groupIndex) % 10 < 5);
                
                if (stateAtI !== isCurrentlyOn) {
                    nextChangeHour = i;
                    break;
                }
            }
        }

        const nextTime = new Date();
        nextTime.setHours(nextChangeHour, 0, 0, 0);
        const diffMs = nextTime.getTime() - currentTime.getTime();
        const minutesRemaining = Math.max(0, Math.floor(diffMs / 60000));

        // 3.1 Calculate total interval duration for progress bar (TS 8.2)
        let totalBlockDuration = 240; // Fallback 4h
        if (!isAllClear && !isNoPower) {
            totalBlockDuration = getIntervalDuration(activeSchedule, currentHour, isCurrentlyOn);
        } else {
            totalBlockDuration = 1440; // 24h block for AllClear/NoPower
        }

        if (countdownEl) {
            // Update Timer Text (H:MM format)
            const h = Math.floor(minutesRemaining / 60);
            const m = minutesRemaining % 60;
            countdownEl.textContent = `${h}:${m.toString().padStart(2, '0')}`;

            // Update Description Text
            if (heroSubtitle) {
                if (nextChangeHour === 24) {
                    heroSubtitle.textContent = "до кінця доби";
                } else {
                    const actionText = isCurrentlyOn ? 'вимкнення' : 'увімкнення';
                    heroSubtitle.textContent = `до ${actionText} о ${nextChangeHour}:00`;
                }
            }

            // Update Progress Bar (TS 8.2: 1 - (remaining_sec / duration_sec))
            if (progressFill) {
                const diffSeconds = Math.max(0, Math.floor(diffMs / 1000));
                const totalBlockSeconds = totalBlockDuration * 60;
                const progress = 1 - (diffSeconds / totalBlockSeconds);
                progressFill.style.width = `${Math.max(0, Math.min(1, progress)) * 100}%`;
            }
        }
        // 4. Оновлення Інфо-Табло (Dashboard Tablo) через автономний контролер
        // Тільки якщо користувач НЕ взаємодіє з повзунком
        if (!window.isTimelineScrubbing) {
            updateDashboardTablo(now, isCurrentlyOn, nextChangeHour);
        }

        // 5. Оновлення стану Wheel Picker Tablo (1.0.12)
        const queueWheelTablo = document.querySelector('.active-queue-tablo');
        if (queueWheelTablo) {
            if (isCurrentlyOn) {
                queueWheelTablo.classList.add('status-on');
                queueWheelTablo.classList.remove('status-off');
            } else {
                queueWheelTablo.classList.add('status-off');
                queueWheelTablo.classList.remove('status-on');
            }
        }
    };

    // Запуск та очищення інтервалів
    if (window.heroTimer) clearInterval(window.heroTimer);
    updateInner();
    window.heroTimer = setInterval(updateInner, 1000);
}

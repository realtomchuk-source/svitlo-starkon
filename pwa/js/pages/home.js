/**
 * home.js
 * Головний контролер для сторінки index.html ("Сьогодні").
 * Поєднує дані з api.js, малює графік через TimelineEngine, і керує UI.
 */

import { fetchScheduleData } from '../modules/api.js';
import { TimelineEngine } from '../modules/TimelineEngine.js';
import { openSheet, closeSheet, renderGroupCarousel, initHeroSwipes, centerActivePill } from '../modules/ui-utils.js';

const groups = ['1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2', '5.1', '5.2', '6.1', '6.2'];

let savedScrubberValue = null;
let hasInteractedWithScrubber = false;
let globalScrubberTimeout = null;

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Home Page Module Initialized');

    // 1. Отримання збереженої черги (пріоритет: зафіксована для старту -> поточна сесія)
    let selectedGroup = localStorage.getItem('sssk_start_group') || localStorage.getItem('sssk_group') || '1.1';
    
    // Оновлюємо поточну сесію, щоб вона відповідала стартовій
    localStorage.setItem('sssk_group', selectedGroup);

    // 2. Ініціалізація UI
    initUI(selectedGroup);

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

    // 5. Ініціалізація Supabase та Авторизації (глобальні функції з supabase-client.js)
    if (typeof window.initSupabase === 'function') window.initSupabase();
    if (typeof window.updateAuthState === 'function') window.updateAuthState();

    // Підключення кнопки Google Auth
    const btnGoogleAuth = document.getElementById('btn-google-auth');
    if (btnGoogleAuth && typeof window.signInWithGoogle === 'function') {
        const currentOnclick = btnGoogleAuth.onclick;
        btnGoogleAuth.onclick = async () => {
            const user = await window.getUserProfile();
            if (!user) {
                await window.signInWithGoogle();
            } else if (currentOnclick) {
                currentOnclick();
            }
        };
    }
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

    // Налаштування каруселі
    renderGroupCarousel({
        containerId: 'group-carousel',
        groups: groups,
        selectedGroup: selectedGroup,
        onSelect: (newGroup, targetEl) => {
            handleGroupChange(newGroup, targetEl);
        }
    });

    // Налаштування свайпів по головній картці
    initHeroSwipes('smart-hero', 
        () => swipeToGroup(1),   // Left 
        () => swipeToGroup(-1)   // Right
    );

    // Зберігаємо позицію повзунка (якщо користувач вручну тягне)
    const scrubber = document.getElementById('timeline-scrubber');
    if (scrubber) {
        scrubber.addEventListener('input', (e) => {
            hasInteractedWithScrubber = true;
            savedScrubberValue = parseInt(e.target.value);
            if (globalScrubberTimeout) clearTimeout(globalScrubberTimeout);
        });

        // Після відпускання пальця, скидаємо "ручний" стан через 2 секунди, щоб движок міг повернутися до Now
        scrubber.addEventListener('change', () => {
            if (globalScrubberTimeout) clearTimeout(globalScrubberTimeout);
            globalScrubberTimeout = setTimeout(() => {
                hasInteractedWithScrubber = false;
                savedScrubberValue = null;
            }, 2100); // Синхронізуємо з таймаутом TimelineEngine
        });
    }

    // Оновлення поточної дати
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
    
    // Перемалювати карусель
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
    
    // Перемалювати графік для нової черги
    loadAndRender(newGroup);
}

function updateDateDisplay() {
    const dateDisplay = document.getElementById('current-date-display');
    const bgDateDecor = document.getElementById('bg-date-decor');
    const now = new Date();

    if (dateDisplay) {
        const options = { weekday: 'long', day: 'numeric', month: 'long' };
        const formattedDate = now.toLocaleDateString('uk-UA', options);
        dateDisplay.textContent = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
    }

    if (bgDateDecor) {
        const d = now.getDate().toString().padStart(2, '0');
        const m = (now.getMonth() + 1).toString().padStart(2, '0');
        bgDateDecor.textContent = `${d}.${m}`;
    }
}

async function loadAndRender(selectedGroup) {
    const scheduleData = await fetchScheduleData();

    const now = new Date();
    const d = now.getDate().toString().padStart(2, '0');
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    const dateStr = `${d}.${m}`;
    
    const daySchedule = scheduleData ? scheduleData[dateStr] : null;

    let hasOutageMessage = false;
    let isAllClearDay = false;
    let demoMode = false;
    let text = '';

    if (!daySchedule) {
        console.warn(`No schedule found for ${dateStr}. Showing fallback.`);
        // Замість оригінальної логіки "Щасливого дня", ми активуємо демо-режим:
        text = 'відключення (Демо-режим)';
        demoMode = true;
        hasOutageMessage = true;
    } else {
        text = daySchedule.content || daySchedule.parsed_text || '';
        const isOffKeywords = ['відключення', 'графік', 'вимкнення'];
        hasOutageMessage = isOffKeywords.some(key => text.toLowerCase().includes(key));
    }

    isAllClearDay = !hasOutageMessage;

    // Оновлення заголовку картки
    const groupTitle = document.getElementById('hero-group-title');
    if (groupTitle) groupTitle.textContent = 'ЧЕРГА ' + selectedGroup;

    const scheduleString = daySchedule ? daySchedule[selectedGroup] : null;

    // Зупиняємо старий 엔진, щоб не накопичувати інтервали автооновлення
    if (window.activeEngine) {
        window.activeEngine.stopAutoUpdate();
    }

    // Створюємо 엔진 і відмальовуємо графік
    const engine = new TimelineEngine({
        scheduleData: scheduleData,
        scheduleString: scheduleString,
        selectedGroup: selectedGroup,
        groups: groups,
        demoMode: demoMode,
        isAllClearDay: isAllClearDay
    });
    
    window.activeEngine = engine;
    engine.init();

    // Якщо користувач під час свайпу вже тримає певну годину, примусово відновлюємо її
    setTimeout(() => {
        if (hasInteractedWithScrubber && savedScrubberValue !== null) {
            const scrubber = document.getElementById('timeline-scrubber');
            if (scrubber) {
                engine.stopAutoUpdate(); // Зупиняємо автострибок до Now
                scrubber.value = savedScrubberValue;
                engine.scrubberInteracted = true;
                if (engine.preview) engine.preview.classList.remove('preview-off');
                engine.updateScrubberPreview();
            }
        }
    }, 50);

    // Оновлення Hero UI (колір картки, таймер)
    updateHeroUI(selectedGroup, now, isAllClearDay, demoMode, scheduleString);
}

function updateHeroUI(selectedGroup, now, isAllClear, demoMode, scheduleString) {
    const heroCard = document.getElementById('smart-hero');
    const heroTitle = document.getElementById('hero-title');
    const heroSubtitle = document.getElementById('hero-subtitle');
    const countdownEl = document.getElementById('hero-countdown');
    const heroIconImg = document.getElementById('hero-icon-3d');

    if (isAllClear) {
        if (heroCard) {
            heroCard.style.setProperty('--hero-color', '#34C759'); // System Green
            heroCard.style.setProperty('--hero-glow', 'rgba(52, 199, 89, 0.15)');
        }
        if(heroTitle) heroTitle.textContent = 'Відключень немає';
        if(countdownEl) countdownEl.textContent = '🎉';
        if(heroSubtitle) heroSubtitle.textContent = 'Насолоджуйтесь світлом!';
        
        if (heroIconImg) {
            heroIconImg.src = 'assets/power_on.png';
            heroIconImg.style.transform = 'scale(0.9)';
            setTimeout(() => { if(heroIconImg) heroIconImg.style.transform = 'scale(1)' }, 100);
        }
        return;
    }

    // Для графіка з відключеннями вираховуємо поточний стан:
    const currentHour = now.getHours();
    const groupIndex = groups.indexOf(selectedGroup);
    let isCurrentlyOn = true;
    let nextChangeHour = 24;

    if (scheduleString && scheduleString.length === 24) {
        // Використовуємо реальний графік з API або моку
        isCurrentlyOn = scheduleString[currentHour] === '1';
        for (let i = currentHour + 1; i <= 24; i++) {
            if (i === 24) { nextChangeHour = 24; break; }
            if ((scheduleString[i] === '1') !== isCurrentlyOn) {
                nextChangeHour = i;
                break;
            }
        }
    } else if (demoMode) {
        // 5 hours OFF, 5 hours ON pattern shifted
        isCurrentlyOn = !((currentHour + groupIndex) % 10 < 5);
        for (let i = currentHour + 1; i <= 24; i++) {
            if (i === 24) { nextChangeHour = 24; break; }
            const stateAtHour = !((i + groupIndex) % 10 < 5);
            if (stateAtHour !== isCurrentlyOn) { nextChangeHour = i; break; }
        }
    } else {
        // Original logic for production fallback
        isCurrentlyOn = !((currentHour + groupIndex * 2) % 6 < 3);
        for (let i = currentHour + 1; i <= 24; i++) {
            if (i === 24) { nextChangeHour = 24; break; }
            const stateAtHour = !((i + groupIndex * 2) % 6 < 3);
            if (stateAtHour !== isCurrentlyOn) { nextChangeHour = i; break; }
        }
    }

    const color = isCurrentlyOn ? '#FF9500' : '#FF9500'; // Standardized to theme orange
    const glow = isCurrentlyOn ? 'rgba(255, 149, 0, 0.15)' : 'rgba(255, 149, 0, 0.15)';
    const statusIcon = isCurrentlyOn ? 'assets/power_on.png' : 'assets/power_off.png';

    if (heroCard) {
        heroCard.style.setProperty('--hero-color', color);
        heroCard.style.setProperty('--hero-glow', glow);
    }

    if (heroIconImg && heroIconImg.src !== statusIcon) {
        heroIconImg.style.transform = 'scale(0.8)';
        setTimeout(() => {
            heroIconImg.src = statusIcon;
            heroIconImg.style.transform = 'scale(1)';
        }, 150);
    }

    if(heroTitle) heroTitle.textContent = isCurrentlyOn ? 'Світло є' : 'Світла немає';

    // Timer calculation
    const nextChangeTime = new Date();
    nextChangeTime.setHours(nextChangeHour, 0, 0, 0);
    
    if (countdownEl) {
        // A simple quick static timer injection. True timer requires setInterval.
        // We trigger it initially.
        const updateCountdown = () => {
            const nowTime = new Date().getTime();
            const diff = nextChangeTime.getTime() - nowTime;
            if (diff <= 0) {
                // Should re-render UI, let's just refresh page simply
                window.location.reload(); 
                return;
            }
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            let text = '';
            if (hours > 0) text += `${hours} год `;
            text += `${mins} хв`;
            countdownEl.textContent = text;
        };
        updateCountdown();
        
        // Save interval so we can clear it if needed
        if(window.heroTimerInterval) clearInterval(window.heroTimerInterval);
        window.heroTimerInterval = setInterval(updateCountdown, 60000);
    }
    
    if(heroSubtitle) {
        const h = nextChangeTime.getHours();
        const m = nextChangeTime.getMinutes().toString().padStart(2, '0');
        heroSubtitle.textContent = `До ${h}:${m}`;
    }
}

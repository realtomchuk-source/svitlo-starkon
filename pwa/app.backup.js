document.addEventListener('DOMContentLoaded', () => {
    console.log('Svitlo-Starkon PWA Initialized');

    const DATA_URL = './data/unified_schedules.json';

    const groups = ['1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2', '5.1', '5.2', '6.1', '6.2'];

    let selectedGroup = localStorage.getItem('sssk_group') || '1.1';
    let scheduleData = null;

    // --- UI Elements ---
    const overlay = document.getElementById('overlay');
    const changeGroupBtn = document.getElementById('btn-change-group');
    const closeSheetBtn = document.getElementById('btn-close-sheet');

    // --- Tab Navigation ---
    const views = {
        home: document.getElementById('home-view'),
        schedule: document.getElementById('schedule-view'),
        settings: document.getElementById('settings-view')
    };

    let userSubscriptions = JSON.parse(localStorage.getItem('sssk_subscriptions')) || [
        { id: Date.now(), name: 'Мій Дім', group: '1.1', notify5: true, notify15: true }
    ];

    // --- Initialization ---

    function initGroupButtons() {
        renderGroupCarousel();
        // renderCabinet();
    }

    function renderGroupCarousel() {
        const carousel = document.getElementById('group-carousel');
        if (!carousel) return;

        carousel.innerHTML = '';
        groups.forEach(group => {
            const pill = document.createElement('button');
            pill.className = `carousel-pill ${group === selectedGroup ? 'active' : ''}`;
            pill.textContent = group;
            pill.onclick = (e) => selectGroup(group, e.target);
            carousel.appendChild(pill);

            if (group === selectedGroup) {
                centerActivePill(pill);
            }
        });
    }


    function centerActivePill(pill) {
        const carousel = document.getElementById('group-carousel');
        if (!carousel || !pill) return;

        setTimeout(() => {
            const containerWidth = carousel.offsetWidth;
            const pillOffset = pill.offsetLeft;
            const pillWidth = pill.offsetWidth;
            carousel.scrollLeft = pillOffset - (containerWidth / 2) + (pillWidth / 2);
        }, 100);
    }

    function selectGroup(group, targetElement = null) {
        selectedGroup = group;
        localStorage.setItem('sssk_group', group);
        initGroupButtons();
        if (scheduleData) renderUI();

        if (targetElement) {
            centerActivePill(targetElement);
        }

        closeSheet(); // Still keep bottom sheet for quick grid choice if needed
    }

    function openSheet() {
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden'; // Stop scroll
    }

    function closeSheet() {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    async function fetchData() {
        try {
            const response = await fetch(DATA_URL);
            if (!response.ok) throw new Error('Data not found');
            const fullData = await response.json();

            // Map array to object by date for faster lookup
            scheduleData = {};
            fullData.forEach(entry => {
                const d = entry.target_date;
                if (d) scheduleData[d] = entry;
            });

            renderUI();
        } catch (error) {
            console.error('Fetch error:', error);
            const heroTitle = document.getElementById('hero-title');
            if (heroTitle) heroTitle.textContent = 'Помилка доступу (CORS)';
            const heroSubtitle = document.getElementById('hero-subtitle');
            if (heroSubtitle) heroSubtitle.textContent = 'Відкрийте через Live Server';
            
            // Render at least the ruler/ticks so the design doesn't look empty
            renderTimeline('', new Date());
        }
    }

    function updateHeroUI(isCurrentlyOn, nextChangeTime, isAllClear) {
        const heroCard = document.getElementById('smart-hero');
        const heroTitle = document.getElementById('hero-title');
        const heroSubtitle = document.getElementById('hero-subtitle');
        const groupTitle = document.getElementById('hero-group-title');

        if (groupTitle) groupTitle.textContent = 'ЧЕРГА ' + selectedGroup;

        const dateDisplay = document.getElementById('current-date-display');
        if (dateDisplay) {
            const dateToUse = window.isTomorrowView ?
                new Date(new Date().getTime() + 24 * 60 * 60 * 1000) :
                new Date();
            const options = { weekday: 'long', day: 'numeric', month: 'long' };
            const formattedDate = dateToUse.toLocaleDateString('uk-UA', options);
            dateDisplay.textContent = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
        }

        if (isAllClear) {
            if (heroCard) {
                heroCard.style.setProperty('--hero-color', '#34C759'); // System Green
                heroCard.style.setProperty('--hero-glow', 'rgba(52, 199, 89, 0.15)');
            }
            if(heroTitle) heroTitle.textContent = 'Відключень немає';
            const countdownEl = document.getElementById('hero-countdown');
            if(countdownEl) countdownEl.textContent = '🎉';
            if(heroSubtitle) heroSubtitle.textContent = 'Насолоджуйтесь світлом!';
            
            // Включаємо іконку світла в центрі
            const heroIconImg = document.getElementById('hero-icon-3d');
            if (heroIconImg) {
                heroIconImg.src = 'assets/power_on.png';
                heroIconImg.style.transform = 'scale(0.9)';
                setTimeout(() => { if(heroIconImg) heroIconImg.style.transform = 'scale(1)' }, 100);
            }
            
            // Оновлюємо повзунок до поточного часу навіть у дні без відключень
            window.isAllClearDay = true;
            const scrubber = document.getElementById('timeline-scrubber');
            if (scrubber && !window.scrubberInteracted && !window.isTomorrowView) {
                const now = new Date();
                const totalMins = now.getHours() * 60 + now.getMinutes();
                scrubber.value = Math.floor(totalMins / 5);
                if (typeof window.updateScrubberPreview === 'function') {
                    window.updateScrubberPreview();
                }
            }
            return;
        }

        const color = isCurrentlyOn ? '#FF9500' : '#007AFF'; // System Orange / System Blue
        const glow = isCurrentlyOn ? 'rgba(255, 149, 0, 0.15)' : 'rgba(0, 122, 255, 0.15)';
        const statusIcon = isCurrentlyOn ? 'assets/power_on.png' : 'assets/power_off.png';
        const title = isCurrentlyOn ? 'Світло є' : 'Світла немає';

        if (heroCard) {
            heroCard.style.setProperty('--hero-color', color);
            heroCard.style.setProperty('--hero-glow', color);
        }

        const heroIconImg = document.getElementById('hero-icon-3d');
        if (heroIconImg) {
            heroIconImg.src = statusIcon;
            heroIconImg.style.transform = 'scale(0.9)';
            setTimeout(() => { if(heroIconImg) heroIconImg.style.transform = 'scale(1)' }, 100);
        }

        if (heroTitle) heroTitle.textContent = title;

        // Force hide Tomorrow Button per user request
        const btnTomorrow = document.getElementById('btn-show-tomorrow');
        if (btnTomorrow) {
            btnTomorrow.classList.add('hidden');
        }

        // --- TOMORROW SPECIFIC MODULE (tomorrow.js) ---
        if (typeof window.TomorrowOverride === 'function') {
            window.TomorrowOverride();
            return; // Exit early, no live timer for tomorrow needed yet
        }

        // Start Countdown Timer
        if (window.countdownInterval) clearInterval(window.countdownInterval);

        function updateTimer() {
            const now = new Date();
            const diff = nextChangeTime - now;

            const countdownEl = document.getElementById('hero-countdown');
            if (diff <= 0) {
                if(countdownEl) countdownEl.textContent = "Оновлення...";
                clearInterval(window.countdownInterval);
                fetchData(); // Refresh state
                return;
            }

            const h = Math.floor(diff / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

            const displayH = h > 0 ? `${h} год ` : '';
            const displayM = `${m.toString().padStart(2, '0')} хв`;

            if(countdownEl) countdownEl.textContent = displayH + displayM;
            if(heroSubtitle) heroSubtitle.textContent = isCurrentlyOn ? 'до відключення' : 'до увімкнення';

            const scrubber = document.getElementById('timeline-scrubber');
            if (scrubber && !window.scrubberInteracted && !window.isTomorrowView) {
                const totalMins = now.getHours() * 60 + now.getMinutes();
                scrubber.value = Math.floor(totalMins / 5);
                if (typeof window.updateScrubberPreview === 'function') {
                    window.updateScrubberPreview();
                }
            }
        }

        updateTimer(); // Initial call
        window.countdownInterval = setInterval(updateTimer, 60000); // Update every minute
    }

    function renderUI() {
        if (!scheduleData) return;

        const now = new Date();
        let targetDate = new Date();

        // Check if we are in 'Tomorrow' view
        if (window.isTomorrowView) {
            targetDate.setDate(now.getDate() + 1);
        }

        const d = targetDate.getDate().toString().padStart(2, '0');
        const m = (targetDate.getMonth() + 1).toString().padStart(2, '0');
        const dateStr = `${d}.${m}`;
        const daySchedule = scheduleData[dateStr];
        let text = '';

        if (!daySchedule) {
            console.warn(`No schedule found for ${dateStr}. Showing fallback.`);
            // If it's today and no schedule, it might be an empty day
            if (!window.isTomorrowView) {
                // Збережено оригінальну логіку "Щасливого дня":
                // updateHeroUI(true, new Date(now.getTime() + 3600000), true);
                // return;
                
                // Замість цього активуємо ДЕМО-режим для наглядності головної сторінки:
                text = 'відключення (Демо-режим)';
            } else {
                // Tomorrow fallback: no schedule published yet
                const heroTitle = document.getElementById('hero-title');
                if(heroTitle) heroTitle.textContent = "Очікуємо графік";
                const heroIconImg = document.getElementById('hero-icon-3d');
                if (heroIconImg) heroIconImg.src = 'assets/power_on.png'; 
                
                if (typeof window.TomorrowOverride === 'function') {
                    window.TomorrowOverride();
                }
                renderTimeline('', now);
                return;
            }
        } else {
            text = daySchedule.content || daySchedule.parsed_text || '';
        }

        // --- Time Engine Logic (Mock for now) ---
        const isOffKeywords = ['відключення', 'графік', 'вимкнення'];
        const hasOutageMessage = isOffKeywords.some(key => (text || '').toString().toLowerCase().includes(key));

        const currentHour = now.getHours();

        let isCurrentlyOn = true;
        let nextChangeHour = 24;
        let isAllClear = !hasOutageMessage;

        if (hasOutageMessage) {
            const groupIndex = groups.indexOf(selectedGroup);
            // 5 hours OFF, 5 hours ON pattern shifted by 1 hour per queue
            isCurrentlyOn = !((currentHour + groupIndex) % 10 < 5);

            // Find next change
            for (let i = currentHour + 1; i <= 24; i++) {
                if (i === 24) {
                    nextChangeHour = 24;
                    break;
                }
                const stateAtHour = !((i + groupIndex) % 10 < 5);
                if (stateAtHour !== isCurrentlyOn) {
                    nextChangeHour = i;
                    break;
                }
            }
        }

        const nextChangeTime = new Date();
        nextChangeTime.setHours(nextChangeHour, 0, 0, 0);

        updateHeroUI(isCurrentlyOn, nextChangeTime, isAllClear);
        renderTimeline(text, now);
    }

    function renderTimeline(text, now = new Date()) {
        const rail = document.getElementById('ruler-rail');
        const ticksContainer = document.getElementById('ruler-ticks');
        const scrubber = document.getElementById('timeline-scrubber');

        if (!rail || !ticksContainer || !scrubber) return;

        const isOffKeywords = ['відключення', 'графік', 'вимкнення'];
        const hasOutageMessage = isOffKeywords.some(key => (text || '').toString().toLowerCase().includes(key));

        // --- 1. Generate Rail Gradient (Sharp Blocks) ---
        let gradientStops = [];
        const groupIndex = groups.indexOf(selectedGroup);
        let prevColor = null;

        for (let m = 0; m <= 1440; m += 5) {
            const h = m / 60;
            // Math.floor(h) to keep block edges sharp on the hour marks if desired, or fractional
            const isOff = hasOutageMessage ? ((Math.floor(h) + groupIndex) % 10 < 5) : false;
            const color = isOff ? '#8E8E93' : '#FF9500';
            const pos = +(m / 1440 * 100).toFixed(2);
            
            if (prevColor !== color) {
                if (prevColor !== null) {
                    gradientStops.push(`${prevColor} ${pos}%`);
                }
                gradientStops.push(`${color} ${pos}%`);
                prevColor = color;
            } else if (m === 1440) {
                gradientStops.push(`${color} ${pos}%`);
            }
        }
        rail.style.background = `linear-gradient(to right, ${gradientStops.join(', ')})`;

        // --- 2. Generate Ticks ---
        ticksContainer.innerHTML = '';
        for (let h = 0; h <= 24; h += 3) {
            const tick = document.createElement('div');
            tick.className = 'tick hour-mark';
            tick.innerHTML = `<span class="tick-label">${h}:00</span>`;
            tick.style.left = `${(h / 24) * 100}%`;
            ticksContainer.appendChild(tick);
        }
    }

    function updateScrubberPreview() {
        const scrubber = document.getElementById('timeline-scrubber');
        const preview = document.getElementById('scrubber-preview');
        if (!scrubber || !preview) return;

        const val = parseInt(scrubber.value);
        const totalMins = val * 5;
        const h = Math.floor(totalMins / 60);
        const m = Math.floor(totalMins % 60);
        const timeStr = `${h}:${m.toString().padStart(2, '0')}`;

        const groupIndex = groups.indexOf(selectedGroup);
        // Якщо сьогодні взагалі немає відключень, світло є завжди
        const isOff = window.isAllClearDay ? false : ((h + groupIndex) % 10 < 5);

        preview.classList.remove('preview-on', 'preview-off');
        preview.classList.add(isOff ? 'preview-off' : 'preview-on');

        // Consistent solid filled icons (the status is shown via color)
        const svgOn = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
        const svgOff = svgOn; // Use the same icon for both, distinction via color

        preview.innerHTML = `
            <div class="preview-status-icon">${isOff ? svgOff : svgOn}</div>
            <div class="preview-details">
                <div class="preview-time">${timeStr}</div>
                <div class="preview-msg">${isOff ? 'Світла немає' : 'Світло є'}</div>
            </div>
        `;

    }

    const scrubber = document.getElementById('timeline-scrubber');
    if (scrubber) {
        window.updateScrubberPreview = updateScrubberPreview;
        scrubber.oninput = () => {
            window.scrubberInteracted = true;
            updateScrubberPreview();
        };

        scrubber.addEventListener('change', () => {
             clearTimeout(window.scrubberTimeout);
             window.scrubberTimeout = setTimeout(() => {
                 window.scrubberInteracted = false;
                 updateScrubberPreview();
             }, 30000);
        });

        scrubber.max = 287;
    }

    // --- Interaction ---
    if (changeGroupBtn) changeGroupBtn.addEventListener('click', openSheet);
    if (closeSheetBtn) closeSheetBtn.addEventListener('click', closeSheet);
    if (overlay) overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeSheet();
    });

    // --- Swipe Gestures for Hero (Touch & Mouse) ---
    const heroCard = document.getElementById('smart-hero');
    let startX = 0;

    function handleSwipeEnd(endX) {
        const diff = startX - endX;
        const threshold = 50; // pixels

        if (Math.abs(diff) > threshold) {
            const currentIndex = groups.indexOf(selectedGroup);
            let nextIndex = currentIndex;

            if (diff > 0) { // Swipe Left -> Next
                nextIndex = (currentIndex + 1) % groups.length;
            } else { // Swipe Right -> Prev
                nextIndex = (currentIndex - 1 + groups.length) % groups.length;
            }

            selectGroup(groups[nextIndex]);

            if (heroCard) {
                heroCard.style.transform = 'scale(0.98)';
                setTimeout(() => heroCard.style.transform = '', 100);
            }
        }
    }

    if (heroCard) {
        // Touch events
        heroCard.addEventListener('touchstart', (e) => {
            startX = e.changedTouches[0].screenX;
        }, { passive: true });

        heroCard.addEventListener('touchend', (e) => {
            handleSwipeEnd(e.changedTouches[0].screenX);
        }, { passive: true });

        // Mouse events (for desktop swiping)
        heroCard.addEventListener('mousedown', (e) => {
            startX = e.screenX;
            heroCard.style.cursor = 'grabbing';
        });

        window.addEventListener('mouseup', (e) => {
            if (heroCard.style.cursor === 'grabbing') {
                heroCard.style.cursor = 'grab';
                handleSwipeEnd(e.screenX);
            }
        });

        heroCard.style.cursor = 'grab';
        heroCard.style.userSelect = 'none'; // Prevent text selection while swiping
    }

    // --- Start ---
    // Ensure we save the default if it's the first visit
    if (!localStorage.getItem('sssk_group')) {
        localStorage.setItem('sssk_group', '1.1');
    }

    initGroupButtons();
    fetchData();

    // Initialize Supabase
    if (typeof initSupabase === 'function') initSupabase();

    // Auth UI Update
    async function updateAuthState() {
        if (typeof getUserProfile !== 'function') return;
        const user = await getUserProfile();

        if (user) {
            // Update UI for logged-in user
            const nameEl = document.getElementById('user-name');
            const avatarEl = document.getElementById('user-avatar');
            const emailEl = document.getElementById('user-email');
            const authBtn = document.getElementById('btn-google-auth');

            if (nameEl) nameEl.innerHTML = `${user.user_metadata.full_name || user.email} <span class="pro-badge">Pro</span>`;
            if (avatarEl) avatarEl.src = user.user_metadata.avatar_url;
            if (emailEl) emailEl.textContent = user.email;

            if (authBtn) {
                authBtn.textContent = "Вийти з акаунта";
                authBtn.classList.add('btn-danger-text');
                authBtn.onclick = signOut;
            }
        }
    }

    updateAuthState();

    // Google Auth Button
    const btnGoogleAuth = document.getElementById('btn-google-auth');
    if (btnGoogleAuth && typeof signInWithGoogle === 'function') {
        const currentOnclick = btnGoogleAuth.onclick;
        btnGoogleAuth.onclick = async () => {
            const user = await getUserProfile();
            if (!user) {
                await signInWithGoogle();
            } else if (currentOnclick) {
                currentOnclick();
            }
        };
    }



    // Update background date decor
    const bgDateDecor = document.getElementById('bg-date-decor');
    if (bgDateDecor) {
        const now = new Date();
        const d = now.getDate().toString().padStart(2, '0');
        const m = (now.getMonth() + 1).toString().padStart(2, '0');
        bgDateDecor.textContent = `${d}.${m}`;
    }

    // Logic for Cabinet page (if current page)
    if (document.body.classList.contains('page-cabinet')) {
        renderCabinet();

        const btnAddLocation = document.getElementById('btn-add-location');
        if (btnAddLocation) {
            btnAddLocation.onclick = () => {
                const overlay = document.getElementById('overlay');
                if (overlay) overlay.style.display = 'flex';
            };
        }
    }


/* ==========================================================================
   Push Notification Wizard Logic (Cabinet)
   ========================================================================== */
if (window.isCabinetView) {
    const wizardOverlay = document.getElementById('push-wizard-overlay');
    const wizardSheet = document.getElementById('push-wizard-sheet');
    const bgCloseHandle = wizardOverlay; // Clicking outside
    
    // Steps
    const step1 = document.getElementById('wizard-step-1');
    const step2 = document.getElementById('wizard-step-2');
    const step3 = document.getElementById('wizard-step-3');
    
    // Headers & Buttons
    const wizardTitle = document.getElementById('wizard-title');
    const wizardSubtitle = document.getElementById('wizard-subtitle');
    const btnNext = document.getElementById('btn-wizard-next');
    const btnBack = document.getElementById('btn-wizard-back');
    const btnAddLocation = document.getElementById('btn-add-location');
    
    // State
    let currentStep = 1;
    let wizardConfig = {
        queueId: null,
        notifyTime: 15,
        powerOn: true
    };
    
    // Mock groups for the wizard
    const groups = [
        { id: '1.1', name: 'Черга 1.1' }, { id: '1.2', name: 'Черга 1.2' },
        { id: '2.1', name: 'Черга 2.1' }, { id: '2.2', name: 'Черга 2.2' },
        { id: '3.1', name: 'Черга 3.1' }, { id: '3.2', name: 'Черга 3.2' },
        { id: '4.1', name: 'Черга 4.1' }, { id: '4.2', name: 'Черга 4.2' },
        { id: '5.1', name: 'Черга 5.1' }, { id: '5.2', name: 'Черга 5.2' },
        { id: '6.1', name: 'Черга 6.1' }, { id: '6.2', name: 'Черга 6.2' }
    ];

    function openWizard() {
        // Reset state
        currentStep = 1;
        wizardConfig.queueId = null;
        updateWizardUI();
        
        wizardOverlay.style.display = 'flex';
        // Force reflow
        void wizardOverlay.offsetWidth;
        wizardOverlay.classList.add('active');
        wizardSheet.classList.add('active');
    }

    function closeWizard() {
        wizardOverlay.classList.remove('active');
        wizardSheet.classList.remove('active');
        setTimeout(() => {
            wizardOverlay.style.display = 'none';
        }, 400); // Wait for transition
    }

    // Inject Queue Buttons for Step 1
    const wizardGroupGrid = document.getElementById('wizard-group-grid');
    if (wizardGroupGrid) {
        groups.forEach(group => {
            const btn = document.createElement('button');
            btn.className = 'group-btn glass-card';
            btn.textContent = group.name;
            btn.onclick = () => {
                // Remove active from all
                Array.from(wizardGroupGrid.children).forEach(cb => cb.classList.remove('active'));
                btn.classList.add('active');
                wizardConfig.queueId = group.id;
            };
            wizardGroupGrid.appendChild(btn);
        });
    }

    function updateWizardUI() {
        // Hide all steps
        step1.style.display = 'none';
        step2.style.display = 'none';
        step3.style.display = 'none';
        
        // Show specific UI per step
        if (currentStep === 1) {
            step1.style.display = 'block';
            wizardTitle.textContent = 'Налаштуймо сповіщення';
            wizardSubtitle.textContent = 'Крок 1 з 3';
            btnBack.style.display = 'none';
            btnNext.textContent = 'Далі';
        } else if (currentStep === 2) {
            step2.style.display = 'block';
            wizardTitle.textContent = 'Час сповіщення';
            wizardSubtitle.textContent = 'Крок 2 з 3';
            btnBack.style.display = 'block';
            btnNext.textContent = 'Далі';
        } else if (currentStep === 3) {
            step3.style.display = 'block';
            wizardTitle.textContent = 'Фінальні штрихи';
            wizardSubtitle.textContent = 'Крок 3 з 3';
            btnBack.style.display = 'block';
            btnNext.textContent = 'Зберегти';
        }
    }

    if (btnNext) {
        btnNext.addEventListener('click', () => {
            if (currentStep === 1) {
                if (!wizardConfig.queueId) {
                    alert('Будь ласка, оберіть чергу');
                    return;
                }
                currentStep = 2;
                updateWizardUI();
            } else if (currentStep === 2) {
                // Grab radio value
                const selectedTime = document.querySelector('input[name="notify_time"]:checked');
                if (selectedTime) wizardConfig.notifyTime = selectedTime.value;
                currentStep = 3;
                updateWizardUI();
            } else if (currentStep === 3) {
                // Grab toggle value
                wizardConfig.powerOn = document.getElementById('wizard-power-on').checked;
                // Add card logic goes here (mock logic for demo)
                addNewCardToUI(wizardConfig);
                closeWizard();
            }
        });
    }

    if (btnBack) {
        btnBack.addEventListener('click', () => {
            if (currentStep > 1) {
                currentStep--;
                updateWizardUI();
            }
        });
    }

    if (btnAddLocation) {
        btnAddLocation.addEventListener('click', openWizard);
    }
    
    // Close on outside click
    if (bgCloseHandle) {
        bgCloseHandle.addEventListener('click', (e) => {
            if (e.target === bgCloseHandle) {
                closeWizard();
            }
        });
    }

    // Function to physically build a new card after wizard completes
    function addNewCardToUI(config) {
        const list = document.getElementById('subscriptions-list');
        const addButton = document.getElementById('btn-add-location');
        
        // Random house names for mock
        const mockNames = ['Офіс', 'Батьки', 'Дача', 'Гараж', 'Квартира 2'];
        const randomName = mockNames[Math.floor(Math.random() * mockNames.length)];

        const newCard = document.createElement('div');
        newCard.className = 'glass-card fade-in';
        newCard.style = 'padding: 0; overflow: hidden;';
        newCard.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: rgba(128,128,128,0.05); border-bottom: 1px solid rgba(128,128,128,0.1);">
                <div>
                    <h3 style="margin: 0; font-size: 16px; font-weight: 600;">${randomName}</h3>
                    <p class="body-neutral" style="margin: 2px 0 0 0; font-size: 13px;">Черга ${config.queueId}</p>
                </div>
                <button class="btn-location-delete" onclick="this.closest('.glass-card').remove()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/>
                    </svg>
                </button>
            </div>
            <div class="push-row">
                <span style="font-size: 14px; font-weight: 500;">За ${config.notifyTime} хв до відключення</span>
                <label class="ios-toggle">
                    <input type="checkbox" checked>
                    <span class="slider"></span>
                </label>
            </div>
            <div class="push-row">
                <span style="font-size: 14px; font-weight: 500;">Коли світло з'явилося</span>
                <label class="ios-toggle">
                    <input type="checkbox" ${config.powerOn ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
            </div>
        `;
        
        // Insert right before the 'Add Location' button
        list.insertBefore(newCard, addButton);
    }
}

    /* ==========================================================================
       Archive Module Engine
       ========================================================================== */
    if (window.isArchiveView) {
        console.log('Archive: Initializing module...');
        let archiveDate = new Date();
        const monthNames = ["Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень", "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"];

        function renderArchiveCalendar() {
            const grid = document.getElementById('calendar-grid');
            const title = document.getElementById('current-month-year');
            if (!grid || !title) return;

            grid.innerHTML = '';
            title.textContent = `${monthNames[archiveDate.getMonth()]} ${archiveDate.getFullYear()}`;

            const year = archiveDate.getFullYear();
            const month = archiveDate.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const firstDay = new Date(year, month, 1).getDay();
            let startOffset = (firstDay === 0) ? 6 : firstDay - 1;

            for (let i = 0; i < startOffset; i++) {
                const empty = document.createElement('div');
                empty.className = 'calendar-day dimmed';
                grid.appendChild(empty);
            }

            for (let d = 1; d <= daysInMonth; d++) {
                const dayEl = document.createElement('div');
                dayEl.className = 'calendar-day';
                dayEl.textContent = d;
                
                if (archiveDate.getMonth() === new Date().getMonth() && d === new Date().getDate()) {
                    dayEl.classList.add('today');
                }
                
                dayEl.onclick = () => selectArchiveDate(d);
                grid.appendChild(dayEl);
            }
        }

        function selectArchiveDate(day) {
            const days = document.querySelectorAll('.calendar-day');
            days.forEach(el => el.classList.remove('active'));
            
            const dayEls = Array.from(days).filter(el => el.textContent == day && !el.classList.contains('dimmed'));
            if (dayEls[0]) dayEls[0].classList.add('active');

            const monthStr = (archiveDate.getMonth() + 1).toString().padStart(2, '0');
            const dayNamesLong = ["січня", "лютого", "березня", "квітня", "травня", "червня", "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"];
            
            const titleEl = document.getElementById('archive-date-title');
            if (titleEl) titleEl.textContent = `${day} ${dayNamesLong[archiveDate.getMonth()]}`;
            const resultsEl = document.getElementById('archive-results');
            if (resultsEl) resultsEl.style.display = 'block';

            renderArchiveAccordions(`${day.toString().padStart(2, '0')}.${monthStr}`);
        }

        function renderArchiveAccordions(dateStr) {
            const container = document.getElementById('queue-accordions');
            if (!container) return;
            container.innerHTML = '';

            for (let g = 1; g <= 6; g++) {
                const accordion = document.createElement('div');
                accordion.className = 'archive-accordion glass-card';
                accordion.innerHTML = `
                    <div class="accordion-header">
                        <span>Група ${g}</span>
                        <svg class="accordion-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </div>
                    <div class="accordion-content">
                        ${renderMiniSliderRow(g + '.1', dateStr)}
                        ${renderMiniSliderRow(g + '.2', dateStr)}
                    </div>
                `;

                accordion.querySelector('.accordion-header').onclick = () => {
                    const isOpen = accordion.classList.contains('open');
                    document.querySelectorAll('.archive-accordion').forEach(a => a.classList.remove('open'));
                    if (!isOpen) accordion.classList.add('open');
                };

                container.appendChild(accordion);
            }
            initMiniSliderInteractions();
        }

        function renderArchiveAccordions(dateStr) {
            const container = document.getElementById('queue-accordions');
            if (!container) return;
            container.innerHTML = '';

            for (let g = 1; g <= 6; g++) {
                const accordion = document.createElement('div');
                accordion.className = 'archive-accordion glass-card';
                accordion.innerHTML = `
                    <div class="accordion-header">
                        <span>Група ${g}</span>
                        <svg class="accordion-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </div>
                    <div class="accordion-content">
                        ${renderMiniSliderRow(g + '.1', dateStr)}
                        ${renderMiniSliderRow(g + '.2', dateStr)}
                    </div>
                `;

                accordion.querySelector('.accordion-header').onclick = () => {
                    const isOpen = accordion.classList.contains('open');
                    document.querySelectorAll('.archive-accordion').forEach(a => a.classList.remove('open'));
                    if (!isOpen) accordion.classList.add('open');
                };

                container.appendChild(accordion);
            }
            initMiniSliderInteractions();
        }

        function renderMiniSliderRow(queueId, dateStr) {
            let segmentsHtml = '';
            const pattern = (parseInt(queueId) % 2 === 0) ? [0, 6, 9, 15, 18, 24] : [0, 3, 9, 12, 18, 21, 24];
            for (let i = 0; i < pattern.length - 1; i++) {
                const width = ((pattern[i+1] - pattern[i]) / 24) * 100;
                const type = (i % 2 === 0) ? 'on' : 'off';
                segmentsHtml += `<div class="mini-slider-segment ${type}" style="left: ${(pattern[i]/24)*100}%; width: ${width}%;"></div>`;
            }

            return `
                <div class="mini-slider-row">
                    <div class="mini-slider-label">Черга ${queueId}</div>
                    <div class="mini-slider-track" data-queue="${queueId}">${segmentsHtml}</div>
                </div>
            `;
        }

        function initMiniSliderInteractions() {
            const tracks = document.querySelectorAll('.mini-slider-track');
            const tooltip = document.getElementById('mini-scrubber-tooltip');
            const tTime = document.getElementById('tooltip-time');
            const tStatus = document.getElementById('tooltip-status');

            tracks.forEach(track => {
                const handleMove = (e) => {
                    const rect = track.getBoundingClientRect();
                    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
                    const percent = Math.max(0, Math.min(1, x / rect.width));
                    const totalMinutes = percent * 1440;
                    const h = Math.floor(totalMinutes / 60);
                    const m = Math.floor(totalMinutes % 60);
                    
                    if (tooltip) {
                        tooltip.style.display = 'flex';
                        tooltip.style.left = (e.touches ? e.touches[0].clientX : e.clientX) + 'px';
                        tooltip.style.top = rect.top + 'px';
                    }
                    if (tTime) tTime.textContent = `${h}:${m.toString().padStart(2, '0')}`;
                    const isOff = Math.floor(h / 3) % 2 === 1; 
                    if (tStatus) {
                        tStatus.textContent = isOff ? 'Світла немає' : 'Світло є';
                        tStatus.style.color = isOff ? '#8E8E93' : '#FF9500';
                    }
                };
                track.addEventListener('mousemove', handleMove);
                track.addEventListener('touchstart', handleMove, {passive: false});
                if (tooltip) {
                    track.addEventListener('mouseleave', () => tooltip.style.display = 'none');
                    track.addEventListener('touchend', () => tooltip.style.display = 'none');
                }
            });
        }

        renderArchiveCalendar();
        
        const btnPrev = document.getElementById('btn-prev-month');
        if (btnPrev) btnPrev.onclick = () => {
            archiveDate.setMonth(archiveDate.getMonth() - 1);
            renderArchiveCalendar();
        };
        
        const btnNext = document.getElementById('btn-next-month');
        if (btnNext) btnNext.onclick = () => {
            archiveDate.setMonth(archiveDate.getMonth() + 1);
            renderArchiveCalendar();
        };

        const today = new Date();
        if (archiveDate.getMonth() === today.getMonth()) selectArchiveDate(today.getDate());
    }
});

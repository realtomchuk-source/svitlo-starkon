import { fetchScheduleData } from '../modules/api.js';
import { UserService } from '../modules/user/user-service.js';
import { ReferralSystem } from '../modules/user/referral-system.js';
import { AnalyticsEngine } from '../modules/user/analytics-engine.js';

// --- State Management ---
let subscriptions = [];
let currentPickerSlot = null; // null for Start Group card, index for notification slots
let activeSlotIndex = null;

// --- Services ---
let userService, referralSystem, analytics;

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Cabinet Session Started (Legacy Subscriptions Mode)');

    try {
        // Initialize Domain Services (Stubs or real provided by window.supabase)
        userService = new UserService();
        await userService.init();
        
        referralSystem = new ReferralSystem(userService);
        analytics = new AnalyticsEngine(userService);

        // Track referral if present in URL
        referralSystem.trackReferral();
    } catch (error) {
        console.error('Service initialization error:', error);
        // Ensure services exist even if init failed
        if (!userService) userService = new UserService(window.supabase);
        if (!referralSystem) referralSystem = new ReferralSystem(userService);
        if (!analytics) analytics = new AnalyticsEngine(userService);
    }
    
    if (userService) {
        await referralSystem.syncPendingReferral();
    }

    initStartConfig();
    renderCabinet();
    initTomorrowPush();
    initWizard();
    initFeedback();
    updateAuthState();

    // Log visit
    analytics.logEvent('page_view', { page: 'cabinet' });
});

/* ==========================================================================
   Auth & Profile Card Logic
   ========================================================================== */

        // Display Local Autonomous Profile
        profileSlot.innerHTML = `
            <div class="profile-card-premium guest-active" style="display: flex !important; flex-direction: row !important; align-items: center !important; padding: 12px !important; gap: 14px !important; overflow: hidden !important; height: 140px !important; min-height: 140px !important;">
                <div class="avatar-square-v10" style="width: 116px !important; height: 116px !important; border-radius: 20px !important; background: rgba(255,149,0,0.15) !important; display: flex !important; align-items: center; justify-content: center; flex-shrink: 0 !important; border: 1.5px solid rgba(255,149,0,0.3) !important;">
                    <i class="fas fa-robot" style="font-size: 48px; color: var(--system-accent);"></i>
                </div>
                <div style="flex: 1 !important; display: flex !important; flex-direction: column !important; justify-content: center !important; height: 116px !important; padding: 2px 0 !important;">
                    <div style="font-family: 'Outfit', sans-serif !important; font-weight: 850 !important; color: var(--system-accent) !important; font-size: 24px !important; margin-bottom: 2px !important; letter-spacing: -0.8px !important; line-height: 1.2 !important;">Локальний режим</div>
                    <div style="font-family: 'Inter', sans-serif !important; font-size: 13px !important; color: white !important; font-weight: 600 !important; opacity: 0.8 !important;">Дані зберігаються лише на цьому пристрої</div>
                </div>
            </div>
        `;
        renderTomorrowPushCard();
    } catch (e) {
        console.error("Auth update error:", e);
    }
}

async function renderLeaderboard() {
    const list = document.getElementById('leaderboard-list');
    if (!list) return;
    list.innerHTML = '<div style="font-size: 12px; text-align: center; opacity: 0.5; padding: 10px;">Локальний режим: таблиця лідерів тимчасово недоступна.</div>';
}

/* ==========================================================================
   Cabinet Logic
   ========================================================================== */

window.renderCabinet = function() {
    let rawSubs = JSON.parse(localStorage.getItem('sssk_subscriptions')) || [];
    // Ensure we have at least 2 slots
    let userSubscriptions = [{}, {}];
    if (Array.isArray(rawSubs)) {
        if (rawSubs[0]) userSubscriptions[0] = rawSubs[0];
        if (rawSubs[1]) userSubscriptions[1] = rawSubs[1];
    }
    
    subscriptions = userSubscriptions; 
    window.userSubscriptions = userSubscriptions;
    
    // 1. (Removed Start Queue Card rendering)
    // renderStartQueueRow(); 

    // 2. Render Slots (Manual Loop to target Slot 0 and Slot 1 specifically)
    const dnd = JSON.parse(localStorage.getItem('sssk_dnd_settings')) || { active: true, start: '22:00', end: '08:00' };

    for (let i = 0; i < 2; i++) {
        const slotEl = document.getElementById(`slot-${i}`);
        if (!slotEl) continue;

        const sub = userSubscriptions[i];
        const isActive = sub && sub.active === true;
        
        // Reset and Apply Base Card Styles
        slotEl.className = `slot-card ${isActive ? 'active' : 'empty'} fade-in`;
        slotEl.onclick = () => window.openCustomPushSetup(i);
        slotEl.style.border = '';
        slotEl.style.background = '';
        slotEl.style.boxShadow = '';
        slotEl.style.opacity = '';
        slotEl.style.padding = ''; 

        if (isActive) {
            const locationName = sub.locationName || 'Хата';
            const subqueue = sub.group || '1.1';
            const notifyTime = sub.notifyTime || 5;
            const isDndActive = dnd.active !== false;
            let dndText = !isDndActive ? 'Без не турбувати' : `з ${dnd.start} до ${dnd.end}`;

            slotEl.innerHTML = `
                <div style="display: flex; flex-direction: column; width: 100%; height: 100%; position: relative; font-family: 'Inter', sans-serif;">
                    <!-- Top Metadata Row -->
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                        <span style="font-family: 'Outfit', sans-serif; font-weight: 900; font-size: 16.5px; color: #000000; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; letter-spacing: -0.5px;">${locationName}</span>
                        <span style="font-family: 'Outfit', sans-serif; font-size: 10.5px; font-weight: 800; background: var(--system-accent); color: #ffffff; padding: 2px 9px; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.4px;">${subqueue}</span>
                    </div>
                    
                    <!-- Notification Timing Info -->
                    <div style="font-size: 13px; font-weight: 800; color: var(--matte-dark-grey); opacity: 0.9; display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-family: 'Inter', sans-serif;">
                        <i class="fas fa-bell" style="color: var(--system-accent); font-size: 14px;"></i>
                        за ${notifyTime} хв
                    </div>
                    
                    <!-- DND Status Row -->
                    <div style="font-size: 12.5px; font-weight: 750; color: #8E8E93; margin-top: auto; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-clock" style="font-size: 13px; opacity: 0.7;"></i>
                        ${dndText}
                    </div>
                </div>
            `;
        } else {
            // Inactive State Template (Unified for Slot 0 and Slot 1)
            slotEl.style.border = '1.5px dashed rgba(128,128,128,0.3)';
            slotEl.style.background = 'rgba(128,128,128,0.03)';
            slotEl.innerHTML = `
                <div style="display: flex; flex-direction: column; width: 100%; height: 100%; position: relative; font-family: 'Inter', sans-serif; opacity: 0.5;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                        <span style="font-weight: 950; font-size: 16.5px; color: #374151; letter-spacing: -0.3px;">Локація</span>
                        <span style="font-size: 11px; font-weight: 900; background: rgba(128,128,128,0.15); color: #374151; padding: 4px 10px; border-radius: 9px; opacity: 0.8;">Підчерга 1.1</span>
                    </div>
                    <div style="font-size: 13px; font-weight: 700; color: #374151; opacity: 0.6; display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                        <i class="fas fa-bell" style="font-size: 14px;"></i>
                        за 10 хв
                    </div>
                    <div style="font-size: 13px; font-weight: 750; color: #374151; opacity: 0.6; margin-top: auto; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-clock" style="font-size: 13px;"></i>
                        з 22:00 до 08:00
                    </div>
                </div>
            `;
        }
    }

    // 4. Render DND Summary Row Header (Below Slots)
    const dndContainer = document.getElementById('dnd-summary-container');
    if (dndContainer) {
        if (userSubscriptions.length > 0) {
            const isDndActive = dnd.active !== false;
            const btnBase = `cursor: pointer; padding: 4px 10px; border-radius: 7px; font-family: monospace; font-weight: 900; font-size: 12.5px; border: none; transition: all 0.2s;`;
            const timeStyleActive = `background: rgba(238,114,33,0.12); color: #ee7221;`;
            const timeStyleInactive = `background: rgba(128,128,128,0.08); color: var(--system-text); opacity: 0.6;`;
            const timeStyle = isDndActive ? timeStyleActive : timeStyleInactive;

            dndContainer.innerHTML = `
                <div class="dnd-summary-row" style="display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; margin-top: 14px; border-top: 1px solid rgba(128,128,128,0.1);">
                    <div style="font-size: 13px; font-weight: 750; opacity: 0.6; color: var(--system-text); letter-spacing: -0.3px;">Сповіщення про зміни графіків.</div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 12.5px; font-weight: 750; opacity: 0.8; color: var(--system-text);">DND</span>
                        <button onclick="window.openDNDSettings()" style="${btnBase} ${timeStyle}">${dnd.start}</button>
                        <span style="opacity: 0.4;">—</span>
                        <button onclick="window.openDNDSettings()" style="${btnBase} ${timeStyle}">${dnd.end}</button>
                        
                        <div class="premium-action-btn ${isDndActive ? 'deactivate' : 'activate'}" 
                             onclick="window.toggleDNDStatus()" 
                             style="margin-left: 10px; min-height: 34px; padding: 0 15px; font-size: 12.5px; font-weight: 900; cursor: pointer; display: flex; align-items: center; justify-content: center; border-radius: 10px;">
                            <span>${isDndActive ? 'ВИМК' : 'УВІМК'}</span>
                        </div>
                    </div>
                </div>
            `;
        } else {
            dndContainer.innerHTML = '';
        }
    }
}


function openDNDSettings() {
    const overlay = document.getElementById('dnd-settings-overlay');
    if (overlay) {
        overlay.style.display = 'flex';
        setTimeout(() => overlay.classList.add('active'), 10);
    }
}

function closeDNDSettings() {
    const overlay = document.getElementById('dnd-settings-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        setTimeout(() => overlay.style.display = 'none', 300);
    }
}

function saveDNDSettings() {
    const start = document.getElementById('dnd-start-time').value;
    const end = document.getElementById('dnd-end-time').value;
    let dnd = JSON.parse(localStorage.getItem('sssk_dnd_settings')) || { active: true, start: '22:00', end: '08:00' };
    
    // If values changed, set to pendingConfirm
    if (dnd.start !== start || dnd.end !== end) {
        dnd.pendingConfirm = true;
    }
    
    dnd.start = start;
    dnd.end = end;
    
    localStorage.setItem('sssk_dnd_settings', JSON.stringify(dnd));
    closeDNDSettings();
    renderCabinet();
}

function toggleDNDStatus() {
    let dnd = JSON.parse(localStorage.getItem('sssk_dnd_settings')) || { active: false, start: '22:00', end: '08:00' };
    
    const isActive = dnd.active !== false;
    const isPending = dnd.pendingConfirm === true;
    
    if (!isActive) {
        // State 1 -> State 2/3 (Activate -> Active)
        dnd.active = true;
        dnd.pendingConfirm = false; // Fresh activation
    } else if (isPending) {
        // State 2 -> State 3 (Confirm -> Fixed)
        dnd.pendingConfirm = false;
    } else {
        // State 3 -> State 1 (Deactivate -> Activate)
        dnd.active = false;
        dnd.pendingConfirm = false;
    }
    
    localStorage.setItem('sssk_dnd_settings', JSON.stringify(dnd));
    renderCabinet();
    
    // Log analytics
    if (analytics) analytics.trackDNDToggle(dnd.active);
}

function clearDND() {
    if (confirm('Видалити налаштування режиму "Не турбувати"?')) {
        localStorage.removeItem('sssk_dnd_settings');
        renderCabinet();
    }
}

function deleteSlot(index) {
    if (!confirm('Ви впевнені, що хочете видалити це сповіщення?')) return;
    let userSubs = JSON.parse(localStorage.getItem('sssk_subscriptions')) || [];
    userSubs.splice(index, 1);
    localStorage.setItem('sssk_subscriptions', JSON.stringify(userSubs));
    renderCabinet();
}

/* ==========================================================================
   Wizard Logic
   ========================================================================== */

function openWizard(index) {
    activeSlotIndex = index;
    const overlay = document.getElementById('push-wizard-overlay');
    const sheet = document.getElementById('push-wizard-sheet');
    if (!overlay || !sheet) return;

    // Pre-fill data if editing
    let userSubscriptions = JSON.parse(localStorage.getItem('sssk_subscriptions')) || [];
    const sub = userSubscriptions[index];
    const locationInput = document.getElementById('wizard-location-name');
    if (locationInput) {
        locationInput.value = sub ? (sub.locationName || '') : '';
        locationInput.oninput = () => updateCharCounter('wizard-location-name', 'wizard-location-counter');
        updateCharCounter('wizard-location-name', 'wizard-location-counter');
    }

    if (sub && sub.notifyTime) {
        const radio = document.querySelector(`input[name="notify_time"][value="${sub.notifyTime}"]`);
        if (radio) radio.checked = true;
    } else {
        const radio5 = document.querySelector(`input[name="notify_time"][value="5"]`);
        if (radio5) radio5.checked = true;
    }

    overlay.style.display = 'flex';
    setTimeout(() => {
        overlay.classList.add('active');
        sheet.classList.add('active');
    }, 10);
}

function closeWizard() {
    const overlay = document.getElementById('push-wizard-overlay');
    const sheet = document.getElementById('push-wizard-sheet');
    if (!overlay || !sheet) return;
    overlay.classList.remove('active');
    sheet.classList.remove('active');
    setTimeout(() => {
        overlay.style.display = 'none';
        activeSlotIndex = null;
    }, 400);
}

function initWizard() {
    const groups = ['1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2', '5.1', '5.2', '6.1', '6.2'];
    const grid = document.getElementById('wizard-group-grid');
    if (!grid) return;

    let wizardConfig = { queueId: null, notifyTime: 15, powerOn: true };
    grid.innerHTML = '';
    groups.forEach(id => {
        const btn = document.createElement('button');
        btn.className = 'group-btn glass-card';
        btn.textContent = id;
        btn.onclick = () => {
            Array.from(grid.children).forEach(cb => cb.classList.remove('active'));
            btn.classList.add('active');
            wizardConfig.queueId = id;
        };
        grid.appendChild(btn);
    });

    const overlay = document.getElementById('push-wizard-overlay');
    if (overlay) {
        overlay.onclick = (e) => { if (e.target === overlay) closeWizard(); };
    }

    let currentStep = 1;
    const btnNext = document.getElementById('btn-wizard-next');
    const btnBack = document.getElementById('btn-wizard-back');

    if (btnNext) {
        btnNext.onclick = () => {
            if (currentStep === 1) {
                if (!wizardConfig.queueId) return alert('Будь ласка, оберіть чергу');
                currentStep = 2;
            } else if (currentStep === 2) {
                const selectedTime = document.querySelector('input[name="notify_time"]:checked');
                if (selectedTime) wizardConfig.notifyTime = selectedTime.value;
                currentStep = 3;
            } else if (currentStep === 3) {
                wizardConfig.powerOn = document.getElementById('wizard-power-on').checked;
                const locationInput = document.getElementById('wizard-location-name');
                const locationName = (locationInput && locationInput.value.trim()) || (activeSlotIndex === 0 ? 'Дім' : 'Робота');
                
                let userSubs = JSON.parse(localStorage.getItem('sssk_subscriptions')) || [];
                userSubs[activeSlotIndex] = {
                    id: Date.now(),
                    locationName: locationName,
                    group: wizardConfig.queueId,
                    notifyTime: parseInt(wizardConfig.notifyTime),
                    powerOn: wizardConfig.powerOn,
                    active: true,
                    pendingConfirm: false
                };
                localStorage.setItem('sssk_subscriptions', JSON.stringify(userSubs.filter(s => s !== null)));
                renderCabinet();
                closeWizard();
                currentStep = 1;

                // Log analytics
                if (analytics) analytics.trackSlotSetup(wizardConfig.queueId);
            }
            updateWizardUI();
        };
    }

    if (btnBack) {
        btnBack.onclick = () => {
            if (currentStep > 1) {
                currentStep--;
                updateWizardUI();
            }
        };
    }

    function updateWizardUI() {
        ['1', '2', '3'].forEach(n => document.getElementById(`wizard-step-${n}`).style.display = 'none');
        document.getElementById(`wizard-step-${currentStep}`).style.display = 'block';
        if (currentStep === 1) btnBack.style.display = 'none';
        else btnBack.style.display = 'block';
        btnNext.textContent = currentStep === 3 ? 'Зберегти' : 'Далі';
    }
}

/* ==========================================================================
   Start Config & Picker Logic
   ========================================================================== */

function initStartConfig() {
    let userSubs = JSON.parse(localStorage.getItem('sssk_subscriptions')) || [];
    
    // Ensure we have 2 slots always
    if (userSubs.length < 2) {
        if (userSubs.length === 0) {
            userSubs = [
                { locationName: 'Локація 1', active: false, group: '', notifyTime: 0, pendingConfirm: false },
                { locationName: 'Локація 2', active: false, group: '', notifyTime: 0, pendingConfirm: false }
            ];
        } else if (userSubs.length === 1) {
            userSubs.push({ locationName: 'Локація 2', active: false, group: '', notifyTime: 0, pendingConfirm: false });
        }
        localStorage.setItem('sssk_subscriptions', JSON.stringify(userSubs));
    }
    
    subscriptions = userSubs;
    renderStartCard();
}

async function renderStartCard() {
    const slot = document.getElementById('start-group-card-slot');
    if (!slot) return;
    
    // Default to 1.1 if nothing is saved as per user request
    let savedGroup = localStorage.getItem('sssk_start_group');
    if (!savedGroup) {
        savedGroup = '1.1';
        localStorage.setItem('sssk_start_group', '1.1');
    }

    // Premium Single-Card Layout (Updated for V15)
    slot.className = "glass-card start-card-premium fade-in";
    slot.innerHTML = `
        <!-- Main Content Area -->
        <div style="flex: 1; display: flex; flex-direction: column; height: 116px; position: relative;">
            <!-- Top Segment: Stats -->
            <div id="start-card-stats" style="display: flex; flex-direction: column; justify-content: space-evenly; flex: 1;">
                <div class="loading-spinner" style="width: 14px; height: 14px; border-width: 2px;"></div>
            </div>
            
            <!-- Bottom Segment: Info (AlignedText to Button) -->
            <div style="margin-top: auto; display: flex; align-items: center; justify-content: flex-end; gap: 12px; padding-bottom: 4px;">
                <p style="margin: 0; font-size: 13px; font-weight: 800; color: var(--system-text); opacity: 0.7; text-align: right; white-space: nowrap; letter-spacing: -0.4px;">
                    Стартує з
                </p>
            </div>
        </div>

        <!-- Right Segment: Interaction -->
        <div style="flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
            <button id="start-queue-btn" onclick="openQueuePicker()" class="mirror-avatar-btn">
                <span class="btn-top-label">змінити</span>
                <span class="queue-num">${savedGroup}</span>
                <span class="btn-label">черга</span>
            </button>
        </div>
    `;
    updateStartCardStats(savedGroup);
}

async function updateStartCardStats(queueId) {
    const statsContainer = document.getElementById('start-card-stats');
    const startBtn = document.getElementById('start-queue-btn');
    if (!statsContainer) return;
    
    let on = 12, off = 12; // Default mock data
    let isCurrentlyOn = true;
    
    try {
        const scheduleData = await fetchScheduleData();
        const now = new Date();
        const currentHour = now.getHours();
        const dateStr = `${now.getDate().toString().padStart(2, '0')}.${(now.getMonth() + 1).toString().padStart(2, '0')}`;
        const scheduleString = (scheduleData && scheduleData[dateStr]) ? scheduleData[dateStr][queueId] : null;

        if (scheduleString && scheduleString.length === 24) {
            on = 0; off = 0;
            for (let char of scheduleString) { if (char === '0') off++; else on++; }
            isCurrentlyOn = scheduleString[currentHour] !== '0';
        } else {
            // Mock logic for demo consistency: alternating based on hour if no data
            isCurrentlyOn = (new Date().getHours() % 2 === 0);
        }
    } catch (e) {
        console.warn("Using fallback stats (Mock Data)");
        isCurrentlyOn = (new Date().getHours() % 2 === 0);
    }

    // Update Button Color
    if (startBtn) {
        startBtn.classList.remove('status-on', 'status-off');
        startBtn.classList.add(isCurrentlyOn ? 'status-on' : 'status-off');
    }

    statsContainer.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 800; color: var(--system-text); letter-spacing: -0.4px;">
            <div style="width: 36px; height: 36px; border-radius: 10px; background: #FF9500; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 3px 10px rgba(255,149,0,0.5);">
                <img src="/SSSK/pwa/assets/bulb_on.png" alt="on" style="width: 22px; height: 22px; object-fit: contain; filter: brightness(0) invert(1);">
            </div>
            <span>${on} год зі світлом</span>
        </div>
        <div style="display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 800; color: var(--system-text); letter-spacing: -0.4px;">
            <div style="width: 36px; height: 36px; border-radius: 10px; background: #8E8E93; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 3px 10px rgba(142,142,147,0.4);">
                <img src="/SSSK/pwa/assets/bulb_off.png" alt="off" style="width: 22px; height: 22px; object-fit: contain; filter: brightness(0) invert(1);">
            </div>
            <span>${off} год без світла</span>
        </div>
    `;
}

function openQueuePicker(slotIdx = null) {
    console.log('Opening Queue Picker for target:', slotIdx === null ? 'Start Card' : `Slot ${slotIdx}`);
    currentPickerSlot = slotIdx;
    
    const overlay = document.getElementById('queue-picker-overlay');
    const grid = document.getElementById('picker-grid');
    if (!overlay || !grid) return;

    const groups = ['1.1', '2.1', '3.1', '1.2', '2.2', '3.2', '4.1', '5.1', '6.1', '4.2', '5.2', '6.2'];
    
    // Determine current group based on target
    let current;
    if (slotIdx === null) {
        current = localStorage.getItem('sssk_start_group');
    } else {
        current = subscriptions[slotIdx] ? subscriptions[slotIdx].group : null;
    }
    const now = new Date();
    const currentHour = now.getHours();
    const dateStr = `${now.getDate().toString().padStart(2, '0')}.${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    
    // Fetch data for dots
    fetchScheduleData().then(scheduleData => {
        grid.innerHTML = '';
        groups.forEach(id => {
            const btn = document.createElement('button');
            const isActive = (id === current);
            btn.className = `picker-btn ${isActive ? 'active' : ''}`;
            
            // Calculate status for this group
            let isOn = (new Date().getHours() % 2 === 0); // Fallback
            const scheduleString = (scheduleData && scheduleData[dateStr]) ? scheduleData[dateStr][id] : null;
            if (scheduleString && scheduleString.length === 24) {
                isOn = scheduleString[currentHour] !== '0';
            }

            // Create dot (White if button is active orange, else standard color)
            const dotClass = isActive ? 'dot-active' : (isOn ? 'on' : 'off');
            
            btn.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <span class="status-dot ${dotClass}" style="margin: 0; width: 8px; height: 8px; ${isActive ? 'background: #fff; box-shadow: 0 0 8px #fff;' : ''}"></span>
                    <span>${id}</span>
                </div>
            `;
            
            btn.style.height = '46px';
            btn.style.borderRadius = '12px';
            btn.onclick = () => selectPickerGroup(id);
            grid.appendChild(btn);
        });
    });

    overlay.style.display = 'flex';
    setTimeout(() => overlay.classList.add('active'), 10);
    document.body.style.overflow = 'hidden';
}

function closeQueuePicker() {
    const overlay = document.getElementById('queue-picker-overlay');
    if (!overlay) return;
    overlay.classList.remove('active');
    setTimeout(() => { overlay.style.display = 'none'; document.body.style.overflow = ''; }, 300);
}

function selectPickerGroup(group) {
    if (currentPickerSlot === null) {
        localStorage.setItem('sssk_start_group', group);
        localStorage.setItem('sssk_start_group_manual', 'true'); // Flag to set row to active
        renderStartCard();
        renderStartQueueRow();
    } else {
        if (subscriptions[currentPickerSlot]) {
            subscriptions[currentPickerSlot].group = group;
            subscriptions[currentPickerSlot].pendingConfirm = true; // Any change triggers pending
            saveSubscriptions();
            renderCabinet();
        }
    }
    closeQueuePicker();
}

function toggleNotifyTime(index) {
    if (subscriptions[index]) {
        const current = subscriptions[index].notifyTime || 5;
        subscriptions[index].notifyTime = (current === 5) ? 15 : 5;
        subscriptions[index].pendingConfirm = true; // Mark for confirmation (blue button)
        saveSubscriptions();
        renderCabinet();
    }
}

/** Notify Time Picker Logic **/
function openNotifyTimePicker(slotIdx) {
    currentPickerSlot = slotIdx;
    const overlay = document.getElementById('notify-time-picker-overlay');
    if (!overlay) return;
    
    // Highlight active value
    const currentVal = subscriptions[slotIdx] ? subscriptions[slotIdx].notifyTime : null;
    const btn5 = document.getElementById('time-btn-5');
    const btn15 = document.getElementById('time-btn-15');
    
    if (btn5) btn5.classList.toggle('active', currentVal === 5);
    if (btn15) btn15.classList.toggle('active', currentVal === 15);
    
    overlay.style.display = 'flex';
    setTimeout(() => overlay.classList.add('active'), 10);
    document.body.style.overflow = 'hidden';
}

function closeNotifyTimePicker() {
    const overlay = document.getElementById('notify-time-picker-overlay');
    if (!overlay) return;
    overlay.classList.remove('active');
    setTimeout(() => { overlay.style.display = 'none'; document.body.style.overflow = ''; }, 300);
}

function selectNotifyTime(value) {
    if (currentPickerSlot !== null && subscriptions[currentPickerSlot]) {
        subscriptions[currentPickerSlot].notifyTime = parseInt(value);
        subscriptions[currentPickerSlot].pendingConfirm = true; // Any change triggers pending
        saveSubscriptions();
        renderCabinet();
    }
    closeNotifyTimePicker();
}

function saveSubscriptions() {
    localStorage.setItem('sssk_subscriptions', JSON.stringify(subscriptions));
}

function updateCharCounter(inputId, counterId) {
    const input = document.getElementById(inputId);
    const counter = document.getElementById(counterId);
    if (!input || !counter) return;
    
    const length = input.value.length;
    counter.textContent = `${length}/20`;
    
    if (length >= 20) {
        counter.style.color = '#FF3B30'; // Red
    } else if (length >= 15) {
        counter.style.color = '#FF9500'; // Orange
    } else {
        counter.style.color = 'var(--system-text-muted)';
    }
}

/** Location Picker Functions **/
function openLocationPicker(index) {
    currentPickerSlot = index;
    const overlay = document.getElementById('location-picker-overlay');
    const input = document.getElementById('picker-location-input');
    if (!overlay || !input) return;
    
    let sub = subscriptions[index];
    input.value = sub ? (sub.locationName || '') : '';
    
    // Initialize Counter Logic
    input.oninput = () => updateCharCounter('picker-location-input', 'picker-location-counter');
    updateCharCounter('picker-location-input', 'picker-location-counter');
    
    overlay.style.display = 'flex';
    setTimeout(() => overlay.classList.add('active'), 10);
    document.body.style.overflow = 'hidden';
    
    // Auto-save on Enter
    input.onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveLocationName();
        }
    };
    
    input.focus();
}

function closeLocationPicker() {
    const overlay = document.getElementById('location-picker-overlay');
    if (!overlay) return;
    overlay.classList.remove('active');
    setTimeout(() => { overlay.style.display = 'none'; document.body.style.overflow = ''; }, 300);
}

function saveLocationName() {
    const input = document.getElementById('picker-location-input');
    if (input && currentPickerSlot !== null && subscriptions[currentPickerSlot]) {
        const newName = input.value.trim();
        if (newName) {
            subscriptions[currentPickerSlot].locationName = newName;
            subscriptions[currentPickerSlot].pendingConfirm = true;
            saveSubscriptions();
            renderCabinet();
        }
    }
    closeLocationPicker();
}

function initFeedback() {
    const btn = document.getElementById('btn-send-feedback');
    const input = document.getElementById('feedback-text');
    if (!btn || !input) return;
    btn.onclick = () => {
        const text = input.value.trim();
        if (!text) return;
        btn.disabled = true; btn.textContent = '...';
        setTimeout(() => { 
            input.value = ''; btn.disabled = false; btn.textContent = 'Надіслати';
            const status = document.getElementById('feedback-status');
            if (status) { status.style.opacity = '1'; setTimeout(() => status.style.opacity = '0', 3000); }
            
            // Log analytics
            if (analytics) analytics.logEvent('feedback_sent', { length: text.length });
        }, 1000);
    };
}

// Global helper to toggle card activity status (Tri-State)
window.toggleCardStatus = function(index) {
    let userSubscriptions = JSON.parse(localStorage.getItem('sssk_subscriptions')) || [];
    let sub = userSubscriptions[index];
    if (!sub) return;
    
    const isActive = sub.active !== false;
    const isPending = sub.pendingConfirm === true;
    
    if (!isActive) {
        sub.active = true;
        sub.pendingConfirm = true;
        if (!sub.group || sub.group === "") sub.group = '1.1';
        if (!sub.notifyTime || sub.notifyTime === 0) sub.notifyTime = 5;
    } else if (isPending) {
        sub.pendingConfirm = false;
    } else {
        sub.active = false;
    }
    
    localStorage.setItem('sssk_subscriptions', JSON.stringify(userSubscriptions));
    renderCabinet();
}

// Global helper for "About App" toast
window.showAboutAlert = function() {
    if (window.showToast) {
        window.showToast('Розділ "Про застосунок" у розробці');
    } else {
        alert('Розділ "Про застосунок" у розробці');
    }
};

// Global helper for Sharing
window.shareApp = function() {
    if (analytics) analytics.trackShare();
    
    const text = 'Привіт! Користуюсь зручним застосунком "Світло-Starkon" для графіків відключень світла. Спробуй і ти:';
    const url = referralSystem ? referralSystem.getReferralUrl() : window.location.origin;
    
    if (navigator.share) {
        navigator.share({
            title: 'Світло-Starkon',
            text: text,
            url: url
        }).catch(err => console.log('Error sharing:', err));
    } else {
        const fullShareText = `${text} ${url}`;
        navigator.clipboard.writeText(fullShareText).then(() => {
            if (window.showToast) window.showToast('Посилання скопійовано!');
            else alert('Посилання на за стосунок скопійовано в буфер обміну!');
        });
    }
};

// Global helper for toggle notify time
window.toggleNotifyTime = function(index) {
    let userSubscriptions = JSON.parse(localStorage.getItem('sssk_subscriptions')) || [];
    if (!userSubscriptions[index]) return;
    
    // Cycle: 5 -> 10 -> 15 -> 5
    let current = userSubscriptions[index].notifyTime || 5;
    if (current === 5) userSubscriptions[index].notifyTime = 10;
    else if (current === 10) userSubscriptions[index].notifyTime = 15;
    else userSubscriptions[index].notifyTime = 5;
    
    localStorage.setItem('sssk_subscriptions', JSON.stringify(userSubscriptions));
    renderCabinet();
};

/** Tomorrow Push Logic (Industrial Style Row) **/
function toggleTomorrowPush() {
    const isActive = localStorage.getItem('sssk_tomorrow_push') === 'true';
    const newState = !isActive;
    localStorage.setItem('sssk_tomorrow_push', newState);
    renderTomorrowPushCard();
    if (window.navigator?.vibrate) window.navigator.vibrate(8);
}

function renderTomorrowPushCard() {
    const card = document.getElementById('tomorrow-push-subscription');
    const textEl = document.getElementById('tomorrow-push-text');
    if (!card || !textEl) return;
    
    const isActive = localStorage.getItem('sssk_tomorrow_push') === 'true';
    if (isActive) {
        card.classList.add('active');
        textEl.textContent = "Ви отримаєте пуш щойно з'явиться графік на завтра";
    } else {
        card.classList.remove('active');
        textEl.textContent = "Налаштувати пуш про отримання графіка на завтра";
    }
}

function initTomorrowPush() {
    renderTomorrowPushCard();
}

/** Start Queue Row Logic (Industrial Style) **/
function renderStartQueueRow() {
    const row = document.getElementById('start-queue-row-industrial');
    const textEl = document.getElementById('start-queue-text');
    if (!row || !textEl) return;

    const group = localStorage.getItem('sssk_start_group') || '1.1';
    const isManual = localStorage.getItem('sssk_start_group_manual') === 'true';

    if (isManual) {
        row.classList.add('active');
        textEl.innerHTML = `Застосунок стартує з підчерги <span style="font-size: 17px; font-weight: 950; margin-left: 6px; color: #ee7221;">№ ${group}</span>`;
    } else {
        row.classList.remove('active');
        textEl.innerHTML = `Налаштувати з якої черги буде стартувати додаток — <strong style="font-size: 15.5px;">${group}</strong>`;
    }
}

// --- Re-exporting missing interactive functions for HTML onclick handlers ---
window.toggleTomorrowPush = toggleTomorrowPush;
window.openQueuePicker = openQueuePicker;
window.closeQueuePicker = closeQueuePicker;
window.selectPickerGroup = selectPickerGroup;
window.openDNDSettings = openDNDSettings;
window.closeDNDSettings = closeDNDSettings;
window.saveDNDSettings = saveDNDSettings;
window.toggleDNDStatus = toggleDNDStatus;
window.clearDND = clearDND;
window.openNotifyTimePicker = openNotifyTimePicker;
window.closeNotifyTimePicker = closeNotifyTimePicker;
window.selectNotifyTime = selectNotifyTime;
window.saveSubscriptions = saveSubscriptions;
window.openLocationPicker = openLocationPicker;
window.closeLocationPicker = closeLocationPicker;
window.saveLocationName = saveLocationName;
window.updateCharCounter = updateCharCounter;
window.openWizard = openWizard;
window.closeWizard = closeWizard;
window.deleteSlot = deleteSlot;

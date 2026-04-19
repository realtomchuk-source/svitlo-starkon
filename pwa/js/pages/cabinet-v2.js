import { UserService } from '../modules/user/user-service.js';
import { AnalyticsEngine } from '../modules/user/analytics-engine.js';

let userService, analytics;
let subscriptions = [];

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Cabinet V2 Module Initialized');

    try {
        userService = new UserService(window.supabase);
        await userService.init();
        window.v2UserService = userService; // Make globally accessible
        analytics = new AnalyticsEngine(userService);

        initV2();
        
        // Listen for storage changes to sync V2 with V1
        window.addEventListener('storage', () => {
            initV2();
        });

        // Patch global renderCabinet to also update V2 if triggered by Wizard
        const originalRender = window.renderCabinet;
        window.renderCabinet = () => {
            if (typeof originalRender === 'function') originalRender();
            initV2();
        };

    } catch (error) {
        console.error('V2 Init Error:', error);
    }
});

function initV2() {
    loadSubscriptions();
    updateAuthStateV2();
    renderSlotsV2();
    renderStartQueueValue();
    syncTogglesV2();
}

function loadSubscriptions() {
    if (userService) {
        subscriptions = userService.getPushSubscriptions();
    } else {
        const saved = localStorage.getItem('sssk_subscriptions');
        subscriptions = saved ? JSON.parse(saved) : [null, null];
    }
    // Shared state for push-custom.js
    window.userSubscriptions = subscriptions;
}

async function updateAuthStateV2() {
    const profileSlot = document.getElementById('v2-profile-card-slot');
    if (!profileSlot || !userService) return;

    const { user, profile } = userService.getUserData();

    if (user) {
        const avatarUrl = user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${user.email}&background=E5E7EB&color=111827`;
        const userNickname = profile?.full_name || user.user_metadata?.full_name || user.email.split('@')[0];
        
        profileSlot.innerHTML = `
            <div class="v2-profile-block">
                <img class="v2-avatar" src="${avatarUrl}" alt="Avatar" onclick="window.v2ChangeAvatarAlert()" style="cursor: pointer;">
                <div>
                    <div class="v2-profile-name">${userNickname}</div>
                    <div class="v2-profile-edit" onclick="window.v2ChangeAvatarAlert()" style="cursor: pointer;">Змінити фото</div>
                </div>
            </div>
        `;
    } else {
        profileSlot.innerHTML = `
            <div class="v2-profile-block">
                <div class="v2-avatar-placeholder">
                    <i class="fas fa-user"></i>
                </div>
                <div class="v2-profile-guest">
                    <div class="v2-auth-buttons">
                        <button class="v2-button-auth" onclick="window.signInWithGoogle()">
                            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="14" height="14">
                            Google
                        </button>
                        <button class="v2-button-auth telegram">
                            <i class="fab fa-telegram"></i>
                            Telegram
                        </button>
                    </div>
                    <div class="v2-guest-caption" style="margin-top: 2px;">Ви не увійшли</div>
                </div>
            </div>
        `;
    }
}

function renderSlotsV2() {
    const grid = document.getElementById('v2-slots-grid');
    if (!grid) return;

    grid.innerHTML = (subscriptions || []).map((sub, index) => {
        const isActive = sub && sub.active === true;
        const defaultLabel = (index === 0) ? 'Локація 1' : 'Локація 2';
        const displayLabel = (sub && sub.locationName) ? sub.locationName : defaultLabel;

        if (isActive) {
            let dndText = '22:00 — 08:00';
            if (sub.dnd) {
                if (sub.dnd.active === false) {
                    dndText = 'Дозволено завжди';
                } else if (sub.dnd.start && sub.dnd.end) {
                    dndText = `${sub.dnd.start} — ${sub.dnd.end}`;
                }
            }

            return `
                <div class="v2-slot-card active fade-in" onclick="window.openCustomPushSetup(${index})" style="border: 1px solid var(--accent) !important; box-shadow: 0 4px 15px rgba(238, 114, 33, 0.06) !important; flex-direction: row !important; justify-content: space-between !important; align-items: center !important; gap: 12px;">
                    <div style="flex: 1; display: flex; flex-direction: column; gap: 2px;">
                        <span class="v2-slot-label" style="font-size: 15px; font-weight: 700;">${displayLabel}</span>
                        <div class="v2-slot-dnd" style="font-size: 11px; opacity: 0.5;">${dndText} не турбувати</div>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 11px; font-weight: 500; opacity: 0.6;">Підчерга</span>
                            <div class="v2-badge active">${sub.group || '1.1'}</div>
                        </div>
                        <div class="v2-slot-time" style="margin-top: 0; font-size: 12px; font-weight: 700; color: var(--accent);">
                             ${sub.notifyTime || '10'} хв до змін
                        </div>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="v2-slot-card inactive" onclick="window.openCustomPushSetup(${index})" style="flex-direction: row !important; justify-content: space-between !important; align-items: center !important; gap: 12px; opacity: 0.8;">
                    <div style="flex: 1; display: flex; flex-direction: column; gap: 2px;">
                        <span class="v2-slot-label" style="font-size: 15px; font-weight: 700;">${displayLabel}</span>
                        <div class="v2-slot-dnd" style="font-size: 11px; opacity: 0.4;">Натисніть щоб налаштувати</div>
                    </div>
                    
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div class="v2-card-icon-box v2-icon-bell" style="width: 32px; height: 32px; border-radius: 10px; background: rgba(128,128,128,0.1);">
                            <i class="fas fa-plus" style="font-size: 12px; color: #8E8E93;"></i>
                        </div>
                        <div class="v2-badge" style="background: rgba(128,128,128,0.1); color: #8E8E93; border: none;">Off</div>
                    </div>
                </div>
            `;
        }
    }).join('');
}

// Add overlay click-outside listener
document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('custom-push-setup-overlay');
    if (overlay) {
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                if (window.closeCustomPushSetup) window.closeCustomPushSetup();
            }
        };
    }
});

function syncTogglesV2() {
    const tomorrowToggle = document.getElementById('v2-tomorrow-push-toggle');
    if (!tomorrowToggle) return;

    const isEnabled = localStorage.getItem('sssk_tomorrow_push') === 'true';
    tomorrowToggle.className = `v2-toggle ${isEnabled ? 'on' : ''}`;

    // Update icon highlight class
    const card = tomorrowToggle.closest('.v2-card');
    if (card) {
        const iconBox = card.querySelector('.v2-icon-bell');
        if (iconBox) {
            if (isEnabled) iconBox.classList.add('active');
            else iconBox.classList.remove('active');
        }
    }
}

// Window Globals for UI Interactions
window.v2ToggleTomorrowPush = () => {
    const current = localStorage.getItem('sssk_tomorrow_push') === 'true';
    localStorage.setItem('sssk_tomorrow_push', !current);
    syncTogglesV2();
    // Also sync with V1 if possible
    const v1Toggle = document.getElementById('tomorrow-push-subscription');
    if (v1Toggle) {
        if (!current) v1Toggle.classList.add('active');
        else v1Toggle.classList.remove('active');
    }
};

window.v2ToggleFeedback = () => {
    const form = document.getElementById('v2-feedback-form');
    const chevron = document.getElementById('v2-feedback-chevron');
    if (form) {
        form.classList.toggle('hidden');
        if (chevron) {
            chevron.style.transform = form.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(90deg)';
        }
    }
};

window.v2SendFeedback = async () => {
    const text = document.getElementById('v2-feedback-text').value;
    if (!text.trim()) return;
    
    const btn = document.getElementById('v2-btn-send-feedback');
    const status = document.getElementById('v2-feedback-status');
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    
    // Simulate send (mirror existing logic)
    setTimeout(() => {
        btn.innerHTML = 'Надіслати';
        btn.disabled = false;
        document.getElementById('v2-feedback-text').value = '';
        status.style.display = 'block';
        setTimeout(() => { status.style.display = 'none'; }, 3000);
    }, 1000);
};

window.v2ChangeAvatarAlert = () => {
    alert('Функція в розробці. Слідкуйте за оновленнями!');
};

// Start Queue Logic (TZ 2.1)
window.renderStartQueueValue = function() {
    const rawVal = localStorage.getItem('startQueue');
    const val = rawVal || '1.1';
    const el = document.getElementById('v2-start-queue-value');
    if (el) el.innerText = val;

    // Update icon highlight class: orange only if NOT the default 1.1
    const iconBox = document.getElementById('v2-start-queue-icon');
    if (iconBox) {
        if (rawVal && rawVal !== '1.1') iconBox.classList.add('active');
        else iconBox.classList.remove('active');
    }
}

window.v2OpenStartQueuePicker = () => {
    if (window.openCustomPushSetup) {
        // Mode 'start-queue' triggers minimal UI and auto-save (TZ 2.2)
        window.openCustomPushSetup(0, 'start-queue');
    }
};

// Registered for push-custom.js updates
window.renderCabinet = initV2;

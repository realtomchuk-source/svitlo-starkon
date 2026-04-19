import { UserService } from '../modules/user/user-service.js';

let userService;
let subscriptions = [];
let currentBottomSheetMode = null; // 'setup' | 'startQueue' | 'feedback'

// ========================================================
// РОЗРОБНИЦЬКИЙ РЕЖИМ (DEV MODE)
// ========================================================
// Якщо true, додаток вважатиме, що ви вже авторизовані і поверне тестові (мокові) дані.
// Якщо false, додаток буде працювати з реальною базою Supabase і підтягувати ваш реальний профіль.
const DEV_MOCK_USER = true; 
// ========================================================

document.addEventListener('DOMContentLoaded', async () => {
    try {
        if (DEV_MOCK_USER) {
            console.warn("DEV_MOCK_USER увімкнено! Використовуються фейкові дані користувача.");
            userService = {
                getUserData: () => ({
                    user: { email: "test.dev@sssk.ua", user_metadata: { full_name: "Олексій (DEV)" } },
                    profile: { full_name: "Олексій Розробник" }
                }),
                getPushSubscriptions: () => {
                    const saved = localStorage.getItem('sssk_subscriptions');
                    return saved ? JSON.parse(saved) : [{ active: true, locationName: "Дім (DEV)", group: "2.1", notifyTime: 15, dnd: { active: true, start: "23:00", end: "07:00" } }, null];
                },
                updatePushSubscriptions: async (subs) => {
                    console.log("Mock saved to DB", subs);
                },
                init: async () => true
            };
        } else {
            userService = new UserService(window.supabase);
            await userService.init();
        }
        
        window.v3UserService = userService; 
        initV3();
        
        window.addEventListener('storage', () => initV3());
        
        // Ripple logic
        document.addEventListener('click', function(e) {
            const target = e.target.closest('.ripple');
            if (!target) return;
            const circle = document.createElement('span');
            const diameter = Math.max(target.clientWidth, target.clientHeight);
            const radius = diameter / 2;
            circle.style.width = circle.style.height = `${diameter}px`;
            const rect = target.getBoundingClientRect();
            circle.style.left = `${e.clientX - rect.left - radius}px`;
            circle.style.top = `${e.clientY - rect.top - radius}px`;
            circle.style.position = 'absolute';
            circle.style.borderRadius = '50%';
            circle.style.transform = 'scale(0)';
            circle.style.animation = 'ripple-anim 600ms linear';
            circle.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
            circle.style.pointerEvents = 'none';
            
            const existing = target.querySelector('.v3-ripple');
            if (existing) existing.remove();
            circle.classList.add('v3-ripple');
            target.appendChild(circle);
        });

    } catch (error) {
        console.error('V3 Init Error:', error);
    }
});

function initV3() {
    loadSubscriptions();
    renderProfile();
    renderSlots();
    renderSettings();
}

function loadSubscriptions() {
    if (userService) {
        subscriptions = userService.getPushSubscriptions() || [];
    } else {
        const saved = localStorage.getItem('sssk_subscriptions');
        subscriptions = saved ? JSON.parse(saved) : [];
    }
    // Shared state
    window.userSubscriptions = subscriptions;
}

function isGuest() {
    if (!userService) return true;
    const { user } = userService.getUserData();
    return !user;
}

function renderProfile() {
    const profileSlot = document.getElementById('v3-profile-slot');
    if (!profileSlot) return;

    if (isGuest()) {
        profileSlot.innerHTML = `
            <div class="v3-profile-block ripple" onclick="window.signInWithGoogle()">
                <div class="v3-avatar">
                     <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" style="opacity: 0.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                </div>
                <div class="v3-profile-info">
                    <span class="v3-profile-name">Гість</span>
                    <span class="v3-profile-status">Натисніть, щоб увійти</span>
                </div>
            </div>
        `;
    } else {
        const { user, profile } = userService.getUserData();
        const avatarUrl = user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${user.email}&background=E5E7EB&color=111827`;
        const userNickname = profile?.full_name || user.user_metadata?.full_name || user.email.split('@')[0];
        const shortName = userNickname.length > 20 ? userNickname.substring(0, 20) + '...' : userNickname;
        
        profileSlot.innerHTML = `
            <div class="v3-profile-block">
                <img class="v3-avatar" src="${avatarUrl}" alt="Avatar">
                <div class="v3-profile-info">
                    <span class="v3-profile-name">${shortName}</span>
                    <span class="v3-profile-status" style="color: #34C759; display: flex; align-items: center; gap: 4px;">
                        <span style="width: 6px; height: 6px; border-radius: 50%; background: currentColor;"></span>
                        Синхронізація увімкнена
                    </span>
                </div>
            </div>
        `;
    }
}

function formatDndText(sub) {
    if (!sub.dnd || sub.dnd.active === false) return "Не турбувати: цілодобово";
    return `Не турбувати з ${sub.dnd.start} до ${sub.dnd.end}`;
}

function renderSlots() {
    const container = document.getElementById('v3-slots-container');
    if (!container) return;

    let html = '';
    
    // Always render EXACTLY 2 slots
    for (let i = 0; i < 2; i++) {
        const sub = subscriptions[i];
        if (sub && sub.active) {
            html += `
                <div class="v3-card active ripple" style="flex-direction: column; align-items: stretch; gap: 8px;" onclick="window.v3OpenSetup(${i})">
                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span class="v3-card-title">${sub.locationName || `Локація ${i+1}`}</span>
                            <span style="font-size: 13px; font-weight: 600; color: var(--v3-accent);">за ${sub.notifyTime || 10} хв. до змін</span>
                        </div>
                        <span class="v3-card-right-top">${sub.group || '1.1'}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                        <span class="v3-card-subtitle">${formatDndText(sub)}</span>
                        <div style="width: 10px; height: 10px; border-radius: 50%; background: var(--v3-accent); flex-shrink: 0;"></div>
                    </div>
                </div>
            `;
        } else if (sub) {
            // Inactive but exists
            html += `
                <div class="v3-card inactive ripple" style="flex-direction: column; align-items: stretch; gap: 8px;" onclick="window.v3OpenSetup(${i})">
                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                        <span class="v3-card-title" style="color: var(--v3-text-muted);">${sub.locationName || `Локація ${i+1}`}</span>
                        <span class="v3-card-right-top" style="color: var(--v3-text-muted)">-</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                        <span class="v3-card-subtitle" style="color: var(--v3-text-muted);">Натисніть щоб налаштувати</span>
                        <div style="width: 10px; height: 10px; border-radius: 50%; background: var(--v3-text-muted); flex-shrink: 0;"></div>
                    </div>
                </div>
            `;
        } else {
            // Empty
            html += `
                <div class="v3-card empty ripple" onclick="window.v3OpenSetup(${i})">
                    <span class="v3-card-empty-text">Додати сповіщення +</span>
                </div>
            `;
        }
    }
    container.innerHTML = html;
}

function renderSettings() {
    // Start Queue
    const rawVal = localStorage.getItem('startQueue') || '1.1';
    const sqValue = document.getElementById('v3-sq-value');
    if (sqValue) sqValue.innerText = rawVal;
    
    // Tomorrow Toggle
    const tomorrowToggle = document.getElementById('v3-tomorrow-toggle');
    const isTomorrowOn = localStorage.getItem('sssk_tomorrow_push') === 'true';
    if (tomorrowToggle) {
        if (isTomorrowOn) tomorrowToggle.classList.add('on');
        else tomorrowToggle.classList.remove('on');
    }
    
    // Guest subtitles
    const sqSub = document.getElementById('v3-sq-subtitle');
    const tmSub = document.getElementById('v3-tomorrow-subtitle');
    if (isGuest()) {
        if (sqSub) { sqSub.style.display = 'block'; sqSub.innerText = 'Доступно після входу'; }
        if (tmSub) { tmSub.style.display = 'block'; tmSub.innerText = 'Доступно після входу'; }
    } else {
        if (sqSub) sqSub.style.display = 'none';
        if (tmSub) tmSub.style.display = 'none';
    }
}

// ------------------------
// BOTTOM SHEET MANAGER
// ------------------------
window.v3OpenBottomSheet = (contentHtml, title = "Налаштування") => {
    document.getElementById('v3-sheet-title').innerText = title;
    document.getElementById('v3-sheet-body').innerHTML = contentHtml;
    document.getElementById('v3-bottom-sheet-overlay').classList.add('active');
};

window.v3CloseBottomSheet = (e) => {
    // If e is passed and it's from the overlay background click, allow close
    document.getElementById('v3-bottom-sheet-overlay').classList.remove('active');
};

// ------------------------
// INTERACTIONS
// ------------------------
window.v3OpenStartQueue = () => {
    if (isGuest()) {
        window.v3ShowToast("Ця функція доступна лише авторизованим користувачам");
        return;
    }
    
    const currentVal = localStorage.getItem('startQueue') || '1.1';
    
    let gridHtml = '<div class="sq-grid" style="grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 10px;">';
    for (let i=1; i<=6; i++) {
        for (let j=1; j<=2; j++) {
            const sqVal = `${i}.${j}`;
            const activeClass = sqVal === currentVal ? 'active' : '';
            gridHtml += `<div class="sq-btn ${activeClass}" style="padding: 14px 0;" onclick="window.v3SaveStartQueue('${sqVal}')">${sqVal}</div>`;
        }
    }
    gridHtml += '</div>';
    
    window.v3OpenBottomSheet(gridHtml, "Оберіть підчергу");
};

window.v3SaveStartQueue = (val) => {
    localStorage.setItem('startQueue', val);
    renderSettings();
    window.v3CloseBottomSheet();
    window.v3ShowToast(`Стартова черга ${val} збережена`);
};

// Helper for DND sliders
function timeToValue(timeStr) {
    if (!timeStr) return 0;
    const [h,m] = timeStr.split(':');
    return parseInt(h) * 4 + Math.round(parseInt(m) / 15);
}
function valueToTime(val) {
    const h = Math.floor(val / 4);
    const m = (val % 4) * 15;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

window.v3OpenSetup = (index) => {
    if (isGuest()) {
        window.v3ShowToast("Увійдіть, щоб створювати сповіщення");
        return;
    }

    const sub = subscriptions[index] || {};
    const loc = sub.locationName || `Локація ${index + 1}`;
    const grp = sub.group || '1.1';
    const notTime = sub.notifyTime || 10;
    const dndActive = sub.dnd ? sub.dnd.active !== false : true;
    const dndStart = sub.dnd?.start || '22:00';
    const dndEnd = sub.dnd?.end || '08:00';

    const html = `
        <div style="display: flex; flex-direction: column; gap: 20px;">
            <!-- Location Input Section -->
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <label style="font-size: 13px; font-weight: 600; color: var(--v3-text-secondary); opacity: 0.8; padding-left: 4px;">Як назвемо локацію?</label>
                <input type="text" id="v3-setup-loc" placeholder="Наприклад: Дім" maxlength="20" value="${loc}"
                    style="width: 100%; padding: 12px 16px; border-radius: 14px; border: 1px solid rgba(128,128,128,0.15); background: var(--v3-bg-card); color: var(--v3-text-primary); font-family: inherit; font-size: 16px; font-weight: 500; outline: none; transition: 0.2s; box-sizing: border-box;">
                <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px;">
                    <button class="chip-btn" onclick="document.getElementById('v3-setup-loc').value='Дім'">Дім</button>
                    <button class="chip-btn" onclick="document.getElementById('v3-setup-loc').value='Робота'">Робота</button>
                    <button class="chip-btn" onclick="document.getElementById('v3-setup-loc').value='Офіс'">Офіс</button>
                    <button class="chip-btn" onclick="document.getElementById('v3-setup-loc').value='Батьки'">Батьки</button>
                </div>
            </div>

            <!-- Subqueue Selection Section -->
            <div style="display: flex; flex-direction: column; gap: 16px;">
                <div style="padding: 12px 16px; background: var(--v3-bg-card); border: 1px solid rgba(128,128,128,0.15); border-radius: 14px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-family: 'Inter', sans-serif; font-size: 16px; font-weight: 600; color: var(--v3-accent);">Оберіть підчергу</span>
                </div>
                <div style="padding: 4px 0px 0px 0px;">
                    <input type="hidden" id="v3-setup-grp" value="${grp}">
                    <div class="sq-grid">
                        ${['1.1','1.2','2.1','2.2','3.1','3.2','4.1','4.2','5.1','5.2','6.1','6.2'].map(q => 
                            `<div class="sq-btn ${grp === q ? 'active' : ''}" onclick="window.v3SelectCustomPushSubqueue('${q}', this)">${q}</div>`
                        ).join('')}
                    </div>
                </div>
            </div>

            <!-- Notify Time Section -->
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <label style="font-size: 13px; font-weight: 600; color: var(--v3-text-secondary); opacity: 0.8; padding-left: 4px;">Попередити про зміни в графіку за</label>
                <details id="custom-push-time-details" style="background: var(--v3-bg-card); border: 1px solid rgba(128,128,128,0.15); border-radius: 14px; overflow: hidden; transition: 0.2s;">
                    <summary style="padding: 12px 16px; font-size: 16px; font-weight: 600; color: var(--v3-text-primary); cursor: pointer; outline: none; list-style: none; display: flex; justify-content: space-between; align-items: center;">
                        <span id="custom-push-time-summary-text" style="font-family: 'Inter', sans-serif;">${notTime} хв</span>
                        <div style="opacity: 0.5;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </div>
                    </summary>
                    <div style="padding: 4px 12px 12px 12px;">
                        <input type="hidden" id="v3-setup-time" value="${notTime}">
                        <div class="sq-grid" style="grid-template-columns: repeat(3, 1fr);">
                            ${[5, 10, 15].map(t => 
                                `<div class="sq-btn ${notTime == t ? 'active' : ''}" onclick="window.v3SelectCustomPushTime('${t}', this)">${t} хв</div>`
                            ).join('')}
                        </div>
                    </div>
                </details>
            </div>

            <!-- Notification Mode & DND Section -->
            <div style="display: flex; flex-direction: column; gap: 16px;">
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 4px 4px 4px 4px;">
                    <div>
                        <div style="font-size: 13px; font-weight: 600; color: var(--v3-text-secondary); opacity: 0.8; padding-left: 4px;">Сповіщати 24/7</div>
                        <div style="font-size: 11px; opacity: 0.6; color: var(--v3-text-secondary); padding-left: 4px;">Без обмежень за часом</div>
                    </div>
                    <label class="ios-toggle"><input type="checkbox" id="v3-setup-dnd-toggle-check" ${!dndActive ? 'checked' : ''} onchange="window.v3ToggleDnd(this.checked)"><span class="slider"></span></label>
                </div>

                <div id="v3-dnd-container" style="${dndActive ? 'display: flex;' : 'display: none;'} flex-direction: column; gap: 4px;">
                    <label style="font-size: 13px; font-weight: 600; color: var(--v3-text-secondary); opacity: 0.8; padding-left: 4px;">Не турбувати</label>
                    <div style="background: var(--v3-bg-card); border: 1px solid rgba(128,128,128,0.15); border-radius: 18px; overflow: hidden; transition: 0.2s;">
                        <div style="display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-bottom: 1px solid rgba(128,128,128,0.08);">
                            <span style="font-size: 14px; color: var(--v3-text-secondary); min-width: 63px;">Початок</span>
                            <input type="range" id="v3-setup-dnd-start" class="time-slider" min="0" max="95" step="1" value="${timeToValue(dndStart)}" 
                                oninput="window.v3UpdateDndTime(this, 'lbl-dnd-start')" style="flex-grow: 1; accent-color: var(--v3-accent);">
                            <span id="lbl-dnd-start" style="font-size: 14px; font-weight: 750; color: var(--v3-accent); font-family: 'Inter', sans-serif; min-width: 45px; text-align: right; font-variant-numeric: tabular-nums;">${dndStart}</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 12px; padding: 10px 16px;">
                            <span style="font-size: 14px; color: var(--v3-text-secondary); min-width: 63px;">Кінець</span>
                            <input type="range" id="v3-setup-dnd-end" class="time-slider" min="0" max="95" step="1" value="${timeToValue(dndEnd)}" 
                                oninput="window.v3UpdateDndTime(this, 'lbl-dnd-end')" style="flex-grow: 1; accent-color: var(--v3-accent);">
                            <span id="lbl-dnd-end" style="font-size: 14px; font-weight: 750; color: var(--v3-accent); font-family: 'Inter', sans-serif; min-width: 45px; text-align: right; font-variant-numeric: tabular-nums;">${dndEnd}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Actions -->
            <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 10px;">
                <button onclick="window.v3SaveSetup(${index})" class="v3-btn-primary" style="width: 100%; border-radius: 18px; padding: 14px;">Зберегти налаштування</button>
                ${sub && sub.active ? `<button style="background: transparent; border: none; color: #FF3B30; font-weight: 600; font-size: 15px; margin-top: 4px; cursor: pointer; padding: 12px;" onclick="window.v3ClearSetup(${index})">Вимкнути локацію</button>` : ''}
            </div>
        </div>
    `;

    setTimeout(() => {
        window.v3SelectCustomPushSubqueue = (q, btn) => {
            document.getElementById('v3-setup-grp').value = q;
            document.querySelectorAll('#v3-sheet-body .sq-grid:first-of-type .sq-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        };
        
        window.v3SelectCustomPushTime = (t, btn) => {
            document.getElementById('v3-setup-time').value = t;
            document.getElementById('custom-push-time-summary-text').innerText = `${t} хв`;
            document.querySelectorAll('#custom-push-time-details .sq-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('custom-push-time-details').removeAttribute('open');
        };
        
        window.v3ToggleDnd = (is247Enabled) => {
            const container = document.getElementById('v3-dnd-container');
            if (is247Enabled) {
                container.style.display = 'none';
            } else {
                container.style.display = 'flex';
            }
        };
        
        window.v3UpdateDndTime = (slider, lblId) => {
            document.getElementById(lblId).innerText = valueToTime(slider.value);
        };
    }, 50);

    window.v3OpenBottomSheet(html, "Налаштування пуш");
};

window.v3SaveSetup = (index) => {
    const loc = document.getElementById('v3-setup-loc').value.trim() || `Локація ${index + 1}`;
    const grp = document.getElementById('v3-setup-grp').value;
    const time = parseInt(document.getElementById('v3-setup-time').value) || 10;
    
    const is247Checked = document.getElementById('v3-setup-dnd-toggle-check').checked;
    const dndActive = !is247Checked;
    
    const dndStartVal = document.getElementById('v3-setup-dnd-start').value || 88;
    const dndEndVal = document.getElementById('v3-setup-dnd-end').value || 32;
    
    const dndStart = valueToTime(parseInt(dndStartVal));
    const dndEnd = valueToTime(parseInt(dndEndVal));

    subscriptions[index] = {
        active: true,
        locationName: loc,
        group: grp,
        notifyTime: time,
        dnd: {
            active: dndActive,
            start: dndStart,
            end: dndEnd
        }
    };
    window.userSubscriptions = subscriptions;

    localStorage.setItem('sssk_subscriptions', JSON.stringify(subscriptions));
    if (window.v3UserService) {
        window.v3UserService.updatePushSubscriptions(subscriptions);
    }

    renderSlots();
    window.v3CloseBottomSheet();
    window.v3ShowToast("Налаштування збережено");
};

window.v3ClearSetup = (index) => {
    if(!confirm("Вимкнути всі пуш сповіщення для цієї локації?")) return;
    
    subscriptions[index] = { active: false };
    window.userSubscriptions = subscriptions;
    
    localStorage.setItem('sssk_subscriptions', JSON.stringify(subscriptions));
    if (window.v3UserService) {
        window.v3UserService.updatePushSubscriptions(subscriptions);
    }
    
    renderSlots();
    window.v3CloseBottomSheet();
    window.v3ShowToast("Локацію вимкнено");
};

window.v3ToggleTomorrow = () => {
    if (isGuest()) {
        window.v3ShowToast("Увійдіть, щоб зберігати налаштування");
        return;
    }
    const current = localStorage.getItem('sssk_tomorrow_push') === 'true';
    localStorage.setItem('sssk_tomorrow_push', !current);
    renderSettings();
};

window.v3OpenAbout = () => {
    window.v3ShowToast("Світло Версія 3.0 (Minimalist Edition)");
};

window.v3ShareApp = () => {
    const btn = document.getElementById('v3-share-btn');
    if (btn) {
        btn.classList.remove('v3-anim-bounce');
        void btn.offsetWidth; // trigger reflow
        btn.classList.add('v3-anim-bounce');
    }
    
    setTimeout(() => {
        if (navigator.share) {
            navigator.share({
                title: 'SSSK',
                text: 'Спробуй додаток Світло-Старкон!',
                url: window.location.href
            }).catch(console.error);
        } else {
            window.v3ShowToast("Посилання скопійовано!");
        }
    }, 300);
};

window.v3OpenFeedback = () => {
    const html = `
        <div style="display: flex; flex-direction: column; gap: 16px;">
            <textarea id="v3-feedback-text" class="v3-textarea" placeholder="Ваше повідомлення розробникам..."></textarea>
            <button class="v3-btn-primary" onclick="window.v3SendFeedback()">Надіслати</button>
        </div>
    `;
    window.v3OpenBottomSheet(html, "Зворотний зв'язок");
};

window.v3SendFeedback = () => {
    const text = document.getElementById('v3-feedback-text').value;
    if (!text.trim()) return;
    
    window.v3CloseBottomSheet();
    window.v3ShowToast("Дякуємо! Ваш відгук надіслано.");
};

// ------------------------
// TOAST NOTIFICATIONS
// ------------------------
let toastTimeout;
window.v3ShowToast = (msg) => {
    const container = document.getElementById('v3-toast-container');
    const msgEl = document.getElementById('v3-toast-message');
    if (!container || !msgEl) return;
    
    msgEl.innerText = msg;
    container.classList.add('show');
    
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        container.classList.remove('show');
    }, 3000);
};

import { UserService } from '../modules/user/user-service.js';
import { fetchTodaySchedule } from '../modules/api.js';

let userService;
let subscriptions = [];
let currentBottomSheetMode = null; // 'setup' | 'startQueue' | 'feedback'

// ========================================================
// РОЗРОБНИЦЬКИЙ РЕЖИМ (DEV MODE)
// ========================================================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        userService = new UserService();
        await userService.init();
        
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
    updateElectricityStatus();
}

function loadSubscriptions() {
    if (userService) {
        subscriptions = userService.getPushSubscriptions() || [];
    } else {
        const saved = localStorage.getItem('sssk_subscriptions');
        subscriptions = saved ? JSON.parse(saved) : [];
    }
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
            <div class="v3-profile-block">
                <div class="v3-avatar">
                     <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" style="opacity: 0.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                </div>
                <div class="v3-profile-info">
                    <span class="v3-profile-name">Автономний профіль</span>
                    <span class="v3-profile-status">Дані зберігаються локально</span>
                </div>
            </div>
        `;
    } else {
        const { user, profile } = userService.getUserData();
        const avatarUrl = user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${user.email}&background=E5E7EB&color=111827`;
        const userNickname = profile?.full_name || user.user_metadata?.full_name || user.email.split('@')[0];
        const shortName = userNickname.length > 20 ? userNickname.substring(0, 20) + '...' : userNickname;
        
        const regDateRaw = user.created_at || profile?.created_at || new Date().toISOString();
        const regDateFormatted = new Date(regDateRaw).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
        
        profileSlot.innerHTML = `
            <div class="v3-profile-block">
                <img class="v3-avatar" src="${avatarUrl}" alt="Avatar">
                <div class="v3-profile-info">
                    <span class="v3-profile-name">${shortName}</span>
                    <span class="v3-profile-status sync-active">
                        <span class="status-dot-mini"></span>
                        Синхронізація увімкнена
                    </span>
                    <span class="v3-profile-meta">У додатку з ${regDateFormatted}</span>
                </div>
                <div class="v3-profile-action ripple" onclick="window.v3OpenProfileSettings()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                    </svg>
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
    for (let i = 0; i < 2; i++) {
        const sub = subscriptions[i];
        if (sub && sub.active) {
            html += `
                <div class="v3-card active ripple" onclick="window.v3OpenSetup(${i})">
                    <div class="v3-card-row">
                        <div class="v3-card-left-group">
                            <span class="v3-card-title">${sub.locationName || `Локація ${i+1}`}</span>
                            <span class="v3-card-notify-info">за ${sub.notifyTime || 10} хв. до змін</span>
                        </div>
                        <span class="v3-card-right-top">${sub.group || '1.1'}</span>
                    </div>
                    <div class="v3-card-row">
                        <span class="v3-card-subtitle">${formatDndText(sub)}</span>
                        <div class="v3-status-dot-main"></div>
                    </div>
                </div>
            `;
        } else if (sub) {
            html += `
                <div class="v3-card inactive ripple" onclick="window.v3OpenSetup(${i})">
                    <div class="v3-card-row">
                        <span class="v3-card-title">${sub.locationName || `Локація ${i+1}`}</span>
                        <span class="v3-card-right-top">-</span>
                    </div>
                    <div class="v3-card-row">
                        <span class="v3-card-subtitle">Натисніть щоб налаштувати</span>
                        <div class="v3-status-dot-main grey"></div>
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="v3-card empty ripple" onclick="window.v3OpenSetup(${i})">
                    <span class="v3-card-empty-text">Додати сповіщення +</span>
                </div>
            `;
        }
    }
    container.innerHTML = html;
}

async function updateElectricityStatus() {
    try {
        const data = await fetchTodaySchedule();
        if (!data) return;
        
        const currentGroup = localStorage.getItem('sssk_group') || '1.1';
        const now = new Date();
        const currentHour = now.getHours();
        
        let isOn = true;
        if (data.mode === 'all_clear') isOn = true;
        else if (data.mode === 'no_power') isOn = false;
        else if (data.queues && data.queues[currentGroup]) {
            isOn = data.queues[currentGroup][currentHour] === '1';
        }
        
        document.body.classList.toggle('status-off', !isOn);
    } catch (e) {
        console.warn("Electricity status sync failed", e);
    }
}

function renderSettings() {
    const rawVal = localStorage.getItem('startQueue') || '1.1';
    const sqValue = document.getElementById('v3-sq-value');
    if (sqValue) sqValue.innerText = rawVal;
    
    const tomorrowToggle = document.getElementById('v3-tomorrow-toggle');
    const isTomorrowOn = localStorage.getItem('sssk_tomorrow_push') === 'true';
    if (tomorrowToggle) {
        if (isTomorrowOn) tomorrowToggle.classList.add('on');
        else tomorrowToggle.classList.remove('on');
    }
    
    const sqSub = document.getElementById('v3-sq-subtitle');
    const tmSub = document.getElementById('v3-tomorrow-subtitle');
    if (sqSub) sqSub.style.display = 'none';
    if (tmSub) tmSub.style.display = 'none';
}

window.v3OpenBottomSheet = (contentHtml, title = "Налаштування") => {
    document.getElementById('v3-sheet-title').innerText = title;
    document.getElementById('v3-sheet-body').innerHTML = contentHtml;
    document.getElementById('v3-bottom-sheet-overlay').classList.add('active');
};

window.v3CloseBottomSheet = () => {
    document.getElementById('v3-bottom-sheet-overlay').classList.remove('active');
};

window.v3OpenStartQueue = () => {
    // Feature unlocked for local mode
    
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
    // Feature unlocked for local mode

    const sub = subscriptions[index] || {};
    const loc = sub.locationName || `Локація ${index + 1}`;
    const grp = sub.group || '1.1';
    const notTime = sub.notifyTime || 10;
    const dndActive = sub.dnd ? sub.dnd.active !== false : true;
    const dndStart = sub.dnd?.start || '22:00';
    const dndEnd = sub.dnd?.end || '08:00';

    const html = `
        <div style="display: flex; flex-direction: column; gap: 20px;">
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <label style="font-size: 13px; font-weight: 600; color: var(--v3-text-secondary); opacity: 0.8; padding-left: 4px;">Як назвемо локацію?</label>
                <input type="text" id="v3-setup-loc" placeholder="Наприклад: Дім" maxlength="20" value="${loc}"
                    style="width: 100%; padding: 12px 16px; border-radius: 14px; border: 1px solid rgba(128,128,128,0.15); background: var(--v3-bg-card); color: var(--v3-text-primary); font-family: inherit; font-size: 16px; font-weight: 500; outline: none; transition: 0.2s; box-sizing: border-box;">
                <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px;">
                    <button class="chip-btn" onclick="document.getElementById('v3-setup-loc').value='Дім'">Дім</button>
                    <button class="chip-btn" onclick="document.getElementById('v3-setup-loc').value='Робота'">Робота</button>
                    <button class="chip-btn" onclick="document.getElementById('v3-setup-loc').value='Офіс'">Офіс</button>
                </div>
            </div>

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

            <div style="display: flex; flex-direction: column; gap: 8px;">
                <label style="font-size: 13px; font-weight: 600; color: var(--v3-text-secondary); opacity: 0.8; padding-left: 4px;">Попередити за</label>
                <details id="custom-push-time-details" style="background: var(--v3-bg-card); border: 1px solid rgba(128,128,128,0.15); border-radius: 14px; overflow: hidden;">
                    <summary style="padding: 12px 16px; font-size: 16px; font-weight: 600; color: var(--v3-text-primary); cursor: pointer; display: flex; justify-content: space-between; align-items: center; list-style: none;">
                        <span id="custom-push-time-summary-text">${notTime} хв</span>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
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

            <div style="display: flex; flex-direction: column; gap: 16px;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div>
                        <div style="font-size: 13px; font-weight: 600; color: var(--v3-text-secondary); opacity: 0.8; padding-left: 4px;">Сповіщати 24/7</div>
                    </div>
                    <label class="ios-toggle"><input type="checkbox" id="v3-setup-dnd-toggle-check" ${!dndActive ? 'checked' : ''} onchange="window.v3ToggleDnd(this.checked)"><span class="slider"></span></label>
                </div>

                <div id="v3-dnd-container" style="${dndActive ? 'display: flex;' : 'display: none;'} flex-direction: column; gap: 4px;">
                    <div style="background: var(--v3-bg-card); border: 1px solid rgba(128,128,128,0.15); border-radius: 18px; overflow: hidden;">
                        <div style="display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-bottom: 1px solid rgba(128,128,128,0.08);">
                            <span style="font-size: 14px; min-width: 63px;">Початок</span>
                            <input type="range" id="v3-setup-dnd-start" class="time-slider" min="0" max="95" step="1" value="${timeToValue(dndStart)}" 
                                oninput="window.v3UpdateDndTime(this, 'lbl-dnd-start')" style="flex-grow: 1; accent-color: var(--v3-accent);">
                            <span id="lbl-dnd-start" style="font-size: 14px; font-weight: 750; color: var(--v3-accent); min-width: 45px; text-align: right;">${dndStart}</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 12px; padding: 10px 16px;">
                            <span style="font-size: 14px; min-width: 63px;">Кінець</span>
                            <input type="range" id="v3-setup-dnd-end" class="time-slider" min="0" max="95" step="1" value="${timeToValue(dndEnd)}" 
                                oninput="window.v3UpdateDndTime(this, 'lbl-dnd-end')" style="flex-grow: 1; accent-color: var(--v3-accent);">
                            <span id="lbl-dnd-end" style="font-size: 14px; font-weight: 750; color: var(--v3-accent); min-width: 45px; text-align: right;">${dndEnd}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 10px;">
                <button onclick="window.v3SaveSetup(${index})" class="v3-btn-primary" style="width: 100%; border-radius: 18px; padding: 14px;">Зберегти</button>
                ${sub && sub.active ? `<button style="background: transparent; border: none; color: #FF3B30; font-weight: 600; padding: 12px;" onclick="window.v3ClearSetup(${index})">Вимкнути локацію</button>` : ''}
            </div>
        </div>
    `;

    setTimeout(() => {
        window.v3SelectCustomPushSubqueue = (q, btn) => {
            document.getElementById('v3-setup-grp').value = q;
            document.querySelectorAll('#v3-sheet-body .sq-grid .sq-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        };
        window.v3SelectCustomPushTime = (t, btn) => {
            document.getElementById('v3-setup-time').value = t;
            document.getElementById('custom-push-time-summary-text').innerText = `${t} хв`;
            document.querySelectorAll('#custom-push-time-details .sq-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('custom-push-time-details').removeAttribute('open');
        };
        window.v3ToggleDnd = (is247) => {
            document.getElementById('v3-dnd-container').style.display = is247 ? 'none' : 'flex';
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
    const dndActive = !document.getElementById('v3-setup-dnd-toggle-check').checked;
    const dndStart = valueToTime(parseInt(document.getElementById('v3-setup-dnd-start').value));
    const dndEnd = valueToTime(parseInt(document.getElementById('v3-setup-dnd-end').value));

    subscriptions[index] = { active: true, locationName: loc, group: grp, notifyTime: time, dnd: { active: dndActive, start: dndStart, end: dndEnd } };
    localStorage.setItem('sssk_subscriptions', JSON.stringify(subscriptions));
    if (window.v3UserService) window.v3UserService.updatePushSubscriptions(subscriptions);
    renderSlots();
    window.v3CloseBottomSheet();
    window.v3ShowToast("Збережено");
};

window.v3ClearSetup = (index) => {
    if(!confirm("Вимкнути локацію?")) return;
    subscriptions[index] = { active: false };
    localStorage.setItem('sssk_subscriptions', JSON.stringify(subscriptions));
    if (window.v3UserService) window.v3UserService.updatePushSubscriptions(subscriptions);
    renderSlots();
    window.v3CloseBottomSheet();
};

window.v3ToggleTomorrow = () => {
    // Feature unlocked for local mode
    const current = localStorage.getItem('sssk_tomorrow_push') === 'true';
    localStorage.setItem('sssk_tomorrow_push', !current);
    renderSettings();
};

window.v3OpenAbout = () => window.v3ShowToast("Світло Версія 3.0");
window.v3ShareApp = () => {
    if (navigator.share) navigator.share({ title: 'SSSK', url: window.location.href }).catch(() => {});
    else window.v3ShowToast("Посилання скопійовано");
};
window.v3OpenFeedback = () => {
    const html = `<textarea id="v3-feedback-text" class="v3-textarea" placeholder="Ваш відгук..."></textarea><button class="v3-btn-primary" onclick="window.v3SendFeedback()">Надіслати</button>`;
    window.v3OpenBottomSheet(html, "Зворотний зв'язок");
};
window.v3SendFeedback = () => {
    if (!document.getElementById('v3-feedback-text').value.trim()) return;
    window.v3CloseBottomSheet();
    window.v3ShowToast("Дякуємо!");
};

let toastTimeout;
window.v3ShowToast = (msg) => {
    const container = document.getElementById('v3-toast-container');
    const msgEl = document.getElementById('v3-toast-message');
    if (!container || !msgEl) return;
    msgEl.innerText = msg;
    container.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => container.classList.remove('show'), 3000);
};

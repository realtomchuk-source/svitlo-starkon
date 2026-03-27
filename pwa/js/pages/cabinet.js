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
    console.log('Cabinet Session Started (V8.1 - Emergency Module Restoration)');

    try {
        // Initialize Supabase if needed (assuming window.supabase is available from supabase-client.js)
        if (typeof window.initSupabase === 'function') window.initSupabase();
        
        // Initialize Domain Services
        userService = new UserService(window.supabase);
        await userService.init();
        
        referralSystem = new ReferralSystem(userService);
        analytics = new AnalyticsEngine(userService);

        // Track referral if present in URL
        referralSystem.trackReferral();
    } catch (error) {
        console.error('Critical initialization error:', error);
        // Ensure services exist even if init failed
        if (!userService) userService = new UserService(window.supabase);
        if (!referralSystem) referralSystem = new ReferralSystem(userService);
        if (!analytics) analytics = new AnalyticsEngine(userService);
    }
    
    if (userService && !userService.isGuest()) {
        await referralSystem.syncPendingReferral();
    }

    initStartConfig();
    renderCabinet();
    initWizard();
    initFeedback();
    updateAuthState();

    // Log visit
    analytics.logEvent('page_view', { page: 'cabinet' });
});

/* ==========================================================================
   Auth & Profile Card Logic
   ========================================================================== */

async function updateAuthState() {
    const profileSlot = document.getElementById('profile-card-slot');
    if (!profileSlot || !userService) return;

    try {
        const { user, profile } = userService.getUserData();
        
        if (user) {
            const avatarUrl = user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${user.email}&background=FF9500&color=fff`;
            const userNickname = profile?.full_name || user.user_metadata?.full_name || user.email.split('@')[0];
            const rank = profile?.rank || 'Новачок';
            const points = profile?.points || 0;
            
            profileSlot.innerHTML = `
                <div class="profile-card-premium" style="display: flex !important; flex-direction: row !important; align-items: center !important; padding: 12px !important; gap: 14px !important; overflow: hidden !important; height: 140px !important; min-height: 140px !important;">
                    <!-- Pixel-Perfect Inset Square Avatar -->
                    <div class="avatar-square-v10" style="width: 116px !important; height: 116px !important; border-radius: 20px !important; overflow: hidden !important; flex-shrink: 0 !important; box-shadow: 0 4px 25px rgba(0,0,0,0.18) !important; border: 1.5px solid rgba(255,149,0,0.25) !important;">
                        <img src="${avatarUrl}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                    <!-- Right Actions & Info Column -->
                    <div style="flex: 1 !important; display: flex !important; flex-direction: column !important; justify-content: space-between !important; height: 116px !important; padding: 2px 0 !important;">
                        <!-- Rank & Points Row -->
                        <div style="display: flex !important; justify-content: space-between !important; align-items: flex-start !important; padding-right: 4px !important;">
                            <div style="display: flex; flex-direction: column; gap: 2px;">
                                <div class="badge-rank" style="background: rgba(255,149,0,0.15); color: #FF9500; font-size: 11px; font-weight: 900; padding: 2px 8px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px; width: fit-content;">${rank}</div>
                                <div style="font-size: 12px; font-weight: 800; color: white; opacity: 0.6; padding-left: 2px;">${points} балів</div>
                            </div>
                            <!-- Monochrome Logout Button -->
                            <button onclick="signOut()" class="glass-square-auth-btn mono-logout" title="Вийти" style="width: 38px !important; height: 38px !important; border-radius: 12px !important; display: flex !important; align-items: center; justify-content: center; background: rgba(255,255,255,0.1) !important; border: 1.5px solid rgba(255,255,255,0.2) !important; cursor: pointer; padding: 0 !important; transition: all 0.2s ease;">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: grayscale(1) !important;">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="white"/>
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="white"/>
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="white"/>
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="white"/>
                                </svg>
                            </button>
                        </div>
                        <!-- User Info Bottom -->
                        <div style="margin-top: auto !important; padding-bottom: 2px !important;">
                            <div style="font-weight: 850 !important; color: #FF9500 !important; font-size: 24px !important; margin-bottom: 2px !important; letter-spacing: -0.8px !important; line-height: 1 !important;">${userNickname}</div>
                            <div style="font-size: 13px !important; color: white !important; font-weight: 600 !important; opacity: 0.8 !important;">${user.email}</div>
                        </div>
                    </div>
                </div>
            `;
            renderLeaderboard();
        } else {
            profileSlot.innerHTML = `
                <div class="profile-card-premium guest-active" style="display: flex !important; flex-direction: row !important; align-items: center !important; padding: 12px !important; gap: 14px !important; overflow: hidden !important; height: 140px !important; min-height: 140px !important;">
                    <!-- Avatar (Guest) -->
                    <div class="avatar-square-v10" style="width: 116px !important; height: 116px !important; border-radius: 20px !important; background: rgba(255,149,0,0.15) !important; display: flex !important; align-items: center; justify-content: center; flex-shrink: 0 !important; border: 1.5px solid rgba(255,149,0,0.3) !important;">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="54" height="54" fill="#FF9500"><path d="M320 312C386.3 312 440 258.3 440 192C440 125.7 386.3 72 320 72C253.7 72 200 125.7 200 192C200 258.3 253.7 312 320 312zM290.3 368C191.8 368 112 447.8 112 546.3C112 562.7 125.3 576 141.7 576L498.3 576C514.7 576 528 562.7 528 546.3C528 447.8 448.2 368 349.7 368L290.3 368z"/></svg>
                    </div>
                    <!-- Right Column -->
                    <div style="flex: 1 !important; display: flex !important; flex-direction: column !important; justify-content: space-between !important; height: 116px !important; padding: 2px 0 !important;">
                        <div style="display: flex !important; gap: 8px !important; align-items: center !important; justify-content: flex-end !important; padding-right: 4px !important;">
                            <!-- Telegram Button -->
                            <button onclick="signInWithTelegram()" class="glass-square-auth-btn telegram" style="width: 50px !important; height: 50px !important; border-radius: 14px !important; display: flex !important; align-items: center; justify-content: center; background: rgba(0,136,204,0.1) !important; border: 1.5px solid rgba(0,136,204,0.2) !important; cursor: pointer; padding: 0 !important;">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11.944 0C5.347 0 0 5.347 0 11.944c0 6.596 5.347 11.944 11.944 11.944 6.596 0 11.944-5.348 11.944-11.944C23.888 5.347 18.54 0 11.944 0zm5.485 8.16l-1.896 8.937c-.143.64-.522.798-1.059.497l-2.89-2.13-1.394 1.341c-.154.154-.283.283-.58.283l.207-2.937 5.348-4.832c.233-.207-.05-.322-.361-.116l-6.61 4.162-2.846-.89c-.618-.194-.63-.618.129-.913l11.121-4.288c.515-.194.966.115.732.888z" fill="#0088cc"/></svg>
                            </button>
                            <!-- Google Button -->
                            <button onclick="signInWithGoogle()" class="glass-square-auth-btn google" style="width: 50px !important; height: 50px !important; border-radius: 14px !important; display: flex !important; align-items: center; justify-content: center; background: rgba(255,255,255,0.95) !important; border: 1.5px solid rgba(128,128,128,0.1) !important; cursor: pointer; padding: 0 !important; box-shadow: 0 4px 15px rgba(0,0,0,0.1) !important;">
                                <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                            </button>
                        </div>
                        <div style="margin-top: auto !important; padding-bottom: 2px !important;">
                            <div style="font-weight: 850 !important; color: #FF9500 !important; font-size: 24px !important; margin-bottom: 2px !important; letter-spacing: -0.8px !important; line-height: 1 !important;">Гість</div>
                            <div style="font-size: 13px !important; color: #0d0d0d !important; font-weight: 700 !important; opacity: 0.9 !important; letter-spacing: -0.2px !important;">Увійдіть, щоб бачити свій <b>Ранг</b> та <b>Бали</b></div>
                        </div>
                    </div>
                </div>
            `;
            renderLeaderboard();
        }
    } catch (e) {
        console.error("Auth update error:", e);
    }
}

async function renderLeaderboard() {
    const section = document.getElementById('leaderboard-section');
    const list = document.getElementById('leaderboard-list');
    if (!section || !list || !userService) return;

    if (userService.isGuest()) {
        section.style.display = 'block'; // Show as teaser
        list.innerHTML = `
            <div style="padding: 10px; text-align: center;">
                <p style="margin: 0; font-size: 12px; opacity: 0.6; color: var(--system-text);">Авторизуйтесь, щоб змагатися з іншими Світляками та бачити лідерів!</p>
            </div>
        `;
        return;
    }

    section.style.display = 'block';

    try {
        const { data, error } = await userService.supabase
            .from('user_profiles')
            .select('full_name, points, rank, avatar_url')
            .order('points', { ascending: false })
            .limit(5);

        if (error) throw error;

        if (!data || data.length === 0) {
            list.innerHTML = '<div style="font-size: 12px; text-align: center; opacity: 0.5; padding: 10px;">Будьте першим у списку!</div>';
            return;
        }

        list.innerHTML = data.map((entry, index) => {
            const isTop1 = index === 0;
            const avatar = entry.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(entry.full_name || 'U')}&background=333&color=fff`;
            
            return `
                <div style="display: flex; align-items: center; gap: 12px; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 14px; border: 1px solid ${isTop1 ? 'rgba(255,149,0,0.2)' : 'rgba(255,255,255,0.05)'}; transition: transform 0.2s;">
                    <div style="font-size: 15px; font-weight: 900; color: ${isTop1 ? '#FF9500' : 'rgba(255,255,255,0.5)'}; width: 22px; text-align: center;">${index + 1}</div>
                    <div style="width: 36px; height: 36px; border-radius: 9px; overflow: hidden; flex-shrink: 0; border: 1px solid rgba(255,255,255,0.1);">
                        <img src="${avatar}" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-size: 13.5px; font-weight: 800; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${entry.full_name || 'Таємничий герой'}</div>
                        <div style="font-size: 11px; font-weight: 600; color: #FF9500; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.3px;">${entry.rank}</div>
                    </div>
                    <div style="text-align: right; min-width: 50px;">
                        <div style="font-size: 13px; font-weight: 900; color: white;">${entry.points}</div>
                        <div style="font-size: 9px; font-weight: 700; color: rgba(255,255,255,0.4); text-transform: uppercase;">балів</div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.warn('Leaderboard load failed:', err);
        list.innerHTML = '<div style="font-size: 12px; text-align: center; opacity: 0.4; padding: 10px;">Оновлюємо дані...</div>';
    }
}

/* ==========================================================================
   Cabinet Logic
   ========================================================================== */

function renderCabinet() {
    let userSubscriptions = JSON.parse(localStorage.getItem('sssk_subscriptions')) || [];
    subscriptions = userSubscriptions; // Update global state
    
    let dnd = JSON.parse(localStorage.getItem('sssk_dnd_settings')) || { active: false, start: '22:00', end: '08:00' };
    
    // Render Slots
    for (let i = 0; i < 2; i++) {
        const slotEl = document.getElementById(`slot-${i}`);
        if (!slotEl) continue;

        const sub = userSubscriptions[i];
        
        if (sub) {
            const isActive = sub.active !== false;
            const isPending = sub.pendingConfirm === true;
            
            slotEl.className = `slot-card ${isActive ? 'active' : 'inactive'} fade-in`;
            
            // Determine action button state
            let actionBtnClass = "activate";
            let actionBtnText = "Активувати картку";
            
            if (isActive) {
                if (isPending) {
                    actionBtnClass = "confirm";
                    actionBtnText = "Зафіксувати зміни";
                } else {
                    actionBtnClass = "deactivate";
                    actionBtnText = "Деактивувати картку";
                }
            }
            
            // Grayscale style for content only (not button)
            const contentGrayStyle = !isActive ? 'filter: grayscale(1); opacity: 0.5;' : '';

            // Premium Slot Card (Operational Layout V8.8 - Pixel Perfect Align)
            slotEl.innerHTML = `
                <div style="display: grid; grid-template-columns: 1fr 68px; grid-template-rows: 32px 36px; column-gap: 12px; row-gap: 0px; align-items: center; width: 100%; height: 68px; padding: 0;">
                    
                    <!-- Top Row: Info Bar (Col 1, Row 1) -->
                    <div style="grid-column: 1; grid-row: 1; display: flex; align-items: flex-start; gap: 12px; height: 32px; align-self: start; padding-top: 0px; ${contentGrayStyle}">
                        <!-- Location -->
                        <div class="location-name-container" style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
                            <div style="font-size: 14px; font-weight: 850; color: var(--system-text); letter-spacing: -0.2px; line-height: 1; display: flex; align-items: center;">
                                ${sub.locationName || (i === 0 ? 'Хата' : 'Локація 2')}
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.4; margin-left: 4px; cursor: pointer; display: ${isActive ? 'inline-block' : 'none'};" onclick="event.stopPropagation(); window.openLocationPicker(${i})">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                            </div>
                        </div>

                        <!-- Vertical Separator -->
                        <div style="width: 1px; height: 14px; background: rgba(128,128,128,0.15); flex-shrink: 0; margin-top: 1px;"></div>

                        <!-- Spacer to stick text to the right badge -->
                        <div style="flex: 1;"></div>

                        <!-- Notification Sentence (2-line right-aligned) -->
                        <div style="display: flex; flex-direction: column; align-items: flex-end; justify-content: flex-start; gap: 1px; flex-shrink: 0; padding-top: 0; height: 32px; margin-right: 12px;">
                            <div style="display: flex; align-items: center; gap: 4px; height: 18px;">
                                <div style="font-size: 12.5px; font-weight: 850; color: var(--system-text-muted); white-space: nowrap; letter-spacing: -0.3px; line-height: 1;">
                                    Повідомлення за
                                </div>
                                <div onclick="${isActive ? `event.stopPropagation(); window.toggleNotifyTime(${i})` : ''}" 
                                     class="pill-time-trigger"
                                     style="background: rgba(255, 149, 0, 0.08); border: 1.2px solid rgba(255, 149, 0, 0.18); border-radius: 6px; padding: 0 5px; color: #FF9500; font-weight: 900; font-size: 13px; min-width: 42px; height: 18px; display: flex; align-items: center; justify-content: center; cursor: ${isActive ? 'pointer' : 'default'}; margin: 0; transition: all 0.2s ease; box-shadow: 0 1px 4px rgba(255,149,0,0.05);">
                                    ${(sub.notifyTime || 5).toString().padStart(2, '0')} хв.
                                </div>
                            </div>
                            <div style="font-size: 12.5px; font-weight: 850; color: var(--system-text-muted); white-space: nowrap; letter-spacing: -0.3px; line-height: 1; height: 14px; opacity: 0.8;">
                                по підчерзі
                            </div>
                        </div>
                    </div>

                    <!-- Bottom Row: Action Button (Col 1, Row 2) -->
                    <div style="grid-column: 1; grid-row: 2; padding-bottom: 0px; align-self: end; display: flex; align-items: flex-end;">
                        <div class="action-btn-container" style="padding: 0;">
                            <div class="premium-action-btn ${actionBtnClass}" 
                                 style="padding: 6px 16px; min-height: 32px;"
                                 onclick="event.stopPropagation(); window.toggleCardStatus(${i})">
                                <span>${actionBtnText}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Side Column: Queue Badge (Col 2, Row 1-2) -->
                    <div style="grid-column: 2; grid-row: 1 / span 2; display: flex; justify-content: flex-end; align-items: center; ${contentGrayStyle}">
                        <div class="mirror-avatar-btn ${isActive ? 'status-on interactive-badge' : 'status-off'}" 
                             style="width: 68px; height: 68px; border-radius: 14px; margin: 0; box-shadow: 0 4px 20px rgba(0,0,0,0.15); flex-shrink: 0; cursor: ${isActive ? 'pointer' : 'default'}"
                             ${isActive ? `onclick="event.stopPropagation(); window.openQueuePicker(${i})"` : ''}>
                            <span class="queue-num" style="font-size: 30px; text-shadow: none; margin-top: 0; letter-spacing: -2px;">
                                ${sub.group || '1.1'}
                            </span>
                        </div>
                    </div>
                </div>
            `;
        } else {
            slotEl.className = 'slot-card empty fade-in';
            slotEl.innerHTML = `
                <button class="btn-setup-slot" onclick="openWizard(${i})" style="border: 1.5px dashed rgba(128,128,128,0.15); background: rgba(128,128,128,0.02); width: 100%; height: 100%; border-radius: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s ease;">
                    <div style="width: 32px; height: 32px; border-radius: 10px; background: rgba(255,149,0,0.1); display: flex; align-items: center; justify-content: center; margin-bottom: 6px; color: #FF9500;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </div>
                    <span style="font-weight: 800; font-size: 13px; color: var(--system-text); opacity: 0.6;">Додати локацію</span>
                </button>
            `;
        }
    }

    // Render DND Summary Row
    const dndContainer = document.getElementById('dnd-summary-container');
    if (dndContainer) {
        if (userSubscriptions.length > 0) {
            dndContainer.className = '';
            
            // Block activation logic (Active if at least one card is active)
            const anyCardActive = userSubscriptions.some(sub => sub && sub.active !== false);
            const isDndActive = dnd.active !== false;
            const isDndPending = dnd.pendingConfirm === true;

            // Determine DND action button state
            let dndBtnClass = "activate";
            let dndBtnText = "Активувати режим";
            
            if (isDndActive) {
                if (isDndPending) {
                    dndBtnClass = "confirm";
                    dndBtnText = "Зафіксувати режим";
                } else {
                    dndBtnClass = "deactivate";
                    dndBtnText = "Деактивувати режим";
                }
            }
            
            // Block-wide grayscale filter for DND row if no cards are active
            const blockDndStyle = !anyCardActive ? 'filter: grayscale(1); opacity: 0.55; pointer-events: none;' : '';
            
            // Electronic clock style based on DND active state
            const timeStyle = isDndActive 
                ? `background: rgba(255,149,0,0.15); border: 1px solid rgba(255,149,0,0.25); color: #FF9500; box-shadow: 0 0 10px rgba(255,149,0,0.06);` 
                : `background: rgba(128,128,128,0.12); border: 1px solid rgba(128,128,128,0.2); color: var(--system-text);`;

            const btnBase = `cursor: pointer; padding: 3px 8px; border-radius: 6px; font-family: monospace; font-weight: 800; font-size: 13px; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);`;

            dndContainer.innerHTML = `
                <div class="dnd-summary-row" style="border-top: none; display: flex; justify-content: space-between; align-items: center; padding: 0px 4px 2px 4px; min-height: 36px; gap: 16px; ${blockDndStyle}">
                    <!-- Left: Base Information -->
                    <div class="footer-left-text" style="font-size: 13px !important; font-weight: 700; text-align: left; opacity: 0.6; white-space: nowrap;">
                        Пуш-повідомлення про зміни графіків.
                    </div>

                    <!-- Right: DND Controls and Main Action -->
                    <div style="display: flex; align-items: center; gap: 14px; flex-shrink: 0;">
                        <div class="dnd-text" style="font-size: 13px !important; font-weight: 700; text-align: right; opacity: 0.7; white-space: nowrap;">
                            "Не турбувати" 
                            з <button onclick="openDNDSettings()" style="${btnBase} ${timeStyle}">${dnd.start}</button> 
                            до <button onclick="openDNDSettings()" style="${btnBase} ${timeStyle}">${dnd.end}</button>
                        </div>
                        
                        <div class="premium-action-btn ${dndBtnClass}" 
                             style="min-width: 120px; min-height: 32px; padding: 6px 16px; font-size: 13px;"
                             title="${!anyCardActive ? 'Спершу активуйте принаймні одну локацію' : ''}"
                             onclick="window.toggleDNDStatus()">
                            <span>${dndBtnText}</span>
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
            <div id="start-card-stats" style="display: flex; flex-direction: column; gap: 6px;">
                <div class="loading-spinner" style="width: 14px; height: 14px; border-width: 2px;"></div>
            </div>
            
            <!-- Bottom Segment: Info (AlignedText to Button) -->
            <div style="margin-top: auto; display: flex; align-items: center; justify-content: flex-end; gap: 12px; padding-bottom: 4px;">
                <p style="margin: 0; font-size: 13px; font-weight: 800; color: var(--system-text); opacity: 0.7; text-align: right; white-space: nowrap; letter-spacing: -0.4px;">
                    Додаток стартує з черги
                </p>
            </div>
        </div>

        <!-- Right Segment: Interaction -->
        <div style="flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
            <button id="start-queue-btn" onclick="openQueuePicker()" class="mirror-avatar-btn">
                <span class="queue-num">${savedGroup}</span>
                <span class="btn-label">змінити</span>
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
        <div style="display: flex; align-items: center; font-size: 14px; font-weight: 800; color: var(--system-text); letter-spacing: -0.4px;">
            <span class="status-dot on"></span>
            <span>${on} год зі світлом</span>
        </div>
        <div style="display: flex; align-items: center; font-size: 14px; font-weight: 800; color: var(--system-text); letter-spacing: -0.4px;">
            <span class="status-dot off"></span>
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
        renderStartCard();
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

// --- Re-exporting missing interactive functions for HTML onclick handlers ---
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

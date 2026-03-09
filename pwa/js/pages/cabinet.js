/**
 * cabinet.js
 * Контролер сторінки Особистого Кабінету (cabinet.html)
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log('Cabinet Session Started');

    if (typeof window.initSupabase === 'function') window.initSupabase();
    if (typeof window.updateAuthState === 'function') window.updateAuthState();

    // Завантаження раніше збережених підписок
    renderCabinet();

    const btnAddLocation = document.getElementById('btn-add-location');
    if (btnAddLocation) {
        btnAddLocation.addEventListener('click', openWizard);
    }

    initWizard();
});

function renderCabinet() {
    const list = document.getElementById('subscriptions-list');
    if (!list) return;

    let userSubscriptions = JSON.parse(localStorage.getItem('sssk_subscriptions')) || [
        { id: Date.now(), name: 'Мій Дім', group: '1.1', notify5: true, notify15: true }
    ];

    list.innerHTML = '';
    userSubscriptions.forEach(sub => {
        const card = document.createElement('div');
        card.className = 'glass-card location-card';
        card.innerHTML = `
            <div class="location-header">
                <div>
                    <h3 class="location-title">${sub.name}</h3>
                    <p class="body-neutral" style="font-size: 13px;">Черга ${sub.group}</p>
                </div>
            </div>
            
            <div class="location-settings">
                <div class="setting-row">
                    <span class="body-neutral">Сповіщення перед відключенням (за 15 хв)</span>
                    <label class="toggle-switch">
                        <input type="checkbox" ${sub.notify15 ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="setting-row">
                    <span class="body-neutral">Сповіщення при увімкненні світла</span>
                    <label class="toggle-switch">
                        <input type="checkbox" ${sub.powerOn ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
            </div>
        `;
        list.appendChild(card);
    });
}

/* ==========================================================================
   Push Notification Wizard Logic
   ========================================================================== */

function openWizard() {
    const wizardOverlay = document.getElementById('push-wizard-overlay');
    const wizardSheet = document.getElementById('push-wizard-sheet');
    
    wizardOverlay.style.display = 'flex';
    void wizardOverlay.offsetWidth;
    wizardOverlay.classList.add('active');
    wizardSheet.classList.add('active');
}

function closeWizard() {
    const wizardOverlay = document.getElementById('push-wizard-overlay');
    const wizardSheet = document.getElementById('push-wizard-sheet');
    wizardOverlay.classList.remove('active');
    wizardSheet.classList.remove('active');
    setTimeout(() => {
        wizardOverlay.style.display = 'none';
    }, 400);
}

function initWizard() {
    const groups = [
        { id: '1.1', name: 'Черга 1.1' }, { id: '1.2', name: 'Черга 1.2' },
        { id: '2.1', name: 'Черга 2.1' }, { id: '2.2', name: 'Черга 2.2' },
        { id: '3.1', name: 'Черга 3.1' }, { id: '3.2', name: 'Черга 3.2' },
        { id: '4.1', name: 'Черга 4.1' }, { id: '4.2', name: 'Черга 4.2' },
        { id: '5.1', name: 'Черга 5.1' }, { id: '5.2', name: 'Черга 5.2' },
        { id: '6.1', name: 'Черга 6.1' }, { id: '6.2', name: 'Черга 6.2' }
    ];

    const wizardGroupGrid = document.getElementById('wizard-group-grid');
    if (!wizardGroupGrid) return; // Not on cabinet page

    let wizardConfig = { queueId: null, notifyTime: 15, powerOn: true };

    groups.forEach(group => {
        const btn = document.createElement('button');
        btn.className = 'group-btn glass-card';
        btn.textContent = group.name;
        btn.onclick = () => {
            Array.from(wizardGroupGrid.children).forEach(cb => cb.classList.remove('active'));
            btn.classList.add('active');
            wizardConfig.queueId = group.id;
        };
        wizardGroupGrid.appendChild(btn);
    });

    const bgCloseHandle = document.getElementById('push-wizard-overlay');
    if (bgCloseHandle) {
        bgCloseHandle.addEventListener('click', (e) => {
            if (e.target === bgCloseHandle) closeWizard();
        });
    }

    // Step Logic
    let currentStep = 1;
    function updateWizardUI() {
        ['1', '2', '3'].forEach(n => document.getElementById(`wizard-step-${n}`).style.display = 'none');
        document.getElementById(`wizard-step-${currentStep}`).style.display = 'block';

        const wizardTitle = document.getElementById('wizard-title');
        const wizardSubtitle = document.getElementById('wizard-subtitle');
        const btnNext = document.getElementById('btn-wizard-next');
        const btnBack = document.getElementById('btn-wizard-back');

        if (currentStep === 1) {
            wizardTitle.textContent = 'Налаштуймо сповіщення';
            wizardSubtitle.textContent = 'Крок 1 з 3';
            btnBack.style.display = 'none';
            btnNext.textContent = 'Далі';
        } else if (currentStep === 2) {
            wizardTitle.textContent = 'Час сповіщення';
            wizardSubtitle.textContent = 'Крок 2 з 3';
            btnBack.style.display = 'block';
            btnNext.textContent = 'Далі';
        } else if (currentStep === 3) {
            wizardTitle.textContent = 'Фінальні штрихи';
            wizardSubtitle.textContent = 'Крок 3 з 3';
            btnBack.style.display = 'block';
            btnNext.textContent = 'Зберегти';
        }
    }

    const btnNext = document.getElementById('btn-wizard-next');
    if (btnNext) {
        btnNext.addEventListener('click', () => {
            if (currentStep === 1) {
                if (!wizardConfig.queueId) return alert('Будь ласка, оберіть чергу');
                currentStep = 2;
                updateWizardUI();
            } else if (currentStep === 2) {
                const selectedTime = document.querySelector('input[name="notify_time"]:checked');
                if (selectedTime) wizardConfig.notifyTime = selectedTime.value;
                currentStep = 3;
                updateWizardUI();
            } else if (currentStep === 3) {
                wizardConfig.powerOn = document.getElementById('wizard-power-on').checked;
                
                let userSubs = JSON.parse(localStorage.getItem('sssk_subscriptions')) || [];
                userSubs.push({
                    id: Date.now(),
                    name: `Нова Локація (${wizardConfig.queueId})`,
                    group: wizardConfig.queueId,
                    notify15: wizardConfig.notifyTime == '15',
                    powerOn: wizardConfig.powerOn
                });
                localStorage.setItem('sssk_subscriptions', JSON.stringify(userSubs));
                
                renderCabinet();
                closeWizard();
                currentStep = 1;
                updateWizardUI();
            }
        });
    }

    const btnBack = document.getElementById('btn-wizard-back');
    if (btnBack) {
        btnBack.addEventListener('click', () => {
            if (currentStep > 1) {
                currentStep--;
                updateWizardUI();
            }
        });
    }
}

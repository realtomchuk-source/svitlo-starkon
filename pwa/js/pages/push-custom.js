window.customPushMode = 'push';

window.openCustomPushSetup = function(index = 0, mode = 'push') {
    window.currentEditingSlot = index;
    window.customPushMode = mode;
    
    const overlay = document.getElementById('custom-push-setup-overlay');
    const container = overlay ? overlay.querySelector('.picker-container') : null;
    const titleEl = document.querySelector('.picker-title');

    if (overlay) {
        overlay.classList.add('active');
        overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        // Toggle minimal mode for Start Queue (TZ 2.1)
        if (mode === 'start-queue') {
            if (container) container.classList.add('setup-minimal');
            if (titleEl) titleEl.innerText = 'Стартова підчерга';
            
            // Auto-open subqueue selection for convenience
            const sqDetails = document.getElementById('custom-push-sq-details');
            if (sqDetails) sqDetails.setAttribute('open', '');
        } else {
            if (container) container.classList.remove('setup-minimal');
            if (titleEl) titleEl.innerText = 'Налаштування пуш';
        }

        // Pre-fill fields if settings exist
        const sub = window.userSubscriptions && window.userSubscriptions[index];
        const deactContainer = document.getElementById('btn-custom-deactivate-container');

        if (sub && sub.active) {
            document.getElementById('custom-push-location').value = sub.locationName || '';
            document.getElementById('custom-push-subqueue').value = sub.group || '1.1';
            document.getElementById('custom-notify-time').value = sub.notifyTime || '10';
            
            // Update summary texts
            const sqSummary = document.getElementById('custom-push-sq-summary-text');
            if (sqSummary) {
                sqSummary.innerText = 'Підчерга ' + (sub.group || '1.1');
                sqSummary.style.color = 'var(--system-accent)';
            }
            const timeSummary = document.getElementById('custom-push-time-summary-text');
            if (timeSummary) timeSummary.innerText = (sub.notifyTime || '10') + ' хв';

            // DND pre-fill
            if (sub.dnd) {
                const is247 = !sub.dnd.active;
                document.getElementById('custom-dnd-247-toggle').checked = is247;
                window.toggleCustom247Mode(is247);

                if (sub.dnd.start) {
                    document.getElementById('lbl-dnd-start').innerText = sub.dnd.start;
                    const parts = sub.dnd.start.split(':');
                    const val = (parseInt(parts[0]) * 60 + parseInt(parts[1])) / 15;
                    document.getElementById('custom-dnd-start').value = val;
                }
                if (sub.dnd.end) {
                    document.getElementById('lbl-dnd-end').innerText = sub.dnd.end;
                    const parts = sub.dnd.end.split(':');
                    const val = (parseInt(parts[0]) * 60 + parseInt(parts[1])) / 15;
                    document.getElementById('custom-dnd-end').value = val;
                }
            }
            
            // Show deactivation button
            if (deactContainer) deactContainer.style.display = 'block';

            // Sync slider gradients
            const sIdx = document.getElementById('custom-dnd-start');
            const eIdx = document.getElementById('custom-dnd-end');
            if(sIdx) window.updateDndTimeDisplay(sIdx, 'lbl-dnd-start');
            if(eIdx) window.updateDndTimeDisplay(eIdx, 'lbl-dnd-end');

            // Sync grid buttons UI
            const sqGrid = document.getElementById('custom-push-sq-grid');
            if (sqGrid) {
                const btns = sqGrid.querySelectorAll('.sq-btn');
                btns.forEach(b => {
                    b.classList.toggle('active', sub.group && b.innerText.trim() === sub.group);
                });
            }
            const timeGrid = document.getElementById('custom-push-time-grid');
            if (timeGrid) {
                const btns = timeGrid.querySelectorAll('.sq-btn');
                btns.forEach(b => {
                    b.classList.toggle('active', sub.notifyTime && b.innerText.includes(sub.notifyTime.toString()));
                });
            }
        } else {
            // Default values for new/inactive slot
            document.getElementById('custom-push-location').value = '';
            document.getElementById('custom-push-subqueue').value = '1.1';
            document.getElementById('custom-notify-time').value = '';
            document.getElementById('custom-dnd-247-toggle').checked = false;
            window.toggleCustom247Mode(false);
            
            document.getElementById('lbl-dnd-start').innerText = '22:00';
            document.getElementById('custom-dnd-start').value = 88;
            document.getElementById('lbl-dnd-end').innerText = '08:00';
            document.getElementById('custom-dnd-end').value = 32;

            // Reset subqueue summary if exists elsewhere
            const sqSummary = document.getElementById('custom-push-sq-summary-text');
            if (sqSummary) {
                sqSummary.innerText = 'Оберіть підчергу';
                sqSummary.style.color = '';
            }
            const timeSummary = document.getElementById('custom-push-time-summary-text');
            if (timeSummary) {
                timeSummary.innerText = 'Оберіть час';
                timeSummary.style.color = '';
            }
            if (deactContainer) deactContainer.style.display = 'none';

            // Sync slider UI for default values
            const sIdx = document.getElementById('custom-dnd-start');
            const eIdx = document.getElementById('custom-dnd-end');
            if(sIdx) window.updateDndTimeDisplay(sIdx, 'lbl-dnd-start');
            if(eIdx) window.updateDndTimeDisplay(eIdx, 'lbl-dnd-end');

            // Reset grids to default (none active)
            const sqGrid = document.getElementById('custom-push-sq-grid');
            if (sqGrid) {
                sqGrid.querySelectorAll('.sq-btn').forEach(b => b.classList.remove('active'));
            }
            const timeGrid = document.getElementById('custom-push-time-grid');
            if (timeGrid) {
                timeGrid.querySelectorAll('.sq-btn').forEach(b => b.classList.remove('active'));
            }
        }

        // Close other dropdowns on open
        const timeDetails = document.getElementById('custom-push-time-details');
        if (timeDetails) timeDetails.removeAttribute('open');
    }
};

window.closeCustomPushSetup = function() {
    const overlay = document.getElementById('custom-push-setup-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        setTimeout(() => {
            overlay.style.display = 'none';
            document.body.style.overflow = '';
        }, 300);
    }
};

window.toggleCustom247Mode = function(is247) {
    const timeContainer = document.getElementById('custom-dnd-time-container');
    const titleWrap = document.getElementById('custom-dnd-title-wrap');
    if (is247) {
        timeContainer.style.opacity = '0.3';
        timeContainer.style.pointerEvents = 'none';
        if (titleWrap) titleWrap.style.opacity = '0.3';
    } else {
        timeContainer.style.opacity = '1';
        timeContainer.style.pointerEvents = 'auto';
        if (titleWrap) titleWrap.style.opacity = '1';
    }
};

window.selectCustomPushSubqueue = function(val, element) {
    const hiddenInput = document.getElementById('custom-push-subqueue');
    if (hiddenInput) hiddenInput.value = val;
    
    const summaryText = document.getElementById('custom-push-sq-summary-text');
    if (summaryText) {
        summaryText.innerText = 'Підчерга ' + val;
        summaryText.style.color = 'var(--accent)';
    }

    const grid = document.getElementById('custom-push-sq-grid');
    if (grid) {
        const btns = grid.querySelectorAll('.sq-btn');
        btns.forEach(b => b.classList.remove('active'));
        if (element) element.classList.add('active');
    }

    // Modal is now simplified, no accordion to close

    // LOGIC: If in Start Queue mode, save and close immediately (TZ 2.2)
    if (window.customPushMode === 'start-queue') {
        localStorage.setItem('startQueue', val);
        
        // Update UI in cabinet immediately
        if (window.renderStartQueueValue) window.renderStartQueueValue();
        
        // Close overlay
        window.closeCustomPushSetup();
        
        // Optional: notification or subtle feedback
        console.log(`Start Queue set to: ${val}`);
    }
};

window.selectCustomPushTime = function(val, element) {
    const input = document.getElementById('custom-notify-time');
    if (input) input.value = val;
    
    const summaryText = document.getElementById('custom-push-time-summary-text');
    if (summaryText) {
        summaryText.innerText = val + ' хв';
        summaryText.style.color = 'var(--system-accent)';
    }
    
    const grid = document.getElementById('custom-push-time-grid');
    if (grid) {
        const btns = grid.querySelectorAll('.sq-btn');
        btns.forEach(b => b.classList.remove('active'));
        if (element) element.classList.add('active');
    }
    
    const detailsAttr = document.getElementById('custom-push-time-details');
    if (detailsAttr) detailsAttr.removeAttribute('open');
};

window.updateDndTimeDisplay = function(element, labelId) {
    const val = parseInt(element.value, 10);
    const min = element.min || 0;
    const max = element.max || 95;
    const pct = ((val - min) / (max - min)) * 100;
    
    // Improved gradient logic to prevent overflow glitches
    element.style.background = `linear-gradient(to right, var(--system-accent) 0%, var(--system-accent) ${pct}%, rgba(128,128,128,0.12) ${pct}%, rgba(128,128,128,0.12) 100%)`;

    const totalMinutes = val * 15;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const hh = String(hours).padStart(2, '0');
    const mm = String(mins).padStart(2, '0');
    document.getElementById(labelId).innerText = `${hh}:${mm}`;
};

window.saveCustomPushSetup = function() {
    const index = window.currentEditingSlot || 0;
    const locationName = document.getElementById('custom-push-location').value.trim();
    const subqueue = document.getElementById('custom-push-subqueue').value;
    const notifyTime = document.getElementById('custom-notify-time').value;
    const is247 = document.getElementById('custom-dnd-247-toggle').checked;
    
    const dndStartText = document.getElementById('lbl-dnd-start').innerText;
    const dndEndText = document.getElementById('lbl-dnd-end').innerText;

    if(!locationName) {
        alert("Будь ласка, вкажіть назву локації.");
        return;
    }
    if(!subqueue) {
        alert("Будь ласка, оберіть підчергу.");
        return;
    }
    if(!notifyTime) {
        alert("Будь ласка, оберіть час за який попередити.");
        return;
    }

    // Update global state
    if (!window.userSubscriptions) window.userSubscriptions = [{}, {}];
    
    window.userSubscriptions[index] = {
        active: true,
        locationName: locationName,
        group: subqueue,
        notifyTime: parseInt(notifyTime),
        dnd: {
            active: !is247,
            start: dndStartText,
            end: dndEndText
        }
    };

    // Sync to localStorage
    localStorage.setItem('sssk_subscriptions', JSON.stringify(window.userSubscriptions));

    // Re-render cabinet
    if (window.renderCabinet) window.renderCabinet();

    // Sync to database
    if (window.v2UserService) {
        window.v2UserService.updatePushSubscriptions(window.userSubscriptions)
            .catch(err => console.error("Database sync error:", err));
    }

    window.closeCustomPushSetup();
};

window.deactivateCustomPushCard = function() {
    const index = window.currentEditingSlot || 0;
    if(!confirm("Вимкнути всі пуш сповіщення для цієї локації?")) return;
    
    if (window.userSubscriptions && window.userSubscriptions[index]) {
        // Clear all data for this slot to revert to default state
        window.userSubscriptions[index] = { active: false };
        localStorage.setItem('sssk_subscriptions', JSON.stringify(window.userSubscriptions));
    }

    // Re-render cabinet
    if (window.renderCabinet) window.renderCabinet();
    
    // Sync to database
    if (window.v2UserService) {
        window.v2UserService.updatePushSubscriptions(window.userSubscriptions)
            .catch(err => console.error("Database sync error:", err));
    }

    window.closeCustomPushSetup();
};

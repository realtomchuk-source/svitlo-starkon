// Логіка лівої картки "Кастомне налаштування пушів"

window.openCustomPushSetup = function() {
    const overlay = document.getElementById('custom-push-setup-overlay');
    if (overlay) {
        overlay.classList.add('active');
        overlay.style.display = 'flex';
        // Hide cabinet content if it's an immersive overlay
        document.body.style.overflow = 'hidden';
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
    const startInput = document.getElementById('custom-dnd-start');
    const endInput = document.getElementById('custom-dnd-end');
    
    if (is247) {
        // Grey out time inputs
        timeContainer.style.opacity = '0.3';
        timeContainer.style.pointerEvents = 'none';
        if (titleWrap) titleWrap.style.opacity = '0.3';
        startInput.disabled = true;
        endInput.disabled = true;
    } else {
        // Restore
        timeContainer.style.opacity = '1';
        timeContainer.style.pointerEvents = 'auto';
        if (titleWrap) titleWrap.style.opacity = '1';
        startInput.disabled = false;
        endInput.disabled = false;
    }
};


window.selectCustomPushSubqueue = function(val, element) {
    document.getElementById('custom-push-subqueue').value = val;
    // Update summary text
    const summaryText = document.getElementById('custom-push-sq-summary-text');
    summaryText.innerText = 'Підчерга ' + val;
    summaryText.style.color = '#ee7221'; // Highlight active selection
    
    // Remove active from all grid buttons
    const btns = document.getElementById('custom-push-sq-grid').querySelectorAll('.sq-btn');
    btns.forEach(b => b.classList.remove('active'));
    // Add active to clicked
    element.classList.add('active');
    
    // Close the accordion
    const detailsAttr = document.getElementById('custom-push-sq-details');
    if (detailsAttr) {
        detailsAttr.removeAttribute('open');
    }
};

window.selectCustomPushTime = function(val, element) {
    document.getElementById('custom-notify-time').value = val;
    // Update summary text
    const summaryText = document.getElementById('custom-push-time-summary-text');
    summaryText.innerText = val + ' хв';
    summaryText.style.color = '#ee7221'; // Highlight active selection
    
    // Remove active from all grid buttons
    const btns = document.getElementById('custom-push-time-grid').querySelectorAll('.sq-btn');
    btns.forEach(b => b.classList.remove('active'));
    // Add active to clicked
    element.classList.add('active');
    
    // Close the accordion
    const detailsAttr = document.getElementById('custom-push-time-details');
    if (detailsAttr) {
        detailsAttr.removeAttribute('open');
    }
};

// Convert 0-95 slider value to HH:MM format (15-minute steps)
window.updateDndTimeDisplay = function(element, labelId) {
    const val = parseInt(element.value, 10);
    const totalMinutes = val * 15;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    
    const hh = String(hours).padStart(2, '0');
    const mm = String(mins).padStart(2, '0');
    
    document.getElementById(labelId).innerText = `${hh}:${mm}`;
};

// State mapping for queue/subqueue colors
function getQueueColor(subqueue) {
    // Only orange color for custom push cards as per new aesthetic
    return '#ee7221'; 
}

window.saveCustomPushSetup = function() {
    console.log('[Push Custom] Saving settings...');
    
    const locationName = document.getElementById('custom-push-location').value.trim();
    const subqueue = document.getElementById('custom-push-subqueue').value;
    
    const notifyTime = document.getElementById('custom-notify-time').value;

    const is247 = document.getElementById('custom-dnd-247-toggle').checked;
    
    // Convert 0-95 scale to actual HH:MM based on labels
    const dndStartText = document.getElementById('lbl-dnd-start').innerText;
    const dndEndText = document.getElementById('lbl-dnd-end').innerText;
    const dndStartVal = document.getElementById('custom-dnd-start').value;
    const dndEndVal = document.getElementById('custom-dnd-end').value;
    
    if(!locationName) {
        alert("Будь ласка, вкажіть назву локації.");
        return;
    }
    if(!subqueue) {
        alert("Будь ласка, оберіть підчергу.");
        return;
    }

    // Save logic: update the card in cabinet HTML
    const card = document.getElementById('custom-card-left');
    if(card) {
        // Remove empty state classes
        card.style.opacity = '1';
        card.style.border = `1.5px solid rgba(238, 114, 33, 0.3)`; // Orange tint border
        card.style.background = `rgba(128,128,128,0.06)`; // Gray cushion
        card.style.boxShadow = `0 4px 15px rgba(0,0,0,0.05)`;
        
        // DND Text reflects the period when pushing is paused
        let dndText = is247 ? 'Без режиму не турбувати' : `Режим не турбувати з ${dndStartText} до ${dndEndText}`;
        
        card.innerHTML = `
            <div style="display: flex; flex-direction: column; width: 100%; height: 100%; position: relative; padding: 4px; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                    <span style="font-weight: 800; font-size: 16px; color: #374151; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${locationName}</span>
                    <span style="font-size: 12px; font-weight: 800; background: #ee7221; color: #ffffff; padding: 2px 8px; border-radius: 8px;">Підчерга ${subqueue}</span>
                </div>
                <div style="font-size: 13px; font-weight: 600; color: #374151; opacity: 0.8; display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                    за ${notifyTime} хв
                </div>
                <div style="font-size: 13px; font-weight: 700; color: #ee7221; margin-top: auto; display: flex; align-items: center; gap: 4px;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    ${dndText}
                </div>
            </div>
        `;
    }
    
    // Make deactivate button visible
    document.getElementById('btn-custom-deactivate-container').style.display = 'block';

    // Store settings in window or localStorage if needed for actual backend connect
    window.customPushSettings = {
        location: locationName,
        subqueue: subqueue,
        notifyTime: notifyTime,
        is247: is247,
        dndStart: dndStartVal,
        dndEnd: dndEndVal
    };

    window.closeCustomPushSetup();
};

window.deactivateCustomPushCard = function() {
    if(!confirm("Очистити налаштування пушів для цієї картки?")) return;
    
    // Reset Data
    document.getElementById('custom-push-location').value = '';
    document.getElementById('custom-push-subqueue').value = '';
    document.getElementById('nt-10').checked = true;
    window.updateNotifyTimeUI(document.getElementById('nt-10'));
    
    document.getElementById('custom-dnd-247-toggle').checked = false;
    window.toggleCustom247Mode(false);
    
    document.getElementById('custom-dnd-start').value = '22:00';
    document.getElementById('custom-dnd-end').value = '08:00';
    
    document.getElementById('btn-custom-deactivate-container').style.display = 'none';
    window.customPushSettings = null;

    // Revert visual state of the card
    const card = document.getElementById('custom-card-left');
    if(card) {
        card.style.opacity = '0.6';
        card.style.border = '1.5px dashed rgba(128,128,128,0.4)';
        card.style.background = 'var(--glass-bg-light)';
        card.style.boxShadow = 'none';
        card.style.padding = '14px';
        card.innerHTML = `
            <div style="display: flex; flex-direction: column; width: 100%; height: 100%; position: relative; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; filter: grayscale(1);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                    <span style="font-weight: 800; font-size: 16px; color: #374151; opacity: 0.8; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">Локація</span>
                    <span style="font-size: 12px; font-weight: 800; background: rgba(128,128,128,0.25); color: #374151; padding: 2px 8px; border-radius: 8px;">Підчерга 1.1</span>
                </div>
                <div style="font-size: 13px; font-weight: 600; color: #374151; opacity: 0.5; display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                    за 10 хв
                </div>
                <div style="font-size: 13px; font-weight: 700; color: #374151; opacity: 0.5; margin-top: auto; display: flex; align-items: center; gap: 4px;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    Режим не турбувати з 22:00 до 08:00
                </div>
            </div>
        `;
    }
    
    window.closeCustomPushSetup();
};

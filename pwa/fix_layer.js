const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app.js');
let code = fs.readFileSync(filePath, 'utf8');

const startFunc = '    function updateHeroUI(isCurrentlyOn, nextChangeTime, isAllClear) {';
const endFunc = '    function renderTimeline(text, now = new Date()) {';

const startIndex = code.indexOf(startFunc);
const endIndex = code.indexOf(endFunc);

if (startIndex === -1 || endIndex === -1) {
    console.error('Could not find boundaries');
    process.exit(1);
}

const correctBlock = `    function updateHeroUI(isCurrentlyOn, nextChangeTime, isAllClear) {
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
            return;
        }

        const color = isCurrentlyOn ? '#FF9500' : '#8E8E93'; // System Orange / Gray
        const glow = isCurrentlyOn ? 'rgba(255, 149, 0, 0.15)' : 'rgba(142, 142, 147, 0.15)';
        const statusIcon = isCurrentlyOn ? 'assets/power_on.png' : 'assets/power_off.png';
        const title = isCurrentlyOn ? 'Світло є' : 'Світла немає';

        if (heroCard) {
            heroCard.style.setProperty('--hero-color', color);
            heroCard.style.setProperty('--hero-glow', isCurrentlyOn ? '#FF9500' : '#8E8E93');
        }

        const heroIconImg = document.getElementById('hero-icon-3d');
        if (heroIconImg) {
            heroIconImg.src = statusIcon;
            heroIconImg.style.transform = 'scale(0.85)';
            setTimeout(() => { if(heroIconImg) heroIconImg.style.transform = 'scale(1)' }, 150);
        }

        if (heroTitle) heroTitle.textContent = title;

        // Force hide Tomorrow Button per user request
        const btnTomorrow = document.getElementById('btn-show-tomorrow');
        if (btnTomorrow) {
            btnTomorrow.classList.add('hidden');
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

            const displayH = h > 0 ? \`\${h} год \` : '';
            const displayM = \`\${m.toString().padStart(2, '0')} хв\`;

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
        const dateStr = \`\${d}.\${m}\`;
        const daySchedule = scheduleData[dateStr];

        if (!daySchedule) {
            console.warn(\`No schedule found for \${dateStr}. Showing fallback.\`);
            // If it's today and no schedule, it might be an empty day
            if (!window.isTomorrowView) {
                updateHeroUI(true, new Date(now.getTime() + 3600000), true);
            }
            renderTimeline('', now);
            return;
        }

        const text = daySchedule.content || daySchedule.parsed_text || '';

        // --- Time Engine Logic (Mock for now) ---
        const isOffKeywords = ['відключення', 'графік', 'вимкнення'];
        const hasOutageMessage = isOffKeywords.some(key => (text || '').toString().toLowerCase().includes(key));

        const currentHour = now.getHours();

        let isCurrentlyOn = true;
        let nextChangeHour = 24;
        let isAllClear = !hasOutageMessage;

        if (hasOutageMessage) {
            const groupIndex = groups.indexOf(selectedGroup);
            // Simulate 3 hours off, 3 hours on pattern dynamically shifted by group
            isCurrentlyOn = !((currentHour + groupIndex * 2) % 6 < 3);

            // Find next change
            for (let i = currentHour + 1; i <= 24; i++) {
                if (i === 24) {
                    nextChangeHour = 24;
                    break;
                }
                const stateAtHour = !((i + groupIndex * 2) % 6 < 3);
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

`;

const newCode = code.slice(0, startIndex) + correctBlock + code.slice(endIndex);
fs.writeFileSync(filePath, newCode, 'utf8');
console.log('Successfully replaced functions updateHeroUI and renderUI');

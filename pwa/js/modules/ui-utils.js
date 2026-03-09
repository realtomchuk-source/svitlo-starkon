/**
 * ui-utils.js
 * Допоміжні функції для керування інтерфейсом: карусель черг, нижня панель тощо.
 */

// Відкриття та закриття нижньої панелі вибору черги
export function openSheet(overlayId = 'overlay', stopBodyScroll = true) {
    const overlay = document.getElementById(overlayId);
    if (!overlay) return;
    overlay.classList.add('active');
    if (stopBodyScroll) document.body.style.overflow = 'hidden';
}

export function closeSheet(overlayId = 'overlay') {
    const overlay = document.getElementById(overlayId);
    if (!overlay) return;
    overlay.classList.remove('active');
    document.body.style.overflow = '';
}

// Рендер кнопок каруселі груп
export function renderGroupCarousel(config) {
    const { containerId, groups, selectedGroup, onSelect } = config;
    const carousel = document.getElementById(containerId);
    if (!carousel) return;

    carousel.innerHTML = '';
    groups.forEach(group => {
        const pill = document.createElement('button');
        pill.className = `carousel-pill ${group === selectedGroup ? 'active' : ''}`;
        pill.textContent = group;
        pill.onclick = (e) => {
            onSelect(group, e.target);
            if (group !== selectedGroup) {
                // Візуальний зворотний зв'язок (мікро-анімація натискання)
                pill.style.transform = 'scale(0.95)';
                setTimeout(() => pill.style.transform = '', 100);
            }
        };
        carousel.appendChild(pill);

        if (group === selectedGroup) {
            centerActivePill(carousel, pill);
        }
    });

    // Намалювати кнопки також у Bottom Sheet
    const sheetGrid = document.getElementById('group-buttons');
    if (sheetGrid) {
        sheetGrid.innerHTML = '';
        groups.forEach(group => {
            const btn = document.createElement('button');
            btn.className = `group-btn glass-card ${group === selectedGroup ? 'active' : ''}`;
            btn.textContent = group;
            btn.onclick = (e) => {
                onSelect(group, null);
            };
            sheetGrid.appendChild(btn);
        });
    }
}

export function centerActivePill(carousel, pill) {
    if (!carousel || !pill) return;
    setTimeout(() => {
        const containerWidth = carousel.offsetWidth;
        const pillOffset = pill.offsetLeft;
        const pillWidth = pill.offsetWidth;
        carousel.scrollLeft = pillOffset - (containerWidth / 2) + (pillWidth / 2);
    }, 100);
}

// Налаштування свайпів для центральної картки (Hero)
export function initHeroSwipes(heroId, onSwipeLeft, onSwipeRight) {
    const heroCard = document.getElementById(heroId);
    if (!heroCard) return;

    let startX = 0;

    function handleSwipeEnd(endX) {
        const diff = startX - endX;
        const threshold = 50; // pixels

        if (Math.abs(diff) > threshold) {
            heroCard.style.transform = 'scale(0.98)';
            setTimeout(() => heroCard.style.transform = '', 100);
            
            if (diff > 0 && typeof onSwipeLeft === 'function') {
                onSwipeLeft();
            } else if (diff < 0 && typeof onSwipeRight === 'function') {
                onSwipeRight();
            }
        }
    }

    // Touch events
    heroCard.addEventListener('touchstart', (e) => {
        startX = e.changedTouches[0].screenX;
    }, { passive: true });

    heroCard.addEventListener('touchend', (e) => {
        handleSwipeEnd(e.changedTouches[0].screenX);
    }, { passive: true });

    // Mouse events (for desktop swiping testing)
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
    heroCard.style.userSelect = 'none';
}

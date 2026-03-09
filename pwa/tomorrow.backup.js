// tomorrow.js - Окремий модуль для сторінки "Графік на завтра"
// Відповідає за специфічну логіку та перевизначення поведінки головного рушія (app.js)

// 1. Встановлення глобального прапорця для ідентифікації сторінки в app.js
window.isTomorrowView = true;

// 2. Ізольована логіка інтерфейсу завтрашнього дня
window.TomorrowOverride = function() {
    // Зупиняємо динамічний таймер зворотного відліку
    if (window.countdownInterval) {
        clearInterval(window.countdownInterval);
    }
    
    // Встановлюємо статичні повідомлення
    const countdownEl = document.getElementById('hero-countdown');
    if (countdownEl) {
        countdownEl.textContent = "Почнеться о 00:00";
    }
    
    const heroSubtitleEl = document.getElementById('hero-subtitle');
    if (heroSubtitleEl) {
        heroSubtitleEl.textContent = "Графік на наступну добу";
    }
    
    // Завжди встановлюємо повзунок часу на початок доби (00:00), 
    // якщо користувач його ще не чіпав
    const scrubber = document.getElementById('timeline-scrubber');
    if (scrubber && !window.scrubberInteracted) {
        scrubber.value = 0;
        if (typeof window.updateScrubberPreview === 'function') {
            window.updateScrubberPreview();
        }
    }
};

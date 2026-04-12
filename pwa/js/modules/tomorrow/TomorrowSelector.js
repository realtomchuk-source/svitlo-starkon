/**
 * TomorrowSelector.js
 * Автономний селектор підчерг для сторінки "Завтра".
 * Повністю сумісний зі стилями selector.css.
 */

export class TomorrowSelector {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.options = Object.assign({
            items: ['1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2', '5.1', '5.2', '6.1', '6.2'],
            onSelect: () => {}
        }, options);

        this.activeQueue = null;
        this.allCards = [];
        this.scrollEl = null;

        // Додаємо ID для спрацювання стилів із selector.css
        this.container.id = 'subqueue-selector';
        this.container.classList.add('dark'); // За замовчуванням "темна" тема (помаранчева)

        this.init();
    }

    init() {
        this.container.innerHTML = `
            <div class="selector-wrap">
                <div class="selector-container">
                    <div class="selector-scroll" id="tomorrow-selector-scroll"></div>
                </div>
            </div>
        `;

        this.scrollEl = this.container.querySelector('#tomorrow-selector-scroll');
        const items = this.options.items;
        
        // Створюємо 3 набори для нескінченного ефекту (як у SelectorEngine.js)
        [ -1, 0, 1 ].forEach(offsetMult => {
            items.forEach((item) => {
                const card = this.createCard(item, offsetMult !== 0);
                this.scrollEl.appendChild(card);
                this.allCards.push(card);
            });
        });

        this.setupEvents();
    }

    createCard(queue, isClone) {
        const card = document.createElement('div');
        card.className = 'selector-card';
        card.dataset.queue = queue;
        if (isClone) card.dataset.clone = 'true';

        card.innerHTML = `
            <span class="selector-num">${queue}</span>
            <span class="selector-label">підчерга</span>
        `;

        card.addEventListener('click', () => {
            this.setActive(queue);
            this.scrollToCard(card);
        });

        return card;
    }

    setupEvents() {
        let isScrolling;
        this.scrollEl.addEventListener('scroll', () => {
            window.clearTimeout(isScrolling);
            isScrolling = setTimeout(() => {
                this.handleSnap();
            }, 100);
        });
    }

    handleSnap() {
        const center = this.scrollEl.scrollLeft + this.scrollEl.offsetWidth / 2;
        let closest = null;
        let minDiff = Infinity;

        this.allCards.forEach(card => {
            const cardCenter = card.offsetLeft + card.offsetWidth / 2;
            const diff = Math.abs(center - cardCenter);
            if (diff < minDiff) {
                minDiff = diff;
                closest = card;
            }
        });

        if (closest) {
            const queue = closest.dataset.queue;
            this.setActive(queue);
            
            if (closest.dataset.clone === 'true') {
                const real = this.allCards.find(c => c.dataset.queue === queue && !c.dataset.clone);
                if (real) this.scrollToCard(real, false);
            }
        }
    }

    setActive(queue) {
        if (this.activeQueue === queue) return;
        this.activeQueue = queue;
        
        this.allCards.forEach(card => {
            card.classList.toggle('active', card.dataset.queue === queue);
        });

        if (navigator.vibrate) navigator.vibrate(10);
        this.options.onSelect(queue);
    }

    scrollToCard(card, smooth = true) {
        const target = card.offsetLeft - (this.scrollEl.offsetWidth / 2) + (card.offsetWidth / 2);
        this.scrollEl.scrollTo({ left: target, behavior: smooth ? 'smooth' : 'auto' });
    }

    setActiveQueue(queue) {
        const card = this.allCards.find(c => c.dataset.queue === queue && !c.dataset.clone);
        if (card) {
            this.setActive(queue);
            this.scrollToCard(card, false);
        }
    }

    /**
     * Оновлення теми селектора (помаранчевий/сірий)
     */
    updateTheme(theme) {
        this.container.classList.remove('dark', 'light');
        this.container.classList.add(theme);
    }
}

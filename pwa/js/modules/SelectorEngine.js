/**
 * SelectorEngine.js
 * Horizontal Pill Selector for Sub-Queue Selection
 * Infinite circular scrolling with pointer-drag and scroll-snap.
 */

export class SelectorEngine {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('SelectorEngine: Container not found', containerId);
            return;
        }

        this.options = Object.assign({
            items: ['1.1', '1.2', '2.1', '2.2', '3.1', '3.2',
                    '4.1', '4.2', '5.1', '5.2', '6.1', '6.2'],
            onSelect: (val) => console.log('Selector: Selected', val),
            debounceMs: 80
        }, options);

        this.activeQueue = null;
        this.cards = [];      // Only "real" cards
        this.allCards = [];    // Real + clone cards
        this.scrollTimeout = null;

        // Drag state
        this.isDragging = false;
        this.startX = 0;
        this.startScrollLeft = 0;
        this.hasMoved = false;

        this.init();
    }

    init() {
        this.container.innerHTML = '';

        const wrap = document.createElement('div');
        wrap.className = 'selector-wrap';

        const glass = document.createElement('div');
        glass.className = 'selector-container';

        this.scrollEl = document.createElement('div');
        this.scrollEl.className = 'selector-scroll';

        const items = this.options.items;
        const len = items.length;

        // Build 3 sets: [clones-left] [REAL] [clones-right]
        // This ensures infinite seamless looping
        const sets = [
            { offset: -len, isClone: true },
            { offset: 0,    isClone: false },
            { offset: len,  isClone: true }
        ];

        sets.forEach(set => {
            items.forEach((q, i) => {
                const card = this.createCard(q, i + set.offset, set.isClone);
                this.scrollEl.appendChild(card);
                this.allCards.push(card);

                if (!set.isClone) {
                    this.cards.push(card);
                }
            });
        });

        // Assemble DOM
        glass.appendChild(this.scrollEl);
        wrap.appendChild(glass);
        this.container.appendChild(wrap);

        // Events
        this.setupDragScroll();
        this.setupScrollSnap();
    }

    createCard(queue, index, isClone) {
        const card = document.createElement('div');
        card.className = 'selector-card';
        card.dataset.queue = queue;
        card.dataset.index = index;
        if (isClone) card.dataset.clone = 'true';

        const num = document.createElement('span');
        num.className = 'selector-num';
        num.textContent = queue;

        const label = document.createElement('span');
        label.className = 'selector-label';
        label.textContent = 'підчерга';

        card.appendChild(num);
        card.appendChild(label);

        card.addEventListener('click', () => {
            if (this.hasMoved) return;
            this.scrollCardToCenter(card, true);
            this.setActive(queue);
        });

        return card;
    }

    setupDragScroll() {
        const el = this.scrollEl;

        const onStart = (e) => {
            this.isDragging = true;
            this.hasMoved = false;
            this.startX = e.pageX || (e.touches && e.touches[0].pageX);
            this.startScrollLeft = el.scrollLeft;
            el.style.scrollSnapType = 'none';
            el.style.cursor = 'grabbing';
        };

        const onMove = (e) => {
            if (!this.isDragging) return;
            e.preventDefault();
            const x = e.pageX || (e.touches && e.touches[0].pageX);
            const dx = x - this.startX;

            if (Math.abs(dx) > 5) {
                this.hasMoved = true;
            }

            el.scrollLeft = this.startScrollLeft - dx;
        };

        const onEnd = () => {
            if (!this.isDragging) return;
            this.isDragging = false;
            el.style.scrollSnapType = 'x mandatory';
            el.style.cursor = '';

            clearTimeout(this.scrollTimeout);
            this.scrollTimeout = setTimeout(() => {
                this.snapAndNormalize();
            }, this.options.debounceMs);
        };

        el.addEventListener('pointerdown', onStart);
        el.addEventListener('pointermove', onMove);
        el.addEventListener('pointerup', onEnd);
        el.addEventListener('pointerleave', onEnd);
    }

    setupScrollSnap() {
        this.scrollEl.addEventListener('scroll', () => {
            if (this.isDragging) return;

            clearTimeout(this.scrollTimeout);
            this.scrollTimeout = setTimeout(() => {
                this.snapAndNormalize();
            }, this.options.debounceMs);
        });
    }

    /** Find the centered card and, if it's a clone, teleport to the real one */
    snapAndNormalize() {
        const centered = this.getCenteredCard();
        if (!centered) return;

        const queue = centered.dataset.queue;
        this.setActive(queue);

        // If landed on a clone, silently jump to the real card
        if (centered.dataset.clone === 'true') {
            const realCard = this.cards.find(c => c.dataset.queue === queue);
            if (realCard) {
                // Disable snap briefly for instant jump
                this.scrollEl.style.scrollSnapType = 'none';
                this.scrollCardToCenter(realCard, false);
                // Re-enable snap after paint
                requestAnimationFrame(() => {
                    this.scrollEl.style.scrollSnapType = 'x mandatory';
                });
            }
        } else {
            this.scrollCardToCenter(centered, true);
        }
    }

    getCenteredCard() {
        const scrollCenter = this.scrollEl.scrollLeft + this.scrollEl.offsetWidth / 2;
        let closest = null;
        let minDiff = Infinity;

        this.allCards.forEach(card => {
            const cardCenter = card.offsetLeft + card.offsetWidth / 2;
            const diff = Math.abs(scrollCenter - cardCenter);
            if (diff < minDiff) {
                minDiff = diff;
                closest = card;
            }
        });

        return closest;
    }

    setActive(queue) {
        if (queue === this.activeQueue) return;

        this.activeQueue = queue;

        if (navigator.vibrate) navigator.vibrate(10);

        // Highlight ALL cards (real + clones) with this queue value
        this.allCards.forEach(card => {
            card.classList.toggle('active', card.dataset.queue === queue);
        });

        this.options.onSelect(queue);
    }

    /** Scroll to a specific queue (e.g. on init or external trigger) */
    scrollTo(queue, animate = true) {
        const card = this.cards.find(c => c.dataset.queue === queue);
        if (card) {
            this.scrollCardToCenter(card, animate);
            this.setActive(queue);
        }
    }

    /** Scroll a card to center without moving the page */
    scrollCardToCenter(card, smooth = true) {
        const scrollEl = this.scrollEl;
        const cardCenter = card.offsetLeft + card.offsetWidth / 2;
        const scrollCenter = scrollEl.offsetWidth / 2;
        const target = cardCenter - scrollCenter;

        scrollEl.scrollTo({
            left: target,
            behavior: smooth ? 'smooth' : 'auto'
        });
    }
}

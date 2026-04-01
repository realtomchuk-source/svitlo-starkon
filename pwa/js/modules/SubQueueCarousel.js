/**
 * SubQueueCarousel.js
 * 3D Cover Flow Engine for Sub-Queue Selection
 */

export class SubQueueCarousel {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!containerId || !this.container) {
            console.error('SubQueueCarousel: Container not found', containerId);
            return;
        }

        this.options = Object.assign({
            items: ['1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2', '5.1', '5.2', '6.1', '6.2'],
            radius: 260, // Increased radius for 7 cards visibility
            itemWidth: 100,
            activeColor: '#bbcf00',
            inactiveColor: '#374151',
            onSelect: (val) => console.log('Selected:', val)
        }, options);

        this.currentIndex = 0;
        this.currentOffset = 0; // Cumulative normalized offset (0 to items.length - 1)
        this.targetOffset = 0;
        
        this.isDragging = false;
        this.startX = 0;
        this.startOffset = 0;
        this.lastX = 0;
        this.velocity = 0;
        this.lastTime = 0;

        this.init();
    }

    init() {
        this.container.innerHTML = '';
        this.container.classList.add('subqueue-carousel-wrap');
        
        this.track = document.createElement('div');
        this.track.className = 'subqueue-carousel-track';
        this.container.appendChild(this.track);

        this.cards = this.options.items.map((val, i) => {
            const card = document.createElement('div');
            card.className = 'subqueue-card';
            card.innerHTML = `<span class="subqueue-num">${val}</span>`;
            card.dataset.index = i;
            
            card.addEventListener('click', () => {
                if (!this.isDragging && Math.abs(this.velocity) < 0.1) {
                    this.scrollToIndex(i);
                }
            });

            this.track.appendChild(card);
            return card;
        });

        this.setupEvents();
        this.update(0);
    }

    setupEvents() {
        const onStart = (e) => {
            this.isDragging = true;
            this.startX = e.clientX || (e.touches && e.touches[0].clientX);
            this.lastX = this.startX;
            this.startOffset = this.currentOffset;
            this.lastTime = Date.now();
            this.velocity = 0;
            this.track.style.transition = 'none';
        };

        const onMove = (e) => {
            if (!this.isDragging) return;
            const x = e.clientX || (e.touches && e.touches[0].clientX);
            const now = Date.now();
            const dt = now - this.lastTime;
            const dx = x - this.lastX;
            
            if (dt > 0) this.velocity = dx / dt;

            // Slightly higher sensitivity for easier spinning
            const sensitivity = 0.02; 
            const diffX = (x - this.startX) * sensitivity;
            
            this.currentOffset = this.startOffset - diffX;
            
            // REMOVED HARD CLAMPING for infinite rotation
            
            this.lastX = x;
            this.lastTime = now;
            this.update();
        };

        const onEnd = () => {
            if (!this.isDragging) return;
            this.isDragging = false;
            
            // Scaled inertia to prevent overshooting
            const sensitivity = 0.02;
            const inertia = Math.abs(this.velocity) > 0.1 ? -this.velocity * 60 * sensitivity : 0;
            this.scrollToIndex(Math.round(this.currentOffset + inertia));
        };

        this.container.addEventListener('pointerdown', onStart);
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onEnd);
    }

    scrollToIndex(index) {
        const oldIndex = this.currentIndex;
        
        // Circular normalization to 0..items.length-1
        const len = this.options.items.length;
        this.currentIndex = ((index % len) + len) % len;
        
        // Shortest path logic: find if it's faster to move forward or backward
        const currentNormalized = ((this.currentOffset % len) + len) % len;
        let diff = this.currentIndex - currentNormalized;
        
        if (diff > len / 2) diff -= len;
        if (diff < -len / 2) diff += len;
        
        this.targetOffset = this.currentOffset + diff;
        this.animateToTarget();
        
        // Final selection and feedback only if logical index changed
        if (oldIndex !== this.currentIndex) {
            this.options.onSelect(this.options.items[this.currentIndex]);
            if (navigator.vibrate) navigator.vibrate(20);
            
            const activeCard = this.cards[this.currentIndex];
            if (activeCard) {
                const num = activeCard.querySelector('.subqueue-num');
                if (num) {
                    num.classList.remove('snap-pulse');
                    void num.offsetWidth;
                    num.classList.add('snap-pulse');
                }
            }
        }
    }

    animateToTarget() {
        const step = () => {
            if (this.isDragging) return;
            const diff = this.targetOffset - this.currentOffset;
            if (Math.abs(diff) < 0.001) {
                this.currentOffset = this.targetOffset;
                this.update();
                // Normalizing offset after completion to keep numbers small
                const len = this.options.items.length;
                this.currentOffset = ((this.currentOffset % len) + len) % len;
                this.targetOffset = this.currentOffset;
                return;
            }
            this.currentOffset += diff * 0.15;
            this.update();
            requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }

    update(offset = this.currentOffset) {
        const len = this.options.items.length;
        const radius = this.options.radius || 220;

        this.cards.forEach((card, i) => {
            let diff = (i - offset) % len;
            if (diff > len / 2) diff -= len;
            if (diff < -len / 2) diff += len;

            const absDiff = Math.abs(diff);
            const theta = diff * (Math.PI / 6); // Spaced out: 30 degrees instead of 22.5

            const x = Math.sin(theta) * radius; 
            const z = Math.cos(theta) * radius; 
            const y = -5; // Shifted 5px up to fill the empty top space

            const rotateY = theta * (180 / Math.PI);
            const rotateX = 0; // Removing card tilt to prevent trapezoidal distortion

            // Natural Light/Depth Shading (Enhanced for background cards)
            const normalizedZ = (z + radius) / (2 * radius); 
            const brightness = 0.1 + (normalizedZ * 1.0); // 0.1 back, 1.1 front
            const opacity = 0.15 + (normalizedZ * 0.85);  // 0.15 back (nearly invisible), 1.0 front

            // Apply 3D Transformation (Including translate -50% to ensure true centering)
            card.style.transform = `translate(-50%, -50%) translate3d(${x}px, ${y}px, ${z}px) rotateY(${rotateY}deg) rotateX(${rotateX}deg)`;
            card.style.opacity = opacity;
            card.style.filter = `brightness(${brightness})`;
            
            // Higher zIndex for cards closer to the viewer
            card.style.zIndex = Math.round(z + radius);

            // Toggle hierarchical status classes exclusively via CSS
            card.classList.remove('active', 'secondary', 'tertiary');
            if (absDiff < 0.5) {
                card.classList.add('active');
            } else if (absDiff < 1.5) {
                card.classList.add('secondary');
            } else if (absDiff < 2.5) {
                card.classList.add('tertiary');
            }
        });
    }
}

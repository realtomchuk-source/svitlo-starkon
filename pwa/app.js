document.addEventListener('DOMContentLoaded', () => {
    console.log('Svitlo-Starkon PWA Initialized');

    // Data handling placeholders
    const DATA_URL = '../parser/data/unified_schedules.json';

    async function fetchData() {
        try {
            const response = await fetch(DATA_URL);
            if (!response.ok) throw new Error('Data not found');
            const data = await response.json();
            updateUI(data);
        } catch (error) {
            console.error('Fetch error:', error);
            document.querySelector('#status-card p').textContent = 'Помилка завантаження графіку';
        }
    }

    function updateUI(data) {
        if (!data || data.length === 0) return;
        
        const latest = data[data.length - 1];
        const statusEl = document.querySelector('#status-card p');
        
        statusEl.innerHTML = `
            <strong>Статус:</strong> Оновлено ${new Date(latest.timestamp).toLocaleTimeString('uk-UA')}<br>
            Джерело: ${latest.source}
        `;
    }

    // Initialize
    fetchData();

    // Navigation interaction
    const navButtons = document.querySelectorAll('.nav-item');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Interaction feedback
            btn.style.transform = 'scale(0.9)';
            setTimeout(() => btn.style.transform = 'scale(1)', 100);
        });
    });
});

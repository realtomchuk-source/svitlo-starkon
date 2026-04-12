import { TomorrowController } from '../modules/tomorrow/TomorrowController.js';
import { TomorrowTimeline } from '../modules/tomorrow/TomorrowTimeline.js';
import { TomorrowSelector } from '../modules/tomorrow/TomorrowSelector.js';
import { fetchTomorrowSchedule } from '../modules/api.js';

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Autonomous module "Tomorrow" initialized.');

    // 1. Динамічне відображення дати у заголовку
    updateHeaderDate();

    // 2. Ініціалізація автономних систем
    await initTomorrowApp();
});

async function initTomorrowApp() {
    try {
        const db = await fetchTomorrowSchedule();
        if (!db) throw new Error('Data not available');

        // Перевірка статусу "в очікуванні"
        if (db.status === 'pending') {
            document.getElementById('tomorrow-timeline').innerHTML = `
                <div class="pending-notice" style="text-align: center; padding: 40px 20px; color: #666; font-weight: 500;">
                    Графік на завтра від Обленерго ще не оприлюднено.<br>Зайдіть пізніше (зазвичай після 19:00).
                </div>
            `;
            const tablo = new TomorrowController();
            tablo.init(null);
            return;
        }

        // А) Ініціалізація Дашборду (Годинник + Статус)
        const tablo = new TomorrowController();
        tablo.init(db);

        // Б) Ініціалізація Графіка
        // Вибираємо початкову підчергу (Default 1.1)
        const activeGroup = db.activeGroup || "1.1";
        const timeline = new TomorrowTimeline({
            containerId: 'tomorrow-timeline',
            scheduleString: db.queues[activeGroup],
            tablo: tablo 
        });

        timeline.init();

        // В) Ініціалізація Селектора підчерг
        const selector = new TomorrowSelector('tomorrow-selector', {
            onSelect: (queue) => {
                console.log('Tomorrow: Changing queue to', queue);
                if (db.queues[queue]) {
                    timeline.updateSchedule(db.queues[queue]);
                    db.activeGroup = queue;
                    tablo.updateStatus();
                }
            }
        });
        
        tablo.setSelector(selector);
        selector.setActiveQueue(activeGroup);

    } catch (e) {
        console.error('Failed to init Tomorrow App:', e);
        document.getElementById('tomorrow-timeline').innerHTML = `<div style="text-align:center; padding: 20px;">Помилка завантаження даних.</div>`;
    }
}

/**
 * Розраховує дату "Завтра" та оновлює заголовок сторінки
 */
function updateHeaderDate() {
    const header = document.getElementById('tomorrow-date-header');
    if (!header) return;

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    const options = { day: 'numeric', month: 'long' };
    const dateFormatted = tomorrow.toLocaleDateString('uk-UA', options);
    
    header.textContent = `ГРАФІК НА ${dateFormatted.toUpperCase()}`;
}

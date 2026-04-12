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

// --- MOCK DATA FOR DEVELOPMENT (FROZEN) ---
const MOCK_DATA = {
    date: '13.04',
    status: 'parser_found',
    activeGroup: '1.1',
    queues: {
        "1.1": "000011110000111100001111", "1.2": "111100001111000011110000",
        "2.1": "001100110011001100110011", "2.2": "110011001100110011001100",
        "3.1": "000000111111000000111111", "3.2": "111111000000111111000000",
        "4.1": "010101010101010101010101", "4.2": "101010101010101010101010",
        "5.1": "000111000111000111000111", "5.2": "111000111000111000111000",
        "6.1": "000000001111111100000000", "6.2": "111111110000000011111111"
    },
    meta: {
        state: "parser_found",
        generated_at: new Date().toISOString()
    }
};

async function initTomorrowApp() {
    try {
        // --- REAL FETCH FROZEN FOR DEV ---
        // const db = await fetchTomorrowSchedule();
        // if (!db) throw new Error('Data not available');
        const db = MOCK_DATA; 

        // А) Ініціалізація Дашборду (Годинник + Статус)
        const tablo = new TomorrowController();
        tablo.init(db);

        // Б) Ініціалізація Графіка
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
                console.log('Tomorrow (Mock): Changing queue to', queue);
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
        document.getElementById('tomorrow-timeline').innerHTML = `<div style="text-align:center; padding: 20px;">Помилка розробки.</div>`;
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

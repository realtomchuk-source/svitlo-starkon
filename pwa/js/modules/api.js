const DATA_URL = './data/today.json';

/**
 * Fetch the today's schedule data
 * Returns a single object with queues, date, message and mode
 */
export async function fetchScheduleData() {
    try {
        const response = await fetch(`data/today.json?t=${new Date().getTime()}`);
        if (!response.ok) throw new Error('Schedule data not found');
        
        const data = await response.json();
        return data; 
    } catch (error) {
        console.error('Fetch error:', error);
        return null;
    }
}

// Attach to window for non-module usage
window.fetchScheduleData = fetchScheduleData;
